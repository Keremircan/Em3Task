import { BookOpen, ExternalLink, GitPullRequest, Globe, Link2, PenTool } from "lucide-react";
import { card } from "@/components/ui/styles";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { ScrollList } from "@/components/ui/scroll-list";
import { removeLink } from "@/actions/links";
import type { ExtractedLink, LinkKind } from "@/lib/links";

const KIND_UI: Record<LinkKind, { icon: typeof Globe; tone: string; name: string }> = {
  github: { icon: GitPullRequest, tone: "bg-slate-900 text-white", name: "GitHub" },
  figma: { icon: PenTool, tone: "bg-violet-50 text-violet-600", name: "Figma" },
  docs: { icon: BookOpen, tone: "bg-amber-50 text-amber-600", name: "Doküman" },
  web: { icon: Globe, tone: "bg-sky-50 text-sky-600", name: "Web" },
};

export function TaskLinks({
  links,
  title = "Referanslar / Linkler",
  emptyText = "Açıklamada veya yorumlarda paylaşılan linkler burada otomatik toplanır.",
  scope,
  removableUrls = [],
}: {
  links: ExtractedLink[];
  title?: string;
  emptyText?: string;
  scope?: string; // verilirse yetkili kişiler linki listeden kaldırabilir
  removableUrls?: string[];
}) {
  return (
    <section className={`${card} p-4`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900">
          {title}
        </h2>
        <span className="text-sm text-slate-500">{links.length}</span>
      </div>

      {links.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
          <Link2 className="mt-0.5 size-4 shrink-0 text-slate-400" />
          {emptyText}
        </div>
      ) : (
        <ScrollList count={links.length} label={title}>
          {links.map((link) => {
            const { icon: Icon, tone, name } = KIND_UI[link.kind];
            return (
              <li key={link.url} className="group flex items-center gap-1">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.url}
                  className="group/link flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-100 p-2.5 transition hover:border-teal-200 hover:bg-teal-50/40"
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-slate-900">
                      {link.label}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {name} · {link.source}
                    </span>
                  </span>
                  <ExternalLink className="size-4 shrink-0 text-slate-300 transition group-hover/link:text-teal-600" />
                </a>
                {scope && removableUrls.includes(link.url) && (
                  <ConfirmDeleteButton
                    action={removeLink}
                    args={[scope, link.url]}
                    label="Linki listeden kaldır"
                    title="Linki kaldır"
                    message="Link bu listeden kaldırılacak. Paylaşıldığı mesaj ya da yorum olduğu gibi kalır."
                    confirmLabel="Kaldır"
                    reveal
                  />
                )}
              </li>
            );
          })}
        </ScrollList>
      )}
    </section>
  );
}
