export const APP_ROUTES={
  home:{id:'home',label:'Home',trainingTab:null},
  training:{id:'training',label:'Training',trainingTab:'My Plan'},
  race:{id:'race',label:'Race',trainingTab:'My Race'},
  fuel:{id:'fuel',label:'Fuel',trainingTab:null},
  shop:{id:'shop',label:'Shop',trainingTab:null}
};

export const BOTTOM_NAV=['home','training','race','fuel','shop'];
export const MAIN_ROUTE_IDS=BOTTOM_NAV.slice();

export const TRAINING_NAV=[
  {id:'plan',label:'Plan',legacyTab:'My Plan',subView:null},
  {id:'history',label:'History',legacyTab:'History',subView:'History'},
  {id:'performance',label:'Performance',legacyTab:'History',subView:'Performance'},
  {id:'review',label:'Review',legacyTab:'History',subView:'Compare'}
];

export const RACE_NAV=[
  {id:'races',label:'My Races'},
  {id:'registry',label:'Event Registry'},
  {id:'overview',label:'Overview'},
  {id:'stages',label:'Stages',stageOnly:true},
  {id:'stage',label:'Stage',stageOnly:true,detail:true},
  {id:'fuel',label:'Fuel & Hydration'},
  {id:'water',label:'Water Points'},
  {id:'checklist',label:'Checklist'}
];

// Phase 4 Fuel pages. Race fueling remains inside the selected Race so the
// athlete never has to guess whether a race plan belongs under Race or Fuel.
export const FUEL_NAV=[
  {id:'home',label:'Fuel Home',copy:'Your next-week fuel requirement and stock status.'},
  {id:'planner',label:'Quick Fuel Planner',copy:'Build a simple fuel plan for any ride or session.'},
  {id:'training',label:'Training Fuel',copy:'See exactly what your upcoming training plan requires.',requiresLogin:true},
  {id:'review',label:'Fuel Review',copy:'Compare planned intake with what you actually consumed.',requiresLogin:true},
  {id:'stock',label:'My Stock',copy:'Keep your Just Fuel cupboard quantities up to date.',requiresLogin:true},
  {id:'order',label:'Order Needed',copy:'See only the shortfall for the next 7, 14 or 30 days.',requiresLogin:true}
];

export function normalizeFuelView(value){
  const aliases={home:'home',overview:'home',planner:'planner','Quick Fuel Planner':'planner',training:'training','Training Fuel':'training',review:'review','Fuel Review':'review',stock:'stock','My Stock':'stock',order:'order','Order Needed':'order'};
  return aliases[value]||'home';
}

export const TRAINING_VIEWS=[
  {id:'overview',label:'Overview',legacy:'Overview',area:'training'},
  {id:'plan',label:'Plan',legacy:'My Plan',area:'training'},
  {id:'history',label:'History',legacy:'History',area:'training'},
  {id:'race',label:'Race',legacy:'My Race',area:'race'},
  {id:'fuel',label:'Fuel',legacy:'Fuel',area:'fuel'},
  {id:'details',label:'Athlete Details',legacy:'My Details',area:'profile'}
];

export const TRAINING_TABS=TRAINING_VIEWS.map(x=>x.legacy);

const MAIN_ALIASES={
  home:'home',Home:'home',Plan:'home',Learn:'home',More:'home',
  training:'training',Training:'training',
  race:'race',Race:'race','My Race':'race','My Season':'race',
  fuel:'fuel',Fuel:'fuel',
  shop:'shop',Shop:'shop'
};

export function normalizeMainRoute(value){
  return MAIN_ALIASES[value]||'home';
}

export function trainingTabForRoute(route){
  return APP_ROUTES[normalizeMainRoute(route)]?.trainingTab||null;
}

export function normalizeTrainingLegacy(value){
  const direct=TRAINING_VIEWS.find(x=>x.legacy===value||x.id===value||x.label===value);
  if(direct)return direct.legacy;
  if(value==='My Season')return'My Race';
  if(value==='Performance'||value==='Review'||value==='Compare')return'History';
  return'My Plan';
}

export function normalizeTrainingView(value){
  const aliases={
    plan:'plan','My Plan':'plan',
    history:'history',History:'history',
    performance:'performance',Performance:'performance',
    review:'review',Review:'review',Compare:'review','Plan vs Actual':'review'
  };
  return aliases[value]||'plan';
}

export function trainingTargetForView(value){
  const id=normalizeTrainingView(value);
  return TRAINING_NAV.find(item=>item.id===id)||TRAINING_NAV[0];
}

export function trainingViewFromState(state={}){
  if(state?.jfTrainingView)return normalizeTrainingView(state.jfTrainingView);
  if(state?.jfTrainingTab==='History'){
    if(state?.jfTrainingSubView==='Performance')return'performance';
    if(state?.jfTrainingSubView==='Compare')return'review';
    return'history';
  }
  return'plan';
}

export function appAreaForTrainingTab(value){
  const legacy=normalizeTrainingLegacy(value);
  return TRAINING_VIEWS.find(x=>x.legacy===legacy)?.area||'training';
}

export const HOME_INDEX_ITEMS=[
  {id:'training',title:'Training',copy:'Plan, history, performance and training review.',route:'training'},
  {id:'race',title:'Race',copy:'Your races, race guides, stages, water points and execution.',route:'race'},
  {id:'fuel',title:'Fuel',copy:'Training fuel, reviews, stock and order requirements.',route:'fuel'},
  {id:'shop',title:'Shop',copy:'Browse Just Fuel products and checkout.',route:'shop'},
  {id:'planner',title:'Quick Fuel Planner',copy:'Build a simple fuel plan for any ride or session.',route:'fuel',fuelView:'planner'},
  {id:'learn',title:'Learn',copy:'Fueling basics, product guidance and practical race-day advice.',homeView:'learn'},
  {id:'settings',title:'Settings & Reminders',copy:'Install the app, reminders, help and account utilities.',homeView:'settings'}
];
