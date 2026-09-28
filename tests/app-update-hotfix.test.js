import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {entryAssetFromHtml,normalizeEntryAsset,buildChanged} from '../src/app-update.js';

const mainUrl=new URL('../src/main.jsx',import.meta.url);
const shellUrl=new URL('../src/ShellNextV3.jsx',import.meta.url);
const routeEnhancementsUrl=new URL('../src/route-enhancements.js',import.meta.url);

test('production entry asset detection finds the Vite module bundle',()=>{
  assert.equal(entryAssetFromHtml('<script type="module" crossorigin src="/assets/index-ABC123.js"></script>'),'/assets/index-ABC123.js');
  assert.equal(entryAssetFromHtml("<script src='/assets/index-XYZ.js' type='module'></script>"),'/assets/index-XYZ.js');
  assert.equal(normalizeEntryAsset('/assets/index-ABC123.js?x=1'),'/assets/index-ABC123.js');
  assert.equal(buildChanged('/assets/index-old.js','/assets/index-new.js'),true);
  assert.equal(buildChanged('/assets/index-same.js','/assets/index-same.js?cache=1'),false);
});

test('startup no longer downloads Training and Race observer modules globally',async()=>{
  const main=await readFile(mainUrl,'utf8');
  assert.match(main,/installAppUpdateWatcher\(\)/);
  assert.match(main,/loadGlobalEnhancements\(\)/);
  assert.doesNotMatch(main,/import\('\.\/training-coach-v1'\)/);
  assert.doesNotMatch(main,/import\('\.\/race-goal-progress-v1'\)/);
});

test('heavy enhancement modules are scoped to the active section',async()=>{
  const shell=await readFile(shellUrl,'utf8');
  const loader=await readFile(routeEnhancementsUrl,'utf8');
  assert.match(shell,/loadEnhancementsForSection\(section\)/);
  assert.match(loader,/section==='training'/);
  assert.match(loader,/section==='race'/);
  assert.match(loader,/import\('\.\/training-coach-v1'\)/);
  assert.match(loader,/import\('\.\/race-addon-stability'\)/);
  assert.match(loader,/import\('\.\/app-analytics'\)/);
});
