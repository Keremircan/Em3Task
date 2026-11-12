"use client";

import { useState } from "react";
import { Trash } from "lucide-react";
import { clearErrorLog } from "@/actions/error-log";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ghostButton } from "@/components/ui/styles";
import { safe } from "@/lib/safe-action";

export function ClearErrorsButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={ghostButton}>
        <Trash className="size-4" /> Kayıtları temizle
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Hata kayıtlarını temizle"
        message={`Listedeki ${count} kayıt ve varsa daha eskileri kalıcı olarak silinecek.`}
        confirmLabel="Kayıtları sil"
        onConfirm={() => safe(clearErrorLog())}
      />
    </>
  );
}
