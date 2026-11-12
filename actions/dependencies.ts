"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { isUuid } from "@/lib/tasks";

export type DependencyResult = { error: string | null };

// Yetki veritabanında (RLS): bekleyen görevi atayan kişi ya da Admin
const NO_PERMISSION = "Ön görevleri sadece görevi atayan kişi ya da Admin düzenleyebilir.";

function revalidate() {
  // Kartlardaki "Kilitli" rozeti de güncellensin
  revalidatePath("/", "layout");
}

function insertError(error: PostgrestError): string {
  if (error.code === "23505") return "Bu ön görev zaten ekli.";
  if (error.code === "23503") return "Seçilen görev bulunamadı (silinmiş olabilir).";
  if (error.code === "23514") return "Bir görev kendisine bağlanamaz.";
  if (error.code === "42501") {
    // Veritabanı kuralının Türkçe mesajı (döngü, sınır…) ya da yetki reddi
    return /row-level security/i.test(error.message) ? NO_PERMISSION : error.message || NO_PERMISSION;
  }
  return "Ön görev eklenemedi.";
}

// dependsOnId tamamlanmadan taskId başlatılamaz
export async function addDependency(taskId: string, dependsOnId: string): Promise<DependencyResult> {
  const userId = await getUserId();
  if (!isUuid(taskId) || !isUuid(dependsOnId)) return { error: "Geçersiz görev." };
  if (taskId === dependsOnId) return { error: "Bir görev kendisine bağlanamaz." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_dependencies")
    .insert({ task_id: taskId, depends_on_id: dependsOnId, added_by: userId });
  if (error) return { error: insertError(error) };

  revalidate();
  return { error: null };
}

export async function removeDependency(taskId: string, dependsOnId: string): Promise<DependencyResult> {
  await getUserId();
  if (!isUuid(taskId) || !isUuid(dependsOnId)) return { error: "Geçersiz görev." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("task_id", taskId)
    .eq("depends_on_id", dependsOnId)
    .select("task_id");
  if (error) return { error: "Ön görev kaldırılamadı." };
  if (!data.length) return { error: NO_PERMISSION };

  revalidate();
  return { error: null };
}
