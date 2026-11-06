import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { safeNextPath } from "@/lib/recovery";

// E-postadaki şifre sıfırlama bağlantısı buraya gelir.
// İki biçim desteklenir:
//   ?token_hash=…&type=recovery  → e-posta şablonu bu adresi doğrudan kullanırsa
//                                   (her cihazda çalışır; önerilen)
//   ?code=…                      → Supabase'in varsayılan şablonu (bağlantı, sıfırlamanın
//                                   istendiği tarayıcıda açılmalı)
// Doğrulanınca oturum açılır ve yeni şifre sayfasına geçilir.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  // Tam adresle yönlendirilir: göreli adreste Netlify gelen sorguyu (token_hash dahil)
  // hedefe ekliyor, kullanılmış kod adres çubuğunda ve tarayıcı geçmişinde kalıyordu.
  // Oturum cookie'leri (cookies() ile yazılanlar) bu yanıta Next.js tarafından eklenir.
  return NextResponse.redirect(new URL(ok ? next : "/sifremi-unuttum?hata=baglanti", request.nextUrl.origin));
}
