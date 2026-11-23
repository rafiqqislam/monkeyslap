// Renders assets/icon.svg to the PNG sizes Chrome needs. Run after changing the icon.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const svg = await readFile(new URL("../assets/icon.svg", import.meta.url));
for (const size of [16, 32, 48, 128]) {
  const out = new URL(`../public/icons/icon-${size}.png`, import.meta.url);
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(fileURLToPath(out));
  console.log(`icons/icon-${size}.png`);
}
