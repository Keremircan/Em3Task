"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Hand, Pencil, RotateCcw, Send, Trash } from "lucide-react";
import {
  acceptTask,
  completeTask,
  deleteTask,
  requestRevision,
  submitForReview,
} from "@/actions/tasks";
import { canAccept, canComplete, canRequestRevision, canSubmitForReview } from "@/lib/tasks";
import type { TaskStatus } from "@/types/database";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  smallDangerButton,
  smallGhostButton,
  smallPrimaryButton,
  smallSecondaryButton,
} from "@/components/ui/styles";
import {
  TaskFormDialog,
  type EditableTask,
  type TaskFormOptions,
} from "./task-form-dialog";
import { useOptimisticTasks, type TaskUpdate } from "./optimistic-tasks";
import { RevisionDialog } from "./revision";
import { safe } from "@/lib/safe-action";

export type ActionTask = EditableTask & {
  status: TaskStatus;
  created_by: string | null;
};

// mode:
//  "assignee" → Görevlerim: Kabul Et / Kontrole Gönder
//  "owner"    → Atadığım Görevler: Düzenle / Revize Ver / Tamamlandı / Sil
//  "detail"   → Görev detayı: kişiye göre geçerli olan tüm butonlar
export function TaskActions({
  task: serverTask,
  userId,
  mode,
  formOptions,
  afterDeleteHref,
}: {
  task: ActionTask;
  userId: string;
  mode: "assignee" | "owner" | "detail";
  formOptions?: TaskFormOptions;
  afterDeleteHref?: string;
}) {
  const router = useRouter();
  const optimistic = useOptimisticTasks();
  // İyimser güncellemedeki durum (butonlar hemen yeni duruma göre çizilir)
  const shown = optimistic?.tasks.find((t) => t.id === serverTask.id);
  const task = shown
    ? { ...serverTask, status: shown.status, assigned_to: shown.assigned_to }
    : serverTask;
  // Sunucu işlemleri sırayla yürür; butonları beklerken kilitlemeye gerek yok
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [revising, setRevising] = useState(false);

  const isOwner = task.created_by === userId;
  const showAccept = mode !== "owner" && canAccept(task, userId);
  const showReview = mode !== "owner" && canSubmitForReview(task, userId);
  const showComplete = mode !== "assignee" && isOwner && task.status !== "done";
  const completeAllowed = canComplete(task, userId);
  const showOwnerTools = mode !== "assignee" && isOwner;
  const showRevision = mode !== "assignee" && canRequestRevision(task, userId);

  // Ekranı hemen günceller, kaydı arka planda yapar. Hata olursa güncelleme
  // geri döner; uyarı sağlayıcıda gösterilir (görev başka bölüme geçtiyse bu
  // bileşen ekrandan kalkmış olabilir).
  function run(
    action: (id: string) => Promise<{ error: string | null }>,
    update: TaskUpdate,
    then?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      optimistic?.apply(update);
      const result = await safe(action(task.id));
      if (result.error) {
        if (optimistic) optimistic.report(result.error);
        else setError(result.error);
        return;
      }
      then?.();
    });
  }

  if (!showAccept && !showReview && !showComplete && !showOwnerTools) return null;

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {showAccept && (
          <button
            type="button"
            onClick={() =>
              run(acceptTask, {
                type: "status",
                id: task.id,
                status: "in_progress",
                assignedTo: userId,
              })
            }
            className={smallPrimaryButton}
          >
            <Hand className="size-4" />
            {task.assigned_to === null ? "Üstlen ve kabul et" : "Kabul Et"}
          </button>
        )}
        {showReview && (
          <button
            type="button"
            onClick={() =>
              run(submitForReview, { type: "status", id: task.id, status: "review" })
            }
            className={smallPrimaryButton}
          >
            <Send className="size-4" /> Kontrole gönder
          </button>
        )}
        {showOwnerTools && formOptions && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={smallGhostButton}
          >
            <Pencil className="size-4" /> Düzenle
          </button>
        )}
        {showRevision && (
          <button
            type="button"
            onClick={() => setRevising(true)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-amber-500 px-2.5 text-xs font-semibold text-white transition hover:bg-amber-600"
          >
            <RotateCcw className="size-4" /> Revize Ver
          </button>
        )}
        {showComplete && (
          <button
            type="button"
            disabled={!completeAllowed}
            onClick={() => run(completeTask, { type: "status", id: task.id, status: "done" })}
            title={
              completeAllowed
                ? undefined
                : "Görev, alan kişi kabul etmeden tamamlanamaz."
            }
            className={smallSecondaryButton}
          >
            <CheckCheck className="size-4" /> Tamamlandı
          </button>
        )}
        {showOwnerTools && (
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className={smallDangerButton}
          >
            <Trash className="size-4" /> Sil
          </button>
        )}
      </div>

      {showComplete && !completeAllowed && task.status === "pending" && (
        <p className="text-xs text-slate-400">Kabul edilince tamamlanabilir.</p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}

      {formOptions && editing && (
        <TaskFormDialog
          open={editing}
          onClose={() => setEditing(false)}
          options={formOptions}
          task={task}
        />
      )}
      {showRevision && (
        <RevisionDialog
          open={revising}
          onClose={() => setRevising(false)}
          taskTitle={task.title}
          onSubmit={(note) =>
            // Görev hemen "Yapılıyor"a döner; kayıt ve not arka planda
            run((id) => requestRevision(id, note), {
              type: "status",
              id: task.id,
              status: "in_progress",
            })
          }
        />
      )}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Görevi sil"
        message={`"${task.title}" görevi; yorumları ve ekleriyle birlikte kalıcı olarak silinecek.`}
        confirmLabel="Görevi sil"
        onConfirm={async () => {
          // Pencere hemen kapanır, görev listeden hemen kalkar
          run(
            deleteTask,
            { type: "delete", id: task.id },
            afterDeleteHref ? () => router.push(afterDeleteHref) : undefined,
          );
          return { error: null };
        }}
      />
    </div>
  );
}
