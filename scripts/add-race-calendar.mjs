import fs from 'node:fs';

const appPath='src/AppV3.jsx';
const cssPath='src/season-v3.css';
let app=fs.readFileSync(appPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');

if(app.includes('function RaceCalendar(')){
  console.log('Race calendar already added.');
  process.exit(0);
}

const seasonNeedle='function SeasonRace({races,userId,reload}){';
const seasonStart=app.indexOf(seasonNeedle);
if(seasonStart<0) throw new Error('SeasonRace component not found');

const calendarComponent=`function RaceCalendar({events,races,onSelect}){
  const pad=n=>String(n).padStart(2,'0');
  const today=localDateKey();
  const[month,setMonth]=useState(()=>today.slice(0,7));
  const[selectedDate,setSelectedDate]=useState(today);
  const parts=month.split('-').map(Number),year=parts[0],monthNumber=parts[1];
  const monthDate=new Date(year,monthNumber-1,1);
  const monthLabel=new Intl.DateTimeFormat('en-ZA',{month:'long',year:'numeric'}).format(monthDate);
  const firstOffset=(monthDate.getDay()+6)%7;
  const daysInMonth=new Date(year,monthNumber,0).getDate();
  const monthEvents=useMemo(()=>events.filter(e=>String(e.start_date||'').slice(0,7)===month),[events,month]);
  const eventMap=useMemo(()=>{const map=new Map();for(const event of monthEvents){const key=String(event.start_date||'').slice(0,10);if(!map.has(key))map.set(key,[]);map.get(key).push(event)}return map},[monthEvents]);
  const selectedEvents=eventMap.get(selectedDate)||[];
  const selectedRace=(event)=>races.some(r=>r.event_date===event.start_date&&String(r.event_name||'').toLowerCase()===String(event.event_name||'').toLowerCase());
  function changeMonth(delta){const d=new Date(year,monthNumber-1+delta,1);const key=\`${'${d.getFullYear()}'}-\${pad(d.getMonth()+1)}\`;setMonth(key);setSelectedDate(\`${'${key}'}-01\`)}
  function goToday(){setMonth(today.slice(0,7));setSelectedDate(today)}
  const cells=[...Array(firstOffset).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  return <section className="card race-calendar-card">
    <div className="race-calendar-head"><div><span className="eyebrow">RACE CALENDAR</span><h3>{monthLabel}</h3></div><div className="race-calendar-nav"><button onClick={()=>changeMonth(-1)} aria-label="Previous month">‹</button><button className="today" onClick={goToday}>Today</button><button onClick={()=>changeMonth(1)} aria-label="Next month">›</button></div></div>
    <div className="race-calendar-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=><span key={d}>{d}</span>)}</div>
    <div className="race-calendar-grid">{cells.map((day,index)=>{
      if(!day)return <span className="race-calendar-empty" key=\`empty-\${index}\`/>;
      const date=\`${'${month}'}-\${pad(day)}\`,dayEvents=eventMap.get(date)||[];
      return <button key={date} className={\`race-calendar-day \${date===today?'is-today':''} \${date===selectedDate?'selected':''} \${dayEvents.length?'has-events':''}\`} onClick={()=>setSelectedDate(date)} aria-label={\`${'${date}'}\${dayEvents.length?\`, \${dayEvents.length} events\`:''}\`}><span>{day}</span>{dayEvents.length>0&&<b>{dayEvents.length}</b>}</button>
    })}</div>
    <div className="race-calendar-day-list"><div className="race-calendar-selected-date"><strong>{fmtDate(selectedDate)}</strong><span>{selectedEvents.length?\`${'${selectedEvents.length}'} event\${selectedEvents.length===1?'':'s'}\`:'No events listed'}</span></div>{selectedEvents.length>0&&<div className="race-calendar-events">{selectedEvents.map(event=><button key={event.event_id} className="race-calendar-event" onClick={()=>onSelect(event)}><div><strong>{event.event_name}</strong><small>{sportLabel(event.discipline)}{event.city?\` · \${event.city}\`:''}{event.province?\` · \${event.province}\`:''}</small></div>{selectedRace(event)?<span className="race-calendar-added">In my season</span>:<span>Add ›</span>}</button>)}</div>}</div>
    <p className="race-calendar-note">Tap a date to see races, then tap an event to add it to your season.</p>
  </section>
}

`;
app=app.slice(0,seasonStart)+calendarComponent+app.slice(seasonStart);

const insertNeedle='</section>\n    <section className="card event-finder">';
const returnAreaStart=app.indexOf('return<div className="stack season-screen">',seasonStart+calendarComponent.length);
const insertAt=app.indexOf(insertNeedle,returnAreaStart);
if(insertAt<0) throw new Error('Event finder insertion point not found');
app=app.slice(0,insertAt)+`</section>\n    <RaceCalendar events={grouped} races={races} onSelect={chooseEvent}/>\n    <section className="card event-finder">`+app.slice(insertAt+insertNeedle.length);

const calendarCss=`
/* Race calendar */
.race-calendar-card{overflow:hidden}
.race-calendar-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.race-calendar-head h3{margin:3px 0 0}
.race-calendar-nav{display:flex;align-items:center;gap:6px}
.race-calendar-nav button{min-width:38px;height:38px;border:1px solid rgba(255,255,255,.15);border-radius:10px;background:rgba(255,255,255,.06);color:inherit;font-size:20px;font-weight:700;padding:0 10px}
.race-calendar-nav .today{font-size:12px;min-width:auto}
.race-calendar-weekdays,.race-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}
.race-calendar-weekdays{margin-bottom:5px}
.race-calendar-weekdays span{text-align:center;font-size:10px;font-weight:800;opacity:.55;text-transform:uppercase}
.race-calendar-day,.race-calendar-empty{aspect-ratio:1/1;min-width:0;border-radius:10px}
.race-calendar-day{position:relative;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:inherit;padding:5px;display:flex;align-items:flex-start;justify-content:flex-start;font-weight:700}
.race-calendar-day b{position:absolute;right:4px;bottom:4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#f2c94c;color:#111;font-size:9px;display:grid;place-items:center}
.race-calendar-day.has-events{border-color:rgba(242,201,76,.45)}
.race-calendar-day.is-today{box-shadow:inset 0 0 0 1px #f2c94c}
.race-calendar-day.selected{background:#f2c94c;color:#111;border-color:#f2c94c}
.race-calendar-day.selected b{background:#111;color:#f2c94c}
.race-calendar-day-list{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1)}
.race-calendar-selected-date{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
.race-calendar-selected-date span{font-size:12px;opacity:.65}
.race-calendar-events{display:grid;gap:7px}
.race-calendar-event{width:100%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit;border-radius:12px;padding:10px 11px;display:flex;justify-content:space-between;align-items:center;gap:10px;text-align:left}
.race-calendar-event div{min-width:0;display:grid;gap:3px}
.race-calendar-event strong{font-size:13px}
.race-calendar-event small{font-size:11px;opacity:.65;white-space:normal}
.race-calendar-event>span{font-size:11px;font-weight:800;white-space:nowrap}
.race-calendar-added{color:#f2c94c}
.race-calendar-note{font-size:11px;opacity:.55;margin:10px 0 0}
@media(max-width:430px){.race-calendar-card{padding:14px}.race-calendar-head{align-items:center}.race-calendar-nav button{height:34px;min-width:34px;padding:0 8px}.race-calendar-grid,.race-calendar-weekdays{gap:3px}.race-calendar-day{border-radius:8px;padding:4px;font-size:11px}.race-calendar-day b{right:3px;bottom:3px}}
`;
if(!css.includes('/* Race calendar */'))css+=calendarCss;

fs.writeFileSync(appPath,app);
fs.writeFileSync(cssPath,css);
