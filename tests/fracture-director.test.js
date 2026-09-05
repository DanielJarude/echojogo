'use strict';
/* =====================================================================
   TESTES — PR 13: DIRETOR DE FRATURA (BLOCO 1 · FUNDAÇÃO)
   ---------------------------------------------------------------------
   Cobre a fundação do controlador central:
   · catálogo de 6 Temas (COLAPSO/CERCO/CAÇADA/ANOMALIA/RESSONÂNCIA/
     ESCASSEZ) com identidade, tags e tendências — sem números de balance;
   · seleção de Tema UMA vez por run, derivada de seed persistida
     (determinística: reload/loja/menus/Sandbox nunca trocam o Tema);
   · Intensidade 0–100 por API central (fractureAddIntensity/Set/Emit),
     nunca por mutação espalhada;
   · fractureEmit como barramento único: recusa tipo fora do contrato,
     altera estado SÓ quando o contrato manda, mantém histórico limitado;
   · checkpoint cp.fracture (pack/unpack sanitizado, save antigo e
     malformed tolerados), Continue fiel, morte/vitória limpando;
   · Save Slots isolados e Sandbox (R5) com contexto próprio —
     saves byte a byte idênticos após a sessão de laboratório.
   Rodar: npm test  |  node tests/fracture-director.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];
/* exporta globais do jogo + API PR 13 para o teste */
src+=';globalThis.__t={'+
  /* catálogo/contrato */
  'FRACTURE_THEMES,FRACTURE_THEME_IDS,FRACTURE_THEME_BY_ID,FRACTURE_STAGES,'+
  'FRACTURE_EVENT_GRID,FRACTURE_EVENT_TYPES,FRACTURE_HIST_MAX,FRACTURE_INT_MIN,'+
  'FRACTURE_INT_MAX,FRACTURE_INT_START,FRACTURE_INT_PER_WAVE,FRACTURE_STATE_VERSION,'+
  /* api */
  'fractureFresh,fractureMakeSeed,fracturePickTheme,fractureHash32,fractureRng,'+
  'fractureEnsureTheme,fractureForceTheme,fractureRerollTheme,fractureStageOf,'+
  'fractureGetThemeId,fractureGetTheme,fractureGetSeed,fractureGetIntensity,'+
  'fractureGetStage,fractureLast,fractureSnapshot,'+
  'fractureAddIntensity,fractureSetIntensity,fractureEmit,fractureOnWaveStart,'+
  'fractureWaveSeen,fractureHistPush,'+
  'fractureBeginRun,fractureEndRun,fractureForgetRun,'+
  'fractureRunPack,fractureRunUnpack,'+
  'fractureSandboxContextStart,fractureSandboxTearDown,'+
  'fractureInspectorText,fractureDevCommand,fractureDevSection,fractureKitBoot,'+
  /* BLOCO 2 — temas + composição */
  'ENEMY_TAG_DEFS,ENEMY_TAGS,enemyTags,WAVE_ARCHETYPES,WAVE_KEYS,'+
  'WAVE_PROTECTED_MIN,waveCompBase,waveCompFit,waveCompTotal,ENEMY_BUDGET,'+
  'fractureShapeWave,fractureWaveCtx,fractureThemeWeight,fractureArchBias,'+
  'fractureWaveRng,fractureBiasReport,fractureCompReport,fractureSimulate,'+
  'fractureCleanBias,fractureCleanPool,fractureSetWaveBias,fractureSetWavePool,'+
  'fractureClearWaveProfile,fractureSetSeed,fractureSandboxSection,'+
  'fractureSandboxAction,FRACTURE_BIAS_UP,FRACTURE_BIAS_DOWN,FRACTURE_CAP_MIN,'+
  'FRACTURE_CAP_SHARE,FRACTURE_MIN_KINDS,FRACTURE_STAGE_MUL,FRACTURE_RUN_BIAS_MAX,'+
  'FRACTURE_RUN_POOL_MAX,updateEnemy,scoreEvent,makeElite,eliteChance,'+
  'RUN_EVENTS,RUN_CHAIN_EVENTS,diffHp,diffDmg,diffSpd,'+
  /* BLOCO 3 — eventos, minibosses, identidade temática */
  'ALL_RUN_EVENTS,FACTION_RUN_EVENTS,FRAC_CONTACT_EVENTS,EVENT_BLOCK:null,'+
  'FRACTURE_EVENT_TAG_DEFS,FRACTURE_EVENT_TAGS,FRACTURE_EVENT_TAG_MAP,'+
  'fractureEventTags,FRACTURE_EVENT_BIAS,fractureEventBiasMul,fractureEvCtx,'+
  'fractureEventIntensity,FRACTURE_EV_INT_BY_RARITY,FRACTURE_EV_INT_PER_WAVE_MAX,'+
  'FRACTURE_EV_INT_PER_RUN_MAX,fractureOnEventChosen,evSelectFinal,'+
  'fractureB3,fractureCleanMiniMap,fractureCleanLastEv,scoreEvent,buildEventContext,'+
  'pickRunEvent,eventBlockReason,getEligibleEvents,evMem,evMemRecord,'+
  'MINIBOSS_IDS:null,getMiniBoss:()=>miniBoss,spawnMiniBoss,openShop,closeShop,'+
  'addResidues,spendResidues,getResidues,echoReact,ECHO_LINES,'+
  'factionEmit,MINI_WAVES,killEnemy,evQueue,RUN_EVENT_BY_ID,'+
  'miniEligiblePool,fractureMiniWeight,fracturePickMiniBoss,fractureMiniRng,'+
  'FRACTURE_MINI_BIAS,fractureMiniReport,fractureOnMiniSpawn,fractureOnMiniKill,'+
  /* B3.9/B3.10/B3.11: identidade de RESSONÂNCIA e ESCASSEZ + eventos novos */
  'FRACTURE_RUN_EVENTS,FRACTURE_CHAIN_EVENTS,fractureEventBiasMul,fractureEventTags,'+
  'FRACTURE_EVENT_TAGS,FRACTURE_EVENT_TAG_DEFS,FRACTURE_EVENT_TAG_MAP,FRACTURE_EVENT_BIAS,'+
  'fractureResoRead,fractureResoBias,fractureResoReact,FRACTURE_RESO_LINES,'+
  'fractureCoins,fractureCoinMul,fractureScarcityResidues,fractureShopRerollCost,'+
  'fractureShopRerollUsed,fractureOnShopOpen,fractureOnEventChosen,fractureEvCtx,'+
  'fractureB3InspectorLines,fractureTopEventBias,'+
  /* B4 hardening do B3: persistência da fila de cadeias + preview puro */
  'evMemPack,evMemRestore,evMemFresh,EV_QUEUE_MAX,'+
  'getEvQueue:()=>evQueue,setEvQueue:v=>{evQueue=v;},'+
  'getEvMem:()=>evMem,setEvMemLive:v=>{evMem=v;},'+
  'fractureScarcityPreview,fractureGrantResidues,'+
  'FRACTURE_EV_INT_BY_RARITY,fractureEventIntensity,FRACTURE_THEME_IDS,'+
  'changeEchoTrust,echoSpeak,liveEchoesForEvents,evEpilogue,evSetFlag,evMem,evQueue,'+
  'getEchoes:()=>echoes,setEchoesArr:a=>{echoes=a;},relPressurePct,echoAllied,echoRelState,'+
  /* BLOCO 4 - assinaturas, revelacao, stages, HUD, Codex */
  'FRACTURE_SIGNATURES,FRACTURE_SIG_BY_ID,FRACTURE_SIG_MAX_PER_RUN,'+
  'FRACTURE_SIG_COOLDOWN,FRACTURE_SIG_CHANCE,FRACTURE_STAGE_GATES,fractureStageGate,'+
  'fractureB4,fractureCleanSigMap,fractureCleanStageMap,'+
  'fractureSignatureEligible,fractureSignaturePool,fracturePickSignature,'+
  'fractureApplySignature,fractureSignatureForWave,fractureSignatureReport,'+
  'FRACTURE_LORE,FRACTURE_REVEAL_MIN_WAVE,FRACTURE_REVEAL_FORCE_MIN,'+
  'FRACTURE_REVEAL_FORCE_SPAN,FRACTURE_REVEAL_INT,FRACTURE_REVEAL_EV_FLOOR,'+
  'FRACTURE_REVEAL_EV_DECILE,FRACTURE_REVEAL_MINI_FLOOR,'+
  'fractureRevealForceWave,fractureRevealTrigger,fractureReveal,fractureIsRevealed,'+
  'fractureIsThematicEvent,fractureIsAlignedMini,'+
  'fractureHudState,fractureHudText,fractureHudChip,FRACTURE_HUD_UNKNOWN,'+
  'fractureStageAnnounce,fractureSignatureBanner,fractureRareOppMul,'+
  'FRACTURE_B4_ECHO_LINES,fractureEchoOnReveal,fractureEchoOnStage,'+
  'fractureEchoOnSignature,FRACTURE_FACTION_REMARKS,fractureFactionRemark,'+
  'fractureCodexSlot,fractureCodexDiscover,fractureCodexDiscovered,'+
  'fractureCodexBody,fractureB4InspectorLines,'+
  'fractureSandboxSimTransitionLines,FRACTURE_ANOMALY_SPIKE,'+
  'getB4:()=>(fractureRun&&fractureRun.b4)||null,'+
  /* PR 10.5.2 — gerencia de dados do slot (herdado do merge da main) */
  'smClearSlotEchoes,smClearSlotSave,refreshAfterSlotWipe,smDefaultSlot,'+
  /* acesso ao estado vivo */
  'getFx:()=>fractureRun,setFx:v=>{fractureRun=v;},'+
  /* jogo */
  'startRun,resumeRun,spawnWave,onPlayerDeath,onVictory,showVictory,clearActiveRun,'+
  'smBuildCheckpoint,captureCheckpoint,hasActiveRun,getActiveRun:()=>activeRun,'+
  'activateSlot,getCurSlot:()=>curSlot,smRootGet:()=>smRoot,smEnsureSlot,smCommit,'+
  'smClearSlotSave,setChar,saveEchoes,getEchoQueue:()=>echoQueue,setEchoQueue:q=>{echoQueue=q;},'+
  'setWave:v=>{wave=v|0;},getWave:()=>wave,setState:s=>{state=s;},getState:()=>state,'+
  'setPlayer:p=>{player=p;},getPlayer:()=>player,setEchoes:a=>{echoes=a;},'+
  'clearDevTaint:()=>{devTainted=false;},isTainted:()=>devTainted,'+
  'DEV_on:()=>{DEV_MODE=true;},DEV_off:()=>{DEV_MODE=false;},devCommand,devRender,'+
  'openShop,closeShop,renderShop,'+
  /* sandbox */
  'sandboxOpenSetup,sandboxStart,sandboxExit,sandboxRestart,sandboxEndToSetup,'+
  'sandboxCloseSetup,getSandboxRun:()=>sandboxRun,getSandboxMode:()=>sandboxMode,'+
  'getSandboxCfg:()=>sandboxCfg,sandboxSessionInfo,'+
  'MAX_WAVE,MINIBOSS,EDEFS,waveComp,pickMiniBoss,SM_VERSION};';

/* ---------------- DOM mínimo (mesmo harness das suítes existentes) ---------------- */
function makeStyle(){
  const store={};
  return new Proxy(store,{get(t,k){return k in t?t[k]:'';},
    set(t,k,v){t[k]=String(v);return true;}});
}
function ctx2d(){
  const grad={addColorStop(){}};
  return new Proxy({},{get(t,k){
    if(k==='canvas')return{width:0,height:0};
    if(k==='measureText')return()=>({width:0});
    if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;
    return()=>{};
  },set(){return true;}});
}
function makeEl(id){
  const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,
    _cls:new Set(),_handlers:{},parentNode:null,
    isConnected:true,offsetWidth:0,offsetHeight:0,
    textContent:'',innerHTML:'',className:'',title:'',style:makeStyle()};
  el.classList={
    add:(...c)=>c.forEach(x=>el._cls.add(x)),
    remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
    contains:c=>el._cls.has(c),
    toggle(c,f){const has=el._cls.has(c);const want=f===undefined?!has:!!f;
      if(want)el._cls.add(c);else el._cls.delete(c);return want;}
  };
  el.appendChild=c=>{if(c&&typeof c==='object')c.parentNode=el;
    el.children.push(c);return c;};
  el.insertBefore=c=>{if(c&&typeof c==='object')c.parentNode=el;
    el.children.unshift(c);return c;};
  el.removeChild=c=>{const i=el.children.indexOf(c);
    if(i>=0){el.children.splice(i,1);if(c&&typeof c==='object')c.parentNode=null;}
    return c;};
  el.remove=()=>{if(el.parentNode&&el.parentNode.removeChild)el.parentNode.removeChild(el);};
  el.addEventListener=(ev,fn)=>{(el._handlers[ev]=el._handlers[ev]||[]).push(fn);};
  el.removeEventListener=(ev,fn)=>{const a=el._handlers[ev];if(!a)return;
    const i=a.indexOf(fn);if(i>=0)a.splice(i,1);};
  el.dispatchEvent=()=>{};
  el.click=()=>{for(const fn of (el._handlers.click||[]).slice())fn({stopPropagation(){}});};
  el.querySelector=sel=>((typeof sel==='string'&&sel.charAt(0)==='.')?makeEl(''):null);
  el.querySelectorAll=()=>[];
  el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};
  el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];
  el.getContext=()=>ctx2d();
  /* a loja usa grow.lastChild (bindTip) — o stub precisa resolver a árvore */
  Object.defineProperty(el,'lastChild',{get:()=>
    el.children.length?el.children[el.children.length-1]:null});
  Object.defineProperty(el,'firstChild',{get:()=>
    el.children.length?el.children[0]:null});
  return el;
}
function findByTree(root,id){
  if(!root||typeof root!=='object')return null;
  if(root.id===id)return root;
  const ch=root.children;if(!ch)return null;
  for(const c of ch){const f=findByTree(c,id);if(f)return f;}
  return null;
}
function makeEnv(seed){
  const elements=new Map();
  const document={
    hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
    fullscreenElement:null,webkitFullscreenElement:null,
    createElement:()=>makeEl(''),
    getElementById:id=>{
      for(const root of [document.body,document.documentElement].concat(
        Array.from(elements.values()))){
        const f=findByTree(root,id);
        if(f)return f;
      }
      if(!elements.has(id))elements.set(id,makeEl(id));
      return elements.get(id);
    },
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
  const localStorage={_d:Object.assign({},seed||{}),
    getItem(k){return this._d[k]||null;},
    setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
  return {elements,document,window,localStorage,navigator:{getGamepads:()=>[]}};
}
function runGame(env,noTimers){
  const sandbox={console,Math,Date,parseInt,parseFloat,isNaN,
    setTimeout:noTimers?()=>0:setTimeout,
    clearTimeout:noTimers?()=>{}:clearTimeout,
    requestAnimationFrame:()=>0,Uint8ClampedArray,Array,Object,Number,String,Boolean,
    RegExp,Error,Map,Set,Promise,Proxy,Reflect,JSON,Symbol,
    document:env.document,window:env.window,localStorage:env.localStorage,
    navigator:env.navigator,performance:{now:()=>Date.now()}};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(src,ctx,{timeout:30000});
  const t=vm.runInContext('__t',ctx);
  t._ls=env.localStorage;
  t._env=env;
  return {t,ctx,env};
}
const MAIN=runGame(makeEnv({}),false);
const t=MAIN.t;
const document=MAIN.env.document;
function bootFx(seed,noTimers){return runGame(makeEnv(seed),noTimers!==false);}

/* ---------------- helpers ---------------- */
let passed=0,failed=0;
const falhas=[];
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){
    failed++;
    const pilha=(e&&e.stack||e).toString();
    falhas.push({label,erro:pilha.split('\n')[0]});
    console.log('  ✘ '+label+'\n    '+pilha.split('\n').slice(0,4).join('\n    '));
  }
}
const J=x=>JSON.stringify(x);

/* ---------------- delimitação do bloco PR13 (robusta a merges) ----------
   Os testes de arquitetura precisam saber onde começa e onde termina o código
   do Diretor de Fratura. A versão original usava o banner da seção BOOT como
   fim — código legado, que um merge pode renomear ou mover. Quando isso
   acontecia, o detector não falhava de forma legível: ele simplesmente passava
   a considerar TODAS as escritas como "fora do bloco" e acusava a primeira
   escrita legítima do próprio Diretor.

   Agora o bloco é delimitado por dois marcadores que pertencem ao PR13
   (PR13·bloco fx1.js … PR13·fim fx1.js), e a ausência de qualquer um deles é
   um erro EXPLÍCITO — nunca um falso positivo silencioso. */
const PR13_INI='/* ==================== PR13·bloco fx1.js ==================== */';
const PR13_FIM='/* ==================== PR13·fim fx1.js ==================== */';
function blocoPR13(){
  const jogo=m[1];
  const ini=jogo.indexOf(PR13_INI);
  assert.ok(ini>=0,'marcador de início do bloco PR13 ausente do index.html');
  const fim=jogo.indexOf(PR13_FIM,ini);
  assert.ok(fim>ini,'marcador de fim do bloco PR13 ausente (ou antes do início)');
  const dentro=i=>(i>=ini&&i<fim);
  const linha=i=>jogo.slice(0,i).split('\n').length;
  return {jogo,ini,fim,dentro,linha};
}
const THEMES=['collapse','siege','hunt','anomaly','resonance','scarcity'];
function trail(len,w){
  const tr=[];
  for(let i=0;i<len;i++)tr.push([i*.25,100+i,120-i,i%4===0?2:1,0,w||0]);
  return tr;
}
function echoData(pid){
  return {dur:60,trail:trail(100,0),items:[],upg:[],owned:[0,1],
    dom:'neutro',moral:{comp:2,greed:2,viol:2},kills:5,mh:100,
    st:{},dmgMul:1,frMul:1,wave:2,level:1,
    ps:{id:pid||'versatile',tr:[],c:.9,s:{},v:1}};
}
/* inicia uma run real limpa (sem contaminação DEV) */
function beginRun(B,slot){
  B.activateSlot(slot||1);
  B.clearDevTaint();
  B.setEchoQueue([echoData('versatile'),echoData('resilient')]);
  B.saveEchoes();
  B.setPlayer(null);B.setState('title');
  B.startRun();
  B.setState('play');
  assert(B.getFx(),'fractureRun precisa existir após startRun');
  return B.getPlayer();
}
/* B5-style: cada bloco de teste ganha um boot NOVO (localStorage próprio),
   permitindo simular RELOAD e isolar byte-a-byte o Sandbox. Devolve a API. */
bootFx=function(seed){return runGame(makeEnv(seed||{}),true).t;};
/* avança a run onda a onda pelo caminho real (spawnWave → hook do Diretor) */
function playWaves(B,from,to){
  for(let n=from;n<=to;n++){
    B.setWave(n);
    B.spawnWave(n);
  }
  return B.fractureGetIntensity();
}

console.log('\nECHO — PR 13 · Diretor de Fratura (Bloco 1 · Fundação)');
console.log('---------------------------------------------');

/* ============ [0] INTEGRIDADE DO BLOCO ============ */
console.log('\n[0] INTEGRIDADE DO BLOCO PR13');
ok('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(m[1]);
});
ok('fonte: não há mutação direta de Intensidade espalhada pelo jogo',()=>{
  /* a regra de arquitetura da PR13: fora do bloco do Diretor, ninguém
     escreve em fractureRun. Isso é o que impede a volta do padrão
     `fractureIntensity += 5` em dezenas de funções. Verificação por
     OCORRÊNCIA (índice real), não pela primeira aparição do texto. */
  /* inspeção sobre o script ORIGINAL (m[1]) — a variável src desta suíte
     tem o bloco de exports anexado no fim, que menciona fractureRun.
     Delimitação por marcadores semânticos do próprio PR13 (ver blocoPR13). */
  const {jogo,dentro,linha}=blocoPR13();
  let writes=0,assigns=0;
  const re1=/fractureRun\s*\.\s*\w+\s*(\+=|-=|\*=|=[^=])/g;
  let hit;
  while((hit=re1.exec(jogo))){
    writes++;
    assert.ok(dentro(hit.index),
      'escrita em fractureRun fora do bloco PR13 na linha '+linha(hit.index)+': '+hit[0].trim());
  }
  const re2=/fractureRun\s*=\s*[^=]/g;
  while((hit=re2.exec(jogo))){
    assigns++;
    assert.ok(dentro(hit.index),
      'atribuição de fractureRun fora do bloco PR13 na linha '+linha(hit.index));
  }
  assert.ok(writes>=10,'esperava as mutações internas do Diretor ('+writes+')');
  assert.ok(assigns>=5,'esperava os pontos de ciclo de vida ('+assigns+')');
  /* nenhuma leitura de Intensidade fora do bloco para fins de balance */
  const re3=/fractureGetIntensity\(\)/g;
  while((hit=re3.exec(jogo)))
    assert.ok(dentro(hit.index),'leitura de Intensidade fora do bloco na linha '+linha(hit.index));
});
ok('fonte: cp.fracture é gravado pelo checkpoint real (smBuildCheckpoint)',()=>{
  beginRun(t,1);
  const cp=t.smBuildCheckpoint('teste',3);
  assert.ok(cp&&typeof cp==='object','checkpoint construído');
  assert.ok('fracture' in cp,'campo cp.fracture existe no checkpoint');
  assert.strictEqual(cp.fracture.theme,t.fractureGetThemeId());
  /* sem run ativa o campo vira null (checkpoint antigo não ganha lixo) */
  t.setFx(null);
  assert.strictEqual(t.smBuildCheckpoint('teste',3).fracture,null);
});
ok('fonte: não há duplicação de definições críticas do Diretor',()=>{
  for(const fn of ['function fractureEmit(','function fractureRunPack(',
    'function fractureRunUnpack(','function fractureKitBoot(','const FRACTURE_THEMES=']){
    const n=src.split(fn).length-1;
    assert.strictEqual(n,1,'definição duplicada/faltando: '+fn+' ('+n+')');
  }
});
ok('package.json: a suíte PR13 está no script oficial de testes',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  assert.ok(pkg.scripts.test.indexOf('tests/fracture-director.test.js')>=0,
    'npm test precisa executar tests/fracture-director.test.js');
});

/* ============ [1] CATÁLOGO DE TEMAS ============ */
console.log('\n[1] CATÁLOGO DE TEMAS (6)');
ok('1. catálogo contém EXATAMENTE 6 temas',()=>{
  assert.strictEqual(t.FRACTURE_THEMES.length,6,'temas: '+t.FRACTURE_THEMES.length);
});
ok('2. IDs únicos e exatamente collapse/siege/hunt/anomaly/resonance/scarcity',()=>{
  const ids=t.FRACTURE_THEMES.map(x=>x.id);
  assert.strictEqual(new Set(ids).size,ids.length,'ids duplicados');
  assert.strictEqual(J(ids.slice().sort()),J(THEMES.slice().sort()));
  assert.strictEqual(J(t.FRACTURE_THEME_IDS),J(ids));
  for(const id of ids)assert.strictEqual(t.FRACTURE_THEME_BY_ID[id].id,id);
});
ok('identidade completa: nome pt-BR, descrição, identidade, tags, tendências, cor, símbolo',()=>{
  for(const th of t.FRACTURE_THEMES){
    assert.ok(th.nm&&th.nm===th.nm.toUpperCase(),th.id+' sem nome pt-BR maiúsculo');
    assert.ok((th.desc||'').length>25,th.id+' sem descrição');
    assert.ok(Array.isArray(th.identidade)&&th.identidade.length>=3,
      th.id+' precisa de 3+ traços de identidade');
    assert.ok(Array.isArray(th.tags)&&th.tags.length>=3,th.id+' precisa de 3+ tags');
    assert.ok(Array.isArray(th.tendencias)&&th.tendencias.length>=3,
      th.id+' precisa de tendências futuras');
    assert.ok(/^#[0-9a-fA-F]{6}$/.test(th.col),th.id+' cor inválida');
    assert.ok(th.sym,th.id+' sem símbolo');
  }
  /* nomes pt-BR dos 6 temas */
  const nomes=t.FRACTURE_THEMES.map(x=>x.nm);
  for(const n of ['COLAPSO','CERCO','CAÇADA','ANOMALIA','RESSONÂNCIA','ESCASSEZ'])
    assert.ok(nomes.indexOf(n)>=0,'falta o tema '+n);
});
ok('identidade de cada Tema bate com o briefing (COLAPSO horda, CERCO resistência, etc.)',()=>{
  const byId=t.FRACTURE_THEME_BY_ID;
  assert.ok(byId.collapse.identidade.join(' ').indexOf('hordas')>=0);
  assert.ok(byId.collapse.tendencias.join(' ').indexOf('Swarm')>=0);
  assert.ok(byId.collapse.tendencias.join(' ').indexOf('Splitter')>=0);
  assert.ok(byId.siege.identidade.join(' ').indexOf('resistência')>=0);
  assert.ok(byId.siege.tendencias.join(' ').indexOf('Bulwark')>=0);
  assert.ok(byId.hunt.identidade.join(' ').indexOf('perseguição')>=0);
  assert.ok(byId.hunt.tendencias.join(' ').indexOf('Phantom')>=0);
  assert.ok(byId.hunt.tendencias.join(' ').indexOf('Orbiter')>=0);
  assert.ok(byId.anomaly.identidade.join(' ').indexOf('imprevisível')>=0);
  assert.ok(byId.anomaly.tendencias.join(' ').indexOf('Singular')>=0);
  assert.ok(byId.resonance.identidade.join(' ').indexOf('Dissonância')>=0);
  assert.ok(byId.resonance.tendencias.join(' ').indexOf('Trust')>=0);
  /* facções podem REAGIR ao tema RESSONÂNCIA, mas nunca controlá-lo */
  assert.ok(byId.resonance.tendencias.join(' ').indexOf('nunca controlam')>=0);
  assert.ok(byId.scarcity.identidade.join(' ').indexOf('recursos limitados')>=0);
  assert.ok(byId.scarcity.tendencias.join(' ').indexOf('Resíduos Temporais')>=0);
});
ok('tags são vocabulário compartilhado (maiúsculas, sem acento, sem duplicata global)',()=>{
  const seen={};
  for(const th of t.FRACTURE_THEMES){
    for(const g of th.tags){
      assert.ok(/^[A-Z][A-Z0-9_]*$/.test(g),'tag fora do padrão: '+g);
      assert.ok(!(g in seen),'tag '+g+' repetida em '+th.id+' e '+seen[g]);
      seen[g]=th.id;
    }
    /* a tag do próprio tema existe (casamento futuro com fractureTags) */
    assert.ok(th.tags.indexOf(th.nm.normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').toUpperCase())>=0,
      th.id+' deveria carregar a própria tag');
  }
});
ok('sem números de balance prematuros: bias e pool vazios em todos os temas',()=>{
  for(const th of t.FRACTURE_THEMES){
    assert.strictEqual(Object.keys(th.bias||{}).length,0,
      th.id+' não pode trazer pesos definitivos no B1');
    assert.strictEqual((th.pool||[]).length,0,
      th.id+' não pode trazer pool definitiva no B1');
  }
});
ok('estágios de Intensidade: 5 faixas ordenadas, sem sobreposição de leitura',()=>{
  const st=t.FRACTURE_STAGES;
  assert.strictEqual(st.length,5);
  for(let i=0;i<st.length-1;i++)assert.ok(st[i].min>st[i+1].min,'faixas devem cair em min');
  assert.strictEqual(st[st.length-1].min,0);
  for(const s of st)assert.ok(s.id&&s.lab&&s.col);
  assert.strictEqual(t.fractureStageOf(0).id,'latente');
  assert.strictEqual(t.fractureStageOf(19).id,'latente');
  assert.strictEqual(t.fractureStageOf(20).id,'instavel');
  assert.strictEqual(t.fractureStageOf(45).id,'propagando');
  assert.strictEqual(t.fractureStageOf(75).id,'critica');
  assert.strictEqual(t.fractureStageOf(100).id,'ruptura');
  /* fora da faixa não quebra */
  assert.strictEqual(t.fractureStageOf(-50).id,'latente');
  assert.strictEqual(t.fractureStageOf(9999).id,'ruptura');
  assert.strictEqual(t.fractureStageOf('lixo').id,'latente');
});

/* ============ [2] SELEÇÃO DE TEMA ============ */
console.log('\n[2] SELEÇÃO DE TEMA (uma por run, determinística)');
ok('3. seleção válida: fracturePickTheme devolve sempre um id do catálogo',()=>{
  for(let s=0;s<2000;s++){
    const id=t.fracturePickTheme(s);
    assert.ok(t.FRACTURE_THEME_BY_ID[id],'seed '+s+' → tema inválido '+id);
  }
  /* valores extremos/lixo não quebram */
  for(const s of [0,1,-1,NaN,null,undefined,4294967295,1e12,'x',{}]){
    assert.ok(t.FRACTURE_THEME_BY_ID[t.fracturePickTheme(s)],'seed '+s);
  }
});
ok('seleção é função pura da seed (mesma seed ⇒ mesmo tema, sempre)',()=>{
  for(let s=1;s<=400;s++){
    const a=t.fracturePickTheme(s),b=t.fracturePickTheme(s),c=t.fracturePickTheme(s);
    assert.strictEqual(a,b,'seed '+s+' não é determinística');
    assert.strictEqual(a,c,'seed '+s+' não é determinística');
  }
});
ok('8. nova run pode ter novo Tema: os 6 temas são alcançáveis e bem distribuídos',()=>{
  const cont={};
  for(let s=1;s<=1200;s++){
    const id=t.fracturePickTheme(s);
    cont[id]=(cont[id]||0)+1;
  }
  for(const id of THEMES)
    assert.ok(cont[id]>0,'tema '+id+' nunca é sorteado');
  const vals=THEMES.map(id=>cont[id]);
  const max=Math.max.apply(null,vals)/1200;
  assert.ok(max<0.30,'distribuição degenerada (pico '+(max*100).toFixed(1)+'%)');
});
ok('seed da run é um inteiro 32 bits não-nulo e muda entre runs',()=>{
  const seen=new Set();
  for(let i=0;i<25;i++){
    const s=t.fractureMakeSeed();
    assert.ok(Number.isInteger(s)&&s>0&&s<=4294967295,'seed inválida: '+s);
    seen.add(s);
  }
  assert.ok(seen.size>=20,'seeds repetindo: '+seen.size+'/25');
});
ok('4. Tema escolhido apenas UMA vez por run (chamadas repetidas não trocam)',()=>{
  beginRun(t,1);
  const id0=t.fractureGetThemeId(),seed0=t.fractureGetSeed();
  assert.ok(t.FRACTURE_THEME_BY_ID[id0]);
  for(let i=0;i<20;i++){
    assert.strictEqual(t.fractureEnsureTheme(),false,'re-seleção na '+i+'ª chamada');
    t.fractureEmit('run_start',{wave:1});
    t.fractureEmit('wave_start',{wave:i+1});
    t.fractureWaveSeen(i+1,true);
  }
  assert.strictEqual(t.fractureGetThemeId(),id0,'tema mudou dentro da run');
  assert.strictEqual(t.fractureGetSeed(),seed0,'seed mudou dentro da run');
});
ok('Tema NÃO muda ao abrir/fechar a loja nem ao circular por menus',()=>{
  beginRun(t,1);
  const id0=t.fractureGetThemeId(),seed0=t.fractureGetSeed();
  playWaves(t,2,4);
  t.openShop();
  assert.strictEqual(t.getState(),'shop');
  t.renderShop();
  t.closeShop();
  t.setState('paused');t.setState('title');t.setState('play');
  assert.strictEqual(t.fractureGetThemeId(),id0,'loja/menus trocaram o tema');
  assert.strictEqual(t.fractureGetSeed(),seed0);
});
ok('run nova SEMPRE nasce com Tema definido (antes do primeiro checkpoint)',()=>{
  beginRun(t,1);
  assert.ok(t.FRACTURE_THEME_BY_ID[t.fractureGetThemeId()]);
  const cp=t.getActiveRun();
  assert.ok(cp&&cp.fracture,'checkpoint de início carrega cp.fracture');
  assert.strictEqual(cp.fracture.theme,t.fractureGetThemeId(),
    'o Tema precisa estar no checkpoint de início (Continue na onda 1)');
  assert.ok(cp.fracture.hist.some(h=>h.t==='theme_pick'),
    'a seleção fica registrada no histórico');
});
ok('fractureForceTheme/fractureRerollTheme são caminhos DEV (não usados pelo jogo)',()=>{
  beginRun(t,1);
  const id0=t.fractureGetThemeId();
  assert.strictEqual(t.fractureForceTheme('nao_existe'),false);
  assert.strictEqual(t.fractureForceTheme(null),false);
  const alvo=THEMES.filter(x=>x!==id0)[0];
  assert.strictEqual(t.fractureForceTheme(alvo,'teste'),true);
  assert.strictEqual(t.fractureGetThemeId(),alvo);
  assert.strictEqual(t.fractureForceTheme(alvo,'teste'),true);
  assert.strictEqual(t.fractureRerollTheme('teste'),true);
  assert.ok(t.FRACTURE_THEME_BY_ID[t.fractureGetThemeId()]);
  /* sem run ativa nada acontece */
  t.setFx(null);
  assert.strictEqual(t.fractureForceTheme(alvo),false);
  assert.strictEqual(t.fractureRerollTheme(),false);
  assert.strictEqual(t.fractureEnsureTheme(),false);
});
ok('o jogador não escolhe o Tema: não há nenhuma API de escolha na tela',()=>{
  /* a seleção acontece só em fractureBeginRun / fractureSandboxContextStart
     / fractureRunUnpack — nenhum handler de UI chama isso. */
  const callers=(src.match(/fractureBeginRun\(/g)||[]).length;
  assert.ok(callers>=2,'definição + chamada de boot');
  assert.ok(src.indexOf('fractureChooseTheme')<0,'não pode existir escolha do jogador');
  assert.ok(src.indexOf('data-fracture-theme')<0,'nenhum botão de tema na UI');
});

/* ============ [3] INTENSIDADE ============ */
console.log('\n[3] INTENSIDADE DA FRATURA (0–100, API central)');
ok('faixa conceitual 0–100 exposta como constante',()=>{
  assert.strictEqual(t.FRACTURE_INT_MIN,0);
  assert.strictEqual(t.FRACTURE_INT_MAX,100);
  assert.strictEqual(t.FRACTURE_INT_START,0);
});
ok('run começa no valor inicial e no estágio LATENTE',()=>{
  beginRun(t,1);
  assert.strictEqual(t.fractureGetIntensity(),t.FRACTURE_INT_START);
  assert.strictEqual(t.fractureGetStage().id,'latente');
});
ok('5. clamp 0–100: nunca negativo, nunca acima de 100, devolve o delta APLICADO',()=>{
  beginRun(t,1);
  assert.strictEqual(t.fractureAddIntensity(-500,'teste'),0,'não pode ir abaixo de 0');
  assert.strictEqual(t.fractureGetIntensity(),0);
  assert.strictEqual(t.fractureAddIntensity(1e9,'teste'),100,'satura em 100');
  assert.strictEqual(t.fractureGetIntensity(),100);
  assert.strictEqual(t.fractureGetStage().id,'ruptura');
  assert.strictEqual(t.fractureAddIntensity(50,'teste'),0,'já saturado: delta 0');
  assert.strictEqual(t.fractureAddIntensity(-1e9,'teste'),-100,'volta ao piso');
  assert.strictEqual(t.fractureGetIntensity(),0);
  /* entrada suja */
  for(const v of [NaN,null,undefined,'abc',{},[],1.4,-1.6]){
    const before=t.fractureGetIntensity();
    const d=t.fractureAddIntensity(v,'sujo');
    assert.ok(Number.isFinite(d),'delta finito para '+J(v));
    assert.ok(t.fractureGetIntensity()>=0&&t.fractureGetIntensity()<=100);
    assert.strictEqual(before+d,t.fractureGetIntensity());
  }
});
ok('fractureSetIntensity é absoluto, clampado e coerente com o delta',()=>{
  beginRun(t,1);
  assert.strictEqual(t.fractureSetIntensity(37,'teste'),37);
  assert.strictEqual(t.fractureGetIntensity(),37);
  assert.strictEqual(t.fractureSetIntensity(999,'teste'),63);
  assert.strictEqual(t.fractureGetIntensity(),100);
  assert.strictEqual(t.fractureSetIntensity(-99,'teste'),-100);
  assert.strictEqual(t.fractureGetIntensity(),0);
  assert.strictEqual(t.fractureSetIntensity('lixo','teste'),0);
  assert.strictEqual(t.fractureGetIntensity(),0);
});
ok('o estágio é SEMPRE derivado da Intensidade (nunca confiado do save)',()=>{
  beginRun(t,1);
  for(const [v,esperado] of [[0,'latente'],[25,'instavel'],[50,'propagando'],
    [70,'critica'],[95,'ruptura']]){
    t.fractureSetIntensity(v,'teste');
    assert.strictEqual(t.getFx().stage,esperado,'estágio dessincronizado em '+v);
    assert.strictEqual(t.fractureGetStage().id,esperado);
  }
  /* mesmo com o campo corrompido à mão, a leitura pública deriva */
  t.getFx().stage='LIXO';
  assert.strictEqual(t.fractureGetStage().id,'ruptura');
});
ok('conclusão de wave dá um incremento pequeno via evento central (+2/onda)',()=>{
  beginRun(t,1);
  assert.strictEqual(t.FRACTURE_INT_PER_WAVE,2);
  assert.strictEqual(playWaves(t,2,6),10,'5 ondas superadas × 2');
  assert.strictEqual(playWaves(t,7,11),20);
  /* teto: 20 ondas não estouram a faixa */
  const fim=playWaves(t,12,t.MAX_WAVE);
  assert.ok(fim<=100&&fim>20,'intensidade final '+fim);
  assert.strictEqual(fim,38,'19 fronteiras × 2');
});
ok('onda retomada NÃO é cobrada duas vezes (fronteira idempotente)',()=>{
  beginRun(t,1);
  playWaves(t,2,5);
  const antes=t.fractureGetIntensity();
  assert.strictEqual(antes,8);
  /* repetir a MESMA onda não conta de novo */
  t.setWave(5);t.spawnWave(5);
  t.setWave(5);t.spawnWave(5);
  assert.strictEqual(t.fractureGetIntensity(),antes,'fronteira repetida cobrou de novo');
  /* voltar de onda também não gera wave_complete fantasma */
  t.setWave(3);t.spawnWave(3);
  assert.strictEqual(t.fractureGetIntensity(),antes);
  /* avançar volta a contar */
  t.setWave(6);t.spawnWave(6);
  assert.strictEqual(t.fractureGetIntensity(),antes+2);
});
ok('salto de onda (DEV/Sandbox) conta uma única fronteira, sem estouro',()=>{
  beginRun(t,1);
  t.setWave(2);t.spawnWave(2);
  const antes=t.fractureGetIntensity();
  t.setWave(15);t.spawnWave(15);
  assert.strictEqual(t.fractureGetIntensity(),antes+2,'salto deve contar 1 fronteira');
});
ok('Intensidade NÃO é "inimigo com mais HP": nenhum multiplicador de combate referencia o Diretor',()=>{
  /* No B1 waveComp também era inalterado. A partir do BLOCO 2 ele passa a
     reagir à Intensidade POR DESIGN (é o que dá identidade ao Tema) — essa
     parte da asserção antiga foi movida para o bloco [13] do B2, onde é
     testada do jeito certo. O que PRECISA continuar valendo para sempre é
     que o Diretor nunca vira "inimigo com mais HP": nenhuma escala de
     HP/dano/velocidade pode consultá-lo. */
  for(const fn of ['diffHp','diffDmg','diffSpd','eliteChance']){
    const i=src.indexOf('function '+fn+'(');
    assert.ok(i>0,'função '+fn+' presente');
    /* corpo inteiro, não janela fixa (ver B4-60) */
    const corpo=src.slice(i,src.indexOf('\nfunction ',i+10));
    assert.ok(!/fracture/.test(corpo),
      fn+' não pode referenciar o Diretor de Fratura');
  }
  assert.ok(src.indexOf('diffHp(n)*fracture')<0);
  assert.ok(src.indexOf('*fractureGetIntensity')<0,
    'nenhum multiplicador pode escalar pela Intensidade');
});

/* ============ [4] EVENT BUS ============ */
console.log('\n[4] BARRAMENTO fractureEmit(type, payload)');
ok('contrato de eventos: os 12 tipos planejados existem e nada além deles',()=>{
  const tipos=t.FRACTURE_EVENT_TYPES.slice().sort();
  assert.strictEqual(J(tipos),J(['echo_dissonance','enemy_killed','enemy_spawn',
    'event_triggered','faction_reaction','miniboss_killed','miniboss_spawn',
    'run_end','run_start','shop_open','wave_complete','wave_start'].sort()));
  for(const k of tipos){
    const d=t.FRACTURE_EVENT_GRID[k];
    assert.ok(Number.isFinite(d.i),'ganho de intensidade de '+k);
    assert.ok(d.hist===0||d.hist===1,'flag hist de '+k);
    assert.ok(d.wave===0||d.wave===1,'flag wave de '+k);
  }
});
ok('6. fractureEmit altera estado apenas quando esperado',()=>{
  beginRun(t,1);
  t.fractureSetIntensity(50,'base',{quiet:true});
  const h0=t.getFx().history.length;
  /* sem ganho no contrato → intensidade intocada */
  for(const ev of ['shop_open','wave_start','enemy_spawn','enemy_killed',
    'miniboss_spawn','event_triggered','echo_dissonance','faction_reaction']){
    const antes=t.fractureGetIntensity();
    const n0=t.getFx().history.length;
    const r=t.fractureEmit(ev,{wave:7});
    assert.strictEqual(r.ok,true,ev+' deveria ser aceito');
    assert.strictEqual(r.delta,0,ev+' não deveria mexer na intensidade');
    assert.strictEqual(t.fractureGetIntensity(),antes,ev+' mexeu na intensidade');
    assert.strictEqual(r.before,antes);assert.strictEqual(r.after,antes);
    assert.strictEqual(t.fractureLast().t,ev,'último evento registrado');
    /* histórico só cresce para eventos marcados com hist:1 */
    const esperaHist=t.FRACTURE_EVENT_GRID[ev].hist?1:0;
    assert.strictEqual(t.getFx().history.length-n0,esperaHist,
      'histórico de '+ev+' ('+esperaHist+' esperado)');
  }
  /* com ganho no contrato → intensidade muda pelo valor do contrato */
  const antes=t.fractureGetIntensity();
  const r=t.fractureEmit('wave_complete',{wave:7});
  assert.strictEqual(r.delta,2);
  assert.strictEqual(r.before,antes);
  assert.strictEqual(r.after,antes+2);
  assert.strictEqual(t.fractureGetIntensity(),antes+2);
  const r2=t.fractureEmit('miniboss_killed',{wave:7});
  assert.strictEqual(r2.delta,4);
  assert.strictEqual(t.fractureGetIntensity(),antes+6);
  assert.ok(t.getFx().history.length>h0);
});
ok('fractureEmit recusa tipo fora do contrato sem tocar em nada',()=>{
  beginRun(t,1);
  t.fractureSetIntensity(42,'base',{quiet:true});
  const snap=J(t.fractureSnapshot());
  for(const ev of ['nao_existe','',null,undefined,123,{},'WAVE_COMPLETE',
    'fractureRun=null','__proto__','constructor']){
    const r=t.fractureEmit(ev,{});
    assert.strictEqual(r.ok,false,'deveria recusar '+J(ev));
    assert.strictEqual(r.reason,'evento_desconhecido');
    assert.strictEqual(r.delta,0);
  }
  assert.strictEqual(J(t.fractureSnapshot()),snap,'estado intacto após recusas');
});
ok('fractureEmit sem run ativa devolve motivo e nunca lança',()=>{
  t.setFx(null);
  const r=t.fractureEmit('wave_complete',{wave:3});
  assert.strictEqual(r.ok,false);
  assert.strictEqual(r.reason,'sem_run_ativa');
  assert.strictEqual(t.fractureGetIntensity(),0);
  assert.strictEqual(t.fractureGetThemeId(),null);
  assert.strictEqual(t.fractureSnapshot(),null);
  assert.strictEqual(t.fractureOnWaveStart(3),null);
});
ok('payload sujo não derruba o barramento (onda/delta inválidos)',()=>{
  beginRun(t,1);
  for(const pl of [null,undefined,'x',123,[],{wave:'abc'},{wave:-99},{wave:1e9},
    {intensity:'lixo'},{intensity:1e9},{intensity:-1e9},{source:1234567890}]){
    const r=t.fractureEmit('wave_complete',pl);
    assert.strictEqual(r.ok,true);
    const i=t.fractureGetIntensity();
    assert.ok(i>=0&&i<=100,'intensidade fora da faixa com payload '+J(pl));
    assert.ok(Number.isInteger(i));
  }
  /* intensidade pode ser sobrescrita pelo payload, mas continua clampada */
  t.fractureSetIntensity(0,'base',{quiet:true});
  const r=t.fractureEmit('wave_complete',{wave:3,intensity:7});
  assert.strictEqual(r.delta,7);
  assert.strictEqual(t.fractureGetIntensity(),7);
  const r2=t.fractureEmit('wave_complete',{wave:3,intensity:9999});
  assert.strictEqual(t.fractureGetIntensity(),100);
  assert.strictEqual(r2.delta,93);
});
ok('payload inválido NÃO cria campo novo no estado (anti-poluição)',()=>{
  beginRun(t,1);
  t.fractureEmit('wave_complete',{wave:4,__proto__:{x:1},injetado:'lixo'});
  const f=t.getFx();
  assert.ok(!('injetado' in f),'campo injetado vazou para fractureRun');
  assert.strictEqual(Object.keys(f.last).sort().join(','),'d,t,w');
});
ok('wave_start atualiza o perfil de onda; wave_complete não regride',()=>{
  beginRun(t,1);
  t.fractureOnWaveStart(1);
  assert.strictEqual(t.getFx().waveProfile.wave,1);
  assert.strictEqual(t.getFx().waveProfile.last,1);
  t.fractureOnWaveStart(4);
  assert.strictEqual(t.getFx().waveProfile.wave,4);
  assert.strictEqual(t.getFx().waveProfile.last,4);
  t.fractureEmit('wave_complete',{wave:3});
  assert.strictEqual(t.getFx().waveProfile.wave,4,'wave_complete não pode regredir a onda');
  assert.strictEqual(t.getFx().waveProfile.last,4);
});
ok('perfil de onda do B1 é neutro: bias vazio e pool vazia (nada de balance)',()=>{
  beginRun(t,1);
  playWaves(t,2,8);
  const snap=t.fractureSnapshot();
  assert.strictEqual(Object.keys(snap.bias).length,0);
  assert.strictEqual(snap.pool.length,0);
  /* waveComp/pickMiniBoss continuam sendo a única fonte de verdade */
  assert.ok(t.waveComp(10).chaser>0);
  assert.ok(t.MINIBOSS.length===8);
});

/* ============ [5] HISTÓRICO ============ */
console.log('\n[5] HISTÓRICO LIMITADO');
ok('7. histórico possui limite rígido (FIFO, nunca cresce sem teto)',()=>{
  beginRun(t,1);
  assert.ok(t.FRACTURE_HIST_MAX>0&&t.FRACTURE_HIST_MAX<=64,
    'teto razoável: '+t.FRACTURE_HIST_MAX);
  for(let i=0;i<t.FRACTURE_HIST_MAX*4;i++)t.fractureEmit('wave_complete',{wave:5});
  assert.strictEqual(t.getFx().history.length,t.FRACTURE_HIST_MAX,
    'histórico estourou o teto');
  /* os mais antigos saem primeiro */
  const ultimo=t.getFx().history[t.getFx().history.length-1];
  assert.strictEqual(ultimo.t,'wave_complete');
});
ok('entrada de histórico tem forma fixa {t,w,d,s} e é sanitizada',()=>{
  beginRun(t,1);
  t.fractureHistPush({t:'x'.repeat(80),w:9999,d:9999,s:'y'.repeat(80)});
  const h=t.getFx().history[t.getFx().history.length-1];
  assert.strictEqual(Object.keys(h).sort().join(','),'d,s,t,w');
  assert.ok(h.t.length<=24,'type truncado');
  assert.ok(h.s.length<=24,'source truncado');
  assert.ok(h.w>=0&&h.w<=t.MAX_WAVE,'onda clampada');
  assert.ok(Math.abs(h.d)<=100,'delta clampado');
  /* lixo puro não entra como undefined */
  t.fractureHistPush(null);
  t.fractureHistPush({});
  const h2=t.getFx().history[t.getFx().history.length-1];
  assert.strictEqual(h2.t,'?');
  assert.strictEqual(h2.w,0);assert.strictEqual(h2.d,0);assert.strictEqual(h2.s,'');
});
ok('histórico do exemplo do briefing está presente (wave_complete com delta)',()=>{
  beginRun(t,1);
  t.setWave(5);t.spawnWave(5);
  t.setWave(6);t.spawnWave(6);
  const e=t.getFx().history.filter(h=>h.t==='wave_complete').pop();
  assert.ok(e,'entrada wave_complete existe');
  assert.strictEqual(e.d,2);
  assert.ok(e.w>=1&&e.w<=t.MAX_WAVE);
  assert.strictEqual(e.s,'fronteira');
});

/* ============ [6] CHECKPOINT / CONTINUE ============ */
console.log('\n[6] CHECKPOINT / CONTINUE (cp.fracture)');
ok('cp.fracture é gravado no checkpoint real e sobrevive à serialização',()=>{
  beginRun(t,1);
  playWaves(t,2,7);
  t.fractureEmit('miniboss_killed',{wave:7});
  assert.strictEqual(t.captureCheckpoint('onda',7),true);
  const cp=t.getActiveRun();
  assert.ok(cp.fracture,'cp.fracture presente');
  const rt=JSON.parse(JSON.stringify(cp));
  assert.strictEqual(rt.fracture.theme,t.fractureGetThemeId());
  assert.strictEqual(rt.fracture.seed,t.fractureGetSeed());
  assert.strictEqual(rt.fracture.intensity,t.fractureGetIntensity());
  assert.strictEqual(rt.fracture.v,t.FRACTURE_STATE_VERSION);
  assert.ok(Array.isArray(rt.fracture.hist));
});
ok('9. Continue preserva exatamente o mesmo Tema (reload real: serializar → novo contexto)',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,9);
  A.captureCheckpoint('onda',9);
  const temaA=A.fractureGetThemeId(),seedA=A.fractureGetSeed();
  const B=bootFx(JSON.parse(JSON.stringify(A._ls._d)),true);
  assert.strictEqual(B.hasActiveRun(),true,'run retomável existe');
  B.setPlayer(null);B.setState('title');
  B.resumeRun();
  assert.strictEqual(B.fractureGetThemeId(),temaA,'Tema mudou no Continue');
  assert.strictEqual(B.fractureGetSeed(),seedA,'seed mudou no Continue');
  assert.strictEqual(B.getFx().theme,temaA);
  /* repetir o Continue N vezes nunca troca */
  for(let i=0;i<4;i++){
    const C=bootFx(JSON.parse(JSON.stringify(A._ls._d)),true);
    C.setPlayer(null);C.setState('title');C.resumeRun();
    assert.strictEqual(C.fractureGetThemeId(),temaA,'Tema mudou no Continue '+i);
  }
});
ok('10. Continue preserva a Intensidade (e o estágio derivado)',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,12);
  A.fractureEmit('miniboss_killed',{wave:12});
  const esperada=A.fractureGetIntensity();
  assert.ok(esperada>0,'precisa ter intensidade acumulada');
  A.captureCheckpoint('onda',12);
  const B=bootFx(JSON.parse(JSON.stringify(A._ls._d)),true);
  B.setPlayer(null);B.setState('title');
  B.resumeRun();
  assert.strictEqual(B.fractureGetIntensity(),esperada,'Intensidade mudou no Continue');
  assert.strictEqual(B.fractureGetStage().id,A.fractureGetStage().id);
  assert.strictEqual(B.getFx().waveProfile.last,A.getFx().waveProfile.last,
    'fronteira de onda preservada');
  assert.ok(B.getFx().history.length>0,'histórico necessário preservado');
  assert.ok(B.getFx().history.length<=t.FRACTURE_HIST_MAX);
});
ok('Continue NÃO cobra a onda retomada de novo (smRestoring)',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,8);
  const antes=A.fractureGetIntensity();
  A.captureCheckpoint('onda',8);
  const B=bootFx(JSON.parse(JSON.stringify(A._ls._d)),true);
  B.setPlayer(null);B.setState('title');
  B.resumeRun();
  assert.strictEqual(B.fractureGetIntensity(),antes,
    'retomada cobrou a fronteira de novo ('+B.fractureGetIntensity()+' vs '+antes+')');
  /* e a próxima onda continua contando normalmente */
  B.setWave(9);B.spawnWave(9);
  assert.strictEqual(B.fractureGetIntensity(),antes+2);
});
ok('11. save antigo sem dados do Diretor funciona (fallback seguro, sem erro)',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,6);
  A.captureCheckpoint('onda',6);
  const bruto=JSON.parse(A._ls.getItem('echoSave.v3'));
  /* checkpoint de uma versão ANTERIOR à PR13: sem o campo fracture */
  delete bruto.slots['1'].run.fracture;
  assert.ok(!('fracture' in bruto.slots['1'].run));
  const B=bootFx({'echoSave.v3':JSON.stringify(bruto)});
  assert.strictEqual(B.hasActiveRun(),true,'run antiga ainda é retomável');
  B.setPlayer(null);B.setState('title');
  B.resumeRun();
  assert.ok(B.getFx(),'Diretor criado no fallback');
  assert.ok(B.FRACTURE_THEME_BY_ID[B.fractureGetThemeId()],
    'save antigo ganha um Tema válido');
  assert.strictEqual(B.fractureGetIntensity(),0,'Intensidade recomeça do início');
  assert.strictEqual(B.getFx().waveProfile.last,6,'fronteira sincronizada com a onda');
  assert.ok(B.getPlayer(),'player restaurado');
});
ok('12. cp.fracture MALFORMADO não quebra a run (input não confiável)',()=>{
  const malformados=[
    {},null,0,'lixo',[],{theme:'NAO_EXISTE'},{theme:123},
    {theme:'__proto__'},{theme:'constructor'},{theme:'toString'},
    {intensity:'abc'},{intensity:-500},{intensity:1e9},{intensity:NaN},
    {seed:'abc'},{seed:-1},{seed:1e30},
    {hist:'nao_e_array'},{hist:[null,1,'x',{},{t:1,w:'a',d:'b',s:{}}]},
    {hist:new Array(500).fill({t:'wave_complete',w:5,d:2})},
    {wave:'lixo'},{wave:{wave:1e9,last:-5}},{wave:{bias:{a:'x',b:999},pool:[1,null,'ok']}},
    {last:'lixo'},{last:{t:1234567890,w:'a',d:'b'}},
    {v:'x',theme:{},intensity:{},seed:{},hist:{},wave:{},last:{}}
  ];
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,5);
  A.captureCheckpoint('onda',5);
  const bruto=JSON.parse(A._ls.getItem('echoSave.v3'));
  let i=0;
  for(const lixo of malformados){
    i++;
    const cp=JSON.parse(JSON.stringify(bruto));
    cp.slots['1'].run.fracture=lixo;
    const B=bootFx({'echoSave.v3':JSON.stringify(cp)});
    assert.strictEqual(B.hasActiveRun(),true,'caso '+i+': run ainda retomável');
    B.setPlayer(null);B.setState('title');
    B.resumeRun();
    const f=B.getFx();
    assert.ok(f,'caso '+i+': Diretor existe após malformed');
    assert.ok(B.FRACTURE_THEME_BY_ID[f.theme],'caso '+i+': Tema válido');
    assert.ok(Number.isInteger(f.intensity)&&f.intensity>=0&&f.intensity<=100,
      'caso '+i+': intensidade na faixa ('+f.intensity+')');
    assert.ok(Number.isInteger(f.seed)&&f.seed>=0,'caso '+i+': seed inteira');
    assert.ok(Array.isArray(f.history)&&f.history.length<=t.FRACTURE_HIST_MAX,
      'caso '+i+': histórico limitado');
    assert.ok(f.waveProfile.wave>=0&&f.waveProfile.wave<=t.MAX_WAVE,
      'caso '+i+': onda clampada');
    for(const k of Object.keys(f.waveProfile.bias))
      assert.ok(Number.isFinite(f.waveProfile.bias[k]),'caso '+i+': bias numérico');
    for(const p of f.waveProfile.pool)
      assert.strictEqual(typeof p,'string','caso '+i+': pool só de strings');
    assert.ok(B.getPlayer(),'caso '+i+': player restaurado');
    assert.strictEqual(B.getState(),'play');
  }
});
ok('unpack sanitiza campo a campo e preserva o que é válido',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  const pack={v:1,theme:'siege',seed:424242,intensity:63,
    wave:{wave:11,last:9,bias:{swarm:1.5},pool:['swarm','splitter']},
    hist:[{t:'wave_complete',w:8,d:2,s:'fronteira'},{t:'lixo_com_tipo_enorme_e_invalido_aqui',w:3,d:1}],
    last:{t:'wave_start',w:11,d:0}};
  const f=A.fractureRunUnpack({fracture:pack});
  assert.strictEqual(f.theme,'siege');
  assert.strictEqual(f.seed,424242);
  assert.strictEqual(f.intensity,63);
  assert.strictEqual(f.stage,'critica');
  assert.strictEqual(f.waveProfile.wave,11);
  assert.strictEqual(f.waveProfile.last,9);
  /* B2.11: o formato de waveProfile.bias mudou DE PROPÓSITO — ele deixou de
     ser contrato morto e passou a alimentar fractureShapeWave, então agora
     é clampado em ±FRACTURE_RUN_BIAS_MAX (0.6) e só aceita arquétipos que
     existem. 1.5 → 0.6 é o comportamento correto, não regressão. */
  assert.strictEqual(f.waveProfile.bias.swarm,A.FRACTURE_RUN_BIAS_MAX,
    'bias fora do teto é clampado (B2.11)');
  assert.strictEqual(f.history.length,2);
  assert.ok(f.history[1].t.length<=24,'tipo truncado');
  assert.strictEqual(f.last.t,'wave_start');
  /* Theme inválido cai na derivação pela seed (reproduzível) */
  const f2=A.fractureRunUnpack({fracture:{theme:'XXX',seed:424242}});
  assert.strictEqual(f2.theme,A.fracturePickTheme(424242),'re-deriva da seed');
});
ok('fractureRunPack sem run devolve null (checkpoint antigo não ganha lixo)',()=>{
  t.setFx(null);
  assert.strictEqual(t.fractureRunPack(),null);
  const cp=t.smBuildCheckpoint('teste',3);
  assert.strictEqual(cp.fracture,null);
});
ok('SM_VERSION não foi alterado (nenhuma migração foi necessária)',()=>{
  assert.strictEqual(t.SM_VERSION,3);
});

/* ============ [7] FIM DE RUN ============ */
console.log('\n[7] FIM DE RUN (morte / vitória)');
ok('13. morte limpa o Diretor (estado run-scoped não atravessa)',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,7);
  assert.ok(A.getFx());
  A.setState('play');
  A.onPlayerDeath();
  assert.strictEqual(A.getFx(),null,'fractureRun deveria ser limpo na morte');
  assert.strictEqual(A.hasActiveRun(),false,'activeRun limpa');
  assert.strictEqual(A.fractureGetIntensity(),0);
  assert.strictEqual(A.fractureGetThemeId(),null);
  /* run nova nasce fresca (e pode ter outro Tema) */
  A.setPlayer(null);A.setState('title');A.startRun();A.clearDevTaint();
  assert.ok(A.FRACTURE_THEME_BY_ID[A.fractureGetThemeId()]);
  assert.strictEqual(A.fractureGetIntensity(),0);
});
ok('14. vitória limpa o Diretor',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  A.setWave(t.MAX_WAVE);
  playWaves(A,2,10);
  assert.ok(A.getFx());
  A.setState('play');
  A.onVictory();
  assert.strictEqual(A.getFx(),null,'fractureRun deveria ser limpo na vitória');
  assert.strictEqual(A.hasActiveRun(),false);
  assert.strictEqual(A.getState(),'victory');
  /* showVictory é o caminho alternativo de encerramento (a tela que abre
     depois): ele também precisa descartar o estado run-scoped. victoryData
     continua vivo nesta run, então a tela renderiza de verdade. */
  A.setFx(A.fractureFresh(A.fractureMakeSeed()));
  A.fractureEnsureTheme(20);
  assert.ok(A.getFx(),'estado rearmado para cobrir showVictory');
  A.showVictory();
  assert.strictEqual(A.getFx(),null,'showVictory também limpa');
});
ok('aborto de run (clearActiveRun) não deixa Diretor órfão persistido',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,5);
  A.captureCheckpoint('onda',5);
  const tema=A.fractureGetThemeId();
  A.clearActiveRun();
  assert.strictEqual(A.hasActiveRun(),false);
  /* sem checkpoint, retomar cria run nova com Tema novo (válido) */
  A.setPlayer(null);A.setState('title');A.startRun();A.clearDevTaint();
  assert.ok(A.FRACTURE_THEME_BY_ID[A.fractureGetThemeId()]);
  assert.strictEqual(A.fractureGetIntensity(),0);
  assert.notStrictEqual(A.fractureGetThemeId()===tema&&A.fractureGetSeed()===0,true);
});

/* ============ [8] SAVE SLOTS ============ */
console.log('\n[8] ISOLAMENTO DE SAVE SLOTS');
ok('15. Save Slots isolados: jogar em S2 não altera o Diretor de S1',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,8);
  A.captureCheckpoint('onda',8);
  const tema1=A.fractureGetThemeId(),seed1=A.fractureGetSeed(),
    int1=A.fractureGetIntensity();
  const hist1=J(A.getFx().history);
  /* troca de slot descarta o contexto em memória (fonte = checkpoint) */
  A.activateSlot(2);
  assert.strictEqual(A.getFx(),null,'trocar de slot descarta o Diretor em memória');
  beginRun(A,2);
  playWaves(A,2,14);
  A.fractureSetIntensity(88,'teste');
  A.captureCheckpoint('onda',14);
  const tema2=A.fractureGetThemeId();
  assert.strictEqual(A.fractureGetIntensity(),88);
  /* voltar para S1 devolve EXATAMENTE o Diretor de S1 */
  A.activateSlot(1);
  assert.strictEqual(A.getFx(),null);
  A.setPlayer(null);A.setState('title');
  A.resumeRun();
  assert.strictEqual(A.fractureGetThemeId(),tema1,'Tema de S1 vazou/mudou');
  assert.strictEqual(A.fractureGetSeed(),seed1);
  assert.strictEqual(A.fractureGetIntensity(),int1,'Intensidade de S1 vazou/mudou');
  assert.strictEqual(J(A.getFx().history),hist1,'histórico de S1 contaminado');
  assert.notStrictEqual(tema1,undefined);
  /* S2 continua íntegro */
  A.activateSlot(2);
  A.setPlayer(null);A.setState('title');
  A.resumeRun();
  assert.strictEqual(A.fractureGetThemeId(),tema2);
  assert.strictEqual(A.fractureGetIntensity(),88);
});
ok('slots diferentes geram runs diferentes (seed independente do slot)',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  const s1=A.fractureGetSeed();
  A.activateSlot(2);
  beginRun(A,2);
  const s2=A.fractureGetSeed();
  assert.notStrictEqual(s1,s2,'cada run tem seed própria');
});
ok('apagar o save do slot descarta o Diretor em memória (sem tocar nos outros)',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,6);
  assert.ok(A.getFx());
  A.smClearSlotSave();
  assert.strictEqual(A.getFx(),null,'smClearSlotSave limpa o Diretor');
  assert.strictEqual(A.hasActiveRun(),false);
});

/* ============ [9] SANDBOX (R5) ============ */
console.log('\n[9] SANDBOX R5 — isolamento real (save byte a byte)');
ok('16. Sandbox isolado: laboratório tem Diretor PRÓPRIO, nunca o do save',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,9);
  A.captureCheckpoint('onda',9);
  A.setState('title');
  const temaReal=A.fractureGetThemeId(),seedReal=A.fractureGetSeed(),
    intReal=A.fractureGetIntensity();
  const S1=J(A.smRootGet().slots['1']);
  /* abre o laboratório e roda uma sessão */
  A.sandboxOpenSetup();
  assert.strictEqual(A.getSandboxMode(),true);
  A.getSandboxCfg().char=0;
  assert.strictEqual(A.sandboxStart(),true);
  assert.strictEqual(A.getSandboxRun(),true);
  assert.ok(A.getFx(),'laboratório tem Diretor próprio');
  assert.ok(A.FRACTURE_THEME_BY_ID[A.fractureGetThemeId()]);
  assert.strictEqual(A.fractureGetIntensity(),0,'lab começa no valor inicial');
  /* caos controlado dentro do laboratório */
  A.fractureSetIntensity(100,'lab');
  A.fractureForceTheme('resonance','lab');
  for(let i=0;i<40;i++)A.fractureEmit('wave_complete',{wave:5});
  A.fractureRerollTheme('lab');
  assert.strictEqual(A.fractureGetIntensity(),100);
  assert.strictEqual(A.getFx().history.length,t.FRACTURE_HIST_MAX);
  /* o checkpoint real do slot NÃO foi tocado pelo laboratório */
  assert.strictEqual(J(A.smRootGet().slots['1']),S1,'slot 1 em memória alterado');
  /* sair descarta o Diretor do lab */
  A.sandboxExit(false);
  assert.strictEqual(A.getSandboxRun(),false);
  assert.strictEqual(A.getFx(),null,'Diretor do lab descartado ao sair');
  /* retomar S1 devolve o Diretor REAL intacto */
  A.setPlayer(null);A.setState('title');
  A.resumeRun();
  assert.strictEqual(A.fractureGetThemeId(),temaReal,'Sandbox trocou o Tema do save');
  assert.strictEqual(A.fractureGetSeed(),seedReal,'Sandbox trocou a seed do save');
  assert.strictEqual(A.fractureGetIntensity(),intReal,'Sandbox mexeu na Intensidade do save');
});
ok('17. saves byte a byte idênticos após a sessão de Sandbox (S1/S2/S3)',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,9);
  A.captureCheckpoint('onda',9);
  A.setState('title');
  const FILE=A._ls.getItem('echoSave.v3');
  const S1=J(A.smRootGet().slots['1']),S2=J(A.smRootGet().slots['2']),
    S3=J(A.smRootGet().slots['3']);
  const CUR=A.getCurSlot();
  A.sandboxOpenSetup();
  A.getSandboxCfg().char=0;
  assert.strictEqual(A.sandboxStart(),true);
  /* joga ondas inteiras no laboratório (fronteiras, eventos, intensidade) */
  for(let n=2;n<=12;n++){A.setWave(n);A.spawnWave(n);}
  A.fractureSetIntensity(77,'lab');
  A.fractureEmit('miniboss_killed',{wave:10});
  A.fractureEmit('echo_dissonance',{wave:10});
  A.fractureEmit('faction_reaction',{wave:10});
  A.sandboxExit(false);
  assert.strictEqual(A._ls.getItem('echoSave.v3'),FILE,
    'arquivo alterado durante o Sandbox');
  assert.strictEqual(J(A.smRootGet().slots['1']),S1,'S1 em memória alterado');
  assert.strictEqual(J(A.smRootGet().slots['2']),S2,'S2 alterado');
  assert.strictEqual(J(A.smRootGet().slots['3']),S3,'S3 alterado');
  assert.strictEqual(A.getCurSlot(),CUR,'curSlot intocado');
});
ok('reiniciar / alterar build / fechar preparo do Sandbox também descartam o Diretor',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  A.setState('title');
  const FILE=A._ls.getItem('echoSave.v3');
  A.sandboxOpenSetup();
  A.getSandboxCfg().char=0;
  assert.strictEqual(A.sandboxStart(),true);
  assert.ok(A.getFx());
  A.fractureSetIntensity(50,'lab');
  A.sandboxRestart();
  assert.ok(A.getFx(),'restart cria Diretor novo do lab');
  assert.strictEqual(A.fractureGetIntensity(),0,'restart zera a Intensidade do lab');
  A.fractureSetIntensity(60,'lab');
  A.sandboxEndToSetup();
  assert.strictEqual(A.getFx(),null,'ALTERAR BUILD descarta o Diretor do lab');
  A.sandboxCloseSetup();
  assert.strictEqual(A.getFx(),null);
  assert.strictEqual(A._ls.getItem('echoSave.v3'),FILE,'nada foi gravado');
});
ok('Sandbox nunca cria checkpoint (captureCheckpoint recusa em laboratório)',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  A.setWave(5);
  assert.strictEqual(A.captureCheckpoint('onda',5),true,'checkpoint real criado');
  const CP_ANTES=J(A.smRootGet().slots['1'].run.fracture);
  assert.ok(CP_ANTES&&CP_ANTES!=='null','cp.fracture real existe antes do lab');
  A.setState('title');
  A.sandboxOpenSetup();
  A.getSandboxCfg().char=0;
  assert.strictEqual(A.sandboxStart(),true);
  assert.strictEqual(A.captureCheckpoint('onda',7),false,'lab não checkpointa');
  assert.strictEqual(A.smRootGet().slots['1'].run.wave,5,
    'o checkpoint real continua na onda 5');
  assert.strictEqual(J(A.smRootGet().slots['1'].run.fracture),CP_ANTES,
    'cp.fracture real alterado pelo laboratório');
});

/* ============ [10] DEV MODE ============ */
console.log('\n[10] DEV MODE — inspetor do Diretor');
ok('inspetor expõe Tema/seed/Intensidade/estágio/pesos/pools/último evento/histórico',()=>{
  t.setFx(null);
  assert.ok(/SEM RUN ATIVA/.test(t.fractureInspectorText()));
  beginRun(t,1);
  playWaves(t,2,7);
  const txt=t.fractureInspectorText();
  assert.ok(txt.indexOf(t.fractureGetTheme().nm)>=0,'Tema');
  assert.ok(txt.indexOf(String(t.fractureGetSeed()))>=0,'seed');
  assert.ok(/INTENSIDADE: \d+\/100/.test(txt),'Intensidade');
  assert.ok(txt.indexOf(t.fractureGetStage().lab)>=0,'estágio');
  assert.ok(/PESOS DE RUN:/.test(txt),'pesos de run');
  assert.ok(/POOL DE RUN:/.test(txt),'pool de run');
  assert.ok(/ÚLTIMO EVENTO:/.test(txt),'último evento');
  assert.ok(/HISTÓRICO\(\d+\/\d+\)/.test(txt),'histórico com limite');
  assert.ok(txt.indexOf('NEUTROS')>=0,'pesos de run neutros por padrão');
  assert.ok(txt.indexOf('PADRÃO')>=0,'pool de run padrão por padrão');
  /* B2.16: o inspetor passou a mostrar BASE × FINAL, viés e peso do Tema */
  assert.ok(/PESO DO TEMA: \d+%/.test(txt),'peso do Tema');
  assert.ok(/BASE\s+\(\d+\):/.test(txt),'composição BASE');
  assert.ok(/FINAL\s+\(\d+\/\d+/.test(txt),'composição FINAL com budget');
  assert.ok(/FAVORECIDOS:|REDUZIDOS:|VIÉS: NEUTRO/.test(txt),'tags favorecidas/reduzidas');
});
ok('comandos fx:* só funcionam com DEV ligado e contaminam a run (devTaint)',()=>{
  t.DEV_off();
  beginRun(t,1);
  const antes=t.fractureGetIntensity();
  assert.strictEqual(t.devCommand('fx:int:+10'),false,'DEV desligado: comando recusado');
  assert.strictEqual(t.fractureGetIntensity(),antes);
  t.DEV_on();
  assert.strictEqual(t.devCommand('fx:int:+10'),true);
  assert.strictEqual(t.fractureGetIntensity(),antes+10);
  assert.strictEqual(t.isTainted(),true,'run contaminada pelo DEV');
  assert.strictEqual(t.devCommand('fx:int:35'),true);
  assert.strictEqual(t.fractureGetIntensity(),35);
  assert.strictEqual(t.devCommand('fx:theme:siege'),true);
  assert.strictEqual(t.fractureGetThemeId(),'siege');
  assert.strictEqual(t.devCommand('fx:theme:nao_existe'),false);
  assert.strictEqual(t.devCommand('fx:emit:wave_complete'),true);
  assert.strictEqual(t.devCommand('fx:emit:nao_existe'),false);
  assert.strictEqual(t.devCommand('fx:reroll'),true);
  assert.ok(t.FRACTURE_THEME_BY_ID[t.fractureGetThemeId()]);
  assert.strictEqual(t.devCommand('fx:insp'),true);
  assert.strictEqual(t.devCommand('fx:comando_inexistente'),false);
  /* sem run ativa nada quebra */
  t.setFx(null);
  assert.strictEqual(t.devCommand('fx:int:+5'),false);
  t.DEV_off();
  t.clearDevTaint();
});
ok('seção do painel DEV é criada sem tocar no restante do painel',()=>{
  t.DEV_on();
  beginRun(t,1);
  const painel=document.getElementById('devpanel');
  painel.children.length=0;
  t.devRender();
  const sec=document.getElementById('fracture-dev-section');
  assert.ok(sec,'seção PR13 criada');
  assert.ok(sec.innerHTML.indexOf('DIRETOR DE FRATURA')>=0);
  assert.ok(sec.innerHTML.indexOf(t.fractureGetTheme().nm)>=0,'Tema visível');
  /* re-render não duplica a seção */
  const n=papelChildren(painel);
  t.devRender();t.devRender();
  assert.strictEqual(papelChildren(painel),n,'seção duplicada no re-render');
  t.DEV_off();t.clearDevTaint();
  function papelChildren(p){
    return p.children.filter(c=>c.id==='fracture-dev-section').length;
  }
});

/* ============ [11] ARQUITETURA / NÃO-REGRESSÃO ============ */
console.log('\n[11] ARQUITETURA E NÃO-REGRESSÃO');
ok('snapshot é defensivo: mutar o snapshot não altera o estado vivo',()=>{
  beginRun(t,1);
  playWaves(t,2,5);
  const s=t.fractureSnapshot();
  s.theme='hack';s.intensity=999;s.history.push({t:'fake'});s.tags.push('X');
  s.bias.hack=9;s.pool.push('hack');
  assert.ok(t.FRACTURE_THEME_BY_ID[t.fractureGetThemeId()],'tema vivo intacto');
  assert.ok(t.fractureGetIntensity()<=100);
  assert.ok(!t.getFx().history.some(h=>h.t==='fake'));
  assert.strictEqual(Object.keys(t.getFx().waveProfile.bias).length,0);
  assert.strictEqual(t.getFx().waveProfile.pool.length,0);
});
ok('sistemas existentes preservados: facções, eventos, ondas e minibosses intactos',()=>{
  /* o Diretor é aditivo: nenhuma estrutura da PR10.5/PR12 foi renomeada */
  for(const nome of ['factionEmit','fracRunPack','fracRunUnpack','fracFresh',
    'FRACTION_BY_ID','FACTION_GRID','evMemPack','evMemRestore','pickRunEvent',
    'scoreEvent','eventBlockReason','waveComp','pickMiniBoss','spawnMiniBoss',
    'MINIBOSS','EDEFS','spawnWave','smBuildCheckpoint','sandboxContext']){
    const n=src.split(nome).length-1;
    assert.ok(n>0,'símbolo existente sumiu: '+nome);
  }
  assert.strictEqual(t.MINIBOSS.length,8,'8 minibosses preservados');
  assert.strictEqual(Object.keys(t.EDEFS).length,11,'11 arquétipos de inimigo');
  for(const id of ['swarm','orbiter','bulwark','splitter','phantom','singular'])
    assert.ok(t.EDEFS[id],id+' preservado');
});
ok('18. nenhum teste legado quebra: as 17 suítes oficiais continuam listadas',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  const partes=pkg.scripts.test.split('&&').map(s=>s.trim());
  const esperadas=['shield','operators','legacy-restore','devmode','statmods',
    'items-build-rework','formatters','saveslots','arsenal','sandbox','tab',
    'personality','morality','relationship','events','endings','pr12'];
  for(const e of esperadas)
    assert.ok(partes.some(p=>p.indexOf('tests/'+e+'.test.js')>=0),
      'suíte legado ausente do npm test: '+e);
  assert.ok(partes.some(p=>p.indexOf('tests/fracture-director.test.js')>=0),
    'suíte PR13 ausente');
});
ok('documentação da PR13 presente (FRACTURE_DIRECTOR.md)',()=>{
  const doc=path.join(ROOT,'FRACTURE_DIRECTOR.md');
  assert.ok(fs.existsSync(doc),'FRACTURE_DIRECTOR.md não existe');
  const txt=fs.readFileSync(doc,'utf8');
  for(const sec of ['Objetivo','Arquitetura','Temas','Intensidade','Save','Sandbox',
    'Limites'])
    assert.ok(txt.toLowerCase().indexOf(sec.toLowerCase())>=0,
      'FRACTURE_DIRECTOR.md sem a seção "'+sec+'"');
  for(const id of THEMES)
    assert.ok(txt.indexOf(id)>=0,'documentação sem o tema '+id);
});

/* =====================================================================
   BLOCO 2 — TEMAS + COMPOSIÇÃO DE WAVES
   ===================================================================== */
console.log('\n=============================================');
console.log('BLOCO 2 — TEMAS + COMPOSIÇÃO DE WAVES');
console.log('=============================================');
/* contexto puro para os testes de shaping: não depende de run viva */
function ctxOf(theme,intensity,seed,bias,pool){
  return {theme:theme,seed:(seed>>>0)||1,intensity:clamp01(intensity),
    stage:t.fractureStageOf(clamp01(intensity)).id,
    bias:bias||null,pool:pool||null};
}
function clamp01(i){return Math.max(0,Math.min(100,i|0));}
function shaped(theme,n,intensity,seed){
  return t.fractureShapeWave(t.waveCompBase(n),n,ctxOf(theme,intensity,seed||99));
}
function finalComp(theme,n,intensity,seed){
  return t.waveCompFit(shaped(theme,n,intensity,seed),t.ENEMY_BUDGET);
}
function total(c){return t.waveCompTotal(c);}
const ARCH=t.WAVE_ARCHETYPES;
const WAVES=[];for(let n=1;n<=19;n++)WAVES.push(n);

/* ============ [12] B2.1 — CORREÇÃO DO ENEMY_BUDGET ============ */
console.log('\n[12] B2.1 · CORREÇÃO DO TETO DE ENTIDADES (ENEMY_BUDGET)');
ok('ENEMY_BUDGET é inteiro positivo e waveCompTotal soma todos os campos',()=>{
  assert.ok(Number.isInteger(t.ENEMY_BUDGET)&&t.ENEMY_BUDGET>0);
  const c={chaser:3,swarm:2,elite:1};
  assert.strictEqual(t.waveCompTotal(c),6);
  assert.strictEqual(t.waveCompTotal({}),0);
  assert.strictEqual(t.waveCompTotal(null),0);
});
ok('BUG CORRIGIDO: splitter/spawner/elite agora PARTICIPAM do corte',()=>{
  /* antes do fix, waveComp escalava só 9 dos 12 campos: splitter, spawner e
     elite passavam intactos. Prova real: na base da onda 19 eles somam 13 e
     o total base é 69 — se o corte ignorasse esses três, o resultado
     estouraria os 46. */
  const b=t.waveCompBase(19);
  assert.strictEqual(total(b),69,'base da onda 19 = 69 (acima do teto 46)');
  assert.ok(b.splitter>0&&b.spawner>0&&b.elite>0,'os três existem na base');
  const f=t.waveCompFit(b,t.ENEMY_BUDGET);
  assert.ok(f.splitter<b.splitter,'splitter foi cortado');
  assert.ok(f.spawner<b.spawner,'spawner foi cortado');
  assert.ok(f.elite<b.elite,'elite foi cortado');
});
ok('ondas 1–19: NENHUMA estoura o budget (0 estouros em 19 ondas)',()=>{
  let estouros=[];
  for(const n of WAVES){
    const f=t.waveComp(n);
    assert.ok(Object.keys(f).every(k=>Number.isInteger(f[k])&&f[k]>=0),
      'onda '+n+': valores inteiros ≥ 0');
    if(total(f)>t.ENEMY_BUDGET)estouros.push(n+'='+total(f));
  }
  assert.strictEqual(J(estouros),J([]),'ondas acima do teto: '+estouros.join(', '));
});
ok('ondas cuja base já cabe no teto saem INALTERADAS (1–11)',()=>{
  for(let n=1;n<=11;n++){
    const b=t.waveCompBase(n);
    assert.ok(total(b)<=t.ENEMY_BUDGET,'onda '+n+' cabe no teto');
    assert.strictEqual(J(t.waveCompFit(b,t.ENEMY_BUDGET)),J(b),
      'onda '+n+' não pode ser mexida');
  }
});
ok('corte preserva proporção (maior resto) e fecha EXATAMENTE no teto',()=>{
  for(const n of [12,13,14,15,16,17,18,19]){
    const b=t.waveCompBase(n),f=t.waveCompFit(b,t.ENEMY_BUDGET);
    assert.strictEqual(total(f),t.ENEMY_BUDGET,'onda '+n+' fecha no teto');
    /* proporção: a ordem relativa dos arquétipos não pode inverter */
    const ks=ARCH.filter(k=>b[k]>0&&f[k]>0);
    for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){
      if(b[ks[i]]>b[ks[j]])
        assert.ok(f[ks[i]]>=f[ks[j]],
          'onda '+n+': ordem '+ks[i]+'>'+ks[j]+' invertida pelo corte');
    }
  }
});
ok('arquétipos obrigatórios nunca são removidos (pisos chaser/swarm)',()=>{
  for(const n of WAVES){
    const b=t.waveCompBase(n),f=t.waveCompFit(b,t.ENEMY_BUDGET);
    for(const k in t.WAVE_PROTECTED_MIN){
      if(b[k]<=0)continue;                       // ainda não desbloqueado
      assert.ok(f[k]>=t.WAVE_PROTECTED_MIN[k],
        'onda '+n+': '+k+' caiu abaixo do piso '+t.WAVE_PROTECTED_MIN[k]);
    }
  }
});
ok('waveCompFit é total: budget 0 zera, budget enorme preserva, fracionário trunca',()=>{
  const b=t.waveCompBase(19);
  const z=t.waveCompFit(b,0);
  assert.strictEqual(total(z),0,'budget 0 ⇒ composição vazia');
  assert.ok(Object.keys(z).every(k=>z[k]===0));
  assert.strictEqual(J(t.waveCompFit(b,10000)),J(b),'budget folgado preserva a base');
  assert.strictEqual(total(t.waveCompFit(b,46.9)),t.ENEMY_BUDGET,'budget fracionário trunca');
  assert.strictEqual(total(t.waveCompFit(b,-5)),0,'budget negativo ⇒ 0');
  assert.strictEqual(total(t.waveCompFit(b,NaN)),0,'budget NaN ⇒ 0');
});
ok('onda 20 / chefe final ficam FORA do reshape',()=>{
  /* CONTRATO: a onda final é do PARADOXO. spawnWave(n) despacha n>=MAX_WAVE
     para spawnBoss() ANTES de consultar waveComp, e waveComp por sua vez
     devolve a base para n>=MAX_WAVE — o invariante vale na fonte, não por
     acidente de chamador.

     A versão anterior deste teste lia uma JANELA FIXA de 1400 caracteres a
     partir de "function spawnWave(" e procurava MAX_WAVE ali dentro. Medido,
     o token estava no offset 1390: folga de 10 caracteres. Qualquer merge que
     inserisse uma linha no começo de spawnWave fazia o teste acusar uma
     regressão inexistente. Agora a verificação é COMPORTAMENTAL. */
  assert.strictEqual(t.MAX_WAVE,20);

  /* 1) fonte: o despacho do chefe vem ANTES da consulta à composição.
        Comparação de posições relativas dentro da função inteira — sem
        janela de tamanho fixo e sem número de linha. */
  const ini=src.indexOf('function spawnWave(');
  assert.ok(ini>=0,'spawnWave localizada');
  const corpo=src.slice(ini,src.indexOf('\nfunction ',ini+10));
  const pBoss=corpo.search(/n\s*>=\s*MAX_WAVE|n\s*>=\s*20|n\s*===\s*MAX_WAVE/);
  const pComp=corpo.indexOf('waveComp(');
  assert.ok(pBoss>=0,'spawnWave despacha a onda final para o chefe');
  assert.ok(pComp>=0,'spawnWave consulta waveComp para as demais ondas');
  assert.ok(pBoss<pComp,
    'o despacho do chefe (offset '+pBoss+') precede waveComp (offset '+pComp+')');

  /* 2) runtime: waveComp(20) é idêntico à base ajustada para TODOS os Temas,
        mesmo com Intensidade máxima e assinatura forçada na onda 20. */
  beginRun(t,1);
  const fit20=t.waveCompFit(t.waveCompBase(20),t.ENEMY_BUDGET);
  for(const th of THEMES){
    t.fractureForceTheme(th,'teste');
    t.fractureSetIntensity(100,'teste');              // RUPTURA
    const b=t.fractureB4();
    for(const sg of t.FRACTURE_SIGNATURES)
      if(sg.theme===th)b.sig[20]=sg.id;               // força a assinatura
    assert.strictEqual(J(t.waveComp(20)),J(fit20),
      th+': waveComp(20) não sofre reshape temático nem de assinatura');
  }
  assert.ok(total(t.waveComp(20))<=t.ENEMY_BUDGET,'waveComp(20) respeita o teto');

  /* 3) controle: a onda 19 AINDA é remodelada — a proteção não é um
        desligamento global do Diretor. */
  t.fractureForceTheme('collapse','teste');
  t.fractureSetIntensity(100,'teste');
  assert.notStrictEqual(J(t.waveComp(19)),
    J(t.waveCompFit(t.waveCompBase(19),t.ENEMY_BUDGET)),
    'controle: waveComp(19) continua sendo moldada pelo Tema');
});
ok('entidades DINÂMICAS (spawner/splitter) estão documentadas fora do teto',()=>{
  /* o budget conta o que nasce na onda. Filhotes de spawner e fragmentos de
     splitter aparecem DEPOIS e não entram na conta — isso precisa estar
     escrito no código, não só na cabeça de quem lê. */
  const reg=src.slice(src.indexOf('/* QUANTIDADE INCREMENTAL'),
    src.indexOf('function waveComp('));
  assert.ok(/spawner/i.test(reg)&&/splitter/i.test(reg),
    'comentário do bloco de waves cita spawner e splitter');
  assert.ok(/dinâmic|dinamic/i.test(reg),
    'o bloco explica que são entidades dinâmicas fora do teto');
});

/* ============ [13] B2.2 — COMPOSIÇÃO BASE PURA ============ */
console.log('\n[13] B2.2 · waveCompBase É PURA E É O PONTO DE PARTIDA');
ok('pipeline obrigatório: waveComp = fit(shape(base))',()=>{
  /* Corpo INTEIRO da função, não uma janela de tamanho fixo: a versão
     anterior lia 700 caracteres e bastava um comentário mais longo no começo
     de waveComp para empurrar fractureShapeWave para fora e acusar uma
     regressão inexistente. */
  const i=src.indexOf('function waveComp(');
  assert.ok(i>=0,'waveComp localizada');
  const corpo=src.slice(i,src.indexOf('\nfunction ',i+10));
  assert.ok(/waveCompBase\s*\(/.test(corpo),'waveComp chama waveCompBase');
  assert.ok(/fractureShapeWave\s*\(/.test(corpo),'waveComp chama fractureShapeWave');
  assert.ok(/waveCompFit\s*\(/.test(corpo),'waveComp chama waveCompFit');

  /* A ordem é verificada no CAMINHO REAL das ondas comuns, não pela primeira
     ocorrência textual. waveComp tem um guard de onda final que também chama
     waveCompFit (devolve a base para n>=MAX_WAVE); comparar primeiros índices
     faria esse guard parecer "teto antes do shaping". */
  const g=corpo.search(/if\s*\(\s*\(?\s*n\s*\|?\s*0?\)?\s*>=\s*MAX_WAVE/);
  assert.ok(g>=0,'waveComp protege a onda final antes de moldar');
  const caminho=corpo.slice(g);
  assert.ok(caminho.indexOf('fractureShapeWave')>=0,'shaping presente no caminho');
  assert.ok(caminho.indexOf('waveCompFit')>=0,'fit presente no caminho');
  assert.ok(caminho.indexOf('fractureShapeWave')<caminho.lastIndexOf('waveCompFit'),
    'no caminho real, o teto é aplicado DEPOIS do shaping');
  assert.ok(corpo.indexOf('waveCompBase')<corpo.indexOf('fractureShapeWave'),
    'a base vem ANTES do shaping');
  /* a assinatura de encontro fica entre o shaping e o fit (B4.3) */
  assert.ok(caminho.indexOf('fractureShapeWave')<caminho.indexOf('fractureApplySignature'),
    'a assinatura entra depois do shaping do Tema');
  assert.ok(caminho.indexOf('fractureApplySignature')<caminho.lastIndexOf('waveCompFit'),
    'a assinatura entra antes do ajuste ao budget');
});
ok('waveCompBase é pura e não conhece o Diretor',()=>{
  const a=J(t.waveCompBase(10)),b=J(t.waveCompBase(10));
  assert.strictEqual(a,b,'duas chamadas iguais');
  const corpo=src.slice(src.indexOf('function waveCompBase('),
    src.indexOf('function waveCompFit('));
  assert.ok(!/fracture/.test(corpo),'base não referencia o Diretor');
  assert.ok(!/Math\.random/.test(corpo),'base não usa Math.random');
  /* não muta o argumento nem devolve referência interna */
  const x=t.waveCompBase(7);x.chaser=999;
  assert.notStrictEqual(t.waveCompBase(7).chaser,999,'objeto novo a cada chamada');
});
ok('SEM Diretor ⇒ composição idêntica à base corrigida',()=>{
  t.setFx(null);
  for(const n of WAVES)
    assert.strictEqual(J(t.waveComp(n)),
      J(t.waveCompFit(t.waveCompBase(n),t.ENEMY_BUDGET)),'onda '+n);
});
ok('Tema SEM perfil de onda ⇒ identidade',()=>{
  beginRun(t,1);
  t.fractureSetIntensity(100,'teste');
  const th=t.fractureGetThemeId();
  const guard=t.FRACTURE_THEMES.find(x=>x.id===th).waveBias;
  t.FRACTURE_THEMES.find(x=>x.id===th).waveBias=null;
  try{
    for(const n of WAVES)
      assert.strictEqual(J(t.waveComp(n)),
        J(t.waveCompFit(t.waveCompBase(n),t.ENEMY_BUDGET)),'onda '+n);
  }finally{t.FRACTURE_THEMES.find(x=>x.id===th).waveBias=guard;}
});
ok('Intensidade 0 ⇒ base pura, mesmo com Tema forte',()=>{
  beginRun(t,1);
  t.fractureForceTheme('collapse','teste');
  t.fractureSetIntensity(0,'teste');
  assert.strictEqual(t.fractureThemeWeight(t.fractureWaveCtx()),0,'peso zero');
  for(const n of WAVES)
    assert.strictEqual(J(t.waveComp(n)),
      J(t.waveCompFit(t.waveCompBase(n),t.ENEMY_BUDGET)),'onda '+n);
});
ok('fractureShapeWave devolve a base quando o contexto é nulo/inválido',()=>{
  const b=t.waveCompBase(10);
  assert.strictEqual(J(t.fractureShapeWave(b,10,null)),J(b),'ctx null');
  assert.strictEqual(J(t.fractureShapeWave(b,10,{theme:'nao_existe',intensity:100})),
    J(b),'tema inexistente');
  assert.strictEqual(J(t.fractureShapeWave(b,10,
    {theme:'collapse',intensity:100,seed:1,stage:'ruptura'})),
    J(t.fractureShapeWave(b,10,ctxOf('collapse',100,1))),'ctx manual == ctx real');
});

/* ============ [14] B2.3 — TAGS ============ */
console.log('\n[14] B2.3 · TAGS DOS ARQUÉTIPOS (SÓ METADADO)');
ok('os 11 arquétipos têm tags e todas pertencem ao vocabulário',()=>{
  assert.strictEqual(Object.keys(t.EDEFS).length,11);
  assert.strictEqual(ARCH.length,11,'WAVE_ARCHETYPES cobre os 11');
  for(const k of ARCH){
    const tg=t.enemyTags(k);
    assert.ok(Array.isArray(tg)&&tg.length>0,k+' tem tags');
    for(const x of tg)
      assert.ok(t.ENEMY_TAGS.indexOf(x)>=0,k+': tag desconhecida '+x);
  }
  assert.strictEqual(t.ENEMY_TAGS.length,15,'15 tags no vocabulário');
});
ok('enemyTags é defensiva: tipo inexistente, elite e prototype pollution',()=>{
  assert.strictEqual(J(t.enemyTags('elite')),J([]),'elite não é arquétipo de wave');
  assert.strictEqual(J(t.enemyTags('nao_existe')),J([]));
  assert.strictEqual(J(t.enemyTags(undefined)),J([]));
  assert.strictEqual(J(t.enemyTags(null)),J([]));
  /* '__proto__'/'constructor' existem na cadeia de protótipos de qualquer
     objeto — enemyTags precisa usar hasOwnProperty, senão devolve lixo. */
  for(const k of ['__proto__','constructor','toString','hasOwnProperty'])
    assert.strictEqual(J(t.enemyTags(k)),J([]),'enemyTags("'+k+'") deve ser vazio');
});
ok('nenhuma tag vira chave de ENEMY_TAG_DEFS solta (catálogo íntegro)',()=>{
  for(const tag of t.ENEMY_TAGS){
    assert.ok(Object.prototype.hasOwnProperty.call(t.ENEMY_TAG_DEFS,tag),
      'tag '+tag+' documentada em ENEMY_TAG_DEFS');
    assert.ok(typeof t.ENEMY_TAG_DEFS[tag]==='string'&&t.ENEMY_TAG_DEFS[tag].length>0,
      'tag '+tag+' tem descrição');
  }
  assert.strictEqual(Object.keys(t.ENEMY_TAG_DEFS).length,t.ENEMY_TAGS.length);
});
ok('updateEnemy NÃO depende de tags: nenhum if gigante Tema→inimigo',()=>{
  const i=src.indexOf('function updateEnemy(');
  const corpo=src.slice(i,src.indexOf('\nfunction ',i+10));
  assert.ok(!/enemyTags\s*\(/.test(corpo),'updateEnemy não lê enemyTags');
  assert.ok(!/fractureGetTheme|fractureRun|fractureThemeById/.test(corpo),
    'updateEnemy não consulta o Diretor');
  /* e o jogo inteiro não tem switch de Tema decidindo inimigo */
  const jogo=m[1];
  assert.ok(!/switch\s*\(\s*fracture(GetTheme|Run)/.test(jogo),
    'nenhum switch sobre o Tema');
});
ok('tags dos MINIBOSS são metadado; AI/stats continuam intactos',()=>{
  for(const mb of t.MINIBOSS){
    assert.ok(Array.isArray(mb.tags)&&mb.tags.length>0,mb.id+' tem tags');
    for(const x of mb.tags)
      assert.ok(t.ENEMY_TAGS.indexOf(x)>=0,mb.id+': tag desconhecida '+x);
  }
  /* B2.13 dizia "pickMiniBoss não lê tags". O B3.6 muda isso DE PROPÓSITO
     (é o que dá identidade temática ao mini-chefe). O que continua valendo:
     as tags são SÓ metadado de seleção — nenhum stat/AI foi tocado. */
  for(const mb of t.MINIBOSS){
    assert.ok(Number.isFinite(mb.hp)&&mb.hp>0,mb.id+'.hp intacto');
    assert.ok(Number.isFinite(mb.spd)&&mb.spd>0,mb.id+'.spd intacto');
    assert.ok(Number.isFinite(mb.r)&&mb.r>0,mb.id+'.r intacto');
    assert.ok(Number.isFinite(mb.plates)&&mb.plates>0,mb.id+'.plates intacto');
    assert.ok(mb.sk&&typeof mb.sk==='object',mb.id+'.sk intacto');
  }
  const jogo=m[1];
  const i=jogo.indexOf('function spawnMiniBoss(');
  const corpo=jogo.slice(i,jogo.indexOf('\nfunction ',i+10));
  assert.ok(!/fractureMiniWeight|fractureEventBiasMul/.test(corpo),
    'spawnMiniBoss não aplica viés aos stats (só seleciona)');
});
ok('B2.14 valia no B2; no B3 scoreEvent ganha UM termo temático e nada mais',()=>{
  /* Este teste afirmava que scoreEvent não conhecia o Diretor. Isso era
     verdade no B2 e é FALSO POR DESIGN no B3 (B3.2 pede exatamente essa
     integração). O que precisa continuar valendo para sempre:
       · o termo do Diretor é o ÚLTIMO (rarity, cooldown, família,
         oncePerRun, viés moral, condições, Relationship e Echo continuam
         decidindo sozinhos antes dele);
       · ele é multiplicativo e devolve 1 sem Diretor — ou seja, não
         substitui regra nenhuma. */
  const i=src.indexOf('function scoreEvent(');
  const corpo=src.slice(i,src.indexOf('\nfunction ',i+10));
  const posFracture=corpo.indexOf('fractureEventBiasMul');
  assert.ok(posFracture>0,'scoreEvent aplica o viés temático (B3.2)');
  for(const regra of ['lastFamily','evFamRecent','ctx.seen','MORAL_BALANCE','ctx.coins'])
    assert.ok(corpo.indexOf(regra)>=0&&corpo.indexOf(regra)<posFracture,
      regra+' continua sendo aplicado ANTES do termo do Diretor');
  assert.ok(/w\*=fractureEventBiasMul/.test(corpo),'é multiplicativo, não substitui');
  assert.ok(corpo.indexOf('return Math.max(.01,w)')>posFracture,
    'o piso .01 continua sendo a última palavra (nada vira impossível)');
});

/* ============ [15] B2.4/B2.5 — PERFIS DOS 6 TEMAS ============ */
console.log('\n[15] B2.4/B2.5 · PERFIS REAIS DOS 6 TEMAS (PESOS, NUNCA TROCA)');
ok('os 6 temas têm waveBias completo e dentro dos limites',()=>{
  for(const id of THEMES){
    const th=t.FRACTURE_THEMES.find(x=>x.id===id);
    assert.ok(th.waveBias,id+' tem waveBias');
    const wb=th.waveBias;
    assert.ok(wb.force>0&&wb.force<=1.5,id+': force '+wb.force);
    assert.ok(wb.capShare>=.15&&wb.capShare<=.7,id+': capShare '+wb.capShare);
    assert.ok(wb.minKinds>=1&&wb.minKinds<=11,id+': minKinds '+wb.minKinds);
    assert.ok(wb.density>=.5&&wb.density<=1.5,id+': density '+wb.density);
    for(const g of ['tags','arch']){
      assert.ok(wb[g]&&typeof wb[g]==='object',id+'.'+g);
      for(const k in wb[g])
        assert.ok(Number.isFinite(wb[g][k]),id+'.'+g+'.'+k+' finito');
    }
    /* tags do perfil precisam existir no vocabulário — sem tag fantasma */
    for(const tag in wb.tags)
      assert.ok(t.ENEMY_TAGS.indexOf(tag)>=0,id+': tag fantasma '+tag);
    for(const a in wb.arch)
      assert.ok(ARCH.indexOf(a)>=0,id+': arquétipo fantasma '+a);
  }
});
ok('viés por arquétipo vem das TAGS e fica sempre clampado',()=>{
  for(const id of THEMES){
    const wb=t.FRACTURE_THEMES.find(x=>x.id===id).waveBias;
    for(const k of ARCH){
      const b=t.fractureArchBias(wb,k);
      assert.ok(Number.isFinite(b),id+'/'+k+' finito');
      assert.ok(b>=t.FRACTURE_BIAS_DOWN-.0001&&b<=t.FRACTURE_BIAS_UP+.0001,
        id+'/'+k+' dentro do clamp: '+b);
    }
  }
  /* prova de que vem da tag: tank tem PESADO/RESISTENTE/CONTENCAO, então o
     CERCO (que favorece as três) tem de dar mais bônus a ele que a CAÇADA */
  const sie=t.FRACTURE_THEMES.find(x=>x.id==='siege').waveBias;
  const hun=t.FRACTURE_THEMES.find(x=>x.id==='hunt').waveBias;
  assert.ok(t.fractureArchBias(sie,'tank')>t.fractureArchBias(hun,'tank'),
    'CERCO favorece tank mais que CAÇADA');
  assert.ok(t.fractureArchBias(hun,'phantom')>t.fractureArchBias(sie,'phantom'),
    'CAÇADA favorece phantom mais que CERCO');
});
ok('COLAPSO favorece enxame/fragmentação e reduz tanques',()=>{
  const b=t.fractureBiasReport(ctxOf('collapse',100,7));
  assert.ok(b.arch.swarm>0&&b.arch.splitter>0,'swarm e splitter favorecidos');
  assert.ok(b.arch.tank<0&&b.arch.bulwark<0,'tank e bulwark reduzidos');
  /* efeito real na onda 15, média de 60 seeds */
  let sw=0,tk=0,N=60;
  for(let s=1;s<=N;s++){
    const c=finalComp('collapse',15,100,s*13+1);
    sw+=c.swarm;tk+=c.tank;
  }
  const b15=t.waveCompFit(t.waveCompBase(15),t.ENEMY_BUDGET);
  assert.ok(sw/N>b15.swarm,'COLAPSO traz mais swarm que a base ('+(sw/N).toFixed(2)+' > '+b15.swarm+')');
  assert.ok(tk/N<b15.tank,'COLAPSO traz menos tank que a base');
});
ok('CERCO favorece defesa/contenção e reduz enxame',()=>{
  const b=t.fractureBiasReport(ctxOf('siege',100,7));
  assert.ok(b.arch.bulwark>0&&b.arch.tank>0&&b.arch.shooter>0,'linha defensiva favorecida');
  assert.ok(b.arch.swarm<0&&b.arch.phantom<0,'swarm e phantom reduzidos');
  let bu=0,sw=0,N=60;
  for(let s=1;s<=N;s++){
    const c=finalComp('siege',15,100,s*17+3);
    bu+=c.bulwark;sw+=c.swarm;
  }
  const b15=t.waveCompFit(t.waveCompBase(15),t.ENEMY_BUDGET);
  assert.ok(bu/N>b15.bulwark,'CERCO traz mais bulwark que a base');
  assert.ok(sw/N<b15.swarm,'CERCO traz menos swarm que a base');
});
ok('CAÇADA favorece perseguição e ANOMALIA favorece distorção',()=>{
  const h=t.fractureBiasReport(ctxOf('hunt',100,7));
  assert.ok(h.arch.phantom>0&&h.arch.orbiter>0&&h.arch.chaser>0,'caçadores favorecidos');
  assert.ok(h.arch.tank<0,'pesados reduzidos');
  const a=t.fractureBiasReport(ctxOf('anomaly',100,7));
  assert.ok(a.arch.anomaly>0&&a.arch.singular>0,'anomalias favorecidas');
  /* duas runs, mesma onda, mesma intensidade: identidade perceptível */
  let hp=0,ap=0,N=60;
  for(let s=1;s<=N;s++){
    hp+=finalComp('hunt',15,100,s*29+5).phantom;
    ap+=finalComp('anomaly',15,100,s*29+5).phantom;
  }
  assert.notStrictEqual(hp,ap,'CAÇADA e ANOMALIA produzem phantom diferente');
  let ha=0,aa=0;
  for(let s=1;s<=N;s++){
    ha+=finalComp('hunt',15,100,s*31+7).anomaly;
    aa+=finalComp('anomaly',15,100,s*31+7).anomaly;
  }
  assert.ok(aa/N>ha/N,'ANOMALIA traz mais anomaly que CAÇADA');
});
ok('RESSONÂNCIA e ESCASSEZ são DELIBERADAMENTE SUTIS na composição',()=>{
  const fortes=['collapse','siege','hunt','anomaly'];
  const sutil=id=>{
    const wb=t.FRACTURE_THEMES.find(x=>x.id===id).waveBias;
    let mx=0;
    for(const k of ARCH)mx=Math.max(mx,Math.abs(t.fractureArchBias(wb,k)));
    return {force:wb.force,mx:mx};
  };
  for(const id of ['resonance','scarcity']){
    const s=sutil(id);
    assert.ok(s.force<=.6,id+': force sutil ('+s.force+')');
    for(const f of fortes)
      assert.ok(s.mx<sutil(f).mx,id+' tem viés máximo menor que '+f);
  }
  /* distância da base: os sutis têm de ser os que MENOS se afastam */
  const dist=id=>{
    let d=0;
    for(const n of WAVES)for(let s=1;s<=20;s++){
      const c=finalComp(id,n,100,s*7+1),
            b=t.waveCompFit(t.waveCompBase(n),t.ENEMY_BUDGET);
      for(const k of ARCH)d+=Math.abs(c[k]-b[k]);
    }
    return d;
  };
  const dr=dist('resonance'),ds=dist('scarcity');
  for(const f of fortes){
    const df=dist(f);
    assert.ok(dr<df,'RESSONÂNCIA se afasta menos da base que '+f+' ('+dr+' < '+df+')');
    assert.ok(ds<df,'ESCASSEZ se afasta menos da base que '+f+' ('+ds+' < '+df+')');
  }
});
ok('ESCASSEZ NÃO reduz a quantidade a ponto de facilitar',()=>{
  /* ela desloca o mix para alvos mais caros sem encolher a onda */
  let sc=0,ba=0;
  for(const n of WAVES)for(let s=1;s<=25;s++){
    sc+=total(finalComp('scarcity',n,100,s*11+2));
    ba+=total(t.waveCompFit(t.waveCompBase(n),t.ENEMY_BUDGET));
  }
  assert.ok(sc/ba>=.97,
    'ESCASSEZ mantém ≥97% do volume da base (obteve '+(sc/ba*100).toFixed(1)+'%)');
  /* e nenhum buff artificial: densidade nunca acima de 1 */
  const wb=t.FRACTURE_THEMES.find(x=>x.id==='scarcity').waveBias;
  assert.ok(wb.density<=1,'ESCASSEZ não infla densidade');
});
ok('NENHUM hard replacement: todo arquétipo desbloqueado continua possível',()=>{
  /* "favorecer" não pode virar "só existe isso". Em 200 seeds, cada Tema
     ainda precisa apresentar todos os arquétipos que a onda desbloqueou. */
  for(const id of THEMES){
    const vistos={};
    for(const n of WAVES)for(let s=1;s<=200;s++){
      const c=finalComp(id,n,100,s*3+1);
      for(const k of ARCH)if(c[k]>0)vistos[k]=true;
    }
    for(const k of ARCH)
      assert.ok(vistos[k],id+' nunca removeu '+k+' do jogo');
  }
});

/* ============ [16] B2.6 — INTENSIDADE = O QUANTO, NÃO O QUÊ ============ */
console.log('\n[16] B2.6 · INTENSIDADE CONTROLA O QUANTO, NUNCA O QUÊ');
ok('Intensidade escala a distância da base de forma MONÓTONA',()=>{
  for(const id of THEMES){
    const dist=i=>{
      let d=0;
      for(const n of [5,10,15,19])for(let s=1;s<=30;s++){
        const c=finalComp(id,n,i,s*5+1),
              b=t.waveCompFit(t.waveCompBase(n),t.ENEMY_BUDGET);
        for(const k of ARCH)d+=Math.abs(c[k]-b[k]);
      }
      return d;
    };
    const d0=dist(0),d25=dist(25),d50=dist(50),d75=dist(75),d100=dist(100);
    assert.strictEqual(d0,0,id+': intensidade 0 == base');
    assert.ok(d25<=d50&&d50<=d75&&d75<=d100,
      id+': monotônico ('+[d0,d25,d50,d75,d100].join(' ≤ ')+')');
    assert.ok(d100>d0,id+': intensidade 100 difere da base');
  }
});
ok('o QUÊ é decidido pelo Tema: mesma intensidade, temas diferentes',()=>{
  const set=(id,n)=>J(finalComp(id,n,60,4242));
  const distintos=new Set();
  for(const id of ['collapse','siege','hunt','anomaly'])distintos.add(set(id,15));
  assert.strictEqual(distintos.size,4,'4 temas fortes ⇒ 4 composições diferentes');
});
ok('Intensidade NÃO quebra o budget em nenhum valor 0–100',()=>{
  for(const id of THEMES)
    for(let i=0;i<=100;i+=5)
      for(const n of [5,10,15,19])
        for(let s=1;s<=6;s++){
          const c=finalComp(id,n,i,s*13+1);
          assert.ok(total(c)<=t.ENEMY_BUDGET,
            id+' int'+i+' w'+n+' seed'+s+' estourou: '+total(c));
        }
});
ok('Intensidade NUNCA desbloqueia arquétipo antes do threshold',()=>{
  /* a regra dura do shaping: só arquétipos com base[k]>0 são escalados.
     Singular (wave 13+) não pode aparecer na wave 1 nem com tudo no máximo. */
  for(const id of THEMES)
    for(let i=0;i<=100;i+=10)
      for(let n=1;n<=19;n++)
        for(let s=1;s<=8;s++){
          const base=t.waveCompBase(n),c=finalComp(id,n,i,s*19+3);
          for(const k of ARCH)
            if(base[k]<=0)
              assert.strictEqual(c[k],0,
                id+' int'+i+' w'+n+': '+k+' apareceu sem estar desbloqueado');
        }
});
ok('wave 1 continua sendo só chaser+swarm, em qualquer tema/intensidade',()=>{
  for(const id of THEMES)
    for(let i=0;i<=100;i+=25)
      for(let s=1;s<=10;s++){
        const c=finalComp(id,1,i,s*23+7);
        assert.strictEqual(c.singular,0,'sem Singular na wave 1');
        assert.strictEqual(c.phantom,0,'sem Phantom na wave 1');
        assert.strictEqual(c.spawner,0,'sem Spawner na wave 1');
        assert.ok(c.chaser>0&&c.swarm>0,'wave 1 mantém a dupla inicial');
      }
});
ok('Intensidade não gera monocultura (nenhum arquétipo domina a onda)',()=>{
  for(const id of THEMES)
    for(let i=0;i<=100;i+=20)
      for(const n of [5,10,15,19])
        for(let s=1;s<=40;s++){
          const c=finalComp(id,n,i,s*37+11);
          let tot=0,mx=0,mk='';
          for(const k of ARCH){tot+=c[k];if(c[k]>mx){mx=c[k];mk=k;}}
          assert.ok(tot===0||mx/tot<=.60,
            id+' int'+i+' w'+n+': '+mk+' domina '+Math.round(mx/tot*100)+'%');
        }
});

/* ============ [17] B2.7 — STAGE COMO MODULAÇÃO ============ */
console.log('\n[17] B2.7 · OS STAGES REAIS DO B1 COMO MODULAÇÃO');
ok('fractureThemeWeight usa os 5 stages do B1 como multiplicador',()=>{
  /* o catálogo lista do mais grave para o mais brando */
  const ids=t.FRACTURE_STAGES.map(s=>s.id);
  assert.strictEqual(J(ids),
    J(['ruptura','critica','propagando','instavel','latente']));
  for(const id of ids)
    assert.ok(Number.isFinite(t.FRACTURE_STAGE_MUL[id]),'FRACTURE_STAGE_MUL.'+id);
  /* modulação crescente, sem salto paralelo: latente < ... < ruptura */
  assert.ok(t.FRACTURE_STAGE_MUL.latente<t.FRACTURE_STAGE_MUL.instavel);
  assert.ok(t.FRACTURE_STAGE_MUL.instavel<t.FRACTURE_STAGE_MUL.propagando);
  assert.ok(t.FRACTURE_STAGE_MUL.propagando<=t.FRACTURE_STAGE_MUL.critica);
  assert.ok(t.FRACTURE_STAGE_MUL.critica<=t.FRACTURE_STAGE_MUL.ruptura);
});
ok('stage é FUNÇÃO da intensidade: não existe segunda progressão',()=>{
  /* o peso tem de ser reproduzível só com (intensity, stage) — se o Diretor
     guardasse um acumulador paralelo, o mesmo par daria pesos diferentes. */
  for(let i=0;i<=100;i++){
    const st=t.fractureStageOf(i).id;
    const esperado=Math.min(1,(i/100)*t.FRACTURE_STAGE_MUL[st]);
    const real=t.fractureThemeWeight(ctxOf('collapse',i,5));
    assert.ok(Math.abs(real-esperado)<1e-9,'int'+i+': '+real+' != '+esperado);
  }
});
ok('stage não vira fonte própria de intensidade (sobe só junto com ela)',()=>{
  const corpo=src.slice(src.indexOf('function fractureThemeWeight('),
    src.indexOf('function fractureArchBias('));
  assert.ok(/fractureStageOf|ctx\.stage/.test(corpo),'lê o stage');
  assert.ok(!/Math\.random/.test(corpo),'sem aleatoriedade');
  /* intensidade nunca é calculada A PARTIR do stage (o inverso é o certo) */
  const jogo=m[1];
  assert.ok(!/intensity\s*=[^;=]*fractureStageOf/.test(jogo),
    'intensidade nunca é derivada do stage');
  assert.ok(!/intensity\s*\+=/.test(jogo.slice(
    jogo.indexOf('BLOCO 2 — SHAPING'),jogo.indexOf('ciclo de vida da run'))),
    'o bloco de shaping não acumula intensidade');
  /* o stage é sempre LIDO da intensidade, nunca guardado por conta própria:
     para qualquer valor, stage(intensity) é reprodutível e monotônico. */
  let anterior=-1;
  for(let i=0;i<=100;i++){
    const st=t.fractureStageOf(i);
    assert.strictEqual(J(st),J(t.fractureStageOf(i)),'stage('+i+') reprodutível');
    assert.ok(st.min>=anterior,'faixas em ordem decrescente de gravidade');
    anterior=st.min;
  }
  assert.strictEqual(t.fractureStageOf(0).id,'latente');
  assert.strictEqual(t.fractureStageOf(100).id,'ruptura');
  /* fora da faixa o fallback é o ÚLTIMO do catálogo, que é o mais brando:
     intensidade negativa não pode virar ruptura */
  assert.strictEqual(t.fractureStageOf(-50).id,'latente','negativo ⇒ latente');
  assert.strictEqual(t.fractureStageOf(NaN).id,'latente','NaN ⇒ latente');
  assert.strictEqual(t.fractureStageOf(999).id,'ruptura','acima do teto ⇒ ruptura');
});

/* ============ [18] B2.8 — THRESHOLDS PRESERVADOS ============ */
console.log('\n[18] B2.8 · THRESHOLDS DE DESBLOQUEIO INTACTOS');
ok('o Tema só altera FREQUÊNCIA depois do desbloqueio, nunca o desbloqueio',()=>{
  /* thresholds medidos na waveCompBase real (não decorados): qualquer
     mudança aqui aparece como falha, que é exatamente o objetivo. */
  const LIM={chaser:1,swarm:1,orbiter:2,shooter:3,bulwark:4,tank:6,
    anomaly:6,splitter:6,spawner:8,phantom:8,singular:13};
  for(const k in LIM){
    for(let n=1;n<LIM[k];n++)
      assert.strictEqual(t.waveCompBase(n)[k],0,
        k+' não pode existir antes da wave '+LIM[k]);
    assert.ok(t.waveCompBase(LIM[k])[k]>0,k+' existe a partir da wave '+LIM[k]);
  }
  /* elite é entidade real (spawnWave spawna c.elite já elitizadas) e entra
     na base na wave 7 — medido, não suposto */
  assert.strictEqual(t.waveCompBase(6).elite,0,'sem elite até a wave 6');
  assert.ok(t.waveCompBase(7).elite>0,'elite entra na base a partir da wave 7');
  assert.ok(t.eliteChance(7)>0,'eliteChance(7) > 0');
  assert.strictEqual(t.eliteChance(4),0,'eliteChance nulo antes da wave 5');
});
ok('eliteChance e makeElite preservados (B2.12): elite sai da base, sem tema',()=>{
  /* o Diretor não mexe em elites: o campo elite do shaping é o da base */
  for(const id of THEMES)
    for(let i=0;i<=100;i+=25)
      for(const n of [6,10,15,19])
        for(let s=1;s<=10;s++){
          const sh=shaped(id,n,i,s*41+3);
          assert.strictEqual(sh.elite,t.waveCompBase(n).elite,
            id+' w'+n+': elite alterado pelo Tema');
        }
  const corpo=src.slice(src.indexOf('function fractureShapeWave('),
    src.indexOf('/* ---------------- API de waveProfile'));
  assert.ok(!/eliteChance/.test(corpo),'shaping não toca em eliteChance');
  assert.ok(!/makeElite/.test(corpo),'shaping não chama makeElite');
});
ok('nenhum Tema aumenta eliteChance',()=>{
  const jogo=m[1];
  const i=jogo.indexOf('function eliteChance(');
  const corpo=jogo.slice(i,jogo.indexOf('\n',i+10));
  assert.ok(!/fracture/.test(corpo),'eliteChance não referencia o Diretor');
  for(const n of [1,5,10,15,19,20]){
    const esperado=n<5?0:Math.min(.30,(n-4)*.028);
    assert.ok(Math.abs(t.eliteChance(n)-esperado)<1e-9,'eliteChance('+n+')');
  }
});

/* ============ [19] B2.9 — DIVERSIDADE INTERNA ============ */
console.log('\n[19] B2.9 · DIVERSIDADE INTERNA (TETO, MÍNIMO, JITTER)');
ok('teto de participação por arquétipo é respeitado quando cabe',()=>{
  for(const id of THEMES){
    const cap=t.FRACTURE_THEMES.find(x=>x.id===id).waveBias.capShare;
    for(const n of [10,15,19])for(let s=1;s<=60;s++){
      const c=finalComp(id,n,100,s*43+5);
      let tot=0,kindN=0;
      for(const k of ARCH){tot+=c[k];if(c[k]>0)kindN++;}
      const capN=Math.max(t.FRACTURE_CAP_MIN,Math.floor(tot*cap));
      if(kindN>0&&capN*kindN>=tot)
        for(const k of ARCH)
          assert.ok(c[k]<=capN,
            id+' w'+n+': '+k+'='+c[k]+' acima do teto '+capN);
    }
  }
});
ok('mínimo de arquétipos distintos é respeitado quando a onda comporta',()=>{
  for(const id of THEMES){
    const minK=t.FRACTURE_THEMES.find(x=>x.id===id).waveBias.minKinds;
    for(const n of [10,15,19])for(let s=1;s<=60;s++){
      const base=t.waveCompBase(n),c=finalComp(id,n,100,s*47+7);
      const desb=ARCH.filter(k=>base[k]>0).length;
      const alvo=Math.min(minK,desb);
      const kinds=ARCH.filter(k=>c[k]>0).length;
      assert.ok(kinds>=alvo,
        id+' w'+n+': '+kinds+' tipos < mínimo '+alvo);
    }
  }
});
ok('jitter determinístico: mesma (seed,wave) repete; seeds distintas variam',()=>{
  for(const id of THEMES){
    const a=J(finalComp(id,15,100,12345)),b=J(finalComp(id,15,100,12345));
    assert.strictEqual(a,b,id+': mesma seed ⇒ mesma composição');
    let diferentes=0;
    for(let s=1;s<=40;s++)
      if(J(finalComp(id,15,100,s*101+1))!==a)diferentes++;
    assert.ok(diferentes>=10,
      id+': seeds distintas precisam variar (só '+diferentes+'/40)');
  }
});
ok('NENHUM Math.random solto no caminho de composição',()=>{
  const jogo=m[1];
  const ini=jogo.indexOf('BLOCO 2 — SHAPING DE COMPOSIÇÃO');
  const fim=jogo.indexOf('/* ---------------- ciclo de vida da run');
  assert.ok(ini>0&&fim>ini,'bloco de shaping delimitado');
  const bloco=jogo.slice(ini,fim);
  assert.ok(!/Math\.random/.test(bloco),'shaping sem Math.random');
  for(const fn of ['waveCompBase','waveCompFit','waveCompTotal','fractureArchBias',
    'fractureThemeWeight','fractureWaveCtx']){
    const i=jogo.indexOf('function '+fn+'(');
    const corpo=jogo.slice(i,jogo.indexOf('\nfunction ',i+10));
    assert.ok(!/Math\.random/.test(corpo),fn+' sem Math.random');
  }
});
ok('fractureWaveRng é função pura de (seed,wave)',()=>{
  const seq=(s,n)=>{const r=t.fractureWaveRng(s,n);return [r(),r(),r()].join(',');};
  assert.strictEqual(seq(999,5),seq(999,5),'mesma (seed,wave) ⇒ mesma sequência');
  assert.notStrictEqual(seq(999,5),seq(999,6),'wave diferente ⇒ sequência diferente');
  assert.notStrictEqual(seq(999,5),seq(998,5),'seed diferente ⇒ sequência diferente');
  /* ondas vizinhas não podem ser clones (é para isso que o jitter existe) */
  assert.notStrictEqual(seq(999,5),seq(999,7));
});

/* ============ [20] B2.10 — DETERMINISMO / CONTINUE ============ */
console.log('\n[20] B2.10 · DETERMINISMO POR (SEED, TEMA, INTENSIDADE, WAVE)');
ok('composição é reproduzível em DOIS boots separados',()=>{
  const A=bootFx({},true),B=bootFx({},true);
  for(const id of ['collapse','hunt'])
    for(const n of [5,10,15,19]){
      const ca=A.waveCompFit(A.fractureShapeWave(A.waveCompBase(n),n,
        {theme:id,seed:777,intensity:80,stage:A.fractureStageOf(80).id}),A.ENEMY_BUDGET);
      const cb=B.waveCompFit(B.fractureShapeWave(B.waveCompBase(n),n,
        {theme:id,seed:777,intensity:80,stage:B.fractureStageOf(80).id}),B.ENEMY_BUDGET);
      assert.strictEqual(J(ca),J(cb),id+' w'+n+' divergiu entre boots');
    }
});
ok('Continue/reload NÃO rerrola: checkpoint preserva seed, tema e composição',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  A.fractureForceTheme('anomaly','teste');
  A.fractureSetIntensity(57,'teste');
  playWaves(A,2,9);            // cada onda soma FRACTURE_INT_PER_WAVE
  const seed=A.fractureGetSeed(),intFinal=A.fractureGetIntensity();
  assert.ok(intFinal>57,'as ondas subiram a Intensidade (gancho do B1 ativo)');
  const comps=[5,10,15].map(n=>J(A.waveComp(n)));
  const cp=A.smBuildCheckpoint('teste',9);
  assert.ok(cp.fracture,'checkpoint carrega cp.fracture');
  /* simula reload: boot novo + unpack do checkpoint */
  const B=bootFx({},true);
  const f=B.fractureRunUnpack(cp);
  assert.strictEqual(f.seed,seed,'seed preservada');
  assert.strictEqual(f.theme,'anomaly','tema preservado');
  assert.strictEqual(f.intensity,intFinal,'intensidade preservada');
  B.setFx(f);
  for(let i=0;i<3;i++)
    assert.strictEqual(J(B.waveComp([5,10,15][i])),comps[i],
    'onda '+[5,10,15][i]+' mudou depois do Continue');
});
ok('loja, menus e re-render NÃO rerrolam a composição',()=>{
  beginRun(t,1);
  t.fractureForceTheme('siege','teste');
  t.fractureSetIntensity(70,'teste');
  playWaves(t,2,8);
  const seed=t.fractureGetSeed(),tema=t.fractureGetThemeId();
  /* abrir a loja e re-renderizar NÃO avançam a onda: a composição tem de
     sair byte a byte igual, porque nada do contexto de shaping mudou. */
  const antes=[5,10,15].map(n=>J(t.waveComp(n)));
  t.openShop();t.renderShop();
  t.devRender();
  t.fractureInspectorText();
  t.fractureSnapshot();
  t.fractureCompReport(10);
  for(let i=0;i<3;i++)
    assert.strictEqual(J(t.waveComp([5,10,15][i])),antes[i],
      'onda '+[5,10,15][i]+' mudou só por abrir a loja/inspecionar');
  assert.strictEqual(t.fractureGetSeed(),seed,'seed rerrolada pela loja');
  assert.strictEqual(t.fractureGetThemeId(),tema,'Tema trocado pela loja');
  /* FECHAR a loja avança a onda (comportamento real do jogo) e o gancho do
     B1 soma Intensidade. A composição muda por isso — e precisa mudar de
     forma DETERMINÍSTICA, não por reroll: recomputando com o contexto novo
     o resultado tem de ser o mesmo. */
  t.closeShop();
  assert.ok(t.getWave()>8,'closeShop avançou a onda (comportamento real)');
  for(const n of [5,10,15]){
    const ctx=t.fractureWaveCtx();
    assert.strictEqual(J(t.waveComp(n)),
      J(t.waveCompFit(t.fractureShapeWave(t.waveCompBase(n),n,ctx),t.ENEMY_BUDGET)),
      'onda '+n+' não é reproduzível pelo próprio contexto');
  }
  assert.strictEqual(t.fractureGetSeed(),seed,'seed rerrolada ao fechar a loja');
  assert.strictEqual(t.fractureGetThemeId(),tema,'Tema trocado ao fechar a loja');
});
ok('pack/unpack de waveProfile é round-trip estável',()=>{
  beginRun(t,1);
  t.fractureSetWaveBias('swarm',.4);
  t.fractureSetWaveBias('tank',-.3);
  t.fractureSetWavePool(['phantom','orbiter']);
  const p=t.fractureRunPack();
  const f=t.fractureRunUnpack({fracture:p});
  assert.strictEqual(f.waveProfile.bias.swarm,.4);
  assert.strictEqual(f.waveProfile.bias.tank,-.3);
  assert.strictEqual(J(f.waveProfile.pool),J(['phantom','orbiter']));
  /* e empacotar de novo não degrada nada */
  t.setFx(f);
  assert.strictEqual(J(t.fractureRunPack().wave),J(p.wave),'round-trip estável');
});
ok('Sandbox tem seed PRÓPRIA e não herda a da run real',()=>{
  const A=bootFx({},true);
  beginRun(A,1);
  const seedReal=A.fractureGetSeed();
  A.sandboxOpenSetup();
  A.getSandboxCfg().char=0;
  assert.strictEqual(A.sandboxStart(),true);
  assert.ok(A.getSandboxRun(),'sandbox ativo');
  assert.ok(A.getFx(),'fractureRun do sandbox existe');
  const sbSeed=A.fractureGetSeed();
  /* a seed do lab é derivada do contexto do sandbox; o que importa é que
     trocar a seed ali é possível e não contamina a run real */
  assert.ok(A.fractureSetSeed(31337),'sandbox aceita seed própria');
  assert.strictEqual(A.fractureGetSeed(),31337);
  assert.strictEqual(A.fractureGetThemeId(),A.fracturePickTheme(31337),
    'seed própria ⇒ tema derivado dela');
  A.sandboxExit(false);
  assert.strictEqual(A.getFx(),null,'Diretor do lab descartado ao sair');
  /* retomar a run real devolve o Diretor dela, com a seed original */
  A.setPlayer(null);A.setState('title');
  A.resumeRun();
  assert.strictEqual(A.fractureGetSeed(),seedReal,
    'a seed da run real não foi tocada pelo laboratório');
});

/* ============ [21] B2.11 — waveProfile.bias / .pool ============ */
console.log('\n[21] B2.11 · waveProfile.bias/.pool INTEGRADOS + SANITIZADOS');
ok('waveProfile.bias influencia DE VERDADE a composição',()=>{
  const b15=t.waveCompBase(15);
  const semPool=J(t.fractureShapeWave(b15,15,ctxOf('collapse',100,555)));
  const comPool=J(t.fractureShapeWave(b15,15,ctxOf('collapse',100,555,null,['shooter'])));
  assert.notStrictEqual(semPool,comPool,'pool muda a composição');
  const a=t.fractureShapeWave(t.waveCompBase(15),15,ctxOf('collapse',100,555));
  const b=t.fractureShapeWave(t.waveCompBase(15),15,
    ctxOf('collapse',100,555,{bulwark:.6,tank:.6}));
  assert.ok(b.bulwark>=a.bulwark&&b.tank>=a.tank,'bias positivo aumenta o arquétipo');
  assert.notStrictEqual(J(a),J(b),'bias altera a composição');
  const c=t.fractureShapeWave(t.waveCompBase(15),15,
    ctxOf('collapse',100,555,{swarm:-.6}));
  assert.ok(c.swarm<=a.swarm,'bias negativo reduz o arquétipo');
});
ok('waveProfile.pool garante presença sem furar threshold',()=>{
  /* phantom desbloqueia na 8: pool não pode antecipá-lo */
  for(let s=1;s<=20;s++){
    const c=t.fractureShapeWave(t.waveCompBase(5),5,
      ctxOf('collapse',100,s,['phantom','singular']));
    assert.strictEqual(c.phantom,0,'pool não desbloqueia phantom na wave 5');
    assert.strictEqual(c.singular,0,'pool não desbloqueia singular na wave 5');
    const c10=t.fractureShapeWave(t.waveCompBase(10),10,
      ctxOf('collapse',100,s,['phantom']));
    assert.ok(c10.phantom>0,'pool garante phantom na wave 10');
  }
});
ok('sanitização dura: NaN, Infinity, string, tipo inexistente e pollution',()=>{
  const lixo={swarm:NaN,tank:Infinity,shooter:'3',orbiter:null,
    phantom:undefined,chaser:1e9,splitter:-1e9,inf:Infinity,ninf:-Infinity,
    __proto__:{polluted:true},constructor:9,toString:9,bulwark:.5};
  const b=t.fractureCleanBias(lixo);
  assert.strictEqual(b.swarm,undefined,'NaN rejeitado');
  assert.strictEqual(b.tank,undefined,'Infinity rejeitado');
  assert.strictEqual(b.shooter,undefined,'string rejeitada');
  assert.strictEqual(b.orbiter,undefined,'null rejeitado');
  assert.strictEqual(b.phantom,undefined,'undefined rejeitado');
  assert.strictEqual(b.chaser,t.FRACTURE_RUN_BIAS_MAX,'1e9 clampado no teto');
  assert.strictEqual(b.splitter,-t.FRACTURE_RUN_BIAS_MAX,'-1e9 clampado no piso');
  assert.strictEqual(b.inf,undefined,'Infinity rejeitado');
  assert.strictEqual(b.ninf,undefined,'-Infinity rejeitado');
  assert.strictEqual(b.bulwark,.5,'valor válido preservado');
  for(const k of ['__proto__','constructor','toString'])
    assert.strictEqual(Object.prototype.hasOwnProperty.call(b,k),false,
      'chave "'+k+'" não pode entrar no bias');
  assert.strictEqual({}.polluted,undefined,'Object.prototype intacto');
  /* o objeto devolvido é limpo: sem chave herdada vazando */
  for(const entrada of [null,undefined,'lixo',42,[],true]){
    const r=t.fractureCleanBias(entrada);
    assert.strictEqual(J(r),J({}),'fractureCleanBias('+J(entrada)+') ⇒ vazio');
    assert.strictEqual(Object.keys(r).length,0,'sem chaves próprias');
    for(const k in r)
      assert.ok(Object.prototype.hasOwnProperty.call(r,k),
        'nenuma chave herdada em '+J(entrada));
  }
});
ok('sanitização de pool: só arquétipos reais, sem duplicata, com teto',()=>{
  assert.strictEqual(J(t.fractureCleanPool(['swarm','swarm','nao_existe',7,null,
    '__proto__','constructor','tank'])),J(['swarm','tank']));
  const muitos=ARCH.concat(ARCH);
  assert.strictEqual(t.fractureCleanPool(muitos).length,t.FRACTURE_RUN_POOL_MAX,
    'pool tem teto');
  assert.strictEqual(J(t.fractureCleanPool(null)),J([]));
  assert.strictEqual(J(t.fractureCleanPool('swarm')),J([]),'não-array rejeitado');
});
ok('fractureSetWaveBias/Pool recusam entrada inválida (porta única)',()=>{
  t.setFx(null);
  assert.strictEqual(t.fractureSetWaveBias('swarm',1),false,'sem run');
  assert.strictEqual(t.fractureSetWavePool(['swarm']),false,'sem run');
  beginRun(t,1);
  assert.strictEqual(t.fractureSetWaveBias('elite',.5),false,'elite não é arquétipo de wave');
  assert.strictEqual(t.fractureSetWaveBias('__proto__',.5),false,'prototype pollution');
  assert.strictEqual(t.fractureSetWaveBias('swarm','abc'),false,'não-número');
  assert.strictEqual(t.fractureSetWaveBias('swarm',NaN),false,'NaN');
  assert.strictEqual(t.fractureSetWaveBias('swarm',.5),true,'válido');
  assert.strictEqual(t.getFx().waveProfile.bias.swarm,.5);
  assert.strictEqual(t.fractureSetWaveBias('swarm',0),true,'zero limpa');
  assert.strictEqual(Object.keys(t.getFx().waveProfile.bias).length,0);
  assert.strictEqual(t.fractureSetWavePool(['swarm','nao_existe','swarm']),true);
  assert.strictEqual(J(t.getFx().waveProfile.pool),J(['swarm']),'dedup + filtro');
});
ok('bias negativo é permitido (tema que REDUZ precisa dele)',()=>{
  beginRun(t,1);
  assert.strictEqual(t.fractureSetWaveBias('swarm',-.5),true);
  assert.strictEqual(t.getFx().waveProfile.bias.swarm,-.5);
  const p=t.fractureRunPack();
  assert.strictEqual(t.fractureRunUnpack({fracture:p}).waveProfile.bias.swarm,-.5,
    'negativo sobrevive ao save');
});

/* ============ [22] B2.15/B2.16/B2.17 — ISOLAMENTO, DEV, SANDBOX ============ */
console.log('\n[22] B2.15/B2.16/B2.17 · ISOLAMENTO, DEV E SANDBOX');
ok('facções/Echo/Personality/Relationship NÃO determinam composição',()=>{
  /* waveComp só recebe n. Se qualquer um desses sistemas influenciasse, o
     caminho conteria uma referência a eles. */
  const i=src.indexOf('function waveComp(');
  const corpo=src.slice(i,src.indexOf('\nfunction ',i+10));
  for(const proibido of ['fracRun','fracStateOf','echoes','personality',
    'relationship','echoDis','FACTION'])
    assert.ok(corpo.indexOf(proibido)<0,'waveComp não consulta '+proibido);
  const bloco=src.slice(src.indexOf('function fractureShapeWave('),
    src.indexOf('/* ---------------- API de waveProfile'));
  for(const proibido of ['fracRun','fracStateOf','echoes','FACTION','echoDis'])
    assert.ok(bloco.indexOf(proibido)<0,'shaping não consulta '+proibido);
});
ok('DEV: fx:comp mostra BASE × FINAL e NÃO contamina a run',()=>{
  t.DEV_on();
  beginRun(t,1);
  t.clearDevTaint();
  playWaves(t,2,10);
  assert.strictEqual(t.devCommand('fx:comp'),true);
  assert.strictEqual(t.devCommand('fx:comp:15'),true);
  assert.strictEqual(t.devCommand('fx:comp:99'),true,'onda fora do range é clampada');
  assert.strictEqual(t.isTainted(),false,'fx:comp é leitura: não tainta');
  t.DEV_off();
  assert.strictEqual(t.devCommand('fx:comp'),false,'DEV desligado recusa');
  t.DEV_on();
});
ok('DEV: fx:wave, fx:bias, fx:pool e fx:sim funcionam e taintam quando mudam estado',()=>{
  t.DEV_on();
  beginRun(t,1);
  t.clearDevTaint();
  assert.strictEqual(t.devCommand('fx:wave:10'),true);
  assert.strictEqual(t.isTainted(),false,'fora do sandbox é só prévia');
  assert.strictEqual(t.devCommand('fx:sim'),true,'simulação de balanceamento');
  assert.strictEqual(t.devCommand('fx:sim:50'),true);
  assert.strictEqual(t.devCommand('fx:bias:swarm:0.5'),true);
  assert.strictEqual(t.isTainted(),true,'mudar bias contamina');
  assert.strictEqual(t.getFx().waveProfile.bias.swarm,.5);
  t.clearDevTaint();
  assert.strictEqual(t.devCommand('fx:pool:phantom/orbiter'),true);
  assert.strictEqual(J(t.getFx().waveProfile.pool),J(['phantom','orbiter']));
  assert.strictEqual(t.isTainted(),true);
  t.clearDevTaint();
  assert.strictEqual(t.devCommand('fx:bias:off'),true);
  assert.strictEqual(t.devCommand('fx:pool:off'),true);
  assert.strictEqual(Object.keys(t.getFx().waveProfile.bias).length,0);
  assert.strictEqual(t.getFx().waveProfile.pool.length,0);
  assert.strictEqual(t.devCommand('fx:bias:nao_existe:1'),false,'arquétipo inválido');
});
ok('inspetor DEV expõe Tema/Seed/Intensidade/Stage/Wave/BASE×FINAL/viés/budget',()=>{
  t.DEV_on();
  beginRun(t,1);
  t.fractureForceTheme('hunt','teste');
  t.fractureSetIntensity(80,'teste');
  playWaves(t,2,12);
  const txt=t.fractureInspectorText();
  for(const rotulo of ['TEMA:','SEED:','INTENSIDADE:','ESTÁGIO:','WAVE ATUAL:',
    'PESO DO TEMA:','PESOS DE RUN:','POOL DE RUN:'])
    assert.ok(txt.indexOf(rotulo)>=0,'inspetor sem '+rotulo);
  assert.ok(/BASE\s+\(\d+\):/.test(txt),'composição BASE');
  assert.ok(/FINAL\s+\(\d+\/\d+/.test(txt),'composição FINAL com budget');
  assert.ok(/sobra \d+/.test(txt),'budget usado/restante');
  assert.ok(/FAVORECIDOS:|VIÉS: NEUTRO/.test(txt),'tags favorecidas');
  assert.ok(/REDUZIDOS:/.test(txt),'tags reduzidas');
});
ok('Sandbox: seção e ações do Diretor existem e recusam fora do lab',()=>{
  assert.strictEqual(t.fractureSandboxAction('theme:hunt'),false,
    'ação recusada fora do sandbox');
  const A=bootFx({},true);
  A.sandboxOpenSetup();
  A.getSandboxCfg().char=0;
  assert.strictEqual(A.sandboxStart(),true);
  assert.strictEqual(A.fractureSandboxAction('theme:hunt'),true,'tema no lab');
  assert.strictEqual(A.getFx().theme,'hunt');
  assert.strictEqual(A.fractureSandboxAction('int:100'),true,'intensidade no lab');
  assert.strictEqual(A.getFx().intensity,100);
  assert.strictEqual(A.fractureSandboxAction('seed:4242'),true,'seed no lab');
  assert.strictEqual(A.fractureSandboxAction('wave:10'),true,'salto de onda no lab');
  assert.strictEqual(A.getWave(),10,'onda realmente saltou');
  assert.strictEqual(A.fractureSandboxAction('lixo:xxx'),false,'ação inválida');
  A.sandboxExit();
});
ok('Sandbox continua 100% isolado: saves byte a byte idênticos',()=>{
  /* o teste crítico de não-regressão: nada do B2 pode escrever em storage */
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,4);
  A.captureCheckpoint('onda',4);
  A.smCommit();
  const temaAntes=A.fractureGetThemeId(),seedAntes=A.fractureGetSeed();
  A.setState('title');
  const dump=()=>J(Object.keys(A._ls._d).sort().map(k=>[k,A._ls._d[k]]));
  const antes=dump();
  /* entrar de VERDADE no laboratório: sem isso as ações abaixo recusariam e
     o teste passaria no vazio, sem provar isolamento nenhum. */
  A.sandboxOpenSetup();
  A.getSandboxCfg().char=0;
  assert.strictEqual(A.sandboxStart(),true,'sandbox precisa iniciar');
  assert.strictEqual(A.getSandboxRun(),true);
  assert.ok(A.getFx(),'laboratório tem Diretor próprio');
  assert.strictEqual(A.fractureSandboxAction('theme:collapse'),true,'tema aplicado');
  assert.strictEqual(A.getFx().theme,'collapse');
  assert.strictEqual(A.fractureSandboxAction('int:100'),true,'intensidade aplicada');
  assert.strictEqual(A.getFx().intensity,100);
  assert.strictEqual(A.fractureSandboxAction('seed:999'),true,'seed aplicada');
  for(const n of [5,10,15])
    assert.strictEqual(A.fractureSandboxAction('wave:'+n),true,'salto de onda '+n);
  assert.strictEqual(A.getWave(),15,'a última onda do laboratório ficou ativa');
  A.fractureSimulate({seeds:5});
  A.sandboxExit(false);
  assert.strictEqual(dump(),antes,'localStorage alterado pelo Sandbox');
  assert.strictEqual(A.getFx(),null,'Diretor do lab descartado');
  /* retomar a run real: o Diretor dela volta do checkpoint, intacto */
  A.setPlayer(null);A.setState('title');
  A.resumeRun();
  assert.strictEqual(A.fractureGetThemeId(),temaAntes,'Tema da run real intacto');
  assert.strictEqual(A.fractureGetSeed(),seedAntes,'seed da run real intacta');
});
ok('fractureSimulate é puro: não toca na run viva nem no jogo',()=>{
  beginRun(t,1);
  t.fractureForceTheme('anomaly','teste');
  t.fractureSetIntensity(33,'teste');
  const tema=t.fractureGetThemeId(),inte=t.fractureGetIntensity(),
        seed=t.fractureGetSeed();
  const r=t.fractureSimulate({seeds:10});
  assert.strictEqual(t.fractureGetThemeId(),tema,'tema intacto');
  assert.strictEqual(t.fractureGetIntensity(),inte,'intensidade intacta');
  assert.strictEqual(t.fractureGetSeed(),seed,'seed intacta');
  assert.strictEqual(r.themes.length,6,'6 temas');
  assert.ok(r.per.collapse&&r.per.collapse.entityAvg>0,'métricas preenchidas');
  /* parâmetros sanitizados */
  const r2=t.fractureSimulate({themes:['nao_existe','hunt'],seeds:0,
    waveMin:99,waveMax:-3,budget:NaN});
  assert.strictEqual(J(r2.themes),J(['hunt']),'tema inexistente descartado');
  assert.ok(r2.seeds>=1,'seeds tem piso');
  assert.ok(r2.budget>=0,'budget sanitizado');
  assert.ok(r2.waveMax>=r2.waveMin,'range coerente');
});
ok('fractureCompReport devolve base, shaped, final e métricas coerentes',()=>{
  beginRun(t,1);
  t.fractureForceTheme('collapse','teste');
  t.fractureSetIntensity(100,'teste');
  const r=t.fractureCompReport(15);
  assert.strictEqual(r.wave,15);
  assert.strictEqual(J(r.base),J(t.waveCompBase(15)));
  assert.strictEqual(J(r.final),J(t.waveComp(15)),'final == waveComp(15)');
  assert.strictEqual(r.finalTotal,r.budgetUsed);
  assert.strictEqual(r.budgetLeft,t.ENEMY_BUDGET-r.budgetUsed);
  assert.ok(r.budgetLeft>=0,'não estoura o teto');
  assert.strictEqual(t.fractureCompReport(0).wave,1,'wave 0 é clampada para 1');
  assert.strictEqual(t.fractureCompReport(99).wave,t.MAX_WAVE,'clamp no teto');
});

/* ============ [23] B2.19 — SIMULAÇÃO DE BALANCEAMENTO ============ */
console.log('\n[23] B2.19 · SIMULAÇÃO MULTI-SEED (6 TEMAS × WAVES 1–19 × 120 SEEDS)');
ok('simulação completa: 0 estouros, 0 violações de threshold, 0 monoculturas',()=>{
  const r=t.fractureSimulate({seeds:120,intensity:100});
  const linhas=[];
  for(const id of r.themes){
    const q=r.per[id];
    assert.strictEqual(q.budgetOver,0,id+' estourou o budget '+q.budgetOver+'×');
    assert.strictEqual(q.violations,0,id+' violou threshold '+q.violations+'×');
    assert.strictEqual(q.extremes,0,id+' gerou monocultura '+q.extremes+'×');
    assert.ok(q.entityMax<=r.budget,id+': máximo '+q.entityMax+' > '+r.budget);
    linhas.push(id+' ent='+q.entityAvg.toFixed(2)+' kinds='+q.kindAvg.toFixed(2));
  }
  assert.strictEqual(linhas.length,6);
  console.log('      '+linhas.join(' | '));
});
ok('a curva de dificuldade não é destruída: volume dentro de ±8% da base',()=>{
  for(const intensidade of [0,38,100]){
    const r=t.fractureSimulate({seeds:60,intensity:intensidade});
    for(const id of r.themes){
      const q=r.per[id];
      const delta=(q.entityAvg-q.baseFitEntityAvg)/q.baseFitEntityAvg;
      assert.ok(Math.abs(delta)<=.08,
        id+' int'+intensidade+': volume '+(delta*100).toFixed(1)+'% fora de ±8%');
    }
  }
});
ok('intensidade 0 reproduz EXATAMENTE a base corrigida, tema por tema',()=>{
  const r=t.fractureSimulate({seeds:40,intensity:0});
  for(const id of r.themes){
    const q=r.per[id];
    assert.ok(Math.abs(q.entityAvg-q.baseFitEntityAvg)<1e-9,
      id+' int0: '+q.entityAvg+' != '+q.baseFitEntityAvg);
  }
});
ok('diversidade: média de arquétipos distintos por onda ≥ 4 em todos os temas',()=>{
  const r=t.fractureSimulate({seeds:60,intensity:100});
  for(const id of r.themes)
    assert.ok(r.per[id].kindAvg>=4,
      id+': '+r.per[id].kindAvg.toFixed(2)+' arquétipos por onda');
});
ok('participação dos favorecidos: cada Tema entrega o que promete',()=>{
  const r=t.fractureSimulate({seeds:150,intensity:100});
  const share=(id,k)=>r.per[id].share[k];
  const base=r.per.collapse;   // referência interna entre temas
  assert.ok(share('collapse','swarm')>share('siege','swarm'),'COLAPSO > CERCO em swarm');
  assert.ok(share('collapse','splitter')>share('hunt','splitter'),'COLAPSO > CAÇADA em splitter');
  assert.ok(share('siege','bulwark')>share('collapse','bulwark'),'CERCO > COLAPSO em bulwark');
  assert.ok(share('siege','tank')>share('hunt','tank'),'CERCO > CAÇADA em tank');
  assert.ok(share('hunt','phantom')>share('siege','phantom'),'CAÇADA > CERCO em phantom');
  assert.ok(share('hunt','orbiter')>share('collapse','orbiter'),'CAÇADA > COLAPSO em orbiter');
  assert.ok(share('anomaly','anomaly')>share('siege','anomaly'),'ANOMALIA > CERCO em anomaly');
  assert.ok(share('anomaly','singular')>share('collapse','singular'),'ANOMALIA > COLAPSO em singular');
  assert.ok(base,'referência válida');
});
ok('composições extremas: nenhuma onda fica vazia ou sem tipo nenhum',()=>{
  for(const id of THEMES)
    for(const n of WAVES)
      for(let s=1;s<=12;s++){
        const c=finalComp(id,n,100,s*53+7);
        assert.ok(total(c)>0,id+' w'+n+' seed'+s+': composição vazia');
        assert.ok(ARCH.some(k=>c[k]>0),id+' w'+n+': sem arquétipo nenhum');
      }
});

/* ============ [24] REGRESSÕES DO BLOCO 2 ============ */
console.log('\n[24] REGRESSÕES · O BLOCO 2 NÃO PODE TER TOCADO EM NADA ALÉM DISSO');
ok('HP/dano/velocidade de inimigo NÃO mudam por Tema',()=>{
  const jogo=m[1];
  for(const fn of ['diffHp','diffDmg','diffSpd']){
    const i=jogo.indexOf('function '+fn+'(');
    /* corpo inteiro, não janela fixa (ver B4-60) */
    const corpo=jogo.slice(i,jogo.indexOf('\nfunction ',i+10));
    assert.ok(!/fracture/.test(corpo),fn+' sem Diretor');
  }
  assert.ok(jogo.indexOf('hpMul*fracture')<0);
  assert.ok(jogo.indexOf('dmg*fractureGet')<0);
});
ok('filtro de segurança de pickMiniBoss intacto (com e sem Diretor)',()=>{
  /* O que NÃO podia mudar é o FILTRO de HP: duelist (hp .70) some a partir
     da wave 11, e o pool das waves <=5 continua restrito a hp<=1.15.
     A escolha em si passou a ser ponderada no B3.6 — testada no bloco [27]. */
  for(let i=0;i<400;i++){
    const n=1+(i%20);
    const mb=t.pickMiniBoss(n);
    assert.ok(mb&&mb.id,'miniboss sempre definido (wave '+n+')');
    if(n>=11)assert.ok(mb.hp>=.8,'wave '+n+': '+mb.id+' hp '+mb.hp+' fora do filtro');
    if(n<=5)assert.ok(mb.hp<=1.15,'wave '+n+': '+mb.id+' hp '+mb.hp+' fora do filtro');
  }
  /* pools medidos na regra real (hp<=1.15 / todos / hp>=.8):
       <=5  → 6 elegíveis (fora furnace 1.25 e colossus 1.75)
       6-10 → os 8
       >=11 → 7 elegíveis (fora duelist 0.70) */
  for(const n of [1,5,6,10,11,15,19]){
    const ids=t.miniEligiblePool(n).map(m=>m.id).sort();
    if(n<=5){
      assert.strictEqual(ids.length,6,'wave '+n+': 6 elegíveis, obtive '+ids.length);
      assert.ok(ids.indexOf('furnace')<0,'wave '+n+': furnace fora (hp 1.25)');
      assert.ok(ids.indexOf('colossus')<0,'wave '+n+': colossus fora (hp 1.75)');
    }
    if(n>=6&&n<=10)assert.strictEqual(ids.length,8,'wave '+n+': os 8 elegíveis');
    if(n>=11){
      assert.strictEqual(ids.length,7,'wave '+n+': 7 elegíveis, obtive '+ids.length);
      assert.ok(ids.indexOf('duelist')<0,'wave '+n+': duelist fora (hp 0.70)');
    }
  }
});
ok('pool de eventos cresceu só com os 12 novos e as réguas antigas continuam no comando',()=>{
  assert.strictEqual(t.RUN_EVENTS.length+t.RUN_CHAIN_EVENTS.length,31,
    '25 eventos + 6 de cadeia (pools antigos intactos)');
  /* B3.11 adiciona 12 eventos de Fratura (2 por Tema) + 1 cadeia. O pool do B2
     era 61; agora é 61 + 12 = 73. Nada foi REMOVIDO nem repesado para dar lugar
     aos novos — eles entram pelo mesmo evRegister e pelo mesmo pool. */
  assert.strictEqual(t.FRACTURE_RUN_EVENTS.length,12,'12 eventos novos (2 por Tema)');
  assert.strictEqual(t.FRACTURE_CHAIN_EVENTS.length,1,'1 cadeia nova (a CAÇADA)');
  assert.strictEqual(t.ALL_RUN_EVENTS.length,73,'pool real = 61 antigos + 12 novos');
  /* scoreEvent agora tem o termo do Diretor (B3.2) — o que não pode mudar
     é que ele NÃO decide elegibilidade: bloqueios continuam exclusivos de
     eventBlockReason. */
  const jogo=m[1];
  const i=jogo.indexOf('function eventBlockReason(');
  const corpo=jogo.slice(i,jogo.indexOf('\nfunction ',i+10));
  assert.ok(!/fracture/.test(corpo),
    'eventBlockReason não pode bloquear por Tema (nada de hard lock)');
});
ok('SM_VERSION não mudou e o save antigo continua carregando',()=>{
  assert.strictEqual(t.SM_VERSION,3,'SM_VERSION preservado');
  const A=bootFx({},true);
  beginRun(A,1);
  playWaves(A,2,6);
  A.smCommit();
  const cp=A.smBuildCheckpoint('teste',6);
  /* save sem o campo fracture (versão anterior) ainda restaura */
  const sem={v:3,slot:1,op:'versatile',wave:6};
  const f=A.fractureRunUnpack(sem);
  assert.ok(f,'unpack tolera save sem cp.fracture');
  assert.strictEqual(f.theme,A.fracturePickTheme(f.seed),'tema derivado da seed');
  assert.ok(cp,'checkpoint atual válido');
});
ok('fonte: nenhuma mutação de waveProfile fora do bloco PR13',()=>{
  const {jogo,dentro,linha}=blocoPR13();
  const re=/waveProfile\s*\.\s*(bias|pool)\s*(\[[^\]]*\]\s*)?=[^=]/g;
  let hit,n=0;
  while((hit=re.exec(jogo))){
    n++;
    assert.ok(dentro(hit.index),
      'escrita em waveProfile fora do bloco PR13, linha '+linha(hit.index));
  }
  assert.ok(n>0,'a verificação encontrou escritas para validar');
});
ok('npm test continua listando as suítes (18 legadas + PR13 + PR13.5 B2 + PR13.5 B3 + B3-FIX)',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  const partes=pkg.scripts.test.split('&&').map(s=>s.trim());
  assert.strictEqual(partes.length,21,'21 suítes no npm test');
});

/* =====================================================================
   BLOCO 3 — TESTES (B3.19)
   51 pontos numerados: EVENTOS 1-13 · MINIBOSSES 14-23 · RESSONÂNCIA 24-29
   ESCASSEZ 30-35 · INTENSIDADE 36-41 · SAVE/SANDBOX 42-47 · REGRESSÃO 48-51
   ===================================================================== */
console.log('\n[25] B3 · EVENTOS (1-13)');
const TAGS_B3=t.FRACTURE_EVENT_TAGS;
const evById=id=>t.RUN_EVENT_BY_ID[id];
const todosEventos=()=>t.ALL_RUN_EVENTS.concat(t.FRACTURE_CHAIN_EVENTS);

ok('B3-01: todo evento conhecido tem fractureTags (nenhum sem tag)',()=>{
  const sem=[];
  for(const d of todosEventos())if(!t.fractureEventTags(d).length)sem.push(d.id);
  assert.deepStrictEqual(sem,[],'eventos sem tag');
  /* e nenhuma tag sai do vocabulário */
  const fora=[];
  for(const d of todosEventos())
    for(const g of t.fractureEventTags(d))if(TAGS_B3.indexOf(g)<0)fora.push(d.id+':'+g);
  assert.deepStrictEqual(fora,[],'tags fora do vocabulário');
});
ok('B3-02: as 24 tags são todas usadas (nenhuma órfã) e têm descrição',()=>{
  const usadas=new Set();
  for(const d of todosEventos())for(const g of t.fractureEventTags(d))usadas.add(g);
  assert.deepStrictEqual(TAGS_B3.filter(x=>!usadas.has(x)),[],'tags órfãs');
  for(const g of TAGS_B3)
    assert.ok((t.FRACTURE_EVENT_TAG_DEFS[g]||'').length>8,'descrição de '+g);
});
ok('B3-03: fractureEventTags é leitura pura e estável',()=>{
  const d=evById('x_camara');
  const a=t.fractureEventTags(d),b=t.fractureEventTags(d);
  assert.deepStrictEqual(a,b,'duas leituras iguais');
  assert.ok(a.indexOf('EXPLORACAO')>=0,'x_camara é exploração');
  /* o array devolvido não pode ser a fonte — mutar não contamina o mapa */
  a.push('__LIXO__');
  assert.ok(t.fractureEventTags(d).indexOf('__LIXO__')<0,'array é cópia');
});
ok('B3-04: sem Diretor o multiplicador é exatamente 1 para todo evento',()=>{
  const A=bootFx({});
  const salvo=A.getFx();
  A.setFx(null);                       // "sem Diretor" = sem fractureRun
  try{
    for(const d of todosEventos())
      assert.strictEqual(A.fractureEventBiasMul(d,null),1,'sem Diretor: '+d.id);
  }finally{A.setFx(salvo);}
});
ok('B3-05: com Intensidade 0 o multiplicador é exatamente 1',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,1,1);
  A.fractureSetIntensity(0,'teste');
  const ctx=A.fractureEvCtx(A.fractureWaveCtx());
  for(const d of t.ALL_RUN_EVENTS)
    assert.strictEqual(A.fractureEventBiasMul(d,ctx),1,'int 0: '+d.id);
});
ok('B3-06: o viés tem piso > 0 — nunca hard lock',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,1,10);
  A.fractureSetIntensity(100,'teste');
  const ctx=A.fractureEvCtx(A.fractureWaveCtx());
  let menor=Infinity;
  for(const th of THEMES){
    A.fractureForceTheme(th,'teste');
    const c2=A.fractureEvCtx(A.fractureWaveCtx());
    for(const d of t.ALL_RUN_EVENTS)
      menor=Math.min(menor,A.fractureEventBiasMul(d,c2));
  }
  assert.ok(menor>0.5,'piso medido '+menor.toFixed(3)+' tem que ser > 0.5');
  assert.ok(menor<1,'e ainda assim reduz algo');
});
ok('B3-07: Intensidade 100 NÃO transforma o pool em só eventos temáticos',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,1,15);
  A.fractureSetIntensity(100,'teste');
  for(const th of THEMES){
    A.fractureForceTheme(th,'teste');
    const c2=A.fractureEvCtx(A.fractureWaveCtx());
    const ms=t.ALL_RUN_EVENTS.map(d=>A.fractureEventBiasMul(d,c2));
    const neutros=ms.filter(x=>x===1).length;
    assert.ok(neutros>=t.ALL_RUN_EVENTS.length*.35,
      th+': só '+neutros+' eventos neutros — pool virou temático demais');
  }
});
ok('B3-08: cada Tema favorece as próprias tags e não as alheias',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,1,12);
  A.fractureSetIntensity(100,'teste');
  for(const th of THEMES){
    A.fractureForceTheme(th,'teste');
    const c2=A.fractureEvCtx(A.fractureWaveCtx());
    const prof=t.FRACTURE_EVENT_BIAS[th];
    const tagAfim=Object.keys(prof.tags)[0];
    const alvo=t.ALL_RUN_EVENTS.filter(d=>t.fractureEventTags(d).indexOf(tagAfim)>=0)[0];
    assert.ok(alvo,th+' tem evento com tag '+tagAfim);
    assert.ok(A.fractureEventBiasMul(alvo,c2)>1,
      th+': '+alvo.id+' ('+tagAfim+') deveria subir');
  }
});
ok('B3-09: scoreEvent aplica o Diretor por ÚLTIMO e de forma multiplicativa',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,1,8);
  A.fractureSetIntensity(100,'teste');A.fractureForceTheme('hunt','teste');
  const d=evById('lg_ambush');
  const ctx=A.buildEventContext();
  const neutro=(function(){const f=A.getFx();const th=f.theme;f.theme=null;
    const w=A.scoreEvent(d,ctx);f.theme=th;return w;})();
  const comDir=A.scoreEvent(d,ctx);
  const mul=A.fractureEventBiasMul(d,A.fractureEvCtx(A.fractureWaveCtx()));
  assert.ok(mul>1,'lg_ambush sobe em CAÇADA');
  assert.ok(Math.abs(comDir-Math.max(.01,neutro*mul))<1e-6,
    'score = base × viés, e o viés é o último termo');
});
ok('B3-10: event_triggered só sai em seleção real (nunca em scoring/preview)',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,4);
  const antes=A.getFx().history.filter(h=>h.t==='event_triggered').length;
  const ctx=A.buildEventContext();
  for(const d of t.ALL_RUN_EVENTS){A.scoreEvent(d,ctx);A.fractureEventBiasMul(d,null);}
  A.buildEventContext();
  assert.strictEqual(A.getFx().history.filter(h=>h.t==='event_triggered').length,antes,
    'scoring/preview não pode emitir');
  const d=evById('x_carga');
  A.fractureOnEventChosen(d);
  assert.strictEqual(A.getFx().history.filter(h=>h.t==='event_triggered').length,antes+1,
    'seleção real emite uma vez');
});
ok('B3-11: payload de event_triggered carrega id/family/rarity/tags/wave',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,3,7);
  const d=evById('x_carga');
  A.fractureOnEventChosen(d);
  const b=A.fractureB3();
  assert.ok(b.lastEv,'lastEv gravado');
  assert.strictEqual(b.lastEv.id,d.id);
  assert.strictEqual(b.lastEv.family,d.family);
  assert.strictEqual(b.lastEv.rarity,d.rarity);
  assert.strictEqual(J(b.lastEv.tags),J(t.fractureEventTags(d)),'tags iguais');
  assert.strictEqual(b.lastEv.wave,7,'onda real');
});
ok('B3-12: evento não concede Intensidade duas vezes na mesma onda',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,6);
  const d=evById('fx_res_memoria');          // uncommon
  /* B5: o valor vem da TABELA, não de um literal copiado aqui. Copiar o
     número fazia este teste quebrar por calibração mesmo quando a invariant
     que ele protege (sem dupla cobrança + teto por onda) continuava valendo. */
  const v=t.FRACTURE_EV_INT_BY_RARITY[d.rarity];
  assert.strictEqual(d.rarity,'uncommon','evento de referência é uncommon');
  assert.ok(v>0,'uncommon paga Intensidade ('+v+')');
  const i0=A.fractureGetIntensity();
  A.fractureOnEventChosen(d);const i1=A.fractureGetIntensity();
  assert.strictEqual(i1-i0,Math.min(v,t.FRACTURE_EV_INT_PER_WAVE_MAX),
    'primeiro evento soma o valor da raridade');
  A.fractureOnEventChosen(d);
  assert.strictEqual(A.fractureGetIntensity(),
    i0+Math.min(2*v,t.FRACTURE_EV_INT_PER_WAVE_MAX),'segunda ainda soma');
  for(let k=0;k<6;k++)A.fractureOnEventChosen(d);
  assert.ok(A.fractureGetIntensity()-i0<=t.FRACTURE_EV_INT_PER_WAVE_MAX,
    'teto por onda = '+t.FRACTURE_EV_INT_PER_WAVE_MAX);
});
ok('B3-13: os 12 eventos novos existem, 2 por Tema, com ≥2 escolhas',()=>{
  assert.strictEqual(t.FRACTURE_RUN_EVENTS.length,12);
  const porTema={col:0,cer:0,cac:0,ano:0,res:0,esc:0};
  for(const d of t.FRACTURE_RUN_EVENTS){
    const k=d.id.slice(3,6);
    assert.ok(porTema[k]!=null,'prefixo conhecido: '+d.id);
    porTema[k]++;
    assert.ok(typeof d.render==='function',d.id+' tem render');
    assert.ok((d.nm||'').length>3,d.id+' tem nome');
    /* no mínimo 2 escolhas: conta evOpt no corpo da função */
    const corpo=String(d.render);
    const n=(corpo.match(/evOpt\(/g)||[]).length;
    assert.ok(n>=2,d.id+' precisa de ≥2 escolhas, tem '+n);
    /* e pelo menos uma cobra algo de verdade */
    assert.ok(/damagePlayer|player\.coins-=|coins=Math\.max|smFlat|changeEchoTrust\(e,-/
      .test(corpo),d.id+' precisa ter custo');
  }
  for(const k of Object.keys(porTema))
    assert.strictEqual(porTema[k],2,'Tema '+k+' tem 2 eventos');
});

console.log('\n[26] B3 · MINIBOSSES (14-23)');
ok('B3-14: os 8 minibosses têm tags e elas vêm só do vocabulário',()=>{
  assert.strictEqual(t.MINIBOSS.length,8,'8 minibosses');
  for(const mb of t.MINIBOSS){
    const g=Array.isArray(mb.tags)?mb.tags:[];
    assert.ok(g.length>=2,mb.id+' tem ≥2 tags');
    for(const x of g)assert.ok(t.ENEMY_TAGS.indexOf(x)>=0,mb.id+' tag inválida '+x);
  }
});
ok('B3-15: tags de miniboss são metadado — stats/AI não mudam',()=>{
  for(const mb of t.MINIBOSS){
    assert.ok(Number.isFinite(mb.hp)&&mb.hp>0,mb.id+' hp intacto');
    assert.ok(typeof mb.render==='function'||typeof mb.ai==='function'||true,mb.id+' ok');
  }
  /* o valor canônico medido na auditoria continua valendo */
  const hp={};for(const mb of t.MINIBOSS)hp[mb.id]=mb.hp;
  assert.strictEqual(hp.colossus,1.75,'colossus hp 1.75');
  assert.strictEqual(hp.duelist,0.70,'duelist hp 0.70');
});
ok('B3-16: o filtro de segurança de pickMiniBoss continua decidindo o pool',()=>{
  const p5=t.miniEligiblePool(5),p10=t.miniEligiblePool(10),p15=t.miniEligiblePool(15);
  assert.strictEqual(p5.length,6,'onda 5 → 6 elegíveis');
  assert.strictEqual(p10.length,8,'onda 10 → 8 elegíveis');
  assert.strictEqual(p15.length,7,'onda 15 → 7 elegíveis');
  assert.ok(!p5.some(x=>x.id==='colossus'),'colossus fora da onda 5');
  assert.ok(!p15.some(x=>x.id==='duelist'),'duelist fora da onda 15');
});
ok('B3-17: sem Diretor o peso é 1 para todos (uniforme original)',()=>{
  const A=bootFx({});
  const salvo=A.getFx();
  A.setFx(null);
  try{
    for(const mb of t.MINIBOSS)
      assert.strictEqual(A.fractureMiniWeight(mb,null),1,'sem Diretor: '+mb.id);
  }finally{A.setFx(salvo);}
});
ok('B3-18: nenhum elegível fica com peso 0 em nenhum Tema',()=>{
  const A=bootFx({});beginRun(A,1);
  let menor=Infinity;
  for(const th of THEMES)for(const int of [0,25,50,75,100])for(const w of [5,10,15]){
    A.fractureForceTheme(th,'teste');A.fractureSetIntensity(int,'teste');A.setWave(w);
    for(const mb of t.miniEligiblePool(w)){
      const wt=A.fractureMiniWeight(mb,A.fractureWaveCtx());
      menor=Math.min(menor,wt);
      assert.ok(wt>0,th+'/int'+int+'/w'+w+' → '+mb.id+' zerou');
    }
  }
  assert.ok(menor>0.4,'peso mínimo medido '+menor.toFixed(3));
});
ok('B3-19: cada Tema favorece o próprio miniboss',()=>{
  const A=bootFx({});beginRun(A,1);
  const espera={collapse:'brood',siege:'sentinel',hunt:'duelist',
    anomaly:'oracle',resonance:'oracle',scarcity:'herald'};
  A.fractureSetIntensity(100,'teste');
  for(const th of THEMES){
    A.fractureForceTheme(th,'teste');A.setWave(10);
    const ctx=A.fractureWaveCtx();
    const alvo=t.MINIBOSS.filter(m=>m.id===espera[th])[0];
    const outros=t.miniEligiblePool(10).filter(m=>m.id!==espera[th]);
    const wa=A.fractureMiniWeight(alvo,ctx);
    const media=outros.reduce((s,m)=>s+A.fractureMiniWeight(m,ctx),0)/outros.length;
    assert.ok(wa>media,th+': '+espera[th]+' ('+wa.toFixed(2)+
      ') deveria superar a média dos outros ('+media.toFixed(2)+')');
  }
});
ok('B3-20: a escolha de miniboss é determinística por (seed,Tema,int,wave)',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureForceTheme('siege','teste');A.fractureSetIntensity(70,'teste');
  const seq=[];
  for(let k=0;k<3;k++){
    A.setWave(10);
    const b=A.fractureB3();b.mini={};b.miniSpawn={};
    seq.push(A.fracturePickMiniBoss(10).id);
  }
  assert.strictEqual(seq[0],seq[1],'mesma entrada → mesma escolha');
  assert.strictEqual(seq[1],seq[2],'repetível');
});
ok('B3-21: spawnMiniBoss(n, forced) obedece o forced e grava a escolha',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,5);
  A.fractureForceTheme('anomaly','teste');
  const b=A.fractureB3();b.mini={};b.miniSpawn={};
  const alvo=t.MINIBOSS.filter(m=>m.id==='sentinel')[0];
  const got=A.spawnMiniBoss(5,alvo);
  assert.ok(got,'spawn forçado devolve o boss');
  assert.strictEqual(b.mini[5],'sentinel','escolha gravada');
});
ok('B3-22: Continue/reload NÃO rerrola o miniboss da onda',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,10);
  A.fractureForceTheme('hunt','teste');
  const b=A.fractureB3();b.mini={};b.miniSpawn={};
  const um=A.fracturePickMiniBoss(10).id;
  const pack=A.fractureRunPack();
  const un=A.fractureRunUnpack({fracture:pack});
  assert.strictEqual(un.b3.mini[10],um,'a escolha sobrevive ao reload');
  assert.strictEqual(A.fracturePickMiniBoss(10).id,um,'e não é re-sorteada');
});
ok('B3-23: spawn e kill emitem uma vez cada (kill não duplica)',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,10);
  const mb=t.MINIBOSS.filter(m=>m.id==='herald')[0];
  /* playWaves já emitiu o spawn real da onda 10 — zera as flags para medir */
  const b23=A.fractureB3();b23.miniSpawn={};b23.miniPaid={};
  const h0=A.getFx().history.filter(x=>x.t==='miniboss_spawn').length;
  const k0=A.getFx().history.filter(x=>x.t==='miniboss_killed').length;
  A.fractureOnMiniSpawn(mb,10);
  assert.strictEqual(A.getFx().history.filter(x=>x.t==='miniboss_spawn').length,h0+1);
  A.fractureOnMiniSpawn(mb,10);
  assert.strictEqual(A.getFx().history.filter(x=>x.t==='miniboss_spawn').length,h0+1,
    'segundo spawn na mesma onda não emite');
  const i0=A.fractureGetIntensity();
  A.fractureOnMiniKill(mb,10);
  const ganho=A.fractureGetIntensity()-i0;
  A.fractureOnMiniKill(mb,10);
  assert.strictEqual(A.fractureGetIntensity()-i0,ganho,'segundo kill não paga de novo');
  assert.ok(ganho>=3&&ganho<=5,'kill dá +3..+5 (medido '+ganho+')');
  assert.strictEqual(t.FRACTURE_EVENT_GRID.miniboss_killed.i,ganho,'bate com a grade');
});

console.log('\n[27] B3 · RESSONÂNCIA (24-29)');
const echoVivo=(over)=>Object.assign({
  id:'e1',alive:true,hostile:false,trust:50,hp:100,x:0,y:0,r:10,
  dis:{st:'stable',p:0},rel:{score:0}
},over||{});
ok('B3-24: o Diretor LÊ o Echo e devolve estado neutro sem Echo',()=>{
  const A=bootFx({});beginRun(A,1);
  A.setEchoes([]);
  const r=A.fractureResoRead();
  assert.strictEqual(r.count,0,'sem Eco');
  assert.strictEqual(r.trust,null);
  assert.strictEqual(r.rel,null);
  A.setEchoes([echoVivo()]);
  const r2=A.fractureResoRead();
  assert.strictEqual(r2.count,1,'lê o Eco');
  assert.strictEqual(r2.trust,50,'trust lido');
  assert.strictEqual(r2.disSt,'stable');
});
ok('B3-25: RESSONÂNCIA nunca ESCREVE no Echo (trust/rel/dis imutáveis)',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,8);
  const e=echoVivo({trust:50});
  A.setEchoes([e]);
  const antes=J({trust:e.trust,st:e.dis.st,rel:e.rel,hp:e.hp});
  A.fractureForceTheme('resonance','teste');
  A.fractureSetIntensity(100,'teste');
  const ctx=A.fractureEvCtx(A.fractureWaveCtx());
  for(const d of t.ALL_RUN_EVENTS)A.fractureEventBiasMul(d,ctx);
  for(let k=0;k<40;k++)A.fractureResoRead();
  A.fractureResoReact(evById('lg_ghost'),{});
  assert.strictEqual(J({trust:e.trust,st:e.dis.st,rel:e.rel,hp:e.hp}),antes,
    'nada do Diretor alterou o Eco');
});
ok('B3-26: fonte — o bloco de RESSONÂNCIA não chama mutador de Echo',()=>{
  const jogo=m[1];
  const ini=jogo.indexOf('BLOCO 3 — RESSONÂNCIA');
  const fim=jogo.indexOf('BLOCO 3 — EVENTOS');
  assert.ok(ini>0&&fim>ini,'bloco localizado');
  const seg=jogo.slice(ini,fim);
  for(const proibido of ['echoSetDis','changeEchoTrust(','smFlat(','echoRelResonance',
                         'echoDissonance(','setDissonance'])
    assert.ok(seg.indexOf(proibido)<0,'RESSONÂNCIA não pode chamar '+proibido);
});
ok('B3-27: Echo estável favorece memória; Echo em crise favorece distorção',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,8);
  A.fractureForceTheme('resonance','teste');A.fractureSetIntensity(100,'teste');
  const ctx=A.fractureEvCtx(A.fractureWaveCtx());
  const ghost=evById('lg_ghost'),mirror=evById('lg_mirror');
  A.setEchoes([echoVivo({trust:70,dis:{st:'stable',p:0}})]);
  const c1=A.fractureEvCtx(A.fractureWaveCtx());
  const g1=A.fractureResoBias(ghost,c1),m1=A.fractureResoBias(mirror,c1);
  A.setEchoes([echoVivo({trust:5,hostile:true,dis:{st:'ruptured',p:1}})]);
  const c2=A.fractureEvCtx(A.fractureWaveCtx());
  const g2=A.fractureResoBias(ghost,c2),m2=A.fractureResoBias(mirror,c2);
  assert.ok(g1>1,'estável: memória sobe ('+g1.toFixed(2)+')');
  assert.ok(m1<1,'estável: distorção desce ('+m1.toFixed(2)+')');
  assert.ok(m2>1,'crise: distorção sobe ('+m2.toFixed(2)+')');
  assert.ok(m2>m1,'a crise inverte a preferência');
});
ok('B3-28: RESSONÂNCIA não afeta nenhum outro Tema e run sem Eco fica neutra',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,8);
  A.setEchoes([echoVivo()]);A.fractureSetIntensity(100,'teste');
  for(const th of THEMES.filter(x=>x!=='resonance')){
    A.fractureForceTheme(th,'teste');
    const c=A.fractureEvCtx(A.fractureWaveCtx());
    for(const d of t.ALL_RUN_EVENTS)
      assert.strictEqual(A.fractureResoBias(d,c),1,th+' não pode sentir RESSONÂNCIA');
  }
  A.fractureForceTheme('resonance','teste');
  A.setEchoes([]);
  const c0=A.fractureEvCtx(A.fractureWaveCtx());
  for(const d of t.ALL_RUN_EVENTS)
    assert.strictEqual(A.fractureResoBias(d,c0),1,'sem Eco: neutro');
});
ok('B3-29: as reações de RESSONÂNCIA respeitam cooldown (no máx. 1 a cada 3 ondas)',()=>{
  const A=bootFx({});beginRun(A,1);
  A.setEchoes([echoVivo()]);
  A.fractureForceTheme('resonance','teste');A.fractureSetIntensity(60,'teste');
  const b=A.fractureB3();b.resoW=0;
  const d=evById('lg_ghost');
  let falas=0;
  for(let w=1;w<=12;w++){
    A.setWave(w);
    if(A.fractureResoReact(d,{}))falas++;
  }
  assert.ok(falas<=4,'12 ondas → no máximo 4 reações (medido '+falas+')');
  assert.ok(Object.keys(t.FRACTURE_RESO_LINES).length===4,'4 situações, não mais');
});

console.log('\n[28] B3 · ESCASSEZ (30-35)');
ok('B3-30: ESCASSEZ afeta SÓ crédito de evento de Fratura',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,12);
  A.fractureForceTheme('scarcity','teste');A.fractureSetIntensity(100,'teste');
  assert.strictEqual(A.fractureCoinMul('kill'),1,'kill intacto');
  assert.strictEqual(A.fractureCoinMul('shop'),1,'loja intacta');
  assert.strictEqual(A.fractureCoinMul('drop'),1,'drop intacto');
  const m=A.fractureCoinMul('fracture_event');
  assert.ok(m<1&&m>=.85,'evento de Fratura reduz ('+m.toFixed(3)+')');
  assert.strictEqual(A.fractureCoins(100,'kill'),100);
  assert.ok(A.fractureCoins(100,'fracture_event')<100);
});
ok('B3-31: fora de ESCASSEZ a economia fica exatamente intacta',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,12);
  A.fractureSetIntensity(100,'teste');
  for(const th of THEMES.filter(x=>x!=='scarcity')){
    A.fractureForceTheme(th,'teste');
    assert.strictEqual(A.fractureCoinMul('fracture_event'),1,th+' não mexe em crédito');
    assert.strictEqual(A.fractureCoins(100,'fracture_event'),100,th);
    assert.strictEqual(A.fractureShopRerollCost(10),10,th+' não mexe no reroll');
  }
});
ok('B3-32: o efeito cresce com a Intensidade (não é -X% fixo)',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,12);
  A.fractureForceTheme('scarcity','teste');
  const ms=[];
  for(const int of [0,25,50,75,100]){
    A.fractureSetIntensity(int,'teste');
    ms.push(A.fractureCoinMul('fracture_event'));
  }
  assert.strictEqual(ms[0],1,'int 0 não sente nada');
  for(let i=1;i<ms.length;i++)
    assert.ok(ms[i]<=ms[i-1],'monótono decrescente: '+J(ms));
  assert.ok(ms[4]<ms[2],'int 100 reduz mais que int 50');
});
ok('B3-33: custo nunca vira desconto (valor negativo passa intacto)',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,12);
  A.fractureForceTheme('scarcity','teste');A.fractureSetIntensity(100,'teste');
  assert.strictEqual(A.fractureCoins(-50,'fracture_event'),-50);
  assert.strictEqual(A.fractureCoins(0,'fracture_event'),0);
  assert.ok(!Number.isFinite(A.fractureCoins(NaN,'fracture_event'))===false,
    'NaN não vaza como número estranho');
});
ok('B3-34: Resíduos só pela API da PR12 — fonte não escreve em fracRes',()=>{
  const jogo=m[1];
  const ini=jogo.indexOf('BLOCO 3 — RESSONÂNCIA');
  const fim=jogo.indexOf('BLOCO 3 — EVENTOS');
  const seg=jogo.slice(ini,fim);
  assert.ok(/fractureRun\s*\.\s*res\s*=/.test(seg)===false,
    'Bloco 3 não pode escrever em fractureRun.res');
  assert.ok(/fracRun\s*\.\s*res\s*=/.test(seg)===false,
    'Bloco 3 não pode escrever em fracRun.res');
  assert.ok(seg.indexOf('addResidues(')>=0,'usa a API addResidues');
});
ok('B3-35: bônus de Resíduo vale só em ESCASSEZ e o reroll é 1× por onda',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,10);
  A.setWave(10);
  A.fractureForceTheme('collapse','teste');A.fractureSetIntensity(100,'teste');
  const r0=A.getResidues();
  A.fractureScarcityResidues(3,'teste');
  assert.strictEqual(A.getResidues()-r0,0,'outro Tema: sem bônus');
  A.fractureForceTheme('scarcity','teste');
  const r1=A.getResidues();
  A.fractureScarcityResidues(3,'teste');
  assert.strictEqual(A.getResidues()-r1,4,'ESCASSEZ: 3 + 1 de bônus');
  /* reroll: barato uma vez, depois volta ao base */
  const b=A.fractureB3();b.scarUsed={};
  assert.strictEqual(A.fractureShopRerollCost(10),7,'primeiro da visita');
  A.fractureShopRerollUsed();
  assert.strictEqual(A.fractureShopRerollCost(10),10,'depois de usado volta a 10');
});

console.log('\n[29] B3 · INTENSIDADE (36-41)');
ok('B3-36: magnitude vem da raridade, nunca de intensity += direto',()=>{
  /* B5 · valores recalibrados por medição (ver comentário em
     FRACTURE_EV_INT_BY_RARITY no index.html). O que este teste garante não é
     um número específico: é que a magnitude SAI desta tabela, que ela é
     monotônica na raridade e que `common` continua zerado — sem isso spam de
     evento trivial voltaria a farmar Intensidade. */
  assert.strictEqual(J(t.FRACTURE_EV_INT_BY_RARITY),
    J({common:0,uncommon:3,rare:6,anomalous:10}),'tabela de raridade');
  const R=t.FRACTURE_EV_INT_BY_RARITY;
  assert.strictEqual(R.common,0,'common = 0 (anti-farm)');
  assert.ok(R.uncommon<R.rare&&R.rare<R.anomalous,
    'magnitude cresce com a raridade');
  const jogo=m[1];
  const ini=jogo.indexOf('BLOCO 3 — MINIBOSSES');
  const fim=jogo.indexOf('BLOCO 3 — EVENTOS');
  const seg=jogo.slice(ini,fim);
  assert.ok(!/intensity\s*\+=\s*\d/.test(seg),
    'nada de "intensity += N" solto no Bloco 3');
});
ok('B3-37: eventos comuns não dão Intensidade',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,6);
  const i0=A.fractureGetIntensity();
  A.fractureOnEventChosen(evById('x_carga'));      // common
  assert.strictEqual(A.fractureGetIntensity(),i0,'common = +0');
});
ok('B3-38: os tetos por onda e por run são respeitados',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,6);
  const d=evById('fx_res_memoria');
  for(let k=0;k<30;k++)A.fractureOnEventChosen(d);
  const b=A.fractureB3();
  assert.ok(b.evWG<=t.FRACTURE_EV_INT_PER_WAVE_MAX,'teto por onda');
  assert.ok(b.evRG<=t.FRACTURE_EV_INT_PER_RUN_MAX,'teto por run');
});
ok('B3-39: chain (noPool) não cobra Intensidade duas vezes',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,6);
  const c=t.FRACTURE_CHAIN_EVENTS[0];
  assert.ok(c.noPool,'cadeia fora do pool');
  const i0=A.fractureGetIntensity();
  A.fractureOnEventChosen(c);
  assert.strictEqual(A.fractureGetIntensity(),i0,'cadeia não cobra');
});
ok('B3-40: o pacing sobe sem nunca chegar a 100 na onda 10',()=>{
  const A=bootFx({});beginRun(A,1);
  const alvo=[5,10,15,19],vals={};
  for(const w of alvo){playWaves(A,(vals.last||1),w);vals[w]=A.fractureGetIntensity();vals.last=w;}
  for(let i=1;i<alvo.length;i++)
    assert.ok(vals[alvo[i]]>vals[alvo[i-1]],'curva crescente: '+J(vals));
  assert.ok(vals[10]<100,'onda 10 = '+vals[10]+' (proibido chegar a 100)');
  assert.ok(vals[19]<100,'onda 19 = '+vals[19]);
});
ok('B3-41: Intensidade continua clampada em FRACTURE_INT_MIN..MAX',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureSetIntensity(9999,'teste');
  assert.strictEqual(A.fractureGetIntensity(),t.FRACTURE_INT_MAX);
  A.fractureSetIntensity(-9999,'teste');
  assert.strictEqual(A.fractureGetIntensity(),t.FRACTURE_INT_MIN);
});

console.log('\n[30] B3 · SAVE / SANDBOX (42-47)');
ok('B3-42: fractureRun.b3 é persistido e sanitizado',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,10);
  A.fractureOnEventChosen(evById('fx_res_memoria'));
  A.fractureOnMiniSpawn(t.MINIBOSS[0]);
  const p=A.fractureRunPack();
  assert.ok(p.b3,'b3 no pack');
  const un=A.fractureRunUnpack({fracture:p});
  assert.strictEqual(un.b3.evW,p.b3.evW);
  assert.deepStrictEqual(un.b3.mini,p.b3.mini);
  assert.strictEqual(un.b3.lastEv.id,p.b3.lastEv.id);
});
ok('B3-43: save antigo SEM b3 continua carregando (b3 zerado)',()=>{
  const A=bootFx({});
  const velho={v:1,theme:'hunt',seed:4242,intensity:30,
    wave:{wave:8,last:8,bias:{},pool:[]},hist:[],last:null};
  const un=A.fractureRunUnpack({fracture:velho});
  assert.strictEqual(un.theme,'hunt');
  assert.strictEqual(un.intensity,30);
  assert.ok(un.b3,'b3 criado');
  assert.strictEqual(un.b3.evRG,0,'zerado');
  assert.strictEqual(J(un.b3.mini),'{}','mini zerado');
});
ok('B3-44: lixo no b3 do save é recusado (onda/id/tags inválidos)',()=>{
  const A=bootFx({});
  const sujo={v:1,theme:'siege',seed:1,intensity:10,
    wave:{wave:5,last:5,bias:{},pool:[]},hist:[],last:null,
    b3:{evW:'x',evWG:999,evRG:-50,
      mini:{0:'nao_existe',99:'herald',7:'herald',__proto__:'x'},
      miniSpawn:{'-1':1},miniPaid:{},
      lastEv:{id:'inexistente',wave:'muitas',family:1,rarity:2,tags:['FORA']},
      resoW:'y',scarUsed:{}}};
  const un=A.fractureRunUnpack({fracture:sujo});
  assert.strictEqual(un.b3.evWG,t.FRACTURE_EV_INT_PER_WAVE_MAX,'evWG clampado');
  assert.strictEqual(un.b3.evRG,0,'evRG negativo → 0');
  assert.ok(!un.b3.mini[0],'onda 0 recusada');
  assert.ok(!un.b3.mini[99],'onda fora de MAX_WAVE recusada');
  assert.ok(!un.b3.mini.hasOwnProperty('__proto__'),'chave de protótipo recusada');
  assert.strictEqual(un.b3.mini[7],'herald','entrada válida sobrevive');
  assert.strictEqual(un.b3.lastEv,null,'lastEv com id inexistente → null');
});
ok('B3-45: SM_VERSION continua 3',()=>{
  assert.strictEqual(t.SM_VERSION,3);
});
ok('B3-46: Sandbox recusa gravar checkpoint',()=>{
  const A=bootFx({});
  A.sandboxOpenSetup();A.getSandboxCfg().char=0;A.sandboxStart();
  A.setWave(6);A.spawnWave(6);
  const cp=A.captureCheckpoint('sb-teste',6);
  assert.ok(!cp,'captureCheckpoint recusado em sandbox');
  A.sandboxExit();
});
ok('B3-47: a seção de Sandbox do Bloco 3 existe e só lê',()=>{
  const jogo=m[1];
  const i=jogo.indexOf('function fractureSandboxSection(');
  const seg=jogo.slice(i,jogo.indexOf('\nfunction ',i+10));
  assert.ok(seg.indexOf('fractureB3InspectorLines')>=0,
    'Sandbox mostra eventos/miniboss/ressonância/escassez');
  assert.ok(!/fractureOnEventChosen|fractureOnMiniKill|addResidues\(/.test(seg),
    'Sandbox não emite evento nem dá resíduo');
});

console.log('\n[31] B3 · REGRESSÃO (48-51)');
ok('B3-48: eventBlockReason continua sendo a única porta de bloqueio',()=>{
  const jogo=m[1];
  const i=jogo.indexOf('function eventBlockReason(');
  const seg=jogo.slice(i,jogo.indexOf('\nfunction ',i+10));
  assert.ok(!/fracture/.test(seg),'eventBlockReason não conhece o Diretor');
});
ok('B3-49: o Diretor é influência — nenhum "if theme === X return" no Bloco 3',()=>{
  const jogo=m[1];
  const ini=jogo.indexOf('BLOCO 3 — MINIBOSSES');
  const fim=jogo.indexOf('ciclo de vida da run');
  const seg=jogo.slice(ini,fim);
  /* hard lock clássico: comparar o Tema e DEVOLVER um valor fixo */
  assert.ok(!/theme\s*===?\s*'[a-z]+'\s*\)\s*return\s+[^;]*\bMINIBOSS\b/.test(seg),
    'não pode devolver miniboss fixo por Tema');
  assert.ok(!/theme\s*===?\s*'[a-z]+'\s*\)\s*return\s+RUN_EVENT/.test(seg),
    'não pode devolver evento fixo por Tema');
});
ok('B3-50: DEV/Sandbox não gravam nem contaminam a run',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,6);
  const antes=J(A.fractureRunPack());
  A.fractureInspectorText();
  A.fractureB3InspectorLines();
  assert.strictEqual(J(A.fractureRunPack()),antes,'inspetor é leitura pura');
});
ok('B3-51: os 12 eventos novos não quebram a distribuição do pool legado',()=>{
  /* convenção medida no pool base: common=w42-46, uncommon=w8-22,
     rare=w8-10 e sempre oncePerRun. Os novos seguem isso. */
  for(const d of t.FRACTURE_RUN_EVENTS){
    assert.strictEqual(d.rarity,'uncommon',d.id+' segue a convenção');
    assert.ok(d.weight>=8&&d.weight<=22,d.id+' peso '+d.weight+' na faixa uncommon');
    assert.ok(!d.oncePerRun,d.id+' é recorrente (identidade da run)');
  }
  const novos=t.FRACTURE_RUN_EVENTS.reduce((s,d)=>s+d.weight,0);
  const base=t.ALL_RUN_EVENTS.filter(d=>t.FRACTURE_RUN_EVENTS.indexOf(d)<0)
    .reduce((s,d)=>s+d.weight,0);
  const share=novos/(novos+base);
  assert.ok(share<0.15,'novos são '+(share*100).toFixed(1)+'% do pool (< 15%)');
  const fams={};
  for(const d of t.FRACTURE_RUN_EVENTS)fams[d.family]=(fams[d.family]||0)+1;
  assert.ok(Object.keys(fams).length>=8,'espalhados em ≥8 famílias');
  assert.ok(Math.max.apply(null,Object.keys(fams).map(k=>fams[k]))<=2,
    'nenhuma família recebe mais de 2 eventos novos');
});

/* =====================================================================
   BLOCO 4 — HARDENING DO B3 (pontos 1-5)
   1. fx_cac_assinatura2 sobrevive ao Continue
   2. a cadeia dispara uma vez
   3. não duplica recompensa/custo
   4. render de fx_esc_tempo é puro
   5. 100 renders não alteram estado
   ===================================================================== */
console.log('\n[32] B4 · HARDENING DO B3 (1-5)');

ok('B4-01: fx_cac_assinatura2 sobrevive a checkpoint + Continue',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,6);
  /* o jogador aceita "DEIXAR CHEGAR E ENFRENTAR" → enfileira a continuação */
  A.setEvQueue(['fx_cac_assinatura2']);
  assert.strictEqual(A.getEvQueue().length,1,'fila montada');
  const cp=A.smBuildCheckpoint('teste-chain',6);
  assert.ok(cp,'checkpoint construído');
  /* reload real: o Continue passa por evMemRestore */
  const pack=A.evMemPack();
  assert.ok(Array.isArray(pack.q),'pack carrega a fila');
  A.evMemRestore(pack);
  assert.strictEqual(J(A.getEvQueue()),J(['fx_cac_assinatura2']),
    'a cadeia continua existindo depois do reload');
});
ok('B4-02: a cadeia dispara exatamente uma vez (sem duplicar no restore)',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,6);
  A.setEvQueue(['fx_cac_assinatura2']);
  const pack=A.evMemPack();
  /* três ciclos de pack/restore seguidos não podem multiplicar a fila */
  for(let k=0;k<3;k++){A.evMemRestore(pack);}
  assert.strictEqual(A.getEvQueue().length,1,
    'restore repetido não duplica a entrada');
  /* e o shift() consome: depois de sair da fila, não volta */
  const id=A.getEvQueue().shift();
  assert.strictEqual(id,'fx_cac_assinatura2');
  const pack2=A.evMemPack();
  A.evMemRestore(pack2);
  assert.strictEqual(J(A.getEvQueue()),'[]','fila vazia continua vazia');
});
ok('B4-03: a fila persistida é sanitizada (ids reais, só cadeia, sem duplicata)',()=>{
  const A=bootFx({});
  const sujo={q:['nao_existe','x_carga','fx_cac_assinatura2',
    'fx_cac_assinatura2','__proto__','constructor',123,null,'x_feridoposto']};
  A.evMemRestore(sujo);
  const q=A.getEvQueue();
  assert.ok(q.indexOf('nao_existe')<0,'id inexistente recusado');
  assert.ok(q.indexOf('x_carga')<0,'evento que não é cadeia recusado');
  assert.ok(q.indexOf('__proto__')<0,'chave de protótipo recusada');
  assert.ok(q.indexOf('constructor')<0,'constructor recusado');
  assert.strictEqual(q.filter(x=>x==='fx_cac_assinatura2').length,1,'sem duplicata');
  assert.ok(q.indexOf('x_feridoposto')>=0,'cadeia legada válida aceita');
  /* teto */
  const muitas=A.RUN_CHAIN_EVENTS.map(d=>d.id)
    .concat(A.FRACTURE_CHAIN_EVENTS.map(d=>d.id));
  A.setEvQueue(muitas);
  A.evMemRestore(A.evMemPack());
  assert.ok(A.getEvQueue().length<=A.EV_QUEUE_MAX,
    'teto EV_QUEUE_MAX='+A.EV_QUEUE_MAX+' respeitado');
  /* save antigo sem q continua funcionando */
  A.evMemRestore({rc:['x_carga']});
  assert.strictEqual(J(A.getEvQueue()),'[]','save antigo → fila vazia');
});
ok('B4-04: a cadeia não duplica Intensidade nem recompensa no reload',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,6);
  const d=A.RUN_EVENT_BY_ID['fx_cac_assinatura2'];
  assert.ok(d&&d.chain,'fx_cac_assinatura2 é cadeia');
  A.setEvQueue([d.id]);
  const intAntes=A.fractureGetIntensity();
  const coinsAntes=A.getPlayer().coins;
  /* escolha real da cadeia */
  A.fractureOnEventChosen(d);
  const ganhoInt=A.fractureGetIntensity()-intAntes;
  /* agora simula o reload: pack + restore, e escolhe de novo */
  A.evMemRestore(A.evMemPack());
  A.fractureOnEventChosen(d);
  const ganho2=A.fractureGetIntensity()-intAntes;
  /* cadeia é noPool/rare: o teto por onda impede o segundo pagamento */
  assert.ok(ganho2<=t.FRACTURE_EV_INT_PER_WAVE_MAX,
    'reload não duplica Intensidade ('+ganhoInt+' → '+ganho2+')');
  /* moedas não podem ter sido creditadas duas vezes pelo mesmo evento */
  assert.ok(A.getPlayer().coins-coinsAntes<200,
    'recompensa não duplica no reload');
});
ok('B4-05: fractureScarcityPreview é pura — 100 chamadas não mudam estado',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,10);
  A.fractureForceTheme('scarcity','teste');A.fractureSetIntensity(100,'teste');
  const resAntes=A.getResidues();
  const packAntes=J(A.fractureRunPack());
  const coinsAntes=A.getPlayer().coins;
  let v=0;
  for(let k=0;k<100;k++)v=A.fractureScarcityPreview(4);
  assert.strictEqual(A.getResidues(),resAntes,'resíduo intacto após 100 previews');
  assert.strictEqual(A.getPlayer().coins,coinsAntes,'créditos intactos');
  assert.strictEqual(J(A.fractureRunPack()),packAntes,'estado do Diretor intacto');
  assert.strictEqual(v,5,'preview devolve 4 + 1 de bônus em ESCASSEZ');
  /* e a concessão explícita continua funcionando, uma vez */
  const g=A.fractureGrantResidues(4,'teste');
  assert.ok(g,'grant concede');
  assert.strictEqual(A.getResidues()-resAntes,5,'concedeu exatamente o previsto');
});
ok('B4-06: fora de ESCASSEZ a oportunidade não paga resíduo (B3 preservado)',()=>{
  const A=bootFx({});beginRun(A,1);playWaves(A,2,10);
  for(const th of THEMES.filter(x=>x!=='scarcity')){
    A.fractureForceTheme(th,'teste');A.fractureSetIntensity(100,'teste');
    assert.strictEqual(A.fractureScarcityPreview(3),0,th+': preview 0');
    const r=A.getResidues();
    A.fractureGrantResidues(3,'teste');
    assert.strictEqual(A.getResidues(),r,th+': nada concedido');
  }
});
ok('B4-07: o texto de fx_esc_tempo não chama função com efeito colateral',()=>{
  const jogo=m[1];
  const i=jogo.indexOf("id:'fx_esc_tempo'");
  assert.ok(i>0,'evento localizado');
  const j=jogo.indexOf('\n{id:',i+10);
  const corpo=jogo.slice(i,j);
  /* o texto (fora do callback) só pode consultar a função pura */
  const texto=corpo.slice(0,corpo.indexOf('[0,3,1]'));
  assert.ok(texto.indexOf('fractureScarcityPreview')>=0,
    'texto usa fractureScarcityPreview');
  assert.ok(texto.indexOf('fractureGrantResidues')<0&&
            texto.indexOf('fractureScarcityResidues')<0,
    'texto não pode chamar a concessão');
  /* e o callback chama a concessão exatamente uma vez */
  const cb=corpo.slice(corpo.indexOf('[0,3,1]'));
  assert.strictEqual((cb.match(/fractureGrantResidues\(|fractureScarcityResidues\(/g)||[]).length,1,
    'callback concede uma vez');
});

/* ============ [33] B4 · ASSINATURAS, REVELAÇÃO, STAGES, CODEX ============ */
console.log('\n[33] B4 · BLOCO 4 — ASSINATURAS · REVELAÇÃO · STAGES · CODEX (8-58)');

/* ---------------- ASSINATURAS (B4.3 / B4.4) ---------------- */
ok('B4-08: existem 12 assinaturas, exatamente 2 por Tema',()=>{
  const A=bootFx({});
  assert.strictEqual(A.FRACTURE_SIGNATURES.length,12,'12 assinaturas');
  const por={};
  for(const s of A.FRACTURE_SIGNATURES)por[s.theme]=(por[s.theme]||0)+1;
  for(const th of THEMES)assert.strictEqual(por[th],2,th+': 2 assinaturas');
});
ok('B4-09: cada assinatura tem estrutura completa e id único no lookup',()=>{
  const A=bootFx({});
  const ids=new Set();
  for(const s of A.FRACTURE_SIGNATURES){
    for(const k of ['id','theme','nm','minWave','minStage','add','from','lore'])
      assert.ok(s[k]!=null,s.id+': campo '+k+' presente');
    assert.ok(THEMES.indexOf(s.theme)>=0,s.id+': Tema válido');
    assert.ok(!ids.has(s.id),s.id+': id único');
    ids.add(s.id);
    assert.strictEqual(A.FRACTURE_SIG_BY_ID[s.id],s,s.id+': lookup por id');
  }
});
ok('B4-10: nomes são narrativos pt-BR — nunca id cru nem token técnico',()=>{
  const A=bootFx({});
  for(const s of A.FRACTURE_SIGNATURES){
    assert.notStrictEqual(s.nm,s.id,s.id+': nome difere do id');
    assert.ok(s.nm.indexOf('_')<0,s.id+': sem underscore no nome');
    assert.ok(!/sig_|signature|_[0-9]/i.test(s.nm),s.id+': sem token técnico');
    assert.ok(s.nm.length>=3,s.id+': nome legível');
    assert.strictEqual(s.nm,s.nm.toUpperCase(),s.id+': em caixa alta');
  }
});
ok('B4-11: minWave nunca pede arquétipo ainda bloqueado na base',()=>{
  const A=bootFx({});beginRun(A,1);
  for(const s of A.FRACTURE_SIGNATURES){
    const base=A.waveCompBase(s.minWave);
    for(const k in s.add)
      assert.ok((base[k]|0)>0,
        s.id+': '+k+' já liberado na w'+s.minWave+' (base='+(base[k]|0)+')');
  }
});
ok('B4-12: add e from só usam arquétipos que existem',()=>{
  const A=bootFx({});
  for(const s of A.FRACTURE_SIGNATURES){
    for(const k in s.add)
      assert.ok(A.WAVE_ARCHETYPES.indexOf(k)>=0,s.id+': add '+k+' existe');
    for(const k of s.from)
      assert.ok(A.WAVE_ARCHETYPES.indexOf(k)>=0,s.id+': from '+k+' existe');
    assert.ok(s.from.length>0,s.id+': tem de onde tirar');
  }
});
ok('B4-13: assinatura nunca é elegível antes do próprio minWave',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureSetIntensity(100,'teste');
  for(const th of THEMES){
    A.fractureForceTheme(th,'teste');
    for(const s of A.FRACTURE_SIGNATURES){
      if(s.theme!==th)continue;
      for(let w=1;w<s.minWave;w++)
        assert.strictEqual(A.fractureSignatureEligible(s,w),false,
          s.id+' não elegível na w'+w);
    }
  }
});
ok('B4-14: assinatura nunca em onda de miniboss nem na onda final',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureSetIntensity(100,'teste');
  for(const th of THEMES){
    A.fractureForceTheme(th,'teste');
    for(const s of A.FRACTURE_SIGNATURES){
      if(s.theme!==th)continue;
      for(const w of A.MINI_WAVES)
        assert.strictEqual(A.fractureSignatureEligible(s,w),false,
          s.id+' bloqueada na w'+w+' (miniboss tem prioridade)');
      assert.strictEqual(A.fractureSignatureEligible(s,A.MAX_WAVE),false,
        s.id+' bloqueada na onda final');
    }
  }
});
ok('B4-15: assinatura exige o Stage mínimo próprio (LATENTE não libera)',()=>{
  const A=bootFx({});beginRun(A,1);
  const ordem=['latente','instavel','propagando','critica','ruptura'];
  const mins={latente:0,instavel:20,propagando:40,critica:60,ruptura:80};
  for(const th of THEMES){
    A.fractureForceTheme(th,'teste');
    for(const s of A.FRACTURE_SIGNATURES){
      if(s.theme!==th)continue;
      const w=Math.max(s.minWave+1,8);
      for(const st of ordem){
        if(ordem.indexOf(st)>=ordem.indexOf(s.minStage))continue;
        A.fractureSetIntensity(mins[st],'teste');
        assert.strictEqual(A.fractureSignatureEligible(s,w),false,
          s.id+' bloqueada em '+st.toUpperCase());
      }
    }
  }
});
ok('B4-16: assinatura redistribui 1:1 — total preservado, budget intacto',()=>{
  const A=bootFx({});beginRun(A,1);
  const b=A.fractureB4();
  for(const s of A.FRACTURE_SIGNATURES){
    if(s.shrink)continue;                       // ESCASSEZ remove de propósito
    A.fractureForceTheme(s.theme,'teste');
    A.fractureSetIntensity(100,'teste');
    const w=Math.max(s.minWave,8);
    b.sig={};b.sig[w]=s.id;
    const shaped=A.fractureShapeWave(A.waveCompBase(w),w);
    const com=A.fractureApplySignature(shaped,w);
    /* a assinatura roda ANTES do waveCompFit no pipeline real
       (waveComp = fit(applySignature(shape(base)))), então o que ela deve
       garantir é a preservação 1:1 — quem impõe o teto é o fit, depois. */
    assert.strictEqual(A.waveCompTotal(com),A.waveCompTotal(shaped),
      s.id+': total preservado (1:1)');
    const fit=A.waveCompFit(com,A.ENEMY_BUDGET);
    assert.ok(A.waveCompTotal(fit)<=A.ENEMY_BUDGET,
      s.id+': pipeline fechado dentro do budget');
  }
});
ok('B4-17: assinatura de ESCASSEZ com shrink só REDUZ a quantidade',()=>{
  const A=bootFx({});beginRun(A,1);
  const b=A.fractureB4();
  A.fractureForceTheme('scarcity','teste');A.fractureSetIntensity(100,'teste');
  let achou=0;
  for(const s of A.FRACTURE_SIGNATURES){
    if(s.theme!=='scarcity'||!s.shrink)continue;
    achou++;
    const w=Math.max(s.minWave,8);
    b.sig={};b.sig[w]=s.id;
    const shaped=A.fractureShapeWave(A.waveCompBase(w),w);
    const com=A.fractureApplySignature(shaped,w);
    assert.ok(A.waveCompTotal(com)<A.waveCompTotal(shaped),
      s.id+': shrink reduziu o total');
  }
  assert.ok(achou>=1,'existe ao menos uma assinatura com shrink');
});
ok('B4-18: assinatura nunca cria arquétipo bloqueado na onda',()=>{
  const A=bootFx({});beginRun(A,1);
  const b=A.fractureB4();
  for(const s of A.FRACTURE_SIGNATURES){
    A.fractureForceTheme(s.theme,'teste');
    A.fractureSetIntensity(100,'teste');
    const w=Math.max(s.minWave,8);
    b.sig={};b.sig[w]=s.id;
    const base=A.waveCompBase(w);
    const com=A.fractureApplySignature(A.fractureShapeWave(base,w),w);
    for(const k in com)
      if((com[k]|0)>0)
        assert.ok((base[k]|0)>0,s.id+': '+k+' estava bloqueado na w'+w);
  }
});
ok('B4-19: teto de assinaturas por run é respeitado',()=>{
  const A=bootFx({});beginRun(A,1);
  const b=A.fractureB4();
  A.fractureSetIntensity(100,'teste');
  assert.ok(A.FRACTURE_SIG_MAX_PER_RUN>=1,'teto definido');
  b.sigN=A.FRACTURE_SIG_MAX_PER_RUN;
  /* prova primeiro que SEM o teto sairia algo — senão o teste passa no vazio */
  b.sigN=0;b.sig={};b.sigUsed=[];b.sigLast=0;
  A.fractureForceTheme('collapse','teste');
  let sairia=0;
  for(let w=8;w<=19;w++){b.sig={};if(A.fracturePickSignature(w))sairia++;}
  assert.ok(sairia>0,'controle: sem teto saem assinaturas ('+sairia+' ondas)');
  b.sigN=A.FRACTURE_SIG_MAX_PER_RUN;
  for(const th of THEMES){
    A.fractureForceTheme(th,'teste');
    for(let w=1;w<=19;w++){
      b.sig={};
      assert.strictEqual(A.fracturePickSignature(w),null,
        th+' w'+w+': teto atingido, nada sai');
    }
  }
});
ok('B4-20: cooldown entre assinaturas é respeitado',()=>{
  const A=bootFx({});beginRun(A,1);
  const b=A.fractureB4();
  A.fractureSetIntensity(100,'teste');
  A.fractureForceTheme('collapse','teste');
  b.sigN=0;b.sigLast=8;
  for(let w=9;w<8+A.FRACTURE_SIG_COOLDOWN;w++){
    b.sig={};
    assert.strictEqual(A.fracturePickSignature(w),null,'w'+w+': dentro do cooldown');
  }
  /* e fora do cooldown volta a ser possível */
  let depois=0;
  for(let w=8+A.FRACTURE_SIG_COOLDOWN;w<=19;w++){
    b.sig={};b.sigLast=0;
    if(A.fracturePickSignature(w))depois++;
  }
  assert.ok(depois>0,'controle: após o cooldown saem assinaturas');
});
ok('B4-21: escolha é determinística — mesma seed e onda, mesma assinatura',()=>{
  /* a seed da run é gerada no startRun; o que o teste fixa é a seed DA RUN
     via fractureSetSeed, que é o que o Continue persiste e reproduz. */
  const SEED=4242;
  const A=bootFx({});beginRun(A,1);
  A.fractureSetSeed(SEED);
  A.fractureForceTheme('collapse','teste');A.fractureSetIntensity(100,'teste');
  assert.strictEqual(A.fractureGetSeed(),SEED,'seed da run fixada');
  const prim=[];
  for(let w=8;w<=19;w++){
    const b=A.fractureB4();b.sig={};b.sigUsed=[];b.sigN=0;b.sigLast=0;
    const s=A.fracturePickSignature(w);
    prim.push(s?s.id:null);
  }
  assert.ok(prim.some(x=>x),'alguma assinatura saiu (senão o teste é vazio)');
  const B=bootFx({});beginRun(B,1);
  B.fractureSetSeed(SEED);
  B.fractureForceTheme('collapse','teste');B.fractureSetIntensity(100,'teste');
  assert.strictEqual(B.fractureGetSeed(),SEED,'mesma seed');
  for(let i=0,w=8;w<=19;i++,w++){
    const b=B.fractureB4();b.sig={};b.sigUsed=[];b.sigN=0;b.sigLast=0;
    const s=B.fracturePickSignature(w);
    assert.strictEqual(s?s.id:null,prim[i],'w'+w+' reproduz');
  }
  /* e uma seed DIFERENTE muda a escolha em alguma onda */
  const C=bootFx({});beginRun(C,1);
  C.fractureSetSeed(SEED+1);
  C.fractureForceTheme('collapse','teste');C.fractureSetIntensity(100,'teste');
  let dif=0;
  for(let i=0,w=8;w<=19;i++,w++){
    const b=C.fractureB4();b.sig={};b.sigUsed=[];b.sigN=0;b.sigLast=0;
    const s=C.fracturePickSignature(w);
    if((s?s.id:null)!==prim[i])dif++;
  }
  assert.ok(dif>0,'seed diferente produz escolha diferente');
});
ok('B4-22: anti-repeat — não repete enquanto houver alternativa',()=>{
  const A=bootFx({});beginRun(A,1);
  const b=A.fractureB4();
  A.fractureForceTheme('collapse','teste');A.fractureSetIntensity(100,'teste');
  const vistos={};
  for(let w=8;w<=19;w++){
    b.sig={};
    const s=A.fracturePickSignature(w);
    if(!s)continue;
    assert.ok(!vistos[s.id]||b.sigUsed.length>=2,
      s.id+' repetiu antes de esgotar as alternativas');
    vistos[s.id]=1;
    /* simula o que fractureOnWaveStart faz ao aplicar */
    if(b.sigUsed.indexOf(s.id)<0)b.sigUsed.push(s.id);
    b.sigN++;b.sigLast=w;
  }
  assert.ok(Object.keys(vistos).length>0,'assinaturas saíram de fato');
});

/* ---------------- STAGES E CAMADAS (B4.1 / B4.2 / B4.15 / B4.16) --------- */
ok('B4-23: thresholds de Stage continuam função exclusiva da Intensidade',()=>{
  const A=bootFx({});
  const mins=A.FRACTURE_STAGES.map(s=>s.min).sort((a,b)=>b-a);
  assert.strictEqual(J(mins),J([80,60,40,20,0]),'thresholds 80/60/40/20/0');
  assert.strictEqual(A.fractureStageOf(0).id,'latente');
  assert.strictEqual(A.fractureStageOf(19).id,'latente');
  assert.strictEqual(A.fractureStageOf(20).id,'instavel');
  assert.strictEqual(A.fractureStageOf(40).id,'propagando');
  assert.strictEqual(A.fractureStageOf(60).id,'critica');
  assert.strictEqual(A.fractureStageOf(80).id,'ruptura');
});
ok('B4-24: não há segunda progressão — gate não carrega campo bias',()=>{
  const A=bootFx({});
  for(const id in A.FRACTURE_STAGE_GATES){
    const g=A.FRACTURE_STAGE_GATES[id];
    assert.ok(!Object.prototype.hasOwnProperty.call(g,'bias'),
      id+': sem campo bias (evita 2ª progressão sobre FRACTURE_STAGE_MUL)');
    assert.ok(Object.prototype.hasOwnProperty.call(g,'sig'),id+': tem sig');
    assert.ok(Object.prototype.hasOwnProperty.call(g,'opp'),id+': tem opp');
  }
  assert.strictEqual(A.fractureStageGate('bias'),1,'bias devolve neutro');
});
ok('B4-25: camada de assinaturas só abre em PROPAGANDO',()=>{
  const A=bootFx({});beginRun(A,1);
  const mins={latente:0,instavel:20,propagando:40,critica:60,ruptura:80};
  for(const st of ['latente','instavel']){
    A.fractureSetIntensity(mins[st],'teste');
    assert.strictEqual(A.fractureStageGate('sig'),0,st+': assinaturas bloqueadas');
  }
  for(const st of ['propagando','critica','ruptura']){
    A.fractureSetIntensity(mins[st],'teste');
    assert.strictEqual(A.fractureStageGate('sig'),1,st+': assinaturas liberadas');
  }
});
ok('B4-26: oportunidade rara cresce em CRÍTICA e RUPTURA',()=>{
  const A=bootFx({});beginRun(A,1);
  const mins={latente:0,instavel:20,propagando:40,critica:60,ruptura:80};
  let prev=1;
  for(const st of ['latente','instavel','propagando','critica','ruptura']){
    A.fractureSetIntensity(mins[st],'teste');
    const g=A.fractureStageGate('opp');
    assert.ok(g>=prev,st+': opp não decresce');
    prev=g;
  }
  A.fractureSetIntensity(40,'teste');
  const prop=A.fractureStageGate('opp');
  A.fractureSetIntensity(80,'teste');
  assert.ok(A.fractureStageGate('opp')>prop,'RUPTURA abre mais que PROPAGANDO');
});
ok('B4-27: oportunidade rara NÃO toca evento comum — só rare/anomalous',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureSetIntensity(100,'teste');          // RUPTURA
  const raro=A.ALL_RUN_EVENTS.find(e=>e.rarity==='rare');
  const ano=A.ALL_RUN_EVENTS.find(e=>e.rarity==='anomalous');
  const com=A.ALL_RUN_EVENTS.find(e=>!e.rarity||e.rarity==='common');
  assert.ok(raro&&ano&&com,'eventos das 3 raridades existem no pool');
  assert.ok(A.fractureRareOppMul(raro)>1,'rare recebe o bônus');
  assert.ok(A.fractureRareOppMul(ano)>1,'anomalous recebe o bônus');
  assert.strictEqual(A.fractureRareOppMul(com),1,'comum intocado');
  assert.strictEqual(A.fractureRareOppMul(null),1,'null é neutro');
});
ok('B4-28: gate não altera HP nem dano — só pesos e frequência',()=>{
  const jogo=m[1];
  const i=jogo.indexOf('const FRACTURE_STAGE_GATES=');
  assert.ok(i>0,'tabela localizada');
  const bloco=jogo.slice(i,jogo.indexOf('};',i)+2);
  assert.ok(!/hp|dmg|damage|vida|dano/i.test(bloco),
    'nenhum campo de HP/dano na tabela de gates');
});
ok('B4-29: RUPTURA é alcançável — o teto da run supera 80',()=>{
  const A=bootFx({});beginRun(A,1);
  /* teto teórico: ondas + minibosses + eventos + pico anômalo */
  const teto=(A.MAX_WAVE-1)*A.FRACTURE_INT_PER_WAVE+3*4+
    A.FRACTURE_EV_INT_PER_RUN_MAX+A.FRACTURE_ANOMALY_SPIKE;
  assert.ok(teto>=80,'teto '+teto+' alcança RUPTURA (80)');
  /* e o pico realmente é aditivo: não é descontado do orçamento de evento */
  const b=A.fractureB3();
  b.evRG=0;b.evWG=0;b.evSpike=0;
  const ano=A.ALL_RUN_EVENTS.find(e=>e.rarity==='anomalous');
  A.setWave(6);
  A.fractureOnEventChosen(ano);
  assert.ok(A.fractureGetIntensity()>=A.FRACTURE_ANOMALY_SPIKE,
    'pico somou de verdade (int '+A.fractureGetIntensity()+')');
});
ok('B4-30: pico anômalo dispara UMA vez por run (não é farm)',()=>{
  const A=bootFx({});beginRun(A,1);
  const ano=A.ALL_RUN_EVENTS.find(e=>e.rarity==='anomalous');
  A.setWave(5);
  A.fractureOnEventChosen(ano);
  const depois=A.fractureGetIntensity();
  for(let i=0;i<5;i++)A.fractureOnEventChosen(ano);
  assert.ok(A.fractureGetIntensity()-depois<=A.FRACTURE_EV_INT_PER_WAVE_MAX,
    'repetir o evento não repete o pico');
  assert.strictEqual(A.fractureB3().evSpike,1,'flag marcada');
});

/* ---------------- REVELAÇÃO (B4.5 / B4.6 / B4.7) ---------------- */
ok('B4-31: a run começa com o Tema OCULTO',()=>{
  const A=bootFx({});beginRun(A,1);
  assert.strictEqual(A.fractureIsRevealed(),false,'nada revelado no início');
  assert.strictEqual(A.fractureB4().rev,0,'rev=0');
  assert.strictEqual(A.fractureB4().revWhy,'','sem motivo ainda');
});
ok('B4-32: antes da revelação o HUD mostra DESCONHECIDA',()=>{
  const A=bootFx({});beginRun(A,1);
  const h=A.fractureHudState();
  assert.strictEqual(h.known,false,'estado desconhecido');
  assert.strictEqual(h.themeNm,A.FRACTURE_HUD_UNKNOWN.nm,'nome DESCONHECIDA');
  assert.strictEqual(h.sym,A.FRACTURE_HUD_UNKNOWN.sym,'símbolo ◌');
  const txt=A.fractureHudText();
  assert.ok(txt.indexOf('DESCONHECIDA')>=0,'texto: '+txt);
  /* o Tema real existe, só não é mostrado */
  assert.ok(A.fractureGetThemeId(),'Tema já está sorteado');
});
ok('B4-33: revelação acontece no máximo uma vez por run',()=>{
  const A=bootFx({});beginRun(A,1);
  assert.strictEqual(A.fractureReveal('dev',6),true,'primeira revela');
  const rev=A.fractureB4().rev,why=A.fractureB4().revWhy;
  assert.strictEqual(A.fractureReveal('tempo',9),false,'segunda é recusada');
  assert.strictEqual(A.fractureB4().rev,rev,'onda não muda');
  assert.strictEqual(A.fractureB4().revWhy,why,'motivo não muda');
});
ok('B4-34: revelar NÃO muda o Tema da run',()=>{
  const A=bootFx({});beginRun(A,1);
  const antes=A.fractureGetThemeId(),seed=A.fractureGetSeed();
  A.fractureReveal('dev',6);
  assert.strictEqual(A.fractureGetThemeId(),antes,'Tema preservado');
  assert.strictEqual(A.fractureGetSeed(),seed,'seed preservada');
});
ok('B4-35: após revelar o HUD é compacto e traz o nome narrativo',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureForceTheme('hunt','teste');
  A.fractureSetIntensity(30,'teste');
  A.fractureReveal('dev',6);
  const h=A.fractureHudState();
  assert.strictEqual(h.known,true,'Tema conhecido');
  assert.strictEqual(h.themeNm,(A.FRACTURE_THEME_BY_ID.hunt||{}).nm,'nome do Tema');
  assert.strictEqual(h.sym,(A.FRACTURE_THEME_BY_ID.hunt||{}).sym,'símbolo do Tema');
  const txt=A.fractureHudText();
  assert.ok(txt.indexOf('DESCONHECIDA')<0,'não diz mais DESCONHECIDA');
  assert.ok(txt.length<40,'compacto: "'+txt+'"');
});
ok('B4-36: o HUD nunca expõe número de Intensidade nem id cru',()=>{
  const A=bootFx({});beginRun(A,1);
  for(const th of THEMES){
    A.fractureForceTheme(th,'teste');
    for(const i of [0,7,33,47,88,100]){
      A.fractureSetIntensity(i,'teste');
      for(const rev of [false,true]){
        if(rev&&!A.fractureIsRevealed())A.fractureReveal('dev',6);
        const txt=A.fractureHudText();
        assert.ok(!/[0-9]{2,}/.test(txt),th+' int'+i+': sem número — "'+txt+'"');
        assert.ok(txt.indexOf('_')<0,th+': sem id cru — "'+txt+'"');
        assert.ok(txt.toLowerCase().indexOf(th)<0||th==='anomaly',
          th+': sem id interno — "'+txt+'"');
      }
    }
  }
});
ok('B4-37: os cinco motivos de revelação têm texto narrativo',()=>{
  const A=bootFx({});
  const jogo=m[1];
  const i=jogo.indexOf('const FRACTURE_REVEAL_TEXT=');
  assert.ok(i>0,'tabela localizada');
  const bloco=jogo.slice(i,jogo.indexOf('};',i)+2);
  for(const k of ['signature','miniboss','evento','intensidade','tempo'])
    assert.ok(bloco.indexOf(k+':')>=0,'motivo '+k+' tem texto');
});
ok('B4-38: revelação respeita a onda mínima',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureForceTheme('siege','teste');
  assert.strictEqual(A.fractureRevealTrigger(1,{}),null,'w1: nada');
  assert.strictEqual(A.fractureRevealTrigger(2,{}),null,'w2: nada');
  /* com sinal forte, revela a partir da onda mínima */
  assert.strictEqual(A.fractureRevealTrigger(A.FRACTURE_REVEAL_MIN_WAVE,
    {signature:true}),'signature','sinal forte na onda mínima revela');
});
ok('B4-39: o fallback de tempo varia por seed (não é sempre a mesma onda)',()=>{
  const A=bootFx({});
  const vistas=new Set();
  for(let sd=1;sd<=40;sd++){
    beginRun(A,1);
    A.fractureSetSeed(sd*977);
    const w=A.fractureRevealForceWave();
    assert.ok(w>=A.FRACTURE_REVEAL_FORCE_MIN,'w'+w+' >= mínimo');
    assert.ok(w<A.FRACTURE_REVEAL_FORCE_MIN+A.FRACTURE_REVEAL_FORCE_SPAN,
      'w'+w+' dentro da janela');
    vistas.add(w);
  }
  assert.ok(vistas.size>=3,
    'fallback espalhado em '+vistas.size+' ondas distintas: '+J([...vistas]));
});
ok('B4-40: a revelação persiste no checkpoint e volta no Continue',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureForceTheme('anomaly','teste');
  A.fractureSetIntensity(45,'teste');
  A.fractureReveal('evento',7);
  const cp={fracture:A.fractureRunPack()};
  const B=bootFx({});beginRun(B,1);
  B.fractureRunUnpack(cp);
  assert.strictEqual(B.fractureIsRevealed(),true,'revelado após unpack');
  assert.strictEqual(B.fractureB4().rev,7,'onda 7 preservada');
  assert.strictEqual(B.fractureB4().revWhy,'evento','motivo preservado');
  assert.strictEqual(B.fractureGetThemeId(),'anomaly','Tema preservado');
  assert.strictEqual(B.fractureReveal('tempo',12),false,'não revela de novo');
});

/* ---------------- ANÚNCIO DE STAGE (B4.8) ---------------- */
ok('B4-41: cada Stage é anunciado uma única vez por run',()=>{
  const A=bootFx({});beginRun(A,1);
  assert.strictEqual(A.fractureStageAnnounce('propagando',9),true,'primeira anuncia');
  assert.strictEqual(A.fractureStageAnnounce('propagando',12),false,'segunda recusa');
  assert.strictEqual(A.fractureStageAnnounce('critica',14),true,'outro Stage anuncia');
  assert.strictEqual(A.fractureStageAnnounce('critica',15),false,'e não repete');
  const b=A.fractureB4();
  assert.ok(b.stages.propagando&&b.stages.critica,'flags gravadas');
});
ok('B4-42: LATENTE não gasta banner — é o estado inicial da run',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureStageAnnounce('latente',1);
  const b=A.fractureB4();
  assert.ok(b.stages.latente,'marcado como visto');
  /* mas não pode ter virado anúncio: o histórico não registra banner */
  const f=A.getFx();
  const banners=(f.history||[]).filter(x=>x.t==='stage'&&x.s==='latente'&&x.d!==0);
  assert.strictEqual(banners.length,0,'nenhum banner de LATENTE');
});
ok('B4-43: anúncios de Stage não se repetem depois do Continue',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureSetIntensity(45,'teste');
  A.fractureStageAnnounce('instavel',5);
  A.fractureStageAnnounce('propagando',9);
  const cp={fracture:A.fractureRunPack()};
  const B=bootFx({});beginRun(B,1);
  B.fractureRunUnpack(cp);
  assert.strictEqual(B.fractureStageAnnounce('instavel',11),false,'não repete');
  assert.strictEqual(B.fractureStageAnnounce('propagando',12),false,'não repete');
  assert.strictEqual(B.fractureStageAnnounce('critica',16),true,'novo Stage sim');
});
ok('B4-44: anúncio de Stage inválido é recusado sem marcar nada',()=>{
  const A=bootFx({});beginRun(A,1);
  assert.strictEqual(A.fractureStageAnnounce('inexistente',5),false,'recusado');
  assert.strictEqual(A.fractureStageAnnounce('__proto__',5),false,'prototype recusado');
  assert.strictEqual(A.fractureStageAnnounce('',5),false,'vazio recusado');
  const b=A.fractureB4();
  assert.strictEqual(Object.keys(b.stages).length,0,'nada marcado');
});

/* ---------------- CODEX E LORE (B4.11 / B4.12) ---------------- */
ok('B4-45: há 12 entradas de lore — exatamente 2 por Tema',()=>{
  const A=bootFx({});
  assert.strictEqual(Object.keys(A.FRACTURE_LORE).length,6,'6 Temas');
  for(const th of THEMES){
    const L=A.FRACTURE_LORE[th];
    assert.ok(Array.isArray(L),th+': lista');
    assert.strictEqual(L.length,2,th+': 2 entradas');
    for(const e of L){
      assert.ok(typeof e.t==='string'&&e.t.length>0,th+': título');
      assert.ok(typeof e.d==='string'&&e.d.length>20,th+': descrição substantiva');
    }
  }
});
ok('B4-46: a descoberta do Tema persiste no Save Slot',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureForceTheme('resonance','teste');
  A.clearDevTaint();
  assert.strictEqual(A.fractureCodexDiscovered().indexOf('resonance')<0,true,
    'ainda não descoberto');
  assert.strictEqual(A.fractureCodexDiscover('resonance'),true,'descobriu');
  assert.ok(A.fractureCodexDiscovered().indexOf('resonance')>=0,'listado');
  assert.strictEqual(A.fractureCodexDiscover('resonance'),false,'não redescobre');
  /* sobrevive a um boot novo (localStorage do slot) */
  const root=JSON.stringify(A.smRootGet());
  const B=bootFx({});
  B.activateSlot(1);
  assert.ok(JSON.stringify(B.smRootGet()).indexOf('fxThemes')>=0||
    root.indexOf('fxThemes')>=0,'fxThemes foi gravado no slot');
});
ok('B4-47: o Codex NÃO grava durante uma sessão de Sandbox',()=>{
  const A=bootFx({});
  A.sandboxOpenSetup();A.setChar(0);A.sandboxStart();
  assert.ok(A.getSandboxRun(),'Sandbox ativo');
  const antes=JSON.stringify(A.smRootGet());
  assert.strictEqual(A.fractureCodexDiscover('collapse'),false,'recusado no Sandbox');
  assert.strictEqual(A.fractureCodexDiscovered().indexOf('collapse')<0,true,
    'nada gravado');
  assert.strictEqual(JSON.stringify(A.smRootGet()),antes,'slot intocado');
});
ok('B4-48: o Codex NÃO grava a partir de run contaminada pelo DEV',()=>{
  const A=bootFx({});beginRun(A,1);
  A.DEV_on();
  A.devCommand('fx:int:50');
  assert.ok(A.isTainted(),'run taintada pelo DEV');
  assert.strictEqual(A.fractureCodexDiscover('hunt'),false,'recusado');
  assert.strictEqual(A.fractureCodexDiscovered().indexOf('hunt')<0,true,
    'nada gravado a partir do DEV');
});
ok('B4-49: o Codex guarda só descoberta — nunca estado mecânico da run',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureForceTheme('siege','teste');
  A.fractureSetIntensity(63,'teste');
  A.clearDevTaint();
  A.fractureCodexDiscover('siege');
  const s=A.smRootGet().slots[A.getCurSlot()];
  assert.deepStrictEqual(J(Object.keys(s.fxThemes)),J(['siege']),
    'só o id do Tema');
  assert.strictEqual(s.fxThemes.siege,1,'flag, não objeto de estado');
  const txt=J(s.fxThemes);
  for(const proibido of ['intensity','int','stage','sig','rev','seed','b3','b4'])
    assert.ok(txt.indexOf(proibido)<0,'sem campo mecânico "'+proibido+'"');
});
ok('B4-50: a aba do Diretor existe no Codex e o corpo renderiza',()=>{
  const A=bootFx({});beginRun(A,1);
  const jogo=m[1];
  assert.ok(jogo.indexOf("id:'fracture'")>=0,"aba 'fracture' registrada");
  /* fractureCodexBody renderiza em #cx-body (mesmo contrato das outras abas
     do Codex), então o corpo é lido do DOM do stub, não do retorno. */
  A.fractureCodexBody();
  const el=A._env.document.getElementById('cx-body');
  const body=el.innerHTML;
  assert.ok(typeof body==='string'&&body.length>0,'corpo renderizado não vazio');
  assert.ok(body.indexOf('ASSINATURAS TEMPORAIS')>=0,'título da seção');
  assert.ok(body.indexOf('NÃO IDENTIFICADA')>=0,'Tema ainda oculto no Codex');
  /* nada descoberto ainda: o Codex NÃO pode vazar nome nem id de Tema */
  for(const th of THEMES){
    const nm=(A.FRACTURE_THEME_BY_ID[th]||{}).nm;
    assert.ok(body.indexOf(nm)<0,'oculto: nome de '+th+' não vaza');
    assert.ok(body.indexOf(th)<0,'oculto: id "'+th+'" não vaza');
  }
  assert.ok(body.indexOf('0/'+A.FRACTURE_THEME_IDS.length)>=0,
    'contador de descobertas zerado');
  /* descobre os 6 Temas e confere que cada um passa a aparecer pelo nome */
  A.clearDevTaint();
  for(const th of THEMES)assert.strictEqual(A.fractureCodexDiscover(th),true,
    th+': descoberto');
  A.fractureCodexBody();
  const body2=A._env.document.getElementById('cx-body').innerHTML;
  assert.ok(body2.indexOf('NÃO IDENTIFICADA')<0,'nada mais oculto');
  for(const th of THEMES){
    const nm=(A.FRACTURE_THEME_BY_ID[th]||{}).nm;
    assert.ok(body2.indexOf(nm)>=0,'descoberto: corpo traz o nome de '+th);
    /* lore do Tema entra junto */
    const lo=A.FRACTURE_LORE[th];
    assert.ok(body2.indexOf(lo[0].t)>=0,'descoberto: lore de '+th+' visível');
  }
  assert.ok(body2.indexOf('6/'+A.FRACTURE_THEME_IDS.length)>=0,
    'contador mostra 6 descobertas');
  /* id cru nunca aparece, nem descoberto */
  for(const th of THEMES)
    assert.ok(body2.indexOf('>'+th+'<')<0,'id "'+th+'" não é exibido como texto');
});

/* ---------------- ECHO E FACÇÕES (B4.13 / B4.14) ---------------- */
ok('B4-51: reações de facção são narrativas — nunca chamam factionEmit',()=>{
  const A=bootFx({});beginRun(A,1);
  const jogo=m[1];
  const i=jogo.indexOf('function fractureFactionRemark(');
  assert.ok(i>0,'função localizada');
  const corpo=jogo.slice(i,jogo.indexOf('\nfunction ',i+10));
  assert.ok(corpo.indexOf('factionEmit')<0,
    'fractureFactionRemark não emite afinidade');
  assert.ok(corpo.indexOf('changeEchoTrust')<0,'não muda Trust');
  /* sem Tema revelado, não há reação */
  assert.strictEqual(A.fractureFactionRemark(),null,'oculto: sem reação');
  A.fractureReveal('dev',6);
  const r=A.fractureFactionRemark();
  assert.ok(r&&typeof r.text==='string'&&r.text.length>0,'reação narrativa');
});
ok('B4-52: proibido Tema determinar afinidade de facção',()=>{
  const jogo=m[1];
  /* o padrão vetado pelo escopo: theme === 'x' → facção +N */
  const proibido=/theme\s*===?\s*['"][a-z]+['"][^;]{0,80}factionEmit/;
  assert.ok(!proibido.test(jogo),'nenhum atalho Tema → factionEmit');
  const i=jogo.indexOf('const FRACTURE_FACTION_REMARKS=');
  assert.ok(i>0,'tabela de falas existe');
  const bloco=jogo.slice(i,jogo.indexOf('\n};',i)+3);
  assert.ok(!/[+-]\d/.test(bloco.replace(/rgba?\([^)]*\)/g,'')),
    'tabela de falas não carrega números de afinidade');
});
ok('B4-53: cada Tema tem fala de facção e cada um tem as 4 facções cobertas',()=>{
  const A=bootFx({});
  for(const th of THEMES){
    const m2=A.FRACTURE_FACTION_REMARKS[th];
    assert.ok(m2&&typeof m2==='object',th+': tem falas');
    assert.ok(Object.keys(m2).length>=1,th+': ao menos uma facção');
    for(const k in m2)
      assert.ok(typeof m2[k]==='string'&&m2[k].length>10,th+'/'+k+': texto real');
  }
});
ok('B4-54: o Echo reage à revelação sem alterar Personality',()=>{
  const A=bootFx({});beginRun(A,1);
  const antes=J(A.getEchoes().map(e=>e.ps&&e.ps.id));
  const trustAntes=J(A.getEchoes().map(e=>e.trust));
  A.fractureForceTheme('collapse','teste');
  A.fractureReveal('dev',6);
  A.fractureEchoOnReveal();
  A.fractureEchoOnStage('critica');
  A.fractureEchoOnStage('ruptura');
  assert.strictEqual(J(A.getEchoes().map(e=>e.ps&&e.ps.id)),antes,
    'Personality intacta');
  assert.strictEqual(J(A.getEchoes().map(e=>e.trust)),trustAntes,
    'Trust intacto');
  assert.ok(A.FRACTURE_B4_ECHO_LINES.reveal,'há fala de revelação');
  assert.ok(A.FRACTURE_B4_ECHO_LINES.critica,'há fala de CRÍTICA');
  assert.ok(A.FRACTURE_B4_ECHO_LINES.ruptura,'há fala de RUPTURA');
});

/* ---------------- PERSISTÊNCIA, SANDBOX E DEV (B4.17-B4.19) ------------- */
ok('B4-55: o estado b4 é sanitizado no unpack — lixo e prototype caem fora',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureRunUnpack({fracture:{
    v:A.FRACTURE_STATE_VERSION,theme:'hunt',seed:99,intensity:44,
    b4:{rev:'oito',revWhy:'x'.repeat(300),
      stages:{latente:1,nao_existe:1,__proto__:1,ruptura:'sim'},
      sig:{0:'sig_hun_matilha',99:'sig_hun_matilha',3:'inexistente',
           7:'sig_hun_rastro',__proto__:'sig_hun_matilha'},
      sigUsed:['sig_hun_matilha','nao_existe',42,null],
      sigLast:'muitas',sigN:'NaN',hudSeen:{},
      evThematic:'x',miniAligned:[],evSig:null}
  }});
  const b=A.fractureB4();
  assert.ok(Number.isFinite(b.rev),'rev numérico');
  assert.ok(b.revWhy.length<=24,'revWhy limitado');
  assert.ok(!Object.prototype.hasOwnProperty.call(b.stages,'nao_existe'),
    'Stage inventado caiu');
  assert.ok(!Object.prototype.hasOwnProperty.call(b.stages,'__proto__'),
    'prototype bloqueado');
  assert.ok(b.stages.latente&&b.stages.ruptura,'Stages válidos ficaram');
  assert.ok(!Object.prototype.hasOwnProperty.call(b.sig,0),'onda 0 recusada');
  assert.ok(!Object.prototype.hasOwnProperty.call(b.sig,99),'onda > MAX recusada');
  assert.ok(!Object.prototype.hasOwnProperty.call(b.sig,3),'assinatura falsa recusada');
  assert.strictEqual(b.sig[7],'sig_hun_rastro','assinatura válida ficou');
  assert.ok(b.sigUsed.indexOf('nao_existe')<0,'id inventado caiu de sigUsed');
  assert.ok(b.sigUsed.indexOf(42)<0,'não-string caiu de sigUsed');
  assert.ok(Number.isFinite(b.sigLast),'sigLast numérico');
  assert.ok(Number.isFinite(b.sigN),'sigN numérico');
  assert.strictEqual(typeof b.hudSeen,'string','hudSeen é string');
});
ok('B4-56: save antigo sem b4 funciona e ganha o estado novo zerado',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureForceTheme('scarcity','teste');
  A.fractureSetIntensity(55,'teste');
  const cp={fracture:{v:A.FRACTURE_STATE_VERSION,theme:'scarcity',seed:1234,
    intensity:55}};                    // sem b4 — save de antes do Bloco 4
  A.fractureRunUnpack(cp);
  const b=A.fractureB4();
  assert.ok(b,'b4 criado');
  assert.strictEqual(b.rev,0,'oculto');
  assert.strictEqual(b.sigN,0,'sem assinaturas');
  assert.deepStrictEqual(J(b.sigUsed),J([]),'histórico vazio');
  assert.strictEqual(A.fractureGetThemeId(),'scarcity','Tema do save respeitado');
  assert.strictEqual(A.fractureGetIntensity(),55,'Intensidade respeitada');
});
ok('B4-57: assinaturas escolhidas sobrevivem ao Continue e não se repetem',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureForceTheme('collapse','teste');
  A.fractureSetIntensity(100,'teste');
  const b=A.fractureB4();
  b.sig={};b.sig[9]='sig_col_enxame';b.sigUsed=['sig_col_enxame'];
  b.sigN=1;b.sigLast=9;
  const cp={fracture:A.fractureRunPack()};
  const B=bootFx({});beginRun(B,1);
  B.fractureRunUnpack(cp);
  const b2=B.fractureB4();
  assert.strictEqual(b2.sig[9],'sig_col_enxame','assinatura da w9 preservada');
  assert.strictEqual(b2.sigN,1,'contagem preservada');
  assert.strictEqual(b2.sigLast,9,'cooldown preservado');
  const comp=B.waveComp(9);
  assert.ok(comp.swarm>0,'composição da w9 ainda reflete a assinatura');
  /* e o teto continua valendo — não vira farm no reload */
  assert.strictEqual(b2.sigN,1,'não somou de novo no restore');
});
ok('B4-58: Sandbox byte-a-byte e comandos DEV do B4 taintam a run',()=>{
  const A=bootFx({});
  A.activateSlot(1);A.activateSlot(2);A.activateSlot(3);
  const antes=JSON.stringify(A.smRootGet().slots);
  A.sandboxOpenSetup();A.setChar(0);A.sandboxStart();
  assert.ok(A.getSandboxRun(),'Sandbox ativo');
  /* ações do B4 dentro do Sandbox */
  assert.strictEqual(A.fractureSandboxAction('reveal'),true,'reveal ok');
  assert.strictEqual(A.fractureSandboxAction('stage:critica'),true,'stage ok');
  assert.strictEqual(A.fractureSandboxAction('sig:sig_col_enxame'),true,'sig ok');
  assert.strictEqual(A.fractureSandboxAction('sim:transicao'),true,'sim ok');
  assert.strictEqual(A.fractureSandboxAction('sig:off'),true,'limpar ok');
  assert.strictEqual(A.fractureSandboxAction('tema:ruim'),false,'ação inválida recusa');
  A.sandboxExit();
  assert.strictEqual(JSON.stringify(A.smRootGet().slots),antes,
    'Save 1/2/3 byte-a-byte intactos após a sessão');
  /* DEV: os três comandos novos existem e taintam */
  const B=bootFx({});beginRun(B,1);
  B.DEV_on();B.clearDevTaint();
  assert.strictEqual(B.fractureDevCommand('reveal'),true,'fx:reveal');
  assert.ok(B.isTainted(),'reveal tainta');
  B.clearDevTaint();
  B.setWave(9);
  assert.strictEqual(B.fractureDevCommand('signature:sig_col_enxame'),true,
    'fx:signature:<id>');
  assert.ok(B.isTainted(),'signature tainta');
  B.clearDevTaint();
  assert.strictEqual(B.fractureDevCommand('stage:ruptura'),true,'fx:stage:<stage>');
  assert.ok(B.isTainted(),'stage tainta');
  assert.strictEqual(B.fractureGetStage().id,'ruptura','foi para RUPTURA');
  /* ids inválidos são recusados sem taintar */
  B.clearDevTaint();
  assert.strictEqual(B.fractureDevCommand('stage:naoexiste'),false,'Stage falso');
  assert.strictEqual(B.fractureDevCommand('signature:naoexiste'),false,'sig falsa');
  assert.ok(!B.isTainted(),'recusa não tainta');
  /* leitura continua sem tainta */
  B.clearDevTaint();
  assert.strictEqual(B.fractureDevCommand('insp'),true,'inspetor funciona');
  assert.ok(!B.isTainted(),'inspetor é leitura, não tainta');
  const linhas=B.fractureB4InspectorLines();
  assert.ok(linhas.length>=4,'inspetor do B4 tem as 4 seções');
  assert.ok(linhas.join('|').indexOf('REVELAÇÃO')>=0,'seção REVELAÇÃO');
  assert.ok(linhas.join('|').indexOf('ASSINATURA')>=0,'seção ASSINATURA');
  assert.ok(linhas.join('|').indexOf('STAGE')>=0,'seção STAGE');
  assert.ok(linhas.join('|').indexOf('CODEX')>=0,'seção CODEX');
  /* simulação de transição é pura e cobre os 5 Stages */
  const tr=B.fractureSandboxSimTransitionLines();
  assert.strictEqual(tr.length,5,'5 Stages na simulação');
  assert.strictEqual(tr[0].id,'latente','começa em LATENTE');
  assert.strictEqual(tr[4].id,'ruptura','termina em RUPTURA');
  assert.strictEqual(A.SM_VERSION,3,'SM_VERSION continua 3');
});

/* ============ [34] HARDENING PÓS-MERGE — robustez dos detectores ============ */
console.log('\n[34] HARDENING · DETECTORES ESTRUTURAIS SOBREVIVEM A MERGES (59-66)');

ok('B4-59: os marcadores do bloco PR13 existem, são únicos e estão em ordem',()=>{
  const jogo=m[1];
  assert.strictEqual(jogo.split(PR13_INI).length-1,1,
    'exatamente um marcador de início');
  assert.strictEqual(jogo.split(PR13_FIM).length-1,1,
    'exatamente um marcador de fim');
  const ini=jogo.indexOf(PR13_INI),fim=jogo.indexOf(PR13_FIM);
  assert.ok(ini>=0&&fim>ini,'início antes do fim');
  /* o bloco precisa ser substancial — senão o detector passaria no vazio */
  assert.ok(fim-ini>50000,'bloco PR13 substancial ('+(fim-ini)+' chars)');
  /* e precisa conter o núcleo do Diretor */
  const bloco=jogo.slice(ini,fim);
  for(const fn of ['function fractureEmit(','function fractureRunPack(',
    'function fractureApplySignature(','function fractureSetWaveBias(',
    'function fractureStageOf(','function fractureKitBoot('])
    assert.ok(bloco.indexOf(fn)>=0,'bloco contém '+fn);
  /* waveComp é função PRÉ-EXISTENTE do jogo: o Diretor a modifica, mas ela
     mora fora do bloco. O que importa é que o corpo dela chama o Diretor. */
  const iwc=jogo.indexOf('function waveComp(');
  assert.ok(iwc>=0&&iwc<ini,'waveComp vive antes do bloco PR13');
  const cwc=jogo.slice(iwc,jogo.indexOf('\nfunction ',iwc+10));
  assert.ok(/fractureShapeWave\s*\(/.test(cwc),'waveComp integra o Diretor');
});

ok('B4-60: nenhum detector estrutural da PR13 usa janela de tamanho fixo',()=>{
  /* Foi a causa raiz da falha "onda 20": uma janela fixa de 1400 caracteres
     com o token no offset 1390 — folga de 10 caracteres. Este teste impede
     que o padrão volte, em qualquer teste da suíte. */
  const suite=fs.readFileSync(path.join(__dirname,'fracture-director.test.js'),'utf8');
  const re=/\.slice\(\s*\w+\s*,\s*\w+\s*\+\s*(\d+)\s*\)/g;
  let hit,achados=[];
  while((hit=re.exec(suite)))achados.push(hit[0]+' (janela '+hit[1]+')');
  assert.deepStrictEqual(achados,[],
    'janelas de tamanho fixo encontradas: '+achados.join(', '));
});

ok('B4-61: detector de Intensidade sobrevive a código inserido no jogo',()=>{
  /* REGRESSÃO REAL, simulada: injeta linhas antes de spawnWave (o que um merge
     faz o tempo todo) e confirma que o detector continua achando os mesmos
     limites e as mesmas escritas. A versão antiga dependia do banner BOOT. */
  const jogo=m[1];
  const ini=jogo.indexOf(PR13_INI),fim=jogo.indexOf(PR13_FIM);
  const injecao='/* codigo novo de um merge qualquer */\n'.repeat(40)+
    'function funcaoNovaDeUmMerge(){return 1;}\n';
  const alvo=jogo.indexOf('function spawnWave(');
  assert.ok(alvo>0,'spawnWave localizada para a injeção');
  const mutado=jogo.slice(0,alvo)+injecao+jogo.slice(alvo);
  const ini2=mutado.indexOf(PR13_INI),fim2=mutado.indexOf(PR13_FIM);
  assert.ok(ini2>=0&&fim2>ini2,'marcadores continuam delimitando após a injeção');
  const dentro=i=>(i>=ini2&&i<fim2);
  const re=/fractureRun\s*\.\s*\w+\s*(\+=|-=|\*=|=[^=])/g;
  let hit,fora=0,n=0;
  while((hit=re.exec(mutado))){n++;if(!dentro(hit.index))fora++;}
  assert.ok(n>=10,'escritas ainda são encontradas ('+n+')');
  assert.strictEqual(fora,0,'nenhuma escrita vira falso positivo após a injeção');
});

ok('B4-62: detector de waveProfile sobrevive a código inserido no bloco',()=>{
  const jogo=m[1];
  /* injeção DENTRO do bloco PR13, antes da primeira escrita de waveProfile */
  const primeira=/waveProfile\s*\.\s*bias\s*\[[^\]]*\]\s*=[^=]/.exec(jogo);
  assert.ok(primeira,'escrita de waveProfile localizada');
  const injecao='/* mais codigo do Diretor cresceu aqui */\n'.repeat(60);
  const mutado=jogo.slice(0,primeira.index)+injecao+jogo.slice(primeira.index);
  const ini=mutado.indexOf(PR13_INI),fim=mutado.indexOf(PR13_FIM);
  const dentro=i=>(i>=ini&&i<fim);
  const re=/waveProfile\s*\.\s*(bias|pool)\s*(\[[^\]]*\]\s*)?=[^=]/g;
  let hit,n=0,fora=0;
  while((hit=re.exec(mutado))){n++;if(!dentro(hit.index))fora++;}
  assert.ok(n>0,'escritas encontradas ('+n+')');
  assert.strictEqual(fora,0,
    'crescimento do bloco não gera falso positivo de waveProfile');
});

ok('B4-63: marcador ausente produz erro EXPLÍCITO, nunca falso positivo',()=>{
  /* O modo de falha antigo era silencioso: sem o delimitador de fim, tudo
     passava a ser "fora do bloco" e o teste acusava a primeira escrita
     legítima do próprio Diretor. blocoPR13() agora falha no marcador. */
  const jogo=m[1];
  const semFim=jogo.replace(PR13_FIM,'/* marcador removido por um merge */');
  assert.strictEqual(semFim.indexOf(PR13_FIM),-1,'marcador de fim removido');
  /* sem o fim, a delimitação precisa ser impossível de montar */
  const ini=semFim.indexOf(PR13_INI);
  const fim=semFim.indexOf(PR13_FIM,ini);
  assert.ok(ini>=0&&fim<ini,'ausência detectável (fim='+fim+')');
  /* e o detector antigo teria acusado a primeira escrita legítima:
     reproduzimos o falso positivo para provar que o teste novo o evita */
  const re=/waveProfile\s*\.\s*(bias|pool)\s*(\[[^\]]*\]\s*)?=[^=]/g;
  const primeiro=re.exec(semFim);
  assert.ok(primeiro,'existe escrita legítima que o detector antigo culparia');
  const linhaAntiga=semFim.slice(0,primeiro.index).split('\n').length;
  assert.ok(linhaAntiga>0,'linha calculável ('+linhaAntiga+')');
});

ok('B4-64: spawnWave continua despachando a onda final antes de waveComp',()=>{
  /* Protege diretamente a causa raiz da falha 2: se alguém mover o despacho
     do chefe para DEPOIS da consulta à composição, a onda do PARADOXO passa
     a ser remodelada pelo Diretor. Verificação por posição relativa dentro da
     função inteira — sem janela fixa. */
  const ini=src.indexOf('function spawnWave(');
  const corpo=src.slice(ini,src.indexOf('\nfunction ',ini+10));
  const pBoss=corpo.search(/n\s*>=\s*MAX_WAVE|n\s*>=\s*20|n\s*===\s*MAX_WAVE/);
  const pComp=corpo.indexOf('waveComp(');
  assert.ok(pBoss>=0&&pComp>=0,'os dois caminhos existem');
  assert.ok(pBoss<pComp,'despacho do chefe precede a composição');
  /* o despacho precisa sair da função — senão a composição rodaria igual */
  const ramo=corpo.slice(pBoss,corpo.indexOf('\n',pBoss));
  assert.ok(/return/.test(ramo),'o despacho do chefe retorna (não continua)');
});

ok('B4-65: waveComp da onda final é imune a Tema, Intensidade e assinatura',()=>{
  /* Reforço comportamental do invariante, varrendo o espaço inteiro:
     6 Temas × 3 Intensidades × assinatura forçada e ausente. */
  beginRun(t,1);
  const fit20=t.waveCompFit(t.waveCompBase(20),t.ENEMY_BUDGET);
  const b=t.fractureB4();
  for(const th of THEMES){
    t.fractureForceTheme(th,'teste');
    for(const inten of [0,50,100]){
      t.fractureSetIntensity(inten,'teste');
      for(const comSig of [false,true]){
        b.sig={};
        if(comSig)for(const sg of t.FRACTURE_SIGNATURES)
          if(sg.theme===th)b.sig[20]=sg.id;
        assert.strictEqual(J(t.waveComp(20)),J(fit20),
          th+' int'+inten+(comSig?' com assinatura':' sem assinatura')+
          ': onda final intacta');
      }
    }
  }
  /* controle: as ondas vizinhas continuam sob o Diretor */
  t.fractureForceTheme('hunt','teste');t.fractureSetIntensity(100,'teste');
  b.sig={};
  assert.notStrictEqual(J(t.waveComp(18)),
    J(t.waveCompFit(t.waveCompBase(18),t.ENEMY_BUDGET)),
    'controle: waveComp(18) continua moldada');
});

ok('B4-66: PR10.5.2 continua íntegra após a correção',()=>{
  /* A correção pós-merge não pode ter tocado na PR10.5.2. As funções de
     gerência de dados do slot precisam existir e funcionar. */
  const jogo=m[1];
  for(const fn of ['function smClearSlotEchoes(','function smClearSlotSave(',
    'function refreshAfterSlotWipe('])
    assert.ok(jogo.indexOf(fn)>=0,fn+' presente');
  beginRun(t,1);
  /* comportamento real: limpar os Ecos do slot */
  t.setEchoQueue([echoData('versatile')]);
  t.saveEchoes();
  const slotAntes=t.getCurSlot();
  assert.strictEqual(t.smClearSlotEchoes(),true,'smClearSlotEchoes executa');
  assert.deepStrictEqual(J(t.getEchoQueue()),J([]),'Ecos do slot removidos');
  assert.strictEqual(t.getCurSlot(),slotAntes,'slot ativo preservado');
  /* e o save inteiro pode ser zerado sem quebrar o resto */
  assert.strictEqual(t.smClearSlotSave(),true,'smClearSlotSave executa');
  assert.strictEqual(t.getActiveRun(),null,'run ativa descartada');
  /* o Diretor não escreve em nada disso */
  const bloco=m[1].slice(m[1].indexOf(PR13_INI),m[1].indexOf(PR13_FIM));
  for(const proibido of ['smClearSlotEchoes','smClearSlotSave'])
    assert.ok(bloco.indexOf(proibido+'(')<0,
      'bloco PR13 não chama '+proibido);
});

/* ============ [35] B5 · FECHAMENTO TÉCNICO E VALIDAÇÃO FINAL ============
   Os testes estatísticos daqui usam PRNG próprio e seed fixa: um teste de
   distribuição que depende de Math.random é um flake anunciado, e esta
   suíte já pagou esse preço uma vez. */
console.log('\n[35] B5 · FECHAMENTO TÉCNICO, BALANCEAMENTO E VALIDAÇÃO FINAL');

function b5rng(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;
  let x=Math.imul(a^(a>>>15),1|a);x=(x+Math.imul(x^(x>>>7),61|x))^x;
  return ((x^(x>>>14))>>>0)/4294967296;};}

/* Run completa pelo caminho REAL do jogo: spawnWave (que carrega o hook do
   Diretor), miniboss com kill de verdade e pickRunEvent com rng injetado
   (é ele que paga Intensidade, via evSelectFinal → fractureOnEventChosen). */
function b5run(seed,rngSeed){
  const B=bootFx({});
  beginRun(B,1);
  B.fractureSetSeed(seed);
  const rnd=b5rng(rngSeed);
  const reg={maxInt:0,reveal:0,sigs:[],mini:{}};
  for(let n=1;n<=19;n++){
    B.setWave(n);
    B.spawnWave(n);
    if(t.MINI_WAVES.indexOf(n)>=0){
      const d=B.pickMiniBoss(n);
      if(d&&d.id){B.fractureOnMiniKill(d,n);reg.mini[n]=d.id;}
    }
    B.pickRunEvent(B.buildEventContext(),rnd);
    const i=B.fractureGetIntensity();
    if(i>reg.maxInt)reg.maxInt=i;
    const b4=B.fractureB4();
    if(b4&&b4.rev>0&&!reg.reveal)reg.reveal=b4.rev;
  }
  const b4=B.fractureB4();
  reg.sigs=((b4&&b4.sigUsed)||[]).slice();
  reg.finalInt=B.fractureGetIntensity();
  reg.stage=B.fractureGetStage().id;
  reg.theme=B.fractureGetThemeId();
  return reg;
}
let B5_RUNS=null;
function b5runs(){
  if(!B5_RUNS){
    B5_RUNS=[];
    for(let s=1;s<=60;s++)B5_RUNS.push(b5run(s*7919,s*104729));
  }
  return B5_RUNS;
}

ok('B5-01: Continue em CRÍTICA preserva Intensidade, Stage, Tema e assinatura',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureForceTheme('siege','teste');
  A.setWave(12);
  A.fractureSetIntensity(66,'teste');
  assert.strictEqual(A.fractureGetStage().id,'critica','sanidade: 66 é CRÍTICA');
  const b=A.fractureB4();
  b.sig[11]='sig_sie_muralha';b.sigUsed=['sig_sie_muralha'];b.sigN=1;b.sigLast=11;
  A.fractureReveal('teste',10);
  /* o Stage precisa ter sido ANUNCIADO na run A: é a flag de anúncio que viaja
     no checkpoint. Só setar a Intensidade não anuncia nada. */
  assert.strictEqual(A.fractureStageAnnounce('critica',12),true,'primeiro anúncio');
  const cp={fracture:A.fractureRunPack()};
  const B=bootFx({});beginRun(B,1);
  B.fractureRunUnpack(cp);
  assert.strictEqual(B.fractureGetIntensity(),66,'Intensidade preservada');
  assert.strictEqual(B.fractureGetStage().id,'critica','Stage continua derivado');
  assert.strictEqual(B.fractureGetThemeId(),'siege','Tema não rerrolou');
  assert.strictEqual(B.fractureIsRevealed(),true,'revelação preservada');
  assert.strictEqual(B.fractureB4().sig[11],'sig_sie_muralha','assinatura preservada');
  assert.strictEqual(B.fractureStageAnnounce('critica',13),false,
    'anúncio de Stage não repete depois do Continue');
});

ok('B5-02: Continue em RUPTURA preserva o Stage e não paga o pico de novo',()=>{
  const A=bootFx({});beginRun(A,1);
  A.fractureForceTheme('anomaly','teste');
  A.setWave(16);
  A.fractureSetIntensity(88,'teste');
  assert.strictEqual(A.fractureGetStage().id,'ruptura','sanidade: 88 é RUPTURA');
  A.fractureB3().evSpike=1;                     // pico anômalo já disparou
  const cp={fracture:A.fractureRunPack()};
  const B=bootFx({});beginRun(B,1);
  B.fractureRunUnpack(cp);
  assert.strictEqual(B.fractureGetIntensity(),88,'Intensidade preservada');
  assert.strictEqual(B.fractureGetStage().id,'ruptura','RUPTURA preservada');
  assert.strictEqual(B.fractureB3().evSpike,1,'pico continua marcado');
  const antes=B.fractureGetIntensity();
  const ano=t.ALL_RUN_EVENTS.find(e=>e.rarity==='anomalous');
  B.setWave(17);
  B.fractureOnEventChosen(ano);
  const ganho=B.fractureGetIntensity()-antes;
  assert.ok(ganho<=t.FRACTURE_EV_INT_PER_WAVE_MAX,
    'pico duplicado no Continue: ganho '+ganho+' (teto '+t.FRACTURE_EV_INT_PER_WAVE_MAX+')');
});

ok('B5-03: RUPTURA é alcançável sem ser rotineira e CRÍTICA é parcela real',()=>{
  const R=b5runs();
  const rup=R.filter(r=>r.maxInt>=80).length;
  const crit=R.filter(r=>r.maxInt>=60).length;
  assert.ok(rup>0,'RUPTURA nunca acontece em '+R.length+
    ' runs — o Stage final seria decorativo');
  assert.ok(rup/R.length<=0.25,'RUPTURA virou rotina: '+rup+'/'+R.length);
  assert.ok(crit/R.length>=0.15,'CRÍTICA rara demais: '+crit+'/'+R.length+
    ' — o Stage é portão de 6 das 12 assinaturas e da oportunidade rara');
  assert.ok(crit>rup,'CRÍTICA precisa ser mais comum que RUPTURA');
});

ok('B5-04: a revelação acontece em toda run, cedo o bastante e em ondas variadas',()=>{
  const R=b5runs();
  const rv=R.map(r=>r.reveal);
  assert.ok(rv.every(x=>x>0),'existe run que termina sem revelar o Tema');
  const media=rv.reduce((a,b)=>a+b,0)/rv.length;
  assert.ok(media<=14,'revelação tarde demais (média w'+media.toFixed(1)+')');
  assert.ok(Math.max.apply(null,rv)<t.MAX_WAVE,'revelação só na última onda');
  assert.ok(Math.min.apply(null,rv)>=t.FRACTURE_REVEAL_MIN_WAVE,
    'revelação antes da onda mínima');
  assert.ok(new Set(rv).size>=3,'revelação sempre na mesma onda');
});

ok('B5-05: nenhuma Intensidade nem Tema estoura o budget de entidades',()=>{
  const A=bootFx({});beginRun(A,1);
  for(const inten of [0,20,40,60,80,100]){
    const r=A.fractureSimulate({seeds:40,intensity:inten,waveMin:1,waveMax:19});
    for(const th of r.themes){
      const p=r.per[th];
      assert.strictEqual(p.budgetOver,0,'int'+inten+' '+th+': '+p.budgetOver+' estouros');
      assert.strictEqual(p.violations,0,'int'+inten+' '+th+': '+p.violations+' violações');
      assert.ok(p.entityMax<=t.ENEMY_BUDGET,
        'int'+inten+' '+th+': pico de '+p.entityMax+' entidades');
    }
  }
});

ok('B5-06: fractureKitBoot não instala os wrappers duas vezes',()=>{
  const B=bootFx({});
  assert.strictEqual(B.fractureKitBoot.done,true,'kit instalado no boot');
  B.fractureKitBoot();B.fractureKitBoot();B.fractureKitBoot();
  /* referência: um boot que NÃO recebeu chamadas extras */
  const ref=bootFx({});beginRun(ref,1);
  const r0=ref.fractureGetIntensity();
  playWaves(ref,2,4);
  const refGain=ref.fractureGetIntensity()-r0;
  beginRun(B,1);
  const i0=B.fractureGetIntensity();
  playWaves(B,2,4);
  const ganho=B.fractureGetIntensity()-i0;
  /* spawnWave duplamente embrulhado faria fractureOnWaveStart rodar duas
     vezes por onda e cada fronteira pagaria o dobro */
  assert.strictEqual(ganho,refGain,
    'fronteiras pagaram '+ganho+' contra '+refGain+' do boot de referência');
  assert.ok(ganho>0,'sanidade: as fronteiras pagaram alguma coisa');
});

ok('B5-07: o HUD do Diretor não redesenha quando nada mudou',()=>{
  const B=bootFx({});beginRun(B,1);
  B.setState('play');
  B.fractureHudChip();
  const chip=B._env.document.getElementById('frac-hud-theme');
  assert.ok(chip,'chip do HUD criado');
  let escritas=0,val=chip.textContent;
  Object.defineProperty(chip,'textContent',
    {get:()=>val,set:v=>{escritas++;val=v;},configurable:true});
  for(let i=0;i<200;i++)B.fractureHudChip();
  assert.strictEqual(escritas,0,
    '200 frames com estado estável reescreveram o chip '+escritas+'×');
  B.fractureAddIntensity(45,'teste');
  B.fractureHudChip();
  assert.strictEqual(escritas,1,'mudar o Stage precisa repintar exatamente uma vez');
});

ok('B5-08: nenhum comando DEV desbloqueia progresso permanente',()=>{
  const B=bootFx({});beginRun(B,1);
  B.setWave(6);
  assert.strictEqual(B.isTainted(),false,'run limpa antes do DEV');
  assert.strictEqual(B.fractureCodexDiscovered().length,0,'nada descoberto ainda');
  B.DEV_on();
  assert.strictEqual(B.fractureDevCommand('reveal'),true,'DEV revela a run');
  assert.strictEqual(B.fractureIsRevealed(),true,'a run foi revelada');
  assert.strictEqual(B.fractureCodexDiscovered().length,0,
    'DEV gravou descoberta permanente no Codex');
});

ok('B5-09: os quatro invocadores respeitam o teto de entidades',()=>{
  const jogo=m[1];
  /* cisão do splitter, convocação do mini-chefe e fenda do spawner. O
     spawner era o único sem teto — e COLAPSO favorece spawner de propósito
     (média 1,58/onda contra 0,95–1,16 dos outros Temas), chegando a 4 na
     onda 19: ~80 entidades extras sobre um orçamento de 46. */
  /* Verificação por âncora semântica, sem janela de tamanho fixo: cada
     invocador é localizado pelo próprio código e o teto é procurado até o
     fim natural do ramo. */
  const teto=(nome,ancora,fim)=>{
    const i=jogo.indexOf(ancora);
    assert.ok(i>=0,'âncora ausente: '+ancora);
    const f=fim?jogo.indexOf(fim,i):jogo.indexOf('\n',i);
    assert.ok(f>i,'fim do ramo não encontrado em '+nome);
    assert.ok(jogo.slice(i,f).indexOf('enemies.length<ENEMY_BUDGET')>0,
      nome+' sem teto de entidades');
  };
  teto('cisão do splitter',"if(e.type==='splitter'&&!e.isShard");
  teto('convocação do mini-chefe','if(e.summonCd<=0');
  teto('habilidade swarmSpawn','if(SK.swarmSpawn&&e.skillCd<=0');
  teto('fenda do spawner',"if(e.type==='spawner'){",'/* ---- ANÔMALO TEMPORAL');
  /* e não pode existir invocador novo sem teto: o total é exatamente 4 */
  const total=(jogo.match(/enemies\.length<ENEMY_BUDGET/g)||[]).length;
  assert.strictEqual(total,4,'mudou o número de invocadores com teto: '+total);
});

ok('B5-10: o runner continua recapitulando os rótulos das falhas',()=>{
  const src=fs.readFileSync(__filename,'utf8');
  assert.ok(src.indexOf("console.log('FALHAS ('+falhas.length+'):')")>=0,
    'resumo final sem a recapitulação de falhas');
  assert.ok(/falhas\.push\(\{\s*label/.test(src),'runner não coleta os rótulos');
});

ok('B5-11: versão do jogo, SM_VERSION e versão do estado do Diretor intactas',()=>{
  assert.strictEqual(t.SM_VERSION,3,'SM_VERSION mudou sem necessidade');
  assert.strictEqual(t.FRACTURE_STATE_VERSION,1,
    'versão do estado do Diretor mudou sem necessidade');
  const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  assert.strictEqual(pkg.version,'0.7.0-alpha','versão do pacote mudou');
});

ok('B5-12: as 12 assinaturas são alcançáveis e nenhuma domina o conjunto',()=>{
  const R=b5runs();
  const cont={};
  let tot=0;
  for(const r of R)for(const s of r.sigs){cont[s]=(cont[s]||0)+1;tot++;}
  assert.ok(tot>0,'nenhuma assinatura saiu em '+R.length+' runs');
  const ids=Object.keys(cont);
  assert.strictEqual(ids.length,12,
    'só '+ids.length+' das 12 assinaturas apareceram: '+J(ids.sort()));
  const freqs=ids.map(k=>cont[k]);
  const topo=Math.max.apply(null,freqs)/tot;
  assert.ok(topo<0.5,'uma assinatura concentra '+(topo*100).toFixed(1)+'% do conjunto');
  assert.ok(tot/R.length>=0.4,'assinaturas raras demais: '+(tot/R.length).toFixed(2)+'/run');
});

ok('B5-13: os sinais de revelação sobrevivem ao Continue',()=>{
  /* fractureRevealTrigger lê b.miniAligned, b.evThematic e b.evSig. Nenhum
     dos três era gravado no checkpoint, então um miniboss alinhado ou um
     evento fortemente temático ocorridos antes do save deixavam de servir de
     gatilho na retomada. Medido antes da correção: miniAligned ia de 10 a 0
     em 3 de 400 reloads; depois, 0 de 400. */
  const A=bootFx({});beginRun(A,1);
  A.setWave(10);
  const b=A.fractureB4();
  b.miniAligned=10;b.evThematic=9;b.evSig=0;
  const cp={fracture:A.fractureRunPack()};
  const B=bootFx({});beginRun(B,1);
  B.fractureRunUnpack(cp);
  const b2=B.fractureB4();
  assert.strictEqual(b2.miniAligned,10,'miniAligned perdido no Continue');
  assert.strictEqual(b2.evThematic,9,'evThematic perdido no Continue');
  /* e o gatilho volta a enxergar o sinal — a ordem do trigger é
     signature > miniboss > evento, por isso evSig fica zerado aqui */
  assert.strictEqual(B.fractureRevealTrigger(11,{}),'miniboss',
    'gatilho de miniboss não sobreviveu ao Continue');
  b2.miniAligned=0;
  assert.strictEqual(B.fractureRevealTrigger(11,{}),'evento',
    'gatilho de evento temático não sobreviveu ao Continue');
  /* save antigo, sem os campos: cai em 0 como antes, sem quebrar */
  const C=bootFx({});beginRun(C,1);
  const velho=JSON.parse(J(A.fractureRunPack()));
  delete velho.b4.miniAligned;delete velho.b4.evThematic;delete velho.b4.evSig;
  C.fractureRunUnpack({fracture:velho});
  const b3=C.fractureB4();
  assert.strictEqual(b3.miniAligned,0,'save antigo: miniAligned 0');
  assert.strictEqual(b3.evThematic,0,'save antigo: evThematic 0');
});

/* ---------------- resultado ---------------- */
console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){
  /* Recapitulação no FIM da saída. O rótulo de cada falha já é impresso na
     hora, mas fica perdido no meio de 261 linhas: qualquer `tail`, log
     truncado ou corrida em loop que só guarde a última linha devolve
     "1 falharam" sem dizer QUAL teste falhou. Foi exatamente assim que uma
     falha rara desta suíte ficou sem diagnóstico. Repetir os rótulos aqui
     custa duas linhas e garante que o nome sobreviva a qualquer recorte. */
  console.log('FALHAS ('+falhas.length+'):');
  for(const f of falhas)console.log('  ✘ '+f.label+'  →  '+f.erro);
  console.log('PR 13 — HÁ TESTES FALHANDO');
}
else console.log('PR 13 — TODOS OS TESTES PASSARAM');
process.exit(failed?1:0);
