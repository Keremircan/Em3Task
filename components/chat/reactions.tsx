"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { Plus, SmilePlus } from "lucide-react";
import { toggleReaction } from "@/actions/chat-reactions";
import { safe } from "@/lib/safe-action";
import { QUICK_REACTIONS, type ReactionGroup, type ReactionTarget } from "@/lib/reactions";
import { EmojiGrid, Popover } from "./emoji-picker";

const LONG_PRESS_MS = 450;

type Me = { id: string; name: string };

// Bir emojiyi aç/kapat (sadece bu kullanıcı için)
function applyToggle(groups: ReactionGroup[], emoji: string, me: Me): ReactionGroup[] {
  const found = groups.find((g) => g.emoji === emoji);
  if (!found) return [...groups, { emoji, users: [me] }];
  const mine = found.users.some((u) => u.id === me.id);
  const users = mine ? found.users.filter((u) => u.id !== me.id) : [...found.users, me];
  return users.length
    ? groups.map((g) => (g.emoji === emoji ? { ...g, users } : g))
    : groups.filter((g) => g.emoji !== emoji);
}

function whoReacted(users: Me[], meId: string): string {
  const names = users.map((u) => (u.id === meId ? "Siz" : u.name));
  return names.length <= 8 ? names.join(", ") : `${names.slice(0, 8).join(", ")} ve ${names.length - 8} kişi daha`;
}

// Mesajı/yorumu sarar: üzerine gelince (bilgisayar) ya da uzun basınca (telefon)
// WhatsApp tarzı tepki çubuğu açılır; bırakılan tepkiler altta rozet olarak görünür.
// Tepkiler anında ekrana yansır, sunucuda kaydedilemezse geri alınır.
export function Reactable({
  target,
  messageId,
  reactions,
  me,
  children,
}: {
  target: ReactionTarget;
  messageId: string;
  reactions: ReactionGroup[];
  me: Me;
  children: ReactNode;
}) {
  const [groups, applyOptimistic] = useOptimistic(reactions, (state, emoji: string) =>
    applyToggle(state, emoji, me),
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ anchor: HTMLElement; full: boolean } | null>(null);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  function toggle(emoji: string) {
    setPicker(null);
    setError(null);
    startTransition(async () => {
      applyOptimistic(emoji);
      const result = await safe(toggleReaction({ target, messageId, emoji }));
      if (result.error) setError(result.error);
    });
  }

  // Telefonda uzun basma: parmak kaydırılırsa (sayfa kaydırma) iptal
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    const anchor = rootRef.current;
    if (!anchor) return;
    press.current = {
      x: e.clientX,
      y: e.clientY,
      fired: false,
      timer: setTimeout(() => {
        if (press.current) press.current.fired = true;
        navigator.vibrate?.(15);
        setPicker({ anchor, full: false });
      }, LONG_PRESS_MS),
    };
  }
  function cancelPress(e?: React.PointerEvent) {
    const p = press.current;
    if (!p) return;
    if (e && e.type === "pointermove" && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 10) return;
    clearTimeout(p.timer);
    if (e?.type !== "pointermove") press.current = null;
  }

  const myEmojis = new Set(groups.filter((g) => g.users.some((u) => u.id === me.id)).map((g) => g.emoji));

  return (
    <div
      ref={rootRef}
      className="group/react relative"
      onPointerDown={onPointerDown}
      onPointerMove={cancelPress}
      onPointerUp={() => cancelPress()}
      onPointerCancel={() => cancelPress()}
      onContextMenu={(e) => {
        // Uzun basma tepki çubuğunu açtıysa telefonun kendi menüsü açılmasın
        if (press.current?.fired) e.preventDefault();
      }}
    >
      {children}

      {/* Bilgisayarda üzerine gelince beliren tepki butonu */}
      <button
        type="button"
        aria-label="Tepki bırak"
        title="Tepki bırak"
        onClick={(e) => setPicker({ anchor: e.currentTarget, full: false })}
        className={`absolute -top-3 right-1 z-[1] hidden size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-amber-500 focus-visible:flex sm:flex ${
          picker ? "opacity-100" : "opacity-0 group-hover/react:opacity-100 focus-visible:opacity-100"
        }`}
      >
        <SmilePlus className="size-4" />
      </button>

      {groups.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="Tepkiler">
          {groups.map((g) => {
            const mine = myEmojis.has(g.emoji);
            return (
              <li key={g.emoji}>
                <button
                  type="button"
                  onClick={() => toggle(g.emoji)}
                  title={`${whoReacted(g.users, me.id)}${mine ? " · geri almak için tıklayın" : ""}`}
                  aria-pressed={mine}
                  aria-label={`${g.emoji} ${g.users.length} tepki: ${whoReacted(g.users, me.id)}`}
                  className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[13px] leading-none transition ${
                    mine
                      ? "border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span>{g.emoji}</span>
                  <span className="text-[11.5px] font-semibold tabular-nums">{g.users.length}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-label="Tepki ekle"
              title="Tepki ekle"
              onClick={(e) => setPicker({ anchor: e.currentTarget, full: false })}
              className="inline-flex h-6 items-center rounded-full border border-dashed border-slate-200 px-1.5 text-slate-400 transition hover:border-slate-300 hover:text-amber-500"
            >
              <SmilePlus className="size-3.5" />
            </button>
          </li>
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-rose-600">
          Tepki kaydedilemedi: {error}
        </p>
      )}

      {picker && (
        // key: hızlı çubuktan tam listeye geçince panel yeniden konumlansın
        <Popover key={picker.full ? "full" : "quick"} anchor={picker.anchor} onClose={() => setPicker(null)}>
          {picker.full ? (
            <EmojiGrid onSelect={toggle} />
          ) : (
            <div className="flex items-center gap-0.5 p-1.5" role="toolbar" aria-label="Hızlı tepki">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => toggle(e)}
                  aria-label={`${e} tepkisi`}
                  className={`flex size-10 items-center justify-center rounded-full text-2xl transition hover:scale-125 hover:bg-slate-100 ${
                    myEmojis.has(e) ? "bg-teal-50" : ""
                  }`}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPicker((p) => p && { ...p, full: true })}
                aria-label="Diğer emojiler"
                title="Diğer emojiler"
                className="ml-0.5 flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                <Plus className="size-4" />
              </button>
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}
