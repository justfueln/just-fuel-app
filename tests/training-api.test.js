import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchTrainingHistory, fetchTrainingPlan } from '../src/training-api.js';

function query(result){
  const chain={
    select(){return chain},eq(){return chain},order(){return chain},limit(){return chain},range(){return chain},
    maybeSingle(){return Promise.resolve(result)},
    then(resolve,reject){return Promise.resolve(result).then(resolve,reject)}
  };
  return chain;
}

test('training plan service returns only the active plan sessions',async()=>{
  const client={from(table){
    if(table==='training_plan_calendar_with_fuel')return query({data:[{id:1,plan_id:'active'},{id:2,plan_id:'old'}],error:null});
    if(table==='training_plans')return query({data:{id:'active'},error:null});
    throw new Error(`Unexpected table ${table}`);
  }};
  const result=await fetchTrainingPlan(client,'user-1');
  assert.equal(result.error,null);
  assert.deepEqual(result.plan,[{id:1,plan_id:'active'}]);
});

test('training history reads the deduplicated multisport metrics view and maps effective metrics plus JF load',async()=>{
  const tables=[];
  const client={from(table){
    tables.push(table);
    if(table!=='training_activity_metrics')throw new Error(`Unexpected table ${table}`);
    return query({data:[{
      id:'activity-1',
      strava_activity_id:'123',
      effective_average_heartrate:151,
      effective_max_heartrate:181,
      effective_average_cadence:89,
      effective_average_watts:244,
      effective_weighted_average_watts:263,
      effective_kilojoules:1420,
      effective_calories:1360,
      estimated_training_load:82,
      load_source:'heart_rate',
      load_confidence:'medium',
      sport_family:'running'
    }],error:null});
  }};
  const result=await fetchTrainingHistory(client,'user-1');
  assert.equal(result.error,null);
  assert.deepEqual(tables,['training_activity_metrics']);
  assert.equal(result.history.length,1);
  assert.equal(result.history[0].average_watts,244);
  assert.equal(result.history[0].weighted_average_watts,263);
  assert.equal(result.history[0].average_heartrate,151);
  assert.equal(result.history[0].calories,1360);
  assert.equal(result.history[0].raw.suffer_score,82);
  assert.equal(result.history[0].raw.jf_load_source,'heart_rate');
});
