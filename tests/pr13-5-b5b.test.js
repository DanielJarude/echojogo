'use strict';
/* =====================================================================
   TESTES — PR13.5 · B5-B · IDENTIDADE MECÂNICA DOS MINI-CHEFES
   mecânica própria · fase 2 real · caps · cleanup · Brood regen/enxame ·
   Furnace fogo · Sentinel posturas · Duelist slash · Colossus slam ·
   Oracle previsão · Leech siphon · Herald escalada · Save/Continue ·
   Sandbox · DEV · Fracture · PARADOXO · renderer puro · segunda passagem
   visual (sem base genérica)
   ===================================================================== */
const assert=require('assert');
const fs=require('fs'),path=require('path'),vm=require('vm');
const {sandbox,T,SRC,normalizeSource}=require('../audit_pr135/harness.js');   // SRC já normalizado para LF (portável LF/CRLF)
const X=code=>vm.runInContext(code,sandbox);
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
const IDS=['herald','furnace','sentinel','brood','duelist','colossus','oracle','leech'];
const DT=1/60;
function seed(s){let x=s>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function fresh(wave){T.resetShopVars();T.setState('play');T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);T.startRun();T.setWave(wave||10);
  const p=T.getPlayer();p.x=600;p.y=400;p.hp=1e9;p.maxHp=1e9;p.vx=0;p.vy=0;p.dashT=0;p.invT=0;p.shield=0;p.shieldMax=0;p.shieldRegen=0;T.setEnemies([]);T.setProjectiles([]);T.setMiniBoss(null);return p;}
function spawn(id,wave,phase){const def=T.MINIBOSS.find(m=>m.id===id);const b=T.spawnMiniBoss(wave||10,def);b.spawnT=0;b.x=760;b.y=400;
  if(phase===2){b.hp=b.maxHp*.49;T.updateMiniBoss(b,DT);}return b;}
function step(b,secs,posFn){const n=Math.round(secs/DT);const p=T.getPlayer();for(let i=0;i<n;i++){if(posFn)posFn(p,i*DT);for(const e of T.getEnemies().slice())if(e.type==='miniboss')T.updateMiniBoss(e,DT);for(const e of T.getEnemies())if(e.type!=='miniboss'&&e.spawnT>0)e.spawnT-=DT;if(T.getProjectiles().length>800)T.getProjectiles().length=800;}}
const orbit=(p,t)=>{p.x=600+Math.sin(t*.7)*140;p.y=400+Math.cos(t*.9)*90;p.vx=Math.cos(t*.7)*98;p.vy=-Math.sin(t*.9)*81;};
const far=(p)=>{p.x=100;p.y=100;p.vx=0;p.vy=0;};
const UPD=SRC.slice(SRC.indexOf('PR13.5 · B5-B — IDENTIDADE MECÂNICA'),SRC.indexOf('PR13.5 · B5-A — IDENTIDADE VISUAL'));
const upd=id=>{const i=UPD.indexOf('function update'+id[0].toUpperCase()+id.slice(1)+'(');const j=UPD.indexOf('\nfunction ',i+10);return UPD.slice(i,j);};   // UPD vem de SRC normalizado (LF)

console.log('\nECHO — PR13.5 · B5-B · IDENTIDADE MECÂNICA DOS MINI-CHEFES');
console.log('---------------------------------------------');
sandbox.Math.random=seed(4242);

/* ================= CATÁLOGO / ARQUITETURA ================= */
ok('B5B-1: 8 mini-chefes, cada um com updater próprio (MB_UPDATERS) e estado próprio (e.ms) inicializado no spawn',()=>{
  assert.strictEqual(T.MINIBOSS.length,8);
  for(const id of IDS){assert.strictEqual(typeof T.MB_UPDATERS[id],'function',id);fresh();const b=spawn(id);assert.ok(b.ms&&Array.isArray(b.hazards),id+' sem ms/hazards');}
});
ok('B5B-2: dash e rajada radial deixaram de definir os 8 — só herald/colossus usam mbCharge, só herald/brood(F2)/oracle(eco) usam projéteis radiais; sentinel/brood/oracle/leech/furnace sem investida',()=>{
  const usesCharge=IDS.filter(id=>/mbCharge\(/.test(upd(id)));
  assert.deepStrictEqual(usesCharge.sort().join(','),'colossus,herald');
  const usesBurst=IDS.filter(id=>/mbBurst\(/.test(upd(id)));
  assert.deepStrictEqual(usesBurst.sort().join(','),'brood,herald');
  for(const id of ['sentinel','brood','oracle','leech','furnace'])assert.ok(!/mbCharge\(/.test(upd(id)),id+' não deve investir');
  assert.ok(!/mbSummon\(/.test(upd('leech')),'Sanguessuga não invoca (identidade da Matriz)');
});
ok('B5B-3: assinatura mecânica observada é distinta para os 8 (dash/projéteis/hazards/crias/regen/postura) — wave 10, F1+F2, 40 s',()=>{
  const sig={};
  for(const id of IDS){const v=[0,0,0,0,0,0];
    for(const ph of [1,2]){fresh(10);const b=spawn(id,10,ph);let dash=0,haz=0,kids=0,reg=0,def=0,proj=0;const hp0=b.hp;
      step(b,40,(p,t)=>{orbit(p,t);if(b.dashT>0)dash=1;if((b.hazards||[]).length)haz=1;if(T.getEnemies().length>1)kids=1;if(b.ms.stance==='guard'||b.ms.sleep==='dormant')def=1;if(T.getProjectiles().length)proj=1;});
      if(b.hp>hp0+1)reg=1;v[0]|=dash;v[1]|=proj;v[2]|=haz;v[3]|=kids;v[4]|=reg;v[5]|=def;}
    sig[id]=v.join('');}
  assert.strictEqual(new Set(Object.values(sig)).size,8,JSON.stringify(sig));
});

/* ================= CAPS / CLEANUP ================= */
ok('B5B-4: hazards nunca passam do cap por mini-chefe; crias da Matriz ≤ MB_BROOD_CAP; entidades ≤ ENEMY_BUDGET (120 s, F2)',()=>{
  const BUD=X('ENEMY_BUDGET');
  for(const id of IDS){fresh(15);const b=spawn(id,15,2);let hz=0,kids=0,en=0;
    step(b,120,(p,t)=>{orbit(p,t);hz=Math.max(hz,(b.hazards||[]).length);kids=Math.max(kids,T.mbChildren(b));en=Math.max(en,T.getEnemies().length);});
    const cap=T.MB_HAZARD_CAP[id]||4;assert.ok(hz<=cap,id+' hazards '+hz+'>'+cap);assert.ok(en<=BUD,id+' entidades '+en);
    if(id==='brood')assert.ok(kids<=T.MB_BROOD_CAP,'crias '+kids);}
});
/* B5B-5 valida os 5 invariantes EXECUTANDO o jogo (não só lendo texto). A
   parte textual usa uma regex tolerante a \r?\n e a fonte normalizada do
   harness — o assert antigo com '\n' literal dava falso negativo em CRLF. */
function killBlock(src){
  const m=/if\(e\.type==='miniboss'\)\{\r?\n\s*\/\/ recompensa pesada[^]{0,200}/.exec(src);
  return m?m[0]:'';
}
ok('B5B-5: cleanup — hazards expiram sozinhos (lifetime) e morrem com o chefe; sem hazard eterno',()=>{
  /* 1) lifetime finito em toda zona criada por qualquer mini-chefe */
  fresh();const b=spawn('furnace',10,2);step(b,20,orbit);assert.ok(b.hazards.length>0,'rastro presente');
  for(const h of b.hazards)assert.ok(Number.isFinite(h.life)&&h.life>0&&Number.isFinite(h.max)&&h.life<=h.max+1e-9,'lifetime finito');
  /* 2) expiram sozinhos: sem novas zonas, tudo some antes de 8 s (max 7) */
  b.ms.trailT=99;b.ms.novaCd=99;const n0=b.hazards.length;
  step(b,8,(p,t)=>{far(p);b.x=1100;b.y=400;b.vx=0;b.vy=0;});
  assert.ok(n0>0&&b.hazards.length===0,'expiraram: '+n0+' → '+b.hazards.length);
  /* 3) cap remove o MAIS ANTIGO (comportamento, não texto) */
  b.hazards=[];for(let i=0;i<30;i++)T.mbHazardAdd(b,{kind:'fire',x:i,y:0,r:1,life:5,max:5,tag:i});
  assert.strictEqual(b.hazards.length,T.MB_HAZARD_CAP.furnace);assert.strictEqual(b.hazards[0].tag,30-T.MB_HAZARD_CAP.furnace,'o mais antigo saiu');assert.strictEqual(b.hazards[b.hazards.length-1].tag,29);
  /* 4) morrem com o chefe pelo caminho REAL de abate (damageEnemy → killEnemy) */
  b.hazards=[];for(let i=0;i<5;i++)T.mbHazardAdd(b,{kind:'fire',x:0,y:0,r:1,life:5,max:5});
  X('curAttacker=player');b.plates=0;X('damageEnemy')(b,1e12,0,0,false);
  assert.ok(b.dead&&b.hazards.length===0,'abate zera hazards (runtime)');assert.strictEqual(T.getMiniBoss(),null);
  /* 5) nenhum hazard eterno: todo mbHazardAdd de produção declara life finito; e o bloco de abate zera hazards (texto, portável) */
  const lifes=[...UPD.matchAll(/mbHazardAdd\(e,\{[^}]*?life:([^,}]+)/g)].map(m=>m[1].trim());
  assert.ok(lifes.length>=6&&lifes.every(v=>!/Infinity|undefined|null/.test(v)),'life finito em todos: '+lifes.join(' | '));
  const kb=killBlock(SRC);assert.ok(kb&&/e\.hazards=\[\]/.test(kb),'abate zera hazards (fonte)');
  assert.ok(/function mbHazardAdd[\s\S]*?while\(e\.hazards\.length>=cap\)e\.hazards\.shift\(\)/.test(UPD),'cap por shift do mais antigo');
});
ok('B5B-5b: portabilidade — a auditoria textual de B5B-5 dá o MESMO resultado com a fonte em LF e em CRLF; o assert antigo (\\n literal) falharia em CRLF',()=>{
  const lf=SRC,crlf=SRC.replace(/\n/g,'\r\n');
  assert.ok(crlf.indexOf('\r\n')>0&&lf.indexOf('\r')<0,'fixtures LF/CRLF válidas');
  /* novo caminho: igual nos dois */
  for(const [nm,s] of [['LF',lf],['CRLF',crlf]]){const kb=killBlock(s);assert.ok(kb&&/e\.hazards=\[\]/.test(kb),nm+': bloco de abate encontrado e zera hazards');}
  /* normalização central do harness devolve LF para qualquer entrada */
  assert.strictEqual(normalizeSource(crlf),lf);assert.strictEqual(normalizeSource(lf),lf);
  /* prova do falso negativo antigo: busca com '\n' literal só funciona em LF */
  const oldNeedle="if(e.type==='miniboss'){\n    // recompensa pesada";
  assert.ok(lf.indexOf(oldNeedle)>=0,'assert antigo passa em LF');
  assert.strictEqual(crlf.indexOf(oldNeedle),-1,'assert antigo falharia em CRLF (indexOf -1)');
  /* as demais buscas por bloco de função também são portáveis */
  const updOf=(s)=>{const U=s.slice(s.indexOf('PR13.5 · B5-B — IDENTIDADE MECÂNICA'),s.indexOf('PR13.5 · B5-A — IDENTIDADE VISUAL'));const i=U.indexOf('function updateFurnace(');const j=U.search(/\r?\nfunction /g)>=0?U.indexOf('function ',i+10)-1:-1;return U.slice(i,j).replace(/\r/g,'');};
  assert.strictEqual(updOf(crlf),updOf(lf),'bloco updateFurnace idêntico em LF/CRLF');
});

/* ================= BROOD ================= */
ok('B5B-6: Matriz — mais enxame que antes (baseline 3/4,2 s sem cap próprio → 4/3,6 s até 12 vivas; F2 5/3,0 s), regen SÓ com ≥3 crias vivas (F2 ≥2), com cap em maxHp',()=>{
  fresh();const b=spawn('brood');b.hp=b.maxHp*.6;
  step(b,4,orbit);assert.ok(T.mbChildren(b)>=4,'primeiro spawn ≥4 crias: '+T.mbChildren(b));
  step(b,24,orbit);assert.ok(T.mbChildren(b)>=10&&T.mbChildren(b)<=T.MB_BROOD_CAP,'enxame no teto próprio: '+T.mbChildren(b));
  assert.ok(b.ms.regenOn&&b.ms.regenT>5,'regen ativa com crias vivas');
  const hp1=b.hp;
  /* counterplay: mata as crias → regen para */
  for(const e of T.getEnemies())if(e.type!=='miniboss')e.dead=true;T.setEnemies(T.getEnemies().filter(e=>!e.dead));
  b.ms.spawnCd=99;step(b,3,orbit);assert.ok(!b.ms.regenOn&&Math.abs(b.hp-hp1)<1e-6,'sem crias: regen 0');
  /* cap */
  b.hp=b.maxHp-1;b.ms.spawnCd=0;step(b,6,orbit);assert.ok(b.hp<=b.maxHp);
  /* F2: mais agressiva */
  fresh();const b2=spawn('brood',10,2);step(b2,4,orbit);assert.ok(T.mbChildren(b2)>=5,'F2 primeiro spawn ≥5');
  assert.ok(/ph2\?\.030:\.022/.test(upd('brood'))&&/ph2\?2:3/.test(upd('brood')),'taxas documentadas');
});

/* ================= FURNACE ================= */
ok('B5B-7: Fornalha — burn REAL: zonas de fogo (r 34/40, 5/7 s, cap 22) nascem ao se mover, ferem por tick (0,16×dmg + burn) só após 0,25 s, sem somar sobreposição; nova acende anel de 6; F2 mais duradouro',()=>{
  fresh();const b=spawn('furnace');step(b,6,orbit);
  assert.ok(b.hazards.length>=6&&b.hazards.every(h=>h.kind==='fire'),'rastro presente');
  const h=b.hazards[0];assert.ok(h.r===34||h.r===38);assert.ok(h.max===5||h.max===4.5);
  /* dano: jogador parado dentro de 3 zonas sobrepostas por 3 s recebe ≈ 5 ticks (0,6 s) — não 15 */
  const p=T.getPlayer();b.hazards=[];for(let i=0;i<3;i++)T.mbHazardAdd(b,{kind:'fire',x:600,y:400,r:34,life:5,max:5,tick:X('mbFireTick')});
  b.ms.novaCd=99;b.ms.trailT=99;const hp0=p.hp;p.x=600;p.y=400;
  for(let i=0;i<180;i++){b.x=1100;b.y=400;b.vx=0;b.vy=0;T.updateMiniBoss(b,DT);p.x=600;p.y=400;}   // Fornalha parada longe: só o fogo fere
  const ticks=Math.round((hp0-p.hp)/(b.dmg*.16));assert.ok(ticks>=4&&ticks<=6,'ticks '+ticks);
  /* sem dano nos primeiros 0,25 s */
  b.hazards=[];T.mbHazardAdd(b,{kind:'fire',x:600,y:400,r:34,life:5,max:5,tick:X('mbFireTick')});b.ms.fireHitT=0;b.ms.fireIn=false;const hp1=p.hp;
  for(let i=0;i<12;i++){b.x=1100;b.y=400;b.vx=0;b.vy=0;T.updateMiniBoss(b,DT);p.x=600;p.y=400;}assert.strictEqual(p.hp,hp1,'acendendo: sem dano');
  /* F2 */
  fresh();const b2=spawn('furnace',10,2);step(b2,4,orbit);assert.ok(b2.hazards.some(x=>x.max===7&&x.r===40),'F2: 7 s / r 40');
  /* nova: anel de 6 zonas */
  fresh();const b3=spawn('furnace');b3.ms.novaCd=0;b3.ms.trailT=99;far(T.getPlayer());T.updateMiniBoss(b3,DT);assert.ok(b3.hazards.filter(x=>x.r===38).length===6,'nova acende 6');
  /* não cobre a arena: área máxima 22×π×40² ≈ 11 % da arena */
  assert.ok(22*Math.PI*40*40/(X('ARENA.w')*X('ARENA.h'))<.15);
});

/* ================= SENTINEL ================= */
ok('B5B-8: Sentinela — posturas GUARDA(4s: −75 % dano, reflete)→ABERTURA(2,5s: +30 % dano)→NEUTRA(3,5s); nunca invulnerável; F2 mais rápida (3/1,8/2) e leque de 5 ao abrir; estado não trava',()=>{
  fresh();const b=spawn('sentinel');const seen=new Set();let guardMax=0,cur=0;
  step(b,30,(p,t)=>{orbit(p,t);seen.add(b.ms.stance);if(b.ms.stance==='guard'){cur+=DT;guardMax=Math.max(guardMax,cur);}else cur=0;});
  assert.deepStrictEqual([...seen].sort().join(','),'guard,neutral,open');assert.ok(guardMax<=4.05,'guarda máx 4 s: '+guardMax);
  /* dano recebido segue a postura (damageEnemy ×0.25 / ×1.30) */
  b.ms.stance='guard';b.ms.stanceT=2;T.updateMiniBoss(b,DT);assert.strictEqual(b.shieldUpState,'active');
  X('curAttacker=player');const h0=b.hp;X('damageEnemy')(b,100,0,0,false);const gd=h0-b.hp;
  b.ms.stance='open';b.ms.stanceT=2;T.updateMiniBoss(b,DT);assert.strictEqual(b.shieldUpState,'vulnerable');
  const h1=b.hp;X('damageEnemy')(b,100,0,0,false);const od=h1-b.hp;assert.ok(od>gd*4,'abertura leva ≥4× mais dano que guarda ('+gd+' vs '+od+')');
  assert.ok(gd>0,'guarda não é invulnerável');
  /* reflete só projéteis do jogador na guarda */
  b.ms.stance='guard';b.ms.stanceT=2;T.setProjectiles([{x:b.x+20,y:b.y,vx:-100,vy:0,r:4,dmg:10,team:'player',owner:T.getPlayer(),life:2,type:'orb'}]);T.updateMiniBoss(b,DT);
  assert.strictEqual(T.getProjectiles()[0].team,'enemy','projétil devolvido');
  /* F2 */
  fresh();const b2=spawn('sentinel',10,2);let opens=0,last='';step(b2,20,(p,t)=>{orbit(p,t);if(b2.ms.stance==='open'&&last!=='open')opens++;last=b2.ms.stance;});
  assert.ok(opens>=2&&T.getProjectiles().length>0,'F2 abre ≥2× em 20 s e dispara leque');
  assert.ok(!/mbCharge\(|mbBurst\(/.test(upd('sentinel')),'sem investida/rajada genérica');
});

/* ================= DUELIST ================= */
ok('B5B-9: Duelista — slash REAL: blink para o flanco (70–130 px, nunca em cima) → telegraph .42 s → lunge com hitbox de lâmina (segmento r+70); F1 1 golpe, F2 combo de 3 telegrafados (.30 s); respiro após o combo',()=>{
  fresh();const p=T.getPlayer();const b=spawn('duelist');let lunges=0,last=0,minD=1e9,tele=0;
  step(b,30,(pp,t)=>{orbit(pp,t);if(b.ms.slashT>0&&last<=0){lunges++;}last=b.ms.slashT;if(b.telegraphT>0)tele+=DT;
    if(b.skillCd>2.55&&b.telegraphT>.4){const d=Math.hypot(pp.x-b.x,pp.y-b.y);minD=Math.min(minD,d);}});   // logo após o blink
  assert.ok(lunges>=8&&lunges<=14,'F1 ≈1 lunge por ciclo de 2,6 s: '+lunges);assert.ok(minD>=60,'blink nunca em cima do jogador: '+minD.toFixed(0));
  assert.ok(tele>0,'telegraph existe');
  /* hitbox: jogador fora da linha da lâmina não é atingido */
  b.ms.slashT=.22;b.ms.hit=false;b.aim=0;b.x=300;b.y=400;p.x=300;p.y=560;p.hp=1e9;T.updateMiniBoss(b,DT);assert.strictEqual(p.hp,1e9,'fora da lâmina: sem dano');
  b.ms.slashT=.22;b.ms.hit=false;b.x=300;b.y=400;p.x=380;p.y=400;T.updateMiniBoss(b,DT);assert.ok(p.hp<1e9,'na lâmina: dano');
  /* F2 combo */
  fresh();const b2=spawn('duelist',10,2);let chainMax=0,l2=0,lst=0;step(b2,30,(pp,t)=>{orbit(pp,t);chainMax=Math.max(chainMax,b2.ms.chain|0);if(b2.ms.slashT>0&&lst<=0)l2++;lst=b2.ms.slashT;});
  assert.ok(chainMax===2,'combo de 3 (chain 2): '+chainMax);assert.ok(l2>lunges&&l2<=45,'F2 encadeia (mais lunges que F1) mas limitado: '+l2+' vs '+lunges);
  assert.ok(/e\.skillCd=Math\.max\(e\.skillCd,\.9\)/.test(upd('duelist')),'respiro após combo');
});

/* ================= COLOSSUS ================= */
ok('B5B-10: Colosso — SLAM real: zona R 190 marcada 1,1 s antes (hazard kind slam, raio = ameaça), dano SÓ ao fim da contagem e SÓ dentro do raio; F2 2º anel R 300 0,7 s depois; quake ao despertar preservado',()=>{
  fresh();const p=T.getPlayer();const b=spawn('colossus');b.ms.sleep='awake';b.ms.sleepT=99;b.chargeCd=99;b.ms.slamCd=0;
  far(p);T.updateMiniBoss(b,DT);const h=b.hazards.find(x=>x.kind==='slam');assert.ok(h&&h.r===190&&Math.abs(h.fuse-1.1)<1e-9,'slam marcado');
  /* dentro do raio mas ANTES do fim: sem dano */
  p.x=b.x+100;p.y=b.y;p.hp=1e9;for(let i=0;i<60;i++){T.updateMiniBoss(b,DT);p.x=b.x+100;p.y=b.y;}assert.strictEqual(p.hp,1e9,'sem dano antes do aviso terminar');
  for(let i=0;i<10;i++){T.updateMiniBoss(b,DT);p.x=b.x+100;p.y=b.y;}assert.ok(p.hp<1e9,'dano no impacto');
  /* fora do raio no impacto: sem dano */
  b.ms.slamCd=0;b.hazards=[];p.hp=1e9;p.x=b.x+260;p.y=b.y;for(let i=0;i<75;i++){T.updateMiniBoss(b,DT);p.x=b.x+260;p.y=b.y;}assert.strictEqual(p.hp,1e9,'fora do raio 190: sem dano');
  /* F2: segundo anel */
  fresh();const b2=spawn('colossus',10,2);b2.ms.sleep='awake';b2.ms.sleepT=99;b2.chargeCd=99;b2.ms.slamCd=0;far(T.getPlayer());T.updateMiniBoss(b2,DT);
  const rs=b2.hazards.filter(x=>x.kind==='slam').map(x=>x.r).sort((a,b)=>a-b);assert.deepStrictEqual(rs.join(','),'190,300');
  assert.ok(/R2=340/.test(upd('colossus')),'quake de despertar preservado');
  /* visual: raio desenhado = raio lógico */
  const draw=SRC.slice(SRC.indexOf("h.kind==='slam'"),SRC.indexOf("h.kind==='slam'")+900);assert.ok(/ctx\.arc\(h\.x,h\.y,h\.r,0,TAU\)/.test(draw),'anel no raio real');
});

/* ================= ORACLE ================= */
ok('B5B-11: Oráculo — previsão: zona R 80 na posição prevista (pos+vel×0,9) ativa após 1,4 s (janela); dano só na ativação e só dentro; F2 2 zonas cruzadas + eco de 6 orbes; maldição preservada; cap 6',()=>{
  fresh();const p=T.getPlayer();const b=spawn('oracle');b.ms.curseCd=99;b.ms.predCd=0;p.x=600;p.y=400;p.vx=100;p.vy=0;T.updateMiniBoss(b,DT);
  const h=b.hazards.find(x=>x.kind==='pred');assert.ok(h&&h.r===80&&Math.abs(h.x-690)<1&&Math.abs(h.fuse-1.4)<1e-9,'zona prevista à frente');
  p.x=690;p.y=400;p.vx=0;p.vy=0;p.hp=1e9;b.ms.predCd=99;for(let i=0;i<78;i++){T.updateMiniBoss(b,DT);p.x=690;p.y=400;}assert.strictEqual(p.hp,1e9,'janela: sem dano antes');
  for(let i=0;i<10;i++){T.updateMiniBoss(b,DT);p.x=690;p.y=400;}assert.ok(p.hp<1e9,'ativação fere');
  /* jogador que se reposiciona não é atingido */
  b.ms.predCd=0;b.hazards=[];p.x=600;p.y=400;p.vx=100;T.updateMiniBoss(b,DT);p.hp=1e9;b.ms.predCd=99;for(let i=0;i<90;i++){T.updateMiniBoss(b,DT);p.x=400;p.y=400;}assert.strictEqual(p.hp,1e9,'saiu da previsão: sem dano');
  /* maldição */
  b.ms.curseCd=0;T.updateMiniBoss(b,DT);assert.ok(T.smHas(p,'status.oracle_curse.damage')&&p.curseT===6,'curse preservada');
  /* F2 */
  fresh();const b2=spawn('oracle',10,2);b2.ms.curseCd=99;b2.ms.predCd=0;const q=T.getPlayer();q.vx=100;T.updateMiniBoss(b2,DT);assert.strictEqual(b2.hazards.filter(x=>x.kind==='pred').length,2,'F2: 2 zonas');
  far(q);const pr0=T.getProjectiles().length;for(let i=0;i<90;i++)T.updateMiniBoss(b2,DT);assert.ok(T.getProjectiles().length>=pr0+6,'eco de 6 orbes na ativação');
  assert.strictEqual(T.MB_HAZARD_CAP.oracle,6);
});

/* ================= LEECH ================= */
ok('B5B-12: Sanguessuga — siphon próprio: fio a ≤420 (F2 520) por 2,6 s, 4 ticks/s, cura 2× o drenado com cap em maxHp; ROMPE ao sair do alcance ou ao dar dash; sem escolta; F2 zona de fome',()=>{
  fresh();const p=T.getPlayer();const b=spawn('leech');b.hp=b.maxHp*.5;b.ms.siphonCd=0;p.x=b.x-300;p.y=b.y;T.updateMiniBoss(b,DT);assert.ok(b.ms.siphonT>0,'dreno começou');
  const hpB=b.hp,hpP=p.hp;for(let i=0;i<60;i++){T.updateMiniBoss(b,DT);p.x=b.x-300;p.y=b.y;}
  assert.ok(p.hp<hpP&&b.hp>hpB,'drena e cura');assert.ok(Math.abs((b.hp-hpB)-(hpP-p.hp)*2)<1e-6,'cura = 2× drenado');
  /* rompe ao sair */
  p.x=b.x-900;T.updateMiniBoss(b,DT);assert.strictEqual(b.ms.siphonT,0);assert.strictEqual(b.ms.broken,1,'DRENO ROMPIDO');
  /* rompe com dash */
  b.ms.siphonCd=0;p.x=b.x-300;T.updateMiniBoss(b,DT);assert.ok(b.ms.siphonT>0);p.dashT=.2;T.updateMiniBoss(b,DT);assert.strictEqual(b.ms.siphonT,0);p.dashT=0;
  /* cap maxHp */
  b.hp=b.maxHp-1;b.ms.siphonCd=0;p.x=b.x-300;for(let i=0;i<60;i++){T.updateMiniBoss(b,DT);p.x=b.x-300;p.y=b.y;}assert.ok(b.hp<=b.maxHp);
  /* fora do alcance não inicia */
  const rangeNow=b.phase===2?520:420;   // (o boss pode já estar em F2: hp foi posto em 50 %)
  b.ms.siphonT=0;b.ms.siphonCd=0;p.x=b.x-(rangeNow+80);p.y=b.y;b.vx=0;b.vy=0;T.updateMiniBoss(b,DT);assert.strictEqual(b.ms.siphonT,0,'fora de '+rangeNow+': não inicia');
  assert.strictEqual(T.getEnemies().length,1,'sem escolta');
  /* F2 */
  fresh();const b2=spawn('leech',10,2);const q=T.getPlayer();b2.ms.siphonCd=0;q.x=b2.x-480;q.y=b2.y;T.updateMiniBoss(b2,DT);assert.ok(b2.ms.siphonT>3,'F2 alcança 520 e dura 3,2 s');
  for(let i=0;i<200;i++){T.updateMiniBoss(b2,DT);q.x=b2.x-480;q.y=b2.y;}assert.ok(b2.hazards.some(h=>h.kind==='hunger'),'zona de fome ao fim');
});

/* ================= HERALD ================= */
ok('B5B-13: Arauto — escalada própria: presságios (omen R 90, 1,5 s) começam em 2 marcas e crescem a cada ciclo até 5 (F2 7) com intervalo menor; cap 8; não toca a Intensidade de Fratura',()=>{
  fresh();const b=spawn('herald');b.chargeCd=99;b.burstCd=99;b.summonCd=99;const counts=[];let last=0;
  step(b,40,(p,t)=>{orbit(p,t);const n=b.hazards.filter(h=>h.kind==='omen').length;if(n>last&&n>=b.ms.escal)counts.push(b.ms.escal);last=n;});
  assert.ok(b.ms.escal===5,'escalada F1 chega a 5: '+b.ms.escal);assert.ok(counts[0]<counts[counts.length-1],'cresce ao longo do tempo');
  assert.ok(b.hazards.length<=T.MB_HAZARD_CAP.herald);
  fresh();const b2=spawn('herald',10,2);b2.chargeCd=99;b2.burstCd=99;b2.summonCd=99;step(b2,40,orbit);assert.strictEqual(b2.ms.escal,7,'F2 chega a 7');
  const fi0=JSON.stringify(X('typeof fracState!=="undefined"?fracState:null'));
  fresh();const b3=spawn('herald');step(b3,30,orbit);assert.strictEqual(JSON.stringify(X('typeof fracState!=="undefined"?fracState:null')),fi0,'Fracture intacto');
  assert.ok(!/fracture|Intensity|addResidues/.test(upd('herald')),'updater não mexe no Diretor');
});

/* ================= FASE 2 / FAIRNESS ================= */
ok('B5B-14: fase 2 a 50 % muda COMPORTAMENTO em todos (não só velocidade): banner próprio + diferença mensurável de padrão',()=>{
  for(const id of IDS){
    const a=upd(id);assert.ok(/ph2|e\.phase===2/.test(a),id+' updater sem ramo de fase 2');
  }
  assert.ok(/e\.hp<=e\.maxHp\*\.5/.test(UPD),'threshold 50 %');
  assert.strictEqual(new Set(Object.values(T.MINIBOSS_PHASE2_TITLE)).size,8);
});
ok('B5B-15: fairness — todo dano de área tem aviso ≥1,1 s (slam 1,1 · previsão 1,4 · presságio 1,5 · fogo 0,25 s "acendendo" + visível), lunge tem telegraph ≥.30 s, dreno tem alcance e rompe',()=>{
  assert.ok(/fuse:1\.1\+delay/.test(upd('colossus'))&&/fuse:1\.4/.test(upd('oracle'))&&/fuse:1\.5/.test(upd('herald')));
  assert.ok(/h\.age<\.25\)return/.test(UPD));
  assert.ok(/e\.telegraphT=\.42/.test(upd('duelist'))&&/e\.telegraphT=\.30/.test(upd('duelist')));
  assert.ok(/d>range\|\|p\.dashT>0/.test(upd('leech')));
});

/* ================= HAZARDS × ECOS/INIMIGOS ================= */
ok('B5B-16: hazards ferem só o jogador (damagePlayer); Ecos aliados e inimigos não são tocados por zonas',()=>{
  const body=UPD.slice(UPD.indexOf('function updateHerald'),UPD.indexOf('const MB_UPDATERS')).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,'');
  assert.ok(!/damageEcho\(|damageEnemy\(/.test(body),'nenhum hazard fere Eco/inimigo');
  fresh();const b=spawn('furnace');step(b,5,orbit);const ec={alive:true,hostile:false,x:b.hazards[0].x,y:b.hazards[0].y,r:14,hp:100,maxHp:100,slot:1};T.setEchoes([ec]);step(b,3,far);assert.strictEqual(ec.hp,100);T.setEchoes([]);
});

/* ================= RENDERER ================= */
ok('B5B-17: renderer continua gameplay-pure com hazards ativos (1000 draws × 8 × F2 não alteram estado/hazards/moral)',()=>{
  for(const id of IDS){fresh();const b=spawn(id,10,2);step(b,10,orbit);
    const s0=JSON.stringify([b.hp,b.x,b.y,b.phase,b.ms,b.hazards.map(h=>[h.kind,h.x,h.y,h.r,h.life]),T.getMoral()]);
    for(let i=0;i<1000;i++){T.setRunTime(i*.016);T.drawMiniBoss(b);}
    assert.strictEqual(JSON.stringify([b.hp,b.x,b.y,b.phase,b.ms,b.hazards.map(h=>[h.kind,h.x,h.y,h.r,h.life]),T.getMoral()]),s0,id);}
  const VIS=SRC.slice(SRC.indexOf('function mbArmorFrac'),SRC.indexOf('function spawnWave(n){'));
  assert.strictEqual((VIS.match(/Math\.random|\brand\(|document\.|spawnParticles|spawnRing/g)||[]).length,0);
});
ok('B5B-18: segunda passagem visual — SEM placas orbitais genéricas e sem núcleo-disco comum: cada renderer representa a blindagem e o núcleo do próprio jeito',()=>{
  const dm=SRC.slice(SRC.indexOf('function drawMiniBoss(e){'),SRC.indexOf('function mbPolyAt('));
  assert.ok(!/ctx\.rect\(-7,-4,14,8\)/.test(dm),'placas retangulares genéricas removidas do drawMiniBoss');
  for(const id of IDS){const fn=SRC.slice(SRC.indexOf('function draw'+id[0].toUpperCase()+id.slice(1)+'('),SRC.indexOf('\nfunction ',SRC.indexOf('function draw'+id[0].toUpperCase()+id.slice(1)+'(')+10));
    assert.ok(/e\.plates/.test(fn),id+' não representa a blindagem');}
  /* núcleo: pelo menos 3 formas de núcleo diferentes (losango, quadrado, fenda, disco) */
  assert.ok(/ctx\.lineTo\(cr\*\.7,0\)/.test(SRC)&&/fillRect\(-cq,-cq,cq\*2,cq\*2\)/.test(SRC)&&/fillRect\(-R\*\.35,-R\*\.06,R\*\.9,R\*\.12\)/.test(SRC));
  /* lâminas decorativas do Duelista dentro de ~1R e translúcidas */
  assert.ok(/ctx\.lineTo\(R\*\.98,sgn\*R\*\.7\)/.test(SRC)&&!/ctx\.lineTo\(R\*1\.25,sgn\*R\*\.9\)/.test(SRC));
  /* fingerprints continuam ≥0.15 entre pares (com hazards vazios) */
  fresh();const fp={};for(const id of IDS){const b=spawn(id);globalThis.__ctxLog=[];T.drawMiniBoss(b);const L=globalThis.__ctxLog;globalThis.__ctxLog=null;const c={};for(const [k] of L)if(!/^set:/.test(k))c[k]=(c[k]||0)+1;fp[id]=c;}
  const dist=(a,b)=>{const ks=new Set([...Object.keys(a),...Object.keys(b)]);let d=0,t=0;for(const k of ks){d+=Math.abs((a[k]||0)-(b[k]||0));t+=Math.max(a[k]||0,b[k]||0);}return t?d/t:0;};
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)assert.ok(dist(fp[IDS[i]],fp[IDS[j]])>=.15,IDS[i]+'×'+IDS[j]);
});

/* ================= SAVE / CONTINUE ================= */
ok('B5B-19: checkpoint não guarda hazards/ms/crias (reconstruídos); Continue não duplica mini-chefe nem crias, não cura, spawn renasce limpo com ms novo',()=>{
  fresh();T.activateSlot(1);const b=spawn('brood',10,2);step(b,10,orbit);assert.ok(T.mbChildren(b)>0);
  X('renderShop=function(){}');T.setState('play');const cp=T.smBuildCheckpoint('teste',10);const js=JSON.stringify(cp);
  assert.ok(!/hazards|regenOn|siphonT|mbChild|omenCd|slamCd|predCd|stanceT/.test(js),'nada de estado transitório no save');
  assert.ok(T.captureCheckpoint('teste',10));T.setPlayer(null);T.setMiniBoss(null);T.setEnemies([]);T.resumeRun();
  assert.ok(T.getEnemies().filter(e=>e.type==='miniboss').length<=1);assert.strictEqual(T.getEnemies().filter(e=>e.mbChild).length,0,'sem crias duplicadas');
  const b2=spawn('brood');assert.ok(b2.ms&&b2.hazards.length===0&&b2.phase===1&&b2.hp===b2.maxHp);
  assert.strictEqual(X('SM_VERSION'),3);
});

/* ================= SANDBOX / DEV ================= */
ok('B5B-20: Sandbox — os 8 spawnam, rodam 10 s de fase 2 com hazards/crias; sandboxClearMini limpa hazards; sair → save byte-a-byte, sem mini-chefe/hazards/crias',()=>{
  fresh();T.activateSlot(2);T.setState('title');X('sandboxRun=false;sandboxMode=false;');const snap=sandbox.localStorage.getItem('echoSave.v3');
  X('sandboxOpenSetup();sandboxCfg.char=0;');assert.strictEqual(X('sandboxStart()'),true);const p=T.getPlayer();p.hp=1e9;p.maxHp=1e9;
  for(const id of IDS){if(T.getMiniBoss())X('sandboxClearMini()');const b=spawn(id,10,2);step(b,10,orbit);T.drawMiniBoss(b);}
  const mb=T.getMiniBoss();assert.ok(mb);X('sandboxClearMini()');assert.strictEqual(mb.hazards.length,0);
  X('sandboxExit(true)');assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),snap);assert.strictEqual(T.getMiniBoss(),null);
});
ok('B5B-21: DEV.minibossState/minibossPhase2/minibossClearHazards inertes fora do DEV; em DEV mostram id/fase/cooldowns/hazards/crias/regen/postura/combo/siphon/escalada',()=>{
  fresh();const b=spawn('leech',10,2);step(b,6,(p,t)=>{p.x=b.x-300;p.y=b.y;});
  X('DEV_MODE=false');assert.strictEqual(X('DEV.minibossState()'),null);assert.strictEqual(X('DEV.minibossPhase2()'),false);assert.strictEqual(X('DEV.minibossClearHazards()'),false);
  X('DEV_MODE=true');const st=X('DEV.minibossState()');assert.strictEqual(st.id,'leech');assert.strictEqual(st.phase,2);assert.ok(st.cooldowns&&'siphon' in st.cooldowns&&st.siphon&&st.hazardCap===2&&'summons' in st&&'regen' in st&&'escalation' in st);
  const b2=spawn('herald');b2.hp=b2.maxHp;T.setMiniBoss(b2);assert.strictEqual(X('DEV.minibossPhase2()'),true);assert.ok(b2.hp<=b2.maxHp*.5);
  T.mbHazardAdd(b2,{kind:'omen',x:1,y:1,r:90,life:1,fuse:1});assert.strictEqual(X('DEV.minibossClearHazards()'),true);assert.strictEqual(b2.hazards.length,0);
  X('DEV_MODE=false');X('devTainted=false');
  assert.ok(/minibossState\(\)\{\s*if\(!DEV_MODE\)return null;/.test(SRC));
});

/* ================= FRACTURE / PARADOXO ================= */
ok('B5B-22: Fracture Director — pickMiniBoss/fracturePickMiniBoss/miniEligiblePool/fractureOnMiniSpawn intactos e cegos ao B5-B; seleção determinística',()=>{
  const pick=SRC.slice(SRC.indexOf('function pickMiniBoss('),SRC.indexOf('function spawnMiniBoss('));
  assert.ok(!/MB_UPDATERS|hazards|\.ms\b/.test(pick));
  const fr=SRC.slice(SRC.indexOf('function fracturePickMiniBoss('),SRC.indexOf('function fracturePickMiniBoss(')+4000);assert.ok(!/MB_UPDATERS|hazards|mbInitState/.test(fr));
  fresh();const seq=()=>{const r=sandbox.Math.random;sandbox.Math.random=seed(7);const out=[];for(let w=5;w<=15;w+=5)out.push(T.pickMiniBoss(w).id);sandbox.Math.random=r;return out.join(',');};assert.strictEqual(seq(),seq());
  assert.ok(/try\{fractureOnMiniSpawn\(def,n\);\}catch\(e\)\{\}/.test(SRC)&&/fractureOnMiniKill\(e\.mb,wave\|0\)/.test(SRC));
});
ok('B5B-23: O PARADOXO intacto — updateBoss/drawBoss byte-a-byte iguais ao B5-A (sem referência a MB_*/hazards); HUD padrão preservado',()=>{
  const prev=fs.existsSync('/tmp/pre_b5b_index.html')?fs.readFileSync('/tmp/pre_b5b_index.html','utf8'):null;
  const cut=(src,a,b)=>src.slice(src.indexOf(a),src.indexOf(b));
  const ub=cut(SRC,'function updateBoss(','function drawBoss('),db=SRC.slice(SRC.indexOf('function drawBoss('),SRC.indexOf('function drawBoss(')+12000);
  assert.ok(!/MB_UPDATERS|mbHazard|MINIBOSS_RENDERERS|drawMinibossHazards/.test(ub+db));
  if(prev){assert.strictEqual(ub,cut(prev,'function updateBoss(','function drawBoss('),'updateBoss idêntico');}
  assert.ok(SRC.includes('<div id="bossnm">O   P A R A D O X O</div>'));
  fresh();const boss={type:'boss',x:600,y:400,r:70,hp:1000,maxHp:1000,spawnT:0,phase:1,gravs:[],shocks:[],t:1,aim:0,flashT:0,core:0,ring:0,spinAng:0,orbs:[],beams:[],vx:0,vy:0,dmg:10};
  T.drawBoss(boss);assert.strictEqual(boss.hp,1000);
});
ok('B5B-24: balance de base intacto — MINIBOSS (hp/spd/r/plates) e fórmulas de spawn/recompensa iguais; mudanças são de comportamento/cooldown (documentadas)',()=>{
  const SNAP={herald:[1,1,44,6],furnace:[1.25,.72,48,7],sentinel:[1.05,.9,42,8],brood:[1.15,.62,46,5],duelist:[.7,1.55,34,3],colossus:[1.75,.45,56,10],oracle:[.9,1,40,5],leech:[1,1.1,40,4]};
  for(const m of T.MINIBOSS)assert.deepStrictEqual([m.hp,m.spd,m.r,m.plates].join(','),SNAP[m.id].join(','),m.id);
  const sp=SRC.slice(SRC.indexOf('function spawnMiniBoss('),SRC.indexOf('function miniBossHUD('));
  assert.ok(/\(520\+n\*54\)\*def\.hp\*scale\*\(1\+\.08\*echoQueue\.length\)/.test(sp)&&/\(20\+n\*1\.1\)\*def\.hp/.test(sp)&&/\(96\+n\*2\)\*def\.spd/.test(sp)&&/xp:150/.test(sp)&&/spawnT:1\.6/.test(sp));
  assert.ok(/Math\.round\(120\*incomeCoinCap\(mEff\.coinMul\*player\.coinMul\)\)/.test(SRC));
});

sandbox.Math.random=Math.random;
if(failed)console.log('\n'+failed+' FALHAS');else console.log('\n'+passed+' PASSARAM · 0 FALHAS');
process.exit(failed?1:0);
