import React,{useEffect,useMemo,useState} from 'react';
import {Activity,CalendarDays,ChevronRight,Clock3,Flag,Fuel,Gauge,RefreshCw,Store,Target,Zap} from 'lucide-react';
import {supabase} from './main';
import {applyMorningReadinessAdjustment,fetchTodayDashboard,fetchTodayReadiness,saveMorningReadiness} from './training-api';

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

function balanceFor(data){
  if(!data?.strava_connected)return{label:'Connect Strava',tone:'neutral',copy:'Training balance becomes available after your activities are connected.'};
  const hours=n(data?.recent?.hours_7d),target=n(data?.target_weekly_hours);
  if(!target)return{label:'Building baseline',tone:'neutral',copy:`${hours} h recorded in the last 7 days.`};
  const ratio=hours/target;
  if(ratio>1.25)return{label:'Loaded',tone:'loaded',copy:`${hours} h in the last 7 days · ${Math.round(ratio*100)}% of your weekly target.`};
  if(ratio<.55)return{label:'Fresh',tone:'fresh',copy:`${hours} h in the last 7 days · lighter than your normal target.`};
  return{label:'Balanced',tone:'balanced',copy:`${hours} h in the last 7 days · close to your ${target} h weekly target.`};
}

function coachMessage(data,balance,readiness){
  const s=data?.next_session,r=data?.next_race;
  if(readiness?.status==='recovery')return s&&sameDay(s.date)?`Recovery is the priority today. Use the morning coach adjustment before ${s.title} rather than forcing the full planned load.`:'Your morning check-in is showing low readiness. Prioritise recovery, food, hydration and sleep before the next hard session.';
  if(readiness?.status==='caution')return s&&sameDay(s.date)?`You are carrying some fatigue today. Keep ${s.title} controlled and use the suggested reduction if you are not improving during the warm-up.`:'Your morning check-in shows some fatigue. Keep the next easy work easy and protect the next quality session.';
  if(!data?.strava_connected)return'Connect Strava so Just Fuel can compare your plan with what you actually ride and adapt the guidance.';
  if(!s)return r?`${r.name} is ${n(r.days_to_race)} days away. Keep your race plan current while the next training block is prepared.`:'Your training data is connected. Add a race or training plan to unlock daily coaching.';
  if(sameDay(s.date)){
    if(s.is_key)return`Key session today: ${s.title}. Start controlled, protect the quality work and ${n(s.carbs_gph)>0?`fuel from the first hour at about ${n(s.carbs_gph)} g/h.`:'keep hydration steady.'}`;
    return`Today is ${s.title}. Keep the effort true to the purpose of the session rather than adding unnecessary intensity.`;
  }
  const days=Math.max(0,Math.round((dateObj(s.date)-dateObj(todayKey()))/86400000));
  if(balance.tone==='loaded')return`Recent training load is high relative to your target. Prioritise recovery before ${s.title} on ${fmtDate(s.date)}.`;
  if(days===1)return`Tomorrow is ${s.title}${s.is_key?' — a key session':''}. Keep today easy, prepare your bottles and arrive ready to execute.`;
  if(r&&n(r.days_to_race)<=14)return`${r.name} is ${n(r.days_to_race)} days away. Keep the remaining sessions specific and avoid adding unplanned intensity.`;
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
    if(res.error){setMessage('Could not save your morning check-in. Please try again.');return}
    setEditing(false);setMessage('Morning check-in saved.');onSaved?.(res.readiness);
  };

  const apply=async accept=>{
    setSaving(true);setMessage(accept?'Updating today’s workout…':'Keeping today’s workout…');
    const res=await applyMorningReadinessAdjustment(supabase,todayKey(),accept);
    setSaving(false);
    if(res.error){setMessage('Could not update today’s workout.');return}
    setMessage(accept?'Coach adjustment applied ✓':'Original workout kept ✓');onApplied?.(res.result);
  };

  if(editing)return <section className="today-mini-card readiness readiness-checkin">
    <div className="today-mini-title"><Target size={19}/><span>MORNING READINESS</span></div>
    <strong>10-second check-in</strong><p>Tell the coach how you feel before training. This combines your answers with recent training load.</p>
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
    <div className="today-mini-title"><Target size={19}/><span>MORNING READINESS</span></div>
    <div className="readiness-score-line"><strong>{statusCopy(readiness.status)}</strong><b>{n(readiness.score)}/100</b></div>
    <p>{readiness.recommendation}</p>
    <small>Self-check + recent training load. This is coaching guidance, not a medical assessment.</small>
    {pending&&<div className="readiness-adjustment"><span>Suggested today</span><b>{base&&suggested?`${base} min → ${suggested} min`:`Reduce to ${Math.round(factor*100)}%`}</b><div><button type="button" className="readiness-keep" onClick={()=>apply(false)} disabled={saving}>Keep plan</button><button type="button" className="readiness-apply" onClick={()=>apply(true)} disabled={saving}>Use coach adjustment</button></div></div>}
    {readiness.adjustment_status==='accepted'&&<div className="readiness-applied">Coach adjustment applied{readiness.applied_adjusted_minutes?` · ${readiness.applied_adjusted_minutes} min`:''} ✓</div>}
    {readiness.adjustment_status==='declined'&&<div className="readiness-applied muted">Original workout kept.</div>}
    <button type="button" className="readiness-edit" onClick={()=>setEditing(true)}>Edit check-in</button>
    {message&&<small>{message}</small>}
  </section>;
}

export default function HomeIndex({goRoute}){
  const[data,setData]=useState(null),[session,setSession]=useState(null),[readiness,setReadiness]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');

  async function load(){
    setLoading(true);setError('');
    const auth=await supabase.auth.getSession();
    const current=auth.data.session||null;setSession(current);
    if(!current?.user){setData(null);setReadiness(null);setLoading(false);return}
    const[dashboardResult,readinessResult]=await Promise.all([
      fetchTodayDashboard(supabase,todayKey()),
      fetchTodayReadiness(supabase,current.user.id,todayKey())
    ]);
    if(dashboardResult.error){setError('Your dashboard could not refresh right now. Training, Race and Fuel are still available below.');setData(null)}
    else setData(Array.isArray(dashboardResult.dashboard)?dashboardResult.dashboard[0]||{}:dashboardResult.dashboard||{});
    setReadiness(readinessResult.error?null:readinessResult.readiness);
    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  const name=firstName(data?.athlete_name||session?.user?.user_metadata?.full_name||session?.user?.user_metadata?.name||session?.user?.email?.split('@')[0]);
  const balance=useMemo(()=>balanceFor(data),[data]);
  const coach=useMemo(()=>coachMessage(data,balance,readiness),[data,balance,readiness]);
  const s=data?.next_session,r=data?.next_race,week=data?.week||{},next7=data?.next7||{},recent=data?.recent||{};
  const weekPct=progressPct(n(week.completed_sessions),n(week.planned_sessions));

  const readinessSaved=r=>{setReadiness(r);window.dispatchEvent(new CustomEvent('jf-readiness-saved',{detail:r}));};
  const readinessApplied=result=>{
    setReadiness(prev=>prev?{...prev,adjustment_status:result?.status||prev.adjustment_status,applied_adjusted_minutes:result?.adjusted_minutes||prev.applied_adjusted_minutes,updated_at:new Date().toISOString()}:prev);
    if(result?.adjusted_minutes)setData(prev=>prev?.next_session&&sameDay(prev.next_session.date)?{...prev,next_session:{...prev.next_session,duration_minutes:result.adjusted_minutes}}:prev);
    window.dispatchEvent(new CustomEvent('jf-training-plan-updated',{detail:{source:'morning_readiness',result}}));
  };

  if(!session?.user&&!loading)return <main className="today-dashboard home-signed-out">
    <section className="today-welcome"><span>JUST FUEL</span><h1>Train. Race. Fuel.</h1><p>Sign in under Training to unlock your daily workout, fueling and race dashboard.</p></section>
    <QuickLinks goRoute={goRoute}/>
  </main>;

  return <main className="today-dashboard">
    <section className="today-head">
      <div><span className="today-kicker">TODAY</span><h1>{greeting()}{name?`, ${name}`:''}.</h1><p>{loading?'Building your training day…':'Your workout, fuel and race priorities in one place.'}</p></div>
      <button className="today-refresh" onClick={load} disabled={loading} aria-label="Refresh dashboard"><RefreshCw size={19}/></button>
    </section>

    {error&&<div className="notice today-notice">{error}</div>}
    {loading&&!data?<section className="today-loading-card"><span/><span/><span/></section>:<>
      <section className="today-workout-card">
        <div className="today-card-head"><div><span className="today-label">{sameDay(s?.date)?"TODAY'S WORKOUT":'NEXT WORKOUT'}</span><h2>{s?.title||'No upcoming workout'}</h2></div>{s?.is_key&&<span className="today-key">KEY</span>}</div>
        {s?<>
          <p className="today-date-line"><CalendarDays size={16}/>{sameDay(s.date)?'Today':fmtDate(s.date)}</p>
          <div className="today-workout-metrics">
            <div><Clock3 size={18}/><b>{mins(s.duration_minutes)}</b><span>Duration</span></div>
            <div><Gauge size={18}/><b>{s.zone||'Open'}</b><span>Intensity</span></div>
            <div><Zap size={18}/><b>{s.power_low_w&&s.power_high_w?`${Math.round(s.power_low_w)}–${Math.round(s.power_high_w)} W`:'—'}</b><span>Power</span></div>
          </div>
          <button className="today-primary" onClick={()=>goRoute('training')}>Open training plan<ChevronRight size={18}/></button>
        </>:<><p className="today-muted">Your current plan has no upcoming session yet.</p><button className="today-primary" onClick={()=>goRoute('training')}>Open Training<ChevronRight size={18}/></button></>}
      </section>

      <div className="today-two-up">
        <MorningReadinessCard readiness={readiness} session={s} onSaved={readinessSaved} onApplied={readinessApplied}/>
        <section className="today-mini-card fuel-card">
          <div className="today-mini-title"><Fuel size={19}/><span>FUEL FOR NEXT WORKOUT</span></div>
          {s?<><strong>{n(s.carbs_gph)} g/h</strong><div className="today-fuel-grid"><span><b>{n(s.bottle_mix)}</b>Mix</span><span><b>{totalGels(s)}</b>Gels</span><span><b>{n(s.boost_gels)}</b>Boost</span><span><b>{n(s.fluid_ml_h)}</b>ml/h</span></div><button onClick={()=>goRoute('fuel',{fuelView:'training'})}>Open training fuel<ChevronRight size={16}/></button></>:<><strong>—</strong><p>No upcoming session fuel plan yet.</p></>}
        </section>
      </div>

      {!readiness&&<section className={`today-mini-card readiness ${balance.tone} readiness-load-preview`}><div className="today-mini-title"><Target size={19}/><span>TRAINING LOAD</span></div><strong>{balance.label}</strong><p>{balance.copy}</p></section>}

      <section className="today-progress-card">
        <div className="today-card-head"><div><span className="today-label">TRAINING</span><h2>{n(week.planned_sessions)?'This week':'Next 7 days'}</h2></div><Activity size={22}/></div>
        {n(week.planned_sessions)?<>
          <div className="today-progress-copy"><strong>{n(week.completed_sessions)} of {n(week.planned_sessions)} sessions complete</strong><span>{mins(week.planned_minutes)} planned</span></div>
          <div className="today-progress-track"><i style={{width:`${weekPct}%`}}/></div>
        </>:<div className="today-progress-copy"><strong>{n(next7.planned_sessions)} planned session{n(next7.planned_sessions)===1?'':'s'}</strong><span>{mins(next7.planned_minutes)} over the next 7 days</span></div>}
        <div className="today-recent-grid"><div><b>{n(recent.hours_7d)} h</b><span>Last 7 days</span></div><div><b>{n(recent.distance_km_7d)} km</b><span>Distance</span></div><div><b>{n(recent.activities_7d)}</b><span>Activities</span></div></div>
      </section>

      {r&&<section className="today-race-card">
        <div className="today-race-count"><strong>{n(r.days_to_race)}</strong><span>days</span></div>
        <div className="today-race-copy"><span className="today-label">NEXT RACE · {r.priority||'B'}</span><h2>{r.name}</h2><p>{fmtDate(r.date)}{r.distance_km?` · ${Number(r.distance_km)} km`:''}</p></div>
        <button onClick={()=>goRoute('race')} aria-label="Open race"><ChevronRight size={20}/></button>
      </section>}

      <section className="today-coach-card">
        <div className="today-mini-title"><Zap size={19}/><span>COACH SAYS</span></div><h3>{coach}</h3>
      </section>

      <section className="today-quick-section"><span className="today-label">QUICK ACCESS</span><QuickLinks goRoute={goRoute}/></section>
    </>}
  </main>;
}

function QuickLinks({goRoute}){
  const items=[
    ['training','Training','Plan & progress',Activity],
    ['race','Race','Race execution',Flag],
    ['fuel','Fuel','Plan & stock',Fuel],
    ['shop','Shop','Order products',Store]
  ];
  return <div className="today-quick-grid">{items.map(([id,title,copy,Icon])=><button key={id} onClick={()=>goRoute(id)}><span><Icon size={20}/></span><div><strong>{title}</strong><small>{copy}</small></div><ChevronRight size={17}/></button>)}</div>;
}
