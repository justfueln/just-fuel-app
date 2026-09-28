import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const homeUrl=new URL('../src/HomeIndex.jsx',import.meta.url);
const cssUrl=new URL('../src/home-dashboard-v1.css',import.meta.url);
const sqlUrl=new URL('../scripts/roadmap-v2-phase2-home-dashboard.sql',import.meta.url);

async function source(url){return readFile(url,'utf8')}

test('Home leads with the next workout and sport-neutral targets',async()=>{
  const home=await source(homeUrl);
  assert.match(home,/DO THIS NEXT/);
  assert.match(home,/Duration/);
  assert.match(home,/Intensity/);
  assert.match(home,/Fuel target/);
  assert.doesNotMatch(home,/Power<\/span>/);
});

test('Home shows fuel, race and stock as daily priorities without duplicating main navigation',async()=>{
  const home=await source(homeUrl);
  assert.match(home,/FUEL FOR THIS WORKOUT/);
  assert.match(home,/NEXT RACE/);
  assert.match(home,/7-DAY FUEL STOCK/);
  assert.match(home,/See what to order/);
  assert.doesNotMatch(home,/QUICK ACCESS/);
  assert.doesNotMatch(home,/function QuickLinks/);
});

test('stock forecast never blocks the first Home dashboard',async()=>{
  const home=await source(homeUrl);
  const firstPaint=home.indexOf('setLoading(false)');
  const forecast=home.indexOf('fetchTrainingFuelForecast');
  assert.ok(firstPaint>=0&&forecast>=0&&firstPaint<forecast);
  assert.match(home,/must never delay first paint/);
});

test('weekly analytics are progressively disclosed',async()=>{
  const home=await source(homeUrl);
  const css=await source(cssUrl);
  assert.match(home,/<details className="today-more-card">/);
  assert.match(home,/This week/);
  assert.match(css,/\.today-more-card/);
});

test('Home RPC uses sport-aware training fuel',async()=>{
  const sql=await source(sqlUrl);
  assert.match(sql,/left join training_session_fuel_plan_multisport f on f\.session_id=s\.id/);
  assert.doesNotMatch(sql,/left join training_session_fuel_plan f on/);
});
