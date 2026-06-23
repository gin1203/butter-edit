// ── The Butter Edit · Service Worker ────────────────────────────────
const VERSION = 'v5';
const CACHE = `butter-edit-${VERSION}`;

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k))) // 清除所有舊快取
    ).then(() => self.clients.claim())
  );
});

// 永遠從網路抓，不用快取（確保永遠最新版）
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, {cache: 'no-store'})
      .catch(() => caches.match(e.request)) // 只有離線才用快取
  );
});
