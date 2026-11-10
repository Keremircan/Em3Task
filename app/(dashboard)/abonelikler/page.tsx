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
  // SubscriptionsSync: üstteki "Yeni abonelik" ile eklenen kayıt, sunucunun yenilenmiş
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={`${card} h-[88px]`} />
        <div className={`${card} h-[88px]`} />
        <div className={`${card} h-[88px]`} />
        <div className={`${card} h-[88px]`} />
      </div>
      <div className="mt-5 flex gap-2">
        <div className="h-8 w-20 rounded-full bg-slate-200/70" />
        <div className="h-8 w-28 rounded-full bg-slate-200/70" />
        <div className="h-8 w-32 rounded-full bg-slate-200/70" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        <div className={`${card} h-56`} />
        <div className={`${card} h-56`} />
      </div>
    </div>
  );
}
