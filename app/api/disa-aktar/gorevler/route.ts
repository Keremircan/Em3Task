import type { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/tasks";
import { csvDateTime, csvDay, csvResponse, toCsv } from "@/lib/csv";
import { parsePeriod, periodStart } from "@/lib/report-period";
import { checklistProgress, taskLabels } from "@/lib/labels";
import { entrySeconds, hours } from "@/lib/time";
import { todayKey } from "@/lib/days";

// Görevleri CSV olarak indirir (?donem=7|30|ay|tumu; oluşturulma tarihine göre).
// Oturum gerekir (proxy); veriler kullanıcının görebildikleriyle sınırlı (RLS).
export async function GET(request: NextRequest) {
  await getUserId();
  const period = parsePeriod(request.nextUrl.searchParams.get("donem"));
  const from = periodStart(period);
  const supabase = await createClient();

  let q = supabase
    .from("tasks")
    .select(
      `id, title, status, priority, created_at, due_date, completed_at,
       project:projects!tasks_project_id_fkey(name),
       creator:profiles!tasks_created_by_fkey(full_name),
       assignee:profiles!tasks_assigned_to_fkey(full_name),
       assigned_to,
       labels:task_labels(label:labels(id, name, color)),
       checklist:task_checklist_items(is_done),
       time:time_entries(started_at, ended_at)`,
    )
    .order("created_at", { ascending: false });
  if (from) q = q.gte("created_at", from);
  const { data, error } = await q;
  if (error) return new Response("Görevler okunamadı.", { status: 500 });

  const origin = request.nextUrl.origin;
  const rows = (data ?? []).map((t) => {
    const progress = checklistProgress(t.checklist);
    const seconds = (t.time ?? []).reduce((s, e) => s + entrySeconds(e), 0);
    return [
      t.title,
      t.project?.name ?? "",
      STATUS_LABELS[t.status],
      PRIORITY_LABELS[t.priority],
      t.creator?.full_name ?? "Eski üye",
      t.assigned_to === null ? "Herkes" : (t.assignee?.full_name ?? "Eski üye"),
      csvDateTime(t.created_at),
      csvDay(t.due_date),
      csvDateTime(t.completed_at),
      taskLabels(t.labels).map((l) => l.name).join(", "),
      progress.total ? `${progress.done}/${progress.total}` : "",
      seconds ? hours(seconds) : "",
      `${origin}/gorevler/${t.id}`,
    ];
  });

  const csv = toCsv(
    ["Görev", "Proje", "Durum", "Öncelik", "Atayan", "Sorumlu", "Oluşturulma", "Teslim tarihi", "Tamamlanma", "Etiketler", "Kontrol listesi", "Harcanan süre (saat)", "Bağlantı"],
    rows,
  );
  return csvResponse(csv, `em3task-gorevler-${todayKey()}.csv`);
}
