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
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+
    (e&&e.stack||e).toString().split('\n').slice(0,4).join('\n    '));}
}
const J=x=>JSON.stringify(x);
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
     tem o bloco de exports anexado no fim, que menciona fractureRun. */
  const jogo=m[1];
  const ini=jogo.indexOf('PR13·bloco fx1.js');
  const fim=jogo.indexOf('\n   BOOT\n',ini);
  assert.ok(ini>0&&fim>ini,'bloco PR13 presente e delimitado');
  const dentro=i=>(i>=ini&&i<fim);
  const linha=i=>jogo.slice(0,i).split('\n').length;
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
ok('Intensidade NÃO é "inimigo com mais HP": nada de combate foi alterado no B1',()=>{
  /* o B1 é dado puro: waveComp continua exatamente o de sempre. */
  const antes=[1,5,10,15,19].map(n=>J(t.waveComp(n)));
  beginRun(t,1);
  t.fractureSetIntensity(100,'teste');
  const depois=[1,5,10,15,19].map(n=>J(t.waveComp(n)));
  assert.strictEqual(J(antes),J(depois),'waveComp não pode reagir à Intensidade no B1');
  /* e nenhum multiplicador de HP de inimigo referencia o Diretor */
  assert.ok(src.indexOf('diffHp(n)*fracture')<0);
  assert.ok(!/fractureGetIntensity\(\)/.test(
    src.slice(src.indexOf('function diffHp('),src.indexOf('function diffHp(')+400)));
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
  assert.strictEqual(f.waveProfile.bias.swarm,1.5);
  assert.strictEqual(J(f.waveProfile.pool),J(['swarm','splitter']));
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
  assert.ok(/PESOS:/.test(txt),'pesos');
  assert.ok(/POOLS:/.test(txt),'pools');
  assert.ok(/ÚLTIMO EVENTO:/.test(txt),'último evento');
  assert.ok(/HISTÓRICO\(\d+\/\d+\)/.test(txt),'histórico com limite');
  assert.ok(txt.indexOf('NEUTROS')>=0,'B1: pesos neutros');
  assert.ok(txt.indexOf('PADRÃO')>=0,'B1: pools padrão');
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

/* ---------------- resultado ---------------- */
console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed)console.log('PR 13 — HÁ TESTES FALHANDO');
else console.log('PR 13 — TODOS OS TESTES PASSARAM');
process.exit(failed?1:0);
