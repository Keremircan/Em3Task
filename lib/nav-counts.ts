import "server-only";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";

// Menüdeki rozetler: sizden işlem bekleyen görev sayıları.
//   accept: kabul etmenizi bekleyen (size ya da "Herkes"e atanmış, Kabul bekliyor)
//   review: kontrolünüzü bekleyen (sizin atadığınız, Kontrol'de)
// Aynı istekte sidebar ve alt sekme çubuğu çağırır; sorgu bir kez atılır.
export type NavCounts = { accept: number; review: number };

export const getNavCounts = cache(async (): Promise<NavCounts> => {
  const userId = await getUserId();
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };

  const [accept, review] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", head)
      .eq("status", "pending")
      .or(`assigned_to.eq.${userId},assigned_to.is.null`),
    supabase.from("tasks").select("id", head).eq("created_by", userId).eq("status", "review"),
  ]);

  return { accept: accept.count ?? 0, review: review.count ?? 0 };
});
