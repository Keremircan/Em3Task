-- =====================================================================
-- Em3Task — Etkinlik akışında sadece son 10 kayıt tutulur
--   Her yeni etkinlik eklendiğinde en yeni 10 kayıt dışındakiler silinir.
--   Böylece activity_log tablosu hiçbir zaman büyümez.
--   (etkinlikler.sql'den sonra çalıştırın. Tekrar çalıştırılabilir.)
-- =====================================================================

create or replace function public.trim_activity_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.activity_log
  where id not in (
    select id from public.activity_log
    order by created_at desc, id desc
    limit 10
  );
  return null;
end;
$$;

revoke execute on function public.trim_activity_log() from public, anon, authenticated;

-- Satır başına değil, ekleme işlemi başına bir kez çalışır
drop trigger if exists activity_log_keep_last_10 on public.activity_log;
create trigger activity_log_keep_last_10
  after insert on public.activity_log
  for each statement execute function public.trim_activity_log();

-- Mevcut fazla kayıtları şimdi temizle
delete from public.activity_log
where id not in (
  select id from public.activity_log
  order by created_at desc, id desc
  limit 10
);

-- Kontrol: 10 olmalı
select count(*) as kayit_sayisi from public.activity_log;
