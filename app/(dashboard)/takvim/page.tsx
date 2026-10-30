import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { todayKey } from "@/lib/days";
import { addDays, daysBetween } from "@/lib/due";
import { STATUS_DOTS, STATUS_LABELS } from "@/lib/tasks";
import { card } from "@/components/ui/styles";
import type { TaskStatus } from "@/types/database";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Takvim · Em3Task" };

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const monthTitle = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayTitle = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  weekday: "long",
  timeZone: "UTC",
});

type CalendarTask = {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string;
  assignee: { full_name: string | null } | null;
  assigned_to: string | null;
};

export default function CalendarPage({ searchParams }: PageProps<"/takvim">) {
  return (
    <>
      <PageHeader title="Takvim" description="Teslim tarihi olan görevler." />
      <Suspense fallback={<div className={`${card} h-[32rem] animate-pulse`} />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Calendar({ searchParams }: Pick<PageProps<"/takvim">, "searchParams">) {
  const [{ ay, kim }, userId, supabase] = await Promise.all([
    searchParams,
    getUserId(),
    createClient(),
  ]);
  const today = todayKey();
  const month = typeof ay === "string" && MONTH_RE.test(ay) ? ay : today.slice(0, 7);
  const mine = kim === "ben";

  // Pazartesi başlayan 6 haftalık ızgara
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Pzt = 0
  const gridStart = addDays(first, -weekday);
  const gridEnd = addDays(gridStart, 41);
  const nextMonth = addDays(first, 32).slice(0, 7);
  const prevMonth = addDays(first, -1).slice(0, 7);

  let query = supabase
    .from("tasks")
    .select(
      "id, title, status, due_date, assigned_to, assignee:profiles!tasks_assigned_to_fkey(full_name)",
    )
    .gte("due_date", gridStart)
    .lte("due_date", gridEnd)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (mine) query = query.or(`assigned_to.eq.${userId},assigned_to.is.null`);
  const { data, error } = await query;
  const tasks = (data ?? []) as CalendarTask[];

  const byDay = new Map<string, CalendarTask[]>();
  for (const t of tasks) byDay.set(t.due_date, [...(byDay.get(t.due_date) ?? []), t]);

  const href = (m: string, k = mine) => `/takvim?ay=${m}${k ? "&kim=ben" : ""}`;
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthDays = days.filter((d) => d.startsWith(month) && byDay.has(d));

  return (
    <section className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Link
            href={href(prevMonth)}
            aria-label="Önceki ay"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <h2 className="min-w-36 text-center text-base font-bold text-slate-900 capitalize">
            {monthTitle.format(new Date(`${first}T00:00:00Z`))}
          </h2>
          <Link
            href={href(nextMonth)}
            aria-label="Sonraki ay"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronRight className="size-5" />
          </Link>
          {month !== today.slice(0, 7) && (
            <Link
              href={href(today.slice(0, 7))}
              className="ml-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Bugün
            </Link>
          )}
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          <Link
            href={href(month, false)}
            className={`rounded-md px-3 py-1.5 ${!mine ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Tümü
          </Link>
          <Link
            href={href(month, true)}
            className={`rounded-md px-3 py-1.5 ${mine ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Bana atanan
          </Link>
        </div>
      </div>

      {error && (
        <p className="m-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Görevler yüklenemedi.
        </p>
      )}

      {/* Geniş ekran: ay ızgarası */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60 text-center text-xs font-semibold text-slate-500">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const inMonth = d.startsWith(month);
            const list = byDay.get(d) ?? [];
            return (
              <div
                key={d}
                className={`min-h-28 border-slate-100 p-1.5 ${i % 7 !== 6 ? "border-r" : ""} ${i < 35 ? "border-b" : ""} ${
                  inMonth ? "" : "bg-slate-50/50"
                }`}
              >
                <p
                  className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                    d === today
                      ? "bg-teal-600 text-white"
                      : inMonth
                        ? "text-slate-700"
                        : "text-slate-400"
                  }`}
                >
                  {Number(d.slice(8))}
                </p>
                <ul className="space-y-1">
                  {list.slice(0, 3).map((t) => (
                    <li key={t.id}>
                      <TaskChip task={t} today={today} />
                    </li>
                  ))}
                  {list.length > 3 && (
                    <li className="px-1.5 text-[11px] font-medium text-slate-400">
                      +{list.length - 3} görev daha
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Telefon: gün gün liste (sadece bu ay) */}
      <div className="md:hidden">
        {monthDays.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
            <CalendarDays className="size-5 text-slate-400" /> Bu ay teslim tarihi olan görev yok.
          </p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {monthDays.map((d) => (
              <li key={d} className="px-4 py-3">
                <p
                  className={`mb-2 text-xs font-bold capitalize ${d === today ? "text-teal-700" : "text-slate-500"}`}
                >
                  {d === today ? "Bugün · " : ""}
                  {dayTitle.format(new Date(`${d}T00:00:00Z`))}
                </p>
                <ul className="space-y-1.5">
                  {(byDay.get(d) ?? []).map((t) => (
                    <li key={t.id}>
                      <TaskChip task={t} today={today} showAssignee />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>

      {!error && tasks.length === 0 && (
        <p className="hidden border-t border-slate-100 px-4 py-3 text-center text-sm text-slate-500 md:block">
          Bu görünümde teslim tarihi olan görev yok. Görev oluştururken ya da düzenlerken teslim
          tarihi ekleyebilirsiniz.
        </p>
      )}
    </section>
  );
}

function TaskChip({
  task,
  today,
  showAssignee = false,
}: {
  task: CalendarTask;
  today: string;
  showAssignee?: boolean;
}) {
  const overdue = task.status !== "done" && daysBetween(today, task.due_date) < 0;
  const who = task.assigned_to === null ? "Herkes" : (task.assignee?.full_name ?? "Eski üye");
  return (
    <Link
      href={`/gorevler/${task.id}`}
      title={`${task.title} · ${STATUS_LABELS[task.status]} · ${who}${overdue ? " · Gecikti" : ""}`}
      className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] leading-tight transition ${
        overdue
          ? "bg-rose-50 text-rose-800 hover:bg-rose-100"
          : task.status === "done"
            ? "text-slate-400 line-through hover:bg-slate-50"
            : "bg-slate-50 text-slate-700 hover:bg-teal-50"
      }`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOTS[task.status]}`} />
      <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
      {showAssignee && <span className="shrink-0 text-[11px] text-slate-400">{who}</span>}
    </Link>
  );
}
