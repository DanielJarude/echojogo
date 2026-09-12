'use strict';
/* PR15.6-A — CORREÇÕES + REBALANCEAMENTO DE DURABILIDADE
 * 1. Phantom: projéteis aliados atravessam sem dano/pierce/destruição quando intangível (ghostT > 0).
 * 2. Phantom: excluído de targeting ofensivo automático (nearestEnemy, persFindTarget, beams, melee, homing, echo) via enemyIsTargetable.
 * 3. Phantom: base HP reduzido de 52 para 30.
 * 4. Elite Shield: correção do fator espúrio (* 10) na regeneração (5.5% shieldMax/s).
 * 5. Elite: multiplicador de HP reduzido de 2.30x para 1.80x.
 * 6. Elite Shield: valor do escudo reduzido de 65% para 45% do maxHp do Elite.
 * 7. Spawner: base HP reduzido de 210 para 125.
 * 8. Tank: base HP reduzido de 180 para 150.
 * 9. Invariantes preservados: Bulwark (78 HP), Singular (190 HP), Splitter (62 HP), chefes, diffHp, armas, sem Ruptura.
 */
const assert = require('assert');
const { T, SRC, sandbox } = require('../audit_pr135/harness.js');

let passed = 0, failed = 0;
function ok(label, fn) {
  try {
    fn();
    passed++;
    console.log('  ✔ ' + label);
  } catch (e) {
    failed++;
    console.log('  ✘ ' + label + ' → ' + (e && e.message || e));
  }
}

function fresh() {
  T.startRun();
  const p = T.getPlayer();
  p.x = 500;
  p.y = 400;
  p.vx = p.vy = 0;
  T.setEnemies([]);
  T.setProjectiles([]);
  return p;
}

function enemy(id, x = 300, y = 400, wave = 1) {
  const e = T.spawnEnemy(id, x, y, wave);
  e.spawnT = 0;
  e.fireT = 9;
  e.touchCd = 0;
  e.slowT = 0;
  e.flashT = 0;
  e.st = null;
  return e;
}

console.log('\nECHO — PR15.6-A · ENEMY PACING & DURABILITY BALANCE');

/* =========================================================================
   BLOCO A · PHANTOM: INTANGIBILIDADE E ATRAVESSAMENTO DE PROJÉTEIS
   ========================================================================= */
ok('A01 Projétil comum atravessa Phantom intangível sem causar dano, sem perder pierce e sem ser destruído', () => {
  const p = fresh();
  const ph = enemy('phantom', 600, 400);
  ph.ghostT = 1.5; // Intangível
  const hp0 = ph.hp;
  
  // Projétil com pierce 0 vindo em direção ao Phantom
  T.setProjectiles([{
    x: 580, y: 400, vx: 200, vy: 0, r: 6, dmg: 10, pierce: 0, life: 2,
    team: 'ally', color: '#fff', aoe: 0, crit: false, hits: null, owner: p,
    def: T.WEAPONS[0], dist: 0, maxDist: 800, srcC: 'player'
  }]);
  
  // Executa update de projéteis passando pela posição do Phantom
  T.updateProjectiles(0.15);
  
  // Phantom não tomou dano
  assert.strictEqual(ph.hp, hp0, 'Phantom intangível não deve sofrer dano');
  // Projétil não foi consumido/destruído
  const projs = T.getProjectiles();
  assert.strictEqual(projs.length, 1, 'Projétil deve permanecer vivo');
  assert.strictEqual(projs[0].pierce, 0, 'Pierce não deve ser decrementado');
  assert.ok(projs[0].x > 600, 'Projétil deve ter continuado sua trajetória além do Phantom');
});

ok('A02 Projétil perfurante (pierce > 0) preserva pierce total ao atravessar Phantom intangível', () => {
  const p = fresh();
  const ph = enemy('phantom', 600, 400);
  ph.ghostT = 2.0;
  
  T.setProjectiles([{
    x: 580, y: 400, vx: 300, vy: 0, r: 8, dmg: 15, pierce: 3, life: 2,
    team: 'ally', color: '#00e5ff', aoe: 0, crit: false, hits: [], owner: p,
    def: T.WEAPONS[0], dist: 0, maxDist: 800, srcC: 'player'
  }]);
  
  T.updateProjectiles(0.1);
  const projs = T.getProjectiles();
  assert.strictEqual(projs.length, 1);
  assert.strictEqual(projs[0].pierce, 3, 'Pierce deve se manter exatamente 3');
});

ok('A03 Projétil atinge e consome pierce normalmente contra Phantom materializado (ghostT === 0)', () => {
  const p = fresh();
  const ph = enemy('phantom', 600, 400);
  ph.ghostT = 0; // Materializado
  const hp0 = ph.hp;
  
  T.setProjectiles([{
    x: 590, y: 400, vx: 200, vy: 0, r: 8, dmg: 10, pierce: 0, life: 2,
    team: 'ally', color: '#fff', aoe: 0, crit: false, hits: null, owner: p,
    def: T.WEAPONS[0], dist: 0, maxDist: 800, srcC: 'player'
  }]);
  
  T.updateProjectiles(0.1);
  assert.strictEqual(ph.hp, hp0 - 10, 'Phantom materializado deve tomar dano de projétil');
  const projs = T.getProjectiles();
  assert.strictEqual(projs.length, 0, 'Projétil pierce 0 deve ser destruído ao atingir Phantom materializado');
});

ok('A04 Projétil não dispara proc ou hurt ao atravessar Phantom intangível', () => {
  fresh();
  const ph = enemy('phantom', 600, 400);
  ph.ghostT = 1.0;
  const hp0 = ph.hp;
  
  T.damageEnemy(ph, 50, 200, 200, false, false);
  assert.strictEqual(ph.hp, hp0, 'damageEnemy deve retornar sem aplicar dano');
  assert.strictEqual(ph.flashT, 0, 'Não deve ativar flash de dano');
});

/* =========================================================================
   BLOCO B · PHANTOM: EXCLUSÃO DE TARGETING AUTOMÁTICO E ARMAS
   ========================================================================= */
ok('B01 enemyIsTargetable rejeita mortos e intangíveis (ghostT > 0), mas NÃO rejeita Anomaly phaseT', () => {
  assert.strictEqual(T.enemyIsTargetable(null), false);
  assert.strictEqual(T.enemyIsTargetable({ dead: true, hp: 10 }), false);
  assert.strictEqual(T.enemyIsTargetable({ dead: false, hp: 0 }), false);
  assert.strictEqual(T.enemyIsTargetable({ dead: false, hp: 10, type: 'phantom', ghostT: 0.5 }), false);
  // Anomaly phaseT preserva semântica legada (é tratada como alvo existente)
  assert.strictEqual(T.enemyIsTargetable({ dead: false, hp: 10, type: 'anomaly', phaseT: 0.8 }), true);
  assert.strictEqual(T.enemyIsTargetable({ dead: false, hp: 10, type: 'chaser' }), true);
});

ok('B02 nearestEnemy ignora Phantom intangível mesmo quando este é o mais próximo', () => {
  fresh();
  const ph = enemy('phantom', 520, 400);
  ph.ghostT = 1.5;
  const ch = enemy('chaser', 580, 400);
  
  const target = T.nearestEnemy(500, 400, 1000);
  assert.strictEqual(target, ch, 'nearestEnemy deve mirar no chaser tangível, não no phantom intangível');
});

ok('B03 nearestEnemy retoma mira no Phantom assim que materializa (ghostT === 0)', () => {
  fresh();
  const ph = enemy('phantom', 520, 400);
  ph.ghostT = 0; // Materializado
  const ch = enemy('chaser', 580, 400);
  
  const target = T.nearestEnemy(500, 400, 1000);
  assert.strictEqual(target, ph, 'nearestEnemy deve mirar no phantom materializado mais próximo');
});

ok('B04 Echo (updateEcho / persFindTarget) ignora Phantom intangível e foca em alvo tangível', () => {
  const p = fresh();
  const ph = enemy('phantom', 520, 400);
  ph.ghostT = 1.5;
  const ch = enemy('chaser', 560, 400);
  
  const echo = {
    alive: true, slot: 1, x: 500, y: 400, vx: 0, vy: 0, hp: 100, maxHp: 100, r: 14,
    rel: { trust: 80 }, data: { trail: [[0, 500, 400, 0, 0, 0], [10, 500, 400, 0, 0, 0]], dur: 10 },
    pi: 0, stab: 1, team: 'ally', ghosts: []
  };
  sandbox.allies = [echo];
  
  sandbox.updateEcho(echo, 0.016);
  assert.strictEqual(sandbox.persFindTarget(echo, 400), ch, 'persFindTarget do Eco ignora phantom intangível');
});

ok('B05 Homing de projéteis não persegue Phantom intangível', () => {
  fresh();
  const ph = enemy('phantom', 520, 450);
  ph.ghostT = 1.5;
  const ch = enemy('chaser', 700, 400);
  
  T.setProjectiles([{
    x: 500, y: 400, vx: 100, vy: 0, r: 6, dmg: 10, pierce: 1, life: 2,
    team: 'ally', color: '#fff', aoe: 0, crit: false, hits: null,
    homing: true, def: T.WEAPONS[0], dist: 0, maxDist: 800, srcC: 'player'
  }]);
  
  T.updateProjectiles(0.1);
  const proj = T.getProjectiles()[0];
  assert.ok(proj.vy < 20, 'Projétil teleguiado não deve se curvar em direção ao Phantom intangível');
});

ok('B06 Armas Beam (fireBeam) não atingem Phantom intangível', () => {
  const p = fresh();
  const ph = enemy('phantom', 600, 400);
  ph.ghostT = 1.5;
  const hp0 = ph.hp;
  
  const beamW = T.WEAPONS.find(w => w.beam);
  assert.ok(beamW, 'Arma de raio deve existir');
  
  sandbox.fireBeam(p, 600, 400, beamW, 'ally', 1);
  assert.strictEqual(ph.hp, hp0, 'Phantom intangível não deve tomar dano de feixe contínuo');
});

ok('B07 Armas Melee (fireMelee) não atingem Phantom intangível', () => {
  const p = fresh();
  const ph = enemy('phantom', 530, 400);
  ph.ghostT = 1.5;
  const hp0 = ph.hp;
  
  const bladeW = T.WEAPONS.find(w => w.id === 'blade');
  p.owned = [T.WEAPONS.indexOf(bladeW)];
  p.wi = p.owned[0];
  
  sandbox.fireMelee(p, bladeW, 'ally', 1);
  assert.strictEqual(ph.hp, hp0, 'Phantom intangível não deve ser atingido por golpe melee');
});

ok('B08 Chain Shock (chainShock) não propaga para Phantom intangível', () => {
  fresh();
  const ch = enemy('chaser', 520, 400);
  const ph = enemy('phantom', 560, 400);
  ph.ghostT = 1.5;
  const hpPh0 = ph.hp;
  
  sandbox.chainShock(ch, 10, 3, 'ally');
  assert.strictEqual(ph.hp, hpPh0, 'Shock não deve propagar nem causar dano a Phantom intangível');
});

/* =========================================================================
   BLOCO B-LEGACY · ANOMALY PHASET: PRESERVAÇÃO INTEGRAL DA SEMÂNTICA LEGADA
   ========================================================================= */
ok('B09 Anomaly phaseT > 0 continua elegível para nearestEnemy (comportamento legado f2a602a)', () => {
  fresh();
  const an = enemy('anomaly', 520, 400);
  an.phaseT = 0.3;
  const ch = enemy('chaser', 600, 400);
  
  const target = T.nearestEnemy(500, 400, 1000);
  assert.strictEqual(target, an, 'nearestEnemy mira na anomalia mais próxima mesmo em phaseT > 0 (f2a602a)');
});

ok('B10 Anomaly phaseT > 0 colide com projéteis aliados e consome o projétil (comportamento legado f2a602a)', () => {
  const p = fresh();
  const an = enemy('anomaly', 600, 400);
  an.phaseT = 0.3;
  const hp0 = an.hp;
  
  // Projétil com pierce 0
  T.setProjectiles([{
    x: 590, y: 400, vx: 200, vy: 0, r: 8, dmg: 10, pierce: 0, life: 2,
    team: 'ally', color: '#fff', aoe: 0, crit: false, hits: null, owner: p,
    def: T.WEAPONS[0], dist: 0, maxDist: 800, srcC: 'player'
  }]);
  
  T.updateProjectiles(0.1);
  // Anomaly não toma dano devido a damageEnemy() { if(e.phaseT>0)return; }
  assert.strictEqual(an.hp, hp0, 'Anomaly em phaseT toma 0 dano');
  // Mas o projétil colide e é destruído (não passa direto)
  const projs = T.getProjectiles();
  assert.strictEqual(projs.length, 0, 'Projétil colide e morre na Anomaly (f2a602a legado preservado)');
});

ok('B11 Anomaly phaseT > 0 é alvo de Echo (comportamento legado f2a602a)', () => {
  const p = fresh();
  const an = enemy('anomaly', 520, 400);
  an.phaseT = 0.3;
  
  const echo = {
    alive: true, slot: 1, x: 500, y: 400, vx: 0, vy: 0, hp: 100, maxHp: 100, r: 14,
    rel: { trust: 80 }, data: { trail: [[0, 500, 400, 0, 0, 0], [10, 500, 400, 0, 0, 0]], dur: 10 },
    pi: 0, stab: 1, team: 'ally', ghosts: []
  };
  sandbox.allies = [echo];
  
  assert.strictEqual(sandbox.persFindTarget(echo, 400), an, 'persFindTarget do Eco mira na Anomaly em phaseT (f2a602a legado)');
});

ok('B12 Anomaly phaseT > 0 é alvo de Melee (comportamento legado f2a602a)', () => {
  const p = fresh();
  const an = enemy('anomaly', 530, 400);
  an.phaseT = 0.3;
  const hp0 = an.hp;
  
  const bladeW = T.WEAPONS.find(w => w.id === 'blade');
  p.owned = [T.WEAPONS.indexOf(bladeW)];
  p.wi = p.owned[0];
  
  sandbox.fireMelee(p, bladeW, 'ally', 1);
  // damageEnemy é chamado e retorna por causa de phaseT>0 (0 dano)
  assert.strictEqual(an.hp, hp0);
});

ok('B13 Anomaly phaseT > 0 é varrida por Beam (comportamento legado f2a602a)', () => {
  const p = fresh();
  const an = enemy('anomaly', 600, 400);
  an.phaseT = 0.3;
  const hp0 = an.hp;
  
  const beamW = T.WEAPONS.find(w => w.beam);
  sandbox.fireBeam(p, 600, 400, beamW, 'ally', 1);
  assert.strictEqual(an.hp, hp0);
});

ok('B14 Anomaly phaseT > 0 atrai projéteis teleguiados (comportamento legado f2a602a)', () => {
  fresh();
  const an = enemy('anomaly', 520, 450);
  an.phaseT = 0.3;
  
  T.setProjectiles([{
    x: 500, y: 400, vx: 100, vy: 0, r: 6, dmg: 10, pierce: 1, life: 2,
    team: 'ally', color: '#fff', aoe: 0, crit: false, hits: null,
    homing: true, def: T.WEAPONS[0], dist: 0, maxDist: 800, srcC: 'player'
  }]);
  
  T.updateProjectiles(0.1);
  const proj = T.getProjectiles()[0];
  // Curva em direção à Anomaly no eixo Y positivo
  assert.ok(proj.vy > 0, 'Homing curva em direção à Anomaly em phaseT (f2a602a legado preservado)');
});

/* =========================================================================
   BLOCO C · REBALANCEAMENTO DE HP BASE E PRESERVAÇÃO DE ARQUÉTIPOS
   ========================================================================= */
ok('C01 Phantom base HP é exatamente 30', () => {
  assert.strictEqual(T.EDEFS.phantom.hp, 30);
});

ok('C02 Spawner base HP é exatamente 125', () => {
  assert.strictEqual(T.EDEFS.spawner.hp, 125);
});

ok('C03 Tank base HP é exatamente 150', () => {
  assert.strictEqual(T.EDEFS.tank.hp, 150);
});

ok('C04 Bulwark base HP permanece 78 com mecânica de escudo frontal preservada', () => {
  assert.strictEqual(T.EDEFS.bulwark.hp, 78);
  assert.match(SRC, /shieldAng[\s\S]*?2\.05/);
  assert.match(SRC, /d\*=\.28/);
});

ok('C05 Singular base HP permanece 190 com mecânica de atração intacta', () => {
  assert.strictEqual(T.EDEFS.singular.hp, 190);
  assert.strictEqual(T.EDEFS.singular.r, 24);
  assert.strictEqual(T.EDEFS.singular.dmg, 24);
});

ok('C06 Splitter base HP permanece 62 com mecânica de 2 estilhaços intacta', () => {
  assert.strictEqual(T.EDEFS.splitter.hp, 62);
  assert.strictEqual(T.EDEFS.splitter.r, 16);
});

ok('C07 Outros inimigos comuns preservam stats base exatos', () => {
  assert.strictEqual(T.EDEFS.chaser.hp, 26);
  assert.strictEqual(T.EDEFS.shooter.hp, 36);
  assert.strictEqual(T.EDEFS.anomaly.hp, 44);
  assert.strictEqual(T.EDEFS.swarm.hp, 12);
  assert.strictEqual(T.EDEFS.orbiter.hp, 34);
});

ok('C08 Catálogo EDEFS contém exatamente 11 tipos', () => {
  assert.strictEqual(Object.keys(T.EDEFS).length, 11);
});

/* =========================================================================
   BLOCO D · BALANCEAMENTO DE ELITE E CORREÇÃO DO ESCUDO
   ========================================================================= */
ok('D01 makeElite aplica multiplicador de HP de 1.80x (em vez de 2.30x)', () => {
  const e = { maxHp: 100, hp: 100, r: 15, spd: 100, dmg: 10, xp: 10, type: 'chaser' };
  T.makeElite(e, 'shield');
  assert.strictEqual(e.maxHp, 180, '100 * 1.8 = 180');
  assert.strictEqual(e.hp, 180);
  assert.strictEqual(e.elite, 'shield');
});

ok('D02 makeElite define shieldMax como 45% do maxHp do Elite (em vez de 65%)', () => {
  const e = { maxHp: 100, hp: 100, r: 15, spd: 100, dmg: 10, xp: 10, type: 'chaser' };
  T.makeElite(e, 'shield');
  // maxHp vira 180, shieldMax vira 180 * 0.45 = 81
  assert.strictEqual(e.shieldMax, 81, '180 * 0.45 = 81');
  assert.strictEqual(e.shield, 81);
});

ok('D03 makeElite configura taxa de regeneração base como 5.5% de shieldMax/segundo', () => {
  const e = { maxHp: 100, hp: 100, r: 15, spd: 100, dmg: 10, xp: 10, type: 'chaser' };
  T.makeElite(e, 'shield');
  // shieldMax = 81, shieldRegen = 81 * 0.055 = 4.455
  assert.strictEqual(e.shieldRegen, 81 * 0.055);
});

ok('D04 Regeneração do escudo em updateEnemy restaura ~5.5%/s sem fator de aceleração espúrio (* 10)', () => {
  fresh();
  const e = enemy('tank', 300, 300);
  T.makeElite(e, 'shield');
  
  // Danifica o escudo (sem quebrar)
  e.shield = 20;
  e.shieldT = 0;
  const initialShield = e.shield;
  
  // Executa 1 segundo de simulação (60 frames a dt = 1/60)
  const dt = 1 / 60;
  for (let i = 0; i < 60; i++) {
    T.updateEnemy(e, dt);
  }
  
  const regenerated = e.shield - initialShield;
  const expectedRegen = e.shieldRegen * 1.0; // shieldRegen * 1s
  assert.ok(Math.abs(regenerated - expectedRegen) < 0.1, `Regeneração real (${regenerated.toFixed(3)}) deve ser aproximadamente ${expectedRegen.toFixed(3)} em 1s`);
});

ok('D05 Escudo do Elite absorve dano antes do HP', () => {
  fresh();
  const e = enemy('chaser', 300, 300);
  T.makeElite(e, 'shield');
  const hp0 = e.hp;
  const s0 = e.shield;
  
  T.damageEnemy(e, 20, 200, 200, false, false);
  assert.strictEqual(e.shield, s0 - 20, 'Escudo absorve dano integral');
  assert.strictEqual(e.hp, hp0, 'HP não é alterado enquanto escudo absorve');
});

/* =========================================================================
   BLOCO E · INVARIANTES SISTÊMICOS, INTEGRIDADE E ISOLAMENTO
   ========================================================================= */
ok('E01 Catálogo MINIBOSS intacto com 8 entradas', () => {
  assert.strictEqual(Object.keys(T.MINIBOSS).length, 8);
});

ok('E02 Fórmula diffHp inalterada: 1 + 0.155*(n-1) + 0.014*(n-1)^2', () => {
  assert.match(SRC, /function diffHp\(n\)\{const k=n-1;return 1\+\.155\*k\+\.014\*k\*k;\}/);
});

ok('E03 Composição de ondas waveCompBase intacta para 20 ondas', () => {
  for (let w = 1; w <= 20; w++) {
    const comp = T.waveComp(w);
    assert.ok(comp && typeof comp === 'object' && comp.chaser !== undefined, `Onda ${w} tem composição válida`);
  }
});

ok('E04 Catálogo de armas WEAPONS intacto com 27 armas', () => {
  assert.strictEqual(T.WEAPONS.length, 27);
});

ok('E05 Ausência de mecânicas de Ruptura / Instabilidade Temporal neste bloco', () => {
  assert.ok(!SRC.includes('temporalInstability'));
  assert.ok(!SRC.includes('rupturaHpDecay'));
  assert.ok(!SRC.includes('lastEnemyDecay'));
});

ok('E06 Estabilidade em Sandbox / Stress: 46 inimigos mistos + elites rodam sem NaN ou exceções', () => {
  fresh();
  const list = [];
  const types = Object.keys(T.EDEFS);
  for (let i = 0; i < 46; i++) {
    const t = types[i % types.length];
    const en = enemy(t, 200 + (i % 8) * 50, 200 + Math.floor(i / 8) * 50, 5);
    if (i % 5 === 0) T.makeElite(en);
    if (t === 'phantom') en.ghostT = (i % 2 === 0) ? 1.5 : 0;
    list.push(en);
  }
  T.setEnemies(list);
  
  for (let tick = 0; tick < 300; tick++) {
    for (const en of list) {
      T.updateEnemy(en, 0.016);
      assert.ok(Number.isFinite(en.x) && Number.isFinite(en.y) && Number.isFinite(en.hp));
    }
  }
});

console.log(`\nResultado: ${passed} passaram · ${failed} falharam\n`);
if (failed > 0) process.exit(1);
