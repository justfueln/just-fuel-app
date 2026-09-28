import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const registryUrl=new URL('../src/navigation-registry.js',import.meta.url);
const shellUrl=new URL('../src/ShellNextV3.jsx',import.meta.url);
const fuelUrl=new URL('../src/FuelHubV2.jsx',import.meta.url);
const racePhase4Url=new URL('../src/race-roadmap-phase4.js',import.meta.url);

test('bottom navigation remains Home, Training, Race, Fuel, Shop',async()=>{
  const source=await readFile(registryUrl,'utf8');
  assert.match(source,/BOTTOM_NAV=\['home','training','race','fuel','shop'\]/);
});

test('Training keeps a small direct navigation surface',async()=>{
  const registry=await import(`${registryUrl.href}?phase1=${Date.now()}`);
  assert.deepEqual(registry.TRAINING_NAV.filter(x=>x.group==='primary').map(x=>x.id),['today','plan','progress']);
  assert.equal(registry.TRAINING_NAV.filter(x=>x.group==='more').length,0);
  const shell=await readFile(shellUrl,'utf8');
  assert.match(shell,/aria-label="Training pages"/);
  assert.doesNotMatch(shell,/training-more-menu/);
  assert.doesNotMatch(shell,/>More<\/button>/);
});

test('Fuel exposes Quick Planner and Training Fuel directly, with secondary tools behind More',async()=>{
  const registry=await import(`${registryUrl.href}?fuel=${Date.now()}`);
  assert.deepEqual(registry.FUEL_NAV.filter(x=>x.group==='primary').map(x=>x.id),['planner','training']);
  assert.deepEqual(registry.FUEL_NAV.filter(x=>x.group==='more').map(x=>x.id),['review','stock','order']);
  const fuel=await readFile(fuelUrl,'utf8');
  assert.match(fuel,/More tools/);
  assert.match(fuel,/fuel-v2-more-panel/);
});

test('Race exposes only Race Plan, Fuel and Checklist as primary race actions',async()=>{
  const registry=await import(`${registryUrl.href}?race=${Date.now()}`);
  assert.deepEqual(registry.RACE_NAV.filter(x=>x.group==='primary').map(x=>x.id),['plan','fuel','checklist']);
  assert.deepEqual(registry.RACE_NAV.filter(x=>x.group==='plan').map(x=>x.id),['stages','water']);
  const race=await readFile(racePhase4Url,'utf8');
  assert.match(race,/aria-label','Race sections'/);
  assert.match(race,/\['plan','Race Plan'\],\['fuel','Fuel'\],\['checklist','Checklist'\]/);
});
