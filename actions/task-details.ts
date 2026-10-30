"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser, getUserId } from "@/lib/auth";
import { getTeamMembers } from "@/lib/team";
import { findMentions } from "@/lib/mentions";
import { clip, notifyUsers } from "@/lib/push";
import { isUuid } from "@/lib/tasks";
import {
  ALLOWED_ATTACHMENT_TYPES,
  ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/attachments";

export type ActionResult = { error: string | null };

const MAX_COMMENT_LENGTH = 20_000;

function revalidateTaskPages() {
  revalidatePath("/gorevler/[id]", "page");
  revalidatePath("/", "layout");
}

export async function addComment(
  taskId: string,
  content: string,
): Promise<ActionResult> {
  const userId = await getUserId();

  const text = String(content ?? "").trim();
  if (!isUuid(taskId)) return { error: "Geçersiz görev." };
  if (!text) return { error: "Yorum boş olamaz." };
  if (text.length > MAX_COMMENT_LENGTH) {
    return { error: "Yorum çok uzun (en fazla 20.000 karakter)." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, user_id: userId, content: text });

  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Görev bulunamadı."
          : "Yorum kaydedilemedi. Lütfen tekrar deneyin.",
    };
  }

  // Anılan kişilere "sizi andı", görevi atayana ve sorumlusuna "yeni yorum"
  // (yorumu yazan hariç; anılan kişiye iki kez bildirim gitmez)
  const [{ data: task }, user, team] = await Promise.all([
    supabase.from("tasks").select("title, created_by, assigned_to").eq("id", taskId).maybeSingle(),
    getCurrentUser(),
    getTeamMembers(),
  ]);
  if (task) {
    const mentioned = findMentions(text, team).filter((id) => id !== userId);
    notifyUsers(
      mentioned,
      {
        title: `${user.name} sizi bir yorumda andı`,
        body: `${clip(task.title, 60)}: ${clip(text)}`,
        url: `/gorevler/${taskId}#yorumlar`,
        tag: `task-${taskId}`,
        kind: "mention",
      },
      userId,
    );
    notifyUsers(
      [task.created_by, task.assigned_to].filter((id) => !id || !mentioned.includes(id)),
      {
        title: `Yeni yorum: ${clip(task.title, 60)}`,
        body: `${user.name}: ${clip(text)}`,
        url: `/gorevler/${taskId}`,
        tag: `task-${taskId}`,
        kind: "comment",
      },
      userId,
    );
  }

  revalidateTaskPages();
  return { error: null };
}

export async function uploadAttachment(
  taskId: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getUserId();
  if (!isUuid(taskId)) return { error: "Geçersiz görev." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Yüklenecek bir dosya seçin." };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { error: "Dosya en fazla 10 MB olabilir." };
  }
  const ext = ALLOWED_ATTACHMENT_TYPES[file.type];
  if (!ext) {
    return { error: "Sadece görsel (PNG, JPG, GIF, WEBP) ve PDF yüklenebilir." };
  }

  const supabase = await createClient();

  // Depoda güvenli, benzersiz bir ad; asıl dosya adı tabloda saklanır
  const path = `${taskId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return {
      error: /bucket not found/i.test(uploadError.message)
        ? "Storage bucket'ı bulunamadı (supabase/storage.sql çalıştırılmalı)."
        : "Dosya yüklenemedi. Lütfen tekrar deneyin.",
    };
  }

  const fileName = file.name.trim().slice(0, 255) || `dosya.${ext}`;
  const { error: insertError } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    file_url: path, // özel bucket: görüntülerken süreli imzalı link üretilir
    file_name: fileName,
    file_type: file.type,
    uploaded_by: userId,
  });

  if (insertError) {
    // Kaydı tutulamayan dosyayı depoda sahipsiz bırakma
    // (görev silinmişse kayıt yabancı anahtar yüzünden reddedilir)
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
    return {
      error:
        insertError.code === "23503"
          ? "Görev bulunamadı."
          : "Dosya kaydedilemedi. Lütfen tekrar deneyin.",
    };
  }

  revalidateTaskPages();
  return { error: null };
}

// Yorumu sahibi ya da Admin siler (yetki RLS ile kontrol edilir)
export async function deleteComment(commentId: string): Promise<ActionResult> {
  await getUserId();
  if (!isUuid(commentId)) return { error: "Geçersiz yorum." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", commentId)
    .select("id");

  if (error) return { error: "Yorum silinemedi." };
  if (!data.length) return { error: "Sadece kendi yorumunuzu silebilirsiniz." };

  revalidateTaskPages();
  return { error: null };
}

// Eki yükleyen ya da Admin siler; dosya depodan da kaldırılır
export async function deleteTaskAttachment(attachmentId: string): Promise<ActionResult> {
  await getUserId();
  if (!isUuid(attachmentId)) return { error: "Geçersiz dosya." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId)
    .select("file_url");

  if (error) return { error: "Dosya silinemedi." };
  if (!data.length) return { error: "Sadece kendi yüklediğiniz dosyayı silebilirsiniz." };

  await supabase.storage.from(ATTACHMENTS_BUCKET).remove(data.map((d) => d.file_url));

  revalidateTaskPages();
  return { error: null };
}

// Yorumu düzenle: sadece yazan kişi; sadece içerik değişir (veritabanı kuralı da
// bunu zorunlu kılar ve "düzenlendi" zamanını kendisi yazar)
export async function editComment(commentId: string, content: string): Promise<ActionResult> {
  await getUserId();
  const text = String(content ?? "").trim();
  if (!isUuid(commentId)) return { error: "Geçersiz yorum." };
  if (!text) return { error: "Yorum boş olamaz." };
  if (text.length > MAX_COMMENT_LENGTH) return { error: "Yorum çok uzun (en fazla 20.000 karakter)." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .update({ content: text })
    .eq("id", commentId)
    .select("id");
  if (error) return { error: "Yorum güncellenemedi." };
  if (!data.length) return { error: "Sadece kendi yorumunuzu düzenleyebilirsiniz." };

  revalidateTaskPages();
  return { error: null };
}
