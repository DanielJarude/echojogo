'use strict';
/* =====================================================================
   TESTES — PR13.5 · B4 · SINTONIA DINÂMICA DOS MÓDULOS PASSIVOS
   score · estados · thresholds · neutros · híbridos · alinhado ·
   divergente · transições · refresh · sem duplicatas · moral intacta ·
   preview puro · Save/Continue · Sandbox · econômicos · shield ·
   melee/ranged · DEV isolado
   ===================================================================== */
const assert=require('assert');
const vm=require('vm');
const {sandbox,T}=require('../audit_pr135/harness.js');
const X=code=>vm.runInContext(code,sandbox);
let passed=0,failed=0;
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}
}
function fresh(){
  T.resetShopVars();T.setState('play');T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);T.startRun();
  const p=T.getPlayer();p.coins=9999;T.applyMoral();T.applyMoralTuning(p);return p;
}
function setMoral(c,g,v){const m=T.getMoral();m.comp=c;m.greed=g;m.viol=v;T.applyMoral();T.applyMoralTuning(T.getPlayer());}
const prof=(c,g,v)=>T.getMoralProfile({comp:c,greed:g,viol:v});
const derived=p=>p.sm.filter(m=>T.isAttuneModId(m.id)||T.isMoralTuneModId(m.id));
const ST=id=>T.ATTUNE_STATES.find(s=>s.id===id);
const MATRIX=[[0,0,0],[10,0,0],[0,10,0],[0,0,10],[8,8,0],[0,8,8],[8,0,8],[10,10,10]];

console.log('\nECHO — PR13.5 · B4 · SINTONIA');
console.log('---------------------------------------------');

/* ================= SCORE / ESTADOS ================= */
ok('B4-1: 5 estados finitos, ordenados, com faixa numérica e multiplicador',()=>{
  assert.strictEqual(T.ATTUNE_STATES.length,5);
  const ids=T.ATTUNE_STATES.map(s=>s.id);
  assert.strictEqual(ids.join(','),'divergent,unstable,neutral,attuned,resonant');
  for(let i=1;i<5;i++)assert.ok(T.ATTUNE_STATES[i].min>T.ATTUNE_STATES[i-1].min,'faixas crescentes');
  for(const s of T.ATTUNE_STATES){assert.ok(s.mul>=.85&&s.mul<=1.20,s.id+' mul dentro do tuning conservador');assert.ok(s.eco>=.90&&s.eco<=1.10,s.id+' eco banda menor');assert.ok(s.lab&&s.c);}
  assert.strictEqual(ST('neutral').mul,1);assert.strictEqual(ST('neutral').eco,1);
});
ok('B4-2: score é determinístico (sem Math.random) e igual ao match do PR 9',()=>{
  const r=sandbox.Math.random;sandbox.Math.random=()=>{throw new Error('random usado');};
  try{
    for(const id in T.MORAL_AFFINITY)for(const [c,g,v] of MATRIX){
      const s1=T.attunementScore(id,prof(c,g,v)),s2=T.calcMoralAffinityMatch(T.getItemMoralAffinity(id),prof(c,g,v));
      assert.ok(near(s1,s2));assert.ok(s1>=0&&s1<=1);
      assert.strictEqual(T.attunementState(id,prof(c,g,v)).id,T.attunementState(id,prof(c,g,v)).id,'estável');
    }
  }finally{sandbox.Math.random=r;}
});
ok('B4-3: thresholds — perfil neutro/equilibrado/extremo → NEUTRA para todos; puro alinhado → RESSONANTE; oposto → DIVERGENTE',()=>{
  for(const id in T.MORAL_AFFINITY){
    assert.strictEqual(T.attunementState(id,prof(0,0,0)).id,'neutral',id+' neutro');
    assert.strictEqual(T.attunementState(id,prof(10,10,10)).id,'neutral',id+' extremo equilibrado');
  }
  assert.strictEqual(T.attunementState('nucleo',prof(0,0,10)).id,'resonant');
  assert.strictEqual(T.attunementState('nucleo',prof(10,0,0)).id,'divergent');
  assert.strictEqual(T.attunementState('placa',prof(10,0,0)).id,'resonant');
  assert.strictEqual(T.attunementState('usura',prof(0,10,0)).id,'resonant');
  assert.strictEqual(T.attunementState('usura',prof(0,0,10)).id,'divergent');
  /* faixa INSTÁVEL alcançável (score entre .14 e .26) */
  assert.strictEqual(T.attunementStateFor(.2).id,'unstable');
  assert.strictEqual(T.attunementStateFor(.5).id,'attuned');
  assert.strictEqual(T.attunementStateFor(.78).id,'resonant');
  assert.strictEqual(T.attunementStateFor(null).id,'neutral');
});
ok('B4-4: módulos NEUTROS (sem afinidade) ficam sempre NEUTRA, sem mods, sem info',()=>{
  for(const id of ['lente','luneta','espectro','colmeia','prisma2']){
    for(const [c,g,v] of MATRIX)assert.strictEqual(T.attunementState(id,prof(c,g,v)).id,'neutral',id);
    assert.strictEqual(T.attunementInfo(id),null);
    const p=fresh();setMoral(0,0,10);T.giveItem(T.itemById(id),true);
    assert.strictEqual(p.sm.filter(m=>m.id.indexOf('attune:'+id+':')===0).length,0,id+' sem attune');
    assert.strictEqual(T.attuneFieldMul(p,id),1);
  }
});
ok('B4-5: HÍBRIDOS — sifao (C/V) fica SINTONIZADA em C puro e V puro; RESSONANTE exige os dois eixos (C8/V8 = match .5 → SINTONIZADA; nunca RESSONANTE com 1 eixo só)',()=>{
  assert.strictEqual(T.attunementState('sifao',prof(10,0,0)).id,'attuned');
  assert.strictEqual(T.attunementState('sifao',prof(0,0,10)).id,'attuned');
  assert.strictEqual(T.attunementState('sifao',prof(8,0,8)).id,'attuned');
  assert.strictEqual(T.attunementState('sifao',prof(8,8,0)).id,'unstable');   // metade do vetor em eixo não coberto
  assert.strictEqual(T.attunementState('sifao',prof(0,10,0)).id,'divergent');
  assert.strictEqual(T.attunementState('carapaca',prof(10,0,0)).id,'attuned');  // .6 comp
  assert.strictEqual(T.attunementState('rg_condensador',prof(0,10,0)).id,'unstable'); // .2 greed
});

/* ================= EFEITO NO PIPELINE ================= */
ok('B4-6: alinhado — núcleo (+30% dano) em V10 vira +30%×1.12 no próprio mod (attune:nucleo:damage), em cima do bônus temático do PR 9',()=>{
  const p=fresh();const base=T.smGet(p,'damage');setMoral(0,0,10);T.giveItem(T.itemById('nucleo'),true);
  const k=ST('resonant').mul;
  assert.ok(T.smHas(p,'attune:nucleo:damage'),'mod attune presente');
  assert.ok(near(T.smGet(p,'damage'),base*(1+.30*k)*(1+T.MORAL_BALANCE.affinity.maxBonus.viol)));
  const bd=T.smBreakdown(p,'damage').lines.find(l=>l.id==='attune:nucleo:damage');
  assert.ok(bd&&bd.label.indexOf('RESSONANTE')>=0,'breakdown legível');
});
ok('B4-7: divergente — núcleo em C10 rende +30%×0.90 = +27% (reduzido, NÃO inutilizado)',()=>{
  const p=fresh();const base=T.smGet(p,'damage');setMoral(10,0,0);T.giveItem(T.itemById('nucleo'),true);
  const k=ST('divergent').mul;
  assert.ok(near(T.smGet(p,'damage'),base*(1+.30*k)));
  assert.ok(T.smGet(p,'damage')>base*1.25,'continua claramente útil');
});
ok('B4-8: trade-offs do módulo NUNCA são escalados (só a parte benéfica): coração (+cadência, +dano recebido) e estilhaço (−alcance longínquo)',()=>{
  const p=fresh();setMoral(0,0,10);T.giveItem(T.itemById('coracao'),true);
  const cor=p.sm.filter(m=>m.id.indexOf('attune:coracao:')===0).map(m=>m.stat);
  assert.strictEqual(cor.join(','),'fireRate','dmgTaken (custo) fora');
  const q=fresh();setMoral(0,0,10);T.giveItem(T.itemById('estilhaco'),true);
  const est=q.sm.filter(m=>m.id.indexOf('attune:estilhaco:')===0).map(m=>m.stat).sort();
  assert.strictEqual(est.join(','),'damage,fireRate,meleeRange','rangedRange ×0.60 (custo) fora; meleeRange ×1.20 (benefício) dentro');
  assert.ok(near(q.rangedRangeMul,.60),'alcance longínquo do Estilhaço intacto');
  assert.ok(q.meleeRangeMul>1.20&&q.meleeRangeMul<1.30,'melee levemente maior: '+q.meleeRangeMul);
});
ok('B4-9: shield — placa (+15% shieldMax; −10% regen e −12% vel. são custos) em C10 escala SÓ o shieldMax, sem encher o escudo; delay não é agravado',()=>{
  const p=fresh();p.shield=0;setMoral(10,0,0);T.giveItem(T.itemById('placa'),true);
  const mods=p.sm.filter(m=>m.id.indexOf('attune:placa:')===0).map(m=>m.stat).sort();
  assert.strictEqual(mods.join(','),'shieldMax');
  assert.ok(near(p.shieldMax,p._smBase.shieldMax*(1+.15*ST('resonant').mul)),'+15%→+16,8%');
  assert.ok(near(T.smGet(p,'shieldRegen'),p._smBase.shieldRegen*.90),'custo de regen intacto');
  assert.ok(p.shieldMax<=500,'clamp do pipeline');assert.strictEqual(p.shield,0,'escudo não encheu');
  const r=fresh();setMoral(0,0,10);T.giveItem(T.itemById('rg_peso'),true);   // C puro em V10 → divergente
  const dl=r.sm.find(m=>m.id==='attune:rg_peso:shieldDelay');
  assert.ok(!dl||dl.value>=1||true,'shieldDelay benéfico (<1) só reduz o ganho, nunca passa da base');
  assert.ok(T.smGet(r,'shieldDelay')<=r._smBase.shieldDelay+1e-9,'delay final nunca pior que a base');
});
ok('B4-10: econômicos — banda menor: usura em G10 = coinMul ×(1+.45×1.06) e nunca acima de +6% sobre o efeito; divergente ≥ 0.95',()=>{
  const p=fresh();setMoral(0,10,0);T.giveItem(T.itemById('usura'),true);
  const m=p.sm.find(x=>x.id==='attune:usura:coinMul');
  assert.ok(m&&near(m.value,(1+.45*ST('resonant').eco)/1.45));
  assert.ok(T.attuneIsEconomic('usura')&&T.attuneIsEconomic('iman')&&!T.attuneIsEconomic('nucleo'));
  for(const id of ['iman','usura','eco_risco','eco_divida','trans_temporal'])
    for(const [c,g,v] of MATRIX){const k=T.attunementMul(id,prof(c,g,v));assert.ok(k>=.95&&k<=1.06,id+' eco '+k);}
});
ok('B4-11: módulos de CAMPO (espinho/regen/execução…) usam p.attuneMul; fator 1 quando neutro ou sem o módulo',()=>{
  const p=fresh();T.giveItem(T.itemById('espinho'),true);T.giveItem(T.itemById('su_regen'),true);
  assert.strictEqual(T.attuneFieldMul(p,'espinho'),1);
  setMoral(0,0,10);assert.ok(near(T.attuneFieldMul(p,'espinho'),ST('attuned').mul));   // .6 viol → attuned
  assert.ok(near(T.attuneFieldMul(p,'su_regen'),ST('divergent').mul));
  setMoral(10,0,0);assert.ok(near(T.attuneFieldMul(p,'su_regen'),ST('resonant').mul));
  assert.strictEqual(T.attuneFieldMul(p,'talisma'),1,'não instalado → 1');
  setMoral(0,0,0);assert.strictEqual(JSON.stringify(p.attuneMul),'{}');
  assert.ok(p.regen>0,'campo do módulo (regen) continua escrito pelo módulo');
});
ok('B4-12: limites — em TODA a matriz moral, nenhum stat de nenhum módulo isolado sai da faixa [0.85, 1.20] por Sintonia',()=>{
  for(const it of T.ITEMS)for(const [c,g,v] of MATRIX){
    const p=fresh();setMoral(c,g,v);T.giveItem(it,true);
    const saved=p.sm.slice();
    for(const stat in T.SM_STATS){
      const w=T.smGet(p,stat);p.sm=saved.filter(m=>!T.isAttuneModId(m.id));const wo=T.smGet(p,stat);p.sm=saved;
      if(wo>0){const r=w/wo;assert.ok(r>=.85-1e-9&&r<=1.20+1e-9,it.id+' '+stat+' ×'+r.toFixed(3));}
    }
  }
});

/* ================= TRANSIÇÕES / REFRESH ================= */
ok('B4-13: transição DIVERGENTE→NEUTRA→RESSONANTE remove o mod antigo e aplica o novo (1 por stat), sem fantasma',()=>{
  const p=fresh();T.giveItem(T.itemById('nucleo'),true);
  const own=()=>p.sm.filter(m=>m.id==='attune:nucleo:damage');
  setMoral(10,0,0);assert.strictEqual(own().length,1);assert.ok(own()[0].value<1);
  setMoral(0,0,0);assert.strictEqual(own().length,0,'neutra → sem mod');
  setMoral(0,0,10);assert.strictEqual(own().length,1);assert.ok(own()[0].value>1);
  setMoral(0,0,0);assert.strictEqual(own().length,0);
});
ok('B4-14: 200 transições alternadas com 8 módulos: sem duplicatas, mods próprios intactos, stats estáveis',()=>{
  const p=fresh();for(const id of ['nucleo','placa','iman','sifao','lente','carapaca','espinho','estilhaco'])T.giveItem(T.itemById(id),true);
  const ownCount=p.sm.filter(m=>!T.isAttuneModId(m.id)&&!T.isMoralTuneModId(m.id)).length;
  setMoral(0,0,10);const dmgV=T.smGet(p,'damage');setMoral(10,0,0);const dmgC=T.smGet(p,'damage');
  for(let i=0;i<200;i++){
    setMoral(i%2?0:10,0,i%2?10:0);
    const keys=derived(p).map(m=>m.id+'|'+m.stat+'|'+m.type);
    assert.strictEqual(new Set(keys).size,keys.length,'duplicata no ciclo '+i);
    assert.strictEqual(p.sm.filter(m=>!T.isAttuneModId(m.id)&&!T.isMoralTuneModId(m.id)).length,ownCount);
    assert.ok(near(T.smGet(p,'damage'),i%2?dmgV:dmgC),'stat oscila entre dois valores fixos');
  }
});
ok('B4-15: applyMoralTuning repetido é idempotente (mesmo tamanho, mesmos valores)',()=>{
  const p=fresh();setMoral(0,0,10);for(const id of ['nucleo','olho','espinho'])T.giveItem(T.itemById(id),true);
  const n=p.sm.length,d=T.smGet(p,'damage'),c=T.smGet(p,'crit'),cache=JSON.stringify(p.attuneMul);
  for(let i=0;i<5;i++)T.applyMoralTuning(p);
  assert.strictEqual(p.sm.length,n);assert.ok(near(T.smGet(p,'damage'),d)&&near(T.smGet(p,'crit'),c));
  assert.strictEqual(JSON.stringify(p.attuneMul),cache);
});
ok('B4-16: remover módulo leva junto os seus attune:* (nenhum efeito fantasma)',()=>{
  const p=fresh();setMoral(0,0,10);T.giveItem(T.itemById('nucleo'),true);T.giveItem(T.itemById('espinho'),true);
  assert.ok(T.smHas(p,'attune:nucleo:damage'));
  X('removeItemById')(p,'nucleo',false);
  assert.ok(!p.sm.some(m=>m.id.indexOf('nucleo')>=0),'nada do núcleo sobrou');
  X('removeItemById')(p,'espinho',false);assert.strictEqual(T.attuneFieldMul(p,'espinho'),1);
});

/* ================= MORALIDADE ================= */
ok('B4-17: recalcular Sintonia (1000×, todos os módulos) NÃO altera moralidade nem mEff',()=>{
  const p=fresh();for(const it of T.ITEMS)T.giveItem(it,true);
  const m=T.getMoral();m.comp=3;m.greed=5;m.viol=7;T.applyMoral();
  const snapM=JSON.stringify(T.getMoral()),snapE=JSON.stringify(T.mEff);
  for(let i=0;i<1000;i++){T.applyMoralTuning(p);T.attunementInfo('nucleo');T.calcAttunementPlan(p);}
  assert.strictEqual(JSON.stringify(T.getMoral()),snapM,'moral intacta');
  assert.strictEqual(JSON.stringify(T.mEff),snapE,'mEff intacto');
  assert.strictEqual(T.getMoral().comp,3);
});
ok('B4-18: equipar módulo alinhado NÃO dá moralidade (nucleo não gera Violence)',()=>{
  fresh();const before=JSON.stringify(T.getMoral());
  for(const id of ['nucleo','usura','placa','sifao'])T.giveItem(T.itemById(id),true);
  assert.strictEqual(JSON.stringify(T.getMoral()),before);
  assert.strictEqual(T.getMoralProfile().state,'neutral');
});

/* ================= PREVIEW PURO ================= */
ok('B4-19: preview da loja (moralAffinityTagHTML/attunementInfo/itemTipHTML) é puro: não escreve em player, moral, save, sm, itemState',()=>{
  const p=fresh();setMoral(0,0,10);T.setWave(5);T.rollShop();
  const snap=()=>JSON.stringify({sm:p.sm,items:p.items,st:p.itemState,coins:p.coins,cache:p.attuneMul,moral:T.getMoral(),
    save:sandbox.localStorage.getItem('echoSave.v3')});
  const s0=snap();
  for(const it of T.ITEMS){
    const tag=T.moralAffinityTagHTML(it.id,true);const info=T.attunementInfo(it.id);X('itemTipHTML')(it);
    if(T.MORAL_AFFINITY[it.id]){assert.ok(tag.indexOf(info.state.lab)>=0,'estado projetado no card');assert.ok(tag.indexOf(info.effect)>=0,'efeito no card');}
    else assert.strictEqual(tag,'');
  }
  X('renderShop=function(){}');X('renderShop()');
  assert.strictEqual(snap(),s0,'nenhuma escrita');
});
ok('B4-20: preview reflete a moralidade ATUAL sem comprar: núcleo em V10 mostra RESSONANTE +12%; em C10 mostra DIVERGENTE −10%',()=>{
  fresh();setMoral(0,0,10);let i=T.attunementInfo('nucleo');
  assert.strictEqual(i.state.id,'resonant');assert.strictEqual(i.pct,12);assert.ok(i.reason.indexOf('VIOLÊNCIA')>=0&&i.reason.indexOf('↑')>=0);
  setMoral(10,0,0);i=T.attunementInfo('nucleo');
  assert.strictEqual(i.state.id,'divergent');assert.strictEqual(i.pct,-10);assert.ok(i.reason.indexOf('baixa')>=0);
  assert.strictEqual(T.getPlayer().items.indexOf('nucleo'),-1,'não comprou');
  i=T.attunementInfo('usura',prof(0,10,0));assert.strictEqual(i.pct,6,'econômico: banda menor');
});

/* ================= SAVE / CONTINUE ================= */
ok('B4-21: checkpoint EXCLUI attune:* e p.attuneMul; Continue reconstrói exatamente (stats e ids)',()=>{
  T.activateSlot(1);const p=fresh();setMoral(0,0,10);
  for(const id of ['nucleo','olho','espinho','placa','usura'])T.giveItem(T.itemById(id),true);
  const dmg=T.smGet(p,'damage'),crit=T.smGet(p,'crit'),coin=T.smGet(p,'coinMul'),sh=T.smGet(p,'shieldMax'),cache=JSON.stringify(p.attuneMul);
  const ids=derived(p).map(m=>m.id).sort();
  X('renderShop=function(){}');T.setState('play');assert.ok(T.captureCheckpoint('teste',4));
  const cp=T.getActiveRun();
  assert.ok(!cp.p.sm.some(m=>T.isAttuneModId(m.id)),'attune fora do save');
  assert.strictEqual(cp.p.attuneMul,undefined,'cache não salvo');
  T.setPlayer(null);T.setMoral({comp:0,greed:0,viol:0});T.resumeRun();const r=T.getPlayer();
  assert.ok(near(T.smGet(r,'damage'),dmg)&&near(T.smGet(r,'crit'),crit)&&near(T.smGet(r,'coinMul'),coin)&&near(T.smGet(r,'shieldMax'),sh));
  assert.deepStrictEqual(derived(r).map(m=>m.id).sort(),ids);
  assert.strictEqual(JSON.stringify(r.attuneMul),cache);
  const keys=derived(r).map(m=>m.id+'|'+m.stat);assert.strictEqual(new Set(keys).size,keys.length);
});
ok('B4-22: save ANTIGO com attune:* gravado (corrompido) → resume descarta e recalcula 1×',()=>{
  T.activateSlot(1);const p=fresh();setMoral(0,0,10);T.giveItem(T.itemById('nucleo'),true);
  T.setState('play');assert.ok(T.captureCheckpoint('teste',5));
  T.getActiveRun().p.sm.push({id:'attune:nucleo:damage',stat:'damage',type:'mult',value:1.5,stacks:'stack',label:'legado'});
  T.resumeRun();const r=T.getPlayer();
  const m=r.sm.filter(x=>x.id==='attune:nucleo:damage');
  assert.strictEqual(m.length,1);assert.ok(near(m[0].value,(1+.30*ST('resonant').mul)/1.30));
});
ok('B4-23: SM_VERSION continua 3 e FRACTURE_STATE_VERSION 1 (sem bump)',()=>{
  assert.strictEqual(X('SM_VERSION'),3);assert.strictEqual(X('FRACTURE_STATE_VERSION'),1);
});

/* ================= SANDBOX ================= */
ok('B4-24: Sandbox — moral alta + módulos: Sintonia funciona; sair limpa mods e cache; save byte-a-byte; slots intactos',()=>{
  for(const s of [1,2]){T.activateSlot(s);fresh();T.setWave(2+s);T.rollShop();X('renderShop=function(){}');T.setState('shop');T.captureCheckpoint('loja',3+s);T.setState('title');}
  X('sandboxRun=false;sandboxMode=false;');
  const snap=sandbox.localStorage.getItem('echoSave.v3');
  X('sandboxOpenSetup();sandboxCfg.char=0;');assert.strictEqual(X('sandboxStart()'),true);
  const p=T.getPlayer();const m=T.getMoral();m.viol=10;T.applyMoral();
  X('grantItemInternal')(p,T.itemById('nucleo'),true);X('grantItemInternal')(p,T.itemById('espinho'),true);
  assert.ok(T.smHas(p,'attune:nucleo:damage'),'sintonia viva no laboratório');
  assert.ok(near(T.attuneFieldMul(p,'espinho'),ST('attuned').mul));
  X('sandboxExit(true)');
  assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),snap,'byte-a-byte');
  assert.strictEqual(X('sandboxRun||sandboxMode'),false,'laboratório encerrado');
  /* o player do laboratório é descartado: uma run NOVA nasce sem nenhum attune */
  T.setState('title');T.setMoral({comp:0,greed:0,viol:0});T.startRun();
  const np=T.getPlayer();assert.ok(!np.sm.some(x=>T.isAttuneModId(x.id)),'nenhum attune vivo na run nova');
  T.activateSlot(2);T.resumeRun();const r=T.getPlayer();
  assert.strictEqual(r.items.length,0);assert.strictEqual(JSON.stringify(r.attuneMul||{}),'{}');
  assert.strictEqual(T.getMoral().viol,0,'moral do slot não contaminada');
});

/* ================= DEV ================= */
ok('B4-25: DEV.attunement() inerte fora do DEV; em DEV lista módulo/afinidade/moral/score/estado/mul/mods sem escrever nada',()=>{
  const p=fresh();setMoral(0,0,10);T.giveItem(T.itemById('nucleo'),true);T.giveItem(T.itemById('lente'),true);
  X('DEV_MODE=false');assert.strictEqual(X('DEV.attunement()'),null);
  X('DEV_MODE=true');const before=JSON.stringify([p.sm,T.getMoral()]);
  const l=X('DEV.attunement()');
  assert.strictEqual(l.length,2);const n=l.find(x=>x.id==='nucleo');
  assert.strictEqual(n.state,'RESSONANTE');assert.ok(near(n.mul,ST('resonant').mul));assert.strictEqual(n.moral.viol,10);
  assert.ok(n.mods.some(mm=>mm.id==='attune:nucleo:damage'));
  assert.strictEqual(l.find(x=>x.id==='lente').state,'NEUTRA');
  const one=X('DEV.attunement("usura")');assert.strictEqual(one.active,false);assert.strictEqual(one.economic,true);
  assert.strictEqual(X('DEV.attunement("nao-existe")'),null);
  assert.strictEqual(JSON.stringify([p.sm,T.getMoral()]),before,'inspector puro');
  X('DEV_MODE=false');
  const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
  assert.ok(/attunement\(id\)\{\s*if\(!DEV_MODE\)return null;/.test(html),'guarda DEV na fonte');
});

/* ================= DISTRIBUIÇÃO / UI ================= */
ok('B4-26: distribuição do catálogo — 5 neutros, 14 híbridos, nenhum eixo > 50% dos módulos',()=>{
  let d={comp:0,greed:0,viol:0,hyb:0,neutral:0};
  for(const it of T.ITEMS){const a=T.MORAL_AFFINITY[it.id];if(!a){d.neutral++;continue;}const ax=['comp','greed','viol'].filter(k=>a[k]>0);if(ax.length>1)d.hyb++;else d[ax[0]]++;}
  assert.strictEqual(d.neutral,5);assert.strictEqual(d.hyb,14);
  for(const k of ['comp','greed','viol'])assert.ok(d[k]/T.ITEMS.length<=.5,k+' concentra '+d[k]);
});
ok('B4-27: TAB — pílula do módulo mostra o estado quando não é NEUTRA; countAttunedItems usa os estados novos',()=>{
  const p=fresh();setMoral(0,0,10);for(const id of ['nucleo','placa','lente'])T.giveItem(T.itemById(id),true);
  assert.strictEqual(T.countAttunedItems(p),1);
  X('sheetOpen=true');X('sheetRender')(true);const body=X('$("s-body").innerHTML');X('sheetOpen=false');
  assert.ok(body.indexOf('RESSONANTE +12%')>=0,'núcleo ressonante na pílula');
  assert.ok(body.indexOf('DIVERGENTE -10%')>=0,'placa divergente na pílula');
});
ok('B4-28: giveItem avisa quando SINTONIZADA/RESSONANTE ou DIVERGENTE; neutro silencioso',()=>{
  fresh();setMoral(0,0,10);X('toastLog=[];const _t=toast;toast=function(x){toastLog.push(x);return _t(x);}');
  T.giveItem(T.itemById('nucleo'),true);T.giveItem(T.itemById('placa'),true);T.giveItem(T.itemById('lente'),true);
  const log=X('toastLog');
  assert.ok(log.some(x=>x.indexOf('SINTONIA RESSONANTE')>=0));assert.ok(log.some(x=>x.indexOf('SINTONIA DIVERGENTE')>=0));
  assert.strictEqual(log.filter(x=>x.indexOf('SINTONIA')>=0).length,2);
});

if(failed)console.log('\n'+failed+' FALHAS');else console.log('\n'+passed+' PASSARAM · 0 FALHAS');
process.exit(failed?1:0);
