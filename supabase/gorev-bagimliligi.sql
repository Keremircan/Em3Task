-- =====================================================================
-- Em3Task — Görev bağımlılığı ("ön görev")
--   task_dependencies: depends_on_id tamamlanmadan task_id başlatılamaz
--   (Kabul bekliyor → Yapılıyor geçişi engellenir). Kural hem burada hem
--   arayüzde uygulanır; arayüzü atlayan istekler de engellenir.
--
--   Herkes okur. Ön görevi, bağlanan görevi atayan kişi ya da Admin ekler /
--   kaldırır. Döngü (A → B → A) ve kendine bağlama engellenir; bir göreve en
--   fazla 20 ön görev bağlanır. Görevlerden biri silinirse bağ da silinir.
--
-- revize.sql'den SONRA, Supabase SQL Editor'de çalıştırın.
-- Tekrar çalıştırılabilir.
-- =====================================================================

create table if not exists public.task_dependencies (
  task_id        uuid not null references public.tasks (id) on delete cascade,    -- bekleyen görev
  depends_on_id  uuid not null references public.tasks (id) on delete cascade,    -- ön görev
  added_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  primary key (task_id, depends_on_id),
  constraint task_dependencies_not_self check (task_id <> depends_on_id)
);

create index if not exists task_dependencies_depends_on_idx on public.task_dependencies (depends_on_id);
create index if not exists task_dependencies_added_by_idx   on public.task_dependencies (added_by);

-- Ön görevleri kim düzenler: bekleyen görevi atayan kişi ya da Admin.
-- (Görevleri herkes okuyabildiği için çağıranın yetkisiyle çalışması yeterli.)
create or replace function public.can_edit_dependencies(p_task_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id and t.created_by = (select auth.uid())
  ) or public.is_admin();
$$;

revoke execute on function public.can_edit_dependencies(uuid) from public, anon;
grant execute on function public.can_edit_dependencies(uuid) to authenticated;

alter table public.task_dependencies enable row level security;
revoke all on public.task_dependencies from anon;
grant select, insert, delete on public.task_dependencies to authenticated;

drop policy if exists "Dependencies read"   on public.task_dependencies;
drop policy if exists "Dependencies insert" on public.task_dependencies;
drop policy if exists "Dependencies delete" on public.task_dependencies;

create policy "Dependencies read" on public.task_dependencies
  for select to authenticated using (true);
create policy "Dependencies insert" on public.task_dependencies
  for insert to authenticated
  with check (added_by = (select auth.uid()) and public.can_edit_dependencies(task_id));
create policy "Dependencies delete" on public.task_dependencies
  for delete to authenticated using (public.can_edit_dependencies(task_id));

-- Ekleme kuralları: tamamlanan göreve eklenmez, sayı sınırı, döngü olmaz
create or replace function public.task_dependencies_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.tasks t where t.id = new.task_id and t.status = 'done') then
    raise exception 'Tamamlanan göreve ön görev eklenemez.' using errcode = '42501';
  end if;

  if (select count(*) from public.task_dependencies d where d.task_id = new.task_id) >= 20 then
    raise exception 'Bir göreve en fazla 20 ön görev bağlanabilir.' using errcode = '42501';
  end if;

  -- Seçilen ön görev (doğrudan ya da dolaylı) zaten bu görevi bekliyorsa döngü olur
  if exists (
    with recursive chain (id) as (
      select d.depends_on_id from public.task_dependencies d where d.task_id = new.depends_on_id
      union
      select d.depends_on_id
      from public.task_dependencies d
      join chain c on d.task_id = c.id
    )
    select 1 from chain where id = new.task_id
  ) then
    raise exception 'Bu bağlantı döngü oluşturur: seçilen görev zaten bu görevin bitmesini bekliyor.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.task_dependencies_guard() from public, anon, authenticated;

drop trigger if exists task_dependencies_guard on public.task_dependencies;
create trigger task_dependencies_guard
  before insert on public.task_dependencies
  for each row execute function public.task_dependencies_guard();

-- Başlatma kuralı: tamamlanmamış ön görevi olan görev kabul edilemez
create or replace function public.enforce_task_dependencies()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new; -- sunucu / SQL Editor işlemleri
  end if;

  if old.status = 'pending' and new.status = 'in_progress' and exists (
    select 1
    from public.task_dependencies d
    join public.tasks b on b.id = d.depends_on_id
    where d.task_id = new.id and b.status <> 'done'
  ) then
    raise exception 'Bu görev, ön görevleri tamamlanmadan başlatılamaz.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_task_dependencies() from public, anon, authenticated;

drop trigger if exists tasks_enforce_dependencies on public.tasks;
create trigger tasks_enforce_dependencies
  before update of status on public.tasks
  for each row execute function public.enforce_task_dependencies();

-- Canlı güncelleme: ön görev eklenince / kaldırılınca kilit rozeti anında değişsin
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_dependencies'
  ) then
    alter publication supabase_realtime add table public.task_dependencies;
  end if;
end;
$$;

-- Kontrol
select count(*) as bag_sayisi from public.task_dependencies;
