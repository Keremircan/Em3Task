"use client";

import { useState, type KeyboardEvent, type RefObject } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { Mentionable } from "@/lib/mentions";

// İmlecin hemen önündeki "@yazı" (bir boşluğa izin verir: "@Ali Ca")
const TRIGGER = /(?:^|[\s(])@([\p{L}\p{N}._-]*(?: [\p{L}\p{N}._-]*)?)$/u;
const lower = (s: string) => s.toLocaleLowerCase("tr");

type State = { query: string; start: number; index: number } | null;

// Yazma alanında "@" ile ekip üyesi önerme. Kullanım:
//   const m = useMentions(members, textareaRef, value, setValue)
//   <textarea onKeyDown={(e) => { if (m.onKeyDown(e)) return; ... }} onSelect={m.sync} onChange={...; m.sync()} />
//   <MentionList {...m} />
export function useMentions(
  members: Mentionable[],
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  setValue: (v: string) => void,
) {
  const [state, setState] = useState<State>(null);

  const matches = state
    ? members
        .filter((m) => lower(m.name).includes(lower(state.query)))
        .sort((a, b) => {
          // Adı aranan harflerle başlayanlar önde
          const q = lower(state.query);
          return Number(!lower(b.name).startsWith(q)) - Number(!lower(a.name).startsWith(q)) || a.name.localeCompare(b.name, "tr");
        })
        .slice(0, 6)
    : [];

  function sync() {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const m = el.value.slice(0, caret).match(TRIGGER);
    if (!m) return setState(null);
    const query = m[1];
    setState((s) => ({ query, start: caret - query.length - 1, index: s && s.query === query ? s.index : 0 }));
  }

  function select(member: Mentionable) {
    const el = ref.current;
    if (!state || !el) return;
    const caret = state.start + 1 + state.query.length;
    const insert = `@${member.name} `;
    const next = value.slice(0, state.start) + insert + value.slice(caret);
    setValue(next);
    setState(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = state.start + insert.length;
      el.setSelectionRange(pos, pos);
    });
  }

  // Liste açıkken klavye: oklar seçer, Enter/Tab ekler, Esc kapatır. İşlendiyse true döner.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (!state || matches.length === 0) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setState({ ...state, index: (state.index + d + matches.length) % matches.length });
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      select(matches[state.index] ?? matches[0]);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setState(null);
      return true;
    }
    return false;
  }

  return { open: Boolean(state) && matches.length > 0, matches, index: state?.index ?? 0, select, sync, onKeyDown, close: () => setState(null) };
}

// Yazma alanının hemen üstünde açılan öneri listesi (kapsayıcı "relative" olmalı)
export function MentionList({
  open,
  matches,
  index,
  select,
}: {
  open: boolean;
  matches: Mentionable[];
  index: number;
  select: (m: Mentionable) => void;
}) {
  if (!open) return null;
  return (
    <ul
      role="listbox"
      aria-label="Kişi öner"
      className="absolute bottom-full left-0 z-30 mb-1.5 w-64 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10"
    >
      {matches.map((m, i) => (
        <li key={m.id} role="option" aria-selected={i === index}>
          <button
            type="button"
            // Yazma alanı odağını kaybetmesin
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(m)}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-slate-800 ${
              i === index ? "bg-teal-50" : "hover:bg-slate-50"
            }`}
          >
            <Avatar name={m.name} size="sm" />
            <span className="truncate">{m.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
