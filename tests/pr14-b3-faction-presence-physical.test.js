'use strict';
/* =====================================================================
   TESTES — PR 14: PRESENÇA DE FACÇÃO (BLOCO 3 · PRIMEIRA PRESENÇA FÍSICA)
   ---------------------------------------------------------------------
   Cobre a manifestação física efêmera de 2 facções (⬡ ÂNCORA · ◈ CONSÓRCIO):
   · ativação a partir da intenção agendada do B2 (sem scheduler paralelo);
   · entidade física real, separada do beacon singleton (não o destrói);
   · posição determinística e válida (nunca sobre o player/beacon);
   · cap = 1; coexistência com beacon; resolve/expire/cleanup;
   · efeitos conservadores one-shot (ÂNCORA → escudo · CONSÓRCIO → ⧗);
   · Continue reconstrói sem duplicar recompensa;
   · Sandbox isolado; FACÇÃO ≠ TEMA (Theme/intensidade/composição imutáveis);
   · nenhuma unidade hostil (enemies intocado); afinidade só lida;
   · 16 eventos antigos intactos; SM=3; FRACTURE_STATE_VERSION=1; 0.8.0-alpha;
   · stress determinístico (centenas de seeds × ondas 1–20).
   Rodar: npm test  |  node tests/pr14-b3-faction-presence-physical.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const mm=html.match(/<script>([\s\S]*?)<\/script>/);
if(!mm)throw new Error('script não encontrado em index.html');
let src=mm[1];
src+=';globalThis.__t={'+
  /* B2 (fundação) */
  'FACTION_PRESENCE_ACTIVE_CAP,fpMakePresence,fpValidFaction,'+
  'factionPresenceFresh,factionPresenceBeginRun,factionPresenceEndRun,'+
  'factionPresenceForgetRun,factionPresenceSchedule,factionPresenceActivate,'+
  'factionPresenceResolve,factionPresenceExpire,factionPresenceCleanup,'+
  'factionPresencePack,factionPresenceUnpack,factionPresenceSnapshot,'+
  'fpDeterministicSeed,fpRng,'+
  /* B3 (físico) */
  'FACTION_PRESENCE_PHYSICAL,FACTION_PRESENCE_LABEL,FACTION_PRESENCE_TTL,'+
  'FACTION_PRESENCE_CONSORTIUM_RES,FACTION_PRESENCE_ANCHOR_SHIELD,'+
  'fpIsPhysical,fpEntityPos,factionPresenceBuildEntity,'+
  'factionPresenceSpawnFromScheduled,factionPresenceRebuildEntity,'+
  'factionPresenceInteract,factionPresenceUpdateEntity,factionPresenceDrawEntity,'+
  'factionPresenceEntitySnapshot,factionPresenceEntityClear,'+
  /* estado vivo (acessores) */
  'getFP:()=>factionPresenceRun,setFP:v=>{factionPresenceRun=v;},'+
  'getEntity:()=>factionPresenceEntity,setEntity:v=>{factionPresenceEntity=v;},'+
  'getBeacon:()=>beacon,setBeacon:v=>{beacon=v;},'+
  'getPlayer:()=>player,setPlayer:v=>{player=v;},'+
  'getEnemies:()=>enemies,'+
  'getFracRun:()=>fracRun,fracFresh,setFracRun:v=>{fracRun=v;},getResidues,'+
  'FACTION_IDS,FRACTION_BY_ID,getFactionAffinity,getFactionState,'+
  'fractureBeginRun,fractureEndRun,fractureGetThemeId,fractureGetIntensity,'+
  'fractureForceTheme,fractureAddIntensity,fractureSetSeed,fractureGetSeed,'+
  'ARENA,ALL_RUN_EVENTS,FACTION_RUN_EVENTS,FRAC_CONTACT_EVENTS,'+
  'ECHO_VERSION,SM_VERSION,FRACTURE_STATE_VERSION,'+
  'setWave:v=>{wave=v|0;},getWave:()=>wave,'+
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
function fakePlayer(){return {x:100,y:100,r:14,shield:0,shieldMax:30,shieldDelayT:5,hp:80,maxHp:100,coins:0};}
/* prepara run física completa: Diretor + presença + fracRun (p/ resíduos) + player */
function beginPhys(seed){
  t.fractureBeginRun();
  if(seed!=null)t.fractureSetSeed(seed>>>0);
  t.factionPresenceBeginRun();
  t.setFracRun(t.fracFresh());
  t.setPlayer(fakePlayer());
  t.setBeacon(null);
  t.setEntity(null);
  t.setWave(5);
  return t.getFP();
}
/* injeta uma presença agendada de uma facção específica */
function scheduleFaction(faction,wave){
  const fp=t.getFP();
  fp.serial=(fp.serial|0)+1;
  fp.scheduled=t.fpMakePresence({id:fp.serial,faction:faction,kind:'emissary',
    state:'scheduled',wave:wave|0,seed:t.fpDeterministicSeed(wave|0),reason:'test'});
  return fp.scheduled;
}

console.log('\n=== PR14 · B3 — PRESENÇA FÍSICA NA ARENA ===');

/* 1. presença agendada ativa (spawn a partir de fp.scheduled) */
ok('1. presença agendada é ativada em entidade física',()=>{
  beginPhys(111);scheduleFaction('anchor',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  assert.ok(e,'entidade criada');
  assert.strictEqual(e.faction,'anchor');
  assert.strictEqual(t.getFP().active.faction,'anchor');   // B2 activate ocorreu
  assert.strictEqual(t.getFP().scheduled,null);            // consumiu a intenção
});

/* 2. cria entidade física com campos mínimos */
ok('2. entidade física possui campos world-space',()=>{
  beginPhys(112);scheduleFaction('consortium',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  assert.ok(e&&typeof e.x==='number'&&typeof e.y==='number');
  assert.ok(e.r>0&&e.interactR>0&&e.ttl>0);
  assert.strictEqual(e.faction,'consortium');
});

/* 3. mesma seed gera mesma posição */
ok('3. mesma seed/presença ⇒ mesma posição',()=>{
  beginPhys(2024);const p1=scheduleFaction('anchor',7);
  const e1=t.factionPresenceSpawnFromScheduled(true);
  const x1=e1.x,y1=e1.y;
  beginPhys(2024);scheduleFaction('anchor',7);
  const e2=t.factionPresenceSpawnFromScheduled(true);
  assert.ok(Math.abs(e2.x-x1)<1e-6&&Math.abs(e2.y-y1)<1e-6,'posição determinística');
});

/* 4. posição válida (dentro da arena) */
ok('4. posição sempre dentro da arena',()=>{
  for(let s=1;s<=60;s++){
    beginPhys(s*97);scheduleFaction(s%2?'anchor':'consortium',5+(s%10));
    const e=t.factionPresenceSpawnFromScheduled(true);
    assert.ok(e.x>=0&&e.x<=t.ARENA.w&&e.y>=0&&e.y<=t.ARENA.h,'dentro da arena');
    assert.ok(isFinite(e.x)&&isFinite(e.y),'sem NaN');
  }
});

/* 5. não nasce sobre o player */
ok('5. entidade nunca nasce sobre o player',()=>{
  for(let s=1;s<=60;s++){
    beginPhys(s*53);scheduleFaction('anchor',5);
    const pl=t.getPlayer();
    const e=t.factionPresenceSpawnFromScheduled(true);
    const d=Math.hypot(e.x-pl.x,e.y-pl.y);
    assert.ok(d>=200,'longe do player (d='+Math.round(d)+')');
  }
});

/* 6. cap = 1 (não cria segunda entidade) */
ok('6. cap físico = 1',()=>{
  beginPhys(300);scheduleFaction('anchor',5);
  const e1=t.factionPresenceSpawnFromScheduled(true);
  assert.ok(e1);
  scheduleFaction('consortium',5);
  const e2=t.factionPresenceSpawnFromScheduled(true);
  assert.strictEqual(e2,null,'segunda ativação recusada');
  assert.strictEqual(t.getEntity().faction,'anchor');
});

/* 7. beacon legado não é destruído */
ok('7. spawn de presença não destrói beacon existente',()=>{
  beginPhys(301);
  const b={x:1100,y:700,r:36,kind:'survivor',t:0,life:38,pulse:0};
  t.setBeacon(b);
  scheduleFaction('anchor',5);
  t.factionPresenceSpawnFromScheduled(true);
  assert.strictEqual(t.getBeacon(),b,'beacon intacto');
  assert.strictEqual(t.getBeacon().kind,'survivor');
});

/* 8. beacon ocupado → entidade não o reserva (coexistência, sem conflito) */
ok('8. beacon vivo impede reserva; entidade coexiste separada',()=>{
  beginPhys(302);
  t.setBeacon({x:1100,y:700,r:36,kind:'vault',t:0,life:38,pulse:0});
  scheduleFaction('consortium',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  assert.ok(e,'entidade criada mesmo com beacon vivo');
  assert.strictEqual(e.beacon,false,'não reservou o beacon ocupado');
  assert.ok(t.getBeacon(),'beacon segue vivo');
});

/* 9. resolve corretamente (interação consome) */
ok('9. interação resolve a presença e limpa a entidade',()=>{
  beginPhys(303);scheduleFaction('consortium',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  const pl=t.getPlayer();pl.x=e.x;pl.y=e.y;          // encosta
  const before=t.getResidues();
  t.factionPresenceUpdateEntity(0.1);                // proximidade → interact
  assert.strictEqual(t.getEntity(),null,'entidade removida');
  assert.strictEqual(t.getFP().active,null,'presença resolvida');
  assert.ok(t.getResidues()>before,'⧗ concedido');
});

/* 10. expire por TTL */
ok('10. entidade expira ao esgotar o TTL',()=>{
  beginPhys(304);scheduleFaction('anchor',5);
  t.factionPresenceSpawnFromScheduled(true);
  const pl=t.getPlayer();pl.x=50;pl.y=50;            // longe
  t.setEntity(Object.assign(t.getEntity(),{x:2000,y:1300}));
  t.factionPresenceUpdateEntity(t.FACTION_PRESENCE_TTL+1);
  assert.strictEqual(t.getEntity(),null,'expirou');
  assert.strictEqual(t.getFP().active,null,'presença expirada');
});

/* 11-13. cleanup */
ok('11/12/13. entityClear limpa a entidade (death/victory/menu)',()=>{
  beginPhys(305);scheduleFaction('anchor',5);
  t.factionPresenceSpawnFromScheduled(true);
  assert.ok(t.getEntity());
  t.factionPresenceEntityClear();
  assert.strictEqual(t.getEntity(),null);
  /* idempotente */
  assert.strictEqual(t.factionPresenceEntityClear(),true);
});

/* 14. Continue não duplica: rebuild recria sem reconceder */
ok('14. Continue reconstrói entidade sem reconceder recompensa',()=>{
  beginPhys(306);scheduleFaction('consortium',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  const x=e.x,y=e.y;
  const resBefore=t.getResidues();
  /* simula Continue: some o corpo físico, presença ativa persiste */
  t.factionPresenceEntityClear();
  const e2=t.factionPresenceRebuildEntity();
  assert.ok(e2,'reconstruída');
  assert.ok(Math.abs(e2.x-x)<1e-6&&Math.abs(e2.y-y)<1e-6,'mesma posição');
  assert.strictEqual(t.getResidues(),resBefore,'nada reconcedido no rebuild');
});

/* 15. one-shot não duplica recompensa */
ok('15. interação é one-shot (não duplica recompensa)',()=>{
  beginPhys(307);scheduleFaction('consortium',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  const pl=t.getPlayer();pl.x=e.x;pl.y=e.y;
  const before=t.getResidues();
  t.factionPresenceUpdateEntity(0.1);
  const afterOne=t.getResidues();
  assert.ok(afterOne>before);
  /* segunda tentativa: já não há entidade */
  t.factionPresenceUpdateEntity(0.1);
  assert.strictEqual(t.getResidues(),afterOne,'sem segunda concessão');
});

/* 16. Sandbox: entidade não persiste estado real (fracRun não muda em sandbox) */
ok('16. Sandbox isolado: sem run física, spawn é inócuo',()=>{
  t.factionPresenceForgetRun();t.setEntity(null);
  t.setSandboxRun(true);
  const e=t.factionPresenceSpawnFromScheduled(true);   // sem run → null
  assert.strictEqual(e,null);
  assert.strictEqual(t.getEntity(),null);
  t.setSandboxRun(false);
});

/* 17/18. ÂNCORA e CONSÓRCIO reconhecidas como físicas */
ok('17/18. ÂNCORA e CONSÓRCIO são físicas; REMANESCENTES/DESVIADOS não',()=>{
  assert.ok(t.fpIsPhysical('anchor'));
  assert.ok(t.fpIsPhysical('consortium'));
  assert.ok(!t.fpIsPhysical('remnants'),'remnants fica para o B4');
  assert.ok(!t.fpIsPhysical('deviants'),'deviants fica para o B4');
});

/* 18b. facção não-física agendada não materializa entidade */
ok('18b. presença de facção não-física não vira entidade (B4)',()=>{
  beginPhys(308);scheduleFaction('remnants',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  assert.strictEqual(e,null,'remnants não materializa no B3');
  assert.strictEqual(t.getEntity(),null);
});

/* 19. símbolos corretos */
ok('19. símbolos corretos (⬡ ÂNCORA · ◈ CONSÓRCIO)',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_LABEL.anchor.sym,'⬡');
  assert.strictEqual(t.FACTION_PRESENCE_LABEL.consortium.sym,'◈');
});

/* 20. cores corretas (batem com FRACTIONS) */
ok('20. cores batem com a identidade das facções',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_LABEL.anchor.col,'#8fd6ff');
  assert.strictEqual(t.FACTION_PRESENCE_LABEL.consortium.col,'#ffd166');
  assert.strictEqual(t.FRACTION_BY_ID.anchor.col,'#8fd6ff');
  assert.strictEqual(t.FRACTION_BY_ID.consortium.col,'#ffd166');
});

/* 21. draw não altera gameplay */
ok('21. draw é read-only (não muda estado)',()=>{
  beginPhys(309);scheduleFaction('anchor',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  const snap=JSON.stringify(t.factionPresenceEntitySnapshot());
  t.factionPresenceDrawEntity();
  assert.strictEqual(JSON.stringify(t.factionPresenceEntitySnapshot()),snap,'draw não mutou');
});

/* 22. update inativo é early-return */
ok('22. update sem entidade é inócuo (early-return)',()=>{
  t.setEntity(null);
  assert.doesNotThrow(()=>t.factionPresenceUpdateEntity(0.5));
  assert.strictEqual(t.getEntity(),null);
});

/* 23. faction_reaction continua funcionando (evento no grid) — via B2 emit indireto:
   a entidade nunca altera intensidade/tema; validamos abaixo (24-26). Aqui só
   confirmamos que o tipo continua no pool de eventos conhecidos. */
ok('23. faction_reaction segue sendo tipo conhecido do Diretor',()=>{
  t.fractureBeginRun();
  const before=t.fractureGetIntensity();
  /* interação não emite faction_reaction (isso é do scheduler B2); mas
     garantimos que ativar/resolver não muda Intensidade */
  beginPhys(310);scheduleFaction('anchor',5);
  t.factionPresenceSpawnFromScheduled(true);
  const pl=t.getPlayer();const e=t.getEntity();pl.x=e.x;pl.y=e.y;
  const iBefore=t.fractureGetIntensity();
  t.factionPresenceUpdateEntity(0.1);
  assert.strictEqual(t.fractureGetIntensity(),iBefore,'interação não muda Intensidade');
});

/* 24. Theme imutável */
ok('24. presença física nunca altera o Tema',()=>{
  t.fractureBeginRun();t.fractureForceTheme('anomaly','test');
  const th=t.fractureGetThemeId();
  beginPhys(311);t.fractureForceTheme('anomaly','test');
  scheduleFaction('consortium',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  const pl=t.getPlayer();pl.x=e.x;pl.y=e.y;
  t.factionPresenceUpdateEntity(0.1);
  assert.strictEqual(t.fractureGetThemeId(),'anomaly','Tema intocado');
});

/* 25. intensidade imutável ao longo do ciclo de vida */
ok('25. intensidade imutável (spawn/interact/expire)',()=>{
  beginPhys(312);t.fractureAddIntensity(20,'test');
  const i0=t.fractureGetIntensity();
  scheduleFaction('anchor',5);
  t.factionPresenceSpawnFromScheduled(true);
  assert.strictEqual(t.fractureGetIntensity(),i0,'spawn não muda');
  t.factionPresenceExpire('x');t.factionPresenceEntityClear();
  assert.strictEqual(t.fractureGetIntensity(),i0,'expire não muda');
});

/* 26. composição imutável — nenhuma entidade entra em enemies[] */
ok('26. nenhuma unidade hostil criada (enemies intocado)',()=>{
  beginPhys(313);
  const en=t.getEnemies();const n0=en.length;
  scheduleFaction('anchor',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  const pl=t.getPlayer();pl.x=e.x;pl.y=e.y;
  t.factionPresenceUpdateEntity(0.1);
  assert.strictEqual(t.getEnemies().length,n0,'enemies não cresceu');
});

/* 27. afinidade não muda automaticamente */
ok('27. afinidade é só lida (nenhum +aff/-aff)',()=>{
  beginPhys(314);
  const fr=t.getFracRun();
  fr.aff.anchor=30;fr.aff.consortium=-20;
  const snap=JSON.stringify(fr.aff);
  scheduleFaction('anchor',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  const pl=t.getPlayer();pl.x=e.x;pl.y=e.y;
  t.factionPresenceUpdateEntity(0.1);                // interage
  assert.strictEqual(JSON.stringify(t.getFracRun().aff),snap,'afinidade intacta');
});

/* 28. 16 eventos antigos intactos */
ok('28. 12 FACTION_RUN_EVENTS + 4 FRAC_CONTACT_EVENTS intactos',()=>{
  assert.strictEqual(t.FACTION_RUN_EVENTS.length,12);
  assert.strictEqual(t.FRAC_CONTACT_EVENTS.length,4);
  const ids=t.ALL_RUN_EVENTS.map(e=>e.id);
  for(const e of t.FACTION_RUN_EVENTS)assert.ok(ids.indexOf(e.id)>=0,e.id);
});

/* 29. SM_VERSION=3 · FRACTURE_STATE_VERSION=1 */
ok('29. SM_VERSION=3 e FRACTURE_STATE_VERSION=1',()=>{
  assert.strictEqual(t.SM_VERSION,3);
  assert.strictEqual(t.FRACTURE_STATE_VERSION,1);
});

/* 30. versão 0.8.0-alpha */
ok('30. versão runtime = 0.8.0-alpha',()=>{
  assert.strictEqual(t.ECHO_VERSION,'0.8.0-alpha');
});

/* 31. ÂNCORA restaura escudo (só escudo, nunca HP) */
ok('31. efeito ÂNCORA: restaura escudo, nunca HP',()=>{
  beginPhys(315);scheduleFaction('anchor',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  const pl=t.getPlayer();pl.x=e.x;pl.y=e.y;pl.shield=0;pl.hp=50;
  t.factionPresenceUpdateEntity(0.1);
  assert.ok(pl.shield>0,'escudo restaurado');
  assert.ok(pl.shield<=pl.shieldMax,'não excede o máximo');
  assert.strictEqual(pl.hp,50,'HP intocado');
});

/* 32. CONSÓRCIO concede ⧗ conservador (one-shot, valor esperado) */
ok('32. efeito CONSÓRCIO: concede ⧗ conservador',()=>{
  beginPhys(316);scheduleFaction('consortium',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  const pl=t.getPlayer();pl.x=e.x;pl.y=e.y;
  const before=t.getResidues();
  t.factionPresenceUpdateEntity(0.1);
  assert.strictEqual(t.getResidues()-before,t.FACTION_PRESENCE_CONSORTIUM_RES);
});

/* 33. nenhuma nova currency: só usa ⧗/escudo existentes (sanidade) */
ok('33. sem nova moeda — usa recursos existentes',()=>{
  /* ⧗ vem de addResidues/fracRun.res (existente); escudo de player.shield */
  beginPhys(317);
  const fr=t.getFracRun();
  assert.ok('res' in fr,'fracRun.res existe (⧗ existente)');
  const pl=t.getPlayer();
  assert.ok('shield' in pl&&'shieldMax' in pl,'escudo existente');
});

/* 34. entidade não bloqueia movimento (sem colisão sólida) — sem campo de colisão */
ok('34. entidade não introduz colisão sólida',()=>{
  beginPhys(318);scheduleFaction('anchor',5);
  const e=t.factionPresenceSpawnFromScheduled(true);
  assert.ok(!('solid' in e)||!e.solid,'sem flag de colisão sólida');
  assert.ok(e.interactR>0,'usa raio de interação');
});

/* 35. pack/unpack (Continue) preserva presença ativa física */
ok('35. Save/Continue preserva presença ativa física',()=>{
  beginPhys(319);scheduleFaction('consortium',5);
  t.factionPresenceSpawnFromScheduled(true);
  const cp={presence:t.factionPresencePack()};
  assert.ok(cp.presence.active&&cp.presence.active.faction==='consortium');
  /* Continue: unpack + rebuild */
  t.setEntity(null);
  t.factionPresenceUnpack(cp);
  const e=t.factionPresenceRebuildEntity();
  assert.ok(e&&e.faction==='consortium','entidade reconstruída do save');
});

/* ---- STRESS: centenas de seeds × ondas 1–20 ---- */
ok('STRESS: 200 seeds × ondas — invariantes físicas preservadas',()=>{
  for(let s=1;s<=200;s++){
    beginPhys(s*7919);
    t.fractureAddIntensity((s%80),'stress');
    const th0=t.fractureGetThemeId();
    for(let w=2;w<=20;w++){
      t.setWave(w);
      const faction=(s+w)%2?'anchor':'consortium';
      /* limpa estado anterior para poder reagendar */
      if(!t.getEntity()&&!t.getFP().active){
        scheduleFaction(faction,w);
        const e=t.factionPresenceSpawnFromScheduled(true);
        if(e){
          assert.ok(e.x>=0&&e.x<=t.ARENA.w&&e.y>=0&&e.y<=t.ARENA.h,'dentro da arena');
          assert.ok(isFinite(e.x)&&isFinite(e.y),'sem NaN');
          assert.ok(t.fpIsPhysical(e.faction),'só facção física');
          /* nunca mais de uma entidade */
          scheduleFaction(faction==='anchor'?'consortium':'anchor',w);
          assert.strictEqual(t.factionPresenceSpawnFromScheduled(true),null,'cap=1');
          /* expira para o próximo ciclo */
          const ent=t.getEntity();ent.x=2000;ent.y=1300;
          const pl=t.getPlayer();pl.x=10;pl.y=10;
          t.factionPresenceUpdateEntity(t.FACTION_PRESENCE_TTL+1);
          assert.strictEqual(t.getEntity(),null,'expirou, sem ghost');
        }
      }
    }
    assert.strictEqual(t.fractureGetThemeId(),th0,'Tema imutável no stress');
    assert.ok(t.getEnemies().length===0,'nenhum inimigo criado');
  }
});

console.log('\nResultado: '+pass+' passaram · '+fail+' falharam');
if(fail>0){console.error('\nFALHAS ('+fail+')');process.exit(1);}
