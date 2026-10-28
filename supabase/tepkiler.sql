-- =====================================================================
-- Em3Task — Mesaj tepkileri (WhatsApp tarzı emoji)
--   Genel sohbet mesajlarına (message_id) ve görev yorumlarına (comment_id)
--   emoji bırakılır. Her tepki ikisinden tam olarak birine bağlıdır.
--   Aynı kişi aynı mesaja aynı emojiyi bir kez bırakabilir (tekrar basınca
--   geri alınır). Mesaj/yorum silinince tepkileri de silinir.
--   Herkes okur; herkes sadece kendi tepkisini ekler/siler.
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

create table if not exists public.message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid references public.general_messages (id) on delete cascade,
  comment_id  uuid references public.task_comments (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),
  constraint message_reactions_one_target check (num_nonnulls(message_id, comment_id) = 1),
  constraint message_reactions_message_unique unique (message_id, user_id, emoji),
  constraint message_reactions_comment_unique unique (comment_id, user_id, emoji)
);

create index if not exists message_reactions_message_idx on public.message_reactions (message_id);
create index if not exists message_reactions_comment_idx on public.message_reactions (comment_id);
create index if not exists message_reactions_user_idx    on public.message_reactions (user_id);

alter table public.message_reactions enable row level security;

revoke all on public.message_reactions from anon;
revoke update on public.message_reactions from authenticated;
grant select, insert, delete on public.message_reactions to authenticated;

drop policy if exists "Reactions read"       on public.message_reactions;
drop policy if exists "Reactions insert own" on public.message_reactions;
drop policy if exists "Reactions delete own" on public.message_reactions;

create policy "Reactions read" on public.message_reactions
  for select to authenticated using (true);
create policy "Reactions insert own" on public.message_reactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Reactions delete own" on public.message_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Canlı güncelleme: başkasının tepkisi sayfayı açık olanlara anında yansısın
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;

-- Kontrol
select policyname, cmd from pg_policies where tablename = 'message_reactions' order by policyname;
