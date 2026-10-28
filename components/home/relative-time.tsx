"use client";

import { useEffect, useState } from "react";

const TZ = "Europe/Istanbul";
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const timeFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: TZ });
const fullFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

function dayKey(ms: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ms); // YYYY-MM-DD
}

export function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  if (diff < MIN) return "az önce";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} dk önce`;
  if (diff < 6 * HOUR || dayKey(t) === dayKey(now)) return `${Math.floor(diff / HOUR)} saat önce`;
  if (dayKey(t) === dayKey(now - DAY)) return `dün ${timeFmt.format(t)}`;
  if (diff < 7 * DAY) return `${Math.max(2, Math.round(diff / DAY))} gün önce`;
  return dayFmt.format(t);
}

// "5 dk önce" gibi göreli zaman. İlk çizimde sunucunun saati kullanılır (sayfa
// açılışında metin kaymasın), sonra her dakika tarayıcı saatiyle güncellenir.
export function RelativeTime({ iso, serverNow }: { iso: string; serverNow: number }) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, MIN);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  return (
    <time dateTime={iso} title={fullFmt.format(new Date(iso))} className="whitespace-nowrap">
      {relativeTime(iso, now)}
    </time>
  );
}
