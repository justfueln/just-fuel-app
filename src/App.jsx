import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bike, CalendarDays, ChevronDown, Fuel, Home, RefreshCw, Target, UserRound } from 'lucide-react';
import { supabase } from './main';

const TABS = ['Overview', 'My Plan', 'My Race', 'Fuel', 'My Details'];
const DAY_OPTIONS = [
  [1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[7,'Sun']
];

function fmtDate(v){
  if(!v) return '—';
  return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${v}T12:00:00`));
}
function mins(v){
  if(v==null) return '—';
  const h=Math.floor(v/60), m=v%60;
  return h ? `${h}h${m?` ${m}m`:''}` : `${m}m`;
}

export default function App(){
  const [session,setSession]=useState(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('Overview');
  const [setup,setSetup]=useState(null);
  const [home,setHome]=useState(null);
  const [profile,setProfile]=useState(null);
  const [race,setRace]=useState(null);
  const [plan,setPlan]=useState([]);
  const [fuel,setFuel]=useState([]);
  const [stock,setStock]=useState([]);
  const [email,setEmail]=useState('');
  const [otp,setOtp]=useState('');
  const [otpSent,setOtpSent]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{ setSession(data.session); setLoading(false); });
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>{ setSession(s); });
    return ()=>sub.subscription.unsubscribe();
  },[]);

  useEffect(()=>{ if(session?.user) loadAll(); },[session?.user?.id]);

  async function loadAll(){
    setMessage('');
    const uid=session.user.id;
    const [a,b,c,d,e,f] = await Promise.all([
      supabase.from('training_setup_status').select('*').eq('user_id',uid).maybeSingle(),
      supabase.from('training_home_summary').select('*').eq('user_id',uid).maybeSingle(),
      supabase.from('training_profiles').select('*').eq('user_id',uid).maybeSingle(),
      supabase.from('race_goals').select('*').eq('user_id',uid).eq('status','active').order('event_date',{ascending:true}).limit(1).maybeSingle(),
      supabase.from('training_plan_calendar_with_fuel').select('*').eq('user_id',uid).order('session_date',{ascending:true}),
      supabase.from('fuel_inventory').select('*').eq('user_id',uid)
    ]);
    setSetup(a.data||null); setHome(b.data||null); setProfile(c.data||null); setRace(d.data||null);
    const activePlanId=b.data?.plan_id;
    setPlan((e.data||[]).filter(x=>!activePlanId || x.plan_id===activePlanId));
    setStock(f.data||[]);
    const ff=await supabase.from('fuel_forecast_usage').select('*').eq('user_id',uid).order('horizon_days');
    setFuel(ff.data||[]);
  }

  async function sendOtp(){
    const {error}=await supabase.auth.signInWithOtp({email});
    if(error) return setMessage(error.message);
    setOtpSent(true); setMessage('6-digit code sent to your email.');
  }
  async function verifyOtp(){
    const {error}=await supabase.auth.verifyOtp({email,token:otp,type:'email'});
    if(error) setMessage(error.message);
  }
  async function syncStrava(){
    setMessage('Syncing Strava…');
    const {error}=await supabase.functions.invoke('strava-sync',{body:{}});
    if(error) setMessage(error.message); else { setMessage('Strava synced.'); await loadAll(); }
  }
  async function connectStrava(){
    const {data,error}=await supabase.functions.invoke('strava-start',{body:{}});
    if(error) return setMessage(error.message);
    if(data?.authorization_url) window.location.href=data.authorization_url;
  }

  if(loading) return <Splash/>;
  if(!session) return <Login email={email} setEmail={setEmail} otp={otp} setOtp={setOtp} sent={otpSent} send={sendOtp} verify={verifyOtp} message={message}/>;

  const nextAction = setup?.next_step && setup.next_step!=='ready' ? setup.next_step : null;

  return <div className="app-shell">
    <header className="topbar">
      <div><div className="brand">JUST FUEL</div><div className="subbrand">TRAIN SMART • FUEL SMART</div></div>
      <button className="icon-btn" onClick={loadAll} aria-label="Refresh"><RefreshCw size={18}/></button>
    </header>

    <nav className="section-nav">
      {TABS.map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}
    </nav>

    <main>
      {message && <div className="notice">{message}</div>}
      {tab==='Overview' && <Overview home={home} setup={setup} nextAction={nextAction} onConnect={connectStrava} onSync={syncStrava} go={setTab}/>} 
      {tab==='My Plan' && <Plan plan={plan}/>} 
      {tab==='My Race' && <Race race={race} userId={session.user.id} reload={loadAll}/>} 
      {tab==='Fuel' && <FuelPage plan={plan} fuel={fuel} stock={stock} userId={session.user.id} reload={loadAll}/>} 
      {tab==='My Details' && <Details profile={profile} userId={session.user.id} reload={loadAll}/>} 
    </main>

    <footer className="footer-note">Fuel smart. Train hard.</footer>
  </div>
}

function Splash(){return <div className="center-screen"><div className="logo-mark">JF</div><p>Loading Just Fuel…</p></div>}

function Login({email,setEmail,otp,setOtp,sent,send,verify,message}){
  return <div className="center-screen login-wrap"><div className="logo-mark">JF</div><h1>Training Login</h1><p className="muted">One quick sign-in. Your plan, Strava and fuel stay linked.</p>
    <input type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/>
    {!sent ? <button className="primary" onClick={send}>Send 6-digit code</button> : <>
      <input inputMode="numeric" maxLength={6} placeholder="6-digit code" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))}/>
      <button className="primary" onClick={verify}>Sign in</button>
    </>}
    {message&&<div className="notice">{message}</div>}
  </div>
}

function Overview({home,setup,nextAction,onConnect,onSync,go}){
  const actionMap={
    connect_strava:['Connect Strava',onConnect],
    athlete_details:['Complete My Details',()=>go('My Details')],
    add_race:['Add My Race',()=>go('My Race')],
    generate_plan:['Build My Plan',()=>go('My Race')]
  };
  return <div className="stack">
    {nextAction && <section className="hero-card">
      <span className="eyebrow">ONE THING TO DO</span>
      <h2>{setup?.next_step_label || actionMap[nextAction]?.[0]}</h2>
      <button className="primary" onClick={actionMap[nextAction]?.[1]}>{actionMap[nextAction]?.[0]}</button>
    </section>}

    <section className="card next-session">
      <div className="card-title"><Bike size={19}/>Next session</div>
      <div className="big-date">{fmtDate(home?.next_session_date)}</div>
      <h2>{home?.next_session_title || 'No session planned'}</h2>
      {home?.next_session_title && <>
        <div className="pill-row"><span>{mins(home?.next_session_duration_minutes)}</span><span>{home?.next_session_type?.replaceAll('_',' ')}</span></div>
        {home?.next_session_instructions && <p>{home.next_session_instructions}</p>}
        <div className="fuel-summary">
          <Fuel size={17}/>
          <span>{home?.next_session_carb_target_gph!=null ? `${home.next_session_carb_target_gph} g carbs/h` : 'Fuel calculated automatically'}</span>
        </div>
      </>}
    </section>

    <div className="two-col">
      <section className="card"><span className="eyebrow">THIS WEEK</span><h3>{home?.week_completion_pct!=null?`${home.week_completion_pct}%`:'—'}</h3><p className="muted">training completed</p></section>
      <section className="card"><span className="eyebrow">RACE</span><h3>{home?.days_to_race!=null?`${home.days_to_race} days`:'—'}</h3><p className="muted">{home?.event_name || 'No race added'}</p></section>
    </div>

    <section className="card row-between"><div><div className="card-title"><Activity size={18}/>Strava</div><div className="muted">{setup?.strava_connected?'Connected':'Not connected'}</div></div><button className="secondary" onClick={setup?.strava_connected?onSync:onConnect}>{setup?.strava_connected?'Sync now':'Connect'}</button></section>
  </div>
}

function Plan({plan}){
  const [view,setView]=useState('This Week');
  const now=new Date(); const weekStart=new Date(now); weekStart.setDate(now.getDate()-((now.getDay()+6)%7)); weekStart.setHours(0,0,0,0);
  const nextStart=new Date(weekStart); nextStart.setDate(nextStart.getDate()+7); const afterNext=new Date(nextStart); afterNext.setDate(afterNext.getDate()+7);
  const shown=plan.filter(s=>{
    const d=new Date(`${s.session_date}T12:00:00`);
    if(view==='This Week') return d>=weekStart&&d<nextStart;
    if(view==='Next Week') return d>=nextStart&&d<afterNext;
    return true;
  });
  return <div className="stack"><div className="segmented">{['This Week','Next Week','Full Plan'].map(v=><button key={v} className={view===v?'active':''} onClick={()=>setView(v)}>{v}</button>)}</div>
    {shown.length===0?<Empty text="No sessions in this view."/>:shown.map(s=><SessionCard key={s.id} s={s}/>)}
  </div>
}
function SessionCard({s}){return <section className="card session-card"><div className="row-between"><div><span className="eyebrow">{fmtDate(s.session_date)}</span><h3>{s.title}</h3></div><span className={`status ${s.status}`}>{s.status}</span></div>
  <div className="pill-row"><span>{mins(s.duration_minutes)}</span>{s.target_power_low_w&&<span>{s.target_power_low_w}–{s.target_power_high_w} W</span>}</div>
  <p>{s.instructions}</p>
  <div className="fuel-summary"><Fuel size={16}/><span>{s.carb_target_gph>0?`${s.carb_target_gph} g/h • ${s.bottle_mix_sachets||0} mix • ${(s.regular_gels||0)+(s.boost_gels||0)} gels`:'Water/electrolytes as needed'}</span></div>
</section>}

function Race({race,userId,reload}){
  const [form,setForm]=useState({event_name:'',event_date:'',distance_km:'',elevation_m:'',goal_time_minutes:''});
  useEffect(()=>{if(race)setForm({event_name:race.event_name||'',event_date:race.event_date||'',distance_km:race.distance_km||'',elevation_m:race.elevation_m||'',goal_time_minutes:race.goal_time_minutes||''})},[race?.id]);
  const save=async()=>{
    const payload={...form,user_id:userId,sport_type:'cycling',priority:'A',status:'active',distance_km:Number(form.distance_km),elevation_m:form.elevation_m?Number(form.elevation_m):null,goal_time_minutes:form.goal_time_minutes?Number(form.goal_time_minutes):null};
    let result;
    if(race?.id) result=await supabase.from('race_goals').update(payload).eq('id',race.id).select().single();
    else result=await supabase.from('race_goals').insert(payload).select().single();
    if(result.data){ await supabase.rpc('generate_race_training_plan',{p_goal_id:result.data.id}); await reload(); }
  };
  return <div className="stack"><section className="card"><div className="card-title"><Target size={19}/>My Race</div><p className="muted">Only the basics are required. The app works out the rest.</p>
    <label>Event name<input value={form.event_name} onChange={e=>setForm({...form,event_name:e.target.value})}/></label>
    <label>Event date<input type="date" value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})}/></label>
    <label>Distance (km)<input inputMode="decimal" value={form.distance_km} onChange={e=>setForm({...form,distance_km:e.target.value})}/></label>
    <details><summary>More race details</summary><label>Elevation (m)<input inputMode="numeric" value={form.elevation_m} onChange={e=>setForm({...form,elevation_m:e.target.value})}/></label><label>Goal time (minutes)<input inputMode="numeric" value={form.goal_time_minutes} onChange={e=>setForm({...form,goal_time_minutes:e.target.value})}/></label></details>
    <button className="primary" disabled={!form.event_name||!form.event_date||!form.distance_km} onClick={save}>Build My Plan</button>
  </section></div>
}

function Details({profile,userId,reload}){
  const [days,setDays]=useState([2,4,6]); const [longDay,setLongDay]=useState(6); const [ftp,setFtp]=useState(''); const [weight,setWeight]=useState('');
  const [advanced,setAdvanced]=useState({resting_hr:'',max_hr:'',weekly_hours_target:'',weekday_session_minutes:90,long_session_max_minutes:300});
  useEffect(()=>{if(profile){setDays(profile.available_weekdays||[2,4,6]);setLongDay(profile.long_session_weekday||6);setFtp(profile.ftp_w||'');setWeight(profile.weight_kg||'');setAdvanced({resting_hr:profile.resting_hr||'',max_hr:profile.max_hr||'',weekly_hours_target:profile.weekly_hours_target||'',weekday_session_minutes:profile.weekday_session_minutes||90,long_session_max_minutes:profile.long_session_max_minutes||300})}},[profile?.user_id]);
  const toggle=d=>setDays(days.includes(d)?days.filter(x=>x!==d):[...days,d].sort());
  const save=async()=>{await supabase.from('training_profiles').upsert({user_id:userId,primary_sport:'cycling',available_weekdays:days,long_session_weekday:Number(longDay),ftp_w:ftp?Number(ftp):null,weight_kg:weight?Number(weight):null,resting_hr:advanced.resting_hr?Number(advanced.resting_hr):null,max_hr:advanced.max_hr?Number(advanced.max_hr):null,weekly_hours_target:advanced.weekly_hours_target?Number(advanced.weekly_hours_target):null,weekday_session_minutes:Number(advanced.weekday_session_minutes),long_session_max_minutes:Number(advanced.long_session_max_minutes)});await reload();};
  return <div className="stack"><section className="card"><div className="card-title"><UserRound size={19}/>My Details</div><p className="muted">Set this once. Strava supplies your recent training history automatically.</p>
    <label>Available training days</label><div className="day-grid">{DAY_OPTIONS.map(([d,n])=><button key={d} className={days.includes(d)?'selected':''} onClick={()=>toggle(d)}>{n}</button>)}</div>
    <label>Preferred long-session day<select value={longDay} onChange={e=>setLongDay(Number(e.target.value))}>{DAY_OPTIONS.filter(([d])=>days.includes(d)).map(([d,n])=><option key={d} value={d}>{n}</option>)}</select></label>
    <label>FTP <span className="optional">optional</span><input inputMode="numeric" value={ftp} onChange={e=>setFtp(e.target.value)} placeholder="e.g. 280 W"/></label>
    <label>Weight <span className="optional">optional</span><input inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="kg"/></label>
    <details><summary>Advanced Details</summary>{Object.entries({resting_hr:'Resting HR',max_hr:'Max HR',weekly_hours_target:'Weekly hours target',weekday_session_minutes:'Weekday session minutes',long_session_max_minutes:'Maximum long-session minutes'}).map(([k,n])=><label key={k}>{n}<input inputMode="numeric" value={advanced[k]} onChange={e=>setAdvanced({...advanced,[k]:e.target.value})}/></label>)}</details>
    <button className="primary" disabled={days.length<2} onClick={save}>Save My Details</button>
  </section></div>
}

function FuelPage({plan,fuel,stock,userId,reload}){
  const [sub,setSub]=useState('Training Fuel');
  return <div className="stack"><div className="segmented">{['Training Fuel','Race Fuel','Fuel Stock'].map(v=><button key={v} className={sub===v?'active':''} onClick={()=>setSub(v)}>{v}</button>)}</div>
    {sub==='Training Fuel' && <div className="stack">{plan.slice(0,6).map(s=><section className="card" key={s.id}><span className="eyebrow">{fmtDate(s.session_date)}</span><h3>{s.title}</h3><p>{s.carb_target_gph>0?`${s.carb_target_gph} g carbs/h • ${s.bottle_mix_sachets||0} Bottle Mix • ${s.regular_gels||0} gels • ${s.boost_gels||0} Boost`:'No compulsory carbohydrate for this session.'}</p></section>)}</div>}
    {sub==='Race Fuel' && <RaceFuel userId={userId}/>} 
    {sub==='Fuel Stock' && <FuelStock fuel={fuel} stock={stock} userId={userId} reload={reload}/>} 
  </div>
}
function RaceFuel({userId}){const [r,setR]=useState(null);useEffect(()=>{supabase.from('race_fuel_plan').select('*').eq('user_id',userId).order('event_date').limit(1).maybeSingle().then(({data})=>setR(data))},[userId]);if(!r)return <Empty text="Add a race to create your race fuel strategy."/>;return <section className="card"><span className="eyebrow">RACE FUEL</span><h2>{r.event_name}</h2><p>{r.carb_target_gph} g/h • {r.bottle_mix_sachets} Bottle Mix • {r.regular_gels} gels • {r.boost_gels} Boost</p><p className="muted">{r.hydration_ml_per_hour} ml fluid/h • {r.sodium_target_mg_per_hour} mg sodium/h</p></section>}
function FuelStock({fuel,stock,userId,reload}){
  const products=[['bottle_mix','Bottle Mix'],['energy_gel','Energy Gels'],['boost_gel','Boost'],['hydrate','Hydrate servings'],['recover','Recover']];
  const [vals,setVals]=useState({}); const [horizon,setHorizon]=useState(7);
  useEffect(()=>{const o={};stock.forEach(x=>o[x.product_key]=x.quantity_on_hand);setVals(o)},[stock]);
  const save=async()=>{for(const [key] of products){await supabase.from('fuel_inventory').upsert({user_id:userId,product_key:key,quantity_on_hand:Number(vals[key]||0)},{onConflict:'user_id,product_key'});}await reload();};
  const rows=fuel.filter(x=>x.horizon_days===horizon);
  return <div className="stack"><section className="card"><h3>My Fuel Stock</h3>{products.map(([k,n])=><label key={k}>{n}<input inputMode="numeric" value={vals[k]??''} onChange={e=>setVals({...vals,[k]:e.target.value})}/></label>)}<button className="secondary" onClick={save}>Save stock</button><p className="muted">Hydrate is counted per serving. Ordering later converts shortages into 10-packs.</p></section>
    <div className="segmented small">{[7,14,30].map(d=><button className={horizon===d?'active':''} onClick={()=>setHorizon(d)} key={d}>{d} days</button>)}</div>
    <section className="card"><h3>Fuel forecast</h3>{rows.length===0?<p className="muted">No fuel demand in this period.</p>:rows.map(x=><div className="forecast-row" key={x.product_key}><span>{x.product_name}</span><span>Need {x.required_units} • Have {x.quantity_on_hand} • <b>Restock {x.shortfall_units}</b></span></div>)}</section>
  </div>
}

function Empty({text}){return <section className="card empty"><CalendarDays size={30}/><p>{text}</p></section>}
