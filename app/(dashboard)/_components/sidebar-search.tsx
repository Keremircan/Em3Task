"use client";

import { useEffect, useRef } from "react";
import Form from "next/form";
import { Search } from "lucide-react";

// Sidebar'daki arama kutusu: görevler, yorumlar ve Genel sohbette arar (/ara).
// Ctrl+K (Mac: ⌘K) ile her sayfadan odaklanır.
export function SidebarSearch() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Form action="/ara" className="px-3 pb-3" role="search">
      <label className="relative block">
        <span className="sr-only">Ara</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-500" />
        <input
          ref={ref}
          name="q"
          type="search"
          minLength={2}
          maxLength={100}
          required
          placeholder="Ara…"
          autoComplete="off"
          className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.05] pr-12 pl-8 text-[13px] text-white outline-none placeholder:text-neutral-500 focus:border-teal-500/60 focus:bg-white/[0.08]"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-white/10 px-1.5 py-0.5 font-sans text-[10px] text-neutral-500 lg:block">
          Ctrl K
        </kbd>
      </label>
    </Form>
  );
}
