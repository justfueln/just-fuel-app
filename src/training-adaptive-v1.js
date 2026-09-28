import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,cache=null,cacheAt=0,loading=null,stravaRefresh=null;

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
      sb.from('training_plan_calendar_with_fuel').select('id,title,session_date,planned_duration_minutes,duration_minutes,status,session_type,is_key_session').eq('user_id',uid).eq('plan_id',plan.id).order('session_date',{ascending:true}),
      sb.from('training_coach_decisions').select('target_session_id,source_session_id,decision,factor,reason,base_adjusted_minutes,applied_adjusted_minutes,inputs,schedule_action,suggested_date,original_date,swap_session_id,schedule_status,schedule_reason,schedule_applied_at,updated_at').eq('user_id',uid).eq('plan_id',plan.id).order('updated_at',{ascending:false})
    ]);
    const rows=rowsResult.data||[];
    cache={rows,rowMap:new Map(rows.map(x=>[x.id,x])),decisions:new Map((decisionsResult.data||[]).map(x=>[x.target_session_id,x]))};cacheAt=Date.now();return cache;
  })().finally(()=>{loading=null});
  return loading;
}

async function refreshCoachAfterStrava(){
  if(stravaRefresh)return stravaRefresh;
  stravaRefresh=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
    const uid=session.user.id;
    let adaptation=null,progression=null,decision=null,schedule=null;
    try{const r=await sb.rpc('refresh_training_plan_adaptation',{p_user_id:uid});adaptation=r.data||null}catch{}
    try{const r=await sb.rpc('refresh_training_progression',{p_user_id:uid});progression=r.data||null}catch{}
    try{const r=await sb.rpc('refresh_next_training_coach_decision',{p_user_id:uid});decision=r.data||null}catch{}
    try{const r=await sb.rpc('refresh_training_schedule_suggestion',{p_user_id:uid});schedule=r.data||null}catch{}
    cache=null;cacheAt=0;
    const detail={source:'strava_sync',adaptation,progression,decision,schedule};
    window.dispatchEvent(new CustomEvent('jf-training-plan-updated',{detail}));
    window.jfTrack?.('adaptive_coach_refreshed_after_strava',{coach_decision:decision?.decision||'none',schedule_status:schedule?.status||'none'},'training');
    return detail;
  })().finally(()=>{stravaRefresh=null});
  return stravaRefresh;
}

async function applySchedule(targetId,accept){
  const{data,error}=await sb.rpc('apply_training_schedule_suggestion',{p_target_session_id:targetId,p_accept:Boolean(accept)});
  if(error)throw error;
  cache=null;cacheAt=0;
  window.dispatchEvent(new CustomEvent('jf-training-plan-updated',{detail:{source:'adaptive_schedule',result:data}}));
  return data;
}

function renderSchedule(box,row,d,data){
  if(!d.schedule_status||d.schedule_status==='none')return;
  const wrap=el('div',`jf-schedule-suggestion jf-schedule-${d.schedule_status}`);
  const head=el('div','jf-schedule-head');head.append(el('span','','ADAPTIVE SCHEDULING'));
  const badge=el('b','',d.schedule_status==='pending'?'SUGGESTED':d.schedule_status==='accepted'?'MOVED':'KEPT');head.append(badge);wrap.append(head);

  if(d.schedule_status==='pending'){
    const from=fmtDate(d.original_date||row.session_date),to=fmtDate(d.suggested_date);
    const swap=data.rowMap.get(d.swap_session_id);
    wrap.append(el('strong','',d.schedule_action==='swap'?`Swap ${from} ↔ ${to}`:`Move ${from} → ${to}`));
    wrap.append(el('p','',d.schedule_reason||'Coach found a better recovery gap before this key session.'));
    if(swap)wrap.append(el('small','',`The easier session “${swap.title}” moves to ${from}.`));
    const actions=el('div','jf-schedule-actions');
    const keep=el('button','jf-schedule-secondary','Keep current date');const accept=el('button','jf-schedule-primary',d.schedule_action==='swap'?'Accept swap':'Move session');
    keep.type=accept.type='button';actions.append(keep,accept);wrap.append(actions);
    const status=el('div','jf-schedule-status');wrap.append(status);
    const run=async(ok)=>{keep.disabled=accept.disabled=true;status.textContent=ok?'Updating training calendar…':'Keeping current schedule…';try{await applySchedule(row.id,ok);status.textContent=ok?'Training calendar updated ✓':'Current date kept ✓';setTimeout(()=>{reset();queue(true)},150)}catch(e){status.textContent=e?.message||'Could not update the schedule.';keep.disabled=accept.disabled=false}};
    keep.addEventListener('click',()=>run(false));accept.addEventListener('click',()=>run(true));
  }else if(d.schedule_status==='accepted'){
    wrap.append(el('strong','',`Coach moved this session to ${fmtDate(d.suggested_date||row.session_date)}.`));
    wrap.append(el('p','',d.schedule_reason||'The schedule was adjusted to create a better recovery gap.'));
  }else if(d.schedule_status==='declined'){
    wrap.append(el('strong','','You kept the original training date.'));
    wrap.append(el('p','',d.schedule_reason||'Follow the current recovery and load guidance before starting the session.'));
  }
  box.append(wrap);
}

function renderDecision(card,row,d,data){
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
  renderSchedule(box,row,d,data);
  const fuel=card.querySelector('.fuel-summary');if(fuel)card.insertBefore(box,fuel);else card.append(box);
}

async function scan(force=false){
  const cards=[...document.querySelectorAll('.training-page .session-card')];if(!cards.length)return;const data=await load(force);if(!data)return;const used=new Set();
  for(const card of cards){
    const title=(card.querySelector('h3')?.textContent||'').trim(),date=(card.querySelector('.eyebrow')?.textContent||'').trim();
    const row=data.rows.find(r=>!used.has(r.id)&&String(r.title||'').trim()===title&&fmtDate(r.session_date)===date);if(!row)continue;used.add(row.id);
    const d=data.decisions.get(row.id);if(d)renderDecision(card,row,d,data);
  }
}
function reset(){cache=null;cacheAt=0;document.querySelectorAll('.session-card[data-jf-adaptive-decision="1"]').forEach(c=>{c.dataset.jfAdaptiveDecision='';c.querySelector('.jf-adaptive-decision')?.remove()})}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force).catch(()=>{})},160)}
if(typeof window!=='undefined'){
  window.addEventListener('load',()=>queue());window.addEventListener('popstate',()=>queue());
  window.addEventListener('jf-strava-synced',()=>{refreshCoachAfterStrava().catch(()=>{reset();queue(true)})});
  ['jf-training-feedback-saved','jf-recovery-logged','jf-training-plan-updated'].forEach(name=>window.addEventListener(name,()=>{reset();queue(true)}));
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
