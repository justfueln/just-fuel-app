import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
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
  const r=await fetch(`${SUPABASE_URL}/functions/v1/training-workout-fit`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({session_id:sessionId,format})});
  if(format==='fit'){
    if(!r.ok){let msg='Could not create FIT workout.';try{const j=await r.json();msg=j.error||msg}catch{}throw new Error(msg)}
    return r;
  }
  const j=await r.json();if(!r.ok)throw new Error(j.error||'Could not load workout details.');return j;
}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function fuelLine(s){const bits=[];if(Number(s.carb_target_gph)>0)bits.push(`${s.carb_target_gph} g carbs/h`);if(Number(s.bottle_mix_sachets)>0)bits.push(`${s.bottle_mix_sachets} Bottle Mix`);if(Number(s.regular_gels)>0)bits.push(`${s.regular_gels} gel${Number(s.regular_gels)===1?'':'s'}`);if(Number(s.boost_gels)>0)bits.push(`${s.boost_gels} Boost`);return bits.join(' · ')}
function downloadFitBlob(blob,filename){
  const a=document.createElement('a');a.href=window.URL.createObjectURL(blob);a.download=filename;a.style.display='none';document.body.append(a);a.click();
  setTimeout(()=>{window.URL.revokeObjectURL(a.href);a.remove()},2500);
}
async function downloadManualFit(data,btn,result){
  if(btn.disabled)return;btn.disabled=true;const old=btn.textContent;btn.textContent='Creating .FIT file…';result.hidden=true;
  try{
    const r=await callWorkout(data.session_id,'fit');const blob=await r.blob();const cd=r.headers.get('content-disposition')||'';const match=cd.match(/filename=\"?([^\";]+)\"?/i);const filename=match?.[1]||'just-fuel-workout.fit';
    downloadFitBlob(blob,filename);btn.textContent='.FIT downloaded';result.textContent='Manual FIT downloaded. This fallback is intended for computer/USB transfer only.';result.hidden=false;
    setTimeout(()=>{btn.textContent=old},3000);
  }catch(e){btn.textContent=e?.message||'Download failed';result.textContent='The workout could not be downloaded. Please try again.';result.hidden=false;setTimeout(()=>btn.textContent=old,2800)}finally{btn.disabled=false}
}
function renderGarminSync(body,data){
  const guide=el('div','workout-garmin-guide');
  guide.append(el('strong','','Garmin sync'));
  guide.append(el('p','','One-tap Send to Garmin is being connected through the Garmin Training API. No ZIP, extracting or course import will be required.'));
  const send=el('button','workout-fit-button');send.type='button';send.disabled=true;send.textContent='Send to Garmin — coming soon';guide.append(send);
  const details=document.createElement('details');details.className='workout-garmin-howto';
  const summary=document.createElement('summary');summary.textContent='Manual FIT download';
  const note=el('p','','Advanced fallback only: download the structured .FIT for computer/USB transfer. Garmin Connect mobile may treat manually opened FIT files as Courses.');
  const btn=el('button','workout-fit-button');btn.type='button';btn.textContent='Download .FIT manually';
  const result=el('div','workout-fit-result');result.hidden=true;
  btn.addEventListener('click',()=>downloadManualFit(data,btn,result));
  details.append(summary,note,btn,result);guide.append(details);body.append(guide);
}
function renderDetails(body,data,sessionRow){
  body.replaceChildren();
  const purpose=el('div','workout-purpose');purpose.append(el('span','','WHY THIS SESSION'),el('strong','',data.purpose));body.append(purpose);
  body.append(el('p','workout-description',data.description));
  if(data.target_text){const target=el('div','workout-fuel-line');target.append(el('span','','TARGET'),el('strong','',data.target_text));if(data.secondary_target_text)target.append(el('small','',data.secondary_target_text));body.append(target)}
  body.append(el('div','workout-breakdown-title','WORKOUT BREAKDOWN'));
  const list=el('div','workout-step-list');
  (data.steps||[]).forEach((s,i)=>{
    const row=el('div','workout-step-row');row.append(el('span','workout-step-number',String(i+1)));
    const copy=el('div','workout-step-copy');const top=el('div','workout-step-top');top.append(el('strong','',s.name),el('b','',niceDuration(s.seconds)));copy.append(top);
    const target=s.targetText||(s.powerLow&&s.powerHigh?`${s.powerLow}–${s.powerHigh} W`:s.intensity==='rest'?'Easy recovery':'Open effort');copy.append(el('span','workout-step-target',target));
    if(s.notes)copy.append(el('small','',s.notes));row.append(copy);list.append(row);
  });
  body.append(list);
  const fuel=fuelLine(sessionRow);if(fuel){const f=el('div','workout-fuel-line');f.append(el('span','','FUEL'),el('strong','',fuel));if(sessionRow.fueling_note)f.append(el('small','',sessionRow.fueling_note));body.append(f)}
  if(Number(sessionRow.hydration_ml_per_hour)>0){const h=el('div','workout-fuel-line');h.append(el('span','','HYDRATION'),el('strong','',`${sessionRow.hydration_ml_per_hour} ml/h${Number(sessionRow.sodium_target_mg_per_hour)>0?` · ${sessionRow.sodium_target_mg_per_hour} mg sodium/h`:''}`));if(sessionRow.hydration_note)h.append(el('small','',sessionRow.hydration_note));body.append(h)}
  if(Number(sessionRow.recover_servings)>0){const recovery=el('div','workout-recovery-line');recovery.append(el('span','','RECOVER'),el('strong','',`${sessionRow.recover_servings} × Just Fuel Recover after training`));if(sessionRow.recovery_note)recovery.append(el('small','',sessionRow.recovery_note));body.append(recovery)}
  if(data.downloadable!==false)renderGarminSync(body,data);
}
function addEnhancement(card,row){
  if(card.dataset.jfWorkoutEnhanced==='1')return;card.dataset.jfWorkoutEnhanced='1';card.dataset.jfSessionId=row.id;
  const wrap=el('div','workout-details-wrap');const toggle=el('button','workout-details-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.textContent='Workout details + Garmin';const body=el('div','workout-details-body');body.hidden=true;wrap.append(toggle,body);card.append(wrap);
  toggle.addEventListener('click',async()=>{const opening=body.hidden;body.hidden=!opening;toggle.setAttribute('aria-expanded',String(opening));toggle.textContent=opening?'Hide workout details':'Workout details + Garmin';if(!opening||body.dataset.loaded==='1')return;body.replaceChildren(el('div','workout-loading','Building your workout breakdown…'));try{const data=await callWorkout(row.id,'json');renderDetails(body,data,row);body.dataset.loaded='1'}catch(e){body.replaceChildren(el('div','workout-error',e?.message||'Could not load workout details.'))}});
}
async function scan(force=false){
  const cards=[...document.querySelectorAll('.training-page .session-card')];if(!cards.length)return;let rows=await sessions(force);const used=new Set();let unmatched=false;
  for(const card of cards){if(card.dataset.jfWorkoutEnhanced==='1')continue;const title=(card.querySelector('h3')?.textContent||'').trim(),date=(card.querySelector('.eyebrow')?.textContent||'').trim();let row=rows.find(r=>!used.has(r.id)&&String(r.title||'').trim()===title&&fmtDate(r.session_date)===date);if(!row){unmatched=true;continue}used.add(row.id);addEnhancement(card,row)}
  if(unmatched&&!force&&Date.now()-cacheAt>5000){rows=await sessions(true);for(const card of cards){if(card.dataset.jfWorkoutEnhanced==='1')continue;const title=(card.querySelector('h3')?.textContent||'').trim(),date=(card.querySelector('.eyebrow')?.textContent||'').trim();const row=rows.find(r=>String(r.title||'').trim()===title&&fmtDate(r.session_date)===date);if(row)addEnhancement(card,row)}}
}
function queueScan(){if(scanQueued)return;scanQueued=true;setTimeout(()=>{scanQueued=false;scan().catch(()=>{})},120)}
if(typeof window!=='undefined'){
  window.addEventListener('load',queueScan);
  window.addEventListener('jf-training-plan-updated',()=>{cache=[];cacheAt=0;loadingSessions=null;document.querySelectorAll('.training-page .session-card').forEach(card=>{delete card.dataset.jfWorkoutEnhanced;delete card.dataset.jfSessionId;card.querySelector('.workout-details-wrap')?.remove()});queueScan()});
  const obs=new MutationObserver(muts=>{if(muts.some(m=>m.addedNodes.length||m.removedNodes.length))queueScan()});
  const start=()=>{if(document.body)obs.observe(document.body,{childList:true,subtree:true});queueScan()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
