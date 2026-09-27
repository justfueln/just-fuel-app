import fs from 'node:fs';

const path='src/AppV3.jsx';
let source=fs.readFileSync(path,'utf8');
function replaceOnce(from,to,label){
  const count=source.split(from).length-1;
  if(count!==1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source=source.replace(from,to);
}

replaceOnce(
  `function syncLabel(v){if(!v)return'Connected · adaptive plan enabled';const d=new Date(v);if(Number.isNaN(d.getTime()))return'Connected · adaptive plan enabled';return\`Connected · last sync \${new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}\`}`,
  `function syncLabel(v){if(!v)return'Connected · adaptive plan enabled';const d=new Date(v);if(Number.isNaN(d.getTime()))return'Connected · adaptive plan enabled';return\`Connected · last sync \${new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}\`}\nfunction statusLabel(v){const map={completed:'Done',missed:'Missed',skipped:'Skipped',in_progress:'In progress',active:'In progress',planned:'Planned',upcoming:'Upcoming'};return map[String(v||'').toLowerCase()]||sportLabel(v)}`,
  'status label helper',
);

replaceOnce(
  `  const[lastSync,setLastSync]=useState(()=>localStorage.getItem('jf-strava-last-sync')||'');`,
  `  const[lastSync,setLastSync]=useState(()=>localStorage.getItem('jf-strava-last-sync')||'');\n  const[fuelLoaded,setFuelLoaded]=useState(false);`,
  'fuel loaded state',
);

replaceOnce(
  `  useEffect(()=>{if(session?.user)loadAll()},[session?.user?.id]);`,
  `  useEffect(()=>{if(session?.user)loadAll()},[session?.user?.id]);\n  useEffect(()=>{if(session?.user&&tab==='Fuel'&&!fuelLoaded)loadFuelForecast()},[tab,session?.user?.id,fuelLoaded]);`,
  'lazy fuel effect',
);

replaceOnce(
  `    const activePlanId=g.data?.id;setPlan(activePlanId?(e.data||[]).filter(x=>x.plan_id===activePlanId):[]);\n    const ff=await supabase.from('fuel_forecast_usage').select('*').eq('user_id',uid).order('horizon_days');if(ff.error)setMessage(\`Training loaded, but fuel forecast could not load: \${ff.error.message}\`);else setFuel(ff.data||[]);\n  }`,
  `    const activePlanId=g.data?.id;setPlan(activePlanId?(e.data||[]).filter(x=>x.plan_id===activePlanId):[]);\n  }\n  async function loadFuelForecast(){\n    if(!session?.user)return;\n    const ff=await supabase.from('fuel_forecast_usage').select('*').eq('user_id',session.user.id).order('horizon_days');\n    if(ff.error){setMessage(\`Training loaded, but fuel forecast could not load: \${ff.error.message}\`);return}\n    setFuel(ff.data||[]);setFuelLoaded(true);\n  }`,
  'lazy fuel forecast loader',
);

replaceOnce(
  `const stamp=new Date().toISOString();localStorage.setItem('jf-strava-last-sync',stamp);setLastSync(stamp);setMessage(\`Strava synced.\${note}\`);await loadAll({keepMessage:true})`,
  `const stamp=new Date().toISOString();localStorage.setItem('jf-strava-last-sync',stamp);setLastSync(stamp);setFuelLoaded(false);setMessage(\`Strava synced.\${note}\`);await loadAll({keepMessage:true})`,
  'refresh forecast after Strava sync',
);

replaceOnce(
  `{tab==='Fuel'&&<FuelPage plan={plan} fuel={fuel} stock={stock} fuelProfile={fuelProfile} userId={session.user.id} races={races} reload={loadAll}/>} `,
  `{tab==='Fuel'&&<FuelPage plan={plan} fuel={fuel} stock={stock} fuelProfile={fuelProfile} userId={session.user.id} races={races} reload={async()=>{setFuelLoaded(false);await loadAll({keepMessage:true})}}/>} `,
  'fuel page refresh hook',
);

replaceOnce(
  `return<section className="card session-card"><div className="row-between">`,
  `return<section className={\`card session-card session-\${String(s.status||'planned').toLowerCase()}\`}><div className="row-between">`,
  'workout status class',
);

replaceOnce(
  `<span className={\`status \${s.status}\`}>{s.status}</span>`,
  `<span className={\`status \${String(s.status||'planned').toLowerCase()}\`}>{statusLabel(s.status)}</span>`,
  'workout status label',
);

fs.writeFileSync(path,source);
console.log('Phase 3 polish applied.');
