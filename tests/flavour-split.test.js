import test from 'node:test';
import assert from 'node:assert/strict';
import {fitFlavorSplit,moveFlavorUnit,evenFlavorSplit,flavorBasketLines} from '../src/flavour-split.js';

const variants=[{id:'a',title:'A'},{id:'b',title:'B'},{id:'c',title:'C'}];

test('fitFlavorSplit assigns the full target and preserves valid quantities',()=>{
  assert.deepEqual(fitFlavorSplit({a:2,b:1},variants,5),{a:4,b:1,c:0});
  assert.deepEqual(fitFlavorSplit({a:5,b:5},variants,6),{a:5,b:1,c:0});
});

test('moveFlavorUnit transfers one unit between flavours without changing the total',()=>{
  const moved=moveFlavorUnit({a:5,b:0,c:0},variants,5,'b',1);
  assert.deepEqual(moved,{a:4,b:1,c:0});
  assert.equal(Object.values(moved).reduce((a,b)=>a+b,0),5);
});

test('evenFlavorSplit spreads quantities across available flavours',()=>{
  assert.deepEqual(evenFlavorSplit(variants,5),{a:2,b:2,c:1});
});

test('flavorBasketLines only emits variants with quantity',()=>{
  const product={key:'demo'};
  const lines=flavorBasketLines(product,variants,{a:2,b:0,c:1});
  assert.deepEqual(lines.map(x=>[x.variant.id,x.quantity]),[['a',2],['c',1]]);
});
