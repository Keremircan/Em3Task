-- =====================================================================
-- CoTask — YENİ PROJE İÇİN TAM KURULUM (tek dosya)
-- Sırayla şunları içerir: schema.sql + storage.sql + revize.sql + realtime.sql + genel.sql + silme.sql + linkler-duzeltme.sql + oncelik.sql
--
-- ÖNEMLİ: Bu dosyayı, 3 kullanıcıyı Authentication > Users'tan açtıktan
-- SONRA çalıştırın; böylece profiller ve Admin ataması otomatik oluşur.
-- Supabase SQL Editor'e yapıştırıp tek seferde çalıştırın.
-- =====================================================================



-- #####################################################################
-- ##### schema.sql
-- #####################################################################

-- =====================================================================
-- CoTask — 1. Aşama veritabanı şeması
-- Supabase SQL Editor'e yapıştırıp tek seferde çalıştırın.
-- Betik tekrar çalıştırılabilir (mevcut nesneleri bozmaz).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) TABLOLAR
-- ---------------------------------------------------------------------

-- Profiller: her auth kullanıcısı için bir satır
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Görevler
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(trim(title)) > 0),
  description  text,
  status       text not null default 'todo'
               check (status in ('todo', 'in_progress', 'review', 'done')),
  priority     text not null default 'medium'
               check (priority in ('low', 'medium', 'high', 'urgent')),
  assigned_to  uuid references public.profiles (id) on delete set null,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Görev yorumları
create table if not exists public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  content     text not null check (char_length(trim(content)) > 0),
  created_at  timestamptz not null default now()
);

-- Görev ekleri (dosyanın kendisi Supabase Storage'da durur)
create table if not exists public.task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  file_url     text not null,
  file_name    text not null,
  file_type    text,
  uploaded_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2) İNDEKSLER (yabancı anahtarlar ve sık filtrelenen alanlar)
-- ---------------------------------------------------------------------

create index if not exists tasks_assigned_to_idx        on public.tasks (assigned_to);
create index if not exists tasks_created_by_idx         on public.tasks (created_by);
create index if not exists tasks_status_idx             on public.tasks (status);
create index if not exists task_comments_task_id_idx    on public.task_comments (task_id);
create index if not exists task_comments_user_id_idx    on public.task_comments (user_id);
create index if not exists task_attachments_task_id_idx on public.task_attachments (task_id);
create index if not exists task_attachments_uploaded_by_idx on public.task_attachments (uploaded_by);


-- ---------------------------------------------------------------------
-- 3) updated_at'i otomatik güncelleyen trigger
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 4) Yeni auth kullanıcısı -> otomatik profil kaydı
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger kurulmadan önce açılmış kullanıcılar varsa onların profillerini de oluştur
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 5) ROW LEVEL SECURITY
-- Sadece giriş yapmış kullanıcılar her şeyi okuyup yazabilir.
-- (`to authenticated` = auth.role() = 'authenticated' ile aynı etki)
-- ---------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_comments    enable row level security;
alter table public.task_attachments enable row level security;

-- Data API erişimi için açık yetkiler (anon'a hiçbir şey verilmez)
grant select, insert, update, delete on public.profiles         to authenticated;
grant select, insert, update, delete on public.tasks            to authenticated;
grant select, insert, update, delete on public.task_comments    to authenticated;
grant select, insert, update, delete on public.task_attachments to authenticated;

-- Profiller: sıkı kurallar aşağıda (PROFİL bölümü, profil.sql)

drop policy if exists "Authenticated full access" on public.tasks;
create policy "Authenticated full access" on public.tasks
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated full access" on public.task_comments;
create policy "Authenticated full access" on public.task_comments
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated full access" on public.task_attachments;
create policy "Authenticated full access" on public.task_attachments
  for all to authenticated using (true) with check (true);


-- #####################################################################
-- ##### storage.sql
-- #####################################################################

-- =====================================================================
-- CoTask — 4. Aşama: görev ekleri için Storage
-- Supabase SQL Editor'e yapıştırıp çalıştırın. Tekrar çalıştırılabilir.
-- Bucket zaten varsa sadece ayarlarını günceller.
-- =====================================================================

-- Özel (private) bucket: dosyalara sadece giriş yapmış ekip erişir.
-- Uygulama dosyaları süreli imzalı linklerle (signed URL) gösterir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  false,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Giriş yapmış herkes bu bucket'ta okuyup yazabilir (P2P, eşit yetki)
drop policy if exists "task-attachments: authenticated read"   on storage.objects;
drop policy if exists "task-attachments: authenticated insert" on storage.objects;
drop policy if exists "task-attachments: authenticated update" on storage.objects;
drop policy if exists "task-attachments: authenticated delete" on storage.objects;

create policy "task-attachments: authenticated read" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-attachments');

create policy "task-attachments: authenticated insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-attachments');

create policy "task-attachments: authenticated update" on storage.objects
  for update to authenticated
  using (bucket_id = 'task-attachments')
  with check (bucket_id = 'task-attachments');

create policy "task-attachments: authenticated delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-attachments');


-- #####################################################################
-- ##### revize.sql
-- #####################################################################

-- =====================================================================
-- CoTask — Revize: projeler, roller ve görev onay akışı
-- schema.sql ve storage.sql'den SONRA, Supabase SQL Editor'de çalıştırın.
-- Tekrar çalıştırılabilir.
--
-- Görev akışı:
--   pending (Onay Bekliyor) --kabul: atanan kişi--> in_progress (Yapılıyor)
--   in_progress --sadece sorumlu--> review (Kontrol)
--   in_progress | review --sadece atayan--> done (Tamamlandı)
--   assigned_to boş (null) = "Herkes": ilk kabul eden görevi üstlenir.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) PROJELER
-- ---------------------------------------------------------------------

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 80),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create unique index if not exists projects_name_key on public.projects (lower(trim(name)));
create index if not exists projects_created_by_idx on public.projects (created_by);

-- İsteğe bağlı proje linki (proje sayfasında adın yanında gösterilir)
alter table public.projects add column if not exists url text;
alter table public.projects drop constraint if exists projects_url_check;
alter table public.projects
  add constraint projects_url_check
  check (url is null or (url ~* '^https?://' and char_length(url) <= 2048));


-- ---------------------------------------------------------------------
-- 2) ROLLER
-- ---------------------------------------------------------------------

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 40),
  is_system   boolean not null default false, -- Admin: değiştirilemez, silinemez
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create unique index if not exists roles_name_key on public.roles (lower(trim(name)));
create index if not exists roles_created_by_idx on public.roles (created_by);

create table if not exists public.member_roles (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  role_id     uuid not null references public.roles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, role_id)
);

create index if not exists member_roles_role_id_idx on public.member_roles (role_id);

-- Giriş yapan kullanıcı Admin mi? (RLS politikalarında kullanılır)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_roles mr
    join public.roles r on r.id = mr.role_id
    where mr.profile_id = (select auth.uid())
      and r.is_system
      and r.name = 'Admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Sabit Admin rolü ve tek Admin: Kerem Ercan
insert into public.roles (name, is_system, created_by)
select 'Admin', true, null
where not exists (select 1 from public.roles where is_system and name = 'Admin');

insert into public.member_roles (profile_id, role_id)
select p.id, r.id
from auth.users u
join public.profiles p on p.id = u.id
cross join public.roles r
where u.email = 'kerem@mail.com'
  and r.is_system and r.name = 'Admin'
on conflict do nothing;

update public.profiles p
set full_name = 'Kerem Ercan'
from auth.users u
where u.id = p.id
  and u.email = 'kerem@mail.com'
  and coalesce(p.full_name, '') not ilike '%ercan%';


-- ---------------------------------------------------------------------
-- 3) GÖREVLER: proje bağlantısı ve yeni durumlar
-- ---------------------------------------------------------------------

alter table public.tasks
  add column if not exists project_id uuid references public.projects (id) on delete restrict;
alter table public.tasks
  add column if not exists accepted_at timestamptz;

create index if not exists tasks_project_id_idx on public.tasks (project_id);

alter table public.tasks drop constraint if exists tasks_status_check;
update public.tasks set status = 'pending' where status = 'todo';
alter table public.tasks
  add constraint tasks_status_check
  check (status in ('pending', 'in_progress', 'review', 'done'));
alter table public.tasks alter column status set default 'pending';

-- Revize sayısı (Kontrol → Yapılıyor geçişinde artar)
alter table public.tasks
  add column if not exists revision_count integer not null default 0;


-- ---------------------------------------------------------------------
-- 4) GÖREV AKIŞI KURALLARI (arayüzü atlayan isteklere karşı da korur)
-- SQL Editor gibi oturumsuz bağlantılarda (auth.uid() boş) kurallar atlanır.
-- ---------------------------------------------------------------------

create or replace function public.enforce_task_workflow()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  is_creator boolean;
begin
  if uid is null then
    return new;
  end if;

  -- Yeni görev her zaman "Onay Bekliyor" olarak başlar
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.accepted_at := null;
    new.revision_count := 0;
    return new;
  end if;

  -- Revize sayacı elle değiştirilemez; sadece "Revize Ver" geçişinde artar
  new.revision_count := old.revision_count;

  is_creator := old.created_by is not distinct from uid;

  if new.created_by is distinct from old.created_by then
    raise exception 'Görevi oluşturan kişi değiştirilemez.' using errcode = '42501';
  end if;

  -- Başlık, açıklama, proje ve teslim tarihini sadece görevi atayan düzenler.
  -- Öncelik (priority) herkese açıktır: ekipten herkes değiştirebilir.
  if (new.title, new.description, new.project_id, new.due_date)
     is distinct from
     (old.title, old.description, old.project_id, old.due_date)
     and not is_creator then
    raise exception 'Görevi sadece atayan kişi düzenleyebilir.' using errcode = '42501';
  end if;

  -- Sorumlu kişi değişikliği
  if new.assigned_to is distinct from old.assigned_to then
    if is_creator and new.status = old.status then
      -- Atayan kişi görevi başkasına devrederse görev yeniden onaya düşer
      if old.status = 'done' then
        raise exception 'Tamamlanan görevin sorumlusu değiştirilemez.' using errcode = '42501';
      end if;
      new.status := 'pending';
      new.accepted_at := null;
      return new;
    elsif old.assigned_to is null
      and new.assigned_to = uid
      and old.status = 'pending'
      and new.status = 'in_progress' then
      null; -- "Herkes"e atanmış görevi üstlenme; durum kontrolü aşağıda
    else
      raise exception 'Görevin sorumlusunu sadece atayan kişi değiştirebilir.' using errcode = '42501';
    end if;
  end if;

  -- Durum geçişleri
  if new.status is distinct from old.status then
    if old.status = 'pending' and new.status = 'in_progress' then
      if new.assigned_to is distinct from uid then
        raise exception 'Görevi sadece atanan kişi kabul edebilir.' using errcode = '42501';
      end if;
      new.accepted_at := now();
    elsif old.status = 'in_progress' and new.status = 'review' then
      if old.assigned_to is distinct from uid then
        raise exception 'Görevi sadece sorumlusu kontrole gönderebilir.' using errcode = '42501';
      end if;
    elsif old.status = 'review' and new.status = 'in_progress' then
      -- Revize Ver: kontroldeki görev, atayan kişi tarafından "Yapılıyor"a geri döner
      if not is_creator then
        raise exception 'Revizeyi sadece görevi atayan kişi verebilir.' using errcode = '42501';
      end if;
      new.revision_count := old.revision_count + 1;
    elsif old.status in ('in_progress', 'review') and new.status = 'done' then
      if not is_creator then
        raise exception 'Görevi sadece atayan kişi tamamlayabilir.' using errcode = '42501';
      end if;
    else
      raise exception 'Bu durum değişikliğine izin verilmiyor.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_enforce_workflow on public.tasks;
create trigger tasks_enforce_workflow
  before insert or update on public.tasks
  for each row execute function public.enforce_task_workflow();


-- ---------------------------------------------------------------------
-- 5) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.projects     enable row level security;
alter table public.roles        enable row level security;
alter table public.member_roles enable row level security;

grant select, insert, update, delete on public.projects     to authenticated;
grant select, insert, update, delete on public.roles        to authenticated;
grant select, insert, update, delete on public.member_roles to authenticated;

-- Projeler: herkes görür, oluşturur, düzenler ve siler
drop policy if exists "Projects read"   on public.projects;
drop policy if exists "Projects insert" on public.projects;
drop policy if exists "Projects update" on public.projects;
drop policy if exists "Projects delete" on public.projects;

create policy "Projects read" on public.projects
  for select to authenticated using (true);
create policy "Projects insert" on public.projects
  for insert to authenticated with check (created_by = (select auth.uid()));
-- Düzenleme (ad, link) ve silme tüm ekibe açık; oluşturan kişi trigger ile sabit kalır
create policy "Projects update" on public.projects
  for update to authenticated using (true) with check (true);

create or replace function public.keep_project_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_keep_creator on public.projects;
create trigger projects_keep_creator
  before update on public.projects
  for each row execute function public.keep_project_creator();
-- Silme de tüm ekibe açık (içinde görev olan proje silinemez)
create policy "Projects delete" on public.projects
  for delete to authenticated using (true);

-- Görevler: herkes görür; oluşturan kendisi olmalı; kurallar trigger'da;
-- sadece atayan siler
drop policy if exists "Authenticated full access" on public.tasks;
drop policy if exists "Tasks read"   on public.tasks;
drop policy if exists "Tasks insert" on public.tasks;
drop policy if exists "Tasks update" on public.tasks;
drop policy if exists "Tasks delete" on public.tasks;

create policy "Tasks read" on public.tasks
  for select to authenticated using (true);
create policy "Tasks insert" on public.tasks
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Tasks update" on public.tasks
  for update to authenticated using (true) with check (true);
create policy "Tasks delete" on public.tasks
  for delete to authenticated using (created_by = (select auth.uid()));

-- Roller: herkes görür; sadece Admin oluşturur/siler; Admin rolüne dokunulamaz
drop policy if exists "Roles read"   on public.roles;
drop policy if exists "Roles insert" on public.roles;
drop policy if exists "Roles update" on public.roles;
drop policy if exists "Roles delete" on public.roles;

create policy "Roles read" on public.roles
  for select to authenticated using (true);
create policy "Roles insert" on public.roles
  for insert to authenticated
  with check ((select public.is_admin()) and not is_system);
create policy "Roles update" on public.roles
  for update to authenticated
  using ((select public.is_admin()) and not is_system)
  with check ((select public.is_admin()) and not is_system);
create policy "Roles delete" on public.roles
  for delete to authenticated
  using ((select public.is_admin()) and not is_system);

-- Rol atamaları: herkes görür; sadece Admin atar/kaldırır; Admin rolü sabittir
drop policy if exists "Member roles read"   on public.member_roles;
drop policy if exists "Member roles insert" on public.member_roles;
drop policy if exists "Member roles delete" on public.member_roles;

create policy "Member roles read" on public.member_roles
  for select to authenticated using (true);
create policy "Member roles insert" on public.member_roles
  for insert to authenticated
  with check (
    (select public.is_admin())
    and not exists (select 1 from public.roles r where r.id = role_id and r.is_system)
  );
create policy "Member roles delete" on public.member_roles
  for delete to authenticated
  using (
    (select public.is_admin())
    and not exists (select 1 from public.roles r where r.id = role_id and r.is_system)
  );


-- #####################################################################
-- ##### realtime.sql
-- #####################################################################

-- =====================================================================
-- CoTask — Canlı güncellemeler (Supabase Realtime)
-- Tabloları Realtime yayınına ekler; böylece bir ekip üyesinin yaptığı
-- değişiklik sayfa yenilenmeden diğerlerinin ekranına düşer.
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- Not: Olaylar RLS'ye tabidir; sadece giriş yapmış ekip üyeleri alır.
-- =====================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'tasks', 'task_comments', 'task_attachments',
    'projects', 'profiles', 'roles', 'member_roles'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Kontrol: yayındaki tablolar (7 satır görmelisiniz)
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;


-- #####################################################################
-- ##### genel.sql
-- #####################################################################

-- =====================================================================
-- CoTask — "Genel" sayfası: projeden bağımsız ekip sohbeti
-- Mesajlar, mesajlara eklenen dokümanlar ve canlı güncelleme.
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) TABLOLAR
-- ---------------------------------------------------------------------

-- Sohbet mesajları. Sadece dosya paylaşılan mesajlarda metin boş olabilir.
create table if not exists public.general_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  content     text not null default '' check (char_length(content) <= 20000),
  created_at  timestamptz not null default now()
);

create index if not exists general_messages_created_at_idx on public.general_messages (created_at desc);
create index if not exists general_messages_user_id_idx on public.general_messages (user_id);

-- Mesajlara eklenen dosyalar (dosyanın kendisi 'general-files' bucket'ında)
create table if not exists public.general_files (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.general_messages (id) on delete cascade,
  file_url     text not null,              -- bucket içindeki dosya yolu
  file_name    text not null,
  file_type    text,
  file_size    bigint,
  uploaded_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists general_files_message_id_idx on public.general_files (message_id);
create index if not exists general_files_uploaded_by_idx on public.general_files (uploaded_by);
create index if not exists general_files_created_at_idx on public.general_files (created_at desc);


-- ---------------------------------------------------------------------
-- 2) ROW LEVEL SECURITY
-- Herkes okur ve yazar; mesajı ve dosyasını sadece sahibi siler.
-- ---------------------------------------------------------------------

alter table public.general_messages enable row level security;
alter table public.general_files    enable row level security;

grant select, insert, delete on public.general_messages to authenticated;
grant select, insert, delete on public.general_files    to authenticated;

drop policy if exists "General messages read"   on public.general_messages;
drop policy if exists "General messages insert" on public.general_messages;
drop policy if exists "General messages delete" on public.general_messages;

create policy "General messages read" on public.general_messages
  for select to authenticated using (true);
create policy "General messages insert" on public.general_messages
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "General messages delete" on public.general_messages
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "General files read"   on public.general_files;
drop policy if exists "General files insert" on public.general_files;
drop policy if exists "General files delete" on public.general_files;

create policy "General files read" on public.general_files
  for select to authenticated using (true);
-- Dosya sadece kişinin kendi mesajına eklenebilir
create policy "General files insert" on public.general_files
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.general_messages m
      where m.id = message_id and m.user_id = (select auth.uid())
    )
  );
create policy "General files delete" on public.general_files
  for delete to authenticated using (uploaded_by = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 3) DOSYA DEPOSU (özel bucket, en fazla 10 MB)
-- Görseller, PDF, Office dosyaları, metin/CSV ve ZIP.
-- HTML/SVG gibi tarayıcıda kod çalıştırabilen türler bilerek yok.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'general-files',
  'general-files',
  false,
  10485760,
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip'
  ]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "general-files: authenticated read"   on storage.objects;
drop policy if exists "general-files: authenticated insert" on storage.objects;
drop policy if exists "general-files: authenticated delete" on storage.objects;

create policy "general-files: authenticated read" on storage.objects
  for select to authenticated using (bucket_id = 'general-files');
create policy "general-files: authenticated insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'general-files');
-- Dosyayı sadece yükleyen siler
create policy "general-files: authenticated delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'general-files' and owner_id = (select auth.uid())::text);


-- ---------------------------------------------------------------------
-- 4) CANLI GÜNCELLEME
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['general_messages', 'general_files']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Kontrol: 2 satır (general_files, general_messages) görmelisiniz
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename like 'general_%'
order by tablename;


-- #####################################################################
-- ##### silme.sql
-- #####################################################################

-- =====================================================================
-- CoTask — Silme yetkileri ve kaldırılan linkler
-- Kural: herkes kendi yorumunu/mesajını/dokümanını siler; Admin hepsini.
-- Linkler mesajın içinde olduğu için "silmek" = LİNKLER listesinden
-- kaldırmak (mesaj metnine dokunulmaz).
-- genel.sql'den SONRA, Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) GÖREV YORUMLARI: herkes okur/yazar; sahibi veya Admin siler
-- ---------------------------------------------------------------------

drop policy if exists "Authenticated full access" on public.task_comments;
drop policy if exists "Task comments read"   on public.task_comments;
drop policy if exists "Task comments insert" on public.task_comments;
drop policy if exists "Task comments delete" on public.task_comments;

create policy "Task comments read" on public.task_comments
  for select to authenticated using (true);
create policy "Task comments insert" on public.task_comments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Task comments delete" on public.task_comments
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));


-- ---------------------------------------------------------------------
-- 2) GÖREV EKLERİ: yükleyen veya Admin siler
-- (Görev silinince ekler yabancı anahtar ile otomatik silinir.)
-- ---------------------------------------------------------------------

drop policy if exists "Authenticated full access" on public.task_attachments;
drop policy if exists "Task attachments read"   on public.task_attachments;
drop policy if exists "Task attachments insert" on public.task_attachments;
drop policy if exists "Task attachments delete" on public.task_attachments;

create policy "Task attachments read" on public.task_attachments
  for select to authenticated using (true);
create policy "Task attachments insert" on public.task_attachments
  for insert to authenticated with check (uploaded_by = (select auth.uid()));
create policy "Task attachments delete" on public.task_attachments
  for delete to authenticated
  using (uploaded_by = (select auth.uid()) or (select public.is_admin()));


-- ---------------------------------------------------------------------
-- 3) GENEL SOHBET: mesaj ve dosyayı sahibi veya Admin siler
-- ---------------------------------------------------------------------

drop policy if exists "General messages delete" on public.general_messages;
create policy "General messages delete" on public.general_messages
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "General files delete" on public.general_files;
create policy "General files delete" on public.general_files
  for delete to authenticated
  using (uploaded_by = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "general-files: authenticated delete" on storage.objects;
create policy "general-files: authenticated delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'general-files'
    and (owner_id = (select auth.uid())::text or (select public.is_admin()))
  );


-- ---------------------------------------------------------------------
-- 4) LİSTEDEN KALDIRILAN LİNKLER
-- scope: 'genel' (Genel sayfası) ya da görevin id'si
-- ---------------------------------------------------------------------

create table if not exists public.removed_links (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (char_length(scope) between 1 and 64),
  url         text not null check (char_length(url) between 1 and 2048),
  removed_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (scope, url)
);

create index if not exists removed_links_removed_by_idx on public.removed_links (removed_by);

alter table public.removed_links enable row level security;
grant select, insert on public.removed_links to authenticated;

-- Kimin kaldırabileceği (linki paylaşan ya da Admin) uygulamada kontrol edilir;
-- burada sadece kaldıran kişinin kendisi olması zorunlu tutulur.
drop policy if exists "Removed links read"   on public.removed_links;
drop policy if exists "Removed links insert" on public.removed_links;
create policy "Removed links read" on public.removed_links
  for select to authenticated using (true);
create policy "Removed links insert" on public.removed_links
  for insert to authenticated with check (removed_by = (select auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'removed_links'
  ) then
    alter publication supabase_realtime add table public.removed_links;
  end if;
end;
$$;

-- Kontrol: yeni politikalar (9 satır görmelisiniz)
select tablename, policyname from pg_policies
where policyname in (
  'Task comments read', 'Task comments insert', 'Task comments delete',
  'Task attachments read', 'Task attachments insert', 'Task attachments delete',
  'General messages delete', 'General files delete', 'Removed links insert'
)
order by tablename, policyname;


-- #####################################################################
-- ##### linkler-duzeltme.sql
-- #####################################################################

-- =====================================================================
-- CoTask — Kaldırılan link yeniden paylaşılınca listeye geri dönsün
-- Kaldırma artık sadece o ana kadarki paylaşımları kapsar (zamana göre).
-- Aynı link tekrar kaldırılırsa kaldırılma zamanı güncellenebilsin diye
-- güncelleme izni eklenir. silme.sql'den SONRA çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

grant update on public.removed_links to authenticated;

drop policy if exists "Removed links update" on public.removed_links;
create policy "Removed links update" on public.removed_links
  for update to authenticated
  using (true)
  with check (removed_by = (select auth.uid()));

-- Kontrol: 1 satır görmelisiniz
select policyname from pg_policies
where tablename = 'removed_links' and policyname = 'Removed links update';


-- #####################################################################
-- ##### oncelik.sql
-- #####################################################################

-- =====================================================================
-- CoTask — Görev önceliği: 5 seviye
--   none (Önceliksiz) · low (Düşük) · medium (Orta) · high (Yüksek) · urgent (Acil)
-- Varsayılan "Önceliksiz". Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('none', 'low', 'medium', 'high', 'urgent'));
alter table public.tasks alter column priority set default 'none';

-- Şimdiye kadar formda öncelik seçimi yoktu; tüm görevler kendiliğinden
-- "medium" kaydedildi. Bunlar kimsenin seçmediği değerler olduğu için
-- "Önceliksiz"e çevrilir. (Sadece bu dosya ilk kez çalıştırılırken anlamlı.)
do $$
begin
  if not exists (select 1 from public.tasks where priority = 'none') then
    -- Görev akışı kuralları (trigger) SQL Editor'de devre dışıdır (oturum yok)
    update public.tasks set priority = 'none' where priority = 'medium';
  end if;
end;
$$;

-- Kontrol: önceliklere göre görev sayısı
select priority, count(*) from public.tasks group by priority order by priority;


-- ---------------------------------------------------------------------
-- KİŞİSEL YAPILACAKLAR (kisisel-todo.sql)
-- ---------------------------------------------------------------------
create table if not exists public.personal_todos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
               references auth.users (id) on delete cascade,
  title        text not null,
  category     text,
  is_completed boolean not null default false,
  created_at   timestamptz not null default now(),
  constraint personal_todos_title_check
    check (char_length(btrim(title)) between 1 and 1000),
  constraint personal_todos_category_check
    check (category is null or char_length(btrim(category)) between 1 and 80)
);

create index if not exists personal_todos_user_created_idx
  on public.personal_todos (user_id, created_at);

alter table public.personal_todos enable row level security;

-- Oturumsuz (anon) erişim yok; oturumlu kullanıcı sadece kendi satırları
revoke all on public.personal_todos from anon;
grant select, insert, update, delete on public.personal_todos to authenticated;

drop policy if exists "Personal todos select" on public.personal_todos;
drop policy if exists "Personal todos insert" on public.personal_todos;
drop policy if exists "Personal todos update" on public.personal_todos;
drop policy if exists "Personal todos delete" on public.personal_todos;

create policy "Personal todos select" on public.personal_todos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Personal todos insert" on public.personal_todos
  for insert to authenticated with check (user_id = (select auth.uid()));
-- with check: madde başka bir kullanıcıya devredilemez
create policy "Personal todos update" on public.personal_todos
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Personal todos delete" on public.personal_todos
  for delete to authenticated using (user_id = (select auth.uid()));

-- Not: Bu tablo bilerek Realtime yayınına eklenmez; değişiklikler kimseye yayınlanmaz.


-- ---------------------------------------------------------------------
-- UYGULAMA AYARLARI / ÜYE YÖNETİMİ (uye-yonetimi.sql)
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

revoke all on public.app_settings from anon;
grant select, update on public.app_settings to authenticated;

drop policy if exists "App settings read"   on public.app_settings;
drop policy if exists "App settings update" on public.app_settings;

create policy "App settings read" on public.app_settings
  for select to authenticated using (true);
create policy "App settings update" on public.app_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
-- Ekleme/silme politikası yok: ayar satırları sadece bu dosyayla oluşturulur.

-- Güncellenme zamanı otomatik
create or replace function public.touch_app_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch
  before update on public.app_settings
  for each row execute function public.touch_app_settings();

-- Varsayılan: sadece Admin üye ekleyip çıkarabilir (mevcut değer korunur)
insert into public.app_settings (key, value)
values ('member_management_permission', '{"allow_all_members": false}'::jsonb)
on conflict (key) do nothing;


-- ---------------------------------------------------------------------
-- WEB PUSH ABONELİKLERİ (push-bildirimleri.sql)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh     text not null check (length(p256dh) <= 200),
  auth       text not null check (length(auth) <= 100),
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from anon;
grant select, insert, delete on public.push_subscriptions to authenticated;

drop policy if exists "Push subscriptions read own"   on public.push_subscriptions;
drop policy if exists "Push subscriptions insert own" on public.push_subscriptions;
drop policy if exists "Push subscriptions delete own" on public.push_subscriptions;

create policy "Push subscriptions read own" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Push subscriptions insert own" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Push subscriptions delete own" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- PROFİL (profil.sql)
-- ---------------------------------------------------------------------
-- 1) Profil kuralları
drop policy if exists "Authenticated full access" on public.profiles;
drop policy if exists "Profiles read"       on public.profiles;
drop policy if exists "Profiles update own" on public.profiles;

revoke insert, delete on public.profiles from authenticated;
grant select, update on public.profiles to authenticated;

create policy "Profiles read" on public.profiles
  for select to authenticated using (true);
create policy "Profiles update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Fotoğraf adresi sadece bizim depomuzdan olabilir
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check
  check (avatar_url is null or (avatar_url ~ '^https://' and length(avatar_url) <= 500));

-- 2) Profil fotoğrafı deposu (2 MB, sadece resim)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatars insert own" on storage.objects;
drop policy if exists "Avatars delete own" on storage.objects;

create policy "Avatars insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- ---------------------------------------------------------------------
-- SON GÖRÜLME (son-gorulme.sql)
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
-- ETKİNLİK AKIŞI (etkinlikler.sql)
-- ---------------------------------------------------------------------
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
-- ETKİNLİK SINIRI: sadece son 10 kayıt (etkinlik-siniri.sql)
-- ---------------------------------------------------------------------
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
