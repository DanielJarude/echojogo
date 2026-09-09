'use strict';
/* =====================================================================
   TESTES — PR15 · B2 · DIRECTOR DE MEMÓRIAS TEMPORAIS
   ---------------------------------------------------------------------
   Cobre as 60 áreas do brief §24 (ordem literal) + as 5 simulações do
   §25. Mapa 1:1 área → teste:

     1 boot existe → B2-01              31 Continue não rerrola wave → B2-31
     2 sem histórico → B2-02            32 Continue não rerrola seed → B2-32
     3 só N-1 → B2-03                   33 consumido não ressuscita → B2-33
     4 só N-2 → B2-04                   34 checkpoint antes da wave → B2-34
     5 N-1 + N-2 → B2-05                35 checkpoint pós-consumo → B2-35
     6 v2 legado ignorado → B2-06       36 conflito c/ decision → B2-36
     7 v3 sem id → B2-07                37 conflito c/ presença → B2-37
     8 corrompido seguro → B2-08        38 shift limitado → B2-38
     9 determinismo → B2-09             39 sem wave segura → B2-39
    10 seeds diferentes → B2-10         40 slot 1 isolado → B2-40
    11 indep. Math.random → B2-11       41 slot 2 isolado → B2-41
    12 prioridade N-1 → B2-12           42 slot 3 isolado → B2-42
    13 N-2 alcançável → B2-13           43 Sandbox não contamina → B2-43
    14 firstWave >= 4 → B2-14           44 DEV release-inert → B2-44
    15 cooldown >= 3 → B2-15            45 DEV force taints → B2-45
    16 máx 3 oportunidades → B2-16      46 abort limpa → B2-46
    17 descriptor id estável → B2-17    47 vitória limpa → B2-47
    18 referencia memoryId → B2-18      48 morte limpa estado → B2-48
    19 registra source → B2-19          49 morte válida = B1 → B2-49
    20 registra wave → B2-20            50 Echo legado ok → B2-50
    21 seed determinística → B2-21      51 trail preservada → B2-51
    22 resonance determ. → B2-22        52 personalidade ok → B2-52
    23 mesmo theme → B2-23              53 relação/Dissonância ok → B2-53
    24 theme diferente → B2-24          54 equipamento ok → B2-54
    25 histórico não removido → B2-25   55 save antigo sem B2 → B2-55
    26 consumed run-scoped → B2-26      56 save parcial B2 → B2-56
    27 nova run reseta → B2-27          57 sanitização evita NaN → B2-57
    28 Continue preserva → B2-28        58 não copia trail → B2-58
    29 Continue não duplica → B2-29     59 não copia player → B2-59
    30 não rerrola memória → B2-30      60 nenhuma entidade física → B2-60

   SIMULAÇÕES §25: A distribuição (10.000 runs) · B cadência por duração
   de run · C Continue campo a campo · D conflitos · E fuzz de save.

   NOTA DE REALM — o jogo roda num contexto `vm`. Objetos e arrays criados
   lá dentro pertencem a outro realm: seus protótipos NÃO são os do teste,
   e `assert.deepStrictEqual` compara protótipos. Por isso TODA leitura que
   sai do sandbox passa por `V()` (ida e volta em JSON) antes de comparar.
   ===================================================================== */
const assert=require('assert');
const vm=require('vm');
const {sandbox,T,SRC,normalizeSource}=require('../audit_pr135/harness.js');
const X=code=>vm.runInContext(code,sandbox);
const XJ=code=>JSON.parse(X(code));
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));
    if(e&&e.stack&&process.env.PR15B2_DEBUG)console.log(e.stack);}
}

/* ---------------- auditoria estrutural da fonte ---------------- */
function stripComments(s){
  return s.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/[^\n]*/g,' ');
}
function b2Block(){
  const b=normalizeSource(SRC);
  const fim=b.indexOf('/* ==================== PR15·fim b2 ==================== */');
  assert.ok(fim>0,'marcador de fim do bloco B2');
  const ini=b.lastIndexOf('PR15·b2 — DIRECTOR',fim);
  assert.ok(ini>0&&ini<fim,'marcador de início do bloco B2');
  return b.slice(b.lastIndexOf('/* =====',ini),fim);
}
const B2SRC=b2Block();
const B2CODE=stripComments(B2SRC);
const CFG=T.PR15_MEM_CFG;
const SRCN=normalizeSource(SRC);

/* ---------------- normalização de realm ---------------- */
const V=o=>JSON.parse(JSON.stringify(o));

/* ---------------- leitores de estado ---------------- */
const stNow=()=>{const s=T.getPr15MemRun();return s?V(s):null;};
const stEnc=()=>{const s=stNow();return s?s.enc:[];};
const snap=()=>XJ('JSON.stringify(pr15MemSnapshot())');
const pack=()=>XJ('JSON.stringify(pr15MemPack())');
const encs=()=>{const s=snap();return s.scheduled.concat(s.consumed,s.skipped);};
const cands=()=>XJ('JSON.stringify(pr15MemCandidates())');
const qnow=()=>XJ('JSON.stringify(Array.isArray(echoQueue)?echoQueue:[])');
const root=()=>XJ('JSON.stringify(smRoot)');
const sanEnc=e=>XJ('JSON.stringify(pr15MemSanEnc('+JSON.stringify(e)+'))');
const busyOf=n=>XJ('JSON.stringify(pr15MemWaveBusy('+(n|0)+'))');
const isNull=v=>v===null||v===undefined;
const noState=()=>T.getPr15MemRun()===null||T.getPr15MemRun()===undefined;
const MAXW=T.getMaxWave();

/* ---------------- fábricas de dado ---------------- */
/* memória v3 ELEGÍVEL (id estável + trail mínima) */
function mem(id,over){
  const r={id:String(id),out:'death',cause:'enemy',op:'vector',theme:'cinza',seed:99991,
    arch:{dom:'crit',sec:null,state:'definido',domS:.5,secS:null},sigW:'pistol',
    sigItems:['mod_a','mod_b'],moral:{comp:1,greed:2,viol:3},dom:'neutro',
    kills:60,wave:6,dur:300,mh:120,level:4,items:[],upg:[],owned:[0],
    ps:'aggressive',
    trail:[[0,100,200,1,0,0],[.25,101,201,1,0,0],[.5,102,202,1,0,0]]};
  if(over)for(const k in over)r[k]=over[k];
  return r;
}
/* registro legado no FORMATO DO ARQUIVO v2 — sem id, sem assinatura */
function fileV2(n,over){
  const r={v:2,dur:200,dmgMul:1,frMul:1,wave:6,level:5,trail:[],crit:.1,critMul:1.9,
    pierce:1,aoeMul:1,rangeMul:1,meleeRangeMul:1,rangedRangeMul:1,projSpdMul:1,
    longRangeBonus:0,coins:120,items:[],upg:[],owned:[0,1],moral:{comp:4,greed:2,viol:6},
    dom:'viol',k:40,mh:110,st:{s:400,mw:300,rw:100,dsh:20},ps:null};
  for(let i=0;i<30;i++)r.trail.push([i*.25,100+i,200+i,1,0,0]);
  r.tag='L'+n;
  if(over)for(const k in over)r[k]=over[k];
  return r;
}
/* fila padrão: N-1 = e1-2 (Tema cinza), N-2 = e1-1 (Tema sangue) */
function stdQueue(){return [mem('e1-2',{theme:'cinza'}),mem('e1-1',{theme:'sangue'})];}
function setFrac(seed,theme){
  T.setFractureRun({v:1,theme:theme||null,seed:(seed>>>0)||0,intensity:0,stage:'a',
    waveProfile:{wave:0,last:0,bias:{},pool:[]},
    b3:{evW:0,evWG:0,evRG:0,evSpike:0,mini:{},miniSpawn:{},miniPaid:{},lastEv:null,resoW:0,scarUsed:{}},
    b4:{rev:0,revWhy:'',stages:{},sig:{},sigUsed:[],sigLast:0,sigN:0,hudSeen:'',
        evThematic:0,miniAligned:0,evSig:0},
    history:[],last:null});
}
/* ---------------- controle de cenário ---------------- */
function resetB2(){
  T.setSandboxRun(false);
  T.setDevTainted(false);
  X('DEV_MODE=false');
  T.setPr15MemRun(null);
  clearConflict();
  setFrac(424242,'cinza');
}
function clearConflict(){T.setEvMem(null);T.setBeacon(null);T.setFactionPresenceRun(null);}
/* instala uma fila e calcula o plano */
function startPlan(queue,seed,theme){
  resetB2();
  T.setEchoQueue(queue||[]);
  setFrac(seed!=null?seed:424242,theme!=null?theme:'cinza');
  T.pr15MemBeginRun(T.getEchoQueue());
  return stNow();
}
function runWaves(n,from){for(let w=(from||1);w<=n;w++)T.pr15MemOnWave(w);}
function busyDecision(n){T.setEvMem({dw:n|0});}
function busyPresence(n){T.setFactionPresenceRun({v:1,serial:1,active:null,
  scheduled:{id:1,faction:'anchor',kind:'signal',state:'scheduled',wave:n|0,seed:1},
  lastWave:0,history:[],pactDecl:{},pactEligWave:{}});}
function busyActivePresence(){T.setFactionPresenceRun({v:1,serial:1,
  active:{id:1,faction:'anchor',wave:1},scheduled:null,lastWave:0,history:[],
  pactDecl:{},pactEligWave:{}});}
function busyBeacon(){T.setBeacon({x:0,y:0,r:36,kind:'survivor',t:0,life:38,pulse:0});}
function bootRun(op){
  T.resetShopVars();T.setState('play');T.setMoral({comp:0,greed:0,viol:0});
  T.setPlayer(null);T.setEnemies([]);T.setEchoes([]);
  T.setDevTainted(false);T.setSandboxRun(false);
  X('DEV_MODE=false');
  T.startRun(op?{operatorId:op}:null);
  return T.getPlayer();
}
function padRec(n){
  const cur=XJ('JSON.stringify((Array.isArray(recorder)?recorder:[]).length)');
  const p=T.getPlayer();const wi=(p&&Number.isInteger(p.wi))?p.wi:0;
  for(let i=cur;i<n;i++)X('recorder.push(['+(i*.25).toFixed(2)+','+(120+i)+',150,1,0,'+wi+'])');
}
function clearAllSlots(){
  X('for(var i=1;i<=3;i++){smRoot.slots[i].echoes=[];smRoot.slots[i].seq=0;}smCommit();');
}
function setSlotEchoes(n,arr,seq){
  X('smRoot.slots['+n+'].echoes='+JSON.stringify(arr)+';smRoot.slots['+n+'].seq='+
    (seq||0)+';smCommit();');
}
function echoInfo(rec,slot){
  return XJ('JSON.stringify((function(){try{var x=makeEcho('+JSON.stringify(rec)+','+
    (slot||1)+');return {ok:!!x,alive:x.alive,slot:x.slot,dom:x.dom,'+
    'pers:(x.pers&&x.pers.id)||null,ps:(x.ps&&x.ps.id)||null,'+
    'trust:Math.round((x.trust||0)*100)/100,'+
    'trail:(x.data&&x.data.trail)?x.data.trail.length:0,'+
    'itemIds:(x.itemIds||[]).length,hp:x.hp,maxHp:x.maxHp};}'+
    'catch(err){return {ok:false,msg:String(err&&err.message||err)};}})())');
}

console.log('\nECHO — PR15·B2 · DIRECTOR DE MEMÓRIAS TEMPORAIS');
console.log('---------------------------------------------');
T.unlockAll();

/* ============ 1. BOOT / MÓDULO ============ */
ok('B2-01: o Director existe — bloco PR15·b2, config centralizada e boot após o B1',()=>{
  assert.ok(B2SRC.indexOf('PR15_MEM_CFG')>0,'PR15_MEM_CFG definido no bloco');
  assert.strictEqual(CFG.firstWave,4,'firstWave');
  assert.strictEqual(CFG.cooldownWaves,3,'cooldownWaves');
  assert.strictEqual(CFG.maxEncounters,3,'maxEncounters');
  assert.strictEqual(CFG.conflictShiftMax,2,'conflictShiftMax');
  assert.ok(CFG.n1Chance>0.70&&CFG.n1Chance<0.80,'peso N-1 dentro de 70–80%');
  for(const fn of ['pr15MemCandidates','pr15MemBuildPlan','pr15MemBeginRun','pr15MemOnWave',
    'pr15MemPack','pr15MemUnpack','pr15MemSnapshot','pr15MemoryKitBoot','pr15MemWaveBusy',
    'pr15MemCooldownBusy','pr15MemSanitize','pr15MemSeedFor','pr15MemRunKey'])
    assert.strictEqual(typeof T[fn],'function',fn+' ausente');
  const i1=SRCN.indexOf('pr15TemporalKitBoot();');
  const i2=SRCN.indexOf('pr15MemoryKitBoot();');
  assert.ok(i1>0&&i2>i1,'pr15MemoryKitBoot() vem depois de pr15TemporalKitBoot()');
  /* configuração centralizada: os números não estão espalhados pelo código */
  const antes=stripComments(SRCN.slice(0,SRCN.indexOf('PR15_MEM_CFG=')));
  const depois=stripComments(SRCN.slice(SRCN.indexOf('/* ==================== PR15·fim b2')));
  assert.ok(!/firstWave\s*:/.test(antes+depois),'firstWave não duplicado fora do bloco');
  assert.ok(!/conflictShiftMax\s*:/.test(antes+depois),'conflictShiftMax não duplicado');
});

/* ============ 2. ELEGIBILIDADE ============ */
ok('B2-02: nenhum histórico elegível → nenhum schedule (e nenhuma memória falsa)',()=>{
  for(const q of [[],null,undefined]){
    startPlan(q||[]);
    assert.ok(stNow(),'estado criado');
    assert.deepStrictEqual(stEnc(),[],'fila '+JSON.stringify(q)+' ⇒ plano vazio');
    runWaves(MAXW);
    assert.strictEqual(snap().count,0,'nada consumido');
    assert.deepStrictEqual(encs(),[],'nenhum descriptor');
  }
  startPlan([null,42,'x',[],{}]);
  assert.deepStrictEqual(stEnc(),[],'registros inválidos não geram memória falsa');
});

ok('B2-03: apenas N-1 elegível → só N-1 é usada',()=>{
  startPlan([mem('e1-9')]);
  assert.ok(stEnc().length>=1,'há plano');
  for(const e of stEnc()){
    assert.strictEqual(e.src,'n1','source sempre n1');
    assert.strictEqual(e.mem,'e1-9','referencia a única memória');
  }
  assert.strictEqual(cands().length,1,'uma candidata');
  assert.strictEqual(cands()[0].source,'n1');
});

ok('B2-04: apenas N-2 elegível → N-2 é usada (não é descartada)',()=>{
  startPlan([fileV2(1),mem('e1-7')]);     // N-1 inelegível, N-2 elegível
  assert.ok(stEnc().length>=1,'há plano');
  for(const e of stEnc()){
    assert.strictEqual(e.src,'n2','source n2');
    assert.strictEqual(e.mem,'e1-7');
  }
  const c=cands();
  assert.strictEqual(c.length,1);
  assert.strictEqual(c[0].source,'n2');
});

ok('B2-05: N-1 + N-2 elegíveis → ambas alcançáveis, com N-1 prioritária',()=>{
  let n1=0,n2=0;
  for(let s=1;s<=400;s++){
    startPlan(stdQueue(),s);
    for(const e of stEnc()){if(e.src==='n1')n1++;else n2++;}
  }
  assert.ok(n1>0&&n2>0,'ambas aparecem');
  assert.ok(n1>n2,'N-1 aparece mais ('+n1+' vs '+n2+')');
  assert.ok(n1/(n1+n2)>0.70,'proporção N-1 > 70%');
});

/* ============ 6-8. REGISTROS INELEGÍVEIS ============ */
ok('B2-06: v2 legado sem id é ignorado pelo Director (e NÃO é destruído)',()=>{
  const leg=fileV2(1);
  const antes=JSON.stringify(leg);
  assert.strictEqual(T.pr15MemIsEligible(leg),false,'v2 sem id não é elegível');
  startPlan([leg]);
  assert.deepStrictEqual(stEnc(),[],'v2 não entra no plano');
  assert.strictEqual(JSON.stringify(qnow()[0]),antes,'registro intacto');
  const san=XJ('JSON.stringify(pr15SanitizeRecord('+JSON.stringify(leg)+'))');
  assert.ok(san&&Array.isArray(san.trail)&&san.trail.length===30,'B1 continua aceitando o v2');
  assert.strictEqual(echoInfo(san,1).ok,true,'Eco legado continua sendo criado');
});

ok('B2-07: v3 sem id (ou id inválido) é ignorada/sanitizada com segurança',()=>{
  for(const bad of [mem('e1-1',{id:null}),mem('e1-1',{id:42}),mem('e1-1',{id:''}),
    mem('e1-1',{id:'x'.repeat(80)}),mem('e1-1',{id:{}}),mem('e1-1',{id:[]})])
    assert.strictEqual(T.pr15MemIsEligible(bad),false,
      'id inválido rejeitado: '+JSON.stringify(bad.id));
  startPlan([mem('e1-1',{id:null}),mem('e1-3')]);
  assert.ok(stEnc().length>=1,'a memória com id entra');
  for(const e of stEnc())assert.strictEqual(e.mem,'e1-3','só a memória com id entra');
  /* id=null ⇒ B1 deixa o campo nulo; id de tipo errado ⇒ B1 remove a chave.
     Nos dois casos o leitor trata como registro sem identidade (legado). */
  const sanNull=XJ('JSON.stringify(pr15SanitizeRecord('+JSON.stringify(mem('e1-1',{id:null}))+'))');
  assert.ok(sanNull.id==null,'B1 mantém id nulo quando vem nulo');
  const sanNum=XJ('JSON.stringify(pr15SanitizeRecord('+JSON.stringify(mem('e1-1',{id:42}))+'))');
  assert.ok(!('id' in sanNum),'B1 remove id de tipo errado');
  const sanLong=XJ('JSON.stringify(pr15SanitizeRecord('+JSON.stringify(mem('e1-1',{id:'x'.repeat(80)}))+'))');
  assert.ok(!('id' in sanLong),'B1 remove id longo demais');
});

ok('B2-08: registro corrompido é ignorado com segurança (sem exceção, sem perder a fila)',()=>{
  const hostis=[{id:'e1-1'},{id:'e1-1',trail:[]},{id:'e1-1',trail:'nao-e-array'},
    {id:'e1-1',trail:[null]},{id:'e1-1',trail:[['a','b']]},{id:'e1-1',trail:[[0,NaN,200]]},
    {id:'e1-1',trail:[[0,Infinity,200]]},{id:'e1-1',trail:[[0,100,200]],dev:true},
    42,'texto',null,[],true];
  for(const h of hostis)
    assert.strictEqual(T.pr15MemIsEligible(h),false,'rejeitado: '+JSON.stringify(h));
  /* a memória válida vai em N-1; todos os corrompidos ficam depois. O
     Director só olha N-1/N-2 — que aqui são {corrompido, corrompido} —
     então o plano é vazio e nada explode. */
  const q=[hostis[0],hostis[1]].concat(hostis.slice(2),[mem('e1-8')]);
  startPlan(q);                                   // não pode lançar
  assert.deepStrictEqual(stEnc(),[],'N-1/N-2 corrompidos ⇒ sem plano');
  assert.strictEqual(qnow().length,q.length,'fila não foi alterada');
  /* com a válida em N-1, ela entra e os corrompidos são ignorados */
  const q2=[mem('e1-8')].concat(hostis);
  startPlan(q2);
  assert.ok(stEnc().length>=1,'a válida entra');
  for(const e of stEnc())assert.strictEqual(e.mem,'e1-8','só a válida entrou');
  assert.strictEqual(qnow().length,q2.length,'fila não foi alterada (caso 2)');
});

/* ============ 9-13. DETERMINISMO ============ */
ok('B2-09: mesma seed + mesma fila + mesmo slot ⇒ plano IDÊNTICO',()=>{
  const sa=JSON.stringify(startPlan(stdQueue(),777001).enc);
  for(let i=0;i<25;i++)
    assert.strictEqual(JSON.stringify(startPlan(stdQueue(),777001).enc),sa,
      'plano divergiu na iteração '+i);
  startPlan(stdQueue(),777001);runWaves(MAXW);
  const ra=JSON.stringify(pack());
  for(let i=0;i<10;i++){
    startPlan(stdQueue(),777001);runWaves(MAXW);
    assert.strictEqual(JSON.stringify(pack()),ra,'resolução divergiu na iteração '+i);
  }
});

ok('B2-10: seeds diferentes PODEM gerar resultados diferentes (não é constante)',()=>{
  const vistos=new Set(),sizes=new Set();
  for(let s=1;s<=300;s++){
    const st=startPlan(stdQueue(),s*7919);
    vistos.add(st.enc.map(e=>e.src+':'+e.mem+':'+e.wave+':'+e.res).join('|'));
    sizes.add(st.enc.length);
  }
  assert.ok(vistos.size>3,'variedade real entre seeds ('+vistos.size+' combinações)');
  assert.ok(sizes.size>1,'nº de oportunidades varia: '+[...sizes].sort().join(','));
});

ok('B2-11: independência total de Math.random global',()=>{
  assert.ok(!/Math\s*\.\s*random/.test(B2CODE),'bloco B2 não usa Math.random');
  for(const bad of ['rand(','randInt(','pickWeighted(','pickWeightedMoral('])
    assert.ok(B2CODE.indexOf(bad)<0,'bloco B2 não chama '+bad);
  const base=JSON.stringify(startPlan(stdQueue(),5150).enc);
  X('for(var i=0;i<5000;i++)Math.random();');
  assert.strictEqual(JSON.stringify(startPlan(stdQueue(),5150).enc),base,
    'Math.random alheio não altera o plano');
  startPlan(stdQueue(),5150);
  X('for(var i=0;i<5000;i++)Math.random();');
  runWaves(MAXW);
  const r1=JSON.stringify(pack());
  startPlan(stdQueue(),5150);runWaves(MAXW);
  assert.strictEqual(JSON.stringify(pack()),r1,'resolução independente de Math.random');
  /* a seed do Director deriva só de dados estáveis */
  setFrac(424242,'cinza');
  const s1=T.pr15MemRunSeed();
  X('for(var i=0;i<999;i++)Math.random();');
  assert.strictEqual(T.pr15MemRunSeed(),s1,'runSeed não depende de Math.random');
});

ok('B2-12: prioridade estatística de N-1 ≈ 75%',()=>{
  let n1=0,n2=0;
  for(let s=1;s<=6000;s++){
    startPlan(stdQueue(),s);
    for(const e of stEnc()){if(e.src==='n1')n1++;else n2++;}
  }
  const p=n1/(n1+n2);
  assert.ok(p>0.70&&p<0.80,'N-1 = '+(100*p).toFixed(2)+'% (alvo 70–80%)');
  assert.ok(Math.abs(p-CFG.n1Chance)<0.03,'próximo do peso configurado '+CFG.n1Chance);
});

ok('B2-13: N-2 continua alcançável (≈ 25%, nunca eliminada)',()=>{
  let n1=0,n2=0;
  for(let s=1;s<=6000;s++){
    startPlan(stdQueue(),s);
    for(const e of stEnc()){if(e.src==='n1')n1++;else n2++;}
  }
  const p=n2/(n1+n2);
  assert.ok(p>0.20&&p<0.30,'N-2 = '+(100*p).toFixed(2)+'% (alvo 20–30%)');
  assert.ok(n2>100,'N-2 ocorre com frequência real ('+n2+' ocorrências)');
});

/* ============ 14-16. CADÊNCIA ============ */
ok('B2-14: nenhuma oportunidade antes da firstWave ('+CFG.firstWave+')',()=>{
  let min=MAXW+1;
  for(let s=1;s<=800;s++){
    startPlan(stdQueue(),s*31);
    for(const e of stEnc()){
      assert.ok(e.base>=CFG.firstWave,'base '+e.base+' < firstWave');
      if(e.wave<min)min=e.wave;
    }
  }
  assert.ok(min>=CFG.firstWave,'menor onda agendada = '+min);
  for(let s=1;s<=120;s++){
    startPlan(stdQueue(),s*97);
    for(let w=1;w<CFG.firstWave;w++)T.pr15MemOnWave(w);
    assert.strictEqual(snap().consumed.length,0,'consumo antes da onda '+CFG.firstWave);
  }
});

ok('B2-15: cooldown mínimo de '+CFG.cooldownWaves+' ondas entre oportunidades resolvidas',()=>{
  let pares=0;
  for(let s=1;s<=900;s++){
    startPlan(stdQueue(),s*13);
    runWaves(MAXW);
    const at=snap().consumed.map(e=>e.at|0).sort((a,b)=>a-b);
    for(let i=1;i<at.length;i++){
      pares++;
      assert.ok(at[i]-at[i-1]>=CFG.cooldownWaves,
        'cooldown violado: '+at[i-1]+'→'+at[i]+' (seed '+s+')');
    }
  }
  assert.ok(pares>100,'cooldown exercitado em '+pares+' pares');
});

ok('B2-16: no máximo '+CFG.maxEncounters+' oportunidades por run',()=>{
  for(let s=1;s<=900;s++){
    const st=startPlan(stdQueue(),s*17);
    assert.ok(st.enc.length<=CFG.maxEncounters,'plano com '+st.enc.length+' acima do teto');
    runWaves(MAXW);
    assert.ok(snap().consumed.length<=CFG.maxEncounters,'consumo acima do teto');
    assert.ok((snap().count|0)<=CFG.maxEncounters,'count acima do teto');
  }
});

/* ============ 17-21. DESCRIPTOR ============ */
ok('B2-17: descriptor tem ID estável (sobrevive a pack/unpack e à repetição)',()=>{
  const ids=startPlan(stdQueue(),31337).enc.map(e=>e.id);
  assert.ok(ids.length>=1,'há descriptors');
  for(const id of ids){
    assert.ok(typeof id==='string'&&id.length>0&&id.length<=32,'id válido: '+id);
    assert.ok(/^p[1-3]-/.test(id),'id no formato p<slot>-...: '+id);
  }
  assert.strictEqual(new Set(ids).size,ids.length,'ids únicos dentro do plano');
  T.pr15MemUnpack({pr15mem:pack()});
  assert.deepStrictEqual(encs().map(e=>e.id),ids,'ids preservados no round-trip');
  for(let i=0;i<10;i++)
    assert.deepStrictEqual(startPlan(stdQueue(),31337).enc.map(e=>e.id),ids,
      'id estável na iteração '+i);
});

ok('B2-18: descriptor REFERENCIA memoryId (não incorpora a memória)',()=>{
  const q=stdQueue();
  const enc=startPlan(q,2024).enc;
  for(const e of enc){
    assert.ok(typeof e.mem==='string'&&/^e\d+-\d+$/.test(e.mem),'mem é memoryId: '+e.mem);
    assert.ok(q.some(r=>r.id===e.mem),'memoryId aponta para a fila real');
  }
  const flat=JSON.stringify(enc);
  for(const bad of ['trail','sigItems','arch','moral','owned','upg','items','ps','mh'])
    assert.ok(flat.indexOf('"'+bad+'"')<0,'descriptor não embute '+bad);
});

ok('B2-19: descriptor registra a source (n1 | n2)',()=>{
  const enc=startPlan(stdQueue(),909).enc;
  for(const e of enc){
    assert.ok(e.src==='n1'||e.src==='n2','src válido: '+e.src);
    assert.strictEqual(e.mem,(e.src==='n1')?'e1-2':'e1-1','src coerente com memoryId');
  }
  const s=sanEnc(Object.assign({},enc[0],{src:'n9'}));
  assert.ok(s.src==='n1'||s.src==='n2','src inválida cai em valor válido ('+s.src+')');
});

ok('B2-20: descriptor registra a onda planejada (scheduledWave)',()=>{
  const enc=startPlan(stdQueue(),4711).enc;
  for(const e of enc){
    assert.ok(Number.isInteger(e.wave)&&e.wave>=CFG.firstWave&&e.wave<=MAXW,
      'wave em faixa: '+e.wave);
    assert.ok(Number.isInteger(e.base),'base registrada');
    assert.strictEqual(e.shift,0,'shift começa em 0');
    assert.strictEqual(e.wave,e.base,'sem conflito ⇒ wave === base');
  }
});

ok('B2-21: descriptor tem seed própria e determinística',()=>{
  const enc=startPlan(stdQueue(),8080).enc;
  for(const e of enc){
    assert.ok(Number.isInteger(e.seed)&&e.seed>0&&e.seed<=0xFFFFFFFF,'seed 32 bits: '+e.seed);
    assert.ok(Number.isInteger(e.intent)&&e.intent>=0&&e.intent<100000,'intentSeed em faixa');
  }
  assert.deepStrictEqual(startPlan(stdQueue(),8080).enc.map(e=>e.seed),
    enc.map(e=>e.seed),'seed reproduzível');
  const setA=new Set(enc.map(e=>e.seed));
  assert.ok(startPlan(stdQueue(),8081).enc.some(e=>!setA.has(e.seed)),'seed varia com a run');
});

/* ============ 22-24. RESSONÂNCIA ============ */
ok('B2-22: resonance é determinística (mesma entrada ⇒ mesmo valor)',()=>{
  const vals=['high','normal','unstable'];
  for(let s=1;s<=200;s++){
    const a=startPlan(stdQueue(),s).enc.map(e=>e.res);
    for(const r of a)assert.ok(vals.indexOf(r)>=0,'res válida: '+r);
    assert.deepStrictEqual(startPlan(stdQueue(),s).enc.map(e=>e.res),a,
      'ressonância divergiu (seed '+s+')');
  }
});

ok('B2-23: mesmo Tema eleva a ressonância para HIGH',()=>{
  let high=0,tot=0;
  for(let s=1;s<=200;s++){
    for(const e of startPlan(stdQueue(),s,'cinza').enc)
      if(e.mem==='e1-2'){tot++;if(e.res==='high')high++;}
  }
  assert.ok(tot>0,'N-1 agendada');
  assert.strictEqual(high,tot,'mesmo Tema ⇒ sempre HIGH ('+high+'/'+tot+')');
});

ok('B2-24: Tema diferente continua POSSÍVEL (nunca é trava) e pode ser unstable',()=>{
  const vistos={high:0,normal:0,unstable:0};
  let tot=0,u1=0,t1=0,u2=0,t2=0;
  for(let s=1;s<=400;s++){
    for(const e of startPlan(stdQueue(),s,'vazio').enc){
      tot++;vistos[e.res]=(vistos[e.res]||0)+1;
      if(e.src==='n1'){t1++;if(e.res==='unstable')u1++;}
      else{t2++;if(e.res==='unstable')u2++;}
    }
  }
  assert.ok(tot>0,'memórias com Tema diferente continuam sendo agendadas ('+tot+')');
  assert.strictEqual(vistos.high,0,'sem Tema igual não há HIGH');
  assert.ok(vistos.normal>0,'NORMAL alcançável');
  assert.ok(vistos.unstable>0,'UNSTABLE alcançável');
  assert.ok(t1>0&&t2>0);
  assert.ok(u2/t2>u1/t1,'N-2 mais instável que N-1 ('+(100*u2/t2).toFixed(1)+'% vs '+
    (100*u1/t1).toFixed(1)+'%)');
});

/* ============ 25-27. HISTÓRICO / ESCOPO ============ */
ok('B2-25: a memória histórica NUNCA é removida pelo Director',()=>{
  T.setEchoQueue(stdQueue());
  const antes=JSON.stringify(qnow());
  startPlan(stdQueue(),1234);
  runWaves(MAXW);
  assert.ok(snap().consumed.length>0,'houve consumo');
  assert.strictEqual(JSON.stringify(qnow()),antes,'echoQueue intacto após consumo');
  assert.strictEqual(qnow().length,2,'as duas memórias continuam na fila');
  for(const bad of ['echoQueue.splice','echoQueue.shift','echoQueue.pop',
    'echoQueue.length=','echoQueue=[]','saveEchoes','pr15QueuePush'])
    assert.ok(B2CODE.indexOf(bad)<0,'bloco B2 não contém '+bad);
});

ok('B2-26: "consumed" é run-scoped — não apaga N-1/N-2',()=>{
  startPlan(stdQueue(),555);
  runWaves(MAXW);
  const s=snap();
  assert.ok(s.consumed.length>0,'algo foi consumido');
  assert.ok(s.used.length>0,'consumedMemoryIds preenchido');
  assert.strictEqual(cands().length,2,'candidatas continuam disponíveis');
  const st=stNow();
  assert.ok(st&&Array.isArray(st.enc),'estado run-scoped existe');
  assert.strictEqual(st.count,s.consumed.length,'count coerente');
  for(const u of s.used)assert.ok(qnow().some(r=>r.id===u),'used referencia a fila real');
});

ok('B2-27: nova run reseta o Director (novo estado a partir do histórico atual)',()=>{
  startPlan(stdQueue(),1000);
  runWaves(MAXW);
  const velha=JSON.stringify(pack());
  assert.ok(snap().consumed.length>0,'run antiga teve consumo');
  const st=startPlan(stdQueue(),2000);
  assert.strictEqual(st.count,0,'count zerado');
  assert.strictEqual(st.waveDone,0,'waveDone zerado');
  assert.strictEqual(st.lastWave,0,'lastWave zerado');
  assert.deepStrictEqual(st.used,[],'used zerado');
  assert.notStrictEqual(JSON.stringify(pack()),velha,'estado novo ≠ estado antigo');
  for(const e of st.enc)assert.strictEqual(e.st,'scheduled','tudo recomeça scheduled');
  assert.strictEqual(st.key,T.pr15MemRunKey(),'runKey da run atual');
});

/* ============ 28-33. CONTINUE / IDEMPOTÊNCIA ============ */
ok('B2-28: Continue preserva o schedule (mesma oportunidade, mesma onda)',()=>{
  startPlan(stdQueue(),6060);
  runWaves(CFG.firstWave-1);                     // salva antes da 1ª oportunidade
  const antes=pack();
  T.setPr15MemRun(null);                         // "fechar o jogo"
  T.pr15MemUnpack({pr15mem:antes});              // Continue
  const meio=encs();
  assert.strictEqual(meio.length,antes.enc.length,'mesma quantidade de oportunidades');
  for(let i=0;i<antes.enc.length;i++){
    assert.strictEqual(meio[i].id,antes.enc[i].id,'mesmo id');
    assert.strictEqual(meio[i].wave,antes.enc[i].wave,'mesma onda');
    assert.strictEqual(meio[i].mem,antes.enc[i].mem,'mesma memória');
  }
  runWaves(MAXW,CFG.firstWave);
  assert.ok(snap().consumed.length>0,'a oportunidade chegou a ocorrer');
});

ok('B2-29: Continue NÃO duplica o schedule',()=>{
  for(let s=1;s<=120;s++){
    startPlan(stdQueue(),s);
    const n=stEnc().length;
    for(const stop of [1,2,3,4,5,6,7,8,10,12]){
      startPlan(stdQueue(),s);
      runWaves(stop);
      const cp=pack();
      T.pr15MemUnpack({pr15mem:cp});
      T.pr15MemUnpack({pr15mem:cp});              // dupla restauração
      runWaves(MAXW,stop+1);
      assert.strictEqual(encs().length,n,'duplicação (seed '+s+', stop '+stop+')');
      assert.ok((snap().count|0)<=CFG.maxEncounters,'count dentro do teto');
    }
  }
});

ok('B2-30: Continue NÃO troca a memória (não rerrola N-1 por N-2)',()=>{
  for(let s=1;s<=150;s++){
    startPlan(stdQueue(),s);
    const mems=encs().map(e=>e.mem+':'+e.src);
    const cp=pack();
    T.setPr15MemRun(null);T.pr15MemUnpack({pr15mem:cp});
    runWaves(MAXW);
    assert.deepStrictEqual(encs().map(e=>e.mem+':'+e.src),mems,
      'memória mudou após Continue (seed '+s+')');
  }
});

ok('B2-31: Continue NÃO rerrola a onda',()=>{
  for(let s=1;s<=150;s++){
    startPlan(stdQueue(),s);
    const waves=encs().map(e=>e.wave);
    const cp=pack();
    T.setPr15MemRun(null);T.pr15MemUnpack({pr15mem:cp});
    runWaves(MAXW);
    assert.deepStrictEqual(encs().map(e=>e.wave),waves,'onda mudou (seed '+s+')');
  }
});

ok('B2-32: Continue NÃO rerrola seed, ressonância nem intent',()=>{
  for(let s=1;s<=150;s++){
    startPlan(stdQueue(),s);
    const antes=encs().map(e=>[e.seed,e.res,e.intent,e.id,e.base]);
    const cp=pack();
    T.setPr15MemRun(null);T.pr15MemUnpack({pr15mem:cp});
    runWaves(MAXW);
    assert.deepStrictEqual(encs().map(e=>[e.seed,e.res,e.intent,e.id,e.base]),antes,
      'seed/res/intent mudaram após Continue (seed '+s+')');
  }
});

ok('B2-33: oportunidade consumida NÃO ressuscita após Continue',()=>{
  let exercitados=0;
  for(let s=1;s<=120;s++){
    startPlan(stdQueue(),s);
    runWaves(MAXW);
    const consumidas=encs().filter(e=>e.st==='consumed');
    if(!consumidas.length)continue;
    exercitados++;
    const cp=pack();
    for(let k=0;k<3;k++){
      T.setPr15MemRun(null);
      T.pr15MemUnpack({pr15mem:cp});
      runWaves(MAXW);
      const agora=encs().filter(e=>e.st==='consumed');
      assert.strictEqual(agora.length,consumidas.length,
        'consumo duplicado no ciclo '+k+' (seed '+s+')');
      assert.deepStrictEqual(agora.map(e=>e.id),consumidas.map(e=>e.id),'mesmos ids');
      assert.strictEqual(snap().count,consumidas.length,'count não cresce');
    }
  }
  assert.ok(exercitados>50,'casos com consumo exercitados ('+exercitados+')');
});

/* ============ 34-35. CHECKPOINT ============ */
ok('B2-34: checkpoint ANTES da onda guarda o plano (e o Continue o respeita)',()=>{
  T.activateSlot(1);clearAllSlots();
  T.setEchoQueue(stdQueue());
  bootRun('vector');
  setFrac(424242,'cinza');
  T.pr15MemBeginRun(T.getEchoQueue());
  const plano=stEnc().map(e=>e.id+':'+e.mem+':'+e.wave);
  assert.ok(plano.length>0,'plano existe');
  X('kills=40;wave=3;runTime=180');
  assert.ok(T.captureCheckpoint('b2-antes',3),'checkpoint criado na onda 3');
  const cp=V(T.getActiveRun());
  assert.ok(cp&&cp.pr15mem,'cp.pr15mem presente');
  assert.deepStrictEqual(cp.pr15mem.enc.map(e=>e.id+':'+e.mem+':'+e.wave),plano,
    'checkpoint guarda o plano');
  assert.strictEqual(cp.pr15mem.enc.filter(e=>e.st==='consumed').length,0,'nada consumido ainda');
  T.setPr15MemRun(null);                          // "fechar o jogo"
  T.resumeRun();
  assert.deepStrictEqual(stEnc().map(e=>e.id+':'+e.mem+':'+e.wave),plano,
    'Continue devolve exatamente o mesmo plano');
});

ok('B2-35: checkpoint DEPOIS do consumo guarda o estado consumido',()=>{
  T.activateSlot(1);clearAllSlots();
  T.setEchoQueue(stdQueue());
  bootRun('vector');
  setFrac(424242,'cinza');
  T.pr15MemBeginRun(T.getEchoQueue());
  runWaves(CFG.firstWave);
  const consumidas=snap().consumed;
  assert.ok(consumidas.length>0,'consumo na onda '+CFG.firstWave);
  X('kills=40;wave='+CFG.firstWave+';runTime=200');
  assert.ok(T.captureCheckpoint('b2-depois',CFG.firstWave),'checkpoint criado');
  const cp=V(T.getActiveRun());
  assert.strictEqual(cp.pr15mem.enc.filter(e=>e.st==='consumed').length,consumidas.length,
    'checkpoint reflete o consumo');
  assert.strictEqual(cp.pr15mem.count,consumidas.length,'count persistido');
  T.setPr15MemRun(null);
  T.resumeRun();
  assert.strictEqual(snap().consumed.length,consumidas.length,'consumo sobrevive ao Continue');
  runWaves(MAXW);
  assert.strictEqual(snap().consumed.length,consumidas.length,'não ressuscita');
});

/* ============ 36-39. CONFLITOS ============ */
function firstWaveOf(){return stEnc().map(e=>e.wave).sort((a,b)=>a-b)[0];}
function encByBase(b){return encs().filter(x=>x.base===b)[0];}

ok('B2-36: conflito com decision event adia a oportunidade',()=>{
  startPlan(stdQueue(),1200);clearConflict();
  const alvo=firstWaveOf();
  busyDecision(alvo);
  T.pr15MemOnWave(alvo);
  let e=encByBase(alvo);
  assert.strictEqual(e.st,'scheduled','não consumiu na onda ocupada');
  assert.strictEqual(e.wave,alvo+1,'adiou 1 onda');
  assert.strictEqual(e.shift,1,'shift registrado');
  assert.ok(/decision/.test(e.why),'motivo registrado: '+e.why);
  assert.ok(busyOf(alvo).indexOf('decision')>=0,'pr15MemWaveBusy vê a decisão');
  clearConflict();
  T.pr15MemOnWave(alvo+1);
  e=encByBase(alvo);
  assert.strictEqual(e.st,'consumed','consumiu na onda seguinte');
  assert.strictEqual(e.at,alvo+1);
  /* beacon vivo também conta como conflito */
  startPlan(stdQueue(),1200);clearConflict();busyBeacon();
  const alvo2=firstWaveOf();
  T.pr15MemOnWave(alvo2);
  assert.ok(/beacon/.test(encByBase(alvo2).why),'beacon detectado');
});

ok('B2-37: conflito com presença de facção adia a oportunidade',()=>{
  startPlan(stdQueue(),1300);clearConflict();
  const alvo=firstWaveOf();
  busyPresence(alvo);
  T.pr15MemOnWave(alvo);
  let e=encByBase(alvo);
  assert.strictEqual(e.st,'scheduled','não consumiu sobre a presença');
  assert.strictEqual(e.wave,alvo+1,'adiou');
  assert.ok(/presence/.test(e.why),'motivo: '+e.why);
  /* presença ativa (sem wave) também bloqueia */
  startPlan(stdQueue(),1300);clearConflict();busyActivePresence();
  const alvo2=firstWaveOf();
  T.pr15MemOnWave(alvo2);
  assert.ok(/presence/.test(encByBase(alvo2).why),'presença ativa detectada');
  /* miniboss e assinatura do Diretor de Fratura também */
  const casos=[['miniboss',f=>{f.b3.mini[alvo2]='bulwark';}],
               ['signature',f=>{f.b4.sig[alvo2]='sig1';}]];
  for(const [tag,mut] of casos){
    startPlan(stdQueue(),1300);clearConflict();mut(T.getFractureRun());
    T.pr15MemOnWave(alvo2);
    assert.ok(encByBase(alvo2).why.indexOf(tag)>=0,tag+' detectado ('+encByBase(alvo2).why+')');
  }
});

ok('B2-38: o shift de conflito é limitado a '+CFG.conflictShiftMax+' ondas (sem loop)',()=>{
  startPlan(stdQueue(),1400);clearConflict();
  const alvo=firstWaveOf();
  let guard=0;
  for(let w=alvo;w<=alvo+CFG.conflictShiftMax+2;w++){
    busyDecision(w);
    T.pr15MemOnWave(w);
    guard++;
    assert.ok(guard<50,'sem loop infinito');
  }
  const e=encByBase(alvo);
  assert.ok(e.shift<=CFG.conflictShiftMax,'shift limitado: '+e.shift);
  assert.strictEqual(e.st,'skipped','sem onda segura ⇒ skipped');
  assert.ok(e.why&&e.why.length>0,'motivo do skip registrado: '+e.why);
  assert.ok(e.wave<=alvo+CFG.conflictShiftMax,'wave nunca saiu da janela');
});

ok('B2-39: ausência de onda segura é tratada com semântica clara (skipped)',()=>{
  let skipped=0,consumed=0;
  for(let s=1;s<=150;s++){
    startPlan(stdQueue(),s*29);
    for(let w=1;w<=MAXW;w++){busyDecision(w);busyPresence(w);T.pr15MemOnWave(w);}
    const sn=snap();
    skipped+=sn.skipped.length;consumed+=sn.consumed.length;
    assert.strictEqual(sn.consumed.length,0,'nada consumido em run toda ocupada');
    for(const e of sn.skipped){
      assert.strictEqual(e.st,'skipped');
      assert.ok(e.why&&e.why.length>0,'motivo presente');
      assert.ok((e.at|0)>0,'onda de resolução registrada');
      assert.ok(e.shift<=CFG.conflictShiftMax,'shift limitado');
    }
  }
  clearConflict();
  assert.ok(skipped>0,'skip exercitado ('+skipped+' casos)');
  assert.strictEqual(consumed,0,'nenhum consumo indevido');
});

/* ============ 40-42. SLOT ISOLATION ============ */
function slotIsolation(n){
  T.activateSlot(n);clearAllSlots();
  setSlotEchoes(n,[mem('e'+n+'-101',{theme:'cinza'}),mem('e'+n+'-100',{theme:'sangue'})],101);
  T.activateSlot(n);
  const fila=qnow().map(r=>r.id);
  assert.strictEqual(fila.length,2,'slot '+n+' tem 2 memórias');
  for(const id of fila)assert.ok(id.indexOf('e'+n+'-')===0,'id do slot '+n+': '+id);
  const st=startPlan(qnow(),700+n);
  assert.strictEqual(st.slot,n,'estado marcado com o slot '+n);
  assert.ok(st.key.indexOf('s'+n+':')===0,'runKey do slot '+n+': '+st.key);
  for(const e of st.enc){
    assert.ok(fila.indexOf(e.mem)>=0,'descriptor só referencia memória do slot '+n+': '+e.mem);
    assert.ok(e.id.indexOf('p'+n+'-')===0,'id do descriptor do slot '+n+': '+e.id);
  }
  runWaves(MAXW);
  for(const u of snap().used)assert.ok(fila.indexOf(u)>=0,'consumo restrito ao slot '+n);
  return JSON.stringify({fila:fila,ids:st.enc.map(e=>e.id),key:st.key,used:snap().used});
}
ok('B2-40: slot 1 isolado (não usa nem consome memória dos slots 2/3)',()=>{
  T.activateSlot(2);clearAllSlots();setSlotEchoes(2,[mem('e2-500')]);
  T.activateSlot(3);clearAllSlots();setSlotEchoes(3,[mem('e3-500')]);
  const r=slotIsolation(1);
  assert.ok(!r.includes('e2-'),'nenhuma referência ao slot 2');
  assert.ok(!r.includes('e3-'),'nenhuma referência ao slot 3');
});
ok('B2-41: slot 2 isolado (não usa nem consome memória dos slots 1/3)',()=>{
  T.activateSlot(1);clearAllSlots();setSlotEchoes(1,[mem('e1-600')]);
  T.activateSlot(3);clearAllSlots();setSlotEchoes(3,[mem('e3-600')]);
  const r=slotIsolation(2);
  assert.ok(!r.includes('e1-'),'nenhuma referência ao slot 1');
  assert.ok(!r.includes('e3-'),'nenhuma referência ao slot 3');
});
ok('B2-42: slot 3 isolado + troca de slot descarta o descriptor anterior',()=>{
  T.activateSlot(1);clearAllSlots();setSlotEchoes(1,[mem('e1-700')]);
  T.activateSlot(2);clearAllSlots();setSlotEchoes(2,[mem('e2-700')]);
  const r=slotIsolation(3);
  assert.ok(!r.includes('e1-'),'nenhuma referência ao slot 1');
  assert.ok(!r.includes('e2-'),'nenhuma referência ao slot 2');
  assert.ok(stNow(),'havia estado antes da troca');
  T.activateSlot(1);
  assert.ok(noState(),'activateSlot descarta o estado run-scoped');
});

/* ============ 43. SANDBOX ============ */
ok('B2-43: Sandbox não contamina — não agenda, não consome, não persiste',()=>{
  T.activateSlot(1);clearAllSlots();
  T.setEchoQueue(stdQueue());
  startPlan(stdQueue(),20250);
  runWaves(MAXW);
  const realAntes=JSON.stringify(pack());
  const filaAntes=JSON.stringify(qnow());
  assert.ok(snap().consumed.length>0,'run real consumiu');
  T.pr15MemSandboxContextStart();
  assert.ok(noState(),'estado real afastado no Sandbox');
  T.setSandboxRun(true);
  for(let w=1;w<=MAXW;w++)
    assert.strictEqual(T.pr15MemOnWave(w),null,'onWave inerte no Sandbox');
  assert.strictEqual(T.pr15MemBeginRun(stdQueue()),null,'beginRun inerte no Sandbox');
  assert.strictEqual(T.pr15MemPack(),null,'nada a persistir no Sandbox');
  T.setSandboxRun(false);
  T.pr15MemSandboxTearDown();
  assert.strictEqual(JSON.stringify(pack()),realAntes,'estado real restaurado intacto');
  assert.strictEqual(JSON.stringify(qnow()),filaAntes,'fila intacta');
  assert.ok(/sandboxRun/.test(B2CODE),'bloco B2 verifica sandboxRun');
});

/* ============ 44-45. DEV ============ */
ok('B2-44: helpers DEV são inertes em release (!DEV_MODE)',()=>{
  resetB2();
  T.setEchoQueue(stdQueue());
  startPlan(stdQueue(),777);
  X('DEV_MODE=false');
  assert.strictEqual(T.pr15DevMemoryState(),null,'pr15MemoryState inerte');
  assert.strictEqual(T.pr15DevMemoryCandidates(),null,'pr15MemoryCandidates inerte');
  assert.strictEqual(T.pr15DevMemorySchedule(),null,'pr15MemorySchedule inerte');
  assert.strictEqual(T.pr15DevMemoryForce({source:'n2'}),null,'pr15MemoryForce inerte');
  assert.ok(stEnc().length>0,'plano intacto após chamadas inertes');
  X('DEV_MODE=true');
  const s=XJ('JSON.stringify(pr15DevMemoryState())');
  assert.ok(s&&typeof s==='object','state responde em DEV');
  for(const k of ['eligible','scheduled','consumed','skipped','lastWave','count','waveDone','used'])
    assert.ok(k in s,'campo de observabilidade: '+k);
  const c=XJ('JSON.stringify(pr15DevMemoryCandidates())');
  assert.ok(Array.isArray(c)&&c.length===2,'candidates responde em DEV');
  assert.ok(c[0].id&&('theme' in c[0])&&('arch' in c[0])&&('sigW' in c[0]),
    'candidates expõe assinatura sem comportamento');
  const sch=XJ('JSON.stringify(pr15DevMemorySchedule())');
  assert.ok(sch&&sch.cfg&&Array.isArray(sch.plan),'schedule responde em DEV');
  const antes=JSON.stringify(pack());
  X('pr15DevMemoryState();pr15DevMemoryCandidates();pr15DevMemorySchedule();');
  assert.strictEqual(JSON.stringify(pack()),antes,'helpers DEV de leitura não mutam estado');
  const D=XJ('JSON.stringify(Object.keys(DEV).filter(function(k){return k.indexOf("pr15Memory")===0;}).sort())');
  assert.deepStrictEqual(D,['pr15MemoryCandidates','pr15MemoryForce',
    'pr15MemorySchedule','pr15MemoryState']);
  for(const fn of ['pr15DevMemoryState','pr15DevMemoryCandidates','pr15DevMemorySchedule',
    'pr15DevMemoryForce']){
    const i=B2SRC.indexOf('function '+fn+'(');
    assert.ok(i>0,fn+' existe');
    const corpo=B2SRC.slice(i,B2SRC.indexOf('\nfunction ',i+10));
    assert.ok(/if\(!DEV_MODE\)return null;/.test(stripComments(corpo)),fn+' tem guarda !DEV_MODE');
  }
  X('DEV_MODE=false');
});

ok('B2-45: DEV force funciona só com DEV_MODE e marca a run como devTainted',()=>{
  resetB2();
  T.setEchoQueue(stdQueue());
  startPlan(stdQueue(),4242);
  assert.strictEqual(T.getDevTainted(),false,'run limpa antes');
  X('DEV_MODE=false');
  assert.strictEqual(T.pr15DevMemoryForce({source:'n2'}),null,'force inerte em release');
  assert.strictEqual(T.getDevTainted(),false,'release não tainta');
  X('DEV_MODE=true');
  const r=XJ('JSON.stringify(pr15DevMemoryForce({source:"n2",wave:9}))');
  assert.strictEqual(r.ok,true,'force aplicado');
  assert.strictEqual(T.getDevTainted(),true,'run marcada devTainted');
  const st=stNow();
  assert.strictEqual(st.enc.length,1,'force substitui o plano por 1 decisão');
  assert.strictEqual(st.enc[0].src,'n2','source forçada');
  assert.strictEqual(st.enc[0].wave,9,'onda forçada');
  /* onda forçada respeita a firstWave */
  const r2=XJ('JSON.stringify(pr15DevMemoryForce({wave:1}))');
  assert.ok(stNow().enc[0].wave>=CFG.firstWave,'force não fura a firstWave');
  assert.strictEqual(r2.ok,true);
  /* sem memória elegível, não inventa */
  T.setEchoQueue([]);
  const r3=XJ('JSON.stringify(pr15DevMemoryForce({source:"n1"}))');
  assert.strictEqual(r3.ok,false,'sem memória ⇒ falha explícita');
  assert.deepStrictEqual(stEnc(),[],'nenhuma memória falsa');
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,sandbox:false,dev:true,
    abort:false,victory:false,kills:60,wave:6,dur:300}),false,'run DEV não é válida p/ B1');
  X('DEV_MODE=false');T.setDevTainted(false);
});

/* ============ 46-49. FIM DE RUN ============ */
ok('B2-46: abort limpa o estado run-scoped (e não gera memória)',()=>{
  T.activateSlot(1);clearAllSlots();
  T.setEchoQueue(stdQueue());
  bootRun('vector');
  setFrac(424242,'cinza');
  T.pr15MemBeginRun(T.getEchoQueue());
  assert.ok(stEnc().length>0,'plano ativo');
  X('kills=60;wave=6;runTime=300');
  X('state="paused"');
  X('pr15Ctx.abort=true');
  const filaAntes=JSON.stringify(qnow());
  X('abortRun()');
  assert.ok(noState(),'estado run-scoped descartado no abort');
  assert.strictEqual(JSON.stringify(qnow()),filaAntes,'abort não criou memória (B1 preservado)');
});

ok('B2-47: vitória limpa o estado run-scoped (e não vira memória)',()=>{
  T.activateSlot(1);clearAllSlots();
  T.setEchoQueue(stdQueue());
  bootRun('vector');
  setFrac(424242,'cinza');
  T.pr15MemBeginRun(T.getEchoQueue());
  runWaves(MAXW);
  assert.ok(snap().consumed.length>0,'houve consumo');
  const filaAntes=JSON.stringify(qnow());
  X('onVictory()');
  assert.ok(noState(),'estado descartado na vitória');
  assert.strictEqual(JSON.stringify(qnow()),filaAntes,'vitória não entrou em N-1/N-2');
  /* descriptors pendentes nunca viram memória */
  T.setEchoQueue(stdQueue());
  startPlan(stdQueue(),999);
  assert.ok(snap().scheduled.length>0,'há pendências');
  X('onVictory()');
  assert.ok(noState(),'pendências descartadas');
  assert.strictEqual(qnow().length,2,'fila inalterada');
});

ok('B2-48: morte limpa o estado antigo da run (nada vaza para a próxima)',()=>{
  T.activateSlot(1);clearAllSlots();
  T.setEchoQueue([]);
  bootRun('vector');
  setFrac(424242,'cinza');
  T.pr15MemBeginRun(T.getEchoQueue());
  T.setEchoQueue(stdQueue());
  T.pr15MemBeginRun(T.getEchoQueue());
  runWaves(MAXW);
  assert.ok(snap().consumed.length>0,'run teve consumo');
  X('kills=60;wave=6;runTime=300');
  padRec(60);
  X('pr15NoteDamage("enemy")');
  T.setState('play');
  X('onPlayerDeath()');
  assert.ok(noState(),'estado run-scoped morre com a run');
  const s=snap();
  assert.strictEqual(s.active,false,'sem estado ativo');
  assert.deepStrictEqual(s.consumed,[],'nenhum consumo pendurado');
  assert.deepStrictEqual(s.used,[],'nenhum used pendurado');
});

ok('B2-49: a nova morte válida continua sendo responsabilidade exclusiva do B1',()=>{
  T.activateSlot(1);clearAllSlots();
  T.setEchoQueue([]);
  bootRun('vector');
  setFrac(424242,'cinza');
  T.pr15MemBeginRun(T.getEchoQueue());
  X('kills=60;wave=6;runTime=300');
  padRec(60);
  X('pr15NoteDamage("boss")');
  T.setState('play');
  X('onPlayerDeath()');
  const q=qnow();
  assert.strictEqual(q.length,1,'B1 criou a memória');
  assert.ok(/^e1-\d+$/.test(q[0].id),'id v3 do B1: '+q[0].id);
  assert.strictEqual(q[0].cause,'boss','causa do B1');
  assert.ok(Array.isArray(q[0].trail)&&q[0].trail.length>=60,'trail do B1');
  assert.ok(noState(),'B2 não criou estado na morte');
  /* na próxima run o B2 usa o histórico atualizado pelo B1 */
  const st=startPlan(qnow(),11111);
  assert.ok(st,'B2 planeja a próxima run');
  assert.ok(st.enc.length>0,'há plano com a memória nova');
  for(const e of st.enc)assert.strictEqual(e.mem,q[0].id,'B2 usa a memória criada pelo B1');
});

/* ============ 50-54. REGRESSÕES DE SISTEMAS EXISTENTES ============ */
ok('B2-50: Echo legado (v2) continua carregando e lutando normalmente',()=>{
  const san=XJ('JSON.stringify(pr15SanitizeRecord('+JSON.stringify(fileV2(1))+'))');
  const e=echoInfo(san,1);
  assert.strictEqual(e.ok,true,'makeEcho aceita o registro legado'+(e.msg?' ('+e.msg+')':''));
  assert.strictEqual(e.slot,1,'slot');
  assert.strictEqual(e.trail,30,'trail completa ('+e.trail+')');
  assert.ok(typeof e.dom==='string'&&e.dom,'dom moral preservado ('+e.dom+')');
  assert.ok(e.maxHp>0&&e.hp>0,'HP derivado');
  assert.ok(e.trust>=0&&e.trust<=100,'confiança em faixa ('+e.trust+')');
  assert.strictEqual(T.pr15MemIsEligible(fileV2(2)),false,'v2 inelegível para o B2');
});

ok('B2-51: a trail continua preservada (replay do Eco intacto)',()=>{
  const v2=fileV2(3);
  const antes=JSON.stringify(v2.trail);
  T.setEchoQueue([v2]);
  startPlan([v2],555);                          // o B2 lê, não escreve
  runWaves(MAXW);
  assert.strictEqual(JSON.stringify(qnow()[0].trail),antes,'trail inalterada pelo B2');
  assert.strictEqual(echoInfo(XJ('JSON.stringify(pr15SanitizeRecord('+
    JSON.stringify(qnow()[0])+'))'),1).trail,30,'Eco recebe a trail completa');
  assert.ok(JSON.stringify(startPlan(stdQueue(),556).enc).indexOf('trail')<0,
    'descriptor sem trail');
});

ok('B2-52: personalidade existente não regressa',()=>{
  /* no formato real `ps` é o OBJETO de personalidade (PERSONALITIES[id]);
     `ps:null` (arquivo v2) é derivado na carga. Verificamos os dois. */
  const pers=XJ('JSON.stringify(Object.keys(PERSONALITIES))');
  assert.ok(pers.indexOf('precise')>=0,'personalidade existe no catálogo');
  const psReal=XJ('JSON.stringify(PERSONALITIES.precise)');
  const rec=mem('e1-9',{ps:psReal});
  T.setEchoQueue([rec]);
  startPlan([rec],557);runWaves(MAXW);
  assert.strictEqual(qnow()[0].ps.id,'precise','ps preservado na fila pelo B2');
  const san=XJ('JSON.stringify(pr15SanitizeRecord('+JSON.stringify(qnow()[0])+'))');
  assert.ok(san.ps&&san.ps.id==='precise','B1 preserva o objeto de personalidade');
  const e=echoInfo(san,1);
  assert.strictEqual(e.ok,true,'makeEcho ok'+(e.msg?' ('+e.msg+')':''));
  assert.strictEqual(e.pers,'precise','personalidade resolvida: '+e.pers);
  /* caminho legado: ps ausente continua sendo aceito */
  const leg=XJ('JSON.stringify(pr15SanitizeRecord('+JSON.stringify(fileV2(9))+'))');
  assert.strictEqual(echoInfo(leg,1).ok,true,'Eco sem ps continua sendo criado');
  assert.ok(!/PERSONALITIES|personality/i.test(B2CODE),
    'bloco B2 não lê personalidade para decidir');
});

ok('B2-53: relação e Dissonância não regressam',()=>{
  T.activateSlot(1);clearAllSlots();
  T.setEchoQueue(stdQueue());
  bootRun('vector');
  setFrac(424242,'cinza');
  const leitura='JSON.stringify(echoes.map(function(e){return {t:Math.round((e.trust||0)*100),'+
    'r:e.rel?JSON.stringify(e.rel):null,d:e.dis?JSON.stringify(e.dis):null};}))';
  const antes=XJ(leitura);
  T.pr15MemBeginRun(T.getEchoQueue());
  runWaves(MAXW);
  const depois=XJ(leitura);
  assert.strictEqual(JSON.stringify(depois),JSON.stringify(antes),
    'B2 não altera confiança/relação/Dissonância');
  assert.ok(!/enterDissonance|endDissonance|relPackEcho|disPackEcho/.test(B2CODE),
    'bloco B2 não mexe em relação/Dissonância');
});

ok('B2-54: equipamento de Echo não regressa',()=>{
  T.activateSlot(1);clearAllSlots();
  T.setEchoQueue(stdQueue());
  bootRun('vector');
  setFrac(424242,'cinza');
  const antes=XJ('JSON.stringify((typeof fracRun!=="undefined"&&fracRun&&fracRun.eq)?fracRun.eq:null)');
  T.pr15MemBeginRun(T.getEchoQueue());
  runWaves(MAXW);
  const depois=XJ('JSON.stringify((typeof fracRun!=="undefined"&&fracRun&&fracRun.eq)?fracRun.eq:null)');
  assert.strictEqual(JSON.stringify(depois),JSON.stringify(antes),
    'B2 não altera equipamento de Eco');
  assert.ok(!/echoEqInit|echoEqRefresh|ECHO_EQUIP/.test(B2CODE),'bloco B2 não toca equipamento');
});

/* ============ 55-57. SAVE / MIGRAÇÃO ============ */
ok('B2-55: save antigo SEM memoryDirector carrega com inicialização segura',()=>{
  const semEstado=[null,undefined,{},{v:1,wave:5},{v:1,fracture:{},presence:{}},
    {pr15mem:null},{pr15mem:undefined},{pr15mem:0},{pr15mem:'x'},{pr15mem:[]},
    {pr15mem:true},{pr15mem:NaN}];
  for(const cp of semEstado){
    const r=T.pr15MemUnpack(cp);
    assert.ok(isNull(r),'ausência ⇒ sem estado: '+JSON.stringify(cp));
    assert.ok(noState(),'nada inventado para '+JSON.stringify(cp));
  }
  /* chave presente mas vazia ⇒ estado seguro e vazio */
  for(const cp of [{pr15mem:{}},{pr15mem:{v:1}},{pr15mem:{enc:null}}]){
    const r=T.pr15MemUnpack(cp);
    assert.ok(!isNull(r),'estado seguro criado para '+JSON.stringify(cp));
    assert.deepStrictEqual(stEnc(),[],'sem descriptors para '+JSON.stringify(cp));
    assert.strictEqual(stNow().count,0);
  }
  T.setEchoQueue(stdQueue());
  const antes=JSON.stringify(qnow());
  T.pr15MemUnpack(null);
  assert.strictEqual(JSON.stringify(qnow()),antes,'echoQueue intacto');
});

ok('B2-56: save PARCIAL / corrompido do B2 carrega sem quebrar o Continue',()=>{
  const ref=JSON.stringify(startPlan(stdQueue(),31415).enc);
  const hostis=[
    {v:1,key:'s1:1',enc:'nao-e-array'},
    {v:1,key:'s1:1',enc:[null,1,'x',[],{}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4'}]},
    {v:1,key:'s1:1',enc:[{mem:'e1-1'}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',wave:-5}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',wave:1e9}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',wave:NaN}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',seed:NaN}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',seed:Infinity}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',st:'explodiu'}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',src:'n7'}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',res:'roxo'}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',shift:999}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',intent:NaN}]},
    {v:1,key:'s1:1',enc:[{id:'x'.repeat(200),mem:'e1-1'}]},
    {v:1,key:'s1:1',enc:[{id:'p1-a-w4',mem:'y'.repeat(200)}]},
    {v:1,key:9999,slot:77,seed:'abc',used:'x',waveDone:-3,lastWave:1e9,count:NaN},
    {v:1,key:'s1:1',used:[null,1,'e1-1','e1-1'],count:99},
    {v:'x',key:'s1:1',enc:[{id:'p1-a-w4',mem:'e1-1',wave:'7'}]}
  ];
  for(const h of hostis){
    const r=T.pr15MemUnpack({pr15mem:h});            // não pode lançar
    assert.ok(!isNull(r),'estado criado para '+JSON.stringify(h).slice(0,64));
    const st=stNow();
    assert.ok(Array.isArray(st.enc),'enc é array');
    assert.ok(st.enc.length<=(CFG.maxEncounters*2),'enc limitado');
    for(const e of st.enc){
      assert.ok(typeof e.id==='string'&&e.id.length<=32,'id sane');
      assert.ok(typeof e.mem==='string'&&e.mem.length<=32,'mem sane');
      assert.ok(Number.isInteger(e.wave)&&e.wave>=0&&e.wave<=MAXW,'wave sane: '+e.wave);
      assert.ok(Number.isInteger(e.base)&&e.base>=0&&e.base<=MAXW,'base sane: '+e.base);
      assert.ok(Number.isInteger(e.shift)&&e.shift>=0&&e.shift<=CFG.conflictShiftMax,'shift sane');
      assert.ok(Number.isFinite(e.seed)&&e.seed>=0,'seed finita');
      assert.ok(['scheduled','consumed','skipped'].indexOf(e.st)>=0,'st sane: '+e.st);
      assert.ok(['n1','n2'].indexOf(e.src)>=0,'src sane: '+e.src);
      assert.ok(['high','normal','unstable'].indexOf(e.res)>=0,'res sane: '+e.res);
      assert.ok(Number.isInteger(e.intent)&&e.intent>=0&&e.intent<100000,'intent sane');
      assert.ok(Number.isInteger(e.at)&&e.at>=0&&e.at<=MAXW,'at sane: '+e.at);
    }
    for(const f of ['slot','seed','waveDone','lastWave','count'])
      assert.ok(Number.isFinite(st[f]),'estado.'+f+' finito: '+st[f]);
    runWaves(MAXW);
    assert.ok(stNow(),'estado utilizável após carga hostil');
  }
  assert.strictEqual(JSON.stringify(startPlan(stdQueue(),31415).enc),ref,'plano bom reproduzível');
});

ok('B2-57: sanitização evita NaN/Infinity em todo o estado persistido',()=>{
  const casos=[{wave:NaN},{wave:Infinity},{wave:-Infinity},{wave:'7'},{wave:null},{wave:{}},
    {seed:NaN},{seed:Infinity},{seed:'x'},{seed:null},{shift:NaN},{shift:Infinity},
    {at:NaN},{at:Infinity},{intent:NaN},{intent:Infinity},{base:NaN},{base:Infinity}];
  for(const c of casos){
    const e=sanEnc(Object.assign({id:'p1-a-w4',mem:'e1-1'},c));
    assert.ok(e,'sanitizado: '+JSON.stringify(c));
    for(const k of ['wave','base','shift','at','intent'])
      assert.ok(Number.isFinite(e[k]),k+' finito para '+JSON.stringify(c)+': '+e[k]);
    assert.ok(Number.isFinite(e.seed),'seed finita para '+JSON.stringify(c));
    assert.ok(!/NaN|Infinity/.test(JSON.stringify(e)),'sem NaN/Infinity em '+JSON.stringify(e));
  }
  T.pr15MemUnpack({pr15mem:{v:1,enc:[{id:'p1-a-w4',mem:'e1-1',wave:NaN,seed:NaN}],
    count:NaN,waveDone:NaN,lastWave:NaN,used:NaN,slot:NaN,seed:NaN}});
  const p=JSON.stringify(pack());
  assert.ok(!/NaN|Infinity/.test(p),'pack sem NaN/Infinity: '+p);
  assert.ok(JSON.parse(p),'JSON round-trip ok');
});

/* ============ 58-59. COMPACTAÇÃO ============ */
ok('B2-58: o descriptor NÃO copia a trail',()=>{
  const q=[mem('e1-1',{trail:Array.from({length:400},(_,i)=>[i*.25,100+i,200+i,1,0,0])})];
  const enc=startPlan(q,6161).enc;
  const txt=JSON.stringify(enc);
  assert.ok(txt.indexOf('trail')<0,'sem campo trail');
  assert.ok(txt.length<2000,'descriptor pequeno ('+txt.length+' bytes p/ '+enc.length+')');
  const p=JSON.stringify(pack());
  assert.ok(p.length<4000,'estado persistido pequeno ('+p.length+' bytes)');
  /* e a memória original continua com a trail toda */
  assert.strictEqual(qnow()[0].trail.length,400,'trail da memória intacta');
});

ok('B2-59: o descriptor NÃO copia player state, inimigos, projéteis ou itemState',()=>{
  const enc=startPlan(stdQueue(),7171).enc;
  const txt=JSON.stringify(enc)+JSON.stringify(pack());
  for(const bad of ['trail','player','hp','maxHp','shield','coins','xp','level','items',
    'upg','owned','itemState','enemies','projectiles','frame','hooks','fracRun',
    'relationship','dis','rel','sigItems','arch','moral','ps','charId','wi','mh'])
    assert.ok(txt.indexOf('"'+bad+'"')<0,'campo indevido no estado B2: '+bad);
  for(const e of enc)
    for(const k in e)
      assert.ok(typeof e[k]==='string'||typeof e[k]==='number','campo escalar: '+k);
  const st=stNow();
  for(const k of ['v','slot','seed','waveDone','lastWave','count'])
    assert.strictEqual(typeof st[k],'number','campo escalar do estado: '+k);
  assert.strictEqual(typeof st.key,'string','key é string');
  assert.ok(Array.isArray(st.enc)&&Array.isArray(st.used),'enc/used são arrays');
});

/* ============ 60. NENHUMA ENTIDADE FÍSICA ============ */
ok('B2-60: nenhuma entidade temporal física foi criada no B2',()=>{
  const proibidos=[
    ['spawn de inimigo',/spawnEnemy|enemies\.push|spawnMiniBoss|spawnBoss/],
    ['spawn de eco/ator',/makeEcho|echoes\.push|spawnEcho|spawnTemporal|spawnMemory/],
    ['projétil',/projectiles\.push|fireWeapon|fireMelee|fireBeam/],
    ['renderização',/ctx\.|drawImage|fillRect|beginPath|drawEnemy|drawEcho|drawBoss/],
    ['colisão',/collide|hitTest|Math\.hypot/],
    ['dano',/damagePlayer|damageEnemy|applyDamage|killPlayer/],
    ['recompensa/economia',/addCoins|grantItem|grantModule|giveItem|metaVictory/],
    ['partículas/efeito',/spawnParticles|spawnRing|spawnShards|ftext|banner\(|sfx\(/],
    ['diálogo/fala',/speech|echoSpeak|ECHO_LINES|bubble/],
    ['HUD/UI nova',/innerHTML|createElement|appendChild|getElementById/],
    ['RNG global',/Math\.random/]
  ];
  for(const [nome,re] of proibidos)
    assert.ok(!re.test(B2CODE),'bloco B2 não contém '+nome+' ('+re+')');
  T.activateSlot(1);clearAllSlots();
  T.setEchoQueue(stdQueue());
  bootRun('vector');
  setFrac(424242,'cinza');
  T.pr15MemBeginRun(T.getEchoQueue());
  const enAntes=XJ('JSON.stringify(enemies.length)');
  const ecAntes=XJ('JSON.stringify(echoes.length)');
  const prAntes=XJ('JSON.stringify(projectiles.length)');
  runWaves(MAXW);
  assert.ok(snap().consumed.length>0,'o Director chegou a consumir');
  assert.strictEqual(XJ('JSON.stringify(enemies.length)'),enAntes,'nenhum inimigo criado');
  assert.strictEqual(XJ('JSON.stringify(echoes.length)'),ecAntes,'nenhum Eco criado');
  assert.strictEqual(XJ('JSON.stringify(projectiles.length)'),prAntes,'nenhum projétil criado');
  assert.strictEqual(X('typeof temporalEcho'),'undefined','sem entidade temporal');
  assert.strictEqual(X('typeof memoryEcho'),'undefined','sem memoryEcho');
  assert.strictEqual(X('typeof temporalMemoryEntity'),'undefined','sem temporalMemoryEntity');
  assert.strictEqual(XJ('JSON.stringify(beacon===null||typeof beacon==="undefined"?1:0)'),1,
    'nenhum beacon criado pelo B2');
});

/* =====================================================================
   SIMULAÇÃO A — DISTRIBUIÇÃO (10.000 runs, N-1 e N-2 elegíveis)
   ===================================================================== */
ok('SIM-A: distribuição em 10.000 runs — peso 75/25, média e ondas',()=>{
  const N=10000;
  let n1=0,n2=0,enc=0;
  const byCount={},byWave={},byRes={high:0,normal:0,unstable:0};
  for(let s=1;s<=N;s++){
    const st=startPlan(stdQueue(),(s*2654435761)%4294967291);
    byCount[st.enc.length]=(byCount[st.enc.length]||0)+1;
    for(const e of st.enc){
      enc++;
      if(e.src==='n1')n1++;else n2++;
      byWave[e.base]=(byWave[e.base]||0)+1;
      byRes[e.res]=(byRes[e.res]||0)+1;
    }
  }
  const p1=n1/enc,p2=n2/enc;
  console.log('      SIM-A: '+enc+' oportunidades · N-1 '+(100*p1).toFixed(2)+
    '% · N-2 '+(100*p2).toFixed(2)+'% · média '+(enc/N).toFixed(3));
  console.log('      por nº: '+JSON.stringify(byCount)+' · por onda: '+JSON.stringify(byWave));
  console.log('      ressonância: '+JSON.stringify(byRes));
  assert.ok(Math.abs(p1-CFG.n1Chance)<0.02,'N-1 ≈ '+(100*CFG.n1Chance)+'% (real '+(100*p1).toFixed(2)+'%)');
  assert.ok(Math.abs(p2-(1-CFG.n1Chance))<0.02,'N-2 ≈ '+(100*(1-CFG.n1Chance))+'%');
  assert.strictEqual(byCount[0]||0,0,'nunca 0 oportunidades com memória elegível');
  assert.ok(enc/N>=1&&enc/N<=CFG.maxEncounters,'média dentro de 1..'+CFG.maxEncounters);
  for(const w in byWave)assert.ok(+w>=CFG.firstWave,'nenhuma onda < firstWave');
  assert.ok(Object.keys(byWave).length<=CFG.maxEncounters,'até '+CFG.maxEncounters+' ondas distintas');
  assert.ok(byRes.high>0&&byRes.normal>0&&byRes.unstable>0,'as 3 ressonâncias ocorrem');
});

/* =====================================================================
   SIMULAÇÃO B — CADÊNCIA por duração de run
   ===================================================================== */
ok('SIM-B: cadência — runs de 3, 5, 10, 15 e 20 ondas sem spam',()=>{
  const duracoes=[3,5,10,15,20,MAXW];
  const resumo={};
  for(const dur of duracoes){
    let enc=0,antes=0,viosCool=0,viosMax=0,runs=0;
    for(let s=1;s<=600;s++){
      startPlan(stdQueue(),s*7+dur);
      runWaves(Math.min(dur,MAXW));
      const sn=snap();
      runs++;enc+=sn.consumed.length;
      const at=sn.consumed.map(e=>e.at|0).sort((a,b)=>a-b);
      for(const w of at)if(w<CFG.firstWave)antes++;
      for(let i=1;i<at.length;i++)if(at[i]-at[i-1]<CFG.cooldownWaves)viosCool++;
      if(sn.consumed.length>CFG.maxEncounters)viosMax++;
    }
    resumo[dur]=(enc/runs).toFixed(2);
    assert.strictEqual(antes,0,'run de '+dur+' ondas: nenhuma antes da firstWave');
    assert.strictEqual(viosCool,0,'run de '+dur+' ondas: cooldown respeitado');
    assert.strictEqual(viosMax,0,'run de '+dur+' ondas: teto respeitado');
    assert.ok(enc/runs<=CFG.maxEncounters,'sem spam na run de '+dur+' ondas');
  }
  console.log('      SIM-B: oportunidades/run por duração '+JSON.stringify(resumo));
  startPlan(stdQueue(),99);runWaves(3);
  assert.strictEqual(snap().consumed.length,0,'run de 3 ondas não tem oportunidade');
  assert.ok(parseFloat(resumo[20])>parseFloat(resumo[3]),'run longa tem mais oportunidades');
});

/* =====================================================================
   SIMULAÇÃO C — CONTINUE (comparação lógica campo a campo)
   ===================================================================== */
ok('SIM-C: Continue preserva mem/src/wave/seed/res/status em 800 seeds',()=>{
  const campos=['mem','src','wave','seed','res','id','base','intent'];
  let comparados=0;
  for(let s=1;s<=800;s++){
    const seed=(s*48271)%2147483647;
    const stop=(s%12)+1;
    startPlan(stdQueue(),seed);
    runWaves(stop);
    const antes=pack();
    const serializado=JSON.stringify(antes);
    T.setPr15MemRun(null);
    T.pr15MemUnpack({pr15mem:JSON.parse(serializado)});
    const meio=pack();
    for(let i=0;i<antes.enc.length;i++){
      for(const c of campos)
        assert.strictEqual(meio.enc[i][c],antes.enc[i][c],
          'campo '+c+' divergiu no load (seed '+seed+')');
      assert.strictEqual(meio.enc[i].st,antes.enc[i].st,'status divergiu (seed '+seed+')');
      comparados++;
    }
    assert.strictEqual(meio.count,antes.count,'count divergiu');
    assert.strictEqual(meio.waveDone,antes.waveDone,'waveDone divergiu');
    runWaves(MAXW,stop+1);
    const fim=pack();
    assert.strictEqual(fim.enc.length,antes.enc.length,'sem duplicação (seed '+seed+')');
    for(let i=0;i<antes.enc.length;i++)
      for(const c of campos)
        assert.strictEqual(fim.enc[i][c],antes.enc[i][c],
          'campo '+c+' rerrolado após Continue (seed '+seed+')');
  }
  assert.ok(comparados>800,'comparações suficientes ('+comparados+')');
  console.log('      SIM-C: '+comparados+' descriptors comparados campo a campo · 0 divergências');
});

/* =====================================================================
   SIMULAÇÃO D — CONFLITOS
   ===================================================================== */
ok('SIM-D: conflitos — shift determinístico, limitado e sem tocar scheduler externo',()=>{
  let consumidas=0,skipadas=0,adiadas=0;
  /* --- passagem 1: conflito ESPARSO (1/3 das ondas) --- */
  for(let s=1;s<=500;s++){
    startPlan(stdQueue(),s*3571);
    clearConflict();
    const ocupadas=new Set();
    for(let w=1;w<=MAXW;w++)if(((s*31+w*17)%3)===0)ocupadas.add(w);
    for(let w=1;w<=MAXW;w++){
      if(ocupadas.has(w)){busyDecision(w);busyPresence(w);}else clearConflict();
      T.pr15MemOnWave(w);
    }
    const sn=snap();
    for(const e of sn.consumed){
      consumidas++;
      assert.ok(!ocupadas.has(e.at),'não consumiu em onda ocupada ('+e.at+')');
    }
    skipadas+=sn.skipped.length;
    adiadas+=sn.scheduled.length;
    const esperado=JSON.stringify(sn);
    startPlan(stdQueue(),s*3571);clearConflict();
    for(let w=1;w<=MAXW;w++){
      if(ocupadas.has(w)){busyDecision(w);busyPresence(w);}else clearConflict();
      T.pr15MemOnWave(w);
    }
    assert.strictEqual(JSON.stringify(snap()),esperado,'conflitos determinísticos (seed '+s+')');
  }
  assert.ok(consumidas>0,'há consumo mesmo com conflitos esparsos');
  /* --- passagem 2: conflito DENSO (janela inteira bloqueada) --- */
  let skipDenso=0;
  for(let s=1;s<=300;s++){
    startPlan(stdQueue(),s*6151);
    clearConflict();
    for(let w=1;w<=MAXW;w++){busyDecision(w);busyPresence(w);T.pr15MemOnWave(w);}
    const sn=snap();
    skipDenso+=sn.skipped.length;
    assert.strictEqual(sn.consumed.length,0,'nada consumido com tudo bloqueado');
    for(const e of sn.skipped)
      assert.ok(e.shift<=CFG.conflictShiftMax,'shift limitado ('+e.shift+')');
  }
  clearConflict();
  assert.ok(skipDenso>0,'skip por conflito denso exercitado ('+skipDenso+')');
  console.log('      SIM-D: consumidas '+consumidas+' · pendentes '+adiadas+
    ' · skipped(esparso) '+skipadas+' · skipped(denso) '+skipDenso);
  /* nenhum scheduler externo foi modificado: o Diretor só LÊ */
  assert.ok(!/factionPresenceSchedule|scheduleBeacon|fractureEmit/.test(B2CODE),
    'bloco B2 não chama schedulers externos');
  assert.ok(!/evMem\.[a-zA-Z]+\s*=[^=]/.test(B2CODE),'não escreve em evMem');
  assert.ok(!/fractureRun\.[a-zA-Z.]+\s*=[^=]/.test(B2CODE),'não escreve em fractureRun');
  assert.ok(!/factionPresenceRun\.[a-zA-Z.]+\s*=[^=]/.test(B2CODE),'não escreve em factionPresenceRun');
  assert.ok(!/(^|[^.\w])beacon\s*=[^=]/.test(B2CODE),'não escreve em beacon');
});

/* =====================================================================
   SIMULAÇÃO E — FUZZ DE SAVE (2.000 estados hostis)
   ===================================================================== */
ok('SIM-E: fuzz de save — 2.000 estados hostis não explodem load nem tocam a fila',()=>{
  T.setEchoQueue(stdQueue());
  const filaAntes=JSON.stringify(qnow());
  const slotAntes=JSON.stringify(root().slots[1]?root().slots[1].echoes:null);
  const tipos=[null,undefined,0,1,-1,NaN,Infinity,'','x',[],{},true,false,'sym'];
  const status=['scheduled','consumed','skipped','x','',null,0,NaN];
  const res=['high','normal','unstable','x','',null,NaN];
  let n=0,criados=0;
  for(let i=0;i<2000;i++){
    const P=a=>a[i%a.length];
    const enc=[];
    const k=i%5;
    for(let j=0;j<k;j++){
      enc.push({
        id:(i%7===0)?P(tipos):('p1-'+i+'-'+j),
        mem:(i%11===0)?P(tipos):('e1-'+((i%3)+1)),
        wave:(i%13===0)?P(tipos):((i%40)-5),
        base:(i%17===0)?P(tipos):((i%40)-5),
        seed:(i%19===0)?P(tipos):((i*2654435761)%4294967296),
        st:(i%23===0)?P(tipos):P(status),
        res:(i%29===0)?P(tipos):P(res),
        shift:(i%31===0)?P(tipos):(i%9),
        at:(i%37===0)?P(tipos):((i%25)-2),
        intent:(i%41===0)?P(tipos):(i%200000),
        why:(i%43===0)?P(tipos):('motivo'+i)
      });
    }
    const hostil=(i%3===0)?P(tipos):{
      v:(i%5===0)?P(tipos):1,
      key:(i%7===0)?P(tipos):('s1:'+i),
      slot:(i%11===0)?P(tipos):((i%5)-1),
      seed:(i%13===0)?P(tipos):(i*999),
      enc:enc,
      used:(i%17===0)?P(tipos):[null,1,'e1-1'],
      waveDone:(i%19===0)?P(tipos):((i%30)-3),
      lastWave:(i%23===0)?P(tipos):((i%30)-3),
      count:(i%29===0)?P(tipos):(i%7)
    };
    let st=null;
    try{st=T.pr15MemUnpack({pr15mem:hostil});}
    catch(err){assert.fail('load explodiu no caso '+i+': '+err.message);}
    n++;
    if(!isNull(st)){
      criados++;
      const s=stNow();
      assert.ok(Array.isArray(s.enc),'enc array no caso '+i);
      assert.ok(s.enc.length<=(CFG.maxEncounters*2),'enc limitado no caso '+i);
      for(const e of s.enc){
        for(const f of ['wave','base','shift','at','intent','seed'])
          assert.ok(Number.isFinite(e[f]),f+' finito no caso '+i+': '+e[f]);
        assert.ok(['scheduled','consumed','skipped'].indexOf(e.st)>=0,'st sane no caso '+i);
        assert.ok(['n1','n2'].indexOf(e.src)>=0,'src sane no caso '+i);
        assert.ok(['high','normal','unstable'].indexOf(e.res)>=0,'res sane no caso '+i);
      }
      for(const f of ['slot','seed','waveDone','lastWave','count'])
        assert.ok(Number.isFinite(s[f]),'estado.'+f+' finito no caso '+i+': '+s[f]);
      const p=JSON.stringify(pack());
      assert.ok(!/NaN|Infinity/.test(p),'pack sem NaN no caso '+i);
      T.pr15MemUnpack({pr15mem:JSON.parse(p)});
      runWaves(MAXW);
      assert.ok(stNow(),'Continue funcional no caso '+i);
    }
  }
  assert.strictEqual(n,2000,'2.000 casos executados');
  assert.strictEqual(JSON.stringify(qnow()),filaAntes,'echoQueue intacto após o fuzz');
  assert.strictEqual(JSON.stringify(root().slots[1]?root().slots[1].echoes:null),slotAntes,
    'slot intacto após o fuzz');
  console.log('      SIM-E: '+n+' estados hostis · '+criados+' estados criados · 0 exceções');
});

console.log('');
if(failed){console.log('FALHAS ('+failed+')');process.exit(1);}
console.log('B2 — '+passed+' PASSARAM · 0 FALHAS');
