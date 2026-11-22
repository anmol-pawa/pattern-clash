// Deterministic icon generator: one original neon-geometric emblem (hex tower
// framing a pair of code chevrons), rasterised to every size the PWA needs.
// Run with `npm run icons`; outputs are committed so builds stay offline.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const BG = "#0b1020";
const CYAN = "#3ef0ff";
const MAGENTA = "#ff4fd8";
const LIME = "#b6ff3e";

/** @param {{ padded: boolean }} opts padded=true keeps the art inside the maskable safe zone. */
export function emblemSvg({ padded }) {
  const scale = padded ? 0.72 : 0.9;
  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`;
  const hex = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${(256 + 200 * Math.cos(a)).toFixed(1)},${(256 + 200 * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${padded ? 0 : 96}" fill="${BG}"/>
  <g transform="${t}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="${hex}" stroke="${CYAN}" stroke-width="28"/>
    <polyline points="210,170 130,256 210,342" stroke="${MAGENTA}" stroke-width="34"/>
    <polyline points="302,170 382,256 302,342" stroke="${MAGENTA}" stroke-width="34"/>
    <polygon points="256,206 300,256 256,306 212,256" fill="${LIME}" stroke="${LIME}" stroke-width="8"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir("public/icons", { recursive: true });
  await mkdir("app", { recursive: true });
  const plain = Buffer.from(emblemSvg({ padded: false }));
  const mask = Buffer.from(emblemSvg({ padded: true }));
  await writeFile("app/icon.svg", plain);
  await sharp(plain).resize(180, 180).png().toFile("app/apple-icon.png");
  for (const size of [192, 512]) {
    await sharp(plain).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
    await sharp(mask).resize(size, size).png().toFile(`public/icons/maskable-${size}.png`);
  }
}

await main();
