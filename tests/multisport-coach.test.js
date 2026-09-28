import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const profileUrl=new URL('../src/ProfileHub.jsx',import.meta.url);
const apiUrl=new URL('../src/training-api.js',import.meta.url);
const mainUrl=new URL('../src/main.jsx',import.meta.url);
const targetsUrl=new URL('../src/training-multisport-targets-v1.js',import.meta.url);
const detailsUrl=new URL('../src/training-workout-details.js',import.meta.url);

test('athlete profile supports cycling running triathlon and hyrox without requiring FTP',async()=>{
  const source=await readFile(profileUrl,'utf8');
  for(const label of ['Cycle','Run / Jog','Triathlon','HYROX'])assert.match(source,new RegExp(label.replace('/','\\/')));
  assert.match(source,/No power meter\? Leave FTP blank/);
  assert.match(source,/Effort \/ RPE/);
  assert.match(source,/refresh_training_sport_detection/);
  assert.match(source,/refresh_training_session_targets/);
});

test('fuel training uses the sport-aware fuel plan',async()=>{
  const source=await readFile(apiUrl,'utf8');
  assert.match(source,/training_session_fuel_plan_multisport/);
  assert.match(source,/fuel_delivery_mode/);
});

test('Strava sync refreshes sensor detection and workout targets',async()=>{
  const source=await readFile(apiUrl,'utf8');
  assert.match(source,/refresh_training_sport_detection/);
  assert.match(source,/refresh_training_session_targets/);
  assert.match(source,/jf-strava-synced/);
});

test('current shell loads multisport workout target enhancement',async()=>{
  const source=await readFile(mainUrl,'utf8');
  assert.match(source,/training-multisport-targets-v1\.css/);
  assert.match(source,/training-multisport-targets-v1';/);
});

test('workout cards can display power heart rate pace or RPE targets',async()=>{
  const source=await readFile(targetsUrl,'utf8');
  for(const metric of ["metric==='power'","metric==='heart_rate'","metric==='pace'","target_rpe_low"])assert.ok(source.includes(metric),`missing ${metric}`);
  assert.match(source,/\/km/);
  assert.match(source,/bpm/);
});

test('expanded workout details prefer sport-aware target text and show hydration guidance',async()=>{
  const source=await readFile(detailsUrl,'utf8');
  assert.match(source,/s\.targetText\|\|/);
  assert.match(source,/secondary_target_text/);
  assert.match(source,/hydration_ml_per_hour/);
  assert.match(source,/sodium_target_mg_per_hour/);
});
