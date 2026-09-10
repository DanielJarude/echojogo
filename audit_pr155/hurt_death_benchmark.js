'use strict';
/* =====================================================================
   PR15.5-C · BENCHMARK ESTRUTURAL DE HURT/DEATH (ANTES vs DEPOIS)
   ---------------------------------------------------------------------
   Não mede ms e não estima FPS Electron: conta OPERAÇÕES reais do
   Canvas mock (paths, transforms, save/restore, blur draws), chamadas
   de trigonometria/RNG por frame e o custo isolado do pipeline visual
   de dano/morte, nos cenários A–L do brief.

   ANTES  = base validada 5d8e244 (hurt genérico PR15.5-A, sem corpse)
   DEPOIS = working tree (perfil de impacto por família + corpse)

   Invariantes (gates):
   G1  idle (A): ops/frame DEPOIS ≤ ANTES (fast path ~ zero custo)
   G2  hurt (B/C): blurDraws/frame DEPOIS == ANTES (zero shadowBlur novo)
   G3  morte (D–L): zero shadowBlur no draw do corpse (por família)
   G4  corpses ≤ DEATH_VISUAL_CAP (24) em todos os cenários
   G5  RNG mecânico total igual ANTES×DEPOIS nos cenários de dano/morte
   G6  render idle 46 inimigos byte-idêntico (hash do canvas, dust fixo)

   Uso:
     node audit_pr155/hurt_death_benchmark.js [--ref <commit>] [--json f]
   ===================================================================== */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const Module=require('module');
const crypto=require('crypto');
const {readSource,measure}=require('./performance_benchmark.js');
const BASE_REF='5d8e244c22b1a505c1cd25c4149497f91c83871a';
const DT=1/60;
const ROOT=path.resolve(__dirname,'..');
const IDS=['chaser','shooter','tank','spawner','anomaly','swarm','orbiter','bulwark','splitter','phantom','singular'];
const T46='var __tt=["chaser","shooter","tank","spawner","anomaly","swarm","orbiter","bulwark","splitter","phantom","singular"];';
const SPAWN46='for(var i=0;i<46;i++){var e=spawnEnemy(__tt[i%11],80+(i%10)*58,80+((i/10)|0)*58,3);e.spawnT=0;e.fireT=99;e.aim=0;e.flashT=0;}';
/* corpo de loop que existe nas DUAS bases (guarda p/ o corpse só no DEPOIS) */
const CVT='if(typeof deathVisualTick==="function")deathVisualTick('+DT+');';
const CDV='if(typeof drawDeathVisuals==="function")drawDeathVisuals();';
const CLEAR='enemies.length=0;projectiles.length=0;parts.length=0;swings.length=0;xporbs.length=0;ftexts.length=0;player.hp=99999;';
/* câmera sobre a grade de spawn — senão o culling inView() esconde tudo */
const CAM='cam.x=358;cam.y=198;';
/* dust (fundo) é semeado no load — normaliza p/ o hash G6 */
const DUSTFIX='dust.length=0;for(var i=0;i<90;i++)dust.push({x:(i*137)%ARENA.w,y:(i*251)%ARENA.h,r:1,a:.1});floorCv=null;';

/* Mundo compatível com as duas bases: ao carregar a fonte ANTES do
   PR15.5-C, o epílogo de exportações do harness perde os símbolos novos.
   Nada do jogo é alterado — só o adapter de teste. */
function buildWorld(source){
  const filename=path.join(ROOT,'audit_pr135/harness.js');
  let code=fs.readFileSync(filename,'utf8');
  if(!source.includes('ENEMY_IMPACT_PROFILES')){
    code=code.split('\n').filter(l=>!l.includes('ENEMY_IMPACT_PROFILES')&&!/PR15\.5-C: reação/.test(l)).join('\n');
  }
  code=code.replace(/^const html=.*;$/m,()=>'const html='+JSON.stringify(source)+';');
  const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(code,filename);
  const h=m.exports;
  h.sandbox.Math=Object.create(Math);
  const {performance}=require('perf_hooks');
  h.sandbox.performance.now=()=>performance.now();
  let seed=1;
  h.sandbox.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  h.seed=v=>{seed=v>>>0;};h.run=code2=>vm.runInContext(code2,h.sandbox);
  h.run('DEV_MODE=true;sandboxRun=true;');
  return h;
}

/* ---------- cenários A–L ---------- */
const SCENARIOS=[
 {id:'A',nome:'46 vivos idle (600 frames — fast path)',frames:600,
  setup:'startRun();'+CLEAR+T46+SPAWN46,
  loop:'for(var i=0;i<enemies.length;i++){updateEnemy(enemies[i],'+DT+');drawEnemy(enemies[i]);}'},
 {id:'B',nome:'46 hits contínuos leve (600 frames — hurt coalesce)',frames:600,
  setup:'startRun();'+CLEAR+T46+SPAWN46,
  loop:'for(var i=0;i<enemies.length;i++){var e=enemies[i];if(e.hp>e.maxHp*.4)damageEnemy(e,1,player.x,player.y,false,false);updateEnemy(e,'+DT+');drawEnemy(e);}'},
 {id:'C',nome:'46 dano pesado espaçado (600 frames — flash+knockback)',frames:600,
  setup:'startRun();'+CLEAR+T46+SPAWN46,
  loop:'if(__f%15===0){for(var i=0;i<enemies.length;i++){var e=enemies[i];if(e.hp>e.maxHp*.4)damageEnemy(e,8,player.x-140,player.y,false,false);}}for(var i=0;i<enemies.length;i++){var e=enemies[i];updateEnemy(e,'+DT+');drawEnemy(e);}'},
 {id:'D',nome:'25 mortes em sequência (1/frame + corpse, 180 frames)',frames:180,
  setup:'startRun();'+CLEAR+'for(var i=0;i<25;i++){var e=spawnEnemy("tank",80+(i%10)*58,80+((i/10)|0)*58,3);e.spawnT=0;e.aim=0;}',
  loop:'if(__f<25){var e=enemies[__f];if(e&&!e.dead)damageEnemy(e,99999,player.x,player.y,false,false);}'+CVT+'for(var i=0;i<enemies.length;i++){var e=enemies[i];if(!e.dead)updateEnemy(e,'+DT+');}'+CDV},
 {id:'E',nome:'46 mortes quase simultâneas (cap 24, 180 frames)',frames:180,
  setup:'startRun();'+CLEAR+T46+SPAWN46,
  loop:'if(__f%2===0&&__f<46){var e=enemies[__f/2|0];if(e&&!e.dead)damageEnemy(e,99999,player.x,player.y,false,false);}'+CVT+CDV},
 {id:'F',nome:'morte em massa de swarm (6 frames de abates, 120 frames)',frames:120,
  setup:'startRun();'+CLEAR+'for(var i=0;i<46;i++){var e=spawnEnemy("swarm",80+(i%10)*58,80+((i/10)|0)*58,3);e.spawnT=0;e.aim=0;}',
  loop:'if(__f<6){for(var i=__f*8;i<__f*8+8&&i<46;i++){var e=enemies[i];if(e&&!e.dead)damageEnemy(e,99999,player.x,player.y,false,false);}}'+CVT+'for(var i=0;i<enemies.length;i++){var e=enemies[i];if(!e.dead)updateEnemy(e,'+DT+');}'+CDV},
 {id:'G',nome:'morte mista Tank/Bulwark/Splitter/Phantom/Singular (180 frames)',frames:180,
  setup:'startRun();'+CLEAR+'var __mx=["tank","bulwark","splitter","phantom","singular"];for(var i=0;i<45;i++){var e=spawnEnemy(__mx[i%5],80+(i%10)*58,80+((i/10)|0)*58,3);e.spawnT=0;e.aim=0;}',
  loop:'if(__f<45&&__f%3===0){for(var i=0;i<3;i++){var e=enemies[__f+i];if(e&&!e.dead)damageEnemy(e,99999,player.x,player.y,false,false);}}'+CVT+'for(var i=0;i<enemies.length;i++){var e=enemies[i];if(!e.dead)updateEnemy(e,'+DT+');}'+CDV},
 {id:'H',nome:'melee real + mortes (120 frames)',frames:120,
  setup:'startRun();'+CLEAR+'var __wi=WEAPONS.findIndex(function(w){return w.id==="blade";});player.owned=[__wi];player.wi=__wi;player.crit=0;player.fireTimer=0;for(var i=0;i<12;i++){var e=spawnEnemy("chaser",player.x+40+i*10,player.y,3);e.spawnT=0;e.aim=0;e.hp=Math.min(e.hp,10);e.maxHp=e.hp;}',
  loop:'player.fireTimer-='+DT+';if(player.fireTimer<=0){fireWeaponFrom(player,WEAPONS[player.wi],"ally",1);player.fireTimer=WEAPONS[player.wi].interval;}updateSwings('+DT+');'+CVT+'for(var i=0;i<enemies.length;i++){var e=enemies[i];if(!e.dead)updateEnemy(e,'+DT+');}'+CDV},
 {id:'I',nome:'ranged real + mortes (180 frames)',frames:180,
  setup:'startRun();'+CLEAR+'var __wi=WEAPONS.findIndex(function(w){return !w.melee;});player.owned=[__wi];player.wi=__wi;player.crit=0;player.fireTimer=0;for(var i=0;i<12;i++){var e=spawnEnemy("swarm",player.x+200+i*26,player.y,3);e.spawnT=0;e.aim=0;}',
  loop:'player.fireTimer-='+DT+';if(player.fireTimer<=0){fireWeaponFrom(player,WEAPONS[player.wi],"ally",1);player.fireTimer=WEAPONS[player.wi].interval;}updateProjectiles('+DT+');'+CVT+'for(var i=0;i<enemies.length;i++){var e=enemies[i];if(!e.dead)updateEnemy(e,'+DT+');}'+CDV},
 {id:'J',nome:'Sandbox/FX pesado + mortes — render completo (120 frames)',frames:120,
  setup:'startRun();'+CLEAR+T46+SPAWN46+'for(var i=0;i<240;i++)spawnParticles(300+(i%20)*30,200+(i%8)*40,"#8ff6ff",1,180,.5,3);resize();',
  loop:'if(__f<48&&__f%4===0){var e=enemies[__f/4|0];if(e&&!e.dead)damageEnemy(e,99999,player.x,player.y,false,false);}updateProjectiles('+DT+');'+CVT+'for(var i=0;i<enemies.length;i++){var e=enemies[i];if(!e.dead)updateEnemy(e,'+DT+');}render();'},
 {id:'K',nome:'métricas ON + 24 corpses (60 frames — render completo)',frames:60,
  setup:'startRun();'+CLEAR+T46+SPAWN46+'for(var i=0;i<46;i++){var e=enemies[i];damageEnemy(e,99999,player.x,player.y,false,false);}cfg.metrics=1;resize();',
  loop:CVT+'render();'},
 {id:'L',nome:'métricas OFF + 24 corpses (60 frames — render completo)',frames:60,
  setup:'startRun();'+CLEAR+T46+SPAWN46+'for(var i=0;i<46;i++){var e=enemies[i];damageEnemy(e,99999,player.x,player.y,false,false);}cfg.metrics=0;resize();',
  loop:CVT+'render();'}
];

/* ---------- instrumentação de pose (existe nas duas bases) ---------- */
function injectCounters(h){
  h.run('globalThis.__hc={pose:0};');
  h.run('(function(){var f=visualHurtPose;if(typeof f!=="function")return;visualHurtPose=function(){globalThis.__hc.pose++;return f.apply(this,arguments);};})();');
}
/* hash do render idle p/ o gate G6 (dust normalizado) */
function idleHash(h){
  h.seed(777);
  h.run('startRun();'+CLEAR+T46+SPAWN46+DUSTFIX+CAM);
  const r=measure(h,'resize();render();');
  return r.hashCanvas;
}
/* draw isolado do corpse por família (só DEPOIS tem o sistema) */
function corpseFamilyCost(h){
  if(typeof h.T.getDeathVisuals!=='function')return null;
  const out={};
  for(const id of IDS){
    h.seed(101);
    h.run('startRun();'+CLEAR+CAM.replace('cam.x=358;cam.y=198;','cam.x=600;cam.y=400;'));
    h.run('var e=spawnEnemy('+JSON.stringify(id)+',600,400,3);e.spawnT=0;e.aim=0;damageEnemy(e,99999,500,400,false,false);');
    const r=measure(h,'drawDeathVisuals();');
    const fin=r.canvas;
    out[id]={ops:fin.save+fin.restore+fin.paths+fin.fill+fin.stroke+fin.transforms+fin.arcs,
      paths:fin.paths,blurDraws:fin.shadowDraws};
    h.run('deathVisualClear();');
  }
  return out;
}
/* hurt pose isolado: 1 chaser com hurt ativo vs idle (só drawEnemy) */
function hurtDrawCost(h){
  h.seed(202);
  h.run('startRun();'+CLEAR+'var e=spawnEnemy("chaser",600,400,3);e.spawnT=0;e.aim=0;');
  const idle=measure(h,'drawEnemy(enemies[0]);');
  h.run('damageEnemy(enemies[0],5,460,400,false,false);');
  const hurt=measure(h,'drawEnemy(enemies[0]);');
  const a=idle.canvas,b=hurt.canvas;
  return {idleOps:a.save+a.restore+a.paths+a.fill+a.stroke+a.transforms+a.arcs,
    hurtOps:b.save+b.restore+b.paths+b.fill+b.stroke+b.transforms+b.arcs,
    deltaPaths:b.paths-a.paths,deltaTransforms:b.transforms-a.transforms,
    deltaBlur:b.shadowDraws-a.shadowDraws};
}

/* ---------- execução ---------- */
function runSide(source,label){
  const h=buildWorld(source);
  const out={label,cenarios:{},corpseFam:null,hurt:null,idle:null};
  injectCounters(h);
  out.idle=idleHash(h);
  out.hurt=hurtDrawCost(h);
  out.corpseFam=corpseFamilyCost(h);
  for(const s of SCENARIOS){
    h.seed(155);
    h.run(s.setup);
    h.run(CAM);
    h.run('globalThis.__hc.pose=0;globalThis.__f=0;var __maxC=0;');
    const code='for(globalThis.__f=0;globalThis.__f<'+s.frames+';globalThis.__f++){'+s.loop+
      'if(typeof deathVisuals!=="undefined"&&deathVisuals.length>__maxC)__maxC=deathVisuals.length;}';
    const r=measure(h,code);
    const f=s.frames;
    const c=r.canvas;
    out.cenarios[s.id]={nome:s.nome,frames:f,
      opsFrame:+((c.save+c.restore+c.paths+c.fill+c.stroke+c.transforms+c.arcs)/f).toFixed(2),
      saveRestore:+((c.save+c.restore)/f).toFixed(2),
      paths:+(c.paths/f).toFixed(2),
      transforms:+(c.transforms/f).toFixed(2),
      arcs:+(c.arcs/f).toFixed(2),
      blurDraws:+(c.shadowDraws/f).toFixed(3),
      sinCosFrame:+((c===null?0:(r.trig.sin+r.trig.cos))/f).toFixed(2),
      atan2Frame:+(r.trig.atan2/f).toFixed(2),
      randomTotal:r.trig.random,
      poseEvalsFrame:+((h.sandbox.__hc.pose||0)/f).toFixed(2),
      corpsesMax:h.run('__maxC')};
    h.run('enemies.length=0;projectiles.length=0;parts.length=0;swings.length=0;xporbs.length=0;ftexts.length=0;');
    if(typeof h.T.deathVisualClear==='function')h.T.deathVisualClear();
  }
  return out;
}

function main(){
  const args=process.argv.slice(2);
  const ref=args.includes('--ref')?args[args.indexOf('--ref')+1]:BASE_REF;
  const antes=runSide(readSource(ref),'ANTES ('+ref.slice(0,7)+')');
  const depois=runSide(readSource(null),'DEPOIS (working tree)');
  console.log('ECHO — PR15.5-C · BENCHMARK ESTRUTURAL DE HURT/DEATH');
  console.log('Canvas mock: operações reais, não rasterização/FPS.\n');
  for(const s of SCENARIOS){
    const a=antes.cenarios[s.id],d=depois.cenarios[s.id];
    console.log('['+s.id+'] '+s.nome);
    console.table({
      'ANTES':{'ops/frame':a.opsFrame,saveRestore:a.saveRestore,paths:a.paths,transforms:a.transforms,
        blurDraws:a.blurDraws,'sinCos/frame':a.sinCosFrame,'atan2/frame':a.atan2Frame,
        RNG:a.randomTotal,'poseEvals/frame':a.poseEvalsFrame,'corpsesMax':'—'},
      'DEPOIS':{'ops/frame':d.opsFrame,saveRestore:d.saveRestore,paths:d.paths,transforms:d.transforms,
        blurDraws:d.blurDraws,'sinCos/frame':d.sinCosFrame,'atan2/frame':d.atan2Frame,
        RNG:d.randomTotal,'poseEvals/frame':d.poseEvalsFrame,'corpsesMax':d.corpsesMax}
    });
  }
  console.log('HURT desenhado isolado (1 chaser, só drawEnemy):');
  console.table({
    'ANTES':{'ops/idle':antes.hurt.idleOps,'ops/hurt':antes.hurt.hurtOps,'Δpaths':antes.hurt.deltaPaths,
      'Δtransforms':antes.hurt.deltaTransforms,'Δblur':antes.hurt.deltaBlur},
    'DEPOIS':{'ops/idle':depois.hurt.idleOps,'ops/hurt':depois.hurt.hurtOps,'Δpaths':depois.hurt.deltaPaths,
      'Δtransforms':depois.hurt.deltaTransforms,'Δblur':depois.hurt.deltaBlur}
  });
  if(depois.corpseFam){
    console.log('CORPSE desenhado isolado (por família, só drawDeathVisuals — DEPOIS):');
    console.table(Object.fromEntries(Object.entries(depois.corpseFam).map(([k,v])=>[k,{ops:v.ops,paths:v.paths,blur:v.blurDraws}])));
  }
  console.log('G6 render idle 46 (hash do canvas, dust normalizado):');
  console.log('  ANTES : '+antes.idle);
  console.log('  DEPOIS: '+depois.idle);
  const gates={
    'G1 idle ops/frame DEPOIS ≤ ANTES':depois.cenarios.A.opsFrame<=antes.cenarios.A.opsFrame,
    'G2 hurt blurDraws DEPOIS == ANTES (B)':depois.cenarios.B.blurDraws===antes.cenarios.B.blurDraws,
    'G2 hurt blurDraws DEPOIS == ANTES (C)':depois.cenarios.C.blurDraws===antes.cenarios.C.blurDraws,
    'G3 corpse zero blur (todas as famílias)':depois.corpseFam&&Object.values(depois.corpseFam).every(v=>v.blurDraws===0),
    'G4 corpsesMax ≤ 24 em todos os cenários':Object.values(depois.cenarios).every(c=>c.corpsesMax===null||c.corpsesMax<=24),
    'G5 RNG mecânico igual (D/E/F)':antes.cenarios.D.randomTotal===depois.cenarios.D.randomTotal&&
      antes.cenarios.E.randomTotal===depois.cenarios.E.randomTotal&&antes.cenarios.F.randomTotal===depois.cenarios.F.randomTotal,
    'G6 render idle byte-idêntico':antes.idle===depois.idle
  };
  console.log('\nGATES:');
  let go=true;
  for(const [k,v] of Object.entries(gates)){console.log('  '+(v?'✔':'✘')+' '+k);if(!v)go=false;}
  console.log('\nResultado estrutural: '+(go?'TODOS OS GATES OK':'GATE FALHOU'));
  if(args.includes('--json')){
    const file=args[args.indexOf('--json')+1];
    fs.writeFileSync(file,JSON.stringify({ref,antes,depois,gates,go},null,2)+'\n');
    console.log('JSON gravado em '+file);
  }
  if(!go)process.exitCode=1;
}
if(require.main===module)main();
module.exports={SCENARIOS,runSide,BASE_REF};
