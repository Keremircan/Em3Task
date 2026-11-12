"use client"; // Hata sınırları istemci bileşeni olmalı

import { ErrorView } from "@/components/ui/error-view";

// Bir sayfanın verisi yüklenemezse: menü yerinde kalır, sadece içerik alanında
// anlaşılır bir mesaj ve "Tekrar dene" gösterilir
export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorView error={error} retry={retry} />;
}
