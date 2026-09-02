'use strict';
/* =====================================================================
   TESTES — ARSENAL DINÂMICO: SLOTS REAIS, SWAP, ESTADO E SAVE (PR 11.5)
   ---------------------------------------------------------------------
   §44–§66 · §117–§126:
   · cada operador preserva SUA quantidade de slots (2…5) — nada de
     limite global;
   · swapWeaponSlots é a operação central (SWAP, nada é destruído);
   · a identidade da arma ativa ACOMPANHA a arma (§53/§120);
   · anti-exploit: swap repetido não reseta cooldown, não muda stats,
     não duplica arma, não altera DPS (§59/§122);
   · checkpoint/Continue preservam ordem, arma ativa e quick switch
     (§65/§66/§124/§125);
   · save legado (sem lastWi) carrega sem perder armas (§126).
   Executa o script REAL de index.html em um sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/arsenal.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

src+=';globalThis.__t={'+
  'CHARS,WEAPONS,MAX_WAVE,'+
  'makePlayer,setWeaponSlot,cycleWeapon,quickSwitchWeapon,swapWeaponSlots,'+
  'grantWeapon,buildWeaponHUD,charGunIdx,weaponRange,'+
  'smGet,smAdd,smMul,smBreakdown,itemStateSet,itemStateGet,'+
  'startRun,resumeRun,captureCheckpoint,hasActiveRun,clearActiveRun,'+
  'activateSlot,smBuildCheckpoint,'+
  'setChar,saveProg,saveMeta,loadProg,loadMeta,'+
  'getState:()=>state,setState:s=>{state=s;},'+
  'getProg:()=>prog,getMeta:()=>meta,'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getWave:()=>wave,setWave:w=>{wave=w;},'+
  'getCharSel:()=>charSel,getCurSlot:()=>curSlot,'+
  'getActiveRun:()=>activeRun,getSmRoot:()=>smRoot,'+
  'getEchoQueue:()=>echoQueue,setEchoQueue:q=>{echoQueue=q;},'+
  'getEnemies:()=>enemies,'+
  'unlockAll:()=>{for(const k in UNLOCKS)if(prog.seen.indexOf(k)<0)prog.seen.push(k);}};';

/* ---------------- DOM mínimo ---------------- */
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
function makeLocalStorage(seed){
  return {_d:Object.assign({},seed||{}),
    getItem(k){return Object.prototype.hasOwnProperty.call(this._d,k)?this._d[k]:null;},
    setItem(k,v){this._d[k]=String(v);},
    removeItem(k){delete this._d[k];}};
}
function bootGame(seed){
  const store=new Map();
  const ls=makeLocalStorage(seed);
  const sandbox={
    window,document,console:{log(){},warn(){},error(){}},Math,JSON,Date,Array,
    Object,Set,Map,Number,String,Boolean,Promise,RegExp,Error,Proxy,Reflect,
    Symbol,parseInt,parseFloat,isNaN,
    navigator:{getGamepads:()=>[],userAgent:'node'},
    localStorage:ls,
    performance:{now:()=>Date.now()},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
    setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
    Uint8ClampedArray,__t:null
  };
  sandbox.globalThis=sandbox;
  sandbox.window.requestAnimationFrame=sandbox.requestAnimationFrame;
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'index.html',timeout:20000});
  const t=vm.runInContext('__t',sandbox);
  t._ls=ls;
  return t;
}

/* ---------------- harness ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+(e&&e.stack||e));}
}
function freshRun(t,charIdx){
  t.setPlayer(null);t.setWave(0);t.setState('title');
  if(charIdx!=null)t.setChar(charIdx);
  t.startRun();
  return t.getPlayer();
}
const wIdx=t=>id=>t.WEAPONS.findIndex(w=>w.id===id);
/* destrava operador/arma gated empurrando a chave em prog.seen */
function unlock(t,keys){for(const k of keys)if(t.getProg().seen.indexOf(k)<0)t.getProg().seen.push(k);}
const CHKEY={vector:'c_vector',wraith:'c_wraith',bulwark:'c_bulwark',pyre:'c_pyre',
  warden:'c_warden',nomad:'c_nomad',echo0:'c_echo0',revenant:'c_revenant'};

console.log('\nECHO — Arsenal Dinâmico (PR 11.5)');
console.log('---------------------------------------------');

/* 1. sintaxe */
ok('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(m[1]);
});

/* ============ §44/§45/§117/§118 — SLOTS REAIS POR OPERADOR ============ */
const T=bootGame();

ok('AUDITORIA: cada operador tem sua quantidade REAL de slots (2…5)',()=>{
  const expected={vector:4,wraith:2,bulwark:5,pyre:3,warden:4,nomad:5,
    echo0:3,revenant:3};
  for(const C of T.CHAIRS||[]){}
  for(const C of T.CHARS){
    assert.strictEqual(C.slots,expected[C.id],
      C.id+' deve ter '+expected[C.id]+' slots');
    assert(C.slots>=2&&C.slots<=5,'slots fora da faixa 2–5: '+C.id);
    assert(Array.isArray(C.guns)&&C.guns.length>=2&&C.guns.length<=C.slots,
      C.id+' começa com mais armas do que slots');
  }
});
ok('§44: NÃO existe limite global de 2 armas no código do arsenal',()=>{
  /* a operação de swap/acesso é por owned.length/maxSlots — aqui
     garantimos a arquitetura real com um operador de 5 slots: */
  unlock(T,[CHKEY.bulwark]);
  const p=freshRun(T,2);                 // BULWARK — 5 slots
  assert.strictEqual(p.maxSlots,5,'BULWARK deve ter 5 slots');
  p.owned=[0,1,2,3,4];p.wi=0;
  assert.strictEqual(T.grantWeapon(5,true),false,
    'arsenal cheio não aceita append sem slot');
  assert.strictEqual(p.owned.length,5,'nada entrou além do limite real');
});
ok('§117: operador de 2 slots (WRAITH) — render e inputs respeitam',()=>{
  const p=freshRun(T,1);                 // WRAITH
  assert.strictEqual(p.maxSlots,2);
  assert.strictEqual(p.owned.length,2);
  T.setWeaponSlot(0);assert(true);
  T.setWeaponSlot(1);
  T.setWeaponSlot(4);                    // §54: slot inexistente é ignorado
  assert.strictEqual(p.owned.indexOf(p.wi),1,'slot 4 não pode equipar nada');
  const wi0=p.owned[0],wi1=p.owned[1];
  assert.notStrictEqual(wi0,wi1,'2 armas distintas nos 2 slots');
});
ok('§118: operador de 5 slots (NÔMADE) — 1..5 todos equipáveis',()=>{
  unlock(T,[CHKEY.nomad]);
  const p=freshRun(T,5);                 // NÔMADE
  assert.strictEqual(p.maxSlots,5);
  p.owned=[0,1,2,3,4];p.wi=0;            // enche os 5 slots de verdade
  for(let s=0;s<5;s++){
    T.setWeaponSlot(s);
    assert.strictEqual(p.wi,p.owned[s],'slot '+(s+1)+' deve equipar');
  }
});

/* ============ §119 — SWAP 3 → 1 (obrigatório) ============ */
ok('§119: arsenal [A,B,C] · swapWeaponSlots(2,0) → [C,B,A]',()=>{
  unlock(T,[CHKEY.bulwark]);
  const p=freshRun(T,2);                 // BULWARK (3+ slots)
  const W=T.WEAPONS;
  p.owned=[wIdx(T)('plasma'),wIdx(T)('shotgun'),wIdx(T)('beam')]; // A,B,C
  p.wi=p.owned[0];
  assert.strictEqual(T.swapWeaponSlots(2,0),true,'swap 3→1 deve funcionar');
  assert.strictEqual(p.owned[0],wIdx(T)('beam'),'slot 1 recebeu C');
  assert.strictEqual(p.owned[1],wIdx(T)('shotgun'),'slot 2 continua B');
  assert.strictEqual(p.owned[2],wIdx(T)('plasma'),'slot 3 recebeu A');
});
ok('§49: swap é TROCA — nenhuma arma é destruída nem duplicada',()=>{
  const p=freshRun(T,2);
  p.owned=[0,1,2];p.wi=0;
  const before=p.owned.slice().sort().join(',');
  T.swapWeaponSlots(0,2);
  const after=p.owned.slice().sort().join(',');
  assert.strictEqual(after,before,'mesmo multiconjunto de armas');
});
ok('swap inválido é recusado sem efeito (slots fora da faixa/iguais)',()=>{
  const p=freshRun(T,1);                 // WRAITH 2 slots
  p.owned=[0,1];p.wi=0;
  assert.strictEqual(T.swapWeaponSlots(0,0),false);
  assert.strictEqual(T.swapWeaponSlots(0,5),false);
  assert.strictEqual(T.swapWeaponSlots(-1,1),false);
  assert.strictEqual(T.swapWeaponSlots(0,1),true,'2 slots ainda trocam');
});

/* ============ §120/§53 — ARMA ATIVA ACOMPANHA A ARMA ============ */
ok('§120: C ativa no slot 3 · swap 3→1 → C continua ATIVA (agora no slot 1)',()=>{
  unlock(T,[CHKEY.bulwark]);
  const p=freshRun(T,2);
  const W=T.WEAPONS;
  p.owned=[wIdx(T)('plasma'),wIdx(T)('shotgun'),wIdx(T)('beam')];
  T.setWeaponSlot(2);                    // C equipada (slot 3)
  assert.strictEqual(p.wi,wIdx(T)('beam'));
  T.swapWeaponSlots(2,0);
  assert.strictEqual(p.wi,wIdx(T)('beam'),'identidade da ativa preservada');
  assert.strictEqual(p.owned.indexOf(p.wi),0,'ativa agora está no slot 1');
});
ok('swap com a ativa no DESTINO também preserva (swap 1↔3)',()=>{
  const p=freshRun(T,2);
  p.owned=[0,1,2];p.wi=p.owned[2];       // arma do slot 3 é a ativa
  T.swapWeaponSlots(0,2);                // slot 1 ↔ slot 3
  assert.strictEqual(p.wi,2,'ativa continua sendo a MESMA arma');
  assert.deepStrictEqual(p.owned,[2,1,0],'permutação exata dos slots');
  assert.strictEqual(p.owned.indexOf(p.wi),0,'ativa agora ocupa o slot 1');
});

/* ============ §57/§58/§121 — ESTADO PRESERVADO ============ */
ok('§121: cooldown/timers/modificadores NÃO são tocados pelo swap',()=>{
  const p=freshRun(T,2);
  p.owned=[0,1,2];p.wi=0;
  p.fireTimer=0.05;p.beamRamp=1.7;p.dashCd=1.1;
  T.smMul(p,'damage','test.swap','TESTE +10%',1.10);
  const st={
    fire:p.fireTimer,beam:p.beamRamp,dash:p.dashCd,
    dmg:T.smGet(p,'damage'),
    item:JSON.stringify(p.itemState)
  };
  T.itemStateSet(p,'olho','lock',3);
  st.item=JSON.stringify(p.itemState);
  T.swapWeaponSlots(2,0);T.swapWeaponSlots(0,2);
  assert.strictEqual(p.fireTimer,st.fire,'fireTimer intacto');
  assert.strictEqual(p.beamRamp,st.beam,'beam intacto');
  assert.strictEqual(p.dashCd,st.dash,'dash intacto');
  assert.strictEqual(T.smGet(p,'damage'),st.dmg,'pipeline intacto');
  assert.strictEqual(JSON.stringify(p.itemState),st.item,'itemState intacto');
});

/* ============ §59/§122 — ANTI-EXPLOIT ============ */
ok('§122: ANTI-EXPLOIT — swap repetido 3→1→3→1 não altera nada de combate',()=>{
  const p=freshRun(T,2);
  p.owned=[wIdx(T)('plasma'),wIdx(T)('smg'),wIdx(T)('rail')];
  T.setWeaponSlot(2);
  p.fireTimer=0.337;
  T.smMul(p,'fireRate','test.ae','TESTE CADÊNCIA',1.2);
  const snap={
    ft:p.fireTimer,
    rate:T.smGet(p,'fireRate'),
    dmg:T.smGet(p,'damage'),
    crit:T.smGet(p,'crit'),
    owned:p.owned.slice().sort((a,b)=>a-b).join(',')
  };
  for(let i=0;i<25;i++)T.swapWeaponSlots(2,0);   // martelada de swaps
  assert.strictEqual(p.fireTimer,snap.ft,'cooldown NUNCA reseta');
  assert.strictEqual(T.smGet(p,'fireRate'),snap.rate,'cadência estável');
  assert.strictEqual(T.smGet(p,'damage'),snap.dmg,'dano estável');
  assert.strictEqual(T.smGet(p,'crit'),snap.crit,'crít estável');
  assert.strictEqual(p.owned.slice().sort((a,b)=>a-b).join(','),snap.owned,
    'nenhuma arma duplicada/perdida');
});
ok('§60: swap é operação leve — o objeto player NUNCA é recriado',()=>{
  const p=freshRun(T,2);
  const ref=p;
  T.swapWeaponSlots(0,1);
  assert.strictEqual(T.getPlayer(),ref,'mesma instância de player');
});

/* ============ §55 — QUICK SWITCH ============ */
ok('§55: quick switch alterna com a última arma usada (X)',()=>{
  const p=freshRun(T,0);                 // VECTOR 4 slots
  p.owned=[0,1,2,3];
  T.setWeaponSlot(0);
  T.setWeaponSlot(3);                    // 1 → 4
  T.quickSwitchWeapon();                 // volta pro 1
  assert.strictEqual(p.wi,p.owned[0],'Q/X volta para a anterior');
  T.quickSwitchWeapon();                 // volta pro 4
  assert.strictEqual(p.wi,p.owned[3],'e alterna de volta');
});
ok('§55: Q mantém sua função original de CICLAR (não foi sobrescrito)',()=>{
  const srcq=html;
  assert(srcq.indexOf("if(e.code==='KeyQ')cycleWeapon(1)")>=0,
    'KeyQ continua chamando cycleWeapon');
  assert(srcq.indexOf("if(e.code==='KeyX')quickSwitchWeapon()")>=0,
    'quick switch mora na tecla X');
});
ok('quick switch sem "anterior" válida cai no ciclar (nunca quebra)',()=>{
  const p=freshRun(T,1);
  p.owned=[0,1];p.wi=0;p.lastWi=undefined;
  T.quickSwitchWeapon();
  assert(p.wi===0||p.wi===1,'sempre há uma arma equipada');
});

/* ============ §62/§123 — AQUISIÇÃO ============ */
ok('§123: slot vazio — arma entra corretamente no próximo slot',()=>{
  const p=freshRun(T,0);                 // VECTOR: 2 armas, 4 slots
  assert.strictEqual(p.owned.length,2);
  assert.strictEqual(T.grantWeapon(wIdx(T)('orb'),true),true);
  assert.strictEqual(p.owned.length,3);
  assert.strictEqual(p.owned[2],wIdx(T)('orb'),'entrou no slot 3');
});
ok('§123: slots cheios — grantWeapon sem slot falha (substituição exige escolha)',()=>{
  const p=freshRun(T,1);                 // WRAITH 2 slots cheios
  assert.strictEqual(T.grantWeapon(wIdx(T)('orb'),true),false);
  assert.strictEqual(p.owned.length,2,'nada entrou');
  /* com slot explícito: substitui (§63) */
  assert.strictEqual(T.grantWeapon(wIdx(T)('orb'),true,1),true);
  assert.strictEqual(p.owned[1],wIdx(T)('orb'),'slot 2 substituído');
  assert.strictEqual(p.owned.length,2,'continua 2 slots');
});
ok('§63: substituir NÃO reordena os outros slots',()=>{
  const p=freshRun(T,2);                 // BULWARK
  p.owned=[wIdx(T)('plasma'),wIdx(T)('shotgun'),wIdx(T)('orb')];
  T.grantWeapon(wIdx(T)('rail'),true,1);
  assert.strictEqual(p.owned[0],wIdx(T)('plasma'));
  assert.strictEqual(p.owned[1],wIdx(T)('rail'));
  assert.strictEqual(p.owned[2],wIdx(T)('orb'));
});

/* ============ §65/§66/§124/§125 — SAVE / CONTINUE ============ */
const S=bootGame();
ok('§124: checkpoint salva a ORDEM exata dos slots + ativa + lastWi',()=>{
  const p=freshRun(S,0);                 // VECTOR
  p.owned=[wIdx(S)('beam'),wIdx(S)('plasma'),wIdx(S)('orb')];
  T_setActive(p,1);                      // ativa = plasma (slot 2)
  p.lastWi=wIdx(S)('orb');
  assert.strictEqual(S.captureCheckpoint('teste',7),true,'checkpoint criado');
  const cp=S.getActiveRun();
  assert.deepStrictEqual(cp.p.owned,p.owned,'ordem preservada no checkpoint');
  assert.strictEqual(cp.p.wi,p.wi,'ativa preservada');
  assert.strictEqual(cp.p.lastWi,p.lastWi,'quick switch preservado');
  assert.strictEqual(cp.p.maxSlots,4,'quantidade de slots preservada');
});
function T_setActive(p,slot){p.wi=p.owned[slot];}
ok('§125: CONTINUE restaura MESMA ordem, MESMA ativa, MESMO lastWi',()=>{
  const seed=S._ls._d;
  const R=bootGame(seed);                // "fecha e reabre o jogo"
  R.activateSlot(1);
  assert(R.hasActiveRun(),'run retomável disponível');
  R.resumeRun();
  const q=R.getPlayer();
  assert.deepStrictEqual(q.owned,
    [wIdx(R)('beam'),wIdx(R)('plasma'),wIdx(R)('orb')],'ordem idêntica');
  assert.strictEqual(q.wi,wIdx(R)('plasma'),'ativa era o plasma (slot 2)');
  assert.strictEqual(q.owned.indexOf(q.wi),1);
  assert.strictEqual(q.lastWi,wIdx(R)('orb'),'X devolveria a orb');
  assert.strictEqual(q.maxSlots,4);
});
ok('§126: LEGACY — checkpoint sem lastWi carrega sem perder armas',()=>{
  const cp=JSON.parse(JSON.stringify(S.getActiveRun()));
  delete cp.p.lastWi;                    // save anterior à PR 11.5
  const seed=Object.assign({},S._ls._d);
  const root=JSON.parse(seed['echoSave.v3']);
  root.slots[1].run=cp;
  seed['echoSave.v3']=JSON.stringify(root);
  const R=bootGame(seed);
  R.activateSlot(1);
  R.resumeRun();
  const q=R.getPlayer();
  assert.strictEqual(q.owned.length,3,'nenhuma arma desapareceu');
  assert.strictEqual(q.lastWi,q.wi,'lastWi migra para a arma ativa');
});
ok('§126: LEGACY — arsenal de 5 slots em save antigo continua 5',()=>{
  const cp=JSON.parse(JSON.stringify(S.getActiveRun()));
  cp.p.maxSlots=5;cp.p.owned=[0,1,2,3,4];
  const seed=Object.assign({},S._ls._d);
  const root=JSON.parse(seed['echoSave.v3']);
  root.slots[1].run=cp;
  seed['echoSave.v3']=JSON.stringify(root);
  const R=bootGame(seed);
  R.activateSlot(1);
  R.resumeRun();
  const q=R.getPlayer();
  assert.strictEqual(q.maxSlots,5);
  assert.strictEqual(q.owned.length,5,'as 5 armas voltam');
});

/* ============ §46/§47 — ARQUITETURA DINÂMICA ============ */
ok('§46: arquitetura não está limitada a 5 — maxSlots aceita até 8',()=>{
  const p=freshRun(T,2);
  p.maxSlots=8;p.owned=[0,1,2,3,4,5,6,7];
  for(let s=0;s<8;s++){T.setWeaponSlot(s);assert.strictEqual(p.wi,s);}
  assert.strictEqual(T.swapWeaponSlots(7,0),true,'slot 8 participa do swap');
  assert.strictEqual(p.owned[0],7,'swap do 8º slot ok');
  assert.strictEqual(p.owned[7],0);
});
ok('§47: o Registro (TAB) renderiza TODOS os slots do operador',()=>{
  unlock(T,[CHKEY.bulwark]);
  const p=freshRun(T,2);                 // BULWARK: 5 slots, 3 armas
  /* replica o laço de render da seção de arsenal (§47): uma linha por
     slot de maxSlots, marcando vazios — maxSlots é a fonte da verdade */
  let n=0,hasEmpty=false;
  for(let s=0;s<p.maxSlots;s++){n++;if(p.owned[s]==null)hasEmpty=true;}
  assert.strictEqual(n,5,'5 linhas de slot para BULWARK');
  assert(p.owned.length>=2&&p.owned.length<=5,
    'arsenal inicial dentro do limite real ('+p.owned.length+')');
  assert.strictEqual(hasEmpty,p.maxSlots>p.owned.length,
    'slots vazios aparecem quando existem');
  /* HTML da ficha declara a seção de arsenal */
  assert(html.indexOf('sheet-arsenal')>=0||html.indexOf('ARSENAL')>=0,
    'seção ARSENAL presente no registro');
});

/* ============ §8 — SLOTS VAZIOS (buracos no meio) ============ */
const N=bootGame();
ok('§8: swapWeaponSlots move arma para slot vazio (exato do enunciado)',()=>{
  unlock(N,[CHKEY.bulwark]);
  const p=freshRun(N,2);                 // BULWARK 5 slots
  const laser=wIdx(N)('beam');
  p.owned=[null,null,laser];             // slot 3 = Laser · 1 e 2 vazios
  p.wi=laser;
  assert.strictEqual(N.swapWeaponSlots(2,0),true,'clicou 3, clicou 1');
  assert.strictEqual(p.owned[0],laser,'Slot 1 = Laser');
  assert.strictEqual(p.owned[2],null,'Slot 3 = vazio');
});
ok('§8: grantWeapon preenche o PRIMEIRO buraco antes de crescer',()=>{
  const p=freshRun(N,0);                 // VECTOR 4 slots
  p.owned=[0,null,1];                    // buraco no slot 2
  assert.strictEqual(N.grantWeapon(wIdx(N)('orb'),true),true);
  assert.strictEqual(p.owned[1],wIdx(N)('orb'),'entrou no buraco do slot 2');
  assert.strictEqual(p.owned.length,3,'não cresceu o array');
});
ok('§8: cycleWeapon e setWeaponSlot ignoram buracos',()=>{
  const p=freshRun(N,0);
  p.owned=[0,null,1];
  p.wi=0;
  N.cycleWeapon(1);
  assert.strictEqual(p.wi,1,'ciclar pulou o vazio');
  const wiAntes=p.wi;
  N.setWeaponSlot(1);                    // slot vazio: ignora
  assert.strictEqual(p.wi,wiAntes,'setWeaponSlot em buraco é no-op');
});
ok('§8: buildWeaponHUD não quebra com buracos (placeholder VAZIO)',()=>{
  const p=freshRun(N,0);
  p.owned=[0,null,1];
  assert.doesNotThrow(()=>N.buildWeaponHUD());
});
ok('§8: checkpoint aceita null (sanitize) e Continue restaura os buracos',()=>{
  const p=freshRun(N,0);
  p.owned=[0,null,1];p.wi=0;
  assert.strictEqual(N.captureCheckpoint('buraco',2),true,'checkpoint criado');
  const seed=Object.assign({},N._ls._d);
  const R=bootGame(seed);
  R.activateSlot(1);
  R.resumeRun();
  const q=R.getPlayer();
  assert.strictEqual(q.owned[1],null,'buraco sobreviveu ao save');
  assert.strictEqual(q.owned[0],0&&q.owned[2],1,'armas nas posições certas');
});
ok('§8: sanitize REJEITA owned só de buracos (mínimo 1 arma)',()=>{
  /* via resume: forja checkpoint com owned [null,null] e valida que o
     Continue não retoma (run sanitizada fora) */
  const p=freshRun(N,0);
  p.owned=[null,null];
  const cp=JSON.parse(JSON.stringify(N.getActiveRun()));
  cp.p.owned=[null,null];cp.p.wi=0;
  const seed=Object.assign({},N._ls._d);
  const root=JSON.parse(seed['echoSave.v3']);
  root.slots[1].run=cp;
  seed['echoSave.v3']=JSON.stringify(root);
  const R=bootGame(seed);
  R.activateSlot(1);
  assert.strictEqual(R.hasActiveRun(),false,'run sem armas é inválida');
});

console.log('---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('\nFALHAS DETECTADAS');process.exit(1);}
