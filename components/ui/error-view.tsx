"use client";

import { useEffect, useState } from "react";
import { RotateCcw, WifiOff } from "lucide-react";
import { primaryButton } from "@/components/ui/styles";
import { reportClientError } from "@/actions/error-log";

// Sayfa yüklenirken beklenmedik bir hata olursa gösterilen ekran.
// Teknik ayrıntı gösterilmez; kullanıcıya ne yapacağı söylenir.
export function ErrorView({
  error,
  retry,
  fullScreen = false,
}: {
  error?: unknown;
  retry: () => void;
  fullScreen?: boolean;
}) {
  const [offline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);

  // Tarayıcıda oluşan hatayı Admin'in görebilmesi için kaydet. Sunucudan gelen hatalar
  // (digest taşır) sunucuda zaten kaydedilir; bağlantı yokken de denenmez.
  useEffect(() => {
    if (offline || !error || typeof error !== "object") return;
    const e = error as { message?: unknown; stack?: unknown; digest?: unknown };
    if (typeof e.digest === "string" || typeof e.message !== "string") return;
    reportClientError({
      message: e.message,
      stack: typeof e.stack === "string" ? e.stack : null,
      path: window.location.pathname,
    }).catch(() => {});
  }, [error, offline]);

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center px-6 text-center ${
        fullScreen ? "min-h-screen bg-[var(--app-canvas)]" : "flex-1 py-16"
      }`}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
        <WifiOff className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-bold text-slate-900">
        {offline ? "İnternet bağlantısı yok" : "Sayfa yüklenemedi"}
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">
        {offline
          ? "Bağlantınız geri geldiğinde tekrar deneyin."
          : "Geçici bir sorun oluştu. Tekrar deneyin; sorun sürerse biraz sonra yeniden açın."}
      </p>
      <button type="button" onClick={() => retry()} className={`${primaryButton} mt-5`}>
        <RotateCcw className="size-4" /> Tekrar dene
      </button>
    </div>
  );
}
