"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { updateTaskPriority } from "@/actions/tasks";
import { Menu } from "@/components/ui/menu";
import { PRIORITY_LABELS, TASK_PRIORITIES } from "@/lib/tasks";
import { safe } from "@/lib/safe-action";
import type { TaskPriority } from "@/types/database";
import { PriorityBadge, PriorityIcon } from "./priority";

// Tıklanınca öncelik listesi açan rozet. Ekipten herkes değiştirebilir;
// seçim anında görünür, kaydedilemezse eski haline döner ve uyarı çıkar.
export function PriorityControl({
  taskId,
  priority,
  size = "sm",
}: {
  taskId: string;
  priority: TaskPriority;
  size?: "xs" | "sm";
}) {
  const [shown, setShown] = useOptimistic(priority);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  function choose(next: TaskPriority) {
    if (next === shown) return;
    setError(null);
    startTransition(async () => {
      setShown(next);
      const result = await safe(updateTaskPriority(taskId, next));
      if (result.error) setError(result.error);
    });
  }

  return (
    <span className="relative inline-flex">
      <Menu
        label={`Öncelik: ${PRIORITY_LABELS[shown]}. Değiştirmek için tıklayın`}
        trigger={<PriorityBadge priority={shown} size={size} />}
        triggerClassName="inline-flex rounded-md transition hover:ring-2 hover:ring-teal-200 focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none"
        items={TASK_PRIORITIES.map((p) => ({
          label: PRIORITY_LABELS[p],
          icon:
            p === shown ? (
              <Check className="size-4 text-teal-600" strokeWidth={2.6} />
            ) : (
              <PriorityIcon priority={p} />
            ),
          onSelect: () => choose(p),
        }))}
      />
      {error && (
        <span
          role="alert"
          className="absolute top-full right-0 z-10 mt-1 w-56 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-medium text-white shadow-lg"
        >
          {error}
        </span>
      )}
    </span>
  );
}
