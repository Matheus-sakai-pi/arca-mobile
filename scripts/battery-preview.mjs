import { createServer } from 'node:http';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { createTestDatabase, databaseRpc } from '../tests/helpers/database.ts';

// Loopback-only, disposable SQL database. Never forwards requests to production.
const webPort = 8089, apiPort = 8092;
const webOrigin = `http://localhost:${webPort}`;
const db = await createTestDatabase(undefined, { energyEnabled: true });
const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && ![webOrigin, `http://127.0.0.1:${webPort}`].includes(origin)) { response.writeHead(403); response.end(); return; }
  response.setHeader('Access-Control-Allow-Origin', origin ?? webOrigin);
  response.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,content-profile,accept-profile,prefer,x-client-info,x-supabase-api-version');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Content-Type', 'application/json');
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  if (request.url === '/health') { response.end(JSON.stringify({ preview: true, production: false })); return; }
  if (request.method !== 'POST' || request.url !== '/rest/v1/rpc/learning_battery') {
    response.writeHead(400); response.end(JSON.stringify({ message: 'Esta prévia usa apenas o modo visitante e dados locais de teste.' })); return;
  }
  try {
    let length = 0; const parts = [];
    for await (const chunk of request) { length += chunk.length; if (length > 65536) throw new Error('request_too_large'); parts.push(chunk); }
    const body = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('request_invalid');
    const result = await databaseRpc(db, null, 'learning_battery', body);
    response.end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(400); response.end(JSON.stringify({ code: error.code ?? 'PREVIEW_ERROR', message: error.message }));
  }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(apiPort, '127.0.0.1', resolve); });
console.log(`Disposable battery test API: http://127.0.0.1:${apiPort}`);
const expo = spawn(process.execPath, ['node_modules/expo/bin/cli', 'start', '--web', '--host', 'localhost', '--port', `${webPort}`], {
  cwd: new URL('..', import.meta.url), stdio: 'inherit',
  env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${apiPort}`, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'local-disposable-preview-not-a-production-key', EXPO_PUBLIC_AUTH_REDIRECT_URL: `${webOrigin}/auth/callback` },
});
console.log(`Battery preview (guest/test data only): ${webOrigin}/onboarding`);
const stop = () => { expo.kill(); server.close(); void db.close(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
expo.on('exit', () => { server.close(); void db.close(); });
