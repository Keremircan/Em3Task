"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/": "Ana sayfa",
  "/genel": "Genel",
  "/atadigim-gorevler": "Atadığım Görevler",
  "/gorevlerim": "Görevlerim",
  "/uyeler": "Üyeler",
  "/todo": "Yapılacaklar",
  "/takvim": "Takvim",
  "/profil": "Profil",
};

type Project = { id: string; name: string };

// Mobil üst çubukta o an açık olan sayfanın etiketi ve başlığı
export function MobilePageTitle({ projects }: { projects: Project[] }) {
  const { label, title } = titleFor(usePathname(), projects);
  return <MobileTitleText label={label} title={title} />;
}

export function MobileTitleText({ label, title }: { label: string; title: string }) {
  return (
    <span className="flex min-w-0 flex-col leading-none">
      <span className="text-[9.5px] font-semibold tracking-[0.14em] text-neutral-500">
        {label}
      </span>
      <span className="mt-1 truncate text-[15px] font-semibold text-white">{title}</span>
    </span>
  );
}

function titleFor(pathname: string, projects: Project[]) {
  if (pathname === "/todo") return { label: "KİŞİSEL", title: TITLES[pathname] };
  if (TITLES[pathname]) return { label: "PANO", title: TITLES[pathname] };
  const project = pathname.match(/^\/projeler\/([^/]+)/);
  if (project) {
    return { label: "PROJE", title: projects.find((p) => p.id === project[1])?.name ?? "Proje" };
  }
  if (pathname.startsWith("/gorevler/")) return { label: "GÖREV", title: "Görev detayı" };
  return { label: "PANO", title: "Em3Task" };
}
