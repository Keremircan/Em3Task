"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, Loader2, Mail, MailCheck } from "lucide-react";
import { requestPasswordReset, type ResetRequestState } from "./actions";
import { authError, authInput, authInputIcon, authLabel, authSubmit } from "@/components/auth/auth-shell";

const initialState: ResetRequestState = { error: null, sent: false, email: "" };

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  if (state.sent) {
    return (
      <div className="flex flex-col gap-4">
        <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-[13px] text-emerald-800">
          <MailCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">{state.email}</span> adresi kayıtlıysa şifre sıfırlama bağlantısı
            gönderildi. Gelen kutunuzu ve gereksiz (spam) klasörünü kontrol edin. Bağlantı 1 saat geçerlidir.
          </p>
        </div>
        <BackToLogin />
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className={authLabel}>
          E-posta
        </label>
        <div className="relative">
          <Mail className={authInputIcon} />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            defaultValue={state.email}
            key={state.email}
            disabled={pending}
            placeholder="ornek@em3task.app"
            className={authInput}
          />
        </div>
      </div>

      <p role="alert" aria-live="polite" className={state.error ? authError : "sr-only"}>
        {state.error && <CircleAlert className="mt-0.5 size-4 shrink-0" />}
        {state.error}
      </p>

      <button type="submit" disabled={pending} className={authSubmit}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
      </button>
      <BackToLogin />
    </form>
  );
}

function BackToLogin() {
  return (
    <Link href="/login" className="inline-flex items-center justify-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800">
      <ArrowLeft className="size-3.5" /> Giriş sayfasına dön
    </Link>
  );
}
