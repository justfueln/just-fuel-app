import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BookOpen, Calculator, MoreHorizontal, ShoppingBag, Store, Truck } from 'lucide-react';
import TrainingApp from './App';
import CheckoutDrawer from './CheckoutDrawer';
import MorePage, { ReminderBanner } from './MorePage';
import useWeeklyReminder from './useWeeklyReminder';
import { FuelBuilder, ShopPage, LearnPage } from './CommercePages';
import { basketTtlMs, lastBasketTtlMs, normalizeMainSection, readSavedItems, resolveInitialMainSection } from './app-state-utils';

const NAV = [
  ['Plan', Calculator], ['Learn', BookOpen], ['Shop', Store], ['Training', Activity], ['More', MoreHorizontal]
];
const BASKET_KEY = 'just-fuel-basket-v3';
const LAST_BASKET_KEY = 'just-fuel-last-basket-v1';
const BASKET_TTL = basketTtlMs;
const LAST_BASKET_TTL = lastBasketTtlMs;

function loadBasket(){
  try{const raw=localStorage.getItem(BASKET_KEY);const items=readSavedItems(raw,BASKET_TTL);if(raw&&!items.length)localStorage.removeItem(BASKET_KEY);return items}catch{return[]}
}
function loadLastBasket(){
  try{const raw=localStorage.getItem(LAST_BASKET_KEY);const items=readSavedItems(raw,LAST_BASKET_TTL);if(raw&&!items.length)localStorage.removeItem(LAST_BASKET_KEY);return items}catch{return[]}
}

export default function ShellNextV3(){
  const [section,setSectionState]=useState(()=>resolveInitialMainSection({historyState:window.history.state,search:window.location.search}));
  const [basket,setBasket]=useState(loadBasket);
  const [lastBasket,setLastBasket]=useState(loadLastBasket);
  const [basketOpen,setBasketOpen]=useState(false);
  const {reminder,setReminder,reminderDue,requestReminderPermission,dismissReminder}=useWeeklyReminder();
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installed,setInstalled]=useState(false);

  function applySection(value){const next=normalizeMainSection(value);setSectionState(next);return next}
  function setSection(value){const next=normalizeMainSection(value);if(next===section)return;setBasketOpen(false);applySection(next);window.history.pushState({...window.history.state,jfSection:next,jfBasket:false},'',window.location.href)}
  function openBasket(){if(basketOpen)return;setBasketOpen(true);if(!window.history.state?.jfBasket)window.history.pushState({...window.history.state,jfSection:section,jfBasket:true},'',window.location.href)}
  function closeBasket(){if(window.history.state?.jfBasket)window.history.back();else setBasketOpen(false)}
  function rememberBasket(items){if(!items?.length)return;setLastBasket(items.map(x=>({...x})))}
  function repeatLastBasket(){if(!lastBasket.length)return;setBasket(lastBasket.map(x=>({...x})));openBasket()}

  useEffect(()=>{
    const url=new URL(window.location.href);
    const stravaReturn=url.searchParams.has('strava');
    if(stravaReturn){
      url.searchParams.delete('strava');
      url.searchParams.delete('detail');
    }
    const nextUrl=stravaReturn?`${url.pathname}${url.search}${url.hash}`:window.location.href;
    window.history.replaceState({...window.history.state,jfSection:section,jfTrainingTab:section==='Training'?'Overview':window.history.state?.jfTrainingTab,jfBasket:false},'',nextUrl);
    const onPop=e=>{const next=normalizeMainSection(e.state?.jfSection||'Plan');setSectionState(next);setBasketOpen(Boolean(e.state?.jfBasket))};
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
  async function installApp(){
    if(!installPrompt) return; await installPrompt.prompt(); try{await installPrompt.userChoice}catch{} setInstallPrompt(null);
  }

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
