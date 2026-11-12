// Tekrarlayan görevlerin takvim hesabı (sunucu ve tarayıcı). Tarihler "YYYY-MM-DD"
// ve Türkiye gününe göredir; hesaplar UTC üzerinden yapılır ki saat dilimi kaydırmasın.
import type { RecurringFrequency } from "@/types/database";
import { addDays } from "@/lib/due";

// Formdaki sırayla
export const FREQUENCIES: RecurringFrequency[] = ["weekdays", "daily", "weekly", "biweekly", "monthly"];

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekdays: "Hafta içi her gün",
  daily: "Her gün",
  weekly: "Her hafta",
  biweekly: "İki haftada bir",
  monthly: "Her ay",
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

// "Her hafta · pazartesi", "Her ay · ayın 15'i" gibi kısa açıklama
export function describeSchedule(
  frequency: RecurringFrequency,
  nextRun: string,
  anchorDay: number | null,
): string {
  const label = FREQUENCY_LABELS[frequency];
  if (frequency === "weekly" || frequency === "biweekly") return `${label} · ${WEEKDAYS[weekday(nextRun)]}`;
  if (frequency === "monthly") {
    const day = anchorDay ?? dayOfMonth(nextRun);
    return `${label} · ayın ${day}. günü${day > 28 ? " (kısa aylarda son gün)" : ""}`;
  }
  return label;
}
