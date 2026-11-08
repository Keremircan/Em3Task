"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { isUuid } from "@/lib/tasks";
import { parseSubscriptionForm } from "@/lib/subscriptions";
import type { Subscription } from "@/types/database";

// Abonelikler ve düzenli giderler. Gizlilik veritabanında (RLS: user_id = auth.uid())
// garanti altında; buradaki user_id filtreleri ek bir güvenlik katmanıdır.

export type SubscriptionResult = { error: string | null };
// Kaydedilen satır da döner; liste, sunucunun yenilenmiş hali gelmeden onu gösterir
export type SaveSubscriptionResult = SubscriptionResult & { subscription?: Subscription };

// id null → yeni kayıt; aksi halde o kayıt güncellenir (kategori de değişebilir)
export async function saveSubscription(id: string | null, formData: FormData): Promise<SaveSubscriptionResult> {
  const userId = await getUserId();
  if (id !== null && !isUuid(id)) return { error: "Geçersiz kayıt." };
  if (!(formData instanceof FormData)) return { error: "Geçersiz form." };

  const parsed = parseSubscriptionForm(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  let subscription: Subscription;
  if (id === null) {
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({ ...parsed.input, user_id: userId })
      .select("*")
      .single();
    if (error || !data) return { error: "Kayıt eklenemedi." };
    subscription = data;
  } else {
    const { data, error } = await supabase
      .from("subscriptions")
      .update(parsed.input)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*");
    if (error) return { error: "Kayıt güncellenemedi." };
    if (!data?.length) return { error: "Kayıt bulunamadı; silinmiş olabilir." };
    subscription = data[0];
  }

  revalidatePath("/abonelikler");
  return { error: null, subscription };
}

export async function deleteSubscription(id: string): Promise<SubscriptionResult> {
  const userId = await getUserId();
  if (!isUuid(id)) return { error: "Geçersiz kayıt." };

  const supabase = await createClient();
  const { error } = await supabase.from("subscriptions").delete().eq("id", id).eq("user_id", userId);
  if (error) return { error: "Kayıt silinemedi." };

  revalidatePath("/abonelikler");
  return { error: null };
}
