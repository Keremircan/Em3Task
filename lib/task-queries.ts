import "server-only";
import { getProjects } from "@/lib/projects";
import { getTeamMembers } from "@/lib/team";
import type { TaskFormOptions } from "@/components/tasks/task-form-dialog";

// Görev listelerinde ortak kullanılan alanlar (tek satır olmalı: tip çıkarımı için)
export const TASK_LIST_SELECT =
  "id, title, description, status, priority, due_date, revision_count, created_at, assigned_to, created_by, project_id, project:projects!tasks_project_id_fkey(id, name), assignee:profiles!tasks_assigned_to_fkey(full_name), creator:profiles!tasks_created_by_fkey(full_name), comments:task_comments(count), labels:task_labels(label:labels(id, name, color)), checklist:task_checklist_items(is_done)" as const;

// Görev formu (oluştur/düzenle) için proje ve kişi listeleri
export async function getTaskFormOptions(): Promise<TaskFormOptions> {
  const [projects, members] = await Promise.all([getProjects(), getTeamMembers()]);
  return {
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    members,
  };
}
