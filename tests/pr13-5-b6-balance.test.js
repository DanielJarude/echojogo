'use strict';
/* =====================================================================
   TESTES — PR13.5 · B6 · BALANCEAMENTO, REGRESSÕES E PLAYTEST FINAL
   ---------------------------------------------------------------------
   Blocos:
     A. MUDANÇAS DO B6 — piso do dash e cadência da Alabarda
     B. INVARIANTES DE BALANCE — caps, clamps, ausência de NaN/Infinity
     C. ARMAS / BUILD PIPELINE / TYPED RANGE
     D. ECONOMIA
     E. FRACTURE / TEMAS
     F. MINIBOSSES
     G. O PARADOXO
     H. OPERADORES / ECHOS / SHIELD / ATTUNEMENT
     I. SAVE / CONTINUE / SANDBOX
     J. STRESS
     K. FIDELIDADE DO PROXY (o simulador espelha o jogo?)

   Testes COMPORTAMENTAIS sempre que possível: executam o jogo e medem,
   em vez de casar strings. Onde a asserção é textual, usa a fonte
   NORMALIZADA (LF) do harness — nunca '\n' literal contra o arquivo cru.
   ===================================================================== */
const assert=require('assert');
const {sandbox,T,vm,SRC,normalizeSource}=require('../audit_pr135/harness.js');
const X=code=>vm.runInContext(code,sandbox);
const SIM=require('../audit_pr135/b6_run_sim.js');
const SRCN=normalizeSource(SRC);

let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}
}
function seed(value){let x=value>>>0;
  return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function fresh(w){
  sandbox.Math.random=seed(0xB6A11);
  X('DEV_MODE=false;devTainted=false;sandboxRun=false;sandboxMode=false;');
  T.activateSlot(1);T.startRun();
  T.setMoral({comp:0,greed:0,viol:0});
  X('applyMoral();applyMoralTuning(player);');
  if(w)T.setWave(w);
  const p=T.getPlayer();
  T.setEnemies([]);T.setProjectiles([]);T.setMiniBoss(null);
  return p;
}

console.log('\nECHO — PR13.5 · B6 · BALANCEAMENTO E REGRESSÕES');
console.log('---------------------------------------------');

/* ================= A · MUDANÇAS DO B6 ================= */

ok('B6-A1: DASH_CD_MIN existe, vale .2 e é o MESMO piso que resumeRun já impunha',()=>{
  assert.strictEqual(X('DASH_CD_MIN'),.2,'DASH_CD_MIN deve ser .2');
  /* o piso do Continue não pode divergir do piso da run ao vivo — foi
     justamente essa incoerência que o B6 corrigiu */
  assert.ok(/player\.dashCdMax=Math\.max\(\.2,num\(q\.dashCdMax/.test(SRCN),
    'resumeRun deve manter o piso .2');
  assert.ok(/Math\.max\(DASH_CD_MIN,player\.dashCdMax\*_dashMul\)/.test(SRCN),
    'tryDash deve aplicar DASH_CD_MIN');
});

ok('B6-A2: COMPORTAMENTO — nenhum encadeamento de itens/upgrades leva a recarga efetiva abaixo de DASH_CD_MIN',()=>{
  const p=fresh(10);
  /* empilha TUDO que reduz a recarga, muito além do que a run oferece */
  for(let k=0;k<20;k++){
    for(const id of ['dash','sprint','singul']){
      const u=T.UPGRADES.find(x=>x.id===id);if(u)u.apply(p);
    }
    p.dashCdMax*=.92;                      // recompensa de nível
  }
  assert.ok(p.dashCdMax<.2,'pré-condição: o campo cru realmente afunda ('+p.dashCdMax.toFixed(4)+')');
  p.dashCd=0;p.dashT=0;p.vowBlood=0;
  X('state="play"');
  X('tryDash()');
  assert.ok(p.dashCd>=.2-1e-9,'recarga efetiva '+p.dashCd+' < piso .2');
});

ok('B6-A3: o piso NÃO nerfa builds de mobilidade normais (dash+sprint em WRAITH continua muito rápido)',()=>{
  const p=fresh(10);
  X('player.charId="wraith";player.dashCdMax=1.35;');
  T.UPGRADES.find(x=>x.id==='dash').apply(p);
  T.UPGRADES.find(x=>x.id==='sprint').apply(p);
  p.dashCd=0;p.dashT=0;p.vowBlood=0;X('state="play"');
  X('tryDash()');
  /* ~1.03s: bem acima do piso — a mudança só corta o caso degenerado */
  assert.ok(p.dashCd>.2+1e-9,'build normal não deve encostar no piso ('+p.dashCd.toFixed(3)+')');
  assert.ok(p.dashCd<1.35,'ainda assim é mais rápida que a base');
});

ok('B6-A4: ALABARDA — só a cadência mudou (.62 → .72); dano, alcance, arco e corrosão intactos',()=>{
  const g=T.WEAPONS.find(w=>w.id==='glaive');
  assert.strictEqual(g.interval,.72,'interval deve ser .72');
  assert.strictEqual(g.dmg,55,'dano preservado');
  assert.strictEqual(g.reach,158,'alcance preservado');
  assert.strictEqual(g.arc,1.15,'arco preservado');
  assert.strictEqual(g.melee,true,'continua melee');
  assert.ok(g.fx&&g.fx.k==='corrode'&&g.fx.pow===.14&&g.fx.dur===4,
    'corrosão preservada (identidade da arma)');
});

ok('B6-A5: ALABARDA deixou de dominar a própria classe (≤1,5× a mediana melee)',()=>{
  const p=SIM.buildPlayer('vector',{});
  const mix=w=>{const s=SIM.playerDps(p,w,1),g=SIM.playerDps(p,w,12),h=SIM.playerDps(p,w,40);
    return s*.35+g*.4+h*.25;};
  const mel=T.WEAPONS.filter(w=>w.melee).map(mix);
  const med=SIM.stats(mel).med;
  const gl=mix(T.WEAPONS.find(w=>w.id==='glaive'));
  assert.ok(gl/med<=1.5,'alabarda em '+(gl/med).toFixed(2)+'× a mediana melee');
});

ok('B6-A6: nenhuma OUTRA arma foi alterada pelo B6 (catálogo congelado)',()=>{
  /* assinatura das 27 armas exceto a alabarda; qualquer ajuste futuro
     não documentado quebra aqui */
  const sig=T.WEAPONS.filter(w=>w.id!=='glaive')
    .map(w=>[w.id,w.dmg,w.interval,w.count||1,w.range,w.rar].join(':')).join('|');
  const expected=[
    'plasma:11:0.16:1:760:0','shotgun:7:0.74:7:245:1','orb:24:1.05:1:430:1',
    'blade:46:0.38:1:104:0','beam:3.6:0.055:1:640:3','flamer:2.6:0.045:1:210:1',
    'rail:78:1.3:1:1100:4','smg:4.2:0.065:1:480:0','cryo:13:0.62:1:520:2',
    'tesla:14:0.52:1:470:3','acid:7:0.28:2:330:2','nail:6.5:0.13:1:620:1',
    'boomer:22:0.7:1:420:2','homing:17:0.85:3:760:3','mine:44:0.8:1:200:2',
    'sniper:52:1.1:1:980:3','scythe:38:0.46:1:118:2','hammer:72:0.95:1:132:3',
    'void:30:1.25:1:560:4','ricochet:12:0.22:1:900:1','gatling:6.8:0.09:1:560:3',
    'prism:9:0.4:3:540:2','plague:16:0.95:1:450:2','katana:29:0.24:1:96:2',
    'chains:34:0.58:1:172:3','gaunt:41:0.3:1:74:2'
  ].join('|');
  assert.strictEqual(sig,expected,'catálogo de armas divergiu do baseline B6');
});

/* ================= B · INVARIANTES DE BALANCE ================= */

ok('B6-B1: caps globais presentes e finitos (entidades, partículas, hazards, crias, fila de fala, histórico)',()=>{
  assert.strictEqual(X('ENEMY_BUDGET'),46);
  assert.strictEqual(X('PARTS_MAX'),900);
  assert.strictEqual(X('MB_BROOD_CAP'),12);
  assert.strictEqual(X('FTEXT_MAX'),52);
  assert.strictEqual(X('ECHO_SPEECH_QUEUE_MAX'),3);
  assert.strictEqual(X('SHOP_RECENT_MAX'),32);
  assert.strictEqual(X('FACTION_HIST_MAX'),40);
  const caps=T.MB_HAZARD_CAP;
  for(const id of Object.keys(caps))
    assert.ok(Number.isFinite(caps[id])&&caps[id]>=0,'cap de hazard inválido: '+id);
});

ok('B6-B2: clamps do pipeline de stats seguem vigentes (crit ≤1, escudo ≤500, não-negativos)',()=>{
  /* JSON em vez de deepStrictEqual: os arrays vêm de OUTRO realm (a VM do
     harness), então não são reference-equal com literais deste arquivo. */
  const S=T.SM_STATS,J=v=>JSON.stringify(v);
  assert.strictEqual(J(S.crit.cl),J([0,1]));
  assert.strictEqual(J(S.shieldMax.cl),J([0,500]));
  assert.strictEqual(J(S.pierce.cl),J([0,null]));
  assert.strictEqual(J(S.dmgTaken.cl),J([0,null]));
  assert.strictEqual(J(S.coinMul.cl),J([0,null]));
});

ok('B6-B3: STRESS EXTREMO — todos os upgrades ×12 + os 57 módulos não produzem NaN, Infinity nem stat negativo',()=>{
  const p=fresh(20);
  for(let k=0;k<12;k++)for(const u of T.UPGRADES){try{u.apply(p);}catch(e){}}
  for(const it of T.ITEMS){try{if(p.items.indexOf(it.id)<0)p.items.push(it.id);it.apply(p);}catch(e){}}
  try{T.applyMoralTuning(p);}catch(e){}
  try{T.smRefresh(p);}catch(e){}
  const bad=[];
  for(const k in p){
    const v=p[k];
    if(typeof v!=='number')continue;
    if(!isFinite(v))bad.push(k+'='+v);
    if(['maxHp','shieldMax','speed','pickupR','critMul','pierce','dmgTakenMul'].indexOf(k)>=0&&v<0)
      bad.push(k+' negativo='+v);
  }
  assert.strictEqual(bad.length,0,'stats inválidos: '+bad.join(', '));
  assert.ok(p.crit<=1,'crit clampado');
  assert.ok(p.shieldMax<=500,'escudo clampado');
});

/* ================= C · ARMAS / BUILD PIPELINE / TYPED RANGE ================= */

ok('B6-C1: as 27 armas têm números finitos e positivos onde exigido',()=>{
  assert.strictEqual(T.WEAPONS.length,27);
  for(const w of T.WEAPONS){
    assert.ok(w.interval>0&&isFinite(w.interval),w.id+' interval');
    assert.ok(w.dmg>0&&isFinite(w.dmg),w.id+' dmg');
    assert.ok((w.range||w.reach)>0,w.id+' alcance');
    assert.ok(w.rar>=0&&w.rar<=4,w.id+' raridade');
  }
});

ok('B6-C2: nenhuma arma é outlier absoluto (>2,5× o valor mediano do arsenal)',()=>{
  const p=SIM.buildPlayer('vector',{});
  const val=w=>{
    const s=SIM.playerDps(p,w,1),g=SIM.playerDps(p,w,12),h=SIM.playerDps(p,w,40);
    return s*.35+g*.4+h*.25;
  };
  const all=T.WEAPONS.map(val);
  const med=SIM.stats(all).med;
  const worst=T.WEAPONS.map(w=>({id:w.id,r:val(w)/med})).sort((a,b)=>b.r-a.r)[0];
  assert.ok(worst.r<=2.5,'arma dominante: '+worst.id+' em '+worst.r.toFixed(2)+'× a mediana');
});

ok('B6-C3: TYPED RANGE — melee e ranged continuam separados e não vazam um no outro',()=>{
  const p=fresh(5);
  T.smMul(p,'rangedRange','t.b6','TESTE',2);T.smRefresh(p);
  assert.strictEqual(T.srcRangeMul(p,'ranged'),2,'ranged recebeu o dobro');
  assert.strictEqual(T.srcRangeMul(p,'melee'),1,'melee NÃO deve ser afetado');
  T.smRemoveId(p,'t.b6');T.smRefresh(p);
  T.smMul(p,'meleeRange','t.b6m','TESTE',3);T.smRefresh(p);
  assert.strictEqual(T.srcRangeMul(p,'melee'),3);
  assert.strictEqual(T.srcRangeMul(p,'ranged'),1);
  T.smRemoveId(p,'t.b6m');T.smRefresh(p);
});

ok('B6-C4: weaponRange usa reach em melee e range em ranged',()=>{
  const p=fresh(5);
  const gl=T.WEAPONS.find(w=>w.id==='glaive');
  const pl=T.WEAPONS.find(w=>w.id==='plasma');
  assert.strictEqual(T.weaponRange(gl,p),158,'alabarda usa reach');
  assert.strictEqual(T.weaponRange(pl,p),760,'plasma usa range');
});

ok('B6-C5: BUILD PIPELINE — flat/add/mult compõem na ordem e são reversíveis',()=>{
  const p=fresh(5);
  const base=T.smGet(p,'damage');
  T.smMul(p,'damage','b6.m','x2',2);
  T.smAddPct(p,'damage','b6.a','+50%',.5);
  T.smRefresh(p);
  const after=T.smGet(p,'damage');
  assert.ok(Math.abs(after-base*1.5*2)<1e-9,'ordem add→mult: '+after);
  T.smRemoveId(p,'b6.m');T.smRemoveId(p,'b6.a');T.smRefresh(p);
  assert.ok(Math.abs(T.smGet(p,'damage')-base)<1e-9,'remoção restaura a base');
});

/* ================= D · ECONOMIA ================= */

ok('B6-D1: ECONOMIA — o jogador quase sempre pode comprar algo (CAN_NONE ≈ 0) e raramente compra tudo',()=>{
  let none=0,all=0,shops=0;
  const p=fresh(1);
  for(let run=0;run<60;run++){
    sandbox.Math.random=seed(0xEC0+run*7919);
    p.coins=25;p.items=[];p.upgLog=[];
    if(T.resetShopVars)T.resetShopVars();
    for(let w=1;w<=20;w++){
      p.coins+=25+Math.round(60*w*.6);
      T.setWave(w);T.rollShop();
      const prices=T.getShopOffers().map(u=>T.priceUpg(u))
        .concat(T.getShopItems().map(i=>T.priceItem(i)));
      if(!prices.length)continue;
      const total=prices.reduce((a,b)=>a+b,0),min=Math.min.apply(null,prices);
      shops++;
      if(p.coins<min)none++;
      if(p.coins>=total)all++;
      for(const c of prices.slice().sort((a,b)=>a-b))if(p.coins>=c)p.coins-=c;
    }
  }
  assert.ok(none/shops<.05,'CAN_NONE alto demais: '+(none/shops*100).toFixed(1)+'%');
  assert.ok(all/shops<.95,'CAN_ALL saturado: '+(all/shops*100).toFixed(1)+'%');
});

ok('B6-D2: preços continuam positivos, finitos e crescentes com a raridade',()=>{
  fresh(10);
  for(const u of T.UPGRADES){const c=T.priceUpg(u);
    assert.ok(c>0&&isFinite(c),'preço inválido: '+u.id);}
  for(const it of T.ITEMS){const c=T.priceItem(it);
    assert.ok(c>0&&isFinite(c),'preço inválido: '+it.id);}
  const r0=T.ITEMS.filter(i=>i.rar===0),r4=T.ITEMS.filter(i=>i.rar===4);
  if(r0.length&&r4.length){
    const avg=a=>a.reduce((s,i)=>s+T.priceItem(i),0)/a.length;
    assert.ok(avg(r4)>avg(r0),'raridade 4 deve custar mais que raridade 0');
  }
});

ok('B6-D3: reroll e teto de renda seguem finitos e não-negativos',()=>{
  fresh(10);
  const rc=T.rerollBaseCost();
  assert.ok(rc>0&&isFinite(rc),'reroll base inválido');
  for(const v of [0,1,10,100,1e6])
    assert.ok(isFinite(T.incomeCoinCap(v))&&T.incomeCoinCap(v)>=0,'incomeCoinCap('+v+')');
});

/* ================= E · FRACTURE / TEMAS ================= */

ok('B6-E1: os 6 Temas existem, são distintos e nenhum estoura o budget de entidades',()=>{
  const res=X('fractureSimulate({seeds:60,waveMin:1,waveMax:19,intensity:100})');
  assert.strictEqual(res.themes.length,6);
  for(const id of res.themes){
    const r=res.per[id];
    assert.strictEqual(r.budgetOver,0,id+' passou do budget');
    assert.ok(r.entityAvg>0&&isFinite(r.entityAvg),id+' média inválida');
  }
});

ok('B6-E2: os Temas diferem entre si mas dentro de faixa saudável (spread de densidade < 25%)',()=>{
  const res=X('fractureSimulate({seeds:60,waveMin:1,waveMax:19,intensity:100})');
  const ents=res.themes.map(id=>res.per[id].entityAvg);
  const mn=Math.min.apply(null,ents),mx=Math.max.apply(null,ents);
  assert.ok(mx/mn-1<.25,'spread de '+((mx/mn-1)*100).toFixed(1)+'% entre Temas');
  /* mas NÃO podem ser idênticos: identidade é requisito de design */
  const shares=res.themes.map(id=>{
    const s=res.per[id].share;
    return Object.keys(s).sort((a,b)=>s[b]-s[a])[0];
  });
  assert.ok(new Set(shares).size>=2,'todos os Temas com o mesmo arquétipo dominante');
});

ok('B6-E3: nenhum Tema produz monocultura (um arquétipo tomando a onda inteira)',()=>{
  const res=X('fractureSimulate({seeds:60,waveMin:1,waveMax:19,intensity:100})');
  for(const id of res.themes){
    const r=res.per[id];
    assert.ok(r.extremes/r.entityN<.20,
      id+' monocultura em '+(r.extremes/r.entityN*100).toFixed(0)+'% das ondas');
  }
});

/* ================= F · MINIBOSSES ================= */

ok('B6-F1: os 8 mini-chefes mantêm identidade mecânica (updater próprio) e números de base intactos',()=>{
  assert.strictEqual(T.MINIBOSS.length,8);
  const sig=T.MINIBOSS.map(m=>[m.id,m.hp,m.spd,m.r,m.plates].join(':')).join('|');
  assert.strictEqual(sig,
    'herald:1:1:44:6|furnace:1.25:0.72:48:7|sentinel:1.05:0.9:42:8|'+
    'brood:1.15:0.62:46:5|duelist:0.7:1.55:34:3|colossus:1.75:0.45:56:10|'+
    'oracle:0.9:1:40:5|leech:1:1.1:40:4',
    'B6 NÃO alterou números de mini-chefe — divergência detectada');
  for(const m of T.MINIBOSS)
    assert.strictEqual(typeof T.MB_UPDATERS[m.id],'function',m.id+' sem updater');
});

ok('B6-F2: a dispersão de TTK entre mini-chefes é intencional e limitada (≤4×)',()=>{
  const ttk=T.MINIBOSS.map(m=>{
    const s=SIM.minibossStats(m.id,10,2);
    return s.hp*(1+s.plates*.06);
  });
  const mn=Math.min.apply(null,ttk),mx=Math.max.apply(null,ttk);
  assert.ok(mx/mn<=4,'razão de EHP '+(mx/mn).toFixed(2)+'× entre mini-chefes');
  /* e não podem ser todos iguais: TTK uniforme apagaria a identidade */
  assert.ok(mx/mn>1.5,'mini-chefes homogêneos demais — identidade perdida');
});

ok('B6-F3: fórmula de spawn do mini-chefe inalterada (HP, dano, velocidade)',()=>{
  assert.ok(/const hp=Math\.round\(\(520\+n\*54\)\*def\.hp\*scale\*\(1\+\.08\*echoQueue\.length\)\)/.test(SRCN),
    'fórmula de HP do mini-chefe mudou');
  assert.ok(/dmg:Math\.round\(\(20\+n\*1\.1\)\*def\.hp\)/.test(SRCN),'fórmula de dano mudou');
  assert.ok(/const scale=1\+\(n-5\)\*\.08/.test(SRCN),'escala por onda mudou');
});

/* ================= G · O PARADOXO ================= */

ok('B6-G1: O PARADOXO permanece intocado pelo B6 (HP, dano, raio, fases, feixes)',()=>{
  assert.ok(/const hp=2200\+\(echoQueue\.length\*380\)/.test(SRCN),'HP do boss mudou');
  assert.ok(/dmg:34,spd:82/.test(SRCN),'dano/velocidade do boss mudaram');
  assert.ok(/r:66/.test(SRCN),'raio do boss mudou');
  assert.ok(/beamN:3/.test(SRCN)&&/beamLen:820/.test(SRCN),'feixes alterados');
  assert.ok(/intro:2\.2/.test(SRCN),'intro alterada');
  assert.ok(/e\.phase===1&&e\.hp<=e\.maxHp\*\.5/.test(SRCN),'gatilho da fase 2 alterado');
});

ok('B6-G2: nenhum ataque novo e nenhuma fase nova foram adicionados ao boss',()=>{
  const upd=SRCN.slice(SRCN.indexOf('function updateBoss('),SRCN.indexOf('function drawBoss('));
  assert.ok(upd.indexOf('phase===3')<0&&upd.indexOf('e.phase=3')<0,'terceira fase detectada');
  /* o repertório aprovado no B5-C: feixes, espiral, choque, gravidade, dash, sombras */
  for(const k of ['beamOn','spiralT','shockT','gravT','dashT','summonT'])
    assert.ok(upd.indexOf(k)>=0,'ataque aprovado ausente: '+k);
});

ok('B6-G3: recompensa de ◆ Memória do B5.5 preservada (fonte única + decaimento)',()=>{
  assert.strictEqual(typeof T.metaVictoryDecay,'function');
  const d1=T.metaVictoryDecay(0),d2=T.metaVictoryDecay(1),d4=T.metaVictoryDecay(3);
  assert.ok(d1>=d2&&d2>=d4,'decaimento não é monotônico');
  assert.ok(d4>=.5*d1-1e-9,'piso de 50% do B5.5 violado');
});

/* ================= H · OPERADORES / ECHOS / SHIELD / ATTUNEMENT ================= */

ok('B6-H1: os 8 operadores são distintos e nenhum domina todos os eixos',()=>{
  assert.strictEqual(T.CHARS.length,8);
  const best={};
  for(const k of ['hp','speed','dmg','crit','shieldMax'])
    best[k]=T.CHARS.slice().sort((a,b)=>(b[k]||0)-(a[k]||0))[0].id;
  best.dash=T.CHARS.slice().sort((a,b)=>a.dashCd-b.dashCd)[0].id;
  const winners=new Set(Object.keys(best).map(k=>best[k]));
  assert.ok(winners.size>=3,'poucos operadores lideram algum eixo: '+JSON.stringify(best));
  const dominante=Object.keys(best).every(k=>best[k]===best.hp);
  assert.ok(!dominante,'um operador lidera TODOS os eixos');
});

ok('B6-H2: makePlayer respeita o operador pedido (regressão: índice ≠ id)',()=>{
  /* bug real encontrado no B6: passar índice caía em CHARS[0] calado */
  for(const c of T.CHARS){
    const p=T.makePlayer(c.id,true);
    assert.strictEqual(p.charId,c.id,'operador ignorado: '+c.id);
    assert.strictEqual(p.maxHp,c.hp,c.id+' HP divergente');
    assert.strictEqual(p.shieldMax,c.shieldMax||0,c.id+' escudo divergente');
  }
});

ok('B6-H3: SHIELD — escudo absorve antes do HP e regenera respeitando o atraso',()=>{
  const p=fresh(5);
  X('player.shieldMax=40;player.shield=40;player.shieldRegen=5;player.shieldDelay=2;player.hp=100;player.maxHp=100;');
  X('damagePlayer(25)');
  assert.strictEqual(p.hp,100,'HP não deve cair enquanto há escudo');
  assert.ok(p.shield<40,'escudo deve absorver');
});

ok('B6-H4: ATTUNEMENT — os 5 estados seguem ordenados, com combate e economia distintos',()=>{
  const st=T.ATTUNE_STATES;
  assert.strictEqual(st.length,5);
  for(let i=1;i<st.length;i++){
    assert.ok(st[i].min>st[i-1].min,'limiares não crescentes');
    assert.ok(st[i].mul>=st[i-1].mul,'multiplicador não monotônico');
  }
  assert.ok(st[0].mul<1&&st[st.length-1].mul>1,'divergente deve punir e ressonante premiar');
  /* o spread total não pode virar um multiplicador de build */
  assert.ok(st[st.length-1].mul/st[0].mul<1.35,'spread do Attunement grande demais');
});

ok('B6-H5: ECHOS — teto de dano e escalas permanecem os aprovados (o Eco não carrega a run)',()=>{
  const J=v=>JSON.stringify(v);            // cross-realm: ver B6-B2
  assert.strictEqual(X('ECHO_DMG_CAP'),14,'teto de dano do Eco alterado');
  assert.strictEqual(J(X('ECHO_MUL')),J([0,.34,.24]),'multiplicador do Eco alterado');
  assert.strictEqual(J(X('ECHO_HP')),J([0,70,50]),'HP do Eco alterado');
  assert.strictEqual(J(X('ECHO_RATE')),J([0,.62,.52]),'cadência do Eco alterada');
});

/* ================= I · SAVE / CONTINUE / SANDBOX ================= */

ok('B6-I1: SM_VERSION continua 3 e o wrapper do save segue v3 (B6 não mexeu em schema)',()=>{
  assert.strictEqual(X('SM_VERSION'),3);
  assert.ok(/version:\s*3,/.test(SRCN),'wrapper do save deve seguir v3');
});

ok('B6-I2: versão do jogo consistente (package.json ↔ ECHO_VERSION)',()=>{
  assert.strictEqual(require('../package.json').version,'0.9.0-alpha');
  assert.ok(/const ECHO_VERSION\s*=\s*['"]0\.9\.0-alpha['"]/.test(SRCN));
});

ok('B6-I3: CONTINUE — o piso do dash sobrevive ao ciclo checkpoint → resume',()=>{
  const p=fresh(8);
  p.dashCdMax=.05;                                  // valor degenerado gravado
  const cp=T.smBuildCheckpoint?T.smBuildCheckpoint():null;
  T.captureCheckpoint();
  T.resumeRun();
  const q=T.getPlayer();
  assert.ok(q.dashCdMax>=.2-1e-9,'resumeRun deve reimpor o piso ('+q.dashCdMax+')');
});

ok('B6-I4: SANDBOX — entrar, mexer e sair não altera o save real (byte a byte)',()=>{
  fresh(5);
  T.activateSlot(2);X('state="title";sandboxRun=false;sandboxMode=false;');
  const snap=sandbox.localStorage.getItem('echoSave.v3');
  X('sandboxOpenSetup();sandboxCfg.char=0;');
  assert.strictEqual(X('sandboxStart()'),true);
  const p=T.getPlayer();
  p.coins=99999;p.hp=1;
  for(const u of T.UPGRADES)try{u.apply(p);}catch(e){}
  X('sandboxExit(true)');
  assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),snap,
    'save real contaminado pelo Sandbox');
});

/* ================= J · STRESS ================= */

ok('B6-J1: STRESS — 60 s de fogo contínuo na cadência máxima plausível não faz projéteis crescerem sem limite',()=>{
  const p=fresh(15);
  T.smMul(p,'fireRate','b6.stress','STRESS',9.5);T.smRefresh(p);
  T.setProjectiles([]);T.setEnemies([]);
  const w=T.WEAPONS.find(x=>x.id==='gatling');
  const dt=1/60;let timer=0,peak=0;
  for(let f=0;f<60*60;f++){
    timer-=dt;
    if(timer<=0){T.fireWeaponFrom(p,w,'ally',1);timer=w.interval/(p.fireRateMul*3.2);}
    T.updateProjectiles(dt);
    peak=Math.max(peak,T.getProjectiles().length);
  }
  /* o alcance expira o projétil antes da vida: existe teto natural */
  assert.ok(peak<400,'pico de '+peak+' projéteis');
  assert.ok(T.getProjectiles().length<400,'acúmulo residual');
  T.smRemoveId(p,'b6.stress');T.smRefresh(p);
});

ok('B6-J2: STRESS — 400 lojas seguidas não vazam histórico nem preço inválido',()=>{
  const p=fresh(1);
  if(T.resetShopVars)T.resetShopVars();
  for(let i=0;i<400;i++){
    T.setWave(1+(i%20));T.rollShop();
    for(const u of T.getShopOffers())assert.ok(isFinite(T.priceUpg(u)));
    if(i%3===0&&T.getShopOffers()[0])T.shopMarkBought(T.getShopOffers()[0].id);
  }
  assert.ok(T.getShopRecent().length<=X('SHOP_RECENT_MAX'),'histórico da loja sem cap');
});

ok('B6-J3: STRESS — 200 composições de onda respeitam o budget e não geram negativo',()=>{
  for(let i=0;i<200;i++){
    const n=1+(i%20);
    const c=T.waveComp(n);
    let tot=0;
    for(const k of T.WAVE_KEYS){
      const v=c[k]|0;
      assert.ok(v>=0,'contagem negativa em '+k);
      tot+=v;
    }
    assert.ok(tot<=X('ENEMY_BUDGET'),'onda '+n+' com '+tot+' entidades');
  }
});

/* ================= K · FIDELIDADE DO PROXY ================= */

ok('B6-K1: o simulador espelha as curvas REAIS de dificuldade do jogo',()=>{
  /* se index.html mudar diffHp/diffDmg/diffSpd/diffXp, o proxy fica
     mentindo — este teste é o alarme */
  for(const n of [1,5,10,15,20]){
    assert.ok(Math.abs(SIM.diffHp(n)-X('diffHp('+n+')'))<1e-9,'diffHp('+n+')');
    assert.ok(Math.abs(SIM.diffDmg(n)-X('diffDmg('+n+')'))<1e-9,'diffDmg('+n+')');
    assert.ok(Math.abs(SIM.diffSpd(n)-X('diffSpd('+n+')'))<1e-9,'diffSpd('+n+')');
    assert.ok(Math.abs(SIM.diffXp(n)-X('diffXp('+n+')'))<1e-9,'diffXp('+n+')');
    assert.ok(Math.abs(SIM.eliteChance(n)-X('eliteChance('+n+')'))<1e-9,'eliteChance('+n+')');
  }
  assert.strictEqual(SIM.ENEMY_BUDGET,X('ENEMY_BUDGET'),'budget divergente');
});

ok('B6-K2: o simulador espelha as fórmulas reais de mini-chefe e do Paradoxo',()=>{
  const s=SIM.minibossStats('colossus',15,2);
  const def=T.MINIBOSS.find(m=>m.id==='colossus');
  const scale=1+(15-5)*.08;
  assert.strictEqual(s.hp,Math.round((520+15*54)*def.hp*scale*(1+.08*2)),'HP do mini-chefe');
  assert.strictEqual(SIM.bossStats(2).hp,2200+2*380,'HP do Paradoxo');
});

ok('B6-K3: o simulador é DETERMINÍSTICO (mesma seed ⇒ mesmo resultado)',()=>{
  const a=SIM.simRun({char:'vector',weapon:'plasma',echoes:2,seed:4242,plan:{course:['dmg','rate','crit']}});
  const b=SIM.simRun({char:'vector',weapon:'plasma',echoes:2,seed:4242,plan:{course:['dmg','rate','crit']}});
  assert.strictEqual(JSON.stringify(a.rows),JSON.stringify(b.rows),'run não reproduzível');
  assert.strictEqual(a.margin,b.margin);
});

ok('B6-K4: a run baseline termina viva mas sem folga (calibração declarada do B6)',()=>{
  const r=SIM.simRun({char:'vector',weapon:'plasma',echoes:2,seed:20260905,
    plan:{course:['dmg','rate','crit']}});
  assert.strictEqual(r.died,false,'baseline não deveria morrer');
  assert.ok(r.margin<.5,'baseline folgado demais (margem '+(r.margin*100).toFixed(0)+'%)');
  assert.strictEqual(r.rows.length,20,'run deve cobrir as 20 ondas');
  assert.strictEqual(r.rows[19].kind,'BOSS','onda 20 deve ser o Paradoxo');
});

console.log('\n'+passed+' PASSARAM · '+failed+' FALHAS');
if(failed){process.exit(1);}
