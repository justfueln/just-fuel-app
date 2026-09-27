import React, { useMemo, useState } from 'react';

function pad(value){return String(value).padStart(2,'0')}
function todayKey(){const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function formatDate(value){if(!value)return'—';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${value}T12:00:00`))}
function label(value){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}

export default function RaceCalendar({events=[],races=[],onSelect}){
  const today=todayKey();
  const[month,setMonth]=useState(()=>today.slice(0,7));
  const[selectedDate,setSelectedDate]=useState(today);
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

  return <section className="card race-calendar-card">
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
  </section>;
}
