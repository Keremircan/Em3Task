"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, RotateCcw } from "lucide-react";
import type { TaskPriority, TaskStatus } from "@/types/database";
import { requestRevision } from "@/actions/tasks";
import { formatDateTime } from "@/lib/format";
import { BOARD_COLUMNS, canRequestRevision, STATUS_DOTS } from "@/lib/tasks";
import { PriorityControl } from "./priority-control";
import { DueBadge } from "./due-badge";
import { RevisionBadge, RevisionDialog } from "./revision";
import { OptimisticTasksProvider, useOptimisticTasks, useShownTasks } from "./optimistic-tasks";
import { safe } from "@/lib/safe-action";

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  revision_count: number;
  created_at: string;
  assigned_to: string | null;
  created_by: string | null;
  creator: { full_name: string | null } | null;
  assignee: { full_name: string | null } | null;
};

// Proje panosunun 4 sütunu. Kontrol sütunundaki kartlarda, görevi atayan kişiye
// "Revize Ver" butonu çıkar; basılınca kart beklemeden "Yapılıyor"a geçer.
export function TaskBoard({ tasks, userId }: { tasks: BoardTask[]; userId: string }) {
  return (
    <OptimisticTasksProvider tasks={tasks}>
      <Columns tasks={tasks} userId={userId} />
    </OptimisticTasksProvider>
  );
}

function Columns({ tasks, userId }: { tasks: BoardTask[]; userId: string }) {
  const all = useShownTasks(tasks);
  return (
    <div className="grid min-h-[60vh] min-w-[920px] flex-1 grid-cols-4 gap-3 xl:min-w-0">
      {BOARD_COLUMNS.map((column) => {
        const items = all.filter((t) => t.status === column.status);
        return (
          <section
            key={column.status}
            aria-label={column.title}
            className="flex flex-col rounded-xl bg-slate-200/50 p-2.5"
          >
            <div className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <span className={`size-2 rounded-full ${STATUS_DOTS[column.status]}`} />
                {column.title}
              </h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">
                {items.length}
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {items.map((task) => (
                <li
                  key={task.id}
                  className="rounded-lg border border-slate-200/60 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition hover:border-teal-200 hover:shadow-md"
                >
                  {/* Başlık ve öncelik: öncelik rozeti bağlantının dışında, tıklanınca
                      öncelik listesi açılır; kartın geri kalanı göreve götürür */}
                  <div className="flex items-start justify-between gap-2 px-3 pt-3">
                    <Link
                      href={`/gorevler/${task.id}`}
                      className="min-w-0 flex-1 text-[13.5px] leading-snug font-semibold text-slate-900 [overflow-wrap:anywhere]"
                    >
                      {task.title}
                    </Link>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <PriorityControl taskId={task.id} priority={task.priority} size="xs" />
                      <DueBadge due={task.due_date} status={task.status} size="xs" />
                      <RevisionBadge count={task.revision_count} size="xs" />
                    </span>
                  </div>
                  <Link href={`/gorevler/${task.id}`} className="block px-3 pb-3" tabIndex={-1}>
                    <FromTo
                      from={task.creator?.full_name ?? "Eski üye"}
                      to={
                        task.assigned_to === null
                          ? "Herkes"
                          : (task.assignee?.full_name ?? "Eski üye")
                      }
                    />
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-slate-500">
                      <CalendarClock className="size-3.5" />
                      {formatDateTime(task.created_at)}
                    </p>
                  </Link>
                  {canRequestRevision(task, userId) && <CardRevisionButton task={task} />}
                </li>
              ))}
              {items.length === 0 && (
                <li className="rounded-lg border border-dashed border-slate-300/70 px-3 py-5 text-center text-sm text-slate-400">
                  Görev yok
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CardRevisionButton({ task }: { task: BoardTask }) {
  const optimistic = useOptimisticTasks();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="border-t border-slate-100 px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-amber-50 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 transition ring-inset hover:bg-amber-100"
      >
        <RotateCcw className="size-3.5" strokeWidth={2.4} /> Revize Ver
      </button>
      <RevisionDialog
        open={open}
        onClose={() => setOpen(false)}
        taskTitle={task.title}
        onSubmit={(note) =>
          startTransition(async () => {
            // Kart hemen "Yapılıyor" sütununa geçer; hata olursa geri döner
            optimistic?.apply({ type: "status", id: task.id, status: "in_progress" });
            const result = await safe(requestRevision(task.id, note));
            if (result.error) optimistic?.report(result.error);
          })
        }
      />
    </div>
  );
}

// Dar kartlarda sadece ilk ad; tam ad üzerine gelince görünür
function FromTo({ from, to }: { from: string; to: string }) {
  const first = (name: string) => name.split(/\s+/)[0] || name;
  return (
    <p
      title={`${from} → ${to}`}
      className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-slate-600"
    >
      <span className="truncate">{first(from)}</span>
      <ArrowRight className="size-3.5 shrink-0 text-slate-400" />
      <span className="truncate">{first(to)}</span>
    </p>
  );
}
