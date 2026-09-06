'use strict';
/* =====================================================================
   TESTES — PR13.5 · B5.5 · SHOP UX + META REWARD POLISH
   ---------------------------------------------------------------------
   Blocos:
     A. SHOP PREVIEW — pureza, pipeline, Attunement, trade-offs, compra real
     B. SHOP UX — cards renderizados mantêm info crítica; reroll/compra/
        anti-repeat funcionam; Echo Shop intacto
     C. META ECONOMY — reward definido, concessão única, morte/Sandbox/DEV,
        Continue, save, Credits/Resíduos/XP intatos
     D. SANDBOX — byte-for-byte com preview e compra no laboratório
     E. STRESS — determinismo, custo e Save/SM_VERSION intactos

   Usa o harness normalizado (LF/CRLF) do B5-B-FIX.1.
   mkCard consulta '.clock' via querySelector — o DOM de teste não faz
   parser de innerHTML, então este arquivo patcheia document.createElement
   para devolver um stub de nó (apenas neste escopo de suíte).
   ===================================================================== */
const assert=require('assert');
const {sandbox,T,vm,SRC,normalizeSource}=require('../audit_pr135/harness.js');
const X=code=>vm.runInContext(code,sandbox);
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}
}
function seed(value){let x=value>>>0;
  return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function rngCalls(fn){          // conta consumos de Math.random no bloco
  let n=0;const orig=sandbox.Math.random;
  sandbox.Math.random=function(){n++;return orig();};
  try{fn();}finally{sandbox.Math.random=orig;}
  return n;
}
/* stub de '.clock' para mkCard/bindTip sob o DOM de teste */
(function patchCreate(){
  const orig=sandbox.document.createElement.bind(sandbox.document);
  sandbox.document.createElement=t=>{
    const el=orig(t);
    el.querySelector=()=>({addEventListener(){},classList:{add(){},remove(){},
      contains:()=>false},remove(){}});
    return el;
  };
})();
function fresh(moral){
  sandbox.Math.random=seed(0xB552026);
  X('DEV_MODE=false;devTainted=false;sandboxRun=false;sandboxMode=false;');
  T.activateSlot(1);T.startRun();
  T.setMoral(moral||{comp:0,greed:0,viol:0});
  X('applyMoral();applyMoralTuning(player);');
  return T.getPlayer();
}
function saveSnap(){return sandbox.localStorage.getItem('echoSave.v3');}

console.log('\nECHO — PR13.5 · B5.5 · SHOP UX + META REWARD');
console.log('---------------------------------------------');

/* =====================================================================
   A. SHOP PREVIEW
   ===================================================================== */
ok('B55-A1: preview não muta player/sm/items/moral/save e não consome RNG',()=>{
  const p=fresh({comp:0,greed:0,viol:10});
  for(const id of ['nucleo','olho'])T.giveItem(T.itemById(id),true); // sintonia ativa
  const snap=()=>JSON.stringify({sm:p.sm,items:p.items,st:p.itemState,
    coins:p.coins,hp:p.hp,maxHp:p.maxHp,ver:p.itemVer,
    moral:T.getMoral(),save:saveSnap()});
  const s0=snap();
  const rng=rngCalls(()=>{
    for(const it of T.ITEMS)T.shopItemPreview(it);
    for(const u of T.UPGRADES)T.shopUpgPreview(u);
  });
  assert.strictEqual(rng,0,'preview não consome RNG');
  assert.strictEqual(snap(),s0,'nenhuma mutação em player/moral/save');
});

ok('B55-A2: preview é determinístico (2× igual) para todo o catálogo',()=>{
  fresh({comp:0,greed:0,viol:10});
  for(const it of T.ITEMS){
    const a=JSON.stringify(T.shopItemPreview(it));
    const b=JSON.stringify(T.shopItemPreview(it));
    assert.strictEqual(a,b,'determinismo: '+it.id);
  }
  for(const u of T.UPGRADES){
    const a=JSON.stringify(T.shopUpgPreview(u));
    const b=JSON.stringify(T.shopUpgPreview(u));
    assert.strictEqual(a,b,'determinismo: '+u.id);
  }
});

ok('B55-A3: preview usa o PIPELINE REAL — flat/addPct/mul combinados exatos',()=>{
  const p=fresh();
  /* build mista em 'crit': base 5% + flat +10% + add +50% + mul ×2
     valor atual: (0.05+0.10)*(1+0.5)*2 = 0.45 */
  X('smFlat(player,"crit","t.flat","flat",.10);smAddPct(player,"crit","t.add","add",.5);smMul(player,"crit","t.mul","mul",2);');
  assert.strictEqual(+T.smGet(p,'crit').toFixed(9),0.45);
  const rows=T.shopUpgPreview(T.UPGRADES.find(u=>u.id==='crit')); // +8% flat
  const row=rows.find(r=>r.k==='crit');
  /* projetado: (0.05+0.10+0.08)*(1+0.5)*2 = 0.69 — mesma aritmética do smGet */
  assert.strictEqual(+row.after.toFixed(9),0.69);
  assert.strictEqual(+row.before.toFixed(9),0.45);
});

ok('B55-A4: preview respeita Attunement — igual à compra real e ao estado projetado',()=>{
  /* RESSONANTE (viol 10): ganho do nucleo amplificado ×1.12 — e o preview
     é IDÊNTICO ao resultado da compra real (via giveItem). */
  let p=fresh({comp:0,greed:0,viol:10});
  let info=T.attunementInfo('nucleo');
  assert.strictEqual(info.state.id,'resonant');
  let base=T.smGet(p,'damage');
  let rows=T.shopItemPreview(T.itemById('nucleo'));
  let dmg=rows.find(r=>r.k==='damage');
  let hp=rows.find(r=>r.k==='maxHp');
  T.giveItem(T.itemById('nucleo'),true);           // compra real (mesma via)
  assert.strictEqual(+T.smGet(p,'damage').toFixed(9),+dmg.after.toFixed(9),
    'dano projetado = compra real (sintonia incluída)');
  assert.ok(T.smGet(p,'damage')>base*1.30,'RESSONANTE amplifica o ganho');
  assert.strictEqual(hp.after,hp.before*0.85,'perda de maxHp NÃO é aliviada');
  /* DIVERGENTE (comp 10): ganho reduzido ×0.90; trade-off intacto */
  p=fresh({comp:10,greed:0,viol:0});
  info=T.attunementInfo('nucleo');
  assert.strictEqual(info.state.id,'divergent');
  base=T.smGet(p,'damage');
  rows=T.shopItemPreview(T.itemById('nucleo'));
  dmg=rows.find(r=>r.k==='damage');
  hp=rows.find(r=>r.k==='maxHp');
  T.giveItem(T.itemById('nucleo'),true);
  assert.strictEqual(+T.smGet(p,'damage').toFixed(9),+dmg.after.toFixed(9));
  assert.ok(T.smGet(p,'damage')<base*1.30,'DIVERGENTE reduz o ganho');
  assert.strictEqual(hp.after,hp.before*0.85,'perda base intacta (não agravada)');
});

ok('B55-A5: typed range — luneta projeta rangedRange ×1.7 e meleeRange ×0.92',()=>{
  fresh();
  const rows=T.shopItemPreview(T.itemById('luneta'));
  const rr=rows.find(r=>r.k==='rangedRange'),mr=rows.find(r=>r.k==='meleeRange');
  assert.ok(rr&&+rr.after.toFixed(6)===1.7);
  assert.ok(mr&&+mr.after.toFixed(6)===0.92);
  /* upgrade range (smRangeBoth) projeta as DUAS semânticas */
  const u=T.shopUpgPreview(T.UPGRADES.find(x=>x.id==='range'));
  assert.ok(u.find(r=>r.k==='meleeRange').after>1&&u.find(r=>r.k==='rangedRange').after>1);
});

ok('B55-A6: shieldMax/regen/delay corretos (placa ×1.15/maxHp+55; sb_pulso delay ×1.3)',()=>{
  fresh();
  const rows=T.shopItemPreview(T.itemById('placa'));
  const hm=rows.find(r=>r.k==='maxHp'),sm=rows.find(r=>r.k==='shieldMax');
  const p=T.getPlayer();
  assert.strictEqual(hm.after,p.maxHp+55);
  assert.strictEqual(+sm.after.toFixed(6),+(p.shieldMax*1.15).toFixed(6));
  const r2=T.shopItemPreview(T.itemById('sb_pulso'));
  const sd=r2.find(r=>r.k==='shieldDelay');
  assert.strictEqual(+sd.after.toFixed(6),+(p.shieldDelay*1.30).toFixed(6));
  assert.strictEqual(sd.inv,true,'delay é stat invertido (menor é melhor)');
});

ok('B55-A7: trade-offs mostram ganho E perda (nucleo, coracao, estilhaco)',()=>{
  fresh();
  for(const id of ['nucleo','coracao','estilhaco']){
    const disp=T.previewDisplayRows(T.shopItemPreview(T.itemById(id)));
    const good=r=>r.inv?r.delta<0:r.delta>0;
    assert.ok(disp.some(r=>good(r)),id+' mostra ganho');
    assert.ok(disp.some(r=>!good(r)),id+' mostra perda');
  }
});

ok('B55-A8: PROC/HOOK/CONDITIONAL não recebem número inventado',()=>{
  fresh();
  /* sem mod no pipeline nem campo direto observável → ZERO linhas + chip */
  for(const id of ['talisma','vinganca','su_sorte','condutor','reator']){
    const it=T.itemById(id);
    const rows=T.shopItemPreview(it)||[];
    assert.strictEqual(rows.length,0,id+' não projeta número duvidoso');
    const chip=T.shopEffectChip(it);
    assert.ok(/EFEITO (CONDICIONAL|EM GATILHOS)/.test(chip),id+' chip coerente');
  }
  /* campo direto observável (dashCdMax) projeta de verdade — rebob */
  const rb=T.shopItemPreview(T.itemById('rebob'));
  const dash=rb.find(r=>r.k==='dashCdMax');
  assert.ok(dash&&Math.abs(dash.after-dash.before*1.25)<1e-9,
    'rebob projeta a recarga real do dash');
  /* transformador: sem chip duplicado (selo próprio) */
  assert.strictEqual(T.shopEffectChip(T.itemById('trans_fratura')),'');
});

ok('B55-A9: compra REAL produz o resultado projetado (determinístico)',()=>{
  const p=fresh({comp:0,greed:0,viol:10});
  const rows=T.shopItemPreview(T.itemById('olho'));
  const dRow=rows.find(r=>r.k==='damage'),cRow=rows.find(r=>r.k==='crit');
  T.giveItem(T.itemById('olho'),true);             // mesma via do jogo
  assert.strictEqual(+T.smGet(p,'damage').toFixed(9),+dRow.after.toFixed(9));
  assert.strictEqual(+T.smGet(p,'crit').toFixed(9),+cRow.after.toFixed(9));
  /* upgrade: mesmíssimo apply */
  const p2=fresh();
  const u=T.UPGRADES.find(x=>x.id==='dmg');
  const ur=T.shopUpgPreview(u).find(r=>r.k==='damage');
  u.apply(p2);
  assert.strictEqual(+T.smGet(p2,'damage').toFixed(9),+ur.after.toFixed(9));
});

ok('B55-A10: buffEchoes do PARADOXO ECOANTE não vaza no preview (Ecos intatos)',()=>{
  fresh();
  const fake={slot:0,alive:true,x:100,y:100,hue:'#fff',hp:50,maxHp:50,mul:1,
    dom:'comp',trust:50,itemIds:[],data:{wave:1}};
  T.setEchoes([fake]);
  const before=JSON.stringify({hp:fake.hp,mul:fake.mul});
  const ringSrc=X('spawnRing.toString()');          // fonte real p/ restaurar
  X('spawnRing=function(){globalThis.__sp=(globalThis.__sp||0)+1;}');
  const ft0=T.getFtexts().length;
  T.shopItemPreview(T.itemById('paradoxo'));
  vm.runInContext('spawnRing=('+ringSrc+')',sandbox);   // restaura a real
  assert.strictEqual(X('globalThis.__sp')||0,0,'nenhuma partícula');
  assert.strictEqual(JSON.stringify({hp:fake.hp,mul:fake.mul}),before,
    'Ecos reais intatos');
  assert.strictEqual(T.getFtexts().length,ft0,'sem floatText');
});

ok('B55-A11: preview não altera shop history, rerollCost nem economy',()=>{
  fresh();
  T.setWave(3);T.rollShop();
  const hist=JSON.stringify(T.getShopRecent());
  const rc=X('rerollCost');
  for(const it of T.getShopItems())T.shopItemPreview(it);
  for(const u of T.getShopOffers())T.shopUpgPreview(u);
  assert.strictEqual(JSON.stringify(T.getShopRecent()),hist,'history intacto');
  assert.strictEqual(X('rerollCost'),rc,'rerollCost intacto');
});

/* =====================================================================
   B. SHOP UX
   ===================================================================== */
function renderShopAndGetCards(){
  fresh();
  T.setWave(3);T.rollShop();X('renderShopOp()');
  const row=X('document.getElementById("m-row").children');
  const row2=X('document.getElementById("m-row2").children');
  return {row:Array.from(row),row2:Array.from(row2)};
}
ok('B55-B1: card de upgrade mantém nome, raridade, efeito, preço — e ganha impacto',()=>{
  const {row}=renderShopAndGetCards();
  assert.ok(row.length>=3,'3 ofertas de upgrade');
  for(const c of row){
    const h=c.innerHTML;
    assert.ok(h.indexOf('cprice')>=0&&h.indexOf('◈')>=0,'preço visível');
    assert.ok(h.indexOf('cds')>=0,'efeito/nome visível');
    assert.ok(h.indexOf('cimpact')>=0,'impacto projetado visível');
    assert.ok(h.indexOf('→')>=0,'seta atual→projetado');
  }
});

ok('B55-B2: card de módulo mantém descrição, sintonia compacta e preço',()=>{
  const {row2}=renderShopAndGetCards();
  const itemCards=row2.filter(c=>c.innerHTML.indexOf('cprice')>=0&&
    c.innerHTML.indexOf('cmoral')>=0);
  assert.ok(itemCards.length>0,'há módulos com sintonia no estoque');
  for(const c of itemCards){
    const h=c.innerHTML;
    assert.ok(h.indexOf('◈')>=0,'preço visível');
    assert.ok(h.indexOf('SINTONIA')>=0,'sintonia acessível (não hover-only)');
    assert.ok(h.indexOf('cmo')>=0,'versão compacta em uso');
    const it=T.ITEMS.find(i=>h.indexOf(i.nm)>=0);
    if(it&&T.MORAL_AFFINITY[it.id]){
      const info=T.attunementInfo(it.id);
      assert.ok(h.indexOf(info.state.lab)>=0,'estado projetado no card');
      assert.ok(h.indexOf(info.effect)>=0,'efeito no card');
    }
  }
});

ok('B55-B3: card de arma enxuto — efeito+alcance presentes; classe/slot no tooltip',()=>{
  const {row2}=renderShopAndGetCards();
  const gunCards=row2.filter(c=>c.innerHTML.indexOf('⌖')>=0);
  if(!gunCards.length)return;                      // estoque pode não ter arma
  for(const c of gunCards){
    const h=c.innerHTML;
    assert.ok(h.indexOf('ALCANCE')>=0,'alcance visível');
    assert.ok(h.indexOf('CLASSE:')<0,'classe migrou do corpo (tooltip)');
    assert.ok(h.indexOf('alterna com')<0,'controle migrou do corpo');
    assert.ok(h.indexOf('ARSENAL CHEIO')>=0||h.indexOf('SLOT LIVRE')>=0,
      'estado do arsenal na linha de preço');
  }
  const d=T.WEAPONS.find(w=>w.price);
  const tip=T.weaponTipHTML(d);
  assert.ok(tip.indexOf('CLASSE:')>=0&&tip.indexOf('ALTERNA COM <b>Q</b>')>=0,
    'info preservada no tooltip');
});

ok('B55-B4: itens condicionais/proc exibem chip legível sem hover',()=>{
  let found=false;
  for(let attempt=0;attempt<400&&!found;attempt++){
    fresh();
    sandbox.Math.random=seed(0xB55+attempt);
    T.setWave(4);T.rollShop();
    for(const it of T.getShopItems()){
      if(['rebob','talisma','vinganca','su_sorte'].indexOf(it.id)>=0){
        X('renderShopOp()');
        const row2=Array.from(X('document.getElementById("m-row2").children'));
        const card=row2.find(c=>c.innerHTML.indexOf(it.nm)>=0);
        assert.ok(card,'card do item '+it.id+' renderizado');
        const hasChip=card.innerHTML.indexOf('cchip')>=0;
        const hasImpact=card.innerHTML.indexOf('cimpact')>=0;
        assert.ok(hasChip||hasImpact,it.id+' sinalização numérica ou chip no card');
        found=true;
      }
    }
  }
  assert.ok(found,'estoque com item não numérico apareceu na amostra');
});

function clickEl(el){                           // dispara o handler registrado
  const fns=el._ev&&el._ev.click;
  assert.ok(fns&&fns.length,'elemento tem handler de clique');
  fns[0]();
}
ok('B55-B5: reroll continua funcionando (grátis, pago, história, re-render)',()=>{
  fresh();
  T.setWave(3);T.rollShop();X('rerollCost=rerollBaseCost();renderShopOp()');
  const p=T.getPlayer(),seq0=X('shopRollSeq');
  const free0=p.freeRerolls|0,coins0=p.coins;
  X('mReroll.onclick()');                       // 1º clique
  if(free0>0){
    assert.strictEqual(p.freeRerolls,free0-1,'consome o reroll grátis');
    assert.strictEqual(p.coins,coins0,'reroll grátis não cobra');
  }
  /* reroll PAGO: esgota os grátis, dá créditos e clica de novo */
  X('player.freeRerolls=0;player.coins=100;renderShopOp()');
  const paidCoins=p.coins,paidCost=X('fractureShopRerollCost(rerollCost)');
  X('mReroll.onclick()');
  assert.strictEqual(p.coins,paidCoins-paidCost,'cobrou o reroll pago');
  assert.ok(X('shopRollSeq')>seq0,'novas visitas registradas');
  const row=Array.from(X('document.getElementById("m-row").children'));
  assert.ok(row.length>=1&&row[0].innerHTML.indexOf('cimpact')>=0,
    're-render com impacto (reroll mantém o novo card)');
});

ok('B55-B6: compra continua funcionando e cria checkpoint',()=>{
  fresh();
  T.setWave(3);T.rollShop();
  X('player.coins=100000;renderShopOp()');      // nenhuma oferta desabilitada
  const p=T.getPlayer(),coins0=p.coins;
  clickEl(X('document.getElementById("m-row").children[0]'));
  assert.ok(p.coins<coins0,'cobrou a compra');
  assert.strictEqual(X('hasActiveRun()'),true,'checkpoint de compra criado');
});

ok('B55-B7: anti-repeat/history intactos (peso de repetição após compra)',()=>{
  fresh();
  T.setWave(3);T.rollShop();
  const id=T.getShopOffers()[0].id;
  T.shopMarkBought(id);
  assert.strictEqual(T.shopRepeatWeight(id),1,'comprado nunca é penalizado');
  T.rollShop();
  const sid=T.getShopOffers()[0].id;               // não comprado nesta visita
  assert.ok(T.shopRepeatWeight(sid)<1,'oferta não comprada pesa menos (d=0)');
});

ok('B55-B8: Echo Shop não usa preview de player e loja vazia segue utilizável',()=>{
  /* contrato estrutural: o render da aba Echo não invoca preview do player */
  const seg=normalizeSource(SRC).slice(normalizeSource(SRC).indexOf('function renderShopEcho()'));
  const echoBlock=seg.slice(0,seg.indexOf('function ',10));
  assert.ok(echoBlock.indexOf('shopItemPreview')<0&&
    echoBlock.indexOf('shopUpgPreview')<0,'aba Echo sem preview do player');
  /* estoque vazio: mensagem de estado e botões intactos */
  fresh();T.resetShopVars();X('renderShopOp()');
  assert.ok(X('document.getElementById("m-row").innerHTML').indexOf('ESGOTADO')>=0,
    'estado de estoque vazio legível');
  assert.ok(X('document.getElementById("m-reroll").textContent').indexOf('REROLL')>=0,
    'reroll permanece acessível');
});

ok('B55-B9: DEV.shopPreview/DEV.metaEconomy — inertes fora do DEV, úteis dentro',()=>{
  fresh();X('DEV_MODE=false');
  assert.strictEqual(X('DEV.shopPreview("nucleo")'),false,'fora do DEV: inerte');
  assert.strictEqual(X('DEV.metaEconomy()'),false,'fora do DEV: inerte');
  X('DEV_MODE=true');
  const sp=X('DEV.shopPreview("nucleo")');
  assert.ok(sp&&sp.rows.length>=2,'preview por id no DEV');
  assert.strictEqual(X('DEV.shopPreview("id_inexistente")'),false,'id inválido');
  const me=X('DEV.metaEconomy()');
  assert.strictEqual(me.totalCost,720,'custo total real do META_SHOP');
  assert.strictEqual(me.decay,1,'decaimento visível');
  X('DEV_MODE=false');
});

/* =====================================================================
   C. META ECONOMY
   ===================================================================== */
function setupVictoryState(){
  const p=fresh();
  T.setWave(20);X('kills=502;runTime=1234;');
  p.level=13;p.coins=300;p.items=['placa','olho','luneta','reator'];
  X('meta.mem=0;meta.wins=0;');
  X('saveMeta();');                                 // baseline persistido
  return p;
}
ok('B55-C1: reward corresponde EXATAMENTE ao valor definido (fórmula + decaimento)',()=>{
  const p=setupVictoryState();
  const key=X('resolveEnding().key');
  const bonus={liber:25,tirano:18,dueto:22,refugio:20,silencio:18,exilio:15}[key]||0;
  const expected=Math.round((20*1.2+502*.18+13*1.2+300*.07+4*5+bonus+12)*1);
  X('onVictory()');
  assert.strictEqual(T.getState(),'victory');
  assert.strictEqual(T.getMeta().mem,expected,'1ª vitória: '+expected+'◆ ('+key+')');
  assert.strictEqual(T.getMeta().wins,1);
});

ok('B55-C2: vitória concede EXATAMENTE uma vez (reentrada bloqueada)',()=>{
  setupVictoryState();
  X('onVictory()');
  const mem1=T.getMeta().mem;
  X('onVictory()');                                 // callback duplicado
  X('onVictory()');
  assert.strictEqual(T.getMeta().mem,mem1,'memória concedida uma única vez');
  assert.strictEqual(T.getMeta().wins,1);
});

ok('B55-C3: MORTE não concede ◆ Memória (fonte única em onVictory)',()=>{
  const p=setupVictoryState();
  const n=(normalizeSource(SRC).match(/meta\.mem\+=/g)||[]).length;
  assert.strictEqual(n,1,'única atribuição de meta.mem no jogo');
  X('damagePlayer(1e9)');
  assert.ok(T.getState()!=='victory','morte não vira vitória');
  assert.strictEqual(T.getMeta().mem,0,'morte não concede');
});

ok('B55-C4: SANDBOX não concede ◆ Memória (rota sandboxVictory)',()=>{
  T.activateSlot(2);T.setState('title');X('sandboxRun=false;sandboxMode=false;');
  const save0=saveSnap();const meta0=JSON.stringify(T.getMeta());
  X('sandboxOpenSetup();sandboxCfg.char=0;sandboxCfg.wave=20;');
  assert.strictEqual(X('sandboxStart()'),true);
  const b=T.getBoss();const p=T.getPlayer();
  p.hp=1e9;p.maxHp=1e9;p.x=600;p.y=400;b.spawnT=0;b.hp=b.maxHp*.49;
  X('updateBoss')(b,1/60);
  X('curAttacker=player');X('damageEnemy')(b,1e12,0,0,false);
  assert.strictEqual(T.getState(),'victory');
  X('sandboxExit(true)');
  assert.strictEqual(JSON.stringify(T.getMeta()),meta0,'meta intocada');
  assert.strictEqual(saveSnap(),save0,'save byte-a-byte');
});

ok('B55-C5: DEV tainted não contamina a meta persistida',()=>{
  const p=setupVictoryState();
  const save0=saveSnap();
  X('devTainted=true');
  assert.strictEqual(X('saveMeta()'),false,'saveMeta bloqueado em run DEV');
  X('meta.mem+=500;meta.wins++;');                  // tentativa de persistir
  assert.strictEqual(X('saveMeta()'),false);
  assert.strictEqual(saveSnap(),save0,'localStorage byte-a-byte');
  X('devTainted=false;loadMeta();');
  assert.strictEqual(T.getMeta().mem,0,'RAM reverge ao valor persistido');
});

ok('B55-C6: Continue não duplica reward (run limpa após a vitória)',()=>{
  setupVictoryState();
  X('captureCheckpoint("loja",20)');                // existe run ativa
  assert.strictEqual(X('hasActiveRun()'),true);
  X('onVictory()');
  assert.strictEqual(X('hasActiveRun()'),false,'clearActiveRun após conceder');
  /* sem run ativa, retomar reinicia do zero — não reexecuta a vitória */
  X('resumeRun()');
  assert.ok(T.getState()!=='victory','retomada não repara vitória antiga');
  /* ordem textual: grant → clearActiveRun (sem janela de duplicação) */
  const src=normalizeSource(SRC);
  const i1=src.indexOf('meta.mem+=mem');
  const i2=src.indexOf('clearActiveRun();',i1);
  assert.ok(i1>0&&i2>i1,'ordem correta no fluxo de vitória');
});

ok('B55-C7: callback tardio (showVictory) não duplica reward',()=>{
  setupVictoryState();
  X('onVictory()');
  const mem1=T.getMeta().mem;
  X('showVictory()');X('showVictory()');            // 1.25s depois, 2×
  assert.strictEqual(T.getMeta().mem,mem1,'celebração não concede de novo');
  assert.ok(T.getVictoryData()&&T.getVictoryData().mem===mem1,
    'victoryData exibe o valor concedido');
});

ok('B55-C8: save persiste a meta corretamente (echoSave.v3)',()=>{
  setupVictoryState();
  X('onVictory()');
  const stored=JSON.parse(saveSnap());
  const slot=stored.slots[T.getCurSlot()];
  assert.strictEqual(slot.meta.mem,T.getMeta().mem,'meta persistida');
  assert.strictEqual(slot.meta.wins,1);
  assert.ok(slot.run===null,'run encerrada não persiste fantasma');
});

ok('B55-C9: reward não altera Credits, Resíduos nem XP',()=>{
  const p=setupVictoryState();
  X('fracRun=null;');
  const coins=p.coins,xp=p.xp,lvl=p.level;
  X('onVictory()');
  assert.strictEqual(p.coins,coins,'credits intactos');
  assert.strictEqual(p.xp,xp,'XP intacto');
  assert.strictEqual(p.level,lvl,'nível intacto');
  assert.strictEqual(X('(function(){try{return fracRes();}catch(e){return 0;}})()'),0,
    'resíduos intatos (sem fracRun)');
});

ok('B55-C10: decaimento — 1ª vitória 100%, repetidas ×.75 com piso de 50% na 4ª',()=>{
  const seq=[];
  for(let w=0;w<7;w++){X('meta.wins='+w);seq.push(+X('metaVictoryDecay()').toFixed(4));}
  assert.strictEqual(seq[0],1,'1ª vitória: fator cheio');
  assert.strictEqual(seq[1],0.75);
  assert.strictEqual(seq[2],0.5625);
  assert.strictEqual(seq[3],0.5,'piso a partir da 4ª vitória');
  for(let i=4;i<7;i++)assert.strictEqual(seq[i],0.5,'piso mantido');
  /* fator é derivado: ler 2× não muda nada e não consome RNG */
  const rng=rngCalls(()=>{X('metaVictoryDecay()');X('metaVictoryDecay()');});
  assert.strictEqual(rng,0,'decaimento é puro');
});

/* =====================================================================
   D. SANDBOX — byte-for-byte COM preview e compra no laboratório
   ===================================================================== */
ok('B55-D1: Sandbox — abrir loja, projetar previews e comprar não contamina save/meta',()=>{
  T.activateSlot(2);T.setState('title');X('sandboxRun=false;sandboxMode=false;loadMeta();');
  const save0=saveSnap();
  const meta0=X('JSON.stringify(meta)');
  X('sandboxOpenSetup();sandboxCfg.char=0;sandboxCfg.wave=5;');
  assert.strictEqual(X('sandboxStart()'),true);
  X('state="shop";rollShop();player.coins=100000;renderShop()');
  /* preview roda no contexto do sandbox (player do laboratório) */
  for(const it of T.getShopItems())T.shopItemPreview(it);
  for(const u of T.getShopOffers())T.shopUpgPreview(u);
  /* compra real no laboratório (checkpoint bloqueado por sandboxRun) */
  const p=T.getPlayer();
  const coinsS0=p.coins;
  clickEl(X('document.getElementById("m-row").children[0]'));
  assert.ok(p.coins<coinsS0,'compra no laboratório consumiu créditos do sandbox');
  X('sandboxExit(true);loadMeta();');
  assert.strictEqual(saveSnap(),save0,'save byte-a-byte');
  assert.strictEqual(X('JSON.stringify(meta)'),meta0,'meta byte-a-byte');
});

ok('B55-D2: Sandbox — ◆/Credits/Resíduos/unlocks/moral não contaminam',()=>{
  T.activateSlot(2);T.setState('title');X('sandboxRun=false;sandboxMode=false;');
  const meta0=saveSnap();const prog0=saveSnap();
  X('sandboxOpenSetup();sandboxStart();');
  const p=T.getPlayer();
  p.coins+=9999;X('meta.mem+=999;meta.wins+=3;');   // tentativa de sujeira
  X('moral.comp=10;moral.greed=10;moral.viol=10;');
  const s0=saveSnap();
  X('sandboxExit(true);loadMeta();');
  assert.strictEqual(saveSnap(),s0,'localStorage estável');
  assert.strictEqual(saveSnap(),meta0,'meta persistida intacta');
  assert.strictEqual(saveSnap(),prog0,'progressão persistida intacta');
});

/* =====================================================================
   E. STRESS + PERFORMANCE + SAVE
   ===================================================================== */
ok('B55-E1: stress — 300 previews e 100 renders sob orçamento',()=>{
  fresh();
  const t0=Date.now();
  for(let i=0;i<300;i++){
    const it=T.ITEMS[i%T.ITEMS.length];
    T.shopItemPreview(it);
  }
  const dt=Date.now()-t0;
  assert.ok(dt<3000,'300 previews em '+dt+'ms (<3s; ≈'+(dt/300).toFixed(2)+'ms/card)');
  fresh();T.setWave(8);T.rollShop();
  const t1=Date.now();
  for(let i=0;i<100;i++)X('renderShopOp()');
  const dt1=Date.now()-t1;
  assert.ok(dt1<3000,'100 renders da loja em '+dt1+'ms (<3s; ≈'+(dt1/100).toFixed(1)+'ms/render)');
});

ok('B55-E2: repetição — mesma build produz mesmos cards (estabilidade visual)',()=>{
  fresh();T.setWave(6);T.rollShop();
  const grab=()=>{
    X('renderShopOp()');
    return Array.from(X('document.getElementById("m-row").children'))
      .map(c=>c.innerHTML).join('|');
  };
  const a=grab();const b=grab();
  assert.strictEqual(a,b,'render estável entre chamadas');
});

ok('B55-E3: SM_VERSION e version sem bump; preview não é checkpointado',()=>{
  assert.strictEqual(X('SM_VERSION'),3,'SM_VERSION inalterado');
  const src=normalizeSource(SRC);
  assert.ok(/version:\s*3,/.test(src),'save wrapper segue v3');
  const cp=src.slice(src.indexOf('function smBuildCheckpoint'),
    src.indexOf('function captureCheckpoint'));
  assert.ok(cp.indexOf('shopItemPreview')<0&&cp.indexOf('shopUpgPreview')<0,
    'checkpoint não serializa preview');
});

console.log('\n'+passed+' PASSARAM · '+failed+' FALHAS');
if(failed){process.exit(1);}
