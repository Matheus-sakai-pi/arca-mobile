export type AuthCallback = { accessToken: string; refreshToken: string; recovery: boolean };
export function parseAuthCallback(url: string): AuthCallback {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash ? parsed.hash.slice(1) : parsed.search);
  if (params.get('error') || params.get('error_code')) throw new Error('auth_link_invalid');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) throw new Error('auth_link_invalid');
  return { accessToken, refreshToken, recovery: params.get('type') === 'recovery' };
}
