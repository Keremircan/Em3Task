"use client";

import { useState, useTransition } from "react";
import { CircleAlert, Paperclip, SendHorizontal, X } from "lucide-react";
import { createTask, updateTask } from "@/actions/tasks";
import { uploadAttachment } from "@/actions/task-details";
import {
  ALLOWED_ATTACHMENT_TYPES,
  ATTACHMENT_ACCEPT,
  formatBytes,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/attachments";
import { EVERYONE } from "@/lib/tasks";
import type { TaskPriority } from "@/types/database";
import { PrioritySelect } from "./priority-select";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select-field";
import { field, fieldLabel, ghostButton, primaryButton } from "@/components/ui/styles";
import { safe } from "@/lib/safe-action";

export type TaskFormOptions = {
  projects: { id: string; name: string }[];
  members: { id: string; name: string }[];
};

export type EditableTask = {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  assigned_to: string | null;
  priority: TaskPriority;
};

export function TaskFormDialog({
  open,
  onClose,
  options,
  task,
  defaultProjectId,
}: {
  open: boolean;
  onClose: () => void;
  options: TaskFormOptions;
  task?: EditableTask; // verilirse düzenleme modu
  defaultProjectId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const editing = Boolean(task);

  function close() {
    if (pending) return;
    setError(null);
    setFileErrors([]);
    setFiles([]);
    onClose();
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const problems: string[] = [];
    const valid = Array.from(list).filter((f) => {
      if (!ALLOWED_ATTACHMENT_TYPES[f.type]) {
        problems.push(`${f.name}: sadece görsel ve PDF eklenebilir.`);
        return false;
      }
      if (f.size > MAX_ATTACHMENT_BYTES) {
        problems.push(`${f.name}: en fazla 10 MB olabilir.`);
        return false;
      }
      return true;
    });
    setFileErrors(problems);
    setFiles((prev) => [...prev, ...valid]);
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      let taskId = task?.id ?? null;

      if (task) {
        const result = await safe(updateTask(task.id, formData));
        if (result.error) return setError(result.error);
      } else {
        const result = await safe(createTask(formData));
        if (result.error || !result.taskId) {
          return setError(result.error ?? "Görev kaydedilemedi.");
        }
        taskId = result.taskId;
      }

      // Görev kaydedildikten sonra dosyalar tek tek yüklenir
      const failed: string[] = [];
      for (const [i, file] of files.entries()) {
        setProgress(`Dosyalar yükleniyor (${i + 1}/${files.length})…`);
        const fd = new FormData();
        fd.append("file", file);
        const result = await safe(uploadAttachment(taskId!, fd));
        if (result.error) failed.push(`${file.name}: ${result.error}`);
      }
      setProgress(null);

      if (failed.length) {
        // Görev kaydedildi; sadece başarısız dosyaları göster
        setFiles([]);
        setFileErrors(failed);
        setError(
          editing
            ? "Görev güncellendi ama bazı dosyalar yüklenemedi."
            : "Görev oluşturuldu ama bazı dosyalar yüklenemedi. Görev detayından tekrar ekleyebilirsiniz.",
        );
        return;
      }

      setFiles([]);
      setFileErrors([]);
      onClose();
    });
  }

  const defaultProject = task?.project_id ?? defaultProjectId ?? "";
  const defaultAssignee = task ? (task.assigned_to ?? EVERYONE) : "";

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={editing ? "Görevi düzenle" : "Yeni iş ata"}
      description={
        editing
          ? "Sorumlu kişiyi değiştirirseniz görev yeniden onaya düşer."
          : "Görevi oluşturun, projesini ve sorumlusunu seçin."
      }
    >
      <form action={submit} className="space-y-4">
        <div>
          <label htmlFor="task-title" className={fieldLabel}>
            Görev adı
          </label>
          <input
            id="task-title"
            name="title"
            required
            maxLength={200}
            autoFocus
            defaultValue={task?.title}
            disabled={pending}
            placeholder="Örn. Giriş ekranı hatasını düzelt"
            className={`${field} h-10`}
          />
        </div>

        <div>
          <label htmlFor="task-description" className={fieldLabel}>
            Görev açıklaması
          </label>
          <textarea
            id="task-description"
            name="description"
            rows={5}
            defaultValue={task?.description ?? ""}
            disabled={pending}
            placeholder={"Detayları yazın. Kod için:\n```ts\nconst ornek = true;\n```"}
            className={`${field} resize-y py-2`}
          />
          <p className="mt-1.5 text-sm text-slate-400">
            Markdown desteklenir; linkler görev detayında ayrıca listelenir.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="task-project" className={fieldLabel}>
              Bağlı olduğu proje
            </label>
            <SelectField
              id="task-project"
              name="project_id"
              required
              defaultValue={defaultProject}
              disabled={pending}
            >
              <option value="" disabled>
                {options.projects.length ? "Seçiniz" : "Önce bir proje oluşturun"}
              </option>
              {options.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div>
            <label htmlFor="task-assignee" className={fieldLabel}>
              Atanacak kişi
            </label>
            <SelectField
              id="task-assignee"
              name="assigned_to"
              required
              defaultValue={defaultAssignee}
              disabled={pending}
            >
              <option value="" disabled>
                Seçiniz
              </option>
              <option value={EVERYONE}>Herkes</option>
              {options.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div>
            <label htmlFor="task-priority" className={fieldLabel}>
              Öncelik
            </label>
            <PrioritySelect
              id="task-priority"
              defaultValue={task?.priority ?? "none"}
              disabled={pending}
            />
          </div>
        </div>

        <div>
          <span className={fieldLabel}>Görseller ve dokümanlar</span>
          <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-2.5 transition hover:border-teal-300 hover:bg-teal-50/50">
            <Paperclip className="size-5 text-teal-600" />
            <span className="text-sm text-slate-600">
              Dosya ekle <span className="text-slate-400">· görsel veya PDF, en fazla 10 MB</span>
            </span>
            <input
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              disabled={pending}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              className="sr-only"
            />
          </label>
          {files.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                    {f.name}
                  </span>
                  <span className="text-slate-400">{formatBytes(f.size)}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`${f.name} dosyasını çıkar`}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fileErrors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {fileErrors.map((err, i) => (
                <li key={i} className="text-sm text-rose-600">
                  {err}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700"
          >
            <CircleAlert className="mt-0.5 size-4.5 shrink-0" /> {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          {progress && <span className="mr-auto text-sm text-slate-500">{progress}</span>}
          <button type="button" onClick={close} disabled={pending} className={ghostButton}>
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={pending || options.projects.length === 0}
            className={`${primaryButton} h-9 px-4 text-sm`}
          >
            <SendHorizontal className="size-4.5" strokeWidth={2.4} />
            {pending ? "Kaydediliyor…" : editing ? "Kaydet" : "İş ata"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
