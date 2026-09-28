const loaded={global:false,training:false,race:false};

function idle(task,timeout=1200){
  const run=()=>Promise.resolve().then(task).catch(error=>console.warn('Deferred Just Fuel enhancement failed:',error));
  if(typeof window==='undefined')return;
  if('requestIdleCallback'in window)window.requestIdleCallback(run,{timeout});
  else window.setTimeout(run,180);
}

export function loadGlobalEnhancements(){
  if(loaded.global)return;
  loaded.global=true;
  idle(()=>Promise.all([import('./basketBridge'),import('./app-analytics')]),1800);
}

export function loadEnhancementsForSection(section){
  if(typeof window==='undefined')return;
  if(section==='training'&&!loaded.training){
    loaded.training=true;
    Promise.all([
      import('./training-simple-flow-v4'),
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
  }

  if(section==='race'&&!loaded.race){
    loaded.race=true;
    import('./race-addon-stability')
      .then(()=>Promise.all([
        import('./race-goal-progress-v1'),
        import('./race-fuel-rehearsal-v1'),
        import('./race-week-execution-v1')
      ]))
      .catch(error=>console.warn('Race enhancement load failed:',error));
  }
}

export function enhancementLoadState(){return{...loaded}}
