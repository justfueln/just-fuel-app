import fs from 'node:fs';

const appPath='src/AppV3.jsx';
let app=fs.readFileSync(appPath,'utf8');

const insertMarker='\n\nfunction FuelPage({plan,fuel,stock,fuelProfile,userId,races,reload}){';
const gelComponent=`\n\nfunction GelFlavourSplit({total,regularVariants,regularSplit,onRegularChange,boostQty,onBoostChange}){\n  const regularQty=Math.max(0,total-boostQty);\n  const fitted=fitFlavorSplit(regularSplit,regularVariants,regularQty);\n  if(!total)return null;\n  return <div className="flavour-split-card gel-flavour-card">\n    <div className="flavour-split-head"><div><strong>Energy Gel flavours</strong><span>{total} gels total · Boost is included in this total</span></div><button type="button" className="flavour-even" disabled={regularQty===0} onClick={()=>onRegularChange(evenFlavorSplit(regularVariants,regularQty))}>Mix regular</button></div>\n    <div className="flavour-split-list">\n      <div className={boostQty>0?'flavour-split-row selected gel-boost-row':'flavour-split-row gel-boost-row'}><span><strong>Boost</strong><small>100 mg caffeine each</small></span><div className="flavour-split-stepper"><button type="button" disabled={boostQty===0} onClick={()=>onBoostChange(boostQty-1)}>−</button><b>{boostQty}</b><button type="button" disabled={boostQty===total} onClick={()=>onBoostChange(boostQty+1)}>+</button></div></div>\n      <div className="gel-regular-label"><span>{regularQty} regular {regularQty===1?'gel':'gels'}</span><small>Split the rest across your regular flavours.</small></div>\n      {regularVariants.map(v=>{const q=fitted[String(v.id)]||0;return <div className={q>0?'flavour-split-row selected':'flavour-split-row'} key={v.id}><span>{v.title}</span><div className="flavour-split-stepper"><button type="button" disabled={q===0} onClick={()=>onRegularChange(moveFlavorUnit(fitted,regularVariants,regularQty,v.id,-1))}>−</button><b>{q}</b><button type="button" disabled={q===regularQty||regularQty===0} onClick={()=>onRegularChange(moveFlavorUnit(fitted,regularVariants,regularQty,v.id,1))}>+</button></div></div>})}\n    </div>\n    <div className="gel-breakdown"><span><b>{regularQty}</b> Regular</span><span>+</span><span><b>{boostQty}</b> Boost</span><span>=</span><span><b>{total}</b> total gels</span></div>\n  </div>\n}`;

if(!app.includes('function GelFlavourSplit(')){
  if(!app.includes(insertMarker)) throw new Error('FuelPage insertion marker not found');
  app=app.replace(insertMarker,gelComponent+insertMarker);
}

const oldBoost=`{totalGels>0&&<div className="boost-selector"><div><strong>Choose your gel mix</strong><span>Your plan needs {totalGels} gels in total. Choose how many should be Boost; the rest stay regular.</span></div><div className="inline-stepper"><button type="button" onClick={()=>setBoostByHorizon(v=>({...v,[horizon]:Math.max(0,boostQty-1)}))}>−</button><strong>{boostQty}</strong><button type="button" onClick={()=>setBoostByHorizon(v=>({...v,[horizon]:Math.min(totalGels,boostQty+1)}))}>+</button></div><div className="gel-breakdown"><span><b>{regularQty}</b> Regular</span><span>+</span><span><b>{boostQty}</b> Boost</span><span>=</span><span><b>{totalGels}</b> total gels</span></div><small>{boostQty} Boost {boostQty===1?'gel':'gels'} selected · 100 mg caffeine each.</small></div>}`;
if(!app.includes(oldBoost)) throw new Error('Separate Boost selector pattern not found');
app=app.replace(oldBoost,'');

const oldRegular=`<FlavourSplit label="Regular gel flavours" total={regularQty} variants={regularGelVariants} split={gelSplit} onChange={v=>setSplit('gel',v)} unitLabel="gels"/>`;
const newGel=`<GelFlavourSplit total={totalGels} regularVariants={regularGelVariants} regularSplit={gelSplit} onRegularChange={v=>setSplit('gel',v)} boostQty={boostQty} onBoostChange={value=>setBoostByHorizon(v=>({...v,[horizon]:Math.max(0,Math.min(totalGels,value))}))}/>`;
if(!app.includes(oldRegular)) throw new Error('Regular gel flavour block not found');
app=app.replace(oldRegular,newGel);
fs.writeFileSync(appPath,app);

const cssPath='src/season-v3.css';
let css=fs.readFileSync(cssPath,'utf8');
const patch=`\n.gel-flavour-card .gel-boost-row>span{display:grid;gap:2px}.gel-flavour-card .gel-boost-row>span strong{color:#dcb34b}.gel-flavour-card .gel-boost-row>span small{font-size:.72rem;color:#999}.gel-regular-label{display:grid;gap:2px;padding:10px 14px 7px;color:#dcb34b;font-size:.76rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid #232323}.gel-regular-label small{color:#858585;font-size:.72rem;font-weight:400;letter-spacing:0;text-transform:none}.gel-flavour-card .gel-breakdown{margin:12px 14px 14px}.gel-flavour-card .flavour-even:disabled{opacity:.35}\n`;
if(!css.includes('.gel-flavour-card .gel-boost-row>span')) css+=patch;
fs.writeFileSync(cssPath,css);

console.log('Moved Boost selection into Energy Gel flavours card.');
