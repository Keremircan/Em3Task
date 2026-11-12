import { Lock } from "lucide-react";
import type { TaskStatus } from "@/types/database";
import { isLocked, openBlockerCount, type BlockerRef } from "@/lib/tasks";

// "Kilitli" rozeti: kabul bekleyen görevin tamamlanmamış ön görevi varsa görünür
export function LockBadge({
  status,
  blockers,
  size = "sm",
}: {
  status: TaskStatus;
  blockers?: BlockerRef[] | null;
  size?: "xs" | "sm";
}) {
  if (!isLocked({ status, blockers })) return null;
  const open = openBlockerCount(blockers);
  return (
    <span
      title={`${open} ön görev tamamlanmadan başlatılamaz`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 font-bold whitespace-nowrap text-slate-700 ring-1 ring-slate-300 ring-inset ${
        size === "xs" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <Lock className="size-3" strokeWidth={2.6} />
      Kilitli
      <span className="sr-only">: {open} ön görev tamamlanmadı</span>
    </span>
  );
}
