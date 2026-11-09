"use client";

import { useSyncExternalStore } from "react";

// Açılır/kapanır bölümlerin durumu. Kapatılan bölüm bu tarayıcıda kapalı kalır
// (sayfa yenilenince de). Depolama kapalıysa sadece bu oturumda hatırlanır.
const PREFIX = "em3task-kapali:";
const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();

function read(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return memory.get(key) ?? false;
  }
}

function write(key: string, collapsed: boolean) {
  memory.set(key, collapsed);
  try {
    if (collapsed) localStorage.setItem(PREFIX + key, "1");
    else localStorage.removeItem(PREFIX + key);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCollapsed(key: string): [collapsed: boolean, toggle: () => void] {
  // Sunucuda açık varsayılır; tarayıcıda kayıtlı durum hemen uygulanır
  const collapsed = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false,
  );
  return [collapsed, () => write(key, !collapsed)];
}
