function clickBasketWhenReady(attempt=0){
  const button=document.querySelector('.bag-button, .training-basket');
  if(button instanceof HTMLElement){ button.click(); return; }
  if(attempt<40) setTimeout(()=>clickBasketWhenReady(attempt+1),75);
}

if(typeof window!=='undefined'){
  window.addEventListener('jf-open-basket',()=>clickBasketWhenReady());
  window.addEventListener('load',()=>{
    if(sessionStorage.getItem('jf-open-basket-after-reload')==='1'){
      sessionStorage.removeItem('jf-open-basket-after-reload');
      setTimeout(()=>clickBasketWhenReady(),150);
    }
  });
}
