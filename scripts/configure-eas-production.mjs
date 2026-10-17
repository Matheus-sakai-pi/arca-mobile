import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';

export function publicBuildValues(env) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error('Missing public Supabase build configuration');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) throw new Error('Expected the existing hosted HTTPS Supabase project');
  if (!key.startsWith('sb_publishable_')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()); }
    catch { throw new Error('Expected a public anon or publishable key'); }
    if (payload.role !== 'anon' || payload.ref !== parsed.hostname.split('.')[0]) throw new Error('Private keys or keys from another project must never enter the app');
  }
  // Do not copy local web / Expo Go redirects or any other local environment values.
  return { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: key, EXPO_PUBLIC_AUTH_REDIRECT_URL: 'arca://auth/callback' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
  const expectedId = process.argv[process.argv.indexOf('--project') + 1];
  if (!process.argv.includes('--project') || !expectedId || app.extra?.eas?.projectId !== expectedId) throw new Error('Confirm the linked EAS project ID before uploading public configuration');
  const values = publicBuildValues(parseEnv(readFileSync('.env', 'utf8')));
  if (!process.argv.includes('--apply')) {
    console.log('Public variables validated for linked project:', expectedId, Object.keys(values));
  } else {
    const npx = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
    if (!existsSync(npx)) throw new Error('Cannot locate the installed npm/npx runtime');
    for (const [name, value] of Object.entries(values)) {
      const result = spawnSync(process.execPath, [npx, '--yes', 'eas-cli@latest', 'env:set', 'production', '--scope', 'project', '--name', name, '--value', value, '--type', 'string', '--visibility', 'sensitive', '--non-interactive'], { encoding: 'utf8' });
      const output = ((result.stdout ?? '') + (result.stderr ?? '')).split(value).join('[public value hidden]');
      console.log(output.trim());
      if (result.error || result.status !== 0) throw new Error('Failed to configure ' + name);
    }
  }
}
