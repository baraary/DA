const CACHE_NAME = 'davanloo-assistant-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// نصب و کش کردن فایل‌های جدید
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// پاک کردن کش‌های قدیمی قبلی به صورت خودکار
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// استراتژی هوشمند: اول دریافت آخرین نسخه از اینترنت (گیت‌هاب)، در صورت قطعی اینترنت استفاده از کش آفلاین
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
