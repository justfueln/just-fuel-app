import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let scanQueued=false,loading=null,cacheAt=0,sessionRows=[],feedbackMap=new Map();

function fmtDate(v){if(!v)return'';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${v}T12:00:00`))}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function coachSummary(result){
  const d=result?.decision||{};
  const s=result?.schedule||{};
  if(!d?.ok)return'Feedback saved';
  let text='Feedback saved';
  if(d.decision==='reduce')text=`Saved · next session adjusted${d.adjusted_minutes?` to ${Math.round(Number(d.adjusted_minutes))} min`:''}`;
  else if(d.decision==='fuel_review')text='Saved · training stays on plan; fuel strategy flagged for review';
  else if(d.decision==='recovery_review')text='Saved · recovery review added before the next quality session';
  else if(d.decision==='keep')text='Saved · next session stays as planned';
  if(s?.status==='pending')text+=' · schedule suggestion ready';
  return text;
}

async function load(force=false){
  if(!force&&sessionRows.length&&Date.now()-cacheAt<60000)return{rows:sessionRows,feedback:feedbackMap};
  if(loading)return loading;
  loading=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return{rows:[],feedback:new Map()};
    const{data:plan}=await sb.from('training_plans').select('id').eq('user_id',session.user.id).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle();
    if(!plan?.id)return{rows:[],feedback:new Map()};
    const{data:rows}=await sb.from('training_plan_calendar_with_fuel').select('id,title,session_date,status').eq('user_id',session.user.id).eq('plan_id',plan.id).order('session_date',{ascending:true});
    sessionRows=rows||[];
    const ids=sessionRows.map(x=>x.id).filter(Boolean);
    feedbackMap=new Map();
    if(ids.length){
      const{data:feedback}=await sb.from('training_session_feedback').select('session_id,feel,flags').in('session_id',ids);
      for(const f of feedback||[])feedbackMap.set(f.session_id,f);
    }
    cacheAt=Date.now();return{rows:sessionRows,feedback:feedbackMap};
  })().finally(()=>{loading=null});
  return loading;
}

async function saveFeedback(row,feel,flags=[]){
  const{data:{session}}=await sb.auth.getSession();if(!session?.user)throw new Error('Please sign in again.');
  const payload={user_id:session.user.id,session_id:row.id,feel,flags};
  const{error}=await sb.from('training_session_feedback').upsert(payload,{onConflict:'user_id,session_id'});
  if(error)throw error;
  feedbackMap.set(row.id,{session_id:row.id,feel,flags});
  let adaptation=null,progression=null,decision=null,schedule=null;
  try{const result=await sb.rpc('refresh_training_plan_adaptation',{p_user_id:session.user.id});adaptation=result.data||null}catch{}
  try{const result=await sb.rpc('refresh_training_progression',{p_user_id:session.user.id});progression=result.data||null}catch{}
  try{const result=await sb.rpc('refresh_next_training_coach_decision',{p_user_id:session.user.id});decision=result.data||null}catch{}
  try{const result=await sb.rpc('refresh_training_schedule_suggestion',{p_user_id:session.user.id});schedule=result.data||null}catch{}
  const detail={sessionId:row.id,adaptation,progression,decision,schedule};
  window.jfTrack?.('workout_feedback_saved',{feel,flags_count:flags.length,coach_decision:decision?.decision||'none'},'training');
  window.dispatchEvent(new CustomEvent('jf-training-feedback-saved',{detail}));
  window.dispatchEvent(new CustomEvent('jf-training-plan-updated',{detail:{source:'feedback',adaptation,progression,decision,schedule}}));
  return detail;
}

function addFeedback(card,row,existing){
  if(card.dataset.jfFeedback==='1')return;card.dataset.jfFeedback='1';
  const wrap=el('div','jf-feedback');
  const title=el('div','jf-feedback-title',existing?'How did it feel?':'How did this session feel?');
  const feelRow=el('div','jf-feel-row');
  const feels=[['easy','Easy'],['good','Good'],['hard','Hard'],['too_hard','Too hard']];
  let selectedFeel=existing?.feel||'';
  let flags=[...(existing?.flags||[])];
  const status=el('div','jf-feedback-status',existing?'Feedback saved':'');
  const flagWrap=el('div','jf-flag-wrap');
  const flagLabel=el('span','','Anything else? Optional');flagWrap.append(flagLabel);
  const flagRow=el('div','jf-flag-row');
  const flagOptions=[['tired_legs','Tired legs'],['fuel_issue','Fuel issue'],['pain','Pain'],['sick','Sick']];

  function paint(){
    [...feelRow.children].forEach(btn=>btn.classList.toggle('selected',btn.dataset.value===selectedFeel));
    [...flagRow.children].forEach(btn=>btn.classList.toggle('selected',flags.includes(btn.dataset.value)));
    flagWrap.hidden=!selectedFeel;
  }
  async function persist(){
    if(!selectedFeel)return;status.textContent='Saving and checking your next session…';
    try{const result=await saveFeedback(row,selectedFeel,flags);status.textContent=coachSummary(result)}
    catch(e){status.textContent=e?.message||'Could not save'}
  }

  for(const[value,label]of feels){
    const b=el('button','jf-feel-btn',label);b.type='button';b.dataset.value=value;b.addEventListener('click',()=>{selectedFeel=value;paint();persist()});feelRow.append(b);
  }
  for(const[value,label]of flagOptions){
    const b=el('button','jf-flag-btn',label);b.type='button';b.dataset.value=value;b.addEventListener('click',()=>{flags=flags.includes(value)?flags.filter(x=>x!==value):[...flags,value];paint();persist()});flagRow.append(b);
  }
  flagWrap.append(flagRow);wrap.append(title,feelRow,flagWrap,status);card.append(wrap);paint();
}

async function scan(force=false){
  const cards=[...document.querySelectorAll('.training-page .session-card')];if(!cards.length)return;
  const{rows,feedback}=await load(force);const used=new Set();
  for(const card of cards){
    if(card.dataset.jfFeedback==='1')continue;
    const title=(card.querySelector('h3')?.textContent||'').trim();const date=(card.querySelector('.eyebrow')?.textContent||'').trim();
    const row=rows.find(r=>!used.has(r.id)&&String(r.title||'').trim()===title&&fmtDate(r.session_date)===date);
    if(!row)continue;used.add(row.id);
    if(String(row.status||'').toLowerCase()!=='completed')continue;
    addFeedback(card,row,feedback.get(row.id));
  }
}
function queue(){if(scanQueued)return;scanQueued=true;setTimeout(()=>{scanQueued=false;scan().catch(()=>{})},150)}
if(typeof window!=='undefined'){
  const start=()=>{const obs=new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()});if(document.body)obs.observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
