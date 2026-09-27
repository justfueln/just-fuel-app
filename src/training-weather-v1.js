import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,profileCache=null,profileAt=0,weatherCache=new Map();

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function todayKey(){const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function daysAway(date){const a=new Date(`${todayKey()}T12:00:00`),b=new Date(`${date}T12:00:00`);return Math.round((b-a)/86400000)}
function timeShort(v){return String(v||'06:00').slice(0,5)}
function isPlanOpen(){const active=document.querySelector('.training-page .app-shell .section-nav button.active');return active?.textContent.trim()==='My Plan'}

async function profile(force=false){
  if(!force&&profileCache&&Date.now()-profileAt<60000)return profileCache;
  const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
  const{data}=await sb.from('training_profiles').select('user_id,training_location_name,training_lat,training_lon,training_start_time').eq('user_id',session.user.id).maybeSingle();
  profileCache=data||{user_id:session.user.id};profileAt=Date.now();return profileCache;
}

async function geocode(name){
  const q=String(name||'').trim();if(!q)return null;
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json&countryCode=ZA`;
  const r=await fetch(url);if(!r.ok)throw new Error('Could not check that location.');
  const j=await r.json();const x=j?.results?.[0];
  if(!x)return null;
  return{name:x.name&&x.admin1?`${x.name}, ${x.admin1}`:x.name||q,lat:Number(x.latitude),lon:Number(x.longitude)};
}

async function saveLocation(name,startTime){
  const{data:{session}}=await sb.auth.getSession();if(!session?.user)throw new Error('Please sign in again.');
  const place=await geocode(name);if(!place)throw new Error('Location not found. Try a nearby town or suburb.');
  const payload={user_id:session.user.id,training_location_name:place.name,training_lat:place.lat,training_lon:place.lon,training_start_time:startTime||'06:00'};
  const{error}=await sb.from('training_profiles').upsert(payload,{onConflict:'user_id'});if(error)throw error;
  profileCache={...(profileCache||{}),...payload};profileAt=Date.now();weatherCache.clear();return profileCache;
}

function renderLocationCard(root,p){
  root.replaceChildren();const card=el('section','jf-weather-setup');
  const top=el('div','jf-weather-setup-top');const copy=el('div');copy.append(el('span','jf-weather-kicker','WEATHER & HYDRATION'),el('strong','',p?.training_location_name||'Set your normal training area'));
  copy.append(el('small','',p?.training_location_name?`Typical start ${timeShort(p.training_start_time)} · weather is added to near-term workouts`:'This lets Just Fuel adjust fluid and electrolyte guidance for heat, humidity, wind and rain.'));
  top.append(copy);const edit=el('button','jf-weather-edit',p?.training_location_name?'Change':'Set location');edit.type='button';top.append(edit);card.append(top);root.append(card);
  edit.addEventListener('click',()=>renderLocationEditor(root,p));
}

function renderLocationEditor(root,p){
  root.replaceChildren();const card=el('section','jf-weather-setup jf-weather-editor');card.append(el('span','jf-weather-kicker','WEATHER & HYDRATION'),el('strong','','Where do you normally train?'));
  const field=el('label','jf-weather-field');field.append(el('span','','Town / suburb'));const input=document.createElement('input');input.placeholder='e.g. Durbanville';input.value=p?.training_location_name||'';field.append(input);card.append(field);
  const timeField=el('label','jf-weather-field');timeField.append(el('span','','Typical start time'));const time=document.createElement('input');time.type='time';time.value=timeShort(p?.training_start_time);timeField.append(time);card.append(timeField);
  card.append(el('p','jf-weather-note','Your saved training area is used for planning only. Race-route weather can use the event location separately as we expand the race engine.'));
  const status=el('div','jf-weather-status');const actions=el('div','jf-weather-actions');const cancel=el('button','jf-weather-edit','Cancel');const save=el('button','jf-weather-save','Save weather location');cancel.type=save.type='button';actions.append(cancel,save);card.append(status,actions);root.append(card);
  cancel.addEventListener('click',()=>renderLocationCard(root,p));
  save.addEventListener('click',async()=>{save.disabled=true;status.textContent='Finding location…';try{const next=await saveLocation(input.value,time.value);status.textContent='Saved';renderLocationCard(root,next);queue()}catch(e){status.textContent=e?.message||'Could not save location.'}finally{save.disabled=false}});
}

async function mountLocation(){
  if(!isPlanOpen())return;const main=document.querySelector('.training-page .app-shell main');if(!main)return;
  let root=main.querySelector(':scope > .jf-weather-profile-host');if(root)return;
  root=el('div','jf-weather-profile-host');const coach=main.querySelector(':scope > .jf-training-coach-host');coach?.after(root)||main.prepend(root);
  root.append(el('div','jf-weather-status','Loading weather setup…'));renderLocationCard(root,await profile());
}

function weatherAdvice(row,w){
  const heat=Math.max(Number(w.temp)||0,Number(w.feels)||0);const base=Math.max(400,Number(row.hydration_ml_per_hour)||500);let target=base,level='Normal conditions';
  if(heat>=32){target=Math.max(base+250,800);level='Very hot conditions'}else if(heat>=28){target=Math.max(base+180,700);level='Hot conditions'}else if(heat>=23){target=Math.max(base+100,600);level='Warm conditions'}
  if(Number(w.humidity)>=75&&heat>=24)target=Math.max(target,700);
  target=Math.min(1000,Math.round(target/50)*50);
  const low=Math.max(400,target-100),high=Math.min(1100,target+100);
  const notes=[];
  if(heat>=28)notes.push('Start drinking early and plan a refill if the session is long.');
  if(Number(w.humidity)>=75)notes.push('High humidity can make cooling harder, so stay consistent with fluids.');
  if(Number(w.wind)>=30)notes.push('Strong wind may raise effort for the same speed — ride to the prescribed effort, not average speed.');
  if(Number(w.rain)>=45)notes.push('Rain is possible. Keep fuel easy to reach so poor weather does not interrupt feeding.');
  const carbs=Number(row.carb_target_gph)||0;
  if(carbs>0)notes.push(`Keep the carbohydrate target at ${carbs} g/h. Bottle Mix supplies carbohydrate plus electrolytes; use extra water or Hydrate when extra fluid is needed rather than simply adding more carbohydrate.`);
  else notes.push('Use water/Hydrate to match fluid and electrolyte needs; add carbohydrate only if the session plan requires it.');
  return{level,low,high,notes};
}

async function fetchWeather(p,row){
  if(!p?.training_lat||!p?.training_lon)return{missing:true};
  const away=daysAway(row.session_date);if(away<0)return{past:true};if(away>15)return{future:true};
  const key=`${p.training_lat}:${p.training_lon}:${row.session_date}:${timeShort(p.training_start_time)}`;if(weatherCache.has(key))return weatherCache.get(key);
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(p.training_lat)}&longitude=${encodeURIComponent(p.training_lon)}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m&timezone=auto&start_date=${row.session_date}&end_date=${row.session_date}`;
  try{
    const r=await fetch(url);if(!r.ok)throw new Error('weather');const j=await r.json();const times=j?.hourly?.time||[];const wanted=`${row.session_date}T${timeShort(p.training_start_time)}`;let idx=times.findIndex(x=>x===wanted);if(idx<0)idx=Math.max(0,times.findIndex(x=>String(x).startsWith(`${row.session_date}T06`)));
    const result={temp:j.hourly?.temperature_2m?.[idx],feels:j.hourly?.apparent_temperature?.[idx],humidity:j.hourly?.relative_humidity_2m?.[idx],rain:j.hourly?.precipitation_probability?.[idx],wind:j.hourly?.wind_speed_10m?.[idx],time:times[idx]};weatherCache.set(key,result);return result;
  }catch{return{error:true}}
}

function weatherBlock(row,p,w){
  const box=el('div','workout-weather-line');box.append(el('span','','WEATHER + HYDRATION'));
  if(w.missing){box.append(el('strong','','Set your normal training area in My Plan to enable weather-based hydration.'));return box}
  if(w.future){box.append(el('strong','','Forecast not available yet.'));box.append(el('small','','Weather guidance will appear automatically when this workout is within the near-term forecast window.'));return box}
  if(w.past){box.append(el('strong','','Workout weather is only shown for upcoming sessions.'));return box}
  if(w.error){box.append(el('strong','','Weather could not load right now.'));return box}
  const a=weatherAdvice(row,w);const stats=el('div','workout-weather-stats');stats.append(el('b','',`${Math.round(Number(w.temp)||0)}°C`),el('span','',`${Math.round(Number(w.humidity)||0)}% humidity`),el('span','',`${Math.round(Number(w.wind)||0)} km/h wind`));box.append(stats);
  box.append(el('strong','',`${a.level} · plan about ${a.low}–${a.high} ml/h`));box.append(el('small','',`${p.training_location_name} · around ${timeShort(p.training_start_time)}`));
  const notes=el('ul','workout-weather-notes');a.notes.forEach(n=>notes.append(el('li','',n)));box.append(notes);return box;
}

async function enhanceWorkoutBodies(){
  const bodies=[...document.querySelectorAll('.training-page .workout-details-body[data-loaded="1"]')];if(!bodies.length)return;const p=await profile();
  for(const body of bodies){if(body.dataset.jfWeather==='1')continue;body.dataset.jfWeather='1';const card=body.closest('.session-card'),id=card?.dataset.jfSessionId;if(!id)continue;
    const{data:row}=await sb.from('training_plan_calendar_with_fuel').select('id,session_date,carb_target_gph,hydration_ml_per_hour').eq('id',id).maybeSingle();if(!row)continue;
    const w=await fetchWeather(p,row);const block=weatherBlock(row,p,w);const garmin=body.querySelector('.workout-garmin-guide');if(garmin)body.insertBefore(block,garmin);else body.append(block);
  }
}

function queue(){if(queued)return;queued=true;setTimeout(()=>{queued=false;mountLocation().catch(()=>{});enhanceWorkoutBodies().catch(()=>{})},140)}
if(typeof window!=='undefined'){
  window.addEventListener('load',queue);window.addEventListener('popstate',queue);window.addEventListener('jf-training-plan-updated',queue);
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
