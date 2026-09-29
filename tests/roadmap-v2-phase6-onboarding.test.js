import test from 'node:test';
import assert from 'node:assert/strict';
import {coreProfileComplete,enabledFamiliesForSport,nextOnboardingStep,primaryFamilyForSport,selectedTrainingDays} from '../src/athlete-onboarding-utils.js';

test('onboarding requires DOB, sport, experience, two days and a valid long day',()=>{
  const base={date_of_birth:'1985-05-10',primary_sport:'cycling',experience_level:'intermediate',available_weekdays:[2,4,6],long_session_weekday:6};
  assert.equal(coreProfileComplete(base),true);
  assert.equal(coreProfileComplete({...base,date_of_birth:null}),false);
  assert.equal(coreProfileComplete({...base,available_weekdays:[6]}),false);
  assert.equal(coreProfileComplete({...base,long_session_weekday:7}),false);
});

test('onboarding step order is DOB then sport then experience then days then long day then Strava',()=>{
  assert.equal(nextOnboardingStep({profile:null,stravaConnected:false}),'dob');
  assert.equal(nextOnboardingStep({profile:{date_of_birth:'1985-05-10'},stravaConnected:false}),'sport');
  assert.equal(nextOnboardingStep({profile:{date_of_birth:'1985-05-10',primary_sport:'cycling'},stravaConnected:false}),'experience');
  assert.equal(nextOnboardingStep({profile:{date_of_birth:'1985-05-10',primary_sport:'cycling',experience_level:'beginner'},stravaConnected:false}),'days');
  assert.equal(nextOnboardingStep({profile:{date_of_birth:'1985-05-10',primary_sport:'cycling',experience_level:'beginner',available_weekdays:[2,4]},stravaConnected:false}),'long_day');
  assert.equal(nextOnboardingStep({profile:{date_of_birth:'1985-05-10',primary_sport:'cycling',experience_level:'beginner',available_weekdays:[2,4],long_session_weekday:4},stravaConnected:false}),'strava');
  assert.equal(nextOnboardingStep({profile:{date_of_birth:'1985-05-10',primary_sport:'cycling',experience_level:'beginner',available_weekdays:[2,4],long_session_weekday:4},stravaConnected:true}),'race');
});

test('multisport onboarding enables the correct sport families without requiring sensor data',()=>{
  assert.deepEqual([...enabledFamiliesForSport('cycling')],['cycling']);
  assert.deepEqual([...enabledFamiliesForSport('running')],['running']);
  assert.deepEqual([...enabledFamiliesForSport('triathlon')],['cycling','running','swimming']);
  assert.deepEqual([...enabledFamiliesForSport('hyrox')],['hyrox','running']);
  assert.equal(primaryFamilyForSport('triathlon'),'cycling');
  assert.equal(primaryFamilyForSport('hyrox'),'hyrox');
});

test('training days are normalized before setup checks',()=>{
  assert.deepEqual(selectedTrainingDays({available_weekdays:[6,2,4]}),[2,4,6]);
  assert.deepEqual(selectedTrainingDays({available_weekdays:[0,2,8,4]}),[2,4]);
});
