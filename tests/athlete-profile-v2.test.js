import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ageFromDob,dobIsValid,estimatedMaxHrFromDob} from '../src/athlete-profile-utils.js';

const profileUrl=new URL('../src/ProfileHub.jsx',import.meta.url);

test('DOB utilities calculate adult age and Tanaka max-HR fallback',()=>{
  const today=new Date(2026,8,28);
  assert.equal(ageFromDob('1986-09-28',today),40);
  assert.equal(estimatedMaxHrFromDob('1986-09-28',today),180);
  assert.equal(ageFromDob('1986-09-29',today),39);
});

test('adult age HR fallback is not applied to under-18 athletes',()=>{
  const today=new Date(2026,8,28);
  assert.equal(estimatedMaxHrFromDob('2010-09-28',today),null);
  assert.equal(dobIsValid('2027-01-01',today),false);
  assert.equal(dobIsValid('',today),true);
});

test('Athlete Details exposes the approved profile fields',async()=>{
  const source=await readFile(profileUrl,'utf8');
  for(const token of ['Date of birth','Experience level','Training limitations / notes','Preferred training time','Normal training area','date_of_birth','experience_level','training_start_time','training_location_name','training_notes']){
    assert.ok(source.includes(token),`missing ${token}`);
  }
  assert.match(source,/estimated max HR/);
  assert.match(source,/Better HR data will always override the age estimate automatically/);
});

test('DOB fallback makes heart-rate coaching possible but does not replace better values',async()=>{
  const source=await readFile(profileUrl,'utf8');
  assert.match(source,/global\?\.estimated_max_hr/);
  assert.match(source,/form\?\.threshold_hr\|\|form\?\.max_hr/);
  assert.match(source,/row\?\.observed_max_hr/);
});
