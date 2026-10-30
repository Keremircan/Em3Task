"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getUserId } from "@/lib/auth";
import { isPushConfigured, notifyUsers } from "@/lib/push";

export type PushResult = { error: string | null };

type SubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

function parse(input: SubscriptionInput) {
  const endpoint = String(input?.endpoint ?? "");
  const p256dh = String(input?.keys?.p256dh ?? "");
  const auth = String(input?.keys?.auth ?? "");
  const b64 = /^[A-Za-z0-9_-]+={0,2}$/;
  if (!/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 1000) return null;
  if (!b64.test(p256dh) || p256dh.length > 200 || !b64.test(auth) || auth.length > 100) return null;
  return { endpoint, p256dh, auth };
}

// Bu cihazın aboneliğini oturumdaki kullanıcıya bağlar.
// Aynı tarayıcı daha önce başka bir hesapla abone olduysa (ortak cihaz)
// abonelik yeni kullanıcıya geçer; bu yüzden kayıt sunucuda service role ile yapılır.
// Kullanıcı kimliği her zaman oturumdan alınır, istemciden gelmez.
export async function savePushSubscription(input: SubscriptionInput): Promise<PushResult> {
  const userId = await getUserId();
  const sub = parse(input);
  if (!sub) return { error: "Geçersiz bildirim aboneliği." };

  const admin = createAdminClient();
  if (!admin || !isPushConfigured()) return { error: "Bildirimler sunucuda yapılandırılmamış." };

  const { error } = await admin
    .from("push_subscriptions")
    .upsert({ ...sub, user_id: userId }, { onConflict: "endpoint" });
  if (error) return { error: "Bildirim aboneliği kaydedilemedi." };
  return { error: null };
}

// Bu cihazda bildirimleri kapat (sadece kendi aboneliğini siler; RLS de bunu zorunlu kılar)
export async function deletePushSubscription(endpoint: string): Promise<PushResult> {
  const userId = await getUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", String(endpoint ?? ""))
    .eq("user_id", userId);
  if (error) return { error: "Bildirimler kapatılamadı." };
  return { error: null };
}

// Kullanıcının kendine deneme bildirimi
export async function sendTestPush(): Promise<PushResult> {
  const userId = await getUserId();
  if (!isPushConfigured()) return { error: "Bildirimler sunucuda yapılandırılmamış." };
  notifyUsers([userId], {
    title: "Bildirimler açık",
    body: "Görev atandığında, yorum veya revize geldiğinde bu cihaza haber vereceğiz.",
    url: "/gorevlerim",
    tag: "test",
  }, undefined, { store: false });
  return { error: null };
}
