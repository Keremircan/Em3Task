"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, UserRound } from "lucide-react";
import { onThemeChange, setTheme } from "@/components/theme/theme";
import { logout } from "@/app/login/actions";
import { Menu } from "@/components/ui/menu";
import { Avatar } from "@/components/ui/avatar";
import { ZoomableAvatar } from "@/components/ui/avatar-lightbox";
import { initials } from "@/lib/tasks";
import { disablePushOnThisDevice } from "@/components/pwa/use-push-notifications";

// Sağ üstteki avatar: kullanıcı bilgisi, profil ve güvenli çıkış
export function UserMenu({
  name,
  email,
  isAdmin,
  avatarUrl,
}: {
  name: string;
  email: string;
  isAdmin: boolean;
  avatarUrl: string | null;
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
    const off = onThemeChange(sync);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => {
      off();
      mq.removeEventListener("change", sync);
    };
  }, []);

  return (
    <Menu
      label="Hesap menüsü"
      tone="dark"
      trigger={
        avatarUrl ? <Avatar name={name} src={avatarUrl} size="sm" className="size-8" /> : initials(name)
      }
      triggerClassName="flex size-8 items-center justify-center overflow-hidden rounded-full bg-white/[0.08] text-xs font-semibold text-neutral-100 transition hover:bg-white/[0.14]"
      header={
        <div className="mb-1 border-b border-white/10 px-3 pt-2 pb-2.5">
          {avatarUrl && (
            <div className="mb-2">
              <ZoomableAvatar name={name} src={avatarUrl} />
            </div>
          )}
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="truncate text-xs text-neutral-400">{email}</p>
          {isAdmin && (
            <span className="mt-1.5 inline-block rounded-md bg-teal-400/15 px-1.5 py-0.5 text-[11px] font-bold text-teal-300">
              Admin
            </span>
          )}
        </div>
      }
      items={[
        {
          label: "Profilim",
          icon: <UserRound className="size-4" />,
          onSelect: () => router.push("/profil"),
        },
        {
          // Hızlı geçiş: o an görünen temanın tersine sabitler (Profil'den "Sistem"e dönülebilir)
          label: dark ? "Açık tema" : "Koyu tema",
          icon: dark ? <Sun className="size-4" /> : <Moon className="size-4" />,
          onSelect: () => setTheme(dark ? "light" : "dark"),
        },
        {
          label: "Güvenli çıkış",
          icon: <LogOut className="size-4" />,
          danger: true,
          // Çıkışta bu cihazın bildirim aboneliği de kaldırılır: hesap kapalıyken bildirim gelmesin
          onSelect: () =>
            startTransition(async () => {
              await disablePushOnThisDevice();
              await logout();
            }),
        },
      ]}
    />
  );
}
