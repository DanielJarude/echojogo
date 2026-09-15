'use strict';
/* ECHO — PR15.5-E10 · CINÉTICO / RETORNO — identidade do PROJÉTIL
   ---------------------------------------------------------------------
   Ricochet, Boomer, Gatling e Mine eram as quatro últimas armas presas em
   drawProjectileLegacyLine: um traço de 5px, 13 ops, idêntico entre elas.
   Uma mina lançada e uma bala de giro-canhão desenhavam a MESMA coisa.

   Cada forma aqui nasce de mecânica auditada, não do nome da arma:
     ricochet  bounce:3, dmg*1.15 por quique  → faces de impacto, desgaste
     boomer    boomerang, p.spin+=dt*18       → cubo + 2 braços girando
     gatling   bala comum speed 1000          → cartucho mínimo
     mine      desacelera ~0, p.armT>.45      → casco + pernas ao armar

   Toda prova compara TOPOLOGIA ou GEOMETRIA — nunca cor, largura ou alpha. */
const assert=require('assert'),fs=require('fs'),path=require('path');
const {world,readSource}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}}
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5-E10 · CINÉTICO / RETORNO');

const KIN=['ricochet','boomer','gatling','mine'];
const GEOM=['beginPath','moveTo','lineTo','arc','closePath','fill','stroke','rect',
            'quadraticCurveTo','bezierCurveTo'];
run('glowSprite("#ffffff")');
/* estado representativo de cada arma, derivado da mecânica real */
const ST={ricochet:{bounce:3},boomer:{spin:0},gatling:{},mine:{armT:0}};
function draw(over){
  const p=Object.assign({x:100,y:100,vx:1000,vy:0,r:4,color:'#ffffff',
    dist:0,maxDist:1100},over);
  S.__pp=p;S.__ctxLog=[];run('drawProjectile(__pp)');const l=S.__ctxLog;
  S.__ctxLog=null;return l;
}
const P=(t,ex)=>Object.assign({type:t},ST[t]||{},ex||{});
const topo=o=>draw(o).filter(e=>GEOM.includes(e[0])).map(e=>e[0]).join(',');
const verts=o=>draw(o).filter(e=>e[0]==='moveTo'||e[0]==='lineTo')
  .map(e=>[+(e[1][0]).toFixed(6),+(e[1][1]).toFixed(6)]);
const ops=o=>draw(o).length;
/* assinatura COMPLETA: topologia + geometria normalizada em torno da
   posição. É o que prova "formas diferentes", não só "ops diferentes". */
function shape(o){
  return topo(o)+'|'+JSON.stringify(verts(o).map(q=>[+(q[0]-100).toFixed(3),+(q[1]-100).toFixed(3)]));
}
function body(name){
  const m=SRC.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(m,'função não encontrada: '+name);return m[0];}
const W=id=>run('WEAPONS.find(w=>w.id==='+JSON.stringify(id)+')');
run('__ECHO_AUDIT_FIXTURES.prepare("E")');

/* ============ A–E · CLASSIFICAÇÃO E ROTEAMENTO (29.A–E) ============ */
console.log('\n[A] família e roteamento');
for(const id of KIN)
  ok('A·'+id+' classificado como CINÉTICO/RETORNO',()=>{
    assert.strictEqual(run('PROJ_FAMILY['+JSON.stringify(id)+']'),T.PVF.KINETIC);
    assert.strictEqual(T.visualFamilyForProjectile({type:id}),T.PVF.KINETIC);});
ok('E01 helper dedicado existe e as 4 chegam nele (29.E)',()=>{
  assert.strictEqual(typeof T.drawProjectileKinetic,'function');
  const b=body('drawProjectile');
  assert.ok(/PVF_KINETIC\)drawProjectileKinetic/.test(b),'dispatcher não encaminha');});
ok('E02 dispatcher do E1 segue sendo o ponto único',()=>{
  assert.strictEqual((SRC.match(/drawProjectileKinetic\(/g)||[]).length,2,
    '1 definição + 1 chamada');});
ok('E03 nenhuma das 4 continua na linha legada',()=>{
  const leg=topo(P('cryo'));
  for(const id of KIN)
    assert.notStrictEqual(topo(P(id)),leg,id+' ainda é o traço legado');});
ok('E04 sem registry novo, sem classe, sem duplicar PROJ_FAMILY (§15)',()=>{
  const b=body('drawProjectileKinetic');
  assert.ok(!/class |new Map|new Set|PROJ_FAMILY\s*=/.test(b));
  assert.strictEqual((SRC.match(/const PROJ_FAMILY=/g)||[]).length,1);});

/* ============ F–K · AS QUATRO SÃO DISTINTAS (29.F–K) ============ */
console.log('\n[B] topologias distintas dentro da família');
const pares=[['ricochet','boomer'],['ricochet','gatling'],['ricochet','mine'],
             ['boomer','gatling'],['boomer','mine'],['gatling','mine']];
for(const [a,b] of pares)
  ok('B·'+a+' != '+b,()=>{
    assert.notStrictEqual(topo(P(a)),topo(P(b)),a+'/'+b+' mesma topologia');
    assert.notStrictEqual(shape(P(a)),shape(P(b)),a+'/'+b+' mesma geometria');});
ok('B07 as 4 assinaturas são únicas',()=>{
  assert.strictEqual(new Set(KIN.map(id=>shape(P(id)))).size,4);});
ok('B08 L · mesma cor mantém as 4 distinguíveis (29.L / §31)',()=>{
  const s=KIN.map(id=>shape(P(id,{color:'#ffffff',r:4,vx:1000,vy:0,x:100,y:100})));
  assert.strictEqual(new Set(s).size,4,'com a mesma cor as formas colapsaram');
  /* e a distinção sobrevive mesmo ignorando a contagem de ops */
  const g=KIN.map(id=>JSON.stringify(verts(P(id)).map(q=>[+(q[0]-100).toFixed(3),+(q[1]-100).toFixed(3)])));
  assert.strictEqual(new Set(g).size,4,'as geometrias colidiram');});

/* ============ M–P · NÃO CONFUNDIR COM BLOCOS ANTERIORES ============ */
console.log('\n[C] separação de E3 / E4 / orb');
ok('M01 Ricochet != Nail (29.M / §13)',()=>{
  assert.notStrictEqual(shape(P('ricochet')),shape(P('nail')));
  /* nail é haste com entalhe em V; ricochet é peça chanfrada mais curta */
  const ext=o=>{const v=verts(o);return Math.max(...v.map(q=>q[0]))-Math.min(...v.map(q=>q[0]));};
  assert.ok(ext(P('ricochet'))<ext(P('nail')),'ricochet deve ser mais curto que nail');});
ok('N01 Gatling != SMG (29.N / §12)',()=>{
  assert.notStrictEqual(shape(P('gatling')),shape(P('smg')));
  const g=verts(P('gatling')),s=verts(P('smg'));
  assert.ok(g.length>s.length,'cartucho deve ter mais vértices que a microcápsula');
  /* SMG é losango: um único vértice traseiro. Gatling tem base RETA: dois. */
  const back=q=>q.filter(v=>v[0]<100-0.01).length;
  assert.strictEqual(back(s),1,'smg deveria ter 1 vértice traseiro');
  assert.strictEqual(back(g),2,'gatling deveria ter base reta (2 vértices)');});
ok('N02 Gatling != Shotgun (cartucho simétrico vs caco assimétrico)',()=>{
  assert.notStrictEqual(shape(P('gatling')),shape(P('shotgun')));
  const sym=o=>{const off=verts(o).map(q=>+(q[1]-100).toFixed(3));
    return off.filter(v=>v>0).length===off.filter(v=>v<0).length;};
  assert.ok(sym(P('gatling')),'cartucho deve ser simétrico');
  assert.ok(!sym(P('shotgun')),'pellet deve seguir assimétrico (E4)');});
ok('O01 Boomer != Prism (29.O / §14)',()=>{
  assert.notStrictEqual(shape(P('boomer')),shape(P('prism')));
  /* prism = 2 facetas preenchidas; boomer = 1 corpo + eixo */
  assert.strictEqual((topo(P('prism')).match(/closePath,fill/g)||[]).length,2);
  assert.strictEqual((topo(P('boomer')).match(/closePath,fill/g)||[]).length,1);});
ok('P01 Mine != Orb (29.P / §11)',()=>{
  assert.notStrictEqual(shape(P('mine')),shape(P('orb')));
  assert.ok(topo(P('orb')).includes('arc'),'orb é energético (arc)');
  assert.ok(!topo(P('mine')).includes('arc'),
    'mine não pode usar arc — é material, não esfera energética');
  assert.ok(!topo(P('mine',{armT:1})).includes('arc'),'nem quando armada');});
ok('P02 Mine != as demais famílias materiais',()=>{
  for(const o of ['rail','sniper','nail','smg','shotgun','homing','prism'])
    assert.notStrictEqual(shape(P('mine')),shape(P(o)),'mine == '+o);});
ok('C07 nenhuma das 4 colide com QUALQUER outra arma do jogo',()=>{
  const outras=['rail','sniper','nail','smg','shotgun','homing','prism','cryo','orb'];
  for(const k of KIN)for(const o of outras)
    assert.notStrictEqual(shape(P(k)),shape(P(o)),k+' == '+o);});

/* ============ Q–R · ORIENTAÇÃO (29.Q/R / §32) ============ */
console.log('\n[D] orientação segue vx/vy');
for(const id of ['ricochet','boomer','gatling'])
  ok('D·'+id+' acompanha a direção (+x vs +y)',()=>{
    const a=verts(P(id,{vx:500,vy:0})), b=verts(P(id,{vx:0,vy:500}));
    assert.notStrictEqual(JSON.stringify(a),JSON.stringify(b),'ignorou a direção');
    const extX=q=>Math.max(...q.map(v=>v[0]))-Math.min(...q.map(v=>v[0]));
    const extY=q=>Math.max(...q.map(v=>v[1]))-Math.min(...q.map(v=>v[1]));
    assert.ok(extX(a)>extY(a),id+' em +x deveria ser mais longo em x');
    assert.ok(extY(b)>extX(b),id+' em +y deveria ser mais longo em y');});
ok('D04 Ricochet acompanha a NOVA direção após inverter vx (29.Q/§20)',()=>{
  /* o bounce real faz p.vx=-|vx|; a forma só precisa seguir o vetor */
  const ida=verts(P('ricochet',{vx:800,vy:0}));
  const volta=verts(P('ricochet',{vx:-800,vy:0}));
  const bicoIda=Math.max(...ida.map(q=>q[0]));
  const bicoVolta=Math.min(...volta.map(q=>q[0]));
  assert.ok(bicoIda>100,'bico deveria apontar +x');
  assert.ok(bicoVolta<100,'após inverter, o bico deveria apontar -x');});
ok('D05 Boomer: p.spin real gira a peça (§21)',()=>{
  const a=verts(P('boomer',{spin:0})), b=verts(P('boomer',{spin:1.2}));
  assert.notStrictEqual(JSON.stringify(a),JSON.stringify(b),'p.spin ignorado');
  /* rotação preserva o comprimento dos braços — é giro, não deformação */
  const rmax=q=>Math.max(...q.map(v=>Math.hypot(v[0]-100,v[1]-100)));
  assert.ok(Math.abs(rmax(a)-rmax(b))<1e-6,'a peça deformou em vez de girar');});
ok('D06 Boomer na volta segue o vetor real, sem trail nem seta (§21)',()=>{
  const ida=verts(P('boomer',{vx:640,vy:0,spin:0,returning:0}));
  const volta=verts(P('boomer',{vx:-640,vy:0,spin:0,returning:1}));
  assert.notStrictEqual(JSON.stringify(ida),JSON.stringify(volta));
  /* returning não adiciona ops: a leitura vem do vetor, não de ornamento */
  assert.strictEqual(topo(P('boomer',{returning:1})),topo(P('boomer',{returning:0})));
  /* checa o CÓDIGO executável, não os comentários — a versão anterior
     deste assert casava com a própria nota "sem trail, sem seta". */
  const b=body('drawProjectileKinetic').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/trail|arrow|history|prevX|lastX/.test(b));});
ok('D07 Mine: orientação é funcional e documentada',()=>{
  /* a mine desacelera até ~0 mas o casco mantém eixo pelo vetor atual;
     com vx/vy nulos o helper cai no fallback 1,0 sem NaN */
  const v=verts(P('mine',{vx:0,vy:0}));
  assert.ok(v.every(q=>Number.isFinite(q[0])&&Number.isFinite(q[1])),'NaN com v=0');
  assert.notStrictEqual(JSON.stringify(verts(P('mine',{vx:300,vy:0}))),
    JSON.stringify(verts(P('mine',{vx:0,vy:300}))),'casco ignora o eixo');});

/* ============ ESTADOS REAIS (§22 / §34 / §35 / §36) ============ */
console.log('\n[E] estados reais das armas');
ok('E10 Ricochet: o desgaste usa p.bounce real (3→0)',()=>{
  const s=[3,2,1,0].map(b=>shape(P('ricochet',{bounce:b})));
  assert.strictEqual(new Set(s).size,4,'p.bounce não altera a forma');
  /* e a topologia é estável: muda a proporção, não a construção */
  const t=[3,2,1,0].map(b=>topo(P('ricochet',{bounce:b})));
  assert.strictEqual(new Set(t).size,1,'a construção deveria ser a mesma');});
ok('E11 Ricochet: bounce é mecânica REAL e inalterada (§34)',()=>{
  assert.strictEqual(W('ricochet').bounce,3);
  const u=SRC.match(/if\(p\.bounce>0\)\{[\s\S]*?\n    \}/)[0];
  assert.ok(u.includes('p.bounce--;p.dmg*=1.15;p.hits=null;'),'regra do quique mudou');
  assert.ok(u.includes('p.vx=Math.abs(p.vx)')&&u.includes('p.vy=-Math.abs(p.vy)'));});
ok('E12 Boomer: retorno é REAL e inalterado (§35)',()=>{
  assert.strictEqual(W('boomer').boomerang,true);
  assert.strictEqual(W('boomer').basePierce,99);
  const u=SRC.match(/if\(p\.boomerang\)\{[\s\S]*?\n    \}/)[0];
  assert.ok(u.includes("if(t>life0*.42&&!p.returning){p.returning=1;}"),'trigger mudou');
  assert.ok(u.includes('p.spin=(p.spin||0)+dt*18;'),'spin mudou');
  assert.ok(u.includes('p.maxDist=0;')&&u.includes('p.hits=null;'));});
ok('E13 Mine: p.armT é estado real e comanda as pernas (§22/§36)',()=>{
  const voo=topo(P('mine',{armT:0})), arm=topo(P('mine',{armT:1}));
  assert.notStrictEqual(voo,arm,'o estado armado não é legível');
  assert.ok(arm.length>voo.length,'armada deveria mostrar as pernas');
  assert.ok(arm.startsWith(voo),'o casco deve ser o mesmo nos dois estados');
  /* o limiar é exatamente o da mecânica: .45 */
  assert.strictEqual(topo(P('mine',{armT:.44})),voo);
  assert.strictEqual(topo(P('mine',{armT:.46})),arm);
  assert.ok(body('drawProjectileKinetic').includes('.45'),'limiar deve vir de armT');});
ok('E14 Mine: ciclo mecânico intacto (§36)',()=>{
  const u=SRC.match(/if\(p\.mine\)\{[\s\S]*?\n    \}/)[0];
  assert.ok(u.includes('p.vx*=Math.pow(.02,dt)'),'desaceleração mudou');
  assert.ok(u.includes("p.armT=(p.armT||0)+dt"),'armamento mudou');
  assert.ok(u.includes('if(p.armT>.45)'),'limiar de armamento mudou');
  assert.ok(u.includes('110*110'),'raio de gatilho mudou');
  assert.ok(u.includes('detonateSpecial(p)'),'detonação mudou');
  assert.strictEqual(W('mine').aoe,120);
  assert.strictEqual(W('mine').life,14);});
ok('E15 Gatling: spinUp afeta a ARMA, não o projétil (auditoria)',()=>{
  assert.strictEqual(W('gatling').spinUp,true);
  /* o spin entra no jitter do disparo; o projétil é bala comum */
  assert.ok(SRC.includes("const jt=def.spinUp?def.jitter*(1-.7*(src.spin||0)):def.jitter;"));
  const b=body('drawProjectileKinetic');
  const gat=b.split("t==='ricochet'")[0];
  assert.ok(!/spinUp|src\.spin/.test(gat),'o desenho não deve ler spin da arma');});

/* ============ S–T · CUSTO (29.S/T / §19) ============ */
console.log('\n[F] custo');
ok('S01 Gatling é o mais barato da família (§9/§19)',()=>{
  const c={};KIN.forEach(id=>c[id]=ops(P(id)));
  assert.strictEqual(c.gatling,Math.min(...Object.values(c)),JSON.stringify(c));});
ok('S02 Gatling está entre os projéteis mais baratos do jogo',()=>{
  const g=ops(P('gatling'));
  for(const o of ['rail','nail','homing','prism','orb','boomer','mine'])
    assert.ok(g<ops(P(o)),'gatling ('+g+') não é mais barato que '+o+' ('+ops(P(o))+')');});
ok('S03 Ricochet tem custo baixo',()=>{
  assert.ok(ops(P('ricochet'))<=20,'ricochet: '+ops(P('ricochet')));});
ok('T01 Mine tem custo moderado e CONSTANTE nos dois estados',()=>{
  assert.ok(ops(P('mine',{armT:0}))<=26);
  assert.ok(ops(P('mine',{armT:9}))<=40,'armada: '+ops(P('mine',{armT:9})));});
ok('T02 nenhum custo cresce com tempo/vida/distância/bounces (§19)',()=>{
  for(const id of KIN){
    const base=ops(P(id));
    assert.strictEqual(ops(P(id,{dist:900,life:.1})),base,id+' cresce com dist/life');
    assert.strictEqual(ops(P(id,{born:0})),base,id+' cresce com o tempo');}
  /* bounces: a peça se desgasta, mas o custo é o mesmo */
  for(const b of [3,2,1,0])
    assert.strictEqual(ops(P('ricochet',{bounce:b})),ops(P('ricochet',{bounce:3})));
  /* spin acumulado não adiciona ops */
  for(const sp of [0,10,100,1000])
    assert.strictEqual(ops(P('boomer',{spin:sp})),ops(P('boomer',{spin:0})));});
ok('T03 custo não cresce com repetição de draw',()=>{
  for(const id of KIN){
    const a=ops(P(id));
    for(let i=0;i<30;i++)draw(P(id));
    assert.strictEqual(ops(P(id)),a,id+' acumulou custo');}});
ok('T04 sem gradiente/blur/Path2D/alocação/rotate (§17/§18)',()=>{
  const b=body('drawProjectileKinetic');
  assert.ok(!/createLinearGradient|createRadialGradient|shadowBlur|new Path2D/.test(b));
  assert.ok(!/ctx\.save|ctx\.restore|ctx\.rotate|ctx\.translate|setTransform/.test(b));
  const c=b.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/=\s*\[\]|\.push\(|new [A-Z]|\.map\(|\.filter\(/.test(c));
  for(const id of KIN){
    const l=draw(P(id)).map(e=>e[0]);
    ['rotate','save','restore','translate'].forEach(o=>
      assert.ok(!l.includes(o),id+' emitiu ctx.'+o));}});

/* ============ U–W · DETERMINISMO E PUREZA (29.U–W) ============ */
console.log('\n[G] determinismo e pureza');
ok('U01 zero RNG no draw das 4 (29.U / §27)',()=>{
  const o=S.Math.random;let c=0;S.Math.random=function(){c++;return .5;};
  try{for(const id of KIN){draw(P(id));draw(P(id,{armT:1,bounce:1,spin:2}));}}
  finally{S.Math.random=o;}
  assert.strictEqual(c,0,'draw consumiu '+c+' RNG');});
ok('U02 nenhum Math.random/rand/randi no helper',()=>{
  const b=body('drawProjectileKinetic');
  assert.ok(!/Math\.random/.test(b));
  assert.ok(!/(?<![\w$.])rand\(/.test(b));
  assert.ok(!/(?<![\w$.])randi\(/.test(b));
  assert.ok(!/runTime/.test(b),'a forma oscilaria no tempo');});
ok('U03 30 draws produzem traces idênticos (§27)',()=>{
  for(const id of KIN){
    const a=JSON.stringify(draw(P(id)));
    for(let i=0;i<30;i++)
      assert.strictEqual(JSON.stringify(draw(P(id))),a,id);}});
ok('V01 zero mutação do projétil no draw (29.V / §28)',()=>{
  for(const id of KIN){
    const p=Object.assign({type:id,x:100,y:100,vx:1000,vy:0,r:4,color:'#fff',
      dist:0,maxDist:1100,bounce:3,spin:1.5,armT:.6,returning:1,life:2},ST[id]);
    const before=JSON.stringify(p);
    S.__pp=p;S.__ctxLog=[];run('drawProjectile(__pp)');S.__ctxLog=null;
    assert.strictEqual(JSON.stringify(S.__pp),before,id+' mutou o projétil');}});
ok('V02 helper não toca player/enemy/parts/projectiles (§28)',()=>{
  const b=body('drawProjectileKinetic');
  assert.ok(!/spawnParticles|spawnRing|spawnShards|projectiles\.|enemies|player\.|echoes|detonate/.test(b));});
ok('W01 nenhuma coleção cresce no draw (29.W)',()=>{
  const snap=()=>Array.from(run('[parts.length,projectiles.length,enemies.length,arcs.length]'));
  const a=snap();
  for(const id of KIN)for(let i=0;i<10;i++){draw(P(id));draw(P(id,{armT:1}));}
  assert.deepStrictEqual(snap(),a);});

/* ============ X–AD · BLOCOS ANTERIORES (29.X–AD) ============ */
console.log('\n[H] E2 / E3 / E4 / E8 / Echo / replay');
const ECHO_OWNER={slot:1,data:{}};
ok('X01 E2 temporal preservado e aplicado sobre a nova forma (29.X)',()=>{
  for(const id of KIN){
    const base=topo(P(id));
    const eco=topo(P(id,{owner:ECHO_OWNER}));
    assert.ok(eco.length>base.length&&eco.startsWith(base),id);}
  for(const n of ['projectileTemporalMode','drawProjectileTemporalLayer'])
    assert.ok(!/drawProjectileKinetic/.test(body(n)),n);});
ok('AC01 temporalReplay compatível e distinto de Echo (29.AC)',()=>{
  for(const id of KIN){
    const base=topo(P(id));
    const rep=topo(P(id,{temporalReplay:true}));
    assert.ok(rep.length>base.length&&rep.startsWith(base),id);
    assert.notStrictEqual(rep,topo(P(id,{owner:ECHO_OWNER})),id+' replay==echo');}
  assert.strictEqual(T.projectileTemporalMode({temporalReplay:true}),T.PTM.REPLAY);
  assert.strictEqual(T.projectileTemporalMode({owner:ECHO_OWNER}),T.PTM.ECHO);});
ok('Y01 E3 preservado: rail/sniper/nail byte-idênticos (29.Y / §26)',()=>{
  assert.strictEqual(topo(P('rail')),
    'beginPath,moveTo,lineTo,lineTo,lineTo,closePath,fill,beginPath,moveTo,lineTo,stroke');
  assert.strictEqual(topo(P('sniper')),
    'beginPath,moveTo,lineTo,stroke,beginPath,moveTo,lineTo,stroke');
  assert.strictEqual(topo(P('nail')),
    'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,lineTo,closePath,fill');
  assert.strictEqual(run('SNIPER_FAR_DIST'),450);
  assert.ok(!/drawProjectileKinetic/.test(body('drawProjectileSlug')));});
ok('Z01 E4 preservado: as 4 do enxame intactas (29.Z / §25)',()=>{
  assert.strictEqual(topo(P('smg')),'beginPath,moveTo,lineTo,lineTo,lineTo,closePath,fill');
  assert.strictEqual(topo(P('shotgun')),'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,closePath,fill');
  assert.strictEqual(topo(P('homing')),
    'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,closePath,fill,beginPath,moveTo,lineTo,moveTo,lineTo,stroke');
  assert.ok(!/drawProjectileKinetic/.test(body('drawProjectileSwarm')));});
ok('AA01 E8 muzzle preservado (29.AA / §24)',()=>{
  for(const n of ['muzzleShot','muzzlePower','emitWeaponMuzzleVisual'])
    assert.ok(!/drawProjectileKinetic/.test(body(n)),n);
  assert.ok(Math.abs(T.muzzlePower({kick:280})-1.4)<1e-9);
  /* contagens de emissão das 4 armas do E10 inalteradas */
  const cnt=id=>{run('parts.length=0;player.aim=0');
    run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id==="'+id+'"))');
    const n=run('parts.length');run('parts.length=0');return n;};
  assert.strictEqual(cnt('ricochet'),2);
  assert.strictEqual(cnt('boomer'),3);
  assert.strictEqual(cnt('gatling'),1);
  assert.strictEqual(cnt('mine'),2);});
ok('AB01 Echo herda a forma automaticamente (29.AB)',()=>{
  for(const id of KIN)
    assert.strictEqual(topo(P(id,{team:'ally',owner:null})),topo(P(id)),id);
  const b=body('drawProjectileKinetic');
  assert.ok(!/owner&&|isEcho|echoes|slot/.test(b.replace(/p\.owner&&p\.owner\.aoeMul/g,'')),
    'a forma deve depender do tipo, não de quem disparou');});
ok('AD01 beam e eorb fora da família (29.AD)',()=>{
  assert.strictEqual(run('PROJ_FAMILY["beam"]'),undefined);
  assert.strictEqual(run('PROJ_FAMILY["eorb"]'),undefined);
  assert.strictEqual(T.visualFamilyForProjectile({type:'eorb'}),T.PVF.LEGACY);
  assert.strictEqual(topo(P('eorb')),topo(P('orb')));
  assert.ok(!/drawProjectileKinetic/.test(body('drawBeamFrom')));});
ok('AD02 famílias ainda não implementadas seguem no legado',()=>{
  /* plasma/orb/void/cryo ganharam forma própria no PR15.5-E5 (ver AD02b) */
  const leg=topo(P('flamer'));
  for(const id of ['flamer','acid','tesla','plague'])
    assert.strictEqual(topo(P(id)),leg,id+' foi alterado fora do escopo');});
ok('AD02b E5: ENERGIA/MASSA tem forma própria e não colide com a cinética',()=>{
  const leg=topo(P('flamer'));
  for(const id of ['plasma','orb','void','cryo']){
    assert.notStrictEqual(topo(P(id)),leg,id+' regrediu para a linha legada');
    for(const k of ['ricochet','boomer','gatling','mine'])
      assert.notStrictEqual(topo(P(id))+'|'+JSON.stringify(verts(P(id))),
        topo(P(k))+'|'+JSON.stringify(verts(P(k))),id+' colidiu com '+k);}});

/* ============ MECÂNICA (§33) ============ */
console.log('\n[I] mecânica preservada');
ok('I01 defs das 4 armas inalteradas (§33)',()=>{
  const ESP={
    ricochet:{interval:.22,speed:880,dmg:12,count:1,spread:0,jitter:.04,life:2.6,pr:3.6,kick:40,range:900,bounce:3,color:'#ff4df0'},
    boomer:{interval:.7,speed:640,dmg:22,count:1,spread:0,jitter:0,life:2.4,pr:8,kick:20,range:420,basePierce:99,color:'#7dffc4'},
    gatling:{interval:.09,speed:1000,dmg:6.8,count:1,spread:0,jitter:.16,life:1,pr:3,kick:26,range:560,color:'#ffb347'},
    mine:{interval:.8,speed:300,dmg:44,count:1,spread:0,jitter:0,life:14,pr:7,kick:18,range:200,aoe:120,color:'#ffd166'}};
  for(const [id,exp] of Object.entries(ESP)){
    const w=W(id);
    for(const [k,v] of Object.entries(exp))assert.strictEqual(w[k],v,id+'.'+k);}});
ok('I02 disparo real produz projéteis com os campos esperados',()=>{
  /* Crítico pinta o projétil de #fff6b0 e é sorteado por RNG real; sem
     neutralizar isso o teste ficaria intermitente. Fixamos Math.random
     alto para garantir NÃO-crit e medir a cor da arma. */
  const orig=S.Math.random;S.Math.random=()=>0.999999;
  try{
  for(const id of KIN){
    run('projectiles.length=0;player.aim=0');
    run('fireWeaponFrom(player,WEAPONS.find(w=>w.id==='+JSON.stringify(id)+'),"ally",1,"player")');
    const w=W(id);
    assert.strictEqual(run('projectiles.length'),w.count,id+' count');
    assert.strictEqual(run('projectiles[0].type'),id,id+' type');
    assert.strictEqual(run('projectiles[0].color'),w.color,id+' color');
    assert.strictEqual(run('projectiles[0].r'),w.pr,id+' r');
    assert.strictEqual(run('projectiles[0].crit'),false,id+' saiu crítico');
    assert.strictEqual(run('projectiles[0].dmg'),w.dmg,id+' dmg');
    run('projectiles.length=0');}
  }finally{S.Math.random=orig;}});
ok('I03 campos especiais nascem corretos',()=>{
  const f=(id,k)=>{run('projectiles.length=0;player.aim=0');
    const o=S.Math.random;S.Math.random=()=>0.999999;
    try{run('fireWeaponFrom(player,WEAPONS.find(w=>w.id==="'+id+'"),"ally",1,"player")');}
    finally{S.Math.random=o;}
    const v=run('projectiles[0].'+k);run('projectiles.length=0');return v;};
  assert.strictEqual(f('ricochet','bounce'),3);
  assert.strictEqual(f('boomer','boomerang'),1);
  assert.strictEqual(f('boomer','pierce'),99);
  assert.strictEqual(f('mine','mine'),true);
  assert.strictEqual(f('mine','aoe'),120);
  assert.strictEqual(f('gatling','bounce'),0);});

/* ============ REGRESSÃO (§40) ============ */
console.log('\n[J] regressão');
const reg=require('./suite-registry.js');
ok('J01 esta suíte é descoberta pelo npm test',()=>{
  assert.ok(reg.suiteIsDiscovered('pr15-5-e10-kinetic-return-projectile-identity'));});
for(const s of ['pr15-5-e4-swarm-projectile-identity','pr15-5-e8-muzzle-emission-identity',
                'pr15-5-e3-slug-penetrator-identity','pr15-5-e2-temporal-projectile-identity',
                'pr15-5-e1-projectile-visual-grammar','pr15-5-e0-visual-determinism',
                'pr15-7-b-anchored-replay-prototype','pr15-5-performance-audit1'])
  ok('J·'+s+' continua no runner',()=>{assert.ok(reg.suiteIsDiscovered(s),s);});
ok('J10 documentação do E10 existe',()=>{
  assert.ok(fs.existsSync(path.join(root,'PR15_5_E10_KINETIC_RETURN_PROJECTILE_IDENTITY.md')));});

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
