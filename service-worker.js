const CACHE_NAME = 'kneipenquiz-v0.4-20260928';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './questions.js',
  './manifest.webmanifest',
  './assets/brandenburger-tor.svg',
  './assets/flags/austria.svg',
  './assets/flags/belgium.svg',
  './assets/flags/bulgaria.svg',
  './assets/flags/colombia.svg',
  './assets/flags/czechia.svg',
  './assets/flags/estonia.svg',
  './assets/flags/finland.svg',
  './assets/flags/france.svg',
  './assets/flags/germany.svg',
  './assets/flags/hungary.svg',
  './assets/flags/ireland.svg',
  './assets/flags/italy.svg',
  './assets/flags/japan.svg',
  './assets/flags/lithuania.svg',
  './assets/flags/netherlands.svg',
  './assets/flags/poland.svg',
  './assets/flags/romania.svg',
  './assets/flags/sweden.svg',
  './assets/flags/switzerland.svg',
  './assets/flags/ukraine.svg',
  './assets/hessen-outline.svg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;

  if(event.request.mode === 'navigate'){
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));
          return response;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if(response && response.status === 200){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }))
  );
});
