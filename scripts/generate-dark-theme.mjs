// Em3Task karanlık tema renklerini Tailwind'in kendi paletinden üretir.
// Çalıştırma: node scripts/generate-dark-theme.mjs  →  app/theme-dark.css
//
// Yaklaşım: uygulama renk sınıflarını (bg-white, text-slate-900, bg-teal-50 …)
// doğrudan kullanır; Tailwind bunları CSS değişkenleriyle çizer. Koyu temada bu
// değişkenler yeniden tanımlanır:
//   - renkli tonlar ters çevrilir (50↔950, 100↔900 … 400↔600, 500 aynı):
//     açık zemin tonları koyu, koyu yazı tonları açık olur
//   - gri (slate) ve beyaz koyu temaya özel ayarlanır (kart zeminden açık, kenarlık belirgin)
//   - .theme-fixed: zaten koyu olan alanlar (sidebar, üst/alt çubuk, koyu menü, kod
//     bloğu) her iki temada da orijinal renkleri kullanır
//   - .theme-follow: sabit alan içinde açılıp temaya uyması gereken parçalar (zil paneli)

import { readFileSync, writeFileSync } from "node:fs";

const theme = readFileSync("node_modules/tailwindcss/theme.css", "utf8");
const vars = {};
for (const m of theme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
  (vars[m[1]] ??= {})[m[2]] = m[3].trim();
}

const STEPS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
// Uygulamada (ve etiket paletinde) kullanılan renk aileleri. neutral sadece her
// zaman koyu alanlarda kullanıldığı için dokunulmaz. Yeni bir renk ailesi
// kullanılırsa buraya eklenip betik yeniden çalıştırılmalı.
const HUES = ["red", "orange", "amber", "yellow", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "pink", "rose"].filter((h) => vars[h]);

// Koyu temada gri ve yüzey değerleri
const SLATE_DARK = {
  50: "oklch(27.9% 0.041 260.031)", // ~slate-800: kart içi hafif zemin, üzerine gelme
  100: "oklch(31.5% 0.042 259)", // biraz daha açık
  200: "oklch(37.2% 0.044 257.287)", // ~slate-700: kenarlıklar
  300: "oklch(44.6% 0.043 257.281)", // ~slate-600
  400: "oklch(55.4% 0.046 257.417)", // ~slate-500: örnek metin, ikon
  500: "oklch(70.4% 0.04 256.788)", // ~slate-400: ikincil yazı
  600: "oklch(86.9% 0.022 252.894)", // ~slate-300
  700: "oklch(92.9% 0.013 255.508)", // ~slate-200
  800: "oklch(96.8% 0.007 247.896)", // ~slate-100
  900: "oklch(98.4% 0.003 247.858)", // ~slate-50: ana yazı
  950: "oklch(100% 0 0)",
};
const SURFACE_DARK = "oklch(20.8% 0.042 265.755)"; // ~slate-900: kartlar (bg-white)
const CANVAS_DARK = "oklch(16.5% 0.035 266)"; // sayfa zemini

function invertedBlock() {
  const lines = [`  --color-white: ${SURFACE_DARK};`, `  --app-canvas: ${CANVAS_DARK};`];
  for (const s of STEPS) lines.push(`  --color-slate-${s}: ${SLATE_DARK[s]};`);
  for (const h of HUES) {
    STEPS.forEach((s, i) => {
      const from = STEPS[STEPS.length - 1 - i];
      if (vars[h][from]) lines.push(`  --color-${h}-${s}: ${vars[h][from]};`);
    });
  }
  return lines.join("\n");
}

function originalBlock() {
  const lines = ["  --color-white: #fff;", "  --app-canvas: #f4f6f8;"];
  for (const h of ["slate", ...HUES]) for (const s of STEPS) if (vars[h][s]) lines.push(`  --color-${h}-${s}: ${vars[h][s]};`);
  return lines.join("\n");
}

const css = `/* Bu dosya scripts/generate-dark-theme.mjs ile üretilir; elle düzenlemeyin. */

:root {
  --app-canvas: #f4f6f8;
}

html.dark {
  color-scheme: dark;
${invertedBlock()}
}

/* Her iki temada da koyu kalan alanlar: orijinal renkler */
html.dark .theme-fixed {
  color-scheme: dark;
${originalBlock()}
}

/* Sabit koyu alanın içinde açılıp temaya uyması gereken parçalar */
html.dark .theme-fixed .theme-follow {
${invertedBlock()}
}
`;
writeFileSync("app/theme-dark.css", css);
console.log(`app/theme-dark.css yazıldı (${HUES.length} renk ailesi + slate)`);
