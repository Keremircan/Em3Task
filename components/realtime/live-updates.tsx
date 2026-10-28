"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Değişiklikleri dinlenen tablolar (supabase/realtime.sql + genel.sql)
const TABLES = [
  "tasks",
  "task_comments",
  "task_attachments",
  "projects",
  "profiles",
  "roles",
  "member_roles",
  "general_messages",
  "general_files",
  "removed_links",
] as const;

// Art arda gelen olayları tek yenilemede toplamak için bekleme süresi
const REFRESH_DELAY_MS = 250;
// Veri bu kadar yeniyse (sayfa az önce sunucudan geldiyse) yenileme gereksiz
const FRESH_MS = 10_000;

type Status = "connecting" | "live" | "offline";

// Satırı değiştiren kişiyi gösteren sütunlar (tablolara göre)
const ACTOR_COLUMNS = ["user_id", "uploaded_by", "removed_by"] as const;

function isMine(row: unknown, myId: string) {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return ACTOR_COLUMNS.some((col) => r[col] === myId);
}

// Ekipten biri veri değiştirdiğinde sayfanın sunucu verisini sessizce yeniler.
// router.refresh() tam sayfa yenilemesi yapmaz: açık formlar ve yazılan metinler korunur.
export function LiveUpdates() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("connecting");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Sayfa sunucudan az önce geldi: veriler taze
    let lastFresh = Date.now();

    const refreshNow = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        lastFresh = Date.now();
        router.refresh();
      }, REFRESH_DELAY_MS);
    };
    // Uygulama açılışında da tetiklenen olaylar (focus, görünür olma, ilk
    // bağlantı) taze sayfayı ikinci kez çizdirmesin
    const scheduleRefresh = () => {
      if (Date.now() - lastFresh < FRESH_MS) return;
      refreshNow();
    };

    let cancelled = false;
    let supabase: SupabaseClient<Database> | null = null;
    let channel: RealtimeChannel | null = null;

    async function connect() {
      // Supabase tarayıcı kütüphanesi büyüktür (~250 KB); sayfanın ilk açılışını
      // yavaşlatmasın diye sayfa çizildikten sonra ayrı olarak yüklenir
      const { createClient } = await import("@/utils/supabase/client");
      if (cancelled) return;
      supabase = createClient();

      // Önce oturum token'ını Realtime'a ver: token'sız kanal RLS yüzünden
      // hiçbir değişikliği alamaz (abone görünür ama olay gelmez).
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setStatus("offline");
        return;
      }
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      const myId = data.session.user.id;
      let ch = supabase.channel("cotask-live");
      for (const table of TABLES) {
        ch = ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          (payload) => {
            // Kendi yaptığımız ekleme/güncelleme: kendi işlemimiz sayfayı zaten
            // yeniledi. İkinci bir yenileme hem gereksiz hem de Next.js'in tek
            // sıra halinde çalışan işlem kuyruğunu yavaşlatır.
            if (payload.eventType !== "DELETE" && isMine(payload.new, myId)) return;
            refreshNow(); // ekipten gelen gerçek değişiklik: her zaman yenile
          },
        );
      }
      ch.subscribe((state) => {
        if (state === "SUBSCRIBED") {
          setStatus("live");
          // Bağlantı kurulana (ya da koptuktan sonra yeniden kurulana) kadar
          // kaçmış olabilecek değişiklikleri almak için bir kez yenile
          // (sayfa az önce açıldıysa veri zaten taze; yenilenmez)
          scheduleRefresh();
        }
        else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setStatus("offline");
        }
      });
      channel = ch;
    }
    // Bağlantıyı tarayıcı boşa çıkınca kur: sayfanın çizilmesiyle yarışmasın
    const hasIdle = typeof window.requestIdleCallback === "function"; // Safari'de yok
    const idle = hasIdle
      ? window.requestIdleCallback(() => connect(), { timeout: 2000 })
      : window.setTimeout(() => connect(), 300);

    // Sekme uykudayken (tarayıcı arka plan sekmelerini yavaşlatır) kaçan
    // değişiklikler için sekmeye/pencereye dönüşte bir kez yenile
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", scheduleRefresh);
    window.addEventListener("online", scheduleRefresh);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", scheduleRefresh);
      window.removeEventListener("online", scheduleRefresh);
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [router]);

  const ui = {
    live: { dot: "bg-emerald-400", text: "Canlı", title: "Değişiklikler anında görünür" },
    connecting: { dot: "bg-amber-400 animate-pulse", text: "Bağlanıyor…", title: "Canlı bağlantı kuruluyor" },
    offline: {
      dot: "bg-neutral-500",
      text: "Çevrimdışı",
      title: "Canlı bağlantı yok; sayfayı yenileyerek güncel veriyi görebilirsiniz",
    },
  }[status];

  return (
    <span
      title={ui.title}
      className="inline-flex items-center gap-1.5 text-xs text-neutral-400"
    >
      <span className={`size-1.5 rounded-full ${ui.dot}`} />
      {ui.text}
    </span>
  );
}
