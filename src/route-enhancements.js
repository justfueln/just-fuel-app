import './ui-foundation-v11.css';
import './training-native-v11.css';

const loaded={global:false,training:false,race:false};
let smartCoachPromise=null;

function idle(task,timeout=1200,fallback=250){
  const run=()=>Promise.resolve().then(task).catch(error=>console.warn('Deferred Just Fuel enhancement failed:',error));
  if(typeof window==='undefined')return;
  if('requestIdleCallback'in window)window.requestIdleCallback(run,{timeout});
  else window.setTimeout(run,fallback);
}

function ensureSmartCoach(){
  if(!smartCoachPromise)smartCoachPromise=import('./smart-coach-v2').catch(error=>{smartCoachPromise=null;throw error});
  return smartCoachPromise;
}

export function loadGlobalEnhancements(){
  if(loaded.global)return;
  loaded.global=true;
  idle(()=>Promise.all([import('./basketBridge'),import('./app-analytics'),import('./final-ux-v10')]),3000,1200);
}

export function loadEnhancementsForSection(section){
  if(typeof window==='undefined')return;

  // Never compete with Home/startup for the main thread.
  if(section==='home')idle(()=>ensureSmartCoach(),3200,1800);

  if(section==='training'&&!loaded.training){
    loaded.training=true;

    // First let the native Training screen become interactive. These modules enhance
    // existing content but are not required for the first tap/paint.
    idle(()=>Promise.all([
      ensureSmartCoach(),
      import('./training-workout-details'),
      import('./training-multisport-targets-v1'),
      import('./training-feedback')
    ]),2200,900);

    // Deeper coaching/performance helpers are deliberately later so lower-end phones
    // do not parse and execute a large enhancement burst immediately after navigation.
    idle(()=>Promise.all([
      import('./training-boost-control'),
      import('./training-coach-v1'),
      import('./training-weather-v1'),
      import('./training-coach-review-v1'),
      import('./training-adaptive-v1'),
      import('./training-readiness-v1'),
      import('./training-week-learning-v1'),
      import('./training-progression-v1'),
      import('./training-ftp-detection-v1'),
      import('./training-power-curve-v1'),
      import('./training-achievements-v1')
    ]),5200,2600);
  }else if(section==='training'){
    idle(()=>ensureSmartCoach(),1600,700);
  }

  if(section==='race'&&!loaded.race){
    loaded.race=true;
    idle(()=>import('./race-addon-stability')
      .then(()=>Promise.all([
        import('./race-goal-progress-v1'),
        import('./race-fuel-rehearsal-v1'),
        import('./race-week-execution-v1'),
        import('./race-fuzzy-search-v1')
      ])),1800,700);
  }
}

export function enhancementLoadState(){return{...loaded,smartCoach:Boolean(smartCoachPromise)}}