"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { isUuid } from "@/lib/tasks";

export type NotificationResult = { error: string | null };

// Okunan bildirim silinir (RLS: kişi sadece kendi bildirimini silebilir)
export async function dismissNotification(id: string): Promise<NotificationResult> {
  await getUserId();
  if (!isUuid(id)) return { error: "Geçersiz bildirim." };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) return { error: "Bildirim silinemedi." };
  revalidatePath("/", "layout");
  return { error: null };
}

// Tümünü okundu say: kişinin bütün bildirimleri silinir
export async function clearAllNotifications(): Promise<NotificationResult> {
  const userId = await getUserId();
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").delete().eq("recipient_id", userId);
  if (error) return { error: "Bildirimler silinemedi." };
  revalidatePath("/", "layout");
  return { error: null };
}
