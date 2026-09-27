export async function fetchTrainingCore(client,userId){
  const[setup,home]=await Promise.all([
    client.from('training_setup_status').select('*').eq('user_id',userId).maybeSingle(),
    client.from('training_home_summary').select('*').eq('user_id',userId).maybeSingle()
  ]);
  return{setup:setup.data||null,home:home.data||null,error:setup.error||home.error||null};
}

export async function fetchTodayDashboard(client,today){
  const result=await client.rpc('get_today_dashboard',{p_today:today});
  return{dashboard:result.data||{},error:result.error||null};
}

export async function fetchTrainingPlan(client,userId){
  const[calendar,active]=await Promise.all([
    client.from('training_plan_calendar_with_fuel').select('*').eq('user_id',userId).order('session_date',{ascending:true}),
    client.from('training_plans').select('id').eq('user_id',userId).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  const error=calendar.error||active.error||null;
  const activePlanId=active.data?.id;
  return{plan:error?[]:activePlanId?(calendar.data||[]).filter(x=>x.plan_id===activePlanId):[],error};
}

export async function fetchFuelTrainingPlan(client,userId){
  const active=await client.from('training_plans').select('id').eq('user_id',userId).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle();
  if(active.error)return{plan:[],error:active.error};
  const activePlanId=active.data?.id;
  if(!activePlanId)return{plan:[],error:null};
  const today=new Date(),p=n=>String(n).padStart(2,'0');
  const todayKey=`${today.getFullYear()}-${p(today.getMonth()+1)}-${p(today.getDate())}`;
  const result=await client.from('training_session_fuel_plan')
    .select('session_id,plan_id,session_date,title,duration_minutes,status,carb_target_gph,bottle_mix_sachets,regular_gels,boost_gels,recover_servings')
    .eq('user_id',userId)
    .eq('plan_id',activePlanId)
    .gte('session_date',todayKey)
    .order('session_date',{ascending:true});
  return{plan:result.error?[]:(result.data||[]).map(row=>({...row,id:row.session_id})),error:result.error||null};
}

export async function fetchTrainingRaces(client,userId){
  const result=await client.from('athlete_season_events').select('*').eq('user_id',userId).order('event_date',{ascending:true});
  return{races:result.data||[],error:result.error||null};
}

export async function fetchTrainingProfile(client,userId){
  const result=await client.from('training_profiles').select('*').eq('user_id',userId).maybeSingle();
  return{profile:result.data||null,error:result.error||null};
}

export async function fetchTrainingFuelBase(client,userId){
  const[stock,profile]=await Promise.all([
    client.from('fuel_inventory').select('*').eq('user_id',userId),
    client.from('training_fueling_profiles').select('*').eq('user_id',userId).maybeSingle()
  ]);
  return{stock:stock.data||[],fuelProfile:profile.data||null,error:stock.error||profile.error||null};
}

export async function fetchTrainingFuelForecast(client,userId){
  const result=await client.rpc('get_training_fuel_forecast',{p_user_id:userId});
  return{fuel:result.data||[],error:result.error||null};
}

export async function fetchTrainingHistory(client,userId){
  const fields='id,strava_activity_id,name,sport_type,activity_type,start_date,start_date_local,distance_m,moving_time_s,elapsed_time_s,total_elevation_gain_m,average_heartrate,max_heartrate,average_cadence,average_watts,weighted_average_watts,kilojoules,calories,trainer,manual,is_duplicate,exclude_from_analysis,synced_at,raw';
  const rows=[];
  const pageSize=500;
  for(let from=0;;from+=pageSize){
    const result=await client.from('strava_activities').select(fields).eq('user_id',userId).order('start_date_local',{ascending:false}).range(from,from+pageSize-1);
    if(result.error)return{history:[],error:result.error};
    const page=result.data||[];
    rows.push(...page);
    if(page.length<pageSize)break;
  }
  return{history:rows,error:null};
}

export async function sendTrainingOtp(client,email){
  return client.auth.signInWithOtp({email});
}

export async function verifyTrainingOtp(client,email,token){
  return client.auth.verifyOtp({email,token,type:'email'});
}

export async function syncTrainingStrava(client){
  return client.functions.invoke('strava-sync',{body:{}});
}

export async function startTrainingStrava(client){
  return client.functions.invoke('strava-start',{body:{}});
}
