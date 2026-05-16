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
    // O mesmo PNG maskable aparece como purpose "any" e "maskable" — a spec
    // permitiria "any maskable" combinado mas o tipo do Next só aceita um
    // valor de cada vez. Resultado prático é igual: o launcher pega qualquer
    // entry "any" ou "maskable" e ambos apontam para o mesmo ficheiro com
    // fundo opaco + safe zone. Isto evita o fallback "F cinzento" que alguns
    // launchers fazem quando só vêem entries "maskable" sem complemento "any".
    // Ver scripts/generate-maskable-icons.mjs.
    icons: [
      {
        src: "/favicon/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/favicon/maskable-192x192.png",
        sizes: "192x192",
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
        purpose: "any",
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
