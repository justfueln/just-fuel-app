import fs from 'node:fs';

const path = 'src/AppV3.jsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(from, to);
}

replaceOnce(
  `<div className="segmented">{['This Week','Next Week','Full Plan'].map(v=><button key={v} className={view===v?'active':''} onClick={()=>setView(v)}>{v}</button>)}</div>`,
  `<label className="plan-view-select">Show<select value={view} onChange={e=>setView(e.target.value)}><option>This Week</option><option>Next Week</option><option>Full Plan</option></select></label>`,
  'My Plan period control',
);

replaceOnce(
  `function FuelPage({plan,fuel,stock,fuelProfile,userId,races,reload}){const[sub,setSub]=useState('Training Fuel'),[horizon,setHorizon]=useState(7),`,
  `function FuelPage({plan,fuel,stock,fuelProfile,userId,races,reload}){const[horizon,setHorizon]=useState(7),`,
  'Fuel nested navigation state',
);

replaceOnce(
  `return<div className="stack"><div className="segmented">{['Training Fuel','Race Fuel','Fuel Stock'].map(v=><button key={v} className={sub===v?'active':''} onClick={()=>setSub(v)}>{v}</button>)}</div>{sub==='Training Fuel'&&<div className="stack">`,
  `return<div className="stack"><div className="stack">`,
  'Fuel nested navigation header',
);

replaceOnce(
  `</div>}{sub==='Race Fuel'&&<RaceFuel userId={userId} races={races}/>} {sub==='Fuel Stock'&&<FuelStock fuel={fuel} stock={stock} userId={userId} reload={reload}/>}</div>}`,
  `</div><RaceFuel userId={userId} races={races}/><FuelStock fuel={fuel} stock={stock} userId={userId} reload={reload}/></div>}`,
  'Fuel nested navigation body',
);

fs.writeFileSync(path, source);
console.log('Training simplified: Overview, My Plan, My Race, Fuel and My Details remain the only Training navigation.');
