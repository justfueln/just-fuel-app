import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {PHASE8_HORIZON_DAYS,phase8ForecastRows,phase8Headline,phase8OrderQuantities,phase8OrderUnits,phase8Shortfalls} from '../src/fuel-to-shop-utils.js';

const here=dirname(fileURLToPath(import.meta.url));

test('Roadmap V2 Phase 8 is fixed to the first 7-day shortage build',()=>{
  assert.equal(PHASE8_HORIZON_DAYS,7);
  const rows=phase8ForecastRows([
    {horizon_days:7,product_key:'bottle_mix',shortfall_units:4},
    {horizon_days:14,product_key:'bottle_mix',shortfall_units:99},
    {horizon_days:30,product_key:'energy_gel',shortfall_units:99}
  ]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].shortfall_units,4);
});

test('Phase 8 converts the 7-day forecast into exact order quantities',()=>{
  const forecast=[
    {horizon_days:7,product_key:'bottle_mix',shortfall_units:3.2},
    {horizon_days:7,product_key:'energy_gel',shortfall_units:5.1},
    {horizon_days:7,product_key:'boost_gel',shortfall_units:1},
    {horizon_days:7,product_key:'hydrate',shortfall_units:11},
    {horizon_days:7,product_key:'recover',shortfall_units:2}
  ];
  const shortfalls=phase8Shortfalls(forecast);
  assert.deepEqual(phase8OrderQuantities(shortfalls),{
    bottleMix:4,
    regularGels:6,
    boostGels:1,
    hydratePacks:2,
    recover:2
  });
  assert.equal(phase8OrderUnits(shortfalls),15);
  assert.equal(phase8Headline(shortfalls),'You need 4 Bottle Mix + 7 gels for the next 7 days.');
});

test('Phase 8 reports covered stock cleanly',()=>{
  assert.equal(phase8OrderUnits({}),0);
  assert.equal(phase8Headline({}),'You have enough fuel for the next 7 days.');
});

test('Phase 8 UI keeps flavour choice and existing basket checkout integration',()=>{
  const source=readFileSync(join(here,'../src/FuelToShopPhase8.jsx'),'utf8');
  assert.match(source,/fitFlavorSplit/);
  assert.match(source,/flavorBasketLines/);
  assert.match(source,/Choose the flavour mix now/);
  assert.match(source,/addLine\(line\.product,line\.variant,line\.quantity\)/);
  assert.match(source,/openBasket\(\)/);
  assert.doesNotMatch(source,/14,30/);
});
