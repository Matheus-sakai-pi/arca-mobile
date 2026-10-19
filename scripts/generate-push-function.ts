import { readFile, writeFile } from 'node:fs/promises';
// Junta dispatch-push num arquivo só para colar no editor de Edge Functions do Supabase.
const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');
const entry = await read('../supabase/functions/dispatch-push/index.ts');
const handler = await read('../supabase/functions/dispatch-push/handler.ts');
const line = "import { createPushDispatcher } from './handler.ts';";
if (!entry.includes(line)) throw new Error(`Import not found: ${line}`);
const combined = entry.replace(line, () => handler);
if (/from '\.\.?\//.test(combined)) throw new Error('A relative import is still present.');
await writeFile(new URL('../artifacts/push/dispatch-push.function.ts', import.meta.url), combined);
console.log('Standalone dispatch-push function prepared. No remote changes were made.');
