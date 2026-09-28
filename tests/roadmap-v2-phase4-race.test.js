import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const raceUrl=new URL('../src/race-roadmap-phase4.js',import.meta.url);
const cssUrl=new URL('../src/race-roadmap-phase4.css',import.meta.url);
const guardUrl=new URL('../src/race-addon-stability.js',import.meta.url);
const hubUrl=new URL('../src/RaceHubV2.jsx',import.meta.url);

test('Race Phase 4 opens around a dashboard and three primary actions',async()=>{
  const source=await readFile(raceUrl,'utf8');
  assert.match(source,/RACE DASHBOARD/);
  assert.match(source,/\['plan','Race Plan'\],\['fuel','Fuel'\],\['checklist','Checklist'\]/);
  assert.match(source,/Race dashboard/);
  assert.match(source,/primaryGroup/);
});

test('Race dashboard uses existing preparation and readiness intelligence',async()=>{
  const source=await readFile(raceUrl,'utf8');
  assert.match(source,/get_race_goal_progress/);
  assert.match(source,/get_training_readiness_insights/);
  assert.match(source,/Preparation/);
  assert.match(source,/Readiness/);
  assert.match(source,/NEXT ACTION/);
  assert.match(source,/PACING/);
  assert.match(source,/RACE CONDITIONS/);
  assert.match(source,/Conditions are saved race-plan guidance unless a live forecast is explicitly shown/);
});

test('Race Plan owns stages and water points instead of exposing them as primary pages',async()=>{
  const source=await readFile(raceUrl,'utf8');
  assert.match(source,/planLegacyValue/);
  assert.match(source,/\['stages','Stages'\],\['water','Water Points'\]/);
  assert.match(source,/Course execution, pacing, stages and water points live together here/);
  const legacy=await readFile(hubUrl,'utf8');
  assert.match(legacy,/function RaceStages/);
  assert.match(legacy,/function RaceStageDetail/);
  assert.match(legacy,/function RaceWaterPoints/);
});

test('Phase 4 preserves race fuel and checklist engines',async()=>{
  const legacy=await readFile(hubUrl,'utf8');
  assert.match(legacy,/function RaceFuelHydration/);
  assert.match(legacy,/RACE CARB TARGET/);
  assert.match(legacy,/function RaceChecklist/);
  assert.match(legacy,/jf-race-checklist-v2-/);
});

test('Phase 4 is mobile-first and hides legacy duplicate race surfaces',async()=>{
  const css=await readFile(cssUrl,'utf8');
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.race-v2-shell \.race-v2-menu/);
  assert.match(css,/\.race-v2-list>\.jf-race-week\{display:none!important\}/);
  assert.match(css,/@media\(max-width:520px\)/);
  const guard=await readFile(guardUrl,'utf8');
  assert.match(guard,/import\('\.\/race-roadmap-phase4'\)/);
});
