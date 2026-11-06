// Em3Task service worker
// Görevi sadece internet yokken açılan sayfalar için "çevrimdışı" ekranı göstermek.
// Ekip verisi içeren sayfalar (görevler, sohbet, dosyalar) bilerek ÖNBELLEĞE ALINMAZ:
// giriş gerektiren içerik cihazda saklanmasın ve her zaman güncel gelsin.

const CACHE = "em3task-offline-v4"; // ad değişti: yeni logo ikonları önbelleğe yeniden alınsın
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Sadece sayfa açılışları (navigasyon): önce ağ, ağ yoksa çevrimdışı ekranı
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Çevrimdışı ekranın kendi dosyaları (ikon, logo) önbellekten
  const url = new URL(request.url);
  if (url.origin === self.location.origin && PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
  // Diğer tüm istekler (veri, sunucu işlemleri, Supabase) normal şekilde ağa gider
});

// ---------------------------------------------------------------------
// Web Push: uygulama kapalıyken bile sunucudan gelen bildirimi göster.
// Sunucu JSON gönderir: { title, body, url, tag }
// ---------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Em3Task";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag, // aynı görevin yeni bildirimi eskisinin yerine geçer
      renotify: Boolean(data.tag),
      lang: "tr",
      data: { url: sameOriginPath(data.url) },
    }),
  );
});

// Bildirime tıklanınca: açık bir Em3Task sekmesi varsa onu o sayfaya götür, yoksa yeni pencere aç
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ("navigate" in client) return client.navigate(target);
        return;
      }
      return self.clients.openWindow(target);
    }),
  );
});

// Tarayıcı aboneliği kendiliğinden yenilerse (anahtar değişimi vb.) sayfa açılınca
// yeniden kaydedilir; burada ek bir şey yapmaya gerek yok.

// Bildirim sadece kendi sitemizdeki bir sayfaya yönlendirebilir
function sameOriginPath(url) {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) return "/";
  return url;
}
