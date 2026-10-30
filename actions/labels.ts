"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { isUuid } from "@/lib/tasks";
import { cleanText, isLabelColor, MAX_LABEL_NAME } from "@/lib/labels";

export type LabelResult = { error: string | null };

function revalidate() {
  revalidatePath("/", "layout");
}

function nameError(code: string | undefined, fallback: string) {
  return code === "23505" ? "Bu adla bir etiket zaten var." : fallback;
}

// Yeni etiket (id tarayıcıda üretilir; anında görünür). İsteğe bağlı olarak göreve de eklenir.
export async function createLabel(input: {
  id: string;
  name: string;
  color: string;
  taskId?: string;
}): Promise<LabelResult> {
  const userId = await getUserId();
  const name = cleanText(input?.name, MAX_LABEL_NAME);
  if (!isUuid(input?.id)) return { error: "Geçersiz istek." };
  if (!name) return { error: "Etiket adı boş olamaz." };
  if (!isLabelColor(input?.color)) return { error: "Geçersiz renk." };
  if (input.taskId !== undefined && !isUuid(input.taskId)) return { error: "Geçersiz görev." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("labels")
    .insert({ id: input.id, name, color: input.color, created_by: userId });
  if (error) return { error: nameError(error.code, "Etiket oluşturulamadı.") };

  if (input.taskId) {
    const { error: linkError } = await supabase
      .from("task_labels")
      .insert({ task_id: input.taskId, label_id: input.id, added_by: userId });
    if (linkError && linkError.code !== "23505") {
      revalidate();
      return { error: "Etiket oluşturuldu ama göreve eklenemedi." };
    }
  }
  revalidate();
  return { error: null };
}

export async function updateLabel(id: string, name: string, color: string): Promise<LabelResult> {
  await getUserId();
  const clean = cleanText(name, MAX_LABEL_NAME);
  if (!isUuid(id)) return { error: "Geçersiz etiket." };
  if (!clean) return { error: "Etiket adı boş olamaz." };
  if (!isLabelColor(color)) return { error: "Geçersiz renk." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("labels")
    .update({ name: clean, color })
    .eq("id", id)
    .select("id");
  if (error) return { error: nameError(error.code, "Etiket güncellenemedi.") };
  if (!data.length) return { error: "Etiket bulunamadı (silinmiş olabilir)." };
  revalidate();
  return { error: null };
}

// Silme: sadece oluşturan kişi ya da Admin (RLS). Görevlerden de kalkar.
export async function deleteLabel(id: string): Promise<LabelResult> {
  await getUserId();
  if (!isUuid(id)) return { error: "Geçersiz etiket." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("labels").delete().eq("id", id).select("id");
  if (error) return { error: "Etiket silinemedi." };
  if (!data.length) return { error: "Etiketi sadece oluşturan kişi ya da Admin silebilir." };
  revalidate();
  return { error: null };
}

// Göreve etiket ekle / çıkar (ekipten herkes)
export async function setTaskLabel(taskId: string, labelId: string, on: boolean): Promise<LabelResult> {
  const userId = await getUserId();
  if (!isUuid(taskId) || !isUuid(labelId)) return { error: "Geçersiz istek." };
  const supabase = await createClient();
  if (on) {
    const { error } = await supabase
      .from("task_labels")
      .insert({ task_id: taskId, label_id: labelId, added_by: userId });
    if (error && error.code !== "23505") {
      return { error: error.code === "23503" ? "Görev ya da etiket bulunamadı." : "Etiket eklenemedi." };
    }
  } else {
    const { error } = await supabase
      .from("task_labels")
      .delete()
      .eq("task_id", taskId)
      .eq("label_id", labelId);
    if (error) return { error: "Etiket çıkarılamadı." };
  }
  revalidate();
  return { error: null };
}
