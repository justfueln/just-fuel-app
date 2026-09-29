import './final-ux-v10.css';

let observer=null;
let lastSection='';
let queued=false;

function ensureSkipLink(){
  if(document.querySelector('.jf-skip-link'))return;
  const root=document.getElementById('root');
  if(!root)return;
  const link=document.createElement('a');
  link.className='jf-skip-link';
  link.href='#jf-main-content';
  link.textContent='Skip to main content';
  document.body.insertBefore(link,root);
}

function markMainContent(){
  const content=document.querySelector('.shell-content');
  if(!content)return;
  if(!content.id)content.id='jf-main-content';
  if(!content.hasAttribute('tabindex'))content.setAttribute('tabindex','-1');
}

function activeLabel(nav){
  const active=nav?.querySelector('button.active');
  return active?.textContent?.replace(/\s+/g,' ').trim()||'';
}

function markCurrentNavigation(){
  document.querySelectorAll('.bottom-nav,.training-phase2-nav').forEach(nav=>{
    nav.querySelectorAll('button').forEach(button=>{
      if(button.classList.contains('active'))button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  });
}

function improveStatusSemantics(){
  document.querySelectorAll('.notice,.form-status,.shop-added-message,.reminder-message-v2').forEach(node=>{
    if(!node.hasAttribute('role'))node.setAttribute('role','status');
    if(!node.hasAttribute('aria-live'))node.setAttribute('aria-live','polite');
  });
}

function trackSection(){
  const nav=document.querySelector('.bottom-nav');
  const section=activeLabel(nav);
  if(!section||section===lastSection)return;
  lastSection=section;
  try{window.jfTrack?.('section_viewed',{destination:section},'navigation')}catch{}
}

function apply(){
  ensureSkipLink();
  markMainContent();
  markCurrentNavigation();
  improveStatusSemantics();
  trackSection();
}

function schedule(){
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;apply()});
}

function start(){
  apply();
  if(observer)return;
  observer=new MutationObserver(schedule);
  observer.observe(document.body,{subtree:true,childList:true});
  document.addEventListener('click',schedule,{passive:true});
  window.addEventListener('popstate',schedule);
}

if(typeof window!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
}
