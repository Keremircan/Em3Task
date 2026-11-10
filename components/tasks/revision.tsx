"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { MAX_REVISION_NOTE } from "@/lib/tasks";
import type { TaskStatus } from "@/types/database";
import { useOptimisticTasks } from "./optimistic-tasks";
import { Modal } from "@/components/ui/modal";
import { field, fieldLabel, ghostButton } from "@/components/ui/styles";

// Görev en az bir kez revize edildiyse gösterilen etiket ("Revize 2" gibi)
export function RevisionBadge({ count, size = "sm" }: { count: number; size?: "xs" | "sm" }) {
  if (!count) return null;
  return (
    <span
      title={`${count} kez revize istendi`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-50 font-bold whitespace-nowrap text-amber-700 ring-1 ring-amber-200 ring-inset ${
        size === "xs" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <RotateCcw className="size-3" strokeWidth={2.6} />
      Revize{count > 1 ? ` ${count}` : ""}
    </span>
  );
}

// Revize ver penceresi: isteğe bağlı not yazılır; onaylanınca pencere hemen kapanır
export function RevisionDialog({
  open,
  onClose,
  taskTitle,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  taskTitle: string;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Revize ver"
      description={`"${taskTitle}" tekrar "Yapılıyor"a döner; görevi alan kişi düzeltip yeniden kontrole gönderir.`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(note);
          setNote("");
          onClose();
        }}
      >
        <label htmlFor="revision-note" className={fieldLabel}>
          Neyin düzeltilmesi gerekiyor? <span className="font-normal text-slate-400">(isteğe bağlı)</span>
        </label>
        <textarea
          id="revision-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={MAX_REVISION_NOTE}
          placeholder="Örn. Giriş ekranında hata mesajı görünmüyor."
          className={`${field} resize-y py-2.5`}
        />
        <p className="mt-1.5 text-xs text-slate-400">Not, görevin yorumlarına eklenir.</p>
        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className={ghostButton}>
            Vazgeç
          </button>
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-amber-700 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800"
          >
            <RotateCcw className="size-4" strokeWidth={2.4} /> Revize ver
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Görev detayında: revize verildikten sonra ("Yapılıyor"a dönmüş görev) bilgi kutusu.
// İyimser durumu okur; Revize ver'e basılınca hemen görünür.
export function RevisionNotice({
  id,
  status,
  revisionCount,
  isAssignee,
}: {
  id: string;
  status: TaskStatus;
  revisionCount: number;
  isAssignee: boolean;
}) {
  const current = useOptimisticTasks()?.tasks.find((t) => t.id === id)?.status ?? status;
  const justRevised = status === "review" && current === "in_progress";
  if (current !== "in_progress" || (!revisionCount && !justRevised)) return null;
  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200 ring-inset">
      <RotateCcw className="mt-0.5 size-4 shrink-0" />
      <span>
        {isAssignee
          ? "Revize istendi. Düzeltmeleri yapıp görevi yeniden kontrole gönderin."
          : "Revize verildi; görevi alan kişi düzeltip yeniden kontrole gönderecek."}{" "}
        <a href="#yorumlar" className="font-semibold underline underline-offset-2">
          Revize notu
        </a>
      </span>
    </p>
  );
}
