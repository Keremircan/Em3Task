-- =====================================================================
-- Em3Task — Hata kayıtları
--   Sunucuda ve tarayıcıda oluşan beklenmedik hatalar burada tutulur;
--   Admin "Hata kayıtları" sayfasından görür ve temizler.
--   Yazan: sadece sunucu (service role). Okuyan/silen: sadece Admin.
--   30 günden eski kayıtlar ve en yeni 1000 kaydın dışındakiler her yeni
--   kayıtta kendiliğinden silinir (tablo büyümez).
--
-- revize.sql'den (is_admin) SONRA, Supabase SQL Editor'de çalıştırın.
-- Tekrar çalıştırılabilir.
-- =====================================================================

create table if not exists public.error_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  source      text not null check (source in ('server', 'client')),
  message     text not null,
  digest      text,
  path        text,   -- adres (sorgu kısmı olmadan)
  method      text,
  route       text,   -- hatanın çıktığı sayfa dosyası
  kind        text,   -- render | route | action | proxy
  stack       text,
  user_id     uuid references public.profiles (id) on delete set null,
  user_agent  text
);

create index if not exists error_log_created_idx on public.error_log (created_at desc);
create index if not exists error_log_user_id_idx on public.error_log (user_id);

alter table public.error_log enable row level security;
revoke all on public.error_log from anon, authenticated;
grant select, delete on public.error_log to authenticated;

drop policy if exists "Error log read admin"   on public.error_log;
drop policy if exists "Error log delete admin" on public.error_log;

create policy "Error log read admin" on public.error_log
  for select to authenticated using ((select public.is_admin()));
create policy "Error log delete admin" on public.error_log
  for delete to authenticated using ((select public.is_admin()));
-- Ekleme politikası yok: kayıtları sadece sunucu (service role) yazar.

-- Eski kayıtları temizle
create or replace function public.trim_error_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.error_log where created_at < now() - interval '30 days';
  delete from public.error_log
  where id not in (
    select id from public.error_log
    order by created_at desc, id desc
    limit 1000
  );
  return null;
end;
$$;

revoke execute on function public.trim_error_log() from public, anon, authenticated;

-- Satır başına değil, ekleme işlemi başına bir kez çalışır
drop trigger if exists error_log_trim on public.error_log;
create trigger error_log_trim
  after insert on public.error_log
  for each statement execute function public.trim_error_log();

-- Kontrol
select count(*) as kayit_sayisi from public.error_log;
