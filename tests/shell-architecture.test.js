import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const shellUrl=new URL('../src/ShellNextV3.jsx',import.meta.url);

test('heavy app areas stay route-level lazy loaded',async()=>{
  const source=await readFile(shellUrl,'utf8');
  const lazyModules=['./App','./CheckoutDrawer','./FuelHubV2','./ProfileHub'];
  for(const moduleName of lazyModules){
    assert.match(source,new RegExp(`lazy\\(\\(\\)=>import\\(['\"]${moduleName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}['\"]\\)\\)`),`${moduleName} should remain lazy loaded`);
  }
  assert.doesNotMatch(source,/import\s+TrainingApp\s+from\s+['"]\.\/App['"]/);
  assert.doesNotMatch(source,/import\s+CheckoutDrawer\s+from\s+['"]\.\/CheckoutDrawer['"]/);
});

test('checkout chunk is not mounted until the basket opens',async()=>{
  const source=await readFile(shellUrl,'utf8');
  assert.match(source,/\{basketOpen&&<Suspense[^>]*>\s*<CheckoutDrawer\s+open/);
});
