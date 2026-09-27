import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, Flag, Fuel, Home, ShoppingBag, Store } from 'lucide-react';
import TrainingApp from './App';
import CheckoutDrawer from './CheckoutDrawer';
import MorePage, { ReminderBanner } from './MorePage';
import useWeeklyReminder from './useWeeklyReminder';
import { FuelBuilder, ShopPage, LearnPage } from './CommercePages';
import HomeIndex from './HomeIndex';
import { APP_ROUTES, BOTTOM_NAV, trainingTabForRoute } from './navigation-registry';
import { basketTtlMs, lastBasketTtlMs, normalizeMainSection, readSavedItems, resolveInitialMainSection } from './app-state-utils';

const NAV_ICONS={home:Home,training:Activity,race:Flag,fuel:Fuel,shop:Store};
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
  const [section,setSectionState]=useState(()=>resolveInitialMainSection({historyState:window.history.state,search:window.location.search,pathname:window.location.pathname}));
  const [homeView,setHomeView]=useState(()=>window.history.state?.jfHomeView||'index');
  const [basket,setBasket]=useState(loadBasket);
  const [lastBasket,setLastBasket]=useState(loadLastBasket);
  const [basketOpen,setBasketOpen]=useState(false);
  const {reminder,setReminder,reminderDue,requestReminderPermission,dismissReminder}=useWeeklyReminder();
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installed,setInstalled]=useState(false);

  const isTrainingArea=['training','race','fuel'].includes(section);

  function applySection(value){const next=normalizeMainSection(value);setSectionState(next);return next}
  function setSection(value){
    const next=normalizeMainSection(value);
    const targetTab=trainingTabForRoute(next);
    setBasketOpen(false);
    if(next==='home')setHomeView('index');
    applySection(next);
    window.history.pushState({...window.history.state,jfSection:next,jfTrainingTab:targetTab||window.history.state?.jfTrainingTab,jfHomeView:next==='home'?'index':window.history.state?.jfHomeView,jfBasket:false},'',window.location.href);
  }
  function openHomeView(value){
    const next=value||'index';
    setHomeView(next);
    window.history.pushState({...window.history.state,jfSection:'home',jfHomeView:next,jfBasket:false},'',window.location.href);
  }
  function openBasket(){if(basketOpen)return;setBasketOpen(true);if(!window.history.state?.jfBasket)window.history.pushState({...window.history.state,jfSection:section,jfHomeView:homeView,jfBasket:true},'',window.location.href)}
  function closeBasket(){if(window.history.state?.jfBasket)window.history.back();else setBasketOpen(false)}
  function rememberBasket(items){if(!items?.length)return;setLastBasket(items.map(x=>({...x})))}
  function repeatLastBasket(){if(!lastBasket.length)return;setBasket(lastBasket.map(x=>({...x})));openBasket()}

  useEffect(()=>{
    const url=new URL(window.location.href);
    const stravaReturn=url.pathname==='/strava-return'||url.searchParams.has('strava');
    if(stravaReturn){
      url.pathname='/';
      url.searchParams.delete('strava');
      url.searchParams.delete('detail');
      url.searchParams.delete('jfcb');
    }
    const nextUrl=stravaReturn?`${url.pathname}${url.search}${url.hash}`:window.location.href;
    const targetTab=trainingTabForRoute(section);
    window.history.replaceState({...window.history.state,jfSection:section,jfTrainingTab:targetTab||window.history.state?.jfTrainingTab,jfHomeView:section==='home'?(window.history.state?.jfHomeView||homeView):window.history.state?.jfHomeView,jfBasket:false},'',nextUrl);
    const onPop=e=>{
      const next=normalizeMainSection(e.state?.jfSection||'home');
      setSectionState(next);
      setHomeView(e.state?.jfHomeView||'index');
      setBasketOpen(Boolean(e.state?.jfBasket));
    };
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
  },[section,basketOpen,homeView]);

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

  return <div className={`full-shell jf-next jf-v3 current-shell ${isTrainingArea?'training-page':'current-page'}`}>
    {!isTrainingArea&&<CurrentAppHeader count={basketCount} onBasket={openBasket}/>} 
    {isTrainingArea&&<button className="training-basket" onClick={openBasket} aria-label="Open basket"><ShoppingBag size={22}/>{basketCount>0&&<span>{basketCount}</span>}</button>}
    {reminderDue&&!isTrainingArea&&<ReminderBanner reminder={reminder} onPlan={()=>{if(section!=='home')applySection('home');openHomeView('plan');dismissReminder()}} onDismiss={dismissReminder}/>} 

    <div className="shell-content">
      {section==='home'&&homeView==='index'&&<HomeIndex goRoute={setSection} openHomeView={openHomeView}/>} 
      {section==='home'&&homeView!=='index'&&<HomeSubpageHead title={homeView==='plan'?'Quick Fuel Planner':homeView==='learn'?'Learn':'Settings & Reminders'} onBack={()=>window.history.back()}/>} 
      {section==='home'&&homeView==='plan'&&<FuelBuilder addLine={addLine} openBasket={openBasket}/>} 
      {section==='home'&&homeView==='learn'&&<LearnPage/>}
      {section==='home'&&homeView==='settings'&&<MorePage reminder={reminder} setReminder={setReminder} requestReminderPermission={requestReminderPermission} installed={installed} installPrompt={installPrompt} installApp={installApp}/>} 
      {section==='shop'&&<ShopPage addLine={addLine} openBasket={openBasket}/>} 
      {isTrainingArea&&<TrainingApp key={section}/>} 
    </div>

    <nav className="bottom-nav phase1-nav" aria-label="Main navigation">{BOTTOM_NAV.map(id=>{const route=APP_ROUTES[id],Icon=NAV_ICONS[id];return <button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}><Icon size={25}/><span>{route.label}</span></button>})}</nav>
    <CheckoutDrawer open={basketOpen} close={closeBasket} basket={basket} lastBasket={lastBasket} repeatLastBasket={repeatLastBasket} remember={rememberBasket} count={basketCount} total={basketTotal} setQty={setLineQty} clear={()=>setBasket([])}/>
  </div>
}

function CurrentAppHeader({count,onBasket}){
  return <header className="current-app-header"><div><div className="current-brand">JUST FUEL</div><div className="current-subbrand">FUEL SMART • TRAIN HARD</div></div><button className="current-bag-button" onClick={onBasket} aria-label="Open basket"><ShoppingBag size={24}/>{count>0&&<span>{count}</span>}</button></header>
}

function HomeSubpageHead({title,onBack}){
  return <div className="home-subpage-head"><button onClick={onBack} aria-label="Back to Home"><ArrowLeft size={20}/></button><div><span>HOME</span><strong>{title}</strong></div></div>;
}
