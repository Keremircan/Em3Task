"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  Lock,
  Paperclip,
  SendHorizontal,
  Users,
  X,
} from "lucide-react";
import { discardGeneralUploads, sendGeneralMessage, type UploadedFile } from "@/actions/general";
import {
  GENERAL_ACCEPT,
  GENERAL_BUCKET,
  GENERAL_TYPES_LABEL,
  generalFileType,
  MAX_GENERAL_FILE_BYTES,
} from "@/lib/general-files";
import { createClient } from "@/utils/supabase/client";
import { formatBytes } from "@/lib/attachments";
import { Avatar } from "@/components/ui/avatar";
import { safe } from "@/lib/safe-action";
import { EmojiButton, insertAtCursor } from "@/components/chat/emoji-picker";
import { MentionList, useMentions } from "@/components/chat/mentions";

type Sending = {
  text: string;
  files: string[];
  progress: string | null;
  receiver: Member | null;
};
type Member = { id: string; name: string };

const firstName = (name: string) => name.split(" ")[0] || name;

export function MessageComposer({
  authorName,
  members,
  viewingPastDay = false,
}: {
  authorName: string;
  members: Member[]; // alıcı seçici için ekip (kendisi hariç)
  viewingPastDay?: boolean; // geçmiş bir gün süzülüyse yeni mesaj görünmez
}) {
  // Alıcı: varsayılan herkes. Seçim gönderimden sonra da kalır (aynı kişiyle
  // yazışmaya devam edilebilsin); kutunun üstündeki rozet her zaman gösterir.
  const [receiverId, setReceiverId] = useState<string>("");
  const receiver = members.find((m) => m.id === receiverId) ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState<Sending | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // "@" ile kişi önerme: özel mesajda başka birini anmak anlamsız (bildirilmez)
  const mention = useMentions(receiver ? [] : members, textRef, content, setContent);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const problems: string[] = [];
    const valid = Array.from(list).filter((f) => {
      if (!generalFileType(f.name)) {
        problems.push(`${f.name}: bu dosya türü desteklenmiyor.`);
        return false;
      }
      if (f.size > MAX_GENERAL_FILE_BYTES) {
        problems.push(`${f.name}: en fazla 10 MB olabilir.`);
        return false;
      }
      return true;
    });
    setErrors(problems);
    setFiles((prev) => [...prev, ...valid]);
  }

  function send() {
    const text = content.trim();
    const toUpload = files;
    if ((!text && !toUpload.length) || pending) return;

    setErrors([]);
    // İyimser güncelleme: mesaj sunucuyu beklemeden ekranda görünür
    const to = receiver;
    setSending({ text, files: toUpload.map((f) => f.name), progress: null, receiver: to });
    setContent("");
    setFiles([]);
    requestAnimationFrame(() => window.dispatchEvent(new Event("cotask:chat-sent")));

    startTransition(async () => {
      // 1) Dosyalar tarayıcıdan doğrudan depoya, paralel yüklenir
      const failed: string[] = [];
      const uploaded: UploadedFile[] = [];
      if (toUpload.length) {
        setSending((s) => s && { ...s, progress: `${toUpload.length} dosya yükleniyor` });
        const supabase = createClient();
        const folder = crypto.randomUUID();
        const results = await Promise.all(
          toUpload.map(async (file) => {
            const type = generalFileType(file.name)!;
            const path = `${folder}/${crypto.randomUUID()}.${type.ext}`;
            const { error } = await supabase.storage
              .from(GENERAL_BUCKET)
              .upload(path, file, { contentType: type.mime, upsert: false });
            return { file, path, error };
          }),
        );
        for (const r of results) {
          if (r.error) failed.push(`${r.file.name}: yüklenemedi.`);
          else uploaded.push({ path: r.path, name: r.file.name, size: r.file.size });
        }
      }

      // Gönderilecek bir şey kalmadıysa (sadece dosya vardı ve hepsi başarısız)
      if (!text && !uploaded.length) {
        setErrors(failed);
        setFiles(toUpload);
        setSending(null);
        return;
      }

      // 2) Mesaj ve dosya kayıtları tek istekte kaydedilir
      const result = await safe(sendGeneralMessage(text, uploaded, to?.id ?? null));
      if (result.error) {
        await safe(discardGeneralUploads(uploaded.map((u) => u.path)));
        setErrors([result.error, ...failed]);
        setContent(text);
        setFiles(toUpload);
        setSending(null);
        return;
      }

      setErrors(failed);
      setSending(null);
      // Yeni mesaj bugüne düşer: geçmiş bir gündeysek süzgeci kaldır ki görünsün
      if (viewingPastDay) router.replace(pathname, { scroll: false });
      textRef.current?.focus();
    });
  }

  return (
    <>
      {sending && (
        <div className="flex gap-3 px-4 pb-3 opacity-70 sm:px-4" aria-live="polite">
          <Avatar name={authorName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <span className="font-bold text-slate-700">{authorName}</span>
              {sending.receiver && <PrivateTag other={sending.receiver.name} />}
              <LoaderCircle className="size-3.5 animate-spin" />
              {sending.progress ?? "Gönderiliyor…"}
            </p>
            {sending.text && (
              <p className="mt-0.5 text-sm whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">
                {sending.text}
              </p>
            )}
            {sending.files.length > 0 && (
              <p className="mt-1 text-sm text-slate-500">📎 {sending.files.join(", ")}</p>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-slate-100 p-3 sm:p-4"
      >
        {/* Kime: varsayılan herkes; bir üye seçilirse özel mesaj */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label htmlFor="general-receiver" className="text-xs font-semibold text-slate-500">
            Kime
          </label>
          <div className="relative">
            {receiver ? (
              <Lock
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-amber-600"
              />
            ) : (
              <Users
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-teal-600"
              />
            )}
            <select
              id="general-receiver"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className={`h-8 max-w-[14rem] appearance-none truncate rounded-full border py-0 pr-8 pl-8 text-[13px] font-semibold outline-none transition focus:ring-3 ${
                receiver
                  ? "border-amber-200 bg-amber-50 text-amber-800 focus:ring-amber-500/15"
                  : "border-slate-200 bg-white text-slate-700 focus:border-teal-500 focus:ring-teal-500/15"
              }`}
            >
              <option value="">Herkes (Genel)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-400"
            />
          </div>
          {receiver && (
            <span
              role="status"
              className="inline-flex items-center gap-1 rounded-full bg-amber-100/70 px-2.5 py-1 text-xs font-semibold text-amber-800"
            >
              🔒 Yalnızca {firstName(receiver.name)} görebilir
            </span>
          )}
        </div>
        {files.length > 0 && (
          <ul className="mb-2.5 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex max-w-full items-center gap-2 rounded-lg bg-slate-100 py-1.5 pr-1.5 pl-3 text-sm"
              >
                <span className="truncate font-medium text-slate-800">{f.name}</span>
                <span className="shrink-0 text-slate-400">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`${f.name} dosyasını çıkar`}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            title={`Doküman ekle · ${GENERAL_TYPES_LABEL} · en fazla 10 MB`}
            aria-label="Doküman ekle"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-teal-700 sm:size-11"
          >
            <Paperclip className="size-5" />
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={GENERAL_ACCEPT}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
            className="sr-only"
            tabIndex={-1}
          />
          <EmojiButton
            className="size-9 sm:size-11"
            onSelect={(emoji) => insertAtCursor(textRef.current, content, emoji, setContent)}
          />
          <label htmlFor="general-message" className="sr-only">
            Mesaj
          </label>
          <div className="relative flex min-w-0 flex-1">
          <MentionList {...mention} />
          <textarea
            ref={textRef}
            id="general-message"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              mention.sync();
            }}
            onSelect={mention.sync}
            onBlur={() => setTimeout(mention.close, 150)}
            onKeyDown={(e) => {
              // "@" öneri listesi açıksa oklar/Enter kişi seçer
              if (mention.onKeyDown(e)) return;
              // Enter gönderir, Shift + Enter yeni satır
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={
              receiver ? `${firstName(receiver.name)} için özel mesaj…` : "Ekibe bir mesaj yazın…"
            }
            className="max-h-48 min-h-9 min-w-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 sm:px-4 text-[13.5px] text-slate-900 outline-none [field-sizing:content] placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
          />
          </div>
          <button
            type="submit"
            disabled={pending || (!content.trim() && files.length === 0)}
            aria-label="Gönder"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br sm:size-11 from-[#46bba2] to-[#2a8577] text-white shadow-[0_6px_16px_-6px_rgba(42,133,119,0.6)] transition hover:brightness-105 disabled:opacity-50"
          >
            <SendHorizontal className="size-5" strokeWidth={2.4} />
          </button>
        </div>
        <p className="mt-1.5 pl-1 text-xs text-slate-400 sm:pl-[104px]">
          Enter ile gönder · Shift + Enter yeni satır · link, doküman, Markdown ve ```kod```
        </p>

        {errors.length > 0 && (
          <ul role="alert" className="mt-2 space-y-1">
            {errors.map((err, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-rose-600">
                <CircleAlert className="mt-0.5 size-4 shrink-0" /> {err}
              </li>
            ))}
          </ul>
        )}
      </form>
    </>
  );
}

// Özel mesaj etiketi: "🔒 Yalnızca sen ve Fahrettin"
export function PrivateTag({ other }: { other: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200/70">
      <Lock className="size-3" /> Yalnızca sen ve {firstName(other)}
    </span>
  );
}
