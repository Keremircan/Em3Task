import { Download, ExternalLink, File, FileImage, FileText } from "lucide-react";
import { card } from "@/components/ui/styles";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { ScrollList } from "@/components/ui/scroll-list";
import { deleteTaskAttachment } from "@/actions/task-details";
import { isImageType } from "@/lib/attachments";
import { formatDate } from "@/lib/format";
import { AttachmentUpload } from "./attachment-upload";

export type TaskAttachment = {
  id: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
  uploader: { full_name: string | null } | null;
  // Özel bucket için üretilmiş süreli link (üretilemezse null)
  signedUrl: string | null;
  canDelete: boolean; // yükleyen kişi ya da Admin
};

export function TaskAttachments({
  taskId,
  attachments,
}: {
  taskId: string;
  attachments: TaskAttachment[];
}) {
  return (
    <section className={`${card} p-4`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900">
          Ekler ve Dosyalar
        </h2>
        <span className="text-sm text-slate-500">{attachments.length}</span>
      </div>

      {attachments.length > 0 && (
        <div className="mb-4">
          <ScrollList count={attachments.length} label="Ekler ve Dosyalar" className="space-y-2.5">
            {attachments.map((a) => (
              <AttachmentRow key={a.id} attachment={a} />
            ))}
          </ScrollList>
        </div>
      )}

      <AttachmentUpload taskId={taskId} />
    </section>
  );
}

function AttachmentRow({ attachment: a }: { attachment: TaskAttachment }) {
  const image = isImageType(a.file_type);
  const Icon = image ? FileImage : a.file_type === "application/pdf" ? FileText : File;
  const tone = image
    ? "bg-sky-50 text-sky-600"
    : a.file_type === "application/pdf"
      ? "bg-rose-50 text-rose-600"
      : "bg-slate-100 text-slate-600";

  // Supabase imzalı linklerine ?download= eklenince dosya asıl adıyla iner
  const downloadUrl = a.signedUrl
    ? `${a.signedUrl}${a.signedUrl.includes("?") ? "&" : "?"}download=${encodeURIComponent(a.file_name)}`
    : null;

  return (
    <li className="rounded-xl border border-slate-100 p-3">
      {image && a.signedUrl && (
        <a
          href={a.signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 block overflow-hidden rounded-lg bg-slate-50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- süreli Storage linki, next/image optimizasyonu gereksiz */}
          <img
            src={a.signedUrl}
            alt={a.file_name}
            loading="lazy"
            className="max-h-44 w-full object-cover transition hover:opacity-90"
          />
        </a>
      )}
      <div className="flex items-center gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900" title={a.file_name}>
            {a.file_name}
          </p>
          <p className="truncate text-xs text-slate-500">
            {a.uploader?.full_name ?? "Eski üye"} · {formatDate(a.created_at)}
          </p>
        </div>
        {a.canDelete && (
          <ConfirmDeleteButton
            action={deleteTaskAttachment}
            args={[a.id]}
            label="Dosyayı sil"
            title="Dosyayı sil"
            message={`"${a.file_name}" herkes için kalıcı olarak silinecek.`}
            confirmLabel="Dosyayı sil"
          />
        )}
      </div>
      {a.signedUrl && downloadUrl ? (
        <div className="mt-3 flex gap-2">
          <a
            href={a.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800 transition hover:bg-teal-100"
          >
            <ExternalLink className="size-4" /> Görüntüle
          </a>
          <a
            href={downloadUrl}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <Download className="size-4" /> İndir
          </a>
        </div>
      ) : (
        <p className="mt-2 text-xs text-rose-600">Dosya bağlantısı oluşturulamadı.</p>
      )}
    </li>
  );
}
