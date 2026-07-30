// Generates simple solid PNG icons with an "eye" glyph so the extension has real
// icon assets without pulling in an image dependency. Run: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makePng(size) {
  const bg = [37, 99, 235]; // brand blue
  const fg = [255, 255, 255];
  const cx = size / 2, cy = size / 2;
  const rEye = size * 0.34, rPupil = size * 0.13;

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filter byte + RGBA
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      // eye almond: inside ellipse ring but not too flat
      const inEye = d < rEye && Math.abs(dy) < rEye * 0.62;
      const inPupil = d < rPupil;
      const [r, g, b] = inPupil ? bg : inEye ? fg : bg;
      const o = 1 + x * 4;
      row[o] = r; row[o + 1] = g; row[o + 2] = b; row[o + 3] = 255;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  writeFileSync(join(outDir, `icon-${size}.png`), makePng(size));
  console.log(`wrote icon-${size}.png`);
}
