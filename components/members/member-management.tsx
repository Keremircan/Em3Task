"use client";

import {
  createContext,
  useContext,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { CircleAlert, Eye, EyeOff, LoaderCircle, UserMinus, UserPlus, X } from "lucide-react";
import { addMember, removeMember, setMemberManagementPermission } from "@/actions/members";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { field, fieldLabel, ghostButton, primaryButton } from "@/components/ui/styles";

// Üye ekleme/çıkarma: işlem ekrana hemen yansır (useOptimistic), hesap sunucuda
// service role ile oluşturulur/silinir. Hata olursa liste eski haline döner.

type PendingMember = { id: string; name: string; email: string };
type Op = { type: "add"; member: PendingMember } | { type: "remove"; id: string };
type State = { added: PendingMember[]; removed: string[] };

type Ctx = {
  added: PendingMember[];
  removed: string[];
  run: (op: Op, action: () => Promise<{ error: string | null }>) => void;
};

const MembersContext = createContext<Ctx | null>(null);

export function MembersProvider({ children }: { children: ReactNode }) {
  const [state, apply] = useOptimistic<State, Op>({ added: [], removed: [] }, (s, op) =>
    op.type === "add"
      ? { ...s, added: [...s.added, op.member] }
      : { ...s, removed: [...s.removed, op.id] },
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run: Ctx["run"] = (op, action) => {
    setError(null);
    startTransition(async () => {
      apply(op);
      const result = await action();
      if (result.error) setError(result.error);
    });
  };

  return (
    <MembersContext.Provider value={{ ...state, run }}>
      {children}
      {error && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-start gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm text-rose-700 shadow-lg lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">İşlem geri alındı: {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Uyarıyı kapat"
            className="rounded p-0.5 text-rose-500 hover:bg-rose-50"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </MembersContext.Provider>
  );
}

function useMembers() {
  const ctx = useContext(MembersContext);
  if (!ctx) throw new Error("MembersProvider eksik");
  return ctx;
}

// Sunucuda çizilen üye satırları + henüz kaydı bitmemiş yeni üyeler
export function MemberRows({ rows }: { rows: { id: string; node: ReactNode }[] }) {
  const { added, removed } = useMembers();
  const existing = new Set(rows.map((r) => r.id));
  return (
    <ul className="divide-y divide-slate-100">
      {rows
        .filter((r) => !removed.includes(r.id))
        .map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            {r.node}
          </li>
        ))}
      {added
        .filter((m) => !existing.has(m.id))
        .map((m) => (
          <li key={m.id} className="flex items-center gap-3.5 py-3.5 last:pb-0" aria-live="polite">
            <Avatar name={m.name} />
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-900">{m.name}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                {m.email}
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <LoaderCircle className="size-3 animate-spin" /> hesap açılıyor
                </span>
              </p>
            </div>
          </li>
        ))}
    </ul>
  );
}

export function MemberCount({ ids }: { ids: string[] }) {
  const { added, removed } = useMembers();
  const count =
    ids.filter((id) => !removed.includes(id)).length +
    added.filter((m) => !ids.includes(m.id)).length;
  return <span className="text-sm text-slate-500">{count} kişi</span>;
}

export function AddMemberButton() {
  const { run } = useMembers();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  function close() {
    setError(null);
    setShowPassword(false);
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButton}>
        <UserPlus className="size-4" strokeWidth={2.2} /> Yeni üye
      </button>
      <Modal
        open={open}
        onClose={close}
        size="sm"
        title="Yeni üye ekle"
        description="Hesap hemen açılır; üye bu e-posta ve geçici şifreyle giriş yapabilir."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const fullName = String(form.get("fullName") ?? "").trim();
            const email = String(form.get("email") ?? "").trim().toLowerCase();
            const password = String(form.get("password") ?? "");
            // Kolay hatalar pencere kapanmadan gösterilsin
            if (!fullName) return setError("Ad soyad zorunludur.");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Geçerli bir e-posta girin.");
            if (password.length < 8) return setError("Şifre en az 8 karakter olmalı.");
            const id = crypto.randomUUID();
            close();
            run({ type: "add", member: { id, name: fullName, email } }, () =>
              addMember({ id, fullName, email, password }),
            );
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="member-name" className={fieldLabel}>
              Ad Soyad
            </label>
            <input
              id="member-name"
              name="fullName"
              required
              maxLength={80}
              autoComplete="off"
              placeholder="Örn. Ayşe Yılmaz"
              className={`${field} h-10`}
            />
          </div>
          <div>
            <label htmlFor="member-email" className={fieldLabel}>
              E-posta
            </label>
            <input
              id="member-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="ayse@ornek.com"
              className={`${field} h-10`}
            />
          </div>
          <div>
            <label htmlFor="member-password" className={fieldLabel}>
              Geçici şifre
            </label>
            <div className="relative">
              <input
                id="member-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                placeholder="En az 8 karakter"
                className={`${field} h-10 pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                className="absolute top-1/2 right-1.5 mt-[3px] -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">Şifreyi üyeye kendiniz iletin.</p>
          </div>
          {error && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              <CircleAlert className="size-4 shrink-0" /> {error}
            </p>
          )}
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={close} className={ghostButton}>
              Vazgeç
            </button>
            <button type="submit" className={primaryButton}>
              <UserPlus className="size-4" strokeWidth={2.2} /> Üyeyi ekle
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function RemoveMemberButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const { run } = useMembers();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${memberName}: üyeyi çıkar`}
        aria-label={`${memberName}: üyeyi çıkar`}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
      >
        <UserMinus className="size-3.5" /> <span className="xl:max-2xl:hidden">Üyeyi çıkar</span>
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Üyeyi çıkar"
        message={`${memberName} hesabı silinecek ve artık giriş yapamayacak. Atadığı tüm görevler de yorumları ve dosyalarıyla birlikte silinir. Kendisine atanmış görevler ve yazdığı yorumlar kalır; adı "Eski üye" olarak görünür.`}
        confirmLabel="Üyeyi çıkar"
        onConfirm={async () => {
          run({ type: "remove", id: memberId }, () => removeMember(memberId));
          return { error: null };
        }}
      />
    </>
  );
}

// Admin: diğer üyelerin de üye ekleyip çıkarmasına izin ver anahtarı
export function MemberPermissionToggle({ allowAll }: { allowAll: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(allowAll);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await setMemberManagementPermission(next);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p id="perm-label" className="text-sm font-semibold text-slate-900">
            Diğer üyelerin de üye ekleyip çıkarmasına izin ver
          </p>
          <p className="text-xs text-slate-500">
            {optimistic
              ? "Açık: tüm ekip üyeleri üye ekleyip çıkarabilir."
              : "Kapalı: sadece Admin üye ekleyip çıkarabilir."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={optimistic}
          aria-labelledby="perm-label"
          onClick={toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
            optimistic ? "bg-teal-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
              optimistic ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
