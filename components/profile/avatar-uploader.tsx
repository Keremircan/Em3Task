"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { setAvatar } from "@/actions/profile";
import { Avatar } from "@/components/ui/avatar";
import { ZoomableAvatar } from "@/components/ui/avatar-lightbox";
import { smallDangerButton, smallGhostButton } from "@/components/ui/styles";
import {
  AVATARS_BUCKET,
  AVATAR_LARGE_SIZE,
  AVATAR_SIZE,
  MAX_AVATAR_SOURCE_BYTES,
  largeAvatarPath,
} from "@/lib/avatars";
import { safe } from "@/lib/safe-action";

// Seçilen resmi ortadan kare kırpıp istenen boyuta küçültür.
// Tarayıcı WebP üretemiyorsa (eski Safari) JPEG'e düşer.
async function toSquareImage(
  bitmap: ImageBitmap,
  size: number,
  ext?: "webp" | "jpg",
): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(size, side); // küçük resmi büyütme
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  if (ext !== "jpg") {
    const webp = await encode("image/webp");
    if (webp?.type === "image/webp") return { blob: webp, ext: "webp" };
  }
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("encode");
  return { blob: jpeg, ext: "jpg" };
}

export function AvatarUploader({
  userId,
  name,
  avatarUrl,
}: {
  userId: string;
  name: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // Yükleme sürerken seçilen resim hemen görünür
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = preview === undefined ? avatarUrl : preview;

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Lütfen bir resim dosyası seçin.");
    if (file.size > MAX_AVATAR_SOURCE_BYTES) return setError("Resim en fazla 15 MB olabilir.");

    setBusy(true);
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    try {
      // İki boyut: listeler için küçük, büyütme penceresi için büyük
      const bitmap = await createImageBitmap(file);
      const small = await toSquareImage(bitmap, AVATAR_SIZE);
      const large = await toSquareImage(bitmap, AVATAR_LARGE_SIZE, small.ext);
      bitmap.close();
      const path = `${userId}/${crypto.randomUUID()}.${small.ext}`;
      const supabase = createClient();
      const opts = { upsert: false, cacheControl: "31536000" };
      const [up1, up2] = await Promise.all([
        supabase.storage
          .from(AVATARS_BUCKET)
          .upload(largeAvatarPath(path), large.blob, { ...opts, contentType: large.blob.type }),
        supabase.storage.from(AVATARS_BUCKET).upload(path, small.blob, { ...opts, contentType: small.blob.type }),
      ]);
      if (up1.error || up2.error) {
        await supabase.storage.from(AVATARS_BUCKET).remove([path, largeAvatarPath(path)]);
        throw new Error("upload");
      }

      const result = await safe(setAvatar(path));
      if (result.error) throw new Error(result.error);
      // Geçici önizlemeden kalıcı adrese geç (önizleme adresi birazdan silinir)
      setPreview(result.url ?? undefined);
      router.refresh();
    } catch (e) {
      setPreview(undefined);
      const message = e instanceof Error ? e.message : "";
      setError(
        message && !["upload", "encode", "canvas"].includes(message)
          ? message
          : "Fotoğraf yüklenemedi. Başka bir resim deneyin.",
      );
    } finally {
      URL.revokeObjectURL(localUrl);
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    setPreview(null);
    const result = await safe(setAvatar(null));
    if (result.error) {
      setPreview(undefined);
      setError(result.error);
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative">
        {/* Yükleme sürerken (geçici önizleme) büyütülemez */}
        {busy ? (
          <Avatar name={name} src={shown} size="lg" />
        ) : (
          <ZoomableAvatar name={name} src={shown} size="lg" />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35">
            <LoaderCircle className="size-6 animate-spin text-white" />
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label="Profil fotoğrafını değiştir"
          className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full border-2 border-white bg-teal-600 text-white shadow transition hover:bg-teal-700 disabled:opacity-60"
        >
          <Camera className="size-4" />
        </button>
      </div>
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={smallGhostButton}
          >
            <Camera className="size-3.5" /> {shown ? "Fotoğrafı değiştir" : "Fotoğraf ekle"}
          </button>
          {shown && (
            <button type="button" onClick={remove} disabled={busy} className={smallDangerButton}>
              <Trash2 className="size-3.5" /> Kaldır
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">JPG, PNG veya WebP. Kare olarak kırpılır.</p>
        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-rose-600">
            <CircleAlert className="size-3.5 shrink-0" /> {error}
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
