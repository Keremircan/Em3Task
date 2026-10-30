"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { isUuid } from "@/lib/tasks";
import { isDayString } from "@/lib/due";
import { todayKey } from "@/lib/days";
import { MAX_ENTRY_MINUTES } from "@/lib/time";

export type TimeResult = { error: string | null };

const DAY_MS = 24 * 3600 * 1000;

function revalidate() {
  revalidatePath("/", "layout");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Kullanıcının çalışan sayacını durdurur (en fazla 24 saat sayılır)
async function stopRunning(supabase: Supabase, userId: string): Promise<string | null> {
  const { data: running } = await supabase
    .from("time_entries")
    .select("id, started_at")
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (!running) return null;
  const started = Date.parse(running.started_at);
  const end = Math.min(Date.now(), started + DAY_MS);
  // 1 saniyeden kısa kayıt anlamsız; sil
  if (end - started < 1000) {
    await supabase.from("time_entries").delete().eq("id", running.id);
    return null;
  }
  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date(end).toISOString() })
    .eq("id", running.id);
  return error ? "Çalışan sayaç durdurulamadı." : null;
}

// Sayacı başlat: başka bir görevde çalışan sayaç varsa önce o durdurulur
export async function startTimer(taskId: string): Promise<TimeResult> {
  const userId = await getUserId();
  if (!isUuid(taskId)) return { error: "Geçersiz görev." };
  const supabase = await createClient();
  const stopError = await stopRunning(supabase, userId);
  if (stopError) return { error: stopError };
  const { error } = await supabase
    .from("time_entries")
    .insert({ task_id: taskId, user_id: userId, started_at: new Date().toISOString() });
  if (error) {
    if (error.code === "23505") return { error: "Zaten çalışan bir sayacınız var." };
    if (error.code === "23503") return { error: "Görev bulunamadı (silinmiş olabilir)." };
    return { error: "Sayaç başlatılamadı." };
  }
  revalidate();
  return { error: null };
}

export async function stopTimer(): Promise<TimeResult> {
  const userId = await getUserId();
  const supabase = await createClient();
  const error = await stopRunning(supabase, userId);
  if (error) return { error };
  revalidate();
  return { error: null };
}

// Elle süre ekle: seçilen gün ve dakika. Bugünse "şimdi" biter, geçmiş günse 18:00'de.
export async function addManualTime(input: {
  taskId: string;
  day: string;
  minutes: number;
  note?: string;
}): Promise<TimeResult> {
  const userId = await getUserId();
  const minutes = Math.round(Number(input?.minutes));
  const note = String(input?.note ?? "").trim().slice(0, 300);
  if (!isUuid(input?.taskId)) return { error: "Geçersiz görev." };
  if (!isDayString(input?.day)) return { error: "Geçersiz tarih." };
  if (!Number.isFinite(minutes) || minutes < 1) return { error: "Süre en az 1 dakika olmalı." };
  if (minutes > MAX_ENTRY_MINUTES) return { error: "Tek kayıt en fazla 24 saat olabilir." };
  const today = todayKey();
  if (input.day > today) return { error: "İleri tarihli süre girilemez." };

  // Türkiye saati (UTC+3): geçmiş günler 18:00'de biter
  const end = input.day === today ? Date.now() : Date.parse(`${input.day}T15:00:00Z`);
  const start = end - minutes * 60_000;
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({
    task_id: input.taskId,
    user_id: userId,
    started_at: new Date(start).toISOString(),
    ended_at: new Date(end).toISOString(),
    note,
  });
  if (error) {
    if (error.code === "23503") return { error: "Görev bulunamadı (silinmiş olabilir)." };
    if (error.code === "22023") return { error: "İleri tarihli süre girilemez." };
    return { error: "Süre kaydedilemedi." };
  }
  revalidate();
  return { error: null };
}

export async function deleteTimeEntry(id: string): Promise<TimeResult> {
  await getUserId();
  if (!isUuid(id)) return { error: "Geçersiz kayıt." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("time_entries").delete().eq("id", id).select("id");
  if (error) return { error: "Kayıt silinemedi." };
  if (!data.length) return { error: "Sadece kendi süre kaydınızı silebilirsiniz." };
  revalidate();
  return { error: null };
}
