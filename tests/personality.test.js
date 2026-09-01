'use strict';
/* =====================================================================
   TESTES — PR 8: Personalidade dos Ecos derivada da run de origem
   - classificação sintética (agressivo / cauteloso / equilibrado / curto)
   - determinismo absoluto (nenhum RNG na identidade)
   - normalização (run curta vs longa com proporção igual)
   - save: persistência, isolamento de slots, migração de Ecos antigos
   - Continue Run: métricas sobrevivem ao checkpoint
   - Roles / Dissonância / Ressonância / Equilíbrio inalterados
   - Diálogo: pools por personalidade, fallback e cooldown
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

src+=';globalThis.__t={'+
  'PERSONALITIES,PERS_ORDER,PERS_TRAITS,WEAPONS,ECHO_LINES,'+
  'ECHO_MUL,ECHO_RATE,ECHO_HP,ECHO_RANGE,ECHO_DMG_CAP,'+
  'runStReset,runStSnapshot,runStRestore,runStSample,'+
  'buildPersonalityMetrics,scorePersonalities,classifyPersonality,'+
  'deriveEchoPersonality,ensureEchoPersonality,'+
  'persLineFor,persTraitLabs,persSpacing,persBiasMul,persFindTarget,'+
  'makeEcho,echoReact,echoSpeak,echoRoleTick,trustTier,enterDissonance,'+
  'triggerResonance,updateEcho,nearestEnemy,smBuildCheckpoint,captureCheckpoint,'+
  'startRun,onPlayerDeath,saveEchoes,loadEchoes,activateSlot,smLoadRoot,'+
  'getState:()=>state,getRunSt:()=>runSt,'+
  'setKills:v=>{kills=v|0;},setRunTime:v=>{runTime=+v;},getRunTime:()=>runTime,'+
  'getEchoes:()=>echoes,setEchoes:a=>{echoes=a;},getEnemies:()=>enemies,'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getQ:()=>echoQueue,clearDevTaint:()=>{devTainted=false;},'+
  'getFtexts:()=>ftexts,root:()=>smRoot,'+
  'DEV_get:()=>DEV,DEV_on:()=>{DEV_MODE=true;},DEV_off:()=>{DEV_MODE=false;},'+
  'getSpeakCd:()=>_echoSpeakCd,setSpeakCd:v=>{_echoSpeakCd=v;},'+
  'getRecorder:()=>recorder};';

/* ---------------- DOM mínimo ---------------- */
function makeStyle(){
  const store={};
  return new Proxy(store,{
    get(t,k){return k in t?t[k]:'';},
    set(t,k,v){t[k]=String(v);return true;}
  });
}
function ctx2d(){
  const grad={addColorStop(){}};
  const numProps=new Set(['globalAlpha','lineWidth','shadowBlur','font','fillStyle',
    'strokeStyle','lineCap','textAlign','imageSmoothingEnabled']);
  return new Proxy({},{get(t,k){
    if(k==='canvas')return{width:0,height:0};
    if(k==='measureText')return()=>({width:0});
    if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')
      return()=>grad;
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
const localStorage={_d:{},getItem(k){return this._d[k]||null;},
  setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
const navigator={getGamepads:()=>[]};

/* Math com RNG controlável — usado para PROVAR que a classificação não
   depende de Math.random (se dependesse, trocar o rng mudaria o resultado). */
const MathF=Object.create(Math);
MathF._rng=null;
MathF.random=function(){return MathF._rng?MathF._rng():Math.random();};

const sandbox={console,Math:MathF,Date,parseInt,parseFloat,isNaN,setTimeout,clearTimeout,
  requestAnimationFrame:()=>0,
  Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
  Promise,Proxy,Reflect,JSON,Symbol,
  document,window,localStorage,navigator,
  performance:{now:()=>Date.now()}
};
const ctx=vm.createContext(sandbox);
vm.runInContext(src,ctx,{timeout:15000});
const t=vm.runInContext('__t',ctx);
MathF._rng=()=>0.4242;   // rng fixo p/ fluxo; classificação deve ignorá-lo

/* ---------------- helpers ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+e.message);}
}
function trail(len,w,act){
  const tr=[];
  for(let i=0;i<len;i++)tr.push([i*.25,100+i,120-i,act==null?(i%4===0?2:1):act,0,w||0]);
  return tr;
}
/* métricas sintéticas: st completo */
function stOf(o){
  const st={s:2400,mw:0,rw:2400,dsh:0,dt:0,dd:0,sh:0,hi:0,ms:0,mh:0,
    lo:0,cr:0,mv:0,fv:0,ctl:0,kw:0,sb:0,dS:2400*250,dN:2400};
  return Object.assign(st,o);
}
function record(o){
  const rd={v:2,dur:600,wave:8,level:5,items:[],upg:[],owned:[0,1],
    dmgMul:1,frMul:1,coins:0,moral:{comp:0,greed:0,viol:0},dom:'neutro',
    crit:0,critMul:1.8,pierce:0,aoeMul:1,rangeMul:1,projSpdMul:1,
    longRangeBonus:0,kills:0,mh:100,trail:trail(1200,0,null),...o};
  return rd;
}
function freshRun(){
  t.setPlayer(null);
  t.startRun();
  t.clearDevTaint();
}

console.log('\nECHO — PR 8 · Personalidade dos Ecos');
console.log('---------------------------------------------');

/* =====================================================================
   1. CLASSIFICAÇÃO (cenários sintéticos A–E)
   ===================================================================== */
ok('A · run close combat agressiva → AGRESSIVO',()=>{
  const rd=record({kills:300,dur:600,
    st:stOf({mw:2300,rw:100,lo:1800,cr:600,dt:120000,dd:150000,dsh:300,
      sh:500,hi:200,dS:120*1000,dN:1000,s:2400})});
  const ps=t.deriveEchoPersonality(rd);
  assert.strictEqual(ps.id,'aggressive');
  assert.ok(ps.c>=.5,'confidence alta, obtida '+ps.c);
});
ok('B · run de distância e controle → CAUTELOSO',()=>{
  const rd=record({kills:120,dur:900,
    st:stOf({mw:120,rw:3480,lo:0,cr:0,dt:300,dd:180000,dsh:60,
      sh:2000,hi:1700,ctl:900,dS:3800*2400,dN:2400,s:2400})});
  const ps=t.deriveEchoPersonality(rd);
  assert.strictEqual(ps.id,'cautious');
});
ok('C · run equilibrada (tudo neutro) → VERSÁTIL',()=>{
  const m={dur:300,mins:5,kills:10,legacy:false,shots:100,samples:600,dealt:1000,
    closeShare:.5,rangePref:.5,killRate:.5,takenRate:.5,lowHp:.5,critHp:.3,
    dashRate:.4,accKnown:true,acc:.5,ctlRate:.5,kite:.5,fireS:100,eff:.5,
    weakKill:.3,waveProg:.5,durNorm:.4,suff:.9,insufficient:false};
  const c=t.classifyPersonality(m);
  assert.strictEqual(c.id,'versatile','empate técnico deve virar versátil');
  assert.ok(c.scores.aggressive>=.49&&c.scores.cautious>=.49);
});
ok('D · run curta demais → FRAGMENTADO (nunca rotular 20s)',()=>{
  const rd=record({dur:10,kills:0,trail:trail(40,0,null),
    st:stOf({s:40,mw:40,rw:0,dt:0,dd:100,lo:0,cr:0,dS:100,dN:40})});
  const ps=t.deriveEchoPersonality(rd);
  assert.strictEqual(ps.id,'fragmented');
  assert.ok(ps.c<=.45);
});
ok('D2 · agressividade sem volume ainda é FRAGMENTADO',()=>{
  const rd=record({dur:30,kills:1,trail:trail(120,0,null),
    st:stOf({s:120,mw:118,rw:2,dt:400,dd:50,lo:60,cr:20,dsh:30,
      sh:4,hi:1,dS:130*120,dN:120})});
  const ps=t.deriveEchoPersonality(rd);
  assert.strictEqual(ps.id,'fragmented');
});
ok('E · empate exato → VERSÁTIL (regra documentada, sem RNG)',()=>{
  const base={dur:600,mins:10,kills:200,legacy:false,shots:2000,samples:2400,
    dealt:100000,lowHp:.5,critHp:.5,dashRate:.35,acc:.5,accKnown:true,
    ctlRate:.5,kite:.5,fireS:200,eff:.5,weakKill:.1,suff:.9,insufficient:false,
    waveProg:.5,durNorm:.5,takenRate:.5};
  const m1=Object.assign({},base,{closeShare:.9,rangePref:0,killRate:1});
  const m2=Object.assign({},base,{closeShare:0,rangePref:1,killRate:1});
  const a=t.classifyPersonality(m1),b=t.classifyPersonality(m2);
  assert.strictEqual(a.id,'aggressive');
  assert.strictEqual(b.id,'cautious');
  const mTie=Object.assign({},base,{closeShare:.5,rangePref:.5,killRate:.5});
  assert.strictEqual(t.classifyPersonality(mTie).id,'versatile');
});
ok('IMPULSIVO · dash+troca+edge dominam',()=>{
  const rd=record({kills:220,dur:600,
    st:stOf({mw:1200,rw:1200,lo:600,cr:600,dt:110000,dd:60000,dsh:1500,
      sh:1000,hi:420,dS:200*2400,dN:2400,s:2400})});
  const ps=t.deriveEchoPersonality(rd);
  assert.strictEqual(ps.id,'impulsive');
});
ok('PRECISO · precisão+kiting+eficiência',()=>{
  const rd=record({kills:150,dur:600,
    st:stOf({mw:60,rw:2340,lo:0,cr:0,dt:200,dd:140000,dsh:240,
      sh:1200,hi:1140,ctl:0,dS:240*2400,dN:2400,mv:900,fv:60,s:2400})});
  const ps=t.deriveEchoPersonality(rd);
  assert.strictEqual(ps.id,'precise');
});
ok('RESILIENTE · onda alta, sofrência contínua',()=>{
  const rd=record({kills:60,dur:1500,wave:19,
    st:stOf({mw:600,rw:5400,lo:4000,cr:1500,dt:30000,dd:40000,dsh:400,
      sh:3000,hi:1500,ctl:300,dS:280*7200,dN:7200,s:7200})});
  const ps=t.deriveEchoPersonality(rd);
  assert.strictEqual(ps.id,'resilient');
});
ok('OPORTUNISTA · abates em alvos fragilizados',()=>{
  const rd=record({kills:200,dur:600,
    st:stOf({mw:900,rw:1500,lo:200,cr:0,dt:4000,dd:90000,dsh:100,
      sh:1600,hi:1200,ctl:900,kw:160,dS:250*2400,dN:2400,s:2400})});
  const ps=t.deriveEchoPersonality(rd);
  assert.strictEqual(ps.id,'opportunist');
});

/* =====================================================================
   2. DETERMINISMO
   ===================================================================== */
ok('mesmos dados · 100 execuções → mesma personalidade',()=>{
  const rd=record({kills:220,dur:600,
    st:stOf({mw:1400,rw:1000,lo:900,cr:300,dt:60000,dd:120000,dsh:700,
      sh:1500,hi:1000,ctl:300,kw:60,dS:200*2400,dN:2400,s:2400})});
  const first=JSON.stringify(t.deriveEchoPersonality(rd));
  for(let i=0;i<99;i++)
    assert.strictEqual(JSON.stringify(t.deriveEchoPersonality(rd)),first,
      'divergência na iteração '+i);
});
ok('Math.random NÃO afeta a identidade (rng=0.0001 vs 0.9999)',()=>{
  const rd=record({kills:220,dur:600,
    st:stOf({mw:1400,rw:1000,lo:900,cr:300,dt:60000,dd:120000,dsh:700,
      sh:1500,hi:1000,ctl:300,kw:60,dS:200*2400,dN:2400,s:2400})});
  MathF._rng=()=>0.0001;
  const a=JSON.stringify(t.deriveEchoPersonality(rd));
  MathF._rng=()=>0.9999;
  const b=JSON.stringify(t.deriveEchoPersonality(rd));
  MathF._rng=()=>0.4242;
  assert.strictEqual(a,b);
});
ok('pipeline de classificação é puro (sem Math.random/rand no trecho)',()=>{
  const a=src.indexOf('function buildPersonalityMetrics');
  const b=src.indexOf('integração comportamental (LEVE)');
  assert.ok(a>0&&b>a,'marcadores não encontrados');
  const seg=src.slice(a,b);
  assert.ok(!/Math\.random|\brand\(|randi\(/.test(seg),
    'RNG vazou na classificação');
});

/* =====================================================================
   3. NORMALIZAÇÃO (run 2min vs 20min com o MESMO estilo)
   ===================================================================== */
ok('run curta e longa com proporções iguais → mesma classificação',()=>{
  const short=record({kills:40,dur:120,
    st:stOf({s:480,mw:460,rw:20,lo:360,cr:120,dt:24000,dd:30000,dsh:60,
      sh:100,hi:40,dS:120*480,dN:480})});
  const long=record({kills:400,dur:1200,
    st:stOf({s:4800,mw:4600,rw:200,lo:3600,cr:1200,dt:240000,dd:300000,dsh:600,
      sh:1000,hi:400,dS:120*4800,dN:4800})});
  const a=t.deriveEchoPersonality(short),b=t.deriveEchoPersonality(long);
  assert.strictEqual(a.id,b.id);
  assert.ok(a.id!=='fragmented','run de 2min proporcional deve classificar');
  assert.ok(b.s.aggressive>.7,'agressividade proporcional preservada');
});
ok('100 kills NÃO é agressivo por si só — o que vale é a proporção',()=>{
  // run de 30min com 100 kills mas comportamento frio e distante
  const rd=record({kills:100,dur:1800,
    st:stOf({s:7200,mw:200,rw:7000,lo:100,cr:0,dt:800,dd:200000,dsh:100,
      sh:6000,hi:5400,dS:420*7200,dN:7200})});
  const ps=t.deriveEchoPersonality(rd);
  assert.notStrictEqual(ps.id,'aggressive');
});

/* =====================================================================
   4. TRAÇOS SECUNDÁRIOS
   ===================================================================== */
ok('traços máx. 2, derivados e com rótulos conhecidos',()=>{
  const rd=record({kills:400,dur:600,
    st:stOf({mw:2000,rw:400,lo:600,cr:300,dt:100000,dd:120000,dsh:1300,
      sh:400,hi:150,dS:150*2400,dN:2400,s:2400})});
  const ps=t.deriveEchoPersonality(rd);
  assert.ok(Array.isArray(ps.tr)&&ps.tr.length<=2);
  for(const tr of ps.tr)
    assert.ok(t.PERS_TRAITS[tr],'traço desconhecido: '+tr);
});
ok('run 100% corpo a corpo com carnificina → traço brawler e/ou butcher',()=>{
  const rd=record({kills:600,dur:600,
    st:stOf({mw:2400,rw:0,lo:600,cr:120,dt:90000,dd:200000,dsh:200,
      sh:0,hi:0,ms:3000,mh:5000,dS:90*2400,dN:2400,s:2400})});
  const ps=t.deriveEchoPersonality(rd);
  assert.ok(ps.tr.indexOf('brawler')>=0||ps.tr.indexOf('butcher')>=0,
    'traits='+JSON.stringify(ps.tr));
});

/* =====================================================================
   5. SAVE SCHEMA + FLUXO DE MORTE
   ===================================================================== */
ok('morte → runData.ps calculado UMA vez e Echo enfileirado',()=>{
  freshRun();
  const st=t.getRunSt();
  Object.assign(st,stOf({mw:2300,rw:100,lo:1800,cr:600,dt:120000,dd:150000,
    dsh:300,sh:500,hi:200,dS:120*1000,dN:1000,s:2400}));
  t.setKills(300);t.setRunTime(600);
  const rec=t.getRecorder();
  for(let i=0;i<10;i++)rec.push([i*.25,100+i,120,1,0,3]);
  t.onPlayerDeath();
  const q=t.getQ();
  assert.strictEqual(q.length>=1,true);
  const ps=q[0].ps;
  assert.ok(ps&&t.PERSONALITIES[ps.id],'ps presente e válida: '+JSON.stringify(ps));
  assert.strictEqual(ps.id,'aggressive');
  assert.strictEqual(q[0].st.s,2400);
  assert.strictEqual(q[0].kills,300);
});
ok('ps sobrevive a save→reload com valores idênticos',()=>{
  assert.strictEqual(t.saveEchoes(),true);
  const saved=JSON.parse(localStorage.getItem('echoSave.v3'));
  const rec=saved.slots[1].echoes[0];
  assert.ok(rec.ps&&rec.st,'ps/st gravados no slot');
  const loaded=t.loadEchoes();
  // objetos atravessam o realm do vm → comparação estrutural por JSON
  assert.strictEqual(JSON.stringify(loaded[0].ps),JSON.stringify(rec.ps));
  assert.strictEqual(JSON.stringify(loaded[0].st),JSON.stringify(rec.st));
});
ok('save compacto: ps tem só id/tr/c/s/v',()=>{
  const saved=JSON.parse(localStorage.getItem('echoSave.v3'));
  const ps=saved.slots[1].echoes[0].ps;
  assert.deepStrictEqual(Object.keys(ps).sort(),['c','id','s','tr','v'].sort());
  assert.ok(JSON.stringify(ps).length<220,'ps pequeno: '+JSON.stringify(ps).length);
});
ok('makeEcho nasce com .pers resolvida e estável',()=>{
  const rd={v:2,dur:60,trail:trail(300,3,1),items:[],upg:[],owned:[0,1],
    dom:'neutro',moral:{comp:0,greed:0,viol:0},kills:10,mh:100,
    st:stOf({}),dmgMul:1,frMul:1,wave:3,level:2,
    ps:{id:'cautious',tr:['marksman'],c:.7,s:{},v:1}};
  const e=t.makeEcho(rd,1);
  assert.ok(e.pers&&e.pers.id==='cautious');
  assert.ok(e.ps&&e.ps.c===.7);
});

/* =====================================================================
   6. MIGRAÇÃO DE ECOS ANTIGOS (sem quebrar, sem duplicar)
   ===================================================================== */
ok('Echo antigo sem .ps → migração deriva e NÃO regrava o save',()=>{
  const legacy={v:2,dur:300,wave:9,level:4,trail:trail(600,0,1),
    dmgMul:1,frMul:1,crit:0,critMul:1.8,pierce:0,aoeMul:1,rangeMul:1,
    projSpdMul:1,longRangeBonus:0,coins:0,items:[],upg:[],owned:[0,1],
    moral:{comp:0,greed:0,viol:0},dom:'neutro'};
  const root=JSON.parse(localStorage.getItem('echoSave.v3'));
  root.slots[2].echoes=[JSON.parse(JSON.stringify(legacy))];
  localStorage.setItem('echoSave.v3',JSON.stringify(root));
  const before=localStorage.getItem('echoSave.v3');
  t.smLoadRoot();
  t.activateSlot(2);
  const q=t.getQ();
  assert.strictEqual(q.length,1,'número de Ecos preservado');
  assert.ok(q[0].ps&&t.PERSONALITIES[q[0].ps.id],'migração produziu .ps');
  assert.ok(q[0].ps.c<=.4,'confiança limitada em dados legados: '+q[0].ps.c);
  assert.ok(!root.slots[2].echoes[0].ps||true);
  // bucket salvo: a migração é só em memória (até o próximo fluxo normal)
  const now=JSON.parse(localStorage.getItem('echoSave.v3'));
  assert.ok(!now.slots[2].echoes[0].ps,'registro salvo permanece sem .ps');
  void before;
});
ok('Echo legado com trail curta → FRAGMENTADO (nunca apaga/duplica)',()=>{
  const legacy={v:2,dur:25,wave:1,level:1,trail:trail(50,1,1),
    dmgMul:1,frMul:1,crit:0,critMul:1.8,pierce:0,aoeMul:1,rangeMul:1,
    projSpdMul:1,longRangeBonus:0,coins:0,items:[],upg:[],owned:[0,1],
    moral:{comp:0,greed:0,viol:0},dom:'neutro'};
  const root=JSON.parse(localStorage.getItem('echoSave.v3'));
  root.slots[3].echoes=[legacy];
  localStorage.setItem('echoSave.v3',JSON.stringify(root));
  t.smLoadRoot();
  t.activateSlot(3);
  const q=t.getQ();
  assert.strictEqual(q.length,1);
  assert.strictEqual(q[0].ps.id,'fragmented');
});
ok('trust do Echo não depende nem muda por personalidade',()=>{
  const base={dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],
    dom:'neutro',moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,
    wave:2,level:1};
  const a=t.makeEcho(Object.assign({},base,{ps:{id:'aggressive',tr:[],c:.9,s:{},v:1}}),1);
  const b=t.makeEcho(base,1);
  const c=t.makeEcho(Object.assign({},base,{ps:{id:'precise',tr:[],c:.9,s:{},v:1}}),2);
  const d=t.makeEcho(base,2);
  assert.strictEqual(a.trust,b.trust);
  assert.strictEqual(c.trust,d.trust);
});

/* =====================================================================
   7. SAVE SLOTS (PR 7.5 preservado)
   ===================================================================== */
ok('personalidade é do slot — Save 2 nunca vê o Eco do Save 1',()=>{
  t.activateSlot(1);
  assert.strictEqual(t.getQ().length,1,'slot 1 tem o Echo agressivo');
  assert.strictEqual(t.getQ()[0].ps.id,'aggressive');
  t.activateSlot(3);
  assert.strictEqual(t.getQ().length,1,'slot 3 tem só o legado fragmentado');
  assert.strictEqual(t.getQ()[0].ps.id,'fragmented');
  t.activateSlot(2);
  assert.strictEqual(t.getQ()[0].ps.c<=.4,true);
  t.activateSlot(1);
  assert.strictEqual(t.getQ()[0].ps.id,'aggressive','volta igual');
});

/* =====================================================================
   8. CONTINUE RUN — métricas sobrevivem ao checkpoint
   ===================================================================== */
ok('checkpoint inclui st e restore repara o que resetRunWorld zerou',()=>{
  freshRun();
  const st=t.getRunSt();
  Object.assign(st,stOf({s:800,mw:700,rw:100,dt:9000,dd:12000,dsh:120,
    sh:300,hi:210,dS:160*800,dN:800,lo:200,cr:40}));
  t.setRunTime(200);t.setKills(60);
  const cp=t.smBuildCheckpoint('teste',4);
  assert.ok(cp.st&&cp.st.s===800,'checkpoint gravou st');
  assert.strictEqual(cp.st.mw,700);
  // resume: startRun zera; restore devolve
  t.startRun();
  assert.strictEqual(t.getRunSt().s,0,'run nova começa zerada (Nova Run)');
  t.runStRestore(cp.st);
  assert.strictEqual(t.getRunSt().s,800,'antes do checkpoint volta');
  // depois do resume a run continua somando
  const st2=t.getRunSt();
  st2.s+=400;st2.mw+=300;st2.dt+=4000;st2.dd+=5000;st2.lo+=100;
  t.setKills(100);t.setRunTime(300);
  const merged=t.runStSnapshot();
  const ps=t.deriveEchoPersonality({dur:300,kills:100,wave:6,mh:100,
    trail:trail(400,2,1),st:merged});
  assert.strictEqual(ps.id,'aggressive','ANTES+DEPOIS do checkpoint contam');
});
ok('captura/recuperação literais do fluxo: captureCheckpoint grava st',()=>{
  freshRun();
  t.getRunSt().dsh=42;
  assert.strictEqual(t.captureCheckpoint('fim',3),true);
  const saved=JSON.parse(localStorage.getItem('echoSave.v3'));
  assert.strictEqual(saved.slots[1].run.st.dsh,42);
});

/* =====================================================================
   9. ROLES + BALANCEAMENTO
   ===================================================================== */
ok('todas as personalidades × Guardião mantêm o papel intacto',()=>{
  freshRun();
  const ids=Object.keys(t.PERSONALITIES);
  for(const id of ids){
    const e=t.makeEcho({dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],
      dom:'neutro',moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,
      wave:2,level:1,ps:{id,tr:[],c:.8,s:{},v:1}},1);
    e.alive=true;e.hostile=false;e.trust=60;
    e.roleCd=0.001;
    t.echoRoleTick(e,0.001);
    assert.strictEqual(e.roleT,4.2,id+' · barreira ativa');
    assert.ok(Math.abs(e.roleCd-7.5)<1e-6,id+' · cooldown fixo');
    assert.ok(e.shieldPot>0,id+' · proteção concedida');
  }
});
ok('todas as personalidades × Disruptor mantêm cooldown base',()=>{
  for(const id of Object.keys(t.PERSONALITIES)){
    const e=t.makeEcho({dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],
      dom:'neutro',moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,
      wave:2,level:1,ps:{id,tr:[],c:.8,s:{},v:1}},2);
    e.alive=true;e.hostile=false;e.trust=60;
    e.roleCd=0.001;
    t.echoRoleTick(e,0.001);
    assert.ok(Math.abs(e.roleCd-9)<1e-6,id+' · cd disruptor fixo');
  }
});
ok('equivalência de balanceamento: dano/vida/cadência idênticos',()=>{
  const base={dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],
    dom:'neutro',moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1.3,frMul:1.2,
    wave:2,level:1,crit:.2,critMul:2,pierce:1,aoeMul:1,rangeMul:1,
    projSpdMul:1,longRangeBonus:.1};
  const a=t.makeEcho(base,1);
  const b=t.makeEcho(Object.assign({},base,{ps:{id:'aggressive',tr:[],c:.9,s:{},v:1}}),1);
  assert.strictEqual(a.mul,b.mul,'dano bruto não muda');
  assert.strictEqual(a.hp,b.hp);
  assert.strictEqual(a.crit,b.crit);
  assert.strictEqual(a.critMul,b.critMul);
  assert.strictEqual(a.shieldMax,b.shieldMax);
  assert.strictEqual(a.roleCd,b.roleCd);
  void a.aim;void b.aim;
});
ok('constantes de Eco não mudaram (PR 7.5 baseline)',()=>{
  assert.strictEqual(JSON.stringify(t.ECHO_MUL),'[0,0.34,0.24]');
  assert.strictEqual(JSON.stringify(t.ECHO_RATE),'[0,0.62,0.52]');
  assert.strictEqual(t.ECHO_DMG_CAP,14);
});
ok('tabela de personalidades não contém modificadores de stat',()=>{
  const forbidden=['dmg','damage','rate','interval','fireTimer','hp','shield'];
  for(const id in t.PERSONALITIES)
    for(const k of Object.keys(t.PERSONALITIES[id]))
      assert.ok(forbidden.indexOf(k)<0,id+'.'+k+' não deveria existir');
});

/* =====================================================================
   10. COMPORTAMENTO LEVE (spacing + alvo) — sem quebrar regras existentes
   ===================================================================== */
ok('spacing: órbita do agressivo é menor que a do cauteloso',()=>{
  const data={dur:0,trail:trail(4,0,0),items:[],upg:[],owned:[0,1],dom:'neutro',
    moral:{},kills:0,mh:100,st:stOf({}),dmgMul:1,frMul:1,wave:1,level:1};
  const ag=t.makeEcho(Object.assign({},data,{ps:{id:'aggressive',tr:[],c:.9,s:{},v:1}}),1);
  const ca=t.makeEcho(Object.assign({},data,{ps:{id:'cautious',tr:[],c:.9,s:{},v:1}}),1);
  assert.ok(t.persSpacing(ag)<1&&t.persSpacing(ca)>1);
});
ok('updateEcho em modo companheiro converge para a órbita com spacing',()=>{
  freshRun();
  const P=t.getPlayer();
  const data={dur:0.01,trail:trail(2,0,0),items:[],upg:[],owned:[0,1],dom:'neutro',
    moral:{},kills:0,mh:100,st:stOf({}),dmgMul:1,frMul:1,wave:1,level:1};
  const ag=t.makeEcho(Object.assign({},data,{ps:{id:'aggressive',tr:[],c:.9,s:{},v:1}}),1);
  const pl=t.makeEcho(data,1);
  ag.x=P.x+400;ag.y=P.y;pl.x=P.x+400;pl.y=P.y;
  t.setRunTime(5);   // além da duração gravada → modo companheiro (órbita)
  for(let i=0;i<400;i++){t.updateEcho(ag,.016);t.updateEcho(pl,.016);}
  const dAG=Math.hypot(ag.x-P.x,ag.y-P.y),dPL=Math.hypot(pl.x-P.x,pl.y-P.y);
  assert.ok(dAG<dPL-2,'agressivo mais perto: '+dAG.toFixed(1)+' < '+dPL.toFixed(1));
  assert.ok(dPL<160&&dAG<160,'nenhum fugiu da órbita');
});
ok('viés de alvo: OPORTUNISTA troca o mais próximo pelo mais ferido',()=>{
  freshRun();
  const P=t.getPlayer();
  t.getEnemies().length=0;
  t.getEnemies().push(
    {x:P.x+200,y:P.y,r:12,hp:500,maxHp:500,dead:false,spawnT:0},
    {x:P.x+240,y:P.y,r:12,hp:100,maxHp:500,dead:false,spawnT:0});
  const data={dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],dom:'neutro',
    moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,wave:2,level:1};
  const plain=t.makeEcho(data,1);plain.x=P.x;plain.y=P.y;
  const oppo=t.makeEcho(Object.assign({},data,{ps:{id:'opportunist',tr:[],c:.9,s:{},v:1}}),1);
  oppo.x=P.x;oppo.y=P.y;
  const a=t.persFindTarget(plain,360);
  const b=t.persFindTarget(oppo,360);
  assert.strictEqual(a.hp,500,'sem viés: o mais próximo');
  assert.strictEqual(b.hp,100,'oportunista: o ferido');
  t.getEnemies().length=0;
});
ok('viés limitado: multiplicador sempre em [0.55, 1.6]',()=>{
  const en={hp:1,maxHp:1000,tgtRef:t.getPlayer()};
  for(const bias of ['threat','close','space','thin','wounded']){
    for(const raw of [1,400*400,1e9]){
      const mul=t.persBiasMul(bias,en,raw);
      assert.ok(mul>=.55&&mul<=1.6,bias+' · '+mul);
    }
  }
});

/* =====================================================================
   11. DISSONÂNCIA / RESSONÂNCIA / TRUST — mecânica intocada
   ===================================================================== */
ok('Dissonância: entrada/saída/trust floor idênticos com ou sem personalidade',()=>{
  freshRun();
  const data={dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],dom:'neutro',
    moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,wave:2,level:1};
  const ag=t.makeEcho(Object.assign({},data,{ps:{id:'aggressive',tr:[],c:.9,s:{},v:1}}),1);
  const pl=t.makeEcho(data,1);
  ag.trust=0;pl.trust=0;
  t.enterDissonance(ag);t.enterDissonance(pl);
  assert.strictEqual(ag.hostile,true);
  assert.strictEqual(ag.hostileT,pl.hostileT,'hostilidade 12s é fixa');
  assert.strictEqual(ag.trust,pl.trust);
  // saída pelo caminho normal
  ag.hostileT=0.0001;pl.hostileT=0.0001;
  t.setEchoes([ag,pl]);
  t.updateEcho(ag,0.01);t.updateEcho(pl,0.01);
  assert.strictEqual(ag.trust,34,'trust floor 34 preservado');
  assert.strictEqual(pl.trust,34);
  assert.strictEqual(ag.hostile,false);
  t.setEchoes([]);
});
ok('Ressonância plena: +3 de trust invariante por personalidade',()=>{
  freshRun();
  const P=t.getPlayer();
  const fo={type:'chaser',x:P.x+80,y:P.y,r:12,hp:4000,maxHp:4000,dead:false,
    spawnT:0,phaseT:0,slowT:0,flashT:0,vx:0,vy:0,color:'#fff',st:null,
    resoCd:0,microCd:0,strafe:1,aim:0,dmg:5,spd:100,xp:5,touchCd:0};
  t.getEnemies().length=0;t.getEnemies().push(fo);
  const data={dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],dom:'neutro',
    moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,wave:2,level:1};
  const ag=t.makeEcho(Object.assign({},data,{ps:{id:'opportunist',tr:[],c:.9,s:{},v:1}}),1);
  const pl=t.makeEcho(data,1);
  ag.trust=60;pl.trust=60;
  t.triggerResonance(fo,ag,40);
  const afterAg=ag.trust;
  t.triggerResonance(fo,pl,40);
  const afterPl=pl.trust;
  assert.strictEqual(afterAg-60,afterPl-60,'recompensa simétrica (+3)');
  t.getEnemies().length=0;
});
ok('Ressonância/Micro: funções sem referência à personalidade',()=>{
  for(const fn of ['function triggerResonance','function updateResonance']){
    const a=src.indexOf(fn);assert.ok(a>0,fn);
    const b=src.indexOf('\nfunction',a+10);
    const seg=src.slice(a,b);
    assert.ok(!/pers|PERSONALIT/i.test(seg),fn+' não deve tocar personalidade');
  }
});

/* =====================================================================
   12. DIÁLOGOS
   ===================================================================== */
ok('todas as personalidades têm pools para os 5 eventos-chave',()=>{
  for(const id in t.PERSONALITIES){
    const P=t.PERSONALITIES[id];
    for(const ev of ['lowHp','shieldBreak','killStreak','resonance','miniboss'])
      assert.ok(Array.isArray(P.lines[ev])&&P.lines[ev].length>=2,
        id+' sem pool '+ev);
  }
});
ok('evento → pool correto da personalidade',()=>{
  const data={dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],dom:'neutro',
    moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,wave:2,level:1,
    ps:{id:'aggressive',tr:[],c:.9,s:{},v:1}};
  const e=t.makeEcho(data,1);
  MathF._rng=()=>0;
  const line=t.persLineFor(e,'lowHp');
  MathF._rng=()=>0.4242;
  assert.ok(t.PERSONALITIES.aggressive.lines.lowHp.indexOf(line)>=0);
});
ok('sem pool para o evento → fallback para o genérico',()=>{
  const data={dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],dom:'neutro',
    moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,wave:2,level:1,
    ps:{id:'precise',tr:[],c:.9,s:{},v:1}};
  const e=t.makeEcho(data,1);
  MathF._rng=()=>0;
  const line=t.persLineFor(e,'trustLow');    // sem pool precisa/trustLow
  MathF._rng=()=>0.4242;
  assert.strictEqual(line,null);
  assert.ok(t.ECHO_LINES.trustLow.length>0,'genérico continua existindo');
});
ok('echoReact usa a voz da personalidade e o cooldown global segura spam',()=>{
  freshRun();
  const data={dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],dom:'neutro',
    moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,wave:2,level:1,
    ps:{id:'aggressive',tr:[],c:.9,s:{},v:1}};
  const e=t.makeEcho(data,1);
  e.x=t.getPlayer().x;e.y=t.getPlayer().y;
  t.setEchoes([e]);
  t.getFtexts().length=0;
  t.setSpeakCd(0);
  MathF._rng=()=>0;                       // passa o gate de 35% e escolhe [0]
  t.echoReact('lowHp');
  assert.strictEqual(t.getFtexts().length,1,'uma fala por evento');
  const said=t.getFtexts()[t.getFtexts().length-1].txt;
  assert.ok(t.PERSONALITIES.aggressive.lines.lowHp.indexOf(said)>=0,'voz certa: '+said);
  t.echoReact('lowHp');t.echoReact('lowHp');   // cooldown imediato bloqueia
  assert.strictEqual(t.getFtexts().length,1,'sem spam: cooldown global respeitado');
  assert.ok(t.getSpeakCd()>=7.5,'cd aplicado: '+t.getSpeakCd());
  MathF._rng=()=>0.4242;
  t.setEchoes([]);
});

/* =====================================================================
   13. DEV MODE — INSPECTOR E NÃO-CONTAMINAÇÃO
   ===================================================================== */
ok('DEV.personalityPreview usa o pipeline real da run viva',()=>{
  t.DEV_on();
  freshRun();
  const st=t.getRunSt();
  Object.assign(st,stOf({mw:2300,rw:100,lo:1800,cr:600,dt:120000,dd:150000,
    dsh:300,sh:500,hi:200,dS:120*1000,dN:1000,s:2400}));
  t.setRunTime(600);t.setKills(300);
  const pv=t.DEV_get().personalityPreview();
  assert.strictEqual(pv.id,'aggressive');
  assert.ok(pv.scores&&pv.scores.aggressive>pv.scores.cautious);
  t.DEV_off();
});
ok('forçar personalidade via DEV não contamina o registro salvo',()=>{
  t.DEV_on();
  freshRun();
  const e=t.makeEcho({dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],
    dom:'neutro',moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,
    wave:2,level:1},1);
  e.x=t.getPlayer().x;e.y=t.getPlayer().y;
  t.setEchoes([e]);
  const qBefore=t.getQ();
  const savedBefore=qBefore.length?JSON.stringify(qBefore[0].ps||null):null;
  t.DEV_get().forcePersonality(1,'cautious');
  assert.strictEqual(e.pers.id,'cautious','runtime mudou');
  if(qBefore.length)
    assert.strictEqual(JSON.stringify(qBefore[0].ps||null),savedBefore,
      'registro da fila NÃO foi tocado');
  assert.strictEqual(e.persDev,1,'override marcado como DEV');
  t.DEV_get().forcePersonality(1,'auto');
  assert.ok(!e.pers||e.pers.id!=='cautious','auto restaura a base');
  t.setEchoes([]);t.DEV_off();
});
ok('forçar personalidade SEM DEV_MODE é ignorado (gate devReady)',()=>{
  freshRun();
  const e=t.makeEcho({dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],
    dom:'neutro',moral:{},kills:5,mh:100,st:stOf({}),dmgMul:1,frMul:1,
    wave:2,level:1},1);
  t.setEchoes([e]);
  const r=t.DEV_get().forcePersonality(1,'aggressive');
  assert.strictEqual(r,false);
  assert.ok(!e.pers);
  t.setEchoes([]);
});
ok('DEV.spawnEcho com pid gera Echo DEV com identidade e sem save',()=>{
  t.DEV_on();
  freshRun();
  const e=t.DEV_get().spawnEcho(1,'opportunist');
  assert.ok(e&&e.pers&&e.pers.id==='opportunist');
  assert.strictEqual(e.data.dev,1,'Echo DEV nunca entra no save legítimo');
  const e2=t.DEV_get().spawnEcho(1,'nao-existe');
  assert.ok(e2&&!e2.pers,'pid inválido → Echo base, sem identidade forjada');
  t.DEV_off();
  t.clearDevTaint();   // simula: contaminação dev impede save da run
});
console.log('---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('FALHAS EM PR 8');process.exit(1);}
console.log('PR 8 — TODOS OS TESTES PASSARAM');
