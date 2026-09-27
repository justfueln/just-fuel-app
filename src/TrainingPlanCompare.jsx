import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, RefreshCw, Timer, Zap } from 'lucide-react';
import { supabase } from './main';

const todayKey=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const fmtDate=v=>v?new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${v}T12:00:00`)):'—';
const mins=v=>v==null?'—':`${Math.round(Number(v))} min`;
const pct=v=>v==null?'—':`${Math.round(Number(v))}%`;

function resultFor(row){
  if(!row.actual_activity_id)return row.session_date<todayKey()?{label:'Missed',tone:'missed'}:{label:'Awaiting activity',tone:'pending'};
  const duration=Number(row.duration_completion_pct||0),load=Number(row.load_completion_pct||0);
  if(load>130)return{label:'Harder than planned',tone:'high'};
  if(load>0&&load<70)return{label:'Easier than planned',tone:'low'};
  if(duration>125)return{label:'Longer than planned',tone:'high'};
  if(duration>0&&duration<75)return{label:'Shorter than planned',tone:'low'};
  if((!load||load>=80&&load<=120)&&duration>=85&&duration<=115)return{label:'On plan',tone:'good'};
  return{label:'Completed',tone:'good'};
}

export default function TrainingPlanCompare(){
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[eventName,setEventName]=useState('');

  async function load(){
    setLoading(true);setError('');
    const{data:{session}}=await supabase.auth.getSession();
    if(!session?.user){setError('Sign in to compare your training plan.');setLoading(false);return}
    const active=await supabase.from('training_plans').select('id,race_goal_id,generated_at').eq('user_id',session.user.id).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle();
    if(active.error){setError(active.error.message);setLoading(false);return}
    if(!active.data?.id){setRows([]);setLoading(false);return}
    await supabase.rpc('refresh_training_session_matches',{p_user_id:session.user.id});
    const result=await supabase.from('training_plan_calendar_with_fuel').select('id,plan_id,session_date,title,session_type,duration_minutes,target_load,target_power_low_w,target_power_high_w,status,event_name,actual_activity_id,actual_name,actual_duration_minutes,actual_distance_km,actual_elevation_m,actual_avg_hr,actual_weighted_watts,actual_training_load,duration_completion_pct,load_completion_pct,match_score').eq('user_id',session.user.id).eq('plan_id',active.data.id).lte('session_date',todayKey()).order('session_date',{ascending:false});
    if(result.error)setError(result.error.message);else{setRows(result.data||[]);setEventName(result.data?.[0]?.event_name||'')}
    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  const summary=useMemo(()=>{
    const due=rows.length,completed=rows.filter(r=>r.actual_activity_id).length,missed=rows.filter(r=>!r.actual_activity_id&&r.session_date<todayKey()).length,onPlan=rows.filter(r=>resultFor(r).label==='On plan').length;
    const completion=due?Math.round(completed/due*100):0;
    return{due,completed,missed,onPlan,completion};
  },[rows]);
  const coach=useMemo(()=>{
    if(!rows.length)return'Your current plan has not reached its first comparison session yet.';
    if(summary.missed>1)return`${summary.missed} planned sessions have not matched to a Strava activity. Keep the next key session purposeful rather than trying to make up everything at once.`;
    const harder=rows.filter(r=>resultFor(r).label==='Harder than planned').length;
    if(harder>=2)return'Recent completed sessions are running harder than planned. Protect the easy work so fatigue does not build unnecessarily.';
    if(summary.completed&&summary.onPlan/summary.completed>=.7)return'Your completed sessions are tracking the plan well. Keep the same consistency rather than adding extra intensity.';
    return'Use the comparison below to keep duration and training load close to the purpose of each planned session.';
  },[rows,summary]);

  return <div className="stack training-compare-screen">
    <section className="card compare-head">
      <div className="row-between"><div><span className="eyebrow">PLANNED VS ACTUAL</span><h2>{eventName||'Current training plan'}</h2></div><button className="icon-btn" onClick={load} disabled={loading} aria-label="Refresh comparison"><RefreshCw size={18}/></button></div>
      <p className="muted">Your plan is automatically matched to downloaded Strava activities by date, sport, duration and available power data.</p>
      <div className="compare-summary-grid"><div><span>Completed</span><strong>{summary.completed}/{summary.due}</strong><small>{summary.completion}% of due sessions</small></div><div><span>On plan</span><strong>{summary.onPlan}</strong><small>Duration/load aligned</small></div><div><span>Missed</span><strong>{summary.missed}</strong><small>No matched activity</small></div></div>
    </section>

    <section className="card coach-card"><span className="eyebrow">COACH SAYS</span><h3>{coach}</h3></section>

    {loading&&<section className="card empty"><Activity size={28}/><p>Matching plan to Strava training…</p></section>}
    {error&&<div className="notice">{error}</div>}
    {!loading&&!error&&!rows.length&&<section className="card empty"><Timer size={28}/><p>No due sessions yet. This comparison will populate automatically after your first planned workout.</p></section>}

    {!loading&&rows.map(row=>{const result=resultFor(row);return <section className="card compare-session-card" key={row.id}>
      <div className="row-between"><div><span className="eyebrow">{fmtDate(row.session_date)}</span><h3>{row.title}</h3></div><span className={`compare-verdict ${result.tone}`}>{result.label}</span></div>
      <div className="compare-columns">
        <div><span className="compare-label">PLANNED</span><strong>{mins(row.duration_minutes)}</strong>{Number(row.target_load)>0&&<small>Load {Math.round(Number(row.target_load))}</small>}{row.target_power_low_w&&<small>{row.target_power_low_w}–{row.target_power_high_w} W</small>}</div>
        <div><span className="compare-label">ACTUAL</span>{row.actual_activity_id?<><strong>{mins(row.actual_duration_minutes)}</strong>{Number(row.actual_training_load)>0&&<small>Load {Math.round(Number(row.actual_training_load))}</small>}{Number(row.actual_weighted_watts)>0&&<small>{Math.round(Number(row.actual_weighted_watts))} W weighted</small>}</>:<><strong>—</strong><small>No matched Strava activity</small></>}</div>
      </div>
      {row.actual_activity_id&&<><div className="compare-bars"><div><span>Duration</span><div><i style={{width:`${Math.min(150,Number(row.duration_completion_pct||0))}%`}}/></div><b>{pct(row.duration_completion_pct)}</b></div>{row.load_completion_pct!=null&&<div><span>Load</span><div><i style={{width:`${Math.min(150,Number(row.load_completion_pct||0))}%`}}/></div><b>{pct(row.load_completion_pct)}</b></div>}</div><details className="session-more"><summary>Actual activity details</summary><div className="pill-row session-detail-pills">{Number(row.actual_distance_km)>0&&<span>{Number(row.actual_distance_km).toFixed(1)} km</span>}{Number(row.actual_elevation_m)>0&&<span>{Math.round(Number(row.actual_elevation_m))} m vert</span>}{Number(row.actual_avg_hr)>0&&<span>{Math.round(Number(row.actual_avg_hr))} bpm avg</span>}{Number(row.match_score)>0&&<span>Match {Math.round(Number(row.match_score))}%</span>}</div>{row.actual_name&&<p>{row.actual_name}</p>}</details></>}
    </section>})}
  </div>
}
