// ── The Butter Edit Service Worker ──────────────────────────────────────
// 只快取「程式碼外殼」（HTML本身、字型、Tailwind、Firebase SDK），
// 完全不碰 Firestore 的即時資料連線，所以商品/訂單同步不會受影響。
//
// 每次改版時，記得把下面這個版本號改掉（例如 v1 → v2），
// 這樣使用者裝置上的舊快取才會被清掉，換成新版程式碼。
const CACHE_VERSION = 'v1';
const CACHE_NAME = `butter-edit-${CACHE_VERSION}`;

// 開站當下就先快取起來的核心檔案
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 個別檔案快取失敗也不要讓整個安裝失敗（例如 manifest.json 若不存在）
      return Promise.all(
        CORE_ASSETS.map((url) => cache.add(url).catch(() => {}))
      );
    })
  );
  // 不要自動 skipWaiting，等使用者按「立即更新」才切換，避免資料操作到一半被打斷
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith('butter-edit-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// 收到「立即更新」按鈕觸發的訊息，讓新版 SW 馬上接管
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 只處理 GET，且完全不要碰 Firestore / Firebase 的即時連線與 API 請求，
  // 那些一定要直接連網路，不能被快取，不然資料就不即時了
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') && url.pathname.includes('firestore')
  ) {
    return; // 交給瀏覽器直接處理，不攔截
  }

  // 網頁本身（HTML）：Network First — 有網路就一定拿最新版，
  // 只有離線或連線失敗時才退回快取版本
  //
  // 重要修正：光是 fetch(req) 並不保證真的繞過瀏覽器自己的 HTTP 快取——
  // GitHub Pages 對外送出的檔案會帶一段「可以快取幾分鐘」的標記，
  // 瀏覽器那層快取有可能在我們完全不知情的狀況下，偷偷塞一份幾分鐘前
  // （甚至更久）的舊版本回來，讓 Service Worker 誤以為自己拿到了最新版。
  // 加上 {cache:'no-store'}，強制這個 fetch 完全略過瀏覽器的 HTTP 快取層，
  // 保證每次都是真的從網路上重新要一份，不會再被悄悄塞舊資料。
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // 其他靜態資源（Tailwind、字型、Firebase SDK等）：
  // Stale-While-Revalidate — 先給快取版本讓畫面馬上出得來，
  // 同時背景偷偷去要最新的存回快取，下次開就是最新的
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
