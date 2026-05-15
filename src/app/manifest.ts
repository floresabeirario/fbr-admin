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
    icons: [
      {
        src: "/favicon/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
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
      // Maskable: ícone com safe zone + fundo opaco, para Android desenhar
      // bem o atalho no ecrã principal (sem maskable o ícone fica "flutuante"
      // num círculo branco e quase invisível). Ver scripts/generate-maskable-icons.mjs.
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
      {
        src: "/favicon/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
