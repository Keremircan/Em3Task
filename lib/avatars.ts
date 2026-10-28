// Profil fotoğrafları: herkese açık 'avatars' deposu.
// Her fotoğraf iki boyutta saklanır (WebP desteklenmezse .jpg):
//   <kullanıcı-id>/<rastgele-id>.webp     → 256 px, listelerde (hızlı)
//   <kullanıcı-id>/<rastgele-id>-lg.webp  → en fazla 1024 px, büyütme penceresinde
export const AVATARS_BUCKET = "avatars";
export const AVATAR_SIZE = 256;
export const AVATAR_LARGE_SIZE = 1024;
export const MAX_AVATAR_SOURCE_BYTES = 15 * 1024 * 1024; // seçilen orijinal dosya

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// Küçük boyutun yolu (profiles.avatar_url bunu gösterir)
export function isOwnAvatarPath(path: string, userId: string): boolean {
  return new RegExp(`^${userId}/${UUID}\.(webp|jpg)$`).test(path);
}

// Küçük boyutun yolundan/adresinden büyük boyutunkini üretir
export function largeAvatarPath(pathOrUrl: string): string {
  return pathOrUrl.replace(/\.(webp|jpg)(\?.*)?$/, "-lg.$1$2");
}

// Herkese açık adresten depo yolunu çıkarır (eski fotoğrafı silmek için)
export function avatarPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATARS_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}
