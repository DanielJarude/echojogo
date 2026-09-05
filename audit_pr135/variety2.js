'use strict';
const {sandbox,T}=require('./harness');
function seedRng(seed){let s=seed>>>0;return function(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function setRng(seed){sandbox.Math.random=seedRng(seed);}
function fresh(){T.resetShopVars();const p=T.makePlayer(0,true);p.coins=999999;T.setPlayer(p);T.setWave(1);T.setMoral({comp:0,greed:0,viol:0});T.applyMoralTuning(p);return p;}
const UPGS=T.UPGRADES.map(u=>u.id), ITMS=T.ITEMS.map(i=>i.id), GUNS=T.WEAPONS.map(w=>w.id);
const off=(id)=>T.UPGRADES.find(x=>x.id===id), iof=(id)=>T.itemById(id);
function pLet(item,total,N){return total/N;} // per-shop prob estimate
// At-least-once over k shops for per-item probabilities at a fixed scenario
function onceIn(p,k){return 1-Math.pow(1-p,k);}
console.log('### AT LEAST ONCE (upgrades) ###');
for(const [name,w,m] of [['inicio',1,{comp:0,greed:0,viol:0}],['mid',8,{comp:0,greed:0,viol:0}],['late',16,{comp:0,greed:0,viol:0}]]){
  setRng((w*7919+7)>>>0);const counts={};let total=0;
  for(let i=0;i<10000;i++){fresh();T.setWave(w);T.rollShop();for(const u of T.getShopOffers()){counts[u.id]=(counts[u.id]||0)+1;total++;}}
  const freq=Object.entries(counts).map(([id,n])=>[id,(n/total)]).sort((a,b)=>b[1]-a[1]);
  const top=freq.slice(0,3),bot=freq.slice(-3);
  console.log('scenario='+name,'p_top=',top.map(x=>x[0]+':'+(x[1]*100).toFixed(2)+'%').join(' '),'once10_top=',top.map(x=>x[0]+':'+(onceIn(x[1],10)*100).toFixed(1)+'%').join(' '));
  console.log('           ','p_bot=',bot.map(x=>x[0]+':'+(x[1]*100).toFixed(2)+'%').join(' '),'once10_bot=',bot.map(x=>x[0]+':'+(onceIn(x[1],10)*100).toFixed(1)+'%').join(' '));
}
// Module consecutive repetition in a run with NO module purchases (worst case) and with purchases
console.log('\n### MÓDULOS — REPETIÇÃO CONSECUTIVA (1000 runs) ###');
for(const buyMode of ['none','all_affordable']){
  setRng(123456);
  let totalShops=0,a0=0,a1=0,a2=0,last=null;
  const waveDistinct={};
  for(let r=0;r<1000;r++){
    T.resetShopVars();const p=T.makePlayer(0,true);T.setPlayer(p);T.setMoral({comp:0,greed:0,viol:0});p.items=[];p.coins=99999;T.applyMoralTuning(p);
    last=null;
    for(let w=1;w<=20;w++){
      T.setWave(w);T.rollShop();
      const its=T.getShopItems().map(i=>i.id);const key=[...its].sort().join(',');
      totalShops++;
      if(!waveDistinct[w])waveDistinct[w]=new Set();
      for(const id of its)waveDistinct[w].add(id);
      if(last){const a=last.split(','),b=key.split(',');const n=a.filter(x=>b.indexOf(x)>=0).length;if(n===0)a0++;else if(n===1)a1++;else a2++;}
      last=key;
      if(buyMode==='all_affordable'){
        for(const it of T.getShopItems()){if(p.items.indexOf(it.id)<0)p.items.push(it.id);}
      }
    }
  }
  const base=totalShops-1000;
  console.log('buyMode='+buyMode,'total_shops='+totalShops,'share 0/1/2='+a0+'/'+a1+'/'+a2,'%>=1='+((base? (a1+a2)/(a0+a1+a2):0)*100).toFixed(1).replace('NaN','0'));
  console.log('  distinct modules after 1/5/10/20 = ',[[1,5,10,20].map(k=>{
     // distinct over all visited shops up to wave k
     let s=new Set();for(let w=1;w<=k;w++){if(waveDistinct[w])for(const id of waveDistinct[w])s.add(id);}return s.size;} ).join('/')]);
}
console.log('\n### ARMAS — POOL EFETIVO ###');
setRng(99);
const counts={};let total=0;
for(let i=0;i<5000;i++){fresh();T.setWave(16);T.rollShop();for(const g of T.getShopGuns()){counts[g]=(counts[g]||0)+1;total++;}}
const gfreq=Object.entries(counts).map(([id,n])=>[T.WEAPONS[id].id,n/total]).sort((a,b)=>b[1]-a[1]);
console.log('seen='+gfreq.length,'total='+T.WEAPONS.length,'top='+gfreq.slice(0,5).map(x=>x[0]+':'+(x[1]*100).toFixed(2)+'%').join(' '),'bottom='+gfreq.slice(-5).map(x=>x[0]+':'+(x[1]*100).toFixed(2)+'%').join(' '));
