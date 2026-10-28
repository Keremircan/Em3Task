import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getProjects } from "@/lib/projects";
import { SidebarShell } from "./_components/sidebar-shell";
import { SidebarNav, SidebarNavList } from "./_components/sidebar-nav";
import { UserMenu } from "./_components/user-menu";
import { MobileTabBar, MobileTabBarList } from "./_components/mobile-tab-bar";
import { MobilePageTitle, MobileTitleText } from "./_components/mobile-page-title";
import { Logo } from "@/components/ui/logo";
import { SidebarFooter, SidebarFooterSkeleton } from "./_components/sidebar-footer";
import { PresencePing } from "@/components/realtime/presence-ping";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1 bg-[#f4f6f8]">
      <SidebarShell
        mobileTitle={
          <Suspense fallback={<MobileTitleText label="PANO" title="Em3Task" />}>
            <MobileTitle />
          </Suspense>
        }
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-4">
          <span className="flex min-w-0 items-center gap-2">
            <Logo size={26} className="rounded-[7px]" />
            <span className="truncate text-[15px] font-semibold tracking-tight text-white">
              Em3Task
            </span>
          </span>
          <Suspense fallback={<div className="size-8 rounded-full bg-white/[0.08]" />}>
            <SidebarUser />
          </Suspense>
        </div>
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarData />
        </Suspense>
        <Suspense fallback={<SidebarFooterSkeleton />}>
          <SidebarFooter />
        </Suspense>
      </SidebarShell>

      {/* Mobilde üstte sabit çubuk, altta sekme çubuğu var: içerik ikisinin arasında kalır */}
      <main className="flex min-w-0 flex-1 flex-col px-4 pt-[calc(4.25rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:pt-6 lg:pb-5">
        {/* flex: sayfalar (ör. proje panosu) kalan yüksekliği doldurabilir */}
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="mt-8 hidden text-xs text-slate-400 lg:block">
          © 2026 Em3Task · Ekip içi iş takip
        </footer>
      </main>

      {/* Üyenin "son görülme" zamanını kaydeder (Üyeler sayfasında görünür) */}
      <PresencePing />

      <Suspense fallback={<MobileTabBarList pathname={null} />}>
        <MobileTabBar />
      </Suspense>
    </div>
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
  const [user, projects] = await Promise.all([getCurrentUser(), getProjects()]);
  const props = { projects, userId: user.id };
  return (
    // Aktif sayfa (usePathname) istek anında bilinir; o gelene kadar vurgusuz liste
    <Suspense fallback={<SidebarNavList {...props} pathname={null} />}>
      <SidebarNav {...props} />
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

function SidebarSkeleton() {
  return (
    <div className="flex-1 animate-pulse space-y-1.5 px-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-9 rounded-lg bg-white/[0.04]" />
      ))}
      <div className="mt-5 h-5 w-20 rounded bg-white/[0.04]" />
    </div>
  );
}
