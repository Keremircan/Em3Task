"use client";

import { useRef, useState } from "react";
import { CircleAlert, Trash } from "lucide-react";
import { ConfirmDialog } from "./confirm-dialog";

// Onay penceresi açan küçük çöp kutusu butonu.
// action: bir Server Action; args ile çağrılır (ör. [id] ya da [scope, url]).
// Onaylanınca öğe (butonun içinde bulunduğu satır) beklemeden gizlenir;
// sunucu hata döndürürse geri gelir ve hata gösterilir.
export function ConfirmDeleteButton({
  action,
  args,
  label,
  title,
  message,
  confirmLabel = "Sil",
  reveal = false,
}: {
  action: (...args: string[]) => Promise<{ error: string | null }>;
  args: string[];
  label: string; // ekran okuyucu ve ipucu metni
  title: string;
  message: string;
  confirmLabel?: string;
  reveal?: boolean; // true: sadece satırın üzerine gelince görünür (group-hover)
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  async function confirm() {
    // İyimser güncelleme: satırı hemen gizle, pencereyi hemen kapat
    const row = buttonRef.current?.closest("li");
    if (row) row.style.display = "none";
    setError(null);
    action(...args).then((result) => {
      if (result.error) {
        if (row) row.style.display = "";
        setError(result.error);
        return;
      }
      // Başarılıysa satır sunucudan gelen güncellemeyle zaten kaldırılır.
      // Gizlemeyi kısa süre sonra geri al: aynı öğe (ör. yeniden paylaşılan
      // bir link) listeye dönerse React aynı satırı kullanabilir ve gizli kalmasın.
      setTimeout(() => {
        if (row) row.style.display = "";
      }, 1500);
    });
    return { error: null };
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={label}
        title={label}
        className={`shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 ${
          reveal && !error ? "opacity-0 group-hover:opacity-100 max-md:opacity-100" : ""
        }`}
      >
        <Trash className="size-3.5" />
      </button>
      {error && (
        <span role="alert" className="inline-flex items-center gap-1 text-xs text-rose-600">
          <CircleAlert className="size-3.5" /> {error}
        </span>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        onConfirm={confirm}
      />
    </>
  );
}
