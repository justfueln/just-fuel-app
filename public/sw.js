const CACHE='just-fuel-v9';
const STATIC=['/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.all(STATIC.map(async asset=>{
      try{
        const response=await fetch(asset,{cache:'no-store'});
        if(response.ok) await cache.put(asset,response);
      }catch{}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  // HTML/app-shell navigations must always come from the active deployment.
  // Never fall back to an old cached index.html.
  if(request.mode==='navigate'){
    event.respondWith(fetch(new Request(request,{cache:'no-store'})));
    return;
  }

  // Vite assets are content-hashed. Ask the network first so a new deployment
  // can never be replaced by an older cached JS/CSS bundle.
  if(['script','style'].includes(request.destination)){
    event.respondWith(fetch(new Request(request,{cache:'no-store'})));
    return;
  }

  if(request.destination==='manifest'){
    event.respondWith(fetch(new Request(request,{cache:'no-store'})).catch(()=>caches.match(request)));
    return;
  }

  // Only stable visual assets are cache-first.
  const cacheable=['image','font'].includes(request.destination) || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png');
  if(!cacheable) return;

  event.respondWith(
    caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
      }
      return response;
    }))
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
