import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

const GOALS=[
  ['stronger','Get Stronger','Build sustainable power and FTP.'],
  ['power_to_weight','Power-to-Weight','Improve cycling performance while managing body mass sensibly.'],
  ['endurance_100k','100 km Race','Build endurance, pacing and fueling for a 100 km target.'],
  ['gravel_race','Gravel Race','Prepare for gravel-specific endurance, climbing and handling.'],
  ['stage_race','Stage Race','Build multi-day durability, fueling and recovery habits.']
];
const DAYS=[[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[7,'Sun']];
let queued=false, hostState=null;

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function fmtDate(v){if(!v)return'—';return new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`))}
function datePlus(days){const d=new Date();d.setDate(d.getDate()+days);const p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function goalInfo(key){return GOALS.find(x=>x[0]===key)||GOALS[0]}
function isRaceGoal(type){return ['endurance_100k','gravel_race','stage_race'].includes(type)}
function weeksTo(date){if(!date)return null;const today=new Date();today.setHours(0,0,0,0);const target=new Date(`${date}T12:00:00`);return Math.max(1,Math.ceil((target-today)/604800000))}
function refreshTraining(){
  window.dispatchEvent(new CustomEvent('jf-training-plan-updated'));
  const btn=document.querySelector('.training-page .training-header-actions button[aria-label="Refresh"]');
  if(btn)setTimeout(()=>btn.click(),120);
}
function isPlanOpen(){
  const active=document.querySelector('.training-page .app-shell .section-nav button.active');
  return active?.textContent.trim()==='My Plan';
}
function suitableRaces(races,goal){
  if(goal==='stage_race')return races.filter(r=>Number(r.stage_count||0)>1||r.is_stage_race||String(r.event_type||'').includes('stage'));
  if(goal==='gravel_race')return races.filter(r=>`${r.event_type||''} ${r.discipline||''} ${r.subdiscipline||''}`.toLowerCase().includes('gravel'));
  return races.filter(r=>String(r.sport_type||'cycling').toLowerCase().includes('cycl')||!r.sport_type);
}

async function loadData(){
  const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
  const uid=session.user.id;
  const[program,profile,races]=await Promise.all([
    sb.from('training_coach_programs').select('*').eq('user_id',uid).eq('status','active').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    sb.from('training_profiles').select('*').eq('user_id',uid).maybeSingle(),
    sb.from('athlete_season_events').select('*').eq('user_id',uid).gte('event_date',new Date().toISOString().slice(0,10)).order('event_date',{ascending:true})
  ]);
  return{uid,program:program.data||null,profile:profile.data||null,races:races.data||[],error:program.error||profile.error||races.error||null};
}

function makeInitial(data){
  const p=data.profile||{},program=data.program;
  const days=(p.available_weekdays?.length?p.available_weekdays:[2,4,6]).map(Number);
  return{
    editing:!program,
    goalType:program?.goal_type||'stronger',
    raceId:program?.race_goal_id||'',
    targetDate:program?.target_date||datePlus(84),
    targetWeight:program?.target_weight_kg||'',
    days,
    longDay:Number(p.long_session_weekday||days[days.length-1]||6),
    weekdayMinutes:Number(p.weekday_session_minutes||90),
    longMinutes:Number(p.long_session_max_minutes||300),
    busy:false,
    message:''
  };
}

function renderSummary(root,data,state){
  const program=data.program;if(!program)return;
  const card=el('section','jf-coach-summary');
  const top=el('div','jf-coach-summary-top');
  const copy=el('div');copy.append(el('span','jf-coach-kicker','AI TRAINING COACH'),el('h3','',program.goal_label));
  const race=data.races.find(r=>r.race_goal_id===program.race_goal_id);
  const meta=el('p','jf-coach-muted',`${race?.event_name?`${race.event_name} · `:''}${fmtDate(program.target_date)} · ${weeksTo(program.target_date)} week${weeksTo(program.target_date)===1?'':'s'} to target`);
  copy.append(meta);top.append(copy);
  const change=el('button','jf-coach-secondary','Change goal');change.type='button';change.addEventListener('click',()=>{state.editing=true;render(root,data,state)});top.append(change);card.append(top);
  const flow=el('div','jf-coach-flow');['TRAIN','FUEL','RECOVER'].forEach((x,i)=>{flow.append(el('span','',x));if(i<2)flow.append(el('b','','→'))});card.append(flow);
  card.append(el('p','jf-coach-foot','Your current sessions already include session-specific fuel and Recover prompts. Weather, readiness and post-session AI coaching will plug into this plan next.'));
  root.append(card);
}

function renderEditor(root,data,state){
  const box=el('section','jf-coach-builder');
  box.append(el('span','jf-coach-kicker','CREATE MY PLAN'),el('h2','','What do you want to train for?'),el('p','jf-coach-muted','Just Fuel will use your availability, current training history and target to build the plan.'));

  const goals=el('div','jf-coach-goals');
  for(const[g,title,desc]of GOALS){
    const b=el('button',`jf-coach-goal ${state.goalType===g?'active':''}`);b.type='button';b.append(el('strong','',title),el('small','',desc));b.addEventListener('click',()=>{state.goalType=g;if(!isRaceGoal(g))state.raceId='';render(root,data,state)});goals.append(b);
  }
  box.append(goals);

  if(isRaceGoal(state.goalType)){
    const target=el('div','jf-coach-block');target.append(el('h3','','Target event'));
    const select=document.createElement('select');select.className='jf-coach-select';
    const none=document.createElement('option');none.value='';none.textContent='No event yet — use target date';select.append(none);
    const candidates=suitableRaces(data.races,state.goalType);
    for(const r of candidates){const o=document.createElement('option');o.value=r.race_goal_id;o.textContent=`${r.event_name} · ${fmtDate(r.event_date)}`;select.append(o)}
    select.value=state.raceId;select.addEventListener('change',()=>{state.raceId=select.value;const r=data.races.find(x=>x.race_goal_id===state.raceId);if(r)state.targetDate=r.event_date;render(root,data,state)});target.append(select);
    if(!candidates.length)target.append(el('small','jf-coach-muted','No matching event is in My Races yet. You can still build toward a target date now.'));
    box.append(target);
  }

  if(!state.raceId){
    const dateWrap=el('label','jf-coach-field');dateWrap.append(el('span','','Target date'));
    const input=document.createElement('input');input.type='date';input.value=state.targetDate;input.min=datePlus(14);input.addEventListener('change',()=>state.targetDate=input.value);dateWrap.append(input);box.append(dateWrap);
  }

  if(state.goalType==='power_to_weight'){
    const weight=el('label','jf-coach-field');weight.append(el('span','','Target weight (kg) · optional'));
    const input=document.createElement('input');input.type='number';input.inputMode='decimal';input.min='40';input.max='200';input.step='0.1';input.value=state.targetWeight;input.placeholder='e.g. 90';input.addEventListener('input',()=>state.targetWeight=input.value);weight.append(input);box.append(weight);
  }

  const schedule=el('div','jf-coach-block');schedule.append(el('h3','','When can you train?'));
  const chips=el('div','jf-coach-days');
  for(const[d,name]of DAYS){const b=el('button',state.days.includes(d)?'active':'',name);b.type='button';b.addEventListener('click',()=>{if(state.days.includes(d))state.days=state.days.filter(x=>x!==d);else state.days=[...state.days,d].sort((a,b)=>a-b);if(!state.days.includes(state.longDay))state.longDay=state.days[state.days.length-1]||6;render(root,data,state)});chips.append(b)}
  schedule.append(chips);
  const grid=el('div','jf-coach-schedule-grid');
  const longLabel=el('label','jf-coach-field');longLabel.append(el('span','','Long ride day'));const longSelect=document.createElement('select');longSelect.className='jf-coach-select';for(const d of state.days){const o=document.createElement('option');o.value=d;o.textContent=DAYS.find(x=>x[0]===d)?.[1]||d;longSelect.append(o)}longSelect.value=state.longDay;longSelect.addEventListener('change',()=>state.longDay=Number(longSelect.value));longLabel.append(longSelect);grid.append(longLabel);
  const weekLabel=el('label','jf-coach-field');weekLabel.append(el('span','','Weekday session'));const weekSelect=document.createElement('select');weekSelect.className='jf-coach-select';[60,75,90,120].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=`${v} min`;weekSelect.append(o)});weekSelect.value=state.weekdayMinutes;weekSelect.addEventListener('change',()=>state.weekdayMinutes=Number(weekSelect.value));weekLabel.append(weekSelect);grid.append(weekLabel);
  const maxLabel=el('label','jf-coach-field');maxLabel.append(el('span','','Longest ride available'));const maxSelect=document.createElement('select');maxSelect.className='jf-coach-select';[[180,'3 h'],[240,'4 h'],[300,'5 h'],[360,'6 h+']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;maxSelect.append(o)});maxSelect.value=state.longMinutes;maxSelect.addEventListener('change',()=>state.longMinutes=Number(maxSelect.value));maxLabel.append(maxSelect);grid.append(maxLabel);
  schedule.append(grid);box.append(schedule);

  const note=el('div','jf-coach-note');note.innerHTML='<strong>What happens next</strong><span>Base → Build → Specific → Peak/Taper where needed. Every session gets a training prescription, fuel plan and recovery prompt.</span>';box.append(note);
  if(data.program)box.append(el('p','jf-coach-warning','Creating a new goal replaces the current active training plan. Your previous plan remains archived, not deleted.'));
  if(state.message)box.append(el('div',state.message.startsWith('✓')?'jf-coach-success':'jf-coach-error',state.message));

  const actions=el('div','jf-coach-actions');
  if(data.program){const cancel=el('button','jf-coach-secondary','Cancel');cancel.type='button';cancel.addEventListener('click',()=>{state.editing=false;state.message='';render(root,data,state)});actions.append(cancel)}
  const generate=el('button','jf-coach-primary',state.busy?'Building your plan…':'Build my training plan');generate.type='button';generate.disabled=state.busy;generate.addEventListener('click',()=>buildPlan(root,data,state));actions.append(generate);box.append(actions);
  root.append(box);
}

async function buildPlan(root,data,state){
  if(state.days.length<2){state.message='Choose at least two training days.';return render(root,data,state)}
  if(!state.raceId&&!state.targetDate){state.message='Choose a target date.';return render(root,data,state)}
  state.busy=true;state.message='';render(root,data,state);
  const payload={
    p_goal_type:state.goalType,
    p_target_date:state.raceId?null:state.targetDate,
    p_race_goal_id:state.raceId||null,
    p_target_weight_kg:state.targetWeight?Number(state.targetWeight):null,
    p_available_weekdays:state.days,
    p_long_session_weekday:Number(state.longDay),
    p_weekday_session_minutes:Number(state.weekdayMinutes),
    p_long_session_max_minutes:Number(state.longMinutes)
  };
  const{data:result,error}=await sb.rpc('start_training_coach_program',payload);
  state.busy=false;
  if(error){state.message=error.message||'Could not build the plan.';return render(root,data,state)}
  const fresh=await loadData();if(fresh){hostState={data:fresh,state:makeInitial(fresh)};hostState.state.editing=false;hostState.state.message='✓ Training plan created.';render(root,fresh,hostState.state)}
  refreshTraining();
  setTimeout(()=>refreshTraining(),900);
}

function render(root,data,state){
  root.replaceChildren();
  if(data.error){root.append(el('div','jf-coach-error',data.error.message||'Training Coach could not load.'));return}
  if(!state.editing&&data.program)renderSummary(root,data,state);else renderEditor(root,data,state);
}

async function mount(){
  if(!isPlanOpen())return;
  const main=document.querySelector('.training-page .app-shell main');if(!main)return;
  let root=main.querySelector(':scope > .jf-training-coach-host');
  if(root)return;
  root=el('div','jf-training-coach-host');main.prepend(root);
  root.append(el('div','jf-coach-loading','Loading Training Coach…'));
  const data=await loadData();if(!data){root.remove();return}
  const state=makeInitial(data);hostState={data,state};render(root,data,state);
}
function queue(){if(queued)return;queued=true;setTimeout(()=>{queued=false;mount().catch(()=>{})},100)}

if(typeof window!=='undefined'){
  window.addEventListener('load',queue);
  window.addEventListener('popstate',queue);
  window.addEventListener('jf-training-plan-updated',()=>{document.querySelector('.jf-training-coach-host')?.remove();queue()});
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
