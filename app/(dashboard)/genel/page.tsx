import { Suspense } from "react";
import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { dayKey, formatDate, formatDateTime, formatTime } from "@/lib/format";
import { extractLinks, GENERAL_LINK_SCOPE, withoutRemoved } from "@/lib/links";
import { parseDayParam, todayKey } from "@/lib/days";
import { kindOfMime } from "@/lib/general-files";
import { Markdown } from "@/components/markdown/markdown";
import { ZoomableAvatar } from "@/components/ui/avatar-lightbox";
import { Reactable } from "@/components/chat/reactions";
import { groupReactions, REACTIONS_SELECT } from "@/lib/reactions";
import { card } from "@/components/ui/styles";
import { TaskLinks } from "@/components/tasks/task-links";
import { ChatScroller } from "@/components/general/chat-scroller";
import { MessageComposer, PrivateTag } from "@/components/general/message-composer";
import { getTeamMembers } from "@/lib/team";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { DayFilter } from "@/components/conversation/day-filter";
import { deleteGeneralMessage } from "@/actions/general";
import {
  downloadUrl,
  GeneralDocuments,
  KIND_UI,
  viewUrl,
  type GeneralDocument,
} from "@/components/general/general-documents";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Genel · Em3Task" };

// "Tümü" görünümünde gösterilen son mesaj sayısı
const MESSAGE_LIMIT = 300;
// Gün listesi ve LİNKLER için okunan en fazla mesaj
const HISTORY_LIMIT = 3000;
// Aynı kişinin bu süre içindeki ardışık mesajları tek blokta gösterilir
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export default function GeneralPage({ searchParams }: PageProps<"/genel">) {
  return (
    <>
      <PageHeader
        title="Genel"
        description="Projeden bağımsız ekip sohbeti; paylaşılan linkler ve dokümanlar sağda toplanır."
      />
      <Suspense fallback={<GeneralSkeleton />}>
        <General searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function General({ searchParams }: Pick<PageProps<"/genel">, "searchParams">) {
  const supabase = await createClient();

  // Kullanıcı, mesajlar, dokümanlar ve kaldırılan linkler aynı turda, paralel
  // Veritabanı kuralları (RLS) sadece görebileceğimiz mesajları döndürür:
  // herkese açık olanlar, gönderdiğimiz ve bize gelen özel mesajlar
  const [user, { gun }, messagesRes, filesRes, removedRes, team] = await Promise.all([
    getCurrentUser(),
    searchParams,
    supabase
      .from("general_messages")
      .select(
        `id, user_id, receiver_id, content, created_at,
         author:profiles!general_messages_user_id_fkey(full_name, avatar_url),
         receiver:profiles!general_messages_receiver_id_fkey(full_name),
         ${REACTIONS_SELECT}`,
      )
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("general_files")
      .select(
        "id, message_id, file_name, file_type, file_size, created_at, uploaded_by, uploader:profiles!general_files_uploaded_by_fkey(full_name)",
      )
      .order("created_at", { ascending: false }),
    supabase.from("removed_links").select("url, created_at").eq("scope", GENERAL_LINK_SCOPE),
    getTeamMembers(),
  ]);

  const setupMissing = Boolean(messagesRes.error || filesRes.error);
  const history = [...(messagesRes.data ?? [])].reverse(); // eskiden yeniye
  const files = filesRes.data ?? [];

  // Gün seçici: seçilen günün mesajları; seçilmemişse son mesajlar
  // Varsayılan: bugün. "Tümü" seçilince ?gun=tumu
  const today = todayKey();
  const selectedDay = parseDayParam(gun, today);
  const days = [...new Set(history.map((m) => dayKey(m.created_at)))];
  const messages = selectedDay
    ? history.filter((m) => dayKey(m.created_at) === selectedDay)
    : history.slice(-MESSAGE_LIMIT);
  const canDelete = (ownerId: string | null) => user.isAdmin || ownerId === user.id;

  const documents: GeneralDocument[] = files.map((f) => ({
    id: f.id,
    file_name: f.file_name,
    file_type: f.file_type,
    file_size: f.file_size,
    created_at: f.created_at,
    uploaderName: f.uploader?.full_name ?? "Eski üye",
    canDelete: canDelete(f.uploaded_by),
  }));
  const filesByMessage = new Map<string, GeneralDocument[]>();
  files.forEach((f, i) => {
    const list = filesByMessage.get(f.message_id) ?? [];
    list.unshift(documents[i]); // mesaj içinde yükleme sırasıyla
    filesByMessage.set(f.message_id, list);
  });

  // LİNKLER tüm sohbetten toplanır (gün seçiciden etkilenmez), en yenisi üstte.
  // Listeden kaldırılan link, kaldırıldıktan sonra yeniden paylaşılırsa geri gelir.
  const links = withoutRemoved(
    extractLinks(
      [...history].reverse().map((m) => ({
        text: m.content,
        source: `${m.author?.full_name ?? "Eski üye"} · ${formatDate(m.created_at)}`,
        authorId: m.user_id,
        at: m.created_at,
      })),
    ),
    removedRes.data ?? [],
  );
  const removableUrls = links
    .filter((l) => user.isAdmin || l.authorIds.includes(user.id))
    .map((l) => l.url);

  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section
        className={`${card} flex h-[calc(100dvh-19rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-[420px] lg:h-[calc(100dvh-14rem)] lg:min-h-[460px] flex-col overflow-hidden`}
        aria-label="Ekip sohbeti"
      >
        <div className="border-b border-slate-100 px-4 py-2 sm:px-4">
          <DayFilter
            selected={selectedDay}
            days={days}
            today={today}
            total={history.length}
            shown={messages.length}
          />
        </div>
        <ChatScroller messageCount={messages.length}>
          {setupMissing ? (
            <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Genel sayfası için veritabanı kurulumu eksik: supabase/genel.sql dosyasını Supabase
              SQL Editor&apos;de çalıştırın.
            </p>
          ) : messages.length === 0 && selectedDay ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
              <p className="font-bold text-slate-900">
                {selectedDay === today
                  ? "Bugün henüz mesaj yok"
                  : `${formatDate(`${selectedDay}T12:00:00Z`)} tarihinde mesaj yok`}
              </p>
              <p className="mt-1 text-sm">
                Oklarla mesaj olan günlere geçebilir ya da &quot;Tümü&quot;ne dönebilirsiniz.
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
              <div className="flex size-14 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <MessagesSquare className="size-6" />
              </div>
              <p className="mt-4 font-bold text-slate-900">Sohbet henüz sessiz</p>
              <p className="mt-1 text-sm">
                İlk mesajı yazın; link ve doküman da paylaşabilirsiniz.
              </p>
            </div>
          ) : (
            <ol className="space-y-1">
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
                // Özel mesajlar gruplanmaz: gizlilik etiketi her mesajda görünsün
                const isPrivate = m.receiver_id !== null;
                const grouped =
                  !newDay &&
                  !isPrivate &&
                  prev.receiver_id === null &&
                  prev.user_id === m.user_id &&
                  new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() <
                    GROUP_WINDOW_MS;
                const name = m.author?.full_name ?? "Eski üye";
                const attached = filesByMessage.get(m.id) ?? [];
                return (
                  <li key={m.id}>
                    {newDay && (
                      <div className="my-4 flex items-center gap-3 text-xs font-medium text-slate-400">
                        <span className="h-px flex-1 bg-slate-100" />
                        {formatDate(m.created_at)}
                        <span className="h-px flex-1 bg-slate-100" />
                      </div>
                    )}
                    <div
                      className={`group flex gap-3 rounded-xl px-2 py-1 ${grouped ? "" : "mt-3"} ${
                        isPrivate
                          ? "bg-amber-50/50 ring-1 ring-amber-100 hover:bg-amber-50/80"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="w-8 shrink-0">
                        {!grouped && (
                          <ZoomableAvatar name={name} src={m.author?.avatar_url} size="sm" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {!grouped && (
                          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-[13px] font-bold text-slate-900">{name}</span>
                            {isPrivate && (
                              <PrivateTag
                                other={
                                  m.user_id === user.id
                                    ? (m.receiver?.full_name ?? "Eski üye")
                                    : name
                                }
                              />
                            )}
                            <time
                              dateTime={m.created_at}
                              title={formatDateTime(m.created_at)}
                              className="text-xs text-slate-400"
                            >
                              {formatTime(m.created_at)}
                            </time>
                          </p>
                        )}
                        <Reactable
                          target="general"
                          messageId={m.id}
                          reactions={groupReactions(m.reactions)}
                          me={{ id: user.id, name: user.name }}
                        >
                          {m.content && (
                            <div className="text-sm [&_.markdown]:text-sm">
                              <Markdown>{m.content}</Markdown>
                            </div>
                          )}
                          {attached.length > 0 && <MessageFiles files={attached} />}
                        </Reactable>
                      </div>
                      {canDelete(m.user_id) && (
                        <div className="shrink-0 self-start">
                          <ConfirmDeleteButton
                            action={deleteGeneralMessage}
                            args={[m.id]}
                            label="Mesajı sil"
                            title="Mesajı sil"
                            message="Bu mesaj ve ekli dokümanları herkes için kalıcı olarak silinecek."
                            confirmLabel="Mesajı sil"
                            reveal
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </ChatScroller>
        <MessageComposer
          authorName={user.name}
          members={team.filter((t) => t.id !== user.id)}
          viewingPastDay={selectedDay !== null && selectedDay !== today}
        />
      </section>

      <aside className="space-y-4 xl:sticky xl:top-8">
        <TaskLinks
          links={links}
          scope={GENERAL_LINK_SCOPE}
          removableUrls={removableUrls}
          title="LİNKLER"
          emptyText="Sohbette paylaşılan linkler burada otomatik listelenir."
        />
        <GeneralDocuments documents={documents} />
      </aside>
    </div>
  );
}

// Mesajın altında: görseller küçük önizleme, diğer dosyalar kart olarak
function MessageFiles({ files }: { files: GeneralDocument[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {files.map((f) => {
        const kind = kindOfMime(f.file_type);
        if (kind === "image") {
          return (
            <a
              key={f.id}
              href={viewUrl(f.id)}
              target="_blank"
              rel="noopener noreferrer"
              title={f.file_name}
              className="block overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- süreli Storage linki */}
              <img
                src={viewUrl(f.id)}
                alt={f.file_name}
                loading="lazy"
                className="max-h-56 max-w-72 object-cover"
              />
            </a>
          );
        }
        const { icon: Icon, tone } = KIND_UI[kind];
        return (
          <a
            key={f.id}
            href={downloadUrl(f.id)}
            className="flex max-w-72 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-teal-200 hover:bg-teal-50/40"
          >
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 truncate text-sm font-bold text-slate-800">{f.file_name}</span>
          </a>
        );
      })}
    </div>
  );
}

function GeneralSkeleton() {
  return (
    <div className="grid grid-cols-1 animate-pulse gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div
        className={`${card} h-[calc(100dvh-19rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-[420px] lg:h-[calc(100dvh-14rem)] lg:min-h-[460px]`}
      />
      <div className="space-y-4">
        <div className={`${card} h-40`} />
        <div className={`${card} h-40`} />
      </div>
    </div>
  );
}
