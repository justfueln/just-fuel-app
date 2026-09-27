import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,cache=null,cacheAt=0,loading=null;

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n.toFixed(d):'—'}
function statusLabel(v){return v==='protect'?'PROTECT':v==='hold'?'HOLD':v==='progress'?'ON PLAN':'BUILDING'}

async function load(force=false){
  if(!force&&cache&&Date.now()-cacheAt<45000)return cache;
  if(loading)return loading;
  loading=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
    const{data,error}=await sb.rpc('get_training_week_learning',{p_user_id:session.user.id});
    if(error)throw error;
    cache=data||null;cacheAt=Date.now();return cache;
  })().finally(()=>{loading=null});
  return loading;
}

function isPlanOpen(){
  const nav=document.querySelector('.training-page .section-nav');
  if(!nav)return false;
  const active=[...nav.querySelectorAll('button.active')].map(b=>b.textContent.trim());
  return active.includes('My Plan')||active.includes('Plan');
}

function remove(){document.querySelector('.jf-week-learning')?.remove()}

function render(data){
  if(!data?.ok||!isPlanOpen())return;
  const main=document.querySelector('.training-page .app-shell main');
  const stack=main?.querySelector(':scope > .stack');
  if(!stack)return;
  remove();
  const s=data.readiness||{},week=data.next_week||null,patterns=Array.isArray(data.patterns)?data.patterns:[];
  const card=el('section',`card jf-week-learning jf-week-${data.status||'building'}`);
  const head=el('div','jf-week-learning-head');
  const left=el('div','');left.append(el('span','eyebrow','WEEKLY PLAN LEARNING'),el('h3','',data.headline||'Weekly learning'));
  head.append(left,el('b','jf-week-learning-badge',statusLabel(data.status)));card.append(head);
  card.append(el('p','jf-week-learning-copy',data.copy||''));

  const grid=el('div','jf-week-learning-grid');
  const avg=el('div','');avg.append(el('span','','Readiness'),el('strong','',s.avg_7d!=null?`${Math.round(Number(s.avg_7d))}/100`:'Baseline'),el('small','',`${Number(s.checkins_7d)||0} check-in${Number(s.checkins_7d)===1?'':'s'} this week`));
  const trend=el('div','');trend.append(el('span','','Trend'),el('strong','',String(s.trend||'building').replace(/\b\w/g,m=>m.toUpperCase())),el('small','',`${Number(s.low_days_28d)||0} caution/recovery days in 28d`));
  const hours=el('div','');hours.append(el('span','','Next week'),el('strong','',week?`${num(week.adjusted_hours??week.planned_hours,1)} h`:'—'),el('small','',week&&Number(week.adjusted_hours)<Number(week.planned_hours)?`${num(week.planned_hours,1)} h planned · coach reduced`:'Planned training time'));
  const phase=el('div','');phase.append(el('span','','Phase'),el('strong','',week?.phase?String(week.phase).replace(/\b\w/g,m=>m.toUpperCase()):'—'),el('small','',week?.focus||'Next training block'));
  grid.append(avg,trend,hours,phase);card.append(grid);

  if(week?.adaptation_reason){const why=el('details','jf-week-learning-why');why.append(el('summary','','Why next week looks like this'),el('p','',week.adaptation_reason));card.append(why)}
  const learned=patterns.find(p=>p?.type&&p.type!=='baseline');
  if(learned){const note=el('div','jf-week-learning-pattern');note.append(el('span','','COACH LEARNING'),el('p','',learned.message||''));card.append(note)}
  else if(patterns[0]?.message){const note=el('div','jf-week-learning-pattern building');note.append(el('span','','COACH LEARNING'),el('p','',patterns[0].message));card.append(note)}

  const adaptive=stack.querySelector('.adaptive-note');
  if(adaptive)adaptive.after(card);else stack.prepend(card);
}

async function scan(force=false){
  if(!isPlanOpen()){remove();return}
  try{const data=await load(force);render(data)}catch{}
}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force)},160)}
function reset(){cache=null;cacheAt=0;remove()}

if(typeof window!=='undefined'){
  window.addEventListener('load',()=>queue());window.addEventListener('popstate',()=>queue());
  ['jf-readiness-saved','jf-training-plan-updated'].forEach(name=>window.addEventListener(name,()=>{reset();queue(true)}));
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
