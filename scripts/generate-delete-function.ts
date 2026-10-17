import { readFile, writeFile } from 'node:fs/promises';

const entry = await readFile(new URL('../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8');
const handler = await readFile(new URL('../supabase/functions/delete-account/handler.ts', import.meta.url), 'utf8');
const combined = entry.replace("import { createDeletionHandler } from './handler.ts';", () => handler);
await writeFile(new URL('../artifacts/delete-account.function.ts', import.meta.url), combined);
console.log('Standalone Supabase editor source generated. No remote deployment or account deletion was performed.');
