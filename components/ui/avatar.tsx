import { initials } from "@/lib/tasks";

// Ada göre sabit bir renk seçer; aynı kişi her yerde aynı renkte görünür
const TONES = [
  "bg-teal-100 text-teal-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-violet-100 text-violet-800",
];

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-7 text-[11px]",
  md: "size-10 text-sm",
  lg: "size-24 text-2xl",
};

// Profil fotoğrafı varsa onu, yoksa renkli baş harfleri gösterir
export function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- küçük, harici depo resmi
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        className={`shrink-0 rounded-full bg-slate-100 object-cover ${SIZES[size]} ${className}`}
      />
    );
  }

  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const tone = TONES[hash % TONES.length];

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${tone} ${SIZES[size]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
