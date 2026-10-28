"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlert, Plus, Trash } from "lucide-react";
import { createRole, deleteRole } from "@/actions/roles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { field } from "@/components/ui/styles";
import { safe } from "@/lib/safe-action";

export function CreateRoleForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const name = inputRef.current?.value ?? "";
        setError(null);
        startTransition(async () => {
          const result = await safe(createRole(name));
          if (result.error) setError(result.error);
          else if (inputRef.current) inputRef.current.value = "";
        });
      }}
    >
      <label htmlFor="role-name" className="sr-only">
        Yeni rol adı
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="role-name"
          required
          maxLength={40}
          disabled={pending}
          onChange={() => error && setError(null)}
          placeholder="Yeni rol, örn. Frontend"
          className={`${field} mt-0 h-9 flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          <Plus className="size-4" strokeWidth={2.6} />
          Oluştur
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-rose-600">
          <CircleAlert className="size-4" /> {error}
        </p>
      )}
    </form>
  );
}

export function DeleteRoleButton({ roleId, roleName }: { roleId: string; roleName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${roleName} rolünü sil`}
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash className="size-4" />
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rolü sil"
        message={`"${roleName}" rolü silinecek ve bu role sahip üyelerden kaldırılacak.`}
        confirmLabel="Rolü sil"
        onConfirm={() => deleteRole(roleId)}
      />
    </>
  );
}
