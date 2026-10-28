"use client";

import { useEffect } from "react";
import { touchLastSeen } from "@/actions/presence";

const KEY = "em3task-last-seen-ping";
const EVERY_MS = 5 * 60 * 1000; // en fazla 5 dakikada bir kayıt

function readLast(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

// Uygulama açıldığında ve görünür hale geldiğinde (ör. telefonda arka plandan
// dönüldüğünde) "son görülme" zamanını kaydeder. Açık kalan sekmede de
// 5 dakikada bir yeniler. Hiçbir şey çizmez.
export function PresencePing() {
  useEffect(() => {
    function ping() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - readLast() < EVERY_MS) return;
      try {
        localStorage.setItem(KEY, String(now));
      } catch {}
      touchLastSeen().catch(() => {});
    }

    // İlk kayıt birkaç saniye sonra: Next.js sunucu işlemlerini sırayla
    // çalıştırır, açılışta kullanıcının ilk tıklamasının önüne geçmesin
    const first = setTimeout(ping, 4000);
    document.addEventListener("visibilitychange", ping);
    const timer = setInterval(ping, EVERY_MS);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", ping);
      clearInterval(timer);
    };
  }, []);

  return null;
}
