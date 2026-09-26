import { byKey } from './catalog';

const BASKET_KEY='just-fuel-basket-v3';
const BASKET_TTL=24*60*60*1000;

function readBasket(){
  try{
    const parsed=JSON.parse(localStorage.getItem(BASKET_KEY));
    if(!parsed?.savedAt||Date.now()-parsed.savedAt>BASKET_TTL)return[];
    return Array.isArray(parsed.items)?parsed.items:[];
  }catch{return[]}
}

function addLine(items,product,variant,quantity){
  const qty=Math.max(0,Number(quantity)||0);
  if(!qty||!product||!variant)return;
  const idx=items.findIndex(x=>x.variantId===variant.id);
  const line={
    productKey:product.key,
    productTitle:product.title,
    variantId:variant.id,
    variantTitle:variant.title,
    price:Number(variant.price),
    image:variant.image||product.image,
    quantity:qty
  };
  if(idx<0)items.push(line);
  else items[idx]={...items[idx],quantity:items[idx].quantity+qty};
}

function findTallyValue(card,label){
  const cell=[...card.querySelectorAll('.training-tally-grid span')].find(el=>el.textContent?.toLowerCase().includes(label.toLowerCase()));
  const value=Number(cell?.querySelector('b')?.textContent||0);
  return {cell,value:Number.isFinite(value)?value:0};
}

function findSelect(card,label){
  const target=[...card.querySelectorAll('.training-flavour-grid label')].find(el=>el.textContent?.toLowerCase().startsWith(label.toLowerCase()));
  return target?.querySelector('select')||null;
}

function enhance(card){
  const regular=findTallyValue(card,'Gels');
  const boost=findTallyValue(card,'Boost');
  const totalGels=regular.value+boost.value;
  const grid=card.querySelector('.training-flavour-grid');
  if(!grid)return;

  let control=grid.querySelector('.boost-swap-control');
  const signature=`${totalGels}:${boost.value}`;
  if(!control){
    control=document.createElement('div');
    control.className='boost-swap-control';
    control.innerHTML=`
      <div class="boost-swap-copy">
        <span>Boost gels</span>
        <small>100 mg caffeine each · replaces regular gels</small>
      </div>
      <div class="boost-swap-stepper">
        <button type="button" class="boost-minus" aria-label="Use fewer Boost gels">−</button>
        <b class="boost-count">0</b>
        <button type="button" class="boost-plus" aria-label="Use more Boost gels">+</button>
      </div>
      <div class="boost-swap-note"></div>`;
    grid.appendChild(control);
  }

  if(control.dataset.signature!==signature){
    control.dataset.signature=signature;
    control.dataset.totalGels=String(totalGels);
    control.dataset.autoBoost=String(boost.value);
    control.dataset.boost=String(boost.value);
  }

  function render(){
    const selected=Math.max(0,Math.min(Number(control.dataset.totalGels||0),Number(control.dataset.boost||0)));
    control.dataset.boost=String(selected);
    const count=control.querySelector('.boost-count');
    const note=control.querySelector('.boost-swap-note');
    if(count)count.textContent=String(selected);
    if(note)note.textContent=`Suggested ${control.dataset.autoBoost||0} · ${Number(control.dataset.totalGels||0)-selected} regular gel${Number(control.dataset.totalGels||0)-selected===1?'':'s'} + ${selected} Boost`;
    if(regular.cell?.querySelector('b'))regular.cell.querySelector('b').textContent=String(Number(control.dataset.totalGels||0)-selected);
    if(boost.cell?.querySelector('b'))boost.cell.querySelector('b').textContent=String(selected);
  }

  const minus=control.querySelector('.boost-minus');
  const plus=control.querySelector('.boost-plus');
  if(minus&&!minus.dataset.bound){
    minus.dataset.bound='1';
    minus.addEventListener('click',()=>{control.dataset.boost=String(Math.max(0,Number(control.dataset.boost||0)-1));render();});
  }
  if(plus&&!plus.dataset.bound){
    plus.dataset.bound='1';
    plus.addEventListener('click',()=>{control.dataset.boost=String(Math.min(Number(control.dataset.totalGels||0),Number(control.dataset.boost||0)+1));render();});
  }
  render();
}

function enhanceAll(){
  document.querySelectorAll('.training-tally-card').forEach(enhance);
}

function customAddToBasket(button){
  const card=button.closest('.training-tally-card');
  const control=card?.querySelector('.boost-swap-control');
  if(!card||!control)return false;

  const bottleProduct=byKey('bottle_mix');
  const gelProduct=byKey('energy_gel');
  const recoverProduct=byKey('recover');
  const boostVariant=gelProduct?.variants.find(v=>v.title==='Boost');

  const bottleQty=findTallyValue(card,'Bottle Mix').value;
  const recoverQty=findTallyValue(card,'Recover').value;
  const totalGels=Number(control.dataset.totalGels||0);
  const boostQty=Math.max(0,Math.min(totalGels,Number(control.dataset.boost||0)));
  const regularQty=Math.max(0,totalGels-boostQty);

  const bottleSelect=findSelect(card,'Bottle Mix');
  const gelSelect=findSelect(card,'Regular gel');
  const recoverSelect=findSelect(card,'Recover');
  const bottleVariant=bottleProduct?.variants.find(v=>v.id===bottleSelect?.value)||bottleProduct?.variants[0];
  const regularVariant=gelProduct?.variants.find(v=>v.id===gelSelect?.value&&v.title!=='Boost')||gelProduct?.variants.find(v=>v.title!=='Boost');
  const recoverVariant=recoverProduct?.variants.find(v=>v.id===recoverSelect?.value)||recoverProduct?.variants[0];

  const items=readBasket();
  addLine(items,bottleProduct,bottleVariant,bottleQty);
  addLine(items,gelProduct,regularVariant,regularQty);
  addLine(items,gelProduct,boostVariant,boostQty);
  addLine(items,recoverProduct,recoverVariant,recoverQty);
  localStorage.setItem(BASKET_KEY,JSON.stringify({savedAt:Date.now(),items}));
  sessionStorage.setItem('jf-open-basket-after-reload','1');
  window.location.reload();
  return true;
}

if(typeof window!=='undefined'){
  const observer=new MutationObserver(()=>enhanceAll());
  window.addEventListener('DOMContentLoaded',()=>{
    enhanceAll();
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.training-tally-add');
    if(!button)return;
    const control=button.closest('.training-tally-card')?.querySelector('.boost-swap-control');
    if(!control)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    customAddToBasket(button);
  },true);
}
