self.addEventListener('install',event=>{
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('just-fuel-')).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  // Current Just Fuel app is always served from the active deployment.
  // Nothing from an older app shell or bundle is used as a fallback.
  if(request.mode==='navigate' || ['script','style','manifest'].includes(request.destination)){
    event.respondWith(fetch(new Request(request,{cache:'no-store'})));
  }
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
