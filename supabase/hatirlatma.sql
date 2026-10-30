-- =====================================================================
-- Em3Task — Teslim tarihi hatırlatmaları
--   1) task_reminders: hangi göreve hangi hatırlatmanın gittiğini tutar
--      (aynı hatırlatma iki kez gitmesin). Sadece sunucu okur/yazar.
--      Teslim tarihi değişince o görevin kayıtları silinir.
--   2) Her sabah 09:00'da (Türkiye, UTC 06:00) Supabase, Em3Task'ın
--      /api/cron/hatirlatma adresini gizli anahtarla çağırır.
--
-- ÇALIŞTIRMADAN ÖNCE: aşağıdaki __CRON_SECRET__ yerine Netlify'daki
-- CRON_SECRET değerini yazın (en az 32 karakter). Anahtar Supabase Vault'ta
-- şifreli saklanır; bu dosyaya gerçek anahtarı yazıp git'e göndermeyin.
-- Tekrar çalıştırılabilir.
-- =====================================================================

-- 1) Gönderilen hatırlatmalar
create table if not exists public.task_reminders (
  task_id  uuid not null references public.tasks (id) on delete cascade,
  kind     text not null check (kind in ('tomorrow', 'today', 'overdue')),
  sent_at  timestamptz not null default now(),
  primary key (task_id, kind)
);

alter table public.task_reminders enable row level security;
revoke all on public.task_reminders from anon, authenticated;
-- Politika yok: sadece service role (sunucu) erişir.

create or replace function public.reset_task_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.due_date is distinct from old.due_date then
    delete from public.task_reminders where task_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.reset_task_reminders() from public, anon, authenticated;

drop trigger if exists tasks_reset_reminders on public.tasks;
create trigger tasks_reset_reminders
  after update of due_date on public.tasks
  for each row execute function public.reset_task_reminders();

-- 2) Zamanlanmış çağrı
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
grant usage on schema cron to postgres;

do $$
declare
  secret text := '__CRON_SECRET__';
  existing uuid;
begin
  if length(secret) < 32 or secret like '\_\_CRON%' then
    raise exception 'Önce __CRON_SECRET__ yerine CRON_SECRET değerini yazın (en az 32 karakter).';
  end if;
  select id into existing from vault.secrets where name = 'em3task_cron_secret';
  if existing is null then
    perform vault.create_secret(secret, 'em3task_cron_secret', 'Em3Task hatırlatma çağrısı anahtarı');
  else
    perform vault.update_secret(existing, secret);
  end if;
end $$;

-- Aynı adla tekrar çalıştırılırsa mevcut zamanlama güncellenir
select cron.schedule(
  'em3task-teslim-hatirlatma',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://em3task.netlify.app/api/cron/hatirlatma',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'em3task_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

-- Kontrol
select jobname, schedule, active from cron.job where jobname = 'em3task-teslim-hatirlatma';
