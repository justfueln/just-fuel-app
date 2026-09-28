import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ChevronRight,Droplets,Fuel,Gauge,PackageCheck,RefreshCw,Save,ShoppingBag,SlidersHorizontal} from 'lucide-react';
import {supabase} from './main';
import {FuelBuilder} from './CommercePages';
import TrainingFuelReview from './TrainingFuelReview';
import {byKey} from './catalog';
import {fetchFuelTrainingPlan,fetchTrainingFuelBase,fetchTrainingFuelForecast} from './training-api';
import {hydratePacks,restockShortfalls} from './fuel-utils';
import {FUEL_NAV,normalizeFuelView} from './navigation-registry';

const fmtDate=v=>v?new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`)):'—';
const mins=v=>{const n=Math.max(0,Math.round(Number(v)||0)),h=Math.floor(n/60),m=n%60;return h?`${h}h${m?` ${m}m`:''}`:`${m}m`};
const todayKey=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const addDays=days=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+days);const p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const n=v=>Math.max(0,Number(v)||0);
const deliveryLabel=value=>({bottle_first:'Bottle-first',gels_first:'Gels-first',brick_split:'Bike bottles + run gels',session_support:'Hydration + recovery',poolside:'Poolside',mixed:'Mixed'}[String(value||'')]||'Balanced');
const friendlyFuelError=error=>{
  if(!error)return'';
  const text=String(error.message||error);
  if(/statement timeout|canceling statement/i.test(text))return'Fuel forecast did not finish loading. Tap refresh to try again.';
  return'Some fuel data could not load. Tap refresh to try again.';
};

const PRODUCT_ROWS=[
  ['bottle_mix','Bottle Mix','sachets'],
  ['energy_gel','Regular gels','gels'],
  ['boost_gel','Boost','gels'],
  ['hydrate','Hydrate','servings'],
  ['recover','Recover','servings']
];

export default function FuelHubV2({addLine,openBasket,viewTarget='home',onViewChange}){
  const[view,setView]=useState(()=>normalizeFuelView(viewTarget||window.history.state?.jfFuelView));
  const[session,setSession]=useState(null);
  const[loading,setLoading]=useState(true);
  const[message,setMessage]=useState('');
  const[plan,setPlan]=useState([]);
  const[forecast,setForecast]=useState([]);
  const[forecastReady,setForecastReady]=useState(false);
  const[stock,setStock]=useState([]);
  const[fuelProfile,setFuelProfile]=useState(null);
  const mountedRef=useRef(true);
  const autoLoadedUserRef=useRef('');
  const loadPromiseRef=useRef(null);

  useEffect(()=>setView(normalizeFuelView(viewTarget)),[viewTarget]);
  useEffect(()=>{
    mountedRef.current=true;
    let mounted=true;
    const clearUser=()=>{setPlan([]);setForecast([]);setForecastReady(false);setStock([]);setFuelProfile(null);setLoading(false)};
    const autoLoad=next=>{
      if(!mounted)return;
      setSession(next||null);
      const uid=next?.user?.id||'';
      if(!uid){autoLoadedUserRef.current='';clearUser();return}
      if(autoLoadedUserRef.current===uid)return;
      autoLoadedUserRef.current=uid;
      loadAll(uid);
    };
    supabase.auth.getSession().then(({data})=>autoLoad(data.session));
    const{data:sub}=supabase.auth.onAuthStateChange((event,next)=>{
      if(!mounted)return;
      setSession(next||null);
      if(event==='TOKEN_REFRESHED'&&next?.user?.id===autoLoadedUserRef.current)return;
      autoLoad(next);
    });
    return()=>{mounted=false;mountedRef.current=false;sub.subscription.unsubscribe()};
  },[]);

  async function loadAll(userId=session?.user?.id){
    if(!userId)return;
    if(loadPromiseRef.current)return loadPromiseRef.current;
    const task=(async()=>{
      if(mountedRef.current){setLoading(true);setMessage('')}
      const[planResult,baseResult,forecastResult]=await Promise.all([
        fetchFuelTrainingPlan(supabase,userId),fetchTrainingFuelBase(supabase,userId),fetchTrainingFuelForecast(supabase,userId)
      ]);
      if(!mountedRef.current)return;
      const error=planResult.error||baseResult.error||forecastResult.error;
      if(error)setMessage(friendlyFuelError(error));
      setPlan(planResult.plan||[]);
      setStock(baseResult.stock||[]);
      setFuelProfile(baseResult.fuelProfile||null);
      setForecast(forecastResult.fuel||[]);
      setForecastReady(!forecastResult.error);
      setLoading(false);
    })();
    loadPromiseRef.current=task;
    try{return await task}finally{if(loadPromiseRef.current===task)loadPromiseRef.current=null}
  }

  function go(next){
    const id=normalizeFuelView(next);
    setView(id);onViewChange?.(id);
    window.history.pushState({...window.history.state,jfSection:'fuel',jfFuelView:id,jfBasket:false},'',window.location.href);
    window.scrollTo({top:0,behavior:'auto'});
  }
  function back(){if(view==='home')return;window.history.back()}

  const futurePlan=useMemo(()=>plan.filter(row=>row.session_date>=todayKey()),[plan]);
  const week=useMemo(()=>futurePlan.filter(row=>row.session_date<addDays(7)),[futurePlan]);
  const weekTotals=useMemo(()=>tallySessions(week),[week]);
  const weekShortfalls=useMemo(()=>forecastReady?restockShortfalls(forecast.filter(x=>Number(x.horizon_days)===7)):({}),[forecast,forecastReady]);
  const shortfallUnits=useMemo(()=>forecastReady?orderUnits(weekShortfalls):0,[weekShortfalls,forecastReady]);

  if(view==='planner')return <FuelPageFrame title="Quick Fuel Planner" subtitle="Build a simple session fuel plan." onBack={back}><FuelBuilder addLine={addLine} openBasket={openBasket}/></FuelPageFrame>;
  if(view==='review')return <FuelPageFrame title="Fuel Review" subtitle="Compare planned fuel with what you actually used." onBack={back}><TrainingFuelReview/></FuelPageFrame>;
  if(view==='training')return <FuelPageFrame title="Training Fuel" subtitle="Sport-aware fuel, hydration and recovery for upcoming training." onBack={back}><TrainingFuel plan={futurePlan} fuelProfile={fuelProfile} userId={session?.user?.id} reload={loadAll} addLine={addLine} openBasket={openBasket}/></FuelPageFrame>;
  if(view==='stock')return <FuelPageFrame title="My Stock" subtitle="Keep your cupboard stock up to date." onBack={back}><StockPage session={session} stock={stock} reload={loadAll}/></FuelPageFrame>;
  if(view==='order')return <FuelPageFrame title="Order Needed" subtitle="Only the shortfall for your selected training horizon." onBack={back}><OrderNeeded forecast={forecastReady?forecast:[]} addLine={addLine} openBasket={openBasket}/></FuelPageFrame>;

  return <div className="fuel-v2-shell">
    <header className="fuel-v2-head">
      <div><span className="eyebrow">FUEL</span><h2>Your fueling hub</h2><p>Plan it, practise it, review it and keep enough stock for the training ahead.</p></div>
      {session?.user&&<button className="icon-btn" onClick={()=>loadAll()} disabled={loading} aria-label="Refresh fuel"><RefreshCw size={18}/></button>}
    </header>

    {!session?.user&&<section className="card fuel-v2-signin"><Fuel size={24}/><div><h3>Training fuel needs a sign-in</h3><p className="muted">The Quick Fuel Planner still works without a login. Sign in under Training to unlock training fuel, reviews and stock forecasting.</p></div></section>}
    {message&&<div className="notice">{message}</div>}

    {session?.user&&<section className="card fuel-v2-summary">
      <div><span className="eyebrow">NEXT 7 DAYS</span><h3>{week.length} planned session{week.length===1?'':'s'}</h3></div>
      <div className="fuel-v2-summary-grid">
        <span><b>{weekTotals.mix}</b>Bottle Mix</span><span><b>{weekTotals.regular+weekTotals.boost}</b>Total gels</span><span><b>{weekTotals.hydrate}</b>Hydrate</span><span><b>{weekTotals.recover}</b>Recover</span>
      </div>
      {!forecastReady?<div className="fuel-v2-stock-callout needs-order"><RefreshCw size={19}/><div><strong>{loading?'Updating stock forecast…':'Stock forecast not loaded'}</strong><small>{loading?'This should only take a moment.':'Tap refresh to try again.'}</small></div></div>:<div className={`fuel-v2-stock-callout ${shortfallUnits?'needs-order':'ready'}`}><PackageCheck size={19}/><div><strong>{shortfallUnits?`${shortfallUnits} unit${shortfallUnits===1?'':'s'} short`:'Stock covers the 7-day forecast'}</strong><small>{shortfallUnits?'Open Order Needed to see the exact shortfall.':'Keep My Stock updated for accurate forecasting.'}</small></div></div>}
    </section>}

    <div className="fuel-v2-menu">
      {FUEL_NAV.filter(item=>item.id!=='home').map(item=><FuelMenuCard key={item.id} item={item} onClick={()=>go(item.id)} locked={item.requiresLogin&&!session?.user}/>) }
    </div>
  </div>;
}

function FuelMenuCard({item,onClick,locked}){
  const icons={planner:Gauge,training:Fuel,review:SlidersHorizontal,stock:PackageCheck,order:ShoppingBag};
  const Icon=icons[item.id]||Fuel;
  return <button className={`fuel-v2-menu-card ${locked?'locked':''}`} onClick={locked?undefined:onClick} disabled={locked}>
    <span><Icon size={20}/></span><div><strong>{item.label}</strong><small>{item.copy}</small></div><ChevronRight size={19}/>
  </button>;
}

function FuelPageFrame({title,subtitle,onBack,children}){return <div className="fuel-v2-page"><div className="fuel-v2-topbar"><button onClick={onBack} aria-label="Back to Fuel"><ArrowLeft size={20}/></button><div><span>FUEL</span><strong>{title}</strong><small>{subtitle}</small></div></div>{children}</div>}

function tallySessions(rows){return rows.reduce((a,s)=>({mix:a.mix+n(s.bottle_mix_sachets),regular:a.regular+n(s.regular_gels),boost:a.boost+n(s.boost_gels),hydrate:a.hydrate+n(s.hydrate_servings),recover:a.recover+n(s.recover_servings)}),{mix:0,regular:0,boost:0,hydrate:0,recover:0})}

function TrainingFuel({plan,fuelProfile,userId,reload,addLine,openBasket}){
  const[horizon,setHorizon]=useState(7),[saving,setSaving]=useState(false),[status,setStatus]=useState('');
  const rows=useMemo(()=>plan.filter(s=>s.session_date<addDays(horizon)),[plan,horizon]);
  const totals=useMemo(()=>tallySessions(rows),[rows]);
  const strategy=String(fuelProfile?.carb_strategy||'auto');
  async function saveStrategy(value){
    if(!userId||saving)return;setSaving(true);setStatus('Updating fuel targets…');
    const payload={user_id:userId,carb_strategy:String(value)};if(value==='auto')payload.max_auto_carbs_per_hour=90;
    const result=await supabase.from('training_fueling_profiles').upsert(payload,{onConflict:'user_id'});
    if(result.error)setStatus(result.error.message);else{setStatus(value==='auto'?'Auto targets restored.':'Manual carb target saved.');await reload(userId)}
    setSaving(false);
  }
  function addSession(session){addFuelLines(addLine,{mix:n(session.bottle_mix_sachets),regular:n(session.regular_gels),boost:n(session.boost_gels),hydrate:hydratePacks(n(session.hydrate_servings)),recover:n(session.recover_servings)});openBasket()}
  function addAll(){addFuelLines(addLine,{...totals,hydrate:hydratePacks(totals.hydrate)});openBasket()}
  return <div className="stack fuel-v2-training">
    <section className="card"><span className="eyebrow">CARB STRATEGY</span><h3>How should Just Fuel calculate training fuel?</h3><div className="fuel-v2-strategy">{['auto',50,60,90,120].map(value=><button key={value} disabled={saving} className={strategy===String(value)?'active':''} onClick={()=>saveStrategy(value)}><b>{value==='auto'?'Auto':value}</b><small>{value==='auto'?'Sport + session':'g/h'}</small></button>)}</div><p className="muted">Auto adapts to sport, session type and duration and caps at 90 g/h. 120 g/h remains an advanced manual target.</p>{status&&<p className="form-status">{status}</p>}</section>
    <section className="card"><div className="row-between"><div><span className="eyebrow">TRAINING REQUIREMENT</span><h3>What your plan needs</h3></div><Fuel size={22}/></div><div className="segmented fuel-v2-horizon">{[7,14,30].map(d=><button key={d} className={horizon===d?'active':''} onClick={()=>setHorizon(d)}>{d} days</button>)}</div><p className="muted">{rows.length} planned session{rows.length===1?'':'s'} in this window.</p><div className="fuel-v2-summary-grid"><span><b>{totals.mix}</b>Bottle Mix</span><span><b>{totals.regular+totals.boost}</b>Gels</span><span><b>{totals.hydrate}</b>Hydrate</span><span><b>{totals.recover}</b>Recover</span></div><button className="primary fuel-v2-wide" disabled={!rows.length} onClick={addAll}><ShoppingBag size={17}/>Add {horizon}-day training fuel</button></section>
    {rows.length?rows.map(s=>{const gels=n(s.regular_gels)+n(s.boost_gels);return <section className="card fuel-v2-session" key={s.id}><div className="row-between"><div><span className="eyebrow">{fmtDate(s.session_date)}</span><h3>{s.title}</h3></div><strong className="fuel-v2-gph">{n(s.carb_target_gph)} g/h</strong></div><p className="muted">{mins(s.duration_minutes)} · {deliveryLabel(s.fuel_delivery_mode)} · {n(s.hydration_ml_per_hour)} ml/h · {n(s.sodium_target_mg_per_hour)} mg sodium/h</p><div className="fuel-v2-session-grid"><span><b>{n(s.bottle_mix_sachets)}</b>Mix</span><span><b>{gels}</b>{n(s.boost_gels)?`Gels · ${n(s.boost_gels)} Boost`:'Gels'}</span><span><b>{n(s.hydrate_servings)}</b>Hydrate</span><span><b>{n(s.recover_servings)}</b>Recover</span></div>{s.fueling_note&&<p className="muted">{s.fueling_note}</p>}<button className="secondary fuel-v2-wide" onClick={()=>addSession(s)}>Add this session</button></section>}):<section className="card empty"><Fuel size={26}/><p>No upcoming training sessions in this horizon.</p></section>}
  </div>
}

function StockPage({session,stock,reload}){
  const[values,setValues]=useState({}),[saving,setSaving]=useState(false),[status,setStatus]=useState('');
  useEffect(()=>{const next={};for(const row of stock)next[row.product_key]=row.quantity_on_hand;setValues(next)},[stock]);
  async function save(){
    if(!session?.user)return;setSaving(true);setStatus('Saving stock…');
    for(const[key]of PRODUCT_ROWS){const result=await supabase.from('fuel_inventory').upsert({user_id:session.user.id,product_key:key,quantity_on_hand:n(values[key])},{onConflict:'user_id,product_key'});if(result.error){setStatus(result.error.message);setSaving(false);return}}
    setStatus('Stock saved. Your Order Needed forecast has been updated.');await reload(session.user.id);setSaving(false);
  }
  return <div className="stack"><section className="card"><span className="eyebrow">MY STOCK</span><h3>What is in your cupboard?</h3><p className="muted">Keep this updated and Just Fuel can calculate what you need for upcoming training.</p><div className="fuel-v2-stock-list">{PRODUCT_ROWS.map(([key,label,unit])=><label key={key}><div><strong>{label}</strong><small>{unit}</small></div><input type="number" min="0" inputMode="numeric" value={values[key]??0} onChange={e=>setValues(v=>({...v,[key]:e.target.value}))}/></label>)}</div><button className="primary fuel-v2-wide" disabled={saving} onClick={save}><Save size={17}/>{saving?'Saving…':'Save My Stock'}</button>{status&&<p className="form-status">{status}</p>}</section></div>
}

function OrderNeeded({forecast,addLine,openBasket}){
  const[horizon,setHorizon]=useState(7);
  const rows=useMemo(()=>forecast.filter(x=>Number(x.horizon_days)===horizon),[forecast,horizon]);
  const shortfalls=useMemo(()=>restockShortfalls(rows),[rows]);
  const units=orderUnits(shortfalls);
  const required=key=>n(rows.find(x=>x.product_key===key)?.required_units);
  const onHand=key=>n(rows.find(x=>x.product_key===key)?.quantity_on_hand);
  function addOrder(){
    addFuelLines(addLine,{mix:n(shortfalls.bottle_mix),regular:n(shortfalls.energy_gel),boost:n(shortfalls.boost_gel),recover:n(shortfalls.recover),hydrate:hydratePacks(shortfalls.hydrate)});
    openBasket();
  }
  return <div className="stack"><section className="card"><span className="eyebrow">FORECAST</span><h3>What are you short?</h3><div className="segmented fuel-v2-horizon">{[7,14,30].map(d=><button key={d} className={horizon===d?'active':''} onClick={()=>setHorizon(d)}>{d} days</button>)}</div>{!rows.length?<p className="muted">No fuel forecast available yet.</p>:<div className="fuel-v2-order-list">{PRODUCT_ROWS.map(([key,label,unit])=>{const shortage=key==='hydrate'?hydratePacks(shortfalls[key]):n(shortfalls[key]);const shortageUnit=key==='hydrate'?'10-packs':unit;return <div key={key}><div><strong>{label}</strong><small>Need {Math.ceil(required(key))} · have {Math.floor(onHand(key))}</small></div><span className={shortage?'short':'covered'}>{shortage?`${shortage} ${shortageUnit} short`:'Covered'}</span></div>})}</div>}<button className="primary fuel-v2-wide" disabled={!units} onClick={addOrder}><ShoppingBag size={17}/>{units?`Add ${units} shortfall unit${units===1?'':'s'} to basket`:'No order needed'}</button></section><section className="card fuel-v2-note"><Droplets size={20}/><p>Hydrate stock is tracked as servings but ordered in 10-packs, so the order quantity is rounded up automatically.</p></section></div>
}

function orderUnits(shortfalls={}){return n(shortfalls.bottle_mix)+n(shortfalls.energy_gel)+n(shortfalls.boost_gel)+hydratePacks(shortfalls.hydrate)+n(shortfalls.recover)}

function addFuelLines(addLine,{mix=0,regular=0,boost=0,hydrate=0,recover=0}){
  const bottle=byKey('bottle_mix'),gel=byKey('energy_gel'),hyd=byKey('hydrate'),rec=byKey('recover');
  const regularVariant=gel?.variants?.find(v=>v.title!=='Boost'),boostVariant=gel?.variants?.find(v=>v.title==='Boost');
  if(mix&&bottle?.variants?.[0])addLine(bottle,bottle.variants[0],Math.ceil(mix));
  if(regular&&regularVariant)addLine(gel,regularVariant,Math.ceil(regular));
  if(boost&&boostVariant)addLine(gel,boostVariant,Math.ceil(boost));
  if(hydrate&&hyd?.variants?.[0])addLine(hyd,hyd.variants[0],Math.ceil(hydrate));
  if(recover&&rec?.variants?.[0])addLine(rec,rec.variants[0],Math.ceil(recover));
}