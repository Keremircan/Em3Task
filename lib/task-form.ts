// Görev formunun (oluştur / düzenle / tekrarlayan görev) ortak okuma ve doğrulaması
import { EVERYONE, isTaskPriority, isUuid } from "@/lib/tasks";
import { isDayString } from "@/lib/due";
import type { TaskPriority } from "@/types/database";

export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 50_000;

export type TaskFields = {
  title: string;
  description: string | null;
  project_id: string;
  assigned_to: string | null; // null = "Herkes"
  priority: TaskPriority;
  due_date: string | null;
};

// Geçerliyse alanları, değilse kullanıcıya gösterilecek hata metnini döndürür
export function readTaskForm(formData: FormData): TaskFields | string {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const projectId = formData.get("project_id");
  const assignee = formData.get("assigned_to");
  const priority = formData.get("priority") ?? "none";
  const due = String(formData.get("due_date") ?? "").trim();

  if (!title) return "Görev adı zorunludur.";
  if (title.length > MAX_TITLE) return "Görev adı en fazla 200 karakter olabilir.";
  if (description.length > MAX_DESCRIPTION) return "Görev açıklaması çok uzun.";
  if (!isUuid(projectId)) return "Görevin bağlı olduğu projeyi seçin.";
  if (assignee !== EVERYONE && !isUuid(assignee)) {
    return "Görevi atayacağınız kişiyi seçin.";
  }
  if (!isTaskPriority(priority)) return "Geçersiz öncelik.";
  if (due && !isDayString(due)) return "Geçersiz teslim tarihi.";

  return {
    title,
    description: description || null,
    project_id: projectId,
    assigned_to: assignee === EVERYONE ? null : (assignee as string),
    priority,
    due_date: due || null,
  };
}
