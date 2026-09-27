import fs from 'node:fs';

const path='src/training-workout-details.js';
let src=fs.readFileSync(path,'utf8');

src=src.replace(/function isAndroid\(\)\{[\s\S]*?\n\}\nasync function sessions/, 'async function sessions');

const garminBlock=`function downloadFitBlob(blob,filename){
  const a=document.createElement('a');a.href=window.URL.createObjectURL(blob);a.download=filename;a.style.display='none';document.body.append(a);a.click();
  setTimeout(()=>{window.URL.revokeObjectURL(a.href);a.remove()},2500);
}
async function downloadManualFit(data,btn,result){
  if(btn.disabled)return;btn.disabled=true;const old=btn.textContent;btn.textContent='Creating .FIT file…';result.hidden=true;
  try{
    const r=await callWorkout(data.session_id,'fit');const blob=await r.blob();const cd=r.headers.get('content-disposition')||'';const match=cd.match(/filename=\\\"?([^\\\";]+)\\\"?/i);const filename=match?.[1]||'just-fuel-workout.fit';
    downloadFitBlob(blob,filename);btn.textContent='.FIT downloaded';result.textContent='Manual FIT downloaded. This fallback is intended for computer/USB transfer only.';result.hidden=false;
    setTimeout(()=>{btn.textContent=old},3000);
  }catch(e){btn.textContent=e?.message||'Download failed';result.textContent='The workout could not be downloaded. Please try again.';result.hidden=false;setTimeout(()=>btn.textContent=old,2800)}finally{btn.disabled=false}
}
function renderGarminSync(body,data){
  const guide=el('div','workout-garmin-guide');
  guide.append(el('strong','','Garmin sync'));
  guide.append(el('p','','One-tap Send to Garmin is being connected through the Garmin Training API. No ZIP, extracting or course import will be required.'));
  const send=el('button','workout-fit-button');send.type='button';send.disabled=true;send.textContent='Send to Garmin — coming soon';guide.append(send);
  const details=document.createElement('details');details.className='workout-garmin-howto';
  const summary=document.createElement('summary');summary.textContent='Manual FIT download';
  const note=el('p','','Advanced fallback only: download the structured .FIT for computer/USB transfer. Garmin Connect mobile may treat manually opened FIT files as Courses.');
  const btn=el('button','workout-fit-button');btn.type='button';btn.textContent='Download .FIT manually';
  const result=el('div','workout-fit-result');result.hidden=true;
  btn.addEventListener('click',()=>downloadManualFit(data,btn,result));
  details.append(summary,note,btn,result);guide.append(details);body.append(guide);
}`;

src=src.replace(/function renderGarminGuide\(body\)\{[\s\S]*?\n\}\nfunction renderDetails/, garminBlock+'\nfunction renderDetails');

src=src.replace(/  if\(data\.downloadable!==false\)\{[\s\S]*?\n  \}\n\}\nfunction addEnhancement/, "  if(data.downloadable!==false)renderGarminSync(body,data);\n}\nfunction addEnhancement");

src=src.replace("toggle.textContent='Workout details + Garmin FIT'", "toggle.textContent='Workout details + Garmin'");
src=src.replace("toggle.textContent=opening?'Hide workout details':'Workout details + Garmin FIT'", "toggle.textContent=opening?'Hide workout details':'Workout details + Garmin'");

if(src.includes('Download Garmin workout ZIP')||src.includes('zipSingleFile')||src.includes('function renderGarminGuide'))throw new Error('Old Garmin ZIP UI still present');
if(!src.includes('Send to Garmin — coming soon')||!src.includes('Manual FIT download'))throw new Error('New Garmin UI was not applied');
fs.writeFileSync(path,src);
console.log('Garmin direct-sync UI applied.');
