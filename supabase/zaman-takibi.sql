-- =====================================================================
-- Em3Task — Faz 5: Zaman takibi ve raporlar
--
-- time_entries: göreve harcanan süre. Sayaçla (başlat/durdur) ya da elle
--   girilir. Herkes görür (raporlar için); herkes sadece kendi kaydını
--   ekler, düzenler ve siler. Kişi başına aynı anda tek çalışan sayaç olur.
--
-- tasks.completed_at: görevin "Tamamlandı" yapıldığı an (raporlar için).
--   Veritabanı kendisi yazar; mevcut tamamlanmış görevlere son güncellenme
--   zamanı atanır.
--
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Zaman kayıtları
-- ---------------------------------------------------------------------
create table if not exists public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz,  -- boş: sayaç çalışıyor
  note        text not null default '' check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  constraint time_entries_order check (ended_at is null or ended_at > started_at),
  constraint time_entries_max_24h check (ended_at is null or ended_at - started_at <= interval '24 hours')
);

create index if not exists time_entries_task_idx on public.time_entries (task_id);
create index if not exists time_entries_user_idx on public.time_entries (user_id, started_at desc);
create index if not exists time_entries_started_idx on public.time_entries (started_at desc);
-- Kişi başına tek çalışan sayaç
create unique index if not exists time_entries_one_running
  on public.time_entries (user_id) where ended_at is null;

alter table public.time_entries enable row level security;
revoke all on public.time_entries from anon;
grant select, insert, update, delete on public.time_entries to authenticated;

drop policy if exists "Time read"       on public.time_entries;
drop policy if exists "Time insert own" on public.time_entries;
drop policy if exists "Time update own" on public.time_entries;
drop policy if exists "Time delete own" on public.time_entries;

create policy "Time read" on public.time_entries
  for select to authenticated using (true);
create policy "Time insert own" on public.time_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Time update own" on public.time_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Time delete own" on public.time_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- Kayıt başka göreve/kişiye taşınamaz; ileri tarihli kayıt girilemez
create or replace function public.time_entries_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.task_id := old.task_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  if new.started_at > now() + interval '5 minutes'
     or (new.ended_at is not null and new.ended_at > now() + interval '5 minutes') then
    raise exception 'İleri tarihli süre girilemez.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists time_entries_guard on public.time_entries;
create trigger time_entries_guard
  before insert or update on public.time_entries
  for each row execute function public.time_entries_guard();

-- ---------------------------------------------------------------------
-- 2) Görevin tamamlanma zamanı
-- ---------------------------------------------------------------------
alter table public.tasks add column if not exists completed_at timestamptz;

update public.tasks set completed_at = updated_at
where status = 'done' and completed_at is null;

create or replace function public.tasks_stamp_completed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  elsif tg_op = 'UPDATE' then
    new.completed_at := old.completed_at; -- elle değiştirilemez
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_stamp_completed on public.tasks;
create trigger tasks_stamp_completed
  before insert or update on public.tasks
  for each row execute function public.tasks_stamp_completed();

create index if not exists tasks_completed_idx on public.tasks (completed_at desc) where completed_at is not null;

-- ---------------------------------------------------------------------
-- 3) Canlı güncelleme
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'time_entries'
  ) then
    alter publication supabase_realtime add table public.time_entries;
  end if;
end $$;

-- Kontrol
select policyname, cmd from pg_policies where tablename = 'time_entries' order by policyname;
select count(*) filter (where completed_at is not null) as tamamlanma_zamani_olan,
       count(*) filter (where status = 'done') as tamamlanan
from public.tasks;
