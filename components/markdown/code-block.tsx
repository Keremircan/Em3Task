"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({
  language,
  children,
}: {
  language: string | null;
  children: ReactNode;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Eski tarayıcılar / güvenli olmayan bağlantılar için yedek yöntem
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="code-block theme-fixed group my-4 overflow-hidden rounded-xl border border-slate-800 bg-[#0d1424]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <span className="font-mono text-xs tracking-wide text-slate-400 uppercase">
          {language ?? "kod"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-teal-300" /> Kopyalandı
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Kopyala
            </>
          )}
        </button>
      </div>
      <pre
        ref={preRef}
        className="overflow-x-auto px-4 py-2.5 font-mono text-[12.5px] leading-relaxed text-slate-100"
      >
        {children}
      </pre>
    </div>
  );
}
