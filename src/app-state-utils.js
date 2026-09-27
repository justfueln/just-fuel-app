import {MAIN_ROUTE_IDS,TRAINING_TABS,normalizeMainRoute,normalizeTrainingLegacy} from './navigation-registry';

export const MAIN_SECTIONS=MAIN_ROUTE_IDS;
export {TRAINING_TABS};
export const basketTtlMs=14*24*60*60*1000;
export const lastBasketTtlMs=60*24*60*60*1000;

export function normalizeMainSection(value){
  return normalizeMainRoute(value);
}

export function normalizeTrainingTab(value){
  return normalizeTrainingLegacy(value);
}

export function resolveInitialMainSection({historyState,search='',pathname='',returnSection=''}={}){
  const params=new URLSearchParams(search||'');
  if(pathname==='/strava-return'||params.has('strava'))return'training';
  if(returnSection==='Training'||returnSection==='training')return'training';
  return normalizeMainSection(historyState?.jfSection);
}

export function readSavedItems(raw,ttlMs=basketTtlMs,now=Date.now()){
  if(!raw)return[];
  try{
    const parsed=typeof raw==='string'?JSON.parse(raw):raw;
    if(!parsed?.savedAt||now-Number(parsed.savedAt)>ttlMs)return[];
    if(!Array.isArray(parsed.items))return[];
    return parsed.items.filter(x=>x&&x.variantId&&Number(x.quantity)>0).map(x=>({...x,quantity:Number(x.quantity)}));
  }catch{return[]}
}
