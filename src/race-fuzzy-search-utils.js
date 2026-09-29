export function normalizeRaceSearch(value=''){
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function damerauLevenshtein(a,b){
  const x=normalizeRaceSearch(a),y=normalizeRaceSearch(b);
  if(x===y)return 0;
  if(!x.length)return y.length;
  if(!y.length)return x.length;
  const rows=x.length+1,cols=y.length+1;
  const d=Array.from({length:rows},()=>new Array(cols).fill(0));
  for(let i=0;i<rows;i++)d[i][0]=i;
  for(let j=0;j<cols;j++)d[0][j]=j;
  for(let i=1;i<rows;i++){
    for(let j=1;j<cols;j++){
      const cost=x[i-1]===y[j-1]?0:1;
      d[i][j]=Math.min(
        d[i-1][j]+1,
        d[i][j-1]+1,
        d[i-1][j-1]+cost
      );
      if(i>1&&j>1&&x[i-1]===y[j-2]&&x[i-2]===y[j-1]){
        d[i][j]=Math.min(d[i][j],d[i-2][j-2]+cost);
      }
    }
  }
  return d[x.length][y.length];
}

function similarity(a,b){
  const x=normalizeRaceSearch(a),y=normalizeRaceSearch(b);
  if(!x||!y)return 0;
  if(x===y)return 1;
  const distance=damerauLevenshtein(x,y);
  return Math.max(0,1-distance/Math.max(x.length,y.length));
}

function bigrams(value){
  const text=normalizeRaceSearch(value).replace(/\s/g,'');
  if(text.length<2)return text?[text]:[];
  const out=[];
  for(let i=0;i<text.length-1;i++)out.push(text.slice(i,i+2));
  return out;
}

function dice(a,b){
  const aa=bigrams(a),bb=bigrams(b);
  if(!aa.length||!bb.length)return 0;
  const bag=new Map();
  for(const part of aa)bag.set(part,(bag.get(part)||0)+1);
  let matches=0;
  for(const part of bb){
    const count=bag.get(part)||0;
    if(count){matches++;bag.set(part,count-1)}
  }
  return 2*matches/(aa.length+bb.length);
}

function tokenSimilarity(query,candidate){
  const qTokens=normalizeRaceSearch(query).split(' ').filter(Boolean);
  const cTokens=normalizeRaceSearch(candidate).split(' ').filter(Boolean);
  if(!qTokens.length||!cTokens.length)return 0;
  let total=0;
  for(const q of qTokens){
    let best=0;
    for(const c of cTokens){
      if(c.startsWith(q)||q.startsWith(c))best=Math.max(best,Math.min(q.length,c.length)/Math.max(q.length,c.length));
      best=Math.max(best,similarity(q,c));
    }
    total+=best;
  }
  return total/qTokens.length;
}

function fuzzyScore(query,candidate){
  const q=normalizeRaceSearch(query),c=normalizeRaceSearch(candidate);
  if(!q||!c)return 0;
  if(c.includes(q))return 1;
  const qTokens=q.split(' ');
  const cTokens=c.split(' ');
  const token=tokenSimilarity(q,c);
  const whole=similarity(q,c);
  const diceScore=dice(q,c);
  let windowBest=0;
  const windowSize=Math.max(1,Math.min(cTokens.length,qTokens.length));
  for(let size=Math.max(1,windowSize-1);size<=Math.min(cTokens.length,windowSize+1);size++){
    for(let i=0;i<=cTokens.length-size;i++)windowBest=Math.max(windowBest,similarity(q,cTokens.slice(i,i+size).join(' ')));
  }
  const prefix=(c.startsWith(q)||q.startsWith(c))?0.86:0;
  return Math.max(prefix,whole*0.82,windowBest*0.95,token*0.94,diceScore*0.82);
}

function threshold(query){
  const q=normalizeRaceSearch(query).replace(/\s/g,'');
  if(q.length<=2)return 1;
  if(q.length===3)return .74;
  if(q.length<=5)return .64;
  if(q.length<=8)return .58;
  return .54;
}

export function raceSearchText(event={}){
  return [event.event_name,event.city,event.province,event.venue,event.organiser].filter(Boolean).join(' ');
}

export function hasExactRaceSearchMatch(event,query){
  const q=normalizeRaceSearch(query);
  return Boolean(q)&&normalizeRaceSearch(raceSearchText(event)).includes(q);
}

export function rankFuzzyRaceMatches(events=[],query,{limit=6}={}){
  const q=normalizeRaceSearch(query);
  if(q.replace(/\s/g,'').length<3)return[];
  const minimum=threshold(q);
  return events
    .map(event=>{
      const nameScore=fuzzyScore(q,event.event_name||'');
      const cityScore=fuzzyScore(q,event.city||'')*.84;
      const provinceScore=fuzzyScore(q,event.province||'')*.78;
      const score=Math.max(nameScore,cityScore,provinceScore);
      return{event,score};
    })
    .filter(row=>row.score>=minimum)
    .sort((a,b)=>b.score-a.score||Number(Boolean(b.event?.is_verified))-Number(Boolean(a.event?.is_verified))||String(a.event?.start_date||'').localeCompare(String(b.event?.start_date||'')))
    .slice(0,limit);
}
