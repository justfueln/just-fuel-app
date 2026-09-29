import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const sql=readFileSync(join(here,'../scripts/hotfix-fast-today-dashboard.sql'),'utf8');

test('Home dashboard hotfix avoids the heavyweight full-session fuel view',()=>{
  assert.match(sql,/create or replace function public\.get_today_dashboard/);
  assert.doesNotMatch(sql,/training_session_fuel_plan_multisport/);
  assert.match(sql,/training_rolling_summary/);
  assert.match(sql,/training_sport_family/);
  assert.match(sql,/'fuel_ready',true/);
});
