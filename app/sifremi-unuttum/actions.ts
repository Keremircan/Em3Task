"use server";

import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export type ResetRequestState = {
  error: string | null;
  sent: boolean;
  email: string;
};

// Şifre sıfırlama bağlantısı e-postayla gönderilir. Kayıtlı olmayan bir adres
// için de aynı yanıt döner: hangi e-postaların hesabı olduğu dışarıdan anlaşılmaz.
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 254) {
    return { error: "Geçerli bir e-posta adresi girin.", sent: false, email };
  }

  // Bağlantı, isteğin yapıldığı adrese döner (canlı site ya da yerel geliştirme)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const redirectTo = `${proto}://${host}/auth/confirm?next=/sifre-yenile`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return { error: "Çok fazla istek yapıldı. Birkaç dakika bekleyip tekrar deneyin.", sent: false, email };
    }
    return { error: "Bağlantı gönderilemedi. Lütfen tekrar deneyin.", sent: false, email };
  }
  return { error: null, sent: true, email };
}
