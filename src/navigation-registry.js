export const APP_ROUTES={
  home:{id:'home',label:'Home',trainingTab:null},
  training:{id:'training',label:'Training',trainingTab:'Overview'},
  race:{id:'race',label:'Race',trainingTab:'My Race'},
  fuel:{id:'fuel',label:'Fuel',trainingTab:'Fuel'},
  shop:{id:'shop',label:'Shop',trainingTab:null}
};

export const BOTTOM_NAV=['home','training','race','fuel','shop'];
export const MAIN_ROUTE_IDS=BOTTOM_NAV.slice();

export const TRAINING_VIEWS=[
  {id:'overview',label:'Overview',legacy:'Overview',area:'training'},
  {id:'plan',label:'My Plan',legacy:'My Plan',area:'training'},
  {id:'history',label:'History',legacy:'History',area:'training'},
  {id:'race',label:'My Race',legacy:'My Race',area:'race'},
  {id:'fuel',label:'Fuel',legacy:'Fuel',area:'fuel'},
  {id:'details',label:'My Details',legacy:'My Details',area:'training'}
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
  return'Overview';
}

export function appAreaForTrainingTab(value){
  const legacy=normalizeTrainingLegacy(value);
  return TRAINING_VIEWS.find(x=>x.legacy===legacy)?.area||'training';
}

export const HOME_INDEX_ITEMS=[
  {id:'training',title:'Training',copy:'Plan, history, performance and training review.',route:'training'},
  {id:'race',title:'Race',copy:'Your races, race guides, stages, water points and execution.',route:'race'},
  {id:'fuel',title:'Fuel',copy:'Training fuel, race fuel, reviews, stock and requirements.',route:'fuel'},
  {id:'shop',title:'Shop',copy:'Browse Just Fuel products and checkout.',route:'shop'},
  {id:'planner',title:'Quick Fuel Planner',copy:'Build a simple fuel plan without opening Training.',homeView:'plan'},
  {id:'learn',title:'Learn',copy:'Fueling basics, product guidance and practical race-day advice.',homeView:'learn'},
  {id:'settings',title:'Settings & Reminders',copy:'Install the app, reminders, help and account utilities.',homeView:'settings'}
];
