"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { isUuid } from "@/lib/tasks";

export type NotificationResult = { error: string | null };

// Okundu işaretle (RLS: sadece kendi bildirimi; sadece okundu bilgisi değişebilir)
export async function markNotificationRead(id: string): Promise<NotificationResult> {
  await getUserId();
  if (!isUuid(id)) return { error: "Geçersiz bildirim." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) return { error: "Bildirim güncellenemedi." };
  revalidatePath("/", "layout");
  return { error: null };
}

export async function markAllNotificationsRead(): Promise<NotificationResult> {
  const userId = await getUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (error) return { error: "Bildirimler güncellenemedi." };
  revalidatePath("/", "layout");
  return { error: null };
}
