"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Bell,
  CalendarClock,
  CheckCheck,
  ClipboardList,
  Lock,
  MessageSquare,
  MessagesSquare,
  RotateCcw,
  Send,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { clearAllNotifications, dismissNotification } from "@/actions/notifications";
import { safe } from "@/lib/safe-action";
import { RelativeTime } from "@/components/home/relative-time";
import type { NotificationItem } from "@/lib/notifications";

const KIND: Record<string, { icon: LucideIcon; tone: string }> = {
  task: { icon: ClipboardList, tone: "bg-sky-100 text-sky-700" },
  review: { icon: Send, tone: "bg-amber-100 text-amber-700" },
  revision: { icon: RotateCcw, tone: "bg-orange-100 text-orange-700" },
  comment: { icon: MessageSquare, tone: "bg-slate-100 text-slate-600" },
  mention: { icon: AtSign, tone: "bg-violet-100 text-violet-700" },
  general: { icon: MessagesSquare, tone: "bg-teal-100 text-teal-700" },
  dm: { icon: Lock, tone: "bg-amber-100 text-amber-800" },
  due: { icon: CalendarClock, tone: "bg-rose-100 text-rose-700" },
  subscription: { icon: WalletCards, tone: "bg-emerald-100 text-emerald-700" },
};

type Op = { type: "remove"; id: string } | { type: "clear" };

// 🔔 bildirim merkezi: okunmamış bildirimler ve sayısı. Okunan bildirim silinir:
// üstüne tıklayınca (ilgili sayfa açılır), × ile ya da "Tümünü okundu say" ile.
// Yeni bildirim gelince canlı güncelleme sayfayı yeniler ve sayı artar.
export function NotificationBell({
  items,
  unread,
  serverNow,
  variant = "sidebar",
}: {
  items: NotificationItem[];
  unread: number;
  serverNow: number;
  variant?: "sidebar" | "mobile";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [state, apply] = useOptimistic({ items, unread }, (s, op: Op) => {
    if (op.type === "clear") return { unread: 0, items: [] };
    if (!s.items.some((n) => n.id === op.id)) return s;
    return { unread: Math.max(0, s.unread - 1), items: s.items.filter((n) => n.id !== op.id) };
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Odak paneldeyse zile dönsün (panel kapanınca kaybolmasın)
      if (rootRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function dismiss(id: string) {
    startTransition(async () => {
      apply({ type: "remove", id });
      await safe(dismissNotification(id));
    });
  }

  function openItem(n: NotificationItem) {
    setOpen(false);
    dismiss(n.id);
    router.push(n.url);
  }

  function readAll() {
    startTransition(async () => {
      apply({ type: "clear" });
      await safe(clearAllNotifications());
    });
  }

  const label = state.unread ? `Bildirimler: ${state.unread} okunmamış` : "Bildirimler";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        title={label}
        className="relative flex size-8 items-center justify-center rounded-full text-neutral-300 transition hover:bg-white/[0.08] hover:text-white"
      >
        <Bell className="size-[18px]" />
        {state.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-[#141414]">
            {state.unread > 99 ? "99+" : state.unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Bildirimler"
          className={`theme-follow z-[60] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl shadow-slate-900/20 ${
            variant === "mobile"
              ? "fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top))]"
              : "fixed top-14 left-4 w-[22rem]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Bildirimler</p>
            {state.items.length > 0 && (
              <button
                type="button"
                onClick={readAll}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50"
              >
                <CheckCheck className="size-3.5" /> Tümünü okundu say
              </button>
            )}
          </div>
          {state.items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">Yeni bildirim yok.</p>
          ) : (
            <ul className="max-h-[min(28rem,70vh)] divide-y divide-slate-100 overflow-y-auto [scrollbar-width:thin]">
              {state.items.map((n) => {
                const k = KIND[n.kind] ?? KIND.general;
                const Icon = k.icon;
                return (
                  <li key={n.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className="flex w-full gap-3 py-3 pr-11 pl-4 text-left transition hover:bg-slate-50"
                    >
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${k.tone}`}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-snug font-semibold text-slate-900">{n.title}</span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-slate-400">
                          <RelativeTime iso={n.created_at} serverNow={serverNow} />
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(n.id)}
                      aria-label={`Okundu say: ${n.title}`}
                      title="Okundu say"
                      className="absolute top-2.5 right-2.5 flex size-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
