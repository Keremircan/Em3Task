import { Suspense } from "react";
import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import { AuthShell, authError } from "@/components/auth/auth-shell";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = {
  title: "Şifremi unuttum · Em3Task",
};

export default function ForgotPasswordPage({ searchParams }: PageProps<"/sifremi-unuttum">) {
  return (
    <AuthShell
      title="Şifremi unuttum"
      description="Hesabınızın e-posta adresini girin; yeni şifre belirlemeniz için bir bağlantı gönderelim."
      footer="E-posta gelmezse yöneticinizden yardım isteyin."
    >
      <Suspense fallback={null}>
        <LinkProblem searchParams={searchParams} />
      </Suspense>
      <ResetRequestForm />
    </AuthShell>
  );
}

// E-postadaki bağlantı açılamadıysa (/auth/confirm buraya yönlendirir)
async function LinkProblem({ searchParams }: Pick<PageProps<"/sifremi-unuttum">, "searchParams">) {
  const { hata } = await searchParams;
  if (hata !== "baglanti") return null;
  return (
    <p role="alert" className={`${authError} mb-4`}>
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      Bağlantı geçersiz ya da süresi dolmuş. Yeni bir bağlantı isteyin.
    </p>
  );
}
