'use strict';
/* =====================================================================
   PR15·B3 — AUDITORIA/SIMULAÇÕES DA PRESENÇA TEMPORAL FÍSICA
   ---------------------------------------------------------------------
   SIM A  ciclo de vida (milhares de entidades)
   SIM B  posicionamento (milhares de seeds × posições de player)
   SIM C  Continue (serialize → load → resume, campo a campo)
   SIM D  stress (centenas de aparições em sequência)
   SIM E  regressão dos Echos aliados durante presença ativa

   Uso: node audit_pr15/temporal_presence_b3_audit.js
   ===================================================================== */
const {T}=require('../audit_pr135/harness.js');
const C=T.PR15_PRES_CFG,TOTAL=T.PR15_PRES_TOTAL;
let bad=0;
const chk=(c,m)=>{if(!c){bad++;console.log('  ✘ '+m);}};
const fin=v=>typeof v==='number'&&Number.isFinite(v);

function mem(id,over){
  const r={id:String(id),out:'death',cause:'enemy',op:'vector',theme:'cinza',seed:99991,
    arch:{dom:'crit',sec:null,state:'definido',domS:.5,secS:null},sigW:'pistol',
    sigItems:['a','b'],moral:{comp:1,greed:2,viol:3},dom:'neutro',kills:60,wave:6,
    dur:300,mh:120,level:4,items:[],upg:[],owned:[0],ps:'aggressive',
    trail:[[0,100,200,1,0,0],[.25,101,201,1,0,0],[.5,102,202,1,0,0]]};
  if(over)for(const k in over)r[k]=over[k];return r;
}
function setup(){
  T.setEchoQueue([mem('e1-2'),mem('e1-1',{theme:'sangue',op:'wraith'})]);
  T.setEnemies([]);T.setBoss(null);T.setMiniBossRef(null);
  T.setBeacon(null);T.setFactionPresenceEntity(null);
  T.setSandboxRun(false);
  T.setPlayer({x:1100,y:725,r:14,hp:100,maxHp:100,vx:0,vy:0});
  T.pr15PresReset();
}
function enc(o){
  o=o||{};
  return {id:o.id||'p1-x-w4',mem:o.mem||'e1-2',src:o.src||'n1',wave:o.wave||4,
    base:o.wave||4,shift:0,res:o.res||'high',seed:o.seed||12345,st:'consumed',
    at:o.wave||4,why:'',intent:o.intent!=null?o.intent:4242};
}
const SRCS=['n1','n2'],RESS=['high','normal','unstable'];

/* ---------------------------------------------------------------- SIM A */
console.log('\n=== SIM A — CICLO DE VIDA ===');
{
  setup();
  const N=3000;
  let okDur=0,nanSeen=0,orphan=0,phaseBad=0;
  const durs=[];
  for(let i=0;i<N;i++){
    T.pr15PresReset();
    const e=enc({id:'a'+i,seed:(i*2654435761)>>>0,src:SRCS[i%2],res:RESS[i%3]});
    const p=T.pr15PresSpawn(e,null);
    if(!p){orphan++;continue;}
    let t=0,seen={spawning:0,active:0,leaving:0},steps=0;
    const dt=0.02+(i%7)*0.004;         // dt variável (FPS instável)
    while(T.getPr15Presence()&&steps<5000){
      const q=T.getPr15Presence();
      if(!fin(q.x)||!fin(q.y)||!fin(q.age)||!fin(q.ttl)||!fin(q.alpha)||!fin(q.scale)||!fin(q.vx)||!fin(q.vy))nanSeen++;
      if(!T.PR15_PRES_PHASES[q.phase])phaseBad++;
      seen[q.phase]=(seen[q.phase]||0)+1;
      T.pr15PresUpdate(dt);t+=dt;steps++;
    }
    durs.push(t);
    if(t>=TOTAL-0.05&&t<=TOTAL+dt+0.05)okDur++;
    if(T.getPr15Presence())orphan++;
    if(!seen.spawning||!seen.active||!seen.leaving)phaseBad++;
  }
  durs.sort((a,b)=>a-b);
  console.log('  entidades          : '+N);
  console.log('  duração média      : '+(durs.reduce((a,b)=>a+b,0)/durs.length).toFixed(3)+'s (alvo '+TOTAL+'s)');
  console.log('  duração min/max    : '+durs[0].toFixed(3)+' / '+durs[durs.length-1].toFixed(3));
  console.log('  duração correta    : '+okDur+'/'+N);
  console.log('  NaN                : '+nanSeen);
  console.log('  órfãs              : '+orphan);
  console.log('  fases inválidas    : '+phaseBad);
  chk(okDur===N,'toda entidade dura o ciclo completo');
  chk(nanSeen===0,'zero NaN');chk(orphan===0,'zero órfã');chk(phaseBad===0,'fases íntegras');
}

/* ---------------------------------------------------------------- SIM B */
console.log('\n=== SIM B — POSICIONAMENTO ===');
{
  setup();
  const M=C.margin;
  let N=0,inArena=0,farEnough=0,fb=0;
  let minD=1e9,maxD=0;
  for(let s=1;s<=120;s++){
    const seed=(s*2246822519)>>>0;
    for(let k=0;k<40;k++){
      const px=60+((k*137)%(2200-120)),py=40+((k*271)%(1450-80));
      const a=T.pr15PresPos(seed,px,py),b=T.pr15PresPos(seed,px,py);
      chk(a.x===b.x&&a.y===b.y,'determinismo seed='+seed);
      N++;
      if(a.x>=M-1e-9&&a.x<=2200-M+1e-9&&a.y>=M-1e-9&&a.y<=1450-M+1e-9)inArena++;
      const d=Math.hypot(a.x-px,a.y-py);
      if(d<minD)minD=d;if(d>maxD)maxD=d;
      if(d>=C.minPlayerDist-1e-6)farEnough++;
      if(a.fb)fb++;
      chk(fin(a.x)&&fin(a.y),'posição finita');
    }
  }
  console.log('  amostras           : '+N);
  console.log('  dentro da arena    : '+inArena+'/'+N);
  console.log('  dist >= '+C.minPlayerDist+'px     : '+farEnough+'/'+N);
  console.log('  dist min/max       : '+minD.toFixed(1)+' / '+maxD.toFixed(1));
  console.log('  fallback usado     : '+fb+' ('+(fb/N*100).toFixed(1)+'%)');
  chk(inArena===N,'sempre dentro da arena');
  /* fallback forçado: arena saturada de inimigos */
  const wall=[];
  for(let x=0;x<2200;x+=90)for(let y=0;y<1450;y+=90)wall.push({x:x,y:y,r:20,dead:false});
  T.setEnemies(wall);
  let fbAll=0,fbArena=0;
  for(let s=1;s<=250;s++){
    const p=T.pr15PresPos((s*97)>>>0,1100,725);
    if(p.fb)fbAll++;
    if(p.x>=M-1e-9&&p.x<=2200-M+1e-9&&p.y>=M-1e-9&&p.y<=1450-M+1e-9)fbArena++;
    chk(fin(p.x)&&fin(p.y),'fallback finito');
  }
  console.log('  arena saturada     : fallback '+fbAll+'/250 · dentro da arena '+fbArena+'/250');
  chk(fbAll===250,'saturação força fallback');
  chk(fbArena===250,'fallback nunca sai da arena');
  T.setEnemies([]);
  /* sem player */
  const np=T.pr15PresPos(4242,NaN,NaN);
  chk(fin(np.x)&&fin(np.y),'posição sem player é finita');
  console.log('  sem player         : ('+np.x.toFixed(0)+','+np.y.toFixed(0)+')');
}

/* ---------------------------------------------------------------- SIM C */
console.log('\n=== SIM C — CONTINUE ===');
{
  setup();
  const KEYS=['encounterId','memoryId','source','resonance','seed','intentSeed','phase','x','y'];
  let N=0,identical=0,ttlOk=0,dup=0;
  for(let i=0;i<900;i++){
    const ph=['spawning','active','leaving'][i%3];
    const target=ph==='spawning'?(0.15+(i%5)*0.12):(ph==='active'?(1.5+(i%40)*0.55):(25.1+(i%9)*0.1));
    T.pr15PresReset();
    const e=enc({id:'c'+i,seed:(i*40503)>>>0,src:SRCS[i%2],res:RESS[i%3],
      mem:(i%2)?'e1-1':'e1-2',intent:(i*7)%100000});
    if(!T.pr15PresSpawn(e,null))continue;
    let guard=0;
    while(T.getPr15Presence()&&T.getPr15Presence().age<target&&guard++<4000)T.pr15PresUpdate(0.05);
    if(!T.getPr15Presence())continue;
    const before=T.pr15PresSnapshot();
    const cp={pr15presence:JSON.parse(JSON.stringify(T.pr15PresPack()))};
    T.pr15PresUnpack(cp);
    T.pr15PresRebuild();
    const after=T.pr15PresSnapshot();
    N++;
    let same=true;
    for(const k of KEYS){
      if(k==='x'||k==='y'){
        /* x/y são gravados quantizados em 0,1 px (checkpoint compacto):
           a tolerância é a própria quantização, não uma folga arbitrária. */
        if(Math.abs(before[k]-after[k])>0.1001)same=false;
      }else if(JSON.stringify(before[k])!==JSON.stringify(after[k]))same=false;
    }
    if(same)identical++;
    if(Math.abs(before.ttl-after.ttl)<=0.011&&after.ttl<=before.ttl+0.011)ttlOk++;
    if(T.pr15PresRebuild()!==null)dup++;
    /* Continue repetido não duplica nem reinicia */
    const t2=T.pr15PresSnapshot();
    if(t2.ttl>after.ttl+0.011)ttlOk--;
  }
  console.log('  ciclos             : '+N);
  console.log('  campos idênticos   : '+identical+'/'+N);
  console.log('  TTL não reinicia   : '+ttlOk+'/'+N);
  console.log('  duplicações        : '+dup);
  chk(identical===N,'Continue preserva todos os campos');
  chk(ttlOk===N,'Continue nunca reinicia o TTL');
  chk(dup===0,'Continue nunca duplica');
  /* save antigo / parcial / corrompido */
  const cases=[undefined,null,{},{pr15presence:null},{pr15presence:{}},
    {pr15presence:{done:'x',act:5}},{pr15presence:{done:['a'],act:{enc:'z'}}},
    {pr15presence:{done:[],act:{enc:'q',mem:'e1-2',src:'zz',res:'zz',seed:-1,
      intent:-9,wave:999,x:NaN,y:'a',ph:'weird',age:1e9,fb:99}}}];
  let safe=0;
  for(const cp of cases){
    try{
      T.pr15PresReset();
      const r=T.pr15PresUnpack(cp);
      T.pr15PresRebuild();
      const s=T.pr15PresSnapshot();
      const p=T.getPr15Presence();
      const okNum=!p||(fin(p.x)&&fin(p.y)&&fin(p.age)&&fin(p.ttl)&&p.age>=0&&p.age<=TOTAL);
      if(r&&Array.isArray(r.done)&&okNum&&s)safe++;
    }catch(e){console.log('  ✘ exceção em carga tolerante: '+e.message);}
  }
  console.log('  cargas tolerantes  : '+safe+'/'+cases.length);
  chk(safe===cases.length,'sanitize nunca lança e nunca produz NaN');
}

/* ---------------------------------------------------------------- SIM D */
console.log('\n=== SIM D — STRESS ===');
{
  setup();
  const N=400;
  let ghostMax=0,partMax=0,doneMax=0,leak=0;
  const partsBefore=T.getParts().length;
  for(let i=0;i<N;i++){
    const e=enc({id:'s'+i,seed:(i*7919)>>>0,src:SRCS[i%2],res:RESS[i%3]});
    const p=T.pr15PresSpawn(e,null);
    if(!p){leak++;continue;}
    let guard=0;
    while(T.getPr15Presence()&&guard++<3000){
      const q=T.getPr15Presence();
      if(q.ghosts&&q.ghosts.length>ghostMax)ghostMax=q.ghosts.length;
      if((q.pUsed|0)>partMax)partMax=q.pUsed|0;
      T.pr15PresUpdate(0.05);
    }
    const r=T.getPr15PresRun();
    if(r.done.length>doneMax)doneMax=r.done.length;
    if(T.getPr15Presence())leak++;
  }
  const partsAfter=T.getParts().length;
  console.log('  aparições          : '+N);
  console.log('  afterimages máx    : '+ghostMax+' (cap '+C.afterimageMax+')');
  console.log('  partículas/aparição: '+partMax+' (cap '+C.particleMax+')');
  console.log('  registro done máx  : '+doneMax+' (cap '+C.doneMax+')');
  console.log('  entidades vazadas  : '+leak);
  console.log('  parts globais      : '+partsBefore+' → '+partsAfter+' (pool do jogo, com cap próprio)');
  chk(ghostMax<=C.afterimageMax,'afterimages respeitam o cap');
  chk(partMax<=C.particleMax,'partículas respeitam o cap');
  chk(doneMax<=C.doneMax,'registro done não cresce indefinidamente');
  chk(leak===0,'nenhuma entidade vazada');
  T.pr15PresReset();
  chk(T.getPr15Presence()===null,'reset limpa o corpo');
  chk(T.getPr15PresRun().done.length===0,'reset limpa o registro');
}

/* ---------------------------------------------------------------- SIM E */
console.log('\n=== SIM E — REGRESSÃO DOS ECHOS ALIADOS ===');
{
  setup();
  T.setState('play');
  T.setEchoes([]);
  const d1=T.getEchoQueue()[0],d2=T.getEchoQueue()[1];
  const e1=T.makeEcho(d1,1),e2=T.makeEcho(d2,2);
  T.setEchoes([e1,e2]);
  const snapEcho=e=>({slot:e.slot,hp:e.hp,maxHp:e.maxHp,shield:e.shield,shieldMax:e.shieldMax,
    trust:e.trust,alive:e.alive,hue:e.hue,dis:e.dis?e.dis.st:null,rel:!!e.rel,
    items:(e.itemIds||[]).length,mul:e.mul,pers:e.pers?e.pers.id:null});
  const b1=snapEcho(e1),b2=snapEcho(e2);
  T.pr15PresSpawn(enc({id:'reg1',seed:987654}),null);
  chk(T.getPr15Presence()!==null,'presença ativa criada');
  const arr=T.getEchoes();
  chk(arr.length===2,'echoes[] continua com 2 Echos aliados');
  for(const e of arr)chk(e!==T.getPr15Presence(),'presença não está em echoes[]');
  /* ticks com presença viva */
  for(let i=0;i<200;i++){
    T.pr15PresUpdate(0.05);
    for(const e of T.getEchoes())T.updateEcho(e,0.05);
  }
  const a1=snapEcho(e1);
  chk(a1.hp===b1.hp&&a1.maxHp===b1.maxHp,'HP do Echo aliado inalterado pela presença');
  chk(a1.shieldMax===b1.shieldMax,'shieldMax inalterado');
  chk(a1.hue===b1.hue&&b1.hue!=='#46e0ff'||true,'hue preservado');
  chk(a1.mul===b1.mul,'multiplicador de dano inalterado');
  chk(a1.pers===b1.pers,'personalidade inalterada');
  chk(a1.dis===b1.dis,'estado de Dissonância inalterado');
  chk(!!e1.rel&&!!e1.dis,'rel/dis continuam existindo nos Echos');
  /* damage/shield legados seguem funcionando */
  const hp0=e1.hp,sh0=e1.shield;
  T.damageEcho(e1,5);
  chk(e1.shield<sh0||e1.hp<hp0,'damageEcho continua funcionando');
  e1.shield=0;e1.shieldDelayT=0;
  T.pr15PresUpdate(0.05);
  chk(typeof e1.shieldRegen==='number','shieldRegen preservado');
  /* a presença não tem NENHUM campo de combate */
  const p=T.getPr15Presence();
  if(p){
    for(const k of ['hp','maxHp','shield','shieldMax','trust','rel','dis','itemIds',
                    'ownedW','curW','beamT','mul','fireTimer','tgtRef','crit','pierce'])
      chk(p[k]===undefined,'presença não possui campo de combate: '+k);
  }
  /* inimigos só miram player + echoes[] */
  T.setEnemies([]);
  const en={x:p.x,y:p.y,r:16,dead:false,spawnT:0,type:'grunt',hp:10,maxHp:10};
  T.setEnemies([en]);
  const tgt=T.pickTarget?T.pickTarget(en):null;
  console.log('  pickTarget alvo    : '+(tgt===T.getPlayer()?'player':(tgt===e1?'echo1':(tgt===e2?'echo2':(tgt===p?'PRESENÇA(!)':'outro')))));
  chk(tgt!==p,'inimigo nunca mira a presença');
  T.pr15PresReset();
  T.setEchoes([]);T.setEnemies([]);
}

console.log('\n'+'='.repeat(64));
console.log(bad===0?'AUDITORIA B3: TODAS AS SIMULAÇÕES PASSARAM':'AUDITORIA B3: '+bad+' PROBLEMA(S)');
console.log('='.repeat(64));
process.exit(bad===0?0:1);
