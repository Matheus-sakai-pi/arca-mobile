import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import jpeg from 'npm:jpeg-js@0.4.4';
export const PHOTO_LIMITS = Object.freeze({ bytes: 393216, dimension: 512, bodyBytes: 530000 });
export type PhotoUploadDependencies = {
  authenticate: (token: string) => Promise<string | null>;
  hash: (bytes: Uint8Array) => Promise<string>;
  ingest: (owner: string, id: string, hash: string, stage: 'reserve' | 'finish' | 'abort') => Promise<string>;
  sanitize: (bytes: Uint8Array) => Promise<Uint8Array>;
  upload: (path: string, bytes: Uint8Array) => Promise<boolean>;
  remove: (path: string) => Promise<void>;
};
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
async function limitedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('photo_invalid');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > PHOTO_LIMITS.bodyBytes) { await reader.cancel(); throw new Error('photo_size'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  return new TextDecoder().decode(bytes);
}
export function createPhotoUploadHandler(deps: PhotoUploadDependencies) {
  return async (request: Request): Promise<Response> => {
    const reply = (status: number, body: object) => Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    const token = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!token) return reply(401, { error: 'auth_required' });
    if (!request.headers.get('Content-Type')?.includes('application/json')) return reply(415, { error: 'photo_invalid' });
    if (Number(request.headers.get('Content-Length')) > PHOTO_LIMITS.bodyBytes) return reply(413, { error: 'photo_size' });
    let reserved: { owner: string; id: string; hash: string } | null = null;
    let attempted = false;
    try {
      const owner = await deps.authenticate(token);
      if (!owner) return reply(401, { error: 'auth_required' });
      const input = JSON.parse(await limitedBody(request));
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['id', 'image', 'consent'].includes(key)) ||
        typeof input.id !== 'string' || !uuid.test(input.id) || input.consent !== 1 || typeof input.image !== 'string' ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(input.image) || input.image.length % 4 !== 0) throw new Error('photo_invalid');
      const raw = Uint8Array.from(atob(input.image), c => c.charCodeAt(0));
      if (raw.length > PHOTO_LIMITS.bytes) throw new Error('photo_size');
      if (raw.length < 4 || raw[0] !== 255 || raw[1] !== 216 || raw[2] !== 255) throw new Error('photo_invalid');
      const hash = await deps.hash(raw);
      const state = await deps.ingest(owner, input.id, hash, 'reserve');
      if (['pending', 'approved'].includes(state)) return reply(200, { owner, id: input.id, state });
      if (state === 'busy') throw new Error('photo_pending');
      if (state !== 'uploading') throw new Error('photo_conflict');
      reserved = { owner, id: input.id, hash };
      const safe = await deps.sanitize(raw);
      if (safe.length > PHOTO_LIMITS.bytes) throw new Error('photo_size');
      attempted = true;
      if (!await deps.upload(`${owner}/${input.id}.jpg`, safe)) throw new Error('photo_upload_failed');
      const next = await deps.ingest(owner, input.id, hash, 'finish');
      if (next !== 'pending') throw new Error('photo_conflict');
      return reply(200, { owner, id: input.id, state: next });
    } catch (error) {
      if (reserved) {
        // A lost response must not delete a successfully finalized photo.
        const state = await deps.ingest(reserved.owner, reserved.id, reserved.hash, 'abort').catch(() => null);
        if (attempted && state !== 'pending' && state !== 'approved') await deps.remove(`${reserved.owner}/${reserved.id}.jpg`).catch(() => undefined);
      }
      const code = error instanceof Error ? error.message : '';
      const exposed = ['vip_required','photo_restricted','photo_pending','photo_limit','photo_conflict','photo_invalid','photo_size'].find(value => code === value);
      return reply(exposed === 'photo_limit' ? 429 : exposed ? 400 : 503, { error: exposed ?? 'photo_upload_failed' });
    }
  };
}


type Pixels = { width: number; height: number; data: Uint8Array };
type Codec = {
  decode: (bytes: Uint8Array, options: { useTArray: true; maxResolutionInMP: number; maxMemoryUsageInMB: number; tolerantDecoding: false }) => Pixels;
  encode: (pixels: Pixels, quality: number) => { data: Uint8Array };
};
export function sanitizeProfileJPEG(bytes: Uint8Array, codec: Codec): Uint8Array {
  try {
    const decoded = codec.decode(bytes, { useTArray: true, maxResolutionInMP: 1, maxMemoryUsageInMB: 32, tolerantDecoding: false });
    if (decoded.width !== decoded.height || decoded.width < 32 || decoded.width > PHOTO_LIMITS.dimension) throw new Error();
    // Only fresh pixels are encoded: no EXIF, comments or trailing payloads survive.
    const result = new Uint8Array(codec.encode({ width: decoded.width, height: decoded.height, data: decoded.data }, 80).data);
    if (result.length > PHOTO_LIMITS.bytes) throw new Error();
    return result;
  } catch { throw new Error('photo_invalid'); }
}


const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = admin.storage.from('profile-photos');
Deno.serve(createPhotoUploadHandler({
  authenticate: async token => {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  hash: async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer))].map(n => n.toString(16).padStart(2, '0')).join(''),
  ingest: async (owner, id, hash, stage) => {
    const { data, error } = await admin.rpc('profile_photo_ingest', { p_user: owner, p_id: id, p_hash: hash, p_stage: stage });
    if (error) throw new Error(error.message);
    return data;
  },
  sanitize: async bytes => sanitizeProfileJPEG(bytes, jpeg),
  upload: async (path, bytes) => {
    const { error } = await bucket.upload(path, bytes, { contentType: 'image/jpeg', cacheControl: '0', upsert: false });
    return !error;
  },
  remove: async path => { const { error } = await bucket.remove([path]); if (error) throw error; },
}));
