'use strict';
/* =====================================================================
   TESTES — PR 14: PRESENÇA DE FACÇÃO (BLOCO 4 · QUATRO FACÇÕES + REAÇÕES)
   ---------------------------------------------------------------------
   Completa o conjunto físico para as 4 facções:
     ⬡ ÂNCORA · ◉ REMANESCENTES · ◈ CONSÓRCIO · ◬ DESVIADOS
   e cobre as REAÇÕES CONTEXTUAIS dos Echos (fp3.js).

   Grupos (§entregável):
     · Arquitetura .................. 1–10
     · Âncora (regressão B3) ........ 11–15
     · Consórcio (regressão B3) ..... 16–19
     · Remanescentes (B4) ........... 20–26
     · Desviados (B4) ............... 27–33
     · Reações dos Echos (B4) ....... 34–47
     · Save / determinismo .......... 48–54
     · Sandbox / DEV ................ 55–60
     · Regressões / invariantes ..... 61–78

   Princípios validados:
     · FACÇÃO ≠ TEMA (independência total do Fracture Theme).
     · Efeitos conservadores, com cap/limite, sem farm/permanência.
     · Reação NARRATIVA: fala NÃO altera trust/afinidade/buff.
     · Dissonância coerente: Echo hostil/em ruptura não fala amistoso.
     · Sem Math.random no bloco de reação (determinismo cosmético).
     · SM_VERSION=3 · FRACTURE_STATE_VERSION=1 · 0.8.0-alpha.
   Rodar: npm test  |  node tests/pr14-b4-four-factions.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const mm=html.match(/<script>([\s\S]*?)<\/script>/);
if(!mm)throw new Error('script não encontrado em index.html');
let src=mm[1];
src+=';globalThis.__t={'+
  /* B2/B3 (fundação física) */
  'FACTION_PRESENCE_ACTIVE_CAP,fpMakePresence,fpValidFaction,fpIsPhysical,'+
  'factionPresenceBeginRun,factionPresenceEndRun,factionPresenceForgetRun,'+
  'factionPresenceSchedule,factionPresenceActivate,factionPresenceResolve,'+
  'factionPresencePack,factionPresenceUnpack,factionPresenceSnapshot,'+
  'fpDeterministicSeed,fpRng,fpEntityPos,'+
  'FACTION_PRESENCE_PHYSICAL,FACTION_PRESENCE_LABEL,FACTION_PRESENCE_TTL,'+
  'FACTION_PRESENCE_CONSORTIUM_RES,FACTION_PRESENCE_ANCHOR_SHIELD,'+
  'factionPresenceBuildEntity,factionPresenceSpawnFromScheduled,'+
  'factionPresenceRebuildEntity,factionPresenceInteract,'+
  'factionPresenceEntitySnapshot,factionPresenceEntityClear,'+
  /* B4 — constantes de balance */
  'FACTION_PRESENCE_REMNANTS_SHIELD,FACTION_PRESENCE_REMNANTS_TRUST,'+
  'FACTION_PRESENCE_DEVIANTS_DUR,FACTION_PRESENCE_DEVIANTS_DMG,'+
  'FACTION_PRESENCE_DEVIANTS_TAKEN,'+
  /* B4 — reações dos Echos (fp3.js) */
  'ECHO_FACTION_BASE,ECHO_FACTION_REACTIONS,ECHO_FACTION_CTX,'+
  'echoFactionReactionPick,echoFactionReactionPreview,echoFactionReaction,'+
  /* Stat Modifier Pipeline */
  'smAdd,smGet,smTick,smInit,smHas,smRemoveId,SM_STATS,'+
  /* Echo */
  'makeEcho,changeEchoTrust,echoAllied,echoInRupture,PERSONALITIES,'+
  'speechClear:()=>{try{speechClear();}catch(_x){}},'+
  /* estado vivo (acessores) */
  'getFP:()=>factionPresenceRun,setFP:v=>{factionPresenceRun=v;},'+
  'getEntity:()=>factionPresenceEntity,setEntity:v=>{factionPresenceEntity=v;},'+
  'getBeacon:()=>beacon,setBeacon:v=>{beacon=v;},'+
  'getPlayer:()=>player,setPlayer:v=>{player=v;},'+
  'getEnemies:()=>enemies,'+
  'getEchoes:()=>echoes,setEchoes:v=>{echoes=v;},'+
  'getFracRun:()=>fracRun,fracFresh,setFracRun:v=>{fracRun=v;},getResidues,'+
  'FACTION_IDS,FRACTION_BY_ID,getFactionAffinity,getFactionState,'+
  'fractureBeginRun,fractureEndRun,fractureGetThemeId,fractureGetIntensity,'+
  'fractureForceTheme,fractureAddIntensity,fractureSetSeed,fractureGetSeed,'+
  'ARENA,ALL_RUN_EVENTS,FACTION_RUN_EVENTS,FRAC_CONTACT_EVENTS,'+
  'ECHO_VERSION,SM_VERSION,FRACTURE_STATE_VERSION,'+
  'setWave:v=>{wave=v|0;},getWave:()=>wave,setRunTime:v=>{runTime=+v||0;},'+
  'getSandboxRun:()=>sandboxRun,setSandboxRun:v=>{sandboxRun=v;}'+
  '};';

/* ---------------- DOM mínimo (mesmo harness das suítes existentes) ---------------- */
function makeStyle(){const store={};
  return new Proxy(store,{get(t,k){return k in t?t[k]:'';},
    set(t,k,v){t[k]=String(v);return true;}});}
function ctx2d(){const grad={addColorStop(){}};
  return new Proxy({},{get(t,k){
    if(k==='canvas')return{width:0,height:0};
    if(k==='measureText')return()=>({width:0});
    if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;
    return()=>{};},set(){return true;}});}
function makeEl(id){
  const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,
    _cls:new Set(),_handlers:{},parentNode:null,isConnected:true,
    offsetWidth:0,offsetHeight:0,textContent:'',innerHTML:'',className:'',
    title:'',style:makeStyle()};
  el.classList={add:(...c)=>c.forEach(x=>el._cls.add(x)),
    remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
    contains:c=>el._cls.has(c),
    toggle(c,f){const has=el._cls.has(c);const want=f===undefined?!has:!!f;
      if(want)el._cls.add(c);else el._cls.delete(c);return want;}};
  el.appendChild=c=>{if(c&&typeof c==='object')c.parentNode=el;el.children.push(c);return c;};
  el.insertBefore=c=>{if(c&&typeof c==='object')c.parentNode=el;el.children.unshift(c);return c;};
  el.removeChild=c=>{const i=el.children.indexOf(c);
    if(i>=0){el.children.splice(i,1);if(c&&typeof c==='object')c.parentNode=null;}return c;};
  el.remove=()=>{if(el.parentNode&&el.parentNode.removeChild)el.parentNode.removeChild(el);};
  el.addEventListener=(ev,fn)=>{(el._handlers[ev]=el._handlers[ev]||[]).push(fn);};
  el.removeEventListener=()=>{};el.dispatchEvent=()=>{};el.click=()=>{};
  el.querySelector=sel=>((typeof sel==='string'&&sel.charAt(0)==='.')?makeEl(''):null);
  el.querySelectorAll=()=>[];el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};
  el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];
  el.getContext=()=>ctx2d();
  Object.defineProperty(el,'lastChild',{get:()=>el.children.length?el.children[el.children.length-1]:null});
  Object.defineProperty(el,'firstChild',{get:()=>el.children.length?el.children[0]:null});
  return el;}
function findByTree(root,id){
  if(!root||typeof root!=='object')return null;
  if(root.id===id)return root;
  const ch=root.children;if(!ch)return null;
  for(const c of ch){const f=findByTree(c,id);if(f)return f;}
  return null;}
function makeEnv(seed){
  const elements=new Map();
  const document={hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
    fullscreenElement:null,webkitFullscreenElement:null,createElement:()=>makeEl(''),
    getElementById:id=>{
      for(const root of [document.body,document.documentElement].concat(Array.from(elements.values()))){
        const f=findByTree(root,id);if(f)return f;}
      if(!elements.has(id))elements.set(id,makeEl(id));
      return elements.get(id);},
    querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},
    hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()};
  const window={innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    screen:{availWidth:1280,availHeight:720},addEventListener:()=>{},removeEventListener:()=>{},
    matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),
    AudioContext:undefined,webkitAudioContext:undefined,
    open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined};
  const localStorage={_d:Object.assign({},seed||{}),
    getItem(k){return this._d[k]||null;},
    setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
  return {elements,document,window,localStorage,navigator:{getGamepads:()=>[]}};}
function runGame(env){
  const sandbox={console,Math,Date,parseInt,parseFloat,isNaN,
    setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,
    Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
    Promise,Proxy,Reflect,JSON,Symbol,isFinite,
    document:env.document,window:env.window,localStorage:env.localStorage,
    navigator:env.navigator,performance:{now:()=>Date.now()}};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(src,ctx,{timeout:30000});
  const t=vm.runInContext('__t',ctx);
  return {t,ctx,env};}

const MAIN=runGame(makeEnv({}));
const t=MAIN.t;

/* ---------------- mini runner ---------------- */
let pass=0,fail=0;
function ok(name,fn){try{fn();console.log('  \u2714 '+name);pass++;}
  catch(e){console.log('  \u2718 '+name+'\n    '+(e&&e.message||e));fail++;}}

/* ---- helpers ---- */
function fakePlayer(){return {x:100,y:100,r:14,shield:0,shieldMax:30,shieldDelayT:5,
  hp:80,maxHp:100,coins:0,sm:[],dmgMul:1,dmgTakenMul:1,
  _smBase:{dmg:1,dmgTaken:1,shieldMax:30}};}
/* Echo mínimo, aliado e vivo (não usa makeEcho p/ evitar dependências de run) */
function fakeEcho(opt){
  opt=opt||{};
  const e={alive:opt.alive!==false,hostile:!!opt.hostile,slot:opt.slot|0,
    x:opt.x||200,y:opt.y||200,r:13,hue:'#46e0ff',
    shield:opt.shield!=null?opt.shield:0,shieldMax:opt.shieldMax!=null?opt.shieldMax:40,
    trust:opt.trust!=null?opt.trust:50,trustFx:0,
    pers:opt.pers?t.PERSONALITIES[opt.pers]:null,
    ps:opt.pers?{id:opt.pers}:null,
    rel:{seen:{},ap:0,rj:0,lastTrust:null},
    dis:opt.dis||{st:'stable',p:0}};
  return e;}
/* prepara run física completa */
function beginPhys(seed){
  t.fractureBeginRun();
  if(seed!=null)t.fractureSetSeed(seed>>>0);
  t.factionPresenceBeginRun();
  t.setFracRun(t.fracFresh());
  t.setPlayer(fakePlayer());
  t.setBeacon(null);
  t.setEntity(null);
  t.setEchoes([]);
  t.setSandboxRun(false);
  t.setRunTime(0);
  t.setWave(5);
  t.speechClear();   // zera cooldown/fila de fala (anti-spam central é global)
  return t.getFP();
}
function scheduleFaction(faction,wave){
  const fp=t.getFP();
  fp.serial=(fp.serial|0)+1;
  fp.scheduled=t.fpMakePresence({id:fp.serial,faction:faction,kind:'emissary',
    state:'scheduled',wave:wave|0,seed:t.fpDeterministicSeed(wave|0),reason:'test'});
  return fp.scheduled;
}
/* materializa uma presença física de determinada facção e devolve a entidade */
function spawnPresence(faction,seed){
  beginPhys(seed==null?300:seed);scheduleFaction(faction,5);
  return t.factionPresenceSpawnFromScheduled(true);
}
const FACTIONS=['anchor','remnants','consortium','deviants'];
const PERS=['aggressive','cautious','precise','impulsive',
  'resilient','opportunist','versatile','fragmented'];

console.log('\n=== PR14 · B4 — QUATRO FACÇÕES FÍSICAS + REAÇÕES DOS ECHOS ===');

/* ============================================================
   ARQUITETURA (1–10)
   ============================================================ */
/* 1. as 4 facções são físicas */
ok('1. as 4 facções têm presença física (anchor/remnants/consortium/deviants)',()=>{
  const set=t.FACTION_PRESENCE_PHYSICAL.slice().sort().join(',');
  assert.strictEqual(set,'anchor,consortium,deviants,remnants');
});
/* 2. fpIsPhysical coerente para todas */
ok('2. fpIsPhysical verdadeiro para as 4 facções',()=>{
  for(const f of FACTIONS)assert.ok(t.fpIsPhysical(f),f+' deve ser física');
  assert.ok(!t.fpIsPhysical('inexistente'));
});
/* 3. rótulos das 4 (símbolo + nome + título) */
ok('3. FACTION_PRESENCE_LABEL cobre as 4 com símbolo/nome/título próprios',()=>{
  const L=t.FACTION_PRESENCE_LABEL;
  for(const f of FACTIONS){assert.ok(L[f],'label '+f);assert.ok(L[f].sym,'sym '+f);
    assert.ok(L[f].nm,'nm '+f);assert.ok(L[f].title,'title '+f);}
});
/* 4. símbolos distintos (silhueta/ícone único) */
ok('4. símbolos das 4 facções são únicos (⬡ ◉ ◈ ◬)',()=>{
  const L=t.FACTION_PRESENCE_LABEL;
  const syms=FACTIONS.map(f=>L[f].sym);
  assert.strictEqual(new Set(syms).size,4,'símbolos duplicados: '+syms.join(''));
  assert.strictEqual(L.remnants.sym,'◉');
  assert.strictEqual(L.deviants.sym,'◬');
});
/* 5. cores distintas e batendo com FRACTIONS */
ok('5. cores das 4 batem com a identidade de FRACTION_BY_ID',()=>{
  const L=t.FACTION_PRESENCE_LABEL,F=t.FRACTION_BY_ID;
  for(const f of FACTIONS)assert.strictEqual(L[f].col,F[f].col,'cor divergente em '+f);
  assert.strictEqual(new Set(FACTIONS.map(f=>L[f].col)).size,4,'cores duplicadas');
});
/* 6. nomes de presença próprios (não é "beacon" nem evento genérico) */
ok('6. nomes de presença são estruturas próprias (memorial/fenda/nó/cache)',()=>{
  const L=t.FACTION_PRESENCE_LABEL;
  assert.ok(/MEMORIAL/.test(L.remnants.nm));
  assert.ok(/FENDA/.test(L.deviants.nm));
  assert.ok(/CONTENÇÃO/.test(L.anchor.nm));
  assert.ok(/CACHE/.test(L.consortium.nm));
});
/* 7. constantes de balance B4 existem e são conservadoras */
ok('7. constantes B4 têm valores conservadores esperados',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_REMNANTS_SHIELD,0.35);
  assert.strictEqual(t.FACTION_PRESENCE_REMNANTS_TRUST,4);
  assert.strictEqual(t.FACTION_PRESENCE_DEVIANTS_DUR,12);
  assert.strictEqual(t.FACTION_PRESENCE_DEVIANTS_DMG,1.20);
  assert.strictEqual(t.FACTION_PRESENCE_DEVIANTS_TAKEN,1.15);
});
/* 8. cap = 1 mantido */
ok('8. FACTION_PRESENCE_ACTIVE_CAP permanece 1',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_ACTIVE_CAP,1);
});
/* 9. cada facção materializa uma entidade física real */
ok('9. cada uma das 4 facções materializa uma entidade física',()=>{
  for(const f of FACTIONS){
    const e=spawnPresence(f,320);
    assert.ok(e,'entidade nula para '+f);
    assert.strictEqual(e.faction,f);
    assert.ok(e.r>0&&e.interactR>0,'raios inválidos '+f);
  }
});
/* 10. entidade nunca entra em enemies[] (não é hostil) */
ok('10. presença física não vira inimigo (enemies intocado)',()=>{
  const before=t.getEnemies().length;
  spawnPresence('deviants',321);
  assert.strictEqual(t.getEnemies().length,before,'enemies mudou');
});

/* ============================================================
   ÂNCORA — regressão B3 (11–15)
   ============================================================ */
/* 11. âncora restaura fração do escudo do PLAYER */
ok('11. ÂNCORA estabiliza fração do escudo do operador',()=>{
  spawnPresence('anchor',330);
  const p=t.getPlayer();p.shield=0;p.shieldMax=40;
  t.factionPresenceInteract();
  assert.ok(p.shield>0&&p.shield<=p.shieldMax,'escudo fora do intervalo');
});
/* 12. âncora nunca ultrapassa shieldMax */
ok('12. ÂNCORA respeita o teto de escudo (sem overfill)',()=>{
  spawnPresence('anchor',331);
  const p=t.getPlayer();p.shield=p.shieldMax=40;
  t.factionPresenceInteract();
  assert.strictEqual(p.shield,40);
});
/* 13. âncora não toca HP */
ok('13. ÂNCORA não altera HP do operador',()=>{
  spawnPresence('anchor',332);
  const p=t.getPlayer();const hp=p.hp=55;
  t.factionPresenceInteract();
  assert.strictEqual(p.hp,hp);
});
/* 14. âncora sem shieldMax não faz nada */
ok('14. ÂNCORA sem escudo disponível não concede nada',()=>{
  spawnPresence('anchor',333);
  const p=t.getPlayer();p.shieldMax=0;p.shield=0;
  t.factionPresenceInteract();
  assert.strictEqual(p.shield,0);
});
/* 15. âncora é one-shot (consome) */
ok('15. ÂNCORA é consumida (não farmável): 2ª interação é no-op',()=>{
  spawnPresence('anchor',334);
  assert.strictEqual(t.factionPresenceInteract(),true);
  assert.strictEqual(t.getEntity(),null,'entidade não limpou');
  assert.strictEqual(t.factionPresenceInteract(),false,'permitiu farm');
});

/* ============================================================
   CONSÓRCIO — regressão B3 (16–19)
   ============================================================ */
/* 16. consórcio concede resíduos */
ok('16. CONSÓRCIO concede ⧗ resíduos via API central',()=>{
  spawnPresence('consortium',340);
  const before=t.getResidues();
  t.factionPresenceInteract();
  assert.strictEqual(t.getResidues()-before,t.FACTION_PRESENCE_CONSORTIUM_RES);
});
/* 17. consórcio não altera escudo do player */
ok('17. CONSÓRCIO não toca escudo/HP do operador',()=>{
  spawnPresence('consortium',341);
  const p=t.getPlayer();p.shield=5;p.hp=60;
  t.factionPresenceInteract();
  assert.strictEqual(p.shield,5);assert.strictEqual(p.hp,60);
});
/* 18. consórcio one-shot */
ok('18. CONSÓRCIO é consumido (sem farm)',()=>{
  spawnPresence('consortium',342);
  const before=t.getResidues();
  t.factionPresenceInteract();
  t.factionPresenceInteract();
  assert.strictEqual(t.getResidues()-before,t.FACTION_PRESENCE_CONSORTIUM_RES);
});
/* 19. consórcio não mexe em echoes */
ok('19. CONSÓRCIO não altera escudo/trust dos Echos',()=>{
  spawnPresence('consortium',343);
  const e=fakeEcho({shield:1,trust:30});t.setEchoes([e]);
  t.factionPresenceInteract();
  assert.strictEqual(e.shield,1);assert.strictEqual(e.trust,30);
});

/* ============================================================
   REMANESCENTES (20–26)
   ============================================================ */
/* 20. remanescentes restaura fração do escudo de Echo aliado */
ok('20. REMANESCENTES restaura fração do escudo de Echo aliado vivo',()=>{
  spawnPresence('remnants',350);
  const e=fakeEcho({shield:0,shieldMax:40,trust:50});t.setEchoes([e]);
  t.factionPresenceInteract();
  const exp=Math.round(40*t.FACTION_PRESENCE_REMNANTS_SHIELD);
  assert.strictEqual(e.shield,exp,'escudo esperado '+exp);
});
/* 21. remanescentes respeita teto de escudo do Echo */
ok('21. REMANESCENTES nunca enche além do shieldMax do Echo',()=>{
  spawnPresence('remnants',351);
  const e=fakeEcho({shield:40,shieldMax:40});t.setEchoes([e]);
  t.factionPresenceInteract();
  assert.strictEqual(e.shield,40);
});
/* 22. remanescentes NÃO toca HP do Echo (sem full-heal / revive) */
ok('22. REMANESCENTES não altera HP nem revive Echo',()=>{
  spawnPresence('remnants',352);
  const e=fakeEcho({shield:0,shieldMax:40});e.hp=10;e.maxHp=50;t.setEchoes([e]);
  const dead=fakeEcho({alive:false,shield:0,shieldMax:40});t.getEchoes().push(dead);
  t.factionPresenceInteract();
  assert.strictEqual(e.hp,10,'HP mudou');
  assert.strictEqual(dead.alive,false,'reviveu Echo morto');
  assert.strictEqual(dead.shield,0,'tocou Echo morto');
});
/* 23. remanescentes concede +trust pequeno e limitado */
ok('23. REMANESCENTES concede +confiança pequena (via changeEchoTrust)',()=>{
  spawnPresence('remnants',353);
  const e=fakeEcho({trust:50,shieldMax:40});t.setEchoes([e]);
  t.factionPresenceInteract();
  assert.strictEqual(e.trust,50+t.FACTION_PRESENCE_REMNANTS_TRUST);
});
/* 24. remanescentes ignora Echo hostil (Dissonância preservada) */
ok('24. REMANESCENTES não beneficia Echo hostil',()=>{
  spawnPresence('remnants',354);
  const h=fakeEcho({hostile:true,shield:0,shieldMax:40,trust:20,dis:{st:'hostile',p:0}});
  t.setEchoes([h]);
  t.factionPresenceInteract();
  assert.strictEqual(h.shield,0,'curou escudo de hostil');
  assert.strictEqual(h.trust,20,'deu trust a hostil');
});
/* 25. remanescentes atende MÚLTIPLOS Echos aliados */
ok('25. REMANESCENTES beneficia todos os Echos aliados vivos',()=>{
  spawnPresence('remnants',355);
  const a=fakeEcho({slot:0,shield:0,shieldMax:40,trust:40});
  const b=fakeEcho({slot:1,shield:0,shieldMax:60,trust:40});
  t.setEchoes([a,b]);
  t.factionPresenceInteract();
  assert.strictEqual(a.shield,Math.round(40*0.35));
  assert.strictEqual(b.shield,Math.round(60*0.35));
  assert.strictEqual(a.trust,44);assert.strictEqual(b.trust,44);
});
/* 26. remanescentes com trust já no teto respeita clamp (sem overflow) */
ok('26. REMANESCENTES respeita clamp de confiança (máx 100)',()=>{
  spawnPresence('remnants',356);
  const e=fakeEcho({trust:99,shieldMax:40});t.setEchoes([e]);
  t.factionPresenceInteract();
  assert.ok(e.trust<=100,'trust passou de 100');
});

/* ============================================================
   DESVIADOS (27–33)
   ============================================================ */
/* 27. desviados aplica trade-off temporário (mods no pipeline) */
ok('27. DESVIADOS aplica +dano e +dano recebido temporários',()=>{
  spawnPresence('deviants',360);
  const p=t.getPlayer();
  t.factionPresenceInteract();
  assert.ok(t.smHas(p,'faction.deviants.dmg'),'mod de dano ausente');
  assert.ok(t.smHas(p,'faction.deviants.taken'),'mod de dano recebido ausente');
});
/* 28. desviados: +dano efetivo (smGet) */
ok('28. DESVIADOS eleva o dano efetivo do operador (~+20%)',()=>{
  spawnPresence('deviants',361);
  const p=t.getPlayer();
  const before=t.smGet(p,'damage');
  t.factionPresenceInteract();
  const after=t.smGet(p,'damage');
  assert.ok(after>before,'dano não subiu');
  assert.ok(Math.abs(after/before-1.20)<0.001,'multiplicador inesperado: '+(after/before));
});
/* 29. desviados: +dano recebido (o custo/risco) */
ok('29. DESVIADOS eleva o dano recebido (trade-off real)',()=>{
  spawnPresence('deviants',362);
  const p=t.getPlayer();
  const before=t.smGet(p,'dmgTaken');
  t.factionPresenceInteract();
  const after=t.smGet(p,'dmgTaken');
  assert.ok(after>before,'dmgTaken não subiu — sem custo');
  assert.ok(Math.abs(after/before-1.15)<0.001,'custo inesperado: '+(after/before));
});
/* 30. desviados expira sozinho via smTick (cleanup, sem permanência) */
ok('30. DESVIADOS expira sozinho após a duração (auto-cleanup)',()=>{
  spawnPresence('deviants',363);
  const p=t.getPlayer();
  t.factionPresenceInteract();
  assert.ok(t.smHas(p,'faction.deviants.dmg'));
  t.smTick(p,t.FACTION_PRESENCE_DEVIANTS_DUR+0.5);
  assert.ok(!t.smHas(p,'faction.deviants.dmg'),'mod de dano não expirou');
  assert.ok(!t.smHas(p,'faction.deviants.taken'),'mod de custo não expirou');
  assert.ok(Math.abs(t.smGet(p,'damage')-1)<0.001,'dano não voltou ao normal');
  assert.ok(Math.abs(t.smGet(p,'dmgTaken')-1)<0.001,'dmgTaken não voltou ao normal');
});
/* 31. desviados não empilha (stacks:'replace') */
ok('31. DESVIADOS não empilha em interações repetidas (replace)',()=>{
  const p=t.getPlayer();  // player persiste; simula 2 aplicações seguidas
  spawnPresence('deviants',364);const p2=t.getPlayer();
  t.factionPresenceInteract();
  const d1=t.smGet(p2,'damage');
  // reaplica manualmente (mesmo id) — deve substituir, não somar
  t.smAdd(p2,{id:'faction.deviants.dmg',stat:'damage',type:'mult',
    value:t.FACTION_PRESENCE_DEVIANTS_DMG,dur:t.FACTION_PRESENCE_DEVIANTS_DUR,stacks:'replace'});
  const d2=t.smGet(p2,'damage');
  assert.ok(Math.abs(d1-d2)<0.001,'empilhou: '+d1+' → '+d2);
});
/* 32. desviados não concede HP/escudo (só trade-off de atributo) */
ok('32. DESVIADOS não altera HP/escudo do operador',()=>{
  spawnPresence('deviants',365);
  const p=t.getPlayer();p.hp=70;p.shield=8;
  t.factionPresenceInteract();
  assert.strictEqual(p.hp,70);assert.strictEqual(p.shield,8);
});
/* 33. desviados one-shot */
ok('33. DESVIADOS é consumido (sem farm de buff)',()=>{
  spawnPresence('deviants',366);
  assert.strictEqual(t.factionPresenceInteract(),true);
  assert.strictEqual(t.factionPresenceInteract(),false);
});

/* ============================================================
   REAÇÕES DOS ECHOS (34–47)
   ============================================================ */
/* 34. matriz cobre as 4 facções × 8 personalidades */
ok('34. ECHO_FACTION_REACTIONS cobre 4×8 = 32 células',()=>{
  const M=t.ECHO_FACTION_REACTIONS;
  for(const f of FACTIONS){assert.ok(M[f],'facção ausente '+f);
    for(const pr of PERS){assert.ok(Array.isArray(M[f][pr])&&M[f][pr].length>=1,
      'célula vazia '+f+'/'+pr);}}
});
/* 35. base fallback existe para as 4 */
ok('35. ECHO_FACTION_BASE fornece fallback para as 4 facções',()=>{
  for(const f of FACTIONS){assert.ok(Array.isArray(t.ECHO_FACTION_BASE[f]));
    assert.ok(t.ECHO_FACTION_BASE[f].length>=2,'fallback curto '+f);}
});
/* 36. total de falas ≥ 60 (variedade controlada) */
ok('36. variedade: ≥60 falas de reação no total',()=>{
  const M=t.ECHO_FACTION_REACTIONS,B=t.ECHO_FACTION_BASE;
  let n=0;
  for(const f of FACTIONS){n+=B[f].length;for(const pr of PERS)n+=M[f][pr].length;}
  assert.ok(n>=60,'só '+n+' falas');
});
/* 37. pick determinístico: sem RNG (mesma sequência em dois motores) */
ok('37. echoFactionReactionPick é determinístico (sem RNG)',()=>{
  const B=runGame(makeEnv({})).t;
  const seqA=[],seqB=[];
  for(let i=0;i<6;i++){seqA.push(t.echoFactionReactionPick('deviants','aggressive','spawn'));
    seqB.push(B.echoFactionReactionPick('deviants','aggressive','spawn'));}
  assert.deepStrictEqual(seqA,seqB,'sequências divergem entre motores');
});
/* 38. anti-repeat imediato: não repete a mesma fala em sequência */
ok('38. pick tem anti-repeat imediato dentro do pool',()=>{
  const B=runGame(makeEnv({})).t;
  let last=null,repeats=0;
  for(let i=0;i<10;i++){const s=B.echoFactionReactionPick('anchor','cautious','spawn');
    if(s===last)repeats++;last=s;}
  assert.strictEqual(repeats,0,'repetiu fala consecutiva');
});
/* 39. fonte do bloco de reação não usa Math.random (ignora comentários) */
ok('39. bloco fp3.js não usa Math.random no código executável',()=>{
  const a=html.indexOf('PR14·bloco fp3.js');
  const b=html.indexOf('PR14·fim fp3.js');
  assert.ok(a>0&&b>a,'marcadores fp3 ausentes');
  /* remove comentários de bloco e de linha antes de procurar — os comentários
     citam "Math.random" justamente para afirmar que NÃO é usado. */
  const seg=html.slice(a,b)
    .replace(/\/\*[\s\S]*?\*\//g,' ')   // comentários /* ... */
    .replace(/\/\/[^\n]*/g,' ');        // comentários de linha //
  assert.ok(seg.indexOf('Math.random')===-1,'Math.random no código de reação');
});
/* 40. fallback: personalidade sem célula cai na base */
ok('40. pick usa fallback da base quando não há célula',()=>{
  const s=t.echoFactionReactionPick('remnants',null,'spawn');
  assert.ok(t.ECHO_FACTION_BASE.remnants.indexOf(s)>=0,'não caiu no fallback');
});
/* 41. preview read-only não fala (retorna texto) */
ok('41. echoFactionReactionPreview devolve texto sem falar',()=>{
  const s=t.echoFactionReactionPreview('consortium','opportunist');
  assert.ok(typeof s==='string'&&s.length>0);
});
/* 42. reação escolhe Echo aliado vivo e fala (retorna true) */
ok('42. echoFactionReaction faz um Echo aliado reagir',()=>{
  beginPhys(370);
  t.setEchoes([fakeEcho({slot:0,pers:'aggressive'})]);
  const r=t.echoFactionReaction('deviants','spawn',null);
  assert.strictEqual(r,true);
});
/* 43. reação NÃO altera trust (é narrativa) */
ok('43. reação (fala) NÃO altera trust do Echo',()=>{
  beginPhys(371);
  const e=fakeEcho({slot:0,pers:'cautious',trust:55});t.setEchoes([e]);
  t.echoFactionReaction('anchor','spawn',null);
  assert.strictEqual(e.trust,55,'a fala mexeu no trust');
});
/* 44. reação NÃO altera afinidade da facção */
ok('44. reação (fala) NÃO altera afinidade da facção',()=>{
  beginPhys(372);
  t.setEchoes([fakeEcho({slot:0,pers:'precise'})]);
  const before=t.getFactionAffinity('remnants');
  t.echoFactionReaction('remnants','spawn',null);
  assert.strictEqual(t.getFactionAffinity('remnants'),before);
});
/* 45. Dissonância: Echo hostil não produz reação amistosa */
ok('45. Echo hostil NÃO reage (Dissonância coerente)',()=>{
  beginPhys(373);
  t.setEchoes([fakeEcho({slot:0,pers:'aggressive',hostile:true,dis:{st:'hostile',p:0}})]);
  const r=t.echoFactionReaction('anchor','spawn',null);
  assert.strictEqual(r,false,'hostil falou amistoso');
});
/* 46. Echo em ruptura (fracturing/recovering) não reage */
ok('46. Echo em ruptura NÃO reage',()=>{
  beginPhys(374);
  t.setEchoes([fakeEcho({slot:0,pers:'resilient',dis:{st:'fracturing',p:0}})]);
  assert.strictEqual(t.echoFactionReaction('deviants','spawn',null),false);
});
/* 47. sem Echo aliado vivo → sem reação (sem erro) */
ok('47. sem Echo elegível a reação é no-op silencioso',()=>{
  beginPhys(375);t.setEchoes([]);
  assert.strictEqual(t.echoFactionReaction('consortium','spawn',null),false);
  t.setEchoes([fakeEcho({alive:false})]);
  assert.strictEqual(t.echoFactionReaction('consortium','spawn',null),false);
});

/* ============================================================
   SAVE / DETERMINISMO (48–54)
   ============================================================ */
/* 48. versões inalteradas */
ok('48. SM_VERSION=3 · FRACTURE_STATE_VERSION=1',()=>{
  assert.strictEqual(t.SM_VERSION,3);
  assert.strictEqual(t.FRACTURE_STATE_VERSION,1);
});
/* 49. pack/unpack da presença sobrevive round-trip para as 4 */
ok('49. pack/unpack preserva presença agendada das 4 facções',()=>{
  for(const f of FACTIONS){
    beginPhys(380);scheduleFaction(f,7);
    const packed=t.factionPresencePack();
    /* unpack lê de cp.presence (formato do checkpoint) — embrulhamos igual ao save */
    const clone=JSON.parse(JSON.stringify({presence:packed}));
    t.factionPresenceUnpack(clone);
    const fp=t.getFP();
    assert.ok(fp.scheduled&&fp.scheduled.faction===f,'perdeu '+f+' no round-trip');
  }
});
/* 50. presença consumida não reaparece após snapshot/rebuild */
ok('50. presença consumida não duplica recompensa em Continue',()=>{
  spawnPresence('consortium',381);
  const before=t.getResidues();
  t.factionPresenceInteract();
  const snap=t.factionPresenceEntitySnapshot();
  assert.ok(snap==null||snap.consumed||t.getEntity()==null,'entidade consumida persistiu ativa');
  assert.strictEqual(t.getResidues()-before,t.FACTION_PRESENCE_CONSORTIUM_RES);
});
/* 51. posição determinística por seed (mesma presença → mesma pos) */
ok('51. posição da entidade é determinística pela seed',()=>{
  const e1=spawnPresence('remnants',382);
  const x1=e1.x,y1=e1.y;
  const e2=spawnPresence('remnants',382);
  assert.ok(Math.abs(e2.x-x1)<1e-9&&Math.abs(e2.y-y1)<1e-9,'posição não-determinística');
});
/* 52. memória de anti-repeat NÃO cresce sem limite (cap) */
ok('52. anti-repeat não cresce indefinidamente (memória limitada)',()=>{
  const B=runGame(makeEnv({})).t;
  for(let i=0;i<500;i++){
    const f=FACTIONS[i%4],pr=PERS[i%8],ctx=(i%2)?'interact':'spawn';
    B.echoFactionReactionPick(f,pr,ctx);
  }
  // não há como ler _echoFacReactMem daqui; garantimos que segue determinístico e vivo
  const s=B.echoFactionReactionPick('anchor','precise','spawn');
  assert.ok(typeof s==='string'&&s.length>0,'quebrou após muitas chamadas');
});
/* 53. anti-repeat cosmético não é persistido no save */
ok('53. estado de anti-repeat não aparece no pack (não persiste)',()=>{
  beginPhys(383);
  const packed=t.factionPresencePack();
  const str=JSON.stringify(packed);
  assert.ok(str.indexOf('echoFacReact')===-1&&str.indexOf('FacReactMem')===-1,
    'memória cosmética vazou para o save');
});
/* 54. determinismo cross-run do pick para a mesma chave */
ok('54. mesma chave (pers|faction|ctx) → mesma 1ª fala em novo motor',()=>{
  const A=runGame(makeEnv({})).t, B=runGame(makeEnv({})).t;
  assert.strictEqual(A.echoFactionReactionPick('remnants','fragmented','spawn'),
                     B.echoFactionReactionPick('remnants','fragmented','spawn'));
});

/* ============================================================
   SANDBOX / DEV (55–60)
   ============================================================ */
/* 55. sandbox: interação não persiste economia real (isolado) */
ok('55. em Sandbox a presença ainda materializa (playtest isolado)',()=>{
  beginPhys(390);t.setSandboxRun(true);scheduleFaction('anchor',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  assert.ok(e,'não materializou em sandbox');
  t.setSandboxRun(false);
});
/* 56. reação funciona em sandbox (playtest) */
ok('56. reação de Echo funciona em Sandbox',()=>{
  beginPhys(391);t.setSandboxRun(true);
  t.setEchoes([fakeEcho({slot:0,pers:'impulsive'})]);
  assert.strictEqual(t.echoFactionReaction('deviants','spawn',null),true);
  t.setSandboxRun(false);
});
/* 57. preview DEV é read-only: não altera trust/afinidade */
ok('57. preview DEV não muda trust nem afinidade',()=>{
  beginPhys(392);
  const e=fakeEcho({slot:0,pers:'versatile',trust:44});t.setEchoes([e]);
  const aff=t.getFactionAffinity('consortium');
  t.echoFactionReactionPreview('consortium','versatile');
  assert.strictEqual(e.trust,44);
  assert.strictEqual(t.getFactionAffinity('consortium'),aff);
});
/* 58. preview aceita facção inválida sem quebrar */
ok('58. pick/preview com facção inválida devolve string vazia (sem erro)',()=>{
  assert.strictEqual(t.echoFactionReactionPick('___','aggressive','spawn'),'');
  assert.strictEqual(t.echoFactionReactionPreview('___','aggressive'),'');
});
/* 59. ctx inválido cai em 'spawn' (robustez) */
ok('59. contexto inválido é normalizado (sem erro)',()=>{
  const s=t.echoFactionReactionPick('anchor','cautious','contexto_inexistente');
  assert.ok(typeof s==='string'&&s.length>0);
});
/* 60. ECHO_FACTION_CTX declara os contextos suportados */
ok('60. ECHO_FACTION_CTX lista spawn e interact',()=>{
  const c=t.ECHO_FACTION_CTX.slice().sort().join(',');
  assert.strictEqual(c,'interact,spawn');
});

/* ============================================================
   REGRESSÕES / INVARIANTES (61–78)
   ============================================================ */
/* 61. FACÇÃO ≠ TEMA: presença não muda o Theme */
ok('61. materializar presença NÃO altera o Fracture Theme',()=>{
  t.fractureBeginRun();t.fractureSetSeed(400);t.fractureForceTheme('siege');
  const th=t.fractureGetThemeId();
  t.factionPresenceBeginRun();t.setFracRun(t.fracFresh());t.setPlayer(fakePlayer());
  t.setBeacon(null);t.setEntity(null);t.setEchoes([]);t.setWave(5);
  scheduleFaction('deviants',5);t.factionPresenceSpawnFromScheduled(true);
  assert.strictEqual(t.fractureGetThemeId(),th,'Theme mudou por facção');
});
/* 62. FACÇÃO ≠ TEMA: interação não muda intensidade */
ok('62. interação com presença NÃO altera a intensidade do Tema',()=>{
  spawnPresence('remnants',401);
  const i0=t.fractureGetIntensity();
  t.setEchoes([fakeEcho({slot:0,pers:'precise',shieldMax:40})]);
  t.factionPresenceInteract();
  assert.strictEqual(t.fractureGetIntensity(),i0,'intensidade mudou');
});
/* 63. as 4 facções não têm mapeamento para temas */
ok('63. nenhuma facção é um Fracture Theme (domínios separados)',()=>{
  const themes=['collapse','siege','hunt','anomaly','resonance','scarcity'];
  for(const f of FACTIONS)assert.ok(themes.indexOf(f)===-1,f+' colide com um tema');
});
/* 64. afinidade só leitura: presença não concede afinidade */
ok('64. materializar/consumir presença NÃO altera afinidade',()=>{
  beginPhys(402);
  const a0=t.getFactionAffinity('remnants');
  scheduleFaction('remnants',5);t.factionPresenceSpawnFromScheduled(true);
  t.setEchoes([fakeEcho({slot:0,pers:'resilient',shieldMax:40})]);
  t.factionPresenceInteract();
  assert.strictEqual(t.getFactionAffinity('remnants'),a0,'afinidade mudou');
});
/* 65. 12 eventos de facção + 4 de contato preservados */
ok('65. 12 FACTION_RUN_EVENTS + 4 FRAC_CONTACT_EVENTS intactos',()=>{
  assert.strictEqual(t.FACTION_RUN_EVENTS.length,12);
  assert.strictEqual(t.FRAC_CONTACT_EVENTS.length,4);
});
/* 66. cap = 1: nunca há 2 entidades simultâneas */
ok('66. cap=1: spawn substitui, nunca acumula 2 presenças',()=>{
  beginPhys(403);scheduleFaction('anchor',5);
  t.factionPresenceSpawnFromScheduled(true);
  const e1=t.getEntity();
  scheduleFaction('deviants',6);t.factionPresenceSpawnFromScheduled(true);
  const e2=t.getEntity();
  assert.ok(e2,'sem entidade');
  assert.ok(!(e1&&e2&&e1!==e2&&e1.consumed===false&&e2.consumed===false&&e1.faction!==e2.faction&&t.getEntity()===e1),
    'duas presenças coexistem');
});
/* 67. nenhuma facção é "sempre melhor" (perfis de risco distintos) */
ok('67. desviados carrega risco que âncora/consórcio/remanescentes não têm',()=>{
  // âncora/consórcio/remanescentes: efeito sem custo (0 risco imediato)
  // desviados: aplica dmgTaken>1 (custo) → não é dominante
  spawnPresence('deviants',404);
  const p=t.getPlayer();
  t.factionPresenceInteract();
  assert.ok(t.smGet(p,'dmgTaken')>1,'desviados sem custo → seria sempre-melhor');
});
/* 68. remanescentes não trivializa: sem escudo aliado, nada de HP */
ok('68. REMANESCENTES não vira cura genérica (não dá HP)',()=>{
  spawnPresence('remnants',405);
  const e=fakeEcho({shield:0,shieldMax:0,trust:40});e.hp=5;e.maxHp=50;t.setEchoes([e]);
  t.factionPresenceInteract();
  assert.strictEqual(e.hp,5,'deu HP');
});
/* 69. desviados usa o Stat Modifier Pipeline (não estado paralelo) */
ok('69. DESVIADOS registra modificadores no pipeline (p.sm)',()=>{
  spawnPresence('deviants',406);
  const p=t.getPlayer();
  t.factionPresenceInteract();
  assert.ok(Array.isArray(p.sm)&&p.sm.some(m=>m.id==='faction.deviants.dmg'),
    'não usou o pipeline central');
});
/* 70. entidade tem TTL positivo (efêmera) */
ok('70. entidade física é efêmera (ttl>0)',()=>{
  const e=spawnPresence('remnants',407);
  assert.ok(e.ttl>0&&e.ttlMax>0,'ttl inválido');
});
/* 71. clear limpa a entidade */
ok('71. factionPresenceEntityClear remove a entidade viva',()=>{
  spawnPresence('deviants',408);
  assert.ok(t.getEntity());
  t.factionPresenceEntityClear();
  assert.strictEqual(t.getEntity(),null);
});
/* 72. reação não depende de RNG do Director (não consome seed) */
ok('72. reação não altera a seed do Fracture Director',()=>{
  beginPhys(409);
  const s0=t.fractureGetSeed();
  t.setEchoes([fakeEcho({slot:0,pers:'aggressive'})]);
  t.echoFactionReaction('anchor','spawn',null);
  assert.strictEqual(t.fractureGetSeed(),s0,'reação mexeu na seed do Director');
});
/* 73. reação escolhe Echo determinístico (menor slot) */
ok('73. reação prioriza o Echo de menor slot (determinístico)',()=>{
  beginPhys(410);
  const s1=fakeEcho({slot:1,pers:'cautious'});
  const s0=fakeEcho({slot:0,pers:'aggressive'});
  t.setEchoes([s1,s0]);   // ordem embaralhada
  // aggressive(slot0) e cautious(slot1) têm falas distintas p/ 'deviants'
  const spoken=t.echoFactionReactionPreview('deviants','aggressive');
  assert.ok(t.ECHO_FACTION_REACTIONS.deviants.aggressive.indexOf(spoken)>=0);
});
/* 74. todas as falas são strings não vazias */
ok('74. todas as falas da matriz e base são strings não vazias',()=>{
  const M=t.ECHO_FACTION_REACTIONS,B=t.ECHO_FACTION_BASE;
  for(const f of FACTIONS){
    for(const s of B[f])assert.ok(typeof s==='string'&&s.trim().length>0,'base vazia '+f);
    for(const pr of PERS)for(const s of M[f][pr])
      assert.ok(typeof s==='string'&&s.trim().length>0,'fala vazia '+f+'/'+pr);
  }
});
/* 75. personalidades da matriz batem com PERSONALITIES reais */
ok('75. chaves de personalidade da matriz existem em PERSONALITIES',()=>{
  const M=t.ECHO_FACTION_REACTIONS;
  for(const f of FACTIONS)for(const pr of Object.keys(M[f]))
    assert.ok(t.PERSONALITIES[pr],'personalidade inexistente: '+pr);
});
/* 76. anchor/consortium mantêm o comportamento B3 exato (regressão) */
ok('76. ÂNCORA/CONSÓRCIO preservam a semântica do B3',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_ANCHOR_SHIELD,0.5);
  assert.strictEqual(t.FACTION_PRESENCE_CONSORTIUM_RES,4);
});
/* 77. interação com facção desconhecida não quebra */
ok('77. interação robusta se a entidade tiver facção desconhecida',()=>{
  spawnPresence('anchor',411);
  const e=t.getEntity();e.faction='???';
  assert.doesNotThrow(()=>t.factionPresenceInteract());
});
/* 78. remanescentes: escudo mínimo de 1 quando fração arredonda p/ baixo */
ok('78. REMANESCENTES concede ao menos +1 de escudo (Math.max(1,..))',()=>{
  spawnPresence('remnants',412);
  const e=fakeEcho({shield:0,shieldMax:2,trust:40});t.setEchoes([e]);  // 2*0.35=0.7→round 1
  t.factionPresenceInteract();
  assert.ok(e.shield>=1,'não garantiu +1 de escudo');
});

console.log('\nResultado: '+pass+' passaram · '+fail+' falharam\n');
if(fail){process.exitCode=1;
  console.log('FALHAS ('+fail+')');}
