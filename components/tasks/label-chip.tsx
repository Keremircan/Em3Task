import { labelColor, type LabelLite } from "@/lib/labels";

// Görev kartlarında ve listelerde gösterilen renkli etiket
export function LabelChip({ label, size = "sm" }: { label: LabelLite; size?: "xs" | "sm" }) {
  const c = labelColor(label.color);
  return (
    <span
      title={`Etiket: ${label.name}`}
      className={`inline-flex max-w-full items-center gap-1 rounded-md font-semibold ring-1 ${c.chip} ${
        size === "xs" ? "px-1.5 py-px text-[10.5px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${c.dot}`} />
      <span className="truncate">{label.name}</span>
    </span>
  );
}

// Kartlarda yer kısıtlı: ilk birkaç etiket ve "+N"
export function LabelChips({ labels, max = 3, size = "xs" }: { labels: LabelLite[]; max?: number; size?: "xs" | "sm" }) {
  if (!labels.length) return null;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {labels.slice(0, max).map((l) => (
        <LabelChip key={l.id} label={l} size={size} />
      ))}
      {labels.length > max && (
        <span className="text-[11px] font-semibold text-slate-400" title={labels.slice(max).map((l) => l.name).join(", ")}>
          +{labels.length - max}
        </span>
      )}
    </span>
  );
}

// "☑ 3/5" kontrol listesi ilerlemesi
export function ChecklistBadge({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  const complete = done === total;
  return (
    <span
      title={`Kontrol listesi: ${done}/${total} tamamlandı`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ${
        complete ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-600 ring-slate-200"
      }`}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="12" height="12" rx="3" />
        <path d="m5 8 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {done}/{total}
    </span>
  );
}
