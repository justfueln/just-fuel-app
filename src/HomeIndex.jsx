import React from 'react';
import {Activity,ChevronRight,Flag,Fuel,Store} from 'lucide-react';
import {HOME_INDEX_ITEMS} from './navigation-registry';

const ICONS={training:Activity,race:Flag,fuel:Fuel,shop:Store};

export default function HomeIndex({goRoute}){
  return <main className="home-index">
    <section className="home-index-hero">
      <span className="home-index-kicker">JUST FUEL</span>
      <h1>Train. Race. Fuel.</h1>
      <p>Open the section you need. Everything else stays out of the way.</p>
    </section>
    <section className="home-index-primary">
      {HOME_INDEX_ITEMS.map(item=>{
        const Icon=ICONS[item.id];
        return <button key={item.id} className="home-index-card" onClick={()=>goRoute(item.route)}>
          <span className="home-index-icon"><Icon size={22}/></span>
          <span className="home-index-copy"><strong>{item.title}</strong><small>{item.copy}</small></span>
          <ChevronRight size={20}/>
        </button>;
      })}
    </section>
  </main>;
}
