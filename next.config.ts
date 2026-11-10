import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kendi sunucumuzdaki Docker imajı için tek klasörlük çıktı (Dockerfile açar).
  // Yerelde değişken tanımlı olmadığından "next build" / "next start" olağan çalışır.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  experimental: {
    agentFeedback: true,
    // Görev ekleri en fazla 10 MB; çok parçalı form ek yükü için pay bırakıldı
    serverActions: {
      bodySizeLimit: "11mb",
    },
    proxyClientMaxBodySize: "11mb",
    // Ziyaret edilen sayfalar tarayıcıda 30 sn saklanır: geri dönüşler anında açılır.
    // Veri eskimez: canlı güncelleme (router.refresh) ve kendi işlemlerimiz
    // (revalidatePath) bu önbelleği temizler.
    staleTimes: {
      dynamic: 30,
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Güvenlik başlıkları (Next.js PWA rehberindeki öneriler)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Service worker her zaman güncel gelsin (önbelleğe alınmasın)
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
