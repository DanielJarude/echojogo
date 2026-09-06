'use strict';
/* Holdout de variedade: roda contra a árvore passada em argv[2]. Seeds independentes das usadas no tuning (12345/9999). */
const ROOT=process.argv[2]; const SEED=+(process.argv[3]||777001);
const {sandbox,T}=require(ROOT+'/audit_pr135/harness.js');
function seedRng(seed){let s=seed>>>0;return function(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function setRng(seed){sandbox.Math.random=seedRng(seed);}
const hasB3=!!T.shopMarkBought;
function fresh(){
  if(T.resetShopVars)T.resetShopVars(); else {T.setShopLock&&T.setShopLock(null);}
  const p=T.makePlayer(0,true);T.setPlayer(p);p.items=[];p.coins=9e6;p.upgLog=[];
  T.setMoral({comp:0,greed:0,viol:0});T.applyMoral();T.applyMoralTuning(p);return p;
}
function entropyPool(counts){let tot=0;for(const k in counts)tot+=counts[k];let H=0;for(const k in counts){const q=counts[k]/tot;if(q>0)H-=q*Math.log(q);}return Math.exp(H);}
/* 1) lojas independentes por onda: 10k lojas */
console.log('ROOT='+ROOT+' hasB3='+hasB3+' seed='+SEED);
for(const w of [1,3,5,8,16]){
  setRng(SEED+w);const cnt={},rar={};let n=0;const elig=T.UPGRADES.filter(u=>T.isUpgUnlocked(u.id)&&T.rarityWeight(u.rar||0,w)>0).length;
  for(let i=0;i<10000;i++){fresh();T.setWave(w);T.rollShop();for(const u of T.getShopOffers()){cnt[u.id]=(cnt[u.id]||0)+1;rar[u.rar||0]=(rar[u.rar||0]||0)+1;n++;}}
  const fr=Object.entries(cnt).map(([k,v])=>[k,v/n*100]).sort((a,b)=>b[1]-a[1]);
  const rtot=Object.values(rar).reduce((a,b)=>a+b,0);
  console.log(`onda ${w}: elegíveis=${elig} vistos=${fr.length} poolEfetivo(exp H)=${entropyPool(cnt).toFixed(2)} max=${fr[0][0]} ${fr[0][1].toFixed(2)}% min=${fr[fr.length-1][0]} ${fr[fr.length-1][1].toFixed(2)}% rarity=${[0,1,2,3,4].map(r=>((rar[r]||0)/rtot*100).toFixed(1)).join('/')}`);
}
/* 2) runs sequenciais 20 lojas: repeat por faixa, distintos após 5/10/20, cobertura */
for(const mode of ['none','all']){
  setRng(SEED*3+(mode==='all'?1:0));
  let rep={early:[0,0],mid:[0,0],late:[0,0],all:[0,0]},sharedSum=0;let d5=0,d10=0,d20=0,cov=0;const N=2000;
  for(let r=0;r<N;r++){const p=fresh();let last=null;const seen=new Set();
    for(let w=1;w<=20;w++){T.setWave(w);T.rollShop();const us=T.getShopOffers().map(u=>u.id);
      if(last){const n=us.filter(x=>last.indexOf(x)>=0).length;const band=w<=3?'early':(w<=10?'mid':'late');
        for(const b of [band,'all']){rep[b][0]++;if(n>0)rep[b][1]++;} sharedSum+=n;}
      last=us;us.forEach(x=>seen.add(x));
      if(w===5)d5+=seen.size;if(w===10)d10+=seen.size;if(w===20)d20+=seen.size;
      if(mode==='all'&&hasB3){for(const u of us)T.shopMarkBought(u);}
    }
    cov+=seen.size/T.UPGRADES.length;
  }
  const pct=b=>(rep[b][1]/rep[b][0]*100).toFixed(1);
  console.log(`seq[${mode}] repeat≥1: all=${pct('all')}% early(w1-3)=${pct('early')}% mid(w4-10)=${pct('mid')}% late=${pct('late')}% | média itens repetidos=${(sharedSum/rep.all[0]).toFixed(3)} | distintos 5/10/20=${(d5/N).toFixed(2)}/${(d10/N).toFixed(2)}/${(d20/N).toFixed(2)} | cobertura=${(cov/N*100).toFixed(1)}%`);
}
/* 3) reroll: mesma visita, onda 1 e onda 8 */
for(const w of [1,8]){
  setRng(SEED*7+w);let any=0,two=0,sum=0;const N=10000;
  for(let i=0;i<N;i++){fresh();T.setWave(w);T.rollShop();const a=T.getShopOffers().map(u=>u.id);T.rollShop();const b=T.getShopOffers().map(u=>u.id);const n=a.filter(x=>b.indexOf(x)>=0).length;sum+=n;if(n>0)any++;if(n>1)two++;}
  console.log(`reroll onda ${w}: ≥1 repetido=${(any/N*100).toFixed(1)}% ≥2=${(two/N*100).toFixed(1)}% média=${(sum/N).toFixed(3)}`);
}
/* 4) módulos & armas repetição consecutiva (sem compra) */
{
  setRng(SEED*11);let nI=0,rI=0,nG=0,rG=0;
  for(let r=0;r<1000;r++){fresh();let li=null,lg=null;for(let w=1;w<=20;w++){T.setWave(w);T.rollShop();const it=T.getShopItems().map(i=>i.id),g=T.getShopGuns().slice();
    if(li){nI++;if(it.some(x=>li.indexOf(x)>=0))rI++;}if(lg){nG++;if(g.some(x=>lg.indexOf(x)>=0))rG++;}li=it;lg=g;}}
  console.log(`módulos repeat≥1=${(rI/nI*100).toFixed(1)}%  armas repeat≥1=${(rG/nG*100).toFixed(1)}%`);
}
