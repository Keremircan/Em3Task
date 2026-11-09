// Raporlar: açılan ve tamamlanan görevlerin zaman içindeki dağılımı.
// Dönem uzunluğuna göre gruplama seçilir: ≤ 31 gün günlük, ≤ 140 gün haftalık
// (bugünle biten 7 günlük dilimler), daha uzunsa aylık. Tarihler Türkiye saatine göre gün.
import { dayKey } from "@/lib/format";
import { addDays, daysBetween } from "@/lib/due";

export type TrendStep = "day" | "week" | "month";

export type TrendBucket = {
  label: string; // eksende: "9 Kas", "3 Kas", "Kas"
  range: string; // ipucunda ve tabloda: "9 Kasım", "3–9 Kasım", "Kasım 2026"
  opened: number;
  done: number;
};

export const STEP_LABEL: Record<TrendStep, string> = {
  day: "günlük",
  week: "haftalık",
  month: "aylık",
};

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("tr-TR", { ...o, timeZone: "UTC" });
const dayShort = fmt({ day: "numeric", month: "short" });
const dayLong = fmt({ day: "numeric", month: "long" });
const dayOnly = fmt({ day: "numeric" });
const monthShort = fmt({ month: "short" });
const monthLong = fmt({ month: "long", year: "numeric" });

function stepFor(days: number): TrendStep {
  if (days <= 31) return "day";
  if (days <= 140) return "week";
  return "month";
}

// "2026-11" → "2026-12"
function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

function weekRange(from: string, to: string): string {
  // Tek gün: "9 Kasım"; aynı ay: "3–9 Kasım"; farklı ay: "27 Ekim – 2 Kasım"
  if (from === to) return dayLong.format(utc(from));
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${dayOnly.format(utc(from))}–${dayLong.format(utc(to))}`
    : `${dayLong.format(utc(from))} – ${dayLong.format(utc(to))}`;
}

// startDay..today arasını dilimlere böler; created/completed ISO zaman damgaları
export function buildTrend(
  startDay: string,
  today: string,
  created: string[],
  completed: string[],
): { step: TrendStep; buckets: TrendBucket[] } {
  const step = stepFor(daysBetween(startDay, today) + 1);

  // Her dilimin kapsadığı gün aralığı (iki uç dahil)
  const ranges: { from: string; to: string }[] = [];
  if (step === "day") {
    for (let d = startDay; d <= today; d = addDays(d, 1)) ranges.push({ from: d, to: d });
  } else if (step === "week") {
    // Bugünle biten 7 günlük dilimler (son nokta yarım hafta olmasın).
    // Baştaki kısa dilim (< 4 gün) yanıltıcı bir düşüş göstermesin diye sonrakine katılır.
    for (let to = today; to >= startDay; to = addDays(to, -7)) {
      const from = addDays(to, -6);
      ranges.unshift({ from: from < startDay ? startDay : from, to });
    }
    if (ranges.length > 1 && daysBetween(ranges[0].from, ranges[0].to) < 3) {
      const head = ranges.shift()!;
      ranges[0].from = head.from;
    }
  } else {
    for (let m = startDay.slice(0, 7); m <= today.slice(0, 7); m = nextMonth(m)) {
      const first = `${m}-01`;
      const last = addDays(`${nextMonth(m)}-01`, -1);
      ranges.push({ from: first < startDay ? startDay : first, to: last > today ? today : last });
    }
  }

  const counts = ranges.map(() => ({ opened: 0, done: 0 }));
  const indexOf = (iso: string) => {
    const d = dayKey(iso);
    return ranges.findIndex((r) => r.from <= d && d <= r.to);
  };
  for (const iso of created) {
    const i = indexOf(iso);
    if (i >= 0) counts[i].opened++;
  }
  for (const iso of completed) {
    const i = indexOf(iso);
    if (i >= 0) counts[i].done++;
  }

  // Ay adı, yıl değişiyorsa eksende yılla yazılır
  const multiYear = startDay.slice(0, 4) !== today.slice(0, 4);
  const buckets = ranges.map(({ from, to }, i): TrendBucket => {
    const c = counts[i];
    if (step === "day") return { label: dayShort.format(utc(from)), range: dayLong.format(utc(from)), ...c };
    if (step === "week") return { label: dayShort.format(utc(from)), range: weekRange(from, to), ...c };
    const first = utc(`${from.slice(0, 7)}-01`);
    const label = monthShort.format(first) + (multiYear ? ` ${from.slice(2, 4)}` : "");
    return { label, range: monthLong.format(first), ...c };
  });

  return { step, buckets };
}
