import {hydratePacks,restockShortfalls,wholeUnits} from './fuel-utils.js';

export const PHASE8_HORIZON_DAYS=7;

export function phase8ForecastRows(forecast=[]){
  return (forecast||[]).filter(row=>Number(row?.horizon_days)===PHASE8_HORIZON_DAYS);
}

export function phase8Shortfalls(forecast=[]){
  return restockShortfalls(phase8ForecastRows(forecast));
}

export function phase8OrderQuantities(shortfalls={}){
  return{
    bottleMix:wholeUnits(shortfalls.bottle_mix),
    regularGels:wholeUnits(shortfalls.energy_gel),
    boostGels:wholeUnits(shortfalls.boost_gel),
    hydratePacks:hydratePacks(shortfalls.hydrate),
    recover:wholeUnits(shortfalls.recover)
  };
}

export function phase8OrderUnits(shortfalls={}){
  const q=phase8OrderQuantities(shortfalls);
  return q.bottleMix+q.regularGels+q.boostGels+q.hydratePacks+q.recover;
}

export function phase8Headline(shortfalls={}){
  const q=phase8OrderQuantities(shortfalls);
  const gels=q.regularGels+q.boostGels;
  const parts=[];
  if(q.bottleMix)parts.push(`${q.bottleMix} Bottle Mix`);
  if(gels)parts.push(`${gels} gel${gels===1?'':'s'}`);
  if(parts.length)return`You need ${parts.join(' + ')} for the next ${PHASE8_HORIZON_DAYS} days.`;
  if(q.hydratePacks||q.recover)return`You have a fuel shortage for the next ${PHASE8_HORIZON_DAYS} days.`;
  return`You have enough fuel for the next ${PHASE8_HORIZON_DAYS} days.`;
}
