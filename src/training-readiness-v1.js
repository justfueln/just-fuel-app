import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,cache=null,cacheAt=0;

const pad=n=>String(n).padStart(2,'0');
function todayKey(){const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function fmtDate(v){if(!v)return'';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${v}T12:00:00`))}
function statusLabel(v){return v==='ready'?'READY':v==='caution'?'CAUTION':'RECOVERY'}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node}

async function load(force=false){
  if(!force&&cache&&Date.now()-cacheAt<45000)return cache;
  const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
  const uid=session.user.id,today=todayKey();
  const[readyResult,planResult]=await Promise.all([
    sb.from('training_readiness_checkins').select('checkin_date,score,status,recommendation,target_session_id,adjustment_status,applied_adjusted_minutes,updated_at').eq('user_id',uid).eq('checkin_date',today).maybeSingle(),
    sb.from('training_plans').select('id').eq('user_id',uid).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  const planId=planResult.data?.id;let row=null;
  if(planId){
    const r=await sb.from('training_plan_calendar').select('id,title,session_date,status,is_key_session').eq('user_id',uid).eq('plan_id',planId).eq('session_date',today).order('is_key_session',{ascending:false}).limit(1).maybeSingle();
    row=r.data||null;
  }
  cache={readiness:readyResult.data||null,row};cacheAt=Date.now();return cache;
}

function render(card,data){
  if(card.dataset.jfMorningReadiness==='1')return;card.dataset.jfMorningReadiness='1';
  const box=el('div','jf-readiness-session');
  const top=el('div','jf-readiness-session-top');top.append(el('span','','MORNING READINESS'));
  if(data.readiness)top.append(el('b','',`${statusLabel(data.readiness.status)} · ${Math.round(Number(data.readiness.score)||0)}/100`));
  else top.append(el('b','','CHECK-IN NEEDED'));
  box.append(top);
  if(data.readiness){
    box.append(el('p','',data.readiness.recommendation||'Morning readiness saved.'));
    if(data.readiness.adjustment_status==='accepted'&&data.readiness.applied_adjusted_minutes)box.append(el('p','','Coach adjustment applied: '+Math.round(Number(data.readiness.applied_adjusted_minutes))+' min.'));
    else if(data.readiness.adjustment_status==='pending')box.append(el('p','','A coach adjustment is waiting on Home for your approval.'));
  }else{
    box.append(el('p','','Complete the 10-second check-in on Home before training so the coach can account for sleep, legs, soreness, motivation and recent load.'));
  }
  const firstAction=card.querySelector('button');
  if(firstAction)card.insertBefore(box,firstAction);else card.append(box);
}

async function scan(force=false){
  const cards=[...document.querySelectorAll('.training-page .session-card')];if(!cards.length)return;
  const data=await load(force);if(!data?.row)return;
  const title=String(data.row.title||'').trim(),date=fmtDate(data.row.session_date);
  const card=cards.find(c=>(c.querySelector('h3')?.textContent||'').trim()===title&&(c.querySelector('.eyebrow')?.textContent||'').trim()===date);
  if(card)render(card,data);
}
function reset(){cache=null;cacheAt=0;document.querySelectorAll('.session-card[data-jf-morning-readiness="1"]').forEach(c=>{c.dataset.jfMorningReadiness='';c.querySelector('.jf-readiness-session')?.remove()})}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force).catch(()=>{})},160)}

if(typeof window!=='undefined'){
  window.addEventListener('load',()=>queue());
  window.addEventListener('popstate',()=>queue());
  ['jf-readiness-saved','jf-training-plan-updated'].forEach(name=>window.addEventListener(name,()=>{reset();queue(true)}));
  document.addEventListener('change',e=>{if(e.target?.closest?.('.plan-view-select'))queue()});
  queue();
}
