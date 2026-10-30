// Teslim tarihi hesapları (sunucu ve tarayıcı). Tarihler "YYYY-MM-DD" ve
// Türkiye saatine göre "bugün" ile karşılaştırılır.
import type { TaskStatus } from "@/types/database";

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDayString(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// a'dan b'ye kaç gün (b - a)
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export type DueTone = "overdue" | "today" | "soon" | "later" | "done";

export type DueInfo = { label: string; tone: DueTone; days: number };

const shortFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });

export function shortDay(day: string): string {
  return shortFmt.format(new Date(`${day}T00:00:00Z`));
}

// Rozet metni ve rengi: "Gecikti · 2 gün", "Bugün", "Yarın", "3 gün kaldı", "12 Kas"
export function dueInfo(due: string, status: TaskStatus, today: string): DueInfo {
  const days = daysBetween(today, due);
  if (status === "done") return { label: shortDay(due), tone: "done", days };
  if (days < 0) return { label: `Gecikti · ${-days} gün`, tone: "overdue", days };
  if (days === 0) return { label: "Bugün", tone: "today", days };
  if (days === 1) return { label: "Yarın", tone: "soon", days };
  if (days <= 7) return { label: `${days} gün kaldı`, tone: "soon", days };
  return { label: shortDay(due), tone: "later", days };
}
