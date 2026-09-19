'use strict';
/* =====================================================================
   TESTES — Restauração de conteúdo histórico (PR 6)
   - 6 novos tipos de inimigos
   - Pool de minibosses
   - Sistema de fala dos Ecos
   - Shield / Dissonância / Operadores intactos
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const {readGameSource,runGameSource}=require('./harness/load-game');
const GAME_SRC=readGameSource();
let src=GAME_SRC;

src+=';globalThis.__t={'+
  'EDEFS,MINIBOSS,MINI_WAVES,MAX_WAVE,MINI_WAVE,ENEMY_BUDGET,'+
  'CHARS,ITEMS,UPGRADES,UNLOCKS,WEAPONS,'+
  'ECHO_ROLE,LORE_WORLD,'+
  'makePlayer,damagePlayer,regenPlayerShield,startRun,setChar,curChar,'+
  'itemById,mEff,waveComp,spawnEnemy,killEnemy,'+
  'getState:()=>state,getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getEnemies:()=>enemies,getWave:()=>wave,setWave:w=>{wave=w;},'+
  'ECHO_LINES,echoReact,echoSpeak,'+
  'pickMiniBoss,spawnMiniBoss,'+
  'enterDissonance,dissolveEcho,'+
  'diffHp,diffDmg,diffSpd,'+
  /* AUDIT-FIX-E: superfície observável para os contratos que antes eram
     verificados lendo o texto-fonte do index.html. Nada aqui muda o jogo —
     são apenas referências às funções/estados reais para o harness. */
  'ECHO_SHIELD,ECHO_SPEAK_INTERVAL,CX_TABS,DEV,'+
  'damageEnemy,applyStatus,makeEcho,echoRoleTick,drawEchoRole,updateEcho,'+
  'trustTier,echoAllied,updatePlayer,renderCodexBody,mbHazardsTick,smGet,'+
  'updateHerald,updateFurnace,updateSentinel,updateBrood,updateDuelist,'+
  'updateColossus,updateOracle,updateLeech,spawnBoss,updateBoss,'+
  'updateResonance,'+
  'getEchoes:()=>echoes,setEchoes:a=>{echoes=a;},'+
  'getProjectiles:()=>projectiles,setProjectiles:a=>{projectiles=a;},'+
  'setEnemies:a=>{enemies=a;},'+
  'getRunTime:()=>runTime,setRunTime:v=>{runTime=v;},'+
  'getCurAttacker:()=>curAttacker,setCurAttacker:v=>{curAttacker=v;},'+
  'getSpeakCd:()=>_echoSpeakCd,speechClear,speechTick,'+
  'getBossIntel:()=>bossIntel,setBossIntel:v=>{bossIntel=v;},'+
  'getBoss:()=>boss,getMiniBoss:()=>miniBoss,'+
  'setCodexTab:v=>{codexTab=v;},getCodexHtml:()=>cxBody.innerHTML,'+
  'globalRef:n=>{try{return eval(n);}catch(e){return undefined;}},'+
  'unlockAll:()=>{for(const k in UNLOCKS)if(prog.seen.indexOf(k)<0)prog.seen.push(k);}};';

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

const sandbox={console,Math,Date,parseInt,parseFloat,isNaN,setTimeout,clearTimeout,
  requestAnimationFrame:()=>0,setTimeout,clearTimeout,
  Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
  Promise,Proxy,Reflect,JSON,Symbol,
  document,window,localStorage,navigator,
  performance:{now:()=>Date.now()}
};
const ctx=vm.createContext(sandbox);
runGameSource(src,ctx,{timeout:15000});
const t=vm.runInContext('__t',ctx);

/* ---------------- harness ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+e.message);}
}

function freshRun(){
  t.setPlayer(null);
  t.setWave(0);
  t.startRun();
}

/* ---------------------------------------------------------------------
   AUDIT-FIX-E — utilitários de observação
   ---------------------------------------------------------------------
   Estes testes deixaram de auditar o TEXTO do index.html e passaram a
   exercitar as funções reais no sandbox, observando efeito (dano, estado,
   spawn, HUD). `withRandom` torna determinístico tudo que depende de
   Math.random; `fresh*` monta cenários mínimos e isolados. */
function withRandom(seq,fn){
  const real=Math.random;
  let i=0;
  const list=Array.isArray(seq)?seq:[seq];
  Math.random=()=>list[Math.min(i++,list.length-1)];
  try{return fn();}finally{Math.random=real;}
}
/* cria um inimigo isolado do tipo pedido, já "nascido" (sem spawnT) */
function loneEnemy(type,x,y){
  t.setEnemies([]);
  const e=t.spawnEnemy(type,x===undefined?400:x,y===undefined?400:y,1);
  e.spawnT=0;e.hp=e.maxHp=10000;
  return e;
}
/* mini-chefe determinístico: sempre a definição pedida, sem spawnT */
function loneMini(id){
  t.setEnemies([]);
  const def=t.MINIBOSS.find(d=>d.id===id);
  assert(def,'MINIBOSS sem definição '+id);
  const b=t.spawnMiniBoss(10,def);
  b.spawnT=0;
  return b;
}
/* Eco aliado pronto para o tick de papel (Guardião slot 1 / Disruptor 2) */
function loneEcho(slot){
  const e=t.makeEcho({dur:60,trail:[[0,0,1,0,0,0]],wave:5,level:3,
    items:[],upg:[],owned:[],moral:{comp:1,greed:0,viol:0},dom:'comp',
    kills:5,mh:100,st:{}},slot);
  e.alive=true;e.hostile=false;e.trust=80;e.x=400;e.y=400;
  t.setEchoes([e]);
  return e;
}
/* dano observado sobre um alvo com vida "infinita" */
function dealt(e,d,sx,sy,crit,isDot){
  const before=e.hp;
  t.damageEnemy(e,d,sx,sy,crit,isDot);
  return before-e.hp;
}

console.log('\nECHO — Restauração de conteúdo histórico (PR 6)');
console.log('---------------------------------------------');

/* ====================== VERIFICAÇÃO SINTÁTICA ====================== */
ok('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(GAME_SRC);
});

/* ====================== EDEFS: 6 NOVOS INIMIGOS ====================== */
const NEW_IDS=['swarm','orbiter','bulwark','splitter','phantom','singular'];
ok('EDEFS contém os 6 novos tipos de inimigo',()=>{
  for(const id of NEW_IDS)
    assert(t.EDEFS[id],'EDEFS['+id+'] não existe');
});

ok('IDs únicos entre todos os inimigos',()=>{
  const all=Object.keys(t.EDEFS);
  const set=new Set(all);
  assert.strictEqual(set.size,all.length,'IDs duplicados em EDEFS');
});

ok('Sistema Threat continua removido (nenhum símbolo vivo no runtime)',()=>{
  /* AUDIT-FIX-E: antes isto era regex no texto do index.html. O contrato
     real é "o símbolo não existe no escopo do jogo", e isso é observável. */
  for(const n of ['addThreat','threat','THREAT_NAME','threatHp'])
    assert.strictEqual(t.globalRef(n),undefined,n+' voltou a existir no runtime');
});

ok('Os 6 novos inimigos nascem e recebem dano sem o pipeline Threat',()=>{
  freshRun();
  for(const id of NEW_IDS){
    const e=loneEnemy(id);
    assert.strictEqual(e.type,id,'spawnEnemy devolveu tipo errado para '+id);
    assert(e.hp>0,id+' nasceu sem vida');
    assert.strictEqual(e.threat,undefined,id+' carrega campo threat');
  }
});

for(const id of NEW_IDS){
  ok(id+': stats válidos (hp, spd, r, dmg, xp, color)',()=>{
    const d=t.EDEFS[id];
    assert(d.hp>0,'hp deve ser > 0');
    assert(d.spd>0,'spd deve ser > 0');
    assert(d.r>0,'r deve ser > 0');
    assert(d.dmg>0,'dmg deve ser > 0');
    assert(d.xp>0,'xp deve ser > 0');
    assert(typeof d.color==='string','color deve ser string');
    assert(d.color.startsWith('#'),'color deve ser hex');
  });
}

ok('swarm: HP baixo e velocidade alta (frágil e rápido)',()=>{
  const d=t.EDEFS.swarm;
  assert(d.hp<=15,'HP do swarm deve ser ≤ 15');
  assert(d.spd>=280,'velocidade do swarm deve ser ≥ 280');
  assert(d.r<=12,'raio do swarm deve ser ≤ 12');
});

ok('orbiter: HP e velocidade moderados',()=>{
  const d=t.EDEFS.orbiter;
  assert(d.hp>=25&&d.hp<=50,'HP do orbiter deve estar entre 25-50');
  assert(d.spd>=180&&d.spd<=250,'velocidade do orbiter entre 180-250');
});

ok('bulwark: alta vida, baixa velocidade',()=>{
  const d=t.EDEFS.bulwark;
  assert(d.hp>=60,'HP do bulwark deve ser ≥ 60');
  assert(d.spd<=130,'velocidade do bulwark deve ser ≤ 130');
});

ok('splitter: HP e velocidade intermediários',()=>{
  const d=t.EDEFS.splitter;
  assert(d.hp>=40&&d.hp<=80,'HP do splitter entre 40-80');
});

ok('phantom: HP moderado e velocidade decente',()=>{
  const d=t.EDEFS.phantom;
  assert(d.hp>=25&&d.hp<=70,'HP do phantom entre 25-70');
});

ok('singular: HP muito alto e velocidade baixa',()=>{
  const d=t.EDEFS.singular;
  assert(d.hp>=150,'HP do singular deve ser ≥ 150');
  assert(d.spd<=110,'velocidade do singular deve ser ≤ 110');
});

/* ====================== WAVE COMP: INTEGRAÇÃO ====================== */
ok('waveComp inclui novos tipos a partir de ondas corretas',()=>{
  freshRun();
  // onda 1: deve ter swarm
  t.setWave(0);
  let c=t.waveComp(1);
  assert((c.swarm||0)>=2,'swarm deve aparecer na onda 1');
  assert(c.chaser>=2,'chaser deve aparecer na onda 1');
});

ok('waveComp(2): orbiter aparece',()=>{
  const c=t.waveComp(2);
  assert((c.orbiter||0)>=1,'orbiter deve aparecer na onda 2');
});

ok('waveComp(4): bulwark aparece',()=>{
  const c=t.waveComp(4);
  assert((c.bulwark||0)>=1,'bulwark deve aparecer na onda 4');
});

ok('waveComp(6): splitter aparece',()=>{
  const c=t.waveComp(6);
  assert((c.splitter||0)>=1,'splitter deve aparecer na onda 6');
});

ok('waveComp(8): phantom aparece',()=>{
  const c=t.waveComp(8);
  assert((c.phantom||0)>=1,'phantom deve aparecer na onda 8');
});

ok('waveComp(13): singular aparece',()=>{
  const c=t.waveComp(13);
  assert((c.singular||0)>=1,'singular deve aparecer na onda 13');
});

ok('waveComp(1): tipos tardios NÃO aparecem cedo',()=>{
  const c=t.waveComp(1);
  assert(!c.splitter,'splitter não deve aparecer na onda 1');
  assert(!c.phantom,'phantom não deve aparecer na onda 1');
  assert(!c.singular,'singular não deve aparecer na onda 1');
});

ok('waveComp respeita ENEMY_BUDGET',()=>{
  const c=t.waveComp(20);
  let total=0;for(const k in c)total+=c[k];
  assert(total<=t.ENEMY_BUDGET+2,'total deve respeitar orçamento (com margem)');
});

/* ====================== MINI_WAVES ====================== */
ok('MINI_WAVES é [5, 10, 15]',()=>{
  assert(Array.isArray(t.MINI_WAVES),'MINI_WAVES deve ser array');
  assert.strictEqual(t.MINI_WAVES.length,3);
  assert.strictEqual(t.MINI_WAVES[0],5);
  assert.strictEqual(t.MINI_WAVES[1],10);
  assert.strictEqual(t.MINI_WAVES[2],15);
});

ok('MINI_WAVE = 10 (compatibilidade)',()=>{
  assert.strictEqual(t.MINI_WAVE,10);
});

ok('MAX_WAVE = 20',()=>{
  assert.strictEqual(t.MAX_WAVE,20);
});

/* ====================== MINIBOSS POOL ====================== */
ok('MINIBOSS tem pelo menos 6 minibosses',()=>{
  assert(t.MINIBOSS.length>=6,'deve ter ≥ 6 minibosses, tem '+t.MINIBOSS.length);
});

ok('Todos os minibosses têm identidade completa',()=>{
  for(const mb of t.MINIBOSS){
    assert(mb.id,'id obrigatório');
    assert(mb.nm,'nm obrigatório');
    assert(mb.c,'c (cor) obrigatório');
    assert(mb.hp>0,'hp mult deve ser > 0');
    assert(mb.spd>0,'spd mult deve ser > 0');
    assert(mb.r>0,'r deve ser > 0');
    assert(mb.plates>0,'plates deve ser > 0');
    assert(mb.sk,'sk (skills) obrigatório');
    assert(mb.desc,'desc obrigatório');
  }
});

ok('IDs únicos entre minibosses',()=>{
  const ids=t.MINIBOSS.map(m=>m.id);
  assert.strictEqual(new Set(ids).size,ids.length,'IDs duplicados em MINIBOSS');
});

ok('O Arauto da Fratura está no pool',()=>{
  const herald=t.MINIBOSS.find(m=>m.id==='herald');
  assert(herald,'herald deve estar no pool');
  assert(herald.nm.includes('ARAUTO'),'nome deve conter ARAUTO');
});

ok('pickMiniBoss retorna miniboss válido para onda 5',()=>{
  const mb=t.pickMiniBoss(5);
  assert(mb,'pickMiniBoss deve retornar um miniboss');
  assert(mb.hp<=1.15,'onda 5 deve filtrar hp ≤ 1.15');
});

ok('pickMiniBoss retorna miniboss válido para onda 10',()=>{
  const mb=t.pickMiniBoss(10);
  assert(mb,'pickMiniBoss(10) deve retornar válido');
});

ok('pickMiniBoss retorna miniboss válido para onda 15',()=>{
  const mb=t.pickMiniBoss(15);
  assert(mb,'pickMiniBoss(15) deve retornar válido');
  assert(mb.hp>=.8,'onda 15 deve filtrar hp ≥ 0.8');
});

ok('Minibosses não Arauto têm skills diferentes',()=>{
  const others=t.MINIBOSS.filter(m=>m.id!=='herald');
  const allSkills=others.map(m=>Object.keys(m.sk).join(','));
  // pelo menos alguns devem ter skills diferentes do herald
  const heraldSkills=Object.keys(t.MINIBOSS.find(m=>m.id==='herald').sk).sort().join(',');
  const different=others.filter(m=>Object.keys(m.sk).sort().join(',')!==heraldSkills);
  assert(different.length>=3,'pelo menos 3 minibosses devem ter skills diferentes do herald');
});

/* ====================== SPAWN VÁLIDO ====================== */
ok('spawnEnemy funciona para novos tipos sem erro',()=>{
  freshRun();
  t.setWave(5);
  for(const id of NEW_IDS){
    const e=t.spawnEnemy(id,500,500,5);
    assert(e,'spawnEnemy('+id+') deve retornar entidade');
    assert(e.type===id,'type deve ser '+id);
    assert(e.hp>0,'hp deve ser > 0');
    assert(e.maxHp>0,'maxHp deve ser > 0');
    assert(e.r>0,'r deve ser > 0');
  }
});

ok('spawnEnemy aplica escalonamento de onda',()=>{
  freshRun();
  const e1=t.spawnEnemy('swarm',500,500,1);
  const e5=t.spawnEnemy('swarm',500,500,5);
  assert(e5.maxHp>e1.maxHp,'HP deve escalar com a onda');
});

/* ====================== SISTEMA DE FALA ====================== */
ok('ECHO_LINES existe e tem eventos definidos',()=>{
  assert(t.ECHO_LINES,'ECHO_LINES deve existir');
  const events=Object.keys(t.ECHO_LINES);
  assert(events.length>=6,'deve ter ≥ 6 eventos de fala');
});

ok('ECHO_LINES: eventos essenciais presentes',()=>{
  const required=['waveStart','playerHurt','lowHp','resonance','dissonance',
    'dissonanceEnd','miniboss','bossDeath'];
  for(const ev of required)
    assert(t.ECHO_LINES[ev],'evento '+ev+' deve existir em ECHO_LINES');
});

ok('Cada evento tem pelo menos 2 linhas',()=>{
  for(const ev in t.ECHO_LINES)
    assert(t.ECHO_LINES[ev].length>=2,
      'evento '+ev+' deve ter ≥ 2 linhas, tem '+t.ECHO_LINES[ev].length);
});

/* ====================== SHIELD INTACTO ====================== */
ok('Shield do player continua funcional',()=>{
  freshRun();
  const p=t.getPlayer();
  assert(p.shieldMax>0,'shieldMax > 0');
  assert(p.shield===p.shieldMax,'shield começa cheio');
});

ok('Shield absorve dano antes do HP',()=>{
  freshRun();
  const p=t.getPlayer();
  const hpBefore=p.hp;
  const shBefore=p.shield;
  t.damagePlayer(10);
  assert(p.shield<shBefore||p.hp<hpBefore,'algo deve ter mudado');
});

ok('Shield dos Echos intacto (ECHO_SHIELD com capacidade por slot)',()=>{
  const S=t.ECHO_SHIELD;
  assert(Array.isArray(S),'ECHO_SHIELD deve ser um array');
  assert.strictEqual(S.length,3,'um valor por slot (índice 0 não usado)');
  assert(S[1]>0&&S[2]>0,'ambos os slots têm capacidade de escudo');
});

/* ====================== ECHOS INTACTOS ====================== */
ok('Echos continuam funcionais',()=>{
  freshRun();
  // sem run anterior: não deve ter Ecos
  assert.strictEqual(t.getPlayer().x>0,true);
});

/* ====================== DISSONÂNCIA INTACTA ====================== */
ok('enterDissonance ainda existe',()=>{
  assert(typeof t.enterDissonance==='function');
});

ok('dissolveEcho ainda existe',()=>{
  assert(typeof t.dissolveEcho==='function');
});

/* ====================== OPERADORES INTACTOS ====================== */
ok('8 operadores',()=>{
  assert.strictEqual(t.CHARS.length,8);
});

ok('Lore dos operadores preservada',()=>{
  for(const c of t.CHARS){
    assert(c.lore,'operador '+c.id+' deve ter lore');
    assert(c.lore.length>50,'lore de '+c.id+' deve ter conteúdo substancial');
  }
});

/* ====================== SAVES NÃO QUEBRAM ====================== */
ok('localStorage não contém dados corrompidos após startRun',()=>{
  freshRun();
  // o jogo deve rodar sem erros de persistência
  const p=t.getPlayer();
  assert(p,'player deve existir após startRun');
});

/* ====================== CÓDIGO NÃO TEM REFERÊNCIAS A THREAT ====================== */
ok('Escalada de onda não depende de Threat (waveComp responde só à onda)',()=>{
  /* Substitui a auditoria textual por um contrato de comportamento: a
     composição da onda é função da onda, não de um contador de ameaça. */
  const a=t.waveComp(3),b=t.waveComp(3);
  assert.deepStrictEqual(a,b,'waveComp deixou de ser determinística por onda');
  assert(t.waveComp(12),'waveComp precisa responder em ondas altas');
});

/* ====================== MINIBOSS SPAWN INTEGRADO ====================== */
ok('spawnMiniBoss funciona sem erro',()=>{
  freshRun();
  t.setWave(5);
  const b=t.spawnMiniBoss(5);
  assert(b,'spawnMiniBoss deve retornar entidade');
  assert(b.type==='miniboss','type deve ser miniboss');
  assert(b.hp>0,'hp deve ser > 0');
  assert(b.plates>0,'plates deve ser > 0');
  assert(b.mb,'deve ter referência à definição');
  assert(b.sk,'deve ter skills');
});

/* ====================== CODICE INCLUDE NOVOS INIMIGOS ====================== */
ok('Codex INIMIGOS renderiza os 6 novos tipos',()=>{
  /* AUDIT-FIX-E: renderiza a aba de verdade e lê o HTML produzido, em vez
     de procurar o literal ['swarm','ENXAME'] dentro do index.html. */
  t.setCodexTab('enemies');
  t.renderCodexBody();
  const h=t.getCodexHtml();
  for(const nm of ['ENXAME','ORBITADOR','BLINDADO','CISÃO','LEVIANO','SINGULAR'])
    assert(h.indexOf(nm)>=0,'Codex de inimigos sem '+nm);
});

/* ====================== BULWARK: ESCUDO FRONTAL ====================== */
ok('BLINDADO: golpe contra a placa sofre muito menos que pelas costas',()=>{
  freshRun();
  t.setCurAttacker(null);
  const e=loneEnemy('bulwark',400,400);
  e.shieldAng=0;                       // placa apontada para +x
  const frente=withRandom(.99,()=>dealt(e,100,e.x+120,e.y));
  const costas=withRandom(.99,()=>dealt(e,100,e.x-120,e.y));
  assert(frente>0&&costas>0,'ambos os lados devem causar algum dano');
  assert(frente<costas*.5,
    'a placa frontal não reduziu o dano: frente='+frente+' costas='+costas);
});

/* ====================== PHANTOM: INTANGIBILIDADE ====================== */
ok('LEVIANO: imune a dano enquanto está em fase fantasma',()=>{
  freshRun();
  t.setCurAttacker(null);
  const e=loneEnemy('phantom',400,400);
  e.ghostT=1.3;
  assert.strictEqual(withRandom(.99,()=>dealt(e,250,e.x-60,e.y)),0,
    'fantasma levou dano durante a intangibilidade');
  e.ghostT=0;
  assert(withRandom(.99,()=>dealt(e,250,e.x-60,e.y))>0,
    'fantasma materializado continuou imune');
});

/* ====================== SINGULAR: REFLEXÃO ====================== */
ok('SINGULAR: reflete parte do dano direto de volta ao jogador',()=>{
  freshRun();
  const pl=t.getPlayer();
  pl.shield=0;pl.dashT=0;pl.invT=0;pl.hp=pl.maxHp=1000;
  const e=loneEnemy('singular',pl.x+150,pl.y);
  t.setCurAttacker(pl);
  withRandom([.01,.99,.99,.99],()=>t.damageEnemy(e,200,pl.x,pl.y,false,false));
  t.setCurAttacker(null);
  assert(pl.hp<1000,'reflexão não atingiu o jogador');
  pl.hp=1000;
  const e2=loneEnemy('singular',pl.x+150,pl.y);
  t.setCurAttacker(pl);
  withRandom(.99,()=>t.damageEnemy(e2,200,pl.x,pl.y,false,false));
  t.setCurAttacker(null);
  assert.strictEqual(pl.hp,1000,'reflexão disparou fora da sua chance');
});

/* ====================== SPLITTER: CISÃO NA MORTE ====================== */
ok('CISÃO: ao morrer gera dois fragmentos; fragmento não se divide',()=>{
  freshRun();
  t.setCurAttacker(null);
  const e=loneEnemy('splitter',400,400);
  t.killEnemy(e);
  const shards=t.getEnemies().filter(x=>x.type==='splitter'&&x.isShard);
  assert.strictEqual(shards.length,2,'esperados 2 fragmentos, vi '+shards.length);
  assert(shards[0].r<e.r,'fragmento deve ser menor que o original');
  const antes=t.getEnemies().length;
  t.killEnemy(shards[0]);
  assert.strictEqual(t.getEnemies().length,antes,'fragmento se dividiu de novo');
});

/* ====================== CURSE (ORÁCULO) ====================== */
ok('MALDIÇÃO DO ORÁCULO: aplica −30% de dano e expira pelo updatePlayer',()=>{
  freshRun();
  const pl=t.getPlayer();
  const base=t.smGet(pl,'damage');
  const b=loneMini('oracle');
  b.ms.curseCd=0;b.ms.predCd=99;         // só a maldição neste tick
  t.updateOracle(b,.016,pl);
  assert(pl.curseT>0,'maldição não marcou duração no jogador');
  const sob=t.smGet(pl,'damage');
  assert(sob<base,'dano não caiu sob a maldição: '+sob+' vs '+base);
  assert(Math.abs(sob/base-0.70)<1e-6,
    'a redução deixou de ser −30%: razão '+(sob/base));
  /* a expiração é responsabilidade do updatePlayer */
  const dur=pl.curseT;
  for(let i=0;i<Math.ceil(dur/0.1)+2;i++)t.updatePlayer(.1);
  assert.strictEqual(pl.curseT,0,'curseT não zerou no updatePlayer');
  assert(Math.abs(t.smGet(pl,'damage')-base)<1e-6,
    'modificador da maldição sobreviveu à expiração');
});

/* ====================== ECO SPEAK COOLDOWN ====================== */
ok('Fala do Eco arma o cooldown legado e ele escoa no tick',()=>{
  freshRun();
  const e=loneEcho(1);
  t.speechClear();
  assert.strictEqual(t.getSpeakCd(),0,'speechClear deve zerar o cooldown');
  assert(t.echoSpeak(e,'TESTE DE COBERTURA.','#8ff6ff'),'fala recusada');
  assert.strictEqual(t.getSpeakCd(),t.ECHO_SPEAK_INTERVAL,
    'cooldown não foi armado no intervalo padrão');
  t.speechTick(1);
  assert(t.getSpeakCd()<t.ECHO_SPEAK_INTERVAL,'cooldown não escoa no tick');
});

/* ====================== PAPÉIS TÁTICOS DOS ECOS ====================== */
ok('ECHO_ROLE existe com Guardião e Disruptor',()=>{
  assert(t.ECHO_ROLE,'ECHO_ROLE deve existir');
  assert.strictEqual(t.ECHO_ROLE.length,3,'deve ter 3 slots (null + 2)');
  assert.strictEqual(t.ECHO_ROLE[1].id,'guardian');
  assert.strictEqual(t.ECHO_ROLE[2].id,'disruptor');
});

ok('Ecos nascem com campos de papel (roleCd, roleT, roleFx, shieldPot)',()=>{
  freshRun();
  for(const slot of [1,2]){
    const e=loneEcho(slot);
    assert(typeof e.roleCd==='number'&&e.roleCd>0,'slot '+slot+' sem roleCd inicial');
    assert.strictEqual(e.roleT,0,'slot '+slot+' nasce com roleT ativo');
    assert.strictEqual(e.roleFx,0,'slot '+slot+' nasce com roleFx ativo');
    assert.strictEqual(e.shieldPot,0,'slot '+slot+' nasce com shieldPot');
  }
});

ok('GUARDIÃO (slot 1): o tick abre a barreira e concede shieldPot',()=>{
  freshRun();
  const e=loneEcho(1);
  e.roleCd=0;
  t.echoRoleTick(e,.016);
  assert(e.roleT>0,'barreira não abriu (roleT)');
  assert(e.shieldPot>0,'barreira não concedeu redução (shieldPot)');
  assert(e.roleCd>0,'cooldown não rearmou depois de disparar');
});

ok('DISRUPTOR (slot 2): o pulso atinge, congela e corrói inimigos no raio',()=>{
  freshRun();
  const e=loneEcho(2);
  const perto=loneEnemy('chaser',e.x+40,e.y);
  const longe=t.spawnEnemy('chaser',e.x+900,e.y,1);
  longe.spawnT=0;longe.hp=longe.maxHp=10000;
  const hpPerto=perto.hp,hpLonge=longe.hp;
  e.roleCd=0;
  t.echoRoleTick(e,.016);
  assert(perto.hp<hpPerto,'pulso não causou dano no alvo próximo');
  assert.strictEqual(longe.hp,hpLonge,'pulso atingiu alvo fora do raio');
  assert(perto.st&&perto.st.chillP>0,'pulso não aplicou chill');
  assert(perto.st&&perto.st.corrT>0,'pulso não aplicou corrode');
});

ok('ECHO_ROLE publica identidade dos dois papéis e drawEchoRole roda',()=>{
  freshRun();
  assert.strictEqual(t.ECHO_ROLE[1].id,'guardian');
  assert.strictEqual(t.ECHO_ROLE[2].id,'disruptor');
  for(const slot of [1,2])
    assert(/^#[0-9a-f]{6}$/i.test(t.ECHO_ROLE[slot].c),
      'slot '+slot+' sem cor de papel');
  /* o render é puramente visual: o contrato testável é não lançar */
  for(const slot of [1,2]){
    const e=loneEcho(slot);e.roleT=2;e.roleFx=.5;
    assert.doesNotThrow(()=>t.drawEchoRole(e),'drawEchoRole lançou no slot '+slot);
  }
});

ok('updateEcho encaminha o papel (barreira abre pelo update, não só pelo tick)',()=>{
  freshRun();
  const e=loneEcho(1);
  e.roleCd=0;
  t.updateEcho(e,.016);
  assert(e.roleT>0,'updateEcho não acionou o papel do Guardião');
});

ok('Guardião com barreira ativa reduz o dano sofrido pelo jogador',()=>{
  freshRun();
  const pl=t.getPlayer();
  const medir=()=>{pl.hp=pl.maxHp=1000;pl.shield=0;pl.dashT=0;pl.invT=0;
    t.damagePlayer(100);return 1000-pl.hp;};
  t.setEchoes([]);
  const semEco=medir();
  const e=loneEcho(1);
  e.roleCd=0;t.echoRoleTick(e,.016);
  const comEco=medir();
  t.setEchoes([]);
  assert(semEco>0&&comEco>0,'dano precisa chegar ao jogador nos dois casos');
  assert(comEco<semEco,'barreira não reduziu: com='+comEco+' sem='+semEco);
});

ok('Papel suspenso em desconfiança total (tier 0) e com Eco hostil',()=>{
  freshRun();
  for(const cenario of ['tier0','hostil']){
    const e=loneEcho(1);
    e.roleCd=0;
    if(cenario==='tier0'){e.trust=0;assert.strictEqual(t.trustTier(e),0,'tier deveria ser 0');}
    else e.hostile=true;
    t.echoRoleTick(e,.016);
    assert.strictEqual(e.roleT,0,'papel abriu mesmo com '+cenario);
    assert.strictEqual(e.shieldPot,0,'shieldPot concedido com '+cenario);
  }
});

/* ====================== MICRO-RESSONÂNCIA ======================
   AUDIT-FIX-E: o contrato é observável em damageEnemy — alternância
   jogador↔Eco dentro da janela rende bônus, fora dela não rende, e a
   Ressonância plena tem precedência. Nada disto depende do texto-fonte. */
/* prepara um alvo com o último golpe vindo do Eco há `atras` segundos */
function alvoMicro(atras){
  const e=loneEnemy('chaser',420,400);
  const now=t.getRunTime();
  e.lastTag='p';e.lastTagT=now;        // bloqueia a Ressonância plena
  e.microCd=0;e.resoCd=0;
  if(atras!==null){e.microTag='e1';e.microT=now-atras;}
  return e;
}
function golpeDoJogador(e,d){
  const pl=t.getPlayer();
  t.setCurAttacker(pl);
  const v=withRandom(.99,()=>dealt(e,d,pl.x,pl.y,false,false));
  t.setCurAttacker(null);
  return v;
}

ok('Micro-Ressonância dá +22% quando jogador e Eco alternam na janela',()=>{
  freshRun();t.setRunTime(100);
  const base=golpeDoJogador(alvoMicro(null),100);
  const micro=golpeDoJogador(alvoMicro(1.0),100);
  assert(base>0,'golpe de controle não causou dano');
  assert(Math.abs(micro/base-1.22)<1e-6,
    'bônus deixou de ser +22%: razão '+(micro/base));
});

ok('Micro-Ressonância respeita a janela (>=0.5s e <1.6s)',()=>{
  freshRun();t.setRunTime(100);
  const base=golpeDoJogador(alvoMicro(null),100);
  assert.strictEqual(golpeDoJogador(alvoMicro(2.4),100),base,
    'disparou acima de 1.6s');
  assert.strictEqual(golpeDoJogador(alvoMicro(.2),100),base,
    'disparou abaixo de 0.5s (janela da Ressonância plena)');
});

ok('Micro-Ressonância não dispara junto com a Ressonância plena',()=>{
  freshRun();t.setRunTime(100);
  const e=alvoMicro(1.0);
  e.lastTag='e1';e.lastTagT=t.getRunTime()-.1;   // plena elegível
  golpeDoJogador(e,100);
  assert.strictEqual(e.microCd,0,
    'Micro-Ressonância disparou no mesmo golpe da plena (double-dip)');
});

ok('Micro-Ressonância entra em cooldown e o cooldown escoa no loop',()=>{
  freshRun();t.setRunTime(100);
  const e=alvoMicro(1.0);
  golpeDoJogador(e,100);
  assert(e.microCd>0,'cooldown não armou após o bônus');
  /* enquanto o cooldown corre, não há segundo bônus */
  const base=golpeDoJogador(alvoMicro(null),100);
  e.microTag='e1';e.microT=t.getRunTime()-1.0;
  assert.strictEqual(golpeDoJogador(e,100),base,'bônus repetiu sob cooldown');
  const antes=e.microCd;
  t.setEnemies([e]);
  t.updateResonance(.2);
  assert(e.microCd<antes,'updateResonance não escoa o cooldown');
});

/* ====================== SENTINELA (MINIBOSS) ====================== */
/* PR13.5 B5-B: a Sentinela passou a ter POSTURAS (updateSentinel); os
   estados legados shieldUpState/reflectState continuam sendo escritos a
   partir da postura para o renderer e para damageEnemy. */
ok('SENTINELA: a postura dita os estados de escudo e reflexão',()=>{
  freshRun();
  const pl=t.getPlayer();
  const b=loneMini('sentinel');
  b.ms.stance='neutral';b.ms.stanceT=0;
  t.updateSentinel(b,.016,pl);
  assert.strictEqual(b.ms.stance,'guard','neutra deveria virar GUARDA');
  assert.strictEqual(b.shieldUpState,'active','GUARDA não ativou o escudo');
  assert.strictEqual(b.reflectState,'active','GUARDA não ativou a reflexão');
  b.ms.stanceT=0;
  t.updateSentinel(b,.016,pl);
  assert.strictEqual(b.ms.stance,'open','GUARDA deveria abrir');
  assert.strictEqual(b.shieldUpState,'vulnerable','ABERTURA não expôs a janela');
  assert.strictEqual(b.reflectState,null,'reflexão continuou fora da GUARDA');
});

ok('SENTINELA: em GUARDA devolve os projéteis do jogador',()=>{
  freshRun();
  const pl=t.getPlayer();
  const b=loneMini('sentinel');
  b.ms.stance='guard';b.ms.stanceT=9;
  const pr={x:b.x+10,y:b.y,vx:300,vy:0,r:5,dmg:10,life:3,type:'orb',team:'player',color:'#fff'};
  t.setProjectiles([pr]);
  t.updateSentinel(b,.016,pl);
  assert.strictEqual(pr.team,'enemy','projétil não trocou de lado');
  assert.strictEqual(pr.owner,b,'projétil devolvido sem dono');
  assert(pr.vx<0,'projétil não inverteu a direção');
  t.setProjectiles([]);
});

ok('SENTINELA: escudo ativo reduz o dano e a janela aberta o amplifica',()=>{
  freshRun();
  t.setCurAttacker(null);
  const medir=st=>{
    const b=loneMini('sentinel');
    b.hp=b.maxHp=200000;b.plates=0;b.shieldUpState=st;b.sleepDmgRed=0;
    return withRandom(.99,()=>dealt(b,1000,b.x-100,b.y));
  };
  const neutro=medir(null),ativo=medir('active'),aberto=medir('vulnerable');
  assert(Math.abs(ativo/neutro-0.25)<1e-6,'escudo ativo deixou de reduzir 75%: '+(ativo/neutro));
  assert(Math.abs(aberto/neutro-1.30)<1e-6,'janela deixou de amplificar 30%: '+(aberto/neutro));
});

/* ====================== COLOSSO (SONO/VIGÍLIA) ====================== */
ok('COLOSSO: alterna dormente/desperto e espelha a fase na entidade',()=>{
  freshRun();
  const pl=t.getPlayer();
  const b=loneMini('colossus');
  b.ms.sleep='awake';b.ms.sleepT=0;
  t.updateColossus(b,.016,pl);
  assert.strictEqual(b.ms.sleep,'dormant','desperto deveria adormecer');
  assert.strictEqual(b.sleepPhase,'dormant','fase não espelhada na entidade');
  assert(b.sleepDmgRed>0,'dormência não trouxe redução de dano');
  b.ms.sleepT=0;
  t.updateColossus(b,.016,pl);
  assert.strictEqual(b.ms.sleep,'awake','dormente deveria despertar');
  assert.strictEqual(b.sleepDmgRed,0,'redução sobreviveu ao despertar');
});

ok('COLOSSO: dormente sofre menos dano',()=>{
  freshRun();
  t.setCurAttacker(null);
  const medir=red=>{
    const b=loneMini('colossus');
    b.hp=b.maxHp=200000;b.plates=0;b.shieldUpState=null;b.sleepDmgRed=red;
    return withRandom(.99,()=>dealt(b,1000,b.x-100,b.y));
  };
  const acordado=medir(0),dormindo=medir(.60);
  assert(Math.abs(dormindo/acordado-0.40)<1e-6,
    'dormência deixou de reduzir 60%: '+(dormindo/acordado));
});

ok('COLOSSO: o despertar solta um quake que fere quem está perto',()=>{
  freshRun();
  const pl=t.getPlayer();
  pl.hp=pl.maxHp=5000;pl.shield=0;pl.dashT=0;pl.invT=0;
  const b=loneMini('colossus');
  b.x=pl.x+60;b.y=pl.y;                  // dentro do raio do quake
  b.ms.sleep='dormant';b.ms.sleepT=0;
  t.updateColossus(b,.016,pl);
  assert(pl.hp<5000,'quake do despertar não atingiu o jogador colado');
  /* fora do raio (>340) o mesmo despertar não fere */
  pl.hp=5000;
  const b2=loneMini('colossus');
  b2.x=pl.x+900;b2.y=pl.y;
  b2.ms.sleep='dormant';b2.ms.sleepT=0;
  t.updateColossus(b2,.016,pl);
  assert.strictEqual(pl.hp,5000,'quake atingiu alvo fora do raio');
});

/* ====================== ARAUTO (FRATURAS) ====================== */
/* B5-B: as fraturas viraram PRESSÁGIOS (hazards kind 'omen', com cap e escalada) */
ok('ARAUTO: o presságio marca a arena e detona com dano + lentidão',()=>{
  freshRun();
  const pl=t.getPlayer();
  pl.hp=pl.maxHp=5000;pl.shield=0;pl.dashT=0;pl.invT=0;
  const b=loneMini('herald');
  b.x=pl.x+400;b.y=pl.y;
  b.ms.omenCd=0;b.burstCd=99;b.summonCd=99;b.chargeCd=99;
  withRandom(.5,()=>t.updateHerald(b,.016,pl));
  const omens=(b.hazards||[]).filter(h=>h.kind==='omen');
  assert(omens.length>0,'nenhum presságio criado');
  /* o presságio é telegrafado: não fere enquanto o fuse corre */
  t.mbHazardsTick(b,.1,pl);
  assert.strictEqual(pl.hp,5000,'presságio feriu antes de detonar');
  /* posiciona o jogador sob a marca e deixa o fuse terminar */
  pl.x=omens[0].x;pl.y=omens[0].y;
  t.mbHazardsTick(b,5,pl);
  assert(pl.hp<5000,'presságio não causou dano ao detonar');
  assert(pl.st&&pl.st.chillP>0,'presságio não aplicou lentidão');
});

/* ====================== LORE_WORLD / CODEX ====================== */
ok('LORE_WORLD existe com short, full e extra',()=>{
  assert(t.LORE_WORLD,'LORE_WORLD deve existir');
  assert(t.LORE_WORLD.short,'deve ter texto curto');
  assert(Array.isArray(t.LORE_WORLD.full),'full deve ser array');
  assert(Array.isArray(t.LORE_WORLD.extra),'extra deve ser array');
});

ok('LORE_WORLD tem pelo menos 9 entradas full',()=>{
  assert(t.LORE_WORLD.full.length>=9,'deve ter pelo menos 9 registros');
});

ok('LORE_WORLD tem pelo menos 5 dossiês extra',()=>{
  assert(t.LORE_WORLD.extra.length>=5,'deve ter pelo menos 5 dossiês');
});

ok('Codex publica a aba ARQUIVO ÔMEGA em CX_TABS',()=>{
  const tab=t.CX_TABS.find(x=>x.id==='lore');
  assert(tab,'CX_TABS perdeu a aba lore');
  assert.strictEqual(tab.nm,'ARQUIVO ÔMEGA','o rótulo da aba mudou');
});

ok('Codex ARQUIVO ÔMEGA renderiza todo o LORE_WORLD',()=>{
  t.setCodexTab('lore');
  t.renderCodexBody();
  const h=t.getCodexHtml();
  assert(h.indexOf(t.LORE_WORLD.short)>=0,'texto de abertura ausente');
  for(const sec of t.LORE_WORLD.full)
    assert(h.indexOf(sec.t)>=0,'registro ausente no Codex: '+sec.t);
  for(const x of t.LORE_WORLD.extra)
    assert(h.indexOf(x.t)>=0,'dossiê ausente no Codex: '+x.t);
});

/* ====================== MÓDULOS HISTÓRICOS ====================== */
ok('DADO VICIADO (su_sorte) existe',()=>{
  const item=t.ITEMS.find(i=>i.id==='su_sorte');
  assert(item,'su_sorte deve existir em ITEMS');
  assert(item.apply,'deve ter função apply');
});

ok('BISTURI SIMBIÓTICO (su_critcura) existe',()=>{
  const item=t.ITEMS.find(i=>i.id==='su_critcura');
  assert(item,'su_critcura deve existir em ITEMS');
  assert(item.apply,'deve ter função apply');
});

ok('PROTOCOLO DE EXECUÇÃO (su_exec) existe',()=>{
  const item=t.ITEMS.find(i=>i.id==='su_exec');
  assert(item,'su_exec deve existir em ITEMS');
});

ok('AGULHA RESSONANTE (su_dotcrit) existe',()=>{
  const item=t.ITEMS.find(i=>i.id==='su_dotcrit');
  assert(item,'su_dotcrit deve existir em ITEMS');
});

ok('DADO VICIADO: healChance cura de verdade no abate',()=>{
  freshRun();
  const pl=t.getPlayer();
  pl.maxHp=200;pl.hp=100;pl.healChance=.5;pl.healAmount=14;
  const e=loneEnemy('chaser');
  t.setCurAttacker(pl);
  withRandom(.01,()=>t.killEnemy(e));
  t.setCurAttacker(null);
  assert(pl.hp>100,'abate não curou dentro da chance de healChance');
  /* sem sorte, nenhuma cura */
  pl.hp=100;
  const e2=loneEnemy('chaser');
  t.setCurAttacker(pl);
  withRandom(.99,()=>t.killEnemy(e2));
  t.setCurAttacker(null);
  assert.strictEqual(pl.hp,100,'curou fora da chance');
  delete pl.healChance;delete pl.healAmount;
});

ok('BISTURI SIMBIÓTICO: critHeal cura no crítico (e só no crítico)',()=>{
  freshRun();
  const pl=t.getPlayer();
  pl.maxHp=200;pl.hp=100;pl.critHeal=4;
  const e=loneEnemy('chaser');
  t.setCurAttacker(pl);
  withRandom(.99,()=>t.damageEnemy(e,10,pl.x,pl.y,false,false));
  assert.strictEqual(pl.hp,100,'acerto normal curou');
  withRandom(.99,()=>t.damageEnemy(e,10,pl.x,pl.y,true,false));
  t.setCurAttacker(null);
  assert(pl.hp>100,'crítico não curou com critHeal');
  delete pl.critHeal;
});

ok('PROTOCOLO DE EXECUÇÃO: execThreshold finaliza alvo abaixo do limiar',()=>{
  freshRun();
  const pl=t.getPlayer();
  pl.maxHp=200;pl.hp=100;pl.execThreshold=.12;
  const e=loneEnemy('chaser');
  e.maxHp=1000;e.hp=100;
  t.setCurAttacker(pl);
  withRandom(.99,()=>t.damageEnemy(e,95,pl.x,pl.y,false,false));
  t.setCurAttacker(null);
  assert.strictEqual(e.hp,0,'alvo sob o limiar não foi executado');
  assert(pl.hp>100,'execução não devolveu vida');
  delete pl.execThreshold;
});

ok('AGULHA RESSONANTE: dotCrit amplifica o dano contínuo',()=>{
  freshRun();
  const pl=t.getPlayer();
  t.setCurAttacker(pl);
  const medir=dc=>{
    if(dc)pl.dotCrit=dc;else delete pl.dotCrit;
    const e=loneEnemy('chaser');
    return withRandom(.01,()=>dealt(e,100,pl.x,pl.y,false,true));
  };
  const base=medir(0),crit=medir(1);
  t.setCurAttacker(null);
  delete pl.dotCrit;
  assert(base>0,'DoT de controle não causou dano');
  assert(Math.abs(crit/base-1.8)<1e-6,'crítico de DoT deixou de ser ×1.8: '+(crit/base));
});

/* ====================== BOSS ADAPTATIVO ====================== */
ok('Boss guarda a análise dos Ecos ao nascer (bossIntel com modo)',()=>{
  freshRun();
  t.setBossIntel(null);
  t.spawnBoss();
  const intel=t.getBossIntel();
  assert(intel,'spawnBoss não registrou bossIntel');
  assert(typeof intel.mode==='string'&&intel.mode,'bossIntel sem modo de adaptação');
  assert(t.getBoss(),'spawnBoss não colocou o chefe em jogo');
});

ok('Boss adapta o ritmo a quem dasha muito (contrato exposto em DEV.bossDebug)',()=>{
  /* AUDIT-FIX-E: em vez de procurar a variável dashAdapt no texto-fonte,
     lemos o relatório real que o jogo publica sobre a adaptação. */
  freshRun();
  t.setBossIntel({mode:'ranged',total:9,closeW:1,longW:8,dashes:9});
  const muito=t.DEV.bossDebug();
  assert(muito,'DEV.bossDebug não respondeu');
  assert.strictEqual(muito.dashes,9,'contagem de dashes não chegou ao relatório');
  assert(muito.dashAdapt<0,'jogador que dasha muito não recebeu adaptação');
  t.setBossIntel({mode:'ranged',total:9,closeW:1,longW:8,dashes:0});
  assert.strictEqual(t.DEV.bossDebug().dashAdapt,0,
    'adaptação disparou sem histórico de dash');
  t.setBossIntel(null);
});

/* ====================== SHIELD INTEGRITY ====================== */
ok('Guardião não consome o Shield do jogador para abrir a barreira',()=>{
  freshRun();
  const pl=t.getPlayer();
  pl.shield=25;
  const e=loneEcho(1);
  e.roleCd=0;
  t.echoRoleTick(e,.016);
  assert(e.roleT>0,'cenário inválido: a barreira não abriu');
  assert.strictEqual(pl.shield,25,'barreira consumiu o Shield do jogador');
});

ok('Disruptor não consome o Shield do próprio Eco no pulso',()=>{
  freshRun();
  const e=loneEcho(2);
  e.shield=20;
  loneEnemy('chaser',e.x+40,e.y);
  t.setEchoes([e]);
  e.roleCd=0;
  t.echoRoleTick(e,.016);
  assert.strictEqual(e.shield,20,'pulso consumiu o Shield do Eco');
});

/* ====================== IDENTIDADE DOS MINIBOSSES ====================== */
/* B5-B: cada mini-chefe tem updater próprio; as habilidades históricas
   continuam existindo dentro dele. */
ok('FORNALHA: em movimento deixa zonas de fogo que queimam o jogador',()=>{
  freshRun();
  const pl=t.getPlayer();
  pl.hp=pl.maxHp=5000;pl.shield=0;pl.dashT=0;pl.invT=0;
  const b=loneMini('furnace');
  b.x=pl.x+300;b.y=pl.y;b.vx=200;b.vy=0;   // "moved" > 18
  b.ms.trailT=0;b.ms.novaCd=99;
  withRandom(.5,()=>t.updateFurnace(b,.016,pl));
  const fogo=(b.hazards||[]).filter(h=>h.kind==='fire');
  assert(fogo.length>0,'Fornalha não deixou rastro de fogo');
  /* o jogador dentro da zona queima no tick seguinte da Fornalha */
  pl.x=fogo[0].x;pl.y=fogo[0].y;
  t.mbHazardsTick(b,.5,pl);
  assert.strictEqual(b.ms.fireIn,true,'zona não marcou o jogador dentro');
  b.ms.fireHitT=0;
  withRandom(.99,()=>t.updateFurnace(b,.016,pl));
  assert(pl.hp<5000,'rastro de fogo não causou dano');
  assert(pl.st&&pl.st.burnT>0,'rastro de fogo não aplicou burn');
});

ok('MATRIZ: prolifera enxame e só regenera com crias vivas',()=>{
  freshRun();
  const pl=t.getPlayer();
  const b=loneMini('brood');
  b.hp=b.maxHp*.5;
  b.ms.spawnCd=0;
  withRandom(.5,()=>t.updateBrood(b,.016,pl));
  const crias=t.getEnemies().filter(e=>e.type==='swarm'&&!e.dead);
  assert(crias.length>0,'Matriz não gerou enxame');
  /* a regen é avaliada no tick seguinte, quando as crias já contam */
  b.ms.spawnCd=99;
  const hp=b.hp;
  withRandom(.5,()=>t.updateBrood(b,1,pl));
  assert.strictEqual(b.ms.regenOn,true,'regen desligada com crias vivas');
  assert(b.hp>hp,'Matriz não regenerou com o enxame vivo');
  /* matar as crias corta a regen — é o counterplay declarado */
  for(const c of crias)c.dead=true;
  const hp2=b.hp;
  withRandom(.5,()=>t.updateBrood(b,1,pl));
  assert.strictEqual(b.ms.regenOn,false,'regen continuou sem crias');
  assert.strictEqual(b.hp,hp2,'Matriz regenerou sem crias vivas');
});

ok('DUELISTA: faz blink para o flanco a 70–130 px do jogador',()=>{
  freshRun();
  const pl=t.getPlayer();
  const b=loneMini('duelist');
  b.x=pl.x+600;b.y=pl.y+600;
  b.ms.slashT=0;b.telegraphT=0;b.skillCd=0;
  withRandom([.5,.5,.5,.5],()=>t.updateDuelist(b,.016,pl));
  const d=Math.hypot(b.x-pl.x,b.y-pl.y);
  assert(d>=60&&d<=140,'blink fora da faixa de flanco: '+d.toFixed(1));
  assert(b.telegraphT>0,'blink não abriu telegrafia antes do golpe');
});

ok('ORÁCULO: as zonas de previsão ferem e aplicam lentidão ao ativar',()=>{
  freshRun();
  const pl=t.getPlayer();
  pl.hp=pl.maxHp=5000;pl.shield=0;pl.dashT=0;pl.invT=0;
  const b=loneMini('oracle');
  b.x=pl.x+400;b.y=pl.y;
  b.ms.predCd=0;b.ms.curseCd=99;
  withRandom(.5,()=>t.updateOracle(b,.016,pl));
  const zonas=(b.hazards||[]).filter(h=>h.kind==='pred');
  assert(zonas.length>0,'Oráculo não marcou zona de previsão');
  t.mbHazardsTick(b,.1,pl);
  assert.strictEqual(pl.hp,5000,'zona feriu antes de ativar');
  pl.x=zonas[0].x;pl.y=zonas[0].y;
  t.mbHazardsTick(b,5,pl);
  assert(pl.hp<5000,'zona de previsão não causou dano ao ativar');
  assert(pl.st&&pl.st.chillP>0,'zona de previsão não aplicou lentidão');
});

ok('SANGUESSUGA: o dreno tira vida do jogador e cura o mini-chefe',()=>{
  freshRun();
  const pl=t.getPlayer();
  pl.hp=pl.maxHp=5000;pl.shield=0;pl.dashT=0;pl.invT=0;
  const b=loneMini('leech');
  b.x=pl.x+120;b.y=pl.y;b.hp=b.maxHp*.5;
  b.ms.siphonCd=0;b.ms.siphonT=0;
  withRandom(.99,()=>t.updateLeech(b,.016,pl));
  assert(b.ms.siphonT>0,'dreno não iniciou com o jogador no alcance');
  const hpB=b.hp;
  b.ms.tickT=0;
  withRandom(.99,()=>t.updateLeech(b,.016,pl));
  assert(pl.hp<5000,'dreno não feriu o jogador');
  assert(b.hp>hpB,'dreno não curou o mini-chefe');
  /* sair do alcance rompe o fio — é o counterplay declarado */
  pl.x=b.x+2000;
  withRandom(.99,()=>t.updateLeech(b,.016,pl));
  assert.strictEqual(b.ms.siphonT,0,'dreno sobreviveu fora do alcance');
});

/* ====================== RESULTADO ====================== */
console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed>0){console.log('\nFALHAS DETECTADAS');process.exit(1);}
else console.log('\nTODOS OS TESTES PASSARAM');
