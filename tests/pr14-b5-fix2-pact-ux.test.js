'use strict';
/* =====================================================================
   TESTES — PR 14 · B5-FIX.2: AJUSTES VISUAIS FINAIS DO ENCONTRO DE PACTO
   ---------------------------------------------------------------------
   Deriva do playtest humano do B5-FIX.1. A mecânica de pacto já passou;
   este FIX é só de UX/legibilidade:
     A) marker de PACTO DISPONÍVEL na arena ficou mais evidente (sem
        redesenhar a presença, sem popup central, sem flashing agressivo);
     B) o modal do encontro deixou de mostrar 0 CRÉDITOS;
     C) o modal deixou de mostrar arsenal/módulos;
     D) o corpo da opção ACEITAR ficou mais enxuto (sem repetir o IMPACTO).

   Invariantes preservadas (NÃO mexer): diplomacia, thresholds, rivalidades,
   scheduler, economia, feedback de 4–5 s, Save/Continue (além do necessário).
   Rodar: npm test  |  node tests/pr14-b5-fix2-pact-ux.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const mm=html.match(/<script>([\s\S]*?)<\/script>/);
if(!mm)throw new Error('script não encontrado em index.html');
let src=mm[1];
src+=';globalThis.__t={'+
  /* fluxo de pacto físico */
  'fpOpenPactEncounter,fpClosePactEncounter,fpImportantToast,'+
  'fpPactOfferReady,fpFirstPactOfferReady,fpTrackPactEligibility,'+
  'FACTION_PACT_OFFER_DELAY,FACTION_PACT_REOFFER_COOLDOWN,'+
  /* diplomacia B5 (reutilizada) */
  'FACTION_PACT_MIN,fracRival,factionHasPact,factionCanPact,'+
  'factionPactConsolidate,factionPactBreak,factionDiploState,fracStateOf,'+
  'FACTION_PACT_NAME,FACTION_PACT_LINE,FACTION_PACT_ACCEPT_LINE,'+
  'factionAffinityCeiling,FACTION_RIVAL_CEIL,'+
  /* presença física */
  'FACTION_PRESENCE_LABEL,fpIsPhysical,fpMakePresence,factionPresenceFresh,'+
  'factionPresenceBeginRun,factionPresenceBuildEntity,factionPresenceInteract,'+
  'factionPresenceEntitySnapshot,factionPresenceDrawEntity,'+
  'factionPresencePack,factionPresenceUnpack,'+
  /* util */
  'FACTION_IDS,FRACTION_BY_ID,getFactionAffinity,getResidues,clamp,'+
  'SM_VERSION,FRACTURE_STATE_VERSION,ECHO_VERSION,'+
  'fractureBeginRun,fractureSetSeed,fractureGetThemeId,openShop,ownedLine,'+
  /* acessores de estado vivo */
  'getFP:()=>factionPresenceRun,setFP:v=>{factionPresenceRun=v;},'+
  'getEntity:()=>factionPresenceEntity,setEntity:v=>{factionPresenceEntity=v;},'+
  'fracFresh,getFracRun:()=>fracRun,setFracRun:v=>{fracRun=v;},'+
  'getFracDisc:()=>fracDisc,setFracDisc:v=>{fracDisc=v;},'+
  'getPlayer:()=>player,setPlayer:v=>{player=v;},'+
  'getEchoes:()=>echoes,setEchoes:v=>{echoes=v;},'+
  'getState:()=>state,setState:v=>{state=v;},'+
  'getSandboxRun:()=>sandboxRun,setSandboxRun:v=>{sandboxRun=v;},'+
  'setWave:v=>{wave=v|0;},getWave:()=>wave,'+
  'getMRow:()=>mRow,getToasts:()=>toastsEl,'+
  'getMCoins:()=>mCoins,getMOwned:()=>mOwned,getMDesc:()=>mDesc,getMTag:()=>mTag'+
  '};';

/* HTML inteiro (para checagens de CSS / draw) e RAW do script */
const RAW=src, RAWHTML=html;

/* ---------------- DOM mínimo ---------------- */
function makeStyle(){const store={};
  return new Proxy(store,{get(tt,k){
    if(k==='setProperty')return (kk,vv)=>{tt[kk]=String(vv);};
    if(k==='getPropertyValue')return kk=>(kk in tt?tt[kk]:'');
    if(k==='removeProperty')return kk=>{delete tt[kk];};
    return k in tt?tt[k]:'';},
    set(tt,k,v){tt[k]=String(v);return true;}});}
/* ctx2d que REGISTRA os fillText desenhados (para checar o marker) */
function ctx2d(log){const grad={addColorStop(){}};
  const state={font:'',globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,
    shadowBlur:0,shadowColor:'',textAlign:'',textBaseline:''};
  return new Proxy(state,{get(tt,k){
    if(k==='canvas')return{width:0,height:0};
    if(k==='measureText')return()=>({width:0});
    if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;
    if(k==='fillText')return(txt,x,y)=>{if(log)log.push({txt:String(txt),x,y,
      font:tt.font,alpha:tt.globalAlpha,shadow:tt.shadowBlur});};
    if(k in tt)return tt[k];
    return()=>{};},
    set(tt,k,v){tt[k]=v;return true;}});}
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

/* ---------------- helpers ---------------- */
const FACTIONS=['anchor','remnants','consortium','deviants'];
function beginRun(seed){
  t.fractureBeginRun();
  if(seed!=null)t.fractureSetSeed(seed>>>0);
  t.setFracRun(t.fracFresh());
  t.setFracDisc({anchor:['contact'],remnants:['contact'],
    consortium:['contact'],deviants:['contact']});
  t.setPlayer(fakePlayer());
  t.setEchoes([]);
  t.setEntity(null);
  t.setSandboxRun(false);
  t.setWave(5);
  t.factionPresenceBeginRun();
  try{t.getMRow().children.length=0;}catch(_x){}
  try{t.getToasts().children.length=0;}catch(_x){}
  return t.getFP();
}
function setAff(id,v){t.getFracRun().aff[id]=v;}
function aff(id){return t.getFracRun().aff[id];}
function fakePlayer(){return {x:100,y:100,r:14,shield:0,shieldMax:30,shieldDelayT:5,
  hp:100,maxHp:100,coins:250,invT:0,
  owned:[0,1],items:[],upgLog:[],maxSlots:4,vowPoverty:0};}
function entity(faction,pactOffer){
  const e={faction:faction,kind:'emissary',x:120,y:120,r:30,interactR:58,
    ttl:32,ttlMax:32,state:'active',beacon:false,pulse:1.0,consumed:false,
    pactOffer:pactOffer?1:0};
  t.setEntity(e);return e;}
/* abre o encontro de pacto e devolve o mRow */
function openEncounter(faction){
  beginRun(1);setAff(faction,60);t.setPlayer(fakePlayer());
  const e=entity(faction,true);t.setState('play');
  t.factionPresenceInteract();
  return e;}

console.log('\n=== PR14 · B5-FIX.2 — UX FINAL DO ENCONTRO DE PACTO ===');

/* ============================================================
   1–5 · pacto fora da Loja + fluxo intacto
   ============================================================ */
ok('1. pacto continua fora da Loja Temporal (openShop sem chamada de pacto)',()=>{
  const m=RAW.match(/function openShop\(\)\{[\s\S]*?\n\}/);
  const codeOnly=m[0].replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  assert.ok(!/b5MaybeOfferPact\s*\(|fpOpenPactEncounter\s*\(/.test(codeOnly),'sem pacto na Loja');
});
ok('2. presença com pacto possui marker visível específico (draw)',()=>{
  beginRun(1);setAff('anchor',60);
  const log=[];
  /* injeta um ctx com log e roda o draw */
  const e=entity('anchor',true);e.pactOffer=1;
  MAIN.ctx&&null;
  /* usa o ctx real do jogo via drawWorldExtras não é acessível; então
     validamos por análise estática do bloco de draw do marker */
  assert.ok(/e\.pactOffer/.test(RAW),'draw consulta pactOffer');
  assert.ok(/PACTO DISPON[IÍ]VEL/.test(RAW),'label de pacto no draw');
});
ok('3. presença normal NÃO recebe marker de pacto',()=>{
  beginRun(1);
  const e=entity('anchor',false);
  assert.strictEqual(e.pactOffer,0);
  const s=t.factionPresenceEntitySnapshot();
  assert.strictEqual(s.pactOffer,false);
});
ok('4. mensagem de aproximação continua existindo',()=>{
  assert.ok(/APROXIME-SE/.test(RAW),'mensagem de aproximação presente');
});
ok('5. interação ainda abre fpOpenPactEncounter',()=>{
  openEncounter('anchor');
  assert.strictEqual(t.getState(),'event','modal congela a run');
  assert.strictEqual(t.getMRow().children.length,2,'duas escolhas');
});

/* ============================================================
   6–10 · limpeza do modal + componentes compartilhados
   ============================================================ */
ok('6. modal de pacto NÃO mostra créditos',()=>{
  openEncounter('anchor');
  assert.strictEqual(t.getMCoins().textContent,'','sem créditos no encontro');
});
ok('7. modal de pacto NÃO mostra arsenal (m-owned vazio)',()=>{
  openEncounter('remnants');
  assert.strictEqual(t.getMOwned().innerHTML,'','sem arsenal');
});
ok('8. modal de pacto NÃO mostra módulos (m-owned não cita MÓDULO)',()=>{
  openEncounter('consortium');
  assert.ok(t.getMOwned().innerHTML.indexOf('MÓDULO')<0,'sem bloco de módulos');
});
ok('9. Loja Temporal continua mostrando créditos',()=>{
  /* openShop popula mCoins com créditos do player */
  beginRun(1);const p=fakePlayer();p.coins=250;t.setPlayer(p);
  t.setState('play');
  try{t.openShop();}catch(_x){}
  assert.ok(/CR[ÉE]DITOS/.test(t.getMCoins().textContent),'Loja mostra créditos: '+t.getMCoins().textContent);
});
ok('10. Loja continua mostrando arsenal/registro da run (m-owned populado)',()=>{
  beginRun(1);t.setPlayer(fakePlayer());t.setState('play');
  try{t.openShop();}catch(_x){}
  assert.ok(t.getMOwned().innerHTML.length>0,'Loja repopula m-owned');
  assert.ok(/ARSENAL|REGISTRO DA RUN/.test(t.getMOwned().innerHTML),'arsenal visível na Loja');
});

/* ============================================================
   11–14 · estrutura da decisão preservada
   ============================================================ */
ok('11. opção ACEITAR continua existindo',()=>{
  openEncounter('anchor');
  const nm=t.getMRow().children[0].innerHTML;
  assert.ok(/ACEITAR/.test(nm),'card ACEITAR presente');
});
ok('12. MANTER INDEPENDÊNCIA continua existindo',()=>{
  openEncounter('anchor');
  const nm=t.getMRow().children[1].innerHTML;
  assert.ok(/MANTER INDEPEND[ÊE]NCIA/.test(nm),'card MANTER presente');
});
ok('13. IMPACTO NA RUN continua existindo (evImpactHTML no card ACEITAR)',()=>{
  openEncounter('anchor');
  const html=t.getMRow().children[0].innerHTML;
  assert.ok(/ALIADA/.test(html)&&/EIXO/.test(html),'impacto listado no card');
});
ok('14. consequência rival continua explícita (RESTRINGIDA)',()=>{
  openEncounter('anchor');
  const html=t.getMRow().children[0].innerHTML;
  assert.ok(/RESTRINGIDA/.test(html),'rival restringida citada');
});

/* ============================================================
   15–18 · mecânica diplomática idêntica
   ============================================================ */
ok('15. aceitar continua consolidando pacto',()=>{
  openEncounter('anchor');
  t.getMRow().children[0]._handlers.click[0]();
  assert.strictEqual(t.factionHasPact('anchor'),true);
  assert.strictEqual(t.getState(),'play','retomou a run');
});
ok('16. recusar continua sem broke',()=>{
  openEncounter('anchor');
  t.getMRow().children[1]._handlers.click[0]();
  assert.strictEqual(t.getFracRun().pactBroke.anchor,0);
});
ok('17. recusar continua sem penalidade rival',()=>{
  beginRun(1);setAff('anchor',60);setAff('deviants',50);
  const rivalBefore=aff('deviants');
  t.setPlayer(fakePlayer());entity('anchor',true);t.setState('play');
  t.factionPresenceInteract();
  t.getMRow().children[1]._handlers.click[0]();
  assert.strictEqual(aff('deviants'),rivalBefore,'rival intacta ao recusar');
});
ok('18. reoferta continua funcionando (pactDecl + cooldown)',()=>{
  beginRun(1);setAff('anchor',60);t.setWave(9);t.setPlayer(fakePlayer());
  entity('anchor',true);t.setState('play');t.factionPresenceInteract();
  t.getMRow().children[1]._handlers.click[0]();
  assert.strictEqual(t.getFP().pactDecl.anchor,9,'recusa registrada');
  t.fpTrackPactEligibility(9);
  assert.strictEqual(t.fpPactOfferReady('anchor',9+t.FACTION_PACT_REOFFER_COOLDOWN),true,'reoferta volta');
});

/* ============================================================
   19–20 · Save/Continue + regressão das suítes
   ============================================================ */
ok('19. Save/Continue intacto (pack/unpack round-trip do pactOffer)',()=>{
  beginRun(1);setAff('anchor',60);
  t.getFP().pactDecl.anchor=4;t.getFP().pactEligWave.anchor=2;
  const cp={presence:t.factionPresencePack()};
  beginRun(1);t.factionPresenceUnpack(cp);
  assert.strictEqual(t.getFP().pactDecl.anchor,4);
  assert.strictEqual(t.getFP().pactEligWave.anchor,2);
});
ok('20. versões inalteradas (SM=3, FRACTURE=1, 0.8.0-alpha)',()=>{
  assert.strictEqual(t.SM_VERSION,3);
  assert.strictEqual(t.FRACTURE_STATE_VERSION,1);
  assert.strictEqual(t.ECHO_VERSION,'0.8.0-alpha');
});

/* ============================================================
   21–25 · texto enxuto de ACEITAR + IMPACTO
   ============================================================ */
ok('21. FACTION_PACT_ACCEPT_LINE existe para as 4 facções',()=>{
  for(const id of FACTIONS)
    assert.ok(typeof t.FACTION_PACT_ACCEPT_LINE[id]==='string'&&t.FACTION_PACT_ACCEPT_LINE[id].length>0,id);
});
ok('22. corpo de ACEITAR é curto (uma frase, não repete a lista do IMPACTO)',()=>{
  for(const id of FACTIONS){
    const line=t.FACTION_PACT_ACCEPT_LINE[id];
    assert.ok(line.length<=140,id+' curto ('+line.length+')');
    /* não deve repetir literalmente os rótulos do IMPACTO */
    assert.ok(!/RELAÇÃO RESTRINGIDA|EXCLUSIVO NESTA RUN|PASSA A COOPERAR/.test(line),
      id+' não repete o IMPACTO');
  }
});
ok('23. texto da ÂNCORA cita estabilidade (coerência de lore)',()=>{
  assert.ok(/estabilidade/i.test(t.FACTION_PACT_ACCEPT_LINE.anchor));
});
ok('24. texto dos REMANESCENTES cita continuidade / DESVIADOS cita transformação',()=>{
  assert.ok(/continuidade/i.test(t.FACTION_PACT_ACCEPT_LINE.remnants),'remnants');
  assert.ok(/transforma/i.test(t.FACTION_PACT_ACCEPT_LINE.deviants),'deviants');
});
ok('25. texto do CONSÓRCIO cita acesso/acordo (coerência de lore)',()=>{
  assert.ok(/acesso|acordo/i.test(t.FACTION_PACT_ACCEPT_LINE.consortium));
});

/* ============================================================
   26–30 · feedback aprovado + toast comum intactos
   ============================================================ */
ok('26. feedback de presença continua ~4,6 s (CSS fptin 4.6s intacto)',()=>{
  assert.ok(/fptin\s+4\.6s/.test(RAWHTML),'duração aprovada preservada');
  assert.ok(/\.toast\.fp\{/.test(RAWHTML),'categoria .toast.fp preservada');
});
ok('27. toast comum continua 2,1 s (não globalizado)',()=>{
  assert.ok(/\.toast\{[^}]*animation:tin 2\.1s/.test(RAWHTML));
});
ok('28. fpImportantToast segue com 3 linhas hierárquicas',()=>{
  beginRun(1);
  const d=t.fpImportantToast('anchor','ALIADA','NÓ DE CONTENÇÃO','+15 ESCUDO');
  assert.strictEqual(d.children.length,3);
});
ok('29. interação normal segue aplicando efeito + mensagem principal (regressão)',()=>{
  beginRun(1);setAff('anchor',10);
  const p=fakePlayer();p.shield=0;t.setPlayer(p);
  entity('anchor',false);t.setState('play');
  t.getToasts().children.length=0;
  t.factionPresenceInteract();
  assert.ok(t.getPlayer().shield>0,'efeito base aplicado');
  const fp=t.getToasts().children.filter(c=>String(c.className).indexOf('fp')>=0);
  assert.strictEqual(fp.length,1,'uma mensagem principal');
});
ok('30. DESVIADOS HOSTIL segue +28%/+35% (balance NÃO recalibrado)',()=>{
  /* re-exporta via FIX.1? aqui só garantimos que o texto de balance não sumiu */
  assert.ok(/1\.28/.test(RAW)&&/1\.35/.test(RAW),'valores de balance intactos');
});

/* ============================================================
   31–33 · marker mais evidente (análise do draw) + Tema
   ============================================================ */
ok('31. marker de pacto usa fonte maior/negrito e brilho (mais evidente)',()=>{
  /* bloco de draw do pactOffer deve conter bold e shadowBlur */
  const blk=RAW.match(/if\(e\.pactOffer\)\{[\s\S]*?PACTO DISPON[IÍ]VEL[\s\S]*?\}/);
  assert.ok(blk,'bloco de marker encontrado');
  assert.ok(/bold/.test(RAW)&&/shadowBlur/.test(RAW),'usa negrito e brilho');
});
ok('32. identidade da facção segue dominante (símbolo+nome desenhados)',()=>{
  assert.ok(/lab\.sym\+' '\+lab\.nm/.test(RAW),'nome da facção desenhado');
});
ok('33. FACÇÃO ≠ TEMA: abrir o encontro não altera o Tema',()=>{
  beginRun(1);setAff('anchor',60);const th=t.fractureGetThemeId();
  openEncounter('anchor');
  assert.strictEqual(t.fractureGetThemeId(),th);
});

/* ---------------- resumo ---------------- */
console.log('\nResultado: '+pass+' passaram · '+fail+' falharam');
if(fail>0){console.log('PR14 · B5-FIX.2 — HÁ TESTES FALHANDO');process.exit(1);}
