"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { largeAvatarPath } from "@/lib/avatars";
import { Avatar } from "./avatar";

// Fotoğrafı olan avatar tıklanınca fotoğrafı büyük gösterir.
// Fotoğrafı yoksa (baş harfler) normal, tıklanamaz avatar olarak kalır.
export function ZoomableAvatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!src) return <Avatar name={name} size={size} className={className} />;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`${name} profil fotoğrafını büyüt`}
        className="shrink-0 cursor-zoom-in rounded-full transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none"
      >
        <Avatar name={name} src={src} size={size} className={className} />
      </button>
      {open && <AvatarLightbox name={name} src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

// Tam ekran, ortalanmış fotoğraf. Dışarı tıklayınca veya ESC ile kapanır.
export function AvatarLightbox({
  name,
  src,
  onClose,
}: {
  name: string;
  src: string;
  onClose: () => void;
}) {
  // Önce büyük boyut denenir; yoksa (eski yüklemeler) küçük boyut gösterilir
  const [url, setUrl] = useState(() => largeAvatarPath(src));
  const [loaded, setLoaded] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // arka plan kaymasın
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} profil fotoğrafı`}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/75 p-6 backdrop-blur-md [animation:lightbox-in_150ms_ease-out]"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X className="size-5" />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative aspect-square w-full max-w-[min(80vh,520px)]"
      >
        {!loaded && <div className="absolute inset-0 animate-pulse rounded-3xl bg-white/10" />}
        {/* eslint-disable-next-line @next/next/no-img-element -- harici depo resmi, tam boyut */}
        <img
          src={url}
          alt={`${name} profil fotoğrafı`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (url !== src) setUrl(src);
          }}
          className={`size-full rounded-3xl object-cover shadow-2xl ring-1 ring-white/10 transition-opacity duration-200 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
      <p onClick={(e) => e.stopPropagation()} className="mt-4 text-sm font-semibold text-white/90">
        {name}
      </p>
    </div>,
    document.body,
  );
}
