"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { writeErrorLog } from "@/lib/error-log";

// Tarayıcıda oluşan (sunucunun göremediği) hatayı kaydeder. Sadece giriş yapmış
// kullanıcıdan kabul edilir; girişsiz çağrı sessizce yok sayılır.
export async function reportClientError(input: {
  message: string;
  stack?: string | null;
  path?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;

  const message = typeof input?.message === "string" ? input.message : "";
  if (!message.trim()) return;
  const agent = (await headers()).get("user-agent");

  await writeErrorLog({
    source: "client",
    message,
    stack: typeof input.stack === "string" ? input.stack : null,
    path: typeof input.path === "string" ? input.path : null,
    userId,
    userAgent: agent,
  });
}

// Tüm kayıtları siler (sadece Admin; veritabanı kuralı da aynısını uygular)
export async function clearErrorLog(): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: "Hata kayıtlarını sadece Admin temizleyebilir." };

  const supabase = await createClient();
  const { error } = await supabase.from("error_log").delete().gte("id", 0);
  if (error) return { error: "Kayıtlar silinemedi." };

  revalidatePath("/hatalar");
  return { error: null };
}
