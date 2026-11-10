"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const asideRef = useRef<HTMLElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Çekmece açıkken: odak çekmeceye geçer, arkadaki sayfa (üst/alt çubuk, içerik)
  // klavye ve ekran okuyucu için devre dışı kalır. Kapanınca odak menü düğmesine döner.
  useEffect(() => {
    if (!open) return;
    const aside = asideRef.current;
    const openButton = openButtonRef.current;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Geniş ekrana geçilirse çekmece kavramı kalkar
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => wide.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    document.body.style.overflow = "hidden";
    const background = [...(aside?.parentElement?.children ?? [])].filter(
      (el) => el !== aside && !el.hasAttribute("data-drawer-overlay"),
    );
    background.forEach((el) => el.setAttribute("inert", ""));
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      document.body.style.overflow = "";
      background.forEach((el) => el.removeAttribute("inert"));
      if (!wide.matches) openButton?.focus();
    };
  }, [open]);

  return (
    <>
      {/* Mobil üst çubuk */}
      {/* Çentikli ekranlarda durum çubuğunun altında kalsın diye güvenli alan kadar üst boşluk */}
      <div className="theme-fixed fixed inset-x-0 top-0 z-30 flex h-[calc(3rem+env(safe-area-inset-top))] items-center gap-2.5 border-b border-white/5 bg-[#141414] px-3 pt-[env(safe-area-inset-top)] lg:hidden">
        <button
          ref={openButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          aria-expanded={open}
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
          data-drawer-overlay
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        ref={asideRef}
        aria-label="Menü"
        // Menüdeki bir linke tıklanınca mobil çekmece kapanır
        onClickCapture={(e) => {
          if ((e.target as Element).closest("a")) setOpen(false);
        }}
        className={[
          "theme-fixed fixed inset-y-0 left-0 z-50 flex w-[248px] max-w-[85vw] flex-col border-r border-white/5 bg-[#141414] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] duration-200",
          "lg:visible lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:max-w-none lg:translate-x-0",
          // Kapalıyken görünmez: ekran dışındaki bağlantılar Tab sırasına girmesin. Görünürlük
          // sadece kapanırken geçişli (kayma bitince gizlenir); açılırken hemen görünür ki
          // odak çekmeceye geçebilsin
          open ? "translate-x-0 transition-[translate]" : "invisible -translate-x-full transition-[translate,visibility]",
        ].join(" ")}
      >
        {open && (
          <button
            ref={closeButtonRef}
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
