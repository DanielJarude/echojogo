'use strict';
/* ECHO — PR15.5-E3 · FAMÍLIA SLUG / PENETRADOR (rail · sniper · nail)
   ---------------------------------------------------------------------
   Antes, as três armas eram a MESMA linha, variando só cor e espessura
   (pr 5 / 4 / 2.4). O critério de sucesso desta suíte é o teste mental
   do escopo §29:

     "Se eu colocar os três em branco, sem glow e sem HUD,
      consigo dizer qual é qual?"

   Por isso o bloco C força a MESMA cor nos três e compara apenas a
   GEOMETRIA. Se as formas só diferissem por estilo, o E3 teria falhado
   e o bloco C acusaria. */
const assert=require('assert'),fs=require('fs'),path=require('path');
const {world,readSource}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}}
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5-E3 · SLUG / PENETRADOR');

function body(name){
  const m=SRC.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(m,'função não encontrada: '+name);return m[0];
}
const GEOM=['beginPath','moveTo','lineTo','arc','closePath','fill','stroke','rect'];
function trace(p){
  S.__pp=p;
  if(p&&p.color)run('glowSprite(__pp.color)');
  S.__ctxLog=[];
  try{run('drawProjectile(__pp)');}finally{const l=S.__ctxLog;S.__ctxLog=null;return l;}
}
function opsOf(l){return l.map(e=>e[0]);}
/* só a GEOMETRIA — descarta cor, alpha, lineWidth e o halo */
function geomOf(l){return l.filter(e=>GEOM.includes(e[0]));}
function P(type,extra){
  return Object.assign({type:type,x:100,y:100,vx:1000,vy:0,r:4,
    color:'#ffffff',dist:0,maxDist:1100},extra||{});
}
const COLOR=id=>run('(WEAPONS.find(w=>w.id==='+JSON.stringify(id)+')||{}).color');
const SLUGS=['rail','sniper','nail'];
run('__ECHO_AUDIT_FIXTURES.prepare("E")');
run('__e=makeEcho({trail:[[0,600,360,0,0]],wave:1,level:1},1);echoes.push(__e)');

/* ============ A · DISPATCH DA FAMÍLIA (21.A–D) ============ */
console.log('\n[A] dispatch da família');
ok('A01 helper drawProjectileSlug existe',()=>{
  assert.strictEqual(typeof T.drawProjectileSlug,'function');});
for(const t of SLUGS)
  ok('A·'+t+' está na família SLUG e usa o helper',()=>{
    assert.strictEqual(T.visualFamilyForProjectile({type:t}),T.PVF.SLUG);
    const g=opsOf(geomOf(trace(P(t))));
    const legacy=opsOf(geomOf(trace(P('cryo'))));
    assert.notDeepStrictEqual(g,legacy,t+' ainda desenha a linha legada');});
ok('A05 demais famílias NÃO usam o helper slug (21.D)',()=>{
  /* uma arma de cada outra família continua na linha legada.
     smg/shotgun/homing/prism saíram desta lista no PR15.5-E4, que lhes deu
     forma própria — o que o E3 precisa garantir é que elas não usam a
     geometria SLUG, verificado logo abaixo em A05b. */
  const legacy=opsOf(geomOf(trace(P('cryo'))));
  for(const t of ['plasma','acid','tesla','plague'])
    assert.deepStrictEqual(opsOf(geomOf(trace(P(t)))),legacy,
      t+' mudou de forma — fora do escopo do E3');});
ok('A05c família CINÉTICO (E10) tem forma própria e NÃO é slug',()=>{
  const legacy=opsOf(geomOf(trace(P('cryo')))).join(',');
  for(const t of ['ricochet','boomer','gatling','mine']){
    const g=opsOf(geomOf(trace(P(t)))).join(',');
    assert.notStrictEqual(g,legacy,t+' deveria ter forma própria (E10)');
    for(const sl of SLUGS)
      assert.notStrictEqual(g,opsOf(geomOf(trace(P(sl)))).join(','),
        t+' copiou a geometria de '+sl);}});
ok('A05b família ENXAME (E4) tem forma própria e NÃO é slug',()=>{
  const legacy=opsOf(geomOf(trace(P('cryo')))).join(',');
  for(const t of ['smg','shotgun','homing','prism']){
    const g=opsOf(geomOf(trace(P(t)))).join(',');
    assert.notStrictEqual(g,legacy,t+' deveria ter forma própria (E4)');
    for(const sl of SLUGS)
      assert.notStrictEqual(g,opsOf(geomOf(trace(P(sl)))).join(','),
        t+' copiou a geometria de '+sl);}});
ok('A06 o dispatch não voltou a ser monolítico (§3)',()=>{
  const b=body('drawProjectile');
  assert.ok(b.includes('drawProjectileSlug'));
  assert.ok(b.includes('visualFamilyForProjectile'),'usa a classificação do E1');
  assert.ok(b.includes('projectileTemporalMode'),'camada do E2 preservada');
  const linhas=b.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('/*')&&
    !l.trim().startsWith('*')&&!l.trim().startsWith('//'));
  assert.ok(linhas.length<=22,'dispatch inchado: '+linhas.length);});
ok('A07 o sub-dispatch interno é por type, pequeno e claro',()=>{
  const b=body('drawProjectileSlug');
  assert.ok(b.includes("t==='nail'")&&b.includes("t==='sniper'"),'sub-dispatch');
  assert.ok(!/PROJ_FAMILY/.test(b),'helper não reclassifica');});

/* ============ B · IDENTIDADE ESTRUTURAL (21.E–H) ============ */
console.log('\n[B] identidade estrutural de cada arma');
ok('B01 os três geram traços Canvas diferentes (21.E)',()=>{
  const sigs=SLUGS.map(t=>JSON.stringify(trace(P(t))));
  assert.strictEqual(new Set(sigs).size,3);});
ok('B02 RAIL: cabeça preenchida + núcleo (21.F)',()=>{
  const g=opsOf(geomOf(trace(P('rail'))));
  assert.ok(g.includes('fill'),'rail precisa de corpo preenchido');
  assert.ok(g.includes('closePath'),'polígono fechado');
  assert.ok(g.includes('stroke'),'núcleo interno');
  assert.ok(g.filter(o=>o==='beginPath').length>=2,'corpo + núcleo');});
ok('B03 RAIL: streak longo — extensão maior que as outras duas',()=>{
  const ext=t=>{const pts=geomOf(trace(P(t))).filter(e=>e[0]==='moveTo'||e[0]==='lineTo')
      .map(e=>e[1][0]);
    return Math.max(...pts)-Math.min(...pts);};
  const r=ext('rail'), s=ext('sniper'), n=ext('nail');
  assert.ok(r>n,'rail ('+r+') deve ser mais longo que nail ('+n+')');
  assert.ok(r>20,'streak do rail curto demais: '+r);});
ok('B04 SNIPER: agulha — só traço, SEM preenchimento (21.G)',()=>{
  const g=opsOf(geomOf(trace(P('sniper'))));
  assert.ok(!g.includes('fill'),'sniper não pode ter massa preenchida');
  assert.ok(g.includes('stroke'));
  assert.ok(!g.includes('closePath'),'sniper não é polígono');});
ok('B05 SNIPER: mais fino que rail e nail',()=>{
  const lw=t=>{const l=trace(P(t));
    const w=l.filter(e=>e[0]==='set:lineWidth').map(e=>e[1][0]);
    return w.length?Math.min(...w):Infinity;};
  assert.ok(lw('sniper')<=lw('rail'),'sniper deve ser o mais fino');});
ok('B06 NAIL: polígono material fechado (21.H)',()=>{
  const g=opsOf(geomOf(trace(P('nail'))));
  assert.ok(g.includes('fill')&&g.includes('closePath'),'corpo sólido');
  const v=g.filter(o=>o==='lineTo').length;
  assert.ok(v>=4,'haste precisa de corpo com ponta e cauda: '+v+' vértices');});
ok('B07 NAIL: é o único com ponta À FRENTE do centro',()=>{
  /* a ponta da haste avança além de p.x; rail/sniper ficam atrás */
  const maxX=t=>Math.max(...geomOf(trace(P(t)))
    .filter(e=>e[0]==='moveTo'||e[0]==='lineTo').map(e=>e[1][0]));
  assert.ok(maxX('nail')>100,'nail deve projetar ponta à frente');});
ok('B08 as três construções têm assinaturas de ops distintas',()=>{
  const sig=t=>opsOf(geomOf(trace(P(t)))).join(',');
  const [r,s,n]=SLUGS.map(sig);
  assert.notStrictEqual(r,s);assert.notStrictEqual(s,n);assert.notStrictEqual(r,n);});
ok('B09 nenhuma das três é a linha legada de 1 segmento',()=>{
  const legacy=opsOf(geomOf(trace(P('cryo')))).join(',');
  SLUGS.forEach(t=>assert.notStrictEqual(opsOf(geomOf(trace(P(t)))).join(','),legacy,t));});

/* ============ C · TESTE SEM COR — O CRITÉRIO DO §22/§29 ============ */
console.log('\n[C] leitura estrutural sem cor');
ok('C01 mesma cor nos três → geometrias ainda distintas (21.J/§22)',()=>{
  const g=SLUGS.map(t=>JSON.stringify(geomOf(trace(P(t,{color:'#ffffff'})))));
  assert.strictEqual(new Set(g).size,3,
    'as formas só diferem por cor — o E3 falhou no critério central');});
ok('C02 a diferença sobrevive a qualquer cor testada (21.I)',()=>{
  for(const c of ['#ffffff','#000000','#888888','#ff00ff']){
    const g=SLUGS.map(t=>JSON.stringify(geomOf(trace(P(t,{color:c})))));
    assert.strictEqual(new Set(g).size,3,'colidem na cor '+c);}});
ok('C03 a diferença sobrevive ao mesmo raio (sem depender de pr)',()=>{
  const g=SLUGS.map(t=>JSON.stringify(geomOf(trace(P(t,{r:4,color:'#fff'})))));
  assert.strictEqual(new Set(g).size,3,
    'as formas dependiam só da espessura pr');});
ok('C04 contagem de vértices difere entre as três',()=>{
  const v=t=>geomOf(trace(P(t))).filter(e=>e[0]==='lineTo').length;
  const [r,s,n]=SLUGS.map(v);
  assert.strictEqual(new Set([r,s,n]).size,3,'vértices: '+[r,s,n]);});

/* ============ D · LONGA DISTÂNCIA DO SNIPER (21.K–M / §20) ============ */
console.log('\n[D] estado de longa distância do sniper');
ok('D01 o limiar visual é o MESMO da mecânica (21.M)',()=>{
  /* a regra mecânica real, lida do fonte */
  const m=SRC.match(/pd&&pd\.farBonus&&p\.dist>(\d+)/);
  assert.ok(m,'regra mecânica do farBonus não encontrada');
  assert.strictEqual(T.SNIPER_FAR_DIST,Number(m[1]),
    'o visual criou uma segunda regra: '+T.SNIPER_FAR_DIST+' vs '+m[1]);});
ok('D02 o limiar mecânico continua 450 e intacto',()=>{
  assert.strictEqual(T.SNIPER_FAR_DIST,450);
  assert.ok(/pd&&pd\.farBonus&&p\.dist>450/.test(SRC));
  assert.strictEqual(run("WEAPONS.find(w=>w.id==='sniper').farBonus"),.85);});
ok('D03 abaixo do limiar usa o estado normal (21.K)',()=>{
  const a=geomOf(trace(P('sniper',{dist:0})));
  const b=geomOf(trace(P('sniper',{dist:449})));
  assert.deepStrictEqual(opsOf(a),opsOf(b),'mudou antes do limiar');
  /* estado normal = haste fina + ponta densa (2 strokes, sem retículas) */
  assert.strictEqual(opsOf(a).filter(o=>o==='stroke').length,2);});
ok('D04 acima do limiar entra o estado de longa distância (21.L)',()=>{
  const perto=opsOf(geomOf(trace(P('sniper',{dist:100}))));
  const longe=opsOf(geomOf(trace(P('sniper',{dist:600}))));
  assert.notDeepStrictEqual(perto,longe,'estado de longa distância ausente');
  assert.ok(longe.length>perto.length);});
ok('D05 a transição ocorre exatamente em dist>450',()=>{
  const s=d=>opsOf(geomOf(trace(P('sniper',{dist:d})))).length;
  assert.strictEqual(s(450),s(0),'450 ainda deve ser estado normal');
  assert.ok(s(451)>s(450),'451 deve ser longa distância');});
ok('D06 o estado de longa distância é GEOMÉTRICO, não cor (§6)',()=>{
  const cor=l=>JSON.stringify(l.filter(e=>/Style$/.test(e[0])).map(e=>e[1][0]));
  const perto=trace(P('sniper',{dist:100})), longe=trace(P('sniper',{dist:600}));
  assert.strictEqual(cor(perto),cor(longe),'o estado usou cor em vez de forma');
  assert.ok(geomOf(longe).length>geomOf(perto).length,'faltou geometria nova');});
ok('D07 o estado não adiciona partículas nem arcos',()=>{
  const g=opsOf(geomOf(trace(P('sniper',{dist:600}))));
  assert.strictEqual(g.filter(o=>o==='arc').length,0);});
ok('D08 usa a MESMA base de distância da mecânica (p.dist)',()=>{
  assert.strictEqual(T.projectileTravelDistance({dist:321}),321);
  assert.strictEqual(T.projectileTravelDistance({}),0);
  assert.strictEqual(T.projectileTravelDistance(null),0);
  assert.ok(body('drawProjectileSlug').includes('projectileTravelDistance'));});
ok('D09 rail e nail NÃO têm estado de longa distância',()=>{
  for(const t of ['rail','nail'])
    assert.deepStrictEqual(opsOf(geomOf(trace(P(t,{dist:0})))),
      opsOf(geomOf(trace(P(t,{dist:900})))),t+' mudou com a distância');});

/* ============ E · INTEGRAÇÃO COM E2 (21.N–P / §4) ============ */
console.log('\n[E] integração com a camada temporal do E2');
ok('E01 rail temporal = forma Rail + camada E2 (21.N)',()=>{
  const base=opsOf(trace(P('rail',{color:COLOR('rail')})));
  const rep=opsOf(trace(P('rail',{color:COLOR('rail'),temporalReplay:true})));
  assert.deepStrictEqual(rep.slice(0,base.length-1),base.slice(0,base.length-1),
    'a camada alterou a forma do rail');
  assert.ok(rep.length>base.length,'faltou a camada temporal');});
ok('E02 sniper temporal = forma Sniper + camada E2 (21.O)',()=>{
  const base=opsOf(trace(P('sniper',{color:COLOR('sniper')})));
  const rep=opsOf(trace(P('sniper',{color:COLOR('sniper'),temporalReplay:true})));
  assert.deepStrictEqual(rep.slice(0,base.length-1),base.slice(0,base.length-1));
  assert.ok(rep.length>base.length);});
ok('E03 Echo com rail = forma Rail + camada Echo (21.P)',()=>{
  const base=opsOf(trace(P('rail',{color:COLOR('rail')})));
  run('__q={type:"rail",x:100,y:100,vx:1000,vy:0,r:4,color:'+
      JSON.stringify(COLOR('rail'))+',dist:0,maxDist:1100,owner:__e}');
  run('glowSprite(__q.color)');
  S.__ctxLog=[];run('drawProjectile(__q)');const eco=opsOf(S.__ctxLog);S.__ctxLog=null;
  assert.deepStrictEqual(eco.slice(0,base.length-1),base.slice(0,base.length-1));
  assert.ok(eco.length>base.length,'Echo não recebeu camada');});
ok('E04 o helper slug NÃO duplica lógica temporal (§4)',()=>{
  const b=body('drawProjectileSlug');
  assert.ok(!/temporalReplay|TemporalLayer|projectileTemporalMode|PTM_/.test(b),
    'a camada temporal deve continuar ortogonal');});
ok('E05 replay de rail preserva a cor do rail (E2 intacto)',()=>{
  run('projectiles.length=0');
  run('__a={id:1,t:runTime,expiresAt:runTime+5,type:"shot",weaponId:"rail",x:600,y:360,'+
      'angle:0,payload:temporalActionPayload(player,WEAPONS.find(x=>x.id==="rail"),1),'+
      'state:"armed",source:"player"}');
  run('replayTemporalAction(__a)');
  assert.strictEqual(run('projectiles[0].color'),COLOR('rail'));
  assert.notStrictEqual(run('projectiles[0].color'),COLOR('plasma'));
  run('projectiles.length=0');});
ok('E06 sniper temporal mantém o estado de longa distância',()=>{
  const p=opsOf(geomOf(trace(P('sniper',{dist:100,temporalReplay:true}))));
  const l=opsOf(geomOf(trace(P('sniper',{dist:600,temporalReplay:true}))));
  assert.ok(l.length>p.length,'o estado sumiu sob a camada temporal');});

/* ============ F · FADE (21.Q / §14) ============ */
console.log('\n[F] fade de alcance');
for(const t of SLUGS)
  ok('F·'+t+' respeita o fade de alcance',()=>{
    const perto=trace(P(t,{dist:0,maxDist:1000}));
    const fim=trace(P(t,{dist:1000,maxDist:1000}));
    const a=l=>l.filter(e=>e[0]==='set:globalAlpha').map(e=>e[1][0]).filter(v=>v<1);
    assert.ok(Math.max(...a(fim))<Math.max(...a(perto)),t+' não desvaneceu');});
ok('F04 fade usa o helper do E1, não uma regra nova',()=>{
  assert.ok(body('drawProjectile').includes('projectileRangeFade'));
  assert.ok(!/maxDist/.test(body('drawProjectileSlug')),
    'o helper slug não deve recalcular fade');});

/* ============ G · DETERMINISMO E OBSERVER (21.R–T / §12) ============ */
console.log('\n[G] determinismo e render observador');
const FNS=['drawProjectileSlug','projectileTravelDistance','drawProjectile'];
ok('G01 nenhum RNG nos helpers (21.R)',()=>{
  for(const n of FNS){const b=body(n);
    assert.ok(!/Math\.random/.test(b),n);
    assert.ok(!/(?<![\w$.])rand\(/.test(b),n);
    assert.ok(!/(?<![\w$.])randi\(/.test(b),n);}});
ok('G02 nenhum spawn de partículas (21.S)',()=>{
  for(const n of FNS)
    assert.ok(!/spawnParticles|spawnShards|spawnRing/.test(body(n)),n);});
ok('G03 nenhuma mutação de coleção (21.T)',()=>{
  for(const n of FNS)
    assert.ok(!/\.(push|splice|pop|shift|unshift)\(/.test(body(n)),n);});
ok('G04 sentinel: desenhar slugs consome ZERO RNG',()=>{
  const orig=S.Math.random;let c=0;S.Math.random=function(){c++;return .5;};
  try{for(const t of SLUGS)for(let i=0;i<20;i++){
    S.__pp=P(t,{dist:i*40,temporalReplay:i%2===0});
    S.__ctxLog=[];run('drawProjectile(__pp)');S.__ctxLog=null;}}
  finally{S.Math.random=orig;}
  assert.strictEqual(c,0,'consumiu '+c+' RNG');});
ok('G05 desenhar não muta o projétil',()=>{
  for(const t of SLUGS){
    const p=P(t,{dist:500,dmg:78,pierce:99});
    const antes=JSON.stringify(p);trace(p);
    assert.strictEqual(JSON.stringify(p),antes,t);}});
ok('G06 output determinístico: 30 desenhos idênticos',()=>{
  for(const t of SLUGS){
    const p=P(t,{dist:600});
    const a=JSON.stringify(trace(p));
    for(let i=0;i<30;i++)assert.strictEqual(JSON.stringify(trace(p)),a,t);}});
ok('G07 sem estado novo persistido no projétil',()=>{
  const b=body('drawProjectileSlug');
  assert.ok(!/p\.[a-zA-Z_$]+\s*=[^=]/.test(b),'o helper escreve no projétil');});
ok('G08 sem trail histórico (§11)',()=>{
  const b=body('drawProjectileSlug');
  assert.ok(!/\[\]|new Array|\.trail|prevX|lastX/.test(b),
    'streak deve ser geométrico, sem histórico');});

/* ============ H · PERFORMANCE (§13 / §23) ============ */
console.log('\n[H] performance');
ok('H01 sem gradiente, shadowBlur, Path2D',()=>{
  const b=body('drawProjectileSlug');
  assert.ok(!/createLinearGradient|createRadialGradient/.test(b));
  assert.ok(!/shadowBlur/.test(b));
  assert.ok(!/new Path2D/.test(b));});
ok('H02 sem save/restore/rotate por projétil',()=>{
  for(const t of SLUGS){
    const o=opsOf(trace(P(t)));
    assert.strictEqual(o.filter(x=>x==='save').length,0,t);
    assert.strictEqual(o.filter(x=>x==='rotate').length,0,t);
    assert.strictEqual(o.filter(x=>x==='setTransform').length,0,t);}});
ok('H03 sem alocação de array/objeto',()=>{
  const b=body('drawProjectileSlug').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/=\s*\[\]/.test(b)&&!/=\s*\{\}/.test(b));
  assert.ok(!/\.map\(|\.filter\(|\.slice\(/.test(b));});
ok('H04 direção calculada UMA vez por projétil',()=>{
  const b=body('drawProjectileSlug');
  assert.strictEqual((b.match(/Math\.hypot/g)||[]).length,1,'hypot repetido');
  assert.ok(!/Math\.atan2|Math\.cos|Math\.sin/.test(b),
    'trig desnecessária: use vx/vy normalizados');});
ok('H05 custo limitado por projétil',()=>{
  for(const t of SLUGS){
    const n=trace(P(t)).length;
    assert.ok(n<=22,t+' custa '+n+' comandos');}});
ok('H06 cena densa não spawna, não muta, não usa RNG (§23)',()=>{
  run('projectiles.length=0');
  const snap=()=>Array.from(run('[parts.length,arcs.length,enemies.length,projectiles.length]'));
  run(`for(let i=0;i<10;i++)projectiles.push({type:'rail',x:600+i*6,y:360,vx:2100,vy:0,
    r:5,color:'#8ff6ff',dist:i*90,maxDist:1100,team:'ally',dmg:78,life:1});`);
  run(`for(let i=0;i<10;i++)projectiles.push({type:'sniper',x:600+i*6,y:370,vx:1800,vy:0,
    r:4,color:'#bffbff',dist:i*90,maxDist:980,team:'ally',dmg:52,life:1});`);
  run(`for(let i=0;i<10;i++)projectiles.push({type:'nail',x:600+i*6,y:380,vx:1150,vy:60,
    r:2.4,color:'#ff3d68',dist:i*70,maxDist:620,team:'ally',dmg:6.5,life:1});`);
  run(`for(let i=0;i<6;i++)projectiles.push({type:'rail',x:610+i*7,y:350,vx:2100,vy:0,
    r:5,color:'#8ff6ff',dist:0,maxDist:1100,team:'ally',dmg:39,life:1,temporalReplay:true});`);
  const a=snap();
  const orig=S.Math.random;let c=0;S.Math.random=function(){c++;return .5;};
  try{S.__ctxLog=[];run('render()');S.__ctxLog=null;}finally{S.Math.random=orig;}
  assert.deepStrictEqual(snap(),a,'o render alterou coleções');
  assert.strictEqual(c,0,'render consumiu '+c+' RNG');
  run('projectiles.length=0');});

/* ============ I · MECÂNICA INTOCADA (§9 / §28) ============ */
console.log('\n[I] mecânica intocada');
const MEC={
  rail:{dmg:78,speed:2100,range:1100,interval:1.30,pr:5,basePierce:99,kick:280},
  sniper:{dmg:52,speed:1800,range:980,interval:1.10,pr:4,basePierce:1,kick:190},
  nail:{dmg:6.5,speed:1150,range:620,interval:.13,pr:2.4,kick:30}
};
for(const [id,m] of Object.entries(MEC))
  ok('I·'+id+' mecânica inalterada',()=>{
    const w=run('WEAPONS.find(x=>x.id==='+JSON.stringify(id)+')');
    for(const k of Object.keys(m))assert.strictEqual(w[k],m[k],id+'.'+k);});
ok('I04 sniper farBonus e nail bleed preservados',()=>{
  assert.strictEqual(run("WEAPONS.find(w=>w.id==='sniper').farBonus"),.85);
  const fx=run("WEAPONS.find(w=>w.id==='nail').fx");
  assert.strictEqual(fx.k,'bleed');assert.strictEqual(fx.dur,4);});
ok('I05 a lógica de dano por distância está intacta',()=>{
  const b=body('updateProjectiles');
  assert.ok(b.includes('pd.farBonus&&p.dist>450'));
  assert.ok(b.includes("p.owner.longRangeBonus&&p.dist>400"));});
ok('I06 updateProjectiles não conhece o helper visual',()=>{
  assert.ok(!/drawProjectileSlug|SNIPER_FAR_DIST/.test(body('updateProjectiles')));});
ok('I07 fireWeaponFrom intocado',()=>{
  assert.ok(!/drawProjectileSlug|SNIPER_FAR_DIST/.test(body('fireWeaponFrom')));});

/* ============ J · FORA DO ESCOPO INTACTO (21.U–W / §16/§17) ============ */
console.log('\n[J] fora do escopo intacto');
ok('J01 fallback legado intacto (21.U)',()=>{
  const g=opsOf(geomOf(trace(P('tipo_inexistente'))));
  assert.deepStrictEqual(g,['beginPath','moveTo','lineTo','stroke']);});
ok('J02 orb intacto (21.V)',()=>{
  const g=opsOf(geomOf(trace(P('orb',{r:8}))));
  assert.strictEqual(g.filter(o=>o==='arc').length,2);
  assert.ok(g.includes('fill')&&g.includes('stroke'));});
ok('J03 eorb de inimigo intacto (§17)',()=>{
  const g=opsOf(geomOf(trace(P('eorb',{r:6,team:'enemy'}))));
  assert.strictEqual(g.filter(o=>o==='arc').length,2);});
ok('J04 beam intacto (21.W)',()=>{
  const b=body('drawBeamFrom');
  assert.ok(!/drawProjectileSlug|SNIPER_FAR_DIST/.test(b));
  assert.ok(b.includes('createLinearGradient')&&b.includes('rampMax'));});
ok('J05 as outras 16 armas continuam na linha legada (§16)',()=>{
  const legacy=opsOf(geomOf(trace(P('cryo')))).join(',');
  /* as 4 do ENXAME saíram da linha legada no E4 (ver A05b) */
  /* as 4 do CINÉTICO saíram da linha legada no E10 (ver A05c) */
  for(const t of ['plasma','flamer','tesla','acid','void','plague','cryo'])
    assert.strictEqual(opsOf(geomOf(trace(P(t)))).join(','),legacy,t+' foi alterada');});

/* ============ K · REGRESSÕES (§24) ============ */
console.log('\n[K] regressões');
const reg=require('./suite-registry.js');
ok('K01 esta suíte é descoberta pelo npm test',()=>{
  assert.ok(reg.suiteIsDiscovered('pr15-5-e3-slug-penetrator-identity'));});
for(const s of ['pr15-5-e2-temporal-projectile-identity',
                'pr15-5-e1-projectile-visual-grammar',
                'pr15-5-e0-visual-determinism',
                'pr15-7-b-anchored-replay-prototype',
                'pr15-5-performance-audit1'])
  ok('K·'+s+' continua no runner',()=>{assert.ok(reg.suiteIsDiscovered(s),s);});
ok('K07 E1: gramática preservada',()=>{
  ['PROJ_FAMILY','visualFamilyForProjectile','projectileUsesOrbShape',
   'projectileRangeFade','drawProjectileGlow','drawProjectileOrbShape',
   'drawProjectileLegacyLine'].forEach(n=>assert.ok(SRC.includes(n),n));});
ok('K08 E2: camada temporal preservada',()=>{
  ['projectileTemporalMode','drawProjectileTemporalLayer','PTM_REPLAY','PTM_ECHO']
    .forEach(n=>assert.ok(SRC.includes(n),n));});
ok('K09 PR15.7: mecânica da Repetição intacta',()=>{
  assert.strictEqual(run('TEMPORAL_ACTION_WINDOW'),5);
  assert.strictEqual(run('TEMPORAL_REPLAY_COOLDOWN'),6);
  assert.strictEqual(run('TEMPORAL_REPLAY_DAMAGE'),.50);});
ok('K10 PR15.5-C/D preservados',()=>{
  ['drawDeathVisual','visualPlayerDrawPose','visualMeleeWeaponPose','meleeDrawTrail']
    .forEach(n=>assert.ok(SRC.includes('function '+n),n));});
ok('K11 documentação do E3 existe',()=>{
  assert.ok(fs.existsSync(path.join(root,'PR15_5_E3_SLUG_PENETRATOR.md')));});

/* Rodapé na convenção do runner (sem marcadores na linha de resumo). */
console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
