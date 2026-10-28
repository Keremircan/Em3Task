"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Smile } from "lucide-react";

// Hafif emoji seçici: harici paket yok, sık kullanılan emojiler kategorilere ayrılmış.
const CATEGORIES: { name: string; icon: string; emojis: string[] }[] = [
  {
    name: "Yüzler",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🙂", "😉", "😊", "😇",
      "🥰", "😍", "🤩", "😘", "😋", "😛", "😜", "🤪", "🤗", "🤭", "🤔", "🤨",
      "😐", "😑", "😶", "🙄", "😏", "😬", "😌", "😴", "🤒", "🤯", "🥳", "😎",
      "🤓", "😕", "😟", "😮", "😯", "😲", "😳", "🥺", "😢", "😭", "😱", "😤",
      "😡", "🤬", "😈", "💀", "🤡", "🙈", "🙉", "🙊",
    ],
  },
  {
    name: "Eller",
    icon: "👍",
    emojis: [
      "👍", "👎", "👌", "🤌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
      "👇", "☝️", "✋", "👋", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪",
      "🫶", "🫡", "👀", "🧠",
    ],
  },
  {
    name: "Kalpler",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "✨", "⭐", "🌟", "💫", "🔥", "💯",
    ],
  },
  {
    name: "İş",
    icon: "💼",
    emojis: [
      "✅", "☑️", "✔️", "❌", "⚠️", "❗", "❓", "💡", "📌", "📍", "📎", "🔗",
      "📝", "📋", "📅", "⏰", "⏳", "🚀", "🎯", "🏆", "🎉", "🎊", "💼", "💻",
      "📱", "🖥️", "⌨️", "🐛", "🔧", "🛠️", "⚙️", "🔒", "🔑", "📈", "📉", "📊",
      "📁", "📂", "🗂️", "📦", "✉️", "📣",
    ],
  },
  {
    name: "Doğa",
    icon: "🌿",
    emojis: [
      "☀️", "🌤️", "⛅", "🌧️", "⛈️", "❄️", "🌈", "🌙", "🌊", "🌱", "🌿", "🍀",
      "🌸", "🌻", "🌹", "🐶", "🐱", "🦊", "🐻", "🐼", "🐵", "🦁", "🐢", "🦋",
    ],
  },
  {
    name: "Yemek",
    icon: "☕",
    emojis: [
      "☕", "🍵", "🧃", "🥤", "🍺", "🍕", "🍔", "🍟", "🌭", "🌮", "🥙", "🍝",
      "🍣", "🍩", "🍪", "🎂", "🍫", "🍿", "🍎", "🍓", "🍉", "🍌", "🥑", "🍋",
    ],
  },
];

export function EmojiGrid({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [tab, setTab] = useState(0);
  const cat = CATEGORIES[tab];
  return (
    <div className="w-[min(18.5rem,calc(100vw-2rem))]">
      <div role="tablist" className="flex gap-0.5 border-b border-slate-100 p-1.5">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.name}
            type="button"
            role="tab"
            aria-selected={i === tab}
            title={c.name}
            onClick={() => setTab(i)}
            className={`flex h-8 flex-1 items-center justify-center rounded-lg text-lg transition ${
              i === tab ? "bg-teal-50" : "hover:bg-slate-100"
            }`}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <p className="px-3 pt-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{cat.name}</p>
      <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-1.5 [scrollbar-width:thin]">
        {cat.emojis.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onSelect(e)}
            className="flex aspect-square items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-slate-100"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// Ekranın üst katmanında, tetikleyicinin yanında açılan küçük panel.
// Dışarı tıklanınca veya ESC ile kapanır; ekrana sığmazsa yönünü değiştirir.
export function Popover({
  anchor,
  onClose,
  children,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const margin = 8;
    const above = a.top - p.height - 6;
    const top = above >= margin ? above : Math.min(a.bottom + 6, window.innerHeight - p.height - margin);
    const left = Math.max(margin, Math.min(a.left + a.width / 2 - p.width / 2, window.innerWidth - p.width - margin));
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !anchor?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      style={pos ?? { top: -9999, left: -9999 }}
      className="fixed z-[70] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
    >
      {children}
    </div>,
    document.body,
  );
}

// Yazma alanının yanındaki gülen yüz butonu: seçilen emoji imlecin olduğu yere eklenir
export function EmojiButton({
  onSelect,
  className = "",
}: {
  onSelect: (emoji: string) => void;
  className?: string;
}) {
  // Açık olduğunda panelin konumlanacağı buton
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor(open ? null : e.currentTarget)}
        aria-label="Emoji ekle"
        aria-expanded={open}
        title="Emoji ekle"
        className={`flex shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-amber-500 ${
          open ? "bg-slate-100 text-amber-500" : ""
        } ${className}`}
      >
        <Smile className="size-5" />
      </button>
      {open && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <EmojiGrid onSelect={onSelect} />
        </Popover>
      )}
    </>
  );
}

// Metin kutusunda imlecin olduğu yere (seçili metin varsa onun yerine) ekler
export function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  current: string,
  insert: string,
  setValue: (v: string) => void,
) {
  if (!textarea) return setValue(current + insert);
  const start = textarea.selectionStart ?? current.length;
  const end = textarea.selectionEnd ?? current.length;
  const next = current.slice(0, start) + insert + current.slice(end);
  setValue(next);
  // Değer güncellendikten sonra imleci eklenen emojinin sonuna taşı
  requestAnimationFrame(() => {
    textarea.focus();
    const caret = start + insert.length;
    textarea.setSelectionRange(caret, caret);
  });
}
