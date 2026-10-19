import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, createTestUser } from '../helpers/database.ts';

type Settings = { achievements: string[]; preferences: Record<string, unknown> | null };
async function settings(db: PGlite, owner: string | null, achievements: string[] | null = null, preferences: unknown = null): Promise<Settings> {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${owner ? 'authenticated' : 'anon'}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [owner ?? '']);
    const literal = achievements === null ? null : `{${achievements.join(',')}}`;
    const result = await tx.query<{ value: Settings }>('select public.learning_user_settings(p_achievements => $1::text[], p_preferences => $2::jsonb) as value', [literal, preferences === null ? null : JSON.stringify(preferences)]);
    return result.rows[0]!.value;
  });
}

test('user settings: achievements only accumulate, preferences validated, private per account', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  const one = '00000000-0000-4000-8000-000000000a01', two = '00000000-0000-4000-8000-000000000a02';
  await createTestUser(db, one, 'config_um'); await createTestUser(db, two, 'config_dois');
  assert.deepEqual(await settings(db, one), { achievements: [], preferences: null });
  assert.deepEqual((await settings(db, one, ['first_step', 'perfect_lesson'])).achievements, ['first_step', 'perfect_lesson']);
  // Outro aparelho envia uma lista menor: nada é removido.
  assert.deepEqual((await settings(db, one, ['scholar'])).achievements, ['first_step', 'perfect_lesson', 'scholar']);
  const prefs = { soundEnabled: false, hapticsEnabled: true, reduceMotion: true, dailyGoal: 20 };
  assert.deepEqual((await settings(db, one, null, prefs)).preferences, prefs);
  assert.deepEqual((await settings(db, one)).achievements, ['first_step', 'perfect_lesson', 'scholar']);
  assert.deepEqual(await settings(db, two), { achievements: [], preferences: null });
  await assert.rejects(settings(db, one, ['invented']), /settings_invalid/);
  await assert.rejects(settings(db, one, ['unit_x']), /settings_invalid/);
  // Conquistas novas do app (metas numéricas e jornada completa) são aceitas sem lista fixa.
  assert.ok((await settings(db, one, ['unit_10', 'streak_100', 'xp_10000', 'lessons_25', 'course_complete'])).achievements.includes('course_complete'));
  await assert.rejects(settings(db, one, null, { ...prefs, dailyGoal: 15 }), /settings_invalid/);
  await assert.rejects(settings(db, one, null, { ...prefs, extra: 1 }), /settings_invalid/);
  await assert.rejects(settings(db, null), /permission denied|auth_required/);
  await assert.rejects(db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.query('select * from public.user_settings'); }), /permission denied/);
  await db.query('delete from auth.users where id=$1', [one]);
  assert.equal((await db.query('select * from public.user_settings where user_id=$1', [one])).rows.length, 0);
});
