import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fetchTrainingHistory,sendTrainingOtp} from '../src/training-api.js';

const mainUrl=new URL('../src/main.jsx',import.meta.url);

test('current shell persists auth and does not block first paint on PWA cleanup',async()=>{
  const source=await readFile(mainUrl,'utf8');
  assert.match(source,/persistSession:\s*true/);
  assert.match(source,/autoRefreshToken:\s*true/);
  assert.match(source,/detectSessionInUrl:\s*true/);
  const render=source.indexOf('renderApp();');
  const globalEnhancements=source.indexOf('loadGlobalEnhancements();',render);
  const updateWatcher=source.indexOf('installAppUpdateWatcher();',globalEnhancements);
  const pwaCleanup=source.indexOf('handOffLegacyWorker().catch',updateWatcher);
  assert.ok(render>=0&&globalEnhancements>render&&updateWatcher>globalEnhancements&&pwaCleanup>updateWatcher);
  assert.match(source,/PWA_CLEAN_KEY/);
  assert.match(source,/if\(!registrations\.length&&!hasController\)\{[\s\S]*?return false;/);
  const cleanBranch=source.match(/if\(!registrations\.length&&!hasController\)\{([\s\S]*?)return false;/)?.[1]||'';
  assert.doesNotMatch(cleanBranch,/deleteLegacyCaches/);
});

test('training history has a client-side duplicate safety net',async()=>{
  const rows=[
    {id:'a',strava_activity_id:123,start_date_local:'2026-09-28T06:00:00',estimated_training_load:50},
    {id:'b',strava_activity_id:123,start_date_local:'2026-09-28T06:00:00',estimated_training_load:50},
    {id:'c',strava_activity_id:456,start_date_local:'2026-09-27T06:00:00',estimated_training_load:40}
  ];
  const chain={
    select(){return this},
    eq(){return this},
    order(){return this},
    limit(){return Promise.resolve({data:rows,error:null})}
  };
  const client={from(name){assert.equal(name,'training_activity_metrics');return chain}};
  const result=await fetchTrainingHistory(client,'user-1');
  assert.equal(result.error,null);
  assert.equal(result.history.length,2);
  assert.deepEqual(result.history.map(x=>x.strava_activity_id),[123,456]);
});

test('OTP resend is locally throttled before Supabase rate limit is hit',async()=>{
  const originalWindow=globalThis.window;
  const originalStorage=globalThis.localStorage;
  const store=new Map();
  globalThis.window={};
  globalThis.localStorage={
    getItem:key=>store.get(key)??null,
    setItem:(key,value)=>store.set(key,String(value))
  };
  store.set('jf-training-otp-last-send',String(Date.now()));
  let calls=0;
  const client={auth:{async signInWithOtp(){calls+=1;return{data:{},error:null}}}};
  try{
    const result=await sendTrainingOtp(client,'athlete@example.com');
    assert.equal(calls,0);
    assert.match(result.error.message,/Please wait \d+ seconds/);
  }finally{
    if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
    if(originalStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=originalStorage;
  }
});
