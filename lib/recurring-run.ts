import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RecurringTask } from "@/types/database";
import { clip, sendPushNow } from "@/lib/push";
import { addDays } from "@/lib/due";
import { dayAndHour } from "@/lib/days";
import { nextOccurrenceAfter } from "@/lib/recurring";

// Zamanı gelen tekrarlayan görevlerden yeni görev açar. Saat başı zamanlanmış iş
// çağırır (app/api/cron/tekrar); sabah hatırlatma işi de yedek olarak çağırır
// (app/api/cron/hatirlatma). Oturum yoktur; service role ile çalışır.
//
// Aynı saatte iki kez çağrılsa da görev bir kez açılır: önce sıradaki açılış günü
// ileri alınır ("sahiplenme"), ancak bunu başaran çağrı görevi açar.

type Admin = SupabaseClient<Database>;

export type RecurringRunResult = {
  checked: number;
  opened: number;
  taskIds: string[]; // bu çağrıda açılan görevler (aynı çağrıda teslim hatırlatması gitmesin)
};

// Zamanlanmış çağrı saat başından birkaç saniye önce gelirse de o saat sayılsın
const SLOT_TOLERANCE_MS = 5 * 60 * 1000;

// Çağrının ait olduğu gün ve saat (Türkiye saati)
export function currentSlot(now: Date = new Date()): { day: string; hour: number } {
  return dayAndHour(new Date(now.getTime() + SLOT_TOLERANCE_MS));
}

// today / hour: açılış günü bugün ya da önce olan ve saati gelmiş tekrarlar açılır
// (bkz. isDueNow). Kaçan günler için ayrı ayrı görev açılmaz.
export async function openRecurringTasks(admin: Admin, today: string, hour: number): Promise<RecurringRunResult> {
  const { data: due, error } = await admin
    .from("recurring_tasks")
    .select("*")
    .eq("is_active", true)
    .lte("next_run", today)
    .lte("run_hour", hour)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Tekrarlayan görevler okunamadı.");

  const result: RecurringRunResult = { checked: due?.length ?? 0, opened: 0, taskIds: [] };
  let everyone: string[] | null = null;

  for (const row of due ?? []) {
    try {
      const taskId = await openOne(admin, row, today);
      if (!taskId) continue;
      result.opened++;
      result.taskIds.push(taskId);

      if (!row.assigned_to && everyone === null) {
        const { data: profiles } = await admin.from("profiles").select("id");
        everyone = (profiles ?? []).map((p) => p.id);
      }
      await sendPushNow(row.assigned_to ? [row.assigned_to] : (everyone ?? []), {
        title: row.assigned_to ? "Size yeni görev atandı" : "Ekibe yeni görev açıldı",
        body: `Tekrarlayan görev: ${clip(row.title)}`,
        url: `/gorevler/${taskId}`,
        tag: `task-${taskId}`,
        kind: "task",
      });
    } catch {
      // Bir kayıt hata verse de diğerleri açılmaya devam eder
    }
  }

  return result;
}

// Tek bir tekrarlama için bugünün görevini açar; açtıysa görev id'sini döndürür
export async function openOne(admin: Admin, row: RecurringTask, today: string): Promise<string | null> {
  const next = nextOccurrenceAfter(row.next_run, today, row.frequency, row.anchor_day);

  // Sahiplen: sıradaki günü ileri al. Başka bir çağrı önce davrandıysa satır dönmez.
  const { data: claimed } = await admin
    .from("recurring_tasks")
    .update({ next_run: next, last_run: today })
    .eq("id", row.id)
    .eq("next_run", row.next_run)
    .eq("is_active", true)
    .select("id");
  if (!claimed?.length) return null;

  const { data: task, error } = await admin
    .from("tasks")
    .insert({
      title: row.title,
      description: row.description,
      project_id: row.project_id,
      assigned_to: row.assigned_to,
      created_by: row.created_by,
      priority: row.priority,
      due_date: row.due_after_days === null ? null : addDays(today, row.due_after_days),
      status: "pending",
      recurring_id: row.id,
    })
    .select("id")
    .single();

  if (error || !task) {
    // Görev açılamadı: sahiplenmeyi geri al ki bir sonraki çalışmada yeniden denensin
    await admin
      .from("recurring_tasks")
      .update({ next_run: row.next_run, last_run: row.last_run })
      .eq("id", row.id)
      .eq("next_run", next);
    return null;
  }

  // Etkinlik akışı: veritabanı tetikleyicisi oturumsuz eklemeleri kaydetmez
  await admin.from("activity_log").insert({
    actor_id: row.created_by,
    action: "task_created",
    task_id: task.id,
    project_id: row.project_id,
    target_id: row.assigned_to,
    title: row.title,
  });

  return task.id;
}
