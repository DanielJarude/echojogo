'use strict';
/* =====================================================================
   TESTES — PR15 · B1 · MEMÓRIA TEMPORAL E ASSINATURA DE RUN
   ---------------------------------------------------------------------
   Cobre §33 (áreas 1–37, ordem literal do brief) e §34 (SIMULAÇÕES
   A/B/C). Mapa 1:1 área → teste:

     1 contrato novo → B1-1        20 arma assinatura → B1-20
     2 compatibilidade v2 → B1-2   21 módulos assinatura → B1-21
     3 sanitização → B1-3          22 Tema → B1-22
     4 run válida por wave → B1-4  23 seed → B1-23
     5 run válida por duração→B1-5 24 death cause → B1-24
     6 kills mínimo → B1-6         25 death cause unknown → B1-25
     7 morte inválida → B1-7       26 reset death cause → B1-26
     8 abort → B1-8                27 save/load → B1-27
     9 vitória → B1-9              28 old save → B1-28
    10 Sandbox → B1-10             29 corrupt/partial record → B1-29
    11 DEV → B1-11                 30 isolamento dos 3 slots → B1-30
    12 N-1 → B1-12                 31 Continue → B1-31
    13 N-2 → B1-13                 32 morte pós-Continue → B1-32
    14 cap 2 → B1-14               33 abort pós-Continue → B1-33
    15 memória inválida não        34 Echos legados continuam
       desloca fila → B1-15            carregando → B1-34
    16 operador → B1-16            35 trail preservada → B1-35
    17 moral → B1-17               36 nenhuma presença PR15 criada→B1-36
    18 personalidade → B1-18       37 nenhum scheduler PR15 criado→B1-37
    19 Build Profile → B1-19

   SIMULAÇÕES §34: A → SIM-A (10.000 resultados mistos, invariantes de
   fila) · B → SIM-B (varredura kills 0–10 × wave 0–5 × dur 0–120) ·
   C → SIM-C (sanitização: corpus hostil, nenhum explode load/destrói
   slot/gera NaN/quebra makeEcho).

   NOTA de contrato (design PR15·b1):
   · em MEMÓRIA o registro da morte válida é o runData legado (kills/mh,
     sem v/k) + campos de assinatura cravados (id/out/cause/op/theme/seed/
     arch/sigW/sigItems) — o v3 e o `k` (abates) existem no ARQUIVO (slim),
     e voltam a aparecer em memória após loadEchoes/activateSlot.
   · o `v` só é materializado no slim de save; por isso asserts de versão
     sempre leem o arquivo (ou a fila recarregada).
   · `out` é sempre 'death' (só mortes reais válidas entram na fila); não
     existe campo `outcode` nem armazenamento paralelo de outcomes.
   ===================================================================== */
const assert=require('assert');
const vm=require('vm');
const {sandbox,T,SRC,normalizeSource}=require('../audit_pr135/harness.js');
const X=code=>vm.runInContext(code,sandbox);
const XJ=code=>JSON.parse(X(code));
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));if(e&&e.stack&&process.env.PR15_DEBUG)console.log(e.stack);}
}
/* ---------------- helpers ---------------- */
const qnow=()=>XJ('JSON.stringify(Array.isArray(echoQueue)?echoQueue:[])');
const root=()=>XJ('JSON.stringify(smRoot)');
const slotFile=s=>root().slots[s].echoes||[];
const seqFile=s=>{const r=root();return (r.slots[s]&&r.slots[s].seq)||0;};
const ITEM_IDS=XJ('JSON.stringify(ITEMS.map(function(i){return i.id;}));');
const ARCH_IDS=XJ('JSON.stringify(BUILD_ARCH_IDS)');
const PERS_KEYS=XJ('JSON.stringify(Object.keys(PERSONALITIES))');
function clearAllSlots(){
  X('smRoot.slots[1].echoes=[];smRoot.slots[2].echoes=[];smRoot.slots[3].echoes=[];'+
    'smRoot.slots[1].seq=0;smRoot.slots[2].seq=0;smRoot.slots[3].seq=0;smCommit();');
}
function padRec(n){
  const cur=XJ('JSON.stringify((Array.isArray(recorder)?recorder:[]).length)');
  const wi=T.getPlayer()&&Number.isInteger(T.getPlayer().wi)?T.getPlayer().wi:0;
  for(let i=cur;i<n;i++)
    X('recorder.push(['+(i*.25).toFixed(2)+','+(120+i)+',150,1,0,'+wi+'])');
}
function bootRun(op){
  T.resetShopVars();T.setState('play');T.setMoral({comp:0,greed:0,viol:0});
  T.setPlayer(null);T.setEnemies([]);T.setEchoes([]);T.setEchoQueue([]);
  T.setDevTainted(false);T.setSandboxRun(false);
  X('DEV_MODE=false');
  T.startRun(op?{operatorId:op}:null);
  return T.getPlayer();
}
function die(opts){
  const o=opts||{};
  X('kills='+((o.kills!=null)?o.kills:60)+';wave='+((o.wave!=null)?o.wave:5)+
    ';runTime='+((o.dur!=null)?o.dur:300));
  padRec(o.rows!=null?o.rows:60);
  if(o.cause)X('pr15NoteDamage('+JSON.stringify(o.cause)+')');
  else X('pr15NoteDamage(undefined)');
  T.setState('play');
  X('onPlayerDeath()');
}
/* registro legado no FORMATO DO ARQUIVO v2 (o que um save antigo contém:
   k, sem kills; sem v/id — ps pode vir nulo e é derivado na carga). */
function fileV2(n,over){
  const r={v:2,dur:200,dmgMul:1,frMul:1,wave:6,level:5,trail:[],crit:.1,critMul:1.9,
    pierce:1,aoeMul:1,rangeMul:1,meleeRangeMul:1,rangedRangeMul:1,projSpdMul:1,
    longRangeBonus:0,coins:120,items:[],upg:[],owned:[0,1],moral:{comp:4,greed:2,viol:6},
    dom:'viol',k:40,mh:110,st:{s:400,mw:300,rw:100,dsh:20},ps:null};
  for(let i=0;i<30;i++)r.trail.push([i*.25,100+i,200+i,1,0,0]);
  r.tag='L'+n;                    // marcador de teste (extra não-slim; sobrevive à cópia)
  if(over)for(const k in over)r[k]=over[k];
  return r;
}
function mkEcho(data,slot){
  return XJ('JSON.stringify((function(){try{var e=makeEcho('+JSON.stringify(data)+','+(slot||1)+');'+
    'return {ok:true,x:e.x,y:e.y,aim:e.aim,hp:e.hp,maxHp:e.maxHp,alive:e.alive,trust:Math.round((e.trust||0)*100)/100,'+
    'slot:e.slot,dom:e.dom,ps:(e.ps&&e.ps.id)||null,pers:(e.pers&&e.pers.id)||null,'+
    'itemIds:(e.itemIds||[]).length,trail:(e.data&&e.data.trail)?e.data.trail.length:0};}'+
    'catch(err){return {ok:false,msg:String(err&&err.message||err)};}})())');
}
function san(rec){
  return XJ('JSON.stringify(pr15SanitizeRecord('+JSON.stringify(rec)+'))');
}
function secOf(fn){
  const i=SRC.indexOf('function '+fn+'(');
  if(i<0)return '';
  const j=SRC.indexOf('\nfunction ',i+10);
  return SRC.slice(i,j<0?SRC.length:j);
}
function qPush(o,rec){
  return XJ('JSON.stringify(pr15QueuePush('+JSON.stringify([])+','+JSON.stringify(o)+','+JSON.stringify(rec)+'))');
}
function pr15Block(){
  const b=normalizeSource(SRC);
  const fim=b.indexOf('/* ==================== PR15·fim b1 ==================== */');
  const ini=b.lastIndexOf('PR15·b1',fim);
  assert.ok(ini>0&&fim>ini,'marcadores do bloco');
  return b.slice(b.lastIndexOf('/* ====================',ini),fim);
}
function stripComments(s){
  return s.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/\/\/[^\n]*/g,' ');
}

console.log('\nECHO — PR15·B1 · MEMÓRIA TEMPORAL E ASSINATURA DE RUN');
console.log('---------------------------------------------');
T.unlockAll();

/* ============ 1. CONTRATO NOVO (v3 superset) ============ */
ok('B1-1: contrato — morte válida gera registro v3 SUPERSET (legado intacto + assinatura); sem itemState/fracRun/cópia do player',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  X('moral.comp=2;moral.greed=4;moral.viol=8;applyMoral();');
  X('kills=70;wave=6;runTime=350');
  const p=T.getPlayer();
  for(let i=0;i<90;i++)X('recorder.push(['+(i*.25).toFixed(2)+','+(200+i)+',160,1,0,'+p.wi+'])');
  X('pr15NoteDamage("boss")');
  X('onPlayerDeath()');
  const rec=qnow()[0];
  /* runData legado em memória (sem v/k — eles pertencem ao arquivo) */
  const legacyKeys=['dur','dmgMul','frMul','wave','level','trail','crit','critMul','pierce',
    'aoeMul','rangeMul','meleeRangeMul','rangedRangeMul','projSpdMul','longRangeBonus','coins',
    'items','upg','owned','moral','dom','kills','mh','st','ps'];
  for(const k of legacyKeys)assert.ok(k in rec,'legado ausente em memória: '+k);
  /* assinatura v3 cravada em memória */
  assert.strictEqual(rec.id.slice(0,2),'e1','id estável '+rec.id);
  assert.strictEqual(rec.out,'death');
  assert.strictEqual(rec.cause,'boss');
  assert.strictEqual(rec.op,'vector');
  assert.ok(ARCH_IDS.indexOf(rec.arch.dom)>=0,'arch.dom arquétipo válido');
  assert.ok(rec.theme===null||typeof rec.theme==='string');
  assert.ok(rec.seed===null||(Number.isInteger(rec.seed)&&rec.seed>0));
  assert.ok(typeof rec.sigW==='string'&&rec.sigW);
  assert.ok(Array.isArray(rec.sigItems)&&rec.sigItems.length<=4);
  assert.ok(Array.isArray(rec.trail)&&rec.trail.length>=90);
  for(const bad of ['itemState','fracRun','hooks','relationship','dis','rel','proj','enemies','frame','v','k'])
    assert.ok(!(bad in rec),'campo indevido em memória: '+bad);
  /* ARQUIVO: v3 com assinatura + campos legados do slim */
  const f=slotFile(1);
  assert.strictEqual(f.length,1);
  assert.strictEqual(f[0].v,3,'arquivo é v3');
  assert.strictEqual(f[0].id,rec.id);
  assert.strictEqual(f[0].out,'death');
  assert.strictEqual(f[0].cause,'boss');
  assert.strictEqual(f[0].k,70,'slim converte kills→k');
  assert.strictEqual(f[0].wave,6);
  assert.strictEqual(f[0].dur,350);
  assert.ok(f[0].mh>0&&f[0].moral&&f[0].dom&&f[0].ps&&f[0].st,'legado no arquivo');
  for(const bad of ['itemState','fracRun','hooks','relationship','dis','rel','proj','enemies','frame'])
    assert.ok(!(bad in f[0]),'campo proibido no arquivo: '+bad);
  /* reload: v3 volta com tudo */
  T.activateSlot(1);
  const r2=qnow()[0];
  assert.strictEqual(r2.v,3,'reload materializa v:3');
  assert.strictEqual(r2.id,rec.id);
  assert.strictEqual(r2.kills,70,'k→kills migrado na carga');
});

/* ============ 2. COMPATIBILIDADE v2 ============ */
ok('B1-2: compatibilidade — arquivo v2 legado carrega SEM campos novos e o re-save continua v2 preservando k',()=>{
  T.activateSlot(1);clearAllSlots();
  X('smRoot.slots[1].echoes='+JSON.stringify([fileV2(1),fileV2(2)]));
  X('smCommit();');
  T.activateSlot(1);
  const q=qnow();
  assert.strictEqual(q.length,2);
  assert.strictEqual(q[0].v,2);assert.strictEqual(q[1].v,2);
  assert.ok(!('id' in q[0])&&!('sigItems' in q[0])&&!('out' in q[0]),
    'v2 não recebe campos novos na carga');
  assert.strictEqual(q[0].k,40);
  assert.ok(q[0].trail&&q[0].moral&&q[0].st&&q[0].dom,'legado preservado na carga');
  /* re-save: continua v2 e o abate (k) não zera (migração k→kills em memória) */
  T.saveEchoes();
  const f=slotFile(1);
  assert.strictEqual(f.length,2);
  assert.strictEqual(f[0].v,2,'re-save de v2 continua v2');
  assert.strictEqual(f[0].k,40,'re-save preserva k do v2 legado');
  assert.strictEqual(f[0].dur,200);
  /* makeEcho segue íntegro com o v2 carregado */
  const e=mkEcho(q[0],1);
  assert.strictEqual(e.ok,true);
  assert.strictEqual(e.alive,true);
  assert.ok(e.pers,'personalidade derivada/migrada na carga do v2');
});

/* ============ 3. SANITIZAÇÃO ============ */
ok('B1-3: sanitização — tipos errados/enums inválidos/arrays grandes caem em fallbacks; makeEcho nunca explode nem gera NaN',()=>{
  const cases=[
    {v:3,trail:[[0,100,200]],dmgMul:'x',frMul:null,wave:'abc',level:-5,crit:{},critMul:[],pierce:'a',
      aoeMul:'a',rangeMul:'a',meleeRangeMul:'a',rangedRangeMul:'a',projSpdMul:'a',longRangeBonus:'a',
      coins:'muitos',dur:'',k:NaN,mh:'x',moral:'selvagem',dom:42,items:42,upg:{x:1},owned:'nada',
      st:5,ps:'fragmentado',id:'x'.repeat(99),out:'abort',cause:'lagarto',op:9,theme:['t'],seed:-7,
      sigItems:['a','b','c','d','e'],sigW:9},
    {v:3,trail:[[0,'a','b',{},'x','y']],items:['nucleo',42,null,'placa'],owned:[0,'x',null,999],
      sigItems:'abc'},
    {v:2,trail:[[0,100,200,'a','b','c'],[1,'x','y',2,3,4]],owned:[],moral:{comp:'a',greed:null}},
    {v:3,trail:[[0,100,200,1,0,0],[1,'NaN','NaN',1,0,0],[2,undefined,300,1,0,0]],sigItems:['ok',1,2,'x']},
    {v:3,trail:[[0,'5','6',1,0,0]],wave:9,kills:99,dur:999,moral:{comp:'a',greed:null,viol:2}}
  ];
  for(const c of cases){
    const s=san(c);
    if(!s)continue;                       // irrecuperável fica fora (trail corrompida)
    const e=mkEcho(s,1);
    assert.strictEqual(e.ok,true,'makeEcho quebrou: '+e.msg);
    assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.aim),
      'posição NaN: '+JSON.stringify(e));
    assert.ok(Number.isFinite(e.hp)&&Number.isFinite(e.maxHp)&&Number.isFinite(e.trust),'hp/trust NaN');
    assert.ok(!Array.isArray(s.sigItems)||s.sigItems.length<=4,'sigItems >4');
    assert.ok(!('cause' in s)||PR15_DEATH_CAUSES.indexOf(s.cause)>=0,'enum inválido sobreviveu');
    assert.ok(!Array.isArray(s.items)||s.items.every(x=>typeof x==='string'));
    assert.ok(!Array.isArray(s.owned)||s.owned.length>0,'owned vazio cai no starter');
    assert.ok(s.moral&&typeof s.moral.comp==='number');
  }
  /* trail irrecuperável (posição inicial não numérica) → descartado em memória */
  const bad={v:3,trail:[['x','y','z']],wave:6,kills:50,dur:200};
  assert.strictEqual(san(bad),null,'primeira linha inútil ⇒ fora (nunca explode)');
  /* linha com strings numéricas é REPARADA para números (nunca NaN/string) */
  const s5=san({v:3,trail:[[0,'5','6','1','0','2']],wave:6});
  assert.ok(s5&&s5.trail[0].every(x=>typeof x==='number'&&Number.isFinite(x)),
    'strings numéricas viram números na trail');
});

/* ============ 4–6. VALIDADE ============ */
ok('B1-4: run válida por WAVE — kills≥5 e onda≥3 (dur<90) é válida; onda 2 não',()=>{
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,kills:5,wave:3,dur:0}),true);
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,kills:5,wave:2,dur:89}),false);
});
ok('B1-5: run válida por DURAÇÃO — kills≥5 e dur≥90 (onda<3) é válida; dur 89 não',()=>{
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,kills:5,wave:0,dur:90}),true);
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,kills:5,wave:0,dur:89.9}),false);
});
ok('B1-6: kills mínimo — kills 4 inválida mesmo com onda alta; kills 5 válida',()=>{
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,kills:4,wave:8,dur:500}),false);
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,kills:5,wave:8,dur:500}),true);
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,kills:'5',wave:3,dur:0}),true,'string numérica → coerção');
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,kills:NaN,wave:9,dur:999}),false);
});

/* ============ 7. MORTE INVÁLIDA ============ */
ok('B1-7: morte inválida (fraca) NÃO entra na fila, NÃO desloca, NÃO cria assinatura',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  X('smRoot.slots[1].echoes='+JSON.stringify([fileV2(1),fileV2(2)]));X('smCommit();');
  T.activateSlot(1);
  const before=qnow().map(r=>r.tag);
  die({kills:2,wave:1,dur:5,cause:'boss'});
  const q=qnow();
  assert.strictEqual(q.length,2);
  assert.deepStrictEqual(q.map(r=>r.tag),before);
  assert.ok(q.every(r=>r.v===2),'nada de v3 foi criado pela morte fraca');
  assert.strictEqual(slotFile(1).length,2,'arquivo intacto após morte fraca');
  assert.strictEqual(slotFile(1)[0].k,40);
});

/* ============ 8. ABORT ============ */
ok('B1-8: ABORTAR RUN não é morte real — fila intacta no disco, causa não reaproveitada, cleanup preservado',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  X('smRoot.slots[1].echoes='+JSON.stringify([fileV2(1),fileV2(2)]));X('smCommit();');
  T.activateSlot(1);
  X('kills=80;wave=7;runTime=400');
  padRec(40);
  X('pr15NoteDamage("boss")');                 // marca antiga NUNCA vaza
  T.setState('paused');
  T.abortRun();
  const q=qnow();
  assert.strictEqual(q.length,2);
  assert.deepStrictEqual(q.map(r=>r.tag),['L1','L2']);
  assert.strictEqual(X('state'),'fracture','tela/cleanup de fim preservado');
  assert.strictEqual(X('pr15ResolveCause()'),'unknown','causa resetada pós-abort');
  assert.strictEqual(X('pr15Ctx.abort'),false);
  assert.strictEqual(T.hasActiveRun(),false,'activeRun limpo pelo fluxo de morte');
  assert.strictEqual(slotFile(1).length,2,'arquivo voltou ao estado pré-abort');
  assert.strictEqual(slotFile(1)[0].k,40,'legado não corrompido pelo revert');
  assert.ok(slotFile(1).every(r=>r.v===2&&!('id' in r)),'nenhum registro de abort no arquivo');
});

/* ============ 9. VITÓRIA ============ */
ok('B1-9: vitória não cria memória — onVictory não toca echoQueue; validade exclui victory',()=>{
  const body=secOf('onVictory');
  assert.ok(body.indexOf('echoQueue')<0&&body.indexOf('saveEchoes')<0,
    'onVictory não manipula a fila (memória/Echo)');
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,victory:true,kills:99,wave:20,dur:900}),false);
  const r=qPush({realDeath:false,victory:true,kills:99,wave:20,dur:900},{id:'b'});
  assert.strictEqual(r.captured,false);
  assert.deepStrictEqual(r.queue,[]);
});

/* ============ 10. SANDBOX ============ */
ok('B1-10: Sandbox — morte (mesmo com métricas válidas) não cria memória nem toca a fila',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  const before=qnow();
  T.setSandboxRun(true);
  die({kills:60,wave:6,dur:400,cause:'boss'});
  T.setSandboxRun(false);
  assert.deepStrictEqual(qnow(),before);
  assert.strictEqual(slotFile(1).length,0);
  assert.strictEqual(T.pr15RunIsValid({realDeath:true,sandbox:true,kills:99,wave:9,dur:999}),false);
});

/* ============ 11. DEV ============ */
ok('B1-11: DEV — devTainted nunca entra na fila; helpers DEV.pr15* inertes sem DEV_MODE e funcionam com DEV_MODE',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  const before=qnow();
  T.setDevTainted(true);
  die({kills:60,wave:6,dur:400,cause:'boss'});
  T.setDevTainted(false);
  assert.deepStrictEqual(qnow(),before,'run DEV não desloca a fila');
  assert.strictEqual(slotFile(1).length,0,'nada gravado no arquivo (guarda DEV + revert)');
  assert.strictEqual(X('DEV.pr15History()'),null,'sem DEV_MODE');
  assert.strictEqual(X('DEV.pr15Signature()'),null);
  assert.strictEqual(X('DEV.pr15Validity()'),null);
  assert.strictEqual(X('DEV.pr15DeathCause()'),null);
  X('DEV_MODE=true');
  const h=X('DEV.pr15History()');
  assert.ok(Array.isArray(h),'histórico legível em DEV');
  const sg=X('DEV.pr15Signature()');
  assert.ok(sg&&typeof sg.sigW!=='undefined'&&Array.isArray(sg.sigItems),'assinatura legível em DEV');
  const v=X('DEV.pr15Validity()');
  assert.ok(v&&typeof v.valid==='boolean'&&typeof v.reason==='string'&&typeof v.cause==='string');
  const dc=X('DEV.pr15DeathCause()');
  assert.ok(dc&&typeof dc.cause==='string');
  X('DEV_MODE=false');
});

/* ============ 12–14. N-1 / N-2 / CAP 2 ============ */
ok('B1-12: N-1 — primeira memória vira N-1 (eco·01 da próxima run)',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  die({kills:55,wave:5,dur:300,cause:'enemy'});
  const q=qnow();
  assert.strictEqual(q.length,1);
  assert.ok(/^e1-\d+$/.test(q[0].id));
});
ok('B1-13: N-2 — segunda memória válida: nova→N-1, antiga→N-2',()=>{
  die({kills:66,wave:6,dur:360,cause:'miniboss'});
  const q=qnow();
  assert.strictEqual(q.length,2);
  assert.ok(/^e1-\d+$/.test(q[0].id)&&/^e1-\d+$/.test(q[1].id));
  assert.ok(parseInt(q[0].id.split('-')[1],10)>parseInt(q[1].id.split('-')[1],10),
    'ordem N-1 > N-2 por id');
});
ok('B1-14: cap 2 — terceira memória válida descarta a N-2 (fila nunca >2)',()=>{
  die({kills:77,wave:7,dur:420,cause:'boss'});
  const q=qnow();
  assert.strictEqual(q.length,2);
  assert.strictEqual(seqFile(1),parseInt(q[0].id.split('-')[1],10),'seq do slot sincronizado');
  assert.strictEqual(slotFile(1).length,2,'arquivo também nunca >2');
});

/* ============ 15. INVÁLIDA NÃO DESLOCA ============ */
ok('B1-15: memória inválida não desloca fila — morte fraca entre válidas mantém N-1/N-2',()=>{
  const before=qnow().map(r=>r.id);
  die({kills:1,wave:1,dur:5});                  // fraca
  assert.deepStrictEqual(qnow().map(r=>r.id),before);
  die({kills:2,wave:0,dur:40});                 // fraca com duração média
  assert.deepStrictEqual(qnow().map(r=>r.id),before);
});

/* ============ 16–18. OPERADOR / MORAL / PERSONALIDADE ============ */
ok('B1-16: operador capturado na assinatura (op = charId da run)',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('wraith');
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  assert.strictEqual(qnow()[0].op,'wraith');
});
ok('B1-17: moralidade persistida no registro (comp/greed/viol) e no save',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  X('moral.comp=0;moral.greed=0;moral.viol=12;');
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  const rec=qnow()[0];
  assert.deepStrictEqual(rec.moral,{comp:0,greed:0,viol:12});
  assert.strictEqual(rec.dom,'viol');
  assert.deepStrictEqual(slotFile(1)[0].moral,{comp:0,greed:0,viol:12});
});
ok('B1-18: personalidade — ps derivada na morte, sobrevive ao save/load e alimenta o Echo',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  const rec=qnow()[0];
  assert.ok(rec.ps&&typeof rec.ps.id==='string','ps presente');
  assert.ok(PERS_KEYS.indexOf(rec.ps.id)>=0,'ps id no catálogo');
  T.activateSlot(1);
  const r2=qnow()[0];
  assert.strictEqual(r2.ps.id,rec.ps.id,'ps persiste no reload');
  const e=mkEcho(r2,1);
  assert.strictEqual(e.ok,true);
  assert.strictEqual(e.pers,rec.ps.id,'echo carrega a personalidade da memória');
});

/* ============ 19–21. BUILD PROFILE / ARMA / MÓDULOS ============ */
ok('B1-19: Build Profile — arch captura dom/sec/state coerentes com o summary da run',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('bulwark');
  const p=T.getPlayer();
  for(const id of ['placa','rg_condensador','sb_pulso'])T.grantItemInternal(p,T.itemById(id),true);
  const sum=JSON.parse(JSON.stringify(T.buildProfileSummary()));
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  const arch=qnow()[0].arch;
  assert.ok(ARCH_IDS.indexOf(arch.dom)>=0);
  assert.strictEqual(arch.dom,sum.dom,'arch.dom == dominante da run');
  assert.strictEqual(arch.state,sum.state);
  assert.ok(Number.isFinite(arch.domS)&&arch.domS>=0&&arch.domS<=1);
  assert.ok(arch.sec===null||ARCH_IDS.indexOf(arch.sec)>=0);
  assert.ok(Number.isFinite(arch.secS)||arch.secS===null);
});
ok('B1-20: arma assinatura — determinística pela trail (wi amostrado); fallback = arma ativa',()=>{
  /* a arma mais usada na trail (wi amostrado) vence — inclusive sobre o wi ativo */
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  const p=T.getPlayer();
  const wIdx=p.owned[1];                       // índice real no catálogo WEAPONS
  X('recorder=[]');
  for(let i=0;i<120;i++)X('recorder.push(['+(i*.25).toFixed(2)+','+(300+i)+',160,1,0,'+wIdx+'])');
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  const rec=qnow()[0];
  assert.strictEqual(rec.sigW,X('WEAPONS['+wIdx+'].id'),'arma mais usada na trail');
  assert.ok(p.owned[0]!==wIdx&&rec.sigW!==X('WEAPONS['+p.owned[0]+'].id'),
    'não é o slot 0 — veio da trail');
  /* sem trail → fallback para a arma ativa (player.wi) no momento da morte */
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  const p2=T.getPlayer();
  X('recorder=[]');
  X('player.wi='+p2.owned[0]);
  die({kills:60,wave:6,dur:400,cause:'enemy',rows:0});
  assert.strictEqual(qnow()[0].sigW,X('WEAPONS['+p2.owned[0]+'].id'),'fallback para arma ativa');
});
ok('B1-21: módulos assinatura — 2..4 representativos, determinísticos, do inventário real; vazio ⇒ []',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('wraith');
  const p=T.getPlayer();
  for(const id of ['olho','crit_cadeia','estilhaco','rebob'])T.grantItemInternal(p,T.itemById(id),true);
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  const a=qnow()[0].sigItems;
  assert.ok(Array.isArray(a)&&a.length>=2&&a.length<=4,'2..4 módulos (got '+a.length+')');
  assert.ok(a.every(x=>typeof x==='string'),'ids string');
  assert.ok(a.every(x=>ITEM_IDS.indexOf(x)>=0),'ids conhecidos: '+JSON.stringify(a));
  /* determinismo: mesma build + mesma trail ⇒ mesma assinatura */
  T.activateSlot(1);clearAllSlots();bootRun('wraith');
  const p2=T.getPlayer();
  for(const id of ['olho','crit_cadeia','estilhaco','rebob'])T.grantItemInternal(p2,T.itemById(id),true);
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  assert.deepStrictEqual(qnow()[0].sigItems,a,'mesma build ⇒ mesmos módulos');
  /* sem itens ⇒ [] */
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  assert.deepStrictEqual(qnow()[0].sigItems,[]);
});

/* ============ 22–23. TEMA / SEED ============ */
ok('B1-22: Tema — theme da run capturado (id do Diretor de Fratura); sem Diretor ⇒ null',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  const th=X('typeof fractureGetThemeId==="function"?fractureGetThemeId():null');
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  assert.strictEqual(qnow()[0].theme,th);
  assert.strictEqual(slotFile(1)[0].theme,th,'theme persiste no arquivo');
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  X('fractureRun=null');
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  assert.strictEqual(qnow()[0].theme,null,'null-safe sem Diretor');
});
ok('B1-23: seed — seed uint da run capturada; sem seed ⇒ null (sem NaN/string)',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  const sd=X('typeof fractureGetSeed==="function"?fractureGetSeed():0');
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  const rec=qnow()[0];
  if(sd>0){assert.ok(Number.isInteger(rec.seed)&&rec.seed>0);assert.strictEqual(rec.seed,sd>>>0);}
  else assert.strictEqual(rec.seed,null);
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  X('fractureRun=null');
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  assert.strictEqual(qnow()[0].seed,null);
});

/* ============ 24–26. DEATH CAUSE ============ */
ok('B1-24: death cause — causa confiável do ÚLTIMO evento de dano vira causa da memória',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  die({kills:60,wave:6,dur:400,cause:'miniboss'});
  assert.strictEqual(qnow()[0].cause,'miniboss');
  assert.strictEqual(slotFile(1)[0].cause,'miniboss');
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  die({kills:60,wave:6,dur:400,cause:'hazard'});
  assert.strictEqual(qnow()[0].cause,'hazard');
  /* categorização de atores/projéteis é conservadora */
  assert.strictEqual(T.pr15CauseOf({type:'boss'}),'boss');
  assert.strictEqual(T.pr15CauseOf({type:'miniboss'}),'miniboss');
  assert.strictEqual(T.pr15CauseOf({type:'shadow'}),'echo');
  assert.strictEqual(T.pr15CauseOf({slot:2}),'echo');
  assert.strictEqual(T.pr15CauseOf({type:'chaser'}),'enemy');
  assert.strictEqual(T.pr15CauseOf({}),'enemy');
  assert.strictEqual(T.pr15CauseOf(null),null);
  assert.strictEqual(T.pr15ProjectileCause({srcC:'boss'}),'boss');
  assert.strictEqual(T.pr15ProjectileCause({owner:{slot:1}}),'echo');
  assert.strictEqual(T.pr15ProjectileCause({srcC:'lagarto'}),undefined);
  /* instrumentação presente nos call-sites confiáveis do código */
  const src=normalizeSource(SRC);
  assert.ok(/damagePlayer\(16,'boss'\)/.test(src)&&/damagePlayer\(e\.dmg,'enemy'\)/.test(src),
    'sites anotados (feixe do boss + contato comum)');
  assert.ok(/damagePlayer\(e\.dmg\*\.45,'hazard'\)/.test(src),'zona (hazard) anotada');
  assert.ok(/damagePlayer\(e\.dmg\*cfg\.dmgMul,pr15CauseOf\(e\)\)/.test(src),'investida com causa do ator');
  assert.ok(/pr15ProjectileCause\(p\)/.test(src),'projétil resolve causa do dono/tag');
});
ok('B1-25: death cause unknown — sem marca confiável no último evento, causa = unknown',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  die({kills:60,wave:6,dur:400});               // sem causa
  assert.strictEqual(qnow()[0].cause,'unknown');
  assert.strictEqual(slotFile(1)[0].cause,'unknown');
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  X('pr15NoteDamage("boss")');                  // marca, depois evento SEM causa
  X('pr15NoteDamage(undefined)');
  die({kills:60,wave:6,dur:400});
  assert.strictEqual(qnow()[0].cause,'unknown','último evento sem causa ⇒ unknown (sem vazar boss)');
});
ok('B1-26: reset death cause — contexto run-scoped zera em nova run/Continue/abort; nunca reaproveita',()=>{
  T.activateSlot(1);bootRun('vector');
  X('pr15NoteDamage("boss")');
  assert.strictEqual(X('pr15ResolveCause()'),'boss');
  X('pr15ResetCause()');                        // equivale ao reset de run/Continue/abort
  const ctx=JSON.parse(X('JSON.stringify(pr15CauseCtxSnapshot())'));
  assert.deepStrictEqual(ctx,{ev:0,causeEv:0,cause:null,pending:null,abort:false});
  X('pr15NoteDamage("enemy")');
  assert.strictEqual(X('pr15ResolveCause()'),'enemy');
  bootRun('vector');                            // nova run zera o contexto
  const c2=JSON.parse(X('JSON.stringify(pr15CauseCtxSnapshot())'));
  assert.strictEqual(c2.cause,null);
  assert.strictEqual(c2.ev,0);
});

/* ============ 27–30. SAVE/LOAD · OLD SAVE · CORRUPT · SLOTS ============ */
ok('B1-27: save/load — assinatura v3 persiste no arquivo e volta idêntica na ativação do slot',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  die({kills:60,wave:6,dur:400,cause:'boss'});
  const mem=qnow()[0];
  const file=slotFile(1);
  assert.strictEqual(file.length,1);
  assert.strictEqual(file[0].v,3);
  assert.strictEqual(file[0].id,mem.id);
  assert.strictEqual(file[0].cause,'boss');
  assert.deepStrictEqual(file[0].arch,mem.arch);
  assert.deepStrictEqual(file[0].sigItems,mem.sigItems);
  assert.strictEqual(file[0].sigW,mem.sigW);
  T.activateSlot(1);
  const reloaded=qnow();
  assert.strictEqual(reloaded.length,1);
  const r2=reloaded[0];
  assert.strictEqual(r2.v,3);
  assert.strictEqual(r2.id,mem.id);
  assert.strictEqual(r2.cause,'boss');
  assert.deepStrictEqual(r2.arch,mem.arch);
  assert.deepStrictEqual(r2.sigItems,mem.sigItems);
  assert.ok(r2.ps&&r2.st&&r2.trail.length===mem.trail.length);
  assert.strictEqual(r2.kills,60,'kills disponível após reload (k→kills)');
});
ok('B1-28: old save — save v2 antigo (sem id/assinatura) carrega sem migração forçada, sem perda e segue fazendo Echo',()=>{
  T.activateSlot(1);clearAllSlots();
  X('smRoot.slots[1].echoes='+JSON.stringify([fileV2(7),fileV2(8)]));X('smCommit();');
  T.activateSlot(1);
  const q=qnow();
  assert.strictEqual(q.length,2);
  assert.strictEqual(q[0].v,2);
  assert.strictEqual(q[0].k,40);
  assert.ok(!('id' in q[0])&&!('sigW' in q[0]),'v2 não recebe assinatura inventada na carga');
  const e=mkEcho(q[0],1);
  assert.strictEqual(e.ok,true);
  assert.strictEqual(e.alive,true);
  assert.ok(e.pers,'personalidade derivada/migrada no v2');
});
ok('B1-29: corrupt/partial record — carrega com fallback; nunca explode load nem destrói o slot',()=>{
  T.activateSlot(1);clearAllSlots();
  const junk=[
    {v:3,trail:[[0,10,10,0,0,0]],cause:'lagarto',out:'x',dom:9,items:'boom',sigItems:[1,2,3,4,5]},
    {v:2,trail:'nada'},
    {v:2,trail:[['x','y']]},
    'string',
    42,
    null,
    {v:2,trail:[[0,50,60,0,0,0],[1,50,60,0,0,0],[2,50,60,0,0,0],[3,50,60,0,0,0],[4,50,60,0,0,0]],moral:null,ps:9},
    {v:2,trail:[[0,'5','6',1,0,0],[1,55,66,1,0,0],[2,60,70,1,0,0],[3,65,75,1,0,0],[4,70,80,1,0,0]],moral:null,ps:9},
    fileV2(9)
  ];
  X('smRoot.slots[1].echoes='+JSON.stringify(junk));
  X('smRoot.slots[2].echoes='+JSON.stringify([fileV2(21)]));
  X('smRoot.slots[3].echoes='+JSON.stringify([fileV2(31)]));
  X('smCommit()');
  T.activateSlot(1);                            // não explode
  const q=qnow();
  assert.ok(Array.isArray(q));
  assert.ok(q.every(r=>r&&typeof r==='object'&&Array.isArray(r.trail)),'só registros com replay possível');
  const loaded=T.loadEchoes();                  // também não explode
  assert.ok(Array.isArray(loaded));
  /* o registro com strings numéricas sobrevive íntegro (reparo em números) */
  const w=qnow().filter(r=>r.tag==='L9'||(r.trail&&r.trail[0]&&r.trail[0][0]===0&&r.trail.length===5));
  for(const r of w){
    const e=mkEcho(r,1);
    assert.strictEqual(e.ok,true,'makeEcho após carga corrupta');
    assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y));
  }
  T.activateSlot(2);
  const q2=qnow();
  assert.strictEqual(q2.length,1);
  assert.strictEqual(q2[0].tag,'L21','slot 2 intacto');
  T.activateSlot(3);
  assert.strictEqual(qnow().length,1);
});
ok('B1-30: isolamento dos 3 slots — memória e seq de um slot nunca vazam para os outros',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  die({kills:60,wave:6,dur:400,cause:'enemy'});
  const f1=slotFile(1),f2=slotFile(2),f3=slotFile(3);
  assert.strictEqual(f1.length,1);
  assert.strictEqual(f2.length,0);
  assert.strictEqual(f3.length,0);
  assert.ok(seqFile(1)>=1);
  assert.strictEqual(seqFile(2),0);
  assert.strictEqual(seqFile(3),0);
  T.activateSlot(2);bootRun('vector');
  die({kills:70,wave:7,dur:500,cause:'miniboss'});
  assert.ok(/^e2-1$/.test(qnow()[0].id),'id escopado por slot: '+qnow()[0].id);
  assert.strictEqual(slotFile(1).length,1,'slot 1 intocado');
  assert.strictEqual(seqFile(1),1,'seq do slot 1 não foi incrementado pela run do slot 2');
});

/* ============ 31–33. CONTINUE ============ */
ok('B1-31: Continue — retomada preserva a fila e zera o contexto de causa da run anterior',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  X('pr15NoteDamage("boss")');
  X('kills=50;wave=4;runTime=200');
  assert.ok(T.captureCheckpoint('b1-continue',4),'checkpoint criado');
  const before=qnow().map(r=>r.id);
  const ctxBefore=JSON.parse(X('JSON.stringify(pr15CauseCtxSnapshot())'));
  assert.strictEqual(ctxBefore.cause,'boss');
  T.resumeRun();
  const ctxAfter=JSON.parse(X('JSON.stringify(pr15CauseCtxSnapshot())'));
  assert.strictEqual(ctxAfter.cause,null,'causa zerada no Continue');
  assert.strictEqual(ctxAfter.ev,0);
  assert.deepStrictEqual(qnow().map(r=>r.id),before,'fila preservada no Continue');
  assert.strictEqual(X('state'),'play','run retomada');
});
ok('B1-32: morte pós-Continue — run retomada válida que morre gera memória com id monotônico',()=>{
  const before=qnow();
  const lastSeq=seqFile(1);
  die({kills:80,wave:8,dur:600,cause:'boss'});
  const q=qnow();
  assert.strictEqual(q.length,Math.min(2,before.length+1));
  assert.ok(/^e1-\d+$/.test(q[0].id));
  assert.ok(parseInt(q[0].id.split('-')[1],10)>lastSeq,'id monotônico pós-Continue');
  assert.strictEqual(q[0].cause,'boss');
});
ok('B1-33: abort pós-Continue — abortar depois de retomar não cria memória nem desloca',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  X('kills=40;wave=4;runTime=220');
  assert.ok(T.captureCheckpoint('b1-continue-33',4),'checkpoint');
  T.resumeRun();                                // retoma
  const before=qnow().map(r=>r.id);
  X('kills=80;wave=8;runTime=600');
  padRec(30);
  X('pr15NoteDamage("boss")');
  T.setState('paused');
  T.abortRun();                                 // aborta a run retomada
  assert.deepStrictEqual(qnow().map(r=>r.id),before,'abort pós-Continue não desloca');
  assert.strictEqual(X('pr15ResolveCause()'),'unknown','causa não reaproveitada');
  assert.strictEqual(X('state'),'fracture');
  assert.strictEqual(slotFile(1).length,0,'nenhuma memória do abort pós-Continue');
});

/* ============ 34–35. LEGADO E TRAIL ============ */
ok('B1-34: Echos legados continuam carregando — makeEcho/startRun com v2 e com v3 geram aliados íntegros',()=>{
  /* v2 legado via arquivo → activateSlot → makeEcho (personalidade migrada) */
  T.activateSlot(1);clearAllSlots();
  X('smRoot.slots[1].echoes='+JSON.stringify([fileV2(1)]));X('smCommit();');
  T.activateSlot(1);
  const e2=mkEcho(qnow()[0],1);
  assert.strictEqual(e2.ok,true);
  assert.ok(e2.alive===true&&e2.slot===1&&Number.isFinite(e2.trust));
  assert.ok(e2.ps&&e2.pers,'personalidade operacional (v2 migrada)');
  assert.ok(e2.itemIds>=0&&e2.dom==='viol');
  /* v3 novo dentro da mesma fila → startRun reconstrói os aliados */
  T.startRun();
  let echoes=T.getEchoes();
  assert.ok(Array.isArray(echoes)&&echoes.length>=1,'startRun cria o Echo do v2');
  for(const e of echoes){
    assert.ok(e.alive&&Number.isFinite(e.hp)&&Number.isFinite(e.x)&&Number.isFinite(e.y));
    assert.ok(e.itemIds&&Array.isArray(e.itemIds));
    assert.ok(e.dom&&typeof e.dom==='string');
  }
  /* v3: morte válida nova gera memória e startRun cria o aliado dela */
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  die({kills:90,wave:9,dur:700,cause:'boss'});
  T.startRun();
  echoes=T.getEchoes();
  assert.ok(Array.isArray(echoes)&&echoes.length===1,'startRun cria o Echo da memória v3');
  const en=echoes[0];
  assert.ok(en.alive&&Number.isFinite(en.hp)&&Number.isFinite(en.x)&&Number.isFinite(en.y));
  assert.ok(en.dom&&typeof en.dom==='string'&&en.ps&&en.ps.id,'v3 alimenta o Echo (dom/ps)');
});
ok('B1-35: trail preservada — íntegra na memória e no save/load (sem downsample, sem remoção)',()=>{
  T.activateSlot(1);clearAllSlots();bootRun('vector');
  X('recorder=[]');
  for(let i=0;i<400;i++)X('recorder.push(['+(i*.25).toFixed(2)+','+i+','+(i%300)+',1,0,0])');
  const recLen=XJ('JSON.stringify((Array.isArray(recorder)?recorder:[]).length)');
  die({kills:60,wave:6,dur:400,cause:'enemy',rows:400});   // sem refill
  const expected=recLen+1;                                  // +1: linha final de morte (legado)
  const mem=qnow()[0];
  assert.strictEqual(mem.trail.length,expected,'memória guarda a trail completa (+linha de morte)');
  assert.deepStrictEqual(mem.trail[0],[0,0,0,1,0,0],'primeira linha intacta');
  assert.strictEqual(slotFile(1)[0].trail.length,expected,'save guarda a trail completa');
  T.activateSlot(1);
  assert.strictEqual(qnow()[0].trail.length,expected,'reload preserva a trail');
  assert.ok(mem.dur>0&&mem.kills===60);
  assert.ok(expected>=400,'sem downsample');
});

/* ============ 36–37. NENHUMA PRESENÇA / SCHEDULER PR15 ============ */
ok('B1-36: nenhuma presença PR15 criada — sem entidade/UI/tab/loop/evento/recompensa PR15',()=>{
  const body=normalizeSource(SRC);
  const ids=XJ('JSON.stringify(CX_TABS.map(function(t){return t.id;}))');
  assert.ok(ids.indexOf('pr15')<0&&ids.indexOf('temporal')<0,'sem tab PR15 no Codex');
  assert.ok(body.indexOf('id="pr15')<0&&body.indexOf('class="pr15')<0,'sem DOM PR15');
  for(const bad of ['pr15Spawn','pr15Entity','pr15Draw','pr15Render','pr15Ui','pr15Event','pr15Reward','pr15Duel','pr15Banner','pr15Tooltip','pr15Modal'])
    assert.ok(body.indexOf(bad)<0,'token proibido: '+bad);
  const ua=secOf('updateAllies');
  assert.ok(ua.indexOf('pr15')<0,'updateAllies sem wrapper PR15');
  const dw=secOf('drawWorldExtras');
  assert.ok(dw.indexOf('pr15')<0,'drawWorldExtras sem wrapper PR15');
});
ok('B1-37: nenhum scheduler PR15 criado — bloco não agenda nada (sem setInterval/rAF/timeout/spawnWave)',()=>{
  const block=stripComments(pr15Block());
  for(const tok of ['setInterval(','setTimeout(','requestAnimationFrame(','spawnWave(','pr15Scheduler','pr15Tick(','pr15Schedule'])
    assert.ok(block.indexOf(tok)<0,'bloco agenda/token proibido: '+tok);
});

/* ============================================================
   SIMULAÇÃO A — FILA (10.000 resultados mistos)
   ============================================================ */
ok('SIM-A: 10.000 resultados mistos (válidas/inválidas/abort/Sandbox/DEV/vitória) — fila ≤2, inválida nunca desloca, ordem e sem duplicação',()=>{
  const res=XJ('(function(){'+
    'var q=[],captured=0,invalid=0,oversize=0,dup=0,badShift=0,lastCap=-1;'+
    'function base(){return {realDeath:true,sandbox:false,dev:false,abort:false,victory:false};}'+
    'function kind(){var r=Math.random();'+
    '  if(r<0.45){var o=base();o.kills=5+Math.floor(Math.random()*60);o.wave=3+Math.floor(Math.random()*18);o.dur=90+Math.random()*700;return o;}'+
    '  if(r<0.62){var o=base();o.kills=Math.floor(Math.random()*5);o.wave=Math.floor(Math.random()*3);o.dur=Math.random()*89;return o;}'+
    '  if(r<0.78){var o=base();o.realDeath=false;o.abort=true;o.kills=80;o.wave=8;o.dur=500;return o;}'+
    '  if(r<0.88){var o=base();o.sandbox=true;o.kills=80;o.wave=8;o.dur=500;return o;}'+
    '  if(r<0.96){var o=base();o.dev=true;o.kills=80;o.wave=8;o.dur=500;return o;}'+
    '  var o=base();o.realDeath=false;o.victory=true;o.kills=99;o.wave=20;o.dur=999;return o;}'+
    'for(var i=0;i<10000;i++){'+
    '  var k=kind(),before=q.length,idsBefore=[];for(var z=0;z<q.length;z++)idsBefore.push(q[z].id);'+
    '  var res=pr15QueuePush(q,k,{id:"m"+i});'+
    '  q=res.queue;'+
    '  if(q.length>2)oversize++;'+
    '  if(res.captured){captured++;'+
    '    if(q[0].id!=="m"+i)badShift++;'+
    '    for(var z=1;z<q.length;z++){if(q[z].id===q[0].id)dup++;}'+
    '    var cur=parseInt(q[0].id.slice(1),10);'+
    '    if(cur<=lastCap)badShift++;'+
    '    lastCap=cur;'+
    '  }else{invalid++;'+
    '    if(JSON.stringify(q.map(function(x){return x.id;}))!==JSON.stringify(idsBefore))badShift++;}'+
    '}'+
    'return JSON.stringify({captured:captured,invalid:invalid,oversize:oversize,dup:dup,badShift:badShift,last:q.map(function(x){return x.id;})});'+
    '})()');
  assert.strictEqual(res.oversize,0,'fila nunca >2');
  assert.strictEqual(res.badShift,0,'inválida nunca desloca / ordem sempre correta');
  assert.strictEqual(res.dup,0,'sem duplicação acidental');
  assert.ok(res.captured>0&&res.invalid>0,'mistura de desfechos exercitada: '+
    res.captured+' válidas / '+res.invalid+' descartadas');
  assert.ok(res.last.length<=2);
  const nums=res.last.map(id=>parseInt(id.slice(1),10));
  for(let i=1;i<nums.length;i++)assert.ok(nums[i-1]>nums[i],'ordem N-1..N-2 decrescente');
});

/* ============================================================
   SIMULAÇÃO B — VALIDADE (varredura de limites)
   ============================================================ */
ok('SIM-B: varredura kills 0–10 × wave 0–5 × dur 0–120 (7986 combos) bate EXATAMENTE com kills>=5 && (wave>=3||dur>=90) p/ morte real',()=>{
  const res=XJ('(function(){var mism=[],valid=0,total=0;'+
    'for(var kills=0;kills<=10;kills++)for(var wave=0;wave<=5;wave++)for(var dur=0;dur<=120;dur++){'+
    '  total++;var expect=(kills>=5&&(wave>=3||dur>=90));'+
    '  var got=pr15RunIsValid({realDeath:true,sandbox:false,dev:false,abort:false,victory:false,kills:kills,wave:wave,dur:dur});'+
    '  if(got)valid++;if(got!==expect&&mism.length<20)mism.push({kills:kills,wave:wave,dur:dur,got:got});'+
    '}'+
    'return JSON.stringify({total:total,valid:valid,mism:mism});'+
    '})()');
  assert.strictEqual(res.total,11*6*121);
  assert.deepStrictEqual(res.mism,[],'nenhuma divergência de fronteira');
  assert.ok(res.valid>0&&res.valid<res.total);
  /* flags anulam qualquer métrica: sandbox/dev/abort/victory ⇒ sempre inválido */
  for(const flag of ['sandbox','dev','abort','victory']){
    const o={realDeath:flag!=='abort'&&flag!=='victory',kills:999,wave:20,dur:9999};
    o[flag]=true;
    assert.strictEqual(T.pr15RunIsValid(o),false,flag+' anula');
  }
});

/* ============================================================
   SIMULAÇÃO C — SANITIZAÇÃO (corpus hostil)
   ============================================================ */
ok('SIM-C: corpus hostil (antigos/parciais/ausentes/tipos errados/enums inválidos/arrays grandes/strings) — nenhum explode load, destrói slot, gera NaN ou quebra makeEcho',()=>{
  const corpus=[
    {v:2,dur:180,dmgMul:1.1,wave:5,trail:[[0,10,10,1,0,0],[1,11,10,1,0,0],[2,12,10,1,0,0],[3,12,11,1,0,0],[4,12,12,1,0,0]],k:30,mh:100,moral:{comp:1,greed:2,viol:3},dom:'neutro',st:{s:10},ps:null},
    {v:1,dur:90,wave:3,trail:[[0,5,5,1,0,0]],k:9},
    {},
    {trail:[[0,5,5,1,0,0]],wave:'cinco'},
    {v:3,trail:[[0,5,5,1,0,0],[1,'a','b',1,0,0],[2,NaN,5,1,0,0]],out:'lagarto',cause:'x',dom:'',moral:[]},
    {v:3,trail:[[0,5,5,1,0,0]],sigItems:new Array(500).fill('a'),items:new Array(300).fill('nucleo')},
    {v:3,trail:[[0,5,5,1,0,0]],owned:new Array(200).fill('arma'),items:'tudo',upg:42,st:NaN,ps:'x',id:new Array(100).fill('i').join('')},
    {v:3,trail:[[0,5,5,1,0,0]],arch:{dom:9,sec:{},state:5,domS:'alta',secS:[]},sigW:7,theme:12,seed:-1,op:0},
    {v:3,trail:[[0,'5','6',1,0,0],[1,'7','8',1,0,0],[2,9,10,1,0,0],[3,11,12,1,0,0],[4,13,14,1,0,0]],wave:9,kills:99,dur:999,moral:{comp:'a',greed:null,viol:2}},
    {v:2,trail:[[0,1,2,3,4,5]],owned:[]}
  ];
  let cleaned=0;
  for(const c of corpus){
    const s=san(c);                       // nunca lança
    if(s===null)continue;                 // irrecuperável sai em memória (nunca explode)
    cleaned++;
    const e=mkEcho(s,1);
    assert.strictEqual(e.ok,true,'makeEcho quebrou para: '+JSON.stringify(c).slice(0,120)+' → '+e.msg);
    assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y)&&Number.isFinite(e.maxHp)&&Number.isFinite(e.trust));
    if(Array.isArray(s.sigItems))assert.ok(s.sigItems.length<=4,'sigItems cap 4');
    if(s.arch)assert.ok(s.arch.dom===null||ARCH_IDS.indexOf(s.arch.dom)>=0);
    assert.ok(s.trail.every(row=>Array.isArray(row)&&row.slice(0,6).every(v=>typeof v==='number'&&Number.isFinite(v))),
      'trail 100% numérica após sanitização');
  }
  assert.ok(cleaned>0);
  T.activateSlot(1);
  X('smRoot.slots[1].echoes='+JSON.stringify(corpus.concat(fileV2(1),fileV2(2))));
  T.activateSlot(1);
  assert.ok(Array.isArray(qnow()),'activateSlot sobrevive ao corpus hostil');
  const loaded=T.loadEchoes();
  assert.ok(Array.isArray(loaded),'loadEchoes sobrevive ao corpus hostil');
  T.activateSlot(2);
  assert.ok(Array.isArray(qnow()));
  T.activateSlot(3);
  assert.ok(Array.isArray(qnow()));
  T.activateSlot(1);
  for(const r of qnow()){
    for(const k of ['wave','kills','dur','mh','level','k']){
      if(r[k]!=null)assert.ok(Number.isFinite(r[k]),'NaN em '+k);
    }
    if(r.trail)assert.ok(r.trail.every(row=>Array.isArray(row)&&row.slice(0,6).every(v=>typeof v==='number'&&Number.isFinite(v))),
      'trail carregada 100% numérica');
  }
});

console.log('');
if(failed){console.log(failed+' FALHAS');process.exit(1);}
console.log('B1 — '+passed+' PASSARAM · 0 FALHAS');
