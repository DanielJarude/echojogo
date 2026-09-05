'use strict';
/* Auditoria visual dos 8 mini-chefes (PR13.5 · B5-A).
   Mede PROXIES estruturais (não percepção humana): perfil declarativo,
   assinatura de primitivas do renderer real (ctx mock instrumentado),
   pares próximos, pureza do draw e custo aproximado.
   Uso: node audit_pr135/miniboss_visual_audit.js [ROOT]                   */
const ROOT=process.argv[2]||require('path').join(__dirname,'..');
const {sandbox,T}=require(ROOT+'/audit_pr135/harness.js');
const hasB5=!!T.MINIBOSS_VISUALS;
console.log('# MINIBOSS VISUAL AUDIT ·',hasB5?'B5-A':'antes (renderer único)','· ROOT='+ROOT);
function fresh(){T.resetShopVars();T.setState('play');T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);T.startRun();T.setWave(5);}
function spawn(def,mode){
  if(T.getMiniBoss())T.setMiniBoss(null);
  const b=T.spawnMiniBoss(5,def);b.spawnT=0;b.x=600;b.y=400;
  if(mode==='phase2')b.phase=2;
  if(mode==='telegraph')b.telegraphT=.3;
  if(mode==='spawn')b.spawnT=.8;
  return b;
}
function fingerprint(b){
  globalThis.__ctxLog=[];T.drawMiniBoss(b);const L=globalThis.__ctxLog;globalThis.__ctxLog=null;
  const c={};for(const [k] of L)if(!/^set:/.test(k))c[k]=(c[k]||0)+1;
  return c;
}
const keyOf=c=>Object.keys(c).sort().map(k=>k+':'+c[k]).join(' ');
function dist(a,b){const ks=new Set([...Object.keys(a),...Object.keys(b)]);let d=0,t=0;for(const k of ks){d+=Math.abs((a[k]||0)-(b[k]||0));t+=Math.max(a[k]||0,b[k]||0);}return t?d/t:0;}
fresh();
const rows=[],fps={},fpsP2={},fpsTel={},fpsSp={};
for(const m of T.MINIBOSS){
  const V=hasB5?T.MINIBOSS_VISUALS[m.id]:null;
  fps[m.id]=fingerprint(spawn(m,'base'));fpsP2[m.id]=fingerprint(spawn(m,'phase2'));fpsTel[m.id]=fingerprint(spawn(m,'telegraph'));fpsSp[m.id]=fingerprint(spawn(m,'spawn'));
  const prims=Object.keys(fps[m.id]).filter(k=>/arc|ellipse|rect|lineTo|quadraticCurveTo|drawImage|fillRect/.test(k));
  rows.push({id:m.id,nm:m.nm,r:m.r,sil:V?V.silhouette:'octagon+ram',feat:V?V.feature:'plates',feat2:V?V.secondaryFeature:'core',
    tel:V?V.telegraph:'dashed-line',ph:V?V.phaseVisual:'ring',sp:V?V.spawn:'ring',pal:V?V.primary+'/'+V.secondary+'/'+V.accent:'#ff9d3c/#5c2a06/#ffd166 (fixa)',
    aspect:V?(V.scaleX/V.scaleY).toFixed(2):'1.00',prims:prims.join(',')});
}
console.log('\n## Matriz de identidade');
console.log('| ID | silhueta | aspecto | elem. principal | elem. secundário | telegraph | fase 2 | spawn | paleta P/S/A |');
console.log('|---|---|---|---|---|---|---|---|---|');
for(const r of rows)console.log('| '+r.id+' | '+r.sil+' | '+r.aspect+' | '+r.feat+' | '+r.feat2+' | '+r.tel+' | '+r.ph+' | '+r.sp+' | '+r.pal+' |');
console.log('\n## Assinatura de primitivas do renderer real (estado base, chamadas por frame)');
for(const r of rows)console.log(r.id.padEnd(9),keyOf(fps[r.id]));
console.log('\n## Distância estrutural entre pares (0 = mesmas chamadas; base / fase 2 / telegraph / spawn)');
let minD=1,minPair='',clones=[];
const ids=T.MINIBOSS.map(m=>m.id);
for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const d0=dist(fps[ids[i]],fps[ids[j]]),d2=dist(fpsP2[ids[i]],fpsP2[ids[j]]),dt=dist(fpsTel[ids[i]],fpsTel[ids[j]]),ds=dist(fpsSp[ids[i]],fpsSp[ids[j]]);
  const same=hasB5&&['silhouette','feature','phaseVisual','telegraph'].filter(k=>T.MINIBOSS_VISUALS[ids[i]][k]===T.MINIBOSS_VISUALS[ids[j]][k]).length;
  if(d0<minD){minD=d0;minPair=ids[i]+'×'+ids[j];}
  if(d0<.05)clones.push(ids[i]+'×'+ids[j]);
  console.log((ids[i]+'×'+ids[j]).padEnd(18),d0.toFixed(2),d2.toFixed(2),dt.toFixed(2),ds.toFixed(2),hasB5?('campos declarativos iguais: '+same+'/4'):'');
}
console.log('par mais próximo:',minPair,minD.toFixed(3),'| pares "clone" (d<0.05):',clones.length?clones.join(', '):'nenhum');
console.log('\n## Pureza do renderer (1000 draws por mini-chefe, todos os modos)');
let pure=true;
const snap=b=>JSON.stringify([b.hp,b.x,b.y,b.vx,b.vy,b.phase,b.chargeCd,b.burstCd,b.skillCd,b.summonCd,b.telegraphT,b.dashT,b.plates,b.dmg,b.spd,b.r,b.aim,b.t,b.core,b.ring,b.spinAng,T.getMoral(),T.getEnemies().length]);
for(const m of T.MINIBOSS){for(const mode of ['base','phase2','telegraph','spawn']){const b=spawn(m,mode);const s0=snap(b);const n0=sandbox.parts?sandbox.parts.length:-1;
  for(let i=0;i<1000;i++){T.setRunTime(i*.016);T.drawMiniBoss(b);}
  if(snap(b)!==s0){pure=false;console.log('  !! draw alterou estado',m.id,mode);}}}
console.log('draw não altera estado lógico/moral/enemies:',pure);
const src=require('fs').readFileSync(ROOT+'/index.html','utf8');
const i0=src.indexOf('const MINIBOSS_VISUALS='),i1=src.indexOf('function spawnWave(n){');
const block=i0>=0?src.slice(i0,i1):src.slice(src.indexOf('function drawMiniBoss(e){'),i1);
console.log('Math.random / rand( dentro do bloco de renderização:',(block.match(/Math\.random|\brand\(/g)||[]).length);
console.log('DOM (document\\.|getElementById|innerHTML) dentro do bloco:',(block.match(/document\.|getElementById|innerHTML/g)||[]).length);
console.log('\n## Custo aproximado (chamadas ctx por frame, base → fase 2)');
for(const r of rows){const n0=Object.values(fps[r.id]).reduce((a,b)=>a+b,0),n2=Object.values(fpsP2[r.id]).reduce((a,b)=>a+b,0);console.log(r.id.padEnd(9),n0,'→',n2);}
const t0=Date.now();for(const m of T.MINIBOSS){const b=spawn(m,'phase2');for(let i=0;i<2000;i++)T.drawMiniBoss(b);}
console.log('16.000 draws (mock ctx):',(Date.now()-t0)+'ms (sinal, não benchmark)');
