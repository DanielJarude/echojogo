'use strict';
/* =====================================================================
   TESTES — AUDIT-FIX-C · CARREGAMENTO DE META (ECHO)
   ---------------------------------------------------------------------
   Congela o CONTRATO do carregamento de meta antes/depois da unificação:
   · defaults do meta global e conversão de um objeto persistido;
   · diferenças INTENCIONAIS entre loadMeta() e activateSlot();
   · isolamento entre os 3 slots;
   · root ausente / corrompido / versão errada / migração da Alpha;
   · run inválida não apaga meta válido;
   · falha de storage;
   · referências compartilhadas entre o meta vivo e o objeto persistido.
   Executa o script REAL de index.html em um sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/audit-fix-c-meta-load.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const {readGameSource,runGameSource}=require('./harness/load-game');
const GAME_SRC=readGameSource();
const src=GAME_SRC;

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
/* localStorage controlável: `fail` faz setItem lançar (cota/porta fechada) */
function makeLocalStorage(seed){
  return {_d:Object.assign({},seed||{}),fail:false,writes:0,
    getItem(k){return Object.prototype.hasOwnProperty.call(this._d,k)?this._d[k]:null;},
    setItem(k,v){
      if(this.fail)throw new Error('QuotaExceededError (simulado)');
      this.writes++;this._d[k]=String(v);
    },
    removeItem(k){delete this._d[k];}};
}
function makeSandbox(ls){
  const document={
    hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
    fullscreenElement:null,webkitFullscreenElement:null,
    createElement:()=>makeEl(''),
    getElementById:id=>makeEl(id),
    querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},
    hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()
  };
  const window={
    innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    screen:{availWidth:1280,availHeight:720},
    addEventListener:()=>{},removeEventListener:()=>{},
    matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),
    AudioContext:undefined,webkitAudioContext:undefined,
    open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined,
    location:{search:'',hash:''}
  };
  return {console:{log(){},warn(){},error(){}},Math,Date,parseInt,parseFloat,
    isNaN,isFinite,
    setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,
    Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
    Promise,Proxy,Reflect,JSON,Symbol,
    document,window,localStorage:ls,
    navigator:{getGamepads:()=>[],userAgent:'node'},
    performance:{now:()=>Date.now()}
  };
}
function bootGame(seed){
  const ls=makeLocalStorage(seed);
  const ctx=vm.createContext(makeSandbox(ls));
  runGameSource(src,ctx,{timeout:20000});
  const X=code=>vm.runInContext(code,ctx);
  return {X,ls,stored:()=>JSON.parse(ls.getItem('echoSave.v3')||'null')};
}

/* ---------------- harness ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+(e&&e.stack||e));}
}
const METAV={mem:111,spd:2,reroll:1,vault:3,wins:4,
  endings:['liber'],evars:['liber.-']};
function rootWith(slots,lastSlot){
  const s={1:{meta:null,prog:null,char:0,echoes:[],run:null,touched:false,fracd:null},
    2:{meta:null,prog:null,char:0,echoes:[],run:null,touched:false,fracd:null},
    3:{meta:null,prog:null,char:0,echoes:[],run:null,touched:false,fracd:null}};
  for(const k in slots||{})Object.assign(s[k],slots[k]);
  return JSON.stringify({version:3,lastSlot:lastSlot||1,slots:s});
}

console.log('\nECHO — AUDIT-FIX-C · Carregamento de meta');
console.log('---------------------------------------------');

/* =====================================================================
   A. DEFAULTS E CONVERSÃO
   ===================================================================== */
ok('A1: instalação nova — meta parte do default completo (zeros + arrays vazios)',()=>{
  const {X}=bootGame();
  X('activateSlot(1)');
  assert.deepStrictEqual(X('JSON.parse(JSON.stringify(meta))'),
    {mem:0,spd:0,reroll:0,vault:0,wins:0,endings:[],evars:[]});
});

ok('A2: meta persistida completa é carregada campo a campo',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  assert.deepStrictEqual(X('JSON.parse(JSON.stringify(meta))'),METAV);
});

ok('A3: meta parcial — campos ausentes voltam ao default',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({1:{meta:{mem:9},touched:true}})});
  X('activateSlot(1)');
  assert.deepStrictEqual(X('JSON.parse(JSON.stringify(meta))'),
    {mem:9,spd:0,reroll:0,vault:0,wins:0,endings:[],evars:[]});
});

ok('A4: meta inválida (string/número/bool) → default integral',()=>{
  for(const bad of ['"lixo"','42','true']){
    const {X}=bootGame({'echoSave.v3':rootWith({1:{meta:JSON.parse(bad),touched:true}})});
    X('activateSlot(1)');
    assert.deepStrictEqual(X('JSON.parse(JSON.stringify(meta))'),
      {mem:0,spd:0,reroll:0,vault:0,wins:0,endings:[],evars:[]},'meta='+bad);
  }
});

ok('A5: coerção numérica |0 e arrays não-array → []',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({1:{touched:true,
    meta:{mem:'7',spd:3.9,reroll:null,vault:-2,wins:'x',
      endings:'liber',evars:{a:1}}}})});
  X('activateSlot(1)');
  assert.deepStrictEqual(X('JSON.parse(JSON.stringify(meta))'),
    {mem:7,spd:3,reroll:0,vault:-2,wins:0,endings:[],evars:[]});
});

ok('A6: defaults são objetos NOVOS (slots não compartilham arrays default)',()=>{
  const {X}=bootGame();
  X('activateSlot(2)');
  const a2=X('meta.endings');
  X('activateSlot(3)');
  const a3=X('meta.endings');
  assert.notStrictEqual(a2,a3,'cada ativação recebe arrays próprios');
  a2.push('x');
  assert.strictEqual(a3.length,0,'mutação em um slot não atinge o outro');
});

/* =====================================================================
   B. ISOLAMENTO ENTRE OS 3 SLOTS
   ===================================================================== */
ok('B1: meta é por slot — trocar de slot não vaza valores',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  assert.strictEqual(X('meta.mem'),111);
  X('activateSlot(2)');
  assert.strictEqual(X('meta.mem'),0,'Save 2 não herda ◆ do Save 1');
  assert.strictEqual(X('meta.endings.length'),0);
  X('activateSlot(1)');
  assert.strictEqual(X('meta.mem'),111,'Save 1 preservado');
});

ok('B2: slot intocado — activateSlot inicializa touched/meta/prog sem tocar os outros',()=>{
  const {X,stored}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(3)');
  const r=stored();
  assert.strictEqual(r.slots['3'].touched,true,'slot 3 passa a existir');
  assert.deepStrictEqual(r.slots['3'].meta,
    {mem:0,spd:0,reroll:0,vault:0,wins:0,endings:[],evars:[]});
  assert.deepStrictEqual(r.slots['1'].meta,METAV,'Save 1 intocado');
  assert.strictEqual(r.slots['2'].touched,false,'Save 2 continua intocado');
  assert.strictEqual(r.lastSlot,3);
});

ok('B3: activateSlot(0) / fora de faixa cai no lastSlot persistido',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({2:{meta:METAV,touched:true}},2)});
  X('activateSlot(0)');
  assert.strictEqual(X('curSlot'),2);
  assert.strictEqual(X('meta.mem'),111);
  X('activateSlot(9)');
  assert.strictEqual(X('curSlot'),2);
});

/* =====================================================================
   C. loadMeta() — API de teste/harness, POLÍTICA PRÓPRIA
   ===================================================================== */
ok('C1: loadMeta relê o meta do slot ativo (sem trocar de slot)',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  X('meta.mem=0;meta.wins=0;');
  X('loadMeta()');
  assert.strictEqual(X('meta.mem'),111);
  assert.strictEqual(X('meta.wins'),4);
  assert.strictEqual(X('curSlot'),1);
});

ok('C2: loadMeta NÃO tem os efeitos de seleção de activateSlot',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({
    1:{meta:METAV,prog:{kills:2400,seen:[]},char:2,touched:true}},1)});
  X('activateSlot(1)');
  X('prog.kills=1;charSel=0;echoQueue=[];activeRun=null;');
  X('loadMeta()');
  assert.strictEqual(X('prog.kills'),1,'loadMeta não recarrega prog');
  assert.strictEqual(X('charSel'),0,'loadMeta não recarrega o operador');
  assert.strictEqual(X('meta.mem'),111,'mas recarrega o meta');
});

ok('C3: loadMeta sem slot ativo usa smEnsureSlot (lastSlot persistido)',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({3:{meta:METAV,touched:true}},3)});
  X('curSlot=0;meta={mem:-1,spd:0,reroll:0,vault:0,wins:0,endings:[],evars:[]};');
  X('loadMeta()');
  assert.strictEqual(X('curSlot'),3,'ativou o último slot usado');
  assert.strictEqual(X('meta.mem'),111);
});

ok('C4: loadMeta sem root e sem storage não ativa slot nenhum (no-op seguro)',()=>{
  const {X}=bootGame();
  X('smRoot=null;curSlot=0;meta.mem=5;');
  X('loadMeta()');
  assert.strictEqual(X('curSlot'),0,'sem raiz não há slot para ativar');
  assert.strictEqual(X('meta.mem'),5,'nada foi alterado');
});

/* =====================================================================
   D. RAIZ AUSENTE / CORROMPIDA / MIGRAÇÃO
   ===================================================================== */
ok('D1: sem echoSave.v3 — smLoadRoot cria raiz v3 com 3 slots',()=>{
  const {X}=bootGame();
  X('smLoadRoot()');
  assert.strictEqual(X('smRoot.version'),3);
  assert.strictEqual(X('Object.keys(smRoot.slots).join(",")'),'1,2,3');
  assert.strictEqual(X('smRoot.lastSlot'),1);
});

ok('D2: version errada — raiz é ignorada e o meta parte do default',()=>{
  const {X}=bootGame({'echoSave.v3':JSON.stringify(
    {version:2,lastSlot:1,slots:{1:{meta:METAV,touched:true}}})});
  X('smLoadRoot();activateSlot(1)');
  assert.strictEqual(X('meta.mem'),0,'v2 não é lido como v3');
});

ok('D3: run inválida NÃO apaga o meta válido do slot',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true,
    run:{v:1,wave:-5,p:{}}}})});
  X('smLoadRoot();activateSlot(1)');
  assert.strictEqual(X('meta.mem'),111,'meta sobrevive à run descartada');
  assert.strictEqual(X('activeRun'),null,'apenas a run foi descartada');
});

ok('D4: smSanitizeSlot é raso — preserva o objeto meta sem coagir campos',()=>{
  const {X}=bootGame();
  const out=X('JSON.parse(JSON.stringify(smSanitizeSlot('+
    JSON.stringify({meta:{mem:'7',lixo:1},char:99,touched:1})+')))');
  assert.deepStrictEqual(out.meta,{mem:'7',lixo:1},'meta passa cru (coerção é do loader)');
  assert.strictEqual(out.touched,true);
});

ok('D5: migração da Alpha leva echoMeta.v1 para o SAVE 1 e apaga a chave antiga',()=>{
  const {X,ls,stored}=bootGame({'echoMeta.v1':JSON.stringify(
    {mem:50,spd:1,reroll:0,vault:2,wins:1,endings:['tirano'],evars:['tirano.-']})});
  const r=stored();
  assert.strictEqual(r.slots['1'].meta.mem,50);
  assert.deepStrictEqual(r.slots['1'].meta.endings,['tirano']);
  assert.strictEqual(r.slots['1'].touched,true,'save existente = memória usada');
  assert.strictEqual(ls.getItem('echoMeta.v1'),null,'chave legada removida');
  assert.strictEqual(X('meta.mem'),50,'meta ativo já reflete a migração');
});

ok('D6: migração não re-executa quando echoSave.v3 já existe',()=>{
  const {ls,stored}=bootGame({
    'echoSave.v3':rootWith({1:{meta:METAV,touched:true}}),
    'echoMeta.v1':JSON.stringify({mem:999})});
  assert.strictEqual(stored().slots['1'].meta.mem,111,'v3 tem precedência');
  assert.strictEqual(ls.getItem('echoMeta.v1'),JSON.stringify({mem:999}),
    'legado intocado quando não há migração');
});

/* =====================================================================
   E. GRAVAÇÃO E FALHA DE STORAGE
   ===================================================================== */
ok('E1: saveMeta grava o meta vivo no slot ativo (clone profundo)',()=>{
  const {X,stored}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  X('meta.mem=200;meta.endings.push("dueto");');
  assert.strictEqual(X('saveMeta()'),true);
  const s=stored().slots['1'].meta;
  assert.strictEqual(s.mem,200);
  assert.deepStrictEqual(s.endings,['liber','dueto']);
});

ok('E2: SANDBOX — saveMeta e smCommit recusam gravar',()=>{
  const {X,ls}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  const before=ls.getItem('echoSave.v3');
  X('sandboxRun=true;');
  assert.strictEqual(X('saveMeta()'),false,'saveMeta bloqueado');
  assert.strictEqual(X('smCommit()'),false,'smCommit bloqueado');
  X('sandboxRun=false;');
  assert.strictEqual(ls.getItem('echoSave.v3'),before,'storage byte-a-byte');
});

ok('E3: DEV tainted — saveMeta recusa gravar',()=>{
  const {X,ls}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  const before=ls.getItem('echoSave.v3');
  X('devTainted=true;meta.mem+=500;');
  assert.strictEqual(X('saveMeta()'),false);
  X('devTainted=false;');
  assert.strictEqual(ls.getItem('echoSave.v3'),before,'storage byte-a-byte');
});

/* =====================================================================
   F. REGRESSÃO — BUGS CORRIGIDOS NO AUDIT-FIX-C
   ===================================================================== */
ok('F1: loadMeta em slot SEM meta persistida volta ao default (não fica obsoleta)',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({
    1:{meta:METAV,touched:true},2:{meta:null,touched:true}})});
  X('activateSlot(1)');
  assert.strictEqual(X('meta.mem'),111);
  X('curSlot=2');                       // slot ativo sem meta persistida
  X('loadMeta()');
  assert.deepStrictEqual(X('JSON.parse(JSON.stringify(meta))'),
    {mem:0,spd:0,reroll:0,vault:0,wins:0,endings:[],evars:[]},
    'o meta do Save 1 não pode sobreviver em RAM no Save 2');
});

ok('F2: falha de storage é REPORTADA por smCommit/saveMeta/saveProg',()=>{
  const {X,ls}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  assert.strictEqual(X('smCommit()'),true,'storage saudável → true');
  assert.strictEqual(X('saveMeta()'),true);
  assert.strictEqual(X('saveProg()'),true);
  ls.fail=true;                         // cota estourada / storage indisponível
  assert.strictEqual(X('smCommit()'),false,'commit sem gravação não pode dizer true');
  assert.strictEqual(X('saveMeta()'),false);
  assert.strictEqual(X('saveProg()'),false);
  ls.fail=false;
  assert.strictEqual(X('saveMeta()'),true,'volta a true quando o storage responde');
});

ok('F3: meta vivo NÃO compartilha arrays com o objeto persistido',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  assert.strictEqual(X('meta.endings===smRoot.slots[1].meta.endings'),false);
  assert.strictEqual(X('meta.evars===smRoot.slots[1].meta.evars'),false);
  X('loadMeta()');
  assert.strictEqual(X('meta.endings===smRoot.slots[1].meta.endings'),false,
    'loadMeta também copia');
  X('meta.endings.push("tirano")');
  assert.deepStrictEqual(X('smRoot.slots[1].meta.endings'),['liber'],
    'mutação em RAM não atinge o save antes de saveMeta()');
});

ok('F4: DEV tainted — final registrado em RAM não vaza no próximo commit',()=>{
  const {X,stored}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  X('devTainted=true;meta.endings.push("tirano");meta.evars.push("tirano.-");');
  assert.strictEqual(X('saveMeta()'),false,'saveMeta continua bloqueado');
  X('smCommit();');                     // commit legítimo de outro caminho
  X('devTainted=false;');
  assert.deepStrictEqual(stored().slots['1'].meta.endings,['liber'],
    'nenhum final de run DEV chega ao save');
  assert.deepStrictEqual(stored().slots['1'].meta.evars,['liber.-']);
});

ok('F5: SANDBOX — final registrado em RAM não vaza após sair do laboratório',()=>{
  const {X,stored}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  X('sandboxRun=true;meta.endings.push("eterno");meta.mem+=999;');
  X('saveMeta();');
  X('sandboxRun=false;smCommit();');    // qualquer gravação real posterior
  assert.deepStrictEqual(stored().slots['1'].meta.endings,['liber'],
    'o laboratório não publica finais no save real');
  assert.strictEqual(stored().slots['1'].meta.mem,111,'◆ do laboratório não persistem');
});

ok('F6: prog.seen NÃO compartilha referência — unlock de run DEV não vaza',()=>{
  const {X,stored}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,
    prog:{kills:0,seen:['w_beam']},touched:true}})});
  X('activateSlot(1)');
  assert.strictEqual(X('prog.seen===smRoot.slots[1].prog.seen'),false);
  X('devTainted=true;prog.seen.push("w_rail");');
  assert.strictEqual(X('saveProg()'),false);
  X('smCommit();devTainted=false;');
  assert.deepStrictEqual(stored().slots['1'].prog.seen,['w_beam'],
    'nenhum unlock de run DEV chega ao save');
});

ok('F7: loadProg também copia seen',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,
    prog:{kills:0,seen:['w_beam']},touched:true}})});
  X('activateSlot(1)');
  X('loadProg()');
  assert.strictEqual(X('prog.seen===smRoot.slots[1].prog.seen'),false);
  assert.deepStrictEqual(X('prog.seen'),['w_beam'],'conteúdo preservado');
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('\nHÁ FALHAS');process.exit(1);}
console.log('\nTODOS OS TESTES PASSARAM');
