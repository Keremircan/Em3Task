// Em3Task logosu: küçük boyut için işareti büyütülmüş sürüm
// (public/icons/logo-compact.svg, scripts/generate-icons.mjs ile logo.svg'den üretilir)
export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- küçük, statik SVG; optimizasyona gerek yok
    <img
      src="/icons/logo-compact.svg?v=4"
      alt=""
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      draggable={false}
    />
  );
}
