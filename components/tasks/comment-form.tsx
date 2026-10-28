"use client";

import { useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleAlert, SendHorizontal, X } from "lucide-react";
import { addComment } from "@/actions/task-details";
import { Avatar } from "@/components/ui/avatar";
import { field, primaryButton } from "@/components/ui/styles";
import { safe } from "@/lib/safe-action";
import { EmojiButton, insertAtCursor } from "@/components/chat/emoji-picker";

type PendingComment = { key: string; text: string };

// Yorum listesi + yazma kutusu.
// Gönderilen yorum sunucuyu beklemeden listeye eklenir (useOptimistic);
// kayıt arka planda yapılır. Sunucudan gerçek yorum gelince geçici olanın yerini alır,
// hata olursa geçici yorum kaybolur, uyarı çıkar ve yazılan metin kutuya geri döner.
export function CommentThread({
  taskId,
  authorName,
  items,
  hasItems,
  empty,
  viewingPastDay = false,
}: {
  taskId: string;
  authorName: string;
  items: ReactNode; // sunucuda çizilmiş yorumlar (<li> listesi)
  hasItems: boolean;
  empty: ReactNode; // yorum yokken gösterilecek kutu
  viewingPastDay?: boolean; // geçmiş bir gün süzülüyse yeni yorum görünmez
}) {
  const router = useRouter();
  const pathname = usePathname();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [pending, addPending] = useOptimistic<PendingComment[], PendingComment>(
    [],
    (list, comment) => [...list, comment],
  );

  function submit() {
    const text = content.trim();
    if (!text) return;
    setError(null);
    setContent("");
    textareaRef.current?.focus();

    startTransition(async () => {
      addPending({ key: crypto.randomUUID(), text });
      const result = await safe(addComment(taskId, text));
      if (result.error) {
        setError(result.error);
        // Kutuya bu arada yeni bir şey yazılmadıysa metni geri koy
        setContent((current) => (current.trim() ? current : text));
        return;
      }
      if (viewingPastDay) {
        // Yeni yorum bugüne düşer: süzgeci kaldır ki görünsün
        router.replace(`${pathname}#yorumlar`, { scroll: false });
      }
    });
  }

  return (
    <>
      {!hasItems && pending.length === 0 && empty}

      {(hasItems || pending.length > 0) && (
        <ol className="mb-4 space-y-4">
          {items}
          {pending.map((comment) => (
            <li key={comment.key} className="flex gap-3.5" aria-live="polite">
              <Avatar name={authorName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-slate-900">{authorName}</span>
                  <span className="text-sm text-slate-400">şimdi</span>
                </div>
                <div className="mt-1.5 rounded-xl rounded-tl-md bg-slate-50 px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">
                  {comment.text}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <label htmlFor="comment" className="sr-only">
          Yorum
        </label>
        <textarea
          ref={textareaRef}
          id="comment"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            // Enter gönderir, Shift + Enter yeni satır (Türkçe klavye birleşimi sürerken değil)
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder={"Yorumunuzu yazın… Kod paylaşmak için:\n```ts\nconst x = 1;\n```"}
          className={`${field} mt-0 resize-y py-2.5 font-[inherit]`}
        />

        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            <CircleAlert className="size-4 shrink-0" />
            <span className="flex-1">Yorum gönderilemedi: {error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Uyarıyı kapat"
              className="rounded p-0.5 text-rose-500 hover:bg-rose-100"
            >
              <X className="size-3.5" />
            </button>
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <EmojiButton
              className="size-9"
              onSelect={(emoji) => insertAtCursor(textareaRef.current, content, emoji, setContent)}
            />
            <p className="text-xs text-slate-400">
              Enter ile gönder · Shift + Enter yeni satır · Markdown desteklenir
            </p>
          </div>
          <button type="submit" disabled={!content.trim()} className={primaryButton}>
            <SendHorizontal className="size-4" strokeWidth={2.2} />
            Gönder
          </button>
        </div>
      </form>
    </>
  );
}
