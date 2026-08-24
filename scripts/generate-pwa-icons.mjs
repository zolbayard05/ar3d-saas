// Source of truth for the PWA icon mark — an AR viewfinder scan-frame,
// white on --color-bg (styles/themes.css: oklch(0.115 0 0) = #050505,
// same conversion lib/renderThumbnail.ts's BACKDROP_HEX already used).
// Re-run this if the mark or background color ever changes:
//
//   node scripts/generate-pwa-icons.mjs
//
// Outputs full-bleed squares (no pre-rounded corners) — iOS/Android apply
// their own icon mask, and baking in a corner radius here would double up
// with (or fight against) that.
import sharp from "sharp";
import { writeFileSync } from "fs";
import { join } from "path";

const BG = "#050505";
const FG = "#ffffff";

// All proportions relative to a 512 design grid, scaled per target size so
// each render is generated crisp at its own resolution rather than
// downscaled from one raster.
const GRID = 512;
const INSET = 140 / GRID;
const ARM = 76 / GRID;
const STROKE = 28 / GRID;

function scanFrameSvg(size) {
  const inset = INSET * size;
  const arm = ARM * size;
  const stroke = STROKE * size;
  const x0 = inset;
  const y0 = inset;
  const x1 = size - inset;
  const y1 = size - inset;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${BG}"/>
    <g fill="none" stroke="${FG}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M${x0} ${y0 + arm} V${y0} H${x0 + arm}"/>
      <path d="M${x1 - arm} ${y0} H${x1} V${y0 + arm}"/>
      <path d="M${x0} ${y1 - arm} V${y1} H${x0 + arm}"/>
      <path d="M${x1 - arm} ${y1} H${x1} V${y1 - arm}"/>
    </g>
  </svg>`;
}

const targets = [
  { size: 192, out: join("public", "icon-192.png") },
  { size: 512, out: join("public", "icon-512.png") },
  { size: 180, out: join("app", "apple-icon.png") },
];

for (const { size, out } of targets) {
  const buf = await sharp(Buffer.from(scanFrameSvg(size))).png().toBuffer();
  writeFileSync(out, buf);
  console.log(`wrote ${out} (${size}x${size})`);
}
