import { Suspense } from "react";
import type { Metadata } from "next";
import { Bug, MonitorSmartphone, Server, ShieldAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { card } from "@/components/ui/styles";
import { PageHeader } from "../_components/page-header";
import { ListSkeleton } from "../_components/list-parts";
import { ClearErrorsButton } from "./clear-errors-button";

export const metadata: Metadata = { title: "Hata kayıtları · Em3Task" };

const TITLE = "Hata kayıtları";
const LIMIT = 200;

const KIND_LABELS: Record<string, string> = {
  render: "Sayfa çizimi",
  route: "API adresi",
  action: "Sunucu işlemi",
  proxy: "Oturum denetimi",
};

export default function ErrorLogPage() {
  return (
    <Suspense fallback={<ListSkeleton title={TITLE} />}>
      <ErrorLog />
    </Suspense>
  );
}

async function ErrorLog() {
  const user = await getCurrentUser();

  if (!user.isAdmin) {
    return (
      <>
        <PageHeader title={TITLE} label="EKİP" />
        <div className={`${card} flex flex-col items-center px-6 py-12 text-center`}>
          <ShieldAlert className="size-8 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-900">Bu sayfayı sadece Admin görebilir.</p>
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("error_log")
    .select(
      "id, created_at, source, message, digest, path, method, route, kind, stack, user_agent, reporter:profiles!error_log_user_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMIT);

  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title={TITLE}
        label="EKİP"
        description="Uygulamada oluşan beklenmedik hatalar. En yeni üstte; 30 günden eski kayıtlar kendiliğinden silinir."
        action={rows.length ? <ClearErrorsButton count={rows.length} /> : undefined}
      />

      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-rose-700">
          Kayıtlar yüklenemedi. Sayfayı yenileyip tekrar deneyin.
        </p>
      )}

      {!error && rows.length === 0 ? (
        <div className={`${card} flex flex-col items-center px-6 py-12 text-center`}>
          <Bug className="size-8 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-900">Kayıtlı hata yok</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Bir sayfa açılamadığında ya da bir işlem beklenmedik şekilde başarısız olduğunda ayrıntısı
            burada görünür.
          </p>
        </div>
      ) : (
        <ul className={`${card} divide-y divide-slate-100`}>
          {rows.map((row) => {
            const server = row.source === "server";
            const Icon = server ? Server : MonitorSmartphone;
            return (
              <li key={row.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold ring-1 ring-inset ${
                      server
                        ? "bg-rose-50 text-rose-700 ring-rose-200"
                        : "bg-amber-50 text-amber-800 ring-amber-200"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {server ? "Sunucu" : "Tarayıcı"}
                  </span>
                  <time dateTime={row.created_at}>{formatDateTime(row.created_at)}</time>
                  {row.path && (
                    <span className="font-mono text-[11.5px] text-slate-600 [overflow-wrap:anywhere]">
                      {row.method ? `${row.method} ` : ""}
                      {row.path}
                    </span>
                  )}
                  {row.kind && <span>{KIND_LABELS[row.kind] ?? row.kind}</span>}
                  {row.reporter?.full_name && <span>{row.reporter.full_name}</span>}
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                  {row.message}
                </p>
                {(row.stack || row.route || row.digest || row.user_agent) && (
                  <details className="mt-1.5 text-xs text-slate-500">
                    <summary className="cursor-pointer font-medium text-slate-600 hover:text-teal-700">
                      Teknik ayrıntı
                    </summary>
                    <dl className="mt-2 space-y-1">
                      {row.route && <Detail label="Dosya">{row.route}</Detail>}
                      {row.digest && <Detail label="Kod">{row.digest}</Detail>}
                      {row.user_agent && <Detail label="Tarayıcı">{row.user_agent}</Detail>}
                    </dl>
                    {row.stack && (
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-[11.5px] leading-relaxed text-slate-700">
                        {row.stack}
                      </pre>
                    )}
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rows.length === LIMIT && (
        <p className="mt-3 text-xs text-slate-500">Son {LIMIT} kayıt gösteriliyor.</p>
      )}
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 font-mono text-[11.5px] text-slate-700 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}
