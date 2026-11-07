import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { safeNextPath } from "@/lib/recovery";

// E-postadaki şifre sıfırlama bağlantısı buraya gelir.
// İki biçim desteklenir:
//   ?token_hash=…&type=recovery  → e-posta şablonumuz (supabase/eposta-sablonlari).
//       Kod burada HARCANMAZ: yeni şifre sayfasına taşınır ve kullanıcı yeni şifresini
//       kaydederken aynı istekte doğrulanır (app/sifre-yenile/actions.ts). Böylece e-posta
//       tarayıcılarının bağlantıyı önceden açması, bağlantıya iki kez tıklamak ya da
//       oturum çerezinin sayfalar arasında kaybolması kodu boşa harcamaz.
//   ?code=…  → Supabase'in varsayılan şablonu (bağlantı, sıfırlamanın istendiği
//       tarayıcıda açılmalı); doğrulanınca oturum açılır ve yeni şifre sayfasına geçilir.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  const origin = request.nextUrl.origin;

  if (tokenHash && type === "recovery") {
    const target = new URL("/sifre-yenile", origin);
    target.searchParams.set("token_hash", tokenHash);
    target.searchParams.set("type", "recovery");
    return NextResponse.redirect(target);
  }

  let ok = false;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  // Oturum cookie'leri (cookies() ile yazılanlar) bu yanıta Next.js tarafından eklenir.
  return NextResponse.redirect(new URL(ok ? next : "/sifremi-unuttum?hata=baglanti", origin));
}
