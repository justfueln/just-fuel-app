import test from 'node:test';
import assert from 'node:assert/strict';
import { wholeUnits, restockShortfalls, hydratePacks, restockBasketUnits } from '../src/fuel-utils.js';

test('wholeUnits keeps only positive whole quantities', () => {
  assert.equal(wholeUnits(0), 0);
  assert.equal(wholeUnits(-3), 0);
  assert.equal(wholeUnits('2'), 2);
  assert.equal(wholeUnits(2.2), 3);
  assert.equal(wholeUnits('bad'), 0);
});

test('restockShortfalls combines duplicate product rows safely', () => {
  const result = restockShortfalls([
    { product_key: 'bottle_mix', shortfall_units: 2 },
    { product_key: 'bottle_mix', shortfall_units: 1.2 },
    { product_key: 'energy_gel', shortfall_units: 4 },
    { product_key: 'recover', shortfall_units: 0 },
  ]);
  assert.deepEqual(result, { bottle_mix: 4, energy_gel: 4 });
});

test('hydratePacks converts hydrate servings to 10-pack products', () => {
  assert.equal(hydratePacks(0), 0);
  assert.equal(hydratePacks(1), 1);
  assert.equal(hydratePacks(10), 1);
  assert.equal(hydratePacks(11), 2);
  assert.equal(hydratePacks(20), 2);
});

test('restockBasketUnits counts actual basket products', () => {
  assert.equal(restockBasketUnits({ bottle_mix: 3, energy_gel: 5, boost_gel: 2, hydrate: 11, recover: 1 }), 13);
});
