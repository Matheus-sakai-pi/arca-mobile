import { randomUUID } from 'node:crypto';
import { test as base, expect, type BrowserContext, type Route } from '@playwright/test';
import type { PGlite } from '@electric-sql/pglite';
import { initialUnit } from '../../src/data/lessons.ts';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';
import { answersFor } from '../learningFixtures.ts';

const rpcNames = new Set([
  'learning_snapshot', 'start_learning_lesson', 'complete_learning_lesson', 'record_study_session',
  'learning_friends', 'learning_friend_action', 'search_learning_people', 'learning_username_available',
  'learning_challenges', 'learning_challenge_create_ten', 'learning_challenge_action',
  'learning_challenge_play', 'learning_challenge_submit', 'submit_question_report',
  'learning_leaderboard', 'learning_leaderboard_scope',
  'learning_energy_status', 'learning_energy_begin', 'learning_energy_public',
  'learning_battery',
]);
const origin = 'https://arca-e2e.supabase.co';
type Failure = { remaining: number; afterCommit: boolean };

export class TestBackend {
  readonly owner = randomUUID();
  readonly friend = randomUUID();
  readonly username = `aluno_${this.owner.slice(0, 8)}`;
  readonly friendName = `amigo_${this.friend.slice(0, 8)}`;
  readonly calls: { name: string; body: Record<string, unknown> }[] = [];
  readonly unexpected: string[] = [];
  readonly failures = new Map<string, Failure>();
  readonly user = {
    id: this.owner, email: 'e2e@example.test', aud: 'authenticated',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { username: this.username, display_name: `@${this.username}` },
    identities: [], created_at: new Date().toISOString(),
  };
  constructor(readonly db: PGlite) {}
  async initialize() {
    await dbCleanup(this.db);
    await this.db.exec('update learning_energy_config set enabled=false,rollout=100');
    await createTestUser(this.db, this.owner, this.username);
    await createTestUser(this.db, this.friend, this.friendName);
  }
  rpc<T = unknown>(name: string, args: Record<string, unknown> = {}, owner: string | null = this.owner) {
    return databaseRpc<T>(this.db, owner, name, args);
  }
  failNext(name: string, afterCommit = false, action?: string) { this.failures.set(action ? `${name}:${action}` : name, { remaining: 1, afterCommit }); }
  async completeLessons(count: number) {
    for (const lesson of initialUnit.lessons.slice(0, count)) {
      await this.rpc('learning_energy_begin', { p_lesson: lesson.id });
      await this.rpc('complete_learning_lesson', { p_lesson_id: lesson.id, p_answers: answersFor(lesson), p_attempt_id: `setup-${lesson.id}` });
    }
  }
  async befriend() {
    await this.rpc('learning_friend_action', { p_person: this.friend, p_action: 'request' });
    await this.rpc('learning_friend_action', { p_person: this.owner, p_action: 'accept' }, this.friend);
  }
  async install(context: BrowserContext, guest = false) {
    const expiry = Math.floor(Date.now() / 1000) + 86400;
    const session = {
      access_token: ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify({ sub: this.owner, role: 'authenticated', aud: 'authenticated', exp: expiry })).toString('base64url'), 'test-only-signature'].join('.'),
      refresh_token: 'test-only-refresh', token_type: 'bearer', expires_in: 86400, expires_at: expiry, user: this.user,
    };
    // Never reseed storage on reload: persistence assertions must exercise the real app writes.
    await context.addInitScript(({ session, owner, guest }) => {
      if (sessionStorage.getItem('arca.e2e.initialized')) return;
      sessionStorage.setItem('arca.e2e.initialized', 'yes');
      localStorage.setItem('arca.onboarding.v1', 'done');
      if (guest) localStorage.setItem('arca.visitor', 'active');
      else localStorage.setItem('sb-arca-e2e-auth-token', JSON.stringify(session));
      localStorage.setItem(`arca.preferences.${guest ? 'guest' : owner}.v1`, JSON.stringify({ soundEnabled: false, hapticsEnabled: false, reduceMotion: true, dailyGoal: 20 }));
    }, { session, owner: this.owner, guest });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) { await this.handle(route, guest ? null : this.owner); return; }
      if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) { await route.continue(); return; }
      this.unexpected.push(`External request blocked: ${url.origin}${url.pathname}`);
      await route.abort('blockedbyclient');
    });
  }
  private async handle(route: Route, owner: string | null) {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204 }); return; }
    try {
      let data: unknown;
      if (url.pathname === '/auth/v1/user') data = this.user;
      else if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.split('/').at(-1)!;
        if (!rpcNames.has(name)) throw new Error(`Unsupported RPC ${name}`);
        const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
        this.calls.push({ name, body });
        const failure = this.failures.get(`${name}:${body.p_action}`) ?? this.failures.get(name);
        if (failure?.remaining && !failure.afterCommit) {
          failure.remaining--; await route.fulfill({ status: 503, json: { message: 'test network interruption' } }); return;
        }
        data = await this.rpc(name, body, owner);
        if (failure?.remaining && failure.afterCommit) {
          failure.remaining--; await route.fulfill({ status: 503, json: { message: 'test receipt lost after commit' } }); return;
        }
      } else if (request.method() === 'GET') {
        const table = url.pathname.split('/').at(-1)!;
        const sql: Record<string, string> = {
          units: "select * from public.units where course_id='biblia-basica' order by order_index",
          lessons: 'select * from public.lessons order by unit_id, order_index',
          questions: 'select * from public.questions where order_index<1000 order by lesson_id, order_index',
          lesson_attempts: 'select result from public.lesson_attempts order by created_at desc',
        };
        if (!sql[table]) throw new Error(`Unsupported table ${table}`);
        data = await this.db.transaction(async tx => {
          await tx.exec(`set local role ${owner ? 'authenticated' : 'anon'}`);
          await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [owner ?? '']);
          const result = await tx.query(sql[table]!);
          const start = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 1000);
          return result.rows.slice(start, start + limit);
        });
      } else throw new Error(`Unsupported request ${request.method()} ${url.pathname}`);
      await route.fulfill({ status: 200, json: data ?? null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'TEST_UNEXPECTED';
      if (code === 'TEST_UNEXPECTED') this.unexpected.push(message);
      await route.fulfill({ status: 400, json: { code, message } });
    }
  }
}

async function dbCleanup(db: PGlite) { await db.exec('delete from battery_wallets where user_id is null; delete from auth.users'); }

export const test = base.extend<{ backend: TestBackend; runtimeChecks: void }, { database: PGlite }>({
  database: [async ({}, use) => {
    const db = await createTestDatabase();
    try { await use(db); } finally { await db.close(); }
  }, { scope: 'worker', timeout: 120_000 }],
  backend: async ({ database }, use) => {
    const backend = new TestBackend(database); await backend.initialize();
    await use(backend);
    expect(backend.unexpected, 'Unexpected requests must not silently bypass the test backend').toEqual([]);
  },
  runtimeChecks: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use();
    expect(errors, 'Unhandled browser errors').toEqual([]);
  }, { auto: true }],
});
export { expect };
