import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const home=()=>readFileSync(join(here,'../src/HomeIndex.jsx'),'utf8');

test('Home paints the dashboard before readiness and stock finish',()=>{
  const source=home();
  const load=source.slice(source.indexOf('async function load()'),source.indexOf('useEffect(()=>{load()},[])'));
  assert.match(load,/const dashboardResult=await fetchTodayDashboard/);
  assert.match(load,/setLoading\(false\);[\s\S]*fetchTodayReadiness/);
  assert.match(load,/fetchTodayReadiness[\s\S]*\.finally\(\(\)=>setReadinessLoading\(false\)\)/);
  assert.match(load,/fetchTrainingFuelForecast/);
  assert.doesNotMatch(load,/Promise\.all\(\[\s*fetchTodayDashboard[\s\S]*fetchTodayReadiness/);
});

test('Home does not flash an empty readiness form while readiness is still loading',()=>{
  const source=home();
  assert.match(source,/readinessLoading&&!readiness/);
  assert.match(source,/Loading readiness…/);
  assert.match(source,/!readiness&&!readinessLoading/);
});
