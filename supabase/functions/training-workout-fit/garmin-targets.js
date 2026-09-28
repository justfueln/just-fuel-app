export function normaliseWorkoutMetric(value,{family='',powerLow=null,powerHigh=null,hrLow=null,hrHigh=null,paceFast=null,paceSlow=null}={}){
  const metric=String(value||'').toLowerCase();
  if(['power','heart_rate','pace','rpe'].includes(metric))return metric;
  if(family==='cycling'&&Number(powerLow)>0&&Number(powerHigh)>0)return'power';
  if(Number(hrLow)>0&&Number(hrHigh)>0)return'heart_rate';
  if(family==='running'&&Number(paceFast)>0&&Number(paceSlow)>0)return'pace';
  return'rpe';
}

export function paceSecondsPerKmToFitSpeed(value){
  const pace=Number(value)||0;
  return pace>0?Math.round(100000/pace):0;
}

export function garminTargetForStep({metric='rpe',intensity='active',powerLow=null,powerHigh=null,hrLow=null,hrHigh=null,paceFast=null,paceSlow=null}={}){
  const isActive=intensity==='active'||intensity==='interval';
  if(metric==='power'&&Number(powerLow)>0&&Number(powerHigh)>0){
    return{type:'power',targetValue:0,fitLow:Math.round(Number(powerLow))+1000,fitHigh:Math.round(Number(powerHigh))+1000,displayLow:Math.round(Number(powerLow)),displayHigh:Math.round(Number(powerHigh)),unit:'W'};
  }
  if(isActive&&metric==='heart_rate'&&Number(hrLow)>0&&Number(hrHigh)>0){
    return{type:'heart_rate',targetValue:0,fitLow:Math.round(Number(hrLow))+100,fitHigh:Math.round(Number(hrHigh))+100,displayLow:Math.round(Number(hrLow)),displayHigh:Math.round(Number(hrHigh)),unit:'bpm'};
  }
  if(isActive&&metric==='pace'&&Number(paceFast)>0&&Number(paceSlow)>0){
    const low=paceSecondsPerKmToFitSpeed(paceSlow);
    const high=paceSecondsPerKmToFitSpeed(paceFast);
    if(low>0&&high>0)return{type:'speed',targetValue:0,fitLow:Math.min(low,high),fitHigh:Math.max(low,high),displayLow:Number(paceFast),displayHigh:Number(paceSlow),unit:'sec/km'};
  }
  return{type:'open',targetValue:0,fitLow:null,fitHigh:null,unit:null};
}

export function fitTargetFields(target){
  if(!target||target.type==='open')return{targetType:'open',targetValue:0};
  if(target.type==='power')return{targetType:'power',targetValue:0,customTargetPowerLow:target.fitLow,customTargetPowerHigh:target.fitHigh};
  if(target.type==='heart_rate')return{targetType:'heart_rate',targetValue:0,customTargetHeartRateLow:target.fitLow,customTargetHeartRateHigh:target.fitHigh};
  if(target.type==='speed')return{targetType:'speed',targetValue:0,customTargetSpeedLow:target.fitLow,customTargetSpeedHigh:target.fitHigh};
  return{targetType:'open',targetValue:0};
}
