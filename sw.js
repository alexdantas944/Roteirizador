const CACHE_NAME = "app-cache-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js"
];

// Instalação do SW e cache dos arquivos
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Ativação do SW
self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

// Intercepta requisições e retorna do cache se disponível
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
