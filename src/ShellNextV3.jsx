import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, Flag, Fuel, Home, ShoppingBag, Store, UserRound } from 'lucide-react';
import TrainingApp from './App';
import CheckoutDrawer from './CheckoutDrawer';
import { ReminderBanner } from './MorePage';
import useWeeklyReminder from './useWeeklyReminder';
import { FuelBuilder, ShopPage, LearnPage } from './CommercePages';
import HomeIndex from './HomeIndex';
import FuelHubV2 from './FuelHubV2';
import ProfileHub from './ProfileHub';
import { APP_ROUTES, BOTTOM_NAV, TRAINING_NAV, normalizeFuelView, trainingTabForRoute, trainingTargetForView, trainingViewFromState } from './navigation-registry';
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
function resetScroll(){window.scrollTo({top:0,left:0,behavior:'auto'})}

export default function ShellNextV3(){
  const [section,setSectionState]=useState(()=>resolveInitialMainSection({historyState:window.history.state,search:window.location.search,pathname:window.location.pathname}));
  const [homeView,setHomeView]=useState(()=>window.history.state?.jfHomeView||'index');
  const [trainingView,setTrainingView]=useState(()=>trainingViewFromState(window.history.state||{}));
  const [fuelView,setFuelView]=useState(()=>normalizeFuelView(window.history.state?.jfFuelView));
  const [profileOpen,setProfileOpen]=useState(()=>Boolean(window.history.state?.jfProfile));
  const [basket,setBasket]=useState(loadBasket);
  const [lastBasket,setLastBasket]=useState(loadLastBasket);
  const [basketOpen,setBasketOpen]=useState(false);
  const {reminder,setReminder,reminderDue,requestReminderPermission,dismissReminder}=useWeeklyReminder();
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installed,setInstalled]=useState(false);

  const isTrainingArea=['training','race'].includes(section);

  function applySection(value){const next=normalizeMainSection(value);setSectionState(next);return next}
  function setSection(value,options={}){
    const next=normalizeMainSection(value);
    const targetTab=trainingTabForRoute(next);
    const nextFuelView=next==='fuel'?normalizeFuelView(options.fuelView||'home'):fuelView;
    setBasketOpen(false);setProfileOpen(false);
    if(next==='home')setHomeView('index');
    if(next==='training')setTrainingView('plan');
    if(next==='fuel')setFuelView(nextFuelView);
    applySection(next);
    window.history.pushState({
      ...window.history.state,
      jfSection:next,
      jfTrainingTab:targetTab||window.history.state?.jfTrainingTab,
      jfTrainingView:next==='training'?'plan':window.history.state?.jfTrainingView,
      jfTrainingSubView:next==='training'?null:window.history.state?.jfTrainingSubView,
      jfFuelView:next==='fuel'?nextFuelView:window.history.state?.jfFuelView,
      jfHomeView:next==='home'?'index':window.history.state?.jfHomeView,
      jfProfile:false,
      jfBasket:false
    },'',window.location.href);
    resetScroll();
  }
  function openTrainingView(value){
    const target=trainingTargetForView(value);
    setTrainingView(target.id);
    window.history.pushState({...window.history.state,jfSection:'training',jfTrainingTab:target.legacyTab,jfTrainingView:target.id,jfTrainingSubView:target.subView,jfProfile:false,jfBasket:false},'',window.location.href);
    resetScroll();
  }
  function openHomeView(value){
    const next=value||'index';
    setHomeView(next);
    window.history.pushState({...window.history.state,jfSection:'home',jfHomeView:next,jfProfile:false,jfBasket:false},'',window.location.href);
    resetScroll();
  }
  function openProfile(){if(profileOpen)return;setBasketOpen(false);setProfileOpen(true);window.history.pushState({...window.history.state,jfSection:section,jfProfile:true,jfBasket:false},'',window.location.href);resetScroll()}
  function closeProfile(){if(window.history.state?.jfProfile)window.history.back();else setProfileOpen(false)}
  function openBasket(){if(basketOpen)return;setProfileOpen(false);setBasketOpen(true);if(!window.history.state?.jfBasket)window.history.pushState({...window.history.state,jfSection:section,jfHomeView:homeView,jfTrainingView:trainingView,jfFuelView:fuelView,jfProfile:false,jfBasket:true},'',window.location.href)}
  function closeBasket(){if(window.history.state?.jfBasket)window.history.back();else setBasketOpen(false)}
  function rememberBasket(items){if(!items?.length)return;setLastBasket(items.map(x=>({...x})))}
  function repeatLastBasket(){if(!lastBasket.length)return;setBasket(lastBasket.map(x=>({...x})));openBasket()}

  useEffect(()=>{
    const url=new URL(window.location.href);
    const stravaReturn=url.pathname==='/strava-return'||url.searchParams.has('strava');
    if(stravaReturn){url.pathname='/';url.searchParams.delete('strava');url.searchParams.delete('detail');url.searchParams.delete('jfcb')}
    const nextUrl=stravaReturn?`${url.pathname}${url.search}${url.hash}`:window.location.href;
    const targetTab=trainingTabForRoute(section);
    const initialTrainingView=section==='training'?trainingViewFromState(window.history.state||{}):trainingView;
    const target=trainingTargetForView(initialTrainingView);
    const initialFuelView=section==='fuel'?normalizeFuelView(window.history.state?.jfFuelView):fuelView;
    if(section==='training')setTrainingView(initialTrainingView);
    if(section==='fuel')setFuelView(initialFuelView);
    window.history.replaceState({...window.history.state,jfSection:section,jfTrainingTab:section==='training'?target.legacyTab:(targetTab||window.history.state?.jfTrainingTab),jfTrainingView:section==='training'?initialTrainingView:window.history.state?.jfTrainingView,jfTrainingSubView:section==='training'?target.subView:window.history.state?.jfTrainingSubView,jfFuelView:section==='fuel'?initialFuelView:window.history.state?.jfFuelView,jfHomeView:section==='home'?(window.history.state?.jfHomeView||homeView):window.history.state?.jfHomeView,jfProfile:Boolean(window.history.state?.jfProfile),jfBasket:false},'',nextUrl);
    const onPop=e=>{
      const next=normalizeMainSection(e.state?.jfSection||'home');
      setSectionState(next);setHomeView(e.state?.jfHomeView||'index');setTrainingView(trainingViewFromState(e.state||{}));setFuelView(normalizeFuelView(e.state?.jfFuelView));setProfileOpen(Boolean(e.state?.jfProfile));setBasketOpen(Boolean(e.state?.jfBasket));
      if(!e.state?.jfBasket)requestAnimationFrame(resetScroll);
    };
    window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
  },[]);

  useEffect(()=>{if(basket.length)localStorage.setItem(BASKET_KEY,JSON.stringify({savedAt:Date.now(),items:basket}));else localStorage.removeItem(BASKET_KEY)},[basket]);
  useEffect(()=>{if(lastBasket.length)localStorage.setItem(LAST_BASKET_KEY,JSON.stringify({savedAt:Date.now(),items:lastBasket}))},[lastBasket]);
  useEffect(()=>{
    const syncBasket=()=>setBasket(loadBasket());const open=()=>{syncBasket();openBasket()};
    if(sessionStorage.getItem('jf-open-basket-after-reload')==='1'){sessionStorage.removeItem('jf-open-basket-after-reload');open()}
    window.addEventListener('jf-basket-updated',syncBasket);window.addEventListener('jf-open-basket',open);
    return()=>{window.removeEventListener('jf-basket-updated',syncBasket);window.removeEventListener('jf-open-basket',open)};
  },[section,basketOpen,homeView,trainingView,fuelView,profileOpen]);

  useEffect(()=>{
    const standalone=window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;setInstalled(Boolean(standalone));
    const handler=e=>{e.preventDefault();setInstallPrompt(e)};window.addEventListener('beforeinstallprompt',handler);window.addEventListener('appinstalled',()=>setInstalled(true));
    return()=>window.removeEventListener('beforeinstallprompt',handler);
  },[]);

  const basketCount=useMemo(()=>basket.reduce((n,x)=>n+x.quantity,0),[basket]);
  const basketTotal=useMemo(()=>basket.reduce((n,x)=>n+x.price*x.quantity,0),[basket]);

  function addLine(product,variant,quantity=1,{openBasket:shouldOpen=false}={}){
    const qty=Math.max(0,Number(quantity)||0);if(!qty||!product||!variant)return;
    setBasket(prev=>{const idx=prev.findIndex(x=>x.variantId===variant.id);const line={productKey:product.key,productTitle:product.title,variantId:variant.id,variantTitle:variant.title,price:Number(variant.price),image:variant.image||product.image,quantity:qty};if(idx<0)return[...prev,line];return prev.map((x,i)=>i===idx?{...x,quantity:x.quantity+qty}:x)});
    if(shouldOpen)openBasket();
  }
  function setLineQty(variantId,quantity){const qty=Math.max(0,Number(quantity)||0);setBasket(prev=>qty===0?prev.filter(x=>x.variantId!==variantId):prev.map(x=>x.variantId===variantId?{...x,quantity:qty}:x))}
  async function installApp(){if(!installPrompt)return;await installPrompt.prompt();try{await installPrompt.userChoice}catch{}setInstallPrompt(null)}

  return <div className={`full-shell jf-next jf-v3 current-shell phase5-profile-shell ${profileOpen?'profile-open ':''}${isTrainingArea?'training-page phase2-training-shell':'current-page'}`}>
    {(!isTrainingArea||profileOpen)&&<CurrentAppHeader count={basketCount} onBasket={openBasket} onProfile={profileOpen?closeProfile:openProfile} profileOpen={profileOpen}/>} 
    {isTrainingArea&&!profileOpen&&<><button className="training-profile-button" onClick={openProfile} aria-label="Profile and settings"><UserRound size={21}/></button><button className="training-basket" onClick={openBasket} aria-label="Open basket"><ShoppingBag size={22}/>{basketCount>0&&<span>{basketCount}</span>}</button></>}
    {reminderDue&&!isTrainingArea&&!profileOpen&&<ReminderBanner reminder={reminder} onPlan={()=>{setSection('fuel',{fuelView:'planner'});dismissReminder()}} onDismiss={dismissReminder}/>} 

    <div className="shell-content">
      {profileOpen?<ProfileHub onClose={closeProfile} reminder={reminder} setReminder={setReminder} requestReminderPermission={requestReminderPermission} installed={installed} installPrompt={installPrompt} installApp={installApp}/>:<>
        {section==='home'&&homeView==='index'&&<HomeIndex goRoute={setSection} openHomeView={openHomeView}/>} 
        {section==='home'&&homeView!=='index'&&<HomeSubpageHead title={homeView==='plan'?'Quick Fuel Planner':homeView==='learn'?'Learn':'Settings & Reminders'} onBack={()=>window.history.back()}/>} 
        {section==='home'&&homeView==='plan'&&<FuelBuilder addLine={addLine} openBasket={openBasket}/>} 
        {section==='home'&&homeView==='learn'&&<LearnPage/>}
        {section==='shop'&&<ShopPage addLine={addLine} openBasket={openBasket}/>} 
        {section==='training'&&<TrainingPhaseNav value={trainingView} onChange={openTrainingView}/>} 
        {section==='fuel'&&<FuelHubV2 addLine={addLine} openBasket={openBasket} viewTarget={fuelView} onViewChange={setFuelView}/>} 
        {isTrainingArea&&<TrainingApp key={`${section}-${section==='training'?trainingView:'root'}`}/>} 
      </>}
    </div>

    {!profileOpen&&<nav className="bottom-nav phase1-nav" aria-label="Main navigation">{BOTTOM_NAV.map(id=>{const route=APP_ROUTES[id],Icon=NAV_ICONS[id];return <button key={id} className={section===id?'active':''} onClick={()=>setSection(id)}><Icon size={25}/><span>{route.label}</span></button>})}</nav>}
    <CheckoutDrawer open={basketOpen} close={closeBasket} basket={basket} lastBasket={lastBasket} repeatLastBasket={repeatLastBasket} remember={rememberBasket} count={basketCount} total={basketTotal} setQty={setLineQty} clear={()=>setBasket([])}/>
  </div>
}

function TrainingPhaseNav({value,onChange}){return <nav className="training-phase2-nav" aria-label="Training pages">{TRAINING_NAV.map(item=><button key={item.id} className={value===item.id?'active':''} onClick={()=>onChange(item.id)}>{item.label}</button>)}</nav>}
function CurrentAppHeader({count,onBasket,onProfile,profileOpen}){return <header className="current-app-header"><div><div className="current-brand">JUST FUEL</div><div className="current-subbrand">FUEL SMART • TRAIN HARD</div></div><div className="current-header-actions"><button className={`current-profile-button ${profileOpen?'active':''}`} onClick={onProfile} aria-label="Profile and settings"><UserRound size={22}/></button><button className="current-bag-button" onClick={onBasket} aria-label="Open basket"><ShoppingBag size={24}/>{count>0&&<span>{count}</span>}</button></div></header>}
function HomeSubpageHead({title,onBack}){return <div className="home-subpage-head"><button onClick={onBack} aria-label="Back to Home"><ArrowLeft size={20}/></button><div><span>HOME</span><strong>{title}</strong></div></div>}
