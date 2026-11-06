// "Em3Task" yazı logosu: "Em" kalın, logodaki köşeli sarı "3", "Task" normal.
// Yazı rengi bulunduğu yerin rengini alır (koyu menüde beyaz, açık sayfada siyah);
// "3" her zaman logodaki sarı.
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span role="img" aria-label="Em3Task" className={`inline-flex items-baseline leading-none tracking-tight ${className}`}>
      <span aria-hidden className="font-black">
        Em
      </span>
      <svg
        aria-hidden
        viewBox="0 0 164 165"
        // Büyük harf yüksekliği kadar; taban çizgisine oturur
        className="mx-[0.03em] h-[0.7em] w-auto shrink-0 fill-[#fdd96c]"
      >
        <path d="M25 0H127L162 38L129 80L164 115L129 165H8L32 130H104L115 115L98 99H33L59 63H101L118 39H0Z" />
      </svg>
      <span aria-hidden className="font-normal">
        Task
      </span>
    </span>
  );
}
