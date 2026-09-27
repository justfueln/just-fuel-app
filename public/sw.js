// Just Fuel PWA cache retirement worker.
// This worker intentionally caches nothing. Its only job is to remove any
// legacy app-shell caches/service-worker registration left by older builds.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch {}

    try {
      await self.registration.unregister();
    } catch {}

    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map(client => client.navigate(client.url).catch(() => null)));
    } catch {}
  })());
});

// Deliberately no fetch handler: all app HTML, JS and CSS must come directly
// from the active Vercel deployment. No legacy shell can be served from here.
