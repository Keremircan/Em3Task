import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ClipboardList, Lock, MessageSquare, MessagesSquare, Search } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { card } from "@/components/ui/styles";
import { StatusBadge } from "@/components/tasks/status-badge";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Arama · Em3Task" };

const LIMIT = 20;

export default function SearchPage({ searchParams }: PageProps<"/ara">) {
  return (
    <>
      <PageHeader title="Arama" description="Görevler, yorumlar ve Genel sohbet." />
      <Suspense fallback={<div className={`${card} h-64 animate-pulse`} />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}

// ilike içinde % ve _ joker karakterdir; kullanıcının yazdığı gibi aransın
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

async function Results({ searchParams }: Pick<PageProps<"/ara">, "searchParams">) {
  const [{ q: raw }, userId, supabase] = await Promise.all([
    searchParams,
    getUserId(),
    createClient(),
  ]);
  const q = (typeof raw === "string" ? raw : "").trim().replace(/\s+/g, " ").slice(0, 100);

  const form = (
    <Form action="/ara" className={`${card} mb-4 flex items-center gap-2 p-2`} role="search">
      <label className="relative flex-1">
        <span className="sr-only">Ara</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          minLength={2}
          maxLength={100}
          required
          autoFocus={!q}
          placeholder="Görev, yorum ya da mesaj ara…"
          className="h-10 w-full rounded-lg bg-transparent pr-3 pl-9 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </label>
      <button
        type="submit"
        className="h-9 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
      >
        Ara
      </button>
    </Form>
  );

  if (q.length < 2) {
    return (
      <>
        {form}
        <p className="text-center text-sm text-slate-500">Aramak için en az 2 karakter yazın.</p>
      </>
    );
  }

  const pattern = likePattern(q);
  // Veritabanı kuralları geçerli: özel mesajlar sadece iki tarafın aramasında çıkar
  const [byTitle, byDesc, comments, messages] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, status, created_at, project:projects!tasks_project_id_fkey(name)",
      )
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("tasks")
      .select(
        "id, title, description, status, created_at, project:projects!tasks_project_id_fkey(name)",
      )
      .ilike("description", pattern)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("task_comments")
      .select(
        "id, content, created_at, task:tasks!task_comments_task_id_fkey(id, title), author:profiles!task_comments_user_id_fkey(full_name)",
      )
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("general_messages")
      .select(
        "id, content, created_at, user_id, receiver_id, author:profiles!general_messages_user_id_fkey(full_name), receiver:profiles!general_messages_receiver_id_fkey(full_name)",
      )
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);

  const taskMap = new Map<string, NonNullable<typeof byTitle.data>[number]>();
  for (const t of [...(byTitle.data ?? []), ...(byDesc.data ?? [])]) taskMap.set(t.id, t);
  const tasks = [...taskMap.values()].slice(0, LIMIT);
  const commentList = comments.data ?? [];
  const messageList = messages.data ?? [];
  const total = tasks.length + commentList.length + messageList.length;
  const failed = byTitle.error || byDesc.error || comments.error || messages.error;

  return (
    <>
      {form}
      {failed && (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Arama tamamlanamadı. Tekrar deneyin.
        </p>
      )}
      {total === 0 && !failed ? (
        <p className={`${card} px-4 py-10 text-center text-sm text-slate-500`}>
          “{q}” için sonuç bulunamadı.
        </p>
      ) : (
        <div className="space-y-4">
          {tasks.length > 0 && (
            <Group
              icon={<ClipboardList className="size-4.5" />}
              title="Görevler"
              count={tasks.length}
            >
              {tasks.map((t) => (
                <Row key={t.id} href={`/gorevler/${t.id}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      <Highlight text={t.title} q={q} />
                    </span>
                    <StatusBadge status={t.status} />
                  </span>
                  {t.description &&
                    !t.title.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")) && (
                      <Snippet text={t.description} q={q} />
                    )}
                  <Meta>
                    {t.project?.name ?? "Projesiz"} · {formatDateTime(t.created_at)}
                  </Meta>
                </Row>
              ))}
            </Group>
          )}
          {commentList.length > 0 && (
            <Group
              icon={<MessageSquare className="size-4.5" />}
              title="Yorumlar"
              count={commentList.length}
            >
              {commentList.map((c) => (
                <Row key={c.id} href={c.task ? `/gorevler/${c.task.id}#yorumlar` : "#"}>
                  <Snippet text={c.content} q={q} />
                  <Meta>
                    {c.author?.full_name ?? "Eski üye"} · {c.task?.title ?? "Silinmiş görev"} ·{" "}
                    {formatDateTime(c.created_at)}
                  </Meta>
                </Row>
              ))}
            </Group>
          )}
          {messageList.length > 0 && (
            <Group
              icon={<MessagesSquare className="size-4.5" />}
              title="Genel sohbet"
              count={messageList.length}
            >
              {messageList.map((m) => (
                <Row key={m.id} href="/genel?gun=tumu">
                  <Snippet text={m.content} q={q} />
                  <Meta>
                    {m.author?.full_name ?? "Eski üye"}
                    {m.receiver_id && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-700">
                        <Lock className="size-3" /> özel ·{" "}
                        {m.user_id === userId ? (m.receiver?.full_name ?? "Eski üye") : "size"}
                      </span>
                    )}{" "}
                    · {formatDateTime(m.created_at)}
                  </Meta>
                </Row>
              ))}
            </Group>
          )}
          {total >= LIMIT && (
            <p className="text-center text-xs text-slate-400">
              Her bölümde en fazla {LIMIT} sonuç gösterilir; aramayı daraltabilirsiniz.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function Group({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
        <span className="text-slate-400">{icon}</span> {title}
        <span className="text-sm font-medium text-slate-400">{count}</span>
      </h2>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

function Row({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="-mx-2 block rounded-lg px-2 py-2.5 transition hover:bg-slate-50">
        {children}
      </Link>
    </li>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-xs text-slate-400">{children}</span>;
}

// Eşleşen kısmı vurgular (Türkçe büyük/küçük harf duyarsız)
function Highlight({ text, q }: { text: string; q: string }) {
  const lower = text.toLocaleLowerCase("tr");
  const needle = q.toLocaleLowerCase("tr");
  const parts: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (needle && i < text.length) {
    const at = lower.indexOf(needle, i);
    if (at === -1 || lower.length !== text.length) break;
    if (at > i) parts.push(text.slice(i, at));
    parts.push(
      <mark key={k++} className="rounded bg-amber-100 px-0.5 text-inherit">
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    i = at + needle.length;
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}

// Uzun metinde eşleşmenin çevresinden kısa bir parça
function Snippet({ text, q }: { text: string; q: string }) {
  const plain = text
    .replace(/[`*_#>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const at = plain.toLocaleLowerCase("tr").indexOf(q.toLocaleLowerCase("tr"));
  const start = Math.max(0, at - 60);
  const piece = plain.slice(start, start + 180);
  return (
    <span className="block text-sm text-slate-600 [overflow-wrap:anywhere]">
      {start > 0 && "…"}
      <Highlight text={piece} q={q} />
      {start + 180 < plain.length && "…"}
    </span>
  );
}
