import React,{useEffect,useMemo,useState} from 'react';
import RaceCalendarBase from './RaceCalendarBase';
import StageRacePlanner from './StageRacePlanner';

function isStageRace(race){const text=`${race?.event_type||''} ${race?.discipline||''} ${race?.subdiscipline||''}`.toLowerCase();return Boolean(race?.multi_day)||Number(race?.stage_count||0)>1||text.includes('stage')}

export default function RaceCalendarStageWrapper(props){
  const stageRaces=useMemo(()=>props.races.filter(isStageRace),[props.races]);
  const[selectedId,setSelectedId]=useState(()=>stageRaces[0]?.race_goal_id||'');
  useEffect(()=>{if(stageRaces.length&&!stageRaces.some(r=>r.race_goal_id===selectedId))setSelectedId(stageRaces[0].race_goal_id)},[stageRaces,selectedId]);
  const selected=stageRaces.find(r=>r.race_goal_id===selectedId)||stageRaces[0]||null;
  return <>
    <RaceCalendarBase {...props}/>
    {selected&&<div className="stage-race-hub-wrap">
      {stageRaces.length>1&&<label className="race-guide-picker">Stage race<select value={selected.race_goal_id} onChange={e=>setSelectedId(e.target.value)}>{stageRaces.map(r=><option key={r.race_goal_id} value={r.race_goal_id}>{r.event_name}</option>)}</select></label>}
      <StageRacePlanner race={selected}/>
    </div>}
  </>
}
