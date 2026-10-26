/* Service worker — مواقيت الصلاة: يخزّن الصفحة للعمل بدون إنترنت ويعرض الإشعارات */
const CACHE = 'pt-v2';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'manifest.json', 'icon-192.png', 'icon-512.png', 'quran-uthmani.txt', 'AmiriQuran-Regular.ttf'])).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// الشبكة أولًا (لتصلك التحديثات)، وعند انقطاع الإنترنت أو بطئه الشديد تُفتح النسخة المخزّنة
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  const nav = e.request.mode === 'navigate';
  const cached = () => caches.match(e.request).then(m => m || caches.match(e.request, { ignoreSearch: true }));
  const fromCache = () => cached().then(m => m || (nav ? caches.match('./') : undefined));
  const net = fetch(e.request).then(r => {
    if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }
    // الموقع محذوف أو الخادم يعطي خطأ (404/5xx): نفتح النسخة المخزّنة بدل صفحة الخطأ
    return fromCache().then(m => m || r);
  }).catch(() => fromCache().then(m => m || Response.error()));
  // شبكة بطيئة جدًا: نعرض النسخة المخزّنة بعد مهلة، ويكمل التحديث في الخلفية
  const slow = new Promise(res => setTimeout(() => { cached().then(m => { if (m) res(m); }); }, nav ? 3500 : 6000));
  e.waitUntil(net.catch(() => {}));
  // طلب فحص التحديث (no-store) ينتظر الشبكة فقط كي لا يعيد نسخة قديمة
  e.respondWith(e.request.cache === 'no-store' ? net : Promise.race([net, slow]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.data && e.notification.data.target;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length) { list[0].postMessage({ type: 'open', target }); return list[0].focus(); }
    return self.clients.openWindow('./').then(c => { if (c) setTimeout(() => c.postMessage({ type: 'open', target }), 1500); });
  }));
});
