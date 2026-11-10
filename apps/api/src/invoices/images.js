/**
 * Payment screenshots arrive as a data URL ("data:image/png;base64,...").
 * We check the real file contents (not just what the browser claims) and limit the size.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SIGNATURES = [
  {
    ext: 'png',
    type: 'image/png',
    test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  { ext: 'jpg', type: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: 'webp',
    type: 'image/webp',
    test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
];
export const typeForExt = (ext) => SIGNATURES.find((s) => s.ext === ext)?.type || 'application/octet-stream';

/**
 * @param {string} dataUrl
 * @returns {{ buffer: Buffer, ext: string } | { error: string }}
 */
export function decodeImage(dataUrl) {
  const m = /^data:[\w/+.-]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl || '');
  if (!m) return { error: 'Attach the screenshot as an image file.' };
  const buffer = Buffer.from(m[1], 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) return { error: 'The image is too large. Please use one under 5 MB.' };
  const kind = SIGNATURES.find((s) => s.test(buffer));
  if (!kind) return { error: 'Please attach a PNG, JPEG or WebP image.' };
  return { buffer, ext: kind.ext };
}
