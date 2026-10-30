import type { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { csvDateTime, csvResponse, toCsv } from "@/lib/csv";
import { parsePeriod, periodStart } from "@/lib/report-period";
import { entrySeconds } from "@/lib/time";
import { todayKey } from "@/lib/days";

// Süre kayıtlarını CSV olarak indirir (?donem=7|30|ay|tumu; başlangıç zamanına göre).
// Çalışan (bitmemiş) sayaçlar dahil edilmez.
export async function GET(request: NextRequest) {
  await getUserId();
  const period = parsePeriod(request.nextUrl.searchParams.get("donem"));
  const from = periodStart(period);
  const supabase = await createClient();

  let q = supabase
    .from("time_entries")
    .select(
      `started_at, ended_at, note,
       user:profiles!time_entries_user_id_fkey(full_name),
       task:tasks!time_entries_task_id_fkey(title, project:projects!tasks_project_id_fkey(name))`,
    )
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false });
  if (from) q = q.gte("started_at", from);
  const { data, error } = await q;
  if (error) return new Response("Süre kayıtları okunamadı.", { status: 500 });

  const rows = (data ?? []).map((e) => [
    csvDateTime(e.started_at),
    csvDateTime(e.ended_at),
    Math.round(entrySeconds(e) / 60),
    e.user?.full_name ?? "Eski üye",
    e.task?.title ?? "Silinmiş görev",
    e.task?.project?.name ?? "",
    e.note,
  ]);
  const csv = toCsv(["Başlangıç", "Bitiş", "Süre (dk)", "Kişi", "Görev", "Proje", "Not"], rows);
  return csvResponse(csv, `em3task-sure-kayitlari-${todayKey()}.csv`);
}
