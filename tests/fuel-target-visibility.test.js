import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(join(here,'../src/FuelHubV2.jsx'),'utf8');
const css=readFileSync(join(here,'../src/fuel-target-visibility.css'),'utf8');

test('Fuel home makes carbs hydration and sodium immediately visible',()=>{
  assert.match(source,/YOUR FUEL TARGET/);
  assert.match(source,/g carbs \/ hour/);
  assert.match(source,/ml fluid \/ hour/);
  assert.match(source,/mg sodium \/ hour/);
  assert.match(source,/nextSession\.carb_target_gph/);
  assert.match(source,/nextSession\.hydration_ml_per_hour/);
  assert.match(source,/nextSession\.sodium_target_mg_per_hour/);
});

test('Fuel target card connects the next 7 days to shortage ordering',()=>{
  assert.match(source,/Next 7 days/);
  assert.match(source,/Bottle Mix/);
  assert.match(source,/Hydrate servings/);
  assert.match(source,/You need to order/);
  assert.match(source,/Order my shortage/);
  assert.match(source,/go\('order'\)/);
});

test('Fuel target styling is mobile-first and stays scoped to Fuel',()=>{
  assert.match(source,/import '\.\/fuel-target-visibility\.css'/);
  assert.match(css,/\.fuel-v4-target-card/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:390px\)/);
});
