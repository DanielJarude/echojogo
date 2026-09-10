'use strict';
/* =====================================================================
   PR15.5-E · BENCHMARK ESTRUTURAL DO ARSENAL RANGED (ANTES vs DEPOIS)
   ---------------------------------------------------------------------
   Não mede ms e não estima FPS Electron: conta OPERAÇÕES reais do
   Canvas mock (paths, transforms, save/restore, drawImage, blur draws),
   chamadas de trigonometria/RNG por frame e o custo isolado do pipeline
   visual de cada arma, nos cenários A–T (1 por arma ranged real, 20).

   ANTES  = base validada f2a602a (glow genérico + tracer, sem bloco E)
   DEPOIS = working tree (identidade visual por família: muzzle, corpo,
            trail, impacto — render-only, mecânica intacta)

   Cenários (A–T, 600 frames de fogo REAL cada):
     A plasma      B shotgun     C orb         D beam       E flamer
     F rail        G smg         H cryo        I tesla      J acid
     K nail        L boomer      M homing      N mine       O sniper
     P void        Q ricochet    R gatling     S prism      T plague

   Invariantes (gates):
   G1  idle: render completo 46 vivos byte-idêntico (hash, dust fixo)
   G2  zero blur novo: blurDraws/frame DEPOIS ≤ ANTES nos 20 cenários
   G3  RNG mecânico: randomTotal DEPOIS == ANTES nos 20 cenários
   G4  identidade barata: ops/projétil ≤ 40 no draw isolado (19 armas)
   G5  caps: muzzle ≤ 48 e impact ≤ 96 em todos os cenários (pico)
   G6  draw purity: zero Math.random em drawProjectile (19 armas)
   G7  orientação sem atan2: zero atan2/projétil e sinCos ≤ 6/projétil
       (teto de projeto: polígonos/shell com poucos vértices fixos)
   G8  vidas ≤ tetos: muzzle ≤ .12s e impact ≤ .2s (constantes)
   G9  stress 500 projéteis: zero NaN, caps ok, ops/proj ≤ 40
   G10 pool bounded: cap 192 + take/drop por pool (fonte, sem crescer)

   Uso:
     node audit_pr155/ranged_arsenal_benchmark.js [--ref <commit>] [--json f]
   ===================================================================== */
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const Module=require('module');
const crypto=require('crypto');
const {readSource,measure}=require('./performance_benchmark.js');
const BASE_REF='f2a602a7d4f814ed50347068f541ac32b4d15f5f';
const DT=1/60,FRAMES=600,ISO=300,STRESS=500;
const ROOT=path.resolve(__dirname,'..');
const WEAPONS=['plasma','shotgun','orb','beam','flamer','rail','smg','cryo','tesla',
  'acid','nail','boomer','homing','mine','sniper','void','ricochet','gatling','prism','plague'];
const T46='var __tt=["chaser","shooter","tank","spawner","anomaly","swarm","orbiter","bulwark","splitter","phantom","singular"];';
const SPAWN46='for(var i=0;i<46;i++){var e=spawnEnemy(__tt[i%11],80+(i%10)*58,80+((i/10)|0)*58,3);e.spawnT=0;e.fireT=99;e.aim=0;e.flashT=0;}';
const CLEAR='enemies.length=0;projectiles.length=0;parts.length=0;swings.length=0;xporbs.length=0;ftexts.length=0;player.hp=99999;';
const DUSTFIX='dust.length=0;for(var i=0;i<90;i++)dust.push({x:(i*137)%ARENA.w,y:(i*251)%ARENA.h,r:1,a:.1});floorCv=null;';
const CAMIDLE='cam.x=358;cam.y=198;';
/* guards `typeof`: o ANTES não tem as funções do bloco E — o mesmo loop
   roda nas duas bases (nada do jogo é alterado; só o adapter de teste) */
const FXT='if(typeof rangedFxTick==="function")rangedFxTick('+DT+');';
const DMZ='if(typeof drawMuzzleFx==="function")drawMuzzleFx();';
const DIM='if(typeof drawImpactFx==="function")drawImpactFx();';
const DP ='for(var i=0;i<projectiles.length;i++)drawProjectile(projectiles[i]);';
const MAXES='if(projectiles.length>__maxP)__maxP=projectiles.length;'+
  'if(typeof muzzleFx!=="undefined"&&muzzleFx.length>__maxM)__maxM=muzzleFx.length;'+
  'if(typeof impactFx!=="undefined"&&impactFx.length>__maxI)__maxI=impactFx.length;';
const LOOP='player.fireTimer-='+DT+';'+
  'if(player.fireTimer<=0){fireWeaponFrom(player,WEAPONS[player.wi],"ally",1);'+
  'player.fireTimer=Math.max(.02,WEAPONS[player.wi].interval||.1);}'+
  'updateProjectiles('+DT+');'+FXT+DP+DMZ+DIM+MAXES;

/* Mundo compatível com as duas bases: a linha de exportação E do harness
   traz 20+ símbolos novos — na base ANTES ela é trocada pela versão
   mínima com os 4 símbolos que JÁ existiam (drawProjectile,
   onProjectileHit, explodeOrb, detonateSpecial). Nada do jogo muda. */
function buildWorld(source){
  const filename=path.join(ROOT,'audit_pr135/harness.js');
  let code=fs.readFileSync(filename,'utf8');
  if(!source.includes('WEAPON_RANGED_VISUAL_PROFILES')){
    code=code.replace(/'RANGED_VISUAL_FAMILIES[\s\S]*?getImpactFx[^\n]*\n/,
      "'drawProjectile,onProjectileHit,explodeOrb,detonateSpecial,'+\n");
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
const EQUIP=id=>'var __wi=WEAPONS.findIndex(function(w){return w.id==="'+id+'";});'+
  'player.owned=[__wi];player.wi=__wi;player.crit=0;player.fireTimer=0;';

/* ---------- execução ---------- */
function idleHash(h){
  h.seed(777);
  h.run('startRun();'+CLEAR+T46+SPAWN46+DUSTFIX+CAMIDLE);
  const r=measure(h,'resize();render();');
  return r.hashCanvas;
}
/* draw isolado: 1 projétil REAL da arma (spawn via fireWeaponFrom),
   update congelado (draw purity não move nada) — ops/trig por projétil */
function drawIso(h){
  const out={};
  for(const id of WEAPONS){
    if(id==='beam')continue;                       // beam não cria projétil
    h.seed(321);
    h.run('startRun();'+CLEAR+EQUIP(id)+'cam.x=player.x;cam.y=player.y;');
    h.run('fireWeaponFrom(player,WEAPONS[player.wi],"ally",1);'+
      'projectiles.length=Math.min(projectiles.length,1);');
    if(!h.run('projectiles.length>0')){out[id]={semProj:true};continue;}
    h.run('projectiles[0].life=999;');
    const r=measure(h,'for(var i=0;i<'+ISO+';i++)drawProjectile(projectiles[0]);');
    const c=r.canvas;
    out[id]={ops:+((c.save+c.restore+c.paths+c.fill+c.stroke+c.transforms+c.arcs+c.drawImage)/ISO).toFixed(2),
      paths:+(c.paths/ISO).toFixed(2),blurDraws:+(c.shadowDraws/ISO).toFixed(3),
      sinCos:+((r.trig.sin+r.trig.cos)/ISO).toFixed(2),
      atan2:+(r.trig.atan2/ISO).toFixed(2),random:r.trig.random};
    h.run('enemies.length=0;projectiles.length=0;');
    h.run('if(typeof rangedFxClear==="function")rangedFxClear();');
  }
  return out;
}
/* stress: STRESS mines (count 1, life 14s — contagem exata) sem update
   de movimento, depois draw em massa + checagem de NaN e caps */
function stress(h){
  h.seed(999);
  h.run('startRun();'+CLEAR+EQUIP('mine')+'cam.x=player.x;cam.y=player.y;');
  h.run('for(var i=0;i<'+STRESS+';i++)fireWeaponFrom(player,WEAPONS[player.wi],"ally",1);');
  const n=h.run('projectiles.length');
  const r=measure(h,DP+DMZ+DIM);
  const c=r.canvas;
  const nan=h.run('projectiles.filter(function(p){return !isFinite(p.x)||!isFinite(p.y)||!isFinite(p.vx)||!isFinite(p.vy);}).length');
  const mMax=h.run('typeof muzzleFx!=="undefined"?muzzleFx.length:0');
  const iMax=h.run('typeof impactFx!=="undefined"?impactFx.length:0');
  h.run('enemies.length=0;projectiles.length=0;');
  h.run('if(typeof rangedFxClear==="function")rangedFxClear();');
  return {projeteis:n,nan,muzzleMax:mMax,impactMax:iMax,
    opsProj:n?+((c.save+c.restore+c.paths+c.fill+c.stroke+c.transforms+c.arcs+c.drawImage)/n).toFixed(2):0,
    blurDraws:c.shadowDraws,random:r.trig.random};
}
function runSide(source,label){
  const h=buildWorld(source);
  const out={label,cenarios:{},idle:null,drawIso:{},stress:null};
  out.idle=idleHash(h);
  for(let ci=0;ci<WEAPONS.length;ci++){
    const wid=WEAPONS[ci],sid=String.fromCharCode(65+ci);
    h.seed(155);
    h.run('startRun();'+CLEAR+EQUIP(wid)+
      'for(var i=0;i<12;i++){var e=spawnEnemy("tank",player.x+120+i*30,player.y,3);e.spawnT=0;e.aim=0;}'+
      'cam.x=player.x;cam.y=player.y;');
    h.run('var __maxP=0,__maxM=0,__maxI=0;');
    const r=measure(h,'for(var __f=0;__f<'+FRAMES+';__f++){'+LOOP+'}');
    const c=r.canvas;
    out.cenarios[sid]={arma:wid,frames:FRAMES,
      opsFrame:+((c.save+c.restore+c.paths+c.fill+c.stroke+c.transforms+c.arcs+c.drawImage)/FRAMES).toFixed(2),
      paths:+(c.paths/FRAMES).toFixed(2),transforms:+(c.transforms/FRAMES).toFixed(2),
      blurDraws:+(c.shadowDraws/FRAMES).toFixed(3),
      sinCosFrame:+((r.trig.sin+r.trig.cos)/FRAMES).toFixed(2),
      atan2Frame:+(r.trig.atan2/FRAMES).toFixed(2),
      randomTotal:r.trig.random,
      projMax:h.run('__maxP'),
      muzzleMax:h.run('typeof muzzleFx!=="undefined"?__maxM:0'),
      impactMax:h.run('typeof impactFx!=="undefined"?__maxI:0')};
    h.run('enemies.length=0;projectiles.length=0;parts.length=0;swings.length=0;xporbs.length=0;ftexts.length=0;');
    h.run('if(typeof rangedFxClear==="function")rangedFxClear();if(typeof deathVisualClear==="function")deathVisualClear();');
  }
  out.drawIso=drawIso(h);
  out.stress=stress(h);
  /* G8 (constantes de vida) e G10 (pool por fonte) — resolvidos aqui,
     onde o sandbox e a fonte do lado estão disponíveis */
  out.vidas=h.run('typeof RANGED_MUZZLE_LIFE_MAX!=="undefined"&&typeof RANGED_IMPACT_LIFE_MAX!=="undefined"?[RANGED_MUZZLE_LIFE_MAX,RANGED_IMPACT_LIFE_MAX]:null');
  out.poolOk=/RANGED_FX_POOL_MAX=192/.test(source)&&
    /function rangedFxTake\(\)\{\s*return rangedFxPool\.length\?rangedFxPool\.pop\(\):\{\};\s*\}/.test(source)&&
    /function rangedFxDrop\(fx\)\{\s*if\(rangedFxPool\.length<RANGED_FX_POOL_MAX\)/.test(source);
  return out;
}

function main(){
  const args=process.argv.slice(2);
  const ref=args.includes('--ref')?args[args.indexOf('--ref')+1]:BASE_REF;
  const antes=runSide(readSource(ref),'ANTES ('+ref.slice(0,7)+')');
  const depois=runSide(readSource(null),'DEPOIS (working tree)');
  console.log('ECHO — PR15.5-E · BENCHMARK ESTRUTURAL DO ARSENAL RANGED');
  console.log('Canvas mock: operações reais, não rasterização/FPS.\n');
  const rows={};
  for(let ci=0;ci<WEAPONS.length;ci++){
    const sid=String.fromCharCode(65+ci);
    const a=antes.cenarios[sid],d=depois.cenarios[sid];
    rows[sid+' '+d.arma]={'A ops/f':a.opsFrame,'D ops/f':d.opsFrame,
      'A blur':a.blurDraws,'D blur':d.blurDraws,
      'A RNG':a.randomTotal,'D RNG':d.randomTotal,
      'projMax':d.projMax,'mzMax':d.muzzleMax,'imMax':d.impactMax};
  }
  console.table(rows);
  console.log('DRAW ISOLADO por projétil (1 projétil real, '+ISO+' draws):');
  const iso={};
  for(const id of Object.keys(depois.drawIso)){
    const a=antes.drawIso[id],d=depois.drawIso[id];
    if(!d||d.semProj){continue;}
    iso[id]={'A ops':a&&a.ops,'D ops':d.ops,'D paths':d.paths,
      'D blur':d.blurDraws,'D sinCos':d.sinCos,'A sinCos':a&&a.sinCos,
      'D atan2':d.atan2,'D random':d.random};
  }
  console.table(iso);
  console.log('STRESS '+STRESS+' projéteis (mine, draw em massa):');
  console.table({'ANTES':{projéteis:antes.stress.projeteis,'ops/proj':antes.stress.opsProj,
      blur:antes.stress.blurDraws,NaN:antes.stress.nan},
    'DEPOIS':{projéteis:depois.stress.projeteis,'ops/proj':depois.stress.opsProj,
      blur:depois.stress.blurDraws,NaN:depois.stress.nan,
      muzzle:depois.stress.muzzleMax,impact:depois.stress.impactMax}});
  console.log('G1 render idle (hash do canvas, dust normalizado):');
  console.log('  ANTES : '+antes.idle);
  console.log('  DEPOIS: '+depois.idle);
  const cen=Object.keys(depois.cenarios);
  const isoKeys=Object.keys(depois.drawIso).filter(k=>depois.drawIso[k]&&!depois.drawIso[k].semProj);
  const gates={
    'G1 idle render byte-idêntico (46 vivos)':antes.idle===depois.idle,
    'G2 zero blur novo (20 cenários)':cen.every(s=>depois.cenarios[s].blurDraws<=antes.cenarios[s].blurDraws),
    'G3 RNG mecânico igual (20 cenários)':cen.every(s=>depois.cenarios[s].randomTotal===antes.cenarios[s].randomTotal),
    'G4 ops/projétil ≤ 40 (draw isolado)':isoKeys.every(k=>depois.drawIso[k].ops<=40),
    'G5 caps muzzle ≤ 48 / impact ≤ 96 (pico)':cen.every(s=>depois.cenarios[s].muzzleMax<=48&&depois.cenarios[s].impactMax<=96),
    'G6 draw purity: zero Math.random em drawProjectile':isoKeys.every(k=>depois.drawIso[k].random===0),
    'G7 zero atan2/proj e sinCos ≤ 6/proj (draw)':isoKeys.every(k=>depois.drawIso[k].atan2===0&&depois.drawIso[k].sinCos<=6),
    'G8 vidas ≤ tetos (.12/.2)':Array.isArray(depois.vidas)&&depois.vidas[0]<=.12&&depois.vidas[1]<=.2,
    'G9 stress 500: zero NaN, caps, ops/proj ≤ 40':depois.stress.nan===0&&
      depois.stress.muzzleMax<=48&&depois.stress.impactMax<=96&&depois.stress.opsProj<=40,
    'G10 pool bounded 192 (cap + take/drop por pool)':depois.poolOk===true
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
module.exports={BASE_REF,WEAPONS,runSide,buildWorld};
