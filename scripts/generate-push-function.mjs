import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const entry = await readFile(new URL('supabase/functions/dispatch-push/index.ts', root), 'utf8');
const handler = await readFile(new URL('supabase/functions/dispatch-push/handler.ts', root), 'utf8');
const marker = "import { createPushDispatcher } from './handler.ts';";
if (entry.split(marker).length !== 2) throw new Error('Unexpected push entrypoint');
await writeFile(new URL('artifacts/dispatch-push.function.ts', root), entry.replace(marker, () => handler));
console.log('Standalone dispatcher generated. No deployment, secrets or notifications were sent.');
