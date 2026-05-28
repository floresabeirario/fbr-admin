import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FBR Admin — Flores à Beira Rio",
    short_name: "FBR Admin",
    description: "Painel de administração da Flores à Beira Rio: encomendas, vales, parcerias e métricas.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#3D2B1F",
    theme_color: "#3D2B1F",
    lang: "pt-PT",
    dir: "ltr",
    categories: ["business", "productivity"],
    // Padrão recomendado: "any" → android-chrome (full-bleed, fundo transparente,
    // launcher do Android aplica fundo próprio); "maskable" → variante com safe
    // zone 80% + fundo cocoa opaco (para launchers que aplicam máscara). Sem o
    // par "any", alguns launchers caem no fallback "F cinzento"; só com a
    // maskable como "any" o ícone fica minúsculo dentro do quadrado cocoa.
    // Ver scripts/generate-maskable-icons.mjs.
    icons: [
      {
        src: "/favicon/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/favicon/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon/maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/favicon/maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
