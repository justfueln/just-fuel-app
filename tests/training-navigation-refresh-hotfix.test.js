import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const shellUrl=new URL('../src/ShellNextV3.jsx',import.meta.url);
const appUrl=new URL('../src/AppV3.jsx',import.meta.url);

test('Training shell dispatches the history state AppV3 listens for so tabs load without refresh',async()=>{
  const [shell,app]=await Promise.all([readFile(shellUrl,'utf8'),readFile(appUrl,'utf8')]);
  assert.match(app,/jfSection==='Training'/);
  assert.match(shell,/function historySection\(value\).*return next==='training'\?'Training':next/);
  assert.match(shell,/jfSection:historySection\('training'\)/);
  assert.match(shell,/new PopStateEvent\('popstate'/);
});

test('Training route state stays compatible during shell navigation, profile and basket transitions',async()=>{
  const shell=await readFile(shellUrl,'utf8');
  assert.match(shell,/jfSection:historySection\(next\)/);
  assert.match(shell,/jfSection:historySection\(section\),jfProfile:true/);
  assert.match(shell,/jfSection:historySection\(section\),jfTrainingView:trainingView/);
  assert.match(shell,/replaceState\(\{\.\.\.window\.history\.state,jfSection:historySection\(section\)/);
});
