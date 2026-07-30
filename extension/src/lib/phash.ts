/**
 * 64-bit average-hash (aHash) perceptual hash, computed on an ImageBitmap in the
 * offscreen document. Cheap and good enough to skip near-identical frames.
 */
export async function perceptualHash(bitmap: ImageBitmap): Promise<string> {
  const N = 8;
  const canvas = new OffscreenCanvas(N, N);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, N, N);
  const { data } = ctx.getImageData(0, 0, N, N);

  const gray: number[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray.push(g);
    sum += g;
  }
  const avg = sum / gray.length;

  let bits = '';
  for (const g of gray) bits += g >= avg ? '1' : '0';

  // pack 64 bits into 16 hex chars
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Hamming distance between two 16-char hex hashes. Returns 64 on mismatched input. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  let dist = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}
