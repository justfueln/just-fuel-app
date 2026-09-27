import fs from 'node:fs';

function replaceOnce(source,from,to,label){
  const count=source.split(from).length-1;
  if(count!==1)throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(from,to);
}

{
  const path='src/AppV3.jsx';
  let source=fs.readFileSync(path,'utf8');
  source=replaceOnce(source,
    `  const[fuelLoaded,setFuelLoaded]=useState(false);\n  const[loaded,setLoaded]=useState({plan:false,races:false,profile:false,fuelBase:false});`,
    `  const[fuelLoaded,setFuelLoaded]=useState(false);\n  const[fuelTabLoading,setFuelTabLoading]=useState(false);\n  const[loaded,setLoaded]=useState({plan:false,races:false,profile:false,fuelBase:false});`,
    'fuel loading state');
  source=replaceOnce(source,
    `  useEffect(()=>{if(session?.user){setLoaded({plan:false,races:false,profile:false,fuelBase:false});setFuelLoaded(false);loadCore()}},[session?.user?.id]);`,
    `  useEffect(()=>{if(session?.user){setLoaded({plan:false,races:false,profile:false,fuelBase:false});setFuelLoaded(false);setFuelTabLoading(false);loadCore()}},[session?.user?.id]);`,
    'session reset');
  source=replaceOnce(source,
    `    else if(tab==='Fuel'&&(!loaded.plan||!loaded.races||!loaded.fuelBase||!fuelLoaded))ensureFuelTab();\n  },[tab,session?.user?.id,loaded.plan,loaded.races,loaded.profile,loaded.fuelBase,fuelLoaded]);`,
    `    else if(tab==='Fuel'&&!fuelTabLoading&&(!loaded.plan||!loaded.races||!loaded.fuelBase||!fuelLoaded))ensureFuelTab();\n  },[tab,session?.user?.id,loaded.plan,loaded.races,loaded.profile,loaded.fuelBase,fuelLoaded,fuelTabLoading]);`,
    'fuel loading effect guard');
  source=replaceOnce(source,
    `  async function ensureFuelTab({force=false}={}){\n    const tasks=[];if(force||!loaded.plan)tasks.push(loadPlan());if(force||!loaded.races)tasks.push(loadRaces());if(force||!loaded.fuelBase)tasks.push(loadFuelBase());if(force||!fuelLoaded)tasks.push(loadFuelForecast());await Promise.all(tasks);\n  }`,
    `  async function ensureFuelTab({force=false}={}){\n    if(fuelTabLoading)return;setFuelTabLoading(true);\n    try{const tasks=[];if(force||!loaded.plan)tasks.push(loadPlan());if(force||!loaded.races)tasks.push(loadRaces());if(force||!loaded.fuelBase)tasks.push(loadFuelBase());if(force||!fuelLoaded)tasks.push(loadFuelForecast());await Promise.all(tasks)}finally{setFuelTabLoading(false)}\n  }`,
    'ensure fuel loading lock');
  source=replaceOnce(source,
    `  async function reloadAfterRace(){setLoaded(v=>({...v,plan:false,races:false}));setFuelLoaded(false);await Promise.all([loadCore({keepMessage:true}),loadRaces()])}`,
    `  async function reloadAfterRace(){setLoaded(v=>({...v,plan:false}));setFuelLoaded(false);await Promise.all([loadCore({keepMessage:true}),loadRaces()])}`,
    'race reload duplicate guard');
  source=replaceOnce(source,
    `  async function reloadFuel(){setFuelLoaded(false);await Promise.all([loadPlan(),loadFuelBase(),loadFuelForecast()])}`,
    `  async function reloadFuel(){await Promise.all([loadPlan(),loadFuelBase(),loadFuelForecast()])}`,
    'fuel reload duplicate guard');
  const oldSync=`  async function syncStrava(){if(syncLoading)return;setSyncLoading(true);setMessage('Syncing Strava and adapting your plan…');const{data,error}=await supabase.functions.invoke('strava-sync',{body:{}});if(error)setMessage(error.message);else{const note=data?.plan_adaptation?.changed_sessions?\` \${data.plan_adaptation.changed_sessions} upcoming sessions checked/adjusted.\`:'';const stamp=new Date().toISOString();localStorage.setItem('jf-strava-last-sync',stamp);setLastSync(stamp);setLoaded(v=>({...v,plan:false}));setFuelLoaded(false);setMessage(\`Strava synced.\${note}\`);await loadCore({keepMessage:true});if(tab==='My Plan')await loadPlan();else if(tab==='Fuel')await ensureFuelTab({force:true})}setSyncLoading(false)}`;
  const newSync=`  async function syncStrava(){if(syncLoading)return;setSyncLoading(true);setMessage('Syncing Strava and adapting your plan…');const{data,error}=await supabase.functions.invoke('strava-sync',{body:{}});if(error)setMessage(error.message);else{const note=data?.plan_adaptation?.changed_sessions?\` \${data.plan_adaptation.changed_sessions} upcoming sessions checked/adjusted.\`:'';const stamp=new Date().toISOString();localStorage.setItem('jf-strava-last-sync',stamp);setLastSync(stamp);setMessage(\`Strava synced.\${note}\`);await loadCore({keepMessage:true});if(tab==='Fuel')await ensureFuelTab({force:true});else{setFuelLoaded(false);if(tab==='My Plan')await loadPlan();else setLoaded(v=>({...v,plan:false}))}}setSyncLoading(false)}`;
  source=replaceOnce(source,oldSync,newSync,'Strava lazy reload');
  source=replaceOnce(source,
    `  async function signOut(){await supabase.auth.signOut();setSession(null);setTab('Overview');setMessage('');setOtp('');setOtpSent(false);setLoaded({plan:false,races:false,profile:false,fuelBase:false});setFuelLoaded(false)}`,
    `  async function signOut(){await supabase.auth.signOut();setSession(null);setTab('Overview');setMessage('');setOtp('');setOtpSent(false);setLoaded({plan:false,races:false,profile:false,fuelBase:false});setFuelLoaded(false);setFuelTabLoading(false)}`,
    'signout loading reset');
  fs.writeFileSync(path,source);
}

{
  const path='src/ShellNextV3.jsx';
  let source=fs.readFileSync(path,'utf8');
  source=replaceOnce(source,
    `  function addLine(product,variant,quantity=1,{openBasket=false}={}){`,
    `  function addLine(product,variant,quantity=1,{openBasket:shouldOpen=false}={}){`,
    'addLine basket option');
  source=replaceOnce(source,
    `    if(openBasket) setBasketOpen(true);`,
    `    if(shouldOpen) openBasket();`,
    'addLine history-aware open');
  fs.writeFileSync(path,source);
}

console.log('Phase 5 loading safeguards applied.');
