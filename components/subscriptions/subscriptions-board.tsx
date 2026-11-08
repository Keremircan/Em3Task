"use client";

import { useOptimistic, useState, type ComponentType } from "react";
import {
  CreditCard,
  Ellipsis,
  ExternalLink,
  Pencil,
  Repeat,
  Server,
  Sparkles,
  Trash,
  TriangleAlert,
  WalletCards,
  Wifi,
} from "lucide-react";
import type {
  Currency,
  Subscription,
  SubscriptionCategory,
} from "@/types/database";
import { deleteSubscription } from "@/actions/subscriptions";
import {
  CATEGORIES,
  contractNotice,
  formatMoney,
  formatTotals,
  nextDue,
  type NextDue,
} from "@/lib/subscriptions";
import { formatDay } from "@/lib/format";
import { card } from "@/components/ui/styles";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { safe } from "@/lib/safe-action";
import { SubscriptionDialog } from "./subscription-dialog";
import { NewSubscriptionButton } from "./new-subscription-button";
import { mergeRecent, useSubscriptionsSync } from "./subscriptions-sync";

const ICONS: Record<
  SubscriptionCategory,
  ComponentType<{ className?: string }>
> = {
  ai_saas: Sparkles,
  server_domain: Server,
  telecom: Wifi,
  bank_card: CreditCard,
  other: Repeat,
};

const TONE: Record<NextDue["tone"], string> = {
  overdue: "bg-rose-50 text-rose-700",
  soon: "bg-amber-50 text-amber-800",
  near: "bg-teal-50 text-teal-800",
  later: "bg-slate-100 text-slate-600",
  muted: "bg-slate-100 text-slate-500",
};

type Item = { s: Subscription; due: NextDue | null };

// Sıradaki tarihi en yakın olan üstte; tarihi olmayanlar en sonda
function byDue(a: Item, b: Item) {
  return (
    (a.due?.days ?? Infinity) - (b.due?.days ?? Infinity) ||
    a.s.name.localeCompare(b.s.name, "tr")
  );
}

const NONE: ReadonlySet<string> = new Set();

export function SubscriptionsBoard({
  subscriptions: server,
  today,
}: {
  subscriptions: Subscription[];
  today: string;
}) {
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [deleting, setDeleting] = useState<Subscription | null>(null);
  const sync = useSubscriptionsSync();
  // Silinen kayıt onay beklenmeden gizlenir; hata olursa geri gelir
  const [hidden, hide] = useOptimistic(
    sync?.removed ?? NONE,
    (set, id: string) => new Set(set).add(id),
  );
  const subscriptions = mergeRecent(server, sync?.recent ?? {}).filter(
    (s) => !hidden.has(s.id),
  );

  async function remove(s: Subscription) {
    hide(s.id);
    const result = await safe(deleteSubscription(s.id));
    if (!result.error) sync?.forget(s.id);
    return result;
  }

  // Pencereler her iki durumda da çizilir: son kayıt silinirken onay penceresi kaybolmasın
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
        onConfirm={() =>
          deleting ? remove(deleting) : Promise.resolve({ error: null })
        }
      />
    </>
  );

  if (subscriptions.length === 0) {
    return (
      <>
        <div
          className={`${card} flex flex-col items-center gap-2 px-6 py-12 text-center`}
        >
          <WalletCards className="size-8 text-slate-300" />
          <p className="font-semibold text-slate-700">Henüz kayıt yok</p>
          <p className="max-w-sm text-sm text-slate-500">
            Aboneliklerinizi, sunucu ve domain yenilemelerinizi, faturalarınızı
            ve kart ödeme günlerinizi tek yerde takip edin.
          </p>
          <NewSubscriptionButton className="mt-2" />
        </div>
        {dialogs}
      </>
    );
  }

  const items: Item[] = subscriptions.map((s) => ({
    s,
    due: nextDue(s, today),
  }));
  const groups = CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((i) => i.s.category === c.value).sort(byDue),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <Summary items={items} />

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        {groups.map((group) => {
          const Icon = ICONS[group.value];
          return (
            <section key={group.value} className={`${card} overflow-hidden`}>
              <header className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2.5">
                <Icon className="size-4 shrink-0 text-teal-600" />
                <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">
                  {group.label}
                </h2>
                <span className="shrink-0 text-xs font-medium text-slate-400">
                  {group.items.length}
                </span>
              </header>
              <ul className="divide-y divide-slate-100">
                {group.items.map((item) => (
                  <Row
                    key={item.s.id}
                    item={item}
                    today={today}
                    onEdit={() => setEditing(item.s)}
                    onDelete={() => setDeleting(item.s)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {dialogs}
    </>
  );
}

function Summary({ items }: { items: Item[] }) {
  // Önümüzdeki 30 gün: iptal edilecekler ve kart borçları hariç yenilemeler
  const upcoming = items.filter(
    (i) =>
      i.s.category !== "bank_card" &&
      i.due?.kind === "renewal" &&
      i.due.days <= 30 &&
      i.s.amount !== null,
  );
  const upcomingTotals = sum(
    upcoming.map((i) => [i.s.currency, i.s.amount ?? 0]),
  );

  const cards = items.filter((i) => i.s.category === "bank_card");
  const debtTotals = sum(
    cards
      .filter((i) => i.s.current_debt !== null)
      .map((i) => [i.s.currency, i.s.current_debt ?? 0]),
  );
  const nearestCard = cards.filter((i) => i.due).sort(byDue)[0];

  const ending = items.filter((i) => i.s.cancel_at_period_end).length;

  return (
    // Telefonda ilk kutu tam genişlik, diğer ikisi yan yana
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Tile
        className="col-span-2 sm:col-span-1"
        label="30 gün içinde yenilenecek"
        value={upcomingTotals.size ? formatTotals(upcomingTotals) : "—"}
        note={
          upcoming.length ? `${upcoming.length} ödeme` : "Yaklaşan yenileme yok"
        }
      />
      <Tile
        label="Kart borçları"
        value={debtTotals.size ? formatTotals(debtTotals) : "—"}
        note={
          nearestCard?.due
            ? `Son ödeme · ${nearestCard.due.label}`
            : cards.length
              ? "Borç girilmedi"
              : "Kart eklenmedi"
        }
      />
      <Tile
        label="Kayıtlar"
        value={String(items.length)}
        note={ending ? `${ending} tanesi iptal edilecek` : "Hepsi aktif"}
      />
    </div>
  );
}

function sum(entries: [Currency, number][]): Map<Currency, number> {
  const totals = new Map<Currency, number>();
  for (const [currency, value] of entries)
    totals.set(currency, (totals.get(currency) ?? 0) + value);
  return totals;
}

function Tile({
  label,
  value,
  note,
  className = "",
}: {
  label: string;
  value: string;
  note: string;
  className?: string;
}) {
  return (
    <div className={`${card} min-w-0 px-4 py-3 ${className}`}>
      <p className="truncate text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 truncate text-lg font-bold text-slate-900 tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{note}</p>
    </div>
  );
}

function Row({
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
  const notice = contractNotice(s, today);
  const money = amountOf(s);

  return (
    <li className="flex items-start gap-1 px-3.5 py-3">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${s.name} kaydını düzenle`}
        className="-my-1 -ml-1.5 flex min-w-0 flex-1 items-start gap-3 rounded-lg px-1.5 py-1 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {s.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {details(s).join(" · ")}
          </p>
          {notice && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
              <TriangleAlert className="size-3.5 shrink-0" /> {notice}
            </p>
          )}
          {s.notes && (
            <p className="mt-1 line-clamp-1 text-xs text-slate-400">
              {s.notes}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {money && (
            <p className="text-sm font-semibold text-slate-900 tabular-nums">
              {money.value}
              {money.unit && (
                <span className="text-xs font-medium text-slate-400">
                  {money.unit}
                </span>
              )}
            </p>
          )}
          {due && (
            <span
              title={formatDay(due.day)}
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${TONE[due.tone]}`}
            >
              {due.label}
            </span>
          )}
        </div>
      </button>

      <div className="flex shrink-0 items-center">
        {s.cancel_url && (
          <a
            href={s.cancel_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${s.name} iptal sayfasını aç`}
            title="İptal sayfasını aç"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
        <Menu
          label={`${s.name} seçenekleri`}
          trigger={<Ellipsis className="size-4" />}
          triggerClassName="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          items={[
            {
              label: "Düzenle",
              icon: <Pencil className="size-4" />,
              onSelect: onEdit,
            },
            {
              label: "Sil",
              icon: <Trash className="size-4" />,
              onSelect: onDelete,
              danger: true,
            },
          ]}
        />
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
      : (
          {
            1: "i",
            2: "si",
            3: "ü",
            4: "ü",
            5: "i",
            6: "sı",
            7: "si",
            8: "i",
            9: "u",
          } as Record<number, string>
        )[last];
  return `${day}'${suffix}`;
}

const dayMonth = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function periodText(s: Subscription): string | null {
  if (s.period === "monthly" && s.renewal_day)
    return `Aylık · her ayın ${dayOf(s.renewal_day)}`;
  if (s.period === "yearly" && s.renewal_date) {
    return `Yıllık · ${dayMonth.format(new Date(`${s.renewal_date}T00:00:00Z`))}`;
  }
  return null;
}

function details(s: Subscription): string[] {
  const parts: unknown[] = [];
  switch (s.category) {
    case "ai_saas":
      parts.push(
        periodText(s),
        s.account_email,
        s.cancel_at_period_end && "Dönem sonunda iptal",
      );
      break;
    case "server_domain":
      parts.push(
        s.provider,
        s.renewal_date && formatDay(s.renewal_date),
        s.auto_renew ? "Otomatik yenilenir" : "Otomatik yenileme kapalı",
      );
      break;
    case "telecom":
      parts.push(
        s.plan_name,
        s.service_no && `No: ${s.service_no}`,
        s.renewal_day && `Fatura: her ayın ${dayOf(s.renewal_day)}`,
        s.has_commitment && s.contract_end
          ? `Taahhüt: ${formatDay(s.contract_end)}`
          : "Taahhütsüz",
      );
      break;
    case "bank_card":
      parts.push(
        s.statement_day && `Kesim: ${dayOf(s.statement_day)}`,
        s.due_day && `Son ödeme: ${dayOf(s.due_day)}`,
        s.minimum_payment !== null &&
          `Asgari ${formatMoney(s.minimum_payment, s.currency)}`,
      );
      break;
    case "other":
      parts.push(
        periodText(s),
        s.cancel_at_period_end && "Dönem sonunda iptal",
      );
      break;
  }
  return parts.filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
}

function amountOf(
  s: Subscription,
): { value: string; unit: string | null } | null {
  if (s.category === "bank_card") {
    return s.current_debt === null
      ? null
      : { value: formatMoney(s.current_debt, s.currency), unit: " borç" };
  }
  if (s.amount === null) return null;
  const unit =
    s.period === "monthly" ? "/ay" : s.period === "yearly" ? "/yıl" : null;
  return { value: formatMoney(s.amount, s.currency), unit };
}
