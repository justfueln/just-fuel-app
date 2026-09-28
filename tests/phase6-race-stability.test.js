import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const shellUrl=new URL('../src/ShellNextV3.jsx',import.meta.url);
const raceUrl=new URL('../src/RaceApp.jsx',import.meta.url);

test('Race is isolated from the legacy Training page tree',async()=>{
  const shell=await readFile(shellUrl,'utf8');
  assert.match(shell,/const RaceApp=lazy\(\(\)=>import\('\.\/RaceApp'\)\)/);
  assert.match(shell,/\{section==='race'&&<RaceApp\/>\}/);
  assert.doesNotMatch(shell,/isTrainingArea&&<TrainingApp/);
});

test('Race reloads data in place instead of doing a full-page reload',async()=>{
  const race=await readFile(raceUrl,'utf8');
  assert.match(race,/fetchTrainingRaces\(supabase,session\.user\.id\)/);
  assert.match(race,/<RaceHubV2 races=\{races\} userId=\{session\.user\.id\} reload=\{reloadRaces\}\/>/);
  assert.doesNotMatch(race,/window\.location\.reload/);
  assert.doesNotMatch(race,/RaceCalendar/);
  assert.doesNotMatch(race,/SeasonRace/);
});
