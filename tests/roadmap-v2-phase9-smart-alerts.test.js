import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {buildSmartAlerts,dismissSmartAlert,loadSmartAlertState,mondayWeekKey,saveStravaChangeTransient,visibleSmartAlerts} from '../src/smart-alerts-utils.js';

const here=dirname(fileURLToPath(import.meta.url));
const now=new Date('2026-09-29T10:00:00+02:00');

function memoryStorage(){
  const map=new Map();
  return{getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};
}

test('Phase 9 prioritises Strava changes, race week, low stock, workout and weekly plan',()=>{
  const alerts=buildSmartAlerts({
    now,
    dashboard:{
      next_session:{id:'s1',date:'2026-09-29',title:'Threshold 4 x 8',is_key:true},
      next_race:{name:'Karoo to Coast',days_to_race:5},
      week:{planned_sessions:3}
    },
    forecast:[{horizon_days:7,product_key:'bottle_mix',shortfall_units:4}],
    transient:{changedSessions:2,createdAt:1790660000000}
  });
  assert.deepEqual(alerts.map(x=>x.type),['strava_change','race_week','low_stock','workout','weekly_plan']);
  assert.equal(alerts[0].action,'Review training');
});

test('Phase 9 only creates workout alerts for today or tomorrow',()=>{
  const today=buildSmartAlerts({now,dashboard:{next_session:{date:'2026-09-29',title:'Today'},week:{}},forecast:[]});
  const tomorrow=buildSmartAlerts({now,dashboard:{next_session:{date:'2026-09-30',title:'Tomorrow'},week:{}},forecast:[]});
  const later=buildSmartAlerts({now,dashboard:{next_session:{date:'2026-10-01',title:'Later'},week:{}},forecast:[]});
  assert.equal(today.some(x=>x.type==='workout'),true);
  assert.equal(tomorrow.some(x=>x.type==='workout'),true);
  assert.equal(later.some(x=>x.type==='workout'),false);
});

test('Phase 9 low-stock alert is limited to the 7-day forecast',()=>{
  const alerts=buildSmartAlerts({
    now,
    dashboard:{week:{}},
    forecast:[
      {horizon_days:14,product_key:'bottle_mix',shortfall_units:99},
      {horizon_days:7,product_key:'hydrate',shortfall_units:3}
    ]
  });
  const low=alerts.find(x=>x.type==='low_stock');
  assert.ok(low);
  assert.match(low.body,/Hydrate/);
  assert.doesNotMatch(low.body,/Bottle Mix/);
  assert.equal(low.fuelView,'order');
});

test('Dismissed alerts stay hidden while other alerts remain available',()=>{
  const storage=memoryStorage();
  const alerts=buildSmartAlerts({now,dashboard:{next_race:{name:'Race',days_to_race:3},week:{planned_sessions:2}},forecast:[]});
  assert.equal(alerts.length,2);
  dismissSmartAlert(alerts[0].id,storage);
  const visible=visibleSmartAlerts(alerts,loadSmartAlertState(storage));
  assert.equal(visible.length,1);
  assert.equal(visible[0].type,'weekly_plan');
});

test('Strava plan changes are stored as a short-lived smart-alert transient',()=>{
  const storage=memoryStorage();
  const saved=saveStravaChangeTransient({plan_adaptation:{changed_sessions:3}},storage,1000);
  assert.equal(saved.changedSessions,3);
});

test('Weekly plan alerts use a stable Monday-based week key',()=>{
  assert.equal(mondayWeekKey(new Date('2026-09-29T12:00:00+02:00')),'2026-09-28');
});

test('Phase 9 shell keeps alerts separate from Training/Race complex surfaces',()=>{
  const shell=readFileSync(join(here,'../src/ShellNextV3.jsx'),'utf8');
  const component=readFileSync(join(here,'../src/SmartAlerts.jsx'),'utf8');
  assert.match(shell,/SmartAlerts/);
  assert.match(shell,/hidden=\{isTrainingArea\}/);
  assert.match(shell,/fuelView:alert\.fuelView/);
  assert.match(component,/jf-strava-synced/);
  assert.match(component,/requestIdleCallback/);
  assert.doesNotMatch(component,/Garmin/i);
  assert.doesNotMatch(component,/PushManager|pushManager/);
});
