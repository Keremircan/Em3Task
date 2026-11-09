"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronRight } from "lucide-react";
import type { TrendBucket } from "@/lib/report-trend";

// Açılan ve tamamlanan görevlerin zaman çizgisi: iki seri, tek eksen.
// Renkler değişkende: açık temada mavi/turkuaz 600; koyu yüzeyde mavi bir ton açık
// (iki tema için ayrı ayrı renk körlüğü ve karşıtlık denetiminden geçirildi).
// Üzerine gelince ya da odaklanıp ok tuşlarıyla gezince dikey çizgi ve tek ipucu.

const SERIES = [
  { key: "opened", name: "Açılan", color: "var(--c-open)" },
  { key: "done", name: "Tamamlanan", color: "var(--c-done)" },
] as const;

const MARKER_LIMIT = 16; // daha çok noktada yalnızca seçili nokta işaretlenir

// Tam sayı adımlı, yaklaşık 4 aralıklı y ekseni
function niceScale(max: number) {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

export function TrendChart({ buckets, empty }: { buckets: TrendBucket[]; empty: string }) {
  const [active, setActive] = useState<number | null>(null);
  const n = buckets.length;
  const max = Math.max(0, ...buckets.map((b) => Math.max(b.opened, b.done)));

  if (!n || max === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{empty}</p>;
  }

  const { top, ticks } = niceScale(max);
  const x = (i: number) => ((i + 0.5) / n) * 100; // yüzde
  const y = (v: number) => (1 - v / top) * 100;
  const total = (key: "opened" | "done") => buckets.reduce((s, b) => s + b[key], 0);
  const every = Math.ceil(n / 6); // eksende en çok ~6 etiket, sondan geriye
  const cur = active === null ? null : buckets[active];

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setActive(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, (a: number) => number> = {
      ArrowLeft: (a) => Math.max(0, a - 1),
      ArrowRight: (a) => Math.min(n - 1, a + 1),
      Home: () => 0,
      End: () => n - 1,
    };
    if (e.key === "Escape") return setActive(null);
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setActive((a) => (a === null ? n - 1 : move(a))); // seçim yoksa son dönemden başla
  };

  return (
    <div className="[--c-done:#009689] [--c-open:#155dfc] [.dark_&]:[--c-open:#2b7fff]">
      {/* Açıklama: renk, ad ve dönem toplamı */}
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.name}
            <span className="font-semibold text-slate-900 tabular-nums">{total(s.key)}</span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        {/* Y ekseni */}
        <div aria-hidden className="relative h-44 min-w-4 sm:h-52">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[11px] leading-none text-slate-500 tabular-nums"
              style={{ top: `${y(t)}%` }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Çizim alanı */}
        <div
          role="group"
          tabIndex={0}
          aria-label="Grafik: dönemler arasında ok tuşlarıyla gezinin"
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
          className="relative h-44 touch-pan-y rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-4 focus-visible:ring-offset-white sm:h-52"
        >
          {/* Izgara: ince yatay çizgiler, taban biraz daha belirgin */}
          {ticks.map((t) => (
            <span
              key={t}
              aria-hidden
              className={`absolute inset-x-0 border-t ${t === 0 ? "border-slate-300" : "border-slate-100"}`}
              style={{ top: `${y(t)}%` }}
            />
          ))}

          {active !== null && (
            <span aria-hidden className="absolute inset-y-0 w-px -translate-x-1/2 bg-slate-300" style={{ left: `${x(active)}%` }} />
          )}

          <svg aria-hidden viewBox="0 0 1000 200" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            {SERIES.map((s) => (
              <polyline
                key={s.key}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ stroke: s.color }}
                points={buckets.map((b, i) => `${x(i) * 10},${y(b[s.key]) * 2}`).join(" ")}
              />
            ))}
          </svg>

          {/* Noktalar: yüzey renginde halkayla, üst üste binince de seçilir */}
          {buckets.map((b, i) =>
            n <= MARKER_LIMIT || i === active
              ? SERIES.map((s) => (
                  <span
                    key={`${s.key}-${i}`}
                    aria-hidden
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white ${i === active ? "size-2.5" : "size-2"}`}
                    style={{ left: `${x(i)}%`, top: `${y(b[s.key])}%`, background: s.color }}
                  />
                ))
              : null,
          )}

          {/* Tek ipucu: dönem ve iki seri; imlecin boş tarafında durur */}
          {cur && active !== null && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 z-10 w-max rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
              style={x(active) < 55 ? { left: `calc(${x(active)}% + 10px)` } : { right: `calc(${100 - x(active)}% + 10px)` }}
            >
              <p className="mb-1 font-semibold text-slate-900">{cur.range}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="flex items-center gap-2 text-slate-600">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                  <span>
                    <span className="font-semibold text-slate-900 tabular-nums">{cur[s.key]}</span> {s.name.toLocaleLowerCase("tr")}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* X ekseni: son dönemden geriye eşit aralıklı etiketler */}
        <div aria-hidden className="relative col-start-2 mt-1.5 h-4">
          {buckets.map((b, i) =>
            (n - 1 - i) % every === 0 ? (
              <span
                key={i}
                className={`absolute -translate-x-1/2 text-[11px] whitespace-nowrap ${i === active ? "font-semibold text-slate-800" : "text-slate-500"}`}
                style={{ left: `${x(i)}%` }}
              >
                {b.label}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {cur ? `${cur.range}: ${cur.opened} açılan, ${cur.done} tamamlanan` : ""}
      </p>

      {/* Tablo görünümü */}
      <details className="group mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-semibold text-slate-500 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden className="size-3.5 transition group-open:rotate-90" />
          Tablo olarak göster
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3 font-semibold">Dönem</th>
                <th className="py-2 pr-3 text-right font-semibold">Açılan</th>
                <th className="py-2 pr-3 text-right font-semibold">Tamamlanan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buckets.map((b, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-3 text-slate-700">{b.range}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{b.opened}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{b.done}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
