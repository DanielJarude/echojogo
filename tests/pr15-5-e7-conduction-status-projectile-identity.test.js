'use strict';
/* ECHO — PR15.5-E7 · CONDUÇÃO / STATUS — identidade do PROJÉTIL
   ---------------------------------------------------------------------
   Tesla e Plague — os dois últimos ocupantes do ramo legado. Antes do
   E7, ambos caíam em drawProjectileLegacyLine (um traço reto de
   comprimento 5) e eram intercambiáveis quando recoloridos.

   AUDITORIA QUE DEFINIU O DESENHO (ver PR15_5_E7_*.md para o detalhe;
   sonda empírica LCG seed 55511122 sobre o HEAD 80b1349):
   · TESLA — chain:2 é REAL (chainShock: salto para o alvo mais próximo
     em até 230px, dano ×.78 por salto — medido 14.00/10.92/8.5176 — com
     arco visual HISTÓRICO em arcs/drawArcs, preservado). fx shock 2s/1
     é marcador (afflicted + drawStatus), NÃO é DoT (medido: Δhp 0).
     shockP/shockSrc são gravados e nunca lidos (write-only).
   · PLAGUE — aoe:130 e contagion:true são CONFIG MORTA: p.aoe só é
     lido por explodeOrb (exclusivo do orb) e o contágio só roda em
     detonateSpecial (exclusivo da mine). Medido: 2º alvo a 80px Δhp 0;
     alvo morto NÃO infecta vizinhos. O que existe: corrode 5s/.10 no
     alvo único (amplificador ×1.10/stack, teto ×1.60, sem DoT).
   As formas comunicam SOMENTE o objeto em voo: descarga entre
   terminais (tesla) e cápsula contaminante (plague) — nenhuma promete
   nuvem, área ou propagação que a mecânica não executa.

   Toda prova compara TOPOLOGIA/GEOMETRIA, nunca cor, largura ou alpha. */
const assert=require('assert'),fs=require('fs'),path=require('path');
const {world,readSource}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}}
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5-E7 · CONDUÇÃO / STATUS');

const CS=['tesla','plague'];
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
for(const id of CS)
  ok('A·'+id+' classificado como CONDUÇÃO/STATUS',()=>{
    assert.strictEqual(run('PROJ_FAMILY['+JSON.stringify(id)+']'),T.PVF.CONDUCT);
    assert.strictEqual(T.visualFamilyForProjectile({type:id}),T.PVF.CONDUCT);});
ok('A01 helper dedicado existe e recebe as 2',()=>{
  assert.strictEqual(typeof T.drawProjectileConductionStatus,'function');
  const b=body('drawProjectile');
  assert.ok(/PVF_CONDUCT\)drawProjectileConductionStatus/.test(b),'dispatcher não encaminha');});
ok('A02 dispatcher continua simples e com 1 ponto de chamada',()=>{
  assert.strictEqual((SRC.match(/drawProjectileConductionStatus\(/g)||[]).length,2);
  const b=body('drawProjectile');
  const linhas=b.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('/*')&&
    !l.trim().startsWith('*')&&!l.trim().startsWith('//'));
  assert.ok(linhas.length<=26,'dispatch inchado: '+linhas.length);});
ok('A03 ordem das famílias anteriores preservada',()=>{
  const b=body('drawProjectile');
  const iE=b.indexOf('PVF_ENERGY'),iF=b.indexOf('PVF_FLUID'),
        iS=b.indexOf('PVF_SLUG'),iW=b.indexOf('PVF_SWARM'),
        iK=b.indexOf('PVF_KINETIC'),iC=b.indexOf('PVF_CONDUCT'),
        iL=b.indexOf('drawProjectileLegacyLine');
  assert.ok(iE<iF&&iF<iS&&iS<iW&&iW<iK,'a ordem ENERGY→FLUID→SLUG→SWARM→KINETIC mudou');
  assert.ok(iK<iC&&iC<iL,'CONDUCT deve entrar entre KINETIC e o fallback legado');});
ok('A04 eorb (inimigo) é resolvido ANTES da família e segue intocado',()=>{
  const b=body('drawProjectile');
  assert.ok(b.indexOf("p.type==='eorb'")<b.indexOf('PVF_CONDUCT'),
    'eorb tem de sair antes de qualquer família');
  assert.strictEqual(run('PROJ_FAMILY["eorb"]'),undefined);
  assert.strictEqual(T.visualFamilyForProjectile({type:'eorb'}),T.PVF.LEGACY);});
ok('A05 nenhuma arma indevida na família',()=>{
  const naFamilia=Object.keys(T.PROJ_FAMILY)
    .filter(k=>T.PROJ_FAMILY[k]===T.PVF.CONDUCT);
  assert.deepStrictEqual(naFamilia.sort(),['plague','tesla']);});
ok('A06 não duplica fade/glow/temporal/culling (§arquitetura)',()=>{
  const b=body('drawProjectileConductionStatus');
  assert.ok(!/projectileRangeFade|drawProjectileGlow|TemporalLayer|globalAlpha=/.test(b),
    'o helper não pode reimplementar o que o dispatcher já faz');});
ok('A07 tesla/plague NÃO desenham mais a reta legada (fim do legado conhecido)',()=>{
  const leg=topo(P('tipo_desconhecido_2027'));
  assert.strictEqual(leg,'beginPath,moveTo,lineTo,stroke');
  for(const id of CS){
    assert.notStrictEqual(topo(P(id)),leg,id+' ainda cai no fallback');
    assert.ok(body('drawProjectileConductionStatus').length>0);}});

/* ============ 2/3 · FORMAS EXCLUSIVAS E TOPOLOGIA ============ */
console.log('\n[B] formas exclusivas e topologia');
ok('B01 tesla != plague (forma, não cor)',()=>{
  assert.notStrictEqual(topo(P('tesla')),topo(P('plague')),'mesma topologia');
  assert.notStrictEqual(shape(P('tesla')),shape(P('plague')),'mesma geometria');});
ok('B02 as 2 assinaturas são únicas',()=>{
  assert.strictEqual(new Set(CS.map(id=>shape(P(id)))).size,2);});
ok('B03 Tesla: DESCARGA — 2 strokes (zigue-zague + terminais), ZERO fills',()=>{
  const t=topo(P('tesla'));
  assert.strictEqual((t.match(/stroke/g)||[]).length,2,'esperados 2 strokes: '+t);
  assert.ok(!t.includes('fill'),'tesla não pode ter massa preenchida');
  assert.ok(!t.includes('arc'),'arc é assinatura exclusiva do orb/eorb');
  /* corpo: 1 path com 3 segmentos consecutivos (zigue-zague). Nenhuma
     outra arma tem lineTo,lineTo,lineTo dentro de UM único stroke path. */
  const corpo=t.split('stroke')[0];
  assert.strictEqual((corpo.match(/lineTo/g)||[]).length,3,
    'o zigue-zague exige 3 segmentos: '+corpo);
  /* terminais: 2 pares moveTo+lineTo no segundo path (polaridade) */
  const termos=t.split('stroke')[1];
  assert.strictEqual((termos.match(/moveTo/g)||[]).length,2,
    'são 2 terminais: '+termos);
  assert.strictEqual((termos.match(/lineTo/g)||[]).length,2);});
ok('B04 Tesla: o zigue-zague quebra DOS lados do eixo (geometria angular)',()=>{
  /* voando em +x: os kinks ficam um acima e outro abaixo do eixo */
  const v=verts(P('tesla'));
  const ys=v.slice(0,4).map(q=>q[1]-100);
  assert.ok(Math.max(...ys)>0&&Math.min(...ys)<0,
    'kinks deveriam alternar lados: '+JSON.stringify(ys));});
ok('B05 Tesla: terminais ASSIMÉTRICOS (dianteiro maior que o traseiro)',()=>{
  const v=verts(P('tesla'));
  const tf=Math.abs(v[4][1]-v[5][1]), tb=Math.abs(v[6][1]-v[7][1]);
  assert.ok(tf>tb,'terminal dianteiro ('+tf+') deveria exceder o traseiro ('+tb+')');});
ok('B06 Plague: CÁPSULA — 1 corpo preenchido de 6 vértices lobulados',()=>{
  const t=topo(P('plague'));
  const corpo=t.split('fill')[0];
  assert.strictEqual((corpo.match(/lineTo/g)||[]).length,5,'cápsula de 6 vértices');
  assert.strictEqual((t.match(/closePath,fill/g)||[]).length,1,
    'UM único corpo — dois corpos disjuntos são a assinatura do acid (E6)');
  assert.ok(!t.includes('arc'),'plague não pode virar orb');});
ok('B07 Plague: 3 espinhos curtos PRESOS ao corpo (tríplice)',()=>{
  const t=topo(P('plague'));
  const espinhos=t.split('fill')[1];
  assert.strictEqual((espinhos.match(/moveTo/g)||[]).length,3,
    'são 3 apêndices: '+espinhos);
  assert.strictEqual((espinhos.match(/lineTo/g)||[]).length,3);
  /* o tríplice separa a topologia da costura dupla da mine (E10) e das
     2 aletas do homing (E4) — ambos com 2 pares moveTo+lineTo. */});
ok('B08 Plague: cápsula ASSIMÉTRICA (lóbulos desiguais, orgânica)',()=>{
  const v=verts(P('plague')).slice(0,6);
  const up=Math.max(...v.map(q=>q[1]))-100, dn=100-Math.min(...v.map(q=>q[1]));
  assert.ok(Math.abs(up-dn)>.5,'lóbulos simétricos = peça usinada: '+up+'/'+dn);
  assert.ok(up>dn,'o lóbulo superior deveria dominar (assimetria proposital)');});
ok('B09 Plague: os espinhos saem de 3 posições diferentes do corpo',()=>{
  const v=verts(P('plague'));
  const base=v.slice(6).filter((_,i)=>i%2===0);   // moveTo dos 3 espinhos
  const xs=new Set(base.map(q=>+(q[0]-100).toFixed(2)));
  assert.strictEqual(xs.size,3,'espinhos nascem do mesmo ponto: '+JSON.stringify(base));});
ok('B10 as 2 formas são compactas (não-alongadas: família E6 é a alongada)',()=>{
  /* projeção no eixo do voo: flamer acumula >3r atrás; tesla/plague
     são corpos curtos — a identidade de E7 não pode virar "cauda". */
  for(const id of CS){
    const v=verts(P(id));
    const fwd=Math.max(...v.map(q=>q[0]))-100, back=100-Math.min(...v.map(q=>q[0]));
    assert.ok(back<3.2*6,id+' acumulou cauda demais: '+back.toFixed(1));}});

/* ============ 6 · MESMA COR / MESMO RAIO ============ */
console.log('\n[C] mesma cor / mesmo raio');
ok('C01 mesma cor: as 2 continuam distinguíveis',()=>{
  const s=CS.map(id=>shape(P(id,{color:'#ffffff'})));
  assert.strictEqual(new Set(s).size,2,'colapsaram com a mesma cor');});
ok('C02 cores reais TROCADAS: tesla com cor de plague continua tesla',()=>{
  const cp=W('plague').color, ct=W('tesla').color;
  assert.notStrictEqual(shape(P('tesla',{color:cp})),shape(P('plague',{color:cp})),
    'recolorir resolveu — a forma precisa separar');
  assert.notStrictEqual(shape(P('plague',{color:ct})),shape(P('tesla',{color:ct})));});
ok('C03 mesmo raio artificial: ainda distinguíveis',()=>{
  for(const r of [3,4,5,6,8]){
    const s=CS.map(id=>shape(P(id,{color:'#ffffff',r:r})));
    assert.strictEqual(new Set(s).size,2,'colapsaram com r='+r);}});
ok('C04 ignorando glow: a diferença permanece',()=>{
  const s=CS.map(id=>topo(P(id,{color:'#ffffff'})));
  assert.strictEqual(new Set(s).size,2);});
ok('C05 estrutura OPPOSTA: tesla é 100% traço, plague tem massa',()=>{
  assert.ok(!topo(P('tesla')).includes('fill'),'tesla ganhou fill');
  assert.ok(topo(P('plague')).includes('fill'),'plague perdeu o corpo');});

/* ============ 7 · COLISÕES COM AS DEMAIS FAMÍLIAS ============ */
console.log('\n[D] separação das outras famílias');
const ST={ricochet:{bounce:3},boomer:{spin:0},mine:{armT:0}};
ok('D01 != linha legada (tipo desconhecido no fallback)',()=>{
  const leg=topo(P('tipo_desconhecido_2027'));
  for(const id of CS)assert.notStrictEqual(topo(P(id)),leg,id+' virou traço reto');
  assert.ok(leg.includes('stroke')&&!leg.includes('fill'),'premissa: o legado é traço');});
ok('D02 != ENERGIA/MASSA (E5: plasma/orb/void/cryo)',()=>{
  for(const id of CS)for(const o of ['plasma','orb','void','cryo'])
    assert.notStrictEqual(shape(P(id)),shape(P(o,ST[o])),id+' == '+o);});
ok('D03 != SLUG (E3: rail/sniper/nail)',()=>{
  for(const id of CS)for(const o of ['rail','sniper','nail'])
    assert.notStrictEqual(shape(P(id)),shape(P(o)),id+' == '+o);});
ok('D04 != ENXAME (E4: smg/shotgun/homing/prism)',()=>{
  for(const id of CS)for(const o of ['smg','shotgun','homing','prism'])
    assert.notStrictEqual(shape(P(id)),shape(P(o)),id+' == '+o);});
ok('D05 != CINÉTICO (E10: ricochet/boomer/gatling/mine)',()=>{
  for(const id of CS)for(const o of ['ricochet','boomer','gatling','mine'])
    assert.notStrictEqual(shape(P(id)),shape(P(o,ST[o])),id+' == '+o);});
ok('D06 != FLUIDO/SPRAY (E6: flamer/acid) — sem reciclagem de E6',()=>{
  for(const id of CS)for(const o of ['flamer','acid'])
    assert.notStrictEqual(shape(P(id)),shape(P(o)),id+' == '+o);
  /* plague NÃO é "outra gota com satélite": acid tem 2 fills disjuntos,
     plague tem 1 fill + stroke de espinhos. */
  assert.notStrictEqual(topo(P('plague')),topo(P('acid')));
  assert.strictEqual((topo(P('plague')).match(/fill/g)||[]).length,1);});
ok('D07 nenhuma das 2 colide com QUALQUER outra arma do jogo',()=>{
  const outras=['rail','sniper','nail','smg','shotgun','homing','prism',
                'ricochet','boomer','gatling','mine',
                'plasma','orb','void','cryo','flamer','acid'];
  for(const k of CS)for(const o of outras)
    assert.notStrictEqual(shape(P(k)),shape(P(o,ST[o])),k+' == '+o);});
ok('D08 distintas mesmo de eorb e de um tipo desconhecido',()=>{
  for(const q of [shape(P('eorb')),shape(P('tipo_desconhecido_2028'))])
    for(const id of CS)assert.notStrictEqual(shape(P(id)),q,id+' == fallback');});
ok('D09 varredura global: as colisões pré-existentes são as únicas',()=>{
  /* gatling==shotgun (E10) e eorb==orb (mesmo objeto) são históricas e
     documentadas; nenhuma envolve tesla/plague. */
  const todos=['rail','sniper','nail','smg','shotgun','homing','prism',
               'ricochet','boomer','gatling','mine','plasma','void','cryo',
               'flamer','acid','tesla','plague','orb','eorb'];
  const visto={};let colisoes=[];
  for(const t of todos){
    const k=topo(P(t,ST[t]));
    if(visto[k])colisoes.push(t+'=='+visto[k]);else visto[k]=t;}
  colisoes.sort();
  assert.deepStrictEqual(colisoes,['eorb==orb','gatling==shotgun']);});

/* ============ 4 · ORIENTAÇÃO / 5 · ESTADO ZERO ============ */
console.log('\n[E] orientação e robustez');
for(const id of CS)
  ok('E·'+id+' orienta em +x, -x, +y e diagonal',()=>{
    const a=verts(P(id,{vx:500,vy:0})), b=verts(P(id,{vx:0,vy:500}));
    const c=verts(P(id,{vx:-500,vy:0})), d=verts(P(id,{vx:400,vy:400}));
    const J=q=>JSON.stringify(q);
    assert.strictEqual(new Set([J(a),J(b),J(c),J(d)]).size,4,'ignorou a direção');
    const extX=q=>Math.max(...q.map(v=>v[0]))-Math.min(...q.map(v=>v[0]));
    const extY=q=>Math.max(...q.map(v=>v[1]))-Math.min(...q.map(v=>v[1]));
    assert.ok(extX(a)>extY(a),id+' em +x');
    assert.ok(extY(b)>extX(b),id+' em +y');});
ok('E03 o zigue-zague do tesla gira JUNTO com o eixo (kinks seguem o voo)',()=>{
  const a=verts(P('tesla',{vx:500,vy:0}));       // voando +x: kinks deslocam y
  const b=verts(P('tesla',{vx:0,vy:500}));       // voando +y: kinks deslocam x
  const ampA=Math.max(...a.slice(0,4).map(q=>Math.abs(q[1]-100)));
  const ampB=Math.max(...b.slice(0,4).map(q=>Math.abs(q[0]-100)));
  assert.ok(ampA>1&&ampB>1,'o zigue não acompanhou a rotação: '+ampA+'/'+ampB);});
ok('E04 os espinhos da plague giram JUNTO (apêndices seguem o voo)',()=>{
  /* prova por equivalência de rotação: os vértices voando em +y devem
     ser a rotação +90° (CCW) dos vértices voando em +x, em torno do
     centro — a cápsula e os espinhos acompanham o eixo como um corpo
     rígido, sem exceção. */
  const a=verts(P('plague',{vx:500,vy:0})), b=verts(P('plague',{vx:0,vy:500}));
  const rot=q=>q.map(v=>[+(200-v[1]).toFixed(4),+(v[0]-100+100).toFixed(4)]);
  const norm=q=>JSON.stringify(q.map(v=>[+(v[0]-100).toFixed(3),+(v[1]-100).toFixed(3)]));
  assert.strictEqual(norm(rot(a)),norm(b),'a cápsula não girou junto com o eixo');});
ok('E05 velocidade zero não produz NaN em nenhuma das 2',()=>{
  for(const id of CS){
    const v=verts(P(id,{vx:0,vy:0}));
    assert.ok(v.every(q=>Number.isFinite(q[0])&&Number.isFinite(q[1])),id+' NaN');
    const l=draw(P(id,{vx:0,vy:0}));
    l.forEach(e=>(e[1]||[]).forEach(a=>
      assert.ok(typeof a!=='number'||Number.isFinite(a),id+' arg NaN')));}});
ok('E06 estado zero (r=0, dist=0) não quebra',()=>{
  for(const id of CS){
    const l=draw(P(id,{r:0,vx:0,vy:0,dist:0,maxDist:0}));
    assert.ok(l.length>0,id+' não desenhou nada');
    l.forEach(e=>(e[1]||[]).forEach(a=>
      assert.ok(typeof a!=='number'||Number.isFinite(a),id+' NaN com r=0')));}});

/* ============ 8/9 · DETERMINISMO E PUREZA ============ */
console.log('\n[F] determinismo e pureza');
ok('F01 zero RNG no draw das 2',()=>{
  const o=S.Math.random;let c=0;S.Math.random=function(){c++;return .5;};
  try{for(const id of CS)draw(P(id));}finally{S.Math.random=o;}
  assert.strictEqual(c,0,'draw consumiu '+c+' RNG');});
ok('F02 nenhum Math.random/rand/randi no helper',()=>{
  const b=body('drawProjectileConductionStatus');
  assert.ok(!/Math\.random/.test(b));
  assert.ok(!/(?<![\w$.])rand\(/.test(b));
  assert.ok(!/(?<![\w$.])randi\(/.test(b));});
ok('F03 sem runTime nas formas (não piscam, não oscilam)',()=>{
  const b=body('drawProjectileConductionStatus');
  assert.ok(!/runTime/.test(b),'a forma não pode depender do tempo');});
ok('F04 draws repetidos do MESMO estado são idênticos (30×)',()=>{
  for(const id of CS){
    const a=JSON.stringify(draw(P(id)));
    for(let i=0;i<30;i++)
      assert.strictEqual(JSON.stringify(draw(P(id))),a,id);}});
ok('F05 zero mutação do projétil no draw',()=>{
  for(const id of CS){
    const p=Object.assign({type:id,x:100,y:100,vx:1000,vy:0,r:6,color:'#fff',
      dist:10,maxDist:1100,aoe:0,life:2});
    const before=JSON.stringify(p);
    S.__pp=p;S.__ctxLog=[];run('drawProjectile(__pp)');S.__ctxLog=null;
    assert.strictEqual(JSON.stringify(S.__pp),before,id+' mutou o projétil');}});
ok('F06 helper não toca player/enemy/parts/projectiles/arcs',()=>{
  const b=body('drawProjectileConductionStatus');
  assert.ok(!/spawnParticles|spawnRing|spawnShards|projectiles\.|enemies|player\.|damageEnemy|explodeOrb\(|detonateSpecial\(|arcs\./.test(b));});
ok('F07 nenhuma coleção cresce no draw',()=>{
  const snap=()=>Array.from(run('[parts.length,projectiles.length,enemies.length,arcs.length]'));
  const a=snap();
  for(const id of CS)for(let i=0;i<10;i++)draw(P(id));
  assert.deepStrictEqual(snap(),a);});
ok('F08 nenhum estado global novo por projétil',()=>{
  const b=body('drawProjectileConductionStatus');
  assert.ok(!/=\s*\[|\.push\(|new Map|new Set|new [A-Z]/.test(
    b.replace(/\/\*[\s\S]*?\*\//g,'')));});

/* ============ 11 · CANVAS BUDGET ============ */
console.log('\n[G] canvas budget');
ok('G01 custo bounded nas 2 (≤ 26, teto do E10/E6)',()=>{
  for(const id of CS)assert.ok(ops(P(id))<=26,id+': '+ops(P(id)));});
ok('G02 Tesla (cadência .52, ~2× a da plague) é o mais barato da família',()=>{
  const t=ops(P('tesla')), q=ops(P('plague'));
  assert.ok(t<=q,'tesla '+t+' deveria custar <= plague '+q);});
ok('G03 comparável a E3/E4/E5/E6/E10 — sem outlier',()=>{
  const ref=Math.max(ops(P('rail')),ops(P('prism')),ops(P('mine',ST.mine)),
                     ops(P('plasma')),ops(P('acid')));
  for(const id of CS)
    assert.ok(ops(P(id))<=ref,id+' ('+ops(P(id))+') destoa ('+ref+')');});
ok('G04 custo não cresce com vida/distância/repetição',()=>{
  for(const id of CS){
    const base=ops(P(id));
    assert.strictEqual(ops(P(id,{dist:900,life:.1})),base,id+' cresce');
    for(let i=0;i<30;i++)draw(P(id));
    assert.strictEqual(ops(P(id)),base,id+' acumulou');}});
ok('G05 sem gradiente, shadowBlur, Path2D, save/restore, rotate',()=>{
  const b=body('drawProjectileConductionStatus');
  assert.ok(!/createLinearGradient|createRadialGradient|shadowBlur|new Path2D/.test(b));
  assert.ok(!/ctx\.save|ctx\.restore|ctx\.rotate|ctx\.translate|setTransform/.test(b));
  for(const id of CS){
    const l=draw(P(id)).map(e=>e[0]);
    ['rotate','save','restore','translate'].forEach(o=>
      assert.ok(!l.includes(o),id+' emitiu ctx.'+o));}});

/* ============ 12/13 · ECHO E REPETIÇÃO ANCORADA ============ */
console.log('\n[H] Echo e Repetição Ancorada');
const ECHO_OWNER={slot:1,data:{}};
ok('H01 Echo herda a forma das 2 pelo pipeline comum',()=>{
  for(const id of CS){
    const base=topo(P(id));
    const eco=topo(P(id,{owner:ECHO_OWNER}));
    assert.ok(eco.startsWith(base),id+' a forma base deixou de vir primeiro');
    assert.ok(eco.length>base.length,id+' perdeu a camada temporal');}
  const b=body('drawProjectileConductionStatus');
  assert.ok(!/owner|team|isEcho|echoes|slot/.test(b),
    'a forma deve depender do tipo, não de quem disparou');});
ok('H02 Replay herda forma + layer e é distinto de Echo',()=>{
  for(const id of CS){
    const base=topo(P(id));
    const rep=topo(P(id,{temporalReplay:true}));
    assert.ok(rep.startsWith(base)&&rep.length>base.length,id);
    assert.notStrictEqual(rep,topo(P(id,{owner:ECHO_OWNER})),id+' replay==echo');}});
ok('H03 E2 intocado',()=>{
  for(const n of ['projectileTemporalMode','drawProjectileTemporalLayer'])
    assert.ok(!/drawProjectileConductionStatus/.test(body(n)),n);
  assert.strictEqual(T.projectileTemporalMode({temporalReplay:true}),T.PTM.REPLAY);
  assert.strictEqual(T.projectileTemporalMode({owner:ECHO_OWNER}),T.PTM.ECHO);
  assert.strictEqual(T.projectileTemporalMode({owner:null}),T.PTM.NONE);});
ok('H04 Repetição Ancorada segue mecanicamente independente',()=>{
  assert.strictEqual(run('TEMPORAL_ACTION_WINDOW'),5);
  assert.strictEqual(run('TEMPORAL_REPLAY_COOLDOWN'),6);
  assert.strictEqual(run('TEMPORAL_REPLAY_DAMAGE'),.50);
  assert.ok(!/drawProjectileConductionStatus/.test(body('replayTemporalAction')));});

/* ============ 14/15/16 · MUZZLE, E9, EORB/BEAM ============ */
console.log('\n[I] muzzle (E8), impactos (E9), eorb/beam');
ok('I01 muzzle do E8 intocado (tesla: centelha 2; plague: orgânico 3)',()=>{
  for(const n of ['muzzleShot','muzzlePower','emitWeaponMuzzleVisual'])
    assert.ok(!/drawProjectileConductionStatus/.test(body(n)),n);
  const cnt=id=>{run('parts.length=0;player.aim=0');
    run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id===\"'+id+'\"))');
    const n=run('parts.length');run('parts.length=0');return n;};
  assert.strictEqual(cnt('tesla'),2);
  assert.strictEqual(cnt('plague'),3);});
ok('I02 nenhum impacto novo foi adicionado (E9 fora do escopo)',()=>{
  const b=body('drawProjectileConductionStatus').replace(/\/\*[\s\S]*?\*\//g,'')
    .replace(/\/\/[^\n]*/g,'');
  assert.ok(!/shake|rumble|floatText|sBoom|flash|spawnParticles|spawnRing|arcs/.test(b));
  /* o arco HISTÓRICO do chain segue vivo e fora do helper */
  assert.ok(!/drawProjectileConductionStatus/.test(body('chainShock')));
  assert.ok(!/drawProjectileConductionStatus/.test(body('drawArcs')));});
ok('I03 eorb inimigo permanece intacto',()=>{
  assert.strictEqual(topo(P('eorb')),'beginPath,arc,fill,beginPath,arc,stroke');
  assert.strictEqual(shape(P('eorb')),shape(P('orb',{r:6})),
    'eorb deve seguir o mesmo desenho histórico do orb');});
ok('I04 beam intacto',()=>{
  assert.strictEqual(run('PROJ_FAMILY["beam"]'),undefined);
  const b=body('drawBeamFrom');
  assert.ok(!/drawProjectileConductionStatus/.test(b));
  assert.ok(b.includes('createLinearGradient')&&b.includes('rampMax'));});
ok('I05 projéteis inimigos não caem em CONDUÇÃO/STATUS',()=>{
  /* todo projétil inimigo nasce 'eorb' — o ramo próprio vem antes da
     família, e eorb não está na tabela. Um shooter real dispara e a
     varredura confere o tipo de TODO projétil em voo. */
  assert.ok(body('drawProjectile').includes("p.type==='eorb'"));
  run('enemies.length=0;projectiles.length=0');
  run('spawnEnemy("shooter",900,600,3);enemies[0].spawnT=0;enemies[0].fireT=0;enemies[0].phase0=1;');
  for(let i=0;i<240;i++)run('updateEnemy(enemies[0],1/60);enemies[0].vx=0;enemies[0].vy=0;');
  assert.ok(run('projectiles.length')>0,'o shooter deveria ter disparado');
  const tipos=JSON.parse(run('JSON.stringify([...new Set(projectiles.map(p=>p.type))])'));
  for(const t of tipos)assert.notStrictEqual(T.visualFamilyForProjectile({type:t}),T.PVF.CONDUCT,
    'projétil inimigo '+t+' caiu em CONDUCT');
  run('projectiles.length=0');run('enemies.length=0');});

/* ============ 17 · BLOCOS ANTERIORES PRESERVADOS ============ */
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
  const leg=topo(P('tipo_desconhecido_2027'));
  for(const id of ['plasma','void','cryo'])
    assert.notStrictEqual(topo(P(id)),leg,id+' regrediu para o legado');
  assert.strictEqual(new Set(['plasma','void','cryo'].map(id=>shape(P(id)))).size,3,
    'as 3 do E5 devem continuar distintas entre si');});
ok('J05 E6: flamer/acid mantêm forma própria',()=>{
  assert.strictEqual((topo(P('flamer')).match(/lineTo/g)||[]).length,7);
  assert.strictEqual((topo(P('acid')).match(/closePath,fill/g)||[]).length,2);
  for(const id of ['flamer','acid'])
    assert.notStrictEqual(shape(P(id)),shape(P('tesla')),id+' colidiu com tesla');
  assert.notStrictEqual(shape(P('acid')),shape(P('plague')),'acid == plague');});
ok('J06 helpers anteriores não foram tocados pelo E7',()=>{
  for(const n of ['drawProjectileSlug','drawProjectileSwarm','drawProjectileKinetic',
                  'drawProjectileEnergyMass','drawProjectileFluidSpray'])
    assert.ok(!/drawProjectileConductionStatus/.test(body(n)),n);});
ok('J07 E1: gramática intacta',()=>{
  ['PROJ_FAMILY','visualFamilyForProjectile','projectileUsesOrbShape',
   'projectileRangeFade','drawProjectileGlow','drawProjectileLegacyLine']
   .forEach(n=>assert.ok(SRC.includes(n),n));
  assert.strictEqual(T.projectileRangeFade({maxDist:0}),1);});

/* ============ 18 · LEGACY APÓS O E7 ============ */
console.log('\n[K] situação do legacy após o E7');
ok('K01 NENHUMA arma de projétil do jogador depende mais do legacy',()=>{
  const ranged=Array.from(run('WEAPONS.filter(w=>!w.melee&&!w.beam).map(w=>w.id)'));
  const leg=topo(P('tipo_desconhecido_2027'));
  for(const id of ranged){
    assert.notStrictEqual(T.visualFamilyForProjectile({type:id}),T.PVF.LEGACY,
      id+' sem família');
    assert.notStrictEqual(topo(P(id,ST[id])),leg,id+' ainda desenha a reta legada');}
  assert.strictEqual(ranged.length,19);});
ok('K02 drawProjectileLegacyLine é MANTIDO como fallback seguro',()=>{
  assert.strictEqual(typeof T.drawProjectileLegacyLine,'function');
  assert.ok(body('drawProjectile').includes('drawProjectileLegacyLine'),
    'o else final do dispatcher deve continuar chamando o fallback');
  const g=draw(P('arma_do_futuro_2030'));
  assert.ok(g.length>0,'fallback não desenha');
  assert.strictEqual(topo(P('arma_do_futuro_2030')),'beginPath,moveTo,lineTo,stroke');});
ok('K03 conteúdo futuro/paramétrico não é afetado',()=>{
  for(const t of [undefined,null,'',123])
    assert.strictEqual(T.visualFamilyForProjectile({type:t}),T.PVF.LEGACY);
  assert.strictEqual(T.visualFamilyForProjectile(null),T.PVF.LEGACY);});

/* ============ 10/19 · MECÂNICA + CONFIG MORTA ============ */
console.log('\n[L] mecânica inalterada e config morta documentada');
ok('L01 defs das 2 armas idênticas à base 80b1349',()=>{
  const ESP={
    tesla:{interval:.52,speed:820,dmg:14,count:1,spread:0,jitter:.03,life:1.1,pr:4.5,
      kick:38,range:470,color:'#ffe74d',chain:2},
    plague:{interval:.95,speed:480,dmg:16,count:1,spread:0,jitter:0,life:2.0,pr:7,
      kick:30,range:450,color:'#39d98a',aoe:130,contagion:true}};
  for(const [id,exp] of Object.entries(ESP)){
    const w=W(id);
    for(const [k,v] of Object.entries(exp))assert.strictEqual(w[k],v,id+'.'+k);}
  const fxt=W('tesla').fx, fxp=W('plague').fx;
  assert.strictEqual(fxt.k,'shock');assert.strictEqual(fxt.dur,2);
  assert.strictEqual(fxt.pow,1);
  assert.strictEqual(fxp.k,'corrode');assert.strictEqual(fxp.pow,.10);
  assert.strictEqual(fxp.dur,5);});
ok('L02 disparo real: campos do projétil inalterados',()=>{
  const o=S.Math.random;S.Math.random=()=>0.999999;
  try{
    for(const id of CS){
      run('projectiles.length=0;player.aim=0');
      run('fireWeaponFrom(player,WEAPONS.find(w=>w.id==='+JSON.stringify(id)+'),"ally",1,"player")');
      const w=W(id);
      assert.strictEqual(run('projectiles.length'),w.count,id+' count');
      assert.strictEqual(run('projectiles[0].type'),id,id+' type');
      assert.strictEqual(run('projectiles[0].color'),w.color,id+' color');
      assert.strictEqual(run('projectiles[0].r'),w.pr,id+' r');
      assert.strictEqual(run('projectiles[0].dmg'),w.dmg,id+' dmg');
      assert.strictEqual(run('projectiles[0].pierce'),0,id+' pierce mudou');
      assert.strictEqual(run('projectiles[0].maxDist'),w.range,id+' range');
      assert.strictEqual(run('projectiles[0].life'),w.life,id+' life');
      /* plague CARREGA aoe:130 no projétil (morto no consumo, ver L08) */
      assert.strictEqual(run('projectiles[0].aoe'),id==='plague'?130:0,id+' aoe');
      run('projectiles.length=0');}
  }finally{S.Math.random=o;}});
ok('L03 Tesla: impacto direto = 14, shockT=2 no alvo, projétil morre',()=>{
  run('enemies.length=0;arcs.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);enemies[0].spawnT=0;enemies[0].vx=0;enemies[0].vy=0;');
  const hp0=run('enemies[0].hp');
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:820,vy:0,r:4.5,dmg:14,life:1.1,type:"tesla",team:"ally",color:"#ffe74d",aoe:0,pierce:0,dist:0,maxDist:470,hits:null,born:0,owner:player,def:WEAPONS.find(w=>w.id==="tesla")})');
  run('updateProjectiles(1/60)');
  const hp1=run('enemies[0].hp');
  assert.ok(Math.abs(hp0-hp1-14)<1e-9,'dano direto: '+(hp0-hp1));
  assert.strictEqual(run('enemies[0].st.shockT'),2,'shockT');
  assert.strictEqual(run('enemies[0].st.shockP'),1,'shockP');
  assert.strictEqual(run('arcs.length'),0,'sem 2º alvo, não há chain');
  assert.strictEqual(run('projectiles.length'),0,'deveria morrer no impacto');
  run('projectiles.length=0');run('enemies.length=0');});
ok('L04 Tesla: chain REAL — 2 saltos ×0.78, raio 230, arcos históricos',()=>{
  /* três alvos enfileirados a 100px: 14 → 10.92 → 8.5176 */
  run('enemies.length=0;arcs.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",800,360,1);spawnEnemy("'+ETYPE+'",900,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  const hp0=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:820,vy:0,r:4.5,dmg:14,life:1.1,type:"tesla",team:"ally",color:"#ffe74d",aoe:0,pierce:0,dist:0,maxDist:470,hits:null,born:0,owner:player,def:WEAPONS.find(w=>w.id==="tesla")})');
  run('updateProjectiles(1/60)');
  const hp1=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  const d=[0,1,2].map(i=>hp0[i]-hp1[i]);
  assert.ok(Math.abs(d[0]-14)<1e-9,'salto 0: '+d[0]);
  assert.ok(Math.abs(d[1]-14*.78)<1e-9,'salto 1 (×.78): '+d[1]);
  assert.ok(Math.abs(d[2]-14*.78*.78)<1e-9,'salto 2 (×.78²): '+d[2]);
  assert.strictEqual(run('arcs.length'),2,'2 arcos históricos (um por salto)');
  /* limite do raio de busca: 220px salta, 231px não */
  run('enemies.length=0;arcs.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",920,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:820,vy:0,r:4.5,dmg:14,life:1.1,type:"tesla",team:"ally",color:"#ffe74d",aoe:0,pierce:0,dist:0,maxDist:470,hits:null,born:0,owner:player,def:WEAPONS.find(w=>w.id==="tesla")})');
  run('updateProjectiles(1/60)');
  const salto=run('enemies[1].hp')<run('enemies[1].maxHp');
  assert.ok(salto,'220px deveria encadear');
  run('enemies.length=0;arcs.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",931,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:820,vy:0,r:4.5,dmg:14,life:1.1,type:"tesla",team:"ally",color:"#ffe74d",aoe:0,pierce:0,dist:0,maxDist:470,hits:null,born:0,owner:player,def:WEAPONS.find(w=>w.id==="tesla")})');
  run('updateProjectiles(1/60)');
  assert.strictEqual(run('enemies[1].hp'),run('enemies[1].maxHp'),'231px NÃO encadeia (raio 230)');
  run('projectiles.length=0');run('arcs.length=0');run('enemies.length=0');});
ok('L05 Tesla: shock NÃO é DoT — expira em 2s sem causar dano',()=>{
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);enemies[0].spawnT=0;');
  run('applyStatus(enemies[0],"shock",2,1,player)');
  const h0=run('enemies[0].hp');
  for(let i=0;i<60*3;i++){run('tickStatus(enemies[0],1/60)');run('enemies[0].vx=0;enemies[0].vy=0;');}
  assert.strictEqual(run('enemies[0].hp'),h0,'shock não pode causar dano por tick');
  assert.ok(!(run('enemies[0].st.shockT')>0),'shock deveria ter expirado');
  /* shockP/shockSrc são write-only (documentado, não corrigido no E7):
     contados sobre o CÓDIGO (comentários removidos), só existem na
     gravação do applyStatus. */
  const code=SRC.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const nP=(code.match(/shockP/g)||[]).length, nS=(code.match(/shockSrc/g)||[]).length;
  assert.strictEqual(nP,1,'shockP passou a ser lido — documentar');
  assert.strictEqual(nS,1,'shockSrc passou a ser lido — documentar');
  run('enemies.length=0');});
ok('L06 Plague: impacto direto = 16 + corrode 5s/.10 no ALVO ÚNICO',()=>{
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",780,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  const hp0=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:480,vy:0,r:7,dmg:16,life:2,type:"plague",team:"ally",color:"#39d98a",aoe:130,pierce:0,dist:0,maxDist:450,hits:null,born:0,owner:player,def:WEAPONS.find(w=>w.id==="plague")})');
  run('updateProjectiles(1/60)');
  const hp1=JSON.parse(run('JSON.stringify(enemies.map(e=>e.hp))'));
  assert.ok(Math.abs(hp0[0]-hp1[0]-16)<1e-9,'dano direto: '+(hp0[0]-hp1[0]));
  assert.strictEqual(hp1[1],hp0[1],'AoE 130 configurado NÃO executa (2º alvo a 80px)');
  const st=JSON.parse(run('JSON.stringify(enemies[0].st||{})'));
  assert.ok(Math.abs(st.corrT-5)<1e-9,'corrT: '+st.corrT);
  assert.ok(Math.abs(st.corrP-.10)<1e-9,'corrP: '+st.corrP);
  const st2=JSON.parse(run('JSON.stringify(enemies[1].st||{})'));
  assert.ok(!st2.corrT,'corrode não pode vazar para o 2º alvo');
  assert.strictEqual(run('projectiles.length'),0,'deveria morrer no impacto');
  run('projectiles.length=0');run('enemies.length=0');});
ok('L07 Plague: contagion:true é CONFIG MORTA — alvo morto NÃO infecta',()=>{
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",790,360,1);spawnEnemy("'+ETYPE+'",880,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  run('enemies[0].hp=1');
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:480,vy:0,r:7,dmg:16,life:2,type:"plague",team:"ally",color:"#39d98a",aoe:130,pierce:0,dist:0,maxDist:450,hits:null,born:0,owner:player,def:WEAPONS.find(w=>w.id==="plague")})');
  run('updateProjectiles(1/60)');
  assert.ok(run('enemies[0].dead'),'o alvo morreu');
  for(const i of [1,2]){
    const st=JSON.parse(run('JSON.stringify(enemies['+i+'].st||{})'));
    assert.ok(!st.corrT,'vizinho '+(i+1)+' infectado — contágio não deveria executar');}
  run('projectiles.length=0');run('enemies.length=0');});
ok('L08 prova estática da morte: aoe/contagion só têm consumidor inalcançável',()=>{
  /* detonateSpecial só é chamado no ramo p.mine; explodeOrb só no ramo
     do orb. contagion só aparece dentro de detonateSpecial. Todo uso de
     p.aoe no CÓDIGO (sem comentários) está dentro de explodeOrb. */
  const chamadas=(SRC.match(/(?<!function )detonateSpecial\(p\)/g)||[]).length;
  assert.strictEqual(chamadas,1,'detonateSpecial deve ser chamado só pela mine');
  const dS=body('detonateSpecial');
  assert.ok(dS.includes('d.contagion'),'contagion saiu do detonateSpecial');
  assert.ok(!/contagion/.test(body('onProjectileHit')),'contagion vazou para o hit comum');
  assert.ok(!/contagion/.test(body('updateProjectiles')),'contagion vazou para o update');
  /* p.aoe: toda ocorrência em código vive dentro de explodeOrb */
  const eO=body('explodeOrb');
  assert.ok(eO.includes('p.aoe'),'explodeOrb deixou de ler aoe');
  const code=SRC.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const mEO=code.match(/function explodeOrb\([^\n]*\)\{[\s\S]*?\n\}/);
  assert.ok(mEO,'explodeOrb não encontrada no código limpo');
  const ini=code.indexOf(mEO[0]), fim=ini+mEO[0].length;
  const usos=(code.match(/(?<![\w.])p\.aoe(?![\w])/g)||[]).length;
  let foraDoOrb=0, idx=0;
  while((idx=code.indexOf('p.aoe',idx))>=0){
    if((idx<ini||idx>=fim)&&!/[\w.]/.test(code[idx+5]||''))foraDoOrb++;
    idx+=5;}
  assert.ok(usos>0,'p.aoe deveria existir em código');
  assert.strictEqual(foraDoOrb,0,'p.aoe lido fora do explodeOrb: '+foraDoOrb);});
ok('L09 Plague: corrode acumula (×1.10, ×1.20), teto ×1.60, SEM DoT, expira',()=>{
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);enemies[0].spawnT=0;');
  run('applyStatus(enemies[0],"corrode",5,.10,player)');
  assert.ok(Math.abs(run('statusDmgMul(enemies[0])')-1.10)<1e-9,'×1 stack');
  run('applyStatus(enemies[0],"corrode",5,.10,player)');
  assert.ok(Math.abs(run('statusDmgMul(enemies[0])')-1.20)<1e-9,'×2 stacks');
  for(let i=0;i<7;i++)run('applyStatus(enemies[0],"corrode",5,.10,player)');
  assert.ok(Math.abs(run('statusDmgMul(enemies[0])')-1.60)<1e-9,'teto .60');
  const h0=run('enemies[0].hp');
  for(let i=0;i<60*2;i++){run('tickStatus(enemies[0],1/60)');run('enemies[0].vx=0;enemies[0].vy=0;');}
  assert.strictEqual(run('enemies[0].hp'),h0,'corrode não pode causar dano por tick');
  /* amplificação real sobre dano recebido */
  run('var __pe0=enemies[0].hp;damageEnemy(enemies[0],10,600,300,false,false);');
  assert.ok(Math.abs(run('__pe0')-run('enemies[0].hp')-16)<1e-9,
    'dano 10 amplificado ×1.60 = 16');
  for(let i=0;i<60*5;i++){run('tickStatus(enemies[0],1/60)');run('enemies[0].vx=0;enemies[0].vy=0;');}
  assert.ok(Math.abs(run('statusDmgMul(enemies[0])')-1)<1e-9,'corrT deveria expirar');
  run('enemies.length=0');});
ok('L10 pierce 0: ambas morrem no 1º alvo mesmo sobrepostos',()=>{
  /* tesla: o projétil MORRE no impacto (pierce 0), mas o chain REAL
     salta para o vizinho colado — 2 feridos é mecânica comprovada, não
     perfuração. plague: sem chain, sem AoE — apenas 1 ferido. */
  run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",702,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:500,vy:0,r:5,dmg:7,life:2,type:"tesla",team:"ally",color:"#fff",aoe:0,pierce:0,dist:0,maxDist:400,hits:null,born:0,owner:player,def:WEAPONS.find(w=>w.id=="tesla")})');
  run('updateProjectiles(1/60)');
  assert.strictEqual(run('projectiles.length'),0,'tesla deveria morrer no impacto');
  assert.strictEqual(run('enemies.filter(e=>e.hp<e.maxHp).length'),2,
    'tesla: o chain real fere o vizinho sobreposto');
  run('projectiles.length=0');run('enemies.length=0');
  run('spawnEnemy("'+ETYPE+'",700,360,1);spawnEnemy("'+ETYPE+'",700,360,1)');
  run('enemies.forEach(e=>{e.spawnT=0;e.vx=0;e.vy=0;})');
  run('projectiles.length=0');
  run('projectiles.push({x:694,y:360,vx:500,vy:0,r:5,dmg:7,life:2,type:"plague",team:"ally",color:"#fff",aoe:0,pierce:0,dist:0,maxDist:400,hits:null,born:0,owner:player,def:WEAPONS.find(w=>w.id=="plague")})');
  run('updateProjectiles(1/60)');
  assert.strictEqual(run('projectiles.length'),0,'plague deveria morrer no impacto');
  assert.strictEqual(run('enemies.filter(e=>e.hp<e.maxHp).length'),1,
    'plague: sem chain e sem AoE, apenas o alvo direto');
  run('projectiles.length=0');run('enemies.length=0');});
ok('L11 expiração: alcance = 3 faíscas; vida = silêncio (E9 preservado)',()=>{
  for(const id of CS){
    run('parts.length=0;projectiles.length=0');
    run('projectiles.push({x:100,y:100,vx:0,vy:0,r:5,dmg:1,life:9,type:"'+id+'",team:"ally",color:"#fff",aoe:0,pierce:0,dist:9999,maxDist:400,hits:null,born:0,owner:player,def:WEAPONS.find(w=>w.id===\"'+id+'\")})');
    run('updateProjectiles(1/60)');
    assert.strictEqual(run('parts.length'),3,id+' alcance');
    assert.strictEqual(run('projectiles.length'),0,id+' alcance não removeu');
    run('parts.length=0;projectiles.length=0');
    run('projectiles.push({x:100,y:100,vx:0,vy:0,r:5,dmg:1,life:.0001,type:"'+id+'",team:"ally",color:"#fff",aoe:0,pierce:0,dist:0,maxDist:400,hits:null,born:0,owner:player,def:WEAPONS.find(w=>w.id===\"'+id+'\")})');
    run('updateProjectiles(1/60)');
    assert.strictEqual(run('parts.length'),0,id+' vida (sem impacto: E9 não é deste PR)');
    run('parts.length=0');}});
ok('L12 onProjectileHit/applyStatus/tickStatus/chainShock intactos',()=>{
  const b=body('onProjectileHit');
  assert.ok(b.includes('d.chain'),'chain saiu do onProjectileHit');
  assert.ok(b.includes('applyStatus'),'fx saiu do onProjectileHit');
  const ap=body('applyStatus');
  assert.ok(ap.includes('s.shockT'),'shock saiu do applyStatus');
  assert.ok(ap.includes('s.corrT'),'corrode saiu do applyStatus');
  for(const n of ['onProjectileHit','applyStatus','tickStatus','chainShock',
                  'detonateSpecial','explodeOrb','updateProjectiles'])
    assert.ok(!/drawProjectileConductionStatus/.test(body(n)),n+' menciona o helper');});

/* ============ REGRESSÃO ============ */
console.log('\n[M] regressão');
const reg=require('./suite-registry.js');
ok('M01 esta suíte é descoberta pelo npm test',()=>{
  assert.ok(reg.suiteIsDiscovered('pr15-5-e7-conduction-status-projectile-identity'));});
for(const s of ['pr15-5-e6-fluid-spray-projectile-identity',
                'pr15-5-e5-energy-mass-projectile-identity',
                'pr15-5-e10-kinetic-return-projectile-identity',
                'pr15-5-e4-swarm-projectile-identity',
                'pr15-5-e8-muzzle-emission-identity',
                'pr15-5-e3-slug-penetrator-identity',
                'pr15-5-e2-temporal-projectile-identity',
                'pr15-5-e1-projectile-visual-grammar',
                'pr15-5-e0-visual-determinism',
                'pr15-7-b-anchored-replay-prototype','pr15-5-performance-audit1'])
  ok('M·'+s+' continua no runner',()=>{assert.ok(reg.suiteIsDiscovered(s),s);});
ok('M12 documentação do E7 existe',()=>{
  assert.ok(fs.existsSync(path.join(root,'PR15_5_E7_CONDUCTION_STATUS_PROJECTILE_IDENTITY.md')));});

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
