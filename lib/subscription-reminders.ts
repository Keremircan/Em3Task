import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendPushNow } from "@/lib/push";
import { addDays } from "@/lib/due";
import { remindersFor } from "@/lib/subscriptions";

// Abonelikler için bir gün kala hatırlatma (her sabahki zamanlanmış görev çağırır,
// bkz. app/api/cron/hatirlatma). Bildirim SADECE kaydın sahibine gider: bildirim
// merkezine (🔔, sadece alıcı okur) ve izin verdiyse telefonuna.
// Her hatırlatma kayıt + gün başına bir kez gider (subscription_reminders).
// Tablo henüz kurulmadıysa (supabase/abonelik-hatirlatma.sql) hiçbir şey gönderilmez.
export async function sendSubscriptionReminders(admin: SupabaseClient<Database>, today: string) {
  const { data: subscriptions, error } = await admin.from("subscriptions").select("*");
  if (error) return { error: "Abonelikler okunamadı." };

  const reminders = remindersFor(subscriptions ?? [], today);
  let sent = 0;
  for (const r of reminders) {
    // Önce kaydı yaz: aynı gün iki çağrı gelse bile bildirim bir kez gider
    const { error: claimError } = await admin
      .from("subscription_reminders")
      .insert({ subscription_id: r.subscription.id, kind: r.kind, due_on: r.on });
    if (claimError) continue;

    await sendPushNow([r.subscription.user_id], {
      title: r.title.slice(0, 120),
      body: r.body,
      url: "/abonelikler",
      tag: `abonelik-${r.subscription.id}-${r.kind}`,
      kind: "subscription",
    });
    sent++;
  }

  // Eski kayıtlar artık gerekmez
  await admin.from("subscription_reminders").delete().lt("due_on", addDays(today, -60));

  return { checked: subscriptions?.length ?? 0, sent };
}
