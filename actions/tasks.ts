"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser, getUserId } from "@/lib/auth";
import { clip, notifyUsers } from "@/lib/push";
import { EVERYONE, isTaskPriority, isUuid, MAX_REVISION_NOTE } from "@/lib/tasks";
import type { TaskPriority } from "@/types/database";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";

export type ActionResult = { error: string | null };
export type CreateTaskResult = ActionResult & { taskId: string | null };

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 50_000;

const taskUrl = (id: string) => `/gorevler/${id}`;

// "Herkes"e atanan görev için bildirim tüm ekibe gider
async function assigneeIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignedTo: string | null,
): Promise<string[]> {
  if (assignedTo) return [assignedTo];
  const { data } = await supabase.from("profiles").select("id");
  return (data ?? []).map((p) => p.id);
}

function revalidateAll() {
  // Küçük uygulama: sidebar, panolar ve listeler birlikte yenilenir
  revalidatePath("/", "layout");
}

// Veritabanı kurallarından (trigger) gelen Türkçe mesajı kullanıcıya göster
function dbError(error: PostgrestError, fallback: string) {
  if (error.code === "42501" && error.message) return error.message;
  if (error.code === "23503") return "Seçilen proje veya kişi bulunamadı.";
  return fallback;
}

type TaskFields = {
  title: string;
  description: string | null;
  project_id: string;
  assigned_to: string | null;
  priority: TaskPriority;
};

function readTaskForm(formData: FormData): TaskFields | string {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const projectId = formData.get("project_id");
  const assignee = formData.get("assigned_to");
  const priority = formData.get("priority") ?? "none";

  if (!title) return "Görev adı zorunludur.";
  if (title.length > MAX_TITLE) return "Görev adı en fazla 200 karakter olabilir.";
  if (description.length > MAX_DESCRIPTION) return "Görev açıklaması çok uzun.";
  if (!isUuid(projectId)) return "Görevin bağlı olduğu projeyi seçin.";
  if (assignee !== EVERYONE && !isUuid(assignee)) {
    return "Görevi atayacağınız kişiyi seçin.";
  }
  if (!isTaskPriority(priority)) return "Geçersiz öncelik.";

  return {
    title,
    description: description || null,
    project_id: projectId,
    assigned_to: assignee === EVERYONE ? null : (assignee as string),
    priority,
  };
}

export async function createTask(formData: FormData): Promise<CreateTaskResult> {
  const userId = await getUserId();
  const fields = readTaskForm(formData);
  if (typeof fields === "string") return { error: fields, taskId: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...fields, created_by: userId, status: "pending" })
    .select("id")
    .single();

  if (error) {
    return { error: dbError(error, "Görev kaydedilemedi."), taskId: null };
  }

  const user = await getCurrentUser();
  notifyUsers(
    await assigneeIds(supabase, fields.assigned_to),
    {
      title: fields.assigned_to ? "Size yeni görev atandı" : "Ekibe yeni görev açıldı",
      body: `${user.name}: ${clip(fields.title)}`,
      url: taskUrl(data.id),
      tag: `task-${data.id}`,
    },
    userId,
  );

  revalidateAll();
  return { error: null, taskId: data.id };
}

export async function updateTask(
  taskId: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!isUuid(taskId)) return { error: "Geçersiz görev." };

  const fields = readTaskForm(formData);
  if (typeof fields === "string") return { error: fields };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("tasks")
    .select("assigned_to")
    .eq("id", taskId)
    .maybeSingle();
  const { data, error } = await supabase
    .from("tasks")
    .update(fields)
    .eq("id", taskId)
    .eq("created_by", userId)
    .select("id");

  if (error) return { error: dbError(error, "Görev güncellenemedi.") };
  if (!data.length) return { error: "Görevi sadece atayan kişi düzenleyebilir." };

  // Sorumlu değiştiyse yeni sorumluya haber ver
  if (before && before.assigned_to !== fields.assigned_to) {
    const user = await getCurrentUser();
    notifyUsers(
      await assigneeIds(supabase, fields.assigned_to),
      {
        title: fields.assigned_to ? "Size görev atandı" : "Ekibe görev açıldı",
        body: `${user.name}: ${clip(fields.title)}`,
        url: taskUrl(taskId),
        tag: `task-${taskId}`,
      },
      userId,
    );
  }

  revalidateAll();
  return { error: null };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!isUuid(taskId)) return { error: "Geçersiz görev." };

  const supabase = await createClient();

  // Görev silinince ek kayıtları da silinir; depodaki dosyaları da temizle
  const { data: files } = await supabase
    .from("task_attachments")
    .select("file_url")
    .eq("task_id", taskId);

  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("created_by", userId)
    .select("id");

  if (error) return { error: dbError(error, "Görev silinemedi.") };
  if (!data.length) return { error: "Görevi sadece atayan kişi silebilir." };

  if (files?.length) {
    await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove(files.map((f) => f.file_url));
  }

  revalidateAll();
  return { error: null };
}

// Kabul Et: atanan kişi (ya da "Herkes" görevinde ilk kabul eden) görevi alır
export async function acceptTask(taskId: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!isUuid(taskId)) return { error: "Geçersiz görev." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ assigned_to: userId, status: "in_progress" })
    .eq("id", taskId)
    .eq("status", "pending")
    .or(`assigned_to.is.null,assigned_to.eq.${userId}`)
    .select("id");

  if (error) return { error: dbError(error, "Görev kabul edilemedi.") };
  if (!data.length) {
    return { error: "Bu görev artık kabul edilemiyor (başka biri almış olabilir)." };
  }

  revalidateAll();
  return { error: null };
}

// Kontrole gönder: sadece görevi alan kişi
export async function submitForReview(taskId: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!isUuid(taskId)) return { error: "Geçersiz görev." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "review" })
    .eq("id", taskId)
    .eq("status", "in_progress")
    .eq("assigned_to", userId)
    .select("id, title, created_by");

  if (error) return { error: dbError(error, "Görev kontrole gönderilemedi.") };
  if (!data.length) return { error: "Görevi sadece sorumlusu kontrole gönderebilir." };

  const user = await getCurrentUser();
  notifyUsers(
    [data[0].created_by],
    {
      title: "Görev kontrolünüzü bekliyor",
      body: `${user.name}: ${clip(data[0].title)}`,
      url: taskUrl(taskId),
      tag: `task-${taskId}`,
    },
    userId,
  );

  revalidateAll();
  return { error: null };
}

// Revize Ver: kontroldeki görev, atayan kişi tarafından "Yapılıyor"a geri döner.
// İsteğe bağlı not, görevin yorumlarına "Revize" başlığıyla eklenir; görevi alan kişi
// düzeltip yeniden kontrole gönderir.
export async function requestRevision(taskId: string, note = ""): Promise<ActionResult> {
  const userId = await getUserId();
  if (!isUuid(taskId)) return { error: "Geçersiz görev." };
  const text = String(note ?? "").trim();
  if (text.length > MAX_REVISION_NOTE) {
    return { error: "Revize notu çok uzun (en fazla 5.000 karakter)." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "in_progress" })
    .eq("id", taskId)
    .eq("status", "review")
    .eq("created_by", userId)
    .select("revision_count, title, assigned_to");

  if (error) return { error: dbError(error, "Revize verilemedi.") };
  if (!data.length) {
    return { error: "Revize sadece kontroldeki göreve, atayan kişi tarafından verilebilir." };
  }

  const round = data[0].revision_count;
  const { error: commentError } = await supabase.from("task_comments").insert({
    task_id: taskId,
    user_id: userId,
    content: `**Revize #${round}**${text ? `\n\n${text}` : ""}`,
  });

  const user = await getCurrentUser();
  notifyUsers(
    [data[0].assigned_to],
    {
      title: `Revize istendi: ${clip(data[0].title, 60)}`,
      body: text ? `${user.name}: ${clip(text)}` : `${user.name} görevde düzeltme istedi.`,
      url: taskUrl(taskId),
      tag: `task-${taskId}`,
    },
    userId,
  );

  revalidateAll();
  // Durum geri döndü; not kaydedilemediyse bunu ayrıca bildir
  if (commentError) return { error: "Revize verildi ama not kaydedilemedi." };
  return { error: null };
}

// Tamamlandı: sadece görevi atayan kişi, görev kabul edildikten sonra
export async function completeTask(taskId: string): Promise<ActionResult> {
  const userId = await getUserId();
  if (!isUuid(taskId)) return { error: "Geçersiz görev." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: "done" })
    .eq("id", taskId)
    .eq("created_by", userId)
    .in("status", ["in_progress", "review"])
    .select("id");

  if (error) return { error: dbError(error, "Görev tamamlanamadı.") };
  if (!data.length) {
    return { error: "Görev ancak kabul edildikten sonra atayan kişi tarafından tamamlanabilir." };
  }

  revalidateAll();
  return { error: null };
}

// Öncelik: oturum açmış her ekip üyesi değiştirebilir (rol veya atayan/alan
// fark etmez). Diğer alanlar etkilenmez; veritabanı kuralları da buna izin verir.
export async function updateTaskPriority(
  taskId: string,
  priority: TaskPriority,
): Promise<ActionResult> {
  await getUserId(); // oturum kontrolü
  if (!isUuid(taskId)) return { error: "Geçersiz görev." };
  if (!isTaskPriority(priority)) return { error: "Geçersiz öncelik." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ priority })
    .eq("id", taskId)
    .select("id");

  if (error) return { error: dbError(error, "Öncelik değiştirilemedi.") };
  if (!data.length) return { error: "Görev bulunamadı (silinmiş olabilir)." };

  revalidateAll();
  return { error: null };
}
