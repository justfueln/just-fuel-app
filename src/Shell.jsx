import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, BookOpen, Calculator, CreditCard, MessageCircle, Minus,
  MoreHorizontal, Plus, ShoppingBag, Store, Trash2, Truck, X
} from 'lucide-react';
import TrainingApp from './App';
import { CATALOG, FREE_PUDO_THRESHOLD, SHOP_DOMAIN, WHATSAPP_NUMBER, byKey, money, numericVariantId } from './catalog';

const NAV = [
  ['Plan', Calculator],
  ['Learn', BookOpen],
  ['Shop', Store],
  ['Training', Activity],
  ['More', MoreHorizontal]
];
const BASKET_KEY = 'just-fuel-basket-v2';
const BASKET_TTL = 24 * 60 * 60 * 1000;

function loadBasket(){
  try{
    const raw = localStorage.getItem(BASKET_KEY);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    if(!parsed?.savedAt || Date.now() - parsed.savedAt > BASKET_TTL){
      localStorage.removeItem(BASKET_KEY);
      return [];
    }
    return Array.isArray(parsed.items) ? parsed.items : [];
  }catch{return []}
}

export default function Shell(){
  const [section,setSection] = useState('Plan');
  const [basket,setBasket] = useState(loadBasket);
  const [basketOpen,setBasketOpen] = useState(false);

  useEffect(()=>{
    if(basket.length) localStorage.setItem(BASKET_KEY,JSON.stringify({savedAt:Date.now(),items:basket}));
    else localStorage.removeItem(BASKET_KEY);
    if(!basket.length) return;
    const timer=setTimeout(()=>setBasket([]),BASKET_TTL);
    return ()=>clearTimeout(timer);
  },[basket]);

  const basketCount = useMemo(()=>basket.reduce((n,x)=>n+x.quantity,0),[basket]);
  const basketTotal = useMemo(()=>basket.reduce((n,x)=>n+x.price*x.quantity,0),[basket]);

  function addLine(product,variant,quantity=1,open=false){
    const qty=Math.max(0,Number(quantity)||0);
    if(!qty) return;
    setBasket(prev=>{
      const idx=prev.findIndex(x=>x.variantId===variant.id);
      if(idx<0) return [...prev,{
        productKey:product.key,
        productTitle:product.title,
        variantId:variant.id,
        variantTitle:variant.title,
        price:Number(variant.price),
        image:variant.image||product.image,
        quantity:qty
      }];
      return prev.map((x,i)=>i===idx?{...x,quantity:x.quantity+qty}:x);
    });
    if(open) setBasketOpen(true);
  }

  function setLineQty(variantId,quantity){
    const qty=Math.max(0,Number(quantity)||0);
    setBasket(prev=>qty===0?prev.filter(x=>x.variantId!==variantId):prev.map(x=>x.variantId===variantId?{...x,quantity:qty}:x));
  }

  return <div className={`full-shell ${section==='Training'?'training-page':'light-page'}`}>
    {section!=='Training' && <AppHeader count={basketCount} onBasket={()=>setBasketOpen(true)}/>} 
    {section==='Training' && <button className="training-basket" onClick={()=>setBasketOpen(true)} aria-label="Open basket"><ShoppingBag size={22}/>{basketCount>0&&<span>{basketCount}</span>}</button>}

    <div className="shell-content">
      {section==='Plan' && <FuelBuilder addLine={addLine}/>} 
      {section==='Learn' && <Learn/>}
      {section==='Shop' && <Shop addLine={addLine}/>} 
      {section==='Training' && <TrainingApp/>}
      {section==='More' && <More/>}
    </div>

    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV.map(([label,Icon])=><button key={label} className={section===label?'active':''} onClick={()=>setSection(label)}><Icon size={25}/><span>{label}</span></button>)}
    </nav>

    <BasketDrawer
      open={basketOpen}
      close={()=>setBasketOpen(false)}
      basket={basket}
      count={basketCount}
      total={basketTotal}
      setQty={setLineQty}
      clear={()=>setBasket([])}
    />
  </div>
}

function AppHeader({count,onBasket}){
  return <>
    <div className="delivery-banner"><Truck size={19}/>PUDO delivery: R75 · Free over R600</div>
    <header className="shell-header">
      <div className="wordmark"><b>JUST</b><strong>FUEL</strong><small>ENDURANCE NUTRITION</small></div>
      <button className="bag-button" onClick={onBasket} aria-label="Open basket"><ShoppingBag size={25}/>{count>0&&<span>{count}</span>}</button>
    </header>
  </>
}

function FuelBuilder({addLine}){
  const bottleProduct=byKey('bottle_mix');
  const gelProduct=byKey('energy_gel');
  const boostVariant=gelProduct.variants.find(v=>v.title==='Boost');
  const normalGels=gelProduct.variants.filter(v=>v.title!=='Boost');
  const [duration,setDuration] = useState(2);
  const [carbs,setCarbs] = useState(90);
  const [bottleMinutes,setBottleMinutes] = useState(90);
  const [bottleMl,setBottleMl] = useState(750);
  const [boost,setBoost] = useState(0);
  const [bottleVariantId,setBottleVariantId] = useState(bottleProduct.variants[0].id);
  const [gelVariantId,setGelVariantId] = useState(normalGels[0].id);

  const plan = useMemo(()=>{
    const totalMinutes=Math.max(30,Number(duration||0)*60);
    const hours=totalMinutes/60;
    const bottles=Math.max(1,Math.ceil(totalMinutes/Number(bottleMinutes)));
    const targetTotal=Math.round(Number(carbs)*hours);
    const fromBottles=bottles*59;
    const gels=Math.max(0,Math.round(Math.max(0,targetTotal-fromBottles)/40));
    const planned=fromBottles+gels*40;
    const actual=Math.round(planned/hours);
    const fluidPerHour=Math.round(Number(bottleMl)/(Number(bottleMinutes)/60));
    return {bottles,targetTotal,gels,planned,actual,fluidPerHour};
  },[duration,carbs,bottleMinutes,bottleMl]);

  const safeBoost=Math.min(boost,plan.gels);
  const regular=Math.max(0,plan.gels-safeBoost);

  function addPlan(){
    const bottleVariant=bottleProduct.variants.find(v=>v.id===bottleVariantId);
    const gelVariant=normalGels.find(v=>v.id===gelVariantId);
    addLine(bottleProduct,bottleVariant,plan.bottles,false);
    if(regular) addLine(gelProduct,gelVariant,regular,false);
    if(safeBoost) addLine(gelProduct,boostVariant,safeBoost,true);
    else addLine(bottleProduct,bottleVariant,0,true);
    window.dispatchEvent(new CustomEvent('jf-open-basket'));
  }

  useEffect(()=>{
    const handler=()=>{};
    window.addEventListener('jf-open-basket',handler);
    return ()=>window.removeEventListener('jf-open-basket',handler);
  },[]);

  return <main className="public-page planner-page">
    <div className="page-kicker">FUEL SMART. TRAIN HARD.</div>
    <h1>Fuel Planner</h1>
    <p className="page-lead">Tell us how long you are training. We work out the rest.</p>

    <section className="builder-card">
      <label className="big-label">Session duration
        <div className="duration-row"><button onClick={()=>setDuration(Math.max(.5,duration-.5))}>−</button><div><b>{duration}</b><span>hours</span></div><button onClick={()=>setDuration(duration+.5)}>+</button></div>
      </label>
      <div className="builder-label">Carbohydrate target</div>
      <div className="choice-grid">{[50,60,90,120].map(v=><button key={v} className={carbs===v?'selected':''} onClick={()=>setCarbs(v)}>{v}<small>g/h</small></button>)}</div>
      <details className="planner-advanced"><summary>Advanced options</summary>
        <div className="builder-label">One bottle lasts</div>
        <div className="choice-grid three">{[[60,'1h'],[90,'1.5h'],[120,'2h']].map(([v,l])=><button key={v} className={bottleMinutes===v?'selected':''} onClick={()=>setBottleMinutes(v)}>{l}</button>)}</div>
        <div className="builder-label">Bottle size</div>
        <div className="choice-grid two">{[500,750].map(v=><button key={v} className={bottleMl===v?'selected':''} onClick={()=>setBottleMl(v)}>{v} ml</button>)}</div>
      </details>
    </section>

    <section className="plan-result">
      <div className="result-title">For this session</div>
      <div className="result-grid">
        <div><b>{plan.bottles}</b><span>Bottle Mix</span></div>
        <div><b>{regular}</b><span>Regular gels</span></div>
        <div><b>{safeBoost}</b><span>Boost gels</span></div>
        <div><b>{plan.actual}</b><span>actual g/h</span></div>
      </div>
      {plan.gels>0 && <div className="boost-control"><span>Swap regular gels for Boost</span><div><button onClick={()=>setBoost(Math.max(0,safeBoost-1))}><Minus size={18}/></button><b>{safeBoost}</b><button onClick={()=>setBoost(Math.min(plan.gels,safeBoost+1))}><Plus size={18}/></button></div></div>}
      <p className="result-note">Target {plan.targetTotal} g carbs · plan provides {plan.planned} g · about {plan.fluidPerHour} ml fluid/h.</p>
      {carbs===120 && <p className="warning-note">120 g/h should only be used if you have already practised this intake successfully in training.</p>}

      <div className="planner-flavours">
        <label>Bottle Mix flavour<select value={bottleVariantId} onChange={e=>setBottleVariantId(e.target.value)}>{bottleProduct.variants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
        {regular>0&&<label>Regular gel flavour<select value={gelVariantId} onChange={e=>setGelVariantId(e.target.value)}>{normalGels.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>}
      </div>
      <button className="shop-plan" onClick={addPlan}><ShoppingBag size={18}/>Add this fuel to basket</button>
    </section>
  </main>
}

function Shop({addLine}){
  const [filter,setFilter] = useState('All fuel');
  const filters=['All fuel','Bottle Mix','Energy Gels','Hydrate','Recover','Protein'];
  const shown=filter==='All fuel'?CATALOG:CATALOG.filter(p=>p.category===filter);
  return <main className="public-page shop-page">
    <div className="page-kicker">FUEL SMART. TRAIN HARD.</div>
    <h1>Your next session.<br/><span>Sorted.</span></h1>
    <p className="page-lead">Choose your fuel, flavour and quantity without leaving the app.</p>
    <div className="category-scroll">{filters.map(f=><button className={filter===f?'active':''} key={f} onClick={()=>setFilter(f)}>{f}</button>)}</div>
    <div className="product-grid">{shown.map(p=><ProductCard product={p} addLine={addLine} key={p.key}/>)}</div>
  </main>
}

function ProductCard({product,addLine}){
  const [variantId,setVariantId]=useState(product.variants[0].id);
  const [qty,setQty]=useState(1);
  const variant=product.variants.find(v=>v.id===variantId)||product.variants[0];
  const img=variant.image||product.image;
  return <article className="product-card">
    <img src={img} alt={`${product.title} ${variant.title}`}/>
    <div className="product-body">
      <h3>{product.title}</h3><p>{product.subtitle}</p>
      {product.variants.length>1&&<label className="variant-label">Flavour<select value={variantId} onChange={e=>setVariantId(e.target.value)}>{product.variants.map(v=><option key={v.id} value={v.id}>{v.title}{v.note?` · ${v.note}`:''}</option>)}</select></label>}
      <div className="product-price">{money(variant.price)}</div>
      <div className="shop-add-row"><div className="qty-control"><button onClick={()=>setQty(Math.max(1,qty-1))}><Minus size={16}/></button><b>{qty}</b><button onClick={()=>setQty(qty+1)}><Plus size={16}/></button></div><button className="product-add" onClick={()=>addLine(product,variant,qty,true)}>Add</button></div>
    </div>
  </article>
}

function BasketDrawer({open,close,basket,count,total,setQty,clear}){
  const remaining=Math.max(0,FREE_PUDO_THRESHOLD-total);
  const progress=Math.min(100,(total/FREE_PUDO_THRESHOLD)*100);

  function checkoutOnline(){
    if(!basket.length) return;
    const lines=basket.map(x=>`${numericVariantId(x.variantId)}:${x.quantity}`).join(',');
    window.location.assign(`${SHOP_DOMAIN}/cart/${lines}?ref=just-fuel-app`);
  }

  function checkoutWhatsApp(){
    if(!basket.length) return;
    const lines=basket.map(x=>`• ${x.productTitle} — ${x.variantTitle} × ${x.quantity} — ${money(x.price*x.quantity)}`);
    const text=[
      'Hi Just Fuel, I would like to place an order:',
      '',
      ...lines,
      '',
      `Order total: ${money(total)}`,
      total>=FREE_PUDO_THRESHOLD?'PUDO: Free over R600':'PUDO: R75 below R600',
      '',
      'Please confirm availability and collection / delivery details.'
    ].join('\n');
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');
  }

  if(!open) return null;
  return <div className="basket-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
    <aside className="basket-drawer" aria-modal="true" role="dialog">
      <div className="basket-head"><div><span className="eyebrow-light">YOUR BASKET</span><h2>{count} {count===1?'item':'items'}</h2></div><button onClick={close} className="basket-close"><X size={24}/></button></div>
      {basket.length===0?<div className="basket-empty"><ShoppingBag size={36}/><h3>Your basket is empty</h3><p>Add fuel from Shop or the Fuel Planner.</p></div>:<>
        <div className="basket-lines">{basket.map(line=><div className="basket-line" key={line.variantId}>
          <img src={line.image} alt=""/>
          <div className="basket-line-main"><strong>{line.productTitle}</strong><span>{line.variantTitle}</span><b>{money(line.price*line.quantity)}</b></div>
          <div className="basket-line-actions"><button onClick={()=>setQty(line.variantId,line.quantity-1)}><Minus size={15}/></button><span>{line.quantity}</span><button onClick={()=>setQty(line.variantId,line.quantity+1)}><Plus size={15}/></button><button className="remove" onClick={()=>setQty(line.variantId,0)}><Trash2 size={16}/></button></div>
        </div>)}</div>

        <div className="delivery-progress"><div className="progress-copy">{remaining>0?<><b>{money(remaining)}</b> away from free PUDO delivery</>:<b>Free PUDO delivery unlocked</b>}</div><div className="progress-track"><span style={{width:`${progress}%`}}/></div></div>
        <div className="basket-total"><span>Total</span><strong>{money(total)}</strong></div>
        <button className="checkout-online" onClick={checkoutOnline}><CreditCard size={19}/>Online checkout</button>
        <button className="checkout-whatsapp" onClick={checkoutWhatsApp}><MessageCircle size={19}/>WhatsApp checkout</button>
        <button className="clear-basket" onClick={clear}>Clear basket</button>
      </>}
      <p className="basket-expiry">Basket resets after 24 hours of inactivity.</p>
    </aside>
  </div>
}

function Learn(){
  const links=[
    ['How to use your fuel','Simple guidance for Bottle Mix, gels, Hydrate and Recover.','https://www.justfuelnutrition.co.za/pages/faq'],
    ['Fuel packs','Starter, weekend and restock ideas.','https://www.justfuelnutrition.co.za/pages/fuel-packs'],
    ['Just Fuel story','Why we make practical, affordable endurance fuel.','https://www.justfuelnutrition.co.za/pages/our-story'],
    ['Latest articles','Training and fueling information from Just Fuel.','https://www.justfuelnutrition.co.za/blogs/news']
  ];
  return <main className="public-page"><div className="page-kicker">LEARN</div><h1>Simple fueling.<br/><span>No guesswork.</span></h1><div className="learn-list">{links.map(([t,d,u])=><a href={u} target="_blank" rel="noreferrer" key={t}><div><h3>{t}</h3><p>{d}</p></div><span>›</span></a>)}</div></main>
}

function More(){
  return <main className="public-page"><div className="page-kicker">JUST FUEL</div><h1>More</h1><div className="learn-list">
    <a href="https://www.justfuelnutrition.co.za" target="_blank" rel="noreferrer"><div><h3>Just Fuel website</h3><p>Products, information and company details.</p></div><span>›</span></a>
    <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer"><div><h3>WhatsApp us</h3><p>Questions, orders or fueling help.</p></div><span>›</span></a>
    <a href="https://www.justfuelnutrition.co.za/pages/contact" target="_blank" rel="noreferrer"><div><h3>Contact</h3><p>Collection, delivery and product support.</p></div><span>›</span></a>
  </div><p className="more-foot">Fuel smart. Train hard.</p></main>
}
