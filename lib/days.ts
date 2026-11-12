import { dayKey } from "@/lib/format";

// Gün seçicinin adres çubuğundaki değeri (?gun=...)
//   yok          → bugün (varsayılan)
//   YYYY-MM-DD   → o gün
//   "tumu"       → tüm günler
export const ALL_DAYS = "tumu";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayKey() {
  return dayKey(new Date().toISOString());
}

// Türkiye saatine göre verilen anın gün anahtarı ve saati (0-23)
export function dayAndHour(at: Date = new Date()): { day: string; hour: number } {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Istanbul" }).format(at),
  );
  return { day: dayKey(at.toISOString()), hour };
}

// Seçilen gün; tüm günler seçiliyse null
export function parseDayParam(gun: string | string[] | undefined, today: string): string | null {
  if (gun === ALL_DAYS) return null;
  if (typeof gun === "string" && DAY_RE.test(gun)) return gun;
  return today;
}
