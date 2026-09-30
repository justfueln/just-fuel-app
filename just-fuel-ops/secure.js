'use strict';

const SUPABASE_URL='https://ufolqntrfmvefpvrjnsa.supabase.co';
const SUPABASE_KEY='sb_publishable_dQVErA2uFoym91L-vsW-kw_n6dWJfqy';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(n||0));
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
let db=null, pendingEmail='', role='none', orderFilter='all', stockTab='finished', deferredPrompt=null;
const S={customers:[],products:[],raw:[],orders:[],items:[],batches:[],payments:[]};

function show(id){['loadingGate','authGate','setupGate','appRoot'].forEach(x=>{const el=$('#'+x);if(el)el.classList.toggle('hidden',x!==id);});}
function message(id,text,ok=false){const e=$(id);if(!e)return;e.textContent=text||'';e.className='form-message'+(ok?' success-text':'');}
function toast(text){const e=$('#toast');if(!e)return;e.textContent=text;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200);}
function failStartup(text){show('authGate');message('#authMessage',text||'Could not start Just Fuel Ops. Please refresh and try again.');}

async function withTimeout(p,ms=10000){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('Request timed out')),ms))]);}

async function start(){
  show('loadingGate');
  try{
    if(!window.supabase?.createClient) throw new Error('Secure connection library did not load');
    db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data,error}=await withTimeout(db.auth.getSession());
    if(error) throw error;
    await sessionGate(data?.session||null);
    db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>sessionGate(session),0));
  }catch(err){console.error(err);failStartup(err?.message||'Startup failed');}
}

async function sessionGate(session){
  if(!session?.user){show('authGate');return;}
  try{
    const {data,error}=await withTimeout(db.rpc('ops_access_status'));
    if(error) throw error;
    if(!data?.has_access){show('setupGate');message('#setupMessage','Signed in, but this account is not approved for Just Fuel Ops yet.');return;}
    role=data.role||'staff';
    if($('#roleBadge')) $('#roleBadge').textContent=role;
    show('appRoot');
    await loadData();
  }catch(err){console.error(err);show('setupGate');message('#setupMessage','Ops access check failed. Please sign out and try again.');}
}

async function loadData(){
  try{
    const q=await withTimeout(Promise.all([
      db.from('ops_customers').select('*').eq('is_active',true).order('full_name'),
      db.from('ops_products').select('*').eq('is_active',true).order('name'),
      db.from('ops_raw_materials').select('*').eq('is_active',true).order('name'),
      db.from('ops_orders').select('*').order('created_at',{ascending:false}).limit(200),
      db.from('ops_order_items').select('*'),
      db.from('ops_production_batches').select('*').order('created_at',{ascending:false}).limit(100),
      db.from('ops_payments').select('*').order('created_at',{ascending:false}).limit(200)
    ]),15000);
    const bad=q.find(x=>x.error);if(bad)throw bad.error;
    [S.customers,S.products,S.raw,S.orders,S.items,S.batches,S.payments]=q.map(x=>x.data||[]);
    renderAll();
  }catch(err){console.error(err);toast('Could not load Ops data');renderAll();}
}

const customer=id=>S.customers.find(x=>x.id===id)||{full_name:'Unknown customer'};
const product=id=>S.products.find(x=>x.id===id)||{name:'Unknown product',unit_price:0,stock_on_hand:0,stock_reserved:0,reorder_level:0};
const items=id=>S.items.filter(x=>x.order_id===id);
const total=o=>Number(o.total_amount||items(o.id).reduce((t,i)=>t+Number(i.line_total||0),0));
const status=s=>String(s||'').replaceAll('_',' ');
function badge(s){const c=['paid','ready','delivered','completed'].includes(s)?'good':['awaiting_payment','production','packing','planned'].includes(s)?'warn':s==='cancelled'?'bad':'';return `<span class="pill ${c}">${esc(status(s))}</span>`;}
function orderRow(o){const c=customer(o.customer_id);const list=items(o.id).map(i=>`${Number(i.quantity)}× ${product(i.product_id).name}`).join(' · ')||'No items';return `<div class="row"><div class="row-main"><strong>${esc(o.order_number)} · ${esc(c.full_name)}</strong><small>${esc(status(o.source))} · ${esc(list)}</small></div><div style="text-align:right"><div class="money">${money(total(o))}</div>${badge(o.status)}</div></div>`;}

function renderAll(){renderHome();renderOrders();renderProduction();renderStock();}
function renderHome(){
  const open=S.orders.filter(o=>!['ready','delivered','cancelled'].includes(o.status));
  const outstanding=S.orders.filter(o=>['unpaid','partial'].includes(o.payment_status)).reduce((t,o)=>t+total(o),0);
  const lowP=S.products.filter(p=>Number(p.stock_on_hand)-Number(p.stock_reserved)<=Number(p.reorder_level));
  const lowR=S.raw.filter(r=>Number(r.quantity_on_hand)<=Number(r.reorder_level));
  if($('#kpis')) $('#kpis').innerHTML=[['Open orders',open.length],['Outstanding',money(outstanding)],['Low stock',lowP.length+lowR.length],['Customers',S.customers.length]].map(([a,b])=>`<div class="kpi"><div class="label">${esc(a)}</div><div class="value">${esc(b)}</div></div>`).join('');
  if($('#alerts')) $('#alerts').innerHTML=[...lowP.map(p=>`<div class="alert"><strong>${esc(p.name)}</strong> — ${esc(Number(p.stock_on_hand)-Number(p.stock_reserved))} available.</div>`),...lowR.map(r=>`<div class="alert"><strong>${esc(r.name)}</strong> — ${esc(r.quantity_on_hand)} ${esc(r.unit)} available.</div>`)].slice(0,8).join('')||'<div class="empty-state"><strong>No stock alerts</strong></div>';
  if($('#homeOrders')) $('#homeOrders').innerHTML=S.orders.slice(0,5).map(orderRow).join('')||'<div class="empty-state"><strong>No live orders yet</strong></div>';
}
function renderOrders(){const arr=S.orders.filter(o=>orderFilter==='all'||o.status===orderFilter);if($('#ordersList'))$('#ordersList').innerHTML=arr.length?`<div class="panel">${arr.map(orderRow).join('')}</div>`:'<div class="panel empty-state"><strong>No orders in this filter</strong></div>';}
function renderProduction(){
  const req={};S.orders.filter(o=>!['ready','delivered','cancelled'].includes(o.status)).forEach(o=>items(o.id).forEach(i=>req[i.product_id]=(req[i.product_id]||0)+Number(i.quantity)));
  const needs=Object.entries(req).map(([id,q])=>{const p=product(id),av=Math.max(0,Number(p.stock_on_hand)-Number(p.stock_reserved));return {...p,q,av,need:Math.max(0,q-av)}}).sort((a,b)=>b.need-a.need);
  if($('#productionNeeds'))$('#productionNeeds').innerHTML=needs.map(x=>`<div class="row"><div class="row-main"><strong>${esc(x.name)}</strong><small>Orders ${x.q} · Available ${x.av}</small></div><div class="qty">${x.need?'Make '+x.need:'Covered'}</div></div>`).join('')||'<div class="empty-state"><strong>No production demand yet</strong></div>';
  if($('#batchList'))$('#batchList').innerHTML=S.batches.map(b=>`<div class="row"><div class="row-main"><strong>${esc(b.batch_code)} · ${esc(product(b.product_id).name)}</strong></div><div>${esc(b.planned_quantity)} ${badge(b.status)}</div></div>`).join('')||'<div class="empty-state"><strong>No batches yet</strong></div>';
}
function renderStock(){
  if(!$('#stockContent'))return;
  if(stockTab==='finished') $('#stockContent').innerHTML=S.products.length?`<div class="panel">${S.products.map(p=>`<div class="row"><div class="row-main"><strong>${esc(p.name)}</strong><small>${esc(p.sku||'')} · ${esc(p.category||'')}</small></div><div class="qty">${esc(Number(p.stock_on_hand)-Number(p.stock_reserved))}</div></div>`).join('')}</div>`:'<div class="panel empty-state"><strong>No finished products yet</strong></div>';
  else if(stockTab==='raw') $('#stockContent').innerHTML=S.raw.length?`<div class="panel">${S.raw.map(r=>`<div class="row"><div class="row-main"><strong>${esc(r.name)}</strong><small>${esc(r.sku||'')}</small></div><div class="qty">${esc(r.quantity_on_hand)} ${esc(r.unit)}</div></div>`).join('')}</div>`:'<div class="panel empty-state"><strong>No raw materials yet</strong></div>';
  else $('#stockContent').innerHTML='<div class="panel empty-state"><strong>Recipe editor is the next module</strong></div>';
}
function nav(v){$$('.view').forEach(x=>x.classList.toggle('active',x.dataset.view===v));$$('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===v));window.scrollTo({top:0});}

$('#emailForm')?.addEventListener('submit',async e=>{e.preventDefault();pendingEmail=$('#emailInput').value.trim().toLowerCase();message('#authMessage','Sending code…',true);try{const {error}=await withTimeout(db.auth.signInWithOtp({email:pendingEmail,options:{shouldCreateUser:false}}));if(error)throw error;$('#emailForm').classList.add('hidden');$('#otpForm').classList.remove('hidden');message('#authMessage','Check your email for the 6-digit code.',true);$('#otpInput').focus();}catch(err){message('#authMessage',err.message||'Could not send code');}});
$('#otpForm')?.addEventListener('submit',async e=>{e.preventDefault();message('#authMessage','Signing in…',true);try{const {error}=await withTimeout(db.auth.verifyOtp({email:pendingEmail,token:$('#otpInput').value.trim(),type:'email'}));if(error)throw error;}catch(err){message('#authMessage',err.message||'Sign-in failed');}});
$('#changeEmailBtn')?.addEventListener('click',()=>{$('#otpForm').classList.add('hidden');$('#emailForm').classList.remove('hidden');message('#authMessage','');});
$('#setupForm')?.addEventListener('submit',async e=>{e.preventDefault();message('#setupMessage','Activating owner access…',true);try{const {data,error}=await withTimeout(db.rpc('ops_claim_first_admin',{p_setup_code:$('#setupCodeInput').value.trim()}));if(error)throw error;if(data)await sessionGate((await db.auth.getSession()).data.session);}catch(err){message('#setupMessage',err.message||'Activation failed');}});
async function signOut(){if(db)await db.auth.signOut();location.reload();}
$('#logoutBtn')?.addEventListener('click',signOut);$('#setupLogoutBtn')?.addEventListener('click',signOut);
$$('[data-nav]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));
$$('#orderFilters button').forEach(b=>b.addEventListener('click',()=>{orderFilter=b.dataset.filter;$$('#orderFilters button').forEach(x=>x.classList.toggle('active',x===b));renderOrders();}));
$$('#stockTabs button').forEach(b=>b.addEventListener('click',()=>{stockTab=b.dataset.stocktab;$$('#stockTabs button').forEach(x=>x.classList.toggle('active',x===b));renderStock();}));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;if($('#installBtn'))$('#installBtn').hidden=false;});
$('#installBtn')?.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true;});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error));

setTimeout(()=>{if($('#loadingGate')&&!$('#loadingGate').classList.contains('hidden'))failStartup('Startup is taking too long. Please refresh or check your connection.');},12000);
start();
