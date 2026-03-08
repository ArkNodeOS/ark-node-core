const CACHE = 'ark-node-v1';
const PRECACHE = ['/ui/', '/ui/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('/solomon') || url.includes('/health') || url.includes('/status') || url.includes('/apps')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
