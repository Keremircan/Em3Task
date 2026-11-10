"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getMemberPermission, MEMBER_PERMISSION_KEY } from "@/lib/members";
import { isUuid } from "@/lib/tasks";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";

export type MemberResult = { error: string | null };

const NOT_CONFIGURED =
  "Üye yönetimi henüz yapılandırılmadı (sunucuda SUPABASE_SERVICE_ROLE_KEY tanımlı değil).";

// Oturumdaki kullanıcı üye ekleyip çıkarabilir mi? (Admin ya da ayar açıksa herkes)
export async function checkCanManageMembers(): Promise<boolean> {
  return (await getMemberPermission()).canManage;
}

function revalidateMembers() {
  // Üye listesi görev formlarında ve sidebar'da da kullanılıyor
  revalidatePath("/", "layout");
}

// Yeni üye: hesap e-posta onayı geçmiş olarak açılır; profil, veritabanındaki
// tetikleyiciyle full_name'den oluşur. id tarayıcıda üretilir ki listede anında
// beliren satır kayıttan sonra da aynı kalsın.
export async function addMember(input: {
  id: string;
  fullName: string;
  email: string;
  password: string;
}): Promise<MemberResult> {
  if (!(await checkCanManageMembers())) {
    return { error: "Üye ekleme yetkiniz yok." };
  }

  const fullName = String(input.fullName ?? "").trim().replace(/\s+/g, " ");
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (!isUuid(input.id)) return { error: "Geçersiz istek." };
  if (!fullName) return { error: "Ad soyad zorunludur." };
  if (fullName.length > 80) return { error: "Ad soyad en fazla 80 karakter olabilir." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Geçerli bir e-posta adresi girin." };
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalı." };
  if (password.length > 72) return { error: "Şifre en fazla 72 karakter olabilir." };

  const admin = createAdminClient();
  if (!admin) return { error: NOT_CONFIGURED };

  const { data, error } = await admin.auth.admin.createUser({
    id: input.id,
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    const exists = error.code === "email_exists" || /already been registered/i.test(error.message);
    if (exists) return { error: "Bu e-posta ile kayıtlı bir üye zaten var." };
    if (error.code === "weak_password") return { error: "Şifre çok zayıf; daha güçlü bir şifre seçin." };
    return { error: "Üye eklenemedi. Lütfen tekrar deneyin." };
  }

  // Tetikleyici profili oluşturur; adın doğru yazıldığından emin ol
  await admin.from("profiles").upsert({ id: data.user.id, full_name: fullName });

  revalidateMembers();
  return { error: null };
}

// Üyeyi çıkarır: hesap ve profil silinir.
// Üyenin ATADIĞI görevler de (yorumları ve ekleriyle) silinir: görevi sadece atayan
// silebildiği için, o gidince bu görevleri kimse silemezdi.
// Üyeye atanmış görevler, yazdığı yorumlar ve Genel mesajları kalır; "Eski üye" görünür.
// Admin rolündeki üye ve kişinin kendisi çıkarılamaz.
export async function removeMember(profileId: string): Promise<MemberResult> {
  const [user, canManage] = await Promise.all([getCurrentUser(), checkCanManageMembers()]);
  if (!canManage) return { error: "Üye çıkarma yetkiniz yok." };
  if (!isUuid(profileId)) return { error: "Geçersiz üye." };
  if (profileId === user.id) return { error: "Kendinizi üyelikten çıkaramazsınız." };

  const admin = createAdminClient();
  if (!admin) return { error: NOT_CONFIGURED };

  const { data: adminRoles, error: roleError } = await admin
    .from("member_roles")
    .select("role_id, roles!inner(is_system)")
    .eq("profile_id", profileId)
    .eq("roles.is_system", true);
  if (roleError) return { error: "Üye bilgisi okunamadı." };
  if (adminRoles.length) return { error: "Admin üyelikten çıkarılamaz." };

  // Atadığı görevler ve eklerinin depodaki dosyaları
  const { data: tasks, error: tasksError } = await admin
    .from("tasks")
    .select("id")
    .eq("created_by", profileId);
  if (tasksError) return { error: "Üyenin görevleri okunamadı." };
  if (tasks.length) {
    const taskIds = tasks.map((t) => t.id);
    const { data: files } = await admin
      .from("task_attachments")
      .select("file_url")
      .in("task_id", taskIds);
    const { error: deleteError } = await admin.from("tasks").delete().in("id", taskIds);
    if (deleteError) return { error: "Üyenin atadığı görevler silinemedi; üye çıkarılmadı." };
    if (files?.length) {
      await admin.storage.from(ATTACHMENTS_BUCKET).remove(files.map((f) => f.file_url));
    }
  }

  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) {
    if (error.status === 404) return { error: "Üye bulunamadı (zaten çıkarılmış olabilir)." };
    return { error: "Üye çıkarılamadı. Lütfen tekrar deneyin." };
  }

  revalidateMembers();
  return { error: null };
}

// Sadece Admin: diğer üyelerin de üye ekleyip çıkarmasına izin ver / verme.
// Kayıt normal oturumla yapılır; veritabanı kuralı (RLS) da sadece Admin'e izin verir.
export async function setMemberManagementPermission(allowAll: boolean): Promise<MemberResult> {
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: "Bu ayarı sadece Admin değiştirebilir." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ value: { allow_all_members: Boolean(allowAll) } })
    .eq("key", MEMBER_PERMISSION_KEY)
    .select("key");

  if (error || !data.length) return { error: "Ayar kaydedilemedi." };

  revalidatePath("/uyeler");
  return { error: null };
}
