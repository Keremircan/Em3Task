import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { initials } from "@/lib/tasks";
import { logout } from "@/app/login/actions";
import { LiveUpdates } from "@/components/realtime/live-updates";
import { ZoomableAvatar } from "@/components/ui/avatar-lightbox";

// Sidebar'ın en altında her zaman görünen kullanıcı bilgisi ve güvenli çıkış
export async function SidebarFooter() {
  const user = await getCurrentUser();

  return (
    <div className="shrink-0 border-t border-white/[0.06] p-2.5">
      <div className="flex items-center gap-3 px-2 py-2">
        {user.avatarUrl ? (
          <ZoomableAvatar name={user.name} src={user.avatarUrl} size="sm" className="size-8" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold text-neutral-100">
            {initials(user.name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">{user.name}</p>
          <p className="flex items-center gap-2 truncate text-xs text-neutral-400">
            {user.isAdmin ? "Admin" : "Ekip üyesi"}
            <span aria-hidden className="text-neutral-600">·</span>
            {/* Realtime bağlantısı: ekipten gelen değişiklikleri anında yansıtır */}
            <LiveUpdates />
          </p>
        </div>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="mt-0.5 flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13px] text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200"
        >
          <LogOut className="size-4" strokeWidth={1.8} />
          Güvenli çıkış
        </button>
      </form>
    </div>
  );
}

export function SidebarFooterSkeleton() {
  return (
    <div className="shrink-0 border-t border-white/[0.06] p-2.5">
      <div className="flex animate-pulse items-center gap-3 px-2 py-2">
        <div className="size-8 rounded-full bg-white/[0.06]" />
        <div className="h-4 w-28 rounded bg-white/[0.06]" />
      </div>
      <div className="mt-0.5 h-9 rounded-lg" />
    </div>
  );
}
