import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

// Giriş gerektirmeyen yollar. /api/cron: zamanlanmış görevler (oturum yerine
// gizli anahtarla korunur, bkz. app/api/cron)
const PUBLIC_PATHS = ["/login", "/api/cron"];

// Her istekte oturumu yeniler; giriş yoksa /login'e yönlendirir.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // Oturum cookie'si içeren yanıtların CDN'de önbelleğe alınmasını engeller
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Not: createServerClient ile getClaims arasına kod eklemeyin.
  // getClaims JWT'yi doğrular ve gerekiyorsa token'ı yeniler.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isLoggedIn && !isPublic) {
    return redirectWithCookies(request, response, "/login");
  }

  if (isLoggedIn && pathname === "/login") {
    return redirectWithCookies(request, response, "/");
  }

  return response;
}

// Yönlendirme yaparken yenilenmiş oturum cookie'lerini kaybetmemek için
function redirectWithCookies(
  request: NextRequest,
  from: NextResponse,
  path: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
