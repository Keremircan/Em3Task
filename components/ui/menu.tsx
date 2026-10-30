"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
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
      if (e.key === "Escape") setOpen(false);
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

  const panel =
    tone === "dark"
      ? "theme-fixed border-white/10 bg-[#1f1f1f] text-neutral-200 shadow-black/40"
      : "border-slate-200 bg-white text-slate-700 shadow-slate-900/10";
  const itemHover = tone === "dark" ? "hover:bg-white/8" : "hover:bg-slate-50";

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
          style={pos}
          className={`fixed z-[60] min-w-48 overflow-hidden rounded-xl border p-1 shadow-xl ${panel}`}
        >
          {header}
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${itemHover} ${
                item.danger ? "text-rose-500" : ""
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>,
          document.body,
        )}
    </div>
  );
}