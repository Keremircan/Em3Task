import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isRecentRecovery } from "@/lib/recovery";
import { AuthShell, authSubmit } from "@/components/auth/auth-shell";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = {
  title: "Yeni şifre · Em3Task",
};

// E-postadaki şifre sıfırlama bağlantısı (/auth/confirm) buraya yönlendirir.
// Oturum yoksa proxy zaten /login'e gönderir.
export default function NewPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="Yeni şifre" description="Yükleniyor…">{null}</AuthShell>}>
      <NewPassword />
    </Suspense>
  );
}

async function NewPassword() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  if (!isRecentRecovery(claims)) {
    return (
      <AuthShell
        title="Bağlantının süresi doldu"
        description="Yeni şifre sadece e-postadaki sıfırlama bağlantısıyla, açıldıktan sonraki 15 dakika içinde belirlenebilir."
      >
        <div className="flex flex-col gap-3">
          <Link href="/sifremi-unuttum" className={authSubmit}>
            Yeni bağlantı iste
          </Link>
          <Link href="/" className="text-center text-[13px] font-medium text-slate-500 hover:text-slate-800">
            Ana sayfaya dön
          </Link>
        </div>
      </AuthShell>
    );
  }

  const email = typeof claims.email === "string" ? claims.email : "";
  return (
    <AuthShell
      title="Yeni şifre belirleyin"
      description={email ? `${email} hesabı için yeni bir şifre seçin.` : "Hesabınız için yeni bir şifre seçin."}
    >
      <NewPasswordForm email={email} />
    </AuthShell>
  );
}
