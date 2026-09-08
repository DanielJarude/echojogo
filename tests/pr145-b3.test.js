'use strict';
/* =====================================================================
   TESTES — PR14.5 · B3 · IDENTIDADE DA LOJA / CALIBRAÇÕES / REWORKS /
   PRESENÇA DE FACÇÃO / ANTI-REOFERTA
   ---------------------------------------------------------------------
   facção: cadeia real spawnWave→schedule→spawn→announce (banner; toast
   no pacto/interação), indicador persistente, Continue sem re-anúncio,
   Sandbox sem agendamento · calibrações: heading, ranks derivados
   (I..IV+), tiers/elite, sem sintonia/buildWeight · anti-reoferta por
   visita · lente (carrega o tiro) · su_vampiro (fome de vácuo) ·
   checkpoint/Continue · DEV inert
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
function give(id){const p=T.getPlayer();T.grantItemInternal(p,T.itemById(id),true);return p;}
const SRC=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');

console.log('\nECHO — PR14.5 · B3 · CALIBRAÇÕES / FACÇÃO / REWORKS');
console.log('---------------------------------------------');
T.unlockAll();
/* render de cards sem TRAVA: o harness não implementa querySelector
   (mkCard do jogo assume DOM real para o cadeado). Escopo deste arquivo. */
function cardsSemTrava(){X('if(!globalThis.__mkc0){__mkc0=mkCard;mkCard=function(nm,ds,extra,dis,oc,icon){return __mkc0(nm,ds,extra,dis,oc,icon,null);};}');}
const elText=c=>(c&&((c.textContent&&c.textContent.trim())||c._html||c.innerHTML||''))||'';

/* ============ 1. FACÇÃO — ANNOUNCE (cadeia real) ============ */
ok('B3-F1: cadeia REAL spawnWave→schedule→spawn→announce: todo spawn emite banner; PACTO emite banner+toast; interação emite toast',()=>{
  fresh();
  X('globalThis.__ann={banner:0,fp:0};');
  X('const _b=banner;banner=function(a,b,c){__ann.banner++;return _b(a,b,c);};');
  X('const _f=fpImportantToast;fpImportantToast=function(a,b,c,d){__ann.fp++;return _f(a,b,c,d);};');
  let spawned=0,runs=0;
  while(spawned<2&&runs<10){
    runs++;fresh();
    X('const _b2=banner;banner=function(a,b,c){__ann.banner++;return _b2(a,b,c);};');
    X('const _f2=fpImportantToast;fpImportantToast=function(a,b,c,d){__ann.fp++;return _f2(a,b,c,d);};');
    for(let w=2;w<=19&&spawned<2;w++){
      X('__ann.banner=0;__ann.fp=0;wave='+w+';spawnWave(wave);');
      if(X('!!factionPresenceEntity')){
        spawned++;
        assert.ok(+X('__ann.banner')>=1,'spawn normal onda '+w+' SEM banner');
        /* toast é do PACTO/interação — força uma presença com pacto
           (pacto exige facção conhecida + afinidade ≥ FACTION_PACT_MIN) */
        X('factionPresenceEntityClear();factionPresenceResolve("t");');
        X('fracDisc.consortium=["contact"];fracRun=fracRun||fracFresh();'+
          'fracRun.aff.consortium=FACTION_PACT_MIN;');
        X('DEV_MODE=true;__ann.banner=0;__ann.fp=0;');
        X('factionPresenceDevForcePactOffer("consortium");DEV_MODE=false;');
        if(X('!!factionPresenceEntity')){
          assert.strictEqual(X('factionPresenceEntity.pactOffer'),1,'entidade nasce com pacto');
          assert.ok(+X('__ann.banner')>=1&&+X('__ann.fp')>=1,'pacto precisa banner+toast');
          X('factionPresenceEntityClear();factionPresenceResolve("t");');
        }
      }
    }
  }
  assert.ok(spawned>=2,'pelo menos 2 spawns reais: '+spawned);
});
ok('B3-F2: banner de PRESENÇA usa duração estendida 3.8s; banner comum segue 2.0s',()=>{
  fresh();
  X('globalThis.__durs=[];');
  X('const _b3=banner;banner=function(a,b,c){__durs.push(c||2.0);return _b3(a,b,c);};');
  let hit=false;
  for(let w=2;w<=19&&!hit;w++){
    X('wave='+w);X('spawnWave(wave)');
    if(X('!!factionPresenceEntity'))hit=true;
  }
  assert.ok(hit,'presença spawnou para medir duração');
  const durs=X('__durs');
  assert.ok(durs.some(d=>near(d,3.8)),'presença usou 3.8s: '+JSON.stringify(durs));
  X('__durs.length=0;banner("COMUM","sub");');
  assert.ok(near(+X('__durs[0]'),2.0),'banner comum continua 2.0s');
  X('factionPresenceEntityClear();factionPresenceResolve("t");');
});
ok('B3-F3: indicador persistente — aparece com a entidade (símbolo/nome/TTL), some ao limpar, pacto distinto, facção correta',()=>{
  fresh();X('DEV_MODE=true;');
  assert.strictEqual(X('factionPresenceDevForce("anchor")'),true,'force anchor');
  X('fpIndicatorTick(1);');
  assert.strictEqual(X('$("fpind").style.display'),'block','visível com entidade');
  const txt=X('$("fpind").textContent');
  assert.ok(txt.indexOf('⬡')>=0&&txt.indexOf('NÓ DE CONTENÇÃO')>=0&&txt.indexOf('PRESENÇA ATIVA')>=0,'identidade: '+txt);
  assert.ok(/·\s*\d+s/.test(txt),'TTL aproximado: '+txt);
  X('factionPresenceEntityClear();factionPresenceResolve("t");fpIndicatorTick(0.1);');
  assert.strictEqual(X('$("fpind").style.display'),'','some ao limpar');
  X('fracDisc.consortium=["contact"];fracRun=fracRun||fracFresh();'+
    'fracRun.aff.consortium=FACTION_PACT_MIN;');
  X('DEV_MODE=true;factionPresenceDevForcePactOffer("consortium");DEV_MODE=false;');
  X('fpIndicatorTick(1);');
  assert.ok(X('$("fpind").textContent').indexOf('◆ PACTO DISPONÍVEL')>=0,'pacto distinto');
  assert.ok(X('$("fpind").textContent').indexOf('CACHE TEMPORAL')>=0,'facção correta (consórcio)');
  X('factionPresenceEntityClear();factionPresenceResolve("t");DEV_MODE=false;');
});
ok('B3-F4: Continue reconstrói presença SEM re-anunciar; indicador VOLTA a refletir o estado restaurado',()=>{
  T.activateSlot(1);fresh();
  let spawned=null;
  for(let w=2;w<=19&&!spawned;w++){X('wave='+w);X('spawnWave(wave)');if(X('!!factionPresenceEntity'))spawned=w;}
  assert.ok(spawned,'presença ativa antes do checkpoint');
  X('renderShop=function(){};');
  T.setState('play');assert.ok(T.captureCheckpoint('b3',spawned+1),'checkpoint com presença ativa');
  assert.ok(T.getActiveRun().presence,'cp.presence existe');
  T.setPlayer(null);T.resumeRun();const r=T.getPlayer();
  X('globalThis.__ann5=[];');
  X('const _b5=banner;banner=function(a,b,c){__ann5.push(String(a));return _b5(a,b,c);};');
  X('wave='+spawned+';spawnWave(wave);');
  if(X('!!factionPresenceEntity')){
    X('fpIndicatorTick(1);');
    assert.strictEqual(X('$("fpind").style.display'),'block','indicador reflete o estado restaurado');
    const banners=X('__ann5').filter(x=>x.indexOf('PRESENÇA DA')>=0);
    assert.strictEqual(banners.length,0,'rebuild NÃO re-anuncia PRESENÇA: '+JSON.stringify(banners));
    X('factionPresenceEntityClear();factionPresenceResolve("t");');
  }
});
ok('B3-F5: Sandbox NÃO agenda presença e o save fica byte-a-byte',()=>{
  for(const sl of [1,2]){T.activateSlot(sl);fresh();T.setWave(2+sl);T.rollShop();X('renderShop=function(){}');T.setState('shop');T.captureCheckpoint('sb',3+sl);T.setState('title');}
  X('sandboxRun=false;sandboxMode=false;');
  const snap=sandbox.localStorage.getItem('echoSave.v3');
  X('sandboxOpenSetup();sandboxCfg.char=0;');assert.strictEqual(X('sandboxStart()'),true);
  let sched=0;
  for(let w=2;w<=10;w++){X('wave='+w);X('spawnWave(wave)');if(X('!!(factionPresenceRun&&factionPresenceRun.scheduled)'))sched++;}
  assert.strictEqual(sched,0,'nenhum agendamento no sandbox');
  X('sandboxExit(true)');
  assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),snap,'save byte-a-byte');
});

/* ============ 2. CALIBRAÇÕES — HEADING / RANKS / TIERS ============ */
ok('B3-C1: heading CALIBRAÇÕES DE CAMPO (com subtítulo acumulativo) na loja; MÓDULOS mantém o deles',()=>{
  fresh();X('wave=3');X('rerollCost=rerollBaseCost();rollShop();');
  cardsSemTrava();X('renderShopOp();');
  const kids=X('$("m-row").children');
  const has=(kids||[]).some(c=>elText(c).indexOf('CALIBRAÇÕES DE CAMPO')>=0);
  assert.ok(has,'heading presente em m-row (children: '+kids.length+')');
  assert.ok((kids||[]).some(c=>elText(c).indexOf('APRIMORAMENTOS ACUMULATIVOS')>=0),'subtítulo presente');
  assert.ok(SRC.indexOf('IDENTIDADE DA BUILD')>=0,'módulos mantêm heading próprio');
});
ok('B3-C2: rank DERIVADO de upgLog — I,II,III…; >III funciona (VI); toRomanRank estável',()=>{
  assert.strictEqual(T.toRomanRank(1),'I');assert.strictEqual(T.toRomanRank(3),'III');
  assert.strictEqual(T.toRomanRank(4),'IV');assert.strictEqual(T.toRomanRank(9),'IX');
  assert.strictEqual(T.toRomanRank(10),'X');assert.strictEqual(T.toRomanRank(42),'42');
  fresh();
  const u=X('UPGRADES.find(x=>x.id==="rate")');
  assert.strictEqual(T.upgRankOf(u),1,'sem compras → I');
  T.getPlayer().upgLog.push('SERVO-GATILHO');
  assert.strictEqual(T.upgRankOf(u),2,'1 compra → II');
  for(let i=0;i<4;i++)T.getPlayer().upgLog.push('SERVO-GATILHO');
  assert.strictEqual(T.upgRankOf(u),6,'5 compras → VI (sem cap rígido)');
});
ok('B3-C3: card da calibração mostra NOME + RANK numeral (render real)',()=>{
  fresh();
  T.getPlayer().upgLog.push('SERVO-GATILHO','SERVO-GATILHO');
  X('shopOffers=[UPGRADES.find(x=>x.id==="rate")];shopItems=[];shopGuns=[];');
  cardsSemTrava();X('renderShopOp();');
  const kids=X('$("m-row").children');
  const card=(kids||[]).map(elText).find(h=>h.indexOf('SERVO-GATILHO')>=0);
  assert.ok(card,'card da rate presente');
  assert.ok(card.indexOf('>III<')>=0,'rank III visível (3ª compra)');
});
ok('B3-C4: tiers esclarecidos — dmg2/rate2/range2/pierce2/critx = CALIBRAÇÃO AVANÇADA + LINHA; efeitos preservados',()=>{
  for(const [id,linha] of Object.entries(T.UPG_ADVANCED))
    assert.ok(linha.indexOf('LINHA')===0,id+' mapeado: '+linha);
  fresh();
  assert.ok(T.upgDescHTML(X('UPGRADES.find(x=>x.id==="dmg2")')).indexOf('CALIBRAÇÃO AVANÇADA · LINHA DANO')>=0,'dmg2');
  assert.ok(T.upgDescHTML(X('UPGRADES.find(x=>x.id==="critx")')).indexOf('CALIBRAÇÃO AVANÇADA · LINHA CRÍTICO')>=0,'critx');
  const u=X('UPGRADES.find(x=>x.id==="dmg2")');
  const p=T.getPlayer();const d0=T.smGet(p,'damage');u.apply(p);
  assert.ok(near(T.smGet(p,'damage')/d0,1.28),'efeito dmg2 PRESERVADO (×1.28)');
  assert.ok(X('UPGRADES.some(x=>x.id==="dmg")&&UPGRADES.some(x=>x.id==="rate2")'),'cards preservados');
});
ok('B3-C5: OMNI/SINGUL = CALIBRAÇÃO DE ELITE (subtipo, sem 4ª categoria); trade-offs preservados; transformadores intactos',()=>{
  assert.ok(T.UPG_ELITE.omni&&T.UPG_ELITE.singul);
  fresh();
  assert.ok(T.upgDescHTML(X('UPGRADES.find(x=>x.id==="omni")')).indexOf('CALIBRAÇÃO DE ELITE')>=0,'omni elite');
  assert.ok(T.upgDescHTML(X('UPGRADES.find(x=>x.id==="singul")')).indexOf('CALIBRAÇÃO DE ELITE')>=0,'singul elite');
  const u=X('UPGRADES.find(x=>x.id==="singul")');
  const p=T.getPlayer();const hp0=p.maxHp;u.apply(p);
  assert.ok(p.maxHp<hp0,'trade-off −maxHP de singul preservado');
  assert.ok(SRC.indexOf('◆ TRANSFORMADOR')>=0,'selo ◆ intacto');
});
ok('B3-C6: Calibrações SEM Sintonia e SEM buildWeight (investimento universal)',()=>{
  fresh();
  for(const id of ['rate','dmg','critx','omni'])
    assert.strictEqual(T.buildCompat(id),null,id+' sem leitura de build');
  assert.strictEqual(T.attunementState('rate').id,'neutral','sem estado de sintonia');
  const rsI=SRC.indexOf('function rollShop');
  const line=SRC.slice(rsI,SRC.indexOf('---- MÓDULOS PASSIVOS',rsI));
  assert.ok(line.indexOf('pickWeighted(pool,wave')>=0&&line.indexOf('buildShopWeight')<0,'sem buildWeight nas calibrações');
});

/* ============ 3. ANTI-REOFERTA (por visita) ============ */
ok('B3-D1: janela por visita — comprar na visita N marca a janela; visita N+1 pesa ×0.30; N+2 volta ao normal',()=>{
  fresh();
  X('wave=4;openShop()');                      /* visita 1 */
  assert.ok(+X('shopVisitN')>=1,'openShop conta a visita');
  const first=X('shopOffers').map(u=>u.id)[0];
  X('(function(){const u=shopOffers[0];player.coins=99999;u.apply(player);player.upgLog.push(u.nm);shopMarkBought(u.id);shopBoughtAtVisit=shopVisitN;if(shopBoughtIds.indexOf(u.id)<0)shopBoughtIds.push(u.id);})();');
  assert.strictEqual(+X('shopBoughtAtVisit'),+X('shopVisitN'),'compra marca a visita');
  X('closeShop();');
  X('openShop()');                             /* visita 2: janela ATIVA */
  assert.strictEqual(+X('shopVisitN'),+X('shopBoughtAtVisit')+1,'visita seguinte');
  /* peso comprovado estatisticamente em B3-D2; aqui, o registro */
  assert.ok(T.getShopBoughtIds().indexOf(first)>=0,'id na janela');
  X('closeShop();X2=0;');X('openShop()');      /* visita 3: janela EXPIRADA */
  assert.ok(+X('shopVisitN')>+X('shopBoughtAtVisit')+1,'janela de 1 visita expirou');
  X('closeShop();');
});
ok('B3-D2: reoferta imediata CAI para a faixa 5–15% (de 18,6%) sem proibir — 2400 pares medidos',()=>{
  const RUNS=600,WAVES=4;
  let reoff=0,tot=0;
  X('renderShop=function(){};');
  for(let r=0;r<RUNS;r++){
    T.resetShopVars();T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);T.startRun();
    const p=T.getPlayer();p.coins=99999;T.applyMoral();T.applyMoralTuning(p);
    X('shopVisitN=0;shopBoughtAtVisit=-1;shopBoughtIds.length=0;');
    let lastBought=null;
    for(let w=1;w<=WAVES;w++){
      X('wave='+w+';openShop()');
      const ids=X('shopOffers').map(u=>u.id);
      if(lastBought){tot++;if(ids.indexOf(lastBought)>=0)reoff++;}
      lastBought=ids[0]||null;
      if(lastBought){
        X('(function(){const u=UPGRADES.find(x=>x.id==="'+lastBought+'");u.apply(player);player.upgLog.push(u.nm);shopMarkBought(u.id);shopBoughtAtVisit=shopVisitN;if(shopBoughtIds.indexOf(u.id)<0)shopBoughtIds.push(u.id);})();');
      }
      X('closeShop();');
    }
  }
  const pct=reoff/tot*100;
  assert.ok(pct>=5&&pct<=15,'reoferta imediata entre 5% e 15%: '+pct.toFixed(1)+'% ('+reoff+'/'+tot+')');
});

/* ============ 4. REWORKS ============ */
ok('B3-R1: LENTE — sm preservado (+1 perfuração, −12% dano) e NOVA regra: atravessar carrega ×1.20 em vez de ×0.82',()=>{
  fresh();
  const p=give('lente');
  assert.ok(near(T.smGet(p,'pierce'),1),'pierce +1 preservado');
  assert.ok(T.smHas(p,'module.lente.damage'),'−12% dano preservado');
  T.setPlayer(null);T.startRun();
  const q=T.getPlayer();
  assert.ok(near(T.lensChargeMul(),0.82),'sem lente: queda padrão ×0.82');
  T.grantItemInternal(q,T.itemById('lente'),true);
  assert.ok(near(T.lensChargeMul(),1.20),'com lente: carga ×1.20');
  assert.ok(SRC.indexOf('p.dmg*=lensChargeMul()')>=0,'gancho real da perfuração usa o fator');
  assert.ok(SRC.indexOf('ATRAVESSAR CARREGA O TIRO')>=0,'tooltip comunica a identidade nova');
});
ok('B3-R2: SU_VAMPIRO — fome de vácuo (3 abates → +8 HP) + cura recebida; NÃO usa mais lifesteal (papel do DRENO)',()=>{
  fresh();
  const p=give('su_vampiro');
  assert.strictEqual(p.killHealEvery,3,'janela de 3 abates');
  assert.ok(near(p.killHealAmount,8),'cura +8');
  assert.ok(near(p.medBoost,1.2),'+20% cura recebida preservado');
  assert.ok(!(p.globalLifesteal>0),'sem lifesteal');
  const vp=T.getPlayer();X('UPGRADES.find(u=>u.id==="vamp").apply')(vp);
  assert.ok(vp.globalLifesteal>0,'DRENO segue como calibração de lifesteal');
  const killFn=SRC.slice(SRC.indexOf('PRESAS DE VÁCUO (B3)'),SRC.indexOf('PRESAS DE VÁCUO (B3)')+420);
  assert.ok(killFn.indexOf('killHealN>=player.killHealEvery')>=0,'guard do proc presente');
  assert.ok(SRC.indexOf("floatText(player.x,player.y-20,'+'+ka+' HP','#ff3d68')")>=0,'feedback visual do proc');
});
ok('B3-R3: checkpoint preserva a FOME DE VÁCUO (campos aditivos; save antigo fica 0 sem invalidar)',()=>{
  T.activateSlot(1);
  const p=fresh();give('su_vampiro');
  p.killHealN=2;
  T.setState('play');assert.ok(T.captureCheckpoint('b3v',5));
  T.setPlayer(null);T.resumeRun();const r=T.getPlayer();
  assert.strictEqual(r.killHealEvery,3,'janela restaurada');
  assert.ok(near(r.killHealAmount,8),'montante restaurado');
  assert.strictEqual(r.killHealN,2,'contador parcial restaurado');
  assert.strictEqual(X('SM_VERSION'),3,'sem bump');
});
ok('B3-R4: OLHO × MIRA — MIRA é calibração AVANÇADA da linha crítico; OLHO segue módulo com trade-off',()=>{
  fresh();
  assert.ok(T.upgDescHTML(X('UPGRADES.find(x=>x.id==="critx")')).indexOf('LINHA CRÍTICO')>=0,'mira = linha crítico');
  const olho=T.itemById('olho');
  assert.ok(olho.desc.indexOf('−10% DANO')>=0,'olho mantém trade-off');
  const p=give('olho');
  assert.ok(T.smGet(p,'crit')>.15&&T.smHas(p,'module.olho.critd'),'olho: crit+critD');
});

/* ============ 5. DEV ============ */
ok('B3-V1: DEV.upgradeRanks/upgradeRank/giveUpgrade/shopRepeatStats — inert em release; em DEV funcionam sem escrever save',()=>{
  fresh();
  X('DEV_MODE=false');
  assert.strictEqual(X('DEV.upgradeRanks()'),null);
  assert.strictEqual(X('DEV.upgradeRank("rate")'),null);
  assert.strictEqual(X('DEV.giveUpgrade("rate",3)'),false);
  assert.strictEqual(X('DEV.shopRepeatStats()'),null);
  X('DEV_MODE=true');
  const snap=sandbox.localStorage.getItem('echoSave.v3');
  assert.strictEqual(X('DEV.giveUpgrade("rate",3)'),true);
  assert.strictEqual(X('DEV.upgradeRank("rate")').rank,4,'3 aplicações → rank IV');
  assert.ok(X('DEV.upgradeRanks()').rate===3);
  assert.strictEqual(X('DEV.giveUpgrade("nao-existe",1)'),false,'id inválido recusado');
  assert.strictEqual(sandbox.localStorage.getItem('echoSave.v3'),snap,'giveUpgrade não escreve save');
  X('DEV_MODE=false');
});
ok('B3-V2: save/Continue mantém ranks (upgLog persistido) — DERIVADO, nenhum campo novo autoritativo',()=>{
  T.activateSlot(2);
  const p=fresh();
  p.upgLog.push('SERVO-GATILHO','SERVO-GATILHO','CATALISADOR IÔNICO');
  T.setState('play');assert.ok(T.captureCheckpoint('b3r',6));
  T.setPlayer(null);T.resumeRun();const r=T.getPlayer();
  const u=X('UPGRADES.find(x=>x.id==="rate")');
  const d=X('UPGRADES.find(x=>x.id==="dmg")');
  assert.strictEqual(T.upgRankOf(u),3,'rank da rate sobrevive ao Continue');
  assert.strictEqual(T.upgRankOf(d),2,'rank da dmg sobrevive ao Continue');
});

console.log('');
if(failed){console.log(failed+' FALHAS');process.exit(1);}
console.log('B3 — '+passed+' PASSARAM · 0 FALHAS');
