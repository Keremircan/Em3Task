-- =====================================================================
-- Em3Task — Genel sohbette özel mesaj
--   general_messages.receiver_id:
--     NULL  → herkese açık mesaj
--     dolu  → sadece gönderen (user_id) ve alıcı görebilir
--   Gizlilik veritabanında (RLS) uygulanır: üçüncü bir kişi doğrudan istek
--   atsa bile özel mesajı, ekli dosyasını ya da tepkilerini göremez.
--   Alıcı ekipten çıkarılırsa özel mesajlar da silinir (herkese açık hale
--   gelmesin diye "set null" değil "cascade").
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

alter table public.general_messages
  add column if not exists receiver_id uuid default null
  references public.profiles (id) on delete cascade;

create index if not exists general_messages_receiver_idx on public.general_messages (receiver_id);

-- 1) Mesajlar: herkese açık olanlar + gönderdiğim + bana gelen
drop policy if exists "General messages read"   on public.general_messages;
drop policy if exists "General messages insert" on public.general_messages;

create policy "General messages read" on public.general_messages
  for select to authenticated
  using (
    receiver_id is null
    or user_id = (select auth.uid())
    or receiver_id = (select auth.uid())
  );

-- Gönderen her zaman oturumdaki kişi; kendine özel mesaj atılamaz
create policy "General messages insert" on public.general_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (receiver_id is null or receiver_id <> (select auth.uid()))
  );

-- 2) Mesaja ekli dosya kayıtları: sadece mesajı görebilenler görür
--    (alt sorgudaki general_messages okuması da yukarıdaki kurala tabidir)
drop policy if exists "General files read" on public.general_files;
create policy "General files read" on public.general_files
  for select to authenticated
  using (exists (select 1 from public.general_messages m where m.id = message_id));

-- 3) Depodaki dosyalar: önceki kural herkesin tüm dosyaları listeleyip
--    indirmesine izin veriyordu. Artık sadece yükleyen kişi ya da dosyanın
--    bağlı olduğu mesajı görebilenler okuyabilir.
drop policy if exists "general-files: authenticated read" on storage.objects;
create policy "general-files: authenticated read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'general-files'
    and (
      owner_id = (select auth.uid())::text
      or exists (select 1 from public.general_files f where f.file_url = name)
    )
  );

-- 4) Tepkiler: özel mesajın tepkilerini de sadece iki taraf görür/bırakır
drop policy if exists "Reactions read"       on public.message_reactions;
drop policy if exists "Reactions insert own" on public.message_reactions;

create policy "Reactions read" on public.message_reactions
  for select to authenticated
  using (
    comment_id is not null
    or exists (select 1 from public.general_messages m where m.id = message_id)
  );
create policy "Reactions insert own" on public.message_reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      comment_id is not null
      or exists (select 1 from public.general_messages m where m.id = message_id)
    )
  );

-- Kontrol
select tablename, policyname, cmd from pg_policies
where (tablename in ('general_messages', 'general_files', 'message_reactions'))
   or (tablename = 'objects' and policyname like 'general-files%')
order by tablename, policyname;
