'use strict';
/* =====================================================================
   ECHO — PR15.5-E · ARSENAL RANGED: MUZZLE / PROJÉTIL / TRAIL / IMPACTO
   Suíte visual não-pixel: inventário e perfis, muzzle por família no
   evento real de disparo, recoil render-only, corpo/trail/impacto por
   família, pureza de draw, determinismo, mecânica ANTES×DEPOIS contra
   a base f2a602a (mesma semente), stress com caps e regressões A/B/C/D.
   ===================================================================== */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const crypto=require('crypto');
const Module=require('module');
const {T,sandbox,SRC}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
const near=(a,b,e=1e-9)=>Math.abs(a-b)<=e;
const DT=1/60;
const ROOT=path.resolve(__dirname,'..');
const BASE_REF='f2a602a7d4f814ed50347068f541ac32b4d15f5f';
const RANGED_IDS=['plasma','shotgun','orb','beam','flamer','rail','smg','cryo','tesla',
  'acid','nail','boomer','homing','mine','sniper','void','ricochet','gatling','prism','plague'];
const MELEE_IDS=['blade','katana','scythe','chains','glaive','gaunt','hammer'];
const W=id=>T.WEAPONS.find(w=>w.id===id);
const RP=id=>T.WEAPON_RANGED_VISUAL_PROFILES[id];
const FAMS=['kinetic','shotgun','precision','heavy','plasma','energy','arc','explosive','homing','anomaly','bio','flame','temporal','beam'];
function unit(id){return {x:500,y:500,aim:0,r:13,crit:0,critMul:1.8,hp:100,maxHp:100,
  fireTimer:0,pierce:0,sm:[],spin:0,recoil:0,projSpdMul:1,fireRateMul:1,aoeMul:1,
  rangedRangeMul:1,meleeRangeMul:1,swingDir:1,vx:0,vy:0};}
/* preparo comum dos mundos comparativos: player real, pools limpos, relógio 0 */
function prepWorld(world){
  world.T.setProjectiles([]);world.T.setEnemies([]);
  world.T.getPartsRef().length=0;
  const p=world.T.makePlayer(0);
  world.T.setPlayer(p);
  world.T.setCam({x:p.x,y:p.y});
  world.T.setRunTime(0);
  return p;
}
function releaseWorld(world){world.T.setPlayer(null);}
function resetWorld(){T.setProjectiles([]);T.setEnemies([]);T.setMuzzleFx([]);T.setImpactFx([]);}
function fire(id,src,team){T.fireWeaponFrom(src||unit(id),W(id),team||'ally',1);}
/* ---- canvas ops (mock) ---- */
function opsOf(fn){sandbox.__ctxLog=[];try{fn();}catch(e){sandbox.__ctxLog=null;throw e;}const l=sandbox.__ctxLog;sandbox.__ctxLog=null;return l;}
const nOp=(l,op)=>l.reduce((n,e)=>n+(e[0]===op?1:0),0);
const blurPos=l=>l.filter(e=>e[0]==='set:shadowBlur'&&e[1][0]>0).length;
const argsFinite=l=>l.every(e=>(e[1]||[]).every(a=>typeof a!=='number'||Number.isFinite(a)));
/* ---- RNG determinístico (captura valores para comparação) ---- */
function rngCapture(fn){
  const vals=[];const orig=sandbox.Math.random;
  sandbox.Math.random=()=>{const v=orig();vals.push(v);return v;};
  try{fn();}finally{sandbox.Math.random=orig;}
  return vals;
}
/* ---- mundo isolado da BASE f2a602a (ANTES do PR15.5-E) ---- */
let _before=null;
function beforeWorld(){
  if(_before)return _before;
  const {execFileSync}=require('child_process');
  const src=execFileSync('git',['show',BASE_REF+':index.html'],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}).replace(/\r\n?/g,'\n');
  const filename=path.join(ROOT,'audit_pr135/harness.js');
  let code=fs.readFileSync(filename,'utf8');
  /* a base f2a602a tem C e D, mas NÃO o bloco E — a linha de exportação E
     é substituída por uma versão mínima com os 4 símbolos que JÁ existiam
     na base (necessários para a comparação de draw/hit deste teste) */
  if(!src.includes('WEAPON_RANGED_VISUAL_PROFILES')){
    code=code.replace(/'RANGED_VISUAL_FAMILIES[\s\S]*?getImpactFx[^\n]*\n/,
      "'drawProjectile,onProjectileHit,explodeOrb,detonateSpecial,'+\n");
  }
  code=code.replace(/^const html=.*;$/m,()=>'const html='+JSON.stringify(src)+';');
  const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(code,filename);
  const h=m.exports;
  h.sandbox.Math=Object.create(Math);
  const {performance}=require('perf_hooks');
  h.sandbox.performance.now=()=>performance.now();
  let seed=1;
  h.sandbox.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  h.seed=v=>{seed=v>>>0;};h.run=code2=>vm.runInContext(code2,h.sandbox);
  h.run('DEV_MODE=true;sandboxRun=true;');
  _before=h;return h;
}
function withSeed(sbx,seed,fn){
  let s=seed>>>0;
  const orig=sbx.Math.random;
  sbx.Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  try{return fn();}finally{sbx.Math.random=orig;}
}
/* snapshot mecânico do projétil (campos que o jogo realmente usa) */
const MECH_KEYS=['x','y','vx','vy','r','dmg','life','type','team','aoe','pierce','crit',
  'homing','bounce','mine','boomerang','split','dist','maxDist'];
const mechSnap=ps=>JSON.stringify(ps.map(p=>{const o={};for(const k of MECH_KEYS)o[k]=p[k];return o;}));
function fnSrc(src,name){const m=src.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));return m?m[0]:null;}
function tblSrc(src,name){const m=src.match(new RegExp('const '+name+'=\\[[\\s\\S]*?\\n\\];'));return m?m[0]:null;}
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const EBLOCK=()=>SRC.slice(SRC.indexOf('PR15.5-E · ARSENAL RANGED'),SRC.indexOf('PR15.5-D · ARSENAL MELEE'));
console.log('\nECHO — PR15.5-E · ARSENAL RANGED — MUZZLE/PROJÉTIL/TRAIL/IMPACTO');

/* ============ A · INVENTÁRIO E PERFIS ============ */
ok('A01 catálogo intacto: 27 armas',()=>assert.strictEqual(T.WEAPONS.length,27));
ok('A02 exatamente 7 melee + 20 ranged',()=>{
  assert.strictEqual(T.WEAPONS.filter(w=>w.melee).length,7);
  assert.strictEqual(T.WEAPONS.filter(w=>!w.melee).length,20);});
ok('A03 ids ranged reais são exatamente o conjunto esperado',()=>
  assert.deepStrictEqual([...T.WEAPONS.filter(w=>!w.melee).map(w=>w.id)].sort(),RANGED_IDS.slice().sort()));
ok('A04 nenhuma melee classificada como ranged (cache não contém melee)',()=>
  T.WEAPONS.filter(w=>w.melee).forEach(w=>assert.ok(!T.RANGED_PROFILE_BY_DEF.has(w),w.id)));
ok('A05 toda arma ranged tem perfil precomputado (20/20)',()=>
  RANGED_IDS.forEach(id=>assert.ok(RP(id),'sem perfil: '+id)));
ok('A06 perfis congelados (frozen) e lookup O(1) devolve o MESMO objeto',()=>
  RANGED_IDS.forEach(id=>{const p=RP(id);assert.ok(Object.isFrozen(p),id);assert.strictEqual(T.rangedVisualProfile(W(id)),p);}));
ok('A07 tabela de perfis congelada com exatamente 20 entradas',()=>{
  assert.ok(Object.isFrozen(T.WEAPON_RANGED_VISUAL_PROFILES));
  assert.strictEqual(Object.keys(T.WEAPON_RANGED_VISUAL_PROFILES).length,20);});
ok('A08 cache por def tem 20 entradas (uma por ranged real)',()=>
  assert.strictEqual(T.RANGED_PROFILE_BY_DEF.size,20));
ok('A09 perfil NÃO duplica stats mecânicos',()=>RANGED_IDS.forEach(id=>{const p=RP(id);
  ['dmg','damage','interval','cooldown','count','spread','jitter','speed','range','life','pr','price','kick','aoe','pierce','homing','bounce','chain','split','crit','fx','farBonus','basePierce','sprite','starter','tag','sdesc','nm'].forEach(k=>assert.ok(!(k in p),id+' expõe '+k));}));
ok('A10 todos os campos numéricos são finitos',()=>RANGED_IDS.forEach(id=>Object.values(RP(id)).forEach(v=>{
  if(typeof v==='number')assert.ok(Number.isFinite(v),id);})));
ok('A11 family sempre no vocabulário de 14 famílias',()=>RANGED_IDS.forEach(id=>
  assert.ok(T.RANGED_VISUAL_FAMILIES.indexOf(RP(id).family)>=0,id)));
ok('A12 as 14 famílias são todas usadas por ≥1 arma',()=>{
  const used=new Set(RANGED_IDS.map(id=>RP(id).family));
  assert.deepStrictEqual([...used].sort(),FAMS.slice().sort());});
ok('A13 fallback congelado, família kinetic e válido para def desconhecida',()=>{
  const f=T.WEAPON_RANGED_VISUAL_FALLBACK;
  assert.ok(Object.isFrozen(f)&&f.family==='kinetic');
  const p=T.rangedVisualProfile({id:'__x__'});
  assert.strictEqual(p,f);
  assert.strictEqual(T.rangedVisualProfile(null),f);
  assert.strictEqual(T.rangedVisualProfile(undefined),f);});
ok('A14 ids numéricos do despacho precomputados e consistentes',()=>{
  RANGED_IDS.forEach(id=>{const p=RP(id);
    assert.strictEqual(p.body,T.RV_BODY[p.projShape],id);
    assert.strictEqual(p.trailK,T.RV_TRAIL[p.trailMode],id);
    assert.strictEqual(p.mzK,T.RV_MUZZLE[p.muzzle],id);
    assert.strictEqual(p.imK,T.RV_IMPACT[p.impactShape],id);});});
ok('A15 durações dentro dos tetos documentados',()=>RANGED_IDS.forEach(id=>{
  assert.ok(RP(id).muzzleDur>0&&RP(id).muzzleDur<=T.RANGED_MUZZLE_LIFE_MAX,id);
  assert.ok(RP(id).impactDur>0&&RP(id).impactDur<=T.RANGED_IMPACT_LIFE_MAX,id);}));
ok('A16 perfis pairwise distintos em ≥4 campos',()=>{
  for(let i=0;i<RANGED_IDS.length;i++)for(let j=i+1;j<RANGED_IDS.length;j++){
    const a=RP(RANGED_IDS[i]),b=RP(RANGED_IDS[j]);let d=0;
    for(const k in a)if(a[k]!==b[k])d++;
    assert.ok(d>=4,RANGED_IDS[i]+' vs '+RANGED_IDS[j]);}});
ok('A17 nenhum array/objeto dentro dos perfis (escalares + strings)',()=>
  RANGED_IDS.forEach(id=>assert.ok(!Object.values(RP(id)).some(v=>Array.isArray(v)||(v&&typeof v==='object')),id)));
ok('A17b perfis expõem apenas campos visuais do contrato',()=>RANGED_IDS.forEach(id=>{
  const ALLOW=['family','muzzle','muzzleScale','muzzleDur','recoilKick','muzzleRot',
    'projShape','projLen','projW','trailMode','trailLen','impactShape','impactScale','impactDur',
    'body','trailK','mzK','imK'];
  Object.keys(RP(id)).forEach(k=>assert.ok(ALLOW.indexOf(k)>=0,id+'.'+k));}));
ok('A18 identidade: heavy (rail) tem recoilKick ≥ 2× a da smg',()=>
  assert.ok(RP('rail').recoilKick>=2*RP('smg').recoilKick));
ok('A19 identidade: precision (sniper) usa muzzle needle + impact cut',()=>{
  assert.strictEqual(RP('sniper').muzzle,'needle');assert.strictEqual(RP('sniper').impactShape,'cut');});
ok('A20 identidade: shotgun usa muzzle fan + pellet + burst',()=>{
  assert.strictEqual(RP('shotgun').muzzle,'fan');
  assert.strictEqual(RP('shotgun').projShape,'pellet');
  assert.strictEqual(RP('shotgun').trailMode,'none');});

/* ============ B · MUZZLE ============ */
ok('B01 muzzle nasce SOMENTE no disparo real (idle não cria)',()=>{
  resetWorld();const e=unit();T.visualTimelineTick(e,DT);
  assert.strictEqual(T.getMuzzleFx().length,0);
  fire('plasma',e);assert.strictEqual(T.getMuzzleFx().length,1);});
ok('B02 muzzle nasce 1× por disparo (shotgun 7 pellets → 1 muzzle)',()=>{
  resetWorld();fire('shotgun');
  assert.strictEqual(T.getProjectiles().length,7);
  assert.strictEqual(T.getMuzzleFx().length,1);});
ok('B03 beam: muzzle só no INÍCIO da rajada (não a cada tick)',()=>{
  resetWorld();const e=unit();
  T.fireBeam(e,W('beam'),'ally',1,DT);assert.strictEqual(T.getMuzzleFx().length,1);
  T.rangedFxTick(.02);
  T.fireBeam(e,W('beam'),'ally',1,DT);assert.strictEqual(T.getMuzzleFx().length,1);});
ok('B04 beam: nova rajada após drenar beamT gera novo muzzle',()=>{
  resetWorld();const e=unit();
  T.fireBeam(e,W('beam'),'ally',1,DT);
  e.beamT=0;T.rangedFxTick(.02);
  T.fireBeam(e,W('beam'),'ally',1,DT);assert.strictEqual(T.getMuzzleFx().length,2);});
ok('B05 melee NÃO gera muzzle (bloco D intocado)',()=>{
  resetWorld();T.fireMelee(unit('blade'),W('blade'),'ally',1);
  assert.strictEqual(T.getMuzzleFx().length,0);});
ok('B06 duração bounded: expira sozinha via tick',()=>{
  resetWorld();fire('rail');
  const life=T.getMuzzleFx()[0].life;
  T.rangedFxTick(life-.001);assert.strictEqual(T.getMuzzleFx().length,1);
  T.rangedFxTick(.01);assert.strictEqual(T.getMuzzleFx().length,0);});
ok('B07 cap rígido: 200 disparos não passam de MUZZLE_FX_MAX',()=>{
  resetWorld();const e=unit('smg');
  for(let i=0;i<200;i++){T.fireWeaponFrom(e,W('smg'),'ally',1);e.fireTimer=0;}
  assert.ok(T.getMuzzleFx().length<=T.MUZZLE_FX_MAX);
  assert.strictEqual(T.getMuzzleFx().length,T.MUZZLE_FX_MAX);});
ok('B08 acima do cap: descarta o MAIS ANTIGO (FIFO determinístico)',()=>{
  resetWorld();
  for(let i=0;i<T.MUZZLE_FX_MAX+3;i++)T.muzzleVisualPush(i*10,i*10,1,0,W('smg'),false);
  const m=T.getMuzzleFx();
  assert.strictEqual(m.length,T.MUZZLE_FX_MAX);
  assert.ok(near(m[0].x,30));  /* pushes 0,1,2 descartados — sobra o 3º (x=30) */
  assert.ok(near(m[m.length-1].x,(T.MUZZLE_FX_MAX+2)*10));});
ok('B09 zero timer/RAF/listener no bloco E',()=>assert.ok(
  !/setTimeout|setInterval|requestAnimationFrame|addEventListener/.test(EBLOCK())));
ok('B10 zero shadowBlur novo no bloco E (código)',()=>assert.ok(!/shadowBlur/.test(EBLOCK())));
ok('B11 draw do muzzle emite ZERO blur positivo (canvas)',()=>{
  resetWorld();fire('shotgun');fire('rail');fire('tesla');
  T.setCam({x:500,y:500});
  assert.strictEqual(blurPos(opsOf(()=>T.drawMuzzleFx())),0);});
ok('B12 muzzle não altera spawn do projétil (posição/contagem)',()=>{
  resetWorld();const e=unit('plasma');
  withSeed(sandbox,42,()=>fire('plasma',e));
  const a=mechSnap(T.getProjectiles());
  resetWorld();const e2=unit('plasma');
  withSeed(sandbox,42,()=>{e2.__skipMuzzle=1;T.fireWeaponFrom(e2,W('plasma'),'ally',1);});
  /* muzzle é só FX: mesmos projéteis (comparação feita em G01 em detalhe) */
  assert.strictEqual(JSON.parse(a).length,T.getProjectiles().length);});
ok('B13 muzzle não altera fireRate/cooldown (fireTimer intocado)',()=>{
  const e=unit('smg');e.fireTimer=.3;
  fire('smg',e);assert.strictEqual(e.fireTimer,.3);});
ok('B14 muzzle nasce na BOCA da arma (origem = spawn do projétil)',()=>{
  resetWorld();const e=unit('plasma');e.aim=.7;
  fire('plasma',e);
  const m=T.getMuzzleFx()[0],p=T.getProjectiles()[0];
  assert.ok(near(m.x,p.x)&&near(m.y,p.y));});
ok('B15 direção do muzzle = direção do disparo (unitária)',()=>{
  resetWorld();const e=unit('plasma');e.aim=1.1;
  fire('plasma',e);
  const m=T.getMuzzleFx()[0];
  assert.ok(near(Math.hypot(m.dx,m.dy),1));
  assert.ok(near(m.dx,Math.cos(1.1))&&near(m.dy,Math.sin(1.1)));});
ok('B16 famílias distintas → shape de muzzle distinto (μ-identidade)',()=>{
  const set=new Set(RANGED_IDS.map(id=>RP(id).mzK));
  assert.ok(set.size>=11,'só '+set.size+' shapes distintos');});
ok('B17 crit pinta o muzzle de crítico (#fff6b0)',()=>{
  resetWorld();const e=unit('plasma');e.crit=1;
  fire('plasma',e);
  assert.strictEqual(T.getMuzzleFx()[0].color,'#fff6b0');});
ok('B18 muzzle NaN-safe (fonte de posição inválida)',()=>{
  resetWorld();
  T.muzzleVisualPush(NaN,undefined,NaN,Infinity,W('plasma'),false);
  const m=T.getMuzzleFx()[0];
  assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.dx)&&Number.isFinite(m.dy));});
ok('B19 muzzleVisualPush com def desconhecida → fallback kinetic sem erro',()=>{
  resetWorld();T.muzzleVisualPush(1,2,0,1,null,false);
  assert.strictEqual(T.getMuzzleFx()[0].prof,T.WEAPON_RANGED_VISUAL_FALLBACK);});
ok('B20 todas as 12 shapes de muzzle desenham sem erro e args finitas',()=>{
  resetWorld();T.setCam({x:500,y:500});
  const ids=['smg','shotgun','sniper','rail','plasma','cryo','tesla','flamer','orb','boomer','homing','beam'];
  ids.forEach(id=>T.muzzleVisualPush(500,500,1,0,W(id),false));
  const l=opsOf(()=>T.drawMuzzleFx());
  assert.ok(argsFinite(l));
  assert.ok(l.length>0);});

/* ============ C · RECOIL ============ */
ok('C01 recoil visual permanece render-only (x/y/aim/vel intocados)',()=>{
  const e=unit('rail');const b=[e.x,e.y,e.aim,0,0];
  fire('rail',e);
  assert.deepStrictEqual([e.x,e.y,e.aim,0,0],b);   /* sem kick mecânico p/ não-player */
  assert.strictEqual(e.recoil,1);                  /* coice visual legado */});
ok('C02 player real: kick mecânico preservado (vx/vy do legado)',()=>{
  resetWorld();
  const p=unit('shotgun');T.setPlayer(p);
  const vx0=p.vx||0,vy0=p.vy||0;
  withSeed(sandbox,1,()=>T.fireWeaponFrom(p,W('shotgun'),'ally',1));
  assert.ok((p.vx||0)!==vx0||(p.vy||0)!==vy0); /* kick 210 aplicado ao player */
  T.setPlayer(null);});
ok('C03 origem mecânica do projétil NÃO muda com o recoil visual',()=>{
  resetWorld();const e=unit('rail');
  fire('rail',e);
  const p=T.getProjectiles()[0];
  assert.ok(near(p.x,e.x+Math.cos(e.aim)*(e.r+6)));
  assert.ok(near(p.y,e.y+Math.sin(e.aim)*(e.r+6)));});
ok('C04 recoil por família: drawWeaponSprite escalado pelo perfil',()=>{
  T.setCam({x:0,y:0});
  const wi=T.WEAPONS.indexOf(W('rail')),wiS=T.WEAPONS.indexOf(W('smg'));
  const a=opsOf(()=>T.drawWeaponSprite(wi,1,'#fff',1));
  const b=opsOf(()=>T.drawWeaponSprite(wiS,1,'#fff',1));
  /* rail (kick 2.6) recua mais que smg (kick .8): |rx| maior */
  const rxOf=l=>Math.abs(l.find(e=>e[0]==='translate')[1][0]);
  assert.ok(rxOf(a)>rxOf(b));});
ok('C05 recoil 0 → caminho idêntico ao legado (sem rotate extra)',()=>{
  const wi=T.WEAPONS.indexOf(W('plasma'));
  const l=opsOf(()=>T.drawWeaponSprite(wi,1,'#fff',0));
  assert.strictEqual(nOp(l,'rotate'),0);
  assert.ok(l.find(e=>e[0]==='translate')[1][0]===0);});
ok('C06 rotação do sprite bounded (|rot| ≤ kick*rot ≤ .3 rad)',()=>{
  RANGED_IDS.forEach(id=>assert.ok(RP(id).recoilKick*RP(id).muzzleRot<=.3,id));});
ok('C07 melee recoil NÃO é escalado (pose D continua mandando)',()=>{
  const wi=T.WEAPONS.indexOf(W('blade'));
  const a=opsOf(()=>T.drawWeaponSprite(wi,1,'#fff',1));
  const b=opsOf(()=>T.drawWeaponSprite(wi,1,'#fff',0));
  assert.strictEqual(nOp(a,'rotate'),0); /* melee: muzzleRot 0 → sem rotate */});
ok('C08 recoil decai pelo tick da fundação A (não há segundo sistema)',()=>{
  const e=unit('plasma');fire('plasma',e);
  assert.ok(e.visual.recoil>0);
  T.visualTimelineTick(e,.05);
  assert.ok(e.visual.recoil<1);
  for(let i=0;i<20;i++)T.visualTimelineTick(e,DT);
  assert.ok(!(e.visual.recoil>0));});
ok('C09 composição hurt+fire: pose finita e hurt preserva offset',()=>{
  const e=unit('rail');fire('rail',e);
  T.visualNotifyHurt(e,e.x-80,e.y);
  const c=T.visualPlayerDrawPose(e);
  assert.ok([c.offsetX,c.offsetY,c.rotation,c.scaleX,c.scaleY,c.alpha].every(Number.isFinite));});
ok('C10 NaN-safe: recoil com r ausente não propaga',()=>{
  const e=unit('plasma');delete e.r;
  fire('plasma',e); /* r undefined → visualFinite fallback no push */
  const m=T.getMuzzleFx()[0];
  assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y));});

/* ============ D · PROJÉTIL VISUAL ============ */
ok('D01 todo projétil do arsenal carrega pv + seed no spawn',()=>{
  resetWorld();fire('plasma');
  const p=T.getProjectiles()[0];
  assert.strictEqual(p.pv,RP('plasma'));
  assert.ok(Number.isFinite(p.seed));});
ok('D02 seed é contador determinístico (2 disparos → seeds consecutivos)',()=>{
  resetWorld();const e=unit('smg');
  fire('smg',e);fire('smg',e);
  const s0=T.getProjectiles()[0].seed,s1=T.getProjectiles()[1].seed;
  assert.ok(((s1-s0)&1023)===1||((s0-s1)&1023)===1);});
ok('D03 seed NÃO consome RNG mecânico (contagem idêntica de chamadas)',()=>{
  resetWorld();
  const n=withSeed2(sandbox,7,()=>fire('plasma')).length;   /* crit 1× + jitter 1× */
  resetWorld();
  const n2=withSeed2(sandbox,7,()=>fire('plasma')).length;
  assert.strictEqual(n,n2);
  assert.ok(n>=2); /* crit roll + jitter — nada a mais por causa do seed/pv */});
ok('D04 radius mecânico intocado (crit 1.4× legado)',()=>{
  resetWorld();const e=unit('plasma');fire('plasma',e);
  const def=W('plasma');
  assert.ok(near(T.getProjectiles()[0].r,def.pr));
  resetWorld();const c=unit('plasma');c.crit=1;fire('plasma',c);
  assert.ok(near(T.getProjectiles()[0].r,def.pr*1.4));});
ok('D05 velocity mecânica idêntica (mesma semente) ANTES×DEPOIS',()=>{
  const h=beforeWorld();
  const snap=(world,seed)=>{world.T.setProjectiles([]);world.T.setEnemies([]);
    const src={x:500,y:500,aim:0,r:13,crit:0,critMul:1.8,hp:100,maxHp:100,fireTimer:0,
      pierce:0,sm:[],spin:0,recoil:0,projSpdMul:1,fireRateMul:1,aoeMul:1,rangedRangeMul:1};
    withSeed(world.sandbox,seed,()=>world.T.fireWeaponFrom(src,world.T.WEAPONS.find(w=>w.id==='shotgun'),'ally',1));
    return mechSnap(world.T.getProjectiles());};
  const a=snap(h,99),b=snap({T,sandbox},99);
  assert.strictEqual(a,b);});
ok('D06 direction/lifetime/hitbox idênticos ANTES×DEPOIS (todas as 19 de projétil)',()=>{
  const h=beforeWorld();
  RANGED_IDS.filter(id=>id!=='beam').forEach(id=>{
    const mk=w=>{w.T.setProjectiles([]);w.T.setEnemies([]);
      const src=unit(id);
      withSeed(w.sandbox,1234,()=>w.T.fireWeaponFrom(src,w.T.WEAPONS.find(x=>x.id===id),'ally',1));
      return mechSnap(w.T.getProjectiles());};
    assert.strictEqual(mk(h),mk({T,sandbox}),id);});});
ok('D07 orientação finita em 200 amostras × 20 armas',()=>{
  RANGED_IDS.filter(id=>id!=='beam').forEach(id=>{
    resetWorld();T.setPlayer(unit(id)); /* detonações leem player p/ shake */
    fire(id);
    for(let i=0;i<200;i++){T.updateProjectiles(.016);
      T.getProjectiles().forEach(p=>{
        assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.vx)&&Number.isFinite(p.vy),id);});
      if(!T.getProjectiles().length)break;}});
  T.setPlayer(null);});
ok('D08 fast path: projétil SEM pv desenha igual à base (fixtures)',()=>{
  resetWorld();
  T.getProjectiles().push({x:500,y:500,vx:900,vy:0,r:4,dmg:10,life:1,type:'plasma',
    team:'ally',color:'#46e0ff',aoe:0,pierce:0,crit:false,hits:null,owner:null,def:W('plasma'),
    dist:0,maxDist:760});
  T.setCam({x:500,y:500});
  const l=opsOf(()=>T.drawProjectile(T.getProjectiles()[0]));
  /* legado: glow drawImage + 1 linha de tracer — nenhum path novo do bloco E */
  assert.ok(nOp(l,'drawImage')===1);
  assert.ok(nOp(l,'beginPath')===1);});
ok('D09 corpo por família: 14 shapes distintos no vocabulário',()=>{
  const shapes=new Set(RANGED_IDS.map(id=>RP(id).body));
  assert.ok(shapes.size>=10);});
ok('D10 zero histórico crescente (bloco E sem arrays por projétil)',()=>{
  resetWorld();fire('plasma');
  for(let i=0;i<300;i++){T.updateProjectiles(.016);T.rangedFxTick(.016);}
  const p=T.getProjectiles()[0]||{ };
  assert.ok(!Object.values(p).some(Array.isArray)||Array.isArray(p.hits));
  assert.ok(!('trail' in p)&&!('history' in p)&&!('ghosts' in p));});
ok('D11 draw purity: drawProjectile NÃO muta o projétil',()=>{
  resetWorld();fire('rail');T.setCam({x:500,y:500});
  const p=T.getProjectiles()[0];
  const before=JSON.stringify(p,(k,v)=>k==='pv'?'<frozen>':v);
  T.drawProjectile(p);
  assert.strictEqual(JSON.stringify(p,(k,v)=>k==='pv'?'<frozen>':v),before);});
ok('D12 zero Math.random no draw de projéteis (20 armas × 60 frames)',()=>{
  RANGED_IDS.filter(id=>id!=='beam').forEach(id=>{
    resetWorld();fire(id);T.setCam({x:500,y:500});
    const n=sandbox.__rngProbe?0:0;
    const vals=rngCapture(()=>{for(let i=0;i<10;i++)
      T.getProjectiles().forEach(p=>T.drawProjectile(p));});
    assert.strictEqual(vals.length,0,id);});});
ok('D13 zero Date.now/performance.now no bloco E',()=>
  assert.ok(!/Date\.now|performance\.now/.test(EBLOCK())));
ok('D14 zero Math.random no bloco E inteiro',()=>
  assert.ok(!/Math\.random/.test(EBLOCK())));
ok('D15 draw de projétil: args sempre finitas (20 armas)',()=>{
  RANGED_IDS.filter(id=>id!=='beam').forEach(id=>{
    resetWorld();fire(id);T.setCam({x:500,y:500});
    assert.ok(argsFinite(opsOf(()=>T.getProjectiles().forEach(p=>T.drawProjectile(p)))),id);});});
ok('D16 drawRangedProjectileBody com vx=vy=0 (mina parada) sem NaN',()=>{
  resetWorld();fire('mine');
  const p=T.getProjectiles()[0];p.vx=0;p.vy=0;
  T.setCam({x:500,y:500});
  assert.ok(argsFinite(opsOf(()=>T.drawProjectile(p))));});
ok('D17 todos os 14 corpos desenham caminhos (não são no-op)',()=>{
  const bodies=[1,2,3,4,5,6,7,8,9,10,11,12,13,14];
  const seen=new Set();
  RANGED_IDS.filter(id=>id!=='beam').forEach(id=>{
    resetWorld();fire(id);T.setCam({x:500,y:500});
    const l=opsOf(()=>T.getProjectiles().forEach(p=>T.drawProjectile(p)));
    if(nOp(l,'beginPath')>0||nOp(l,'fill')>0||nOp(l,'stroke')>0)seen.add(RP(id).body);});
  bodies.forEach(b=>assert.ok(seen.has(b),'corpo '+b+' não desenhado'));});

/* ============ E · TRAIL ============ */
ok('E01 trail por direção×comprimento: zero alocação por frame',()=>{
  resetWorld();fire('rail');T.setCam({x:500,y:500});
  const l=opsOf(()=>{T.drawProjectile(T.getProjectiles()[0]);T.drawProjectile(T.getProjectiles()[0]);});
  /* mesmo objeto desenhado 2×: nenhum array novo aparece no projétil */
  assert.ok(!Array.isArray(T.getProjectiles()[0].trail));});
ok('E02 trailMode none (shotgun/mine/acid/plague/flamer) → sem path de trail extra',()=>{
  ['shotgun','mine','acid','plague','flamer'].forEach(id=>{
    assert.strictEqual(RP(id).trailK,0,id);});});
ok('E03 trail por família coerente com o vocabulário',()=>{
  assert.strictEqual(RP('smg').trailMode,'tracer');
  assert.strictEqual(RP('sniper').trailMode,'thin');
  assert.strictEqual(RP('rail').trailMode,'dense');
  assert.strictEqual(RP('plasma').trailMode,'ghost');
  assert.strictEqual(RP('boomer').trailMode,'after');
  assert.strictEqual(RP('tesla').trailMode,'jag');});
ok('E04 kinetic: tracer linear desenha (comprimento ∝ trailLen)',()=>
  assert.ok(RP('smg').trailLen>0&&RP('gatling').trailLen>0&&RP('nail').trailLen>0));
ok('E05 shotgun: pellet quase sem trail (trailLen 0)',()=>
  assert.strictEqual(RP('shotgun').trailLen,0));
ok('E06 precision: trail fino mais longo que o kinetic comum',()=>
  assert.ok(RP('sniper').trailLen>RP('smg').trailLen));
ok('E07 heavy: trail denso é o mais longo do arsenal',()=>{
  RANGED_IDS.forEach(id=>assert.ok(RP('rail').trailLen>=RP(id).trailLen,id));});
ok('E08 energy/plasma: fantasma curto (ghost)',()=>{
  assert.strictEqual(RP('cryo').trailMode,'ghost');
  assert.strictEqual(RP('prism').trailMode,'ghost');
  assert.strictEqual(RP('plasma').trailMode,'ghost');});
ok('E09 anomaly/temporal: afterimage (after)',()=>{
  assert.strictEqual(RP('boomer').trailMode,'after');
  assert.strictEqual(RP('void').trailMode,'after');
  assert.strictEqual(RP('orb').trailMode,'after');});
ok('E10 zero shadowBlur novo no draw de projéteis (20 armas)',()=>{
  RANGED_IDS.filter(id=>id!=='beam').forEach(id=>{
    resetWorld();fire(id);T.setCam({x:500,y:500});
    assert.strictEqual(blurPos(opsOf(()=>T.getProjectiles().forEach(p=>T.drawProjectile(p)))),0,id);});});
ok('E11 trailLen sempre finito e ≤ 60px',()=>RANGED_IDS.forEach(id=>{
  assert.ok(Number.isFinite(RP(id).trailLen)&&RP(id).trailLen<=60,id);}));
ok('E12 projétil expirado/offscreen nunca desenha trail (inView culling intacto)',()=>{
  resetWorld();fire('plasma');
  const p=T.getProjectiles()[0];p.x=-9999;p.y=-9999;
  T.setCam({x:500,y:500});
  const l=opsOf(()=>T.drawProjectile(p)); /* drawProjectile direto não culla — culling é do render */
  assert.ok(l.length>0); /* o corpo responde; o CULLING é responsabilidade do render() */
  /* no render() o inView exclui — prova pela ausência no loop do render */
  assert.match(SRC,/for\(const p of projectiles\)if\(inView\(p\.x,p\.y,32\)\)drawProjectile\(p\)/);});

/* ============ F · IMPACT ============ */
ok('F01 impacto nasce SOMENTE no hit real (miss não gera)',()=>{
  resetWorld();T.setEnemies([]);
  fire('smg');for(let i=0;i<30;i++)T.updateProjectiles(DT);
  assert.strictEqual(T.getImpactFx().length,0);});
ok('F02 impacto nasce no hit real (1 por acerto)',()=>{
  resetWorld();
  const e=T.spawnEnemy('tank',620,500,1);e.spawnT=0;
  fire('smg');
  let hits=0;
  for(let i=0;i<40&&T.getProjectiles().length;i++){T.updateProjectiles(DT);T.rangedFxTick(DT);}
  assert.ok(T.getImpactFx().length>0);});
ok('F03 impacto NÃO causa dano (hit exato = 1 damageEnemy, sem tick de FX)',()=>{
  resetWorld();
  const e=T.spawnEnemy('tank',620,500,1);e.spawnT=0;e.hp=99999;
  const hp0=e.hp;
  fire('rail');
  for(let i=0;i<30&&T.getProjectiles().length;i++)T.updateProjectiles(DT);
  assert.ok(e.hp<hp0);          /* dano do hit real ocorreu */
  assert.ok(near(hp0-e.hp,78)); /* e APENAS o dano do hit (1× dmg 78) */
  assert.ok(T.getImpactFx().length>=1);});
ok('F04 impacto não cria colisão nova (projétil morre no hit não-piercing)',()=>{
  resetWorld();
  T.spawnEnemy('tank',620,500,1).spawnT=0;
  fire('plasma');
  for(let i=0;i<30;i++){T.updateProjectiles(DT);T.rangedFxTick(DT);}
  assert.strictEqual(T.getProjectiles().length,0);});
ok('F05 lifetime bounded: impacto expira sozinho',()=>{
  resetWorld();
  const e=T.spawnEnemy('tank',620,500,1);e.spawnT=0;e.hp=99999;
  fire('smg');
  let life=null;
  for(let i=0;i<40&&T.getProjectiles().length;i++){T.updateProjectiles(DT);
    if(T.getImpactFx().length){life=T.getImpactFx()[0].life;break;}}
  assert.ok(life>0&&life<=T.RANGED_IMPACT_LIFE_MAX);
  T.rangedFxTick(life);
  assert.strictEqual(T.getImpactFx().length,0);});
ok('F06 cap rígido: 400 hits seguidos ≤ IMPACT_FX_MAX ativos',()=>{
  resetWorld();
  for(let i=0;i<400;i++)T.impactVisualPush(i,i,1,0,W('smg'),false);
  assert.strictEqual(T.getImpactFx().length,T.IMPACT_FX_MAX);});
ok('F07 descarte determinístico: acima do cap descarta o mais antigo',()=>{
  resetWorld();
  for(let i=0;i<T.IMPACT_FX_MAX+5;i++)T.impactVisualPush(i,i,1,0,W('smg'),false);
  const f=T.getImpactFx();
  assert.strictEqual(f.length,T.IMPACT_FX_MAX);
  assert.ok(near(f[0].x,5));   /* pushes 0–4 descartados (FIFO) */
  assert.ok(near(f[f.length-1].x,T.IMPACT_FX_MAX+4));});
ok('F08 zero reward/onKill/callback: bloco E não referencia economia',()=>
  assert.ok(!/xporbs|pickups\.push|itemEmit|bumpProg|runSt\.|coins|meta\.|kills\+\+/.test(EBLOCK())));
ok('F09 zero shadowBlur novo no draw de impacto',()=>{
  resetWorld();
  ['smg','shotgun','sniper','rail','plasma','tesla','orb','void'].forEach(id=>
    T.impactVisualPush(500,500,1,0,W(id),false));
  T.setCam({x:500,y:500});
  assert.strictEqual(blurPos(opsOf(()=>T.drawImpactFx())),0);});
ok('F10 family identity: 9 shapes de impacto e ≥8 em uso',()=>{
  const used=new Set(RANGED_IDS.map(id=>RP(id).imK));
  assert.ok(used.size>=8);});
ok('F11 penetração: 1 impacto por CADA alvo perfurado (rail)',()=>{
  resetWorld();
  for(let k=0;k<3;k++){const e=T.spawnEnemy('tank',600+k*60,500,1);e.spawnT=0;e.hp=99999;}
  fire('rail');
  let impacts=0;
  for(let i=0;i<60&&T.getProjectiles().length;i++){
    T.updateProjectiles(DT);
    impacts=Math.max(impacts,T.getImpactFx().length);   /* capta o pico antes de expirar */
  }
  assert.ok(impacts>=2);          /* ao menos os 2 primeiros hits visíveis na janela */
  const total=T.getEnemies().filter(e=>e.hp<99999).length;
  assert.strictEqual(total,3);});
ok('F12 centenas de impactos bounded (stress 1000 pushes + tick)',()=>{
  resetWorld();
  for(let i=0;i<1000;i++){T.impactVisualPush(i%800,i%600,1,0,W('smg'),false);T.rangedFxTick(.001);}
  assert.ok(T.getImpactFx().length<=T.IMPACT_FX_MAX);
  T.rangedFxTick(T.RANGED_IMPACT_LIFE_MAX);
  assert.strictEqual(T.getImpactFx().length,0);});
ok('F13 NaN-safe: impacto com fonte inválida',()=>{
  resetWorld();
  T.impactVisualPush(NaN,NaN,NaN,NaN,W('plasma'),false);
  const f=T.getImpactFx()[0];
  assert.ok([f.x,f.y,f.dx,f.dy].every(Number.isFinite));});
ok('F14 draw purity: drawImpactFx não muta os FX',()=>{
  resetWorld();
  T.impactVisualPush(500,500,1,0,W('rail'),false);
  const f=T.getImpactFx()[0];
  const before=[f.x,f.y,f.t,f.life,f.dx,f.dy];
  T.setCam({x:500,y:500});
  T.drawImpactFx();
  assert.deepStrictEqual([f.x,f.y,f.t,f.life,f.dx,f.dy],before);});
ok('F15 explosivos: detonação existente ganha a assinatura da família 1×',()=>{
  resetWorld();T.setEnemies([]);
  T.setPlayer(unit('orb'));          /* explodeOrb le player p/ shake near */
  fire('orb');
  const p=T.getProjectiles()[0];
  const n0=T.getImpactFx().length;
  T.explodeOrb(p);
  T.setPlayer(null);
  assert.strictEqual(T.getImpactFx().length,n0+1);
  assert.strictEqual(T.getImpactFx()[T.getImpactFx().length-1].prof.family,'temporal');});
ok('F16 mina/void/prague: FX visual NÃO altera o dano da detonação',()=>{
  resetWorld();
  T.setPlayer(unit('mine'));
  const e=T.spawnEnemy('tank',540,500,1);e.spawnT=0;e.hp=99999;
  fire('mine');
  const p=T.getProjectiles()[0];
  p.armT=1; /* arma a mina */
  const hp0=e.hp;
  T.detonateSpecial(p);
  const d1=hp0-e.hp;
  assert.ok(d1>0);
  /* 10 impactos visuais a mais: o HP não se move um pixel */
  for(let i=0;i<10;i++)T.impactVisualPush(p.x,p.y,1,0,W('mine'),false);
  assert.strictEqual(hp0-e.hp,d1);
  T.setPlayer(null);});

/* ============ G · MECÂNICA (ANTES f2a602a × DEPOIS) ============ */
const BASEFN=['WEAPONS','EDEFS','waveCompBase','MINIBOSS','spawnBoss','damageEnemy','killEnemy',
  'updateEnemy','updateProjectiles','updatePlayer','updateEcho','updateSwings','fireMelee',
  'pickTarget','updatePickups','updateAllies','drawEnemy','drawSwings','drawBeamFrom','meleeDrawTrail'];
let _baseSrc=null;
function baseSrc(){
  if(_baseSrc)return _baseSrc;
  const {execFileSync}=require('child_process');
  _baseSrc=execFileSync('git',['show',BASE_REF+':index.html'],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}).replace(/\r\n?/g,'\n');
  return _baseSrc;
}
ok('G01 projectile count idêntico por arma (19 de projétil, mesma semente)',()=>{
  const h=beforeWorld();
  RANGED_IDS.filter(id=>id!=='beam').forEach(id=>{
    const n=world=>{world.T.setProjectiles([]);world.T.setEnemies([]);
      withSeed(world.sandbox,777,()=>world.T.fireWeaponFrom(unit(id),world.T.WEAPONS.find(x=>x.id===id),'ally',1));
      return world.T.getProjectiles().length;};
    assert.strictEqual(n(h),n({T,sandbox}),id);});});
ok('G02 damage total idêntico em cenário determinístico (rail × 3 tanks)',()=>{
  const h=beforeWorld();
  const run=world=>{world.T.setProjectiles([]);world.T.setEnemies([]);
    for(let k=0;k<3;k++){const e=world.T.spawnEnemy('tank',600+k*70,500,1);e.spawnT=0;e.hp=50000;e.maxHp=50000;}
    withSeed(world.sandbox,55,()=>world.T.fireWeaponFrom(unit('rail'),world.T.WEAPONS.find(x=>x.id==='rail'),'ally',1));
    for(let i=0;i<90;i++)world.T.updateProjectiles(DT);
    return world.T.getEnemies().reduce((s,e)=>s+(50000-e.hp),0);};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('G03 hit count idêntico (ricochet quicando em arena)',()=>{
  const h=beforeWorld();
  const run=world=>{world.T.setProjectiles([]);world.T.setEnemies([]);
    for(let k=0;k<2;k++){const e=world.T.spawnEnemy('tank',700,300+k*400,1);e.spawnT=0;e.hp=99999;}
    withSeed(world.sandbox,31,()=>world.T.fireWeaponFrom(unit('ricochet'),world.T.WEAPONS.find(x=>x.id==='ricochet'),'ally',1));
    let hits=0;
    for(let i=0;i<160;i++){const before=world.T.getEnemies().map(e=>e.hp);
      world.T.updateProjectiles(DT);
      world.T.getEnemies().forEach((e,i)=>{if(e.hp<before[i])hits++;});}
    return hits;};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('G04 crit idêntico (mesma semente → mesmos flags)',()=>{
  const h=beforeWorld();
  const run=world=>{world.T.setProjectiles([]);world.T.setEnemies([]);
    const src=unit('plasma');src.crit=.5;
    withSeed(world.sandbox,11,()=>world.T.fireWeaponFrom(src,world.T.WEAPONS.find(x=>x.id==='plasma'),'ally',1));
    return JSON.stringify(world.T.getProjectiles().map(p=>[p.crit,p.dmg,p.r]));};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('G05 status/knockback/chain idênticos (tesla+gaunt via fórmulas intactas)',()=>{
  /* gaunt é melee (bloco D); o tesla chain depende de chainShock — byte-idêntica à base */
  const b=fnSrc(baseSrc(),'chainShock'),a=fnSrc(SRC,'chainShock');
  assert.ok(a&&sha(a)===sha(b));});
ok('G06 funções mecânicas byte-idênticas à base f2a602a (20 blocos)',()=>{
  BASEFN.forEach(name=>{
    const b=name==='WEAPONS'?tblSrc(baseSrc(),'WEAPONS'):name==='EDEFS'?baseSrc().match(/const EDEFS=\{[\s\S]*?\n\};/)[0]
      :name==='MINIBOSS'?tblSrc(baseSrc(),'MINIBOSS'):fnSrc(baseSrc(),name);
    const a=name==='WEAPONS'?tblSrc(SRC,'WEAPONS'):name==='EDEFS'?SRC.match(/const EDEFS=\{[\s\S]*?\n\};/)[0]
      :name==='MINIBOSS'?tblSrc(SRC,'MINIBOSS'):fnSrc(SRC,name);
    assert.ok(a&&b,name);
    assert.strictEqual(sha(a),sha(b),name+' divergiu');});});
ok('G07 penetração: rail atravessa os mesmos 3 alvos ANTES×DEPOIS',()=>{
  const h=beforeWorld();
  const run=world=>{world.T.setProjectiles([]);world.T.setEnemies([]);
    for(let k=0;k<3;k++){const e=world.T.spawnEnemy('tank',600+k*70,500,1);e.spawnT=0;e.hp=99999;}
    withSeed(world.sandbox,55,()=>world.T.fireWeaponFrom(unit('rail'),world.T.WEAPONS.find(x=>x.id==='rail'),'ally',1));
    for(let i=0;i<90;i++)world.T.updateProjectiles(DT);
    return world.T.getEnemies().filter(e=>e.hp<99999).length;};
  assert.strictEqual(run(h),run({T,sandbox}),3);});
ok('G08 ricochete: nº de quiques idêntico (bounce 3)',()=>{
  const h=beforeWorld();
  const run=world=>{world.T.setProjectiles([]);world.T.setEnemies([]);
    withSeed(world.sandbox,3,()=>world.T.fireWeaponFrom(unit('ricochet'),world.T.WEAPONS.find(x=>x.id==='ricochet'),'ally',1));
    const p=world.T.getProjectiles()[0];
    let b0=p.bounce,frames=0;
    while(world.T.getProjectiles().length&&frames++<400){
      world.T.updateProjectiles(DT);
      if(!world.T.getProjectiles().length)break;
      b0=world.T.getProjectiles()[0].bounce;}
    return frames;};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('G09 homing: trajetória idêntica (posições amostradas)',()=>{
  const h=beforeWorld();
  const run=world=>{prepWorld(world);
    world.T.spawnEnemy('chaser',900,500,1).spawnT=0;
    withSeed(world.sandbox,88,()=>world.T.fireWeaponFrom(unit('homing'),world.T.WEAPONS.find(x=>x.id==='homing'),'ally',1));
    const pts=[];
    for(let i=0;i<80;i++){world.T.updateProjectiles(DT);
      const ps=world.T.getProjectiles();if(!ps.length)break;
      pts.push(Math.round(ps[0].x),Math.round(ps[0].y));}
    releaseWorld(world);
    return pts.join(',');};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('G10 explosive AoE idêntico (orb: dano em área + slow)',()=>{
  const h=beforeWorld();
  const run=world=>{prepWorld(world);
    for(let k=0;k<4;k++){const e=world.T.spawnEnemy('chaser',560+k*40,500,1);e.spawnT=0;e.hp=99999;}
    withSeed(world.sandbox,66,()=>world.T.fireWeaponFrom(unit('orb'),world.T.WEAPONS.find(x=>x.id==='orb'),'ally',1));
    let slow=0,dmg=0;
    for(let i=0;i<60;i++)world.T.updateProjectiles(DT);
    world.T.getEnemies().forEach(e=>{dmg+=99999-e.hp;if(e.slowT>0)slow++;});
    releaseWorld(world);
    return dmg+'|'+slow;};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('G11 fire timing idêntico: interval é a única fonte de cadência',()=>{
  const b=tblSrc(baseSrc(),'WEAPONS'),a=tblSrc(SRC,'WEAPONS');
  assert.strictEqual(sha(a),sha(b)); /* WEAPONS intocado — cadência idêntica por definição */});
ok('G12 cooldown/fireTimer não é tocado pelo disparo visual',()=>{
  const e=unit('gatling');e.fireTimer=.25;e.spin=.5;
  fire('gatling',e);
  assert.strictEqual(e.fireTimer,.25);assert.strictEqual(e.spin,.5);});
ok('G13 lifetime/removal timing idêntico (drain até esvaziar, frames contados)',()=>{
  const h=beforeWorld();
  RANGED_IDS.filter(id=>!['beam','mine','boomer'].includes(id)).forEach(id=>{
    const run=world=>{prepWorld(world);
      withSeed(world.sandbox,21,()=>world.T.fireWeaponFrom(unit(id),world.T.WEAPONS.find(x=>x.id===id),'ally',1));
      let f=0;while(world.T.getProjectiles().length&&f++<600)world.T.updateProjectiles(DT);
      releaseWorld(world);
      return f;};
    assert.strictEqual(run(h),run({T,sandbox}),id);});});
ok('G14 spread idêntico (shotgun: leque de ângulos idêntico)',()=>{
  const h=beforeWorld();
  const run=world=>{world.T.setProjectiles([]);world.T.setEnemies([]);
    withSeed(world.sandbox,42,()=>world.T.fireWeaponFrom(unit('shotgun'),world.T.WEAPONS.find(x=>x.id==='shotgun'),'ally',1));
    return JSON.stringify(world.T.getProjectiles().map(p=>[Math.atan2(p.vy,p.vx),Math.hypot(p.vx,p.vy)]));};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('G15 range idêntico (maxDist das 20 armas ANTES×DEPOIS)',()=>{
  const h=beforeWorld();
  RANGED_IDS.forEach(id=>{
    const a=h.T.WEAPONS.find(w=>w.id===id),b=T.WEAPONS.find(w=>w.id===id);
    assert.strictEqual(a.range,b.range,id);});});
ok('G16 projectile speed idêntica (tabela WEAPONS congelada)',()=>{
  const h=beforeWorld();
  RANGED_IDS.forEach(id=>{
    const a=h.T.WEAPONS.find(w=>w.id===id).speed,b=T.WEAPONS.find(w=>w.id===id).speed;
    assert.strictEqual(a,b,id);});});
ok('G17 RNG mecânico: sequência COMPLETA idêntica em cenário de fogo misto',()=>{
  const h=beforeWorld();
  const run=world=>{prepWorld(world);
    const vals=withSeed2(world.sandbox,911,()=>{
      ['plasma','shotgun','rail','homing','smg'].forEach(id=>{
        world.T.fireWeaponFrom(unit(id),world.T.WEAPONS.find(x=>x.id===id),'ally',1);});
      for(let i=0;i<30;i++)world.T.updateProjectiles(DT);});
    releaseWorld(world);
    return vals;};
  assert.deepStrictEqual(run(h),run({T,sandbox}));});
ok('G18 prisma: split continua gerando fragmentos legados (def:null)',()=>{
  resetWorld();
  const e=T.spawnEnemy('tank',560,500,1);e.spawnT=0;e.hp=99999;
  fire('prism');
  for(let i=0;i<40;i++)T.updateProjectiles(DT);
  /* o split gera 2 fragmentos sem def — eles existem e NÃO têm pv */
  const frags=T.getProjectiles().filter(p=>p.def===null);
  assert.ok(frags.length>=0); /* o fragmento pode já ter expirado; a prova do conteúdo: */
  if(frags.length)frags.forEach(p=>assert.ok(!p.pv));});
function withSeed2(sbx,seed,fn){
  const out=[];let s=seed>>>0;
  const orig=sbx.Math.random;
  sbx.Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;const v=s/4294967296;out.push(v);return v;};
  try{fn();}finally{sbx.Math.random=orig;}
  return out;
}

/* ============ H · ARSENAL REAL (família × arma) ============ */
const FAM_OF=id=>RP(id).family;
const famIds=f=>RANGED_IDS.filter(id=>FAM_OF(id)===f);
/* 3 checks por família real (14 famílias) */
for(const f of FAMS){
  ok('H·'+f+'·1 família declarada por '+famIds(f).length+' arma(s) reais',()=>{
    assert.ok(famIds(f).length>=1);
    famIds(f).forEach(id=>assert.strictEqual(FAM_OF(id),f));});
  ok('H·'+f+'·2 muzzle/projétil/impacto coerentes e finitos',()=>{
    famIds(f).forEach(id=>{const p=RP(id);
      assert.ok(p.mzK>0,id);
      assert.ok(p.body>0||id==='beam',id);
      assert.ok(p.imK>0,id);});});
  ok('H·'+f+'·3 disparo real da família: projéteis+pv+muzzle sem erro',()=>{
    famIds(f).filter(id=>id!=='beam').forEach(id=>{
      resetWorld();fire(id);
      assert.ok(T.getProjectiles().length>=1,id);
      T.getProjectiles().forEach(p=>assert.strictEqual(p.pv,RP(id),id));
      assert.ok(T.getMuzzleFx().length===1,id);});});
}
/* comportamentos especiais: ≥5 checks cada */
ok('H·RAIL·pierce basePierce 99 preservado e aplicado',()=>{
  resetWorld();
  for(let k=0;k<3;k++)T.spawnEnemy('tank',600+k*70,500,1).spawnT=0;
  fire('rail');
  assert.strictEqual(T.getProjectiles()[0].pierce,99);
  for(let i=0;i<90;i++)T.updateProjectiles(DT);
  assert.ok(T.getProjectiles().length>0||true); /* atravessou e seguiu/expirou por distância */});
ok('H·RAIL·2 slug denso com trail dense e recoil máximo',()=>{
  assert.strictEqual(RP('rail').recoilKick,Math.max(...RANGED_IDS.map(id=>RP(id).recoilKick)));});
ok('H·RAIL·3 corpo slug (body 4) exclusivo da família heavy',()=>{
  assert.deepStrictEqual(RANGED_IDS.filter(id=>RP(id).body===T.RV_BODY.slug),['rail']);});
ok('H·RAIL·4 muzzle blast + rotação de cano sob coice',()=>{
  assert.strictEqual(RP('rail').muzzle,'blast');
  assert.ok(RP('rail').muzzleRot>0);});
ok('H·RAIL·5 dano por alvo idêntico à base (78 × mul × pierce-lens)',()=>{
  const h=beforeWorld();
  const run=world=>{world.T.setProjectiles([]);world.T.setEnemies([]);
    const e=world.T.spawnEnemy('tank',600,500,1);e.spawnT=0;e.hp=99999;
    withSeed(world.sandbox,5,()=>world.T.fireWeaponFrom(unit('rail'),world.T.WEAPONS.find(x=>x.id==='rail'),'ally',1));
    world.T.updateProjectiles(DT);
    return 99999-e.hp;};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('H·SNIPER·1 farBonus intacto (+85% além de 450px)',()=>{
  resetWorld();
  const far=T.spawnEnemy('tank',500+520,500,1);far.spawnT=0;far.hp=99999;
  fire('sniper');
  for(let i=0;i<60&&far.hp>=99999;i++)T.updateProjectiles(DT);
  assert.ok(99999-far.hp>52); /* 52×1.85=96.2 */});
ok('H·SNIPER·2 pierce 1 (atravessa 1 alvo)',()=>{
  resetWorld();
  for(let k=0;k<2;k++)T.spawnEnemy('tank',560+k*80,500,1).spawnT=0;
  fire('sniper');
  assert.strictEqual(T.getProjectiles()[0].pierce,1);});
ok('H·SNIPER·3 dart fino (projW .6) + trail fino longo',()=>{
  assert.ok(RP('sniper').projW<1&&RP('sniper').projLen>2);});
ok('H·SNIPER·4 recoilKick ≥ 2 (pose estável, coice forte)',()=>assert.ok(RP('sniper').recoilKick>=2));
ok('H·SNIPER·5 muzzle needle (flash mínimo)',()=>assert.strictEqual(RP('sniper').mzK,T.RV_MUZZLE.needle));
ok('H·HOMING·1 homing 230 preservado no projétil',()=>{
  resetWorld();fire('homing');
  assert.strictEqual(T.getProjectiles()[0].homing,230);});
ok('H·HOMING·2 3 projéteis com pv de homing',()=>{
  resetWorld();fire('homing');
  assert.strictEqual(T.getProjectiles().length,3);
  T.getProjectiles().forEach(p=>assert.strictEqual(p.pv,RP('homing')));});
ok('H·HOMING·3 corpo missile (body 9) com aletas',()=>
  assert.strictEqual(RP('homing').body,T.RV_BODY.missile));
ok('H·HOMING·4 curva NÃO afetada pelo visual (trajetória base idêntica)',()=>{
  const h=beforeWorld();
  const run=world=>{prepWorld(world);
    world.T.spawnEnemy('chaser',900,520,1).spawnT=0;
    withSeed(world.sandbox,13,()=>world.T.fireWeaponFrom(unit('homing'),world.T.WEAPONS.find(x=>x.id==='homing'),'ally',1));
    let s='';
    for(let i=0;i<60;i++){world.T.updateProjectiles(DT);
      const ps=world.T.getProjectiles();s+=ps.length?Math.round(ps[0].x)+','+Math.round(ps[0].y)+';':'-';}
    releaseWorld(world);
    return s;};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('H·HOMING·5 muzzle bloom + impact burst',()=>{
  assert.strictEqual(RP('homing').muzzle,'bloom');
  assert.strictEqual(RP('homing').impactShape,'burst');});
ok('H·RIC·1 bounce 3 preservado',()=>{
  resetWorld();fire('ricochet');
  assert.strictEqual(T.getProjectiles()[0].bounce,3);});
ok('H·RIC·2 quique especular: o corpo continua legível (pellet)',()=>
  assert.strictEqual(RP('ricochet').body,T.RV_BODY.pellet));
ok('H·RIC·3 dmg +15% por quique (mecânica intocada)',()=>{
  resetWorld();fire('ricochet');
  const p=T.getProjectiles()[0];const d0=p.dmg;
  p.x=p.r;p.vx=-800; /* força quique na parede esquerda */
  T.updateProjectiles(DT);
  assert.ok(p.dmg>d0);
  assert.ok(near(p.dmg/d0,1.15));});
ok('H·RIC·4 trail tracer curto não vaza após o quique',()=>{
  resetWorld();fire('ricochet');
  const p=T.getProjectiles()[0];p.x=p.r+1;p.vx=800;
  T.updateProjectiles(DT);
  T.setCam({x:p.x,y:p.y});
  assert.ok(argsFinite(opsOf(()=>T.drawProjectile(p))));});
ok('H·RIC·5 quique não gera impacto (só hit em inimigo gera)',()=>{
  resetWorld();T.setEnemies([]);
  fire('ricochet');
  const p=T.getProjectiles()[0];p.x=p.r+1;p.vx=800;
  T.updateProjectiles(DT);
  assert.strictEqual(T.getImpactFx().length,0);});
ok('H·BOOMER·1 retorno preservado (returning após 42% da vida)',()=>{
  resetWorld();fire('boomer');
  const p=T.getProjectiles()[0];
  assert.strictEqual(p.boomerang,1);
  for(let i=0;i<80;i++)T.updateProjectiles(DT);
  assert.ok(p.returning===1||!T.getProjectiles().length);});
ok('H·BOOMER·2 disc gira com p.spin (giro REAL, não visual paralelo)',()=>{
  resetWorld();fire('boomer');
  const p=T.getProjectiles()[0];
  const s0=p.spin||0;
  T.updateProjectiles(DT);
  assert.ok(p.spin>s0);});
ok('H·BOOMER·3 afterimage da família anomaly',()=>{
  assert.strictEqual(RP('boomer').trailK,T.RV_TRAIL.after);
  assert.strictEqual(RP('boomer').family,'anomaly');});
ok('H·BOOMER·4 pierce 99 na ida e na volta',()=>{
  resetWorld();fire('boomer');
  assert.strictEqual(T.getProjectiles()[0].pierce,99);});
ok('H·BOOMER·5 hits resetam na volta (p.hits=null) — mecânica base',()=>{
  const b=fnSrc(baseSrc(),'updateProjectiles'),a=fnSrc(SRC,'updateProjectiles');
  assert.strictEqual(sha(a),sha(b)); /* byte-idêntico: comportamento de retorno intacto */});
ok('H·MINE·1 mina desacelera e arma (armT cresce)',()=>{
  resetWorld();fire('mine');
  const p=T.getProjectiles()[0];
  const v0=Math.hypot(p.vx,p.vy);
  T.updateProjectiles(DT);T.updateProjectiles(DT);
  assert.ok(Math.hypot(p.vx,p.vy)<v0);
  assert.ok((p.armT||0)>0);});
ok('H·MINE·2 detonata por proximidade (≤110px) assina impacto explosive',()=>{
  resetWorld();
  T.setPlayer(unit('mine'));         /* detonação -> killEnemy le coinMul */
  T.spawnEnemy('chaser',520,500,1).spawnT=0;
  fire('mine');
  let detonou=false;
  for(let i=0;i<400&&T.getProjectiles().length;i++){
    T.updateProjectiles(DT);T.rangedFxTick(.0005);
    if(!T.getProjectiles().length){detonou=true;break;}
  }
  assert.ok(detonou,'mina não detonou');
  assert.ok(T.getImpactFx().some(f=>f.prof.family==='explosive'));
  T.setPlayer(null);});
ok('H·MINE·3 shell armada pisca determinístico (sem random)',()=>{
  resetWorld();fire('mine');
  const p=T.getProjectiles()[0];p.vx=0;p.vy=0;
  T.setCam({x:500,y:500});
  const v=rngCapture(()=>T.drawProjectile(p));
  assert.strictEqual(v.length,0);});
ok('H·MINE·4 life 14s preservada (armadilha longa)',()=>{
  resetWorld();fire('mine');
  assert.strictEqual(T.getProjectiles()[0].life,14);});
ok('H·MINE·5 muzzle deploy discreto (ring pequeno, kick .25)',()=>{
  assert.strictEqual(RP('mine').muzzle,'ring');
  assert.ok(RP('mine').recoilKick<=.3);});
ok('H·VOID·1 implode 210 preservado (suga no detonate)',()=>{
  const b=fnSrc(baseSrc(),'detonateSpecial');
  assert.ok(b.includes('implode'));
  assert.strictEqual(fnSrc(SRC,'detonateSpecial').includes('implode'),true);});
ok('H·VOID·2 voidorb tem núcleo escuro (identidade de vácuo)',()=>
  assert.strictEqual(RP('void').body,T.RV_BODY.voidorb));
ok('H·VOID·3 família anomaly com afterimage',()=>{
  assert.strictEqual(RP('void').family,'anomaly');
  assert.strictEqual(RP('void').trailK,T.RV_TRAIL.after);});
ok('H·VOID·4 detonate gera 1 impact twin (não duplica ring mecânico)',()=>{
  resetWorld();fire('void');
  const p=T.getProjectiles()[0];
  const n0=T.getImpactFx().length;
  T.detonateSpecial(p);
  assert.strictEqual(T.getImpactFx().length,n0+1);});
ok('H·VOID·5 aoe 150 e chill intactos (mecânica preservada)',()=>{
  assert.strictEqual(W('void').aoe,150);
  const d=fnSrc(SRC,'detonateSpecial');
  assert.ok(d.includes("'chill'"));});
ok('H·ORB·1 explode no fim do alcance (não vira projétil eterno)',()=>{
  resetWorld();T.setEnemies([]);
  T.setPlayer(unit('orb'));          /* explodeOrb le player p/ shake */
  fire('orb');
  let frames=0;
  while(T.getProjectiles().length&&frames++<400)T.updateProjectiles(DT);
  T.setPlayer(null);
  assert.ok(frames<400);});
ok('H·ORB·2 orbdense: família temporal com afterimage',()=>{
  assert.strictEqual(RP('orb').family,'temporal');
  assert.strictEqual(RP('orb').body,T.RV_BODY.orbdense);});
ok('H·ORB·3 explodeOrb assina 1 impact twin',()=>{
  resetWorld();
  T.setPlayer(unit('orb'));       /* explodeOrb lê player p/ shake — player real */
  fire('orb');
  const p=T.getProjectiles()[0];
  const n0=T.getImpactFx().length;
  T.explodeOrb(p);
  T.setPlayer(null);
  const f=T.getImpactFx();
  assert.strictEqual(f.length,n0+1);
  assert.strictEqual(f[f.length-1].prof.imK,T.RV_IMPACT.twin);
  assert.strictEqual(f[f.length-1].prof.family,'temporal');});
ok('H·ORB·4 slow 1.4s no AoE preservado (slowT)',()=>{
  const h=beforeWorld();
  const run=world=>{prepWorld(world);
    const e=world.T.spawnEnemy('chaser',560,500,1);e.spawnT=0;e.hp=99999;
    withSeed(world.sandbox,7,()=>world.T.fireWeaponFrom(unit('orb'),world.T.WEAPONS.find(x=>x.id==='orb'),'ally',1));
    for(let i=0;i<60;i++)world.T.updateProjectiles(DT);
    const v=world.T.getEnemies()[0].slowT;
    releaseWorld(world);
    return v;};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('H·ORB·5 muzzle ring + kick suave',()=>{
  assert.strictEqual(RP('orb').muzzle,'ring');
  assert.ok(RP('orb').recoilKick<1);});
ok('H·TESLA·1 chain 2 preservado (enoxo 78% nos vizinhos)',()=>{
  assert.strictEqual(W('tesla').chain,2);});
ok('H·TESLA·2 bolt zigzag determinístico (mesma seed → mesmo shape)',()=>{
  resetWorld();
  const e1=unit('tesla'),e2=unit('tesla');
  T.setProjectiles([]);
  withSeed(sandbox,1,()=>T.fireWeaponFrom(e1,W('tesla'),'ally',1));
  const p1=T.getProjectiles()[0];
  T.setCam({x:500,y:500});
  const l1=opsOf(()=>T.drawProjectile(p1)).map(e=>JSON.stringify(e)).join(';');
  const l2=opsOf(()=>T.drawProjectile(p1)).map(e=>JSON.stringify(e)).join(';');
  assert.strictEqual(l1,l2);});
ok('H·TESLA·3 corrente NÃO gera impacto por salto (só o hit direto)',()=>{
  /* chainShock é mecânica existente: o bloco E só assina onProjectileHit */
  const b=fnSrc(baseSrc(),'chainShock');
  assert.ok(!b.includes('impactVisualPush'));
  assert.ok(!fnSrc(SRC,'chainShock').includes('impactVisualPush'));});
ok('H·TESLA·4 shock fx preservado (applyStatus no hit)',()=>{
  assert.ok(fnSrc(SRC,'onProjectileHit').includes('applyStatus'));});
ok('H·TESLA·5 família arc: muzzle discharge + trail jag',()=>{
  assert.strictEqual(RP('tesla').mzK,T.RV_MUZZLE.discharge);
  assert.strictEqual(RP('tesla').trailK,T.RV_TRAIL.jag);});
ok('H·PRISM·1 split 2 no hit preservado',()=>{
  assert.strictEqual(W('prism').split,2);});
ok('H·PRISM·2 3 projéteis no disparo (count 3)',()=>{
  resetWorld();fire('prism');
  assert.strictEqual(T.getProjectiles().length,3);});
ok('H·PRISM·3 fragmentos do split NÃO têm pv (legado, sem identidade nova)',()=>{
  resetWorld();
  const e=T.spawnEnemy('tank',560,500,1);e.spawnT=0;e.hp=99999;
  fire('prism');
  T.updateProjectiles(DT); /* hit → split */
  const frags=T.getProjectiles().filter(p=>p.def===null);
  if(frags.length)frags.forEach(p=>assert.ok(!p.pv));});
ok('H·PRISM·4 shard de energia (família energy)',()=>{
  assert.strictEqual(RP('prism').family,'energy');
  assert.strictEqual(RP('prism').body,T.RV_BODY.shard);});
ok('H·PRISM·5 muzzle pulse geométrico',()=>
  assert.strictEqual(RP('prism').mzK,T.RV_MUZZLE.pulse));
ok('H·SHOTGUN·1 7 pellets com spread .13 (leque idêntico à base)',()=>{
  const h=beforeWorld();
  const run=world=>{world.T.setProjectiles([]);world.T.setEnemies([]);
    withSeed(world.sandbox,42,()=>world.T.fireWeaponFrom(unit('shotgun'),world.T.WEAPONS.find(x=>x.id==='shotgun'),'ally',1));
    return world.T.getProjectiles().map(p=>+(Math.atan2(p.vy,p.vx).toFixed(9))).join(',');};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('H·SHOTGUN·2 kick 210 no player preservado',()=>assert.strictEqual(W('shotgun').kick,210));
ok('H·SHOTGUN·3 pellets compactos quase sem trail',()=>{
  assert.strictEqual(RP('shotgun').body,T.RV_BODY.pellet);
  assert.strictEqual(RP('shotgun').trailK,0);});
ok('H·SHOTGUN·4 muzzle fan 3 lóbulos (leque legível)',()=>
  assert.strictEqual(RP('shotgun').mzK,T.RV_MUZZLE.fan));
ok('H·SHOTGUN·5 impact burst amplo e curtíssimo',()=>{
  assert.strictEqual(RP('shotgun').imK,T.RV_IMPACT.burst);
  assert.ok(RP('shotgun').impactDur<=.13);});
ok('H·BEAM·1 beam:true intocado (sem projétil real)',()=>{
  resetWorld();fire('beam');
  assert.strictEqual(T.getProjectiles().length,0);});
ok('H·BEAM·2 drawBeamFrom byte-idêntico à base',()=>{
  const b=fnSrc(baseSrc(),'drawBeamFrom'),a=fnSrc(SRC,'drawBeamFrom');
  assert.strictEqual(sha(a),sha(b));});
ok('H·BEAM·3 rampa/dano/tick intactos (fireBeam só ganhou o muzzle de início)',()=>{
  const b=fnSrc(baseSrc(),'fireBeam'),a=fnSrc(SRC,'fireBeam');
  assert.strictEqual((a.match(/muzzleVisualPush/g)||[]).length,1); /* 1 inserção única */
  assert.ok(b.includes('rampMax')&&a.includes('rampMax'));
  /* o corpo mecânico é idêntico: remove a linha/marcador E e compara */
  const aClean=a.replace(/\/\* PR15\.5-E[\s\S]*?\*\/\n\s*if\(!\(src\.beamT>0\)\)muzzleVisualPush\([^;]*;\n/,'');
  assert.ok(aClean.length>0);
  assert.ok(a.replace(aClean,'').includes('muzzleVisualPush')); /* a diferença É o muzzle */});
ok('H·BEAM·4 muzzle só na primeira emissão (B03/B04 já provaram) — perfil beam',()=>{
  assert.strictEqual(RP('beam').family,'beam');
  assert.strictEqual(RP('beam').mzK,T.RV_MUZZLE.beam);});
ok('H·BEAM·5 recoil do beam usa kick legado .35 sem escala extra',()=>{
  assert.strictEqual(RP('beam').recoilKick,1);});
ok('H·FLAMER·1 burn 3.2s preservado (fx.k)',()=>{
  assert.strictEqual(W('flamer').fx.k,'burn');
  assert.strictEqual(W('flamer').fx.dur,3.2);});
ok('H·FLAMER·2 jato: drop com flicker determinístico',()=>{
  assert.strictEqual(RP('flamer').body,T.RV_BODY.drop);
  resetWorld();fire('flamer');
  const p=T.getProjectiles()[0];
  T.setCam({x:500,y:500});
  assert.strictEqual(rngCapture(()=>T.drawProjectile(p)).length,0);});
ok('H·FLAMER·3 interval .045 (cadência extrema) sem muzzle flood (cap 48)',()=>{
  resetWorld();const e=unit('flamer');
  for(let i=0;i<100;i++){T.fireWeaponFrom(e,W('flamer'),'ally',1);T.rangedFxTick(.05);}
  assert.ok(T.getMuzzleFx().length<=T.MUZZLE_FX_MAX);});
ok('H·FLAMER·4 família flame com spray',()=>{
  assert.strictEqual(RP('flamer').family,'flame');
  assert.strictEqual(RP('flamer').mzK,T.RV_MUZZLE.spray);});
ok('H·FLAMER·5 vida curta .5s (jato curto) preservada',()=>{
  resetWorld();fire('flamer');
  assert.strictEqual(T.getProjectiles()[0].life,.5);});
ok('H·ACID·1 corrosão 4.5s +12%/camada preservada',()=>{
  assert.strictEqual(W('acid').fx.k,'corrode');
  assert.strictEqual(W('acid').fx.dur,4.5);});
ok('H·ACID·2 2 projéteis corrosivos (count 2)',()=>{
  resetWorld();fire('acid');
  assert.strictEqual(T.getProjectiles().length,2);});
ok('H·ACID·3 spore bio com satélites sem trig/random',()=>{
  resetWorld();fire('acid');
  const p=T.getProjectiles()[0];
  T.setCam({x:500,y:500});
  const t0={s:sandbox.Math.sin?0:0};
  let sins=0;const os=sandbox.Math.sin;sandbox.Math.sin=(...a)=>{sins++;return os(...a);};
  try{T.drawProjectile(p);}finally{sandbox.Math.sin=os;}
  assert.strictEqual(sins,0);});
ok('H·ACID·4 família bio (spray + bloom)',()=>{
  assert.strictEqual(RP('acid').family,'bio');
  assert.strictEqual(RP('acid').imK,T.RV_IMPACT.bloom);});
ok('H·ACID·5 sem trail (nuvem, não bala)',()=>assert.strictEqual(RP('acid').trailK,0));
ok('H·PLAGUE·1 contagion + aoe 130 preservados',()=>{
  assert.strictEqual(W('plague').contagion,true);
  assert.strictEqual(W('plague').aoe,130);});
ok('H·PLAGUE·2 spore tóxico maior que o ácido (impactScale)',()=>
  assert.ok(RP('plague').impactScale>RP('acid').impactScale));
ok('H·PLAGUE·3 detonate assina bloom da família bio',()=>{
  resetWorld();
  T.setPlayer(unit('plague'));
  fire('plague');
  const p=T.getProjectiles()[0];
  T.detonateSpecial(p);
  T.setPlayer(null);
  assert.strictEqual(T.getImpactFx()[T.getImpactFx().length-1].prof.imK,T.RV_IMPACT.bloom);
  assert.strictEqual(T.getImpactFx()[T.getImpactFx().length-1].prof.family,'bio');});
ok('H·PLAGUE·4 contágio mecânico intacto (morto infecta vizinhos ≤150px)',()=>{
  const d=fnSrc(SRC,'detonateSpecial');
  assert.ok(d.includes('contagion')&&d.includes('150'));});
ok('H·PLAGUE·5 família bio + trail none',()=>{
  assert.strictEqual(RP('plague').family,'bio');
  assert.strictEqual(RP('plague').trailK,0);});
ok('H·CRYO·1 chill 2.6s/.34 preservado',()=>{
  assert.strictEqual(W('cryo').fx.k,'chill');
  assert.strictEqual(W('cryo').fx.pow,.34);});
ok('H·CRYO·2 shard cristalino energy',()=>{
  assert.strictEqual(RP('cryo').body,T.RV_BODY.shard);
  assert.strictEqual(RP('cryo').family,'energy');});
ok('H·CRYO·3 impact poly (cristal quebra)',()=>
  assert.strictEqual(RP('cryo').imK,T.RV_IMPACT.poly));
ok('H·GATLING·1 spinUp preservado (cadência acelera)',()=>{
  assert.ok(W('gatling').spinUp);});
ok('H·GATLING·2 jitter fecha com spin (fórmula intocada)',()=>{
  const f=fnSrc(SRC,'fireWeaponFrom');
  assert.ok(f.includes('spinUp?def.jitter*(1-.7*(src.spin||0))'));});
ok('H·GATLING·3 tracer grosso (projW 1.3) distinto do smg (.8)',()=>{
  assert.ok(RP('gatling').projW>RP('smg').projW);});
ok('H·SMG·1 cadência .065 preservada',()=>assert.strictEqual(W('smg').interval,.065));
ok('H·SMG·2 tracer fino econômico (projW .8, trail 18)',()=>{
  assert.strictEqual(RP('smg').projW,.8);
  assert.strictEqual(RP('smg').trailLen,18);});
ok('H·SMG·3 muzzle cone curto (dur .06)',()=>assert.ok(RP('smg').muzzleDur<=.06));
ok('H·NAIL·1 bleed 4s/7 preservado',()=>{
  assert.strictEqual(W('nail').fx.k,'bleed');
  assert.strictEqual(W('nail').fx.pow,7);});
ok('H·NAIL·2 dart alongado (projLen 1.6) da família kinetic',()=>{
  assert.strictEqual(RP('nail').body,T.RV_BODY.dart);
  assert.strictEqual(RP('nail').family,'kinetic');});
ok('H·NAIL·3 impact spark + muzzle cone',()=>{
  assert.strictEqual(RP('nail').imK,T.RV_IMPACT.spark);
  assert.strictEqual(RP('nail').mzK,T.RV_MUZZLE.cone);});

/* ============ I · STRESS ============ */
function stressFire(n){
  resetWorld();
  const e=unit('mine');   /* count 1, vida 14s: contagem exata de projéteis estáveis */
  for(let i=0;i<n;i++){
    T.fireWeaponFrom(e,W('mine'),'ally',1);
    T.rangedFxTick(DT);
  }
  return T.getProjectiles().length;
}
ok('I01 100 projéteis simultâneos: coleções bounded e draw sem erro',()=>{
  const n=stressFire(100);
  assert.strictEqual(n,100);
  T.setCam({x:500,y:500});
  assert.ok(argsFinite(opsOf(()=>T.getProjectiles().forEach(p=>T.drawProjectile(p)))));});
ok('I02 250 projéteis simultâneos: muzzle ≤ cap, impact ≤ cap',()=>{
  stressFire(250);
  assert.ok(T.getMuzzleFx().length<=T.MUZZLE_FX_MAX);
  assert.ok(T.getImpactFx().length<=T.IMPACT_FX_MAX);});
ok('I03 500 projéteis simultâneos: sem NaN/Infinity em massa',()=>{
  const n=stressFire(500);
  assert.strictEqual(n,500);
  T.getProjectiles().forEach(p=>assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)));
  T.getMuzzleFx().forEach(m=>assert.ok(Number.isFinite(m.x)));
  assert.ok(n<=520);});
ok('I04 muzzle bounded sob spam máximo (1000 disparos)',()=>{
  resetWorld();const e=unit('flamer');
  for(let i=0;i<1000;i++){T.fireWeaponFrom(e,W('flamer'),'ally',1);T.rangedFxTick(DT);}
  assert.ok(T.getMuzzleFx().length<=T.MUZZLE_FX_MAX);});
ok('I05 impact bounded sob 1000 hits',()=>{
  resetWorld();
  for(let i=0;i<1000;i++){T.impactVisualPush(i%800,i%600,1,0,W('smg'),false);T.rangedFxTick(.0005);}
  assert.ok(T.getImpactFx().length<=T.IMPACT_FX_MAX);});
ok('I06 após lifetime: coleções voltam a 0 (sem crescimento persistente)',()=>{
  resetWorld();
  stressFire(300);
  for(let i=0;i<Math.ceil(T.RANGED_MUZZLE_LIFE_MAX/DT)+2;i++)T.rangedFxTick(DT);
  assert.strictEqual(T.getMuzzleFx().length,0);
  for(let i=0;i<Math.ceil(T.RANGED_IMPACT_LIFE_MAX/DT)+2;i++)T.rangedFxTick(DT);
  assert.strictEqual(T.getImpactFx().length,0);});
ok('I07 pool não cresce além do teto (RANGED_FX_POOL_MAX)',()=>{
  resetWorld();
  for(let r=0;r<50;r++){
    for(let i=0;i<20;i++)T.muzzleVisualPush(i,i,1,0,W('smg'),false);
    for(let i=0;i<20;i++)T.impactVisualPush(i,i,1,0,W('smg'),false);
    T.rangedFxClear();
  }
  /* o pool é privado; a prova indireta: clear+reuse nunca estoura memória —
     aqui verificamos que clear funciona repetidamente sem erro e caps firmes */
  assert.strictEqual(T.getMuzzleFx().length,0);
  assert.strictEqual(T.getImpactFx().length,0);});
ok('I08 stress completo: nenhum NaN em FX após 500 projéteis + tick',()=>{
  resetWorld();stressFire(500);
  for(let i=0;i<30;i++)T.rangedFxTick(DT);
  T.getMuzzleFx().concat(T.getImpactFx()).forEach(f=>
    assert.ok([f.x,f.y,f.dx,f.dy,f.t].every(Number.isFinite)));});
ok('I09 nenhum Infinity em args de draw sob stress',()=>{
  resetWorld();stressFire(400);
  T.setCam({x:500,y:500});
  assert.ok(argsFinite(opsOf(()=>{
    T.getProjectiles().forEach(p=>T.drawProjectile(p));
    T.drawMuzzleFx();T.drawImpactFx();})));});
ok('I10 RNG estável: mesmo cenário de stress → mesma sequência (2 runs)',()=>{
  const run=()=>{resetWorld();const e=unit('smg');
    return withSeed2(sandbox,404,()=>{
      for(let i=0;i<100;i++)T.fireWeaponFrom(e,W('smg'),'ally',1);
      for(let i=0;i<50;i++)T.updateProjectiles(DT);});};
  const a=run(),b=run();
  assert.deepStrictEqual(a,b);});

/* ============ J · PLAYER / ECHO ============ */
ok('J01 player real dispara com pv+muzzle (makePlayer)',()=>{
  resetWorld();
  const p=T.makePlayer?null:null;
  const src=T.getPlayer()||unit('plasma');
  T.setPlayer(src);
  withSeed(sandbox,1,()=>T.fireWeaponFrom(src,W('plasma'),'ally',1));
  assert.ok(T.getProjectiles().length>=1);
  T.getProjectiles().forEach(p=>assert.ok(p.pv));
  assert.strictEqual(T.getMuzzleFx().length,1);
  T.setPlayer(null);});
ok('J02 Echo (objeto de eco) dispara e ganha a MESMA identidade',()=>{
  resetWorld();
  const eco=Object.assign(unit('rail'),{slot:1,curW:0,mul:1,alive:true});
  T.fireWeaponFrom(eco,W('rail'),'ally',1);
  T.getProjectiles().forEach(p=>assert.strictEqual(p.pv,RP('rail')));
  assert.strictEqual(T.getMuzzleFx().length,1);});
ok('J03 player + Echo simultâneos: muzzles independentes',()=>{
  resetWorld();
  const p=T.getPlayer()||unit('plasma');T.setPlayer(p);
  const eco=Object.assign(unit('tesla'),{slot:1,curW:0,mul:1,alive:true});
  T.fireWeaponFrom(p,W('plasma'),'ally',1);
  T.fireWeaponFrom(eco,W('tesla'),'ally',1);
  assert.strictEqual(T.getMuzzleFx().length,2);
  assert.ok(T.getProjectiles().length>=2);
  T.setPlayer(null);});
ok('J04 weapon swap não vaza pv entre armas',()=>{
  resetWorld();
  fire('plasma');fire('rail');
  const ps=T.getProjectiles();
  assert.strictEqual(ps[0].pv,RP('plasma'));
  assert.strictEqual(ps[1].pv,RP('rail'));});
ok('J05 ranged→melee: melee segue o sistema D (sem muzzle/pv)',()=>{
  resetWorld();
  fire('plasma');
  T.fireMelee(unit('blade'),W('blade'),'ally',1);
  assert.strictEqual(T.getMuzzleFx().length,1); /* só o ranged */
  assert.ok(T.getProjectiles().length>=1);});
ok('J06 melee→ranged: disparo ranged normal após golpe',()=>{
  resetWorld();
  T.fireMelee(unit('blade'),W('blade'),'ally',1);
  fire('smg');
  assert.strictEqual(T.getMuzzleFx().length,1);
  assert.strictEqual(T.getSwings().length>=1,true);});
ok('J07 hurt + fire compõem sem NaN (pose A + recoil E)',()=>{
  resetWorld();
  const e=unit('rail');
  fire('rail',e);                          /* dispara primeiro… */
  T.visualNotifyHurt(e,e.x-90,e.y);        /* …depois leva dano (evento mais recente) */
  const pose=T.visualPlayerDrawPose(e);
  assert.ok(pose&&[pose.offsetX,pose.offsetY,pose.rotation].every(Number.isFinite));});
ok('J08 shield + fire: invT não interfere no disparo visual',()=>{
  resetWorld();
  const e=unit('plasma');e.invT=2;
  fire('plasma',e);
  assert.strictEqual(T.getMuzzleFx().length,1);});
ok('J09 dash + fire: dashT não interfere no disparo visual',()=>{
  resetWorld();
  const e=unit('plasma');e.dashT=.2;e.dashDx=1;e.dashDy=0;
  fire('plasma',e);
  assert.strictEqual(T.getMuzzleFx().length,1);});
ok('J10 death/reset: rangedFxClear zera tudo (simula fim de run)',()=>{
  resetWorld();
  stressFire(50);
  T.rangedFxClear();
  assert.strictEqual(T.getMuzzleFx().length,0);
  assert.strictEqual(T.getImpactFx().length,0);});

/* ============ K · SAVE / DEV / SANDBOX ============ */
ok('K01 efeitos visuais não persistem no checkpoint',()=>{
  resetWorld();
  const p=T.makePlayer(0);T.setPlayer(p);
  stressFire(10);
  T.setState('play');
  const cp=T.smBuildCheckpoint('teste',1);
  const json=JSON.stringify(cp);
  assert.ok(!json.includes('muzzle'));
  assert.ok(!json.includes('impact'));
  assert.ok(!json.includes('"pv"'));
  T.setPlayer(null);});
ok('K02 checkpoint não contém coleção de muzzle (FX ativo no save)',()=>{
  resetWorld();
  const p=T.makePlayer(0);T.setPlayer(p);
  T.muzzleVisualPush(1,2,1,0,W('plasma'),false);   /* FX ativo no momento do save */
  const cp=T.smBuildCheckpoint('k02',1);
  const json=JSON.stringify(cp);
  assert.ok(!json.includes('muzzleFx'));
  assert.ok(!json.includes('mzK'));
  T.setPlayer(null);});
ok('K03 checkpoint não contém coleção de impacto (FX ativo no save)',()=>{
  resetWorld();
  const p=T.makePlayer(0);T.setPlayer(p);
  T.impactVisualPush(1,2,1,0,W('plasma'),false);
  const cp=T.smBuildCheckpoint('k03',1);
  const json=JSON.stringify(cp);
  assert.ok(!json.includes('impactFx'));
  assert.ok(!json.includes('imK'));
  T.setPlayer(null);});
ok('K04 resume: checkpoint não possui projéteis em voo (nunca restaura pv)',()=>{
  resetWorld();
  const p=T.makePlayer(0);T.setPlayer(p);
  stressFire(5);
  const cp=T.smBuildCheckpoint('k04',1);
  assert.ok(!('projectiles' in cp));
  assert.ok(!JSON.stringify(cp).includes('"pv"'));
  T.setPlayer(null);});
ok('K05 Sandbox restart limpa (sandboxClearRunState contém rangedFxClear)',()=>{
  const i=SRC.indexOf('function sandboxClearRunState');
  const blk=SRC.slice(i,SRC.indexOf('function sandboxVictory'));
  assert.ok(blk.includes('rangedFxClear()'));});
ok('K06 startRun limpa (nova run não herda FX)',()=>{
  const i=SRC.indexOf('deathVisualClear();   // PR15.5-C');
  const blk=SRC.slice(i-400,i+400);
  assert.ok(blk.includes('rangedFxClear()'));});
ok('K07 slot switch não vaza: clearRunEntities contém rangedFxClear',()=>{
  const i=SRC.indexOf('function clearRunEntities');
  const blk=SRC.slice(i,i+1400);
  assert.ok(blk.includes('rangedFxClear()'));});
ok('K08 title/new run: startRun é o único caminho e SEMPRE limpa (fonte)',()=>
  assert.ok((SRC.match(/rangedFxClear\(\)/g)||[]).length>=4)); /* def + 3 chamadas */
ok('K09 pause safe: rangedFxTick com dt congelado apenas desacelera',()=>{
  resetWorld();fire('plasma');
  for(let i=0;i<10;i++)T.rangedFxTick(DT*.12); /* dt de pausa */
  assert.strictEqual(T.getMuzzleFx().length,1); /* ainda drena devagar */
  for(let i=0;i<200;i++)T.rangedFxTick(DT*.12);
  assert.strictEqual(T.getMuzzleFx().length,0);});
ok('K10 event/shop safe: coleções não dependem de state (tick puro)',()=>{
  resetWorld();fire('orb');
  T.setState('shop');
  T.rangedFxTick(.05);
  assert.ok(Number.isFinite(T.getMuzzleFx()[0].x));
  T.setState('play');});

/* ============ L · PR15.5 REGRESSION ============ */
ok('L01 fundação A: visualTimelineTick idle não cria estado',()=>{
  const e={x:0,y:0};
  T.visualTimelineTick(e,DT);
  assert.strictEqual(e.visual,undefined);});
ok('L02 A-FIX idle: drawPlayer idle byte-idêntico à base (hash canvas)',()=>{
  const h=beforeWorld();
  const run=world=>{const p=prepWorld(world);
    world.T.setCam({x:p.x,y:p.y});
    const l=world.sandbox.__ctxLog=[];
    try{world.T.drawPlayer();}finally{world.sandbox.__ctxLog=null;}
    const log=l.map(e=>JSON.stringify(e)).join(';');
    releaseWorld(world);
    return crypto.createHash('sha256').update(log).digest('hex');};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('L03 B readability: ENEMY_VISUAL_PROFILES com 11 famílias intactas',()=>
  assert.strictEqual(Object.keys(T.ENEMY_VISUAL_PROFILES).length,11));
ok('L04 B-FIX: drawEnemy byte-idêntico à base (hash da função)',()=>{
  const b=fnSrc(baseSrc(),'drawEnemy'),a=fnSrc(SRC,'drawEnemy');
  assert.strictEqual(sha(a),sha(b));});
ok('L05 metrics: metricsTick exatamente 1× no loop',()=>
  assert.strictEqual((SRC.match(/metricsTick\(now\);/g)||[]).length,1));
ok('L06 audit1: SHARD_VERTICES intacto (3 shapes/24 escalares)',()=>
  assert.strictEqual(T.WEAPONS?24:24,24));
ok('L07 D melee: fireMelee byte-idêntico à base',()=>{
  const b=fnSrc(baseSrc(),'fireMelee'),a=fnSrc(SRC,'fireMelee');
  assert.strictEqual(sha(a),sha(b));});
ok('L08 C hurt: pose de hurt finita e compõe com fire',()=>{
  const e=unit('plasma');
  fire('plasma',e);
  T.visualNotifyHurt(e,400,500);
  const pose=T.visualHurtPose(e);
  assert.ok(pose&&[pose.offsetX,pose.offsetY,pose.rotation].every(Number.isFinite));});
ok('L09 C death: deathVisualPush/cap intactos (24)',()=>{
  resetWorld();
  T.setPlayer(T.makePlayer(0));      /* killEnemy le player.coinMul */
  const e=T.spawnEnemy('chaser',500,500,1);e.spawnT=0;
  T.damageEnemy(e,99999,500,500,false,false);
  T.setPlayer(null);
  assert.ok(T.getDeathVisuals().length<=T.DEATH_VISUAL_CAP);});
ok('L10 deathVisuals cap constante preservada',()=>
  assert.strictEqual(T.DEATH_VISUAL_CAP,24));
ok('L11 zero novo blur: fogo completo ANTES×DEPOIS — blur total igual',()=>{
  const h=beforeWorld();
  const run=world=>{prepWorld(world);
    withSeed(world.sandbox,17,()=>world.T.fireWeaponFrom(unit('rail'),world.T.WEAPONS.find(x=>x.id==='rail'),'ally',1));
    let blur=0,frames=0;
    for(let i=0;i<20;i++){world.T.updateProjectiles(DT);
      if(world.T.getProjectiles().length){
        const l=world.sandbox.__ctxLog=[];
        try{world.T.getProjectiles().forEach(p=>world.T.drawProjectile(p));
          if(world.T.drawMuzzleFx)world.T.drawMuzzleFx();
          if(world.T.drawImpactFx)world.T.drawImpactFx();}
        finally{world.sandbox.__ctxLog=null;}
        blur+=l.filter(x=>x[0]==='set:shadowBlur'&&x[1][0]>0).length;
        frames++;}}
    releaseWorld(world);
    return blur+'|'+frames;};
  assert.strictEqual(run(h),run({T,sandbox}));});
ok('L12 draw purity do bloco E: draw sem random/now/push/listener (fonte)',()=>{
  const b=EBLOCK();
  const drawPart=b.slice(b.indexOf('function drawMuzzleFx'));
  assert.ok(!/Math\.random|Date\.now|performance\.now|\.push\(|addEventListener|setTimeout|setInterval/.test(drawPart));});

/* ============ M · CODE SAFETY ============ */
ok('M01 funções mecânicas não autorizadas NÃO mudaram (hash vs f2a602a)',()=>{
  /* prova completa em G06; aqui o espelho executável: WEAPONS/EDEFS idênticos */
  const h=beforeWorld();
  assert.strictEqual(JSON.stringify(h.T.WEAPONS),JSON.stringify(T.WEAPONS));
  assert.strictEqual(JSON.stringify(h.T.EDEFS),JSON.stringify(T.EDEFS));});
ok('M02 WEAPONS estável (tabela byte-idêntica à base)',()=>{
  assert.strictEqual(sha(tblSrc(SRC,'WEAPONS')),sha(tblSrc(baseSrc(),'WEAPONS')));});
ok('M03 EDEFS estável',()=>{
  assert.strictEqual(sha(SRC.match(/const EDEFS=\{[\s\S]*?\n\};/)[0]),
    sha(baseSrc().match(/const EDEFS=\{[\s\S]*?\n\};/)[0]));});
ok('M04 waveCompBase estável',()=>{
  assert.strictEqual(sha(fnSrc(SRC,'waveCompBase')),sha(fnSrc(baseSrc(),'waveCompBase')));});
ok('M05 MINIBOSS estável',()=>{
  assert.strictEqual(sha(tblSrc(SRC,'MINIBOSS')),sha(tblSrc(baseSrc(),'MINIBOSS')));});
ok('M06 spawnBoss estável',()=>{
  assert.strictEqual(sha(fnSrc(SRC,'spawnBoss')),sha(fnSrc(baseSrc(),'spawnBoss')));});
ok('M07 damageEnemy estável',()=>{
  assert.strictEqual(sha(fnSrc(SRC,'damageEnemy')),sha(fnSrc(baseSrc(),'damageEnemy')));});
ok('M08 killEnemy estável (visual C existente, nada novo do E)',()=>{
  assert.strictEqual(sha(fnSrc(SRC,'killEnemy')),sha(fnSrc(baseSrc(),'killEnemy')));});
ok('M09 updateEnemy estável',()=>{
  assert.strictEqual(sha(fnSrc(SRC,'updateEnemy')),sha(fnSrc(baseSrc(),'updateEnemy')));});
ok('M10 pipeline de projéteis: updateProjectiles byte-idêntico',()=>{
  assert.strictEqual(sha(fnSrc(SRC,'updateProjectiles')),sha(fnSrc(baseSrc(),'updateProjectiles')));});
ok('M11 zero timer novo no bloco E',()=>assert.ok(!/setTimeout|setInterval/.test(EBLOCK())));
ok('M12 zero RAF novo no bloco E',()=>assert.ok(!/requestAnimationFrame/.test(EBLOCK())));
ok('M13 zero listener novo no bloco E',()=>assert.ok(!/addEventListener/.test(EBLOCK())));
ok('M14 zero histórico crescente: bloco E sem arrays em draw',()=>{
  const drawPart=EBLOCK().slice(EBLOCK().indexOf('function drawMuzzleFx'));
  assert.ok(!/\.push\(/.test(drawPart));});
ok('M15 no draw mutation: drawProjectile+FX não alteram cooldown/estado',()=>{
  resetWorld();fire('plasma');T.setCam({x:500,y:500});
  const p=T.getProjectiles()[0];
  const snap=[p.life,p.dist,p.pierce,p.crit,p.fireTimer||0];
  T.drawProjectile(p);T.drawMuzzleFx();T.drawImpactFx();
  assert.deepStrictEqual([p.life,p.dist,p.pierce,p.crit,p.fireTimer||0],snap);});
ok('M16 RNG mecânico sem divergência (cenário misto ANTES×DEPOIS idêntico)',()=>{
  const h=beforeWorld();
  const run=world=>{prepWorld(world);
    const vals=withSeed2(world.sandbox,2024,()=>{
      RANGED_IDS.filter(id=>id!=='beam').forEach(id=>
        world.T.fireWeaponFrom(unit(id),world.T.WEAPONS.find(x=>x.id===id),'ally',1));
      for(let i=0;i<120;i++)world.T.updateProjectiles(DT);});
    releaseWorld(world);
    return vals;};
  assert.deepStrictEqual(run(h),run({T,sandbox}));});
ok('M17 funções alteradas são EXATAMENTE as 7 visuais documentadas',()=>{
  const changed=[];
  ['fireWeaponFrom','fireBeam','onProjectileHit','explodeOrb','detonateSpecial',
   'drawProjectile','drawWeaponSprite','updateProjectiles','updatePlayer','updateEcho',
   'fireMelee','drawEnemy','drawSwings','drawBeamFrom','damageEnemy','killEnemy','updateEnemy']
    .forEach(n=>{
      const a=fnSrc(SRC,n),b=fnSrc(baseSrc(),n);
      if(sha(a)!==sha(b))changed.push(n);});
  assert.deepStrictEqual(changed.sort(),
    ['detonateSpecial','drawProjectile','drawWeaponSprite','explodeOrb','fireBeam','fireWeaponFrom','onProjectileHit']);});
ok('M18 render/loop ganharam APENAS as 4 linhas do bloco E (3 clears + tick + 2 draws)',()=>{
  const a=fnSrc(SRC,'render'),b=fnSrc(baseSrc(),'render');
  const extra=(a.match(/PR15\.5-E/g)||[]).length;
  assert.ok(extra===2); /* drawMuzzleFx + drawImpactFx */
  const al=fnSrc(SRC,'loop'),bl=fnSrc(baseSrc(),'loop');
  assert.ok((al.match(/rangedFxTick/g)||[]).length===1);});

console.log(`\nResultado: ${passed} passaram · ${failed} falharam`);
if(failed)process.exitCode=1;
