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

test('Training enhancement bundles are deferred away from first interaction',()=>{
  const routes=read('src/route-enhancements.js');
  assert.match(routes,/5200/);
  assert.match(routes,/training-workout-details/);
  assert.match(routes,/requestIdleCallback/);
});
