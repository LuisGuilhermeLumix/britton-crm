// Builds public/favicon.png from public/logo-lumix.png.
//
// The logo is wide (roughly 2:1); a browser squeezes a non-square icon into
// the tab's square slot, which is why it looked stretched. This pads it onto
// a transparent square instead. The output is a committed static asset — run
// `npm run favicon` whenever the logo changes; it is not part of the build.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const SIZE = 64;          // canvas, px
const FILL = 0.85;        // logo may occupy at most this fraction of the canvas

const src = fileURLToPath(new URL('../public/logo-lumix.png', import.meta.url));
const out = fileURLToPath(new URL('../public/favicon.png', import.meta.url));
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const inner = Math.round(SIZE * FILL);

// fit: 'contain' keeps the aspect ratio and pads the shorter side with the
// transparent background, so this buffer is exactly inner × inner.
const logo = await sharp(src)
  .resize(inner, inner, { fit: 'contain', background: transparent })
  .png()
  .toBuffer();

await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: transparent } })
  .composite([{ input: logo, gravity: 'centre' }])
  .png()
  .toFile(out);

const meta = await sharp(out).metadata();
console.log(`wrote ${out} — ${meta.width}×${meta.height}, ${meta.channels} channels, alpha: ${meta.hasAlpha}`);
