// Em3Task uygulama ikonlarını tek kaynaktan (public/icons/logo.svg) üretir.
// Çalıştırma: node scripts/generate-icons.mjs
//
// Üretilenler:
//   public/icons/icon-192.png, icon-512.png   → normal (köşeleri yuvarlak, şeffaf)
//   public/icons/maskable-512.png             → Android "maskable": zemin tam dolu,
//                                               işaret güvenli alanın içinde (telefon
//                                               kendi şekliyle kırpar)
//   app/apple-icon.png (180)                  → iPhone ana ekran (iOS köşeleri kendisi yuvarlar)
//   app/icon.svg                              → tarayıcı sekmesi ikonu
//   public/icons/logo-compact.svg             → uygulama içindeki küçük logo
//   (son ikisinde işaret daha büyük: 16–28 px'te de okunsun)

import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "public/icons/logo.svg";
const logo = await readFile(SOURCE, "utf8");
const BASE_SCALE = "scale(1.15)";
if (!logo.includes(BASE_SCALE)) throw new Error(`${SOURCE} içinde "${BASE_SCALE}" bulunamadı`);

// İşaretin boyutunu değiştirir
const withScale = (svg, scale) => svg.replace(BASE_SCALE, `scale(${scale})`);

// Zemini tam kare yapar, kenar çizgisini kaldırır (maskable / iOS için)
const fullBleed = (svg, scale) =>
  withScale(svg, scale)
    .replace('rx="116"', 'rx="0"')
    .replace(/\s*<rect class="edge"[^>]*\/>/, "");

async function png(svg, size, out) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("✓", out);
}

await png(logo, 192, "public/icons/icon-192.png");
await png(logo, 512, "public/icons/icon-512.png");
// Maskable güvenli alan: merkezdeki %80'lik daire → işaret küçültülür
await png(fullBleed(logo, 1.0), 512, "public/icons/maskable-512.png");
await png(fullBleed(logo, 1.2), 180, "app/apple-icon.png");

const compact = withScale(logo, 1.38);
await writeFile("app/icon.svg", compact);
await writeFile("public/icons/logo-compact.svg", compact);
console.log("✓ app/icon.svg, public/icons/logo-compact.svg");
