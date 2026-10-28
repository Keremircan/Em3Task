"use server";

import { revalidatePath } from "next/cache";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { AVATARS_BUCKET, avatarPathFromUrl, isOwnAvatarPath, largeAvatarPath } from "@/lib/avatars";

export type ProfileResult = { error: string | null };

// Profil fotoğrafını ayarlar (path) ya da kaldırır (null).
// Dosyayı tarayıcı kendi klasörüne yükler; burada yolun gerçekten
// bu kullanıcının klasöründe olduğu doğrulanır. Eski fotoğraf depodan silinir.
export async function setAvatar(
  path: string | null,
): Promise<ProfileResult & { url?: string | null }> {
  const user = await getCurrentUser();
  if (path !== null && !isOwnAvatarPath(String(path), user.id)) {
    return { error: "Geçersiz fotoğraf." };
  }

  const supabase = await createClient();
  const url = path ? supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl : null;

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id)
    .select("id");
  if (error || !data.length) {
    if (path) await removeOwnFiles(user.id, [path, largeAvatarPath(path)]);
    return { error: "Profil fotoğrafı kaydedilemedi." };
  }

  const oldPath = avatarPathFromUrl(user.avatarUrl);
  if (oldPath && oldPath !== path) {
    await removeOwnFiles(user.id, [oldPath, largeAvatarPath(oldPath)]);
  }

  revalidatePath("/", "layout");
  return { error: null, url };
}

// Depodan silme sunucuda yapılır (kullanıcıya listeleme/okuma izni vermeden).
// Sadece kullanıcının kendi klasöründeki dosyalar silinebilir.
async function removeOwnFiles(userId: string, paths: string[]) {
  const own = paths.filter((p) => p.startsWith(`${userId}/`) && !p.includes(".."));
  const admin = createAdminClient();
  if (own.length && admin) await admin.storage.from(AVATARS_BUCKET).remove(own);
}

// Mevcut şifreyi ayrı, çerezsiz bir istemciyle doğrular; açılan geçici oturumu hemen kapatır.
// Doğruysa null, değilse hata mesajı döner.
async function verifyPassword(userId: string, email: string, password: string) {
  if (!password) return "Mevcut şifrenizi girin.";
  const verifier = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data, error } = await verifier.auth.signInWithPassword({ email, password });
  if (error || data.user?.id !== userId) {
    if (error?.status === 429) return "Çok fazla deneme. Birkaç dakika sonra tekrar deneyin.";
    return "Mevcut şifre yanlış.";
  }
  await verifier.auth.signOut({ scope: "local" });
  return null;
}

// Ad ve e-posta. Ad her zaman değiştirilebilir. E-posta değişikliği için mevcut şifre
// istenir; ekipteki adresler gerçek posta kutusu olmayabileceği için onay e-postası
// beklenmez, değişiklik sunucuda (service role) hemen uygulanır.
export async function updateAccount(input: {
  fullName: string;
  email: string;
  currentPassword?: string;
}): Promise<ProfileResult & { emailChanged?: boolean }> {
  const user = await getCurrentUser();
  const fullName = String(input?.fullName ?? "").trim().replace(/\s+/g, " ");
  const email = String(input?.email ?? "").trim().toLowerCase();

  if (!fullName) return { error: "Ad soyad boş olamaz." };
  if (fullName.length > 80) return { error: "Ad soyad en fazla 80 karakter olabilir." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { error: "Geçerli bir e-posta girin." };
  }

  const emailChanged = email !== user.email.toLowerCase();
  if (emailChanged) {
    const wrong = await verifyPassword(user.id, user.email, String(input?.currentPassword ?? ""));
    if (wrong) return { error: wrong };

    const admin = createAdminClient();
    if (!admin) return { error: "E-posta değişikliği sunucuda yapılandırılmamış." };

    // Supabase, kullanılan bir adreste anlaşılır bir hata kodu döndürmüyor; önceden kontrol et
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const taken = list?.users.some((u) => u.id !== user.id && u.email?.toLowerCase() === email);
    if (taken) return { error: "Bu e-posta başka bir üye tarafından kullanılıyor." };

    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email,
      email_confirm: true,
    });
    if (error) {
      const exists = error.code === "email_exists" || /already been registered/i.test(error.message);
      return { error: exists ? "Bu e-posta başka bir üye tarafından kullanılıyor." : "E-posta değiştirilemedi." };
    }
  }

  const supabase = await createClient();
  if (fullName !== user.name) {
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    if (error) return { error: "Ad kaydedilemedi.", emailChanged };
    // Bildirim/hesap bilgisinde de güncel ad dursun
    await supabase.auth.updateUser({ data: { full_name: fullName } });
  }

  // Oturumdaki e-posta bilgisi yeni adresle yenilensin
  if (emailChanged) await supabase.auth.refreshSession();

  revalidatePath("/", "layout");
  return { error: null, emailChanged };
}

// Şifre değiştirme: önce mevcut şifre doğrulanır (oturum çalınsa bile şifre
// bilinmeden değiştirilemesin), sonra yeni şifre kaydedilir.
export async function changePassword(current: string, next: string): Promise<ProfileResult> {
  const user = await getCurrentUser();
  const currentPassword = String(current ?? "");
  const newPassword = String(next ?? "");

  if (!currentPassword) return { error: "Mevcut şifrenizi girin." };
  if (newPassword.length < 8) return { error: "Yeni şifre en az 8 karakter olmalı." };
  if (newPassword.length > 72) return { error: "Yeni şifre en fazla 72 karakter olabilir." };
  if (newPassword === currentPassword) return { error: "Yeni şifre mevcut şifreden farklı olmalı." };

  const wrong = await verifyPassword(user.id, user.email, currentPassword);
  if (wrong) return { error: wrong };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    if (error.code === "same_password") return { error: "Yeni şifre mevcut şifreden farklı olmalı." };
    if (error.code === "reauthentication_needed") {
      return { error: "Güvenlik için çıkış yapıp tekrar giriş yapın, sonra yeniden deneyin." };
    }
    if (error.code === "weak_password") return { error: "Şifre çok zayıf; daha güçlü bir şifre seçin." };
    return { error: "Şifre değiştirilemedi. Lütfen tekrar deneyin." };
  }
  return { error: null };
}
