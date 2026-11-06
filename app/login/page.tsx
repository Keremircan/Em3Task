import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Giriş Yap · Em3Task",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Giriş yapın"
      description="Devam etmek için ekip hesabınızı kullanın."
      footer="Hesaplar yönetici tarafından oluşturulur."
    >
      <LoginForm />
    </AuthShell>
  );
}
