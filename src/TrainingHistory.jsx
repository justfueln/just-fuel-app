import React, { useMemo, useState } from 'react';
import { Activity, Bike, Footprints, HeartPulse, Mountain, RefreshCw, Timer, Zap } from 'lucide-react';
import TrainingPerformance from './TrainingPerformance';
import TrainingPlanCompare from './TrainingPlanCompare';

function formatDateTime(value){
  if(!value)return'—';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
}
function formatDuration(seconds){
  const total=Math.max(0,Math.round(Number(seconds)||0));
  const h=Math.floor(total/3600),m=Math.round((total%3600)/60);
  return h?`${h}h ${m}m`:`${m}m`;
}
function km(value){return `${(Number(value||0)/1000).toFixed(1)} km`}
function sportName(activity){return String(activity.sport_type||activity.activity_type||'Activity').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
function sportGroup(activity){
  const v=`${activity.sport_type||''} ${activity.activity_type||''}`.toLowerCase();
  if(v.includes('ride')||v.includes('cycle')||v.includes('bike'))return'cycling';
  if(v.includes('run')||v.includes('walk')||v.includes('hike'))return'running';
  return'other';
}
function SportIcon({activity}){return sportGroup(activity)==='cycling'?<Bike size={18}/>:sportGroup(activity)==='running'?<Footprints size={18}/>:<Activity size={18}/>}
function initialProgressView(){
  const requested=String(window.history.state?.jfTrainingSubView||'Progress');
  if(requested==='History')return'activities';
  if(requested==='Compare')return'review';
  return'performance';
}

export default function TrainingHistory({activities=[],loading=false,onRefresh}){
  const[view,setView]=useState(initialProgressView);
  const[filter,setFilter]=useState('all');
  const filtered=useMemo(()=>filter==='all'?activities:activities.filter(a=>sportGroup(a)===filter),[activities,filter]);
  const summary=useMemo(()=>activities.reduce((a,x)=>({
    count:a.count+1,
    seconds:a.seconds+Number(x.moving_time_s||0),
    distance:a.distance+Number(x.distance_m||0),
    elevation:a.elevation+Number(x.total_elevation_gain_m||0)
  }),{count:0,seconds:0,distance:0,elevation:0}),[activities]);

  return <div className="stack training-progress-shell">
    <section className="training-progress-head">
      <span className="eyebrow">PROGRESS</span>
      <h2>How your training is going</h2>
      <p className="muted">Performance first. Open completed activities or planned-versus-actual detail when you need it.</p>
    </section>

    <nav className="training-progress-nav" aria-label="Progress views">
      <button type="button" className={view==='performance'?'active':''} onClick={()=>setView('performance')}>Performance</button>
      <button type="button" className={view==='activities'?'active':''} onClick={()=>setView('activities')}>Activities</button>
      <button type="button" className={view==='review'?'active':''} onClick={()=>setView('review')}>Plan vs actual</button>
    </nav>

    {view==='performance'&&<TrainingPerformance activities={activities} loading={loading} onRefresh={onRefresh}/>} 
    {view==='review'&&<TrainingPlanCompare/>}
    {view==='activities'&&<div className="stack training-history-screen">
      <section className="card">
        <div className="row-between"><div><span className="eyebrow">COMPLETED ACTIVITIES</span><h2>{summary.count} downloaded activit{summary.count===1?'y':'ies'}</h2></div><button className="icon-btn" onClick={onRefresh} disabled={loading} aria-label="Refresh training history"><RefreshCw size={18}/></button></div>
        <p className="muted">Completed activities downloaded from Strava, newest first.</p>
        <div className="two-col">
          <div><span className="eyebrow">TOTAL TIME</span><h3>{formatDuration(summary.seconds)}</h3></div>
          <div><span className="eyebrow">DISTANCE</span><h3>{km(summary.distance)}</h3></div>
        </div>
      </section>

      <div className="segmented small">{[['all','All'],['cycling','Cycling'],['running','Run / Walk'],['other','Other']].map(([key,label])=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</div>

      {loading&&activities.length===0&&<section className="card empty"><Activity size={30}/><p>Loading downloaded training…</p></section>}
      {!loading&&filtered.length===0&&<section className="card empty"><Activity size={30}/><p>No downloaded training in this filter yet.</p></section>}

      {filtered.map(activity=><section className="card training-history-card" key={activity.id||activity.strava_activity_id}>
        <div className="row-between"><div><span className="eyebrow">{formatDateTime(activity.start_date_local||activity.start_date)}</span><h3>{activity.name||sportName(activity)}</h3></div><SportIcon activity={activity}/></div>
        <div className="pill-row"><span>{sportName(activity)}</span>{activity.trainer&&<span>Indoor</span>}{activity.manual&&<span>Manual</span>}{activity.exclude_from_analysis&&<span>Excluded from analysis</span>}</div>
        <div className="training-history-metrics">
          {Number(activity.distance_m)>0&&<span><Bike size={15}/><b>{km(activity.distance_m)}</b></span>}
          {Number(activity.moving_time_s)>0&&<span><Timer size={15}/><b>{formatDuration(activity.moving_time_s)}</b></span>}
          {Number(activity.total_elevation_gain_m)>0&&<span><Mountain size={15}/><b>{Math.round(Number(activity.total_elevation_gain_m))} m</b></span>}
          {Number(activity.average_heartrate)>0&&<span><HeartPulse size={15}/><b>{Math.round(Number(activity.average_heartrate))} bpm</b></span>}
          {Number(activity.average_watts)>0&&<span><Zap size={15}/><b>{Math.round(Number(activity.average_watts))} W</b></span>}
          {Number(activity.weighted_average_watts)>0&&<span><Zap size={15}/><b>{Math.round(Number(activity.weighted_average_watts))} W weighted</b></span>}
        </div>
        <details className="session-more"><summary>Activity details</summary><div className="pill-row session-detail-pills">{Number(activity.max_heartrate)>0&&<span>Max HR {Math.round(Number(activity.max_heartrate))}</span>}{Number(activity.average_cadence)>0&&<span>Cadence {Math.round(Number(activity.average_cadence))}</span>}{Number(activity.kilojoules)>0&&<span>{Math.round(Number(activity.kilojoules))} kJ</span>}{Number(activity.calories)>0&&<span>{Math.round(Number(activity.calories))} kcal</span>}</div><p className="muted">Strava activity #{activity.strava_activity_id}{activity.synced_at?` · downloaded ${formatDateTime(activity.synced_at)}`:''}</p></details>
      </section>)}
    </div>}
  </div>;
}
