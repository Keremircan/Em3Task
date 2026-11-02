import {
  Download,
  ExternalLink,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { card } from "@/components/ui/styles";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { ScrollList } from "@/components/ui/scroll-list";
import { deleteGeneralFile } from "@/actions/general";
import { formatBytes } from "@/lib/attachments";
import { formatDate } from "@/lib/format";
import { kindOfMime, type FileKind } from "@/lib/general-files";

export type GeneralDocument = {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  uploaderName: string;
  canDelete: boolean; // yükleyen kişi ya da Admin
};

export const KIND_UI: Record<FileKind, { icon: LucideIcon; tone: string }> = {
  image: { icon: FileImage, tone: "bg-sky-50 text-sky-600" },
  pdf: { icon: FileText, tone: "bg-rose-50 text-rose-600" },
  word: { icon: FileType, tone: "bg-blue-50 text-blue-600" },
  excel: { icon: FileSpreadsheet, tone: "bg-emerald-50 text-emerald-600" },
  powerpoint: { icon: Presentation, tone: "bg-orange-50 text-orange-600" },
  text: { icon: FileText, tone: "bg-slate-100 text-slate-600" },
  archive: { icon: FileArchive, tone: "bg-amber-50 text-amber-600" },
};

// Dosya adresleri: süreli imzalı link tıklanınca sunucuda üretilir
export function viewUrl(id: string) {
  return `/api/genel/dosya/${id}`;
}
export function downloadUrl(id: string) {
  return `/api/genel/dosya/${id}?indir`;
}

export function GeneralDocuments({ documents }: { documents: GeneralDocument[] }) {
  return (
    <section className={`${card} p-4`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900">DOKÜMANLAR</h2>
        <span className="text-sm text-slate-500">{documents.length}</span>
      </div>

      {documents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
          Sohbette paylaşılan dokümanlar burada otomatik listelenir.
        </p>
      ) : (
        <ScrollList count={documents.length} label="Dokümanlar">
          {documents.map((doc) => {
            const { icon: Icon, tone } = KIND_UI[kindOfMime(doc.file_type)];
            return (
              <li
                key={doc.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5"
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-slate-900" title={doc.file_name}>
                    {doc.file_name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {doc.uploaderName} · {formatDate(doc.created_at)}
                    {doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                    <a
                      href={viewUrl(doc.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${doc.file_name} görüntüle`}
                      title="Görüntüle"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-teal-50 hover:text-teal-700"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                    <a
                      href={downloadUrl(doc.id)}
                      aria-label={`${doc.file_name} indir`}
                      title="İndir"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-teal-50 hover:text-teal-700"
                    >
                      <Download className="size-4" />
                    </a>
                    {doc.canDelete && (
                      <ConfirmDeleteButton
                        action={deleteGeneralFile}
                        args={[doc.id]}
                        label={`${doc.file_name} sil`}
                        title="Dokümanı sil"
                        message={`"${doc.file_name}" herkes için kalıcı olarak silinecek ve paylaşıldığı mesajdan da kalkacak.`}
                        confirmLabel="Dokümanı sil"
                      />
                    )}
                  </div>
              </li>
            );
          })}
        </ScrollList>
      )}
    </section>
  );
}
