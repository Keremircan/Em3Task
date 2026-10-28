import Link from "next/link";
import {
  ArrowRightLeft,
  CircleCheck,
  CirclePlus,
  FolderPlus,
  History,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ZoomableAvatar } from "@/components/ui/avatar-lightbox";
import { card } from "@/components/ui/styles";
import type { ActivityAction } from "@/types/database";
import { RelativeTime } from "./relative-time";

export const ACTIVITY_LIMIT = 10; // veritabanı da sadece son 10 kaydı tutar (etkinlik-siniri.sql)

const ACTIONS: Record<ActivityAction, { verb: string; icon: LucideIcon; tone: string }> = {
  task_created: { verb: "yeni görev açtı", icon: CirclePlus, tone: "bg-sky-500" },
  task_reassigned: { verb: "görevi yeniden atadı", icon: ArrowRightLeft, tone: "bg-violet-500" },
  task_accepted: { verb: "görevi kabul etti", icon: Play, tone: "bg-teal-500" },
  task_submitted: { verb: "görevi kontrole gönderdi", icon: Send, tone: "bg-amber-500" },
  task_revision: { verb: "revize istedi", icon: RotateCcw, tone: "bg-orange-500" },
  task_completed: { verb: "görevi tamamladı", icon: CircleCheck, tone: "bg-emerald-500" },
  task_deleted: { verb: "görevi sildi", icon: Trash2, tone: "bg-rose-500" },
  comment_added: { verb: "yorum yaptı", icon: MessageSquare, tone: "bg-slate-500" },
  project_created: { verb: "yeni proje oluşturdu", icon: FolderPlus, tone: "bg-indigo-500" },
};

// Ana sayfadaki "Son etkinlikler": ekibin son işlemleri, en yeni üstte.
// Görev/yorum değişince sayfa canlı olarak yenilendiği için akış da güncellenir.
export async function ActivityFeed() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select(
      `id, action, title, task_id, project_id, target_id, created_at,
       actor:profiles!activity_log_actor_id_fkey(full_name, avatar_url),
       target:profiles!activity_log_target_id_fkey(full_name)`,
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(ACTIVITY_LIMIT);

  // eslint-disable-next-line react-hooks/purity -- istek anındaki saat bilerek kullanılıyor
  const serverNow = Date.now();
  const items = data ?? [];

  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 sm:text-base">
          <History className="size-4.5 text-slate-400" /> Son etkinlikler
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Canlı
        </span>
      </div>

      {error ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          Etkinlikler yüklenemedi.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          Henüz etkinlik yok. Görev açıldığında, yorum yapıldığında burada görünür.
        </p>
      ) : (
        <ol className="relative">
          {/* Zaman tüneli çizgisi */}
          <span aria-hidden className="absolute top-3 bottom-3 left-[15px] w-px bg-slate-100" />
          {items.map((a) => {
            const meta = ACTIONS[a.action];
            const Icon = meta.icon;
            const name = a.actor?.full_name || "Eski üye";
            const href = a.task_id
              ? `/gorevler/${a.task_id}`
              : a.action === "project_created" && a.project_id
                ? `/projeler/${a.project_id}`
                : null;
            const showTarget = a.action === "task_created" || a.action === "task_reassigned";
            const targetName = a.target_id ? (a.target?.full_name ?? "Eski üye") : "Herkes";

            return (
              <li key={a.id} className="relative flex gap-3 py-2">
                <span className="relative z-[1] shrink-0">
                  <ZoomableAvatar name={name} src={a.actor?.avatar_url} size="sm" className="size-8 ring-2 ring-white" />
                  <span
                    className={`absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full ring-2 ring-white ${meta.tone}`}
                  >
                    <Icon className="size-2.5 text-white" strokeWidth={2.6} />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2 text-[13px] leading-snug text-slate-600">
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-900">{name}</span> {meta.verb}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      <RelativeTime iso={a.created_at} serverNow={serverNow} />
                    </span>
                  </p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px]">
                    {href ? (
                      <Link
                        href={href}
                        className="truncate font-medium text-teal-700 hover:underline"
                        title={a.title}
                      >
                        {a.title || "Görev"}
                      </Link>
                    ) : (
                      <span className="truncate text-slate-400 line-through" title={a.title}>
                        {a.title || "Görev"}
                      </span>
                    )}
                    {showTarget && (
                      <span className="shrink-0 text-xs text-slate-400">→ {targetName}</span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <section className={`${card} p-4 sm:p-5`} aria-hidden>
      <div className="mb-4 h-5 w-36 animate-pulse rounded bg-slate-100" />
      <div className="space-y-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <div className="size-8 animate-pulse rounded-full bg-slate-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
