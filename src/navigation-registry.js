export const APP_ROUTES={
  home:{id:'home',label:'Home',trainingTab:null},
  training:{id:'training',label:'Training',trainingTab:'Overview'},
  race:{id:'race',label:'Race',trainingTab:'My Race'},
  fuel:{id:'fuel',label:'Fuel',trainingTab:null},
  shop:{id:'shop',label:'Shop',trainingTab:null}
};

export const BOTTOM_NAV=['home','training','race','fuel','shop'];
export const MAIN_ROUTE_IDS=BOTTOM_NAV.slice();

// Roadmap V2 Phase 3: Training has three everyday destinations only.
export const TRAINING_NAV=[
  {id:'today',label:'Today',legacyTab:'Overview',subView:null,group:'primary'},
  {id:'plan',label:'Plan',legacyTab:'My Plan',subView:null,group:'primary'},
  {id:'progress',label:'Progress',legacyTab:'History',subView:'Progress',group:'primary'}
];

export const RACE_NAV=[
  {id:'races',label:'My Races',group:'root'},
  {id:'registry',label:'Event Registry',group:'action'},
  {id:'overview',label:'Overview',group:'primary'},
  {id:'stages',label:'Stages',stageOnly:true,group:'more'},
  {id:'stage',label:'Stage',stageOnly:true,detail:true,group:'detail'},
  {id:'fuel',label:'Fuel & Hydration',group:'primary'},
  {id:'water',label:'Water Points',group:'more'},
  {id:'checklist',label:'Checklist',group:'more'}
];

export const FUEL_NAV=[
  {id:'home',label:'Fuel Home',copy:'Your next-week fuel requirement and stock status.',group:'root'},
  {id:'planner',label:'Quick Fuel Planner',copy:'Build a simple fuel plan for any ride or session.',group:'primary'},
  {id:'training',label:'Training Fuel',copy:'See exactly what your upcoming training plan requires.',requiresLogin:true,group:'primary'},
  {id:'review',label:'Fuel Review',copy:'Compare planned intake with what you actually consumed.',requiresLogin:true,group:'more'},
  {id:'stock',label:'My Stock',copy:'Keep your Just Fuel cupboard quantities up to date.',requiresLogin:true,group:'more'},
  {id:'order',label:'Order Needed',copy:'See only the shortfall for the next 7, 14 or 30 days.',requiresLogin:true,group:'more'}
];

export function normalizeFuelView(value){
  const aliases={home:'home',overview:'home',planner:'planner','Quick Fuel Planner':'planner',training:'training','Training Fuel':'training',review:'review','Fuel Review':'review',stock:'stock','My Stock':'stock',order:'order','Order Needed':'order'};
  return aliases[value]||'home';
}

export const PROFILE_NAV=[
  {id:'home',label:'Profile & Settings',group:'root'},
  {id:'details',label:'Athlete Details',group:'primary'},
  {id:'connections',label:'Strava & Connections',group:'primary'},
  {id:'reminders',label:'Reminders',group:'more'},
  {id:'learn',label:'Learn',group:'more'},
  {id:'install',label:'Install & Help',group:'more'}
];

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

export function normalizeMainRoute(value){return MAIN_ALIASES[value]||'home'}
export function trainingTabForRoute(route){return APP_ROUTES[normalizeMainRoute(route)]?.trainingTab||null}
export function normalizeTrainingLegacy(value){const direct=TRAINING_VIEWS.find(x=>x.legacy===value||x.id===value||x.label===value);if(direct)return direct.legacy;if(value==='Today')return'Overview';if(value==='My Season')return'My Race';if(value==='Progress'||value==='Performance'||value==='Review'||value==='Compare'||value==='Plan vs Actual')return'History';return'My Plan'}
export function normalizeTrainingView(value){
  const aliases={
    today:'today',Today:'today',overview:'today',Overview:'today',
    plan:'plan','My Plan':'plan',
    progress:'progress',Progress:'progress',history:'progress',History:'progress',performance:'progress',Performance:'progress',review:'progress',Review:'progress',Compare:'progress','Plan vs Actual':'progress'
  };
  return aliases[value]||'today';
}
export function trainingTargetForView(value){const id=normalizeTrainingView(value);return TRAINING_NAV.find(item=>item.id===id)||TRAINING_NAV[0]}
export function trainingViewFromState(state={}){
  if(state?.jfTrainingView)return normalizeTrainingView(state.jfTrainingView);
  if(state?.jfTrainingTab==='Overview')return'today';
  if(state?.jfTrainingTab==='My Plan')return'plan';
  if(state?.jfTrainingTab==='History')return'progress';
  return'today';
}
export function appAreaForTrainingTab(value){const legacy=normalizeTrainingLegacy(value);return TRAINING_VIEWS.find(x=>x.legacy===legacy)?.area||'training'}

export const HOME_INDEX_ITEMS=[
  {id:'training',title:'Training',copy:'Today, your plan and progress in one simple flow.',route:'training'},
  {id:'race',title:'Race',copy:'Your races, race guides, stages, water points and execution.',route:'race'},
  {id:'fuel',title:'Fuel',copy:'Planner, training fuel, reviews, stock and order requirements.',route:'fuel'},
  {id:'shop',title:'Shop',copy:'Browse Just Fuel products and checkout.',route:'shop'}
];
