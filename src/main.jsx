import React from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import ShellNextV3 from './ShellNextV3';
import './styles.css';
import './shell-next.css';
import './shell-v3.css';
import './reminder-v2.css';
import './training-fixes.css';
import './training-fuel.css';
import './training-boost-control.css';
import './season-v3.css';
import './training-workout-details.css';
import './training-simple-flow-v4.css';
import './basketBridge';
import './training-boost-control';
import './training-workout-details';
import './training-simple-flow-v4';

export const supabase = createClient(
  'https://ufolqntrfmvefpvrjnsa.supabase.co',
  'sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><ShellNextV3 /></React.StrictMode>
);
