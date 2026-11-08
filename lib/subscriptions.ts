// Abonelikler ve düzenli giderler: sunucu ve tarayıcı tarafında ortak kurallar.
// Veritabanı kuralları: supabase/abonelikler.sql (buradaki sınırlar onunla aynı).
import type { Currency, Subscription, SubscriptionCategory, SubscriptionPeriod } from "@/types/database";
import { addDays, daysBetween, isDayString, shortDay } from "@/lib/due";
import { parseProjectUrl } from "@/lib/project-url";

// label: formdaki tam ad · short: filtre haplarında ve kart rozetinde
export const CATEGORIES: { value: SubscriptionCategory; label: string; short: string }[] = [
  { value: "ai_saas", label: "AI / SaaS Abonelikleri", short: "AI & Yazılım" },
  { value: "server_domain", label: "Sunucu & Domain", short: "Sunucu & Domain" },
  { value: "telecom", label: "Ev/Cep İnterneti & GSM", short: "İnternet & GSM" },
  { value: "bank_card", label: "Banka & Kredi Kartı", short: "Banka & Kart" },
  { value: "other", label: "Diğer", short: "Diğer" },
];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<
  SubscriptionCategory,
  string
>;

export const CURRENCIES: Currency[] = ["TRY", "USD", "EUR"];

export const LIMITS = {
  name: 120,
  provider: 120,
  planName: 120,
  serviceNo: 60,
  email: 254,
  notes: 2000,
  money: 9_999_999_999.99, // numeric(12,2) üst sınırı
};

// Formdan okunup veritabanına yazılan alanlar (id, user_id ve zaman damgaları hariç)
export type SubscriptionInput = Omit<Subscription, "id" | "user_id" | "created_at" | "updated_at">;

export function isCategory(value: unknown): value is SubscriptionCategory {
  return CATEGORIES.some((c) => c.value === value);
}

// ---------------------------------------------------------------------
// Para
// ---------------------------------------------------------------------

// "1.250,50", "1250.5", "1 250" gibi girişleri sayıya çevirir. Boş → null.
export function parseMoney(raw: unknown): number | null | "invalid" {
  let text = String(raw ?? "").replace(/[\s₺$€]/g, "");
  if (!text) return null;
  if (text.includes(",") && text.includes(".")) {
    // Son ayırıcı ondalık kabul edilir: 1.250,50 ya da 1,250.50
    text = text.lastIndexOf(",") > text.lastIndexOf(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, ""); // 1.250 → bin iki yüz elli
  }
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return "invalid";
  const value = Number(text);
  if (!Number.isFinite(value) || value > LIMITS.money) return "invalid";
  return value;
}

const moneyFormats = new Map<Currency, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: Currency): string {
  let format = moneyFormats.get(currency);
  if (!format) {
    format = new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 2 });
    moneyFormats.set(currency, format);
  }
  return format.format(amount);
}

// Formdaki tutar alanının başlangıç değeri: 1250.5 → "1250,50"
export function moneyInputValue(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(".", ",");
}

// Para birimine göre toplamlar: "₺1.250 + $40"
export function formatTotals(totals: Map<Currency, number>): string {
  return CURRENCIES.filter((c) => totals.has(c))
    .map((c) => formatMoney(totals.get(c)!, c))
    .join(" + ");
}

export function sumByCurrency(entries: [Currency, number][]): Map<Currency, number> {
  const totals = new Map<Currency, number>();
  for (const [currency, value] of entries) totals.set(currency, (totals.get(currency) ?? 0) + value);
  return totals;
}

// ---------------------------------------------------------------------
// Tarihler (Türkiye saatine göre "bugün" ile, "YYYY-MM-DD")
// ---------------------------------------------------------------------

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month: 1-12
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Ayın belirli günü için bugünden itibaren ilk tarih. 31 → kısa aylarda ayın son günü.
export function nextMonthlyDate(day: number, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const thisMonth = Math.min(day, lastDayOfMonth(y, m));
  if (thisMonth >= d) return `${y}-${pad(m)}-${pad(thisMonth)}`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(day, lastDayOfMonth(ny, nm)))}`;
}

// Yıllık yenilemede bugünden itibaren ilk yıl dönümü (tarih ileride ise kendisi)
export function nextYearlyDate(date: string, today: string): string {
  if (date >= today) return date;
  const [, m, d] = date.split("-").map(Number);
  const y = Number(today.slice(0, 4));
  for (const year of [y, y + 1]) {
    const candidate = `${year}-${pad(m)}-${pad(Math.min(d, lastDayOfMonth(year, m)))}`;
    if (candidate >= today) return candidate;
  }
  return addDays(today, 365); // buraya düşmez
}

// renewal: yenilenme · payment: kart son ödemesi · ends: iptal edilecek, o gün biter
// expired: sunucu/domain tarihi geçti
export type DueKind = "renewal" | "ends" | "payment" | "expired";
// danger: bugün ya da geçti (kırmızı) · warning: 3 günden az (sarı) · near: bu hafta
export type DueTone = "danger" | "warning" | "near" | "later" | "muted";
export type NextDue = { day: string; days: number; kind: DueKind; label: string; tone: DueTone; date: string };

// "12 Kas"; başka bir yıldaysa "12 Kas 2027"
export function dateLabel(day: string, today: string): string {
  return day.slice(0, 4) === today.slice(0, 4) ? shortDay(day) : `${shortDay(day)} ${day.slice(0, 4)}`;
}

// Kalan gün sayacı: "Bugün yenileniyor!", "Yarın", "3 gün kaldı", "14 gün sonra"
function dueLabel(kind: DueKind, days: number): string {
  if (kind === "expired") return `${-days} gün geçti`;
  if (kind === "ends") return days === 0 ? "Bugün bitiyor" : days === 1 ? "Yarın bitiyor" : `${days} gün sonra bitiyor`;
  if (days === 0) return kind === "payment" ? "Son ödeme bugün!" : "Bugün yenileniyor!";
  if (days === 1) return "Yarın";
  if (days <= 7) return `${days} gün kaldı`;
  return `${days} gün sonra`;
}

// İptal edilecekler de bugün/yarın bitiyorsa uyarı renginde: son iptal fırsatı
function dueTone(kind: DueKind, days: number): DueTone {
  if (days <= 0) return "danger";
  if (days < 3) return "warning";
  if (kind === "ends") return "muted";
  if (days <= 7) return "near";
  return "later";
}

// Kaydın sıradaki önemli tarihi: yenilenme, son ödeme ya da (iptal edilecekse) bitiş
export function nextDue(s: Subscription, today: string): NextDue | null {
  let day: string | null = null;
  let kind: DueKind = "renewal";

  switch (s.category) {
    case "ai_saas":
    case "other":
      if (s.period === "monthly" && s.renewal_day) day = nextMonthlyDate(s.renewal_day, today);
      if (s.period === "yearly" && s.renewal_date) day = nextYearlyDate(s.renewal_date, today);
      if (s.cancel_at_period_end) kind = "ends";
      break;
    case "server_domain":
      // Sunucu ve domain sürelerinin uzunluğu değişebilir: tarih olduğu gibi gösterilir
      day = s.renewal_date;
      if (day && day < today) kind = "expired";
      break;
    case "telecom":
      if (s.renewal_day) day = nextMonthlyDate(s.renewal_day, today);
      break;
    case "bank_card":
      if (s.due_day) day = nextMonthlyDate(s.due_day, today);
      kind = "payment";
      break;
  }
  if (!day) return null;

  const days = daysBetween(today, day);
  return { day, days, kind, label: dueLabel(kind, days), tone: dueTone(kind, days), date: dateLabel(day, today) };
}

// Önümüzdeki n gün içinde ödemesi olan kayıt mı (iptal edilecekler ödeme yapmaz)
export function isPaymentWithin(due: NextDue | null, n: number): boolean {
  return !!due && (due.kind === "renewal" || due.kind === "payment") && due.days >= 0 && due.days <= n;
}

// Taahhüt bitişi yaklaşıyorsa (60 gün) ya da geçtiyse uyarı metni
export function contractNotice(s: Subscription, today: string): string | null {
  if (s.category !== "telecom" || !s.has_commitment || !s.contract_end) return null;
  const days = daysBetween(today, s.contract_end);
  if (days < 0) return "Taahhüt bitti";
  if (days <= 60) return `Taahhüt ${days === 0 ? "bugün" : `${days} gün sonra`} bitiyor`;
  return null;
}

// ---------------------------------------------------------------------
// Bir gün kala hatırlatmalar (her sabah çalışan zamanlanmış görev gönderir)
// ---------------------------------------------------------------------

// due: yenilenme / son ödeme / iptal edilenin bitişi · contract: taahhüt bitişi
export type ReminderKind = "due" | "contract";
export type SubscriptionReminder = {
  subscription: Subscription;
  kind: ReminderKind;
  on: string; // hatırlatılan gün ("YYYY-MM-DD"); aynı gün için bir kez gönderilir
  title: string;
  body: string;
};

function clipName(name: string): string {
  return name.length > 80 ? `${name.slice(0, 79)}…` : name;
}

// Yarın (bugünden 1 gün sonra) olan yenilemeler, son ödemeler, bitişler ve taahhüt sonları
export function remindersFor(subscriptions: Subscription[], today: string): SubscriptionReminder[] {
  const out: SubscriptionReminder[] = [];
  for (const s of subscriptions) {
    const name = clipName(s.name);
    const price = s.amount !== null ? formatMoney(s.amount, s.currency) : null;
    const due = nextDue(s, today);

    if (due && due.days === 1 && due.kind !== "expired") {
      let title: string;
      let body: string;
      if (due.kind === "ends") {
        title = `Yarın bitiyor: ${name}`;
        body = "Dönem sonunda iptal olarak işaretli. Henüz iptal etmediyseniz bugün iptal edin, yoksa yenilenir.";
      } else if (due.kind === "payment") {
        title = `Yarın son ödeme: ${name}`;
        const parts = [`Son ödeme: ${due.date}`];
        if (s.current_debt !== null) parts.push(`Borç: ${formatMoney(s.current_debt, s.currency)}`);
        if (s.minimum_payment !== null) parts.push(`Asgari: ${formatMoney(s.minimum_payment, s.currency)}`);
        body = parts.join(" · ");
      } else if (s.category === "telecom") {
        title = `Yarın fatura günü: ${name}`;
        body = [`Fatura kesimi: ${due.date}`, price && `Aylık ücret: ${price}`].filter(Boolean).join(" · ");
      } else if (s.category === "server_domain" && s.auto_renew === false) {
        title = `Yarın sona eriyor: ${name}`;
        body = ["Otomatik yenileme kapalı; süre bitmeden yenileyin.", price && `Ücret: ${price}`]
          .filter(Boolean)
          .join(" ");
      } else {
        title = `Yarın yenileniyor: ${name}`;
        body = [`Yenilenme: ${due.date}`, price && `Tutar: ${price}`].filter(Boolean).join(" · ");
      }
      out.push({ subscription: s, kind: "due", on: due.day, title, body });
    }

    if (s.category === "telecom" && s.has_commitment && s.contract_end && daysBetween(today, s.contract_end) === 1) {
      out.push({
        subscription: s,
        kind: "contract",
        on: s.contract_end,
        title: `Taahhüt yarın bitiyor: ${name}`,
        body: `Kontrat bitişi: ${dateLabel(s.contract_end, today)}. Tarifenizi gözden geçirmek için iyi bir zaman.`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Form doğrulama (sunucu işlemi kullanır; kurallar SQL ile aynı)
// ---------------------------------------------------------------------

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim().replace(/[ \t]+/g, " ");
}

function optionalText(formData: FormData, key: string, max: number, label: string): string | null | { error: string } {
  const value = text(formData, key);
  if (!value) return null;
  if (value.length > max) return { error: `${label} en fazla ${max} karakter olabilir.` };
  return value;
}

function dayOfMonth(formData: FormData, key: string, label: string): number | { error: string } {
  const raw = text(formData, key);
  if (!raw) return { error: `${label} zorunludur.` };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 31) return { error: `${label} 1 ile 31 arasında olmalı.` };
  return n;
}

function date(formData: FormData, key: string, label: string): string | { error: string } {
  const raw = text(formData, key);
  if (!raw) return { error: `${label} zorunludur.` };
  if (!isDayString(raw)) return { error: `${label} geçerli bir tarih olmalı.` };
  return raw;
}

function money(formData: FormData, key: string, label: string, required: boolean): number | null | { error: string } {
  const value = parseMoney(formData.get(key));
  if (value === "invalid") return { error: `${label} geçerli bir tutar olmalı (ör. 249,90).` };
  if (value === null && required) return { error: `${label} zorunludur.` };
  return value;
}

function yesNo(formData: FormData, key: string): boolean {
  return formData.get(key) === "1";
}

const isError = (v: unknown): v is { error: string } =>
  typeof v === "object" && v !== null && "error" in v;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NAME_LABEL: Record<SubscriptionCategory, string> = {
  ai_saas: "Servis adı",
  server_domain: "Hizmet adı",
  telecom: "Operatör",
  bank_card: "Banka / kart adı",
  other: "Abonelik adı",
};

// Formu kategorisine göre okur. Kategoriye ait olmayan alanlar her zaman boş (null)
// yazılır; kategori değiştirilen kayıtta eski kategorinin bilgisi kalmaz.
export function parseSubscriptionForm(formData: FormData): { input: SubscriptionInput } | { error: string } {
  const category = formData.get("category");
  if (!isCategory(category)) return { error: "Kategori seçin." };

  const name = text(formData, "name");
  if (!name) return { error: `${NAME_LABEL[category]} zorunludur.` };
  if (name.length > LIMITS.name) return { error: `${NAME_LABEL[category]} en fazla ${LIMITS.name} karakter olabilir.` };

  const currency = formData.get("currency");
  if (!CURRENCIES.includes(currency as Currency)) return { error: "Para birimi seçin." };

  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > LIMITS.notes) return { error: `Notlar en fazla ${LIMITS.notes} karakter olabilir.` };

  const input: SubscriptionInput = {
    category,
    name,
    provider: null,
    plan_name: null,
    service_no: null,
    account_email: null,
    period: null,
    renewal_day: null,
    renewal_date: null,
    auto_renew: null,
    cancel_at_period_end: false,
    cancel_url: null,
    has_commitment: null,
    contract_start: null,
    contract_end: null,
    statement_day: null,
    due_day: null,
    current_debt: null,
    minimum_payment: null,
    amount: null,
    currency: currency as Currency,
    notes: notes || null,
  };

  // Aylık → ayın günü, yıllık → tam tarih (AI / SaaS ve Diğer)
  const readPeriod = (): { error: string } | null => {
    const period = formData.get("period");
    if (period !== "monthly" && period !== "yearly") return { error: "Periyot seçin (aylık ya da yıllık)." };
    input.period = period as SubscriptionPeriod;
    if (period === "monthly") {
      const day = dayOfMonth(formData, "renewal_day", "Yenilenme günü");
      if (isError(day)) return day;
      input.renewal_day = day;
    } else {
      const day = date(formData, "renewal_date", "Yenilenme tarihi");
      if (isError(day)) return day;
      input.renewal_date = day;
    }
    return null;
  };

  const readAmount = (label: string): { error: string } | null => {
    const amount = money(formData, "amount", label, true);
    if (isError(amount)) return amount;
    input.amount = amount;
    return null;
  };

  switch (category) {
    case "ai_saas": {
      const period = readPeriod();
      if (period) return period;
      const email = optionalText(formData, "account_email", LIMITS.email, "E-posta");
      if (isError(email)) return email;
      if (email && !EMAIL_RE.test(email)) return { error: "Geçerli bir e-posta adresi girin." };
      input.account_email = email;
      input.cancel_at_period_end = yesNo(formData, "cancel_at_period_end");
      const url = parseProjectUrl(formData.get("cancel_url"));
      if ("error" in url) return { error: `İptal linki: ${url.error}` };
      input.cancel_url = url.url;
      const amount = readAmount("Ücret");
      if (amount) return amount;
      break;
    }
    case "server_domain": {
      const provider = optionalText(formData, "provider", LIMITS.provider, "Sağlayıcı");
      if (isError(provider)) return provider;
      input.provider = provider;
      const day = date(formData, "renewal_date", "Yenilenme tarihi");
      if (isError(day)) return day;
      input.renewal_date = day;
      input.auto_renew = yesNo(formData, "auto_renew");
      const amount = readAmount("Ücret");
      if (amount) return amount;
      break;
    }
    case "telecom": {
      const plan = optionalText(formData, "plan_name", LIMITS.planName, "Paket adı");
      if (isError(plan)) return plan;
      input.plan_name = plan;
      const serviceNo = optionalText(formData, "service_no", LIMITS.serviceNo, "Hizmet no");
      if (isError(serviceNo)) return serviceNo;
      input.service_no = serviceNo;
      const day = dayOfMonth(formData, "renewal_day", "Fatura kesim günü");
      if (isError(day)) return day;
      input.renewal_day = day;
      input.period = "monthly";
      input.has_commitment = yesNo(formData, "has_commitment");
      if (input.has_commitment) {
        const start = date(formData, "contract_start", "Kontrat başlangıcı");
        if (isError(start)) return start;
        const end = date(formData, "contract_end", "Kontrat bitişi");
        if (isError(end)) return end;
        if (end < start) return { error: "Kontrat bitişi başlangıçtan önce olamaz." };
        input.contract_start = start;
        input.contract_end = end;
      }
      const amount = readAmount("Aylık ücret");
      if (amount) return amount;
      break;
    }
    case "bank_card": {
      const statement = dayOfMonth(formData, "statement_day", "Hesap kesim günü");
      if (isError(statement)) return statement;
      input.statement_day = statement;
      const due = dayOfMonth(formData, "due_day", "Son ödeme günü");
      if (isError(due)) return due;
      input.due_day = due;
      const debt = money(formData, "current_debt", "Toplam güncel borç", false);
      if (isError(debt)) return debt;
      input.current_debt = debt;
      const minimum = money(formData, "minimum_payment", "Asgari ödeme", false);
      if (isError(minimum)) return minimum;
      input.minimum_payment = minimum;
      break;
    }
    case "other": {
      const period = readPeriod();
      if (period) return period;
      input.cancel_at_period_end = yesNo(formData, "cancel_at_period_end");
      const amount = readAmount("Tutar");
      if (amount) return amount;
      break;
    }
  }

  return { input };
}
