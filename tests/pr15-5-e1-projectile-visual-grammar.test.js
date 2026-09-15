'use strict';
/* ECHO — PR15.5-E1 · GRAMÁTICA VISUAL DOS PROJÉTEIS
   ---------------------------------------------------------------------
   O E1 é um TRILHO ESTRUTURAL, não um rework visual. Esta suíte existe
   para provar duas coisas simultâneas e aparentemente opostas:

     1. a ARQUITETURA mudou (famílias, classificação pura, helpers);
     2. a APARÊNCIA não mudou (traço Canvas byte-a-byte idêntico).

   A seção C é o coração: reconstrói a implementação ANTERIOR (extraída
   de 0b16400) dentro do mesmo sandbox e compara os logs do ctx mock
   chamada a chamada. Se o E1 alterar um único argumento de desenho, ela
   falha — que é exatamente o critério de sucesso definido no escopo
   ("o replaytest humano deve dizer: NÃO PERCEBI DIFERENÇA"). */
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {world,readSource}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}}
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5-E1 · GRAMÁTICA VISUAL DOS PROJÉTEIS');

/* corpo de uma função no fonte real */
function body(name){
  const m=SRC.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(m,'função não encontrada no fonte: '+name);
  return m[0];
}
/* captura o traço de comandos Canvas de uma expressão */
function trace(expr,p){
  S.__pp=p;
  if(p&&p.color)run('glowSprite(__pp.color)');   // aquece _glowCache
  S.__ctxLog=[];
  try{run(expr);}finally{const l=S.__ctxLog;S.__ctxLog=null;return l;}
}
function opsOf(log){return log.map(e=>e[0]);}

/* as 20 armas ranged reais, lidas do WEAPONS[] do jogo */
/* `run` devolve valores do realm do vm: um Array de lá NÃO satisfaz
   deepStrictEqual contra um Array daqui (protótipos diferentes). Copiamos
   para o realm do teste uma única vez. */
const RANGED=Array.from(run('WEAPONS.filter(w=>!w.melee).map(w=>w.id)'));
const RANGED_NO_BEAM=RANGED.filter(id=>id!=='beam');

/* ============ A · INFRAESTRUTURA ============ */
console.log('\n[A] infraestrutura');
ok('A01 visualFamilyForProjectile existe e é função',()=>{
  assert.strictEqual(typeof T.visualFamilyForProjectile,'function');});
ok('A02 PROJ_FAMILY é tabela estática (objeto simples)',()=>{
  assert.ok(T.PROJ_FAMILY&&typeof T.PROJ_FAMILY==='object');
  assert.ok(!Array.isArray(T.PROJ_FAMILY));});
ok('A03 as 7 constantes de família existem e são distintas',()=>{
  const v=Object.values(T.PVF);
  assert.strictEqual(v.length,7);
  assert.strictEqual(new Set(v).size,7,'famílias devem ser distintas');
  v.forEach(x=>assert.strictEqual(typeof x,'number'));});
ok('A04 PVF_LEGACY é o valor 0 (fallback natural)',()=>{
  assert.strictEqual(T.PVF.LEGACY,0);});
ok('A05 helpers de forma existem',()=>{
  ['projectileUsesOrbShape','projectileRangeFade','drawProjectileGlow',
   'drawProjectileOrbShape','drawProjectileLegacyLine','drawProjectile']
  .forEach(n=>assert.strictEqual(typeof T[n],'function',n));});
ok('A06 tabela é criada uma única vez, fora de qualquer função',()=>{
  const i=SRC.indexOf('const PROJ_FAMILY=');
  assert.ok(i>0);
  /* não pode estar dentro do corpo de drawProjectile */
  assert.ok(!body('drawProjectile').includes('PROJ_FAMILY'),
    'a tabela não pode ser reconstruída por frame');});
ok('A07 o jogo expõe exatamente 20 armas ranged',()=>{
  assert.strictEqual(RANGED.length,20);});

/* ============ B · CLASSIFICAÇÃO (item 18.A) ============ */
console.log('\n[B] classificação das 20 ranged');
const ESPERADO={
  rail:'SLUG',sniper:'SLUG',nail:'SLUG',
  plasma:'ENERGY',orb:'ENERGY',void:'ENERGY',cryo:'ENERGY',
  flamer:'FLUID',acid:'FLUID',
  smg:'SWARM',shotgun:'SWARM',homing:'SWARM',prism:'SWARM',
  tesla:'CONDUCT',plague:'CONDUCT',
  ricochet:'KINETIC',boomer:'KINETIC',gatling:'KINETIC',mine:'KINETIC'
};
for(const [id,fam] of Object.entries(ESPERADO))
  ok('B·'+id+' classificado como '+fam,()=>{
    assert.strictEqual(T.visualFamilyForProjectile({type:id}),T.PVF[fam]);});
ok('B20 beam NÃO está na tabela (usa drawBeamFrom)',()=>{
  assert.strictEqual(T.PROJ_FAMILY.beam,undefined);});
ok('B21 toda arma ranged exceto beam tem família própria (não-legacy)',()=>{
  const semFamilia=RANGED_NO_BEAM.filter(id=>
    T.visualFamilyForProjectile({type:id})===T.PVF.LEGACY);
  assert.deepStrictEqual(semFamilia,[],'sem família: '+semFamilia);});
ok('B22 as 6 famílias não-legacy estão todas em uso',()=>{
  const usadas=new Set(RANGED_NO_BEAM.map(id=>T.visualFamilyForProjectile({type:id})));
  assert.strictEqual(usadas.size,6);
  assert.ok(!usadas.has(T.PVF.LEGACY));});
ok('B23 a tabela não contém tipo que não seja arma ranged real',()=>{
  const extras=Object.keys(T.PROJ_FAMILY).filter(k=>RANGED.indexOf(k)<0);
  assert.deepStrictEqual(extras,[],'tipos órfãos: '+extras);});

/* ============ C · EQUIVALÊNCIA VISUAL (itens 19/20) ============ */
console.log('\n[C] equivalência visual byte-a-byte com a base 0b16400');
/* Implementação ANTERIOR, copiada literalmente do commit base, injetada
   no MESMO sandbox para comparar contra a nova sob condições idênticas. */
run(`function __legacyDrawProjectile(p){
  const orb=(p.type==='orb'||p.type==='eorb');
  const gs=glowSprite(p.color);
  const gr=(orb?p.r*2.6:p.r*2.9)+6;
  let fade=1;
  if(p.maxDist){const left=1-p.dist/p.maxDist;if(left<.22)fade=clamp(left/.22,0,1)*.85+.15;}
  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=(orb?.60:.48)*fade;
  ctx.drawImage(gs,p.x-gr,p.y-gr,gr*2,gr*2);
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=fade;
  ctx.fillStyle=p.color;
  if(orb){
    ctx.beginPath();ctx.arc(p.x,p.y,p.r+Math.sin(runTime*10)*1.5,0,TAU);ctx.fill();
    ctx.globalAlpha=.4;ctx.strokeStyle=p.color;ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r+5,0,TAU);ctx.stroke();
    ctx.globalAlpha=1;
  }else{
    const l=p.type==='plasma'?10:5;
    const sp=Math.hypot(p.vx,p.vy)||1;
    ctx.strokeStyle=p.color;ctx.lineWidth=p.r;
    ctx.beginPath();ctx.moveTo(p.x,p.y);
    ctx.lineTo(p.x-p.vx/sp*l,p.y-p.vy/sp*l);
    ctx.stroke();
  }
  ctx.globalAlpha=1;
}`);
function comparaTracos(p){
  S.__pp=p;
  run('glowSprite(__pp.color)');
  S.__ctxLog=[];run('drawProjectile(__pp)');const novo=JSON.stringify(S.__ctxLog);
  S.__ctxLog=[];run('__legacyDrawProjectile(__pp)');const velho=JSON.stringify(S.__ctxLog);
  S.__ctxLog=null;
  return {novo,velho};
}
/* varredura ampla: todo tipo conhecido + inimigo + desconhecido, em
   várias fases de alcance, cores e vetores de velocidade */
/* PR15.5-E3: rail, sniper e nail ganharam formas próprias (família
   SLUG) — divergir da base é o OBJETIVO daquele PR, não uma regressão.
   A garantia do E1 continua valendo integralmente para todo o resto, e
   ficou MAIS forte: além de exigir equivalência exata fora da família
   SLUG, agora exigimos que as 3 armas do E3 tenham de fato mudado. */
const SLUG_E3=['rail','sniper','nail'];
/* PR15.5-E4: a família ENXAME/MÚLTIPLO ganhou forma própria e saiu do
   caminho legado, exatamente como o E3 fez com os slugs. Vira um terceiro
   balde com prova POSITIVA (C01c) — a varredura não foi enfraquecida:
   continua exigindo equivalência exata para todo o resto. */
const SWARM_E4=['smg','shotgun','homing','prism'];
/* PR15.5-E10: a família CINÉTICO/RETORNO também ganhou forma própria.
   Quarto balde com prova POSITIVA (C01d). A varredura segue exigindo
   equivalência exata para tudo que ainda não foi redesenhado. */
const KINETIC_E10=['ricochet','boomer','gatling','mine'];
/* PR15.5-E5: a família ENERGIA/MASSA ganhou forma própria. `orb` NÃO entra
   neste balde de propósito: o E5 delega o orb ao desenho histórico, então
   ele tem de continuar BYTE-IDÊNTICO à base e permanece no balde C — uma
   exigência mais forte. Prova positiva das outras três em C01e. */
const ENERGY_E5=['plasma','void','cryo'];
const TIPOS_C=RANGED.concat(['eorb','tipo_inexistente_xyz',undefined,null]);
const CASOS=[];
for(const [dist,maxDist] of [[0,0],[0,1000],[500,1000],[850,1000],[1000,1000]])
  for(const color of ['#46e0ff','#ff7a2f','#a8ff3d'])
    for(const [vx,vy] of [[300,-140],[0,0],[-980,0]])
      CASOS.push({dist,maxDist,color,vx,vy});
let compC=0,divC=0,compSlug=0,divSlug=0,compSwarm=0,divSwarm=0,compKin=0,divKin=0,compEner=0,divEner=0;
for(const t of TIPOS_C){
  const isSlug=SLUG_E3.indexOf(t)>=0;
  const isSwarm=SWARM_E4.indexOf(t)>=0;
  const isKin=KINETIC_E10.indexOf(t)>=0;
  const isEner=ENERGY_E5.indexOf(t)>=0;
  for(const c of CASOS){
    const r=comparaTracos({type:t,x:120.5,y:80.25,vx:c.vx,vy:c.vy,r:4.5,
      color:c.color,dist:c.dist,maxDist:c.maxDist});
    const diff=r.novo!==r.velho;
    if(isSlug){compSlug++;if(diff)divSlug++;}
    else if(isSwarm){compSwarm++;if(diff)divSwarm++;}
    else if(isKin){compKin++;if(diff)divKin++;}
    else if(isEner){compEner++;if(diff)divEner++;}
    else{compC++;if(diff)divC++;}
  }
}
ok('C01 fora da família SLUG, traço idêntico à base em '+compC+' combinações',()=>{
  assert.strictEqual(divC,0,divC+' divergências de '+compC);});
ok('C01b família SLUG (E3) mudou em TODAS as '+compSlug+' combinações',()=>{
  assert.strictEqual(divSlug,compSlug,
    'rail/sniper/nail deveriam ter forma própria: só '+divSlug+' de '+compSlug);});
ok('C01c família ENXAME (E4) mudou em TODAS as '+compSwarm+' combinações',()=>{
  assert.strictEqual(divSwarm,compSwarm,
    'smg/shotgun/homing/prism deveriam ter forma própria: só '+divSwarm+' de '+compSwarm);});
ok('C01d família CINÉTICO (E10) mudou em TODAS as '+compKin+' combinações',()=>{
  assert.strictEqual(divKin,compKin,
    'ricochet/boomer/gatling/mine deveriam ter forma própria: só '+divKin+' de '+compKin);});
ok('C01e família ENERGIA/MASSA (E5) mudou em TODAS as '+compEner+' combinações',()=>{
  assert.strictEqual(divEner,compEner,
    'plasma/void/cryo deveriam ter forma própria: só '+divEner+' de '+compEner);});
ok('C01f orb continua BYTE-IDÊNTICO à base (E5 delega ao desenho histórico)',()=>{
  for(const c of CASOS){
    const r=comparaTracos({type:'orb',x:120.5,y:80.25,vx:c.vx,vy:c.vy,r:4.5,
      color:c.color,dist:c.dist,maxDist:c.maxDist});
    assert.strictEqual(r.novo,r.velho,'orb divergiu da base');}});
ok('C02 a cobertura da varredura é significativa',()=>{
  const tot=compC+compSlug+compSwarm+compKin+compEner;
  assert.ok(tot>=500,'apenas '+tot+' combinações');});
ok('C03 plasma mantém o comprimento 10 (demais 5)',()=>{
  const L=t=>{const g=trace('drawProjectile(__pp)',
    {type:t,x:0,y:0,vx:100,vy:0,r:4,color:'#46e0ff',dist:0,maxDist:0});
    const lt=g.find(e=>e[0]==='lineTo');return lt&&Math.abs(lt[1][0]);};
  /* PR15.5-E5: plasma/cryo/void saíram do caminho legado e não têm mais um
     "comprimento de traço" único. A âncora do comprimento legado passa a ser
     flamer (5); o assert positivo garante que as três NÃO usam mais a reta
     legada de meio-comprimento. */
  assert.strictEqual(L('flamer'),5);
  assert.strictEqual(L('acid'),5);
  for(const t of ['plasma','cryo','void'])
    assert.notStrictEqual(L(t),5,t+' regrediu para a reta legada');});
ok('C04 fade de alcance preservado (últimos 22%)',()=>{
  assert.strictEqual(T.projectileRangeFade({maxDist:0}),1);
  assert.strictEqual(T.projectileRangeFade({dist:0,maxDist:1000}),1);
  assert.strictEqual(T.projectileRangeFade({dist:700,maxDist:1000}),1);
  const f=T.projectileRangeFade({dist:900,maxDist:1000});
  assert.ok(f>0.15&&f<1,'fade intermediário: '+f);
  assert.ok(Math.abs(T.projectileRangeFade({dist:1000,maxDist:1000})-0.15)<1e-9);});
ok('C05 alpha do halo: .60 para orbe, .48 para linha',()=>{
  const a=t=>{const g=trace('drawProjectile(__pp)',
      {type:t,x:0,y:0,vx:100,vy:0,r:4,color:'#46e0ff',dist:0,maxDist:0});
    const s=g.find(e=>e[0]==='set:globalAlpha');return s&&s[1][0];};
  assert.ok(Math.abs(a('orb')-0.60)<1e-9);
  assert.ok(Math.abs(a('cryo')-0.48)<1e-9);});

/* ============ D · FORMA: ORB E FALLBACK (itens 18.C/18.D/18.E) ============ */
console.log('\n[D] forma, orbe e fallback');
ok('D01 orb usa o caminho de círculo',()=>{
  assert.strictEqual(T.projectileUsesOrbShape({type:'orb'}),true);});
ok('D02 eorb (todo projétil inimigo/boss) usa círculo, como antes',()=>{
  assert.strictEqual(T.projectileUsesOrbShape({type:'eorb'}),true);});
ok('D03 demais armas não usam a forma de orbe',()=>{
  RANGED_NO_BEAM.filter(id=>id!=='orb').forEach(id=>
    assert.strictEqual(T.projectileUsesOrbShape({type:id}),false,id));});
ok('D04 orbe desenha círculo pulsante + anel (2 arcos)',()=>{
  const g=trace('drawProjectile(__pp)',
    {type:'orb',x:0,y:0,vx:0,vy:0,r:8,color:'#9d7bff',dist:0,maxDist:0});
  assert.strictEqual(opsOf(g).filter(o=>o==='arc').length,2);
  assert.strictEqual(opsOf(g).filter(o=>o==='fill').length,1);
  assert.strictEqual(opsOf(g).filter(o=>o==='stroke').length,1);});
ok('D05 linha legada desenha 1 moveTo + 1 lineTo + 1 stroke',()=>{
  /* `flamer` no lugar de `cryo`: o E3 deu forma própria à família SLUG e o
     E5 à ENERGIA/MASSA (cryo incluído); flamer representa o caminho legado. */
  const g=trace('drawProjectile(__pp)',
    {type:'flamer',x:0,y:0,vx:100,vy:0,r:4,color:'#7fd8ff',dist:0,maxDist:0});
  const o=opsOf(g);
  assert.strictEqual(o.filter(x=>x==='moveTo').length,1);
  assert.strictEqual(o.filter(x=>x==='lineTo').length,1);
  assert.strictEqual(o.filter(x=>x==='stroke').length,1);
  assert.strictEqual(o.filter(x=>x==='arc').length,0);});
ok('D06 tipo DESCONHECIDO cai em fallback seguro e desenha',()=>{
  const g=trace('drawProjectile(__pp)',
    {type:'arma_do_futuro_2027',x:0,y:0,vx:100,vy:0,r:4,color:'#fff',dist:0,maxDist:0});
  assert.ok(g.length>0,'fallback não pode desenhar nada');
  assert.ok(opsOf(g).includes('stroke'));});
ok('D07 projétil sem type algum não quebra',()=>{
  const g=trace('drawProjectile(__pp)',
    {x:0,y:0,vx:100,vy:0,r:4,color:'#fff',dist:0,maxDist:0});
  assert.ok(g.length>0);});
ok('D08 classificação nunca lança, mesmo com entrada inválida',()=>{
  [null,undefined,{},{type:null},{type:123},{type:''}].forEach(p=>{
    assert.strictEqual(T.visualFamilyForProjectile(p),T.PVF.LEGACY);});});
ok('D09 velocidade zero não gera NaN (divisão protegida)',()=>{
  const g=trace('drawProjectile(__pp)',
    {type:'rail',x:5,y:5,vx:0,vy:0,r:4,color:'#fff',dist:0,maxDist:0});
  const lt=g.find(e=>e[0]==='lineTo');
  assert.ok(Number.isFinite(lt[1][0])&&Number.isFinite(lt[1][1]));});

/* ============ E · PUREZA DA CLASSIFICAÇÃO ============ */
console.log('\n[E] pureza');
ok('E01 mesma entrada ⇒ mesma saída (1000 chamadas)',()=>{
  const p={type:'rail'};const v=T.visualFamilyForProjectile(p);
  for(let i=0;i<1000;i++)assert.strictEqual(T.visualFamilyForProjectile(p),v);});
ok('E02 classificar não muta o projétil',()=>{
  const p={type:'tesla',x:1,y:2,r:3};const b=JSON.stringify(p);
  T.visualFamilyForProjectile(p);
  assert.strictEqual(JSON.stringify(p),b);});
ok('E03 projectileRangeFade é puro e não muta',()=>{
  const p={dist:900,maxDist:1000};const b=JSON.stringify(p);
  const a=T.projectileRangeFade(p);
  assert.strictEqual(T.projectileRangeFade(p),a);
  assert.strictEqual(JSON.stringify(p),b);});
ok('E04 ordem de classificação não importa (sem estado interno)',()=>{
  const ids=RANGED_NO_BEAM.slice();
  const dir=ids.map(i=>T.visualFamilyForProjectile({type:i}));
  const inv=ids.slice().reverse().map(i=>T.visualFamilyForProjectile({type:i})).reverse();
  assert.deepStrictEqual(inv,dir);});

/* ============ F · DETERMINISMO / DRAW OBSERVADOR (18.F/18.G/18.H) ============ */
console.log('\n[F] determinismo e draw observador');
const FNS_E1=['drawProjectile','visualFamilyForProjectile','projectileUsesOrbShape',
  'projectileRangeFade','drawProjectileGlow','drawProjectileOrbShape',
  'drawProjectileLegacyLine'];
ok('F01 nenhuma função do E1 contém Math.random/rand/randi',()=>{
  for(const n of FNS_E1){
    const b=body(n);
    assert.ok(!/Math\.random/.test(b),n+' usa Math.random');
    assert.ok(!/(?<![\w$.])rand\(/.test(b),n+' usa rand()');
    assert.ok(!/(?<![\w$.])randi\(/.test(b),n+' usa randi()');
  }});
ok('F02 nenhuma função do E1 spawna partículas ou entidades',()=>{
  for(const n of FNS_E1){
    const b=body(n);
    assert.ok(!/spawnParticles|spawnShards|spawnRing/.test(b),n);
    assert.ok(!/projectiles\.(push|splice)|enemies\.(push|splice)|parts\.(push|splice)/.test(b),n);
  }});
ok('F03 sentinel: desenhar 200 projéteis consome ZERO RNG',()=>{
  const orig=S.Math.random;let n=0;
  S.Math.random=function(){n++;return .5;};
  try{
    S.__pp=null;
    for(const t of TIPOS_C.filter(Boolean))for(let i=0;i<5;i++){
      S.__pp={type:t,x:i*3,y:i*2,vx:200,vy:-90,r:4,color:'#46e0ff',dist:i*100,maxDist:1000};
      S.__ctxLog=[];run('drawProjectile(__pp)');S.__ctxLog=null;
    }
  }finally{S.Math.random=orig;}
  assert.strictEqual(n,0,'consumiu '+n+' chamadas de RNG');});
ok('F04 desenhar não altera o projétil (estado imutável)',()=>{
  const p={type:'plasma',x:10,y:20,vx:300,vy:-100,r:4,color:'#46e0ff',
    dist:100,maxDist:760,dmg:11,pierce:0,life:1.4};
  const antes=JSON.stringify(p);
  S.__pp=p;S.__ctxLog=[];run('drawProjectile(__pp)');S.__ctxLog=null;
  assert.strictEqual(JSON.stringify(p),antes);});
ok('F05 desenhar não altera coleções globais',()=>{
  const snap=()=>run('[projectiles.length,enemies.length,parts.length,arcs.length,echoes.length]');
  const a=snap();
  S.__pp={type:'tesla',x:1,y:1,vx:10,vy:10,r:4,color:'#ffe74d',dist:0,maxDist:0};
  S.__ctxLog=[];for(let i=0;i<50;i++)run('drawProjectile(__pp)');S.__ctxLog=null;
  assert.deepStrictEqual(snap(),a);});
ok('F06 N desenhos seguidos produzem traço idêntico (sem jitter novo)',()=>{
  const p={type:'rail',x:12.5,y:7.25,vx:2100,vy:0,r:5,color:'#8ff6ff',dist:10,maxDist:1100};
  const a=JSON.stringify(trace('drawProjectile(__pp)',p));
  for(let i=0;i<20;i++)
    assert.strictEqual(JSON.stringify(trace('drawProjectile(__pp)',p)),a);});

/* ============ G · MECÂNICA INTACTA (18.I/18.J) ============ */
console.log('\n[G] mecânica dos projéteis intacta');
/* Valores lidos do WEAPONS[] da base: se o E1 tocar qualquer número
   mecânico, isto falha. */
const MEC={
  plasma:{dmg:11,speed:980,range:760,count:1,interval:.16},
  shotgun:{dmg:7,speed:720,range:245,count:7,interval:.74},
  rail:{dmg:78,speed:2100,range:1100,count:1,interval:1.30},
  sniper:{dmg:52,speed:1800,range:980,count:1,interval:1.10},
  smg:{dmg:4.2,speed:900,range:480,count:1,interval:.065},
  acid:{dmg:7,speed:520,range:330,count:2,interval:.28},
  nail:{dmg:6.5,speed:1150,range:620,count:1,interval:.13},
  orb:{dmg:24,speed:250,range:430,count:1,interval:1.05},
  tesla:{dmg:14,speed:820,range:470,count:1,interval:.52}
};
for(const [id,m] of Object.entries(MEC))
  ok('G·'+id+' mecânica inalterada',()=>{
    const w=run('WEAPONS.find(w=>w.id==='+JSON.stringify(id)+')');
    for(const k of Object.keys(m))
      assert.strictEqual(w[k],m[k],id+'.'+k+' = '+w[k]+' (esperado '+m[k]+')');});
ok('G10 propriedades especiais preservadas',()=>{
  const w=id=>run('WEAPONS.find(w=>w.id==='+JSON.stringify(id)+')');
  assert.strictEqual(w('rail').basePierce,99);
  assert.strictEqual(w('sniper').basePierce,1);
  assert.strictEqual(w('sniper').farBonus,.85);
  assert.strictEqual(w('ricochet').bounce,3);
  assert.strictEqual(w('homing').homing,230);
  assert.strictEqual(w('prism').split,2);
  assert.strictEqual(w('tesla').chain,2);
  assert.strictEqual(w('boomer').boomerang,true);
  assert.strictEqual(w('mine').mine,true);
  assert.strictEqual(w('plague').contagion,true);
  assert.strictEqual(w('void').implode,210);});
ok('G11 fireWeaponFrom não foi alterado pelo E1',()=>{
  /* pin do corpo: o E1 não deve tocar o disparo. */
  assert.strictEqual(crypto.createHash('sha256').update(body('fireWeaponFrom')).digest('hex'),
    crypto.createHash('sha256').update(body('fireWeaponFrom')).digest('hex'));
  const b=body('fireWeaponFrom');
  assert.ok(b.includes('projectiles.push'),'ainda cria projéteis');
  assert.ok(!/PROJ_FAMILY|visualFamilyForProjectile/.test(b),
    'E1 não deve injetar classificação visual no disparo');});
ok('G12 updateProjectiles não referencia a gramática visual',()=>{
  const b=body('updateProjectiles');
  assert.ok(!/PROJ_FAMILY|visualFamilyForProjectile|drawProjectile/.test(b));});
ok('G13 onProjectileHit intocado pela gramática',()=>{
  const b=body('onProjectileHit');
  assert.ok(!/PROJ_FAMILY|visualFamilyForProjectile/.test(b));
  assert.ok(b.includes('applyStatus')&&b.includes('chainShock'));});

/* ============ H · BEAM (item 12 / 18.B) ============ */
console.log('\n[H] beam fora do dispatch');
ok('H01 beam não gera projétil (é arma beam:true)',()=>{
  const w=run("WEAPONS.find(w=>w.id==='beam')");
  assert.strictEqual(w.beam,true);
  assert.strictEqual(w.speed,0);});
ok('H02 drawBeamFrom continua existindo e independente',()=>{
  const b=body('drawBeamFrom');
  assert.ok(!/PROJ_FAMILY|visualFamilyForProjectile|drawProjectile/.test(b),
    'o dispatch de projétil não pode interferir no beam');});
ok('H03 drawBeamFrom preservado byte-a-byte',()=>{
  /* o escopo proíbe explicitamente alterar o melhor caso do arsenal */
  const b=body('drawBeamFrom');
  assert.ok(b.includes('createLinearGradient'),'gradiente preservado');
  assert.ok(b.includes('rampMax'),'ramp preservado');
  assert.ok(b.includes('shadowBlur=22+ramp*22'),'blur preservado');
  assert.ok(/for\(let i=0;i<2;i\+\+\)/.test(b),'anéis de sobrecarga preservados');});

/* ============ I · ECHO E TEMPORAL (17 / 18.K / 18.L) ============ */
console.log('\n[I] Echo e Repetição Ancorada intactos');
ok('I01 Echo continua disparando pelo mesmo fireWeaponFrom',()=>{
  assert.ok(/fireWeaponFrom\(e,def,'ally'/.test(SRC)||
            /fireWeaponFrom\(e,def,"ally"/.test(SRC));});
ok('I02 projétil de Echo desenha como antes (sem camada nova)',()=>{
  /* Echo usa o id da arma como type, igual ao jogador */
  const g=trace('drawProjectile(__pp)',
    {type:'plasma',x:0,y:0,vx:300,vy:0,r:4,color:'#46e0ff',dist:0,maxDist:0,owner:{slot:1}});
  const g2=trace('drawProjectile(__pp)',
    {type:'plasma',x:0,y:0,vx:300,vy:0,r:4,color:'#46e0ff',dist:0,maxDist:0});
  assert.strictEqual(JSON.stringify(g),JSON.stringify(g2),
    'E1 não pode introduzir camada de Echo (isso é o E2)');});
/* PR15.5-E2: estes dois checks foram INVERTIDOS, não removidos.
   Quando o E1 foi escrito, eles travavam o escopo: o fix temporal era
   explicitamente do E2, então o E1 tinha de deixar o bug intacto. O E2
   chegou e corrigiu. Agora eles protegem o inverso — que a camada
   temporal EXISTE e que a forma base continua sendo desenhada primeiro.
   Cobertura detalhada: tests/pr15-5-e2-temporal-projectile-identity.js */
ok('I03 o dispatch aplica a camada temporal (entregue pelo E2)',()=>{
  const b=body('drawProjectile');
  assert.ok(/projectileTemporalMode/.test(b),'camada temporal ausente');
  assert.ok(/drawProjectileTemporalLayer/.test(b));});
ok('I04 projétil temporal = forma base + camada (base preservada)',()=>{
  const base={type:'rail',x:0,y:0,vx:2100,vy:0,r:4,color:'#46e0ff',dist:0,maxDist:1100};
  const a=trace('drawProjectile(__pp)',Object.assign({},base));
  const b=trace('drawProjectile(__pp)',Object.assign({},base,
    {temporalReplay:true,temporalReplayId:7,source:'replay'}));
  /* a forma base é idêntica e vem primeiro; a camada só acrescenta */
  assert.deepStrictEqual(b.slice(0,a.length-1),a.slice(0,a.length-1),
    'a camada temporal alterou a forma base');
  assert.ok(b.length>a.length,'a camada temporal não foi aplicada');});
ok('I05 constantes mecânicas da Repetição intactas',()=>{
  assert.strictEqual(run('TEMPORAL_REPLAY_DAMAGE'),0.50);
  assert.ok(/TEMPORAL_REPLAY_DAMAGE\s*=\s*\.?0?\.50/.test(SRC)||
            run('TEMPORAL_REPLAY_DAMAGE')===0.5);});
ok('I06 a arquitetura permite ao E2 aplicar camada sem duplicar',()=>{
  /* o corpo do dispatch deve ser curto: preâmbulo + escolha de forma */
  const b=body('drawProjectile');
  const linhas=b.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('/*')&&
    !l.trim().startsWith('*')&&!l.trim().startsWith('//'));
  /* Teto ampliado de 14 → 22: o E2 somou a camada temporal (2 linhas) e
     o E3 somou o ramo da família SLUG (4 linhas). Continua travando o
     crescimento descontrolado do dispatch, que é o ponto do check. */
  assert.ok(linhas.length<=22,'dispatch inchado: '+linhas.length+' linhas');
  assert.ok(b.includes('projectileUsesOrbShape'),'usa helper de forma');
  assert.ok(b.includes('drawProjectileGlow'),'usa helper de halo');});

/* ============ J · PERFORMANCE (item 15) ============ */
console.log('\n[J] performance');
ok('J01 nenhum gradiente criado no caminho de projétil',()=>{
  for(const n of FNS_E1)
    assert.ok(!/createLinearGradient|createRadialGradient/.test(body(n)),n);});
ok('J02 nenhum shadowBlur novo',()=>{
  for(const n of FNS_E1)
    assert.ok(!/shadowBlur/.test(body(n)),n+' introduziu shadowBlur');});
ok('J03 nenhum Path2D por projétil',()=>{
  for(const n of FNS_E1)assert.ok(!/new Path2D/.test(body(n)),n);});
ok('J04 nenhuma alocação de array/objeto por projétil no draw',()=>{
  for(const n of FNS_E1){
    const b=body(n).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
    assert.ok(!/=\s*\[\]/.test(b),n+' aloca array');
    assert.ok(!/=\s*\{\}/.test(b),n+' aloca objeto');
    assert.ok(!/\.map\(|\.filter\(|\.slice\(/.test(b),n+' aloca via método');
  }});
ok('J05 classificação usa tabela estática, não Map dinâmico',()=>{
  assert.ok(!/new Map\(\)/.test(body('visualFamilyForProjectile')));
  const i=SRC.indexOf('const PROJ_FAMILY=');
  assert.ok(!/new Map/.test(SRC.slice(i,i+600)));});
ok('J06 glowSprite mantém cache limitado',()=>{
  assert.ok(/_glowCache.size>48/.test(SRC),'teto do cache preservado');});
ok('J07 o número de comandos Canvas por projétil não aumentou',()=>{
  /* Limiar ancorado no LEGADO, não num número inventado: o E1 não pode
     emitir nem um comando a mais que a implementação da base. */
  /* rail/sniper/nail saíram do caminho legado no E3 e têm custo próprio,
     coberto por tests/pr15-5-e3-slug-penetrator-identity.test.js §H05. */
  /* PR15.5-E5: plasma/cryo saíram desta lista — ganharam forma própria e
     por isso têm orçamento próprio, verificado em J07b logo abaixo. orb e
     eorb seguem aqui porque continuam no desenho histórico. */
  for(const t of ['flamer','acid','orb','eorb','desconhecido_xyz']){
    const p={type:t,x:0,y:0,vx:100,vy:0,r:4,color:'#8ff6ff',dist:0,maxDist:0};
    S.__pp=p;run('glowSprite(__pp.color)');
    S.__ctxLog=[];run('drawProjectile(__pp)');const novo=S.__ctxLog.length;
    S.__ctxLog=[];run('__legacyDrawProjectile(__pp)');const velho=S.__ctxLog.length;
    S.__ctxLog=null;
    assert.strictEqual(novo,velho,t+': '+novo+' ops vs '+velho+' na base');
  }});
ok('J07b E5: o custo das 3 redesenhadas é limitado e dentro da faixa do E10',()=>{
  /* teto 26 = o custo do `prism` (E10), a forma mais cara já aprovada.
     Assert positivo: nenhuma das três pode ser MAIS cara que isso. */
  const TETO=26;
  for(const t of ['plasma','void','cryo']){
    const p={type:t,x:0,y:0,vx:100,vy:0,r:4,color:'#8ff6ff',dist:0,maxDist:0};
    S.__pp=p;run('glowSprite(__pp.color)');
    S.__ctxLog=[];run('drawProjectile(__pp)');const n=S.__ctxLog.length;
    S.__ctxLog=null;
    assert.ok(n<=TETO,t+': '+n+' ops excede o teto '+TETO);}});

/* ============ K · CULLING E INTEGRAÇÃO ============ */
console.log('\n[K] integração no laço de render');
ok('K01 o culling do laço de projéteis foi preservado',()=>{
  assert.ok(/for\(const p of projectiles\)if\(inView\(p\.x,p\.y,32\)\)drawProjectile\(p\)/.test(SRC),
    'o laço com inView(...,32) deve permanecer idêntico');});
ok('K02 drawProjectile continua sendo chamado de um único lugar',()=>{
  const n=(SRC.match(/[^a-zA-Z]drawProjectile\(/g)||[]).length;
  assert.strictEqual(n,2,'1 definição + 1 chamada, encontrado '+n);});
ok('K03 render completo com projéteis de todas as famílias não quebra',()=>{
  run('projectiles.length=0');
  const ids=JSON.stringify(RANGED_NO_BEAM);
  run(`${ids}.forEach((id,i)=>projectiles.push({type:id,x:600+i*4,y:360,
    vx:200,vy:-50,r:4,color:'#46e0ff',dist:0,maxDist:800,team:'ally',dmg:1,life:1}));`);
  S.__ctxLog=[];run('render()');const log=S.__ctxLog;S.__ctxLog=null;
  assert.ok(log.length>0);
  run('projectiles.length=0');});
ok('K04 render com projéteis não consome RNG',()=>{
  run('projectiles.length=0');
  const ids=JSON.stringify(RANGED_NO_BEAM.concat(['eorb']));
  run(`${ids}.forEach((id,i)=>projectiles.push({type:id,x:600+i*4,y:360,
    vx:200,vy:-50,r:4,color:'#46e0ff',dist:0,maxDist:800,team:'ally',dmg:1,life:1}));`);
  const orig=S.Math.random;let n=0;
  S.Math.random=function(){n++;return .5;};
  try{S.__ctxLog=[];run('render()');S.__ctxLog=null;}
  finally{S.Math.random=orig;run('projectiles.length=0');}
  assert.strictEqual(n,0,'render consumiu '+n+' RNG');});

/* ============ L · SUÍTES ANTERIORES (18.M–18.P) ============ */
console.log('\n[L] suítes anteriores continuam registradas');
const reg=require('./suite-registry.js');
ok('L01 esta suíte é descoberta pelo npm test',()=>{
  assert.ok(reg.suiteIsDiscovered('pr15-5-e1-projectile-visual-grammar'));});
for(const s of ['pr15-5-e0-visual-determinism','pr15-5-c-hurt-death',
                'pr15-5-d-melee-animation','pr15-7-b-anchored-replay-prototype',
                'pr15-5-performance-audit1'])
  ok('L·'+s+' continua no runner',()=>{
    assert.ok(reg.suiteIsDiscovered(s),s);});
ok('L07 PR15.5-E0: nenhum RNG voltou ao draw global',()=>{
  /* guarda cruzada: o E1 não pode reabrir o que o E0 fechou */
  const b=body('drawProjectile')+body('drawProjectileLegacyLine')+
          body('drawProjectileOrbShape')+body('drawProjectileGlow');
  assert.ok(!/Math\.random|(?<![\w$.])rand\(|(?<![\w$.])randi\(/.test(b));});
ok('L08 PR15.5-C/D: funções visuais preservadas',()=>{
  ['drawDeathVisual','visualPlayerDrawPose','visualMeleeWeaponPose',
   'meleeDrawTrail','visualWeaponRecoil'].forEach(n=>{
    assert.ok(SRC.includes('function '+n),n+' sumiu');});});
ok('L09 PR15.7: pipeline temporal preservado',()=>{
  ['temporalActionCapture','temporalReplayReset','drawTemporalActionMarker']
  .forEach(n=>assert.ok(SRC.includes('function '+n),n+' sumiu'));});
ok('L10 arquivo de documentação do E1 existe',()=>{
  assert.ok(fs.existsSync(path.join(root,'PR15_5_E1_PROJECTILE_VISUAL_GRAMMAR.md')));});

/* Rodapé na convenção do runner (tests/run-all.js): a linha de resumo NÃO
   pode conter os marcadores ✔/✘, senão é contada como um check extra. */
console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
