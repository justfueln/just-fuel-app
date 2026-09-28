import React from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import ShellNextV3 from './ShellNextV3';
import ErrorBoundary from './ErrorBoundary';
import NetworkStatus from './NetworkStatus';
import './styles.css';
import './shell-next.css';
import './shell-v3.css';
import './plan-readability.css';
import './reminder-v2.css';
import './training-fixes.css';
import './training-fuel.css';
import './training-boost-control.css';
import './season-v3.css';
import './race-guide-v1.css';
import './stage-race-planner.css';
import './stage-race-mobile-fix.css';
import './stage-mobile-fit-v2.css';
import './training-workout-details.css';
import './training-simple-flow-v4.css';
import './training-plan-compare.css';
import './training-fuel-review.css';
import './training-feedback.css';
import './app-polish-v5.css';
import './checkout-v6.css';
import './current-shell-v4.css';
import './navigation-v1.css';
import './navigation-v2.css';
import './race-hub-v2.css';
import './race-hub-v2-bridge.css';
import './fuel-hub-v2.css';
import './profile-hub-v1.css';
import './mobile-ux-audit-v1.css';
import './mobile-scroll-performance-v1.css';
import './home-dashboard-v1.css';
import './training-coach-v1.css';
import './training-intelligence-v1.css';
import './training-adaptive-v1.css';
import './training-readiness-v1.css';
import './training-week-learning-v1.css';
import './training-progression-v1.css';
import './training-ftp-detection-v1.css';
import './training-power-curve-v1.css';
import './training-achievements-v1.css';
import './race-goal-progress-v1.css';
import './race-fuel-rehearsal-v1.css';
import './basketBridge';
import './training-boost-control';
import './training-workout-details';
import './training-simple-flow-v4';
import './training-feedback';
import './training-coach-v1';
import './training-weather-v1';
import './training-coach-review-v1';
import './training-adaptive-v1';
import './training-readiness-v1';
import './training-week-learning-v1';
import './training-progression-v1';
import './training-ftp-detection-v1';
import './training-power-curve-v1';
import './training-achievements-v1';
import './race-goal-progress-v1';
import './race-fuel-rehearsal-v1';
import './app-analytics';

const CURRENT_APP_VERSION='14';

export const supabase = createClient(
  'https://ufolqntrfmvefpvrjnsa.supabase.co',
  'sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

async function purgeLegacyPwa(){
  try{
    let registrations=[];
    let cacheNames=[];
    const hadController=Boolean(navigator.serviceWorker?.controller);

    if('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations){
      registrations=await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(async reg=>{
        try{reg.waiting?.postMessage('JF_RETIRE_LEGACY')}catch{}
        try{reg.active?.postMessage('JF_RETIRE_LEGACY')}catch{}
        try{return await reg.unregister()}catch{return false}
      }));
    }

    if('caches' in window && caches.keys){
      cacheNames=await caches.keys();
      await Promise.all(cacheNames.map(name=>caches.delete(name).catch(()=>false)));
    }

    return registrations.length>0 || cacheNames.length>0 || hadController;
  }catch(error){
    console.warn('Legacy Just Fuel PWA cleanup failed:',error);
    return false;
  }
}

async function boot(){
  const cleaned=await purgeLegacyPwa();
  const url=new URL(window.location.href);
  const alreadyCleared=url.searchParams.get('legacy')==='cleared'&&url.searchParams.get('jfapp')===CURRENT_APP_VERSION;

  if(cleaned&&!alreadyCleared){
    url.searchParams.set('jfapp',CURRENT_APP_VERSION);
    url.searchParams.set('legacy','cleared');
    window.location.replace(`${url.pathname}${url.search}${url.hash}`);
    return;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <NetworkStatus />
        <ShellNextV3 />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

boot();
