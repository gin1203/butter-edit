// ── The Butter Edit · Service Worker ────────────────────────────────
// 每次部署時改這個版本號，舊快取就會被清除
const VERSION = "v5"';
const CACHE = `butter-edit-${VERSION}`;

// 安裝：快取主要資源
self.addEventListener('install', e => {
  self.skipWaiting(); // 新 SW 立刻接管，不等舊的結束
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['./', './index.html']))
  );
});

// 啟動：清除舊快取
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()) // 立刻接管所有頁面
  );
});

// 攔截請求：網路優先，失敗才用快取
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 成功拿到新版本，順便更新快取
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request)) // 離線才 fallback 快取
  );
});
