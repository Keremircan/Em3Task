import { Suspense } from "react";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { getTaskFormOptions, TASK_LIST_SELECT } from "@/lib/task-queries";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskSection } from "@/components/tasks/task-list";
import { RecurringList } from "@/components/tasks/recurring-list";
import { OptimisticTasksProvider } from "@/components/tasks/optimistic-tasks";
import { PageHeader } from "../_components/page-header";
import { ListSkeleton } from "../_components/list-parts";

export const metadata: Metadata = { title: "Atadığım görevler · Em3Task" };

export default function AssignedByMePage() {
  return (
    <Suspense fallback={<ListSkeleton title="Atadığım görevler" />}>
      <AssignedByMe />
    </Suspense>
  );
}

async function AssignedByMe() {
  const userId = await getUserId(); // yerel, Supabase isteği yok
  const supabase = await createClient();

  const [{ data: tasks, error }, formOptions, { data: recurring }] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_LIST_SELECT)
      .eq("created_by", userId)
      .order("created_at", { ascending: false }),
    getTaskFormOptions(),
    // Kendi kurduğum tekrarlayan görevler (yoksa bölüm hiç görünmez)
    supabase
      .from("recurring_tasks")
      .select(
        "id, title, frequency, anchor_day, due_after_days, next_run, run_hour, is_active, assigned_to, project:projects!recurring_tasks_project_id_fkey(id, name), assignee:profiles!recurring_tasks_assigned_to_fkey(full_name)",
      )
      .eq("created_by", userId)
      .order("created_at", { ascending: false }),
  ]);

  const all = tasks ?? [];

  return (
    <>
      <PageHeader
        title="Atadığım görevler"
        description="Atadığınız işleri buradan izleyin; kabul edilen işleri tamamlayın."
        action={<NewTaskButton options={formOptions} />}
      />

      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-rose-700">
          Görevler yüklenemedi. Sayfayı yenileyip tekrar deneyin.
        </p>
      )}

      <OptimisticTasksProvider tasks={all}>
        <div className="space-y-4">
          <TaskSection
            title="Süren işler"
            tasks={all}
            statuses={["pending", "in_progress", "review"]}
            userId={userId}
            mode="owner"
            formOptions={formOptions}
            empty="Süren bir işiniz yok. Sağ üstteki “Yeni İş Ata” ile başlayın."
          />
          <RecurringList items={recurring ?? []} />
          <TaskSection
            title="Tamamlananlar"
            tasks={all}
            statuses={["done"]}
            userId={userId}
            mode="owner"
            formOptions={formOptions}
            empty="Henüz tamamlanan iş yok."
          />
        </div>
      </OptimisticTasksProvider>
    </>
  );
}
