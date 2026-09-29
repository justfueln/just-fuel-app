import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(join(here,'..',path),'utf8');

test('mobile Training shell avoids expensive relational selectors and backdrop blur',()=>{
  const css=read('src/training-native-v11.css');
  assert.doesNotMatch(css,/:has\(/);
  assert.doesNotMatch(css,/backdrop-filter/);
});

test('shared mobile UI removes card shadows and nav transitions',()=>{
  const css=read('src/ui-foundation-v11.css');
  assert.match(css,/--jf-shadow-card:none/);
  assert.match(css,/transition:none/);
});

test('global UX layer is event driven rather than observing every DOM mutation',()=>{
  const ux=read('src/final-ux-v10.js');
  assert.doesNotMatch(ux,/MutationObserver/);
  assert.match(ux,/jf-training-plan-updated/);
  assert.match(ux,/requestAnimationFrame/);
});

test('Training enhancement bundles are deferred away from first interaction and scoped by view',()=>{
  const routes=read('src/route-enhancements.js');
  assert.match(routes,/requestIdleCallback/);
  assert.match(routes,/function loadTrainingToday/);
  assert.match(routes,/function loadTrainingPlan/);
  assert.match(routes,/function loadTrainingProgress/);
  assert.match(routes,/training-workout-details/);
  const today=routes.slice(routes.indexOf('function loadTrainingToday'),routes.indexOf('function loadTrainingPlan'));
  assert.doesNotMatch(today,/training-power-curve-v1|training-achievements-v1|training-progression-v1|training-readiness-v1/);
});
