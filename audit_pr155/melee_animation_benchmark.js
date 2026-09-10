'use strict';
/* =====================================================================
   PR15.5-D · BENCHMARK ESTRUTURAL DA ANIMAÇÃO MELEE (ANTES vs DEPOIS)
   ---------------------------------------------------------------------
   Não mede ms e não estima FPS Electron: conta OPERAÇÕES reais do
   Canvas mock (paths, transforms, save/restore, blur draws) e chamadas
   de trigonometria/pose por frame, nos cenários A–H do PR15.5-D.

   ANTES  = base validada 4f56b76 (arma estática + arco genérico blur)
   DEPOIS = working tree (pose física por família + trail direcional)

   Uso:
     node audit_pr155/melee_animation_benchmark.js [--ref <commit>] [--json f]
   ===================================================================== */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const Module=require('module');
const {readSource,measure}=require('./performance_benchmark.js');
const BASE_REF='4f56b76aa82d0e65323215dfa2ad31dedfb66925';
const DT=1/60;
const ROOT=path.resolve(__dirname,'..');
/* Mundo compatível com as duas bases: ao carregar uma fonte ANTERIOR ao
   PR15.5-D, o epílogo de exportações do harness perde os símbolos novos
   (eles não existem lá). Nada do jogo é alterado — só o adapter de teste. */
function buildWorld(source){
  const filename=path.join(ROOT,'audit_pr135/harness.js');
  let code=fs.readFileSync(filename,'utf8');
  if(!source.includes('MELEE_VISUAL_PROFILES')){
    code=code.replace(/\/\* PR15\.5-D: animação física do arsenal melee \*\/\s*'[^']*meleeDrawTrail,'\+\s*/,'');
  }
  /* PR15.5-E: base 4f56b76 é anterior ao arsenal ranged visual. */
  if(!source.includes('WEAPON_RANGED_VISUAL_PROFILES')){
    code=code.split('\n').filter(l=>!l.includes('WEAPON_RANGED_VISUAL_PROFILES')&&!/PR15\.5-E: arsenal ranged/.test(l)).join('\n');
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
  h.run(fs.readFileSync(path.join(__dirname,'performance_scenarios.js'),'utf8'));
  h.run(fs.readFileSync(path.join(__dirname,'performance_probe.js'),'utf8'));
  return h;
}

/* ---------- cenários A–H ---------- */
function equip(h,id,extra){
  const wi=h.T.WEAPONS.findIndex(w=>w.id===id);
  h.run('player.owned=['+wi+(extra?','+extra:'')+'];player.wi='+wi+
    ';player.crit=0;player.fireTimer=0;swings=[];projectiles=[];');
}
const FIRE='player.fireTimer-='+DT+';'+
  'if(player.fireTimer<=0){fireWeaponFrom(player,WEAPONS[player.wi],\'ally\',1);'+
  'player.fireTimer=WEAPONS[player.wi].interval;}';
const TICK='visualTimelineTick(player,'+DT+');updateSwings('+DT+');';
const DRAW='drawPlayer();drawSwings();';

const SCENARIOS=[
 {id:'A',nome:'idle com melee equipada (600 frames)',frames:600,prepare:'A',
  setup:h=>equip(h,'blade'),
  loop:TICK+DRAW},
 {id:'B',nome:'ataque melee repetido (limite mecânico, 600 frames)',frames:600,prepare:'A',
  setup:h=>equip(h,'blade'),
  loop:FIRE+TICK+DRAW},
 {id:'C',nome:'melee + 25 inimigos (300 frames)',frames:300,prepare:'C',
  setup:h=>equip(h,'scythe'),
  loop:FIRE+TICK+DRAW},
 {id:'D',nome:'melee + 46 inimigos (300 frames)',frames:300,prepare:'D',
  setup:h=>equip(h,'chains'),
  loop:FIRE+TICK+DRAW},
 {id:'E',nome:'troca de arma durante combate (600 frames)',frames:600,prepare:'A',
  setup:h=>equip(h,'blade','0'),
  loop:'if(__f%30===0)setWeaponSlot(__f%60===0?0:1);'+FIRE+TICK+'updateProjectiles('+DT+');'+DRAW},
 {id:'F',nome:'hurt durante o swing (600 frames)',frames:600,prepare:'A',
  setup:h=>equip(h,'hammer'),
  loop:FIRE+'if(__f%20===0)visualNotifyHurt(player,player.x-100,player.y);'+TICK+DRAW},
 {id:'G',nome:'Sandbox com FX — render completo (200 frames)',frames:200,prepare:'E',
  setup:h=>{equip(h,'katana');h.run('resize();render();');},
  loop:FIRE+TICK+'render();'},
 {id:'H',nome:'spam katana na cadência máxima (600 frames)',frames:600,prepare:'A',
  setup:h=>equip(h,'katana'),
  loop:FIRE+TICK+DRAW}
];

/* ---------- instrumentação de pose (só existe no DEPOIS) ---------- */
function injectCounters(h){
  h.run('globalThis.__mc={start:0,poseW:0,poseB:0,drawPose:0,trailAngle:0,scratchStable:0};');
  const wrap=`(function(){
    function w(name,slot){var f=globalThis[name];if(typeof f!=='function')return;
      globalThis[name]=function(){globalThis.__mc[slot]++;return f.apply(this,arguments);};}
    w('meleeVisualStart','start');w('visualMeleeWeaponPose','poseW');
    w('visualMeleeBodyPose','poseB');w('visualPlayerDrawPose','drawPose');
    w('meleeVisualTrailAngle','trailAngle');
  })();`;
  h.run(wrap);
}
function scratchCheck(h){
  const has=typeof h.T.visualMeleeWeaponPose==='function';
  if(!has)return '—';
  h.seed(155);
  h.run('__ECHO_AUDIT_FIXTURES.prepare("A");');
  h.run('player.fireTimer=0;fireWeaponFrom(player,WEAPONS[player.wi],\'ally\',1);'+
    'visualTimelineTick(player,0.05);'+
    'var __a=visualMeleeWeaponPose(player);var __b=visualMeleeWeaponPose(player);'+
    'globalThis.__mc.scratchStable=(__a===__b)?1:0;');
  return h.sandbox.__mc.scratchStable===1?'1 scratch reutilizado (0 alocação)':'ALOCANDO';
}

/* ---------- execução ---------- */
function runSide(source,label){
  const h=buildWorld(source);
  const out={label,cenarios:{},trail:{}};
  injectCounters(h);
  out.scratch=scratchCheck(h);
  for(const s of SCENARIOS){
    h.seed(155);
    h.run('globalThis.__mc.start=0;globalThis.__mc.poseW=0;globalThis.__mc.poseB=0;'+
      'globalThis.__mc.drawPose=0;globalThis.__mc.trailAngle=0;');
    h.run('__ECHO_AUDIT_FIXTURES.prepare('+JSON.stringify(s.prepare)+');');
    s.setup(h);
    h.run('globalThis.__f=0;');
    const code='for(globalThis.__f=0;globalThis.__f<'+s.frames+';globalThis.__f++){'+s.loop+'}';
    const r=measure(h,code);
    const f=s.frames;
    const c=r.canvas,t=r.trig;
    h.run('swings=[];');
    out.cenarios[s.id]={nome:s.nome,frames:f,
      opsFrame:+((c.save+c.restore+c.paths+c.fill+c.stroke+c.transforms+c.arcs)/f).toFixed(1),
      saveRestore:+((c.save+c.restore)/f).toFixed(1),
      paths:+(c.paths/f).toFixed(1),
      transforms:+(c.transforms/f).toFixed(1),
      blurDraws:+(c.shadowDraws/f).toFixed(1),
      sinCosFrame:+((t.sin+t.cos)/f).toFixed(2),
      atan2Frame:+(t.atan2/f).toFixed(2),
      randomTotal:t.random,
      poseEvalsFrame:h.sandbox.__mc?+(((h.sandbox.__mc.poseW||0)+(h.sandbox.__mc.poseB||0))/f).toFixed(2):null,
      meleeStates:h.sandbox.__mc?(h.sandbox.__mc.start||0):null};
    /* trail isolado: 1 swing em pleno ACTIVE, apenas drawSwings */
    h.seed(155);
    h.run('__ECHO_AUDIT_FIXTURES.prepare("A");');
    s.setup(h);
    const eqDef=h.T.WEAPONS[h.run('player.wi')];
    const prof=h.T.meleeVisualProfile?h.T.meleeVisualProfile(eqDef):null;
    const wind=prof?prof.windup:0,act=prof?prof.active*.5:0;
    const tr=measure(h,'player.fireTimer=0;fireWeaponFrom(player,WEAPONS[player.wi],\'ally\',1);'+
      'updateSwings('+(wind+act)+');drawSwings();');
    out.trail[s.id]={paths:tr.canvas.paths,blurDraws:tr.canvas.shadowDraws,
      saveRestore:tr.canvas.save+tr.canvas.restore};
  }
  return out;
}

if(require.main===module){
  const args=process.argv.slice(2);
  const ref=args.includes('--ref')?args[args.indexOf('--ref')+1]:BASE_REF;
  const antes=runSide(readSource(ref),'ANTES ('+ref.slice(0,7)+')');
  const depois=runSide(readSource(null),'DEPOIS (working tree)');
  console.log('ECHO — PR15.5-D · BENCHMARK ESTRUTURAL DA ANIMAÇÃO MELEE');
  console.log('Canvas mock: operações reais, não rasterização/FPS.\n');
  for(const s of SCENARIOS){
    const a=antes.cenarios[s.id],d=depois.cenarios[s.id];
    console.log('['+s.id+'] '+s.nome);
    console.table({
      'ANTES':{'ops/frame':a.opsFrame,saveRestore:a.saveRestore,paths:a.paths,transforms:a.transforms,
        blurDraws:a.blurDraws,'sinCos/frame':a.sinCosFrame,'atan2/frame':a.atan2Frame,
        RNG:a.randomTotal,'poseEvals/frame':a.poseEvalsFrame===null?'—':a.poseEvalsFrame},
      'DEPOIS':{'ops/frame':d.opsFrame,saveRestore:d.saveRestore,paths:d.paths,transforms:d.transforms,
        blurDraws:d.blurDraws,'sinCos/frame':d.sinCosFrame,'atan2/frame':d.atan2Frame,
        RNG:d.randomTotal,'poseEvals/frame':d.poseEvalsFrame}
    });
  }
  console.log('TRAIL isolado (1 swing em pleno ACTIVE — só drawSwings):');
  console.table(Object.fromEntries(SCENARIOS.map(s=>{
    const a=antes.trail[s.id],d=depois.trail[s.id];
    return [s.id,{ 'ANTES paths':a.paths,'DEPOIS paths':d.paths,
      'ANTES blurDraws':a.blurDraws,'DEPOIS blurDraws':d.blurDraws,
      'ANTES save+restore':a.saveRestore,'DEPOIS save+restore':d.saveRestore}];
  })));
  console.log('Reuso de scratch das poses (DEPOIS):',depois.scratch);
  console.log('\nGATE: idle (A) DEPOIS ops/frame deve ser ≈ ANTES; blurDraws do trail DEPOIS = 0.');
  if(args.includes('--json')){
    const file=args[args.indexOf('--json')+1];
    fs.writeFileSync(file,JSON.stringify({ref,antes,depois},null,2)+'\n');
    console.log('JSON gravado em '+file);
  }
}
module.exports={SCENARIOS,runSide,BASE_REF};
