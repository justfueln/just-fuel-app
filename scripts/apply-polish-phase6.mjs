import fs from 'node:fs';

const path='src/ShellNextV3.jsx';
let source=fs.readFileSync(path,'utf8');

const importNeedle="import TrainingApp from './App';";
if(!source.includes("import CheckoutDrawer from './CheckoutDrawer';")){
  if(!source.includes(importNeedle))throw new Error('TrainingApp import not found');
  source=source.replace(importNeedle,`${importNeedle}\nimport CheckoutDrawer from './CheckoutDrawer';`);
}

const oldTag='<BasketDrawer open={basketOpen} close={closeBasket} basket={basket} lastBasket={lastBasket} repeatLastBasket={repeatLastBasket} remember={rememberBasket} count={basketCount} total={basketTotal} setQty={setLineQty} clear={()=>setBasket([])}/>';
const newTag='<CheckoutDrawer open={basketOpen} close={closeBasket} basket={basket} lastBasket={lastBasket} repeatLastBasket={repeatLastBasket} remember={rememberBasket} count={basketCount} total={basketTotal} setQty={setLineQty} clear={()=>setBasket([])}/>';
if(source.includes(oldTag))source=source.replace(oldTag,newTag);
else if(!source.includes(newTag))throw new Error('Basket drawer render tag not found');

const start=source.indexOf('function BasketDrawer(');
if(start>=0){
  const end=source.indexOf('function LearnPage()',start);
  if(end<0)throw new Error('LearnPage boundary not found');
  source=source.slice(0,start)+source.slice(end);
}

fs.writeFileSync(path,source);
