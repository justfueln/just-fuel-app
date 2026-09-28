import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const registryUrl=new URL('../src/navigation-registry.js',import.meta.url);
const shellUrl=new URL('../src/ShellNextV3.jsx',import.meta.url);
const fuelUrl=new URL('../src/FuelHubV2.jsx',import.meta.url);
const raceUrl=new URL('../src/RaceHubV2.jsx',import.meta.url);

test('bottom navigation remains Home, Training, Race, Fuel, Shop',async()=>{
  const source=await readFile(registryUrl,'utf8');
  assert.match(source,/BOTTOM_NAV=\['home','training','race','fuel','shop'\]/);
});

test('Training exposes two direct choices plus one More control',async()=>{
  const registry=await import(`${registryUrl.href}?phase1=${Date.now()}`);
  assert.equal(registry.TRAINING_NAV.filter(x=>x.group==='primary').length,2);
  assert.equal(registry.TRAINING_NAV.filter(x=>x.group==='more').length,2);
  const shell=await readFile(shellUrl,'utf8');
  assert.match(shell,/training-more-wrap/);
  assert.match(shell,/aria-haspopup="menu"/);
  assert.match(shell,/>More<\/button>/);
});

test('Fuel exposes Quick Planner and Training Fuel directly, with secondary tools behind More',async()=>{
  const registry=await import(`${registryUrl.href}?fuel=${Date.now()}`);
  assert.deepEqual(registry.FUEL_NAV.filter(x=>x.group==='primary').map(x=>x.id),['planner','training']);
  assert.deepEqual(registry.FUEL_NAV.filter(x=>x.group==='more').map(x=>x.id),['review','stock','order']);
  const fuel=await readFile(fuelUrl,'utf8');
  assert.match(fuel,/More tools/);
  assert.match(fuel,/fuel-v2-more-panel/);
});

test('Race keeps its secondary race sections inside a single Race menu control',async()=>{
  const race=await readFile(raceUrl,'utf8');
  assert.match(race,/className="race-v2-menu"/);
  assert.match(race,/<select value=\{value\}/);
});
