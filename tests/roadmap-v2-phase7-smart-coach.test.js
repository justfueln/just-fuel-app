import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const coachUrl=new URL('../src/smart-coach-v2.js',import.meta.url);
const cssUrl=new URL('../src/smart-coach-v2.css',import.meta.url);
const loaderUrl=new URL('../src/route-enhancements.js',import.meta.url);

test('Phase 7 presents coaching as recommendation, explanation, then optional detail',async()=>{
  const coach=await readFile(coachUrl,'utf8');
  assert.match(coach,/COACH RECOMMENDATION/);
  assert.match(coach,/Why this recommendation\?/);
  assert.match(coach,/View training data/);
  assert.match(coach,/planned versus completed work, your session feedback and any fuel you logged/);
});

test('important pain or illness guidance remains visible instead of being collapsed',async()=>{
  const coach=await readFile(coachUrl,'utf8');
  assert.match(coach,/pain was reported\|feeling sick/);
  assert.match(coach,/jf-smart-safety-note/);
  assert.match(coach,/copy\.before\(p\)/);
});

test('performance recommendation is moved ahead of raw metrics while detailed data remains available',async()=>{
  const css=await readFile(cssUrl,'utf8');
  assert.match(css,/jf-smart-performance-coach\{order:-20\}/);
  assert.match(css,/performance-head\{order:-10\}/);
});

test('smart coaching remains route-scoped so startup performance hotfix is preserved',async()=>{
  const loader=await readFile(loaderUrl,'utf8');
  assert.match(loader,/if\(section==='home'\)idle\(\(\)=>ensureSmartCoach\(\),\d+/);
  assert.match(loader,/section==='training'/);
  assert.match(loader,/ensureSmartCoach\(\)/);
  const globalBody=loader.slice(loader.indexOf('export function loadGlobalEnhancements'),loader.indexOf('function loadTrainingToday'));
  assert.doesNotMatch(globalBody,/smart-coach-v2|ensureSmartCoach/);
});
