import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const sb=createClient(SUPABASE_URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let queued=false,cache=null,cacheAt=0,loading=null;

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function fmtW(v){const n=Number(v);return Number.isFinite(n)?`${Math.round(n)} W`:'—'}
function fmtDate(v){if(!v)return'—';const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric'}).format(d)}
function focusBadge(v){return v==='vo2'?'VO2 FOCUS':v==='threshold'?'THRESHOLD FOCUS':v==='balanced'?'BALANCED':'LEARNING'}

async function load(force=false){
  if(!force&&cache&&Date.now()-cacheAt<45000)return cache;
  if(loading)return loading;
  loading=(async()=>{
    const{data:{session}}=await sb.auth.getSession();if(!session?.user)return null;
    const{data,error}=await sb.rpc('get_training_power_curve_insights',{p_user_id:session.user.id});
    if(error)throw error;cache=data||null;cacheAt=Date.now();return cache;
  })().finally(()=>{loading=null});
  return loading;
}

function chart(pbs){
  const usable=(pbs||[]).filter(x=>Number(x.value_w)>0);
  if(usable.length<2)return null;
  const width=600,height=210,padX=48,padY=28;
  const vals=usable.map(x=>Number(x.value_w));const max=Math.max(...vals),min=Math.min(...vals);const span=Math.max(1,max-min);
  const points=usable.map((x,i)=>{
    const px=padX+(i/Math.max(1,usable.length-1))*(width-padX*2);
    const py=height-padY-((Number(x.value_w)-min)/span)*(height-padY*2);
    return{...x,x:px,y:py};
  });
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.classList.add('jf-power-svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','Personal best power curve');
  const axis=document.createElementNS(svg.namespaceURI,'line');axis.setAttribute('x1',String(padX));axis.setAttribute('x2',String(width-padX));axis.setAttribute('y1',String(height-padY));axis.setAttribute('y2',String(height-padY));axis.setAttribute('class','jf-power-axis');svg.append(axis);
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '));path.setAttribute('class','jf-power-line');svg.append(path);
  points.forEach(p=>{
    const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',String(p.x));dot.setAttribute('cy',String(p.y));dot.setAttribute('r','5');dot.setAttribute('class','jf-power-dot');svg.append(dot);
    const value=document.createElementNS(svg.namespaceURI,'text');value.setAttribute('x',String(p.x));value.setAttribute('y',String(Math.max(18,p.y-12)));value.setAttribute('text-anchor','middle');value.setAttribute('class','jf-power-value');value.textContent=`${Math.round(Number(p.value_w))} W`;svg.append(value);
    const label=document.createElementNS(svg.namespaceURI,'text');label.setAttribute('x',String(p.x));label.setAttribute('y',String(height-6));label.setAttribute('text-anchor','middle');label.setAttribute('class','jf-power-label');label.textContent=p.label;svg.append(label);
  });
  return svg;
}

function remove(){document.querySelector('.jf-power-curve-card')?.remove()}
function render(data){
  const screen=document.querySelector('.training-performance-screen');if(!screen||!data?.ok)return;remove();
  const card=el('section',`card jf-power-curve-card jf-power-focus-${data.focus||'baseline'}`);
  const head=el('div','jf-power-head');const left=el('div','');left.append(el('span','eyebrow','POWER CURVE + PERSONAL BESTS'),el('h3','','Your power profile'));head.append(left,el('b','jf-power-badge',focusBadge(data.focus)));card.append(head);
  card.append(el('p','muted','Your best sustained power from available Strava power-meter streams. Historical coverage builds as older rides are backfilled during sync.'));

  const pbs=Array.isArray(data.personal_bests)?data.personal_bests:[];
  const graph=chart(pbs);if(graph){const wrap=el('div','jf-power-chart');wrap.append(graph);card.append(wrap)}

  const grid=el('div','jf-power-pb-grid');
  pbs.forEach(pb=>{
    const cell=el('div','jf-power-pb');cell.append(el('span','',pb.label||'Power'),el('strong','',fmtW(pb.value_w)));
    const meta=[];if(pb.wkg!=null)meta.push(`${Number(pb.wkg).toFixed(2)} W/kg`);if(pb.date)meta.push(fmtDate(pb.date));cell.append(el('small','',meta.length?meta.join(' · '):'Waiting for power data'));
    if(pb.activity_name)cell.title=String(pb.activity_name);grid.append(cell);
  });card.append(grid);

  const improvements=Array.isArray(data.recent_improvements)?data.recent_improvements:[];
  if(improvements.length){const box=el('div','jf-power-improvements');box.append(el('span','eyebrow','RECENT IMPROVEMENTS'));const chips=el('div','jf-power-improvement-chips');improvements.forEach(x=>chips.append(el('div','jf-power-chip',`${x.label} +${Number(x.change_pct).toFixed(1)}% · ${fmtW(x.recent_w)}`)));box.append(chips);card.append(box)}

  const coach=el('div','jf-power-coach');coach.append(el('span','eyebrow','COACH DEVELOPMENT FOCUS'),el('strong','',data.focus_label||'Building baseline'),el('p','',data.focus_reason||''));
  const next=data.next_quality_session;
  if(next){const detail=el('div','jf-power-next');detail.append(el('span','','Next quality session'),el('b','',`${fmtDate(next.date)} · ${next.title||'Quality session'}`));if(next.power_focus)detail.append(el('small','',`Power-profile prescription applied: ${String(next.power_focus).toUpperCase()}.`));coach.append(detail)}
  card.append(coach);

  if(Number(data.stream_activities||0)<4){card.append(el('div','jf-power-baseline',`Power baseline: ${Number(data.stream_activities||0)} stream ride${Number(data.stream_activities||0)===1?'':'s'} loaded. Sync Strava again after training to continue building the 12-month curve.`))}
  card.append(el('p','jf-power-note',data.note||'Power-curve data is a coaching signal and does not automatically change FTP.'));

  const ftp=document.querySelector('.jf-ftp-detection');if(ftp)ftp.after(card);else{const headCard=screen.querySelector('.performance-head');if(headCard)headCard.after(card);else screen.prepend(card)}
}

async function scan(force=false){if(!document.querySelector('.training-performance-screen')){remove();return}try{render(await load(force))}catch{}}
function queue(force=false){if(queued)return;queued=true;setTimeout(()=>{queued=false;scan(force)},180)}
function reset(){cache=null;cacheAt=0;remove()}

if(typeof window!=='undefined'){
  window.addEventListener('load',()=>queue());
  ['jf-training-plan-updated','jf-training-feedback-saved','jf-readiness-saved'].forEach(name=>window.addEventListener(name,()=>{reset();queue(true)}));
  const start=()=>{if(!document.body)return;new MutationObserver(m=>{if(m.some(x=>x.addedNodes.length||x.removedNodes.length))queue()}).observe(document.body,{childList:true,subtree:true});queue()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
