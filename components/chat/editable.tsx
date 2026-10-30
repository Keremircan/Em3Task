"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { editComment } from "@/actions/task-details";
import { editGeneralMessage } from "@/actions/general";
import { safe } from "@/lib/safe-action";
import { formatDateTime } from "@/lib/format";

type Kind = "comment" | "general";

type Ctx = {
  canEdit: boolean;
  editing: boolean;
  setEditing: (v: boolean) => void;
  text: string; // güncel ham metin
  shownText: string | null; // kaydedildi, sunucudan yeni çizim gelene kadar gösterilecek metin
  editedAt: string | null;
  save: (text: string) => void;
  error: string | null;
};

const EditContext = createContext<Ctx | null>(null);

// Bir mesajı/yorumu düzenlenebilir yapar. Düzenle butonu (EditButton) ve içerik
// (EditableBody) farklı yerlerde olabilir; ikisi bu sağlayıcıyı paylaşır.
export function EditableItem({
  kind,
  id,
  content,
  editedAt,
  canEdit,
  children,
}: {
  kind: Kind;
  id: string;
  content: string;
  editedAt: string | null;
  canEdit: boolean;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [shownText, setShownText] = useState<string | null>(null);
  const [localEditedAt, setLocalEditedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sunucudan yeni içerik gelince geçici gösterimi bırak
  const [lastContent, setLastContent] = useState(content);
  if (content !== lastContent) {
    setLastContent(content);
    setShownText(null);
  }

  function save(next: string) {
    const trimmed = next.trim();
    setEditing(false);
    if (trimmed === content.trim()) return;
    setError(null);
    setShownText(trimmed);
    setLocalEditedAt(new Date().toISOString());
    startTransition(async () => {
      const result = await safe(kind === "comment" ? editComment(id, trimmed) : editGeneralMessage(id, trimmed));
      if (result.error) {
        setShownText(null);
        setLocalEditedAt(null);
        setError(result.error);
      }
    });
  }

  return (
    <EditContext.Provider
      value={{
        canEdit,
        editing,
        setEditing: (v) => {
          setError(null);
          setEditing(v);
        },
        text: shownText ?? content,
        shownText,
        editedAt: localEditedAt ?? editedAt,
        save,
        error,
      }}
    >
      {children}
    </EditContext.Provider>
  );
}

export function EditButton({ className = "" }: { className?: string }) {
  const ctx = useContext(EditContext);
  if (!ctx?.canEdit || ctx.editing) return null;
  return (
    <button
      type="button"
      onClick={() => ctx.setEditing(true)}
      aria-label="Düzenle"
      title="Düzenle"
      className={`rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 ${className}`}
    >
      <Pencil className="size-3.5" />
    </button>
  );
}

// İçerik: normalde sunucuda çizilmiş Markdown; düzenlerken yazı kutusu
export function EditableBody({ children, rich = true }: { children: ReactNode; rich?: boolean }) {
  const ctx = useContext(EditContext);
  if (!ctx) return <>{children}</>;
  return (
    <>
      {ctx.editing ? (
        <EditBox initial={ctx.text} onSave={ctx.save} onCancel={() => ctx.setEditing(false)} />
      ) : ctx.shownText !== null ? (
        <p className="text-sm whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">{ctx.shownText}</p>
      ) : (
        children
      )}
      {!ctx.editing && ctx.editedAt && (rich || ctx.text) && (
        <span className="text-[11px] text-slate-400" title={`Düzenlendi: ${formatDateTime(ctx.editedAt)}`}>
          (düzenlendi)
        </span>
      )}
      {ctx.error && (
        <p role="alert" className="text-xs font-medium text-rose-600">
          Düzenleme kaydedilemedi: {ctx.error}
        </p>
      )}
    </>
  );
}

function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (t: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  const [el, setEl] = useState<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [el]);

  return (
    <div className="space-y-2">
      <textarea
        ref={setEl}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onSave(value);
          }
        }}
        rows={3}
        maxLength={20000}
        aria-label="Metni düzenle"
        className="w-full resize-y rounded-lg border border-teal-400 bg-white px-3 py-2 text-sm text-slate-900 outline-none [field-sizing:content] focus:ring-3 focus:ring-teal-500/15"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto hidden text-[11px] text-slate-400 sm:inline">Ctrl+Enter kaydet · Esc vazgeç</span>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Vazgeç
        </button>
        <button
          type="button"
          onClick={() => onSave(value)}
          className="h-8 rounded-md bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}
