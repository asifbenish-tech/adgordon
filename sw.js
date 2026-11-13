// גרסה: להעלות את המספר בכל עדכון, כדי שהטלפונים יקבלו את הגרסה החדשה.
const CACHE = 'adgordon-v16';
const CORE = ['./', './index.html', './css/app.css', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png', './logo.png', './logo-mark.png',
  './vendor/fa/css/fontawesome.min.css', './vendor/fa/css/solid.min.css', './vendor/fa/webfonts/fa-solid-900.woff2',
  './data/duty.json', './vendor/fonts/rubik-hebrew-wght-normal.woff2', './vendor/fonts/rubik-latin-wght-normal.woff2',
  './js/app.js', './js/config.js', './js/util.js', './js/state.js', './js/store.js', './js/demo.js', './js/data.js', './js/auth.js', './js/ui.js',
  './js/views/home.js', './js/views/tt.js', './js/views/duty.js', './js/views/cal.js', './js/views/msg.js', './js/views/staff.js', './js/views/profile.js', './js/push.js', './js/views/menu.js', './js/views/portal.js', './js/views/tools.js', './js/views/seat.js', './js/seat-io.js', './vendor/fa/css/regular.min.css', './vendor/fa/css/brands.min.css', './vendor/fa/webfonts/fa-regular-400.woff2', './vendor/fa/webfonts/fa-brands-400.woff2'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // הקבצים של האפליקציה: קודם מהרשת (כדי לקבל עדכונים), ובלי אינטרנט - מהמטמון
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); } return r; })
      .catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req, {ignoreSearch: true})));
    return;
  }
  // גופנים, אייקונים וספריות קבועות: מהמטמון, ומתעדכנים ברקע
  if (!/www\.gstatic\.com/.test(url.host)) return;
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});

// התראות דחיפה (נשלחות משרת הכניסה דרך FCM): מציגים, ובלחיצה פותחים את האפליקציה במסך המתאים
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (err) {}
  const n = Object.assign({}, d.notification, d.data);
  e.waitUntil(self.registration.showNotification(n.title || 'גורדון', {body: n.body || '', icon: './icon-192.png', badge: './icon-192.png', dir: 'rtl', lang: 'he', tag: n.url || 'adgordon', data: {url: n.url || ''}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL('./' + ((e.notification.data && e.notification.data.url) || ''), self.registration.scope).href;
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.registration.scope)) { w.navigate(url); return w.focus(); }
    return clients.openWindow(url);
  }));
});
