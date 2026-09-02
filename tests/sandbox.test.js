'use strict';
/* =====================================================================
   TESTES — SANDBOX: LABORATÓRIO DO JOGADOR COM ISOLAMENTO TOTAL (PR 11.5)
   ---------------------------------------------------------------------
   §73–§92:
   · isolamento (§73): saveProg/saveMeta/saveEchoes/bumpProg/checkUnlocks/
     captureCheckpoint são no-op com o laboratório ativo — o arquivo do
     save no localStorage fica BYTE A BYTE idêntico;
   · unlock-all (§76): is*Unlocked → true dentro do sandbox;
   · morte (§89) roteia para TESTE ENCERRADO sem criar Echo;
   · vitória (§90) roteia para TESTE CONCLUÍDO sem registrar final;
   · restart (§88) reinicia o MESMO setup; exit (§87) restaura a fila de
     Ecos real (mesma referência) e o operador do slot;
   · sandboxSetChar NÃO persiste no slot (diferente de setChar real);
   · painel F1 (§79–§86): swap de slots, §62 (arsenal cheio → escolher
     qual slot substituir), removeItemById com taint=false.
   Executa o script REAL de index.html em um sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/sandbox.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

src+=';globalThis.__t={'+
  'sandboxActive,sandboxOpenSetup,sandboxCloseSetup,sandboxStart,sandboxExit,'+
  'sandboxRestart,sandboxDeath,sandboxVictory,sandboxEndToSetup,sandboxRestoreReal,'+
  'sandboxSetChar,sandboxJumpTo,sandboxClearEnemies,sandboxClearRunState,'+
  'giveSandboxCredits,sbPanelShow,sbPanelClose,sbPanelToggle,sbAction,sbRender,'+
  'applyBuildPreset,grantWeapon,removeItemById,swapWeaponSlots,setChar,startRun,'+
  'activateSlot,resumeRun,hasActiveRun,captureCheckpoint,saveProg,saveMeta,saveEchoes,bumpProg,'+
  'checkUnlocks,onPlayerDeath,onVictory,'+
  'isCharUnlocked,isWeaponUnlocked,isItemUnlocked,isUpgUnlocked,'+
  'CHARS,WEAPONS,MAX_WAVE,SB_WAVES,SB_ETYPES,BUILD_PRESETS,'+
  'getState:()=>state,setState:s=>{state=s;},'+
  'getSandboxRun:()=>sandboxRun,getSandboxMode:()=>sandboxMode,'+
  'getSandboxCfg:()=>sandboxCfg,getSbEchoQueueBak:()=>_sbEchoQueueBak,'+
  'getSbCharBak:()=>_sbCharBak,getSbPendingWi:()=>sbPendingWi,'+
  'setSbPendingWi:v=>{sbPendingWi=v;},'+
  'getSbSwapA:()=>sbSwapA,setSbSwapA:v=>{sbSwapA=v;},'+
  'getSbPanelOpen:()=>sbPanelOpen,'+
  'getEchoQueue:()=>echoQueue,setEchoQueue:q=>{echoQueue=q;},'+
  'getCharSel:()=>charSel,getCurSlot:()=>curSlot,getSmRoot:()=>smRoot,'+
  'getProg:()=>prog,getMeta:()=>meta,'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getWave:()=>wave,getEnemies:()=>enemies,getBoss:()=>boss,'+
  'getBeacon:()=>beacon,getKills:()=>kills,'+
  'isDevTainted:()=>devTainted,forceDevMode:v=>{DEV_MODE=v;},'+
  'getEl:id=>document.getElementById(id),'+
  'getLS:()=>localStorage};';

/* ---------------- DOM mínimo (mesmo harness das outras suítes) ---------------- */
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
function bootGame(){
  const store=new Map();
  const ls={getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>{store.set(k,String(v));},
    removeItem:k=>{store.delete(k);}};
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
  t._ls=ls;t._store=store;
  return t;
}

/* ---------------- harness ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+(e&&e.stack||e));}
}
const wIdx=t=>id=>t.WEAPONS.findIndex(w=>w.id===id);
const CHKEY={pyre:'c_pyre',bulwark:'c_bulwark',nomad:'c_nomad',revenant:'c_revenant'};
function unlock(t,keys){for(const k of keys)
  if(t.getProg().seen.indexOf(k)<0)t.getProg().seen.push(k);}
/* prepara um boot com slot 1 real (operador PYRE + fila de Ecos forjada) */
function realSlot(t){
  t.activateSlot(1);
  unlock(t,[CHKEY.pyre,CHKEY.bulwark,CHKEY.nomad,CHKEY.revenant]);
  t.setChar(3);                          // PYRE — persistido no slot real
  const marker={marker:'eco-real-1'};
  const marker2={marker:'eco-real-2'};
  t.setEchoQueue([marker,marker2]);
  return {marker,marker2};
}

console.log('\nECHO — Sandbox · Laboratório do Jogador (PR 11.5)');
console.log('---------------------------------------------');

/* 1. sintaxe */
ok('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(m[1]);
});

/* ============ AUDITORIA ESTRUTURAL ============ */
const T=bootGame();
ok('AUDITORIA: SB_WAVES [1,3,5,10,15,20] · SB_ETYPES com 11 tipos',()=>{
  assert.strictEqual(JSON.stringify(T.SB_WAVES),'[1,3,5,10,15,20]');
  assert.strictEqual(T.SB_ETYPES.length,11);
  assert.strictEqual(T.MAX_WAVE,20);
});
ok('AUDITORIA: 6 presets de build disponíveis no preparo do sandbox',()=>{
  for(const k of ['shieldbreak','fullshield','crit','status','dash','economy'])
    assert(T.BUILD_PRESETS[k],'preset ausente: '+k);
});
ok('AUDITORIA: loop principal congela em state sandbox (frozen)',()=>{
  const i=html.indexOf('const frozen=(state===');
  assert(i>=0,'expressão frozen não encontrada');
  const chunk=html.slice(i,i+220);
  assert(chunk.indexOf("state==='sandbox'")>=0,
    "frozen deve incluir state==='sandbox'");
});
ok('AUDITORIA: gating !sandboxRun presente em beacon/arena/micro (loop)',()=>{
  assert(html.indexOf('!sandboxRun')>=0,'gate !sandboxRun ausente');
  /* spawn de beacon da arena é barrado no loop */
  const i=html.indexOf('if(!beacon&&wave>0&&wave<MAX_WAVE');
  assert(i>=0,'condição de spawn do beacon não encontrada');
  assert(html.slice(i,i+140).indexOf('!sandboxRun')>=0,
    'spawn de beacon sem gate sandbox');
  /* eventos de micro também são barrados no loop */
  const j=html.indexOf("if(!boss&&state==='play'&&!sandboxRun)");
  assert(j>=0,'micro-eventos sem gate sandbox');
});

/* ============ §74 — FLAGS E TELA DE PREPARO ============ */
ok('§74: flags começam desligadas; setup liga sandboxMode + codex SANDBOX',()=>{
  assert.strictEqual(T.sandboxActive(),false);
  assert.strictEqual(T.getSandboxRun(),false);
  T.sandboxOpenSetup();
  assert.strictEqual(T.getSandboxMode(),true);
  assert.strictEqual(T.sandboxActive(),true);
  assert.strictEqual(T.getState(),'title');       // fora de run no preparo
  assert.strictEqual(T.getEl('cx-title').textContent,'S A N D B O X');
  assert(T.getEl('cx-sub').textContent.indexOf('NADA AQUI AFETA')>=0,
    'aviso de isolamento no subtítulo');
  const body=T.getEl('cx-body').innerHTML;
  assert(body.indexOf('data-sbchar')>=0,'cartões de operador ausentes');
  assert(body.indexOf('TODOS LIBERADOS')>=0,'§76 não anunciado no setup');
  assert(body.indexOf('data-sbpreset')>=0,'presets ausentes');
  assert(body.indexOf('ONDA INICIAL')>=0,'seletor de onda ausente');
  assert(body.toUpperCase().indexOf('NÃO CRIA ECHO')>=0,
    'aviso de não-registro ausente');
});
ok('§74: preparo lista TODOS os operadores com seus slots reais (⌗)',()=>{
  const body=T.getEl('cx-body').innerHTML;
  for(const C of T.CHARS)
    assert(body.indexOf(C.nm)>=0,'operador ausente no preparo: '+C.nm);
  assert(body.indexOf('⌗')>=0,'contagem de slots (⌗) ausente');
});
ok('§76: unlock-all DENTRO do preparo (is*Unlocked → true)',()=>{
  assert.strictEqual(T.isCharUnlocked('revenant'),true);
  assert.strictEqual(T.isCharUnlocked('nomad'),true);
  assert.strictEqual(T.isCharUnlocked('bulwark'),true);
  assert.strictEqual(T.isWeaponUnlocked('beam'),true);
  assert.strictEqual(T.isWeaponUnlocked('rail'),true);
  assert.strictEqual(T.isWeaponUnlocked('void'),true);
  assert.strictEqual(T.isItemUnlocked('rebob'),true);   // i_rebob gated
  assert.strictEqual(T.isUpgUnlocked('pierce'),true);   // u_pierce gated
});
ok('§76: FORA do sandbox o gate volta ao normal',()=>{
  T.sandboxCloseSetup();
  assert.strictEqual(T.sandboxActive(),false);
  assert.strictEqual(T.isCharUnlocked('revenant'),false);
  assert.strictEqual(T.isWeaponUnlocked('beam'),false);
  assert.strictEqual(T.isItemUnlocked('rebob'),false);
  assert.strictEqual(T.isUpgUnlocked('pierce'),false);
});

/* ============ §75/§78 — INÍCIO DO LABORATÓRIO ============ */
const S=bootGame();
const {marker,marker2}=realSlot(S);
const SAVE_BEFORE=S._ls.getItem('echoSave.v3');
ok('§75: sandboxStart zera a fila de Ecos NA RUN e preserva a real',()=>{
  S.getSandboxCfg().char=2;                        // BULWARK no laboratório
  S.sandboxStart();
  assert.strictEqual(S.getSandboxRun(),true);
  assert.strictEqual(S.getSandboxMode(),false);
  assert.strictEqual(S.getState(),'play');
  assert.strictEqual(JSON.stringify(S.getEchoQueue()),'[]','fila esvaziada na run');
  assert.strictEqual(S.getSbEchoQueueBak()[0],marker,'fila real preservada');
  assert.strictEqual(S.getEchoQueue().indexOf(marker),-1);
});
ok('§75: operador do laboratório ativo; operador REAL guardado em _sbCharBak',()=>{
  assert.strictEqual(S.getCharSel(),2,'cfg.char=2 → BULWARK ativo');
  assert.strictEqual(S.getSbCharBak(),3,'PYRE real guardado');
  assert(S.getPlayer(),'player criado');
});
ok('§73: iniciar sandbox NÃO grava nada no save (byte a byte)',()=>{
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE);
  assert.strictEqual(S.getSmRoot().slots[1].char,3,'slot real continua PYRE');
});
ok('§77: crédito de teste +500 coins concedido (só no sandbox)',()=>{
  assert(S.getPlayer().coins>=500,'coins iniciais do laboratório ausentes');
});
ok('§78: preset de build aplica módulos sem tocar em progressão',()=>{
  const r=S.applyBuildPreset('crit',S.getPlayer());
  assert(r&&r.count>0,'preset crit não instalou módulos');
  assert(S.getPlayer().items.length>0);
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE);
});

/* ============ §83/§84 — ONDAS E ARENA ============ */
ok('§83: sandboxJumpTo pula para onda arbitrária SEM beacon',()=>{
  S.sandboxJumpTo(5);
  assert.strictEqual(S.getWave(),5);
  assert(S.getEnemies().length>0,'inimigos spawnados');
  assert.strictEqual(S.getBeacon(),null,'beacon NUNCA nasce no sandbox');
});
ok('§83: pular para a onda 20 despacha O PARADOXO',()=>{
  S.sandboxJumpTo(20);
  assert(S.getBoss(),'chefe presente na onda 20');
});
ok('§84: sandboxClearEnemies limpa a arena sem tocar em progressão',()=>{
  S.sandboxClearEnemies();
  assert.strictEqual(S.getEnemies().length,0);
  assert.strictEqual(S.getBoss(),null);
  assert.strictEqual(S.getBeacon(),null);
});

/* ============ §73 — GUARDAS NO-OP DURANTE A RUN ============ */
const PROG_BEFORE=JSON.stringify(S.getProg());
const META_BEFORE=JSON.stringify(S.getMeta());
ok('§73: saveProg/saveMeta/saveEchoes retornam false no laboratório',()=>{
  assert.strictEqual(S.saveProg(),false);
  assert.strictEqual(S.saveMeta(),false);
  assert.strictEqual(S.saveEchoes(),false);
});
ok('§73: bumpProg é no-op — abates/ondas do teste não alimentam records',()=>{
  S.bumpProg('kills',50);
  S.bumpProg('runs');S.bumpProg('waves',5);
  assert.strictEqual(JSON.stringify(S.getProg()),PROG_BEFORE,
    'prog mutado pelo sandbox!');
});
ok('§73: checkUnlocks é no-op mesmo com condições verdadeiras',()=>{
  S.getProg().kills=99999;             // forçaria w_beam etc.
  const before=JSON.stringify(S.getProg().seen);
  assert.strictEqual(S.checkUnlocks(),false);
  assert.strictEqual(JSON.stringify(S.getProg().seen),before,
    'nenhuma chave de unlock pode nascer no sandbox');
});
ok('§91: captureCheckpoint é no-op — laboratório não cria Continue Run',()=>{
  assert.strictEqual(S.captureCheckpoint('teste',9),false);
  assert.strictEqual(S.hasActiveRun(),false);
});
ok('§73: o ARQUIVO do save permanece idêntico após toda a run',()=>{
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE);
});
ok('§76: unlock-all vale também DURANTE a run (sandboxActive)',()=>{
  assert.strictEqual(S.isWeaponUnlocked('beam'),true);
  assert.strictEqual(S.isCharUnlocked('revenant'),true);
});

/* ============ §89 — MORTE: TESTE ENCERRADO ============ */
const PROG_DEATH=JSON.stringify(S.getProg());
ok('§89: onPlayerDeath roteia para TESTE ENCERRADO (sem Echo, sem save)',()=>{
  assert.strictEqual(S.getState(),'play');
  S.onPlayerDeath();
  assert.strictEqual(S.getState(),'fracture');
  assert.strictEqual(T_esc(S),'TESTE ENCERRADO');
  assert(S.getEl('ov-sub').textContent.indexOf('NENHUM ECO')>=0,
    'overlay deve afirmar que nenhum Eco foi criado');
  assert.strictEqual(S.getEchoQueue().length,0,'nenhum Echo criado');
  assert.strictEqual(S.getSbEchoQueueBak()[0],marker,'fila real intocada');
  assert.strictEqual(JSON.stringify(S.getProg()),PROG_DEATH,
    'prog não mudou na morte');
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE,
    'save não foi escrito na morte');
});
function T_esc(t){return t.getEl('ov-title').textContent;}

/* ============ §88 — REINICIAR O MESMO SETUP ============ */
ok('§88: sandboxRestart restaura fila real, troca operador e recomeça IGUAL',()=>{
  S.sandboxRestart();
  assert.strictEqual(S.getSandboxRun(),true);
  assert.strictEqual(S.getState(),'play');
  assert.strictEqual(S.getCharSel(),2,'mesmo operador de teste (BULWARK)');
  assert.strictEqual(S.getSbCharBak(),3,'PYRE real preservado de novo');
  assert.strictEqual(JSON.stringify(S.getEchoQueue()),'[]','fila esvaziada de novo');
  assert.strictEqual(S.getSbEchoQueueBak()[0],marker,'fila real intacta');
  assert.strictEqual(S.getWave(),0,'run recomeça do zero (resetRunWorld)');
  assert(S.getPlayer(),'player novo criado');
  assert(S.getPlayer().coins>=500,'crédito de teste de novo');
});

/* ============ §90 — VITÓRIA: TESTE CONCLUÍDO ============ */
ok('§90: onVictory roteia para TESTE CONCLUÍDO (sem final, sem memória)',()=>{
  S.sandboxJumpTo(20);
  S.onVictory();
  assert.strictEqual(S.getState(),'victory');
  assert.strictEqual(T_esc(S),'TESTE CONCLUÍDO');
  assert(S.getEl('ov-sub').textContent.indexOf('NENHUM FINAL')>=0,
    'overlay deve afirmar que nenhum final foi registrado');
  assert.strictEqual(S.getEchoQueue().length,0,'nenhum Echo na vitória');
  assert.strictEqual(JSON.stringify(S.getMeta()),META_BEFORE,
    'meta-progresso (memória) intocado');
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE);
});

/* ============ §87 — SAIR RESTAURA O SAVE REAL ============ */
ok('§87: sandboxExit devolve fila real (mesma referência) e operador do slot',()=>{
  S.sandboxExit(false);
  assert.strictEqual(S.getSandboxRun(),false);
  assert.strictEqual(S.sandboxActive(),false);
  assert.strictEqual(S.getEchoQueue()[0],marker,'MESMA referência do Eco 1');
  assert.strictEqual(S.getEchoQueue()[1],marker2,'MESMA referência do Eco 2');
  assert.strictEqual(S.getCharSel(),3,'charSel restaurado para PYRE');
  assert.strictEqual(S.getSbEchoQueueBak(),null,'backup consumido');
  assert.strictEqual(S.getEl('sb-chip').classList.contains('on'),false,
    'chip SANDBOX desligado');
  assert.strictEqual(S.getSmRoot().slots[1].char,3,'slot real: PYRE');
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE,
    'save permanece intocado após sair');
});

/* ============ §73 — setChar REAL persiste, sandboxSetChar NÃO ============ */
const C2=bootGame();
ok('§73: setChar real persiste no slot; sandboxSetChar não persiste',()=>{
  const r=realSlot(C2);                 // PYRE no slot 1
  assert.strictEqual(C2.getSmRoot().slots[1].char,3);
  C2.getSandboxCfg().char=1;            // WRAITH no laboratório
  C2.sandboxStart();
  assert.strictEqual(C2.getCharSel(),1);
  assert.strictEqual(C2.getSmRoot().slots[1].char,3,
    'início do laboratório não pode reescrever o slot');
  C2.sandboxSetChar(5);                 // NÔMADE dentro do sandbox
  assert.strictEqual(C2.getCharSel(),5);
  assert.strictEqual(C2.getSmRoot().slots[1].char,3,
    'sandboxSetChar NÃO persiste no slot real');
  C2.sandboxExit(false);
  assert.strictEqual(C2.getCharSel(),3,'volta ao operador real do slot');
});
ok('§92: sandbox com DEV desligado não gera taint ao remover item',()=>{
  /* DEV_MODE=false (produção): devTaint() é cedo-return; nenhuma ação do
     sandbox (remover item/trocar slots/trocar operador) pode manchar. */
  C2.sandboxStart();                    // run de laboratório nova (DEV off)
  const p=C2.getPlayer();
  C2.applyBuildPreset('crit',p);
  const item=p.items[0];
  assert(C2.removeItemById(p,item)===true,'remoção falhou');
  assert.strictEqual(C2.isDevTainted(),false,
    'sandbox marcou devTaint com DEV desligado');
  C2.swapWeaponSlots(0,Math.min(1,p.owned.length-1));
  C2.sandboxSetChar(0);
  assert.strictEqual(C2.isDevTainted(),false,'operação do sandbox manchou');
});
ok('§92 (estrutural): removeItemById só mancha quando taint=true',()=>{
  const i=html.indexOf('function removeItemById');
  const chunk=html.slice(i,i+700);
  assert(chunk.indexOf('if(taint&&typeof devTaint===')>=0,
    'guarda de taint ausente em removeItemById');
});

/* ============ §79–§86 — PAINEL F1 ============ */
ok('§79: F1 abre painel em run — state sandbox congela o tempo',()=>{
  assert.strictEqual(C2.getSbPanelOpen(),false);
  C2.sbPanelToggle();
  assert.strictEqual(C2.getSbPanelOpen(),true);
  assert.strictEqual(C2.getState(),'sandbox');
  assert(C2.getEl('sandboxp').classList.contains('on'),'painel visível');
  const h=C2.getEl('sb-body').innerHTML;
  assert(h.indexOf('JOGADOR')>=0,'seção jogador ausente');
  assert(h.indexOf('ARSENAL · '+C2.getPlayer().owned.length+'/'+
    C2.getPlayer().maxSlots+' SLOTS')>=0,'contador de slots ausente');
});
ok('§79: F1 de novo fecha o painel e devolve state play',()=>{
  C2.sbPanelToggle();
  assert.strictEqual(C2.getSbPanelOpen(),false);
  assert.strictEqual(C2.getState(),'play');
  assert(!C2.getEl('sandboxp').classList.contains('on'));
});
ok('§85: fluxo de TROCA do painel — armar → origem → destino (swap)',()=>{
  const p=C2.getPlayer();
  C2.sbPanelShow();
  const ownedBefore=p.owned.slice();
  C2.sbAction('swapmode');                       // armar (-2)
  assert.strictEqual(C2.getSbSwapA(),-2,'swapmode arma o fluxo');
  let h=C2.getEl('sb-body').innerHTML;
  assert(h.indexOf('data-sbslot')>=0,'slots clicáveis no modo swap');
  assert(h.indexOf('CLIQUE NA ARMA DE ORIGEM')>=0,'hint de origem ausente');
  C2.setSbSwapA(0);                              // clique: origem = slot 1
  C2.sbRender();                                 // handler re-renderiza
  h=C2.getEl('sb-body').innerHTML;
  assert(h.indexOf('FONTE: SLOT 1')>=0,'rótulo FONTE ausente');
  /* clique no destino = exatamente o que o handler data-sbslot faz */
  assert.strictEqual(C2.swapWeaponSlots(0,1),true);
  C2.setSbSwapA(-1);
  assert.strictEqual(JSON.stringify(p.owned),
    JSON.stringify([ownedBefore[1],ownedBefore[0]]),
    'arsenal permutado pelo painel');
  C2.sbAction('swapmode');                       // rearmar/desarmar sanity
  C2.sbAction('swapmode');
  assert.strictEqual(C2.getSbSwapA(),-1);
  C2.sbPanelClose();
});
ok('§86: ações do painel — HP cheio, cooldowns zerados, arena limpa',()=>{
  const p=C2.getPlayer();
  p.hp=1;C2.sbPanelShow();
  C2.sbAction('fullhp');
  assert.strictEqual(p.hp,p.maxHp,'fullhp não encheu HP');
  p.dashCd=2;p.spCd=5;p.fireTimer=.4;
  C2.sbAction('resetcd');
  assert.strictEqual(p.dashCd,0);assert.strictEqual(p.spCd,0);
  assert.strictEqual(p.fireTimer,0);
  C2.sbAction('group');
  assert(C2.getEnemies().length>0,'group não gerou inimigos');
  C2.sbAction('clear');
  assert.strictEqual(C2.getEnemies().length,0,'clear não limpou');
  C2.sbPanelClose();
});

/* ============ §62 — ARSENAL CHEIO: SUBSTITUIR QUAL SLOT? ============ */
const W2=bootGame();
ok('§62: arsenal cheio → escolher QUAL SLOT substituir (fluxo completo)',()=>{
  const r=realSlot(W2);
  W2.getSandboxCfg().char=1;                     // WRAITH: 2 slots, 2 armas
  W2.sandboxStart();
  W2.sbPanelShow();
  const p=W2.getPlayer();
  assert.strictEqual(p.owned.length,2);
  assert.strictEqual(p.maxSlots,2,'arsenal do WRAITH já nasce cheio');
  let h=W2.getEl('sb-body').innerHTML;
  assert(h.indexOf('ARSENAL · 2/2')>=0);
  /* o jogador pede uma arma nova: handler data-sbw detecta cheio →
     sbPendingWi (§62). Simulamos exatamente esse estado: */
  const orb=wIdx(W2)('orb');
  W2.setSbPendingWi(orb);
  W2.sbRender();
  h=W2.getEl('sb-body').innerHTML;
  assert(h.indexOf('SUBSTITUIR QUAL SLOT')>=0,'pergunta §62 ausente');
  assert(h.indexOf('data-sbslotpick')>=0,'slots de escolha ausentes');
  /* clique no slot 2 = exatamente o que o handler sbslotpick faz */
  assert.strictEqual(W2.getSbPendingWi(),orb);
  assert.strictEqual(W2.grantWeapon(orb,false,1),true);
  W2.setSbPendingWi(null);
  assert.strictEqual(p.owned[1],orb,'orb substituiu o slot 2');
  assert.strictEqual(p.owned.length,2,'continua 2 slots');
  W2.sbPanelClose();
});
ok('§62 (estrutural): handler data-sbw decide livre/substituição/pendência',()=>{
  const i=html.indexOf("body.querySelectorAll('[data-sbw]')");
  assert(i>=0,'handler data-sbw ausente');
  const chunk=html.slice(i,i+900);
  assert(chunk.indexOf('sbPendingWi=wi')>=0,
    'cheio deve pendenciar a escolha de slot (sbPendingWi=wi)');
  const j=html.indexOf("body.querySelectorAll('[data-sbslotpick]')");
  const chunk2=html.slice(j,j+600);
  assert(chunk2.indexOf('grantWeapon(sbPendingWi,false,s)')>=0,
    'escolha do slot deve chamar grantWeapon(sbPendingWi,false,s)');
});

console.log('---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('\nFALHAS DETECTADAS');process.exit(1);}
