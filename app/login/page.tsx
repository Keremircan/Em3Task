import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Giriş Yap · Em3Task",
};

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-[var(--app-canvas)] px-4 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      {/* Hafif nokta deseni: düz zemini kırar, dikkat dağıtmaz */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(15,23,42,0.07)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />

      <div className="relative w-full max-w-[360px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Logo size={28} className="rounded-[7px]" />
          <span className="text-base font-semibold tracking-tight text-slate-900">Em3Task</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Giriş yapın</h1>
          <p className="mt-1 mb-5 text-[13px] text-slate-500">
            Devam etmek için ekip hesabınızı kullanın.
          </p>
          <LoginForm />
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          Hesaplar yönetici tarafından oluşturulur.
        </p>
      </div>
    </main>
  );
}
