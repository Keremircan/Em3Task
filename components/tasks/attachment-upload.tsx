"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlert, CloudUpload, LoaderCircle } from "lucide-react";
import { uploadAttachment } from "@/actions/task-details";
import {
  ALLOWED_ATTACHMENT_TYPES,
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/attachments";
import { safe } from "@/lib/safe-action";

export function AttachmentUpload({ taskId }: { taskId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length || pending) return;

    // Sunucuya gitmeden önce hızlı kontrol (asıl kontrol sunucuda)
    const problems: string[] = [];
    const valid = list.filter((f) => {
      if (!ALLOWED_ATTACHMENT_TYPES[f.type]) {
        problems.push(`${f.name}: sadece görsel ve PDF yüklenebilir.`);
        return false;
      }
      if (f.size > MAX_ATTACHMENT_BYTES) {
        problems.push(`${f.name}: en fazla 10 MB olabilir.`);
        return false;
      }
      return true;
    });
    setErrors(problems);
    if (!valid.length) return;

    startTransition(async () => {
      for (const [i, file] of valid.entries()) {
        setProgress(
          valid.length > 1
            ? `${file.name} yükleniyor (${i + 1}/${valid.length})…`
            : `${file.name} yükleniyor…`,
        );
        const fd = new FormData();
        fd.append("file", file);
        const result = await safe(uploadAttachment(taskId, fd));
        if (result.error) {
          setErrors((prev) => [...prev, `${file.name}: ${result.error}`]);
        }
      }
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        className={[
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
          dragging
            ? "border-teal-400 bg-teal-50"
            : "border-slate-200 bg-slate-50/60 hover:border-teal-300 hover:bg-teal-50/50",
          pending ? "pointer-events-none opacity-70" : "",
        ].join(" ")}
      >
        {pending ? (
          <LoaderCircle className="size-7 animate-spin text-teal-600" />
        ) : (
          <CloudUpload className="size-7 text-teal-600" />
        )}
        <span className="text-sm font-bold text-slate-800">
          {pending ? progress : "Dosya seç veya buraya sürükle"}
        </span>
        <span className="text-sm text-slate-500">
          Ekran görüntüsü, görsel veya PDF · en fazla 10 MB
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          disabled={pending}
          onChange={(e) => e.target.files && upload(e.target.files)}
          className="sr-only"
        />
      </label>

      {errors.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1.5">
          {errors.map((err, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> {err}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
