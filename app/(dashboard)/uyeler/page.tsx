import { Suspense } from "react";
import type { Metadata } from "next";
import { CircleAlert, Clock, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Avatar } from "@/components/ui/avatar";
import { card } from "@/components/ui/styles";
import { MemberRolesEditor } from "@/components/members/member-roles-editor";
import { CreateRoleForm, DeleteRoleButton } from "@/components/members/role-controls";
import { PageHeader } from "../_components/page-header";
import { createAdminClient } from "@/utils/supabase/admin";
import { getMemberPermission } from "@/lib/members";
import {
  AddMemberButton,
  MemberCount,
  MemberPermissionToggle,
  MemberRows,
  MembersProvider,
  RemoveMemberButton,
} from "@/components/members/member-management";

export const metadata: Metadata = { title: "Üyeler · Em3Task" };

export default function MembersPage() {
  return (
    <>
      <PageHeader title="Üyeler" description="Ekip üyeleri ve rolleri." />
      <Suspense fallback={<MembersSkeleton />}>
        <Members />
      </Suspense>
    </>
  );
}

async function Members() {
  const supabase = await createClient();

  // Kullanıcı bilgisi (Admin mi?), yetki ayarı ve sayfa verileri aynı turda, paralel
  const [user, permission, auth, { data: profiles }, { data: roles }, { data: links }] =
    await Promise.all([
      getCurrentUser(),
      getMemberPermission(),
      getMemberAuthInfo(),
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, last_seen_at")
        .order("full_name"),
      supabase
        .from("roles")
        .select("id, name, is_system")
        .order("is_system", { ascending: false })
        .order("name"),
      supabase.from("member_roles").select("profile_id, role_id"),
    ]);

  const allRoles = roles ?? [];
  const roleById = new Map(allRoles.map((r) => [r.id, r]));
  const editableRoles = allRoles.filter((r) => !r.is_system);
  const rolesOf = (profileId: string) =>
    (links ?? [])
      .filter((l) => l.profile_id === profileId)
      .map((l) => roleById.get(l.role_id))
      .filter((r) => r !== undefined)
      .sort(
        (a, b) => Number(b.is_system) - Number(a.is_system) || a.name.localeCompare(b.name, "tr"),
      );
  const memberCount = (roleId: string) => (links ?? []).filter((l) => l.role_id === roleId).length;

  const members = profiles ?? [];

  const configured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <MembersProvider>
      {/* Yetki ayarı: Admin değiştirir; diğerleri sadece durumu görür */}
      <section className={`${card} mb-4 p-4 sm:p-5`}>
        {permission.isAdmin ? (
          <MemberPermissionToggle allowAll={permission.allowAll} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Lock className="size-4 shrink-0" />
            {permission.allowAll
              ? "Admin, tüm üyelerin üye ekleyip çıkarmasına izin verdi."
              : "Üye ekleme ve çıkarma sadece Admin tarafından yapılır."}
          </p>
        )}
        {permission.canManage && !configured && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            Üye ekleme/çıkarma için sunucuda SUPABASE_SERVICE_ROLE_KEY tanımlanmalı.
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className={`${card} p-4 sm:p-5`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h2 className="text-base font-bold text-slate-900">Üyeler</h2>
              <MemberCount ids={members.map((p) => p.id)} />
            </div>
            {permission.canManage && <AddMemberButton />}
          </div>
          <MemberRows
            rows={members.map((p) => {
              const name = p.full_name || "İsimsiz üye";
              const memberRoles = rolesOf(p.id);
              const isSelf = p.id === user.id;
              const isAdminMember = memberRoles.some((r) => r.is_system);
              return {
                id: p.id,
                node: (
                  <>
                    {/* Ad, e-posta, son giriş ve roller tek satırda; dar ekranda alt satıra kayar */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={name} src={p.avatar_url} />
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 lg:flex-nowrap">
                        <p
                          className="max-w-full min-w-[6rem] shrink-[0.3] truncate font-bold text-slate-900"
                          title={name}
                        >
                          {name}
                          {isSelf && (
                            <span className="ml-1.5 text-sm font-medium text-slate-400">(siz)</span>
                          )}
                        </p>
                        {auth.get(p.id)?.email && (
                          <span
                            title={auth.get(p.id)?.email}
                            className="max-w-full min-w-[4.5rem] shrink-[4] truncate text-xs text-slate-500"
                          >
                            {auth.get(p.id)?.email}
                          </span>
                        )}
                        <LastSeen at={latest(p.last_seen_at, auth.get(p.id)?.lastSignIn ?? null)} />
                        <div className="flex shrink-0 flex-wrap gap-1.5 lg:flex-nowrap">
                          {memberRoles.length === 0 && (
                            <span className="text-xs text-slate-400">Rol yok</span>
                          )}
                          {memberRoles.map((r) => (
                            <RoleBadge key={r.id} name={r.name} system={r.is_system} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                      {user.isAdmin && (
                        <MemberRolesEditor
                          memberId={p.id}
                          memberName={name}
                          roles={editableRoles.map((r) => ({ id: r.id, name: r.name }))}
                          assignedRoleIds={memberRoles.filter((r) => !r.is_system).map((r) => r.id)}
                        />
                      )}
                      {permission.canManage &&
                        (isSelf || isAdminMember ? (
                          <span
                            title={
                              isSelf ? "Kendinizi çıkaramazsınız" : "Admin üyelikten çıkarılamaz"
                            }
                            className="inline-flex items-center gap-1 text-xs text-slate-400"
                          >
                            <Lock className="size-3.5" />{" "}
                            <span className="xl:max-2xl:hidden">
                              {isSelf ? "Siz" : "Çıkarılamaz"}
                            </span>
                          </span>
                        ) : (
                          <RemoveMemberButton memberId={p.id} memberName={name} />
                        ))}
                    </div>
                  </>
                ),
              };
            })}
          />
        </section>

        <section className={`${card} p-4 sm:p-5`}>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-base font-bold text-slate-900">Roller</h2>
            <span className="text-sm text-slate-500">{allRoles.length} rol</span>
          </div>

          {user.isAdmin ? (
            <div className="mb-4">
              <CreateRoleForm />
            </div>
          ) : (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-500">
              <Lock className="size-4 shrink-0" /> Rolleri sadece Admin oluşturup atayabilir.
            </p>
          )}

          <ul className="space-y-2">
            {allRoles.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <RoleBadge name={r.name} system={r.is_system} />
                  <span className="text-sm text-slate-500">{memberCount(r.id)} üye</span>
                </div>
                {r.is_system ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                    <Lock className="size-3.5" /> Sabit rol
                  </span>
                ) : (
                  user.isAdmin && <DeleteRoleButton roleId={r.id} roleName={r.name} />
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </MembersProvider>
  );
}

// E-posta ve son giriş zamanı auth tablosunda; sunucuda service role ile okunur
// (anahtar yoksa boş). Tarayıcıya sadece bu iki bilgi gider.
type AuthInfo = { email: string; lastSignIn: string | null };

async function getMemberAuthInfo(): Promise<Map<string, AuthInfo>> {
  const admin = createAdminClient();
  if (!admin) return new Map();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return new Map(
    (data?.users ?? []).map((u) => [
      u.id,
      { email: u.email ?? "", lastSignIn: u.last_sign_in_at ?? null },
    ]),
  );
}

const signInFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});
const signInFormatWithYear = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

// İki zamandan yeni olanı (son görülme ya da son şifreyle giriş)
function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

const ACTIVE_MS = 10 * 60 * 1000; // son 10 dakikada görüldüyse "Şu an aktif"

// "Son görülme: 25 Ekim 15:30" (geçen yıldan eskiyse yıl da yazılır)
function LastSeen({ at }: { at: string | null }) {
  const chip =
    "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap";
  if (!at) {
    return (
      <span className={`${chip} bg-slate-50 text-slate-400`}>
        <Clock className="size-3" /> Henüz giriş yapmadı
      </span>
    );
  }
  const date = new Date(at);
  const full = signInFormatWithYear.format(date);
  // Sunucuda çizilir: "şimdi" isteğin geldiği an
  // eslint-disable-next-line react-hooks/purity -- istek anındaki saat bilerek kullanılıyor
  const now = Date.now();
  if (now - date.getTime() < ACTIVE_MS) {
    return (
      <span
        title={`Son görülme: ${full}`}
        className={`${chip} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70`}
      >
        <span className="size-1.5 rounded-full bg-emerald-500" /> Şu an aktif
      </span>
    );
  }
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  const text = (sameYear ? signInFormat : signInFormatWithYear).format(date).replace(",", "");
  return (
    <span
      title={`Son görülme: ${full}`}
      className={`${chip} bg-slate-50 text-slate-500 ring-1 ring-slate-200/70`}
    >
      <Clock className="size-3" /> Son görülme: {text}
    </span>
  );
}

function RoleBadge({ name, system }: { name: string; system: boolean }) {
  return system ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">
      <ShieldCheck className="size-3.5" /> {name}
    </span>
  ) : (
    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
      {name}
    </span>
  );
}

function MembersSkeleton() {
  return (
    <div className="grid grid-cols-1 animate-pulse gap-4 xl:grid-cols-[1.5fr_1fr]">
      <div className={`${card} h-72`} />
      <div className={`${card} h-72`} />
    </div>
  );
}
