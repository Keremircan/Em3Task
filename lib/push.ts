import "server-only";
import { after } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/utils/supabase/admin";

// Web Push gönderimi (sadece sunucu). Abonelikler service role ile okunur,
// süresi dolmuş/iptal edilmiş abonelikler (404/410) otomatik silinir.

export type PushPayload = {
  title: string;
  body: string;
  url: string; // site içi yol, ör. /gorevler/<id>
  tag?: string; // aynı etiketli yeni bildirim eskisinin yerine geçer
  kind?: string; // bildirim merkezindeki simge/tür (task, comment, mention, general, due…)
};

type NotifyOptions = {
  store?: boolean; // bildirim merkezine kaydet (varsayılan: evet)
};

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@em3task.app";
  configured = Boolean(publicKey && privateKey);
  if (configured) webpush.setVapidDetails(subject, publicKey!, privateKey!);
  return configured;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

async function deliver(userIds: string[], payload: PushPayload) {
  if (!userIds.length || !configure()) return;
  const admin = createAdminClient();
  if (!admin) return;

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (!subs?.length) return;

  const body = JSON.stringify(payload);
  const expired: string[] = [];

  await Promise.allSettled(
    subs.map((s) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 60 * 60 * 24, // cihaz kapalıysa 1 gün boyunca teslim edilmeye çalışılır
          urgency: "high",
          timeout: 8000,
        })
        .catch((err: { statusCode?: number }) => {
          if (err?.statusCode === 404 || err?.statusCode === 410) expired.push(s.id);
        }),
    ),
  );

  if (expired.length) await admin.from("push_subscriptions").delete().in("id", expired);
}

// Bildirim merkezine (🔔) kaydeder: telefon bildirimi izni olmayanlar da görür
async function store(userIds: string[], payload: PushPayload, actorId: string | null) {
  const admin = createAdminClient();
  if (!admin || !userIds.length) return;
  await admin.from("notifications").insert(
    userIds.map((id) => ({
      recipient_id: id,
      actor_id: actorId,
      kind: (payload.kind ?? "general").slice(0, 30),
      title: payload.title.slice(0, 200),
      body: payload.body.slice(0, 500),
      url: payload.url.startsWith("/") ? payload.url.slice(0, 300) : "/",
    })),
  );
}

// Bildirimi hemen gönderir ve bitmesini bekler (zamanlanmış görevler için)
export async function sendPushNow(userIds: string[], payload: PushPayload) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  await Promise.allSettled([store(ids, payload, null), isPushConfigured() ? deliver(ids, payload) : null]);
}

// Bildirimi yanıt gönderildikten sonra yollar: kullanıcının işlemi beklemez.
// Hem bildirim merkezine kaydedilir hem (izin verenlere) telefona gider.
// İşlemi yapan kişiye kendi bildirimi gitmez.
export function notifyUsers(
  userIds: (string | null | undefined)[],
  payload: PushPayload,
  exceptUserId?: string,
  options: NotifyOptions = {},
) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id) && id !== exceptUserId))];
  if (!ids.length) return;
  const keep = options.store !== false;
  after(async () => {
    await Promise.allSettled([
      keep ? store(ids, payload, exceptUserId ?? null) : null,
      isPushConfigured() ? deliver(ids, payload) : null,
    ]);
  });
}

// Bildirim metinleri kısa kalsın
export function clip(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
