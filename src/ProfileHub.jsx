import React,{useEffect,useMemo,useState} from 'react';
import {Activity,ArrowLeft,Bell,BookOpen,CalendarPlus,Check,ChevronRight,Download,ExternalLink,HelpCircle,Link2,LogOut,RefreshCw,Save,UserRound} from 'lucide-react';
import {supabase} from './main';
import {LearnPage} from './CommercePages';
import {SHOP_DOMAIN,WHATSAPP_NUMBER} from './catalog';
import {DAY_NAMES,REMINDER_DEFAULT,buildReminderIcs,nextReminderLabel} from './reminder-utils';
import {fetchTrainingProfile,startTrainingStrava,syncTrainingStrava} from './training-api';

const DAY_OPTIONS=[[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[7,'Sun']];

export default function ProfileHub({onClose,reminder,setReminder,requestReminderPermission,installed,installPrompt,installApp}){
  const[page,setPage]=useState('home');
  const[session,setSession]=useState(null);
  const[setup,setSetup]=useState(null);
  const[profile,setProfile]=useState(null);
  const[loading,setLoading]=useState(true);
  const[status,setStatus]=useState('');

  async function load(){
    setLoading(true);setStatus('');
    const{data}=await supabase.auth.getSession();
    const next=data.session||null;setSession(next);
    if(next?.user){
      const[setupResult,profileResult]=await Promise.all([
        supabase.from('training_setup_status').select('*').eq('user_id',next.user.id).maybeSingle(),
        fetchTrainingProfile(supabase,next.user.id)
      ]);
      if(setupResult.error||profileResult.error)setStatus(setupResult.error?.message||profileResult.error?.message);
      setSetup(setupResult.data||null);setProfile(profileResult.profile||null);
    }else{setSetup(null);setProfile(null)}
    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  function open(next){setPage(next);setStatus('');window.scrollTo({top:0,behavior:'smooth'})}
  function back(){if(page==='home')onClose?.();else{setPage('home');setStatus('');window.scrollTo({top:0,behavior:'smooth'})}}
  async function signOut(){await supabase.auth.signOut();setSession(null);setSetup(null);setProfile(null);setStatus('Signed out.');}

  if(page==='details')return <ProfileFrame title="Athlete Details" subtitle="Your training availability and performance inputs." onBack={back}><AthleteDetails session={session} profile={profile} onSaved={load}/></ProfileFrame>;
  if(page==='connections')return <ProfileFrame title="Connections" subtitle="Manage Strava and training sync." onBack={back}><Connections session={session} setup={setup} reload={load}/></ProfileFrame>;
  if(page==='reminders')return <ProfileFrame title="Reminders" subtitle="Choose when Just Fuel should prompt your weekly fuel check." onBack={back}><ReminderSettings reminder={reminder} setReminder={setReminder} requestReminderPermission={requestReminderPermission}/></ProfileFrame>;
  if(page==='learn')return <ProfileFrame title="Learn" subtitle="Fueling basics and practical guidance." onBack={back}><LearnPage/></ProfileFrame>;
  if(page==='install')return <ProfileFrame title="Install & Help" subtitle="App installation, website and support." onBack={back}><InstallHelp installed={installed} installPrompt={installPrompt} installApp={installApp}/></ProfileFrame>;

  const strava=Boolean(setup?.strava_connected);
  return <div className="profile-hub">
    <div className="profile-hub-top"><button onClick={onClose} aria-label="Close profile"><ArrowLeft size={20}/></button><div><span>ACCOUNT</span><strong>Profile & Settings</strong></div></div>
    <section className="profile-account-card">
      <div className="profile-avatar"><UserRound size={25}/></div>
      <div><span>{session?.user?'SIGNED IN':'NOT SIGNED IN'}</span><strong>{session?.user?.email||'Training account not connected'}</strong><small>{loading?'Checking account…':strava?'Strava connected · adaptive training enabled':'Connect Strava under Connections'}</small></div>
    </section>
    {status&&<div className="notice">{status}</div>}
    <div className="profile-menu">
      <ProfileItem icon={UserRound} title="Athlete Details" copy="Training days, FTP, weight and advanced athlete settings." onClick={()=>open('details')}/>
      <ProfileItem icon={Link2} title="Strava & Connections" copy={strava?'Strava connected. Sync or disconnect here.':'Connect Strava and manage training sync.'} onClick={()=>open('connections')}/>
      <ProfileItem icon={Bell} title="Reminders" copy="Weekly fuel-check reminder and phone calendar alert." onClick={()=>open('reminders')}/>
      <ProfileItem icon={BookOpen} title="Learn" copy="Fueling basics, product use and race-day guidance." onClick={()=>open('learn')}/>
      <ProfileItem icon={Download} title="Install & Help" copy="Install the app, open the website or contact Just Fuel." onClick={()=>open('install')}/>
    </div>
    {session?.user&&<button className="profile-signout" onClick={signOut}><LogOut size={18}/>Sign out</button>}
  </div>;
}

function ProfileFrame({title,subtitle,onBack,children}){return <div className="profile-page"><div className="profile-hub-top"><button onClick={onBack} aria-label="Back to Profile"><ArrowLeft size={20}/></button><div><span>PROFILE</span><strong>{title}</strong><small>{subtitle}</small></div></div>{children}</div>}
function ProfileItem({icon:Icon,title,copy,onClick}){return <button className="profile-menu-item" onClick={onClick}><span><Icon size={20}/></span><div><strong>{title}</strong><small>{copy}</small></div><ChevronRight size={19}/></button>}

function AthleteDetails({session,profile,onSaved}){
  const[days,setDays]=useState([2,4,6]),[longDay,setLongDay]=useState(6),[ftp,setFtp]=useState(''),[weight,setWeight]=useState(''),[saving,setSaving]=useState(false),[status,setStatus]=useState('');
  const[advanced,setAdvanced]=useState({resting_hr:'',max_hr:'',weekly_hours_target:'',weekday_session_minutes:90,long_session_max_minutes:300});
  useEffect(()=>{if(profile){setDays(profile.available_weekdays||[2,4,6]);setLongDay(profile.long_session_weekday||6);setFtp(profile.ftp_w||'');setWeight(profile.weight_kg||'');setAdvanced({resting_hr:profile.resting_hr||'',max_hr:profile.max_hr||'',weekly_hours_target:profile.weekly_hours_target||'',weekday_session_minutes:profile.weekday_session_minutes||90,long_session_max_minutes:profile.long_session_max_minutes||300})}},[profile?.user_id]);
  const toggle=d=>setDays(v=>v.includes(d)?v.filter(x=>x!==d):[...v,d].sort((a,b)=>a-b));
  async function save(){
    if(!session?.user)return setStatus('Sign in under Training first.');
    setSaving(true);setStatus('Saving athlete details…');
    const result=await supabase.from('training_profiles').upsert({user_id:session.user.id,primary_sport:profile?.primary_sport||'cycling',available_weekdays:days,long_session_weekday:Number(longDay),ftp_w:ftp?Number(ftp):null,weight_kg:weight?Number(weight):null,resting_hr:advanced.resting_hr?Number(advanced.resting_hr):null,max_hr:advanced.max_hr?Number(advanced.max_hr):null,weekly_hours_target:advanced.weekly_hours_target?Number(advanced.weekly_hours_target):null,weekday_session_minutes:Number(advanced.weekday_session_minutes||90),long_session_max_minutes:Number(advanced.long_session_max_minutes||300)},{onConflict:'user_id'});
    if(result.error)setStatus(result.error.message);else{setStatus('Athlete details saved.');await onSaved?.()}
    setSaving(false);
  }
  if(!session?.user)return <section className="card empty"><UserRound size={26}/><p>Sign in under Training to save athlete details.</p></section>;
  return <section className="card profile-form-card"><span className="eyebrow">ATHLETE PROFILE</span><h3>Set once, then let Strava keep the history current.</h3><label>Available training days</label><div className="day-grid">{DAY_OPTIONS.map(([d,n])=><button key={d} className={days.includes(d)?'selected':''} onClick={()=>toggle(d)}>{n}</button>)}</div><label>Preferred long-session day<select value={longDay} onChange={e=>setLongDay(Number(e.target.value))}>{DAY_OPTIONS.filter(([d])=>days.includes(d)).map(([d,n])=><option key={d} value={d}>{n}</option>)}</select></label><div className="profile-two"><label>FTP <span className="optional">optional</span><input inputMode="numeric" value={ftp} onChange={e=>setFtp(e.target.value)}/></label><label>Weight kg <span className="optional">optional</span><input inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div><details><summary>Advanced athlete details</summary>{Object.entries({resting_hr:'Resting HR',max_hr:'Max HR',weekly_hours_target:'Weekly hours target',weekday_session_minutes:'Weekday session minutes',long_session_max_minutes:'Maximum long-session minutes'}).map(([k,label])=><label key={k}>{label}<input inputMode="numeric" value={advanced[k]} onChange={e=>setAdvanced(v=>({...v,[k]:e.target.value}))}/></label>)}</details><button className="primary" disabled={saving||days.length<2} onClick={save}><Save size={17}/>{saving?'Saving…':'Save Athlete Details'}</button>{status&&<p className="form-status">{status}</p>}</section>
}

function Connections({session,setup,reload}){
  const[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  const connected=Boolean(setup?.strava_connected);
  const lastSync=localStorage.getItem('jf-strava-last-sync');
  const syncLabel=lastSync?new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(lastSync)):'Not synced on this device yet';
  async function connect(){if(!session?.user)return setStatus('Sign in under Training first.');setBusy(true);setStatus('Opening Strava…');const{data,error}=await startTrainingStrava(supabase);if(error)setStatus(error.message);else if(data?.authorization_url)window.location.href=data.authorization_url;else setStatus('Could not start Strava connection.');setBusy(false)}
  async function sync(){setBusy(true);setStatus('Syncing Strava and checking your plan…');const{data,error}=await syncTrainingStrava(supabase);if(error)setStatus(error.message);else{const stamp=new Date().toISOString();localStorage.setItem('jf-strava-last-sync',stamp);setStatus(data?.plan_adaptation?.changed_sessions?`Strava synced · ${data.plan_adaptation.changed_sessions} upcoming sessions checked or adjusted.`:'Strava synced.');await reload?.()}setBusy(false)}
  async function disconnect(){if(!window.confirm('Disconnect Strava? Downloaded Strava activities stored in Just Fuel will also be removed.'))return;setBusy(true);setStatus('Disconnecting Strava…');const{error}=await supabase.functions.invoke('strava-disconnect',{body:{}});if(error)setStatus(error.message);else{localStorage.removeItem('jf-strava-last-sync');setStatus('Strava disconnected.');await reload?.()}setBusy(false)}
  if(!session?.user)return <section className="card empty"><Activity size={27}/><p>Sign in under Training before connecting Strava.</p></section>;
  return <div className="stack"><section className={`card profile-connection-card ${connected?'connected':''}`}><div className="row-between"><div><span className="eyebrow">STRAVA</span><h3>{connected?'Connected':'Not connected'}</h3></div><Activity size={25}/></div><p className="muted">{connected?`Last device sync: ${syncLabel}`:'Connect Strava so recent activities can adapt training, performance and race planning.'}</p>{connected?<div className="profile-connection-actions"><button className="primary" disabled={busy} onClick={sync}><RefreshCw size={17}/>{busy?'Working…':'Sync now'}</button><button className="secondary" disabled={busy} onClick={disconnect}>Disconnect</button></div>:<button className="primary" disabled={busy} onClick={connect}><Link2 size={17}/>{busy?'Opening…':'Connect Strava'}</button>}{status&&<p className="form-status">{status}</p>}</section></div>
}

function ReminderSettings({reminder,setReminder,requestReminderPermission}){
  const[message,setMessage]=useState('');
  function toggle(){const enabled=!reminder.enabled;setReminder(r=>({...REMINDER_DEFAULT,...r,enabled,lastShown:'',lastNotified:''}));if(enabled)requestReminderPermission?.()}
  function addToCalendar(){const ics=buildReminderIcs(reminder);const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='just-fuel-weekly-reminder.ics';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Calendar reminder created. Open the file and add it to your phone calendar.')}
  return <section className="card profile-reminder-card"><div className="settings-title"><Bell size={21}/><div><h3>Weekly fuel check</h3><p>Choose when you want to check stock and plan the week.</p></div><button className={`toggle ${reminder.enabled?'on':''}`} onClick={toggle}><span/></button></div>{reminder.enabled&&<><div className="profile-reminder-grid"><label>Day<select value={reminder.day} onChange={e=>setReminder(r=>({...r,day:Number(e.target.value),lastShown:'',lastNotified:''}))}>{DAY_NAMES.map((d,i)=><option value={i} key={d}>{d}</option>)}</select></label><label>Time<input type="time" value={reminder.time||'18:00'} onChange={e=>setReminder(r=>({...r,time:e.target.value||'18:00',lastShown:'',lastNotified:''}))}/></label></div><div className="profile-reminder-summary"><strong>Every {DAY_NAMES[Number(reminder.day)]} at {reminder.time||'18:00'}</strong><span>Next: {nextReminderLabel(reminder)}</span></div><button className="secondary profile-wide" onClick={addToCalendar}><CalendarPlus size={17}/>Add reliable phone calendar reminder</button>{message&&<p className="form-status">{message}</p>}</>}<small className="muted">The in-app reminder appears when Just Fuel is open. Use your phone calendar if you also want a reliable alert while the app is closed.</small></section>
}

function InstallHelp({installed,installPrompt,installApp}){
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  return <div className="stack"><section className="card"><div className="settings-title"><Download size={21}/><div><h3>Install Just Fuel</h3><p>Keep the app on your home screen.</p></div></div>{installed?<div className="installed-row"><Check size={18}/>Installed on this device</div>:installPrompt?<button className="primary" onClick={installApp}>Install app</button>:ios?<div className="profile-install-steps"><b>iPhone / iPad</b><span>Safari → Share → Add to Home Screen.</span></div>:<div className="profile-install-steps"><b>Android</b><span>Chrome menu → Add to Home screen / Install app.</span></div>}</section><section className="card"><div className="row-between"><div><span className="eyebrow">HELP</span><h3>Need a hand?</h3></div><HelpCircle size={23}/></div><div className="profile-help-links"><a href={SHOP_DOMAIN} target="_blank" rel="noreferrer">Just Fuel website<ExternalLink size={16}/></a><a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer">WhatsApp Just Fuel<ExternalLink size={16}/></a></div></section></div>
}
