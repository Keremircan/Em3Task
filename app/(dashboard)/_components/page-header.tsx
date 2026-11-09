import type { ReactNode } from "react";

// Mobilde başlık ve alt yazılar üst çubukta gösterilir; burada sadece buton (varsa) kalır.
// label: menüdeki grubun adı (EKİP, KİŞİSEL, HESAP); ana gruptaki sayfalarda yok.
export function PageHeader({
  title,
  label,
  description,
  action,
}: {
  title: string;
  label?: string;
  description?: string;
  action?: ReactNode; // sağ üstteki buton
}) {
  return (
    <header
      className={`mb-4 flex-wrap items-end justify-end gap-4 lg:mb-5 lg:flex lg:justify-between ${
        action ? "flex" : "hidden"
      }`}
    >
      <div className="hidden min-w-0 lg:block">
        {label && <p className="mb-1 text-xs font-medium tracking-[0.12em] text-slate-500">{label}</p>}
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </header>
  );
}
