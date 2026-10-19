import { readFile, writeFile } from 'node:fs/promises';
const base = new URL('../supabase/functions/profile-photo/', import.meta.url);
const entry = await readFile(new URL('index.ts', base), 'utf8');
const handler = await readFile(new URL('handler.ts', base), 'utf8');
const raster = (await readFile(new URL('raster.ts', base), 'utf8')).replace("import { PHOTO_LIMITS } from './handler.ts';", '');
const combined = entry.replace("import { createPhotoUploadHandler } from './handler.ts';", () => handler)
  .replace("import { sanitizeProfileJPEG } from './raster.ts';", () => raster);
await writeFile(new URL('../artifacts/membership/profile-photo.function.ts', import.meta.url), combined);
console.log('Standalone photo function prepared. No photos were uploaded and no remote changes were made.');
