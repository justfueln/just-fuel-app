const RELOAD_TARGET_KEY='jf-update-reload-target';
let updateCheckInFlight=null;
let lastUpdateCheckAt=0;

export function entryAssetFromHtml(html=''){
  const text=String(html||'');
  const scripts=[...text.matchAll(/<script\b[^>]*>/gi)].map(match=>match[0]);
  for(const tag of scripts){
    if(!/\btype=["']module["']/i.test(tag))continue;
    const src=tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if(src)return src;
  }
  return'';
}

export function normalizeEntryAsset(value,origin='https://justfuel.local'){
  if(!value)return'';
  try{return new URL(value,origin).pathname}catch{return String(value).split('?')[0].split('#')[0]}
}

export function buildChanged(currentAsset,nextAsset,origin='https://justfuel.local'){
  const current=normalizeEntryAsset(currentAsset,origin);
  const next=normalizeEntryAsset(nextAsset,origin);
  return Boolean(current&&next&&current!==next);
}

function currentEntryAsset(){
  if(typeof document==='undefined')return'';
  return document.querySelector('script[type="module"][src]')?.getAttribute('src')||'';
}

export async function checkForAppUpdate({minGapMs=15000,force=false}={}){
  if(typeof window==='undefined'||typeof document==='undefined'||typeof fetch!=='function')return false;
  if(!force&&document.visibilityState==='hidden')return false;
  if(typeof navigator!=='undefined'&&navigator.onLine===false)return false;
  const now=Date.now();
  if(!force&&now-lastUpdateCheckAt<minGapMs)return false;
  if(updateCheckInFlight)return updateCheckInFlight;
  lastUpdateCheckAt=now;

  updateCheckInFlight=(async()=>{
    try{
      const response=await fetch(`/index.html?jf-update=${now}`,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
      if(!response.ok)return false;
      const html=await response.text();
      const nextAsset=entryAssetFromHtml(html);
      const currentAsset=currentEntryAsset();
      if(!buildChanged(currentAsset,nextAsset,window.location.origin)){
        try{sessionStorage.removeItem(RELOAD_TARGET_KEY)}catch{}
        return false;
      }
      const target=normalizeEntryAsset(nextAsset,window.location.origin);
      try{
        if(sessionStorage.getItem(RELOAD_TARGET_KEY)===target)return false;
        sessionStorage.setItem(RELOAD_TARGET_KEY,target);
      }catch{}
      window.location.reload();
      return true;
    }catch{
      return false;
    }finally{
      updateCheckInFlight=null;
    }
  })();
  return updateCheckInFlight;
}

export function installAppUpdateWatcher(){
  if(typeof window==='undefined'||typeof document==='undefined')return()=>{};
  let armed=false;
  const check=()=>armed?checkForAppUpdate().catch(()=>{}):Promise.resolve(false);
  const first=window.setTimeout(()=>{
    armed=true;
    checkForAppUpdate({force:true}).catch(()=>{});
  },8000);
  const interval=window.setInterval(check,180000);
  const onVisibility=()=>{if(document.visibilityState==='visible')check()};
  window.addEventListener('focus',check,{passive:true});
  document.addEventListener('visibilitychange',onVisibility,{passive:true});
  return()=>{
    window.clearTimeout(first);
    window.clearInterval(interval);
    window.removeEventListener('focus',check);
    document.removeEventListener('visibilitychange',onVisibility);
  };
}
