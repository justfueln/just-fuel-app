import React,{useEffect,useMemo,useState} from 'react';
import {ChevronDown,ChevronUp,Droplets,Edit3,Flag,MapPin,Mountain,Plus,RefreshCw,Save,Timer,Trash2,Utensils,Wrench,Zap} from 'lucide-react';
import {supabase} from './main';

const n=v=>Number(v)||0;
const intOrNull=v=>v===''||v==null?null:Math.max(0,Math.round(Number(v)||0));
const numOrNull=v=>v===''||v==null?null:Math.max(0,Number(v)||0);
const fmtDate=v=>v?new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${v}T12:00:00`)):'Date TBC';
const duration=v=>{const m=Math.max(0,Math.round(n(v))),h=Math.floor(m/60),r=m%60;return h?`${h}h${r?` ${r}m`:''}`:`${r}m`};
function addDays(date,days){if(!date)return null;const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function knownStageCount(race){
  if(n(race?.stage_count)>1)return Math.round(n(race.stage_count));
  if(race?.catalog_start_date&&race?.catalog_end_date){const a=new Date(`${race.catalog_start_date}T12:00:00`),b=new Date(`${race.catalog_end_date}T12:00:00`);const days=Math.round((b-a)/(86400000))+1;if(days>1&&days<=30)return days}
  return 0;
}
function isStageRace(race){const text=`${race?.event_type||''} ${race?.discipline||''} ${race?.subdiscipline||''}`.toLowerCase();return Boolean(race?.multi_day)||n(race?.stage_count)>1||text.includes('stage')}
function stagePayload(s,userId,raceGoalId){return{
  id:s.id,user_id:userId,race_goal_id:raceGoalId,stage_number:Math.max(1,Math.round(n(s.stage_number))),stage_date:s.stage_date||null,stage_name:s.stage_name||null,start_time:s.start_time||null,distance_km:numOrNull(s.distance_km),elevation_m:numOrNull(s.elevation_m),terrain:s.terrain||null,estimated_duration_minutes:intOrNull(s.estimated_duration_minutes),cutoff_time:s.cutoff_time||null,start_location:s.start_location||null,finish_location:s.finish_location||null,overnight_location:s.overnight_location||null,carb_target_gph:intOrNull(s.carb_target_gph),fluid_ml_per_hour:intOrNull(s.fluid_ml_per_hour),sodium_mg_per_hour:intOrNull(s.sodium_mg_per_hour),bottle_mix_sachets:intOrNull(s.bottle_mix_sachets)||0,regular_gels:intOrNull(s.regular_gels)||0,boost_gels:intOrNull(s.boost_gels)||0,hydrate_servings:intOrNull(s.hydrate_servings)||0,recover_servings:intOrNull(s.recover_servings)||0,pre_stage_notes:s.pre_stage_notes||null,pacing_notes:s.pacing_notes||null,recovery_notes:s.recovery_notes||null,equipment_notes:s.equipment_notes||null,weather_notes:s.weather_notes||null,logistics_notes:s.logistics_notes||null,updated_at:new Date().toISOString()
}}

function InfoNote({title,text}){if(!text)return null;return <div className="stage-info-note"><span>{title}</span><p>{text}</p></div>}

export default function StageRacePlanner({race,defaultFuelPlan}){
  const[stages,setStages]=useState([]),[aidPoints,setAidPoints]=useState([]),[loading,setLoading]=useState(false),[message,setMessage]=useState(''),[openStage,setOpenStage]=useState(null),[userId,setUserId]=useState(null);
  const stageRace=isStageRace(race)||stages.length>1;
  const suggestedCount=knownStageCount(race);

  async function load(){
    if(!race?.race_goal_id)return;
    setLoading(true);setMessage('');
    const{data:{session}}=await supabase.auth.getSession();
    if(!session?.user){setMessage('Sign in to use stage planning.');setLoading(false);return}
    setUserId(session.user.id);
    const[stageResult,aidResult]=await Promise.all([
      supabase.from('race_stage_plans').select('*').eq('user_id',session.user.id).eq('race_goal_id',race.race_goal_id).order('stage_number',{ascending:true}),
      supabase.from('race_stage_aid_points').select('*').eq('user_id',session.user.id).eq('race_goal_id',race.race_goal_id).order('point_number',{ascending:true})
    ]);
    if(stageResult.error||aidResult.error)setMessage(stageResult.error?.message||aidResult.error?.message);else{
      setStages(stageResult.data||[]);setAidPoints(aidResult.data||[]);
    }
    setLoading(false);
  }
  useEffect(()=>{setStages([]);setAidPoints([]);setOpenStage(null);load()},[race?.race_goal_id]);

  const totals=useMemo(()=>stages.reduce((a,s)=>({km:a.km+n(s.distance_km),elev:a.elev+n(s.elevation_m),mins:a.mins+n(s.estimated_duration_minutes),mix:a.mix+n(s.bottle_mix_sachets),gels:a.gels+n(s.regular_gels),boost:a.boost+n(s.boost_gels),recover:a.recover+n(s.recover_servings)}),{km:0,elev:0,mins:0,mix:0,gels:0,boost:0,recover:0}),[stages]);

  function patchStage(id,key,value){setStages(rows=>rows.map(s=>s.id===id?{...s,[key]:value}:s))}
  function patchAid(id,key,value){setAidPoints(rows=>rows.map(p=>p.id===id?{...p,[key]:value}:p))}
  function defaultStage(number,date){return{stage_number:number,stage_date:date||null,stage_name:`Stage ${number}`,terrain:race?.terrain||race?.discipline||'',carb_target_gph:defaultFuelPlan?.carb_target_gph||90,fluid_ml_per_hour:defaultFuelPlan?.hydration_ml_per_hour||500,sodium_mg_per_hour:defaultFuelPlan?.sodium_target_mg_per_hour||700,bottle_mix_sachets:0,regular_gels:0,boost_gels:0,hydrate_servings:1,recover_servings:1}}

  async function addStage(){
    if(!userId)return;
    const number=stages.length?Math.max(...stages.map(s=>n(s.stage_number)))+1:1;
    const last=stages[stages.length-1];
    const date=last?.stage_date?addDays(last.stage_date,1):(race?.catalog_start_date||race?.event_date||null);
    const payload={...defaultStage(number,date),user_id:userId,race_goal_id:race.race_goal_id};
    const{data,error}=await supabase.from('race_stage_plans').insert(payload).select('*').single();
    if(error)return setMessage(error.message);setStages(rows=>[...rows,data]);setOpenStage(data.id);setMessage(`Stage ${number} added.`)
  }
  async function createStageSkeleton(){
    if(!userId||!suggestedCount||stages.length)return;
    setLoading(true);setMessage('Creating stage plan…');
    const start=race?.catalog_start_date||race?.event_date||null;
    const rows=Array.from({length:suggestedCount},(_,i)=>({...defaultStage(i+1,start?addDays(start,i):null),user_id:userId,race_goal_id:race.race_goal_id}));
    const{data,error}=await supabase.from('race_stage_plans').insert(rows).select('*');
    if(error)setMessage(error.message);else{setStages((data||[]).sort((a,b)=>a.stage_number-b.stage_number));setMessage(`${suggestedCount} stages created. Add the official stage details and water points.`)}
    setLoading(false);
  }
  async function saveStage(stage){
    if(!userId)return;
    setMessage('Saving stage…');
    const payload=stagePayload(stage,userId,race.race_goal_id);
    const{data,error}=await supabase.from('race_stage_plans').upsert(payload,{onConflict:'id'}).select('*').single();
    if(error)setMessage(error.message);else{setStages(rows=>rows.map(s=>s.id===data.id?data:s));setMessage(`Stage ${data.stage_number} saved.`)}
  }
  async function removeStage(stage){
    if(!confirm(`Delete Stage ${stage.stage_number} and its water points?`))return;
    const{error}=await supabase.from('race_stage_plans').delete().eq('id',stage.id).eq('user_id',userId);if(error)return setMessage(error.message);
    setStages(rows=>rows.filter(s=>s.id!==stage.id));setAidPoints(rows=>rows.filter(p=>p.stage_id!==stage.id));setOpenStage(null);setMessage('Stage deleted.')
  }
  function autoFuel(stage){
    const hours=n(stage.estimated_duration_minutes)/60,target=n(stage.carb_target_gph);if(hours<=0||target<=0)return setMessage('Add estimated stage duration and carb target first.');
    const total=Math.ceil(hours*target),mix=Math.max(1,Math.ceil(hours)),remaining=Math.max(0,total-mix*60),gels=Math.ceil(remaining/40);
    setStages(rows=>rows.map(s=>s.id===stage.id?{...s,bottle_mix_sachets:mix,regular_gels:gels,hydrate_servings:Math.max(1,Math.ceil(hours/2)),recover_servings:1}:s));
    setMessage('Stage products estimated. Adjust Boost and water-point pickups to match the athlete’s practised strategy.')
  }

  async function addAidPoint(stage){
    if(!userId)return;
    const existing=aidPoints.filter(p=>p.stage_id===stage.id),point=existing.length?Math.max(...existing.map(p=>n(p.point_number)))+1:1;
    const payload={user_id:userId,race_goal_id:race.race_goal_id,stage_id:stage.id,point_number:point,name:`Water Point ${point}`,water_available:true,bottle_refill:true};
    const{data,error}=await supabase.from('race_stage_aid_points').insert(payload).select('*').single();if(error)return setMessage(error.message);setAidPoints(rows=>[...rows,data]);setMessage(`Water point ${point} added.`)
  }
  async function saveAid(point){
    const payload={...point,user_id:userId,race_goal_id:race.race_goal_id,distance_km:numOrNull(point.distance_km),eta_minutes:intOrNull(point.eta_minutes),bottle_mix_pickup:intOrNull(point.bottle_mix_pickup)||0,regular_gels_pickup:intOrNull(point.regular_gels_pickup)||0,boost_gels_pickup:intOrNull(point.boost_gels_pickup)||0,hydrate_pickup:intOrNull(point.hydrate_pickup)||0,updated_at:new Date().toISOString()};
    const{data,error}=await supabase.from('race_stage_aid_points').upsert(payload,{onConflict:'id'}).select('*').single();if(error)return setMessage(error.message);setAidPoints(rows=>rows.map(p=>p.id===data.id?data:p));setMessage(`${data.name||`Water Point ${data.point_number}`} saved.`)
  }
  async function removeAid(point){const{error}=await supabase.from('race_stage_aid_points').delete().eq('id',point.id).eq('user_id',userId);if(error)return setMessage(error.message);setAidPoints(rows=>rows.filter(p=>p.id!==point.id));setMessage('Water point removed.')}

  if(!stageRace&&!stages.length)return null;
  return <section className="stage-race-planner">
    <div className="stage-race-titlebar"><div><span className="eyebrow">STAGE RACE</span><h3>Race execution plan</h3><p>One clean plan for every stage, refill and overnight recovery.</p></div><button className="icon-btn" onClick={load} disabled={loading} aria-label="Refresh stage plan"><RefreshCw size={18}/></button></div>
    {message&&<div className="notice stage-notice">{message}</div>}

    <div className="stage-race-summary">
      <div><strong>{stages.length}</strong><span>Stages</span></div><div><strong>{totals.km?`${totals.km.toFixed(0)} km`:'—'}</strong><span>Total distance</span></div><div><strong>{totals.elev?`${Math.round(totals.elev)} m`:'—'}</strong><span>Total climbing</span></div><div><strong>{totals.mins?duration(totals.mins):'—'}</strong><span>Estimated time</span></div>
    </div>
    {stages.length>0&&<div className="stage-race-product-total"><span><b>{totals.mix}</b> Bottle Mix</span><span><b>{totals.gels}</b> gels</span><span><b>{totals.boost}</b> Boost</span><span><b>{totals.recover}</b> Recover</span></div>}

    {!stages.length&&<div className="stage-empty-actions">{suggestedCount>1&&<button className="primary" disabled={loading} onClick={createStageSkeleton}>Create {suggestedCount} stages</button>}<button className="secondary" onClick={addStage}><Plus size={16}/> Add first stage</button>{!suggestedCount&&<p className="muted">This is a multi-day event, but a reliable stage count is not stored yet. Add the official stages or refresh the event data.</p>}</div>}

    <div className="stage-list">{stages.map(stage=>{
      const points=aidPoints.filter(p=>p.stage_id===stage.id).sort((a,b)=>n(a.point_number)-n(b.point_number));
      const pickups=points.reduce((a,p)=>({mix:a.mix+n(p.bottle_mix_pickup),gels:a.gels+n(p.regular_gels_pickup),boost:a.boost+n(p.boost_gels_pickup),hydrate:a.hydrate+n(p.hydrate_pickup)}),{mix:0,gels:0,boost:0,hydrate:0});
      const startCarry={mix:Math.max(0,n(stage.bottle_mix_sachets)-pickups.mix),gels:Math.max(0,n(stage.regular_gels)-pickups.gels),boost:Math.max(0,n(stage.boost_gels)-pickups.boost),hydrate:Math.max(0,n(stage.hydrate_servings)-pickups.hydrate)};
      const overAllocated=pickups.mix>n(stage.bottle_mix_sachets)||pickups.gels>n(stage.regular_gels)||pickups.boost>n(stage.boost_gels)||pickups.hydrate>n(stage.hydrate_servings);
      const open=openStage===stage.id;
      return <article className={`stage-card ${open?'open':''}`} key={stage.id}>
        <button className="stage-card-head" onClick={()=>setOpenStage(open?null:stage.id)}>
          <span className="stage-number">{stage.stage_number}</span>
          <div className="stage-head-copy"><span>{fmtDate(stage.stage_date)}</span><strong>{stage.stage_name||`Stage ${stage.stage_number}`}</strong><small>{[n(stage.distance_km)>0?`${n(stage.distance_km)} km`:null,n(stage.elevation_m)>0?`${Math.round(n(stage.elevation_m))} m`:null,n(stage.estimated_duration_minutes)>0?duration(stage.estimated_duration_minutes):null].filter(Boolean).join(' · ')||'Stage details to be confirmed'}</small></div>
          <div className="stage-head-chevron">{open?<ChevronUp/>:<ChevronDown/>}</div>
        </button>

        {open&&<div className="stage-card-body">
          <div className="stage-glance">
            <div><Mountain size={18}/><strong>{n(stage.distance_km)?`${n(stage.distance_km)} km`:'—'}</strong><span>Distance</span></div>
            <div><Mountain size={18}/><strong>{n(stage.elevation_m)?`${Math.round(n(stage.elevation_m))} m`:'—'}</strong><span>Climbing</span></div>
            <div><Timer size={18}/><strong>{n(stage.estimated_duration_minutes)?duration(stage.estimated_duration_minutes):'—'}</strong><span>Estimated</span></div>
            <div><MapPin size={18}/><strong>{stage.overnight_location||stage.finish_location||'—'}</strong><span>Finish / overnight</span></div>
          </div>

          <section className="stage-execution-card">
            <div className="stage-section-title"><Flag size={18}/><div><span>STAGE EXECUTION</span><strong>Fuel & hydration</strong></div></div>
            <div className="stage-target-row"><span><b>{stage.carb_target_gph||'—'}</b> g carbs/h</span><span><b>{stage.fluid_ml_per_hour||'—'}</b> ml/h</span><span><b>{stage.sodium_mg_per_hour||'—'}</b> mg sodium/h</span></div>
            <div className="stage-product-readout"><span><b>{stage.bottle_mix_sachets||0}</b><small>Bottle Mix</small></span><span><b>{stage.regular_gels||0}</b><small>Gels</small></span><span><b>{stage.boost_gels||0}</b><small>Boost</small></span><span><b>{stage.hydrate_servings||0}</b><small>Hydrate</small></span><span><b>{stage.recover_servings||0}</b><small>Recover</small></span></div>
            <div className="stage-carry-plan"><span>START WITH</span><div><b>{startCarry.mix}</b> Mix · <b>{startCarry.gels}</b> gels · <b>{startCarry.boost}</b> Boost · <b>{startCarry.hydrate}</b> Hydrate</div>{overAllocated&&<small>Water-point pickups exceed the stage total. Adjust the plan below.</small>}</div>
          </section>

          {(stage.pacing_notes||stage.weather_notes||stage.pre_stage_notes||stage.recovery_notes||stage.equipment_notes||stage.logistics_notes)&&<section className="stage-coach-section">
            <div className="stage-section-title"><Zap size={18}/><div><span>COACH PLAN</span><strong>How to execute the day</strong></div></div>
            <div className="stage-note-grid"><InfoNote title="Pacing" text={stage.pacing_notes}/><InfoNote title="Conditions" text={stage.weather_notes}/><InfoNote title="Before stage" text={stage.pre_stage_notes}/><InfoNote title="Recovery" text={stage.recovery_notes}/><InfoNote title="Bike / equipment" text={stage.equipment_notes}/><InfoNote title="Logistics" text={stage.logistics_notes}/></div>
          </section>}

          <section className="stage-aid-section">
            <div className="stage-section-title row-between"><div className="stage-section-title-inner"><Droplets size={18}/><div><span>COURSE SUPPORT</span><strong>Water & aid points</strong></div></div><button className="secondary compact" onClick={()=>addAidPoint(stage)}><Plus size={15}/> Add point</button></div>
            {!points.length?<p className="stage-empty-copy">Official water points are not loaded yet. Add them when the organiser publishes the locations.</p>:<div className="aid-timeline">{points.map(point=><div className="aid-point" key={point.id}>
              <div className="aid-point-head"><span className="aid-dot"/><div><strong>{point.name||`Water Point ${point.point_number}`}</strong><small>{point.distance_km?`km ${point.distance_km}`:'Distance TBC'}{point.eta_minutes?` · ETA ${duration(point.eta_minutes)}`:''}</small></div></div>
              <div className="aid-services readout">{point.water_available&&<span><Droplets size={14}/>Water</span>}{point.bottle_refill&&<span><RefreshCw size={14}/>Refill</span>}{point.food_available&&<span><Utensils size={14}/>Food</span>}{point.tech_support&&<span><Wrench size={14}/>Tech</span>}{point.drop_bag&&<span><MapPin size={14}/>Drop bag</span>}</div>
              {(n(point.bottle_mix_pickup)||n(point.regular_gels_pickup)||n(point.boost_gels_pickup)||n(point.hydrate_pickup))>0&&<div className="aid-pickup-readout"><b>Collect:</b> {n(point.bottle_mix_pickup)} Mix · {n(point.regular_gels_pickup)} gels · {n(point.boost_gels_pickup)} Boost · {n(point.hydrate_pickup)} Hydrate</div>}
              {point.notes&&<p>{point.notes}</p>}
              <details className="aid-edit"><summary><Edit3 size={14}/> Edit point</summary><div className="aid-edit-body">
                <div className="stage-form-grid three"><label>Name<input value={point.name||''} onChange={e=>patchAid(point.id,'name',e.target.value)}/></label><label>At km<input inputMode="decimal" value={point.distance_km??''} onChange={e=>patchAid(point.id,'distance_km',e.target.value)}/></label><label>ETA min<input inputMode="numeric" value={point.eta_minutes??''} onChange={e=>patchAid(point.id,'eta_minutes',e.target.value)}/></label><label>Cut-off<input type="time" value={point.cutoff_time||''} onChange={e=>patchAid(point.id,'cutoff_time',e.target.value)}/></label></div>
                <div className="aid-services"><label><input type="checkbox" checked={!!point.water_available} onChange={e=>patchAid(point.id,'water_available',e.target.checked)}/>Water</label><label><input type="checkbox" checked={!!point.bottle_refill} onChange={e=>patchAid(point.id,'bottle_refill',e.target.checked)}/>Bottle refill</label><label><input type="checkbox" checked={!!point.food_available} onChange={e=>patchAid(point.id,'food_available',e.target.checked)}/>Food</label><label><input type="checkbox" checked={!!point.tech_support} onChange={e=>patchAid(point.id,'tech_support',e.target.checked)}/>Tech</label><label><input type="checkbox" checked={!!point.drop_bag} onChange={e=>patchAid(point.id,'drop_bag',e.target.checked)}/>Drop bag</label></div>
                <span className="field-kicker">PICK UP HERE</span><div className="stage-product-grid"><label>Mix<input inputMode="numeric" value={point.bottle_mix_pickup??0} onChange={e=>patchAid(point.id,'bottle_mix_pickup',e.target.value)}/></label><label>Gels<input inputMode="numeric" value={point.regular_gels_pickup??0} onChange={e=>patchAid(point.id,'regular_gels_pickup',e.target.value)}/></label><label>Boost<input inputMode="numeric" value={point.boost_gels_pickup??0} onChange={e=>patchAid(point.id,'boost_gels_pickup',e.target.value)}/></label><label>Hydrate<input inputMode="numeric" value={point.hydrate_pickup??0} onChange={e=>patchAid(point.id,'hydrate_pickup',e.target.value)}/></label></div>
                <label>Notes<textarea rows="2" value={point.notes||''} onChange={e=>patchAid(point.id,'notes',e.target.value)} placeholder="Refill both bottles, collect drop bag, chain lube…"/></label>
                <div className="aid-edit-actions"><button className="secondary" onClick={()=>saveAid(point)}><Save size={15}/> Save point</button><button className="secondary danger" onClick={()=>removeAid(point)}><Trash2 size={15}/> Remove</button></div>
              </div></details>
            </div>)}</div>}
          </section>

          <details className="stage-edit-panel">
            <summary><Edit3 size={16}/> Adjust stage details</summary>
            <div className="stage-edit-body">
              <div className="stage-form-grid">
                <label>Stage name<input value={stage.stage_name||''} onChange={e=>patchStage(stage.id,'stage_name',e.target.value)}/></label>
                <label>Date<input type="date" value={stage.stage_date||''} onChange={e=>patchStage(stage.id,'stage_date',e.target.value)}/></label>
                <label>Start time<input type="time" value={stage.start_time||''} onChange={e=>patchStage(stage.id,'start_time',e.target.value)}/></label>
                <label>Stage cut-off<input type="time" value={stage.cutoff_time||''} onChange={e=>patchStage(stage.id,'cutoff_time',e.target.value)}/></label>
                <label>Distance km<input inputMode="decimal" value={stage.distance_km??''} onChange={e=>patchStage(stage.id,'distance_km',e.target.value)}/></label>
                <label>Climbing m<input inputMode="numeric" value={stage.elevation_m??''} onChange={e=>patchStage(stage.id,'elevation_m',e.target.value)}/></label>
                <label>Estimated duration min<input inputMode="numeric" value={stage.estimated_duration_minutes??''} onChange={e=>patchStage(stage.id,'estimated_duration_minutes',e.target.value)}/></label>
                <label>Terrain<input value={stage.terrain||''} onChange={e=>patchStage(stage.id,'terrain',e.target.value)}/></label>
                <label>Start location<input value={stage.start_location||''} onChange={e=>patchStage(stage.id,'start_location',e.target.value)}/></label>
                <label>Finish location<input value={stage.finish_location||''} onChange={e=>patchStage(stage.id,'finish_location',e.target.value)}/></label>
                <label>Overnight location<input value={stage.overnight_location||''} onChange={e=>patchStage(stage.id,'overnight_location',e.target.value)}/></label>
              </div>

              <div className="stage-edit-section"><span className="field-kicker">FUEL TARGETS</span><div className="stage-form-grid three"><label>Carbs g/h<input inputMode="numeric" value={stage.carb_target_gph??''} onChange={e=>patchStage(stage.id,'carb_target_gph',e.target.value)}/></label><label>Fluid ml/h<input inputMode="numeric" value={stage.fluid_ml_per_hour??''} onChange={e=>patchStage(stage.id,'fluid_ml_per_hour',e.target.value)}/></label><label>Sodium mg/h<input inputMode="numeric" value={stage.sodium_mg_per_hour??''} onChange={e=>patchStage(stage.id,'sodium_mg_per_hour',e.target.value)}/></label></div><button className="secondary compact stage-auto-fuel" onClick={()=>autoFuel(stage)}>Estimate stage products</button><div className="stage-product-grid"><label>Bottle Mix<input inputMode="numeric" value={stage.bottle_mix_sachets??0} onChange={e=>patchStage(stage.id,'bottle_mix_sachets',e.target.value)}/></label><label>Regular gels<input inputMode="numeric" value={stage.regular_gels??0} onChange={e=>patchStage(stage.id,'regular_gels',e.target.value)}/></label><label>Boost<input inputMode="numeric" value={stage.boost_gels??0} onChange={e=>patchStage(stage.id,'boost_gels',e.target.value)}/></label><label>Hydrate<input inputMode="numeric" value={stage.hydrate_servings??0} onChange={e=>patchStage(stage.id,'hydrate_servings',e.target.value)}/></label><label>Recover<input inputMode="numeric" value={stage.recover_servings??0} onChange={e=>patchStage(stage.id,'recover_servings',e.target.value)}/></label></div></div>

              <div className="stage-edit-section"><span className="field-kicker">COACH & LOGISTICS NOTES</span><div className="stage-text-grid"><label>Pacing / effort<textarea rows="3" value={stage.pacing_notes||''} onChange={e=>patchStage(stage.id,'pacing_notes',e.target.value)} placeholder="Start controlled, protect the legs on the long climb…"/></label><label>Weather / conditions<textarea rows="3" value={stage.weather_notes||''} onChange={e=>patchStage(stage.id,'weather_notes',e.target.value)} placeholder="Heat, wind, dust, cold, altitude…"/></label><label>Before stage<textarea rows="3" value={stage.pre_stage_notes||''} onChange={e=>patchStage(stage.id,'pre_stage_notes',e.target.value)} placeholder="Breakfast, pre-hydration, bottle prep…"/></label><label>After stage / recovery<textarea rows="3" value={stage.recovery_notes||''} onChange={e=>patchStage(stage.id,'recovery_notes',e.target.value)} placeholder="Recover, meal, rehydrate, sleep…"/></label><label>Bike / equipment<textarea rows="3" value={stage.equipment_notes||''} onChange={e=>patchStage(stage.id,'equipment_notes',e.target.value)} placeholder="Tyres, pressure, spares, charging…"/></label><label>Logistics<textarea rows="3" value={stage.logistics_notes||''} onChange={e=>patchStage(stage.id,'logistics_notes',e.target.value)} placeholder="Bag transfer, shuttle, support crew…"/></label></div></div>

              <div className="stage-actions"><button className="primary" onClick={()=>saveStage(stage)}><Save size={16}/> Save changes</button><button className="secondary danger" onClick={()=>removeStage(stage)}><Trash2 size={16}/> Delete stage</button></div>
            </div>
          </details>
        </div>}
      </article>
    })}</div>
    {stages.length>0&&<button className="secondary full stage-add-bottom" onClick={addStage}><Plus size={16}/> Add another stage</button>}
  </section>
}
