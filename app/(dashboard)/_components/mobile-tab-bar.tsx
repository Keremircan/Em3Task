"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleCheck, ClipboardList, House, MessagesSquare, Users } from "lucide-react";
import type { NavCounts } from "@/lib/nav-counts";

const TABS: { href: string; label: string; icon: typeof House; badge?: keyof NavCounts }[] = [
  { href: "/", label: "Ana sayfa", icon: House },
  { href: "/genel", label: "Genel", icon: MessagesSquare },
  { href: "/gorevlerim", label: "Görevlerim", icon: CircleCheck, badge: "accept" },
  { href: "/atadigim-gorevler", label: "Atadığım", icon: ClipboardList, badge: "review" },
  { href: "/uyeler", label: "Üyeler", icon: Users },
];

const BADGE_HINT: Record<keyof NavCounts, string> = {
  accept: "kabulünüzü bekliyor",
  review: "kontrolünüzü bekliyor",
};

// Telefonda (lg altı) ekranın altında sabit duran, uygulama tarzı sekme çubuğu.
// Projeler ve diğer her şey sol üstteki menüde.
export function MobileTabBar({ counts }: { counts?: NavCounts }) {
  return <MobileTabBarList pathname={usePathname()} counts={counts} />;
}

// Aktif sekme bilinmeden de (Suspense yedeği olarak) çizilebilir
export function MobileTabBarList({ pathname, counts }: { pathname: string | null; counts?: NavCounts }) {
  return (
    <nav
      aria-label="Alt menü"
      className="theme-fixed fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-[#141414]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, badge }) => {
          const active =
            pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
          const n = badge && counts ? counts[badge] : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition active:scale-95 ${
                  active ? "text-teal-300" : "text-neutral-400"
                }`}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                  {n > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-teal-600 px-1 text-center text-[9.5px] leading-4 font-bold text-white tabular-nums ring-2 ring-[#141414]">
                      {n > 9 ? "9+" : n}
                      <span className="sr-only"> görev {BADGE_HINT[badge!]}</span>
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
