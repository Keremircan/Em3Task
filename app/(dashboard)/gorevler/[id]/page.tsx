import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CalendarDays, FolderKanban, Hand } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/tasks";
import { PriorityControl } from "@/components/tasks/priority-control";
import { DueBadge } from "@/components/tasks/due-badge";
import { TaskChecklist } from "@/components/tasks/task-checklist";
import { TaskTime } from "@/components/tasks/task-time";
import { LabelPicker } from "@/components/tasks/label-picker";
import { dayKey, formatDateTime, formatDay } from "@/lib/format";
import { ATTACHMENTS_BUCKET } from "@/lib/attachments";
import { extractLinks, withoutRemoved } from "@/lib/links";
import { parseDayParam, todayKey } from "@/lib/days";
import { getTaskFormOptions } from "@/lib/task-queries";
import { Markdown } from "@/components/markdown/markdown";
import { Avatar } from "@/components/ui/avatar";
import { card } from "@/components/ui/styles";
import {
  OptimisticStatusBadge,
  OptimisticTasksProvider,
} from "@/components/tasks/optimistic-tasks";
import { TaskActions } from "@/components/tasks/task-actions";
import { RevisionBadge, RevisionNotice } from "@/components/tasks/revision";
import { TaskComments } from "@/components/tasks/task-comments";
import { REACTIONS_SELECT } from "@/lib/reactions";
import { TaskAttachments, type TaskAttachment } from "@/components/tasks/task-attachments";
import { TaskLinks } from "@/components/tasks/task-links";

export const metadata: Metadata = { title: "Görev detayı · Em3Task" };

// İmzalı dosya linklerinin geçerlilik süresi
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default function TaskDetailPage({ params, searchParams }: PageProps<"/gorevler/[id]">) {
  return (
    // params/searchParams istek anında okunur; Suspense içinde kalmalı
    <Suspense fallback={<DetailSkeleton />}>
      <TaskDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TaskDetail({
  params,
  searchParams,
}: Pick<PageProps<"/gorevler/[id]">, "params" | "searchParams">) {
  const [{ id }, { gun }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();

  const supabase = await createClient();

  // Tüm veriler tek turda, paralel çekilir (Supabase'e her tur ~300 ms).
  // Dosya linkleri de ek listesi gelir gelmez, diğer sorguları beklemeden üretilir.
  const attachmentsWithLinks = supabase
    .from("task_attachments")
    .select(
      "id, file_url, file_name, file_type, created_at, uploaded_by, uploader:profiles!task_attachments_uploaded_by_fkey(full_name)",
    )
    .eq("task_id", id)
    .order("created_at", { ascending: false })
    .then(async ({ data: rows }) => {
      const list = rows ?? [];
      const signed = new Map<string, string>();
      if (list.length) {
        const { data } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(
          list.map((a) => a.file_url),
          SIGNED_URL_TTL_SECONDS,
        );
        data?.forEach((item) => {
          if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
        });
      }
      return list.map((a) => ({
        id: a.id,
        file_name: a.file_name,
        file_type: a.file_type,
        created_at: a.created_at,
        uploaded_by: a.uploaded_by,
        uploader: a.uploader,
        signedUrl: signed.get(a.file_url) ?? null,
      }));
    });

  const [
    user,
    taskRes,
    commentsRes,
    rawAttachments,
    formOptions,
    removedRes,
    checklistRes,
    taskLabelsRes,
    allLabelsRes,
    timeRes,
  ] = await Promise.all([
    getCurrentUser(),
    supabase
      .from("tasks")
      .select(
        `id, title, description, status, priority, due_date, project_id, assigned_to, created_by,
         accepted_at, revision_count, created_at,
         project:projects!tasks_project_id_fkey(id, name),
         assignee:profiles!tasks_assigned_to_fkey(full_name),
         creator:profiles!tasks_created_by_fkey(full_name)`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("task_comments")
      .select(
        `id, user_id, content, created_at, edited_at,
         author:profiles!task_comments_user_id_fkey(full_name, avatar_url),
         ${REACTIONS_SELECT}`,
      )
      .eq("task_id", id)
      .order("created_at", { ascending: true }),
    attachmentsWithLinks,
    getTaskFormOptions(),
    supabase.from("removed_links").select("url, created_at").eq("scope", id),
    supabase
      .from("task_checklist_items")
      .select("id, title, is_done")
      .eq("task_id", id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("task_labels").select("label_id").eq("task_id", id),
    supabase.from("labels").select("id, name, color, created_by").order("name"),
    supabase
      .from("time_entries")
      .select("id, user_id, started_at, ended_at, note, user:profiles!time_entries_user_id_fkey(full_name)")
      .eq("task_id", id)
      .order("started_at", { ascending: false }),
  ]);

  const task = taskRes.data;
  if (!task) notFound();

  const comments = commentsRes.data ?? [];

  // Gün seçici: mesaj olan günler ve seçilen günün yorumları
  // Varsayılan: bugün. "Tümü" seçilince ?gun=tumu
  const today = todayKey();
  const selectedDay = parseDayParam(gun, today);
  const days = [...new Set(comments.map((c) => dayKey(c.created_at)))];
  const shownComments = selectedDay
    ? comments.filter((c) => dayKey(c.created_at) === selectedDay)
    : comments;

  // Silme yetkisi: yükleyen kişi ya da Admin
  const attachments: TaskAttachment[] = rawAttachments.map((a) => ({
    ...a,
    canDelete: user.isAdmin || a.uploaded_by === user.id,
  }));

  // Linkler tüm yorumlardan toplanır (gün seçiciden etkilenmez).
  // Listeden kaldırılan link, kaldırıldıktan sonra yeniden paylaşılırsa geri gelir.
  const links = withoutRemoved(
    extractLinks([
      {
        text: task.description,
        source: "Açıklama",
        authorId: task.created_by,
        at: task.created_at,
      },
      ...comments.map((c) => ({
        text: c.content,
        source: `Yorum · ${c.author?.full_name ?? "Eski üye"}`,
        authorId: c.user_id,
        at: c.created_at,
      })),
    ]),
    removedRes.data ?? [],
  );
  const removableUrls = links
    .filter((l) => user.isAdmin || l.authorIds.includes(user.id))
    .map((l) => l.url);

  const creatorName = task.creator?.full_name ?? "Eski üye";
  const isOpen = task.assigned_to === null;
  const assigneeName = isOpen ? "Herkes" : (task.assignee?.full_name ?? "Eski üye");
  const backHref = task.project ? `/projeler/${task.project.id}` : "/";

  return (
    <>
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-teal-700"
      >
        <ArrowLeft className="size-4" />
        {task.project ? `${task.project.name} panosuna dön` : "Ana sayfaya dön"}
      </Link>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {/* Üst bilgi kartı: durum butonları rozeti beklemeden günceller */}
          <OptimisticTasksProvider
            tasks={[
              {
                id: task.id,
                status: task.status,
                assigned_to: task.assigned_to,
              },
            ]}
          >
            <section className={`${card} p-4 sm:p-5`}>
              <div className="flex flex-wrap items-center gap-2">
                <OptimisticStatusBadge id={task.id} status={task.status} />
                <RevisionBadge count={task.revision_count} />
                <PriorityControl taskId={task.id} priority={task.priority} />
                <DueBadge due={task.due_date} status={task.status} />
              </div>
              <div className="mt-2.5">
                <LabelPicker
                  taskId={task.id}
                  assignedIds={(taskLabelsRes.data ?? []).map((l) => l.label_id)}
                  allLabels={allLabelsRes.data ?? []}
                  meId={user.id}
                  isAdmin={user.isAdmin}
                />
              </div>
              <h1 className="mt-3 text-2xl leading-tight font-bold tracking-tight text-slate-900 [overflow-wrap:anywhere]">
                {task.title}
              </h1>

              <RevisionNotice
                id={task.id}
                status={task.status}
                revisionCount={task.revision_count}
                isAssignee={task.assigned_to === user.id}
              />
              {isOpen && task.status === "pending" && (
                <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                  <Hand className="size-4 shrink-0" />
                  Bu görev herkese atandı; ilk kabul eden kişi görevi üstlenir.
                </p>
              )}

              <dl className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 2xl:grid-cols-5">
                <Meta label="Atayan">
                  <Person name={creatorName} />
                </Meta>
                <Meta label="Sorumlu">
                  <Person name={assigneeName} />
                </Meta>
                <Meta label="Proje">
                  {task.project ? (
                    <Link
                      href={`/projeler/${task.project.id}`}
                      className="flex items-center gap-2 hover:text-teal-700"
                    >
                      <FolderKanban className="size-4 text-slate-400" />
                      <span className="truncate">{task.project.name}</span>
                    </Link>
                  ) : (
                    <span className="text-slate-400">Projesiz</span>
                  )}
                </Meta>
                <Meta label="Teslim tarihi">
                  {task.due_date ? (
                    <span className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-slate-400" />
                      {formatDay(task.due_date)}
                    </span>
                  ) : (
                    <span className="text-slate-400">Belirtilmemiş</span>
                  )}
                </Meta>
                <Meta label="Oluşturulma">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-slate-400" />
                    {formatDateTime(task.created_at)}
                  </span>
                </Meta>
              </dl>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <TaskActions
                  task={task}
                  userId={user.id}
                  mode="detail"
                  formOptions={formOptions}
                  afterDeleteHref={backHref}
                />
                {task.accepted_at && (
                  <p className="mt-3 text-sm text-slate-400">
                    {formatDateTime(task.accepted_at)} tarihinde kabul edildi.
                  </p>
                )}
              </div>
            </section>
          </OptimisticTasksProvider>

          {/* Açıklama */}
          <section className={`${card} p-4 sm:p-5`}>
            <h2 className="mb-3 text-base font-bold text-slate-900">Açıklama</h2>
            {task.description ? (
              <Markdown>{task.description}</Markdown>
            ) : (
              <p className="text-slate-400">Bu görev için açıklama eklenmemiş.</p>
            )}
          </section>

          {/* Görevi atayan, sorumlusu ve Admin düzenler; "Herkes" görevinde ekip */}
          <TaskChecklist
            taskId={task.id}
            items={checklistRes.data ?? []}
            canEdit={
              task.created_by === user.id ||
              task.assigned_to === user.id ||
              task.assigned_to === null ||
              user.isAdmin
            }
          />

          <TaskTime
            taskId={task.id}
            entries={timeRes.data ?? []}
            meId={user.id}
            // eslint-disable-next-line react-hooks/purity -- istek anındaki saat bilerek kullanılıyor
            serverNow={Date.now()}
            today={today}
          />

          <div id="yorumlar" className="scroll-mt-20">
            <TaskComments
              taskId={task.id}
              comments={shownComments}
              totalCount={comments.length}
              currentUserId={user.id}
              currentUserName={user.name}
              isAdmin={user.isAdmin}
              selectedDay={selectedDay}
              days={days}
              today={today}
              members={formOptions.members}
            />
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-8">
          <TaskAttachments taskId={task.id} attachments={attachments} />
          <TaskLinks links={links} scope={task.id} removableUrls={removableUrls} />
        </aside>
      </div>
    </>
  );
}

function Person({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar name={name} size="sm" />
      <span className="truncate">{name}</span>
    </span>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className="mt-1.5 text-sm font-medium text-slate-800">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 animate-pulse items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className={`${card} h-60`} />
        <div className={`${card} h-40`} />
        <div className={`${card} h-64`} />
      </div>
      <div className="space-y-4">
        <div className={`${card} h-56`} />
        <div className={`${card} h-40`} />
      </div>
    </div>
  );
}
