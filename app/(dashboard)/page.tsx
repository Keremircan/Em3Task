import { Suspense } from "react";
import { ActivityFeed, ActivityFeedSkeleton } from "@/components/home/activity-feed";
import { HowItWorks } from "@/components/home/how-it-works";
import {
  FocusList,
  FocusListSkeleton,
  TodayHeader,
  TodayHeaderSkeleton,
  UpcomingPayments,
} from "@/components/home/today";

// Ana sayfa "Bugün" odaklı: önce sizi bekleyen işler, sonra ekibin son hareketleri.
// Bölümler ayrı ayrı yüklenir (biri yavaşsa diğerleri beklemez).
export default function HomePage() {
  return (
    <>
      <Suspense fallback={<TodayHeaderSkeleton />}>
        <TodayHeader />
      </Suspense>

      {/* Geniş ekranda solda iş listesi, sağda ödemeler + etkinlikler.
          Dar ekranda sıra: iş listesi → ödemeler + etkinlikler → nasıl çalışır */}
      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* Sol sütun: dar ekranda "contents" ile kendi çocukları ızgaraya dağılır (sıralama için) */}
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-4">
          <div className="order-1 min-w-0">
            <Suspense fallback={<FocusListSkeleton />}>
              <FocusList />
            </Suspense>
          </div>
          <HowItWorks className="order-3" />
        </div>

        <div className="order-2 min-w-0 xl:order-none">
          <Suspense fallback={null}>
            <UpcomingPayments />
          </Suspense>
          <Suspense fallback={<ActivityFeedSkeleton />}>
            <ActivityFeed />
          </Suspense>
        </div>
      </div>
    </>
  );
}
