import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bike, CheckCircle2, Droplets, Flag, Fuel, MapPin, Mountain, RefreshCw, ShieldCheck, Target, Timer, Zap } from 'lucide-react';
import { supabase } from './main';

function pad(value){return String(value).padStart(2,'0')}
function todayKey(){const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function formatDate(value){if(!value)return'—';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${value}T12:00:00`))}
function label(value){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
function humanDuration(minutes){const total=Math.max(0,Math.round(Number(minutes)||0));const h=Math.floor(total/60),m=total%60;return h?`${h}h${m?` ${m}m`:''}`:`${m}m`}
function timelineLabel(minutes){const n=Number(minutes)||0;if(n===0)return'START';const abs=Math.abs(n),h=Math.floor(abs/60),m=abs%60;const text=h?`${h}h${m?` ${m}m`:''}`:`${m}m`;return n<0?`T−${text}`:text}
function daysTo(date){if(!date)return null;const now=new Date();now.setHours(0,0,0,0);const target=new Date(`${date}T12:00:00`);return Math.max(0,Math.ceil((target-now)/(24*60*60*1000)))}
function clamp(n,min,max){return Math.max(min,Math.min(max,n))}

export default function RaceCalendar({events=[],races=[],onSelect}){
  const today=todayKey();
  const[view,setView]=useState('Calendar');
  const[month,setMonth]=useState(()=>today.slice(0,7));
  const[selectedDate,setSelectedDate]=useState(today);
  const[guideRaceId,setGuideRaceId]=useState(()=>races[0]?.race_goal_id||'');
  const[guideLoading,setGuideLoading]=useState(false);
  const[guideError,setGuideError]=useState('');
  const[fuelPlan,setFuelPlan]=useState(null);
  const[timeline,setTimeline]=useState([]);
  const[planSessions,setPlanSessions]=useState([]);
  const[recentActivities,setRecentActivities]=useState([]);
  const[fuelLogs,setFuelLogs]=useState([]);
  const[profile,setProfile]=useState(null);
  const[showAllTimeline,setShowAllTimeline]=useState(false);
  const[checklist,setChecklist]=useState({});

  const[year,monthNumber]=month.split('-').map(Number);
  const monthDate=new Date(year,monthNumber-1,1);
  const monthLabel=new Intl.DateTimeFormat('en-ZA',{month:'long',year:'numeric'}).format(monthDate);
  const firstOffset=(monthDate.getDay()+6)%7;
  const daysInMonth=new Date(year,monthNumber,0).getDate();

  const monthEvents=useMemo(
    ()=>events.filter(event=>String(event.start_date||'').slice(0,7)===month),
    [events,month]
  );
  const eventMap=useMemo(()=>{
    const map=new Map();
    for(const event of monthEvents){
      const key=String(event.start_date||'').slice(0,10);
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(event);
    }
    return map;
  },[monthEvents]);
  const selectedEvents=eventMap.get(selectedDate)||[];
  const cells=[...Array(firstOffset).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  const guideRace=useMemo(()=>races.find(r=>r.race_goal_id===guideRaceId)||races[0]||null,[races,guideRaceId]);

  useEffect(()=>{
    if(!races.length){setGuideRaceId('');return}
    if(!guideRaceId||!races.some(r=>r.race_goal_id===guideRaceId))setGuideRaceId(races[0].race_goal_id);
  },[races,guideRaceId]);

  useEffect(()=>{
    if(!guideRace?.race_goal_id)return;
    try{setChecklist(JSON.parse(localStorage.getItem(`jf-race-checklist-${guideRace.race_goal_id}`)||'{}'))}catch{setChecklist({})}
  },[guideRace?.race_goal_id]);

  useEffect(()=>{
    if(view!=='Guide'||!guideRace?.race_goal_id)return;
    loadGuide(guideRace);
  },[view,guideRace?.race_goal_id]);

  async function loadGuide(race){
    setGuideLoading(true);setGuideError('');setShowAllTimeline(false);
    const{data:{session}}=await supabase.auth.getSession();
    if(!session?.user){setGuideError('Sign in to load your personalised race guide.');setGuideLoading(false);return}
    const cutoff=new Date();cutoff.setDate(cutoff.getDate()-56);
    const [fuelResult,timelineResult,planResult,activityResult,fuelLogResult,profileResult]=await Promise.all([
      supabase.from('race_fuel_plan').select('*').eq('race_goal_id',race.race_goal_id).maybeSingle(),
      supabase.from('race_fuel_timeline').select('*').eq('race_goal_id',race.race_goal_id).order('sort_order',{ascending:true}),
      supabase.from('training_plan_calendar_with_fuel').select('id,session_date,title,session_type,is_key_session,status,actual_activity_id,actual_duration_minutes,actual_distance_km,actual_training_load,carb_target_gph').eq('user_id',session.user.id).eq('race_goal_id',race.race_goal_id).order('session_date',{ascending:true}),
      supabase.from('strava_activities').select('id,start_date_local,name,sport_type,distance_m,moving_time_s,total_elevation_gain_m,weighted_average_watts,exclude_from_analysis,is_duplicate').eq('user_id',session.user.id).gte('start_date_local',cutoff.toISOString()).order('start_date_local',{ascending:false}),
      supabase.from('training_session_fuel_actual').select('session_id,energy_feel,issues,bottle_mix_sachets,regular_gels,boost_gels,extra_carbs_g,fluid_ml,updated_at').eq('user_id',session.user.id).order('updated_at',{ascending:false}).limit(30),
      supabase.from('training_profiles').select('ftp_w,weight_kg').eq('user_id',session.user.id).maybeSingle()
    ]);
    const error=fuelResult.error||timelineResult.error||planResult.error||activityResult.error||fuelLogResult.error||profileResult.error;
    if(error)setGuideError(error.message);
    setFuelPlan(fuelResult.data||null);
    setTimeline(timelineResult.data||[]);
    setPlanSessions(planResult.data||[]);
    setRecentActivities(activityResult.data||[]);
    setFuelLogs(fuelLogResult.data||[]);
    setProfile(profileResult.data||null);
    setGuideLoading(false);
  }

  function changeMonth(delta){
    const d=new Date(year,monthNumber-1+delta,1);
    const key=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
    setMonth(key);
    setSelectedDate(`${key}-01`);
  }
  function goToday(){setMonth(today.slice(0,7));setSelectedDate(today)}
  function isInSeason(event){
    return races.some(race=>
      race.event_date===event.start_date&&
      String(race.event_name||'').toLowerCase()===String(event.event_name||'').toLowerCase()
    );
  }
  function toggleChecklist(key){
    if(!guideRace?.race_goal_id)return;
    setChecklist(prev=>{const next={...prev,[key]:!prev[key]};localStorage.setItem(`jf-race-checklist-${guideRace.race_goal_id}`,JSON.stringify(next));return next});
  }

  const readiness=useMemo(()=>{
    const due=planSessions.filter(s=>s.session_date<=today);
    const completed=due.filter(s=>s.actual_activity_id||String(s.status).toLowerCase()==='completed');
    const keyDue=due.filter(s=>s.is_key_session);
    const keyCompleted=keyDue.filter(s=>s.actual_activity_id||String(s.status).toLowerCase()==='completed');
    const clean=recentActivities.filter(a=>!a.is_duplicate&&!a.exclude_from_analysis);
    const longest=clean.reduce((best,a)=>Number(a.distance_m||0)>Number(best?.distance_m||0)?a:best,null);
    const longestMinutes=clean.reduce((n,a)=>Math.max(n,Number(a.moving_time_s||0)/60),0);
    const issueFree=fuelLogs.filter(x=>!(x.issues||[]).length&&!['energy_dip','hungry'].includes(String(x.energy_feel||'').toLowerCase())).length;
    return{
      due:due.length,completed:completed.length,completionPct:due.length?Math.round(completed.length/due.length*100):null,
      keyDue:keyDue.length,keyCompleted:keyCompleted.length,
      longestKm:longest?Number(longest.distance_m||0)/1000:0,longestMinutes,
      fuelLogs:fuelLogs.length,issueFree
    };
  },[planSessions,recentActivities,fuelLogs,today]);

  const coachFocus=useMemo(()=>{
    if(!guideRace)return'';
    const days=guideRace.days_to_event!=null?Number(guideRace.days_to_event):daysTo(guideRace.event_date);
    const distance=Number(guideRace.distance_km||0),elev=Number(guideRace.elevation_m||0);
    if(days<=6)return'Race week: protect freshness, keep short race-specific intensity, confirm logistics and use only fuel you have already practised.';
    if(days<=13)return'Final preparation: reduce total volume while keeping a little intensity. Complete the last fuel rehearsal early enough to recover before race day.';
    if(days<=28)return distance>=150||elev>=1500?'Specific block: prioritise the key endurance session, climbing or sustained race-pressure work, and practise the exact race fuel target.':'Specific block: keep quality race-specific, practise your race fuel plan and avoid adding unnecessary extra intensity.';
    return distance>=150?'Build the endurance base first, then progressively make long rides more race-specific while rehearsing fuel.':'Keep building consistent fitness and use selected key sessions to rehearse pacing and fueling.';
  },[guideRace]);

  const checklistItems=useMemo(()=>{
    if(!guideRace)return[];
    const items=[
      ['number','Race number / timing chip / entry confirmation'],
      ['bike','Bike checked + repair kit / tools'],
      ['kit','Helmet, shoes, kit and weather layers'],
    ];
    if(fuelPlan){
      if(Number(fuelPlan.pre_race_hydrate_servings)>0)items.push(['prehydrate',`${fuelPlan.pre_race_hydrate_servings} Hydrate serving${Number(fuelPlan.pre_race_hydrate_servings)===1?'':'s'} for pre-race`]);
      if(Number(fuelPlan.bottle_mix_sachets)>0)items.push(['mix',`${fuelPlan.bottle_mix_sachets} Bottle Mix sachet${Number(fuelPlan.bottle_mix_sachets)===1?'':'s'}`]);
      if(Number(fuelPlan.regular_gels)>0)items.push(['gels',`${fuelPlan.regular_gels} regular gel${Number(fuelPlan.regular_gels)===1?'':'s'}`]);
      if(Number(fuelPlan.boost_gels)>0)items.push(['boost',`${fuelPlan.boost_gels} Boost gel${Number(fuelPlan.boost_gels)===1?'':'s'}`]);
      if(Number(fuelPlan.post_race_recover_servings)>0)items.push(['recover','Recover for after the finish']);
    }
    items.push(['refill','Confirm official water / aid points and refill plan']);
    return items;
  },[guideRace,fuelPlan]);

  const shownTimeline=showAllTimeline?timeline:timeline.slice(0,14);
  const caffeineNeedsReview=Number(fuelPlan?.boost_gels||0)>=6;
  const raceDuration=Number(fuelPlan?.race_duration_minutes||guideRace?.goal_time_minutes||0);
  const wkg=Number(profile?.ftp_w)>0&&Number(profile?.weight_kg)>0?Number(profile.ftp_w)/Number(profile.weight_kg):null;

  return <>
    <div className="segmented race-hub-tabs"><button className={view==='Calendar'?'active':''} onClick={()=>setView('Calendar')}>Race Calendar</button><button className={view==='Guide'?'active':''} onClick={()=>setView('Guide')}>Race Guide</button></div>

    {view==='Calendar'?<section className="card race-calendar-card">
      <div className="race-calendar-head">
        <div><span className="eyebrow">RACE CALENDAR</span><h3>{monthLabel}</h3></div>
        <div className="race-calendar-nav">
          <button onClick={()=>changeMonth(-1)} aria-label="Previous month">‹</button>
          <button className="today" onClick={goToday}>Today</button>
          <button onClick={()=>changeMonth(1)} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="race-calendar-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span key={day}>{day}</span>)}</div>
      <div className="race-calendar-grid">{cells.map((day,index)=>{
        if(!day)return <span className="race-calendar-empty" key={`empty-${index}`}/>;
        const date=`${month}-${pad(day)}`;
        const dayEvents=eventMap.get(date)||[];
        return <button
          key={date}
          className={`race-calendar-day ${date===today?'is-today':''} ${date===selectedDate?'selected':''} ${dayEvents.length?'has-events':''}`}
          onClick={()=>setSelectedDate(date)}
          aria-label={`${date}${dayEvents.length?`, ${dayEvents.length} events`:''}`}
        ><span>{day}</span>{dayEvents.length>0&&<b>{dayEvents.length}</b>}</button>;
      })}</div>
      <div className="race-calendar-day-list">
        <div className="race-calendar-selected-date"><strong>{formatDate(selectedDate)}</strong><span>{selectedEvents.length?`${selectedEvents.length} event${selectedEvents.length===1?'':'s'}`:'No events listed'}</span></div>
        {selectedEvents.length>0&&<div className="race-calendar-events">{selectedEvents.map(event=><button key={event.event_id} className="race-calendar-event" onClick={()=>onSelect?.(event)}><div><strong>{event.event_name}</strong><small>{label(event.discipline)}{event.city?` · ${event.city}`:''}{event.province?` · ${event.province}`:''}</small></div>{isInSeason(event)?<span className="race-calendar-added">In my season</span>:<span>Add ›</span>}</button>)}</div>}
      </div>
      <p className="race-calendar-note">Tap a date to see races, then tap an event to add it to your season.</p>
    </section>:<div className="stack race-guide-screen">
      {!races.length?<section className="card empty"><Flag size={30}/><p>Add an event to My Season first. Its personalised Race Guide will then appear here.</p></section>:<>
        <label className="race-guide-picker">Race<select value={guideRace?.race_goal_id||''} onChange={e=>setGuideRaceId(e.target.value)}>{races.map(r=><option key={r.race_goal_id} value={r.race_goal_id}>{r.event_name} · {formatDate(r.event_date)}</option>)}</select></label>
        {guideLoading&&<section className="card empty"><RefreshCw size={28}/><p>Building your personalised race guide…</p></section>}
        {guideError&&<div className="notice">{guideError}</div>}
        {!guideLoading&&guideRace&&<>
          <section className="card race-guide-hero">
            <div className="row-between"><div><span className="eyebrow">MY RACE GUIDE</span><h2>{guideRace.event_name}</h2></div><Flag size={26}/></div>
            <div className="race-guide-countdown"><strong>{guideRace.days_to_event!=null?guideRace.days_to_event:daysTo(guideRace.event_date)}</strong><span>days to race</span></div>
            <div className="pill-row"><span>{formatDate(guideRace.event_date)}</span><span>{label(guideRace.event_type||guideRace.sport_type)}</span>{guideRace.priority&&<span>{guideRace.priority} race</span>}{guideRace.difficulty_label&&<span>{guideRace.difficulty_label}</span>}</div>
            <p className="muted">Guide uses your event, training and fuel data currently stored in Just Fuel. Confirm official course changes, aid stations and race-day weather before the start.</p>
          </section>

          <section className="card">
            <span className="eyebrow">COURSE ON FILE</span>
            <div className="race-guide-facts">
              <div><Bike size={18}/><strong>{Number(guideRace.distance_km)>0?`${Number(guideRace.distance_km).toFixed(Number(guideRace.distance_km)%1?1:0)} km`:'—'}</strong><span>Distance</span></div>
              <div><Mountain size={18}/><strong>{Number(guideRace.elevation_m)>0?`${Math.round(Number(guideRace.elevation_m))} m`:'—'}</strong><span>Climbing</span></div>
              <div><Timer size={18}/><strong>{raceDuration?humanDuration(raceDuration):'—'}</strong><span>{fuelPlan?.duration_source==='estimated'?'Estimated duration':'Goal duration'}</span></div>
              <div><Target size={18}/><strong>{guideRace.terrain?label(guideRace.terrain):label(guideRace.discipline||guideRace.event_type)}</strong><span>Terrain</span></div>
            </div>
            {(guideRace.venue||guideRace.city||guideRace.province)&&<p className="race-guide-location"><MapPin size={15}/>{[guideRace.venue,guideRace.city,guideRace.province].filter(Boolean).join(' · ')}</p>}
          </section>

          <section className="card coach-card"><span className="eyebrow">COACH SAYS</span><h3>{coachFocus}</h3></section>

          <section className="card">
            <div className="row-between"><div><span className="eyebrow">PREPARATION</span><h3>Race readiness snapshot</h3></div><Activity size={22}/></div>
            <div className="race-readiness-grid">
              <div><strong>{readiness.completionPct==null?'—':`${readiness.completionPct}%`}</strong><span>due plan completed</span></div>
              <div><strong>{readiness.keyCompleted}/{readiness.keyDue}</strong><span>key sessions done</span></div>
              <div><strong>{readiness.longestKm?`${readiness.longestKm.toFixed(0)} km`:'—'}</strong><span>longest recent activity</span></div>
              <div><strong>{readiness.fuelLogs}</strong><span>fuel rehearsals logged</span></div>
            </div>
            {Number(profile?.ftp_w)>0&&<div className="race-guide-training-meta"><span>FTP <b>{Math.round(Number(profile.ftp_w))} W</b></span>{wkg&&<span>W/kg <b>{wkg.toFixed(2)}</b></span>}<span>Longest time <b>{readiness.longestMinutes?humanDuration(readiness.longestMinutes):'—'}</b></span></div>}
          </section>

          <section className="card race-guide-fuel-card">
            <div className="row-between"><div><span className="eyebrow">RACE FUEL</span><h3>Personalised execution plan</h3></div><Fuel size={22}/></div>
            {fuelPlan?<>
              <div className="race-fuel-guide-grid">
                <div><strong>{fuelPlan.carb_target_gph||'—'} g/h</strong><span>Carbohydrate</span></div>
                <div><strong>{fuelPlan.hydration_ml_per_hour?`${fuelPlan.hydration_ml_per_hour} ml/h`:'—'}</strong><span>Fluid</span></div>
                <div><strong>{fuelPlan.sodium_target_mg_per_hour?`${fuelPlan.sodium_target_mg_per_hour} mg/h`:'—'}</strong><span>Sodium</span></div>
                <div><strong>{fuelPlan.planned_carbs_g?`${fuelPlan.planned_carbs_g} g`:'—'}</strong><span>Total race carbs</span></div>
              </div>
              <div className="race-product-plan"><span><b>{fuelPlan.bottle_mix_sachets||0}</b> Bottle Mix</span><span><b>{fuelPlan.regular_gels||0}</b> gels</span><span><b>{fuelPlan.boost_gels||0}</b> Boost</span><span><b>{fuelPlan.hydration_bottles||0}</b> bottle/refill units</span></div>
              {fuelPlan.pre_race_note&&<p><b>Before:</b> {fuelPlan.pre_race_note}</p>}
              {fuelPlan.during_race_note&&<p><b>During:</b> {fuelPlan.during_race_note}</p>}
              {fuelPlan.hydration_note&&<p><b>Hydration:</b> {fuelPlan.hydration_note}</p>}
              {caffeineNeedsReview&&<div className="race-guide-warning"><Zap size={17}/><span>This long-event plan contains many Boost gels. Treat the caffeine schedule as something to review and rehearse, not an automatic instruction to use every Boost.</span></div>}
            </>:<p className="muted">No calculated race fuel plan is available yet. Open Fuel and generate/confirm your race strategy first.</p>}
          </section>

          <section className="card">
            <div className="row-between"><div><span className="eyebrow">EXECUTION TIMELINE</span><h3>What to do and when</h3></div><Timer size={22}/></div>
            {timeline.length?<><div className="race-guide-timeline">{shownTimeline.map((item,i)=><div key={`${item.minute_mark}-${i}`}><span>{timelineLabel(item.minute_mark)}</span><p>{item.instruction}</p></div>)}</div>{timeline.length>14&&<button className="secondary full" onClick={()=>setShowAllTimeline(v=>!v)}>{showAllTimeline?'Show shorter timeline':`Show full timeline (${timeline.length} steps)`}</button>}</>:<p className="muted">Timeline will appear when the race fuel plan has been calculated.</p>}
          </section>

          <section className="card">
            <div className="row-between"><div><span className="eyebrow">RACE CHECKLIST</span><h3>Ready to leave</h3></div><ShieldCheck size={22}/></div>
            <div className="race-checklist">{checklistItems.map(([key,text])=><button key={key} className={checklist[key]?'checked':''} onClick={()=>toggleChecklist(key)}><span>{checklist[key]?<CheckCircle2 size={20}/>:<i/>}</span><b>{text}</b></button>)}</div>
          </section>

          <section className="card race-guide-aid"><div className="row-between"><div><span className="eyebrow">AID / REFILL PLAN</span><h3>Course logistics</h3></div><Droplets size={22}/></div><p className="muted">Official aid-station locations are not yet mapped for this event in Just Fuel. Confirm the organiser's latest route/support information, then split the fuel above between what you carry from the start and what you collect or refill later.</p></section>
        </>}
      </>}
    </div>}
  </>;
}
