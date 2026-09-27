import React, { useMemo, useState } from 'react';
import { Check, Minus, Plus, ShoppingBag } from 'lucide-react';
import { CATALOG, byKey, money } from './catalog';

const LEARN = [
  {title:'Build a simple fuel plan',kicker:'FUEL BASICS',body:'Use Plan to get a suggested carbohydrate target from the session length and type, then adjust it if you already know what works for you.',bullets:['Use Auto for the simplest setup','Practise higher carbohydrate targets before race day','The basket is shared between Plan, Shop and Training']},
  {title:'Bottle Mix as your base',kicker:'DURING',body:'Bottle Mix puts carbohydrate into the bottle so you do not need to carry all of your fuel as gels.',bullets:['Use the bottle-duration option to match how quickly you drink','Sip consistently rather than waiting until you feel empty','Choose your preferred flavour before adding to basket']},
  {title:'Use Boost deliberately',kicker:'CAFFEINE',body:'Boost is an Energy Gel with 40 g carbohydrate and 100 mg caffeine. Use it deliberately rather than automatically for every session.',bullets:['Count Boost as one gel in the plan','Use it where caffeine is useful','Consider your total caffeine intake and tolerance']},
  {title:'Hydration changes with conditions',kicker:'HYDRATE',body:'Heat, sweat rate, intensity and access to water change hydration needs. Use your plan as a starting point, then adjust for the conditions.',bullets:['Hotter days normally need more fluid attention','Practise race hydration in training','Use thirst, conditions and personal experience together']},
  {title:'Recover after the work',kicker:'AFTER',body:'Recover combines carbohydrate and protein for a convenient post-session option alongside normal food, fluid and sleep.',bullets:['Most useful after longer or harder sessions','Normal meals still matter','Keep recovery practical and repeatable']}
];

function suggestedCarbsPerHour(durationHours,sessionType){
  const minutes=Math.max(30,Number(durationHours||0)*60);
  if(sessionType==='easy') return minutes<=90?0:50;
  if(sessionType==='intervals') return minutes<=120?60:90;
  if(sessionType==='long') return minutes<150?60:90;
  if(minutes<=75) return 0;
  if(minutes<=120) return 50;
  return 60;
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

export { FuelBuilder, ShopPage, LearnPage };
