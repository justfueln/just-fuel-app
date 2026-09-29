import './smart-coach-v2.css';

let queued=false;
let observer=null;

function el(tag,cls,text){
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!=null)node.textContent=text;
  return node;
}

function clean(value){return String(value||'').replace(/\s+/g,' ').trim()}

function homeReason(card){
  const readiness=document.querySelector('.today-dashboard .readiness-result');
  const coach=clean(card?.querySelector('h3')?.textContent);
  if(readiness){
    const status=clean(readiness.querySelector('.readiness-score-line')?.textContent);
    return status
      ? `Your morning readiness (${status}) and next planned session are driving this recommendation.`
      : 'Your morning readiness and next planned session are driving this recommendation.';
  }
  if(/connect strava/i.test(coach))return'More completed training data will make this advice more personalised.';
  if(document.querySelector('.today-dashboard .today-race-card'))return'This uses your next planned session, recent training balance and race timing.';
  return'This uses the training information currently available to Just Fuel.';
}

function enhanceHome(){
  const card=document.querySelector('.today-dashboard .today-coach-card');
  if(!card)return;
  card.classList.add('jf-smart-home-coach');
  const kicker=card.querySelector('.today-mini-title span');
  if(kicker&&kicker.textContent!=='COACH RECOMMENDATION')kicker.textContent='COACH RECOMMENDATION';
  const headline=card.querySelector('h3');
  if(!headline)return;
  let reason=card.querySelector('.jf-smart-coach-reason');
  if(!reason){reason=el('p','jf-smart-coach-reason');headline.after(reason)}
  reason.textContent=homeReason(card);
}

function enhancePerformance(){
  const screen=document.querySelector('.training-performance-screen');
  if(!screen)return;
  screen.classList.add('jf-smart-performance');
  const card=screen.querySelector('.coach-card');
  if(!card)return;
  card.classList.add('jf-smart-performance-coach');
  const kicker=card.querySelector('.eyebrow');
  if(kicker&&kicker.textContent!=='COACH RECOMMENDATION')kicker.textContent='COACH RECOMMENDATION';
  const headline=card.querySelector('h3');
  if(headline&&!card.querySelector('.jf-smart-coach-reason')){
    headline.after(el('p','jf-smart-coach-reason','This recommendation is based on your recent load, fatigue, form and longer-term fitness trend. The detailed numbers remain below if you want them.'));
  }
}

function isSafetyCopy(text){
  return /pain was reported|feeling sick|seek appropriate assessment|worsening pain/i.test(text);
}

function enhanceSessionCoach(box){
  if(box.dataset.jfSmartCoach==='1')return;
  box.dataset.jfSmartCoach='1';
  box.classList.add('jf-smart-session-coach');
  const kicker=box.querySelector('.jf-session-coach-kicker');
  if(kicker)kicker.textContent='COACH RECOMMENDATION';
  const headline=box.querySelector(':scope > strong');
  const copy=box.querySelector('.jf-session-coach-copy');
  if(headline&&!box.querySelector('.jf-smart-coach-reason')){
    headline.after(el('p','jf-smart-coach-reason','Based on planned versus completed work, your session feedback and any fuel you logged.'));
  }
  if(!copy)return;

  const paragraphs=[...copy.querySelectorAll(':scope > p')];
  const safety=paragraphs.filter(p=>isSafetyCopy(p.textContent));
  for(const p of safety){
    p.classList.add('jf-smart-safety-note');
    copy.before(p);
  }

  if(copy.querySelector('p')){
    const details=document.createElement('details');
    details.className='jf-smart-coach-details';
    const summary=document.createElement('summary');
    summary.textContent='Why this recommendation?';
    details.append(summary,copy);
    const action=box.querySelector('.jf-session-recover-btn');
    if(action)box.insertBefore(details,action);else box.append(details);
  }else copy.remove();
}

function enhanceAdaptive(box){
  if(box.dataset.jfSmartCoach==='1')return;
  box.dataset.jfSmartCoach='1';
  box.classList.add('jf-smart-adaptive-coach');
  const kicker=box.querySelector('.jf-adaptive-kicker');
  if(kicker)kicker.textContent='COACH RECOMMENDATION';
  const changes=[...box.querySelectorAll(':scope > .jf-adaptive-change')];
  if(changes.length){
    const details=document.createElement('details');
    details.className='jf-smart-coach-details jf-smart-adaptive-data';
    const summary=document.createElement('summary');
    summary.textContent='View training data';
    details.append(summary,...changes);
    const schedule=box.querySelector(':scope > .jf-schedule-suggestion');
    if(schedule)box.insertBefore(details,schedule);else box.append(details);
  }
}

function apply(){
  enhanceHome();
  enhancePerformance();
  document.querySelectorAll('.jf-session-coach').forEach(enhanceSessionCoach);
  document.querySelectorAll('.jf-adaptive-decision').forEach(enhanceAdaptive);
}

function queue(){
  if(queued)return;
  queued=true;
  window.setTimeout(()=>{
    queued=false;
    try{apply()}catch(error){console.warn('Smart Coach enhancement failed:',error)}
  },80);
}

if(typeof window!=='undefined'){
  const start=()=>{
    if(observer||!document.body)return;
    const host=document.querySelector('.shell-content')||document.body;
    observer=new MutationObserver(records=>{
      if(records.some(record=>record.addedNodes.length||record.removedNodes.length))queue();
    });
    observer.observe(host,{childList:true,subtree:true});
    queue();
  };
  ['load','popstate','jf-training-plan-updated','jf-training-feedback-saved','jf-recovery-logged','jf-readiness-saved','jf-strava-synced'].forEach(name=>window.addEventListener(name,queue));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
