export function safeSystemPath(path: string): string {
  if (typeof path !== 'string' || path.length > 4096) return '/';
  // Reject malformed UTF-8 before the router's permissive query decoder runs.
  try { decodeURIComponent(path); return path; } catch { return '/'; }
}
