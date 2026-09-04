'use strict';
const {sandbox,T}=require('./harness');
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const src=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const lines=[];
function addDict(d,label){
  for(const k in d){
    const v=d[k];
    if(Array.isArray(v))for(const s of v)lines.push({label,k,text:s});
    else if(v&&typeof v==='object')for(const k2 in v){const vv=v[k2];if(Array.isArray(vv))for(const s of vv)lines.push({label:(k+'/'+k2),text:s});}
  }
}
addDict(T.ECHO_LINES,'ECHO');
for(const pid in T.PERSONALITIES){const P=T.PERSONALITIES[pid];if(P&&P.lines)addDict({x:P.lines},'PERS/'+pid);}
// dynamic pools
const dyn={};
// Relationship
const relSrc=src.match(/const REL_LINES=\{([\s\S]*?)\n\};/);if(relSrc)null;
if(/const REL_LINES=/.test(src)){
  // extract literal strings from REL_LINES block
  const block=src.slice(src.indexOf('const REL_LINES={'),src.indexOf('\n};',src.indexOf('const REL_LINES={'))); 
  const vals=[...block.matchAll(/'([^']*)'/g)].map(m=>m[1]);
  for(const v of vals)lines.push({label:'REL',k:'rel',text:v});
}
const relPersSrc=src.match(/const PERS_REL_LINES=\{([\s\S]*?)\n\};/);if(relPersSrc){const block=relPersSrc[0];const vals=[...block.matchAll(/'([^']*)'/g)].map(m=>m[1]);for(const v of vals)lines.push({label:'PERS_REL',k:'persrel',text:v});}
const relGenSrc=src.match(/const REL_GENERIC_LINES=\{([\s\S]*?)\n\};/);if(relGenSrc){const block=relGenSrc[0];const vals=[...block.matchAll(/'([^']*)'/g)].map(m=>m[1]);for(const v of vals)lines.push({label:'REL_GENERIC',k:'relgen',text:v});}
if(typeof T.FRACTURE_RESO_LINES!=='undefined')addDict(T.FRACTURE_RESO_LINES,'FRAC_RESO');
if(typeof T.FRACTURE_B4_ECHO_LINES!=='undefined')addDict(T.FRACTURE_B4_ECHO_LINES,'FRAC_B4');
// EQ reaction lines (inside function reactToEchoEq) — extract its literal strings
const eqIdx=src.indexOf('const LINES={',src.indexOf('function reactToEchoEq')>=0?src.indexOf('function reactToEchoEq'):0);
if(eqIdx>=0){const end=src.indexOf('\n  };',eqIdx);const block=src.slice(eqIdx,end);const vals=[...block.matchAll(/'([^']*)'/g)].map(m=>m[1]);for(const v of vals)lines.push({label:'EQREAC',k:'eq',text:v});}
// microfone x_duplo dict and mico
const evSrc=src.match(/const L=\{[^;]*aggressive:\"Quando achar a cópia[^}]*\};/);if(evSrc){const vals=[...evSrc[0].matchAll(/:\s*'([^']*)'/g)].map(m=>m[1]);for(const v of vals)lines.push({label:'EV_DUPLO',k:'duplo',text:v});}
const mico=[ '"Tem gente nessa frequência."','"Não responda. Ouça duas vezes."','"Frequência fria. Ignora."'];
for(const v of mico)lines.push({label:'MICRO',k:'micro',text:v});
// EQ generic fallback by cat
const eqGen=['SINCRONIA COM ','ISTO NÃO É ','TECNOLOGIA ','RGISTRO ','MEMÓRIA SELADA RECONHECIDA','ESTA RELÍQUIA LEMBRA DE MIM','...ISSO MUDA O QUE EU SOU'];
for(const v of eqGen)lines.push({label:'EQ_GEN',k:'eqgen',text:v});
// deterministic generic
const eqMask=['EU CONHEÇO ESTE ROSTO.','A MÁSCARA SORRI PRIMEIRO.','ISSO TAMBÉM SOU EU.'];
for(const v of eqMask)lines.push({label:'EQ_MASK',k:'eqmask',text:v});
// role/combat hardcoded
const fixed=['COBERTURA ATIVA.','DISTORÇÃO LIBERADA.'];
for(const v of fixed)lines.push({label:'ROLE',k:'role',text:v});

const texts=lines.map(l=>l.text);
const lens=texts.map(t=>t.length);
const sorted=[...lens].sort((a,b)=>a-b);
const mean=lens.reduce((a,b)=>a+b,0)/lens.length;
const median=sorted[Math.floor(sorted.length*.5)];
const p90=sorted[Math.floor(sorted.length*.9)];
const max=sorted[sorted.length-1];
const words=texts.map(t=>t.split(/\s+/).filter(Boolean).length);
const wmean=words.reduce((a,b)=>a+b,0)/words.length;
const longest=texts.sort((a,b)=>b.length-a.length).slice(0,15);
console.log('TOTAL lines =',texts.length);
console.log('mean chars =',mean.toFixed(1),'median =',median,'p90 =',p90,'max =',max);
console.log('mean words =',wmean.toFixed(1));
const wMax=Math.max(...words),wP90=[...words].sort((a,b)=>a-b)[Math.floor(words.length*.9)],wMean=wmean;
console.log('wpm needed at max =',(wMax/(1.1/60)).toFixed(0));
console.log('wpm needed at p90 words =',(wP90/(1.1/60)).toFixed(0));
console.log('wpm needed at mean =',(wMean/(1.1/60)).toFixed(0));
console.log('\nLONGEST: ');
longest.forEach(t=>console.log('  ['+t.length+'] '+t));
console.log('\nBY SOURCE:');
const byS={};lines.forEach(l=>{if(!byS[l.label])byS[l.label]={n:0,sum:0,max:0};byS[l.label].n++;byS[l.label].sum+=l.text.length;byS[l.label].max=Math.max(byS[l.label].max,l.text.length);});
for(const k in byS)console.log(k+': n='+byS[k].n+' avg='+(byS[k].sum/byS[k].n).toFixed(1)+' max='+byS[k].max);
