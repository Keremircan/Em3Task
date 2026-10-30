// Etiket renkleri ve yardımcılar (sunucu ve tarayıcı)
import type { LabelColor } from "@/types/database";

export type LabelLite = { id: string; name: string; color: LabelColor };

export const LABEL_COLORS: { key: LabelColor; name: string; chip: string; dot: string }[] = [
  { key: "slate", name: "Gri", chip: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
  { key: "red", name: "Kırmızı", chip: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" },
  { key: "orange", name: "Turuncu", chip: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500" },
  { key: "amber", name: "Sarı", chip: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-400" },
  { key: "green", name: "Yeşil", chip: "bg-green-50 text-green-700 ring-green-200", dot: "bg-green-500" },
  { key: "teal", name: "Turkuaz", chip: "bg-teal-50 text-teal-700 ring-teal-200", dot: "bg-teal-500" },
  { key: "sky", name: "Açık mavi", chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  { key: "blue", name: "Mavi", chip: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  { key: "violet", name: "Mor", chip: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  { key: "pink", name: "Pembe", chip: "bg-pink-50 text-pink-700 ring-pink-200", dot: "bg-pink-500" },
];

const BY_KEY = new Map(LABEL_COLORS.map((c) => [c.key, c]));

export function labelColor(key: string) {
  return BY_KEY.get(key as LabelColor) ?? LABEL_COLORS[0];
}

export function isLabelColor(value: unknown): value is LabelColor {
  return typeof value === "string" && BY_KEY.has(value as LabelColor);
}

export const MAX_LABEL_NAME = 40;
export const MAX_CHECKLIST_TITLE = 300;

export function cleanText(value: unknown, max: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

// Görev sorgularında etiketler ve kontrol listesi özeti
export const TASK_EXTRAS_SELECT =
  "labels:task_labels(label:labels(id, name, color)), checklist:task_checklist_items(is_done)";

type LabelRow = { label: LabelLite | null };
export function taskLabels(rows: LabelRow[] | null | undefined): LabelLite[] {
  return (rows ?? [])
    .map((r) => r.label)
    .filter((l): l is LabelLite => l !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export function checklistProgress(rows: { is_done: boolean }[] | null | undefined) {
  const list = rows ?? [];
  return { done: list.filter((r) => r.is_done).length, total: list.length };
}
