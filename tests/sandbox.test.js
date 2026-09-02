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
  'sandboxValidateCfg,sbApplyMod,sbResetMods,stripSandboxMods,sandboxBreakShield,'+
  'grantItemInternal,itemById,spawnEnemy,spawnMiniBoss,spawnBoss,spawnWave,'+
  'sandboxRemoveSlot,ITEMS,MINIBOSS,SB_MOD_IDS,countWeapons,'+
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
  'getLS:()=>localStorage,'+
  'getSbHold:()=>sandboxHoldUnlocks,onGameEsc,'+
  'sbPanelCanOpen,'+
  'getSmCommit:()=>smCommit,'+
  'showTitle,'+
  'pressKey:(code,type)=>{const ev={code,repeat:false,preventDefault(){}};'+
  '  (window._wl[type||"keydown"]||[]).forEach(f=>f(ev));}};';

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
/* nó criado a partir do PARSE do innerHTML — aceita handlers e cliques */
function makeNode(tag,attrs){
  const node={tag:tag||'div',id:'',children:[],dataset:{},_cls:[],_h:{},
    textContent:'',style:makeStyle(),value:''};
  node.classList={
    add:(...c)=>c.forEach(x=>{if(node._cls.indexOf(x)<0)node._cls.push(x);}),
    remove:(...c)=>node._cls=node._cls.filter(x=>c.indexOf(x)<0),
    contains:c=>node._cls.indexOf(c)>=0,
    toggle(c,f){const has=node._cls.indexOf(c)>=0;const want=f===undefined?!has:!!f;
      if(want&&!has)node._cls.push(c);
      if(!want&&has)node._cls=node._cls.filter(x=>x!==c);return want;}
  };
  for(const k in attrs||{}){
    const v=attrs[k];
    if(k==='class')node._cls=v.split(/\s+/).filter(Boolean);
    else if(k==='id')node.id=v;
    else if(k.indexOf('data-')===0){
      node.dataset[k.slice(5).replace(/-([a-z])/g,(x,c)=>c.toUpperCase())]=v;
    }
  }
  Object.defineProperty(node,'className',{
    get(){return node._cls.join(' ');},
    set(v){node._cls=v.split(/\s+/).filter(Boolean);}
  });
  node.addEventListener=(t,fn)=>{(node._h[t]=node._h[t]||[]).push(fn);};
  node.removeEventListener=()=>{};
  node.click=()=>{(node._h.click||[]).forEach(f=>
    f({type:'click',stopPropagation(){},preventDefault(){}}));};
  node.contains=x=>x===node;
  node.querySelectorAll=sel=>parseNodes('').filter(n=>matchSel(n,sel));
  node.querySelector=sel=>node.querySelectorAll(sel)[0]||null;
  return node;
}
function matchSel(n,sel){
  if(sel.charAt(0)==='#')return n.id===sel.slice(1);
  if(sel.charAt(0)==='.')return n._cls.indexOf(sel.slice(1))>=0;
  const mm=sel.match(/^\[([a-zA-Z-]+)(?:="([^"]*)")?\]$/);
  if(mm){
    const dk=mm[1].slice(5).replace(/-([a-z])/g,(x,c)=>c.toUpperCase());
    return mm[2]===undefined?n.dataset[dk]!=null:n.dataset[dk]===mm[2];
  }
  return n.tag===sel;
}
function parseNodes(htmlStr){
  const out=[];
  const re=/<(div|span|h4|b|small|button|p)\b([^>]*)>/g;
  let mm;
  while((mm=re.exec(htmlStr))){
    const attrs={};
    const are=/([a-zA-Z-]+)(?:\s*=\s*"([^"]*)")?/g;
    let am;
    while((am=are.exec(mm[2]))){
      if(am[1]==='style'||am[1]==='title')continue;
      attrs[am[1]]=am[2]!==undefined?am[2]:'';
    }
    out.push(makeNode(mm[1],attrs));
  }
  return out;
}
function makeEl(id){
  const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,
    _cls:new Set(),isConnected:true,offsetWidth:0,offsetHeight:0,
    textContent:'',className:'',title:'',style:makeStyle()};
  el.classList={
    add:(...c)=>c.forEach(x=>el._cls.add(x)),
    remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
    contains:c=>el._cls.has(c),
    toggle:(c,f)=>{if(f===undefined){if(el._cls.has(c)){el._cls.delete(c);return false;}
      el._cls.add(c);return true;}
      if(f)el._cls.add(c);else el._cls.delete(c);return !!f;}
  };
  el.appendChild=c=>{el.children.push(c);return c;};
  el.insertBefore=c=>{el.children.unshift(c);return c;};
  Object.defineProperty(el,'className',{
    get(){return Array.from(el._cls).join(' ');},
    set(v){el._cls=new Set(v.split(/\s+/).filter(Boolean));}
  });
  el._h={};
  el.addEventListener=(t,fn)=>{(el._h[t]=el._h[t]||[]).push(fn);};
  el.removeEventListener=(t,fn)=>{el._h[t]=(el._h[t]||[]).filter(f=>f!==fn);};
  el.dispatchEvent=ev=>{(el._h[ev.type]=el._h[ev.type]||[]).forEach(f=>f(ev));};
  el.click=()=>el.dispatchEvent({type:'click',stopPropagation(){},preventDefault(){}});
  el.remove=()=>{};
  el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};
  el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];
  el.getContext=()=>ctx2d();
  /* parser por ATRIBUIÇÃO: cada innerHTML= recria os nós (como o DOM real) */
  let _html='',_cacheNodes=null;
  Object.defineProperty(el,'innerHTML',{
    get(){return _html;},
    set(v){_html=String(v);_cacheNodes=null;}
  });
  el.querySelectorAll=sel=>{
    if(!_cacheNodes)_cacheNodes=parseNodes(_html);
    return _cacheNodes.filter(n=>matchSel(n,sel));
  };
  el.querySelector=sel=>el.querySelectorAll(sel)[0]||null;
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
  _wl:{},
  addEventListener(t,fn){(this._wl[t]=this._wl[t]||[]).push(fn);},
  removeEventListener(){},
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


/* =====================================================================
   INTEGRAÇÃO DE UI — BINDINGS REAIS (§29/§30 do feedback)
   Os cliques abaixo são disparados nos NÓS criados a partir do innerHTML
   renderizado pelo jogo — se qualquer addEventListener quebrar, o teste
   falha. Nada chama função interna "no lugar" do clique.
   ===================================================================== */
function hasFailBox(t){
  return t.getEl('cx-body').children.some(c=>
    (Array.isArray(c._cls)?c._cls.indexOf('sbfail')>=0:
      !!(c._cls&&c._cls.has&&c._cls.has('sbfail'))));
}
ok('UI: fluxo COMPLETO do menu — abrir, operador, preset, onda, INICIAR TESTE',()=>{
  const U=bootGame();
  /* 1. abrir o Sandbox pelo botão do título (bind real do boot) */
  U.getEl('ov-sandbox').click();
  assert.strictEqual(U.getSandboxMode(),true,'menu sandbox abriu');
  assert.strictEqual(U.getEl('cx-title').textContent,'S A N D B O X');
  /* 2. selecionar operador (BULWARK) pelo card clicável */
  U.getEl('cx-body').querySelectorAll('[data-sbchar]')[2].click();
  assert.strictEqual(U.getSandboxCfg().char,2,'operador selecionado');
  /* 3. selecionar preset CRIT */
  U.getEl('cx-body').querySelectorAll('[data-sbpreset="crit"]')[0].click();
  assert.strictEqual(U.getSandboxCfg().preset,'crit','preset selecionado');
  /* 4. selecionar onda 5 */
  U.getEl('cx-body').querySelectorAll('[data-sbwave]')[2].click();
  assert.strictEqual(U.getSandboxCfg().wave,5,'onda selecionada');
  /* 5. clicar INICIAR TESTE (bind real do renderSandboxSetup) */
  const go=U.getEl('cx-body').querySelector('#sb-start');
  assert(go,'botão INICIAR TESTE existe');
  assert(go._cls.indexOf('dis')<0,'botão habilitado com cfg válida');
  go.click();
  /* 6. sandboxRun=true */
  assert.strictEqual(U.getSandboxRun(),true,'§6: sandboxRun=true');
  /* 7. a run realmente inicia */
  assert.strictEqual(U.getState(),'play','§7: game/run inicia');
  /* 8. player existe e é o operador escolhido */
  assert(U.getPlayer(),'§8: player existe');
  assert.strictEqual(U.getCharSel(),2,'player é o BULWARK');
  assert.strictEqual(U.getPlayer().maxSlots,5,'slots do operador respeitados');
  /* 9. wave correta + inimigos */
  assert.strictEqual(U.getWave(),5,'§9: run começa na onda 5');
  assert(U.getEnemies().length>0,'inimigos spawnaram');
  /* 10. preset aplicado */
  assert(U.getPlayer().items.length>0,'§10: preset CRIT aplicou módulos');
});
ok('UI: matrix COMPLETA 8 operadores × 7 presets × 6 ondas (336 starts)',()=>{
  const V=bootGame();
  const PRESETS=['','shieldbreak','fullshield','crit','status','dash','economy'];
  let n=0;
  for(let c=0;c<V.CHARS.length;c++){
    for(const pr of PRESETS){
      for(const wv of V.SB_WAVES){
        n++;
        V.sandboxExit(true);V.setState('title');
        V.sandboxOpenSetup();
        V.getSandboxCfg().char=c;V.getSandboxCfg().preset=pr;V.getSandboxCfg().wave=wv;
        assert.strictEqual(V.sandboxStart(),true,
          V.CHARS[c].id+' + '+pr+' + onda '+wv+' deve iniciar');
        assert.strictEqual(V.getSandboxRun(),true);
        assert.strictEqual(V.getState(),'play');
        assert(V.getPlayer(),'player criado');
        assert.strictEqual(V.getCharSel(),c,'operador ativo: '+V.CHARS[c].id);
        if(wv>1)assert.strictEqual(V.getWave(),wv,'onda correta');
        if(wv>=V.MAX_WAVE)assert(V.getBoss(),'chefe despachado na onda 20');
        else if(wv>1)assert(V.getEnemies().length>0,'inimigos na onda '+wv);
        if(pr)assert(V.getPlayer().items.length>0,'preset '+pr+' aplicou módulos');
      }
    }
  }
  assert.strictEqual(n,336,'336 combinações validadas');
});
ok('UI: §32/§33 — cfg inválida desabilita o botão COM MOTIVO e falha visível',()=>{
  const W=bootGame();
  W.sandboxOpenSetup();
  W.getSandboxCfg().char=99;               // operador inexistente
  W.sandboxCloseSetup();
  W.sandboxOpenSetup();                    // render com cfg inválida
  const go=W.getEl('cx-body').querySelector('#sb-start');
  assert(go._cls.indexOf('dis')>=0,'botão desabilitado (classe dis)');
  assert(W.getEl('cx-body').innerHTML.indexOf('OPERADOR INVÁLIDO')>=0,
    'motivo exibido no botão');
  assert.strictEqual(W.sandboxStart(),false,'sandboxStart recusa cfg inválida');
  assert.strictEqual(W.getState(),'title','não entra em run');
  assert(hasFailBox(W),'mensagem de falha inserida no codex (§33)');
  assert(W.getEl('cx-body').children.some(c=>
    (c.textContent||'').indexOf('OPERADOR INVÁLIDO')>=0),'motivo na mensagem');
});

/* =====================================================================
   §22–§25 — TODAS AS FUNÇÕES DO PAINEL F1 E SPAWNS (boot isolado por teste)
   ===================================================================== */
function openF1(t){
  t.sbPanelShow();
  return t.getPlayer();
}
ok('§22: F1 abre em run e exibe TODAS as seções (não parece DEV Inspector)',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  openF1(F);
  assert.strictEqual(F.getState(),'sandbox','tempo congelado');
  const h=F.getEl('sb-body').innerHTML;
  for(const sec of ['JOGADOR','ARSENAL','ITENS','ONDA','INIMIGOS','MINIBOSSES','CHEFE',
                    'AJUSTES DO JOGADOR'])
    assert(h.indexOf(sec)>=0,'seção ausente: '+sec);
});
ok('§22: adicionar arma por BINDING (data-sbw → slot livre §123)',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  const p=openF1(F);
  F.sbAction('clearars');
  const antes=F.countWeapons(p);
  F.sbPanelShow();
  const addBtn=F.getEl('sb-body').querySelectorAll('[data-sbadd]')[0];
  assert(addBtn,'slot vazio oferece + ADICIONAR');
  addBtn.click();                          // abre o catálogo de armas
  /* clicar na primeira arma do catálogo que o player AINDA não possui */
  const noivo=F.getEl('sb-body').querySelectorAll('[data-sbw]')
    .find(n=>p.owned.indexOf(parseInt(n.dataset.sbw,10))<0);
  assert(noivo,'catálogo tem arma nova disponível');
  noivo.click();
  assert.strictEqual(F.countWeapons(p),antes+1,'arma adicionada por clique real');
  F.sbPanelClose();
});
ok('§22: remover arma deixa SLOT VAZIO e grant preenche o buraco (§8)',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  const p=F.getPlayer();
  F.sbPanelShow();
  F.sandboxRemoveSlot(0);
  assert.strictEqual(p.owned[0],null,'slot 1 ficou vazio (buraco)');
  assert(F.grantWeapon(F.WEAPONS.length-1,true),'grant preenche buraco');
  assert.strictEqual(p.owned[0],F.WEAPONS.length-1,'nova arma no slot 1');
  F.sbPanelClose();
});
ok('§22: remover item por BINDING (✕), adicionar pelo catálogo e limpar build',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  const p=F.getPlayer();
  F.applyBuildPreset('crit',p);
  assert(p.items.length>0,'build com itens');
  const nItens=p.items.length;
  F.sbPanelShow();
  F.getEl('sb-body').querySelectorAll('[data-sbrmit]')[0].click();
  assert.strictEqual(p.items.length,nItens-1,'módulo removido por clique real');
  F.sbAction('pickitem');
  F.getEl('sb-body').querySelectorAll('[data-sbitem]')[0].click();
  assert.strictEqual(p.items.length,nItens,'módulo adicionado pelo catálogo');
  F.sbAction('clearbuild');
  assert.strictEqual(p.items.length,0,'LIMPAR BUILD esvaziou');
  F.sbPanelClose();
});
ok('§22: preset por BINDING + heal + shield fill + grupo + limpar arena',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  const p=F.getPlayer();
  p.hp=1;p.shield=0;
  F.sbPanelShow();
  F.getEl('sb-body').querySelectorAll('[data-sbpreset]')[0].click();
  assert(p.items.length>0,'preset aplicado por clique real');
  F.sbAction('fullhp');assert.strictEqual(p.hp,p.maxHp,'heal');
  F.sbAction('fullsh');assert.strictEqual(p.shield,p.shieldMax,'shield fill');
  F.sbAction('group');
  assert(F.getEnemies().length>0,'grupo gerado');
  F.sbAction('clear');
  assert.strictEqual(F.getEnemies().length,0,'arena limpa');
  F.sbPanelClose();
});
ok('§13: CRÉDITOS — ±10/±100/MAX funcionam (só na sessão sandbox)',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  const p=F.getPlayer();
  p.coins=500;
  F.sbPanelShow();
  F.sbAction('crd+100');assert.strictEqual(p.coins,600);
  F.sbAction('crd-10');assert.strictEqual(p.coins,590);
  F.sbAction('crd-100');assert.strictEqual(p.coins,490);
  F.sbAction('crdmax');assert.strictEqual(p.coins,9999,'MAX 9999 (economia)');
  F.sbPanelClose();
});
ok('§14: HP — encher, +25, dano e SET 1 (sem NaN/negativo)',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  const p=F.getPlayer();
  F.sbPanelShow();
  p.hp=10;F.sbAction('hp+25');
  assert.strictEqual(p.hp,35,'+25 HP');
  F.sbAction('hp-25');assert.strictEqual(p.hp,10,'dano −25');
  F.sbAction('hp-25');F.sbAction('hp-25');
  assert(p.hp>=1,'nunca negativo (clamp 1)');
  F.sbAction('hp1');assert.strictEqual(p.hp,1,'SET 1 (clutch)');
  F.sbAction('fullhp');assert.strictEqual(p.hp,p.maxHp);
  F.sbPanelClose();
});
ok('§15: QUEBRAR ESCUDO dispara o PIPELINE REAL (hook onShieldBreak da PR 11)',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  const p=F.getPlayer();
  const pulso=F.ITEMS.find(i=>i.id==='sb_pulso');
  assert(pulso,'item sb_pulso existe (PR 11, hook onShieldBreak)');
  F.grantItemInternal(p,pulso,true);
  p.shield=p.shieldMax;
  F.sbPanelShow();
  F.sbAction('breaksh');                   // QUEBRAR (PIPELINE REAL)
  assert.strictEqual(p.shield,0,'escudo zerado');
  assert(p.itemState&&p.itemState['sb_pulso']&&p.itemState['sb_pulso'].cd>0,
    'HOOK REAL disparou: PULSO DE FRATURA entrou em cooldown (itemState.cd)');
  F.sbAction('sh+10');assert(p.shield>0,'SET +10 funciona');
  F.sbAction('sh-10');assert.strictEqual(p.shield,0,'SET −10 funciona');
  F.sbPanelClose();
});
ok('§16: DANO/CRIT/VEL/SH.MAX/REGEN via Stat Modifier Pipeline (source sandbox:*)',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  const p=F.getPlayer();
  F.sbPanelShow();
  const d0=p.dmgMul,c0=p.crit,s0=p.speed,m0=p.shieldMax,g0=p.shieldRegen;
  F.sbAction('mod:damage:1');
  assert.strictEqual(p.sm.filter(x=>x.id==='sandbox:damage').length,1,
    'mod com source id sandbox:damage');
  assert(p.dmgMul>d0,'dano subiu via pipeline');
  F.sbAction('mod:damage:1');F.sbAction('mod:damage:1');
  assert(p.dmgMul>d0*1.1,'+10% acumula (×1.1²)');
  F.sbAction('mod:damage:-1');
  F.sbAction('mod:crit:1');
  assert(p.crit>c0,'crítico subiu (+5% flat)');
  F.sbAction('mod:speed:1');
  assert(p.speed>s0,'velocidade subiu');
  F.sbAction('mod:shieldMax:1');
  assert(p.shieldMax>m0,'shieldMax subiu (+10)');
  F.sbAction('mod:shieldRegen:1');
  assert(p.shieldRegen>g0,'shieldRegen subiu (+1)');
  F.sbPanelClose();
});
ok('§17: RESETAR AJUSTES remove SOMENTE mods sandbox (itens ficam)',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  const p=F.getPlayer();
  F.applyBuildPreset('crit',p);            // garante mods de item presentes
  F.sbPanelShow();
  F.sbAction('mod:damage:1');F.sbAction('mod:crit:1');
  assert(p.sm.some(x=>x.id.indexOf('sandbox:')===0),'há mods sandbox agora');
  const itemModsAntes=p.sm.filter(x=>x.id.indexOf('item.')===0).length;
  F.sbAction('resetmods');
  assert(p.sm.every(x=>x.id.indexOf('sandbox:')<0),'nenhum mod sandbox restou');
  assert.strictEqual(p.sm.filter(x=>x.id.indexOf('item.')===0).length,itemModsAntes,
    'mods de ITENS preservados');
  F.sbAction('mod:crit:1');
  assert(p.sm.some(x=>x.id==='sandbox:crit'),'mod volta a aplicar após reset');
  F.sbPanelClose();
});
ok('§23: spawn de TODOS os 11 tipos de inimigo (objeto válido + HP)',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  F.sandboxJumpTo(3);
  F.sbPanelShow();
  for(const t of F.SB_ETYPES){
    F.getEl('sb-body').querySelectorAll('[data-sbspawn="'+t+'"]')[0].click();
    const e=F.getEnemies().filter(x=>x.type===t);
    assert(e.length>0,'spawnou '+t);
    const last=e[e.length-1];
    assert(last.hp>0&&isFinite(last.hp),t+' com HP válido');
    assert(last.r>0&&isFinite(last.x),'struct válida');
  }
  F.sbAction('clear');
  F.sbPanelClose();
});
ok('§24: spawn de TODOS os 8 minibosses (nenhum no-op/erro)',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  F.sbPanelShow();
  for(const mb of F.MINIBOSS){
    F.getEl('sb-body').querySelectorAll('[data-sbmini="'+mb.id+'"]')[0].click();
    const e=F.getEnemies().filter(x=>x.type==='miniboss'&&x.mb&&x.mb.id===mb.id);
    assert(e.length>0,'miniboss '+mb.id+' spawnou');
    assert(e[e.length-1].hp>0,'miniboss '+mb.id+' com HP válido');
  }
  F.sbAction('clear');
  F.sbPanelClose();
});
ok('§25: spawn do BOSS (O PARADOXO) por ação do painel',()=>{
  const F=bootGame();
  realSlot(F);
  F.getSandboxCfg().char=0;F.sandboxStart();
  F.sandboxJumpTo(5);
  F.sbPanelShow();
  F.sbAction('boss');
  assert(F.getBoss(),'O PARADOXO entrou na arena');
  F.sbAction('clear');
  F.sbPanelClose();
});
ok('§26: os 6 presets aplicam itens, stats recalculam e o player joga',()=>{
  const V2=bootGame();
  for(const k of ['shieldbreak','fullshield','crit','status','dash','economy']){
    V2.sandboxExit(true);V2.setState('title');
    V2.sandboxOpenSetup();
    V2.getSandboxCfg().char=3;V2.getSandboxCfg().preset=k;V2.getSandboxCfg().wave=3;
    assert.strictEqual(V2.sandboxStart(),true,k+' inicia');
    const p=V2.getPlayer();
    assert(p.hp>0&&isFinite(p.hp),k+': HP válido');
    assert(p.items.length>0,k+': itens instalados');
    assert(Array.isArray(p.sm)&&p.sm.every(x=>x&&x.id),k+': sem referência undefined');
    assert(p.owned.length>=2,k+': arsenal ok');
    assert.strictEqual(V2.getState(),'play',k+': jogando');
  }
});
ok('§28: cada onda do menu inicia na wave certa (1,3,5,10,15,20/CHEFE)',()=>{
  const V3=bootGame();
  for(const wv of V3.SB_WAVES){
    V3.sandboxExit(true);V3.setState('title');
    V3.sandboxOpenSetup();
    V3.getSandboxCfg().char=0;V3.getSandboxCfg().preset='';V3.getSandboxCfg().wave=wv;
    V3.sandboxStart();
    assert.strictEqual(V3.getWave(),wv===1?0:wv,'onda '+wv+' correta');
    if(wv>=V3.MAX_WAVE)assert(V3.getBoss(),'20 = CHEFE realmente acionado');
    V3.sandboxExit(true);
  }
});
ok('§27: todos os operadores iniciam (makePlayer/slots/armas/F1)',()=>{
  const V4=bootGame();
  for(let c=0;c<V4.CHARS.length;c++){
    V4.sandboxExit(true);V4.setState('title');
    V4.sandboxOpenSetup();
    V4.getSandboxCfg().char=c;V4.getSandboxCfg().preset='crit';V4.getSandboxCfg().wave=1;
    assert.strictEqual(V4.sandboxStart(),true,V4.CHARS[c].id+' inicia');
    const p=V4.getPlayer();
    assert.strictEqual(p.maxSlots,V4.CHARS[c].slots,V4.CHARS[c].id+': slots');
    assert.strictEqual(p.owned.length,V4.CHARS[c].guns.length,
      V4.CHARS[c].id+': armas iniciais');
    V4.sbPanelShow();
    assert.strictEqual(V4.getState(),'sandbox',V4.CHARS[c].id+': F1 abre');
    assert(V4.getEl('sb-body').innerHTML.indexOf('ARSENAL')>=0);
    V4.sbPanelClose();
    V4.sandboxExit(true);
  }
});
ok('§11: morte no sandbox — 3 opções claras + VOLTAR AO MENU PRINCIPAL funciona',()=>{
  const V5=bootGame();
  const r=realSlot(V5);
  V5.getSandboxCfg().char=1;V5.sandboxStart();
  V5.onPlayerDeath();
  assert.strictEqual(T_esc(V5),'TESTE ENCERRADO');
  assert.strictEqual(V5.getEl('ov-go').textContent,'REINICIAR TESTE');
  assert.strictEqual(V5.getEl('ov-back').textContent,'ALTERAR BUILD');
  const om=V5.getEl('ov-exitmenu');
  assert(om,'botão VOLTAR AO MENU PRINCIPAL existe');
  assert.strictEqual(om.style.display,'','botão visível na morte sandbox');
  /* o rótulo é estático no HTML do overlay — validado contra o fonte */
  assert(html.indexOf('⌂ VOLTAR AO MENU PRINCIPAL')>=0,
    'rótulo VOLTAR AO MENU PRINCIPAL no overlay');
  om.click();                              // clique REAL no binding do boot
  assert.strictEqual(V5.getSandboxRun(),false,'estado sandbox limpo');
  assert.strictEqual(V5.sandboxActive(),false);
  assert.strictEqual(V5.getState(),'title','voltou ao Main Menu');
  assert.strictEqual(V5.getEchoQueue()[0],r.marker,'nenhum Echo criado — fila real');
  assert.strictEqual(V5.getSmRoot().slots[1].char,3,'progressão intacta');
});
ok('§11: vitória no sandbox também oferece VOLTAR AO MENU PRINCIPAL',()=>{
  const V6=bootGame();
  realSlot(V6);
  V6.getSandboxCfg().char=0;V6.sandboxStart();
  V6.sandboxJumpTo(20);V6.onVictory();
  assert.strictEqual(T_esc(V6),'TESTE CONCLUÍDO');
  assert.strictEqual(V6.getEl('ov-exitmenu').style.display,'');
  V6.getEl('ov-exitmenu').click();
  assert.strictEqual(V6.getState(),'title');
  assert.strictEqual(V6.getSandboxRun(),false);
});
ok('§18: SAIR do sandbox remove TODOS os ajustes (mods sandbox não vazam)',()=>{
  const V7=bootGame();
  realSlot(V7);
  V7.getSandboxCfg().char=0;V7.sandboxStart();
  const p=V7.getPlayer();
  V7.sbPanelShow();
  V7.sbAction('mod:damage:1');V7.sbAction('mod:crit:1');V7.sbAction('mod:speed:1');
  assert(p.sm.some(x=>x.id.indexOf('sandbox:')===0));
  V7.sandboxExit(true);
  assert.strictEqual(p.sm.filter(x=>x.id.indexOf('sandbox:')===0).length,0,
    'nenhum mod sandbox no player descartado');
  assert.strictEqual(p._sbMods,null,'estado de ajustes zerado');
});
ok('§21: créditos manipuláveis no sandbox mesmo sem loja (documentado)',()=>{
  const V8=bootGame();
  V8.sandboxExit(true);V8.setState('title');
  V8.sandboxOpenSetup();
  V8.getSandboxCfg().char=0;V8.sandboxStart();
  const p=V8.getPlayer();
  assert(p.coins>=500,'crédito inicial do laboratório');
  const c0=p.coins;
  p.coins=c0+5000;
  assert.strictEqual(p.coins,c0+5000,'créditos manipuláveis p/ testes de economia');
  V8.sandboxExit(true);
});

ok('UI: REINICIAR TESTE (ov-go) responde a CLIQUE real (não só Enter)',()=>{
  const V9=bootGame();
  realSlot(V9);
  V9.getSandboxCfg().char=0;V9.sandboxStart();
  V9.onPlayerDeath();
  assert.strictEqual(T_esc(V9),'TESTE ENCERRADO');
  const go=V9.getEl('ov-go');
  assert(Array.isArray(go._h.click)&&go._h.click.length>0,
    'ov-go tem handler de click bindado');
  go.click();
  assert.strictEqual(V9.getState(),'play','clique reiniciou o teste');
  assert.strictEqual(V9.getSandboxRun(),true);
});
ok('UI: estrutura — rodapé da ficha documenta ESC cancela / TAB abre-fecha',()=>{
  assert(html.indexOf('ARSENAL: CLIQUE EM 2 SLOTS PARA TROCAR')>=0);
  assert(html.indexOf('ES CANCELA')>=0||html.indexOf('ESC — CANCELA')>=0||
         html.indexOf('CANCELA SELEÇÃO')>=0);
});

/* =====================================================================
   R3 — BACKDROP, ISOLAMENTO ABSOLUTO E F1 (feedback rodada 3)
   ===================================================================== */
ok('R3§1/§2: clique FORA do painel (backdrop) NÃO fecha o Sandbox',()=>{
  const B=bootGame();
  B.getEl('ov-sandbox').click();               // abre o preparo
  B.getEl('cx-body').querySelectorAll('[data-sbchar="2"]')[0].click();
  B.getEl('cx-body').querySelectorAll('[data-sbpreset="crit"]')[0].click();
  B.getEl('cx-body').querySelectorAll('[data-sbwave="10"]')[0].click();
  assert.strictEqual(B.getSandboxMode(),true);
  assert.strictEqual(B.getState(),'title');
  /* clique real no BACKDROP (target === codexEl) */
  B.getEl('codex').dispatchEvent({type:'click',target:B.getEl('codex'),
    stopPropagation(){},preventDefault(){}});
  assert.strictEqual(B.getSandboxMode(),true,'continua no Sandbox');
  assert.strictEqual(B.getState(),'title','state não mudou');
  assert.strictEqual(B.getSandboxCfg().char,2,'config preservada');
  assert.strictEqual(B.getSandboxCfg().preset,'crit','preset preservado');
  assert.strictEqual(B.getSandboxCfg().wave,10,'onda preservada');
  const go=B.getEl('cx-body').querySelector('#sb-start');
  assert(go&&go._cls.indexOf('dis')<0,'INICIAR continua disponível');
  /* múltiplos cliques no backdrop continuam inertes */
  B.getEl('codex').dispatchEvent({type:'click',target:B.getEl('codex'),
    stopPropagation(){},preventDefault(){}});
  assert.strictEqual(B.getSandboxMode(),true,'seguir no Sandbox');
});
ok('R3§1: VOLTAR AO MENU (cx-close) é a única saída clicável e funciona',()=>{
  const B=bootGame();
  B.getEl('ov-sandbox').click();
  assert.strictEqual(B.getSandboxMode(),true);
  B.getEl('cx-close').click();
  assert.strictEqual(B.getSandboxMode(),false,'preparo encerrado');
  assert.strictEqual(B.getState(),'title');
  assert.strictEqual(B.getEl('ov-title').textContent,'E C H O',
    'menu inicial de volta (overlay coerente)');
});
ok('R3§20: ESC no preparo sai para o menu (regra intencional e consistente)',()=>{
  const B=bootGame();
  B.getEl('ov-sandbox').click();
  assert.strictEqual(B.getSandboxMode(),true);
  B.onGameEsc();
  assert.strictEqual(B.getSandboxMode(),false);
  assert.strictEqual(B.getState(),'title');
});

/* ---- §7/§8: BYTE-FOR-BYTE nos 3 SAVE SLOTS ---- */
/* forja um save com 3 slots distintos; slot 1 com prog.kills=99999 para
   PROVAR que o showTitle pós-sandbox NÃO desbloqueia nada pendente */
function forge3Slots(b){
  /* forja DEPOIS do activateSlot, direto no smRoot EM MEMÓRIA — assim
     memória e localStorage nascem consistentes e nenhum commit fora do
     sandbox desfaz a forja (activateSlot não é mais chamado). */
  b.activateSlot(1);                            // slot 1 real (PYRE)
  b.setChar(3);
  const root=b.getSmRoot();
  root.slots[1].prog.kills=400;    // w_beam(250)/u_pierce(400) PENDENTES;
                                   // revenant(2000)/luneta(500) ainda locked
  root.slots[2]={touched:true,char:6,           // slot 2: HARDEN
    meta:{mem:111,spd:1,reroll:0,vault:0,wins:2,endings:[],evars:[]},
    prog:{kills:500,runs:3,waves:20,best:9,wins:1,bosses:1,minis:1,
      elites:3,crits:9,dashes:9,coins:9,items:9,events:9,echoKills:9,
      reso:9,melee:9,status:9,seen:[]},
    echoes:[{marker:'slot2-echo'}],run:null};
  root.slots[3]={touched:true,char:7,           // slot 3: REVENANT
    meta:{mem:222,spd:2,reroll:1,vault:1,wins:5,endings:[],evars:[]},
    prog:{kills:2000,runs:9,waves:80,best:15,wins:3,bosses:2,minis:2,
      elites:9,crits:9,dashes:9,coins:9,items:9,events:9,echoKills:9,
      reso:9,melee:9,status:9,seen:['c_revenant']},
    echoes:[{marker:'slot3-echo'}],run:null};
  root.lastSlot=1;
  b.getLS().setItem('echoSave.v3',JSON.stringify(root)); // commit manual
  if(b.getProg()&&b.getProg().kills===0)b.getProg().kills=400; // espelho vivo
}
const Z=bootGame();
forge3Slots(Z);
const SNAPSHOT=Z.getLS().getItem('echoSave.v3');
ok('R3§6: unlock é SOBREPOSIÇÃO — locked vira disponível sem gravar',()=>{
  /* antes: locked de verdade (condições de unlock ainda não cumpridas) */
  Z.activateSlot(1);
  assert.strictEqual(Z.isCharUnlocked('revenant'),false,'fora do sandbox é locked');
  assert.strictEqual(Z.isWeaponUnlocked('void'),false);
  assert.strictEqual(Z.isItemUnlocked('luneta'),false);
  assert.strictEqual(Z.getProg().seen.indexOf('w_beam'),-1,
    'pendentes ainda não foram gravados fora');
  Z.sandboxOpenSetup();                          // ENTRAR no sandbox
  assert.strictEqual(Z.isCharUnlocked('revenant'),true,'§76 dentro: disponível');
  assert.strictEqual(Z.isWeaponUnlocked('void'),true);
  assert.strictEqual(Z.isItemUnlocked('luneta'),true);
  assert.strictEqual(Z.getProg().seen.indexOf('w_beam'),-1,
    'NADA foi gravado em prog.seen (§5)');
});
ok('R3§7/§8: sessão COMPLETA deixa os 3 slots BYTE A BYTE idênticos',()=>{
  Z.getSandboxCfg().char=7;                      // REVENANT (locked!)
  Z.getSandboxCfg().preset='crit';
  Z.getSandboxCfg().wave=1;
  assert.strictEqual(Z.sandboxStart(),true);
  const p=Z.getPlayer();
  /* usa conteúdo BLOQUEADO */
  const voidWi=Z.WEAPONS.findIndex(w=>w.id==='void');
  assert.strictEqual(Z.grantWeapon(voidWi,true),true,'arma locked usada no teste');
  const luneta=Z.itemById('luneta');
  assert(Z.grantItemInternal(p,luneta,true),'item locked adicionado');
  /* spawn de boss + ajustes de stats */
  Z.sbPanelShow();
  Z.sandboxJumpTo(20);
  Z.sbAction('boss');
  Z.sbAction('mod:damage:1');Z.sbAction('mod:crit:1');
  Z.sbAction('breaksh');
  Z.sbPanelClose();
  /* vitória no laboratório */
  Z.onVictory();
  assert.strictEqual(Z.getState(),'victory');
  /* reinicia e MORRE no laboratório */
  Z.sandboxRestart();
  Z.onPlayerDeath();
  assert.strictEqual(Z.getState(),'fracture');
  /* sai para o menu — showTitle roda checkUnlocks(true): SUPRIMIDO */
  Z.sandboxExit(true);
  /* ===== comparação byte a byte ===== */
  assert.strictEqual(Z.getLS().getItem('echoSave.v3'),SNAPSHOT,
    'echoSave.v3 (os 3 slots) BYTE A BYTE idêntico');
  /* memória interna dos 3 slots também */
  const s=Z.getSmRoot().slots;
  assert.strictEqual(s[1].prog.kills,400,'slot1: prog intocado');
  assert.strictEqual(s[2].char,6,'slot2: operador intocado');
  assert.strictEqual(s[2].prog.kills,500,'slot2: prog intocado');
  assert.strictEqual(s[3].char,7,'slot3: operador intocado');
  assert.strictEqual(JSON.stringify(s[2].echoes),'[{"marker":"slot2-echo"}]',
    'slot2: Ecos intactos');
  assert.strictEqual(JSON.stringify(s[3].echoes),'[{"marker":"slot3-echo"}]',
    'slot3: Ecos intactos');
  assert.strictEqual(s[2].meta.mem,111,'slot2: meta intocada');
  assert.strictEqual(s[3].meta.mem,222,'slot3: meta intocada');
});
ok('R3§3: nem morte, nem vitória, nem saída desbloqueiam (janela pós-sandbox)',()=>{
  assert.strictEqual(Z.checkUnlocks(),false,'checkUnlocks suprimido');
  assert.strictEqual(Z.getProg().seen.length,0,
    'prog.seen vazio — w_beam/u_pierce pendentes NÃO gravados');
  assert.strictEqual(Z.getSmRoot().slots[1].prog.seen.length,0,
    'nada no slot persistido');
  /* showTitle de novo (como o jogador veria): ainda suprimido */
  Z.showTitle();
  assert.strictEqual(Z.getLS().getItem('echoSave.v3'),SNAPSHOT,
    'showTitle pós-sandbox NÃO grava desbloqueio pendente');
  assert.strictEqual(Z.isCharUnlocked('revenant'),false,'fora do sandbox volta a locked');
  assert.strictEqual(Z.isWeaponUnlocked('void'),false);
  assert.strictEqual(Z.isItemUnlocked('luneta'),false);
  assert.strictEqual(Z.getSbHold(),true,'janela ativa até run real');
});
ok('R3§3: a janela só é liberada por uma run REAL (sem quebrar o jogo normal)',()=>{
  Z.setState('title');
  Z.startRun();                                  // run real
  assert.strictEqual(Z.getSbHold(),false,'janela liberada por run real');
  /* morte real: fluxo normal do jogo pode registrar (comportamento padrão) */
  Z.onPlayerDeath();
  assert(Z.getProg().seen.indexOf('w_beam')>=0,
    'run real death → unlock pendente legítimo (w_beam, 250 kills)');
  assert(Z.getProg().seen.indexOf('u_pierce')>=0,
    'u_pierce (400 kills) também merecido pela run real');
  assert.strictEqual(Z.getProg().seen.indexOf('i_luneta'),-1,
    'luneta (500 kills) NÃO merecida: continua locked');
  assert.notStrictEqual(Z.getLS().getItem('echoSave.v3'),SNAPSHOT,
    'a partir da run REAL o save evolui normalmente');
});

/* ---- §10–§17: F1 E HUD SÓ NO SANDBOX ---- */
ok('R3§17: run normal — F1 NÃO faz nada e chip SANDBOX não aparece',()=>{
  const R=bootGame();
  R.setState('title');R.startRun();              // run NORMAL (sem sandbox)
  assert.strictEqual(R.getState(),'play');
  assert.strictEqual(R.getEl('sb-chip').classList.contains('on'),false,
    'chip invisível (classe on ausente)');
  R.pressKey('F1');
  assert.strictEqual(R.getState(),'play','state não mudou');
  assert.strictEqual(R.getSbPanelOpen(),false,'painel NÃO abriu');
  R.sbPanelShow();                               // API direta também é barrada
  assert.strictEqual(R.getSbPanelOpen(),false,'sbPanelCanOpen=false fora do sandbox');
});
ok('R3§10/§13: no Sandbox o F1 aparece e funciona',()=>{
  const R2=bootGame();
  R2.sandboxExit(true);R2.setState('title');
  R2.sandboxOpenSetup();
  R2.getSandboxCfg().char=0;R2.sandboxStart();
  assert.strictEqual(R2.getEl('sb-chip').classList.contains('on'),true,
    'chip SANDBOX · [F1] LABORATÓRIO visível só com sandboxRun');
  R2.pressKey('F1');
  assert.strictEqual(R2.getSbPanelOpen(),true,'F1 abre o painel');
  assert.strictEqual(R2.getState(),'sandbox');
  R2.pressKey('F1');
  assert.strictEqual(R2.getSbPanelOpen(),false,'F1 fecha');
});
ok('R3§15/§16: Sandbox → sair → run NORMAL fica 100% limpa',()=>{
  const R3=bootGame();
  R3.sandboxExit(true);R3.setState('title');
  R3.sandboxOpenSetup();
  R3.getSandboxCfg().char=0;R3.sandboxStart();
  const sb=R3.getPlayer();
  R3.sbPanelShow();
  R3.sbAction('mod:damage:1');R3.sbAction('mod:speed:1');
  assert(sb.sm.some(x=>x.id.indexOf('sandbox:')===0),'mods sandbox ativos');
  R3.sandboxExit(true);                          // sai para o menu
  assert.strictEqual(R3.getSandboxRun(),false,'§14: sandboxRun=false');
  assert.strictEqual(R3.getEl('sb-chip').classList.contains('on'),false,
    'chip some');
  /* run NORMAL nova */
  R3.setState('title');R3.startRun();
  const p=R3.getPlayer();
  assert.strictEqual(R3.getSandboxRun(),false);
  assert.strictEqual(R3.getSmCommit()(),true,'smCommit grava de novo (fora do sandbox)');
  R3.pressKey('F1');
  assert.strictEqual(R3.getSbPanelOpen(),false,'F1 inativo na run normal');
  assert.strictEqual(R3.getEl('sb-chip').classList.contains('on'),false);
  assert(p.sm.every(x=>x.id.indexOf('sandbox:')<0),'stats normais (sem mods)');
  assert(p._sbMods==null,'estado de ajustes zerado (player novo)');
  assert(p.dmgMul===1||p.dmgMul===p._smBase.dmg,'dano base do operador');
  /* unlocks reais intactos e conteúdo continua locked */
  assert.strictEqual(R3.isCharUnlocked('revenant'),false);
  assert.strictEqual(R3.isWeaponUnlocked('beam'),false);
  assert.strictEqual(R3.getSmRoot().slots[1].prog.seen.indexOf('w_beam'),-1);
});

console.log('---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('\nFALHAS DETECTADAS');process.exit(1);}
