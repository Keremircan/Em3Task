"use client";

import { useOptimistic, useState, type ComponentType } from "react";
import {
  Ban,
  CalendarClock,
  CreditCard,
  ExternalLink,
  Pencil,
  Repeat,
  Server,
  Sparkles,
  Trash,
  TriangleAlert,
  Wallet,
  WalletCards,
  Wifi,
} from "lucide-react";
import type { Subscription, SubscriptionCategory } from "@/types/database";
import { deleteSubscription } from "@/actions/subscriptions";
import {
  CATEGORIES,
  contractNotice,
  formatMoney,
  formatTotals,
  isPaymentWithin,
  nextDue,
  sumByCurrency,
  type DueKind,
  type NextDue,
} from "@/lib/subscriptions";
import { formatDay } from "@/lib/format";
import { card, smallDangerButton, smallGhostButton } from "@/components/ui/styles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { safe } from "@/lib/safe-action";
import { SubscriptionDialog } from "./subscription-dialog";
import { NewSubscriptionButton } from "./new-subscription-button";
import { mergeRecent, useSubscriptionsSync } from "./subscriptions-sync";

const ICONS: Record<SubscriptionCategory, ComponentType<{ className?: string }>> = {
  ai_saas: Sparkles,
  server_domain: Server,
  telecom: Wifi,
  bank_card: CreditCard,
  other: Repeat,
};

const SHORT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.short])) as Record<
  SubscriptionCategory,
  string
>;

// Kalan gün sayacının renkleri: bugün/geçti kırmızı, 3 günden az sarı
const TONE: Record<NextDue["tone"], string> = {
  danger: "bg-rose-50 text-rose-700",
  warning: "bg-amber-50 text-amber-800",
  near: "bg-teal-50 text-teal-800",
  later: "bg-slate-50 text-slate-600",
  muted: "bg-slate-50 text-slate-500",
};

const DUE_CAPTION: Record<DueKind, string> = {
  renewal: "Yenilenme",
  payment: "Son ödeme",
  ends: "Bitiş",
  expired: "Bitiş tarihi",
};

type Filter = "all" | SubscriptionCategory | "cancel";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Hepsi" },
  ...CATEGORIES.map((c) => ({ value: c.value as Filter, label: c.short })),
  { value: "cancel", label: "İptal Edilecekler" },
];

function matches(filter: Filter, s: Subscription) {
  if (filter === "all") return true;
  if (filter === "cancel") return s.cancel_at_period_end;
  return s.category === filter;
}

type Item = { s: Subscription; due: NextDue | null };

// Sıradaki tarihi en yakın olan önde; tarihi olmayanlar en sonda
function byDue(a: Item, b: Item) {
  return (a.due?.days ?? Infinity) - (b.due?.days ?? Infinity) || a.s.name.localeCompare(b.s.name, "tr");
}

const NONE: ReadonlySet<string> = new Set();

export function SubscriptionsBoard({ subscriptions: server, today }: { subscriptions: Subscription[]; today: string }) {
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const sync = useSubscriptionsSync();
  // Silinen kayıt onay beklenmeden gizlenir; hata olursa geri gelir
  const [hidden, hide] = useOptimistic(sync?.removed ?? NONE, (set, id: string) => new Set(set).add(id));
  const subscriptions = mergeRecent(server, sync?.recent ?? {}).filter((s) => !hidden.has(s.id));

  async function remove(s: Subscription) {
    hide(s.id);
    const result = await safe(deleteSubscription(s.id));
    if (!result.error) sync?.forget(s.id);
    return result;
  }

  // Pencereler her durumda çizilir: son kayıt silinirken onay penceresi kaybolmasın
  const dialogs = (
    <>
      <SubscriptionDialog
        key={editing?.id ?? "none"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        subscription={editing ?? undefined}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Kaydı sil"
        message={`"${deleting?.name ?? ""}" kalıcı olarak silinecek.`}
        confirmLabel="Sil"
        onConfirm={() => (deleting ? remove(deleting) : Promise.resolve({ error: null }))}
      />
    </>
  );

  if (subscriptions.length === 0) {
    return (
      <>
        <div className={`${card} flex flex-col items-center gap-2 px-6 py-12 text-center`}>
          <WalletCards className="size-8 text-slate-300" />
          <p className="font-semibold text-slate-700">Henüz kayıt yok</p>
          <p className="max-w-sm text-sm text-slate-500">
            Aboneliklerinizi, sunucu ve domain yenilemelerinizi, faturalarınızı ve kart ödeme günlerinizi tek
            yerde takip edin.
          </p>
          <NewSubscriptionButton className="mt-2" />
        </div>
        {dialogs}
      </>
    );
  }

  const items: Item[] = subscriptions.map((s) => ({ s, due: nextDue(s, today) })).sort(byDue);
  const shown = items.filter((i) => matches(filter, i.s));
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.value, items.filter((i) => matches(f.value, i.s)).length]),
  ) as Record<Filter, number>;

  return (
    <>
      <Summary items={items} />

      <div
        role="group"
        aria-label="Kategori filtresi"
        className="no-scrollbar -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.value)}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition ${
                active
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {f.label}
              <span
                className={`min-w-5 rounded-full px-1.5 text-center text-[11px] tabular-nums ${
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[f.value]}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className={`${card} mt-3 flex flex-col items-center gap-3 px-6 py-10 text-center`}>
          <p className="text-sm text-slate-500">Bu filtrede kayıt yok.</p>
          <button type="button" onClick={() => setFilter("all")} className={smallGhostButton}>
            Hepsini göster
          </button>
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((item) => (
            <SubscriptionCard
              key={item.s.id}
              item={item}
              today={today}
              onEdit={() => setEditing(item.s)}
              onDelete={() => setDeleting(item.s)}
            />
          ))}
        </ul>
      )}
      {dialogs}
    </>
  );
}

// ---------------------------------------------------------------------
// Üst özet kutuları
// ---------------------------------------------------------------------

function Summary({ items }: { items: Item[] }) {
  // Aylık sabit gider: aylık periyottaki (internet & GSM dahil) ve iptal edilmeyecek kayıtlar
  const monthly = items.filter(
    (i) =>
      !i.s.cancel_at_period_end &&
      i.s.amount !== null &&
      (i.s.category === "telecom" ||
        ((i.s.category === "ai_saas" || i.s.category === "other") && i.s.period === "monthly")),
  );
  const monthlyTotals = sumByCurrency(monthly.map((i) => [i.s.currency, i.s.amount ?? 0]));

  // Önümüzdeki 7 gün: yenilemeler ve kart son ödemeleri (liste tarihe göre sıralı)
  const week = items.filter((i) => isPaymentWithin(i.due, 7));
  const nearest = week[0];

  const ending = items.filter((i) => i.s.cancel_at_period_end).length;

  const cards = items.filter((i) => i.s.category === "bank_card");
  const debtTotals = sumByCurrency(
    cards.filter((i) => i.s.current_debt !== null).map((i) => [i.s.currency, i.s.current_debt ?? 0]),
  );

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        icon={Wallet}
        label="Aylık sabit gider"
        value={monthlyTotals.size ? formatTotals(monthlyTotals) : "—"}
        note={monthly.length ? `${monthly.length} aylık ödeme · yıllıklar hariç` : "Aylık abonelik yok"}
      />
      <Tile
        icon={CalendarClock}
        label="Önümüzdeki 7 gün"
        value={`${week.length} ödeme`}
        note={nearest?.due ? `En yakın: ${nearest.s.name} · ${nearest.due.label}` : "Bu hafta ödeme yok"}
        alert={week.some((i) => i.due && (i.due.tone === "danger" || i.due.tone === "warning"))}
      />
      <Tile
        icon={Ban}
        label="İptal edilecek"
        value={String(ending)}
        note={ending ? "Dönem sonunda bitecek" : "İptal edilecek servis yok"}
      />
      <Tile
        icon={CreditCard}
        label="Kart borçları"
        value={debtTotals.size ? formatTotals(debtTotals) : "—"}
        note={cards.length ? `${cards.length} kart` : "Kart eklenmedi"}
      />
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  note,
  alert = false,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
  alert?: boolean; // 3 günden yakın ödeme var
}) {
  return (
    <div className={`${card} min-w-0 px-4 py-3`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className={`size-3.5 shrink-0 ${alert ? "text-amber-600" : "text-slate-400"}`} />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 text-base leading-tight font-bold break-words text-slate-900 tabular-nums sm:text-lg">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500">{note}</p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Abonelik kartı
// ---------------------------------------------------------------------

function SubscriptionCard({
  item,
  today,
  onEdit,
  onDelete,
}: {
  item: Item;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { s, due } = item;
  const Icon = ICONS[s.category];
  const notice = contractNotice(s, today);
  const money = amountOf(s);
  const subtitle = subtitleOf(s);
  const chips = chipsOf(s);

  return (
    <li className={`${card} flex flex-col p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
          <Icon className="size-3.5 text-teal-600" />
          {SHORT_LABEL[s.category]}
        </span>
        {s.cancel_at_period_end && (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
            <Ban className="size-3.5" /> Dönem sonunda iptal
          </span>
        )}
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold text-slate-900">{s.name}</h3>
          {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        {money && (
          <div className="shrink-0 text-right">
            <p className="text-base leading-tight font-bold text-slate-900 tabular-nums">{money.value}</p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">{money.unit}</p>
          </div>
        )}
      </div>

      {due && (
        <div
          className={`mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg px-3 py-2 ${TONE[due.tone]}`}
        >
          <span className="flex items-center gap-1.5 text-sm font-bold">
            {due.tone === "danger" || due.tone === "warning" ? (
              <TriangleAlert className="size-4 shrink-0" />
            ) : (
              <CalendarClock className="size-4 shrink-0" />
            )}
            {due.label}
          </span>
          <span className="text-xs font-medium opacity-80">
            {DUE_CAPTION[due.kind]} · {due.date}
          </span>
        </div>
      )}

      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <li
              key={chip.label}
              className="rounded-md border border-slate-200 px-2 py-0.5 text-[11.5px] text-slate-500"
            >
              {chip.label}: <span className="font-semibold text-slate-700">{chip.value}</span>
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700">
          <TriangleAlert className="size-3.5 shrink-0" /> {notice}
        </p>
      )}

      {s.notes && <p className="mt-3 line-clamp-2 text-xs text-slate-500">{s.notes}</p>}

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {s.cancel_url && (
            <a
              href={s.cancel_url}
              target="_blank"
              rel="noopener noreferrer"
              className={s.cancel_at_period_end ? smallDangerButton : smallGhostButton}
            >
              <ExternalLink className="size-3.5" /> İptal sayfası
            </a>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onEdit} className={smallGhostButton} aria-label={`${s.name} kaydını düzenle`}>
              <Pencil className="size-3.5" /> Düzenle
            </button>
            <button type="button" onClick={onDelete} className={smallDangerButton} aria-label={`${s.name} kaydını sil`}>
              <Trash className="size-3.5" /> Sil
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

// "5'i", "6'sı", "20'si": Türkçe gün eki
function dayOf(day: number): string {
  const last = day % 10;
  const suffix =
    last === 0
      ? day === 20
        ? "si"
        : "u"
      : ({ 1: "i", 2: "si", 3: "ü", 4: "ü", 5: "i", 6: "sı", 7: "si", 8: "i", 9: "u" } as Record<number, string>)[
          last
        ];
  return `${day}'${suffix}`;
}

const dayMonth = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" });

function subtitleOf(s: Subscription): string | null {
  switch (s.category) {
    case "ai_saas":
      return s.account_email;
    case "server_domain":
      return s.provider;
    case "telecom":
      return [s.plan_name, s.service_no && `Hizmet no: ${s.service_no}`].filter(Boolean).join(" · ") || null;
    default:
      return null;
  }
}

type Chip = { label: string; value: string };

function chipsOf(s: Subscription): Chip[] {
  const chips: (Chip | null)[] = [];
  const periodChip = (): Chip | null => {
    if (s.period === "monthly" && s.renewal_day) return { label: "Aylık", value: `her ayın ${dayOf(s.renewal_day)}` };
    if (s.period === "yearly" && s.renewal_date) {
      return { label: "Yıllık", value: dayMonth.format(new Date(`${s.renewal_date}T00:00:00Z`)) };
    }
    return null;
  };

  switch (s.category) {
    case "ai_saas":
    case "other":
      chips.push(periodChip());
      break;
    case "server_domain":
      chips.push(
        s.renewal_date ? { label: "Bitiş", value: formatDay(s.renewal_date) } : null,
        { label: "Otomatik yenileme", value: s.auto_renew ? "Açık" : "Kapalı" },
      );
      break;
    case "telecom":
      chips.push(
        s.renewal_day ? { label: "Fatura", value: `her ayın ${dayOf(s.renewal_day)}` } : null,
        s.has_commitment && s.contract_end
          ? { label: "Taahhüt bitişi", value: formatDay(s.contract_end) }
          : { label: "Taahhüt", value: "Yok" },
      );
      break;
    case "bank_card":
      chips.push(
        s.statement_day ? { label: "Hesap kesim", value: `her ayın ${dayOf(s.statement_day)}` } : null,
        s.due_day ? { label: "Son ödeme", value: `her ayın ${dayOf(s.due_day)}` } : null,
        s.minimum_payment !== null ? { label: "Asgari", value: formatMoney(s.minimum_payment, s.currency) } : null,
      );
      break;
  }
  return chips.filter((c): c is Chip => c !== null);
}

function amountOf(s: Subscription): { value: string; unit: string } | null {
  if (s.category === "bank_card") {
    return s.current_debt === null ? null : { value: formatMoney(s.current_debt, s.currency), unit: "güncel borç" };
  }
  if (s.amount === null) return null;
  const unit = s.period === "monthly" ? "aylık" : s.period === "yearly" ? "yıllık" : "yenileme ücreti";
  return { value: formatMoney(s.amount, s.currency), unit };
}
