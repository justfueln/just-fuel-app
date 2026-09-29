import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(join(here,'..',path),'utf8');

test('startup API calls are deduplicated and time-bounded',()=>{
  const api=read('src/training-api.js');
  assert.match(api,/cachedRequest\(`today-dashboard:/);
  assert.match(api,/cachedRequest\(`today-readiness:/);
  assert.match(api,/cachedRequest\(`fuel-forecast:/);
  assert.match(api,/runPostgrest\(client\.rpc\('get_today_dashboard'/);
  assert.match(api,/1800\)/);
  assert.match(api,/1200\)/);
  assert.match(api,/3500\)/);
});

test('smart alerts do not compete with Home during first paint',()=>{
  const alerts=read('src/SmartAlerts.jsx');
  assert.match(alerts,/setTimeout\(begin,4500\)/);
  assert.match(alerts,/Dashboard first/);
  assert.match(alerts,/await fetchTodayDashboard/);
  assert.match(alerts,/await fetchTrainingFuelForecast/);
  assert.doesNotMatch(alerts,/Promise\.all\(\[\s*fetchTodayDashboard/);
});

test('onboarding and legacy PWA cleanup are deferred startup maintenance',()=>{
  const main=read('src/main.jsx');
  assert.match(main,/\},5000\);/);
  assert.match(main,/handOffLegacyWorker\(\).*\},6000\)/s);
});

test('stable vendor libraries are split for stronger browser caching',()=>{
  const vite=read('vite.config.js');
  assert.match(vite,/react-vendor/);
  assert.match(vite,/supabase-vendor/);
  assert.match(vite,/icons-vendor/);
  assert.match(vite,/manualChunks/);
});
