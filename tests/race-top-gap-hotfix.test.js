import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const cssUrl=new URL('../src/training-header-clearance-hotfix.css',import.meta.url);

async function source(url){return readFile(url,'utf8')}

test('Training header clearance does not add top padding to the Race app',async()=>{
  const css=await source(cssUrl);
  assert.match(css,/\.app-shell:not\(\.race-app-shell\) main\{padding-top:104px!important\}/);
  assert.match(css,/@media\(max-width:560px\)\{\.phase2-training-shell \.app-shell:not\(\.race-app-shell\) main\{padding-top:112px!important\}\}/);
  assert.doesNotMatch(css,/\.phase2-training-shell \.app-shell main\{padding-top:/);
});
