"use client";

import { useMemo } from "react";
import { CalendarX2, ChevronDown, Search, X } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import type { TaskPriority, TaskStatus } from "@/types/database";
import { PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/tasks";
import { daysBetween } from "@/lib/due";
import { labelColor, taskLabels, type LabelLite } from "@/lib/labels";
import { PriorityIcon } from "./priority";

export type Filters = {
  text: string;
  person: string; // "" tümü, "herkes" sorumlusu olmayanlar, yoksa kişi id
  priorities: TaskPriority[];
  labels: string[];
  overdue: boolean;
};

export const EMPTY_FILTERS: Filters = { text: "", person: "", priorities: [], labels: [], overdue: false };

type FilterableTask = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  assignee: { full_name: string | null } | null;
  labels?: { label: LabelLite | null }[];
};

const norm = (s: string) => s.toLocaleLowerCase("tr").normalize("NFC");

export function matchesFilters(task: FilterableTask, f: Filters, today: string): boolean {
  if (f.text && !norm(task.title).includes(norm(f.text.trim()))) return false;
  if (f.person === "herkes" ? task.assigned_to !== null : f.person && task.assigned_to !== f.person) return false;
  if (f.priorities.length && !f.priorities.includes(task.priority)) return false;
  if (f.labels.length) {
    const ids = new Set(taskLabels(task.labels).map((l) => l.id));
    if (!f.labels.some((id) => ids.has(id))) return false;
  }
  if (f.overdue && (task.status === "done" || !task.due_date || daysBetween(today, task.due_date) >= 0)) return false;
  return true;
}

function isEmpty(f: Filters) {
  return !f.text && !f.person && !f.priorities.length && !f.labels.length && !f.overdue;
}

// Panonun üstündeki süzgeç çubuğu. Seçenekler panodaki görevlerden çıkarılır.
export function BoardFilters({
  tasks,
  filters,
  onChange,
  shownCount,
}: {
  tasks: FilterableTask[];
  filters: Filters;
  onChange: (f: Filters) => void;
  shownCount: number;
}) {
  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) if (t.assigned_to) map.set(t.assigned_to, t.assignee?.full_name ?? "Eski üye");
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));
  }, [tasks]);
  const hasOpen = tasks.some((t) => t.assigned_to === null);
  const labels = useMemo(() => {
    const map = new Map<string, LabelLite>();
    for (const t of tasks) for (const l of taskLabels(t.labels)) map.set(l.id, l);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [tasks]);

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const chip = (on: boolean) =>
    `inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold whitespace-nowrap transition ${
      on ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    }`;

  if (!tasks.length) return null;

  return (
    // Masaüstünde tek satır; mobilde arama üstte, süzgeçler altta yana kaydırılır
    <div
      className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center"
      role="search"
      aria-label="Görevleri süz"
    >
      <label className="relative shrink-0">
        <span className="sr-only">Görev ara</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="Bu panoda ara…"
          className="h-8 w-full rounded-lg border border-slate-200 bg-white pr-2.5 pl-8 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15 sm:w-36"
        />
      </label>

      <div className="no-scrollbar -mx-4 -my-1 flex items-center gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:my-0 sm:flex-wrap sm:overflow-visible sm:p-0">
        <select
          value={filters.person}
          onChange={(e) => set({ person: e.target.value })}
          aria-label="Sorumlu kişi"
          className={`${chip(Boolean(filters.person))} max-w-36 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50`}
        >
          <option value="">Tüm kişiler</option>
          {hasOpen && <option value="herkes">Herkes (sorumlu yok)</option>}
          {people.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        {/* Öncelik ve etiket: açılır listede çoklu seçim (çubuk tek satırda kalsın) */}
        <Menu
          align="left"
          label={selectedLabel("Öncelik", filters.priorities.length)}
          triggerClassName={chip(filters.priorities.length > 0)}
          trigger={<DropdownText text="Öncelik" count={filters.priorities.length} />}
          items={TASK_PRIORITIES.filter((p) => p !== "none").map((p) => ({
            label: PRIORITY_LABELS[p],
            icon: <PriorityIcon priority={p} className="size-3.5" />,
            checked: filters.priorities.includes(p),
            onSelect: () => set({ priorities: toggle(filters.priorities, p) }),
          }))}
        />

        {labels.length > 0 && (
          <Menu
            align="left"
            label={selectedLabel("Etiket", filters.labels.length)}
            triggerClassName={chip(filters.labels.length > 0)}
            trigger={<DropdownText text="Etiket" count={filters.labels.length} />}
            items={labels.map((l) => ({
              label: l.name,
              icon: <span className={`size-2 shrink-0 rounded-full ${labelColor(l.color).dot}`} />,
              checked: filters.labels.includes(l.id),
              onSelect: () => set({ labels: toggle(filters.labels, l.id) }),
            }))}
          />
        )}

        <button
          type="button"
          aria-pressed={filters.overdue}
          onClick={() => set({ overdue: !filters.overdue })}
          className={`${chip(filters.overdue)} ${filters.overdue ? "!border-rose-300 !bg-rose-50 !text-rose-700" : ""}`}
        >
          <CalendarX2 className="size-3.5" /> Gecikenler
        </button>

        {!isEmpty(filters) && (
          <span className="flex shrink-0 items-center gap-1">
            <span
              title={`${tasks.length} görevden ${shownCount} tanesi gösteriliyor`}
              className="pl-1 text-xs font-medium whitespace-nowrap text-slate-500 tabular-nums"
            >
              {shownCount}/{tasks.length}
              <span className="sr-only"> görev gösteriliyor</span>
            </span>
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-3.5" /> Temizle
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

function selectedLabel(text: string, count: number) {
  return count ? `${text}, ${count} seçili` : text;
}

// Açılır süzgeç düğmesinin yazısı: seçim varsa sayısı, yanında aşağı ok
function DropdownText({ text, count }: { text: string; count: number }) {
  return (
    <>
      {text}
      {count > 0 && (
        <span className="rounded bg-teal-600 px-1.5 text-[10.5px] leading-4 font-bold text-white">
          {count}
        </span>
      )}
      <ChevronDown aria-hidden className="size-3.5 opacity-60" />
    </>
  );
}
