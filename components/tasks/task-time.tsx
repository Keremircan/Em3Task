"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, Pause, Play, Plus, Trash2 } from "lucide-react";
import { addManualTime, deleteTimeEntry, startTimer, stopTimer } from "@/actions/time";
import { safe } from "@/lib/safe-action";
import { entrySeconds, formatClock, formatDuration, MAX_ENTRY_MINUTES, totalSeconds } from "@/lib/time";
import { formatDateTime } from "@/lib/format";
import { card } from "@/components/ui/styles";

export type TimeEntryView = {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  note: string;
  user: { full_name: string | null } | null;
};

// Her saniye yenilenen "şimdi" (sadece sayaç çalışırken)
function useNow(active: boolean, serverNow: number) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [active]);
  return now;
}

// Görev detayındaki zaman takibi: toplam süre, sayaç, elle süre ekleme, kayıtlar
export function TaskTime({
  taskId,
  entries,
  meId,
  serverNow,
  today,
}: {
  taskId: string;
  entries: TimeEntryView[];
  meId: string;
  serverNow: number;
  today: string;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Anında tepki için: sunucu yanıtı gelene kadar sayacın görünen durumu
  const [pendingRunning, setPendingRunning] = useState<boolean | null>(null);
  const [startedLocal, setStartedLocal] = useState<number | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const serverRunning = entries.find((e) => e.user_id === meId && e.ended_at === null) ?? null;
  const running = pendingRunning ?? Boolean(serverRunning);
  const anyRunning = running || entries.some((e) => e.ended_at === null);
  const now = useNow(anyRunning, serverNow);

  // Sunucudan yeni veri gelince geçici durumu bırak
  const [lastKey, setLastKey] = useState(entries.map((e) => e.id + (e.ended_at ?? "")).join());
  const key = entries.map((e) => e.id + (e.ended_at ?? "")).join();
  if (key !== lastKey) {
    setLastKey(key);
    setPendingRunning(null);
    setStartedLocal(null);
  }

  const total = totalSeconds(entries, now) + (pendingRunning && !serverRunning && startedLocal ? Math.round((now - startedLocal) / 1000) : 0);
  const myRunningSeconds = serverRunning
    ? entrySeconds(serverRunning, now)
    : startedLocal
      ? Math.max(0, Math.round((now - startedLocal) / 1000))
      : 0;

  function toggle() {
    setError(null);
    const next = !running;
    setPendingRunning(next);
    if (next) setStartedLocal(Date.now());
    startTransition(async () => {
      const result = await safe(next ? startTimer(taskId) : stopTimer());
      if (result.error) {
        setPendingRunning(null);
        setStartedLocal(null);
        setError(result.error);
      }
    });
  }

  // Kişi başına toplam (en çok çalışan üstte)
  const perPerson = new Map<string, { name: string; seconds: number }>();
  for (const e of entries) {
    const p = perPerson.get(e.user_id) ?? { name: e.user?.full_name ?? "Eski üye", seconds: 0 };
    p.seconds += entrySeconds(e, now);
    perPerson.set(e.user_id, p);
  }
  const people = [...perPerson.values()].sort((a, b) => b.seconds - a.seconds);

  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Clock className="size-4.5 text-slate-400" /> Zaman takibi
        </h2>
        <span className="text-sm text-slate-500">
          Toplam <span className="font-bold text-slate-900">{formatDuration(total)}</span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition ${
            running ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-teal-600 text-white hover:bg-teal-700"
          }`}
        >
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          {running ? "Durdur" : "Sayacı başlat"}
        </button>
        {running && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 font-mono text-sm font-semibold text-rose-700 tabular-nums" aria-live="off">
            <span className="size-2 animate-pulse rounded-full bg-rose-500" />
            {formatClock(myRunningSeconds)}
          </span>
        )}
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          aria-expanded={manualOpen}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <Plus className="size-4" /> Süre ekle
        </button>
      </div>

      {manualOpen && (
        <ManualForm
          today={today}
          onCancel={() => setManualOpen(false)}
          onSubmit={(day, minutes, note) => {
            setManualOpen(false);
            setError(null);
            startTransition(async () => {
              const r = await safe(addManualTime({ taskId, day, minutes, note }));
              if (r.error) setError(r.error);
            });
          }}
        />
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}

      {people.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {people.map((p) => (
            <li key={p.name} className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
              {p.name}: <span className="font-semibold text-slate-800">{formatDuration(p.seconds)}</span>
            </li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {entries.map((e) => (
            <li key={e.id} className="group flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-slate-800">{e.user?.full_name ?? "Eski üye"}</span>
                <span className="text-slate-400"> · {formatDateTime(e.started_at)}</span>
                {e.note && <span className="block truncate text-xs text-slate-500">{e.note}</span>}
              </span>
              <span className={`shrink-0 tabular-nums ${e.ended_at ? "text-slate-700" : "font-semibold text-rose-600"}`}>
                {e.ended_at ? formatDuration(entrySeconds(e, now)) : "çalışıyor"}
              </span>
              {e.user_id === meId && e.ended_at && (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await safe(deleteTimeEntry(e.id));
                      if (r.error) setError(r.error);
                    })
                  }
                  aria-label="Süre kaydını sil"
                  className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ManualForm({
  today,
  onSubmit,
  onCancel,
}: {
  today: string;
  onSubmit: (day: string, minutes: number, note: string) => void;
  onCancel: () => void;
}) {
  const [day, setDay] = useState(today);
  const [h, setH] = useState("0");
  const [m, setM] = useState("30");
  const [note, setNote] = useState("");
  const minutes = (Number(h) || 0) * 60 + (Number(m) || 0);
  const valid = minutes >= 1 && minutes <= MAX_ENTRY_MINUTES && day <= today;
  const input =
    "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(day, minutes, note);
      }}
      className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[auto_auto_auto_1fr_auto]"
    >
      <label className="text-xs font-semibold text-slate-600">
        Gün
        <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className={`${input} mt-1 block w-full`} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Saat
        <input type="number" min={0} max={24} value={h} onChange={(e) => setH(e.target.value)} className={`${input} mt-1 block w-20`} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Dakika
        <input type="number" min={0} max={59} step={5} value={m} onChange={(e) => setM(e.target.value)} className={`${input} mt-1 block w-20`} />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Not <span className="font-normal text-slate-400">(isteğe bağlı)</span>
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ne üzerinde çalıştınız?" className={`${input} mt-1 block w-full`} />
      </label>
      <div className="flex items-end gap-2">
        <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Vazgeç
        </button>
        <button type="submit" disabled={!valid} className="h-9 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40">
          Ekle
        </button>
      </div>
    </form>
  );
}
