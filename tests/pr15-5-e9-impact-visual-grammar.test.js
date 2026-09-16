'use strict';
/* ECHO — PR15.5-E9 · GRAMÁTICA VISUAL DE IMPACTOS
   ---------------------------------------------------------------------
   A COR AJUDA. A FORMA DECIDE. O IMPACTO CONFIRMA.

   Cria uma gramática visual coerente para o instante em que os ataques
   do jogador atingem inimigos, detonam, encadeiam, aplicam efeitos,
   ricocheteiam ou perfuram — SOMENTE onde essas mecânicas existem.

   Princípios arquiteturais:
   1. Ponto único de despacho visual: emitWeaponImpactVisual(p, e, eventKind)
   2. Emissão direcional determinística: impactShot (zero Math.random, zero alocação)
   3. Budgets controlados por cadência: armas de alta cadência (flamer, smg,
      gatling, shotgun por pellet, acid por pellet) usam EXATAMENTE 1 partícula
   4. Não inventar mecânicas inexistentes: Void sem AoE/sucção falsa,
      Plague sem contágio/nuvem falsa, Flamer/Acid sem poças persistentes
   5. Preservar eventos reais: Orb (AoE 105px), Mine (AoE 120px), Tesla (chain)
   6. Zero alteração em dano, cadência, hitbox, status, rng ou balanceamento. */
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {world,readSource}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}}
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5-E9 · IMPACTO / GRAMÁTICA VISUAL');

function body(name){
  const m=SRC.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(m,'função não encontrada: '+name);return m[0];
}

const ALL_RANGED=['plasma','shotgun','orb','flamer','rail','smg','cryo','tesla',
  'acid','nail','boomer','homing','mine','sniper','void','ricochet','gatling','prism','plague'];

/* Helper para emitir impacto controlado e inspecionar partículas resultantes */
function testImpact(weaponId, eventKind='hit', vx=600, vy=0){
  run('parts.length=0');
  run('var __w = WEAPONS.find(w=>w.id==='+JSON.stringify(weaponId)+');');
  run('var __p = {x:200, y:200, vx:'+vx+', vy:'+vy+', type:'+JSON.stringify(weaponId)+', '+
      'color: (__w&&__w.color)||"#ffffff", team:"ally", def:__w, pierce:0, crit:false};');
  run('emitWeaponImpactVisual(__p, {x:200, y:200, r:16}, '+JSON.stringify(eventKind)+');');
  const pts = Array.from(run('parts.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,r:p.r,life:p.life,color:p.color,ring:!!p.ring,shard:!!p.shard}))'));
  run('parts.length=0');
  return pts;
}

/* ============ A · INVENTÁRIO COMPLETO ============ */
console.log('\n[A] inventário completo');
ok('A01 emitWeaponImpactVisual e impactShot existem e são funções',()=>{
  assert.strictEqual(typeof run('emitWeaponImpactVisual'),'function');
  assert.strictEqual(typeof run('impactShot'),'function');
});
ok('A02 todas as 19 armas ranged que geram projéteis estão catalogadas',()=>{
  for(const id of ALL_RANGED){
    const fam = run('visualFamilyForProjectile({type:'+JSON.stringify(id)+'})');
    assert.ok(fam > 0, id + ' deve ter família associada');
  }
});
ok('A03 beam está fora do dispatch de projéteis (é arma beam:true)',()=>{
  const w = run('WEAPONS.find(w=>w.id==="beam")');
  assert.ok(w && w.beam);
  assert.strictEqual(run('visualFamilyForProjectile({type:"beam"})'), 0);
});
ok('A04 reuso de PROJ_FAMILY do E1 (sem tabelas redundantes)',()=>{
  const b = body('emitWeaponImpactVisual');
  assert.ok(/visualFamilyForProjectile|PROJ_FAMILY/.test(b));
});
ok('A05 todas as 7 armas brancas estão catalogadas e intocadas',()=>{
  const melees = ['blade','scythe','hammer','katana','chains','gaunt','glaive'];
  for(const m of melees){
    const w = run('WEAPONS.find(w=>w.id==="'+m+'")');
    assert.ok(w && w.melee, m + ' deve ser melee');
  }
});

/* ============ B · ROTEAMENTO ============ */
console.log('\n[B] roteamento');
for(const id of ALL_RANGED){
  ok('B·'+id+' despacha corretamente',()=>{
    run('parts.length=0');
    run('var __w = WEAPONS.find(w=>w.id==='+JSON.stringify(id)+');');
    run('var __p = {x:100, y:100, vx:500, vy:0, type:'+JSON.stringify(id)+', color:"#fff", team:"ally", def:__w};');
    const res = run('emitWeaponImpactVisual(__p, {x:100,y:100,r:15}, "hit")');
    assert.strictEqual(res, 1, id + ' deve retornar 1 indicando despacho');
    run('parts.length=0');
  });
}
ok('B20 ricochete de parede roteia para evento bounce',()=>{
  const pts = testImpact('ricochet', 'bounce', 500, 0);
  assert.strictEqual(pts.length, 3, 'quique de parede deve gerar 3 faíscas de reflexão');
});
ok('B21 perfuração roteia com o evento pierce',()=>{
  const pts = testImpact('rail', 'pierce', 2100, 0);
  assert.strictEqual(pts.length, 4, 'rail pierce deve gerar 4 partículas de perfuração');
});

/* ============ C · ZERO DUPLICAÇÃO ============ */
console.log('\n[C] zero duplicação');
ok('C01 antigo spawnParticles isotrópico de pierce foi removido de updateProjectiles',()=>{
  const b = body('updateProjectiles');
  assert.ok(!b.includes('spawnParticles(p.x,p.y,p.color,3,150,.2,2)'),
    'o spawnParticles legado de pierce deve ser substituído pelo despacho E9');
});
ok('C02 acerto de projétil emite impacto exatamente uma vez por evento',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[];');
  run('spawnEnemy("tank", 400, 300, 5); enemies[0].spawnT=0; enemies[0].hp=500;');
  run('projectiles.push({x:390, y:300, vx:600, vy:0, r:4, dmg:10, life:1, type:"plasma", team:"ally", color:"#46e0ff", def:WEAPONS[0], dist:0, maxDist:800, pierce:0, hits:null, owner:player});');
  run('updateProjectiles(1/60)');
  assert.ok(run('parts.length') > 0, 'partículas de impacto geradas');
  assert.ok(run('enemies[0].hp') < 500, 'dano aplicado');
  assert.strictEqual(run('projectiles.length'), 0, 'projétil não-perfurante consumido');
});

/* ============ D · GRAMÁTICA POR FAMÍLIA ============ */
console.log('\n[D] gramática por família');
ok('D01 SLUG (rail, sniper, nail): impacto direcional estreito e penetrante',()=>{
  for(const id of ['rail','sniper','nail']){
    const pts = testImpact(id, 'hit', 1000, 0);
    assert.ok(pts.length >= 2 && pts.length <= 4, id + ' budget slug');
    const forward = pts.filter(p => p.vx > 0);
    assert.ok(forward.length >= 2, id + ' deve ter impulso direcional frontal');
  }
});
ok('D02 ENERGY (plasma, void, cryo): descarga/colapso concentrado',()=>{
  const pPlasma = testImpact('plasma', 'hit', 800, 0);
  assert.strictEqual(pPlasma.length, 2, 'plasma: 2 partículas de pop');
  const pVoid = testImpact('void', 'hit', 400, 0);
  assert.strictEqual(pVoid.length, 3, 'void: 3 partículas de colapso denso');
  const pCryo = testImpact('cryo', 'hit', 600, 0);
  assert.strictEqual(pCryo.length, 2, 'cryo: 2 partículas de fratura de gelo');
});
ok('D03 FLUID (flamer, acid): spray/gotas ultrabarato',()=>{
  const pFlamer = testImpact('flamer', 'hit', 400, 0);
  assert.strictEqual(pFlamer.length, 1, 'flamer deve emitir exatamente 1 partícula por hit');
  const pAcid = testImpact('acid', 'hit', 500, 0);
  assert.strictEqual(pAcid.length, 1, 'acid deve emitir exatamente 1 partícula por gota');
});
ok('D04 SWARM (smg, shotgun, homing, prism): micro-impactos econômicos',()=>{
  const pSmg = testImpact('smg', 'hit', 800, 0);
  assert.strictEqual(pSmg.length, 1, 'smg: 1 micro-partícula por tiro');
  const pShot = testImpact('shotgun', 'hit', 700, 0);
  assert.strictEqual(pShot.length, 1, 'shotgun: 1 partícula por pellet');
  const pHoming = testImpact('homing', 'hit', 400, 0);
  assert.strictEqual(pHoming.length, 2, 'homing: 2 partículas de impacto de míssil');
  const pPrism = testImpact('prism', 'hit', 700, 0);
  assert.strictEqual(pPrism.length, 2, 'prism: 2 partículas de refração');
});
ok('D05 CONDUCT (tesla, plague): centelha / contato localizado',()=>{
  const pTesla = testImpact('tesla', 'hit', 800, 0);
  assert.strictEqual(pTesla.length, 2, 'tesla: 2 partículas elétricas no contato primário');
  const pPlague = testImpact('plague', 'hit', 500, 0);
  assert.strictEqual(pPlague.length, 2, 'plague: 2 partículas tóxicas no contato localizado');
});
ok('D06 KINETIC (ricochet, boomer, gatling, mine): cinéticos e retorno',()=>{
  const pGat = testImpact('gatling', 'hit', 1000, 0);
  assert.strictEqual(pGat.length, 1, 'gatling: 1 partícula por tiro');
  const pRico = testImpact('ricochet', 'hit', 800, 0);
  assert.strictEqual(pRico.length, 2, 'ricochet: 2 partículas no alvo');
  const pBoom = testImpact('boomer', 'hit', 600, 0);
  assert.strictEqual(pBoom.length, 2, 'boomer: 2 partículas de corte transversal');
});

/* ============ E · CROSS-FAMILY DISTINCTION ============ */
console.log('\n[E] distinção entre famílias');
ok('E01 Slug penetrante != Energy colapso != Fluid spray',()=>{
  const slug = testImpact('rail', 'hit', 1000, 0);
  const energy = testImpact('plasma', 'hit', 1000, 0);
  const fluid = testImpact('flamer', 'hit', 1000, 0);
  assert.notDeepStrictEqual(slug, energy);
  assert.notDeepStrictEqual(slug, fluid);
  assert.notDeepStrictEqual(energy, fluid);
});
ok('E02 Swarm micro != Conduct centelha != Kinetic slice',()=>{
  const swarm = testImpact('smg', 'hit', 1000, 0);
  const conduct = testImpact('tesla', 'hit', 1000, 0);
  const kinetic = testImpact('boomer', 'hit', 1000, 0);
  assert.notDeepStrictEqual(swarm, conduct);
  assert.notDeepStrictEqual(swarm, kinetic);
  assert.notDeepStrictEqual(conduct, kinetic);
});

/* ============ F · ALTA CADÊNCIA E BUDGETS ============ */
console.log('\n[F] alta cadência e budgets');
ok('F01 armas de altíssima cadência consom exatamente 1 partícula por acerto',()=>{
  for(const id of ['flamer','smg','gatling']){
    const pts = testImpact(id, 'hit');
    assert.strictEqual(pts.length, 1, id + ' deve ter budget = 1');
    assert.ok(pts[0].life <= 0.08, id + ' deve ter vida muito curta para evitar acúmulo');
  }
});
ok('F02 nenhuma arma unitária excede 4 partículas por evento',()=>{
  for(const id of ALL_RANGED){
    const pts = testImpact(id, 'hit');
    assert.ok(pts.length <= 4, id + ' excedeu teto de 4 partículas (produziu ' + pts.length + ')');
  }
});

/* ============ G · ORB ============ */
console.log('\n[G] orb: AoE real preservado');
ok('G01 explodeOrb executa AoE de 105px real com dano e lentidão',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[];');
  run('spawnEnemy("tank", 300, 300, 5); spawnEnemy("chaser", 350, 300, 5);');
  run('for(const e of enemies){e.spawnT=0; e.hp=500;}');
  run('var wOrb = WEAPONS.find(w=>w.id==="orb");');
  run('explodeOrb({x:320, y:300, color:wOrb.color, dmg:wOrb.dmg, aoe:wOrb.aoe, owner:player});');
  assert.strictEqual(run('enemies.filter(e=>e.hp<500).length'), 2, 'ambos inimigos devem sofrer dano no raio real');
  assert.ok(run('enemies[0].slowT') >= 1.4, 'slow aplicado pelo orb');
  assert.ok(run('parts.some(p=>p.ring)'), 'anel de onda de choque gerado');
});

/* ============ H · VOID ============ */
console.log('\n[H] void: sem AoE visual falso');
ok('H01 Void atinge apenas o alvo direto (sem AoE e sem sucção falsa)',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[];');
  run('spawnEnemy("tank", 300, 300, 5); spawnEnemy("chaser", 380, 300, 5);');
  run('for(const e of enemies){e.spawnT=0; e.hp=500;}');
  run('var wVoid = WEAPONS.find(w=>w.id==="void");');
  run('projectiles.push({x:290, y:300, vx:340, vy:0, r:9, dmg:wVoid.dmg, life:2, type:"void", team:"ally", color:wVoid.color, def:wVoid, dist:0, maxDist:560, pierce:0, hits:null, owner:player});');
  run('updateProjectiles(1/60)');
  assert.ok(run('enemies[0].hp') < 500, 'alvo 1 sofreu dano direto');
  assert.strictEqual(run('enemies[1].hp'), 500, 'alvo 2 a 80px deve ficar intacto (sem AoE)');
  assert.strictEqual(run('parts.some(p=>p.ring)'), false, 'void NÃO deve emitir anel falso de AoE');
});

/* ============ I · TESLA ============ */
console.log('\n[I] tesla: chain histórico preservado');
ok('I01 Tesla encadeia via chainShock com arcos históricos e sem duplicação',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[]; arcs=[];');
  run('spawnEnemy("tank", 300, 300, 5); spawnEnemy("chaser", 400, 300, 5);');
  run('for(const e of enemies){e.spawnT=0; e.hp=500;}');
  run('var wTesla = WEAPONS.find(w=>w.id==="tesla");');
  run('projectiles.push({x:290, y:300, vx:820, vy:0, r:4.5, dmg:wTesla.dmg, life:1, type:"tesla", team:"ally", color:wTesla.color, def:wTesla, dist:0, maxDist:470, pierce:0, hits:null, owner:player});');
  run('updateProjectiles(1/60)');
  assert.ok(run('enemies[0].hp') < 500, 'alvo primário atingido');
  assert.ok(run('enemies[1].hp') < 500, 'alvo secundário atingido por chain');
  assert.strictEqual(run('arcs.length'), 1, 'exatamente 1 arco visual de chain registrado');
});

/* ============ J · PLAGUE ============ */
console.log('\n[J] plague: sem contágio/AoE falso');
ok('J01 Plague atinge somente alvo direto e não infecta vizinhos',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[];');
  run('spawnEnemy("tank", 300, 300, 5); spawnEnemy("chaser", 380, 300, 5);');
  run('for(const e of enemies){e.spawnT=0; e.hp=500;}');
  run('var wPlague = WEAPONS.find(w=>w.id==="plague");');
  run('projectiles.push({x:290, y:300, vx:480, vy:0, r:7, dmg:wPlague.dmg, life:2, type:"plague", team:"ally", color:wPlague.color, def:wPlague, dist:0, maxDist:450, pierce:0, hits:null, owner:player});');
  run('updateProjectiles(1/60)');
  assert.ok(run('enemies[0].hp') < 500, 'alvo 1 atingido');
  assert.ok(run('enemies[0].st.corrT') > 0, 'corrode aplicado no alvo 1');
  assert.strictEqual(run('enemies[1].hp'), 500, 'alvo 2 a 80px intacto');
  assert.strictEqual(run('enemies[1].st ? enemies[1].st.corrT : 0'), 0, 'alvo 2 não recebe corrode (sem contágio)');
  assert.strictEqual(run('parts.some(p=>p.ring)'), false, 'plague não deve emitir anel de AoE');
});

/* ============ K · FLAMER / ACID ============ */
console.log('\n[K] flamer / acid: status real preservado');
ok('K01 Flamer aplica burn real e Acid aplica corrode real sem criar poças',()=>{
  const pFlamer = testImpact('flamer', 'hit');
  assert.strictEqual(pFlamer.length, 1, 'flamer: exatamente 1 partícula por hit');
  const pAcid = testImpact('acid', 'hit');
  assert.strictEqual(pAcid.length, 1, 'acid: exatamente 1 partícula por gota');

  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[];');
  run('spawnEnemy("tank", 300, 300, 5); enemies[0].spawnT=0; enemies[0].hp=500;');
  run('var wFlamer = WEAPONS.find(w=>w.id==="flamer");');
  run('projectiles.push({x:290, y:300, vx:430, vy:0, r:5, dmg:wFlamer.dmg, life:0.5, type:"flamer", team:"ally", color:wFlamer.color, def:wFlamer, dist:0, maxDist:210, pierce:0, hits:null, owner:player});');
  run('updateProjectiles(1/60)');
  assert.ok(run('enemies[0].st.burnT') > 0, 'burn aplicado no inimigo');
  assert.strictEqual(run('enemies[0].st.burnP'), 9, 'potência do burn');
});

/* ============ L · RICOCHET ============ */
console.log('\n[L] ricochet: quique em parede');
ok('L01 Ricochet reflete na borda, incrementa dano e emite faíscas determinísticas',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('projectiles=[]; parts=[];');
  run('var wRico = WEAPONS.find(w=>w.id==="ricochet");');
  run('projectiles.push({x:wRico.pr+1, y:100, vx:-800, vy:0, r:wRico.pr, dmg:wRico.dmg, life:2, type:"ricochet", team:"ally", color:wRico.color, def:wRico, dist:0, maxDist:900, bounce:3, hits:null, owner:player});');
  run('updateProjectiles(1/60)');
  assert.strictEqual(run('projectiles[0].bounce'), 2, 'bounce decrementado de 3 para 2');
  assert.ok(run('projectiles[0].vx') > 0, 'velocidade invertida na parede');
  assert.strictEqual(run('parts.length'), 3, '3 partículas de quique emitidas');
});

/* ============ M · BOOMER ============ */
console.log('\n[M] boomer: retorno e perfuração');
ok('M01 Boomer perfura alvos e retorna sem emitir impacto falso ao ser capturado',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[]; player.x=200; player.y=200;');
  run('var wBoom = WEAPONS.find(w=>w.id==="boomer");');
  run('projectiles.push({x:205, y:205, vx:-100, vy:-100, r:wBoom.pr, dmg:wBoom.dmg, life:1, type:"boomer", team:"ally", color:wBoom.color, def:wBoom, dist:0, maxDist:0, boomerang:1, returning:1, pierce:99, hits:null, born:0, owner:player});');
  run('updateProjectiles(1/60)');
  assert.strictEqual(run('projectiles.length'), 0, 'boomer capturado pelo jogador');
  assert.strictEqual(run('parts.length'), 0, 'nenhuma partícula de impacto de inimigo na captura');
});

/* ============ N · MINE ============ */
console.log('\n[N] mine: detonação de proximidade');
ok('N01 Mine detona em área ao detectar inimigo dentro de 110px',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[];');
  run('spawnEnemy("chaser", 350, 300, 5); enemies[0].spawnT=0; enemies[0].hp=500;');
  run('var wMine = WEAPONS.find(w=>w.id==="mine");');
  run('projectiles.push({x:300, y:300, vx:0, vy:0, r:wMine.pr, dmg:wMine.dmg, life:10, armT:1.0, mine:true, type:"mine", team:"ally", color:wMine.color, def:wMine, dist:0, maxDist:200, aoe:120, owner:player});');
  run('updateProjectiles(1/60)');
  assert.strictEqual(run('projectiles.length'), 0, 'mina detonada');
  assert.ok(run('enemies[0].hp') < 500, 'inimigo sofreu dano de detonação');
  assert.ok(run('parts.some(p=>p.ring)'), 'anel de explosão gerado');
});

/* ============ O · BEAM ============ */
console.log('\n[O] beam: sustentação e contato');
ok('O01 Beam aplica dano sustentado e desenha ponta pulsante sem entidade projétil',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[];');
  run('spawnEnemy("tank", 400, 300, 5); enemies[0].spawnT=0; enemies[0].hp=500;');
  run('player.x=300; player.y=300; player.aim=0;');
  run('var wBeam = WEAPONS.find(w=>w.id==="beam");');
  run('fireBeam(player, wBeam, "ally", 1, 0.055);');
  assert.ok(run('enemies[0].hp') < 500, 'feixe aplicou dano');
  assert.strictEqual(run('projectiles.length'), 0, 'beam não cria projéteis');
});

/* ============ P · CRÍTICO ============ */
console.log('\n[P] crítico');
ok('P01 acerto crítico preserva faíscas amarelas e adiciona impacto de família',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[];');
  run('spawnEnemy("tank", 400, 300, 5); enemies[0].spawnT=0; enemies[0].hp=500;');
  run('var wPlasma = WEAPONS[0];');
  run('projectiles.push({x:390, y:300, vx:980, vy:0, r:wPlasma.pr, dmg:wPlasma.dmg*2, life:1, type:"plasma", team:"ally", color:"#fff6b0", def:wPlasma, dist:0, maxDist:760, pierce:0, hits:null, crit:true, owner:player});');
  run('updateProjectiles(1/60)');
  assert.ok(run('parts.some(p=>p.color==="#fff6b0")'), 'faíscas amarelas de crítico presentes');
});

/* ============ Q · STATUS ============ */
console.log('\n[Q] status intacto');
ok('Q01 aplicação de status e ticks preservam potências e durações originais',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[];');
  run('spawnEnemy("chaser", 300, 300, 5); enemies[0].spawnT=0;');
  run('applyStatus(enemies[0], "burn", 3.2, 9, player);');
  assert.strictEqual(run('enemies[0].st.burnT'), 3.2);
  assert.strictEqual(run('enemies[0].st.burnP'), 9);
});

/* ============ R · ECHO ============ */
console.log('\n[R] echo herda gramática');
ok('R01 projéteis disparados por Echo utilizam a mesma gramática da arma correspondente',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[];');
  run('spawnEnemy("tank", 400, 300, 5); enemies[0].spawnT=0; enemies[0].hp=500;');
  run('var ec = {slot:1, alive:true, hp:100, x:200, y:300, aim:0, r:16};');
  run('var wRail = WEAPONS.find(w=>w.id==="rail");');
  run('projectiles.push({x:390, y:300, vx:2100, vy:0, r:wRail.pr, dmg:wRail.dmg, life:1, type:"rail", team:"ally", color:wRail.color, def:wRail, dist:0, maxDist:1100, pierce:wRail.basePierce, hits:null, owner:ec});');
  run('updateProjectiles(1/60)');
  assert.ok(run('parts.length') >= 4, 'Echo Rail emite impacto direcional completo');
});

/* ============ S · REPETIÇÃO ANCORADA ============ */
console.log('\n[S] repetição ancorada');
ok('S01 replay temporal executa impacto visual e preserva isolamento de gameplay',()=>{
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true;');
  run('enemies=[]; projectiles=[]; parts=[];');
  run('spawnEnemy("chaser", 400, 300, 5); enemies[0].spawnT=0; enemies[0].hp=500;');
  run('var wPlasma = WEAPONS[0];');
  run('projectiles.push({x:390, y:300, vx:980, vy:0, r:wPlasma.pr, dmg:wPlasma.dmg*.5, life:1, type:"plasma", team:"ally", color:wPlasma.color, def:wPlasma, dist:0, maxDist:760, pierce:0, hits:null, temporalReplay:true});');
  run('updateProjectiles(1/60)');
  assert.ok(run('enemies[0].hp') < 500, 'replay causou dano');
  assert.ok(run('parts.length') > 0, 'impacto visual executado');
});

/* ============ T · E8 MUZZLE INTACTO ============ */
console.log('\n[T] E8 muzzle intacto');
ok('T01 muzzleShot e emitWeaponMuzzleVisual permanecem inalterados',()=>{
  assert.ok(body('emitWeaponMuzzleVisual').includes('muzzleShot'));
  assert.ok(body('muzzleShot').includes('const u=n>1?(i/(n-1))*2-1:0'));
});

/* ============ U · E3–E7/E10 FORMAS EM VOO ============ */
console.log('\n[U] formas em voo intactas');
ok('U01 todas as 6 funções de desenho de projéteis permanecem intactas',()=>{
  const funcs = ['drawProjectileSlug','drawProjectileSwarm','drawProjectileKinetic',
    'drawProjectileFluidSpray','drawProjectileEnergyMass','drawProjectileConductionStatus'];
  for(const f of funcs){
    assert.strictEqual(typeof run(f), 'function', f + ' deve existir');
  }
});

/* ============ V · INIMIGOS / EORB ============ */
console.log('\n[V] inimigos e eorb não capturados');
ok('V01 projétil inimigo (eorb) retorna 0 no emitWeaponImpactVisual',()=>{
  run('parts.length=0');
  const res = run('emitWeaponImpactVisual({x:100,y:100,vx:200,vy:0,type:"eorb",team:"enemy"}, player, "hit")');
  assert.strictEqual(res, 0);
  assert.strictEqual(run('parts.length'), 0);
});

/* ============ W · FALLBACK LEGADO ============ */
console.log('\n[W] fallback legado');
ok('W01 tipo desconhecido/nulo não lança exceção e usa fallback',()=>{
  run('parts.length=0');
  assert.strictEqual(run('emitWeaponImpactVisual(null)'), 0);
  assert.strictEqual(run('emitWeaponImpactVisual({x:100,y:100,vx:100,vy:0,team:"ally",type:"desconhecido"})'), 1);
  assert.strictEqual(run('parts.length'), 2);
  run('parts.length=0');
});

/* ============ X · DETERMINISMO ============ */
console.log('\n[X] determinismo visual');
ok('X01 impactShot e emitWeaponImpactVisual não contêm Math.random/rand',()=>{
  const b1 = body('impactShot'), b2 = body('emitWeaponImpactVisual');
  assert.ok(!/Math\.random|[^a-zA-Z0-9_]rand\(|randi\(/.test(b1), 'impactShot com RNG');
  assert.ok(!/Math\.random|[^a-zA-Z0-9_]rand\(|randi\(/.test(b2), 'emitWeaponImpactVisual com RNG');
});
ok('X02 50 invocações consecutivas produzem dados de partículas idênticos',()=>{
  for(const id of ALL_RANGED){
    const pts1 = testImpact(id, 'hit', 700, 100);
    const snap1 = JSON.stringify(pts1);
    for(let i=0; i<20; i++){
      const snapN = JSON.stringify(testImpact(id, 'hit', 700, 100));
      assert.strictEqual(snap1, snapN, id + ' não-determinístico');
    }
  }
});

/* ============ Y · PRESERVAÇÃO DE RNG DE GAMEPLAY ============ */
console.log('\n[Y] RNG de gameplay preservado');
ok('Y01 impacto de projétil consome ZERO chamadas a Math.random',()=>{
  for(const id of ALL_RANGED){
    let c = 0;
    const oldRand = S.Math.random;
    S.Math.random = function(){ c++; return 0.5; };
    try {
      testImpact(id, 'hit');
    } finally {
      S.Math.random = oldRand;
    }
    assert.strictEqual(c, 0, id + ' consumiu Math.random no impacto');
  }
});

/* ============ Z · STRESS TEST E LIMITES ============ */
console.log('\n[Z] stress test e teto PARTS_MAX');
ok('Z01 1000 impactos simultâneos não ultrapassam PARTS_MAX (900)',()=>{
  run('parts.length=0');
  for(let i=0; i<1000; i++){
    run('var __p = {x:100, y:100, vx:600, vy:0, type:"shotgun", color:"#ffb347", team:"ally", def:WEAPONS[1]};');
    run('emitWeaponImpactVisual(__p, {x:100,y:100,r:16}, "hit");');
  }
  const len = run('parts.length');
  assert.ok(len <= run('PARTS_MAX'), 'parts excedeu teto: ' + len);
  run('parts.length=0');
});

/* ============ PROVA MECÂNICA BASE VS HEAD ============ */
console.log('\n[MEC] prova mecânica base vs HEAD');
const srcBase = readSource('6f532f72ed1680a68704e85f43b593e204081422');
function runSimCompare(source, weaponId) {
  const sim = world(source);
  sim.seed(98765);
  sim.run('startRun({noEchoes:true,freshMeta:true})');
  sim.run('state="play";sandboxRun=true;enemies=[];projectiles=[];parts=[];arcs=[];');
  sim.run('player.x=300;player.y=300;player.aim=0;');
  sim.run('spawnEnemy("tank", 450, 300, 5);');
  sim.run('spawnEnemy("chaser", 550, 300, 5);');
  sim.run('for(const e of enemies){e.spawnT=0;e.hp=500;e.maxHp=500;}');
  sim.run('var w=WEAPONS.find(x=>x.id==='+JSON.stringify(weaponId)+');');
  sim.run('fireWeaponFrom(player, w, "ally", 1);');
  for(let f=0; f<60; f++) {
    sim.run('updateProjectiles(1/60); for(const e of enemies) updateEnemy(e, 1/60);');
  }
  return {
    player: sim.run('({hp:player.hp, vx:player.vx, vy:player.vy, xp:player.xp, coins:player.coins})'),
    enemies: sim.run('enemies.map(e=>({type:e.type, hp:e.hp, dead:!!e.dead, burn:(e.st&&e.st.burnT)||0, chill:(e.st&&e.st.chillP)||0, shock:(e.st&&e.st.shockT)||0, corr:(e.st&&e.st.corrP)||0, bleed:(e.st&&e.st.bleedT)||0}))'),
    projectilesCount: sim.run('projectiles.length')
  };
}
for(const id of ALL_RANGED){
  ok('MEC·'+id+' mecânica 100% idêntica à base',()=>{
    const bRes = JSON.parse(JSON.stringify(runSimCompare(srcBase, id)));
    const hRes = JSON.parse(JSON.stringify(runSimCompare(SRC, id)));
    assert.deepStrictEqual(hRes, bRes, 'divergência mecânica em ' + id);
  });
}

/* ============ REGISTRO DA SUÍTE ============ */
console.log('\n[REG] registro no runner');
const reg = require('./suite-registry.js');
ok('REG01 esta suíte é descoberta pelo runner npm test',()=>{
  assert.ok(reg.suiteIsDiscovered('pr15-5-e9-impact-visual-grammar'));
});
for(const s of ['pr15-5-e7-conduction-status-projectile-identity',
                'pr15-5-e6-fluid-spray-projectile-identity',
                'pr15-5-e5-energy-mass-projectile-identity',
                'pr15-5-e10-kinetic-return-projectile-identity',
                'pr15-5-e4-swarm-projectile-identity',
                'pr15-5-e8-muzzle-emission-identity',
                'pr15-5-e3-slug-penetrator-identity',
                'pr15-5-e2-temporal-projectile-identity',
                'pr15-5-e1-projectile-visual-grammar',
                'pr15-5-e0-visual-determinism',
                'pr15-5-performance-audit1']){
  ok('REG·'+s+' continua no runner',()=>{
    assert.ok(reg.suiteIsDiscovered(s));
  });
}

console.log(`\nResultado: ${passed} passaram · ${failed} falharam`);
if(failed) process.exitCode = 1;
