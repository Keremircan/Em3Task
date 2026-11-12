"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser, getUserId } from "@/lib/auth";
import { clip, notifyUsers } from "@/lib/push";
import { isUuid } from "@/lib/tasks";
import { readTaskForm } from "@/lib/task-form";
import { todayKey } from "@/lib/days";
import { addDays, daysBetween, isDayString } from "@/lib/due";
import {
  dayOfMonth,
  firstOccurrence,
  isFrequency,
  MAX_DUE_AFTER_DAYS,
  MAX_START_AHEAD_DAYS,
  nextOccurrenceAfter,
} from "@/lib/recurring";

export type RecurringResult = { error: string | null };
// taskId: ilk açılış bugünse hemen açılan görev; ileri tarihliyse null
export type CreateRecurringResult = RecurringResult & { taskId: string | null };

const NOT_OWNER = "Tekrarlayan görevi sadece oluşturan kişi ya da Admin değiştirebilir.";

function revalidateAll() {
  revalidatePath("/", "layout");
}

// Görev formundaki "Tekrar" seçiliyse çağrılır: tekrarlama kaydını oluşturur ve
// ilk açılış bugünse ilk görevi hemen açar. Sonraki görevleri her sabah zamanlanmış
// iş açar (bkz. lib/recurring-run.ts).
export async function createRecurringTask(formData: FormData): Promise<CreateRecurringResult> {
  const userId = await getUserId();
  const fields = readTaskForm(formData);
  if (typeof fields === "string") return { error: fields, taskId: null };

  const frequency = formData.get("repeat");
  if (!isFrequency(frequency)) return { error: "Tekrar sıklığını seçin.", taskId: null };

  const today = todayKey();
  const startRaw = String(formData.get("repeat_start") ?? "").trim() || today;
  if (!isDayString(startRaw)) return { error: "Geçersiz ilk açılış tarihi.", taskId: null };
  if (startRaw < today) return { error: "İlk açılış tarihi geçmişte olamaz.", taskId: null };
  if (daysBetween(today, startRaw) > MAX_START_AHEAD_DAYS) {
    return { error: "İlk açılış en fazla bir yıl sonrası olabilir.", taskId: null };
  }

  const dueRaw = String(formData.get("repeat_due") ?? "").trim();
  let dueAfter: number | null = null;
  if (dueRaw !== "") {
    dueAfter = Number(dueRaw);
    if (!Number.isInteger(dueAfter) || dueAfter < 0 || dueAfter > MAX_DUE_AFTER_DAYS) {
      return { error: "Geçersiz teslim süresi.", taskId: null };
    }
  }

  // Hafta içi tekrarında hafta sonu seçildiyse ilk açılış pazartesiye kayar
  const start = firstOccurrence(startRaw, frequency);
  const anchorDay = frequency === "monthly" ? dayOfMonth(start) : null;
  const opensNow = start === today;

  const supabase = await createClient();
  const { data: recurring, error } = await supabase
    .from("recurring_tasks")
    .insert({
      title: fields.title,
      description: fields.description,
      project_id: fields.project_id,
      assigned_to: fields.assigned_to,
      created_by: userId,
      priority: fields.priority,
      frequency,
      anchor_day: anchorDay,
      due_after_days: dueAfter,
      next_run: opensNow ? nextOccurrenceAfter(start, today, frequency, anchorDay) : start,
      last_run: opensNow ? today : null,
    })
    .select("id")
    .single();

  if (error) {
    return {
      error: error.code === "23503" ? "Seçilen proje veya kişi bulunamadı." : "Tekrarlayan görev kaydedilemedi.",
      taskId: null,
    };
  }

  if (!opensNow) {
    revalidateAll();
    return { error: null, taskId: null };
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      title: fields.title,
      description: fields.description,
      project_id: fields.project_id,
      assigned_to: fields.assigned_to,
      priority: fields.priority,
      due_date: dueAfter === null ? null : addDays(today, dueAfter),
      created_by: userId,
      status: "pending",
      recurring_id: recurring.id,
    })
    .select("id")
    .single();

  if (taskError) {
    // İlk görev açılamadıysa yarım kalan tekrarlama kaydını geri al
    await supabase.from("recurring_tasks").delete().eq("id", recurring.id);
    return {
      error: taskError.code === "42501" && taskError.message ? taskError.message : "Görev kaydedilemedi.",
      taskId: null,
    };
  }

  let recipients = fields.assigned_to ? [fields.assigned_to] : [];
  if (!fields.assigned_to) {
    const { data: everyone } = await supabase.from("profiles").select("id");
    recipients = (everyone ?? []).map((p) => p.id);
  }
  const user = await getCurrentUser();
  notifyUsers(
    recipients,
    {
      title: fields.assigned_to ? "Size yeni görev atandı" : "Ekibe yeni görev açıldı",
      body: `${user.name}: ${clip(fields.title)}`,
      url: `/gorevler/${task.id}`,
      tag: `task-${task.id}`,
      kind: "task",
    },
    userId,
  );

  revalidateAll();
  return { error: null, taskId: task.id };
}

// Duraklat / sürdür. Sürdürülürken sıradaki açılış geçmişte kaldıysa bugüne ya da
// sonrasına taşınır (duraklatıldığı günler için geriye dönük görev açılmaz).
export async function setRecurringActive(id: string, active: boolean): Promise<RecurringResult> {
  await getUserId();
  if (!isUuid(id)) return { error: "Geçersiz kayıt." };

  const supabase = await createClient();
  const update: { is_active: boolean; next_run?: string } = { is_active: Boolean(active) };

  if (active) {
    const { data: row } = await supabase
      .from("recurring_tasks")
      .select("next_run, frequency, anchor_day")
      .eq("id", id)
      .maybeSingle();
    if (!row) return { error: "Tekrarlayan görev bulunamadı (silinmiş olabilir)." };
    const today = todayKey();
    if (row.next_run < today) {
      // Dünden sonraki ilk açılış: bugün de olabilir
      update.next_run = nextOccurrenceAfter(row.next_run, addDays(today, -1), row.frequency, row.anchor_day);
    }
  }

  const { data, error } = await supabase.from("recurring_tasks").update(update).eq("id", id).select("id");
  if (error) return { error: "Kayıt güncellenemedi." };
  if (!data.length) return { error: NOT_OWNER };

  revalidateAll();
  return { error: null };
}

// Tekrarlamayı siler. Daha önce açılmış görevler yerinde kalır.
export async function deleteRecurringTask(id: string): Promise<RecurringResult> {
  await getUserId();
  if (!isUuid(id)) return { error: "Geçersiz kayıt." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring_tasks").delete().eq("id", id).select("id");
  if (error) return { error: "Kayıt silinemedi." };
  if (!data.length) return { error: NOT_OWNER };

  revalidateAll();
  return { error: null };
}
