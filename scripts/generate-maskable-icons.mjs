/*
 * Gera variantes maskable (para "Adicionar ao ecrã principal" em Android)
 * e refaz o apple-touch-icon com fundo sólido (iOS não aceita transparência).
 *
 * Maskable = ícone com safe zone central (~80%) e fundo opaco.
 * Sem isto, Android desenha um círculo branco e o ícone (flores cream)
 * fica praticamente invisível.
 *
 * Correr: node scripts/generate-maskable-icons.mjs
 */

import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const dir = path.join(root, "public", "favicon");

const BG = "#3D2B1F"; // cocoa-900 — dá contraste com as flores cream em qualquer launcher

async function makeMaskable(size, outName) {
  const src = await sharp(path.join(dir, "android-chrome-512x512.png")).toBuffer();
  // safe zone: ícone ocupa 60% do canvas (Android pode cortar até 20% nos bordos)
  const inner = Math.round(size * 0.6);
  const resized = await sharp(src).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(path.join(dir, outName));
  console.log("✓", outName);
}

async function makeAppleTouch() {
  // iOS: fundo opaco; ícone ocupa ~75% do canvas (iOS aplica máscara arredondada)
  const src = await sharp(path.join(dir, "android-chrome-512x512.png")).toBuffer();
  const size = 180;
  const inner = Math.round(size * 0.75);
  const resized = await sharp(src).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(path.join(dir, "apple-touch-icon.png"));
  console.log("✓ apple-touch-icon.png (com fundo cocoa)");
}

await makeMaskable(512, "maskable-512x512.png");
await makeMaskable(192, "maskable-192x192.png");
await makeAppleTouch();

console.log("\nFeito. Bump CACHE_VERSION em public/sw.js para invalidar o cache antigo.");
