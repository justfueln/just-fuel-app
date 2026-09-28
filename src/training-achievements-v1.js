import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,loading=null,cacheAt=0,achievements=[],completionRows=[];

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function fmtDate(v){if(!v)return'';const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(d)}
function fmtShort(v){if(!v)return'';const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short'}).format(d)}
function valueText(a){if(a?.value_num==null)return'';return `${Math.round(Number(a.value_num))}${a.unit==='W'?' W':a.unit?` ${a.unit}`:''}`}
function improvementText(a){const now=Number(a?.value_num),before=Number(a?.previous_value_num);if(!Number.isFinite(now)||!Number.isFinite(before)||before<=0)return'';const pct=(now-before)/before*100;return pct>0?`+${pct.toFixed(pct>=10?0:1)}%`:''}
function typeTone(type){return type==='ftp_improvement'?'ftp':type==='power_pb'?'pb':'sustained'}

async function load(force=false){
  if(!force&&cacheAt&&Date.now()-cacheAt<45000)return{achievements,completionRows};
  if(loading)return loading;
  loading=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return{achievements:[],completionRows:[]};
    const uid=session.user.id;
    try{await sb.rpc('refresh_training_achievements',{p_user_id:uid})}catch{}
    const since=new Date(Date.now()-90*86400000).toISOString();
    const[a,c]=await Promise.all([
      sb.from('training_achievements').select('id,achievement_key,achievement_type,title,message,metric_label,value_num,previous_value_num,unit,activity_id,activity_date,source,metadata,seen_at,created_at').eq('user_id',uid).gte('created_at',since).order('created_at',{ascending:false}).limit(30),
      sb.from('training_session_completion').select('session_id,title,session_date,actual_strava_activity_id,completion_status').eq('user_id',uid).gte('session_date',new Date(Date.now()-30*86400000).toISOString().slice(0,10)).order('session_date',{ascending:false})
    ]);
    achievements=a.data||[];completionRows=c.data||[];cacheAt=Date.now();return{achievements,completionRows};
  })().finally(()=>{loading=null});
  return loading;
}

async function markSeen(id){
  if(!id)return;
  try{await sb.from('training_achievements').update({seen_at:new Date().toISOString()}).eq('id',id);const row=achievements.find(x=>x.id===id);if(row)row.seen_at=new Date().toISOString()}catch{}
}

function coachCelebration(a){
  if(a.achievement_type==='ftp_improvement')return 'That is confirmed progress. Keep the next few quality sessions controlled while the new power targets settle in.';
  if(a.metric_label==='20 min')return 'That is meaningful sustained-power progress. Keep building it rather than chasing another test immediately.';
  if(a.metric_label==='5 min')return 'Your high-aerobic power is moving. This is the kind of improvement that supports harder climbs and repeated race efforts.';
  if(a.metric_label==='1 min')return 'Short-power is improving. Keep the quality work sharp, but protect recovery so it carries into longer efforts.';
  return 'Strong progress. Bank the result, recover well and let the training plan build on it.';
}

function clearInjected(){
  document.querySelectorAll('.jf-achievement-home,.jf-achievement-history,.jf-achievement-inline').forEach(n=>n.remove());
}

function renderHome(data){
  const home=document.querySelector('.today-dashboard');if(!home)return;
  const unseen=data.achievements.find(a=>!a.seen_at && new Date(a.created_at).getTime()>Date.now()-7*86400000);
  if(!unseen)return;
  const card=el('section',`jf-achievement-home jf-achievement-${typeTone(unseen.achievement_type)}`);
  const top=el('div','jf-achievement-home-top');const copy=el('div','');copy.append(el('span','jf-achievement-kicker','NEW ACHIEVEMENT'),el('h3','',unseen.title));top.append(copy,el('div','jf-achievement-icon','★'));card.append(top);
  const metric=el('div','jf-achievement-home-metric');metric.append(el('strong','',valueText(unseen)||unseen.metric_label||'Progress'));const delta=improvementText(unseen);if(delta)metric.append(el('span','',delta));card.append(metric);
  card.append(el('p','',unseen.message),el('small','',coachCelebration(unseen)));
  const btn=el('button','jf-achievement-dismiss','Nice ✓');btn.type='button';btn.addEventListener('click',async()=>{btn.disabled=true;await markSeen(unseen.id);card.remove()});card.append(btn);
  const head=home.querySelector('.today-head');if(head)head.after(card);else home.prepend(card);
}

function renderPerformance(data){
  const screen=document.querySelector('.training-performance-screen');if(!screen||!data.achievements.length)return;
  const card=el('section','card jf-achievement-history');
  const head=el('div','jf-achievement-history-head');const left=el('div','');left.append(el('span','eyebrow','ACHIEVEMENTS'),el('h3','','Recent progress'));head.append(left,el('div','jf-achievement-icon','★'));card.append(head);
  card.append(el('p','muted','Personal bests and confirmed performance milestones detected from your synced training.'));
  const list=el('div','jf-achievement-list');
  data.achievements.slice(0,8).forEach(a=>{
    const row=el('div',`jf-achievement-row jf-achievement-${typeTone(a.achievement_type)}`);const main=el('div','');main.append(el('strong','',a.title),el('span','',`${fmtShort(a.activity_date||a.created_at)}${a.metadata?.activity_name?` · ${a.metadata.activity_name}`:''}`));const metric=el('div','jf-achievement-row-metric');metric.append(el('b','',valueText(a)||a.metric_label||'Milestone'));const delta=improvementText(a);if(delta)metric.append(el('small','',delta));row.append(main,metric);list.append(row);
  });
  card.append(list);
  const anchor=screen.querySelector('.jf-power-curve-card')||screen.querySelector('.jf-ftp-detection')||screen.querySelector('.performance-head');if(anchor)anchor.after(card);else screen.prepend(card);
}

function renderSessionCelebrations(data){
  const byActivity=new Map();
  for(const a of data.achievements){if(a.activity_id){const k=String(a.activity_id);if(!byActivity.has(k))byActivity.set(k,[]);byActivity.get(k).push(a)}}
  if(!byActivity.size)return;
  const used=new Set();
  for(const card of document.querySelectorAll('.training-page .session-card')){
    const title=(card.querySelector('h3')?.textContent||'').trim();const date=(card.querySelector('.eyebrow')?.textContent||'').trim();
    const row=data.completionRows.find(r=>!used.has(r.session_id)&&String(r.title||'').trim()===title&&fmtDate(r.session_date)===date&&r.actual_strava_activity_id);
    if(!row)continue;used.add(row.session_id);const wins=byActivity.get(String(row.actual_strava_activity_id))||[];if(!wins.length)continue;
    const box=el('div','jf-achievement-inline');box.append(el('span','jf-achievement-kicker','COACH CELEBRATION'));
    const names=wins.slice(0,2).map(a=>a.title).join(' + ');box.append(el('strong','',names));
    const details=wins.slice(0,2).map(a=>`${a.metric_label||'Power'} ${valueText(a)}`.trim()).join(' · ');if(details)box.append(el('p','',details));
    box.append(el('small','',coachCelebration(wins[0])));
    const coach=card.querySelector('.jf-session-coach');if(coach)card.insertBefore(box,coach);else card.append(box);
  }
}

async function scan(force=false){
  const relevant=document.querySelector('.today-dashboard,.training-performance-screen,.training-page .session-card');if(!relevant){clearInjected();return}
  const data=await load(force);clearInjected();renderHome(data);renderPerformance(data);renderSessionCelebrations(data);
}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force).catch(()=>{})},220)}
function reset(){cacheAt=0;achievements=[];completionRows=[]}

if(typeof window!=='undefined'){
  window.addEventListener('load',()=>queue());window.addEventListener('popstate',()=>queue());
  ['jf-training-plan-updated','jf-training-feedback-saved','jf-recovery-logged','jf-strava-synced','jf-training-achievements-refresh'].forEach(name=>window.addEventListener(name,()=>{reset();queue(true)}));
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
