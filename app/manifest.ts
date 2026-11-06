import type { MetadataRoute } from "next";

// Telefona "uygulama" olarak kurulabilmesi için Web App Manifest.
// /manifest.webmanifest adresinden sunulur.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Em3Task — Ekip içi iş takip",
    short_name: "Em3Task",
    description: "Ekip içi görev takip, sohbet ve dosya paylaşım uygulaması.",
    lang: "tr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Açılış ekranı ve durum çubuğu, uygulamanın koyu menü rengiyle aynı
    background_color: "#141414",
    theme_color: "#141414",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png?v=3", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png?v=3", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Ana ekrandaki ikona uzun basınca çıkan kısayollar
    shortcuts: [
      { name: "Görevlerim", url: "/gorevlerim", icons: [{ src: "/icons/icon-192.png?v=3", sizes: "192x192" }] },
      { name: "Genel sohbet", url: "/genel", icons: [{ src: "/icons/icon-192.png?v=3", sizes: "192x192" }] },
      {
        name: "Atadığım Görevler",
        url: "/atadigim-gorevler",
        icons: [{ src: "/icons/icon-192.png?v=3", sizes: "192x192" }],
      },
    ],
  };
}
