import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";

// Server Component, Server Action ve Route Handler'larda kullanılır.
// Her istekte yeniden oluşturun; global bir değişkende saklamayın.
export async function createClient() {
  // Supabase oturum kontrolünde saati (Date.now) okur; önceden hazırlanan
  // (prerender/prefetch) aşamada çalışmasın, sadece istek anında çalışsın.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component içinden cookie yazılamaz; oturum yenilemesini
            // proxy.ts zaten yaptığı için bu hata güvenle yok sayılabilir.
          }
        },
      },
    },
  );
}
