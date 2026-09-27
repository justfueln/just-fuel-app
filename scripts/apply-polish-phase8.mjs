import fs from 'node:fs';

function removeFunction(source,name){
  const start=source.indexOf(`function ${name}(`);
  if(start<0)return source;
  const next=source.indexOf('\nfunction ',start+10);
  const end=next>=0?next:source.length;
  return source.slice(0,start)+source.slice(end+1);
}

// Shell cleanup + More/reminder extraction
{
  const path='src/ShellNextV3.jsx';
  let s=fs.readFileSync(path,'utf8');
  s=s.replace(/import \{[\s\S]*?\} from 'lucide-react';/,"import { Activity, BookOpen, Calculator, MoreHorizontal, ShoppingBag, Store, Truck } from 'lucide-react';");
  s=s.replace("import CheckoutDrawer from './CheckoutDrawer';", "import CheckoutDrawer from './CheckoutDrawer';\nimport MorePage, { ReminderBanner } from './MorePage';\nimport useWeeklyReminder from './useWeeklyReminder';");
  s=s.replace(/import \{\n  CATALOG,[\s\S]*?\} from '\.\/catalog';\n/, '');
  s=s.replace("const REMINDER_KEY = 'just-fuel-weekly-reminder';\n",'');
  s=s.replace("const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];\n",'');
  s=s.replace("const DAY_CODES = ['SU','MO','TU','WE','TH','FR','SA'];\n",'');
  s=s.replace("const REMINDER_DEFAULT = {enabled:false,day:0,time:'18:00',lastShown:'',lastNotified:''};\n",'');
  const learnStart=s.indexOf('const LEARN = [');
  const learnEnd=s.indexOf('\n\nfunction localDateKey',learnStart);
  if(learnStart>=0&&learnEnd>=0)s=s.slice(0,learnStart)+s.slice(learnEnd+2);
  for(const name of ['localDateKey','loadReminder','timeParts','nextReminderDate','nextReminderLabel','reminderDueNow','icsStamp','suggestedCarbsPerHour'])s=removeFunction(s,name);
  s=s.replace("  const [reminder,setReminder]=useState(loadReminder);\n  const [reminderDue,setReminderDue]=useState(false);\n", "  const {reminder,setReminder,reminderDue,requestReminderPermission,dismissReminder}=useWeeklyReminder();\n");
  const reminderEffectStart=s.indexOf("  useEffect(()=>{\n    localStorage.setItem(REMINDER_KEY");
  const installEffectStart=s.indexOf("\n\n  useEffect(()=>{\n    const standalone",reminderEffectStart);
  if(reminderEffectStart>=0&&installEffectStart>=0)s=s.slice(0,reminderEffectStart)+s.slice(installEffectStart+2);
  s=s.replace(/  async function requestReminderPermission\(\)\{[\s\S]*?\n  \}\n  async function installApp/, '  async function installApp');
  s=s.replace(/\n  function dismissReminder\(\)\{[^\n]*\}\n/,'\n');
  const bannerStart=s.indexOf('\nfunction ReminderBanner(');
  if(bannerStart>=0)s=s.slice(0,bannerStart)+'\n';
  fs.writeFileSync(path,s);
}

// Training top-level data/API service extraction
{
  const path='src/AppV3.jsx';
  let s=fs.readFileSync(path,'utf8');
  const importNeedle="import { basketTtlMs, normalizeTrainingTab, readSavedItems } from './app-state-utils';";
  if(!s.includes("from './training-api'"))s=s.replace(importNeedle,`${importNeedle}\nimport { fetchTrainingCore, fetchTrainingPlan, fetchTrainingRaces, fetchTrainingProfile, fetchTrainingFuelBase, fetchTrainingFuelForecast, sendTrainingOtp, verifyTrainingOtp, syncTrainingStrava, startTrainingStrava } from './training-api';`);
  const blockStart=s.indexOf('  async function loadCore(');
  const blockEnd=s.indexOf('  async function ensureFuelTab(',blockStart);
  if(blockStart<0||blockEnd<0)throw new Error('Training load function block not found');
  const replacement=`  async function loadCore({keepMessage=false}={}){\n    if(!session?.user)return;if(!keepMessage)setMessage('');\n    const result=await fetchTrainingCore(supabase,session.user.id);\n    if(result.error){setMessage(\`Could not load Training overview: \${result.error.message}\`);return}\n    setSetup(result.setup);setHome(result.home);\n  }\n  async function loadPlan({keepMessage=true}={}){\n    if(!session?.user)return;const result=await fetchTrainingPlan(supabase,session.user.id);\n    if(result.error){setMessage(keepMessage?\`Could not load training plan: \${result.error.message}\`:result.error.message);return}\n    setPlan(result.plan);setLoaded(v=>({...v,plan:true}));\n  }\n  async function loadRaces(){\n    if(!session?.user)return;const result=await fetchTrainingRaces(supabase,session.user.id);\n    if(result.error){setMessage(\`Could not load events: \${result.error.message}\`);return}\n    setRaces(result.races);setLoaded(v=>({...v,races:true}));\n  }\n  async function loadProfile(){\n    if(!session?.user)return;const result=await fetchTrainingProfile(supabase,session.user.id);\n    if(result.error){setMessage(\`Could not load athlete details: \${result.error.message}\`);return}\n    setProfile(result.profile);setLoaded(v=>({...v,profile:true}));\n  }\n  async function loadFuelBase(){\n    if(!session?.user)return;const result=await fetchTrainingFuelBase(supabase,session.user.id);\n    if(result.error){setMessage(\`Could not load fuel settings: \${result.error.message}\`);return}\n    setStock(result.stock);setFuelProfile(result.fuelProfile);setLoaded(v=>({...v,fuelBase:true}));\n  }\n  async function loadFuelForecast(){\n    if(!session?.user)return;const result=await fetchTrainingFuelForecast(supabase,session.user.id);\n    if(result.error){setMessage(\`Training loaded, but fuel forecast could not load: \${result.error.message}\`);return}\n    setFuel(result.fuel);setFuelLoaded(true);\n  }\n`;
  s=s.slice(0,blockStart)+replacement+s.slice(blockEnd);
  s=s.replace("const{error}=await supabase.auth.signInWithOtp({email:clean});", "const{error}=await sendTrainingOtp(supabase,clean);");
  s=s.replace("const{error}=await supabase.auth.verifyOtp({email:email.trim(),token:otp.trim(),type:'email'});", "const{error}=await verifyTrainingOtp(supabase,email.trim(),otp.trim());");
  s=s.replace("const{data,error}=await supabase.functions.invoke('strava-sync',{body:{}});", "const{data,error}=await syncTrainingStrava(supabase);");
  s=s.replace("const{data,error}=await supabase.functions.invoke('strava-start',{body:{}});", "const{data,error}=await startTrainingStrava(supabase);");
  fs.writeFileSync(path,s);
}
