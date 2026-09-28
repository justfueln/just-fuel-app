import './training-adaptive-loader';

let queued=false;

function buttonByText(root,text){
  return [...root.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
}

function renameTextNode(el,from,to){
  if(!el)return;
  for(const node of el.childNodes){
    if(node.nodeType===Node.TEXT_NODE && node.textContent.includes(from)){
      node.textContent=node.textContent.replace(from,to);
    }
  }
}

function openTab(name){
  const simpleLabel=name==='Overview'?'Today':name==='My Plan'?'Plan':name==='History'?'Progress':null;
  if(simpleLabel){
    const outer=document.querySelector('.training-phase2-nav');
    const simple=outer&&[...outer.querySelectorAll('button')].find(b=>b.textContent.trim()===simpleLabel);
    if(simple){simple.click();window.scrollTo({top:0,behavior:'smooth'});return;}
  }
  const nav=document.querySelector('.training-page .section-nav');
  const btn=nav && [...nav.querySelectorAll('button')].find(b=>b.textContent.trim()===name || (name==='My Season'&&b.dataset.jfOriginalTab==='My Race'));
  if(btn){btn.click();window.scrollTo({top:0,behavior:'smooth'});}
}

function enhanceNav(){
  const shell=document.querySelector('.training-page .app-shell');
  if(!shell)return;
  const nav=shell.querySelector('.section-nav');
  if(!nav)return;
  const buttons=[...nav.querySelectorAll('button')];
  for(const b of buttons){
    const label=b.textContent.trim();
    if(label==='My Race'){
      b.dataset.jfOriginalTab='My Race';
      b.textContent='My Season';
    }
    if(label==='My Details'){
      b.dataset.jfOriginalTab='My Details';
      b.classList.add('jf-details-tab-hidden');
      b.setAttribute('aria-hidden','true');
      b.tabIndex=-1;
    }
  }

  const actions=shell.querySelector('.topbar .training-header-actions');
  if(actions && !actions.querySelector('.jf-profile-button')){
    const profile=document.createElement('button');
    profile.type='button';
    profile.className='icon-btn jf-profile-button';
    profile.setAttribute('aria-label','Athlete profile and training details');
    profile.title='Athlete profile';
    profile.innerHTML='<span aria-hidden="true">⚙</span>';
    profile.addEventListener('click',()=>{
      const shellProfile=document.querySelector('.training-profile-button');
      if(shellProfile){shellProfile.click();return;}
      const hidden=[...nav.querySelectorAll('button')].find(b=>b.dataset.jfOriginalTab==='My Details');
      if(hidden){hidden.click();window.scrollTo({top:0,behavior:'smooth'});}
    });
    actions.prepend(profile);
  }
  const details=[...nav.querySelectorAll('button')].find(b=>b.dataset.jfOriginalTab==='My Details');
  actions?.querySelector('.jf-profile-button')?.classList.toggle('active',Boolean(details?.classList.contains('active')));
}

function enhanceOverview(){
  const nav=document.querySelector('.training-page .section-nav');
  const overview=[...nav?.querySelectorAll('button')||[]].find(b=>b.textContent.trim()==='Overview');
  if(!overview?.classList.contains('active'))return;
  const main=document.querySelector('.training-page .app-shell main');
  if(!main)return;
  const next=main.querySelector('.next-session');
  if(next){
    renameTextNode(next.querySelector('.card-title'),'Next session','Up next');
    if(!next.querySelector('.jf-overview-workout-action') && next.querySelector('h2')?.textContent.trim()!=='No session planned'){
      const button=document.createElement('button');
      button.type='button';
      button.className='secondary jf-overview-workout-action';
      button.textContent='View workout details';
      button.addEventListener('click',()=>openTab('My Plan'));
      next.append(button);
    }
  }
  const cards=[...main.querySelectorAll('.card')];
  for(const card of cards){
    const eyebrow=card.querySelector('.eyebrow');
    if(eyebrow?.textContent.trim()==='THIS WEEK') eyebrow.textContent='WEEK PROGRESS';
  }
}

function enhanceDetails(){
  const nav=document.querySelector('.training-page .section-nav');
  if(!nav)return;
  const details=[...nav.querySelectorAll('button')].find(b=>b.dataset.jfOriginalTab==='My Details');
  if(!details?.classList.contains('active'))return;
  const main=document.querySelector('.training-page .app-shell main');
  if(!main)return;
  const title=main.querySelector('.card-title');
  if(title) renameTextNode(title,'My Details','Athlete profile');
  if(!main.querySelector('.jf-back-overview')){
    const back=document.createElement('button');
    back.type='button';
    back.className='jf-back-overview';
    back.textContent='← Back to Today';
    back.addEventListener('click',()=>openTab('Overview'));
    const first=main.querySelector('.stack');
    first?.prepend(back);
  }
}

function enhancePlan(){
  const nav=document.querySelector('.training-page .section-nav');
  const plan=[...nav?.querySelectorAll('button')||[]].find(b=>b.textContent.trim()==='My Plan');
  if(!plan?.classList.contains('active'))return;
  const main=document.querySelector('.training-page .app-shell main');
  if(!main)return;
  if(!main.querySelector('.jf-plan-helper')){
    const segmented=main.querySelector('.segmented');
    if(segmented){
      const note=document.createElement('p');
      note.className='jf-plan-helper';
      note.textContent='Tap “Workout details + Garmin FIT” on any session for the full breakdown.';
      segmented.after(note);
    }
  }
}

function apply(){
  if(!document.querySelector('.training-page .app-shell'))return;
  enhanceNav();
  enhanceOverview();
  enhanceDetails();
  enhancePlan();
}

function queue(){
  if(queued)return;queued=true;
  setTimeout(()=>{queued=false;apply();},80);
}

if(typeof window!=='undefined'){
  window.addEventListener('load',queue);
  const start=()=>{
    if(!document.body)return;
    const obs=new MutationObserver(muts=>{
      if(muts.some(m=>m.addedNodes.length||m.removedNodes.length))queue();
    });
    obs.observe(document.body,{childList:true,subtree:true});
    queue();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
