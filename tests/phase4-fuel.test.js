import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const apiUrl=new URL('../src/training-api.js',import.meta.url);
const fuelUrl=new URL('../src/FuelHubV2.jsx',import.meta.url);

test('training fuel API loads Phase 4 hydration and recovery fields',async()=>{
  const source=await readFile(apiUrl,'utf8');
  assert.match(source,/training_session_fuel_plan_multisport/);
  for(const field of ['hydrate_servings','hydration_ml_per_hour','sodium_target_mg_per_hour','sodium_target_mg_total','fuel_delivery_mode','fueling_note','recovery_note']){
    assert.ok(source.includes(field),`missing ${field}`);
  }
});

test('training fuel UI is sport-aware and keeps 120 g per hour manual',async()=>{
  const source=await readFile(fuelUrl,'utf8');
  assert.match(source,/Bottle-first/);
  assert.match(source,/Gels-first/);
  assert.match(source,/Bike bottles \+ run gels/);
  assert.match(source,/Hydration \+ recovery/);
  assert.match(source,/Auto adapts to sport, session type and duration and caps at 90 g\/h/);
  assert.match(source,/120 g\/h remains an advanced manual target/);
  assert.match(source,/\['auto',50,60,90,120\]/);
});

test('training fuel quantities include Hydrate without ordering servings as packs',async()=>{
  const source=await readFile(fuelUrl,'utf8');
  assert.match(source,/hydrate:a\.hydrate\+n\(s\.hydrate_servings\)/);
  assert.match(source,/hydrate:hydratePacks\(n\(session\.hydrate_servings\)\)/);
  assert.match(source,/hydrate:hydratePacks\(totals\.hydrate\)/);
  assert.match(source,/mg sodium\/h/);
});
