import "server-only";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
  read_at: string | null;
  created_at: string;
};

// Oturumdaki kullanıcının okunmamış bildirimleri ve sayısı (RLS: sadece kendisi).
// Okunan bildirim silinir; eskiden okundu işaretlenip kalmış olanlar da gösterilmez.
// Masaüstü ve mobil zil aynı istekte kullanır; tek sorgu atılır.
export const getNotifications = cache(async () => {
  const supabase = await createClient();
  const [list, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, url, read_at, created_at")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return {
    items: (list.data ?? []) as NotificationItem[],
    unread: unread.count ?? 0,
    serverNow: Date.now(),
  };
});
