"use server";

import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";

// Oturumdaki üyenin "son görülme" zamanını günceller. Gönderilen değerin
// önemi yok: veritabanı tetikleyicisi her zaman kendi saatini (now()) yazar.
// Sayfaları yeniden çizdirmez (revalidate yok); sadece hafif bir kayıt.
export async function touchLastSeen(): Promise<void> {
  const userId = await getUserId();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", userId);
}
