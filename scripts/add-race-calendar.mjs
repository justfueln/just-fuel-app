import fs from 'node:fs';

const appPath='src/AppV3.jsx';
const cssPath='src/season-v3.css';
let app=fs.readFileSync(appPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');

const importNeedle="import { fetchTrainingCore, fetchTrainingPlan, fetchTrainingRaces, fetchTrainingProfile, fetchTrainingFuelBase, fetchTrainingFuelForecast, sendTrainingOtp, verifyTrainingOtp, syncTrainingStrava, startTrainingStrava } from './training-api';";
if(!app.includes("from './RaceCalendar'")){
  if(!app.includes(importNeedle))throw new Error('Training API import not found');
  app=app.replace(importNeedle,`${importNeedle}\nimport RaceCalendar from './RaceCalendar';`);
}

if(!app.includes('<RaceCalendar events={grouped} races={races} onSelect={chooseEvent}/>')){
  const seasonStart=app.indexOf('function SeasonRace({races,userId,reload}){');
  if(seasonStart<0)throw new Error('SeasonRace component not found');
  const returnStart=app.indexOf('return<div className="stack season-screen">',seasonStart);
  const insertNeedle='</section>\n    <section className="card event-finder">';
  const insertAt=app.indexOf(insertNeedle,returnStart);
  if(insertAt<0)throw new Error('Event finder insertion point not found');
  app=app.slice(0,insertAt)+`</section>\n    <RaceCalendar events={grouped} races={races} onSelect={chooseEvent}/>\n    <section className="card event-finder">`+app.slice(insertAt+insertNeedle.length);
}

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
