"use client";

import { useActionState, useState } from "react";
import { CircleAlert, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { login, type LoginState } from "./actions";
import {
  authError,
  authInput as inputClass,
  authInputIcon as iconClass,
  authLabel as labelClass,
  authSubmit,
} from "@/components/auth/auth-shell";

const initialState: LoginState = { error: null, email: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className={labelClass}>
          E-posta
        </label>
        <div className="relative">
          <Mail className={iconClass} />
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
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>
          Şifre
        </label>
        <div className="relative">
          <Lock className={iconClass} />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            placeholder="••••••••"
            className={`${inputClass} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {/* Şifre alanının altında: Tab sırası e-posta → şifre olarak kalsın */}
        <div className="mt-1.5 text-right">
          <Link href="/sifremi-unuttum" className="text-xs font-medium text-teal-700 hover:underline">
            Şifremi unuttum
          </Link>
        </div>
      </div>

      <p
        role="alert"
        aria-live="polite"
        className={state.error ? authError : "sr-only"}
      >
        {state.error && <CircleAlert className="mt-0.5 size-4 shrink-0" />}
        {state.error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className={authSubmit}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
