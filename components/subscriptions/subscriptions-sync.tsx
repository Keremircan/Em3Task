"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Subscription } from "@/types/database";

// Kaydet / sil sonrası sunucunun yenilenmiş listesi birkaç yüz ms sonra gelir.
// Bu arada liste eski halini göstermesin diye son kaydedilen satırlar ve silinen
// kayıtların kimlikleri burada tutulur; liste bunları sunucu verisinin üstüne uygular.
type Sync = {
  recent: Record<string, Subscription>;
  removed: ReadonlySet<string>;
  remember: (s: Subscription) => void;
  forget: (id: string) => void;
};

const SyncContext = createContext<Sync | null>(null);

export function SubscriptionsSync({ children }: { children: ReactNode }) {
  const [recent, setRecent] = useState<Record<string, Subscription>>({});
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());

  const value = useMemo<Sync>(
    () => ({
      recent,
      removed,
      remember: (s) => setRecent((r) => ({ ...r, [s.id]: s })),
      forget: (id) => setRemoved((set) => new Set(set).add(id)),
    }),
    [recent, removed],
  );

  return <SyncContext value={value}>{children}</SyncContext>;
}

export function useSubscriptionsSync() {
  return useContext(SyncContext);
}

// Sunucu listesi + henüz yansımamış son kayıtlar (daha yeni olan kazanır)
export function mergeRecent(server: Subscription[], recent: Record<string, Subscription>): Subscription[] {
  const byId = new Map(server.map((s) => [s.id, s]));
  for (const s of Object.values(recent)) {
    const current = byId.get(s.id);
    if (!current || current.updated_at < s.updated_at) byId.set(s.id, s);
  }
  return [...byId.values()];
}
