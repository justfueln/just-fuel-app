import React,{useEffect,useState} from 'react';
import {supabase} from './main';
import StageRacePlanner from './StageRacePlanner';

export default function StageRacePlannerV2({race}){
  const[fuelPlan,setFuelPlan]=useState(null);
  useEffect(()=>{
    let alive=true;
    setFuelPlan(null);
    if(!race?.race_goal_id)return()=>{alive=false};
    (async()=>{
      const{data}=await supabase.from('race_fuel_plan').select('*').eq('race_goal_id',race.race_goal_id).maybeSingle();
      if(alive)setFuelPlan(data||null);
    })();
    return()=>{alive=false};
  },[race?.race_goal_id]);
  return <StageRacePlanner race={race} defaultFuelPlan={fuelPlan}/>;
}
