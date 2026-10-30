"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Square } from "lucide-react";
import { stopTimer } from "@/actions/time";
import { safe } from "@/lib/safe-action";
import { formatClock } from "@/lib/time";

// Sidebar'da çalışan sayaç: hangi sayfada olursa olsun görünür ve durdurulabilir
export function RunningTimer({
  taskId,
  taskTitle,
  startedAt,
}: {
  taskId: string;
  taskTitle: string;
  startedAt: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [stopped, setStopped] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  if (stopped) return null;
  const seconds = now ? Math.max(0, Math.round((now - Date.parse(startedAt)) / 1000)) : 0;

  return (
    <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2">
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-rose-400" />
      <Link href={`/gorevler/${taskId}`} className="min-w-0 flex-1" title={taskTitle}>
        <span className="block font-mono text-[13px] font-semibold text-rose-100 tabular-nums">
          {now ? formatClock(seconds) : "--:--:--"}
        </span>
        <span className="block truncate text-[11px] text-rose-200/80">{taskTitle}</span>
      </Link>
      <button
        type="button"
        onClick={() => {
          setStopped(true);
          startTransition(async () => {
            const r = await safe(stopTimer());
            if (r.error) setStopped(false);
          });
        }}
        aria-label="Sayacı durdur"
        title="Sayacı durdur"
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-rose-500 text-white hover:bg-rose-600"
      >
        <Square className="size-3" fill="currentColor" />
      </button>
    </div>
  );
}
