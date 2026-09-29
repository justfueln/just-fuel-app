import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(join(here,'..',path),'utf8');

test('Training content clears the Today Plan Progress overlay on phones without affecting Race',()=>{
  const css=read('src/training-header-clearance-hotfix.css');
  const main=read('src/main.jsx');
  assert.match(css,/\.phase2-training-shell \.app-shell:not\(\.race-app-shell\) main\{padding-top:104px!important\}/);
  assert.match(css,/@media\(max-width:560px\)\{\.phase2-training-shell \.app-shell:not\(\.race-app-shell\) main\{padding-top:112px!important\}\}/);
  assert.doesNotMatch(css,/\.phase2-training-shell \.app-shell main\{padding-top:/);
  assert.ok(main.indexOf("./training-header-clearance-hotfix.css")>main.indexOf("./mobile-ux-audit-v1.css"));
});
