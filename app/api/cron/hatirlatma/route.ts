import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cronAuthorized } from "@/lib/cron-auth";
import { sendPushNow } from "@/lib/push";
import { todayKey } from "@/lib/days";
import { addDays, shortDay } from "@/lib/due";
import { sendSubscriptionReminders } from "@/lib/subscription-reminders";
import { currentSlot, openRecurringTasks } from "@/lib/recurring-run";

// Sabah işleri. Supabase (pg_cron) her sabah bu adresi çağırır
// (bkz. supabase/hatirlatma.sql). Oturum yoktur; istek CRON_SECRET ile korunur.
// Önce saati gelmiş tekrarlayan görevler açılır (asıl işi saat başı çalışan
// api/cron/tekrar yapar; buradaki çağrı yedektir, bkz. lib/recurring-run), sonra
// teslim tarihi hatırlatmaları gönderilir:
//   yarın teslim  → sorumluya
//   bugün teslim  → sorumluya
//   gecikti       → sorumluya ve atayana
// Sorumlu "Herkes" ise (henüz kimse almadıysa) atayana gider.
// Ayrıca abonelikler: yenileme, son ödeme, bitiş ya da taahhüt sonu yarınsa sahibine.
// Her hatırlatma görev başına bir kez gider (task_reminders); teslim tarihi
// değişince veritabanı bu kayıtları siler ve hatırlatmalar yeniden başlar.

type Kind = "tomorrow" | "today" | "overdue";

// Tekrarlayan görev az önce açıldıysa "yeni görev" bildirimi zaten gitmiştir
const JUST_OPENED_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!cronAuthorized(request)) {
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

  // Tekrarlayan görevler: bu saate kadar açılması gerekenler. Açılan görev için "yeni
  // görev" bildirimi zaten gider; aynı çağrıda bir de teslim hatırlatması gönderilmez.
  const slot = currentSlot();
  const opened = await openRecurringTasks(admin, slot.day, slot.hour).catch(() => null);
  const openedIds = new Set(opened?.taskIds ?? []);
  const recurring = opened
    ? { checked: opened.checked, opened: opened.opened }
    : { error: "Tekrarlayan görevler açılamadı." };

  const { data: tasks, error } = await admin
    .from("tasks")
    .select("id, title, due_date, assigned_to, created_by, recurring_id, created_at")
    .neq("status", "done")
    .not("due_date", "is", null)
    .lte("due_date", tomorrow);
  if (error) {
    return NextResponse.json({ error: "Görevler okunamadı.", subscriptions, recurring }, { status: 500 });
  }

  const kindOf = (due: string): Kind => (due === tomorrow ? "tomorrow" : due === today ? "today" : "overdue");
  // Saat başı işi aynı dakikada açmış olabilir: az önce açılan tekrarlayan görev de atlanır
  const justOpened = (t: { recurring_id: string | null; created_at: string }) =>
    t.recurring_id !== null && Date.now() - new Date(t.created_at).getTime() < JUST_OPENED_MS;
  const candidates = (tasks ?? [])
    .filter((t) => !openedIds.has(t.id) && !justOpened(t))
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
