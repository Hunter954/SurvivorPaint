'use strict';

const CACHE_NAME = 'missao-foz-v5.4.0';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css?v=5.4.0',
  '/game.js?v=5.4.0',
  '/manifest.webmanifest',
  '/assets/icon.svg',
  '/assets/icon-180.png',
  '/assets/sprites/sprites.json',
  '/assets/sprites/hero.png',
  '/assets/sprites/hero-celebrate.png',
  '/assets/sprites/supporters.png',
  '/assets/sprites/faixa.png',
  '/assets/sprites/luvas.png',
  '/assets/sprites/moicano.png',
  '/assets/sprites/jaqueta.png',
  '/assets/sprites/bone.png',
  '/assets/sprites/capuz.png',
  '/assets/sprites/colete.png',
  '/assets/sprites/atleta.png',
  '/assets/sprites/mascara.png',
  '/assets/sprites/campeao.png',
  '/assets/sprites/assessor.png',
  '/assets/sprites/lider.png',
  '/assets/stages/avenida-brasil.png',
  '/assets/stages/almirante-barroso.png',
  '/assets/stages/praca-biblia.png',
  '/assets/stages/catedral-sao-joao.png',
  '/assets/stages/praca-paz.png',
  '/assets/stages/camara-municipal.png',
  '/assets/stages/camara-plenario.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === '/api/health') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  const cacheOptions = url.pathname.startsWith('/assets/') ? { ignoreSearch: true } : undefined;
  event.respondWith(
    caches.match(request, cacheOptions).then(cached => cached || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      return response;
    }))
  );
});
