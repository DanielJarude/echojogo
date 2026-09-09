'use strict';
/* =====================================================================
   TESTES — PR 14: PRESENÇA DE FACÇÃO (BLOCO 2 · FUNDAÇÃO)
   ---------------------------------------------------------------------
   Cobre a fundação estrutural (sem gameplay visual):
   · contrato de dados serializável (fpMakePresence);
   · estado runtime próprio (factionPresenceRun) separado de fracRun/fractureRun;
   · scheduler DETERMINÍSTICO (RNG do Diretor, nunca Math.random);
   · cap = 1 presença ativa; cooldown; sem duplicar na mesma onda;
   · emissor real de faction_reaction (DT-4) — sem tocar Tema/Intensidade;
   · coexistência com o beacon singleton (reserva) (DT-2);
   · tag opcional em allies (DT-3), retrocompatível;
   · afinidade é SÓ lida (nenhum +aff/-aff automático);
   · lifecycle/cleanup em death/victory/reset/new run;
   · Save/Continue (cp.presence) aditivo, save antigo carrega, sem duplicar;
   · Sandbox isolado; SM_VERSION=3; FRACTURE_STATE_VERSION=1; versão 0.9.0-alpha;
   · eventos antigos (12 FACTION_RUN_EVENTS + 4 FRAC_CONTACT_EVENTS) intactos;
   · stress determinístico (centenas de seeds × ondas 1–20).
   Rodar: npm test  |  node tests/pr14-b2-faction-presence.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const mm=html.match(/<script>([\s\S]*?)<\/script>/);
if(!mm)throw new Error('script não encontrado em index.html');
let src=mm[1];
src+=';globalThis.__t={'+
  /* contrato + constantes */
  'FACTION_PRESENCE_KINDS,FACTION_PRESENCE_STATES,FACTION_PRESENCE_ACTIVE_CAP,'+
  'FACTION_PRESENCE_HIST_MAX,FACTION_PRESENCE_COOLDOWN,FACTION_PRESENCE_MIN_WAVE,'+
  'fpMakePresence,fpValidFaction,'+
  /* estado + api */
  'factionPresenceFresh,factionPresenceBeginRun,factionPresenceEndRun,'+
  'factionPresenceForgetRun,factionPresenceSchedule,factionPresenceActivate,'+
  'factionPresenceResolve,factionPresenceExpire,factionPresenceCleanup,'+
  'factionPresencePack,factionPresenceUnpack,factionPresenceSnapshot,'+
  'factionPresenceSandboxContextStart,factionPresenceSandboxTearDown,'+
  'factionPresenceDevText,factionPresenceKitBoot,'+
  'fpDeterministicSeed,fpRng,fpPickFaction,fpEligibleFactions,fpEmitFactionReaction,'+
  'canUseBeaconForFactionPresence,fpTagAlly,'+
  /* estado vivo (acessores) */
  'getFP:()=>factionPresenceRun,setFP:v=>{factionPresenceRun=v;},'+
  'getBeacon:()=>beacon,setBeacon:v=>{beacon=v;},'+
  'getFx:()=>fractureRun,'+
  'getAllies:()=>allies,setAllies:v=>{allies=v;},'+
  /* facções + fratura (para asserts de não-contaminação) */
  'FACTION_IDS,FRACTION_BY_ID,getFactionAffinity,getFactionState,'+
  'getFracRun:()=>fracRun,fracFresh,setFracRun:v=>{fracRun=v;},'+
  'fractureBeginRun,fractureEndRun,fractureGetThemeId,fractureGetIntensity,'+
  'fractureSetSeed,fractureGetSeed,fractureRun2:()=>fractureRun,'+
  'ALL_RUN_EVENTS,FACTION_RUN_EVENTS,FRAC_CONTACT_EVENTS,'+
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

/* helper: inicia uma run de facção-presença limpa + Diretor com seed.
   factionPresenceBeginRun() já atribui a global; devolvemos via getFP(). */
function beginPresenceRun(seed){
  t.fractureBeginRun();
  if(seed!=null)t.fractureSetSeed(seed>>>0);
  t.factionPresenceBeginRun();
  return t.getFP();
}

console.log('\n=== PR14 · B2 — PRESENÇA DE FACÇÃO (FUNDAÇÃO) ===');

/* 1. contrato válido */
ok('1. contrato: fpMakePresence normaliza campos e é serializável',()=>{
  const p=t.fpMakePresence({id:3,faction:'anchor',kind:'signal',state:'scheduled',wave:5,seed:123,reason:'x'});
  assert.strictEqual(p.faction,'anchor');
  assert.strictEqual(p.kind,'signal');
  assert.strictEqual(p.wave,5);
  assert.doesNotThrow(()=>JSON.parse(JSON.stringify(p)));
  /* sem funções/DOM/closures */
  for(const k in p)assert.notStrictEqual(typeof p[k],'function');
});

/* 2. quatro facções reconhecidas */
ok('2. as quatro facções são válidas; lixo é rejeitado',()=>{
  for(const id of ['anchor','remnants','consortium','deviants'])
    assert.ok(t.fpValidFaction(id),id);
  assert.ok(!t.fpValidFaction('collapse'));   // Tema não é facção
  assert.ok(!t.fpValidFaction('__proto__'));
  assert.ok(!t.fpValidFaction(null));
  const p=t.fpMakePresence({faction:'nope'});
  assert.strictEqual(p.faction,null);
});

/* 3. cap = 1 */
ok('3. cap de presença ativa é 1',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_ACTIVE_CAP,1);
});

/* 4. IDs únicos */
ok('4. scheduler gera ids seriais únicos e crescentes',()=>{
  beginPresenceRun(12345);
  const ids=[];
  for(let w=2;w<=20;w++){
    const p=t.factionPresenceSchedule(w);
    if(p){ids.push(p.id);
      /* resolve/expira para liberar o cap e permitir o próximo */
      t.factionPresenceExpire('test');}
  }
  assert.ok(ids.length>=2,'esperava múltiplos agendamentos ('+ids.length+')');
  const uniq=new Set(ids);
  assert.strictEqual(uniq.size,ids.length,'ids repetidos');
  for(let i=1;i<ids.length;i++)assert.ok(ids[i]>ids[i-1],'ids não crescem');
});

/* 5+6. escolha determinística — mesma seed → mesmo resultado */
ok('5/6. mesma seed ⇒ mesma sequência de decisões',()=>{
  function seq(seed){
    beginPresenceRun(seed);
    const out=[];
    for(let w=2;w<=20;w++){
      const p=t.factionPresenceSchedule(w);
      out.push(p?(p.faction+':'+p.kind+':'+p.wave):'-');
      if(p)t.factionPresenceExpire('test');
    }
    return out.join('|');
  }
  const a=seq(777),b=seq(777);
  assert.strictEqual(a,b,'não determinístico');
});

/* 7. seeds diferentes permitem variedade */
ok('7. seeds diferentes produzem resultados variados',()=>{
  function firstPick(seed){
    beginPresenceRun(seed);
    for(let w=2;w<=20;w++){const p=t.factionPresenceSchedule(w);
      if(p)return p.faction;t.factionPresenceExpire('test');}
    return null;
  }
  const factions=new Set();
  for(let s=1;s<=60;s++){const f=firstPick(s*2654435761>>>0);if(f)factions.add(f);}
  assert.ok(factions.size>=2,'esperava variedade de facções ('+factions.size+')');
});

/* 8/9/10. scheduler NÃO altera Tema, Intensidade nem composição */
ok('8/9/10. scheduler não altera Tema/Intensidade do Diretor',()=>{
  beginPresenceRun(4242);
  const themeBefore=t.fractureGetThemeId();
  const intBefore=t.fractureGetIntensity();
  for(let w=2;w<=20;w++){t.factionPresenceSchedule(w);t.factionPresenceExpire('test');}
  assert.strictEqual(t.fractureGetThemeId(),themeBefore,'Tema mudou!');
  assert.strictEqual(t.fractureGetIntensity(),intBefore,'Intensidade mudou!');
});

/* 11/12/13. faction_reaction é emitido com payload mínimo e facção válida */
ok('11/12/13. fpEmitFactionReaction emite faction_reaction válido',()=>{
  beginPresenceRun(9);
  const p=t.fpMakePresence({id:1,faction:'remnants',kind:'signal',wave:5,reason:'r'});
  const r=t.fpEmitFactionReaction(p,'agendada');
  assert.ok(r,'sem retorno');
  assert.strictEqual(r.ev,'faction_reaction');
  assert.strictEqual(r.ok,true);
  assert.strictEqual(r.delta,0,'faction_reaction não pode mudar Intensidade');
});

/* 11b. faction_reaction NÃO altera Tema nem Intensidade (contrato i:0) */
ok('11b. faction_reaction não muda Tema nem Intensidade',()=>{
  beginPresenceRun(31);
  const th=t.fractureGetThemeId(),it=t.fractureGetIntensity();
  const p=t.fpMakePresence({id:1,faction:'deviants',kind:'emissary',wave:7});
  for(let i=0;i<10;i++)t.fpEmitFactionReaction(p,'spam');
  assert.strictEqual(t.fractureGetThemeId(),th);
  assert.strictEqual(t.fractureGetIntensity(),it);
});

/* 14/15. history registra e respeita cap */
ok('14/15. history registra e respeita o cap',()=>{
  const fp=beginPresenceRun(55);
  for(let i=0;i<200;i++){
    t.factionPresenceSchedule((i%19)+2);
    t.factionPresenceExpire('test');
  }
  assert.ok(fp.history.length<=t.FACTION_PRESENCE_HIST_MAX,
    'history estourou o cap: '+fp.history.length);
});

/* 16. não duplica na mesma wave */
ok('16. não agenda duas presenças na mesma onda',()=>{
  beginPresenceRun(88);
  let target=null,first=null;
  for(let w=2;w<=20;w++){const p=t.factionPresenceSchedule(w);
    if(p){target=w;first=p;break;}}
  assert.ok(target!=null,'nenhum agendamento para testar');
  const again=t.factionPresenceSchedule(target);
  assert.strictEqual(again&&again.id,first.id,'retornou presença diferente na mesma onda');
});

/* 17. cooldown funciona */
ok('17. cooldown mínimo entre agendamentos é respeitado',()=>{
  const fp=beginPresenceRun(4444);
  let lastScheduledWave=-99;
  for(let w=2;w<=20;w++){
    const p=t.factionPresenceSchedule(w);
    if(p){
      if(lastScheduledWave>=0)
        assert.ok((w-lastScheduledWave)>=t.FACTION_PRESENCE_COOLDOWN,
          'cooldown violado: '+lastScheduledWave+' → '+w);
      lastScheduledWave=w;
      t.factionPresenceExpire('test');
    }
  }
});

/* 18/19. afinidade é SÓ lida — nenhum +aff/-aff automático */
ok('18/19. scheduler não altera afinidade (fracRun.aff intacto)',()=>{
  t.fractureBeginRun();t.fractureSetSeed(2024);
  t.setFracRun(t.fracFresh());
  const fr=t.getFracRun();
  fr.aff.anchor=40;fr.aff.remnants=-30;fr.aff.consortium=10;fr.aff.deviants=0;
  const snap=JSON.stringify(fr.aff);
  t.factionPresenceBeginRun();
  for(let w=2;w<=20;w++){t.factionPresenceSchedule(w);t.factionPresenceExpire('test');}
  assert.strictEqual(JSON.stringify(t.getFracRun().aff),snap,'afinidade foi modificada!');
});

/* 20/21/22. beacon antigo continua funcional; coexistência/reserva */
ok('20/21/22. presença coexiste com beacon singleton (não o destrói)',()=>{
  beginPresenceRun(17);
  /* sem beacon: pode reservar */
  t.setBeacon(null);
  assert.strictEqual(t.canUseBeaconForFactionPresence(),true);
  /* beacon de evento vivo: NÃO pode tomar */
  const b={x:1,y:2,r:36,kind:'survivor',t:0,life:38,pulse:0};
  t.setBeacon(b);
  assert.strictEqual(t.canUseBeaconForFactionPresence(),false);
  /* o beacon existente permanece intacto */
  assert.strictEqual(t.getBeacon(),b);
  assert.strictEqual(t.getBeacon().kind,'survivor');
  t.setBeacon(null);
});

/* 23/24. allies antigos continuam válidos; tag opcional */
ok('23/24. fpTagAlly é retrocompatível e só anota origem',()=>{
  const old={x:0,y:0,vx:0,vy:0,r:11,dropT:10,t:0};           // aliado legado
  const snapshot=JSON.stringify(old);
  const untagged=t.fpTagAlly(old,'not_a_faction',5);
  assert.strictEqual(JSON.stringify(untagged),snapshot,'facção inválida não deve tocar o aliado');
  const tagged=t.fpTagAlly({x:0,y:0,r:11},'consortium',7);
  assert.strictEqual(tagged.faction,'consortium');
  assert.strictEqual(tagged.origin,'faction');
  assert.strictEqual(tagged.presenceId,7);
  /* comportamento (fighter/turret) não é criado nem removido */
  assert.strictEqual('fighter' in tagged,false);
});

/* 25/26/27/28. cleanup remove presença em resolve/expire/end */
ok('25/26/27/28. lifecycle: activate/resolve/expire/cleanup',()=>{
  const fp=beginPresenceRun(63);
  let p=null;
  for(let w=2;w<=20;w++){p=t.factionPresenceSchedule(w);if(p)break;}
  assert.ok(p,'nenhum agendamento');
  const a=t.factionPresenceActivate(p);
  assert.ok(a&&fp.active,'não ativou');
  /* cap: segunda ativação é rejeitada */
  const p2=t.fpMakePresence({id:999,faction:'anchor',kind:'signal',wave:9});
  assert.strictEqual(t.factionPresenceActivate(p2),null,'cap violado');
  t.factionPresenceResolve('done');
  assert.strictEqual(fp.active,null,'resolve não limpou');
  /* endRun limpa tudo */
  t.factionPresenceEndRun();
  assert.strictEqual(t.getFP(),null,'endRun não zerou o estado');
});

/* 29/30. save antigo carrega; campo ausente usa default */
ok('29/30. unpack de save sem cp.presence usa default seguro',()=>{
  const fp=t.factionPresenceUnpack({});         // sem .presence
  assert.ok(fp,'não criou estado');
  assert.strictEqual(fp.active,null);
  assert.strictEqual(fp.scheduled,null);
  assert.strictEqual(fp.serial,0);
  assert.ok(Array.isArray(fp.history)&&fp.history.length===0,'history não é vazio');
  const fp2=t.factionPresenceUnpack(null);       // cp nulo
  assert.ok(fp2&&fp2.active===null);
});

/* 31. Continue não duplica reação (pack→unpack preserva, não re-emite) */
ok('31. pack/unpack preserva estado sem duplicar (Continue fiel)',()=>{
  const fp=beginPresenceRun(101);
  let sched=null;
  for(let w=2;w<=20;w++){sched=t.factionPresenceSchedule(w);if(sched)break;}
  assert.ok(sched,'nada agendado');
  const packed=t.factionPresencePack();
  assert.ok(packed&&packed.scheduled,'scheduled não persistiu');
  const restored=t.factionPresenceUnpack({presence:packed});
  assert.strictEqual(restored.serial,fp.serial,'serial divergiu');
  assert.strictEqual(restored.lastWave,fp.lastWave,'lastWave divergiu (cooldown quebraria)');
  assert.strictEqual(restored.scheduled.faction,sched.faction);
  assert.strictEqual(restored.scheduled.wave,sched.wave);
  /* re-agendar a MESMA onda após restore não cria uma segunda intenção */
  const again=t.factionPresenceSchedule(restored.scheduled.wave);
  assert.strictEqual(again.id,restored.scheduled.id,'duplicou intenção no Continue');
});

/* 32/33. SM_VERSION=3 e FRACTURE_STATE_VERSION=1 intactos */
ok('32/33. SM_VERSION=3 e FRACTURE_STATE_VERSION=1',()=>{
  assert.strictEqual(t.SM_VERSION,3);
  assert.strictEqual(t.FRACTURE_STATE_VERSION,1);
});

/* 34. Sandbox não vaza estado */
ok('34. Sandbox: contexto isolado, não persiste',()=>{
  t.setSandboxRun(true);
  const started=t.factionPresenceSandboxContextStart();
  assert.strictEqual(started,true);
  assert.ok(t.getFP(),'sandbox não criou contexto');
  t.factionPresenceSandboxTearDown();
  assert.strictEqual(t.getFP(),null,'teardown não limpou');
  t.setSandboxRun(false);
  /* fora do sandbox, contextStart recusa */
  assert.strictEqual(t.factionPresenceSandboxContextStart(),false);
});

/* 35. sem Math.random direto no scheduler (fonte) */
ok('35. fonte: bloco fp1 não usa Math.random',()=>{
  const INI='/* ==================== PR14·bloco fp1.js ==================== */';
  const FIM='/* ==================== PR14·fim fp1.js ==================== */';
  const a=html.indexOf(INI),b=html.indexOf(FIM);
  assert.ok(a>=0&&b>a,'marcadores do bloco fp1 ausentes');
  const seg=html.slice(a,b);
  assert.ok(seg.indexOf('Math.random')<0,'Math.random encontrado no bloco fp1');
});

/* 35b. fonte: bloco fp1 nunca escreve fractureRun (FACÇÃO ≠ TEMA) */
ok('35b. fonte: bloco fp1 não escreve em fractureRun',()=>{
  const INI='/* ==================== PR14·bloco fp1.js ==================== */';
  const FIM='/* ==================== PR14·fim fp1.js ==================== */';
  const seg=html.slice(html.indexOf(INI),html.indexOf(FIM));
  assert.ok(!/fractureRun\s*\.\s*\w+\s*(\+=|-=|\*=|=[^=])/.test(seg),'escrita em fractureRun.x');
  assert.ok(!/fractureRun\s*=\s*[^=]/.test(seg),'atribuição de fractureRun');
});

/* 36. ausência de presença = early return barato (sem estado) */
ok('36. sem run de presença, schedule é inócuo (early-return)',()=>{
  t.setFP(null);
  assert.strictEqual(t.factionPresenceSchedule(5),null);
  assert.strictEqual(t.factionPresenceResolve('x'),false);
  assert.strictEqual(t.factionPresenceCleanup(),false);
  assert.strictEqual(t.factionPresenceSnapshot(),null);
});

/* 37/38/39. eventos antigos continuam registrados */
ok('37/38/39. eventos de facção antigos intactos (12 + 4)',()=>{
  assert.strictEqual(t.FACTION_RUN_EVENTS.length,12,'FACTION_RUN_EVENTS != 12');
  assert.strictEqual(t.FRAC_CONTACT_EVENTS.length,4,'FRAC_CONTACT_EVENTS != 4');
  /* todos permanecem no pool geral */
  for(const e of t.FACTION_RUN_EVENTS)
    assert.ok(t.ALL_RUN_EVENTS.indexOf(e)>=0,'evento sumiu do pool: '+e.id);
});

/* 40. versão permanece 0.9.0-alpha (runtime + package) */
ok('40. versão runtime/package = 0.9.0-alpha',()=>{
  assert.strictEqual(t.ECHO_VERSION,'0.9.0-alpha');
  const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  assert.strictEqual(pkg.version,'0.9.0-alpha');
});

/* ---------------- B2-V — STRESS / DETERMINISMO ---------------- */
ok('STRESS: 300 seeds × ondas 1–20 — invariantes preservadas',()=>{
  for(let s=1;s<=300;s++){
    const seed=(s*2654435761)>>>0;
    beginPresenceRun(seed);
    const fp=t.getFP();
    const themeBefore=t.fractureGetThemeId();
    const intBefore=t.fractureGetIntensity();
    for(let w=1;w<=20;w++){
      const p=t.factionPresenceSchedule(w);
      /* nunca >1 ativa (schedule só cria intenção; activate controla o cap) */
      assert.ok(!(fp.active&&fp.scheduled&&fp.active===fp.scheduled),'estado impossível');
      if(p){
        assert.ok(t.fpValidFaction(p.faction),'facção inválida seed='+seed+' w='+w);
        assert.ok(Number.isFinite(p.wave)&&!Number.isNaN(p.wave),'wave NaN');
        assert.ok(p.wave>=t.FACTION_PRESENCE_MIN_WAVE,'agendou antes da onda mínima');
        assert.ok(t.FACTION_PRESENCE_KINDS.indexOf(p.kind)>=0,'kind inválido');
        /* libera para a próxima onda poder agendar */
        t.factionPresenceExpire('stress');
      }
    }
    assert.ok(fp.history.length<=t.FACTION_PRESENCE_HIST_MAX,'history explodiu');
    /* Tema/Intensidade jamais mudam por causa da presença */
    assert.strictEqual(t.fractureGetThemeId(),themeBefore,'Tema mudou no stress');
    assert.strictEqual(t.fractureGetIntensity(),intBefore,'Intensidade mudou no stress');
  }
});

/* ---------------- resumo ---------------- */
console.log('\nResultado: '+pass+' passaram · '+fail+' falharam');
if(fail>0){console.log('FALHAS DETECTADAS');process.exit(1);}
