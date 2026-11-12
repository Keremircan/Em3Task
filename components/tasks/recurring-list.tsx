"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, FolderKanban, Pause, Play, Repeat, Trash, UserRound } from "lucide-react";
import { deleteRecurringTask, setRecurringActive } from "@/actions/recurring";
import type { RecurringFrequency } from "@/types/database";
import { describeSchedule, DUE_AFTER_OPTIONS } from "@/lib/recurring";
import { formatDay } from "@/lib/format";
import { safe } from "@/lib/safe-action";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { smallDangerButton, smallGhostButton } from "@/components/ui/styles";
import { CollapsibleSection } from "./task-list";

export type RecurringItem = {
  id: string;
  title: string;
  frequency: RecurringFrequency;
  anchor_day: number | null;
  due_after_days: number | null;
  next_run: string;
  is_active: boolean;
  assigned_to: string | null;
  project: { id: string; name: string } | null;
  assignee: { full_name: string | null } | null;
};

function dueText(days: number | null): string | null {
  if (days === null) return null;
  const known = DUE_AFTER_OPTIONS.find((o) => o.value === days)?.label.toLocaleLowerCase("tr-TR");
  return `Teslim: ${known ?? `${days} gün sonra`}`;
}

// "Atadığım görevler" sayfasında: kendi kurduğum tekrarlayan görevler
export function RecurringList({ items }: { items: RecurringItem[] }) {
  if (!items.length) return null;
  return (
    <CollapsibleSection title="Tekrarlayan görevler" count={items.length} unit="tekrar">
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>
    </CollapsibleSection>
  );
}

function Row({ item }: { item: RecurringItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const due = dueText(item.due_after_days);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await safe(setRecurringActive(item.id, !item.is_active));
      if (result.error) setError(result.error);
    });
  }

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-start md:justify-between md:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <Repeat className={`size-4 shrink-0 ${item.is_active ? "text-teal-600" : "text-slate-400"}`} />
          <span className="text-sm font-bold text-slate-900 [overflow-wrap:anywhere]">{item.title}</span>
          {!item.is_active && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 ring-inset">
              Duraklatıldı
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          <span>{describeSchedule(item.frequency, item.next_run, item.anchor_day)}</span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-4" />
            {item.is_active ? `Sıradaki açılış: ${formatDay(item.next_run)}` : "Yeni görev açılmıyor"}
          </span>
          {due && <span>{due}</span>}
          {item.project && (
            <Link
              href={`/projeler/${item.project.id}`}
              className="inline-flex items-center gap-1.5 hover:text-teal-700"
            >
              <FolderKanban className="size-4" />
              {item.project.name}
            </Link>
          )}
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-4" />
            Sorumlu: {item.assigned_to === null ? "Herkes" : (item.assignee?.full_name ?? "Eski üye")}
          </span>
        </div>
        {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={toggle} className={smallGhostButton}>
          {item.is_active ? (
            <>
              <Pause className="size-4" /> Duraklat
            </>
          ) : (
            <>
              <Play className="size-4" /> Sürdür
            </>
          )}
        </button>
        <button type="button" disabled={pending} onClick={() => setDeleting(true)} className={smallDangerButton}>
          <Trash className="size-4" /> Sil
        </button>
      </div>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Tekrarı sil"
        message={`"${item.title}" artık kendiliğinden açılmayacak. Daha önce açılmış görevler yerinde kalır.`}
        confirmLabel="Tekrarı sil"
        onConfirm={() => safe(deleteRecurringTask(item.id))}
      />
    </li>
  );
}
