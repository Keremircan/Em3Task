import { MessagesSquare } from "lucide-react";
import { Markdown } from "@/components/markdown/markdown";
import { ZoomableAvatar } from "@/components/ui/avatar-lightbox";
import { card } from "@/components/ui/styles";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { DayFilter } from "@/components/conversation/day-filter";
import { deleteComment } from "@/actions/task-details";
import { formatDate, formatDateTime } from "@/lib/format";
import { CommentThread } from "./comment-form";

export type TaskComment = {
  id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  author: { full_name: string | null; avatar_url?: string | null } | null;
};

export function TaskComments({
  taskId,
  comments,
  totalCount,
  currentUserId,
  currentUserName,
  isAdmin,
  selectedDay,
  days,
  today,
}: {
  taskId: string;
  comments: TaskComment[]; // seçilen güne göre süzülmüş
  totalCount: number;
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  selectedDay: string | null;
  days: string[];
  today: string;
}) {
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">
          Yorumlar ve tartışma
        </h2>
      </div>

      <div className="mb-4 border-b border-slate-100 pb-4">
        <DayFilter
          selected={selectedDay}
          days={days}
          today={today}
          anchor="#yorumlar"
          total={totalCount}
          shown={comments.length}
        />
      </div>

      <CommentThread
        taskId={taskId}
        authorName={currentUserName}
        viewingPastDay={selectedDay !== null && selectedDay !== today}
        hasItems={comments.length > 0}
        empty={
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-slate-500">
            <MessagesSquare className="size-5 shrink-0 text-slate-400" />
            {selectedDay === null
              ? "Henüz yorum yok. İlk yorumu sen yaz."
              : selectedDay === today
                ? totalCount
                  ? "Bugün yorum yok. Önceki günler için oklara ya da “Tümü”ne bakın."
                  : "Henüz yorum yok. İlk yorumu sen yaz."
                : `${formatDate(`${selectedDay}T12:00:00Z`)} tarihinde yorum yok.`}
          </div>
        }
        items={comments.map((comment) => {
          const name = comment.author?.full_name || "Eski üye";
          const canDelete = isAdmin || comment.user_id === currentUserId;
          return (
            <li key={comment.id} className="group flex gap-3.5">
              <ZoomableAvatar name={name} src={comment.author?.avatar_url} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5">
                  <span className="font-bold text-slate-900">{name}</span>
                  <time dateTime={comment.created_at} className="text-sm text-slate-400">
                    {formatDateTime(comment.created_at)}
                  </time>
                  {canDelete && (
                    <span className="ml-auto">
                      <ConfirmDeleteButton
                        action={deleteComment}
                        args={[comment.id]}
                        label="Yorumu sil"
                        title="Yorumu sil"
                        message="Bu yorum herkes için kalıcı olarak silinecek."
                        confirmLabel="Yorumu sil"
                        reveal
                      />
                    </span>
                  )}
                </div>
                <div className="mt-1.5 rounded-xl rounded-tl-md bg-slate-50 px-4 py-2">
                  <Markdown>{comment.content}</Markdown>
                </div>
              </div>
            </li>
          );
        })}
      />
    </section>
  );
}
