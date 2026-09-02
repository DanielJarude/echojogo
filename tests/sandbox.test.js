'use strict';
/* =====================================================================
   TESTES — SANDBOX: LABORATÓRIO DO JOGADOR COM ISOLAMENTO TOTAL (PR 11.5)
   ---------------------------------------------------------------------
   §73–§92:
   · isolamento (§73): saveProg/saveMeta/saveEchoes/bumpProg/checkUnlocks/
     captureCheckpoint são no-op com o laboratório ativo — o arquivo do
     save no localStorage fica BYTE A BYTE idêntico;
   · R5: ZERO participação na progressão — prog/meta/fila/charSel/curSlot/
     activeRun idênticos (deep) antes/durante/depois, em memória e arquivo;
     sessão completa roda com a progressão real deep-frozen;
   · R5: is*Unlocked PUROS (nenhum override); catálogos próprios
     (sandboxGetOperators/Weapons/Items/Upgrades); seleção por
     sandboxContext.operatorId; setChar nunca é chamado no laboratório;
   · morte (§89) roteia para TESTE ENCERRADO sem criar Echo;
   · vitória (§90) roteia para TESTE CONCLUÍDO sem registrar final;
   · restart (§88) reinicia o MESMO setup do contexto; exit (§87) não
     restaura nada (o real nunca saiu do lugar);
   · R5: INICIAR do título funciona indefinidamente (20 ciclos com
     clique real + interleave com o Sandbox);
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
  'sandboxGetOperators,sandboxGetWeapons,sandboxGetItems,sandboxGetUpgrades,'+
  'sandboxOperator,getEchoes:()=>echoes,'+
  'sandboxRestart,sandboxDeath,sandboxVictory,sandboxEndToSetup,sandboxRestoreReal,'+
  'sandboxJumpTo,sandboxClearEnemies,sandboxClearRunState,'+
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
  'getSandboxCfg:()=>sandboxCfg,getSandboxContext:()=>sandboxContext,'+
  'getSbPendingWi:()=>sbPendingWi,sandboxSessionInfo,'+
  'pickSlot,showSlotMenu,renderSlotSelect,showSlotSelect,ovMenuVisible,'+
  'refreshTitleChar,activateSlot,smBoot,'+
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
  'onGameEsc,'+
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
function mkEcho(mk){
  /* registro válido para smSanitizeSlot (trail.length>4, sem dev) */
  return {v:2,dur:12.34,dmgMul:1,frMul:1,wave:7,level:9,crit:.05,critMul:1.8,
    pierce:0,aoeMul:1,rangeMul:1,projSpdMul:1,longRangeBonus:0,
    coins:120,items:[],upg:[],owned:[0,1],moral:{comp:1,greed:0,viol:0},
    dom:'comp',k:0,mh:100,st:null,ps:null,trail:
      [[0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[4,4,4,4,4],[5,5,5,5,5]],
    marker:mk};
}
function realSlot(t){
  t.activateSlot(1);
  unlock(t,[CHKEY.pyre,CHKEY.bulwark,CHKEY.nomad,CHKEY.revenant]);
  t.setChar(3);                          // PYRE — persistido no slot real
  const marker=mkEcho('eco-real-1');marker.kills=111; // slim grava k=kills
  const marker2=mkEcho('eco-real-2');marker2.kills=222;
  t.setEchoQueue([marker,marker2]);
  t.saveEchoes();                        // persiste no arquivo (save real)
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
ok('R5§4: is*Unlocked continuam PUROS dentro do preparo (sem override)',()=>{
  /* R5: o sandbox NÃO engana o sistema real — a disponibilidade no preparo
     vem do CATÁLOGO PRÓPRIO (sandboxGetOperators), nunca de is*Unlocked. */
  assert.strictEqual(T.isCharUnlocked('revenant'),false);
  assert.strictEqual(T.isCharUnlocked('nomad'),false);
  assert.strictEqual(T.isCharUnlocked('bulwark'),false);
  assert.strictEqual(T.isWeaponUnlocked('beam'),false);
  assert.strictEqual(T.isWeaponUnlocked('rail'),false);
  assert.strictEqual(T.isWeaponUnlocked('void'),false);
  assert.strictEqual(T.isItemUnlocked('rebob'),false);   // i_rebob gated
  assert.strictEqual(T.isUpgUnlocked('pierce'),false);   // u_pierce gated
});
ok('R5§2: catálogo PRÓPRIO do sandbox devolve TODO o conteúdo sem unlock',()=>{
  assert.strictEqual(T.sandboxGetOperators().length,T.CHARS.length,
    'todos os operadores existentes');
  assert.strictEqual(T.sandboxGetWeapons().length,T.WEAPONS.length,
    'todas as armas existentes');
  assert(T.sandboxGetItems().length>0,'itens do catálogo');
  assert(T.sandboxGetUpgrades().length>0,'upgrades do catálogo');
  /* catálogo NÃO consulta unlock: contém conteúdo locked (T está limpo) */
  assert(T.sandboxGetWeapons().some(wi=>T.WEAPONS[wi].id==='void'),
    'arma locked presente no catálogo');
  assert(T.sandboxGetOperators().some(c=>c.id==='revenant'),
    'operador locked presente no catálogo');
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
const QUEUE_BEFORE=JSON.stringify(S.getEchoQueue());
ok('R5§12/§22: openSetup NÃO TOCA em NENHUM global real (nem em memória)',()=>{
  const before=JSON.stringify({p:S.getProg(),m:S.getMeta(),q:S.getEchoQueue(),
    cs:S.getCharSel(),sl:S.getCurSlot(),ar:S.hasActiveRun()});
  S.sandboxOpenSetup();
  const after=JSON.stringify({p:S.getProg(),m:S.getMeta(),q:S.getEchoQueue(),
    cs:S.getCharSel(),sl:S.getCurSlot(),ar:S.hasActiveRun()});
  assert.strictEqual(after,before,
    'prog/meta/echoQueue/charSel/curSlot/activeRun intocados ao abrir');
  assert.strictEqual(S.getSandboxMode(),true,'modo laboratório ligado');
  assert.strictEqual(S.getCurSlot(),1,'R5§22: curSlot NUNCA sai do save real');
  assert.strictEqual(S.getSmRoot().lastSlot,1,'lastSlot do arquivo intacto');
  assert.strictEqual(S.getSandboxCfg().char,0,'setup começa no VECTOR (contexto)');
});
ok('R5§13: sandboxContext é próprio — operatorId separado de charSel/slot',()=>{
  S.getSandboxCfg().char=7;                        // REVENANT no contexto
  assert.strictEqual(S.getSandboxContext().operatorId,'revenant');
  assert.strictEqual(S.getCharSel(),3,'charSel do save NÃO acompanhou');
  S.getSandboxCfg().char=2;                        // BULWARK para a run
});
ok('§75/R5: sandboxStart cria a run do CONTEXTO sem tocar slot/fila/charSel',()=>{
  S.sandboxStart();
  assert.strictEqual(S.getSandboxRun(),true);
  assert.strictEqual(S.getSandboxMode(),false);
  assert.strictEqual(S.getState(),'play');
  assert.strictEqual(S.getCurSlot(),1,'R5§22: curSlot continua o save real');
  assert.strictEqual(JSON.stringify(S.getEchoQueue()),QUEUE_BEFORE,
    'fila real de Ecos INTACTA (não zerada, não usada)');
  assert.strictEqual(JSON.stringify(S.getEchoes()),'[]',
    'a RUN do laboratório não nasce com Ecos reais');
  assert.strictEqual(S.getPlayer().charId,'bulwark','player nasce do contexto');
});
ok('§75/R5: operador do laboratório vem do contexto — charSel intocado',()=>{
  assert.strictEqual(S.getCharSel(),3,'charSel continua o do Save 1 (PYRE)');
  assert(S.getPlayer(),'player criado');
  assert.strictEqual(S.getPlayer().maxSlots,5,'slots do BULWARK (conteúdo total)');
});
ok('§73/R5: iniciar sandbox NÃO grava nada no save (byte a byte)',()=>{
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE);
  assert.strictEqual(S.getSmRoot().slots[1].char,3,'slot real continua PYRE');
});
ok('§77: crédito de teste +500 coins concedido (só no sandbox)',()=>{
  assert(S.getPlayer().coins>=500,'coins iniciais do laboratório ausentes');
  assert.strictEqual(S.getEchoQueue().length,2,'fila REAL segue intacta');
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
  S.getProg().kills=0;   // restaura o fixture (a mutação era só p/ need())
});
ok('§91: captureCheckpoint é no-op — laboratório não cria Continue Run',()=>{
  assert.strictEqual(S.captureCheckpoint('teste',9),false);
  assert.strictEqual(S.hasActiveRun(),false);
});
ok('§73: o ARQUIVO do save permanece idêntico após toda a run',()=>{
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE);
});
ok('R5§4: durante a run is*Unlocked seguem PUROS (nada é "enganado")',()=>{
  assert.strictEqual(S.isWeaponUnlocked('beam'),false);
  assert.strictEqual(S.isCharUnlocked('warden'),false,
    'c_warden nunca foi desbloqueado — puro até dentro do laboratório');
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
  assert.strictEqual(S.getEchoQueue().length,2,
    'nenhum Echo CRIADO — a fila REAL segue intacta');
  assert.strictEqual(S.getCurSlot(),1,'morte no laboratório não toca slot');
  assert.strictEqual(JSON.stringify(S.getProg()),PROG_DEATH,
    'prog não mudou na morte');
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE,
    'save não foi escrito na morte');
});
function T_esc(t){return t.getEl('ov-title').textContent;}

/* ============ §88 — REINICIAR O MESMO SETUP ============ */
ok('§88/R5: sandboxRestart reinicia o MESMO setup sem sair do modo',()=>{
  S.sandboxRestart();
  assert.strictEqual(S.getSandboxRun(),true,'continua em modo laboratório');
  assert.strictEqual(S.getState(),'play');
  assert.strictEqual(S.getPlayer().charId,'bulwark','mesmo operador do CONTEXTO');
  assert.strictEqual(S.getCharSel(),3,'charSel do save continua intocado');
  assert.strictEqual(S.getCurSlot(),1,'R5§22: curSlot nunca saiu do save real');
  assert.strictEqual(JSON.stringify(S.getEchoQueue()),QUEUE_BEFORE,
    'fila real intacta de novo (e nunca usada)');
  assert.strictEqual(JSON.stringify(S.getEchoes()),'[]',
    'a run reiniciada continua sem Ecos reais');
  assert.strictEqual(S.getWave(),0,'run recomeça do zero (resetRunWorld)');
  assert(S.getPlayer(),'player novo criado');
  assert(S.getPlayer().coins>=500,'crédito de teste de novo');
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE,'save intacto');
});

/* ============ §90 — VITÓRIA: TESTE CONCLUÍDO ============ */
ok('§90: onVictory roteia para TESTE CONCLUÍDO (sem final, sem memória)',()=>{
  S.sandboxJumpTo(20);
  S.onVictory();
  assert.strictEqual(S.getState(),'victory');
  assert.strictEqual(T_esc(S),'TESTE CONCLUÍDO');
  assert(S.getEl('ov-sub').textContent.indexOf('NENHUM FINAL')>=0,
    'overlay deve afirmar que nenhum final foi registrado');
  assert.strictEqual(S.getEchoQueue().length,2,
    'nenhum Echo CRIADO — fila real intacta na vitória');
  assert.strictEqual(JSON.stringify(S.getMeta()),META_BEFORE,
    'meta-progresso (memória) intocado');
  assert.strictEqual(S._ls.getItem('echoSave.v3'),SAVE_BEFORE);
});

/* ============ §87 — SAIR RESTAURA O SAVE REAL ============ */
ok('§87/R5: sandboxExit NÃO restaura nada — o real nunca saiu do lugar',()=>{
  const PRE=JSON.stringify({p:S.getProg(),m:S.getMeta(),q:S.getEchoQueue(),
    cs:S.getCharSel(),sl:S.getCurSlot(),ar:S.hasActiveRun()});
  const FILE=S._ls.getItem('echoSave.v3');
  S.sandboxExit(false);
  assert.strictEqual(S.getSandboxRun(),false);
  assert.strictEqual(S.sandboxActive(),false);
  assert.strictEqual(S.getState(),'title','menu inicial GLOBAL');
  assert.strictEqual(JSON.stringify({p:S.getProg(),m:S.getMeta(),
    q:S.getEchoQueue(),cs:S.getCharSel(),sl:S.getCurSlot(),
    ar:S.hasActiveRun()}),PRE,'memória IDÊNTICA antes/depois da saída');
  assert(S.getEchoQueue()[0]&&S.getEchoQueue()[0].kills===111,
    'Eco 1 do Save 1 é o MESMO objeto-valor de antes');
  assert(S.getEchoQueue()[1]&&S.getEchoQueue()[1].kills===222,
    'Eco 2 do Save 1 é o MESMO objeto-valor de antes');
  assert.strictEqual(S.getEchoQueue().length,2,'fila real do Save 1 completa');
  assert.strictEqual(S.getCharSel(),3,'charSel do Save 1 (PYRE) — nunca saiu');
  assert.strictEqual(S.getEl('sb-chip').classList.contains('on'),false,
    'chip SANDBOX desligado');
  assert.strictEqual(S.getSmRoot().slots[1].char,3,'slot real: PYRE');
  assert.strictEqual(S._ls.getItem('echoSave.v3'),FILE,
    'nenhuma gravação acontece na saída');
  assert.strictEqual(S.getSandboxContext().operatorId,'bulwark',
    'contexto do laboratório permanece próprio (não vira save)');
});

/* ============ §73 — setChar REAL persiste, sandboxSetChar NÃO ============ */
const C2=bootGame();
ok('§73/R5: seleção do laboratório vive em sandboxContext — setChar nunca é chamado',()=>{
  const r=realSlot(C2);                 // PYRE no slot 1
  assert.strictEqual(C2.getSmRoot().slots[1].char,3);
  let setCalls=0;const _set=C2.setChar;C2.setChar=i=>{setCalls++;return _set(i);};
  C2.getSandboxCfg().char=1;            // WRAITH no laboratório (contexto)
  C2.sandboxOpenSetup();
  C2.sandboxStart();
  assert.strictEqual(C2.getPlayer().charId,'wraith','player do contexto');
  assert.strictEqual(C2.getCharSel(),3,'charSel do save NÃO foi tocado');
  assert.strictEqual(C2.getSandboxContext().operatorId,'wraith','contexto próprio');
  assert.strictEqual(C2.getSmRoot().slots[1].char,3,
    'início do laboratório não reescreve o slot');
  C2.getSandboxCfg().char=5;            // troca de operador DENTRO do sandbox
  C2.sandboxRestart();                  // reinicia com o novo contexto
  assert.strictEqual(C2.getPlayer().charId,'nomad','novo operador do contexto');
  assert.strictEqual(C2.getCharSel(),3,'charSel segue intocado');
  assert.strictEqual(C2.getSmRoot().slots[1].char,3,'slot real segue intacto');
  assert.strictEqual(setCalls,0,'setChar do jogo normal NUNCA foi chamado');
  C2.sandboxExit(false);
  assert.strictEqual(C2.getCharSel(),3,'operador real do slot preservado');
});
ok('§92: sandbox com DEV desligado não gera taint ao remover item',()=>{
  /* DEV_MODE=false (produção): devTaint() é cedo-return; nenhuma ação do
     sandbox (remover item/trocar slots/trocar operador) pode manchar. */
  C2.sandboxOpenSetup();
  C2.sandboxOpenSetup();
  C2.sandboxStart();                    // run de laboratório nova (DEV off)
  const p=C2.getPlayer();
  C2.applyBuildPreset('crit',p);
  const item=p.items[0];
  assert(C2.removeItemById(p,item)===true,'remoção falhou');
  assert.strictEqual(C2.isDevTainted(),false,
    'sandbox marcou devTaint com DEV desligado');
  C2.swapWeaponSlots(0,Math.min(1,p.owned.length-1));
  C2.getSandboxCfg().char=0;             // R5: troca de operador pelo contexto
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
  W2.sandboxOpenSetup();
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
  assert.strictEqual(U.getPlayer().charId,'bulwark','player é o BULWARK (contexto)');
  assert.strictEqual(U.getSandboxContext().operatorId,'bulwark');
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
        assert(V.getPlayer().charId===V.CHARS[c].id,
          'operador ativo: '+V.CHARS[c].id+' (via contexto)');
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
  /* R5: o setter de índice satura (0..7); corrupção direta do contexto
     continua sendo recusada pela validação (§32) */
  W.getSandboxContext().operatorId='operador-fantasma';
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  F.sandboxOpenSetup();F.getSandboxCfg().char=0;F.sandboxStart();
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
  V5.sandboxOpenSetup();V5.getSandboxCfg().char=1;V5.sandboxStart();
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
  assert(V5.getEchoQueue()[0]&&V5.getEchoQueue()[0].kills===111&&
    V5.getEchoQueue().length===2,
    'nenhum Echo criado — fila real do Save 1 intacta');
  assert.strictEqual(V5.getSmRoot().slots[1].char,3,'progressão intacta');
});
ok('§11: vitória no sandbox também oferece VOLTAR AO MENU PRINCIPAL',()=>{
  const V6=bootGame();
  realSlot(V6);
  V6.sandboxOpenSetup();V6.getSandboxCfg().char=0;V6.sandboxStart();
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
  V7.sandboxOpenSetup();V7.getSandboxCfg().char=0;V7.sandboxStart();
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
  V8.sandboxOpenSetup();V8.getSandboxCfg().char=0;V8.sandboxStart();
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
  V9.sandboxOpenSetup();V9.getSandboxCfg().char=0;V9.sandboxStart();
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
Z.activateSlot(1);
Z.showTitle();   // R5: pendências LEGÍTIMAS do save sincronizam ANTES do
                 // snapshot (comportamento normal de menu — kills 400 do
                 // próprio save). O sandbox em si nunca escreve.
const SNAPSHOT=Z.getLS().getItem('echoSave.v3');
ok('R5§4: is*Unlocked não mudam DENTRO do sandbox (puros; catálogo é da UI)',()=>{
  assert.strictEqual(Z.isCharUnlocked('revenant'),false,
    'REVENANT locked (kills 400 < 2000) — dentro E fora');
  assert.strictEqual(Z.isWeaponUnlocked('void'),false);
  assert.strictEqual(Z.isItemUnlocked('luneta'),false);
  Z.sandboxOpenSetup();                          // ENTRAR no sandbox
  assert.strictEqual(Z.isCharUnlocked('revenant'),false,
    'R5: sem override — continua locked dentro');
  assert.strictEqual(Z.isWeaponUnlocked('void'),false);
  assert.strictEqual(Z.isItemUnlocked('luneta'),false);
  /* mesmo assim o PREPARO lista tudo (catálogo próprio da UI, §5) */
  const body=Z.getEl('cx-body').innerHTML;
  assert(body.indexOf('TODOS LIBERADOS')>=0,'catálogo completo anunciado');
  assert.strictEqual(Z.getProg().seen.indexOf('c_revenant'),-1,
    'NADA foi gravado em prog.seen');
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
  /* sai para o menu — R5: nada a suprimir, o sandbox não mudou nada */
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
ok('R5: pós-sandbox o jogo normal se comporta EXATAMENTE como sem sandbox',()=>{
  /* as pendências LEGÍTIMAS (kills 400 do próprio save) já sincronizaram
     no showTitle da SAÍDA — igual a qualquer ida ao menu sem sandbox */
  assert(Z.getProg().seen.indexOf('w_beam')>=0,
    'w_beam já estava legítimamente sincronizado antes do sandbox');
  assert(Z.getProg().seen.indexOf('u_pierce')>=0);
  /* REVENANT foi USADO no laboratório e CONTINUA locked (o bug do usuário) */
  assert.strictEqual(Z.isCharUnlocked('revenant'),false,
    'usar operador locked no sandbox NÃO desbloqueia');
  assert.strictEqual(Z.isWeaponUnlocked('void'),false,
    'usar arma locked no sandbox NÃO desbloqueia');
  assert.strictEqual(Z.isItemUnlocked('luneta'),false);
  assert.strictEqual(Z.getProg().seen.indexOf('c_revenant'),-1,
    'c_revenant NUNCA entrou em seen');
  assert.strictEqual(Z.getSmRoot().slots[1].prog.seen.indexOf('c_revenant'),-1,
    'nada no slot persistido');
  /* showTitle de novo (como o jogador veria): nenhuma gravação nova */
  Z.showTitle();
  assert.strictEqual(Z.getLS().getItem('echoSave.v3'),SNAPSHOT,
    'showTitle pós-sandbox NÃO grava NADA (snapshot pós-sync intacto)');
});
ok('R5: checkUnlocks segue funcionando normalmente para o JOGO NORMAL',()=>{
  Z.setState('title');
  Z.startRun();                                  // run real
  assert.strictEqual(Z.getSandboxRun(),false);
  /* morte real: fluxo normal do jogo registra (comportamento padrão) */
  Z.onPlayerDeath();
  assert(Z.getProg().runs>=1,
    'run real registra runs (o sandbox nunca registrou)');
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
  R2.sandboxOpenSetup();R2.getSandboxCfg().char=0;R2.sandboxStart();
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
  R3.sandboxOpenSetup();R3.getSandboxCfg().char=0;R3.sandboxStart();
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

/* =====================================================================
   R4 — SANDBOX COMO MODO INDEPENDENTE DOS SAVE SLOTS
   ===================================================================== */
/* forja 3 slots com estados distintos (kill counts e seen diferentes) */
function forge3(b){
  b.activateSlot(1);
  unlock(b,['c_pyre']);
  b.setChar(3);
  const r=b.getSmRoot();
  r.slots[1].prog.kills=400;
  r.slots[2]={touched:true,char:6,
    meta:{mem:7,spd:0,reroll:0,vault:0,wins:0,endings:[],evars:[]},
    prog:{kills:50,runs:1,waves:3,best:2,wins:0,bosses:0,minis:0,
      elites:0,crits:0,dashes:0,coins:0,items:0,events:0,echoKills:0,
      reso:0,melee:0,status:0,seen:['c_warden']},
    echoes:[],run:null};
  r.slots[3]={touched:true,char:7,
    meta:{mem:9,spd:1,reroll:1,vault:0,wins:1,endings:[],evars:[]},
    prog:{kills:1200,runs:4,waves:31,best:11,wins:1,bosses:1,minis:1,
      elites:2,crits:0,dashes:0,coins:0,items:0,events:0,echoKills:0,
      reso:0,melee:0,status:0,seen:['c_revenant','c_nomad']},
    echoes:[],run:null};
  b.getLS().setItem('echoSave.v3',JSON.stringify(r));
}
ok('R4§52: botão SANDBOX existe no menu inicial e some dentro do save',()=>{
  const M=bootGame();
  M.showTitle();
  assert.strictEqual(M.getEl('ov-menu').style.display,'flex',
    'menu global exibe o botão SANDBOX');
  assert(html.indexOf('id="ov-sandbox"')>=0);
  M.pickSlot(2);                          // entra no Save 2 (menu do save)
  assert.strictEqual(M.getState(),'slotMenu');
  assert.strictEqual(M.getEl('ov-menu').style.display,'none',
    'dentro do save: SEM botão Sandbox (R4§3)');
  /* tela de slots também esconde */
  M.showSlotSelect();
  assert.strictEqual(M.getEl('ov-menu').style.display,'none');
});
ok('R5§28: REPRODUÇÃO DO BUG — locked no Save → usado no Sandbox → LOCKED de volta',()=>{
  const U=bootGame();
  forge3(U);
  U.activateSlot(1);
  U.showTitle();                    // R5: pendências legítimas sincronizam ANTES
  const snap=U.getLS().getItem('echoSave.v3');
  const MEM=JSON.stringify({p:U.getProg(),m:U.getMeta(),q:U.getEchoQueue(),
    cs:U.getCharSel(),sl:U.getCurSlot()});
  /* A. Save 1: REVENANT bloqueado no DOM real */
  U.pickSlot(1);
  U.refreshTitleChar();
  const cards=U.getEl('ov-char').querySelectorAll('[data-ch]');
  assert.strictEqual(cards.length,U.CHARS.length,'8 cards renderizados');
  const rev=cards.find(n=>n.dataset.ch==='7');
  assert(rev._cls.indexOf('lock')>=0,'REVENANT aparece BLOQUEADO no Save 1');
  const raw=U.getEl('ov-char').innerHTML;
  assert(raw.indexOf('🔒 REVENANT')>=0,'cadeado visual no Save 1');
  const lun=cards.find(n=>n.dataset.ch==='5');
  assert(lun._cls.indexOf('lock')>=0,'NÔMADE bloqueado no Save 1');
  /* B. SANDBOX: o preparo lista TODOS (catálogo próprio da UI, §5) —
     mas is*Unlocked segue PURO (nada é "desbloqueado" nem em vista) */
  U.showTitle();
  U.sandboxOpenSetup();
  const sb=U.getEl('cx-body').innerHTML;
  assert(sb.indexOf('TODOS LIBERADOS')>=0,'catálogo completo anunciado');
  for(const C of U.CHARS)
    assert(sb.indexOf(C.nm)>=0,'operador no preparo: '+C.nm);
  const sbCards=U.getEl('cx-body').querySelectorAll('[data-sbchar]');
  assert.strictEqual(sbCards.length,8,'8 cartões no catálogo do sandbox');
  assert(sbCards.every(n=>(Array.isArray(n._cls)?n._cls.join(' '):n._cls)
    .indexOf('lock')<0),'nenhum cartão do sandbox usa classe de lock');
  assert.strictEqual(U.isCharUnlocked('revenant'),false,
    'R5§4: isCharUnlocked segue PURO dentro do sandbox');
  /* C. usa o REVENANT no laboratório */
  U.getSandboxCfg().char=7;U.getSandboxCfg().preset='';U.getSandboxCfg().wave=1;
  assert.strictEqual(U.sandboxStart(),true);
  assert.strictEqual(U.getPlayer().charId,'revenant','REVENANT jogável (contexto)');
  assert.strictEqual(U.getCharSel(),3,'charSel do save NÃO acompanhou');
  U.onPlayerDeath();
  U.sandboxExit(true);
  /* D. de volta ao Save 1 (MESMA SESSÃO, sem reload — §29): tudo igual */
  assert.strictEqual(JSON.stringify({p:U.getProg(),m:U.getMeta(),
    q:U.getEchoQueue(),cs:U.getCharSel(),sl:U.getCurSlot()}),MEM,
    'R5§11: progressão REAL em memória IDÊNTICA (deep)');
  assert.strictEqual(U.getLS().getItem('echoSave.v3'),snap,
    'save byte a byte após a sessão');
  U.pickSlot(1);
  U.refreshTitleChar();
  const cards2=U.getEl('ov-char').querySelectorAll('[data-ch]');
  const rev2=cards2.find(n=>n.dataset.ch==='7');
  assert(rev2._cls.indexOf('lock')>=0,'REVENANT segue LOCKED no Save 1');
  assert(U.getEl('ov-char').innerHTML.indexOf('🔒 REVENANT')>=0,
    'cadeado de volta');
  assert.strictEqual(U.isCharUnlocked('revenant'),false,'isCharUnlocked real');
});
ok('R4§45/§46/§47: Sandbox → Save 1/2/3 — progressão de TODOS intacta',()=>{
  const P=bootGame();
  forge3(P);
  const snap=P.getLS().getItem('echoSave.v3');
  P.sandboxOpenSetup();
  P.getSandboxCfg().char=7;P.getSandboxCfg().preset='status';P.getSandboxCfg().wave=5;
  P.sandboxStart();
  P.grantWeapon(P.WEAPONS.findIndex(w=>w.id==='void'),true);
  P.grantItemInternal(P.getPlayer(),P.itemById('luneta'),true);
  P.sbPanelShow();P.sandboxJumpTo(20);P.onVictory();
  P.sandboxRestart();P.onPlayerDeath();P.sandboxExit(true);
  assert.strictEqual(P.getLS().getItem('echoSave.v3'),snap,
    'os 3 saves byte a byte após a sessão');
  P.activateSlot(2);
  assert.strictEqual(P.getProg().kills,50,'Save 2 intacto');
  assert.strictEqual(P.getProg().seen.indexOf('c_warden')>=0,true,'Save 2 seen ok');
  P.activateSlot(3);
  assert.strictEqual(P.getProg().kills,1200,'Save 3 intacto');
  assert.strictEqual(P.getMeta().mem,9,'Save 3 meta intacta');
  P.activateSlot(1);
  assert.strictEqual(P.getProg().kills,400,'Save 1 intacto');
});
ok('R5: Save→Menu→Sandbox NÃO LÊ o save; Sandbox→Save→Sandbox recomeça limpo',()=>{
  const Q=bootGame();
  forge3(Q);
  Q.activateSlot(1);Q.showTitle();         // sync legítimo pré-snapshot
  Q.pickSlot(1);                           // Save 1 carregado de verdade
  assert.strictEqual(Q.getProg().kills,400,'Save 1 na memória');
  Q.showSlotSelect();Q.showTitle();        // volta completamente ao menu
  Q.sandboxOpenSetup();                    // Sandbox DEPOIS do save
  /* R5§11: o global real nem é substituído — segue lá, intocado */
  assert.strictEqual(Q.getProg().kills,400,'prog real intacta (não zerada)');
  assert.strictEqual(Q.getCurSlot(),1,'R5§22: curSlot nunca é alterado');
  /* a RUN é que nasce limpa: meta de leitura zerada, zero Ecos */
  Q.getSandboxCfg().char=7;Q.sandboxStart();
  assert.strictEqual(Q.getPlayer().coins,500,'sem bônus de meta.vault do save');
  assert.strictEqual(JSON.stringify(Q.getEchoes()),'[]','run sem Ecos reais');
  assert.strictEqual(Q.getPlayer().charId,'revenant','operador do contexto');
  Q.sandboxExit(true);                     // sair
  Q.activateSlot(1);                       // Save 1 de novo (fluxo normal)
  assert.strictEqual(Q.getProg().kills,400,'Save 1 intacto após sandbox');
  Q.showSlotSelect();Q.showTitle();
  Q.sandboxOpenSetup();                    // segundo Sandbox na mesma sessão
  Q.getSandboxCfg().char=0;                // contexto volta ao VECTOR
  Q.sandboxStart();
  assert.strictEqual(Q.getPlayer().coins,500,'segunda run também nasce limpa');
  assert.strictEqual(JSON.stringify(Q.getEchoes()),'[]','segunda run sem Ecos');
  assert.strictEqual(Q.getCurSlot(),1,'curSlot segue o save real');
});
ok('R4§16/§53: 10 reentradas completas — INICIAR TESTE sempre funciona',()=>{
  const E=bootGame();
  for(let i=0;i<10;i++){
    E.sandboxExit(true);E.setState('title');
    E.sandboxOpenSetup();
    E.getSandboxCfg().char=i%8;
    E.getSandboxCfg().preset=['','crit','dash'][i%3];
    E.getSandboxCfg().wave=3;
    const go=E.getEl('cx-body').querySelector('#sb-start');
    assert(go,'ciclo '+i+': botão INICIAR existe');
    assert.strictEqual(go._h.click.length,1,'ciclo '+i+': exatamente 1 handler');
    go.click();                            // clique REAL no binding
    assert.strictEqual(E.getSandboxRun(),true,'ciclo '+i+': run abriu');
    assert.strictEqual(E.getState(),'play','ciclo '+i+': jogando');
    assert(E.getPlayer(),'ciclo '+i+': player ok');
    E.sandboxExit(true);
    assert.strictEqual(E.getState(),'title','ciclo '+i+': voltou ao menu');
  }
});
ok('R4§17/§18: STRESS 50 ciclos — zero estado residual, listeners únicos',()=>{
  const X=bootGame();
  const kd0=window._wl.keydown.length,ku0=window._wl.keyup.length;
  for(let i=0;i<50;i++){
    X.sandboxExit(true);X.setState('title');
    X.sandboxOpenSetup();
    X.getSandboxCfg().char=0;X.getSandboxCfg().preset='';X.getSandboxCfg().wave=1;
    assert.strictEqual(X.sandboxStart(),true,'ciclo '+i+' abriu');
    X.sbPanelShow();X.sbAction('mod:damage:1');X.sbAction('group');
    X.sbPanelClose();
    X.sandboxExit(true);
    /* sem residuais */
    assert.strictEqual(X.getSandboxRun(),false,'ciclo '+i+': sandboxRun=false');
    assert.strictEqual(X.getSandboxMode(),false,'ciclo '+i+': sandboxMode=false');
    assert.strictEqual(X.getState(),'title','ciclo '+i+': state limpo');
    assert.strictEqual(X.getCurSlot(),1,'ciclo '+i+': contexto real de volta');
    assert.strictEqual(X.getEnemies().length,0,'ciclo '+i+': arena limpa');
    assert.strictEqual(X.getSbPanelOpen(),false,'ciclo '+i+': painel fechado');
  }
  assert.strictEqual(window._wl.keydown.length,kd0,'keydown listeners NÃO duplicam');
  assert.strictEqual(window._wl.keyup.length,ku0,'keyup listeners NÃO duplicam');
  assert.strictEqual(X.getProg().kills,0,'prog do modo normal continua zerado');
});
ok('R4§35/§36: fechar no Sandbox não destraí nada — sem checkpoint/Continue',()=>{
  const F=bootGame();
  forge3(F);
  const before=JSON.stringify(F._ls._d);
  F.sandboxOpenSetup();
  F.getSandboxCfg().char=0;F.sandboxStart();
  F.sbPanelShow();F.sandboxJumpTo(10);F.sbPanelClose();
  /* "fechar o jogo" aqui = nenhuma gravação acontece na sessão */
  assert.strictEqual(JSON.stringify(F._ls._d),before,
    'nenhum byte escrito ao fechar durante o Sandbox');
  /* reabrir o jogo = boot novo sobre o MESMO localStorage */
  const B2=bootGame(Object.assign({},F._ls._d));
  assert.strictEqual(B2.getState(),'title','menu inicial normal (sem CONTINUAR SANDBOX)');
  assert.strictEqual(B2.hasActiveRun(),false,'nenhum activeRun de sandbox');
});
ok('R4§43: entrar no Sandbox não altera currentSlot/lastSlot persistente',()=>{
  const G=bootGame();
  forge3(G);
  const snap=G.getLS().getItem('echoSave.v3');
  G.sandboxOpenSetup();
  assert.strictEqual(G.getSmRoot().lastSlot,1,'lastSlot persistente intacto');
  G.getSandboxCfg().char=1;G.sandboxStart();
  G.sandboxExit(true);
  assert.strictEqual(G.getLS().getItem('echoSave.v3'),snap);
  assert.strictEqual(G.getSmRoot().lastSlot,1);
  assert.strictEqual(G.getCurSlot(),1,'modo normal restaurado');
});
ok('R4§8: sandboxSessionInfo documenta a sessão temporária (slot sempre 0)',()=>{
  const H=bootGame();
  H.sandboxOpenSetup();
  H.getSandboxCfg().char=4;H.getSandboxCfg().preset='crit';H.getSandboxCfg().wave=10;
  const si=H.sandboxSessionInfo();
  assert.strictEqual(si.operator,4);
  assert.strictEqual(si.preset,'crit');
  assert.strictEqual(si.wave,10);
  assert.strictEqual(si.active,false);
  assert.strictEqual(si.slot,0,'nenhum slot pertence ao sandbox');
  H.sandboxStart();
  assert.strictEqual(H.sandboxSessionInfo().active,true);
  H.sandboxExit(true);
});

/* =====================================================================
   R5 — ZERO PARTICIPAÇÃO NO SISTEMA DE PROGRESSÃO (refatoração profunda)
   ===================================================================== */
ok('R5§46: is*Unlocked PUROS no FONTE (nenhum sandboxActive no gate)',()=>{
  /* §4: remover o override é contrato de FONTE — testado estruturalmente */
  for(const fn of ['isCharUnlocked','isWeaponUnlocked','isItemUnlocked',
    'isUpgUnlocked']){
    const i=html.indexOf('function '+fn+'(');
    assert(i>=0,'função ausente: '+fn);
    const body=html.slice(i,html.indexOf('\nfunction ',i+10));
    assert(body.indexOf('sandboxActive')<0,
      fn+' ainda consulta o sandbox (override proibido na R5)');
  }
  assert(html.indexOf('sandboxSetChar')<0,'sandboxSetChar foi removido (§8)');
  assert(html.indexOf('sandboxHoldUnlocks')<0,
    'janela de hold foi removida (o jogo normal se sincroniza sozinho)');
  assert(html.indexOf('if(sandboxActive())return true')<0,
    'nenhum return true por override');
});
ok('R5§37: DEEP FREEZE — sessão completa com prog/meta/smRoot/fila congelados',()=>{
  const FR=bootGame();
  realSlot(FR);
  FR.activateSlot(1);FR.showTitle();          // sync antes de congelar
  const MEM=JSON.stringify({p:FR.getProg(),m:FR.getMeta(),q:FR.getEchoQueue(),
    cs:FR.getCharSel(),sl:FR.getCurSlot()});
  const FILE=FR._ls.getItem('echoSave.v3');
  const df=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);
    for(const k in o)df(o[k]);}};
  df(FR.getProg());df(FR.getMeta());df(FR.getSmRoot());df(FR.getEchoQueue());
  assert(Object.isFrozen(FR.getProg())&&Object.isFrozen(FR.getMeta())&&
    Object.isFrozen(FR.getSmRoot()),'objetos reais congelados');
  FR.sandboxOpenSetup();
  FR.getSandboxCfg().char=7;FR.getSandboxCfg().preset='';FR.getSandboxCfg().wave=5;
  assert.strictEqual(FR.sandboxStart(),true,
    'run de laboratório funciona COM a progressão real congelada');
  assert.strictEqual(FR.getPlayer().charId,'revenant');
  FR.sbPanelShow();FR.sbAction('group');FR.sbAction('mod:crit:1');FR.sbPanelClose();
  FR.onPlayerDeath();
  FR.sandboxExit(true);
  assert.strictEqual(FR.getState(),'title');
  assert.strictEqual(JSON.stringify({p:FR.getProg(),m:FR.getMeta(),
    q:FR.getEchoQueue(),cs:FR.getCharSel(),sl:FR.getCurSlot()}),MEM,
    'nem com freeze houve tentativa de escrita (memória idêntica)');
  assert.strictEqual(FR._ls.getItem('echoSave.v3'),FILE,'arquivo intacto');
});
ok('R5§28: clique em operador LOCKED no menu do save NÃO seleciona',()=>{
  const LK=bootGame();
  realSlot(LK);
  LK.pickSlot(1);
  LK.refreshTitleChar();
  const card=LK.getEl('ov-char').querySelectorAll('[data-ch]')
    .find(n=>n.dataset.ch==='1');            // BULWARK sem unlock aqui? slot tem PYRE
  /* escolhe um card LOCKED garantido (condição nunca cumprida) */
  const locked=[...LK.getEl('ov-char').querySelectorAll('[data-ch]')]
    .find(n=>n._cls.indexOf('lock')>=0);
  assert(locked,'existe card locked no Save 1 forjado');
  const before=JSON.stringify({cs:LK.getCharSel(),sc:LK.getSmRoot().slots[1].char});
  locked.click();                             // clique REAL no card bloqueado
  assert.strictEqual(JSON.stringify({cs:LK.getCharSel(),
    sc:LK.getSmRoot().slots[1].char}),before,
    'clique em locked NÃO seleciona e NÃO grava');
});
ok('R5§32/§33/§34: arma/item/upgrade locked continuam locked após o sandbox',()=>{
  const WL=bootGame();
  realSlot(WL);
  WL.activateSlot(1);WL.showTitle();          // sync legítimo antes
  const FILE=WL._ls.getItem('echoSave.v3');
  assert.strictEqual(WL.isWeaponUnlocked('void'),false);
  assert.strictEqual(WL.isItemUnlocked('luneta'),false);
  assert.strictEqual(WL.isUpgUnlocked('pierce'),false);
  WL.sandboxOpenSetup();
  WL.getSandboxCfg().char=0;WL.getSandboxCfg().preset='';WL.getSandboxCfg().wave=1;
  WL.sandboxStart();
  /* usa conteúdo locked no laboratório */
  WL.grantWeapon(WL.WEAPONS.findIndex(w=>w.id==='void'),true);
  WL.grantItemInternal(WL.getPlayer(),WL.itemById('luneta'),true);
  WL.getPlayer().upgLog.push('pierce');
  WL.onPlayerDeath();
  WL.sandboxExit(true);
  assert.strictEqual(WL.isWeaponUnlocked('void'),false,'arma continua locked');
  assert.strictEqual(WL.isItemUnlocked('luneta'),false,'item continua locked');
  assert.strictEqual(WL.isUpgUnlocked('pierce'),false,'upgrade continua locked');
  assert.strictEqual(WL.getProg().seen.indexOf('w_void'),-1);
  assert.strictEqual(WL.getProg().seen.indexOf('i_luneta'),-1);
  assert.strictEqual(WL.getProg().seen.indexOf('u_pierce'),-1);
  assert.strictEqual(WL._ls.getItem('echoSave.v3'),FILE,'arquivo byte a byte');
});
ok('R5§18/§19: INICIAR 20 ciclos com CLIQUE REAL no botão (vm DOM)',()=>{
  const IN=bootGame();
  for(let i=0;i<20;i++){
    const go=IN.getEl('ov-go');
    assert(Array.isArray(go._h.click)&&go._h.click.length>0,
      'ciclo '+(i+1)+': ov-go com binding de clique do boot');
    go.click();                              // clique REAL (binding do boot)
    assert.strictEqual(IN.getState(),'slots','ciclo '+(i+1)+': INICIAR → saves');
    IN.pressKey('Escape');
    assert.strictEqual(IN.getState(),'title','ciclo '+(i+1)+': ESC → título');
    assert.strictEqual(IN.getEl('ov-go').textContent,'INICIAR',
      'ciclo '+(i+1)+': botão INICIAR presente de novo');
  }
});
ok('R5§17: ov-go tem EXATAMENTE UM binding de clique no boot (fonte)',()=>{
  assert(html.split("$('ov-go').addEventListener").length===2,
    'exatamente 1 addEventListener de clique em ov-go');
});
ok('R5§20: interleave INICIAR ↔ SANDBOX na mesma sessão (3 voltas)',()=>{
  const IT=bootGame();
  realSlot(IT);
  for(let i=0;i<3;i++){
    IT.getEl('ov-go').click();
    assert.strictEqual(IT.getState(),'slots','volta '+(i+1)+': INICIAR ok');
    IT.pressKey('Escape');
    IT.sandboxOpenSetup();
    IT.getSandboxCfg().char=(i+2)%8;
    IT.getSandboxCfg().wave=1;
    assert.strictEqual(IT.sandboxStart(),true,'volta '+(i+1)+': sandbox abriu');
    IT.onPlayerDeath();
    IT.sandboxExit(true);
    assert.strictEqual(IT.getState(),'title','volta '+(i+1)+': título de novo');
    assert.strictEqual(IT.getEl('ov-go').textContent,'INICIAR');
  }
  /* após os cruzamentos, o fluxo normal continua 100% */
  IT.activateSlot(1);
  IT.startRun();
  assert.strictEqual(IT.getState(),'play','run NORMAL funciona após interleave');
  IT.clearRunEntities&&IT.clearRunEntities();
});
ok('R5§13: player do laboratório NÃO herda bônus de meta do save',()=>{
  const MG=bootGame();
  MG.activateSlot(1);
  MG.getMeta().vault=2;MG.getMeta().spd=2;MG.getMeta().reroll=1;
  MG.getSmRoot().slots[1].meta.vault=2;
  MG.getSmRoot().slots[1].meta.spd=2;
  MG.getSmRoot().slots[1].meta.reroll=1;
  MG.sandboxOpenSetup();
  MG.getSandboxCfg().char=7;MG.getSandboxCfg().preset='';MG.getSandboxCfg().wave=1;
  MG.sandboxStart();
  const p=MG.getPlayer(),C=MG.CHARS[7];      // REVENANT (sem perk de reroll)
  assert.strictEqual(p.coins,500,'25×vault=0 (meta de leitura zerada) + 500');
  assert.strictEqual(p.freeRerolls,0,
    'sem rerolls herdados (meta.reroll=1 somaria aqui)');
  assert.strictEqual(p.speed,C.speed,'sem bônus de velocidade do save');
  /* meta REAL continua lá */
  assert.strictEqual(MG.getMeta().vault,2,'meta real intocada');
  MG.sandboxExit(true);
  assert.strictEqual(MG.getMeta().vault,2);
});
ok('R5§8: sandboxSessionInfo documenta o contexto (operatorId, slot 0)',()=>{
  const SI=bootGame();
  SI.sandboxOpenSetup();
  SI.getSandboxCfg().char=4;SI.getSandboxCfg().preset='crit';SI.getSandboxCfg().wave=10;
  const si=SI.sandboxSessionInfo();
  assert.strictEqual(si.operatorId,SI.CHARS[4].id,
    'contexto por ID (não índice de save)');
  assert.strictEqual(si.operator,4,'espelho de índice para a UI');
  assert.strictEqual(si.preset,'crit');
  assert.strictEqual(si.wave,10);
  assert.strictEqual(si.active,false);
  assert.strictEqual(si.slot,0,'o laboratório não pertence a slot nenhum');
  SI.sandboxStart();
  assert.strictEqual(SI.sandboxSessionInfo().active,true);
  SI.sandboxExit(true);
});

console.log('---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('\nFALHAS DETECTADAS');process.exit(1);}
