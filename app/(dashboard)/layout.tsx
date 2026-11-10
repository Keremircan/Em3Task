import { Suspense } from "react";
import { getCurrentUser, getUserId } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { RunningTimer } from "@/components/time/running-timer";
import { getProjects } from "@/lib/projects";
import { SidebarShell } from "./_components/sidebar-shell";
import { SidebarNav, SidebarNavList } from "./_components/sidebar-nav";
import { UserMenu } from "./_components/user-menu";
import { MobileTabBar, MobileTabBarList } from "./_components/mobile-tab-bar";
import { MobilePageTitle, MobileTitleText } from "./_components/mobile-page-title";
import { Logo } from "@/components/ui/logo";
import { Wordmark } from "@/components/ui/wordmark";
import { SidebarFooter, SidebarFooterSkeleton } from "./_components/sidebar-footer";
import { PresencePing } from "@/components/realtime/presence-ping";
import { SidebarSearch } from "./_components/sidebar-search";
import { getNotifications } from "@/lib/notifications";
import { getNavCounts } from "@/lib/nav-counts";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1 bg-[var(--app-canvas)]">
      {/* Klavyeyle ilk Tab'da görünür: menüdeki bağlantıları atlayıp sayfa içeriğine geçer */}
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3.5 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg"
      >
        İçeriğe geç
      </a>
      <SidebarShell
        mobileTitle={
          <Suspense fallback={<MobileTitleText label="PANO" title="Em3Task" />}>
            <MobileTitle />
          </Suspense>
        }
        mobileActions={
          <span className="lg:hidden">
            <Suspense fallback={<div className="size-8" />}>
              <Bell variant="mobile" />
            </Suspense>
          </span>
        }
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-4">
          <span className="flex min-w-0 items-center gap-2">
            <Logo size={26} className="rounded-[7px]" />
            <Wordmark className="text-[17px] text-white" />
          </span>
          <span className="flex items-center gap-1.5">
            <Suspense fallback={<div className="size-8" />}>
              <Bell variant="sidebar" />
            </Suspense>
            <Suspense fallback={<div className="size-8 rounded-full bg-white/[0.08]" />}>
              <SidebarUser />
            </Suspense>
          </span>
        </div>
        <SidebarSearch />
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarData />
        </Suspense>
        <Suspense fallback={null}>
          <SidebarTimer />
        </Suspense>
        <Suspense fallback={<SidebarFooterSkeleton />}>
          <SidebarFooter />
        </Suspense>
      </SidebarShell>

      {/* Mobilde üstte sabit çubuk, altta sekme çubuğu var: içerik ikisinin arasında kalır */}
      <main id="icerik" tabIndex={-1} className="flex min-w-0 flex-1 flex-col px-4 outline-none pt-[calc(4.25rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:pt-6 lg:pb-5">
        {/* flex: sayfalar (ör. proje panosu) kalan yüksekliği doldurabilir */}
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="mt-8 hidden text-xs text-slate-400 lg:block">
          © 2026 Em3Task · Ekip içi iş takip
        </footer>
      </main>

      {/* Üyenin "son görülme" zamanını kaydeder (Üyeler sayfasında görünür) */}
      <PresencePing />

      <Suspense fallback={<MobileTabBarList pathname={null} />}>
        <TabBar />
      </Suspense>
    </div>
  );
}

// Bildirim zili (masaüstünde sidebar'da, telefonda üst çubukta); veri tek sorguda
async function Bell({ variant }: { variant: "sidebar" | "mobile" }) {
  const { items, unread, serverNow } = await getNotifications();
  return <NotificationBell items={items} unread={unread} serverNow={serverNow} variant={variant} />;
}

// Çalışan sayaç varsa sidebar'da göster
async function SidebarTimer() {
  const [userId, supabase] = await Promise.all([getUserId(), createClient()]);
  const { data } = await supabase
    .from("time_entries")
    .select("task_id, started_at, task:tasks!time_entries_task_id_fkey(title)")
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (!data) return null;
  return (
    <RunningTimer
      key={data.started_at}
      taskId={data.task_id}
      taskTitle={data.task?.title ?? "Görev"}
      startedAt={data.started_at}
    />
  );
}

async function SidebarUser() {
  const user = await getCurrentUser();
  return <UserMenu
      name={user.name}
      email={user.email}
      isAdmin={user.isAdmin}
      avatarUrl={user.avatarUrl}
    />;
}

async function SidebarData() {
  const [user, projects, counts] = await Promise.all([getCurrentUser(), getProjects(), getNavCounts()]);
  const props = { projects, userId: user.id, counts };
  return (
    // Aktif sayfa (usePathname) istek anında bilinir; o gelene kadar vurgusuz liste
    <Suspense fallback={<SidebarNavList {...props} pathname={null} />}>
      <SidebarNav {...props} />
    </Suspense>
  );
}

// Alt sekme çubuğu; Görevlerim ve Atadığım sekmelerinde bekleyen iş rozetleri
async function TabBar() {
  const counts = await getNavCounts();
  return (
    <Suspense fallback={<MobileTabBarList pathname={null} counts={counts} />}>
      <MobileTabBar counts={counts} />
    </Suspense>
  );
}

async function MobileTitle() {
  const projects = await getProjects();
  return (
    <Suspense fallback={<MobileTitleText label="PANO" title="Em3Task" />}>
      <MobilePageTitle projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
    </Suspense>
  );
}

// Menü gruplarıyla aynı düzen: 4 + 3 + 2 satır, aralarda grup başlığı
function SidebarSkeleton() {
  return (
    <div className="flex-1 animate-pulse space-y-5 px-3">
      {[4, 3, 2].map((rows, g) => (
        <div key={g} className="space-y-0.5">
          {g > 0 && <div className="mb-2 h-3 w-14 rounded bg-white/[0.04]" />}
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="h-9 rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ))}
    </div>
  );
}
