"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { changePassword } from "@/actions/profile";
import { field, fieldLabel, ghostButton, primaryButton } from "@/components/ui/styles";
import { safe } from "@/lib/safe-action";

function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  show,
  autoFocus = false,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  show: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        required
        minLength={name === "current" ? 1 : 8}
        maxLength={72}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={`${field} h-10`}
      />
    </div>
  );
}

// Form kapalı başlar; "Şifreyi değiştir" ile açılır (sayfa kısa kalsın)
export function PasswordForm() {
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        {done ? (
          <p role="status" className="flex items-center gap-2 text-sm text-teal-700">
            <CircleCheck className="size-4 shrink-0" /> Şifreniz değiştirildi.
          </p>
        ) : (
          <p className="text-sm text-slate-500">Giriş şifrenizi buradan değiştirebilirsiniz.</p>
        )}
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setError(null);
            setOpen(true);
          }}
          className={ghostButton}
        >
          <KeyRound className="size-4" /> Şifreyi değiştir
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const current = String(data.get("current") ?? "");
        const next = String(data.get("next") ?? "");
        const repeat = String(data.get("repeat") ?? "");
        setError(null);
        setDone(false);
        if (next.length < 8) return setError("Yeni şifre en az 8 karakter olmalı.");
        if (next !== repeat) return setError("Yeni şifreler birbiriyle aynı değil.");

        setBusy(true);
        const result = await safe(changePassword(current, next));
        setBusy(false);
        if (result.error) return setError(result.error);
        form.reset();
        setDone(true);
        setShow(false);
        setOpen(false);
      }}
      className="space-y-4"
    >
      <PasswordInput id="pw-current" name="current" label="Mevcut şifre" autoComplete="current-password" show={show} autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordInput id="pw-next" name="next" label="Yeni şifre" autoComplete="new-password" show={show} />
        <PasswordInput id="pw-repeat" name="repeat" label="Yeni şifre (tekrar)" autoComplete="new-password" show={show} />
      </div>
      <p className="text-xs text-slate-400">En az 8 karakter.</p>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {show ? "Şifreleri gizle" : "Şifreleri göster"}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setShow(false);
              setError(null);
            }}
            className={ghostButton}
          >
            Vazgeç
          </button>
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Kaydet
          </button>
        </div>
      </div>
    </form>
  );
}
