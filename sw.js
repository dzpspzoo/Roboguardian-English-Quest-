// Tryb offline: pliki gry zapisywane przy pierwszym użyciu. Kod (html/js/css/json) najpierw z sieci, reszta z pamięci.
const CACHE = 'rg-v36';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.headers.has('range') || /\.(mp4|webm|zip|onnx)$/.test(new URL(req.url).pathname)) return; // wideo: przeglądarka sama (zapytania Range)
  const code = /\.(html|js|css|json|webmanifest)$|\/$/.test(new URL(req.url).pathname);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (code) {
      try { const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
      catch (err) { return (await cache.match(req)) || Response.error(); }
    }
    const hit = await cache.match(req); if (hit) return hit;
    const res = await fetch(req); if (res.ok && res.status === 200) cache.put(req, res.clone()); return res;
  })());
});
