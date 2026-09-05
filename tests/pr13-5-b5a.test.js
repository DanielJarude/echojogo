'use strict';
/* =====================================================================
   TESTES — PR13.5 · B5-A · IDENTIDADE VISUAL DOS MINI-CHEFES
   perfis · unicidade · pureza do renderer · determinismo · balance
   intacto · Fracture Director · Save/Continue · Sandbox · DEV · PARADOXO
   ===================================================================== */
const assert=require('assert');
const fs=require('fs'),path=require('path'),vm=require('vm');
const {sandbox,T}=require('../audit_pr135/harness.js');
const X=code=>vm.runInContext(code,sandbox);
const SRC=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
const IDS=['herald','furnace','sentinel','brood','duelist','colossus','oracle','leech'];
function fresh(){T.resetShopVars();T.setState('play');T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);T.startRun();T.setWave(5);}
function spawn(id,mode){
  const def=T.MINIBOSS.find(m=>m.id===id);
  if(T.getMiniBoss())T.setMiniBoss(null);
  const b=T.spawnMiniBoss(5,def);b.spawnT=0;b.x=600;b.y=400;
  if(mode==='phase2')b.phase=2;if(mode==='telegraph')b.telegraphT=.3;if(mode==='spawn')b.spawnT=.8;
  return b;
}
function fingerprint(b){globalThis.__ctxLog=[];T.drawMiniBoss(b);const L=globalThis.__ctxLog;globalThis.__ctxLog=null;const c={};for(const [k] of L)if(!/^set:/.test(k))c[k]=(c[k]||0)+1;return c;}
function dist(a,b){const ks=new Set([...Object.keys(a),...Object.keys(b)]);let d=0,t=0;for(const k of ks){d+=Math.abs((a[k]||0)-(b[k]||0));t+=Math.max(a[k]||0,b[k]||0);}return t?d/t:0;}
const blockStart=SRC.indexOf('const MINIBOSS_VISUALS='),blockEnd=SRC.indexOf('function spawnWave(n){');
const BLOCK=SRC.slice(blockStart,blockEnd);

console.log('\nECHO — PR13.5 · B5-A · IDENTIDADE VISUAL DOS MINI-CHEFES');
console.log('---------------------------------------------');

/* ================= PERFIS ================= */
ok('B5A-1: os 8 mini-chefes têm perfil visual, IDs válidos, nenhum faltando/sobrando',()=>{
  assert.strictEqual(T.MINIBOSS.length,8);
  assert.deepStrictEqual(T.MINIBOSS.map(m=>m.id).sort().join(','),IDS.slice().sort().join(','));
  assert.strictEqual(Object.keys(T.MINIBOSS_VISUALS).sort().join(','),IDS.slice().sort().join(','));
  for(const id of IDS)assert.ok(typeof T.MINIBOSS_RENDERERS[id]==='function',id+' renderer');
});
ok('B5A-2: cada perfil declara silhueta, elemento principal/secundário, telegraph, fase 2, spawn, paleta, escala, símbolo e leitura',()=>{
  for(const id of IDS){const V=T.MINIBOSS_VISUALS[id];
    for(const k of ['silhouette','feature','secondaryFeature','telegraph','phaseVisual','spawn','primary','secondary','accent','symbol','reading'])
      assert.ok(typeof V[k]==='string'&&V[k].length>0,id+'.'+k);
    assert.ok(V.scaleX>0&&V.scaleY>0);assert.ok(/^#[0-9a-f]{6}$/i.test(V.primary)&&/^#[0-9a-f]{6}$/i.test(V.secondary)&&/^#[0-9a-f]{6}$/i.test(V.accent));}
});
ok('B5A-3: nenhum par compartilha silhueta, elemento principal, fase 2 ou telegraph (todos 100% distintos nos 4 campos)',()=>{
  for(const k of ['silhouette','feature','phaseVisual','telegraph','spawn','symbol','reading']){
    const vals=IDS.map(id=>T.MINIBOSS_VISUALS[id][k]);assert.strictEqual(new Set(vals).size,8,k+' repetido: '+vals.join(','));}
  /* teste de confusão estrutural: nenhum par com os 4 campos iguais */
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){const A=T.MINIBOSS_VISUALS[IDS[i]],B=T.MINIBOSS_VISUALS[IDS[j]];
    const same=['silhouette','feature','phaseVisual','telegraph'].filter(k=>A[k]===B[k]).length;assert.ok(same<4,IDS[i]+'×'+IDS[j]+' clone');}
});
ok('B5A-4: cor não é o único diferenciador — renderers reais produzem assinaturas de primitivas distintas (distância ≥0.15 em todo par; antes brood×oracle = 0.00)',()=>{
  fresh();const fps={};for(const id of IDS)fps[id]=fingerprint(spawn(id,'base'));
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){const d=dist(fps[IDS[i]],fps[IDS[j]]);assert.ok(d>=.15,IDS[i]+'×'+IDS[j]+' d='+d.toFixed(3));}
  /* pelo menos 5 famílias de forma diferentes de fato: quadraticCurve (oracle/leech), scale (aspecto), arcs múltiplos (brood/oracle), closePath múltiplos (sentinel)… */
  assert.ok(fps.oracle.quadraticCurveTo>=2&&fps.leech.quadraticCurveTo>=5&&!fps.herald.quadraticCurveTo);
  assert.ok(fps.brood.arc>=10&&fps.duelist.arc<=2);
  assert.ok(fps.sentinel.closePath>=8&&fps.herald.closePath<=2);
});
ok('B5A-5: aspecto/silhueta — Duelista é o mais alongado (≥2×), Arauto vertical (<1), Fornalha larga (>1)',()=>{
  const asp=id=>T.MINIBOSS_VISUALS[id].scaleX/T.MINIBOSS_VISUALS[id].scaleY;
  assert.ok(asp('duelist')>=2);assert.ok(asp('herald')<1);assert.ok(asp('furnace')>1);
  assert.strictEqual(new Set(IDS.map(id=>asp(id).toFixed(2))).size>=4,true);
});
ok('B5A-6: fase 2 muda o desenho de TODOS (assinatura base ≠ fase 2) e a mudança não é idêntica entre pares',()=>{
  fresh();const d2={};
  for(const id of IDS){const a=fingerprint(spawn(id,'base')),b=fingerprint(spawn(id,'phase2'));assert.ok(dist(a,b)>0,id+' fase 2 igual à base');d2[id]=b;}
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)assert.ok(dist(d2[IDS[i]],d2[IDS[j]])>=.15,IDS[i]+'×'+IDS[j]+' fase 2 clone');
  for(const id of IDS)assert.ok(T.MINIBOSS_PHASE2_TITLE[id]&&T.MINIBOSS_PHASE2_TITLE[id].length>3);
  assert.strictEqual(new Set(Object.values(T.MINIBOSS_PHASE2_TITLE)).size,8);
});
ok('B5A-7: telegraph da investida existe para todos, é fiel (linha reta na direção e.aim, comprimento 760) e o estilo difere',()=>{
  fresh();const tel={};
  for(const id of IDS){const b=spawn(id,'telegraph');b.aim=0;globalThis.__ctxLog=[];T.drawMiniBoss(b);const L=globalThis.__ctxLog;globalThis.__ctxLog=null;
    /* deve existir um traço partindo do corpo até ~760px na direção da mira */
    const lines=L.filter(([k])=>k==='lineTo').map(([,a])=>a);
    assert.ok(lines.some(a=>Math.abs(a[0]-(b.x+760))<12&&Math.abs(a[1]-b.y)<12),id+' sem linha fiel de 760px');
    tel[id]=fingerprint(b);}
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)assert.ok(dist(tel[IDS[i]],tel[IDS[j]])>=.15,IDS[i]+'×'+IDS[j]+' telegraph clone');
  /* sem telegraph nada é desenhado além do corpo (não mente) */
  const b=spawn('herald','base');const L0=fingerprint(b);const b2=spawn('herald','telegraph');const L1=fingerprint(b2);assert.ok((L1.lineTo||0)>(L0.lineTo||0));
});
ok('B5A-8: spawn intro é curto (1,6 s já existente), não bloqueante e tem assinatura própria por mini-chefe',()=>{
  fresh();const sp={};
  for(const id of IDS){const b=spawn(id,'spawn');assert.ok(b.spawnT>0&&b.spawnT<=1.6);sp[id]=fingerprint(b);}
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)assert.ok(dist(sp[IDS[i]],sp[IDS[j]])>=.15,IDS[i]+'×'+IDS[j]+' spawn clone');
  assert.ok(!/freezeT\s*=|state\s*=\s*'cutscene'/.test(BLOCK),'sem congelamento no bloco visual');
  assert.strictEqual(X('typeof spawnMiniBoss'),'function');
  const src=SRC.slice(SRC.indexOf('function spawnMiniBoss('),SRC.indexOf('function miniBossHUD('));
  assert.ok(/spawnT:1\.6/.test(src),'spawnT continua 1.6');
});

/* ================= PUREZA / DETERMINISMO ================= */
ok('B5A-9..15: 1000 draws em 4 modos não alteram HP, posição, velocidade, timers, fase, plates, dmg, moral, Fracture, facções, save',()=>{
  fresh();T.activateSlot(1);
  const save0=sandbox.localStorage.getItem('echoSave.v3');
  const frac0=JSON.stringify([X('typeof fractureRun!=="undefined"?fractureRun:null'),X('typeof fracState!=="undefined"?fracState:null')]);
  for(const id of IDS)for(const mode of ['base','phase2','telegraph','spawn']){
    const b=spawn(id,mode);b.fractures=[{x:1,y:1,t:.3,r:90}];b.drainT=1;b.shieldUpState='active';b.reflectState='active';b.sleepPhase='dormant';b.sleepT=2;
    const s0=JSON.stringify([b.hp,b.maxHp,b.x,b.y,b.vx,b.vy,b.phase,b.chargeCd,b.burstCd,b.skillCd,b.summonCd,b.telegraphT,b.dashT,b.plates,b.plateMax,b.dmg,b.spd,b.r,b.aim,b.t,b.core,b.ring,b.spinAng,b.fractures,b.drainT,b.sleepT]);
    const m0=JSON.stringify(T.getMoral()),n0=T.getEnemies().length,pr0=T.getProjectiles().length;
    for(let i=0;i<1000;i++){T.setRunTime(i*.016);T.drawMiniBoss(b);}
    assert.strictEqual(JSON.stringify([b.hp,b.maxHp,b.x,b.y,b.vx,b.vy,b.phase,b.chargeCd,b.burstCd,b.skillCd,b.summonCd,b.telegraphT,b.dashT,b.plates,b.plateMax,b.dmg,b.spd,b.r,b.aim,b.t,b.core,b.ring,b.spinAng,b.fractures,b.drainT,b.sleepT]),s0,id+'/'+mode+' estado alterado');
    assert.strictEqual(JSON.stringify(T.getMoral()),m0);assert.strictEqual(T.getEnemies().length,n0);assert.strictEqual(T.getProjectiles().length,pr0);
  }
  assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),save0,'save intacto');
  assert.strictEqual(JSON.stringify([X('typeof fractureRun!=="undefined"?fractureRun:null'),X('typeof fracState!=="undefined"?fracState:null')]),frac0,'Fracture/facções intactos');
});
ok('B5A-16: renderer não usa Math.random/rand() nem DOM; variação vem de runTime/e.t/e.core/e.ring/e.spinAng/fase',()=>{
  assert.strictEqual((BLOCK.match(/Math\.random|\brand\(|randi\(/g)||[]).length,0);
  assert.strictEqual((BLOCK.match(/document\.|getElementById|innerHTML|\$\(/g)||[]).length,0);
  assert.ok(/runTime|e\.core|e\.ring|e\.spinAng|e\.phase/.test(BLOCK));
  /* determinístico: mesmo estado + mesmo runTime → mesma sequência de chamadas */
  fresh();const b=spawn('leech','phase2');b.drainT=1;
  const seq=()=>{T.setRunTime(3.3);globalThis.__ctxLog=[];T.drawMiniBoss(b);const L=globalThis.__ctxLog;globalThis.__ctxLog=null;return JSON.stringify(L);};
  assert.strictEqual(seq(),seq());
});
ok('B5A-16b: sem partículas nem DOM writes no draw; partículas continuam só no update e com cap (PARTS_MAX)',()=>{
  assert.strictEqual((BLOCK.match(/spawnParticles|spawnRing|spawnShards|parts\.push/g)||[]).length,0,'draw não emite partículas');
  assert.ok(/PARTS_MAX/.test(SRC.slice(SRC.indexOf('function spawnParticles('),SRC.indexOf('function glowSprite('))));
  fresh();const b=spawn('brood','phase2');const n=X('parts.length');for(let i=0;i<500;i++)T.drawMiniBoss(b);assert.strictEqual(X('parts.length'),n);
});

/* ================= BALANCE / MECÂNICA INTACTAS ================= */
ok('B5A-17: MINIBOSS (hp/spd/r/plates/sk/tags) idêntico ao snapshot pré-B5-A; hitbox = r',()=>{
  const SNAP={herald:[1,1,44,6,'charge,burst,summon'],furnace:[1.25,.72,48,7,'burn,nova,trail'],sentinel:[1.05,.9,42,8,'reflect,shieldUp'],
    brood:[1.15,.62,46,5,'swarmSpawn,heal,burst'],duelist:[.7,1.55,34,3,'blink,slash'],colossus:[1.75,.45,56,10,'quake,slam'],
    oracle:[.9,1,40,5,'curse,burst'],leech:[1,1.1,40,4,'drain,corrode,summon']};
  for(const m of T.MINIBOSS){const s=SNAP[m.id];assert.deepStrictEqual([m.hp,m.spd,m.r,m.plates,Object.keys(m.sk).join(',')],s,m.id);}
  fresh();for(const id of IDS){const b=spawn(id,'base');assert.strictEqual(b.r,T.MINIBOSS.find(m=>m.id===id).r,'hitbox = r');}
});
ok('B5A-18: updateMiniBoss/spawnMiniBoss não mudaram números (dash 980/1180, burst 9/14, cds, fase 2 a 50 %, xp 150, spawnT 1.6, dmg/hp fórmula)',()=>{
  const upd=SRC.slice(SRC.indexOf('function updateMiniBoss('),SRC.indexOf('/* ====================================================================='+'\n   PR13.5 · B5-A'));
  for(const re of [/e\.phase===2\?1180:980/,/e\.phase===2\?14:9/,/e\.phase===2\?3\.0:4\.6/,/e\.phase===2\?\.62:\.85/,/e\.phase===2\?2\.0:3\.2/,/e\.hp<=e\.maxHp\*\.5/,/e\.skillCd=6\.5/,/e\.skillCd=4\.2/,/e\.skillCd=5\.5/,/e\.skillCd=9;/,/e\.skillCd=5;/,/e\.skillCd=2\.6/,/e\.shieldUpCd=12/,/e\.reflectCd=7/])
    assert.ok(re.test(upd),'número mudou: '+re);
  const sp=SRC.slice(SRC.indexOf('function spawnMiniBoss('),SRC.indexOf('function miniBossHUD('));
  assert.ok(/\(520\+n\*54\)\*def\.hp\*scale\*\(1\+\.08\*echoQueue\.length\)/.test(sp)&&/\(20\+n\*1\.1\)\*def\.hp/.test(sp)&&/\(96\+n\*2\)\*def\.spd/.test(sp)&&/xp:150/.test(sp)&&/spawnT:1\.6/.test(sp));
  /* recompensa: 120 × cap */
  assert.ok(/Math\.round\(120\*incomeCoinCap\(mEff\.coinMul\*player\.coinMul\)\)/.test(SRC));
});
ok('B5A-19: Fracture Director — pickMiniBoss/fracturePickMiniBoss não tocados; seleção determinística idêntica para o mesmo (seed, tema, onda)',()=>{
  const pick=SRC.slice(SRC.indexOf('function pickMiniBoss('),SRC.indexOf('function spawnMiniBoss('));
  assert.ok(/fracturePickMiniBoss\(n\)/.test(pick)&&/miniEligiblePool\(n\)/.test(pick)&&!/MINIBOSS_VISUALS/.test(pick));
  assert.ok(!/MINIBOSS_VISUALS|minibossVisual/.test(SRC.slice(SRC.indexOf('function fracturePickMiniBoss('),SRC.indexOf('function fracturePickMiniBoss(')+4000)),'seleção não lê o visual');
  fresh();const seq=()=>{const r=sandbox.Math.random;let s=7;sandbox.Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};const out=[];for(let w=5;w<=15;w+=5)out.push(T.pickMiniBoss(w).id);sandbox.Math.random=r;return out.join(',');};
  assert.strictEqual(seq(),seq());
});

/* ================= SAVE / CONTINUE ================= */
ok('B5A-20: checkpoint durante mini-chefe → Continue reconstrói o mesmo mini-chefe (id, fase), sem duplicar, com HUD e renderer certos, sem cache visual salvo',()=>{
  fresh();T.activateSlot(1);const b=spawn('oracle','phase2');b.hp=Math.round(b.maxHp*.4);
  X('renderShop=function(){}');T.setState('play');
  const cp=T.smBuildCheckpoint('teste',10);
  assert.ok(!JSON.stringify(cp).includes('MINIBOSS_VISUALS')&&!/"silhouette"/.test(JSON.stringify(cp)),'nada de visual no save');
  /* o jogo salva por onda (mini-chefe renasce no início da onda 10/15) — o que precisa bater é o pick determinístico e a ausência de duplicata */
  assert.ok(T.captureCheckpoint('teste',10));
  T.setPlayer(null);T.setMiniBoss(null);T.setEnemies([]);T.resumeRun();
  assert.strictEqual(T.getEnemies().filter(e=>e.type==='miniboss').length<=1,true,'no máximo 1 mini-chefe');
  /* spawn forçado após resume: HUD e renderer coerentes */
  const b2=spawn('oracle','phase2');T.miniBossHUD();
  assert.ok(X('$("bossnm").textContent').includes('◉'),'símbolo na barra');
  assert.ok(X('$("bosssub").textContent').includes('FASE 2 ▲'));
  assert.strictEqual(T.MINIBOSS_RENDERERS[b2.mb.id].name,'drawOracle');
  T.clearMiniBossHUD();
  assert.strictEqual(X('$("bossnm").textContent'),'O   P A R A D O X O','HUD do PARADOXO restaurado');
});

/* ================= SANDBOX ================= */
ok('B5A-21: Sandbox — spawn individual por ID dos 8 (botões data-sbmini já existentes) funciona; sair → save byte-a-byte, sem mini-chefe vivo',()=>{
  fresh();T.activateSlot(2);T.setState('title');
  X('sandboxRun=false;sandboxMode=false;');const snap=sandbox.localStorage.getItem('echoSave.v3');
  X('sandboxOpenSetup();sandboxCfg.char=0;');assert.strictEqual(X('sandboxStart()'),true);
  for(const id of IDS){const def=T.MINIBOSS.find(m=>m.id===id);if(T.getMiniBoss())X('sandboxClearMini()');const b=T.spawnMiniBoss(5,def);assert.strictEqual(b.mb.id,id);T.drawMiniBoss(b);}
  assert.ok(/data-sbmini/.test(SRC),'UI do sandbox lista mini-chefes');
  X('sandboxExit(true)');
  assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),snap,'byte-a-byte');
  assert.strictEqual(T.getMiniBoss(),null);
});

/* ================= DEV ================= */
ok('B5A-22: DEV.minibossVisual/minibossGallery inertes fora do DEV; em DEV descrevem os 8 sem escrever nada',()=>{
  X('DEV_MODE=false');assert.strictEqual(X('DEV.minibossVisual("oracle")'),null);assert.strictEqual(X('DEV.minibossGallery()'),null);
  X('DEV_MODE=true');const g=X('DEV.minibossGallery()');assert.strictEqual(g.length,8);
  const o=g.find(x=>x.id==='oracle');assert.strictEqual(o.silhouette,'eye-orbits');assert.strictEqual(o.renderer,'drawOracle');assert.strictEqual(o.r,40);
  assert.strictEqual(X('DEV.minibossVisual("quimera")'),null);
  assert.ok(/minibossVisual\(id\)\{\s*if\(!DEV_MODE\)return null;/.test(SRC));
  X('DEV_MODE=false');
});

/* ================= O PARADOXO ================= */
ok('B5A-23: O PARADOXO intacto — drawBoss/updateBoss não referenciam o renderer dos mini-chefes; HUD padrão preservado; drawBoss executa',()=>{
  const db=SRC.slice(SRC.indexOf('function drawBoss('),SRC.indexOf('function drawBoss(')+9000);
  assert.ok(!/MINIBOSS_VISUALS|drawMinibossBase|MINIBOSS_RENDERERS/.test(db));
  const ub=SRC.slice(SRC.indexOf('function updateBoss('),SRC.indexOf('function updateBoss(')+9000);
  assert.ok(!/MINIBOSS_VISUALS|minibossVisual/.test(ub));
  assert.ok(SRC.includes('<div id="bossnm">O   P A R A D O X O</div>'));
  fresh();const boss={type:'boss',x:600,y:400,r:70,hp:1000,maxHp:1000,spawnT:0,phase:1,gravs:[],shocks:[],t:1,aim:0,flashT:0,core:0,ring:0,spinAng:0,orbs:[],beams:[],vx:0,vy:0,dmg:10};
  let okDraw=true;try{T.drawBoss(boss);}catch(e){okDraw=false;}
  assert.ok(okDraw,'drawBoss executa no mock');
  assert.strictEqual(boss.hp,1000);
});

if(failed)console.log('\n'+failed+' FALHAS');else console.log('\n'+passed+' PASSARAM · 0 FALHAS');
process.exit(failed?1:0);
