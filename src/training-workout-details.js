import { createClient } from '@supabase/supabase-js';

const URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let cache=[],cacheAt=0,scanQueued=false,loadingSessions=null;

function fmtDate(v){if(!v)return'';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${v}T12:00:00`))}
function niceDuration(seconds){const s=Math.max(0,Number(seconds)||0);if(s<60)return`${s}s`;const m=Math.round(s/60);return`${m} min`}
async function sessions(force=false){
  if(!force&&cache.length&&Date.now()-cacheAt<60000)return cache;
  if(loadingSessions)return loadingSessions;
  loadingSessions=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return[];
    const{data:plan}=await sb.from('training_plans').select('id').eq('user_id',session.user.id).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle();
    if(!plan?.id)return[];
    const{data}=await sb.from('training_plan_calendar_with_fuel').select('*').eq('user_id',session.user.id).eq('plan_id',plan.id).order('session_date',{ascending:true});
    cache=data||[];cacheAt=Date.now();return cache;
  })().finally(()=>{loadingSessions=null});
  return loadingSessions;
}
async function callWorkout(sessionId,format='json'){
  const{data:{session}}=await sb.auth.getSession();if(!session?.access_token)throw new Error('Please sign in again.');
  const r=await fetch(`${URL}/functions/v1/training-workout-fit`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({session_id:sessionId,format})});
  if(format==='fit'){
    if(!r.ok){let msg='Could not create FIT workout.';try{const j=await r.json();msg=j.error||msg}catch{}throw new Error(msg)}
    return r;
  }
  const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not load workout details.');return j;
}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function fuelLine(s){const bits=[];if(Number(s.carb_target_gph)>0)bits.push(`${s.carb_target_gph} g carbs/h`);if(Number(s.bottle_mix_sachets)>0)bits.push(`${s.bottle_mix_sachets} Bottle Mix`);if(Number(s.regular_gels)>0)bits.push(`${s.regular_gels} gel${Number(s.regular_gels)===1?'':'s'}`);if(Number(s.boost_gels)>0)bits.push(`${s.boost_gels} Boost`);return bits.join(' · ')}
function renderDetails(body,data,sessionRow){
  body.replaceChildren();
  const purpose=el('div','workout-purpose');purpose.append(el('span','','WHY THIS SESSION'),el('strong','',data.purpose));body.append(purpose);
  body.append(el('p','workout-description',data.description));
  const heading=el('div','workout-breakdown-title','WORKOUT BREAKDOWN');body.append(heading);
  const list=el('div','workout-step-list');
  (data.steps||[]).forEach((s,i)=>{const row=el('div','workout-step-row');row.append(el('span','workout-step-number',String(i+1)));const copy=el('div','workout-step-copy');const top=el('div','workout-step-top');top.append(el('strong','',s.name),el('b','',niceDuration(s.seconds)));copy.append(top);const target=s.powerLow&&s.powerHigh?`${s.powerLow}–${s.powerHigh} W`:s.intensity==='rest'?'Easy recovery':'Open effort';copy.append(el('span','workout-step-target',target));if(s.notes)copy.append(el('small','',s.notes));row.append(copy);list.append(row)});body.append(list);
  const fuel=fuelLine(sessionRow);if(fuel){const f=el('div','workout-fuel-line');f.append(el('span','','FUEL'),el('strong','',fuel));body.append(f)}
  if(data.downloadable!==false){const btn=el('button','workout-fit-button');btn.type='button';btn.textContent='Download Garmin FIT workout';btn.addEventListener('click',async()=>{if(btn.disabled)return;btn.disabled=true;const old=btn.textContent;btn.textContent='Creating FIT file…';try{const r=await callWorkout(data.session_id,'fit');const blob=await r.blob();const cd=r.headers.get('content-disposition')||'';const match=cd.match(/filename="?([^";]+)"?/i);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=match?.[1]||`just-fuel-workout.fit`;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);btn.textContent='FIT downloaded';setTimeout(()=>btn.textContent=old,1800)}catch(e){btn.textContent=e?.message||'Download failed';setTimeout(()=>btn.textContent=old,2500)}finally{btn.disabled=false}});body.append(btn);body.append(el('small','workout-fit-note','Structured FIT workout for compatible Garmin devices.'))}
}
function addEnhancement(card,row){
  if(card.dataset.jfWorkoutEnhanced==='1')return;card.dataset.jfWorkoutEnhanced='1';card.dataset.jfSessionId=row.id;
  const wrap=el('div','workout-details-wrap');const toggle=el('button','workout-details-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.textContent='Workout details + Garmin FIT';const body=el('div','workout-details-body');body.hidden=true;wrap.append(toggle,body);card.append(wrap);
  toggle.addEventListener('click',async()=>{const opening=body.hidden;body.hidden=!opening;toggle.setAttribute('aria-expanded',String(opening));toggle.textContent=opening?'Hide workout details':'Workout details + Garmin FIT';if(!opening||body.dataset.loaded==='1')return;body.replaceChildren(el('div','workout-loading','Building your workout breakdown…'));try{const data=await callWorkout(row.id,'json');renderDetails(body,data,row);body.dataset.loaded='1'}catch(e){body.replaceChildren(el('div','workout-error',e?.message||'Could not load workout details.'))}});
}
async function scan(force=false){
  const cards=[...document.querySelectorAll('.training-page .session-card')];if(!cards.length)return;let rows=await sessions(force);const used=new Set();let unmatched=false;
  for(const card of cards){if(card.dataset.jfWorkoutEnhanced==='1')continue;const title=(card.querySelector('h3')?.textContent||'').trim(),date=(card.querySelector('.eyebrow')?.textContent||'').trim();let row=rows.find(r=>!used.has(r.id)&&String(r.title||'').trim()===title&&fmtDate(r.session_date)===date);if(!row){unmatched=true;continue}used.add(row.id);addEnhancement(card,row)}
  if(unmatched&&!force&&Date.now()-cacheAt>5000){rows=await sessions(true);for(const card of cards){if(card.dataset.jfWorkoutEnhanced==='1')continue;const title=(card.querySelector('h3')?.textContent||'').trim(),date=(card.querySelector('.eyebrow')?.textContent||'').trim();const row=rows.find(r=>String(r.title||'').trim()===title&&fmtDate(r.session_date)===date);if(row)addEnhancement(card,row)}}
}
function queueScan(){if(scanQueued)return;scanQueued=true;setTimeout(()=>{scanQueued=false;scan().catch(()=>{})},120)}
if(typeof window!=='undefined'){
  window.addEventListener('load',queueScan);
  const obs=new MutationObserver(muts=>{if(muts.some(m=>m.addedNodes.length||m.removedNodes.length))queueScan()});
  const start=()=>{if(document.body)obs.observe(document.body,{childList:true,subtree:true});queueScan()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
