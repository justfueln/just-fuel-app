import fs from 'node:fs';

const path='src/AppV3.jsx';
let source=fs.readFileSync(path,'utf8');

const importFrom="import { byKey } from './catalog';";
const importTo="import { byKey } from './catalog';\nimport { restockShortfalls, hydratePacks, restockBasketUnits } from './fuel-utils';";
if(!source.includes("from './fuel-utils'")){
  if(!source.includes(importFrom)) throw new Error('Could not find catalog import');
  source=source.replace(importFrom,importTo);
}

const start=source.indexOf('function FuelStock(');
const end=source.indexOf('function Empty(',start);
if(start<0||end<0||end<=start) throw new Error('Could not locate FuelStock block');

const replacement=`function FuelStock({fuel,stock,userId,reload}){
  const products=[['bottle_mix','Bottle Mix'],['energy_gel','Energy Gels'],['boost_gel','Boost'],['hydrate','Hydrate servings'],['recover','Recover']];
  const[vals,setVals]=useState({}),[horizon,setHorizon]=useState(7),[status,setStatus]=useState(''),[saving,setSaving]=useState(false);
  const bottle=byKey('bottle_mix'),gel=byKey('energy_gel'),hydrate=byKey('hydrate'),recover=byKey('recover');
  const regularGels=gel.variants.filter(v=>v.title!=='Boost'),boost=gel.variants.find(v=>v.title==='Boost');
  const[choices,setChoices]=useState({bottle:bottle.variants[0].id,gel:regularGels[0].id,hydrate:hydrate.variants[0].id,recover:recover.variants[0].id});
  useEffect(()=>{const o={};stock.forEach(x=>o[x.product_key]=x.quantity_on_hand);setVals(o)},[stock]);
  const save=async()=>{setSaving(true);setStatus('Saving stock…');for(const[key]of products){const result=await supabase.from('fuel_inventory').upsert({user_id:userId,product_key:key,quantity_on_hand:Number(vals[key]||0)},{onConflict:'user_id,product_key'});if(result.error){setStatus(result.error.message);setSaving(false);return}}await reload({keepMessage:true});setStatus('Fuel stock saved.');setSaving(false)};
  const rows=useMemo(()=>fuel.filter(x=>x.horizon_days===horizon),[fuel,horizon]);
  const shortfalls=useMemo(()=>restockShortfalls(rows),[rows]);
  const hydrateQty=hydratePacks(shortfalls.hydrate),basketUnits=restockBasketUnits(shortfalls);
  function addRestock(){
    addToSharedBasket([
      {product:bottle,variant:bottle.variants.find(v=>v.id===choices.bottle),quantity:shortfalls.bottle_mix||0},
      {product:gel,variant:regularGels.find(v=>v.id===choices.gel),quantity:shortfalls.energy_gel||0},
      {product:gel,variant:boost,quantity:shortfalls.boost_gel||0},
      {product:hydrate,variant:hydrate.variants.find(v=>v.id===choices.hydrate),quantity:hydrateQty},
      {product:recover,variant:recover.variants.find(v=>v.id===choices.recover),quantity:shortfalls.recover||0}
    ]);
    setStatus('Shortfall added to basket.');
  }
  return<div className="stack">
    <section className="card"><h3>My Fuel Stock</h3>{products.map(([k,n])=><label key={k}>{n}<input inputMode="numeric" min="0" value={vals[k]??''} onChange={e=>setVals({...vals,[k]:e.target.value})}/></label>)}<button className="secondary" disabled={saving} onClick={save}>{saving?'Saving…':'Save stock'}</button>{status&&<p className="form-status">{status}</p>}</section>
    <div className="segmented small">{[7,14,30].map(d=><button className={horizon===d?'active':''} onClick={()=>setHorizon(d)} key={d}>{d} days</button>)}</div>
    <section className="card"><h3>Fuel forecast</h3>{rows.length===0?<p className="muted">No fuel demand in this period.</p>:rows.map(x=><div className="forecast-row" key={x.product_key}><span>{x.product_name}</span><span>Need {x.required_units} • Have {x.quantity_on_hand} • <b>Restock {x.shortfall_units}</b></span></div>)}
      {basketUnits>0&&<div className="restock-box"><div className="restock-head"><div><strong>Restock only the shortfall</strong><span>Uses your selected flavours and opens the shared basket.</span></div><ShoppingBag size={21}/></div><div className="restock-choice-grid">
        {shortfalls.bottle_mix>0&&<label>Bottle Mix flavour<select value={choices.bottle} onChange={e=>setChoices({...choices,bottle:e.target.value})}>{bottle.variants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>}
        {shortfalls.energy_gel>0&&<label>Regular gel flavour<select value={choices.gel} onChange={e=>setChoices({...choices,gel:e.target.value})}>{regularGels.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>}
        {shortfalls.hydrate>0&&<label>Hydrate flavour<select value={choices.hydrate} onChange={e=>setChoices({...choices,hydrate:e.target.value})}>{hydrate.variants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>}
        {shortfalls.recover>0&&<label>Recover flavour<select value={choices.recover} onChange={e=>setChoices({...choices,recover:e.target.value})}>{recover.variants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>}
      </div><button className="primary restock-button" onClick={addRestock}><ShoppingBag size={18}/>Add shortfall to basket · {basketUnits} item{basketUnits===1?'':'s'}</button>{hydrateQty>0&&<p className="restock-note">Hydrate stock is tracked as servings; the basket automatically converts the shortfall to {hydrateQty} × 10-pack{hydrateQty===1?'':'s'}.</p>}</div>}
    </section>
  </div>
}
`;

source=source.slice(0,start)+replacement+source.slice(end);
fs.writeFileSync(path,source);
console.log('Phase 4 one-tap restock applied.');
