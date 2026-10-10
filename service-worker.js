// KNEIPENQUIZ_V072
const CACHE_NAME = 'kneipenquiz-v0.7.2-20261010-times';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=072',
  './app.js?v=072',
  './config.js?v=072',
  './profiles.js?v=072',
  './diagnose.html?v=072',
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

  // config.js muss bei jedem Start online frisch geladen werden. Sonst
  // kann eine alte leere Serveradresse im Offline-Cache hängen bleiben.
  if(/\/(?:config|profiles|app)\.js$/.test(url.pathname) || url.pathname.endsWith('/styles.css')){
    event.respondWith(fetch(event.request).then(response => {
      if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
      return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }

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
