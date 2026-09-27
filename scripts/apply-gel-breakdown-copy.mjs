import fs from 'node:fs';

const appPath='src/AppV3.jsx';
let app=fs.readFileSync(appPath,'utf8');

const oldGrid='<div className="training-tally-grid"><span><b>{tally.sessions}</b>Sessions</span><span><b>{tally.bottle}</b>Bottle Mix</span><span><b>{regularQty}</b>Regular gels</span><span><b>{boostQty}</b>Boost</span><span><b>{hydrateQty}</b>Hydrate packs</span><span><b>{tally.recover}</b>Recover</span></div>';
const newGrid='<div className="training-tally-grid"><span><b>{tally.sessions}</b>Sessions</span><span><b>{tally.bottle}</b>Bottle Mix</span><span className="gel-total"><b>{totalGels}</b>Total gels</span><span><b>{hydrateQty}</b>Hydrate packs</span><span><b>{tally.recover}</b>Recover</span></div>';

const oldBoost=`{totalGels>0&&<div className="boost-selector"><div><strong>Boost gels</strong><span>Choose how many of your {totalGels} gels should be Boost.</span></div><div className="inline-stepper"><button type="button" onClick={()=>setBoostByHorizon(v=>({...v,[horizon]:Math.max(0,boostQty-1)}))}>−</button><strong>{boostQty}</strong><button type="button" onClick={()=>setBoostByHorizon(v=>({...v,[horizon]:Math.min(totalGels,boostQty+1)}))}>+</button></div><small>{boostQty*100} mg caffeine across the selected period · Boost replaces regular gels one-for-one.</small></div>}`;
const newBoost=`{totalGels>0&&<div className="boost-selector"><div><strong>Choose your gel mix</strong><span>Your plan needs {totalGels} gels in total. Choose how many should be Boost; the rest stay regular.</span></div><div className="inline-stepper"><button type="button" onClick={()=>setBoostByHorizon(v=>({...v,[horizon]:Math.max(0,boostQty-1)}))}>−</button><strong>{boostQty}</strong><button type="button" onClick={()=>setBoostByHorizon(v=>({...v,[horizon]:Math.min(totalGels,boostQty+1)}))}>+</button></div><div className="gel-breakdown"><span><b>{regularQty}</b> Regular</span><span>+</span><span><b>{boostQty}</b> Boost</span><span>=</span><span><b>{totalGels}</b> total gels</span></div><small>{boostQty} Boost {boostQty===1?'gel':'gels'} selected · 100 mg caffeine each.</small></div>}`;

if(!app.includes(oldGrid)) throw new Error('Training tally grid pattern not found');
if(!app.includes(oldBoost)) throw new Error('Boost selector pattern not found');
app=app.replace(oldGrid,newGrid).replace(oldBoost,newBoost);
fs.writeFileSync(appPath,app);

const cssPath='src/season-v3.css';
let css=fs.readFileSync(cssPath,'utf8');
const cssPatch='\n.gel-breakdown{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin:2px 0 10px;padding:10px 12px;border:1px solid rgba(220,179,75,.24);border-radius:12px;background:rgba(220,179,75,.05);font-size:.9rem}.gel-breakdown b{color:#fff}.gel-breakdown span:nth-child(2),.gel-breakdown span:nth-child(4){opacity:.55}.training-tally-grid .gel-total{border-color:rgba(220,179,75,.55)}\n';
if(!css.includes('.gel-breakdown{')) css+=cssPatch;
fs.writeFileSync(cssPath,css);

console.log('Clarified total/regular/Boost gel breakdown.');
