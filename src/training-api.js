export async function fetchTrainingCore(client,userId){
  const[setup,home]=await Promise.all([
    client.from('training_setup_status').select('*').eq('user_id',userId).maybeSingle(),
    client.from('training_home_summary').select('*').eq('user_id',userId).maybeSingle()
  ]);
  return{setup:setup.data||null,home:home.data||null,error:setup.error||home.error||null};
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
  const result=await client.from('fuel_forecast_usage').select('*').eq('user_id',userId).order('horizon_days');
  return{fuel:result.data||[],error:result.error||null};
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
