// Yatay çubuk grafik (tek seri). Değer çubuğun ucunda; üzerine gelince ayrıntı.
// Tek renk (turkuaz), metinler yazı renklerinde; çubuklar ≤ 20 px, uçları yuvarlak.

export type BarDatum = { label: string; value: number; display: string; detail?: string };

export function BarChart({ data, empty, unit }: { data: BarDatum[]; empty: string; unit: string }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (!data.length || max === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{empty}</p>;
  }
  return (
    <ul className="space-y-2.5" role="list">
      {data.map((d) => {
        const pct = Math.max(2, (d.value / max) * 100);
        return (
          <li key={d.label} className="group relative grid grid-cols-[minmax(0,8.5rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_1fr]">
            <span className="truncate text-[13px] text-slate-600" title={d.label}>
              {d.label}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-5 rounded-r-[4px] bg-teal-500 transition-colors group-hover:bg-teal-600"
                style={{ width: `calc(${pct}% - 3.5rem)`, minWidth: 4 }}
                aria-hidden
              />
              <span className="shrink-0 text-[13px] font-semibold text-slate-800 tabular-nums">{d.display}</span>
            </span>
            {/* Üzerine gelince ayrıntı */}
            <span
              role="tooltip"
              className="pointer-events-none absolute -top-9 left-[8.5rem] z-10 hidden rounded-md bg-slate-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-lg group-hover:block sm:left-[11rem]"
            >
              <span className="font-semibold">{d.label}</span>: {d.display} {unit}
              {d.detail && <span className="text-slate-300"> · {d.detail}</span>}
            </span>
            <span className="sr-only">
              {d.label}: {d.display} {unit}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
