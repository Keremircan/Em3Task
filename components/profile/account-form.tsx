"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, LoaderCircle, Save } from "lucide-react";
import { updateAccount } from "@/actions/profile";
import { field, fieldLabel, primaryButton } from "@/components/ui/styles";
import { safe } from "@/lib/safe-action";

// Ad soyad ve e-posta. E-posta değişirse mevcut şifre istenir.
export function AccountForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(name);
  const [mail, setMail] = useState(email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const emailChanged = mail.trim().toLowerCase() !== email.toLowerCase();
  const dirty = fullName.trim() !== name || emailChanged;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setDone(null);
        if (!fullName.trim()) return setError("Ad soyad boş olamaz.");
        if (emailChanged && !password) return setError("E-postayı değiştirmek için mevcut şifrenizi girin.");

        setBusy(true);
        const result = await safe(updateAccount({ fullName, email: mail, currentPassword: password }));
        setBusy(false);
        if (result.error) return setError(result.error);
        setPassword("");
        setDone(
          result.emailChanged
            ? "Bilgileriniz kaydedildi. Bundan sonra yeni e-postanızla giriş yapın."
            : "Bilgileriniz kaydedildi.",
        );
        router.refresh();
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="acc-name" className={fieldLabel}>
            Ad Soyad
          </label>
          <input
            id="acc-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            maxLength={80}
            autoComplete="name"
            className={`${field} h-10`}
          />
        </div>
        <div>
          <label htmlFor="acc-email" className={fieldLabel}>
            E-posta
          </label>
          <input
            id="acc-email"
            type="email"
            value={mail}
            onChange={(e) => setMail(e.target.value)}
            required
            maxLength={254}
            autoComplete="email"
            className={`${field} h-10`}
          />
        </div>
      </div>

      {emailChanged && (
        <div>
          <label htmlFor="acc-password" className={fieldLabel}>
            Mevcut şifre
          </label>
          <input
            id="acc-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={`${field} h-10`}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Güvenlik için e-posta değişikliğinde mevcut şifreniz istenir. Girişte yeni e-postayı kullanırsınız.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}
      {done && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
          <CircleCheck className="size-4 shrink-0" /> {done}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={busy || !dirty} className={primaryButton}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Kaydet
        </button>
      </div>
    </form>
  );
}
