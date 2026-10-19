import { readFile, writeFile } from 'node:fs/promises';
// Junta play-billing num arquivo só para colar no editor de Edge Functions do Supabase.
const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');
const entry = await read('../supabase/functions/play-billing/index.ts');
const handler = await read('../supabase/functions/play-billing/handler.ts');
const config = await read('../src/config/membership.ts');
const subscription = (await read('../src/lib/playSubscription.ts')).replace("import { MEMBERSHIP_CONFIG as config } from '../config/membership.ts';", '')
  // O handler também declara "record"; renomeia só nesta parte para não repetir o nome.
  .replace('const record =', 'const isPlayRecord =')
  .replaceAll('record(', 'isPlayRecord(');
const pieces = {
  "import { MEMBERSHIP_CONFIG as config } from '../../../src/config/membership.ts';": `${config}\nconst config = MEMBERSHIP_CONFIG;`,
  "import { verifiedPlaySubscription } from '../../../src/lib/playSubscription.ts';": subscription,
  "import { createBillingHandler } from './handler.ts';": handler,
};
let combined = entry;
for (const [line, code] of Object.entries(pieces)) {
  if (!combined.includes(line)) throw new Error(`Import not found: ${line}`);
  combined = combined.replace(line, () => code);
}
if (/from '\.\.?\//.test(combined)) throw new Error('A relative import is still present.');
await writeFile(new URL('../artifacts/membership/play-billing.function.ts', import.meta.url), combined);
console.log('Standalone play-billing function prepared. No remote changes were made.');
