'use strict';
/* Holdout econômico: seeds independentes; métricas decisionais formais.
   CAN_BUY_ALL     = coins_ao_abrir >= soma dos preços das 5 ofertas (3 upgrades + 2 módulos)
   CAN_BUY_NOTHING = coins_ao_abrir <  menor preço entre as 5 ofertas
   MEANINGFUL      = !CAN_BUY_ALL && !CAN_BUY_NOTHING && (#ofertas acessíveis >= 2)
   (armas ficam fora, como no economy_sim original) */
const ROOT=process.argv[2];const SEED=+(process.argv[3]||424242);const N=+(process.argv[4]||1000);
const {sandbox,T}=require(ROOT+'/audit_pr135/harness.js');
function seedRng(seed){let s=seed>>>0;return function(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const coinByType={chaser:2,swarm:2,orbiter:2,shooter:4,bulwark:2,tank:9,anomaly:2,spawner:2,splitter:2,phantom:2,singular:2};
const cap=x=>typeof T.incomeCoinCap==='function'?T.incomeCoinCap(x):x;
function killIncome(w,mul){let kills=0,coins=0;const c=T.waveComp(w);for(const t of T.WAVE_KEYS){const n=Math.max(0,Math.round(c[t]||0));if(n&&coinByType[t]){kills+=n;coins+=n*coinByType[t];}}coins+=kills*.35;if(T.MINI_WAVES.indexOf(w)>=0)coins+=120;return Math.round(coins*mul);}
const PROFILES={
  A:{greed:0,mods:[],ev:50},
  B:{greed:4,mods:['iman'],ev:60},
  C:{greed:10,mods:['iman','usura','eco_risco','eco_divida','trans_temporal'],ev:80},
  C2:{greed:10,mods:['iman','usura'],ev:80},   // Greed "realista": consumido + 2 módulos
};
function mk(pr){const p=T.makePlayer(0,true);T.setPlayer(p);p.coins=25;p.items=[];p.upgLog=[];T.setMoral({comp:0,greed:pr.greed,viol:0});T.applyMoral();
  /* módulos entram progressivamente (onda 1, 3, 5, 8, 10) para não distorcer o early */
  return p;}
const out={};
for(const name of Object.keys(PROFILES)){
  const pr=PROFILES[name];sandbox.Math.random=seedRng(SEED+name.charCodeAt(0)*31+(name.length));
  const rows={};let tot={earned:0,spend:0,buy:0,rr:0,all:0,none:0,mean:0,shops:0};
  for(let r=0;r<N;r++){
    const p=mk(pr);if(T.resetShopVars)T.resetShopVars();
    const modWave=[1,3,5,8,10];
    for(let w=1;w<=20;w++){
      const mi=modWave.indexOf(w);if(mi>=0&&pr.mods[mi]){T.itemById(pr.mods[mi]).apply(p);T.applyMoralTuning(p);}
      const km=(p.coinMul||1)*T.mEff.coinMul;
      const ki=killIncome(w,cap(km));const ev=Math.round(pr.ev*T.mEff.coinMul);
      p.coins+=25+ki+ev;tot.earned+=25+ki+ev;
      T.setWave(w);T.rollShop();
      const offers=T.getShopOffers().map(u=>({id:u.id,c:T.priceUpg(u)})).concat(T.getShopItems().map(i=>({id:i.id,c:T.priceItem(i)})));
      const prices=offers.map(o=>o.c);const total=prices.reduce((a,b)=>a+b,0);const min=Math.min(...prices);
      const afford=offers.filter(o=>o.c<=p.coins).length;
      const canAll=p.coins>=total,canNone=p.coins<min,meaningful=!canAll&&!canNone&&afford>=2;
      const before=p.coins;let bought=0;
      for(const o of [...offers].sort((a,b)=>a.c-b.c)){if(p.coins>=o.c){p.coins-=o.c;bought++;if(T.shopMarkBought)T.shopMarkBought(o.id);}}
      const rc=Math.round((T.rerollBaseCost?T.rerollBaseCost():10)*T.mEff.rerollMul);let rr=0;
      if(p.coins>=rc){p.coins-=rc;rr=1;T.rollShop();}
      const row=rows[w]||(rows[w]={n:0,coins:0,all:0,none:0,mean:0,buy:0,rr:0,left:0,total:0,afford:0,rc:0});
      row.n++;row.coins+=before;row.all+=canAll;row.none+=canNone;row.mean+=meaningful;row.buy+=bought;row.rr+=rr;row.left+=p.coins;row.total+=total;row.afford+=afford;row.rc+=rc;
      tot.spend+=before-p.coins;tot.buy+=bought;tot.rr+=rr;tot.all+=canAll;tot.none+=canNone;tot.mean+=meaningful;tot.shops++;
    }
    tot.final=(tot.final||0)+p.coins;
  }
  out[name]={earned:tot.earned/N,spend:tot.spend/N,final:tot.final/N,buy:tot.buy/N,rr:tot.rr/N,all:tot.all/tot.shops*100,none:tot.none/tot.shops*100,mean:tot.mean/tot.shops*100,rows};
  console.log(`\n## ${name} (greed=${pr.greed}, mods=${pr.mods.join('+')||'-'}) N=${N} seed=${SEED}`);
  console.log(` earned/run=${out[name].earned.toFixed(0)} spend=${out[name].spend.toFixed(0)} saldoFinal=${out[name].final.toFixed(0)} compras=${out[name].buy.toFixed(1)} rerolls=${out[name].rr.toFixed(1)} | CAN_ALL=${out[name].all.toFixed(1)}% CAN_NONE=${out[name].none.toFixed(1)}% MEANINGFUL=${out[name].mean.toFixed(1)}%`);
  for(const w of [1,2,3,5,8,10,12,15,18,20]){const r=rows[w];console.log(`  w${String(w).padStart(2)} coins=${(r.coins/r.n).toFixed(0).padStart(5)} custoLoja=${(r.total/r.n).toFixed(0).padStart(5)} reroll=${(r.rc/r.n).toFixed(0).padStart(3)} acessíveis=${(r.afford/r.n).toFixed(1)} all=${(r.all/r.n*100).toFixed(0).padStart(3)}% none=${(r.none/r.n*100).toFixed(0).padStart(3)}% meaningful=${(r.mean/r.n*100).toFixed(0).padStart(3)}% compras=${(r.buy/r.n).toFixed(1)} rr=${(r.rr/r.n).toFixed(1)} saldo=${(r.left/r.n).toFixed(0)}`);}
}
const g=(k,a,b)=>(out[a][k]/out[b][k]).toFixed(2);
console.log(`\nRAZÕES C/A: earned=${g('earned','C','A')} spend=${g('spend','C','A')} saldoFinal=${g('final','C','A')} compras=${g('buy','C','A')} rerolls=${g('rr','C','A')}`);
console.log(`RAZÕES C2/A: earned=${g('earned','C2','A')} spend=${g('spend','C2','A')} saldoFinal=${g('final','C2','A')} compras=${g('buy','C2','A')} rerolls=${g('rr','C2','A')}`);
console.log(`RAZÕES B/A: earned=${g('earned','B','A')} spend=${g('spend','B','A')} compras=${g('buy','B','A')}`);
