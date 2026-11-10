"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChartColumn,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  House,
  ListTodo,
  MessagesSquare,
  PanelsTopLeft,
  Plus,
  Users,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { ProjectSummary } from "@/lib/projects";
import type { NavCounts } from "@/lib/nav-counts";
import { createProject } from "@/actions/projects";
import { parseProjectUrl } from "@/lib/project-url";
import { NewProjectDialog } from "./new-project-dialog";
import { ProjectMenu } from "./project-menu";
import { safe } from "@/lib/safe-action";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: { key: keyof NavCounts; hint: string }; // sizden işlem bekleyen görev sayısı
};

// Menü grupları: başlıksız ilk grup günlük iş, sonra ekip ve kişisel sayfalar.
// Profil sağ üstteki hesap menüsünde ("Profilim").
const NAV_GROUPS: { title: string | null; links: NavLink[] }[] = [
  {
    title: null,
    links: [
      { href: "/", label: "Ana sayfa", icon: House },
      {
        href: "/gorevlerim",
        label: "Görevlerim",
        icon: CircleCheck,
        badge: { key: "accept", hint: "kabulünüzü bekliyor" },
      },
      {
        href: "/atadigim-gorevler",
        label: "Atadığım görevler",
        icon: ClipboardList,
        badge: { key: "review", hint: "kontrolünüzü bekliyor" },
      },
      { href: "/takvim", label: "Takvim", icon: CalendarDays },
    ],
  },
  {
    title: "Ekip",
    links: [
      { href: "/genel", label: "Genel", icon: MessagesSquare },
      { href: "/uyeler", label: "Üyeler", icon: Users },
      { href: "/raporlar", label: "Raporlar", icon: ChartColumn },
    ],
  },
  {
    title: "Kişisel",
    links: [
      { href: "/todo", label: "Yapılacaklar", icon: ListTodo },
      { href: "/abonelikler", label: "Abonelikler", icon: WalletCards },
    ],
  },
];

const itemBase =
  "group flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] transition";
// Menü içerikten bir ton sönük: dikkat çalışılan alanda kalsın
const itemIdle = "text-neutral-400 hover:bg-white/[0.06] hover:text-white";
const itemActive = "bg-white/[0.08] font-semibold text-white";
const groupTitle = "px-1 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-neutral-500 uppercase";

type Props = {
  projects: ProjectSummary[];
  userId: string;
  counts?: NavCounts;
};

export function SidebarNav(props: Props) {
  return <SidebarNavList {...props} pathname={usePathname()} />;
}

// Aktif sayfa bilinmeden de (Suspense yedeği olarak) çizilebilir
export function SidebarNavList({
  projects,
  userId,
  counts,
  pathname,
}: Props & { pathname: string | null }) {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Başarısız oluşturmadan sonra pencere girilen adla ve hatayla yeniden açılır
  const [retry, setRetry] = useState<{
    key: number;
    name: string;
    link: string;
    error: string;
  } | null>(null);
  // Yeni proje kayıt beklenmeden listenin sonuna eklenir (liste oluşturulma sırasında)
  const [shownProjects, addProject] = useOptimistic<ProjectSummary[], ProjectSummary>(
    projects,
    (list, project) => [...list, project],
  );

  function create(name: string, link: string) {
    const id = crypto.randomUUID();
    setRetry(null);
    startTransition(async () => {
      const url = parseProjectUrl(link);
      addProject({
        id,
        name: name.trim().replace(/\s+/g, " "),
        url: "url" in url ? url.url : null,
        created_by: userId,
      });
      const result = await safe(createProject(name, id, link));
      if (result.error) {
        setRetry({ key: Date.now(), name, link, error: result.error });
        setCreating(true);
        return;
      }
      router.push(`/projeler/${id}`);
    });
  }

  const isActive = (href: string) =>
    pathname !== null &&
    (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    // Menü ve proje listesi tek kaydırma alanı; kaydırma çubuğu görünmez
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-3">
      <nav className="flex flex-col gap-5 px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.title ?? "ana"} className="flex flex-col gap-0.5">
            {group.title && <p className={groupTitle}>{group.title}</p>}
            {group.links.map(({ href, label, icon: Icon, badge }) => {
              const active = isActive(href);
              const n = badge && counts ? counts[badge.key] : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`${itemBase} ${active ? itemActive : itemIdle}`}
                >
                  <Icon
                    className={`size-[17px] shrink-0 ${active ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"}`}
                    strokeWidth={1.8}
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {n > 0 && (
                    <span
                      title={`${n} görev ${badge!.hint}`}
                      className="min-w-5 rounded-full bg-teal-500/20 px-1.5 text-center text-[11px] leading-5 font-semibold text-teal-200 tabular-nums"
                    >
                      {n > 99 ? "99+" : n}
                      <span className="sr-only"> görev {badge!.hint}</span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-5 flex flex-col px-3">
        <div className="flex items-center justify-between pr-1 pl-1">
          <button
            type="button"
            onClick={() => setProjectsOpen((v) => !v)}
            aria-expanded={projectsOpen}
            className="flex items-center gap-1.5 rounded-md py-1 text-[11px] font-semibold tracking-[0.08em] text-neutral-500 uppercase hover:text-white"
          >
            Projeler
            <ChevronDown
              className={`size-4 text-neutral-500 transition-transform ${projectsOpen ? "" : "-rotate-90"}`}
            />
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label="Yeni proje oluştur"
            className="rounded-md p-1 text-neutral-400 transition hover:bg-white/[0.08] hover:text-white"
          >
            <Plus className="size-4" strokeWidth={2} />
          </button>
        </div>

        {projectsOpen && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {shownProjects.length === 0 && (
              <li className="px-3 py-2 text-sm text-neutral-500">
                Henüz proje yok. + ile oluşturun.
              </li>
            )}
            {shownProjects.map((project) => {
              const href = `/projeler/${project.id}`;
              const active = isActive(href);
              // Düzenleme ve silme tüm ekibe açık; kaydı henüz bitmemiş (iyimser) projede menü yok
              const canManage = projects.some((p) => p.id === project.id);
              return (
                <li key={project.id} className="relative">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`${itemBase} pr-10 ${active ? itemActive : itemIdle}`}
                  >
                    <PanelsTopLeft
                      className={`size-[17px] shrink-0 ${active ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"}`}
                      strokeWidth={1.8}
                    />
                    <span className="truncate">{project.name}</span>
                  </Link>
                  {canManage && (
                    <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
                      <ProjectMenu
                        project={project}
                        isCurrent={active}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <NewProjectDialog
        key={retry?.key ?? 0}
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={create}
        defaultName={retry?.name}
        defaultLink={retry?.link}
        initialError={retry?.error ?? null}
      />
    </div>
  );
}
