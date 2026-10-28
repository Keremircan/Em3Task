"use client";

import { useState } from "react";
import { Check, Tag } from "lucide-react";
import { setMemberRole } from "@/actions/roles";
import { Modal } from "@/components/ui/modal";
import { ghostButton, smallGhostButton } from "@/components/ui/styles";
import { safe } from "@/lib/safe-action";

// Admin: bir üyeye birden fazla rol verip geri alabilir
export function MemberRolesEditor({
  memberId,
  memberName,
  roles,
  assignedRoleIds,
}: {
  memberId: string;
  memberName: string;
  roles: { id: string; name: string }[]; // Admin hariç roller
  assignedRoleIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [assigned, setAssigned] = useState(() => new Set(assignedRoleIds));
  const [error, setError] = useState<string | null>(null);
  // Sadece kaydedilmekte olan rolün kutusu kilitlenir; diğerleri tıklanabilir kalır
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

  async function toggle(roleId: string) {
    if (pendingIds.has(roleId)) return;
    const next = !assigned.has(roleId);
    setError(null);
    setPendingIds((prev) => new Set(prev).add(roleId));
    setAssigned((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(roleId);
      else copy.delete(roleId);
      return copy;
    });
    const result = await safe(setMemberRole(memberId, roleId, next));
    setPendingIds((prev) => {
      const copy = new Set(prev);
      copy.delete(roleId);
      return copy;
    });
    if (result.error) {
      setError(result.error);
      // Başarısız olursa eski hâline döndür
      setAssigned((prev) => {
        const copy = new Set(prev);
        if (next) copy.delete(roleId);
        else copy.add(roleId);
        return copy;
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAssigned(new Set(assignedRoleIds));
          setOpen(true);
        }}
        title={`${memberName}: rol ata`}
        aria-label={`${memberName}: rol ata`}
        className={smallGhostButton}
      >
        <Tag className="size-4" /> <span className="xl:max-2xl:hidden">Rol ata</span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Rol ata"
        description={`${memberName} için rolleri seçin. Bir kişi birden fazla rol alabilir.`}
      >
        {roles.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
            Önce Roller bölümünden bir rol oluşturun.
          </p>
        ) : (
          <ul className="space-y-2">
            {roles.map((role) => {
              const checked = assigned.has(role.id);
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={pendingIds.has(role.id)}
                    onClick={() => toggle(role.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-2 text-left text-sm font-medium transition disabled:opacity-60 ${
                      checked
                        ? "border-teal-300 bg-teal-50 text-teal-900"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex size-5 items-center justify-center rounded-md border ${
                        checked ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white"
                      }`}
                    >
                      {checked && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    {role.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={() => setOpen(false)} className={ghostButton}>
            Kapat
          </button>
        </div>
      </Modal>
    </>
  );
}
