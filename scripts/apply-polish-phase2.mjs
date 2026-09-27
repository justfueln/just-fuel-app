import fs from 'node:fs';

const path='src/AppV3.jsx';
let source=fs.readFileSync(path,'utf8');
function replaceOnce(from,to,label){
  const count=source.split(from).length-1;
  if(count!==1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source=source.replace(from,to);
}

replaceOnce(
  `function sportLabel(v){return String(v||'').replaceAll('_',' ').replace(/\\b\\w/g,m=>m.toUpperCase())}`,
  `function sportLabel(v){return String(v||'').replaceAll('_',' ').replace(/\\b\\w/g,m=>m.toUpperCase())}\nfunction syncLabel(v){if(!v)return'Connected · adaptive plan enabled';const d=new Date(v);if(Number.isNaN(d.getTime()))return'Connected · adaptive plan enabled';return\`Connected · last sync \${new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}\`}`,
  'Strava sync label helper',
);

replaceOnce(
  `  const[email,setEmail]=useState(''),[otp,setOtp]=useState(''),[otpSent,setOtpSent]=useState(false),[message,setMessage]=useState('');`,
  `  const[email,setEmail]=useState(''),[otp,setOtp]=useState(''),[otpSent,setOtpSent]=useState(false),[message,setMessage]=useState('');\n  const[lastSync,setLastSync]=useState(()=>localStorage.getItem('jf-strava-last-sync')||'');`,
  'last sync state',
);

replaceOnce(
  `  useEffect(()=>{if(session?.user){loadAll();supabase.functions.invoke('event-catalog-refresh',{body:{force:false}}).catch(()=>{})}},[session?.user?.id]);`,
  `  useEffect(()=>{if(session?.user)loadAll()},[session?.user?.id]);`,
  'remove duplicate event catalogue refresh on login',
);

replaceOnce(
  `  async function syncStrava(){if(syncLoading)return;setSyncLoading(true);setMessage('Syncing Strava and adapting your plan…');const{data,error}=await supabase.functions.invoke('strava-sync',{body:{}});if(error)setMessage(error.message);else{const note=data?.plan_adaptation?.changed_sessions?\` \${data.plan_adaptation.changed_sessions} upcoming sessions checked/adjusted.\`:'';setMessage(\`Strava synced.\${note}\`);await loadAll({keepMessage:true})}setSyncLoading(false)}`,
  `  async function syncStrava(){if(syncLoading)return;setSyncLoading(true);setMessage('Syncing Strava and adapting your plan…');const{data,error}=await supabase.functions.invoke('strava-sync',{body:{}});if(error)setMessage(error.message);else{const note=data?.plan_adaptation?.changed_sessions?\` \${data.plan_adaptation.changed_sessions} upcoming sessions checked/adjusted.\`:'';const stamp=new Date().toISOString();localStorage.setItem('jf-strava-last-sync',stamp);setLastSync(stamp);setMessage(\`Strava synced.\${note}\`);await loadAll({keepMessage:true})}setSyncLoading(false)}`,
  'remember Strava sync time',
);

replaceOnce(
  `{tab==='Overview'&&<Overview home={home} setup={setup} nextAction={nextAction} onConnect={connectStrava} onSync={syncStrava} syncLoading={syncLoading} go={setTab}/>} `,
  `{tab==='Overview'&&<Overview home={home} setup={setup} nextAction={nextAction} onConnect={connectStrava} onSync={syncStrava} syncLoading={syncLoading} lastSync={lastSync} go={setTab}/>} `,
  'pass last sync to Overview',
);

replaceOnce(
  `function Overview({home,setup,nextAction,onConnect,onSync,syncLoading,go})`,
  `function Overview({home,setup,nextAction,onConnect,onSync,syncLoading,lastSync,go})`,
  'Overview last sync prop',
);

replaceOnce(
  `<div className="card-title"><Bike size={19}/>Next session</div>`,
  `<div className="card-title"><Bike size={19}/>{home?.next_session_date===localDateKey()?'Today':'Next session'}</div>`,
  'Today label',
);

replaceOnce(
  `{setup?.strava_connected?'Connected · adaptive plan enabled':'Not connected'}`,
  `{setup?.strava_connected?syncLabel(lastSync):'Not connected'}`,
  'Strava sync status text',
);

fs.writeFileSync(path,source);
console.log('Phase 2 polish applied.');
