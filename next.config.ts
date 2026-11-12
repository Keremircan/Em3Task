import type { NextConfig } from "next";

// İçerik güvenlik politikası (CSP): sayfanın nereden kod, resim ve veri alabileceğini
// tarayıcıya bildirir. Dışarıdan betik yüklenmesini, sayfanın başka sitede çerçeve içinde
// gösterilmesini ve verinin Supabase dışında bir adrese gönderilmesini engeller.
// Satır içi betiklere ('unsafe-inline') izin vermek zorundayız: Next.js sayfa verisini
// satır içi betikle taşır ve tek kullanımlık anahtar (nonce) yöntemi her sayfayı
// istek anında üretmeyi gerektirir; bu da hazır kabuk (PPR) hızını kaybettirir.
// Değer derleme anında hesaplanır; NEXT_PUBLIC_SUPABASE_URL o sırada tanımlı olmalıdır.
const isDev = process.env.NODE_ENV === "development";

function supabaseSources(): { http: string; ws: string } {
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
    return { http: origin, ws: origin.replace(/^http/, "ws") };
  } catch {
    // Adres bilinmiyorsa uygulama kilitlenmesin: tüm Supabase projelerine izin ver
    return { http: "https://*.supabase.co", ws: "wss://*.supabase.co" };
  }
}

const supabase = supabaseSources();

const contentSecurityPolicy = [
  "default-src 'self'",
  // Geliştirmede React hata ayıklama için eval kullanır
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Profil fotoğrafları ve görev ekleri Supabase deposundan gelir
  `img-src 'self' data: blob: ${supabase.http}`,
  "font-src 'self' data:",
  // Veri istekleri ve canlı güncelleme (WebSocket) sadece kendi sunucumuza ve Supabase'e
  `connect-src 'self' ${supabase.http} ${supabase.ws}${isDev ? " ws: http://localhost:*" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

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
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
