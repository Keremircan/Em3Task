"use client";

import { createContext, useContext, useOptimistic, useState, type ReactNode } from "react";
import { CircleAlert, X } from "lucide-react";
import type { TaskStatus } from "@/types/database";
import { StatusBadge } from "./status-badge";

// Görev durumu değişikliği ve silme için iyimser güncelleme katmanı.
// Buton tıklandığı an liste/rozet yeni duruma geçer; sunucu kaydı arka planda yapılır.
// Kayıt bitince sunucudan gelen gerçek veri geçici durumun yerini alır;
// hata olursa geçici durum kendiliğinden geri döner ve sağ altta uyarı çıkar.

type BaseTask = { id: string; status: TaskStatus; assigned_to: string | null };

export type TaskUpdate =
  | { type: "status"; id: string; status: TaskStatus; assignedTo?: string | null }
  | { type: "delete"; id: string };

type Ctx = {
  tasks: BaseTask[];
  apply: (update: TaskUpdate) => void; // sadece bir transition içinde çağrılmalı
  report: (message: string) => void;
};

const OptimisticTasksContext = createContext<Ctx | null>(null);

function reduce<T extends BaseTask>(tasks: T[], update: TaskUpdate): T[] {
  if (update.type === "delete") return tasks.filter((t) => t.id !== update.id);
  return tasks.map((t) =>
    t.id === update.id
      ? {
          ...t,
          status: update.status,
          ...(update.assignedTo !== undefined ? { assigned_to: update.assignedTo } : {}),
        }
      : t,
  );
}

export function OptimisticTasksProvider({
  tasks,
  children,
}: {
  tasks: BaseTask[];
  children: ReactNode;
}) {
  const [shown, apply] = useOptimistic(tasks, reduce<BaseTask>);
  const [error, setError] = useState<string | null>(null);

  return (
    <OptimisticTasksContext.Provider value={{ tasks: shown, apply, report: setError }}>
      {children}
      {error && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-start gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm text-rose-700 shadow-lg lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">İşlem geri alındı: {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Uyarıyı kapat"
            className="-my-0.5 flex size-6 shrink-0 items-center justify-center rounded text-rose-600 hover:bg-rose-50"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </OptimisticTasksContext.Provider>
  );
}

export function useOptimisticTasks() {
  return useContext(OptimisticTasksContext);
}

// Sunucudan gelen listeye iyimser güncellemeleri uygular (sağlayıcı içinde kullanılır)
export function useShownTasks<T extends BaseTask>(tasks: T[]): T[] {
  const ctx = useOptimisticTasks();
  if (!ctx) return tasks;
  const byId = new Map(ctx.tasks.map((t) => [t.id, t]));
  return tasks.filter((t) => byId.has(t.id)).map((t) => ({ ...t, ...byId.get(t.id)! }));
}

// Görev detayındaki durum rozeti: butona basılınca hemen yeni durumu gösterir
export function OptimisticStatusBadge({ id, status }: { id: string; status: TaskStatus }) {
  const ctx = useOptimisticTasks();
  return <StatusBadge status={ctx?.tasks.find((t) => t.id === id)?.status ?? status} />;
}
