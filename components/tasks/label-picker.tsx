"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Check, Plus, Settings2, Tag, Trash2 } from "lucide-react";
import { createLabel, deleteLabel, setTaskLabel, updateLabel } from "@/actions/labels";
import { safe } from "@/lib/safe-action";
import { cleanText, LABEL_COLORS, labelColor, MAX_LABEL_NAME, type LabelLite } from "@/lib/labels";
import type { LabelColor } from "@/types/database";
import { Popover } from "@/components/chat/emoji-picker";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LabelChip } from "./label-chip";

export type PickerLabel = LabelLite & { created_by: string | null };

type State = { all: PickerLabel[]; assigned: string[] };
type Op =
  | { type: "toggle"; id: string; on: boolean }
  | { type: "create"; label: PickerLabel; assign: boolean }
  | { type: "update"; id: string; name: string; color: LabelColor }
  | { type: "delete"; id: string };

function reduce(s: State, op: Op): State {
  switch (op.type) {
    case "toggle":
      return {
        ...s,
        assigned: op.on ? [...new Set([...s.assigned, op.id])] : s.assigned.filter((x) => x !== op.id),
      };
    case "create":
      return {
        all: [...s.all, op.label],
        assigned: op.assign ? [...s.assigned, op.label.id] : s.assigned,
      };
    case "update":
      return { ...s, all: s.all.map((l) => (l.id === op.id ? { ...l, name: op.name, color: op.color } : l)) };
    case "delete":
      return { all: s.all.filter((l) => l.id !== op.id), assigned: s.assigned.filter((x) => x !== op.id) };
  }
}

// Görev detayındaki etiketler: herkes ekleyip çıkarabilir, yeni etiket oluşturabilir.
// Değişiklikler anında görünür; kaydedilemezse geri alınır.
export function LabelPicker({
  taskId,
  assignedIds,
  allLabels,
  meId,
  isAdmin,
}: {
  taskId: string;
  assignedIds: string[];
  allLabels: PickerLabel[];
  meId: string;
  isAdmin: boolean;
}) {
  const [state, apply] = useOptimistic<State, Op>({ all: allLabels, assigned: assignedIds }, reduce);
  const [, startTransition] = useTransition();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [managing, setManaging] = useState(false);
  const [query, setQuery] = useState("");
  const [newColor, setNewColor] = useState<LabelColor>("teal");
  const [error, setError] = useState<string | null>(null);

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

  const sorted = [...state.all].sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const assigned = sorted.filter((l) => state.assigned.includes(l.id));
  const q = cleanText(query, MAX_LABEL_NAME);
  const filtered = q ? sorted.filter((l) => l.name.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))) : sorted;
  const exact = sorted.some((l) => l.name.toLocaleLowerCase("tr") === q.toLocaleLowerCase("tr"));

  function create() {
    if (!q || exact) return;
    const label: PickerLabel = { id: crypto.randomUUID(), name: q, color: newColor, created_by: meId };
    setQuery("");
    run({ type: "create", label, assign: true }, () =>
      createLabel({ id: label.id, name: label.name, color: label.color, taskId }),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assigned.map((l) => (
        <LabelChip key={l.id} label={l} />
      ))}
      <button
        type="button"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        aria-expanded={Boolean(anchor)}
        className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 text-xs font-semibold text-slate-500 transition hover:border-teal-400 hover:text-teal-700"
      >
        <Tag className="size-3.5" /> {assigned.length ? "Etiketler" : "Etiket ekle"}
      </button>
      {error && (
        <span role="alert" className="text-xs font-medium text-rose-600">
          {error}
        </span>
      )}

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <div className="w-[min(17rem,calc(100vw-2rem))]">
            <div className="border-b border-slate-100 p-2">
              <input
                autoFocus
                value={query}
                maxLength={MAX_LABEL_NAME}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filtered.length === 1 && exact) {
                      const l = filtered[0];
                      const on = !state.assigned.includes(l.id);
                      run({ type: "toggle", id: l.id, on }, () => setTaskLabel(taskId, l.id, on));
                      setQuery("");
                    } else create();
                  }
                }}
                placeholder="Etiket ara ya da oluştur…"
                aria-label="Etiket ara ya da oluştur"
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto p-1 [scrollbar-width:thin]">
              {filtered.map((l) => {
                const on = state.assigned.includes(l.id);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => run({ type: "toggle", id: l.id, on: !on }, () => setTaskLabel(taskId, l.id, !on))}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                      aria-pressed={on}
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                          on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300"
                        }`}
                      >
                        {on && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <LabelChip label={l} />
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && !q && (
                <li className="px-2 py-3 text-center text-xs text-slate-400">Henüz etiket yok. Yukarıya bir ad yazın.</li>
              )}
            </ul>
            {q && !exact && (
              <div className="border-t border-slate-100 p-2">
                <div className="mb-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Etiket rengi">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      role="radio"
                      aria-checked={newColor === c.key}
                      title={c.name}
                      onClick={() => setNewColor(c.key)}
                      className={`size-5 rounded-full ${c.dot} ${newColor === c.key ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={create}
                  className="flex w-full items-center gap-1.5 rounded-md bg-teal-600 px-2.5 py-1.5 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  <Plus className="size-4" /> <span className="truncate">“{q}” etiketini oluştur</span>
                </button>
              </div>
            )}
            {sorted.length > 0 && (
              <div className="border-t border-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAnchor(null);
                    setManaging(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  <Settings2 className="size-3.5" /> Etiketleri yönet
                </button>
              </div>
            )}
          </div>
        </Popover>
      )}

      <Modal
        open={managing}
        onClose={() => setManaging(false)}
        size="sm"
        title="Etiketleri yönet"
        description="Ad ve rengi herkes değiştirebilir; etiketi oluşturan kişi ya da Admin silebilir."
      >
        <ul className="space-y-2">
          {sorted.map((l) => (
            <ManageRow
              key={l.id}
              label={l}
              canDelete={isAdmin || l.created_by === meId}
              onSave={(name, color) => run({ type: "update", id: l.id, name, color }, () => updateLabel(l.id, name, color))}
              onDelete={() => run({ type: "delete", id: l.id }, () => deleteLabel(l.id))}
            />
          ))}
        </ul>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-600">
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}

function ManageRow({
  label,
  canDelete,
  onSave,
  onDelete,
}: {
  label: PickerLabel;
  canDelete: boolean;
  onSave: (name: string, color: LabelColor) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState<LabelColor>(label.color);
  const [confirming, setConfirming] = useState(false);
  const clean = cleanText(name, MAX_LABEL_NAME);
  const dirty = clean !== label.name || color !== label.color;

  return (
    <li className="rounded-lg border border-slate-200 p-2.5">
      <div className="flex items-center gap-2">
        <span className={`size-3 shrink-0 rounded-full ${labelColor(color).dot}`} />
        <input
          value={name}
          maxLength={MAX_LABEL_NAME}
          onChange={(e) => setName(e.target.value)}
          aria-label="Etiket adı"
          className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-teal-500"
        />
        <button
          type="button"
          disabled={!dirty || !clean}
          onClick={() => onSave(clean, color)}
          className="h-8 rounded-md bg-teal-600 px-2.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
        >
          Kaydet
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`${label.name} etiketini sil`}
            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label={`${label.name} rengi`}>
        {LABEL_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={color === c.key}
            title={c.name}
            onClick={() => setColor(c.key)}
            className={`size-4.5 rounded-full ${c.dot} ${color === c.key ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}
          />
        ))}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Etiketi sil"
        message={`“${label.name}” etiketi silinecek ve tüm görevlerden kaldırılacak.`}
        confirmLabel="Etiketi sil"
        onConfirm={async () => {
          onDelete();
          return { error: null };
        }}
      />
    </li>
  );
}
