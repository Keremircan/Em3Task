-- =====================================================================
-- Em3Task — Faz 2: Kontrol listesi (alt görevler) ve etiketler
--
-- task_checklist_items: görevin içindeki işaretlenebilir maddeler.
--   Herkes görür. Ekleme / işaretleme / düzenleme / silme: görevi atayan,
--   sorumlusu ve Admin. Görev "Herkes"e atanmışsa (henüz kimse almadıysa)
--   ekipten herkes yapabilir.
--
-- labels + task_labels: renkli etiketler.
--   Herkes görür, oluşturur, düzenler ve görevlere ekleyip çıkarır.
--   Etiketi sadece oluşturan kişi ya da Admin siler (görevlerden de kalkar).
--
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Kontrol listesi
-- ---------------------------------------------------------------------
create table if not exists public.task_checklist_items (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 300),
  is_done     boolean not null default false,
  position    integer not null default 0,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists task_checklist_task_idx on public.task_checklist_items (task_id, position, created_at);

-- Bu kullanıcı bu görevin kontrol listesini düzenleyebilir mi?
create or replace function public.can_edit_checklist(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (
        t.created_by = (select auth.uid())
        or t.assigned_to = (select auth.uid())
        or t.assigned_to is null
        or (select public.is_admin())
      )
  );
$$;

revoke execute on function public.can_edit_checklist(uuid) from public, anon;
grant execute on function public.can_edit_checklist(uuid) to authenticated;

alter table public.task_checklist_items enable row level security;
revoke all on public.task_checklist_items from anon;
grant select, insert, update, delete on public.task_checklist_items to authenticated;

drop policy if exists "Checklist read"   on public.task_checklist_items;
drop policy if exists "Checklist insert" on public.task_checklist_items;
drop policy if exists "Checklist update" on public.task_checklist_items;
drop policy if exists "Checklist delete" on public.task_checklist_items;

create policy "Checklist read" on public.task_checklist_items
  for select to authenticated using (true);
create policy "Checklist insert" on public.task_checklist_items
  for insert to authenticated
  with check (created_by = (select auth.uid()) and public.can_edit_checklist(task_id));
create policy "Checklist update" on public.task_checklist_items
  for update to authenticated
  using (public.can_edit_checklist(task_id))
  with check (public.can_edit_checklist(task_id));
create policy "Checklist delete" on public.task_checklist_items
  for delete to authenticated using (public.can_edit_checklist(task_id));

-- Madde başka bir göreve taşınamaz, ekleyen kişi değiştirilemez
create or replace function public.checklist_keep_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.task_id := old.task_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists task_checklist_keep_owner on public.task_checklist_items;
create trigger task_checklist_keep_owner
  before update on public.task_checklist_items
  for each row execute function public.checklist_keep_owner();

-- ---------------------------------------------------------------------
-- 2) Etiketler
-- ---------------------------------------------------------------------
create table if not exists public.labels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 40),
  color       text not null default 'slate'
              check (color in ('slate', 'red', 'orange', 'amber', 'green', 'teal', 'sky', 'blue', 'violet', 'pink')),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create unique index if not exists labels_name_key on public.labels (lower(trim(name)));

create table if not exists public.task_labels (
  task_id   uuid not null references public.tasks (id) on delete cascade,
  label_id  uuid not null references public.labels (id) on delete cascade,
  added_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  added_at  timestamptz not null default now(),
  primary key (task_id, label_id)
);

create index if not exists task_labels_label_idx on public.task_labels (label_id);

alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
revoke all on public.labels, public.task_labels from anon;
grant select, insert, update, delete on public.labels to authenticated;
grant select, insert, delete on public.task_labels to authenticated;

drop policy if exists "Labels read"   on public.labels;
drop policy if exists "Labels insert" on public.labels;
drop policy if exists "Labels update" on public.labels;
drop policy if exists "Labels delete" on public.labels;

create policy "Labels read" on public.labels
  for select to authenticated using (true);
create policy "Labels insert" on public.labels
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Labels update" on public.labels
  for update to authenticated using (true) with check (true);
create policy "Labels delete" on public.labels
  for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));

-- Etiketi oluşturan kişi ve zaman değiştirilemez
create or replace function public.labels_keep_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists labels_keep_owner on public.labels;
create trigger labels_keep_owner
  before update on public.labels
  for each row execute function public.labels_keep_owner();

drop policy if exists "Task labels read"   on public.task_labels;
drop policy if exists "Task labels insert" on public.task_labels;
drop policy if exists "Task labels delete" on public.task_labels;

create policy "Task labels read" on public.task_labels
  for select to authenticated using (true);
create policy "Task labels insert" on public.task_labels
  for insert to authenticated with check (added_by = (select auth.uid()));
create policy "Task labels delete" on public.task_labels
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------
-- 3) Canlı güncelleme
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['task_checklist_items', 'labels', 'task_labels'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Kontrol
select tablename, policyname, cmd from pg_policies
where tablename in ('task_checklist_items', 'labels', 'task_labels')
order by tablename, policyname;
