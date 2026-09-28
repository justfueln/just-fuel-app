import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,loading=null,cache=null,cacheAt=0;

const CHECKS=[
  ['equipment','Bike / equipment checked'],
  ['kit','Race kit and number ready'],
  ['fuel','Race fuel packed'],
  ['bottles','Bottles and hydration ready'],
  ['breakfast','Pre-race breakfast plan ready'],
  ['logistics','Route, start time and logistics confirmed']
];

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function todayKey(){const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function fmtDate(v){if(!v)return'—';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`))}
function mins(v){const n=Math.max(0,Math.round(Number(v)||0)),h=Math.floor(n/60),m=n%60;return h?`${h}h${m?` ${m}m`:''}`:`${m}m`}
function clampPct(v){return Math.max(0,Math.min(100,Math.round(Number(v)||0)))}
function checklistKey(id){return`jf-race-week-checklist-${id}`}
function loadChecks(id){try{return JSON.parse(localStorage.getItem(checklistKey(id))||'{}')}catch{return{}}}
function saveChecks(id,value){try{localStorage.setItem(checklistKey(id),JSON.stringify(value))}catch{}}

async function load(force=false){
  if(!force&&cache&&Date.now()-cacheAt<60000)return cache;
  if(loading)return loading;
  loading=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
    const uid=session.user.id;
    const{data:races,error:raceError}=await sb.from('athlete_season_events')
      .select('race_goal_id,event_name,event_date,priority,days_to_event,distance_km,elevation_m,goal_time_minutes')
      .eq('user_id',uid).eq('status','active').gte('event_date',todayKey()).order('event_date',{ascending:true});
    if(raceError)return null;
    const race=(races||[]).find(r=>String(r.priority||'').toUpperCase()==='A'&&Number(r.days_to_event)>=0&&Number(r.days_to_event)<=14);
    if(!race){cache={race:null};cacheAt=Date.now();return cache}
    const[prepResult,fuelResult,planResult]=await Promise.all([
      sb.from('training_race_preparation').select('*').eq('user_id',uid).eq('race_goal_id',race.race_goal_id).maybeSingle(),
      sb.from('race_fuel_plan').select('*').eq('user_id',uid).eq('race_goal_id',race.race_goal_id).maybeSingle(),
      sb.from('training_plans').select('id').eq('user_id',uid).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle()
    ]);
    let sessions=[];
    if(planResult.data?.id){
      const result=await sb.from('training_plan_calendar_with_fuel')
        .select('id,session_date,title,session_type,duration_minutes,planned_duration_minutes,status,is_key_session')
        .eq('user_id',uid).eq('plan_id',planResult.data.id).gte('session_date',todayKey()).lte('session_date',race.event_date).order('session_date',{ascending:true});
      sessions=(result.data||[]).filter(s=>String(s.session_type||'').toLowerCase()!=='race').slice(-5);
    }
    cache={race,prep:prepResult.data||null,fuel:fuelResult.data||null,sessions};cacheAt=Date.now();return cache;
  })().finally(()=>{loading=null});
  return loading;
}

function metric(label,value){const d=el('div','jf-race-week-metric');d.append(el('b','',String(value)),el('span','',label));return d}
function fuelStat(label,value){const d=el('span','');d.append(el('b','',String(Math.max(0,Number(value)||0))),document.createTextNode(label));return d}

function render(data,host,force=false){
  const existing=host.querySelector('.jf-race-week');
  if(!data?.race){existing?.remove();return}
  if(existing?.dataset.raceGoalId===String(data.race.race_goal_id)&&!force)return;
  existing?.remove();
  const{race,prep,fuel,sessions}=data;
  const card=el('section','jf-race-week');card.dataset.raceGoalId=String(race.race_goal_id);
  const head=el('div','jf-race-week-head');
  const headCopy=el('div','');headCopy.append(el('span','jf-race-week-kicker',Number(race.days_to_event)<=7?'RACE WEEK':'RACE EXECUTION'),el('h3','',race.event_name),el('p','',`${fmtDate(race.event_date)} · A race · ${race.days_to_event===0?'Race day':`${race.days_to_event} day${Number(race.days_to_event)===1?'':'s'} to go`}`));
  const count=el('div','jf-race-week-count',String(race.days_to_event));count.append(el('small','',race.days_to_event===0?'TODAY':'DAYS'));
  head.append(headCopy,count);card.append(head);

  if(prep){
    const progress=el('div','jf-race-week-progress');
    progress.append(metric('Key sessions',`${clampPct(prep.key_session_completion_pct)}%`),metric('8-week consistency',`${clampPct(prep.consistency_pct_8w)}%`),metric('Distance prep',`${clampPct(prep.distance_preparation_pct)}%`));
    card.append(progress);
  }

  if(sessions.length){
    const block=el('div','jf-race-week-block');block.append(el('span','jf-race-week-label','FINAL TRAINING'));
    const list=el('div','jf-race-week-sessions');
    for(const s of sessions){const row=el('div','jf-race-week-session');const copy=el('div','');copy.append(el('strong','',s.title),el('small','',`${fmtDate(s.session_date)} · ${mins(s.duration_minutes||s.planned_duration_minutes)}`));row.append(copy,s.is_key_session?el('b','jf-race-week-key','KEY'):el('b','',String(s.status||'planned').toUpperCase()));list.append(row)}
    block.append(list);card.append(block);
  }

  if(fuel){
    const block=el('div','jf-race-week-block');block.append(el('span','jf-race-week-label','RACE FUEL'));
    const stats=el('div','jf-race-week-fuel');
    stats.append(fuelStat('Bottle Mix',fuel.bottle_mix_sachets),fuelStat('Regular gels',fuel.regular_gels),fuelStat('Boost',fuel.boost_gels),fuelStat('Recover',fuel.post_race_recover_servings));
    block.append(stats);
    const target=el('p','jf-race-week-fuel-note',`${Number(fuel.carb_target_gph)||0} g carbs/hour · ${Number(fuel.hydration_ml_per_hour)||0} ml fluid/hour${Number(fuel.sodium_target_mg_per_hour)?` · ${Number(fuel.sodium_target_mg_per_hour)} mg sodium/hour`:''}`);block.append(target);card.append(block);
  }

  const checks=loadChecks(race.race_goal_id);const checkBlock=el('div','jf-race-week-block');checkBlock.append(el('span','jf-race-week-label','RACE-DAY CHECKLIST'));
  const checkList=el('div','jf-race-week-checks');
  const progressText=el('div','jf-race-week-ready-text');
  function updateProgress(){const done=CHECKS.filter(([id])=>checks[id]).length;progressText.textContent=`${done}/${CHECKS.length} ready`;card.classList.toggle('jf-race-week-ready',done===CHECKS.length)}
  for(const[id,label]of CHECKS){const button=el('button',checks[id]?'done':'');button.type='button';const mark=el('span','jf-race-week-check',checks[id]?'✓':'');button.append(mark,el('strong','',label));button.addEventListener('click',()=>{checks[id]=!checks[id];saveChecks(race.race_goal_id,checks);button.classList.toggle('done',checks[id]);mark.textContent=checks[id]?'✓':'';updateProgress();window.jfTrack?.('race_week_checklist_toggle',{item:id,checked:checks[id]},'race')});checkList.append(button)}
  checkBlock.append(checkList,progressText);card.append(checkBlock);updateProgress();

  const heading=host.querySelector('.race-v2-heading');if(heading?.nextSibling)host.insertBefore(card,heading.nextSibling);else host.prepend(card);
  window.jfTrack?.('race_week_execution_view',{race_goal_id:race.race_goal_id,days_to_race:race.days_to_event},'race');
}

async function scan(force=false){const host=document.querySelector('.race-v2-list');if(!host)return;const data=await load(force);render(data,host,force)}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force).catch(()=>{})},160)}
if(typeof window!=='undefined'){
  window.addEventListener('popstate',()=>queue());
  window.addEventListener('jf-training-plan-updated',()=>{cache=null;cacheAt=0;queue(true)});
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
