import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";

// Hata kayıtları (error_log tablosu, supabase/hata-kayitlari.sql). Sunucudaki hatalar
// yalnızca Docker günlüğüne düşüyor ve orada dönerek siliniyordu; burada kalıcı tutulur
// ve Admin "Hata kayıtları" sayfasından görür. Yazma service role ile yapılır.

export type ErrorSource = "server" | "client";

export type ErrorEntry = {
  source: ErrorSource;
  message: string;
  digest?: string | null;
  path?: string | null;
  method?: string | null;
  route?: string | null; // hatanın çıktığı sayfa dosyası, ör. /(dashboard)/gorevler/[id]
  kind?: string | null; // render | route | action | proxy
  stack?: string | null;
  userId?: string | null;
  userAgent?: string | null;
};

// Aynı hata art arda gelirse (ör. her istekte patlayan sayfa) tabloyu doldurmasın:
// aynı hata dakikada bir kez, toplamda dakikada en fazla 20 kayıt yazılır.
const REPEAT_MS = 60_000;
const MAX_PER_WINDOW = 20;
const lastSeen = new Map<string, number>();
let windowStart = 0;
let windowCount = 0;

function allow(key: string): boolean {
  const now = Date.now();
  if (now - windowStart > REPEAT_MS) {
    windowStart = now;
    windowCount = 0;
    for (const [k, t] of lastSeen) if (now - t > REPEAT_MS) lastSeen.delete(k);
  }
  if (windowCount >= MAX_PER_WINDOW) return false;
  const seen = lastSeen.get(key);
  if (seen !== undefined && now - seen < REPEAT_MS) return false;
  lastSeen.set(key, now);
  windowCount++;
  return true;
}

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null);

// Adres çubuğundaki sorgu kısmı (ör. şifre sıfırlama kodu) kayda girmez
function pathOnly(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.split("?")[0].slice(0, 300);
}

// Asla hata fırlatmaz: kayıt tutulamaması asıl isteği etkilememeli
export async function writeErrorLog(entry: ErrorEntry): Promise<void> {
  try {
    const message = entry.message.trim().slice(0, 1000) || "Bilinmeyen hata";
    const path = pathOnly(entry.path);
    if (!allow(`${entry.source}|${path}|${entry.digest ?? message}`)) return;

    const admin = createAdminClient();
    if (!admin) return;
    await admin.from("error_log").insert({
      source: entry.source,
      message,
      digest: clip(entry.digest, 100),
      path,
      method: clip(entry.method, 10),
      route: clip(entry.route, 300),
      kind: clip(entry.kind, 30),
      stack: clip(entry.stack, 6000),
      user_id: entry.userId ?? null,
      user_agent: clip(entry.userAgent, 300),
    });
  } catch {
    // yut: günlükte zaten var
  }
}

export function describeError(err: unknown): { message: string; digest: string | null; stack: string | null } {
  if (err instanceof Error) {
    const digest = "digest" in err && typeof err.digest === "string" ? err.digest : null;
    return { message: err.message || err.name, digest, stack: err.stack ?? null };
  }
  return { message: typeof err === "string" ? err : "Bilinmeyen hata", digest: null, stack: null };
}
