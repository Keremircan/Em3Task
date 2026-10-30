import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarX2, CircleCheck, Clock, Download, Timer } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { getTeamMembers } from "@/lib/team";
import { todayKey } from "@/lib/days";
import { daysBetween } from "@/lib/due";
import { entrySeconds, formatDuration, hours } from "@/lib/time";
import { parsePeriod, periodLabel, periodStart, PERIODS } from "@/lib/report-period";
import { card } from "@/components/ui/styles";
import { BarChart, type BarDatum } from "@/components/reports/bar-chart";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Raporlar · Em3Task" };

export default function ReportsPage({ searchParams }: PageProps<"/raporlar">) {
  return (
    <>
      <PageHeader title="Raporlar" description="Tamamlanan işler, harcanan süre ve gecikmeler." />
      <Suspense fallback={<div className={`${card} h-96 animate-pulse`} />}>
        <Reports searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

async function Reports({ searchParams }: Pick<PageProps<"/raporlar">, "searchParams">) {
  const [{ donem }, , supabase, team] = await Promise.all([searchParams, getUserId(), createClient(), getTeamMembers()]);
  const period = parsePeriod(donem);
  const from = periodStart(period);
  const today = todayKey();

  let completedQ = supabase
    .from("tasks")
    .select("id, assigned_to, created_at, completed_at")
    .not("completed_at", "is", null);
  let timeQ = supabase
    .from("time_entries")
    .select("user_id, started_at, ended_at, task:tasks!time_entries_task_id_fkey(project:projects!tasks_project_id_fkey(name))")
    .not("ended_at", "is", null);
  if (from) {
    completedQ = completedQ.gte("completed_at", from);
    timeQ = timeQ.gte("started_at", from);
  }
  const [completedRes, openRes, timeRes] = await Promise.all([
    completedQ,
    supabase.from("tasks").select("assigned_to, due_date").neq("status", "done"),
    timeQ,
  ]);

  const failed = completedRes.error || openRes.error || timeRes.error;
  const completed = completedRes.data ?? [];
  const open = openRes.data ?? [];
  const entries = timeRes.data ?? [];

  const nameOf = (id: string | null) =>
    id === null ? "Herkes" : (team.find((m) => m.id === id)?.name ?? "Eski üye");

  // Kişi başına özet
  type Row = { name: string; done: number; open: number; overdue: number; seconds: number };
  const rows = new Map<string, Row>();
  const row = (id: string | null) => {
    const key = id ?? "herkes";
    if (!rows.has(key)) rows.set(key, { name: nameOf(id), done: 0, open: 0, overdue: 0, seconds: 0 });
    return rows.get(key)!;
  };
  for (const m of team) row(m.id);
  for (const t of completed) row(t.assigned_to).done++;
  for (const t of open) {
    const r = row(t.assigned_to);
    r.open++;
    if (t.due_date && daysBetween(today, t.due_date) < 0) r.overdue++;
  }
  for (const e of entries) row(e.user_id).seconds += entrySeconds(e);
  const people = [...rows.values()].filter((r) => r.done || r.open || r.seconds);

  const totalSeconds = people.reduce((s, r) => s + r.seconds, 0);
  const overdueTotal = people.reduce((s, r) => s + r.overdue, 0);
  const leadDays = completed
    .map((t) => (Date.parse(t.completed_at!) - Date.parse(t.created_at)) / 86_400_000)
    .filter((d) => d >= 0);
  const avgLead = leadDays.length ? leadDays.reduce((a, b) => a + b, 0) / leadDays.length : null;

  // Proje başına süre
  const byProject = new Map<string, number>();
  for (const e of entries) {
    const name = e.task?.project?.name ?? "Projesiz";
    byProject.set(name, (byProject.get(name) ?? 0) + entrySeconds(e));
  }

  const doneBars: BarDatum[] = people
    .filter((r) => r.done)
    .sort((a, b) => b.done - a.done)
    .map((r) => ({ label: r.name, value: r.done, display: String(r.done) }));
  const timeBars: BarDatum[] = people
    .filter((r) => r.seconds)
    .sort((a, b) => b.seconds - a.seconds)
    .map((r) => ({ label: r.name, value: r.seconds, display: nf.format(hours(r.seconds)), detail: formatDuration(r.seconds) }));
  const projectBars: BarDatum[] = [...byProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, s]) => ({ label: name, value: s, display: nf.format(hours(s)), detail: formatDuration(s) }));

  const exportHref = (kind: "gorevler" | "sureler") => `/api/disa-aktar/${kind}?donem=${period}`;

  return (
    <div className="space-y-4">
      {/* Dönem seçimi ve dışa aktarma */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex rounded-lg bg-slate-200/60 p-0.5 text-xs font-semibold" aria-label="Dönem">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/raporlar?donem=${p.key}`}
              aria-current={p.key === period ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 ${p.key === period ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          <a href={exportHref("gorevler")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="size-3.5" /> Görevler (CSV)
          </a>
          <a href={exportHref("sureler")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="size-3.5" /> Süre kayıtları (CSV)
          </a>
        </div>
      </div>

      {failed && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Rapor verileri yüklenemedi.</p>}

      {/* Özet kutuları */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat icon={<CircleCheck className="size-[18px]" />} tone="bg-emerald-50 text-emerald-700" label="Tamamlanan görev" value={String(completed.length)} />
        <Stat icon={<Clock className="size-[18px]" />} tone="bg-teal-50 text-teal-700" label="Harcanan süre" value={totalSeconds ? formatDuration(totalSeconds) : "0 dk"} />
        <Stat icon={<CalendarX2 className="size-[18px]" />} tone="bg-rose-50 text-rose-700" label="Geciken açık görev" value={String(overdueTotal)} note="şu an" />
        <Stat icon={<Timer className="size-[18px]" />} tone="bg-sky-50 text-sky-700" label="Ort. tamamlanma süresi" value={avgLead === null ? "—" : `${nf.format(avgLead)} gün`} note="oluşturma → tamamlanma" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Kişi başına tamamlanan görev" subtitle={periodLabel(period)}>
          <BarChart data={doneBars} unit="görev" empty="Bu dönemde tamamlanan görev yok." />
        </Panel>
        <Panel title="Kişi başına harcanan süre" subtitle={`${periodLabel(period)} · saat`}>
          <BarChart data={timeBars} unit="saat" empty="Bu dönemde süre kaydı yok. Görev sayfasından sayaç başlatabilir ya da süre ekleyebilirsiniz." />
        </Panel>
      </div>

      <Panel title="Proje başına harcanan süre" subtitle={`${periodLabel(period)} · saat`}>
        <BarChart data={projectBars} unit="saat" empty="Bu dönemde süre kaydı yok." />
      </Panel>

      {/* Tablo görünümü: grafiklerdeki verilerin tamamı */}
      <Panel title="Kişi bazında özet" subtitle={`Tamamlanan ve süre: ${periodLabel(period).toLocaleLowerCase("tr")} · Açık ve geciken: şu an`}>
        {people.length === 0 ? (
          <p className="text-sm text-slate-500">Gösterilecek veri yok.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Kişi</th>
                  <th className="py-2 pr-3 text-right font-semibold">Tamamlanan</th>
                  <th className="py-2 pr-3 text-right font-semibold">Açık</th>
                  <th className="py-2 pr-3 text-right font-semibold">Geciken</th>
                  <th className="py-2 text-right font-semibold">Harcanan süre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {people
                  .sort((a, b) => b.done - a.done || b.seconds - a.seconds)
                  .map((r) => (
                    <tr key={r.name}>
                      <td className="py-2 pr-3 font-medium text-slate-800">{r.name}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.done}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{r.open}</td>
                      <td className={`py-2 pr-3 text-right tabular-nums ${r.overdue ? "font-semibold text-rose-700" : ""}`}>{r.overdue}</td>
                      <td className="py-2 text-right tabular-nums">{r.seconds ? formatDuration(r.seconds) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Stat({ icon, tone, label, value, note }: { icon: ReactNode; tone: string; label: string; value: string; note?: string }) {
  return (
    <div className={`${card} flex min-w-0 items-center gap-3 p-3.5 sm:p-4`}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10 ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-lg leading-tight font-bold text-slate-900 sm:text-xl">{value}</span>
        <span className="mt-0.5 block truncate text-[13px] text-slate-500">{label}</span>
        {note && <span className="block truncate text-[11px] text-slate-400">{note}</span>}
      </span>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="mb-4 text-xs text-slate-500">{subtitle}</p>}
      {children}
    </section>
  );
}
