'use strict';
/* Auditoria quantitativa da SINTONIA dos módulos passivos (PR13.5 · B4).
   Funciona ANTES (PR 9) e DEPOIS (B4) — detecta as funções novas.
   Uso: node audit_pr135/attunement_audit.js [ROOT]                       */
const ROOT=process.argv[2]||require('path').join(__dirname,'..');
const {sandbox,T}=require(ROOT+'/audit_pr135/harness.js');
const vm=require('vm');const X=c=>vm.runInContext(c,sandbox);
const hasB4=typeof T.attunementState==='function';
const MATRIX=[['NEUTRO',0,0,0],['COMP ALTA',10,0,0],['GREED ALTA',0,10,0],['VIOL ALTA',0,0,10],
  ['MISTO CG',8,8,0],['MISTO GV',0,8,8],['MISTO CV',8,0,8],['EXTREMO',10,10,10]];
const f=x=>(Math.round(x*1000)/1000).toFixed(3);
function fresh(){T.resetShopVars();T.setState('play');T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);T.startRun();const p=T.getPlayer();p.items=[];p.sm=p.sm.filter(m=>!/^(moral:item:|attune:)/.test(m.id));T.applyMoral();T.applyMoralTuning(p);return p;}
function setMoral(c,g,v){const m=T.getMoral();m.comp=c;m.greed=g;m.viol=v;T.applyMoral();T.applyMoralTuning(T.getPlayer());}
function isDerived(id){return /^(moral:item:|attune:)/.test(id);}
/* razão "com sintonia / sem sintonia" por stat para UM item instalado */
function ratios(p){
  const out={};const saved=p.sm.slice();
  for(const stat in T.SM_STATS){const w=T.smGet(p,stat);p.sm=saved.filter(m=>!isDerived(m.id));const wo=T.smGet(p,stat);p.sm=saved;if(wo>0&&Math.abs(w/wo-1)>1e-9)out[stat]=w/wo;}
  return out;
}
console.log('# ATTUNEMENT AUDIT ·',hasB4?'B4':'PR9 (antes)','· ROOT='+ROOT);
const ITEMS=T.ITEMS;const AFF=T.MORAL_AFFINITY;
let dist={comp:0,greed:0,viol:0,hyb:0,neutral:0};
for(const it of ITEMS){const a=AFF[it.id];if(!a){dist.neutral++;continue;}const ax=['comp','greed','viol'].filter(k=>a[k]>0);if(ax.length>1)dist.hyb++;else dist[ax[0]]++;}
console.log('\n## Distribuição de afinidade ('+ITEMS.length+' módulos):',JSON.stringify(dist));
const stateOf=(id,prof)=>hasB4?T.attunementState(id,prof).id:T.moralAffinityLevel(T.calcMoralAffinityMatch(T.getItemMoralAffinity(id),prof)).id;
console.log('\n## Estados por cenário moral (contagem de módulos)');
const allStates=new Set();
for(const [nm,c,g,v] of MATRIX){
  const prof=T.getMoralProfile({comp:c,greed:g,viol:v});const cnt={};
  for(const it of ITEMS){const s=stateOf(it.id,prof);cnt[s]=(cnt[s]||0)+1;allStates.add(s);}
  console.log(nm.padEnd(11),JSON.stringify(cnt));
}
console.log('estados alcançáveis:',[...allStates].join(', '));
console.log('\n## Efeito real por módulo (razão com/sem sintonia, item isolado) — cenário mais favorável e mais desfavorável');
let maxUp=1,maxDown=1,maxUpId='',maxDownId='',noEffect=[],rows=[];
for(const it of ITEMS){
  let best={r:1,sc:'-'},worst={r:1,sc:'-'},states={};
  for(const [nm,c,g,v] of MATRIX){
    fresh();setMoral(c,g,v);const p=T.getPlayer();T.giveItem(it,true);
    const rs=ratios(p);const st=stateOf(it.id,T.getMoralProfile());states[nm]=st;
    /* "força" = maior desvio de 1 entre os stats (sinal pela direção benéfica) */
    let dev=0;for(const s in rs){let d=rs[s]-1;if(s==='dmgTaken'||s==='shieldDelay')d=-d;if(Math.abs(d)>Math.abs(dev))dev=d;}
    /* B4: módulos de campo direto (regen/espinhos/execução…) escalam via p.attuneMul */
    if(hasB4&&typeof T.attuneFieldMul==='function'){const fk=T.attuneFieldMul(p,it.id)-1;if(Math.abs(fk)>Math.abs(dev))dev=fk;}
    if(dev>best.r-1)best={r:1+dev,sc:nm};if(dev<worst.r-1)worst={r:1+dev,sc:nm};
    const dup=p.sm.filter(m=>isDerived(m.id)).map(m=>m.id+'|'+m.stat+'|'+m.type);
    if(new Set(dup).size!==dup.length)console.log('  !! DUPLICATA',it.id,nm);
  }
  if(best.r>maxUp){maxUp=best.r;maxUpId=it.id;}if(worst.r<maxDown){maxDown=worst.r;maxDownId=it.id;}
  if(best.r===1&&worst.r===1)noEffect.push(it.id);
  rows.push({id:it.id,aff:AFF[it.id]?['comp','greed','viol'].filter(k=>AFF[it.id][k]>0).map(k=>k[0].toUpperCase()+(AFF[it.id][k]<1?AFF[it.id][k]:'')).join('/'):'—',neutral:states['NEUTRO'],best,worst});
}
for(const r of rows)console.log(r.id.padEnd(17),r.aff.padEnd(10),'neutro='+r.neutral.padEnd(10),'melhor='+f(r.best.r)+' ('+r.best.sc+')','pior='+f(r.worst.r)+' ('+r.worst.sc+')');
console.log('\nbônus máximo (razão):',f(maxUp),maxUpId,'| penalidade máxima:',f(maxDown),maxDownId);
console.log('módulos sem NENHUM efeito de sintonia em nenhum cenário:',noEffect.length,noEffect.join(','));
/* transições repetidas: sem duplicatas, sem fantasmas, moral intacta */
console.log('\n## Transições (100 ciclos V10→C10→neutro com 6 módulos)');
fresh();const p=T.getPlayer();for(const id of ['nucleo','placa','iman','sifao','lente','carapaca'])T.giveItem(T.itemById(id),true);
const m0=JSON.stringify(T.getMoral());let ok=true;const n0=p.sm.filter(m=>!isDerived(m.id)).length;
for(let i=0;i<100;i++){setMoral(0,0,10);setMoral(10,0,0);setMoral(0,0,0);
  const der=p.sm.filter(m=>isDerived(m.id));const keys=der.map(m=>m.id+'|'+m.stat);
  if(new Set(keys).size!==keys.length){ok=false;console.log('duplicata no ciclo',i);break;}
  if(p.sm.filter(m=>!isDerived(m.id)).length!==n0){ok=false;console.log('mods do item alterados no ciclo',i);break;}}
setMoral(0,0,0);const ghost=p.sm.filter(m=>isDerived(m.id)).length;
console.log('sem duplicatas/alteração dos mods próprios:',ok,'| derivados restantes em perfil neutro:',ghost,'| moral intacta após 300 recomputações:',JSON.stringify(T.getMoral())==='{"comp":0,"greed":0,"viol":0}');
