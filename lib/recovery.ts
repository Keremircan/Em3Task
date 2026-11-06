import "server-only";

// Şifre sıfırlama bağlantısıyla açılan oturumu tanır.
// E-postadaki bağlantı doğrulanınca Supabase oturuma giriş yöntemini ("otp" ya da
// "recovery") ve zamanını yazar. Yeni şifre sadece bu yolla, son 15 dakika içinde
// açılmış oturumlarda belirlenebilir: açık kalmış bir oturumu ele geçiren biri
// mevcut şifreyi bilmeden şifreyi değiştiremez (profildeki form mevcut şifreyi sorar).
const RECOVERY_METHODS = new Set(["otp", "recovery", "magiclink"]);
export const RECOVERY_WINDOW_SECONDS = 15 * 60;

type AmrEntry = { method?: unknown; timestamp?: unknown };

export function isRecentRecovery(claims: { amr?: unknown } | null | undefined): boolean {
  const amr = claims?.amr;
  if (!Array.isArray(amr)) return false;
  const now = Math.floor(Date.now() / 1000);
  return amr.some((entry: AmrEntry) => {
    return (
      typeof entry?.method === "string" &&
      RECOVERY_METHODS.has(entry.method) &&
      typeof entry.timestamp === "number" &&
      now - entry.timestamp <= RECOVERY_WINDOW_SECONDS
    );
  });
}

// Yönlendirilecek adres sadece site içi bir yol olabilir (açık yönlendirme olmasın)
export function safeNextPath(next: string | null, fallback = "/sifre-yenile"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
