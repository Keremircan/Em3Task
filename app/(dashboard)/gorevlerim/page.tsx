import { Suspense } from "react";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { TASK_LIST_SELECT } from "@/lib/task-queries";
import { TaskSection } from "@/components/tasks/task-list";
import { OptimisticTasksProvider } from "@/components/tasks/optimistic-tasks";
import { PageHeader } from "../_components/page-header";
import { ListSkeleton } from "../_components/list-parts";

export const metadata: Metadata = { title: "Görevlerim · Em3Task" };

export default function MyTasksPage() {
  return (
    <Suspense fallback={<ListSkeleton title="Görevlerim" />}>
      <MyTasks />
    </Suspense>
  );
}

async function MyTasks() {
  const userId = await getUserId(); // yerel, Supabase isteği yok
  const supabase = await createClient();

  // Bana atananlar + "Herkes"e atanmış ve henüz kimsenin almadığı görevler
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(TASK_LIST_SELECT)
    .or(`assigned_to.eq.${userId},and(assigned_to.is.null,status.eq.pending)`)
    .order("created_at", { ascending: false });

  const all = tasks ?? [];

  return (
    <>
      <PageHeader
        title="Görevlerim"
        description="Size atanan işleri kabul edin, bitirdiğinizde kontrole gönderin."
      />

      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-rose-700">
          Görevler yüklenemedi. Sayfayı yenileyip tekrar deneyin.
        </p>
      )}

      <OptimisticTasksProvider tasks={all}>
        <div className="space-y-4">
          <TaskSection
            title="Kabul bekleyenler"
            tasks={all}
            statuses={["pending"]}
            userId={userId}
            mode="assignee"
            empty="Kabul etmenizi bekleyen görev yok."
          />
          <TaskSection
            title="Üzerimdeki işler"
            tasks={all}
            statuses={["in_progress", "review"]}
            userId={userId}
            mode="assignee"
            empty="Şu an üzerinizde iş yok."
          />
          <TaskSection
            title="Tamamlananlar"
            tasks={all}
            statuses={["done"]}
            userId={userId}
            mode="assignee"
            empty="Henüz tamamlanan işiniz yok."
          />
        </div>
      </OptimisticTasksProvider>
    </>
  );
}
