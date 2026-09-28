import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Check,ChevronRight,CreditCard,MessageCircle,Minus,Plus,ShoppingBag,Trash2,X} from 'lucide-react';
import {FREE_PUDO_THRESHOLD,SHOP_DOMAIN,WHATSAPP_NUMBER,byKey,money,numericVariantId} from './catalog';
import {buildWhatsAppOrderMessage,checkoutAnalytics,freeDeliveryState} from './checkout-utils';

const BASKET_KEY='just-fuel-basket-v3';

function track(name,metadata={},category='conversion'){
  try{window.jfTrack?.(name,metadata,category)}catch{}
}

export default function CheckoutDrawer({open,close,basket,lastBasket,repeatLastBasket,remember,count,total,setQty,clear}){
  const[step,setStep]=useState('basket');
  const delivery=useMemo(()=>freeDeliveryState(total,FREE_PUDO_THRESHOLD),[total]);
  const previousCount=useMemo(()=>lastBasket.reduce((n,x)=>n+Number(x.quantity||0),0),[lastBasket]);
  const analytics=useMemo(()=>checkoutAnalytics(basket,total,FREE_PUDO_THRESHOLD),[basket,total]);
  const whatsappMessage=useMemo(()=>buildWhatsAppOrderMessage(basket,total,FREE_PUDO_THRESHOLD),[basket,total]);

  useEffect(()=>{if(!open)setStep('basket')},[open]);
  if(!open)return null;

  function beginCheckout(){
    if(!basket.length)return;
    track('checkout_started',analytics);
    setStep('choose');
  }
  function chooseOnline(){
    if(!basket.length)return;
    remember(basket);
    track('checkout_method_selected',{...analytics,checkout_method:'online'});
    const lines=basket.map(x=>`${numericVariantId(x.variantId)}:${x.quantity}`).join(',');
    track('checkout_online_redirected',{...analytics,checkout_method:'online'});
    window.location.assign(`${SHOP_DOMAIN}/cart/${lines}?ref=just-fuel-app`);
  }
  function chooseWhatsApp(){
    if(!basket.length)return;
    track('checkout_method_selected',{...analytics,checkout_method:'whatsapp'});
    setStep('whatsapp');
  }
  function openWhatsApp(){
    if(!basket.length)return;
    remember(basket);
    track('checkout_whatsapp_opened',{...analytics,checkout_method:'whatsapp'});
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`,'_blank','noopener,noreferrer');
  }
  function repeatPrevious(){track('previous_basket_restored',{basket_items:previousCount});repeatLastBasket()}
  function clearBasket(){track('basket_cleared',analytics,'interaction');clear()}
  function drawerBack(){if(step==='basket')close();else setStep(step==='whatsapp'?'choose':'basket')}
  function changeVariant(line,nextVariantId){
    if(!nextVariantId||nextVariantId===line.variantId)return;
    const product=byKey(line.productKey),variant=product?.variants?.find(v=>v.id===nextVariantId);if(!product||!variant)return;
    const items=basket.map(x=>({...x}));
    const oldIndex=items.findIndex(x=>x.variantId===line.variantId);if(oldIndex<0)return;
    const nextIndex=items.findIndex(x=>x.variantId===nextVariantId);
    if(nextIndex>=0&&nextIndex!==oldIndex){items[nextIndex]={...items[nextIndex],quantity:Number(items[nextIndex].quantity||0)+Number(line.quantity||0)};items.splice(oldIndex,1)}
    else items[oldIndex]={...items[oldIndex],variantId:variant.id,variantTitle:variant.title,price:Number(variant.price),image:variant.image||product.image};
    try{localStorage.setItem(BASKET_KEY,JSON.stringify({savedAt:Date.now(),items}));window.dispatchEvent(new CustomEvent('jf-basket-updated'));track('basket_flavour_changed',{product_key:line.productKey,from_variant:line.variantTitle,to_variant:variant.title},'interaction')}catch{}
  }

  return <div className="basket-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
    <aside className="basket-drawer checkout-v6" aria-label="Basket and checkout">
      <div className="basket-head">
        <div>{step!=='basket'&&<button className="checkout-back" onClick={drawerBack} aria-label="Back"><ArrowLeft size={20}/></button>}<span className="eyebrow-light">{step==='basket'?'YOUR BASKET':'CHECKOUT'}</span><h2>{step==='basket'?`${count} ${count===1?'item':'items'}`:step==='choose'?'How would you like to order?':'Review WhatsApp order'}</h2></div>
        <button onClick={close} className="basket-close" aria-label="Close basket"><X size={24}/></button>
      </div>

      {step==='basket'&&<>
        {basket.length===0?<div className="basket-empty"><ShoppingBag size={36}/><h3>Your basket is empty</h3><p>Add fuel from Shop, Plan or Training.</p>{lastBasket.length>0&&<button className="repeat-basket" onClick={repeatPrevious}><ShoppingBag size={17}/>Repeat previous basket · {previousCount} item{previousCount===1?'':'s'}</button>}</div>:<>
          <div className="basket-lines">{basket.map(line=>{const product=byKey(line.productKey),variants=product?.variants||[];return <div className="basket-line" key={line.variantId}><img src={line.image} alt=""/><div className="basket-line-main"><strong>{line.productTitle}</strong>{variants.length>1?<label className="basket-flavour-label"><span>Flavour</span><select className="basket-variant-select" value={line.variantId} onChange={e=>changeVariant(line,e.target.value)} aria-label={`Choose ${line.productTitle} flavour`}>{variants.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label>:<span>{line.variantTitle}</span>}<b>{money(line.price*line.quantity)}</b></div><div className="basket-line-actions"><button onClick={()=>setQty(line.variantId,line.quantity-1)} aria-label={`Remove one ${line.variantTitle}`}><Minus size={15}/></button><span>{line.quantity}</span><button onClick={()=>setQty(line.variantId,line.quantity+1)} aria-label={`Add one ${line.variantTitle}`}><Plus size={15}/></button><button className="remove" onClick={()=>setQty(line.variantId,0)} aria-label={`Remove ${line.variantTitle}`}><Trash2 size={16}/></button></div></div>})}</div>
          <div className="delivery-progress"><div className="progress-copy">{delivery.remaining>0?<><b>{money(delivery.remaining)}</b> away from free PUDO delivery</>:<b><Check size={15}/> Free PUDO delivery unlocked</b>}</div><div className="progress-track"><span style={{width:`${delivery.progress}%`}}/></div></div>
          <div className="basket-total"><span>Total</span><strong>{money(total)}</strong></div>
          <button className="checkout-primary" onClick={beginCheckout}><CreditCard size={19}/>Checkout<ChevronRight size={19}/></button>
          <div className="checkout-trust">Choose secure online checkout or review a WhatsApp order before sending.</div>
          <button className="clear-basket" onClick={clearBasket}>Clear basket</button>
        </>}
        <p className="basket-expiry">Basket stays saved for 14 days of inactivity.</p>
      </>}

      {step==='choose'&&<div className="checkout-choice-list">
        <button className="checkout-choice" onClick={chooseOnline} data-analytics-ignore="true"><span className="checkout-choice-icon"><CreditCard size={22}/></span><span><b>Online checkout</b><small>Continue to the Just Fuel website to complete payment securely.</small></span><ChevronRight size={20}/></button>
        <button className="checkout-choice" onClick={chooseWhatsApp} data-analytics-ignore="true"><span className="checkout-choice-icon"><MessageCircle size={22}/></span><span><b>WhatsApp order</b><small>Review the full order message first, then send it to Just Fuel.</small></span><ChevronRight size={20}/></button>
        <div className="checkout-order-summary"><span>{count} {count===1?'item':'items'}</span><strong>{money(total)}</strong><small>{delivery.freeDelivery?'Free PUDO delivery unlocked':'PUDO R75 below R600'}</small></div>
      </div>}

      {step==='whatsapp'&&<div className="whatsapp-review">
        <p>Check the message below. Nothing is sent until you tap <b>Open WhatsApp</b>.</p>
        <pre>{whatsappMessage}</pre>
        <button className="checkout-whatsapp-final" onClick={openWhatsApp} data-analytics-ignore="true"><MessageCircle size={19}/>Open WhatsApp</button>
        <button className="secondary-checkout-action" onClick={()=>setStep('choose')}>Choose another checkout method</button>
      </div>}
    </aside>
  </div>
}
