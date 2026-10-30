-- =====================================================================
-- Em3Task — Faz 4: Bildirim merkezi ve mesaj/yorum düzenleme
--
-- notifications: uygulama içi bildirimler (🔔). Telefon bildirimiyle aynı
--   anda sunucu (service role) yazar. Herkes sadece kendi bildirimlerini
--   görür, okundu işaretler ve siler. 60 günden eski bildirimler silinir.
--
-- Düzenleme: task_comments ve general_messages'a edited_at eklenir.
--   Kişi sadece kendi yorumunu/mesajını düzenler ve sadece içeriği
--   değişebilir (alıcı, yazar, görev değiştirilemez: özel mesaj başkasına
--   açılamaz).
--
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Bildirimler
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  actor_id      uuid references public.profiles (id) on delete set null,
  kind          text not null default 'general' check (char_length(kind) <= 30),
  title         text not null check (char_length(title) <= 200),
  body          text not null default '' check (char_length(body) <= 500),
  url           text not null default '/' check (url ~ '^/' and char_length(url) <= 300),
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert on public.notifications from authenticated;
grant select, update, delete on public.notifications to authenticated;

drop policy if exists "Notifications read own"   on public.notifications;
drop policy if exists "Notifications update own" on public.notifications;
drop policy if exists "Notifications delete own" on public.notifications;

create policy "Notifications read own" on public.notifications
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy "Notifications update own" on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
create policy "Notifications delete own" on public.notifications
  for delete to authenticated using (recipient_id = (select auth.uid()));

-- Kullanıcı sadece okundu bilgisini değiştirebilir
create or replace function public.notifications_only_read()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.recipient_id := old.recipient_id;
    new.actor_id := old.actor_id;
    new.kind := old.kind;
    new.title := old.title;
    new.body := old.body;
    new.url := old.url;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_only_read on public.notifications;
create trigger notifications_only_read
  before update on public.notifications
  for each row execute function public.notifications_only_read();

-- 60 günden eski bildirimleri temizle (her eklemede bir kez)
create or replace function public.notifications_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications where created_at < now() - interval '60 days';
  return null;
end;
$$;

revoke execute on function public.notifications_cleanup() from public, anon, authenticated;

drop trigger if exists notifications_cleanup on public.notifications;
create trigger notifications_cleanup
  after insert on public.notifications
  for each statement execute function public.notifications_cleanup();

-- ---------------------------------------------------------------------
-- 2) Yorum ve mesaj düzenleme
-- ---------------------------------------------------------------------
alter table public.task_comments    add column if not exists edited_at timestamptz;
alter table public.general_messages add column if not exists edited_at timestamptz;

grant update on public.task_comments    to authenticated;
grant update on public.general_messages to authenticated;

drop policy if exists "Task comments update own"    on public.task_comments;
drop policy if exists "General messages update own" on public.general_messages;

create policy "Task comments update own" on public.task_comments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "General messages update own" on public.general_messages
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Sadece içerik değişir; değişince edited_at veritabanı saatine ayarlanır
create or replace function public.comment_edit_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.task_id := old.task_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.edited_at := case when new.content is distinct from old.content then now() else old.edited_at end;
  end if;
  return new;
end;
$$;

drop trigger if exists task_comments_edit_guard on public.task_comments;
create trigger task_comments_edit_guard
  before update on public.task_comments
  for each row execute function public.comment_edit_guard();

create or replace function public.message_edit_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.user_id := old.user_id;
    new.receiver_id := old.receiver_id;
    new.created_at := old.created_at;
    new.edited_at := case when new.content is distinct from old.content then now() else old.edited_at end;
  end if;
  return new;
end;
$$;

drop trigger if exists general_messages_edit_guard on public.general_messages;
create trigger general_messages_edit_guard
  before update on public.general_messages
  for each row execute function public.message_edit_guard();

-- ---------------------------------------------------------------------
-- 3) Canlı güncelleme: yeni bildirim 🔔 sayısını anında günceller
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Kontrol
select tablename, policyname, cmd from pg_policies
where tablename in ('notifications', 'task_comments', 'general_messages')
order by tablename, policyname;
