import './ui-foundation-v11.css';
import './training-native-v11.css';

const loaded={global:false,training:false,race:false};
let smartCoachPromise=null;

function idle(task,timeout=1200){
  const run=()=>Promise.resolve().then(task).catch(error=>console.warn('Deferred Just Fuel enhancement failed:',error));
  if(typeof window==='undefined')return;
  if('requestIdleCallback'in window)window.requestIdleCallback(run,{timeout});
  else window.setTimeout(run,180);
}

function ensureSmartCoach(){
  if(!smartCoachPromise)smartCoachPromise=import('./smart-coach-v2').catch(error=>{smartCoachPromise=null;throw error});
  return smartCoachPromise;
}

export function loadGlobalEnhancements(){
  if(loaded.global)return;
  loaded.global=true;
  idle(()=>Promise.all([import('./basketBridge'),import('./app-analytics'),import('./final-ux-v10')]),1800);
}

export function loadEnhancementsForSection(section){
  if(typeof window==='undefined')return;

  // Home stays first-paint focused: coaching polish loads only once the browser is idle.
  if(section==='home')idle(()=>ensureSmartCoach(),900);

  if(section==='training'&&!loaded.training){
    loaded.training=true;
    Promise.all([
      ensureSmartCoach(),
      // Phase 11: the outer React shell now owns Today / Plan / Progress navigation.
      // Do not load training-simple-flow-v4: it renamed/hid/inserted controls after render.
      import('./training-workout-details'),
      import('./training-multisport-targets-v1'),
      import('./training-feedback')
    ]).catch(error=>console.warn('Training enhancement load failed:',error));
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
    ]),1000);
  }else if(section==='training'){
    ensureSmartCoach().catch(error=>console.warn('Smart Coach load failed:',error));
  }

  if(section==='race'&&!loaded.race){
    loaded.race=true;
    import('./race-addon-stability')
      .then(()=>Promise.all([
        import('./race-goal-progress-v1'),
        import('./race-fuel-rehearsal-v1'),
        import('./race-week-execution-v1'),
        import('./race-fuzzy-search-v1')
      ]))
      .catch(error=>console.warn('Race enhancement load failed:',error));
  }
}

export function enhancementLoadState(){return{...loaded,smartCoach:Boolean(smartCoachPromise)}}