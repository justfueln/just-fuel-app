import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(join(here,'..',path),'utf8');

test('Phase 10 final UX polish remains deferred after first paint',()=>{
  const routes=read('src/route-enhancements.js');
  assert.match(routes,/import\('\.\/final-ux-v10'\)/);
  assert.match(routes,/idle\(\(\)=>Promise\.all/);
});

test('Phase 10 adds keyboard navigation and accessible current-page semantics',()=>{
  const ux=read('src/final-ux-v10.js');
  const css=read('src/final-ux-v10.css');
  assert.match(ux,/Skip to main content/);
  assert.match(ux,/aria-current/);
  assert.match(ux,/jf-main-content/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
});

test('Phase 10 prevents mobile input zoom and preserves large touch targets',()=>{
  const css=read('src/final-ux-v10.css');
  assert.match(css,/font-size:16px!important/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/min-height:48px/);
});

test('Phase 10 offline wording does not claim retired PWA caching',()=>{
  const network=read('src/NetworkStatus.jsx');
  assert.match(network,/live sync, ordering and updates may be unavailable/);
  assert.doesNotMatch(network,/cached screens/i);
  assert.match(network,/aria-live="polite"/);
});

test('Phase 10 expands conversion analytics without collecting athlete metrics',()=>{
  const analytics=read('src/app-analytics.js');
  assert.match(analytics,/smart_alert_action/);
  assert.match(analytics,/smart_alert_dismissed/);
  assert.match(analytics,/fuel_shortage_add_clicked/);
  assert.match(analytics,/email\|name\|token\|password\|secret\|strava\|heart\|weight\|health/i);
});

test('Phase 10 fatal error screen offers a clear recovery action',()=>{
  const errorBoundary=read('src/ErrorBoundary.jsx');
  assert.match(errorBoundary,/aria-labelledby="jf-error-title"/);
  assert.match(errorBoundary,/Reload app/);
  assert.match(errorBoundary,/fatal_error_reload_clicked/);
});
