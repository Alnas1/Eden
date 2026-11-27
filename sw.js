/* EDEN 离线缓存 v2
 * 规则：网页本体=网络优先、失败回退缓存（改版能及时生效）；
 *       静态资源=先秒开缓存、后台悄悄更新写回（stale-while-revalidate）。
 */
const V = 'eden-v2';
const CORE = ['./', './index.html', './style.css', './app.js', './data.js',
              './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const isPage = e.request.mode === 'navigate' || /\.html$/.test(url.pathname) || url.pathname.endsWith('/');
  e.respondWith(
    isPage
      ? fetch(e.request).then(r => {
          const copy = r.clone();
          caches.open(V).then(c => c.put(e.request, copy));
          return r;
        }).catch(() => caches.match(e.request, { ignoreSearch: true }))
      : caches.match(e.request).then(hit => {
          const bg = fetch(e.request).then(r => {
            const copy = r.clone();
            caches.open(V).then(c => c.put(e.request, copy));
            return r;
          }).catch(() => {});
          return hit || bg;
        })
  );
});
