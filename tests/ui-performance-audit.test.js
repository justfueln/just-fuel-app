import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(join(here,'..',path),'utf8');

test('startup HTML does not do service-worker retirement before React boots',()=>{
  const html=read('index.html');
  assert.doesNotMatch(html,/serviceWorker\.getRegistrations\(\)/);
  assert.doesNotMatch(html,/serviceWorker\.register\('/);
  assert.match(html,/theme-color" content="#080808"/);
});

test('heavy route styles are lazy and stay out of main startup imports',()=>{
  const main=read('src/main.jsx');
  for(const css of ['fuel-hub-v2.css','profile-hub-v1.css','checkout-v6.css','race-hub-v2.css','training-coach-v1.css']){
    assert.doesNotMatch(main,new RegExp(css.replaceAll('.','\\.')));
  }
  const shell=read('src/ShellNextV3.jsx');
  assert.match(shell,/training-route-styles/);
  assert.match(shell,/race-route-styles/);
  assert.match(shell,/fuel-route-styles/);
  assert.match(shell,/profile-route-styles/);
  assert.match(shell,/checkout-route-styles/);
});

test('smart alerts are deferred away from first interaction and route chunks prefetch on intent',()=>{
  const shell=read('src/ShellNextV3.jsx');
  assert.match(shell,/setAlertsReady\(true\),4000/);
  assert.match(shell,/onTouchStart=\{\(\)=>prefetchRoute\(id\)\}/);
  assert.match(shell,/connection\?\.saveData/);
});

test('app update polling cannot fire from focus events during the first eight seconds',()=>{
  const updates=read('src/app-update.js');
  assert.match(updates,/let armed=false/);
  assert.match(updates,/const check=\(\)=>armed\?/);
  assert.match(updates,/armed=true;[\s\S]*checkForAppUpdate\(\{force:true\}\)/);
  assert.match(updates,/},8000\)/);
});
