'use strict';
/* Auditoria mecânica dos 8 mini-chefes (PR13.5 · B5-B).
   PROXY automatizado (não playtest): simula updateMiniBoss contra um jogador
   sintético que orbita (não esquiva de zonas nem sai do dreno) em waves
   5/10/15, fase 1 e fase 2, por 40 s cada. Mede pressão (ataques/min,
   dano/min recebido pelo boneco), hazards, crias, regen, area denial, caps.
   Funciona ANTES (B5-A) e DEPOIS (B5-B).
   Uso: node audit_pr135/miniboss_mechanical_audit.js [ROOT] [segundos]     */
const ROOT=process.argv[2]||require('path').join(__dirname,'..');
const SECS=+process.argv[3]||40;
const {sandbox,T}=require(ROOT+'/audit_pr135/harness.js');
const vm=require('vm');const X=c=>vm.runInContext(c,sandbox);
const hasB5B=typeof T.MB_UPDATERS==='object';
console.log('# MINIBOSS MECHANICAL AUDIT ·',hasB5B?'B5-B':'antes (B5-A)','· ROOT='+ROOT,'· '+SECS+'s por cenário · PROXY, não playtest');
function seed(s){let x=s>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function fresh(){T.resetShopVars();T.setState('play');T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);T.startRun();}
function run(def,wave,phase){
  fresh();T.setWave(wave);sandbox.Math.random=seed(wave*100+phase*7+def.id.length);
  const p=T.getPlayer();p.x=600;p.y=400;p.hp=1e9;p.maxHp=1e9;p.vx=0;p.vy=0;p.dashT=0;p.invT=0;
  T.setEnemies([]);T.setProjectiles([]);T.setMiniBoss(null);
  const b=T.spawnMiniBoss(wave,def);b.spawnT=0;b.x=760;b.y=400;
  if(phase===2){b.hp=b.maxHp*.49;T.updateMiniBoss(b,1/60);b.hp=b.maxHp*.49;}
  const hpStart=b.hp;
  let projSpawned=0,lastProj=0,dashes=0,lastDash=0,hazMax=0,hazSpawned=0,lastHaz=0,kidsMax=0,regenGain=0,regenSecs=0,enMax=0;
  let denial=0,frames=0,contactHits=0,lastHp=p.hp,sustainSecs=0;
  const dt=1/60,N=Math.round(SECS*60);
  for(let i=0;i<N;i++){
    const t=i*dt;p.x=600+Math.sin(t*.7)*140;p.y=400+Math.cos(t*.9)*90;p.vx=Math.cos(t*.7)*98;p.vy=-Math.sin(t*.9)*81;
    const hpB=b.hp;
    for(const e of T.getEnemies().slice())if(e.type==='miniboss')T.updateMiniBoss(e,dt);
    for(const e of T.getEnemies())if(e.type!=='miniboss'&&e.spawnT>0)e.spawnT-=dt;
    if(b.hp>hpB+1e-6){regenGain+=b.hp-hpB;regenSecs+=dt;}
    const pr=T.getProjectiles();if(pr.length>lastProj)projSpawned+=pr.length-lastProj;lastProj=pr.length;if(pr.length>600)pr.length=600;
    if(b.dashT>0&&lastDash<=0)dashes++;lastDash=b.dashT;
    const hz=(b.hazards||[]).length;if(hz>lastHaz)hazSpawned+=hz-lastHaz;lastHaz=hz;hazMax=Math.max(hazMax,hz);
    /* area denial: fração da arena coberta por hazards ativos (aprox. soma das áreas / área da arena, cap 1) */
    if(b.hazards&&b.hazards.length){let area=0;for(const h of b.hazards)area+=Math.PI*h.r*h.r;denial+=Math.min(1,area/(X('ARENA.w')*X('ARENA.h')));}
    /* fraturas legadas do Arauto (antes do B5-B) */
    if(b.fractures&&b.fractures.length){let area=0;for(const h of b.fractures)area+=Math.PI*h.r*h.r;denial+=Math.min(1,area/(X('ARENA.w')*X('ARENA.h')));hazMax=Math.max(hazMax,b.fractures.length);}
    const kids=T.getEnemies().filter(e=>e.type!=='miniboss').length;kidsMax=Math.max(kidsMax,kids);enMax=Math.max(enMax,T.getEnemies().length);
    if(b.shieldUpState==='active'||b.sleepPhase==='dormant'||(b.ms&&b.ms.stance==='guard'))sustainSecs+=dt;
    frames++;
  }
  const dmg=1e9-p.hp;
  return {id:def.id,wave,phase,dmgPerMin:Math.round(dmg/SECS*60),projPerMin:Math.round(projSpawned/SECS*60),dashPerMin:+(dashes/SECS*60).toFixed(1),
    hazSpawnPerMin:+(hazSpawned/SECS*60).toFixed(1),hazMax,denialPct:+(denial/frames*100).toFixed(2),kidsMax,enMax,
    regenPctMax:+(regenGain/b.maxHp*100).toFixed(1),regenUptimePct:Math.round(regenSecs/SECS*100),defUptimePct:Math.round(sustainSecs/SECS*100),
    hpEnd:Math.round(b.hp/b.maxHp*100),ms:b.ms?{escal:b.ms.escal,drained:Math.round(b.ms.drained||0),broken:b.ms.broken,combo:b.ms.combo}:null};
}
const rows=[];
for(const def of T.MINIBOSS)for(const w of [5,10,15])for(const ph of [1,2])rows.push(run(def,w,ph));
console.log('\n## Pressão por cenário (jogador sintético orbitando; dano em HP/min contra dmg base da onda)');
console.log('| id | wave | fase | dano/min | proj/min | dash/min | hazards/min | haz máx | area denial % | crias máx | entidades máx | regen % maxHp | regen uptime % | uptime defensivo % | hp fim % |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for(const r of rows)console.log('| '+[r.id,r.wave,r.phase,r.dmgPerMin,r.projPerMin,r.dashPerMin,r.hazSpawnPerMin,r.hazMax,r.denialPct,r.kidsMax,r.enMax,r.regenPctMax,r.regenUptimePct,r.defUptimePct,r.hpEnd].join(' | ')+' |');
console.log('\n## Resumo por mini-chefe (wave 10)');
console.log('| id | dano/min F1→F2 | proj/min F1→F2 | dash/min F1→F2 | hazards máx | denial % F2 | crias máx | regen %/40s F1→F2 | def uptime % | estado |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for(const def of T.MINIBOSS){const a=rows.find(r=>r.id===def.id&&r.wave===10&&r.phase===1),b=rows.find(r=>r.id===def.id&&r.wave===10&&r.phase===2);
  console.log('| '+[def.id,a.dmgPerMin+'→'+b.dmgPerMin,a.projPerMin+'→'+b.projPerMin,a.dashPerMin+'→'+b.dashPerMin,Math.max(a.hazMax,b.hazMax),b.denialPct,Math.max(a.kidsMax,b.kidsMax),a.regenPctMax+'→'+b.regenPctMax,Math.max(a.defUptimePct,b.defUptimePct),JSON.stringify(b.ms)].join(' | ')+' |');}
/* assinatura mecânica: quais "verbos" cada um usa de fato */
console.log('\n## Assinatura mecânica observada (wave 10, F1+F2)');
for(const def of T.MINIBOSS){const a=rows.filter(r=>r.id===def.id&&r.wave===10);const v=[];
  if(a.some(r=>r.dashPerMin>0))v.push('dash');if(a.some(r=>r.projPerMin>0))v.push('projéteis');if(a.some(r=>r.hazMax>0))v.push('hazards');
  if(a.some(r=>r.kidsMax>0))v.push('crias');if(a.some(r=>r.regenPctMax>0))v.push('regen');if(a.some(r=>r.defUptimePct>0))v.push('postura defensiva');
  console.log(def.id.padEnd(9),v.join(' + ')||'—');}
const sigs=T.MINIBOSS.map(def=>{const a=rows.filter(r=>r.id===def.id&&r.wave===10);return [a.some(r=>r.dashPerMin>0),a.some(r=>r.projPerMin>0),a.some(r=>r.hazMax>0),a.some(r=>r.kidsMax>0),a.some(r=>r.regenPctMax>0),a.some(r=>r.defUptimePct>0)].map(x=>x?1:0).join('');});
console.log('assinaturas distintas:',new Set(sigs).size,'/ 8');
console.log('\n## Caps');
console.log('ENEMY_BUDGET',X('ENEMY_BUDGET'),'| MB_HAZARD_CAP',hasB5B?JSON.stringify(X('MB_HAZARD_CAP')):'n/a','| MB_BROOD_CAP',hasB5B?X('MB_BROOD_CAP'):'n/a');
console.log('hazards máx observados:',Math.max(...rows.map(r=>r.hazMax)),'| entidades máx observadas:',Math.max(...rows.map(r=>r.enMax)));
sandbox.Math.random=Math.random;
