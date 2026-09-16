'use strict';
/* ECHO — PR15.5-E5 · ENERGIA / MASSA — identidade do PROJÉTIL
   ---------------------------------------------------------------------
   Plasma, Orb, Void e Cryo. Antes do E5, três delas (plasma/void/cryo)
   caíam em drawProjectileLegacyLine — um traço reto — e só o Orb tinha
   forma própria. Plasma e Cryo eram literalmente a mesma geometria com
   comprimentos 10 e 5.

   AUDITORIA QUE DEFINIU O DESENHO (ver o .md para o detalhamento):
   o void declara implode:210 e aoe:150, mas detonateSpecial() só é
   chamado para p.mine e explodeOrb() só para p.type==='orb'. Verificado
   empiricamente: um segundo inimigo a 90px (dentro do aoe 150) NÃO toma
   dano nem é sugado. O void é, na prática, impacto único e pesado — e é
   isso que a forma comunica. Não desenhamos a promessa do nome.

   Toda prova compara TOPOLOGIA/GEOMETRIA, nunca cor, largura ou alpha. */
const assert=require('assert'),fs=require('fs'),path=require('path');
const {world,readSource}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}}
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5-E5 · ENERGIA / MASSA');

const EM=['plasma','orb','void','cryo'];
const GEOM=['beginPath','moveTo','lineTo','arc','closePath','fill','stroke','rect',
            'quadraticCurveTo','bezierCurveTo'];
run('glowSprite("#ffffff")');
function draw(over){
  const p=Object.assign({x:100,y:100,vx:1000,vy:0,r:6,color:'#ffffff',
    dist:0,maxDist:1100},over);
  S.__pp=p;S.__ctxLog=[];run('drawProjectile(__pp)');const l=S.__ctxLog;
  S.__ctxLog=null;return l;
}
const P=(t,ex)=>Object.assign({type:t},ex||{});
const topo=o=>draw(o).filter(e=>GEOM.includes(e[0])).map(e=>e[0]).join(',');
const verts=o=>draw(o).filter(e=>e[0]==='moveTo'||e[0]==='lineTo')
  .map(e=>[+(e[1][0]).toFixed(6),+(e[1][1]).toFixed(6)]);
const ops=o=>draw(o).length;
/* assinatura completa = topologia + geometria relativa ao centro */
const shape=o=>topo(o)+'|'+JSON.stringify(verts(o)
  .map(q=>[+(q[0]-100).toFixed(3),+(q[1]-100).toFixed(3)]));
function body(name){
  const m=SRC.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(m,'função não encontrada: '+name);return m[0];}
const W=id=>run('WEAPONS.find(w=>w.id==='+JSON.stringify(id)+')');
run('__ECHO_AUDIT_FIXTURES.prepare("E")');
const ETYPE=run('Object.keys(EDEFS)[0]');

/* ============ 1 · CLASSIFICAÇÃO E ROTEAMENTO ============ */
console.log('\n[A] classificação e roteamento');
for(const id of EM)
  ok('A·'+id+' classificado como ENERGIA/MASSA',()=>{
    assert.strictEqual(run('PROJ_FAMILY['+JSON.stringify(id)+']'),T.PVF.ENERGY);
    assert.strictEqual(T.visualFamilyForProjectile({type:id}),T.PVF.ENERGY);});
ok('A05 helper dedicado existe e recebe as 4',()=>{
  assert.strictEqual(typeof T.drawProjectileEnergyMass,'function');
  const b=body('drawProjectile');
  assert.ok(/PVF_ENERGY\)drawProjectileEnergyMass/.test(b),'dispatcher não encaminha');});
ok('A06 dispatcher continua simples e com 1 ponto de chamada',()=>{
  assert.strictEqual((SRC.match(/drawProjectileEnergyMass\(/g)||[]).length,2);
  const b=body('drawProjectile');
  const linhas=b.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('/*')&&
    !l.trim().startsWith('*')&&!l.trim().startsWith('//'));
  assert.ok(linhas.length<=24,'dispatch inchado: '+linhas.length);});
ok('A07 ordem das famílias anteriores preservada',()=>{
  const b=body('drawProjectile');
  const iE=b.indexOf('PVF_ENERGY'),iS=b.indexOf('PVF_SLUG'),
        iW=b.indexOf('PVF_SWARM'),iK=b.indexOf('PVF_KINETIC');
  assert.ok(iS<iW&&iW<iK,'a ordem SLUG→SWARM→KINETIC mudou');
  assert.ok(iE<iS,'ENERGY deve ser resolvido antes (orb sai do ramo legado)');});
ok('A08 não duplica fade/glow/temporal/culling (§arquitetura)',()=>{
  const b=body('drawProjectileEnergyMass');
  assert.ok(!/projectileRangeFade|drawProjectileGlow|TemporalLayer|globalAlpha=/.test(b),
    'o helper não pode reimplementar o que o dispatcher já faz');});

/* ============ 2 · FORMA EXCLUSIVA / 3 · TOPOLOGIA ============ */
console.log('\n[B] formas exclusivas e topologia');
const pares=[['plasma','orb'],['plasma','cryo'],['plasma','void'],
             ['orb','void'],['orb','cryo'],['void','cryo']];
for(const [a,b] of pares)
  ok('B·'+a+' != '+b,()=>{
    assert.notStrictEqual(topo(P(a)),topo(P(b)),a+'/'+b+' mesma topologia');
    assert.notStrictEqual(shape(P(a)),shape(P(b)),a+'/'+b+' mesma geometria');});
ok('B07 as 4 assinaturas são únicas',()=>{
  assert.strictEqual(new Set(EM.map(id=>shape(P(id)))).size,4);});
ok('B08 Plasma: envelope + núcleo (dois corpos preenchidos)',()=>{
  const t=topo(P('plasma'));
  assert.strictEqual((t.match(/closePath,fill/g)||[]).length,2,
    'deve haver envelope e núcleo');
  assert.ok(!t.includes('arc'),'plasma não pode virar orb menor');});
ok('B09 Orb: identidade circular histórica preservada',()=>{
  assert.ok(topo(P('orb')).includes('arc'),'orb deve manter o círculo');
  /* byte-idêntico ao helper histórico */
  assert.strictEqual(topo(P('orb')),'beginPath,arc,fill,beginPath,arc,stroke');
  assert.ok(body('drawProjectileEnergyMass').includes('drawProjectileOrbShape'),
    'deve reusar o helper histórico, não reescrevê-lo');});
ok('B10 Void: casco INTERROMPIDO, sem preenchimento e sem arc',()=>{
  const t=topo(P('void'));
  assert.ok(!t.includes('fill'),'o vazio é a forma — não pode ter miolo cheio');
  assert.ok(!t.includes('arc'),'não pode ser "orb roxo"');
  /* 4 segmentos desconexos = espaço negativo entre eles */
  const seg=(t.split('stroke')[0].match(/moveTo/g)||[]).length;
  assert.strictEqual(seg,4,'esperados 4 arcos-de-canto, achei '+seg);});
ok('B11 Cryo: massa facetada preenchida + farpas',()=>{
  const t=topo(P('cryo'));
  assert.ok(t.includes('closePath,fill'),'cryo é massa sólida');
  assert.ok(t.includes('stroke'),'faltam as farpas de cristalização');
  assert.ok(!t.includes('arc'),'cryo não é círculo');});
ok('B12 nenhuma das 3 novas usa arc (o círculo é exclusivo do Orb)',()=>{
  for(const id of ['plasma','void','cryo'])
    assert.ok(!topo(P(id)).includes('arc'),id);});

/* ============ 6 · MESMA COR ============ */
console.log('\n[C] mesma cor / mesmo raio');
ok('C01 mesma cor: as 4 continuam distinguíveis',()=>{
  const s=EM.map(id=>shape(P(id,{color:'#ffffff'})));
  assert.strictEqual(new Set(s).size,4,'colapsaram com a mesma cor');});
ok('C02 mesmo raio artificial: ainda distinguíveis',()=>{
  for(const r of [4,6,9]){
    const s=EM.map(id=>shape(P(id,{color:'#ffffff',r:r})));
    assert.strictEqual(new Set(s).size,4,'colapsaram com r='+r);}});
ok('C03 ignorando glow: a diferença permanece',()=>{
  /* o glow é drawImage — removido da assinatura, as formas seguem únicas */
  const s=EM.map(id=>topo(P(id,{color:'#ffffff'})));
  assert.strictEqual(new Set(s).size,4);});

/* ============ 7 · COLISÕES COM E3 / E4 / E10 ============ */
console.log('\n[D] separação das famílias anteriores');
ok('D01 Cryo != Prism',()=>{
  assert.notStrictEqual(shape(P('cryo')),shape(P('prism')));
  assert.notStrictEqual(topo(P('cryo')),topo(P('prism')));});
ok('D02 Plasma != Rail/Sniper/Nail',()=>{
  for(const s of ['rail','sniper','nail'])
    assert.notStrictEqual(shape(P('plasma')),shape(P(s)),'plasma == '+s);});
ok('D03 Orb != Mine',()=>{
  assert.notStrictEqual(shape(P('orb')),shape(P('mine')));
  assert.ok(topo(P('orb')).includes('arc'));
  assert.ok(!topo(P('mine')).includes('arc'),'mine é material (E10)');});
ok('D04 Void != Homing/Prism',()=>{
  for(const o of ['homing','prism'])
    assert.notStrictEqual(shape(P('void')),shape(P(o)),'void == '+o);});
ok('D05 Plasma != Boomer (ambas têm 2 corpos — geometria decide)',()=>{
  assert.notStrictEqual(shape(P('plasma')),shape(P('boomer')));
  assert.notStrictEqual(topo(P('plasma')),topo(P('boomer')));});
ok('D06 nenhuma das 4 colide com QUALQUER outra arma do jogo',()=>{
  const outras=['rail','sniper','nail','smg','shotgun','homing','prism',
                'ricochet','boomer','gatling','mine'];
  for(const k of EM)for(const o of outras)
    assert.notStrictEqual(shape(P(k)),shape(P(o)),k+' == '+o);});

/* ============ 4 · ORIENTAÇÃO / 5 · ESTADO ZERO ============ */
console.log('\n[E] orientação e robustez');
for(const id of ['plasma','cryo'])
  ok('E·'+id+' orienta em +x, -x, +y e diagonal',()=>{
    const a=verts(P(id,{vx:500,vy:0})), b=verts(P(id,{vx:0,vy:500}));
    const c=verts(P(id,{vx:-500,vy:0})), d=verts(P(id,{vx:400,vy:400}));
    const J=q=>JSON.stringify(q);
    assert.strictEqual(new Set([J(a),J(b),J(c),J(d)]).size,4,'ignorou a direção');
    const extX=q=>Math.max(...q.map(v=>v[0]))-Math.min(...q.map(v=>v[0]));
    const extY=q=>Math.max(...q.map(v=>v[1]))-Math.min(...q.map(v=>v[1]));
    assert.ok(extX(a)>extY(a),id+' em +x');
    assert.ok(extY(b)>extX(b),id+' em +y');});
ok('E·void gira com o vetor (octógono: mede rotação, não alongamento)',()=>{
  /* O casco do void é radial-simétrico por construção, então extensão em
     x e y são iguais em qualquer ângulo — comparar alongamento não diria
     nada. O que importa é que os VÉRTICES giram com a direção e que o
     raio se conserva (rotação, não deformação). */
  const a=verts(P('void',{vx:500,vy:0})), b=verts(P('void',{vx:0,vy:500}));
  const c=verts(P('void',{vx:-500,vy:0})), d=verts(P('void',{vx:400,vy:400}));
  const J=q=>JSON.stringify(q);
  assert.strictEqual(new Set([J(a),J(b),J(c),J(d)]).size,4,'ignorou a direção');
  const rmax=q=>Math.max(...q.map(v=>Math.hypot(v[0]-100,v[1]-100)));
  for(const q of [b,c,d])
    assert.ok(Math.abs(rmax(a)-rmax(q))<1e-6,'o casco deformou em vez de girar');
  /* a marca de colapso acompanha o eixo do voo */
  const eixo=q=>{const m=q[q.length-2];return [m[0]-100,m[1]-100];};
  assert.notStrictEqual(J(eixo(a)),J(eixo(b)),'a marca central não girou');});
ok('E04 Orb é radial — sem orientação, por construção',()=>{
  assert.strictEqual(JSON.stringify(verts(P('orb',{vx:500,vy:0}))),
                     JSON.stringify(verts(P('orb',{vx:0,vy:500}))),
    'o orbe é volumétrico: girar não faz sentido');});
ok('E05 velocidade zero não produz NaN em nenhuma das 4',()=>{
  for(const id of EM){
    const v=verts(P(id,{vx:0,vy:0}));
    assert.ok(v.every(q=>Number.isFinite(q[0])&&Number.isFinite(q[1])),id+' NaN');
    const l=draw(P(id,{vx:0,vy:0}));
    l.forEach(e=>(e[1]||[]).forEach(a=>
      assert.ok(typeof a!=='number'||Number.isFinite(a),id+' arg NaN')));}});
ok('E06 estado zero (r=0, dist=0) não quebra',()=>{
  for(const id of EM){
    const l=draw(P(id,{r:0,vx:0,vy:0,dist:0,maxDist:0}));
    assert.ok(l.length>0,id+' não desenhou nada');
    l.forEach(e=>(e[1]||[]).forEach(a=>
      assert.ok(typeof a!=='number'||Number.isFinite(a),id+' NaN com r=0')));}});

/* ============ 8/9 · DETERMINISMO E PUREZA ============ */
console.log('\n[F] determinismo e pureza');
ok('F01 zero RNG no draw das 4',()=>{
  const o=S.Math.random;let c=0;S.Math.random=function(){c++;return .5;};
  try{for(const id of EM)draw(P(id));}finally{S.Math.random=o;}
  assert.strictEqual(c,0,'draw consumiu '+c+' RNG');});
ok('F02 nenhum Math.random/rand/randi no helper',()=>{
  const b=body('drawProjectileEnergyMass');
  assert.ok(!/Math\.random/.test(b));
  assert.ok(!/(?<![\w$.])rand\(/.test(b));
  assert.ok(!/(?<![\w$.])randi\(/.test(b));});
ok('F03 runTime só no Orb (pulso histórico), não nas formas novas',()=>{
  const b=body('drawProjectileEnergyMass');
  assert.ok(!/runTime/.test(b),'as formas novas não podem depender do tempo');
  /* o pulso do orb vive no helper histórico e é intencionalmente mantido */
  assert.ok(body('drawProjectileOrbShape').includes('runTime'));});
ok('F04 draws repetidos do MESMO estado são idênticos (30×)',()=>{
  for(const id of EM){
    if(id==='orb')continue;           // pulso depende de runTime, ver F05
    const a=JSON.stringify(draw(P(id)));
    for(let i=0;i<30;i++)
      assert.strictEqual(JSON.stringify(draw(P(id))),a,id);}});
ok('F05 Orb: com runTime congelado, 30 draws são idênticos',()=>{
  const t0=run('runTime');
  try{
    const a=JSON.stringify(draw(P('orb')));
    for(let i=0;i<30;i++)
      assert.strictEqual(JSON.stringify(draw(P('orb'))),a);
  }finally{run('runTime='+t0);}});
ok('F06 zero mutação do projétil no draw',()=>{
  for(const id of EM){
    const p=Object.assign({type:id,x:100,y:100,vx:1000,vy:0,r:6,color:'#fff',
      dist:10,maxDist:1100,aoe:105,life:2});
    const before=JSON.stringify(p);
    S.__pp=p;S.__ctxLog=[];run('drawProjectile(__pp)');S.__ctxLog=null;
    assert.strictEqual(JSON.stringify(S.__pp),before,id+' mutou o projétil');}});
ok('F07 helper não toca player/enemy/parts/projectiles',()=>{
  const b=body('drawProjectileEnergyMass');
  assert.ok(!/spawnParticles|spawnRing|spawnShards|projectiles\.|enemies|player\.|damageEnemy|explodeOrb\(/.test(b));});
ok('F08 nenhuma coleção cresce no draw',()=>{
  const snap=()=>Array.from(run('[parts.length,projectiles.length,enemies.length,arcs.length]'));
  const a=snap();
  for(const id of EM)for(let i=0;i<10;i++)draw(P(id));
  assert.deepStrictEqual(snap(),a);});
ok('F09 nenhum estado global novo por projétil',()=>{
  const b=body('drawProjectileEnergyMass');
  assert.ok(!/=\s*\[\]|\.push\(|new Map|new Set|new [A-Z]/.test(
    b.replace(/\/\*[\s\S]*?\*\//g,'')));});

/* ============ 11 · CANVAS BUDGET ============ */
console.log('\n[G] canvas budget');
ok('G01 custo bounded nas 4',()=>{
  for(const id of EM)assert.ok(ops(P(id))<=30,id+': '+ops(P(id)));});
ok('G02 Plasma (cadência alta, .16s) é barato',()=>{
  const pl=ops(P('plasma'));
  assert.ok(pl<=24,'plasma: '+pl);
  /* mais barato que as armas lentas da própria família */
  assert.ok(pl<=ops(P('void')),'plasma mais caro que void');});
ok('G03 comparável a E3/E4/E10 — sem outlier',()=>{
  const ref=Math.max(ops(P('rail')),ops(P('prism')),ops(P('mine')));
  for(const id of EM)
    assert.ok(ops(P(id))<=ref+4,id+' ('+ops(P(id))+') destoa de E3/E4/E10 ('+ref+')');});
ok('G04 custo não cresce com vida/distância/repetição',()=>{
  for(const id of EM){
    const base=ops(P(id));
    assert.strictEqual(ops(P(id,{dist:900,life:.1})),base,id+' cresce');
    for(let i=0;i<30;i++)draw(P(id));
    assert.strictEqual(ops(P(id)),base,id+' acumulou');}});
ok('G05 sem gradiente, shadowBlur, Path2D, save/restore, rotate',()=>{
  const b=body('drawProjectileEnergyMass');
  assert.ok(!/createLinearGradient|createRadialGradient|shadowBlur|new Path2D/.test(b));
  assert.ok(!/ctx\.save|ctx\.restore|ctx\.rotate|ctx\.translate|setTransform/.test(b));
  for(const id of EM){
    const l=draw(P(id)).map(e=>e[0]);
    ['rotate','save','restore','translate'].forEach(o=>
      assert.ok(!l.includes(o),id+' emitiu ctx.'+o));}});

/* ============ 12/13 · ECHO E REPLAY ============ */
console.log('\n[H] Echo e Repetição Ancorada');
const ECHO_OWNER={slot:1,data:{}};
ok('H01 Echo herda a forma das 4',()=>{
  for(const id of EM){
    const base=topo(P(id));
    const eco=topo(P(id,{owner:ECHO_OWNER}));
    assert.ok(eco.startsWith(base),id+' a forma base deixou de vir primeiro');
    assert.ok(eco.length>base.length,id+' perdeu a camada temporal');}
  const b=body('drawProjectileEnergyMass');
  assert.ok(!/owner|team|isEcho|echoes|slot/.test(b),
    'a forma deve depender do tipo, não de quem disparou');});
ok('H02 Replay herda forma + layer e é distinto de Echo',()=>{
  for(const id of EM){
    const base=topo(P(id));
    const rep=topo(P(id,{temporalReplay:true}));
    assert.ok(rep.startsWith(base)&&rep.length>base.length,id);
    assert.notStrictEqual(rep,topo(P(id,{owner:ECHO_OWNER})),id+' replay==echo');}});
ok('H03 E2 intocado',()=>{
  for(const n of ['projectileTemporalMode','drawProjectileTemporalLayer'])
    assert.ok(!/drawProjectileEnergyMass/.test(body(n)),n);
  assert.strictEqual(T.projectileTemporalMode({temporalReplay:true}),T.PTM.REPLAY);
  assert.strictEqual(T.projectileTemporalMode({owner:ECHO_OWNER}),T.PTM.ECHO);
  assert.strictEqual(T.projectileTemporalMode({owner:null}),T.PTM.NONE);});
ok('H04 Repetição Ancorada segue mecanicamente independente',()=>{
  assert.strictEqual(run('TEMPORAL_ACTION_WINDOW'),5);
  assert.strictEqual(run('TEMPORAL_REPLAY_COOLDOWN'),6);
  assert.strictEqual(run('TEMPORAL_REPLAY_DAMAGE'),.50);
  assert.ok(!/drawProjectileEnergyMass/.test(body('replayTemporalAction')));});

/* ============ 14/15/16 · EORB, BEAM, MUZZLE ============ */
console.log('\n[I] eorb, beam e muzzle');
ok('I01 eorb inimigo permanece intacto',()=>{
  assert.strictEqual(topo(P('eorb')),'beginPath,arc,fill,beginPath,arc,stroke');
  assert.strictEqual(shape(P('eorb')),shape(P('orb',{r:6})),
    'eorb deve seguir o mesmo desenho histórico do orb');
  assert.strictEqual(run('PROJ_FAMILY["eorb"]'),undefined);
  assert.strictEqual(T.visualFamilyForProjectile({type:'eorb'}),T.PVF.LEGACY);
  /* e o dispatcher trata eorb ANTES da família, sem passar pelo E5 */
  assert.ok(body('drawProjectile').includes("p.type==='eorb'"));});
ok('I02 mudanças no orb do jogador não vazam para eorb',()=>{
  const b=body('drawProjectileEnergyMass');
  assert.ok(!/eorb/.test(b),'o helper do E5 não deve mencionar eorb');});
ok('I03 beam intacto',()=>{
  assert.strictEqual(run('PROJ_FAMILY["beam"]'),undefined);
  const b=body('drawBeamFrom');
  assert.ok(!/drawProjectileEnergyMass/.test(b));
  assert.ok(b.includes('createLinearGradient')&&b.includes('rampMax'));});
ok('I04 muzzle do E8 intocado',()=>{
  for(const n of ['muzzleShot','muzzlePower','emitWeaponMuzzleVisual'])
    assert.ok(!/drawProjectileEnergyMass/.test(body(n)),n);
  const cnt=id=>{run('parts.length=0;player.aim=0');
    run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id==="'+id+'"))');
    const n=run('parts.length');run('parts.length=0');return n;};
  /* a família ENERGY emite 3 no E8 — inalterado */
  for(const id of EM)assert.strictEqual(cnt(id),3,id);});
ok('I05 nenhum impacto novo foi adicionado (E9 fora do escopo)',()=>{
  const b=body('drawProjectileEnergyMass');
  assert.ok(!/shake|rumble|floatText|sBoom|flash|shock/.test(b));
  /* explodeOrb e detonateSpecial intactos */
  assert.ok(body('explodeOrb').includes('spawnRing(p.x,p.y,p.color,10,p.aoe,.4)'));
  assert.ok(body('explodeOrb').includes('e.slowT=1.4'));});

/* ============ 17 · E0/E1/E3/E4/E10 PRESERVADOS ============ */
console.log('\n[J] blocos anteriores preservados');
ok('J01 E3: rail/sniper/nail byte-idênticos',()=>{
  assert.strictEqual(topo(P('rail')),
    'beginPath,moveTo,lineTo,lineTo,lineTo,closePath,fill,beginPath,moveTo,lineTo,stroke');
  assert.strictEqual(topo(P('sniper')),
    'beginPath,moveTo,lineTo,stroke,beginPath,moveTo,lineTo,stroke');
  assert.strictEqual(topo(P('nail')),
    'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,lineTo,closePath,fill');
  assert.strictEqual(run('SNIPER_FAR_DIST'),450);});
ok('J02 E4: smg/shotgun/homing/prism byte-idênticos',()=>{
  assert.strictEqual(topo(P('smg')),'beginPath,moveTo,lineTo,lineTo,lineTo,closePath,fill');
  assert.strictEqual(topo(P('shotgun')),'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,closePath,fill');
  assert.strictEqual(topo(P('homing')),
    'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,closePath,fill,beginPath,moveTo,lineTo,moveTo,lineTo,stroke');
  assert.strictEqual(topo(P('prism')),
    'beginPath,moveTo,lineTo,lineTo,closePath,fill,beginPath,moveTo,lineTo,lineTo,lineTo,closePath,fill,beginPath,moveTo,lineTo,stroke');});
ok('J03 E10: ricochet/boomer/gatling/mine byte-idênticos',()=>{
  assert.strictEqual(topo(P('ricochet',{bounce:3})),
    'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,lineTo,lineTo,closePath,fill');
  assert.strictEqual(topo(P('boomer',{spin:0})),
    'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,lineTo,closePath,fill,beginPath,moveTo,lineTo,stroke');
  assert.strictEqual(topo(P('gatling')),
    'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,closePath,fill');
  assert.strictEqual(topo(P('mine',{armT:0})),
    'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,lineTo,closePath,fill,beginPath,moveTo,lineTo,moveTo,lineTo,stroke');});
ok('J04 helpers anteriores não foram tocados pelo E5',()=>{
  for(const n of ['drawProjectileSlug','drawProjectileSwarm','drawProjectileKinetic'])
    assert.ok(!/drawProjectileEnergyMass/.test(body(n)),n);});
ok('J05 E1: gramática intacta',()=>{
  ['PROJ_FAMILY','visualFamilyForProjectile','projectileUsesOrbShape',
   'projectileRangeFade','drawProjectileGlow','drawProjectileLegacyLine']
    .forEach(n=>assert.ok(SRC.includes(n),n));
  assert.strictEqual(T.projectileRangeFade({maxDist:0}),1);});
ok('J06 as armas de fora têm forma própria e o fallback segue vivo',()=>{
  /* PR15.5-E6: flamer/acid saíram da lista (família FLUIDO/SPRAY).
     PR15.5-E7: tesla/plague também saíram (família CONDUÇÃO/STATUS) —
     a âncora do legado passou a ser um tipo DESCONHECIDO, único caminho
     real até o fallback. O assert positivo PROVA a nova arquitetura. */
  const leg=topo(P('arma_do_futuro_2027'));
  assert.ok(leg.includes('stroke')&&!leg.includes('fill'),'legado é traço');
  for(const id of ['tesla','plague'])
    assert.notStrictEqual(topo(P(id)),leg,id+' regrediu para o legado');});
ok('J07 família FLUIDO/SPRAY (E6) tem forma própria e distinta',()=>{
  const leg=topo(P('arma_do_futuro_2027'));
  const a=topo(P('flamer')),b=topo(P('acid'));
  for(const [id,t] of [['flamer',a],['acid',b]]){
    assert.notStrictEqual(t,leg,id+' regrediu para o legado');
    /* nenhuma copia as formas do E5: nem envelope+núcleo (plasma), nem
       casco interrompido (void), nem facetado (cryo), nem círculo (orb) */
    for(const id2 of ['plasma','orb','void','cryo'])
      assert.notStrictEqual(t,topo(P(id2)),id+' colidiu com '+id2);}
  assert.notStrictEqual(a,b,'flamer e acid precisam de silhuetas próprias');});

/* ============ 10/18 · MECÂNICA ============ */
console.log('\n[K] mecânica inalterada');
ok('K01 defs das 4 armas idênticas à base 81b0076',()=>{
  const ESP={
    plasma:{interval:.16,speed:980,dmg:11,count:1,spread:0,jitter:.035,life:1.4,pr:4,kick:55,range:760,color:'#46e0ff'},
    orb:{interval:1.05,speed:250,dmg:24,count:1,spread:0,jitter:0,life:3,pr:8,kick:40,range:430,aoe:105,color:'#9d7bff'},
    void:{interval:1.25,speed:340,dmg:30,count:1,spread:0,jitter:0,life:2.6,pr:9,kick:50,range:560,aoe:150,implode:210,color:'#c56bff'},
    cryo:{interval:.62,speed:600,dmg:13,count:1,spread:0,jitter:.02,life:1.4,pr:6,kick:60,range:520,color:'#7fd8ff'}};
  for(const [id,exp] of Object.entries(ESP)){
    const w=W(id);
    for(const [k,v] of Object.entries(exp))assert.strictEqual(w[k],v,id+'.'+k);}
  /* o fx do cryo (chill que acumula) intacto */
  const fx=W('cryo').fx;
  assert.strictEqual(fx.k,'chill');assert.strictEqual(fx.dur,2.6);
  assert.strictEqual(fx.pow,.34);});
ok('K02 disparo real: campos do projétil inalterados',()=>{
  const o=S.Math.random;S.Math.random=()=>0.999999;
  try{
    for(const id of EM){
      run('projectiles.length=0;player.aim=0');
      run('fireWeaponFrom(player,WEAPONS.find(w=>w.id==='+JSON.stringify(id)+'),"ally",1,"player")');
      const w=W(id);
      assert.strictEqual(run('projectiles.length'),w.count,id+' count');
      assert.strictEqual(run('projectiles[0].type'),id,id+' type');
      assert.strictEqual(run('projectiles[0].color'),w.color,id+' color');
      assert.strictEqual(run('projectiles[0].r'),w.pr,id+' r');
      assert.strictEqual(run('projectiles[0].dmg'),w.dmg,id+' dmg');
      assert.strictEqual(run('projectiles[0].aoe'),w.aoe||0,id+' aoe');
      run('projectiles.length=0');}
  }finally{S.Math.random=o;}});
ok('K03 Orb: AoE real preservado (explode e aplica slowT 1.4)',()=>{
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",780,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  const hp0=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:250,vy:0,r:8,dmg:24,life:3,type:"orb",'+
      'team:"ally",color:"#9d7bff",aoe:105,pierce:0,dist:0,maxDist:430,hits:null,'+
      'def:WEAPONS.find(w=>w.id==="orb"),born:0,owner:player})');
  run('updateProjectiles(1/60)');
  const hp1=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  assert.ok(hp1[0]<hp0[0]&&hp1[1]<hp0[1],'AoE do orb deixou de atingir os dois');
  const slow=JSON.parse(run('JSON.stringify(enemies.map(e=>e.slowT||0))'));
  assert.ok(slow[0]===1.4&&slow[1]===1.4,'lentidão temporal do orb mudou');
  run('projectiles.length=0');run('enemies.length=0');});
ok('K04 Void: comportamento REAL confirmado — impacto único, sem implosão',()=>{
  /* Este assert documenta a auditoria: apesar de implode:210 e aoe:150,
     detonateSpecial() só roda para p.mine. Se algum dia o void passar a
     implodir de verdade, este teste falha e o visual deve ser revisto. */
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",790,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  const hp0=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:340,vy:0,r:9,dmg:30,life:2.6,type:"void",'+
      'team:"ally",color:"#c56bff",aoe:150,pierce:0,dist:0,maxDist:560,hits:null,'+
      'def:WEAPONS.find(w=>w.id==="void"),born:0,owner:player})');
  run('updateProjectiles(1/60)');
  const hp1=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  assert.ok(hp1[0]<hp0[0],'o alvo direto deveria tomar dano');
  assert.strictEqual(hp1[1],hp0[1],'o 2º alvo dentro do aoe NÃO deve tomar dano');
  const v=JSON.parse(run('JSON.stringify(enemies.map(e=>[e.vx,e.vy]))'));
  assert.deepStrictEqual(v[1],[0,0],'não deve haver sucção (implode não roda)');
  run('projectiles.length=0');run('enemies.length=0');});
ok('K05 Cryo: chill acumulativo intacto',()=>{
  run('enemies.length=0');run('spawnEnemy("'+ETYPE+'",700,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;})');
  run('applyStatus(enemies[0],"chill",2.6,0.34,player)');
  const st=JSON.parse(run('JSON.stringify(enemies[0].st)'));
  assert.ok(Math.abs(st.chillT-2.6)<1e-9,'duração do chill mudou');
  assert.ok(Math.abs(st.chillP-0.34)<1e-9,'potência do chill mudou');
  /* acumula até 1 e congela — regra preservada */
  const ap=body('applyStatus');
  assert.ok(ap.includes('if(s.chillP>=1&&!(s.stunT>0))'),'regra de congelamento mudou');
  run('enemies.length=0');});
ok('K06 detonateSpecial e explodeOrb não foram tocados',()=>{
  assert.ok(body('detonateSpecial').includes('if(d.implode)'));
  /* conta CHAMADAS, não a declaração da função */
  const chamadas=(SRC.match(/(?<!function )detonateSpecial\(p\)/g)||[]).length;
  assert.strictEqual(chamadas,1,'detonateSpecial deve ser chamado só pela mine');
  const mine=SRC.match(/if\(p\.mine\)\{[\s\S]*?\n    \}/)[0];
  assert.ok(mine.includes('detonateSpecial(p)'),'a única chamada é a da mine');});

/* ============ REGRESSÃO ============ */
console.log('\n[L] regressão');
const reg=require('./suite-registry.js');
ok('L01 esta suíte é descoberta pelo npm test',()=>{
  assert.ok(reg.suiteIsDiscovered('pr15-5-e5-energy-mass-projectile-identity'));});
for(const s of ['pr15-5-e10-kinetic-return-projectile-identity',
                'pr15-5-e4-swarm-projectile-identity','pr15-5-e8-muzzle-emission-identity',
                'pr15-5-e3-slug-penetrator-identity','pr15-5-e2-temporal-projectile-identity',
                'pr15-5-e1-projectile-visual-grammar','pr15-5-e0-visual-determinism',
                'pr15-7-b-anchored-replay-prototype','pr15-5-performance-audit1'])
  ok('L·'+s+' continua no runner',()=>{assert.ok(reg.suiteIsDiscovered(s),s);});
ok('L11 documentação do E5 existe',()=>{
  assert.ok(fs.existsSync(path.join(root,'PR15_5_E5_ENERGY_MASS_PROJECTILE_IDENTITY.md')));});

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
