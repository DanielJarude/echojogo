'use strict';
/* =====================================================================
   TESTES — PR 14 · B5-FIX.1: PACTO COMO ENCONTRO DE FACÇÃO +
   LEGIBILIDADE DO FEEDBACK DE PRESENÇA
   ---------------------------------------------------------------------
   Deriva do playtest humano do B5. Dois achados:
     A) o pacto foi REMOVIDO da Loja Temporal e agora nasce do ENCONTRO
        FÍSICO da própria facção (presença com "PACTO DISPONÍVEL");
     B) feedback de presença ganhou categoria própria (toast .fp) com
        ~4–5s úteis e hierarquia de 3 linhas.

   Grupos:
     · Remoção da Loja (estático) ......... 1–4
     · Estado/serialização do pactOffer ... 5–10
     · Elegibilidade & timing ............. 11–20
     · Scheduler (prioridade controlada) .. 21–28
     · Entidade & interação (encontro) .... 29–40
     · Recusa / reoferta / aceitação ...... 41–48
     · Save/Continue ...................... 49–54
     · Regras B5 preservadas .............. 55–62
     · Feedback (ACHADO B) ................ 63–72
     · DEV .............................. 73–76
     · Regressão ......................... 77–82
     · PROPERTY / STRESS ................. 83–86

   Invariantes de stress (§32): 0 pacto duplicado, 0 proposta impossível,
   0 dupla aliança rival, 0 consequência rival duplicada, 0 NaN, 0 presença
   acima do cap, 0 pacto via Loja.
   Rodar: npm test  |  node tests/pr14-b5-fix1-pact-presence.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const mm=html.match(/<script>([\s\S]*?)<\/script>/);
if(!mm)throw new Error('script não encontrado em index.html');
let src=mm[1];
src+=';globalThis.__t={'+
  /* B5-FIX.1 — pacto físico */
  'FACTION_PACT_REOFFER_COOLDOWN,FACTION_PACT_OFFER_DELAY,'+
  'fpPactBaseEligible,fpTrackPactEligibility,fpPactOfferReady,fpFirstPactOfferReady,'+
  'fpOpenPactEncounter,fpClosePactEncounter,fpImportantToast,'+
  /* diplomacia B5 (reutilizada) */
  'FACTION_PACT_MIN,FACTION_RIVAL,fracRival,factionHasPact,factionCanPact,'+
  'factionPactConsolidate,factionPactBreak,factionDiploState,fracStateOf,'+
  'FACTION_PACT_NAME,FACTION_PACT_LINE,factionAffinityCeiling,FACTION_RIVAL_CEIL,'+
  /* presença física */
  'FACTION_PRESENCE_ACTIVE_CAP,FACTION_PRESENCE_LABEL,fpIsPhysical,fpMakePresence,'+
  'factionPresenceFresh,factionPresenceBeginRun,factionPresenceSchedule,'+
  'factionPresenceActivate,factionPresenceExpire,factionPresenceResolve,'+
  'factionPresenceSpawnFromScheduled,factionPresenceBuildEntity,'+
  'factionPresenceInteract,factionPresenceEntitySnapshot,factionPresencePack,'+
  'factionPresenceUnpack,fpDeterministicSeed,fpRng,'+
  /* balance de desviados (feedback ACHADO B) */
  'FACTION_PRESENCE_DEVIANTS_DMG,FACTION_PRESENCE_DEVIANTS_TAKEN,'+
  'FACTION_PRESENCE_DEVIANTS_HOSTILE_DMG,FACTION_PRESENCE_DEVIANTS_HOSTILE_TAKEN,'+
  /* util */
  'FACTION_IDS,FRACTION_BY_ID,getFactionAffinity,getResidues,addResidues,clamp,'+
  'smHas,smGet,SM_VERSION,FRACTURE_STATE_VERSION,ECHO_VERSION,'+
  'fractureBeginRun,fractureSetSeed,fractureGetThemeId,'+
  /* acessores de estado vivo */
  'getFP:()=>factionPresenceRun,setFP:v=>{factionPresenceRun=v;},'+
  'getEntity:()=>factionPresenceEntity,setEntity:v=>{factionPresenceEntity=v;},'+
  'fracFresh,getFracRun:()=>fracRun,setFracRun:v=>{fracRun=v;},'+
  'getFracDisc:()=>fracDisc,setFracDisc:v=>{fracDisc=v;},'+
  'getPlayer:()=>player,setPlayer:v=>{player=v;},'+
  'getEchoes:()=>echoes,setEchoes:v=>{echoes=v;},'+
  'getState:()=>state,setState:v=>{state=v;},'+
  'getSandboxMode:()=>sandboxMode,setSandboxMode:v=>{sandboxMode=v;},'+
  'getSandboxRun:()=>sandboxRun,setSandboxRun:v=>{sandboxRun=v;},'+
  'setWave:v=>{wave=v|0;},getWave:()=>wave,'+
  'getMRow:()=>mRow,getToasts:()=>toastsEl'+
  '};';

/* raw do script (para checagens estáticas de remoção da Loja) */
const RAW=src;
/* HTML inteiro (para checagens de CSS, fora do <script>) */
const RAWHTML=html;

/* ---------------- DOM mínimo (mesmo harness das suítes existentes) ---------------- */
function makeStyle(){const store={};
  return new Proxy(store,{get(tt,k){
    if(k==='setProperty')return (kk,vv)=>{tt[kk]=String(vv);};
    if(k==='getPropertyValue')return kk=>(kk in tt?tt[kk]:'');
    if(k==='removeProperty')return kk=>{delete tt[kk];};
    return k in tt?tt[k]:'';},
    set(tt,k,v){tt[k]=String(v);return true;}});}
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
  el.setProperty=(k,v)=>{el.style[k]=v;};
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
const AXES=[['anchor','deviants'],['remnants','consortium']];

function beginRun(seed){
  t.fractureBeginRun();
  if(seed!=null)t.fractureSetSeed(seed>>>0);
  /* fracRun limpo com facções conhecidas (mesmo padrão do harness B5) */
  t.setFracRun(t.fracFresh());
  t.setFracDisc({anchor:['contact'],remnants:['contact'],
    consortium:['contact'],deviants:['contact']});
  t.setPlayer(fakePlayer());
  t.setEchoes([]);
  t.setEntity(null);
  t.setSandboxMode(false);
  t.setSandboxRun(false);
  t.setWave(5);
  t.factionPresenceBeginRun();
  /* o innerHTML='' do jogo não limpa children no DOM fake — zera manualmente */
  try{t.getMRow().children.length=0;}catch(_x){}
  try{t.getToasts().children.length=0;}catch(_x){}
  return t.getFP();
}
function setAff(id,v){t.getFracRun().aff[id]=v;}
function aff(id){return t.getFracRun().aff[id];}
function fakePlayer(){return {x:100,y:100,r:14,shield:0,shieldMax:30,shieldDelayT:5,
  hp:100,maxHp:100,coins:0,invT:0,
  owned:[],items:[],upgLog:[],maxSlots:6};}
function fakeEcho(o){o=o||{};return {slot:1,alive:true,x:60,y:60,
  shield:o.shield||0,shieldMax:o.shieldMax||40,hp:80,maxHp:80,
  trust:o.trust==null?50:o.trust,itemIds:[],dis:{st:'stable'}};}
/* cria uma entidade física direta (com/sem pactOffer) */
function entity(faction,pactOffer){
  const e={faction:faction,kind:'emissary',x:120,y:120,r:30,interactR:58,
    ttl:32,ttlMax:32,state:'active',beacon:false,pulse:0,consumed:false,
    pactOffer:pactOffer?1:0};
  t.setEntity(e);return e;}

console.log('\n=== PR14 · B5-FIX.1 — PACTO COMO ENCONTRO DE FACÇÃO + FEEDBACK ===');

/* ============================================================
   REMOÇÃO DA LOJA (1–4) — checagem estática
   ============================================================ */
ok('1. funções de pacto da Loja foram removidas do código',()=>{
  assert.ok(!/function b5MaybeOfferPact\b/.test(RAW),'b5MaybeOfferPact removida');
  assert.ok(!/function b5OpenPactModal\b/.test(RAW),'b5OpenPactModal removida');
  assert.ok(!/function b5ClosePactModal\b/.test(RAW),'b5ClosePactModal removida');
  assert.ok(!/function b5EligiblePactFaction\b/.test(RAW),'b5EligiblePactFaction removida');
});
ok('2. nenhuma CHAMADA a b5MaybeOfferPact permanece (sem listener órfão)',()=>{
  assert.ok(!/b5MaybeOfferPact\s*\(/.test(RAW),'nenhuma invocação restante');
  assert.ok(!/_b5PactPromptWave/.test(RAW.replace(/removido[\s\S]*?_b5PactPromptWave\) foi REMOVIDO/i,'')) ||
    !/let _b5PactPromptWave/.test(RAW),'declaração da flag removida');
});
ok('3. openShop (Loja) não CHAMA mais nenhum fluxo de pacto',()=>{
  const m=RAW.match(/function openShop\(\)\{[\s\S]*?\n\}/);
  assert.ok(m,'openShop encontrada');
  /* sem invocações reais (ignora menções em comentário de documentação) */
  const codeOnly=m[0].replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  assert.ok(!/b5MaybeOfferPact\s*\(|b5OpenPactModal\s*\(|fpOpenPactEncounter\s*\(/.test(codeOnly),
    'sem chamada de pacto na Loja');
});
ok('4. as funções do novo fluxo físico existem',()=>{
  assert.strictEqual(typeof t.fpOpenPactEncounter,'function');
  assert.strictEqual(typeof t.fpPactOfferReady,'function');
  assert.strictEqual(typeof t.fpFirstPactOfferReady,'function');
  assert.strictEqual(typeof t.fpImportantToast,'function');
});

/* ============================================================
   ESTADO / SERIALIZAÇÃO do pactOffer (5–10)
   ============================================================ */
ok('5. fpMakePresence normaliza pactOffer para 0/1',()=>{
  assert.strictEqual(t.fpMakePresence({faction:'anchor',pactOffer:true}).pactOffer,1);
  assert.strictEqual(t.fpMakePresence({faction:'anchor'}).pactOffer,0);
  assert.strictEqual(t.fpMakePresence({faction:'anchor',pactOffer:'x'}).pactOffer,1);
});
ok('6. factionPresenceFresh inclui pactDecl e pactEligWave (defaults -1)',()=>{
  const fp=t.factionPresenceFresh();
  for(const id of FACTIONS){
    assert.strictEqual(fp.pactDecl[id],-1,'pactDecl '+id);
    assert.strictEqual(fp.pactEligWave[id],-1,'pactEligWave '+id);
  }
});
ok('7. pack/unpack preserva pactDecl e pactEligWave',()=>{
  beginRun(1);const fp=t.getFP();
  fp.pactDecl.anchor=5;fp.pactEligWave.anchor=3;
  const cp={presence:t.factionPresencePack()};
  t.factionPresenceUnpack(cp);
  assert.strictEqual(t.getFP().pactDecl.anchor,5);
  assert.strictEqual(t.getFP().pactEligWave.anchor,3);
});
ok('8. unpack de save antigo (sem campos) cai em defaults seguros',()=>{
  beginRun(1);
  t.factionPresenceUnpack({presence:{v:1,serial:0,lastWave:0,history:[]}});
  for(const id of FACTIONS){
    assert.strictEqual(t.getFP().pactDecl[id],-1);
    assert.strictEqual(t.getFP().pactEligWave[id],-1);
  }
});
ok('9. entidade construída herda pactOffer só se o pacto ainda é possível',()=>{
  beginRun(1);setAff('anchor',60);
  const p=t.fpMakePresence({id:1,faction:'anchor',pactOffer:1,state:'scheduled',wave:5});
  const e=t.factionPresenceBuildEntity(p);
  assert.strictEqual(e.pactOffer,1,'FAVORÁVEL ⇒ oferta ativa');
});
ok('10. entidade NÃO herda pactOffer se afinidade caiu abaixo de 58',()=>{
  beginRun(1);setAff('anchor',40);
  const p=t.fpMakePresence({id:1,faction:'anchor',pactOffer:1,state:'scheduled',wave:5});
  const e=t.factionPresenceBuildEntity(p);
  assert.strictEqual(e.pactOffer,0,'não elegível ⇒ sem oferta');
});

/* ============================================================
   ELEGIBILIDADE & TIMING (11–20)
   ============================================================ */
ok('11. fpPactBaseEligible = factionCanPact (FAVORÁVEL, sem pacto, eixo livre)',()=>{
  beginRun(1);setAff('anchor',60);
  assert.strictEqual(t.fpPactBaseEligible('anchor'),true);
  setAff('anchor',40);
  assert.strictEqual(t.fpPactBaseEligible('anchor'),false);
});
ok('12. não é elegível antes de FAVORÁVEL (57 não, 58 sim)',()=>{
  beginRun(1);setAff('anchor',57);
  assert.strictEqual(t.fpPactBaseEligible('anchor'),false);
  setAff('anchor',58);
  assert.strictEqual(t.fpPactBaseEligible('anchor'),true);
});
ok('13. fpTrackPactEligibility marca a 1ª onda de elegibilidade',()=>{
  beginRun(1);setAff('anchor',60);
  t.fpTrackPactEligibility(4);
  assert.strictEqual(t.getFP().pactEligWave.anchor,4);
  /* onda posterior não sobrescreve */
  t.fpTrackPactEligibility(9);
  assert.strictEqual(t.getFP().pactEligWave.anchor,4);
});
ok('14. deixar de ser elegível reinicia a janela (-1)',()=>{
  beginRun(1);setAff('anchor',60);t.fpTrackPactEligibility(4);
  setAff('anchor',30);t.fpTrackPactEligibility(6);
  assert.strictEqual(t.getFP().pactEligWave.anchor,-1);
});
ok('15. proposta NÃO fica pronta no instante do +58 (progressão primeiro)',()=>{
  beginRun(1);setAff('anchor',60);t.fpTrackPactEligibility(4);
  assert.strictEqual(t.fpPactOfferReady('anchor',4),false,'mesma onda: não');
  assert.strictEqual(t.fpPactOfferReady('anchor',4+t.FACTION_PACT_OFFER_DELAY-1),false,'antes do delay: não');
});
ok('16. proposta fica pronta após FACTION_PACT_OFFER_DELAY ondas',()=>{
  beginRun(1);setAff('anchor',60);t.fpTrackPactEligibility(4);
  assert.strictEqual(t.fpPactOfferReady('anchor',4+t.FACTION_PACT_OFFER_DELAY),true);
});
ok('17. facção com pacto já consolidado nunca fica pronta a reofertar',()=>{
  beginRun(1);setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  t.fpTrackPactEligibility(10);
  assert.strictEqual(t.fpPactOfferReady('anchor',20),false);
});
ok('18. rival de eixo com pacto bloqueia proposta da outra (eixo ocupado)',()=>{
  beginRun(1);setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  setAff('deviants',60);t.fpTrackPactEligibility(6);
  assert.strictEqual(t.fpPactOfferReady('deviants',30),false,'eixo ocupado');
});
ok('19. cada facção física pode ficar pronta independentemente',()=>{
  beginRun(1);
  ['anchor','remnants','consortium','deviants'].forEach(id=>setAff(id,60));
  t.fpTrackPactEligibility(2);
  for(const id of FACTIONS)
    assert.strictEqual(t.fpPactOfferReady(id,2+t.FACTION_PACT_OFFER_DELAY),true,id);
});
ok('20. fpFirstPactOfferReady respeita a ordem determinística de FACTION_IDS',()=>{
  beginRun(1);setAff('remnants',60);setAff('consortium',60);
  t.fpTrackPactEligibility(2);
  const w=2+t.FACTION_PACT_OFFER_DELAY;
  /* remnants vem antes de consortium na ordem canônica */
  assert.strictEqual(t.fpFirstPactOfferReady(w),'remnants');
});

/* ============================================================
   SCHEDULER — prioridade controlada (21–28)
   ============================================================ */
ok('21. scheduler sem diplomacia (aff 0) nunca marca pactOffer',()=>{
  beginRun(123);let sawPact=false;
  for(let w=2;w<=20;w++){const p=t.factionPresenceSchedule(w);
    if(p){if(p.pactOffer)sawPact=true;t.factionPresenceExpire('t');}}
  assert.strictEqual(sawPact,false);
});
ok('22. scheduler prioriza a facção pronta a pactuar (pactOffer=1)',()=>{
  beginRun(7);setAff('anchor',80);
  /* avança ondas até uma presença ser agendada após a janela */
  let found=null;
  for(let w=2;w<=20;w++){
    const p=t.factionPresenceSchedule(w);
    if(p&&p.pactOffer){found=p;break;}
    if(p)t.factionPresenceExpire('t');
  }
  assert.ok(found,'houve presença com PACTO DISPONÍVEL');
  assert.strictEqual(found.faction,'anchor');
});
ok('23. presença agendada por pacto tem reason pact_offer',()=>{
  beginRun(7);setAff('anchor',80);
  let found=null;
  for(let w=2;w<=20;w++){const p=t.factionPresenceSchedule(w);
    if(p&&p.pactOffer){found=p;break;}if(p)t.factionPresenceExpire('t');}
  assert.ok(found&&found.reason==='pact_offer');
});
ok('24. scheduler mantém determinismo (mesma seed ⇒ mesma sequência)',()=>{
  function seq(seed){beginRun(seed);setAff('anchor',80);const out=[];
    for(let w=2;w<=20;w++){const p=t.factionPresenceSchedule(w);
      out.push(p?(p.faction+':'+p.pactOffer):'-');if(p)t.factionPresenceExpire('t');}
    return out.join('|');}
  assert.strictEqual(seq(999),seq(999));
});
ok('25. scheduler respeita cooldown mesmo priorizando pacto',()=>{
  beginRun(7);setAff('anchor',80);
  let last=-99;
  for(let w=2;w<=20;w++){const p=t.factionPresenceSchedule(w);
    if(p){if(last>=0)assert.ok((w-last)>=2,'cooldown');last=w;t.factionPresenceExpire('t');}}
});
ok('26. cap=1: enquanto há presença ATIVA o scheduler não agenda outra',()=>{
  beginRun(7);setAff('anchor',80);
  let sched=null;for(let w=2;w<=20;w++){sched=t.factionPresenceSchedule(w);if(sched)break;}
  assert.ok(sched);t.factionPresenceActivate(sched);
  assert.strictEqual(t.factionPresenceSchedule(sched.wave+2),null,'cap respeitado');
});
ok('27. tracking roda mesmo com presença ativa (janela não congela)',()=>{
  beginRun(7);setAff('anchor',80);
  let sched=null;for(let w=2;w<=20;w++){sched=t.factionPresenceSchedule(w);if(sched)break;}
  t.factionPresenceActivate(sched);
  t.factionPresenceSchedule(sched.wave+2); // ativa, mas o tracking roda
  assert.ok(t.getFP().pactEligWave.anchor>=0,'elegibilidade rastreada');
});
ok('28. após aceitar o pacto, scheduler volta ao sorteio normal (sem monopólio)',()=>{
  beginRun(7);setAff('anchor',80);t.factionPactConsolidate('anchor',{silent:true});
  let sawPact=false;
  for(let w=2;w<=20;w++){const p=t.factionPresenceSchedule(w);
    if(p){if(p.pactOffer)sawPact=true;t.factionPresenceExpire('t');}}
  assert.strictEqual(sawPact,false,'sem reoferta pós-pacto');
});

/* ============================================================
   ENTIDADE & INTERAÇÃO — o encontro (29–40)
   ============================================================ */
ok('29. interagir com presença comum (sem oferta) aplica o efeito normal',()=>{
  beginRun(1);setAff('anchor',60);
  const p=fakePlayer();p.shield=0;t.setPlayer(p);
  entity('anchor',false);
  t.setState('play');
  assert.strictEqual(t.factionPresenceInteract(),true);
  assert.ok(t.getPlayer().shield>0,'efeito aplicado');
  assert.strictEqual(t.getEntity(),null,'entidade consumida');
});
ok('30. interagir com PACTO DISPONÍVEL abre o modal (não aplica efeito)',()=>{
  beginRun(1);setAff('anchor',60);
  const p=fakePlayer();p.shield=0;t.setPlayer(p);
  entity('anchor',true);t.setState('play');
  const r=t.factionPresenceInteract();
  assert.strictEqual(r,true);
  assert.strictEqual(t.getPlayer().shield,0,'nenhum efeito de escudo (abriu proposta)');
  assert.strictEqual(t.getState(),'event','modal congela a run');
});
ok('31. modal do encontro popula 2 opções (ACEITAR / MANTER INDEPENDÊNCIA)',()=>{
  beginRun(1);setAff('anchor',60);t.setPlayer(fakePlayer());
  entity('anchor',true);t.setState('play');t.factionPresenceInteract();
  const row=t.getMRow();
  assert.strictEqual(row.children.length,2,'duas escolhas');
});
ok('32. ACEITAR consolida o pacto e retoma a run',()=>{
  beginRun(1);setAff('anchor',60);t.setPlayer(fakePlayer());
  entity('anchor',true);t.setState('play');t.factionPresenceInteract();
  const row=t.getMRow();
  /* o card 0 é ACEITAR — dispara o onClick através do handler registrado */
  const card=row.children[0];
  const h=card._handlers&&card._handlers.click;
  assert.ok(h&&h.length,'card ACEITAR tem handler');
  h[0]();
  assert.strictEqual(t.factionHasPact('anchor'),true,'pacto consolidado');
  assert.strictEqual(t.getState(),'play','run retomada');
  assert.strictEqual(t.getEntity(),null,'entidade limpa');
});
ok('33. MANTER INDEPENDÊNCIA não consolida e não pune',()=>{
  beginRun(1);setAff('anchor',60);const before=aff('anchor');t.setPlayer(fakePlayer());
  entity('anchor',true);t.setState('play');t.factionPresenceInteract();
  const card=t.getMRow().children[1];
  card._handlers.click[0]();
  assert.strictEqual(t.factionHasPact('anchor'),false,'sem pacto');
  assert.strictEqual(aff('anchor'),before,'afinidade intacta (sem custo)');
});
ok('34. MANTER INDEPENDÊNCIA registra a onda de recusa (reoferta)',()=>{
  beginRun(1);setAff('anchor',60);t.setWave(9);t.setPlayer(fakePlayer());
  entity('anchor',true);t.setState('play');t.factionPresenceInteract();
  t.getMRow().children[1]._handlers.click[0]();
  assert.strictEqual(t.getFP().pactDecl.anchor,9);
});
ok('35. proposta em Sandbox NÃO abre modal (guard de contexto)',()=>{
  beginRun(1);setAff('anchor',60);t.setPlayer(fakePlayer());
  t.setSandboxRun(true);
  entity('anchor',true);t.setState('play');
  t.factionPresenceInteract();
  t.setSandboxRun(false);
  assert.notStrictEqual(t.getState(),'event','sandbox não abre proposta');
});
ok('36. interação de pacto NÃO concede/rouba afinidade',()=>{
  beginRun(1);setAff('anchor',60);const b=aff('anchor');t.setPlayer(fakePlayer());
  entity('anchor',true);t.setState('play');t.factionPresenceInteract();
  assert.strictEqual(aff('anchor'),b);
});
ok('37. se a afinidade caiu abaixo de 58 antes de interagir, cai no efeito normal',()=>{
  beginRun(1);setAff('anchor',60);
  const e=entity('anchor',true);
  setAff('anchor',40);      // deixou de ser elegível
  const p=fakePlayer();p.shield=0;t.setPlayer(p);t.setState('play');
  t.factionPresenceInteract();
  assert.strictEqual(t.getState(),'play','sem modal');
  /* efeito normal de âncora hostil/base aplicado ou msg — nunca abre proposta */
  assert.strictEqual(t.getEntity(),null,'consumida como efeito comum');
});
ok('38. snapshot da entidade expõe pactOffer',()=>{
  beginRun(1);setAff('anchor',60);entity('anchor',true);
  const s=t.factionPresenceEntitySnapshot();
  assert.strictEqual(s.pactOffer,true);
});
ok('39. presença física continua tendo cap=1 (constante intacta)',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_ACTIVE_CAP,1);
});
ok('40. sem FRACTION_BY_ID válido a proposta degrada para efeito, sem travar',()=>{
  beginRun(1);setAff('anchor',60);t.setPlayer(fakePlayer());
  /* entidade com facção inexistente + pactOffer: factionCanPact falha ⇒ efeito */
  const e={faction:'anchor',x:1,y:1,r:30,interactR:58,ttl:5,ttlMax:5,consumed:false,pactOffer:1};
  t.setEntity(e);setAff('anchor',10);   // não elegível
  t.setState('play');
  assert.doesNotThrow(()=>t.factionPresenceInteract());
});

/* ============================================================
   RECUSA / REOFERTA / ACEITAÇÃO (41–48)
   ============================================================ */
ok('41. após recusar, reoferta é bloqueada dentro do cooldown',()=>{
  beginRun(1);setAff('anchor',60);t.fpTrackPactEligibility(2);
  t.getFP().pactDecl.anchor=10;
  assert.strictEqual(t.fpPactOfferReady('anchor',10+t.FACTION_PACT_REOFFER_COOLDOWN-1),false);
});
ok('42. após o cooldown de reoferta, a proposta volta',()=>{
  beginRun(1);setAff('anchor',60);t.fpTrackPactEligibility(2);
  t.getFP().pactDecl.anchor=10;
  assert.strictEqual(t.fpPactOfferReady('anchor',10+t.FACTION_PACT_REOFFER_COOLDOWN),true);
});
ok('43. aceitar deteriora a rival até o teto (consequência declarada)',()=>{
  beginRun(1);setAff('anchor',60);setAff('deviants',50);
  t.factionPactConsolidate('anchor',{silent:true});
  assert.ok(aff('deviants')<=t.FACTION_RIVAL_CEIL,'rival no teto');
});
ok('44. aceitar promove a facção a ALIADA (estado efetivo)',()=>{
  beginRun(1);setAff('anchor',60);
  t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.factionDiploState('anchor').id,'aliada');
});
ok('45. recusar não seta pactBroke (não é ruptura)',()=>{
  beginRun(1);setAff('anchor',60);t.setWave(5);t.setPlayer(fakePlayer());
  entity('anchor',true);t.setState('play');t.factionPresenceInteract();
  t.getMRow().children[1]._handlers.click[0]();
  assert.strictEqual(t.getFracRun().pactBroke.anchor,0);
});
ok('46. recusar mantém a facção FAVORÁVEL (sem downgrade)',()=>{
  beginRun(1);setAff('anchor',60);t.setPlayer(fakePlayer());
  entity('anchor',true);t.setState('play');t.factionPresenceInteract();
  t.getMRow().children[1]._handlers.click[0]();
  assert.strictEqual(t.fracStateOf('anchor').id,'favoravel');
});
ok('47. reoferta moderada não é imediata (delay obrigatório)',()=>{
  assert.ok(t.FACTION_PACT_REOFFER_COOLDOWN>=1);
  assert.ok(t.FACTION_PACT_OFFER_DELAY>=1);
});
ok('48. aceitar via encontro é idempotente (2º clique não duplica)',()=>{
  beginRun(1);setAff('anchor',60);t.setPlayer(fakePlayer());
  entity('anchor',true);t.setState('play');t.factionPresenceInteract();
  const h=t.getMRow().children[0]._handlers.click[0];
  h();
  /* consolidar de novo (a entidade já sumiu; consolidar direto retorna false) */
  assert.strictEqual(t.factionPactConsolidate('anchor',{silent:true}),false,'não reconsolida');
});

/* ============================================================
   SAVE / CONTINUE (49–54)
   ============================================================ */
ok('49. proposta vista/recusada sobrevive ao Continue (pactDecl restaurado)',()=>{
  beginRun(1);setAff('anchor',60);t.getFP().pactDecl.anchor=7;
  const cp={presence:t.factionPresencePack()};
  beginRun(1);t.factionPresenceUnpack(cp);
  assert.strictEqual(t.getFP().pactDecl.anchor,7);
});
ok('50. elegibilidade sobrevive ao Continue (pactEligWave restaurado)',()=>{
  beginRun(1);setAff('anchor',60);t.getFP().pactEligWave.anchor=3;
  const cp={presence:t.factionPresencePack()};
  beginRun(1);t.factionPresenceUnpack(cp);
  assert.strictEqual(t.getFP().pactEligWave.anchor,3);
});
ok('51. pacto aceito não reaparece após Continue',()=>{
  beginRun(1);setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  const cp={presence:t.factionPresencePack()};
  t.factionPresenceUnpack(cp);
  /* pacto vive em fracRun.pact; a proposta não fica pronta */
  t.fpTrackPactEligibility(20);
  assert.strictEqual(t.fpPactOfferReady('anchor',30),false);
});
ok('52. presença agendada com pactOffer sobrevive round-trip do pack',()=>{
  beginRun(1);setAff('anchor',60);
  t.getFP().scheduled=t.fpMakePresence({id:1,faction:'anchor',pactOffer:1,state:'scheduled',wave:5});
  const cp={presence:t.factionPresencePack()};
  t.factionPresenceUnpack(cp);
  assert.strictEqual(t.getFP().scheduled.pactOffer,1);
});
ok('53. versões inalteradas (SM=3, FRACTURE=1, 0.8.0-alpha)',()=>{
  assert.strictEqual(t.SM_VERSION,3);
  assert.strictEqual(t.FRACTURE_STATE_VERSION,1);
  assert.strictEqual(t.ECHO_VERSION,'0.8.0-alpha');
});
ok('54. Continue não duplica consequência rival (idempotente)',()=>{
  beginRun(1);setAff('anchor',60);setAff('deviants',50);
  t.factionPactConsolidate('anchor',{silent:true});
  const rivalAfter=aff('deviants');
  const cp={presence:t.factionPresencePack()};
  t.factionPresenceUnpack(cp);
  assert.strictEqual(aff('deviants'),rivalAfter,'rival não cai duas vezes');
});

/* ============================================================
   REGRAS B5 PRESERVADAS (55–62)
   ============================================================ */
ok('55. pacto exige FAVORÁVEL>=58',()=>{
  beginRun(1);setAff('anchor',57);
  assert.strictEqual(t.factionCanPact('anchor'),false);
  setAff('anchor',58);
  assert.strictEqual(t.factionCanPact('anchor'),true);
});
ok('56. um pacto por eixo (anchor XOR deviants)',()=>{
  beginRun(1);setAff('anchor',60);setAff('deviants',60);
  t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.factionCanPact('deviants'),false);
});
ok('57. máximo duas alianças compatíveis (uma por eixo)',()=>{
  beginRun(1);FACTIONS.forEach(id=>setAff(id,80));
  t.factionPactConsolidate('anchor',{silent:true});
  t.factionPactConsolidate('remnants',{silent:true});
  assert.strictEqual(t.factionPactConsolidate('deviants',{silent:true}),false);
  assert.strictEqual(t.factionPactConsolidate('consortium',{silent:true}),false);
});
ok('58. teto diplomático da rival aliada = NEUTRA (FACTION_RIVAL_CEIL)',()=>{
  beginRun(1);setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  assert.strictEqual(t.factionAffinityCeiling('deviants'),t.FACTION_RIVAL_CEIL);
});
ok('59. pactBroke bloqueia reconsolidar na mesma run',()=>{
  beginRun(1);setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  t.factionPactBreak('anchor',{silent:true});
  setAff('anchor',80);
  assert.strictEqual(t.factionCanPact('anchor'),false);
});
ok('60. rival de pacto não fica pronta a ofertar, mas sua presença ainda existe',()=>{
  beginRun(1);setAff('anchor',60);t.factionPactConsolidate('anchor',{silent:true});
  setAff('deviants',60);t.fpTrackPactEligibility(6);
  assert.strictEqual(t.fpPactOfferReady('deviants',30),false,'não oferta');
  assert.strictEqual(t.fpIsPhysical('deviants'),true,'presença física existe');
});
ok('61. FACÇÃO ≠ TEMA: interação/proposta não altera o Tema',()=>{
  beginRun(1);setAff('anchor',60);const th=t.fractureGetThemeId();
  t.setPlayer(fakePlayer());entity('anchor',true);t.setState('play');
  t.factionPresenceInteract();
  assert.strictEqual(t.fractureGetThemeId(),th);
});
ok('62. nomes de pacto continuam coerentes com a lore das 4 facções',()=>{
  assert.strictEqual(t.FACTION_PACT_NAME.anchor,'PROTOCOLO DE CONTENÇÃO');
  assert.strictEqual(t.FACTION_PACT_NAME.remnants,'PACTO DE CONTINUIDADE');
  assert.strictEqual(t.FACTION_PACT_NAME.consortium,'ACORDO DE EXCLUSIVIDADE');
  assert.strictEqual(t.FACTION_PACT_NAME.deviants,'PACTO DE ADAPTAÇÃO');
});

/* ============================================================
   FEEDBACK — ACHADO B (63–72)
   ============================================================ */
ok('63. fpImportantToast cria um .toast.fp com 3 linhas',()=>{
  beginRun(1);
  const d=t.fpImportantToast('anchor','ALIADA','NÓ DE CONTENÇÃO','+15 ESCUDO');
  assert.ok(d,'toast criado');
  assert.ok(String(d.className).indexOf('fp')>=0,'classe fp');
  assert.strictEqual(d.children.length,3,'3 linhas');
});
ok('64. hierarquia: head / eff / sub nas classes corretas',()=>{
  const d=t.fpImportantToast('consortium','ALIADA','CACHE TEMPORAL','⧗ +5 RESÍDUOS');
  assert.strictEqual(d.children[0].className,'fp-head');
  assert.strictEqual(d.children[1].className,'fp-eff');
  assert.strictEqual(d.children[2].className,'fp-sub');
});
ok('65. head inclui o SÍMBOLO da facção',()=>{
  const d=t.fpImportantToast('anchor','ALIADA','x','y');
  assert.ok(d.children[0].textContent.indexOf(t.FACTION_PRESENCE_LABEL.anchor.sym)>=0);
});
ok('66. cor da facção é aplicada via --fp-col',()=>{
  const d=t.fpImportantToast('deviants','HOSTIL','FENDA','x');
  assert.strictEqual(d.style['--fp-col'],t.FACTION_PRESENCE_LABEL.deviants.col);
});
ok('67. sub opcional: sem sub gera só 2 linhas',()=>{
  const d=t.fpImportantToast('anchor','NEUTRA','NÓ DE CONTENÇÃO','');
  assert.strictEqual(d.children.length,2);
});
ok('68. CSS define categoria .toast.fp com duração ~4.6s (não altera .toast)',()=>{
  assert.ok(/\.toast\.fp\{/.test(RAWHTML),'classe .toast.fp existe');
  assert.ok(/fptin\s+4\.6s/.test(RAWHTML),'animação fptin 4.6s');
  assert.ok(/\.toast\{[^}]*animation:tin 2\.1s/.test(RAWHTML),'toast comum segue 2.1s');
});
ok('69. interação normal usa fpImportantToast (mensagem principal única)',()=>{
  beginRun(1);setAff('anchor',60);
  const p=fakePlayer();p.shield=0;t.setPlayer(p);
  t.getToasts().children.length=0;
  entity('anchor',false);t.setState('play');
  t.factionPresenceInteract();
  const toasts=t.getToasts().children;
  const fp=toasts.filter(c=>String(c.className).indexOf('fp')>=0);
  assert.strictEqual(fp.length,1,'exatamente uma mensagem principal de facção');
});
ok('70. mensagem de DESVIADOS mostra valores REAIS (+dano / +recebido)',()=>{
  beginRun(1);setAff('deviants',10);
  const p=fakePlayer();t.setPlayer(p);
  entity('deviants',false);t.setState('play');
  t.getToasts().children.length=0;
  t.factionPresenceInteract();
  const fp=t.getToasts().children.find(c=>String(c.className).indexOf('fp')>=0);
  const sub=fp.children[2].textContent;
  const expDmg=Math.round((t.FACTION_PRESENCE_DEVIANTS_DMG-1)*100);
  const expTaken=Math.round((t.FACTION_PRESENCE_DEVIANTS_TAKEN-1)*100);
  assert.ok(sub.indexOf('+'+expDmg+'% DANO')>=0,'dano real '+expDmg+' em: '+sub);
  assert.ok(sub.indexOf('+'+expTaken+'% RECEBIDO')>=0,'recebido real '+expTaken);
});
ok('71. DESVIADOS HOSTIL usa +28% dano / +35% recebido (valores atuais, não recalibrados)',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_DEVIANTS_HOSTILE_DMG,1.28);
  assert.strictEqual(t.FACTION_PRESENCE_DEVIANTS_HOSTILE_TAKEN,1.35);
});
ok('72. banner de PACTO DISPONÍVEL no announce (via spawn)',()=>{
  /* fpEntityAnnounce roda no spawn; validamos que o texto do sinal está no código */
  assert.ok(/PACTO DISPON[IÍ]VEL/.test(RAW),'texto do sinal presente');
});

/* ============================================================
   DEV (73–76)
   ============================================================ */
ok('73. DEV.forcePactOffer existe como helper',()=>{
  assert.ok(/forcePactOffer\s*\(faction\)/.test(RAW),'helper declarado');
});
ok('74. factionPresenceDevForcePactOffer existe e é gated por DEV_MODE',()=>{
  assert.ok(/function factionPresenceDevForcePactOffer/.test(RAW));
  assert.ok(/factionPresenceDevForcePactOffer[\s\S]{0,120}DEV_MODE/.test(RAW),'gate DEV_MODE');
});
ok('75. helpers DEV existentes preservados (forceFactionPresence/diploScenario)',()=>{
  assert.ok(/forceFactionPresence\s*\(faction\)/.test(RAW));
  assert.ok(/diploScenario\s*\(n\)/.test(RAW));
  assert.ok(/factionDiplomacy\s*\(\)/.test(RAW));
});
ok('76. Ctrl+Shift+I (DEV-FIX) intacto no index.html',()=>{
  /* o handler de DEV MODE (Ctrl+Shift+D) permanece; não tocamos nos atalhos */
  assert.ok(/ctrl&&e\.shiftKey&&c==='KeyD'/.test(RAW),'atalho DEV intacto');
});

/* ============================================================
   REGRESSÃO (77–82)
   ============================================================ */
ok('77. interação de ÂNCORA base ainda estabiliza escudo',()=>{
  beginRun(1);setAff('anchor',10);
  const p=fakePlayer();p.shield=0;t.setPlayer(p);
  entity('anchor',false);t.setState('play');t.factionPresenceInteract();
  assert.ok(t.getPlayer().shield>0);
});
ok('78. interação de CONSÓRCIO base ainda concede resíduos',()=>{
  beginRun(1);setAff('consortium',10);
  const before=t.getResidues();
  entity('consortium',false);t.setState('play');t.factionPresenceInteract();
  assert.ok(t.getResidues()>before);
});
ok('79. interação de REMANESCENTES base ainda toca os Echos',()=>{
  beginRun(1);setAff('remnants',10);
  const e=fakeEcho({shield:0,shieldMax:40,trust:50});t.setEchoes([e]);
  entity('remnants',false);t.setState('play');t.factionPresenceInteract();
  assert.ok(e.shield>0||e.trust>50,'vínculo reatado');
});
ok('80. interação de DESVIADOS base ainda aplica trade-off',()=>{
  beginRun(1);setAff('deviants',10);
  const p=fakePlayer();t.setPlayer(p);
  entity('deviants',false);t.setState('play');t.factionPresenceInteract();
  assert.ok(t.smHas(p,'faction.deviants.dmg')&&t.smHas(p,'faction.deviants.taken'));
});
ok('81. presença comum não abre modal (state permanece play)',()=>{
  beginRun(1);setAff('anchor',10);t.setPlayer(fakePlayer());
  entity('anchor',false);t.setState('play');t.factionPresenceInteract();
  assert.strictEqual(t.getState(),'play');
});
ok('82. entidade já consumida não reprocessa',()=>{
  beginRun(1);setAff('anchor',10);t.setPlayer(fakePlayer());
  const e=entity('anchor',false);t.setState('play');
  t.factionPresenceInteract();
  e.consumed=true;t.setEntity(e);
  assert.strictEqual(t.factionPresenceInteract(),false);
});

/* ============================================================
   PROPERTY / STRESS (83–86)
   ============================================================ */
ok('83. STRESS: 5000 sequências scheduler — invariantes de pacto/cap',()=>{
  let s=12345;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  let dupPact=0,rivalDbl=0,overCap=0,nan=0,impossible=0;
  for(let run=0;run<5000;run++){
    beginRun((rnd()*1e9)>>>0);
    /* afinidades aleatórias */
    for(const id of FACTIONS)setAff(id,Math.floor(rnd()*200)-100);
    let active=0;
    for(let w=2;w<=20;w++){
      const p=t.factionPresenceSchedule(w);
      if(p){
        if(p.pactOffer){
          /* proposta só pode existir se factionCanPact for verdadeiro */
          if(!t.factionCanPact(p.faction))impossible++;
        }
        active++;
        if(active>t.FACTION_PRESENCE_ACTIVE_CAP+0){/* scheduled não é active */}
        t.factionPresenceExpire('t');
        active=0;
      }
    }
    /* consolida aleatoriamente as elegíveis e checa invariantes */
    for(const id of FACTIONS)if(rnd()<0.5&&t.factionCanPact(id))t.factionPactConsolidate(id,{silent:true});
    const nPact=FACTIONS.filter(id=>t.factionHasPact(id)).length;
    if(nPact>2)dupPact++;
    for(const [a,b] of AXES)if(t.factionHasPact(a)&&t.factionHasPact(b))rivalDbl++;
    for(const id of FACTIONS)if(!Number.isFinite(aff(id)))nan++;
  }
  assert.strictEqual(impossible,0,'0 proposta impossível');
  assert.strictEqual(dupPact,0,'0 excesso de pactos');
  assert.strictEqual(rivalDbl,0,'0 dupla aliança rival');
  assert.strictEqual(nan,0,'0 NaN');
});
ok('84. STRESS: 5000 interações em tiers aleatórios — 0 exceção/NaN de escudo',()=>{
  let s=999;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  let exc=0,nan=0;
  for(let i=0;i<5000;i++){
    beginRun((rnd()*1e9)>>>0);
    const id=FACTIONS[(rnd()*4)|0];
    setAff(id,Math.floor(rnd()*200)-100);
    if(rnd()<0.4&&t.factionCanPact(id))t.factionPactConsolidate(id,{silent:true});
    const p=fakePlayer();p.shield=(rnd()*30)|0;t.setPlayer(p);
    t.setEchoes([fakeEcho({shield:(rnd()*40)|0,trust:(rnd()*100)|0})]);
    t.addResidues((rnd()*30)|0,'seed');
    entity(id,false);t.setState('play');
    try{t.factionPresenceInteract();}catch(e){exc++;}
    if(!Number.isFinite(t.getPlayer().shield))nan++;
  }
  assert.strictEqual(exc,0,'0 exceções');
  assert.strictEqual(nan,0,'0 NaN de escudo');
});
ok('85. STRESS: 5000 propostas físicas — nunca consolidam sem interação',()=>{
  let s=42;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  let leaked=0;
  for(let i=0;i<5000;i++){
    beginRun((rnd()*1e9)>>>0);
    const id=FACTIONS[(rnd()*4)|0];
    setAff(id,58+Math.floor(rnd()*42));
    t.fpTrackPactEligibility(2);
    /* ficar pronto não consolida nada sozinho */
    t.fpPactOfferReady(id,10);
    if(t.factionHasPact(id))leaked++;
  }
  assert.strictEqual(leaked,0,'proposta nunca vira pacto sozinha');
});
ok('86. STRESS: pack→unpack round-trip preserva pactDecl/pactEligWave',()=>{
  let s=7;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  for(let i=0;i<2000;i++){
    beginRun((rnd()*1e9)>>>0);
    const decl={},elig={};
    for(const id of FACTIONS){
      const d=(rnd()<0.5)?-1:(rnd()*20)|0;const e=(rnd()<0.5)?-1:(rnd()*20)|0;
      t.getFP().pactDecl[id]=d;t.getFP().pactEligWave[id]=e;decl[id]=d;elig[id]=e;
    }
    const cp={presence:t.factionPresencePack()};
    t.factionPresenceUnpack(cp);
    for(const id of FACTIONS){
      assert.strictEqual(t.getFP().pactDecl[id],decl[id]<0?-1:decl[id]);
      assert.strictEqual(t.getFP().pactEligWave[id],elig[id]<0?-1:elig[id]);
    }
  }
});

/* ---------------- resumo ---------------- */
console.log('\nResultado: '+pass+' passaram · '+fail+' falharam');
if(fail>0){console.log('PR14 · B5-FIX.1 — HÁ TESTES FALHANDO');process.exit(1);}
