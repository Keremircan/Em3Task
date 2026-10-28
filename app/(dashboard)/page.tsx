import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  ClipboardClock,
  FolderKanban,
  Users,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { card } from "@/components/ui/styles";
import { StatusBadge } from "@/components/tasks/status-badge";
import type { TaskPriority, TaskStatus } from "@/types/database";
import { PriorityBadge } from "@/components/tasks/priority";
import { PageHeader } from "./_components/page-header";
import { ActivityFeed, ActivityFeedSkeleton } from "@/components/home/activity-feed";

export default function HomePage() {
  return (
    <>
      <PageHeader title="Ana sayfa" />

      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>

      {/* Geniş ekranda solda bekleyen işler + nasıl çalışır, sağda etkinlik akışı.
          Dar ekranda sıra: bekleyen işler → etkinlikler → nasıl çalışır */}
      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* Sol sütun: dar ekranda "contents" ile kendi çocukları ızgaraya dağılır (sıralama için) */}
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-4">
          <div className="order-1 min-w-0">
            <Suspense fallback={<div className={`${card} h-64 animate-pulse`} />}>
              <Inbox />
            </Suspense>
          </div>
          <HowItWorks />
        </div>

        <div className="order-2 min-w-0 xl:order-none">
          <Suspense fallback={<ActivityFeedSkeleton />}>
            <ActivityFeed />
          </Suspense>
        </div>
      </div>
    </>
  );
}

function HowItWorks() {
  return (
    <section className={`${card} order-3 p-5`}>
      <h2 className="text-base font-bold text-slate-900">Nasıl çalışır?</h2>
      <ol className="mt-3 grid grid-cols-1 gap-3 text-[13.5px] text-slate-600 md:grid-cols-2">
        <Step n={1} title="İş ata">
          Atadığım Görevler’den projesini ve kişisini seçerek işi oluşturun. Görev “Onay Bekliyor”
          olarak başlar.
        </Step>
        <Step n={2} title="Kabul et">
          Görevi alan kişi Görevlerim’den kabul eder, görev “Yapılıyor” olur. “Herkes”e atanan işi
          ilk kabul eden üstlenir.
        </Step>
        <Step n={3} title="Kontrole gönder">
          İş bitince sadece görevi alan kişi “Kontrol”e gönderir.
        </Step>
        <Step n={4} title="Tamamla">
          Sadece görevi atayan kişi işi “Tamamlandı” yapar. Ekip her aşamada görev altında konuşur,
          dosya ve link paylaşır.
        </Step>
      </ol>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-xl bg-slate-50 p-4">
      <p className="flex items-center gap-2 font-bold text-slate-900">
        <span className="flex size-6 items-center justify-center rounded-full bg-teal-600 text-xs text-white">
          {n}
        </span>
        {title}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed">{children}</p>
    </li>
  );
}

async function Stats() {
  await getUserId(); // oturum kontrolü (yerel, Supabase isteği yok)
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const [members, projects, open, done] = await Promise.all([
    supabase.from("profiles").select("*", head),
    supabase.from("projects").select("*", head),
    supabase.from("tasks").select("*", head).neq("status", "done"),
    supabase.from("tasks").select("*", head).eq("status", "done"),
  ]);

  const items: StatItem[] = [
    {
      value: members.count ?? 0,
      label: "Ekip üyesi",
      icon: Users,
      tone: "bg-teal-50 text-teal-700",
    },
    {
      value: projects.count ?? 0,
      label: "Proje",
      icon: FolderKanban,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      value: open.count ?? 0,
      label: "Süren iş",
      icon: ClipboardClock,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      value: done.count ?? 0,
      label: "Tamamlanan",
      icon: CircleCheck,
      tone: "bg-rose-50 text-rose-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <StatCard key={item.label} {...item} />
      ))}
    </div>
  );
}

// Kullanıcıdan aksiyon bekleyen işler
async function Inbox() {
  const userId = await getUserId();
  const supabase = await createClient();
  const fields =
    "id, title, status, priority, created_at, project:projects!tasks_project_id_fkey(name)";

  const [waitingRes, reviewRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(fields)
      .eq("status", "pending")
      .or(`assigned_to.eq.${userId},assigned_to.is.null`)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("tasks")
      .select(fields)
      .eq("created_by", userId)
      .eq("status", "review")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <InboxCard
        title="Kabulünü bekleyen görevler"
        href="/gorevlerim"
        linkLabel="Görevlerim"
        empty="Kabul etmenizi bekleyen görev yok."
        tasks={waitingRes.data ?? []}
      />
      <InboxCard
        title="Kontrolünüzü bekleyen görevler"
        href="/atadigim-gorevler"
        linkLabel="Atadığım Görevler"
        empty="Kontrolünüzü bekleyen görev yok."
        tasks={reviewRes.data ?? []}
      />
    </div>
  );
}

type InboxTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  project: { name: string } | null;
};

function InboxCard({
  title,
  href,
  linkLabel,
  empty,
  tasks,
}: {
  title: string;
  href: string;
  linkLabel: string;
  empty: string;
  tasks: InboxTask[];
}) {
  return (
    <section className={`${card} p-4 sm:p-5`}>
      {/* Dar ekranda başlık ve link sığmazsa link alt satıra iner (üst üste binmez) */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] leading-snug font-bold text-slate-900 sm:text-base">{title}</h2>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold whitespace-nowrap text-teal-700 hover:underline"
        >
          {linkLabel} <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={`/gorevler/${t.id}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-slate-100 px-3 py-2 transition hover:border-teal-200 hover:bg-teal-50/40"
              >
                <span className="min-w-0 flex-1 basis-44">
                  <span className="block truncate text-[13.5px] font-semibold text-slate-900">
                    {t.title}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {t.project?.name ?? "Projesiz"} · {formatDateTime(t.created_at)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <PriorityBadge priority={t.priority} size="xs" />
                  <StatusBadge status={t.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type StatItem = { value: number; label: string; icon: LucideIcon; tone: string };

function StatCard({ value, label, icon: Icon, tone }: StatItem) {
  return (
    <div className={`${card} flex min-w-0 items-center gap-3 p-3.5 sm:p-4`}>
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10 ${tone}`}
      >
        <Icon className="size-[18px]" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-lg leading-none font-bold text-slate-900 sm:text-xl">{value}</p>
        <p className="mt-1.5 truncate text-[13px] text-slate-500 sm:text-sm">{label}</p>
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className={`${card} h-[80px] animate-pulse sm:h-[104px]`} />
      ))}
    </div>
  );
}
