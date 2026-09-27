import fs from 'node:fs';

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(from, to);
}

{
  const path = 'src/AppV3.jsx';
  let source = fs.readFileSync(path, 'utf8');

  source = replaceOnce(
    source,
    `function addToSharedBasket(lines){const items=readSharedBasket();for(const line of lines){if(!line?.variant||!line?.product||!line.quantity)continue;const idx=items.findIndex(x=>x.variantId===line.variant.id);const next={productKey:line.product.key,productTitle:line.product.title,variantId:line.variant.id,variantTitle:line.variant.title,price:Number(line.variant.price),image:line.variant.image||line.product.image,quantity:Number(line.quantity)};if(idx<0)items.push(next);else items[idx]={...items[idx],quantity:items[idx].quantity+next.quantity}}localStorage.setItem(SHARED_BASKET_KEY,JSON.stringify({savedAt:Date.now(),items}));sessionStorage.setItem('jf-open-basket-after-reload','1');window.location.reload()}`,
    `function addToSharedBasket(lines){const items=readSharedBasket();for(const line of lines){if(!line?.variant||!line?.product||!line.quantity)continue;const idx=items.findIndex(x=>x.variantId===line.variant.id);const next={productKey:line.product.key,productTitle:line.product.title,variantId:line.variant.id,variantTitle:line.variant.title,price:Number(line.variant.price),image:line.variant.image||line.product.image,quantity:Number(line.quantity)};if(idx<0)items.push(next);else items[idx]={...items[idx],quantity:items[idx].quantity+next.quantity}}localStorage.setItem(SHARED_BASKET_KEY,JSON.stringify({savedAt:Date.now(),items}));window.dispatchEvent(new CustomEvent('jf-basket-updated'));window.dispatchEvent(new CustomEvent('jf-open-basket'))}`,
    'shared basket without page reload',
  );

  source = replaceOnce(
    source,
    `function SessionCard({s}){const adjusted=Number(s.duration_minutes)!==Number(s.planned_duration_minutes);return<section className="card session-card"><div className="row-between"><div><span className="eyebrow">{fmtDate(s.session_date)}</span><h3>{s.title}</h3></div><span className={\`status \${s.status}\`}>{s.status}</span></div><div className="pill-row"><span>{mins(s.duration_minutes)}</span>{adjusted&&<span>Adjusted</span>}{s.target_power_low_w&&<span>{s.target_power_low_w}–{s.target_power_high_w} W</span>}{s.target_distance_km&&<span>{s.target_distance_km} km target</span>}{s.target_elevation_m&&<span>{Math.round(s.target_elevation_m)} m vert</span>}</div><p>{s.instructions}</p><div className="fuel-summary"><Fuel size={16}/><span>{s.carb_target_gph>0?\`\${s.carb_target_gph} g/h • \${s.bottle_mix_sachets||0} Bottle Mix • \${s.regular_gels||0} gels • \${s.boost_gels||0} Boost\`:'Water/electrolytes as needed'}</span></div></section>}`,
    `function SessionCard({s}){const adjusted=Number(s.duration_minutes)!==Number(s.planned_duration_minutes);const hasDetails=s.instructions||s.target_power_low_w||s.target_distance_km||s.target_elevation_m||s.adaptation_reason;return<section className="card session-card"><div className="row-between"><div><span className="eyebrow">{fmtDate(s.session_date)}</span><h3>{s.title}</h3></div><span className={\`status \${s.status}\`}>{s.status}</span></div><div className="pill-row"><span>{mins(s.duration_minutes)}</span>{adjusted&&<span>Adjusted</span>}</div><div className="fuel-summary"><Fuel size={16}/><span>{s.carb_target_gph>0?\`\${s.carb_target_gph} g/h • \${s.bottle_mix_sachets||0} Bottle Mix • \${s.regular_gels||0} gels • \${s.boost_gels||0} Boost\`:'Water/electrolytes as needed'}</span></div>{hasDetails&&<details className="session-more"><summary>Workout details</summary><div className="pill-row session-detail-pills">{s.target_power_low_w&&<span>{s.target_power_low_w}–{s.target_power_high_w} W</span>}{s.target_distance_km&&<span>{s.target_distance_km} km target</span>}{s.target_elevation_m&&<span>{Math.round(s.target_elevation_m)} m vert</span>}</div>{s.instructions&&<p>{s.instructions}</p>}{s.adaptation_reason&&<p className="session-adaptation"><b>Why it changed:</b> {s.adaptation_reason}</p>}</details>}</section>}`,
    'simplified workout card',
  );

  fs.writeFileSync(path, source);
}

{
  const path = 'src/ShellNextV3.jsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    `  useEffect(()=>{\n    if(sessionStorage.getItem('jf-open-basket-after-reload')==='1'){\n      sessionStorage.removeItem('jf-open-basket-after-reload');\n      setBasket(loadBasket()); setBasketOpen(true);\n    }\n    const open=()=>{setBasket(loadBasket());setBasketOpen(true)};\n    window.addEventListener('jf-open-basket',open);\n    return ()=>window.removeEventListener('jf-open-basket',open);\n  },[]);`,
    `  useEffect(()=>{\n    const syncBasket=()=>setBasket(loadBasket());\n    const open=()=>{syncBasket();setBasketOpen(true)};\n    if(sessionStorage.getItem('jf-open-basket-after-reload')==='1'){\n      sessionStorage.removeItem('jf-open-basket-after-reload');\n      open();\n    }\n    window.addEventListener('jf-basket-updated',syncBasket);\n    window.addEventListener('jf-open-basket',open);\n    return ()=>{window.removeEventListener('jf-basket-updated',syncBasket);window.removeEventListener('jf-open-basket',open)};\n  },[]);`,
    'live basket bridge',
  );
  fs.writeFileSync(path, source);
}

console.log('Phase 1 polish applied.');
