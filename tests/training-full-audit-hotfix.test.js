import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(join(here,'..',path),'utf8');

test('Training switches Today Plan Progress without remounting the whole app',()=>{
  const shell=read('src/ShellNextV3.jsx');
  assert.match(shell,/section==='training'&&<TrainingApp\/>/);
  assert.doesNotMatch(shell,/TrainingApp\s+key=/);
  assert.match(shell,/new PopStateEvent\('popstate'/);
});

test('Training enhancements are scoped to the view the athlete actually opened',()=>{
  const routes=read('src/route-enhancements.js');
  assert.match(routes,/trainingView==='plan'/);
  assert.match(routes,/trainingView==='progress'/);
  const today=routes.slice(routes.indexOf('function loadTrainingToday'),routes.indexOf('function loadTrainingPlan'));
  assert.doesNotMatch(today,/training-power-curve-v1|training-achievements-v1|training-progression-v1|training-readiness-v1/);
});

test('hidden smart alerts do not run background dashboard and fuel requests in Training',()=>{
  const shell=read('src/ShellNextV3.jsx');
  assert.match(shell,/const SmartAlerts=lazy\(\(\)=>import\('\.\/SmartAlerts'\)\)/);
  assert.match(shell,/alertsReady&&!reminderDue&&!profileOpen&&!basketOpen&&!isTrainingArea/);
});

test('completed-training helpers stay off the heavyweight fuel calendar',()=>{
  for(const path of ['src/training-achievements-v1.js','src/training-readiness-v1.js','src/training-progression-v1.js','src/TrainingPlanCompare.jsx']){
    const source=read(path);
    assert.doesNotMatch(source,/training_plan_calendar_with_fuel/,`${path} should not read the fuel-heavy calendar`);
    assert.match(source,/training_plan_calendar/,`${path} should use the lightweight calendar`);
  }
});

test('opening Progress is read-only and does not rebuild server intelligence',()=>{
  assert.doesNotMatch(read('src/training-achievements-v1.js'),/refresh_training_achievements/);
  assert.doesNotMatch(read('src/TrainingPlanCompare.jsx'),/refresh_training_session_matches/);
});

test('training history is bounded and Strava sync does not duplicate backend refreshes by default',()=>{
  const api=read('src/training-api.js');
  const history=api.slice(api.indexOf('export async function fetchTrainingHistory'),api.indexOf('export async function sendTrainingOtp'));
  assert.match(history,/\.limit\(250\)/);
  assert.doesNotMatch(history,/for\(let from=0/);
  const sync=api.slice(api.indexOf('export async function syncTrainingStrava'),api.indexOf('export async function startTrainingStrava'));
  assert.match(sync,/client_refresh_required===true/);
});

test('current-plan selection is date aware in both client and production SQL',()=>{
  const api=read('src/training-api.js');
  assert.match(api,/chooseCurrentPlan/);
  assert.match(api,/start_date/);
  assert.match(api,/race_date/);
  const sql=read('scripts/training-current-plan-audit.sql');
  assert.match(sql,/p\.start_date<=p_today and p\.race_date>=p_today/);
  assert.match(sql,/p\.start_date>p_today/);
  assert.match(sql,/p\.start_date<=current_date and p\.race_date>=current_date/);
});
