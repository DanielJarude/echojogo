'use strict';
/* =====================================================================
   TESTES — PR13.5 · B3-FIX (correções da auditoria independente do B3)
   1. anti-repeat de ARMAS (id real, não índice)
   2. capacidade do histórico (janela d=0 / d=1 sobrevive a reroll+bigShop)
   3. fidelidade de alcance dos Echos (meleeRange/rangedRange no snapshot)
   4. Item Identity: price pass + singul trade-off + critx sem dominância
   5. economia: mercado moderado + teto do surcharge (Greed compra ≥ Neutral)
   6. ESCASSEZ: desconto proporcional do 1º reroll
   7. Sandbox: histórico não fica stale após sair
   ===================================================================== */
const assert=require('assert');
const vm=require('vm');
const {sandbox,T}=require('../audit_pr135/harness.js');
const X=code=>vm.runInContext(code,sandbox);
let passed=0,failed=0;
function near(a,b,eps=1e-6){return Math.abs(a-b)<=eps;}
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}
}
function seedRng(seed){let s=seed>>>0;return function(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function freshRun(){
  T.resetShopVars();T.setState('play');
  T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);T.startRun();
  const p=T.getPlayer();p.coins=999999;T.applyMoral();T.applyMoralTuning(p);return p;
}
const TRAIL=[[0,100,100,0,0,0],[1,110,100,0,0,0],[2,120,100,0,0,0],[3,130,100,0,0,0],[4,140,100,0,0,0]];
function echoData(p,extra){
  return Object.assign({dmgMul:1,frMul:1,wave:5,level:1,crit:0,critMul:1.8,pierce:0,aoeMul:1,
    rangeMul:p?p.rangeMul:1,meleeRangeMul:p?p.meleeRangeMul:undefined,rangedRangeMul:p?p.rangedRangeMul:undefined,
    projSpdMul:1,longRangeBonus:0,items:[],upg:[],owned:[0,3],moral:{comp:0,greed:0,viol:0},dom:'neutro',
    trail:TRAIL,dur:10},extra||{});
}
const PLASMA=T.WEAPONS.findIndex(w=>w.id==='plasma'),BLADE=T.WEAPONS.findIndex(w=>w.id==='blade');

console.log('\nECHO — PR13.5 · B3-FIX');
console.log('---------------------------------------------');

/* ================= 1. ARMAS ================= */
ok('FIX-1: rollShop registra armas pelo ID e o peso é aplicado ao índice (não mais undefined)',()=>{
  freshRun();T.setWave(8);T.rollShop();
  const guns=T.getShopGuns();assert.ok(guns.length>0,'há armas na loja');
  const wi=guns[0],id=T.WEAPONS[wi].id;
  assert.ok(T.getShopRecent().some(e=>e.id===id),'histórico tem o id da arma');
  assert.ok(near(T.shopRepeatWeight(id),T.SHOP_REPEAT_LAST_W),'peso 0.42 pelo id');
  /* fonte: o sorteio de armas passa WEAPONS[wi].id (bug do B3 era o.id) */
  const src=X('rollShop.toString()');
  assert.ok(src.indexOf('shopRepeatWeight(WEAPONS[wi].id)')>=0,'sorteio usa o id da arma');
  assert.ok(src.indexOf('o=>shopRepeatWeight(o.id)); // B3-A: menos armas')<0,'código antigo removido');
});
ok('FIX-1: pickWeightedAny com índices honra o peso (arma recente sai menos, nunca zero)',()=>{
  freshRun();T.setWave(8);
  sandbox.Math.random=seedRng(31337);
  const pool=T.shopWeaponPool().slice(0,6);assert.ok(pool.length>=4);
  T.shopRecentReset();T.shopOfferSeen(T.WEAPONS[pool[0]].id);   // pool[0] "visto agora"
  let hit=0;const N=6000;
  for(let i=0;i<N;i++){if(T.pickWeightedAny(pool,wi=>T.shopRepeatWeight(T.WEAPONS[wi].id))===pool[0])hit++;}
  const expected=T.SHOP_REPEAT_LAST_W/(T.SHOP_REPEAT_LAST_W+(pool.length-1));
  const got=hit/N;
  assert.ok(got>0,'nunca banida');
  assert.ok(Math.abs(got-expected)<.035,'frequência ≈ peso ('+got.toFixed(3)+' vs '+expected.toFixed(3)+')');
  assert.ok(got<1/pool.length,'abaixo do uniforme');
  sandbox.Math.random=Math.random;
});
ok('FIX-1: repetição consecutiva de ARMAS cai de forma mensurável (sem hard-ban)',()=>{
  sandbox.Math.random=seedRng(2024);
  let n=0,rep=0,anyRepeat=false;
  for(let r=0;r<150;r++){
    freshRun();let last=null;
    for(let w=1;w<=20;w++){T.setWave(w);T.rollShop();const g=T.getShopGuns().slice();
      if(last){n++;if(g.some(x=>last.indexOf(x)>=0)){rep++;anyRepeat=true;}}last=g;}
  }
  const pct=rep/n*100;
  assert.ok(pct<13,'repetição de armas abaixo do baseline 15,9% (medido '+pct.toFixed(1)+'%)');
  assert.ok(anyRepeat,'repetir continua possível (não é ban)');
  sandbox.Math.random=Math.random;
});

/* ================= 2. HISTÓRICO ================= */
ok('FIX-2: capacidade comporta 3 lotes de bigShop (10 ofertas) — d=1 sobrevive a um reroll',()=>{
  assert.ok(T.SHOP_RECENT_MAX>=30&&T.SHOP_RECENT_MAX<=40,'capacidade dimensionada (30..40), atual '+T.SHOP_RECENT_MAX);
  const p=freshRun();p.bigShop=1;T.setWave(8);
  T.rollShop();const visita1=T.getShopOffers().map(u=>u.id);
  assert.ok(visita1.length===6,'bigShop oferece 6 upgrades');
  p.bigShop=1;T.rollShop();                       // reroll (lote 2)
  p.bigShop=1;T.rollShop();                       // lote 3
  for(const id of visita1){
    const w=T.shopRepeatWeight(id);
    const reofertado=T.getShopRecent().some(e=>e.id===id&&e.seq>1);
    if(!reofertado)assert.strictEqual(w,1,'após 2 lotes o item de 2 lotes atrás voltou ao normal');
  }
  /* o lote imediatamente anterior ainda está inteiro no histórico */
  const seqs=T.getShopRecent().map(e=>e.seq);
  const lote2=T.getShopRecent().filter(e=>e.seq===2).length;
  assert.strictEqual(lote2,10,'lote 2 (bigShop: 6+2+2) inteiro no histórico');
  assert.ok(T.getShopRecent().length<=T.SHOP_RECENT_MAX,'limitado');
});
ok('FIX-2: d=0 → 0.42, d=1 → 0.72, d≥2 → 1 (loja normal, com reroll no meio)',()=>{
  freshRun();T.setWave(2);
  T.shopRecentReset();T.shopOfferSeen('zz_probe');   // seq 0
  T.rollShop();assert.ok(near(T.shopRepeatWeight('zz_probe'),T.SHOP_REPEAT_PENULT_W),'d=1');
  T.rollShop();assert.strictEqual(T.shopRepeatWeight('zz_probe'),1,'d=2 recupera');
  T.shopOfferSeen('zz_probe');assert.ok(near(T.shopRepeatWeight('zz_probe'),T.SHOP_REPEAT_LAST_W),'d=0');
  /* 6 lotes normais (42 ofertas) nunca ultrapassam o teto */
  for(let i=0;i<6;i++)T.rollShop();
  assert.ok(T.getShopRecent().length<=T.SHOP_RECENT_MAX);
});
ok('FIX-2: uso real da janela — em 200 runs d=1 é observado para upgrades (era quase impossível com 12)',()=>{
  sandbox.Math.random=seedRng(777);
  let d0=0,d1=0,d2=0,cand=0;
  for(let r=0;r<200;r++){
    freshRun();
    for(let w=1;w<=10;w++){
      T.setWave(w);T.rollShop();T.rollShop();          // visita + 1 reroll
      for(const u of T.UPGRADES){if(!T.isUpgUnlocked(u.id))continue;
        const e=T.getShopRecent().slice().reverse().find(x=>x.id===u.id);
        if(!e)continue;cand++;const d=e.now-e.seq;if(d===0)d0++;else if(d===1)d1++;else d2++;}
    }
  }
  assert.ok(d1>0,'d=1 acontece');
  assert.ok(d1/cand>.10,'d=1 tem participação real ('+(d1/cand*100).toFixed(1)+'%)');
  sandbox.Math.random=Math.random;
});

/* ================= 3. ECHO RANGE ================= */
ok('FIX-3: snapshot NOVO carrega meleeRangeMul/rangedRangeMul (Luneta: ranged 1292, melee encolhe)',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);T.itemById('luneta').apply(p);
  const e=T.makeEcho(echoData(p),1);
  assert.ok(near(e.rangedRangeMul,1.70));assert.ok(near(e.meleeRangeMul,.92));
  assert.ok(near(T.weaponRange(T.WEAPONS[PLASMA],e),760*1.70),'plasma do Eco = 1292');
  assert.ok(near(T.weaponRange(T.WEAPONS[BLADE],e),104*.92),'blade do Eco = 95.68');
});
ok('FIX-3: Estilhaço no Eco — ranged curto, melee longo',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);T.itemById('estilhaco').apply(p);
  const e=T.makeEcho(echoData(p),1);
  assert.ok(near(T.weaponRange(T.WEAPONS[PLASMA],e),760*.60));
  assert.ok(near(T.weaponRange(T.WEAPONS[BLADE],e),104*1.20));
});
ok('FIX-3: Longo Curso (só ranged) e Estabilizador (ambos) replicam no Eco',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);T.UPGRADES.find(u=>u.id==='range2').apply(p);
  let e=T.makeEcho(echoData(p),1);
  assert.ok(near(e.rangedRangeMul,1.32));assert.ok(near(e.meleeRangeMul,1));
  const q=T.makePlayer(0,true);T.setPlayer(q);T.UPGRADES.find(u=>u.id==='range').apply(q);
  e=T.makeEcho(echoData(q),2);
  assert.ok(near(e.rangedRangeMul,1.18));assert.ok(near(e.meleeRangeMul,1.18));
  assert.ok(near(e.rangeMul,1.18),'legado continua espelhado quando o item o alimenta');
});
ok('FIX-3: snapshot ANTIGO (só rangeMul) → fallback para os dois alcances; sem campos → 1',()=>{
  const old=echoData(null,{rangeMul:1.7});delete old.meleeRangeMul;delete old.rangedRangeMul;
  let e=T.makeEcho(old,1);
  assert.ok(near(e.meleeRangeMul,1.7)&&near(e.rangedRangeMul,1.7),'fallback rangeMul');
  assert.ok(near(T.weaponRange(T.WEAPONS[PLASMA],e),1292));
  const none=echoData(null,{});delete none.rangeMul;delete none.meleeRangeMul;delete none.rangedRangeMul;
  e=T.makeEcho(none,1);
  assert.strictEqual(e.meleeRangeMul,1);assert.strictEqual(e.rangedRangeMul,1);
  assert.strictEqual(T.echoRangeField({meleeRangeMul:'x',rangeMul:2},'meleeRangeMul'),2,'valor inválido cai no legado');
  assert.strictEqual(T.echoRangeField({rangeMul:0},'rangedRangeMul'),1,'zero não é alcance');
});
ok('FIX-3: saveEchoes grava melee/ranged no slim e loadEchoes devolve-os',()=>{
  T.activateSlot(1);
  const p=T.makePlayer(0,true);T.setPlayer(p);T.itemById('luneta').apply(p);
  X('devTainted=false;');
  X('echoQueue=[]');sandbox.__tmpEcho=echoData(p,{items:['luneta']});
  X('echoQueue.push(globalThis.__tmpEcho)');
  assert.strictEqual(X('saveEchoes()'),true);
  const slim=X('smRoot.slots[curSlot].echoes')[0];
  assert.ok(near(slim.rangedRangeMul,1.70)&&near(slim.meleeRangeMul,.92),'slim tem os dois');
  assert.ok(near(slim.rangeMul,1),'rangeMul legado preservado para compat');
  const back=X('loadEchoes()')[0];
  assert.ok(near(back.rangedRangeMul,1.70));
  const e=T.makeEcho(back,1);
  assert.ok(near(T.weaponRange(T.WEAPONS[PLASMA],e),1292));
  X('echoQueue=[]');
});
ok('FIX-3: Echo Equipment escala os dois alcances a partir da base separada (sem drift)',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);T.itemById('luneta').apply(p);
  const e=T.makeEcho(echoData(p),1);
  T.echoEqInit(e);
  assert.ok(near(e.rangedRangeMul,1.70)&&near(e.meleeRangeMul,.92),'init não altera sem equipamento');
  T.echoEqRefresh(e);T.echoEqRefresh(e);
  assert.ok(near(e.rangedRangeMul,1.70)&&near(e.meleeRangeMul,.92),'refresh repetido é idempotente');
  e.eqFx.rangeMul=1.5;   // simula equipamento de alcance
  const b=e.eqBase;
  assert.ok(near(Math.max(.2,b.rrange*1.5),1.70*1.5),'eqBase separado');
  /* eqBase antigo (sem mrange/rrange) cai no range legado */
  const e2=T.makeEcho(echoData(null,{rangeMul:1.3}),2);
  e2.eqBase={hp:100,sh:0,reg:0,mul:1,crit:0,critMul:1.8,pierce:0,aoe:1,range:1.3,proj:1};
  T.echoEqRefresh(e2);
  assert.ok(near(e2.meleeRangeMul,1.3)&&near(e2.rangedRangeMul,1.3),'eqBase legado → range');
});
ok('FIX-3: morte do jogador registra melee/ranged no runData (runData espelha player)',()=>{
  const src=X('onPlayerDeath?onPlayerDeath.toString():""')||'';
  const s2=X('(function(){try{return sDie.toString()}catch(e){return ""}})()');
  const all=X('(function(){var out="";for(var k in globalThis){}return "";})()');
  const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
  const i=html.indexOf('const runData={dur:runTime,trail:recorder');
  assert.ok(i>0,'runData encontrado');
  const blk=html.slice(i,i+700);
  assert.ok(blk.indexOf('meleeRangeMul:player.meleeRangeMul')>=0&&blk.indexOf('rangedRangeMul:player.rangedRangeMul')>=0);
});

/* ================= 4. ITEM IDENTITY / PRICE PASS ================= */
const U=id=>T.UPGRADES.find(u=>u.id===id);
ok('FIX-4: 19 upgrades; catálogo não inflado; ids intactos',()=>{
  assert.strictEqual(T.UPGRADES.length,19);
  for(const id of ['crit','critd','rate','hp','range','magnet','dmg','dash','aoe','range2','pierce','critx','vamp','sprint','dmg2','rate2','pierce2','omni','singul'])assert.ok(U(id),id);
});
ok('FIX-4: critx deixa de dominar crit+critd (valor por crédito) e continua forte por slot',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);const c0=p.crit,m0=p.critMul;
  U('critx').apply(p);
  assert.ok(near(p.crit,c0+.14));assert.ok(near(p.critMul,m0+.45));
  assert.strictEqual(U('critx').price,46);assert.strictEqual(U('critd').price,14);
  const parPreco=U('crit').price+U('critd').price;               // 30 por (8%, +35%)
  const parValor=.08+.35/4, cxValor=.14+.45/4;                   // escala comum: 1% crit ≈ 4% crit dmg
  assert.ok(cxValor/U('critx').price<parValor/parPreco*1.05,'critx não é melhor por crédito que o par');
  assert.ok(cxValor>parValor,'mas é melhor por slot (raro deve valer o slot)');
  assert.ok(U('critx').desc.indexOf('+45% DANO CRÍTICO')>=0,'descrição bate');
});
ok('FIX-4: dmg2/rate2 recalibrados (por crédito ≤ versão comum; por slot >)',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);
  U('dmg2').apply(p);assert.ok(near(p.dmgMul,1.28));
  U('rate2').apply(p);assert.ok(near(p.fireRateMul,1.26));
  assert.strictEqual(U('dmg2').price,58);assert.strictEqual(U('rate2').price,56);
  assert.ok(.28/58<=.14/22,'dmg2 não domina dmg por crédito');
  assert.ok(.26/56<=.12/18,'rate2 não domina rate por crédito');
  assert.ok(U('dmg2').desc.indexOf('+28%')>=0&&U('rate2').desc.indexOf('+26%')>=0);
});
ok('FIX-4: singul virou canhão de vidro móvel (−12% vida máx.) e omni paga a universalidade',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);const hp0=p.maxHp;p.hp=p.maxHp;
  U('singul').apply(p);
  assert.ok(near(p.dmgMul,1.45));assert.ok(near(p.maxHp,Math.round(hp0*.88)));
  assert.ok(p.hp<=p.maxHp,'hp clampado');
  assert.strictEqual(U('singul').price,100);assert.strictEqual(U('omni').price,110);
  assert.ok(U('singul').desc.indexOf('−12% VIDA MÁXIMA')>=0);
  const q=T.makePlayer(0,true);T.setPlayer(q);q.maxHp=30;q.hp=30;U('singul').apply(q);
  assert.strictEqual(q.maxHp,30,'piso de 30 HP');
});
ok('FIX-4: pierce2 (nicho) mais barato; itens simples saudáveis intactos',()=>{
  assert.strictEqual(U('pierce2').price,50);
  for(const [id,pr] of [['crit',16],['rate',18],['hp',18],['range',15],['magnet',12],['dmg',22],['dash',16],['aoe',20],['range2',24],['pierce',28],['vamp',32],['sprint',30]])
    assert.strictEqual(U(id).price,pr,id+' preço preservado');
  const p=T.makePlayer(0,true);T.setPlayer(p);U('dmg').apply(p);assert.ok(near(p.dmgMul,1.14),'dmg simples intacto');
});
ok('FIX-4: descrições dos módulos econômicos dizem UPGRADES/MÓDULOS (surcharge não afeta armas/reparo)',()=>{
  for(const id of ['iman','usura','eco_risco','eco_divida','trans_temporal']){
    const it=T.itemById(id);assert.ok(it.desc.indexOf('UPGRADES/MÓDULOS +')>=0,id);
    assert.ok(it.desc.indexOf('LOJA +')<0,id+' sem texto ambíguo');
  }
  const p=freshRun();T.setWave(5);const wi=T.shopWeaponPool()[0];
  const w0=X('priceWeapon('+wi+')'),r0=T.repairCost();
  p.shopSurcharge=1.6;
  assert.strictEqual(X('priceWeapon('+wi+')'),w0,'arma não sofre surcharge');
  assert.strictEqual(T.repairCost(),r0,'reparo não sofre surcharge');
});

/* ================= 5. ECONOMIA ================= */
ok('FIX-5: mercado da Ganância moderado (máx ×1.238) e neutro ×1',()=>{
  freshRun();const m=T.getMoral();m.greed=0;T.applyMoral();
  assert.ok(near(T.moralMarketMul(),1));
  m.greed=10;T.applyMoral();
  assert.ok(near(T.moralMarketMul(),1+T.MORAL_MARKET_K*1.7));
  assert.ok(T.moralMarketMul()<1.25&&T.moralMarketMul()>1.15);
  m.greed=0;T.applyMoral();
});
ok('FIX-5: surcharge dos módulos econômicos tem teto (5 módulos não passam de ×1.6 no preço)',()=>{
  const p=freshRun();p.shopSurcharge=1;
  for(const id of ['iman','usura','eco_risco','eco_divida','trans_temporal'])T.itemById(id).apply(p);
  assert.ok(p.shopSurcharge>2,'produto cru > 2 ('+p.shopSurcharge.toFixed(2)+')');
  assert.ok(near(T.shopSurchargeMul(p),T.SHOP_SURCHARGE_CAP),'preço usa o teto');
  T.setWave(3);const u=U('dmg');
  const capped=T.priceUpg(u);p.shopSurcharge=T.SHOP_SURCHARGE_CAP;
  assert.strictEqual(T.priceUpg(u),capped,'preço idêntico ao teto');
  p.shopSurcharge=.5;assert.ok(near(T.shopSurchargeMul(p),1),'nunca desconta');
});
ok('FIX-5: guardrails — cap de renda, preço por onda e reroll por onda preservados do B3',()=>{
  assert.ok(near(T.incomeCoinCap(2),2)&&T.incomeCoinCap(13.7)<4);
  freshRun();T.setWave(1);const a=T.shopWaveMul();T.setWave(20);const b=T.shopWaveMul();
  assert.ok(a===1&&near(b,1.95));
  T.setWave(1);assert.strictEqual(T.rerollBaseCost(),11);T.setWave(20);assert.strictEqual(T.rerollBaseCost(),30);
});
ok('FIX-5: simulação curta — Greed (moral 10 + iman+usura) compra ≥ Neutral e ganha claramente mais',()=>{
  /* versão compacta do economy_sim (N=120, 20 ondas); o holdout completo fica no relatório */
  const coinByType={chaser:2,swarm:2,orbiter:2,shooter:4,bulwark:2,tank:9,anomaly:2,spawner:2,splitter:2,phantom:2,singular:2};
  function income(w,mul){let k=0,c=0;const cp=T.waveComp(w);for(const t of T.WAVE_KEYS){const n=Math.max(0,Math.round(cp[t]||0));if(n&&coinByType[t]){k+=n;c+=n*coinByType[t];}}c+=k*.35;if(T.MINI_WAVES.indexOf(w)>=0)c+=120;return Math.round(c*mul);}
  function sim(greed,mods,ev,seed){
    sandbox.Math.random=seedRng(seed);let earned=0,buys=0,rr=0;const N=120;
    for(let r=0;r<N;r++){
      T.resetShopVars();const p=T.makePlayer(0,true);T.setPlayer(p);p.coins=25;p.items=[];
      T.setMoral({comp:0,greed,viol:0});T.applyMoral();
      for(let w=1;w<=20;w++){
        const mi=[1,3,5,8,10].indexOf(w);if(mi>=0&&mods[mi]){T.itemById(mods[mi]).apply(p);T.applyMoralTuning(p);}
        const inc=25+income(w,T.incomeCoinCap((p.coinMul||1)*T.mEff.coinMul))+Math.round(ev*T.mEff.coinMul);
        p.coins+=inc;earned+=inc;T.setWave(w);T.rollShop();
        const offers=T.getShopOffers().map(u=>({id:u.id,c:T.priceUpg(u)})).concat(T.getShopItems().map(i=>({id:i.id,c:T.priceItem(i)}))).sort((a,b)=>a.c-b.c);
        for(const o of offers){if(p.coins>=o.c){p.coins-=o.c;buys++;T.shopMarkBought(o.id);}}
        const rc=Math.round(T.rerollBaseCost()*T.mEff.rerollMul);if(p.coins>=rc){p.coins-=rc;rr++;T.rollShop();}
      }
    }
    return {earned:earned/N,buys:buys/N,rr:rr/N};
  }
  const A=sim(0,[],50,101),C2=sim(10,['iman','usura'],80,202);
  assert.ok(C2.earned/A.earned>1.8&&C2.earned/A.earned<4,'Greed ganha claramente mais ('+(C2.earned/A.earned).toFixed(2)+'×) sem runaway');
  assert.ok(C2.buys/A.buys>=.98,'Greed compra pelo menos tanto quanto Neutral ('+(C2.buys/A.buys).toFixed(2)+'×)');
  assert.ok(C2.rr/A.rr>=.98,'Greed rerolla pelo menos tanto ('+(C2.rr/A.rr).toFixed(2)+'×)');
  sandbox.Math.random=Math.random;T.setMoral({comp:0,greed:0,viol:0});T.applyMoral();
});

/* ================= 6. ESCASSEZ ================= */
ok('FIX-6: ESCASSEZ — desconto do 1º reroll é proporcional (piso 7), não fixo em 7',()=>{
  const f=X('fractureShopRerollCost');
  const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
  assert.ok(html.indexOf('const FRACTURE_SCAR_REROLL_K=.70;')>=0);
  /* sem tema ativo: valor intacto */
  assert.strictEqual(f(30),30);
  /* fórmula do desconto (unidade): 10→7, 20→14, 30→21 */
  const disc=v=>Math.max(1,Math.min(v,Math.max(7,Math.round(v*.70))));
  assert.strictEqual(disc(10),7);assert.strictEqual(disc(11),8);assert.strictEqual(disc(20),14);assert.strictEqual(disc(30),21);
  assert.ok(html.indexOf('Math.max(FRACTURE_SCAR_REROLL,Math.round(v*FRACTURE_SCAR_REROLL_K))')>=0,'código usa a fórmula');
});

/* ================= 7. SANDBOX ================= */
ok('FIX-7: sair do Sandbox limpa shopRecent/ofertas (sem estado stale) e o save real fica byte-a-byte',()=>{
  for(const s of [1,2]){T.activateSlot(s);freshRun();T.setWave(2+s);T.rollShop();X('renderShop=function(){}');T.setState('shop');T.captureCheckpoint('loja',3+s);T.setState('title');}
  X('sandboxRun=false;sandboxMode=false;');
  const snap=sandbox.localStorage.getItem('echoSave.v3');
  X('sandboxOpenSetup();sandboxCfg.char=0;');assert.strictEqual(X('sandboxStart()'),true);
  T.setWave(9);T.rollShop();T.rollShop();assert.ok(T.getShopRecent().length>0);
  X('sandboxExit(true)');
  assert.strictEqual(T.getShopRecent().length,0,'histórico limpo');
  assert.strictEqual(T.getShopOffers().length,0,'ofertas limpas');
  assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),snap,'byte-a-byte');
  T.activateSlot(2);T.resumeRun();
  assert.strictEqual(T.getShopRecent().length,X('smRoot').slots[2].run.p.shopRecent.length,'Continue reconstrói do slot');
});
ok('FIX-7: sandboxRestart/EndToSetup também zeram o histórico',()=>{
  X('sandboxRun=false;sandboxMode=false;sandboxOpenSetup();sandboxCfg.char=0;sandboxStart();');
  T.setWave(4);T.rollShop();assert.ok(T.getShopRecent().length>0);
  X('sandboxClearRunState()');
  assert.strictEqual(T.getShopRecent().length,0);
  X('sandboxExit(true)');
});

if(failed)console.log('\n'+failed+' FALHAS');else console.log('\n'+passed+' PASSARAM · 0 FALHAS');
process.exit(failed?1:0);
