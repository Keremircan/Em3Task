import { CalendarClock, CalendarX2 } from "lucide-react";
import { formatDay } from "@/lib/format";
import { todayKey } from "@/lib/days";
import { dueInfo, type DueTone } from "@/lib/due";
import type { TaskStatus } from "@/types/database";

const TONES: Record<DueTone, string> = {
  overdue: "bg-rose-50 text-rose-700 ring-rose-200",
  today: "bg-amber-50 text-amber-800 ring-amber-200",
  soon: "bg-sky-50 text-sky-700 ring-sky-200",
  later: "bg-slate-50 text-slate-600 ring-slate-200",
  done: "bg-slate-50 text-slate-400 ring-slate-200",
};

// Teslim tarihi rozeti: kalan süreye göre renklenir; tamamlanan görevde soluk
export function DueBadge({
  due,
  status,
  size = "sm",
}: {
  due: string | null;
  status: TaskStatus;
  size?: "xs" | "sm";
}) {
  if (!due) return null;
  const info = dueInfo(due, status, todayKey());
  const Icon = info.tone === "overdue" ? CalendarX2 : CalendarClock;
  return (
    <span
      title={`Teslim tarihi: ${formatDay(due)}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md font-semibold whitespace-nowrap ring-1 ${TONES[info.tone]} ${
        size === "xs" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <Icon className="size-3.5" />
      {info.label}
    </span>
  );
}
