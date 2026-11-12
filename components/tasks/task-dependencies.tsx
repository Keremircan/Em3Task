"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CircleAlert, Link2, Plus, X } from "lucide-react";
import { addDependency, removeDependency } from "@/actions/dependencies";
import type { TaskStatus } from "@/types/database";
import { safe } from "@/lib/safe-action";
import { SelectField } from "@/components/ui/select-field";
import { card, smallSecondaryButton } from "@/components/ui/styles";
import { StatusBadge } from "./status-badge";

export type LinkedTask = { id: string; title: string; status: TaskStatus };
export type DependencyCandidate = { id: string; title: string; project: string | null };

// Görev detayında "Ön görevler" kartı: bu görevden önce bitmesi gerekenler ve
// bu görevin bitmesini bekleyenler. Ön görevleri tamamlanmadan görev kabul edilemez.
export function TaskDependencies({
  taskId,
  blockers,
  dependents,
  candidates,
  canEdit,
  canAdd,
}: {
  taskId: string;
  blockers: LinkedTask[];
  dependents: LinkedTask[];
  candidates: DependencyCandidate[];
  canEdit: boolean; // görevi atayan kişi ya da Admin
  canAdd: boolean; // tamamlanan göreve ön görev eklenmez
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");

  function run(action: Promise<{ error: string | null }>, done?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await safe(action);
      if (result.error) setError(result.error);
      else done?.();
    });
  }

  // Seçim listesi projeye göre gruplanır
  const groups = new Map<string, DependencyCandidate[]>();
  for (const c of candidates) {
    const key = c.project ?? "Projesiz";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const open = blockers.filter((b) => b.status !== "done").length;

  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Link2 className="size-4.5 text-slate-400" />
          Ön görevler
        </h2>
        {blockers.length > 0 && (
          <span className="text-sm text-slate-500">
            {open === 0 ? "Hepsi tamamlandı" : `${open} tanesi bekleniyor`}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Buradaki görevler tamamlanmadan bu görev kabul edilemez.
      </p>

      {blockers.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {blockers.map((b) => (
            <li key={b.id} className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
              <StatusBadge status={b.status} />
              <Link
                href={`/gorevler/${b.id}`}
                className="min-w-0 flex-1 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere] hover:text-teal-700 hover:underline"
              >
                {b.title}
              </Link>
              {canEdit && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(removeDependency(taskId, b.id))}
                  aria-label={`${b.title} ön görevini kaldır`}
                  title="Ön görevi kaldır"
                  className="-my-0.5 flex size-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50"
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Bu görevin ön görevi yok.</p>
      )}

      {canEdit && canAdd && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="dependency-add" className="sr-only">
              Ön görev olarak eklenecek görev
            </label>
            <SelectField
              id="dependency-add"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={pending || candidates.length === 0}
            >
              <option value="">
                {candidates.length ? "Ön görev seçin…" : "Eklenebilecek açık görev yok"}
              </option>
              {[...groups].map(([project, list]) => (
                <optgroup key={project} label={project}>
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectField>
          </div>
          <button
            type="button"
            disabled={pending || !selected}
            onClick={() => run(addDependency(taskId, selected), () => setSelected(""))}
            className={`${smallSecondaryButton} h-10 shrink-0 px-3.5 text-sm`}
          >
            <Plus className="size-4" /> {pending ? "Kaydediliyor…" : "Ön görev ekle"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2.5 flex items-start gap-2 text-sm text-rose-600">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {dependents.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-bold text-slate-900">Bu görevi bekleyenler</h3>
          <p className="mt-0.5 text-sm text-slate-500">Bu görev tamamlanınca başlatılabilecek görevler.</p>
          <ul className="mt-2.5 space-y-2">
            {dependents.map((d) => (
              <li key={d.id} className="flex items-center gap-2.5">
                <StatusBadge status={d.status} />
                <Link
                  href={`/gorevler/${d.id}`}
                  className="min-w-0 flex-1 text-sm font-medium text-slate-800 [overflow-wrap:anywhere] hover:text-teal-700 hover:underline"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
