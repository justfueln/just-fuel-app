import test from 'node:test';
import assert from 'node:assert/strict';
import {basketTtlMs,lastBasketTtlMs,normalizeMainSection,normalizeTrainingTab,readSavedItems,resolveInitialMainSection} from '../src/app-state-utils.js';

test('normalizes main navigation safely',()=>{
  assert.equal(normalizeMainSection('Training'),'training');
  assert.equal(normalizeMainSection('Unknown'),'home');
});

test('normalizes Training tabs safely',()=>{
  assert.equal(normalizeTrainingTab('Fuel'),'Fuel');
  assert.equal(normalizeTrainingTab('Unknown'),'My Plan');
});

test('Strava callback opens Training instead of Home',()=>{
  assert.equal(resolveInitialMainSection({historyState:null,search:'?strava=connected'}),'training');
  assert.equal(resolveInitialMainSection({historyState:{jfSection:'home'},search:'?strava=error&detail=cancelled'}),'training');
  assert.equal(resolveInitialMainSection({historyState:{jfSection:'home'},pathname:'/strava-return',search:'?strava=connected'}),'training');
});

test('dedicated Strava return route opens Training even without query parameters',()=>{
  assert.equal(resolveInitialMainSection({historyState:null,pathname:'/strava-return',search:''}),'training');
});

test('normal reload keeps the current main section when available',()=>{
  assert.equal(resolveInitialMainSection({historyState:{jfSection:'Shop'},pathname:'/',search:''}),'shop');
  assert.equal(resolveInitialMainSection({historyState:null,pathname:'/',search:''}),'home');
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
