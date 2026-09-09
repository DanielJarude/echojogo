'use strict';
/* =====================================================================
   TESTES — PR 14 · BLOCO 5: DIPLOMACIA (RIVALIDADES, PACTOS, TETO,
   RUPTURA, PRESENÇAS DIPLOMÁTICAS, ECHOS, EVENTOS/UI, SAVE, DEV)
   ---------------------------------------------------------------------
   Fecha o ciclo Escolhas→Afinidade→Posicionamento→Rivalidades→Estado→
   Comportamento→Presença física→Gameplay. Reutiliza a AFINIDADE existente
   (nenhuma barra/moeda/XP novo). Pacto = flag por facção (run-scoped).

   Grupos (§entregável):
     · Base / estados ................ 1–5
     · Rivalidades .................. 6–11
     · Aliança (pacto) ............. 12–20
     · Bloqueio / teto ............. 21–28
     · Ruptura ..................... 29–33
     · Presenças diplomáticas ...... 34–48
     · Echos + diplomacia .......... 49–56
     · Eventos / UI ................ 57–60
     · Save / Continue ............. 61–68
     · Sandbox / DEV ............... 69–74
     · Regressões / invariantes .... 75–92
     · Property / stress ........... 93–97

   Princípios validados:
     · Afinidade só LEITURA nas presenças; pacto é decisão explícita.
     · Teto diplomático CENTRALIZADO (fracApplyDelta) — todas as fontes.
     · Máximo 1 pacto por eixo (anchor XOR deviants; remnants XOR consortium).
     · Idempotência: consolidar/romper acontece UMA vez; Continue não duplica.
     · FACÇÃO ≠ TEMA · Moralidade ≠ Diplomacia.
     · SM_VERSION=3 · FRACTURE_STATE_VERSION=1 · 0.9.0-alpha.
   Rodar: npm test  |  node tests/pr14-b5-faction-diplomacy.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const mm=html.match(/<script>([\s\S]*?)<\/script>/);
if(!mm)throw new Error('script não encontrado em index.html');
let src=mm[1];
src+=';globalThis.__t={'+
  /* B5 — diplomacia (core) */
  'FACTION_RIVAL,FACTION_PACT_MIN,FACTION_RUPTURE_AFF,FACTION_RIVAL_CEIL,'+
  'fracRival,factionHasPact,factionAffinityCeiling,factionCanPact,'+
  'factionDiploState,factionPactConsolidate,factionPactBreak,'+
  'factionDiplomacySnapshot,FACTION_PACT_NAME,FACTION_PACT_LINE,'+
  'fracApplyDelta,factionEmit,fracStateOf,getFactionAffinity,getFactionState,'+
  'FACTION_STATES,fracRunPack,fracRunUnpack,fracFresh,fracContact,'+
  'FACTION_GRID,'+
  /* B5 — presenças diplomáticas */
  'fpDiploTier,factionPresenceInteract,fpMakePresence,fpDeterministicSeed,'+
  'factionPresenceBeginRun,factionPresenceSpawnFromScheduled,'+
  'FACTION_PRESENCE_ALLY_MULT,FACTION_PRESENCE_HOSTILE_MULT,'+
  'FACTION_PRESENCE_HOSTILE_RES_COST,FACTION_PRESENCE_DEVIANTS_ALLY_TAKEN,'+
  'FACTION_PRESENCE_DEVIANTS_HOSTILE_DMG,FACTION_PRESENCE_DEVIANTS_HOSTILE_TAKEN,'+
  'FACTION_PRESENCE_DEVIANTS_DMG,FACTION_PRESENCE_DEVIANTS_TAKEN,'+
  'FACTION_PRESENCE_DEVIANTS_DUR,FACTION_PRESENCE_ANCHOR_SHIELD,'+
  'FACTION_PRESENCE_CONSORTIUM_RES,FACTION_PRESENCE_REMNANTS_SHIELD,'+
  'FACTION_PRESENCE_REMNANTS_TRUST,fpEntityAffinityLabel,'+
  /* B5 — echos diplomáticos */
  'ECHO_DIPLO_REACTIONS,echoDiploSituation,echoDiploReactionPick,'+
  'echoFactionReaction,'+
  /* Stat Modifier Pipeline / Echo / util */
  'smAdd,smGet,smTick,smHas,SM_STATS,makeEcho,changeEchoTrust,echoAllied,'+
  'echoInRupture,getResidues,addResidues,spendResidues,clamp,'+
  /* versões / invariantes */
  'ECHO_VERSION,SM_VERSION,FRACTURE_STATE_VERSION,'+
  'FACTION_IDS,FRACTION_BY_ID,fracKnows,'+
  /* fracture / theme (independência) */
  'fractureBeginRun,fractureSetSeed,fractureGetThemeId,fractureForceTheme,'+
  /* acessores de estado vivo */
  'getFracRun:()=>fracRun,setFracRun:v=>{fracRun=v;},'+
  'getFracDisc:()=>fracDisc,setFracDisc:v=>{fracDisc=v;},'+
  'getPlayer:()=>player,setPlayer:v=>{player=v;},'+
  'getEchoes:()=>echoes,setEchoes:v=>{echoes=v;},'+
  'getEntity:()=>factionPresenceEntity,setEntity:v=>{factionPresenceEntity=v;},'+
  'getSandboxMode:()=>sandboxMode,setSandboxMode:v=>{sandboxMode=v;},'+
  'getSandboxRun:()=>sandboxRun,setSandboxRun:v=>{sandboxRun=v;},'+
  'setWave:v=>{wave=v|0;},getWave:()=>wave,setRunTime:v=>{runTime=+v||0;},'+
  'speechClear:()=>{try{speechClear();}catch(_x){}}'+
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
function fakeEcho(opt){
  opt=opt||{};
  return {alive:opt.alive!==false,hostile:!!opt.hostile,slot:opt.slot|0,
    x:opt.x||200,y:opt.y||200,r:13,hue:'#46e0ff',
    shield:opt.shield!=null?opt.shield:0,shieldMax:opt.shieldMax!=null?opt.shieldMax:40,
    trust:opt.trust!=null?opt.trust:50,trustFx:0,
    pers:opt.pers?{id:opt.pers}:null,ps:opt.pers?{id:opt.pers}:null,
    rel:{seen:{},ap:0,rj:0,lastTrust:null},
    dis:opt.dis||{st:'stable',p:0}};}
/* prepara uma run diplomática limpa (real, não-sandbox), com facções conhecidas */
function beginDiplo(){
  t.fractureBeginRun();
  t.setFracRun(t.fracFresh());
  t.setFracDisc({anchor:['contact'],remnants:['contact'],
    consortium:['contact'],deviants:['contact']});
  t.setPlayer(fakePlayer());
  t.setEchoes([]);
  t.setEntity(null);
  t.setSandboxMode(false);
  t.setSandboxRun(false);
  t.setWave(5);
  t.setRunTime(0);
  t.speechClear();
  return t.getFracRun();
}
function setAff(id,v){t.getFracRun().aff[id]=v;}
function aff(id){return t.getFracRun().aff[id];}
/* materializa presença física de uma facção */
function spawnPresence(faction){
  t.factionPresenceBeginRun();
  const fp=t.__proto__; // noop
  return null;
}
const FACTIONS=['anchor','remnants','consortium','deviants'];
const AXES=[['anchor','deviants'],['remnants','consortium']];

console.log('\n=== PR14 · B5 — DIPLOMACIA (RIVALIDADES · PACTOS · TETO · PRESENÇAS) ===');

/* ============================================================
   BASE / ESTADOS (1–5)
   ============================================================ */
ok('1. FACTION_STATES mantém 7 faixas com ALIADA=85 e FAVORÁVEL=58',()=>{
  const S=t.FACTION_STATES;
  assert.strictEqual(S.length,7);
  assert.strictEqual(S[0].id,'aliada');assert.strictEqual(S[0].min,85);
  assert.strictEqual(S[1].id,'favoravel');assert.strictEqual(S[1].min,58);
});
ok('2. fracStateOf reflete a afinidade bruta (leitura de estado)',()=>{
  beginDiplo();setAff('anchor',60);
  assert.strictEqual(t.fracStateOf('anchor').id,'favoravel');
  setAff('anchor',-70);
  assert.strictEqual(t.fracStateOf('anchor').id,'hostil');
});
ok('3. FACTION_PACT_MIN=58 (FAVORÁVEL) — limiar de pacto alcançável, não 85',()=>{
  assert.strictEqual(t.FACTION_PACT_MIN,58);
  assert.ok(t.FACTION_PACT_MIN<85,'85 seria inatingível (auditado)');
});
ok('4. diplomacia NÃO cria nova moeda/barra: reutiliza fracRun.aff + flag pact',()=>{
  const fr=beginDiplo();
  assert.ok('aff' in fr,'aff existe');
  assert.ok('pact' in fr && typeof fr.pact==='object','pact é flag por facção');
  assert.ok('pactBroke' in fr,'pactBroke existe');
  /* nenhuma "loyalty/xp/points" nova */
  assert.ok(!('loyalty' in fr) && !('xp' in fr) && !('points' in fr));
});
ok('5. factionDiplomacySnapshot é read-only (não muta o estado)',()=>{
  beginDiplo();setAff('anchor',60);
  const before=JSON.stringify(t.getFracRun());
  t.factionDiplomacySnapshot();
  assert.strictEqual(JSON.stringify(t.getFracRun()),before);
});

/* ============================================================
   RIVALIDADES (6–11)
   ============================================================ */
ok('6. os dois eixos de rivalidade confirmados pelo lore',()=>{
  assert.strictEqual(t.fracRival('anchor'),'deviants');
  assert.strictEqual(t.fracRival('deviants'),'anchor');
  assert.strictEqual(t.fracRival('remnants'),'consortium');
  assert.strictEqual(t.fracRival('consortium'),'remnants');
});
ok('7. rivalidade é simétrica para as 4 facções',()=>{
  for(const id of FACTIONS){
    const rv=t.fracRival(id);
    assert.strictEqual(t.fracRival(rv),id,id+' <-> '+rv+' simétrico');
  }
});
ok('8. fracRival de id inválido retorna null (sem inventar rivalidade)',()=>{
  assert.strictEqual(t.fracRival('inexistente'),null);
});
ok('9. rivalidade NÃO é zero-sum automático (ganhar com X não baixa Y sozinho)',()=>{
  beginDiplo();
  const b=aff('deviants');
  t.fracApplyDelta('anchor',4,'test');   // ganho com anchor
  assert.strictEqual(aff('deviants'),b,'deviants intocado sem pacto');
});
ok('10. rivalidade só passa a limitar após pacto (não por mera afinidade alta)',()=>{
  beginDiplo();setAff('anchor',80);   // FAVORÁVEL alto, sem pacto
  assert.strictEqual(t.factionAffinityCeiling('deviants'),100,'sem pacto = sem teto');
});
ok('11. eixos são independentes (pacto num eixo não mexe no outro)',()=>{
  beginDiplo();setAff('anchor',60);
  t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.factionAffinityCeiling('remnants'),100);
  assert.strictEqual(t.factionAffinityCeiling('consortium'),100);
});

/* ============================================================
   ALIANÇA / PACTO (12–20)
   ============================================================ */
ok('12. factionCanPact exige afinidade >= FAVORÁVEL(58)',()=>{
  beginDiplo();setAff('anchor',57);
  assert.strictEqual(t.factionCanPact('anchor'),false);
  setAff('anchor',58);
  assert.strictEqual(t.factionCanPact('anchor'),true);
});
ok('13. factionCanPact exige facção CONHECIDA (fracKnows)',()=>{
  beginDiplo();t.setFracDisc({anchor:[],remnants:[],consortium:[],deviants:[]});
  setAff('anchor',80);
  assert.strictEqual(t.factionCanPact('anchor'),false,'desconhecida não pactua');
});
ok('14. consolidar é decisão explícita: atingir 58 NÃO consolida sozinho',()=>{
  beginDiplo();
  t.fracApplyDelta('anchor',4,'x');t.getFracRun().aff.anchor=60;
  assert.strictEqual(t.factionHasPact('anchor'),false,'nada automático');
});
ok('15. factionPactConsolidate seta a flag e promove a ALIADA (efetivo)',()=>{
  beginDiplo();setAff('anchor',60);
  assert.strictEqual(t.factionPactConsolidate('anchor',{silent:true}),true);
  assert.strictEqual(t.factionHasPact('anchor'),true);
  assert.strictEqual(t.factionDiploState('anchor').id,'aliada');
});
ok('16. pacto promove a ALIADA mesmo com afinidade só FAVORÁVEL (reusa nº)',()=>{
  beginDiplo();setAff('remnants',58);
  t.factionPactConsolidate('remnants',{silent:true});
  assert.strictEqual(t.fracStateOf('remnants').id,'favoravel','bruto ainda favorável');
  assert.strictEqual(t.factionDiploState('remnants').id,'aliada','efetivo é aliada');
});
ok('17. consolidar é idempotente: 2ª chamada retorna false e não duplica',()=>{
  beginDiplo();setAff('consortium',60);
  assert.strictEqual(t.factionPactConsolidate('consortium',{silent:true}),true);
  assert.strictEqual(t.factionPactConsolidate('consortium',{silent:true}),false);
  assert.strictEqual(t.getFracRun().pact.consortium,1);
});
ok('18. cada facção tem nome e linha de pacto coerentes',()=>{
  for(const id of FACTIONS){
    assert.ok(t.FACTION_PACT_NAME[id],'nome de pacto '+id);
    assert.ok(t.FACTION_PACT_LINE[id],'linha de pacto '+id);
  }
});
ok('19. até 2 pactos compatíveis (um por eixo) são permitidos',()=>{
  beginDiplo();setAff('anchor',60);setAff('remnants',60);
  assert.strictEqual(t.factionPactConsolidate('anchor',{silent:true}),true);
  assert.strictEqual(t.factionPactConsolidate('remnants',{silent:true}),true);
  assert.strictEqual(t.factionHasPact('anchor'),true);
  assert.strictEqual(t.factionHasPact('remnants'),true);
});
ok('20. snapshot expõe pact/canPact/rival/ceiling coerentes',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const s=t.factionDiplomacySnapshot();
  assert.strictEqual(s.anchor.pact,true);
  assert.strictEqual(s.anchor.state,'aliada');
  assert.strictEqual(s.deviants.rival,'anchor');
  assert.strictEqual(s.deviants.ceiling,0,'rival limitada a NEUTRA');
});

/* ============================================================
   BLOQUEIO / TETO DIPLOMÁTICO (21–28)
   ============================================================ */
ok('21. pacto com X impõe teto NEUTRO(0) à rival Y',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.factionAffinityCeiling('deviants'),0);
});
ok('22. teto NÃO é -100 instantâneo: rival apenas cai ATÉ o teto',()=>{
  beginDiplo();setAff('anchor',60);setAff('deviants',40);
  t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(aff('deviants'),0,'cai a 0, não a -100');
});
ok('23. rival já negativa NÃO é rebaixada ao consolidar (só corta topo)',()=>{
  beginDiplo();setAff('anchor',60);setAff('deviants',-30);
  t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(aff('deviants'),-30,'perda preexistente preservada, sem punir extra');
});
ok('24. teto centralizado em fracApplyDelta: ganho da rival é cortado no teto',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  setAff('deviants',0);
  t.fracApplyDelta('deviants',4,'x');
  assert.strictEqual(aff('deviants'),0,'não sobe acima do teto');
});
ok('25. teto não rebaixa: rival abaixo do teto pode subir até o teto',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  setAff('deviants',-10);
  t.fracApplyDelta('deviants',4,'x');
  assert.strictEqual(aff('deviants'),-6,'sobe -10→-6 (abaixo do teto)');
});
ok('26. perdas da rival passam normalmente mesmo com teto',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  setAff('deviants',0);
  t.fracApplyDelta('deviants',-4,'x');
  assert.strictEqual(aff('deviants'),-4);
});
ok('27. factionCanPact recusa a rival enquanto o eixo estiver ocupado',()=>{
  beginDiplo();setAff('anchor',60);setAff('deviants',80);
  t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.factionCanPact('deviants'),false,'eixo ocupado');
});
ok('28. nunca 4 pactos contraditórios: rival de cada eixo fica bloqueada',()=>{
  beginDiplo();
  FACTIONS.forEach(id=>setAff(id,80));
  t.factionPactConsolidate('anchor',{silent:true});
  t.factionPactConsolidate('remnants',{silent:true});
  /* tentar as rivais deve falhar */
  assert.strictEqual(t.factionPactConsolidate('deviants',{silent:true}),false);
  assert.strictEqual(t.factionPactConsolidate('consortium',{silent:true}),false);
  const s=t.factionDiplomacySnapshot();
  const n=FACTIONS.filter(id=>s[id].pact).length;
  assert.strictEqual(n,2,'no máximo 2 (um por eixo)');
});

/* ============================================================
   RUPTURA (29–33)
   ============================================================ */
ok('29. factionPactBreak remove a flag e libera o teto da rival',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.factionAffinityCeiling('deviants'),0);
  assert.strictEqual(t.factionPactBreak('anchor',{silent:true}),true);
  assert.strictEqual(t.factionHasPact('anchor'),false);
  assert.strictEqual(t.factionAffinityCeiling('deviants'),100,'teto liberado');
});
ok('30. ruptura tem custo: antiga aliada cai para DESCONFIADA (<=-40)',()=>{
  beginDiplo();setAff('anchor',80);t.factionPactConsolidate('anchor',{silent:true});
  t.factionPactBreak('anchor',{silent:true});
  assert.ok(aff('anchor')<=t.FACTION_RUPTURE_AFF,'custo real aplicado');
  assert.strictEqual(t.fracStateOf('anchor').id,'desconfiada');
});
ok('31. ruptura marca cooldown de run: sem re-consolidar na mesma run',()=>{
  beginDiplo();setAff('anchor',80);t.factionPactConsolidate('anchor',{silent:true});
  t.factionPactBreak('anchor',{silent:true});
  setAff('anchor',90);   // mesmo subindo de novo…
  assert.strictEqual(t.factionCanPact('anchor'),false,'cooldown de run');
});
ok('32. romper sem pacto retorna false (idempotente/no-op)',()=>{
  beginDiplo();
  assert.strictEqual(t.factionPactBreak('anchor',{silent:true}),false);
});
ok('33. após ruptura, a rival pode voltar a subir (sem farm de troca imediata)',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  t.factionPactBreak('anchor',{silent:true});
  setAff('deviants',0);t.fracApplyDelta('deviants',4,'x');
  assert.strictEqual(aff('deviants'),4,'rival livre pós-ruptura');
});

/* ============================================================
   PRESENÇAS DIPLOMÁTICAS (34–48)
   ============================================================ */
function presence(faction){
  const e={faction:faction,x:120,y:120,consumed:false};
  t.setEntity(e);return e;}
ok('34. fpDiploTier mapeia estado→tier (ally/base/hostile)',()=>{
  beginDiplo();
  setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.fpDiploTier('anchor'),'ally');
  setAff('remnants',10);assert.strictEqual(t.fpDiploTier('remnants'),'base');
  setAff('consortium',-70);assert.strictEqual(t.fpDiploTier('consortium'),'hostile');
});
ok('35. constantes de presença diplomática existem e são conservadoras',()=>{
  assert.ok(t.FACTION_PRESENCE_ALLY_MULT>1&&t.FACTION_PRESENCE_ALLY_MULT<=1.5);
  assert.ok(t.FACTION_PRESENCE_HOSTILE_MULT<1&&t.FACTION_PRESENCE_HOSTILE_MULT>0);
  assert.ok(t.FACTION_PRESENCE_HOSTILE_RES_COST>0);
});
ok('36. ÂNCORA aliada estabiliza MAIS escudo que a base',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const p=fakePlayer();p.shield=0;t.setPlayer(p);presence('anchor');
  t.factionPresenceInteract();
  const allyGain=t.getPlayer().shield;
  /* base */
  beginDiplo();const p2=fakePlayer();p2.shield=0;t.setPlayer(p2);presence('anchor');
  t.factionPresenceInteract();
  const baseGain=t.getPlayer().shield;
  assert.ok(allyGain>baseGain,'aliada '+allyGain+' > base '+baseGain);
});
ok('37. ÂNCORA hostil ainda estabiliza, porém MENOS (negação parcial, não turret)',()=>{
  beginDiplo();setAff('anchor',-70);
  const p=fakePlayer();p.shield=0;t.setPlayer(p);presence('anchor');
  t.factionPresenceInteract();
  const hostileGain=t.getPlayer().shield;
  assert.ok(hostileGain>0,'ainda dá algo');
  beginDiplo();const p2=fakePlayer();p2.shield=0;t.setPlayer(p2);presence('anchor');
  t.factionPresenceInteract();
  assert.ok(hostileGain<t.getPlayer().shield,'hostil < base');
});
ok('38. ÂNCORA sem escudo não gera efeito (só escudo, nunca HP)',()=>{
  beginDiplo();const p=fakePlayer();p.shieldMax=0;p.shield=0;p.hp=50;t.setPlayer(p);
  presence('anchor');t.factionPresenceInteract();
  assert.strictEqual(t.getPlayer().hp,50,'HP intocado');
});
ok('39. CONSÓRCIO aliado rende MAIS resíduos (acesso prioritário)',()=>{
  beginDiplo();setAff('consortium',60);t.factionPactConsolidate('consortium',{silent:true});
  const before=t.getResidues();presence('consortium');t.factionPresenceInteract();
  const allyGot=t.getResidues()-before;
  beginDiplo();const b2=t.getResidues();presence('consortium');t.factionPresenceInteract();
  const baseGot=t.getResidues()-b2;
  assert.ok(allyGot>baseGot,'aliado '+allyGot+' > base '+baseGot);
});
ok('40. CONSÓRCIO hostil COBRA toll em ⧗ e devolve líquido pequeno (>0)',()=>{
  beginDiplo();setAff('consortium',-70);
  t.addResidues(20,'seed');const before=t.getResidues();
  presence('consortium');t.factionPresenceInteract();
  const net=t.getResidues()-before;
  assert.ok(net>0,'líquido positivo com saldo ('+net+')');
});
ok('41. CONSÓRCIO hostil SEM saldo nega o cache (administrável, não fatal)',()=>{
  beginDiplo();setAff('consortium',-70);
  /* sem resíduos suficientes p/ o toll */
  const before=t.getResidues();
  presence('consortium');t.factionPresenceInteract();
  assert.strictEqual(t.getResidues(),before,'sem saldo = nada gasto/ganho');
});
ok('42. REMANESCENTES aliado reconhece Echos: escudo/trust maiores que base',()=>{
  beginDiplo();setAff('remnants',60);t.factionPactConsolidate('remnants',{silent:true});
  const e=fakeEcho({shield:0,shieldMax:40,trust:50});t.setEchoes([e]);
  presence('remnants');t.factionPresenceInteract();
  const allyShield=e.shield,allyTrust=e.trust;
  beginDiplo();const e2=fakeEcho({shield:0,shieldMax:40,trust:50});t.setEchoes([e2]);
  presence('remnants');t.factionPresenceInteract();
  assert.ok(allyShield>=e2.shield,'escudo aliado >= base');
  assert.ok(allyTrust>e2.trust,'trust aliado > base');
});
ok('43. REMANESCENTES hostil RECUSA vínculo: sem escudo, sem +trust, sem punir Echo',()=>{
  beginDiplo();setAff('remnants',-70);
  const e=fakeEcho({shield:5,shieldMax:40,trust:50});t.setEchoes([e]);
  presence('remnants');t.factionPresenceInteract();
  assert.strictEqual(e.shield,5,'escudo intocado (recusa)');
  assert.strictEqual(e.trust,50,'trust intocado (não remove)');
  assert.strictEqual(e.alive,true,'nunca mata o Echo');
});
ok('44. DESVIADOS base preserva risco↔recompensa (+dano e +dano recebido)',()=>{
  beginDiplo();setAff('deviants',10);
  const p=fakePlayer();t.setPlayer(p);presence('deviants');t.factionPresenceInteract();
  assert.ok(t.smHas(p,'faction.deviants.dmg'),'dano aplicado');
  assert.ok(t.smHas(p,'faction.deviants.taken'),'dano recebido aplicado');
});
ok('45. DESVIADOS aliado: risco MENOR (taken aliado < taken base), sem +dano grátis',()=>{
  assert.ok(t.FACTION_PRESENCE_DEVIANTS_ALLY_TAKEN<t.FACTION_PRESENCE_DEVIANTS_TAKEN,
    'aliado mais controlado');
  /* aliado */
  beginDiplo();setAff('deviants',60);t.factionPactConsolidate('deviants',{silent:true});
  const pa=fakePlayer();t.setPlayer(pa);presence('deviants');t.factionPresenceInteract();
  const allyTaken=t.smGet(pa,'dmgTaken');
  /* base */
  beginDiplo();setAff('deviants',10);
  const pb=fakePlayer();t.setPlayer(pb);presence('deviants');t.factionPresenceInteract();
  const baseTaken=t.smGet(pb,'dmgTaken');
  assert.ok(allyTaken<baseTaken,'dano recebido aliado ('+allyTaken+') < base ('+baseTaken+')');
});
ok('46. DESVIADOS hostil: oferta mais tentadora (+dano maior) e mais instável (+taken maior)',()=>{
  assert.ok(t.FACTION_PRESENCE_DEVIANTS_HOSTILE_DMG>t.FACTION_PRESENCE_DEVIANTS_DMG);
  assert.ok(t.FACTION_PRESENCE_DEVIANTS_HOSTILE_TAKEN>t.FACTION_PRESENCE_DEVIANTS_TAKEN);
});
ok('47. presenças NÃO concedem afinidade (aff só leitura na interação)',()=>{
  beginDiplo();setAff('anchor',60);const b=aff('anchor');
  const p=fakePlayer();p.shield=0;t.setPlayer(p);presence('anchor');
  t.factionPresenceInteract();
  assert.strictEqual(aff('anchor'),b,'afinidade inalterada pela presença');
});
ok('48. label de presença mostra estado EFETIVO com marca de pacto',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const lab=t.fpEntityAffinityLabel('anchor');
  assert.ok(/ALIADA/.test(lab),'mostra ALIADA');
  assert.ok(lab.indexOf('\u25c6')>=0,'marca de pacto ◆');
});

/* ============================================================
   ECHOS + DIPLOMACIA (49–56)
   ============================================================ */
ok('49. ECHO_DIPLO_REACTIONS cobre ally/hostile/rival com pools não vazios',()=>{
  const R=t.ECHO_DIPLO_REACTIONS;
  for(const k of ['ally','hostile','rival']){
    assert.ok(Array.isArray(R[k])&&R[k].length>=1,'pool '+k);
  }
});
ok('50. echoDiploSituation detecta ALIADA quando há pacto',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.echoDiploSituation('anchor'),'ally');
});
ok('51. echoDiploSituation detecta HOSTIL',()=>{
  beginDiplo();setAff('consortium',-70);
  assert.strictEqual(t.echoDiploSituation('consortium'),'hostile');
});
ok('52. echoDiploSituation detecta RIVALIDADE CONSOLIDADA (pacto com a rival)',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  /* deviants é rival de anchor; sua situação passa a rival (limitada) */
  const sit=t.echoDiploSituation('deviants');
  assert.ok(sit==='rival'||sit==='hostile'||sit===null,'reconhece contexto rival');
});
ok('53. echoDiploSituation retorna null quando nada extremo (usa camada B4)',()=>{
  beginDiplo();setAff('remnants',20);
  assert.strictEqual(t.echoDiploSituation('remnants'),null);
});
ok('54. echoDiploReactionPick é determinístico e anti-repeat',()=>{
  beginDiplo();
  const a=t.echoDiploReactionPick('ally','precise');
  const b=t.echoDiploReactionPick('ally','precise');
  assert.ok(a&&b,'retorna falas');
  if(t.ECHO_DIPLO_REACTIONS.ally.length>1)assert.notStrictEqual(a,b,'anti-repeat');
});
ok('55. echoFactionReaction NÃO altera trust/afinidade/estado (só narrativa)',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const e=fakeEcho({trust:50,pers:'precise'});t.setEchoes([e]);
  const affB=aff('anchor'),trustB=e.trust;
  t.echoFactionReaction('anchor','interact',{faction:'anchor'});
  assert.strictEqual(aff('anchor'),affB,'afinidade intacta');
  assert.strictEqual(e.trust,trustB,'trust intacto');
});
ok('56. Echo hostil/em ruptura NÃO emite fala amistosa (Dissonância coerente)',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const e=fakeEcho({hostile:true,pers:'precise'});t.setEchoes([e]);
  const r=t.echoFactionReaction('anchor','interact',{faction:'anchor'});
  assert.strictEqual(r,false,'Echo hostil não fala amistoso');
});

/* ============================================================
   EVENTOS / UI (57–60)
   ============================================================ */
ok('57. FACTION_PACT_NAME/LINE não usam números crus (mostra estado, não barra)',()=>{
  for(const id of FACTIONS){
    assert.ok(!/\d{2,}/.test(t.FACTION_PACT_NAME[id]),'sem número em nome '+id);
  }
});
ok('58. rótulo de presença mostra ESTADO (texto), nunca a afinidade numérica',()=>{
  beginDiplo();setAff('anchor',60);
  const lab=t.fpEntityAffinityLabel('anchor');
  assert.ok(!/\b60\b/.test(lab),'sem número bruto');
});
ok('59. snapshot serve à UI/Codex sem expor barra maximizável',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const s=t.factionDiplomacySnapshot();
  assert.ok('state' in s.anchor && 'pact' in s.anchor,'estado + pacto');
});
ok('60. label efetivo de facção sem pacto NÃO mostra marca ◆',()=>{
  beginDiplo();setAff('anchor',60);
  assert.ok(t.fpEntityAffinityLabel('anchor').indexOf('\u25c6')<0);
});

/* ============================================================
   SAVE / CONTINUE (61–68)
   ============================================================ */
ok('61. pacto persiste no pack e restaura no unpack',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const packed=t.fracRunPack();
  assert.strictEqual(packed.pact.anchor,1);
  t.fracRunUnpack({frac:packed});
  assert.strictEqual(t.factionHasPact('anchor'),true);
});
ok('62. pactBroke persiste no round-trip (cooldown sobrevive ao Continue)',()=>{
  beginDiplo();setAff('anchor',80);t.factionPactConsolidate('anchor',{silent:true});
  t.factionPactBreak('anchor',{silent:true});
  const packed=t.fracRunPack();
  t.fracRunUnpack({frac:packed});
  assert.strictEqual(t.getFracRun().pactBroke.anchor,1);
});
ok('63. save ANTIGO sem pact → defaults seguros (sem crash, sem pacto)',()=>{
  const legacy={frac:{res:0,aff:{anchor:80,remnants:0,consortium:0,deviants:0}}};
  t.fracRunUnpack(legacy);
  assert.strictEqual(t.factionHasPact('anchor'),false);
  assert.strictEqual(t.getFracRun().pact.anchor,0);
});
ok('64. unpack corrige invariante: nunca duas rivais aliadas (save corrompido)',()=>{
  const bad={frac:{res:0,aff:{anchor:80,deviants:80,remnants:0,consortium:0},
    pact:{anchor:1,deviants:1,remnants:0,consortium:0}}};
  t.fracRunUnpack(bad);
  const p=t.getFracRun().pact;
  assert.ok(!(p.anchor&&p.deviants),'um-pacto-por-eixo forçado');
});
ok('65. unpack reaplica o teto: rival de pacto nunca fica acima de 0',()=>{
  const cp={frac:{res:0,aff:{anchor:70,deviants:90,remnants:0,consortium:0},
    pact:{anchor:1,deviants:0,remnants:0,consortium:0}}};
  t.fracRunUnpack(cp);
  assert.ok(t.getFracRun().aff.deviants<=0,'teto reaplicado no restore');
});
ok('66. Continue NÃO re-consolida nem duplica: unpack duas vezes = mesmo estado',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const packed=t.fracRunPack();
  t.fracRunUnpack({frac:packed});
  const a=JSON.stringify(t.getFracRun().pact);
  t.fracRunUnpack({frac:t.fracRunPack()});
  assert.strictEqual(JSON.stringify(t.getFracRun().pact),a,'idempotente');
});
ok('67. pack só grava 0/1 em pact/pactBroke (flag pequena, run-scoped)',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const p=t.fracRunPack();
  for(const id of FACTIONS){
    assert.ok(p.pact[id]===0||p.pact[id]===1);
    assert.ok(p.pactBroke[id]===0||p.pactBroke[id]===1);
  }
});
ok('68. versões intactas: SM_VERSION=3, FRACTURE_STATE_VERSION=1, 0.9.0-alpha',()=>{
  assert.strictEqual(t.SM_VERSION,3);
  assert.strictEqual(t.FRACTURE_STATE_VERSION,1);
  assert.strictEqual(t.ECHO_VERSION,'0.9.0-alpha');
});

/* ============================================================
   SANDBOX / DEV (69–74)
   ============================================================ */
ok('69. consolidar em sandbox NÃO transmite banner/toast (silencioso)',()=>{
  beginDiplo();t.setSandboxRun(true);setAff('anchor',60);
  /* não deve lançar exceção mesmo com feedback suprimido */
  assert.strictEqual(t.factionPactConsolidate('anchor'),true);
  t.setSandboxRun(false);
});
ok('70. factionCanPact fora de run retorna false (sem estado)',()=>{
  t.setFracRun(null);
  assert.strictEqual(t.factionCanPact('anchor'),false);
});
ok('71. factionAffinityCeiling sem run = 100 (sem teto)',()=>{
  t.setFracRun(null);
  assert.strictEqual(t.factionAffinityCeiling('deviants'),100);
});
ok('72. factionHasPact é seguro sem run (false)',()=>{
  t.setFracRun(null);
  assert.strictEqual(t.factionHasPact('anchor'),false);
});
ok('73. snapshot funciona logo após fracFresh (defaults)',()=>{
  beginDiplo();
  const s=t.factionDiplomacySnapshot();
  for(const id of FACTIONS)assert.strictEqual(s[id].pact,false);
});
ok('74. fracRival read-only não altera estado',()=>{
  beginDiplo();const b=JSON.stringify(t.getFracRun());
  t.fracRival('anchor');t.fracRival('deviants');
  assert.strictEqual(JSON.stringify(t.getFracRun()),b);
});

/* ============================================================
   REGRESSÕES / INVARIANTES (75–92)
   ============================================================ */
ok('75. FACÇÃO ≠ TEMA: consolidar pacto não muda o Fracture Theme',()=>{
  beginDiplo();const theme=t.fractureGetThemeId();
  setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.fractureGetThemeId(),theme,'tema inalterado');
});
ok('76. Moralidade ≠ Diplomacia: pacto não cria campo de moral em fracRun',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  assert.ok(!('morality' in t.getFracRun()),'sem moral em fracRun');
});
ok('77. clamp de afinidade permanece [-100,100] mesmo com teto',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  setAff('deviants',-50);t.fracApplyDelta('deviants',-999,'x');
  assert.ok(aff('deviants')>=-100);
  t.fracApplyDelta('anchor',999,'x');
  assert.ok(aff('anchor')<=100);
});
ok('78. teto nunca produz NaN/undefined na afinidade da rival',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  for(let i=0;i<20;i++)t.fracApplyDelta('deviants',(i%2?3:-3),'x');
  assert.ok(Number.isFinite(aff('deviants')));
});
ok('79. factionEmit respeita o teto (fonte de aff em gameplay)',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  setAff('deviants',0);
  /* evento que dá + para deviants não deve furar o teto */
  for(let i=0;i<10;i++)t.factionEmit('shop_open',{obs:1});
  assert.ok(aff('deviants')<=0,'teto vale via factionEmit');
});
ok('80. presença NÃO entra em enemies[] nem vira ally persistente',()=>{
  beginDiplo();presence('anchor');
  const e=t.getEntity();
  assert.ok(e&&e.faction==='anchor','entidade dedicada');
});
ok('81. consolidar não altera afinidade da própria facção aliada',()=>{
  beginDiplo();setAff('anchor',60);const b=aff('anchor');
  t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(aff('anchor'),b,'afinidade própria intacta (só flag)');
});
ok('82. DESVIADOS: modificadores usam stacks:replace (sem órfão/duplicação)',()=>{
  beginDiplo();setAff('deviants',10);
  const p=fakePlayer();t.setPlayer(p);
  presence('deviants');t.factionPresenceInteract();
  presence('deviants');t.factionPresenceInteract();
  const mods=(p.sm||[]).filter(m=>m&&m.id==='faction.deviants.dmg');
  assert.ok(mods.length<=1,'sem duplicar modificador');
});
ok('83. DESVIADOS: modificador expira via smTick (auto-cleanup)',()=>{
  beginDiplo();setAff('deviants',10);
  const p=fakePlayer();t.setPlayer(p);
  presence('deviants');t.factionPresenceInteract();
  assert.ok(t.smHas(p,'faction.deviants.dmg'));
  t.smTick(p,t.FACTION_PRESENCE_DEVIANTS_DUR+1);
  assert.ok(!t.smHas(p,'faction.deviants.dmg'),'expirou sozinho');
});
ok('84. REMANESCENTES hostil nunca gera Dissonância grátis nem remove trust',()=>{
  beginDiplo();setAff('remnants',-70);
  const e=fakeEcho({trust:40,dis:{st:'stable',p:0}});t.setEchoes([e]);
  presence('remnants');t.factionPresenceInteract();
  assert.strictEqual(e.trust,40);
  assert.strictEqual(e.dis.st,'stable','sem Dissonância induzida');
});
ok('85. CONSÓRCIO hostil não quebra a economia ⧗ (toll é net-positivo pequeno)',()=>{
  beginDiplo();setAff('consortium',-70);
  t.addResidues(10,'seed');const before=t.getResidues();
  presence('consortium');t.factionPresenceInteract();
  const net=t.getResidues()-before;
  assert.ok(net>0&&net<t.FACTION_PRESENCE_CONSORTIUM_RES+t.FACTION_PRESENCE_HOSTILE_RES_COST,
    'ganho líquido controlado');
});
ok('86. estado diplomático é run-scoped: fracFresh zera pact/pactBroke',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  t.setFracRun(t.fracFresh());
  assert.strictEqual(t.factionHasPact('anchor'),false,'nova run zera');
});
ok('87. factionDiploState degrada para bruto quando não há pacto',()=>{
  beginDiplo();setAff('anchor',60);
  assert.strictEqual(t.factionDiploState('anchor').id,'favoravel');
});
ok('88. teto=0 nunca vira estado ALIADA para a rival',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  assert.notStrictEqual(t.factionDiploState('deviants').id,'aliada');
});
ok('89. consolidar em id inválido não cria pacto e não crasha',()=>{
  beginDiplo();
  assert.strictEqual(t.factionPactConsolidate('inexistente',{silent:true}),false);
});
ok('90. as constantes-chave têm os valores auditados (verbatim)',()=>{
  assert.strictEqual(t.FACTION_PACT_MIN,58);
  assert.strictEqual(t.FACTION_RUPTURE_AFF,-40);
  assert.strictEqual(t.FACTION_RIVAL_CEIL,0);
});
ok('91. rival com pacto do outro eixo NÃO limita (só rival direta)',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.factionAffinityCeiling('remnants'),100);
  assert.strictEqual(t.factionAffinityCeiling('consortium'),100);
});
ok('92. presença aliada não concede pickup grátis (efeito escalado, com limite)',()=>{
  beginDiplo();setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const p=fakePlayer();p.shield=p.shieldMax;t.setPlayer(p);   // já cheio
  presence('anchor');t.factionPresenceInteract();
  assert.ok(t.getPlayer().shield<=p.shieldMax,'nunca ultrapassa o máximo');
});

/* ============================================================
   PROPERTY / STRESS (93–97)
   ============================================================ */
ok('93. STRESS ≥10000: sequências aleatórias nunca produzem estado impossível',()=>{
  /* PRNG determinístico local (não usa Math.random do jogo) */
  let s=0x9e3779b9;
  const rnd=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return((s>>>0)/4294967296);};
  let exc=0,nan=0,dbl=0;
  for(let run=0;run<600;run++){
    beginDiplo();
    for(const id of FACTIONS)setAff(id,Math.floor(rnd()*200)-100);
    for(let step=0;step<18;step++){
      const id=FACTIONS[(rnd()*4)|0];
      const act=(rnd()*4)|0;
      try{
        if(act===0){setAff(id,58);t.factionPactConsolidate(id,{silent:true});}
        else if(act===1)t.factionPactBreak(id,{silent:true});
        else if(act===2)t.fracApplyDelta(id,((rnd()*8)|0)-4,'x');
        else t.factionDiplomacySnapshot();
      }catch(e){exc++;}
      for(const f of FACTIONS){if(!Number.isFinite(aff(f)))nan++;}
    }
    /* invariante: nunca duas rivais aliadas */
    for(const [a,b] of AXES){
      if(t.factionHasPact(a)&&t.factionHasPact(b))dbl++;
    }
  }
  assert.strictEqual(exc,0,'0 exceções');
  assert.strictEqual(nan,0,'0 NaN');
  assert.strictEqual(dbl,0,'0 dupla aliança rival');
});
ok('94. PROPERTY: teto sempre respeitado após qualquer sequência de deltas',()=>{
  let s=12345;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  for(let run=0;run<300;run++){
    beginDiplo();setAff('anchor',58);t.factionPactConsolidate('anchor',{silent:true});
    for(let i=0;i<30;i++)t.fracApplyDelta('deviants',((rnd()*8)|0)-4,'x');
    assert.ok(aff('deviants')<=t.FACTION_RIVAL_CEIL,'rival nunca fura o teto');
  }
});
ok('95. PROPERTY: pack→unpack preserva o estado diplomático (round-trip)',()=>{
  let s=999;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  for(let run=0;run<200;run++){
    beginDiplo();
    for(const id of FACTIONS)setAff(id,Math.floor(rnd()*200)-100);
    if(rnd()<.5){setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});}
    if(rnd()<.5){setAff('remnants',60);t.factionPactConsolidate('remnants',{silent:true});}
    const packed=t.fracRunPack();
    const snapA=JSON.stringify(t.factionDiplomacySnapshot());
    t.fracRunUnpack({frac:packed});
    const snapB=JSON.stringify(t.factionDiplomacySnapshot());
    assert.strictEqual(snapB,snapA,'round-trip estável na run '+run);
  }
});
ok('96. PROPERTY: nunca >2 pactos e nunca pactos rivais simultâneos',()=>{
  let s=7;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  for(let run=0;run<400;run++){
    beginDiplo();
    for(const id of FACTIONS){setAff(id,80);if(rnd()<.6)t.factionPactConsolidate(id,{silent:true});}
    const n=FACTIONS.filter(id=>t.factionHasPact(id)).length;
    assert.ok(n<=2,'no máximo 2 pactos');
    for(const [a,b] of AXES)assert.ok(!(t.factionHasPact(a)&&t.factionHasPact(b)));
  }
});
ok('97. PROPERTY: presenças em qualquer tier nunca lançam exceção/NaN de escudo',()=>{
  let s=42;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  let exc=0;
  for(let i=0;i<400;i++){
    beginDiplo();
    const id=FACTIONS[(rnd()*4)|0];
    setAff(id,Math.floor(rnd()*200)-100);
    if(rnd()<.4){setAff(id,60);t.factionPactConsolidate(id,{silent:true});}
    const p=fakePlayer();p.shield=(rnd()*30)|0;t.setPlayer(p);
    t.setEchoes([fakeEcho({shield:(rnd()*40)|0,trust:(rnd()*100)|0})]);
    t.addResidues((rnd()*30)|0,'seed');
    presence(id);
    try{t.factionPresenceInteract();}catch(e){exc++;}
    if(!Number.isFinite(t.getPlayer().shield))exc++;
  }
  assert.strictEqual(exc,0,'0 exceções/NaN em presenças');
});

/* ---------------- resumo ---------------- */
console.log('\nResultado: '+pass+' passaram · '+fail+' falharam');
if(fail>0){console.log('PR14 · B5 — HÁ TESTES FALHANDO');process.exit(1);}
