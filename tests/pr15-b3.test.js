'use strict';
/* =====================================================================
   TESTES — PR15 · B3 · PRESENÇA TEMPORAL FÍSICA
   ---------------------------------------------------------------------
   Cobre as 75 áreas do brief §30 (ordem literal) + as 5 simulações do
   §31. Mapa 1:1 área → teste:

     1 módulo/boot          → B3-01    39 relationship não aplicado → B3-39
     2 baseline B2 intacto  → B3-02    40 Dissonance não aplicado   → B3-40
     3 consumed materializa → B3-03    41 equipment não aplicado    → B3-41
     4 scheduled não        → B3-04    42 shield aliado não         → B3-42
     5 skipped não          → B3-05    43 trail aliada não          → B3-43
     6 memoryId N-1         → B3-06    44 renderer dedicado         → B3-44
     7 memoryId N-2         → B3-07    45 update dedicado           → B3-45
     8 memoryId inexistente → B3-08    46 resonance high visual     → B3-46
     9 v2 legado não vira   → B3-09    47 resonance normal visual   → B3-47
    10 uma ativa por vez    → B3-10    48 resonance unstable visual → B3-48
    11 não duplica na onda  → B3-11    49 N-1 visual                → B3-49
    12 não duplica Continue → B3-12    50 N-2 visual                → B3-50
    13 encounterId liga B2  → B3-13    51 afterimage cap            → B3-51
    14 source preservado    → B3-14    52 particle cap              → B3-52
    15 resonance preservada → B3-15    53 save durante spawning     → B3-53
    16 seed preservada      → B3-16    54 save durante active       → B3-54
    17 intentSeed preservado→ B3-17    55 save durante leaving      → B3-55
    18 posição determinística→B3-18    56 Continue restaura         → B3-56
    19 posição na arena     → B3-19    57 Continue não reinicia TTL → B3-57
    20 distância mínima     → B3-20    58 Continue não duplica      → B3-58
    21 fallback de posição  → B3-21    59 old save sem B3           → B3-59
    22 fase spawning        → B3-22    60 save parcial B3           → B3-60
    23 fase active          → B3-23    61 sanitize evita NaN        → B3-61
    24 fase leaving         → B3-24    62 slot isolation            → B3-62
    25 fase done/cleanup    → B3-25    63 Sandbox isolation         → B3-63
    26 TTL respeitado       → B3-26    64 DEV release-inert         → B3-64
    27 entrada duração      → B3-27    65 DEV force taints          → B3-65
    28 saída duração        → B3-28    66 nova run limpa            → B3-66
    29 cleanup remove       → B3-29    67 morte limpa               → B3-67
    30 cleanup ≠ echoQueue  → B3-30    68 vitória limpa             → B3-68
    31 sem dano ao player   → B3-31    69 abort limpa               → B3-69
    32 sem dano aos inimigos→ B3-32    70 stress cleanup            → B3-70
    33 sem projéteis        → B3-33    71 scheduler B2 intacto      → B3-71
    34 sem target acquisition→B3-34    72 nenhuma lógica B4         → B3-72
    35 sem colisão bloqueadora→B3-35   73 sem ALIADA/RIVAL/AMBÍGUA  → B3-73
    36 inimigos não targetam→ B3-36    74 sem moralidade/facções    → B3-74
    37 player não targeta   → B3-37    75 Echos legados normais     → B3-75
    38 Echo aliado ≠ entidade→B3-38

   SIMULAÇÕES §31: A ciclo de vida · B posicionamento · C Continue ·
   D stress · E regressão dos Echos aliados.

   NOTA DE REALM — o jogo roda num contexto `vm`. Objetos criados lá
   dentro pertencem a outro realm e `deepStrictEqual` compara protótipos;
   por isso toda leitura que sai do sandbox passa por `V()`.
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
    if(e&&e.stack&&process.env.PR15B3_DEBUG)console.log(e.stack);}
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
const B3SRC=block('PR15·b3 — PRESENÇA TEMPORAL','/* ==================== PR15·fim b3 ==================== */');
const B3CODE=stripComments(B3SRC);
const B2SRC=block('PR15·b2 — DIRECTOR','/* ==================== PR15·fim b2 ==================== */');
const B2CODE=stripComments(B2SRC);
const C=T.PR15_PRES_CFG,TOTAL=T.PR15_PRES_TOTAL;
const V=o=>JSON.parse(JSON.stringify(o));
const fin=v=>typeof v==='number'&&Number.isFinite(v);

/* ---------------- fábricas / cenário ---------------- */
function mem(id,over){
  const r={id:String(id),out:'death',cause:'enemy',op:'vector',theme:'cinza',seed:99991,
    arch:{dom:'crit',sec:null,state:'definido',domS:.5,secS:null},sigW:'pistol',
    sigItems:['mod_a','mod_b'],moral:{comp:1,greed:2,viol:3},dom:'neutro',
    kills:60,wave:6,dur:300,mh:120,level:4,items:[],upg:[],owned:[0],ps:'aggressive',
    trail:[[0,100,200,1,0,0],[.25,101,201,1,0,0],[.5,102,202,1,0,0]]};
  if(over)for(const k in over)r[k]=over[k];return r;
}
function fileV2(n,over){
  const r={v:2,dur:200,dmgMul:1,frMul:1,wave:6,level:5,trail:[],crit:.1,critMul:1.9,
    pierce:1,aoeMul:1,rangeMul:1,meleeRangeMul:1,rangedRangeMul:1,projSpdMul:1,
    longRangeBonus:0,coins:120,items:[],upg:[],owned:[0,1],moral:{comp:4,greed:2,viol:6},
    dom:'viol',k:40,mh:110,st:{s:400},ps:null};
  for(let i=0;i<30;i++)r.trail.push([i*.25,100+i,200+i,1,0,0]);
  r.tag='L'+n;if(over)for(const k in over)r[k]=over[k];return r;
}
function stdQueue(){return [mem('e1-2',{theme:'cinza'}),mem('e1-1',{theme:'sangue',op:'wraith'})];}
function reset(q){
  T.setSandboxRun(false);T.setDevTainted(false);X('DEV_MODE=false');
  T.setEchoQueue(q===undefined?stdQueue():(q||[]));
  T.setEnemies([]);T.setBoss(null);T.setMiniBossRef(null);
  T.setBeacon(null);T.setFactionPresenceEntity(null);T.setEchoes([]);
  T.setSmRestoring(false);
  T.setPlayer({x:1100,y:725,r:14,hp:100,maxHp:100,vx:0,vy:0,shield:0,shieldMax:0});
  T.pr15PresReset();
  T.setPr15MemRun(null);
}
function enc(o){
  o=o||{};
  return {v:1,id:o.id||'p1-t-w4',mem:o.mem||'e1-2',src:o.src||'n1',
    wave:o.wave||4,base:o.wave||4,shift:0,res:o.res||'high',seed:o.seed||123456,
    st:o.st||'consumed',at:o.at!==undefined?o.at:(o.wave||4),why:'',
    intent:o.intent!==undefined?o.intent:4242};
}
const P=()=>T.getPr15Presence();
const snap=()=>V(T.pr15PresSnapshot());
/* avança o relógio da presença até `target` segundos de idade */
function advanceTo(target,dt){
  let g=0;
  while(P()&&P().age<target&&g++<20000)T.pr15PresUpdate(dt||0.05);
  return P();
}
function runFull(dt){
  let g=0;
  while(P()&&g++<20000)T.pr15PresUpdate(dt||0.05);
  return g;
}
/* instala um estado do Director B2 com os descriptors dados */
function memState(encs,waveDone){
  T.setPr15MemRun({v:1,key:'s1:1',slot:1,seed:1,enc:encs,used:[],
    waveDone:waveDone|0,lastWave:waveDone|0,count:0});
}

console.log('\nECHO — PR15·B3 · PRESENÇA TEMPORAL FÍSICA');
console.log('-----------------------------------------');
T.unlockAll();

/* ============ 1. MÓDULO / BOOT ============ */
ok('B3-01: o módulo existe — bloco PR15·b3, config centralizada, boot após o B2 e suíte no runner',()=>{
  assert.ok(B3SRC.indexOf('PR15_PRES_CFG')>0,'PR15_PRES_CFG definido no bloco');
  for(const fn of ['pr15PresSpawn','pr15PresUpdate','pr15PresDraw','pr15PresEnd',
    'pr15PresOnWave','pr15PresPack','pr15PresUnpack','pr15PresRebuild','pr15PresSnapshot',
    'pr15PresPos','pr15PresVisualState','pr15PresenceKitBoot','pr15PresReset','pr15PresLeave'])
    assert.strictEqual(typeof T[fn],'function',fn+' ausente');
  const i2=SRCN.indexOf('pr15MemoryKitBoot();');
  const i3=SRCN.indexOf('pr15PresenceKitBoot();');
  assert.ok(i2>0&&i3>i2,'pr15PresenceKitBoot() vem depois de pr15MemoryKitBoot()');
  /* durações dentro das faixas do brief §5 */
  assert.ok(C.entryTime>=0.8&&C.entryTime<=1.2,'entryTime em 0,8–1,2s');
  assert.ok(C.activeTime>=20&&C.activeTime<=30,'activeTime em 20–30s');
  assert.ok(C.exitTime>=0.8&&C.exitTime<=1.5,'exitTime em 0,8–1,5s');
  assert.strictEqual(TOTAL,C.entryTime+C.activeTime+C.exitTime,'total derivado');
  /* números centralizados: não espalhados fora do bloco */
  const fora=stripComments(SRCN.slice(0,SRCN.indexOf('PR15_PRES_CFG=')))+
             stripComments(SRCN.slice(SRCN.indexOf('/* ==================== PR15·fim b3')));
  assert.ok(!/entryTime\s*:/.test(fora),'entryTime não duplicado fora do bloco');
  assert.ok(!/minPlayerDist\s*:/.test(fora),'minPlayerDist não duplicado fora do bloco');
  assert.ok(runnerInstalled(),'npm test usa o runner consolidado');
  assert.ok(suiteIsDiscovered('pr15-b3'),'pr15-b3.test.js é descoberta pelo runner');
});

/* ============ 2. BASELINE B1/B2 INTACTO ============ */
ok('B3-02: baseline B1/B2 intacto — nenhum símbolo do Director foi alterado pelo B3',()=>{
  for(const fn of ['pr15MemOnWave','pr15MemBuildPlan','pr15MemBeginRun','pr15MemPack',
    'pr15MemUnpack','pr15MemSnapshot','pr15MemMakeEncounter','pr15MemSanEnc'])
    assert.strictEqual(typeof T[fn],'function',fn+' ainda existe');
  const cfg=V(T.PR15_MEM_CFG);
  assert.strictEqual(cfg.firstWave,4);assert.strictEqual(cfg.cooldownWaves,3);
  assert.strictEqual(cfg.maxEncounters,3);assert.strictEqual(cfg.conflictShiftMax,2);
  /* o B3 não redefine nenhuma função do B2 */
  for(const fn of ['pr15MemOnWave','pr15MemBuildPlan','pr15MemPickSource','pr15MemResonance'])
    assert.ok(B3CODE.indexOf('function '+fn)<0,'B3 não redefine '+fn);
  /* o bloco B2 continua sem qualquer referência a entidade física */
  assert.ok(B2CODE.indexOf('pr15Presence')<0,'bloco B2 não referencia a presença');
  /* B1 preservado */
  for(const fn of ['pr15SanitizeRecord','pr15BuildSignature','pr15RunIsValid'])
    assert.strictEqual(typeof T[fn],'function',fn+' (B1) ainda existe');
});

/* ============ 3–5. STATUS DO DESCRIPTOR ============ */
ok('B3-03: descriptor consumed NESTA onda gera presença física',()=>{
  reset();
  memState([enc({id:'c1',wave:4,at:4,st:'consumed'})],3);
  const r=T.pr15PresOnWave(4);
  assert.ok(r,'materializou');
  assert.ok(P(),'entidade existe');
  assert.strictEqual(P().encounterId,'c1');
  assert.strictEqual(snap().active,true);
});
ok('B3-04: descriptor scheduled NÃO gera presença',()=>{
  reset();
  memState([enc({id:'s1',wave:4,at:0,st:'scheduled'})],3);
  assert.strictEqual(T.pr15PresOnWave(4),null,'nada materializado');
  assert.strictEqual(P(),null,'nenhuma entidade');
});
ok('B3-05: descriptor skipped NÃO gera presença',()=>{
  reset();
  memState([enc({id:'k1',wave:4,at:4,st:'skipped'})],3);
  assert.strictEqual(T.pr15PresOnWave(4),null,'nada materializado');
  assert.strictEqual(P(),null,'nenhuma entidade');
});

/* ============ 6–9. RESOLUÇÃO DO memoryId ============ */
ok('B3-06: memoryId resolve a memória N-1 (echoQueue[0])',()=>{
  reset();
  const r=T.pr15PresResolveMemory('e1-2');
  assert.ok(r,'resolveu');assert.strictEqual(r.source,'n1');assert.strictEqual(r.idx,0);
  T.pr15PresSpawn(enc({mem:'e1-2',src:'n1'}),null);
  assert.strictEqual(P().memoryId,'e1-2');
  assert.strictEqual(snap().memory.op,'vector','lê o operador da memória N-1');
});
ok('B3-07: memoryId resolve a memória N-2 (echoQueue[1])',()=>{
  reset();
  const r=T.pr15PresResolveMemory('e1-1');
  assert.ok(r,'resolveu');assert.strictEqual(r.source,'n2');assert.strictEqual(r.idx,1);
  T.pr15PresSpawn(enc({mem:'e1-1',src:'n2'}),null);
  assert.strictEqual(P().memoryId,'e1-1');
  assert.strictEqual(snap().memory.op,'wraith','lê o operador da memória N-2');
});
ok('B3-08: memoryId inexistente falha de forma SEGURA (sem entidade, sem quebrar a run)',()=>{
  reset();
  for(const bad of ['nao-existe','',null,undefined,42,{},[]]){
    assert.strictEqual(T.pr15PresResolveMemory(bad),null,'não resolve '+JSON.stringify(bad));
    const d=enc({id:'bad'});d.mem=bad;            /* atribuição direta: o helper trata falsy */
    assert.strictEqual(T.pr15PresSpawn(d,null),null,'não spawna '+JSON.stringify(bad));
    assert.strictEqual(P(),null,'nenhuma entidade quebrada');
  }
  /* histórico intacto e run utilizável */
  assert.strictEqual(V(T.getEchoQueue()).length,2,'echoQueue preservada');
  assert.ok(T.pr15PresSpawn(enc({mem:'e1-2'}),null),'a run continua funcional depois da falha');
});
ok('B3-09: memória v2 legada (sem id v3) nunca vira presença B3',()=>{
  reset([fileV2(1),fileV2(2)]);
  assert.strictEqual(T.pr15PresResolveMemory('e1-2'),null,'v2 não resolve');
  memState([enc({id:'v2a',mem:'e1-2',wave:4,at:4})],3);
  assert.strictEqual(T.pr15PresOnWave(4),null,'nenhuma materialização');
  assert.strictEqual(P(),null);
  /* mas o Echo legado continua funcionando normalmente */
  const e=T.makeEcho(V(T.getEchoQueue())[0],1);
  assert.ok(e&&e.alive,'makeEcho legado continua funcionando');
});

/* ============ 10–12. CAP E IDEMPOTÊNCIA ============ */
ok('B3-10: no máximo UMA presença física ativa por vez',()=>{
  reset();
  assert.ok(T.pr15PresSpawn(enc({id:'a1',mem:'e1-2'}),null),'1ª materializa');
  assert.strictEqual(T.pr15PresSpawn(enc({id:'a2',mem:'e1-1'}),null),null,'2ª é recusada');
  assert.strictEqual(P().encounterId,'a1','a 1ª permanece intacta');
  /* mesmo via onda, com outro descriptor consumido */
  memState([enc({id:'a3',wave:5,at:5,st:'consumed'})],4);
  assert.strictEqual(T.pr15PresOnWave(5),null,'skip determinístico: nada de fila, nada de duplicata');
  assert.strictEqual(P().encounterId,'a1');
  /* o descriptor do B2 NÃO é alterado pelo skip */
  const st=V(T.getPr15MemRun());
  assert.strictEqual(st.enc[0].st,'consumed','descriptor continua consumed');
  assert.strictEqual(st.enc[0].at,5,'descriptor intocado');
});
ok('B3-11: reprocessar a MESMA onda não spawna duas entidades',()=>{
  reset();
  memState([enc({id:'w1',wave:4,at:4,st:'consumed'})],3);
  assert.ok(T.pr15PresOnWave(4),'1ª chamada materializa');
  const id=P().encounterId,x=P().x,y=P().y;
  for(let i=0;i<5;i++)assert.strictEqual(T.pr15PresOnWave(4),null,'reprocesso '+i+' não duplica');
  assert.strictEqual(P().encounterId,id);
  assert.strictEqual(P().x,x);assert.strictEqual(P().y,y);
  /* mesmo depois de terminar, a onda não ressuscita a presença */
  runFull();
  assert.strictEqual(P(),null,'ciclo terminou');
  assert.strictEqual(T.pr15PresOnWave(4),null,'onda reprocessada após o fim não ressuscita');
  assert.strictEqual(T.pr15PresStatusOf('w1'),'done');
});
ok('B3-12: Continue não spawna duplicado',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'d1'}),null);
  advanceTo(6);
  const cp={pr15presence:V(T.pr15PresPack())};
  T.pr15PresUnpack(cp);
  assert.strictEqual(P(),null,'unpack limpa o corpo antes de reconstruir');
  assert.ok(T.pr15PresRebuild(),'reconstruiu 1 vez');
  assert.strictEqual(T.pr15PresRebuild(),null,'2ª reconstrução recusada');
  assert.strictEqual(T.pr15PresStatusOf('d1'),'active');
  /* onda reprocessada após o Continue também não duplica */
  memState([enc({id:'d1',wave:4,at:4,st:'consumed'})],3);
  assert.strictEqual(T.pr15PresOnWave(4),null,'onda não duplica após Continue');
});

/* ============ 13–17. CONTRATO COM O DESCRIPTOR B2 ============ */
ok('B3-13: encounterId liga a presença exatamente ao descriptor do B2',()=>{
  reset();
  const e=enc({id:'p1-zz9-w7',wave:7,at:7});
  memState([e],6);
  T.pr15PresOnWave(7);
  assert.strictEqual(P().encounterId,'p1-zz9-w7','id idêntico ao do descriptor');
  assert.strictEqual(snap().wave,7,'onda do descriptor preservada');
  assert.strictEqual(T.pr15PresStatusOf('p1-zz9-w7'),'active');
  assert.strictEqual(T.pr15PresStatusOf('outro'),'pending');
});
ok('B3-14: source vem do descriptor e NUNCA é re-derivado',()=>{
  reset();
  for(const s of ['n1','n2']){
    T.pr15PresReset();
    T.pr15PresSpawn(enc({id:'s-'+s,src:s,mem:'e1-2'}),null);
    assert.strictEqual(P().source,s,'source '+s+' preservado');
  }
  /* source inválido cai em n1 sem inventar decisão nova */
  T.pr15PresReset();
  T.pr15PresSpawn(enc({id:'sx',src:'zzz'}),null);
  assert.strictEqual(P().source,'n1','source inválido → n1 seguro');
  /* o B3 não contém nenhuma re-derivação de origem */
  assert.ok(B3CODE.indexOf('pr15MemPickSource')<0,'B3 não escolhe origem');
});
ok('B3-15: resonance vem do descriptor e NUNCA é recalculada',()=>{
  reset();
  for(const r of ['high','normal','unstable']){
    T.pr15PresReset();
    T.pr15PresSpawn(enc({id:'r-'+r,res:r}),null);
    assert.strictEqual(P().resonance,r,'resonance '+r+' preservada');
  }
  T.pr15PresReset();
  T.pr15PresSpawn(enc({id:'rx',res:'lendaria'}),null);
  assert.strictEqual(P().resonance,'normal','resonance inválida → normal seguro');
  assert.ok(B3CODE.indexOf('pr15MemResonance')<0,'B3 não recalcula ressonância');
});
ok('B3-16: seed vem do descriptor e NUNCA é re-rolada',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'sd',seed:987654321}),null);
  assert.strictEqual(P().seed,987654321>>>0,'seed preservada');
  /* nenhum Math.random no bloco inteiro (§7) */
  assert.ok(!/Math\.random/.test(B3CODE),'B3 nunca chama Math.random');
  assert.ok(!/\brand\s*\(/.test(B3CODE),'B3 nunca usa rand() global');
  /* a posição deriva da seed do descriptor via RNG determinístico */
  assert.ok(/fractureRng/.test(B3CODE),'usa o RNG determinístico do projeto');
});
ok('B3-17: intentSeed é preservado e exposto, sem NENHUMA semântica (§26)',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'it',intent:31337}),null);
  assert.strictEqual(P().intentSeed,31337,'intentSeed preservado');
  assert.strictEqual(snap().intentSeed,31337,'exposto no snapshot para o B4');
  /* sobrevive ao Continue */
  const cp={pr15presence:V(T.pr15PresPack())};
  T.pr15PresUnpack(cp);T.pr15PresRebuild();
  assert.strictEqual(P().intentSeed,31337,'intentSeed sobrevive ao Continue');
  /* nenhuma tradução do intentSeed em faixas/comportamento */
  assert.ok(!/intentSeed\s*[<>]/.test(B3CODE),'sem comparação de faixa do intentSeed');
  assert.ok(!/intent\s*%\s*3/.test(B3CODE),'sem partição do intentSeed em 3 intenções');
});

/* ============ 18–21. POSICIONAMENTO ============ */
ok('B3-18: a posição é determinística (mesma seed + mesmo mundo ⇒ mesmo ponto)',()=>{
  reset();
  for(const sd of [1,7,4242,987654321,0xFFFFFFFF]){
    const a=T.pr15PresPos(sd,1100,725),b=T.pr15PresPos(sd,1100,725);
    assert.strictEqual(a.x,b.x,'x determinístico seed='+sd);
    assert.strictEqual(a.y,b.y,'y determinístico seed='+sd);
  }
  /* seeds distintas produzem pontos distintos (não é constante) */
  const pts=new Set();
  for(let s=1;s<=40;s++){const p=T.pr15PresPos(s*7919,1100,725);pts.add(Math.round(p.x)+','+Math.round(p.y));}
  assert.ok(pts.size>=20,'variedade de posições: '+pts.size+'/40');
  /* spawn completo também é determinístico */
  T.pr15PresReset();T.pr15PresSpawn(enc({id:'q1',seed:555}),null);
  const p1={x:P().x,y:P().y};
  T.pr15PresReset();T.pr15PresSpawn(enc({id:'q1',seed:555}),null);
  assert.strictEqual(P().x,p1.x);assert.strictEqual(P().y,p1.y);
});
ok('B3-19: a posição está sempre DENTRO da arena (com margem)',()=>{
  reset();
  const M=C.margin,W=T.ARENA.w,H=T.ARENA.h;
  for(let s=1;s<=400;s++){
    for(const pp of [[1100,725],[0,0],[W,H],[-500,-500],[W+900,H+900],[M,M]]){
      const p=T.pr15PresPos((s*2654435761)>>>0,pp[0],pp[1]);
      assert.ok(fin(p.x)&&fin(p.y),'posição finita');
      assert.ok(p.x>=M-1e-9&&p.x<=W-M+1e-9,'x dentro: '+p.x);
      assert.ok(p.y>=M-1e-9&&p.y<=H-M+1e-9,'y dentro: '+p.y);
    }
  }
});
ok('B3-20: a posição respeita a distância mínima do operador e evita ocupações',()=>{
  reset();
  let worst=1e9;
  for(let s=1;s<=600;s++){
    const p=T.pr15PresPos((s*40503)>>>0,1100,725);
    const d=Math.hypot(p.x-1100,p.y-725);
    if(d<worst)worst=d;
  }
  assert.ok(worst>=C.minPlayerDist-1e-6,'distância mínima respeitada: '+worst.toFixed(1));
  assert.ok(C.minPlayerDist>=220&&C.minPlayerDist<=300,'minPlayerDist na faixa do brief');
  /* e nunca nasce em cima de inimigo/boss/mini/beacon/presença/hazard */
  T.setEnemies([{x:800,y:600,r:18,dead:false}]);
  assert.strictEqual(T.pr15PresSpotBlocked(800,600),true,'inimigo bloqueia');
  T.setEnemies([]);
  T.setBoss({x:800,y:600,dead:false});
  assert.strictEqual(T.pr15PresSpotBlocked(810,610),true,'boss bloqueia');
  T.setBoss(null);
  T.setMiniBossRef({x:700,y:500,dead:false,hazards:[{x:1500,y:900,r:80}]});
  assert.strictEqual(T.pr15PresSpotBlocked(700,500),true,'mini-chefe bloqueia');
  assert.strictEqual(T.pr15PresSpotBlocked(1500,900),true,'hazard bloqueia');
  T.setMiniBossRef(null);
  T.setBeacon({x:600,y:400,r:36});
  assert.strictEqual(T.pr15PresSpotBlocked(600,400),true,'beacon bloqueia');
  T.setBeacon(null);
  T.setFactionPresenceEntity({x:900,y:300,r:30});
  assert.strictEqual(T.pr15PresSpotBlocked(900,300),true,'presença de facção bloqueia');
  T.setFactionPresenceEntity(null);
  assert.strictEqual(T.pr15PresSpotBlocked(900,300),false,'ponto livre não bloqueia');
});
ok('B3-21: fallback de posição — arena saturada nunca produz ponto inválido',()=>{
  reset();
  const wall=[];
  for(let x=0;x<T.ARENA.w;x+=80)for(let y=0;y<T.ARENA.h;y+=80)wall.push({x:x,y:y,r:20,dead:false});
  T.setEnemies(wall);
  const M=C.margin;
  for(let s=1;s<=150;s++){
    const p=T.pr15PresPos((s*97)>>>0,1100,725);
    assert.strictEqual(p.fb,1,'fallback sinalizado');
    assert.ok(fin(p.x)&&fin(p.y),'fallback finito');
    assert.ok(p.x>=M-1e-9&&p.x<=T.ARENA.w-M+1e-9,'fallback x dentro');
    assert.ok(p.y>=M-1e-9&&p.y<=T.ARENA.h-M+1e-9,'fallback y dentro');
  }
  /* o spawn ainda ocorre e é marcado como fallback */
  T.pr15PresReset();
  assert.ok(T.pr15PresSpawn(enc({id:'fb1'}),null),'materializa mesmo saturado');
  assert.strictEqual(snap().fallback,1,'fallback registrado no snapshot');
  T.setEnemies([]);
  /* sem player o fallback também é seguro */
  T.setPlayer(null);
  const np=T.pr15PresPos(4242,NaN,NaN);
  assert.ok(fin(np.x)&&fin(np.y),'posição sem player é finita');
});

/* ============ 22–28. CICLO DE VIDA ============ */
ok('B3-22: fase SPAWNING — materialização com alpha/escala crescentes',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'ph1'}),null);
  assert.strictEqual(P().phase,'spawning');
  assert.strictEqual(P().entered,false,'ainda não entrou');
  assert.ok(P().alpha<1,'alpha parcial no início: '+P().alpha);
  const a0=P().alpha;
  advanceTo(C.entryTime*0.75);
  assert.strictEqual(P().phase,'spawning','ainda entrando');
  assert.ok(P().alpha>a0,'alpha cresce durante a entrada');
  assert.ok(P().scale<=1,'escala cresce até 1');
});
ok('B3-23: fase ACTIVE — presença plena e estável',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'ph2'}),null);
  advanceTo(C.entryTime+0.05);
  assert.strictEqual(P().phase,'active');
  assert.strictEqual(P().entered,true,'marcou entrada concluída');
  assert.strictEqual(P().leaving,false,'ainda não está saindo');
  assert.strictEqual(P().alpha,1,'alpha pleno');
  assert.strictEqual(P().scale,1,'escala plena');
  advanceTo(C.entryTime+C.activeTime-0.1);
  assert.strictEqual(P().phase,'active','continua ativa até o fim da janela');
});
ok('B3-24: fase LEAVING — desmaterialização com alpha decrescente',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'ph3'}),null);
  advanceTo(C.entryTime+C.activeTime+0.05);
  assert.strictEqual(P().phase,'leaving');
  assert.strictEqual(P().leaving,true);
  const a0=P().alpha;
  advanceTo(C.entryTime+C.activeTime+C.exitTime*0.8);
  assert.ok(P().alpha<a0,'alpha decresce na saída');
  /* saída antecipada NÃO teleporta para done: a duração de saída é íntegra */
  T.pr15PresReset();
  T.pr15PresSpawn(enc({id:'ph3b'}),null);
  advanceTo(4);
  assert.strictEqual(T.pr15PresLeave('teste'),true,'saída antecipada aceita');
  assert.strictEqual(P().phase,'leaving');
  assert.ok(P().ttl>0&&P().ttl<=C.exitTime+1e-6,'resta exatamente a duração de saída: '+P().ttl);
  assert.strictEqual(T.pr15PresLeave('again'),false,'saída antecipada é idempotente');
});
ok('B3-25: fase DONE — cleanup automático ao fim do ciclo',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'ph4'}),null);
  runFull();
  assert.strictEqual(P(),null,'entidade removida');
  assert.strictEqual(snap().active,false,'snapshot informa inativa');
  assert.strictEqual(T.pr15PresStatusOf('ph4'),'done','estado registrado como concluído');
});
ok('B3-26: TTL respeitado — a presença nunca é permanente',()=>{
  reset();
  for(const dt of [0.008,0.016,0.05,0.1,0.25]){
    T.pr15PresReset();
    T.pr15PresSpawn(enc({id:'ttl-'+dt}),null);
    assert.ok(Math.abs(P().ttl-TOTAL)<1e-9,'TTL inicial = total');
    let t=0,g=0;
    while(P()&&g++<20000){T.pr15PresUpdate(dt);t+=dt;}
    assert.ok(t>=TOTAL-1e-6&&t<=TOTAL+dt+1e-6,'ciclo dura ~'+TOTAL+'s com dt='+dt+' (real '+t.toFixed(2)+')');
    assert.strictEqual(P(),null,'sempre termina');
  }
  /* dt absurdo/negativo/NaN não quebra o ciclo */
  T.pr15PresReset();T.pr15PresSpawn(enc({id:'ttlx'}),null);
  for(const bad of [NaN,-5,Infinity,'x',null,undefined])T.pr15PresUpdate(bad);
  assert.ok(P(),'dt inválido não destrói a entidade');
  assert.ok(fin(P().age)&&P().age>=0,'idade permanece finita: '+P().age);
});
ok('B3-27: a ENTRADA respeita exatamente a duração configurada',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'en1'}),null);
  const dt=0.01;let t=0,g=0;
  while(P()&&P().phase==='spawning'&&g++<20000){T.pr15PresUpdate(dt);t+=dt;}
  assert.ok(Math.abs(t-C.entryTime)<=dt+1e-6,'entrada durou ~'+C.entryTime+'s (real '+t.toFixed(3)+')');
  assert.strictEqual(P().phase,'active','vai direto para active');
});
ok('B3-28: a SAÍDA respeita exatamente a duração configurada',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'ex1'}),null);
  advanceTo(C.entryTime+C.activeTime+1e-9,0.01);
  assert.strictEqual(P().phase,'leaving','entrou na saída');
  const dt=0.01;let t=0,g=0;
  while(P()&&g++<20000){T.pr15PresUpdate(dt);t+=dt;}
  assert.ok(Math.abs(t-C.exitTime)<=dt*2+0.02,'saída durou ~'+C.exitTime+'s (real '+t.toFixed(3)+')');
});

/* ============ 29–30. CLEANUP ============ */
ok('B3-29: cleanup remove a entidade e zera referências (sem timers órfãos)',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'cl1'}),null);
  advanceTo(5);
  assert.ok(Array.isArray(P().ghosts)&&P().ghosts.length>0,'havia afterimages');
  assert.strictEqual(T.pr15PresEnd('teste'),true,'cleanup executado');
  assert.strictEqual(P(),null,'entidade removida');
  assert.strictEqual(T.pr15PresEnd('teste'),false,'cleanup é idempotente');
  /* o bloco não cria timers nem listeners que pudessem vazar */
  assert.ok(!/setTimeout|setInterval|requestAnimationFrame|addEventListener/.test(B3CODE),
    'B3 não cria timers/listeners órfãos');
});
ok('B3-30: cleanup NUNCA toca echoQueue nem o histórico',()=>{
  reset();
  const antes=JSON.stringify(V(T.getEchoQueue()));
  T.pr15PresSpawn(enc({id:'cl2'}),null);
  runFull();
  T.pr15PresReset();
  assert.strictEqual(JSON.stringify(V(T.getEchoQueue())),antes,'echoQueue idêntica');
  /* nem por escrita direta no bloco */
  assert.ok(!/echoQueue\s*=[^=]/.test(B3CODE),'B3 nunca atribui echoQueue');
  assert.ok(!/echoQueue\.(splice|push|pop|shift|unshift|sort|reverse)/.test(B3CODE),
    'B3 nunca muta echoQueue');
});

/* ============ 31–37. ZERO COMBATE ============ */
ok('B3-31: a presença não causa dano ao jogador',()=>{
  reset();
  const p=T.getPlayer();
  T.pr15PresSpawn(enc({id:'nd1'}),null);
  const hp0=p.hp;
  for(let i=0;i<400;i++)T.pr15PresUpdate(0.05);
  assert.strictEqual(T.getPlayer().hp,hp0,'HP do jogador inalterado');
  assert.ok(!/damagePlayer|hurtPlayer/.test(B3CODE),'B3 não chama dano ao jogador');
});
ok('B3-32: a presença não causa dano aos inimigos',()=>{
  reset();
  T.setEnemies([{x:1300,y:800,r:16,dead:false,spawnT:0,hp:50,maxHp:50,type:'grunt'}]);
  T.pr15PresSpawn(enc({id:'nd2'}),null);
  for(let i=0;i<400;i++)T.pr15PresUpdate(0.05);
  const en=V(T.getEnemies())[0];
  assert.strictEqual(en.hp,50,'HP do inimigo inalterado');
  assert.strictEqual(en.dead,false,'inimigo continua vivo');
  assert.ok(!/damageEnemy|hurtEnemy|killEnemy/.test(B3CODE),'B3 não chama dano a inimigos');
});
ok('B3-33: a presença nunca cria projéteis',()=>{
  reset();
  T.setProjectiles([]);
  T.pr15PresSpawn(enc({id:'np1'}),null);
  for(let i=0;i<600;i++)T.pr15PresUpdate(0.05);
  assert.strictEqual(V(T.getProjectiles()).length,0,'nenhum projétil criado');
  assert.ok(!/projectiles\.push|fireWeaponFrom|fireMelee|fireBeam/.test(B3CODE),
    'B3 não dispara nada');
});
ok('B3-34: a presença nunca adquire alvo',()=>{
  reset();
  T.setEnemies([{x:1200,y:760,r:16,dead:false,spawnT:0,hp:9,maxHp:9,type:'grunt'}]);
  T.pr15PresSpawn(enc({id:'nt1'}),null);
  advanceTo(6);
  const p=P();
  assert.strictEqual(p.tgtRef,undefined,'sem tgtRef');
  assert.strictEqual(p.target,undefined,'sem target');
  assert.ok(!/nearestEnemy|pickTarget|persFindTarget|acquireTarget/.test(B3CODE),
    'B3 não busca alvo');
});
ok('B3-35: a presença não tem colisão bloqueadora nem intercepta projéteis',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'nc1'}),null);
  advanceTo(4);
  const p=P();
  /* projétil atravessa a área da presença sem qualquer interação */
  T.setProjectiles([{x:p.x-40,y:p.y,vx:600,vy:0,r:4,dmg:10,life:2,type:'plasma',
    team:'player',color:'#fff',aoe:0,pierce:0,crit:false,hits:null,owner:null,
    def:null,dist:0,maxDist:900}]);
  const px0=T.getPlayer().x,py0=T.getPlayer().y;
  for(let i=0;i<20;i++){T.updateProjectiles(0.016);T.pr15PresUpdate(0.016);}
  const pr=V(T.getProjectiles());
  assert.ok(pr.length===0||pr[0].x>p.x,'o projétil não foi interceptado pela presença');
  /* o jogador não é empurrado nem bloqueado */
  assert.strictEqual(T.getPlayer().x,px0,'posição do jogador intocada');
  assert.strictEqual(T.getPlayer().y,py0,'posição do jogador intocada');
  /* a entidade não tem campos de corpo sólido de combate */
  for(const k of ['hp','maxHp','shield','shieldMax','solid','blocking','hitbox','team'])
    assert.strictEqual(P()[k],undefined,'sem campo de combate: '+k);
});
ok('B3-36: inimigos NUNCA miram a presença (ela não está em echoes[])',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'agg1'}),null);
  advanceTo(4);
  const p=P();
  const en={x:p.x+5,y:p.y+5,r:16,dead:false,spawnT:0,hp:9,maxHp:9,type:'grunt'};
  T.setEnemies([en]);
  const tgt=T.pickTarget(en);
  assert.notStrictEqual(tgt,p,'pickTarget nunca devolve a presença');
  assert.ok(tgt===T.getPlayer()||tgt===null,'alvo é o jogador (ou nenhum)');
  /* mesmo com um Echo aliado presente, a presença segue fora da varredura */
  T.setEchoes([T.makeEcho(V(T.getEchoQueue())[0],1)]);
  assert.notStrictEqual(T.pickTarget(en),p,'presença nunca vira alvo');
  const arr=T.getEchoes();
  for(let i=0;i<arr.length;i++)assert.notStrictEqual(arr[i],p,'presença não está em echoes[]');
});
ok('B3-37: o jogador não pode mirar/atingir a presença',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'agg2'}),null);
  advanceTo(4);
  /* a presença não está em enemies[] — logo nenhuma mira do jogador a alcança */
  assert.strictEqual(V(T.getEnemies()).length,0,'presença não entrou em enemies[]');
  assert.ok(!/enemies\.push/.test(B3CODE),'B3 nunca insere em enemies[]');
  assert.ok(!/enemies\s*=[^=]/.test(B3CODE),'B3 nunca atribui enemies');
});

/* ============ 38–43. SEPARAÇÃO DOS ECHOS ALIADOS ============ */
ok('B3-38: a presença não é confundida com um Echo aliado',()=>{
  reset();
  const e1=T.makeEcho(V(T.getEchoQueue())[0],1);
  T.setEchoes([e1]);
  T.pr15PresSpawn(enc({id:'sep1'}),null);
  const p=P();
  assert.strictEqual(V(T.getEchoes()).length,1,'echoes[] continua com 1 Echo');
  assert.notStrictEqual(T.getEchoes()[0],p,'a presença não foi inserida em echoes[]');
  /* estruturas totalmente distintas */
  assert.strictEqual(p.slot,undefined,'presença não tem slot de Echo');
  assert.strictEqual(p.data,undefined,'presença não carrega o snapshot da run');
  assert.ok(p.encounterId&&p.memoryId,'presença tem identidade própria');
  assert.strictEqual(e1.encounterId,undefined,'Echo aliado não tem encounterId');
  /* o B3 nunca chama makeEcho nem escreve em echoes[] */
  assert.ok(!/makeEcho/.test(B3CODE),'B3 não usa makeEcho');
  assert.ok(!/echoes\s*=[^=]|echoes\.push/.test(B3CODE),'B3 não escreve em echoes[]');
});
ok('B3-39: relationship NÃO é aplicado à presença',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'rel1'}),null);
  advanceTo(5);
  assert.strictEqual(P().rel,undefined,'sem estado de relação');
  assert.strictEqual(P().trust,undefined,'sem confiança');
  assert.ok(!/relNewState|relTick|echoRelInit|relPackEcho|trustTier/.test(B3CODE),
    'B3 não usa o sistema de relação');
});
ok('B3-40: Dissonance NÃO é aplicada à presença',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'dis1'}),null);
  advanceTo(5);
  assert.strictEqual(P().dis,undefined,'sem estado de Dissonância');
  assert.strictEqual(P().hostile,undefined,'nunca hostil');
  assert.ok(!/disNewState|disPackEcho|echoRuptureTick|echoHostileTick|DIS_COLOR/.test(B3CODE),
    'B3 não usa o sistema de Dissonância');
});
ok('B3-41: equipment NÃO é aplicado à presença',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'eq1'}),null);
  advanceTo(5);
  assert.strictEqual(P().itemIds,undefined,'sem itens');
  assert.strictEqual(P().ownedW,undefined,'sem arsenal');
  assert.strictEqual(P().curW,undefined,'sem arma ativa');
  assert.ok(!/echoEqInit|echoEqRefresh|grantItemInternal|giveItem/.test(B3CODE),
    'B3 não usa o sistema de equipamento');
  /* sigW é lido só como DETALHE VISUAL, nunca como arma funcional */
  assert.strictEqual(snap().memory.sigW,'pistol','arma assinatura lida como dado visual');
  assert.strictEqual(typeof T.pr15PresSilhouetteWi(P()),'number','vira apenas índice de silhueta');
});
ok('B3-42: escudo aliado NÃO é aplicado à presença',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'sh1'}),null);
  advanceTo(5);
  assert.strictEqual(P().shield,undefined,'sem escudo');
  assert.strictEqual(P().shieldMax,undefined,'sem escudo máximo');
  assert.strictEqual(P().shieldRegen,undefined,'sem regeneração');
  assert.ok(!/regenEchoShield|damageEcho|dissolveEcho|ECHO_SHIELD/.test(B3CODE),
    'B3 não usa o sistema de escudo/dano dos Echos');
});
ok('B3-43: a trail do Echo aliado NÃO é usada pela presença (nada de replay)',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'tr1'}),null);
  advanceTo(5);
  const p=P();
  assert.strictEqual(p.data,undefined,'presença não guarda o registro da run');
  assert.strictEqual(p.trail,undefined,'presença não guarda trail');
  assert.strictEqual(p.pi,undefined,'presença não tem índice de replay');
  assert.ok(!/\.trail\b/.test(B3CODE),'B3 nunca lê a trail (só escalares de apresentação)');
  /* o movimento é próprio, não replay: a posição muda por órbita/suavização */
  const x0=p.x,y0=p.y;
  advanceTo(12);
  assert.ok(Math.abs(P().x-x0)>0.01||Math.abs(P().y-y0)>0.01,
    'a presença se desloca com lógica própria');
});

/* ============ 44–45. RENDERER E UPDATE DEDICADOS ============ */
ok('B3-44: renderer DEDICADO — drawEchoEntity não recebeu ramificações',()=>{
  assert.strictEqual(typeof T.pr15PresDraw,'function','renderer próprio existe');
  const de=SRCN.slice(SRCN.indexOf('function drawEchoEntity'));
  const body=de.slice(0,de.indexOf('\nfunction '));
  assert.ok(body.indexOf('pr15Pres')<0,'drawEchoEntity não menciona a presença');
  /* engatado no draw de mundo por monkey-patch, não por edição */
  assert.ok(/drawWorldExtras\s*=\s*function/.test(B3CODE),'renderer engatado em drawWorldExtras');
  /* desenha em todas as fases, sem depender de DOM/HUD */
  reset();
  T.pr15PresSpawn(enc({id:'dr1'}),null);
  const fases=[];
  for(const alvo of [0.3,5,25.8]){
    advanceTo(alvo);
    if(P()){fases.push(P().phase);assert.strictEqual(T.pr15PresDraw(),true,'desenha na fase '+P().phase);}
  }
  assert.deepStrictEqual(fases,['spawning','active','leaving'],'as três fases desenham');
  T.pr15PresReset();
  assert.strictEqual(T.pr15PresDraw(),false,'sem entidade não desenha');
  assert.ok(!/document\.|getElementById|innerHTML/.test(B3CODE),
    'renderer sem dependência de DOM/HUD');
});
ok('B3-45: update DEDICADO — updateEcho/updateEnemy não foram acoplados',()=>{
  assert.strictEqual(typeof T.pr15PresUpdate,'function','update próprio existe');
  const ue=SRCN.slice(SRCN.indexOf('function updateEcho'));
  assert.ok(ue.slice(0,ue.indexOf('\nfunction ')).indexOf('pr15Pres')<0,
    'updateEcho não menciona a presença');
  const un=SRCN.slice(SRCN.indexOf('function updateEnemy'));
  assert.ok(un.slice(0,un.indexOf('\nfunction ')).indexOf('pr15Pres')<0,
    'updateEnemy não menciona a presença');
  assert.ok(/updateAllies\s*=\s*function/.test(B3CODE),'update engatado em updateAllies');
});

/* ============ 46–50. VISUAL DE RESONANCE E ORIGEM ============ */
ok('B3-46: resonance HIGH tem estado visual próprio — coeso, NÃO "lendário"',()=>{
  const h=T.pr15PresVisualState('high','n1');
  const n=T.pr15PresVisualState('normal','n1');
  const u=T.pr15PresVisualState('unstable','n1');
  assert.strictEqual(h.resonance,'high');
  assert.ok(h.jitter<n.jitter&&n.jitter<u.jitter,'high é o MAIS estável');
  assert.ok(h.ghosts<=n.ghosts,'high tem menos afterimages');
  assert.ok(h.wobble<n.wobble,'high oscila menos');
  /* "coerente", não raridade: mesma gramática visual das demais */
  assert.strictEqual(h.dash.length,2,'mesma gramática de anel');
  assert.ok(!/lend|legend|rare|raro|epic|gold|ouro/i.test(B3CODE),
    'nenhuma linguagem de raridade no bloco');
  assert.ok(h.ringAlpha<=1&&h.ringAlpha>0,'anel dentro da mesma escala das demais');
});
ok('B3-47: resonance NORMAL tem estado visual próprio — distorção moderada',()=>{
  const h=T.pr15PresVisualState('high','n1');
  const n=T.pr15PresVisualState('normal','n1');
  const u=T.pr15PresVisualState('unstable','n1');
  assert.strictEqual(n.resonance,'normal');
  assert.ok(n.jitter>h.jitter&&n.jitter<u.jitter,'distorção intermediária');
  assert.ok(n.split>h.split&&n.split<u.split,'deslocamento intermediário');
  /* fallback seguro para valores inválidos */
  assert.strictEqual(T.pr15PresVisualState('zzz','n1').resonance,'normal');
  assert.strictEqual(T.pr15PresVisualState(null,'n1').resonance,'normal');
});
ok('B3-48: resonance UNSTABLE tem estado visual próprio — mais deslocamento e oscilação',()=>{
  const u=T.pr15PresVisualState('unstable','n1');
  const n=T.pr15PresVisualState('normal','n1');
  assert.strictEqual(u.resonance,'unstable');
  assert.ok(u.jitter>n.jitter,'mais instabilidade');
  assert.ok(u.ghostAlpha>n.ghostAlpha,'afterimage mais pronunciado');
  assert.ok(u.wobble>n.wobble,'oscilação maior');
  assert.ok(u.ghosts>=n.ghosts,'mais afterimages');
  assert.ok(u.ghosts<=C.afterimageMax,'ainda respeita o cap');
});
ok('B3-49: origem N-1 tem estado visual próprio — silhueta mais definida',()=>{
  const a=T.pr15PresVisualState('normal','n1');
  const b=T.pr15PresVisualState('normal','n2');
  assert.strictEqual(a.source,'n1');
  assert.ok(a.crisp>b.crisp,'N-1 mais precisa');
  assert.ok(a.lag<b.lag,'N-1 com menos atraso visual');
  assert.strictEqual(a.frag,0,'N-1 sem fragmentação extra');
});
ok('B3-50: origem N-2 tem estado visual próprio — degradada, sem depender só de cor',()=>{
  const a=T.pr15PresVisualState('normal','n1');
  const b=T.pr15PresVisualState('normal','n2');
  assert.strictEqual(b.source,'n2');
  assert.ok(b.ghosts>=a.ghosts,'N-2 com mais afterimages');
  assert.ok(b.jitter>a.jitter,'contorno mais instável');
  assert.ok(b.lag>a.lag,'atraso visual maior');
  assert.strictEqual(b.frag,1,'fragmentação temporal marcada');
  /* a diferença NÃO é só cor: as duas usam a mesma dupla ciano/magenta */
  assert.ok(B3CODE.indexOf('PR15_PRES_CYAN')>0&&B3CODE.indexOf('PR15_PRES_MAGENTA')>0,
    'ambas usam a identidade cromática do ECHO');
  const tabela=B3CODE.slice(B3CODE.indexOf('PR15_PRES_SRC_VIS'),
                            B3CODE.indexOf('PR15_PRES_SRC_VIS')+320);
  assert.ok(!/#[0-9a-f]{6}/i.test(tabela),'a tabela de origem não define cor alguma');
});

/* ============ 51–52. CAPS DE PERFORMANCE ============ */
ok('B3-51: afterimages têm CAP DURO',()=>{
  reset();
  for(const src of ['n1','n2'])for(const res of ['high','normal','unstable']){
    const capExp=T.pr15PresGhostCapFor(res,src);
    assert.ok(capExp>=1&&capExp<=C.afterimageMax,'cap declarado válido: '+capExp);
    T.pr15PresReset();
    T.pr15PresSpawn(enc({id:'g-'+src+res,src:src,res:res}),null);
    let worst=0,g=0;
    while(P()&&g++<20000){
      T.pr15PresUpdate(0.02);
      if(P()&&P().ghosts.length>worst)worst=P().ghosts.length;
    }
    assert.ok(worst<=C.afterimageMax,src+'/'+res+' respeita o cap: '+worst);
    assert.ok(worst<=capExp,'nunca excede o cap da combinação');
  }
  assert.ok(C.afterimageMax<=4,'cap de afterimages ≤ 4 (§28)');
});
ok('B3-52: partículas têm CAP DURO por aparição',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'pc1'}),null);
  /* mesmo pedindo muito mais que o teto, o orçamento é respeitado */
  for(let i=0;i<50;i++)T.pr15PresBurst(P(),20,'#fff');
  assert.ok(P().pUsed<=C.particleMax,'orçamento respeitado: '+P().pUsed);
  assert.strictEqual(T.pr15PresBurst(P(),5,'#fff'),0,'estourado o orçamento, nada mais é criado');
  let worst=P().pUsed,g=0;
  while(P()&&g++<20000){T.pr15PresUpdate(0.02);if(P()&&P().pUsed>worst)worst=P().pUsed;}
  assert.ok(worst<=C.particleMax,'cap mantido no ciclo inteiro: '+worst);
  assert.ok(C.particleMax<=20,'cap de partículas é pequeno (§28)');
});

/* ============ 53–58. SAVE / CONTINUE ============ */
function saveLoadAt(target,o){
  T.pr15PresReset();
  T.pr15PresSpawn(enc(o||{id:'sv'}),null);
  advanceTo(target);
  const before=snap();
  const packed=V(T.pr15PresPack());
  T.pr15PresUnpack({pr15presence:packed});
  T.pr15PresRebuild();
  return {before:before,after:snap(),packed:packed};
}
ok('B3-53: save durante SPAWNING preserva a fase',()=>{
  reset();
  const r=saveLoadAt(C.entryTime*0.5,{id:'sv1'});
  assert.strictEqual(r.before.phase,'spawning');
  assert.strictEqual(r.after.phase,'spawning','fase preservada');
  assert.strictEqual(r.packed.act.ph,'spawning','fase gravada no checkpoint');
});
ok('B3-54: save durante ACTIVE preserva a fase',()=>{
  reset();
  const r=saveLoadAt(C.entryTime+8,{id:'sv2'});
  assert.strictEqual(r.before.phase,'active');
  assert.strictEqual(r.after.phase,'active','fase preservada');
  assert.strictEqual(r.packed.act.ph,'active');
});
ok('B3-55: save durante LEAVING preserva a fase',()=>{
  reset();
  const r=saveLoadAt(C.entryTime+C.activeTime+C.exitTime*0.4,{id:'sv3'});
  assert.strictEqual(r.before.phase,'leaving');
  assert.strictEqual(r.after.phase,'leaving','fase preservada');
  assert.strictEqual(r.packed.act.ph,'leaving');
});
ok('B3-56: Continue restaura o estado campo a campo',()=>{
  reset();
  const r=saveLoadAt(C.entryTime+6,{id:'sv4',src:'n2',res:'unstable',seed:24680,
    intent:9182,mem:'e1-1',wave:7});
  for(const k of ['encounterId','memoryId','source','resonance','seed','intentSeed','phase','wave'])
    assert.deepStrictEqual(r.after[k],r.before[k],'campo preservado: '+k);
  /* x/y são gravados quantizados em 0,1px — a tolerância é a própria quantização */
  assert.ok(Math.abs(r.after.x-r.before.x)<=0.1001,'x preservado (quantizado)');
  assert.ok(Math.abs(r.after.y-r.before.y)<=0.1001,'y preservado (quantizado)');
  /* o que NÃO deve ser persistido (§20) */
  const keys=Object.keys(r.packed.act);
  for(const forb of ['ghosts','parts','particles','trail','alpha','scale','vx','vy'])
    assert.ok(keys.indexOf(forb)<0,'não persiste '+forb);
  /* mas é reconstruído em jogo */
  advanceTo(r.after.age+1);
  assert.ok(P()&&fin(P().alpha)&&Array.isArray(P().ghosts),'visual reconstruído após o Continue');
});
ok('B3-57: Continue NÃO reinicia o TTL',()=>{
  reset();
  for(const target of [0.4,3,12,20,25.6]){
    const r=saveLoadAt(target,{id:'ttl'+target});
    assert.ok(Math.abs(r.after.ttl-r.before.ttl)<=0.011,
      'TTL preservado em '+target+'s: '+r.before.ttl+' → '+r.after.ttl);
    assert.ok(r.after.ttl<TOTAL-0.05,'TTL não voltou ao total');
    assert.ok(Math.abs(r.after.age-r.before.age)<=0.011,'idade preservada');
  }
});
ok('B3-58: Continue NÃO duplica a presença',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'dup1'}),null);
  advanceTo(7);
  const cp={pr15presence:V(T.pr15PresPack())};
  for(let i=0;i<5;i++){
    T.pr15PresUnpack(cp);
    assert.ok(T.pr15PresRebuild(),'reconstrói uma vez (ciclo '+i+')');
    assert.strictEqual(T.pr15PresRebuild(),null,'nunca reconstrói duas vezes');
    assert.strictEqual(P().encounterId,'dup1','sempre a mesma presença');
  }
});

/* ============ 59–61. COMPATIBILIDADE DE SAVE ============ */
ok('B3-59: save antigo SEM o campo B3 carrega normalmente (sem aparição retroativa)',()=>{
  reset();
  for(const cp of [undefined,null,{},{v:1,wave:5},{pr15presence:null},{pr15presence:'x'},
                   {pr15mem:{v:1,enc:[]}}]){
    const r=T.pr15PresUnpack(cp);
    assert.ok(r&&Array.isArray(r.done),'estado vazio seguro');
    assert.strictEqual(r.act,null,'nenhuma presença ativa herdada');
    assert.strictEqual(T.pr15PresRebuild(),null,'nada é reconstruído');
    assert.strictEqual(P(),null,'nenhuma entidade');
  }
  /* §21: descriptor B2 consumed em onda ANTERIOR não materializa retroativamente */
  memState([enc({id:'old1',wave:4,at:4,st:'consumed'})],9);
  assert.strictEqual(T.pr15PresOnWave(9),null,'run antiga não ganha aparição surpresa');
  assert.strictEqual(P(),null);
});
ok('B3-60: save PARCIAL do B3 carrega sem quebrar',()=>{
  reset();
  const casos=[
    {done:['a','b']},
    {act:{enc:'x',mem:'e1-2'}},
    {done:['z'],act:null},
    {done:[],act:{enc:'y',mem:'e1-2',ph:'active'}},
    {v:99,done:['k'],act:{enc:'k',mem:'e1-1',src:'n2',res:'high'}}
  ];
  for(const c of casos){
    T.pr15PresReset();
    const r=T.pr15PresUnpack({pr15presence:c});
    assert.ok(r&&Array.isArray(r.done),'done sempre array');
    T.pr15PresRebuild();
    if(P()){
      assert.ok(fin(P().age)&&fin(P().ttl)&&fin(P().x)&&fin(P().y),'estado finito');
      assert.ok(T.PR15_PRES_PHASES[P().phase],'fase válida: '+P().phase);
      /* o encounter restaurado entra no registro de materializados */
      assert.ok(T.getPr15PresRun().done.indexOf(P().encounterId)>=0,
        'registrado como materializado');
    }
  }
});
ok('B3-61: a sanitização evita NaN/Infinity em qualquer carga hostil',()=>{
  reset();
  const tipos=[NaN,Infinity,-Infinity,'x',null,undefined,{},[],true,-1,1e30,'12abc'];
  const Pk=i=>tipos[i%tipos.length];
  let n=0;
  for(let i=0;i<600;i++){
    const hostil={
      v:Pk(i),done:(i%5===0)?Pk(i):['a','b','c',Pk(i),'x'.repeat(80)],
      act:(i%7===0)?Pk(i):{
        enc:(i%11===0)?Pk(i):'e'+i,mem:(i%13===0)?Pk(i):'e1-2',
        src:(i%3===0)?Pk(i):'n2',res:(i%4===0)?Pk(i):'unstable',
        seed:Pk(i+1),intent:Pk(i+2),wave:Pk(i+3),
        x:Pk(i+4),y:Pk(i+5),ph:(i%6===0)?Pk(i):'active',
        age:Pk(i+6),fb:Pk(i+7)}
    };
    let st=null;
    try{
      T.pr15PresReset();
      st=T.pr15PresUnpack({pr15presence:hostil});
      T.pr15PresRebuild();
    }catch(err){assert.fail('load explodiu no caso '+i+': '+err.message);}
    n++;
    assert.ok(st&&Array.isArray(st.done),'done array no caso '+i);
    assert.ok(st.done.length<=C.doneMax,'done limitado no caso '+i);
    if(st.act){
      for(const f of ['seed','intent','wave','x','y','age','fb'])
        assert.ok(fin(st.act[f]),f+' finito no caso '+i+': '+st.act[f]);
      assert.ok(['n1','n2'].indexOf(st.act.src)>=0,'src sane');
      assert.ok(['high','normal','unstable'].indexOf(st.act.res)>=0,'res sane');
      assert.ok(st.act.ph!=='done'&&T.PR15_PRES_PHASES[st.act.ph],'fase sane');
      assert.ok(st.act.age>=0&&st.act.age<=TOTAL,'idade dentro do ciclo');
    }
    if(P()){
      for(const f of ['x','y','age','ttl','alpha','scale','vx','vy'])
        assert.ok(fin(P()[f]),f+' finito na entidade (caso '+i+')');
    }
    assert.ok(!/NaN|Infinity/.test(JSON.stringify(T.pr15PresPack())),'pack sem NaN no caso '+i);
  }
  assert.strictEqual(n,600,'600 cargas hostis executadas');
});

/* ============ 62–65. ISOLAMENTO (SLOT / SANDBOX / DEV) ============ */
ok('B3-62: slots isolados — nada vaza entre Save 1/2/3',()=>{
  reset();
  T.pr15PresSpawn(enc({id:'slot1'}),null);
  advanceTo(5);
  assert.ok(P(),'presença ativa no slot atual');
  /* o kit limpa corpo e registro na troca de slot */
  assert.ok(/activateSlot\s*=\s*function/.test(B3CODE),'activateSlot patchado');
  assert.ok(/smClearSlotSave\s*=\s*function/.test(B3CODE),'smClearSlotSave patchado');
  T.pr15PresReset();
  assert.strictEqual(P(),null,'corpo limpo');
  assert.strictEqual(T.getPr15PresRun().done.length,0,'registro limpo');
  /* o pack de um slot sem estado é nulo — não escreve lixo no outro slot */
  assert.strictEqual(T.pr15PresPack(),null,'sem estado ⇒ nada é gravado');
});
ok('B3-63: Sandbox isolado — não materializa, não marca, não persiste',()=>{
  reset();
  memState([enc({id:'sbx1',wave:4,at:4,st:'consumed'})],3);
  T.setSandboxRun(true);
  assert.strictEqual(T.pr15PresOnWave(4),null,'Sandbox nunca materializa pela onda');
  assert.strictEqual(P(),null);
  /* contexto do laboratório recebe registro próprio e devolve o real na saída */
  T.setSandboxRun(false);
  T.pr15PresMarkDone('real-1');
  const realDone=V(T.getPr15PresRun().done);
  T.pr15PresSandboxContextStart();
  assert.deepStrictEqual(V(T.getPr15PresRun().done),[],'laboratório começa limpo');
  T.pr15PresMarkDone('lab-1');
  T.pr15PresSandboxTearDown();
  assert.deepStrictEqual(V(T.getPr15PresRun().done),realDone,'estado real devolvido intacto');
  assert.ok(V(T.getPr15PresRun().done).indexOf('lab-1')<0,'nada do laboratório vazou');
  assert.strictEqual(P(),null,'nenhum corpo sobrevive à saída do laboratório');
  /* echoQueue e histórico nunca são tocados pelo laboratório */
  assert.strictEqual(V(T.getEchoQueue()).length,2,'echoQueue intacta');
});
ok('B3-64: DEV é inerte em release (DEV_MODE=false)',()=>{
  reset();
  X('DEV_MODE=false');
  assert.strictEqual(T.pr15DevPresenceState(),null,'state inerte');
  assert.strictEqual(T.pr15DevPresenceSpawn({source:'n1'}),null,'spawn inerte');
  assert.strictEqual(T.pr15DevPresenceEnd(),null,'end inerte');
  assert.strictEqual(T.pr15DevPresenceVisual('high','n1'),null,'visual inerte');
  assert.strictEqual(P(),null,'nenhuma entidade criada em release');
  assert.strictEqual(T.getDevTainted(),false,'release não tainta');
  /* todos os helpers checam DEV_MODE */
  for(const fn of ['pr15DevPresenceState','pr15DevPresenceSpawn',
                   'pr15DevPresenceEnd','pr15DevPresenceVisual']){
    const i=B3CODE.indexOf('function '+fn);
    assert.ok(i>0,fn+' existe');
    assert.ok(B3CODE.slice(i,i+240).indexOf('DEV_MODE')>0,fn+' checa DEV_MODE');
  }
});
ok('B3-65: DEV force TAINTA a run e não contamina o save real',()=>{
  reset();
  X('DEV_MODE=true');T.setDevTainted(false);
  const r=T.pr15DevPresenceSpawn({source:'n2',resonance:'unstable'});
  assert.ok(r&&r.ok,'materializou via DEV: '+JSON.stringify(r&&r.reason));
  assert.strictEqual(T.getDevTainted(),true,'a run foi taintada');
  assert.ok(P(),'entidade DEV existe');
  assert.strictEqual(P().source,'n2','origem forçada respeitada');
  assert.strictEqual(P().resonance,'unstable','ressonância forçada respeitada');
  assert.strictEqual(P().dev,true,'marcada como DEV');
  /* NÃO marca o registro de materializados nem é persistida */
  assert.ok(T.getPr15PresRun().done.indexOf(P().encounterId)<0,'não marca encounter real');
  const pk=T.pr15PresPack();
  assert.ok(!pk||!pk.act,'presença DEV nunca é gravada no checkpoint');
  /* não cria descriptor no estado do B2 */
  assert.strictEqual(T.getPr15MemRun(),null,'nenhum descriptor legítimo falso criado');
  assert.strictEqual(V(T.getEchoQueue()).length,2,'echoQueue intacta');
  /* helpers de playtest cobrem as combinações exigidas pelo §24 */
  for(const res of ['high','normal','unstable'])for(const src of ['n1','n2']){
    const v=T.pr15DevPresenceVisual(res,src);
    assert.ok(v&&v.resonance===res&&v.source===src,'visual DEV '+res+'/'+src);
  }
  T.pr15DevPresenceEnd(true);
  assert.strictEqual(P(),null,'DEV end limpa a entidade');
  X('DEV_MODE=false');T.setDevTainted(false);
});

/* ============ 66–69. FIM DE RUN ============ */
function endClears(label){
  reset();
  T.pr15PresSpawn(enc({id:label}),null);
  advanceTo(5);
  assert.ok(P(),'presença ativa antes de '+label);
  T.pr15PresReset();
  assert.strictEqual(P(),null,label+' limpou a entidade');
  assert.strictEqual(T.getPr15PresRun().done.length,0,label+' limpou o registro');
}
ok('B3-66: nova run limpa a presença anterior',()=>{
  endClears('novarun');
  assert.ok(/startRun\s*=\s*function/.test(B3CODE),'startRun patchado');
  /* a limpeza ocorre ANTES do corpo original (presença nunca atravessa runs) */
  const i=B3CODE.indexOf('startRun=function');
  const trecho=B3CODE.slice(i,i+200);
  assert.ok(trecho.indexOf('pr15PresReset')<trecho.indexOf('_st.apply'),
    'reset antes do corpo original');
});
ok('B3-67: morte do jogador limpa a presença',()=>{
  endClears('morte');
  assert.ok(/onPlayerDeath\s*=\s*function/.test(B3CODE),'onPlayerDeath patchado');
});
ok('B3-68: vitória limpa a presença',()=>{
  endClears('vitoria');
  assert.ok(/onVictory\s*=\s*function/.test(B3CODE),'onVictory patchado');
  assert.ok(/showVictory\s*=\s*function/.test(B3CODE),'showVictory patchado');
});
ok('B3-69: abort limpa a presença',()=>{
  endClears('abort');
  assert.ok(/abortRun\s*=\s*function/.test(B3CODE),'abortRun patchado');
});

/* ============ 70. STRESS ============ */
ok('B3-70: stress — 300 aparições sequenciais sem crescimento de estado',()=>{
  reset();
  let ghostMax=0,partMax=0,doneMax=0,leak=0;
  for(let i=0;i<300;i++){
    const p=T.pr15PresSpawn(enc({id:'st'+i,seed:(i*7919)>>>0,
      src:(i%2)?'n2':'n1',res:['high','normal','unstable'][i%3]}),null);
    if(!p){leak++;continue;}
    let g=0;
    while(P()&&g++<20000){
      if(P().ghosts.length>ghostMax)ghostMax=P().ghosts.length;
      if((P().pUsed|0)>partMax)partMax=P().pUsed|0;
      T.pr15PresUpdate(0.05);
    }
    if(T.getPr15PresRun().done.length>doneMax)doneMax=T.getPr15PresRun().done.length;
    if(P())leak++;
  }
  assert.strictEqual(leak,0,'nenhuma entidade vazada');
  assert.ok(ghostMax<=C.afterimageMax,'afterimages sob cap: '+ghostMax);
  assert.ok(partMax<=C.particleMax,'partículas sob cap: '+partMax);
  assert.ok(doneMax<=C.doneMax,'registro done não cresce: '+doneMax);
  assert.strictEqual(V(T.getEchoQueue()).length,2,'echoQueue intacta após o stress');
  const pk=T.pr15PresPack();
  assert.ok(!pk||pk.done.length<=C.doneMax,'checkpoint permanece compacto');
});

/* ============ 71–75. LIMITES DO ESCOPO B3 ============ */
ok('B3-71: NENHUM scheduler do B2 foi alterado',()=>{
  reset();
  memState([enc({id:'sc1',wave:4,at:4,st:'consumed'}),
            enc({id:'sc2',wave:7,at:0,st:'scheduled'})],3);
  const antes=JSON.stringify(V(T.getPr15MemRun()));
  T.pr15PresOnWave(4);
  const depois=V(T.getPr15MemRun());
  assert.strictEqual(depois.enc[0].st,'consumed','status intocado');
  assert.strictEqual(depois.enc[1].st,'scheduled','agendamento intocado');
  assert.strictEqual(depois.waveDone,3,'waveDone intocado');
  assert.strictEqual(JSON.stringify(depois),antes,'estado do B2 idêntico após materializar');
  /* nem por escrita direta */
  assert.ok(!/pr15MemRun\s*=[^=]/.test(B3CODE),'B3 nunca atribui pr15MemRun');
  assert.ok(!/\.st\s*=\s*'(consumed|scheduled|skipped)'/.test(B3CODE),
    'B3 nunca muda o status de um descriptor');
  assert.ok(!/pr15MemOnWave|pr15MemBuildPlan|pr15MemBeginRun/.test(B3CODE),
    'B3 não duplica nem chama a lógica de schedule');
});
ok('B3-72: NENHUMA lógica do B4 foi criada',()=>{
  const low=B3CODE.toLowerCase();
  for(const t of ['bossadapt','adaptiveai','codex','reward','recompensa'])
    assert.ok(low.indexOf(t)<0,'sem lógica de B4+: '+t);
  assert.ok(!/echoSpeak|speechQueue|ECHO_LINES/.test(B3CODE),'sem diálogo');
  assert.ok(!/saveMeta|addResidues|grantWeapon/.test(B3CODE),'sem progressão/meta');
});
ok('B3-73: NENHUMA semântica ALIADA/RIVAL/AMBÍGUA foi criada',()=>{
  const low=B3CODE.toLowerCase();
  for(const t of ['aliada','rival','ambigua','ambígua','friendly'])
    assert.ok(low.indexOf(t)<0,'sem semântica de intenção: '+t);
  /* o intentSeed é apenas transportado */
  reset();
  T.pr15PresSpawn(enc({id:'sem1',intent:55555}),null);
  const s=snap();
  assert.strictEqual(s.intentSeed,55555,'intentSeed transportado');
  assert.strictEqual(s.intent,undefined,'nenhuma intenção resolvida');
  assert.strictEqual(P().stance,undefined,'sem postura');
  assert.strictEqual(P().attitude,undefined,'sem atitude');
});
ok('B3-74: NENHUMA alteração em moralidade ou facções',()=>{
  reset();
  const m0=JSON.stringify(V(T.getMoral()));
  T.pr15PresSpawn(enc({id:'mf1'}),null);
  runFull();
  assert.strictEqual(JSON.stringify(V(T.getMoral())),m0,'moralidade inalterada');
  assert.ok(!/applyMoral/.test(B3CODE),'B3 não reaplica moralidade');
  assert.ok(!/factionAffinity|addAffinity|factionPact|factionDiplo|factionPresenceActivate/.test(B3CODE),
    'B3 não altera facções');
  assert.ok(!/spawnBeacon|beacon\s*=[^=]/.test(B3CODE),'B3 não abre nem altera beacon');
  /* lê a presença de facção APENAS dentro do teste de posição segura */
  const iFn=B3CODE.indexOf('function pr15PresSpotBlocked');
  const iRef=B3CODE.indexOf('factionPresenceEntity');
  assert.ok(iFn>0&&iRef>iFn,'referência à facção só dentro da checagem de posição');
});
ok('B3-75: Echos legados continuam 100% normais com a presença ativa',()=>{
  reset();
  T.setState('play');
  const q=V(T.getEchoQueue());
  const e1=T.makeEcho(q[0],1),e2=T.makeEcho(q[1],2);
  T.setEchoes([e1,e2]);
  const snapE=e=>({slot:e.slot,maxHp:e.maxHp,shieldMax:e.shieldMax,hue:e.hue,mul:e.mul,
    dis:e.dis?e.dis.st:null,pers:e.pers?e.pers.id:null,
    items:(e.itemIds||[]).length,rel:!!e.rel,alive:e.alive});
  const b1=snapE(e1),b2=snapE(e2);
  T.pr15PresSpawn(enc({id:'reg1'}),null);
  for(let i=0;i<300;i++){
    T.pr15PresUpdate(0.05);
    for(const e of T.getEchoes())T.updateEcho(e,0.05);
  }
  assert.deepStrictEqual(snapE(e1),b1,'Echo 1 sem regressão');
  assert.deepStrictEqual(snapE(e2),b2,'Echo 2 sem regressão');
  /* mecânicas legadas seguem operando */
  const sh0=e1.shield,hp0=e1.hp;
  T.damageEcho(e1,6);
  assert.ok(e1.shield<sh0||e1.hp<hp0,'damageEcho continua funcionando');
  e1.shield=0;e1.shieldDelayT=0;
  T.regenEchoShield(e1,1);
  assert.ok(e1.shield>0,'regenEchoShield continua funcionando');
  assert.strictEqual(T.echoAllied(e1),true,'Echo continua aliado');
  T.drawEchoEntity(e1);T.drawEchoEntity(e2);
  assert.strictEqual(T.getEchoes().length,2,'echoes[] preservado');
  T.setEchoes([]);
});

/* =====================================================================
   SIMULAÇÕES §31
   ===================================================================== */
console.log('\n  --- SIMULAÇÕES ---');

ok('SIM-A: ciclo de vida — 1.500 entidades, durações, cleanup, zero NaN, zero órfã',()=>{
  reset();
  const N=1500;
  let okDur=0,nan=0,orphan=0,phaseBad=0,sum=0;
  const SRCS=['n1','n2'],RESS=['high','normal','unstable'];
  for(let i=0;i<N;i++){
    T.pr15PresReset();
    const p=T.pr15PresSpawn(enc({id:'a'+i,seed:(i*2654435761)>>>0,
      src:SRCS[i%2],res:RESS[i%3]}),null);
    if(!p){orphan++;continue;}
    const dt=0.02+(i%7)*0.004;
    let t=0,g=0;
    const seen={};
    while(P()&&g++<20000){
      const q=P();
      if(!fin(q.x)||!fin(q.y)||!fin(q.age)||!fin(q.ttl)||!fin(q.alpha)||!fin(q.scale)||
         !fin(q.vx)||!fin(q.vy)||!fin(q.orbit))nan++;
      if(!T.PR15_PRES_PHASES[q.phase])phaseBad++;
      seen[q.phase]=1;
      T.pr15PresUpdate(dt);t+=dt;
    }
    sum+=t;
    if(t>=TOTAL-0.05&&t<=TOTAL+dt+0.05)okDur++;
    if(P())orphan++;
    if(!seen.spawning||!seen.active||!seen.leaving)phaseBad++;
  }
  assert.strictEqual(nan,0,'zero NaN');
  assert.strictEqual(orphan,0,'zero entidade órfã');
  assert.strictEqual(phaseBad,0,'todas as fases percorridas e válidas');
  assert.strictEqual(okDur,N,'todas as durações corretas');
  console.log('      SIM-A: '+N+' entidades · duração média '+(sum/N).toFixed(3)+
    's (alvo '+TOTAL+'s) · 0 NaN · 0 órfã');
});

ok('SIM-B: posicionamento — 4.000 amostras dentro da arena, distância mínima e fallback',()=>{
  reset();
  const M=C.margin,W=T.ARENA.w,H=T.ARENA.h;
  let n=0,inArena=0,far=0,fb=0,det=0,minD=1e9,maxD=0;
  for(let s=1;s<=200;s++){
    const seed=(s*2246822519)>>>0;
    for(let k=0;k<20;k++){
      const px=60+((k*137)%(W-120)),py=40+((k*271)%(H-80));
      const a=T.pr15PresPos(seed,px,py),b=T.pr15PresPos(seed,px,py);
      n++;
      if(a.x===b.x&&a.y===b.y)det++;
      if(a.x>=M-1e-9&&a.x<=W-M+1e-9&&a.y>=M-1e-9&&a.y<=H-M+1e-9)inArena++;
      const d=Math.hypot(a.x-px,a.y-py);
      if(d<minD)minD=d;if(d>maxD)maxD=d;
      if(d>=C.minPlayerDist-1e-6)far++;
      if(a.fb)fb++;
    }
  }
  assert.strictEqual(det,n,'100% determinístico');
  assert.strictEqual(inArena,n,'100% dentro da arena');
  assert.strictEqual(far,n,'100% respeitando a distância mínima');
  console.log('      SIM-B: '+n+' amostras · dentro '+inArena+' · dist '+
    minD.toFixed(0)+'–'+maxD.toFixed(0)+'px · fallback '+(fb/n*100).toFixed(1)+'%');
});

ok('SIM-C: Continue — 600 estados serialize→load→resume campo a campo, sem duplicação',()=>{
  reset();
  const KEYS=['encounterId','memoryId','source','resonance','seed','intentSeed','phase'];
  const SRCS=['n1','n2'],RESS=['high','normal','unstable'];
  let n=0,same=0,ttlOk=0,dup=0,posOk=0;
  for(let i=0;i<600;i++){
    const ph=i%3;
    const target=ph===0?(0.1+(i%6)*0.13):(ph===1?(1.4+(i%38)*0.58):(25.05+(i%10)*0.1));
    T.pr15PresReset();
    if(!T.pr15PresSpawn(enc({id:'c'+i,seed:(i*40503)>>>0,src:SRCS[i%2],
      res:RESS[i%3],mem:(i%2)?'e1-1':'e1-2',intent:(i*7)%100000}),null))continue;
    advanceTo(target);
    if(!P())continue;
    const before=snap();
    const cp={pr15presence:V(T.pr15PresPack())};
    T.pr15PresUnpack(cp);T.pr15PresRebuild();
    const after=snap();
    n++;
    let eq=true;
    for(const k of KEYS)if(JSON.stringify(before[k])!==JSON.stringify(after[k]))eq=false;
    if(eq)same++;
    if(Math.abs(before.x-after.x)<=0.1001&&Math.abs(before.y-after.y)<=0.1001)posOk++;
    if(Math.abs(before.ttl-after.ttl)<=0.011)ttlOk++;
    if(T.pr15PresRebuild()!==null)dup++;
  }
  assert.ok(n>=550,'amostra suficiente: '+n);
  assert.strictEqual(same,n,'todos os campos lógicos preservados');
  assert.strictEqual(posOk,n,'posição preservada dentro da quantização');
  assert.strictEqual(ttlOk,n,'TTL nunca reinicia');
  assert.strictEqual(dup,0,'zero duplicação');
  console.log('      SIM-C: '+n+' ciclos · '+same+' idênticos · TTL ok '+ttlOk+' · 0 duplicações');
});

ok('SIM-D: stress — 300 aparições, caps respeitados e zero referência órfã',()=>{
  reset();
  let ghostMax=0,partMax=0,doneMax=0,leak=0;
  for(let i=0;i<300;i++){
    if(!T.pr15PresSpawn(enc({id:'d'+i,seed:(i*7919)>>>0,
      src:(i%2)?'n2':'n1',res:['high','normal','unstable'][i%3]}),null)){leak++;continue;}
    let g=0;
    while(P()&&g++<20000){
      if(P().ghosts.length>ghostMax)ghostMax=P().ghosts.length;
      if((P().pUsed|0)>partMax)partMax=P().pUsed|0;
      T.pr15PresUpdate(0.05);
    }
    if(T.getPr15PresRun().done.length>doneMax)doneMax=T.getPr15PresRun().done.length;
    if(P())leak++;
  }
  assert.strictEqual(leak,0,'zero vazamento');
  assert.ok(ghostMax<=C.afterimageMax,'afterimages ≤ '+C.afterimageMax);
  assert.ok(partMax<=C.particleMax,'partículas ≤ '+C.particleMax);
  assert.ok(doneMax<=C.doneMax,'registro ≤ '+C.doneMax);
  console.log('      SIM-D: 300 aparições · afterimages máx '+ghostMax+'/'+C.afterimageMax+
    ' · partículas máx '+partMax+'/'+C.particleMax+' · done máx '+doneMax+'/'+C.doneMax+' · 0 órfãs');
});

ok('SIM-E: regressão — Echos aliados normais durante presença temporal ativa',()=>{
  reset();
  T.setState('play');
  const q=V(T.getEchoQueue());
  const e1=T.makeEcho(q[0],1),e2=T.makeEcho(q[1],2);
  T.setEchoes([e1,e2]);
  const cap=e=>({slot:e.slot,maxHp:e.maxHp,shieldMax:e.shieldMax,hue:e.hue,mul:e.mul,
    pers:e.pers?e.pers.id:null,dis:e.dis.st,rel:!!e.rel,items:(e.itemIds||[]).length});
  const base=[cap(e1),cap(e2)];
  T.pr15PresSpawn(enc({id:'sime'}),null);
  let ticks=0;
  while(P()&&ticks++<20000){
    T.pr15PresUpdate(0.05);
    for(const e of T.getEchoes())T.updateEcho(e,0.05);
    T.pr15PresDraw();
    for(const e of T.getEchoes())T.drawEchoEntity(e);
  }
  assert.deepStrictEqual([cap(e1),cap(e2)],base,'nenhum atributo de Echo aliado mudou');
  assert.strictEqual(V(T.getEchoes()).length,2,'echoes[] preservado');
  assert.strictEqual(P(),null,'presença concluiu o ciclo normalmente');
  /* mecânicas legadas continuam operantes depois do ciclo */
  T.damageEcho(e1,5);
  T.regenEchoShield(e1,1);
  assert.strictEqual(T.echoAllied(e1),true,'Echo segue aliado');
  console.log('      SIM-E: '+ticks+' ticks com presença ativa · 2 Echos aliados sem regressão');
  T.setEchoes([]);
});

console.log('');
if(failed){console.log('FALHAS ('+failed+')');process.exit(1);}
console.log('B3 — '+passed+' PASSARAM · 0 FALHAS');
