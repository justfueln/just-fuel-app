// Just Fuel emergency legacy-PWA retirement worker — v15.
// This worker never serves app content. Its only job is to take control away
// from any older worker that cached the retired white application shell.
const CURRENT_APP_VERSION = '15';
const CURRENT_URL = `/current?jfapp=${CURRENT_APP_VERSION}&legacy=cleared`;

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Take control of every currently open Just Fuel window first. This is the
    // key step: unregistering an old worker alone does not release an already
    // controlled Android/PWA window.
    try { await self.clients.claim(); } catch {}

    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch {}

    try {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(windows.map(client => {
        const join = CURRENT_URL.includes('?') ? '&' : '?';
        return client.navigate(`${CURRENT_URL}${join}t=${Date.now()}`).catch(() => null);
      }));
    } catch {}

    // Deliberately remain registered until the v15 app loads. The v15 boot
    // code unregisters this worker after it is safely on /current. Until then,
    // an older app-shell worker cannot regain control.
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'JF_FORCE_ACTIVATE' || event.data === 'JF_RETIRE_LEGACY') {
    event.waitUntil((async () => {
      try { await self.skipWaiting(); } catch {}
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      } catch {}
    })());
  }
});

// IMPORTANT: no fetch handler. Every HTML/JS/CSS request goes to the network
// and therefore to the active Vercel production deployment.
