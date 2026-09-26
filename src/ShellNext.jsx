import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, BookOpen, Calculator, Check, ChevronRight, CreditCard,
  Download, Info, MessageCircle, Minus, MoreHorizontal, Plus, ShoppingBag,
  Store, Trash2, Truck, X
} from 'lucide-react';
import TrainingApp from './App';
import {
  CATALOG, FREE_PUDO_THRESHOLD, SHOP_DOMAIN, WHATSAPP_NUMBER,
  byKey, money, numericVariantId
} from './catalog';

const NAV = [
  ['Plan', Calculator],
  ['Learn', BookOpen],
  ['Shop', Store],
  ['Training', Activity],
  ['More', MoreHorizontal]
];
const BASKET_KEY = 'just-fuel-basket-v3';
const BASKET_TTL = 24 * 60 * 60 * 1000;
const REMINDER_KEY = 'just-fuel-weekly-reminder';
const LAST_SECTION_KEY = 'just-fuel-last-section';
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const LEARN = [
  {
    title:'Build a simple fuel plan', kicker:'FUEL BASICS',
    body:'Use the Plan tab to match your Bottle Mix and gels to the length of your session. Keep it simple enough to repeat in training.',
    bullets:['Bottle Mix: 59 g carbohydrate per sachet','Energy Gel: 40 g carbohydrate per gel','Practise the same routine you plan to use on race day']
  },
  {
    title:'Bottle Mix as your base', kicker:'DURING',
    body:'Bottle Mix gives you carbohydrate in your bottle so you do not have to carry all of your fuel as gels.',
    bullets:['Mix one sachet with water as directed','Sip through the session rather than waiting until you feel empty','Use the bottle-duration setting in Plan to match your own drinking pattern']
  },
  {
    title:'Use Boost deliberately', kicker:'CAFFEINE',
    body:'Boost is an Energy Gel with 40 g carbohydrate and 100 mg caffeine. It is a tool for selected harder moments, not something every session needs.',
    bullets:['Useful when you deliberately want caffeine in your plan','Count Boost as one of your gels','Consider your total caffeine intake and personal tolerance']
  },
  {
    title:'Hydration changes with conditions', kicker:'HYDRATE',
    body:'Heat, sweat rate, ride intensity and access to water all change what you need. Hydrate is there to support your electrolyte plan.',
    bullets:['Use your own thirst and conditions as part of the plan','Hotter sessions usually need more attention to fluid and electrolytes','Race-day hydration should be practised before the event']
  },
  {
    title:'Recover after the work', kicker:'AFTER',
    body:'Recover combines carbohydrate and protein in a convenient post-session shake. Use it as part of your normal recovery food and fluid routine.',
    bullets:['Useful after longer or harder training','Recovery also includes normal meals, fluids and sleep','Keep the routine practical enough to repeat']
  },
  {
    title:'Train with what you race', kicker:'RACE DAY',
    body:'The best race plan is one you have already tested. Use Training and Race Fuel to practise quantities, flavours, bottle timing and caffeine before race day.',
    bullets:['Do not introduce a brand-new high carbohydrate target on race day','Test flavour and gut tolerance in training','Use the same shared basket when you are ready to restock']
  }
];

function loadBasket(){
  try{
    const raw=localStorage.getItem(BASKET_KEY);
    if(!raw) return [];
    const parsed=JSON.parse(raw);
    if(!parsed?.savedAt || Date.now()-parsed.savedAt>BASKET_TTL){
      localStorage.removeItem(BASKET_KEY); return [];
    }
    return Array.isArray(parsed.items)?parsed.items:[];
  }catch{return []}
}

function loadReminder(){
  try{
    return JSON.parse(localStorage.getItem(REMINDER_KEY)) || {enabled:false,day:0,lastShown:''};
  }catch{return {enabled:false,day:0,lastShown:''}}
}

function todayKey(){return new Date().toISOString().slice(0,10)}

export default function ShellNext(){
  const [section,setSectionState]=useState(()=>localStorage.getItem(LAST_SECTION_KEY)||'Plan');
  const [basket,setBasket]=useState(loadBasket);
  const [basketOpen,setBasketOpen]=useState(false);
  const [selectedProduct,setSelectedProduct]=useState(null);
  const [reminder,setReminder]=useState(loadReminder);
  const [reminderDue,setReminderDue]=useState(false);
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installed,setInstalled]=useState(false);

  const setSection=(value)=>{setSectionState(value);localStorage.setItem(LAST_SECTION_KEY,value)};

  useEffect(()=>{
    if(basket.length) localStorage.setItem(BASKET_KEY,JSON.stringify({savedAt:Date.now(),items:basket}));
    else localStorage.removeItem(BASKET_KEY);
    if(!basket.length) return;
    const timer=setTimeout(()=>setBasket([]),BASKET_TTL);
    return ()=>clearTimeout(timer);
  },[basket]);

  useEffect(()=>{
    localStorage.setItem(REMINDER_KEY,JSON.stringify(reminder));
    const check=()=>{
      const due=reminder.enabled && new Date().getDay()===Number(reminder.day) && reminder.lastShown!==todayKey();
      setReminderDue(due);
      if(due && Notification?.permission==='granted' && 'serviceWorker' in navigator){
        navigator.serviceWorker.ready.then(reg=>reg.showNotification('Just Fuel weekly fuel check',{body:'Check your fuel cupboard and plan what you need for the week.',tag:'just-fuel-weekly'})).catch(()=>{});
      }
    };
    check();
    const timer=setInterval(check,60000);
    return ()=>clearInterval(timer);
  },[reminder.enabled,reminder.day,reminder.lastShown]);

  useEffect(()=>{
    const standalone=window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone===true;
    setInstalled(Boolean(standalone));
    const handler=e=>{e.preventDefault();setInstallPrompt(e)};
    window.addEventListener('beforeinstallprompt',handler);
    window.addEventListener('appinstalled',()=>setInstalled(true));
    return ()=>window.removeEventListener('beforeinstallprompt',handler);
  },[]);

  const basketCount=useMemo(()=>basket.reduce((n,x)=>n+x.quantity,0),[basket]);
  const basketTotal=useMemo(()=>basket.reduce((n,x)=>n+x.price*x.quantity,0),[basket]);

  function addLine(product,variant,quantity=1,{openBasket=false}={}){
    const qty=Math.max(0,Number(quantity)||0); if(!qty) return;
    setBasket(prev=>{
      const idx=prev.findIndex(x=>x.variantId===variant.id);
      const line={productKey:product.key,productTitle:product.title,variantId:variant.id,variantTitle:variant.title,price:Number(variant.price),image:variant.image||product.image,quantity:qty};
      if(idx<0) return [...prev,line];
      return prev.map((x,i)=>i===idx?{...x,quantity:x.quantity+qty}:x);
    });
    if(openBasket)setBasketOpen(true);
  }

  function setLineQty(variantId,quantity){
    const qty=Math.max(0,Number(quantity)||0);
    setBasket(prev=>qty===0?prev.filter(x=>x.variantId!==variantId):prev.map(x=>x.variantId===variantId?{...x,quantity:qty}:x));
  }

  function dismissReminder(){
    setReminder(r=>({...r,lastShown:todayKey()})); setReminderDue(false);
  }

  async function requestReminderPermission(){
    if('Notification' in window && Notification.permission==='default'){
      try{await Notification.requestPermission()}catch{}
    }
  }

  async function installApp(){
    if(!installPrompt) return;
    await installPrompt.prompt();
    try{await installPrompt.userChoice}catch{}
    setInstallPrompt(null);
  }

  return <div className={`full-shell jf-next ${section==='Training'?'training-page':'light-page'}`}>
    {section!=='Training' && <AppHeader count={basketCount} onBasket={()=>setBasketOpen(true)}/>} 
    {section==='Training' && <button className="training-basket" onClick={()=>setBasketOpen(true)} aria-label="Open basket"><ShoppingBag size={22}/>{basketCount>0&&<span>{basketCount}</span>}</button>}

    {reminderDue && section!=='Training' && <ReminderBanner onPlan={()=>{setSection('Plan');dismissReminder()}} onDismiss={dismissReminder}/>} 

    <div className="shell-content">
      {section==='Plan' && <FuelBuilder addLine={addLine} openBasket={()=>setBasketOpen(true)}/>} 
      {section==='Learn' && <LearnPage/>}
      {section==='Shop' && <ShopPage choose={setSelectedProduct}/>} 
      {section==='Training' && <TrainingApp/>}
      {section==='More' && <MorePage reminder={reminder} setReminder={setReminder} requestReminderPermission={requestReminderPermission} installed={installed} installPrompt={installPrompt} installApp={installApp}/>} 
    </div>

    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV.map(([label,Icon])=><button key={label} className={section===label?'active':''} onClick={()=>setSection(label)}><Icon size={25}/><span>{label}</span></button>)}
    </nav>

    <ProductSheet product={selectedProduct} close={()=>setSelectedProduct(null)} addLine={addLine}/>
    <BasketDrawer open={basketOpen} close={()=>setBasketOpen(false)} basket={basket} count={basketCount} total={basketTotal} setQty={setLineQty} clear={()=>setBasket([])}/>
  </div>
}

function AppHeader({count,onBasket}){
  return <>
    <div className="delivery-banner"><Truck size={18}/>PUDO delivery: R75 · Free over R600</div>
    <header className="shell-header">
      <div className="jf-logo"><div><b>JUST</b><strong>FUEL</strong></div><small>ENDURANCE NUTRITION</small></div>
      <button className="bag-button" onClick={onBasket} aria-label="Open basket"><ShoppingBag size={25}/><span className="bag-count">{count}</span></button>
    </header>
  </>
}

function ReminderBanner({onPlan,onDismiss}){
  return <div className="weekly-reminder"><Bell size={19}/><div><b>Weekly fuel check</b><span>Check your cupboard and plan what you need for the week.</span></div><button onClick={onPlan}>Plan fuel</button><button className="reminder-x" onClick={onDismiss}><X size={18}/></button></div>
}

function FuelBuilder({addLine,openBasket}){
  const bottleProduct=byKey('bottle_mix');
  const gelProduct=byKey('energy_gel');
  const boostVariant=gelProduct.variants.find(v=>v.title==='Boost');
  const regularVariants=gelProduct.variants.filter(v=>v.title!=='Boost');
  const [duration,setDuration]=useState(2);
  const [carbs,setCarbs]=useState(90);
  const [bottleMinutes,setBottleMinutes]=useState(90);
  const [bottleMl,setBottleMl]=useState(750);
  const [boost,setBoost]=useState(0);
  const [bottleVariantId,setBottleVariantId]=useState(bottleProduct.variants[0].id);
  const [gelVariantId,setGelVariantId]=useState(regularVariants[0].id);

  const plan=useMemo(()=>{
    const totalMinutes=Math.max(30,Number(duration||0)*60), hours=totalMinutes/60;
    const bottles=Math.max(1,Math.ceil(totalMinutes/Number(bottleMinutes)));
    const targetTotal=Math.round(Number(carbs)*hours), fromBottles=bottles*59;
    const gels=Math.max(0,Math.round(Math.max(0,targetTotal-fromBottles)/40));
    const planned=fromBottles+gels*40;
    return {bottles,targetTotal,gels,planned,actual:Math.round(planned/hours),fluidPerHour:Math.round(Number(bottleMl)/(Number(bottleMinutes)/60))};
  },[duration,carbs,bottleMinutes,bottleMl]);

  const safeBoost=Math.min(boost,plan.gels), regular=Math.max(0,plan.gels-safeBoost);
  function addPlan(){
    const bottle=bottleProduct.variants.find(v=>v.id===bottleVariantId);
    const gel=regularVariants.find(v=>v.id===gelVariantId);
    addLine(bottleProduct,bottle,plan.bottles);
    if(regular)addLine(gelProduct,gel,regular);
    if(safeBoost)addLine(gelProduct,boostVariant,safeBoost);
    openBasket();
  }

  return <main className="public-page planner-page">
    <div className="page-kicker">FUEL SMART. TRAIN HARD.</div>
    <h1>Build your<br/><span>fuel plan.</span></h1>
    <p className="page-lead">Give us the session length. Keep everything else simple.</p>

    <section className="builder-card">
      <div className="big-label">Session duration</div>
      <div className="duration-row"><button onClick={()=>setDuration(Math.max(.5,duration-.5))}>−</button><div><b>{duration}</b><span>hours</span></div><button onClick={()=>setDuration(duration+.5)}>+</button></div>
      <div className="builder-label">Carbohydrate target</div>
      <div className="choice-grid">{[50,60,90,120].map(v=><button key={v} className={carbs===v?'selected':''} onClick={()=>setCarbs(v)}>{v}<small>g/h</small></button>)}</div>
      <details className="planner-advanced"><summary>Advanced options</summary>
        <div className="builder-label">One bottle lasts</div><div className="choice-grid three">{[[60,'1h'],[90,'1.5h'],[120,'2h']].map(([v,l])=><button key={v} className={bottleMinutes===v?'selected':''} onClick={()=>setBottleMinutes(v)}>{l}</button>)}</div>
        <div className="builder-label">Bottle size</div><div className="choice-grid two">{[500,750].map(v=><button key={v} className={bottleMl===v?'selected':''} onClick={()=>setBottleMl(v)}>{v} ml</button>)}</div>
      </details>
    </section>

    <section className="plan-result">
      <div className="result-title">YOUR SESSION FUEL</div>
      <div className="result-grid"><div><b>{plan.bottles}</b><span>Bottle Mix</span></div><div><b>{regular}</b><span>Regular gels</span></div><div><b>{safeBoost}</b><span>Boost gels</span></div><div><b>{plan.actual}</b><span>actual g/h</span></div></div>
      {plan.gels>0&&<div className="boost-control"><span>Swap regular gels for Boost</span><div><button onClick={()=>setBoost(Math.max(0,safeBoost-1))}><Minus size={18}/></button><b>{safeBoost}</b><button onClick={()=>setBoost(Math.min(plan.gels,safeBoost+1))}><Plus size={18}/></button></div></div>}
      <p className="result-note">Target {plan.targetTotal} g · plan provides {plan.planned} g · about {plan.fluidPerHour} ml fluid/h.</p>
      {carbs===120&&<p className="warning-note">120 g/h should only be used if you have already practised this intake successfully in training.</p>}
      <div className="planner-flavours"><label>Bottle Mix flavour<select value={bottleVariantId} onChange={e=>setBottleVariantId(e.target.value)}>{bottleProduct.variants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>{regular>0&&<label>Regular gel flavour<select value={gelVariantId} onChange={e=>setGelVariantId(e.target.value)}>{regularVariants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>}</div>
      <button className="shop-plan" onClick={addPlan}><ShoppingBag size={18}/>Add fuel to basket</button>
    </section>
  </main>
}

function ShopPage({choose}){
  const [filter,setFilter]=useState('All fuel');
  const filters=['All fuel','Bottle Mix','Energy Gels','Hydrate','Recover','Protein'];
  const shown=filter==='All fuel'?CATALOG:CATALOG.filter(p=>p.category===filter);
  return <main className="public-page shop-page">
    <div className="page-kicker">FUEL SMART. TRAIN HARD.</div>
    <h1>Your next session.<br/><span>Sorted.</span></h1>
    <p className="page-lead">Pick the product. Choose your flavour. Add it to one basket.</p>
    <div className="category-scroll">{filters.map(f=><button className={filter===f?'active':''} key={f} onClick={()=>setFilter(f)}>{f}</button>)}</div>
    <div className="product-grid">{shown.map(p=><button className="product-card product-card-button" onClick={()=>choose(p)} key={p.key}><div className="product-image-wrap"><span className="usage-tag">{p.key==='recover'||p.key==='pea_protein'?'AFTER':'DURING'}</span><img src={p.image} alt={p.title}/></div><div className="product-body"><h3>{p.title}</h3><p>{p.subtitle}</p><b>{p.variants.length>1?`From ${money(Math.min(...p.variants.map(v=>v.price)))}`:money(p.variants[0].price)}</b><span className="choose-row">Choose options <ChevronRight size={17}/></span></div></button>)}</div>
  </main>
}

function ProductSheet({product,close,addLine}){
  const [variantId,setVariantId]=useState('');
  const [qty,setQty]=useState(1);
  useEffect(()=>{if(product){setVariantId(product.variants[0].id);setQty(1)}},[product?.key]);
  if(!product)return null;
  const variant=product.variants.find(v=>v.id===variantId)||product.variants[0];
  return <div className="sheet-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><aside className="product-sheet"><div className="sheet-grab"/><button className="sheet-close" onClick={close}><X size={22}/></button><img className="sheet-image" src={variant.image||product.image} alt=""/><div className="sheet-copy"><span className="sheet-kicker">{product.category}</span><h2>{product.title}</h2><p>{product.subtitle}</p><strong>{money(variant.price)}</strong></div>{product.variants.length>1&&<div className="flavour-pills"><div className="builder-label">Choose flavour</div>{product.variants.map(v=><button key={v.id} className={variant.id===v.id?'selected':''} onClick={()=>setVariantId(v.id)}>{v.title}{v.note&&<small>{v.note}</small>}</button>)}</div>}<div className="sheet-bottom"><div className="qty-control large"><button onClick={()=>setQty(Math.max(1,qty-1))}><Minus size={18}/></button><b>{qty}</b><button onClick={()=>setQty(qty+1)}><Plus size={18}/></button></div><button className="sheet-add" onClick={()=>{addLine(product,variant,qty);close()}}>Add {qty} · {money(variant.price*qty)}</button></div></aside></div>
}

function BasketDrawer({open,close,basket,count,total,setQty,clear}){
  const remaining=Math.max(0,FREE_PUDO_THRESHOLD-total), progress=Math.min(100,(total/FREE_PUDO_THRESHOLD)*100);
  function checkoutOnline(){if(!basket.length)return;const lines=basket.map(x=>`${numericVariantId(x.variantId)}:${x.quantity}`).join(',');window.location.assign(`${SHOP_DOMAIN}/cart/${lines}?ref=just-fuel-app`)}
  function checkoutWhatsApp(){if(!basket.length)return;const lines=basket.map(x=>`• ${x.productTitle} — ${x.variantTitle} × ${x.quantity} — ${money(x.price*x.quantity)}`);const text=['Hi Just Fuel, I would like to place an order:','',...lines,'',`Order total: ${money(total)}`,total>=FREE_PUDO_THRESHOLD?'PUDO: Free over R600':'PUDO: R75 below R600','','Please confirm availability and collection / delivery details.'].join('\n');window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer')}
  if(!open)return null;
  return <div className="basket-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><aside className="basket-drawer"><div className="basket-head"><div><span className="eyebrow-light">YOUR BASKET</span><h2>{count} {count===1?'item':'items'}</h2></div><button onClick={close} className="basket-close"><X size={24}/></button></div>{basket.length===0?<div className="basket-empty"><ShoppingBag size={36}/><h3>Your basket is empty</h3><p>Add fuel from Shop or Plan.</p></div>:<><div className="basket-lines">{basket.map(line=><div className="basket-line" key={line.variantId}><img src={line.image} alt=""/><div className="basket-line-main"><strong>{line.productTitle}</strong><span>{line.variantTitle}</span><b>{money(line.price*line.quantity)}</b></div><div className="basket-line-actions"><button onClick={()=>setQty(line.variantId,line.quantity-1)}><Minus size={15}/></button><span>{line.quantity}</span><button onClick={()=>setQty(line.variantId,line.quantity+1)}><Plus size={15}/></button><button className="remove" onClick={()=>setQty(line.variantId,0)}><Trash2 size={16}/></button></div></div>)}</div><div className="delivery-progress"><div className="progress-copy">{remaining>0?<><b>{money(remaining)}</b> away from free PUDO delivery</>:<b>Free PUDO delivery unlocked</b>}</div><div className="progress-track"><span style={{width:`${progress}%`}}/></div></div><div className="basket-total"><span>Total</span><strong>{money(total)}</strong></div><button className="checkout-online" onClick={checkoutOnline}><CreditCard size={19}/>Online checkout</button><button className="checkout-whatsapp" onClick={checkoutWhatsApp}><MessageCircle size={19}/>WhatsApp checkout</button><button className="clear-basket" onClick={clear}>Clear basket</button></>}<p className="basket-expiry">Basket resets after 24 hours of inactivity.</p></aside></div>
}

function LearnPage(){
  return <main className="public-page learn-page"><div className="page-kicker">LEARN</div><h1>Simple fueling.<br/><span>No guesswork.</span></h1><p className="page-lead">Short, practical guidance that stays inside the app.</p><div className="learn-cards">{LEARN.map((x,i)=><details key={x.title} open={i===0}><summary><div><span>{x.kicker}</span><h3>{x.title}</h3></div><Plus size={20}/></summary><div className="learn-body"><p>{x.body}</p><ul>{x.bullets.map(b=><li key={b}>{b}</li>)}</ul></div></details>)}</div><a className="learn-more-link" href={`${SHOP_DOMAIN}/blogs/news`} target="_blank" rel="noreferrer">More Just Fuel articles <ChevronRight size={18}/></a></main>
}

function MorePage({reminder,setReminder,requestReminderPermission,installed,installPrompt,installApp}){
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  function toggleReminder(){const next=!reminder.enabled;setReminder(r=>({...r,enabled:next,lastShown:''}));if(next)requestReminderPermission()}
  return <main className="public-page more-page"><div className="page-kicker">JUST FUEL</div><h1>More</h1>
    <section className="settings-card"><div className="settings-title"><Bell size={21}/><div><h3>Weekly fuel reminder</h3><p>One simple reminder to check your fuel for the week.</p></div><button className={`toggle ${reminder.enabled?'on':''}`} onClick={toggleReminder}><span/></button></div>{reminder.enabled&&<label className="reminder-day">Reminder day<select value={reminder.day} onChange={e=>setReminder(r=>({...r,day:Number(e.target.value),lastShown:''}))}>{DAY_NAMES.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label>}<small>In-app reminders work whenever you open the app. Device notifications are also used where your browser allows them.</small></section>
    <section className="settings-card"><div className="settings-title"><Download size={21}/><div><h3>Install Just Fuel</h3><p>Keep the app on your home screen for faster access.</p></div></div>{installed?<div className="installed-row"><Check size={18}/>Installed on this device</div>:installPrompt?<button className="install-button" onClick={installApp}>Install app</button>:ios?<div className="ios-steps"><b>iPhone / iPad</b><span>Tap Share in Safari → Add to Home Screen → Add.</span></div>:<div className="ios-steps"><b>Android</b><span>Open this page in Chrome and use the browser menu → Add to Home screen / Install app.</span></div>}</section>
    <div className="more-links"><a href={SHOP_DOMAIN} target="_blank" rel="noreferrer"><div><h3>Just Fuel website</h3><p>Company and product information.</p></div><ChevronRight/></a><a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer"><div><h3>WhatsApp us</h3><p>Questions, orders or fueling help.</p></div><ChevronRight/></a><a href={`${SHOP_DOMAIN}/pages/contact`} target="_blank" rel="noreferrer"><div><h3>Delivery & contact</h3><p>Collection and support details.</p></div><ChevronRight/></a></div>
    <div className="app-note"><Info size={18}/><span>Fuel planning and shopping work without Training login. Sign in under Training only when you want Strava, race and training features.</span></div>
  </main>
}
