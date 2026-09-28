import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const appUrl=new URL('../src/App.jsx',import.meta.url);
const fuelUrl=new URL('../src/training-fuel.js',import.meta.url);
const apiUrl=new URL('../src/services/stravaApi.js',import.meta.url);
const mainUrl=new URL('../src/main.jsx',import.meta.url);
const targetsUrl=new URL('../src/training-multisport-targets-v1.js',import.meta.url);
const workoutUrl=new URL('../src/training-workout-details.js',import.meta.url);

// Keep the multisport training plumbing generic so cycling, running,
// triathlon and Hyrox can share the same shell without forcing FTP.
test('athlete profile supports cycling running triathlon and hyrox without requiring FTP',async()=>{
  const source=await readFile(appUrl,'utf8');
  for(const sport of ['cycling','running','triathlon','hyrox'])assert.ok(source.includes(sport),`missing ${sport}`);
  assert.match(source,/preferred_intensity_source/);
  assert.match(source,/threshold_pace_sec_per_km/);
});

test('fuel training uses the sport-aware fuel plan',async()=>{
  const source=await readFile(fuelUrl,'utf8');
  assert.match(source,/sport_type/);
  assert.match(source,/hydration_ml_per_hour/);
  assert.match(source,/sodium_target_mg_per_hour/);
  assert.match(source,/recover_servings/);
});

test('training history and performance use universal backend load',async()=>{
  const source=await readFile(apiUrl,'utf8');
  assert.match(source,/activity_type/);
  assert.match(source,/average_watts/);
  assert.match(source,/average_heartrate/);
  assert.match(source,/average_speed/);
});

test('Strava sync refreshes sensor detection and workout targets',async()=>{
  const source=await readFile(apiUrl,'utf8');
  const detection=source.indexOf("refresh_training_sport_detection");
  const targets=source.indexOf("refresh_training_session_targets",detection);
  assert.ok(detection>=0&&targets>detection);
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

test('current shell loads multisport workout target enhancement without forcing it into first paint',async()=>{
  const source=await readFile(mainUrl,'utf8');
  assert.match(source,/training-multisport-targets-v1\.css/);
  assert.match(source,/import\('\.\/training-multisport-targets-v1'\)/);
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
  assert.match(source,/repairWorkoutStepTargets/);
  assert.match(source,/metric==='power'/);
  assert.match(source,/Easy · RPE 2–3\/10/);
  assert.match(source,/target\.textContent=primary/);
});

test('expanded workout details prefer sport-aware target text and show hydration guidance',async()=>{
  const source=await readFile(workoutUrl,'utf8');
  assert.match(source,/data\.target_text/);
  assert.match(source,/hydration_ml_per_hour/);
  assert.match(source,/sodium_target_mg_per_hour/);
});
