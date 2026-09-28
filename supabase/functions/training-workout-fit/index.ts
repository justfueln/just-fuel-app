import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Encoder, Profile } from "npm:@garmin/fitsdk@21.217.0";
import { fitTargetFields, garminTargetForStep, normaliseWorkoutMetric } from "./garmin-targets.js";

const ALLOWED=new Set(["https://app.justfuelnutrition.co.za","https://just-fuel-app.vercel.app"]);
function cors(req:Request){const o=req.headers.get("Origin")||"";return{"Access-Control-Allow-Origin":ALLOWED.has(o)?o:"https://app.justfuelnutrition.co.za","Vary":"Origin","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};}
function pRange(ftp:number|null,loPct:number,hiPct:number){if(!ftp)return null;return{lo:Math.round(ftp*loPct),hi:Math.round(ftp*hiPct)};}
function safeName(s:string){return String(s||"workout").replace(/[^a-z0-9-_]+/gi,"-").replace(/^-+|-+$/g,"").slice(0,48)||"workout";}
function minsToSecs(m:number){return Math.max(30,Math.round(m*60));}
function fmtPace(v:number|null|undefined){const n=Math.round(Number(v)||0);return n?`${Math.floor(n/60)}:${String(n%60).padStart(2,"0")}`:"";}
function familyOf(sport:string|null|undefined){const s=String(sport||"").toLowerCase();if(s.includes("run")||s.includes("jog"))return"running";if(s.includes("swim"))return"swimming";if(s.includes("hyrox"))return"hyrox";if(s.includes("tri"))return"triathlon";if(s.includes("cycl")||s.includes("bike")||s.includes("ride")||s.includes("gravel")||s.includes("mountain"))return"cycling";return"training";}

type Step={name:string,seconds:number,intensity:"warmup"|"active"|"rest"|"cooldown",notes?:string,powerLow?:number,powerHigh?:number,targetText?:string,garminTarget?:any};
type Session={session_type:string,title:string,planned_duration_minutes:number,adjusted_duration_minutes:number|null,target_power_low_w:number|null,target_power_high_w:number|null,target_hr_low:number|null,target_hr_high:number|null,target_pace_fast_sec_per_km:number|null,target_pace_slow_sec_per_km:number|null,target_rpe_low:number|null,target_rpe_high:number|null,target_metric:string|null,target_metric_note:string|null,intensity_zone:string|null,instructions:string|null,sport_type:string|null,session_date:string};
function step(name:string,minutes:number,intensity:Step["intensity"],notes:string,power?:{lo:number,hi:number}|null):Step{return{name,seconds:minsToSecs(minutes),intensity,notes,...(power?{powerLow:power.lo,powerHigh:power.hi}:{})};}
function distributeRemainder(steps:Step[],targetSeconds:number){const current=steps.reduce((sum,s)=>sum+s.seconds,0),diff=targetSeconds-current;if(diff!==0&&steps.length){const i=steps.length-1;steps[i]={...steps[i],seconds:Math.max(30,steps[i].seconds+diff)};}return steps;}
function resolvedMetric(s:Session,family:string){return normaliseWorkoutMetric(s.target_metric,{family,powerLow:s.target_power_low_w,powerHigh:s.target_power_high_w,hrLow:s.target_hr_low,hrHigh:s.target_hr_high,paceFast:s.target_pace_fast_sec_per_km,paceSlow:s.target_pace_slow_sec_per_km});}
function sessionTarget(s:Session,metric:string){if(metric==="power"&&s.target_power_low_w&&s.target_power_high_w)return`${s.target_power_low_w}–${s.target_power_high_w} W`;if(metric==="heart_rate"&&s.target_hr_low&&s.target_hr_high)return`${s.target_hr_low}–${s.target_hr_high} bpm`;if(metric==="pace"&&s.target_pace_fast_sec_per_km&&s.target_pace_slow_sec_per_km)return`${fmtPace(s.target_pace_fast_sec_per_km)}–${fmtPace(s.target_pace_slow_sec_per_km)} /km`;if(s.target_rpe_low!=null&&s.target_rpe_high!=null)return`RPE ${s.target_rpe_low}–${s.target_rpe_high}/10`;return s.intensity_zone||"Controlled effort";}
function secondaryTarget(s:Session,metric:string){const bits:string[]=[];if(metric!=="heart_rate"&&s.target_hr_low&&s.target_hr_high)bits.push(`HR ${s.target_hr_low}–${s.target_hr_high}`);if(metric!=="rpe"&&s.target_rpe_low!=null&&s.target_rpe_high!=null)bits.push(`RPE ${s.target_rpe_low}–${s.target_rpe_high}/10`);return bits.join(" · ");}
function sportLanguage(text:string,family:string){if(family!=="running")return text;return String(text||"").replace(/rides?/gi,m=>m[0]===m[0].toUpperCase()?"Run":"run").replace(/riding/gi,"running").replace(/spinning/gi,"easy running").replace(/spin/gi,"jog").replace(/pedals/gi,"stride").replace(/cadence/gi,"form").replace(/power/gi,"pace / effort").replace(/position/gi,"form");}

function buildWorkout(s:Session,ftp:number|null){
  const total=Math.max(20,Number(s.adjusted_duration_minutes||s.planned_duration_minutes||45)),totalSec=minsToSecs(total),family=familyOf(s.sport_type),metric=resolvedMetric(s,family);
  const powerEnabled=family==="cycling"&&metric==="power",workoutFtp=powerEnabled?ftp:null;
  const mainPower=powerEnabled&&s.target_power_low_w&&s.target_power_high_w?{lo:Number(s.target_power_low_w),hi:Number(s.target_power_high_w)}:null;
  const easy=pRange(workoutFtp,.50,.62),recovery=pRange(workoutFtp,.45,.55),endurance=mainPower||pRange(workoutFtp,.60,.75),tempo=mainPower||pRange(workoutFtp,.76,.87),threshold=mainPower||pRange(workoutFtp,.90,1.00),vo2Power=mainPower||pRange(workoutFtp,1.05,1.18),racePower=mainPower||pRange(workoutFtp,.80,.95);
  let description="Structured endurance session.",purpose="Build fitness consistently while keeping the effort controlled and repeatable.",steps:Step[]=[];
  const type=String(s.session_type||"").toLowerCase();

  if(type==="recovery"||type==="run_recovery"){
    description="Very easy aerobic session for circulation and freshness. This should feel easier than normal endurance work.";purpose="Promote recovery without adding meaningful fatigue.";
    steps=[step("Warm up",5,"warmup","Ease in gradually.",recovery),step("Recovery",Math.max(10,total-10),"active","Smooth conversational effort. Do not chase numbers.",recovery),step("Cool down",5,"cooldown","Very easy finish.",null)];
  }else if(type==="easy_endurance"||type==="run_easy"){
    description="Low-stress aerobic endurance. Stay relaxed and finish feeling that you could continue.";purpose="Add aerobic volume while preserving freshness for key sessions.";const wu=Math.min(10,Math.max(5,Math.round(total*.2))),cd=5;
    steps=[step("Warm up",wu,"warmup","Progress gradually into easy aerobic work.",easy),step("Easy endurance",Math.max(10,total-wu-cd),"active","Steady and relaxed. Keep breathing controlled.",mainPower||easy),step("Cool down",cd,"cooldown","Ease the effort down.",null)];
  }else if(type==="endurance"||type==="bike_endurance"||type==="run_endurance"){
    description="Steady aerobic work with no unnecessary surges. Keep the effort sustainable from start to finish.";purpose="Improve aerobic efficiency and repeatable endurance output.";const wu=Math.min(10,Math.max(5,Math.round(total*.18))),cd=Math.min(8,Math.max(5,Math.round(total*.12)));
    steps=[step("Warm up",wu,"warmup","Build gradually from easy effort.",easy),step("Endurance",Math.max(10,total-wu-cd),"active","Hold a steady aerobic effort. Avoid spikes.",endurance),step("Cool down",cd,"cooldown","Easy finish.",null)];
  }else if(type==="long_endurance"||type==="run_long"){
    description="Long controlled endurance session. Pacing and fueling consistency matter more than speed.";purpose="Build fatigue resistance, endurance durability and race-day fueling habits.";
    steps=[step("Warm up",15,"warmup","Easy first 15 minutes. Let heart rate rise naturally.",easy),step("Long endurance",Math.max(20,total-25),"active","Stay mostly aerobic and smooth. Fuel early.",endurance),step("Cool down",10,"cooldown","Very easy final minutes.",null)];
  }else if(type==="tempo"||type==="run_tempo"){
    description="Controlled tempo work below threshold with easy work around the main set.";purpose="Build sustainable muscular endurance before harder threshold and VO2 work.";const wu=10,cd=8,main=Math.max(15,total-wu-cd);
    steps=[step("Warm up",wu,"warmup","Progressive aerobic warm-up.",easy),step("Tempo",main,"active","Smooth tempo pressure. Keep it repeatable.",mainPower||tempo),step("Cool down",cd,"cooldown","Easy finish.",null)];
  }else if(type==="threshold"||type==="run_threshold"){
    description="Sustained intervals close to threshold with full easy recoveries. Quality matters more than forcing the final interval.";purpose="Raise sustainable output and improve tolerance to prolonged hard efforts.";const reps=total>=50?3:2,wu=total>=50?10:8,rec=4,cd=8,available=Math.max(reps*5,total-wu-cd-rec*(reps-1)),each=Math.max(5,Math.floor(available/reps));
    steps.push(step("Warm up",wu,"warmup","Progressive warm-up. Include a few short lifts.",easy));for(let i=0;i<reps;i++){steps.push(step(`Threshold ${i+1}`,each,"active","Controlled threshold. Keep form stable and repeatable.",threshold));if(i<reps-1)steps.push(step("Easy recovery",rec,"rest","Very easy recovery before the next interval.",recovery));}steps.push(step("Cool down",cd,"cooldown","Easy finish. Let breathing settle.",null));
  }else if(type==="vo2"||type==="run_quality"||type==="run_intervals"||type==="hyrox_run_intervals"){
    description="Short high-aerobic intervals with generous recovery. The goal is repeatable quality, not an all-out first effort.";purpose="Raise aerobic ceiling and improve the ability to produce strong repeatable efforts.";const reps=total>=75?5:4,wu=15,hard=4,rec=4,cd=10,used=wu+cd+hard*reps+rec*(reps-1),primer=Math.max(0,total-used);
    steps.push(step("Warm up",wu,"warmup","Progressive warm-up with two short controlled lifts.",easy));if(primer>=5)steps.push(step("Aerobic primer",primer,"active","Settle into steady endurance before the hard set.",pRange(workoutFtp,.60,.72)));for(let i=0;i<reps;i++){steps.push(step(`Quality interval ${i+1}`,hard,"active","Strong controlled effort. Hold form and do not sprint the start.",vo2Power));if(i<reps-1)steps.push(step("Full easy recovery",rec,"rest","Recover very easily so the next interval can be high quality.",recovery));}steps.push(step("Cool down",cd,"cooldown","Easy finish. Stop the set early if form deteriorates substantially.",null));
  }else if(type==="race_specific"){
    description="Race-specific work at the rhythm expected in your target event, separated by controlled recovery.";purpose="Convert general fitness into event-specific pacing, control and fatigue resistance.";const reps=total>=70?3:2,wu=10,rec=5,cd=8,available=Math.max(reps*6,total-wu-cd-rec*(reps-1)),each=Math.max(6,Math.floor(available/reps));
    steps.push(step("Warm up",wu,"warmup","Progress from easy endurance into race-ready rhythm.",easy));for(let i=0;i<reps;i++){steps.push(step(`Race effort ${i+1}`,each,"active","Hold event-specific effort smoothly. Avoid early surges.",racePower));if(i<reps-1)steps.push(step("Easy recovery",rec,"rest","Controlled easy recovery.",recovery));}steps.push(step("Cool down",cd,"cooldown","Easy finish.",null));
  }else if(type==="long_race_specific"||type==="brick_long"){
    description="Long endurance session with sustained race-specific blocks. Treat fueling and pacing as part of the workout.";purpose="Build event-specific durability without turning the whole session into a race.";const wu=15,cd=10,reps=total>=210?3:2,hard=30,rec=10,remaining=Math.max(30,total-wu-cd-hard*reps-rec*(reps-1)),pre=Math.max(20,Math.floor(remaining*.35)),post=Math.max(10,remaining-pre);
    steps.push(step("Warm up",wu,"warmup","Easy start. Settle into your fueling routine.",easy),step("Endurance build",pre,"active","Steady aerobic work before the race-specific blocks.",endurance));for(let i=0;i<reps;i++){steps.push(step(`Race block ${i+1}`,hard,"active","Race-like sustained effort. Practise pacing and fueling.",racePower));if(i<reps-1)steps.push(step("Endurance reset",rec,"rest","Return to controlled endurance without stopping completely.",endurance));}steps.push(step("Endurance finish",post,"active","Finish steady. Keep fueling and pacing disciplined.",endurance),step("Cool down",cd,"cooldown","Easy final minutes.",null));
  }else if(type==="openers"||type==="run_openers"){
    description="Short pre-race activation session. The hard efforts should wake you up, not create fatigue.";purpose="Prime race feel while staying fresh.";const wu=15,cd=Math.max(8,total-24);steps=[step("Warm up",wu,"warmup","Easy to moderate progressive warm-up.",easy)];for(let i=0;i<3;i++){steps.push(step(`Opener ${i+1}`,1,"active","Strong controlled effort, not an all-out sprint.",mainPower||tempo));if(i<2)steps.push(step("Easy recovery",3,"rest","Very easy recovery.",recovery));}steps.push(step("Cool down",cd,"cooldown","Easy finish. Stop while you still feel sharp.",null));
  }else if(type==="race"){
    description="Race day. Use your pacing and fueling plan rather than treating the event like a normal structured workout.";purpose="Execute the event plan: controlled start, sustainable pacing, consistent fueling and a strong finish.";steps=[step("Race",total,"active","Follow your race pacing and fueling plan. Adjust sensibly for terrain and conditions.",racePower)];
  }else{
    description=s.instructions||"Structured training session.";purpose="Complete the planned work with controlled pacing and good technique.";steps=[step("Warm up",10,"warmup","Progressive easy warm-up.",easy),step("Main set",Math.max(10,total-15),"active",s.instructions||"Complete the planned main set.",mainPower),step("Cool down",5,"cooldown","Easy finish.",null)];
  }

  steps=distributeRemainder(steps,totalSec);
  const primary=sessionTarget(s,metric),secondary=secondaryTarget(s,metric);
  steps=steps.map(st=>{
    const targetText=st.powerLow&&st.powerHigh?`${st.powerLow}–${st.powerHigh} W`:st.intensity==="rest"?"Easy recovery":st.intensity==="warmup"||st.intensity==="cooldown"?"Easy · RPE 2–3/10":primary;
    const note=[st.notes,st.intensity==="active"&&secondary?secondary:null].filter(Boolean).join(" · ");
    const garminTarget=garminTargetForStep({metric,intensity:st.intensity,powerLow:st.powerLow,powerHigh:st.powerHigh,hrLow:s.target_hr_low,hrHigh:s.target_hr_high,paceFast:s.target_pace_fast_sec_per_km,paceSlow:s.target_pace_slow_sec_per_km});
    return{...st,targetText,notes:note,garminTarget};
  });
  description=sportLanguage(description,family);purpose=sportLanguage(purpose,family);steps=steps.map(st=>({...st,notes:sportLanguage(st.notes||"",family)}));
  return{description,purpose,total_minutes:Math.round(steps.reduce((sum,x)=>sum+x.seconds,0)/60),steps,downloadable:type!=="race",sport:family,target_metric:metric,target_text:primary,secondary_target_text:secondary,target_note:s.target_metric_note||null,garmin_ready:["cycling","running"].includes(family)&&type!=="race",garmin_target_mode:metric==="pace"?"pace":metric};
}

function sportForFit(sport:string){if(sport.includes("run"))return"running";if(sport.includes("swim"))return"swimming";if(sport.includes("cycl"))return"cycling";return"training";}
function targetApiStep(st:Step){const t=st.garminTarget||{type:"open"};return{name:st.name,duration_seconds:st.seconds,intensity:st.intensity,target_type:t.type,target_low:t.displayLow??null,target_high:t.displayHigh??null,fit_target_low:t.fitLow??null,fit_target_high:t.fitHigh??null,notes:st.notes||""};}

Deno.serve(async(req)=>{
  const ch=cors(req);if(req.method==="OPTIONS")return new Response("ok",{headers:ch});if(req.method!=="POST")return new Response("Method not allowed",{status:405,headers:ch});
  const auth=req.headers.get("Authorization")||"";if(!auth)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...ch,"Content-Type":"application/json"}});
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});const{data:{user},error:userError}=await sb.auth.getUser();if(userError||!user)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers:{...ch,"Content-Type":"application/json"}});
  let body:any={};try{body=await req.json()}catch{};const sessionId=String(body.session_id||""),format=String(body.format||"json");if(!sessionId)return new Response(JSON.stringify({error:"session_id required"}),{status:400,headers:{...ch,"Content-Type":"application/json"}});
  const{data:s,error:se}=await sb.from("training_plan_sessions").select("id,user_id,session_date,sport_type,session_type,title,intensity_zone,planned_duration_minutes,adjusted_duration_minutes,target_power_low_w,target_power_high_w,target_hr_low,target_hr_high,target_pace_fast_sec_per_km,target_pace_slow_sec_per_km,target_rpe_low,target_rpe_high,target_metric,target_metric_note,instructions").eq("id",sessionId).eq("user_id",user.id).maybeSingle();
  if(se||!s)return new Response(JSON.stringify({error:"Workout not found"}),{status:404,headers:{...ch,"Content-Type":"application/json"}});
  const family=familyOf(s.sport_type);
  const[{data:sportProfile},{data:globalProfile}]=await Promise.all([
    sb.from("training_sport_profiles").select("ftp_w,threshold_hr,max_hr,resting_hr,threshold_pace_sec_per_km,estimated_threshold_pace_sec_per_km").eq("user_id",user.id).eq("sport_family",family).maybeSingle(),
    sb.from("training_profiles").select("ftp_w").eq("user_id",user.id).maybeSingle()
  ]);
  const ftp=Number(sportProfile?.ftp_w||globalProfile?.ftp_w)||null;
  const workout=buildWorkout(s as Session,ftp);
  const garminWorkout={ready:workout.garmin_ready,sport:sportForFit(workout.sport),target_mode:workout.garmin_target_mode,direct_sync_available:false,steps:workout.steps.map(targetApiStep)};
  if(format!=="fit")return new Response(JSON.stringify({ok:true,session_id:s.id,title:s.title,session_date:s.session_date,instructions:s.instructions,intensity_zone:s.intensity_zone,target_power_low_w:s.target_power_low_w,target_power_high_w:s.target_power_high_w,target_hr_low:s.target_hr_low,target_hr_high:s.target_hr_high,target_pace_fast_sec_per_km:s.target_pace_fast_sec_per_km,target_pace_slow_sec_per_km:s.target_pace_slow_sec_per_km,target_rpe_low:s.target_rpe_low,target_rpe_high:s.target_rpe_high,garmin_workout:garminWorkout,...workout}),{headers:{...ch,"Content-Type":"application/json","Cache-Control":"private, no-store"}});
  if(!workout.downloadable)return new Response(JSON.stringify({error:"Race day does not use a structured FIT workout file."}),{status:400,headers:{...ch,"Content-Type":"application/json"}});
  try{
    const encoder=new Encoder(),serial=Math.max(1,parseInt(sessionId.replace(/-/g,"").slice(0,8),16)>>>0),fitSport=sportForFit(workout.sport);
    encoder.onMesg(Profile.MesgNum.FILE_ID,{type:"workout",manufacturer:"development",product:1,serialNumber:serial,timeCreated:new Date()});
    encoder.onMesg(Profile.MesgNum.WORKOUT,{sport:fitSport,numValidSteps:workout.steps.length,wktName:String(s.title||"Just Fuel Workout").slice(0,31),wktDescription:`${workout.purpose} ${workout.target_text}`.slice(0,120)});
    workout.steps.forEach((st:Step,i:number)=>{const targetFields=fitTargetFields(st.garminTarget);const notes=[st.targetText,st.notes].filter(Boolean).join(" · ").slice(0,120);encoder.onMesg(Profile.MesgNum.WORKOUT_STEP,{messageIndex:i,wktStepName:st.name.slice(0,31),durationType:"time",durationTime:st.seconds,intensity:st.intensity,notes,...targetFields});});
    const bytes=encoder.close(),filename=`just-fuel-${s.session_date}-${safeName(s.title)}.fit`;return new Response(bytes,{headers:{...ch,"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename=\"${filename}\"`,"Cache-Control":"private, no-store","X-Just-Fuel-Target":workout.garmin_target_mode,"X-Just-Fuel-Sport":workout.sport}});
  }catch(e){console.error("FIT encode error",e);return new Response(JSON.stringify({error:"Could not generate FIT workout",detail:String(e)}),{status:500,headers:{...ch,"Content-Type":"application/json"}});}
});
