import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { isRecentRecovery } from "@/lib/recovery";
import { AuthShell, authSubmit } from "@/components/auth/auth-shell";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = {
  title: "Yeni şifre · Em3Task",
};

// E-postadaki şifre sıfırlama bağlantısı (/auth/confirm) buraya kodla (token_hash)
// yönlendirir. Sayfa girişsiz açılır (proxy'de herkese açık); kod, yeni şifre
// kaydedilirken doğrulanır. Kod yoksa son 15 dakikada sıfırlama bağlantısıyla açılmış
// bir oturum da yeterli (Supabase'in varsayılan ?code= bağlantısı).
export default function NewPasswordPage({ searchParams }: PageProps<"/sifre-yenile">) {
  return (
    <Suspense fallback={<AuthShell title="Yeni şifre" description="Yükleniyor…">{null}</AuthShell>}>
      <NewPassword searchParams={searchParams} />
    </Suspense>
  );
}

async function NewPassword({ searchParams }: Pick<PageProps<"/sifre-yenile">, "searchParams">) {
  const { token_hash, type } = await searchParams;
  const tokenHash = typeof token_hash === "string" && type === "recovery" && token_hash.length <= 200 ? token_hash : "";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const recovered = isRecentRecovery(claims);

  if (!tokenHash && !recovered) {
    return (
      <AuthShell
        title="Bağlantı gerekli"
        description="Yeni şifre, e-postanıza gelen sıfırlama bağlantısıyla belirlenir. Bağlantıyı e-postadan yeniden açın; süresi dolduysa yeni bir bağlantı isteyin."
      >
        <div className="flex flex-col gap-3">
          <Link href="/sifremi-unuttum" className={authSubmit}>
            Yeni bağlantı iste
          </Link>
          <Link href="/login" className="text-center text-[13px] font-medium text-slate-500 hover:text-slate-800">
            Giriş sayfasına dön
          </Link>
        </div>
      </AuthShell>
    );
  }

  // E-posta sadece oturum varken bilinir; kodla gelende kod henüz doğrulanmadı
  const email = recovered && typeof claims?.email === "string" ? claims.email : "";
  return (
    <AuthShell
      title="Yeni şifre belirleyin"
      description={email ? `${email} hesabı için yeni bir şifre seçin.` : "Hesabınız için yeni bir şifre seçin."}
    >
      <NewPasswordForm email={email} tokenHash={tokenHash} />
    </AuthShell>
  );
}
