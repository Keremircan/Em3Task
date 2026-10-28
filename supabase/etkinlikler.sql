-- =====================================================================
-- Em3Task — Etkinlik akışı (ana sayfadaki "Son etkinlikler")
--   activity_log: ekipte yapılan işlemlerin kaydı. Satırları sadece
--   veritabanı tetikleyicileri yazar; işlemi yapan kişi her zaman oturumdaki
--   kullanıcıdır (auth.uid()). Kimse elle kayıt ekleyemez/değiştiremez.
--   Kaydedilen işlemler:
--     task_created, task_reassigned, task_accepted, task_submitted,
--     task_revision, task_completed, task_deleted, comment_added, project_created
--   Görev silinse bile kayıt kalır (başlık kayıt anında saklanır).
--   Sadece son 10 kayıt tutulur (bkz. etkinlik-siniri.sql).
--   Sunucu işlemleri (ör. üye çıkarılırken görevlerinin silinmesi) kaydedilmez.
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

create table if not exists public.activity_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (action in (
                'task_created', 'task_reassigned', 'task_accepted', 'task_submitted',
                'task_revision', 'task_completed', 'task_deleted',
                'comment_added', 'project_created')),
  task_id     uuid references public.tasks (id) on delete set null,
  project_id  uuid references public.projects (id) on delete set null,
  target_id   uuid references public.profiles (id) on delete set null, -- atanan kişi
  title       text not null default '',  -- görev/proje adı (kayıt anındaki)
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_created_idx on public.activity_log (created_at desc);
create index if not exists activity_log_task_idx    on public.activity_log (task_id);

alter table public.activity_log enable row level security;

revoke all on public.activity_log from anon, authenticated;
grant select on public.activity_log to authenticated;

drop policy if exists "Activity read" on public.activity_log;
create policy "Activity read" on public.activity_log
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- Tetikleyiciler
-- ---------------------------------------------------------------------
create or replace function public.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  act text;
begin
  if uid is null then
    return coalesce(new, old); -- sunucu/SQL Editor işlemleri kaydedilmez
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity_log (actor_id, action, task_id, project_id, target_id, title)
    values (uid, 'task_created', new.id, new.project_id, new.assigned_to, new.title);
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.activity_log (actor_id, action, task_id, project_id, title)
    values (uid, 'task_deleted', null, old.project_id, old.title);
    return old;
  end if;

  -- UPDATE: durum geçişleri
  if new.status is distinct from old.status then
    act := case
      when old.status = 'pending'     and new.status = 'in_progress' then 'task_accepted'
      when old.status = 'in_progress' and new.status = 'review'      then 'task_submitted'
      when old.status = 'review'      and new.status = 'in_progress' then 'task_revision'
      when new.status = 'done'                                        then 'task_completed'
      else null
    end;
  end if;

  -- Atayan kişi görevi başkasına devretti
  if act is null and new.assigned_to is distinct from old.assigned_to then
    act := 'task_reassigned';
  end if;

  if act is not null then
    insert into public.activity_log (actor_id, action, task_id, project_id, target_id, title)
    values (uid, act, new.id, new.project_id, new.assigned_to, new.title);
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_log_activity on public.tasks;
create trigger tasks_log_activity
  after insert or update or delete on public.tasks
  for each row execute function public.log_task_activity();

create or replace function public.log_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  -- Revize notları "Revize istedi" olarak zaten kaydediliyor
  if auth.uid() is null or new.content like '**Revize #%' then
    return new;
  end if;
  select id, project_id, title into t from public.tasks where id = new.task_id;
  insert into public.activity_log (actor_id, action, task_id, project_id, title)
  values (auth.uid(), 'comment_added', t.id, t.project_id, coalesce(t.title, ''));
  return new;
end;
$$;

drop trigger if exists task_comments_log_activity on public.task_comments;
create trigger task_comments_log_activity
  after insert on public.task_comments
  for each row execute function public.log_comment_activity();

create or replace function public.log_project_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    insert into public.activity_log (actor_id, action, project_id, title)
    values (auth.uid(), 'project_created', new.id, new.name);
  end if;
  return new;
end;
$$;

drop trigger if exists projects_log_activity on public.projects;
create trigger projects_log_activity
  after insert on public.projects
  for each row execute function public.log_project_activity();

revoke execute on function public.log_task_activity()    from public, anon, authenticated;
revoke execute on function public.log_comment_activity() from public, anon, authenticated;
revoke execute on function public.log_project_activity() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- İlk kurulumda akış boş kalmasın: mevcut verilerden geçmişi doldur
-- (sadece tablo boşsa çalışır)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.activity_log) then
    insert into public.activity_log (actor_id, action, task_id, project_id, target_id, title, created_at)
    select created_by, 'task_created', id, project_id, assigned_to, title, created_at
    from public.tasks where created_by is not null;

    insert into public.activity_log (actor_id, action, task_id, project_id, title, created_at)
    select created_by, 'task_completed', id, project_id, title, updated_at
    from public.tasks where status = 'done' and created_by is not null;

    insert into public.activity_log (actor_id, action, task_id, project_id, title, created_at)
    select c.user_id, 'comment_added', t.id, t.project_id, t.title, c.created_at
    from public.task_comments c join public.tasks t on t.id = c.task_id
    where c.user_id is not null and c.content not like '**Revize #%';

    insert into public.activity_log (actor_id, action, project_id, title, created_at)
    select created_by, 'project_created', id, name, created_at
    from public.projects where created_by is not null;
  end if;
end $$;

-- Kontrol: son 15 etkinlik
select a.created_at, p.full_name, a.action, a.title
from public.activity_log a left join public.profiles p on p.id = a.actor_id
order by a.created_at desc limit 15;
