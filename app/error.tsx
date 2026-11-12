"use client"; // Hata sınırları istemci bileşeni olmalı

import { ErrorView } from "@/components/ui/error-view";

// Menü/sidebar dahil tüm sayfa yüklenemezse gösterilen tam ekran mesaj
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} fullScreen />;
}
