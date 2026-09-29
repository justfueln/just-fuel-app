import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const apiUrl=new URL('../src/training-api.js',import.meta.url);
const mainUrl=new URL('../src/main.jsx',import.meta.url);
const trainingStylesUrl=new URL('../src/training-route-styles.js',import.meta.url);
const routeEnhancementsUrl=new URL('../src/route-enhancements.js',import.meta.url);
const targetsUrl=new URL('../src/training-multisport-targets-v1.js',import.meta.url);

test('athlete profile supports cycling running triathlon and hyrox without requiring FTP',async()=>{
  const source=await readFile(new URL('../src/ProfileHub.jsx',import.meta.url),'utf8');
  for(const sport of ['cycling','running','triathlon','hyrox'])assert.match(source,new RegExp(sport));
  assert.doesNotMatch(source,/required[^\n]*ftp/i);
});

test('fuel training uses the sport-aware fuel plan',async()=>{
  const source=await readFile(apiUrl,'utf8');
  assert.match(source,/training_session_fuel_plan_multisport/);
  assert.match(source,/sport_type/);
  assert.match(source,/hydration_ml_per_hour/);
  assert.match(source,/sodium_target_mg_per_hour/);
});

test('training history and performance use universal backend load',async()=>{
  const source=await readFile(apiUrl,'utf8');
  assert.match(source,/training_activity_metrics/);
  assert.match(source,/estimated_training_load/);
  assert.match(source,/sport_family/);
});

test('Strava sync refreshes sensor detection and workout targets',async()=>{
  const source=await readFile(apiUrl,'utf8');
  assert.match(source,/refresh_training_sport_detection/);
  assert.match(source,/refresh_training_session_targets/);
});

test('Strava sync reruns adaptive plan and progression before target refresh',async()=>{
  const source=await readFile(apiUrl,'utf8');
  const detection=source.indexOf("refresh_training_sport_detection");
  const adaptation=source.indexOf("refresh_training_plan_adaptation",detection);
  const progression=source.indexOf("refresh_training_progression",adaptation);
  const targets=source.indexOf("refresh_training_session_targets",progression);
  assert.ok(detection>=0&&adaptation>detection&&progression>adaptation&&targets>progression);
  assert.match(source,/plan_adaptation:adaptation\.data\|\|null/);
  assert.match(source,/progression:progression\.data\|\|null/);
});

test('current shell loads multisport workout target enhancement only when Training opens',async()=>{
  const [main,styles,loader]=await Promise.all([
    readFile(mainUrl,'utf8'),
    readFile(trainingStylesUrl,'utf8'),
    readFile(routeEnhancementsUrl,'utf8')
  ]);
  assert.doesNotMatch(main,/training-multisport-targets-v1\.css/);
  assert.match(styles,/training-multisport-targets-v1\.css/);
  assert.doesNotMatch(main,/import\('\.\/training-multisport-targets-v1'\)/);
  assert.match(loader,/section==='training'/);
  assert.match(loader,/import\('\.\/training-multisport-targets-v1'\)/);
});

test('workout cards can display power heart rate pace or RPE targets',async()=>{
  const source=await readFile(targetsUrl,'utf8');
  for(const metric of ["metric==='power'","metric==='heart_rate'","metric==='pace'","target_rpe_low"])assert.ok(source.includes(metric),`missing ${metric}`);
  assert.match(source,/\/km/);
  assert.match(source,/bpm/);
  assert.match(source,/v==='pace'\?'PACE':'RPE'/);
  assert.match(source,/RPE \$\{row\.target_rpe_low\}–\$\{row\.target_rpe_high\}\/10/);
});

test('non-power workout steps are repaired to the resolved sport target',async()=>{
  const source=await readFile(targetsUrl,'utf8');
  assert.match(source,/heart_rate|pace|rpe/);
});

test('expanded workout details prefer sport-aware target text and show hydration guidance',async()=>{
  const source=await readFile(new URL('../src/training-workout-details.js',import.meta.url),'utf8');
  assert.match(source,/target_metric|target_hr|target_pace|target_rpe/);
  assert.match(source,/hydration/i);
});
