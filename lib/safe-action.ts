import { unstable_rethrow } from "next/navigation";

export const NETWORK_ERROR =
  "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";

// Tarayıcıdan çağrılan sunucu işlemleri için güvenlik ağı.
// Sunucu işlemleri hatayı { error } olarak döndürür; ama bağlantı koparsa ya da
// sunucu beklenmedik bir hata verirse çağrı istisna fırlatır. Bu durumda buton
// "kaydediliyor"da takılı kalmasın ve kullanıcı anlamlı bir mesaj görsün diye
// istisna { error } sonucuna çevrilir. Next.js'in kendi yönlendirmeleri
// (ör. oturum düşünce /login) yakalanmaz, normal şekilde çalışır.
export async function safe<T extends { error: string | null }>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (err) {
    unstable_rethrow(err);
    // Hata durumunda diğer alanlar (taskId vb.) kullanılmaz: çağıranlar önce error'a bakar
    return { error: NETWORK_ERROR } as T;
  }
}
