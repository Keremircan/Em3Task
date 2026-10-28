"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis, Pencil, Trash } from "lucide-react";
import { deleteProject } from "@/actions/projects";
import type { ProjectSummary } from "@/lib/projects";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NewProjectDialog } from "./new-project-dialog";
import { safe } from "@/lib/safe-action";

export function ProjectMenu({
  project,
  isCurrent,
}: {
  project: ProjectSummary;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <Menu
        label={`${project.name} seçenekleri`}
        tone="dark"
        trigger={<Ellipsis className="size-5" />}
        triggerClassName="rounded-md p-1 text-neutral-400 transition hover:bg-white/10 hover:text-white"
        items={[
          {
            label: "Düzenle",
            icon: <Pencil className="size-4" />,
            onSelect: () => setRenaming(true),
          },
          {
            label: "Projeyi sil",
            icon: <Trash className="size-4" />,
            danger: true,
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <NewProjectDialog
        open={renaming}
        onClose={() => setRenaming(false)}
        project={project}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Projeyi sil"
        message={`"${project.name}" projesi silinecek. İçinde görev olan projeler silinemez; önce görevleri silin.`}
        confirmLabel="Projeyi sil"
        onConfirm={async () => {
          const result = await safe(deleteProject(project.id));
          if (!result.error && isCurrent) router.push("/");
          return result;
        }}
      />
    </>
  );
}
