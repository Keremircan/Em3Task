import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { THEME_BOOT_SCRIPT } from "@/components/theme/theme";
import { ThemeWatcher } from "@/components/theme/theme-watcher";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
});

// Sadece kod bloklarında kullanılır: her sayfada önceden indirilmesin
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Em3Task",
  description: "Ekip içi görev takip platformu",
  applicationName: "Em3Task",
  // iPhone: ana ekrana eklenince tam ekran uygulama gibi açılır
  appleWebApp: {
    capable: true,
    title: "Em3Task",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Çentikli ekranlarda içerik tüm ekrana yayılır; boşluklar CSS'te güvenli alanla ayarlanır
  viewportFit: "cover",
  themeColor: "#141414",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}
      // Tema betiği "dark" sınıfını tarayıcıda ekler; sunucu çıktısıyla farkı beklenen
      suppressHydrationWarning
    >
      <head>
        {/* Seçili temayı sayfa çizilmeden uygula (beyaz yanıp sönme olmasın) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
        <ThemeWatcher />
      </body>
    </html>
  );
}
