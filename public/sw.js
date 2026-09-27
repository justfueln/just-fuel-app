const CACHE='just-fuel-v4';
const CORE=['/','/index.html','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);

  // Never cache Supabase, Shopify or any other cross-origin/API response.
  // This prevents authenticated training data and checkout/API traffic from being persisted in the PWA cache.
  if(url.origin!==self.location.origin) return;

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('/index.html',copy));
          return response;
        })
        .catch(()=>caches.match('/index.html'))
    );
    return;
  }

  const networkFirst=['script','style','manifest'].includes(request.destination);
  if(networkFirst){
    event.respondWith(
      fetch(request)
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(request,copy));
          }
          return response;
        })
        .catch(()=>caches.match(request))
    );
    return;
  }

  const cacheable=['image','font'].includes(request.destination) || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png');
  if(!cacheable) return;

  event.respondWith(
    caches.match(request).then(cached=>{
      const network=fetch(request).then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(request,copy));
        }
        return response;
      });
      return cached || network;
    })
  );
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
      for(const client of clients){
        if('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
