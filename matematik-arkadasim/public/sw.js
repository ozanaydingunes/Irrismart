/* Matematik Arkadaşım — service worker
 * - Uygulama kabuğu (sayfalar) ağ öncelikli, çevrimdışıyken önbellekten.
 * - /_next/static ve ikonlar önbellek öncelikli (sürümlü dosyalar).
 * - /api/* ASLA önbelleğe alınmaz (yapay zekâ çağrıları her zaman internet ister).
 * - Kayıtlı çözümler IndexedDB'de olduğu için Soru Defterim çevrimdışı açılır.
 */
const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const PAGES = ["/", "/coz", "/konular", "/defter", "/gelisim", "/ayarlar", "/gizlilik", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => Promise.all(PAGES.map((p) => c.add(new Request(p, { cache: "reload" })).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // her zaman ağ

  // Sürümlü statik dosyalar: önbellek öncelikli
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Sayfa gezintileri: ağ öncelikli, çevrimdışıyken önbellek, o da yoksa /offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(url.pathname, { ignoreSearch: true })) || (await caches.match("/offline")) || Response.error()),
    );
    return;
  }

  // Diğer GET istekleri (RSC yükleri vb.): ağ, olmazsa önbellek
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && url.searchParams.has("_rsc")) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(req)) || Response.error()),
  );
});
