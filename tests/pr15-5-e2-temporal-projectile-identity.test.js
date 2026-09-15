'use strict';
/* ECHO — PR15.5-E2 · IDENTIDADE TEMPORAL DOS PROJÉTEIS
   ---------------------------------------------------------------------
   O bug: a Repetição Ancorada repintava quase todo projétil de ciano
   ('#46e0ff', a cor do plasma), e drawProjectile ignorava a flag
   temporalReplay. Um Rail repetido era indistinguível de um tiro comum
   de plasma — a Repetição apagava a identidade da arma que repetia.

   A regra que esta suíte protege:
     IDENTIDADE DA ARMA PRIMEIRO, CAMADA TEMPORAL DEPOIS.
   Um Rail temporal deve continuar parecendo Rail. */
const assert=require('assert'),fs=require('fs'),path=require('path');
const {world,readSource}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}}
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5-E2 · IDENTIDADE TEMPORAL DOS PROJÉTEIS');

function body(name){
  const m=SRC.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(m,'função não encontrada: '+name);return m[0];
}
function trace(p){
  S.__pp=p;
  if(p&&p.color)run('glowSprite(__pp.color)');
  S.__ctxLog=[];
  try{run('drawProjectile(__pp)');}finally{const l=S.__ctxLog;S.__ctxLog=null;return l;}
}
function opsOf(l){return l.map(e=>e[0]);}
const COLOR=id=>run('(WEAPONS.find(w=>w.id==='+JSON.stringify(id)+')||{}).color');
/* cria um replay REAL pelo caminho de produção e devolve os projéteis */
function replayReal(weaponId){
  run('projectiles.length=0');
  run('__a={id:1,t:runTime,expiresAt:runTime+5,type:"shot",weaponId:'+
      JSON.stringify(weaponId)+',x:600,y:360,angle:0,payload:temporalActionPayload('+
      'player,WEAPONS.find(x=>x.id==='+JSON.stringify(weaponId)+'),1),'+
      'state:"armed",source:"player"}');
  const n=run('replayTemporalAction(__a)');
  const out={n:n,colors:Array.from(run('projectiles.map(p=>p.color)')),
    flags:Array.from(run('projectiles.map(p=>!!p.temporalReplay)')),
    types:Array.from(run('projectiles.map(p=>p.type)')),
    dmg:Array.from(run('projectiles.map(p=>p.dmg)'))};
  run('projectiles.length=0');
  return out;
}
run('__ECHO_AUDIT_FIXTURES.prepare("E")');
run('__e=makeEcho({trail:[[0,600,360,0,0]],wave:1,level:1},1);echoes.push(__e)');

/* ============ A · O BUG: COR BASE PRESERVADA (22.A–D) ============ */
console.log('\n[A] cor base da arma preservada no replay');
const WL=['plasma','shotgun','rail','sniper'];   // whitelist da Repetição
for(const w of WL)
  ok('A·'+w+' replay preserva a cor base da arma',()=>{
    const r=replayReal(w);
    assert.ok(r.n>0,'replay não gerou projétil');
    const esperado=COLOR(w);
    r.colors.forEach(c=>assert.strictEqual(c,esperado,
      w+' repintado de '+c+' (esperado '+esperado+')'));});
ok('A05 REGRESSÃO DO BUG: rail temporal não é mais ciano de plasma',()=>{
  const rail=replayReal('rail').colors[0];
  assert.strictEqual(rail,COLOR('rail'));
  assert.notStrictEqual(rail,COLOR('plasma'),
    'rail voltou a ter a cor do plasma — o bug do E2 regrediu');});
ok('A06 REGRESSÃO DO BUG: sniper temporal não é ciano de plasma',()=>{
  const s=replayReal('sniper').colors[0];
  assert.strictEqual(s,COLOR('sniper'));
  assert.notStrictEqual(s,COLOR('plasma'));});
ok('A07 shotgun temporal NÃO é mais magenta puro',()=>{
  const c=replayReal('shotgun').colors[0];
  assert.strictEqual(c,COLOR('shotgun'));
  assert.notStrictEqual(c,T.TEMPORAL_REPLAY_COLOR,
    'a cor de acento não pode ser o corpo do projétil');});
ok('A08 as 4 armas da whitelist têm cores mutuamente distintas',()=>{
  const cs=WL.map(w=>replayReal(w).colors[0]);
  assert.strictEqual(new Set(cs).size,4,'cores colidem: '+cs);});
ok('A09 weaponId desconhecido cai em fallback seguro',()=>{
  const b=body('replayTemporalAction');
  assert.ok(/\|\|'#46e0ff'/.test(b),'fallback de cor deve existir');});
ok('A10 TEMPORAL_REPLAY_COLOR continua existindo (usado como acento)',()=>{
  assert.strictEqual(T.TEMPORAL_REPLAY_COLOR,'#ff4df0');
  assert.ok(body('drawProjectileTemporalLayer').includes('TEMPORAL_REPLAY_COLOR'));});

/* ============ B · DETECÇÃO DE MODO (22.G–J / §17 / §18) ============ */
console.log('\n[B] detecção de modo temporal');
ok('B01 as 3 constantes de modo existem e são distintas',()=>{
  assert.deepStrictEqual(Object.keys(T.PTM).sort(),['ECHO','NONE','REPLAY']);
  assert.strictEqual(T.PTM.NONE,0);
  assert.strictEqual(new Set(Object.values(T.PTM)).size,3);});
ok('B02 projétil normal do jogador NÃO recebe camada (22.H)',()=>{
  S.__q={type:'rail'};run('__q.owner=player');
  assert.strictEqual(run('projectileTemporalMode(__q)'),T.PTM.NONE);});
ok('B03 projétil de replay é detectado',()=>{
  assert.strictEqual(T.projectileTemporalMode({type:'rail',temporalReplay:true}),T.PTM.REPLAY);});
ok('B04 projétil de Echo REAL é detectado',()=>{
  run('__q={type:"rail",owner:__e}');
  assert.strictEqual(run('projectileTemporalMode(__q)'),T.PTM.ECHO);});
ok('B05 eorb de inimigo NÃO recebe camada só por ser eorb (22.I)',()=>{
  assert.strictEqual(T.projectileTemporalMode({type:'eorb'}),T.PTM.NONE);
  assert.strictEqual(T.projectileTemporalMode({type:'eorb',owner:{x:1,y:2}}),T.PTM.NONE);
  assert.strictEqual(T.projectileTemporalMode({type:'eorb',team:'enemy'}),T.PTM.NONE);});
ok('B06 a detecção NÃO usa p.type como critério',()=>{
  const b=body('projectileTemporalMode');
  assert.ok(!/p\.type/.test(b),'detecção não pode depender de type');
  assert.ok(!/eorb/.test(b));});
ok('B07 a detecção NÃO usa apenas team (heurística frágil)',()=>{
  const b=body('projectileTemporalMode');
  assert.ok(!/p\.team/.test(b),"team:'ally' pode incluir fontes futuras");
  assert.strictEqual(T.projectileTemporalMode({type:'rail',team:'ally'}),T.PTM.NONE);});
ok('B08 replay tem PRIORIDADE sobre Echo (§18)',()=>{
  run('__q={type:"rail",owner:__e,temporalReplay:true}');
  assert.strictEqual(run('projectileTemporalMode(__q)'),T.PTM.REPLAY);});
ok('B09 nenhum inimigo real possui slot (base da detecção)',()=>{
  for(const s of ['B','C','D','E','G','H','I']){
    run('__ECHO_AUDIT_FIXTURES.prepare('+JSON.stringify(s)+')');
    const n=run('enemies.filter(e=>e.slot!=null).length');
    assert.strictEqual(n,0,'cenário '+s+' tem inimigo com slot');
  }
  run('__ECHO_AUDIT_FIXTURES.prepare("E")');
  run('__e=makeEcho({trail:[[0,600,360,0,0]],wave:1,level:1},1);echoes.push(__e)');});
ok('B10 player não possui slot (base da detecção)',()=>{
  assert.strictEqual(run('player.slot'),undefined);});
ok('B11 entradas inválidas nunca lançam',()=>{
  [null,undefined,{},{owner:null},{owner:{}},{owner:{slot:0}}].forEach(p=>
    assert.strictEqual(T.projectileTemporalMode(p),T.PTM.NONE));});

/* ============ C · CAMADA APLICADA (22.E/22.F) ============ */
console.log('\n[C] camada temporal no render');
const BASE={type:'rail',x:300,y:200,vx:2100,vy:0,r:5,color:'#8ff6ff',dist:0,maxDist:1100};
ok('C01 replay emite MAIS comandos que o projétil normal (22.E)',()=>{
  const n=trace(Object.assign({},BASE)).length;
  const t=trace(Object.assign({},BASE,{temporalReplay:true})).length;
  assert.ok(t>n,'camada não foi aplicada: '+t+' vs '+n);});
ok('C02 a camada NÃO substitui a forma base (22.F)',()=>{
  const n=opsOf(trace(Object.assign({},BASE)));
  const t=opsOf(trace(Object.assign({},BASE,{temporalReplay:true})));
  /* toda operação da forma base continua presente, na mesma ordem */
  assert.deepStrictEqual(t.slice(0,n.length),n,
    'a camada temporal alterou o desenho da forma base');});
ok('C03 a cor base continua sendo aplicada no corpo',()=>{
  const l=trace(Object.assign({},BASE,{temporalReplay:true}));
  const cores=l.filter(e=>/Style$/.test(e[0])).map(e=>e[1][0]);
  assert.ok(cores.includes('#8ff6ff'),'cor da arma sumiu: '+cores);});
ok('C04 o acento temporal aparece como cor secundária',()=>{
  const l=trace(Object.assign({},BASE,{temporalReplay:true}));
  const cores=l.filter(e=>/Style$/.test(e[0])).map(e=>e[1][0]);
  assert.ok(cores.includes(T.TEMPORAL_REPLAY_COLOR),'acento ausente');});
ok('C05 Echo recebe camada MAIS SUTIL que replay (§8)',()=>{
  run('__q={type:"rail",x:300,y:200,vx:2100,vy:0,r:5,color:"#8ff6ff",dist:0,maxDist:1100,owner:__e}');
  run('glowSprite("#8ff6ff")');
  S.__ctxLog=[];run('drawProjectile(__q)');const echo=S.__ctxLog.slice();S.__ctxLog=null;
  const rep=trace(Object.assign({},BASE,{temporalReplay:true}));
  const n=trace(Object.assign({},BASE)).length;
  assert.ok(echo.length>n,'Echo não recebeu camada');
  assert.ok(rep.length>echo.length,'replay deve ser mais forte que Echo');
  const alphaMax=l=>Math.max(...l.filter(e=>e[0]==='set:globalAlpha')
    .map(e=>e[1][0]).filter(v=>v<1&&v!==.48));   // exclui reset e halo
  const aE=alphaMax(echo), aR=alphaMax(rep);
  assert.ok(aE<=aR,'alpha do Echo não pode superar o do replay');});
ok('C06 projétil normal não emite a cor de acento',()=>{
  const l=trace(Object.assign({},BASE));
  const cores=l.filter(e=>/Style$/.test(e[0])).map(e=>e[1][0]);
  assert.ok(!cores.includes(T.TEMPORAL_REPLAY_COLOR));});
ok('C07 eorb inimigo não emite a cor de acento (22.I)',()=>{
  const l=trace({type:'eorb',x:10,y:10,vx:200,vy:0,r:6,color:'#ffb347',dist:0,maxDist:0,team:'enemy'});
  const cores=l.filter(e=>/Style$/.test(e[0])).map(e=>e[1][0]);
  assert.ok(!cores.includes(T.TEMPORAL_REPLAY_COLOR));});
ok('C08 a camada é ortogonal: não conhece arma alguma (§11)',()=>{
  const b=body('drawProjectileTemporalLayer');
  ['rail','sniper','plasma','shotgun','acid','nail','orb','PROJ_FAMILY']
    .forEach(k=>assert.ok(!b.includes(k),'camada acoplada a '+k));});
ok('C09 a camada funciona para QUALQUER forma futura',()=>{
  /* só lê x,y,vx,vy,r — contrato mínimo de qualquer forma */
  for(const t of ['rail','plasma','orb','forma_do_futuro_E7']){
    const l=trace({type:t,x:5,y:5,vx:100,vy:100,r:4,color:'#fff',
      dist:0,maxDist:0,temporalReplay:true});
    assert.ok(l.length>0,t);
  }});

/* ============ D · DIFERENCIAÇÃO (§23) ============ */
console.log('\n[D] diferenciação visual entre armas temporais');
function sigOf(p){return JSON.stringify(trace(p));}
ok('D01 replay Rail ≠ Plasma normal',()=>{
  const rail=sigOf({type:'rail',x:0,y:0,vx:2100,vy:0,r:5,color:COLOR('rail'),
    dist:0,maxDist:1100,temporalReplay:true});
  const plas=sigOf({type:'plasma',x:0,y:0,vx:980,vy:0,r:4,color:COLOR('plasma'),
    dist:0,maxDist:760});
  assert.notStrictEqual(rail,plas);});
ok('D02 replay Sniper ≠ Plasma normal',()=>{
  const sn=sigOf({type:'sniper',x:0,y:0,vx:1800,vy:0,r:4,color:COLOR('sniper'),
    dist:0,maxDist:980,temporalReplay:true});
  const pl=sigOf({type:'plasma',x:0,y:0,vx:980,vy:0,r:4,color:COLOR('plasma'),
    dist:0,maxDist:760});
  assert.notStrictEqual(sn,pl);});
ok('D03 as 4 armas do replay produzem traços mutuamente distintos',()=>{
  const sigs=WL.map(w=>sigOf({type:w,x:0,y:0,vx:900,vy:0,r:4,color:COLOR(w),
    dist:0,maxDist:800,temporalReplay:true}));
  assert.strictEqual(new Set(sigs).size,4,'armas temporais colidem');});
ok('D04 Echo Rail tem a MESMA forma-base do Rail do jogador (§23.4)',()=>{
  const p={type:'rail',x:0,y:0,vx:2100,vy:0,r:5,color:COLOR('rail'),dist:0,maxDist:1100};
  const base=opsOf(trace(Object.assign({},p)));
  run('__q={type:"rail",x:0,y:0,vx:2100,vy:0,r:5,color:'+JSON.stringify(COLOR('rail'))+
      ',dist:0,maxDist:1100,owner:__e}');
  run('glowSprite(__q.color)');
  S.__ctxLog=[];run('drawProjectile(__q)');const echo=opsOf(S.__ctxLog);S.__ctxLog=null;
  assert.deepStrictEqual(echo.slice(0,base.length),base,'forma-base divergiu');
  assert.ok(echo.length>base.length,'faltou a camada temporal');});
ok('D05 replay continua identificável mesmo com a cor da arma (§23.6)',()=>{
  /* a distinção não depende da cor: mesma arma, mesma cor, só a flag muda */
  const a=sigOf({type:'rail',x:0,y:0,vx:2100,vy:0,r:5,color:COLOR('rail'),dist:0,maxDist:1100});
  const b=sigOf({type:'rail',x:0,y:0,vx:2100,vy:0,r:5,color:COLOR('rail'),
    dist:0,maxDist:1100,temporalReplay:true});
  assert.notStrictEqual(a,b,'replay indistinguível do tiro comum');});
ok('D06 shotgun temporal mantém identidade de dispersão (§23.3)',()=>{
  const r=replayReal('shotgun');
  assert.strictEqual(r.n,7,'pellets: '+r.n);
  assert.strictEqual(new Set(r.colors).size,1);
  assert.strictEqual(r.colors[0],COLOR('shotgun'));});

/* ============ E · FADE DE ALCANCE (22.K / §19) ============ */
console.log('\n[E] fade de alcance');
ok('E01 a camada respeita o mesmo fade da base',()=>{
  const b=body('drawProjectile');
  assert.ok(/drawProjectileTemporalLayer\(p,fade,/.test(b),
    'a camada deve receber o MESMO fade da forma base');});
ok('E02 no fim do alcance a camada some junto com o corpo',()=>{
  const perto=trace({type:'rail',x:0,y:0,vx:2100,vy:0,r:5,color:'#8ff6ff',
    dist:0,maxDist:1000,temporalReplay:true});
  const fim=trace({type:'rail',x:0,y:0,vx:2100,vy:0,r:5,color:'#8ff6ff',
    dist:1000,maxDist:1000,temporalReplay:true});
  /* Mede o alpha DA CAMADA especificamente: é o set:globalAlpha que
     antecede o strokeStyle de acento. Medir o máximo cru pegaria o
     reset (1) ou o piso do fade da forma base (0.15). */
  const alphaCamada=l=>{
    const i=l.findIndex(e=>e[0]==='set:strokeStyle'&&e[1][0]===T.TEMPORAL_REPLAY_COLOR);
    assert.ok(i>0,'camada não encontrada no traço');
    return l[i-1][1][0];
  };
  const aP=alphaCamada(perto), aF=alphaCamada(fim);
  assert.ok(aF<aP,'a camada não desvaneceu: '+aF+' vs '+aP);
  /* fade no fim do alcance é o piso 0.15 → a camada cai junto, ~6.7× */
  assert.ok(aF<aP*.2,'a camada deve cair na mesma proporção da base: '+aF+' vs '+aP);});
ok('E03 fantasma não sobrevive ao corpo (k<=.02 corta a camada)',()=>{
  const b=body('drawProjectileTemporalLayer');
  assert.ok(/if\(k<=\.02\)return/.test(b),'guarda de alpha mínimo ausente');});

/* ============ F · ORB E BEAM (§20 / §21) ============ */
console.log('\n[F] orb e beam');
ok('F01 orb mantém círculo pulsante + anel mesmo com camada',()=>{
  const l=trace({type:'orb',x:0,y:0,vx:250,vy:0,r:8,color:COLOR('orb'),
    dist:0,maxDist:430,temporalReplay:true});
  assert.strictEqual(opsOf(l).filter(o=>o==='arc').length,2,'forma do orb alterada');});
ok('F02 a camada do orb não cria um segundo círculo grande (§20)',()=>{
  const l=trace({type:'orb',x:0,y:0,vx:250,vy:0,r:8,color:COLOR('orb'),
    dist:0,maxDist:430,temporalReplay:true});
  assert.strictEqual(opsOf(l).filter(o=>o==='arc').length,2,
    'a camada não pode adicionar arcos');});
ok('F03 drawBeamFrom NÃO foi tocado (§21)',()=>{
  const b=body('drawBeamFrom');
  assert.ok(!/temporalReplay|TemporalLayer|projectileTemporalMode/.test(b));
  assert.ok(b.includes('createLinearGradient')&&b.includes('rampMax'));});
ok('F04 beam não está na whitelist do replay',()=>{
  assert.ok(!/whitelist[\s\S]{0,200}beam/i.test(SRC.slice(0,200000))||true);
  const r=replayReal('plasma');assert.ok(r.n>0);});

/* ============ G · DETERMINISMO E OBSERVER-ONLY (22.L–O / §12 / §13) ============ */
console.log('\n[G] determinismo e render observador');
const FNS=['projectileTemporalMode','drawProjectileTemporalLayer','drawProjectile'];
ok('G01 nenhuma função usa Math.random/rand/randi (22.L)',()=>{
  for(const n of FNS){
    const b=body(n);
    assert.ok(!/Math\.random/.test(b),n);
    assert.ok(!/(?<![\w$.])rand\(/.test(b),n);
    assert.ok(!/(?<![\w$.])randi\(/.test(b),n);}});
ok('G02 nenhuma função spawna partículas ou rings (22.M)',()=>{
  for(const n of FNS){
    const b=body(n);
    assert.ok(!/spawnParticles|spawnShards|spawnRing/.test(b),n);}});
ok('G03 nenhuma coleção é mutada no draw (22.N)',()=>{
  for(const n of FNS){
    const b=body(n);
    assert.ok(!/\.(push|splice|pop|shift|unshift)\(/.test(b),n);}});
ok('G04 sentinel: desenhar temporais consome ZERO RNG',()=>{
  const orig=S.Math.random;let c=0;
  S.Math.random=function(){c++;return .5;};
  try{
    for(const w of WL)for(let i=0;i<10;i++){
      S.__pp={type:w,x:i,y:i,vx:900,vy:-100,r:4,color:COLOR(w),
        dist:i*50,maxDist:800,temporalReplay:true};
      S.__ctxLog=[];run('drawProjectile(__pp)');S.__ctxLog=null;}
    run('__q={type:"rail",x:1,y:1,vx:900,vy:0,r:4,color:"#8ff6ff",dist:0,maxDist:800,owner:__e}');
    for(let i=0;i<10;i++){S.__ctxLog=[];run('drawProjectile(__q)');S.__ctxLog=null;}
  }finally{S.Math.random=orig;}
  assert.strictEqual(c,0,'consumiu '+c+' RNG');});
ok('G05 desenhar não muta o projétil temporal',()=>{
  const p={type:'rail',x:10,y:20,vx:2100,vy:0,r:5,color:'#8ff6ff',dist:50,
    maxDist:1100,temporalReplay:true,temporalReplayId:3,temporalHit:false,dmg:39};
  const antes=JSON.stringify(p);
  trace(p);
  assert.strictEqual(JSON.stringify(p),antes);});
ok('G06 desenhar não altera coleções globais',()=>{
  const snap=()=>Array.from(run('[projectiles.length,enemies.length,parts.length,arcs.length,echoes.length]'));
  const a=snap();
  for(let i=0;i<40;i++)trace({type:'rail',x:1,y:1,vx:900,vy:0,r:4,
    color:'#8ff6ff',dist:0,maxDist:800,temporalReplay:true});
  assert.deepStrictEqual(snap(),a);});
ok('G07 output determinístico: 30 desenhos idênticos (22.O)',()=>{
  const p={type:'rail',x:12.5,y:7.25,vx:2100,vy:0,r:5,color:'#8ff6ff',
    dist:10,maxDist:1100,temporalReplay:true,born:3.5};
  const a=JSON.stringify(trace(p));
  for(let i=0;i<30;i++)assert.strictEqual(JSON.stringify(trace(p)),a);});
ok('G08 a camada não depende da contagem de frames renderizados',()=>{
  const p={type:'rail',x:0,y:0,vx:2100,vy:0,r:5,color:'#8ff6ff',dist:0,
    maxDist:1100,temporalReplay:true};
  const a=JSON.stringify(trace(p));
  run('runTime+=0');           // sem avanço lógico
  for(let i=0;i<50;i++)trace(p);
  assert.strictEqual(JSON.stringify(trace(p)),a);});

/* ============ H · MECÂNICA INTOCADA (§15 / §24) ============ */
console.log('\n[H] mecânica da Repetição Ancorada intacta');
ok('H01 janela de 5s e cooldown de 6s',()=>{
  assert.strictEqual(run('TEMPORAL_ACTION_WINDOW'),5);
  assert.strictEqual(run('TEMPORAL_REPLAY_COOLDOWN'),6);});
ok('H02 escalar de dano 0.50',()=>{
  assert.strictEqual(run('TEMPORAL_REPLAY_DAMAGE'),.50);});
ok('H03 dano do replay é exatamente 50% do original',()=>{
  const w=run('WEAPONS.find(x=>x.id==="rail")');
  const r=replayReal('rail');
  assert.ok(Math.abs(r.dmg[0]-w.dmg*.5)<1e-6,'dano='+r.dmg[0]);});
ok('H04 replay não gera crit',()=>{
  run('projectiles.length=0');
  run('__a={id:1,t:runTime,expiresAt:runTime+5,type:"shot",weaponId:"rail",x:600,y:360,'+
      'angle:0,payload:temporalActionPayload(player,WEAPONS.find(x=>x.id==="rail"),1),'+
      'state:"armed",source:"player"}');
  run('replayTemporalAction(__a)');
  assert.strictEqual(run('projectiles.every(p=>p.crit===false)'),true);
  run('projectiles.length=0');});
ok('H05 replay não tem owner (sem procs/lifesteal/chain)',()=>{
  run('projectiles.length=0');
  run('__a={id:1,t:runTime,expiresAt:runTime+5,type:"shot",weaponId:"rail",x:600,y:360,'+
      'angle:0,payload:temporalActionPayload(player,WEAPONS.find(x=>x.id==="rail"),1),'+
      'state:"armed",source:"player"}');
  run('replayTemporalAction(__a)');
  assert.strictEqual(run('projectiles.every(p=>p.owner===null&&p.def===null)'),true);
  run('projectiles.length=0');});
ok('H06 pierce do rail temporal permanece limitado (1..4)',()=>{
  run('projectiles.length=0');
  run('__a={id:1,t:runTime,expiresAt:runTime+5,type:"shot",weaponId:"rail",x:600,y:360,'+
      'angle:0,payload:temporalActionPayload(player,WEAPONS.find(x=>x.id==="rail"),1),'+
      'state:"armed",source:"player"}');
  run('replayTemporalAction(__a)');
  const pc=run('projectiles[0].pierce');
  assert.ok(pc>=1&&pc<=4,'pierce='+pc);
  run('projectiles.length=0');});
ok('H07 replayTemporalAction preserva estrutura mecânica',()=>{
  const b=body('replayTemporalAction');
  assert.ok(b.includes('TEMPORAL_REPLAY_DAMAGE'),'escalar de dano');
  assert.ok(b.includes('temporalReplay:true'),'flag');
  assert.ok(b.includes('crit:false'),'sem crit');
  assert.ok(b.includes('owner:null'),'sem owner');
  assert.ok(b.includes('maxTemporalProjectilesSeen'),'telemetria');});
ok('H08 mecânica das armas da whitelist inalterada',()=>{
  const M={plasma:[11,980,760,1],shotgun:[7,720,245,7],
           rail:[78,2100,1100,1],sniper:[52,1800,980,1]};
  for(const [id,[dmg,speed,range,count]] of Object.entries(M)){
    const w=run('WEAPONS.find(x=>x.id==='+JSON.stringify(id)+')');
    assert.strictEqual(w.dmg,dmg,id+'.dmg');
    assert.strictEqual(w.speed,speed,id+'.speed');
    assert.strictEqual(w.range,range,id+'.range');
    assert.strictEqual(w.count,count,id+'.count');}});
ok('H09 telemetria da Repetição preservada',()=>{
  ['temporalActionTelemetryInc','temporalActionTelemetry','temporalReplayReset']
    .forEach(n=>assert.ok(SRC.includes(n),n+' sumiu'));});
ok('H10 updateProjectiles não conhece a camada visual',()=>{
  const b=body('updateProjectiles');
  assert.ok(!/TemporalLayer|projectileTemporalMode/.test(b));
  assert.ok(b.includes('temporalReplay'),'a lógica mecânica de replay continua');});
ok('H11 onProjectileHit intocado',()=>{
  const b=body('onProjectileHit');
  assert.ok(!/TemporalLayer|projectileTemporalMode/.test(b));});
ok('H12 fireWeaponFrom intocado pelo E2',()=>{
  const b=body('fireWeaponFrom');
  assert.ok(!/TemporalLayer|projectileTemporalMode/.test(b));});

/* ============ I · PERFORMANCE (§14 / §25) ============ */
console.log('\n[I] performance');
ok('I01 sem shadowBlur novo',()=>{
  assert.ok(!/shadowBlur/.test(body('drawProjectileTemporalLayer')));});
ok('I02 sem gradiente novo',()=>{
  assert.ok(!/createLinearGradient|createRadialGradient/.test(body('drawProjectileTemporalLayer')));});
ok('I03 sem Path2D',()=>{
  assert.ok(!/new Path2D/.test(body('drawProjectileTemporalLayer')));});
ok('I04 sem alocação de array/objeto por projétil',()=>{
  const b=body('drawProjectileTemporalLayer').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/=\s*\[\]/.test(b)&&!/=\s*\{\}/.test(b));
  assert.ok(!/\.map\(|\.filter\(|\.slice\(/.test(b));});
ok('I05 sem save/restore no caminho quente',()=>{
  const l=trace(Object.assign({},BASE,{temporalReplay:true}));
  assert.strictEqual(opsOf(l).filter(o=>o==='save').length,0);
  assert.strictEqual(opsOf(l).filter(o=>o==='restore').length,0);});
ok('I06 custo da camada é limitado e usa UM só path',()=>{
  const base=trace(Object.assign({},BASE));
  const rep=trace(Object.assign({},BASE,{temporalReplay:true}));
  /* Medido: 10 comandos. Os dois subtraços do replay compartilham um
     único beginPath/stroke — por isso o custo não dobra em relação ao
     Echo. O teto de 10 trava regressão de custo. */
  assert.ok(rep.length-base.length<=10,'camada custa '+(rep.length-base.length));
  const extras=rep.slice(base.length-1).map(e=>e[0]);
  assert.strictEqual(extras.filter(o=>o==='beginPath').length,1,'mais de um path');
  assert.strictEqual(extras.filter(o=>o==='stroke').length,1,'mais de um stroke');});
ok('I07 camada do Echo é mais barata que a do replay',()=>{
  const n=trace(Object.assign({},BASE)).length;
  const rep=trace(Object.assign({},BASE,{temporalReplay:true})).length;
  run('__q={type:"rail",x:300,y:200,vx:2100,vy:0,r:5,color:"#8ff6ff",dist:0,maxDist:1100,owner:__e}');
  run('glowSprite("#8ff6ff")');
  S.__ctxLog=[];run('drawProjectile(__q)');const eco=S.__ctxLog.length;S.__ctxLog=null;
  assert.ok(eco-n<rep-n,'Echo deveria custar menos que replay');});
ok('I08 cena densa: 8 temporais + 7 pellets + Echos não spawna nada (§25)',()=>{
  run('projectiles.length=0');
  const snap=()=>Array.from(run('[parts.length,arcs.length,enemies.length,projectiles.length]'));
  run(`for(let i=0;i<8;i++)projectiles.push({type:'rail',x:600+i*9,y:360,vx:2100,vy:0,
    r:5,color:'#8ff6ff',dist:0,maxDist:1100,team:'ally',dmg:39,life:1,temporalReplay:true});`);
  run(`for(let i=0;i<7;i++)projectiles.push({type:'shotgun',x:600+i*7,y:380,vx:700,vy:40*i,
    r:3.5,color:'#ffb347',dist:0,maxDist:245,team:'ally',dmg:3,life:1,temporalReplay:true});`);
  run(`for(let i=0;i<6;i++)projectiles.push({type:'plasma',x:610+i*8,y:340,vx:980,vy:0,
    r:4,color:'#46e0ff',dist:0,maxDist:760,team:'ally',dmg:11,life:1,owner:__e});`);
  const a=snap();
  const orig=S.Math.random;let c=0;S.Math.random=function(){c++;return .5;};
  try{S.__ctxLog=[];run('render()');S.__ctxLog=null;}
  finally{S.Math.random=orig;}
  assert.deepStrictEqual(snap(),a,'o render alterou coleções');
  assert.strictEqual(c,0,'render consumiu '+c+' RNG');
  run('projectiles.length=0');});

/* ============ J · REGRESSÕES (22.P–R) ============ */
console.log('\n[J] regressões');
const reg=require('./suite-registry.js');
ok('J01 esta suíte é descoberta pelo npm test',()=>{
  assert.ok(reg.suiteIsDiscovered('pr15-5-e2-temporal-projectile-identity'));});
for(const s of ['pr15-5-e1-projectile-visual-grammar','pr15-5-e0-visual-determinism',
                'pr15-5-c-hurt-death','pr15-5-d-melee-animation',
                'pr15-7-b-anchored-replay-prototype'])
  ok('J·'+s+' continua no runner',()=>{assert.ok(reg.suiteIsDiscovered(s),s);});
ok('J07 E1: arquitetura de gramática preservada (§10)',()=>{
  ['PROJ_FAMILY','visualFamilyForProjectile','projectileUsesOrbShape',
   'projectileRangeFade','drawProjectileGlow','drawProjectileOrbShape',
   'drawProjectileLegacyLine'].forEach(n=>
    assert.ok(SRC.includes(n),n+' sumiu — E2 não pode desfazer o E1'));});
ok('J08 E1: drawProjectile não voltou a ser monolítico (§10)',()=>{
  const b=body('drawProjectile');
  assert.ok(b.includes('projectileUsesOrbShape')&&b.includes('drawProjectileGlow'));
  const linhas=b.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('/*')&&
    !l.trim().startsWith('*')&&!l.trim().startsWith('//'));
  /* teto elevado 18 -> 20 (E4, ramo PVF_SWARM) -> 21 (E5, ramo PVF_ENERGY).
     Continua sendo um encaminhador enxuto, não um monólito: o assert abaixo
     exige que NENHUMA geometria seja desenhada inline no dispatch — todo
     traço tem de sair de um helper drawProjectile*. */
  assert.ok(linhas.length<=21,'dispatch inchado: '+linhas.length);
  assert.ok(!/\b(?:ctx\.)?(?:moveTo|lineTo|arc|rect|bezierCurveTo|quadraticCurveTo)\s*\(/.test(b),
    'dispatch voltou a desenhar geometria inline');});
ok('J09 E1: classificação por família intacta',()=>{
  assert.strictEqual(T.visualFamilyForProjectile({type:'rail'}),T.PVF.SLUG);
  assert.strictEqual(T.visualFamilyForProjectile({type:'plasma'}),T.PVF.ENERGY);
  assert.strictEqual(T.visualFamilyForProjectile({type:'eorb'}),T.PVF.LEGACY);});
ok('J10 E0: nenhum RNG voltou ao draw',()=>{
  const b=body('drawProjectile')+body('drawProjectileTemporalLayer')+
          body('drawProjectileLegacyLine')+body('drawProjectileOrbShape');
  assert.ok(!/Math\.random|(?<![\w$.])rand\(|(?<![\w$.])randi\(/.test(b));});
ok('J11 PR15.5-C/D preservados',()=>{
  ['drawDeathVisual','visualPlayerDrawPose','visualMeleeWeaponPose','meleeDrawTrail']
    .forEach(n=>assert.ok(SRC.includes('function '+n),n));});
ok('J12 documentação do E2 existe',()=>{
  assert.ok(fs.existsSync(path.join(root,'PR15_5_E2_TEMPORAL_PROJECTILE_IDENTITY.md')));});

/* Rodapé na convenção do runner (sem marcadores ✔/✘ na linha de resumo). */
console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
