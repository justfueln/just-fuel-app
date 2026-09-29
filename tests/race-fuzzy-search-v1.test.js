import test from 'node:test';
import assert from 'node:assert/strict';
import {hasExactRaceSearchMatch,normalizeRaceSearch,rankFuzzyRaceMatches} from '../src/race-fuzzy-search-utils.js';

const events=[
  {event_id:'1',event_name:'Durbie Dash Road',start_date:'2026-10-17',sport_category:'cycling',discipline:'road_cycling',province:'Western Cape',is_verified:true},
  {event_id:'2',event_name:'Karoo to Coast',start_date:'2026-09-27',sport_category:'cycling',discipline:'mountain_bike',province:'Western Cape',is_verified:true},
  {event_id:'3',event_name:'Absa Cape Epic',start_date:'2027-03-21',sport_category:'cycling',discipline:'stage_racing',province:'Western Cape',is_verified:true},
  {event_id:'4',event_name:'Winelands Marathon',start_date:'2026-11-07',sport_category:'running',discipline:'road_running',province:'Western Cape',is_verified:true},
  {event_id:'5',event_name:'TinMan Durban #3',start_date:'2026-11-08',sport_category:'multisport',discipline:'triathlon',city:'Durban',province:'KwaZulu-Natal'}
];

test('normalises punctuation, case and accents',()=>{
  assert.equal(normalizeRaceSearch('  Cape–Épic!! '),'cape epic');
});

test('recognises normal partial searches so fuzzy suggestions can stay hidden',()=>{
  assert.equal(hasExactRaceSearchMatch(events[0],'durbie'),true);
  assert.equal(hasExactRaceSearchMatch(events[0],'durbiee'),false);
});

test('finds Durbie Dash when athlete types a spelling mistake',()=>{
  const matches=rankFuzzyRaceMatches(events,'Durby Dash');
  assert.equal(matches[0]?.event.event_name,'Durbie Dash Road');
});

test('finds Karoo to Coast with multiple spelling mistakes',()=>{
  const matches=rankFuzzyRaceMatches(events,'Karo to Coest');
  assert.equal(matches[0]?.event.event_name,'Karoo to Coast');
});

test('finds Cape Epic from phonetic-ish typo',()=>{
  const matches=rankFuzzyRaceMatches(events,'Cape Epik');
  assert.equal(matches[0]?.event.event_name,'Absa Cape Epic');
});

test('finds Winelands Marathon with a missing letter',()=>{
  const matches=rankFuzzyRaceMatches(events,'Winelands Maraton');
  assert.equal(matches[0]?.event.event_name,'Winelands Marathon');
});

test('does not fuzzy match one or two character searches',()=>{
  assert.deepEqual(rankFuzzyRaceMatches(events,'du'),[]);
});
