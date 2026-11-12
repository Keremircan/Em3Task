// Tekrarlayan görevlerin takvim hesabı (sunucu ve tarayıcı). Tarihler "YYYY-MM-DD"
// ve Türkiye gününe göredir; hesaplar UTC üzerinden yapılır ki saat dilimi kaydırmasın.
import type { RecurringFrequency } from "@/types/database";
import { addDays } from "@/lib/due";

// Formdaki sırayla
export const FREQUENCIES: RecurringFrequency[] = ["weekdays", "daily", "weekly", "biweekly", "monthly"];

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekdays: "Hafta içi her gün",
  daily: "Her gün",
  weekly: "Haftada bir",
  biweekly: "İki haftada bir",
  monthly: "Ayda bir",
};

export function isFrequency(value: unknown): value is RecurringFrequency {
  return FREQUENCIES.includes(value as RecurringFrequency);
}

// Formdaki "Teslim süresi" seçenekleri: görev açıldıktan kaç gün sonra teslim
export const DUE_AFTER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Açıldığı gün" },
  { value: 1, label: "Ertesi gün" },
  { value: 2, label: "2 gün sonra" },
  { value: 3, label: "3 gün sonra" },
  { value: 7, label: "1 hafta sonra" },
  { value: 14, label: "2 hafta sonra" },
];
export const MAX_DUE_AFTER_DAYS = 60;

// İlk açılış en fazla bu kadar ileri bir tarih olabilir
export const MAX_START_AHEAD_DAYS = 366;

// Açılış saati: Türkiye saatiyle tam saat (zamanlanmış iş saat başı çalışır)
export const RUN_HOURS: number[] = Array.from({ length: 24 }, (_, hour) => hour);
export const DEFAULT_RUN_HOUR = 9;

export function isRunHour(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23;
}

// 9 → "09:00"
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

// Görev şimdi açılmalı mı? Açılış günü geldiyse ve o günün saati de geldiyse evet.
// Kaçan bir açılış (sunucu kapalıydı) sonraki gün yine kendi saatinde açılır.
export function isDueNow(nextRun: string, runHour: number, today: string, hour: number): boolean {
  return nextRun <= today && runHour <= hour;
}

const WEEKDAYS = ["pazar", "pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi"];

function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = pazar
}

function isWeekend(day: string): boolean {
  const d = weekday(day);
  return d === 0 || d === 6;
}

export function dayOfMonth(day: string): number {
  return Number(day.slice(8, 10));
}

// Ayın `anchor` günü; ay kısaysa (ör. şubatta 31) ayın son günü
function monthDay(year: number, monthIndex: number, anchor: number): string {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(anchor, last))).toISOString().slice(0, 10);
}

// Seçilen ilk gün takvime uymuyorsa (hafta içi tekrarında hafta sonu) ilk uygun güne kayar
export function firstOccurrence(start: string, frequency: RecurringFrequency): string {
  let day = start;
  if (frequency === "weekdays") while (isWeekend(day)) day = addDays(day, 1);
  return day;
}

// `from` bir açılış günüyse ondan sonraki açılış günü
export function nextOccurrence(from: string, frequency: RecurringFrequency, anchorDay: number | null): string {
  switch (frequency) {
    case "daily":
      return addDays(from, 1);
    case "weekdays": {
      let day = addDays(from, 1);
      while (isWeekend(day)) day = addDays(day, 1);
      return day;
    }
    case "weekly":
      return addDays(from, 7);
    case "biweekly":
      return addDays(from, 14);
    case "monthly": {
      const d = new Date(`${from}T00:00:00Z`);
      return monthDay(d.getUTCFullYear(), d.getUTCMonth() + 1, anchorDay ?? d.getUTCDate());
    }
  }
}

// `from`dan başlayan sıradaki, `after` gününden SONRAKİ ilk açılış. Sunucu birkaç gün
// çalışmadıysa kaçan günler için ayrı ayrı görev açılmaz; sıra bugünün ötesine atlar.
export function nextOccurrenceAfter(
  from: string,
  after: string,
  frequency: RecurringFrequency,
  anchorDay: number | null,
): string {
  let day = from;
  // En seyrek tekrar aylık, en sık günlük: 800 adım iki yılı fazlasıyla karşılar
  for (let i = 0; i < 800 && day <= after; i++) day = nextOccurrence(day, frequency, anchorDay);
  return day;
}

// Ayın günü, iyelik ekiyle: 1’i, 2’si, 3’ü, 6’sı, 9’u, 10’u, 20’si, 30’u…
const LAST_DIGIT_SUFFIX = ["", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"];

function dayWithSuffix(day: number): string {
  const suffix = day % 10 === 0 ? (day === 20 ? "si" : "u") : LAST_DIGIT_SUFFIX[day % 10];
  return `${day}’${suffix}`;
}

// Tekrarın gününü de söyleyen kısa açıklama: "Her salı", "İki haftada bir · salı",
// "Her ayın 15’i". Gün, sıradaki açılış tarihinden (aylıkta anchor_day'den) okunur.
// runHour verilirse açılış saati de eklenir: "Her salı · 17:00".
export function describeSchedule(
  frequency: RecurringFrequency,
  nextRun: string,
  anchorDay: number | null,
  runHour?: number,
): string {
  const time = runHour === undefined ? "" : ` · ${hourLabel(runHour)}`;
  if (frequency === "weekly") return `Her ${WEEKDAYS[weekday(nextRun)]}${time}`;
  if (frequency === "biweekly") return `${FREQUENCY_LABELS.biweekly} · ${WEEKDAYS[weekday(nextRun)]}${time}`;
  if (frequency === "monthly") {
    const day = anchorDay ?? dayOfMonth(nextRun);
    return `Her ayın ${dayWithSuffix(day)}${day > 28 ? " (kısa aylarda son gün)" : ""}${time}`;
  }
  return `${FREQUENCY_LABELS[frequency]}${time}`;
}
