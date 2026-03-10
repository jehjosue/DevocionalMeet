// Minimal Service Worker for PWA compliance
const CACHE_NAME = 'dmeet-v1';
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Pass-through strategy (network only) for now, as it's a real-time app
    event.respondWith(fetch(event.request));
});
