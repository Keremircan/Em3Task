-- =====================================================================
-- Em3Task — Güvenlik sıkılaştırması
--   Supabase güvenlik denetiminin (Advisors → Security) uyarısı:
--   handle_new_user() yeni üye açılınca profil satırını oluşturan bir
--   tetikleyici fonksiyonudur; ama API üzerinden (rpc/handle_new_user)
--   girişsiz kullanıcıya bile "çalıştırılabilir" görünüyordu. Tetikleyici
--   dışında çağrılamaz, yine de yetkiyi kaldırıyoruz.
--
--   Bilerek açık bırakılanlar (uygulama ve erişim kuralları kullanıyor):
--     is_admin()               → giriş yapmış üyeler
--     can_edit_checklist(uuid) → giriş yapmış üyeler
--
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- =====================================================================

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Kontrol: anon ve authenticated satırda görünmemeli
select proname, coalesce(proacl::text, '(varsayılan: herkese açık)') as yetkiler
from pg_proc
where pronamespace = 'public'::regnamespace and proname = 'handle_new_user';
