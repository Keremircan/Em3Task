"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  // Verilirse onay kutulu seçenek olur: tıklayınca menü açık kalır (çoklu seçim)
  checked?: boolean;
};

// Küçük açılır menü: dışarı tıklayınca veya Esc ile kapanır
export function Menu({
  trigger,
  label,
  items,
  align = "right",
  tone = "light",
  triggerClassName = "",
  header,
}: {
  trigger: ReactNode;
  label: string;
  items: MenuItem[];
  align?: "left" | "right";
  tone?: "light" | "dark";
  triggerClassName?: string;
  header?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Panel ekrana sabitlenir; kaydırılabilir kapların içinde kesilmesin diye
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function toggle() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPos(
        align === "right"
          ? { top: rect.bottom + 6, right: window.innerWidth - rect.right }
          : { top: rect.bottom + 6, left: rect.left },
      );
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Odak menüdeyse açan düğmeye geri dönsün (kaybolup sayfanın başına düşmesin)
      if (panelRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Açılınca odak ilk seçeneğe geçer: menü sayfanın sonuna eklendiği için
  // klavyeyle Tab'la ulaşılamazdı
  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("[role^=menuitem]")?.focus({ preventScroll: true });
  }, [open]);

  // Menü içinde ok tuşları, Home/End; Tab menüyü kapatıp sayfada sıradaki öğeye geçer
  function onPanelKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Tab") {
      buttonRef.current?.focus();
      setOpen(false);
    }
  }

  const panel =
    tone === "dark"
      ? "theme-fixed border-white/10 bg-[#1f1f1f] text-neutral-200 shadow-black/40"
      : "border-slate-200 bg-white text-slate-700 shadow-slate-900/10";
  const itemHover =
    tone === "dark" ? "hover:bg-white/8 focus-visible:bg-white/8" : "hover:bg-slate-50 focus-visible:bg-slate-50";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
        <div
          ref={panelRef}
          role="menu"
          aria-label={label}
          onKeyDown={onPanelKey}
          style={pos}
          className={`fixed z-[60] min-w-48 overflow-hidden rounded-xl border p-1 shadow-xl ${panel}`}
        >
          {header}
          {items.map((item) => {
            const checkable = item.checked !== undefined;
            return (
              <button
                key={item.label}
                type="button"
                role={checkable ? "menuitemcheckbox" : "menuitem"}
                aria-checked={checkable ? item.checked : undefined}
                tabIndex={-1}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!checkable) {
                    // Odak açan düğmeye döner; seçenek bir pencere açarsa odak oraya geçer
                    buttonRef.current?.focus();
                    setOpen(false);
                  }
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${itemHover} ${
                  item.danger ? (tone === "dark" ? "text-rose-400" : "text-rose-600") : ""
                }`}
              >
                {checkable && (
                  <span
                    aria-hidden
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      item.checked ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300"
                    }`}
                  >
                    {item.checked && <Check className="size-3" strokeWidth={3.2} />}
                  </span>
                )}
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>,
          document.body,
        )}
    </div>
  );
}