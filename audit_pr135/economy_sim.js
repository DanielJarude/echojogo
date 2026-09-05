'use strict';
const {sandbox,T}=require('./harness');
function seedRng(seed){let s=seed>>>0;return function(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function setRng(seed){sandbox.Math.random=seedRng(seed);}
const coinByType={chaser:2,swarm:2,orbiter:2,shooter:4,bulwark:2,tank:9,anomaly:2,spawner:2,splitter:2,phantom:2,singular:2};
function killIncome(w,coinMul){
  let kills=0,coins=0;const c=T.waveComp(w);
  for(const t of T.WAVE_KEYS){const n=Math.max(0,Math.round(c[t]||0));if(n&&coinByType[t]){kills+=n;coins+=n*coinByType[t];}}
  coins+=kills*0.35;if(T.MINI_WAVES.indexOf(w)>=0)coins+=120;
  return {kills,coins:Math.round(coins*coinMul)};
}
function makeProfile(name){
  const p=T.makePlayer(0,true);T.setPlayer(p);p.coins=25;p.items=[];p.upgLog=[];T.setMoral({comp:0,greed:0,viol:0});
  if(name==='B'){T.setMoral({comp:0,greed:4,viol:0});}
  else if(name==='C'){T.setMoral({comp:0,greed:10,viol:0});for(const mid of ['iman','usura','eco_risco','eco_divida','trans_temporal']){const it=T.itemById(mid);if(it)it.apply(p);}}
  T.applyMoral();T.applyMoralTuning(p);return p;
}

const N=500;
const names=['A','B','C'];
for(const name of names){
  setRng(name==='A'?111:(name==='B'?222:333));
  const rows={};let cumKill=0,cumCoinKill=0,cumEvent=0,cumBought=0,cumReroll=0;
  for(let r=0;r<N;r++){
    const p=makeProfile(name);
    T.resetShopVars();
    for(let w=1;w<=20;w++){
      p.coins+=25; // renda de início/pacote mínimo da run
      const km=(p.coinMul||1)*T.mEff.coinMul;
      const ki=killIncome(w,typeof T.incomeCoinCap==='function'?T.incomeCoinCap(km):km);
      p.coins+=ki.coins;cumKill+=ki.kills;cumCoinKill+=ki.coins;
      const evBase=(name==='C'?80:name==='B'?60:50)*(name==='C'?1.5:name==='B'?1.2:1);
      const ev=Math.round(evBase*T.mEff.coinMul);
      p.coins+=ev;cumEvent+=ev;
      T.setWave(w);T.rollShop();
      const offs=T.getShopOffers(),its=T.getShopItems();
      const buyble=offs.map(u=>({k:'u',id:u.id,c:T.priceUpg(u)})).concat(its.map(it=>({k:'i',id:it.id,c:T.priceItem(it)})));
      const prices=buyble.map(x=>x.c);
      const cheapest=prices.length?Math.min(...prices):0;
      const sorted=[...prices].sort((a,b)=>a-b);
      const median=sorted[Math.floor(sorted.length/2)]||0;
      const totalCost=prices.reduce((a,b)=>a+b,0);
      const canAll=totalCost<=p.coins;
      const individually=buyble.filter(x=>x.c<=p.coins).length;
      const beforeBuy=p.coins;
      let bought=0;
      const byPrice=[...buyble].sort((a,b)=>a.c-b.c);
      for(const b of byPrice){
        if(p.coins>=b.c){
          p.coins-=b.c;bought++;
          if(b.k==='i'&&p.items.indexOf(b.id)<0)p.items.push(b.id);
          if(typeof T.shopMarkBought==='function')T.shopMarkBought(b.id);
        }
      }
      const spendBuy=beforeBuy-p.coins;
      const rc=typeof T.rerollBaseCost==='function'?T.rerollBaseCost():10;
      const rCost=Math.round(rc*T.mEff.rerollMul);
      let rerolls=0,rerollSpent=0;
      if(p.coins>=rCost){p.coins-=rCost;rerolls=1;rerollSpent=rCost;if(typeof T.rollShop==='function')T.rollShop();}
      const after=p.coins;
      cumBought+=bought;cumReroll+=rerolls;
      if(!rows[w])rows[w]={n:0,coinsAt:0,post:0,indiv:0,canAll:0,total:0,avg:0,median:0,cheap:0,max:0,spentBuy:0,spentReroll:0,bought:0,rerolls:0,kill:0,ev:0,offers:0,killIncome:0};
      const row=rows[w];row.n++;row.coinsAt+=beforeBuy;row.post+=after;row.indiv+=individually;row.canAll+=canAll?1:0;row.total+=totalCost;row.avg+=prices.reduce((a,b)=>a+b,0)/Math.max(1,buyble.length);row.median+=median;row.cheap+=cheapest;row.max+=Math.max(0,...prices);row.spentBuy+=spendBuy;row.spentReroll+=rerollSpent;row.bought+=bought;row.rerolls+=rerolls;row.kill+=ki.kills;row.ev+=ev;row.offers+=buyble.length;row.killIncome+=ki.coins;
    }
  }
  console.log('\n### PERFIL '+name+' · '+N+' runs, eventos incluídos, compra agressiva + 1 reroll se couber ###');
  console.log('cumKill='+Math.round(cumKill/N)+' cumKillIncome='+Math.round(cumCoinKill/N)+' cumEvent='+Math.round(cumEvent/N)+' buys='+(cumBought/N).toFixed(1)+' rerolls='+(cumReroll/N).toFixed(1));
  for(const w of [1,3,5,8,10,12,15,18,20]){
    if(!rows[w])continue;const r=rows[w];
    console.log('wave='+w+' coinsAt='+Math.round(r.coinsAt/r.n)+' post='+Math.round(r.post/r.n)+' offers='+(r.offers/r.n).toFixed(1)+' indiv='+(r.indiv/r.n).toFixed(1)+' canTotalPct='+(r.canAll/r.n*100).toFixed(1)+' totalCost='+(r.total/r.n).toFixed(0)+' avg='+(r.avg/r.n).toFixed(1)+' med='+(r.median/r.n).toFixed(1)+' cheap='+(r.cheap/r.n).toFixed(1)+' max='+(r.max/r.n).toFixed(1)+' spentBuy='+(r.spentBuy/r.n).toFixed(1)+' spentReroll='+(r.spentReroll/r.n).toFixed(1)+' bought='+(r.bought/r.n).toFixed(1)+' rerolls='+(r.rerolls/r.n).toFixed(1)+' kill='+Math.round(r.kill/r.n)+' killIncome='+Math.round(r.killIncome/r.n)+' ev='+Math.round(r.ev/r.n));
  }
}
