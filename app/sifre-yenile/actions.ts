"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isRecentRecovery } from "@/lib/recovery";

export type NewPasswordState = { error: string | null; expired?: boolean };

const EXPIRED = "Bu bağlantı geçersiz ya da süresi dolmuş.";

// Yeni şifre kaydedilir. E-postadaki kod (token_hash) burada, şifreyle aynı istekte
// doğrulanır: kod ancak kullanıcı yeni şifresini gönderince harcanır. Kod yoksa
// son 15 dakikada sıfırlama bağlantısıyla açılmış bir oturum gerekir.
export async function setNewPassword(_prev: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const tokenHash = String(formData.get("token_hash") ?? "");

  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  if (password.length > 72) return { error: "Şifre en fazla 72 karakter olabilir." };
  if (password !== confirm) return { error: "Şifreler aynı değil." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Daha önceki bir denemede kod doğrulanıp oturum açıldıysa (ör. şifre zayıf
  // bulunduysa) kod tekrar kullanılmaz; oturumla devam edilir.
  if (!isRecentRecovery(data?.claims)) {
    if (!tokenHash || tokenHash.length > 200) return { error: EXPIRED, expired: true };
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (error) return { error: EXPIRED, expired: true };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Yeni şifre eski şifrenizle aynı olamaz." };
    if (error.code === "weak_password") return { error: "Şifre çok zayıf; daha güçlü bir şifre seçin." };
    return { error: "Şifre kaydedilemedi. Lütfen tekrar deneyin." };
  }

  redirect("/");
}
