import "server-only";
import { cache } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarX2,
  CircleCheck,
  ClipboardCheck,
  Inbox,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser, getUserId } from "@/lib/auth";
import { todayKey } from "@/lib/days";
import { addDays } from "@/lib/due";
import {
  DUE_CAPTION,
  DUE_TONE_CLASS,
  formatMoney,
  upcomingSubscriptions,
} from "@/lib/subscriptions";
import type { Subscription, TaskPriority, TaskStatus } from "@/types/database";
import { card, ghostButton, primaryButton } from "@/components/ui/styles";
import { StatusBadge } from "@/components/tasks/status-badge";
import { PriorityBadge } from "@/components/tasks/priority";
import { DueBadge } from "@/components/tasks/due-badge";

// Ana sayfanın "Bugün" bölümü: kullanıcıyı bekleyen işler tek listede, önem sırasıyla.
//   gecikenler → bugün teslim → kabulünü bekleyen → kontrolünü bekleyen → bu hafta
// Her görev sadece bir grupta görünür (en önemli olanında).

export type FocusTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
  project: { name: string } | null;
};

export type GroupKey = "overdue" | "today" | "accept" | "review" | "week";

export type Group = {
  key: GroupKey;
  title: string;
  dot: string;
  more: { href: string; label: string };
  tasks: FocusTask[];
};

const FIELDS =
  "id, title, status, priority, due_date, created_at, project:projects!tasks_project_id_fkey(name)";
const GROUP_LIMIT = 5;

// Aynı istekte başlık ve liste ayrı bileşenler; veri bir kez çekilir
const getFocus = cache(async () => {
  const userId = await getUserId();
  const supabase = await createClient();
  const today = todayKey();

  const [mine, waiting, review] = await Promise.all([
    // Üzerimdeki işlerden teslim tarihi geçmiş ya da 7 gün içinde olanlar
    supabase
      .from("tasks")
      .select(FIELDS)
      .eq("assigned_to", userId)
      .in("status", ["pending", "in_progress"])
      .not("due_date", "is", null)
      .lte("due_date", addDays(today, 7))
      .order("due_date", { ascending: true })
      .limit(60),
    // Kabulümü bekleyenler: bana ya da "Herkes"e atanmış
    supabase
      .from("tasks")
      .select(FIELDS)
      .eq("status", "pending")
      .or(`assigned_to.eq.${userId},assigned_to.is.null`)
      .order("created_at", { ascending: false })
      .limit(30),
    // Kontrolümü bekleyenler: benim atadığım, kontrole gönderilmiş
    supabase
      .from("tasks")
      .select(FIELDS)
      .eq("created_by", userId)
      .eq("status", "review")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const seen = new Set<string>();
  const take = (list: FocusTask[]) =>
    list.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

  const dated = (mine.data ?? []) as FocusTask[];
  const groups: Group[] = [
    {
      key: "overdue",
      title: "Gecikenler",
      dot: "bg-rose-500",
      more: { href: "/gorevlerim", label: "Görevlerim" },
      tasks: take(dated.filter((t) => t.due_date! < today)),
    },
    {
      key: "today",
      title: "Bugün teslim",
      dot: "bg-amber-500",
      more: { href: "/gorevlerim", label: "Görevlerim" },
      tasks: take(dated.filter((t) => t.due_date === today)),
    },
    {
      key: "accept",
      title: "Kabulünü bekleyen",
      dot: "bg-teal-500",
      more: { href: "/gorevlerim", label: "Görevlerim" },
      tasks: take((waiting.data ?? []) as FocusTask[]),
    },
    {
      key: "review",
      title: "Kontrolünü bekleyen",
      dot: "bg-sky-500",
      more: { href: "/atadigim-gorevler", label: "Atadığım Görevler" },
      tasks: take((review.data ?? []) as FocusTask[]),
    },
    {
      key: "week",
      title: "Bu hafta",
      dot: "bg-slate-400",
      more: { href: "/gorevlerim", label: "Görevlerim" },
      tasks: take(dated.filter((t) => t.due_date! > today)),
    },
  ];

  return { groups, error: Boolean(mine.error || waiting.error || review.error) };
});

const count = (groups: Group[], key: GroupKey) => groups.find((g) => g.key === key)?.tasks.length ?? 0;

// ---------------------------------------------------------------------------
// Karşılama + 4 kutu (her biri listedeki grubuna götürür)

const TZ = "Europe/Istanbul";
const hourFmt = new Intl.DateTimeFormat("tr-TR", { hour: "numeric", hourCycle: "h23", timeZone: TZ });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });

function greeting(now: Date) {
  const h = Number(hourFmt.format(now));
  if (h >= 5 && h < 11) return "Günaydın";
  if (h >= 11 && h < 17) return "İyi günler";
  if (h >= 17 && h < 22) return "İyi akşamlar";
  return "İyi geceler";
}

type Tile = { key: GroupKey; label: string; icon: LucideIcon; tone: string; value: string };

export async function TodayHeader() {
  const [user, { groups }] = await Promise.all([getCurrentUser(), getFocus()]);
  return <TodayHeaderView firstName={user.name.split(" ")[0]} now={new Date()} groups={groups} />;
}

export function TodayHeaderView({ firstName, now, groups }: { firstName: string; now: Date; groups: Group[] }) {
  const overdue = count(groups, "overdue");
  const waiting = overdue + count(groups, "today") + count(groups, "accept") + count(groups, "review");
  const summary =
    waiting === 0
      ? "Bugün sizi bekleyen bir iş yok."
      : `${waiting} iş sizi bekliyor${overdue ? ` · ${overdue} tanesi gecikmiş` : ""}.`;

  const tiles: Tile[] = [
    { key: "overdue", label: "Geciken", icon: CalendarX2, tone: "bg-rose-50 text-rose-600", value: "text-rose-700" },
    { key: "today", label: "Bugün teslim", icon: CalendarClock, tone: "bg-amber-50 text-amber-600", value: "text-slate-900" },
    { key: "accept", label: "Kabul bekleyen", icon: Inbox, tone: "bg-teal-50 text-teal-700", value: "text-slate-900" },
    { key: "review", label: "Kontrol bekleyen", icon: ClipboardCheck, tone: "bg-sky-50 text-sky-600", value: "text-slate-900" },
  ];

  return (
    <>
      <header className="mb-4 lg:mb-5">
        <p className="text-xs font-medium tracking-[0.12em] text-slate-500">
          {dateFmt.format(now).toLocaleUpperCase("tr-TR")}
        </p>
        <h1 className="mt-1 text-xl leading-tight font-bold tracking-tight text-slate-900 lg:text-2xl">
          {greeting(now)}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{summary}</p>
      </header>

      {/* auto-rows-fr: telefonda iki satıra inen etiketler olsa da kutular eşit boyda */}
      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {tiles.map((t) => {
          const n = count(groups, t.key);
          const body = (
            <>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10 ${
                  n ? t.tone : "bg-slate-100 text-slate-400"
                }`}
              >
                <t.icon className="size-[18px]" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-lg leading-none font-bold sm:text-xl ${n ? t.value : "text-slate-400"}`}
                >
                  {n}
                </span>
                <span className="mt-1.5 block text-[13px] leading-tight text-slate-500 sm:truncate sm:text-sm">
                  {t.label}
                </span>
              </span>
            </>
          );
          const base = `${card} flex min-w-0 items-center gap-3 p-3.5 sm:p-4`;
          // Sayı varsa listedeki gruba kaydırır; boşsa tıklanmaz
          return n ? (
            <a
              key={t.key}
              href={`#${t.key}`}
              aria-label={`${n} ${t.label.toLocaleLowerCase("tr-TR")} görev, listeye git`}
              className={`${base} transition hover:border-teal-200 hover:bg-teal-50/30`}
            >
              {body}
            </a>
          ) : (
            <div key={t.key} className={base}>
              {body}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function TodayHeaderSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 lg:mb-5">
        <div className="h-3 w-40 rounded bg-slate-200/70" />
        <div className="mt-2.5 h-6 w-56 rounded bg-slate-200/70" />
        <div className="mt-2 h-4 w-48 rounded bg-slate-200/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${card} h-[68px] sm:h-[74px]`} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Odak listesi

export async function FocusList() {
  const { groups, error } = await getFocus();
  return <FocusListView groups={groups} error={error} />;
}

export function FocusListView({ groups, error }: { groups: Group[]; error: boolean }) {
  const shown = groups.filter((g) => g.tasks.length);

  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold text-slate-900 sm:text-base">Sıradaki işler</h2>
        <Link
          href="/gorevlerim"
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold whitespace-nowrap text-teal-700 hover:underline"
        >
          Tüm görevlerim <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Görevler yüklenemedi. Sayfayı yenileyip tekrar deneyin.
        </p>
      )}

      {!error && shown.length === 0 && <AllClear />}

      {shown.length > 0 && (
        <div className="mt-3 space-y-4">
          {shown.map((g) => (
            <div key={g.key} id={g.key} className="scroll-mt-20">
              <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500">
                <span className={`size-2 rounded-full ${g.dot}`} />
                {g.title.toLocaleUpperCase("tr-TR")}
                <span className="font-medium text-slate-400">{g.tasks.length}</span>
              </h3>
              <ul className="divide-y divide-slate-100">
                {g.tasks.slice(0, GROUP_LIMIT).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
              {g.tasks.length > GROUP_LIMIT && (
                <Link
                  href={g.more.href}
                  className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-teal-700 hover:underline"
                >
                  +{g.tasks.length - GROUP_LIMIT} görev daha · {g.more.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TaskRow({ task: t }: { task: FocusTask }) {
  return (
    <li>
      <Link
        href={`/gorevler/${t.id}`}
        className="-mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg px-2 py-2.5 transition hover:bg-slate-50"
      >
        <span className="min-w-0 flex-1 basis-44">
          <span className="block truncate text-[13.5px] font-semibold text-slate-900">{t.title}</span>
          <span className="block truncate text-xs text-slate-500">{t.project?.name ?? "Projesiz"}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <DueBadge due={t.due_date} status={t.status} size="xs" />
          <PriorityBadge priority={t.priority} size="xs" />
          <StatusBadge status={t.status} />
        </span>
      </Link>
    </li>
  );
}

function AllClear() {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CircleCheck className="size-6" />
      </span>
      <p className="mt-3 font-bold text-slate-900">Her şey yolunda</p>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Geciken, bugün teslim edilecek ya da onayınızı bekleyen bir iş yok.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href="/atadigim-gorevler" className={primaryButton}>
          Görev ata
        </Link>
        <Link href="/gorevlerim" className={ghostButton}>
          Görevlerim
        </Link>
      </div>
    </div>
  );
}

export function FocusListSkeleton() {
  return (
    <div className={`${card} animate-pulse p-4 sm:p-5`}>
      <div className="h-5 w-32 rounded bg-slate-200/70" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="mt-4 flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="h-4 w-2/3 rounded bg-slate-200/70" />
            <div className="mt-1.5 h-3 w-1/3 rounded bg-slate-200/70" />
          </div>
          <div className="h-5 w-20 rounded bg-slate-200/70" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yaklaşan abonelik ödemeleri (kişisel; hiç yoksa kart gösterilmez)

const PAYMENT_DAYS = 7;
const PAYMENT_LIMIT = 4;

function amountOf(s: Subscription): string | null {
  if (s.category === "bank_card") return s.current_debt === null ? null : formatMoney(s.current_debt, s.currency);
  return s.amount === null ? null : formatMoney(s.amount, s.currency);
}

export async function UpcomingPayments() {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", userId);
  const items = upcomingSubscriptions(data ?? [], todayKey(), PAYMENT_DAYS);
  if (!items.length) return null;

  return (
    <section className={`${card} mb-4 p-4 sm:p-5`}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold text-slate-900 sm:text-base">Yaklaşan ödemeler</h2>
        <Link
          href="/abonelikler"
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold whitespace-nowrap text-teal-700 hover:underline"
        >
          Abonelikler <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.slice(0, PAYMENT_LIMIT).map(({ subscription: s, due }) => {
          const amount = amountOf(s);
          return (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-slate-900">{s.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {DUE_CAPTION[due.kind]} · {due.date}
                  {amount && ` · ${amount}`}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${DUE_TONE_CLASS[due.tone]}`}
              >
                {due.label}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
        <Lock className="size-3" />
        {items.length > PAYMENT_LIMIT ? `+${items.length - PAYMENT_LIMIT} kayıt daha · ` : ""}Sadece siz görürsünüz
      </p>
    </section>
  );
}
