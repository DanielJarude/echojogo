'use strict';
/* =====================================================================
   ECHO — PR15.5-D · ARSENAL MELEE: ANIMAÇÃO FÍSICA, IDENTIDADE, IMPACTO
   Suíte visual não-pixel: perfis, fases, poses, trail, orientação 360°,
   cancel/troca, composição com hurt/recoil, alinhamento mecânico,
   pureza de draw, fast path e custos estruturais (contagem de ops do
   Canvas mock — nunca FPS inventado).
   ===================================================================== */
const assert=require('assert');
const crypto=require('crypto');
const {T,SRC,sandbox}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
const near=(a,b,e=1e-9)=>Math.abs(a-b)<=e;
const MELEE_IDS=['blade','katana','scythe','chains','glaive','gaunt','hammer'];
const W=id=>T.WEAPONS.find(w=>w.id===id);
const PROF=id=>T.meleeVisualProfile(W(id));
function unit(id){return {x:500,y:500,aim:0,r:13,swingDir:1,crit:0,hp:100,maxHp:100};}
function opsOf(fn){sandbox.__ctxLog=[];try{fn();}catch(e){sandbox.__ctxLog=null;throw e;}const l=sandbox.__ctxLog;sandbox.__ctxLog=null;return l;}
const nOp=(l,op)=>l.reduce((n,e)=>n+(e[0]===op?1:0),0);
const blurPos=l=>l.filter(e=>e[0]==='set:shadowBlur'&&e[1][0]>0).length;
const argsFinite=l=>l.every(e=>(e[1]||[]).every(a=>typeof a!=='number'||Number.isFinite(a)));
function resetWorld(){T.setSwings([]);T.setEnemies([]);T.setProjectiles([]);}
function phaseAt(id,phase){ // entidade posicionada exatamente no início de `phase`
  const e=unit(id);T.meleeVisualStart(e,W(id),1);
  const p=PROF(id);
  const dt=1/1000;
  while(e.visual.melee.state!==phase&&e.visual.melee.state)T.visualTimelineTick(e,dt);
  return e;
}
const DBLOCK=()=>SRC.slice(SRC.indexOf('PR15.5-D · ARSENAL MELEE'),SRC.indexOf('ESCALONAMENTO INCREMENTAL'));
console.log('\nECHO — PR15.5-D · ARSENAL MELEE — ANIMAÇÃO FÍSICA');

/* ============ A · INVENTÁRIO, PERFIS E IDENTIDADE ============ */
ok('A01 catálogo exposto e intacto (27 armas)',()=>assert.strictEqual(T.WEAPONS.length,27));
ok('A02 exatamente 7 armas melee reais',()=>assert.strictEqual(T.WEAPONS.filter(w=>w.melee).length,7));
ok('A03 ids melee são os esperados (conjunto)',()=>assert.deepStrictEqual([...T.WEAPONS.filter(w=>w.melee).map(w=>w.id)].sort(),MELEE_IDS.slice().sort()));
ok('A04 toda melee tem perfil precomputado',()=>MELEE_IDS.forEach(id=>assert.ok(T.MELEE_VISUAL_PROFILES[id],id)));
ok('A05 lookup por def devolve o objeto congelado (cache fixo)',()=>MELEE_IDS.forEach(id=>{const p=T.meleeVisualProfile(W(id));assert.strictEqual(p,T.MELEE_VISUAL_PROFILES[id]);assert.ok(Object.isFrozen(p));}));
ok('A06 tabela de perfis é congelada e não cresce',()=>{assert.ok(Object.isFrozen(T.MELEE_VISUAL_PROFILES));assert.strictEqual(Object.keys(T.MELEE_VISUAL_PROFILES).length,7);});
ok('A07 family sempre pertence ao vocabulário',()=>MELEE_IDS.forEach(id=>assert.ok(T.MELEE_VISUAL_FAMILIES.indexOf(PROF(id).family)>=0,id)));
ok('A08 famílias reais usadas: light/cleave/thrust/blunt',()=>assert.deepStrictEqual([...new Set(MELEE_IDS.map(id=>PROF(id).family))].sort(),['blunt','cleave','light','thrust']));
ok('A09 perfil NÃO duplica atributos mecânicos',()=>MELEE_IDS.forEach(id=>{const p=PROF(id);['dmg','damage','interval','cooldown','reach','arc','range','crit','knock','knockback','pullIn','shockwave','lifesteal','fx','kick'].forEach(k=>assert.ok(!(k in p),id+' expõe '+k));}));
ok('A10 todos os campos numéricos são finitos',()=>MELEE_IDS.forEach(id=>Object.values(PROF(id)).forEach(v=>{if(typeof v==='number')assert.ok(Number.isFinite(v),id);})));
ok('A11 fases estritamente positivas',()=>MELEE_IDS.forEach(id=>{const p=PROF(id);['windup','active','recover','trailFade'].forEach(k=>assert.ok(p[k]>0,id+'.'+k));}));
ok('A12 windup+active+recover cabe na cadência base',()=>MELEE_IDS.forEach(id=>{const p=PROF(id);assert.ok(p.windup+p.active+p.recover<=W(id).interval,id);}));
ok('A13 vida do swing = windup+active+trailFade ≤ .45s',()=>MELEE_IDS.forEach(id=>{const p=PROF(id),l=p.windup+p.active+p.trailFade;assert.ok(near(l,p.windup+p.active+p.trailFade)&&l<=.45,id);}));
ok('A14 ângulos dentro de (0,π)',()=>MELEE_IDS.forEach(id=>{const p=PROF(id);assert.ok(p.windupAngle>0&&p.windupAngle<Math.PI&&p.endAngle>0&&p.endAngle<Math.PI,id);}));
ok('A15 |rot| máximo < π em todas as amostras (arma nunca aponta para trás)',()=>{
  MELEE_IDS.forEach(id=>{const p=PROF(id);for(let i=0;i<=60;i++){const k=i/60;
    const rotA=-p.windupAngle,rotB=p.endAngle,kk=p.easeActive(k);
    const rot=rotA+(rotB-rotA)*kk;
    assert.ok(Math.abs(rot)<Math.PI,id);}});
});
ok('A16 extensões e deslocamentos ≤ 1.2·r',()=>MELEE_IDS.forEach(id=>{const p=PROF(id);['extIn','extOut','perp','bodyShift'].forEach(k=>assert.ok(Math.abs(p[k])<=1.2,id+'.'+k));}));
ok('A17 movimento corporal discreto (≤ .35 rad / ≤ .35·r)',()=>MELEE_IDS.forEach(id=>{const p=PROF(id);['bodyLean','bodyTurn'].forEach(k=>assert.ok(Math.abs(p[k])<=.35,id+'.'+k));}));
ok('A18 squash/stretch ≤ .3',()=>MELEE_IDS.forEach(id=>{const p=PROF(id);assert.ok(p.squash<=.3&&p.stretch<=.3);}));
ok('A19 easings são as funções da fundação e finitos',()=>MELEE_IDS.forEach(id=>{const p=PROF(id);['easeWindup','easeActive','easeRecover'].forEach(k=>{assert.strictEqual(typeof p[k],'function');for(let i=0;i<=20;i++)assert.ok(Number.isFinite(p[k](i/20)));});}));
ok('A20 trailStyle do vocabulário arc/line/impact',()=>MELEE_IDS.forEach(id=>assert.ok(['arc','line','impact'].indexOf(PROF(id).trailStyle)>=0,id)));
ok('A21 nenhum array dentro dos perfis (dados escalares)',()=>MELEE_IDS.forEach(id=>assert.ok(!Object.values(PROF(id)).some(Array.isArray),id)));
ok('A22 perfis pairwise distintos em ≥3 campos',()=>{for(let i=0;i<MELEE_IDS.length;i++)for(let j=i+1;j<MELEE_IDS.length;j++){const a=PROF(MELEE_IDS[i]),b=PROF(MELEE_IDS[j]);let diff=0;for(const k in a)if(a[k]!==b[k])diff++;assert.ok(diff>=3,MELEE_IDS[i]+' vs '+MELEE_IDS[j]);}});
ok('A23 identidade: katana é a sequência mais rápida',()=>{const t=id=>{const p=PROF(id);return p.windup+p.active+p.recover;};assert.ok(t('katana')<t('blade')&&t('katana')<=Math.min(...MELEE_IDS.map(t))+1e-9);});
ok('A24 identidade: antecipação do hammer ≥ 3× a da katana',()=>assert.ok(PROF('hammer').windup>=3*PROF('katana').windup));
ok('A25 identidade: estocada (glaive) avança mais que o corte (blade)',()=>assert.ok(PROF('glaive').extOut>PROF('blade').extOut));
ok('A26 identidade: cleave (chains) gira o corpo mais que o light (katana)',()=>assert.ok(PROF('chains').bodyTurn>PROF('katana').bodyTurn));
ok('A27 identidade: rotação do thrust é mínima vs cleave',()=>assert.ok(PROF('glaive').windupAngle+PROF('glaive').endAngle<PROF('chains').windupAngle));
ok('A28 fallback para def desconhecida é finito e válido',()=>{const p=T.meleeVisualProfile({id:'__inexistente__'});assert.ok(Object.isFrozen(p)&&T.MELEE_VISUAL_FAMILIES.indexOf(p.family)>=0&&p.windup>0);});
ok('A29 lookup com null/undefined é seguro',()=>{assert.ok(T.meleeVisualProfile(null));assert.ok(T.meleeVisualProfile(undefined));});
ok('A30 latência de impacto visual ≤ .25s (impacto perto do evento real)',()=>MELEE_IDS.forEach(id=>{const p=PROF(id);const f=p.windupAngle/(p.windupAngle+p.endAngle);const lat=p.windup+f*p.active;assert.ok(lat<=.25,id+' '+lat.toFixed(3));}));

/* ============ B · TIMELINE / FASES FORMAIS ============ */
ok('B01 fire inicia a timeline em WINDUP',()=>{const e=unit();T.fireMelee(e,W('blade'),'ally',1);assert.strictEqual(e.visual.melee.state,'windup');});
ok('B02 t inicial = prof.windup exato',()=>{const e=unit();T.fireMelee(e,W('blade'),'ally',1);assert.ok(near(e.visual.melee.t,PROF('blade').windup));});
ok('B03 windup→active com duração do perfil',()=>{const e=unit();T.fireMelee(e,W('blade'),'ally',1);T.visualTimelineTick(e,PROF('blade').windup);assert.strictEqual(e.visual.melee.state,'active');assert.ok(near(e.visual.melee.t,PROF('blade').active));});
ok('B04 active→recover',()=>{const e=phaseAt('blade','active');T.visualTimelineTick(e,PROF('blade').active);assert.strictEqual(e.visual.melee.state,'recover');});
ok('B05 recover→IDLE (retorno garantido)',()=>{const e=phaseAt('blade','recover');T.visualTimelineTick(e,PROF('blade').recover);assert.strictEqual(e.visual.melee.state,'');});
ok('B06 prof liberada ao terminar (sem referência presa)',()=>{const e=phaseAt('blade','recover');T.visualTimelineTick(e,PROF('blade').recover);assert.strictEqual(e.visual.melee.prof,null);});
ok('B07 dt grande satura e encerra sem NaN',()=>{const e=phaseAt('blade','windup');T.visualTimelineTick(e,99);let s=e.visual.melee.state;for(let i=0;i<5;i++)T.visualTimelineTick(e,99);assert.ok(s===''||e.visual.melee.state==='');assert.ok(Number.isFinite(e.visual.melee.t));});
ok('B08 dt NaN não propaga',()=>{const e=phaseAt('blade','active');T.visualTimelineTick(e,NaN);assert.ok(Number.isFinite(e.visual.melee.t));});
ok('B09 dt Infinity não propaga',()=>{const e=phaseAt('blade','active');T.visualTimelineTick(e,Infinity);assert.ok(Number.isFinite(e.visual.melee.t));});
ok('B10 dt negativo não avança',()=>{const e=phaseAt('blade','windup');T.visualTimelineTick(e,-1);assert.strictEqual(e.visual.melee.state,'windup');});
ok('B11 dt 0 não avança',()=>{const e=phaseAt('blade','windup');T.visualTimelineTick(e,0);assert.strictEqual(e.visual.melee.state,'windup');});
ok('B12 golpe novo durante recover reinicia em windup (combo, sem estado preso)',()=>{const e=phaseAt('chains','recover');T.fireMelee(e,W('chains'),'ally',1);assert.strictEqual(e.visual.melee.state,'windup');});
ok('B13 direção alterna com swingDir mecânico',()=>{const e=unit();T.fireMelee(e,W('blade'),'ally',1);const d1=e.visual.melee.dir;T.fireMelee(e,W('blade'),'ally',1);assert.strictEqual(e.visual.melee.dir,-d1);});
ok('B14 cancel → pose neutra imediata',()=>{const e=phaseAt('scythe','active');T.meleeVisualCancel(e);assert.strictEqual(e.visual.melee.state,'');assert.strictEqual(T.visualMeleeWeaponPose(e),null);});
ok('B15 cancel NÃO toca cooldown real',()=>{const e=unit();e.fireTimer=.3;T.fireMelee(e,W('blade'),'ally',1);T.meleeVisualCancel(e);assert.strictEqual(e.fireTimer,.3);});
ok('B16 sub-objeto melee é fixo de 4 chaves',()=>{const e=unit();T.fireMelee(e,W('blade'),'ally',1);assert.deepStrictEqual(Object.keys(e.visual.melee).sort(),['dir','prof','state','t']);});
ok('B17 contrato da fundação preservado (≤20 chaves em visual)',()=>{const e=unit();for(let i=0;i<50;i++)T.fireMelee(e,W('blade'),'ally',1);assert.ok(Object.keys(e.visual).length<=20);});
ok('B18 tick em entidade sem visual não cria estado',()=>{const e={x:0,y:0};T.visualTimelineTick(e,.016);assert.strictEqual(e.visual,undefined);});
ok('B19 1000 golpes não crescem o estado',()=>{const e=unit();for(let i=0;i<1000;i++){T.fireMelee(e,W('katana'),'ally',1);T.visualTimelineTick(e,.05);}assert.strictEqual(Object.keys(e.visual.melee).length,4);assert.ok(!Object.values(e.visual).some(Array.isArray));});
ok('B20 bloco D sem listener/timer/RAF',()=>assert.ok(!/addEventListener|setTimeout|setInterval|requestAnimationFrame/.test(DBLOCK())));
ok('B21 bloco D sem array crescente (nenhum push/filter/map)',()=>assert.ok(!/\.push\(|\.filter\(|\.map\(|\.concat\(|new Array/.test(DBLOCK())));
ok('B22 todas as armas completam o ciclo em ≤ interval',()=>MELEE_IDS.forEach(id=>{const e=unit();T.fireMelee(e,W(id),'ally',1);const p=PROF(id);let n=0;while(e.visual.melee.state&&n<1000){T.visualTimelineTick(e,1/120);n++;}assert.ok(n<1000,id);assert.strictEqual(e.visual.melee.state,'');}));

/* ============ C · POSE DA ARMA ============ */
ok('C01 idle → pose null (fast path)',()=>{const e=unit();assert.strictEqual(T.visualMeleeWeaponPose(e),null);});
ok('C02 windup: rot oposta ao sweep, no máximo −W',()=>{const e=phaseAt('blade','windup');T.visualTimelineTick(e,PROF('blade').windup);const wp=T.visualMeleeWeaponPose(e);assert.ok(near(wp.rot,-PROF('blade').windupAngle));});
ok('C03 active: rotação cruza o centro (impacto)',()=>MELEE_IDS.forEach(id=>{const e=phaseAt(id,'active');let prev=T.visualMeleeWeaponPose(e).rot,crossed=false;for(let i=0;i<200;i++){T.visualTimelineTick(e,1/300);const wp=T.visualMeleeWeaponPose(e);if(!wp)break;if(prev<0!==(wp.rot<0))crossed=true;prev=wp.rot;}assert.ok(crossed,id);}));
ok('C04 active termina em +E (follow-through além do arco)',()=>{const e=phaseAt('blade','active');T.visualTimelineTick(e,PROF('blade').active);assert.ok(near(T.visualMeleeWeaponPose(e).rot,PROF('blade').endAngle));});
ok('C05 recover retorna a ~0 e então à pose neutra',()=>MELEE_IDS.forEach(id=>{const e=phaseAt(id,'recover');T.visualTimelineTick(e,PROF(id).recover-.001);assert.ok(Math.abs(T.visualMeleeWeaponPose(e).rot)<.02,id);T.visualTimelineTick(e,.001);assert.strictEqual(T.visualMeleeWeaponPose(e),null);}));
ok('C06 pose escreve sempre no MESMO scratch (zero alocação)',()=>{const e=phaseAt('chains','active');const a=T.visualMeleeWeaponPose(e);T.visualTimelineTick(e,.01);const b=T.visualMeleeWeaponPose(e);assert.strictEqual(a,b);});
ok('C07 todas as coordenadas finitas em 100 amostras × 7 armas',()=>MELEE_IDS.forEach(id=>{const e=unit();T.meleeVisualStart(e,W(id),1);for(let i=0;i<100;i++){T.visualTimelineTick(e,1/120);const wp=T.visualMeleeWeaponPose(e);if(wp)[wp.rot,wp.gx,wp.gy,wp.sx,wp.sy,wp.a1x,wp.a1y,wp.a2x,wp.a2y].forEach(v=>assert.ok(Number.isFinite(v),id));}}));
ok('C08 escala nunca ≤0 nem >2',()=>MELEE_IDS.forEach(id=>{const e=unit();T.meleeVisualStart(e,W(id),1);for(let i=0;i<100;i++){T.visualTimelineTick(e,1/120);const wp=T.visualMeleeWeaponPose(e);if(wp){assert.ok(wp.sx>.01&&wp.sx<=2&&wp.sy>.01&&wp.sy<=2,id);}}}));
ok('C09 thrust: punho avança visivelmente além da pose neutra',()=>{const e=phaseAt('glaive','active');T.visualTimelineTick(e,PROF('glaive').active*.7);const gx=T.visualMeleeWeaponPose(e).gx;assert.ok(gx>13*.86+2,'gx='+gx);});
ok('C10 r ausente/NaN → fallback 14 sem NaN',()=>{const e=phaseAt('blade','active');delete e.r;assert.ok(Number.isFinite(T.visualMeleeWeaponPose(e).gx));e.r=NaN;assert.ok(Number.isFinite(T.visualMeleeWeaponPose(e).gx));});
ok('C11 pose não altera posição/mira/vida da unidade',()=>{const e=phaseAt('scythe','active');const b=[e.x,e.y,e.aim,e.hp];T.visualMeleeWeaponPose(e);T.visualMeleeBodyPose(e);assert.deepStrictEqual([e.x,e.y,e.aim,e.hp],b);});
ok('C12 determinismo: mesma sequência → mesmos valores',()=>{const run=()=>{const e=unit();T.meleeVisualStart(e,W('hammer'),1);const out=[];for(let i=0;i<60;i++){T.visualTimelineTick(e,1/60);const wp=T.visualMeleeWeaponPose(e);out.push(wp?wp.rot.toFixed(6):'x');}return out.join(',');};assert.strictEqual(run(),run());});
ok('C13 espelho: dir=+1 e dir=−1 produzem rotações simétricas',()=>{const a=unit(),b=unit();T.meleeVisualStart(a,W('blade'),1);T.meleeVisualStart(b,W('blade'),-1);for(let i=0;i<30;i++){T.visualTimelineTick(a,1/60);T.visualTimelineTick(b,1/60);const ra=T.visualMeleeWeaponPose(a);const va=ra?ra.rot:0;const rb=T.visualMeleeWeaponPose(b);const vb=rb?rb.rot:0;if(ra&&rb)assert.ok(near(va,-vb,1e-9),'f'+i+' '+va+' vs '+vb);}});

/* ============ D · POSE CORPORAL + COMPOSIÇÃO ============ */
ok('D01 corpo idle → null',()=>assert.strictEqual(T.visualMeleeBodyPose(unit()),null));
ok('D02 windup: corpo torce CONTRA o golpe',()=>{const e=phaseAt('chains','windup');T.visualTimelineTick(e,PROF('chains').windup);const bp=T.visualMeleeBodyPose(e);assert.ok(near(bp.rotation,-PROF('chains').bodyTurn*.6));});
ok('D03 active: lean no sentido do golpe',()=>{const e=phaseAt('chains','active');T.visualTimelineTick(e,PROF('chains').active);const bp=T.visualMeleeBodyPose(e);assert.ok(near(bp.lean,PROF('chains').bodyLean));});
ok('D04 recover: corpo volta ao neutro e então à pose null',()=>MELEE_IDS.forEach(id=>{const e=phaseAt(id,'recover');T.visualTimelineTick(e,PROF(id).recover-.001);const bp=T.visualMeleeBodyPose(e);assert.ok(Math.abs(bp.rotation)<.02&&Math.abs(bp.lean)<.02&&Math.abs(bp.offsetX)<.3,id);T.visualTimelineTick(e,.001);assert.strictEqual(T.visualMeleeBodyPose(e),null);}));
ok('D05 movimento corporal sempre discreto (≤.4 rad, ≤.3·r)',()=>MELEE_IDS.forEach(id=>{const e=unit();T.meleeVisualStart(e,W(id),1);for(let i=0;i<100;i++){T.visualTimelineTick(e,1/120);const bp=T.visualMeleeBodyPose(e);if(bp){assert.ok(Math.abs(bp.rotation)<=.4&&Math.abs(bp.lean)<=.4&&Math.abs(bp.offsetX)<=.3*13+1e-9&&bp.scaleY>.7&&bp.scaleY<=1.3,id);}}}));
ok('D06 composição melee+hurt finita e determinística',()=>{const e=phaseAt('hammer','active');T.visualNotifyHurt(e,100,500);const p1=T.visualPlayerDrawPose(e);const p2=T.visualPlayerDrawPose(e);assert.ok([p1.offsetX,p1.offsetY,p1.rotation,p1.scaleX,p1.scaleY,p1.alpha].every(Number.isFinite));assert.deepStrictEqual(p1,p2);});
ok('D07 composição preserva o offset do hurt',()=>{const e=phaseAt('hammer','active');T.visualNotifyHurt(e,100,500);const c=T.visualPlayerDrawPose(e);const h=T.visualHurtPose(e);assert.ok(!near(c.offsetX,h.offsetX)||!near(c.offsetY,h.offsetY));});
ok('D08 hurt não cancela o golpe (estado persiste)',()=>{const e=phaseAt('blade','active');T.visualNotifyHurt(e,0,0);assert.strictEqual(e.visual.melee.state,'active');});
ok('D09 golpe não cancela o hurt (evento persiste)',()=>{const e=phaseAt('blade','active');T.visualNotifyHurt(e,0,0);T.visualTimelineTick(e,.02);assert.strictEqual(e.visual.event,'hurt');assert.ok(e.visual.eventT>0);});
ok('D10 sem hurt e sem melee → pose de desenho null',()=>{const e=unit();assert.strictEqual(T.visualPlayerDrawPose(e),null);});

/* ============ E · TRAIL ============ */
ok('E01 swing real carrega perfil (mv) e vida das fases',()=>{resetWorld();const e=unit();T.fireMelee(e,W('blade'),'ally',1);const s=T.getSwings()[0];const p=PROF('blade');assert.strictEqual(s.mv,p);assert.ok(near(s.life,p.windup+p.active+p.trailFade));});
ok('E02 windup não desenha rastro',()=>{resetWorld();const e=unit();T.fireMelee(e,W('blade'),'ally',1);const l=opsOf(()=>T.drawSwings());assert.strictEqual(l.length,0);});
ok('E03 active desenha o trail',()=>{resetWorld();const e=unit();T.fireMelee(e,W('blade'),'ally',1);T.updateSwings(PROF('blade').windup+.05);assert.ok(opsOf(()=>T.drawSwings()).length>0);});
ok('E04 trail do perfil NÃO usa shadowBlur',()=>{resetWorld();const e=unit();T.fireMelee(e,W('chains'),'ally',1);T.updateSwings(PROF('chains').windup+.09);assert.strictEqual(blurPos(opsOf(()=>T.drawSwings())),0);});
ok('E05 estilo arc: exatamente 3 paths (arco+fio+setor)',()=>{resetWorld();const e=unit();T.fireMelee(e,W('blade'),'ally',1);T.updateSwings(PROF('blade').windup+.05);assert.strictEqual(nOp(opsOf(()=>T.drawSwings()),'beginPath'),3);});
ok('E06 estilo line (glaive): afterimage longitudinal sem arco de setor',()=>{resetWorld();const e=unit();T.fireMelee(e,W('glaive'),'ally',1);T.updateSwings(PROF('glaive').windup+.05);const l=opsOf(()=>T.drawSwings());assert.strictEqual(nOp(l,'beginPath'),2);assert.strictEqual(nOp(l,'lineTo'),2);assert.strictEqual(nOp(l,'arc'),0);});
ok('E07 estilo impact (hammer): cunha compacta (fill+stroke)',()=>{resetWorld();const e=unit();T.fireMelee(e,W('hammer'),'ally',1);T.updateSwings(PROF('hammer').windup+.05);const l=opsOf(()=>T.drawSwings());assert.strictEqual(nOp(l,'beginPath'),2);assert.ok(nOp(l,'fill')>=1);});
ok('E08 swing expira sozinho após as fases (updateSwings)',()=>{resetWorld();const e=unit();T.fireMelee(e,W('katana'),'ally',1);const p=PROF('katana');for(let i=0;i<Math.ceil((p.windup+p.active+p.trailFade)*120)+2;i++)T.updateSwings(1/120);assert.strictEqual(T.getSwings().length,0);});
ok('E09 trail segue a arma: ângulos idênticos durante o ACTIVE',()=>{resetWorld();const e=unit();T.fireMelee(e,W('scythe'),'ally',1);const p=PROF('scythe');const half=Math.ceil((p.windup+p.active*.5)*60);for(let i=0;i<half;i++){T.visualTimelineTick(e,1/60);T.updateSwings(1/60);}const sw=T.getSwings()[0];const wp=T.visualMeleeWeaponPose(e);assert.ok(wp);assert.strictEqual(e.visual.melee.state,'active');assert.ok(near(T.meleeVisualTrailAngle(sw,p),wp.rot,1e-9));});
ok('E10 fallback legado preservado para swing sem perfil (com blur original)',()=>{resetWorld();T.setSwings([{x:0,y:0,aim:0,reach:90,arc:1.5,t:.05,life:.26,team:'ally',color:'#46e0ff',dir:1}]);const l=opsOf(()=>T.drawSwings());assert.ok(l.length>0);assert.ok(blurPos(l)>0);});
ok('E11 trail usa a cor da arma (e do crítico)',()=>{resetWorld();const e=unit();e.crit=1;T.fireMelee(e,W('blade'),'ally',1);assert.strictEqual(T.getSwings()[0].color,'#fff6b0');});
ok('E12 todos os argumentos do trail são finitos',()=>{resetWorld();MELEE_IDS.forEach(id=>{const e=unit();T.fireMelee(e,W(id),'ally',1);for(let k=0;k<40;k++)T.updateSwings(1/60);assert.ok(argsFinite(opsOf(()=>T.drawSwings())),id);resetWorld();});});

/* ============ F · ORIENTAÇÃO 360° ============ */
const DIRS=[[1,0,'direita'],[0.7071,0.7071,'diagonal inferior-direita'],[0,1,'baixo'],[-0.7071,0.7071,'diagonal inferior-esquerda'],[-1,0,'esquerda'],[-0.7071,-0.7071,'diagonal superior-esquerda'],[0,-1,'cima'],[0.7071,-0.7071,'diagonal superior-direita']];
DIRS.forEach(([dx,dy,nome],idx)=>{
  ok('F'+String(idx+1).padStart(2,'0')+' '+nome+': pose e trail finitos, lâmina dentro de ±π do aim',()=>{
    resetWorld();const e=unit();e.aim=Math.atan2(dy,dx);
    T.fireMelee(e,W('chains'),'ally',1);
    const p=PROF('chains');
    for(let i=0;i<Math.ceil((p.windup+p.active/2)*120);i++){T.visualTimelineTick(e,1/120);T.updateSwings(1/120);}
    const wp=T.visualMeleeWeaponPose(e);assert.ok(wp);
    const blade=e.aim+wp.rot;
    let d=blade-e.aim;while(d>Math.PI)d-=TAU2();while(d<-Math.PI)d+=TAU2();
    assert.ok(Math.abs(d)<Math.PI);
    assert.ok(argsFinite(opsOf(()=>T.drawSwings())));
    assert.ok(argsFinite(opsOf(()=>T.drawUnit(e.x,e.y,e.aim,e.r,{body:'#444',dark:'#222',edge:'#8ff6ff',glow:'#8ff6ff',visor:'#fff',head:'#555',wep:'#8ff6ff'},{wi:16,melee:wp}))));
  });
});
function TAU2(){return Math.PI*2;}
ok('F09 corte espelhado coerente esquerda/direita (dir ±1)',()=>{const mk=dir=>{const e=unit();T.meleeVisualStart(e,W('scythe'),dir);const p=PROF('scythe');for(let i=0;i<Math.ceil((p.windup+p.active*.5)*120);i++)T.visualTimelineTick(e,1/120);return T.visualMeleeWeaponPose(e).rot;};assert.ok(near(mk(1),-mk(-1),1e-9));});
ok('F10 8 direções × 7 armas: nenhuma pose NaN',()=>{DIRS.forEach(([dx,dy])=>MELEE_IDS.forEach(id=>{const e=unit();e.aim=Math.atan2(dy,dx);T.meleeVisualStart(e,W(id),1);for(let i=0;i<50;i++){T.visualTimelineTick(e,1/120);const wp=T.visualMeleeWeaponPose(e);if(wp)assert.ok(Number.isFinite(wp.rot)&&Number.isFinite(wp.gx),id);}}));});

/* ============ G · ALINHAMENTO MECÂNICO (§26) ============ */
function armedPlayer(id){T.startRun();const p=T.getPlayer();const wi=T.WEAPONS.indexOf(W(id));p.owned=[wi];p.wi=wi;p.crit=0;p.fireTimer=0;resetWorld();return p;}
function enemyAt(x,y){const e=T.spawnEnemy('chaser',x,y,1);e.spawnT=0;e.hp=e.maxHp=100000;return e;}
ok('G01 visual começa exatamente quando o ataque real dispara',()=>{const p=armedPlayer('blade');const before=p.visual&&p.visual.melee?p.visual.melee.state:'';assert.strictEqual(before,'');T.fireWeaponFrom(p,W('blade'),'ally',1);assert.strictEqual(p.visual.melee.state,'windup');});
ok('G02 dano aplicado no MESMO instante do fire (não espera pose)',()=>{const p=armedPlayer('blade');const e=enemyAt(p.x+60,p.y);const hp=e.hp;T.fireWeaponFrom(p,W('blade'),'ally',1);assert.ok(e.hp<hp);});
ok('G03 dano exato = dmg·mul (sem crit) — inalterado pela camada visual',()=>{const p=armedPlayer('blade');const e=enemyAt(p.x+60,p.y);const hp0=e.hp;T.fireWeaponFrom(p,W('blade'),'ally',1);assert.ok(near(hp0-e.hp,W('blade').dmg,1e-6));});
ok('G04 melee não cria projétil',()=>{const p=armedPlayer('katana');T.setProjectiles([]);T.fireWeaponFrom(p,W('katana'),'ally',1);assert.strictEqual(T.getProjectiles().length,0);});
ok('G05 exatamente 1 swing por ataque',()=>{const p=armedPlayer('gaunt');T.fireWeaponFrom(p,W('gaunt'),'ally',1);assert.strictEqual(T.getSwings().length,1);});
ok('G06 ranged não inicia timeline melee',()=>{const p=armedPlayer('blade');p.wi=0;T.fireWeaponFrom(p,T.WEAPONS[0],'ally',1);assert.ok(!p.visual.melee.state);});
ok('G07 interval/reach/arc/dmg das 7 melee idênticos à base',()=>{
  const base={blade:[.38,104,1.55,46],katana:[.24,96,.95,29],scythe:[.46,118,2.20,38],chains:[.58,172,2.90,34],glaive:[.72,158,1.15,55],gaunt:[.30,74,1.05,41],hammer:[.95,132,1.30,72]};
  MELEE_IDS.forEach(id=>{const w=W(id);assert.deepStrictEqual([w.interval,w.reach,w.arc,w.dmg],base[id],id);});
});
ok('G08 propriedades especiais intactas (pull/knock/shock/lifesteal/crit/fx)',()=>{
  assert.strictEqual(W('chains').pullIn,180);assert.strictEqual(W('gaunt').knock,420);assert.strictEqual(W('gaunt').lifesteal,.10);
  assert.strictEqual(W('hammer').shockwave,190);assert.strictEqual(W('scythe').lifesteal,.16);assert.strictEqual(W('katana').crit,.20);
  const fxg=W('glaive').fx,fxc=W('chains').fx;
  assert.strictEqual(fxg.k,'corrode');assert.strictEqual(fxg.dur,4);assert.strictEqual(fxg.pow,.14);
  assert.strictEqual(fxc.k,'bleed');assert.strictEqual(fxc.dur,3);assert.strictEqual(fxc.pow,5);
});
ok('G09 cooldown real não é tocado pela timeline visual',()=>{const p=armedPlayer('chains');p.fireTimer=.3;T.fireWeaponFrom(p,W('chains'),'ally',1);assert.strictEqual(p.fireTimer,.3);for(let i=0;i<30;i++)T.visualTimelineTick(p,1/60);assert.strictEqual(p.fireTimer,.3);});
ok('G10 range efetivo inalterado por golpe/pose',()=>{const p=armedPlayer('scythe');const r0=T.weaponRange(W('scythe'),p);T.fireWeaponFrom(p,W('scythe'),'ally',1);T.visualTimelineTick(p,.05);T.visualMeleeWeaponPose(p);assert.strictEqual(T.weaponRange(W('scythe'),p),r0);});
ok('G11 hitbox respeitada: inimigo fora do arco não é atingido',()=>{const p=armedPlayer('blade');p.aim=0;const fora=enemyAt(p.x,p.y+200);const hp=fora.hp;T.fireWeaponFrom(p,W('blade'),'ally',1);assert.strictEqual(fora.hp,hp);});
ok('G12 penetração: 3 inimigos no arco, todos atingidos no mesmo fire',()=>{const p=armedPlayer('blade');p.aim=0;const a=enemyAt(p.x+80,p.y-20),b=enemyAt(p.x+85,p.y),c=enemyAt(p.x+80,p.y+20);const hps=[a.hp,b.hp,c.hp];T.fireWeaponFrom(p,W('blade'),'ally',1);assert.ok(a.hp<hps[0]&&b.hp<hps[1]&&c.hp<hps[2]);});
ok('G13 knockback/pullIn aplicados mecanicamente (inalterados)',()=>{const p=armedPlayer('gaunt');p.aim=0;const e=enemyAt(p.x+50,p.y);const vx=e.vx;T.fireWeaponFrom(p,W('gaunt'),'ally',1);assert.ok(e.vx>vx);});
ok('G14 anel de contato: +1 ring só quando acerta (miss não gera)',()=>{const p=armedPlayer('blade');const parts0=T.getParts().filter(x=>x.ring).length;T.fireWeaponFrom(p,W('blade'),'ally',1);assert.strictEqual(T.getParts().filter(x=>x.ring).length,parts0);const e=enemyAt(p.x+60,p.y);T.fireWeaponFrom(p,W('blade'),'ally',1);assert.strictEqual(T.getParts().filter(x=>x.ring).length,parts0+1);});
ok('G15 anel de contato é único por ataque (não por inimigo)',()=>{const p=armedPlayer('blade');const e1=enemyAt(p.x+60,p.y-15),e2=enemyAt(p.x+60,p.y+15);const parts0=T.getParts().filter(x=>x.ring).length;T.fireWeaponFrom(p,W('blade'),'ally',1);assert.strictEqual(T.getParts().filter(x=>x.ring).length,parts0+1);});
ok('G16 cancelar o visual não muda o dano do próximo golpe',()=>{const p=armedPlayer('katana');const e1=enemyAt(p.x+50,p.y);const h1=e1.hp;T.fireWeaponFrom(p,W('katana'),'ally',1);const d1=h1-e1.hp;T.meleeVisualCancel(p);const e2=enemyAt(p.x+50,p.y);const h2=e2.hp;T.fireWeaponFrom(p,W('katana'),'ally',1);const d2=h2-e2.hp;assert.ok(near(d1,d2));});
ok('G17 crit continua alternando cor do swing (mecânica intacta)',()=>{const p=armedPlayer('blade');p.crit=1;T.fireWeaponFrom(p,W('blade'),'ally',1);assert.strictEqual(T.getSwings()[0].color,'#fff6b0');});

/* hashes integrais dos blocos mecânicos — idênticos à base 4667720b */
const MECH_PINS={
  WEAPONS:[/const WEAPONS=\[[\s\S]*?\n\];/,'cb92e03d4d36f390b41c70b8ab85e5ace7e183b779249dfa89295ff7bfabda03'],
  EDEFS:[/const EDEFS=\{[\s\S]*?\n\};/,'9a646757e52d8b6b69f1ac09df16441b6437e0fe1bcfb5f739c58eb8119a178b'],
  waveCompBase:[/function waveCompBase\(n\)\{[\s\S]*?\n\}/,'3f49dd9c64897c75062d248e0096ad8d493190cc1dfb0dda9935ae6cb82eb368'],
  MINIBOSS:[/const MINIBOSS=\[[\s\S]*?\n\];/,'6ce87e31b85d36526611d202d98473bc587e8fb241d9dae20ba2569fc107dc18'],
  spawnBoss:[/function spawnBoss\(\)\{[\s\S]*?\n\}/,'3872a65edcacad431d90d014d0741cad5c6b84767a5a02189f701c410fc7379e'],
  /* PR15.7-A: único desvio mecânico aprovado neste pin é o tick O(1) de
     expiração da ação temporal; não toca animação nem combate melee. */
  updatePlayer:[/function updatePlayer\(dt\)\{[\s\S]*?\n\}/,'bdbe526ccb3e05ae63401ca014c324848b3e7f3d78f1e0429cba5b98c58bf6ed'],
  updateSwings:[/function updateSwings\(dt\)\{[\s\S]*?\n\}/,'cd2a0ad7d8e69f4d6906e0bd3a67d5cdb017dddd1ce4ec2babae8587bb508fd0'],
  updateEcho:[/function updateEcho\(e,dt\)\{[\s\S]*?\n\}/,'9bbc62736cba04c0305c16f8a82988c8ecebd16df37d2dbc9f4eac81b223e656']
};
for(const [name,[pattern,hash]] of Object.entries(MECH_PINS))
  ok('G18 '+name+' byte-a-byte idêntico à base 4667720b',()=>{const b=SRC.match(pattern);assert.ok(b);assert.strictEqual(crypto.createHash('sha256').update(b[0]).digest('hex'),hash);});
ok('G19 fireMelee pós-D pinado (lock da integração visual)',()=>{const b=SRC.match(/function fireMelee\([^\n]*\)\{[\s\S]*?\n\}/);assert.ok(b);assert.strictEqual(crypto.createHash('sha256').update(b[0]).digest('hex'),'8c84d3f90db6a9a1b12d45c9268179c7c89016156fd03b97bfb0ae89bee93c27');});

/* ============ H · DRAW PURITY / PERSISTÊNCIA ============ */
ok('H01 drawPlayer não altera estado mecânico do jogador',()=>{const p=armedPlayer('chains');T.fireWeaponFrom(p,W('chains'),'ally',1);T.visualTimelineTick(p,.05);const b=[p.x,p.y,p.hp,p.fireTimer,p.wi,p.aim];sandbox.__ctxLog=[];T.drawPlayer();sandbox.__ctxLog=null;assert.deepStrictEqual([p.x,p.y,p.hp,p.fireTimer,p.wi,p.aim],b);});
ok('H02 drawUnit com pose melee não altera a entidade',()=>{const e=phaseAt('hammer','active');const b=JSON.stringify({x:e.x,y:e.y,aim:e.aim,hp:e.hp});const wp=T.visualMeleeWeaponPose(e);sandbox.__ctxLog=[];T.drawUnit(e.x,e.y,e.aim,e.r,{body:'#444',dark:'#222',edge:'#8ff6ff',glow:'#8ff6ff',visor:'#fff',head:'#555',wep:'#8ff6ff'},{wi:17,melee:wp});sandbox.__ctxLog=null;assert.strictEqual(JSON.stringify({x:e.x,y:e.y,aim:e.aim,hp:e.hp}),b);});
ok('H03 checkpoint não persiste estado visual do golpe (zero persistência)',()=>{const p=armedPlayer('scythe');T.fireWeaponFrom(p,W('scythe'),'ally',1);const j=JSON.stringify(T.smBuildCheckpoint('teste',1));assert.ok(!j.includes('meleeState')&&!j.includes('meleeProf')&&!j.includes('"visual"')&&!j.includes('trailStyle'));});
ok('H04 bloco D sem aleatoriedade/relógio (random/now)',()=>assert.ok(!/Math\.random|Date\.now|performance\.now/.test(DBLOCK())));
ok('H05 drawSwings+meleeDrawTrail sem aleatoriedade/relógio',()=>{for(const fn of ['drawSwings','meleeDrawTrail']){const b=SRC.match(new RegExp('function '+fn+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));assert.ok(b,fn);assert.ok(!/Math\.random|Date\.now|performance\.now/.test(b[0]),fn);}});
ok('H06 hot path das poses sem literal/objeto temporário',()=>{for(const fn of ['visualMeleeWeaponPose','visualMeleeBodyPose','visualPlayerDrawPose','meleeVisualPhaseProgress']){const b=SRC.match(new RegExp('function '+fn+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'));assert.ok(b,fn);assert.ok(!/new |\.map\(|\.filter\(|\.slice\(|\.concat\(|JSON\./.test(b[0]),fn);}});
ok('H07 poses reaproveitam scratches (identidade estável durante golpe)',()=>{const e=phaseAt('katana','active');for(let i=0;i<10;i++){T.visualTimelineTick(e,1/60);assert.strictEqual(T.visualMeleeWeaponPose(e),T.MELEE_VISUAL_PROFILES?T.visualMeleeWeaponPose(e):null);}});
ok('H08 500 golpes: estado O(1) e swings voltam a 0',()=>{resetWorld();const e=unit();for(let i=0;i<500;i++){T.fireMelee(e,W('katana'),'ally',1);T.visualTimelineTick(e,.1);T.updateSwings(.1);}assert.strictEqual(Object.keys(e.visual.melee).length,4);assert.ok(T.getSwings().length<600);});
ok('H09 draw não cria timeline (fire é o único início)',()=>{const e=unit();T.drawSwings();T.visualTimelineTick(e,.016);assert.ok(!e.visual||!e.visual.melee||!e.visual.melee.state);});
ok('H10 visual.melee nunca vira array',()=>{const e=unit();for(let i=0;i<100;i++){T.fireMelee(e,W('chains'),'ally',1);T.visualTimelineTick(e,.02);}assert.ok(!Array.isArray(e.visual.melee));});

/* ============ I · FAST PATH / CUSTO ESTRUTURAL ============ */
ok('I01 idle: pose da arma null',()=>{const p=armedPlayer('chains');assert.strictEqual(T.visualMeleeWeaponPose(p),null);});
ok('I02 idle: pose corporal null',()=>{const p=armedPlayer('hammer');assert.strictEqual(T.visualMeleeBodyPose(p),null);});
ok('I03 idle: pose composta null',()=>{const p=armedPlayer('glaive');assert.strictEqual(T.visualPlayerDrawPose(p),null);});
ok('I04 idle 600 frames: contagem de ops de drawPlayer IDÊNTICA antes/depois do golpe',()=>{
  const p=armedPlayer('chains');
  const idle=()=>{sandbox.__ctxLog=[];T.drawPlayer();const n=sandbox.__ctxLog.length;sandbox.__ctxLog=null;return n;};
  const a=idle();
  T.fireWeaponFrom(p,W('chains'),'ally',1);
  for(let f=0;f<Math.ceil((PROF('chains').windup+PROF('chains').active+PROF('chains').recover)*60)+5;f++)T.visualTimelineTick(p,1/60);
  const b=idle();
  assert.strictEqual(a,b);
});
ok('I05 idle 600 frames: zero swings, zero drift de ops entre frames',()=>{
  const p=armedPlayer('blade');let first=null;
  for(let f=0;f<600;f++){T.visualTimelineTick(p,1/60);sandbox.__ctxLog=[];T.drawSwings();const n=sandbox.__ctxLog.length;sandbox.__ctxLog=null;if(first===null)first=n;else assert.strictEqual(n,first);}
  assert.strictEqual(first,0);assert.strictEqual(T.getSwings().length,0);
});
ok('I06 custo ativo é curto e limitado (Δ ops drawPlayer+trail ≤ 45 vs idle)',()=>{
  MELEE_IDS.forEach(id=>{const p=armedPlayer(id);
    const idle=()=>{sandbox.__ctxLog=[];T.drawPlayer();const n=sandbox.__ctxLog.length;sandbox.__ctxLog=null;return n;};
    const base=idle();
    T.fireWeaponFrom(p,W(id),'ally',1);
    const prof=PROF(id);
    for(let f=0;f<Math.ceil((prof.windup+prof.active*.5)*60);f++)T.visualTimelineTick(p,1/60);
    sandbox.__ctxLog=[];T.drawPlayer();T.drawSwings();const act=sandbox.__ctxLog.length;sandbox.__ctxLog=null;
    assert.ok(act-base<=45,id+' Δ='+(act-base));
  });
});
ok('I07 durante o golpe: nenhum shadowBlur novo (trail blur-free)',()=>{
  MELEE_IDS.forEach(id=>{const p=armedPlayer(id);
    const blurIdle=blurPos(opsOf(()=>T.drawPlayer()));
    T.fireWeaponFrom(p,W(id),'ally',1);const prof=PROF(id);
    for(let f=0;f<Math.ceil((prof.windup+prof.active*.5)*60);f++)T.visualTimelineTick(p,1/60);
    T.updateSwings(0);
    sandbox.__ctxLog=[];T.drawPlayer();T.drawSwings();const b=blurPos(sandbox.__ctxLog);sandbox.__ctxLog=null;
    assert.strictEqual(b,blurIdle,id);
  });
});
ok('I08 save/restore: melee não empilha pares extras no drawPlayer',()=>{
  MELEE_IDS.forEach(id=>{const p=armedPlayer(id);
    const sr=()=>{sandbox.__ctxLog=[];T.drawPlayer();const l=sandbox.__ctxLog;sandbox.__ctxLog=null;return nOp(l,'save')+nOp(l,'restore');};
    const base=sr();
    T.fireWeaponFrom(p,W(id),'ally',1);const prof=PROF(id);
    for(let f=0;f<Math.ceil((prof.windup+prof.active*.5)*60);f++)T.visualTimelineTick(p,1/60);
    assert.strictEqual(sr(),base,id);
  });
});
ok('I09 transforms extras durante golpe ≤ 4 (rotate/scale/translate no grupamento)',()=>{
  MELEE_IDS.forEach(id=>{const p=armedPlayer(id);
    const tr=()=>{sandbox.__ctxLog=[];T.drawPlayer();const l=sandbox.__ctxLog;sandbox.__ctxLog=null;return nOp(l,'translate')+nOp(l,'rotate')+nOp(l,'scale');};
    const base=tr();
    T.fireWeaponFrom(p,W(id),'ally',1);const prof=PROF(id);
    for(let f=0;f<Math.ceil((prof.windup+prof.active*.5)*60);f++)T.visualTimelineTick(p,1/60);
    const d=tr()-base;assert.ok(d>=0&&d<=4,id+' Δ='+d);
  });
});
ok('I10 poses do golpe: exatamente 2 trig por frame (cos+sin da rotação)',()=>{
  const p=armedPlayer('scythe');T.fireWeaponFrom(p,W('scythe'),'ally',1);const prof=PROF('scythe');
  for(let f=0;f<Math.ceil((prof.windup+prof.active*.5)*60);f++)T.visualTimelineTick(p,1/60);
  const M=sandbox.Math,counts={sin:0,cos:0,atan2:0};const orig={sin:M.sin,cos:M.cos,atan2:M.atan2};
  M.sin=function(){counts.sin++;return orig.sin.apply(this,arguments);};
  M.cos=function(){counts.cos++;return orig.cos.apply(this,arguments);};
  M.atan2=function(){counts.atan2++;return orig.atan2.apply(this,arguments);};
  try{T.visualMeleeWeaponPose(p);T.visualMeleeBodyPose(p);T.visualPlayerDrawPose(p);}
  finally{M.sin=orig.sin;M.cos=orig.cos;M.atan2=orig.atan2;}
  assert.strictEqual(counts.sin+counts.cos,2);assert.strictEqual(counts.atan2,0);
});
ok('I11 idle: zero trig nas poses (retorno null imediato)',()=>{
  const p=armedPlayer('chains');
  const M=sandbox.Math,counts={sin:0,cos:0,atan2:0};const orig={sin:M.sin,cos:M.cos,atan2:M.atan2};
  M.sin=function(){counts.sin++;return orig.sin.apply(this,arguments);};
  M.cos=function(){counts.cos++;return orig.cos.apply(this,arguments);};
  M.atan2=function(){counts.atan2++;return orig.atan2.apply(this,arguments);};
  try{T.visualMeleeWeaponPose(p);T.visualMeleeBodyPose(p);T.visualPlayerDrawPose(p);}
  finally{M.sin=orig.sin;M.cos=orig.cos;M.atan2=orig.atan2;}
  assert.deepStrictEqual(counts,{sin:0,cos:0,atan2:0});
});

/* ============ S · WEAPON SWITCH / CANCEL ============ */
ok('S01 troca de arma durante WINDUP cancela a pose (sem fantasma)',()=>{const p=armedPlayer('blade');p.owned.push(0);T.fireWeaponFrom(p,W('blade'),'ally',1);T.setWeaponSlot(1);assert.strictEqual(p.visual.melee.state,'');assert.strictEqual(T.visualMeleeWeaponPose(p),null);});
ok('S02 troca durante ACTIVE cancela',()=>{const p=armedPlayer('katana');p.owned.push(0);T.fireWeaponFrom(p,W('katana'),'ally',1);T.visualTimelineTick(p,PROF('katana').windup+.02);T.setWeaponSlot(1);assert.strictEqual(p.visual.melee.state,'');});
ok('S03 troca durante RECOVER cancela',()=>{const p=armedPlayer('hammer');p.owned.push(0);T.fireWeaponFrom(p,W('hammer'),'ally',1);T.visualTimelineTick(p,PROF('hammer').windup+PROF('hammer').active+.02);T.setWeaponSlot(1);assert.strictEqual(p.visual.melee.state,'');});
ok('S04 troca NÃO altera o cooldown real (fireTimer=min(ft,.12) pré-existente)',()=>{const p=armedPlayer('chains');const wi2=T.WEAPONS.indexOf(T.WEAPONS[0]);p.owned=[T.WEAPONS.indexOf(W('chains')),0];p.fireTimer=.5;T.fireWeaponFrom(p,W('chains'),'ally',1);T.setWeaponSlot(1);assert.ok(Math.abs(p.fireTimer-.12)<1e-9);});
ok('S05 troca repetida não deixa estado preso',()=>{const p=armedPlayer('glaive');p.owned=[T.WEAPONS.indexOf(W('glaive')),0];for(let i=0;i<20;i++){T.fireWeaponFrom(p,W('glaive'),'ally',1);T.setWeaponSlot(i%2);}assert.strictEqual(p.visual.melee.state,'');});
ok('S06 recoil visual coexiste com a pose melee (composição, não substituição)',()=>{const p=armedPlayer('blade');T.fireWeaponFrom(p,W('blade'),'ally',1);assert.strictEqual(T.visualWeaponRecoil(p),1);assert.ok(T.visualMeleeWeaponPose(p));T.visualTimelineTick(p,.05);assert.ok(T.visualWeaponRecoil(p)>=0&&T.visualWeaponRecoil(p)<1);assert.ok(T.visualMeleeWeaponPose(p));});
ok('S07 hurt durante swing: drawPlayer com ambos finito e sem NaN',()=>{const p=armedPlayer('scythe');T.fireWeaponFrom(p,W('scythe'),'ally',1);T.visualNotifyHurt(p,p.x-100,p.y);const prof=PROF('scythe');for(let f=0;f<Math.ceil((prof.windup+prof.active*.5)*60);f++)T.visualTimelineTick(p,1/60);const l=opsOf(()=>T.drawPlayer());assert.ok(argsFinite(l)&&l.length>0);});
ok('S08 rotação nunca acumula sem limite (soma das poses limitada)',()=>{const p=armedPlayer('chains');for(let i=0;i<10;i++){T.fireWeaponFrom(p,W('chains'),'ally',1);T.visualTimelineTick(p,PROF('chains').windup+PROF('chains').active*.5);}const pose=T.visualPlayerDrawPose(p);assert.ok(Math.abs(pose.rotation)<=.4+1e-9);});

/* ============ J · ECHOS (reaproveitamento gratuito) ============ */
ok('J01 golpe de eco aliado inicia a mesma timeline',()=>{resetWorld();const e={x:900,y:900,aim:0,r:12,curW:16,swingDir:1};T.fireMelee(e,W('scythe'),'ally',1);assert.strictEqual(e.visual.melee.state,'windup');});
ok('J02 tick do eco avança as fases normalmente',()=>{const e={x:900,y:900,aim:0,r:12,swingDir:1};T.fireMelee(e,W('katana'),'ally',1);T.visualTimelineTick(e,PROF('katana').windup);assert.strictEqual(e.visual.melee.state,'active');});
ok('J03 eco hostil (time enemy) também recebe timeline (mesma função)',()=>{T.startRun();resetWorld();const p=T.getPlayer();const e={x:p.x+3000,y:p.y,aim:Math.PI,r:12,swingDir:1};T.fireMelee(e,W('blade'),'enemy',1);assert.strictEqual(e.visual.melee.state,'windup');assert.ok(p.hp>0);});
ok('J04 pose funciona para eco (mesma função, zero adaptação)',()=>{const e={x:900,y:900,aim:1.2,r:12,swingDir:1};T.fireMelee(e,W('chains'),'ally',1);T.visualTimelineTick(e,PROF('chains').windup);const wp=T.visualMeleeWeaponPose(e);assert.ok(wp&&Number.isFinite(wp.rot));});
ok('J05 cancel/pose do eco não altera IA (fireTimer/aim intactos)',()=>{const e={x:900,y:900,aim:.7,r:12,fireTimer:.4,swingDir:1};T.fireMelee(e,W('glaive'),'ally',1);T.meleeVisualCancel(e);T.visualMeleeWeaponPose(e);assert.ok(near(e.fireTimer,.4)&&near(e.aim,.7));});
ok('J06 drawUnit do eco com pose melee: argumentos finitos',()=>{const e={x:900,y:900,aim:.4,r:12,swingDir:1};T.fireMelee(e,W('gaunt'),'ally',1);T.visualTimelineTick(e,PROF('gaunt').windup);const wp=T.visualMeleeWeaponPose(e);const l=opsOf(()=>T.drawUnit(e.x,e.y,e.aim,e.r,{body:'#444',dark:'#222',edge:'#8ff6ff',glow:'#8ff6ff',visor:'#fff',head:'#555',wep:'#8ff6ff'},{wi:25,melee:wp}));assert.ok(argsFinite(l)&&l.length>0);});

/* ============ K · ROBUSTEZ / STRESS ============ */
ok('K01 entidade sem visual: pose null segura',()=>assert.strictEqual(T.visualMeleeWeaponPose({}),null));
ok('K02 null/undefined: pose null segura',()=>{assert.strictEqual(T.visualMeleeWeaponPose(null),null);assert.strictEqual(T.visualMeleeBodyPose(undefined),null);});
ok('K03 melee.t=NaN injetado não trava a máquina (avança e encerra)',()=>{const e=unit();T.meleeVisualStart(e,W('blade'),1);e.visual.melee.t=NaN;T.visualTimelineTick(e,.016);assert.ok(['active','recover',''].indexOf(e.visual.melee.state)>=0);let n=0;while(e.visual.melee.state&&n++<50)T.visualTimelineTick(e,.5);assert.strictEqual(e.visual.melee.state,'');});
ok('K04 dir inválido normaliza para −1 (determinístico)',()=>{const a=unit(),b=unit();T.meleeVisualStart(a,W('blade'),0);T.meleeVisualStart(b,W('blade'),undefined);assert.strictEqual(a.visual.melee.dir,-1);assert.strictEqual(b.visual.melee.dir,-1);});
ok('K05 prof nulo injetado: máquina encerra sem crash',()=>{const e=unit();T.meleeVisualStart(e,W('blade'),1);e.visual.melee.prof=null;T.visualTimelineTick(e,1);let n=0;while(e.visual.melee.state&&n++<10)T.visualTimelineTick(e,1);assert.strictEqual(e.visual.melee.state,'');});
ok('K06 stress: 46 unidades em melee × 300 frames — finito, sem crescimento',()=>{
  const es=[];for(let i=0;i<46;i++){const e=unit();e.x=i*20;e.y=i*10;T.meleeVisualStart(e,W(i%2?'chains':'hammer'),i%2?1:-1);es.push(e);}
  for(let f=0;f<300;f++){for(const e of es){T.visualTimelineTick(e,1/60);const wp=T.visualMeleeWeaponPose(e);if(wp)assert.ok(Number.isFinite(wp.rot));if(f%37===0)T.meleeVisualStart(e,W('katana'),1);}
  }
  assert.ok(es.every(e=>Object.keys(e.visual.melee).length===4));
});
ok('K07 double-fire no mesmo frame: último estado válido, 2 swings (comportamento base)',()=>{resetWorld();const e=unit();T.fireMelee(e,W('blade'),'ally',1);T.fireMelee(e,W('blade'),'ally',1);assert.strictEqual(e.visual.melee.state,'windup');assert.strictEqual(T.getSwings().length,2);});
ok('K08 spam na cadência máxima (katana, 600 frames): nunca NaN, estado sempre válido',()=>{
  const e=unit();const iv=W('katana').interval;let acc=iv; /* dispara já no 1º frame */
  for(let f=0;f<600;f++){acc+=1/60;if(acc>=iv){acc-=iv;T.fireMelee(e,W('katana'),'ally',1);}T.visualTimelineTick(e,1/60);
    if(!e.visual)continue;
    assert.ok(['','windup','active','recover'].indexOf(e.visual.melee.state)>=0);
    assert.ok(Number.isFinite(e.visual.melee.t));}
  assert.ok(e.visual&&Number.isFinite(e.visual.melee.t));
});

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
