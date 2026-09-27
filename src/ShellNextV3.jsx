import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, BookOpen, Calculator, CalendarPlus, Check, ChevronRight, Clock, CreditCard,
  Download, Info, MessageCircle, Minus, MoreHorizontal, Plus, ShoppingBag,
  Store, Trash2, Truck, X
} from 'lucide-react';
import TrainingApp from './App';
import CheckoutDrawer from './CheckoutDrawer';
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

function FuelBuilder({addLine,openBasket}){
  const bottleProduct=byKey('bottle_mix'); const gelProduct=byKey('energy_gel');
  const boostVariant=gelProduct.variants.find(v=>v.title==='Boost');
  const regularVariants=gelProduct.variants.filter(v=>v.title!=='Boost');
  const [duration,setDuration]=useState(2);
  const [sessionType,setSessionType]=useState('endurance');
  const [carbMode,setCarbMode]=useState('auto');
  const [bottleMinutes,setBottleMinutes]=useState(90); const [bottleMl,setBottleMl]=useState(750); const [boost,setBoost]=useState(0);
  const [bottleVariantId,setBottleVariantId]=useState(bottleProduct.variants[0].id); const [gelVariantId,setGelVariantId]=useState(regularVariants[0].id);

  const suggested=useMemo(()=>suggestedCarbsPerHour(duration,sessionType),[duration,sessionType]);
  const carbs=carbMode==='auto'?suggested:Number(carbMode);
  const plan=useMemo(()=>{
    const totalMinutes=Math.max(30,Number(duration||0)*60),hours=totalMinutes/60;
    const bottles=carbs>0?Math.max(1,Math.ceil(totalMinutes/Number(bottleMinutes))):0;
    const targetTotal=Math.round(carbs*hours),fromBottles=bottles*59;
    const gels=Math.max(0,Math.round(Math.max(0,targetTotal-fromBottles)/40));
    const planned=fromBottles+gels*40;
    return {bottles,targetTotal,gels,planned,actual:hours?Math.round(planned/hours):0,fluidPerHour:Math.round(Number(bottleMl)/(Number(bottleMinutes)/60))};
  },[duration,carbs,bottleMinutes,bottleMl]);
  const safeBoost=Math.min(boost,plan.gels),regular=Math.max(0,plan.gels-safeBoost);

  function addPlan(){
    const bottle=bottleProduct.variants.find(v=>v.id===bottleVariantId); const gel=regularVariants.find(v=>v.id===gelVariantId);
    if(plan.bottles)addLine(bottleProduct,bottle,plan.bottles);
    if(regular)addLine(gelProduct,gel,regular);
    if(safeBoost)addLine(gelProduct,boostVariant,safeBoost);
    openBasket();
  }

  return <main className="public-page planner-page planner-v3">
    <div className="page-kicker">FUEL SMART. TRAIN HARD.</div><h1>Build your<br/><span>fuel plan.</span></h1><p className="page-lead">Two quick choices. We suggest the carb target; you can change it.</p>
    <section className="builder-card planner-flow-card">
      <div className="flow-step"><span>1</span><div><b>How long are you riding?</b><small>Session duration</small></div></div>
      <div className="duration-row"><button onClick={()=>setDuration(Math.max(.5,duration-.5))}>−</button><div><b>{duration}</b><span>hours</span></div><button onClick={()=>setDuration(duration+.5)}>+</button></div>

      <div className="flow-step"><span>2</span><div><b>What kind of session?</b><small>This helps us suggest carbs per hour.</small></div></div>
      <div className="session-type-grid">
        {[['easy','Easy'],['endurance','Endurance'],['intervals','Intervals'],['long','Long / race']].map(([v,l])=><button key={v} className={sessionType===v?'selected':''} onClick={()=>{setSessionType(v);setCarbMode('auto')}}>{l}</button>)}
      </div>

      <div className="carb-target-head"><div><span>SUGGESTED TARGET</span><strong>{suggested} g/h</strong></div><p>Auto adapts to session type and duration.</p></div>
      <button className={`auto-carb-button ${carbMode==='auto'?'selected':''}`} onClick={()=>setCarbMode('auto')}><Check size={18}/>Use suggested target · {suggested} g/h</button>
      <div className="manual-carb-label">Or choose your own</div>
      <div className="choice-grid">{[50,60,90,120].map(v=><button key={v} className={String(carbMode)===String(v)?'selected':''} onClick={()=>setCarbMode(String(v))}>{v}<small>g/h</small></button>)}</div>
      <div className="carb-mode-note">Using: <b>{carbs} g/h</b>{carbMode==='auto'?' · suggested':' · manual override'}</div>

      <details className="planner-advanced"><summary>Advanced bottle options</summary><div className="builder-label">One bottle lasts</div><div className="choice-grid three">{[[60,'1h'],[90,'1.5h'],[120,'2h']].map(([v,l])=><button key={v} className={bottleMinutes===v?'selected':''} onClick={()=>setBottleMinutes(v)}>{l}</button>)}</div><div className="builder-label">Bottle size</div><div className="choice-grid two">{[500,750].map(v=><button key={v} className={bottleMl===v?'selected':''} onClick={()=>setBottleMl(v)}>{v} ml</button>)}</div></details>
    </section>

    <section className="plan-result"><div className="result-title">YOUR SESSION FUEL</div><div className="result-grid"><div><b>{plan.bottles}</b><span>Bottle Mix</span></div><div><b>{regular}</b><span>Regular gels</span></div><div><b>{safeBoost}</b><span>Boost gels</span></div><div><b>{plan.actual}</b><span>actual g/h</span></div></div>
      {plan.gels>0&&<div className="boost-control"><span>Swap regular gels for Boost</span><div><button onClick={()=>setBoost(Math.max(0,safeBoost-1))}><Minus size={18}/></button><b>{safeBoost}</b><button onClick={()=>setBoost(Math.min(plan.gels,safeBoost+1))}><Plus size={18}/></button></div></div>}
      {carbs===0?<p className="result-note">No compulsory carbohydrate suggested for this short/easy session. Water/electrolytes may still be useful depending on conditions.</p>:<p className="result-note">Target {plan.targetTotal} g · plan provides {plan.planned} g · about {plan.fluidPerHour} ml fluid/h if using the selected bottle timing.</p>}
      {carbs===120&&<p className="warning-note">120 g/h is an advanced target. Use it only if you have already practised and tolerate this intake.</p>}
      {carbs>0&&<div className="planner-flavours"><label>Bottle Mix flavour<select value={bottleVariantId} onChange={e=>setBottleVariantId(e.target.value)}>{bottleProduct.variants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>{regular>0&&<label>Regular gel flavour<select value={gelVariantId} onChange={e=>setGelVariantId(e.target.value)}>{regularVariants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>}</div>}
      <button className="shop-plan" disabled={plan.bottles+plan.gels===0} onClick={addPlan}><ShoppingBag size={18}/>{plan.bottles+plan.gels>0?'Add session fuel to basket':'No carb products required'}</button>
    </section>
  </main>
}

function ShopPage({addLine,openBasket}){
  const [productKey,setProductKey]=useState('energy_gel');
  const [quantities,setQuantities]=useState({});
  const [added,setAdded]=useState('');
  const product=byKey(productKey)||CATALOG[0];
  const productQty=product.variants.reduce((n,v)=>n+Number(quantities[v.id]||0),0);
  const productValue=product.variants.reduce((n,v)=>n+Number(quantities[v.id]||0)*Number(v.price),0);
  const setQty=(id,value)=>setQuantities(q=>({...q,[id]:Math.max(0,Number(value)||0)}));
  function addSelected(){
    product.variants.forEach(v=>{const qty=Number(quantities[v.id]||0);if(qty)addLine(product,v,qty)});
    if(productQty){setAdded(`${productQty} ${product.title} item${productQty===1?'':'s'} added to basket.`);setQuantities(q=>{const next={...q};product.variants.forEach(v=>{next[v.id]=0});return next;});}
  }

  return <main className="public-page shop-page shop-v3">
    <div className="page-kicker">SHOP</div><h1>Choose exactly<br/><span>what you want.</span></h1><p className="page-lead">Select a product, set the quantity for each flavour, then add everything once.</p>
    <div className="shop-product-tabs">{CATALOG.map(p=><button key={p.key} className={productKey===p.key?'active':''} onClick={()=>{setProductKey(p.key);setAdded('')}}>{p.title==='Energy Gel'?'Gels':p.title.replace(' Shake','')}</button>)}</div>

    <section className="shop-order-card">
      <div className="shop-product-hero"><img src={product.image} alt={product.title}/><div><span>{product.category}</span><h2>{product.title}</h2><p>{product.subtitle}</p><b>{product.variants.length>1?`From ${money(Math.min(...product.variants.map(v=>v.price)))}`:money(product.variants[0].price)}</b></div></div>
      <div className="variant-order-list">{product.variants.map(v=>{
        const qty=Number(quantities[v.id]||0);
        return <div className={`variant-order-row ${qty>0?'has-qty':''}`} key={v.id}><img src={v.image||product.image} alt=""/><div className="variant-order-copy"><strong>{v.title}</strong>{v.note&&<small>{v.note}</small>}<span>{money(v.price)}</span></div><div className="variant-stepper"><button onClick={()=>setQty(v.id,qty-1)}><Minus size={17}/></button><b>{qty}</b><button onClick={()=>setQty(v.id,qty+1)}><Plus size={17}/></button></div></div>
      })}</div>
      <div className="shop-selection-summary"><div><span>Selected</span><b>{productQty} items</b></div><strong>{money(productValue)}</strong></div>
      <button className="shop-add-selected" disabled={!productQty} onClick={addSelected}><ShoppingBag size={19}/>Add selected {product.title} to basket</button>
      {added&&<div className="shop-added-message"><Check size={17}/>{added}<button onClick={openBasket}>View basket</button></div>}
    </section>
  </main>
}

function LearnPage(){
  return <main className="public-page learn-page"><div className="page-kicker">LEARN</div><h1>Simple fueling.<br/><span>No guesswork.</span></h1><p className="page-lead">Short, practical guidance that stays inside the app.</p><div className="learn-cards">{LEARN.map((x,i)=><details key={x.title} open={i===0}><summary><div><span>{x.kicker}</span><h3>{x.title}</h3></div><Plus size={20}/></summary><div className="learn-body"><p>{x.body}</p><ul>{x.bullets.map(b=><li key={b}>{b}</li>)}</ul></div></details>)}</div></main>
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
