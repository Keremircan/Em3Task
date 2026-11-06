import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";
import { Wordmark } from "@/components/ui/wordmark";

// Giriş, şifremi unuttum ve yeni şifre sayfalarının ortak görünümü:
// ortada logo, altında başlıklı kart, en altta kısa not.
export function AuthShell({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[var(--app-canvas)] px-4 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      {/* Hafif nokta deseni: düz zemini kırar, dikkat dağıtmaz */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(15,23,42,0.07)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />

      <div className="relative w-full max-w-[360px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Logo size={40} className="rounded-[9px]" />
          <Wordmark className="text-2xl text-slate-900" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 mb-5 text-[13px] text-slate-500">{description}</p>
          {children}
        </div>

        {footer && <div className="mt-5 text-center text-xs text-slate-400">{footer}</div>}
      </div>
    </main>
  );
}

// Formlarda ortak sınıflar
export const authLabel = "mb-1.5 block text-[13px] font-medium text-slate-700";
export const authInput =
  "h-10 w-full rounded-lg border border-slate-200 bg-white pr-3 pl-9 text-sm text-slate-900 outline-none transition " +
  "placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15 " +
  "disabled:opacity-60";
export const authInputIcon = "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400";
export const authSubmit =
  "mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 active:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70";
export const authError =
  "flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700";
