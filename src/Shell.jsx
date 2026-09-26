import React, { useMemo, useState } from 'react';
import { Activity, BookOpen, Calculator, ExternalLink, Minus, MoreHorizontal, Plus, ShoppingBag, Store, Truck } from 'lucide-react';
import TrainingApp from './App';

const PRODUCTS = [
  {
    key: 'bottle',
    title: 'Bottle Mix',
    subtitle: '59 g carbs per sachet',
    price: 'R 21,80',
    image: 'https://cdn.shopify.com/s/files/1/0719/9365/5338/files/ChatGPT_Image_Aug_29_2026_02_45_26_PM_ea52052b-bd4b-4e7a-9e60-406eceffd8f2.png?v=1788007817',
    url: 'https://www.justfuelnutrition.co.za/products/bottle-mix',
    category: 'Bottle Mix'
  },
  {
    key: 'gel',
    title: 'Energy Gel',
    subtitle: '40 g carbs per gel',
    price: 'From R 21,90',
    image: 'https://cdn.shopify.com/s/files/1/0719/9365/5338/files/rn-image_picker_lib_temp_4e51fcae-fbb2-4851-98f6-84ae9bb75900.png?v=1784470268',
    url: 'https://www.justfuelnutrition.co.za/products/energy-gel',
    category: 'Energy Gels'
  },
  {
    key: 'hydrate',
    title: 'Hydrate',
    subtitle: '10 sachets per pack',
    price: 'R 104,90',
    image: 'https://cdn.shopify.com/s/files/1/0719/9365/5338/files/rn-image_picker_lib_temp_327d4add-5011-48a5-938b-fdf537fe5557.png?v=1778874198',
    url: 'https://www.justfuelnutrition.co.za/products/hydrate',
    category: 'Hydrate'
  },
  {
    key: 'recover',
    title: 'Recover Shake',
    subtitle: 'Carbs + protein',
    price: 'R 29,90',
    image: 'https://cdn.shopify.com/s/files/1/0719/9365/5338/files/ChatGPT_Image_Aug_29_2026_02_50_56_PM.png?v=1788008301',
    url: 'https://www.justfuelnutrition.co.za/products/recover-shake',
    category: 'Recover'
  },
  {
    key: 'protein',
    title: 'Pea Protein',
    subtitle: '1 kg',
    price: 'R 240,00',
    image: 'https://cdn.shopify.com/s/files/1/0719/9365/5338/files/ChatGPTImageJun15_2026_06_09_01PM.png?v=1781539933',
    url: 'https://www.justfuelnutrition.co.za/products/pea-protein',
    category: 'Protein'
  }
];

const NAV = [
  ['Plan', Calculator],
  ['Learn', BookOpen],
  ['Shop', Store],
  ['Training', Activity],
  ['More', MoreHorizontal]
];

export default function Shell(){
  const [section,setSection] = useState('Plan');
  return <div className={`full-shell ${section==='Training'?'training-page':'light-page'}`}>
    {section!=='Training' && <AppHeader/>}
    <div className="shell-content">
      {section==='Plan' && <FuelBuilder onShop={()=>setSection('Shop')}/>} 
      {section==='Learn' && <Learn/>}
      {section==='Shop' && <Shop/>}
      {section==='Training' && <TrainingApp/>}
      {section==='More' && <More/>}
    </div>
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV.map(([label,Icon])=><button key={label} className={section===label?'active':''} onClick={()=>setSection(label)}><Icon size={25}/><span>{label}</span></button>)}
    </nav>
  </div>
}

function AppHeader(){
  return <>
    <div className="delivery-banner"><Truck size={19}/>PUDO delivery: R75 · Free over R600</div>
    <header className="shell-header">
      <div className="wordmark"><b>JUST</b><strong>FUEL</strong><small>ENDURANCE NUTRITION</small></div>
      <a className="bag-button" href="https://www.justfuelnutrition.co.za/cart" target="_blank" rel="noreferrer"><ShoppingBag size={25}/></a>
    </header>
  </>
}

function FuelBuilder({onShop}){
  const [duration,setDuration] = useState(2);
  const [carbs,setCarbs] = useState(90);
  const [bottleMinutes,setBottleMinutes] = useState(90);
  const [bottleMl,setBottleMl] = useState(750);
  const [boost,setBoost] = useState(0);

  const plan = useMemo(()=>{
    const mins = Math.max(30, Number(duration||0)*60);
    const hours = mins/60;
    const bottles = Math.max(1, Math.ceil(mins/Number(bottleMinutes)));
    const targetTotal = Math.round(Number(carbs)*hours);
    const fromBottles = bottles*59;
    const gels = Math.max(0, Math.round(Math.max(0,targetTotal-fromBottles)/40));
    const planned = fromBottles + gels*40;
    const actual = Math.round(planned/hours);
    const fluidPerHour = Math.round(Number(bottleMl)/(Number(bottleMinutes)/60));
    return {hours,bottles,targetTotal,gels,planned,actual,fluidPerHour};
  },[duration,carbs,bottleMinutes,bottleMl]);

  const safeBoost = Math.min(boost,plan.gels);
  const regular = Math.max(0,plan.gels-safeBoost);

  return <main className="public-page planner-page">
    <div className="page-kicker">FUEL SMART. TRAIN HARD.</div>
    <h1>Fuel Planner</h1>
    <p className="page-lead">Tell us how long you are training. We work out the rest.</p>

    <section className="builder-card">
      <label className="big-label">Session duration
        <div className="duration-row"><button onClick={()=>setDuration(Math.max(.5,duration-.5))}>−</button><div><b>{duration}</b><span>hours</span></div><button onClick={()=>setDuration(duration+.5)}>+</button></div>
      </label>

      <div className="builder-label">Carbohydrate target</div>
      <div className="choice-grid">{[50,60,90,120].map(v=><button key={v} className={carbs===v?'selected':''} onClick={()=>setCarbs(v)}>{v}<small>g/h</small></button>)}</div>

      <details className="planner-advanced"><summary>Advanced options</summary>
        <div className="builder-label">One bottle lasts</div>
        <div className="choice-grid three">{[[60,'1h'],[90,'1.5h'],[120,'2h']].map(([v,l])=><button key={v} className={bottleMinutes===v?'selected':''} onClick={()=>setBottleMinutes(v)}>{l}</button>)}</div>
        <div className="builder-label">Bottle size</div>
        <div className="choice-grid two">{[500,750].map(v=><button key={v} className={bottleMl===v?'selected':''} onClick={()=>setBottleMl(v)}>{v} ml</button>)}</div>
      </details>
    </section>

    <section className="plan-result">
      <div className="result-title">For this session</div>
      <div className="result-grid">
        <div><b>{plan.bottles}</b><span>Bottle Mix</span></div>
        <div><b>{regular}</b><span>Regular gels</span></div>
        <div><b>{safeBoost}</b><span>Boost gels</span></div>
        <div><b>{plan.actual}</b><span>actual g/h</span></div>
      </div>
      {plan.gels>0 && <div className="boost-control"><span>Swap regular gels for Boost</span><div><button onClick={()=>setBoost(Math.max(0,safeBoost-1))}><Minus size={18}/></button><b>{safeBoost}</b><button onClick={()=>setBoost(Math.min(plan.gels,safeBoost+1))}><Plus size={18}/></button></div></div>}
      <p className="result-note">Target {plan.targetTotal} g carbs · plan provides {plan.planned} g · about {plan.fluidPerHour} ml fluid/h.</p>
      {carbs===120 && <p className="warning-note">120 g/h should only be used if you have already practised this intake successfully in training.</p>}
      <button className="shop-plan" onClick={onShop}>Shop my fuel</button>
    </section>
  </main>
}

function Shop(){
  const [filter,setFilter] = useState('All fuel');
  const filters=['All fuel','Bottle Mix','Energy Gels','Hydrate','Recover','Protein'];
  const shown=filter==='All fuel'?PRODUCTS:PRODUCTS.filter(p=>p.category===filter);
  return <main className="public-page shop-page">
    <div className="page-kicker">FUEL SMART. TRAIN HARD.</div>
    <h1>Your next session.<br/><span>Sorted.</span></h1>
    <p className="page-lead">Your favourite fuel. Your choice of flavours.</p>
    <div className="category-scroll">{filters.map(f=><button className={filter===f?'active':''} key={f} onClick={()=>setFilter(f)}>{f}</button>)}</div>
    <div className="product-grid">{shown.map(p=><article className="product-card" key={p.key}>
      <a href={p.url} target="_blank" rel="noreferrer"><img src={p.image} alt={p.title}/></a>
      <div className="product-body"><h3>{p.title}</h3><p>{p.subtitle}</p><b>{p.price}</b><a className="product-action" href={p.url} target="_blank" rel="noreferrer">Choose options <ExternalLink size={15}/></a></div>
    </article>)}</div>
  </main>
}

function Learn(){
  const links=[
    ['How to use your fuel','Simple guidance for Bottle Mix, gels, Hydrate and Recover.','https://www.justfuelnutrition.co.za/pages/faq'],
    ['Fuel packs','Starter, weekend and restock ideas.','https://www.justfuelnutrition.co.za/pages/fuel-packs'],
    ['Just Fuel story','Why we make practical, affordable endurance fuel.','https://www.justfuelnutrition.co.za/pages/our-story'],
    ['Latest articles','Training and fueling information from Just Fuel.','https://www.justfuelnutrition.co.za/blogs/news']
  ];
  return <main className="public-page"><div className="page-kicker">LEARN</div><h1>Simple fueling.<br/><span>No guesswork.</span></h1><div className="learn-list">{links.map(([t,d,u])=><a href={u} target="_blank" rel="noreferrer" key={t}><div><h3>{t}</h3><p>{d}</p></div><ExternalLink size={19}/></a>)}</div></main>
}

function More(){
  return <main className="public-page"><div className="page-kicker">JUST FUEL</div><h1>More</h1><div className="learn-list">
    <a href="https://www.justfuelnutrition.co.za" target="_blank" rel="noreferrer"><div><h3>Just Fuel website</h3><p>Products, information and online checkout.</p></div><ExternalLink size={19}/></a>
    <a href="https://wa.me/27614960414" target="_blank" rel="noreferrer"><div><h3>WhatsApp us</h3><p>Questions, orders or fueling help.</p></div><ExternalLink size={19}/></a>
    <a href="https://www.justfuelnutrition.co.za/pages/contact" target="_blank" rel="noreferrer"><div><h3>Contact</h3><p>Collection, delivery and product support.</p></div><ExternalLink size={19}/></a>
  </div><p className="more-foot">Fuel smart. Train hard.</p></main>
}