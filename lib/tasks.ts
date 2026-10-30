import type { TaskPriority, TaskStatus } from "@/types/database";

export const TASK_STATUSES: TaskStatus[] = [
  "pending",
  "in_progress",
  "review",
  "done",
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Onay Bekliyor",
  in_progress: "Yapılıyor",
  review: "Kontrol",
  done: "Tamamlandı",
};

// Proje panosundaki sütun başlıkları (soldan sağa)
export const BOARD_COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "pending", title: "Yeni" },
  { status: "in_progress", title: "Yapılıyor" },
  { status: "review", title: "Kontrol" },
  { status: "done", title: "Tamamlandı" },
];

export const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-200",
  review: "bg-sky-50 text-sky-700 ring-sky-200",
  done: "bg-teal-50 text-teal-700 ring-teal-200",
};

export const STATUS_DOTS: Record<TaskStatus, string> = {
  pending: "bg-slate-400",
  in_progress: "bg-amber-500",
  review: "bg-sky-500",
  done: "bg-teal-500",
};

// Öncelikler, seçim listesindeki sırayla (en düşükten en acile)
export const TASK_PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: "Önceliksiz",
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  urgent: "Acil",
};

export function isTaskPriority(value: unknown): value is TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority);
}

// Formdaki "Atanacak kişi" kutusunda "Herkes" seçeneğinin değeri
export const EVERYONE = "everyone";

// ---------------------------------------------------------------------
// İş akışı kuralları (aynı kurallar veritabanı trigger'ında da var)
// ---------------------------------------------------------------------

export type WorkflowTask = {
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string | null;
};

// Onay bekleyen görevi; atanan kişi ya da "Herkes"e açıksa herhangi biri kabul eder
export function canAccept(task: WorkflowTask, userId: string) {
  return (
    task.status === "pending" &&
    (task.assigned_to === null || task.assigned_to === userId)
  );
}

// Sadece görevi alan kişi kontrole gönderir
export function canSubmitForReview(task: WorkflowTask, userId: string) {
  return task.status === "in_progress" && task.assigned_to === userId;
}

// Revize Ver: kontroldeki görevi sadece atayan kişi "Yapılıyor"a geri gönderir
export function canRequestRevision(task: WorkflowTask, userId: string) {
  return task.status === "review" && task.created_by === userId;
}

export const MAX_REVISION_NOTE = 5_000;

// Sadece görevi atayan kişi, görev kabul edildikten sonra tamamlar
export function canComplete(task: WorkflowTask, userId: string) {
  return (
    (task.status === "in_progress" || task.status === "review") &&
    task.created_by === userId
  );
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase("tr-TR") ?? "")
      .join("") || "?"
  );
}

// Listelerde Markdown işaretleri yerine sade bir önizleme
export function previewText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?(```|$)/g, " [kod] ")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Panoda kart sürüklenince yapılacak işlem (yoksa null: bu geçişe izin yok).
// Kurallar butonlarla aynıdır; veritabanı da ayrıca denetler.
export type BoardMove = "accept" | "submit" | "revision" | "complete";

export function boardMove(task: WorkflowTask, to: TaskStatus, userId: string): BoardMove | null {
  if (task.status === to) return null;
  if (to === "in_progress" && canAccept(task, userId)) return "accept";
  if (to === "review" && canSubmitForReview(task, userId)) return "submit";
  if (to === "in_progress" && canRequestRevision(task, userId)) return "revision";
  if (to === "done" && canComplete(task, userId)) return "complete";
  return null;
}
