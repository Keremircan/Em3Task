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
  type LucideIcon,
} from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
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
};

type Op = { type: "read"; id: string } | { type: "readAll" };

// 🔔 bildirim merkezi: okunmamış sayısı, son bildirimler, okundu işaretleme.
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
    if (op.type === "readAll") {
      return { unread: 0, items: s.items.map((n) => (n.read_at ? n : { ...n, read_at: "now" })) };
    }
    const target = s.items.find((n) => n.id === op.id);
    if (!target || target.read_at) return s;
    return {
      unread: Math.max(0, s.unread - 1),
      items: s.items.map((n) => (n.id === op.id ? { ...n, read_at: "now" } : n)),
    };
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openItem(n: NotificationItem) {
    setOpen(false);
    startTransition(async () => {
      if (!n.read_at) {
        apply({ type: "read", id: n.id });
        await safe(markNotificationRead(n.id));
      }
    });
    router.push(n.url);
  }

  function readAll() {
    startTransition(async () => {
      apply({ type: "readAll" });
      await safe(markAllNotificationsRead());
    });
  }

  const label = state.unread ? `Bildirimler: ${state.unread} okunmamış` : "Bildirimler";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        title={label}
        className="relative flex size-8 items-center justify-center rounded-full text-neutral-300 transition hover:bg-white/[0.08] hover:text-white"
      >
        <Bell className="size-[18px]" />
        {state.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-[#141414]">
            {state.unread > 99 ? "99+" : state.unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Bildirimler"
          className={`z-[60] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl shadow-slate-900/20 ${
            variant === "mobile"
              ? "fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top))]"
              : "fixed top-14 left-4 w-[22rem]"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Bildirimler</p>
            {state.unread > 0 && (
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
            <p className="px-4 py-10 text-center text-sm text-slate-500">Henüz bildirim yok.</p>
          ) : (
            <ul className="max-h-[min(28rem,70vh)] divide-y divide-slate-100 overflow-y-auto [scrollbar-width:thin]">
              {state.items.map((n) => {
                const k = KIND[n.kind] ?? KIND.general;
                const Icon = k.icon;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${
                        n.read_at ? "" : "bg-teal-50/40"
                      }`}
                    >
                      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${k.tone}`}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13px] leading-snug ${n.read_at ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                          {n.title}
                        </span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-slate-400">
                          <RelativeTime iso={n.created_at} serverNow={serverNow} />
                        </span>
                      </span>
                      {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-teal-500" aria-label="Okunmamış" />}
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
