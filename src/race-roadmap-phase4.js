import './race-roadmap-phase4.css';
import {createClient} from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false;
const dashboardCache=new Map();

function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node}
function n(v){return Number(v)||0}
function mins(v){const x=Math.max(0,Math.round(n(v))),h=Math.floor(x/60),m=x%60;return h?`${h}h${m?` ${m}m`:''}`:`${m}m`}
function compact(text,max=180){const value=String(text||'').trim();return value.length>max?`${value.slice(0,max-1).trim()}…`:value}
function titleCase(value){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
function selectMenu(){return document.querySelector('.race-v2-shell .race-v2-menu select')}
function hasOption(value){return Boolean([...selectMenu()?.options||[]].some(option=>option.value===value))}
function selectLegacy(value){const menu=selectMenu();if(!menu)return false;const option=[...menu.options].find(x=>x.value===value);if(!option)return false;menu.value=value;menu.dispatchEvent(new Event('change',{bubbles:true}));window.scrollTo({top:0,behavior:'smooth'});return true}
function planLegacyValue(){return hasOption('stages')?'stages':'water'}
function primaryGroup(value){if(value==='fuel')return'fuel';if(value==='checklist')return'checklist';if(['stages','water'].includes(value))return'plan';return'dashboard'}

function eventName(){return (document.querySelector('.race-v2-topbar strong')?.textContent||document.querySelector('.race-v2-hero h2')?.textContent||'').trim()}

async function loadDashboard(name){
  if(!name)return null;
  if(dashboardCache.has(name))return dashboardCache.get(name);
  const promise=(async()=>{
    const{data:{session}}=await sb.auth.getSession();
    if(!session?.user)return null;
    const uid=session.user.id;
    const[progressResult,readinessResult,eventResult]=await Promise.all([
      sb.rpc('get_race_goal_progress',{p_user_id:uid}),
      sb.rpc('get_training_readiness_insights',{p_user_id:uid}),
      sb.from('athlete_season_events').select('*').eq('user_id',uid).eq('status','active').eq('event_name',name).order('event_date',{ascending:true}).limit(1).maybeSingle()
    ]);
    const progressRaces=Array.isArray(progressResult.data?.races)?progressResult.data.races:[];
    const progress=progressRaces.find(r=>String(r.event_name||'').trim()===name)||null;
    const event=eventResult.data||null;
    const raceGoalId=event?.race_goal_id||progress?.race_goal_id||null;
    let stages=[],fuel=null;
    if(raceGoalId){
      const[stageResult,fuelResult]=await Promise.all([
        sb.from('race_stage_plans').select('id,stage_number,stage_name,pacing_notes,weather_notes,distance_km,elevation_m,estimated_duration_minutes').eq('user_id',uid).eq('race_goal_id',raceGoalId).order('stage_number',{ascending:true}).limit(3),
        sb.from('race_fuel_plan').select('*').eq('race_goal_id',raceGoalId).maybeSingle()
      ]);
      stages=stageResult.data||[];
      fuel=fuelResult.data||null;
    }
    return{event,progress,readiness:readinessResult.error?null:readinessResult.data||null,stages,fuel,raceGoalId};
  })().catch(()=>null);
  dashboardCache.set(name,promise);
  return promise;
}

function pacingSummary(event,stages){
  const stage=stages?.find(s=>String(s.pacing_notes||'').trim());
  if(stage?.pacing_notes)return compact(stage.pacing_notes);
  const distance=n(event?.distance_km),goal=n(event?.goal_time_minutes);
  if(distance>0&&goal>0){
    const sport=`${event?.sport_type||''} ${event?.event_type||''}`.toLowerCase();
    if(sport.includes('run')){
      const totalSeconds=(goal*60)/distance,mm=Math.floor(totalSeconds/60),ss=Math.round(totalSeconds%60);
      return `Goal average pace about ${mm}:${String(ss).padStart(2,'0')} /km across ${distance} km. Use Race Plan for terrain-specific pacing.`;
    }
    const speed=distance/(goal/60);
    return `Goal average speed about ${speed.toFixed(1)} km/h across ${distance} km. Use Race Plan for course-specific pacing.`;
  }
  return 'Open Race Plan for course-specific pacing and execution guidance.';
}

function conditionsSummary(stages){
  const stage=stages?.find(s=>String(s.weather_notes||'').trim());
  if(stage?.weather_notes)return compact(stage.weather_notes);
  return 'No race-specific conditions guidance is stored yet. Update the Race Plan when course or forecast information is available.';
}

function trendLabel(value){const v=String(value||'').toLowerCase();if(v==='improving')return'Improving';if(v==='declining')return'Declining';if(v==='steady')return'Steady';return'Building baseline'}

function metric(label,value,copy){const box=el('div','race-phase4-metric');box.append(el('span','',label),el('strong','',value),el('small','',copy));return box}
function infoBlock(label,title,copy){const box=el('div','race-phase4-info');box.append(el('span','eyebrow',label),el('h3','',title),el('p','',copy));return box}

function actionFor(data){
  const days=data?.event?.days_to_event!=null?n(data.event.days_to_event):null;
  if(!data?.fuel)return{label:'Set race fuel',target:'fuel',copy:'Lock in the race carb and hydration plan before the final execution details.'};
  if(hasOption('stages')&&!data?.stages?.length)return{label:'Build Race Plan',target:'stages',copy:'Build the stage-by-stage course, pacing and aid-point plan next.'};
  if(days!=null&&days<=7)return{label:'Review checklist',target:'checklist',copy:'Race week is close. Confirm equipment, logistics, fuel and hydration.'};
  return{label:'Open Race Plan',target:planLegacyValue(),copy:'Review pacing, route details, stages and water points.'};
}

async function enhanceDashboard(){
  const menu=selectMenu();if(!menu||menu.value!=='overview')return;
  const hero=document.querySelector('.race-v2-shell .race-v2-hero');if(!hero)return;
  hero.classList.add('race-phase4-dashboard');
  const eyebrow=hero.querySelector('.eyebrow');if(eyebrow)eyebrow.textContent='RACE DASHBOARD';
  const oldType=[...hero.parentElement?.children||[]].find(node=>node!==hero&&node.classList?.contains('card')&&node.querySelector?.('.eyebrow')?.textContent.trim()==='EVENT TYPE');
  oldType?.classList.add('race-phase4-event-type-card');
  const name=eventName();
  let card=hero.parentElement?.querySelector('.race-phase4-intelligence');
  if(!card){card=el('section','card race-phase4-intelligence');card.dataset.raceName=name;card.append(el('p','muted race-phase4-loading','Loading race preparation, readiness and execution…'));hero.after(card)}
  if(card.dataset.loaded==='1'||card.dataset.loading==='1')return;
  card.dataset.loading='1';
  const data=await loadDashboard(name);
  if(!document.body.contains(card))return;
  card.innerHTML='';card.dataset.loading='0';card.dataset.loaded='1';
  if(!data){card.append(el('p','muted','Race intelligence is not available yet. Your Race Plan, Fuel and Checklist remain available below.'));return}
  const prep=data.progress||{};
  const readiness=data.readiness?.summary||{};
  const score=prep.score!=null?`${Math.round(n(prep.score))}/100`:'—';
  const readinessScore=readiness.avg_7d!=null?`${Math.round(n(readiness.avg_7d))}/100`:'—';
  const goal=data.event?.goal_time_minutes?mins(data.event.goal_time_minutes):'No goal set';
  const type=data.event?.stage_count>1?`${n(data.event.stage_count)}-stage event`:titleCase(data.event?.event_type||data.event?.sport_type||'Race');
  const grid=el('div','race-phase4-metric-grid');
  grid.append(
    metric('Preparation',score,prep.status||'Building race preparation'),
    metric('Readiness',readinessScore,trendLabel(readiness.trend)),
    metric('Goal',goal,type)
  );
  card.append(grid);
  const detail=el('div','race-phase4-detail-grid');
  detail.append(
    infoBlock('PACING','Execution summary',pacingSummary(data.event,data.stages)),
    infoBlock('RACE CONDITIONS','Conditions guidance',conditionsSummary(data.stages))
  );
  card.append(detail);
  if(prep.coach_priority_copy){card.append(infoBlock('COACH PRIORITY',titleCase(prep.coach_priority||'Next focus'),compact(prep.coach_priority_copy,230)))}
  const action=actionFor(data),next=el('div','race-phase4-next');const copy=el('div','');copy.append(el('span','eyebrow','NEXT ACTION'),el('strong','',action.label),el('p','',action.copy));const button=el('button','primary',action.label);button.type='button';button.addEventListener('click',()=>selectLegacy(action.target));next.append(copy,button);card.append(next);
  const note=el('small','race-phase4-data-note','Readiness and preparation are coaching signals from your recent training and check-ins, not a prediction of race result. Conditions are saved race-plan guidance unless a live forecast is explicitly shown.');card.append(note);
}

function installPrimaryNav(){
  const shell=document.querySelector('.race-v2-shell');const top=shell?.querySelector('.race-v2-topbar');const menu=selectMenu();if(!shell||!top||!menu)return;
  const value=menu.value,group=primaryGroup(value);
  let link=shell.querySelector('.race-phase4-dashboard-link');
  if(!link){link=el('button','race-phase4-dashboard-link','Race dashboard');link.type='button';link.addEventListener('click',()=>selectLegacy('overview'));top.after(link)}
  link.classList.toggle('active',group==='dashboard');
  let nav=shell.querySelector('.race-phase4-primary-nav');
  if(!nav){nav=el('nav','race-phase4-primary-nav');nav.setAttribute('aria-label','Race sections');for(const[item,labelText]of[['plan','Race Plan'],['fuel','Fuel'],['checklist','Checklist']]){const button=el('button','',labelText);button.type='button';button.dataset.racePhase4=item;button.addEventListener('click',()=>selectLegacy(item==='plan'?planLegacyValue():item));nav.append(button)}link.after(nav)}
  for(const button of nav.querySelectorAll('button'))button.classList.toggle('active',button.dataset.racePhase4===group);
}

async function enhancePlan(){
  const menu=selectMenu();if(!menu||!['stages','water'].includes(menu.value))return;
  const shell=document.querySelector('.race-v2-shell');if(!shell)return;
  const currentContent=[...shell.children].find(node=>node.classList?.contains('stack')&&node.querySelector?.('.card'));
  if(!currentContent)return;
  let intro=currentContent.querySelector('.race-phase4-plan-intro');
  if(!intro){
    intro=el('section','card race-phase4-plan-intro');
    intro.append(el('span','eyebrow','RACE PLAN'),el('h2','',eventName()),el('p','muted','Course execution, pacing, stages and water points live together here.'));
    if(hasOption('stages')){
      const sub=el('div','race-phase4-plan-tabs');
      for(const[value,text]of[['stages','Stages'],['water','Water Points']]){const button=el('button','',text);button.type='button';button.dataset.target=value;button.addEventListener('click',()=>selectLegacy(value));sub.append(button)}
      intro.append(sub);
    }
    currentContent.prepend(intro);
  }
  for(const button of intro.querySelectorAll('.race-phase4-plan-tabs button'))button.classList.toggle('active',button.dataset.target===menu.value);
  if(menu.value==='water'&&!hasOption('stages')&&!currentContent.querySelector('.race-phase4-single-plan')){
    const host=el('section','card race-phase4-single-plan');host.append(el('p','muted','Loading execution summary…'));intro.after(host);
    const data=await loadDashboard(eventName());if(!document.body.contains(host))return;host.innerHTML='';
    if(data){host.append(infoBlock('PACING','Execution summary',pacingSummary(data.event,data.stages)),infoBlock('RACE CONDITIONS','Conditions guidance',conditionsSummary(data.stages)))}
    else host.append(el('p','muted','Execution guidance will appear when the race plan has enough event data.'));
  }
}

function simplifyRaceList(){
  const heading=document.querySelector('.race-v2-list .race-v2-heading p');if(heading)heading.textContent='Choose a race to open its dashboard, plan, fuel and checklist.';
}

async function apply(){
  const shell=document.querySelector('.race-v2-shell');if(!shell)return;
  simplifyRaceList();
  installPrimaryNav();
  await enhanceDashboard();
  await enhancePlan();
}
function queue(){if(queued)return;queued=true;setTimeout(()=>{queued=false;apply().catch(()=>{})},90)}
function invalidate(){dashboardCache.clear();document.querySelectorAll('.race-phase4-intelligence').forEach(x=>x.remove());queue()}

if(typeof window!=='undefined'){
  window.addEventListener('load',queue);
  window.addEventListener('popstate',queue);
  ['jf-training-plan-updated','jf-training-feedback-saved','jf-recovery-logged','jf-readiness-saved','jf-strava-synced'].forEach(name=>window.addEventListener(name,invalidate));
  const start=()=>{if(!document.body)return;new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length||r.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
