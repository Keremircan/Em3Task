# Em3Task'i Hostinger VPS'e taşıma (Japar Akademi ile aynı sunucu)

> **Bu dosyadaki sunucu komutlarını Japar Akademi ajanına göstermeden çalıştırmayın.**
> Sunucuya Nginx, PM2 ya da başka bir panel KURULMAZ: 80/443 Japar'ın Caddy'sinde
> ve öyle kalır. Em3Task hiçbir port açmaz.

## Nasıl çalışır

```
İnternet ──443──▶ Caddy (Japar compose'u) ──edge ağı──▶ em3task-web:3000 (bu klasör)
                    │
                    └── Japar'ın default ağı (app, worker, postgres, garage) — Em3Task buraya bağlanmaz
```

- İmaj GitHub Actions'ta derlenir (`.github/workflows/docker-image.yml`) ve
  `ghcr.io/keremircan/em3task` adıyla yayınlanır. Sunucu derleme yapmaz, sadece çeker.
- Veritabanı, giriş ve dosyalar Supabase'te kalır; sunucuda veri tutulmaz.
- Sunucuda iki dosya olur, ikisi de Japar klasörünün **dışında**:
  - `/opt/em3task/compose.yml` (bu klasördeki `compose.yml`) ve `/opt/em3task/.env`
  - `/opt/caddy-sites/em3task.caddy` (bu klasördeki `em3task.caddy`)

## 0. Önce Japar tarafında olması gerekenler (Japar ajanı yapar)

Japar'ın bir sonraki yayınında gelecek; bunlar olmadan Em3Task başlatılmaz:

1. Japar compose'unda sabit adlı `edge` ağı (`networks: edge: name: edge`), yalnızca caddy bağlı.
2. Japar Caddyfile'ının sonunda `import /etc/caddy/sites/*.caddy`.
3. caddy servisine `/opt/caddy-sites:/etc/caddy/sites:ro` bağlaması.

Kontrol (sadece okur, bir şey değiştirmez):

```bash
docker network inspect edge --format '{{range .Containers}}{{.Name}} {{end}}'
```

Çıktıda yalnızca Japar'ın caddy kapsayıcısı görünmeli.

## 1. Bir kez yapılacak hazırlık (bilgisayardan)

- **Derleme değerleri.** Profil ayarlarında değil, **reponun kendi** Settings sekmesinde
  (repo sayfasında üstteki Code / Issues / … sırasının sonundaki Settings):
  sol menü → Security başlığı → Secrets and variables → Actions → **Variables** sekmesi →
  New repository variable. Doğrudan adres:
  `https://github.com/Keremircan/Em3Task/settings/variables/actions`
  Üç değer eklenir (Netlify'dakilerle aynı, herkese açık değerler):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- **Actions → Docker imajı → Run workflow** ile ilk imaj derlenir; yeşil tik beklenir.
- İmaj gizli (private) kalabilir; o zaman sunucu bir kez giriş yapar (adım 3). Herkese açık
  yapmak isterseniz: GitHub profil → Packages → em3task → Package settings → Change visibility.
- **DNS:** `japarakademi.io` alan adının DNS panelinde `task` için A kaydı → VPS'in IP adresi
  (Japar sitesinin A kaydındaki IP ile aynı). Japar'ın mevcut kayıtlarına dokunulmaz.

DNS'in yayıldığını kontrol:

```bash
nslookup task.japarakademi.io
```

## 2. Sunucu kaynakları

10 Kasım 2026'da ölçülen durum (Japar boştayken):

| | Toplam | Kullanılan | Boş |
|---|---|---|---|
| Bellek | 7,7 GB | 1,2 GB (Japar kapsayıcıları ≈ 570 MB) | 6,5 GB |
| İşlemci | 2 çekirdek | boşta ≈ %1 | |
| Disk | 96 GB | 23 GB | 74 GB |

- **Bellek ve disk yeterli.** Em3Task en fazla 768 MB kullanabilir (`compose.yml`), imajı tahminen 200 MB civarı.
- **Dar olan işlemci:** Japar 4 çekirdek öneriyor, sunucuda 2 var. Japar'ın worker'ı video
  işlerken (ffmpeg) iki çekirdeği de doldurabilir; o dakikalarda iki site de yavaşlar.
  Em3Task en fazla 1 çekirdek kullanabilir ve normalde boşta bekler, yani asıl yük ondan gelmez.

Kurulumdan hemen önce tekrar bakılır; `available` 2 GB'ın altındaysa durup Japar ajanıyla konuşun:

```bash
free -h
docker stats --no-stream
```

## 3. Kurulum (sunucuda, Japar ajanının onayından sonra)

```bash
sudo mkdir -p /opt/em3task /opt/caddy-sites
```

Bu klasördeki `compose.yml` → `/opt/em3task/compose.yml` olarak kopyalanır
(scp ya da `nano` ile yapıştırarak). Sonra ortam dosyası:

```bash
sudo nano /opt/em3task/.env
```

İçeriği `env.example`'daki adlarla, değerleri Netlify → Site configuration →
Environment variables'tan alarak doldurulur. Sonra yalnızca sahibinin okuyabileceği hale getirilir:

```bash
sudo chmod 600 /opt/em3task/.env
```

İmaj gizliyse bir kez giriş (GitHub → Settings → Developer settings → Personal access
tokens → yalnızca `read:packages` izinli bir token; şifre sorulunca token yapıştırılır):

```bash
docker login ghcr.io -u Keremircan
```

Em3Task'i başlatma:

```bash
cd /opt/em3task
docker compose pull
docker compose up -d
docker compose ps
```

`STATUS` sütununda yarım dakika içinde `healthy` görünmeli. Görünmezse:

```bash
docker compose logs --tail=100
```

## 4. Caddy'ye site ekleme

`em3task.caddy` dosyası (alan adı düzeltilmiş haliyle) → `/opt/caddy-sites/em3task.caddy`.

Önce yazımı kontrol, sonra yeniden yükleme (Japar'ın verdiği komut; siteler kapanmaz):

```bash
cd /opt/japar-akademi
C="docker compose -f docker/compose.prod.yml --env-file docker/.env.production"
$C exec -w /etc/caddy caddy caddy validate --config /etc/caddy/Caddyfile
$C exec -w /etc/caddy caddy caddy reload
```

Caddy sertifikayı kendisi alır (ilk açılışta birkaç saniye sürebilir).

## 5. Deneme (Netlify hâlâ yayında, ekip etkilenmez)

`https://task.japarakademi.io` üzerinde:

- [ ] Giriş sayfası açılıyor, kilit simgesi var (geçerli HTTPS)
- [ ] Giriş yapılıyor, ana sayfa ve görevler geliyor
- [ ] Görev açma, yorum, dosya ekleme (10 MB'a kadar) çalışıyor
- [ ] Canlı güncelleme: iki sekmede aynı görev, birindeki değişiklik diğerine düşüyor
- [ ] Japar Akademi sitesi hâlâ normal açılıyor

Şifre sıfırlama ve bildirimler ancak adım 6'dan sonra yeni adreste çalışır.

## 6. Geçiş günü

Sırayla:

1. **Supabase → Authentication → URL Configuration:**
   - Site URL: `https://task.japarakademi.io`
   - Redirect URLs'e ekle: `https://task.japarakademi.io/**`
   (Netlify adresini geçiş bitene kadar listede bırakın.)

2. **Hatırlatma zamanlayıcısının adresi.** Supabase → SQL Editor'da çalıştırılır.
   Gizli anahtar Vault'ta zaten duruyor; sadece adres değişir:

   ```sql
   select cron.schedule(
     'em3task-teslim-hatirlatma',
     '0 6 * * *',
     $$
     select net.http_post(
       url := 'https://task.japarakademi.io/api/cron/hatirlatma',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'em3task_cron_secret')
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 15000
     );
     $$
   );
   select jobname, schedule, active from cron.job where jobname = 'em3task-teslim-hatirlatma';
   ```

   Repodaki `supabase/hatirlatma.sql` dosyasındaki adres de aynı şekilde güncellenir.

3. **Netlify'ı yeni adrese yönlendirme.** `netlify.toml` dosyasının sonuna eklenip gönderilir:

   ```toml
   [[redirects]]
     from = "/*"
     to = "https://task.japarakademi.io/:splat"
     status = 301
     force = true
   ```

4. **Eski bildirim abonelikleri.** Telefon bildirimleri adrese bağlıdır; eski adresteki
   abonelikler yeni siteden çalışmaz. Supabase SQL Editor'da:

   ```sql
   delete from public.push_subscriptions;
   ```

5. **Ekibe duyuru:** yeni adres; ana ekrana eklenen uygulama silinip yeni adresten tekrar
   eklenmeli; bildirimler profilden yeniden açılmalı.

Ertesi sabah (06:00 UTC = 09:00 TR) hatırlatmanın gittiğini kontrol:

```sql
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'em3task-teslim-hatirlatma')
order by start_time desc limit 3;
```

## Güncelleme (her yeni sürümde)

`master`'a gönderilen her değişiklikten sonra Actions imajı derler (yaklaşık 3–5 dk). Sonra sunucuda:

```bash
cd /opt/em3task
docker compose pull
docker compose up -d
docker image prune -f
```

Japar'a dokunmaz; Caddy'nin yeniden yüklenmesi gerekmez.

## Sorun çıkarsa

**Önceki sürüme dönmek:** GitHub → Packages → em3task'te önceki `sha-…` etiketi seçilir,
`/opt/em3task/compose.yml`'deki `:latest` geçici olarak o etiketle değiştirilir:

```bash
cd /opt/em3task
docker compose up -d
```

**Netlify'a geri dönmek** (geçişten sonra): `netlify.toml`'daki yönlendirme silinip
gönderilir, adım 6.1 ve 6.2 eski adresle tekrarlanır. Netlify sitesi bu süreçte hiç
kapatılmadığı için anında döner.

**Em3Task'i sunucudan tamamen kaldırmak** (Japar'ı etkilemez):

```bash
cd /opt/em3task
docker compose down
sudo rm /opt/caddy-sites/em3task.caddy
```

Ardından adım 4'teki `caddy reload` komutları.
