/* =====================================================
   sw.js — Service Worker per PWA
   Strategia:
     - cache-first per asset statici (HTML, CSS, JS, immagini)
     - network-only per API esterne (Google, Worker, Yahoo)
     - aggiornamento cache su nuova versione
   ===================================================== */

const CACHE_VERSION = 'pf-v3.1';
const STATIC_CACHE  = CACHE_VERSION + '-static';

/* File da pre-cachare al primo install */
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './css/style.css',
  './js/crypto.js',
  './js/data.js',
  './js/charts.js',
  './js/auth.js',
  './js/drive.js',
  './js/storage.js',
  './js/quotes.js',
  './js/ui.js',
  './js/accounts.js',
  './js/transactions.js',
  './js/portfolio.js',
  './js/ui-accounts-transactions.js',
  './js/ui-portfolio.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

/* Domini esterni che NON devono mai essere cachati */
const NO_CACHE_HOSTS = [
  'accounts.google.com',
  'apis.google.com',
  'www.googleapis.com',
  'oauth2.googleapis.com',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
];

/* ===== INSTALL: pre-cache asset statici ===== */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      // addAll fallisce se uno qualsiasi fallisce; usiamo add singolo per robustezza
      return Promise.all(STATIC_ASSETS.map(function(url) {
        return cache.add(url).catch(function(err) {
          console.warn('[sw] cache miss su', url, err.message);
        });
      }));
    }).then(function() { return self.skipWaiting(); })
  );
});

/* ===== ACTIVATE: pulizia vecchie cache ===== */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n.indexOf(CACHE_VERSION) !== 0; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

/* ===== FETCH: cache-first per statici, network-only per API ===== */
self.addEventListener('fetch', function(event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Worker Cloudflare dell'utente o altri host esterni: sempre rete, nessuna cache */
  if (NO_CACHE_HOSTS.indexOf(url.hostname) >= 0 ||
      url.hostname.endsWith('.workers.dev')   ||
      url.hostname.endsWith('.pages.dev')) {
    return; // lascia che il browser gestisca normalmente
  }

  /* Solo richieste same-origin → cache-first */
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(function(cached) {
      if (cached) return cached;
      return fetch(req).then(function(res) {
        // Aggiungi alla cache se la risposta è valida
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then(function(cache) { cache.put(req, clone); });
        }
        return res;
      }).catch(function() {
        // Offline fallback: per documenti HTML, ritorna index.html cachato
        if (req.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* ===== MESSAGE: skipWaiting da pagina (per update manuale) ===== */
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
