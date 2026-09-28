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
import './training-multisport-targets-v1.css';
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
import './race-week-execution-v1.css';
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

const CURRENT_APP_VERSION='16';
const PWA_CLEAN_KEY=`jf-pwa-clean-v${CURRENT_APP_VERSION}`;
let enhancementsScheduled=false;

export const supabase = createClient(
  'https://ufolqntrfmvefpvrjnsa.supabase.co',
  'sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

function markPwaClean(){
  try{localStorage.setItem(PWA_CLEAN_KEY,'1')}catch{}
}

function pwaAlreadyClean(){
  try{return localStorage.getItem(PWA_CLEAN_KEY)==='1'}catch{return false}
}

async function deleteLegacyCaches(){
  try{
    if(!('caches' in window) || !caches.keys) return [];
    const names=await caches.keys();
    await Promise.all(names.map(name=>caches.delete(name).catch(()=>false)));
    return names;
  }catch{
    return [];
  }
}

async function handOffLegacyWorker(){
  if(!('serviceWorker' in navigator)){
    markPwaClean();
    return false;
  }

  const url=new URL(window.location.href);
  const alreadyCleared=url.searchParams.get('legacy')==='cleared'&&url.searchParams.get('jfapp')===CURRENT_APP_VERSION;

  let registrations=[];
  try{registrations=await navigator.serviceWorker.getRegistrations()}catch{}
  const hasController=Boolean(navigator.serviceWorker.controller);

  if(alreadyCleared){
    Promise.all(registrations.map(reg=>reg.unregister().catch(()=>false))).catch(()=>{});
    deleteLegacyCaches().catch(()=>{});
    markPwaClean();
    return false;
  }

  // Once the old PWA is gone, never clear CacheStorage on every normal launch.
  if(!registrations.length&&!hasController){
    if(!pwaAlreadyClean())markPwaClean();
    return false;
  }

  try{
    const retirement=await navigator.serviceWorker.register('/sw.js?retire=16',{
      scope:'/',
      updateViaCache:'none'
    });
    try{await retirement.update()}catch{}
    try{retirement.waiting?.postMessage('JF_FORCE_ACTIVATE')}catch{}
    try{retirement.installing?.postMessage('JF_FORCE_ACTIVATE')}catch{}

    window.setTimeout(async()=>{
      await deleteLegacyCaches();
      try{
        const currentRegs=await navigator.serviceWorker.getRegistrations();
        await Promise.all(currentRegs.map(reg=>reg.unregister().catch(()=>false)));
      }catch{}
      markPwaClean();
    },1200);
    return true;
  }catch(error){
    console.warn('Legacy Just Fuel PWA takeover failed:',error);
    return false;
  }
}

function loadEnhancements(){
  if(enhancementsScheduled)return;
  enhancementsScheduled=true;

  const run=async()=>{
    await Promise.all([
      import('./basketBridge'),
      import('./training-boost-control'),
      import('./training-workout-details'),
      import('./training-multisport-targets-v1'),
      import('./training-simple-flow-v4'),
      import('./training-feedback'),
      import('./training-coach-v1'),
      import('./training-weather-v1'),
      import('./training-coach-review-v1'),
      import('./training-adaptive-v1'),
      import('./training-readiness-v1'),
      import('./training-week-learning-v1'),
      import('./training-progression-v1'),
      import('./training-ftp-detection-v1'),
      import('./training-power-curve-v1'),
      import('./training-achievements-v1')
    ]);

    await import('./race-addon-stability');
    await Promise.all([
      import('./race-goal-progress-v1'),
      import('./race-fuel-rehearsal-v1'),
      import('./race-week-execution-v1'),
      import('./app-analytics')
    ]);
  };

  const start=()=>run().catch(error=>console.warn('Deferred Just Fuel enhancements failed:',error));
  if('requestIdleCallback' in window){
    window.requestIdleCallback(start,{timeout:1200});
  }else{
    window.setTimeout(start,180);
  }
}

function renderApp(){
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <NetworkStatus />
        <ShellNextV3 />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

function boot(){
  try{document.cookie='jf_shell_v16=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure'}catch{}

  // First paint must never wait for legacy PWA cleanup or optional enhancements.
  renderApp();
  loadEnhancements();

  // Retire any old service worker after the current shell is already visible.
  window.setTimeout(()=>{handOffLegacyWorker().catch(()=>{})},0);
}

boot();
