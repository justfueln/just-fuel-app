import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, BookOpen, Calculator, CalendarPlus, Check, ChevronRight, Clock, CreditCard,
  Download, Info, MessageCircle, Minus, MoreHorizontal, Plus, ShoppingBag,
  Store, Trash2, Truck, X
} from 'lucide-react';
import TrainingApp from './App';
import CheckoutDrawer from './CheckoutDrawer';
import { FuelBuilder, ShopPage, LearnPage } from './CommercePages';
import {
  CATALOG, FREE_PUDO_THRESHOLD, SHOP_DOMAIN, WHATSAPP_NUMBER,
  byKey, money, numericVariantId
} from './catalog';
import { basketTtlMs, lastBasketTtlMs, normalizeMainSection, readSavedItems } from './app-state-utils';

const NAV = [
  ['Plan', Calculator], ['Learn', BookOpen], ['Shop', Store], ['Training', Activity], ['More', MoreHorizontal]
];
const BASKET_KEY = 'just-fuel-basket-v3';
const LAST_BASKET_KEY = 'just-fuel-last-basket-v1';
const BASKET_TTL = basketTtlMs;
const LAST_BASKET_TTL = lastBasketTtlMs;
const REMINDER_KEY = 'just-fuel-weekly-reminder';
const LAST_SECTION_KEY = 'just-fuel-last-section';
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_CODES = ['SU','MO','TU','WE','TH','FR','SA'];
const REMINDER_DEFAULT = {enabled:false,day:0,time:'18:00',lastShown:'',lastNotified:''};

const LEARN = [
  {title:'Build a simple fuel plan',kicker:'FUEL BASICS',body:'Use Plan to get a suggested carbohydrate target from the session length and type, then adjust it if you already know what works for you.',bullets:['Use Auto for the simplest setup','Practise higher carbohydrate targets before race day','The basket is shared between Plan, Shop and Training']},
  {title:'Bottle Mix as your base',kicker:'DURING',body:'Bottle Mix puts carbohydrate into the bottle so you do not need to carry all of your fuel as gels.',bullets:['Use the bottle-duration option to match how quickly you drink','Sip consistently rather than waiting until you feel empty','Choose your preferred flavour before adding to basket']},
  {title:'Use Boost deliberately',kicker:'CAFFEINE',body:'Boost is an Energy Gel with 40 g carbohydrate and 100 mg caffeine. Use it deliberately rather than automatically for every session.',bullets:['Count Boost as one gel in the plan','Use it where caffeine is useful','Consider your total caffeine intake and tolerance']},
  {title:'Hydration changes with conditions',kicker:'HYDRATE',body:'Heat, sweat rate, intensity and access to water change hydration needs. Use your plan as a starting point, then adjust for the conditions.',bullets:['Hotter days normally need more fluid attention','Practise race hydration in training','Use thirst, conditions and personal experience together']},
  {title:'Recover after the work',kicker:'AFTER',body:'Recover combines carbohydrate and protein for a convenient post-session option alongside normal food, fluid and sleep.',bullets:['Most useful after longer or harder sessions','Normal meals still matter','Keep recovery practical and repeatable']}
];

function localDateKey(){
  const d=new Date(); const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function loadBasket(){
  try{const raw=localStorage.getItem(BASKET_KEY);const items=readSavedItems(raw,BASKET_TTL);if(raw&&!items.length)localStorage.removeItem(BASKET_KEY);return items}catch{return[]}
}
function loadLastBasket(){
  try{const raw=localStorage.getItem(LAST_BASKET_KEY);const items=readSavedItems(raw,LAST_BASKET_TTL);if(raw&&!items.length)localStorage.removeItem(LAST_BASKET_KEY);return items}catch{return[]}
}
function loadReminder(){
  try{return {...REMINDER_DEFAULT,...(JSON.parse(localStorage.getItem(REMINDER_KEY))||{})}}
  catch{return {...REMINDER_DEFAULT}}
}
function timeParts(value='18:00'){
  const [h,m]=String(value||'18:00').split(':').map(Number);
  return {h:Number.isFinite(h)?h:18,m:Number.isFinite(m)?m:0};
}
function nextReminderDate(reminder){
  const now=new Date(); const {h,m}=timeParts(reminder.time); const result=new Date(now);
  result.setHours(h,m,0,0);
  let delta=(Number(reminder.day)-now.getDay()+7)%7;
  if(delta===0 && result<=now) delta=7;
  result.setDate(now.getDate()+delta); return result;
}
function nextReminderLabel(reminder){
  return new Intl.DateTimeFormat('en-ZA',{weekday:'long',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(nextReminderDate(reminder));
}
function reminderDueNow(reminder){
  if(!reminder.enabled || reminder.lastShown===localDateKey()) return false;
  const now=new Date(); if(now.getDay()!==Number(reminder.day)) return false;
  const {h,m}=timeParts(reminder.time); return (now.getHours()*60+now.getMinutes()) >= (h*60+m);
}
function icsStamp(date){
  const p=n=>String(n).padStart(2,'0');
  return `${date.getFullYear()}${p(date.getMonth()+1)}${p(date.getDate())}T${p(date.getHours())}${p(date.getMinutes())}00`;
}
function suggestedCarbsPerHour(durationHours,sessionType){
  const minutes=Math.max(30,Number(durationHours||0)*60);
  if(sessionType==='easy') return minutes<=90?0:50;
  if(sessionType==='intervals') return minutes<=120?60:90;
  if(sessionType==='long') return minutes<150?60:90;
  if(minutes<=75) return 0;
  if(minutes<=120) return 50;
  return 60;
}

export default function ShellNextV3(){
  const [section,setSectionState]=useState(()=>normalizeMainSection(window.history.state?.jfSection||localStorage.getItem(LAST_SECTION_KEY)||'Plan'));
  const [basket,setBasket]=useState(loadBasket);
  const [lastBasket,setLastBasket]=useState(loadLastBasket);
  const [basketOpen,setBasketOpen]=useState(false);
  const [reminder,setReminder]=useState(loadReminder);
  const [reminderDue,setReminderDue]=useState(false);
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installed,setInstalled]=useState(false);

  function applySection(value){const next=normalizeMainSection(value);setSectionState(next);localStorage.setItem(LAST_SECTION_KEY,next);return next}
  function setSection(value){const next=normalizeMainSection(value);if(next===section)return;setBasketOpen(false);applySection(next);window.history.pushState({...window.history.state,jfSection:next,jfBasket:false},'',window.location.href)}
  function openBasket(){if(basketOpen)return;setBasketOpen(true);if(!window.history.state?.jfBasket)window.history.pushState({...window.history.state,jfSection:section,jfBasket:true},'',window.location.href)}
  function closeBasket(){if(window.history.state?.jfBasket)window.history.back();else setBasketOpen(false)}
  function rememberBasket(items){if(!items?.length)return;setLastBasket(items.map(x=>({...x})))}
  function repeatLastBasket(){if(!lastBasket.length)return;setBasket(lastBasket.map(x=>({...x})));openBasket()}

  useEffect(()=>{
    if(!window.history.state?.jfSection)window.history.replaceState({...window.history.state,jfSection:section,jfBasket:false},'',window.location.href);
    const onPop=e=>{const next=normalizeMainSection(e.state?.jfSection||localStorage.getItem(LAST_SECTION_KEY)||'Plan');setSectionState(next);localStorage.setItem(LAST_SECTION_KEY,next);setBasketOpen(Boolean(e.state?.jfBasket))};
    window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
  },[]);

  useEffect(()=>{
    if(basket.length) localStorage.setItem(BASKET_KEY,JSON.stringify({savedAt:Date.now(),items:basket}));
    else localStorage.removeItem(BASKET_KEY);
  },[basket]);
  useEffect(()=>{if(lastBasket.length)localStorage.setItem(LAST_BASKET_KEY,JSON.stringify({savedAt:Date.now(),items:lastBasket}))},[lastBasket]);

  useEffect(()=>{
    const syncBasket=()=>setBasket(loadBasket());
    const open=()=>{syncBasket();openBasket()};
    if(sessionStorage.getItem('jf-open-basket-after-reload')==='1'){
      sessionStorage.removeItem('jf-open-basket-after-reload');
      open();
    }
    window.addEventListener('jf-basket-updated',syncBasket);
    window.addEventListener('jf-open-basket',open);
    return ()=>{window.removeEventListener('jf-basket-updated',syncBasket);window.removeEventListener('jf-open-basket',open)};
  },[section,basketOpen]);

  useEffect(()=>{
    localStorage.setItem(REMINDER_KEY,JSON.stringify(reminder));
    const check=()=>{
      const due=reminderDueNow(reminder); setReminderDue(due);
      if(due && reminder.lastNotified!==localDateKey() && 'Notification' in window && Notification.permission==='granted' && 'serviceWorker' in navigator){
        navigator.serviceWorker.ready.then(reg=>reg.showNotification('Just Fuel weekly fuel check',{body:'Check your fuel cupboard and plan what you need for the week.',tag:'just-fuel-weekly'}))
          .then(()=>setReminder(r=>({...r,lastNotified:localDateKey()}))).catch(()=>{});
      }
    };
    check(); const timer=setInterval(check,30000); return ()=>clearInterval(timer);
  },[reminder.enabled,reminder.day,reminder.time,reminder.lastShown,reminder.lastNotified]);

  useEffect(()=>{
    const standalone=window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;
    setInstalled(Boolean(standalone));
    const handler=e=>{e.preventDefault();setInstallPrompt(e)};
    window.addEventListener('beforeinstallprompt',handler); window.addEventListener('appinstalled',()=>setInstalled(true));
    return ()=>window.removeEventListener('beforeinstallprompt',handler);
  },[]);

  const basketCount=useMemo(()=>basket.reduce((n,x)=>n+x.quantity,0),[basket]);
  const basketTotal=useMemo(()=>basket.reduce((n,x)=>n+x.price*x.quantity,0),[basket]);

  function addLine(product,variant,quantity=1,{openBasket:shouldOpen=false}={}){
    const qty=Math.max(0,Number(quantity)||0); if(!qty || !product || !variant) return;
    setBasket(prev=>{
      const idx=prev.findIndex(x=>x.variantId===variant.id);
      const line={productKey:product.key,productTitle:product.title,variantId:variant.id,variantTitle:variant.title,price:Number(variant.price),image:variant.image||product.image,quantity:qty};
      if(idx<0) return [...prev,line];
      return prev.map((x,i)=>i===idx?{...x,quantity:x.quantity+qty}:x);
    });
    if(shouldOpen) openBasket();
  }
  function setLineQty(variantId,quantity){
    const qty=Math.max(0,Number(quantity)||0);
    setBasket(prev=>qty===0?prev.filter(x=>x.variantId!==variantId):prev.map(x=>x.variantId===variantId?{...x,quantity:qty}:x));
  }
  async function requestReminderPermission(){
    if(!('Notification' in window)) return 'unsupported';
    if(Notification.permission==='default'){try{return await Notification.requestPermission()}catch{return 'denied'}}
    return Notification.permission;
  }
  async function installApp(){
    if(!installPrompt) return; await installPrompt.prompt(); try{await installPrompt.userChoice}catch{} setInstallPrompt(null);
  }
  function dismissReminder(){setReminder(r=>({...r,lastShown:localDateKey()}));setReminderDue(false)}

  return <div className={`full-shell jf-next jf-v3 ${section==='Training'?'training-page':'light-page'}`}>
    {section!=='Training'&&<AppHeader count={basketCount} onBasket={openBasket}/>} 
    {section==='Training'&&<button className="training-basket" onClick={openBasket} aria-label="Open basket"><ShoppingBag size={22}/>{basketCount>0&&<span>{basketCount}</span>}</button>}
    {reminderDue&&section!=='Training'&&<ReminderBanner reminder={reminder} onPlan={()=>{setSection('Plan');dismissReminder()}} onDismiss={dismissReminder}/>} 

    <div className="shell-content">
      {section==='Plan'&&<FuelBuilder addLine={addLine} openBasket={openBasket}/>} 
      {section==='Learn'&&<LearnPage/>}
      {section==='Shop'&&<ShopPage addLine={addLine} openBasket={openBasket}/>} 
      {section==='Training'&&<TrainingApp/>}
      {section==='More'&&<MorePage reminder={reminder} setReminder={setReminder} requestReminderPermission={requestReminderPermission} installed={installed} installPrompt={installPrompt} installApp={installApp}/>} 
    </div>

    <nav className="bottom-nav" aria-label="Main navigation">{NAV.map(([label,Icon])=><button key={label} className={section===label?'active':''} onClick={()=>setSection(label)}><Icon size={25}/><span>{label}</span></button>)}</nav>
    <CheckoutDrawer open={basketOpen} close={closeBasket} basket={basket} lastBasket={lastBasket} repeatLastBasket={repeatLastBasket} remember={rememberBasket} count={basketCount} total={basketTotal} setQty={setLineQty} clear={()=>setBasket([])}/>
  </div>
}

function AppHeader({count,onBasket}){
  return <><div className="delivery-banner"><Truck size={18}/>PUDO delivery: R75 · Free over R600</div><header className="shell-header"><div className="jf-logo"><div><b>JUST</b><strong>FUEL</strong></div><small>ENDURANCE NUTRITION</small></div><button className="bag-button" onClick={onBasket} aria-label="Open basket"><ShoppingBag size={25}/><span className="bag-count">{count}</span></button></header></>
}
function ReminderBanner({reminder,onPlan,onDismiss}){
  return <div className="weekly-reminder"><Bell size={19}/><div><b>Weekly fuel check</b><span>{DAY_NAMES[Number(reminder.day)]} at {reminder.time} · check your cupboard and plan the week.</span></div><button onClick={onPlan}>Plan fuel</button><button className="reminder-x" onClick={onDismiss}><X size={18}/></button></div>
}

function MorePage({reminder,setReminder,requestReminderPermission,installed,installPrompt,installApp}){
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent); const [message,setMessage]=useState('');
  async function testReminder(){
    const permission=await requestReminderPermission();
    if(permission==='granted'&&'serviceWorker'in navigator){try{const reg=await navigator.serviceWorker.ready;await reg.showNotification('Just Fuel reminder test',{body:'Your weekly fuel reminder is working.',tag:'just-fuel-test'});setMessage('Test reminder sent.')}catch{setMessage('Could not send the test notification on this browser.')}}
    else if(permission==='denied')setMessage('Notifications are blocked in your browser settings.');else setMessage('Use the phone calendar option for a reliable closed-app reminder.');
  }
  function addToCalendar(){
    const start=nextReminderDate(reminder); const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Just Fuel//Weekly Fuel Reminder//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:just-fuel-weekly-${Date.now()}@justfuelnutrition.co.za`,`DTSTART:${icsStamp(start)}`,`RRULE:FREQ=WEEKLY;BYDAY=${DAY_CODES[Number(reminder.day)]}`,'SUMMARY:Just Fuel weekly fuel check','DESCRIPTION:Check your fuel cupboard and plan what you need for the week.','BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Just Fuel weekly fuel check','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
    const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='just-fuel-weekly-reminder.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Calendar reminder created. Open the downloaded file and add it to your calendar.');
  }
  function toggle(){const next=!reminder.enabled;setReminder(r=>({...REMINDER_DEFAULT,...r,enabled:next,lastShown:'',lastNotified:''}));if(next)requestReminderPermission()}
  return <main className="public-page more-page"><div className="page-kicker">JUST FUEL</div><h1>More</h1>
    <section className="settings-card reminder-card-v2"><div className="settings-title"><Bell size={21}/><div><h3>Weekly fuel reminder</h3><p>Choose exactly when you want to check your fuel.</p></div><button className={`toggle ${reminder.enabled?'on':''}`} onClick={toggle}><span/></button></div>{reminder.enabled&&<><div className="reminder-controls-v2"><label><span>Day</span><select value={reminder.day} onChange={e=>setReminder(r=>({...r,day:Number(e.target.value),lastShown:'',lastNotified:''}))}>{DAY_NAMES.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label><label><span>Time</span><div className="time-input-wrap"><Clock size={18}/><input type="time" value={reminder.time||'18:00'} onChange={e=>setReminder(r=>({...r,time:e.target.value||'18:00',lastShown:'',lastNotified:''}))}/></div></label></div><div className="reminder-summary-v2"><b>Every {DAY_NAMES[Number(reminder.day)]} at {reminder.time||'18:00'}</b><span>Next: {nextReminderLabel(reminder)}</span></div><div className="reminder-actions-v2"><button onClick={testReminder}><Bell size={17}/>Test now</button><button onClick={addToCalendar}><CalendarPlus size={17}/>Add to calendar</button></div>{message&&<div className="reminder-message-v2">{message}</div>}</>}<small>For a reliable alert while the app is closed, use the phone calendar option.</small></section>
    <section className="settings-card"><div className="settings-title"><Download size={21}/><div><h3>Install Just Fuel</h3><p>Keep the app on your home screen.</p></div></div>{installed?<div className="installed-row"><Check size={18}/>Installed</div>:installPrompt?<button className="install-button" onClick={installApp}>Install app</button>:ios?<div className="ios-steps"><b>iPhone / iPad</b><span>Safari → Share → Add to Home Screen.</span></div>:<div className="ios-steps"><b>Android</b><span>Chrome menu → Add to Home screen / Install app.</span></div>}</section>
    <div className="more-links"><a href={SHOP_DOMAIN} target="_blank" rel="noreferrer"><div><h3>Just Fuel website</h3><p>Product and company information.</p></div><ChevronRight/></a><a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer"><div><h3>WhatsApp us</h3><p>Orders and fueling help.</p></div><ChevronRight/></a></div>
    <div className="app-note"><Info size={18}/><span>Plan and Shop work without a Training login. Sign in under Training for Strava, race and training features.</span></div>
  </main>
}
