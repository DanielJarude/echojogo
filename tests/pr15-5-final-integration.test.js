'use strict';
/*
 * PR15.5-FINAL — integração do Visual Overhaul.
 *
 * Esta suíte não reaudita cada família (isso já pertence a E0–E9). Ela
 * verifica as fronteiras que podem quebrar quando os blocos são usados
 * juntos: inventário → dispatch → voo/temporal → muzzle/impacto, exceções
 * de Beam/eorb, origem Echo/Repetição, pure render, pools e sobrevivência
 * do pipeline de frame/save.
 */
const assert=require('assert');
const {world,readSource,measure}=require('../audit_pr155/performance_benchmark');

const SRC=readSource();
const h=world(SRC),run=h.run,S=h.sandbox,T=S.__t;
let passed=0,failed=0;
function ok(name,fn){
  try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+' → '+(e&&e.stack||e));}
}
function body(name){
  const m=SRC.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(m,'função não encontrada: '+name);return m[0];
}
function opNames(code){
  return measure(h,code).canvas;
}
function fresh(){
  run('startRun({noEchoes:true,freshMeta:true}); state="play"; sandboxRun=true; parts.length=0; arcs.length=0; projectiles.length=0;');
}
const RANGED=['plasma','shotgun','orb','flamer','rail','smg','cryo','tesla','acid','nail','boomer','homing','mine','sniper','void','ricochet','gatling','prism','plague'];
const EXPECTED={
  slug:['rail','sniper','nail'],
  energy:['plasma','orb','void','cryo'],
  fluid:['flamer','acid'],
  swarm:['smg','shotgun','homing','prism'],
  conduct:['tesla','plague'],
  kinetic:['ricochet','boomer','gatling','mine']
};

console.log('\nECHO — PR15.5-FINAL · INTEGRAÇÃO DO VISUAL OVERHAUL');

console.log('\n[A] inventário e dispatch');
ok('A01 catálogo contém exatamente as 19 armas de projétil esperadas',()=>{
  const ids=Array.from(run('WEAPONS.filter(w=>!w.melee&&!w.beam).map(w=>w.id)'));
  assert.deepStrictEqual(ids,RANGED);
});
ok('A02 o catálogo possui uma única sustentada e sete melee fora do dispatcher',()=>{
  assert.strictEqual(run('WEAPONS.filter(w=>w.beam).map(w=>w.id).join(",")'),'beam');
  assert.deepStrictEqual(Array.from(run('WEAPONS.filter(w=>w.melee).map(w=>w.id)')),
    ['blade','scythe','hammer','katana','chains','gaunt','glaive']);
});
ok('A03 as seis famílias cobrem cada arma uma única vez',()=>{
  const seen=[];
  for(const [name,ids] of Object.entries(EXPECTED)){
    for(const id of ids){
      assert.notStrictEqual(T.visualFamilyForProjectile({type:id}),T.PVF.LEGACY,id+' legacy');
      seen.push(id);
    }
  }
  assert.deepStrictEqual(seen.slice().sort(),RANGED.slice().sort());
  assert.strictEqual(new Set(seen).size,19);
});
ok('A04 Beam não possui família nem entidade projectile',()=>{
  assert.strictEqual(run('PROJ_FAMILY.beam'),undefined);
  assert.strictEqual(run('WEAPONS.find(w=>w.id==="beam").beam'),true);
  assert.ok(/if\(def\.beam\)\{fireBeam\(/.test(body('fireWeaponFrom')));
  assert.ok(!/type:\s*def\.id/.test(body('fireBeam')));
});
ok('A05 eorb e tipos futuros ficam fora das famílias do jogador',()=>{
  assert.strictEqual(T.visualFamilyForProjectile({type:'eorb'}),T.PVF.LEGACY);
  assert.strictEqual(T.visualFamilyForProjectile({type:'future_weapon'}),T.PVF.LEGACY);
  for(const p of [null,undefined,{}, {type:null},{type:123},{type:''}])
    assert.strictEqual(T.visualFamilyForProjectile(p),T.PVF.LEGACY);
});
ok('A06 fallback legacy continua no último ramo do dispatcher',()=>{
  const b=body('drawProjectile');
  assert.ok(b.includes('drawProjectileLegacyLine'));
  assert.ok(b.indexOf('drawProjectileLegacyLine')>b.indexOf('drawProjectileConductionStatus'));
  assert.strictEqual(T.drawProjectileLegacyLine({x:100,y:100,vx:0,vy:0,r:4,color:'#fff',type:'future'}),undefined);
});

console.log('\n[B] fronteira E8 → voo → temporal → E9');
ok('B01 cada arma conhecida tem muzzle, forma em voo e impacto despachável',()=>{
  fresh();
  for(const id of RANGED){
    run('var __w=WEAPONS.find(w=>w.id==='+JSON.stringify(id)+');');
    run('var __p={x:200,y:200,vx:600,vy:0,r:__w.pr,dmg:__w.dmg,life:1,type:'+JSON.stringify(id)+',team:"ally",color:__w.color,def:__w,dist:0,maxDist:900,pierce:0,hits:null,owner:player,born:0};');
    assert.ok(run('parts.length=0,emitWeaponMuzzleVisual(player,__w),parts.length')>0,id+' muzzle');
    assert.ok(opNames('drawProjectile(__p)').paths>0,id+' voo');
    assert.strictEqual(run('emitWeaponImpactVisual(__p,{x:200,y:200,r:10},"hit")'),1,id+' impacto');
    run('parts.length=0');
  }
});
ok('B02 muzzle e impacto são eventos separados do renderer de voo',()=>{
  const fire=body('fireWeaponFrom'),upd=body('updateProjectiles');
  assert.ok(fire.indexOf('emitWeaponMuzzleVisual')>fire.indexOf('projectiles.push'));
  assert.ok(/damageEnemy\(e,dmgOut[\s\S]*?onProjectileHit\(p,e,dmgOut\)[\s\S]*?emitWeaponImpactVisual\(p,e/.test(upd));
  assert.ok(!body('drawProjectile').includes('emitWeaponMuzzleVisual'));
  assert.ok(!body('drawProjectile').includes('emitWeaponImpactVisual'));
});
ok('B03 impacto linear não compete com Orb e Mine especiais',()=>{
  const upd=body('updateProjectiles'),imp=body('emitWeaponImpactVisual');
  assert.ok(/if\(p\.type==='orb'\)\{explodeOrb\(p\);dead=true;\}/.test(upd));
  assert.ok(/if\(trig\)\{detonateSpecial\(p\)/.test(upd));
  assert.ok(/id==='orb'\)\s*return 1/.test(imp));
  assert.ok(/id==='mine'\)\s*return 1/.test(imp));
});
ok('B04 camada temporal é aplicada após a forma base e antes do reset de Canvas',()=>{
  const b=body('drawProjectile');
  assert.ok(b.indexOf('drawProjectileTemporalLayer')>b.indexOf('drawProjectileConductionStatus'));
  assert.ok(b.lastIndexOf('ctx.globalAlpha=1')>b.indexOf('drawProjectileTemporalLayer'));
  assert.strictEqual(T.projectileTemporalMode({type:'plasma',owner:null}),T.PTM.NONE);
  assert.strictEqual(T.projectileTemporalMode({type:'plasma',temporalReplay:true}),T.PTM.REPLAY);
  assert.strictEqual(T.projectileTemporalMode({type:'eorb',owner:{slot:1,data:{}}}),T.PTM.ECHO);
});

console.log('\n[C] Beam, inimigos, Echo e Repetição');
ok('C01 caminhos inimigos não emitem impacto visual de arma do jogador',()=>{
  const imp=body('emitWeaponImpactVisual');
  assert.ok(/p\.team==='enemy'/.test(imp));
  assert.ok(/p\.type==='eorb'/.test(imp));
  assert.ok(body('fireBeam').includes('damageEnemy'));
  assert.ok(!body('fireBeam').includes('emitWeaponImpactVisual'));
});
ok('C02 Echo usa o mesmo type/família e somente metadata acrescenta camada',()=>{
  const tm=body('projectileTemporalMode'),draw=body('drawProjectile');
  assert.ok(/o\.slot>0&&o\.data/.test(tm));
  assert.ok(draw.includes('projectileTemporalMode(p)'));
  assert.ok(!/drawEchoProjectile|drawProjectileEcho/.test(SRC));
});
ok('C03 Repetição mantém contrato mecânico separado de Echo/ressonância/memória',()=>{
  const cap=body('temporalActionCapture'),replay=body('replayTemporalAction'),tryIt=body('temporalReplayTry');
  for(const b of [cap,replay,tryIt]){
    assert.ok(!/echoes|trust|Resson|Memory|memoryDirector|resonance/i.test(b),b.slice(0,30));
  }
  assert.ok(SRC.includes('const TEMPORAL_ACTION_WINDOW=5'));
  assert.ok(SRC.includes('const TEMPORAL_REPLAY_COOLDOWN=6'));
  assert.ok(SRC.includes('const TEMPORAL_REPLAY_DAMAGE=.50'));
});
ok('C04 replay visual cria apenas projectile temporal e não muzzle/impacto duplicado',()=>{
  fresh();
  run('var __a={weaponId:"plasma",x:200,y:200,angle:0,state:"consumed",payload:{damage:11,projectileCount:1,projectileSpeed:980,range:760,spread:0,projectileRadius:4,pierce:0}};');
  const before=run('parts.length');
  assert.strictEqual(run('replayTemporalAction(__a)'),1);
  assert.strictEqual(run('projectiles.length'),1);
  assert.strictEqual(run('parts.length'),before);
  assert.strictEqual(run('projectiles[0].temporalReplay'),true);
});

console.log('\n[D] determinismo e pure render');
ok('D01 helpers de forma/impacto/muzzle não consomem RNG',()=>{
  const names=['drawProjectileSlug','drawProjectileEnergyMass','drawProjectileFluidSpray',
    'drawProjectileSwarm','drawProjectileKinetic','drawProjectileConductionStatus',
    'drawProjectileTemporalLayer','muzzleShot','impactShot','emitWeaponImpactVisual'];
  for(const n of names){
    const b=body(n);
    assert.ok(!/Math\.random|\brand\(|\brand[ij]\(/.test(b),n+' consumiu RNG');
  }
});
ok('D02 o único tempo visual direto do voo é a pulsação histórica determinística',()=>{
  const b=body('drawProjectile');
  assert.ok(b.includes('projectileRangeFade'));
  assert.ok(!/Date\.now|performance\.now|Math\.random/.test(b));
  assert.ok(body('drawProjectileOrbShape').includes('runTime'));
});
ok('D03 render de projétil não muta p nem coleções mecânicas',()=>{
  fresh();
  run('var __p={x:200,y:200,vx:600,vy:0,r:4,dmg:11,life:1,type:"plasma",team:"ally",color:"#46e0ff",def:WEAPONS[0],dist:0,maxDist:900,pierce:0,hits:null,owner:player,born:0}; var __snap=JSON.stringify(__p); var __lens=[projectiles.length,parts.length,arcs.length,enemies.length];');
  S.__ctxLog=[];run('drawProjectile(__p)');S.__ctxLog=null;
  assert.strictEqual(run('JSON.stringify(__p)'),run('__snap'));
  assert.deepStrictEqual(run('[projectiles.length,parts.length,arcs.length,enemies.length]'),run('__lens'));
});
ok('D04 emissão/impacto só inserem no pool visual e respeitam PARTS_MAX',()=>{
  assert.strictEqual(run('PARTS_MAX'),900);
  assert.strictEqual(run('PARTS_POOL_MAX'),900);
  assert.ok(/partTake\(\)/.test(body('muzzleShot')));
  assert.ok(/partTake\(\)/.test(body('impactShot')));
  const trimStart=SRC.indexOf('function trimParts');
  assert.ok(trimStart>=0&&SRC.indexOf('partRelease(parts[i])',trimStart)>trimStart);
  fresh();
  run('spawnParticles(100,100,"#fff",1200,100,.1,2)');
  assert.ok(run('parts.length')<=900);
});

console.log('\n[E] pipeline de frame, modais, resize e save');
ok('E01 render + HUD sobrevivem ao caminho auditado do frame',()=>{
  fresh();
  run('resize();render();updateHUD(true);');
  assert.ok(run('Number.isFinite(vw)&&Number.isFinite(vh)'));
  assert.ok(/try\{render\(\);\}/.test(SRC));
  assert.ok(SRC.indexOf('try{render();}')<SRC.indexOf('updateHUD();'));
});
ok('E02 pausa, loja e evento congelam simulação sem alterar o renderer de armas',()=>{
  assert.ok(/state==='paused'/.test(SRC));
  assert.ok(/state==='event'\|\|state==='shop'/.test(SRC));
  assert.ok(/const frozen=/.test(SRC));
  assert.ok(body('pauseGame').includes("state='paused'"));
  assert.ok(body('openShop').includes("state='shop'"));
  assert.ok(body('openEvent').includes("state='event'"));
  assert.ok(body('closeEvent').includes("state='play'"));
});
ok('E03 checkpoint mecânico não serializa particles/rings/arcs/muzzle transitório',()=>{
  const b=body('smBuildCheckpoint');
  for(const forbidden of ['parts','arcs','muzzle','impactTransient','temporalReplay'])
    assert.ok(!new RegExp('\\b'+forbidden+'\\b','i').test(b),forbidden+' entrou no save');
  assert.ok(b.includes('runTime')&&b.includes('p:'));
});
ok('E04 sandbox/test mode permanece explicitamente run-scoped',()=>{
  assert.ok(SRC.includes('sandboxRun'));
  assert.ok(/sandboxRun=true/.test(SRC));
  assert.ok(/pr15MemSandboxContextStart|sandboxStart/.test(SRC));
  assert.ok(/pr15MemSandboxTearDown|sandboxExit/.test(SRC));
});

console.log('\n[F] limites e riscos explícitos');
ok('F01 unknown válido desenha pelo fallback e não aborta',()=>{
  fresh();
  run('var __p={x:200,y:200,vx:300,vy:0,r:4,color:"#fff",type:"future_weapon",team:"ally",dist:0,maxDist:900};');
  const g=opNames('drawProjectile(__p)');
  assert.ok(g.paths>0&&g.stroke>0);
});
ok('F02 dispatcher não usa branch duplicado para uma família',()=>{
  const b=body('drawProjectile');
  for(const name of ['EnergyMass','FluidSpray','Slug','Swarm','Kinetic','ConductionStatus'])
    assert.strictEqual((b.match(new RegExp('drawProjectile'+name,'g'))||[]).length,1,name);
});

console.log('\n================================================================');
console.log('PR15.5-FINAL: '+passed+' checks aprovados · '+failed+' falhas');
console.log('================================================================');
process.exit(failed?1:0);
