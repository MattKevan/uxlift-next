// Minimal service worker to prevent 404 errors
// This can be expanded later for caching strategies

self.addEventListener('install', function(event) {
  console.log('Service Worker installing');
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker activating');
});

self.addEventListener('fetch', function(event) {
  // For now, just pass through all requests
  event.respondWith(fetch(event.request));
});