import {createClient} from '@supabase/supabase-js';

const sb=createClient('https://ufolqntrfmvefpvrjnsa.supabase.co','sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let cache=[],cacheAt=0,pending=null,queued=false;

function fmtDate(v){if(!v)return'';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${v}T12:00:00`))}
function fmtPace(sec){const n=Math.round(Number(sec)||0);if(!n)return'';return`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
function sourceLabel(v){return v==='power'?'POWER':v==='heart_rate'?'HEART RATE':v==='pace'?'PACE':'EFFORT'}
function primaryText(row){
  const metric=row.target_metric||'rpe';
  if(metric==='power'&&row.target_power_low_w&&row.target_power_high_w)return`${row.target_power_low_w}–${row.target_power_high_w} W`;
  if(metric==='heart_rate'&&row.target_hr_low&&row.target_hr_high)return`${row.target_hr_low}–${row.target_hr_high} bpm`;
  if(metric==='pace'&&row.target_pace_fast_sec_per_km&&row.target_pace_slow_sec_per_km)return`${fmtPace(row.target_pace_fast_sec_per_km)}–${fmtPace(row.target_pace_slow_sec_per_km)} /km`;
  if(row.target_rpe_low!=null&&row.target_rpe_high!=null)return`RPE ${row.target_rpe_low}–${row.target_rpe_high}/10`;
  return row.intensity_zone||'Controlled effort';
}
function secondaryText(row){
  const bits=[];
  if(row.target_metric!=='heart_rate'&&row.target_hr_low&&row.target_hr_high)bits.push(`HR ${row.target_hr_low}–${row.target_hr_high}`);
  if(row.target_metric!=='rpe'&&row.target_rpe_low!=null&&row.target_rpe_high!=null)bits.push(`RPE ${row.target_rpe_low}–${row.target_rpe_high}`);
  return bits.join(' · ');
}
async function rows(force=false){
  if(!force&&cache.length&&Date.now()-cacheAt<60000)return cache;
  if(pending)return pending;
  pending=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return[];
    const{data:plan}=await sb.from('training_plans').select('id').eq('user_id',session.user.id).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle();if(!plan?.id)return[];
    const{data}=await sb.from('training_plan_calendar_with_fuel').select('id,plan_id,session_date,title,intensity_zone,target_metric,target_power_low_w,target_power_high_w,target_hr_low,target_hr_high,target_pace_fast_sec_per_km,target_pace_slow_sec_per_km,target_rpe_low,target_rpe_high,target_metric_note').eq('user_id',session.user.id).eq('plan_id',plan.id).order('session_date');
    cache=data||[];cacheAt=Date.now();return cache;
  })().finally(()=>{pending=null});
  return pending;
}
function inject(card,row){
  if(card.querySelector('.jf-session-target-summary'))return;
  const wrap=document.createElement('div');wrap.className='jf-session-target-summary';
  const label=document.createElement('span');label.textContent=sourceLabel(row.target_metric||'rpe');
  const main=document.createElement('strong');main.textContent=primaryText(row);
  wrap.append(label,main);
  const secondary=secondaryText(row);if(secondary){const small=document.createElement('small');small.textContent=secondary;wrap.append(small)}
  if(row.target_metric_note)wrap.title=row.target_metric_note;
  const fuel=card.querySelector('.fuel-summary');if(fuel)card.insertBefore(wrap,fuel);else card.append(wrap);
}
async function scan(force=false){
  const cards=[...document.querySelectorAll('.training-page .session-card')];if(!cards.length)return;
  const data=await rows(force);const used=new Set();
  for(const card of cards){if(card.querySelector('.jf-session-target-summary'))continue;const title=(card.querySelector('h3')?.textContent||'').trim(),date=(card.querySelector('.eyebrow')?.textContent||'').trim();const row=data.find(r=>!used.has(r.id)&&String(r.title||'').trim()===title&&fmtDate(r.session_date)===date);if(row){used.add(row.id);inject(card,row)}}
}
function queue(){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan().catch(()=>{})},120)}
function reset(){cache=[];cacheAt=0;pending=null;document.querySelectorAll('.jf-session-target-summary').forEach(x=>x.remove());queue()}
if(typeof window!=='undefined'){
  window.addEventListener('jf-training-plan-updated',reset);
  window.addEventListener('jf-strava-synced',reset);
  window.addEventListener('load',queue);
  const obs=new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()});
  const start=()=>{if(document.body)obs.observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
