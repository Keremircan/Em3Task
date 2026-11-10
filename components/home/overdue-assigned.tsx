import "server-only";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { todayKey } from "@/lib/days";
import type { TaskStatus } from "@/types/database";
import { card } from "@/components/ui/styles";
import { Avatar } from "@/components/ui/avatar";
import { DueBadge } from "@/components/tasks/due-badge";

// Ana sayfa: başkasına (ya da "Herkes"e) atadığım, teslim tarihi geçmiş ve henüz
// kontrole gelmemiş işler. Kendi üzerimdekiler "Sıradaki işler"de, kontroldekiler
// "Kontrolünü bekleyen"de zaten var. Gecikme yoksa kart hiç gösterilmez.

export type OverdueAssignedTask = {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  assigned_to: string | null;
  assignee: { full_name: string | null; avatar_url: string | null } | null;
  project: { name: string } | null;
};

const LIMIT = 5;

export async function OverdueAssigned() {
  const userId = await getUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(
      "id, title, status, due_date, assigned_to, assignee:profiles!tasks_assigned_to_fkey(full_name, avatar_url), project:projects!tasks_project_id_fkey(name)",
    )
    .eq("created_by", userId)
    .in("status", ["pending", "in_progress"])
    .lt("due_date", todayKey())
    .or(`assigned_to.is.null,assigned_to.neq.${userId}`)
    .order("due_date", { ascending: true })
    .limit(30);

  return <OverdueAssignedView tasks={(data ?? []) as OverdueAssignedTask[]} />;
}

export function OverdueAssignedView({ tasks }: { tasks: OverdueAssignedTask[] }) {
  if (!tasks.length) return null;

  return (
    <section className={`${card} mb-4 p-4 sm:p-5`}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 sm:text-base">
          <span className="size-2 rounded-full bg-rose-500" />
          Geciken atadıklarım
          <span className="text-sm font-medium text-slate-400">{tasks.length}</span>
        </h2>
        <Link
          href="/atadigim-gorevler"
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold whitespace-nowrap text-teal-700 hover:underline"
        >
          Atadıklarım <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <ul className="divide-y divide-slate-100">
        {tasks.slice(0, LIMIT).map((t) => {
          const open = t.assigned_to === null;
          const name = open ? "Herkes" : (t.assignee?.full_name ?? "Eski üye");
          // Kimin işi ve ne durumda: kabul edilmemiş mi, üzerinde mi çalışılıyor
          const state = open ? "kimse almadı" : t.status === "pending" ? "kabul etmedi" : "yapıyor";
          return (
            <li key={t.id}>
              <Link
                href={`/gorevler/${t.id}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50"
              >
                {open ? (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400">
                    <Users className="size-3.5" />
                  </span>
                ) : (
                  <Avatar name={name} src={t.assignee?.avatar_url} size="sm" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-slate-900">
                    {t.title}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {name} · {state}
                    {t.project && ` · ${t.project.name}`}
                  </span>
                </span>
                <DueBadge due={t.due_date} status={t.status} size="xs" />
              </Link>
            </li>
          );
        })}
      </ul>

      {tasks.length > LIMIT && (
        <Link
          href="/atadigim-gorevler"
          className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-teal-700 hover:underline"
        >
          +{tasks.length - LIMIT} görev daha · Atadığım görevler
        </Link>
      )}
    </section>
  );
}
