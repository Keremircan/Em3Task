"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { CircleAlert, Lock, Plus } from "lucide-react";
import type { Currency, Subscription, SubscriptionCategory, SubscriptionPeriod } from "@/types/database";
import { saveSubscription } from "@/actions/subscriptions";
import { CATEGORIES, CURRENCIES, LIMITS, moneyInputValue, NAME_LABEL } from "@/lib/subscriptions";
import { MAX_PROJECT_URL } from "@/lib/project-url";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select-field";
import { field, fieldLabel, ghostButton, primaryButton } from "@/components/ui/styles";
import { safe } from "@/lib/safe-action";
import { useSubscriptionsSync } from "./subscriptions-sync";

const NAME_PLACEHOLDER: Record<SubscriptionCategory, string> = {
  ai_saas: "Örn. ChatGPT Plus",
  server_domain: "Örn. ornek.com alan adı",
  telecom: "Örn. Türk Telekom",
  bank_card: "Örn. Garanti Bonus",
  other: "Örn. Spor salonu",
};

const AMOUNT_LABEL: Record<Exclude<SubscriptionCategory, "bank_card">, string> = {
  ai_saas: "Ücret",
  server_domain: "Ücret",
  telecom: "Aylık ücret",
  other: "Tutar",
};

const CURRENCY_LABEL: Record<Currency, string> = { TRY: "₺ TRY", USD: "$ USD", EUR: "€ EUR" };

// field'ın üst boşluğu olmadan hali (yan yana duran girişler için)
const input = field.replace("mt-1.5 ", "");
const DAY_HINT = "Ayın kaçı (1–31). Kısa aylarda ayın son günü sayılır.";

// Yeni kayıt ve düzenleme penceresi. Kategori değiştikçe o kategorinin alanları
// gösterilir; ortak alanlar (ad, tutar, notlar) kategori değişince korunur.
export function SubscriptionDialog({
  open,
  onClose,
  subscription,
}: {
  open: boolean;
  onClose: () => void;
  subscription?: Subscription;
}) {
  const s = subscription;
  const sync = useSubscriptionsSync();
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  const [category, setCategory] = useState<SubscriptionCategory>(s?.category ?? "ai_saas");
  const [period, setPeriod] = useState<SubscriptionPeriod>(s?.period ?? "monthly");
  const [currency, setCurrency] = useState<Currency>(s?.currency ?? "TRY");
  const [cancelAtEnd, setCancelAtEnd] = useState(s?.cancel_at_period_end ?? false);
  const [autoRenew, setAutoRenew] = useState(s?.auto_renew ?? true);
  const [hasCommitment, setHasCommitment] = useState(s?.has_commitment ?? false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const periodic = category === "ai_saas" || category === "other";
  const monthlyDay = (periodic && period === "monthly") || category === "telecom";
  const fullDate = (periodic && period === "yearly") || category === "server_domain";

  function close() {
    setError(null);
    onClose();
  }

  const currencySelect = (
    <select
      name="currency"
      value={currency}
      onChange={(e) => setCurrency(e.target.value as Currency)}
      disabled={pending}
      aria-label="Para birimi"
      className="h-10 shrink-0 rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 px-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-teal-500 focus:ring-3 focus:ring-teal-500/15"
    >
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {CURRENCY_LABEL[c]}
        </option>
      ))}
    </select>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title={s ? "Kaydı düzenle" : "Yeni abonelik / gider"}
      description="Bu bilgileri sadece siz görürsünüz."
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await safe(saveSubscription(s?.id ?? null, form));
            if (result.error) {
              setError(result.error);
              return;
            }
            if (result.subscription) sync?.remember(result.subscription);
            close();
          });
        }}
      >
        <Field id={id("category")} label="Kategori">
          <SelectField
            id={id("category")}
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as SubscriptionCategory)}
            disabled={pending}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </SelectField>
        </Field>

        <div className="mt-4 grid grid-cols-1 gap-x-3 gap-y-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <Field id={id("name")} label={NAME_LABEL[category]} className="sm:col-span-2">
            <input
              id={id("name")}
              name="name"
              required
              maxLength={LIMITS.name}
              defaultValue={s?.name}
              disabled={pending}
              placeholder={NAME_PLACEHOLDER[category]}
              className={`${field} h-10`}
            />
          </Field>

          {category === "server_domain" && (
            <Field id={id("provider")} label="Sağlayıcı" optional className="sm:col-span-2">
              <input
                id={id("provider")}
                name="provider"
                maxLength={LIMITS.provider}
                defaultValue={s?.provider ?? ""}
                disabled={pending}
                placeholder="Örn. Hetzner, Natro, GoDaddy"
                className={`${field} h-10`}
              />
            </Field>
          )}

          {category === "telecom" && (
            <Field id={id("plan_name")} label="Paket adı" optional>
              <input
                id={id("plan_name")}
                name="plan_name"
                maxLength={LIMITS.planName}
                defaultValue={s?.plan_name ?? ""}
                disabled={pending}
                placeholder="Örn. Fiber 100 Mbps"
                className={`${field} h-10`}
              />
            </Field>
          )}
          {category === "telecom" && (
            <Field id={id("service_no")} label="Hizmet no" optional>
              <input
                id={id("service_no")}
                name="service_no"
                maxLength={LIMITS.serviceNo}
                defaultValue={s?.service_no ?? ""}
                disabled={pending}
                placeholder="Abone / hizmet numarası"
                className={`${field} h-10`}
              />
            </Field>
          )}

          {category === "ai_saas" && (
            <Field id={id("account_email")} label="Kayıt olunan e-posta" optional className="sm:col-span-2">
              <input
                id={id("account_email")}
                name="account_email"
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={LIMITS.email}
                defaultValue={s?.account_email ?? ""}
                disabled={pending}
                placeholder="ornek@mail.com"
                className={`${field} h-10`}
              />
            </Field>
          )}

          {periodic && (
            <Field id={id("period")} label="Periyot">
              <SelectField
                id={id("period")}
                name="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value as SubscriptionPeriod)}
                disabled={pending}
              >
                <option value="monthly">Aylık</option>
                <option value="yearly">Yıllık</option>
              </SelectField>
            </Field>
          )}

          {monthlyDay && (
            <Field
              id={id("renewal_day")}
              label={category === "telecom" ? "Fatura kesim / yenilenme günü" : "Yenilenme günü"}
              hint={DAY_HINT}
            >
              <DayInput id={id("renewal_day")} name="renewal_day" defaultValue={s?.renewal_day} disabled={pending} />
            </Field>
          )}

          {fullDate && (
            <Field
              id={id("renewal_date")}
              label="Yenilenme tarihi"
              hint={category === "server_domain" ? "Hizmetin bitiş / yenilenme tarihi." : "Bir sonraki yıllık yenileme."}
            >
              <input
                id={id("renewal_date")}
                name="renewal_date"
                type="date"
                required
                defaultValue={s?.renewal_date ?? ""}
                disabled={pending}
                className={`${field} h-10`}
              />
            </Field>
          )}

          {category === "bank_card" && (
            <Field id={id("statement_day")} label="Hesap kesim günü" hint="Ayın kaçı (1–31).">
              <DayInput id={id("statement_day")} name="statement_day" defaultValue={s?.statement_day} disabled={pending} />
            </Field>
          )}
          {category === "bank_card" && (
            <Field id={id("due_day")} label="Son ödeme günü" hint="Ayın kaçı (1–31).">
              <DayInput id={id("due_day")} name="due_day" defaultValue={s?.due_day} disabled={pending} />
            </Field>
          )}

          {category !== "bank_card" && (
            <Field id={id("amount")} label={AMOUNT_LABEL[category]}>
              <div className="mt-1.5 flex">
                <MoneyInput id={id("amount")} name="amount" defaultValue={s?.amount} disabled={pending} required />
                {currencySelect}
              </div>
            </Field>
          )}

          {category === "bank_card" && (
            <Field id={id("current_debt")} label="Toplam güncel borç" optional>
              <div className="mt-1.5 flex">
                <MoneyInput id={id("current_debt")} name="current_debt" defaultValue={s?.current_debt} disabled={pending} />
                {currencySelect}
              </div>
            </Field>
          )}
          {category === "bank_card" && (
            <Field id={id("minimum_payment")} label="Asgari ödeme" optional>
              <div className="relative mt-1.5">
                <MoneyInput
                  id={id("minimum_payment")}
                  name="minimum_payment"
                  defaultValue={s?.minimum_payment}
                  disabled={pending}
                  rounded
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm font-semibold text-slate-400">
                  {currency}
                </span>
              </div>
            </Field>
          )}

          {category === "ai_saas" && (
            <Field id={id("cancel_url")} label="İptal linki" optional className="sm:col-span-2">
              <input
                id={id("cancel_url")}
                name="cancel_url"
                type="text"
                inputMode="url"
                autoComplete="off"
                maxLength={MAX_PROJECT_URL}
                defaultValue={s?.cancel_url ?? ""}
                disabled={pending}
                placeholder="https://ornek.com/hesap/abonelik"
                className={`${field} h-10`}
              />
            </Field>
          )}

          {category === "server_domain" && (
            <Switch
              name="auto_renew"
              label="Otomatik yenileme"
              hint={autoRenew ? "Açık: süre bitince kendiliğinden yenilenir." : "Kapalı: süre bitmeden elle yenilemeniz gerekir."}
              checked={autoRenew}
              onChange={setAutoRenew}
              disabled={pending}
            />
          )}

          {periodic && (
            <Switch
              name="cancel_at_period_end"
              label={category === "ai_saas" ? "Dönem sonunda iptal et" : "İptal durumu: dönem sonunda iptal edilecek"}
              hint={
                cancelAtEnd
                  ? "Yenilenmeyecek; listede bitiş tarihiyle gösterilir."
                  : "Kapalı: abonelik yenilenmeye devam ediyor."
              }
              checked={cancelAtEnd}
              onChange={setCancelAtEnd}
              disabled={pending}
            />
          )}

          {category === "telecom" && (
            <Switch
              name="has_commitment"
              label="Taahhüt var mı?"
              hint={hasCommitment ? "Kontrat tarihlerini girin." : "Taahhütsüz hat / bağlantı."}
              checked={hasCommitment}
              onChange={setHasCommitment}
              disabled={pending}
            />
          )}
          {category === "telecom" && hasCommitment && (
            <Field id={id("contract_start")} label="Kontrat başlangıcı">
              <input
                id={id("contract_start")}
                name="contract_start"
                type="date"
                required
                defaultValue={s?.contract_start ?? ""}
                disabled={pending}
                className={`${field} h-10`}
              />
            </Field>
          )}
          {category === "telecom" && hasCommitment && (
            <Field id={id("contract_end")} label="Kontrat bitişi">
              <input
                id={id("contract_end")}
                name="contract_end"
                type="date"
                required
                defaultValue={s?.contract_end ?? ""}
                disabled={pending}
                className={`${field} h-10`}
              />
            </Field>
          )}

          <Field id={id("notes")} label="Notlar" optional className="sm:col-span-2">
            <textarea
              id={id("notes")}
              name="notes"
              rows={3}
              maxLength={LIMITS.notes}
              defaultValue={s?.notes ?? ""}
              disabled={pending}
              placeholder={
                category === "bank_card"
                  ? "Kart numarası, şifre veya CVV yazmayın."
                  : "Örn. aile paketi, faturanın geldiği adres…"
              }
              className={`${field} resize-y py-2`}
            />
          </Field>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="size-3.5" /> Ekipteki kimse göremez.
          </p>
          <div className="flex gap-2.5">
            <button type="button" onClick={close} className={ghostButton}>
              Vazgeç
            </button>
            <button type="submit" disabled={pending} className={primaryButton}>
              {!s && <Plus className="size-4" strokeWidth={2.4} />}
              {pending ? "Kaydediliyor…" : s ? "Kaydet" : "Ekle"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  id,
  label,
  optional = false,
  hint,
  className = "",
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={fieldLabel}>
        {label}
        {optional && <span className="font-normal text-slate-400"> (isteğe bağlı)</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function DayInput({
  id,
  name,
  defaultValue,
  disabled,
}: {
  id: string;
  name: string;
  defaultValue?: number | null;
  disabled: boolean;
}) {
  return (
    <input
      id={id}
      name={name}
      type="number"
      inputMode="numeric"
      min={1}
      max={31}
      step={1}
      required
      defaultValue={defaultValue ?? ""}
      disabled={disabled}
      placeholder="Örn. 15"
      className={`${field} h-10 tabular-nums`}
    />
  );
}

function MoneyInput({
  id,
  name,
  defaultValue,
  disabled,
  required = false,
  rounded = false,
}: {
  id: string;
  name: string;
  defaultValue?: number | null;
  disabled: boolean;
  required?: boolean;
  rounded?: boolean; // yanında para birimi seçicisi yoksa
}) {
  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      required={required}
      maxLength={20}
      defaultValue={moneyInputValue(defaultValue)}
      disabled={disabled}
      placeholder="0,00"
      className={`${input} h-10 min-w-0 flex-1 tabular-nums ${rounded ? "pr-14" : "rounded-r-none"}`}
    />
  );
}

// Açık / kapalı anahtarı; değeri gizli alanla forma "1" / "0" olarak gider
function Switch({
  name,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  name: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const labelId = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2.5 sm:col-span-2">
      <div className="min-w-0">
        <p id={labelId} className="text-[13px] font-semibold text-slate-700">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
      <input type="hidden" name={name} value={checked ? "1" : "0"} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
          checked ? "bg-teal-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
