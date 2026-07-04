/* FBR Admin — service worker
 *
 * Estratégia conservadora: este admin lida com dados sensíveis (encomendas,
 * pagamentos, NIFs) e mostrar dados desactualizados pode confundir a Maria.
 * Por isso:
 *   - Assets estáticos do Next (/_next/static/*) e ícones: cache-first
 *     (são imutáveis — Next mete hash no nome do ficheiro).
 *   - HTML, /api, /auth, e Supabase: SEMPRE network. Nunca devolver cache.
 *   - Offline: a app não funciona sem rede. Mostramos o que o browser
 *     mostraria naturalmente — não tentamos disfarçar.
 *
 * Bump CACHE_VERSION sempre que quiseres invalidar todos os caches.
 */

const CACHE_VERSION = "fbr-admin-v7";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isCacheableStatic(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  // /favicon/* DELIBERADAMENTE fora do cache: a interceptação do SW estava
  // a servir versões antigas do logo quando a Maria adicionava ao ecrã
  // principal (resultado: "F" cinzento em vez do ícone). PNGs são pequenos
  // e ficam no cache HTTP do browser na mesma.
  if (url.pathname.startsWith("/userphotos/")) return true;
  if (url.pathname.startsWith("/fonts/")) return true;
  if (/\.(?:css|woff2?|ttf|otf|jpg|jpeg|webp|svg)$/i.test(url.pathname)) {
    return true;
  }
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (!isCacheableStatic(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);
        if (fresh.ok) {
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ──────────────────────────────────────────────────────────────
// Notificações push internas (Web Push / VAPID)
// ──────────────────────────────────────────────────────────────
// O servidor (webhook de nova encomenda, actions de tarefas/encomendas,
// cron das 7h) envia um payload JSON { title, body, url, tag }. Aqui só
// o mostramos e, ao clicar, abrimos/focamos a rota certa. Tudo interno —
// nunca chega nada a clientes.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Flores à Beira-Rio";
  const options = {
    body: data.body || "",
    icon: "/favicon/android-chrome-192x192.png",
    badge: "/favicon/favicon-32x32.png",
    // `tag` agrupa/substitui notificações do mesmo tipo (ex.: várias
    // atualizações da mesma encomenda não empilham 5 avisos).
    tag: data.tag || undefined,
    // Guardamos a URL para o notificationclick saber para onde ir.
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = (event.notification.data && event.notification.data.url) || "/";
  // Resolver para URL absoluta: tanto `navigate` como `openWindow` são mais
  // fiáveis no Android com o href completo do que com um caminho relativo.
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Se a app já está aberta nalguma janela, reutiliza-a: navega-a para a
      // rota certa e depois foca-a. A ORDEM importa (navegar → focar) e cada
      // passo vai dentro de try/catch: no Android o focus() pode falhar quando
      // a app está em segundo plano, e sem isto o handler morria a meio sem
      // nunca abrir nada — a notificação fechava e não acontecia mais nada.
      for (const client of allClients) {
        try {
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          if ("focus" in client) {
            await client.focus();
          }
          return;
        } catch {
          // Esta janela não colaborou — tenta a próxima e, se nenhuma servir,
          // cai para abrir uma janela nova lá em baixo.
        }
      }

      // Nenhuma janela reutilizável (app fechada): abre uma nova.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
