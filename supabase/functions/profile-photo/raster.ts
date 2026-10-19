import { PHOTO_LIMITS } from './handler.ts';
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
