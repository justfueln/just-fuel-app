import React from 'react';
import {Activity,BookOpen,Calculator,ChevronRight,Flag,Fuel,Settings,Store} from 'lucide-react';
import {HOME_INDEX_ITEMS} from './navigation-registry';

const ICONS={training:Activity,race:Flag,fuel:Fuel,shop:Store,planner:Calculator,learn:BookOpen,settings:Settings};

export default function HomeIndex({goRoute,openHomeView}){
  return <main className="home-index">
    <section className="home-index-hero">
      <span className="home-index-kicker">JUST FUEL</span>
      <h1>Everything in one place.</h1>
      <p>Training, race planning, fueling and ordering — organised around what you need to do next.</p>
    </section>

    <section className="home-index-primary">
      {HOME_INDEX_ITEMS.slice(0,4).map(item=>{
        const Icon=ICONS[item.id];
        return <button key={item.id} className="home-index-card" onClick={()=>goRoute(item.route,{fuelView:item.fuelView})}>
          <span className="home-index-icon"><Icon size={22}/></span>
          <span className="home-index-copy"><strong>{item.title}</strong><small>{item.copy}</small></span>
          <ChevronRight size={20}/>
        </button>;
      })}
    </section>

    <section className="home-index-tools">
      <span className="home-index-section-label">TOOLS & SETTINGS</span>
      {HOME_INDEX_ITEMS.slice(4).map(item=>{
        const Icon=ICONS[item.id];
        const action=item.route?()=>goRoute(item.route,{fuelView:item.fuelView}):()=>openHomeView(item.homeView);
        return <button key={item.id} className="home-index-tool" onClick={action}>
          <span><Icon size={19}/></span>
          <div><strong>{item.title}</strong><small>{item.copy}</small></div>
          <ChevronRight size={18}/>
        </button>;
      })}
    </section>
  </main>;
}
