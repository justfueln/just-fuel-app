import React,{useMemo,useState} from 'react';
import {CheckCircle2,Minus,PackageCheck,Plus,ShoppingBag} from 'lucide-react';
import {byKey} from './catalog';
import {fitFlavorSplit,moveFlavorUnit,evenFlavorSplit,flavorBasketLines} from './flavour-split';
import {PHASE8_HORIZON_DAYS,phase8ForecastRows,phase8Headline,phase8OrderQuantities,phase8OrderUnits,phase8Shortfalls} from './fuel-to-shop-utils';
import './roadmap-v2-phase8.css';

const n=value=>Math.max(0,Number(value)||0);

function SplitPicker({label,total,variants,split,onChange,unitLabel}){
  const fitted=fitFlavorSplit(split,variants,total);
  if(!total||!variants?.length)return null;
  return <div className="phase8-flavour-card">
    <div className="phase8-flavour-head">
      <div><strong>{label}</strong><small>{total} {unitLabel} · split across flavours</small></div>
      <button type="button" onClick={()=>onChange(evenFlavorSplit(variants,total))}>Mix evenly</button>
    </div>
    <div className="phase8-flavour-list">{variants.map(variant=>{
      const qty=fitted[String(variant.id)]||0;
      return <div className={`phase8-flavour-row ${qty?'selected':''}`} key={variant.id}>
        <span>{variant.title}</span>
        <div className="phase8-flavour-stepper">
          <button type="button" disabled={!qty} onClick={()=>onChange(moveFlavorUnit(fitted,variants,total,variant.id,-1))} aria-label={`Less ${variant.title}`}><Minus size={15}/></button>
          <b>{qty}</b>
          <button type="button" disabled={qty===total} onClick={()=>onChange(moveFlavorUnit(fitted,variants,total,variant.id,1))} aria-label={`More ${variant.title}`}><Plus size={15}/></button>
        </div>
      </div>;
    })}</div>
  </div>;
}

export default function FuelToShopPhase8({forecast=[],addLine,openBasket}){
  const rows=useMemo(()=>phase8ForecastRows(forecast),[forecast]);
  const shortfalls=useMemo(()=>phase8Shortfalls(forecast),[forecast]);
  const quantities=useMemo(()=>phase8OrderQuantities(shortfalls),[shortfalls]);
  const units=useMemo(()=>phase8OrderUnits(shortfalls),[shortfalls]);
  const[splitState,setSplitState]=useState({});

  const bottle=byKey('bottle_mix');
  const gel=byKey('energy_gel');
  const hydrate=byKey('hydrate');
  const recover=byKey('recover');
  const regularGelVariants=gel?.variants?.filter(v=>v.title!=='Boost')||[];
  const boostVariant=gel?.variants?.find(v=>v.title==='Boost');

  const getSplit=(key,variants,total)=>fitFlavorSplit(splitState[key],variants,total);
  const setSplit=(key,value)=>setSplitState(current=>({...current,[key]:value}));
  const bottleSplit=getSplit('bottle',bottle?.variants||[],quantities.bottleMix);
  const gelSplit=getSplit('gel',regularGelVariants,quantities.regularGels);
  const hydrateSplit=getSplit('hydrate',hydrate?.variants||[],quantities.hydratePacks);
  const recoverSplit=getSplit('recover',recover?.variants||[],quantities.recover);

  const rowFor=key=>rows.find(row=>row.product_key===key);
  const stockRows=[
    ['bottle_mix','Bottle Mix','sachets',quantities.bottleMix],
    ['energy_gel','Regular gels','gels',quantities.regularGels],
    ['boost_gel','Boost','gels',quantities.boostGels],
    ['hydrate','Hydrate','servings',quantities.hydratePacks],
    ['recover','Recover','servings',quantities.recover]
  ];

  function addShortage(){
    if(!units)return;
    const lines=[
      ...flavorBasketLines(bottle,bottle?.variants||[],bottleSplit),
      ...flavorBasketLines(gel,regularGelVariants,gelSplit),
      ...(quantities.boostGels&&boostVariant?[{product:gel,variant:boostVariant,quantity:quantities.boostGels}]:[]),
      ...flavorBasketLines(hydrate,hydrate?.variants||[],hydrateSplit),
      ...flavorBasketLines(recover,recover?.variants||[],recoverSplit)
    ];
    lines.forEach(line=>addLine(line.product,line.variant,line.quantity));
    openBasket();
  }

  return <div className="stack phase8-fuel-shop">
    <section className="card phase8-shortage-hero">
      <div className="row-between"><div><span className="eyebrow">NEXT {PHASE8_HORIZON_DAYS} DAYS</span><h2>{phase8Headline(shortfalls)}</h2></div>{units?<ShoppingBag size={23}/>:<CheckCircle2 size={23}/>}</div>
      <p className="muted">Your training fuel requirement is compared with the stock you have saved. Only the shortage is added to your existing Just Fuel basket.</p>
      {units>0&&<div className="phase8-shortage-summary">
        {quantities.bottleMix>0&&<span><b>{quantities.bottleMix}</b>Bottle Mix</span>}
        {(quantities.regularGels+quantities.boostGels)>0&&<span><b>{quantities.regularGels+quantities.boostGels}</b>Gels</span>}
        {quantities.hydratePacks>0&&<span><b>{quantities.hydratePacks}</b>Hydrate 10-pack{quantities.hydratePacks===1?'':'s'}</span>}
        {quantities.recover>0&&<span><b>{quantities.recover}</b>Recover</span>}
      </div>}
    </section>

    <section className="card phase8-stock-card">
      <div className="row-between"><div><span className="eyebrow">STOCK VS NEED</span><h3>Exact shortage</h3></div><PackageCheck size={21}/></div>
      {!rows.length?<p className="muted">No 7-day fuel forecast is available yet. Refresh Fuel after your training plan is ready.</p>:<div className="phase8-stock-list">{stockRows.map(([key,label,unit,orderQty])=>{
        const row=rowFor(key);
        const required=Math.ceil(n(row?.required_units));
        const onHand=Math.floor(n(row?.quantity_on_hand));
        const rawShort=Math.ceil(n(row?.shortfall_units));
        const shortLabel=key==='hydrate'?(orderQty?`${orderQty} × 10-pack${orderQty===1?'':'s'}`:'Covered'):(rawShort?`${rawShort} ${unit} short`:'Covered');
        return <div className={rawShort?'short':'covered'} key={key}>
          <div><strong>{label}</strong><small>Need {required} · have {onHand}{key==='hydrate'?' servings':''}</small></div>
          <b>{shortLabel}</b>
        </div>;
      })}</div>}
    </section>

    {units>0&&<section className="card phase8-flavour-section">
      <span className="eyebrow">CHOOSE FLAVOURS</span>
      <h3>Make the shortage your order</h3>
      <p className="muted">Choose the flavour mix now. The basket will keep these exact variants for Shopify or WhatsApp checkout.</p>
      <div className="phase8-flavour-grid">
        <SplitPicker label="Bottle Mix" total={quantities.bottleMix} variants={bottle?.variants||[]} split={bottleSplit} onChange={value=>setSplit('bottle',value)} unitLabel="sachets"/>
        <SplitPicker label="Regular gels" total={quantities.regularGels} variants={regularGelVariants} split={gelSplit} onChange={value=>setSplit('gel',value)} unitLabel="gels"/>
        <SplitPicker label="Hydrate" total={quantities.hydratePacks} variants={hydrate?.variants||[]} split={hydrateSplit} onChange={value=>setSplit('hydrate',value)} unitLabel="10-packs"/>
        <SplitPicker label="Recover" total={quantities.recover} variants={recover?.variants||[]} split={recoverSplit} onChange={value=>setSplit('recover',value)} unitLabel="servings"/>
      </div>
      {quantities.boostGels>0&&<div className="phase8-boost-note"><b>{quantities.boostGels} Boost gel{quantities.boostGels===1?'':'s'}</b> will be added automatically.</div>}
      <button className="primary phase8-add-shortage" onClick={addShortage}><ShoppingBag size={18}/>Add shortage to basket · {units} item{units===1?'':'s'}</button>
      {quantities.hydratePacks>0&&<p className="phase8-pack-note">Hydrate stock is tracked as servings and ordered in 10-packs, so the shortage is rounded up to a full pack automatically.</p>}
    </section>}

    {!units&&rows.length>0&&<section className="card phase8-covered"><CheckCircle2 size={24}/><div><h3>No order needed</h3><p className="muted">Your saved stock covers the next {PHASE8_HORIZON_DAYS} days of planned training.</p></div></section>}
  </div>;
}
