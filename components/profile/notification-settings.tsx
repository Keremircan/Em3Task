"use client";

import { Bell, BellOff, CircleAlert } from "lucide-react";
import { usePushNotifications } from "@/components/pwa/use-push-notifications";

const NOTES: Record<string, string> = {
  denied:
    "Bildirim izni bu cihazda engellenmiş. iPhone'da Ayarlar → Bildirimler → Em3Task; bilgisayarda adres çubuğundaki kilit simgesinden izni açıp sayfayı yenileyin.",
  "ios-install":
    "iPhone/iPad'de bildirim için Em3Task'ı Safari'de Paylaş → Ana Ekrana Ekle ile kurun ve ana ekrandan açın.",
  unsupported: "Bu tarayıcı anlık bildirimleri desteklemiyor.",
};

// Bu cihaz için bildirim aç/kapat anahtarı
export function NotificationSettings() {
  const push = usePushNotifications();
  const on = push.status === "on";
  const available = push.status === "on" || push.status === "off";
  const note = NOTES[push.status];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
              on ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {on ? <Bell className="size-4.5" /> : <BellOff className="size-4.5" />}
          </span>
          <div className="min-w-0">
            <p id="push-label" className="text-sm font-semibold text-slate-900">
              Bu cihazda bildirimler
            </p>
            <p className="text-xs text-slate-500">
              {push.status === "loading"
                ? "Kontrol ediliyor…"
                : on
                  ? "Açık: görev atama, yorum, revize ve Genel mesajları bu cihaza gelir."
                  : "Kapalı: uygulama kapalıyken bu cihaza bildirim gelmez."}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="push-label"
          disabled={!available || push.busy}
          onClick={() => void (on ? push.disable() : push.enable())}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
            on ? "bg-teal-600" : "bg-slate-400"
          }`}
        >
          <span
            className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${
              on ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {(push.error || note) && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {push.error ?? note}
        </p>
      )}
      {push.notice && !push.error && (
        <p role="status" className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800">
          {push.notice}
        </p>
      )}
      <p className="text-xs text-slate-400">
        Ayar cihaza özeldir; telefonda ve bilgisayarda ayrı ayrı açılır.
      </p>
    </div>
  );
}
