"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deletePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/actions/push-notifications";

// Bu cihazdaki bildirim durumu
export type PushStatus =
  | "loading"
  | "unsupported" // tarayıcı desteklemiyor
  | "ios-install" // iPhone/iPad: önce "Ana Ekrana Ekle" ile uygulama olarak kurulmalı
  | "denied" // kullanıcı izni engelledi (tarayıcı ayarından açılır)
  | "off"
  | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// Kullanıcı bu cihazda bildirimleri kapattıysa hatırla. iOS'ta abonelik iptali bazen
// sessizce başarısız olur; bu işaret olmadan uygulama açılışta aboneliği görüp
// bildirimleri kendiliğinden yeniden açardı.
const DISABLED_KEY = "cotask-push-disabled";
const ENDPOINT_KEY = "cotask-push-endpoint";

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Kullanıcı bu cihazda bildirimleri bilerek mi kapattı? (hatırlatma bandı ısrar etmesin)
export function pushDisabledHere(): boolean {
  return read(DISABLED_KEY) !== null;
}

// Aynı sayfada birden çok yerde kullanılır (hatırlatma bandı + Profil anahtarı):
// birinde açılıp kapanınca diğeri de güncellensin
const statusListeners = new Set<(status: PushStatus) => void>();
function publish(status: PushStatus) {
  statusListeners.forEach((listener) => listener(status));
}

// Takılan bir adım arayüzü kilitlemesin
function withTimeout<T>(promise: Promise<T>, ms = 6000): Promise<T | undefined> {
  return Promise.race([promise, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function toInput(sub: PushSubscription) {
  const json = sub.toJSON();
  return { endpoint: json.endpoint ?? "", keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } };
}

function detect(): PushStatus | null {
  if (typeof window === "undefined") return "loading";
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIos && !standalone ? "ios-install" : "unsupported";
  if (!VAPID_PUBLIC_KEY) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return null; // destekleniyor; abonelik durumuna bakılacak
}

async function getRegistration() {
  // Service worker canlıda sayfa açılışında kaydedilir; değilse (ör. geliştirme) burada kaydet
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Bilgi mesajı birkaç saniye sonra kendiliğinden kaybolur
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    statusListeners.add(setStatus);
    return () => {
      statusListeners.delete(setStatus);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const early = detect();
      if (early) return setStatus(early);
      const registration = await navigator.serviceWorker.getRegistration("/");
      const sub = await registration?.pushManager.getSubscription();
      if (cancelled) return;
      if (sub && read(DISABLED_KEY)) {
        // Kapatılmıştı ama tarayıcı aboneliği bırakmamış: tekrar iptal et, kaydetme
        setStatus("off");
        deletePushSubscription(sub.endpoint).catch(() => {});
        sub.unsubscribe().catch(() => {});
      } else if (sub && Notification.permission === "granted") {
        setStatus("on");
        // Aboneliği oturumdaki kullanıcıyla eşle (cihaz başka hesapla kullanılmış olabilir)
        store(ENDPOINT_KEY, sub.endpoint);
        savePushSubscription(toInput(sub)).catch(() => {});
      } else {
        setStatus("off");
      }
    })().catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await getRegistration();
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
        }));
      const result = await savePushSubscription(toInput(sub));
      if (result.error) {
        await sub.unsubscribe().catch(() => {});
        setError(result.error);
        setStatus("off");
        return;
      }
      store(DISABLED_KEY, null);
      store(ENDPOINT_KEY, sub.endpoint);
      publish("on");
      setNotice("Bu cihazda bildirimler açıldı. Birkaç saniye içinde deneme bildirimi gelecek.");
      await sendTestPush();
    } catch {
      setError("Bildirimler açılamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Kapatma anında ekrana yansır; sunucu kaydı ve tarayıcı aboneliği arkada temizlenir.
  const disable = useCallback(async () => {
    setError(null);
    publish("off");
    setNotice("Bu cihazda bildirimler kapatıldı.");
    const result = await disablePushOnThisDevice();
    if (result.error) setError(result.error);
  }, []);

  return {
    status,
    busy,
    error,
    notice,
    enable,
    disable,
    clearError: () => {
      setError(null);
      setNotice(null);
    },
  };
}

// Bu cihazda bildirimleri kapatır (Profil sayfası ve güvenli çıkış kullanır).
// Sunucu kaydı silinince, tarayıcı aboneliği iptal edilemese bile bildirim gelmez.
export async function disablePushOnThisDevice(): Promise<{ error: string | null }> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return { error: null };
  store(DISABLED_KEY, "1");
  try {
    const registration = await withTimeout(navigator.serviceWorker.getRegistration("/"));
    const sub = await withTimeout(registration?.pushManager.getSubscription() ?? Promise.resolve(null));
    const endpoint = sub?.endpoint ?? read(ENDPOINT_KEY);
    const [result] = await Promise.all([
      endpoint ? withTimeout(deletePushSubscription(endpoint)) : Promise.resolve(undefined),
      sub ? withTimeout(sub.unsubscribe()).catch(() => undefined) : Promise.resolve(undefined),
    ]);
    if (result?.error) return { error: result.error };
    store(ENDPOINT_KEY, null);
  } catch {
    // Açılışta tekrar denenir
  }
  return { error: null };
}
