import {supabase} from './main';
import {hasExactRaceSearchMatch,normalizeRaceSearch,rankFuzzyRaceMatches} from './race-fuzzy-search-utils';
import './race-fuzzy-search-v1.css';

let catalogPromise=null;
let timer=0;

function todayKey(){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

function uniqueEvents(rows=[]){
  const map=new Map();
  for(const row of rows){
    if(!row?.event_id||map.has(row.event_id))continue;
    map.set(row.event_id,row);
  }
  return[...map.values()];
}

async function loadCatalog(){
  if(catalogPromise)return catalogPromise;
  catalogPromise=supabase
    .from('event_catalog_search')
    .select('event_id,event_name,start_date,sport_category,discipline,province,city,venue,organiser,is_verified')
    .gte('start_date',todayKey())
    .order('start_date',{ascending:true})
    .limit(1200)
    .then(({data,error})=>{
      if(error)throw error;
      return uniqueEvents(data||[]);
    })
    .catch(error=>{
      catalogPromise=null;
      console.warn('Fuzzy race search could not load the event catalog:',error);
      return[];
    });
  return catalogPromise;
}

function currentFilters(root){
  const selects=[...root.querySelectorAll('.race-registry-filters select')];
  return{
    sport:selects[0]?.value||'all',
    discipline:selects[1]?.value||'all',
    province:selects[2]?.value||'All provinces'
  };
}

function passesFilters(event,filters){
  return(filters.sport==='all'||event.sport_category===filters.sport)
    &&(filters.discipline==='all'||event.discipline===filters.discipline)
    &&(filters.province==='All provinces'||event.province===filters.province);
}

function formatDate(value){
  if(!value)return'';
  try{return new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${String(value).slice(0,10)}T12:00:00`))}
  catch{return String(value)}
}

function suggestionHost(input){
  return input.closest('.card')?.querySelector('.event-search')||input.parentElement;
}

function clearSuggestions(input){
  suggestionHost(input)?.querySelector('.race-fuzzy-suggestions')?.remove();
}

function setReactInputValue(input,value){
  const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')?.set;
  if(setter)setter.call(input,value);else input.value=value;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
}

function renderSuggestions(input,matches,query){
  clearSuggestions(input);
  if(!matches.length)return;
  const host=suggestionHost(input);
  if(!host)return;
  const box=document.createElement('div');
  box.className='race-fuzzy-suggestions';
  box.setAttribute('role','listbox');
  box.setAttribute('aria-label','Possible race matches');
  const heading=document.createElement('div');
  heading.className='race-fuzzy-heading';
  heading.innerHTML=`<strong>Possible matches</strong><span>Showing races similar to “${String(query).replace(/[<>]/g,'')}”</span>`;
  box.appendChild(heading);
  for(const{event,score}of matches){
    const button=document.createElement('button');
    button.type='button';
    button.className='race-fuzzy-option';
    button.dataset.fuzzyEventName=event.event_name;
    button.setAttribute('role','option');
    button.innerHTML=`<span><strong>${String(event.event_name||'').replace(/[<>]/g,'')}</strong><small>${[formatDate(event.start_date),event.city||event.province].filter(Boolean).join(' · ')}</small></span><b>${Math.round(score*100)}% match</b>`;
    box.appendChild(button);
  }
  host.appendChild(box);
}

async function updateSuggestions(input){
  const query=input.value||'';
  if(normalizeRaceSearch(query).replace(/\s/g,'').length<3){clearSuggestions(input);return}
  const root=input.closest('.race-registry-v2');
  if(!root){clearSuggestions(input);return}
  const catalog=await loadCatalog();
  if(!document.body.contains(input)||input.value!==query)return;
  const filters=currentFilters(root);
  const filtered=catalog.filter(event=>passesFilters(event,filters));
  if(filtered.some(event=>hasExactRaceSearchMatch(event,query))){clearSuggestions(input);return}
  renderSuggestions(input,rankFuzzyRaceMatches(filtered,query,{limit:6}),query);
}

function queue(input){
  clearTimeout(timer);
  timer=window.setTimeout(()=>updateSuggestions(input),110);
}

function searchInputFrom(target){
  return target?.matches?.('.race-registry-v2 .event-search input')?target:null;
}

document.addEventListener('input',event=>{
  const input=searchInputFrom(event.target);
  if(input)queue(input);
},{passive:true});

document.addEventListener('change',event=>{
  if(!event.target?.matches?.('.race-registry-v2 .race-registry-filters select'))return;
  const input=event.target.closest('.race-registry-v2')?.querySelector('.event-search input');
  if(input&&input.value.trim())queue(input);
},{passive:true});

document.addEventListener('click',event=>{
  const option=event.target?.closest?.('.race-fuzzy-option');
  if(option){
    const root=option.closest('.race-registry-v2');
    const input=root?.querySelector('.event-search input');
    if(input){
      setReactInputValue(input,option.dataset.fuzzyEventName||'');
      clearSuggestions(input);
      input.focus();
    }
    return;
  }
  if(!event.target?.closest?.('.race-fuzzy-suggestions,.event-search')){
    document.querySelectorAll('.race-fuzzy-suggestions').forEach(node=>node.remove());
  }
},{passive:true});
