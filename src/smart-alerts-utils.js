export const SMART_ALERT_STATE_KEY='jf-smart-alerts-v1';
export const SMART_ALERT_TRANSIENT_KEY='jf-smart-alert-transient-v1';
export const SMART_ALERT_PREFS_KEY='jf-smart-alert-prefs-v1';

export const SMART_ALERT_DEFAULTS={
  enabled:true,
  workout:true,
  raceWeek:true,
  lowStock:true,
  weeklyPlan:true,
  stravaChanges:true
};

const pad=n=>String(n).padStart(2,'0');
export function localDateKey(date=new Date()){return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}

export function mondayWeekKey(date=new Date()){
  const d=new Date(date);d.setHours(12,0,0,0);
  const shift=(d.getDay()+6)%7;d.setDate(d.getDate()-shift);
  return localDateKey(d);
}

export function loadSmartAlertPrefs(storage=globalThis.localStorage){
  try{return{...SMART_ALERT_DEFAULTS,...(JSON.parse(storage?.getItem?.(SMART_ALERT_PREFS_KEY)||'null')||{})}}
  catch{return{...SMART_ALERT_DEFAULTS}}
}

export function saveSmartAlertPrefs(value,storage=globalThis.localStorage){
  const next={...SMART_ALERT_DEFAULTS,...(value||{})};
  try{storage?.setItem?.(SMART_ALERT_PREFS_KEY,JSON.stringify(next))}catch{}
  return next;
}

export function loadSmartAlertState(storage=globalThis.localStorage){
  try{const parsed=JSON.parse(storage?.getItem?.(SMART_ALERT_STATE_KEY)||'null')||{};return{dismissed:parsed.dismissed||{}}}
  catch{return{dismissed:{}}}
}

export function dismissSmartAlert(id,storage=globalThis.localStorage){
  const state=loadSmartAlertState(storage),now=Date.now();
  const dismissed={...state.dismissed,[String(id)]:now};
  const entries=Object.entries(dismissed).sort((a,b)=>b[1]-a[1]).slice(0,60);
  const next={dismissed:Object.fromEntries(entries)};
  try{storage?.setItem?.(SMART_ALERT_STATE_KEY,JSON.stringify(next))}catch{}
  return next;
}

export function saveStravaChangeTransient(detail,storage=globalThis.localStorage,now=Date.now()){
  const changed=Math.max(0,Number(detail?.plan_adaptation?.changed_sessions)||0);
  if(!changed)return null;
  const value={changedSessions:changed,createdAt:now};
  try{storage?.setItem?.(SMART_ALERT_TRANSIENT_KEY,JSON.stringify(value))}catch{}
  return value;
}

export function loadStravaChangeTransient(storage=globalThis.localStorage,now=Date.now()){
  try{
    const value=JSON.parse(storage?.getItem?.(SMART_ALERT_TRANSIENT_KEY)||'null');
    if(!value?.createdAt||now-Number(value.createdAt)>86400000){storage?.removeItem?.(SMART_ALERT_TRANSIENT_KEY);return null}
    return value;
  }catch{return null}
}

function dateObj(value){if(!value)return null;const d=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?null:d}
function daysBetween(a,b){return Math.round((b-a)/86400000)}
function productLabel(key){return({bottle_mix:'Bottle Mix',energy_gel:'gels',boost_gel:'Boost',hydrate:'Hydrate',recover:'Recover'}[String(key)]||'fuel')}

export function buildSmartAlerts({dashboard={},forecast=[],transient=null,prefs=SMART_ALERT_DEFAULTS,now=new Date()}={}){
  const options={...SMART_ALERT_DEFAULTS,...prefs};
  if(!options.enabled)return[];
  const today=localDateKey(now),week=mondayWeekKey(now),alerts=[];

  if(options.stravaChanges&&transient?.changedSessions){
    const changed=Math.max(1,Number(transient.changedSessions)||1);
    alerts.push({
      id:`strava-change:${Number(transient.createdAt)||today}`,
      type:'strava_change',priority:100,
      title:'Training updated',
      body:`Strava adjusted ${changed} upcoming session${changed===1?'':'s'}. Review the updated plan before your next workout.`,
      action:'Review training',route:'training'
    });
  }

  const race=dashboard?.next_race||null;
  const daysToRace=Number(race?.days_to_race);
  if(options.raceWeek&&race&&Number.isFinite(daysToRace)&&daysToRace>=0&&daysToRace<=7){
    const name=String(race.name||race.event_name||'Your race');
    alerts.push({
      id:`race-week:${week}:${name}`,
      type:'race_week',priority:90,
      title:daysToRace===0?`Race day: ${name}`:`Race week: ${name}`,
      body:daysToRace===0?'Race day is here. Check your race plan, fuel and checklist.':`${daysToRace} day${daysToRace===1?'':'s'} to go. Check your race plan, fuel and checklist.`,
      action:'Open race',route:'race'
    });
  }

  const seven=(forecast||[]).filter(row=>Number(row?.horizon_days)===7);
  const short=seven.filter(row=>Math.max(0,Number(row?.shortfall_units)||0)>0.001);
  if(options.lowStock&&short.length){
    const names=short.slice(0,2).map(row=>productLabel(row.product_key));
    const extra=short.length-names.length;
    alerts.push({
      id:`low-stock:${today}:${short.map(x=>x.product_key).sort().join(',')}`,
      type:'low_stock',priority:80,
      title:'Fuel shortage for the next 7 days',
      body:`Low on ${names.join(' + ')}${extra?` + ${extra} more`:''}. Add only the real shortage to your basket.`,
      action:'Order shortage',route:'fuel',fuelView:'order'
    });
  }

  const session=dashboard?.next_session||null;
  const sessionDate=dateObj(session?.date||session?.session_date),todayDate=dateObj(today);
  const workoutDays=sessionDate&&todayDate?daysBetween(todayDate,sessionDate):null;
  if(options.workout&&session&&workoutDays!=null&&workoutDays>=0&&workoutDays<=1){
    const when=workoutDays===0?'Today':'Tomorrow';
    alerts.push({
      id:`workout:${today}:${String(session?.id||session?.session_id||session?.title||'next')}:${workoutDays}`,
      type:'workout',priority:70,
      title:`${when}: ${session.title||'planned workout'}`,
      body:session?.is_key?'Key session coming up. Prepare your kit and fuel before you start.':'Your next planned workout is close. Open Training when you are ready.',
      action:'Open workout',route:'training'
    });
  }

  const planned=Math.max(0,Number(dashboard?.week?.planned_sessions)||0);
  if(options.weeklyPlan&&planned>0){
    alerts.push({
      id:`weekly-plan:${week}`,
      type:'weekly_plan',priority:50,
      title:"This week's plan is ready",
      body:`${planned} planned session${planned===1?'':'s'} this week. Review the week and make sure your fuel is ready.`,
      action:'View training',route:'training'
    });
  }

  return alerts.sort((a,b)=>b.priority-a.priority);
}

export function visibleSmartAlerts(alerts,state=loadSmartAlertState()){
  const dismissed=state?.dismissed||{};
  return(alerts||[]).filter(alert=>!dismissed[alert.id]);
}
