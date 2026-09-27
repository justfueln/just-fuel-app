import React,{useEffect,useMemo,useState} from 'react';
import RaceCalendarBase from './RaceCalendarBase';
import StageRacePlanner from './StageRacePlannerV2';
import {supabase} from './main';

function isStageRace(race){const text=`${race?.event_type||''} ${race?.discipline||''} ${race?.subdiscipline||''}`.toLowerCase();return Boolean(race?.multi_day)||Number(race?.stage_count||0)>1||text.includes('stage')}

export default function RaceCalendarStageWrapper(props){
  const stageRaces=useMemo(()=>props.races.filter(isStageRace),[props.races]);
  const[selectedId,setSelectedId]=useState(()=>stageRaces[0]?.race_goal_id||'');
  const[version,setVersion]=useState(0),[building,setBuilding]=useState(false),[buildStatus,setBuildStatus]=useState('');
  useEffect(()=>{if(stageRaces.length&&!stageRaces.some(r=>r.race_goal_id===selectedId))setSelectedId(stageRaces[0].race_goal_id)},[stageRaces,selectedId]);
  useEffect(()=>setBuildStatus(''),[selectedId]);
  const selected=stageRaces.find(r=>r.race_goal_id===selectedId)||stageRaces[0]||null;

  async function buildFromOfficial(){
    if(!selected?.race_goal_id||building)return;
    setBuilding(true);setBuildStatus('Pulling official stages and personalising them from your training history…');
    const{data,error}=await supabase.rpc('build_personalized_stage_plan',{p_race_goal_id:selected.race_goal_id});
    if(error)setBuildStatus(error.message);else{setBuildStatus(`${data||0} official stages updated from your course, training and fuel profile.`);setVersion(v=>v+1)}
    setBuilding(false);
  }

  return <>
    <RaceCalendarBase {...props}/>
    {selected&&<div className="stage-race-hub-wrap">
      {stageRaces.length>1&&<label className="race-guide-picker">Stage race<select value={selected.race_goal_id} onChange={e=>setSelectedId(e.target.value)}>{stageRaces.map(r=><option key={r.race_goal_id} value={r.race_goal_id}>{r.event_name}</option>)}</select></label>}
      <section className="card stage-personalise-card">
        <span className="eyebrow">OFFICIAL + PERSONALISED</span>
        <h3>Build this stage race from official route data</h3>
        <p className="muted">Pull verified stage distance, climbing and locations, then estimate each stage from your recent riding history and current fuel profile. Water-point locations stay marked as pending until the organiser publishes them.</p>
        <button className="primary" disabled={building} onClick={buildFromOfficial}>{building?'Updating…':'Update official stages + my plan'}</button>
        {buildStatus&&<div className="notice">{buildStatus}</div>}
      </section>
      <StageRacePlanner key={`${selected.race_goal_id}-${version}`} race={selected}/>
    </div>}
  </>
}
