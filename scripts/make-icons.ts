// Generates the PWA/home-screen icons from a single inline SVG: a plate-black square with a
// diagonal amber road stripe and a dashed white centre line. Run via `make icons`.
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const PLATE_BLACK = '#141414';
const ROAD_AMBER = '#F5A623';

// size-agnostic: sharp rasterises this at whatever pixel size is requested below.
function iconSvg(size: number, corner: number): string {
  const n = (v: number): string => String(v);
  const stripeWidth = n(size * 0.34);
  const dash = n(size * 0.045);
  const gap = n(size * 0.045);
  const overhang = n(-size * 0.15);
  const far = n(size * 1.15);
  const centreWidth = n(size * 0.02);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${n(size)}" height="${n(size)}" viewBox="0 0 ${n(size)} ${n(size)}">
  <rect x="0" y="0" width="${n(size)}" height="${n(size)}" rx="${n(corner)}" ry="${n(corner)}" fill="${PLATE_BLACK}" />
  <g stroke-linecap="round">
    <line x1="${overhang}" y1="${far}" x2="${far}" y2="${overhang}"
      stroke="${ROAD_AMBER}" stroke-width="${stripeWidth}" />
    <line x1="${overhang}" y1="${far}" x2="${far}" y2="${overhang}"
      stroke="#ffffff" stroke-width="${centreWidth}" stroke-dasharray="${dash} ${gap}" />
  </g>
</svg>`;
}

interface Target {
  file: string;
  size: number;
  corner: number;
}

const TARGETS: Target[] = [
  { file: 'public/icons/512.png', size: 512, corner: 96 },
  { file: 'public/icons/192.png', size: 192, corner: 36 },
  // Maskable icons must keep all meaningful content inside the safe-zone circle (radius 40% of
  // the canvas); a plain square with no corner rounding lets the OS apply its own mask shape.
  { file: 'public/icons/maskable-512.png', size: 512, corner: 0 },
  { file: 'public/apple-touch-icon.png', size: 180, corner: 34 },
];

async function main(): Promise<void> {
  mkdirSync('public/icons', { recursive: true });
  for (const target of TARGETS) {
    const svg = Buffer.from(iconSvg(target.size, target.corner));
    const png = await sharp(svg).resize(target.size, target.size).png().toBuffer();
    writeFileSync(target.file, png);
    console.log(`wrote ${target.file} (${String(png.length)} bytes)`);
  }
}

await main();
