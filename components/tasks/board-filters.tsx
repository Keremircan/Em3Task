"use client";

import { useMemo } from "react";
import { CalendarX2, Search, X } from "lucide-react";
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
    `inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
      on ? "border-teal-300 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    }`;

  if (!tasks.length) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" role="search" aria-label="Görevleri süz">
      <label className="relative">
        <span className="sr-only">Görev ara</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="Bu panoda ara…"
          className="h-8 w-44 rounded-lg border border-slate-200 bg-white pr-2.5 pl-8 text-xs outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15"
        />
      </label>

      <select
        value={filters.person}
        onChange={(e) => set({ person: e.target.value })}
        aria-label="Sorumlu kişi"
        className={`${chip(Boolean(filters.person))} pr-2 outline-none`}
      >
        <option value="">Tüm kişiler</option>
        {hasOpen && <option value="herkes">Herkes (sorumlu yok)</option>}
        {people.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1" role="group" aria-label="Öncelik">
        {TASK_PRIORITIES.filter((p) => p !== "none").map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={filters.priorities.includes(p)}
            title={`Öncelik: ${PRIORITY_LABELS[p]}`}
            onClick={() => set({ priorities: toggle(filters.priorities, p) })}
            className={chip(filters.priorities.includes(p))}
          >
            <PriorityIcon priority={p} className="size-3.5" />
            <span className="hidden sm:inline">{PRIORITY_LABELS[p]}</span>
          </button>
        ))}
      </div>

      {labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Etiket">
          {labels.map((l) => {
            const on = filters.labels.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={on}
                onClick={() => set({ labels: toggle(filters.labels, l.id) })}
                className={chip(on)}
              >
                <span className={`size-2 rounded-full ${labelColor(l.color).dot}`} />
                {l.name}
              </button>
            );
          })}
        </div>
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
        <>
          <span className="text-xs text-slate-500">
            {shownCount} / {tasks.length} görev
          </span>
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-3.5" /> Temizle
          </button>
        </>
      )}
    </div>
  );
}
