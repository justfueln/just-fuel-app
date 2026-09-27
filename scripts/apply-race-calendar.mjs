import fs from 'node:fs';

const appPath = 'src/AppV3.jsx';
const cssPath = 'src/season-v3.css';

let app = fs.readFileSync(appPath, 'utf8');
if (!app.includes("import RaceCalendar from './RaceCalendar';")) {
  const lines = app.split('\n');
  const idx = lines.findIndex(line => line.includes("from './training-api';"));
  if (idx < 0) throw new Error('Could not find training-api import anchor');
  lines.splice(idx + 1, 0, "import RaceCalendar from './RaceCalendar';");
  app = lines.join('\n');
}

const finderAnchor = '<section className="card event-finder">';
const calendarMarkup = '<RaceCalendar events={grouped} races={races} onSelect={chooseEvent}/>';
if (!app.includes(calendarMarkup)) {
  const idx = app.indexOf(finderAnchor);
  if (idx < 0) throw new Error('Could not find event finder anchor');
  app = app.slice(0, idx) + calendarMarkup + '\n    ' + app.slice(idx);
}
fs.writeFileSync(appPath, app);

let css = fs.readFileSync(cssPath, 'utf8');
if (!css.includes('/* Race calendar */')) {
  css += `\n/* Race calendar */\n.race-calendar-card{overflow:hidden}\n.race-calendar-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}\n.race-calendar-head h3{margin:3px 0 0}\n.race-calendar-nav{display:flex;align-items:center;gap:6px}\n.race-calendar-nav button{min-width:38px;height:38px;border:1px solid rgba(255,255,255,.15);border-radius:10px;background:rgba(255,255,255,.06);color:inherit;font-size:20px;font-weight:700;padding:0 10px}\n.race-calendar-nav .today{font-size:12px;min-width:auto}\n.race-calendar-weekdays,.race-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}\n.race-calendar-weekdays{margin-bottom:5px}\n.race-calendar-weekdays span{text-align:center;font-size:10px;font-weight:800;opacity:.55;text-transform:uppercase}\n.race-calendar-day,.race-calendar-empty{aspect-ratio:1/1;min-width:0;border-radius:10px}\n.race-calendar-day{position:relative;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:inherit;padding:5px;display:flex;align-items:flex-start;justify-content:flex-start;font-weight:700}\n.race-calendar-day b{position:absolute;right:4px;bottom:4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#f2c94c;color:#111;font-size:9px;display:grid;place-items:center}\n.race-calendar-day.has-events{border-color:rgba(242,201,76,.45)}\n.race-calendar-day.is-today{box-shadow:inset 0 0 0 1px #f2c94c}\n.race-calendar-day.selected{background:#f2c94c;color:#111;border-color:#f2c94c}\n.race-calendar-day.selected b{background:#111;color:#f2c94c}\n.race-calendar-day-list{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1)}\n.race-calendar-selected-date{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}\n.race-calendar-selected-date span{font-size:12px;opacity:.65}\n.race-calendar-events{display:grid;gap:7px}\n.race-calendar-event{width:100%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:inherit;border-radius:12px;padding:10px 11px;display:flex;justify-content:space-between;align-items:center;gap:10px;text-align:left}\n.race-calendar-event div{min-width:0;display:grid;gap:3px}\n.race-calendar-event strong{font-size:13px}\n.race-calendar-event small{font-size:11px;opacity:.65;white-space:normal}\n.race-calendar-event>span{font-size:11px;font-weight:800;white-space:nowrap}\n.race-calendar-added{color:#f2c94c}\n.race-calendar-note{font-size:11px;opacity:.55;margin:10px 0 0}\n@media(max-width:430px){.race-calendar-card{padding:14px}.race-calendar-head{align-items:center}.race-calendar-nav button{height:34px;min-width:34px;padding:0 8px}.race-calendar-grid,.race-calendar-weekdays{gap:3px}.race-calendar-day{border-radius:8px;padding:4px;font-size:11px}.race-calendar-day b{right:3px;bottom:3px}}\n`;
  fs.writeFileSync(cssPath, css);
}

console.log('Race calendar integration applied.');
