export function basketStats(basket=[]){
  const items=Array.isArray(basket)?basket:[];
  const itemCount=items.reduce((n,x)=>n+(Number(x?.quantity)||0),0);
  const total=Math.round(items.reduce((n,x)=>n+(Number(x?.price)||0)*(Number(x?.quantity)||0),0)*100)/100;
  return {itemCount,total};
}

export function freeDeliveryState(total,threshold=600){
  const value=Math.max(0,Number(total)||0);
  const limit=Math.max(0,Number(threshold)||0);
  return {
    freeDelivery:value>=limit,
    remaining:Math.max(0,Math.round((limit-value)*100)/100),
    progress:limit?Math.min(100,(value/limit)*100):100
  };
}

export function formatZar(value){
  return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(value||0));
}

export function buildWhatsAppOrderMessage(basket=[],total=0,threshold=600){
  const items=Array.isArray(basket)?basket:[];
  const lines=items.map(x=>`• ${x.productTitle} — ${x.variantTitle} × ${Number(x.quantity)||0} — ${formatZar((Number(x.price)||0)*(Number(x.quantity)||0))}`);
  const delivery=Number(total)>=Number(threshold)?'PUDO: Free over R600':'PUDO: R75 below R600';
  return ['Hi Just Fuel, I would like to place an order:','',...lines,'',`Order total: ${formatZar(total)}`,delivery,'','Please confirm availability and collection / delivery details.'].join('\n');
}

export function checkoutAnalytics(basket=[],total=0,threshold=600){
  const {itemCount}=basketStats(basket);
  return {
    basket_items:itemCount,
    basket_value:Math.round((Number(total)||0)*100)/100,
    free_delivery:Number(total)>=Number(threshold)
  };
}
