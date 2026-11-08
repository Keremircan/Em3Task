import { Suspense } from "react";
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { todayKey } from "@/lib/days";
import { card } from "@/components/ui/styles";
import { SubscriptionsBoard } from "@/components/subscriptions/subscriptions-board";
import { NewSubscriptionButton } from "@/components/subscriptions/new-subscription-button";
import { SubscriptionsSync } from "@/components/subscriptions/subscriptions-sync";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Abonelikler · Em3Task" };

export default function SubscriptionsPage() {
  // SubscriptionsSync: üstteki "Yeni Ekle" ile eklenen kayıt, sunucunun yenilenmiş
  // listesi gelmeden de listede hemen görünsün
  return (
    <SubscriptionsSync>
      <PageHeader
        title="Abonelikler ve Düzenli Giderler"
        label="KİŞİSEL"
        description="Abonelikler, sunucu ve domain yenilemeleri, faturalar ve kart ödemeleri. Sadece siz görürsünüz."
        action={<NewSubscriptionButton />}
      />
      <Suspense fallback={<SubscriptionsSkeleton />}>
        <Subscriptions />
      </Suspense>
    </SubscriptionsSync>
  );
}

async function Subscriptions() {
  const userId = await getUserId();
  const supabase = await createClient();

  // RLS zaten sadece kendi satırlarını döndürür; user_id filtresi ek güvence
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
          Liste yüklenemedi. Sayfayı yenileyip tekrar deneyin.
        </p>
      )}
      {!error && <SubscriptionsBoard subscriptions={data ?? []} today={todayKey()} />}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <Lock className="size-3.5" /> Bu liste size özel; ekipteki kimse (Admin dahil) göremez.
      </p>
    </>
  );
}

function SubscriptionsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className={`${card} col-span-2 h-[84px] sm:col-span-1`} />
        <div className={`${card} h-[84px]`} />
        <div className={`${card} h-[84px]`} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className={`${card} h-48`} />
        <div className={`${card} h-48`} />
      </div>
    </div>
  );
}
