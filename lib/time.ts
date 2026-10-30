// Süre hesapları ve biçimlendirme (sunucu ve tarayıcı)

export const MAX_ENTRY_MINUTES = 24 * 60;

type Span = { started_at: string; ended_at: string | null };

// Kaydın süresi (saniye). Çalışan sayaçta "şimdi"ye kadar.
export function entrySeconds(e: Span, now = Date.now()): number {
  const end = e.ended_at ? Date.parse(e.ended_at) : now;
  return Math.max(0, Math.round((end - Date.parse(e.started_at)) / 1000));
}

export function totalSeconds(entries: Span[], now = Date.now()): number {
  return entries.reduce((sum, e) => sum + entrySeconds(e, now), 0);
}

// "2 sa 15 dk", "45 dk", "1 dk'dan az"
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return seconds > 0 ? "1 dk'dan az" : "0 dk";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} dk`;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

// Sayaç görünümü: 01:05:09
export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

// Saat olarak (raporlar ve dışa aktarma): 1,5
export function hours(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}
