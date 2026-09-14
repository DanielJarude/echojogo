'use strict';
/* ECHO — PR15.5-E4 · ENXAME / MÚLTIPLO — identidade do PROJÉTIL
   ---------------------------------------------------------------------
   SMG, Shotgun, Homing e Prism caíam todas em drawProjectileLegacyLine:
   UM traço de comprimento 5 e largura p.r. As quatro eram, literalmente,
   a mesma geometria recolorida.

   O E8 já diferenciou a EMISSÃO. Este bloco diferencia o PROJÉTIL.

   Critério central: se cor, glow e partículas forem removidos, a FORMA
   ainda precisa dizer o que é. Por isso toda prova aqui compara
   TOPOLOGIA (sequência estrutural de ops de path), nunca cor, largura
   ou alpha. */
const assert=require('assert'),fs=require('fs'),path=require('path');
const {world,readSource}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}}
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5-E4 · ENXAME / MÚLTIPLO');

const SWARM=['smg','shotgun','homing','prism'];
const GEOM=['beginPath','moveTo','lineTo','arc','closePath','fill','stroke','rect','quadraticCurveTo','bezierCurveTo'];
run('glowSprite("#ffffff")');   // aquece o cache do sprite antes de logar
/* Desenha um projétil e devolve o log bruto de Canvas. */
function draw(over){
  const p=Object.assign({type:'smg',x:100,y:100,vx:1000,vy:0,r:4,
    color:'#ffffff',dist:0,maxDist:1100},over||{});
  S.__pp=p;
  S.__ctxLog=[];run('drawProjectile(__pp)');const l=S.__ctxLog;S.__ctxLog=null;
  return l;
}
/* Assinatura ESTRUTURAL: só a sequência de ops de path, sem coordenadas,
   sem cor, sem largura. É o que prova topologia. */
const topo=over=>draw(over).filter(e=>GEOM.includes(e[0])).map(e=>e[0]).join(',');
/* Coordenadas dos vértices, para provas de orientação e escala. */
function verts(over){
  return draw(over).filter(e=>e[0]==='moveTo'||e[0]==='lineTo').map(e=>[e[1][0],e[1][1]]);
}
const opsCount=over=>draw(over).length;
run('__ECHO_AUDIT_FIXTURES.prepare("E")');

/* ============ A–E · MAPEAMENTO DE FAMÍLIA (21.A–E) ============ */
console.log('\n[A] família e roteamento');
for(const id of SWARM)
  ok('A·'+id+' mapeia para ENXAME/MÚLTIPLO',()=>{
    assert.strictEqual(run('PROJ_FAMILY['+JSON.stringify(id)+']'),T.PVF.SWARM);
    assert.strictEqual(T.visualFamilyForProjectile({type:id}),T.PVF.SWARM);});
ok('E01 helper dedicado existe e as 4 chegam nele (21.E)',()=>{
  assert.strictEqual(typeof T.drawProjectileSwarm,'function');
  const b=SRC.match(/function drawProjectile\(p\)\{[\s\S]*?\n\}/)[0];
  assert.ok(b.includes('drawProjectileSwarm'),'dispatcher não encaminha');
  assert.ok(/PVF_SWARM\)drawProjectileSwarm/.test(b),'roteamento por família');});
ok('E02 o dispatcher do E1 segue sendo o ponto único (§11)',()=>{
  assert.strictEqual((SRC.match(/drawProjectileSwarm\(/g)||[]).length,2,
    '1 definição + 1 chamada no dispatcher');});
ok('E03 nenhuma das 4 continua na linha legada',()=>{
  const legado=topo({type:'cryo'});
  for(const id of SWARM)
    assert.notStrictEqual(topo({type:id}),legado,id+' ainda é o traço legado');});

/* ============ F–K · TOPOLOGIAS DISTINTAS (21.F–K / §22) ============ */
console.log('\n[B] topologias distintas entre si');
const TOPO={};SWARM.forEach(id=>TOPO[id]=topo({type:id}));
const pares=[['smg','shotgun'],['smg','homing'],['smg','prism'],
             ['shotgun','homing'],['shotgun','prism'],['homing','prism']];
for(const [a,b] of pares)
  ok('B·'+a+' topology != '+b+' topology',()=>{
    assert.notStrictEqual(TOPO[a],TOPO[b],a+' e '+b+' têm a mesma estrutura');});
ok('B07 as 4 assinaturas são todas únicas',()=>{
  assert.strictEqual(new Set(Object.values(TOPO)).size,4);});
ok('B08 L · mesma cor NÃO elimina a diferenciação (21.L / §2)',()=>{
  /* prova central da direção artística: cor idêntica, tamanho idêntico,
     direção idêntica — a forma tem de decidir sozinha */
  const t={};
  for(const id of SWARM)
    t[id]=topo({type:id,color:'#ffffff',r:4,vx:1000,vy:0});
  assert.strictEqual(new Set(Object.values(t)).size,4,
    'com a mesma cor as formas colapsaram: '+JSON.stringify(t));});
ok('B09 nem mesmo as coordenadas coincidem entre as 4',()=>{
  const v=SWARM.map(id=>JSON.stringify(verts({type:id})));
  assert.strictEqual(new Set(v).size,4);});
ok('B10 SMG é um corpo compacto e fechado (§10)',()=>{
  const t=TOPO.smg;
  assert.ok(t.includes('closePath,fill'),'SMG deve ter área preenchida');
  assert.strictEqual((t.match(/beginPath/g)||[]).length,1,'1 só corpo');
  assert.strictEqual((t.match(/stroke/g)||[]).length,0,'sem stroke extra');});
ok('B11 Shotgun é fragmento assimétrico, não o losango do SMG (§7)',()=>{
  const nS=(TOPO.smg.match(/lineTo/g)||[]).length;
  const nG=(TOPO.shotgun.match(/lineTo/g)||[]).length;
  assert.ok(nG>nS,'pellet deve ter mais vértices que a cápsula ('+nG+' vs '+nS+')');
  /* assimetria real: os vértices não são espelhados sobre o eixo do voo */
  const v=verts({type:'shotgun',vx:1000,vy:0});
  const offs=v.map(q=>+(q[1]-100).toFixed(4));
  const pos=offs.filter(o=>o>0).length,neg=offs.filter(o=>o<0).length;
  assert.notStrictEqual(pos,neg,'pellet saiu simétrico: '+offs);});
ok('B12 Shotgun NÃO desenha leque artificial por pellet (§7/§27)',()=>{
  const b=body('drawProjectileSwarm');
  assert.ok(!/for\s*\(/.test(b.split("t==='homing'")[0].split("t==='shotgun'")[1]||''),
    'pellet não deve iterar sub-formas');
  assert.strictEqual((TOPO.shotgun.match(/beginPath/g)||[]).length,1,
    'cada pellet é UMA unidade barata');});

/* ============ M · HOMING: ORIENTAÇÃO (21.M / §19) ============ */
console.log('\n[C] Homing — buscador orientado');
function body(name){
  const m=SRC.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(m,'função não encontrada: '+name);return m[0];}
ok('C01 geometria acompanha a orientação: vx>0 vs vy>0 (§19)',()=>{
  const hx=verts({type:'homing',vx:500,vy:0});
  const hy=verts({type:'homing',vx:0,vy:500});
  assert.notStrictEqual(JSON.stringify(hx),JSON.stringify(hy),
    'a forma ignorou a direção');
  /* voando em +x, a ogiva é o ponto de maior x; em +y, o de maior y */
  const maxX=Math.max(...hx.map(q=>q[0])), maxXy=Math.max(...hx.map(q=>q[1]));
  assert.ok(maxX>100+4,'ogiva deve apontar para +x');
  const maxY=Math.max(...hy.map(q=>q[1]));
  assert.ok(maxY>100+4,'ogiva deve apontar para +y');
  /* e a extensão principal troca de eixo */
  const extX=q=>Math.max(...q.map(v=>v[0]))-Math.min(...q.map(v=>v[0]));
  const extY=q=>Math.max(...q.map(v=>v[1]))-Math.min(...q.map(v=>v[1]));
  assert.ok(extX(hx)>extY(hx),'em +x o corpo deve ser mais longo em x');
  assert.ok(extY(hy)>extX(hy),'em +y o corpo deve ser mais longo em y');});
ok('C02 orientação em diagonal também é seguida',()=>{
  const d=verts({type:'homing',vx:400,vy:400});
  const maxq=d.reduce((a,q)=>(q[0]+q[1])>(a[0]+a[1])?q:a,d[0]);
  assert.ok(maxq[0]>100&&maxq[1]>100,'ogiva não seguiu a diagonal');});
ok('C03 tem frente/trás clara — assimetria no eixo (§8)',()=>{
  const v=verts({type:'homing',vx:500,vy:0});
  const front=Math.max(...v.map(q=>q[0]))-100;
  const back=100-Math.min(...v.map(q=>q[0]));
  assert.notStrictEqual(front.toFixed(3),back.toFixed(3),'simétrico demais');});
ok('C04 possui estabilizadores: corpo fechado + apêndices (§8/§10)',()=>{
  const t=TOPO.homing;
  assert.ok(t.includes('closePath,fill'),'casco preenchido');
  assert.ok(t.includes('stroke'),'aletas');
  /* 2 aletas = 2 sub-traços independentes dentro de um mesmo path */
  const sub=t.split('closePath,fill')[1]||'';
  assert.strictEqual((sub.match(/moveTo/g)||[]).length,2,'devem existir 2 aletas');});
ok('C05 não é círculo nem só glow (§8)',()=>{
  assert.ok(!TOPO.homing.includes('arc'),'buscador não pode ser bolinha');});
ok('C06 nenhum ctx.rotate/save/restore por projétil (§12/§19)',()=>{
  const b=body('drawProjectileSwarm');
  assert.ok(!/ctx\.rotate|ctx\.save|ctx\.restore|ctx\.translate|setTransform/.test(b),
    'deve usar matemática vetorial, não transformação de contexto');
  for(const id of SWARM){
    const l=draw({type:id}).map(e=>e[0]);
    ['rotate','save','restore','translate'].forEach(o=>
      assert.ok(!l.includes(o),id+' emitiu ctx.'+o));}});
ok('C07 steering mecânico intacto (§28)',()=>{
  assert.strictEqual(run('WEAPONS.find(w=>w.id==="homing").homing'),230);
  const up=SRC.match(/if\(p\.homing\)\{[\s\S]*?\n    \}/)[0];
  assert.ok(up.includes('p.homing/180*Math.PI*dt*3.2'),'turn rate alterado');
  assert.ok(up.includes('460*460'),'raio de aquisição alterado');});

/* ============ N · PRISM: FACETAS (21.N / §20) ============ */
console.log('\n[D] Prism — construção facetada');
ok('D01 possui mais de um plano estrutural (§20)',()=>{
  const t=TOPO.prism;
  const planos=(t.match(/closePath,fill/g)||[]).length;
  assert.ok(planos>=2,'só '+planos+' plano(s) — um triângulo preenchido não basta');});
ok('D02 a aresta de divisão é desenhada',()=>{
  assert.ok(TOPO.prism.includes('stroke'),'falta a aresta entre facetas');});
ok('D03 não é um triângulo simples',()=>{
  const t=TOPO.prism;
  assert.notStrictEqual(t,'beginPath,moveTo,lineTo,lineTo,closePath,fill');
  assert.ok((t.match(/beginPath/g)||[]).length>=3,'poucos sub-paths para facetar');});
ok('D04 as duas facetas têm larguras diferentes (faceta ≠ repetição)',()=>{
  const v=verts({type:'prism',vx:1000,vy:0});
  const larguras=new Set(v.map(q=>Math.abs(q[1]-100).toFixed(3)));
  assert.ok(larguras.size>=3,'planos idênticos não leem como faceta: '+[...larguras]);});
ok('D05 fragmento pós-split usa a mesma gramática em escala menor',()=>{
  /* mecânica real: split=2, fragmento nasce com def:null e sem split */
  const pai=topo({type:'prism',split:2,r:3.4});
  const frag=topo({type:'prism',split:0,def:null,r:3.4*.8});
  assert.strictEqual(pai,frag,'fragmento deve herdar a forma da família');});
ok('D06 mecânica de divisão intacta (§29)',()=>{
  assert.strictEqual(run('WEAPONS.find(w=>w.id==="prism").split'),2);
  const oh=body('onProjectileHit');
  assert.ok(oh.includes('if(p.split>0)')&&oh.includes('const n=2'));
  assert.ok(oh.includes('p.dmg*.55')&&oh.includes('maxDist:260'));});

/* ============ O–T · ORTOGONALIDADE (21.O–T) ============ */
console.log('\n[E] ortogonalidade com E3 / E2 / E8');
ok('O01 nenhuma das 4 usa drawProjectileSlug (21.O)',()=>{
  const b=body('drawProjectileSwarm');
  assert.ok(!/drawProjectileSlug/.test(b));
  for(const id of SWARM)
    for(const slug of ['rail','sniper','nail'])
      assert.notStrictEqual(TOPO[id],topo({type:slug}),id+' copiou '+slug);});
ok('O02 E3 preservado: rail/sniper/nail inalterados (§16)',()=>{
  assert.strictEqual(topo({type:'rail'}),
    'beginPath,moveTo,lineTo,lineTo,lineTo,closePath,fill,beginPath,moveTo,lineTo,stroke');
  assert.strictEqual(topo({type:'sniper'}),
    'beginPath,moveTo,lineTo,stroke,beginPath,moveTo,lineTo,stroke');
  assert.strictEqual(topo({type:'nail'}),
    'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,lineTo,closePath,fill');
  assert.strictEqual(run('SNIPER_FAR_DIST'),450);});
ok('O03 famílias fora do E4 seguem na linha legada (§35)',()=>{
  /* ricochet/boomer/gatling/mine ganharam forma própria no PR15.5-E10 */
  const legado=topo({type:'cryo'});
  for(const id of ['plasma','flamer','acid','tesla','void','plague'])
    assert.strictEqual(topo({type:id}),legado,id+' foi alterado fora do escopo');});
ok('O03b E10: as 4 cinéticas não copiam nenhuma forma do enxame',()=>{
  const legado=topo({type:'cryo'});
  for(const id of ['ricochet','boomer','gatling','mine']){
    assert.notStrictEqual(topo({type:id}),legado,id+' deveria ter forma própria');
    for(const sw of SWARM)
      assert.notStrictEqual(topo({type:id})+'|'+JSON.stringify(verts({type:id})),
        topo({type:sw})+'|'+JSON.stringify(verts({type:sw})),id+' == '+sw);}});
/* Contrato REAL do E2: Echo é owner.slot>0 && owner.data — não uma flag
   solta no projétil (o E2 proibiu explicitamente heurística por flag). */
const ECHO_OWNER={slot:1,data:{}};
ok('P01 E2 temporal continua aplicado sobre a nova forma (21.P)',()=>{
  for(const id of SWARM){
    const base=topo({type:id});
    assert.strictEqual(T.projectileTemporalMode({owner:ECHO_OWNER}),T.PTM.ECHO,
      'premissa: owner com slot/data é Echo');
    const eco=topo({type:id,owner:ECHO_OWNER});
    assert.ok(eco.length>base.length,id+' perdeu a camada temporal');
    assert.ok(eco.startsWith(base),id+' a forma base deixou de vir primeiro');}});
ok('Q01 temporal replay continua visualmente válido (21.Q)',()=>{
  for(const id of SWARM){
    const base=topo({type:id});
    const rep=topo({type:id,temporalReplay:true});
    assert.ok(rep.length>base.length&&rep.startsWith(base),id);
    assert.notStrictEqual(rep,topo({type:id,owner:ECHO_OWNER}),
      id+' replay e echo colapsaram');}});
ok('Q02 helpers do E2 não foram tocados (§15)',()=>{
  for(const n of ['projectileTemporalMode','drawProjectileTemporalLayer'])
    assert.ok(!/drawProjectileSwarm/.test(body(n)),n);
  assert.strictEqual(T.projectileTemporalMode({temporalReplay:true}),T.PTM.REPLAY);
  assert.strictEqual(T.projectileTemporalMode({owner:ECHO_OWNER}),T.PTM.ECHO);
  /* e o jogador comum continua sem camada */
  assert.strictEqual(T.projectileTemporalMode({owner:null}),T.PTM.NONE);});
ok('R01 Echo herda a forma automaticamente (21.R)',()=>{
  /* o desenho depende só de p.type — não de owner/team */
  for(const id of SWARM)
    assert.strictEqual(topo({type:id,team:'ally',owner:null}),TOPO[id],id);
  const b=body('drawProjectileSwarm');
  assert.ok(!/owner|team|isEcho|echoes/.test(b),
    'a forma deve depender do tipo da arma, não de quem disparou');});
ok('S01 eorb inimigo não entra na família (21.S)',()=>{
  assert.strictEqual(run('PROJ_FAMILY["eorb"]'),undefined);
  assert.strictEqual(T.visualFamilyForProjectile({type:'eorb'}),T.PVF.LEGACY);
  assert.ok(topo({type:'eorb'}).includes('arc'),'eorb deve seguir orb');
  assert.strictEqual(topo({type:'eorb'}),topo({type:'orb'}));});
ok('T01 beam segue fora do dispatcher normal (21.T)',()=>{
  assert.strictEqual(run('PROJ_FAMILY["beam"]'),undefined);
  assert.ok(!/drawProjectileSwarm/.test(body('drawBeamFrom')));});
ok('T02 E8 muzzle intocado (§17)',()=>{
  for(const n of ['muzzleShot','muzzlePower','emitWeaponMuzzleVisual'])
    assert.ok(!/drawProjectileSwarm/.test(body(n)),n);
  assert.ok(Math.abs(T.muzzlePower({kick:280})-1.4)<1e-9);
  assert.ok(Math.abs(T.muzzlePower({kick:22})-0.80238095238)<1e-6);});

/* ============ U–X · DETERMINISMO, PUREZA E CUSTO ============ */
console.log('\n[F] determinismo, pureza e custo');
ok('U01 zero RNG no draw das 4 (21.U / §14)',()=>{
  const o=S.Math.random;let c=0;S.Math.random=function(){c++;return .5;};
  try{for(const id of SWARM)draw({type:id});}finally{S.Math.random=o;}
  assert.strictEqual(c,0,'draw consumiu '+c+' RNG');});
ok('U02 nenhum Math.random/rand/randi no helper',()=>{
  const b=body('drawProjectileSwarm');
  assert.ok(!/Math\.random/.test(b));
  assert.ok(!/(?<![\w$.])rand\(/.test(b));
  assert.ok(!/(?<![\w$.])randi\(/.test(b));});
ok('U03 draw repetido é byte-idêntico (20×)',()=>{
  for(const id of SWARM){
    const a=JSON.stringify(draw({type:id}));
    for(let i=0;i<20;i++)
      assert.strictEqual(JSON.stringify(draw({type:id})),a,id);}});
ok('V01 nenhuma mutação de estado no draw (21.V)',()=>{
  for(const id of SWARM){
    const p={type:id,x:100,y:100,vx:1000,vy:0,r:4,color:'#ffffff',dist:0,maxDist:1100};
    const before=JSON.stringify(p);
    S.__pp=p;S.__ctxLog=[];run('drawProjectile(__pp)');S.__ctxLog=null;
    assert.strictEqual(JSON.stringify(S.__pp),before,id+' mutou o projétil');}});
ok('W01 nenhuma coleção cresce no draw (21.W)',()=>{
  const snap=()=>Array.from(run('[parts.length,projectiles.length,enemies.length,arcs.length]'));
  const a=snap();
  for(const id of SWARM)for(let i=0;i<10;i++)draw({type:id});
  assert.deepStrictEqual(snap(),a);});
ok('W02 helper não aloca arrays/objetos nem usa cache (§12/§13)',()=>{
  const b=body('drawProjectileSwarm').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/=\s*\[\]|\.push\(|new [A-Z]|\.map\(|\.filter\(/.test(b));
  assert.ok(!/createLinearGradient|createRadialGradient|shadowBlur|new Path2D/.test(b));});
ok('X01 custo bounded por projétil (21.X / §24)',()=>{
  for(const id of SWARM){
    const n=opsCount({type:id});
    assert.ok(n<=30,id+' custa '+n+' ops');}});
ok('X02 SMG está entre os mais baratos (§24)',()=>{
  const c={};SWARM.forEach(id=>c[id]=opsCount({type:id}));
  const min=Math.min(...Object.values(c));
  assert.strictEqual(c.smg,min,'SMG deveria ser o mais barato: '+JSON.stringify(c));});
ok('X03 Shotgun é barato — cria 7 pellets por disparo',()=>{
  const g=opsCount({type:'shotgun'});
  assert.ok(g<=opsCount({type:'homing'}),'pellet mais caro que o buscador');
  assert.ok(g<=opsCount({type:'prism'}),'pellet mais caro que o prisma');
  assert.ok(g*run('WEAPONS.find(w=>w.id==="shotgun").count')<=140,
    'custo da salva completa: '+g*7);});
ok('X04 custo não cresce com repetição (sem estado acumulado)',()=>{
  for(const id of SWARM){
    const a=opsCount({type:id});
    for(let i=0;i<30;i++)draw({type:id});
    assert.strictEqual(opsCount({type:id}),a,id+' acumulou custo');}});
ok('X05 nenhum trail persistente foi adicionado (§13/§30)',()=>{
  const b=body('drawProjectileSwarm');
  assert.ok(!/trail|history|hist|prevX|lastX/.test(b));});

/* ============ ESCALA (§23) ============ */
console.log('\n[G] escala');
ok('G01 sanity bounds: nenhuma forma é absurda',()=>{
  for(const id of SWARM){
    const v=verts({type:id,r:4,vx:1000,vy:0});
    const ext=Math.max(...v.map(q=>Math.hypot(q[0]-100,q[1]-100)));
    assert.ok(ext>=3,id+' pequeno demais ('+ext.toFixed(1)+'px)');
    assert.ok(ext<=24,id+' grande demais ('+ext.toFixed(1)+'px)');}});
ok('G02 nenhuma é dramaticamente maior que Rail',()=>{
  const extOf=id=>{const v=verts({type:id,r:4,vx:1000,vy:0});
    return Math.max(...v.map(q=>Math.hypot(q[0]-100,q[1]-100)));};
  const rail=extOf('rail');
  for(const id of SWARM)
    assert.ok(extOf(id)<=rail,id+' ('+extOf(id).toFixed(1)+') supera rail ('+rail.toFixed(1)+')');});
ok('G03 menores que o raio típico de inimigo',()=>{
  for(const id of SWARM){
    const v=verts({type:id,r:4,vx:1000,vy:0});
    const ext=Math.max(...v.map(q=>Math.hypot(q[0]-100,q[1]-100)));
    assert.ok(ext<16,id+' maior que um inimigo médio (r≈16)');}});
ok('G04 escala acompanha p.r proporcionalmente',()=>{
  for(const id of SWARM){
    const e=r=>{const v=verts({type:id,r:r,vx:1000,vy:0});
      return Math.max(...v.map(q=>Math.hypot(q[0]-100,q[1]-100)));};
    assert.ok(e(8)>e(4),id+' ignora p.r');}});

/* ============ MECÂNICA (§26/§27/§30) ============ */
console.log('\n[H] mecânica preservada');
ok('H01 defs das 4 armas inalteradas (§26)',()=>{
  const ESP={
    smg:{interval:.065,speed:900,dmg:4.2,count:1,spread:0,jitter:.13,life:1,pr:2.6,kick:22,range:480,color:'#c9f56b'},
    shotgun:{interval:.74,speed:720,dmg:7,count:7,spread:.13,jitter:.09,life:1,pr:3.5,kick:210,range:245,color:'#ffb347'},
    homing:{interval:.85,speed:420,dmg:17,count:3,spread:.45,jitter:.1,life:3,pr:4.5,kick:34,range:760,color:'#ff9d3c'},
    prism:{interval:.4,speed:760,dmg:9,count:3,spread:.22,jitter:.02,life:1.3,pr:3.4,kick:44,range:540,color:'#8ff6ff'}};
  for(const [id,exp] of Object.entries(ESP)){
    const w=W(id);
    for(const [k,v] of Object.entries(exp))assert.strictEqual(w[k],v,id+'.'+k);}});
function W(id){return run('WEAPONS.find(w=>w.id==='+JSON.stringify(id)+')');}
ok('H02 spread da shotgun não foi "organizado" visualmente (§27)',()=>{
  run('projectiles.length=0;player.aim=0');
  run('fireWeaponFrom(player,WEAPONS.find(w=>w.id==="shotgun"),"ally",1,"player")');
  const n=run('projectiles.length');
  assert.strictEqual(n,7,'count mudou: '+n);
  /* os 7 pellets continuam em ângulos distintos (leque mecânico real) */
  const angs=Array.from(run('JSON.stringify(projectiles.map(p=>Math.atan2(p.vy,p.vx)))'));
  const arr=JSON.parse(run('JSON.stringify(projectiles.map(p=>Math.atan2(p.vy,p.vx)))'));
  assert.strictEqual(new Set(arr.map(a=>a.toFixed(6))).size,7,'pellets alinhados');
  const spanV=Math.max(...arr)-Math.min(...arr);
  assert.ok(spanV>.6,'leque estreitou: '+spanV);
  run('projectiles.length=0');});
ok('H03 disparo real produz projéteis com os campos esperados',()=>{
  for(const id of SWARM){
    run('projectiles.length=0;player.aim=0');
    run('fireWeaponFrom(player,WEAPONS.find(w=>w.id==='+JSON.stringify(id)+'),"ally",1,"player")');
    const w=W(id);
    assert.strictEqual(run('projectiles.length'),w.count,id+' count');
    assert.strictEqual(run('projectiles[0].type'),id,id+' type');
    assert.strictEqual(run('projectiles[0].color'),w.color,id+' color');
    assert.strictEqual(run('projectiles[0].r'),w.pr,id+' r');
    run('projectiles.length=0');}});
ok('H04 SMG sem tracer persistente e sem alternância (§30)',()=>{
  const b=body('drawProjectileSwarm');
  const smg=b.split("t==='shotgun'")[0];
  assert.ok(!/%|toggle|flip|side|parity|runTime/.test(smg),
    'SMG não pode alternar forma por frame/paridade');});
ok('H05 draw não depende de runTime (forma estável no tempo)',()=>{
  const b=body('drawProjectileSwarm');
  assert.ok(!/runTime/.test(b),'a forma oscilaria no tempo');});

/* ============ REGRESSÃO (§32) ============ */
console.log('\n[I] regressão');
const reg=require('./suite-registry.js');
ok('I01 esta suíte é descoberta pelo npm test',()=>{
  assert.ok(reg.suiteIsDiscovered('pr15-5-e4-swarm-projectile-identity'));});
for(const s of ['pr15-5-e8-muzzle-emission-identity','pr15-5-e3-slug-penetrator-identity',
                'pr15-5-e2-temporal-projectile-identity','pr15-5-e1-projectile-visual-grammar',
                'pr15-5-e0-visual-determinism','pr15-7-b-anchored-replay-prototype',
                'pr15-5-performance-audit1'])
  ok('I·'+s+' continua no runner',()=>{assert.ok(reg.suiteIsDiscovered(s),s);});
ok('I09 documentação do E4 existe',()=>{
  assert.ok(fs.existsSync(path.join(root,'PR15_5_E4_SWARM_PROJECTILE_IDENTITY.md')));});

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
