import React from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import Shell from './Shell';
import './styles.css';
import './shell.css';
import './basket.css';
import './basketBridge';

export const supabase = createClient(
  'https://ufolqntrfmvefpvrjnsa.supabase.co',
  'sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Shell /></React.StrictMode>
);