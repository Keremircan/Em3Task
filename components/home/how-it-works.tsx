"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { CircleHelp, X } from "lucide-react";
import { card } from "@/components/ui/styles";

// "Nasıl çalışır?" kartı: yeni üyeler için. Kapatılınca bu tarayıcıda gizli kalır,
// altta küçük bir bağlantıyla yeniden açılabilir.
const KEY = "em3task-nasil-calisir";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "gizli";
  } catch {
    return false;
  }
}

function write(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(KEY, "gizli");
    else localStorage.removeItem(KEY);
  } catch {
    // depolama kapalıysa sadece bu oturumda gizlenmez; sorun değil
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function HowItWorks({ className = "" }: { className?: string }) {
  // Sunucuda gizli varsayılır: kapatan kişi kartın bir an görünüp kaybolmasını görmesin
  const hidden = useSyncExternalStore(subscribe, read, () => true);

  if (hidden) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => write(false)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-teal-700"
        >
          <CircleHelp className="size-3.5" /> Nasıl çalışır?
        </button>
      </div>
    );
  }

  return (
    <section className={`${card} p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900">Nasıl çalışır?</h2>
        <button
          type="button"
          onClick={() => write(true)}
          aria-label="Nasıl çalışır kartını gizle"
          title="Gizle"
          className="-mr-1.5 flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" />
        </button>
      </div>
      <ol className="mt-3 grid grid-cols-1 gap-3 text-[13.5px] text-slate-600 md:grid-cols-2">
        <Step n={1} title="İş ata">
          Atadığım Görevler’den projesini ve kişisini seçerek işi oluşturun. Görev “Onay Bekliyor”
          olarak başlar.
        </Step>
        <Step n={2} title="Kabul et">
          Görevi alan kişi Görevlerim’den kabul eder, görev “Yapılıyor” olur. “Herkes”e atanan işi
          ilk kabul eden üstlenir.
        </Step>
        <Step n={3} title="Kontrole gönder">
          İş bitince sadece görevi alan kişi “Kontrol”e gönderir.
        </Step>
        <Step n={4} title="Tamamla">
          Sadece görevi atayan kişi işi “Tamamlandı” yapar. Ekip her aşamada görev altında konuşur,
          dosya ve link paylaşır.
        </Step>
      </ol>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="rounded-xl bg-slate-50 p-4">
      <p className="flex items-center gap-2 font-bold text-slate-900">
        <span className="flex size-6 items-center justify-center rounded-full bg-teal-600 text-xs text-white">
          {n}
        </span>
        {title}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed">{children}</p>
    </li>
  );
}
