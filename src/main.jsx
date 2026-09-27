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
import './training-workout-details.css';
import './training-simple-flow-v4.css';
import './training-plan-compare.css';
import './training-fuel-review.css';
import './training-feedback.css';
import './app-polish-v5.css';
import './checkout-v6.css';
import './current-shell-v4.css';
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    try {
      const registration = await navigator.serviceWorker.register('/sw.js?v=10', {
        scope: '/',
        updateViaCache: 'none'
      });
      await registration.update();

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('just-fuel-')).map(key => caches.delete(key)));
      }

      const refreshServiceWorker = () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', refreshServiceWorker);
    } catch (error) {
      console.warn('Service worker registration failed:', error);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <NetworkStatus />
      <ShellNextV3 />
    </ErrorBoundary>
  </React.StrictMode>
);
