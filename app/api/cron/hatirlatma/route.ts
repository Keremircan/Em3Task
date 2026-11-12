import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendPushNow } from "@/lib/push";
import { todayKey } from "@/lib/days";
import { addDays, shortDay } from "@/lib/due";
import { sendSubscriptionReminders } from "@/lib/subscription-reminders";
import { openRecurringTasks } from "@/lib/recurring-run";

// Sabah işleri. Supabase (pg_cron) her sabah bu adresi çağırır
// (bkz. supabase/hatirlatma.sql). Oturum yoktur; istek CRON_SECRET ile korunur.
// Önce zamanı gelen tekrarlayan görevler açılır (bkz. lib/recurring-run), sonra
// teslim tarihi hatırlatmaları gönderilir:
//   yarın teslim  → sorumluya
//   bugün teslim  → sorumluya
//   gecikti       → sorumluya ve atayana
// Sorumlu "Herkes" ise (henüz kimse almadıysa) atayana gider.
// Ayrıca abonelikler: yenileme, son ödeme, bitiş ya da taahhüt sonu yarınsa sahibine.
// Her hatırlatma görev başına bir kez gider (task_reminders); teslim tarihi
// değişince veritabanı bu kayıtları siler ve hatırlatmalar yeniden başlar.

type Kind = "tomorrow" | "today" | "overdue";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 500 });

  const today = todayKey();
  const tomorrow = addDays(today, 1);

  // Abonelikler: bir gün kala sadece sahibine (bkz. lib/subscription-reminders).
  // Görevlerden bağımsız çalışır; biri hata verse de diğeri gönderilir.
  const subscriptions = await sendSubscriptionReminders(admin, today).catch(() => ({
    error: "Abonelik hatırlatmaları gönderilemedi.",
  }));

  // Tekrarlayan görevler: bugün açılması gerekenler. Açılan görev için "yeni görev"
  // bildirimi zaten gider; aynı çağrıda bir de teslim hatırlatması gönderilmez.
  const opened = await openRecurringTasks(admin, today).catch(() => null);
  const openedIds = new Set(opened?.taskIds ?? []);
  const recurring = opened
    ? { checked: opened.checked, opened: opened.opened }
    : { error: "Tekrarlayan görevler açılamadı." };

  const { data: tasks, error } = await admin
    .from("tasks")
    .select("id, title, due_date, assigned_to, created_by")
    .neq("status", "done")
    .not("due_date", "is", null)
    .lte("due_date", tomorrow);
  if (error) {
    return NextResponse.json({ error: "Görevler okunamadı.", subscriptions, recurring }, { status: 500 });
  }

  const kindOf = (due: string): Kind => (due === tomorrow ? "tomorrow" : due === today ? "today" : "overdue");
  const candidates = (tasks ?? [])
    .filter((t) => !openedIds.has(t.id))
    .map((t) => ({ ...t, kind: kindOf(t.due_date!) }));
  if (!candidates.length) return NextResponse.json({ checked: 0, sent: 0, subscriptions, recurring });

  const { data: sentRows } = await admin
    .from("task_reminders")
    .select("task_id, kind")
    .in(
      "task_id",
      candidates.map((t) => t.id),
    );
  const already = new Set((sentRows ?? []).map((r) => `${r.task_id}:${r.kind}`));
  const due = candidates.filter((t) => !already.has(`${t.id}:${t.kind}`));

  let sent = 0;
  for (const t of due) {
    // Önce kaydı yaz: aynı anda iki çağrı gelse bile bildirim bir kez gider
    const { error: claimError } = await admin
      .from("task_reminders")
      .insert({ task_id: t.id, kind: t.kind });
    if (claimError) continue;

    const owner = t.assigned_to ?? t.created_by;
    const recipients = t.kind === "overdue" ? [owner, t.created_by] : [owner];
    const title =
      t.kind === "tomorrow"
        ? "Yarın teslim: " + t.title
        : t.kind === "today"
          ? "Bugün teslim: " + t.title
          : "Gecikti: " + t.title;
    const body =
      t.kind === "overdue"
        ? `Teslim tarihi ${shortDay(t.due_date!)} idi; görev hâlâ tamamlanmadı.`
        : t.kind === "today"
          ? "Bu görevin teslim günü bugün."
          : `Teslim tarihi yarın (${shortDay(t.due_date!)}).`;

    await sendPushNow(
      recipients.filter((id): id is string => Boolean(id)),
      { title: title.slice(0, 120), body, url: `/gorevler/${t.id}`, tag: `due-${t.id}`, kind: "due" },
    );
    sent++;
  }

  return NextResponse.json({ checked: candidates.length, sent, subscriptions, recurring });
}
