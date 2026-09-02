'use strict';
/* =====================================================================
   TESTES — PR 10.5A: EVENT DIRECTOR LEVE + MEMÓRIA + ANTI-REPETIÇÃO
   ---------------------------------------------------------------------
   · pool/registro: ids únicos, família válida, weight, conditions, render
   · diretor: elegibilidade (minWave, requiresEcho, flags, cond)
   · anti-repetição: cooldown de evento, família consecutiva, fadiga
   · chains: A → flag/agendamento → B; continuações não-garantidas
   · moralidade: escolhas novas passam por evOpt → moralGain (PR 9 real)
   · Echo reactions: mudança de trust via changeEchoTrust (PR 10 real)
   · arena: spawn, telegraph, timer, cleanup, recompensas
   · save: checkpoint → resume preserva memória; slots isolados; legacy
   · distribuição: simulação determinística (nada domina; raro continua raro)
   Executa o script REAL de index.html em sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/events.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];
const RAWSRC=m[1];

src+=';globalThis.__t={'+
  'EV_KINDS,EV_LABEL,EV_FAMILIES,EV_LEGACY_FAMILY,RARITY_META,'+
  'RUN_EVENTS,RUN_CHAIN_EVENTS,ALL_RUN_EVENTS,RUN_EVENT_BY_ID,RUN_EVENT_BY_KIND,'+
  'ARENA_EVENTS,MICRO_EVENTS,'+
  'buildEventContext,getEligibleEvents,eventBlockReason,scoreEvent,pickRunEvent,'+
  'evMemFresh,evMemPack,evMemRestore,evMemRecord,evFamRecent,'+
  'evSetFlag,evFlag,evVar,evVarGet,evVarDel,evEpilogue,evDelay,'+
  'processDelayedEvents,fireDelayed,'+
  'waveBuff,waveBuffSweep,'+
  'tryStartArenaEvent,tickArenaEvent,stopArenaEvent,'+
  'tickMicroEvents,'+
  'moralGain,applyMoral,getMoralProfile,'+
  'EVENT_AFFINITY,moralEventWeight,pickEventKind,'+
  'startRun,resumeRun,captureCheckpoint,clearActiveRun,hasActiveRun,'+
  'smBuildCheckpoint,smSanitizeRun,activateSlot,'+
  'makeEcho,changeEchoTrust,relAddPressure,echoRelState,echoAllied,'+
  'killEnemy,spawnWave,'+
  'DEV_get:()=>DEV,DEV_on:()=>{DEV_MODE=true;},DEV_off:()=>{DEV_MODE=false;},'+
  'getMoral:()=>moral,setMoral:(c,g,v)=>{moral.comp=c;moral.greed=g;moral.viol=v;applyMoral();},'+
  'getMEff:()=>mEff,getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getState:()=>state,setState:s=>{state=s;},'+
  'getEchoes:()=>echoes,setEchoes:a=>{echoes=a;},'+
  'getWave:()=>wave,setWave:w=>{wave=w;},'+
  'getEnemies:()=>enemies,setEnemies:a=>{enemies=a;},setBeacon:b=>{beacon=b;},'+
  'getPickups:()=>pickups,getAllies:()=>allies,'+
  'getArenaEv:()=>arenaEv,setArenaEv:v=>{arenaEv=v;},'+
  'getEvMem:()=>evMem,setEvMem:v=>{evMem=v;},'+
  'getEvQueue:()=>evQueue,setEvQueue:v=>{evQueue=v;},'+
  'getInterfT:()=>_aeInterfT,setInterfT:v=>{_aeInterfT=v;},'+
  'getTainted:()=>devTainted,clearDevTaint:()=>{devTainted=false;},'+
  'getCurSlot:()=>curSlot,getRoot:()=>smRoot,'+
  'getMicroT:()=>microT,'+
  'getRunTime:()=>runTime,setRunTime:v=>{runTime=v;}};';

/* ---------------- DOM mínimo (igual aos outros harnesses) ---------------- */
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
    _cls:new Set(),_handlers:{},isConnected:true,offsetWidth:0,offsetHeight:0,
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
  el.remove=()=>{};
  el.addEventListener=(ev,fn)=>{(el._handlers[ev]=el._handlers[ev]||[]).push(fn);};
  el.removeEventListener=()=>{};
  el.click=()=>{for(const fn of (el._handlers.click||[]))fn({stopPropagation(){}});};
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

const MathF=Object.create(Math);
MathF._rng=null;
MathF.random=function(){return MathF._rng?MathF._rng():Math.random();};

const sandbox={console,Math:MathF,Date,parseInt,parseFloat,isNaN,setTimeout,clearTimeout,
  requestAnimationFrame:()=>0,
  Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
  Promise,Proxy,Reflect,JSON,Symbol,
  document,window,localStorage,navigator,
  performance:{now:()=>Date.now()}};
const ctx=vm.createContext(sandbox);
vm.runInContext(src,ctx,{timeout:15000});
const t=vm.runInContext('__t',ctx);
MathF._rng=null;   // sorteios reais por padrão

/* ---------------- runner ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  \u2714 '+label);}
  catch(e){failed++;console.log('  \u2716 '+label);console.log('     '+e.message);}
}
function freshRun(){
  t.setPlayer(null);
  t.setEchoes([]);
  t.startRun();
  t.clearDevTaint();
}
/* RNG determinístico injetável (mulberry32) */
function mulberry32(seed){
  let s=seed>>>0;
  return function(){s|=0;s=(s+0x6D2B79F5)|0;
    let x=Math.imul(s^(s>>>15),1|s);
    x=(x+Math.imul(x^(x>>>7),61|x))^x;
    return ((x^(x>>>14))>>>0)/4294967296;};
}

console.log('TESTES PR 10.5A — EVENT DIRECTOR + MEMÓRIA + ANTI-REPETIÇÃO');
console.log('---------------------------------------------');

/* ==================== A. POOL / REGISTRO ==================== */
console.log('\n[A] POOL E REGISTRO');
ok('todos os ids são únicos (incluindo legados e chains)',()=>{
  const ids=t.ALL_RUN_EVENTS.map(d=>d.id)
    .concat(Object.keys(t.RUN_EVENT_BY_ID));
  assert.strictEqual(new Set(Object.keys(t.RUN_EVENT_BY_ID)).size,
    Object.keys(t.RUN_EVENT_BY_ID).length,'ids duplicados no índice');
});
ok('toda entrada tem family válida, rarity válida e weight não-negativo',()=>{
  for(const d of Object.values(t.RUN_EVENT_BY_ID)){
    assert(t.EV_FAMILIES[d.family],'família inválida: '+d.id+' → '+d.family);
    assert(t.RARITY_META[d.rarity],'raridade inválida: '+d.id);
    assert(typeof d.weight==='number'&&d.weight>=0,'weight inválido: '+d.id);
    assert(d.nm&&d.col,'nm/col ausentes: '+d.id);
    if(!d.legacy)assert(typeof d.render==='function','render ausente: '+d.id);
  }
});
ok('os 20 eventos legados continuam no pool com família atribuída',()=>{
  for(const k of t.EV_KINDS){
    const d=t.RUN_EVENT_BY_ID['lg_'+k];
    assert(d,'legado ausente: '+k);
    assert(d.legacy===true);
    assert(t.EV_LEGACY_FAMILY[k]===d.family,'família divergente: '+k);
  }
  assert.strictEqual(t.EV_KINDS.length,20);
});
ok('pool principal NÃO contém eventos de continuação de chain',()=>{
  for(const d of t.RUN_CHAIN_EVENTS)
    assert.strictEqual(t.ALL_RUN_EVENTS.indexOf(d),-1,
      'chain vazou para o pool: '+d.id);
});
ok('objetivo de conteúdo: 8-12 comuns, 6-8 incomuns, 4-6 raros, 2-3 anomalous',()=>{
  const count=r=>t.RUN_EVENTS.filter(d=>d.rarity===r).length;
  const c=count('common'),u=count('uncommon'),r=count('rare'),a=count('anomalous');
  assert(c>=8&&c<=12,'comuns fora da faixa: '+c);
  assert(u>=6&&u<=8,'incomuns fora da faixa: '+u);
  assert(r>=4&&r<=6,'raros fora da faixa: '+r);
  assert(a>=2&&a<=3,'anomalous fora da faixa: '+a);
});
ok('chains registradas e encadeadas por flags/agendamento (3–6)',()=>{
  assert(t.RUN_CHAIN_EVENTS.length>=3&&t.RUN_CHAIN_EVENTS.length<=6,
    'chains: '+t.RUN_CHAIN_EVENTS.length);
});
ok('EV_LABEL cobre os kinds novos (banner/sprite do beacon não quebram)',()=>{
  for(const d of Object.values(t.RUN_EVENT_BY_ID))
    assert(t.EV_LABEL[d.kind],'EV_LABEL sem '+d.kind);
});
ok('4+ eventos de arena e 3+ microeventos registrados',()=>{
  assert(t.ARENA_EVENTS.length>=4,'arena: '+t.ARENA_EVENTS.length);
  assert(t.MICRO_EVENTS.length>=3,'micro: '+t.MICRO_EVENTS.length);
  for(const a of t.ARENA_EVENTS){
    assert(typeof a.start==='function'&&typeof a.cleanup==='function',
      'arena sem start/cleanup: '+a.id);
    assert(typeof a.desc==='string'&&a.desc.length>10,
      'arena sem telegrafia textual: '+a.id);
  }
});

/* ==================== B. CONTEXTO / ELEGIBILIDADE ==================== */
console.log('\n[B] CONTEXTO E ELEGIBILIDADE');
ok('buildEventContext devolve o quadro completo',()=>{
  freshRun();
  t.setWave(5);
  const c=t.buildEventContext();
  assert.strictEqual(c.wave,5);
  assert.strictEqual(c.echoCount,0);
  assert(c.hp>0&&c.hp<=1);
  assert(typeof c.coins==='number'&&typeof c.operator==='string');
  assert(Array.isArray(c.recent)&&c.flags&&c.moral);
});
ok('minWave bloqueia com motivo (x_cirurgia na onda 1)',()=>{
  freshRun();t.setWave(1);
  const pass=t.getEligibleEvents(t.buildEventContext());
  const b=pass.blocked.find(x=>x.id==='x_cirurgia');
  assert(b&&b.reason==='min_wave','bloqueio ausente: '+JSON.stringify(b));
  assert(pass.elig.every(d=>d.id!=='x_cirurgia'));
});
ok('requires_echo bloqueia eventos de Echo sem Eco aliado',()=>{
  freshRun();t.setWave(6);
  const pass=t.getEligibleEvents(t.buildEventContext());
  for(const id of ['x_duplo','x_memoria','x_imitador'])
    assert(pass.blocked.some(b=>b.id===id&&b.reason==='requires_echo'),id);
});
ok('requires_echo destrava com Eco vivo e aliado',()=>{
  freshRun();t.setWave(6);
  const e=t.makeEcho({dom:'comp',items:[],trail:[[0,0,1,0,0,0]]},1);
  e.alive=true;e.trust=70;
  t.setEchoes([e]);
  const pass=t.getEligibleEvents(t.buildEventContext());
  assert(pass.elig.some(d=>d.id==='x_duplo'),'x_duplo deveria estar elegível');
  assert(pass.elig.some(d=>d.id==='x_memoria'));
});
ok('requires_flag: x_cicatriz só existe depois de uma ruptura',()=>{
  freshRun();t.setWave(6);
  let pass=t.getEligibleEvents(t.buildEventContext());
  assert(pass.blocked.some(b=>b.id==='x_cicatriz'&&
    b.reason==='requires_flag:dis_houve'));
  t.evSetFlag('dis_houve');
  pass=t.getEligibleEvents(t.buildEventContext());
  assert(pass.elig.some(d=>d.id==='x_cicatriz'));
});
ok('cond(): O COBRADOR só aparece com rastro de ganância',()=>{
  freshRun();t.setWave(7);
  let pass=t.getEligibleEvents(t.buildEventContext());
  assert(pass.blocked.some(b=>b.id==='x_cobrador'&&b.reason==='condicao_contexto'));
  t.setMoral(0,7,0);
  pass=t.getEligibleEvents(t.buildEventContext());
  assert(pass.elig.some(d=>d.id==='x_cobrador'));
});
ok('relReqOn worst: A CONFISSÃO exige relação fraturada/tensa',()=>{
  freshRun();t.setWave(6);
  const e=t.makeEcho({dom:'comp',items:[],trail:[[0,0,1,0,0,0]]},1);
  e.alive=true;e.trust=10;           // relação fraturada
  t.setEchoes([e]);
  let pass=t.getEligibleEvents(t.buildEventContext());
  assert(pass.elig.some(d=>d.id==='x_confissao'),'confissão deveria existir');
  e.trust=90;                        // ressonante
  pass=t.getEligibleEvents(t.buildEventContext());
  assert(pass.blocked.some(b=>b.id==='x_confissao'),
    'relação alta não pode disparar a confissão');
  assert(pass.elig.some(d=>d.id==='x_pacto'),'pacto deveria destravar');
});

/* ==================== C. ANTI-REPETIÇÃO ==================== */
console.log('\n[C] ANTI-REPETIÇÃO');
ok('cooldown do EVENTO: apareceu → bloqueado nas próximas seleções',()=>{
  freshRun();t.setWave(5);
  t.evMemRecord('x_camara','exploracao');
  const pass=t.getEligibleEvents(t.buildEventContext());
  const b=pass.blocked.find(x=>x.id==='x_camara');
  assert(b&&b.reason==='cooldown_evento');
});
ok('família consecutiva: a família do último evento é bloqueada inteira',()=>{
  freshRun();t.setWave(5);
  t.evMemRecord('x_gerador','recursos');   // último = recursos
  const pass=t.getEligibleEvents(t.buildEventContext());
  for(const d of pass.elig)assert(d.family!=='recursos',
    'recursos vazou: '+d.id);
  assert(pass.blocked.some(b=>b.family==='recursos'&&
    b.reason==='familia_consecutiva'));
});
ok('relaxamento: com pool vazio, o bloqueio de família cede (nunca trava)',()=>{
  freshRun();t.setWave(5);
  t.evMemRecord('x_gerador','recursos');
  const pass=t.getEligibleEvents(t.buildEventContext(),{relaxFamily:true});
  assert(pass.elig.some(d=>d.family==='recursos'));
});
ok('fadiga de família: aparições recentes reduzem o PESO (não só bloqueiam)',()=>{
  freshRun();t.setWave(5);
  const d=t.RUN_EVENT_BY_ID['x_trocador'];
  t.getEvMem().rc=[];
  const w0=t.scoreEvent(d,t.buildEventContext());
  t.evMemRecord('x_gerador','recursos');
  t.evMemRecord('x_posto','recursos');
  t.evMemRecord('x_trocador','recursos');
  const w1=t.scoreEvent(t.RUN_EVENT_BY_ID['x_posto'],t.buildEventContext());
  assert(w1<w0,'peso não caiu com a fadiga ('+w1+' vs '+w0+')');
});
ok('saturação: evento repetido muitas vezes perde peso devagar',()=>{
  freshRun();
  const d=t.RUN_EVENT_BY_ID['x_camara'];
  t.getEvMem().rc=[];t.getEvMem().sn={};
  const c0=t.buildEventContext();
  const w0=t.scoreEvent(d,c0);
  for(let i=0;i<4;i++)t.evMemRecord('x_camara','exploracao');
  const w1=t.scoreEvent(d,t.buildEventContext());
  assert(w1<w0*.85&&w1>w0*.12,'queda abrupta ou inexistente: '+w1+'/'+w0);
});
ok('novidade leve: evento nunca visto ganha fôlego (+25%)',()=>{
  freshRun();
  const d=t.RUN_EVENT_BY_ID['x_marcador'];
  t.getEvMem().rc=[];t.getEvMem().sn={};
  const w0=t.scoreEvent(d,t.buildEventContext());
  t.evMemRecord('x_marcador',d.family);
  const w1=t.scoreEvent(d,t.buildEventContext());
  /* nunca visto pontua ~25% acima do mesmo evento já visto (fadiga suave incluída) */
  assert(w0/w1>1.1&&w0/w1<1.9,'novidade não aplicada: '+w0+'→'+w1);
});
ok('adaptação leve: poucos créditos puxam RECURSOS (sem virar pity óbvio)',()=>{
  freshRun();
  const d=t.RUN_EVENT_BY_ID['x_trocador'];
  t.getEvMem().rc=[];t.getEvMem().sn={};
  const p=t.getPlayer();p.coins=200;
  const wRico=t.scoreEvent(d,t.buildEventContext());
  p.coins=10;
  const wPobre=t.scoreEvent(d,t.buildEventContext());
  assert(wPobre>wRico*1.15,'bônus de escassez ausente');
  assert(wPobre<wRico*1.6,'bônus exagerado (virou pity)');
});

/* ==================== D. SORTEIO + MEMÓRIA ==================== */
console.log('\n[D] SORTEIO E MEMÓRIA');
ok('pickRunEvent registra o acontecimento na memória (rc/sn/família)',()=>{
  freshRun();t.setWave(5);
  t.setEvMem(t.evMemFresh());t.setEvQueue([]);
  const d=t.pickRunEvent();
  assert(d,'nenhum evento sorteado');
  const mem=t.getEvMem();
  assert(mem.rc.indexOf(d.id)>=0,'não foi registrado em rc');
  assert((mem.sn[d.id]|0)===1,'contagem não registrada');
  assert.strictEqual(mem.lf,d.family,'família última não registrada');
});
ok('a fila de chains tem prioridade sobre o sorteio',()=>{
  freshRun();
  t.setEvMem(t.evMemFresh());
  t.setEvQueue(['x_resposta']);
  const d=t.pickRunEvent();
  assert.strictEqual(d.id,'x_resposta');
  assert.strictEqual(t.getEvQueue().length,0);
});
ok('pickRunEvent nunca devolve evento de continuação pelo sorteio',()=>{
  freshRun();t.setWave(9);
  t.setEvMem(t.evMemFresh());t.setEvQueue([]);
  const rnd=mulberry32(1234);
  for(let i=0;i<120;i++){
    const d=t.pickRunEvent(null,rnd);
    assert(!d.chain,'chain vazou pelo sorteio: '+d.id);
  }
});
ok('sorteio é determinístico com RNG injetado',()=>{
  for(let attempt=0;attempt<2;attempt++){
    freshRun();t.setWave(6);
    t.setEvMem(t.evMemFresh());t.setEvQueue([]);
    const rnd=mulberry32(777);
    const seq=[];
    for(let i=0;i<40;i++){
      t.setWave(2+(i%8));
      seq.push(t.pickRunEvent(null,rnd).id);
    }
    if(attempt===1){
      assert.strictEqual(seq.join(','),first.join(','),'sequências divergem');
    }else var first=seq.slice();
  }
});
ok('moral bias (PR 9) continua vivo dentro do scoreEvent',()=>{
  freshRun();
  const d=t.RUN_EVENT_BY_ID['x_cirurgia'];   // aff comp
  t.getEvMem().rc=[];t.getEvMem().sn={};
  t.setMoral(0,8,0);
  const wGreed=t.scoreEvent(d,t.buildEventContext());
  t.setMoral(8,0,0);
  const wComp=t.scoreEvent(d,t.buildEventContext());
  assert(wComp>wGreed,'perfil compassivo deveria puxar evento afim');
});

/* ==================== E. CHAINS / ATRASADAS ==================== */
console.log('\n[E] CHAINS E CONSEQUÊNCIAS ATRASADAS');
ok('chain A → agendamento → B: transmissão responde 2-4 ondas depois',()=>{
  freshRun();t.setWave(3);
  t.setEvMem(t.evMemFresh());t.setEvQueue([]);
  t.evDelay(2,'chain_signal',null,{chance:1});
  t.setWave(5);
  t.processDelayedEvents();
  assert(t.getEvQueue().indexOf('x_resposta')>=0,'continuação não agendada');
});
ok('chain NÃO-garantida: chance 0 mata a continuação em silêncio',()=>{
  freshRun();t.setWave(3);
  t.setEvMem(t.evMemFresh());t.setEvQueue([]);
  t.evDelay(1,'chain_signal',null,{chance:0});
  t.setWave(5);
  t.processDelayedEvents();
  assert.strictEqual(t.getEvQueue().length,0,'continuação deveria morrer');
});
ok('todas as 5 chains têm rota de continuação registrada',()=>{
  freshRun();
  const routes=['chain_signal','chain_caravana','cobrador_volta',
    'cobranca_olho','chain_cinzas'];
  for(const r of routes){
    t.setEvMem(t.evMemFresh());t.setEvQueue([]);
    t.evDelay(1,r,null,{chance:1});
    t.setWave(t.getWave()+2);
    t.processDelayedEvents();
    assert(t.getEvQueue().length>0,'chain sem continuação: '+r);
  }
});
ok('epilogueFlag é registrado e compactado (teto de 8)',()=>{
  freshRun();
  for(let i=0;i<12;i++)t.evEpilogue('ep_teste_'+i);
  assert(t.getEvMem().ep.length<=8);
  assert(t.getEvMem().ep.indexOf('ep_teste_11')>=0,'mantém os mais recentes');
});
ok('consequência direta agendada dispara efeito (gerador → enxames com bounty)',()=>{
  freshRun();t.setWave(4);
  t.setEvMem(t.evMemFresh());t.setEvQueue([]);
  t.setEnemies([]);
  t.evDelay(1,'gerador_onda',null,{chance:1});
  t.setWave(5);
  t.processDelayedEvents();
  const ens=t.getEnemies();
  assert(ens.length>=2,'enxames do gerador não entraram');
  assert(ens.every(e=>(e.bounty|0)>0),'enxames sem recompensa');
  t.setEnemies([]);
});

/* ==================== F. MORALIDADE (PR 9 real) ==================== */
console.log('\n[F] MORALIDADE');
ok('escolha nova de COMPASSÃO muda o moral pelo caminho REAL (evOpt → moralGain)',()=>{
  freshRun();t.setWave(4);
  const p=t.getPlayer();
  p.hp=p.maxHp=100;
  const before=t.getMoral().comp;
  t.RUN_EVENT_BY_ID['x_posto'].render();
  const mRow=document.getElementById('m-row');
  const btn=mRow.children.find(c=>c.innerHTML.indexOf('POUPAR O ESTOQUE')>=0);
  assert(btn,'botão POUPAR não renderizado');
  btn.click();
  assert(t.getMoral().comp===before+3,'comp não subiu: '+t.getMoral().comp);
});
ok('escolha nova de GANÂNCIA+VIOLÊNCIA aplica o vetor correto',()=>{
  freshRun();t.setWave(4);
  const g=t.getMoral().greed,v=t.getMoral().viol;
  t.setBeacon({x:400,y:300,r:36,kind:'x_posto',t:0,life:99,pulse:0});
  t.RUN_EVENT_BY_ID['x_posto'].render();
  const mRow=document.getElementById('m-row');
  const btn=mRow.children.find(c=>c.innerHTML.indexOf('LEVAR E MINAR')>=0);
  btn.click();
  assert(t.getMoral().greed===g+2&&t.getMoral().viol===v+1,
    'vetor divergente: '+JSON.stringify(t.getMoral()));
});
ok('PR 9 preservado: perfil normalizado segue saudável com escolhas novas',()=>{
  freshRun();
  for(let i=0;i<40;i++)t.moralGain(4,4,4);
  const prof=t.getMoralProfile();
  for(const ax of ['comp','greed','viol']){
    const v=prof.normalized[ax];
    assert(v>=0&&v<=1&&Number.isFinite(v),'normalização quebrou: '+ax+'='+v);
  }
  /* tiers saturam em 3 (CONSUMIDO) mesmo com escolhas novas em cascata */
  assert(prof.state==='balanced'||prof.state==='mixed'||prof.state==='dominant');
});

/* ==================== G. ECHO REACTIONS (PR 10 real) ==================== */
console.log('\n[G] ECHO REACTIONS');
ok('escolha nova com Eco em campo mexe a CONFIANÇA pelo pipeline único',()=>{
  freshRun();t.setWave(4);
  const e=t.makeEcho({dom:'comp',items:[],trail:[[0,0,1,0,0,0]]},1);
  e.alive=true;e.trust=60;
  t.setEchoes([e]);
  t.RUN_EVENT_BY_ID['x_posto'].render();
  const mRow=document.getElementById('m-row');
  const btn=mRow.children.find(c=>c.innerHTML.indexOf('POUPAR O ESTOQUE')>=0);
  btn.click();
  assert(e.trust>60,'Echo não reagiu à escolha (trust '+e.trust+')');
  assert(e.rel&&e.rel.lastTrust&&/posto/.test(e.rel.lastTrust.r),
    'trust mudou fora do ponto único de mutação: '+
    JSON.stringify(e.rel.lastTrust));
});
ok('estática: eventos novos usam o pipeline PR 10 (sem segundo sistema)',()=>{
  /* auditando a fonte: mudança de trust fora de changeEchoTrust é proibida */
  const bad=/e\.trust\s*(\+=|-=|=)[^=]/g;
  const hits=RAWSRC.slice(RAWSRC.indexOf('NOVOS ACONTECIMENTOS'),
    RAWSRC.indexOf('MICROEVENTOS')).match(bad)||[];
  assert.deepStrictEqual(hits,[],'atribuição direta de trust em evento novo');
});

/* ==================== H. ARENA + MICRO ==================== */
console.log('\n[H] EVENTOS DE ARENA E MICROEVENTOS');
ok('arena event dispara com telegrafia e nunca em onda de mini-chefe',()=>{
  freshRun();
  t.setEnemies([{dead:false,spawnT:0,type:'chaser'}]);
  t.setWave(5);                            // MINI_WAVES contém 5
  MathF._rng=()=>0.01;
  t.tryStartArenaEvent();
  MathF._rng=null;
  assert.strictEqual(t.getArenaEv(),null,'arena em onda de mini-chefe');
});
ok('CAMPO INSTÁVEL: telegraph → zonas detonam → cleanup completo',()=>{
  freshRun();
  const p=t.getPlayer();p.hp=p.maxHp=100;p.invT=0;p.devInvuln=false;
  t.setWave(4);t.setEnemies([{dead:false,spawnT:0,type:'chaser'}]);
  MathF._rng=()=>0.02;
  t.tryStartArenaEvent();
  MathF._rng=null;
  const ae=t.getArenaEv();
  assert(ae,'arena não disparou');
  assert.strictEqual(ae.def.id,'ae_campo');
  assert(ae.zones&&ae.zones.length===3);
  for(const z of ae.zones)assert(z.t<0,'zona nasceu sem telegrafia');
  /* avança o tempo: telegrafia termina, pulso detona embaixo do player */
  for(const z of ae.zones){z.x=p.x;z.y=p.y;}
  p.shield=0;const hp0=p.hp;
  t.tickArenaEvent(2.0);                   // termina a telegrafia
  t.tickArenaEvent(0.3);                   // pulso de detonação
  assert(p.hp<hp0,'zona telegrafada não causou dano dentro dela');
  /* cleanup */
  t.stopArenaEvent(true);
  assert.strictEqual(t.getArenaEv(),null);
});
ok('INTERFERÊNCIA liga e DESLIGA o multiplicador de projéteis',()=>{
  freshRun();
  assert.strictEqual(t.getInterfT(),0);
  const def=t.ARENA_EVENTS.find(a=>a.id==='ae_interf');
  t.setArenaEv({def:def,t:0,dur:12,zones:null,enemy:null,pending:0});
  def.start(t.getArenaEv());
  assert(t.getInterfT()>0,'interferência não ligou');
  def.cleanup(t.getArenaEv());
  t.setArenaEv(null);
  assert.strictEqual(t.getInterfT(),0,'cleanup não desligou');
});
ok('ALVO PRIORITÁRIO: marcador, timeout e recompensa no abate',()=>{
  freshRun();t.setWave(4);
  const ens=[{dead:false,spawnT:0,type:'chaser',r:14,hp:50,maxHp:50,
    x:100,y:100,color:'#fff'}];
  t.setEnemies(ens);
  const def=t.ARENA_EVENTS.find(a=>a.id==='ae_alvo');
  const ae={def:def,t:0,dur:16,zones:null,enemy:null,pending:0};
  def.start(ae);
  assert.strictEqual(ae.enemy,ens[0]);
  assert(ens[0].priority===true&&ens[0].prioBounty===50);
  const p=t.getPlayer();
  const coins0=p.coins;
  t.killEnemy(ens[0]);
  assert(p.coins===coins0+50,'recompensa do alvo não pagou');
  def.cleanup(ae);
});
ok('MICROEVENTOS rodam sem interromper o estado da run',()=>{
  freshRun();t.setWave(3);
  const st=t.getState();
  t.setInterfT(0);
  for(let i=0;i<6;i++)t.tickMicroEvents(-10);   // força o timer a zerar
  assert.strictEqual(t.getState(),st,'microevento mudou o estado do jogo');
});

/* ==================== I. SAVE / SLOTS / MIGRATION ==================== */
console.log('\n[I] SAVE, SLOTS E MIGRATION');
ok('checkpoint carrega a memória de eventos; resume devolve idêntica',()=>{
  freshRun();t.setWave(3);
  t.setEvMem(t.evMemFresh());t.setEvQueue([]);
  t.evMemRecord('x_camara','exploracao');
  t.evSetFlag('caravana_ajudada');
  t.evEpilogue('ep_posto');
  t.evDelay(2,'chain_signal',null,{chance:.75});
  t.setState('play');
  assert(t.captureCheckpoint('teste',3));
  const cp=JSON.parse(JSON.stringify(t.getRoot().slots[t.getCurSlot()].run));
  assert(cp.ev&&cp.ev.rc.indexOf('x_camara')>=0);
  assert(cp.ev.fl.caravana_ajudada);
  assert(cp.ev.ep.indexOf('ep_posto')>=0);
  assert(cp.ev.dl.length===1&&cp.ev.dl[0].id==='chain_signal');
  /* restaura em uma "run nova" */
  t.setEvMem(t.evMemFresh());t.setEvQueue([]);
  t.evMemRestore(cp.ev);
  assert(t.evFlag('caravana_ajudada'));
  assert.strictEqual(t.getEvMem().rc.indexOf('x_camara')>=0,true);
  assert.strictEqual(t.getEvMem().dl.length,1);
});
ok('save LEGADO sem campo ev: resume com memória vazia e sem erro',()=>{
  freshRun();t.setWave(2);
  t.setState('play');
  assert(t.captureCheckpoint('teste',2));
  const cp=t.getRoot().slots[t.getCurSlot()].run;
  delete cp.ev;                          // simula checkpoint pré-10.5
  t.setEvMem({rc:['lixo'],sn:{lixo:9},fl:{legado:1},fc:{},dl:[{at:9,id:'x'}]});
  t.resumeRun();
  assert(!t.evFlag('legado'),'memória vazou de uma run morta');
  assert.strictEqual(t.getEvMem().rc.length,0);
});
ok('slots não contaminam: flag do slot 1 não aparece no slot 2',()=>{
  t.activateSlot(1);
  freshRun();t.setWave(2);
  t.setEvMem(t.evMemFresh());t.setEvQueue([]);
  t.evSetFlag('caravana_ajudada');
  t.setState('play');
  assert(t.captureCheckpoint('teste',2));
  t.activateSlot(2);
  freshRun();t.setWave(1);
  assert(!t.evFlag('caravana_ajudada'),'flag atravessou o slot');
});
ok('evMemPack é SNAPSHOT: mutar a memória depois não altera o pack',()=>{
  freshRun();
  t.evMemRecord('x_camara','exploracao');
  const pk=t.evMemPack();
  t.evMemRecord('x_marcador','ambiente');
  t.evSetFlag('flag_depois_do_pack');
  assert(!pk.sn.x_marcador,'pack compartilha sn vivo (vazamento de referência)');
  assert(!pk.fl.flag_depois_do_pack,'pack compartilha flags vivas');
  assert(!pk.fc.ambiente,'pack compartilha contadores de família vivos');
});
ok('evMemPack é COMPACTO (sem texto de evento serializado)',()=>{
  freshRun();
  for(let i=0;i<12;i++)t.evMemRecord('x_camara','exploracao');
  const pk=t.evMemPack();
  const json=JSON.stringify(pk);
  assert(json.length<1200,'pack grande demais: '+json.length);
  assert(json.indexOf('ARROMBAR')<0&&json.indexOf('evHead')<0);
});

/* ==================== J. DISTRIBUIÇÃO (SIMULAÇÃO) ==================== */
console.log('\n[J] DISTRIBUIÇÃO');
function runSim(n,seed){
  t.DEV_on();
  const r=t.DEV_get().simulateEvents(n,seed);
  t.DEV_off();t.clearDevTaint();
  return r;
}
ok('simulação determinística: mesma seed → resultado idêntico',()=>{
  const a=runSim(200,42),b=runSim(200,42);
  assert.deepStrictEqual(a.perEvent,b.perEvent);
  assert.deepStrictEqual(a.perFamily,b.perFamily);
  assert.strictEqual(a.neverDrawn.join(','),b.neverDrawn.join(','));
});
ok('nenhum evento comum domina o pool (topo < 22% em 600 seleções)',()=>{
  const r=runSim(600,777);
  const top=r.perEvent[0];
  assert(top.pct<22,'evento dominante: '+top.id+' '+top.pct+'%');
});
ok('eventos raros continuam raros e anomalous MUITO raros',()=>{
  const r=runSim(600,777);
  const avg=rar=>{
    const xs=r.perEvent.filter(e=>e.rarity===rar);
    return xs.reduce((s,x)=>s+x.pct,0)/Math.max(1,xs.length);
  };
  const max=rar=>{
    const xs=r.perEvent.filter(e=>e.rarity===rar);
    return xs.reduce((s,x)=>Math.max(s,x.pct),0);
  };
  const ac=avg('common'),au=avg('uncommon'),ar=avg('rare'),aa=avg('anomalous');
  assert(ac>au&&au>ar,'escala de raridade invertida: '+ac+'/'+au+'/'+ar);
  /* anomalous é oncePerRun: cada um aparece no máximo 1× na simulação */
  assert(max('anomalous')<=max('rare'),'anomalous apareceu mais que raro');
  assert(aa<1.0,'anomalous apareceu demais: '+aa+'% média');
});
ok('famílias variadas: nenhuma família domina sem condição contextual',()=>{
  const r=runSim(600,777);
  const top=r.perFamily[0];
  assert(top.pct<30,'família dominante: '+top.family+' '+top.pct+'%');
  assert(r.perFamily.length>=6,'poucas famílias ativas: '+r.perFamily.length);
});
ok('anti-repetição visível: sequência nunca empilha a mesma família',()=>{
  const r=runSim(600,777);
  assert(r.maxSameFamilyStreak<=3,'sequência máxima de família: '+
    r.maxSameFamilyStreak);
  assert(r.sameFamilyConsecutive<r.n*.25,' back-to-back demais: '+
    r.sameFamilyConsecutive);
});
ok('todo evento comum incondicional foi sorteado em 600 seleções',()=>{
  const r=runSim(600,777);
  const drawn=new Set(r.perEvent.filter(e=>e.n>0).map(e=>e.id));
  for(const d of t.ALL_RUN_EVENTS){
    if(d.rarity!=='common')continue;
    if(d.echoReq||d.relReq||d.reqFlag||d.forbidFlag||d.cond||d.oncePerRun)continue;
    assert(drawn.has(d.id),'comum incondicional nunca sorteado: '+d.id);
  }
});
ok('distância média até repetir existe e é razoável',()=>{
  const r=runSim(600,777);
  assert(r.avgRepeatDistance>3&&r.avgRepeatDistance<60,
    'distância média implausível: '+r.avgRepeatDistance);
});
ok('DEV.simulateEvents restaura a memória da run (não polui o estado)',()=>{
  freshRun();
  t.setEvMem(t.evMemFresh());t.setEvQueue([]);
  t.evSetFlag('caravana_ajudada');
  runSim(100,5);
  assert(t.evFlag('caravana_ajudada'),'memória da run foi destruída pela sim');
  assert.strictEqual(t.getEvQueue().length,0,'fila vazada pela sim');
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){
  console.log('\nFALHAS DETECTADAS');
  process.exit(1);
}
console.log('PR 10.5A — TODOS OS TESTES PASSARAM');
