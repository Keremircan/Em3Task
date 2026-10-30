"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Check, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  addChecklistItem,
  deleteChecklistItem,
  renameChecklistItem,
  toggleChecklistItem,
} from "@/actions/checklist";
import { safe } from "@/lib/safe-action";
import { MAX_CHECKLIST_TITLE } from "@/lib/labels";
import { card } from "@/components/ui/styles";

type Item = { id: string; title: string; is_done: boolean };
type Op =
  | { type: "add"; item: Item }
  | { type: "toggle"; id: string; done: boolean }
  | { type: "rename"; id: string; title: string }
  | { type: "delete"; id: string };

function reduce(list: Item[], op: Op): Item[] {
  switch (op.type) {
    case "add":
      return list.some((i) => i.id === op.item.id) ? list : [...list, op.item];
    case "toggle":
      return list.map((i) => (i.id === op.id ? { ...i, is_done: op.done } : i));
    case "rename":
      return list.map((i) => (i.id === op.id ? { ...i, title: op.title } : i));
    case "delete":
      return list.filter((i) => i.id !== op.id);
  }
}

// Görevin kontrol listesi: işlemler anında ekrana yansır, kaydedilemezse geri alınır
export function TaskChecklist({
  taskId,
  items,
  canEdit,
}: {
  taskId: string;
  items: Item[];
  canEdit: boolean;
}) {
  const [list, apply] = useOptimistic(items, reduce);
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  function run(op: Op, action: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      apply(op);
      const result = await safe(action());
      if (result.error) setError(result.error);
    });
  }

  function add() {
    const title = draft.trim().replace(/\s+/g, " ");
    if (!title) return;
    const id = crypto.randomUUID();
    setDraft("");
    inputRef.current?.focus();
    run({ type: "add", item: { id, title, is_done: false } }, () => addChecklistItem(taskId, id, title));
  }

  const done = list.filter((i) => i.is_done).length;
  const percent = list.length ? Math.round((done / list.length) * 100) : 0;

  // Düzenleme yetkisi yoksa ve madde de yoksa bölüm gösterilmez
  if (!canEdit && list.length === 0) return null;

  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <ListChecks className="size-4.5 text-slate-400" /> Kontrol listesi
        </h2>
        {list.length > 0 && (
          <span className="text-sm font-semibold text-slate-500 tabular-nums">
            {done}/{list.length}
          </span>
        )}
      </div>

      {list.length > 0 && (
        <div
          className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${done}/${list.length} madde tamamlandı`}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${percent === 100 ? "bg-emerald-500" : "bg-teal-500"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <ul className="space-y-0.5">
        {list.map((item) => (
          <li key={item.id} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-slate-50">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.is_done}
              aria-label={item.title}
              disabled={!canEdit}
              onClick={() =>
                run({ type: "toggle", id: item.id, done: !item.is_done }, () =>
                  toggleChecklistItem(item.id, !item.is_done),
                )
              }
              className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition disabled:cursor-default ${
                item.is_done
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-slate-300 bg-white hover:border-teal-500"
              }`}
            >
              {item.is_done && <Check className="size-3.5" strokeWidth={3} />}
            </button>

            {editing === item.id ? (
              <EditInput
                initial={item.title}
                onCancel={() => setEditing(null)}
                onSave={(title) => {
                  setEditing(null);
                  if (title !== item.title) {
                    run({ type: "rename", id: item.id, title }, () => renameChecklistItem(item.id, title));
                  }
                }}
              />
            ) : (
              <span
                className={`min-w-0 flex-1 text-sm [overflow-wrap:anywhere] ${
                  item.is_done ? "text-slate-400 line-through" : "text-slate-800"
                }`}
              >
                {item.title}
              </span>
            )}

            {canEdit && editing !== item.id && (
              <span className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => setEditing(item.id)}
                  aria-label={`${item.title} maddesini düzenle`}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => run({ type: "delete", id: item.id }, () => deleteChecklistItem(item.id))}
                  aria-label={`${item.title} maddesini sil`}
                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="mt-2 flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_CHECKLIST_TITLE}
            placeholder={list.length ? "Madde ekle…" : "İlk maddeyi ekleyin (ör. Tasarımı onayla)"}
            aria-label="Yeni madde"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Maddeyi ekle"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white transition hover:bg-teal-700 disabled:opacity-40"
          >
            <Plus className="size-4" strokeWidth={2.5} />
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}

function EditInput({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  function save() {
    const title = value.trim().replace(/\s+/g, " ");
    if (title) onSave(title);
    else onCancel();
  }
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <input
        autoFocus
        value={value}
        maxLength={MAX_CHECKLIST_TITLE}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") onCancel();
        }}
        aria-label="Maddeyi düzenle"
        className="h-8 min-w-0 flex-1 rounded-md border border-teal-400 px-2 text-sm outline-none focus:ring-3 focus:ring-teal-500/15"
      />
      <button type="button" onClick={save} aria-label="Kaydet" className="rounded p-1 text-teal-600 hover:bg-teal-50">
        <Check className="size-4" />
      </button>
      <button type="button" onClick={onCancel} aria-label="Vazgeç" className="rounded p-1 text-slate-400 hover:bg-slate-100">
        <X className="size-4" />
      </button>
    </span>
  );
}
