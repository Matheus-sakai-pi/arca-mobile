import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export async function createTestDatabase(beforeMigration?: (name: string, db: PGlite) => Promise<void>, options: { energyEnabled?: boolean; through?: string } = {}) {
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (
        id uuid primary key, raw_user_meta_data jsonb,
        email text, email_confirmed_at timestamptz
      );
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema public, auth to anon, authenticated;
    `);
    const folder = new URL('../../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(folder)).filter(name => name.endsWith('.sql') && (!options.through || name <= options.through)).sort()) {
      await beforeMigration?.(file, db);
      await db.exec(await readFile(new URL(file, folder), 'utf8'));
    }
    // Non-energy suites isolate their domain from lesson authorization gates.
    if (!options.energyEnabled) await db.exec('update public.learning_energy_config set enabled=false');
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

export async function createTestUser(db: PGlite, id: string, username: string) {
  await db.query('insert into auth.users values ($1, $2, $3, now())', [
    id, JSON.stringify({ username, display_name: `@${username}` }), `${username}@example.test`,
  ]);
}

export async function databaseRpc<T = unknown>(db: PGlite, owner: string | null, name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!/^[a-z_]+$/.test(name) || Object.keys(args).some(key => !/^p_[a-z_]+$/.test(key))) {
    throw new Error('Invalid test RPC identifier');
  }
  return db.transaction(async tx => {
    await tx.exec(`set local role ${owner ? 'authenticated' : 'anon'}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [owner ?? '']);
    const entries = Object.entries(args);
    const parameters = entries.map(([key], index) => `${key} => $${index + 1}`).join(', ');
    const values = entries.map(([key, value]) => key === 'p_answer' || typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
    const result = await tx.query<{ value: T }>(`select public.${name}(${parameters}) as value`, values);
    return result.rows[0]!.value;
  });
}
