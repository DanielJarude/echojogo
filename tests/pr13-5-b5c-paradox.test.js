'use strict';
/* =====================================================================
   TESTES — PR13.5 · B5-C · O PARADOXO
   Auditoria comportamental do chefe final: entrada, F1/F2, counterplay,
   telegraphs, hitboxes, cleanup, Continue, Sandbox, DEV e Fracture.

   A suíte usa o harness normalizado do B5-B-FIX.1. As verificações de fonte
   são apenas contratos complementares; o núcleo testa estado e execução real.
   ===================================================================== */
const assert=require('assert');
const {sandbox,T,vm,SRC,normalizeSource}=require('../audit_pr135/harness.js');
const X=code=>vm.runInContext(code,sandbox);
const DT=1/60;
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}
}
function seed(value){
  let x=value>>>0;
  return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
}
function fresh(){
  /* Cada caso começa sem fila de Ecos, sem DEV e sem entidades residuais. */
  sandbox.Math.random=seed(0xB5C2026);
  X('clearBossVictoryTimers();echoQueue=[];DEV_MODE=false;devTainted=false;sandboxRun=false;sandboxMode=false;boss=null;miniBoss=null;bossIntel=null;');
  T.setState('play');T.setPlayer(null);T.setEnemies([]);T.setProjectiles([]);T.setEchoes([]);T.setMiniBoss(null);
  T.setMoral({comp:0,greed:0,viol:0});
  T.startRun();
  const p=T.getPlayer();
  p.x=600;p.y=400;p.vx=0;p.vy=0;p.hp=1e9;p.maxHp=1e9;
  p.shield=0;p.shieldMax=0;p.shieldRegen=0;p.invT=0;p.dashT=0;
  T.setRunTime(0);T.setWave(20);T.setState('play');
  return p;
}
function spawn(mode){
  const p=fresh();
  X('spawnBoss()');
  const b=T.getBoss();
  b.spawnT=0;b.mode=mode||'ranged';b.x=900;b.y=400;b.vx=0;b.vy=0;
  b.beamCd=4.5;b.spiralT=3.2;b.shockT=5.5;b.gravT=6;b.dashCd=5;
  return {p,b};
}
function tickBoss(b,seconds,opts){
  opts=opts||{};
  const n=Math.round(seconds/DT),stats={beamStarts:0,spiralShots:0,shockStarts:0,gravStarts:0,
    dashStarts:0,shadowSpawns:0,maxProjectiles:0,maxShocks:0,maxGravs:0,maxShadows:0};
  let prevBeam=b.beamOn,prevShocks=b.shocks.length,prevGravs=b.gravs.length,prevDash=b.dashT;
  let prevShadows=T.getEnemies().filter(e=>e.type==='shadow').length;
  for(let i=0;i<n;i++){
    if(opts.keepClose){
      b.x=opts.x==null?700:opts.x;b.y=opts.y==null?400:opts.y;b.vx=0;b.vy=0;
    }
    const before=T.getProjectiles().length;
    X('updateBoss')(b,DT);
    for(const e of T.getEnemies().slice()){
      if(e===b)continue;
      if(e.type==='shadow')X('updateShadow')(e,DT);
      if(e.spawnT>0)e.spawnT-=DT;
    }
    X('updateProjectiles')(DT);
    const after=T.getProjectiles().length;
    const shadows=T.getEnemies().filter(e=>e.type==='shadow'&&!e.dead).length;
    if(b.beamOn>0&&prevBeam<=0)stats.beamStarts++;
    if(after>before)stats.spiralShots+=after-before;
    if(b.shocks.length>prevShocks)stats.shockStarts+=b.shocks.length-prevShocks;
    if(b.gravs.length>prevGravs)stats.gravStarts+=b.gravs.length-prevGravs;
    if(b.dashT>0&&prevDash<=0)stats.dashStarts++;
    if(shadows>prevShadows)stats.shadowSpawns+=shadows-prevShadows;
    stats.maxProjectiles=Math.max(stats.maxProjectiles,after);
    stats.maxShocks=Math.max(stats.maxShocks,b.shocks.length);
    stats.maxGravs=Math.max(stats.maxGravs,b.gravs.length);
    stats.maxShadows=Math.max(stats.maxShadows,shadows);
    prevBeam=b.beamOn;prevShocks=b.shocks.length;prevGravs=b.gravs.length;prevDash=b.dashT;prevShadows=shadows;
  }
  return stats;
}
function bossBlock(name){
  const i=SRC.indexOf(name);
  const j=SRC.indexOf('\nfunction ',i+name.length);
  return SRC.slice(i,j<0?SRC.length:j);
}
function finish(){
  console.log('\n'+(failed?failed+' FALHAS':passed+' PASSARAM · 0 FALHAS'));
  process.exit(failed?1:0);
}

console.log('\nECHO — PR13.5 · B5-C · O PARADOXO');
console.log('---------------------------------------------');

/* ================= ENTRADA / ESTADO ================= */
ok('B5C-1: onda 20 despacha somente O PARADOXO e limpa o encontro anterior',()=>{
  const p=fresh();
  T.setEnemies([{type:'chaser',x:20,y:20,dead:false}]);
  T.setProjectiles([{team:'enemy',x:20,y:20,life:3}]);
  X('beacon={x:20,y:20,life:5};spawnWave(20)');
  const b=T.getBoss();
  assert.ok(b&&b.type==='boss');
  assert.strictEqual(T.getEnemies().length,1);
  assert.strictEqual(T.getEnemies()[0],b);
  assert.strictEqual(T.getProjectiles().length,0);
  assert.strictEqual(X('beacon'),null);
  assert.strictEqual(T.getWave(),20);
  assert.ok(X('$("bosswrap").classList.contains("on")'));
  assert.ok(X('$("bossnm").textContent').replace(/\s/g, "").includes("PARADOXO"));
  assert.ok(X('$("bosssub").textContent').includes('FASE 1'));
  assert.ok(p.hp>0);
});
ok('B5C-2: estado inicial, HP, corpo, velocidade, dano, entrada e HUD são coerentes',()=>{
  const {b}=spawn('ranged');
  assert.strictEqual(b.maxHp,2200);
  assert.strictEqual(b.hp,2200);
  assert.deepStrictEqual([b.r,b.spd,b.dmg,b.phase,b.spawnT],[66,82,34,1,0]);
  for(const k of ['beamOn','beamCd','beamN','beamLen','spiralT','shockT','gravT','dashCd'])assert.ok(Number.isFinite(b[k]),k);
  assert.ok(Array.isArray(b.shocks)&&Array.isArray(b.gravs));
  assert.ok(/bossRoar\(\)/.test(SRC.slice(SRC.indexOf('function spawnBoss('),SRC.indexOf('function spawnShadowEcho('))));
  assert.ok(/ENTIDADE ADAPTATIVA · FASE 1/.test(SRC));
});

/* ================= FASE 1: EXECUÇÃO REAL ================= */
ok('B5C-3: Fase 1 ranged usa feixes, espiral e anéis de choque; não cria campos gravitacionais',()=>{
  const {b}=spawn('ranged');
  const s=tickBoss(b,24);
  assert.ok(s.beamStarts>=3,'feixes: '+s.beamStarts);
  assert.ok(s.spiralShots>=40,'espiral: '+s.spiralShots);
  assert.ok(s.shockStarts>=2,'choques: '+s.shockStarts);
  assert.strictEqual(s.gravStarts,0);
  assert.ok(s.maxProjectiles>0&&s.maxShocks>0);
  assert.ok(b.phase===1);
});
ok('B5C-4: Fase 1 melee usa campos gravitacionais e dash adaptativo; não cria anel de choque',()=>{
  const {b}=spawn('melee');
  const s=tickBoss(b,24,{keepClose:true});
  assert.ok(s.beamStarts>=3,'feixes: '+s.beamStarts);
  assert.ok(s.spiralShots>=40,'espiral: '+s.spiralShots);
  assert.ok(s.gravStarts>=2,'gravidade: '+s.gravStarts);
  assert.ok(s.dashStarts>=2,'dash: '+s.dashStarts);
  assert.strictEqual(s.shockStarts,0);
  assert.ok(s.maxGravs>0);
});
ok('B5C-5: threshold exato de 50% muda a fase uma vez e inicia a transição real',()=>{
  const {b}=spawn('ranged');
  assert.strictEqual(b.phase,1);
  b.hp=b.maxHp*.5;
  X('updateBoss')(b,DT);
  assert.strictEqual(b.phase,2);
  assert.strictEqual(T.getEnemies().filter(e=>e.type==='shadow').length,2);
  assert.strictEqual(b.beamN,4);assert.strictEqual(b.beamSpd,.85);
  assert.ok(Math.abs(b.spiralT-(1.4-DT))<1e-9);
  assert.ok(Math.abs(b.summonT-(1.2-DT))<1e-9);
  assert.ok(X('$("bosssub").textContent').includes('FASE 2'));
  assert.ok(X('$("banner").classList.contains("show")')||X('$("bosssub").textContent').includes('INVOCANDO'));
  const n=T.getEnemies().length;
  X('updateBoss')(b,DT);
  assert.strictEqual(T.getEnemies().length,n,'não duplica a transição');
});
ok('B5C-6: Fase 2 acrescenta sombras, aumenta padrões e mantém caps finitos',()=>{
  const {b}=spawn('ranged');
  b.hp=b.maxHp*.49;X('updateBoss')(b,DT);
  const s=tickBoss(b,30);
  assert.strictEqual(b.phase,2);
  assert.ok(s.beamStarts>=4,'feixes F2: '+s.beamStarts);
  assert.ok(s.spiralShots>=100,'espiral F2: '+s.spiralShots);
  assert.ok(s.maxShadows<=2&&s.maxShadows>=2);
  assert.ok(s.maxProjectiles<200);
  assert.ok(T.getEnemies().filter(e=>e.type==='shadow').length<=2);
});

/* ================= TELEGRAPH / HITBOX / COUNTERPLAY ================= */
ok('B5C-7: VISUAL → TELEGRAPH → HITBOX corresponde nos feixes, choque e gravidade',()=>{
  const ub=bossBlock('function updateBoss('),db=bossBlock('function drawBoss(');
  assert.ok(/perp<12\+p\.r/.test(ub),'largura do feixe usa o raio do jogador');
  assert.ok(/proj<e\.beamLen/.test(ub)&&/e\.beamLen/.test(db),'comprimento do feixe é desenhado e testado');
  assert.ok(/Math\.abs\(dp-s\.r\)<26/.test(ub)&&/arc\(s\.x,s\.y,s\.r/.test(db),'anel desenhado e testado no mesmo raio');
  assert.ok(/gd<g\.r/.test(ub)&&/g\.r\*\(0\.6\+0\.4\*k\)/.test(db),'campo gravitacional desenhado e com alcance lógico');
  const {p,b}=spawn('ranged');
  b.beamOn=.5;b.beamCd=99;b.beamN=1;b.beamAng=0;b.beamHit=0;b.spiralT=99;b.shockT=99;
  p.x=b.x+90;p.y=b.y+80;p.hp=1e9;X('updateBoss')(b,DT);const outside=p.hp;
  p.x=b.x+90;p.y=b.y+8;b.beamHit=0;X('updateBoss')(b,DT);assert.ok(p.hp<outside,'linha do feixe atinge dentro do telegraph');
  assert.ok(/p\.dashT<=0/.test(ub),'Dash é counterplay do feixe/anel');
});
ok('B5C-8: counterplay da Fase 1 é distinto e legível para ranged/melee',()=>{
  const ranged=spawn('ranged');const rs=tickBoss(ranged.b,12);
  const melee=spawn('melee');const ms=tickBoss(melee.b,12,{keepClose:true});
  assert.ok(rs.shockStarts>0&&rs.gravStarts===0,'ranged recebe pressão de aproximação');
  assert.ok(ms.gravStarts>0&&ms.shockStarts===0,'melee recebe reposicionamento/puxão');
  assert.ok(/toast\('ANEL DE CHOQUE — APROXIME-SE DO NÚCLEO'\)/.test(SRC));
  assert.ok(/toast\('CAMPO GRAVITACIONAL ANCORADO'\)/.test(SRC));
  assert.ok(/p\.dashT<=0/.test(SRC.slice(SRC.indexOf('function updateBoss('),SRC.indexOf('function updateShadow('))));
});
ok('B5C-9: cooldowns e durações são observáveis em runtime, sem ataque morto',()=>{
  const {b}=spawn('ranged');
  assert.strictEqual(b.beamCd,4.5);assert.strictEqual(b.beamOn,0);
  tickBoss(b,4.6);assert.ok(b.beamOn>0||b.beamCd>0);
  const {b:b2}=spawn('melee');const s=tickBoss(b2,20,{keepClose:true});
  assert.ok(s.gravStarts>=2,'gravidade reaparece');assert.ok(s.dashStarts>=2,'dash reaparece');
  assert.ok(/e\.beamCd-=dt/.test(SRC)&&/e\.spiralT-=dt/.test(SRC)&&/e\.shockT-=dt/.test(SRC)&&/e\.gravT-=dt/.test(SRC));
});

/* ================= CLEANUP / PERFORMANCE ================= */
ok('B5C-10: morte do boss limpa entidade, projéteis, sombras e estado transitório',()=>{
  const {b}=spawn('ranged');b.hp=b.maxHp*.49;X('updateBoss')(b,DT);
  assert.ok(T.getEnemies().some(e=>e.type==='shadow'));
  assert.ok(T.getProjectiles().length>=0);
  X('curAttacker=player');X('damageEnemy')(b,1e12,0,0,false);
  assert.strictEqual(T.getBoss(),null);
  assert.strictEqual(T.getEnemies().length,0);
  assert.strictEqual(T.getProjectiles().length,0);
  assert.strictEqual(T.getState(),'victory');
});
ok('B5C-11: callbacks da celebração não recriam partículas após saída da run',()=>{
  const {b}=spawn('ranged');
  const pending=[];
  sandbox.setTimeout=(fn,ms)=>{pending.push({fn,ms});return pending.length;};
  X('curAttacker=player');X('damageEnemy')(b,1e12,0,0,false);
  assert.ok(pending.length>=10,'timers registrados');
  X('clearRunEntities()');X('state="slotMenu"');
  assert.strictEqual(X('parts.length'),0);
  for(const t of pending)t.fn();
  assert.strictEqual(X('parts.length'),0,'nenhum VFX tardio');
  sandbox.setTimeout=()=>0;
});
ok('B5C-12: stress de 10 lutas controladas mantém budget transitório finito',()=>{
  let peakProjectiles=0,peakShadows=0,peakGravs=0;
  for(let run=0;run<10;run++){
    const {b}=spawn(run%2?'melee':'ranged');
    b.hp=b.maxHp*.49;X('updateBoss')(b,DT);
    const s=tickBoss(b,45,run%2?{keepClose:true}:{});
    peakProjectiles=Math.max(peakProjectiles,s.maxProjectiles);
    peakShadows=Math.max(peakShadows,s.maxShadows);
    peakGravs=Math.max(peakGravs,s.maxGravs);
    assert.ok(s.maxProjectiles<300,'projéteis run '+run);
    assert.ok(s.maxShadows<=2,'sombras run '+run);
    assert.ok(s.maxGravs<=1,'campos run '+run);
    X('clearRunEntities();state="slotMenu"');
  }
  assert.ok(peakProjectiles<300&&peakShadows===2);
  assert.ok(peakGravs<=1);
});

/* ================= SAVE / CONTINUE ================= */
ok('B5C-13: checkpoint do início da onda 20 não salva hazards nem boss parcial e Continue reconstrói F1 limpo',()=>{
  T.activateSlot(1);const p=fresh();
  X('spawnBoss()');const b=T.getBoss();b.spawnT=0;b.phase=2;b.hp=b.maxHp*.31;
  b.shocks=[{x:1,y:1,r:20,max:900,hit:false}];b.gravs=[{x:2,y:2,r:190,t:1,life:4.2}];
  const cp=T.smBuildCheckpoint('boss',20);const json=JSON.stringify(cp);
  assert.ok(!Object.prototype.hasOwnProperty.call(cp,'boss'),'boss não deve ser persistido');
  for(const key of ['"bossState"','"bossPhase"','"bossHp"','"shocks"','"gravs"','"bossProjectiles"','"shadows"'])
    assert.ok(!json.includes(key),key+' não deve ser persistido');
  assert.ok(T.captureCheckpoint('boss',20));
  X('boss=null;miniBoss=null;enemies=[];projectiles=[]');T.setPlayer(null);T.resumeRun();
  const restored=T.getBoss();
  assert.ok(restored&&restored.phase===1);
  assert.strictEqual(restored.hp,restored.maxHp);
  assert.strictEqual(T.getEnemies().filter(e=>e.type==='boss').length,1);
  assert.strictEqual(T.getEnemies().filter(e=>e.type==='shadow').length,0);
  assert.strictEqual(T.getProjectiles().length,0);
  assert.ok(p===T.getPlayer()||T.getPlayer(),'player restaurado');
});

/* ================= SANDBOX / DEV ================= */
ok('B5C-14: Sandbox pode spawnar, atravessar F1/F2, matar e sair sem contaminar save/meta',()=>{
  T.activateSlot(2);T.setState('title');X('sandboxRun=false;sandboxMode=false;');
  const save0=sandbox.localStorage.getItem('echoSave.v3');
  const meta0=JSON.stringify(T.getMeta());
  X('sandboxOpenSetup();sandboxCfg.char=0;sandboxCfg.wave=20;');
  assert.strictEqual(X('sandboxStart()'),true);
  const b=T.getBoss();assert.ok(b&&b.type==='boss');
  const p=T.getPlayer();p.hp=1e9;p.maxHp=1e9;p.x=600;p.y=400;b.spawnT=0;b.hp=b.maxHp*.49;
  X('updateBoss')(b,DT);assert.strictEqual(b.phase,2);
  X('curAttacker=player');X('damageEnemy')(b,1e12,0,0,false);
  assert.strictEqual(T.getState(),'victory');
  X('sandboxExit(true)');
  assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),save0);
  assert.strictEqual(JSON.stringify(T.getMeta()),meta0);
  assert.strictEqual(T.getBoss(),null);
});
ok('B5C-15: DEV existente permite spawn/debug/limpeza, permanece inerte fora do DEV e marca devTainted',()=>{
  fresh();X('DEV_MODE=false;devTainted=false');
  assert.strictEqual(X('DEV.spawnBoss()'),false);
  X('DEV_MODE=true;devTainted=false');
  const b=X('DEV.spawnBoss()');assert.ok(b&&T.getBoss());
  const dbg=X('DEV.bossDebug()');assert.ok(dbg&&dbg.phase===1&&typeof dbg.mode==='string');
  assert.strictEqual(X('devTainted'),true);
  assert.ok(X('DEV.clearEnemies()')>=1);
  assert.strictEqual(T.getBoss(),null);
  X('DEV_MODE=false;devTainted=false;clearBossVictoryTimers()');
});

/* ================= FRACTURE / MINI-BOSSES / RECOMPENSA ================= */
ok('B5C-16: Fracture Director e PARADOXO coexistem sem alterar a seleção dos 8 minibosses',()=>{
  assert.strictEqual(T.MINIBOSS.length,8);
  for(const id of ['herald','furnace','sentinel','brood','duelist','colossus','oracle','leech'])
    assert.strictEqual(typeof T.MB_UPDATERS[id],'function',id);
  const bossSrc=SRC.slice(SRC.indexOf('function spawnBoss('),SRC.indexOf('function updateShadow('));
  assert.ok(!/fracturePickMiniBoss|MB_UPDATERS|mbHazardAdd/.test(bossSrc));
  const {b}=spawn('ranged');
  const before=X('typeof fractureSnapshot==="function"?JSON.stringify(fractureSnapshot()):"none"');
  tickBoss(b,10);
  const after=X('typeof fractureSnapshot==="function"?JSON.stringify(fractureSnapshot()):"none"');
  assert.strictEqual(after,before);
});
ok('B5C-17: recompensa de Memória não é tocada pelo spawn/update do boss neste bloco',()=>{
  const {b}=spawn('ranged');
  const mem0=T.getMeta().mem;
  tickBoss(b,8);assert.strictEqual(T.getMeta().mem,mem0);
  const spawnSrc=SRC.slice(SRC.indexOf('function spawnBoss('),SRC.indexOf('function spawnShadowEcho('));
  const updateSrc=SRC.slice(SRC.indexOf('function updateBoss('),SRC.indexOf('function updateShadow('));
  assert.ok(!/meta\.mem|addResidues|player\.coins/.test(spawnSrc+updateSrc));
  /* B5.5: fórmula reescalonada (wave*1.2 + decaimento) — o guard continua
     verificando que a fórmula vive FORA da mecânica do boss. */
  assert.ok(/const mem=Math\.round\(\(wave\*1\.2/.test(SRC),'fórmula de recompensa permanece fora da mecânica do boss');
});

/* ================= PORTABILIDADE / CONTRATOS VISUAIS ================= */
ok('B5C-18: auditoria textual é portátil LF/CRLF e visualmente o boss é categoria superior',()=>{
  const lf=normalizeSource(SRC),crlf=lf.replace(/\n/g,'\r\n');
  for(const text of [lf,crlf]){
    const n=normalizeSource(text);
    assert.ok(n.includes('function spawnBoss()')&&n.includes('function updateBoss(')&&n.includes('function drawBoss('));
    assert.ok(n.includes('function bossEnterPhase2()')&&n.includes('spawnShadowEcho'));
  }
  const db=bossBlock('function drawBoss(');
  assert.ok(/e\.r/.test(db)&&/ctx\.createRadialGradient/.test(db)&&/beamLen/.test(db));
  assert.ok(/for\(const g of e\.gravs\)/.test(db)&&/for\(const s of e\.shocks\)/.test(db));
  assert.ok(/r:66/.test(SRC)&&/r:56/.test(SRC),'silhueta/r superior ao maior miniboss');
  assert.ok(/#ff4df0/.test(db)&&/#46e0ff/.test(db),'paleta própria');
});

finish();
