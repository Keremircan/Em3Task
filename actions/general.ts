"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser, getUserId } from "@/lib/auth";
import { clip, notifyUsers } from "@/lib/push";
import { isUuid } from "@/lib/tasks";
import {
  GENERAL_BUCKET,
  generalFileType,
  MAX_GENERAL_FILE_BYTES,
} from "@/lib/general-files";

export type GeneralResult = { error: string | null };
export type SendMessageResult = GeneralResult & { messageId: string | null };

const MAX_MESSAGE_LENGTH = 20_000;

function revalidateGeneral() {
  revalidatePath("/genel");
}

export type UploadedFile = {
  path: string; // tarayıcının 'general-files' deposuna yüklediği yol
  name: string;
  size: number;
};

// Depo yolu biçimi: <klasör-uuid>/<dosya-uuid>.<uzantı>
const PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.([a-z0-9]+)$/;

// Mesajı ve (varsa) dosya kayıtlarını tek seferde kaydeder.
// Dosyaların kendisi tarayıcıdan depoya paralel yüklenmiş olur: hem hızlı
// hem de sunucu istek boyutu sınırına (11 MB) takılmaz.
// receiverId: null → herkese açık; bir üye → sadece gönderen ve o üye görür
// (gizlilik veritabanı kurallarıyla da korunur).
export async function sendGeneralMessage(
  content: string,
  files: UploadedFile[],
  receiverId: string | null = null,
): Promise<SendMessageResult> {
  const userId = await getUserId();
  const text = String(content ?? "").trim();
  const list = Array.isArray(files) ? files.slice(0, 20) : [];

  if (!text && !list.length) return { error: "Mesaj boş olamaz.", messageId: null };
  const receiver = receiverId ?? null;
  if (receiver !== null && !isUuid(receiver)) return { error: "Geçersiz alıcı.", messageId: null };
  if (receiver === userId) return { error: "Kendinize özel mesaj gönderemezsiniz.", messageId: null };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { error: "Mesaj çok uzun (en fazla 20.000 karakter).", messageId: null };
  }

  // Dosya bilgilerini doğrula (tür uzantıdan; yol bizim biçimimizde olmalı)
  const rows: { file_url: string; file_name: string; file_type: string; file_size: number }[] = [];
  for (const f of list) {
    const match = typeof f?.path === "string" ? PATH_RE.exec(f.path) : null;
    const type = generalFileType(String(f?.name ?? ""));
    if (!match || !type || match[1] !== type.ext) {
      return { error: "Geçersiz dosya bilgisi.", messageId: null };
    }
    const size = Number(f.size);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_GENERAL_FILE_BYTES) {
      return { error: "Dosya en fazla 10 MB olabilir.", messageId: null };
    }
    rows.push({
      file_url: f.path,
      file_name: String(f.name).trim().slice(0, 255),
      file_type: type.mime,
      file_size: size,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("general_messages")
    .insert({ user_id: userId, receiver_id: receiver, content: text })
    .select("id")
    .single();

  if (error) {
    await removeUploads(supabase, rows.map((r) => r.file_url));
    // 23503: alıcı bulunamadı (ekipten çıkarılmış olabilir)
    if (error.code === "23503") {
      return { error: "Alıcı bulunamadı (ekipten çıkarılmış olabilir).", messageId: null };
    }
    return { error: "Mesaj gönderilemedi. Lütfen tekrar deneyin.", messageId: null };
  }

  if (rows.length) {
    const { error: filesError } = await supabase
      .from("general_files")
      .insert(rows.map((r) => ({ ...r, message_id: data.id, uploaded_by: userId })));
    if (filesError) {
      // Yarım kalmasın: mesajı ve yüklenen dosyaları geri al
      await supabase.from("general_messages").delete().eq("id", data.id);
      await removeUploads(supabase, rows.map((r) => r.file_url));
      return { error: "Dosyalar kaydedilemedi. Lütfen tekrar deneyin.", messageId: null };
    }
  }

  // Bildirim: herkese açık mesaj yazan hariç tüm ekibe, özel mesaj SADECE alıcıya.
  // Etiket sabit: art arda gelen mesajlar telefonda üst üste yığılmaz.
  const [user, { data: members }] = await Promise.all([
    getCurrentUser(),
    receiver ? Promise.resolve({ data: [{ id: receiver }] }) : supabase.from("profiles").select("id"),
  ]);
  const fileNote = rows.length === 1 ? "📎 1 dosya" : `📎 ${rows.length} dosya`;
  notifyUsers(
    (members ?? []).map((m) => m.id),
    {
      title: receiver ? `🔒 Özel mesaj · ${user.name}` : `Genel · ${user.name}`,
      body: text ? clip(text) : fileNote,
      url: "/genel",
      tag: receiver ? `dm-${userId}` : "genel",
    },
    userId,
  );

  revalidateGeneral();
  return { error: null, messageId: data.id };
}

// Gönderim iptal olursa tarayıcının yüklediği dosyaları temizler
export async function discardGeneralUploads(paths: string[]): Promise<GeneralResult> {
  await getUserId();
  const valid = (Array.isArray(paths) ? paths : []).filter(
    (p) => typeof p === "string" && PATH_RE.test(p),
  );
  if (valid.length) await removeUploads(await createClient(), valid);
  return { error: null };
}

async function removeUploads(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  if (paths.length) await supabase.storage.from(GENERAL_BUCKET).remove(paths);
}

// Mesajı sahibi ya da Admin siler (yetki RLS ile); ekli dosyalar da kalkar
export async function deleteGeneralMessage(messageId: string): Promise<GeneralResult> {
  await getUserId();
  if (!isUuid(messageId)) return { error: "Geçersiz mesaj." };

  const supabase = await createClient();
  const { data: files } = await supabase
    .from("general_files")
    .select("file_url")
    .eq("message_id", messageId);

  const { data, error } = await supabase
    .from("general_messages")
    .delete()
    .eq("id", messageId)
    .select("id");

  if (error) return { error: "Mesaj silinemedi." };
  if (!data.length) return { error: "Sadece kendi mesajınızı silebilirsiniz." };

  if (files?.length) await removeUploads(supabase, files.map((f) => f.file_url));

  revalidateGeneral();
  return { error: null };
}

// Dokümanı yükleyen ya da Admin siler. Mesaj sadece bu dosyadan ibaretse
// (metni yok, başka dosyası yok) boş kalmasın diye mesaj da silinir.
export async function deleteGeneralFile(fileId: string): Promise<GeneralResult> {
  await getUserId();
  if (!isUuid(fileId)) return { error: "Geçersiz dosya." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("general_files")
    .delete()
    .eq("id", fileId)
    .select("file_url, message_id");

  if (error) return { error: "Dosya silinemedi." };
  if (!data.length) return { error: "Sadece kendi yüklediğiniz dosyayı silebilirsiniz." };

  const { file_url, message_id } = data[0];
  await removeUploads(supabase, [file_url]);

  const [{ data: message }, { count }] = await Promise.all([
    supabase.from("general_messages").select("content").eq("id", message_id).maybeSingle(),
    supabase
      .from("general_files")
      .select("*", { count: "exact", head: true })
      .eq("message_id", message_id),
  ]);
  if (message && !message.content.trim() && !count) {
    await supabase.from("general_messages").delete().eq("id", message_id);
  }

  revalidateGeneral();
  return { error: null };
}
