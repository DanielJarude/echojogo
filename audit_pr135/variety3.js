'use strict';
const {sandbox,T}=require('./harness');
function seedRng(seed){let s=seed>>>0;return function(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function setRng(seed){sandbox.Math.random=seedRng(seed);}
function fresh(){
  T.resetShopVars();
  const p=T.makePlayer(0,true);T.setPlayer(p);
  p.items=[];p.coins=9999999;p.upgLog=[];
  T.setMoral({comp:0,greed:0,viol:0});T.applyMoral();T.applyMoralTuning(p);
  return p;
}
function run(mode,seed,NRUNS){
  setRng(seed);
  let lastUpg=null,lastItm=null;
  let nUpg=0,overlap0=0,overlap1=0,overlap2=0,overlap3=0;
  let nItm=0,itOverlap0=0,itOverlap1=0,itOverlap2=0;
  for(let r=0;r<(NRUNS||1000);r++){
    const p=fresh();
    lastUpg=null;lastItm=null;
    for(let w=1;w<=20;w++){
      T.setWave(w);T.rollShop();
      const us=T.getShopOffers(),its=T.getShopItems();
      const idsU=us.map(u=>u.id).sort().join(',');
      const idsI=its.map(i=>i.id).sort().join(',');
      if(lastUpg){
        const a=lastUpg.split(','),b=idsU.split(',');
        const n=a.filter(x=>b.indexOf(x)>=0).length;nUpg++;
        if(n===0)overlap0++;else if(n===1)overlap1++;else if(n===2)overlap2++;else overlap3++;
      }
      if(lastItm){
        const a=lastItm.split(','),b=idsI.split(',');
        const n=a.filter(x=>b.indexOf(x)>=0).length;nItm++;
        if(n===0)itOverlap0++;else if(n===1)itOverlap1++;else itOverlap2++;
      }
      lastUpg=idsU;lastItm=idsI;
      if(mode==='all'){
        for(const u of us){T.shopMarkBought(u.id);p.upgLog.push(u.nm);}
        for(const it of its){if(p.items.indexOf(it.id)<0){p.items.push(it.id);T.shopMarkBought(it.id);}}
      }
    }
  }
  const upgPct=(overlap1+overlap2+overlap3)/nUpg*100;
  const itmPct=(itOverlap1+itOverlap2)/nItm*100;
  return {nUpg,upgPct,upg:[+(overlap0/nUpg*100).toFixed(1),+(overlap1/nUpg*100).toFixed(1),+(overlap2/nUpg*100).toFixed(1),+(overlap3/nUpg*100).toFixed(1)],
    nItm,itmPct,itm:[+(itOverlap0/nItm*100).toFixed(1),+(itOverlap1/nItm*100).toFixed(1),+(itOverlap2/nItm*100).toFixed(1)]};
}
function rerollMemory(seed){
  setRng(seed);
  let total=0,repeat=0,repeatAny=0;
  for(let r=0;r<5000;r++){
    const p=fresh();T.setWave(1);T.rollShop();
    const first=T.getShopOffers().map(u=>u.id).sort().join(',');
    T.rollShop();
    const s2=T.getShopOffers().map(u=>u.id).sort();
    const a=first.split(',');const n=a.filter(x=>s2.indexOf(x)>=0).length;
    total++;if(n>0)repeatAny++;if(n>1)repeat++;
  }
  return {total,repeatAnyPct:+(repeatAny/total*100).toFixed(1),repeat2Pct:+(repeat/total*100).toFixed(1)};
}
console.log('### B3-A · repetição consecutiva (20 ondas, 1000 runs) ###');
console.log('MODO NENHUMA COMPRA');
console.log(JSON.stringify(run('none',12345,1000)));
console.log('MODO COMPRA TUDO (comprado ≠ penalizado)');
console.log(JSON.stringify(run('all',12345,1000)));
console.log('\\n### B3-A · reroll com memória de variedade (wave 1, 0 compras) ###');
console.log(JSON.stringify(rerollMemory(9999)));
