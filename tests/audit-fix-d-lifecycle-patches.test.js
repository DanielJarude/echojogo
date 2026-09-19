'use strict';
/* =====================================================================
   TESTES — AUDIT-FIX-D · REGISTRO DE PATCHES DE LIFECYCLE (ECHO)
   ---------------------------------------------------------------------
   Congela o CONTRATO dos 8 kits de monkey-patch (138 wrappers) depois de
   passarem pelo registro central `lcPatch`:
   · inventário: nº de patches, nº de wrappers, falhas e bloqueios;
   · ordem de boot dos kits e ordem real de instalação por função-alvo;
   · mapa congelado id → funções embrulhadas (characterization);
   · idempotência: rebootar os kits não empilha uma segunda camada;
   · composição das cadeias (checkpoint, slot, run) — comportamental;
   · `this`, argumentos e retorno preservados ao atravessar a cadeia;
   · NOVA garantia: falha de instalação fica GRAVADA em vez de sumir num
     `catch(e){}` vazio, e não derruba os patches seguintes do kit;
   · regra de ordem: pré-original roda na ordem INVERSA de instalação.
   Executa o script REAL de index.html em um sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/audit-fix-d-lifecycle-patches.test.js
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

console.log('\nECHO — AUDIT-FIX-D · Registro de patches de lifecycle');
console.log('---------------------------------------------');

/* Valores criados dentro do vm têm outro Array.prototype: para comparar
   com deepStrictEqual é preciso trazê-los pelo JSON, como nas demais
   suítes que rodam o script real. */
function J(X,code){return X('JSON.parse(JSON.stringify('+code+'))');}

/* Um boot só serve para a maioria dos testes de inventário/mapa. */
const BOOT=bootGame();
const REP=J(BOOT.X,'lcPatchReport()');

/* =====================================================================
   A. INVENTÁRIO DO REGISTRO
   ===================================================================== */
ok('A1: os 8 kits instalam 71 blocos de patch, todos com sucesso',()=>{
  assert.strictEqual(REP.total,71,'blocos registrados');
  assert.strictEqual(REP.installed,71,'blocos instalados');
  assert.deepStrictEqual(REP.failed,[],'nenhum bloco pode falhar no boot');
});

ok('A2: os blocos declaram exatamente 138 wrappers',()=>{
  assert.strictEqual(REP.wrappers,138);
});

ok('A3: nenhum id foi registrado duas vezes',()=>{
  assert.deepStrictEqual(REP.blocked,[],'nenhuma instalação repetida');
  const ids=REP.patches.map(p=>p.id);
  assert.strictEqual(new Set(ids).size,ids.length,'ids únicos');
});

ok('A4: ordem de boot dos kits é explícita e estável',()=>{
  assert.deepStrictEqual(REP.kits,
    ['frac','fracture','facpres','facphys','temporal','memory','presence','intent']);
});

ok('A5: todo patch pertence a um kit e o id carrega o prefixo do kit',()=>{
  for(const p of REP.patches){
    assert.ok(REP.kits.indexOf(p.kit)>=0,'kit conhecido: '+p.id);
    assert.ok(p.id.indexOf(p.kit+'#')===0,'id prefixado: '+p.id);
  }
});

ok('A6: a ordem registrada é a ordem real de instalação (0..70, por kit)',()=>{
  REP.patches.forEach((p,i)=>assert.strictEqual(p.order,i,'ordem de '+p.id));
  const vistos=[];
  for(const p of REP.patches)if(vistos[vistos.length-1]!==p.kit)vistos.push(p.kit);
  assert.deepStrictEqual(vistos,REP.kits,'kits não se intercalam');
});

/* =====================================================================
   B. MAPA CONGELADO — id → funções de produção embrulhadas
   ---------------------------------------------------------------------
   Characterization: qualquer wrapper novo, removido ou movido de bloco
   aparece aqui como diff explícito, em vez de passar silencioso.
   ===================================================================== */
const MAPA=[
  ['frac#slot',['smBoot','activateSlot','smClearSlotSave']],
  ['frac#run',['startRun','resumeRun','onPlayerDeath','onVictory','showVictory']],
  ['frac#echodeath',['damageEcho','dissolveEcho']],
  ['frac#kill',['killEnemy']],
  ['frac#dissonance',['echoSetDis']],
  ['frac#echoupdate',['updateEcho']],
  ['frac#shop',['closeShop']],
  ['frac#sheet',['sheetRender']],
  ['frac#hud',['updateHUD']],
  ['frac#codex',['renderCodexBody']],
  ['frac#dev',['devCommand','devRender']],
  ['frac#sandbox',['sandboxExit','sandboxStart','sandboxRestart','sandboxEndToSetup','sandboxCloseSetup']],
  ['fracture#checkpoint',['smBuildCheckpoint']],
  ['fracture#slot',['activateSlot','smClearSlotSave']],
  ['fracture#run',['startRun','resumeRun','onPlayerDeath','onVictory','showVictory']],
  ['fracture#wave',['spawnWave']],
  ['fracture#sandbox',['sandboxStart','sandboxRestart','sandboxEndToSetup','sandboxExit','sandboxCloseSetup']],
  ['fracture#dev',['devCommand','devRender']],
  ['fracture#hud',['updateHUD']],
  ['fracture#codex',['renderCodexBody']],
  ['facpres#checkpoint',['smBuildCheckpoint']],
  ['facpres#slot',['activateSlot','smClearSlotSave']],
  ['facpres#run',['startRun','resumeRun','onPlayerDeath','onVictory','showVictory']],
  ['facpres#wave',['spawnWave']],
  ['facpres#sandbox',['sandboxStart','sandboxRestart','sandboxEndToSetup','sandboxExit','sandboxCloseSetup']],
  ['facpres#dev',['devRender']],
  ['facphys#wave',['spawnWave']],
  ['facphys#update',['updateAllies']],
  ['facphys#draw',['drawWorldExtras']],
  ['facphys#run',['startRun','onPlayerDeath','onVictory','showVictory','activateSlot','smClearSlotSave']],
  ['facphys#run2',['resumeRun']],
  ['facphys#sandbox',['sandboxStart','sandboxRestart','sandboxEndToSetup','sandboxExit']],
  ['facphys#dev',['devCommand','devRender']],
  ['temporal#run',['onPlayerDeath']],
  ['temporal#run2',['abortRun']],
  ['temporal#run3',['startRun','resumeRun','onVictory']],
  ['temporal#echoload',['loadEchoes']],
  ['temporal#slot',['activateSlot']],
  ['temporal#slot2',['smClearSlotSave']],
  ['temporal#event',['evOpt']],
  ['temporal#dev',[]],
  ['memory#checkpoint',['smBuildCheckpoint']],
  ['memory#slot',['activateSlot','smClearSlotSave']],
  ['memory#run',['startRun','resumeRun','onPlayerDeath','onVictory','showVictory','abortRun']],
  ['memory#wave',['spawnWave']],
  ['memory#sandbox',['sandboxStart','sandboxRestart','sandboxEndToSetup','sandboxExit','sandboxCloseSetup']],
  ['memory#dev',[]],
  ['presence#wave',['spawnWave']],
  ['presence#update',['updateAllies']],
  ['presence#draw',['drawWorldExtras']],
  ['presence#checkpoint',['smBuildCheckpoint']],
  ['presence#run',['resumeRun']],
  ['presence#run2',['startRun','onPlayerDeath','onVictory','showVictory','abortRun']],
  ['presence#slot',['activateSlot','smClearSlotSave']],
  ['presence#sandbox',['sandboxStart','sandboxRestart','sandboxEndToSetup','sandboxExit','sandboxCloseSetup']],
  ['presence#dev',[]],
  ['intent#spawn',['pr15PresSpawn']],
  ['intent#presend',['pr15PresEnd']],
  ['intent#update',['updateAllies']],
  ['intent#draw',['drawWorldExtras']],
  ['intent#draw2',['render']],
  ['intent#checkpoint',['smBuildCheckpoint']],
  ['intent#run',['resumeRun']],
  ['intent#run2',['startRun','onPlayerDeath','onVictory','showVictory','abortRun']],
  ['intent#slot',['activateSlot','smClearSlotSave']],
  ['intent#sandbox',['sandboxStart','sandboxRestart','sandboxEndToSetup','sandboxExit','sandboxCloseSetup']],
  ['intent#dev',[]],
  ['intent#resolve',['pr15PresResolveMemory']],
  ['intent#dev2',['devCommand']],
  ['intent#dev3',['devRender']],
  ['intent#sandbox2',['sandboxStart','sandboxExit']]
];

ok('B1: mapa id → funções embrulhadas congelado (71 blocos)',()=>{
  assert.deepStrictEqual(REP.patches.map(p=>[p.id,p.targets]),MAPA);
});

/* Cadeias por função de produção, na ordem REAL de instalação.
   Lembrete de leitura: o ÚLTIMO da lista é o wrapper mais EXTERNO. */
const CADEIAS={
  startRun:['frac#run','fracture#run','facpres#run','facphys#run','temporal#run3','memory#run','presence#run2','intent#run2'],
  resumeRun:['frac#run','fracture#run','facpres#run','facphys#run2','temporal#run3','memory#run','presence#run','intent#run'],
  onPlayerDeath:['frac#run','fracture#run','facpres#run','facphys#run','temporal#run','memory#run','presence#run2','intent#run2'],
  onVictory:['frac#run','fracture#run','facpres#run','facphys#run','temporal#run3','memory#run','presence#run2','intent#run2'],
  showVictory:['frac#run','fracture#run','facpres#run','facphys#run','memory#run','presence#run2','intent#run2'],
  abortRun:['temporal#run2','memory#run','presence#run2','intent#run2'],
  activateSlot:['frac#slot','fracture#slot','facpres#slot','facphys#run','temporal#slot','memory#slot','presence#slot','intent#slot'],
  smClearSlotSave:['frac#slot','fracture#slot','facpres#slot','facphys#run','temporal#slot2','memory#slot','presence#slot','intent#slot'],
  smBuildCheckpoint:['fracture#checkpoint','facpres#checkpoint','memory#checkpoint','presence#checkpoint','intent#checkpoint'],
  spawnWave:['fracture#wave','facpres#wave','facphys#wave','memory#wave','presence#wave'],
  sandboxStart:['frac#sandbox','fracture#sandbox','facpres#sandbox','facphys#sandbox','memory#sandbox','presence#sandbox','intent#sandbox','intent#sandbox2'],
  sandboxExit:['frac#sandbox','fracture#sandbox','facpres#sandbox','facphys#sandbox','memory#sandbox','presence#sandbox','intent#sandbox','intent#sandbox2'],
  sandboxRestart:['frac#sandbox','fracture#sandbox','facpres#sandbox','facphys#sandbox','memory#sandbox','presence#sandbox','intent#sandbox'],
  sandboxEndToSetup:['frac#sandbox','fracture#sandbox','facpres#sandbox','facphys#sandbox','memory#sandbox','presence#sandbox','intent#sandbox'],
  sandboxCloseSetup:['frac#sandbox','fracture#sandbox','facpres#sandbox','memory#sandbox','presence#sandbox','intent#sandbox'],
  updateAllies:['facphys#update','presence#update','intent#update'],
  drawWorldExtras:['facphys#draw','presence#draw','intent#draw'],
  devCommand:['frac#dev','fracture#dev','facphys#dev','intent#dev2'],
  devRender:['frac#dev','fracture#dev','facpres#dev','facphys#dev','intent#dev3'],
  updateHUD:['frac#hud','fracture#hud'],
  renderCodexBody:['frac#codex','fracture#codex']
};

ok('B2: ordem de instalação por função compartilhada congelada',()=>{
  for(const nome of Object.keys(CADEIAS))
    assert.deepStrictEqual(J(BOOT.X,'lcPatchTargets('+JSON.stringify(nome)+')'),
      CADEIAS[nome],'cadeia de '+nome);
});

ok('B3: lcPatchTargets devolve [] para função não embrulhada',()=>{
  assert.deepStrictEqual(J(BOOT.X,"lcPatchTargets('naoExiste')"),[]);
});

/* =====================================================================
   C. IDEMPOTÊNCIA — nada empilha uma segunda camada
   ===================================================================== */
ok('C1: rebootar os 8 kits não cria patch novo nem troca a função-alvo',()=>{
  const {X}=bootGame();
  const antes=X('lcPatchReport().total');
  const refs=X('[startRun,resumeRun,onPlayerDeath,smClearSlotSave,spawnWave,sandboxExit]');
  X('for(const k of LIFECYCLE_KITS)lcBootKit(k[0],k[1]);');
  assert.strictEqual(X('lcPatchReport().total'),antes,'nenhum patch novo');
  const depois=X('[startRun,resumeRun,onPlayerDeath,smClearSlotSave,spawnWave,sandboxExit]');
  refs.forEach((f,i)=>assert.strictEqual(f,depois[i],'mesma referência #'+i));
});

ok('C2: chamar cada *KitBoot() direto é no-op (guard .done)',()=>{
  const {X}=bootGame();
  const antes=X('lcPatchReport().total');
  const ref=X('smBuildCheckpoint');
  X('fracKitBoot();fractureKitBoot();factionPresenceKitBoot();'+
    'factionPresencePhysicalKitBoot();pr15TemporalKitBoot();pr15MemoryKitBoot();'+
    'pr15PresenceKitBoot();pr15IntentKitBoot();');
  assert.strictEqual(X('lcPatchReport().total'),antes);
  assert.strictEqual(X('smBuildCheckpoint'),ref,'cadeia intacta');
});

ok('C3: lcPatch recusa o mesmo id no mesmo kit e contabiliza o bloqueio',()=>{
  const {X}=bootGame();
  const antes=X('lcPatchReport().total');
  const instalou=X("lcBootKit('frac',function(){return lcPatch('slot',[],function(){});})&&"+
                   "lcPatchReport().blocked.length");
  assert.strictEqual(instalou,1,'um bloqueio registrado');
  assert.strictEqual(X('lcPatchReport().total'),antes,'nada foi adicionado');
  assert.deepStrictEqual(J(X,'lcPatchReport().blocked'),[{id:'frac#slot',n:1}]);
});

ok('C4: lcPatch devolve false quando recusa e true quando instala',()=>{
  const {X}=bootGame();
  assert.strictEqual(X("lcBootKit('probe',function(){"+
    "globalThis.__r1=lcPatch('novo',[],function(){});"+
    "globalThis.__r2=lcPatch('novo',[],function(){});});__r1"),true);
  assert.strictEqual(X('__r2'),false);
});

/* =====================================================================
   D. CADEIAS — contrato comportamental (não source-text)
   ===================================================================== */
function comRun(){
  const g=bootGame();
  g.X('activateSlot(1)');
  g.X('startRun({charId:"warden"})');
  return g;
}

ok('D1: smBuildCheckpoint compõe os campos dos 5 kits da cadeia',()=>{
  const {X}=comRun();
  const cp=X("JSON.parse(JSON.stringify(smBuildCheckpoint('teste')))");
  for(const k of ['fracture','presence','pr15mem','pr15presence','pr15intent'])
    assert.ok(Object.prototype.hasOwnProperty.call(cp,k),'cp.'+k+' presente');
});

ok('D2: smBuildCheckpoint preserva argumentos e retorno através da cadeia',()=>{
  const {X}=comRun();
  const cp=X("JSON.parse(JSON.stringify(smBuildCheckpoint('motivo-x',7)))");
  assert.strictEqual(cp.reason,'motivo-x','1º argumento chega ao original');
  assert.strictEqual(cp.wave,7,'2º argumento chega ao original');
  assert.ok(cp&&typeof cp==='object','retorno do original é devolvido');
});

ok('D3: smClearSlotSave dispara o cleanup dos 8 kits',()=>{
  const {X}=comRun();
  X('fracRun={x:1};fractureRun={x:1};factionPresenceRun={x:1};'+
    'factionPresenceEntity={x:1};pr15MemRun={x:1};pr15Ctx.abort=true;');
  X('smClearSlotSave()');
  assert.deepStrictEqual(
    J(X,'[fracRun,fractureRun,factionPresenceRun,factionPresenceEntity,pr15MemRun,pr15Ctx.abort]'),
    [null,null,null,null,null,false],'todo estado run-scoped dos kits morre com o slot');
});

ok('D4: activateSlot dispara o cleanup dos kits (nada vaza entre saves)',()=>{
  const {X}=comRun();
  X('fracRun={x:1};fractureRun={x:1};factionPresenceRun={x:1};'+
    'factionPresenceEntity={x:1};pr15MemRun={x:1};');
  X('activateSlot(2)');
  assert.deepStrictEqual(
    J(X,'[fracRun,fractureRun,factionPresenceRun,factionPresenceEntity,pr15MemRun]'),
    [null,null,null,null,null]);
});

ok('D5: `this` é preservado ao atravessar a cadeia',()=>{
  const {X}=comRun();
  X('globalThis.__alvo={marca:"eu",fn:smBuildCheckpoint};');
  const cp=X("JSON.parse(JSON.stringify(__alvo.fn('via-this')))");
  assert.strictEqual(cp.reason,'via-this');
});

ok('D6: abortRun limpa duas vezes (via onPlayerDeath e pós-original) sem quebrar',()=>{
  /* O abortRun de produção chama onPlayerDeath(); memory/presence/intent
     embrulham AS DUAS funções, então o cleanup deles roda 2×. Os resets
     são idempotentes — este teste congela isso como comportamento aceito. */
  const {X}=comRun();
  X("state='paused'");
  X('abortRun()');
  assert.deepStrictEqual(J(X,'[pr15MemRun,pr15Presence]'),[null,null]);
  assert.strictEqual(X('typeof pr15PresRun'),'object','registro recriado, não corrompido');
  assert.strictEqual(X('pr15Ctx.abort'),false,'causa de abort consumida e zerada');
});

/* =====================================================================
   E. NOVA GARANTIA — falha de instalação deixa de ser invisível
   ---------------------------------------------------------------------
   Antes do AUDIT-FIX-D cada bloco era `try{…}catch(e){}`: um throw no
   meio derrubava os wrappers seguintes DO BLOCO e não deixava rastro.
   ===================================================================== */
ok('E1: patch que lança é gravado em failed, com a mensagem',()=>{
  const {X}=bootGame();
  X("lcBootKit('probe',function(){lcPatch('boom',['alvoX'],function(){throw new Error('falhou de proposito');});});");
  const f=X('lcPatchReport().failed');
  assert.strictEqual(f.length,1);
  assert.strictEqual(f[0].id,'probe#boom');
  assert.ok(/falhou de proposito/.test(f[0].error),'mensagem preservada: '+f[0].error);
});

ok('E2: patch que lança não derruba os patches seguintes do kit',()=>{
  const {X}=bootGame();
  X("lcBootKit('probe',function(){"+
    "lcPatch('boom',[],function(){throw new Error('x');});"+
    "lcPatch('depois',[],function(){globalThis.__rodou=true;});});");
  assert.strictEqual(X('__rodou'),true,'o bloco seguinte instalou mesmo assim');
  assert.strictEqual(X('lcPatchReport().installed'),X('lcPatchReport().total-1'));
});

ok('E3: falha de patch não aborta o boot nem contamina os 71 reais',()=>{
  const {X}=bootGame();
  X("lcBootKit('probe',function(){lcPatch('boom',[],function(){throw new Error('x');});});");
  const rep=X('lcPatchReport()');
  assert.strictEqual(rep.total,72,'71 reais + 1 de teste');
  assert.strictEqual(rep.failed.length,1,'só o de teste falha');
  assert.strictEqual(rep.patches.filter(p=>p.kit!=='probe'&&!p.ok).length,0);
});

/* =====================================================================
   F. REGRA DE ORDEM (a parte não-óbvia do modelo de wrappers)
   ===================================================================== */
ok('F1: pré-original roda na ordem INVERSA de instalação; pós-original, na ordem',()=>{
  const {X}=bootGame();
  X('globalThis.__log=[];globalThis.__base=function(){__log.push("base");return "r";};');
  X("lcBootKit('k1',function(){lcPatch('p',['__base'],function(){"+
    'var o=__base;__base=function(){__log.push("pre1");var r=o.apply(this,arguments);__log.push("pos1");return r;};});});');
  X("lcBootKit('k2',function(){lcPatch('p',['__base'],function(){"+
    'var o=__base;__base=function(){__log.push("pre2");var r=o.apply(this,arguments);__log.push("pos2");return r;};});});');
  assert.strictEqual(X('__base()'),'r','retorno atravessa a cadeia');
  assert.deepStrictEqual(J(X,'__log'),['pre2','pre1','base','pos1','pos2']);
  assert.deepStrictEqual(J(X,"lcPatchTargets('__base')"),['k1#p','k2#p'],
    'lcPatchTargets lista na ordem de INSTALAÇÃO');
});

/* =====================================================================
   G. INSPEÇÃO
   ===================================================================== */
ok('G1: DEV.lifecyclePatches() devolve o relatório completo',()=>{
  const {X}=bootGame();
  assert.strictEqual(X('typeof DEV.lifecyclePatches'),'function');
  const r=J(X,'DEV.lifecyclePatches()');
  assert.strictEqual(r.total,71);
  assert.strictEqual(r.wrappers,138);
  assert.deepStrictEqual(r.failed,[]);
});

ok('G2: o relatório é uma cópia — mexer nele não altera o registro',()=>{
  const {X}=bootGame();
  X('var a=lcPatchReport();a.patches[0].targets.push("intruso");a.kits.push("falso");');
  const b=X('lcPatchReport()');
  assert.strictEqual(b.patches[0].targets.indexOf('intruso'),-1);
  assert.strictEqual(b.kits.indexOf('falso'),-1);
});

/* ---------------- resultado ---------------- */
console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('\nHÁ FALHAS');process.exit(1);}
console.log('\nTODOS OS TESTES PASSARAM');
