"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isRecentRecovery } from "@/lib/recovery";

export type NewPasswordState = { error: string | null };

// E-postadaki bağlantıyla açılan oturumda yeni şifre belirlenir
export async function setNewPassword(_prev: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  if (password.length > 72) return { error: "Şifre en fazla 72 karakter olabilir." };
  if (password !== confirm) return { error: "Şifreler aynı değil." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  if (!isRecentRecovery(data.claims)) {
    return { error: "Bağlantının süresi doldu. Şifremi unuttum sayfasından yeni bir bağlantı isteyin." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Yeni şifre eski şifrenizle aynı olamaz." };
    if (error.code === "weak_password") return { error: "Şifre çok zayıf; daha güçlü bir şifre seçin." };
    return { error: "Şifre kaydedilemedi. Lütfen tekrar deneyin." };
  }

  redirect("/");
}
