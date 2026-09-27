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
import './basketBridge';
import './training-boost-control';
import './training-workout-details';
import './training-simple-flow-v4';
import './training-feedback';
import './app-analytics';

export const supabase = createClient(
  'https://ufolqntrfmvefpvrjnsa.supabase.co',
  'sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

async function purgeLegacyPwa(){
  try{
    const marker='jf-current-app-clean-v11';
    if(sessionStorage.getItem(marker)==='1') return false;

    let registrations=[];
    if('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations){
      registrations=await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg=>reg.unregister().catch(()=>false)));
    }

    let cacheNames=[];
    if('caches' in window && caches.keys){
      cacheNames=await caches.keys();
      await Promise.all(cacheNames.map(name=>caches.delete(name).catch(()=>false)));
    }

    sessionStorage.setItem(marker,'1');
    return registrations.length>0 || cacheNames.length>0 || Boolean(navigator.serviceWorker?.controller);
  }catch(error){
    console.warn('Legacy Just Fuel PWA cleanup failed:',error);
    return false;
  }
}

async function boot(){
  const cleaned=await purgeLegacyPwa();
  if(cleaned){
    const url=new URL(window.location.href);
    url.searchParams.set('jfapp','11');
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
