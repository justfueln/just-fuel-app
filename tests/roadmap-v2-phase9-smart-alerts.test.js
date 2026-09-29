import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {buildSmartAlerts,mondayWeekKey,saveStravaChangeTransient} from '../src/smart-alerts-utils.js';

const here=dirname(fileURLToPath(import.meta.url));

test('Phase 9 prioritises Strava changes, race week, low stock, workout and weekly plan',()=>{
  const alerts=buildSmartAlerts({
    now:new Date('2026-09-29T08:00:00+02:00'),
    dashboard:{next_session:{date:'2026-09-29',title:'Ride'},next_race:{date:'2026-10-03',name:'Race'}},
    fuel:[{horizon_days:7,short_bottle_mix:2}],
    transient:{changedSessions:2,expiresAt:Date.now()+999999},
    prefs:{enabled:true,workout:true,race:true,stock:true,weekly:true,strava:true},
    dismissed:[]
  });
  assert.ok(alerts.length>0);
  assert.equal(alerts[0].kind,'strava');
});

test('Phase 9 only creates workout alerts for today or tomorrow',()=>{
  const common={now:new Date('2026-09-29T08:00:00+02:00'),fuel:[],prefs:{enabled:true,workout:true,race:true,stock:true,weekly:false,strava:true},dismissed:[]};
  assert.ok(buildSmartAlerts({...common,dashboard:{next_session:{date:'2026-09-30',title:'Ride'}}}).some(x=>x.kind==='workout'));
  assert.ok(!buildSmartAlerts({...common,dashboard:{next_session:{date:'2026-10-02',title:'Ride'}}}).some(x=>x.kind==='workout'));
});

test('Phase 9 low-stock alert is limited to the 7-day forecast',()=>{
  const alerts=buildSmartAlerts({
    now:new Date('2026-09-29T08:00:00+02:00'),dashboard:{},
    fuel:[{horizon_days:30,short_bottle_mix:9},{horizon_days:7,short_bottle_mix:2}],
    prefs:{enabled:true,workout:false,race:false,stock:true,weekly:false,strava:false},dismissed:[]
  });
  const stock=alerts.find(x=>x.kind==='stock');
  assert.ok(stock);
  assert.match(stock.body,/2/);
  assert.doesNotMatch(stock.body,/9/);
});

test('Dismissed alerts stay hidden while other alerts remain available',()=>{
  const base={now:new Date('2026-09-29T08:00:00+02:00'),dashboard:{next_session:{date:'2026-09-29',title:'Ride'},next_race:{date:'2026-10-03',name:'Race'}},fuel:[],prefs:{enabled:true,workout:true,race:true,stock:false,weekly:false,strava:false}};
  const all=buildSmartAlerts({...base,dismissed:[]});
  assert.ok(all.length>=2);
  const next=buildSmartAlerts({...base,dismissed:[all[0].id]});
  assert.ok(next.every(x=>x.id!==all[0].id));
});

test('Strava plan changes are stored as a short-lived smart-alert transient',()=>{
  const storage=new Map();
  storage.setItem=(k,v)=>storage.set(k,v);storage.getItem=k=>storage.get(k)||null;
  const saved=saveStravaChangeTransient({plan_adaptation:{changed_sessions:3}},storage,1000);
  assert.equal(saved.changedSessions,3);
});

test('Weekly plan alerts use a stable Monday-based week key',()=>{
  assert.equal(mondayWeekKey(new Date('2026-09-29T12:00:00+02:00')),'2026-09-28');
});

test('Phase 9 shell keeps alerts separate from Training/Race complex surfaces',()=>{
  const shell=readFileSync(join(here,'../src/ShellNextV3.jsx'),'utf8');
  const component=readFileSync(join(here,'../src/SmartAlerts.jsx'),'utf8');
  assert.match(shell,/const SmartAlerts=lazy\(\(\)=>import\('\.\/SmartAlerts'\)\)/);
  assert.match(shell,/alertsReady&&!reminderDue&&!profileOpen&&!basketOpen&&!isTrainingArea/);
  assert.match(shell,/fuelView:alert\.fuelView/);
  assert.match(component,/jf-strava-synced/);
  assert.match(component,/requestIdleCallback/);
  assert.doesNotMatch(component,/Garmin/i);
  assert.doesNotMatch(component,/PushManager|pushManager/);
});