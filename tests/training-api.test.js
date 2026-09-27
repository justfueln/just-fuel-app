import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchTrainingPlan } from '../src/training-api.js';

function query(result){
  const chain={
    select(){return chain},eq(){return chain},order(){return chain},limit(){return chain},
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
