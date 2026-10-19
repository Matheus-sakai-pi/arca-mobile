import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.117.2/cors';
import { createDeletionHandler } from './handler.ts';
import { clearProfilePhotos } from './photos.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serverKey, options);

Deno.serve(createDeletionHandler({
  authenticate: async token => {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id, email: data.user.email };
  },
  verifyPassword: async (email, password) => {
    // One isolated client per request: a password check must not replace another session.
    const verifier = createClient(url, publicKey, options);
    const { data, error } = await verifier.auth.signInWithPassword({ email, password });
    const id = !error ? data.user?.id ?? null : null;
    if (data.session) await verifier.auth.signOut({ scope: 'local' });
    return { id, limited: error?.status === 429 };
  },
  deleteUser: async id => {
    // Freeze new uploads before draining the private folder. A failed deletion is retryable.
    const photos = admin.storage.from('profile-photos');
    if (!await clearProfilePhotos(id, {
      freeze: async owner => !(await admin.rpc('profile_photo_prepare_delete', { p_user: owner })).error,
      list: async owner => { const { data, error } = await photos.list(owner, { limit: 100 }); return error ? null : (data ?? []).map(item => item.name); },
      remove: async paths => !(await photos.remove(paths)).error,
    })) return false;
    const { error } = await admin.auth.admin.deleteUser(id, false);
    return !error;
  },
}, { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }));
