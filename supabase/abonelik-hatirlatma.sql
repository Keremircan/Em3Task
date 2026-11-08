-- =====================================================================
-- Em3Task — Abonelikler için bir gün kala hatırlatma
--   Her sabah 09:00'da çalışan hatırlatma görevi (hatirlatma.sql, aynı
--   pg_cron işi) artık aboneliklere de bakar: yenilenme, kart son ödemesi,
--   iptal edilenin bitişi ya da taahhüt sonu YARIN ise kaydın sahibine
--   bildirim gönderir (bildirim merkezi + izin verdiyse telefon).
--
--   subscription_reminders: hangi kayda hangi gün için hatırlatma gittiğini
--   tutar (aynı hatırlatma iki kez gitmesin). Sadece sunucu (service role)
--   okur/yazar; kullanıcılar bu tabloya hiç erişemez.
--
-- abonelikler.sql'den SONRA, Supabase SQL Editor'de çalıştırın.
-- Zamanlanmış işte değişiklik gerekmez. Tekrar çalıştırılabilir.
-- =====================================================================

create table if not exists public.subscription_reminders (
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  kind            text not null check (kind in ('due', 'contract')),
  due_on          date not null,
  sent_at         timestamptz not null default now(),
  primary key (subscription_id, kind, due_on)
);

alter table public.subscription_reminders enable row level security;
revoke all on public.subscription_reminders from anon, authenticated;
-- Politika yok: sadece service role (sunucu) erişir.

-- Kontrol: rls_acik = true olmalı
select relrowsecurity as rls_acik
from pg_class where oid = 'public.subscription_reminders'::regclass;
