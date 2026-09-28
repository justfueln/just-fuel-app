import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,cache=null,cacheAt=0,loading=null;

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function fmtDate(v){if(!v)return'';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${v}T12:00:00`))}
function label(v){return v==='progress'?'PROGRESS':v==='hold'?'HOLD':v==='protect'?'PROTECT':'BASELINE'}
function title(v){return v==='progress'?'Coach progressed this workout':v==='hold'?'Progression held for now':v==='protect'?'Recovery load protected':'Building progression evidence'}
function evaluated(row){return Boolean(row?.progression_applied_at||row?.progression_reason)}

async function load(force=false){
  if(!force&&cache&&Date.now()-cacheAt<45000)return cache;
  if(loading)return loading;
  loading=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
    const uid=session.user.id;
    const{data:plan}=await sb.from('training_plans').select('id').eq('user_id',uid).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle();
    if(!plan?.id)return null;
    const{data:rows,error}=await sb.from('training_plan_calendar_with_fuel')
      .select('id,title,session_date,session_type,planned_duration_minutes,duration_minutes,target_power_low_w,target_power_high_w,progression_status,progression_factor,progression_reason,progression_source_count,progression_applied_at')
      .eq('user_id',uid).eq('plan_id',plan.id).gte('session_date',new Date().toISOString().slice(0,10)).order('session_date',{ascending:true});
    if(error)throw error;
    const list=rows||[];
    cache={rows:list,rowMap:new Map(list.map(x=>[x.id,x]))};cacheAt=Date.now();return cache;
  })().finally(()=>{loading=null});
  return loading;
}

function isPlanOpen(){
  const nav=document.querySelector('.training-page .section-nav');
  if(!nav)return false;
  const active=[...nav.querySelectorAll('button.active')].map(b=>b.textContent.trim());
  return active.includes('My Plan')||active.includes('Plan');
}

function renderSummary(data){
  const main=document.querySelector('.training-page .app-shell main');const stack=main?.querySelector(':scope > .stack');if(!stack)return;
  stack.querySelector('.jf-progression-summary')?.remove();
  const upcoming=data.rows.filter(evaluated);
  if(!upcoming.length)return;
  const progressed=upcoming.filter(r=>r.progression_status==='progress').length;
  const held=upcoming.filter(r=>r.progression_status==='hold'||r.progression_status==='protect').length;
  const baseline=upcoming.filter(r=>r.progression_status==='baseline').length;
  const card=el('section','card jf-progression-summary');
  const head=el('div','jf-progression-summary-head');const left=el('div','');left.append(el('span','eyebrow','PROGRESSION COACH'),el('h3','','How the plan advances'));head.append(left,el('b','jf-progression-summary-badge',progressed?'PROGRESSING':held?'CONTROLLED':'LEARNING'));card.append(head);
  const grid=el('div','jf-progression-summary-grid');
  for(const[v,t]of[[progressed,'Progress'],[held,'Held/protected'],[baseline,'Building']]){const x=el('div','');x.append(el('strong','',String(v)),el('span','',t));grid.append(x)}
  card.append(grid);
  card.append(el('p','jf-progression-summary-copy','Just Fuel progresses quality, endurance and long-session load only after comparable workouts are completed well. FTP itself is not changed automatically.'));
  const learning=stack.querySelector('.jf-week-learning');if(learning)learning.after(card);else stack.prepend(card);
}

function renderCard(card,row){
  if(!evaluated(row)||card.dataset.jfProgression==='1')return;card.dataset.jfProgression='1';
  const box=el('div',`jf-progression jf-progression-${row.progression_status||'baseline'}`);
  const top=el('div','jf-progression-top');top.append(el('span','','PROGRESSION COACH'),el('b','',label(row.progression_status)));box.append(top);
  box.append(el('strong','',title(row.progression_status)),el('p','',row.progression_reason||'The coach is monitoring this workout before changing the progression.'));
  if(row.progression_status==='progress'){
    const changes=[];
    if(Number(row.duration_minutes)!==Number(row.planned_duration_minutes))changes.push(`${Math.round(Number(row.duration_minutes))} min`);
    if(row.target_power_low_w&&row.target_power_high_w)changes.push(`${Math.round(Number(row.target_power_low_w))}–${Math.round(Number(row.target_power_high_w))} W`);
    if(changes.length){const c=el('div','jf-progression-change');c.append(el('span','','Progressed target'),el('b','',changes.join(' · ')));box.append(c)}
  }
  if(Number(row.progression_source_count)>0){box.append(el('small','',`Based on ${row.progression_source_count} comparable recent session${Number(row.progression_source_count)===1?'':'s'}.`))}
  const fuel=card.querySelector('.fuel-summary');if(fuel)card.insertBefore(box,fuel);else card.append(box);
}

async function scan(force=false){
  if(!isPlanOpen()){document.querySelector('.jf-progression-summary')?.remove();return}
  const data=await load(force);if(!data)return;renderSummary(data);
  const cards=[...document.querySelectorAll('.training-page .session-card')];const used=new Set();
  for(const card of cards){
    const t=(card.querySelector('h3')?.textContent||'').trim(),d=(card.querySelector('.eyebrow')?.textContent||'').trim();
    const row=data.rows.find(r=>evaluated(r)&&!used.has(r.id)&&String(r.title||'').trim()===t&&fmtDate(r.session_date)===d);if(!row)continue;used.add(row.id);renderCard(card,row);
  }
}
function reset(){cache=null;cacheAt=0;document.querySelector('.jf-progression-summary')?.remove();document.querySelectorAll('.session-card[data-jf-progression="1"]').forEach(c=>{c.dataset.jfProgression='';c.querySelector('.jf-progression')?.remove()})}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force).catch(()=>{})},170)}
if(typeof window!=='undefined'){
  window.addEventListener('load',()=>queue());window.addEventListener('popstate',()=>queue());
  ['jf-training-plan-updated','jf-training-feedback-saved','jf-readiness-saved'].forEach(name=>window.addEventListener(name,()=>{reset();queue(true)}));
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
