import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ChevronRight,Droplets,Flag,Fuel,MapPin,Mountain,Plus,RefreshCw,Search,ShieldCheck,Timer,Trash2} from 'lucide-react';
import {supabase} from './main';
import StageRacePlanner from './StageRacePlannerV2';

const SPORTS=[['all','All sports'],['cycling','Cycling'],['running','Running'],['multisport','Triathlon'],['hyrox','HYROX']];
const DISCIPLINES=[['all','All disciplines'],['road_cycling','Road cycling'],['mountain_bike','Mountain bike'],['gravel','Gravel'],['time_trial','Time trial'],['stage_racing','Stage racing'],['road_running','Road running'],['trail_running','Trail running'],['ultra_running','Ultra running'],['triathlon','Triathlon'],['hyrox','HYROX']];
const PROVINCES=['All provinces','Western Cape','Eastern Cape','Northern Cape','KwaZulu-Natal','Gauteng','Free State','North West','Mpumalanga','Limpopo'];

function dateKey(){const d=new Date(),p=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function fmtDate(v){if(!v)return'—';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${String(v).slice(0,10)}T12:00:00`))}
function mins(v){const n=Math.max(0,Math.round(Number(v)||0)),h=Math.floor(n/60),m=n%60;return h?`${h}h${m?` ${m}m`:''}`:`${m}m`}
function label(v){return String(v||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
function isStageRace(r){const text=`${r?.event_type||''} ${r?.discipline||''} ${r?.subdiscipline||''}`.toLowerCase();return Boolean(r?.multi_day)||Number(r?.stage_count||0)>1||text.includes('stage')}
function daysTo(date){if(!date)return null;const now=new Date();now.setHours(0,0,0,0);const target=new Date(`${String(date).slice(0,10)}T12:00:00`);return Math.max(0,Math.ceil((target-now)/86400000))}

export default function RaceHubV2({races=[],userId,reload}){
  const[page,setPage]=useState('races');
  const[selectedId,setSelectedId]=useState(()=>races[0]?.race_goal_id||'');
  const[selectedStageId,setSelectedStageId]=useState('');
  const[status,setStatus]=useState('');
  const[loading,setLoading]=useState(false);
  const selectedRace=useMemo(()=>races.find(r=>r.race_goal_id===selectedId)||races[0]||null,[races,selectedId]);

  useEffect(()=>{if(races.length&&!races.some(r=>r.race_goal_id===selectedId))setSelectedId(races[0].race_goal_id)},[races,selectedId]);
  useEffect(()=>{setSelectedStageId('')},[selectedId]);

  function openRace(race){setSelectedId(race.race_goal_id);setPage('overview');window.scrollTo({top:0,behavior:'smooth'})}
  function back(){if(page==='stage'){setPage('stages');setSelectedStageId('')}else if(page!=='races')setPage('races')}

  async function removeRace(race){
    if(!confirm(`Remove ${race.event_name} from My Races?`))return;
    setLoading(true);setStatus('Removing race and rebuilding your plan…');
    const{error}=await supabase.from('race_goals').update({status:'archived'}).eq('id',race.race_goal_id).eq('user_id',userId);
    if(!error)await supabase.rpc('generate_season_training_plan');
    if(error)setStatus(error.message);else{setStatus('Race removed.');await reload({keepMessage:true});setPage('races')}
    setLoading(false);
  }

  async function changePriority(race,value){
    const{error}=await supabase.from('race_goals').update({priority:value}).eq('id',race.race_goal_id).eq('user_id',userId);
    if(error)return setStatus(error.message);
    await supabase.rpc('generate_season_training_plan');
    await reload({keepMessage:true});
  }

  return <div className="race-v2-shell">
    {page==='races'?<MyRaces races={races} onOpen={openRace} onAdd={()=>setPage('registry')} onRemove={removeRace} onPriority={changePriority} loading={loading} status={status}/>:page==='registry'?<EventRegistry reload={reload} onDone={()=>setPage('races')} onBack={back}/>:selectedRace?<>
      <RaceTopbar race={selectedRace} page={page} onBack={back}/>
      {page!=='stage'&&<RaceMenu race={selectedRace} value={page} onChange={setPage}/>} 
      {page==='overview'&&<RaceOverview race={selectedRace}/>} 
      {page==='stages'&&<RaceStages race={selectedRace} onOpenStage={id=>{setSelectedStageId(id);setPage('stage')}}/>}
      {page==='stage'&&<RaceStageDetail race={selectedRace} stageId={selectedStageId}/>} 
      {page==='fuel'&&<RaceFuelHydration race={selectedRace}/>} 
      {page==='water'&&<RaceWaterPoints race={selectedRace}/>} 
      {page==='checklist'&&<RaceChecklist race={selectedRace}/>} 
    </>:<section className="card empty"><Flag size={30}/><p>No race selected.</p></section>}
  </div>
}

function MyRaces({races,onOpen,onAdd,onRemove,onPriority,loading,status}){
  const upcoming=[...races].sort((a,b)=>String(a.event_date||'').localeCompare(String(b.event_date||'')));
  return <div className="stack race-v2-list">
    <section className="race-v2-heading"><div><span className="eyebrow">RACE</span><h2>My Races</h2><p>Choose a race to open its plan. Add new events from the Event Registry.</p></div><button className="primary race-v2-add" onClick={onAdd}><Plus size={17}/>Add Event</button></section>
    {status&&<div className="notice">{status}</div>}
    {!upcoming.length&&<section className="card empty"><Flag size={30}/><p>No races added yet.</p><button className="primary" onClick={onAdd}>Open Event Registry</button></section>}
    <div className="race-v2-cards">{upcoming.map(r=><article className="race-v2-card" key={r.race_goal_id}>
      <button className="race-v2-card-main" onClick={()=>onOpen(r)}>
        <div className="race-v2-date"><strong>{fmtDate(r.event_date)}</strong><span>{daysTo(r.event_date)} days</span></div>
        <div className="race-v2-card-copy"><h3>{r.event_name}</h3><p>{[label(r.event_type||r.discipline),r.distance_km?`${r.distance_km} km`:null,r.elevation_m?`${Math.round(r.elevation_m)} m`:null,isStageRace(r)&&r.stage_count?`${r.stage_count} stages`:null].filter(Boolean).join(' · ')}</p></div><ChevronRight size={20}/>
      </button>
      <div className="race-v2-card-actions"><label>Priority<select value={r.priority||'B'} onChange={e=>onPriority(r,e.target.value)}><option>A</option><option>B</option><option>C</option></select></label><button className="secondary compact danger" disabled={loading} onClick={()=>onRemove(r)}><Trash2 size={15}/>Remove</button></div>
    </article>)}</div>
  </div>
}

function EventRegistry({reload,onDone,onBack}){
  const[catalog,setCatalog]=useState([]),[search,setSearch]=useState(''),[sport,setSport]=useState('all'),[discipline,setDiscipline]=useState('all'),[province,setProvince]=useState('All provinces'),[selected,setSelected]=useState(null),[routes,setRoutes]=useState([]),[routeId,setRouteId]=useState(''),[priority,setPriority]=useState('B'),[goalTime,setGoalTime]=useState(''),[status,setStatus]=useState(''),[loading,setLoading]=useState(false);
  async function loadCatalog(){const{data,error}=await supabase.from('event_catalog_search').select('*').gte('start_date',dateKey()).order('start_date',{ascending:true}).limit(1200);if(error)setStatus(error.message);else setCatalog(data||[])}
  useEffect(()=>{loadCatalog()},[]);
  const grouped=useMemo(()=>{const map=new Map();for(const row of catalog){if(!map.has(row.event_id))map.set(row.event_id,{...row,routes:[]});if(row.route_id)map.get(row.event_id).routes.push(row)}return[...map.values()]},[catalog]);
  const filtered=useMemo(()=>grouped.filter(e=>{const q=search.trim().toLowerCase();return(!q||`${e.event_name} ${e.city||''} ${e.province||''}`.toLowerCase().includes(q))&&(sport==='all'||e.sport_category===sport)&&(discipline==='all'||e.discipline===discipline)&&(province==='All provinces'||e.province===province)}).slice(0,120),[grouped,search,sport,discipline,province]);
  async function choose(e){setSelected(e);setPriority('B');setGoalTime('');setRouteId(e.routes?.[0]?.route_id||'');const{data}=await supabase.from('event_catalog_search').select('*').eq('event_id',e.event_id).order('distance_km',{ascending:true});setRoutes(data||[]);setRouteId(data?.[0]?.route_id||'')}
  async function add(){if(!selected)return;setLoading(true);setStatus('Adding event and rebuilding your plan…');const{error}=await supabase.rpc('add_catalog_event_to_season',{p_event_id:selected.event_id,p_route_id:routeId||null,p_priority:priority,p_goal_time_minutes:goalTime?Number(goalTime):null});if(error)setStatus(error.message);else{const built=await supabase.rpc('generate_season_training_plan');if(built.error)setStatus(`Event added, but the plan could not rebuild: ${built.error.message}`);else{await reload({keepMessage:true});onDone()}}setLoading(false)}
  return <div className="stack race-registry-v2">
    <button className="race-v2-back" onClick={onBack}><ArrowLeft size={18}/>My Races</button>
    <section className="card"><span className="eyebrow">EVENT REGISTRY</span><h2>Find an event</h2><div className="event-search"><Search size={18}/><input placeholder="Search event, city or province" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="race-registry-filters"><select value={sport} onChange={e=>setSport(e.target.value)}>{SPORTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select value={discipline} onChange={e=>setDiscipline(e.target.value)}>{DISCIPLINES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><select value={province} onChange={e=>setProvince(e.target.value)}>{PROVINCES.map(v=><option key={v}>{v}</option>)}</select></div></section>
    {status&&<div className="notice">{status}</div>}
    {selected&&<section className="card race-registry-selected"><span className="eyebrow">ADD TO MY RACES</span><h3>{selected.event_name}</h3><p className="muted">{fmtDate(selected.start_date)}{selected.city?` · ${selected.city}`:''}</p>{routes.length>1&&<label>Route<select value={routeId} onChange={e=>setRouteId(e.target.value)}>{routes.map(r=><option value={r.route_id} key={r.route_id}>{r.route_name||`${r.distance_km||''} km`}</option>)}</select></label>}<div className="race-registry-add-grid"><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option>A</option><option>B</option><option>C</option></select></label><label>Goal time (minutes)<input inputMode="numeric" value={goalTime} onChange={e=>setGoalTime(e.target.value.replace(/\D/g,''))} placeholder="Optional"/></label></div><button className="primary" disabled={loading} onClick={add}>{loading?'Adding…':'Add event'}</button></section>}
    <div className="race-registry-results">{filtered.map(e=><button className="race-registry-result" key={e.event_id} onClick={()=>choose(e)}><div><strong>{e.event_name}</strong><small>{fmtDate(e.start_date)} · {label(e.discipline)}{e.city?` · ${e.city}`:''}</small></div><ChevronRight size={18}/></button>)}</div>
  </div>
}

function RaceTopbar({race,page,onBack}){return <div className="race-v2-topbar"><button onClick={onBack}><ArrowLeft size={18}/></button><div><span>{page==='stage'?'STAGE':'RACE'}</span><strong>{race.event_name}</strong></div></div>}

function RaceMenu({race,value,onChange}){
  const options=[['overview','Overview'],...(isStageRace(race)?[['stages','Stages']]:[]),['fuel','Fuel & Hydration'],['water','Water Points'],['checklist','Checklist']];
  return <label className="race-v2-menu">Race menu<select value={value} onChange={e=>onChange(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
}

function RaceOverview({race}){
  return <div className="stack"><section className="card race-v2-hero"><span className="eyebrow">RACE OVERVIEW</span><h2>{race.event_name}</h2><div className="race-v2-countdown"><strong>{daysTo(race.event_date)}</strong><span>days to race</span></div><div className="race-v2-metrics"><div><Flag/><b>{fmtDate(race.event_date)}</b><span>Date</span></div><div><Mountain/><b>{race.distance_km?`${race.distance_km} km`:'—'}</b><span>Distance</span></div><div><Mountain/><b>{race.elevation_m?`${Math.round(race.elevation_m)} m`:'—'}</b><span>Climbing</span></div><div><Timer/><b>{race.goal_time_minutes?mins(race.goal_time_minutes):'—'}</b><span>Goal time</span></div></div></section><section className="card"><span className="eyebrow">RACE TYPE</span><h3>{isStageRace(race)?'Stage race':'Single-day race'}</h3><p className="muted">{isStageRace(race)?'Open Stages for day-by-day execution, recovery and aid-point planning.':'Use Fuel & Hydration, Water Points and Checklist to prepare the complete event.'}</p></section></div>
}

function RaceStages({race,onOpenStage}){
  const[stages,setStages]=useState([]),[loading,setLoading]=useState(false),[message,setMessage]=useState('');
  async function load(){setLoading(true);const{data:{session}}=await supabase.auth.getSession();if(!session?.user){setLoading(false);return}const{data,error}=await supabase.from('race_stage_plans').select('*').eq('user_id',session.user.id).eq('race_goal_id',race.race_goal_id).order('stage_number');if(error)setMessage(error.message);else setStages(data||[]);setLoading(false)}
  useEffect(()=>{load()},[race.race_goal_id]);
  async function build(){setLoading(true);setMessage('Updating official stages from your course and training history…');const{data,error}=await supabase.rpc('build_personalized_stage_plan',{p_race_goal_id:race.race_goal_id});if(error)setMessage(error.message);else{setMessage(`${data||0} stages updated.`);await load()}setLoading(false)}
  return <div className="stack"><section className="card row-between race-stage-summary"><div><span className="eyebrow">STAGES</span><h3>{stages.length||race.stage_count||'—'} stages</h3></div><button className="secondary" disabled={loading} onClick={build}><RefreshCw size={16}/>Update official stages</button></section>{message&&<div className="notice">{message}</div>}<div className="race-stage-list-v2">{stages.map(s=><button key={s.id} className="race-stage-row-v2" onClick={()=>onOpenStage(s.id)}><span className="race-stage-number-v2">{s.stage_number}</span><div><strong>{s.stage_name||`Stage ${s.stage_number}`}</strong><small>{fmtDate(s.stage_date)} · {[s.distance_km?`${s.distance_km} km`:null,s.elevation_m?`${Math.round(s.elevation_m)} m`:null,s.estimated_duration_minutes?mins(s.estimated_duration_minutes):null].filter(Boolean).join(' · ')}</small><em>{s.start_location&&s.finish_location?`${s.start_location} → ${s.finish_location}`:s.finish_location||''}</em></div><ChevronRight size={18}/></button>)}</div>{!stages.length&&!loading&&<section className="card empty"><Flag size={28}/><p>No stage plan loaded yet.</p><button className="primary" onClick={build}>Build stage plan</button></section>}<details className="race-advanced-editor"><summary>Advanced stage editor</summary><StageRacePlanner race={race}/></details></div>
}

function RaceStageDetail({race,stageId}){
  const[stage,setStage]=useState(null),[points,setPoints]=useState([]),[loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{setLoading(true);const{data:{session}}=await supabase.auth.getSession();if(!session?.user){setLoading(false);return}const[s,p]=await Promise.all([supabase.from('race_stage_plans').select('*').eq('id',stageId).eq('user_id',session.user.id).maybeSingle(),supabase.from('race_stage_aid_points').select('*').eq('stage_id',stageId).eq('user_id',session.user.id).order('point_number')]);setStage(s.data||null);setPoints(p.data||[]);setLoading(false)})()},[stageId]);
  if(loading)return<section className="card empty"><RefreshCw size={24}/><p>Loading stage…</p></section>;
  if(!stage)return<section className="card empty"><p>Stage not found.</p></section>;
  return <div className="stack race-stage-detail-v2"><section className="card race-stage-detail-hero"><span className="eyebrow">STAGE {stage.stage_number}</span><h2>{stage.stage_name||`Stage ${stage.stage_number}`}</h2><p className="muted">{fmtDate(stage.stage_date)}{stage.start_location&&stage.finish_location?` · ${stage.start_location} → ${stage.finish_location}`:''}</p><div className="race-v2-metrics"><div><Mountain/><b>{stage.distance_km?`${stage.distance_km} km`:'—'}</b><span>Distance</span></div><div><Mountain/><b>{stage.elevation_m?`${Math.round(stage.elevation_m)} m`:'—'}</b><span>Climbing</span></div><div><Timer/><b>{stage.estimated_duration_minutes?mins(stage.estimated_duration_minutes):'—'}</b><span>Estimated</span></div><div><MapPin/><b>{stage.overnight_location||stage.finish_location||'—'}</b><span>Finish</span></div></div></section><section className="card"><span className="eyebrow">FUEL & HYDRATION</span><div className="race-v2-fuel-grid"><span><b>{stage.carb_target_gph||'—'}</b>g carbs/h</span><span><b>{stage.fluid_ml_per_hour||'—'}</b>ml/h</span><span><b>{stage.sodium_mg_per_hour||'—'}</b>mg sodium/h</span><span><b>{stage.bottle_mix_sachets||0}</b>Bottle Mix</span><span><b>{stage.regular_gels||0}</b>Gels</span><span><b>{stage.boost_gels||0}</b>Boost</span></div></section><section className="card"><span className="eyebrow">COACH PLAN</span><Info title="Pacing" text={stage.pacing_notes}/><Info title="Conditions" text={stage.weather_notes}/><Info title="Before stage" text={stage.pre_stage_notes}/><Info title="Recovery" text={stage.recovery_notes}/><Info title="Bike / equipment" text={stage.equipment_notes}/><Info title="Logistics" text={stage.logistics_notes}/></section><section className="card"><span className="eyebrow">WATER POINTS</span>{points.length?points.map(p=><div className="race-water-row" key={p.id}><MapPin size={17}/><div><strong>{p.name||`Water Point ${p.point_number}`}</strong><small>{p.distance_km?`${p.distance_km} km`:''}{p.cutoff_time?` · cutoff ${p.cutoff_time}`:''}</small><p>{[p.water_available?'Water':null,p.bottle_refill?'Bottle refill':null,p.food_available?'Food':null,p.technical_support?'Technical':null,p.drop_bag?'Drop bag':null].filter(Boolean).join(' · ')||'Support details pending'}</p></div></div>):<p className="muted">Official water-point locations have not been added for this stage yet.</p>}</section></div>
}
function Info({title,text}){if(!text)return null;return <div className="race-coach-note"><span>{title}</span><p>{text}</p></div>}

function RaceFuelHydration({race}){
  const[plan,setPlan]=useState(null),[timeline,setTimeline]=useState([]),[loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{setLoading(true);const[p,t]=await Promise.all([supabase.from('race_fuel_plan').select('*').eq('race_goal_id',race.race_goal_id).maybeSingle(),supabase.from('race_fuel_timeline').select('*').eq('race_goal_id',race.race_goal_id).order('sort_order')]);setPlan(p.data||null);setTimeline(t.data||[]);setLoading(false)})()},[race.race_goal_id]);
  if(loading)return<section className="card empty"><p>Loading fuel plan…</p></section>;
  if(!plan)return<section className="card empty"><Fuel size={28}/><p>No race fuel plan yet.</p></section>;
  return <div className="stack"><section className="card"><span className="eyebrow">FUEL & HYDRATION</span><h2>{plan.carb_target_gph||0} g/h</h2><div className="race-v2-fuel-grid"><span><b>{mins(plan.race_duration_minutes)}</b>Estimated</span><span><b>{plan.carb_target_g_total||0} g</b>Total carbs</span><span><b>{plan.hydration_ml_per_hour||0}</b>ml/h</span><span><b>{plan.sodium_target_mg_per_hour||0}</b>mg sodium/h</span><span><b>{plan.bottle_mix_sachets||0}</b>Bottle Mix</span><span><b>{plan.regular_gels||0}</b>Gels</span><span><b>{plan.boost_gels||0}</b>Boost</span><span><b>{plan.post_race_recover_servings||0}</b>Recover</span></div></section>{timeline.length>0&&<section className="card"><span className="eyebrow">EXECUTION TIMELINE</span><div className="race-fuel-timeline-v2">{timeline.map(t=><div key={`${t.sort_order}-${t.minute_mark}`}><b>{t.minute_mark===0?'Start':`${t.minute_mark} min`}</b><p>{t.instruction}</p></div>)}</div></section>}</div>
}

function RaceWaterPoints({race}){
  const[stages,setStages]=useState([]),[points,setPoints]=useState([]),[loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{setLoading(true);const{data:{session}}=await supabase.auth.getSession();if(!session?.user){setLoading(false);return}const[s,p]=await Promise.all([supabase.from('race_stage_plans').select('id,stage_number,stage_name').eq('race_goal_id',race.race_goal_id).eq('user_id',session.user.id).order('stage_number'),supabase.from('race_stage_aid_points').select('*').eq('race_goal_id',race.race_goal_id).eq('user_id',session.user.id).order('point_number')]);setStages(s.data||[]);setPoints(p.data||[]);setLoading(false)})()},[race.race_goal_id]);
  if(loading)return<section className="card empty"><p>Loading water points…</p></section>;
  return <div className="stack">{stages.length?stages.map(s=>{const ps=points.filter(p=>p.stage_id===s.id);return <section className="card" key={s.id}><span className="eyebrow">STAGE {s.stage_number}</span><h3>{s.stage_name||`Stage ${s.stage_number}`}</h3>{ps.length?ps.map(p=><div className="race-water-row" key={p.id}><MapPin size={17}/><div><strong>{p.name||`Water Point ${p.point_number}`}</strong><small>{p.distance_km?`${p.distance_km} km`:''}{p.cutoff_time?` · cutoff ${p.cutoff_time}`:''}</small><p>{[p.water_available?'Water':null,p.bottle_refill?'Refill':null,p.food_available?'Food':null,p.technical_support?'Technical':null,p.drop_bag?'Drop bag':null].filter(Boolean).join(' · ')||'Details pending'}</p></div></div>):<p className="muted">Official water points pending.</p>}</section>}):<section className="card"><span className="eyebrow">WATER POINTS</span><p className="muted">No stage-specific aid points are stored yet. For a single-day race, add official aid stations when they are published.</p></section>}</div>
}

function RaceChecklist({race}){
  const[plan,setPlan]=useState(null),[checked,setChecked]=useState({});
  useEffect(()=>{supabase.from('race_fuel_plan').select('*').eq('race_goal_id',race.race_goal_id).maybeSingle().then(({data})=>setPlan(data||null));try{setChecked(JSON.parse(localStorage.getItem(`jf-race-checklist-v2-${race.race_goal_id}`)||'{}'))}catch{setChecked({})}},[race.race_goal_id]);
  const items=[['entry','Entry confirmation / race number / timing chip'],['bike','Bike checked, tyres and repair kit'],['kit','Helmet, shoes, race kit and weather layers'],['travel','Travel, accommodation and start logistics'],['water','Water-point / refill plan confirmed'],...(plan?.pre_race_hydrate_servings?[['hydrate',`${plan.pre_race_hydrate_servings} pre-race Hydrate serving(s)`]]:[]),...(plan?.bottle_mix_sachets?[['mix',`${plan.bottle_mix_sachets} Bottle Mix sachet(s)`]]:[]),...(plan?.regular_gels?[['gels',`${plan.regular_gels} regular gels`]]:[]),...(plan?.boost_gels?[['boost',`${plan.boost_gels} Boost gels`]]:[]),...(plan?.post_race_recover_servings?[['recover','Recover packed for after the finish']]:[])];
  function toggle(k){setChecked(v=>{const next={...v,[k]:!v[k]};localStorage.setItem(`jf-race-checklist-v2-${race.race_goal_id}`,JSON.stringify(next));return next})}
  return <section className="card"><div className="row-between"><div><span className="eyebrow">CHECKLIST</span><h3>Race-day preparation</h3></div><ShieldCheck size={24}/></div><div className="race-checklist-v2">{items.map(([k,text])=><button key={k} className={checked[k]?'checked':''} onClick={()=>toggle(k)}><span>{checked[k]?'✓':''}</span><b>{text}</b></button>)}</div></section>
}
