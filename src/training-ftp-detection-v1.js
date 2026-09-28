import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,cache=null,cacheAt=0,loading=null;

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function label(status){return status==='retest'?'RETEST':status==='watch'?'WATCH':status==='stable'?'STABLE':status==='missing'?'SET FTP':'LEARNING'}
function fmtW(v){const n=Number(v);return Number.isFinite(n)?`${Math.round(n)} W`:'—'}

async function load(force=false){
  if(!force&&cache&&Date.now()-cacheAt<45000)return cache;
  if(loading)return loading;
  loading=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
    const{data,error}=await sb.rpc('get_ftp_detection',{p_user_id:session.user.id});
    if(error)throw error;cache=data||null;cacheAt=Date.now();return cache;
  })().finally(()=>{loading=null});
  return loading;
}

async function confirmFtp(value,note){
  const watts=Number(value);
  if(!Number.isFinite(watts)||watts<80||watts>700)throw new Error('Enter a confirmed FTP between 80 and 700 W.');
  const{data,error}=await sb.rpc('confirm_training_ftp',{p_ftp_w:watts,p_note:note||null});
  if(error)throw error;
  const{data:{session}}=await sb.auth.getSession();
  if(session?.user){try{await sb.rpc('refresh_training_achievements',{p_user_id:session.user.id})}catch{}}
  cache=null;cacheAt=0;
  window.dispatchEvent(new CustomEvent('jf-training-plan-updated',{detail:{source:'ftp-confirmed',result:data}}));
  window.dispatchEvent(new CustomEvent('jf-training-achievements-refresh',{detail:{source:'ftp-confirmed'}}));
  return data;
}

function remove(){document.querySelector('.jf-ftp-detection')?.remove()}

function render(data){
  const screen=document.querySelector('.training-performance-screen');
  if(!screen||!data?.ok)return;
  remove();
  const card=el('section',`card jf-ftp-detection jf-ftp-${data.status||'insufficient'}`);
  const head=el('div','jf-ftp-head');
  const left=el('div','');left.append(el('span','eyebrow','FTP / POWER CHECK'),el('h3','',data.headline||'Power check'));
  head.append(left,el('b','jf-ftp-badge',label(data.status)));card.append(head);
  card.append(el('p','jf-ftp-copy',data.copy||''));

  const stats=el('div','jf-ftp-stats');
  const current=el('div','');current.append(el('span','','Current FTP'),el('strong','',fmtW(data.current_ftp_w)),el('small','',data.wkg!=null?`${Number(data.wkg).toFixed(2)} W/kg`:'Saved athlete FTP'));
  const estimate=el('div','');estimate.append(el('span','','Performance estimate'),el('strong','',data.performance_estimate_w?fmtW(data.performance_estimate_w):'—'),el('small','',data.performance_estimate_w?'Use as a retest signal, not an automatic FTP':'Waiting for sustained power data'));
  const evidence=el('div','');evidence.append(el('span','','Power rides'),el('strong','',String(Number(data.power_stream_activities_90d)||0)),el('small','','Stream-based rides in last 90d'));
  stats.append(current,estimate,evidence);card.append(stats);

  const rows=Array.isArray(data.evidence)?data.evidence:[];
  if(rows.length){
    const ev=el('div','jf-ftp-evidence');
    for(const row of rows){const item=el('div','');item.append(el('span','',row.label||'Power effort'),el('strong','',fmtW(row.value_w)),el('small','',row.estimate_w?`FTP-style estimate ${fmtW(row.estimate_w)}`:'Sustained power evidence'));ev.append(item)}
    card.append(ev);
  }

  const note=el('p','jf-ftp-note',data.note||'FTP is never changed automatically.');card.append(note);
  const actions=el('div','jf-ftp-actions');
  const edit=el('button','jf-ftp-edit','Update confirmed FTP');edit.type='button';actions.append(edit);card.append(actions);

  const form=el('div','jf-ftp-form');form.hidden=true;
  const labelEl=el('label','', 'Confirmed FTP from a test or trusted assessment');
  const input=document.createElement('input');input.type='number';input.min='80';input.max='700';input.step='1';input.inputMode='numeric';input.placeholder=data.current_ftp_w?String(Math.round(Number(data.current_ftp_w))):'e.g. 300';
  labelEl.append(input);
  const noteLabel=el('label','','Optional note');const noteInput=document.createElement('input');noteInput.type='text';noteInput.maxLength=120;noteInput.placeholder='e.g. 20 min test, coach test, lab test';noteLabel.append(noteInput);
  const formActions=el('div','jf-ftp-form-actions');const cancel=el('button','secondary','Cancel');cancel.type='button';const save=el('button','primary','Confirm FTP');save.type='button';formActions.append(cancel,save);
  const status=el('div','jf-ftp-status','');form.append(labelEl,noteLabel,formActions,status);card.append(form);

  edit.addEventListener('click',()=>{form.hidden=false;edit.hidden=true;input.focus()});
  cancel.addEventListener('click',()=>{form.hidden=true;edit.hidden=false;status.textContent=''});
  save.addEventListener('click',async()=>{
    save.disabled=true;status.textContent='Updating FTP and future workout targets…';
    try{
      const result=await confirmFtp(input.value,noteInput.value.trim());
      status.textContent=`FTP updated to ${Math.round(Number(result?.new_ftp_w)||0)} W. ${Number(result?.future_sessions_rescaled)||0} future workouts were rescaled.`;
      const fresh=await load(true);setTimeout(()=>render(fresh),700);
    }catch(e){status.textContent=e?.message||'Could not update FTP.'}finally{save.disabled=false}
  });

  const headCard=screen.querySelector('.performance-head');if(headCard)headCard.after(card);else screen.prepend(card);
}

async function scan(force=false){
  if(!document.querySelector('.training-performance-screen')){remove();return}
  try{render(await load(force))}catch{}
}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force)},160)}
function reset(){cache=null;cacheAt=0;remove()}

if(typeof window!=='undefined'){
  window.addEventListener('load',()=>queue());
  ['jf-training-plan-updated','jf-training-feedback-saved'].forEach(name=>window.addEventListener(name,()=>{reset();queue(true)}));
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
