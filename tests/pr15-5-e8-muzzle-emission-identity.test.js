'use strict';
/* ECHO — PR15.5-E8 · MUZZLE / EMISSÃO POR FAMÍLIA
   ---------------------------------------------------------------------
   Antes, UMA linha servia às 20 armas ranged:
     spawnParticles(x,y,def.color,3,140,.18,2.5)
   Rail (kick 280) e SMG (kick 22) saíam do cano exatamente iguais.

   A causa raiz não era "poucas partículas": spawnParticles sorteia o
   ângulo em TAU cheio, então a emissão NUNCA podia ser direcional — um
   leque de shotgun e um flash de sniper produziam a mesma nuvem
   isotrópica. O E8 introduz emissão direcional determinística.

   Esta suíte prova identidade por família, custo controlado em alta
   cadência e — o ponto mais forte — que o consumo de RNG no disparo
   DIMINUIU em vez de crescer. */
const assert=require('assert'),fs=require('fs'),path=require('path');
const {world,readSource}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}}
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5-E8 · MUZZLE / EMISSÃO');

function body(name){
  const m=SRC.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(m,'função não encontrada: '+name);return m[0];
}
const W=id=>run('WEAPONS.find(w=>w.id==='+JSON.stringify(id)+')');
const COLOR=id=>(W(id)||{}).color;
/* Dispara a emissão de uma arma e devolve um retrato das partículas
   criadas — direção relativa ao eixo, abertura, velocidade, cor. */
function emit(id,aimDeg){
  run('parts.length=0');
  if(aimDeg!=null)run('player.aim='+(aimDeg*Math.PI/180));
  run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id==='+JSON.stringify(id)+'))');
  const aim=run('player.aim');
  const out=Array.from(run('parts.map(p=>({vx:p.vx,vy:p.vy,r:p.r,life:p.life,color:p.color,ring:!!p.ring}))'))
    .map(p=>{
      const a=Math.atan2(p.vy,p.vx);
      let d=a-aim; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
      return {off:d,spd:Math.hypot(p.vx,p.vy),r:p.r,life:p.life,color:p.color,ring:p.ring};
    });
  run('parts.length=0');
  return out;
}
/* meia-abertura observada do leque */
function spreadOf(id){const e=emit(id);return e.length?Math.max(...e.map(p=>Math.abs(p.off))):0;}
function countOf(id){return emit(id).length;}
/* conta chamadas de RNG durante a emissão */
function rngOf(id){
  run('parts.length=0');
  const o=S.Math.random;let c=0;S.Math.random=function(){c++;return .5;};
  try{run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id==='+JSON.stringify(id)+'))');}
  finally{S.Math.random=o;run('parts.length=0');}
  return c;
}
run('__ECHO_AUDIT_FIXTURES.prepare("E")');
run('__e=makeEcho({trail:[[0,600,360,0,0]],wave:1,level:1},1);echoes.push(__e)');
const RANGED=Array.from(run('WEAPONS.filter(w=>!w.melee).map(w=>w.id)'));
const SHOOTERS=RANGED.filter(id=>id!=='beam');

/* ============ A · COBERTURA E ARQUITETURA (22.A/22.B) ============ */
console.log('\n[A] cobertura e arquitetura');
ok('A01 helper de emissão existe',()=>{
  assert.strictEqual(typeof T.emitWeaponMuzzleVisual,'function');
  assert.strictEqual(typeof T.muzzleShot,'function');
  assert.strictEqual(typeof T.muzzlePower,'function');});
ok('A02 todas as 19 armas que geram projétil emitem algo (22.A)',()=>{
  for(const id of SHOOTERS)
    assert.ok(countOf(id)>0,id+' não emite nada');});
ok('A03 reusa PROJ_FAMILY do E1 — nenhuma tabela nova (§4)',()=>{
  const b=body('emitWeaponMuzzleVisual');
  assert.ok(b.includes('PROJ_FAMILY'),'deve reusar a tabela do E1');
  assert.ok(!/const\s+\w*MUZZLE\w*=\s*\{/.test(SRC),'tabela duplicada de emissão');});
ok('A04 beam não dispara muzzle de projétil (22.B)',()=>{
  /* fireBeam tem caminho próprio e retorna antes da emissão */
  const b=body('fireWeaponFrom');
  const iBeam=b.indexOf('fireBeam(');
  const iEmit=b.indexOf('emitWeaponMuzzleVisual');
  assert.ok(iBeam>=0&&iEmit>iBeam,'beam deve retornar antes da emissão');
  assert.ok(/if\(def\.beam\)\{fireBeam[^}]*return;\}/.test(b));});
ok('A05 drawBeamFrom não foi tocado (§14)',()=>{
  const b=body('drawBeamFrom');
  assert.ok(!/emitWeaponMuzzleVisual|muzzleShot/.test(b));
  assert.ok(b.includes('createLinearGradient')&&b.includes('rampMax'));});
ok('A06 melee não usa emissão de cano',()=>{
  const b=body('fireWeaponFrom');
  const iM=b.indexOf('fireMelee('), iE=b.indexOf('emitWeaponMuzzleVisual');
  assert.ok(iM>=0&&iE>iM,'melee deve retornar antes');});
ok('A07 fireWeaponFrom continua legível: emissão é UMA chamada (§5)',()=>{
  const b=body('fireWeaponFrom');
  assert.strictEqual((b.match(/emitWeaponMuzzleVisual\(/g)||[]).length,1);
  assert.ok(!/muzzleShot\(/.test(b),'detalhe de emissão vazou para o disparo');});

/* ============ B · IDENTIDADE POR FAMÍLIA (22.C/D/E/H/I/J) ============ */
console.log('\n[B] identidade por família');
function sig(id){const e=emit(id);
  return JSON.stringify({n:e.length,
    sp:Math.round(Math.max(...e.map(p=>p.spd))),
    ab:Math.round(Math.max(...e.map(p=>Math.abs(p.off)))*100)});}
ok('B01 rail ≠ sniper (22.C)',()=>{assert.notStrictEqual(sig('rail'),sig('sniper'));});
ok('B02 sniper ≠ nail (22.D)',()=>{assert.notStrictEqual(sig('sniper'),sig('nail'));});
ok('B03 rail ≠ nail',()=>{assert.notStrictEqual(sig('rail'),sig('nail'));});
ok('B04 rail é o mais intenso dos três slugs',()=>{
  const sp=id=>Math.max(...emit(id).map(p=>p.spd));
  assert.ok(sp('rail')>sp('sniper'),'rail deve superar sniper');
  assert.ok(countOf('rail')>countOf('sniper'));});
ok('B05 sniper é o mais contido entre as emissões em leque',()=>{
  /* Só compara armas que emitem >1 partícula: com uma amostra única a
     partícula cai no eixo (u=0) e a "abertura" medida é zero por
     construção — smg/gatling são flash mínimo, não leque, e comparar
     aperturas com elas não afirmaria nada. */
  const s=spreadOf('sniper');
  assert.ok(countOf('sniper')>1,'premissa: sniper forma leque');
  const leque=SHOOTERS.filter(id=>countOf(id)>1);
  assert.ok(leque.length>=14,'poucas armas em leque: '+leque.length);
  for(const id of leque)
    if(id!=='sniper')assert.ok(spreadOf(id)>s,id+' não é mais aberto que sniper');
  /* e as de flash mínimo são de fato mínimas, não leques disfarçados */
  for(const id of ['smg','gatling'])assert.strictEqual(countOf(id),1,id);});
ok('B06 shotgun abre mais que SMG (22.E)',()=>{
  assert.ok(spreadOf('shotgun')>spreadOf('smg'),
    'shotgun '+spreadOf('shotgun')+' vs smg '+spreadOf('smg'));
  assert.ok(countOf('shotgun')>countOf('smg'));});
ok('B07 shotgun tem a emissão mais larga da família ENXAME',()=>{
  ['smg','homing','prism'].forEach(id=>
    assert.ok(spreadOf('shotgun')>spreadOf(id),id));});
ok('B08 fluido (flamer/acid) abre mais que slug (22.H)',()=>{
  for(const f of ['flamer','acid'])
    for(const s of ['rail','sniper','nail'])
      assert.ok(spreadOf(f)>spreadOf(s),f+' vs '+s);});
ok('B09 tesla ≠ plague (22.I)',()=>{
  assert.notStrictEqual(sig('tesla'),sig('plague'));
  /* tesla: centelha rápida e aberta; plague: lento e contido */
  const t=emit('tesla'),p=emit('plague');
  assert.ok(Math.max(...t.map(x=>x.spd))>Math.max(...p.map(x=>x.spd)),
    'tesla deve ser mais rápido que plague');});
ok('B10 mine não usa a assinatura de tiro linear (22.J)',()=>{
  /* lançamento: lento e aberto, ao contrário de um disparo direcional */
  const m=emit('mine');
  const mSpd=Math.max(...m.map(p=>p.spd));
  assert.ok(spreadOf('mine')>spreadOf('rail'),'mine deve ser mais aberto');
  assert.ok(mSpd<Math.max(...emit('rail').map(p=>p.spd)),'mine deve ser mais lento');
  assert.notStrictEqual(sig('mine'),sig('ricochet'));});
ok('B11 energia/massa é lenta e compacta',()=>{
  const e=emit('plasma');
  assert.ok(Math.max(...e.map(p=>p.spd))<Math.max(...emit('rail').map(p=>p.spd)));});
ok('B12 as 6 famílias produzem assinaturas distintas entre si',()=>{
  const reps=['rail','plasma','flamer','shotgun','tesla','ricochet'];
  const sigs=reps.map(sig);
  assert.strictEqual(new Set(sigs).size,6,'famílias colidem: '+sigs);});
ok('B13 a emissão é DIRECIONAL (alinhada à mira), não isotrópica',()=>{
  /* a causa raiz do problema antigo: rand(0,TAU) espalhava em 360° */
  for(const id of ['rail','sniper','shotgun','smg']){
    const e=emit(id,37);
    assert.ok(Math.max(...e.map(p=>Math.abs(p.off)))<Math.PI*.75,
      id+' emitiu para trás do cano');}});
ok('B14 a direção acompanha a mira em qualquer ângulo',()=>{
  for(const deg of [0,90,180,270]){
    const e=emit('rail',deg);
    assert.ok(Math.max(...e.map(p=>Math.abs(p.off)))<.5,'ângulo '+deg);}});

/* ============ C · COR E MECÂNICA (22.K–R) ============ */
console.log('\n[C] cor e mecânica preservadas');
ok('C01 cor da arma é preservada na emissão (22.K)',()=>{
  for(const id of SHOOTERS){
    const e=emit(id);
    e.forEach(p=>assert.strictEqual(p.color,COLOR(id),id));}});
ok('C02 emissão não altera nada do projétil (22.L)',()=>{
  run('projectiles.length=0');
  run('fireWeaponFrom(player,WEAPONS.find(w=>w.id==="rail"),"ally",1,"player")');
  const p=run('projectiles[0]');
  assert.strictEqual(p.dmg,W('rail').dmg);
  assert.strictEqual(Math.round(Math.hypot(p.vx,p.vy)),W('rail').speed);
  run('projectiles.length=0');});
const MEC=['dmg','speed','range','count','spread','interval','kick','pr'];
ok('C03 dmg/speed/spread/count/cooldown/kick intactos (22.M–R)',()=>{
  const ESP={rail:[78,2100,1100,1,0,1.30,280,5],
             smg:[4.2,900,480,1,0,.065,22,2.6],
             shotgun:[7,720,245,7,.13,.74,210,3.5],
             sniper:[52,1800,980,1,0,1.10,190,4]};
  for(const [id,v] of Object.entries(ESP)){
    const w=W(id);
    MEC.forEach((k,i)=>assert.strictEqual(w[k],v[i],id+'.'+k));}});
ok('C04 recoil mecânico preservado (22.R)',()=>{
  const b=body('fireWeaponFrom');
  assert.ok(b.includes('src.recoil=1'),'recoil visual da arma empunhada');
  assert.ok(/player\.vx-=Math\.cos\(src\.aim\)\*def\.kick/.test(b),'kick intacto');});
ok('C05 o helper não toca estado mecânico',()=>{
  const b=body('emitWeaponMuzzleVisual')+body('muzzleShot');
  assert.ok(!/\.hp|\.dmg|\.fireTimer|\.recoil|\.vx-=|\.vy-=/.test(b));
  assert.ok(!/projectiles\.push|enemies\.push/.test(b));});
ok('C06 disparar não altera hp/fireTimer por causa da emissão',()=>{
  const before=run('[player.hp,player.wi,projectiles.length]');
  run('parts.length=0');
  run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id==="rail"))');
  assert.deepStrictEqual(Array.from(run('[player.hp,player.wi,projectiles.length]')),
    Array.from(before));
  run('parts.length=0');});
ok('C07 muzzlePower comprime o kick (não escala cru) (§7)',()=>{
  assert.ok(T.muzzlePower({kick:0})>=.75);
  assert.ok(T.muzzlePower({kick:280})<=1.4,'rail não pode explodir a escala');
  assert.ok(T.muzzlePower({kick:9999})<=1.4,'sem teto o kick viraria absurdo');
  assert.ok(T.muzzlePower({kick:280})>T.muzzlePower({kick:22}),
    'rail deve parecer mais violento que smg');});

/* ============ D · CUSTO (§16 / §23 / §24) ============ */
console.log('\n[D] custo e alta cadência');
const LEGADO=3;   // spawnParticles(...,3,...) — volume por disparo antes do E8
ok('D01 nenhuma arma passa de 6 partículas por disparo',()=>{
  for(const id of SHOOTERS){
    const n=countOf(id);
    assert.ok(n<=6,id+' emite '+n);}});
ok('D02 alta cadência é mínima: smg/gatling ≤ 1 (22.F/22.G)',()=>{
  for(const id of ['smg','gatling'])
    assert.ok(countOf(id)<=1,id+' emite '+countOf(id)+' — caro demais para a cadência');
  /* Flamer usa 2 — o mínimo para uma abertura de cone ser legível (com 1 a
     partícula cai no eixo e vira agulha de slug). Mesmo sendo a arma de
     maior cadência (0.045s), continua abaixo das 3 do emissor antigo. */
  assert.ok(countOf('flamer')<=2,'flamer emite '+countOf('flamer'));
  assert.ok(run('WEAPONS.find(w=>w.id==="flamer").interval')<.05,
    'premissa: flamer é a arma de cadência mais alta');});
ok('D03 armas de cadência alta emitem MENOS que o legado',()=>{
  for(const id of ['smg','gatling','flamer'])
    assert.ok(countOf(id)<LEGADO,id);});
ok('D04 a média global NÃO aumentou vs o legado (§24)',()=>{
  const tot=SHOOTERS.reduce((a,id)=>a+countOf(id),0);
  const media=tot/SHOOTERS.length;
  assert.ok(media<=LEGADO,'média '+media.toFixed(2)+' vs legado '+LEGADO);});
ok('D05 burst de SMG é limitado (60 disparos)',()=>{
  run('parts.length=0');
  for(let i=0;i<60;i++)run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id==="smg"))');
  const n=run('parts.length');
  assert.ok(n<=60,'60 disparos geraram '+n+' partículas');
  assert.ok(n<=60*LEGADO,'pior que o legado');
  run('parts.length=0');});
ok('D06 burst de gatling é limitado (60 disparos)',()=>{
  run('parts.length=0');
  for(let i=0;i<60;i++)run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id==="gatling"))');
  assert.ok(run('parts.length')<=60);
  run('parts.length=0');});
ok('D07 o teto PARTS_MAX continua respeitado',()=>{
  run('parts.length=0');
  for(let i=0;i<400;i++)run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id==="shotgun"))');
  assert.ok(run('parts.length')<=run('PARTS_MAX'),'estourou PARTS_MAX');
  run('parts.length=0');});
ok('D08 sem gradiente, shadowBlur, Path2D, alocação',()=>{
  const b=body('emitWeaponMuzzleVisual')+body('muzzleShot')+body('muzzlePower');
  assert.ok(!/createLinearGradient|createRadialGradient|shadowBlur|new Path2D/.test(b));
  const c=b.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/=\s*\[\]/.test(c)&&!/\.map\(|\.filter\(/.test(c));});
ok('D09 usa o pool de partículas (zero alocação nova)',()=>{
  assert.ok(body('muzzleShot').includes('partTake()'),'deve reusar o pool');});
ok('D10 cfg.parts continua reduzindo o volume',()=>{
  assert.ok(body('muzzleShot').includes('cfg.parts'));
  run('cfg.parts=0');const off=countOf('shotgun');
  run('cfg.parts=1');const on=countOf('shotgun');
  assert.ok(off<on,'cfg.parts deixou de reduzir: '+off+' vs '+on);});

/* ============ E · DETERMINISMO (§17 / 22.U) ============ */
console.log('\n[E] determinismo');
ok('E01 muzzleShot não consome RNG',()=>{
  for(const id of SHOOTERS)
    assert.strictEqual(rngOf(id),0,id+' consumiu RNG');});
ok('E02 o consumo global de RNG na emissão CAIU vs o legado',()=>{
  /* legado: spawnParticles usa 4 rand() por partícula × 3 partículas */
  const novo=SHOOTERS.reduce((a,id)=>a+rngOf(id),0);
  const legado=SHOOTERS.length*LEGADO*4;
  assert.strictEqual(novo,0);
  assert.ok(novo<legado,'novo '+novo+' vs legado '+legado);});
ok('E03 emissão é determinística: 20 disparos idênticos',()=>{
  for(const id of ['rail','shotgun','tesla']){
    const a=JSON.stringify(emit(id));
    for(let i=0;i<20;i++)assert.strictEqual(JSON.stringify(emit(id)),a,id);}});
ok('E04 nenhum Math.random/rand/randi nos helpers',()=>{
  for(const n of ['emitWeaponMuzzleVisual','muzzleShot','muzzlePower']){
    const b=body(n);
    assert.ok(!/Math\.random/.test(b),n);
    assert.ok(!/(?<![\w$.])rand\(/.test(b),n);
    assert.ok(!/(?<![\w$.])randi\(/.test(b),n);}});
ok('E05 spawnParticles original permanece intacto',()=>{
  const b=body('spawnParticles');
  assert.ok(b.includes('rand(0,TAU)'),'o RNG legítimo do spawn foi preservado');
  assert.ok(b.includes('PARTS_MAX'));});

/* ============ F · OBSERVER-ONLY (§18 / 22.V) ============ */
console.log('\n[F] render continua observador');
ok('F01 a emissão é EVENTO, não draw (§18)',()=>{
  /* nenhuma função de render pode chamar o helper */
  for(const n of ['drawProjectile','drawProjectileSlug','drawProjectileLegacyLine',
                  'drawProjectileGlow','drawProjectileTemporalLayer'])
    assert.ok(!new RegExp('emitWeaponMuzzleVisual|muzzleShot').test(body(n)),n);});
ok('F02 render não cria partículas nem consome RNG (22.U/22.V)',()=>{
  run('parts.length=0');
  run('fireWeaponFrom(player,WEAPONS.find(w=>w.id==="shotgun"),"ally",1,"player")');
  const snap=()=>Array.from(run('[parts.length,projectiles.length,arcs.length,enemies.length]'));
  const a=snap();
  const o=S.Math.random;let c=0;S.Math.random=function(){c++;return .5;};
  try{S.__ctxLog=[];run('render()');S.__ctxLog=null;}finally{S.Math.random=o;}
  assert.deepStrictEqual(snap(),a,'render alterou coleções');
  assert.strictEqual(c,0,'render consumiu '+c+' RNG');
  run('parts.length=0');run('projectiles.length=0');});
ok('F03 a emissão só acontece em fireWeaponFrom',()=>{
  const n=(SRC.match(/emitWeaponMuzzleVisual\(/g)||[]).length;
  assert.strictEqual(n,2,'1 definição + 1 chamada, encontrado '+n);});

/* ============ G · ECHO E REPLAY (§19 / §20 / 22.S / 22.T) ============ */
console.log('\n[G] Echo e Repetição Ancorada');
ok('G01 Echo usa a MESMA assinatura da arma (22.S / §19)',()=>{
  run('parts.length=0');
  run('__e.aim=player.aim;__e.r=player.r');
  run('emitWeaponMuzzleVisual(__e,WEAPONS.find(w=>w.id==="rail"))');
  const eco=run('parts.length');
  run('parts.length=0');
  run('emitWeaponMuzzleVisual(player,WEAPONS.find(w=>w.id==="rail"))');
  const pl=run('parts.length');
  run('parts.length=0');
  assert.strictEqual(eco,pl,'Echo recebeu emissão diferente');});
ok('G02 não existe muzzle "genérico de Echo" (§19)',()=>{
  const b=body('emitWeaponMuzzleVisual');
  assert.ok(!/slot|isEcho|echoes|owner/.test(b),
    'a emissão deve dizer QUE ARMA disparou, não quem disparou');});
ok('G03 Echo preserva a cor da arma, não uma cor de Echo',()=>{
  run('parts.length=0');
  run('emitWeaponMuzzleVisual(__e,WEAPONS.find(w=>w.id==="shotgun"))');
  const cores=Array.from(run('parts.map(p=>p.color)'));
  run('parts.length=0');
  cores.forEach(c=>assert.strictEqual(c,COLOR('shotgun')));});
ok('G04 Repetição Ancorada NÃO cria muzzle extra (22.T / §20)',()=>{
  run('parts.length=0');
  run('__a={id:1,t:runTime,expiresAt:runTime+5,type:"shot",weaponId:"rail",x:600,y:360,'+
      'angle:0,payload:temporalActionPayload(player,WEAPONS.find(x=>x.id==="rail"),1),'+
      'state:"armed",source:"player"}');
  const antes=run('parts.length');
  run('replayTemporalAction(__a)');
  /* o replay tem seus próprios FX de origem (spawnRing/spawnParticles já
     existentes no PR15.7) mas NÃO deve chamar o muzzle da arma */
  const b=body('replayTemporalAction');
  assert.ok(!/emitWeaponMuzzleVisual|muzzleShot/.test(b),
    'replay não deve disparar muzzle — é replay da ação, não disparo físico');
  run('parts.length=0');run('projectiles.length=0');});
ok('G05 replay não passa por fireWeaponFrom',()=>{
  assert.ok(!/fireWeaponFrom/.test(body('replayTemporalAction')));});
ok('G06 PR15.7 mecanicamente intacto',()=>{
  assert.strictEqual(run('TEMPORAL_ACTION_WINDOW'),5);
  assert.strictEqual(run('TEMPORAL_REPLAY_COOLDOWN'),6);
  assert.strictEqual(run('TEMPORAL_REPLAY_DAMAGE'),.50);});

/* ============ H · ESCOPO: NADA MAIS MUDOU (§2 / §25 / §26) ============ */
console.log('\n[H] escopo preservado');
const GEOM=['beginPath','moveTo','lineTo','arc','closePath','fill','stroke'];
function shapeOf(type){
  S.__pp={type:type,x:100,y:100,vx:1000,vy:0,r:4,color:'#ffffff',dist:0,maxDist:1100};
  run('glowSprite("#ffffff")');
  S.__ctxLog=[];run('drawProjectile(__pp)');const l=S.__ctxLog;S.__ctxLog=null;
  return l.filter(e=>GEOM.includes(e[0])).map(e=>e[0]).join(',');
}
ok('H01 formas do E3 (rail/sniper/nail) inalteradas (§25)',()=>{
  assert.strictEqual(shapeOf('rail'),
    'beginPath,moveTo,lineTo,lineTo,lineTo,closePath,fill,beginPath,moveTo,lineTo,stroke');
  assert.strictEqual(shapeOf('sniper'),
    'beginPath,moveTo,lineTo,stroke,beginPath,moveTo,lineTo,stroke');
  assert.strictEqual(shapeOf('nail'),
    'beginPath,moveTo,lineTo,lineTo,lineTo,lineTo,lineTo,closePath,fill');});
ok('H02 as armas fora de SLUG/ENXAME têm forma própria e o muzzle não as tocou (§2)',()=>{
  /* smg/shotgun/homing/prism ganharam forma própria no PR15.5-E4 */
  const legacy=shapeOf('arma_do_futuro_2027');
  /* ricochet/boomer/gatling/mine ganharam forma própria no PR15.5-E10 */
  /* plasma/orb/void/cryo ganharam forma própria no PR15.5-E5 (ver H02d) */
  /* flamer/acid ganharam forma própria no PR15.5-E6 (ver H02e) */
  /* tesla/plague ganharam forma própria no PR15.5-E7 (ver H02f) */
  assert.strictEqual(legacy,'beginPath,moveTo,lineTo,stroke','premissa: fallback');
  for(const id of ['tesla','plague'])
    assert.notStrictEqual(shapeOf(id),legacy,id+' regrediu para o fallback');});
ok('H02e E6: as 2 de FLUIDO/SPRAY têm forma própria e o muzzle não as tocou',()=>{
  const legacy=shapeOf('arma_do_futuro_2027');
  const s={};
  for(const id of ['flamer','acid']){
    s[id]=shapeOf(id);
    assert.notStrictEqual(s[id],legacy,id+' regrediu para a linha legada');}
  assert.strictEqual(new Set(Object.values(s)).size,2,'topologias devem ser distintas');});
ok('H02f E7: as 2 de CONDUÇÃO/STATUS têm forma própria e o muzzle não as tocou',()=>{
  const legacy=shapeOf('arma_do_futuro_2027');
  const s={};
  for(const id of ['tesla','plague']){
    s[id]=shapeOf(id);
    assert.notStrictEqual(s[id],legacy,id+' regrediu para a linha legada');}
  assert.strictEqual(new Set(Object.values(s)).size,2,'topologias devem ser distintas');});
ok('H02d E5: as 4 de ENERGIA/MASSA têm forma própria e o muzzle não as tocou',()=>{
  const legacy=shapeOf('arma_do_futuro_2027');
  const s={};
  for(const id of ['plasma','orb','void','cryo']){
    s[id]=shapeOf(id);
    assert.notStrictEqual(s[id],legacy,id+' regrediu para a linha legada');}
  assert.strictEqual(new Set(Object.values(s)).size,4,'topologias devem ser distintas');});
ok('H02c E10: as 4 cinéticas têm forma própria e o muzzle não as tocou',()=>{
  const legacy=shapeOf('cryo');
  const s={};
  for(const id of ['ricochet','boomer','gatling','mine']){
    s[id]=shapeOf(id);
    assert.notStrictEqual(s[id],legacy,id+' perdeu a forma do E10');}
  assert.strictEqual(new Set(Object.values(s)).size,4,'formas do E10 colidiram');});
ok('H02b E4: as 4 do ENXAME têm forma própria e o muzzle não as tocou',()=>{
  const legacy=shapeOf('cryo');
  const s={};
  for(const id of ['smg','shotgun','homing','prism']){
    s[id]=shapeOf(id);
    assert.notStrictEqual(s[id],legacy,id+' perdeu a forma do E4');}
  assert.strictEqual(new Set(Object.values(s)).size,4,'formas do E4 colidiram');});
ok('H03 orb e eorb intactos',()=>{
  assert.ok(shapeOf('orb').includes('arc,fill'));
  assert.strictEqual(shapeOf('eorb'),shapeOf('orb'));});
ok('H04 camada temporal do E2 intacta (§26)',()=>{
  for(const n of ['projectileTemporalMode','drawProjectileTemporalLayer'])
    assert.ok(!/emitWeaponMuzzleVisual|muzzleShot/.test(body(n)),n);
  assert.strictEqual(T.projectileTemporalMode({temporalReplay:true}),T.PTM.REPLAY);});
ok('H05 replay preserva cor da arma (E2 intacto)',()=>{
  run('projectiles.length=0');
  run('__a={id:1,t:runTime,expiresAt:runTime+5,type:"shot",weaponId:"rail",x:600,y:360,'+
      'angle:0,payload:temporalActionPayload(player,WEAPONS.find(x=>x.id==="rail"),1),'+
      'state:"armed",source:"player"}');
  run('replayTemporalAction(__a)');
  assert.strictEqual(run('projectiles[0].color'),COLOR('rail'));
  run('projectiles.length=0');});
ok('H06 gramática do E1 intacta',()=>{
  ['PROJ_FAMILY','visualFamilyForProjectile','projectileUsesOrbShape',
   'projectileRangeFade','drawProjectileGlow'].forEach(n=>assert.ok(SRC.includes(n),n));});

/* ============ I · REGRESSÕES (§27) ============ */
console.log('\n[I] regressões');
const reg=require('./suite-registry.js');
ok('I01 esta suíte é descoberta pelo npm test',()=>{
  assert.ok(reg.suiteIsDiscovered('pr15-5-e8-muzzle-emission-identity'));});
for(const s of ['pr15-5-e3-slug-penetrator-identity','pr15-5-e2-temporal-projectile-identity',
                'pr15-5-e1-projectile-visual-grammar','pr15-5-e0-visual-determinism',
                'pr15-7-b-anchored-replay-prototype','pr15-5-performance-audit1'])
  ok('I·'+s+' continua no runner',()=>{assert.ok(reg.suiteIsDiscovered(s),s);});
ok('I08 PR15.5-C/D preservados',()=>{
  ['drawDeathVisual','visualPlayerDrawPose','visualMeleeWeaponPose','meleeDrawTrail']
    .forEach(n=>assert.ok(SRC.includes('function '+n),n));});
ok('I09 documentação do E8 existe',()=>{
  assert.ok(fs.existsSync(path.join(root,'PR15_5_E8_MUZZLE_EMISSION.md')));});

/* Rodapé na convenção do runner (sem marcadores na linha de resumo). */
console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
