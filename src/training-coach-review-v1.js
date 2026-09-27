import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,loading=null,cacheAt=0,rows=[],feedbackMap=new Map(),fuelMap=new Map();

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function fmtDate(v){if(!v)return'';return new Intl.DateTimeFormat('en-ZA',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${v}T12:00:00`))}
function pct(v){return Number.isFinite(Number(v))?Math.round(Number(v)):null}

async function load(force=false){
  if(!force&&rows.length&&Date.now()-cacheAt<45000)return{rows,feedback:feedbackMap,fuel:fuelMap};
  if(loading)return loading;
  loading=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return{rows:[],feedback:new Map(),fuel:new Map()};
    const uid=session.user.id;
    const{data:plan}=await sb.from('training_plans').select('id').eq('user_id',uid).eq('status','active').order('generated_at',{ascending:false}).limit(1).maybeSingle();
    if(!plan?.id)return{rows:[],feedback:new Map(),fuel:new Map()};
    const{data:r}=await sb.from('training_plan_calendar_with_fuel').select('id,title,session_date,status,session_type,is_key_session,planned_duration_minutes,duration_minutes,target_load,target_power_low_w,target_power_high_w,actual_activity_id,actual_duration_minutes,actual_weighted_watts,actual_training_load,duration_completion_pct,load_completion_pct,carb_target_gph,planned_carbs_per_hour,recover_servings,recovery_note').eq('user_id',uid).eq('plan_id',plan.id).order('session_date',{ascending:true});
    rows=r||[];const ids=rows.map(x=>x.id).filter(Boolean);feedbackMap=new Map();fuelMap=new Map();
    if(ids.length){
      const[fres,ares]=await Promise.all([
        sb.from('training_session_feedback').select('session_id,feel,flags').in('session_id',ids),
        sb.from('training_session_fuel_actual').select('session_id,activity_id,bottle_mix_sachets,regular_gels,boost_gels,hydrate_servings,recover_servings,extra_carbs_g,fluid_ml,energy_feel,issues,notes').in('session_id',ids)
      ]);
      for(const f of fres.data||[])feedbackMap.set(f.session_id,f);
      for(const a of ares.data||[])fuelMap.set(a.session_id,a);
    }
    cacheAt=Date.now();return{rows,feedback:feedbackMap,fuel:fuelMap};
  })().finally(()=>{loading=null});
  return loading;
}

function actualGph(row,fuel){
  if(!fuel||!Number(row.actual_duration_minutes))return null;
  const carbs=(Number(fuel.bottle_mix_sachets)||0)*60+((Number(fuel.regular_gels)||0)+(Number(fuel.boost_gels)||0))*40+(Number(fuel.extra_carbs_g)||0);
  return Math.round(carbs/(Number(row.actual_duration_minutes)/60));
}

function coachText(row,feedback,fuel){
  const d=pct(row.duration_completion_pct),l=pct(row.load_completion_pct),feel=feedback?.feel||'';let headline='Session complete — good work.';const bits=[];
  if((l!=null&&l>118)||feel==='too_hard')headline='Good work. That landed harder than planned.';
  else if((d!=null&&d>=90&&d<=110)&&(l==null||(l>=85&&l<=115)))headline='Strong work — right on plan.';
  else if(d!=null&&d<80)headline='Session banked. It came in shorter than planned.';
  else if(feel==='easy')headline='Nice work. You had more in reserve today.';

  if(d!=null)bits.push(d>=90&&d<=110?`You completed ${d}% of the planned duration.`:d>110?`You rode longer than planned at ${d}% of target duration.`:`You completed ${d}% of target duration.`);
  if(row.target_power_low_w&&row.target_power_high_w&&row.actual_weighted_watts){const w=Math.round(Number(row.actual_weighted_watts));bits.push(w>=Number(row.target_power_low_w)&&w<=Number(row.target_power_high_w)?`Weighted power (${w} W) sat inside the target range.`:w>Number(row.target_power_high_w)?`Weighted power (${w} W) was above the planned range — avoid chasing extra load in the next session.`:`Weighted power (${w} W) was below the planned range; that is fine if the session felt controlled or fatigue was high.`)}
  if(l!=null&&l>120)bits.push('Training load was meaningfully above plan, so prioritise an easy recovery window before the next quality day.');
  else if(l!=null&&l<75)bits.push('Training load was below plan. Do not try to “make it up” by adding unplanned intensity.');
  if(feel==='hard')bits.push('You marked the session hard. Keep the next easy session genuinely easy.');
  if(feel==='too_hard')bits.push('You marked it too hard. The next quality session should be reviewed before adding more intensity.');
  if(feedback?.flags?.includes('tired_legs'))bits.push('Tired legs were reported, so recovery quality matters more than adding volume right now.');
  if(feedback?.flags?.includes('pain'))bits.push('Pain was reported. Avoid pushing through worsening pain and seek appropriate assessment if it persists.');
  if(feedback?.flags?.includes('sick'))bits.push('You reported feeling sick. Prioritise recovery and return to harder training only when you are well enough.');

  const gph=actualGph(row,fuel),target=Number(row.carb_target_gph)||0;
  if(gph!=null&&target>0){const delta=gph-target;if(Math.abs(delta)<=10)bits.push(`Fueling was close to plan at about ${gph} g/h versus ${target} g/h target.`);else if(delta<-10)bits.push(`Fueling was about ${gph} g/h versus ${target} g/h target. Build toward the target gradually if energy and gut tolerance allow.`);else bits.push(`Fueling was about ${gph} g/h, above the ${target} g/h target. Keep future intake deliberate rather than automatically increasing it.`)}
  if(fuel?.issues?.length)bits.push('Fuel or GI issues were logged, so the next long-session fueling plan should stay conservative until tolerance is clear.');
  if(Number(row.recover_servings)>0){bits.push(Number(fuel?.recover_servings)>0?'Recovery logged: Just Fuel Recover taken.':'Recovery priority: take 1 Just Fuel Recover, replace fluids and follow with normal post-training food.');}
  return{headline,bits:bits.slice(0,4)};
}

async function markRecover(row,fuel){
  const{data:{session}}=await sb.auth.getSession();if(!session?.user)throw new Error('Please sign in again.');
  const base=fuel||{};const payload={user_id:session.user.id,session_id:row.id,activity_id:base.activity_id||row.actual_activity_id||null,bottle_mix_sachets:Number(base.bottle_mix_sachets)||0,regular_gels:Number(base.regular_gels)||0,boost_gels:Number(base.boost_gels)||0,hydrate_servings:Number(base.hydrate_servings)||0,recover_servings:Math.max(1,Number(base.recover_servings)||0),extra_carbs_g:Number(base.extra_carbs_g)||0,fluid_ml:Number(base.fluid_ml)||0,energy_feel:base.energy_feel||null,issues:base.issues||[],notes:base.notes||null};
  const{error}=await sb.from('training_session_fuel_actual').upsert(payload,{onConflict:'session_id'});if(error)throw error;fuelMap.set(row.id,payload);cacheAt=Date.now();window.dispatchEvent(new CustomEvent('jf-recovery-logged',{detail:{sessionId:row.id}}));
}

function renderCoach(card,row,feedback,fuel){
  if(card.dataset.jfCoachReview==='1')return;card.dataset.jfCoachReview='1';
  const box=el('div','jf-session-coach');box.append(el('span','jf-session-coach-kicker','COACH SAYS'));const title=el('strong','');const copy=el('div','jf-session-coach-copy');box.append(title,copy);
  const recoverAction=el('button','jf-session-recover-btn','Mark Recover taken');recoverAction.type='button';
  async function paint(){const c=coachText(row,feedbackMap.get(row.id),fuelMap.get(row.id));title.textContent=c.headline;copy.replaceChildren(...c.bits.map(x=>el('p','',x)));const need=Number(row.recover_servings)>0&&Number(fuelMap.get(row.id)?.recover_servings||0)<1;recoverAction.hidden=!need}
  recoverAction.addEventListener('click',async()=>{recoverAction.disabled=true;recoverAction.textContent='Saving…';try{await markRecover(row,fuelMap.get(row.id));recoverAction.textContent='Recover logged ✓';await paint();setTimeout(()=>{recoverAction.disabled=false;recoverAction.textContent='Mark Recover taken'},1200)}catch(e){recoverAction.textContent=e?.message||'Could not save';recoverAction.disabled=false}});box.append(recoverAction);
  const feedbackNode=card.querySelector('.jf-feedback');if(feedbackNode)card.insertBefore(box,feedbackNode);else card.append(box);paint();
}

async function scan(force=false){
  const cards=[...document.querySelectorAll('.training-page .session-card')];if(!cards.length)return;const data=await load(force);const used=new Set();
  for(const card of cards){if(card.dataset.jfCoachReview==='1')continue;const title=(card.querySelector('h3')?.textContent||'').trim(),date=(card.querySelector('.eyebrow')?.textContent||'').trim();const row=data.rows.find(r=>!used.has(r.id)&&String(r.title||'').trim()===title&&fmtDate(r.session_date)===date);if(!row)continue;used.add(row.id);if(!row.actual_activity_id&&String(row.status||'').toLowerCase()!=='completed')continue;renderCoach(card,row,data.feedback.get(row.id),data.fuel.get(row.id));
  }
}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force).catch(()=>{})},180)}
if(typeof window!=='undefined'){
  window.addEventListener('load',()=>queue());window.addEventListener('popstate',()=>queue());window.addEventListener('jf-training-feedback-saved',()=>{cacheAt=0;document.querySelectorAll('.session-card[data-jf-coach-review="1"]').forEach(c=>{c.dataset.jfCoachReview='';c.querySelector('.jf-session-coach')?.remove()});queue(true)});window.addEventListener('jf-recovery-logged',()=>queue(true));
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
