-- =====================================================================
-- Em3Task — Üyelerin son görülme zamanı
--   profiles.last_seen_at: üyenin uygulamayı en son kullandığı an.
--   Uygulama açıldığında / arka plandan dönüldüğünde (en fazla 5 dakikada
--   bir) güncellenir. Değeri her zaman veritabanı saati belirler: kullanıcı
--   kendi satırına ileri/geri bir tarih yazamaz.
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.profiles_stamp_last_seen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.last_seen_at is distinct from old.last_seen_at then
    new.last_seen_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_stamp_last_seen on public.profiles;
create trigger profiles_stamp_last_seen
  before update on public.profiles
  for each row execute function public.profiles_stamp_last_seen();

-- Kontrol
select id, full_name, last_seen_at from public.profiles order by full_name;
