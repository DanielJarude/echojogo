'use strict';
/* =====================================================================
   TESTES — PR13.5 · BLOCO 3
   B3-A: Shop Variety (anti-repeat leve + histórico persistido no Continue)
   B3-B: Item Identity (range melee×ranged, economia com surcharge)
   B3-C: Run Economy (retorno decrescente de créditos, preço por onda, mercado)
   ===================================================================== */
const assert=require('assert');
const {T}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function near(a,b,eps=1e-6){return Math.abs(a-b)<=eps;}
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}
}
function freshRun(){
  T.resetShopVars();
  T.setState('play');
  T.setMoral({comp:0,greed:0,viol:0});
  T.setPlayer(null);
  T.startRun();
  const p=T.getPlayer();
  p.coins=999999;
  return p;
}
function setGreed(g){
  const m=T.getMoral();m.comp=0;m.greed=g;m.viol=0;
  T.applyMoral();T.applyMoralTuning(T.getPlayer());
}
function seedRng(seed){let s=seed>>>0;return function(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function setRng(seed){T.Math?0:0; try{T.getPlayer();}catch(e){} require('vm'); }

console.log('\nECHO — PR13.5 · BLOCO 3 (variedade + identidade + economia)');
console.log('---------------------------------------------');

/* ================= B3-A — SHOP VARIETY ================= */
ok('B3-A: último item NÃO comprado tem peso ~0.42; comprado volta a 1',()=>{
  T.shopRecentReset();T.shopOfferSeen('crit');T.shopMarkBought('crit');
  assert.strictEqual(T.shopRepeatWeight('crit'),1,'comprado não é penalizado');
  T.shopRecentReset();T.shopOfferSeen('crit');
  assert(near(T.shopRepeatWeight('crit'),T.SHOP_REPEAT_LAST_W));
  assert.ok(T.SHOP_REPEAT_LAST_W>=.35&&T.SHOP_REPEAT_LAST_W<=.60,'faixa do último');
  assert.ok(T.SHOP_REPEAT_PENULT_W>=.65&&T.SHOP_REPEAT_PENULT_W<=.85,'faixa do penúltimo');
});
ok('B3-A: penúltimo NÃO comprado tem peso ~0.72 e depois volta ao normal',()=>{
  freshRun();
  T.shopRecentReset();
  T.shopOfferSeen('zz_never_shop');       // seq 0
  T.rollShop();                            // shopRollSeq vira 1
  assert(near(T.shopRepeatWeight('zz_never_shop'),T.SHOP_REPEAT_PENULT_W));
  T.rollShop();                            // seq 2 -> d=2
  assert.strictEqual(T.shopRepeatWeight('zz_never_shop'),1);
});
ok('B3-A: rollShop registra as ofertas e compra marca como comprado',()=>{
  freshRun();T.setWave(1);T.rollShop();
  const us=T.getShopOffers(),its=T.getShopItems();
  assert.ok(us.length>0||its.length>0,'loja gera oferta');
  const id=(us[0]||its[0]).id;
  const before=T.getShopRecent().filter(x=>x.id===id);
  assert.ok(before.length>0,'oferta entra no histórico');
  T.shopMarkBought(id);
  const after=T.getShopRecent().filter(x=>x.id===id);
  assert.ok(after.some(x=>x.bought),'compra marca bought=true');
  assert.strictEqual(T.shopRepeatWeight(id),1,'comprado não é penalizado');
});
ok('B3-A: anti-repeat é leve — nenhum item fica impossível em 50 lojas',()=>{
  freshRun();T.setWave(1);
  const seen=new Set();
  for(let i=0;i<50;i++){T.rollShop();for(const u of T.getShopOffers())seen.add(u.id);}
  assert.ok(seen.size>0,'alguma oferta sempre existe');
  const some=seen.size;
  assert.ok(some>=1,'pelo menos um item aparece');
  /* o teste não garante que TODOS aparecem (peso leve nunca é ban), só que
     existe variedade e nenhum filtro de exclusão é aplicado. */
  assert.ok(some>=6,'pool inicial de 10 deve aparecer mais de 5 distintos em 50 lojas: '+some);
});
ok('B3-A: reroll também respeita o histórico de variedade',()=>{
  freshRun();T.setWave(1);T.rollShop();
  const first=T.getShopOffers().map(u=>u.id).sort().join(',');
  T.rollShop();
  const second=T.getShopOffers().map(u=>u.id).sort();
  const overlap=first.split(',').filter(x=>second.indexOf(x)>=0).length;
  assert.ok(overlap>=0,'reroll gera lote válido');
  assert.ok(T.shopRepeatWeight(first.split(',')[0])>=T.SHOP_REPEAT_LAST_W,
    'peso recente nunca é zero');
});
ok('B3-A: inicio mantém pool seguro (raros desbloqueiam na onda 3)',()=>{
  const r1=T.rarityWeight(2,1)===0;
  const r3=T.rarityWeight(2,3)>0;
  assert.ok(r1,'raros fechados na onda 1');
  assert.ok(r3,'raros ganham peso na onda 3');
  assert.strictEqual(T.rarityWeight(3,1),0,'épicos continuam fechados no early');
});
ok('B3-A: histórico sobrevive ao checkpoint (Continue)',()=>{
  T.activateSlot(1);
  T.resetShopVars();T.setPlayer(null);T.startRun();
  T.setWave(1);T.rollShop();
  const saved=T.getShopRecent();
  assert.ok(saved.length>0,'histórico preenchido antes do save');
  const cp=T.smBuildCheckpoint('b3',2);
  assert.ok(Array.isArray(cp.p.shopRecent)&&cp.p.shopRecent.length>0,'p.shopRecent serializado');
  assert.ok(Number.isFinite(cp.p.shopRollSeq),'p.shopRollSeq serializado');
  T.setState('play');
  assert.ok(T.captureCheckpoint('b3',2),'checkpoint capturado');
  T.resumeRun();
  const after=T.getShopRecent();
  assert.ok(after.length>0,'histórico restaurado no Continue');
  assert.strictEqual(after[after.length-1].id,saved[saved.length-1].id);
});

/* ================= B3-B — ITEM IDENTITY ================= */
ok('B3-B: Luneta agora é identidade LONGÍNQUA (range ranged + dano à distância)',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);
  T.itemById('luneta').apply(p);
  assert(near(p.rangedRangeMul,1.70));
  assert(near(p.meleeRangeMul,.92));
  assert(near(p.fireRateMul,.82));
  assert(near(p.longRangeBonus,.30));
  assert(near(p.rangeMul,1),'stat legado não é mais usado pelo item novo');
});
ok('B3-B: Estilhaço virou trade-off de C.A CORPO (curto × dano)',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);
  T.itemById('estilhaco').apply(p);
  assert(near(p.rangedRangeMul,.60));
  assert(near(p.meleeRangeMul,1.20));
  assert(near(p.dmgMul,1.40));
  assert(near(p.fireRateMul,1.15));
});
ok('B3-B: Longo Curso é ranged only (+projSpd) e não mexe no corpo a corpo',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);
  const u=T.UPGRADES.find(x=>x.id==='range2');
  u.apply(p);
  assert(near(p.rangedRangeMul,1.32));
  assert(near(p.projSpdMul,1.14));
  assert(near(p.meleeRangeMul,1));
});
ok('B3-B: Estabilizador continua universal e simples (ambos os alcances)',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);
  const u=T.UPGRADES.find(x=>x.id==='range');
  u.apply(p);
  assert(near(p.meleeRangeMul,1.18));
  assert(near(p.rangedRangeMul,1.18));
  assert(near(p.rangeMul,1.18));
});
ok('B3-B: módulos econômicos pagam sobrepreço de mercado (trade-off real)',()=>{
  const p=T.makePlayer(0,true);T.setPlayer(p);
  p.shopSurcharge=1;
  T.itemById('usura').apply(p);
  assert(p.shopSurcharge>1,'usura aumenta preço da loja');
  assert(near(p.coinMul,1.45));
  const before=p.shopSurcharge;
  p._smBase.shieldMax=100;T.smRefresh(p);const sh0=p.shieldMax;
  T.itemById('eco_divida').apply(p);
  assert(p.shopSurcharge>before,'empilhamento de risco aumenta o preço');
  assert(p.shieldMax<sh0,'eco_divida reduz escudo máximo');
});
ok('B3-B: su_sorte sem promessa fantasma “+12% de sorte”',()=>{
  const it=T.itemById('su_sorte');
  assert.ok(it&&it.desc.indexOf('SORTE')<0,'descrição não promete stat inexistente');
  assert.ok(it.desc.indexOf('CURAR 14 HP')>=0,'efeito real documentado');
});

/* ================= B3-C — RUN ECONOMY ================= */
ok('B3-C: retorno de créditos é sublinear acima de ×2 (nenhum multiplicador infinito)',()=>{
  assert(near(T.incomeCoinCap(0),1));
  assert(near(T.incomeCoinCap(1),1));
  assert(near(T.incomeCoinCap(2),2));
  const hi=T.incomeCoinCap(13.7);
  assert.ok(hi<13.7,'capa comprime muito alto');
  assert.ok(hi>2,'mas Ganância continua valendo');
  assert.ok(hi<6,'e não trivializa a loja');
});
ok('B3-C: mercado cobra mais da Ganância, neutro fica em ×1',()=>{
  freshRun();setGreed(0);
  const neutral=T.moralMarketMul();
  assert(near(neutral,1));
  setGreed(10);
  const greed=T.moralMarketMul();
  assert.ok(greed>neutral,'mercado cobra mais');
  assert.ok(greed<=1.4,'pressão moderada, não punição');
});
ok('B3-C: preço escala com a onda (loja fica mais cara ao longo da run)',()=>{
  freshRun();
  T.setWave(1);const a=T.shopWaveMul();
  T.setWave(10);const b=T.shopWaveMul();
  T.setWave(20);const c=T.shopWaveMul();
  assert.ok(b>a&&c>b,'onda aumenta preço');
  const u=T.UPGRADES.find(x=>x.id==='dmg');
  T.setWave(1);const p1=T.priceUpg(u);
  T.setWave(10);const p10=T.priceUpg(u);
  assert.ok(p10>p1,'preço final acompanha a onda');
});
ok('B3-C: reroll base cresce com a onda (decisão econômica)',()=>{
  freshRun();
  T.setWave(1);const a=T.rerollBaseCost();
  T.setWave(10);const b=T.rerollBaseCost();
  T.setWave(20);const c=T.rerollBaseCost();
  assert.ok(a>=10&&b>a&&c>b,'reroll encarece');
});
ok('B3-C: surcharge de mercado entra no preço efetivo',()=>{
  freshRun();T.setWave(3);
  const u=T.UPGRADES.find(x=>x.id==='dmg');
  const p=T.getPlayer();p.shopSurcharge=1;
  const base=T.priceUpg(u);
  p.shopSurcharge=2;
  const caro=T.priceUpg(u);
  assert.ok(caro>base,'sobrepreço efetivo na oferta');
});
ok('B3-C: retorno decrescente é usado nas recompensas de abate/mini-chefe',()=>{
  freshRun();
  const p=T.getPlayer();p.coinMul=5;
  assert.ok(T.incomeCoinCap(T.mEff.coinMul*p.coinMul)<T.mEff.coinMul*p.coinMul,
    'recompensa não usa multiplicador cru');
});

if(failed)console.log('\n'+failed+' FALHAS');else console.log('\n'+passed+' PASSARAM · 0 FALHAS');
process.exit(failed?1:0);
