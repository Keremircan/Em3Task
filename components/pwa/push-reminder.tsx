"use client";

import { useState } from "react";
import { BellRing, X } from "lucide-react";
import { pushDisabledHere, usePushNotifications } from "./use-push-notifications";

// Bu cihazda bildirim açık değilse sayfanın üstünde çıkan hatırlatma.
// Bildirimi bilerek kapatmış (Profil'den) ya da tarayıcıdan engellemiş kişiye çıkmaz;
// "Daha sonra" denirse bir hafta gizlenir.
const SNOOZE_KEY = "cotask-push-reminder-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}

export function PushReminder() {
  const push = usePushNotifications();
  // İlk çizimde bildirim durumu "yükleniyor" olduğundan bant zaten görünmez;
  // bu değerin sunucuda ve tarayıcıda farklı olması çıktıyı değiştirmez.
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && (snoozed() || pushDisabledHere()));

  function later() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {}
    setHidden(true);
  }

  // Az önce bu banttan açıldıysa kısa bir onay göster
  if (push.status === "on" && push.notice) {
    return (
      <p role="status" className={`${bar} border-teal-200 bg-teal-50 text-teal-900`}>
        <BellRing className="size-4.5 shrink-0 text-teal-700" />
        <span className="min-w-0 flex-1">{push.notice}</span>
      </p>
    );
  }

  if (hidden) return null;
  const canEnable = push.status === "off";
  if (!canEnable && push.status !== "ios-install") return null;

  return (
    <aside aria-label="Bildirim hatırlatması" className={`${bar} border-teal-200 bg-teal-50 text-teal-900`}>
      <BellRing className="size-4.5 shrink-0 text-teal-700" />
      <p className="min-w-0 flex-1">
        {push.error ??
          (canEnable
            ? "Bu cihazda bildirimler kapalı. Size görev atandığında ya da yazıldığında haberiniz olsun."
            : "iPhone'da bildirim almak için Em3Task'ı ana ekrana ekleyin: Safari'de Paylaş → Ana Ekrana Ekle.")}
      </p>
      {canEnable && (
        <button
          type="button"
          disabled={push.busy}
          onClick={() => void push.enable()}
          className="inline-flex h-8 shrink-0 items-center rounded-md bg-teal-600 px-3 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {push.busy ? "Açılıyor…" : "Bildirimleri aç"}
        </button>
      )}
      <button
        type="button"
        onClick={later}
        aria-label="Hatırlatmayı bir hafta gizle"
        title="Bir hafta gizle"
        className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-teal-800 transition hover:bg-teal-100"
      >
        <X className="size-4" />
      </button>
    </aside>
  );
}

const bar = "mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-2.5 text-sm";
