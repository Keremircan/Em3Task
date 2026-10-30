// Rapor ve dışa aktarma dönemi (?donem=7 | 30 | ay | tumu), Türkiye saatiyle
import { todayKey } from "@/lib/days";
import { addDays } from "@/lib/due";

export type Period = "7" | "30" | "ay" | "tumu";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "7", label: "Son 7 gün" },
  { key: "30", label: "Son 30 gün" },
  { key: "ay", label: "Bu ay" },
  { key: "tumu", label: "Tümü" },
];

export function parsePeriod(value: unknown): Period {
  return value === "7" || value === "ay" || value === "tumu" ? value : "30";
}

// Dönemin başlangıcı (ISO, Türkiye gece yarısı); "tümü" için null
export function periodStart(period: Period): string | null {
  if (period === "tumu") return null;
  const today = todayKey();
  const day = period === "ay" ? `${today.slice(0, 7)}-01` : addDays(today, -(Number(period) - 1));
  return `${day}T00:00:00+03:00`;
}

export function periodLabel(period: Period): string {
  return PERIODS.find((p) => p.key === period)?.label ?? "";
}
