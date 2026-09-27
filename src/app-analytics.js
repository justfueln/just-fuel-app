const ENDPOINT='https://ufolqntrfmvefpvrjnsa.supabase.co/functions/v1/app-analytics-event';
const CLIENT_KEY='jf-analytics-client-v1';
const SESSION_KEY='jf-analytics-session-v1';
const ATTRIBUTION_KEY='jf-analytics-attribution-v1';
const BASKET_KEY='just-fuel-basket-v3';

function id(prefix){
  try{return `${prefix}_${crypto.randomUUID()}`}
  catch{return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`}
}
function stableId(storage,key,prefix){
  try{let v=storage.getItem(key);if(!v){v=id(prefix);storage.setItem(key,v)}return v}catch{return id(prefix)}
}
const clientId=stableId(localStorage,CLIENT_KEY,'c');
const sessionId=stableId(sessionStorage,SESSION_KEY,'s');

function displayMode(){
  try{
    if(window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true)return'standalone';
  }catch{}
  return'browser';
}
function basketSummary(){
  try{
    const parsed=JSON.parse(localStorage.getItem(BASKET_KEY)||'{}');
    const items=Array.isArray(parsed.items)?parsed.items:[];
    return {
      basket_items:items.reduce((n,x)=>n+(Number(x.quantity)||0),0),
      basket_value:Math.round(items.reduce((n,x)=>n+(Number(x.quantity)||0)*(Number(x.price)||0),0)*100)/100
    };
  }catch{return{}}
}
function currentSection(){
  const active=document.querySelector('.bottom-nav button.active');
  return active?.textContent?.trim()||null;
}
function cleanMeta(meta={}){
  const out={};
  for(const[k,v]of Object.entries(meta||{})){
    if(/email|name|token|password|secret|strava|heart|weight|health/i.test(k))continue;
    if(['string','number','boolean'].includes(typeof v))out[k]=typeof v==='string'?v.slice(0,240):v;
  }
  return out;
}
function safeReferrerHost(){
  try{return document.referrer?new URL(document.referrer).host.slice(0,120):''}catch{return''}
}
function readAttribution(){
  try{
    const saved=JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY)||'null');
    if(saved&&typeof saved==='object')return saved;
    const q=new URLSearchParams(location.search);
    const data=cleanMeta({
      utm_source:q.get('utm_source')||'',
      utm_medium:q.get('utm_medium')||'',
      utm_campaign:q.get('utm_campaign')||'',
      utm_content:q.get('utm_content')||'',
      utm_term:q.get('utm_term')||'',
      referrer_host:safeReferrerHost(),
      entry_path:location.pathname
    });
    sessionStorage.setItem(ATTRIBUTION_KEY,JSON.stringify(data));
    return data;
  }catch{return{}}
}
const attribution=readAttribution();

export function trackEvent(eventName,metadata={},category='interaction'){
  const payload={
    client_id:clientId,
    session_id:sessionId,
    event_name:String(eventName||'event').slice(0,80),
    category,
    section:currentSection(),
    page_path:location.pathname+location.hash,
    app_host:location.host,
    display_mode:displayMode(),
    metadata:{...attribution,...cleanMeta(metadata)}
  };
  try{
    fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true,credentials:'omit'}).catch(()=>{});
  }catch{}
}
function labelOf(target){
  const el=target?.closest?.('button,a,summary');
  return {el,label:(el?.textContent||el?.getAttribute?.('aria-label')||'').replace(/\s+/g,' ').trim().toLowerCase()};
}
function classifyClick(target){
  const{el,label}=labelOf(target);if(!el||el.closest('[data-analytics-ignore="true"]'))return null;
  if(el.closest('.bottom-nav'))return['nav_section',{destination:(el.textContent||'').trim()}];
  if(el.matches('.bag-button,.training-basket')||/open basket/.test(label))return['basket_opened',basketSummary()];
  if(/repeat previous basket/.test(label))return['previous_basket_clicked',basketSummary()];
  if(/add selected/.test(label))return['shop_add_selected',basketSummary()];
  if(/add .*training fuel.*basket|add training fuel.*basket/.test(label))return['training_fuel_add_clicked',basketSummary()];
  if(/add .*race fuel.*basket|add race fuel.*basket/.test(label))return['race_fuel_add_clicked',basketSummary()];
  if(/add .*fuel.*basket|add plan.*basket/.test(label))return['fuel_plan_add_clicked',basketSummary()];
  if(/sync now|sync strava/.test(label))return['strava_sync_clicked',{}];
  if(/connect strava/.test(label))return['strava_connect_clicked',{}];
  if(/build my plan|generate plan/.test(label))return['training_plan_build_clicked',{}];
  if(/add .*season|add event/.test(label))return['season_event_add_clicked',{}];
  if(/download/.test(label)&&/(garmin|fit|workout|zip)/.test(label))return['garmin_workout_download_clicked',{}];
  if(/install app|install just fuel/.test(label))return['pwa_install_clicked',{}];
  if(/workout details/.test(label))return['workout_details_opened',{}];
  return null;
}
function install(){
  trackEvent('app_opened',{referrer_present:Boolean(document.referrer)},'lifecycle');
  document.addEventListener('click',e=>{const hit=classifyClick(e.target);if(hit)trackEvent(hit[0],hit[1])},{capture:true});
  window.addEventListener('error',e=>trackEvent('javascript_error',{message:String(e.message||'Unknown error').slice(0,200),source:(e.filename||'').split('/').pop()||''},'error'));
  window.addEventListener('unhandledrejection',e=>trackEvent('unhandled_promise_rejection',{message:String(e.reason?.message||e.reason||'Unhandled rejection').slice(0,200)},'error'));
  window.addEventListener('offline',()=>trackEvent('app_offline',{},'lifecycle'));
  window.addEventListener('online',()=>trackEvent('app_online',{},'lifecycle'));
  window.addEventListener('appinstalled',()=>trackEvent('pwa_installed',{},'conversion'));
  window.jfTrack=trackEvent;
}
if(typeof window!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
}
