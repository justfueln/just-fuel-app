import test from 'node:test';
import assert from 'node:assert/strict';
import {fitTargetFields,garminTargetForStep,normaliseWorkoutMetric,paceSecondsPerKmToFitSpeed} from '../supabase/functions/training-workout-fit/garmin-targets.js';

test('cycling power targets encode absolute watts with Garmin FIT offset',()=>{
  const target=garminTargetForStep({metric:'power',intensity:'active',powerLow:280,powerHigh:320});
  assert.equal(target.type,'power');
  assert.deepEqual(fitTargetFields(target),{targetType:'power',targetValue:0,customTargetPowerLow:1280,customTargetPowerHigh:1320});
});

test('HR-only workouts encode absolute bpm with Garmin FIT offset',()=>{
  const target=garminTargetForStep({metric:'heart_rate',intensity:'active',hrLow:150,hrHigh:165});
  assert.equal(target.type,'heart_rate');
  assert.deepEqual(fitTargetFields(target),{targetType:'heart_rate',targetValue:0,customTargetHeartRateLow:250,customTargetHeartRateHigh:265});
});

test('running pace targets encode as Garmin speed range in centimetres per second',()=>{
  const target=garminTargetForStep({metric:'pace',intensity:'active',paceFast:300,paceSlow:330});
  assert.equal(target.type,'speed');
  assert.equal(paceSecondsPerKmToFitSpeed(330),303);
  assert.equal(paceSecondsPerKmToFitSpeed(300),333);
  assert.deepEqual(fitTargetFields(target),{targetType:'speed',targetValue:0,customTargetSpeedLow:303,customTargetSpeedHigh:333});
});

test('RPE and recovery steps stay open instead of inventing device targets',()=>{
  assert.deepEqual(fitTargetFields(garminTargetForStep({metric:'rpe',intensity:'active'})),{targetType:'open',targetValue:0});
  assert.deepEqual(fitTargetFields(garminTargetForStep({metric:'heart_rate',intensity:'rest',hrLow:150,hrHigh:165})),{targetType:'open',targetValue:0});
});

test('legacy sessions resolve to the best available target without requiring FTP',()=>{
  assert.equal(normaliseWorkoutMetric(null,{family:'cycling',hrLow:140,hrHigh:155}),'heart_rate');
  assert.equal(normaliseWorkoutMetric(null,{family:'running',paceFast:285,paceSlow:305}),'pace');
  assert.equal(normaliseWorkoutMetric(null,{family:'cycling'}),'rpe');
});
