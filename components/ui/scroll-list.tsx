"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Uzun listeler için: ilk `visible` öğe görünür, gerisi liste içinde kaydırılır.
// Öğe boyları farklı olabileceği için (ör. resim önizlemeli ekler) yükseklik
// ilk `visible` öğeye göre ölçülür; bir sonraki öğenin ucu görünür kalır ki
// devamı olduğu anlaşılsın.
const PEEK = 24;

export function ScrollList({
  children,
  count,
  visible = 5,
  className = "space-y-2",
  label,
}: {
  children: ReactNode;
  count: number;
  visible?: number;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const scrolls = count > visible;

  useLayoutEffect(() => {
    const ul = ref.current;
    if (!ul || !scrolls) return;
    const measure = () => {
      const last = ul.children[visible - 1] as HTMLElement | undefined;
      if (last) setMaxHeight(last.offsetTop + last.offsetHeight + PEEK);
    };
    measure();
    // Resimler yüklenince ya da genişlik değişince yeniden ölç
    const ro = new ResizeObserver(measure);
    for (const el of Array.from(ul.children).slice(0, visible)) ro.observe(el);
    return () => ro.disconnect();
  }, [scrolls, visible, count]);

  if (!scrolls) return <ul className={className}>{children}</ul>;

  return (
    <>
      <ul
        ref={ref}
        aria-label={label}
        // Klavyeyle de kaydırılabilsin
        tabIndex={0}
        style={{ maxHeight: maxHeight ?? "22rem" }}
        className={`${className} relative overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 rounded-xl`}
      >
        {children}
      </ul>
      <p className="mt-2 text-center text-xs text-slate-400">
        {count} öğeden {visible} tanesi görünüyor · devamı için listeyi kaydırın
      </p>
    </>
  );
}
