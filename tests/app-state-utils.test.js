import test from 'node:test';
import assert from 'node:assert/strict';
import {basketTtlMs,lastBasketTtlMs,normalizeMainSection,normalizeTrainingTab,readSavedItems} from '../src/app-state-utils.js';

test('normalizes main navigation safely',()=>{
  assert.equal(normalizeMainSection('Training'),'Training');
  assert.equal(normalizeMainSection('Unknown'),'Plan');
});

test('normalizes Training tabs safely',()=>{
  assert.equal(normalizeTrainingTab('Fuel'),'Fuel');
  assert.equal(normalizeTrainingTab('Unknown'),'Overview');
});

test('keeps active basket for 14 days and expires stale basket',()=>{
  const now=1_000_000_000;
  const item={variantId:'v1',quantity:2};
  const fresh=JSON.stringify({savedAt:now-basketTtlMs+1,items:[item]});
  const stale=JSON.stringify({savedAt:now-basketTtlMs-1,items:[item]});
  assert.equal(readSavedItems(fresh,basketTtlMs,now).length,1);
  assert.equal(readSavedItems(stale,basketTtlMs,now).length,0);
});

test('previous basket snapshot lasts longer than active basket',()=>{
  assert.ok(lastBasketTtlMs>basketTtlMs);
  const now=5_000_000_000;
  const raw=JSON.stringify({savedAt:now-30*24*60*60*1000,items:[{variantId:'v2',quantity:1}]});
  assert.equal(readSavedItems(raw,lastBasketTtlMs,now).length,1);
  assert.equal(readSavedItems(raw,basketTtlMs,now).length,0);
});
