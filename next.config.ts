import type { NextConfig } from "next";

// ── Headers de segurança ─────────────────────────────────────────
// Aplicados a todas as rotas (excepto /sw.js, que tem o seu próprio
// bloco mais abaixo). Detalhes:
//
// • X-Content-Type-Options: nosniff — impede o browser de "adivinhar"
//   o MIME type, evitando que um upload .txt seja interpretado como
//   script.
//
// • Referrer-Policy: strict-origin-when-cross-origin — só envia o
//   domínio (não o path completo) ao sair do site.
//
// • X-Frame-Options: DENY — impede que o admin seja carregado num
//   iframe noutro site (protecção contra clickjacking).
//
// • Strict-Transport-Security: max-age=63072000; includeSubDomains —
//   força HTTPS durante 2 anos em admin.* e subdomínios. Já estamos
//   em HTTPS via Vercel; este header impede downgrade attacks.
//
// • Permissions-Policy — desactiva features do browser que NÃO
//   usamos (câmara, microfone, geolocalização, USB, etc.). Reduz a
//   superfície de ataque caso um script malicioso entre.
//
// • Cross-Origin-Opener-Policy: same-origin — isola este origin dos
//   popups que abramos (e.g. OAuth do Google), protegendo contra
//   ataques tipo Spectre / cross-window references.
//
// • Cross-Origin-Resource-Policy: same-site — recursos servidos por
//   admin.* só podem ser carregados por floresabeirario.pt e
//   subdomínios.
// ─────────────────────────────────────────────────────────────────

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "accelerometer=()",
      "gyroscope=()",
      "midi=()",
      "interest-cohort=()",
    ].join(", "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
