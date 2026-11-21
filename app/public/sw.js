// Basit hizmet çalışanı: uygulama kabuğunu önbelleğe alır, veriler her zaman sunucudan gelir.
const SURUM = 'st-v9';
const KABUK = ['/', '/css/app.css', '/js/app.js', '/js/ui.js', '/js/api.js', '/manifest.webmanifest', '/ikon/ikon-192.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== SURUM).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/dosya/')) return;
  // Önce ağ, olmazsa önbellek (güncellemeler hemen gelsin)
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const k = r.clone(); caches.open(SURUM).then((c) => c.put(e.request, k)); }
    return r;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});
