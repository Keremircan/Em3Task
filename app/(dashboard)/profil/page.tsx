import { Suspense } from "react";
import type { Metadata } from "next";
import { Bell, CalendarDays, CircleCheck, IdCard, KeyRound, Palette } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser, getUserId } from "@/lib/auth";
import { card } from "@/components/ui/styles";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { NotificationSettings } from "@/components/profile/notification-settings";
import { PasswordForm } from "@/components/profile/password-form";
import { AccountForm } from "@/components/profile/account-form";
import { ThemeSelect } from "@/components/theme/theme-select";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Profil · Em3Task" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Profil"
        label="HESAP"
        description="Fotoğrafınız, hesap bilgileriniz, şifreniz ve bildirim ayarlarınız."
      />
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile />
      </Suspense>
    </>
  );
}

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

async function Profile() {
  // Kimlik yerelde okunur (Supabase isteği yok); kullanıcı bilgisi ve sayfa
  // sorguları aynı turda, paralel gider
  const [userId, supabase] = await Promise.all([getUserId(), createClient()]);

  // Tamamladığı görevler: sorumlusu olduğu ve "Tamamlandı" durumundaki görevler
  const [user, { count: completed }, { data: profile }] = await Promise.all([
    getCurrentUser(),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "done"),
    supabase.from("profiles").select("created_at").eq("id", userId).maybeSingle(),
  ]);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
          <AvatarUploader userId={user.id} name={user.name} avatarUrl={user.avatarUrl} />
          <div className="min-w-0 text-center sm:text-right">
            <p className="truncate text-lg font-bold text-slate-900">{user.name}</p>
            <p className="truncate text-sm text-slate-500">{user.email}</p>
            {user.isAdmin && (
              <span className="mt-1.5 inline-block rounded-md bg-teal-50 px-1.5 py-0.5 text-[11px] font-bold text-teal-700">
                Admin
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat
          icon={<CircleCheck className="size-5" />}
          label="Tamamladığı görev"
          value={String(completed ?? 0)}
        />
        <Stat
          icon={<CalendarDays className="size-5" />}
          label="Katılma tarihi"
          value={profile?.created_at ? dateFormat.format(new Date(profile.created_at)) : "—"}
        />
      </div>

      <section className={`${card} p-5 sm:p-6`}>
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <IdCard className="size-4.5 text-slate-400" /> Hesap bilgileri
        </h2>
        {/* key: kayıttan sonra sunucudan gelen yeni değerlerle form sıfırlansın */}
        <AccountForm key={`${user.name}|${user.email}`} name={user.name} email={user.email} />
      </section>

      <section className={`${card} p-5 sm:p-6`}>
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <KeyRound className="size-4.5 text-slate-400" /> Şifre değiştir
        </h2>
        <PasswordForm />
      </section>

      <section className={`${card} p-5 sm:p-6`}>
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <Palette className="size-4.5 text-slate-400" /> Görünüm
        </h2>
        <ThemeSelect />
      </section>

      <section className={`${card} p-5 sm:p-6`}>
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
          <Bell className="size-4.5 text-slate-400" /> Bildirimler
        </h2>
        <NotificationSettings />
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={`${card} flex items-center gap-4 p-5`}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="truncate text-xl font-bold text-slate-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4" aria-hidden>
      <div className={`${card} h-36 animate-pulse`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${card} h-24 animate-pulse`} />
        <div className={`${card} h-24 animate-pulse`} />
      </div>
      <div className={`${card} h-32 animate-pulse`} />
      <div className={`${card} h-64 animate-pulse`} />
    </div>
  );
}
