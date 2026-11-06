"use client";

import { useActionState, useState } from "react";
import { CircleAlert, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { setNewPassword, type NewPasswordState } from "./actions";
import { authError, authInput, authInputIcon, authLabel, authSubmit } from "@/components/auth/auth-shell";

const initialState: NewPasswordState = { error: null };

export function NewPasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(setNewPassword, initialState);
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Şifre yöneticileri yeni şifreyi doğru hesaba kaydetsin */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />

      {(["password", "confirm"] as const).map((name, i) => (
        <div key={name}>
          <label htmlFor={name} className={authLabel}>
            {i === 0 ? "Yeni şifre" : "Yeni şifre (tekrar)"}
          </label>
          <div className="relative">
            <Lock className={authInputIcon} />
            <input
              id={name}
              name={name}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              autoFocus={i === 0}
              disabled={pending}
              className={`${authInput} pr-10`}
            />
            {i === 0 && (
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
          </div>
        </div>
      ))}
      <p className="-mt-2 text-xs text-slate-400">En az 8 karakter.</p>

      <p role="alert" aria-live="polite" className={state.error ? authError : "sr-only"}>
        {state.error && <CircleAlert className="mt-0.5 size-4 shrink-0" />}
        {state.error}
      </p>

      <button type="submit" disabled={pending} className={authSubmit}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Kaydediliyor…" : "Şifreyi kaydet ve devam et"}
      </button>
    </form>
  );
}
