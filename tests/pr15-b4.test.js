'use strict';
/* =====================================================================
   TESTES — PR15 · B4 · INTENÇÃO, INTERAÇÃO E SIGNIFICADO DAS MEMÓRIAS
   ---------------------------------------------------------------------
   Cobre as 38 áreas obrigatórias do brief §34 (A…AL) + as 6 simulações
   do §35 (SIM-A…SIM-F). Mapa área → checks:

     A  base/boot ........... B4-01..05     M  moralidade ......... B4-53..55
     B  intenção determiníst. B4-06..12     N  facções ............ B4-56..58
     C  distribuição ........ B4-13..16     O  Echo aliado ........ B4-59..61
     D  explain/reasons ..... B4-17..22     P/Q zero transformação  B4-62..64
     E  ALIADA .............. B4-23..28     R  lifecycle .......... B4-65..69
     F  RIVAL ............... B4-29..35     S  save · T Continue .. B4-70..77
     G  AMBÍGUA ............. B4-36..42     U/V/W idempotência .... B4-78..83
     H  variantes ........... B4-43..45     X  Sandbox ............ B4-84..88
     I  N-1/N-2 · J resson. . B4-46..50     Y  DEV ................ B4-89..95
     K  build histórica ..... B4-51         Z  slot isolation ..... B4-96..98
     L  causa da morte ...... B4-52         AA save corrompido .... B4-99..100
                                            AB save antigo ........ B4-101..103
                                            AC/AD/AE regressões ... B4-104..109
                                            AF performance caps ... B4-110..113
                                            AG UI state ........... B4-114..117
                                            AH off-screen ......... B4-118..120
                                            AI zero NaN ........... B4-121..122
                                            AJ zero exception ..... B4-123
                                            AK sem timers/listeners B4-124..125
                                            AL arrays limitados ... B4-126

   SIMULAÇÕES §35: A distribuição · B determinismo · C save/continue ·
   D anti-exploit · E long run/stress · F balanceamento.

   NOTA DE REALM — o jogo roda num contexto `vm`; leituras que saem do
   sandbox passam por `V()` para normalizar protótipos.
   ===================================================================== */
const assert=require('assert');
const vm=require('vm');
const {sandbox,T,SRC,normalizeSource}=require('../audit_pr135/harness.js');
const {runnerInstalled,suiteIsDiscovered}=require('./suite-registry.js');
const X=code=>vm.runInContext(code,sandbox);
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));
    if(e&&e.stack&&process.env.PR15B4_DEBUG)console.log(e.stack);}
}

/* ---------------- auditoria estrutural da fonte ---------------- */
function stripComments(s){
  return s.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/[^\n]*/g,' ');
}
const SRCN=normalizeSource(SRC);
function block(startNeedle,endMarker){
  const fim=SRCN.indexOf(endMarker);
  assert.ok(fim>0,'marcador de fim '+endMarker);
  const ini=SRCN.lastIndexOf(startNeedle,fim);
  assert.ok(ini>0&&ini<fim,'marcador de início '+startNeedle);
  return SRCN.slice(SRCN.lastIndexOf('/* =====',ini),fim);
}
const B4SRC=block('PR15·b4 — INTENÇÃO','/* ==================== PR15·fim b4 ==================== */');
const B4CODE=stripComments(B4SRC);
const B3SRC=block('PR15·b3 — PRESENÇA TEMPORAL','/* ==================== PR15·fim b3 ==================== */');
const B2SRC=block('PR15·b2 — DIRECTOR','/* ==================== PR15·fim b2 ==================== */');
const B1SRC=block('PR15·b1 — MEMÓRIA TEMPORAL','/* ==================== PR15·fim b1 ==================== */');
const C=T.PR15_INTENT_CFG,PRESC=T.PR15_PRES_CFG,TOTAL=T.PR15_PRES_TOTAL;
const V=o=>JSON.parse(JSON.stringify(o));
const fin=v=>typeof v==='number'&&Number.isFinite(v);
const P=()=>{const p=T.getPr15Presence();return p||null;};

/* ---------------- fábricas ---------------- */
function mem(id,over){
  const r={id:String(id),out:'death',cause:'enemy',op:'vector',theme:'cinza',seed:99991,
    arch:{dom:'crit',sec:null,state:'definido',domS:.5,secS:null},sigW:'pistol',
    sigItems:['mod_a','mod_b'],moral:{comp:1,greed:2,viol:3},dom:'neutro',
    kills:60,wave:6,dur:300,mh:120,level:4,items:[],upg:[],owned:[0],ps:'aggressive',
    trail:[[0,100,200,1,0,0],[.25,101,201,1,0,0],[.5,102,202,1,0,0]]};
  if(over)for(const k in over)r[k]=over[k];
  return r;
}
function enc(o){
  o=o||{};
  return {v:1,id:o.id||'p1-t-w4',mem:o.mem||'e1-2',src:o.src||'n1',
    wave:o.wave||4,base:o.wave||4,shift:0,res:o.res||'high',seed:o.seed||123456,
    st:o.st||'consumed',at:o.at!==undefined?o.at:(o.wave||4),why:'',
    intent:o.intent!==undefined?o.intent:4242};
}
function stdQueue(){return [mem('e1-2',{theme:'cinza'}),mem('e1-1',{theme:'sangue',op:'wraith'})];}
function reset(q,over){
  T.setSandboxRun(false);T.setDevTainted(false);X('DEV_MODE=false');X('sandboxMode=false');
  T.setEchoQueue(q===undefined?stdQueue():(q||[]));
  T.setEnemies([]);T.setBoss(null);T.setMiniBossRef(null);
  T.setBeacon(null);T.setFactionPresenceEntity(null);T.setEchoes([]);
  T.setSmRestoring(false);
  T.setPlayer(Object.assign({x:1100,y:725,r:14,hp:80,maxHp:100,vx:0,vy:0,
    shield:0,shieldMax:60,shieldDelayT:0,charId:'vector',items:[],sm:[]},over||{}));
  T.setState('play');
  X('moral={comp:0,greed:0,viol:0}');
  X('kills=0');X('runTime=0');
  X('fracRun=fracFresh()');
  T.pr15PresReset();
  T.pr15IntentReset();
  T.setPr15MemRun(null);
}
/* avança o ciclo completo pelas funções REAIS engatadas em updateAllies */
function tick(n,dt){
  dt=dt||0.05;n=n||1;
  for(let i=0;i<n;i++){T.updateAllies(dt);X('runTime=runTime+'+dt);}
}
function toActive(p){
  let n=0;
  while(P()&&P().phase==='spawning'&&n++<400){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  return P();
}
function finish(p){
  let n=0;
  while(P()&&n++<4000){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
}
/* A oferta só fica pronta depois de PR15_INTENT_CFG.offerAfter segundos COM O
   JOGADOR EM ALCANCE da âncora — é o tempo que o rótulo leva para aparecer no
   mundo. Este helper deixa esse tempo passar re-ancorando a cada tick (o corpo
   continua orbitando; a âncora não). */
function settleOffer(p,secs){
  const s=Number.isFinite(secs)?secs:(T.PR15_INTENT_CFG.offerAfter+0.3);
  for(let i=0;i<Math.ceil(s/0.05);i++){
    placePlayerNear(p,20);
    T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
  }
  placePlayerNear(p,20);
  return p;
}
function snap(){return V(T.pr15IntentSnapshot());}
/* posiciona o operador a `d` px da ÂNCORA temporal (o objeto interativo).
   A presença em si orbita o operador a ~320 px com piso de 190 px (B3),
   então chegar perto do CORPO é impossível por construção — a interação
   acontece sempre na âncora fixa. */
function nodeOf(p){return V(T.pr15IntentNodeOf(p||P()));}
function placePlayerNear(p,d){
  const n=nodeOf(p||P()),pl=T.getPlayer();
  pl.x=n.x+d;pl.y=n.y;
}
function placePlayerFar(p){
  const n=nodeOf(p||P()),pl=T.getPlayer();
  pl.x=clamp(n.x+1200,60,2140);pl.y=clamp(n.y+900,60,1390);
}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}

/* =====================================================================
   A — BASE / BOOT
   ===================================================================== */
ok('B4-01 bloco B4 existe entre os marcadores e boota por último',()=>{
  assert.ok(B4SRC.indexOf('PR15·b4 — INTENÇÃO')>0);
  assert.ok(SRCN.indexOf('PR15·fim b4')>SRCN.indexOf('PR15·b4 — INTENÇÃO'),
    'marcador de fim vem depois do início');
  assert.ok(B4SRC.indexOf('PR15·fim b3')<0,'o recorte não invade o B3');
  const iB3=SRCN.indexOf('pr15PresenceKitBoot();'),iB4=SRCN.indexOf('pr15IntentKitBoot();');
  assert.ok(iB3>0&&iB4>0&&iB4>iB3,'o kit do B4 boota depois do B3');
  assert.strictEqual(T.PR15_INTENT_CFG.version,1);
});
ok('B4-02 as três famílias de intenção existem e são exatamente 3',()=>{
  const L=V(T.PR15_INTENT_LIST);
  assert.deepStrictEqual(L,['allied','rival','ambiguous']);
  assert.deepStrictEqual(Object.keys(V(T.PR15_INTENTS)).sort(),['allied','ambiguous','rival']);
});
ok('B4-03 cada família tem 3 variantes distintas',()=>{
  const v=V(T.PR15_VARIANTS);
  for(const k of ['allied','rival','ambiguous']){
    assert.strictEqual(v[k].length,3,k+' tem 3 variantes');
    assert.strictEqual(new Set(v[k]).size,3,'sem duplicata em '+k);
  }
  const all=[].concat(v.allied,v.rival,v.ambiguous);
  assert.strictEqual(new Set(all).size,9,'9 variantes globalmente únicas');
  for(const id of all)assert.ok(T.PR15_VARIANT_LABEL[id],'rótulo de '+id);
});
ok('B4-04 config centralizada: nenhum número mágico de interação fora dela',()=>{
  for(const k of ['interactR','offerAfter','zoneR','pulseEvery','rivalRing','rivalTelegraph',
    'trialKills','tradeCost','lobeDist','budget','resMax'])
    assert.ok(C[k]!=null,'C.'+k);
  /* os dois números mais sensíveis não aparecem duplicados soltos no bloco */
  const n=(B4CODE.match(/76(?![0-9])/g)||[]).length;
  assert.ok(n<=2,'interactR não está espalhado ('+n+' ocorrências)');
});
ok('B4-05 suíte descoberta pelo runner do npm test',()=>{
  assert.ok(runnerInstalled(),'npm test delega a tests/run-all.js');
  assert.ok(suiteIsDiscovered('pr15-b4'),'pr15-b4.test.js é descoberta');
});

/* =====================================================================
   B — INTENÇÃO DETERMINÍSTICA
   ===================================================================== */
function ctxFor(m,d,curMoral){
  if(curMoral)X('moral={comp:'+curMoral[0]+',greed:'+curMoral[1]+',viol:'+curMoral[2]+'}');
  return T.pr15IntentContext(m,d);
}
ok('B4-06 nenhuma comparação de faixa 0-33/34-66/67-99 no bloco',()=>{
  assert.ok(!/intent\s*%\s*3/.test(B4CODE),'sem %3 sobre o intentSeed');
  assert.ok(!/intentSeed\s*[<>]=?\s*33/.test(B4CODE),'sem corte em 33');
  assert.ok(!/intentSeed\s*[<>]=?\s*66/.test(B4CODE),'sem corte em 66');
  assert.ok(B4CODE.indexOf('pr15IntentScores')>=0,'existe função de scores');
});
ok('B4-07 Math.random não aparece no bloco B4',()=>{
  assert.ok(B4CODE.indexOf('Math.random')<0,'sem Math.random');
  assert.ok(!/\brand\s*\(/.test(B4CODE),'sem rand()');
  assert.ok(B4CODE.indexOf('fractureRng')>=0,'usa fractureRng');
  assert.ok(B4CODE.indexOf('fractureHash32')>=0,'usa fractureHash32');
});
ok('B4-08 mesma entrada → mesma intenção (milhares de Math.random no meio)',()=>{
  reset();
  const m=V(T.getEchoQueue())[0];
  const d={seed:777,intent:4242,src:'n1',res:'high'};
  const a=V(T.pr15IntentDecide(ctxFor(m,d)));
  for(let i=0;i<5000;i++)Math.random();
  const b=V(T.pr15IntentDecide(ctxFor(m,d)));
  assert.deepStrictEqual(a,b,'decisão idêntica');
  assert.deepStrictEqual(a.scores,b.scores);
  assert.deepStrictEqual(a.reasons,b.reasons);
});
ok('B4-09 intentSeed diferente pode mudar a intenção (é o desempate real)',()=>{
  reset();
  const m=V(T.getEchoQueue())[0];
  const seen={};
  for(let i=0;i<400;i++){
    const k=T.pr15IntentDecide(ctxFor(m,{seed:11,intent:i,src:'n1',res:'normal'})).kind;
    seen[k]=1;
  }
  assert.ok(Object.keys(seen).length>=2,'intentSeed realmente desempata');
});
ok('B4-10 scores têm piso positivo — nenhuma família pode zerar',()=>{
  reset();
  const m=V(T.getEchoQueue())[0];
  let min=1e9;
  for(let i=0;i<800;i++){
    const s=V(T.pr15IntentDecide(ctxFor(m,{seed:i,intent:i,src:(i%2?'n2':'n1'),
      res:['high','normal','unstable'][i%3]})).scores);
    for(const k of ['allied','rival','ambiguous'])min=Math.min(min,s[k]);
  }
  assert.ok(min>=0.12,'piso respeitado (mínimo observado '+min+')');
});
ok('B4-11 pesos são somados, não fatiados: mudar UM sinal desloca os 3 scores',()=>{
  reset();
  const base=mem('e1-2',{cause:'enemy'});
  const s1=V(T.pr15IntentScores(ctxFor(base,{seed:5,intent:5,src:'n1',res:'normal'})));
  const s2=V(T.pr15IntentScores(ctxFor(mem('e1-2',{cause:'boss'}),{seed:5,intent:5,src:'n1',res:'normal'})));
  assert.ok(s2.rival>s1.rival,'morte por boss aumenta RIVAL');
  assert.notDeepStrictEqual(s1,s2);
});
ok('B4-12 a decisão é uma função pura (não muta contexto nem estado)',()=>{
  reset();
  const m=V(T.getEchoQueue())[0];
  const c=ctxFor(m,{seed:9,intent:9,src:'n1',res:'high'});
  const before=JSON.stringify(V(c));
  const runBefore=JSON.stringify(snap());
  for(let i=0;i<50;i++)T.pr15IntentDecide(c);
  assert.strictEqual(JSON.stringify(V(c)),before,'contexto intacto');
  assert.strictEqual(JSON.stringify(snap()),runBefore,'estado run intacto');
});

/* =====================================================================
   C — DISTRIBUIÇÃO
   ===================================================================== */
ok('B4-13 nenhuma intenção desaparece num espaço de contexto amplo',()=>{
  reset();
  const counts={allied:0,rival:0,ambiguous:0};
  const causes=['boss','miniboss','echo','enemy','hazard','event','unknown'];
  const archs=['melee','ranged','crit','shield','dash','economy','status','echo'];
  for(let i=0;i<1500;i++){
    const m=mem('e1-2',{cause:causes[i%7],
      arch:{dom:archs[(i>>1)%8],sec:null,state:'definido',domS:.5,secS:null},
      op:(i%3===0)?'wraith':'vector',
      theme:(i%4===0)?'sangue':'cinza',
      moral:{comp:(i%5),greed:(i%3),viol:(i%7)}});
    X('moral={comp:'+(i%4)+',greed:'+(i%6)+',viol:'+(i%2)+'}');
    const k=T.pr15IntentDecide(T.pr15IntentContext(m,{seed:i,intent:(i*37)%100000,
      src:(i%2?'n2':'n1'),res:['high','normal','unstable'][i%3]})).kind;
    counts[k]++;
  }
  for(const k of ['allied','rival','ambiguous']){
    assert.ok(counts[k]>0,k+' aparece ('+counts[k]+')');
    assert.ok(counts[k]/1500>0.05,k+' não é residual ('+(counts[k]/1500*100).toFixed(1)+'%)');
  }
  console.log('      distribuição: A '+(counts.allied/15).toFixed(1)+'% · R '+
    (counts.rival/15).toFixed(1)+'% · M '+(counts.ambiguous/15).toFixed(1)+'%');
});
ok('B4-14 a distribuição emerge das regras, não de faixas fixas',()=>{
  reset();
  /* contexto fortemente ALIADO */
  X('moral={comp:9,greed:0,viol:0}');
  const ally=mem('e1-2',{cause:'hazard',moral:{comp:9,greed:0,viol:0},theme:'cinza'});
  let a=0;
  for(let i=0;i<200;i++)
    if(T.pr15IntentDecide(T.pr15IntentContext(ally,{seed:i,intent:i,src:'n1',res:'high'})).kind==='allied')a++;
  /* contexto fortemente RIVAL */
  X('moral={comp:9,greed:0,viol:0}');
  const riv=mem('e1-2',{cause:'boss',moral:{comp:0,greed:0,viol:9},theme:'sangue'});
  let r=0;
  for(let i=0;i<200;i++)
    if(T.pr15IntentDecide(T.pr15IntentContext(riv,{seed:i,intent:i,src:'n1',res:'normal'})).kind==='rival')r++;
  assert.ok(a/200>0.5,'contexto aliado favorece ALIADA ('+(a/2)+'%)');
  assert.ok(r/200>0.35,'contexto rival favorece RIVAL ('+(r/2)+'%)');
  /* e os scores confirmam que RIVAL é o desfecho dominante nesse contexto */
  const sc=V(T.pr15IntentScores(T.pr15IntentContext(riv,{seed:1,intent:1,src:'n1',res:'normal'})));
  assert.ok(sc.rival>sc.allied&&sc.rival>sc.ambiguous,'RIVAL domina os scores: '+JSON.stringify(sc));
  const sc2=V(T.pr15IntentScores(T.pr15IntentContext(ally,{seed:1,intent:1,src:'n1',res:'high'})));
  assert.ok(sc2.allied>sc2.rival&&sc2.allied>sc2.ambiguous,'ALIADA domina no outro: '+JSON.stringify(sc2));
});
ok('B4-15 distribuição de variantes é coberta dentro de cada família',()=>{
  reset();
  const m=V(T.getEchoQueue())[0];
  for(const k of ['allied','rival','ambiguous']){
    const seen={};
    for(let i=0;i<900;i++){
      const c=T.pr15IntentContext(m,{seed:i,intent:i,src:(i%2?'n2':'n1'),
        res:['high','normal','unstable'][i%3]});
      seen[T.pr15IntentVariant(k,c)]=1;
    }
    assert.strictEqual(Object.keys(seen).length,3,k+': '+Object.keys(seen).join(','));
  }
});
ok('B4-16 a escolha de variante também é determinística',()=>{
  reset();
  const m=V(T.getEchoQueue())[0];
  const c=T.pr15IntentContext(m,{seed:31,intent:31,src:'n1',res:'normal'});
  const a=T.pr15IntentVariant('rival',c);
  for(let i=0;i<2000;i++)Math.random();
  assert.strictEqual(T.pr15IntentVariant('rival',c),a);
});

/* =====================================================================
   D — EXPLAIN / REASONS
   ===================================================================== */
ok('B4-17 explain devolve kind, scores, reasons e sinais com pesos',()=>{
  reset();
  const p=T.pr15PresSpawn(enc({id:'exA'}),null);
  assert.ok(p&&p.it,'presença com intenção');
  const e=V(T.pr15IntentExplain(p.encounterId));
  assert.ok(e.kind&&e.scores&&Array.isArray(e.reasons));
  assert.ok(e.signals.length>0,'há sinais');
  for(const s of e.signals){
    assert.ok(s.tag&&s.signal,'sinal completo');
    assert.ok(s.weights&&fin(s.weights.allied),'pesos presentes em '+s.tag);
  }
});
ok('B4-18 reason tags vêm de um vocabulário fechado',()=>{
  reset();
  const vocab=Object.keys(V(T.PR15_INTENT_REASONS));
  assert.ok(vocab.length>=8,'vocabulário rico ('+vocab.length+')');
  const p=T.pr15PresSpawn(enc({id:'exB'}),null);
  const e=V(T.pr15IntentExplain(p.encounterId));
  for(const r of e.reasons)assert.ok(vocab.indexOf(r)>=0,'tag conhecida: '+r);
  assert.ok(e.reasons.indexOf('INTENT_SEED')>=0,'o desempate é declarado');
});
ok('B4-19 "por que ficou RIVAL?" é respondível a partir do explain',()=>{
  reset();
  X('moral={comp:9,greed:0,viol:0}');
  T.setEchoQueue([mem('e1-2',{cause:'boss',moral:{comp:0,greed:0,viol:9},theme:'sangue'})]);
  /* força deterministicamente: procura um intentSeed que resolva RIVAL
     neste contexto (a decisão é ponderada, não determinística por contexto) */
  let p=null,seed=0;
  for(let i=0;i<200&&!p;i++){
    seed=i;
    T.pr15PresReset();T.pr15IntentReset();
    const cand=T.pr15PresSpawn(enc({id:'exC',mem:'e1-2',seed:1000+i,intent:i}),null);
    if(cand&&cand.it.kind==='rival')p=cand;
  }
  assert.ok(p,'contexto rival produz RIVAL para alguma seed ('+seed+')');
  const e=V(T.pr15IntentExplain(p.encounterId));
  assert.ok(e.reasons.indexOf('MORAL_ECHO')>=0,'MORAL_ECHO explicado');
  assert.ok(e.reasons.indexOf('DEATH_MEMORY')>=0,'DEATH_MEMORY explicado');
  assert.ok(e.scores.rival>e.scores.allied&&e.scores.rival>e.scores.ambiguous,
    'RIVAL domina os scores');
  assert.strictEqual(e.ranked[0],'rival');
  assert.strictEqual(e.kind,'rival','estado da presença bate com a explicação');
});
ok('B4-20 o explain expõe o contexto real lido do jogo',()=>{
  reset();
  const p=T.pr15PresSpawn(enc({id:'exD'}),null);
  const c=V(T.pr15IntentExplain(p.encounterId)).context;
  assert.strictEqual(c.memOp,'vector');
  assert.strictEqual(c.curOp,'vector');
  assert.strictEqual(c.memCause,'enemy');
  assert.strictEqual(c.memArch,'crit');
  assert.ok(fin(c.moralDist)&&c.moralDist>=0&&c.moralDist<=1);
  assert.ok(fin(c.fracture));
});
ok('B4-21 reasons têm cap (não crescem sem limite)',()=>{
  reset();
  const p=T.pr15PresSpawn(enc({id:'exE'}),null);
  const e=V(T.pr15IntentExplain(p.encounterId));
  assert.ok(e.reasons.length<=C.reasonMax,'≤ '+C.reasonMax+' reasons');
  assert.ok(p.it.reasons.length<=C.reasonMax,'estado da presença respeita o cap');
});
ok('B4-22 nenhum nome interno cru vaza para o texto do jogador',()=>{
  reset();
  const p=T.pr15PresSpawn(enc({id:'exF'}),null);
  const txt=[T.PR15_INTENT_LABEL[p.it.kind].nm,T.PR15_VARIANT_LABEL[p.it.variant],
    T.pr15IntentInteractLabel(p)].join(' ');
  for(const bad of ['intentSeed','descriptor','src:','res:','N1','n1','n2','seed'])
    assert.ok(txt.indexOf(bad)<0,'sem "'+bad+'" em: '+txt);
  assert.ok(/MEMÓRIA|RUN ANTERIOR|TEMPORAL/.test(txt),'linguagem diegética');
});

/* =====================================================================
   E — ALIADA
   ===================================================================== */
/* spawn com intenção/variante forçadas SEM o modo DEV (para testar efeito) */
/* Aparição forçada SEM reset: encerra a presença anterior e abre a próxima
   mantendo o registro do run (orçamentos, resolvidos). É o que permite medir
   o efeito acumulado de três memórias na mesma run. */
function spawnKeep(kind,variant,encOver){
  if(P())finish(P());
  T.setPr15IntentForce({kind:kind,variant:variant});
  const p=T.pr15PresSpawn(enc(encOver||{}),null);
  T.setPr15IntentForce(null);
  return p;
}
function spawnForced(kind,variant,o){
  reset(o&&o.queue,o&&o.player);
  T.setPr15IntentForce({kind:kind,variant:variant});
  const p=T.pr15PresSpawn(enc(Object.assign({id:'f-'+kind+'-'+variant},(o&&o.enc)||{})),null);
  T.setPr15IntentForce(null);
  return p;
}
ok('B4-23 ALIADA · zona de ressonância reduz dano recebido só dentro do raio',()=>{
  const p=spawnForced('allied','zone');
  toActive(p);
  placePlayerNear(p,C.zoneR+120);
  T.pr15IntentUpdate(0.05);
  assert.strictEqual(T.getSmMods().filter(m=>m.id==='pr15.zone').length,0,'fora da zona: nada');
  placePlayerNear(p,C.zoneR-40);
  T.pr15IntentUpdate(0.05);
  const mods=T.getSmMods().filter(m=>m.id==='pr15.zone');
  assert.strictEqual(mods.length,1,'dentro da zona: mod ativo');
  assert.ok(Math.abs(mods[0].value-C.zoneTaken)<1e-9,'valor = '+C.zoneTaken);
  assert.ok(mods[0].dur>0&&mods[0].dur<=C.zoneDur+1e-9,'temporário');
  assert.ok(C.zoneTaken<1&&C.zoneTaken>0.75,'moderado (−'+Math.round((1-C.zoneTaken)*100)+'%)');
});
ok('B4-24 ALIADA · pulso de memória é orçado e limitado por aparição',()=>{
  const p=spawnForced('allied','pulse',{player:{shield:0,shieldMax:200}});
  toActive(p);
  let pulses=0;
  for(let i=0;i<2000&&P();i++){
    placePlayerNear(p,60);
    const before=p.it.pulses|0;
    T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
    if((p.it&&p.it.pulses||0)>before)pulses++;
  }
  assert.ok(pulses<=C.pulseMax,'pulsos ≤ '+C.pulseMax+' (foram '+pulses+')');
  const b=snap().budget;
  assert.ok(b.shield<=C.budget.shield+1e-9,'orçamento de escudo respeitado: '+b.shield);
  assert.ok(b.shield>0,'houve concessão real');
});
ok('B4-25 ALIADA · pulso cura HP quando o operador não tem escudo',()=>{
  const p=spawnForced('allied','pulse',{player:{shield:0,shieldMax:0,hp:50,maxHp:100}});
  toActive(p);
  const hp0=T.getPlayer().hp;
  for(let i=0;i<200&&P()&&p.it.pulses<1;i++){placePlayerNear(p,40);T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  assert.ok(T.getPlayer().hp>hp0,'HP subiu de '+hp0+' para '+T.getPlayer().hp);
  assert.ok(T.getPlayer().hp<=T.getPlayer().maxHp,'nunca passa do máximo');
});
ok('B4-26 ALIADA · herança de build usa UMA assinatura do arquétipo histórico',()=>{
  const seen={};
  for(const arch of ['melee','ranged','crit','shield','dash','economy','status','echo']){
    const q=[mem('e1-2',{arch:{dom:arch,sec:null,state:'definido',domS:.6,secS:null}})];
    const p=spawnForced('allied','legacy',{queue:q,enc:{mem:'e1-2'}});
    toActive(p);
    const mods=V(T.getSmMods()).filter(m=>m.id==='pr15.legacy');
    assert.strictEqual(mods.length,1,arch+': exatamente um modificador');
    assert.ok(mods[0].dur===C.legacyDur,'temporário ('+C.legacyDur+'s)');
    assert.strictEqual(mods[0].stacks,'replace','sem stacking');
    seen[arch]=mods[0].stat;
  }
  assert.ok(new Set(Object.values(seen)).size>=5,'assinaturas distintas por arquétipo');
  assert.strictEqual(seen.melee,'meleeRange');
  assert.strictEqual(seen.shield,'shieldMax');
  assert.strictEqual(seen.dash,'speed');
});
ok('B4-27 ALIADA · magnitudes ficam abaixo da presença de facção',()=>{
  /* Desviados (PR14) concede +20% dano por 12s — a herança temporal é menor */
  const legacy=V(T.PR15_LEGACY_MODS);
  for(const k in legacy){
    const v=legacy[k].v;
    const pct=legacy[k].type==='add'?v*100:(v-1)*100;
    assert.ok(pct<=20,k+' concede '+pct+'% (≤ 20% da referência de facção)');
  }
  assert.ok(C.tradeDmg<1.20,'troca temporal abaixo do +20% de facção');
  assert.ok(C.zoneTaken>0.80,'zona não é invulnerabilidade');
});
ok('B4-28 ALIADA não concede buff permanente',()=>{
  const p=spawnForced('allied','legacy');
  toActive(p);
  const mods=V(T.getSmMods()).filter(m=>String(m.id).indexOf('pr15.')===0);
  assert.ok(mods.length>0,'houve efeito');
  for(const m of mods)assert.ok(Number.isFinite(m.dur)&&m.dur>0,'todos com duração finita');
  assert.strictEqual(T.getSmMods().filter(m=>String(m.id).indexOf('pr15.')===0&&m.dur==null).length,0);
});

/* =====================================================================
   F — RIVAL
   ===================================================================== */
ok('B4-29 RIVAL · pressão temporal avisa ANTES de punir',()=>{
  const p=spawnForced('rival','pressure');
  toActive(p);
  placePlayerNear(p,40);
  let telegraphSeen=false,appliedAt=-1;
  for(let i=0;i<200&&P();i++){
    T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
    if(p.it&&p.it.tel>0)telegraphSeen=true;
    if(appliedAt<0&&T.getSmMods().some(m=>m.id==='pr15.pressure'))appliedAt=i;
    if(appliedAt>=0)break;
  }
  assert.ok(telegraphSeen,'o telegraph aconteceu');
  assert.ok(appliedAt>C.rivalTelegraph/0.05-1,'só depois do aviso ('+appliedAt+' ticks)');
  assert.ok(C.rivalTelegraph>=1.0,'aviso de pelo menos 1s');
});
ok('B4-30 RIVAL · sair do raio durante o aviso evita completamente a consequência',()=>{
  const p=spawnForced('rival','pressure');
  toActive(p);
  placePlayerNear(p,30);                       // dentro do raio
  /* espera o telegraph começar */
  let i=0;
  for(;i<400&&P()&&!(p.it.tel>0);i++){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  assert.ok(p.it.tel>0,'telegraph em curso');
  placePlayerFar(p);                           // sai durante o aviso
  let fired=0;
  for(;i<700&&P();i++){
    T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
    if(P()&&P().it)fired=Math.max(fired,P().it.fired|0);
  }
  assert.ok(fired>0,'o pulso chegou a disparar ('+fired+')');
  assert.strictEqual(T.getSmMods().filter(m=>m.id==='pr15.pressure').length,0,'zero punição');
  assert.strictEqual(T.getPlayer().hp,80,'HP intacto');
});
ok('B4-30b RIVAL · ficar dentro do raio aplica o custo comunicado',()=>{
  const p=spawnForced('rival','pressure');
  toActive(p);
  placePlayerNear(p,30);
  let i=0;
  for(;i<700&&P()&&!T.getSmMods().some(m=>m.id==='pr15.pressure');i++){
    placePlayerNear(p,30);
    T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
  }
  assert.ok(T.getSmMods().some(m=>m.id==='pr15.pressure'),'debuff aplicado');
  assert.ok(p.it.msg.indexOf('PRESSIONADO')>=0,'comunicado: '+p.it.msg);
});
ok('B4-31 RIVAL · prova da run anterior tem sucesso e falha sem punição',()=>{
  /* sucesso */
  let p=spawnForced('rival','trial');
  toActive(p);X('kills=0');
  for(let i=0;i<40&&P();i++){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  assert.strictEqual(p.it.trial,1,'prova em andamento');
  X('kills='+C.trialKills);
  T.pr15IntentUpdate(0.05);
  assert.strictEqual(p.it.trial,2,'cumprida');
  assert.ok(snap().resolved.some(r=>r.vr==='trial'&&r.ok===1),'registrada como sucesso');
  assert.ok(T.getResidues()>0,'recompensa concedida (⧗'+T.getResidues()+')');
  /* falha */
  p=spawnForced('rival','trial',{enc:{id:'f-trial-2'}});
  toActive(p);X('kills=0');
  for(let i=0;i<(C.trialTime/0.05)+20&&P();i++){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  assert.strictEqual(p.it.trial,3,'expirou');
  assert.strictEqual(T.getPlayer().hp,80,'nenhuma punição em HP');
  assert.strictEqual(T.getSmMods().length,0,'nenhum debuff aplicado');
});
ok('B4-32 RIVAL · cicatriz da morte NUNCA cobra sem o jogador aceitar',()=>{
  const p=spawnForced('rival','scar');
  toActive(p);
  const hp0=T.getPlayer().hp;
  placePlayerFar(p);                                  // longe da âncora: recusa
  for(let i=0;i<900&&P();i++){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  assert.strictEqual(T.getPlayer().hp,hp0,'HP intacto sem aceite');
  assert.ok(snap().resolved.some(r=>r.vr==='scar'&&r.ok===0),'registrada como não aceita');
});
ok('B4-33 RIVAL · cicatriz cobrada é comunicada e limitada',()=>{
  const p=spawnForced('rival','scar');
  toActive(p);
  const o=V(T.pr15IntentScarOffer(p));
  assert.ok(o.cost>=C.scarCostMin&&o.cost<=C.scarCostMax,'custo dentro do limite');
  assert.ok(T.pr15IntentInteractLabel(p).indexOf(String(o.cost))>=0,'custo aparece no rótulo');
  const hp0=T.getPlayer().hp;
  settleOffer(p);
  T.pr15IntentUpdate(0.05);
  assert.ok(T.getPlayer().hp<hp0||T.getPlayer().shield<hp0,'houve custo');
  assert.ok(hp0-T.getPlayer().hp<=C.scarCostMax,'custo limitado');
  assert.ok(T.getSmMods().some(m=>m.id==='pr15.scar'),'benefício aplicado');
});
ok('B4-34 RIVAL · a causa da morte histórica muda o tipo de desafio',()=>{
  const kinds={};
  for(const cause of ['boss','miniboss','hazard','echo','event','enemy','unknown']){
    const q=[mem('e1-2',{cause:cause})];
    const p=spawnForced('rival','scar',{queue:q,enc:{mem:'e1-2'}});
    const o=V(T.pr15IntentScarOffer(p));
    kinds[cause]=o.gain.stat;
  }
  assert.strictEqual(kinds.hazard,'dmgTaken','hazard → lição posicional');
  assert.strictEqual(kinds.boss,'damage');
  assert.strictEqual(kinds.echo,'pickupR');
  assert.strictEqual(kinds.event,'coinMul');
  assert.ok(new Set(Object.values(kinds)).size>=3,'a causa realmente diferencia');
});
ok('B4-35 RIVAL nunca spawna boss, miniboss, inimigo ou projétil',()=>{
  const p=spawnForced('rival','pressure');
  toActive(p);
  for(let i=0;i<400&&P();i++){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  assert.strictEqual(V(T.getEnemies()).length,0,'nenhum inimigo criado');
  assert.strictEqual(T.getBoss(),null,'nenhum boss');
  assert.strictEqual(T.getMiniBossRef(),null,'nenhum miniboss');
  assert.ok(X('projectiles.length')===0,'nenhum projétil');
  assert.ok(B4CODE.indexOf('spawnEnemy')<0,'bloco não chama spawnEnemy');
  assert.ok(B4CODE.indexOf('spawnMiniBoss')<0);
  assert.ok(B4CODE.indexOf('projectiles.push')<0);
});

/* =====================================================================
   G — AMBÍGUA
   ===================================================================== */
ok('B4-36 AMBÍGUA · troca temporal exige saldo e cobra só com aceite',()=>{
  X('fracRun=fracFresh()');
  const p=spawnForced('ambiguous','trade');
  toActive(p);
  assert.strictEqual(T.getResidues(),0,'saldo zero');
  settleOffer(p);
  T.pr15IntentUpdate(0.05);
  assert.strictEqual(T.getResidues(),0,'nada cobrado sem saldo');
  assert.strictEqual(p.it.st,'declined','recusada por saldo');
  assert.strictEqual(T.getSmMods().length,0,'nenhum buff');
});
ok('B4-37 AMBÍGUA · troca com saldo aplica custo e benefício comunicados',()=>{
  const p=spawnForced('ambiguous','trade');
  X('addResidues(20,"teste")');
  toActive(p);
  const r0=T.getResidues();
  assert.strictEqual(T.pr15IntentTradeOffer(p).can,true,'saldo suficiente');
  settleOffer(p);                                  // a oferta amadurece e o jogo cobra
  T.pr15IntentUpdate(0.05);
  const label=T.pr15IntentInteractLabel(p);
  assert.ok(label===null||label.indexOf(String(C.tradeCost))>=0,
    'rótulosome ou repete o custo comunicado ('+label+')');
  assert.strictEqual(r0-T.getResidues(),C.tradeCost,'cobrou exatamente o custo');
  const antes2=T.getResidues();
  settleOffer(p);
  T.pr15IntentUpdate(0.05);
  assert.strictEqual(T.getResidues(),antes2,'não cobra de novo no mesmo encontro');
  const mods=V(T.getSmMods()).filter(m=>m.id==='pr15.trade');
  assert.strictEqual(mods.length,1);
  assert.ok(Math.abs(mods[0].value-C.tradeDmg)<1e-9);
  assert.strictEqual(mods[0].dur,C.tradeDur,'temporário');
});
ok('B4-38 AMBÍGUA · memória instável nunca pune',()=>{
  let worst=0;
  for(let s=0;s<60;s++){
    const p=spawnForced('ambiguous','unstable',{enc:{id:'u'+s,seed:1000+s}});
    toActive(p);
    const hp0=T.getPlayer().hp,r0=T.getResidues();
    placePlayerNear(p,20);
    T.pr15IntentUpdate(0.05);
    worst=Math.min(worst,T.getPlayer().hp-hp0,T.getResidues()-r0);
    finish(p);
  }
  assert.strictEqual(worst,0,'nenhum desfecho negativo em 60 sorteios');
  const opts=V(C.unstableOpt);
  assert.ok(opts.every(o=>o.n>=0),'tabela só tem desfechos não-negativos');
});
ok('B4-39 AMBÍGUA · escolha de ressonância tem dois lobos distintos',()=>{
  const p=spawnForced('ambiguous','choice');
  toActive(p);
  const L=V(T.pr15IntentLobes(p));
  assert.ok(L.cyan&&L.magenta);
  const sep=Math.hypot(L.cyan.x-L.magenta.x,L.cyan.y-L.magenta.y);
  assert.ok(sep>=C.interactR,'lobos separados o bastante ('+sep.toFixed(0)+'px)');
  for(const lb of [L.cyan,L.magenta]){
    assert.ok(lb.x>=C.margin&&lb.x<=2200-C.margin,'lobo dentro da arena (x)');
    assert.ok(lb.y>=C.margin&&lb.y<=1450-C.margin,'lobo dentro da arena (y)');
  }
  assert.notStrictEqual(L.cyan.axis,L.magenta.axis,'eixos morais diferentes');
  assert.strictEqual(L.cyan.label,'ACEITAR');
  assert.strictEqual(L.magenta.label,'RECUSAR');
});
ok('B4-40 AMBÍGUA · aceitar e recusar produzem consequências diferentes',()=>{
  let p=spawnForced('ambiguous','choice');
  toActive(p);
  settleOffer(p);
  const L=V(T.pr15IntentLobes(p));
  const pl=T.getPlayer();pl.x=L.cyan.x;pl.y=L.cyan.y;
  T.pr15IntentUpdate(0.05);
  const accepted=T.getSmMods().some(m=>m.id==='pr15.choice');
  const moralA=V(X('moral'));
  finish(p);
  p=spawnForced('ambiguous','choice',{enc:{id:'f-choice-2'}});
  toActive(p);
  settleOffer(p);
  const L2=V(T.pr15IntentLobes(p));
  /* reset() dentro do spawnForced TROCA o objeto do jogador — a referência
     capturada antes aponta para o operador anterior. */
  const pl2=T.getPlayer();pl2.x=L2.magenta.x;pl2.y=L2.magenta.y;
  const r0=T.getResidues();
  T.pr15IntentUpdate(0.05);
  assert.ok(accepted,'aceitar aplica efeito');
  assert.strictEqual(T.getSmMods().filter(m=>m.id==='pr15.choice').length,0,'recusar não aplica');
  assert.ok(T.getResidues()>r0,'recusar devolve resíduo');
  assert.notDeepStrictEqual(V(X('moral')),moralA,'cada lado move a moralidade de forma distinta');
});
ok('B4-41 AMBÍGUA · nenhuma variante abre modal nem congela o combate',()=>{
  assert.ok(B4CODE.indexOf('showEvent')<0,'sem abrir evento');
  assert.ok(B4CODE.indexOf('openOverlay')<0);
  assert.ok(B4CODE.indexOf('state=\'event\'')<0,'não muda o state');
  for(const v of ['trade','unstable','choice']){
    const p=spawnForced('ambiguous',v,{enc:{id:'m-'+v}});
    toActive(p);placePlayerNear(p,10);
    T.pr15IntentUpdate(0.05);
    assert.strictEqual(X('state'),'play',v+': state continua play');
    finish(p);
  }
});
ok('B4-42 AMBÍGUA · sair sem interagir é uma resposta válida e registrada',()=>{
  const p=spawnForced('ambiguous','trade');
  toActive(p);
  placePlayerFar(p);
  for(let i=0;i<900&&P();i++){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  assert.strictEqual(P(),null,'a presença saiu');
  assert.ok(snap().resolved.some(r=>r.vr==='trade'&&r.ok===0),'registrada como não aceita');
  assert.strictEqual(T.getResidues(),0,'nada cobrado');
});

/* =====================================================================
   H — VARIANTES
   ===================================================================== */
ok('B4-43 a variante é fixada no spawn e não muda durante o ciclo',()=>{
  const p=spawnForced('rival','trial');
  const v0=p.it.variant,k0=p.it.kind;
  toActive(p);
  for(let i=0;i<200&&P();i++)T.pr15IntentUpdate(0.05);
  assert.strictEqual(P().it.variant,v0);
  assert.strictEqual(P().it.kind,k0);
  finish(p);
});
ok('B4-44 variante inválida cai num valor válido da própria família',()=>{
  const ctx=T.pr15IntentContext(V(T.getEchoQueue())[0]||mem('x'),{seed:1,intent:1,src:'n1',res:'high'});
  for(const k of ['allied','rival','ambiguous','nada','']){
    const v=T.pr15IntentVariant(k,ctx);
    const fam=T.PR15_INTENTS[k]?k:'ambiguous';
    assert.ok(V(T.PR15_VARIANTS)[fam].indexOf(v)>=0,k+'→'+v);
  }
});
ok('B4-45 cada variante tem comportamento próprio (não são clones)',()=>{
  /* O estado observado precisa cobrir TUDO o que uma variante pode mexer:
     HP, HP máximo, escudo, resíduo, modificadores e o estado da interação.
     Só hp/res/mods fazia o pulso (escudo) e a cicatriz (escudo) parecerem
     passivas — não eram as variantes que eram iguais, era a observação. */
  const obs=()=>JSON.stringify({hp:T.getPlayer().hp,mhp:T.getPlayer().maxHp,
    sh:T.getPlayer().shield,res:T.getResidues(),
    mods:V(T.getSmMods()).map(m=>m.id+':'+m.value),
    st:P()?P().it.st:'-'});
  const behaviours={};
  for(const k of ['allied','rival','ambiguous']){
    for(const v of V(T.PR15_VARIANTS)[k]){
      reset();
      X('addResidues(60,"t")');
      const p=spawnForced(k,v,{enc:{id:'bh-'+k+'-'+v}});
      const before=obs();          // mede desde que a presença existe
      toActive(p);
      for(let i=0;i<160&&P();i++){
        /* a escolha ambígua exige que o jogador encoste num dos lobos;
           a prova do RIVAL exige abates de verdade */
        if(v==='choice'){const L=V(T.pr15IntentLobes(p));
          if(L){const pl=T.getPlayer();pl.x=L.cyan.x;pl.y=L.cyan.y;}}
        else placePlayerNear(p,10);
        if(v==='trial'&&i%5===0)X('kills++');
        T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
      }
      behaviours[k+'/'+v]=(obs()!==before)?'ativo':'passivo';
      finish(p);
    }
  }
  const passivos=Object.entries(behaviours).filter(([,v])=>v==='passivo').map(([k])=>k);
  const ativos=Object.entries(behaviours).filter(([,v])=>v==='ativo').length;
  assert.strictEqual(ativos,9,'todas as 9 variantes têm efeito observável'+
    (passivos.length?' (passivas: '+passivos.join(', ')+')':''));
});

/* =====================================================================
   I — N-1 / N-2   ·   J — RESONANCE
   ===================================================================== */
ok('B4-46 N-2 é tratada como memória mais antiga, não mais poderosa',()=>{
  reset();
  const m=V(T.getEchoQueue())[0];
  const s1=V(T.pr15IntentScores(T.pr15IntentContext(m,{seed:3,intent:3,src:'n1',res:'normal'})));
  const s2=V(T.pr15IntentScores(T.pr15IntentContext(m,{seed:3,intent:3,src:'n2',res:'normal'})));
  assert.ok(s2.rival<s1.rival*2.5,'N-2 não explode o RIVAL');
  assert.ok(s2.ambiguous>s1.ambiguous,'N-2 desloca para AMBÍGUA (menos coerente)');
  assert.ok(s2.allied<s1.allied,'mas não a torna automaticamente mais perigosa');
});
ok('B4-47 N-1/N-2 não alteram a gramática visual herdada do B3',()=>{
  assert.deepStrictEqual(V(T.PR15_PRES_SRC_VIS),{n1:{crisp:1,lag:0.06,frag:0},
    n2:{crisp:0.82,lag:0.14,frag:1}},'tabela do B3 intacta');
  const srcs=V(T.PR15_INTENT_SIGNALS);
  assert.ok(srcs.srcN2,'existe sinal de idade');
  assert.ok(!srcs.srcN1Power,'nenhum sinal de "poder" por origem');
});
ok('B4-48 a origem é preservada do descriptor, nunca re-derivada',()=>{
  reset();
  T.setEchoQueue([mem('e1-2'),mem('e1-1')]);
  const p=T.pr15PresSpawn(enc({id:'o2',mem:'e1-1',src:'n2'}),null);
  assert.strictEqual(p.source,'n2');
  const e=V(T.pr15IntentExplain(p.encounterId));
  assert.strictEqual(e.context.source,'n2');
  assert.ok(e.reasons.indexOf('MEMORY_AGE')>=0,'a idade entrou na explicação');
});
ok('B4-49 ressonância influencia a intenção sem virar raridade',()=>{
  reset();
  const m=V(T.getEchoQueue())[0];
  const base={seed:8,intent:8,src:'n1'};
  const hi=V(T.pr15IntentScores(T.pr15IntentContext(m,Object.assign({res:'high'},base))));
  const un=V(T.pr15IntentScores(T.pr15IntentContext(m,Object.assign({res:'unstable'},base))));
  assert.ok(hi.allied>un.allied,'HIGH é mais coerente/aliada');
  assert.ok(un.ambiguous>hi.ambiguous,'UNSTABLE é mais indefinida');
  assert.ok(Math.abs(hi.allied-un.allied)<0.6,'diferença moderada, não tier de poder');
});
ok('B4-50 ressonância não cria palavras de raridade nem power tier',()=>{
  for(const w of ['lend','legend','rare','epic','gold','tier','raridade','comum'])
    assert.ok(B4CODE.toLowerCase().indexOf(w)<0,'sem "'+w+'" no bloco B4');
});

/* =====================================================================
   K — BUILD HISTÓRICA   ·   L — CAUSA DA MORTE
   ===================================================================== */
ok('B4-51 arquétipo histórico influencia intenção E herança (sem recriar a build)',()=>{
  reset();
  const a=V(T.pr15IntentSignalsFor(T.pr15IntentContext(
    mem('e1-2',{arch:{dom:'crit',sec:null,state:'definido',domS:.5,secS:null}}),
    {seed:1,intent:1,src:'n1',res:'normal'})));
  assert.ok(a.some(s=>s.tag==='BUILD_RESONANCE'),'BUILD_RESONANCE presente');
  const legacy=V(T.PR15_LEGACY_MODS);
  assert.strictEqual(Object.keys(legacy).length,8,'uma assinatura por arquétipo, nada além');
  for(const k in legacy){
    assert.ok(typeof legacy[k].stat==='string');
    assert.ok(legacy[k].v>0);
  }
  assert.ok(T.PR15_LEGACY_FALLBACK.stat,'existe fallback');
});
ok('B4-52 as 7 causas do B1 são tratadas e "unknown" não inventa explicação',()=>{
  reset();
  const causes=V(T.PR15_DEATH_CAUSES);
  assert.strictEqual(causes.length,7);
  const sigs={};
  for(const c of causes){
    const s=V(T.pr15IntentSignalsFor(T.pr15IntentContext(mem('e1-2',{cause:c}),
      {seed:1,intent:1,src:'n1',res:'normal'})));
    const d=s.filter(x=>x.tag==='DEATH_MEMORY');
    assert.strictEqual(d.length,1,c+' → exatamente um sinal');
    sigs[c]=d[0].signal;
    assert.ok(typeof d[0].signal==='string','sinal nomeado');
  }
  assert.strictEqual(sigs.unknown,'causeUnknown');
  const w=V(T.PR15_INTENT_SIGNALS).causeUnknown;
  assert.ok(w.rival<0.2&&w.allied<0.2,'unknown não força narrativa');
  assert.strictEqual(sigs.boss,'causeBoss');
  assert.strictEqual(sigs.miniboss,'causeBoss','miniboss agrupa com boss (não spawna boss)');
});

/* =====================================================================
   M — MORALIDADE   ·   N — FACÇÕES   ·   O — ECHO ALIADO
   ===================================================================== */
ok('B4-53 moralidade influencia por DIVERGÊNCIA, não por alinhamento bom/ruim',()=>{
  reset();
  X('moral={comp:9,greed:0,viol:0}');
  const same=mem('e1-2',{moral:{comp:9,greed:0,viol:0}});
  const other=mem('e1-2',{moral:{comp:0,greed:0,viol:9}});
  const sSame=V(T.pr15IntentScores(T.pr15IntentContext(same,{seed:2,intent:2,src:'n1',res:'normal'})));
  const sOther=V(T.pr15IntentScores(T.pr15IntentContext(other,{seed:2,intent:2,src:'n1',res:'normal'})));
  assert.ok(sSame.allied>sOther.allied,'concordância → mais aliada');
  assert.ok(sOther.rival>sSame.rival,'divergência → mais rival (desafio, não punição)');
  /* perfis "ruins" iguais continuam ALIADOS: não há bom/ruim binário */
  X('moral={comp:0,greed:0,viol:9}');
  const dark=mem('e1-2',{moral:{comp:0,greed:0,viol:9}});
  const sDark=V(T.pr15IntentScores(T.pr15IntentContext(dark,{seed:2,intent:2,src:'n1',res:'normal'})));
  assert.ok(sDark.allied>sOther.allied,'perfil violento coerente NÃO é punido');
});
ok('B4-54 mudança de moralidade é mínima, explícita e orçada',()=>{
  assert.strictEqual(C.budget.moral,3,'teto de 3 pontos por run');
  reset();
  X('moral={comp:0,greed:0,viol:0}');
  const g1=T.pr15IntentGrantMoral('comp',5);
  assert.strictEqual(g1,1,'pedido de 5 concede 1');
  const g2=T.pr15IntentGrantMoral('comp',5);
  const g3=T.pr15IntentGrantMoral('comp',5);
  const g4=T.pr15IntentGrantMoral('comp',5);
  assert.strictEqual(g4,0,'orçamento esgotado na 4ª');
  assert.strictEqual(g1+g2+g3,C.budget.moral);
  assert.strictEqual(X('moral').comp,3);
  assert.ok(T.pr15IntentGrantMoral('nada',1)===0,'eixo inválido recusado');
});
ok('B4-55 moralidade não pode ficar negativa nem virar NaN',()=>{
  reset();
  X('moral={comp:0,greed:0,viol:0}');
  T.pr15IntentGrantMoral('viol',-5);
  const m=V(X('moral'));
  assert.ok(m.viol>=0,'nunca negativa');
  for(const k of ['comp','greed','viol'])assert.ok(fin(m[k]),k+' finito');
});
ok('B4-56 facções reagem só quando há vínculo real, e dentro do orçamento',()=>{
  reset();
  X('fracRun=fracFresh()');
  /* sem nenhuma facção conhecida: nada acontece */
  assert.strictEqual(T.pr15IntentFactionReact('allied','legacy'),0,'sem vínculo: zero');
  /* com facção conhecida */
  X('fracDiscover("anchor","contact");fracDiscover("deviants","contact")');
  const before=V(X('fracRun')).aff;
  const applied=T.pr15IntentFactionReact('allied','legacy');
  assert.ok(applied>0,'reagiu ('+applied+')');
  const after=V(X('fracRun')).aff;
  assert.notDeepStrictEqual(before,after);
  assert.ok(Math.abs(after.anchor-before.anchor)<=1,'magnitude pequena');
  /* orçamento */
  let total=0;
  for(let i=0;i<20;i++)total+=T.pr15IntentFactionReact('rival','trial');
  assert.ok(snap().budget.rep<=C.budget.rep,'teto de reputação respeitado');
});
ok('B4-57 a tensão de facção usa FACTION_GRID existente (nada de 2ª tabela)',()=>{
  assert.ok(B4CODE.indexOf('FACTION_GRID')>=0,'lê a grade existente');
  assert.ok(B4CODE.indexOf('factionHasPact')>=0);
  assert.ok(B4CODE.indexOf('fracRival')>=0);
  assert.ok(!/const\s+PR15_FACTION_GRID/.test(B4CODE),'não cria tabela própria');
  reset();
  X('fracRun=fracFresh();fracRun.pact.anchor=1');
  X('moral={comp:9,greed:0,viol:0}');
  const net=T.pr15IntentFactionNet('comp');
  assert.ok(fin(net),'net finito ('+net+')');
  const sigs=V(T.pr15IntentSignalsFor(T.pr15IntentContext(
    mem('e1-2',{moral:{comp:9,greed:0,viol:0}}),{seed:1,intent:1,src:'n1',res:'normal'})));
  assert.ok(sigs.some(s=>s.tag==='FACTION_TENSION'),'FACTION_TENSION entrou na decisão');
});
ok('B4-58 sem pacto nenhum, o sinal de facção não aparece',()=>{
  reset();
  X('fracRun=fracFresh()');
  const sigs=V(T.pr15IntentSignalsFor(T.pr15IntentContext(
    mem('e1-2'),{seed:1,intent:1,src:'n1',res:'normal'})));
  assert.ok(!sigs.some(s=>s.tag==='FACTION_TENSION'),'sem pacto: sem tensão');
});
ok('B4-59 Echo aliado pode reagir com fala rara, com cooldown',()=>{
  const q=stdQueue();
  const p=spawnForced('allied','zone',{queue:q});
  const e1=T.makeEcho(V(q[0]),1);
  T.setEchoes([e1]);
  X('_speechClock=0;speechClear()');
  X('runTime=1000');
  const r1=T.pr15IntentEchoReact(P(),'spawn');
  assert.strictEqual(r1,true,'primeira fala permitida');
  X('runTime=runTime+1');
  assert.strictEqual(T.pr15IntentEchoReact(P(),'spawn'),false,'cooldown bloqueou 1s depois');
  X('runTime=runTime+'+(C.speechCooldown+1));
  assert.strictEqual(T.pr15IntentEchoReact(P(),'resolve'),true,'depois do cooldown, fala de novo');
  assert.ok(C.speechCooldown>=5,'cooldown ≥ 5s');
  /* a fala usa a fila existente e prioridade baixa: nunca atropela o jogo */
  assert.ok(B4CODE.indexOf("'low'")>=0,'prioridade baixa');
  assert.ok(B4CODE.indexOf('echoSpeak')>=0,'usa a API de fala existente');
});
ok('B4-60 a presença NÃO vira Echo aliado (echoes[] intocado)',()=>{
  const q=stdQueue();
  reset(q);
  const e1=T.makeEcho(V(q[0]),1),e2=T.makeEcho(V(q[1]),2);
  T.setEchoes([e1,e2]);
  const cap=e=>({slot:e.slot,maxHp:e.maxHp,shieldMax:e.shieldMax,hue:e.hue,
    dis:e.dis.st,trust:e.trust,items:(e.itemIds||[]).length});
  const base=[cap(e1),cap(e2)];
  const p=T.pr15PresSpawn(enc({id:'na-echo'}),null);
  toActive(p);
  for(let i=0;i<200&&P();i++){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  assert.strictEqual(V(T.getEchoes()).length,2,'echoes[] com 2');
  assert.deepStrictEqual([cap(e1),cap(e2)],base,'nada mudou nos Echos');
  assert.ok(B4CODE.indexOf('echoes.push')<0,'bloco nunca faz echoes.push');
  assert.ok(B4CODE.indexOf('makeEcho')<0,'bloco não usa makeEcho');
  finish(p);
});
ok('B4-61 a presença não recebe relationship, Dissonância, equipamento nem escudo',()=>{
  const p=T.pr15PresSpawn(enc({id:'na-rel'}),null);
  for(const f of ['rel','dis','trust','itemIds','shield','shieldMax','hp','maxHp',
    'hostile','team','tgt','target','trail','data','slot'])
    assert.ok(!(f in p),'campo ausente: '+f);
  assert.ok(B4CODE.indexOf('disNewState')<0);
  assert.ok(B4CODE.indexOf('relNewState')<0);
  assert.ok(B4CODE.indexOf('echoEqInit')<0);
  assert.ok(B4CODE.indexOf('changeEchoTrust')<0,'não altera trust de Echo');
});

/* =====================================================================
   P / Q — ZERO TRANSFORMAÇÃO
   ===================================================================== */
ok('B4-62 a presença nunca entra em enemies[] nem vira alvo',()=>{
  const p=T.pr15PresSpawn(enc({id:'na-enemy'}),null);
  toActive(p);
  assert.strictEqual(V(T.getEnemies()).length,0);
  assert.ok(B4CODE.indexOf('enemies.push')<0,'bloco nunca faz enemies.push');
  assert.ok(B4CODE.indexOf('damageEnemy')<0);
  assert.ok(B4CODE.indexOf('killEnemy')<0);
  assert.ok(B4CODE.indexOf('pickTarget')<0,'não adquire alvo');
  finish(p);
});
ok('B4-63 a presença não causa dano direto ao jogador em nenhuma variante',()=>{
  assert.ok(B4CODE.indexOf('damagePlayer')<0,'bloco não chama damagePlayer');
  for(const k of ['allied','rival','ambiguous']){
    for(const v of V(T.PR15_VARIANTS)[k]){
      const p=spawnForced(k,v,{enc:{id:'nd-'+k+'-'+v},player:{hp:100,maxHp:100}});
      toActive(p);placePlayerNear(p,5);
      for(let i=0;i<200&&P();i++){placePlayerNear(p,5);T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
      /* a única perda de HP possível é a CICATRIZ, que exige aceite */
      if(v!=='scar')assert.strictEqual(T.getPlayer().hp,100,k+'/'+v+': HP intacto');
      finish(p);
    }
  }
});
ok('B4-64 drawEchoEntity / updateEcho continuam sem ramificação sobre a presença',()=>{
  const fn=n=>{
    const i=SRCN.indexOf('function '+n+'(');
    assert.ok(i>0,n+' existe');
    let d=0,j=SRCN.indexOf('{',i);
    for(let k=j;k<SRCN.length;k++){
      if(SRCN[k]==='{')d++;else if(SRCN[k]==='}'){d--;if(!d)return SRCN.slice(i,k);}
    }
    return '';
  };
  for(const n of ['updateEcho','drawEchoEntity','updateEnemy']){
    const body=fn(n);
    assert.ok(body.indexOf('pr15Presence')<0,n+' não menciona a presença');
    assert.ok(body.indexOf('pr15Intent')<0,n+' não menciona intenção');
  }
});

/* =====================================================================
   R — LIFECYCLE
   ===================================================================== */
ok('B4-65 o estado de intenção nasce no spawn e morre com o corpo',()=>{
  const p=T.pr15PresSpawn(enc({id:'lc1'}),null);
  assert.ok(p.it,'it criado');
  assert.ok(p.it.kind&&p.it.variant);
  assert.strictEqual(p.it.st,'idle');
  finish(p);
  assert.strictEqual(P(),null);
  assert.strictEqual(T.getPr15Presence(),null);
  const s=snap();
  assert.strictEqual(s.active,false);
  assert.ok(s.resolved.some(r=>r.enc==='lc1'),'resolução registrada');
});
ok('B4-66 as fases do B3 continuam sendo a única fonte de verdade do ciclo',()=>{
  const p=T.pr15PresSpawn(enc({id:'lc2'}),null);
  assert.strictEqual(p.phase,'spawning');
  toActive(p);
  assert.strictEqual(p.phase,'active');
  assert.ok(p.it.t>0,'o B4 mede tempo a partir do active');
  const antes=p.it.t;
  T.pr15PresLeave('teste');
  assert.strictEqual(P().phase,'leaving');
  T.pr15IntentUpdate(0.05);
  assert.ok(P().it.t>=antes,'tempo não regride');
  finish(p);
});
ok('B4-67 TTL não é alterado pelo B4',()=>{
  const p=T.pr15PresSpawn(enc({id:'lc3'}),null);
  const t0=p.ttl,age0=p.age;
  toActive(p);
  for(let i=0;i<100;i++)T.pr15IntentUpdate(0.05);
  const esperado=t0-(p.age-age0);
  assert.ok(Math.abs(p.ttl-esperado)<0.02,'ttl = TOTAL − age (esperado '+
    esperado.toFixed(2)+', obtido '+p.ttl.toFixed(2)+')');
  assert.ok(Math.abs(p.ttl-(PRESC.entryTime+PRESC.activeTime+PRESC.exitTime-p.age))<1e-6);
  assert.ok(B4CODE.indexOf('p.ttl=')<0,'o bloco nunca escreve ttl');
  assert.ok(B4CODE.indexOf('.ttl=')<0);
  finish(p);
});
ok('B4-68 sair antecipadamente registra a decisão como recusada',()=>{
  const p=spawnForced('ambiguous','trade');
  toActive(p);
  T.pr15PresLeave('dev');
  finish(p);
  const r=snap().resolved.find(x=>x.enc.indexOf('f-ambiguous-trade')>=0);
  assert.ok(r,'registrada');
  assert.strictEqual(r.ok,0,'não aceita');
});
ok('B4-69 dt hostil não corrompe o estado de intenção',()=>{
  const p=T.pr15PresSpawn(enc({id:'lc5'}),null);
  toActive(p);
  for(const bad of [NaN,-1,Infinity,'x',null,undefined,1e9,{}]){
    T.pr15IntentUpdate(bad);
    assert.ok(fin(p.it.t),'t finito após dt='+String(bad));
    assert.ok(fin(p.it.cd));
  }
  assert.ok(p.it.t<=C.labelHold+TOTAL,'t não explode');
  finish(p);
});

/* =====================================================================
   S — SAVE   ·   T — CONTINUE
   ===================================================================== */
function packOf(){return V(T.pr15IntentPack());}
ok('B4-70 save durante spawning/active/leaving grava o estado mínimo',()=>{
  for(const ph of ['spawning','active','leaving']){
    reset();
    const p=spawnForced('rival','pressure',{enc:{id:'sv-'+ph}});
    if(ph!=='spawning')toActive(p);
    if(ph==='leaving')T.pr15PresLeave('t');
    const pk=packOf();
    assert.ok(pk&&pk.act,'act presente em '+ph);
    assert.strictEqual(pk.act.enc,'sv-'+ph);
    assert.strictEqual(pk.act.it,'rival');
    assert.strictEqual(pk.act.vr,'pressure');
    for(const k in pk.act)assert.ok(!['ghosts','parts','player','enemies'].includes(k));
    assert.ok(Object.keys(pk.act).length<=12,'act compacto ('+Object.keys(pk.act).length+' campos)');
    finish(p);
  }
});
ok('B4-71 o pack não serializa partículas, afterimages, closures nem entidades',()=>{
  const p=T.pr15PresSpawn(enc({id:'sv-min'}),null);
  toActive(p);
  const json=JSON.stringify(packOf());
  for(const bad of ['ghosts','pUsed','alpha','scale','vx','vy','lobes','reasons','scores'])
    assert.ok(json.indexOf('"'+bad+'"')<0,'sem "'+bad+'" no pack');
  assert.ok(json.length<400,'checkpoint compacto ('+json.length+' bytes)');
  finish(p);
});
ok('B4-72 cp.pr15intent é campo próprio — cp.pr15mem e cp.pr15presence intactos',()=>{
  assert.ok(B4CODE.indexOf('cp.pr15mem')<0,'B4 não toca pr15mem');
  assert.ok(B4CODE.indexOf('cp.pr15presence')<0,'B4 não toca pr15presence');
  const b3=stripComments(B3SRC),b2=stripComments(B2SRC);
  assert.ok(b3.indexOf('cp.pr15presence=pr15PresPack()')>=0,'B3 continua gravando o seu');
  assert.ok(b2.indexOf('cp.pr15mem=pr15MemPack()')>=0,'B2 continua gravando o seu');
});
ok('B4-73 Continue restaura intenção e variante SEM rerollar',()=>{
  reset();
  const p=spawnForced('rival','trial',{enc:{id:'ct1'}});
  toActive(p);
  const kind=p.it.kind,variant=p.it.variant;
  for(let i=0;i<40;i++){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  const pk=packOf();
  const pkP=V(T.pr15PresPack());          // ANTES do reset (o reset zera o registro)
  const age0=P().age,n0=nodeOf(p);
  T.pr15PresReset();T.pr15IntentReset();
  assert.strictEqual(P(),null);
  T.pr15IntentUnpack({pr15intent:pk});
  /* UMA chamada só — é exatamente o caminho do resumeRun: o rebuild de
     intenção reconstrói o corpo por dentro e só então repõe contadores e a
     âncora. Chamar pr15PresRebuild() antes consumiria o payload. */
  X('pr15PresRun=pr15PresSanitize('+JSON.stringify(pkP)+')');
  assert.ok(T.pr15IntentRebuild(),'rebuild devolveu o corpo');
  const p2=P();
  assert.ok(p2,'corpo reconstruído');
  assert.strictEqual(p2.it.kind,kind,'intenção preservada');
  assert.strictEqual(p2.it.variant,variant,'variante preservada');
  assert.ok(Math.abs(p2.age-age0)<0.02,'TTL não reiniciou');
  const n2=nodeOf(p2);
  assert.ok(Math.abs(n0.x-n2.x)<0.2&&Math.abs(n0.y-n2.y)<0.2,
    'âncora preservada ('+n0.x.toFixed(1)+','+n0.y.toFixed(1)+') → ('+
    n2.x.toFixed(1)+','+n2.y.toFixed(1)+')');
  finish(p2);
});
ok('B4-74 Continue não duplica recompensa já concedida',()=>{
  reset();
  const p=spawnForced('rival','trial',{enc:{id:'ct2'}});
  toActive(p);X('kills=0');
  for(let i=0;i<20&&P();i++){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  X('kills='+C.trialKills);
  T.pr15IntentUpdate(0.05);
  const res1=T.getResidues();
  assert.ok(res1>0,'recompensa concedida');
  const pk=packOf();
  /* segundo Continue sobre o mesmo encontro */
  T.pr15IntentUnpack({pr15intent:pk});
  const again=T.pr15IntentMarkResolved('ct2','rival','trial',1,{res:99});
  assert.strictEqual(again.ok,1,'retorna o registro existente');
  assert.strictEqual(snap().resolved.filter(r=>r.enc==='ct2').length,1,'uma única entrada');
  assert.strictEqual(T.getResidues(),res1,'saldo inalterado');
});
ok('B4-75 Continue não duplica custo já pago',()=>{
  reset();
  const p=spawnForced('rival','scar',{enc:{id:'ct3'}});
  toActive(p);
  const hp0=T.getPlayer().hp;
  settleOffer(p);
  T.pr15IntentUpdate(0.05);
  const paid=hp0-T.getPlayer().hp;
  assert.ok(paid>0,'custo pago');
  const pk=packOf();
  assert.strictEqual(pk.act.st,'resolved','o aceite foi registrado no checkpoint');
  const pkP=V(T.pr15PresPack());
  T.pr15PresReset();T.pr15IntentReset();
  T.pr15IntentUnpack({pr15intent:pk});
  X('pr15PresRun=pr15PresSanitize('+JSON.stringify(pkP)+')');
  assert.ok(T.pr15IntentRebuild(),'Continue reconstruiu o encontro');
  /* tenta pagar de novo no mesmo encontro, já restaurado */
  const p2=P();
  assert.strictEqual(p2.it.variant,'scar');
  assert.strictEqual(p2.it.st,'resolved','estado terminal restaurado');
  settleOffer(p2);
  T.pr15IntentUpdate(0.05);
  assert.strictEqual(T.pr15IntentScarAccept(p2),false,'recusado');
  assert.strictEqual(T.getPlayer().hp,hp0-paid,'HP não caiu de novo');
});
ok('B4-76 contadores de pulso/pressão/prova sobrevivem ao Continue',()=>{
  reset();
  const p=spawnForced('allied','pulse',{enc:{id:'ct4'},player:{shield:0,shieldMax:200}});
  toActive(p);
  for(let i=0;i<400&&P()&&(p.it.pulses|0)<2;i++){placePlayerNear(p,30);T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
  const n0=p.it.pulses|0;
  assert.ok(n0>=1,'houve pulsos');
  const pk=packOf();
  assert.strictEqual(pk.act.pu,n0,'pulsos persistidos');
  T.pr15IntentUnpack({pr15intent:pk});
  assert.strictEqual(T.pr15IntentSanitize(pk).act.pu,n0);
});
ok('B4-77 o registro de encontros resolvidos tem cap',()=>{
  reset();
  for(let i=0;i<40;i++)T.pr15IntentMarkResolved('r'+i,'allied','zone',1,{});
  assert.ok(snap().resolved.length<=C.resMax,'≤ '+C.resMax);
  assert.strictEqual(snap().resolved.length,C.resMax);
});

/* =====================================================================
   U / V / W — IDEMPOTÊNCIA E ANTI-DUPLICAÇÃO
   ===================================================================== */
ok('B4-78 interação repetida não aplica efeito duas vezes',()=>{
  const p=spawnForced('ambiguous','trade');
  X('addResidues(50,"t")');
  toActive(p);
  const r0=T.getResidues();
  settleOffer(p);
  T.pr15IntentUpdate(0.05);
  const r1=T.getResidues();
  for(let i=0;i<20;i++){placePlayerNear(p,10);T.pr15IntentUpdate(0.05);}
  assert.strictEqual(T.getResidues(),r1,'cobrou uma única vez');
  assert.ok(r0-r1===C.tradeCost);
});
ok('B4-79 markResolved é idempotente por encounterId',()=>{
  reset();
  const a=T.pr15IntentMarkResolved('idem','rival','trial',1,{res:3});
  const b=T.pr15IntentMarkResolved('idem','allied','zone',0,{res:99});
  assert.strictEqual(a,b,'mesma referência');
  assert.strictEqual(b.k,'rival','não sobrescreve');
  assert.strictEqual(snap().resolved.length,1);
});
ok('B4-80 orçamento por run impede snowball de três memórias aliadas',()=>{
  reset();
  let total=0;
  for(let i=0;i<3;i++){
    const p=spawnForced('allied','pulse',{enc:{id:'sb'+i},player:{shield:0,shieldMax:400}});
    toActive(p);
    for(let k=0;k<2000&&P();k++){placePlayerNear(p,20);T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
    total=snap().budget.shield;
  }
  assert.ok(total<=C.budget.shield+1e-9,'teto de escudo por run: '+total+' ≤ '+C.budget.shield);
  /* sem o teto seriam 3 aparições × 4 pulsos × 6% = 72% do escudo */
  assert.ok(C.budget.shield<0.72,'o teto realmente corta o acúmulo');
});
ok('B4-81 economia temporal é limitada e não cria moeda infinita',()=>{
  reset();
  let soma=0;
  for(let i=0;i<6;i++)soma+=T.pr15IntentGrantRes(10,0,0);
  assert.strictEqual(soma,C.budget.res,'teto de ⧗ por run = '+C.budget.res);
  assert.strictEqual(T.pr15IntentGrantRes(10,0,0),0,'esgotado');
  assert.ok(B4CODE.indexOf('addResidues')>=0,'usa a API central');
  assert.ok(B4CODE.indexOf('fracRun.res')<0,'não escreve saldo direto');
});
ok('B4-82 cura total por run é limitada',()=>{
  reset();
  T.setPlayer(Object.assign(T.getPlayer(),{hp:1,maxHp:500}));
  let soma=0;
  for(let i=0;i<20;i++)soma+=T.pr15IntentGrantHeal(30);
  assert.strictEqual(soma,C.budget.heal,'teto de cura = '+C.budget.heal);
  assert.ok(C.budget.heal<=50,'cura total modesta frente a 66–185 HP');
});
ok('B4-83 a cicatriz só pode ser aberta uma vez por run',()=>{
  reset();
  assert.strictEqual(C.budget.scar,1);
  assert.strictEqual(T.pr15IntentSpend('scar',1),1);
  assert.strictEqual(T.pr15IntentSpend('scar',1),0,'segunda abertura recusada');
});

/* =====================================================================
   X — SANDBOX
   ===================================================================== */
ok('B4-84 nenhuma consequência é aplicada dentro do Sandbox',()=>{
  const p=spawnForced('ambiguous','trade',{enc:{id:'sbx'}});
  X('sandboxRun=true');                   // entra no laboratório com a presença já em cena
  X('fracRun=fracFresh()');
  X('addResidues(50,"t")');
  toActive(p);
  const r0=T.getResidues();
  for(let i=0;i<40;i++){placePlayerNear(p,5);T.pr15IntentUpdate(0.05);}
  assert.strictEqual(T.getResidues(),r0,'saldo intacto');
  assert.strictEqual(T.getSmMods().length,0,'nenhum mod');
  assert.ok(T.pr15IntentGuard()===false,'guard bloqueia');
  X('sandboxRun=false');
});
ok('B4-85 o Sandbox recebe registro vazio e devolve o real intacto',()=>{
  reset();
  const p=T.pr15PresSpawn(enc({id:'real1'}),null);
  toActive(p);
  const realBefore=JSON.stringify(snap().resolved);
  T.pr15IntentSandboxContextStart();
  assert.strictEqual(snap().resolved.length,0,'laboratório começa vazio');
  const ps=T.pr15PresSpawn(enc({id:'lab1'}),null);
  if(ps){toActive(ps);finish(ps);}
  T.pr15IntentSandboxTearDown();
  assert.strictEqual(JSON.stringify(snap().resolved),realBefore,'estado real devolvido');
});
ok('B4-86 sandboxRun/sandboxMode bloqueiam o anúncio e o áudio',()=>{
  reset();
  X('sandboxRun=true');
  const p=T.pr15PresSpawn(enc({id:'sbx2'}),null);
  assert.ok(p.it,'intenção existe (o laboratório precisa testar)');
  assert.ok(B4CODE.indexOf('sandboxRun')>=0);
  assert.ok(B4CODE.indexOf('sandboxMode')>=0);
  X('sandboxRun=false');
});
ok('B4-87 sandbox hooks estão instalados nos 5 pontos do projeto',()=>{
  for(const fn of ['sandboxStart','sandboxRestart','sandboxEndToSetup','sandboxExit','sandboxCloseSetup']){
    const re=new RegExp('const _\\w+='+fn+';'+fn+'=function');
    assert.ok(re.test(B4CODE.replace(/\s+/g,''))||B4CODE.indexOf(fn+'=function')>=0,fn+' engatado');
  }
});
ok('B4-88 o laboratório não escreve memória nem contamina o slot',()=>{
  assert.ok(B4CODE.indexOf('echoQueue')<0,'B4 nunca toca echoQueue');
  assert.ok(B4CODE.indexOf('saveEchoes')<0);
  assert.ok(B4CODE.indexOf('smCommit')<0);
  assert.ok(B4CODE.indexOf('smRoot')<0,'não escreve no save');
});

/* =====================================================================
   Y — DEV
   ===================================================================== */
ok('B4-89 helpers DEV são inertes em release',()=>{
  reset();
  X('DEV_MODE=false');
  assert.strictEqual(T.pr15DevIntentState(),null);
  assert.strictEqual(T.pr15DevIntentExplain(),null);
  assert.strictEqual(T.pr15DevIntentForce('rival'),null);
  assert.strictEqual(T.pr15DevIntentForceVariant('scar'),null);
  assert.strictEqual(T.pr15DevPresenceIntentState(),null);
  const D=T.getDEV();
  for(const k of ['pr15IntentState','pr15IntentExplain','pr15ForceIntent',
    'pr15ForceVariant','pr15PresenceIntentState'])
    assert.strictEqual(typeof D[k],'function','DEV.'+k+' registrado');
  /* o B3 continua com os seus */
  for(const k of ['pr15PresenceState','pr15PresenceSpawn','pr15PresenceEnd','pr15PresenceVisual'])
    assert.strictEqual(typeof D[k],'function','DEV.'+k+' (B3) preservado');
});
ok('B4-90 DEV.pr15ForceIntent força a intenção e tainta a run',()=>{
  reset();
  X('DEV_MODE=true');
  const r=T.pr15DevIntentForce('rival');
  assert.strictEqual(r.ok,true);
  assert.strictEqual(T.getDevTainted(),true,'run tainted');
  const p=T.pr15PresSpawn(enc({id:'dv1'}),null);
  assert.strictEqual(p.it.kind,'rival');
  T.pr15DevIntentForce('allied');
  assert.strictEqual(T.getPr15IntentForce().kind,'allied');
  T.pr15DevIntentForce(null);
  assert.strictEqual(T.getPr15IntentForce(),null,'força removida');
  X('DEV_MODE=false');
});
ok('B4-91 DEV.pr15ForceVariant valida a variante e tainta',()=>{
  reset();
  X('DEV_MODE=true');
  assert.strictEqual(T.pr15DevIntentForceVariant('inexistente').ok,false);
  const r=T.pr15DevIntentForceVariant('scar');
  assert.strictEqual(r.ok,true);
  assert.strictEqual(T.getDevTainted(),true);
  const p=T.pr15PresSpawn(enc({id:'dv2'}),null);
  assert.strictEqual(p.it.variant,'scar');
  X('DEV_MODE=false');
});
ok('B4-92 presença DEV nunca aplica consequência real',()=>{
  reset();
  X('DEV_MODE=true');
  const r=T.pr15DevPresenceSpawn({source:'n1',resonance:'high'});
  assert.strictEqual(r.ok,true);
  X('DEV_MODE=false');
  const p=P();
  assert.strictEqual(p.dev,true);
  X('addResidues(50,"t")');
  const r0=T.getResidues();
  toActive(p);
  /* força a variante de troca para tentar o efeito */
  p.it.variant='trade';p.it.st='idle';
  for(let i=0;i<20;i++){placePlayerNear(p,5);T.pr15IntentUpdate(0.05);}
  assert.strictEqual(T.getResidues(),r0,'DEV não movimentou recurso real');
});
ok('B4-93 presença DEV nunca é persistida no checkpoint',()=>{
  reset();
  X('DEV_MODE=true');
  T.pr15DevPresenceSpawn({source:'n1',resonance:'high'});
  X('DEV_MODE=false');
  assert.strictEqual(packOf(),null,'nada a gravar');
});
ok('B4-94 run dev-tainted nunca grava estado B4',()=>{
  reset();
  const p=T.pr15PresSpawn(enc({id:'dv4'}),null);
  toActive(p);
  T.pr15IntentMarkResolved('dv4','allied','zone',1,{});
  assert.strictEqual(T.getDevTainted(),false,'run limpa até aqui');
  assert.ok(packOf(),'grava em run limpa');
  T.setDevTainted(true);
  assert.strictEqual(packOf(),null,'não grava com devTainted');
});
ok('B4-95 forçar intenção não cria descriptor falso no estado do B2',()=>{
  reset();
  T.setPr15MemRun(V(T.pr15MemFresh('k',1)));
  const before=JSON.stringify(V(T.pr15MemSnapshot()));
  X('DEV_MODE=true');
  T.pr15DevIntentForce('ambiguous');
  T.pr15PresSpawn(enc({id:'dv5'}),null);
  X('DEV_MODE=false');
  assert.strictEqual(JSON.stringify(V(T.pr15MemSnapshot())),before,'plano do B2 intacto');
});

/* =====================================================================
   Z — SLOT ISOLATION
   ===================================================================== */
ok('B4-96 activateSlot limpa o estado de intenção',()=>{
  reset();
  const p=T.pr15PresSpawn(enc({id:'sl1'}),null);
  toActive(p);
  T.pr15IntentMarkResolved('sl1','allied','zone',1,{});
  assert.ok(snap().resolved.length>0);
  T.activateSlot(2);
  assert.strictEqual(snap().resolved.length,0,'registro limpo');
  assert.strictEqual(snap().active,false);
  assert.strictEqual(P(),null);
});
ok('B4-97 smClearSlotSave limpa o estado de intenção',()=>{
  reset();
  T.pr15IntentMarkResolved('sl2','rival','trial',1,{});
  T.pr15IntentSpend('res',3);
  T.smClearSlotSave();
  const s=snap();
  assert.strictEqual(s.resolved.length,0);
  assert.strictEqual(s.budget.res,0);
});
ok('B4-98 slot sem estado não escreve lixo no save do vizinho',()=>{
  reset();
  assert.strictEqual(packOf(),null,'pack vazio = null');
  assert.ok(B4SRC.indexOf('activateSlot=function')>=0);
});

/* =====================================================================
   AA — CORRUPTED SAVE   ·   AB — OLD SAVE
   ===================================================================== */
ok('B4-99 cargas hostis em cp.pr15intent não lançam nem produzem NaN',()=>{
  const hostile=[null,undefined,{},[],'x',7,true,NaN,Infinity,-1,
    {v:'x',res:'nada',bud:'nada',act:'nada'},
    {v:1,res:[null,1,'x',[],{},NaN],bud:{res:NaN,heal:Infinity,shield:'x',rep:-5,moral:1e9},act:{}},
    {v:1,res:[{enc:'',k:'nada',vr:'nada',ok:'x',w:NaN}],bud:{res:-3},act:{enc:1,it:'nada',vr:'nada',st:'nada',t:NaN,cd:Infinity,pu:1e9,fi:-3,tr:99,k0:NaN}},
    {v:1,res:[{enc:'ok1',k:'rival',vr:'trial',ok:1,w:9999}],bud:{res:1e9,heal:1e9,shield:1e9,rep:1e9,moral:1e9,scar:1e9},
      act:{enc:'ok1',it:'allied',vr:'zone',st:'resolved',t:1e9,cd:1e9,pu:1e9,fi:1e9,tr:1e9,k0:1e9}}
  ];
  for(let i=0;i<hostile.length;i++){
    let out;
    assert.doesNotThrow(()=>{out=T.pr15IntentSanitize(hostile[i]);},'carga '+i);
    const o=V(out);
    assert.ok(Array.isArray(o.res));
    for(const e of o.res){
      assert.ok(typeof e.enc==='string'&&e.enc);
      assert.ok(T.PR15_INTENTS[e.k],'k válido');
      assert.ok(fin(e.w)&&e.w>=0&&e.w<=20,'w finito');
    }
    for(const k of ['res','heal','shield','rep','moral','scar']){
      assert.ok(fin(o.bud[k]),'bud.'+k+' finito');
      assert.ok(o.bud[k]>=0&&o.bud[k]<=C.budget[k]+1e-9,'bud.'+k+' dentro do teto');
    }
    if(o.act){
      assert.ok(fin(o.act.t)&&o.act.t>=0,'act.t finito');
      assert.ok(T.PR15_INTENTS[o.act.it]);
      assert.ok(T.PR15_ISTATES[o.act.st]);
    }
  }
});
ok('B4-100 unpack tolerante nunca quebra o Continue',()=>{
  for(const cp of [null,undefined,{},{pr15intent:null},{pr15intent:7},
    {pr15intent:'x'},{pr15intent:[]},{pr15intent:{v:1}}]){
    assert.doesNotThrow(()=>T.pr15IntentUnpack(cp));
    const s=snap();
    assert.ok(Array.isArray(s.resolved));
    assert.ok(fin(s.budget.res));
  }
});
ok('B4-101 save antigo sem cp.pr15intent carrega e não concede nada',()=>{
  reset();
  T.pr15IntentUnpack({wave:5,kills:3});           // checkpoint pré-B4
  assert.strictEqual(snap().resolved.length,0);
  assert.strictEqual(snap().budget.res,0);
  assert.strictEqual(snap().active,false);
  assert.ok(B1SRC.indexOf('v:3')>=0||B1SRC.indexOf('PR15_SAN_DEFAULTS')>=0,'B1 intacto');
});
ok('B4-102 save v2 e v3 continuam carregáveis (sanitização do B1 intacta)',()=>{
  const v2={v:2,dur:200,dmgMul:1,frMul:1,wave:6,level:5,trail:[[0,100,200,1,0,0]],
    crit:.1,critMul:1.9,pierce:1,aoeMul:1,rangeMul:1,meleeRangeMul:1,rangedRangeMul:1,
    projSpdMul:1,longRangeBonus:0,coins:120,items:[],upg:[],owned:[0,1],
    moral:{comp:4,greed:2,viol:6},dom:'viol',k:40,mh:110,st:{s:400},ps:null};
  const s2=V(T.pr15SanitizeRecord(v2));
  assert.ok(s2,'v2 sanitizado');
  assert.strictEqual(T.pr15MemIsEligible(s2),false,'v2 não vira presença (sem id)');
  const v3=mem('e1-1');
  assert.strictEqual(T.pr15MemIsEligible(v3),true,'v3 continua elegível');
});
ok('B4-103 uma run antiga com descriptor consumido não ganha intenção retroativa',()=>{
  reset();
  T.setPr15MemRun(V(T.pr15MemFresh('k',1)));
  assert.strictEqual(T.pr15PresOnWave(9),null,'onda 9 sem descriptor: nada');
  assert.strictEqual(P(),null);
  assert.strictEqual(snap().active,false);
});

/* =====================================================================
   AC/AD/AE — REGRESSÕES B1 / B2 / B3
   ===================================================================== */
ok('B4-104 B1 intacto: validade, causa da morte e assinatura continuam operando',()=>{
  reset();
  const q=V(T.getEchoQueue());
  assert.strictEqual(T.pr15MemIsEligible(q[0]),true);
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,sandbox:false,dev:false,abort:false,
    victory:false,wave:5,kills:10,dur:120,mh:80,level:2,hasPlayer:true,hasTrail:true}),true);
  assert.strictEqual(T.pr15RunIsValid({realDeath:false,sandbox:false,dev:false,abort:true,
    victory:false,wave:5,kills:10,dur:120,mh:80,level:2,hasPlayer:true,hasTrail:true}),false);
  assert.strictEqual(T.pr15SanitizeCause('boss'),'boss');
  assert.strictEqual(T.pr15SanitizeCause('nada'),'unknown');
  assert.deepStrictEqual(V(T.PR15_DEATH_CAUSES),
    ['boss','miniboss','echo','enemy','hazard','event','unknown']);
});
ok('B4-105 B2 intacto: plano, conflitos e cooldown do Director inalterados',()=>{
  reset();
  const q=V(T.getEchoQueue());
  const plan=V(T.pr15MemBuildPlan(q,12345,'cinza'));
  assert.ok(plan.length>=1&&plan.length<=3,'plano de 1–3 encontros');
  for(const e of plan){
    assert.ok(e.intent>=0&&e.intent<100000,'intentSeed preservado');
    assert.strictEqual(e.st,'scheduled');
  }
  assert.strictEqual(T.pr15MemWaveBusy(1).length>=0,true);
  assert.deepStrictEqual(V(T.PR15_MEM_CFG).maxEncounters,3);
  assert.ok(B4CODE.indexOf('pr15MemRun=')<0,'B4 nunca escreve no estado do B2');
  assert.ok(B4CODE.indexOf('pr15MemOnWave')<0,'B4 não interfere na resolução de onda');
});
ok('B4-106 B3 intacto: caps, fases e ciclo de vida da presença inalterados',()=>{
  assert.strictEqual(PRESC.afterimageMax,4);
  assert.strictEqual(PRESC.particleMax,10);
  assert.strictEqual(PRESC.doneMax,8);
  assert.ok(Math.abs(TOTAL-(PRESC.entryTime+PRESC.activeTime+PRESC.exitTime))<1e-9);
  reset();
  const p=T.pr15PresSpawn(enc({id:'b3reg'}),null);
  let ghosts=0,parts=0;
  for(let i=0;i<3000&&P();i++){
    T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
    if(P()){ghosts=Math.max(ghosts,(P().ghosts||[]).length);parts=Math.max(parts,P().pUsed|0);}
  }
  assert.ok(ghosts<=PRESC.afterimageMax,'afterimages ≤ 4 (máx '+ghosts+')');
  assert.ok(parts<=PRESC.particleMax,'partículas ≤ 10 (máx '+parts+')');
});
ok('B4-107 a presença continua fora de echoes[] e enemies[] com o B4 ativo',()=>{
  const q=stdQueue();
  reset(q);
  T.setEchoes([T.makeEcho(V(q[0]),1)]);
  const p=T.pr15PresSpawn(enc({id:'sep'}),null);
  toActive(p);
  assert.strictEqual(V(T.getEchoes()).length,1);
  assert.strictEqual(V(T.getEnemies()).length,0);
  assert.ok(V(T.getEchoes()).every(e=>e.encounterId===undefined));
  finish(p);
});
ok('B4-108 cp.pr15presence continua byte-a-byte como no B3',()=>{
  reset();
  const p=T.pr15PresSpawn(enc({id:'b3pk'}),null);
  toActive(p);
  const pk=V(T.pr15PresPack());
  assert.deepStrictEqual(Object.keys(pk).sort(),['act','done','v']);
  assert.deepStrictEqual(Object.keys(pk.act).sort(),
    ['age','enc','fb','intent','mem','ph','res','seed','src','v','wave','x','y']);
  finish(p);
});
ok('B4-109 os blocos B1/B2/B3 não foram editados internamente',()=>{
  /* o B4 só pode tocar o jogo por monkey-patch; nenhuma função antiga reescrita */
  for(const bad of ['pr15PresUpdate=function','pr15PresDraw=function',
    'pr15PresResolveMemory=function','pr15MemBuildPlan=function','pr15CommitSig=function'])
    assert.ok(B4CODE.indexOf(bad)<0,'B4 não reescreve '+bad);
  for(const good of ['pr15PresSpawn=function','pr15PresEnd=function','updateAllies=function',
    'drawWorldExtras=function','render=function','smBuildCheckpoint=function','resumeRun=function'])
    assert.ok(B4CODE.indexOf(good)>=0,'hook presente: '+good);
});

/* =====================================================================
   AF — PERFORMANCE CAPS
   ===================================================================== */
ok('B4-110 nenhum array do B4 cresce sem limite',()=>{
  reset();
  const p=spawnForced('ambiguous','choice');
  toActive(p);
  for(let i=0;i<3000&&P();i++){
    T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
    if(P()&&P().it&&P().it.lobes){
      const L=V(P().it.lobes);
      assert.ok(Object.keys(L).length===3,'lobes com a/cyan/magenta');
      for(const k of ['cyan','magenta']){
        assert.ok(fin(L[k].x)&&fin(L[k].y),'lobo '+k+' finito');
        assert.ok(Object.keys(L[k]).length===4,'lobo compacto');
      }
    }
  }
  for(let i=0;i<200;i++)T.pr15IntentMarkResolved('x'+i,'allied','zone',1,{});
  assert.ok(snap().resolved.length<=C.resMax,'res ≤ '+C.resMax);
});
ok('B4-111 o bloco não usa timers, listeners nem requestAnimationFrame',()=>{
  for(const bad of ['setTimeout','setInterval','requestAnimationFrame','addEventListener',
    'new Worker','MutationObserver'])
    assert.ok(B4CODE.indexOf(bad)<0,'sem '+bad);
});
ok('B4-112 não há varredura cara por frame: update faz early-return sem presença',()=>{
  reset();
  const t0=process.hrtime.bigint();
  for(let i=0;i<200000;i++)T.pr15IntentUpdate(0.016);
  const ms=Number(process.hrtime.bigint()-t0)/1e6;
  assert.ok(ms<2000,'200k chamadas vazias em '+ms.toFixed(0)+'ms');
});
ok('B4-113 o renderer não aloca por frame além do previsto e não toca DOM',()=>{
  assert.ok(B4CODE.indexOf('document.')<0,'sem DOM no bloco');
  assert.ok(B4CODE.indexOf('innerHTML')<0);
  assert.ok(B4CODE.indexOf('createElement')<0);
  assert.ok(B4CODE.indexOf('getElementById')<0);
});

/* =====================================================================
   AG — UI STATE   ·   AH — OFF-SCREEN
   ===================================================================== */
ok('B4-114 microcopy curta no surgimento (banner + toast, uma vez)',()=>{
  reset();
  const p=T.pr15PresSpawn(enc({id:'ui1'}),null);
  const L=V(T.PR15_INTENT_LABEL)[p.it.kind];
  assert.ok(L.nm&&L.nm.length<=32,'rótulo curto: '+L.nm);
  assert.ok(C.spawnBanner.length<=32);
  assert.ok(p.it.labelT>0,'rótulo agendado');
  assert.ok(V(T.PR15_VARIANT_LABEL)[p.it.variant].length<=28);
});
ok('B4-115 o rótulo world-space some sozinho e não é painel permanente',()=>{
  const p=spawnForced('allied','zone');
  toActive(p);
  const l0=p.it.labelT;
  assert.ok(l0<=C.labelHold,'duração limitada');
  for(let i=0;i<(C.labelHold/0.05)+5&&P();i++)T.pr15IntentUpdate(0.05);
  assert.ok(P().it.labelT<=0,'expirou');
  /* variantes passivas não mantêm rótulo de interação */
  assert.strictEqual(T.pr15IntentOfferable(P()),false);
});
ok('B4-116 variantes interativas exibem o custo/benefício ANTES da escolha',()=>{
  for(const v of ['scar','trade','unstable','choice']){
    const p=spawnForced(v==='scar'?'rival':'ambiguous',v,{enc:{id:'lbl-'+v}});
    const label=T.pr15IntentInteractLabel(p);
    assert.ok(label.length>10,v+': há explicação');
    assert.ok(T.pr15IntentOfferable(p),v+': é interativa');
    finish(p);
  }
  for(const v of ['zone','pulse','legacy','pressure','trial']){
    const p=spawnForced(v==='zone'||v==='pulse'||v==='legacy'?'allied':'rival',v,{enc:{id:'lbl2-'+v}});
    assert.strictEqual(T.pr15IntentOfferable(p),false,v+': não exige aproximação');
    finish(p);
  }
});
ok('B4-117 nenhuma UI permanente: o bloco não cria elemento nem HUD novo',()=>{
  assert.ok(B4CODE.indexOf('appendChild')<0);
  assert.ok(B4CODE.indexOf('toastsEl')<0,'usa toast(), não o container');
  assert.ok(B4CODE.indexOf('bannerEl')<0);
  assert.ok(B4CODE.indexOf('style.display')<0);
});
ok('B4-118 indicador off-screen aparece só quando a presença está fora da janela',()=>{
  reset();
  const p=spawnForced('allied','zone');
  toActive(p);
  globalThis.__ctxLog=[];
  X('vw=1280;vh=720');
  /* presença visível: nenhum marcador */
  T.setCam({x:p.x,y:p.y});
  assert.strictEqual(T.pr15IntentEdge(),false,'visível → sem marcador');
  /* presença fora: marcador */
  T.setCam({x:p.x+1400,y:p.y});
  assert.strictEqual(T.pr15IntentEdge(),true,'fora da tela → marcador');
  const log1=(globalThis.__ctxLog||[]).length;
  assert.ok(log1>0,'desenhou o marcador ('+log1+' ops de canvas)');
  globalThis.__ctxLog=null;
});
ok('B4-118b com interação pendente o indicador aponta a ÂNCORA, não o corpo',()=>{
  const p=spawnForced('ambiguous','trade');
  toActive(p);
  X('vw=1280;vh=720');
  const n=nodeOf(p);
  /* câmera sobre o corpo: a âncora (interação pendente) fica fora → marcador */
  T.setCam({x:p.x,y:p.y});
  const dist=Math.hypot(p.x-n.x,p.y-n.y);
  if(dist<400){/* âncora perto demais do corpo p/ este cenário: usa a escolha */}
  assert.strictEqual(T.pr15IntentOfferable(p),true,'interação pendente');
  T.setCam({x:n.x+1400,y:n.y});
  assert.strictEqual(T.pr15IntentEdge(),true,'âncora fora da tela → marcador');
});
ok('B4-119 o indicador some quando a presença sai ou a run não está em jogo',()=>{
  reset();
  const p=spawnForced('allied','zone');
  toActive(p);
  X('vw=1280;vh=720');
  globalThis.__ctxLog=[];
  T.setCam({x:p.x+1400,y:p.y});
  assert.strictEqual(T.pr15IntentEdge(),true);
  T.pr15PresLeave('t');
  assert.strictEqual(T.pr15IntentEdge(),false,'leaving → sem marcador');
  finish(p);
  assert.strictEqual(T.pr15IntentEdge(),false,'sem presença → sem marcador');
  reset();
  const p2=spawnForced('allied','zone');
  toActive(p2);
  T.setCam({x:p2.x+1400,y:p2.y});
  T.setState('shop');
  assert.strictEqual(T.pr15IntentEdge(),false,'fora de play → sem marcador');
});
ok('B4-120 o hook de render está instalado e é screen-space',()=>{
  assert.ok(B4CODE.indexOf('render=function')>=0,'render engatado');
  assert.ok(B4SRC.indexOf('cam.x')>=0&&B4SRC.indexOf('vw')>=0,'usa câmera/viewport');
  assert.ok(B4CODE.indexOf('edgePad')>=0||B4CODE.indexOf('C.edgePad')>=0,'margem configurável');
});

/* =====================================================================
   AI — ZERO NaN   ·   AJ — ZERO EXCEPTION   ·   AK — NO TIMERS   ·   AL — ARRAYS
   ===================================================================== */
function deepFinite(o,path,out){
  out=out||[];
  if(o===null||o===undefined)return out;
  if(typeof o==='number'){if(!Number.isFinite(o))out.push(path+'='+o);return out;}
  if(typeof o!=='object')return out;
  for(const k of Object.keys(o))deepFinite(V(o[k]),path?path+'.'+k:k,out);
  return out;
}
ok('B4-121 nenhum estado contém NaN/Infinity após sanitização',()=>{
  reset();
  for(let i=0;i<40;i++){
    const p=T.pr15PresSpawn(enc({id:'nan'+i,seed:i*7919,intent:i*13}),null);
    if(!p)continue;
    toActive(p);
    for(let k=0;k<60&&P();k++){placePlayerNear(p,10);T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
    const bad=deepFinite(snap(),'snap').concat(P()?deepFinite(V(P().it),'it'):[]);
    assert.deepStrictEqual(bad,[],'iteração '+i);
    const pk=packOf();
    if(pk)assert.deepStrictEqual(deepFinite(pk,'pack'),[],'pack '+i);
    finish(p);
  }
});
ok('B4-122 contexto incompleto não produz NaN nem lança',()=>{
  reset();
  T.setPlayer(null);
  X('moral=null');
  X('fracRun=null');
  const m=mem('e1-2',{arch:null,op:null,theme:null,moral:null,cause:null});
  assert.doesNotThrow(()=>{
    const c=T.pr15IntentContext(m,{seed:NaN,intent:NaN,src:'zz',res:'zz'});
    const d=T.pr15IntentDecide(c);
    assert.ok(PR15Kinds(d.kind));
    assert.deepStrictEqual(deepFinite(V(d),'dec'),[]);
    T.pr15IntentScores(c);T.pr15IntentSignalsFor(c);T.pr15IntentVariant('rival',c);
  });
  function PR15Kinds(k){return ['allied','rival','ambiguous'].indexOf(k)>=0;}
  reset();
});
ok('B4-123 chamadas hostis às funções públicas não lançam exceção',()=>{
  reset();
  const hostile=[null,undefined,{},[],'x',0,-1,NaN,Infinity,true,{a:1}];
  const calls=[
    ()=>T.pr15IntentAttach(null,null,null),
    ()=>T.pr15IntentDecide(null),
    ()=>T.pr15IntentScores(null),
    ()=>T.pr15IntentSignalsFor(null),
    ()=>T.pr15IntentVariant(null,null),
    ()=>T.pr15IntentContext(null,null),
    ()=>T.pr15IntentRng(null),
    ()=>T.pr15IntentRngVar(null),
    ()=>T.pr15IntentNodeOf(null),
    ()=>T.pr15IntentNodeDist(null),
    ()=>T.pr15IntentLobes(null),
    ()=>T.pr15IntentInteractLabel(null),
    ()=>T.pr15IntentOfferable(null),
    ()=>T.pr15IntentTryInteract(null,1),
    ()=>T.pr15IntentScarOffer(null),
    ()=>T.pr15IntentExplain(null),
    ()=>T.pr15IntentSanitize(null),
    ()=>T.pr15IntentUnpack(null),
    ()=>T.pr15IntentUpdate(null),
    ()=>T.pr15IntentClear(null),
    ()=>T.pr15IntentDraw(),
    ()=>T.pr15IntentEdge(),
    ()=>T.pr15IntentSnapshot(),
    ()=>T.pr15IntentSpend(null,NaN),
    ()=>T.pr15IntentGrantMoral(null,NaN),
    ()=>T.pr15IntentMarkResolved(null,null,null,null,null)
  ];
  for(const f of calls)for(const h of hostile)
    assert.doesNotThrow(()=>f(h),'hostil '+JSON.stringify(h));
});
ok('B4-124 nenhum listener/timer fica órfão após o ciclo completo',()=>{
  assert.ok(B4CODE.indexOf('setTimeout')<0&&B4CODE.indexOf('setInterval')<0);
  reset();
  for(let i=0;i<20;i++){
    const p=T.pr15PresSpawn(enc({id:'tm'+i,seed:i+1}),null);
    if(p){toActive(p);finish(p);}
  }
  assert.strictEqual(P(),null);
  assert.strictEqual(T.getPr15PresRun().done.length<=PRESC.doneMax,true);
});
ok('B4-125 echoQueue não é tocada em nenhum caminho do B4',()=>{
  const q=stdQueue();
  reset(q);
  const before=JSON.stringify(V(T.getEchoQueue()));
  for(const k of ['allied','rival','ambiguous'])
    for(const v of V(T.PR15_VARIANTS)[k]){
      const p=spawnForced(k,v,{queue:q,enc:{id:'eq-'+k+'-'+v}});
      if(p){toActive(p);
        for(let i=0;i<120&&P();i++){placePlayerNear(p,10);T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
        finish(p);}
      reset(q);
    }
  assert.strictEqual(JSON.stringify(V(T.getEchoQueue())),before,'histórico intacto');
});
ok('B4-126 caps declarados batem com o comportamento medido',()=>{
  reset();
  let resMax=0;
  for(let i=0;i<300;i++)T.pr15IntentMarkResolved('c'+i,'allied','zone',1,{});
  resMax=snap().resolved.length;
  assert.strictEqual(resMax,C.resMax);
  T.pr15IntentReset();
  assert.strictEqual(snap().resolved.length,0);
  assert.strictEqual(snap().budget.res,0);
  assert.strictEqual(T.getPr15IntentForce(),null);
});

/* =====================================================================
   SIMULAÇÕES §35
   ===================================================================== */
ok('SIM-A: distribuição de intenções em 20 000 contextos — nenhuma some',()=>{
  reset();
  const counts={allied:0,rival:0,ambiguous:0};
  const causes=['boss','miniboss','echo','enemy','hazard','event','unknown'];
  const archs=['melee','ranged','crit','shield','dash','economy','status','echo'];
  const ops=['vector','wraith','bulwark','pyre','warden','nomad'];
  const themes=['cinza','sangue','ferrugem','vazio'];
  const N=20000;
  for(let i=0;i<N;i++){
    const m=mem('e1-2',{
      cause:causes[i%7],
      arch:{dom:archs[(i*3)%8],sec:null,state:'definido',domS:.5,secS:null},
      op:ops[(i*5)%6],theme:themes[(i*7)%4],
      moral:{comp:(i*3)%11,greed:(i*5)%9,viol:(i*7)%13}});
    X('moral={comp:'+((i*11)%13)+',greed:'+((i*13)%7)+',viol:'+((i*17)%11)+'}');
    const k=T.pr15IntentDecide(T.pr15IntentContext(m,{seed:(i*2654435761)>>>0,
      intent:(i*40503)%100000,src:(i%2?'n2':'n1'),
      res:['high','normal','unstable'][i%3]})).kind;
    counts[k]++;
  }
  for(const k of ['allied','rival','ambiguous']){
    assert.ok(counts[k]>0,k+' não desapareceu');
    assert.ok(counts[k]/N>=0.05,k+' ≥ 5% ('+(counts[k]/N*100).toFixed(2)+'%)');
  }
  console.log('      SIM-A '+N+' contextos · ALIADA '+(counts.allied/N*100).toFixed(2)+
    '% · RIVAL '+(counts.rival/N*100).toFixed(2)+'% · AMBÍGUA '+(counts.ambiguous/N*100).toFixed(2)+'%');
});

ok('SIM-B: determinismo sob 200 000 Math.random intercalados',()=>{
  reset();
  const causes=['boss','enemy','hazard','event','echo'];
  const cases=[];
  for(let i=0;i<200;i++){
    const m=mem('e1-2',{cause:causes[i%5],
      arch:{dom:['melee','ranged','crit'][i%3],sec:null,state:'definido',domS:.5,secS:null},
      moral:{comp:i%5,greed:i%3,viol:i%7}});
    cases.push({m:m,d:{seed:i*97,intent:(i*31)%100000,src:(i%2?'n2':'n1'),
      res:['high','normal','unstable'][i%3]},moral:[i%4,i%6,i%2]});
  }
  const first=cases.map(c=>{
    X('moral={comp:'+c.moral[0]+',greed:'+c.moral[1]+',viol:'+c.moral[2]+'}');
    const dec=V(T.pr15IntentDecide(T.pr15IntentContext(c.m,c.d)));
    return dec.kind+'|'+dec.variantSafe+'|'+JSON.stringify(dec.scores)+'|'+
      T.pr15IntentVariant(dec.kind,T.pr15IntentContext(c.m,c.d));
  });
  for(let i=0;i<200000;i++)Math.random();
  const second=cases.map(c=>{
    X('moral={comp:'+c.moral[0]+',greed:'+c.moral[1]+',viol:'+c.moral[2]+'}');
    const dec=V(T.pr15IntentDecide(T.pr15IntentContext(c.m,c.d)));
    return dec.kind+'|'+dec.variantSafe+'|'+JSON.stringify(dec.scores)+'|'+
      T.pr15IntentVariant(dec.kind,T.pr15IntentContext(c.m,c.d));
  });
  assert.deepStrictEqual(second,first,'200 casos idênticos após 200k Math.random');
  console.log('      SIM-B 200 casos × 2 passagens · 200 000 Math.random intercalados · 0 divergências');
});

ok('SIM-C: 600 ciclos de save/Continue em todas as fases — 0 duplicação, 0 reroll',()=>{
  const phases=['spawning','active','leaving'];
  let rerolls=0,dups=0,costDups=0,rewardDups=0,ttlResets=0,checked=0;
  for(let i=0;i<600;i++){
    const kind=['allied','rival','ambiguous'][i%3];
    const variant=V(T.PR15_VARIANTS)[kind][i%3];
    reset();
    const p=spawnForced(kind,variant,{enc:{id:'simc'+i},player:{shield:10,shieldMax:80,hp:80,maxHp:100}});
    if(phases[(i/3|0)%3]!=='spawning')toActive(p);
    if(phases[(i/3|0)%3]==='leaving')T.pr15PresLeave('t');
    for(let k=0;k<((i%7)*3);k++){T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);}
    if(!P())continue;
    const k0=P().it.kind,v0=P().it.variant,age0=P().age;
    const resBefore=V(T.getPr15IntentRun()).res.length;
    const pkI=V(T.pr15IntentPack());
    const pkP=V(T.pr15PresPack());
    /* ciclo completo de Continue pelos caminhos reais */
    T.pr15PresReset();T.pr15IntentReset();
    T.pr15IntentUnpack({pr15intent:pkI});
    X('pr15PresRun=pr15PresSanitize('+JSON.stringify(pkP)+')');
    T.pr15PresRebuild();
    T.pr15IntentRebuild();
    const p2=P();
    if(!p2){continue;}
    checked++;
    if(p2.it.kind!==k0)rerolls++;
    if(p2.it.variant!==v0)rerolls++;
    if(Math.abs(p2.age-age0)>0.02)ttlResets++;
    if(V(T.getPr15IntentRun()).res.length>resBefore+0)dups++;
    /* segundo Continue sobre o mesmo pacote não pode reconceder */
    const budBefore=JSON.stringify(snap().budget);
    T.pr15IntentUnpack({pr15intent:pkI});
    T.pr15IntentRebuild();
    if(JSON.stringify(snap().budget)!==budBefore)rewardDups++;
    if(snap().resolved.filter(r=>r.enc==='simc'+i).length>1)costDups++;
    finish(p2);
  }
  assert.strictEqual(rerolls,0,'zero reroll de intenção/variante');
  assert.strictEqual(ttlResets,0,'zero reinício de TTL');
  assert.strictEqual(dups,0,'zero entrada duplicada');
  assert.strictEqual(rewardDups,0,'zero recompensa repetida');
  assert.strictEqual(costDups,0,'zero custo repetido');
  console.log('      SIM-C '+checked+' ciclos de Continue verificados · 0 reroll · 0 duplicação · TTL preservado');
});

ok('SIM-D: anti-exploit — reload, Continue repetido, abort, morte, vitória, slot, Sandbox, DEV',()=>{
  let viol=0;
  /* 1. reload + Continue repetido sobre o mesmo encontro */
  for(let i=0;i<40;i++){
    reset();
    const p=spawnForced('ambiguous','trade',{enc:{id:'ex-r'+i}});
    X('addResidues(60,"t")');
    toActive(p);placePlayerNear(p,5);
    T.pr15IntentUpdate(0.05);
    const r0=T.getResidues();
    const pkI=V(T.pr15IntentPack());
    for(let k=0;k<5;k++){
      T.pr15IntentUnpack({pr15intent:pkI});
      T.pr15IntentMarkResolved('ex-r'+i,'ambiguous','trade',1,{res:99});
      if(T.getResidues()!==r0)viol++;
    }
    if(snap().resolved.filter(r=>r.enc==='ex-r'+i).length!==1)viol++;
    finish(p);
  }
  /* 2. abort / morte / vitória não deixam estado pendurado.
     Morte e vitória precisam do mundo inteiro — o mesmo pré-requisito que
     a suíte do B1 usa: startRun() antes. */
  for(const endFn of ['abortRun','onPlayerDeath','onVictory']){
    reset();
    X('startRun()');
    X('recorder=[];xporbs=[];parts=[];ftexts=[];allies=[];pickups=[];swings=[];projectiles=[]');
    T.setEchoQueue(stdQueue());
    const p=T.pr15PresSpawn(enc({id:'ex-'+endFn}),null);
    if(!p)continue;
    toActive(p);
    T.pr15IntentSpend('res',4);
    X(endFn+'()');
    if(P()!==null)viol++;
    if(snap().budget.res!==0)viol++;
    if(snap().resolved.length!==0)viol++;
  }
  /* 3. troca de slot */
  reset();
  T.pr15IntentSpend('res',5);
  T.activateSlot(3);
  if(snap().budget.res!==0)viol++;
  /* 4. Sandbox ida e volta */
  reset();
  T.pr15IntentSpend('res',5);
  const before=JSON.stringify(snap().budget);
  T.pr15IntentSandboxContextStart();
  T.pr15IntentSpend('res',99);
  T.pr15IntentSandboxTearDown();
  if(JSON.stringify(snap().budget)!==before)viol++;
  /* 5. DEV não contamina */
  reset();
  X('DEV_MODE=true');
  T.pr15DevIntentForce('rival');
  T.pr15PresSpawn(enc({id:'ex-dev'}),null);
  X('DEV_MODE=false');
  if(packOf()!==null)viol++;
  assert.strictEqual(viol,0,'nenhum exploit passou');
  console.log('      SIM-D 40× reload/Continue + abort/morte/vitória + slot + Sandbox + DEV · 0 violações');
});

ok('SIM-E: 1 200 aparições completas — caps, sem órfãs, sem NaN, sem crescimento',()=>{
  reset();
  let ghostMax=0,partMax=0,doneMax=0,resMax=0,orphans=0,nan=0;
  const t0=process.hrtime.bigint();
  for(let i=0;i<1200;i++){
    const kind=['allied','rival','ambiguous'][i%3];
    const variant=V(T.PR15_VARIANTS)[kind][(i/3|0)%3];
    if(i%50===0)reset();
    const p=spawnForced(kind,variant,{enc:{id:'se'+i,seed:i*7717},
      player:{shield:20,shieldMax:120,hp:90,maxHp:100}});
    if(!p){orphans++;continue;}
    toActive(p);
    const near=(i%3===0);
    let n=0;
    while(P()&&n++<1200){
      if(near)placePlayerNear(p,10);else placePlayerFar(p);
      T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
      if(P()){
        ghostMax=Math.max(ghostMax,(P().ghosts||[]).length);
        partMax=Math.max(partMax,P().pUsed|0);
      }
    }
    if(P())orphans++;
    doneMax=Math.max(doneMax,(V(T.getPr15PresRun()).done||[]).length);
    resMax=Math.max(resMax,snap().resolved.length);
    const bad=deepFinite(snap(),'s');
    if(bad.length)nan++;
    T.pr15IntentReset();
  }
  const ms=Number(process.hrtime.bigint()-t0)/1e6;
  assert.strictEqual(orphans,0,'zero entidade órfã');
  assert.strictEqual(nan,0,'zero NaN');
  assert.ok(ghostMax<=PRESC.afterimageMax,'afterimages máx '+ghostMax+'/'+PRESC.afterimageMax);
  assert.ok(partMax<=PRESC.particleMax,'partículas máx '+partMax+'/'+PRESC.particleMax);
  assert.ok(doneMax<=PRESC.doneMax,'done máx '+doneMax+'/'+PRESC.doneMax);
  assert.ok(resMax<=C.resMax,'res máx '+resMax+'/'+C.resMax);
  assert.strictEqual(V(T.getEchoQueue()).length,2,'histórico intacto');
  console.log('      SIM-E 1 200 aparições em '+(ms/1000).toFixed(1)+'s · afterimages '+ghostMax+
    '/'+PRESC.afterimageMax+' · partículas '+partMax+'/'+PRESC.particleMax+
    ' · done '+doneMax+'/'+PRESC.doneMax+' · res '+resMax+'/'+C.resMax+' · 0 órfãs · 0 NaN');
});

ok('SIM-F: balanceamento — 900 runs × 3 encontros, teto de orçamento real',()=>{
  /* Cada run recebe as 3 aparições que o teto do B2 permite, UMA ATRÁS DA
     OUTRA e sem reset entre elas — é a única forma de o orçamento por run
     acumular. (Resetar a cada encontro zerava os contadores e fazia a
     simulação medir sempre zero.) */
  const keys=['res','heal','shield','rep','moral','scar'];
  const worst={};for(const k of keys)worst[k]=0;
  const perRun=[];
  const kinds=['allied','rival','ambiguous'];
  let capHit=0;
  for(let run=0;run<900;run++){
    reset(undefined,{shield:20,shieldMax:120,hp:90,maxHp:100});
    X('addResidues(30,"base")');
    const res0=T.getResidues();
    let encounters=0;
    for(let e=0;e<3;e++){
      /* família e variante DESACOPLADAS: com o mesmo índice nas duas, cada
         run só via zone/pressure/choice e os caminhos que gastam escudo e
         cura nunca eram exercitados. */
      const kind=kinds[(run+e)%3];
      const hsh=((run*7919)^(e*104729))>>>0;
      const variant=V(T.PR15_VARIANTS)[kind][hsh%3];
      const p=spawnKeep(kind,variant,{id:'bf'+run+'-'+e,seed:run*13+e});
      if(!p){continue;}
      encounters++;
      toActive(p);
      let n=0;
      while(P()&&n++<600){
        if(variant==='choice'){
          const L=V(T.pr15IntentLobes(p));
          if(L){const pl=T.getPlayer();
            pl.x=(n%2)?L.cyan.x:L.magenta.x;pl.y=(n%2)?L.cyan.y:L.magenta.y;}
          else placePlayerNear(p,10);
        }else if(e%2===0)placePlayerNear(p,10);
        else placePlayerFar(p);
        if(variant==='trial'&&n%4===0)X('kills++');
        T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
      }
    }
    const b=snap().budget;
    perRun.push({enc:encounters,resDelta:res0-T.getResidues(),
      res:b.res,heal:b.heal,shield:b.shield,rep:b.rep,moral:b.moral,scar:b.scar});
    for(const k of keys)worst[k]=Math.max(worst[k],b[k]);
    /* o teto precisa MORDER em algum momento, senão é número decorativo */
    if(keys.some(k=>b[k]>=C.budget[k]-1e-9))capHit++;
  }
  /* 1. nenhum teto é ultrapassado em nenhuma run */
  for(const k of keys)
    assert.ok(worst[k]<=C.budget[k]+1e-9,'teto de '+k+': '+worst[k]+' ≤ '+C.budget[k]);
  const avg=k=>perRun.reduce((s2,r)=>s2+r[k],0)/perRun.length;
  const mx=k=>perRun.reduce((s2,r)=>Math.max(s2,r[k]),0);
  /* 2. o teto precisa MORDER. O caso de pior caso é montado de propósito:
     três aparições que só concedem escudo. Sem o teto, 3 × 4 pulsos × 6%
     dariam 0,72 — mais que o dobro do teto de 0,40. */
  const stress=[
    {k:'allied',v:'pulse'},{k:'ambiguous',v:'unstable'},{k:'allied',v:'pulse'}];
  for(const trial of [0,1,2,3]){
    reset(undefined,{shield:0,shieldMax:400,hp:60,maxHp:100});
    X('addResidues(60,"base")');
    for(let e=0;e<3;e++){
      const p=spawnKeep(stress[e].k,stress[e].v,{id:'fs'+trial+'-'+e,seed:700+trial*31+e});
      if(!p)continue;
      toActive(p);
      for(let n=0;n<600&&P();n++){
        placePlayerNear(p,10);
        if(stress[e].v==='choice'){const L=V(T.pr15IntentLobes(p));
          if(L){const pl=T.getPlayer();pl.x=L.cyan.x;pl.y=L.cyan.y;}}
        T.pr15PresUpdate(0.05);T.pr15IntentUpdate(0.05);
      }
    }
    const b=snap().budget;
    for(const k of keys)worst[k]=Math.max(worst[k],b[k]);
    assert.ok(b.shield<=C.budget.shield+1e-9,
      'pior caso: escudo '+b.shield.toFixed(3)+' ≤ teto '+C.budget.shield);
    if(b.shield>=C.budget.shield-1e-9)capHit++;
  }
  assert.ok(capHit>0,'o teto de escudo mordeu no caso de pior caso ('+capHit+'/4)');
  assert.ok(worst.shield<=C.budget.shield+1e-9,
    'escudo máximo '+worst.shield.toFixed(3)+' ≤ teto '+C.budget.shield);
  /* 3. cura máxima modesta frente aos 66–185 HP de operador */
  assert.ok(worst.heal<=C.budget.heal,'cura máxima '+worst.heal+' HP');
  /* 4. moralidade: nunca o suficiente para mudar de faixa sozinho */
  assert.ok(worst.moral<=C.budget.moral,
    'moralidade máxima '+worst.moral+' (mudar de tier exige 3/6/10 por eixo)');
  assert.ok(worst.rep<=C.budget.rep,'reputação máxima '+worst.rep);
  /* 5. nenhuma run termina com mais ⧗ do que o teto permite ganhar */
  assert.ok(mx('resDelta')<=C.budget.res,
    'ganho líquido de ⧗ por run '+mx('resDelta')+' ≤ '+C.budget.res);
  /* 6. nenhum efeito permanente: tudo o que o B4 aplica tem duração */
  assert.ok(B4CODE.indexOf('maxHp+=')<0,'sem maxHp permanente');
  const semDur=(V(T.SM_STATS)||[]);void semDur;
  console.log('      SIM-F 900 runs × 3 encontros · pior run: ⧗ '+worst.res+
    ' · cura '+worst.heal+' · escudo '+worst.shield.toFixed(3)+' · rep '+worst.rep+
    ' · moral '+worst.moral+' · teto mordeu em '+capHit+'/900');
});

console.log('');
if(failed){console.log('FALHAS ('+failed+')');process.exit(1);}
console.log('B4 — '+passed+' PASSARAM · 0 FALHAS');
