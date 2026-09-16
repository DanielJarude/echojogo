'use strict';
/* ECHO — PR15.5-E6 · FLUIDO / SPRAY — identidade do PROJÉTIL
   ---------------------------------------------------------------------
   Flamer e Acid. Antes do E6, as duas caíam em drawProjectileLegacyLine —
   um traço reto de comprimento 5 — e eram literalmente intercambiáveis
   quando recoloridas, além de indistinguíveis de tesla/plague.

   AUDITORIA QUE DEFINIU O DESENHO (ver o .md para o detalhamento):
   sonda empírica sobre o código real confirmou que a família NÃO tem
   AoE, splash, poça, nuvem, explosão nem pierce — flamer aplica burn
   (DoT que empilha até 6×) no alvo ÚNICO atingido; acid aplica corrode
   (alvo recebe +12%/stack, SEM dano ao longo do tempo) no alvo único.
   As formas comunicam material em voo — jato instável / glóbulo pesado —
   sem prometer mecânica inexistente.

   Toda prova compara TOPOLOGIA/GEOMETRIA, nunca cor, largura ou alpha. */
const assert=require('assert'),fs=require('fs'),path=require('path');
const {world,readSource}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}}
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5-E6 · FLUIDO / SPRAY');

const FS=['flamer','acid'];
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
for(const id of FS)
  ok('A·'+id+' classificado como FLUIDO/SPRAY',()=>{
    assert.strictEqual(run('PROJ_FAMILY['+JSON.stringify(id)+']'),T.PVF.FLUID);
    assert.strictEqual(T.visualFamilyForProjectile({type:id}),T.PVF.FLUID);});
ok('A05 helper dedicado existe e recebe as 2',()=>{
  assert.strictEqual(typeof T.drawProjectileFluidSpray,'function');
  const b=body('drawProjectile');
  assert.ok(/PVF_FLUID\)drawProjectileFluidSpray/.test(b),'dispatcher não encaminha');});
ok('A06 dispatcher continua simples e com 1 ponto de chamada',()=>{
  assert.strictEqual((SRC.match(/drawProjectileFluidSpray\(/g)||[]).length,2);
  const b=body('drawProjectile');
  const linhas=b.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('/*')&&
    !l.trim().startsWith('*')&&!l.trim().startsWith('//'));
  assert.ok(linhas.length<=25,'dispatch inchado: '+linhas.length);});
ok('A07 ordem das famílias anteriores preservada',()=>{
  const b=body('drawProjectile');
  const iE=b.indexOf('PVF_ENERGY'),iF=b.indexOf('PVF_FLUID'),
        iS=b.indexOf('PVF_SLUG'),iW=b.indexOf('PVF_SWARM'),iK=b.indexOf('PVF_KINETIC');
  assert.ok(iS<iW&&iW<iK,'a ordem SLUG→SWARM→KINETIC mudou');
  assert.ok(iE<iS,'ENERGY deve ser resolvido antes (orb sai do ramo legado)');
  assert.ok(iE<iF&&iF<iS,'FLUID foi inserido fora do lugar');});
ok('A08 não duplica fade/glow/temporal/culling (§arquitetura)',()=>{
  const b=body('drawProjectileFluidSpray');
  assert.ok(!/projectileRangeFade|drawProjectileGlow|TemporalLayer|globalAlpha=/.test(b),
    'o helper não pode reimplementar o que o dispatcher já faz');});

/* ============ 2 · FORMA EXCLUSIVA / 3 · TOPOLOGIA ============ */
console.log('\n[B] formas exclusivas e topologia');
ok('B01 flamer != acid (forma, não cor)',()=>{
  assert.notStrictEqual(topo(P('flamer')),topo(P('acid')),'mesma topologia');
  assert.notStrictEqual(shape(P('flamer')),shape(P('acid')),'mesma geometria');});
ok('B02 as 2 assinaturas são únicas',()=>{
  assert.strictEqual(new Set(FS.map(id=>shape(P(id)))).size,2);});
ok('B03 Flamer: UM corpo preenchido, cauda em garfo, sem stroke',()=>{
  const t=topo(P('flamer'));
  const flits=(t.match(/closePath,fill/g)||[]).length;
  assert.strictEqual(flits,1,'deve ser UM corpo (gotas independentes lêem enxame)');
  assert.strictEqual((t.match(/lineTo/g)||[]).length,7,
    'a cauda partida exige 7 segmentos: '+t);
  assert.ok(!t.includes('stroke'),'flamer não é traço');
  assert.ok(!t.includes('arc'),'flamer não pode virar orb');});
ok('B04 Acid: glóbulo + satélite = 2 corpos DISJUNTOS',()=>{
  const t=topo(P('acid'));
  assert.strictEqual((t.match(/closePath,fill/g)||[]).length,2,
    'deve haver glóbulo e satélite: '+t);
  assert.ok(t.includes('beginPath,moveTo'),'corpos separados por beginPath novo');
  /* primeiro corpo tem 5 vértices (gota completa); o segundo tem 3 */
  const seg=t.split('fill')[0];
  assert.strictEqual((seg.match(/lineTo/g)||[]).length,4,'glóbulo de 4 lineTo');
  assert.ok(!t.includes('stroke')&&!t.includes('arc'),'acid não é traço nem orb');});
ok('B05 traseira é o discriminador: ambas são mais longas ATRÁS que à frente',()=>{
  for(const id of FS){
    const v=verts(P(id));
    const fwd=Math.max(...v.map(q=>q[0]))-100;
    const back=100-Math.min(...v.map(q=>q[0]));
    assert.ok(back>fwd,id+' deveria acumular material atrás: fwd='+fwd+' back='+back);}});
ok('B06 Acid: o satélite fica ESTRITAMENTE atrás do glóbulo (vazio entre eles)',()=>{
  /* movimento em +x: perpendicular só desloca y — os x separavam os corpos */
  const v=verts(P('acid'));
  assert.strictEqual(v.length,8,'5 no glóbulo + 3 no satélite');
  const glob=v.slice(0,5), sat=v.slice(5);
  const maxG=Math.max(...sat.map(q=>q[0])), minF=Math.min(...glob.map(q=>q[0]));
  assert.ok(maxG<minF,' satélite tocou o glóbulo: '+maxG+' vs '+minF);});
ok('B07 as formas são ASSIMÉTRICAS no perpendicular (material irregular)',()=>{
  /* simetria perfeita lê como peça usinada (E3/E10); fluido não é peça */
  for(const id of FS){
    const v=verts(P(id));
    const up=Math.max(...v.map(q=>q[1]))-100;
    const dn=100-Math.min(...v.map(q=>q[1]));
    assert.ok(Math.abs(up-dn)>1e-6,id+' saiu simétrico: '+up+'/'+dn);}});

/* ============ 6 · MESMA COR ============ */
console.log('\n[C] mesma cor / mesmo raio');
ok('C01 mesma cor: as 2 continuam distinguíveis',()=>{
  const s=FS.map(id=>shape(P(id,{color:'#ffffff'})));
  assert.strictEqual(new Set(s).size,2,'colapsaram com a mesma cor');});
ok('C02 cor real trocada: flamer com cor de acid continua flamer',()=>{
  const ca=W('acid').color;
  const sFl=shape(P('flamer',{color:ca}));
  const sAc=shape(P('acid',{color:ca}));
  assert.notStrictEqual(sFl,sAc,'recolorir resolveu — a forma precisa separar');});
ok('C03 mesmo raio artificial: ainda distinguíveis',()=>{
  for(const r of [3,4,5,8]){
    const s=FS.map(id=>shape(P(id,{color:'#ffffff',r:r})));
    assert.strictEqual(new Set(s).size,2,'colapsaram com r='+r);}});
ok('C04 ignorando glow: a diferença permanece',()=>{
  const s=FS.map(id=>topo(P(id,{color:'#ffffff'})));
  assert.strictEqual(new Set(s).size,2);});

/* ============ 7 · COLISÕES COM AS DEMAIS FAMÍLIAS ============ */
console.log('\n[D] separação das outras famílias');
ok('D01 Flamer/Acid != legado (fallback: o traço reto)',()=>{
  /* PR15.5-E7: tesla/plague saíram do legado — a âncora do traço reto é
     agora um tipo DESCONHECIDO (único caminho real até o fallback), e as
     duas armas do E7 não podem colidir com as formas do E6. */
  const leg=topo(P('arma_do_futuro_2027'));
  for(const id of FS){
    assert.notStrictEqual(topo(P(id)),leg,id+' virou traço reto');
    assert.notStrictEqual(shape(P(id)),shape(P('plague')),id+' == plague');
    assert.notStrictEqual(shape(P(id)),shape(P('tesla')),id+' == tesla');
    assert.ok(leg.includes('stroke')&&leg.includes('lineTo')&&!leg.includes('fill'),
      'premissa: o legado é traço');}
  assert.notStrictEqual(topo(P('tesla')),topo(P('plague')),
    'tesla/plague têm formas próprias e distintas (E7)');});
ok('D02 != ENERGIA/MASSA (E5: plasma/orb/void/cryo)',()=>{
  for(const id of FS)for(const o of ['plasma','orb','void','cryo'])
    assert.notStrictEqual(shape(P(id)),shape(P(o)),id+' == '+o);});
ok('D03 != SLUG (E3: rail/sniper/nail)',()=>{
  for(const id of FS)for(const o of ['rail','sniper','nail'])
    assert.notStrictEqual(shape(P(id)),shape(P(o)),id+' == '+o);});
ok('D04 != ENXAME (E4: smg/shotgun/homing/prism)',()=>{
  for(const id of FS)for(const o of ['smg','shotgun','homing','prism'])
    assert.notStrictEqual(shape(P(id)),shape(P(o)),id+' == '+o);});
ok('D05 != CINÉTICO (E10: ricochet/boomer/gatling/mine)',()=>{
  for(const id of FS)for(const o of ['ricochet','boomer','gatling','mine'])
    assert.notStrictEqual(shape(P(id)),shape(P(o)),id+' == '+o);});
ok('D06 nenhuma das 2 colide com QUALQUER outra arma do jogo',()=>{
  const outras=['rail','sniper','nail','smg','shotgun','homing','prism',
                'ricochet','boomer','gatling','mine',
                'plasma','orb','void','cryo','tesla','plague'];
  for(const k of FS)for(const o of outras)
    assert.notStrictEqual(shape(P(k)),shape(P(o)),k+' == '+o);});
ok('D07 distintas mesmo de um tipo desconhecido no fallback',()=>{
  const q=shape(P('tipo_desconhecido_2027'));
  for(const id of FS)assert.notStrictEqual(shape(P(id)),q,id);});

/* ============ 4 · ORIENTAÇÃO / 5 · ESTADO ZERO ============ */
console.log('\n[E] orientação e robustez');
for(const id of FS)
  ok('E·'+id+' orienta em +x, -x, +y e diagonal',()=>{
    const a=verts(P(id,{vx:500,vy:0})), b=verts(P(id,{vx:0,vy:500}));
    const c=verts(P(id,{vx:-500,vy:0})), d=verts(P(id,{vx:400,vy:400}));
    const J=q=>JSON.stringify(q);
    assert.strictEqual(new Set([J(a),J(b),J(c),J(d)]).size,4,'ignorou a direção');
    const extX=q=>Math.max(...q.map(v=>v[0]))-Math.min(...q.map(v=>v[0]));
    const extY=q=>Math.max(...q.map(v=>v[1]))-Math.min(...q.map(v=>v[1]));
    assert.ok(extX(a)>extY(a),id+' em +x');
    assert.ok(extY(b)>extX(b),id+' em +y');});
ok('E03 o garfo do flamer gira JUNTO com o eixo (traseira segue o voo)',()=>{
  const a=verts(P('flamer',{vx:500,vy:0}));
  const traseiroX=Math.min(...a.map(q=>q[0]));
  const b=verts(P('flamer',{vx:-500,vy:0}));
  const traseiroXb=Math.max(...b.map(q=>q[0]));
  assert.ok(traseiroX<100&&traseiroXb>100,'a cauda não acompanhou o sentido');});
ok('E04 o satélite do acid gira JUNTO (atrás em qualquer direção)',()=>{
  const c=verts(P('acid',{vx:-500,vy:0}));           // voando para a esquerda
  const sat=c.slice(5);
  assert.ok(Math.min(...sat.map(q=>q[0]))>Math.max(...c.slice(0,5).map(q=>q[0])),
    'voando para a esquerda, o satélite deve estar à DIREITA (atrás)');});
ok('E05 velocidade zero não produz NaN em nenhuma das 2',()=>{
  for(const id of FS){
    const v=verts(P(id,{vx:0,vy:0}));
    assert.ok(v.every(q=>Number.isFinite(q[0])&&Number.isFinite(q[1])),id+' NaN');
    const l=draw(P(id,{vx:0,vy:0}));
    l.forEach(e=>(e[1]||[]).forEach(a=>
      assert.ok(typeof a!=='number'||Number.isFinite(a),id+' arg NaN')));}});
ok('E06 estado zero (r=0, dist=0) não quebra',()=>{
  for(const id of FS){
    const l=draw(P(id,{r:0,vx:0,vy:0,dist:0,maxDist:0}));
    assert.ok(l.length>0,id+' não desenhou nada');
    l.forEach(e=>(e[1]||[]).forEach(a=>
      assert.ok(typeof a!=='number'||Number.isFinite(a),id+' NaN com r=0')));}});

/* ============ 8/9 · DETERMINISMO E PUREZA ============ */
console.log('\n[F] determinismo e pureza');
ok('F01 zero RNG no draw das 2',()=>{
  const o=S.Math.random;let c=0;S.Math.random=function(){c++;return .5;};
  try{for(const id of FS)draw(P(id));}finally{S.Math.random=o;}
  assert.strictEqual(c,0,'draw consumiu '+c+' RNG');});
ok('F02 nenhum Math.random/rand/randi no helper',()=>{
  const b=body('drawProjectileFluidSpray');
  assert.ok(!/Math\.random/.test(b));
  assert.ok(!/(?<![\w$.])rand\(/.test(b));
  assert.ok(!/(?<![\w$.])randi\(/.test(b));});
ok('F03 sem runTime nas formas (não piscam, não oscilam)',()=>{
  const b=body('drawProjectileFluidSpray');
  assert.ok(!/runTime/.test(b),'a forma não pode depender do tempo');});
ok('F04 draws repetidos do MESMO estado são idênticos (30×)',()=>{
  for(const id of FS){
    const a=JSON.stringify(draw(P(id)));
    for(let i=0;i<30;i++)
      assert.strictEqual(JSON.stringify(draw(P(id))),a,id);}});
ok('F05 zero mutação do projétil no draw',()=>{
  for(const id of FS){
    const p=Object.assign({type:id,x:100,y:100,vx:1000,vy:0,r:6,color:'#fff',
      dist:10,maxDist:1100,aoe:0,life:2});
    const before=JSON.stringify(p);
    S.__pp=p;S.__ctxLog=[];run('drawProjectile(__pp)');S.__ctxLog=null;
    assert.strictEqual(JSON.stringify(S.__pp),before,id+' mutou o projétil');}});
ok('F06 helper não toca player/enemy/parts/projectiles',()=>{
  const b=body('drawProjectileFluidSpray');
  assert.ok(!/spawnParticles|spawnRing|spawnShards|projectiles\.|enemies|player\.|damageEnemy|explodeOrb\(|detonateSpecial\(/.test(b));});
ok('F07 nenhuma coleção cresce no draw',()=>{
  const snap=()=>Array.from(run('[parts.length,projectiles.length,enemies.length,arcs.length]'));
  const a=snap();
  for(const id of FS)for(let i=0;i<10;i++)draw(P(id));
  assert.deepStrictEqual(snap(),a);});
ok('F08 nenhum estado global novo por projétil',()=>{
  const b=body('drawProjectileFluidSpray');
  assert.ok(!/=\s*\[\]|\.push\(|new Map|new Set|new [A-Z]/.test(
    b.replace(/\/\*[\s\S]*?\*\//g,'')));});

/* ============ 11 · CANVAS BUDGET ============ */
console.log('\n[G] canvas budget');
ok('G01 custo bounded nas 2 (≤ 26, teto do E10)',()=>{
  for(const id of FS)assert.ok(ops(P(id))<=26,id+': '+ops(P(id)));});
ok('G02 Flamer (cadência máxima, .045s) é o mais barato da família',()=>{
  const f=ops(P('flamer')), a=ops(P('acid'));
  assert.ok(f<=a,'flamer '+f+' deveria custar <= acid '+a);});
ok('G03 comparável a E3/E4/E5/E10 — sem outlier',()=>{
  const ref=Math.max(ops(P('rail')),ops(P('prism')),ops(P('mine')),ops(P('plasma')));
  for(const id of FS)
    assert.ok(ops(P(id))<=ref+4,id+' ('+ops(P(id))+') destoa de E3/E4/E5/E10 ('+ref+')');});
ok('G04 custo não cresce com vida/distância/repetição',()=>{
  for(const id of FS){
    const base=ops(P(id));
    assert.strictEqual(ops(P(id,{dist:900,life:.1})),base,id+' cresce');
    for(let i=0;i<30;i++)draw(P(id));
    assert.strictEqual(ops(P(id)),base,id+' acumulou');}});
ok('G05 sem gradiente, shadowBlur, Path2D, save/restore, rotate',()=>{
  const b=body('drawProjectileFluidSpray');
  assert.ok(!/createLinearGradient|createRadialGradient|shadowBlur|new Path2D/.test(b));
  assert.ok(!/ctx\.save|ctx\.restore|ctx\.rotate|ctx\.translate|setTransform/.test(b));
  for(const id of FS){
    const l=draw(P(id)).map(e=>e[0]);
    ['rotate','save','restore','translate'].forEach(o=>
      assert.ok(!l.includes(o),id+' emitiu ctx.'+o));}});

/* ============ 12/13 · ECHO E REPETIÇÃO ANCORADA ============ */
console.log('\n[H] Echo e Repetição Ancorada');
const ECHO_OWNER={slot:1,data:{}};
ok('H01 Echo herda a forma das 2',()=>{
  for(const id of FS){
    const base=topo(P(id));
    const eco=topo(P(id,{owner:ECHO_OWNER}));
    assert.ok(eco.startsWith(base),id+' a forma base deixou de vir primeiro');
    assert.ok(eco.length>base.length,id+' perdeu a camada temporal');}
  const b=body('drawProjectileFluidSpray');
  assert.ok(!/owner|team|isEcho|echoes|slot/.test(b),
    'a forma deve depender do tipo, não de quem disparou');});
ok('H02 Replay herda forma + layer e é distinto de Echo',()=>{
  for(const id of FS){
    const base=topo(P(id));
    const rep=topo(P(id,{temporalReplay:true}));
    assert.ok(rep.startsWith(base)&&rep.length>base.length,id);
    assert.notStrictEqual(rep,topo(P(id,{owner:ECHO_OWNER})),id+' replay==echo');}});
ok('H03 E2 intocado',()=>{
  for(const n of ['projectileTemporalMode','drawProjectileTemporalLayer'])
    assert.ok(!/drawProjectileFluidSpray/.test(body(n)),n);
  assert.strictEqual(T.projectileTemporalMode({temporalReplay:true}),T.PTM.REPLAY);
  assert.strictEqual(T.projectileTemporalMode({owner:ECHO_OWNER}),T.PTM.ECHO);
  assert.strictEqual(T.projectileTemporalMode({owner:null}),T.PTM.NONE);});
ok('H04 Repetição Ancorada segue mecanicamente independente',()=>{
  assert.strictEqual(run('TEMPORAL_ACTION_WINDOW'),5);
  assert.strictEqual(run('TEMPORAL_REPLAY_COOLDOWN'),6);
  assert.strictEqual(run('TEMPORAL_REPLAY_DAMAGE'),.50);
  assert.ok(!/drawProjectileFluidSpray/.test(body('replayTemporalAction')));});

/* ============ 14/15/16 · EORB, BEAM, MUZZLE ============ */
console.log('\n[I] eorb, beam e muzzle');
ok('I01 eorb inimigo permanece intacto',()=>{
  assert.strictEqual(topo(P('eorb')),'beginPath,arc,fill,beginPath,arc,stroke');
  assert.strictEqual(shape(P('eorb')),shape(P('orb',{r:6})),
    'eorb deve seguir o mesmo desenho histórico do orb');
  assert.strictEqual(run('PROJ_FAMILY["eorb"]'),undefined);
  assert.strictEqual(T.visualFamilyForProjectile({type:'eorb'}),T.PVF.LEGACY);
  assert.ok(body('drawProjectile').includes("p.type==='eorb'"));});
ok('I02 mudanças da família não vazam para eorb',()=>{
  const b=body('drawProjectileFluidSpray');
  assert.ok(!/eorb/.test(b),'o helper do E6 não deve mencionar eorb');});
ok('I03 beam intacto',()=>{
  assert.strictEqual(run('PROJ_FAMILY["beam"]'),undefined);
  const b=body('drawBeamFrom');
  assert.ok(!/drawProjectileFluidSpray/.test(b));
  assert.ok(b.includes('createLinearGradient')&&b.includes('rampMax'));});
ok('I04 muzzle do E8 intocado (família emite 2, cone largo)',()=>{
  for(const n of ['muzzleShot','muzzlePower','emitWeaponMuzzleVisual'])
    assert.ok(!/drawProjectileFluidSpray/.test(body(n)),n);
  const cnt=id=>{run('parts.length=0;player.aim=0');
    run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id==="'+id+'"))');
    const n=run('parts.length');run('parts.length=0');return n;};
  for(const id of FS)assert.strictEqual(cnt(id),2,id);});
ok('I05 nenhum impacto novo foi adicionado (E9 fora do escopo)',()=>{
  const b=body('drawProjectileFluidSpray');
  assert.ok(!/shake|rumble|floatText|sBoom|flash|shock/.test(b));});

/* ============ 17 · E0/E1/E3/E4/E5/E10 PRESERVADOS ============ */
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
ok('J04 E5: plasma/void/cryo mantêm forma própria; orb byte-idêntico',()=>{
  assert.strictEqual(topo(P('orb')),'beginPath,arc,fill,beginPath,arc,stroke');
  /* PR15.5-E7: âncora de legado = tipo desconhecido (tesla saiu no E7) */
  const leg=topo(P('arma_do_futuro_2027'));
  for(const id of ['plasma','void','cryo'])
    assert.notStrictEqual(topo(P(id)),leg,id+' regrediu para o legado');
  assert.strictEqual(new Set(['plasma','void','cryo'].map(id=>shape(P(id)))).size,3,
    'as 3 do E5 devem continuar distintas entre si');});
ok('J05 helpers anteriores não foram tocados pelo E6',()=>{
  for(const n of ['drawProjectileSlug','drawProjectileSwarm','drawProjectileKinetic','drawProjectileEnergyMass'])
    assert.ok(!/drawProjectileFluidSpray/.test(body(n)),n);});
ok('J06 E1: gramática intacta',()=>{
  ['PROJ_FAMILY','visualFamilyForProjectile','projectileUsesOrbShape',
   'projectileRangeFade','drawProjectileGlow','drawProjectileLegacyLine']
    .forEach(n=>assert.ok(SRC.includes(n),n));
  assert.strictEqual(T.projectileRangeFade({maxDist:0}),1);});
ok('J07 tesla/plague saíram do legado (E7 aplicado) e o fallback segue vivo',()=>{
  const leg=topo(P('arma_do_futuro_2027'));
  assert.ok(leg.includes('stroke')&&!leg.includes('fill'),'legado é traço');
  for(const id of ['tesla','plague']){
    assert.notStrictEqual(topo(P(id)),leg,id+' regrediu para o fallback');
    for(const f of FS)
      assert.notStrictEqual(shape(P(id)),shape(P(f)),id+' (E7) colidiu com '+f+' (E6)');}
  assert.notStrictEqual(topo(P('tesla')),topo(P('plague')),'E7: formas iguais');});

/* ============ 10/18 · MECÂNICA (auditoria empírica) ============ */
console.log('\n[K] mecânica inalterada (auditoria da sonda)');
ok('K01 defs das 2 armas idênticas à base',()=>{
  const ESP={
    flamer:{interval:.045,speed:430,dmg:2.6,count:1,spread:0,jitter:.30,life:.5,pr:5,
      kick:8,range:210,color:'#ff7a2f'},
    acid:{interval:.28,speed:520,dmg:7,count:2,spread:.10,jitter:.07,life:1.1,pr:4,
      kick:26,range:330,color:'#a8ff3d'}};
  for(const [id,exp] of Object.entries(ESP)){
    const w=W(id);
    for(const [k,v] of Object.entries(exp))assert.strictEqual(w[k],v,id+'.'+k);}
  /* os fx (queimadura / corrosão) intactos */
  const fxf=W('flamer').fx, fxa=W('acid').fx;
  assert.strictEqual(fxf.k,'burn');assert.strictEqual(fxf.dur,3.2);
  assert.strictEqual(fxf.pow,9);
  assert.strictEqual(fxa.k,'corrode');assert.strictEqual(fxa.dur,4.5);
  assert.strictEqual(fxa.pow,.12);});
ok('K02 disparo real: campos do projétil inalterados',()=>{
  const o=S.Math.random;S.Math.random=()=>0.999999;
  try{
    for(const id of FS){
      run('projectiles.length=0;player.aim=0');
      run('fireWeaponFrom(player,WEAPONS.find(w=>w.id==='+JSON.stringify(id)+'),"ally",1,"player")');
      const w=W(id);
      assert.strictEqual(run('projectiles.length'),w.count,id+' count');
      assert.strictEqual(run('projectiles[0].type'),id,id+' type');
      assert.strictEqual(run('projectiles[0].color'),w.color,id+' color');
      assert.strictEqual(run('projectiles[0].r'),w.pr,id+' r');
      assert.strictEqual(run('projectiles[0].dmg'),w.dmg,id+' dmg');
      assert.strictEqual(run('projectiles[0].aoe'),0,id+' AoE apareceu (não existe)');
      assert.strictEqual(run('projectiles[0].pierce'),0,id+' pierce apareceu');
      run('projectiles.length=0');}
  }finally{S.Math.random=o;}});
ok('K03 Flamer: burn aplicado no ALVO ÚNICO, 2º alvo intocado (sem AoE)',()=>{
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",760,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  const hp0=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:430,vy:0,r:5,dmg:2.6,life:.5,type:"flamer",'+
      'team:"ally",color:"#ff7a2f",aoe:0,pierce:0,dist:0,maxDist:210,hits:null,'+
      'def:WEAPONS.find(w=>w.id==="flamer"),born:0,owner:player})');
  run('updateProjectiles(1/60)');
  const hp1=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  assert.ok(hp1[0]<hp0[0],'o alvo direto deveria tomar dano');
  assert.strictEqual(hp1[1],hp0[1],'o 2º alvo NÃO deve tomar dano (não há AoE)');
  const st=JSON.parse(run('JSON.stringify(enemies[0].st||{})'));
  assert.ok(Math.abs(st.burnT-3.2)<1e-9,'burnT: '+st.burnT);
  assert.strictEqual(st.burnP,9,'burnP: '+st.burnP);
  const st2=JSON.parse(run('JSON.stringify(enemies[1].st||{})'));
  assert.ok(!st2.burnT,'burn não pode vazar para o 2º alvo');
  run('projectiles.length=0');run('enemies.length=0');});
ok('K04 Acid: corrode aplicado no ALVO ÚNICO, 2º alvo intocado (sem AoE)',()=>{
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",760,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  const hp0=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:520,vy:0,r:4,dmg:7,life:1.1,type:"acid",'+
      'team:"ally",color:"#a8ff3d",aoe:0,pierce:0,dist:0,maxDist:330,hits:null,'+
      'def:WEAPONS.find(w=>w.id==="acid"),born:0,owner:player})');
  run('updateProjectiles(1/60)');
  const hp1=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  assert.ok(hp1[0]<hp0[0],'o alvo direto deveria tomar dano');
  assert.strictEqual(hp1[1],hp0[1],'o 2º alvo NÃO deve tomar dano (não há AoE)');
  const st=JSON.parse(run('JSON.stringify(enemies[0].st||{})'));
  assert.ok(Math.abs(st.corrT-4.5)<1e-9,'corrT: '+st.corrT);
  assert.ok(Math.abs(st.corrP-.12)<1e-9,'corrP: '+st.corrP);
  run('projectiles.length=0');run('enemies.length=0');});
ok('K05 Burn é DoT real: 12 ticks de 2.25 em 3.2s e então expira',()=>{
  /* medido na sonda: 12 ticks × (9 × .25) = 27.00 de dano total, sem resto */
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  run('applyStatus(enemies[0],"burn",3.2,9,player)');
  let ticks=0,total=0;
  for(let i=0;i<60*5;i++){
    const a=run('enemies[0].hp');
    run('tickStatus(enemies[0],1/60)');
    const b=run('enemies[0].hp');
    if(b<a){ticks++;total+=a-b;}
    run('enemies[0].vx=0;enemies[0].vy=0');
  }
  assert.strictEqual(ticks,12,'ticks: '+ticks);
  assert.ok(Math.abs(total-2.25*12)<1e-6,'DoT total: '+total.toFixed(3));
  const st=JSON.parse(run('JSON.stringify(enemies[0].st||{})'));
  assert.ok(!st.burnT||st.burnT<=0,'burn deveria ter expirado: '+st.burnT);
  run('enemies.length=0');});
ok('K06 Corrode NÃO é DoT: 2s de tick, 0 de dano; dano recebido amplificado',()=>{
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;})');
  run('applyStatus(enemies[0],"corrode",4.5,.12,player)');
  assert.ok(Math.abs(run('statusDmgMul(enemies[0])')-1.12)<1e-9,'×1 stack');
  run('applyStatus(enemies[0],"corrode",4.5,.12,player)');
  assert.ok(Math.abs(run('statusDmgMul(enemies[0])')-1.24)<1e-9,'×2 stacks');
  const h0=run('enemies[0].hp');
  for(let i=0;i<60*2;i++){run('tickStatus(enemies[0],1/60)');run('enemies[0].vx=0;enemies[0].vy=0');}
  assert.strictEqual(run('enemies[0].hp'),h0,'corrode não pode causar dano por tick');
  run('var __d0=enemies[0].hp;damageEnemy(enemies[0],10,600,300,false,false);');
  const ampl=run('__d0')-run('enemies[0].hp');
  assert.ok(Math.abs(ampl-12.4)<1e-9,'dano recebido ×1.24: '+ampl);
  run('enemies.length=0');});
ok('K07 pierce base 0: morre no 1º alvo mesmo com alvos sobrepostos',()=>{
  for(const id of FS){
    run('enemies.length=0');
    run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",700,360,1)');
    run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
    run('projectiles.length=0');
    run('projectiles.push({x:694,y:360,vx:500,vy:0,r:5,dmg:7,life:1,type:"'+id+'",'+
        'team:"ally",color:"#fff",aoe:0,pierce:0,dist:0,maxDist:400,hits:null,'+
        'def:WEAPONS.find(w=>w.id==="'+id+'"),born:0,owner:player})');
    run('updateProjectiles(1/60)');
    const n=run('enemies.filter(e=>e.hp<e.maxHp).length');
    assert.strictEqual(n,1,id+' feriu '+n+' alvos');
    assert.strictEqual(run('projectiles.length'),0,id+' deveria morrer no impacto');
    run('projectiles.length=0');run('enemies.length=0');}});
ok('K08 expiração por alcance = 3 faíscas genéricas; por vida = silêncio (E9 preservado)',()=>{
  for(const id of FS){
    run('parts.length=0;projectiles.length=0');
    run('projectiles.push({x:100,y:100,vx:0,vy:0,r:5,dmg:1,life:9,type:"'+id+'",'+
        'team:"ally",color:"#fff",aoe:0,pierce:0,dist:9999,maxDist:400,hits:null,'+
        'def:WEAPONS.find(w=>w.id==="'+id+'"),born:0,owner:player})');
    run('updateProjectiles(1/60)');
    assert.strictEqual(run('parts.length'),3,id+' alcance');
    assert.strictEqual(run('projectiles.length'),0,id+' alcance não removeu');
    run('parts.length=0;projectiles.length=0');
    run('projectiles.push({x:100,y:100,vx:0,vy:0,r:5,dmg:1,life:.0001,type:"'+id+'",'+
        'team:"ally",color:"#fff",aoe:0,pierce:0,dist:0,maxDist:400,hits:null,'+
        'def:WEAPONS.find(w=>w.id==="'+id+'"),born:0,owner:player})');
    run('updateProjectiles(1/60)');
    assert.strictEqual(run('parts.length'),0,id+' vida (sem impacto: E9 não é deste PR)');
    run('parts.length=0');}});
ok('K09 detonateSpecial/explodeOrb/onProjectileHit intactos (sem áreas ocultas)',()=>{
  const chamadas=(SRC.match(/(?<!function )detonateSpecial\(p\)/g)||[]).length;
  assert.strictEqual(chamadas,1,'detonateSpecial deve ser chamado só pela mine');
  const ap=body('applyStatus');
  assert.ok(ap.includes('s.burnT'),'burn saiu do applyStatus');
  assert.ok(ap.includes('s.corrT'),'corrode saiu do applyStatus');});

/* ============ REGRESSÃO ============ */
console.log('\n[L] regressão');
const reg=require('./suite-registry.js');
ok('L01 esta suíte é descoberta pelo npm test',()=>{
  assert.ok(reg.suiteIsDiscovered('pr15-5-e6-fluid-spray-projectile-identity'));});
for(const s of ['pr15-5-e5-energy-mass-projectile-identity',
                'pr15-5-e10-kinetic-return-projectile-identity',
                'pr15-5-e4-swarm-projectile-identity','pr15-5-e8-muzzle-emission-identity',
                'pr15-5-e3-slug-penetrator-identity','pr15-5-e2-temporal-projectile-identity',
                'pr15-5-e1-projectile-visual-grammar','pr15-5-e0-visual-determinism',
                'pr15-7-b-anchored-replay-prototype','pr15-5-performance-audit1'])
  ok('L·'+s+' continua no runner',()=>{assert.ok(reg.suiteIsDiscovered(s),s);});
ok('L11 documentação do E6 existe',()=>{
  assert.ok(fs.existsSync(path.join(root,'PR15_5_E6_FLUID_SPRAY_PROJECTILE_IDENTITY.md')));});

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
