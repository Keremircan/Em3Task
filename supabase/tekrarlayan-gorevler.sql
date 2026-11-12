-- =====================================================================
-- Em3Task — Tekrarlayan görevler
--   Her gün / hafta içi / her hafta / iki haftada bir / her ay kendiliğinden
--   açılan görevler. Tanım recurring_tasks tablosunda durur; her sabah
--   09:00'da çalışan zamanlanmış iş (hatirlatma.sql, aynı pg_cron işi)
--   next_run günü gelenlerden yeni görev açar ve sıradaki günü ileri alır.
--   Açılan görev tasks.recurring_id ile tanımına bağlanır.
--
--   Herkes okur; ekleyen kişi ya da Admin duraklatır / siler.
--   Proje silinirse o projenin tekrarları da silinir. Sorumlu ya da kuran
--   üye ekipten çıkarılırsa tekrar da silinir (sahipsiz görev açılmaz).
--
-- revize.sql'den SONRA, Supabase SQL Editor'de çalıştırın.
-- Zamanlanmış işte değişiklik gerekmez. Tekrar çalıştırılabilir.
-- =====================================================================

create table if not exists public.recurring_tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(trim(title)) between 1 and 200),
  description     text,
  project_id      uuid not null references public.projects (id) on delete cascade,
  assigned_to     uuid references public.profiles (id) on delete cascade, -- null = "Herkes"
  created_by      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  priority        text not null default 'none'
                  check (priority in ('none', 'low', 'medium', 'high', 'urgent')),
  frequency       text not null
                  check (frequency in ('daily', 'weekdays', 'weekly', 'biweekly', 'monthly')),
  anchor_day      smallint check (anchor_day between 1 and 31),         -- aylıkta ayın günü
  due_after_days  smallint check (due_after_days between 0 and 60),     -- null = teslim tarihi yok
  next_run        date not null,                                        -- sıradaki açılış günü
  last_run        date,
  is_active       boolean not null default true,                        -- false = duraklatıldı
  created_at      timestamptz not null default now()
);

create index if not exists recurring_tasks_due_idx on public.recurring_tasks (next_run) where is_active;
create index if not exists recurring_tasks_created_by_idx  on public.recurring_tasks (created_by);
create index if not exists recurring_tasks_project_id_idx  on public.recurring_tasks (project_id);
create index if not exists recurring_tasks_assigned_to_idx on public.recurring_tasks (assigned_to);

-- Açılan görevin hangi tekrardan geldiği (tekrar silinirse görev kalır, bağ kopar)
alter table public.tasks
  add column if not exists recurring_id uuid references public.recurring_tasks (id) on delete set null;
create index if not exists tasks_recurring_id_idx on public.tasks (recurring_id);

alter table public.recurring_tasks enable row level security;
revoke all on public.recurring_tasks from anon;
grant select, insert, update, delete on public.recurring_tasks to authenticated;

drop policy if exists "Recurring read"   on public.recurring_tasks;
drop policy if exists "Recurring insert" on public.recurring_tasks;
drop policy if exists "Recurring update" on public.recurring_tasks;
drop policy if exists "Recurring delete" on public.recurring_tasks;

create policy "Recurring read" on public.recurring_tasks
  for select to authenticated using (true);
create policy "Recurring insert" on public.recurring_tasks
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Recurring update" on public.recurring_tasks
  for update to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));
create policy "Recurring delete" on public.recurring_tasks
  for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));

-- Kuran kişi sonradan değiştirilemez (Admin de başkasının adına devredemez)
create or replace function public.recurring_keep_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Tekrarlayan görevi kuran kişi değiştirilemez.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists recurring_tasks_keep_owner on public.recurring_tasks;
create trigger recurring_tasks_keep_owner
  before update on public.recurring_tasks
  for each row execute function public.recurring_keep_owner();

-- Kontrol
select count(*) as tekrar_sayisi from public.recurring_tasks;
