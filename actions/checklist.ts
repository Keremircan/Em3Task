"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { isUuid } from "@/lib/tasks";
import { cleanText, MAX_CHECKLIST_TITLE } from "@/lib/labels";

export type ChecklistResult = { error: string | null };

// Yetki veritabanında (RLS): görevi atayan, sorumlusu, Admin; "Herkes" görevinde ekip
const NO_PERMISSION = "Kontrol listesini sadece görevi atayan ve sorumlusu düzenleyebilir.";

function revalidate() {
  // Kartlardaki "3/5" ilerlemesi de güncellensin
  revalidatePath("/", "layout");
}

// id tarayıcıda üretilir: anında görünen madde kayıttan sonra da aynı kalır
export async function addChecklistItem(taskId: string, id: string, title: string): Promise<ChecklistResult> {
  const userId = await getUserId();
  const text = cleanText(title, MAX_CHECKLIST_TITLE);
  if (!isUuid(taskId) || !isUuid(id)) return { error: "Geçersiz istek." };
  if (!text) return { error: "Madde boş olamaz." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_checklist_items")
    .insert({ id, task_id: taskId, title: text, created_by: userId });
  if (error) return { error: error.code === "42501" ? NO_PERMISSION : "Madde eklenemedi." };
  revalidate();
  return { error: null };
}

export async function toggleChecklistItem(id: string, isDone: boolean): Promise<ChecklistResult> {
  await getUserId();
  if (!isUuid(id)) return { error: "Geçersiz madde." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .update({ is_done: Boolean(isDone) })
    .eq("id", id)
    .select("id");
  if (error) return { error: "Madde güncellenemedi." };
  if (!data.length) return { error: NO_PERMISSION };
  revalidate();
  return { error: null };
}

export async function renameChecklistItem(id: string, title: string): Promise<ChecklistResult> {
  await getUserId();
  const text = cleanText(title, MAX_CHECKLIST_TITLE);
  if (!isUuid(id)) return { error: "Geçersiz madde." };
  if (!text) return { error: "Madde boş olamaz." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .update({ title: text })
    .eq("id", id)
    .select("id");
  if (error) return { error: "Madde güncellenemedi." };
  if (!data.length) return { error: NO_PERMISSION };
  revalidate();
  return { error: null };
}

export async function deleteChecklistItem(id: string): Promise<ChecklistResult> {
  await getUserId();
  if (!isUuid(id)) return { error: "Geçersiz madde." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_checklist_items").delete().eq("id", id).select("id");
  if (error) return { error: "Madde silinemedi." };
  if (!data.length) return { error: NO_PERMISSION };
  revalidate();
  return { error: null };
}
