'use strict';
/* =====================================================================
   TESTES — FORMATADORES CENTRAIS DE NÚMERO (ECHO · PR 11.5)
   ---------------------------------------------------------------------
   §6–§10: uma única fonte de formatação para HUD, TAB, Loja, Pausa,
   Codex e tooltips. Casos do enunciado + edge cases (0, negativos,
   -0, não-finitos, arredondamento de float, percentual >100%).
   Executa o script REAL de index.html em um sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/formatters.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

/* expõe os símbolos top-level */
src+=';globalThis.__t={fmtNum,fmtStat,fmtPct,fmtCompact,fmtTime,fmtSec,'+
  'fmtRate,fmtMult,fmtSigned,MINUS};';

/* ---------------- DOM mínimo (idêntico aos outros harnesses) ---------------- */
function makeStyle(){
  const store={};
  return new Proxy(store,{get(t,k){return k in t?t[k]:'';},set(t,k,v){t[k]=String(v);return true;}});
}
function ctx2d(){
  const grad={addColorStop(){}};
  const numProps=new Set(['globalAlpha','lineWidth','shadowBlur','font','fillStyle',
    'strokeStyle','lineCap','textAlign','imageSmoothingEnabled']);
  return new Proxy({},{get(t,k){
    if(k==='canvas')return{width:0,height:0};
    if(k==='measureText')return()=>({width:0});
    if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;
    if(numProps.has(k))return 1;
    return()=>{};
  },set(){return true;}});
}
function makeEl(id){
  const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,
    _cls:new Set(),isConnected:true,offsetWidth:0,offsetHeight:0,
    textContent:'',innerHTML:'',className:'',title:'',style:makeStyle()};
  el.classList={
    add:(...c)=>c.forEach(x=>el._cls.add(x)),
    remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
    contains:c=>el._cls.has(c),
    toggle:(c,f)=>{if(f===undefined){if(el._cls.has(c)){el._cls.delete(c);return false;}
      el._cls.add(c);return true;}
      if(f)el._cls.add(c);else el._cls.delete(c);return !!f;}
  };
  el.appendChild=c=>{el.children.push(c);return c;};
  el.remove=()=>{};el.addEventListener=()=>{};el.removeEventListener=()=>{};
  el.querySelector=()=>null;el.querySelectorAll=()=>[];
  el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};
  el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];
  el.getContext=()=>ctx2d();
  return el;
}
const elements=new Map();
const document={
  hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
  fullscreenElement:null,webkitFullscreenElement:null,
  createElement:()=>makeEl(''),
  getElementById:id=>{if(!elements.has(id))elements.set(id,makeEl(id));
    return elements.get(id);},
  querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},
  hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()
};
const window={
  innerWidth:1280,innerHeight:720,devicePixelRatio:1,
  screen:{availWidth:1280,availHeight:720},
  addEventListener:()=>{},removeEventListener:()=>{},
  matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),
  AudioContext:undefined,webkitAudioContext:undefined,
  open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined
};
const store=new Map();
const sandbox={
  window,document,console,Math,JSON,Date,Array,Object,Set,Map,Number,String,
  Boolean,Promise,RegExp,Error,Proxy,Reflect,Symbol,parseInt,parseFloat,isNaN,
  navigator:{getGamepads:()=>[],userAgent:'node'},
  localStorage:{getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>{store.set(k,String(v));},
    removeItem:k=>{store.delete(k);}},
  performance:{now:()=>Date.now()},
  requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  __t:null
};
sandbox.globalThis=sandbox;
sandbox.window.requestAnimationFrame=sandbox.requestAnimationFrame;
vm.createContext(sandbox);
vm.runInContext(src,sandbox,{filename:'index.html'});
const T=sandbox.__t;

let passed=0,failed=0;
function test(name,fn){
  try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+'\n    '+e.message);}
}

console.log('\nECHO — Formatadores Centrais (PR 11.5)');
console.log('---------------------------------------------');

/* 1. sintaxe */
test('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(src);
});

/* 2. casos do enunciado (§7) */
test('32.325325 → "32.3" (uma casa, sem zeros à direita)',()=>{
  assert.strictEqual(T.fmtNum(32.325325,1),'32.3');
  assert.strictEqual(T.fmtStat(32.325325),'32.3');
});
test('17 → "17" (inteiro permanece inteiro)',()=>{
  assert.strictEqual(T.fmtNum(17),'17');
  assert.strictEqual(T.fmtStat(17),'17');
});
test('17.000000 (float com resíduo) → "17"',()=>{
  assert.strictEqual(T.fmtNum(17.0000001,1),'17');
  assert.strictEqual(T.fmtNum(16.9999999,1),'17');
});
test('0.325328 como fração → "32.5%"',()=>{
  assert.strictEqual(T.fmtPct(0.325328),'32.5%');
});
test('1 → "100%"',()=>{
  assert.strictEqual(T.fmtPct(1),'100%');
});
test('1200 → "1.2K" · 15400 → "15.4K" · 1200000 → "1.2M"',()=>{
  assert.strictEqual(T.fmtCompact(1200),'1.2K');
  assert.strictEqual(T.fmtCompact(15400),'15.4K');
  assert.strictEqual(T.fmtCompact(1200000),'1.2M');
});
test('1.275 segundos → "1.3s" (§7)',()=>{
  assert.strictEqual(T.fmtSec(1.275),'1.3s');
});
test('31 → "31s" e 0.5 → "0.5s" (cooldown limpo)',()=>{
  assert.strictEqual(T.fmtSec(31),'31s');
  assert.strictEqual(T.fmtSec(0.5),'0.5s');
});
test('fmtTime(83) → "01:23" e fmtTime(0) → "00:00"',()=>{
  assert.strictEqual(T.fmtTime(83),'01:23');
  assert.strictEqual(T.fmtTime(0),'00:00');
  assert.strictEqual(T.fmtTime(600),'10:00');
});

/* 3. regras de precisão contextual (§8) */
test('HP inteiro: fmtNum(95,0) → "95" · maxHp fracionário → 1 casa se preciso',()=>{
  assert.strictEqual(T.fmtNum(95,0),'95');
  assert.strictEqual(T.fmtNum(110.5,1),'110.5');
  assert.strictEqual(T.fmtNum(101.25,1),'101.3');
});
test('Fire Rate: fmtRate(3.2) → "3.2/s"',()=>{
  assert.strictEqual(T.fmtRate(3.2),'3.2/s');
  assert.strictEqual(T.fmtRate(1/0.16),'6.3/s');
});
test('Crit: fmtPct(0.275) → "27.5%"',()=>{
  assert.strictEqual(T.fmtPct(0.275),'27.5%');
});
test('Dano crítico multiplicador: fmtMult(1.8) → "×1.8" (zeros trimmed)',()=>{
  assert.strictEqual(T.fmtMult(1.8),'×1.8');
  assert.strictEqual(T.fmtMult(0.85),'×0.85');
});

/* 4. edge cases */
test('0 → "0" e -0 nunca vira "-0"',()=>{
  assert.strictEqual(T.fmtNum(0),'0');
  assert.strictEqual(T.fmtNum(-0),'0');
  assert.strictEqual(T.fmtPct(0),'0%');
});
test('não-finitos e null → "—" (nunca "NaN"/"undefined"/"Infinity")',()=>{
  for(const v of [NaN,Infinity,-Infinity,null,undefined]){
    assert.strictEqual(T.fmtNum(v),'—',String(v));
    assert.strictEqual(T.fmtPct(v),'—');
    assert.strictEqual(T.fmtCompact(v),'—');
    assert.strictEqual(T.fmtSec(v),'—');
    assert.strictEqual(T.fmtRate(v),'—');
    assert.strictEqual(T.fmtMult(v),'—');
  }
});
test('negativos: fmtNum(-3.25,1) → "-3.3" (hífen simples no número cru)',()=>{
  assert.strictEqual(T.fmtNum(-3.25,1),'-3.3');
  assert.strictEqual(T.fmtCompact(-15400),'−15.4K');
});
test('fmtSigned: +30% / −15% / ±0% (sinal tipográfico)',()=>{
  assert.strictEqual(T.fmtSigned(0.30),'+30%');
  assert.strictEqual(T.fmtSigned(-0.15),'−15%');
  assert.strictEqual(T.fmtSigned(0),'±0%');
  assert.strictEqual(T.fmtSigned(0.0000001),'±0%');
});
test('fmtCompact não abrevia valores pequenos onde o exato importa (§9)',()=>{
  assert.strictEqual(T.fmtCompact(120),'120');
  assert.strictEqual(T.fmtCompact(999),'999');
  assert.strictEqual(T.fmtCompact(1000),'1K');
  assert.strictEqual(T.fmtCompact(9999),'10K');
});
test('precisão customizada: fmtPct(0.325,0) → "33%" e fmtPct(0.325,2) → "32.5%"',()=>{
  assert.strictEqual(T.fmtPct(0.325,0),'33%');
  assert.strictEqual(T.fmtPct(0.325,1),'32.5%');
  assert.strictEqual(T.fmtPct(0.325328,2),'32.53%');
});
test('percentual acima de 100% e frações grandes funcionam',()=>{
  assert.strictEqual(T.fmtPct(1.45),'145%');
  assert.strictEqual(T.fmtMult(2.375),'×2.38');
});

/* 5. consistência estrutural (§10) — mesmos formatadores usados na UI */
test('index.html: tooltips/HUD/Codex usam fmt* (sem toFixed espalhado na UI)',()=>{
  const body=html;
  /* nenhuma chamada player-facing nova de toFixed fora de DEV/console */
  const uiZones=['function weaponTipHTML','function charTipHTML',
    'function itemTipHTML','function updateHUD','function moralStatusLine'];
  for(const z of uiZones){
    const i=body.indexOf(z);
    assert(i>=0,'trecho não encontrado: '+z);
    const chunk=body.slice(i,i+2600);
    assert(chunk.indexOf('.toFixed(')<0,'toFixed em zona de UI: '+z);
  }
});
test('index.html: nenhum Math.round cru em números de dano (usa fmtStat)',()=>{
  assert(html.indexOf("floatText(e.x,e.y-e.r-8,'✦ '+Math.round(d)")<0,
    'damage number antigo (Math.round) ainda presente');
  assert(html.indexOf('dmgNumShow(e,d,true)')>=0,'crítico deve usar dmgNumShow');
  assert(html.indexOf('dmgNumShow(e,d,false)')>=0,'acerto direto deve usar dmgNumShow');
});

console.log('---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('\nFALHAS DETECTADAS');process.exit(1);}
