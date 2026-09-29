const OTP_SEND_COOLDOWN_MS=60000;
const OTP_SEND_KEY='jf-training-otp-last-send';
const requestCache=new Map();

function cachedRequest(key,ttlMs,factory){
  const now=Date.now();
  const hit=requestCache.get(key);
  if(hit&&hit.expiresAt>now)return hit.promise;
  const entry={expiresAt:now+ttlMs,promise:null};
  entry.promise=Promise.resolve().then(factory).catch(error=>{
    if(requestCache.get(key)===entry)requestCache.delete(key);
    throw error;
  });
  requestCache.set(key,entry);
  return entry.promise;
}

function clearRequestCache(prefix=''){
  for(const key of requestCache.keys())if(!prefix||key.startsWith(prefix))requestCache.delete(key);
}

async function runPostgrest(builder,timeoutMs){
  if(typeof AbortController==='undefined'||typeof builder?.abortSignal!=='function')return await builder;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await builder.abortSignal(controller.signal)}finally{clearTimeout(timer)}
}

function requestError(error,fallback='Request timed out. Please try again.'){
  if(error?.message)return error;
  return{message:fallback};
}

async function safePostgrest(builder,timeoutMs){
  try{return await runPostgrest(builder,timeoutMs)}catch(error){return{data:null,error:requestError(error)}}
}

function localDateKey(){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

function normalizeDashboard(value){return Array.isArray(value)?value[0]||{}:value||{}}

function dashboardToTrainingHome(value){
  const dashboard=normalizeDashboard(value);
  const next=dashboard.next_session||{};
  const week=dashboard.week||{};
  const race=dashboard.next_race||{};
  const planned=Number(week.planned_sessions)||0;
  const completed=Number(week.completed_sessions)||0;
  return{
    next_session_id:next.id||null,
    next_session_date:next.date||null,
    next_session_title:next.title||null,
    next_session_type:next.type||null,
    next_session_duration_minutes:next.duration_minutes??null,
    next_session_carb_target_gph:next.carbs_gph??null,
    next_session_bottle_mix:next.bottle_mix??null,
    next_session_regular_gels:next.regular_gels??null,
    next_session_boost_gels:next.boost_gels??null,
    next_session_recover:next.recover??null,
    event_name:race.name||null,
    event_date:race.date||null,
    days_to_race:race.days_to_race??null,
    week_completion_pct:planned>0?Math.round((completed/planned)*100):null
  };
}

export async function fetchTrainingCore(client,userId){
  const today=localDateKey();
  return cachedRequest(`training-core:${userId}:${today}`,2500,async()=>{
    const result=await safePostgrest(client.rpc('get_training_core_fast',{p_today:today}),1800);
    if(result.error)return{setup:null,home:null,error:result.error};
    const payload=result.data||{};
    return{setup:payload.setup||null,home:dashboardToTrainingHome(payload.dashboard),error:null};
  });
}

export async function fetchTodayDashboard(client,today){
  return cachedRequest(`today-dashboard:${today}`,2500,async()=>{
    const result=await safePostgrest(client.rpc('get_today_dashboard',{p_today:today}),1800);
    return{dashboard:result.data||{},error:result.error||null};
  });
}

export async function fetchTodayReadiness(client,userId,today){
  return cachedRequest(`today-readiness:${userId}:${today}`,2500,async()=>{
    const query=client.from('training_readiness_checkins')
      .select('id,checkin_date,sleep_quality,legs_freshness,soreness,motivation,resting_hr,note,score,status,load_ratio,suggested_factor,recommendation,target_session_id,adjustment_status,original_adjusted_minutes,applied_adjusted_minutes,updated_at')
      .eq('user_id',userId)
      .eq('checkin_date',today)
      .maybeSingle();
    const result=await safePostgrest(query,1200);
    return{readiness:result.data||null,error:result.error||null};
  });
}

export async function saveMorningReadiness(client,today,values){
  const result=await client.rpc('save_training_readiness',{
    p_today:today,
    p_sleep:Number(values.sleep),
    p_legs:Number(values.legs),
    p_soreness:Number(values.soreness),
    p_motivation:Number(values.motivation),
    p_resting_hr:values.restingHr?Number(values.restingHr):null,
    p_note:values.note||null
  });
  if(result.error)return{readiness:null,error:result.error};
  clearRequestCache('today-readiness:');
  clearRequestCache('today-dashboard:');
  clearRequestCache('training-core:');
  const auth=await client.auth.getSession();
  const uid=auth.data.session?.user?.id;
  let adaptation=null,progression=null;
  if(uid){
    try{const r=await client.rpc('refresh_training_plan_adaptation',{p_user_id:uid});adaptation=r.data||null}catch{}
    try{const r=await client.rpc('refresh_training_progression',{p_user_id:uid});progression=r.data||null}catch{}
  }
  return{readiness:result.data||null,error:null,adaptation,progression};
}

export async function applyMorningReadinessAdjustment(client,today,accept){
  const result=await client.rpc('apply_training_readiness_adjustment',{p_today:today,p_accept:Boolean(accept)});
  clearRequestCache('today-dashboard:');
  clearRequestCache('today-readiness:');
  clearRequestCache('training-core:');
  clearRequestCache('fuel-forecast:');
  return{result:result.data||null,error:result.error||null};
}

export async function fetchTrainingPlan(client,userId){
  const active=await safePostgrest(
    client.from('training_plans').select('id').eq('user_id',userId).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle(),
    1000
  );
  if(active.error)return{plan:[],error:active.error};
  const activePlanId=active.data?.id;
  if(!activePlanId)return{plan:[],error:null};

  const fields='id,plan_id,week_id,user_id,race_goal_id,session_date,sport_type,session_type,title,phase,intensity_zone,planned_duration_minutes,duration_minutes,target_load,target_power_low_w,target_power_high_w,target_distance_km,target_elevation_m,is_key_session,priority,instructions,status,week_number,week_start,week_focus,is_recovery,adaptation_factor,adaptation_reason,event_name,event_date,actual_activity_id,actual_strava_activity_id,actual_start_date_local,actual_name,actual_duration_minutes,actual_distance_km,actual_elevation_m,actual_avg_hr,actual_weighted_watts,actual_training_load,match_score,duration_completion_pct,load_completion_pct,progression_status,progression_factor,progression_reason,progression_source_count,progression_applied_at,target_metric,target_hr_low,target_hr_high,target_pace_fast_sec_per_km,target_pace_slow_sec_per_km,target_rpe_low,target_rpe_high,target_metric_note';
  const calendar=await safePostgrest(
    client.from('training_plan_calendar').select(fields).eq('user_id',userId).eq('plan_id',activePlanId).order('session_date',{ascending:true}),
    1800
  );
  if(calendar.error)return{plan:[],error:calendar.error};
  return{plan:calendar.data||[],error:null};
}

export async function fetchFuelTrainingPlan(client,userId){
  const active=await safePostgrest(client.from('training_plans').select('id').eq('user_id',userId).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle(),1000);
  if(active.error)return{plan:[],error:active.error};
  const activePlanId=active.data?.id;
  if(!activePlanId)return{plan:[],error:null};
  const todayKey=localDateKey();
  const query=client.from('training_session_fuel_plan_multisport')
    .select('session_id,plan_id,session_date,sport_type,title,duration_minutes,status,carb_target_gph,bottle_mix_sachets,regular_gels,boost_gels,hydrate_servings,recover_servings,hydration_ml_per_hour,hydration_ml_total,sodium_target_mg_per_hour,sodium_target_mg_total,fuel_delivery_mode,fueling_note,boost_note,recovery_note,hydration_note')
    .eq('user_id',userId)
    .eq('plan_id',activePlanId)
    .gte('session_date',todayKey)
    .order('session_date',{ascending:true});
  const result=await safePostgrest(query,2500);
  return{plan:result.error?[]:(result.data||[]).map(row=>({...row,id:row.session_id})),error:result.error||null};
}

export async function fetchTrainingRaces(client,userId){
  const result=await safePostgrest(client.from('athlete_season_events').select('*').eq('user_id',userId).order('event_date',{ascending:true}),1800);
  return{races:result.data||[],error:result.error||null};
}

export async function fetchTrainingProfile(client,userId){
  const result=await safePostgrest(client.from('training_profiles').select('*').eq('user_id',userId).maybeSingle(),1500);
  return{profile:result.data||null,error:result.error||null};
}

export async function fetchTrainingFuelBase(client,userId){
  const[stock,profile]=await Promise.all([
    safePostgrest(client.from('fuel_inventory').select('*').eq('user_id',userId),1500),
    safePostgrest(client.from('training_fueling_profiles').select('*').eq('user_id',userId).maybeSingle(),1500)
  ]);
  return{stock:stock.data||[],fuelProfile:profile.data||null,error:stock.error||profile.error||null};
}

export async function fetchTrainingFuelForecast(client,userId){
  return cachedRequest(`fuel-forecast:${userId}`,5000,async()=>{
    const result=await safePostgrest(client.rpc('get_training_fuel_forecast',{p_user_id:userId}),3500);
    return{fuel:result.data||[],error:result.error||null};
  });
}

export async function fetchTrainingHistory(client,userId){
  const fields='id,strava_activity_id,name,sport_type,activity_type,start_date,start_date_local,distance_m,moving_time_s,elapsed_time_s,total_elevation_gain_m,effective_average_heartrate,effective_max_heartrate,effective_average_cadence,effective_average_watts,effective_weighted_average_watts,effective_kilojoules,effective_calories,trainer,manual,had_duplicate,duplicate_confidence,synced_at,estimated_training_load,load_source,load_confidence,sport_family';
  // Initial Progress rendering only needs recent training. Keeping this request bounded
  // prevents large Strava histories from locking the UI while preserving 6-month trends.
  const result=await safePostgrest(
    client.from('training_activity_metrics').select(fields).eq('user_id',userId).order('start_date_local',{ascending:false}).limit(250),
    2200
  );
  if(result.error)return{history:[],error:result.error};
  const rows=[];
  const seen=new Set();
  for(const row of result.data||[]){
    const key=row.strava_activity_id!=null?`strava:${row.strava_activity_id}`:`row:${row.id}`;
    if(seen.has(key))continue;
    seen.add(key);
    rows.push({
      ...row,
      average_heartrate:row.effective_average_heartrate,
      max_heartrate:row.effective_max_heartrate,
      average_cadence:row.effective_average_cadence,
      average_watts:row.effective_average_watts,
      weighted_average_watts:row.effective_weighted_average_watts,
      kilojoules:row.effective_kilojoules,
      calories:row.effective_calories,
      raw:{suffer_score:Number(row.estimated_training_load)||0,jf_load_source:row.load_source,jf_load_confidence:row.load_confidence}
    });
  }
  return{history:rows,error:null};
}

export async function sendTrainingOtp(client,email){
  if(typeof window!=='undefined'){
    try{
      const last=Number(localStorage.getItem(OTP_SEND_KEY)||0);
      const waitMs=Math.max(0,OTP_SEND_COOLDOWN_MS-(Date.now()-last));
      if(waitMs>0){
        const seconds=Math.max(1,Math.ceil(waitMs/1000));
        return{data:null,error:{message:`Please wait ${seconds} seconds before requesting another login code.`}};
      }
    }catch{}
  }

  const result=await client.auth.signInWithOtp({email});
  if(!result.error&&typeof window!=='undefined'){
    try{localStorage.setItem(OTP_SEND_KEY,String(Date.now()))}catch{}
  }
  return result;
}

export async function verifyTrainingOtp(client,email,token){
  return client.auth.verifyOtp({email,token,type:'email'});
}

export async function syncTrainingStrava(client){
  const result=await client.functions.invoke('strava-sync',{body:{}});
  // The deployed sync function already performs matching, adaptation, progression and
  // target refreshes. Only run the legacy browser refresh chain if the backend
  // explicitly asks for it; otherwise it duplicates expensive work and can time out.
  if(!result.error&&result.data?.client_refresh_required===true){
    try{
      const auth=await client.auth.getSession();
      const uid=auth.data.session?.user?.id;
      if(uid){
        const detection=await client.rpc('refresh_training_sport_detection',{p_user_id:uid});
        const adaptation=await client.rpc('refresh_training_plan_adaptation',{p_user_id:uid});
        const progression=await client.rpc('refresh_training_progression',{p_user_id:uid});
        const targets=await client.rpc('refresh_training_session_targets',{p_user_id:uid});
        result.data={
          ...(result.data||{}),
          sport_detection:detection.data||null,
          sport_detection_warning:detection.error?.message||null,
          plan_adaptation:adaptation.data||null,
          plan_adaptation_warning:adaptation.error?.message||null,
          progression:progression.data||null,
          progression_warning:progression.error?.message||null,
          session_targets:targets.data||null,
          session_targets_warning:targets.error?.message||null
        };
      }
    }catch{}
  }
  clearRequestCache('today-dashboard:');
  clearRequestCache('today-readiness:');
  clearRequestCache('training-core:');
  clearRequestCache('fuel-forecast:');
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('jf-strava-synced',{detail:result?.data||null}));
  return result;
}

export async function startTrainingStrava(client){
  return client.functions.invoke('strava-start',{body:{}});
}
