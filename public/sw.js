// Service worker: (1) halaman offline saat navigasi gagal, (2) cache aset statis
// ber-hash (/_next/static, ikon) supaya buka ulang aplikasi terasa instan.
// API, halaman dinamis, dan data login TIDAK pernah di-cache.
const CACHE = "absensi-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || /^\/(icon-\d+|apple-touch-icon)\.png$/.test(url.pathname));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const url = new URL(req.url);
  if (isStaticAsset(url)) {
    // Nama file ber-hash = isi tidak berubah -> cache-first.
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});
