type Identity = { id: string; email: string | undefined };
export type DeletionDependencies = {
  authenticate: (token: string) => Promise<Identity | null>;
  verifyPassword: (email: string, password: string) => Promise<{ id: string | null; limited: boolean }>;
  deleteUser: (id: string) => Promise<boolean>;
};
const defaultCors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export function createDeletionHandler(deps: DeletionDependencies, cors: Readonly<Record<string, string>> = defaultCors) {
  return async (request: Request): Promise<Response> => {
    const reply = (status: number, body: object) => Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    const token = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!token) return reply(401, { error: 'auth_required' });
    if (!request.headers.get('Content-Type')?.includes('application/json')) return reply(415, { error: 'body_invalid' });
    if (Number(request.headers.get('Content-Length')) > 2048) return reply(413, { error: 'body_invalid' });
    try {
      const body = await request.text();
      if (body.length > 2048) return reply(413, { error: 'body_invalid' });
      let input: unknown;
      try { input = JSON.parse(body); } catch { return reply(400, { error: 'body_invalid' }); }
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || !('password' in input) || typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 128) return reply(400, { error: 'body_invalid' });
      // Identity always comes from Supabase Auth, never a body userId/email.
      const user = await deps.authenticate(token);
      if (!user?.email) return reply(401, { error: 'auth_required' });
      const check = await deps.verifyPassword(user.email, input.password);
      if (check.limited) return reply(429, { error: 'rate_limited' });
      if (check.id !== user.id) return reply(403, { error: 'invalid_credentials' });
      if (!await deps.deleteUser(user.id)) return reply(503, { error: 'deletion_failed' });
      return reply(200, { deleted: true, userId: user.id });
    } catch { return reply(503, { error: 'deletion_failed' }); }
  };
}
