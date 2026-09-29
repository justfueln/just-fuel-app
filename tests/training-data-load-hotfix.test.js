import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const apiUrl=new URL('../src/training-api.js',import.meta.url);

test('Training overview uses the fast bounded core RPC instead of heavyweight summary views',async()=>{
  const api=await readFile(apiUrl,'utf8');
  const core=api.slice(api.indexOf('export async function fetchTrainingCore'),api.indexOf('export async function fetchTodayDashboard'));
  assert.match(core,/get_training_core_fast/);
  assert.match(core,/safePostgrest/);
  assert.match(core,/1800/);
  assert.doesNotMatch(core,/training_home_summary/);
  assert.doesNotMatch(core,/training_setup_status/);
});

test('Training plan resolves the active plan first and avoids the heavyweight fuel calendar',async()=>{
  const api=await readFile(apiUrl,'utf8');
  const plan=api.slice(api.indexOf('export async function fetchTrainingPlan'),api.indexOf('export async function fetchFuelTrainingPlan'));
  assert.match(plan,/training_plans/);
  assert.match(plan,/training_plan_calendar/);
  assert.match(plan,/\.eq\('plan_id',activePlanId\)/);
  assert.doesNotMatch(plan,/training_plan_calendar_with_fuel/);
  assert.match(plan,/1800/);
});

test('Training data requests are time bounded instead of leaving the UI hanging',async()=>{
  const api=await readFile(apiUrl,'utf8');
  assert.match(api,/AbortController/);
  assert.match(api,/safePostgrest/);
  assert.match(api,/Request timed out\. Please try again\./);
});
