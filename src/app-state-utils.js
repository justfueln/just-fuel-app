export const MAIN_SECTIONS=['Plan','Learn','Shop','Training','More'];
export const TRAINING_TABS=['Overview','My Plan','My Race','Fuel','My Details'];
export const basketTtlMs=14*24*60*60*1000;
export const lastBasketTtlMs=60*24*60*60*1000;

export function normalizeMainSection(value){
  return MAIN_SECTIONS.includes(value)?value:'Plan';
}

export function normalizeTrainingTab(value){
  return TRAINING_TABS.includes(value)?value:'Overview';
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
