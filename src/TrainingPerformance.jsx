import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Gauge, HeartPulse, Timer, TrendingUp, Zap } from 'lucide-react';
import { supabase } from './main';

const DAY=24*60*60*1000;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

function activityDate(value){
  if(!value)return null;
  const text=String(value).replace(' ','T');
  const d=new Date(text);
  return Number.isNaN(d.getTime())?null:d;
}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function mondayStart(d){const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x}
function shortDate(d){return new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short'}).format(d)}
function duration(seconds){const total=Math.max(0,Number(seconds)||0),h=Math.floor(total/3600),m=Math.round((total%3600)/60);return h?`${h}h ${m}m`:`${m}m`}
function round(n,d=0){const p=10**d;return Math.round((Number(n)||0)*p)/p}

function chooseLoadMode(activities,profile){
  const usable=activities.filter(a=>!a.exclude_from_analysis&&Number(a.moving_time_s)>0);
  if(!usable.length)return'duration';
  const ratio=fn=>usable.filter(fn).length/usable.length;
  if(Number(profile?.ftp_w)>0&&ratio(a=>Number(a.weighted_average_watts)>0)>=.55)return'power';
  if(ratio(a=>Number(a.raw?.suffer_score)>0)>=.55)return'relative';
  if(Number(profile?.max_hr)>Number(profile?.resting_hr)&&ratio(a=>Number(a.average_heartrate)>0)>=.55)return'hr';
  return'duration';
}
function sessionLoad(a,profile,mode){
  if(a.exclude_from_analysis)return 0;
  const hours=Math.max(0,Number(a.moving_time_s)||0)/3600;
  if(!hours)return 0;
  if(mode==='power'){
    const ftp=Number(profile?.ftp_w)||0,np=Number(a.weighted_average_watts)||Number(a.average_watts)||0;
    if(ftp>0&&np>0){const intensity=clamp(np/ftp,.25,1.5);return hours*100*intensity*intensity}
  }
  if(mode==='relative'){
    const effort=Number(a.raw?.suffer_score)||0;
    if(effort>0)return effort;
  }
  if(mode==='hr'){
    const avg=Number(a.average_heartrate)||0,rest=Number(profile?.resting_hr)||0,max=Number(profile?.max_hr)||0;
    if(avg>0&&max>rest){const intensity=clamp((avg-rest)/(max-rest),.2,1.15);return hours*100*intensity*intensity}
  }
  return hours*50;
}
function modeLabel(mode){return mode==='power'?'Estimated from weighted power + FTP':mode==='relative'?'Based on Strava Relative Effort':mode==='hr'?'Estimated from heart rate + duration':'Estimated from training duration'}

function buildDaily(activities,profile,mode){
  const today=new Date();today.setHours(0,0,0,0);
  const dated=activities.map(a=>({a,d:activityDate(a.start_date_local||a.start_date)})).filter(x=>x.d&&x.d<=new Date(today.getTime()+DAY));
  const first=dated.length?new Date(Math.min(...dated.map(x=>x.d.getTime()))):new Date(today.getTime()-83*DAY);first.setHours(0,0,0,0);
  const byDay=new Map();
  for(const {a,d} of dated){const k=dateKey(d);byDay.set(k,(byDay.get(k)||0)+sessionLoad(a,profile,mode))}
  const rows=[];let fitness=0,fatigue=0;
  for(let t=first.getTime();t<=today.getTime();t+=DAY){
    const d=new Date(t),load=byDay.get(dateKey(d))||0;
    fitness+=(load-fitness)/42;
    fatigue+=(load-fatigue)/7;
    rows.push({date:d,load,fitness,fatigue,form:fitness-fatigue});
  }
  return rows;
}
function linePath(rows,key,width=600,height=210,pad=22){
  if(!rows.length)return'';
  const vals=rows.flatMap(r=>[Number(r.fitness)||0,Number(r.fatigue)||0]);
  const min=Math.min(0,...vals),max=Math.max(10,...vals),span=max-min||1;
  return rows.map((r,i)=>{const x=pad+(i/Math.max(1,rows.length-1))*(width-pad*2);const y=height-pad-((Number(r[key])-min)/span)*(height-pad*2);return`${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`}).join(' ');
}

export default function TrainingPerformance({activities=[],loading=false,onRefresh}){
  const[range,setRange]=useState(84);
  const[profile,setProfile]=useState(null);
  const[profileLoading,setProfileLoading]=useState(true);

  useEffect(()=>{
    let active=true;
    (async()=>{
      const{data:{session}}=await supabase.auth.getSession();
      if(!session?.user){if(active)setProfileLoading(false);return}
      const{data}=await supabase.from('training_profiles').select('*').eq('user_id',session.user.id).maybeSingle();
      if(active){setProfile(data||null);setProfileLoading(false)}
    })();
    return()=>{active=false};
  },[]);

  const data=useMemo(()=>{
    const clean=activities.filter(a=>!a.is_duplicate&&!a.exclude_from_analysis);
    const mode=chooseLoadMode(clean,profile);
    const daily=buildDaily(clean,profile,mode);
    const shown=daily.slice(-range);
    const latest=daily[daily.length-1]||{fitness:0,fatigue:0,form:0};
    const last7=daily.slice(-7).reduce((n,x)=>n+x.load,0),prev7=daily.slice(-14,-7).reduce((n,x)=>n+x.load,0);
    const recentStart=new Date();recentStart.setHours(0,0,0,0);recentStart.setDate(recentStart.getDate()-6);
    const recent=clean.filter(a=>{const d=activityDate(a.start_date_local||a.start_date);return d&&d>=recentStart});
    const seconds=recent.reduce((n,a)=>n+Number(a.moving_time_s||0),0);
    const weekly=[];const thisWeek=mondayStart(new Date());
    for(let i=7;i>=0;i--){const start=new Date(thisWeek.getTime()-i*7*DAY),end=new Date(start.getTime()+7*DAY);const rows=clean.filter(a=>{const d=activityDate(a.start_date_local||a.start_date);return d&&d>=start&&d<end});weekly.push({label:shortDate(start),load:rows.reduce((n,a)=>n+sessionLoad(a,profile,mode),0),hours:rows.reduce((n,a)=>n+Number(a.moving_time_s||0),0)/3600})}
    const fitnessPast=daily[Math.max(0,daily.length-29)]?.fitness||0;
    const wkg=Number(profile?.ftp_w)>0&&Number(profile?.weight_kg)>0?Number(profile.ftp_w)/Number(profile.weight_kg):null;
    return{mode,daily,shown,latest,last7,prev7,recent,seconds,weekly,fitnessPast,wkg};
  },[activities,profile,range]);

  const maxWeek=Math.max(1,...data.weekly.map(x=>x.load));
  const loadChange=data.prev7>0?((data.last7-data.prev7)/data.prev7)*100:null;
  const fitnessChange=data.fitnessPast>0?((data.latest.fitness-data.fitnessPast)/data.fitnessPast)*100:null;
  const balance=data.latest.form>5?'Fresh':data.latest.form<-10?'Loaded':'Balanced';
  const coach=useMemo(()=>{
    if(activities.length<5)return'Keep syncing Strava. More history will make the performance trend more useful.';
    if(loadChange!=null&&loadChange>30)return'Your 7-day training load has jumped sharply. Keep the next easy session genuinely easy and watch how your legs respond.';
    if(data.latest.form<-15)return'Fatigue is running well above your longer-term fitness trend. Protect recovery before adding another hard session.';
    if(fitnessChange!=null&&fitnessChange>5)return'Your longer-term fitness trend is building. Keep the hard days purposeful and the easy days easy.';
    if(data.latest.form>8)return'Your current training balance is relatively fresh. This is a good window for a key quality session if it matches the plan.';
    return'Training load and longer-term fitness are reasonably balanced. Stay consistent rather than adding unnecessary intensity.';
  },[activities.length,loadChange,data.latest.form,fitnessChange]);

  return <div className="stack training-performance-screen">
    <section className="card performance-head">
      <div className="row-between"><div><span className="eyebrow">MY PERFORMANCE</span><h2>Training balance</h2></div><button className="icon-btn" disabled={loading} onClick={onRefresh} aria-label="Refresh performance"><TrendingUp size={18}/></button></div>
      <p className="muted">A simple view of what your downloaded training is doing over time. {profileLoading?'Loading athlete details…':modeLabel(data.mode)+'.'}</p>
      <div className="performance-stat-grid">
        <div><span>Fitness</span><strong>{round(data.latest.fitness)}</strong><small>{fitnessChange==null?'Building baseline':`${fitnessChange>=0?'+':''}${round(fitnessChange)}% vs 4 weeks ago`}</small></div>
        <div><span>Fatigue</span><strong>{round(data.latest.fatigue)}</strong><small>Short-term load</small></div>
        <div><span>Form</span><strong>{round(data.latest.form)}</strong><small>{balance}</small></div>
        <div><span>7-day load</span><strong>{round(data.last7)}</strong><small>{loadChange==null?'No prior week':`${loadChange>=0?'+':''}${round(loadChange)}% vs previous 7d`}</small></div>
      </div>
    </section>

    <section className="card coach-card"><span className="eyebrow">COACH SAYS</span><h3>{coach}</h3><p className="muted">This is a coaching signal from downloaded training, not a medical readiness assessment.</p></section>

    <section className="card performance-chart-card">
      <div className="row-between"><div><span className="eyebrow">FITNESS / FATIGUE</span><h3>Training trend</h3></div><Gauge size={22}/></div>
      <div className="segmented small performance-range">{[[42,'6 weeks'],[84,'12 weeks'],[180,'6 months']].map(([n,label])=><button key={n} className={range===n?'active':''} onClick={()=>setRange(n)}>{label}</button>)}</div>
      <div className="performance-legend"><span><i className="fitness-dot"/>Fitness</span><span><i className="fatigue-dot"/>Fatigue</span></div>
      <svg className="performance-line-chart" viewBox="0 0 600 210" role="img" aria-label="Fitness and fatigue trend">
        <line x1="22" y1="188" x2="578" y2="188" className="chart-axis"/>
        <path d={linePath(data.shown,'fitness')} className="fitness-line"/>
        <path d={linePath(data.shown,'fatigue')} className="fatigue-line"/>
      </svg>
      <div className="chart-date-row"><span>{data.shown[0]?shortDate(data.shown[0].date):'—'}</span><span>Today</span></div>
    </section>

    <section className="card weekly-load-card">
      <div className="row-between"><div><span className="eyebrow">WEEKLY LOAD</span><h3>Last 8 weeks</h3></div><BarChart3 size={22}/></div>
      <div className="weekly-bars">{data.weekly.map((w,i)=><div className="weekly-bar-col" key={`${w.label}-${i}`}><div className="weekly-bar-value">{round(w.load)}</div><div className="weekly-bar-track"><div className="weekly-bar-fill" style={{height:`${Math.max(4,(w.load/maxWeek)*100)}%`}}/></div><span>{w.label}</span></div>)}</div>
    </section>

    <section className="card performance-week-card">
      <span className="eyebrow">LAST 7 DAYS</span>
      <div className="performance-week-grid">
        <div><Timer size={18}/><strong>{duration(data.seconds)}</strong><span>Training time</span></div>
        <div><Activity size={18}/><strong>{data.recent.length}</strong><span>Activities</span></div>
        <div><Zap size={18}/><strong>{Number(profile?.ftp_w)>0?`${round(profile.ftp_w)} W`:'—'}</strong><span>FTP</span></div>
        <div><HeartPulse size={18}/><strong>{data.wkg?`${round(data.wkg,2)} W/kg`:'—'}</strong><span>Power / weight</span></div>
      </div>
    </section>
  </div>
}
