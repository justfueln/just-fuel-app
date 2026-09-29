import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(join(here,'..',path),'utf8');

test('Phase 11 establishes shared UI tokens and consistent component geometry',()=>{
  const css=read('src/ui-foundation-v11.css');
  assert.match(css,/--jf-radius-card/);
  assert.match(css,/--jf-space-4/);
  assert.match(css,/\.shop-order-card/);
  assert.match(css,/\.race-v2-card/);
  assert.match(css,/\.fuel-v4-target-card/);
});

test('Phase 11 stops loading the legacy post-render Training navigation patcher',()=>{
  const routes=read('src/route-enhancements.js');
  assert.match(routes,/training-native-v11\.css/);
  assert.doesNotMatch(routes,/import\('\.\/training-simple-flow-v4'\)/);
  assert.match(routes,/import\('\.\/training-workout-details'\)/);
});

test('Phase 11 makes Today Plan Progress the single normal Training navigation layer',()=>{
  const css=read('src/training-native-v11.css');
  assert.match(css,/app-shell>\.section-nav\{display:none!important\}/);
  assert.match(css,/:has\(button:nth-child\(n\+4\)\.active\)/);
  assert.match(css,/jf-profile-button\{display:none!important\}/);
});

test('Phase 11 keeps existing coaching, workout and race enhancements available',()=>{
  const routes=read('src/route-enhancements.js');
  for(const module of ['smart-coach-v2','training-workout-details','training-adaptive-v1','training-readiness-v1','training-progression-v1','race-fuzzy-search-v1']){
    assert.match(routes,new RegExp(module.replaceAll('-','\\-')));
  }
});

test('Phase 11 gives Fuel Planner and Learn one canonical owner instead of duplicate Home subpages',()=>{
  const shell=read('src/ShellNextV3.jsx');
  assert.doesNotMatch(shell,/const FuelBuilder=lazy/);
  assert.doesNotMatch(shell,/const LearnPage=lazy/);
  assert.doesNotMatch(shell,/HomeSubpageHead/);
  assert.doesNotMatch(shell,/openHomeView/);
  assert.match(shell,/section==='home'&&<HomeIndex goRoute=\{setSection\}/);
});

test('Fuel shortage navigation matches the live seven-day ordering flow',()=>{
  const nav=read('src/navigation-registry.js');
  assert.match(nav,/short for the next 7 days/);
  assert.doesNotMatch(nav,/short for 7, 14 or 30 days/);
});
