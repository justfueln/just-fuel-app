import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let cache=null,cacheAt=0,loading=null,queued=false;

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function n(v){return Number(v)||0}
function mins(v){const x=Math.max(0,Math.round(n(v))),h=Math.floor(x/60),m=x%60;return h?`${h}h${m?` ${m}m`:''}`:`${m}m`}
function scoreTone(v){return n(v)>=85?'strong':n(v)>=70?'track':n(v)>=55?'building':'attention'}

async function load(force=false){
  if(!force&&cache&&Date.now()-cacheAt<60000)return cache;
  if(loading)return loading;
  loading=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
    const{data,error}=await sb.rpc('get_race_goal_progress',{p_user_id:session.user.id});
    if(error)throw error;cache=data||null;cacheAt=Date.now();return cache;
  })().finally(()=>{loading=null});
  return loading;
}

function componentCopy(key,c,race){
  if(key==='consistency')return `${n(c.activity_days_28d)} active days · ${n(c.hours_28d).toFixed(1)} h in 28 days`;
  if(key==='quality'){
    if(n(c.planned_42d)>0)return `${n(c.good_42d)}/${n(c.planned_42d)} quality sessions executed well`;
    const bits=[];if(c.best_20m_w)bits.push(`20 min ${Math.round(n(c.best_20m_w))} W`);if(c.best_5m_w)bits.push(`5 min ${Math.round(n(c.best_5m_w))} W`);return bits.join(' · ')||'Building a quality-training baseline';
  }
  if(key==='durability'){
    const bits=[`Longest ${mins(c.longest_minutes_28d)}`,`target ${mins(c.target_training_minutes)}`,`${n(c.long_sessions_28d)} long session${n(c.long_sessions_28d)===1?'':'s'}`];
    if(race.is_stage_race)bits.push(`${n(c.back_to_back_pairs_56d)} back-to-back block${n(c.back_to_back_pairs_56d)===1?'':'s'}`);return bits.join(' · ');
  }
  if(key==='fuel')return `${n(c.successful_rehearsals_56d)}/${Math.max(2,n(c.rehearsals_56d))} successful rehearsals · target ${n(c.race_target_gph)} g/h`;
  if(key==='recovery')return n(c.checkins_7d)>=3?`${n(c.checkins_7d)} check-ins · ${Math.round(n(c.average_7d))}/100 average`:`${n(c.checkins_7d)} check-in${n(c.checkins_7d)===1?'':'s'} · building recovery baseline`;
  return'';
}

function componentRow(label,key,c,race){
  const row=el('div','jf-race-prep-component');
  const top=el('div','jf-race-prep-component-top');top.append(el('span','',label),el('b','',`${Math.round(n(c?.score))}/100`));row.append(top);
  const track=el('div','jf-race-prep-track');const fill=el('i',`jf-race-prep-fill ${scoreTone(c?.score)}`);fill.style.width=`${Math.max(3,Math.min(100,n(c?.score)))}%`;track.append(fill);row.append(track,el('small','',componentCopy(key,c||{},race)));return row;
}

function renderOverview(races){
  const hero=document.querySelector('.race-v2-shell .race-v2-hero');if(!hero)return;
  const menu=document.querySelector('.race-v2-shell .race-v2-menu select');if(menu&&menu.value!=='overview')return;
  document.querySelector('.jf-race-prep-card')?.remove();
  const name=(hero.querySelector('h2')?.textContent||'').trim();const race=races.find(x=>String(x.event_name||'').trim()===name);if(!race)return;
  const c=race.components||{};
  const card=el('section',`card jf-race-prep-card jf-race-prep-${scoreTone(race.score)}`);
  const head=el('div','jf-race-prep-head');const copy=el('div','');copy.append(el('span','eyebrow','GOAL PROGRESS'),el('h3','','Race preparation'));const score=el('div','jf-race-prep-score');score.append(el('strong','',`${Math.round(n(race.score))}`),el('span','','/100'));head.append(copy,score);card.append(head);
  const status=el('div','jf-race-prep-status');status.append(el('b','',race.status||'Building'),el('span','',`${n(race.days_to_race)} days to race · ${String(race.confidence||'low')} confidence`));card.append(status);

  if(race.specific_plan_active&&race.block_progress_pct!=null){
    const block=el('div','jf-race-block-progress');const top=el('div','');top.append(el('span','','Training block'),el('b','',`${Math.round(n(race.block_progress_pct))}%`));const tr=el('div','jf-race-prep-track');const f=el('i','jf-race-prep-fill track');f.style.width=`${Math.max(2,Math.min(100,n(race.block_progress_pct)))}%`;tr.append(f);block.append(top,tr);if(n(race.due_sessions)>0)block.append(el('small','',`${n(race.due_completed)}/${n(race.due_sessions)} due sessions completed`));card.append(block);
  }else if(race.current_training_focus&&race.current_training_focus!==race.event_name){
    card.append(el('div','jf-race-focus-note',`Current training focus: ${race.current_training_focus}. This race is using your recent training as the preparation signal until it becomes the active plan focus.`));
  }

  const grid=el('div','jf-race-prep-components');grid.append(
    componentRow('Consistency','consistency',c.consistency,race),
    componentRow('Quality / Power','quality',c.quality,race),
    componentRow(race.is_stage_race?'Stage durability':'Long-ride durability','durability',c.durability,race),
    componentRow('Fuel rehearsal','fuel',c.fuel,race),
    componentRow('Recovery trend','recovery',c.recovery,race)
  );card.append(grid);
  const priority=el('div','jf-race-prep-priority');priority.append(el('span','eyebrow','COACH PRIORITY'),el('strong','',String(race.coach_priority||'maintain').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())),el('p','',race.coach_priority_copy||''));card.append(priority,el('small','jf-race-prep-note',race.note||'Preparation score is guidance, not a prediction of race result.'));
  hero.after(card);
}

function renderRaceList(races){
  for(const card of document.querySelectorAll('.race-v2-card')){
    card.querySelector('.jf-race-prep-chip')?.remove();
    const name=(card.querySelector('.race-v2-card-copy h3')?.textContent||'').trim();const race=races.find(x=>String(x.event_name||'').trim()===name);if(!race)continue;
    const chip=el('div',`jf-race-prep-chip ${scoreTone(race.score)}`);chip.append(el('b','',`${Math.round(n(race.score))}/100`),el('span','',race.status||'Building'));
    card.querySelector('.race-v2-card-copy')?.append(chip);
  }
}

function renderHome(races){
  const card=document.querySelector('.today-race-card');if(!card)return;card.querySelector('.jf-home-race-prep')?.remove();
  const name=(card.querySelector('.today-race-copy h2')?.textContent||'').trim();const race=races.find(x=>String(x.event_name||'').trim()===name);if(!race)return;
  const line=el('div',`jf-home-race-prep ${scoreTone(race.score)}`);line.append(el('b','',`Preparation ${Math.round(n(race.score))}/100`),el('span','',race.status||'Building'));card.append(line);
}

function clear(){document.querySelectorAll('.jf-race-prep-card,.jf-race-prep-chip,.jf-home-race-prep').forEach(x=>x.remove())}
async function scan(force=false){
  const relevant=document.querySelector('.race-v2-shell,.today-race-card');if(!relevant){clear();return}
  try{const data=await load(force);const races=Array.isArray(data?.races)?data.races:[];renderOverview(races);renderRaceList(races);renderHome(races)}catch{}
}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force)},180)}
function reset(){cache=null;cacheAt=0;clear()}

if(typeof window!=='undefined'){
  window.addEventListener('load',()=>queue());window.addEventListener('popstate',()=>queue());
  ['jf-training-plan-updated','jf-training-feedback-saved','jf-recovery-logged','jf-readiness-saved','jf-strava-synced','jf-training-achievements-refresh'].forEach(name=>window.addEventListener(name,()=>{reset();queue(true)}));
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
