import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cronAuthorized } from "@/lib/cron-auth";
import { currentSlot, openRecurringTasks } from "@/lib/recurring-run";

// Saat başı işi. Supabase (pg_cron) her saat başı bu adresi çağırır
// (bkz. supabase/tekrar-saati.sql). Oturum yoktur; istek CRON_SECRET ile korunur.
// Açılış günü gelmiş ve seçilen saati gelmiş tekrarlayan görevler açılır
// (bkz. lib/recurring-run). Aynı saatte iki kez çağrılsa da görev bir kez açılır.
export async function POST(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Sunucu yapılandırılmamış." }, { status: 500 });

  const { day, hour } = currentSlot();
  try {
    const result = await openRecurringTasks(admin, day, hour);
    return NextResponse.json({ day, hour, checked: result.checked, opened: result.opened });
  } catch {
    return NextResponse.json({ error: "Tekrarlayan görevler açılamadı." }, { status: 500 });
  }
}
