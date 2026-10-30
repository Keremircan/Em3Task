// Türkçe Excel ile uyumlu CSV: noktalı virgül ayırıcı, UTF-8 BOM (Türkçe harfler
// bozulmasın), CRLF satır sonu. "=", "+", "-", "@" ile başlayan hücreler formül
// olarak çalışmasın diye başına ' eklenir (CSV enjeksiyonu).

type Cell = string | number | null | undefined;

const nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2, useGrouping: false });

function cell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? nf.format(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

const dt = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});
const d = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export const csvDateTime = (iso: string | null) => (iso ? dt.format(new Date(iso)) : "");
export const csvDay = (day: string | null) => (day ? d.format(new Date(`${day}T00:00:00Z`)) : "");
