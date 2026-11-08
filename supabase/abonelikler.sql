-- =====================================================================
-- Em3Task — Abonelikler ve Düzenli Giderler (sadece sahibi görür)
--   Kişisel yapılacaklar gibi her kayıt tek bir kullanıcıya aittir.
--   RLS: tüm işlemler yalnızca user_id = auth.uid() için geçerli.
--   Uygulamadaki Admin rolü dahil kimse başkasının aboneliklerini,
--   kart borçlarını veya servis bilgilerini göremez, değiştiremez.
--
--   Kategoriler ve kullandıkları sütunlar:
--     ai_saas        AI / SaaS          name, account_email, period, renewal_day | renewal_date,
--                                       cancel_at_period_end, cancel_url, amount, currency
--     server_domain  Sunucu & Domain    name, provider, renewal_date, auto_renew, amount, currency
--     telecom        İnternet & GSM     name (operatör), plan_name, service_no, renewal_day
--                                       (fatura kesim günü), has_commitment, contract_start,
--                                       contract_end, amount (aylık), currency
--     bank_card      Banka & Kart       name, statement_day, due_day, current_debt,
--                                       minimum_payment, currency
--     other          Diğer              name, period, renewal_day | renewal_date,
--                                       cancel_at_period_end, amount, currency
--   Kategoriye ait olmayan sütunlar boş (null) kalır; kontrolleri aşağıda.
--   Ortak: notes. Kart numarası, şifre vb. hiçbir alanda tutulmaz.
--
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

create table if not exists public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid()
                       references auth.users (id) on delete cascade,
  category             text not null,
  name                 text not null,          -- servis / hizmet / operatör / banka-kart / abonelik adı
  provider             text,                   -- sağlayıcı (sunucu & domain)
  plan_name            text,                   -- paket adı (internet & GSM)
  service_no           text,                   -- hizmet / abone no (internet & GSM)
  account_email        text,                   -- kayıt olunan e-posta (AI / SaaS)
  period               text,                   -- monthly: aylık · yearly: yıllık
  renewal_day          smallint,               -- aylıkta ayın kaçı; GSM'de fatura kesim günü
  renewal_date         date,                   -- yıllıkta / sunucu & domain'de tam tarih
  auto_renew           boolean,                -- otomatik yenileme (sunucu & domain)
  cancel_at_period_end boolean not null default false, -- dönem sonunda iptal edilecek
  cancel_url           text,                   -- iptal sayfası linki (AI / SaaS)
  has_commitment       boolean,                -- taahhüt var mı (internet & GSM)
  contract_start       date,
  contract_end         date,
  statement_day        smallint,               -- hesap kesim günü (banka & kart)
  due_day              smallint,               -- son ödeme günü (banka & kart)
  current_debt         numeric(14, 2),         -- toplam güncel borç (banka & kart)
  minimum_payment      numeric(14, 2),         -- asgari ödeme (banka & kart)
  amount               numeric(12, 2),         -- ücret / aylık ücret / tutar
  currency             text not null default 'TRY',
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint subscriptions_category_check
    check (category in ('ai_saas', 'server_domain', 'telecom', 'bank_card', 'other')),
  constraint subscriptions_name_check
    check (char_length(btrim(name)) between 1 and 120),
  constraint subscriptions_text_lengths_check check (
    (provider is null or char_length(provider) <= 120)
    and (plan_name is null or char_length(plan_name) <= 120)
    and (service_no is null or char_length(service_no) <= 60)
    and (account_email is null or char_length(account_email) <= 254)
    and (cancel_url is null or (char_length(cancel_url) <= 2048 and cancel_url ~* '^https?://'))
    and (notes is null or char_length(notes) <= 2000)
  ),
  constraint subscriptions_period_check
    check (period is null or period in ('monthly', 'yearly')),
  constraint subscriptions_days_check check (
    (renewal_day is null or renewal_day between 1 and 31)
    and (statement_day is null or statement_day between 1 and 31)
    and (due_day is null or due_day between 1 and 31)
  ),
  constraint subscriptions_money_check check (
    (amount is null or amount >= 0)
    and (current_debt is null or current_debt >= 0)
    and (minimum_payment is null or minimum_payment >= 0)
  ),
  constraint subscriptions_currency_check
    check (currency in ('TRY', 'USD', 'EUR')),
  constraint subscriptions_contract_check
    check (contract_end is null or contract_start is null or contract_end >= contract_start),

  -- Kategoriye göre zorunlu alanlar (sunucu işlemi de aynısını denetler)
  constraint subscriptions_required_check check (
    case category
      when 'ai_saas' then
        amount is not null
        and ((period = 'monthly' and renewal_day is not null)
          or (period = 'yearly' and renewal_date is not null))
      when 'other' then
        amount is not null
        and ((period = 'monthly' and renewal_day is not null)
          or (period = 'yearly' and renewal_date is not null))
      when 'server_domain' then
        amount is not null and renewal_date is not null and auto_renew is not null
      when 'telecom' then
        amount is not null and renewal_day is not null and has_commitment is not null
        and (has_commitment = false or (contract_start is not null and contract_end is not null))
      when 'bank_card' then
        statement_day is not null and due_day is not null
      else false
    end
  )
);

create index if not exists subscriptions_user_category_idx
  on public.subscriptions (user_id, category);

-- updated_at her güncellemede otomatik yenilenir (schema.sql'deki ortak fonksiyon)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Oturumsuz (anon) erişim yok; oturumlu kullanıcı sadece kendi satırları
revoke all on public.subscriptions from anon;
grant select, insert, update, delete on public.subscriptions to authenticated;

drop policy if exists "Subscriptions select" on public.subscriptions;
drop policy if exists "Subscriptions insert" on public.subscriptions;
drop policy if exists "Subscriptions update" on public.subscriptions;
drop policy if exists "Subscriptions delete" on public.subscriptions;

create policy "Subscriptions select" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Subscriptions insert" on public.subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
-- with check: kayıt başka bir kullanıcıya devredilemez
create policy "Subscriptions update" on public.subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Subscriptions delete" on public.subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Not: Bu tablo bilerek Realtime yayınına eklenmez; değişiklikler kimseye yayınlanmaz.

-- Kontrol: RLS açık mı, kaç politika var? (rls_acik = true, politika = 4 olmalı)
select relrowsecurity as rls_acik,
       (select count(*) from pg_policies where tablename = 'subscriptions') as politika
from pg_class where oid = 'public.subscriptions'::regclass;
