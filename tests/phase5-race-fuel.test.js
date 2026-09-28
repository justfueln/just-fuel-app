import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const engineUrl=new URL('../scripts/phase5-race-fuel.sql',import.meta.url);
const fixUrl=new URL('../scripts/phase5-race-fuel-hydration-fix.sql',import.meta.url);

async function source(url){return readFile(url,'utf8')}

test('Phase 5 keeps 120 g/h explicit while auto stage fuel tops out at 90',async()=>{
  const sql=await source(engineUrl);
  assert.match(sql,/when v_race_carb is not null then greatest\(0,least\(120,v_race_carb\)\)/);
  assert.match(sql,/when v_duration<150 then least\(60,v_max_auto\) else least\(90,v_max_auto\)/);
});

test('Phase 5 triathlon fuel is bike bottle-heavy and timelines start bottles after the swim',async()=>{
  const sql=await source(engineUrl);
  assert.match(sql,/when 'triathlon' then 'tri_split'/);
  assert.match(sql,/coalesce\(p\.swim_duration_minutes,0\)\+\(gs\.n-1\)\*p\.bottle_duration_minutes/);
  assert.match(sql,/T1: begin bike fueling early/);
  assert.match(sql,/T2: switch to the simpler run strategy/);
});

test('Phase 5 stage races aggregate stage quantities instead of one giant continuous race',async()=>{
  const sql=await source(engineUrl);
  assert.match(sql,/from public\.race_stage_plans/);
  assert.match(sql,/when b\.is_multi_day and coalesce\(s\.duration_minutes,0\)>0 then s\.duration_minutes/);
  assert.match(sql,/Use the stage-by-stage fuel plan for this multi-day event/);
});

test('Phase 5 timeline only creates as many Bottle Mix events as calculated sachets',async()=>{
  const sql=await source(engineUrl);
  assert.match(sql,/generate_series\(1,p\.ms_bottle_mix_sachets\)/);
  assert.doesNotMatch(sql,/generate_series\(1, p\.hydration_bottles\)/);
});

test('triathlon hydration display keeps the post-swim hourly target',async()=>{
  const sql=await source(fixUrl);
  assert.match(sql,/race_duration_minutes-coalesce\(swim_duration_minutes,0\)/);
  assert.match(sql,/Hydration target after the swim/);
});
