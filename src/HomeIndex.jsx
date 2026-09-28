import React,{useEffect,useMemo,useState} from 'react';
import {Activity,CalendarDays,ChevronRight,Clock3,Flag,Fuel,Gauge,PackageCheck,RefreshCw,ShoppingBag,Target,Zap} from 'lucide-react';
import {supabase} from './main';
import {applyMorningReadinessAdjustment,fetchTodayDashboard,fetchTodayReadiness,fetchTrainingFuelForecast,saveMorningReadiness} from './training-api';

const pad=n=>String(n).padStart(2,'0');
const todayKey=()=>{const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const dateObj=v=>v?new Date(`${String(v).slice(0,10)}T12:00:00`):null;
const fmtDate=v=>{const d=dateObj(v);return d?new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'}).format(d):'—'};
const mins=v=>{const x=Math.max(0,Math.round(Number(v)||0)),h=Math.floor(x/60),m=x%60;return h?`${h}h${m?` ${m}m`:''}`:`${m}m`};
const n=v=>Math.max(0,Number(v)||0);

function greeting(){const h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening'}
function firstName(value){const clean=String(value||'').trim().replace(/\s*\(.+\)\s*$/,'');return clean.split(/\s+/)[0]||''}
function sameDay(v){return String(v||'').slice(0,10)===todayKey()}
function totalGels(s){return n(s?.regular_gels)+n(s?.boost_gels)}
function progressPct(done,total){return total?Math.max(0,Math.min(100,Math.round(done/total*100))):0}
function productName(key){return({bottle_mix:'Bottle Mix',energy_gel:'gels',boost_gel:'Boost',hydrate:'Hydrate',recover:'Recover'}[key]||String(key||'fuel').replaceAll('_',' '))}

function stockAlertFromForecast(rows){
  const seven=(rows||[]).filter(row=>Number(row.horizon_days)===7);
  const short=seven.map(row=>({...row,shortfall:Math.max(0,n(row.required_units)-n(row.quantity_on_hand))})).filter(row=>row.shortfall>0.001);
  if(!short.length)return seven.length?{short:false,count:0,copy:'Your recorded stock covers the next 7 days.'}:null;
  const labels=short.slice(0,2).map(row=>productName(row.product_key));
  const rest=short.length-labels.length;
  return{short:true,count:short.length,copy:`Low on ${labels.join(' + ')}${rest?` + ${rest} more`:''} for the next 7 days.`};
}

function balanceFor(data){
  if(!data?.strava_connected)return{label:'Connect Strava',tone:'neutral',copy:'Connect your activities so coaching can compare planned and completed training.'};
  const hours=n(data?.recent?.hours_7d),target=n(data?.target_weekly_hours);
  if(!target)return{label:'Building baseline',tone:'neutral',copy:`${hours} h recorded in the last 7 days.`};
  const ratio=hours/target;
  if(ratio>1.25)return{label:'Loaded',tone:'loaded',copy:`${hours} h in the last 7 days · above your normal weekly target.`};
  if(ratio<.55)return{label:'Fresh',tone:'fresh',copy:`${hours} h in the last 7 days · lighter than your normal target.`};
  return{label:'Balanced',tone:'balanced',copy:`${hours} h in the last 7 days · close to your ${target} h weekly target.`};
}

function coachMessage(data,balance,readiness){
  const s=data?.next_session,r=data?.next_race;
  if(readiness?.status==='recovery')return s&&sameDay(s.date)?`Recovery is the priority today. Use the suggested adjustment before ${s.title} rather than forcing the full planned load.`:'Your morning check-in is showing low readiness. Prioritise recovery before the next hard session.';
  if(readiness?.status==='caution')return s&&sameDay(s.date)?`You are carrying some fatigue today. Keep ${s.title} controlled and use the suggested reduction if needed.`:'Your morning check-in shows some fatigue. Keep the next easy work easy and protect the next quality session.';
  if(!data?.strava_connected)return'Connect Strava so Just Fuel can compare your plan with what you actually do and improve the coaching.';
  if(!s)return r?`${r.name} is ${n(r.days_to_race)} days away. Keep your race plan current while the next training block is prepared.`:'Your training data is connected. Add a race or training plan to unlock daily coaching.';
  if(sameDay(s.date))return s.is_key?`Key session today: ${s.title}. Start controlled, execute the quality work and fuel from the start.`:`Today is ${s.title}. Keep the effort true to the purpose of the session.`;
  const days=Math.max(0,Math.round((dateObj(s.date)-dateObj(todayKey()))/86400000));
  if(balance.tone==='loaded')return`Recent training is on the high side. Prioritise recovery before ${s.title} on ${fmtDate(s.date)}.`;
  if(days===1)return`Tomorrow is ${s.title}${s.is_key?' — a key session':''}. Prepare your kit and fuel today.`;
  if(r&&n(r.days_to_race)<=14)return`${r.name} is ${n(r.days_to_race)} days away. Keep the remaining sessions specific and avoid unplanned intensity.`;
  return`Next up: ${s.title} on ${fmtDate(s.date)}. Stay consistent and let the planned hard days be the hard days.`;
}

function statusCopy(status){return status==='ready'?'Ready':status==='caution'?'Caution':'Recovery'}

function ChoiceRow({label,value,onChange,options}){
  return <div className="readiness-choice-row"><span>{label}</span><div>{options.map(([v,text])=><button key={v} type="button" className={Number(value)===v?'selected':''} onClick={()=>onChange(v)}>{text}</button>)}</div></div>;
}

function MorningReadinessCard({readiness,session,onSaved,onApplied}){
  const[editing,setEditing]=useState(!readiness),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const[form,setForm]=useState({sleep:readiness?.sleep_quality||3,legs:readiness?.legs_freshness||3,soreness:readiness?.soreness||3,motivation:readiness?.motivation||3});

  useEffect(()=>{
    if(readiness){setForm({sleep:readiness.sleep_quality||3,legs:readiness.legs_freshness||3,soreness:readiness.soreness||3,motivation:readiness.motivation||3});setEditing(false)}
  },[readiness?.updated_at,readiness?.score,readiness?.adjustment_status]);

  const save=async()=>{
    setSaving(true);setMessage('');
    const res=await saveMorningReadiness(supabase,todayKey(),form);
    setSaving(false);
    if(res.error){setMessage('Could not save your check-in. Please try again.');return}
    setEditing(false);setMessage('Check-in saved.');onSaved?.(res.readiness);
  };

  const apply=async accept=>{
    setSaving(true);setMessage(accept?'Updating today’s workout…':'Keeping today’s workout…');
    const res=await applyMorningReadinessAdjustment(supabase,todayKey(),accept);
    setSaving(false);
    if(res.error){setMessage('Could not update today’s workout.');return}
    setMessage(accept?'Coach adjustment applied ✓':'Original workout kept ✓');onApplied?.(res.result);
  };

  if(editing)return <section className="today-mini-card readiness readiness-checkin">
    <div className="today-mini-title"><Target size={19}/><span>HOW DO YOU FEEL?</span></div>
    <strong>10-second check-in</strong><p>Four quick answers help the coach decide whether today’s session should stay as planned.</p>
    <div className="readiness-form">
      <ChoiceRow label="Sleep" value={form.sleep} onChange={v=>setForm(x=>({...x,sleep:v}))} options={[[1,'Poor'],[3,'Okay'],[5,'Good']]}/>
      <ChoiceRow label="Legs" value={form.legs} onChange={v=>setForm(x=>({...x,legs:v}))} options={[[1,'Heavy'],[3,'Okay'],[5,'Fresh']]}/>
      <ChoiceRow label="Soreness" value={form.soreness} onChange={v=>setForm(x=>({...x,soreness:v}))} options={[[5,'High'],[3,'Some'],[1,'None']]}/>
      <ChoiceRow label="Motivation" value={form.motivation} onChange={v=>setForm(x=>({...x,motivation:v}))} options={[[1,'Low'],[3,'Okay'],[5,'High']]}/>
    </div>
    <div className="readiness-actions"><button type="button" className="readiness-save" onClick={save} disabled={saving}>{saving?'Saving…':'Save check-in'}</button>{readiness&&<button type="button" className="readiness-cancel" onClick={()=>setEditing(false)}>Cancel</button>}</div>
    {message&&<small>{message}</small>}
  </section>;

  if(!readiness)return null;
  const factor=Number(readiness.suggested_factor)||1;
  const base=Number(readiness.original_adjusted_minutes)||Number(session?.duration_minutes)||0;
  const suggested=base?Math.max(20,Math.round(base*factor)):0;
  const pending=readiness.adjustment_status==='pending'&&factor<1&&session&&sameDay(session.date);
  return <section className={`today-mini-card readiness readiness-result ${readiness.status}`}>
    <div className="today-mini-title"><Target size={19}/><span>READINESS</span></div>
    <div className="readiness-score-line"><strong>{statusCopy(readiness.status)}</strong><b>{n(readiness.score)}/100</b></div>
    <p>{readiness.recommendation}</p>
    {pending&&<div className="readiness-adjustment"><span>Suggested today</span><b>{base&&suggested?`${base} min → ${suggested} min`:`Reduce to ${Math.round(factor*100)}%`}</b><div><button type="button" className="readiness-keep" onClick={()=>apply(false)} disabled={saving}>Keep plan</button><button type="button" className="readiness-apply" onClick={()=>apply(true)} disabled={saving}>Use adjustment</button></div></div>}
    {readiness.adjustment_status==='accepted'&&<div className="readiness-applied">Coach adjustment applied{readiness.applied_adjusted_minutes?` · ${readiness.applied_adjusted_minutes} min`:''} ✓</div>}
    {readiness.adjustment_status==='declined'&&<div className="readiness-applied muted">Original workout kept.</div>}
    <button type="button" className="readiness-edit" onClick={()=>setEditing(true)}>Update check-in</button>
    {message&&<small>{message}</small>}
  </section>;
}

export default function HomeIndex({goRoute}){
  const[data,setData]=useState(null),[session,setSession]=useState(null),[readiness,setReadiness]=useState(null),[stockAlert,setStockAlert]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');

  async function load(){
    setLoading(true);setError('');
    const auth=await supabase.auth.getSession();
    const current=auth.data.session||null;setSession(current);
    if(!current?.user){setData(null);setReadiness(null);setStockAlert(null);setLoading(false);return}
    const[dashboardResult,readinessResult]=await Promise.all([
      fetchTodayDashboard(supabase,todayKey()),
      fetchTodayReadiness(supabase,current.user.id,todayKey())
    ]);
    if(dashboardResult.error){setError('Your dashboard could not refresh right now. Training, Race and Fuel are still available below.');setData(null)}
    else setData(Array.isArray(dashboardResult.dashboard)?dashboardResult.dashboard[0]||{}:dashboardResult.dashboard||{});
    setReadiness(readinessResult.error?null:readinessResult.readiness);
    setLoading(false);

    // Stock is useful, but it must never delay first paint or the daily dashboard.
    fetchTrainingFuelForecast(supabase,current.user.id).then(result=>{
      if(!result.error)setStockAlert(stockAlertFromForecast(result.fuel));
    }).catch(()=>{});
  }
  useEffect(()=>{load()},[]);

  const name=firstName(data?.athlete_name||session?.user?.user_metadata?.full_name||session?.user?.user_metadata?.name||session?.user?.email?.split('@')[0]);
  const balance=useMemo(()=>balanceFor(data),[data]);
  const coach=useMemo(()=>coachMessage(data,balance,readiness),[data,balance,readiness]);
  const s=data?.next_session,r=data?.next_race,week=data?.week||{},next7=data?.next7||{},recent=data?.recent||{};
  const weekPct=progressPct(n(week.completed_sessions),n(week.planned_sessions));

  const readinessSaved=value=>{setReadiness(value);window.dispatchEvent(new CustomEvent('jf-readiness-saved',{detail:value}));};
  const readinessApplied=result=>{
    setReadiness(prev=>prev?{...prev,adjustment_status:result?.status||prev.adjustment_status,applied_adjusted_minutes:result?.adjusted_minutes||prev.applied_adjusted_minutes,updated_at:new Date().toISOString()}:prev);
    if(result?.adjusted_minutes)setData(prev=>prev?.next_session&&sameDay(prev.next_session.date)?{...prev,next_session:{...prev.next_session,duration_minutes:result.adjusted_minutes}}:prev);
    window.dispatchEvent(new CustomEvent('jf-training-plan-updated',{detail:{source:'morning_readiness',result}}));
  };

  if(!session?.user&&!loading)return <main className="today-dashboard home-signed-out">
    <section className="today-welcome"><span>JUST FUEL</span><h1>Know what to do next.</h1><p>Sign in under Training to see today’s workout, fuel, race priority and coach guidance in one place.</p><button className="today-primary" onClick={()=>goRoute('training')}>Open Training<ChevronRight size={18}/></button></section>
  </main>;

  return <main className="today-dashboard">
    <section className="today-head">
      <div><span className="today-kicker">TODAY</span><h1>{greeting()}{name?`, ${name}`:''}.</h1><p>{loading?'Building your day…':'Here is what matters next.'}</p></div>
      <button className="today-refresh" onClick={load} disabled={loading} aria-label="Refresh dashboard"><RefreshCw size={19}/></button>
    </section>

    {error&&<div className="notice today-notice">{error}</div>}
    {loading&&!data?<section className="today-loading-card"><span/><span/><span/></section>:<>
      <section className="today-workout-card today-focus-card">
        <div className="today-card-head"><div><span className="today-label">DO THIS NEXT</span><h2>{s?.title||'No workout waiting'}</h2></div>{s?.is_key&&<span className="today-key">KEY</span>}</div>
        {s?<>
          <p className="today-date-line"><CalendarDays size={16}/>{sameDay(s.date)?'Today':fmtDate(s.date)}</p>
          <div className="today-workout-metrics">
            <div><Clock3 size={18}/><b>{mins(s.duration_minutes)}</b><span>Duration</span></div>
            <div><Gauge size={18}/><b>{s.zone||'Open'}</b><span>Intensity</span></div>
            <div><Fuel size={18}/><b>{n(s.carbs_gph)?`${n(s.carbs_gph)} g/h`:'Hydrate'}</b><span>Fuel target</span></div>
          </div>
          <button className="today-primary" onClick={()=>goRoute('training')}>Open workout<ChevronRight size={18}/></button>
        </>:<><p className="today-muted">Nothing is scheduled next. Open Training to review your plan.</p><button className="today-primary" onClick={()=>goRoute('training')}>Open Training<ChevronRight size={18}/></button></>}
      </section>

      <div className="today-action-grid">
        <MorningReadinessCard readiness={readiness} session={s} onSaved={readinessSaved} onApplied={readinessApplied}/>
        <section className="today-mini-card fuel-card">
          <div className="today-mini-title"><Fuel size={19}/><span>FUEL FOR THIS WORKOUT</span></div>
          {s?<><strong>{n(s.carbs_gph)?`${n(s.carbs_gph)} g/h`:'Hydration focus'}</strong><div className="today-fuel-grid"><span><b>{n(s.bottle_mix)}</b>Mix</span><span><b>{totalGels(s)}</b>Gels</span><span><b>{n(s.fluid_ml_h)}</b>ml/h</span><span><b>{n(s.sodium_mg_h)}</b>mg Na/h</span></div><button onClick={()=>goRoute('fuel',{fuelView:'training'})}>Open fuel plan<ChevronRight size={16}/></button></>:<><strong>—</strong><p>Your next workout does not have a fuel requirement yet.</p></>}
        </section>
      </div>

      <section className="today-coach-card today-priority-card">
        <div className="today-mini-title"><Zap size={19}/><span>COACH SAYS</span></div><h3>{coach}</h3>
      </section>

      <div className="today-priority-grid">
        {r?<section className="today-race-card">
          <div className="today-race-count"><strong>{n(r.days_to_race)}</strong><span>days</span></div>
          <div className="today-race-copy"><span className="today-label">NEXT RACE · {r.priority||'B'}</span><h2>{r.name}</h2><p>{fmtDate(r.date)}{r.distance_km?` · ${Number(r.distance_km)} km`:''}</p></div>
          <button onClick={()=>goRoute('race')} aria-label="Open race"><ChevronRight size={20}/></button>
        </section>:<section className="today-mini-card today-empty-priority"><div className="today-mini-title"><Flag size={19}/><span>NEXT RACE</span></div><strong>No race added</strong><button onClick={()=>goRoute('race')}>Open Race<ChevronRight size={16}/></button></section>}

        <section className={`today-mini-card today-stock-card ${stockAlert?.short?'needs-stock':'stock-ready'}`}>
          <div className="today-mini-title"><PackageCheck size={19}/><span>7-DAY FUEL STOCK</span></div>
          {!stockAlert?<><strong>Checking stock…</strong><p>This runs after the dashboard loads so Home stays fast.</p></>:<><strong>{stockAlert.short?`${stockAlert.count} product${stockAlert.count===1?'':'s'} running short`:'Stock covered'}</strong><p>{stockAlert.copy}</p><button onClick={()=>goRoute(stockAlert.short?'fuel':'shop',stockAlert.short?{fuelView:'order'}:{})}>{stockAlert.short?<><ShoppingBag size={15}/>See what to order</>:<>Open Shop</>}<ChevronRight size={16}/></button></>}
        </section>
      </div>

      <details className="today-more-card">
        <summary><span><Activity size={18}/>This week</span><b>{n(week.completed_sessions)} / {n(week.planned_sessions)||n(next7.planned_sessions)} sessions</b></summary>
        <div className="today-more-body">
          {n(week.planned_sessions)?<><div className="today-progress-copy"><strong>{n(week.completed_sessions)} of {n(week.planned_sessions)} sessions complete</strong><span>{mins(week.planned_minutes)} planned</span></div><div className="today-progress-track"><i style={{width:`${weekPct}%`}}/></div></>:<div className="today-progress-copy"><strong>{n(next7.planned_sessions)} planned session{n(next7.planned_sessions)===1?'':'s'}</strong><span>{mins(next7.planned_minutes)} over the next 7 days</span></div>}
          <div className="today-recent-grid"><div><b>{n(recent.hours_7d)} h</b><span>Last 7 days</span></div><div><b>{n(recent.distance_km_7d)} km</b><span>Distance</span></div><div><b>{n(recent.activities_7d)}</b><span>Activities</span></div></div>
          {!readiness&&<div className={`today-load-line ${balance.tone}`}><Target size={17}/><div><strong>{balance.label}</strong><span>{balance.copy}</span></div></div>}
        </div>
      </details>
    </>}
  </main>;
}
