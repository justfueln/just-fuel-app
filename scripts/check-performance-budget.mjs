import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';

const dist='dist';
const html=readFileSync(join(dist,'index.html'),'utf8');
const refs=[...html.matchAll(/(?:src|href)=["']\/?(assets\/[^"']+\.(?:js|css))["']/g)].map(m=>m[1]);
const unique=[...new Set(refs)];

function bytes(file){return readFileSync(join(dist,file))}
function kb(n){return(n/1024).toFixed(1)}

const initial=unique.map(file=>{
  const body=bytes(file);
  return{file,raw:body.length,gzip:gzipSync(body).length,type:file.endsWith('.css')?'css':'js'};
});
const css=initial.filter(x=>x.type==='css');
const js=initial.filter(x=>x.type==='js');
const cssGzip=css.reduce((n,x)=>n+x.gzip,0);
const jsGzip=js.reduce((n,x)=>n+x.gzip,0);
const allCss=readdirSync(join(dist,'assets')).filter(x=>x.endsWith('.css'));

console.log('Initial production assets:');
for(const item of initial)console.log(`  ${item.file}: ${kb(item.raw)} kB raw / ${kb(item.gzip)} kB gzip`);
console.log(`Initial CSS total: ${kb(cssGzip)} kB gzip across ${css.length} file(s)`);
console.log(`Initial JS total: ${kb(jsGzip)} kB gzip across ${js.length} file(s)`);
console.log(`Route CSS chunks emitted: ${allCss.length}`);

const failures=[];
if(cssGzip>30*1024)failures.push(`initial CSS ${kb(cssGzip)} kB gzip exceeds 30 kB`);
if(jsGzip>150*1024)failures.push(`initial JS ${kb(jsGzip)} kB gzip exceeds 150 kB`);
if(allCss.length<4)failures.push('route CSS splitting regressed: expected at least 4 CSS chunks');

if(failures.length){
  console.error('\nPerformance budget failed:');
  failures.forEach(x=>console.error(`- ${x}`));
  process.exit(1);
}
console.log('Performance budget passed.');
