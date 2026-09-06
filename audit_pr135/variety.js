'use strict';
const {sandbox,T}=require('./harness');
function seedRng(seed){let s=seed>>>0;return function(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function setRng(seed){sandbox.Math.random=seedRng(seed);}
const WEAPONS_ID=T.WEAPONS.map(w=>w.id);
function fresh(moral){
  T.resetShopVars();const p=T.makePlayer(0,true);p.coins=999999;T.setPlayer(p);T.setWave(1);T.setMoral(moral||{comp:0,greed:0,viol:0});T.applyMoralTuning(p);return p;
}
function of(id){return T.UPGRADES.find(x=>x.id===id);}
function iof(id){return T.itemById(id);}
function rarWeight(o,w){return T.rarityWeight(o.rar||0,w);}
function moralWeight(it,w,moral){
  T.setMoral(moral);const p=T.getPlayer();T.applyMoralTuning(p);
  const aff=T.getItemMoralAffinity(it.id);if(!aff)return 1;
  const prof=T.getMoralProfile();const match=T.calcMoralAffinityMatch(aff,prof);
  return 1+(T.MORAL_BALANCE.shopBias||0)*T.moralTuneFactor(match);
}
function scenarios(){
  return [
   {name:'inicio',w:1,m:{comp:0,greed:0,viol:0}},
   {name:'early',w:3,m:{comp:0,greed:0,viol:0}},
   {name:'mid',w:8,m:{comp:0,greed:0,viol:0}},
   {name:'late',w:16,m:{comp:0,greed:0,viol:0}},
   {name:'greed_dom',w:8,m:{comp:0,greed:10,viol:0}},
   {name:'viol_dom',w:8,m:{comp:0,greed:0,viol:10}},
   {name:'comp_dom',w:8,m:{comp:10,greed:0,viol:0}},
  ];
}
function freqStats(counts,pool,total){
  const seen=Object.keys(counts).filter(k=>counts[k]>0);
  const arr=seen.map(k=>counts[k]);
  const min=arr.length?Math.min(...arr):0,max=arr.length?Math.max(...arr):0;
  let h=0;for(const k in counts){const p=counts[k]/total;if(p>0)h-=p*Math.log2(p);}
  return {size:seen.length,min,max,ratio:max/Math.max(1,min),entropy:h,freq:seen.sort((a,b)=>counts[b]-counts[a]).map(k=>[k,counts[k]/total])};
}
const N=10000;
const UPGS=T.UPGRADES.map(u=>u.id);
const ITMS=T.ITEMS.map(i=>i.id);
console.log('### VARIEDADE — UPGRADES (itens normais da loja) ###');
for(const sc of scenarios()){
  const counts={};const per={};
  setRng((sc.w*7919+sc.m.greed*31+sc.m.viol*17+sc.m.comp*3+7)>>>0);
  for(let i=0;i<N;i++){
    fresh(sc.m);T.setWave(sc.w);T.rollShop();
    for(const u of T.getShopOffers()){counts[u.id]=(counts[u.id]||0)+1;if(!per[u.id])per[u.id]={n:0,w:0};per[u.id].n++;}
  }
  const total=N*3;
  const eff=UPGS.filter(id=>T.isUpgUnlocked(id)&&rarWeight(of(id),sc.w)>0);
  const st=freqStats(counts,eff,total);
  console.log(JSON.stringify({scenario:sc.name,wave:sc.w,totalPool:UPGS.length,effectivePool:eff.length,seen:st.size,min:st.min,max:st.max,ratio:+st.ratio.toFixed(2),entropy:+st.entropy.toFixed(3),once5:+(1-Math.pow(1-st.freq[0][1],5)*0).toFixed(4),top5:st.freq.slice(0,5).map(x=>x[0]+':'+(x[1]*100).toFixed(2)+'%'),bottom5:st.freq.slice(-5).map(x=>x[0]+':'+(x[1]*100).toFixed(2)+'%')}));
}
console.log('\n### VARIEDADE — MÓDULOS PASSIVOS (para referência B4/B3) ###');
for(const sc of scenarios()){
  const counts={};
  setRng((sc.w*104729+sc.m.greed*29+sc.m.viol*13+sc.m.comp*2+5)>>>0);
  for(let i=0;i<N;i++){
    fresh(sc.m);T.setWave(sc.w);T.rollShop();
    for(const it of T.getShopItems())counts[it.id]=(counts[it.id]||0)+1;
  }
  const total=N*2;
  const eff=ITMS.filter(id=>T.isItemUnlocked(id)&&rarWeight(iof(id),sc.w)*moralWeight(iof(id),sc.w,sc.m)>0);
  const st=freqStats(counts,eff,total);
  console.log(JSON.stringify({scenario:sc.name,wave:sc.w,totalPool:ITMS.length,effectivePool:eff.length,seen:st.size,min:st.min,max:st.max,ratio:+st.ratio.toFixed(2),entropy:+st.entropy.toFixed(3),top5:st.freq.slice(0,5).map(x=>x[0]+':'+(x[1]*100).toFixed(2)+'%'),bottom5:st.freq.slice(-5).map(x=>x[0]+':'+(x[1]*100).toFixed(2)+'%')}));
}
// Sequential run, consecutive shop repetition correctly (buy applies)
console.log('\n### RUN SEQUENCIAL 1000 runs (upgrades e módulos, compra barata) ###');
{
  let totalShops=0,shareUpg0=0,shareUpg1=0,shareUpg2=0,shareUpg3=0,shareItm0=0,shareItm1=0,shareItm2=0;
  let lastUpg=null,lastItm=null;
  const waveSeen={}; // wave -> {upg:Set,itm:Set}
  for(let r=0;r<1000;r++){
    T.resetShopVars();const p=T.makePlayer(0,true);T.setPlayer(p);T.setMoral({comp:0,greed:0,viol:0});
    p.items=[];p.coins=999999;
    lastUpg=null;lastItm=null;
    for(let w=1;w<=20;w++){
      T.setWave(w);T.rollShop();
      const us=T.getShopOffers(),its=T.getShopItems();
      const idsU=us.map(u=>u.id).sort().join(','),idsI=its.map(i=>i.id).sort().join(',');
      totalShops++;
      if(!waveSeen[w])waveSeen[w]={upg:new Set(),itm:new Set()};
      for(const u of us)waveSeen[w].upg.add(u.id);for(const it of its)waveSeen[w].itm.add(it.id);
      if(lastUpg){
        const a=lastUpg.split(','),b=idsU.split(','),n=a.filter(x=>b.indexOf(x)>=0).length;
        if(n===0)shareUpg0++;else if(n===1)shareUpg1++;else if(n===2)shareUpg2++;else shareUpg3++;
      }
      if(lastItm){
        const a=lastItm.split(','),b=idsI.split(','),n=a.filter(x=>b.indexOf(x)>=0).length;
        if(n===0)shareItm0++;else if(n===1)shareItm1++;else shareItm2++;
      }
      lastUpg=idsU;lastItm=idsI;
      // buy: all upgrades (sempre permitido) e módulos não instalados
      for(const u of us){/* upgrades são repetíveis */ p.upgLog.push(u.id);}
      for(const it of its){if(p.items.indexOf(it.id)<0){p.items.push(it.id);}}
    }
  }
  console.log('total_shops='+totalShops);
  console.log('upg_share_consec 0/1/2/3 =',shareUpg0+'/'+shareUpg1+'/'+shareUpg2+'/'+shareUpg3,'  (%>=1 ='+((shareUpg1+shareUpg2+shareUpg3)/(shareUpg0+shareUpg1+shareUpg2+shareUpg3)*100).toFixed(1)+'%)');
  console.log('itm_share_consec 0/1/2 =',shareItm0+'/'+shareItm1+'/'+shareItm2,'  (%>=1 ='+((shareItm1+shareItm2)/(shareItm0+shareItm1+shareItm2)*100).toFixed(1)+'%)');
  for(const w of [1,3,5,8,10,12,15,18,20]){
    const s=waveSeen[w];
    console.log('wave='+w,'distinct_upg='+s.upg.size,'distinct_itm='+s.itm.size);
  }
}
