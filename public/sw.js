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

const CACHE_VERSION = "fbr-admin-v2";
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
  if (url.pathname.startsWith("/favicon/")) return true;
  if (url.pathname.startsWith("/userphotos/")) return true;
  if (url.pathname.startsWith("/fonts/")) return true;
  if (/\.(?:css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname)) {
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
