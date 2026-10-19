import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import jpeg from 'npm:jpeg-js@0.4.4';
import { createPhotoUploadHandler } from './handler.ts';
import { sanitizeProfileJPEG } from './raster.ts';

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
