"use client"; // Hata sınırları istemci bileşeni olmalı

import { ErrorView } from "@/components/ui/error-view";

// Menü/sidebar dahil tüm sayfa yüklenemezse gösterilen tam ekran mesaj
export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorView retry={retry} fullScreen />;
}
