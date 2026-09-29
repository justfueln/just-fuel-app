import './ui-foundation-v11.css';
import './training-native-v11.css';

const loaded={global:false,training:{today:false,plan:false,progress:false},race:false};
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

function loadTrainingToday(){
  if(loaded.training.today)return;
  loaded.training.today=true;
  // Today must stay extremely light. The native screen already owns the next-session
  // and completion summary, so only the shared coach is allowed to enhance it.
  idle(()=>ensureSmartCoach(),2200,900);
}

function loadTrainingPlan(){
  if(loaded.training.plan)return;
  loaded.training.plan=true;
  // Plan-only helpers are loaded only after the Plan view is actually opened.
  idle(()=>Promise.all([
    ensureSmartCoach(),
    import('./training-workout-details'),
    import('./training-multisport-targets-v1'),
    import('./training-feedback'),
    import('./training-boost-control')
  ]),1600,650);
  idle(()=>Promise.all([
    import('./training-coach-v1'),
    import('./training-weather-v1'),
    import('./training-coach-review-v1'),
    import('./training-adaptive-v1'),
    import('./training-readiness-v1'),
    import('./training-week-learning-v1'),
    import('./training-progression-v1')
  ]),3600,1600);
}

function loadTrainingProgress(){
  if(loaded.training.progress)return;
  loaded.training.progress=true;
  // Performance intelligence is expensive and is irrelevant to Today/Plan. Load it
  // only after the athlete explicitly opens Progress.
  idle(()=>Promise.all([
    ensureSmartCoach(),
    import('./training-ftp-detection-v1'),
    import('./training-power-curve-v1'),
    import('./training-achievements-v1')
  ]),1800,750);
}

export function loadEnhancementsForSection(section,{trainingView='today'}={}){
  if(typeof window==='undefined')return;

  // Never compete with Home/startup for the main thread.
  if(section==='home')idle(()=>ensureSmartCoach(),3200,1800);

  if(section==='training'){
    if(trainingView==='plan')loadTrainingPlan();
    else if(trainingView==='progress')loadTrainingProgress();
    else loadTrainingToday();
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

export function enhancementLoadState(){return{global:loaded.global,training:{...loaded.training},race:loaded.race,smartCoach:Boolean(smartCoachPromise)}}