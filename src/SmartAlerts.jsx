import React,{useEffect,useRef,useState} from 'react';
import {Bell,ChevronRight,X} from 'lucide-react';
import {supabase} from './main';
import {fetchTodayDashboard,fetchTrainingFuelForecast} from './training-api';
import {buildSmartAlerts,dismissSmartAlert,loadSmartAlertPrefs,loadSmartAlertState,loadStravaChangeTransient,localDateKey,saveStravaChangeTransient,visibleSmartAlerts} from './smart-alerts-utils';
import './roadmap-v2-phase9.css';

function normalizeDashboard(value){return Array.isArray(value)?value[0]||{}:value||{}}

export default function SmartAlerts({onAction,hidden=false}){
  const[alerts,setAlerts]=useState([]);
  const mounted=useRef(true);
  const loadToken=useRef(0);

  async function load(){
    const token=++loadToken.current;
    const prefs=loadSmartAlertPrefs();
    if(!prefs.enabled){if(mounted.current)setAlerts([]);return}
    const auth=await supabase.auth.getSession();
    const session=auth.data.session||null;
    if(!session?.user){if(mounted.current)setAlerts([]);return}
    const[dashboardResult,forecastResult]=await Promise.all([
      fetchTodayDashboard(supabase,localDateKey()),
      fetchTrainingFuelForecast(supabase,session.user.id)
    ]);
    if(!mounted.current||token!==loadToken.current)return;
    const next=buildSmartAlerts({
      dashboard:dashboardResult.error?{}:normalizeDashboard(dashboardResult.dashboard),
      forecast:forecastResult.error?[]:forecastResult.fuel,
      transient:loadStravaChangeTransient(),
      prefs,
      now:new Date()
    });
    setAlerts(visibleSmartAlerts(next,loadSmartAlertState()));
  }

  useEffect(()=>{
    mounted.current=true;
    let timer=0,idleId=0;
    const start=()=>load().catch(()=>{});
    if('requestIdleCallback'in window)idleId=window.requestIdleCallback(start,{timeout:1200});
    else timer=window.setTimeout(start,700);

    const refresh=()=>window.setTimeout(()=>load().catch(()=>{}),250);
    const strava=e=>{
      if(e?.detail?.plan_adaptation?.changed_sessions)saveStravaChangeTransient(e.detail);
      refresh();
    };
    const visibility=()=>{if(document.visibilityState==='visible')load().catch(()=>{})};
    window.addEventListener('jf-strava-synced',strava);
    window.addEventListener('jf-training-plan-updated',refresh);
    window.addEventListener('jf-smart-alerts-refresh',refresh);
    document.addEventListener('visibilitychange',visibility);
    return()=>{
      mounted.current=false;
      if(timer)window.clearTimeout(timer);
      if(idleId&&'cancelIdleCallback'in window)window.cancelIdleCallback(idleId);
      window.removeEventListener('jf-strava-synced',strava);
      window.removeEventListener('jf-training-plan-updated',refresh);
      window.removeEventListener('jf-smart-alerts-refresh',refresh);
      document.removeEventListener('visibilitychange',visibility);
    };
  },[]);

  if(hidden||!alerts.length)return null;
  const alert=alerts[0];

  function dismiss(){
    dismissSmartAlert(alert.id);
    setAlerts(current=>current.filter(item=>item.id!==alert.id));
  }
  function act(){
    dismissSmartAlert(alert.id);
    setAlerts(current=>current.filter(item=>item.id!==alert.id));
    onAction?.(alert);
  }

  return <aside className={`phase9-smart-alert ${alert.type}`} aria-live="polite">
    <span className="phase9-alert-icon"><Bell size={18}/></span>
    <div className="phase9-alert-copy"><small>JUST FUEL ALERT</small><strong>{alert.title}</strong><p>{alert.body}</p></div>
    <button className="phase9-alert-action" onClick={act}>{alert.action}<ChevronRight size={16}/></button>
    <button className="phase9-alert-dismiss" onClick={dismiss} aria-label="Dismiss alert"><X size={17}/></button>
  </aside>;
}
