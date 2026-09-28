import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const routeEnhancementsUrl=new URL('../src/route-enhancements.js',import.meta.url);
const guardUrl=new URL('../src/race-addon-stability.js',import.meta.url);

test('Race mutation guard loads before the two legacy Race add-ons',async()=>{
  const source=await readFile(routeEnhancementsUrl,'utf8');
  const raceScope=source.indexOf("section==='race'");
  const guard=source.indexOf("import('./race-addon-stability')",raceScope);
  const progress=source.indexOf("import('./race-goal-progress-v1')",guard);
  const rehearsal=source.indexOf("import('./race-fuel-rehearsal-v1')",guard);
  assert.ok(raceScope>=0);
  assert.ok(guard>raceScope);
  assert.ok(progress>guard);
  assert.ok(rehearsal>guard);
});

test('Race mutation guard suppresses add-on-only DOM churn',async()=>{
  const source=await readFile(guardUrl,'utf8');
  for(const selector of ['.jf-race-prep-card','.jf-race-rehearsal-card','.jf-race-prep-chip','.jf-rehearsal-session']){
    assert.ok(source.includes(selector),`missing ${selector}`);
  }
  assert.match(source,/records\.filter\(record=>!addonOnlyMutation\(record\)\)/);
  assert.match(source,/window\.MutationObserver=RaceSafeMutationObserver/);
});
