// Just Fuel legacy PWA retirement worker — v13.
// The current application deliberately does not use an app-shell service worker.
// If an older installed PWA still has a worker/caches, force them out and
// navigate every open client back to the current network-served application.
const CURRENT_APP_VERSION = '13';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try { await self.clients.claim(); } catch {}

    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch {}

    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map(client => {
        try {
          const url = new URL(client.url);
          url.searchParams.set('jfapp', CURRENT_APP_VERSION);
          url.searchParams.set('legacy', 'cleared');
          return client.navigate(url.toString()).catch(() => null);
        } catch {
          return client.navigate(`/?jfapp=${CURRENT_APP_VERSION}&legacy=cleared`).catch(() => null);
        }
      }));
    } catch {}

    try { await self.registration.unregister(); } catch {}
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'JF_RETIRE_LEGACY') {
    event.waitUntil((async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      } catch {}
      try { await self.registration.unregister(); } catch {}
    })());
  }
});

// Deliberately no fetch handler: HTML, JS and CSS must always come from the
// active deployment. This worker can never serve the retired white app shell.
