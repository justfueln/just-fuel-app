import React,{useEffect,useState} from 'react';
import {Activity,ArrowLeft,Check,Flag,Link2,X} from 'lucide-react';
import {supabase} from './main';
import {startTrainingStrava} from './training-api';
import {dobIsValid} from './athlete-profile-utils';
import {ONBOARDING_STEPS,coreProfileComplete,enabledFamiliesForSport,nextOnboardingStep,primaryFamilyForSport,profileSport,selectedTrainingDays} from './athlete-onboarding-utils';
import './athlete-onboarding-v2.css';

const DAYS=[[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[7,'Sun']];
const SPORTS=[['cycling','Cycling'],['running','Running'],['triathlon','Triathlon'],['hyrox','HYROX']];
const EXPERIENCE=[['beginner','Beginner'],['intermediate','Intermediate'],['advanced','Experienced / competitive']];
const ALL_FAMILIES=['cycling','running','swimming','hyrox'];

const draftKey=uid=>`jf-onboarding-phase6-draft:${uid}`;
const progressKey=uid=>`jf-onboarding-phase6-in-progress:${uid}`;
const completeKey=uid=>`jf-onboarding-phase6-complete:${uid}`;
const dismissKey=uid=>`jf-onboarding-phase6-dismissed:${uid}`;

function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function storeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function removeKey(key){try{localStorage.removeItem(key)}catch{}}
function sessionHas(key){try{return sessionStorage.getItem(key)==='1'}catch{return false}}
function sessionSet(key){try{sessionStorage.setItem(key,'1')}catch{}}

function buildDraft(profile,uid){
  const stored=readJson(draftKey(uid))||{};
  const days=selectedTrainingDays(profile);
  const baseDays=days.length?days:[2,4,6];
  const savedDays=Array.isArray(stored.days)&&stored.days.length?stored.days.map(Number):baseDays;
  const long=Number(stored.longDay||profile?.long_session_weekday||0);
  const longDay=savedDays.includes(long)?long:(savedDays.includes(6)?6:savedDays[savedDays.length-1]);
  return{
    dob:stored.dob||profile?.date_of_birth||'',
    sport:stored.sport||profileSport(profile)||'cycling',
    experience:stored.experience||profile?.experience_level||'intermediate',
    days:savedDays,
    longDay
  };
}

export default function AthleteOnboardingGate(){
  const[session,setSession]=useState(null);
  const[setup,setSetup]=useState(null);
  const[profile,setProfile]=useState(null);
  const[sportProfiles,setSportProfiles]=useState([]);
  const[draft,setDraft]=useState({dob:'',sport:'cycling',experience:'intermediate',days:[2,4,6],longDay:6});
  const[step,setStep]=useState('dob');
  const[open,setOpen]=useState(false);
  const[dismissed,setDismissed]=useState(false);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[status,setStatus]=useState('');

  async function loadForUser(uid,{autoOpen=true}={}){
    if(!uid){setSetup(null);setProfile(null);setSportProfiles([]);setOpen(false);setLoading(false);return}
    setLoading(true);
    const[setupResult,profileResult,sportResult]=await Promise.all([
      supabase.from('training_setup_status').select('*').eq('user_id',uid).maybeSingle(),
      supabase.from('training_profiles').select('*').eq('user_id',uid).maybeSingle(),
      supabase.from('training_sport_profiles').select('*').eq('user_id',uid).order('sport_family')
    ]);
    const nextSetup=setupResult.data||null,nextProfile=profileResult.data||null,nextSports=sportResult.data||[];
    setSetup(nextSetup);setProfile(nextProfile);setSportProfiles(nextSports);
    const nextDraft=buildDraft(nextProfile,uid);setDraft(nextDraft);
    const connected=Boolean(nextSetup?.strava_connected);
    const coreDone=coreProfileComplete(nextProfile);
    const inProgress=localStorage.getItem(progressKey(uid))==='1';
    const nextStep=nextOnboardingStep({profile:nextProfile,stravaConnected:connected});
    setStep(coreDone&&connected&&inProgress?'race':nextStep);
    const wasDismissed=sessionHas(dismissKey(uid));setDismissed(wasDismissed);
    if(autoOpen&&(inProgress||!coreDone||!connected)&&!wasDismissed)setOpen(true);
    if(setupResult.error||profileResult.error||sportResult.error)setStatus(setupResult.error?.message||profileResult.error?.message||sportResult.error?.message||'Could not load athlete setup.');
    setLoading(false);
  }

  useEffect(()=>{
    let mounted=true;
    supabase.auth.getSession().then(({data})=>{if(!mounted)return;const next=data.session||null;setSession(next);loadForUser(next?.user?.id)});
    const{data:sub}=supabase.auth.onAuthStateChange((_event,next)=>{if(!mounted)return;setSession(next||null);loadForUser(next?.user?.id)});
    return()=>{mounted=false;sub.subscription.unsubscribe()};
  },[]);

  const uid=session?.user?.id||'';
  const connected=Boolean(setup?.strava_connected);
  const coreDone=coreProfileComplete(profile);
  const inProgress=uid&&localStorage.getItem(progressKey(uid))==='1';
  const shouldResume=Boolean(uid&&(!coreDone||!connected||inProgress));
  const index=Math.max(0,ONBOARDING_STEPS.indexOf(step));

  useEffect(()=>{if(uid)storeJson(draftKey(uid),draft)},[uid,draft]);

  function dismiss(){if(uid){sessionSet(dismissKey(uid));setDismissed(true)}setOpen(false);setStatus('')}
  function resume(){if(uid){try{sessionStorage.removeItem(dismissKey(uid))}catch{}setDismissed(false);localStorage.setItem(progressKey(uid),'1')}setOpen(true);setStatus('')}
  function patch(next){setDraft(v=>({...v,...next}));setStatus('')}
  function goBack(){const i=ONBOARDING_STEPS.indexOf(step);if(i>0)setStep(ONBOARDING_STEPS[i-1])}

  function validateCurrent(){
    if(step==='dob'&&(!draft.dob||!dobIsValid(draft.dob)))return'Add a valid date of birth.';
    if(step==='sport'&&!SPORTS.some(([key])=>key===draft.sport))return'Select your main sport.';
    if(step==='experience'&&!EXPERIENCE.some(([key])=>key===draft.experience))return'Select your experience level.';
    if(step==='days'&&draft.days.length<2)return'Select at least two training days.';
    if(step==='long_day'&&!draft.days.includes(Number(draft.longDay)))return'Choose your long day from your selected training days.';
    return'';
  }

  async function saveCore(){
    const error=validateCurrent();if(error){setStatus(error);return false}
    if(!uid)return false;
    setSaving(true);setStatus('Saving your athlete setup…');
    const existingEnabled=Array.isArray(profile?.sports_enabled)&&profile.sports_enabled.length&&profile?.primary_sport===draft.sport?profile.sports_enabled:[draft.sport];
    const profileResult=await supabase.from('training_profiles').upsert({
      user_id:uid,
      primary_sport:draft.sport,
      sports_enabled:existingEnabled,
      date_of_birth:draft.dob,
      experience_level:draft.experience,
      available_weekdays:draft.days,
      long_session_weekday:Number(draft.longDay),
      weekday_session_minutes:Number(profile?.weekday_session_minutes||90),
      long_session_max_minutes:Number(profile?.long_session_max_minutes||300)
    },{onConflict:'user_id'});
    if(profileResult.error){setStatus(profileResult.error.message);setSaving(false);return false}

    const enabled=enabledFamiliesForSport(draft.sport),primaryFamily=primaryFamilyForSport(draft.sport),existing=new Map((sportProfiles||[]).map(row=>[row.sport_family,row]));
    const rows=ALL_FAMILIES.map(family=>({
      user_id:uid,
      sport_family:family,
      enabled:enabled.has(family),
      is_primary:family===primaryFamily,
      preferred_intensity_source:existing.get(family)?.preferred_intensity_source||'auto',
      updated_at:new Date().toISOString()
    }));
    const sportsResult=await supabase.from('training_sport_profiles').upsert(rows,{onConflict:'user_id,sport_family'});
    if(sportsResult.error){setStatus(sportsResult.error.message);setSaving(false);return false}
    await Promise.allSettled([
      Promise.resolve(supabase.rpc('refresh_training_sport_detection',{p_user_id:uid})),
      Promise.resolve(supabase.rpc('refresh_training_session_targets',{p_user_id:uid}))
    ]);
    localStorage.setItem(progressKey(uid),'1');
    await loadForUser(uid,{autoOpen:false});
    setSaving(false);setStatus('');
    return true;
  }

  async function next(){
    const error=validateCurrent();if(error)return setStatus(error);
    if(step==='long_day'){
      const saved=await saveCore();if(!saved)return;
      setStep(connected?'race':'strava');return;
    }
    const i=ONBOARDING_STEPS.indexOf(step);if(i>=0&&i<4)setStep(ONBOARDING_STEPS[i+1]);
  }

  async function connectStrava(){
    if(!uid)return;
    setSaving(true);setStatus('Opening Strava…');
    localStorage.setItem(progressKey(uid),'1');storeJson(draftKey(uid),draft);
    const{data,error}=await startTrainingStrava(supabase);
    setSaving(false);
    if(error)return setStatus(error.message);
    if(data?.authorization_url)window.location.href=data.authorization_url;
    else setStatus('Could not start the Strava connection.');
  }

  function markComplete(){
    if(!uid)return;
    localStorage.setItem(completeKey(uid),'1');removeKey(progressKey(uid));removeKey(draftKey(uid));
    setOpen(false);setDismissed(false);setStatus('');
  }

  function finish(){markComplete()}
  function openRace(){
    markComplete();
    const state={...window.history.state,jfSection:'race',jfProfile:false,jfBasket:false};
    window.history.pushState(state,'',window.location.href);
    try{window.dispatchEvent(new PopStateEvent('popstate',{state}))}catch{window.dispatchEvent(new Event('popstate'))}
  }

  if(loading||!session?.user)return null;
  if(!open)return shouldResume&&dismissed?<button className="jf-onboarding-resume" onClick={resume}><Activity size={17}/>Finish athlete setup</button>:null;

  return <div className="jf-onboarding-layer" role="dialog" aria-modal="true" aria-label="Athlete setup">
    <div className="jf-onboarding-card">
      <div className="jf-onboarding-top">
        <div><span>ATHLETE SETUP</span><strong>{index+1} of {ONBOARDING_STEPS.length}</strong></div>
        <button onClick={dismiss} aria-label="Finish setup later"><X size={20}/></button>
      </div>
      <div className="jf-onboarding-progress"><i style={{width:`${((index+1)/ONBOARDING_STEPS.length)*100}%`}}/></div>

      {step==='dob'&&<section>
        <span className="eyebrow">ABOUT YOU</span><h2>When were you born?</h2><p>Your age helps Just Fuel use a sensible heart-rate fallback when better training data is not available.</p>
        <label>Date of birth<input type="date" value={draft.dob} onChange={e=>patch({dob:e.target.value})}/></label>
      </section>}

      {step==='sport'&&<section>
        <span className="eyebrow">YOUR SPORT</span><h2>What do you mainly train for?</h2><p>This sets the language, targets and progression your training plan starts from.</p>
        <div className="jf-onboarding-options">{SPORTS.map(([key,label])=><button key={key} className={draft.sport===key?'selected':''} onClick={()=>patch({sport:key})}>{label}</button>)}</div>
      </section>}

      {step==='experience'&&<section>
        <span className="eyebrow">EXPERIENCE</span><h2>Where are you now?</h2><p>Choose the closest fit. You can change this later under Athlete Details.</p>
        <div className="jf-onboarding-options one-col">{EXPERIENCE.map(([key,label])=><button key={key} className={draft.experience===key?'selected':''} onClick={()=>patch({experience:key})}>{label}</button>)}</div>
      </section>}

      {step==='days'&&<section>
        <span className="eyebrow">TRAINING DAYS</span><h2>Which days can you normally train?</h2><p>Pick at least two. The plan will work around these days instead of forcing a fixed week on you.</p>
        <div className="jf-onboarding-days">{DAYS.map(([day,label])=><button key={day} className={draft.days.includes(day)?'selected':''} onClick={()=>patch({days:draft.days.includes(day)?draft.days.filter(x=>x!==day):[...draft.days,day].sort((a,b)=>a-b)})}>{label}</button>)}</div>
      </section>}

      {step==='long_day'&&<section>
        <span className="eyebrow">LONG DAY</span><h2>Best day for your longest session?</h2><p>Choose one of your normal training days. Just Fuel will use it for the main endurance session where appropriate.</p>
        <div className="jf-onboarding-options">{DAYS.filter(([day])=>draft.days.includes(day)).map(([day,label])=><button key={day} className={Number(draft.longDay)===day?'selected':''} onClick={()=>patch({longDay:day})}>{label}</button>)}</div>
      </section>}

      {step==='strava'&&<section>
        <span className="eyebrow">TRAINING DATA</span><h2>{connected?'Strava is connected':'Connect Strava'}</h2>
        <div className={`jf-onboarding-connection ${connected?'connected':''}`}><Link2 size={24}/><div><strong>{connected?'Connected':'Bring your training history in'}</strong><small>{connected?'Your future syncs can adapt training from what you actually do.':'Strava lets Just Fuel learn from completed rides and runs. No power meter is required.'}</small></div>{connected&&<Check size={20}/>}</div>
        {!connected&&<p className="jf-onboarding-note">You can finish this later, but adaptive training works best once Strava is connected.</p>}
      </section>}

      {step==='race'&&<section>
        <span className="eyebrow">OPTIONAL</span><h2>{setup?.active_race_exists?'Your race is already set':'Do you have a target race?'}</h2><p>Race setup is optional. Add an event now if you have one, or finish and add it later from Race.</p>
        <div className="jf-onboarding-race"><Flag size={25}/><div><strong>{setup?.active_race_exists?setup?.event_name:'No race required to finish setup'}</strong><small>{setup?.active_race_exists?'Your plan can use this event as race context.':'You can finish setup now and add a target race later from Race.'}</small></div></div>
      </section>}

      {status&&<div className="notice">{status}</div>}
      <div className="jf-onboarding-optional">Advanced metrics such as FTP, threshold pace, heart rate and weight are optional. Add them later under Athlete Details if you want.</div>

      <div className="jf-onboarding-actions">
        {index>0&&step!=='race'&&<button className="secondary" onClick={goBack} disabled={saving}><ArrowLeft size={17}/>Back</button>}
        {['dob','sport','experience','days','long_day'].includes(step)&&<button className="primary" onClick={next} disabled={saving}>{saving?'Saving…':'Continue'}</button>}
        {step==='strava'&&connected&&<button className="primary" onClick={()=>setStep('race')}>Continue</button>}
        {step==='strava'&&!connected&&<><button className="primary" onClick={connectStrava} disabled={saving}>{saving?'Opening…':'Connect Strava'}</button><button className="secondary" onClick={dismiss}>Finish later</button></>}
        {step==='race'&&<><button className="primary" onClick={finish}><Check size={17}/>Finish setup</button>{!setup?.active_race_exists&&<button className="secondary" onClick={openRace}><Flag size={17}/>Add a race</button>}</>}
      </div>
    </div>
  </div>;
}
