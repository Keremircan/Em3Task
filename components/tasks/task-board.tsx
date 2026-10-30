"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowRight, CalendarClock, GripVertical, RotateCcw } from "lucide-react";
import type { TaskPriority, TaskStatus } from "@/types/database";
import { acceptTask, completeTask, requestRevision, submitForReview } from "@/actions/tasks";
import { formatDateTime } from "@/lib/format";
import {
  BOARD_COLUMNS,
  boardMove,
  canRequestRevision,
  STATUS_DOTS,
  STATUS_LABELS,
  type BoardMove,
} from "@/lib/tasks";
import { todayKey } from "@/lib/days";
import { daysBetween } from "@/lib/due";
import { PriorityControl } from "./priority-control";
import { DueBadge } from "./due-badge";
import { ChecklistBadge, LabelChips } from "./label-chip";
import { checklistProgress, taskLabels, type LabelLite } from "@/lib/labels";
import { RevisionBadge, RevisionDialog } from "./revision";
import { OptimisticTasksProvider, useOptimisticTasks, useShownTasks } from "./optimistic-tasks";
import { BoardFilters, EMPTY_FILTERS, matchesFilters, type Filters } from "./board-filters";
import { safe } from "@/lib/safe-action";

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  labels?: { label: LabelLite | null }[];
  checklist?: { is_done: boolean }[];
  revision_count: number;
  created_at: string;
  assigned_to: string | null;
  created_by: string | null;
  creator: { full_name: string | null } | null;
  assignee: { full_name: string | null } | null;
};

const MOVE_HINT: Record<BoardMove, string> = {
  accept: "Kabul et",
  submit: "Kontrole gönder",
  revision: "Revize ver",
  complete: "Tamamla",
};

// Proje panosu: 4 sütun, kartlar sütunlar arasında sürüklenebilir (fare, dokunma, klavye).
// Sürükleme sadece iş akışının izin verdiği geçişlerde kabul edilir; kart hemen yeni
// sütuna geçer, kaydedilemezse geri döner. Üstte kişi / öncelik / etiket süzgeçleri var.
export function TaskBoard({ tasks, userId }: { tasks: BoardTask[]; userId: string }) {
  return (
    <OptimisticTasksProvider tasks={tasks}>
      <Board tasks={tasks} userId={userId} />
    </OptimisticTasksProvider>
  );
}

function Board({ tasks, userId }: { tasks: BoardTask[]; userId: string }) {
  const all = useShownTasks(tasks);
  const optimistic = useOptimisticTasks();
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [revisionFor, setRevisionFor] = useState<BoardTask | null>(null);
  const justDragged = useRef(false);

  const sensors = useSensors(
    // Fare: 6 px hareket edince sürükleme başlar (tıklama bağlantıyı açmaya devam eder)
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Dokunma: kısa süre basılı tutunca başlar (parmak 10 px'e kadar kayabilir);
    // daha hızlı kaydırma hareketi sayfayı/sütunları kaydırmaya devam eder
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 10 } }),
    useSensor(KeyboardSensor),
  );

  const today = todayKey();
  const shown = useMemo(
    () => all.filter((t) => matchesFilters(t, filters, today)),
    [all, filters, today],
  );
  const active = all.find((t) => t.id === activeId) ?? null;

  function run(task: BoardTask, move: BoardMove) {
    if (move === "revision") {
      setRevisionFor(task);
      return;
    }
    startTransition(async () => {
      if (move === "accept") {
        optimistic?.apply({ type: "status", id: task.id, status: "in_progress", assignedTo: userId });
        const r = await safe(acceptTask(task.id));
        if (r.error) optimistic?.report(r.error);
      } else if (move === "submit") {
        optimistic?.apply({ type: "status", id: task.id, status: "review" });
        const r = await safe(submitForReview(task.id));
        if (r.error) optimistic?.report(r.error);
      } else {
        optimistic?.apply({ type: "status", id: task.id, status: "done" });
        const r = await safe(completeTask(task.id));
        if (r.error) optimistic?.report(r.error);
      }
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    justDragged.current = true;
    // Telefonda sürüklemenin başladığını hissettir (destekleyen cihazlarda)
    navigator.vibrate?.(12);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    // Sürükleme bitince oluşan tıklama bağlantıyı açmasın
    setTimeout(() => (justDragged.current = false), 50);
    const task = all.find((t) => t.id === e.active.id);
    const to = e.over?.id as TaskStatus | undefined;
    if (!task || !to || task.status === to) return;
    const move = boardMove(task, to, userId);
    if (!move) {
      optimistic?.report(
        `“${STATUS_LABELS[to]}” sütununa taşıma yetkiniz yok. ${moveRuleHint(task.status, to)}`,
      );
      return;
    }
    run(task, move);
  }

  return (
    <>
      <BoardFilters tasks={all} filters={filters} onChange={setFilters} shownCount={shown.length} />

      {/* Mobilde sütunlar yana kaydırılır (çubuk gizli); sütunlar sayfanın altına kadar uzanır */}
      <div className="no-scrollbar -mx-4 flex flex-1 flex-col overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                "Kartı taşımak için boşluk tuşuna basın, ok tuşlarıyla sütun seçin, bırakmak için tekrar boşluğa basın. Vazgeçmek için Esc.",
            },
          }}
        >
          <div className="grid min-h-[60vh] min-w-[920px] flex-1 grid-cols-4 gap-3 xl:min-w-0">
            {BOARD_COLUMNS.map((column) => {
              const items = shown.filter((t) => t.status === column.status);
              const move = active ? boardMove(active, column.status, userId) : null;
              return (
                <Column
                  key={column.status}
                  status={column.status}
                  title={column.title}
                  count={items.length}
                  dragging={Boolean(active)}
                  isSource={active?.status === column.status}
                  move={move}
                >
                  {items.map((task) => (
                    <DraggableCard
                      key={task.id}
                      task={task}
                      userId={userId}
                      onClickCapture={(e) => {
                        if (justDragged.current) e.preventDefault();
                      }}
                      onRevision={() => setRevisionFor(task)}
                    />
                  ))}
                  {items.length === 0 && (
                    <li className="rounded-lg border border-dashed border-slate-300/70 px-3 py-5 text-center text-sm text-slate-400">
                      {move ? "Buraya bırakın" : "Görev yok"}
                    </li>
                  )}
                </Column>
              );
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {active ? (
              <div className="w-60 rotate-2 rounded-lg border border-teal-300 bg-white px-3 py-2.5 shadow-xl">
                <p className="text-[13.5px] leading-snug font-semibold text-slate-900">{active.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <RevisionDialog
        open={revisionFor !== null}
        onClose={() => setRevisionFor(null)}
        taskTitle={revisionFor?.title ?? ""}
        onSubmit={(note) => {
          const task = revisionFor;
          if (!task) return;
          startTransition(async () => {
            // Kart hemen "Yapılıyor" sütununa geçer; hata olursa geri döner
            optimistic?.apply({ type: "status", id: task.id, status: "in_progress" });
            const result = await safe(requestRevision(task.id, note));
            if (result.error) optimistic?.report(result.error);
          });
        }}
      />
    </>
  );
}

function moveRuleHint(from: TaskStatus, to: TaskStatus): string {
  if (to === "done") return "Görevi sadece atayan kişi, kabul edildikten sonra tamamlayabilir.";
  if (to === "review") return "Görevi sadece sorumlusu, kabul ettikten sonra kontrole gönderebilir.";
  if (to === "in_progress" && from === "pending") return "Görevi sadece sorumlusu kabul edebilir.";
  if (to === "in_progress" && from === "review") return "Revizeyi sadece görevi atayan verebilir.";
  if (to === "pending") return "Görevler “Yeni” sütununa geri taşınamaz.";
  return "Bu geçiş iş akışında yok.";
}

function Column({
  status,
  title,
  count,
  dragging,
  isSource,
  move,
  children,
}: {
  status: TaskStatus;
  title: string;
  count: number;
  dragging: boolean;
  isSource: boolean;
  move: BoardMove | null;
  children: React.ReactNode;
}) {
  // İzin verilmeyen sütun da bırakma hedefidir: bırakılınca nedeni açıklanır
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const allowed = dragging && Boolean(move);
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={`flex flex-col rounded-xl p-2.5 transition ${
        allowed
          ? isOver
            ? "bg-teal-100 ring-2 ring-teal-500"
            : "bg-teal-50 ring-2 ring-teal-300 ring-dashed"
          : dragging && !isSource
            ? isOver
              ? "bg-rose-50 ring-2 ring-rose-300"
              : "bg-slate-200/30 opacity-60"
            : "bg-slate-200/50"
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <span className={`size-2 rounded-full ${STATUS_DOTS[status]}`} />
          {title}
        </h2>
        {allowed && move ? (
          <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-bold text-white">
            {MOVE_HINT[move]}
          </span>
        ) : (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">{count}</span>
        )}
      </div>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

function DraggableCard({
  task,
  userId,
  onClickCapture,
  onRevision,
}: {
  task: BoardTask;
  userId: string;
  onClickCapture: (e: React.MouseEvent) => void;
  onRevision: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const overdue = task.status !== "done" && task.due_date !== null && daysBetween(todayKey(), task.due_date) < 0;

  return (
    <li
      ref={setNodeRef}
      onClickCapture={onClickCapture}
      // Uzun basma sürükleme içindir: telefonun bağlantı önizlemesi / menüsü açılmasın
      onContextMenu={(e) => e.preventDefault()}
      className={`group/card relative rounded-lg border bg-white select-none [-webkit-touch-callout:none] [-webkit-user-select:none] shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition hover:shadow-md ${
        isDragging ? "opacity-40" : ""
      } ${overdue ? "border-rose-200 hover:border-rose-300" : "border-slate-200/60 hover:border-teal-200"}`}
    >
      {/* Sürükleme tutamağı: klavye ve ekran okuyucu için; fareyle kartın her yerinden sürüklenir */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`${task.title} kartını taşı`}
        className="absolute top-2 left-0.5 z-[1] flex h-6 w-4 cursor-grab touch-none items-center justify-center rounded text-slate-300 opacity-0 transition group-hover/card:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-3.5" />
      </button>
      <div {...listeners} className="cursor-grab active:cursor-grabbing" style={{ touchAction: "manipulation" }}>
        {/* Başlık ve öncelik: öncelik rozeti bağlantının dışında, tıklanınca
            öncelik listesi açılır; kartın geri kalanı göreve götürür */}
        <div className="flex items-start justify-between gap-2 px-3 pt-3">
          <Link
            href={`/gorevler/${task.id}`}
            draggable={false}
            className="min-w-0 flex-1 [-webkit-touch-callout:none] text-[13.5px] leading-snug font-semibold text-slate-900 [overflow-wrap:anywhere]"
          >
            {task.title}
          </Link>
          <span className="flex shrink-0 flex-col items-end gap-1" onPointerDown={(e) => e.stopPropagation()}>
            <PriorityControl taskId={task.id} priority={task.priority} size="xs" />
            <DueBadge due={task.due_date} status={task.status} size="xs" />
            <RevisionBadge count={task.revision_count} size="xs" />
          </span>
        </div>
        <Link
          href={`/gorevler/${task.id}`}
          draggable={false}
          className="block px-3 pb-3 [-webkit-touch-callout:none]"
          tabIndex={-1}
        >
          {task.labels?.length || task.checklist?.length ? (
            <span className="mt-1.5 flex flex-wrap items-center gap-1">
              <ChecklistBadge {...checklistProgress(task.checklist)} />
              <LabelChips labels={taskLabels(task.labels)} />
            </span>
          ) : null}
          <FromTo
            from={task.creator?.full_name ?? "Eski üye"}
            to={task.assigned_to === null ? "Herkes" : (task.assignee?.full_name ?? "Eski üye")}
          />
          <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <CalendarClock className="size-3.5" />
            {formatDateTime(task.created_at)}
          </p>
        </Link>
      </div>
      {canRequestRevision(task, userId) && (
        <div className="border-t border-slate-100 px-3 py-2">
          <button
            type="button"
            onClick={onRevision}
            className="inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-amber-50 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 transition ring-inset hover:bg-amber-100"
          >
            <RotateCcw className="size-3.5" strokeWidth={2.4} /> Revize Ver
          </button>
        </div>
      )}
    </li>
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
