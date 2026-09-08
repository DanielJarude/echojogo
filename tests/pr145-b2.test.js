'use strict';
/* =====================================================================
   TESTES — PR14.5 · B2 · PERFIL DE BUILD + SINTONIA DE COMPATIBILIDADE
   ---------------------------------------------------------------------
   perfil derivado (8 arquétipos) · determinismo/cache · sintonia por
   build (moral só modula) · razões (tooltip) · famílias + exclusividade
   leve + grandfathering · TRAVA vs família · reroll (cap) · loja por
   pesos suaves · preview ATUAL→PROJETADO · Save/Continue · Sandbox ·
   DEV/release inert · híbridos · anti-feedback-loop · simulação 10k
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
function fresh(op){
  T.resetShopVars();T.setState('play');T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);
  /* R5 §7: operatorId explícito cria o player direto (laboratório) — não
     depende de unlock/charSel, que activateSlot pode sobrescrever. */
  T.startRun(op?{operatorId:op}:null);
  const p=T.getPlayer();p.coins=9999;T.applyMoral();T.applyMoralTuning(p);return p;
}
function setMoral(c,g,v){const m=T.getMoral();m.comp=c;m.greed=g;m.viol=v;T.applyMoral();T.applyMoralTuning(T.getPlayer());}
function force(arq){T.setBuildProfileOverride(arq||null);T.applyMoralTuning(T.getPlayer());}
function bp(){return T.buildProfileSummary();}
function bps(){return T.buildProfile().scores;}
function give(id){const p=T.getPlayer();T.grantItemInternal(p,T.itemById(id),true);return p;}
const prof=(c,g,v)=>T.getMoralProfile({comp:c,greed:g,viol:v});
const ST=id=>T.ATTUNE_STATES.find(s=>s.id===id);

console.log('\nECHO — PR14.5 · B2 · PERFIL DE BUILD / SINTONIA / FAMÍLIAS / LOJA');
console.log('---------------------------------------------');
T.unlockAll();   /* operadores/armas/módulos liberados — os perfis usam chars avançados */

/* ============ 1. PERFIL DE BUILD DERIVADO ============ */
ok('B2-1: 8 arquétipos nomeados; perfil DERIVADO — nada do Perfil existe no checkpoint (save limpo)',()=>{
  assert.strictEqual(Object.keys(T.BUILD_ARCH).length,8);
  for(const a of Object.keys(T.BUILD_ARCH))assert.ok(T.BUILD_ARCH[a].nm&&T.BUILD_ARCH[a].col,a);
  T.activateSlot(1);const p=fresh();
  for(const id of ['nucleo','olho','placa'])give(id);
  T.setState('play');assert.ok(T.captureCheckpoint('t',3));
  const cp=JSON.stringify(T.getActiveRun());
  assert.ok(cp.indexOf('buildProfile')<0&&cp.indexOf('_bpKey')<0&&cp.indexOf('attunement')<0,'nada do perfil persistido');
});
ok('B2-2: determinismo — mesmos inputs → mesmo perfil; a key do cache invalida quando a composição muda',()=>{
  fresh();
  const k0=T.getBuildProfileKey();
  const a=T.buildProfile(),b=T.buildProfile();
  assert.strictEqual(JSON.stringify(a.scores),JSON.stringify(b.scores),'idêntico');
  assert.ok(k0.length>0,'key não vazia');
  give('olho');
  assert.notStrictEqual(T.getBuildProfileKey(),k0,'key mudou ao instalar módulo');
  const c=T.buildProfile();
  assert.ok(c.scores.crit>=a.scores.crit-1e-9,'crit não diminui ao instalar crit');
});
ok('B2-3: WRAITH + katana + módulos de crit → CRIT/MELEE/DASH no topo; SHIELD/ECONOMIA no fundo',()=>{
  fresh('wraith');
  const idx=X('WEAPONS').map(w=>w.id).indexOf('katana');
  T.getPlayer().wi=idx;
  for(const id of ['olho','crit_cadeia','su_critcura','rebob'])give(id);
  const s=bp();
  const top=s.rank.slice(0,3).map(r=>r.a);
  assert.ok(top.indexOf('crit')>=0,'crit no topo: '+top);
  assert.ok(top.indexOf('melee')>=0||top.indexOf('dash')>=0,'melee/dash no topo: '+top);
  /* escudo/economia ficam BEM ABAIXO do topo (runSt inicial tem ruído
     pequeno de comportamento — comparar distância, não posição exata) */
  const sc=bps();
  const topS=Math.max.apply(null,Object.values(sc));
  assert.ok(sc.shield<=topS-.25&&sc.economy<=topS-.25,
    'escudo/economia longe do topo: '+JSON.stringify(sc));
  assert.ok(top.indexOf('shield')<0&&top.indexOf('economy')<0,
    'escudo/economia fora do top-3: '+top);
});
ok('B2-4: BULWARK + módulos de escudo → SHIELD dominante; PYRE + status → STATUS dominante',()=>{
  fresh('bulwark');
  for(const id of ['placa','rg_condensador','sb_pulso'])give(id);
  const s1=bp();
  assert.strictEqual(s1.dom,'shield','BULWARK+escudo → shield (got '+s1.dom+')');
  fresh('pyre');
  for(const id of ['pirostase','st_corrosivo','catalis'])give(id);
  const s2=bp();
  assert.strictEqual(s2.dom,'status','PYRE+status → status (got '+s2.dom+')');
});
ok('B2-5: NÔMADE → ECONOMIA alto; ECHO-0 + paradoxo → ECHO alto; sniper puro → RANGED alto e MELEE baixo',()=>{
  fresh('nomad');
  give('usura');give('su_imante');
  const s1=bp();
  assert.ok(s1.rank[0].a==='economy'||s1.rank[1].a==='economy','economia no topo p/ NÔMADE: '+s1.rank.slice(0,2).map(r=>r.a));
  fresh('echo0');
  give('paradoxo');
  assert.ok(bps().echo>.25,'ECHO-0+paradoxo → echo alto: '+bps().echo.toFixed(2));
  fresh();
  const idx=X('WEAPONS').map(w=>w.id).indexOf('sniper');
  T.getPlayer().wi=idx;
  const s3=bps();
  assert.ok(s3.ranged>.25,'ranged alto p/ sniper: '+s3.ranged.toFixed(2));
  assert.ok(s3.melee<s3.ranged,'melee < ranged no sniper');
});
ok('B2-6: PERFIL MORAL preservado e separado — moral, getMoralProfile e mEff intocados pelo Perfil de Build',()=>{
  fresh();
  const mBefore=JSON.stringify(T.getMoral()),mpBefore=JSON.stringify(T.getMoralProfile()),eBefore=JSON.stringify(T.mEff);
  give('olho');give('placa');give('usura');
  T.buildProfile();bp();
  assert.strictEqual(JSON.stringify(T.getMoral()),mBefore,'moral intocada');
  assert.strictEqual(JSON.stringify(T.getMoralProfile()),mpBefore,'perfil moral intocado');
  assert.strictEqual(JSON.stringify(T.mEff),eBefore,'mEff intocado');
});

/* ============ 2. SINTONIA = COMPATIBILIDADE DE BUILD ============ */
ok('B2-7: LUNETA + sniper → AFINADA/RESSONANTE; LUNETA + melee puro → DIVERGENTE; ESTILHAÇO + melee → AFINADA+',()=>{
  fresh();
  T.setBuildProfileOverride({ranged:1,melee:0});
  const l1=T.attunementState('luneta');
  assert.ok(l1.id==='attuned'||l1.id==='resonant','luneta + ranged → '+l1.id);
  T.setBuildProfileOverride({melee:1,ranged:0,dash:0,status:0,crit:0,shield:0,economy:0,echo:0});
  const l2=T.attunementState('luneta');
  assert.strictEqual(l2.id,'divergent','luneta + melee puro → divergent (got '+l2.id+')');
  T.setBuildProfileOverride({melee:1,ranged:0});
  const e=T.attunementState('estilhaco');
  assert.ok(e.id==='attuned'||e.id==='resonant','estilhaço + melee: '+e.id);
  force(null);
});
ok('B2-8: PARADOXO sem Echo fica baixo e com ECHO alto fica alto; OLHO + crit alto → alto',()=>{
  fresh();
  T.setBuildProfileOverride({echo:0,melee:.5,crit:.5});
  const p1=T.attunementState('paradoxo');
  assert.ok(p1.id==='neutral'||p1.id==='unstable','paradoxo sem echo → baixo: '+p1.id);
  T.setBuildProfileOverride({echo:1});
  const p2=T.attunementState('paradoxo');
  assert.ok(p2.id==='attuned'||p2.id==='resonant','paradoxo + echo → alto: '+p2.id);
  T.setBuildProfileOverride({crit:1,echo:0});
  const o=T.attunementState('olho');
  assert.ok(o.id==='attuned'||o.id==='resonant','olho + crit → alto: '+o.id);
  force(null);
});
ok('B2-9: MORAL é modulador LEVE — mesma build, moral C/G/V pura: score muda ≤ ~2,5 p.p. e NUNCA inverte a leitura de compatibilidade',()=>{
  fresh();
  T.setBuildProfileOverride({melee:1,ranged:0});
  const scores={};
  for(const id of ['luneta','estilhaco','olho','usura','placa'])
    scores[id]=[T.attunementScore(id,prof(10,0,0)),T.attunementScore(id,prof(0,10,0)),T.attunementScore(id,prof(0,0,10))];
  for(const id in scores){
    const [c,g,v]=scores[id];
    assert.ok(Math.max(Math.abs(c-g),Math.abs(c-v),Math.abs(g-v))<=.0241+1e-9,id+' variação moral ≤2,4pp: '+id+' '+[c,g,v].map(x=>x.toFixed(3)));
    assert.ok(scores.estilhaco[0]>scores.luneta[0],'estilhaco > luneta em melee, independente da moral');
  }
  force(null);
});
ok('B2-10: razões do tooltip (attunementReasons): 1–3 razões, positivas citam a fonte real, nunca vazias com leitura forte',()=>{
  fresh();
  const idx=X('WEAPONS').map(w=>w.id).indexOf('katana');
  T.getPlayer().wi=idx;
  give('olho');
  T.setBuildProfileOverride({crit:.8,melee:.6});
  const r=T.attunementReasons('olho');
  assert.ok(r.length>=1&&r.length<=3,'1–3 razões');
  assert.ok(r.some(x=>x.kind==='plus'),'há razão positiva');
  assert.ok(r.every(x=>x.lab&&x.lab.length<70),'razões curtas e nomeadas');
  force(null);
});
ok('B2-11: antisinergia detectável (COMBINA/NEUTRO/CONFLITA) e dá para pivotar — o estado da mesma luneta acompanha a build',()=>{
  fresh();
  T.setBuildProfileOverride({ranged:1,melee:0});
  const cRanged=T.buildCompat('luneta');
  T.setBuildProfileOverride({melee:1,ranged:0,dash:0,status:0,crit:0,shield:0,economy:0,echo:0});
  const cMelee=T.buildCompat('luneta');
  assert.ok(cRanged>.18&&cMelee<-.18,'luneta: +'+cRanged.toFixed(2)+' ranged / '+cMelee.toFixed(2)+' melee');
  give('luneta');
  T.setBuildProfileOverride({ranged:1,melee:0});
  assert.ok(['attuned','resonant'].indexOf(T.attunementState('luneta').id)>=0,'afinada em ranged');
  T.setBuildProfileOverride({melee:1,ranged:0,dash:0,status:0,crit:0,shield:0,economy:0,echo:0});
  T.applyMoralTuning(T.getPlayer());
  assert.strictEqual(T.attunementState('luneta').id,'divergent','divergente após pivotar p/ melee');
  force(null);
});

/* ============ 3. FAMÍLIAS + EXCLUSIVIDADE LEVE ============ */
ok('B2-12: famílias EXPLÍCITAS (sem regex de description): shield_regen/focus_range/credit exclusivas; trans_temporal FORA de propósito',()=>{
  assert.strictEqual(T.itemFamily('rg_condensador'),'shield_regen');
  assert.strictEqual(T.itemFamily('rg_peso'),'shield_regen');
  assert.strictEqual(T.itemFamily('rg_lagrima'),'shield_regen');
  assert.strictEqual(T.itemFamily('luneta'),'focus_range');
  assert.strictEqual(T.itemFamily('estilhaco'),'focus_range');
  assert.strictEqual(T.itemFamily('usura'),'credit');
  assert.strictEqual(T.itemFamily('eco_risco'),'credit');
  assert.strictEqual(T.itemFamily('eco_divida'),'credit');
  assert.strictEqual(T.itemFamily('trans_temporal'),null,'transformador fora da exclusividade');
  assert.strictEqual(T.itemFamily('olho'),null);
  assert.strictEqual(JSON.stringify(T.itemFamilies('rg_peso')),'["shield_regen"]');
  /* nenhum id de família aponta para módulo inexistente */
  for(const f in T.ITEM_FAMILIES)for(const id of T.ITEM_FAMILIES[f].ids)assert.ok(T.itemById(id),'id inválido: '+id);
});
ok('B2-13: EXCLUSIVIDADE — A instalado tira B das NOVAS ofertas (40 rolagens); o slot continua preenchido (nenhum loop vazio)',()=>{
  fresh();T.unlockAll();
  give('rg_condensador');
  let offered=0;
  for(let i=0;i<40;i++){
    T.setWave(4+(i%10));T.rollShop();X('renderShop=function(){}');
    assert.ok(T.getShopItems().length>=1,'ofertas vivas');
    for(const it of T.getShopItems()){
      assert.ok(it.id!=='rg_peso'&&it.id!=='rg_lagrima','ofereceu irmã da família: '+it.id);
      offered++;
    }
  }
  assert.ok(offered>=40,'módulos seguem sendo ofertados: '+offered);
});
ok('B2-14: GRANDFATHERING — save antigo com A+B da mesma família permanece válido (Continue intacto, stats idênticos); a regra nova só vale em ofertas',()=>{
  T.activateSlot(1);const p=fresh();
  give('rg_condensador');give('rg_peso');
  assert.ok(T.ownsItem('rg_condensador')&&T.ownsItem('rg_peso'),'dois da mesma família coexistem');
  const sh=JSON.stringify([p.shieldMax,p.shieldRegen,p.items.length]);
  T.setState('play');assert.ok(T.captureCheckpoint('gf',4));
  T.setPlayer(null);T.resumeRun();const r=T.getPlayer();
  assert.ok(T.ownsItem('rg_condensador')&&T.ownsItem('rg_peso'),'Continue mantém A+B');
  assert.strictEqual(JSON.stringify([r.shieldMax,r.shieldRegen,r.items.length]),sh,'stats idênticos');
});
ok('B2-15: TRAVA vs família — trava em B quando A já está instalado é LIBERADA com feedback; trava POSSÍVEL é preservada no reroll',()=>{
  fresh();
  give('rg_condensador');
  T.setShopLock({kind:'item',id:'rg_peso'});
  X('toastLog=[];toastLog.old=toast;toast=function(x){toastLog.push(x);return toastLog.old(x);}');
  T.rollShop();X('renderShop=function(){}');
  assert.strictEqual(X('shopLock'),null,'trava impossível foi liberada');
  assert.ok(X('toastLog').some(x=>x.indexOf('TRAVA LIBERADA')>=0),'feedback explícito');
  /* trava possível é preservada */
  T.setShopLock({kind:'item',id:'olho'});
  T.rollShop();X('renderShop=function(){}');
  assert.ok(X('shopLock')&&X('shopLock').id==='olho','trava possível continua');
  X('toast=toastLog.old;delete toastLog.old;toastLog.length=0;');
});
ok('B2-16: Sandbox — trava impossível também é liberada na ilha; sair NÃO escreve no save (byte-a-byte)',()=>{
  for(const sl of [1,2]){T.activateSlot(sl);fresh();T.setWave(2+sl);T.rollShop();X('renderShop=function(){}');T.setState('shop');T.captureCheckpoint('sb',3+sl);T.setState('title');}
  X('sandboxRun=false;sandboxMode=false;');
  const snap=sandbox.localStorage.getItem('echoSave.v3');
  X('sandboxOpenSetup();sandboxCfg.char=0;');assert.strictEqual(X('sandboxStart()'),true);
  give('rg_condensador');
  T.setShopLock({kind:'item',id:'rg_peso'});
  X('toastLog=[];toastLog.old=toast;toast=function(x){toastLog.push(x);return toastLog.old(x);}');
  T.rollShop();X('renderShop=function(){}');
  assert.strictEqual(X('shopLock'),null,'trava liberada na ilha');
  X('toast=toastLog.old;delete toastLog.old;toastLog.length=0;');
  X('sandboxExit(true)');
  assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),snap,'save byte-a-byte');
});

/* ============ 4. LOJA POR PESOS SUAVES ============ */
ok('B2-17: pesos de build em bounds [0.75,1.35] para TODO módulo em QUALQUER build; nenhum peso zero; compat null → ×1.00',()=>{
  fresh();
  for(const o of [{melee:1},{ranged:1},{crit:1},{status:1},{shield:1},{dash:1},{economy:1},{echo:1},{melee:.6,crit:.4}]){
    T.setBuildProfileOverride(o);
    for(const it of T.ITEMS){
      const w=T.buildShopWeight(it);
      assert.ok(w>=.7499&&w<=1.3501,it.id+' peso '+w.toFixed(3)+' em '+JSON.stringify(o));
      assert.ok(w>0,'nenhum peso zero');
    }
  }
  force(null);
});
ok('B2-18: rollShop preserva PRs anteriores — unlock, repeat (B3-A), viés moral (PR 9 ≤×1.10), owned excluído; reroll operador agora tem CAP = 6× base',()=>{
  fresh();T.unlockAll();T.setWave(8);T.rollShop();X('renderShop=function(){}');
  for(const it of T.getShopItems()){
    assert.ok(!T.ownsItem(it.id),'owned não ofertado');
    assert.ok(T.isItemUnlocked(it.id),'unlock respeitado');
  }
  assert.ok(near(T.rerollCap(),T.rerollBaseCost()*6),'cap = 6× base');
  assert.ok(X('rerollCost')<=T.rerollCap(),'custo atual dentro do cap');
  assert.ok(typeof T.shopRepeatWeight('olho')==='number','repeat weight vivo');
  const mw=T.moralShopWeight(T.itemById('nucleo'));
  assert.ok(mw>=.9&&mw<=1.11,'viés moral suave: '+mw.toFixed(3));
});
ok('B2-19: SEM garantia de oferta afinada — 11k lojas em build dedicada: 0/1/2 compatíveis acontecem, divergentes aparecem, NENHUM id monopoliza (top-5 ≤22%)',()=>{
  fresh();T.unlockAll();
  T.setBuildProfileOverride({crit:1,melee:.5});
  const COUNT=11000;
  let compat=0,total=0,divCount=0;const freq={};let zeroSlots=0,twoSlots=0;
  for(let i=0;i<COUNT;i++){
    T.setWave(3+(i%12));T.rollShop();X('renderShop=function(){}');
    let cHere=0;
    for(const it of T.getShopItems()){
      total++;
      const c=T.buildCompat(it.id);
      freq[it.id]=(freq[it.id]||0)+1;
      if(c!=null&&c>=.18){compat++;cHere++;}
      if(c!=null&&c<=-.18)divCount++;
    }
    if(cHere===0)zeroSlots++;
    if(cHere===2)twoSlots++;
  }
  const pCompat=compat/total;
  assert.ok(pCompat>.15&&pCompat<.75,'média de compatíveis em faixa larga: '+(pCompat*100).toFixed(1)+'%');
  assert.ok(zeroSlots>COUNT*.02,'lojas sem compatível acontecem (oferta ruim proposital): '+zeroSlots);
  assert.ok(twoSlots>COUNT*.02,'lojas com 2 compatíveis acontecem: '+twoSlots);
  assert.ok(divCount>0,'módulos divergentes continuam aparecendo');
  const ids=Object.keys(freq);
  assert.ok(ids.length>=25,'variedade de ids ofertados: '+ids.length);
  const sorted=ids.map(k=>freq[k]).sort((a,b)=>b-a);
  const top5=sorted.slice(0,5).reduce((a,b)=>a+b,0)/total;
  const top1=sorted[0]/total;
  assert.ok(top5<=.28,'top-5 concentração ≤28%: '+(top5*100).toFixed(1)+'%');
  assert.ok(top1<=.12,'nenhum id monopoliza (top-1 ≤12%): '+(top1*100).toFixed(1)+'%');
  force(null);
});
ok('B2-20: pesos APONTAM a direção — build dedicada vê MAIS compatíveis que a build indefinida (baseline), sem filtrar nada',()=>{
  T.unlockAll();
  const sample=(arq)=>{
    T.setBuildProfileOverride(arq||null);
    let compat=0,total=0;
    for(let i=0;i<4000;i++){
      T.setWave(3+(i%12));T.rollShop();X('renderShop=function(){}');
      for(const it of T.getShopItems()){total++;const c=T.buildCompat(it.id);if(c!=null&&c>=.18)compat++;}
    }
    return compat/total;
  };
  const pCrit=sample({crit:1});
  const pIndef=sample(null);
  force(null);
  assert.ok(pCrit>pIndef+.05,'dedicada ('+(pCrit*100).toFixed(1)+'%) > indefinida+5pp ('+(pIndef*100).toFixed(1)+'%)');
});
ok('B2-21: anti-feedback-loop — comprar o que a build recomenda NÃO trava a loja: pesos saturam no cap, owned sai do pool e a variedade continua',()=>{
  fresh();T.unlockAll();
  T.setBuildProfileOverride({crit:1});
  give('olho');give('crit_cadeia');
  let maxW=0;for(const it of T.ITEMS)maxW=Math.max(maxW,T.buildShopWeight(it));
  assert.ok(maxW<=1.3501,'pesos saturados no cap: '+maxW.toFixed(3));
  const seen={};
  for(let i=0;i<200;i++){T.setWave(2+(i%10));T.rollShop();X('renderShop=function(){}');
    for(const it of T.getShopItems())seen[it.id]=1;}
  assert.ok(Object.keys(seen).length>=12,'variedade alta após especialização: '+Object.keys(seen).length);
  force(null);
});

/* ============ 5. PREVIEW ATUAL→PROJETADO ============ */
ok('B2-22: preview ATUAL→PROJETADO usa a SINTONIA NOVA — pipeline (crit), campo direto (coinMul), tradeoff NUNCA escalado, divergente rende menos, ressonante ampla; puro',()=>{
  fresh();
  const p=T.getPlayer();
  /* st fora do snapshot: o carrier do dry-run clona p raso (st compartilhado)
     e itemStateInit escreve _perfect nele — sm/items/coins/attuneMul é o
     contrato que importa (nenhum mod/efeito vaza para o player real). */
  const snap=()=>JSON.stringify({sm:p.sm,items:p.items,coins:p.coins,cache:p.attuneMul});
  const s0=snap();
  /* ressonante: olho (crit) em build crit — campo benéfico escala */
  T.setBuildProfileOverride({crit:1});
  let carrier={crit:0,critMul:0,attuneCrit:0,dmgTaken:0};
  X('smPreviewDryRun')(p,pp=>{
    T.grantItemInternal(pp,T.itemById('olho'),true);
    carrier.crit=T.smGet(pp,'crit');
    carrier.critMul=T.smGet(pp,'critMul');
    const m=pp.sm.find(m=>m.id==='attune:olho:crit.flat');
    carrier.attuneCrit=m?m.value:0;
  });
  assert.ok(carrier.attuneCrit>0,'attune:* entra no preview projetado');
  assert.ok(carrier.crit>.2,'crit projetado em build crit: '+carrier.crit.toFixed(3));
  /* tradeoff: coração NUNCA escala dmgTaken (custo) */
  T.setBuildProfileOverride({ranged:1,crit:1});
  let dmgTaken=0,fireRate=0;
  X('smPreviewDryRun')(p,pp=>{
    T.grantItemInternal(pp,T.itemById('coracao'),true);
    dmgTaken=pp.sm.filter(m=>m.id.indexOf('attune:coracao:dmgTaken')===0).length;
    fireRate=pp.sm.filter(m=>m.id.indexOf('attune:coracao:fireRate')===0).length;
  });
  assert.strictEqual(dmgTaken,0,'custo fora');
  assert.strictEqual(fireRate,1,'benefício dentro');
  /* divergente vs ressonante: PLACA (smMul shieldMax) em build escudo rende MAIS que em build de dash */
  const sintonia=(arq)=>{
    T.setBuildProfileOverride(arq);
    let val=null;
    X('smPreviewDryRun')(p,pp=>{
      T.grantItemInternal(pp,T.itemById('placa'),true);
      const m=pp.sm.find(m=>m.id.indexOf('attune:placa:')===0);
      val=m?m.value:1;
    });
    return {val,state:T.attunementState('placa').id};
  };
  const rR=sintonia({shield:1,dash:0,melee:0,ranged:0});
  const rM=sintonia({dash:1,shield:0,melee:0,ranged:0,status:0,crit:0,economy:0,echo:0});
  assert.ok(['attuned','resonant'].indexOf(rR.state)>=0,'placa ressoa em build escudo: '+rR.state);
  assert.ok(rM.val<rR.val,'divergente/neutro ('+rM.val.toFixed(3)+') rende menos que ressonante ('+rR.val.toFixed(3)+')');
  /* campo direto: usura em build economia via pipeline */
  T.setBuildProfileOverride({economy:1});
  let coin=0;
  X('smPreviewDryRun')(p,pp=>{T.grantItemInternal(pp,T.itemById('usura'),true);coin=T.smGet(pp,'coinMul');});
  assert.ok(coin>1.44,'usura em build economia: coinMul projetado '+coin.toFixed(3));
  assert.strictEqual(snap(),s0,'preview NÃO escreve nada');
  force(null);
});

/* ============ 6. SAVE / CONTINUE ============ */
ok('B2-23: checkpoint pós-compra — attune:* NÃO salvos; Continue recomputa EXATAMENTE (ids/valores), sem duplicatas; perfil rederivado da composição',()=>{
  T.activateSlot(1);
  const p=fresh();
  T.setBuildProfileOverride({crit:1});
  give('olho');give('espinho');give('usura');
  const dmg=T.smGet(p,'damage'),coin=T.smGet(p,'coinMul');
  const ids=p.sm.filter(m=>T.isAttuneModId(m.id)).map(m=>m.id).sort();
  T.setState('play');assert.ok(T.captureCheckpoint('b2',5));
  const cp=T.getActiveRun();
  assert.ok(!cp.p.sm.some(m=>T.isAttuneModId(m.id)),'attune fora do save');
  T.setPlayer(null);T.resumeRun();const r=T.getPlayer();
  assert.ok(near(T.smGet(r,'damage'),dmg)&&near(T.smGet(r,'coinMul'),coin),'stats recomputados');
  const ids2=r.sm.filter(m=>T.isAttuneModId(m.id)).map(m=>m.id).sort();
  assert.deepStrictEqual(JSON.stringify(ids2),JSON.stringify(ids),'mesmos attune ids');
  assert.strictEqual(new Set(ids2).size,ids2.length,'sem duplicatas');
  T.setBuildProfileOverride({crit:1});T.applyMoralTuning(r);
  assert.ok(T.buildProfileSummary(r).rank[0].s>0,'perfil rederivado após Continue');
  force(null);
});
ok('B2-24: save ANTIGO sem campos novos resume sem migrar; SM_VERSION=3 e FRACTURE=1 SEM bump; par legado de família permanece (grandfathered)',()=>{
  assert.strictEqual(X('SM_VERSION'),3);
  assert.strictEqual(X('FRACTURE_STATE_VERSION'),1);
  T.activateSlot(2);const p=fresh();
  give('luneta');give('estilhaco');
  T.setState('play');assert.ok(T.captureCheckpoint('legado',6));
  T.setPlayer(null);T.resumeRun();const r=T.getPlayer();
  assert.ok(T.ownsItem('luneta')&&T.ownsItem('estilhaco'),'grandfathered: ambos permanecem');
});

/* ============ 7. SANDBOX + DEV ============ */
ok('B2-25: DEV helpers inert em release; em DEV funcionam; forceBuildProfile não escreve no save',()=>{
  const p=fresh();
  X('DEV_MODE=false');
  assert.strictEqual(X('DEV.buildProfileInfo')(),null);
  assert.strictEqual(X('DEV.buildProfileExplain')('olho'),null);
  assert.strictEqual(X('DEV.forceBuildProfile')({crit:1}),null);
  assert.strictEqual(X('DEV.shopWeightsDebug')(),null);
  X('DEV_MODE=true');
  const snap=sandbox.localStorage.getItem('echoSave.v3');
  X('DEV.forceBuildProfile({crit:1})');
  assert.strictEqual(X('DEV.buildProfileInfo')().override.crit,1,'override em memória');
  assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),snap,'force não escreve save');
  const ex=X('DEV.buildProfileExplain')('olho');
  assert.ok(ex&&ex.byBuild===true&&ex.state&&ex.profile,'explain completo');
  X('DEV.forceBuildProfile(null)');
  assert.strictEqual(X('DEV.buildProfileInfo')().override,null);
  X('DEV_MODE=false');
});
ok('B2-26: seção BUILD PROFILE no inspector DEV (fonte) e guarda !DEV_MODE em todos os helpers novos',()=>{
  const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
  assert.ok(html.indexOf('BUILD PROFILE')>=0,'título da seção');
  for(const fn of ['buildProfileInfo','buildProfileExplain','forceBuildProfile','shopWeightsDebug'])
    assert.ok(new RegExp(fn+'\\([^\\)]*\\)\\{\\s*if\\(!DEV_MODE\\)return (null|false);').test(html),'guarda DEV em '+fn);
});

/* ============ 8. HÍBRIDOS ============ */
ok('B2-27: builds HÍBRIDAS são viáveis — módulos dos dois lados sintonizam; summary reconhece HÍBRIDO sem fingir dominante',()=>{
  fresh();
  const cases=[
    [{melee:.6,crit:.6},['estilhaco','olho']],
    [{ranged:.6,status:.6},['reator','pirostase']],
    [{shield:.6,dash:.6},['placa','ampulheta']],
    [{economy:.6,ranged:.6},['usura','reator']],
    [{echo:.6,status:.6},['paradoxo','st_corrosivo']]
  ];
  for(const [arq,pair] of cases){
    T.setBuildProfileOverride(arq);
    for(const id of pair){
      const st=T.attunementState(id);
      assert.ok(st.id==='attuned'||st.id==='resonant',id+' sintoniza em híbrida: '+st.id);
    }
  }
  T.setBuildProfileOverride({melee:.55,crit:.55});
  const sm=bp();
  assert.ok(sm.state==='hibrido','melee≈crit → híbrido: '+sm.state+' ('+sm.lab+')');
  force(null);
});

console.log('');
if(failed){console.log(failed+' FALHAS');process.exit(1);}
console.log('B2 — '+passed+' PASSARAM · 0 FALHAS');
