-- =====================================================================
-- Em3Task — Tekrarlayan görevlerde açılış saati
--   1) recurring_tasks.run_hour: görevin açılacağı saat (Türkiye saati,
--      0-23; varsayılan 9). Eski kayıtlar 09:00'da açılmaya devam eder.
--   2) Her saat başı Supabase, Em3Task'ın /api/cron/tekrar adresini çağırır;
--      o saate kadar zamanı gelen tekrarlar açılır. Sabah 09:00 hatırlatma
--      işi (hatirlatma.sql) olduğu gibi kalır.
--
-- tekrarlayan-gorevler.sql ve hatirlatma.sql'den SONRA, Supabase SQL
-- Editor'de çalıştırın. Gizli anahtar yazmak gerekmez: hatirlatma.sql'in
-- Vault'a kaydettiği anahtar kullanılır. Tekrar çalıştırılabilir.
-- =====================================================================

-- 1) Açılış saati
alter table public.recurring_tasks
  add column if not exists run_hour smallint not null default 9
  check (run_hour between 0 and 23);

-- 2) Saatlik çağrı
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'em3task_cron_secret') then
    raise exception 'Önce hatirlatma.sql çalıştırılmalı (em3task_cron_secret bulunamadı).';
  end if;
end $$;

-- Aynı adla tekrar çalıştırılırsa mevcut zamanlama güncellenir
select cron.schedule(
  'em3task-tekrarlayan-gorevler',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://task.japarakademi.io/api/cron/tekrar',
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
select jobname, schedule, active from cron.job where jobname like 'em3task-%' order by jobname;
