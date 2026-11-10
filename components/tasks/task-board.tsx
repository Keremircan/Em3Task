"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
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
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { CalendarClock, ChevronRight, GripVertical, Plus, RotateCcw, Users } from "lucide-react";
import { TaskFormDialog, type TaskFormOptions } from "./task-form-dialog";
import { Avatar } from "@/components/ui/avatar";
import type { TaskPriority, TaskStatus } from "@/types/database";
import { acceptTask, completeTask, requestRevision, submitForReview } from "@/actions/tasks";
import { formatDate, formatDateTime } from "@/lib/format";
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
  creator: { full_name: string | null; avatar_url?: string | null } | null;
  assignee: { full_name: string | null; avatar_url?: string | null } | null;
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
type NewTask = { options: TaskFormOptions; projectId: string };

// Boş sütunda iş akışını anlatan kısa not ("Kabul bekliyor" sütununda bunun yerine "Görev ekle" var)
const EMPTY_HINT: Record<TaskStatus, string> = {
  pending: "Yeni görev yok",
  in_progress: "Kabul edilen işler burada görünür",
  review: "Kontrole gönderilen işler burada görünür",
  done: "Tamamlanan işler burada görünür",
};

export function TaskBoard({
  tasks,
  userId,
  newTask,
}: {
  tasks: BoardTask[];
  userId: string;
  newTask?: NewTask; // verilirse "Kabul bekliyor" sütununda "Görev ekle" çıkar
}) {
  return (
    <OptimisticTasksProvider tasks={tasks}>
      <Board tasks={tasks} userId={userId} newTask={newTask} />
    </OptimisticTasksProvider>
  );
}

function Board({ tasks, userId, newTask }: { tasks: BoardTask[]; userId: string; newTask?: NewTask }) {
  const all = useShownTasks(tasks);
  const optimistic = useOptimisticTasks();
  const [, startTransition] = useTransition();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [revisionFor, setRevisionFor] = useState<BoardTask | null>(null);
  const [adding, setAdding] = useState(false);
  const justDragged = useRef(false);
  // Sabit kimlik: sunucu ve tarayıcı aynı aria-describedby'ı üretsin (hydration uyarısı olmasın)
  const dndId = useId();

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

  // Ekran okuyucu duyuruları (kütüphanenin varsayılanları İngilizce)
  const titleOf = (id: UniqueIdentifier) => `“${all.find((t) => t.id === id)?.title ?? "Kart"}”`;
  const columnOf = (id: UniqueIdentifier) => STATUS_LABELS[id as TaskStatus] ?? String(id);
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${titleOf(active.id)} kartı alındı.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${titleOf(active.id)}, ${columnOf(over.id)} sütununun üzerinde.`
        : `${titleOf(active.id)} bir sütunun üzerinde değil.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${titleOf(active.id)} ${columnOf(over.id)} sütununa bırakıldı.`
        : `${titleOf(active.id)} bırakıldı, yeri değişmedi.`,
    onDragCancel: ({ active }) => `Taşıma iptal edildi; ${titleOf(active.id)} yerinde kaldı.`,
  };

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
          id={dndId}
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{
            announcements,
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
                  {move && items.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-teal-300 px-3 py-5 text-center text-sm text-teal-700">
                      Buraya bırakın
                    </li>
                  ) : column.status === "pending" && newTask && !active ? (
                    // "Kabul bekliyor" sütununun altında her zaman: bu projeye hızlı görev ekleme
                    <li>
                      <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className={`flex w-full items-center justify-center gap-1.5 rounded-lg text-sm font-semibold text-slate-500 transition hover:bg-white/70 hover:text-teal-700 ${
                          items.length ? "py-2" : "border border-dashed border-slate-300/70 py-5"
                        }`}
                      >
                        <Plus className="size-4" strokeWidth={2.2} />
                        Görev ekle
                      </button>
                    </li>
                  ) : (
                    items.length === 0 && (
                      <li className="px-3 py-4 text-center text-[13px] leading-snug text-slate-400">
                        {all.some((t) => t.status === column.status)
                          ? "Süzgece uyan görev yok"
                          : EMPTY_HINT[column.status]}
                      </li>
                    )
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

      {adding && newTask && (
        <TaskFormDialog
          open={adding}
          onClose={() => setAdding(false)}
          options={newTask.options}
          defaultProjectId={newTask.projectId}
        />
      )}

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
        className="absolute top-2 left-0.5 z-[1] flex h-6 w-4 cursor-grab touch-none items-center justify-center rounded text-slate-400 opacity-0 transition group-hover/card:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
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
          <span className="mt-2 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-slate-500">
              <CalendarClock className="size-3.5 shrink-0" />
              <span className="truncate" title={formatDateTime(task.created_at)}>
                {formatDate(task.created_at)}
              </span>
            </span>
            <People task={task} />
          </span>
        </Link>
      </div>
      {canRequestRevision(task, userId) && (
        <div className="border-t border-slate-100 px-3 py-2">
          <button
            type="button"
            onClick={onRevision}
            className="inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-amber-50 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 transition ring-inset hover:bg-amber-100"
          >
            <RotateCcw className="size-3.5" strokeWidth={2.4} /> Revize ver
          </button>
        </div>
      )}
    </li>
  );
}

// Atayan ve sorumlu avatarları: aynı kişiyse tek avatar, farklıysa "atayan › sorumlu".
// "Herkes"e atanan iş için grup simgesi. Tam adlar üzerine gelince görünür.
function People({ task }: { task: BoardTask }) {
  const from = task.creator?.full_name ?? "Eski üye";
  const open = task.assigned_to === null;
  const to = open ? "Herkes" : (task.assignee?.full_name ?? "Eski üye");
  const self = !open && task.created_by === task.assigned_to;
  const names = self ? `${to} (kendine atadı)` : `Atayan: ${from} · Sorumlu: ${to}`;

  return (
    <span title={names} className="flex shrink-0 items-center gap-0.5">
      <span className="sr-only">{names}</span>
      {!self && (
        <>
          <Avatar name={from} src={task.creator?.avatar_url} size="xs" />
          <ChevronRight aria-hidden className="size-3 text-slate-300" />
        </>
      )}
      {open ? (
        <span
          aria-hidden
          className="flex size-5 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400"
        >
          <Users className="size-3" />
        </span>
      ) : (
        <Avatar name={to} src={task.assignee?.avatar_url} size="xs" />
      )}
    </span>
  );
}
