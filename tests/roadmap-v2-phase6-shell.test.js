import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const mainUrl=new URL('../src/main.jsx',import.meta.url);
const gateUrl=new URL('../src/AthleteOnboardingGate.jsx',import.meta.url);

test('onboarding is lazy and deferred so first paint stays fast',async()=>{
  const source=await readFile(mainUrl,'utf8');
  assert.match(source,/React\.lazy\(\(\)=>import\('\.\/AthleteOnboardingGate'\)\)/);
  assert.match(source,/requestIdleCallback/);
  assert.match(source,/<ShellNextV3\s*\/>[\s\S]*<DeferredOnboarding\s*\/>/);
});

test('phase 6 keeps advanced athlete metrics optional',async()=>{
  const source=await readFile(gateUrl,'utf8');
  assert.match(source,/FTP, threshold pace, heart rate and weight are optional/);
  assert.doesNotMatch(source,/if\(!draft\.ftp/);
  assert.doesNotMatch(source,/if\(!draft\.weight/);
  assert.match(source,/Race setup is optional/);
});
