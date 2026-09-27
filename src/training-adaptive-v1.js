import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,cache=null,cacheAt=0,loading=null;

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function fmtDate(v){if(!v)return'';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${v}T12:00:00`))}
function labelFor(d){return d==='reduce'?'REDUCED':d==='fuel_review'?'FUEL REVIEW':d==='recovery_review'?'RECOVERY CHECK':'KEEP AS PLANNED'}
function titleFor(d){return d==='reduce'?'Coach adjusted the next session':d==='fuel_review'?'Training stays on plan — fix the fuel strategy':d==='recovery_review'?'Recovery comes before intensity':'Next session stays unchanged'}

async function load(force=false){
  if(!force&&cache&&Date.now()-cacheAt<45000)return cache;
  if(loading)return loading;
  loading=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
    const uid=session.user.id;
    const{data:plan}=await sb.from('training_plans').select('id').eq('user_id',uid).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle();
    if(!plan?.id)return null;
    const[rowsResult,decisionsResult]=await Promise.all([
      sb.from('training_plan_calendar_with_fuel').select('id,title,session_date,planned_duration_minutes,duration_minutes,status').eq('user_id',uid).eq('plan_id',plan.id).order('session_date',{ascending:true}),
      sb.from('training_coach_decisions').select('target_session_id,source_session_id,decision,factor,reason,base_adjusted_minutes,applied_adjusted_minutes,inputs,updated_at').eq('user_id',uid).eq('plan_id',plan.id).order('updated_at',{ascending:false})
    ]);
    cache={rows:rowsResult.data||[],decisions:new Map((decisionsResult.data||[]).map(x=>[x.target_session_id,x]))};cacheAt=Date.now();return cache;
  })().finally(()=>{loading=null});
  return loading;
}

function renderDecision(card,row,d){
  if(card.dataset.jfAdaptiveDecision==='1')return;card.dataset.jfAdaptiveDecision='1';
  const box=el('div',`jf-adaptive-decision jf-adaptive-${d.decision}`);
  const top=el('div','jf-adaptive-top');top.append(el('span','jf-adaptive-kicker','ADAPTIVE COACH'),el('b','jf-adaptive-badge',labelFor(d.decision)));box.append(top);
  box.append(el('strong','jf-adaptive-title',titleFor(d.decision)),el('p','jf-adaptive-reason',d.reason));
  if(d.decision==='reduce'&&Number(d.base_adjusted_minutes)>Number(d.applied_adjusted_minutes)){
    const change=el('div','jf-adaptive-change');change.append(el('span','','Duration'),el('b','',`${Math.round(Number(d.base_adjusted_minutes))} min → ${Math.round(Number(d.applied_adjusted_minutes))} min`));box.append(change);
  }
  if(d.decision==='fuel_review'&&d.inputs){
    const actual=Number(d.inputs.actual_gph),target=Number(d.inputs.target_gph);if(actual>0&&target>0){const change=el('div','jf-adaptive-change');change.append(el('span','','Last-session fuel'),el('b','',`${Math.round(actual)} g/h vs ${Math.round(target)} g/h`));box.append(change)}
  }
  const fuel=card.querySelector('.fuel-summary');if(fuel)card.insertBefore(box,fuel);else card.append(box);
}

async function scan(force=false){
  const cards=[...document.querySelectorAll('.training-page .session-card')];if(!cards.length)return;const data=await load(force);if(!data)return;const used=new Set();
  for(const card of cards){
    const title=(card.querySelector('h3')?.textContent||'').trim(),date=(card.querySelector('.eyebrow')?.textContent||'').trim();
    const row=data.rows.find(r=>!used.has(r.id)&&String(r.title||'').trim()===title&&fmtDate(r.session_date)===date);if(!row)continue;used.add(row.id);
    const d=data.decisions.get(row.id);if(d)renderDecision(card,row,d);
  }
}
function reset(){cache=null;cacheAt=0;document.querySelectorAll('.session-card[data-jf-adaptive-decision="1"]').forEach(c=>{c.dataset.jfAdaptiveDecision='';c.querySelector('.jf-adaptive-decision')?.remove()})}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force).catch(()=>{})},160)}
if(typeof window!=='undefined'){
  window.addEventListener('load',()=>queue());window.addEventListener('popstate',()=>queue());
  ['jf-training-feedback-saved','jf-recovery-logged','jf-training-plan-updated'].forEach(name=>window.addEventListener(name,()=>{reset();queue(true)}));
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
