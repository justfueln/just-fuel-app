import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const fuelUrl=new URL('../src/FuelHubV2.jsx',import.meta.url);
const cssUrl=new URL('../src/fuel-hub-v2.css',import.meta.url);
const registryUrl=new URL('../src/navigation-registry.js',import.meta.url);

test('Fuel home is needs-first instead of a feature menu',async()=>{
  const source=await readFile(fuelUrl,'utf8');
  assert.match(source,/What do I need\?/);
  assert.match(source,/UPCOMING TRAINING/);
  assert.match(source,/NEXT RACE/);
  assert.match(source,/STOCK CHECK/);
  assert.match(source,/aria-label="Fuel actions"/);
  assert.doesNotMatch(source,/More tools/);
});

test('Fuel home loads the next race requirement without replacing race-specific planning',async()=>{
  const source=await readFile(fuelUrl,'utf8');
  assert.match(source,/athlete_season_events/);
  assert.match(source,/race_fuel_plan/);
  assert.match(source,/carb_target_gph/);
  assert.match(source,/bottle_mix_sachets/);
  assert.match(source,/Edit race-specific targets under Race → Fuel/);
});

test('Fuel home makes stock and shortage understandable before ordering',async()=>{
  const source=await readFile(fuelUrl,'utf8');
  assert.match(source,/on hand/);
  assert.match(source,/needed/);
  assert.match(source,/See exact order shortage/);
  assert.match(source,/restockShortfalls/);
  assert.match(source,/Update Stock/);
});

test('Fuel retains detailed planner, review and order routes as contextual tools',async()=>{
  const registry=await import(`${registryUrl.href}?phase5=${Date.now()}`);
  assert.deepEqual(registry.FUEL_NAV.filter(x=>x.group==='primary').map(x=>x.id),['training','stock']);
  assert.deepEqual(registry.FUEL_NAV.filter(x=>x.group==='utility').map(x=>x.id),['planner','review']);
  assert.deepEqual(registry.FUEL_NAV.filter(x=>x.group==='contextual').map(x=>x.id),['order']);
});

test('Fuel Phase 5 remains mobile-first',async()=>{
  const css=await readFile(cssUrl,'utf8');
  assert.match(css,/\.fuel-v3-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:560px\)/);
  assert.match(css,/\.fuel-v3-actions\{grid-template-columns:1fr\}/);
});
