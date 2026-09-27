export function fitFlavorSplit(split,variants,total){
  const ids=(variants||[]).map(v=>String(v.id));
  const target=Math.max(0,Math.floor(Number(total)||0));
  const out={};let used=0;
  for(const id of ids){const q=Math.max(0,Math.floor(Number(split?.[id])||0));const keep=Math.min(q,Math.max(0,target-used));out[id]=keep;used+=keep}
  if(ids.length&&used<target)out[ids[0]]=(out[ids[0]]||0)+(target-used);
  return out;
}

export function moveFlavorUnit(split,variants,total,variantId,delta){
  const ids=(variants||[]).map(v=>String(v.id));
  const target=Math.max(0,Math.floor(Number(total)||0));
  const id=String(variantId);
  const out=fitFlavorSplit(split,variants,target);
  if(!ids.includes(id)||target===0||!delta)return out;
  if(delta>0){
    const donor=ids.find(x=>x!==id&&(out[x]||0)>0);
    if(donor){out[donor]-=1;out[id]=(out[id]||0)+1}
  }else if((out[id]||0)>0){
    const receiver=ids.find(x=>x!==id);
    if(receiver){out[id]-=1;out[receiver]=(out[receiver]||0)+1}
  }
  return out;
}

export function evenFlavorSplit(variants,total){
  const ids=(variants||[]).map(v=>String(v.id));
  const target=Math.max(0,Math.floor(Number(total)||0));
  const out={};ids.forEach(id=>out[id]=0);
  if(!ids.length)return out;
  for(let i=0;i<target;i++)out[ids[i%ids.length]]+=1;
  return out;
}

export function flavorBasketLines(product,variants,split){
  return (variants||[]).map(v=>({product,variant:v,quantity:Math.max(0,Math.floor(Number(split?.[String(v.id)])||0))})).filter(x=>x.quantity>0);
}
