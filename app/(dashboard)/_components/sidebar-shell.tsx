"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";

// Masaüstünde sabit sol menü; mobilde soldan açılan çekmece
export function SidebarShell({
  children,
  mobileTitle,
  mobileActions,
}: {
  children: ReactNode;
  mobileTitle: ReactNode; // mobil üst çubukta aktif sayfanın başlığı
  mobileActions?: ReactNode; // mobil üst çubuğun sağı (ör. bildirim zili)
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Mobil üst çubuk */}
      {/* Çentikli ekranlarda durum çubuğunun altında kalsın diye güvenli alan kadar üst boşluk */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-[calc(3rem+env(safe-area-inset-top))] items-center gap-2.5 border-b border-white/5 bg-[#141414] px-3 pt-[env(safe-area-inset-top)] lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          className="rounded-lg p-1.5 text-neutral-300 hover:bg-white/8"
        >
          <Menu className="size-5" />
        </button>
        <Logo size={22} className="shrink-0 rounded-[6px]" />
        <span className="flex min-w-0 flex-1">{mobileTitle}</span>
        {mobileActions}
      </div>

      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        // Menüdeki bir linke tıklanınca mobil çekmece kapanır
        onClickCapture={(e) => {
          if ((e.target as Element).closest("a")) setOpen(false);
        }}
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[248px] max-w-[85vw] flex-col border-r border-white/5 bg-[#141414] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-transform duration-200",
          "lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:max-w-none lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Menüyü kapat"
            className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] -right-12 rounded-lg p-1.5 text-white lg:hidden"
          >
            <X className="size-6" />
          </button>
        )}
        {children}
      </aside>
    </>
  );
}
