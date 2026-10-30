"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleCheck, ClipboardList, House, MessagesSquare, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "Ana sayfa", icon: House },
  { href: "/genel", label: "Genel", icon: MessagesSquare },
  { href: "/gorevlerim", label: "Görevlerim", icon: CircleCheck },
  { href: "/atadigim-gorevler", label: "Atadığım", icon: ClipboardList },
  { href: "/uyeler", label: "Üyeler", icon: Users },
];

// Telefonda (lg altı) ekranın altında sabit duran, uygulama tarzı sekme çubuğu.
// Projeler ve diğer her şey sol üstteki menüde.
export function MobileTabBar() {
  return <MobileTabBarList pathname={usePathname()} />;
}

// Aktif sekme bilinmeden de (Suspense yedeği olarak) çizilebilir
export function MobileTabBarList({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Alt menü"
      className="theme-fixed fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-[#141414]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition active:scale-95 ${
                  active ? "text-teal-300" : "text-neutral-400"
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
