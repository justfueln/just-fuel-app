import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TRAINING_NAV,normalizeTrainingView,trainingTargetForView,trainingViewFromState} from '../src/navigation-registry.js';

const shellUrl=new URL('../src/ShellNextV3.jsx',import.meta.url);
const progressUrl=new URL('../src/TrainingHistory.jsx',import.meta.url);
const cssUrl=new URL('../src/navigation-v2.css',import.meta.url);

async function source(url){return readFile(url,'utf8')}

test('Training exposes only Today, Plan and Progress',()=>{
  assert.deepEqual(TRAINING_NAV.map(x=>x.label),['Today','Plan','Progress']);
  assert.ok(TRAINING_NAV.every(x=>x.group==='primary'));
  assert.equal(trainingTargetForView('today').legacyTab,'Overview');
  assert.equal(trainingTargetForView('plan').legacyTab,'My Plan');
  assert.equal(trainingTargetForView('progress').legacyTab,'History');
});

test('Training opens on Today and old Training links collapse safely into the new flow',()=>{
  assert.equal(trainingViewFromState({jfTrainingTab:'Overview'}),'today');
  assert.equal(trainingViewFromState({jfTrainingTab:'My Plan'}),'plan');
  assert.equal(trainingViewFromState({jfTrainingTab:'History'}),'progress');
  assert.equal(normalizeTrainingView('History'),'progress');
  assert.equal(normalizeTrainingView('Performance'),'progress');
  assert.equal(normalizeTrainingView('Review'),'progress');
});

test('main Training button resets the athlete to Today rather than a specialist screen',async()=>{
  const shell=await source(shellUrl);
  assert.match(shell,/if\(next==='training'\)setTrainingView\('today'\)/);
  assert.match(shell,/jfTrainingView:next==='training'\?'today'/);
  assert.doesNotMatch(shell,/training-more-menu/);
  assert.doesNotMatch(shell,/>More<\/button>/);
});

test('Progress contains performance, activities and plan-vs-actual in one place',async()=>{
  const progress=await source(progressUrl);
  assert.match(progress,/How your training is going/);
  assert.match(progress,/>Performance<\/button>/);
  assert.match(progress,/>Activities<\/button>/);
  assert.match(progress,/>Plan vs actual<\/button>/);
  assert.match(progress,/<TrainingPerformance/);
  assert.match(progress,/<TrainingPlanCompare/);
  assert.match(progress,/COMPLETED ACTIVITIES/);
});

test('Training navigation and Progress controls remain three-column mobile friendly',async()=>{
  const css=await source(cssUrl);
  assert.match(css,/\.training-phase2-nav\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.training-progress-nav\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});
