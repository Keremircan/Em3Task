"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Link2, Plus } from "lucide-react";
import { MAX_PROJECT_URL, parseProjectUrl } from "@/lib/project-url";
import { createProject, renameProject } from "@/actions/projects";
import { Modal } from "@/components/ui/modal";
import { field, fieldLabel, ghostButton, primaryButton } from "@/components/ui/styles";
import { safe } from "@/lib/safe-action";

// Yeni proje oluşturma ve mevcut projeyi düzenleme (ad + isteğe bağlı link) penceresi.
// onCreate verilirse oluşturma iyimserdir: pencere hemen kapanır, kaydı çağıran taraf yapar.
export function NewProjectDialog({
  open,
  onClose,
  project,
  onCreate,
  defaultName,
  defaultLink,
  initialError = null,
}: {
  open: boolean;
  onClose: () => void;
  project?: { id: string; name: string; url?: string | null };
  onCreate?: (name: string, link: string) => void;
  defaultName?: string; // başarısız denemeden sonra yeniden açılınca
  defaultLink?: string;
  initialError?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError);
  const renaming = Boolean(project);

  function close() {
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title={renaming ? "Projeyi düzenle" : "Yeni proje"}
      description={
        renaming ? undefined : "Projeye bir ad verin; görevleri bu proje altında toplayacaksınız."
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const name = String(form.get("name") ?? "");
          const link = String(form.get("url") ?? "");
          setError(null);
          // Link hatası pencere kapanmadan gösterilsin
          const checked = parseProjectUrl(link);
          if ("error" in checked) return setError(checked.error);
          if (!project && onCreate) {
            if (!name.trim()) return setError("Proje adı zorunludur.");
            close();
            onCreate(name, link);
            return;
          }
          startTransition(async () => {
            const result = project
              ? await safe(renameProject(project.id, name, link))
              : await safe(createProject(name, undefined, link));
            if (result.error) {
              setError(result.error);
              return;
            }
            close();
            if (!project && result.projectId) router.push(`/projeler/${result.projectId}`);
          });
        }}
      >
        <label htmlFor="project-name" className={fieldLabel}>
          Proje adı
        </label>
        <input
          id="project-name"
          name="name"
          required
          maxLength={80}
          autoFocus
          defaultValue={project?.name ?? defaultName}
          disabled={pending}
          placeholder="Örn. E-Evrak Sistemi"
          className={`${field} h-10`}
        />
        <label htmlFor="project-url" className={`${fieldLabel} mt-4`}>
          Proje linki <span className="font-normal text-slate-400">(isteğe bağlı)</span>
        </label>
        <div className="relative">
          <Link2 className="pointer-events-none absolute top-1/2 left-3 mt-[3px] size-4 -translate-y-1/2 text-slate-400" />
          <input
            id="project-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            maxLength={MAX_PROJECT_URL}
            defaultValue={project?.url ?? defaultLink}
            disabled={pending}
            placeholder="https://github.com/ekip/proje"
            className={`${field} h-10 pl-9`}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
          >
            <CircleAlert className="size-4 shrink-0" /> {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2.5">
          <button type="button" onClick={close} className={ghostButton}>
            Vazgeç
          </button>
          <button type="submit" disabled={pending} className={`${primaryButton} h-9 px-4 text-sm`}>
            {!renaming && <Plus className="size-4.5" strokeWidth={2.4} />}
            {pending ? "Kaydediliyor…" : renaming ? "Kaydet" : "Oluştur"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
