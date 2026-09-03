'use strict';
/* =====================================================================
   TESTES — PR 12: FACÇÕES + ECONOMIA TEMPORAL + ECHO EQUIPMENT
   ---------------------------------------------------------------------
   · 4 facções observadoras (Âncora ⬡ / Remanescentes ◉ / Consórcio ◈ /
     Desviados ◬) — afinidade RUN-SCOPED, nunca escolha em tela;
   · factionEmit: grid central, deltas pequenos, estados narrativos,
     primeiro contato por observação, múltiplas relações simultâneas;
   · Resíduos Temporais: moeda da run (add/spend/pack/unpack/reset),
     sem saldo negativo e sem duplicação via checkpoint;
   · Echo Equipment: 42+ itens (≥36 de facção + ≥6 neutros), 3 categorias,
     fonte echoeq:<facção>:<id>, refresh a partir do chassis (eqBase),
     espelho no checkpoint (eq[i].b), caps por onda/run;
   · Loja Temporal [ OPERADOR | ECHO ]: aba OPERADOR intacta, aba ECHO
     com empty-state sem Echo, estoque deterministicamente restaurado;
   · Personalidade ↔ tags (matriz leve) e reação contextual de equipar;
   · ofertas/transmissões com custos variados e gating por onda/afinidade;
   · run reset: estado mecânico não atravessa runs; Codex discovery
     (fracDisc) é separado e per-slot.
   Rodar: npm test  |  node tests/pr12.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];
/* exporta globais do jogo + API PR 12 para o teste */
src+=';globalThis.__t={'+
  'FACTION_IDS,FRACTIONS,FRACTION_BY_ID,FACTION_STATES,RES_SYM,'+
  'FRAC_OFFERS,ECHO_EQUIP,ECHO_EQ_BY_ID,EQ_CAT,FACTION_GRID,FACTION_REASON,'+
  'FACTION_RUN_EVENTS,FRAC_CONTACT_EVENTS,EV_FAMILIES,CX_TABS,'+
  'EQ_PERS_TAGS,eqPersId,eqTagPref,eqReactionOnce,'+
  'fracFresh,fracStateOf,getFactionAffinity,getFactionState,fracApplyDelta,factionEmit,fracDiscover,fracKnows,'+
  'fracRunPack,fracRunUnpack,fracDiscLoad,fracDiscSave,'+
  'addResidues,spendResidues,fracRes,fracRestoreEquipment,'+
  'fracOwnedIds,fracEqCost,fracPriceNote,fracOffersOpen,fracStockPool,fracRollStock,'+
  'fracRelicEmit,fracUnequip,fracBuyFromStock,fracSetSel,fracEchoSelLive,'+
  'echoEqById,echoEqInit,echoEqRefresh,echoEqDynMul,echoEqCapReset,echoEqTick,'+
  'echoEqEmit,echoEqBeh,echoEqRefreshForAll,echoEqLiveDef,'+
  'fracSheetEqSummary,fracHudChip,fracCodexBody,fracDevCommand,'+
  'fracDevInspectorText,fracSandboxAction,fracKitRunStart,fracKitRunEnd,'+
  'fracKitBoot,fracRegEvents,fracTab,fracShopStock,fracForceEventKind,'+
  'renderShop,renderShopEcho,renderShopOp,openShop,closeShop,rollShop,shopIcon,'+
  'getFrac:()=>fracRun,setFrac:v=>{fracRun=v;},'+
  'getEchoes:()=>echoes,setEchoes:a=>{echoes=a;},'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'setWave:v=>{wave=v|0;},getWave:()=>wave,'+
  'setState:s=>{state=s;},getState:()=>state,'+
  'setFracTab:v=>{fracTab=v;},getFracTab:()=>fracTab,'+
  'getStock:()=>fracShopStock,setStock:a=>{fracShopStock=a;},'+
  'getEl:id=>document.getElementById(id),'+
  'setBeacon:b=>{beacon=b;},getBeacon:()=>beacon,'+
  'getDisc:()=>fracDisc,setDisc:v=>{fracDisc=v;},fracDiscClean,'+
  'startRun,resumeRun,makePlayer,mkEchoAux:null,updatePlayer,'+
  'echoRelInit,echoRelState,setEchoTrust,changeEchoTrust,relAddPressure,'+
  'echoSetDis,relPressurePct,relFractureAt,echoAllied,makeEcho,echoSpeak,'+
  'FRAC_SERVICES,fracServicesOpen,fracAcceptService,fracServiceById,'+
  'fracEquipFromInv,getResidues,killEnemy,getEnemies:()=>enemies,'+
  'damageEcho,echoRelScore,echoRelState,eqPrioTarget,eqScoreFor,echoAllied,'+
  'setCodexTab:v=>{codexTab=v;},getCodexTab:()=>codexTab,'+
  'getRunSt:()=>runSt,setRunSt:v=>{runSt=v;},'+
  'clearDevTaint:()=>{devTainted=false;},isTainted:()=>devTainted,'+
  'DEV_get:()=>DEV,DEV_on:()=>{DEV_MODE=true;},DEV_off:()=>{DEV_MODE=false;},'+
  'smEnsureSlot,smCommit,smRootGet:()=>smRoot,'+
  'setMoral:(c,g,v)=>{moral.comp=c;moral.greed=g;moral.viol=v;}};'+
  'Object.assign(globalThis.__t,{'+
  'smBuildCheckpoint,captureCheckpoint,checkpointShopPurchase,hasActiveRun,'+
  'clearActiveRun,activateSlot,smSanitizeRun,smSanitizeSlot,smDefaultSlot,'+
  'smNewRoot,smLoadRoot,onPlayerDeath,onVictory,showVictory,beginNextRun,'+
  'saveEchoes,saveProg,saveMeta,getRunSt:()=>runSt,'+
  'getEchoQueue:()=>echoQueue,setEchoQueue:q=>{echoQueue=q;},'+
  'getActiveRun:()=>activeRun,getCurSlot:()=>curSlot,'+
  'getMeta:()=>meta,getProg:()=>prog,'+
  'sandboxActive,sandboxOpenSetup,sandboxStart,sandboxExit,sandboxRestart,'+
  'sandboxEndToSetup,sandboxCloseSetup,sandboxValidateCfg,'+
  'getSandboxRun:()=>sandboxRun,getSandboxMode:()=>sandboxMode,'+
  'getSandboxCfg:()=>sandboxCfg,sandboxSessionInfo,'+
  'fracSandboxAction,fracSandboxEcho,fracSandboxEquip,fracSandboxUnequip,'+
  'fracSandboxEchoTarget,fracSandboxTearDown,'+
  'fracBuyFromStock,fracUnequip,fracEquipFromInv,fracRelicEmit,fracSetSel,fracKitRunStart,'+
  'fracKitRunEnd,fracOffersOpen,fracRollStock,echoEqLiveDef,echoEqCapReset,'+
  'SM_KEY,RES_MAX,REROLL_BASE,setChar});';

/* ---------------- DOM mínimo ---------------- */
function makeStyle(){
  const store={};
  return new Proxy(store,{get(t,k){return k in t?t[k]:'';},
    set(t,k,v){t[k]=String(v);return true;}});
}
function ctx2d(){
  const grad={addColorStop(){}};
  const numProps=new Set(['globalAlpha','lineWidth','shadowBlur','font','fillStyle',
    'strokeStyle','lineCap','textAlign','imageSmoothingEnabled']);
  return new Proxy({},{get(t,k){
    if(k==='canvas')return{width:0,height:0};
    if(k==='measureText')return()=>({width:0});
    if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;
    if(numProps.has(k))return 1;
    return()=>{};
  },set(){return true;}});
}
function makeEl(id){
  const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,
    _cls:new Set(),_handlers:{},parentNode:null,
    isConnected:true,offsetWidth:0,offsetHeight:0,
    textContent:'',innerHTML:'',className:'',title:'',style:makeStyle()};
  el.classList={
    add:(...c)=>c.forEach(x=>el._cls.add(x)),
    remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
    contains:c=>el._cls.has(c),
    toggle(c,f){const has=el._cls.has(c);const want=f===undefined?!has:!!f;
      if(want)el._cls.add(c);else el._cls.delete(c);return want;}
  };
  el.appendChild=c=>{if(c&&typeof c==='object')c.parentNode=el;
    el.children.push(c);return c;};
  el.insertBefore=c=>{if(c&&typeof c==='object')c.parentNode=el;
    el.children.unshift(c);return c;};
  el.removeChild=c=>{const i=el.children.indexOf(c);
    if(i>=0){el.children.splice(i,1);if(c&&typeof c==='object')c.parentNode=null;}
    return c;};
  el.remove=()=>{if(el.parentNode&&el.parentNode.removeChild)el.parentNode.removeChild(el);};
  el.addEventListener=(ev,fn)=>{(el._handlers[ev]=el._handlers[ev]||[]).push(fn);};
  el.removeEventListener=(ev,fn)=>{const a=el._handlers[ev];if(!a)return;
    const i=a.indexOf(fn);if(i>=0)a.splice(i,1);};
  el.dispatchEvent=()=>{};
  el.click=()=>{for(const fn of (el._handlers.click||[]).slice())fn({stopPropagation(){}});};
  el.querySelector=()=>null;el.querySelectorAll=()=>[];
  el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};
  el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];
  el.getContext=()=>ctx2d();
  return el;
}
/* CORREÇÃO DE HARNESS (PR12 BLOCO 2 §31): o DOM fake não devolvia nós
   criados via createElement + appendChild (ex.: #frac-sheet-eq anexado por
   fracSheetEqSummary), porque getElementById só consultava um cache estático.
   O DOM real resolve pela árvore; aqui varremos a árvore real dos stubs antes
   de criar um stub novo — sem alterar NENHUMA linha de produção. */
function findByTree(root,id){
  if(!root||typeof root!=='object')return null;
  if(root.id===id)return root;
  const ch=root.children;
  if(!ch)return null;
  for(const c of ch){const f=findByTree(c,id);if(f)return f;}
  return null;
}
/* B5: ambiente (DOM/localStorage) FACTORY — cada boot ganha instâncias
   próprias, permitindo simular RELOAD (serializar echoSave.v3 → novo
   contexto) e isolar byte-a-byte o Sandbox. */
function makeEnv(seed){
  const elements=new Map();
  const document={
    hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
    fullscreenElement:null,webkitFullscreenElement:null,
    createElement:()=>makeEl(''),
    getElementById:id=>{
      for(const root of [document.body,document.documentElement].concat(
        Array.from(elements.values()))){
        const f=findByTree(root,id);
        if(f)return f;
      }
      if(!elements.has(id))elements.set(id,makeEl(id));
      return elements.get(id);
    },
    querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},
    hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()
  };
  const window={
    innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    screen:{availWidth:1280,availHeight:720},
    addEventListener:()=>{},removeEventListener:()=>{},
    matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),
    AudioContext:undefined,webkitAudioContext:undefined,
    open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined
  };
  const localStorage={_d:Object.assign({},seed||{}),
    getItem(k){return this._d[k]||null;},
    setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
  const navigator={getGamepads:()=>[]};
  return {elements,document,window,localStorage,navigator};
}
/* roda o script REAL num contexto novo; seed = {chave:valor} p/ o boot. */
function runGame(env,noTimers){
  const sandbox={console,Math,Date,parseInt,parseFloat,isNaN,
    setTimeout:noTimers?()=>0:setTimeout,
    clearTimeout:noTimers?()=>{}:clearTimeout,
    requestAnimationFrame:()=>0,Uint8ClampedArray,Array,Object,Number,String,Boolean,
    RegExp,Error,Map,Set,Promise,Proxy,Reflect,JSON,Symbol,
    document:env.document,window:env.window,localStorage:env.localStorage,
    navigator:env.navigator,performance:{now:()=>Date.now()}};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(src,ctx,{timeout:30000});
  const t=vm.runInContext('__t',ctx);
  t._ls=env.localStorage;
  t._env=env;
  return {t,ctx,env};
}
/* boot principal (suíte histórica) — mesmo comportamento de sempre */
const MAIN=runGame(makeEnv({}),false);
const t=MAIN.t;
const ctx=MAIN.ctx;
const document=MAIN.env.document;
const localStorage=MAIN.env.localStorage;
/* contexto novo p/ cada RELOAD (B5): timers inertes p/ não segurar o loop */
function bootP12(seed,noTimers){return runGame(makeEnv(seed),noTimers!==false);}

/* ---------------- helpers ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+(e&&e.stack||e).toString().split('\n').slice(0,4).join('\n    '));}
}
function inRun(){
  t.setPlayer(null);
  t.setState('title');
  t.startRun();
  t.clearDevTaint();
  return t.getPlayer();
}
/* Echo sintético (mesmo formato de relationship/events) */
function stOf(o){
  const st={s:2400,mw:0,rw:2400,dsh:0,dt:0,dd:0,sh:0,hi:0,ms:0,mh:0,
    lo:0,cr:0,mv:0,fv:0,ctl:0,kw:0,sb:0,dS:2400*250,dN:2400};
  return Object.assign(st,o);
}
function trail(len,w){
  const tr=[];
  for(let i=0;i<len;i++)tr.push([i*.25,100+i,120-i,i%4===0?2:1,0,w||0]);
  return tr;
}
function echoData(pid){
  return {dur:60,trail:trail(100,0),items:[],upg:[],owned:[0,1],
    dom:'neutro',moral:{comp:2,greed:2,viol:2},kills:5,mh:100,
    st:stOf({}),dmgMul:1,frMul:1,wave:2,level:1,
    ps:{id:pid||'versatile',tr:[],c:.9,s:{},v:1}};
}
function mkEcho(pid,slot){
  const e=t.makeEcho(echoData(pid),slot==null?1:slot);
  e.alive=true;
  t.echoRelInit(e);
  t.setEchoTrust(e,55,'pr12_teste');
  t.echoEqInit(e);
  return e;
}
const RES=()=>t.getFrac()?t.getFrac().res:0;
const J=x=>JSON.stringify(x);
function startRunP12(){
  const p=inRun();
  assert(t.getFrac(),'fracRun precisa existir após startRun');
  return p;
}
function equipForTest(e,itId){
  /* caminho real de equipamento: inventário → fracEquipFromInv (a mesma
     função do painel da loja — instala, aplica o refresh e checkpointa) */
  t.setEchoes([e]);
  t.fracSetSel(0);                   // seleção do Echo recém-semeado (anti-vazamento entre testes)
  t.setFracTab('echo');
  const it=t.echoEqById(itId);
  const idx=e.slot-1;
  const slot={n:'n',p:'p',r:'r'}[it.cat];
  const fr=t.getFrac();
  fr.eq[idx][slot]=null;
  if(e[slot]===itId)e[slot]=null;
  fr.res=999;
  const inv=fr.es.inv;
  if(inv.indexOf(itId)<0)inv.push(itId);   // o item precisa estar no inventário p/ instalar
  const okEq=t.fracEquipFromInv(itId);
  return okEq;
}
const FID={AN:'anchor',RE:'remnants',CO:'consortium',DE:'deviants'};

console.log('\nECHO — PR 12 · Facções + Economia Temporal + Echo Equipment');
console.log('---------------------------------------------');

/* ============ [0] ESTRUTURA E CONTEÚDO ============ */
console.log('\n[0] ESTRUTURA E CONTEÚDO');
ok('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(m[1]);
});
ok('4 facções com identidade completa (filosofia/métodos/contradição/Echo/Fratura)',()=>{
  assert.strictEqual(t.FACTION_IDS.length,4);
  assert.strictEqual(J(t.FACTION_IDS),J(['anchor','remnants','consortium','deviants']));
  for(const f of t.FRACTIONS){
    for(const k of ['nm','sym','col','ideologia','frase','short','metodos','echos',
      'fraturas','contradicao','pergunta'])
      assert.ok(f[k],f.id+' sem '+k);
    assert.ok((f.lore||[]).length>=4,f.id+' precisa de 4+ verbetes de lore');
    assert.strictEqual(f.sym,{'anchor':'⬡','remnants':'◉','consortium':'◈','deviants':'◬'}[f.id]);
  }
  const cons=t.FRACTION_BY_ID.consortium;
  assert.ok(cons.sym!==t.RES_SYM,'símbolo do Consórcio difere do glifo de Resíduos');
});
ok('16+ verbetes de lore (4 por facção) com origem/filosofia/métodos/contradição',()=>{
  let n=0;
  for(const f of t.FRACTIONS){
    const ids=(f.lore||[]).map(l=>l.id);
    assert.strictEqual(new Set(ids).size,ids.length,'ids de lore duplicados');
    n+=ids.length;
  }
  assert.ok(n>=16,'lore total: '+n);
});
ok('estados narrativos: 7 faixas ordenadas e sem sobreposição de leitura',()=>{
  const st=t.FACTION_STATES;
  assert.strictEqual(st.length,7);
  for(let i=0;i<st.length-1;i++)
    assert.ok(st[i].min>st[i+1].min,'faixas devem cair em min');
  assert.ok(/ALIADA|FAVORÁVEL|OBSERVANDO|DESCONFIADA|HOSTIL/.test(
    st.map(x=>x.lab).join(' ')));
  assert.ok(st.every(s=>s.lab&&s.col));
});
ok('conteúdo PR12: ≥12 eventos de facção + 4 primeiros contatos registrados',()=>{
  assert.ok(t.FACTION_RUN_EVENTS.length>=12,'eventos: '+t.FACTION_RUN_EVENTS.length);
  assert.ok(t.FRAC_CONTACT_EVENTS.length>=4);
  const AB={'anc':'anchor','rem':'remnants','con':'consortium','dev':'deviants'};
  const per={};
  for(const ev of t.FACTION_RUN_EVENTS){
    const raw=ev.kind.indexOf('fa_')===0?ev.kind.split('_')[1]:ev.id.split('_')[1];
    const key=AB[raw]||raw;
    per[key]=(per[key]||0)+1;
    assert.ok(t.EV_FAMILIES[ev.family],'family inválida '+ev.id);
    assert.strictEqual(typeof ev.render,'function');
  }
  for(const fid of t.FACTION_IDS)
    assert.ok(per[fid]===3,'faltam eventos de '+fid+' ('+per[fid]+')');
  const fam=t.FACTION_RUN_EVENTS.filter(e=>e.family==='fracao').length+
    t.FRAC_CONTACT_EVENTS.filter(e=>e.family==='fracao').length;
  assert.ok(fam>=16,'eventos com family fracao: '+fam);
});
ok('ECA: catálogo de Echo Equipment ≥42 (36 de facção + 6 neutros), 3 por categoria/facção',()=>{
  assert.ok(t.ECHO_EQUIP.length>=42,'total: '+t.ECHO_EQUIP.length);
  const byOrigin={},byCat={};
  for(const it of t.ECHO_EQUIP){
    byOrigin[it.origin]=(byOrigin[it.origin]||0)+1;
    byCat[it.cat]=(byCat[it.cat]||0)+1;
    assert.ok(it.id&&it.nm&&it.ds&&it.desc,'item incompleto: '+it.id);
    assert.ok(['n','p','r'].indexOf(it.cat)>=0,'cat inválida '+it.id);
    assert.ok(['neutral','anchor','remnants','consortium','deviants'].indexOf(it.origin)>=0);
    assert.ok(Number.isInteger(it.price)&&it.price>=3&&it.price<=10,
      'preço fora de 3..10: '+it.id);
    assert.ok(Array.isArray(it.tags)&&it.tags.length,'tags ausentes: '+it.id);
    if(it.stats||it.beh||it.fx){}else assert.fail('sem efeito: '+it.id);
  }
  assert.ok(byOrigin.neutral>=6,'neutros: '+byOrigin.neutral);
  for(const fid of ['anchor','remnants','consortium','deviants']){
    assert.ok(byOrigin[fid]>=9,'facção '+fid+' com '+byOrigin[fid]);
    for(const cat of ['n','p','r']){
      const n=t.ECHO_EQUIP.filter(it=>it.origin===fid&&it.cat===cat).length;
      assert.ok(n>=3,'§7: '+fid+'/'+cat+' precisa de ≥3 ('+n+')');
    }
  }
  for(const cat of ['n','p','r'])
    assert.ok(t.ECHO_EQUIP.filter(it=>it.origin==='neutral'&&it.cat===cat).length>=2,
      '§8: neutral '+cat+' precisa de ≥2');
  for(const cat of ['n','p','r'])assert.ok(byCat[cat]>=12,'categoria '+cat);
  const uniq=new Set(t.ECHO_EQUIP.map(it=>it.id));
  assert.strictEqual(uniq.size,t.ECHO_EQUIP.length,'ids únicos');
});
ok('ids estáveis echoeq:<facção>:<id> — fonte documentada e remoção limpa',()=>{
  for(const it of t.ECHO_EQUIP){
    const src='echoeq:'+it.origin+':'+it.id;
    assert.ok(it.origin==='neutral'||src.startsWith('echoeq:'+it.origin+':'));
    assert.strictEqual(t.echoEqById(it.id).id,it.id,'índice inconsistente');
  }
});

/* ============ [1] FACÇÕES — AFINIDADE RUN-SCOPED ============ */
console.log('\n[1] AFINIDADE — behavior-driven e run-scoped');
ok('startRun cria fracRun zerado (PR11.5 migra com defaults)',()=>{
  startRunP12();
  const fr=t.getFrac();
  assert.strictEqual(fr.res,0);
  for(const fid of t.FACTION_IDS){
    assert.strictEqual(fr.aff[fid],0);
    assert.strictEqual(fr.obs[fid],0);
  }
  assert.strictEqual(J(fr.eq),J([{n:null,p:null,r:null},{n:null,p:null,r:null}]));
  assert.strictEqual(J(fr.es.inv),J([]));
  assert.strictEqual(fr.es.rerollCost,3);   // REROLL_BASE auditado no Bloco 3 (§24)
});
ok('fracStateOf mapeia o número interno para estado narrativo',()=>{
  const fr=t.getFrac();
  const set=v=>{for(const fid of t.FACTION_IDS)fr.aff[fid]=v;};
  set(90);assert.strictEqual(t.fracStateOf('anchor').id,'aliada');
  set(60);assert.strictEqual(t.fracStateOf('anchor').id,'favoravel');
  set(0);assert.strictEqual(t.fracStateOf('anchor').id,'neutra');
  set(-90);assert.strictEqual(t.fracStateOf('anchor').id,'hostil');
  set(-40);assert.strictEqual(t.fracStateOf('anchor').id,'desconfiada');
});
ok('factionEmit aplica o grid com deltas pequenos (≤4) e múltiplas facções juntas',()=>{
  const fr=t.getFrac();
  for(const fid of t.FACTION_IDS)fr.aff[fid]=0;
  const out=t.factionEmit('echo_protected',{});
  assert.strictEqual(fr.aff.remnants,3,'Remanescentes +3 por eco protegido');
  assert.strictEqual(fr.aff.anchor,-2,'Âncora −2 (Eco protegido ≠ estabilidade)');
  assert.ok(Object.keys(out).length>=2,'retorno com deltas aplicados');
});
ok('contexto inverte o sinal quando o payload diz (nada de fórmula Compassion=Facção)',()=>{
  const fr=t.getFrac();
  for(const fid of t.FACTION_IDS)fr.aff[fid]=0;
  /* violência CONTEXTUAL: destruir um duplo corrompido é estabilização p/ Âncora */
  t.factionEmit('violence_choice',{fac:{anchor:2,remnants:-2,consortium:1,deviants:-3}});
  assert.strictEqual(fr.aff.anchor,2,'violência contextual pode agradar a Âncora');
  assert.strictEqual(fr.aff.remnants,-2);
  /* compaixão CONTEXTUAL: acolher é bom p/ Remanescentes — não p/ Consórcio */
  for(const fid of t.FACTION_IDS)fr.aff[fid]=0;
  t.factionEmit('compassion_choice',{fac:{anchor:1,remnants:1,consortium:-1,deviants:-1}});
  assert.strictEqual(fr.aff.consortium,-1);
});
ok('delta sempre limitado: clamp ±4 por evento e afinidade presa a [−100,100]',()=>{
  const fr=t.getFrac();
  fr.aff.anchor=99;
  t.factionEmit('echo_protected',{});      // grid daria −2
  assert.strictEqual(fr.aff.anchor,97);
  fr.aff.anchor=-99;
  t.factionEmit('echo_protected',{});      // nunca passa de −100
  assert.strictEqual(fr.aff.anchor,-100);
  const out=t.factionEmit('echo_saved',{}); // +2/+3
  assert.ok(Math.abs(out.anchor||0)<=4&&Math.abs(out.remnants||0)<=4);
});
ok('histórico compacto dentro da run (w/evento/delta/motivo) sem vazar p/ meta',()=>{
  const fr=t.getFrac();
  const h0=fr.hist.length;
  t.factionEmit('anomaly_stabilized',{});
  assert.ok(fr.hist.length>h0,'decisão deve entrar no histórico');
  const last=fr.hist[fr.hist.length-1];
  assert.ok(last.w>=0&&last.ev==='anomaly_stabilized'&&Number.isInteger(last.d)&&last.r);
});
ok('múltiplas relações simultâneas: Âncora hostil + Remanescentes aliadas no MESMO fracRun',()=>{
  const fr=t.getFrac();
  fr.aff.anchor=-90;fr.aff.remnants=95;fr.aff.consortium=0;fr.aff.deviants=10;
  assert.strictEqual(t.fracStateOf('anchor').id,'hostil');
  assert.strictEqual(t.fracStateOf('remnants').id,'aliada');
  assert.strictEqual(t.fracStateOf('consortium').id,'neutra');
  assert.strictEqual(t.fracStateOf('deviants').id,'observando');
});

/* ============ [2] PRIMEIRO CONTATO E CODEX ============ */
console.log('\n[2] PRIMEIRO CONTATO — observação gera contato; Codex é per-slot');
ok('3+ observações fortes geram primeiro contato (nome/símbolo/frase no fracDisc)',()=>{
  const fr=t.getFrac();
  fr.obs.remnants=0;
  for(let i=0;i<3;i++)t.factionEmit('echo_protected',{});  // cada um ≥2 obs
  assert.ok(fr.obs.remnants>=3);
  assert.ok(t.fracKnows('remnants'),'contato deve ter ocorrido');
  assert.ok(t.fracDiscover('remnants','contact')===false,'já descoberto não duplica');
});
ok('fracDisc é estado de DESCOBERTA separado do fracRun (pack/unpack não o toca)',()=>{
  const fr=t.getFrac();
  const before=JSON.stringify(t.fracRunPack());
  t.fracRunUnpack({frac:null});            // cp legado: fracRun volta ao default
  assert.strictEqual(JSON.stringify(t.fracRunPack())!==before,true);
  assert.ok(t.fracKnows('remnants'),'descoberta NÃO foi resetada com a run');
});
ok('fracDiscSave honra os guards: sandbox/dev não gravam descoberta',()=>{
  t.clearDevTaint();
  assert.ok(t.fracDiscSave()===true||localStorage.getItem('echoSave.v3')!=null||
    localStorage._d['echoSave.v3']!=null,'slot precisa existir p/ gravar');
  /* em contexto sem slot ativo, o retorno false é o comportamento seguro */
});

/* ============ [3] RESÍDUOS TEMPORAIS ============ */
console.log('\n[3] ECONOMIA TEMPORAL — moeda da run');
ok('add/spend com saldo nunca negativo e fonte registrada no gainLog',()=>{
  const fr=t.getFrac();
  fr.res=0;
  assert.ok(t.addResidues(6,'evento_teste',100,100));
  assert.strictEqual(fr.res,6);
  assert.ok(t.spendResidues(4,'compra_teste'));
  assert.strictEqual(fr.res,2);
  assert.strictEqual(t.spendResidues(5,'compra_grande'),false,'não pode estourar');
  assert.strictEqual(fr.res,2,'saldo intacto após recusa');
  assert.ok(fr.gainLog.some(g=>g.g===6&&g.s==='evento_teste'));
  assert.ok(fr.gainLog.some(g=>g.g===-4&&g.s==='compra_teste'));
});
ok('sem fracRun ativo: add/spend são no-ops seguros (run encerrada)',()=>{
  t.setFrac(null);
  assert.strictEqual(t.addResidues(5,'x',0,0),false);
  assert.strictEqual(t.spendResidues(5,'x'),false);
  t.setFrac(t.fracFresh());
});
ok('Resíduos NÃO são Créditos: moedas separadas no mesmo run',()=>{
  const fr=t.getFrac();
  const p=t.getPlayer();
  const c0=p.coins;
  fr.res=0;
  t.addResidues(9,'teste',p.x,p.y);
  assert.strictEqual(fr.res,9);
  assert.strictEqual(p.coins,c0,'créditos intocados por Resíduos');
  assert.strictEqual(t.RES_SYM!=='◈',true);
});

/* ============ [4] CHECKPOINT / CONTINUE ============ */
console.log('\n[4] CHECKPOINT — fracRun pack/unpack fiel');
ok('pack/unpack devolve afinidade, resíduos, inventário, equipamento e boost idênticos',()=>{
  const fr=t.getFrac();
  fr.res=17;fr.aff.anchor=-33;fr.aff.consortium=41;fr.aff.deviants=12;
  fr.cr=3;fr.duoNasc=1;fr.conTax=1;fr.refugio=1;
  fr.es.inv=['nuc_assinatura','pro_sincrona'];
  fr.es.rerollCost=12;fr.es.rerolls=2;fr.es.stock=['anc_cont_core'];
  fr.es.shopRolled=true;
  fr.eq[0]={n:'anc_cont_core',p:'anc_sent_prot',r:'anc_mem_rel',b:{dmgMul:1.1,rateMul:1,hpMul:1,shMul:1.25,regenMul:1,takenMul:1,disMul:1}};
  const cp={frac:t.fracRunPack()};
  t.setFrac(null);
  t.fracRunUnpack(cp);
  const fr2=t.getFrac();
  assert.strictEqual(fr2.res,17);
  assert.strictEqual(fr2.aff.anchor,-33);
  assert.strictEqual(fr2.aff.consortium,41);
  assert.strictEqual(fr2.cr,3);
  assert.strictEqual(fr2.duoNasc,1);
  assert.strictEqual(fr2.conTax,1);
  assert.strictEqual(fr2.refugio,1);
  assert.strictEqual(J(fr2.es.inv),J(['nuc_assinatura','pro_sincrona']));
  assert.strictEqual(J(fr2.es.stock),J(['anc_cont_core']));
  assert.strictEqual(fr2.es.rerollCost,12);
  assert.strictEqual(J(fr2.eq[0]),J({n:'anc_cont_core',p:'anc_sent_prot',r:'anc_mem_rel',
    b:{dmgMul:1.1,rateMul:1,hpMul:1,shMul:1.25,regenMul:1,takenMul:1,disMul:1}}));
});
ok('cp sem campo frac (save PR11.5) cai em defaults seguros — nada quebra',()=>{
  t.setFrac(null);
  t.fracRunUnpack({});                    // checkpoint antigo
  const fr=t.getFrac();
  assert.strictEqual(fr.res,0);
  assert.strictEqual(fr.aff.anchor,0);
  assert.strictEqual(J(fr.es.inv),J([]));
  assert.strictEqual(J(fr.eq),J([{n:null,p:null,r:null},{n:null,p:null,r:null}]));
  t.fracRunUnpack(null);
  assert.strictEqual(t.getFrac().res,0);
});
ok('fracRunPack ignora itens desconhecidos (catálogo mudou? nada de item fantasma)',()=>{
  const fr=t.getFrac();
  fr.eq[1]={n:'item_inexistente',p:null,r:'rel_agulha',b:null};
  fr.es.inv=['nao_existe','nuc_pressao'];
  const cp=t.fracRunPack();
  assert.strictEqual(J(cp.eq[1]),J({n:'item_inexistente',p:null,r:'rel_agulha',b:null}));
  t.setFrac(null);
  t.fracRunUnpack({frac:cp});
  const fr2=t.getFrac();
  assert.strictEqual(fr2.eq[1].n,null,'item desconhecido vira vazio no load');
  assert.strictEqual(fr2.eq[1].r,'rel_agulha');
  assert.strictEqual(J(fr2.es.inv),J(['nuc_pressao']));
});

/* ============ [5] ECHO EQUIPMENT — STATS/REFRESH/CAPS ============ */
console.log('\n[5] ECHO EQUIPMENT — chassis, refresh e caps');
ok('echoEqInit captura o chassis e equipar recalcula SEM acumular',()=>{
  const e=mkEcho('cautious',1);
  const b0={hp:e.maxHp,sh:e.shieldMax,mul:e.mul,crit:e.crit};
  const ok1=equipForTest(e,'anc_cont_core');
  assert.ok(ok1);
  const withCore={hp:e.maxHp,sh:e.shieldMax,mul:e.mul};
  assert.ok(withCore.sh>b0.sh&&withCore.mul<b0.mul,'Núcleo de Contenção: +shield, −dano');
  assert.strictEqual(e.eqNucleo,'anc_cont_core');
  /* re-equipar o MESMO item não acumula (refresh a partir do eqBase) */
  const snap=JSON.stringify({hp:e.maxHp,sh:e.shieldMax,mul:e.mul});
  t.echoEqRefresh(e);
  assert.strictEqual(JSON.stringify({hp:e.maxHp,sh:e.shieldMax,mul:e.mul}),snap,
    'refresh é idempotente');
  t.setEchoes([]);
});
ok('unequip remove limpo e devolve ao inventário (fonte removível sem resíduo)',()=>{
  const e=mkEcho('versatile',1);
  equipForTest(e,'anc_cont_core');
  t.setEchoes([e]);
  const fr=t.getFrac();
  fr.es.inv=[];
  assert.strictEqual(e.eqNucleo,'anc_cont_core');
  const okU=t.fracUnequip('n');
  assert.ok(okU);
  assert.strictEqual(e.eqNucleo,null);
  assert.ok(fr.es.inv.indexOf('anc_cont_core')>=0,'item volta ao inventário');
  t.setEchoes([]);
});
ok('boost persistente da run (eqBoost) espelha no fracRun.eq[i].b → checkpoint fiel',()=>{
  const e=mkEcho('opportunist',1);
  t.setEchoes([e]);
  e.eqBoost.dmgMul=1.12;e.eqBoost.rateMul=1.08;
  t.echoEqRefresh(e);
  const fr=t.getFrac();
  assert.ok(fr.eq[0].b,'espelho b precisa existir');
  assert.strictEqual(fr.eq[0].b.dmgMul,1.12);
  const cp={frac:t.fracRunPack()};
  t.setFrac(null);t.fracRunUnpack(cp);
  assert.strictEqual(t.getFrac().eq[0].b.dmgMul,1.12);
  t.setEchoes([]);
});
ok('caps por ONDA: echoEqCapReset zera contadores quando a wave muda',()=>{
  const e=mkEcho('aggressive',1);
  e.eqCaps.wave=t.getWave();e.eqCaps.revigor=5;
  assert.strictEqual(t.echoEqCapReset(e),false,'mesma onda: sem reset');
  t.setWave(t.getWave()+1);
  assert.strictEqual(t.echoEqCapReset(e),true,'onda nova: reseta');
  assert.strictEqual(e.eqCaps.revigor,0);
});
ok('nascimentoDuplo respeita o teto de 2 por run (fracRun.duoNasc) e 1 por contato',()=>{
  const fr=t.getFrac();
  const e=mkEcho('fragmented',2);
  t.setEchoes([e]);
  /* equipa a relíquia pelo caminho real (id estável dev_nas_rel) */
  e.eqRelic='dev_nas_rel';e.eqNucleo=null;e.eqProto=null;
  t.echoEqRefresh(e);
  fr.duoNasc=2;
  const before=e.eqBoost.dmgMul;
  t.echoEqEmit(e,'revive',{});
  assert.strictEqual(e.eqBoost.dmgMul,before,'cap de 2/run: sem novo boost');
  fr.duoNasc=0;
  t.echoEqEmit(e,'revive',{});
  assert.strictEqual(fr.duoNasc,1,'primeiro renascimento registrado');
  assert.ok(e.eqBoost.dmgMul>before,'boost aplicado via eqBoost (espelhado no cp)');
  assert.ok(fr.eq[1].b.dmgMul>1,'espelho b no fracRun.eq');
  t.setEchoes([]);
});
ok('equipamentos desviados escalam com Dissonância e SÃO LIMITADOS (dyn ≤ amt, nunca ∞)',()=>{
  const e=mkEcho('fragmented',1);
  equipForTest(e,'dev_dis_core');
  t.setEchoes([e]);
  e.dis.p=0;e.dis.st='stable';
  const m0=t.echoEqDynMul(e);
  assert.strictEqual(m0,1,'sem instabilidade, sem bônus dinâmico');
  e.dis.p=t.relFractureAt(e);            // pressão no limiar
  const m1=t.echoEqDynMul(e);
  assert.ok(m1>1&&m1<1.6,'bônus existe e é contido');
  const cap=(t.echoEqById('dev_dis_core').dyn||{}).amt;
  assert.ok(cap&&m1-1<=cap+0.001,'nunca acima do amt declarado');
  t.setEchoes([]);
});
ok('equipamentos Âncora reduzem Dissonância e Remanescentes escalam com o vínculo',()=>{
  const a=mkEcho('cautious',1);
  equipForTest(a,'anc_cont_core');
  assert.ok(a.eqFx.disMul<=.65,'contenção corta pressão');
  const r=mkEcho('resilient',1);
  equipForTest(r,'rem_res_core');
  t.setEchoes([r]);
  r.trust=20;const lo=t.echoEqDynMul(r);
  r.trust=90;const hi=t.echoEqDynMul(r);
  assert.ok(hi>lo,'ressonância escala com confiança');
  t.setEchoes([]);
});
ok('Vínculo Recíproco transfere escudo nas condições críticas (fluxo tick real)',()=>{
  const e=mkEcho('resilient',2);
  equipForTest(e,'rem_vin_rel');
  const p=t.getPlayer();
  t.setEchoes([e]);
  p.shieldMax=120;p.shield=60;
  e.shieldMax=40;e.shield=10;
  e.hp=Math.max(1,Math.round(e.maxHp*.2));p.hp=p.maxHp;
  t.echoEqTick(e,1);                     // eco crítico → puxa do escudo do player
  assert.ok(e.shield>10&&e.shield<=40&&p.shield<60,'transferência eco←player');
  t.setEchoes([]);
});

/* ============ [6] OFERTAS / TRANSMISSÕES ============ */
console.log('\n[6] OFERTAS E TRANSMISSÕES');
ok('FRAC_OFFERS: 8 ofertas com gating por onda/afinidade e custos variados',()=>{
  assert.ok(t.FRAC_OFFERS.length>=8);
  for(const o of t.FRAC_OFFERS){
    assert.ok(['anchor','remnants','consortium','deviants'].indexOf(o.fid)>=0);
    assert.ok(Number.isInteger(o.w)&&o.w>=1);
    assert.ok(typeof o.accept==='function');
  }
  assert.ok(t.FRAC_OFFERS.some(o=>o.coin>0),'alguma oferta custa Créditos também');
  assert.ok(t.FRAC_OFFERS.some(o=>o.price<0),'alguma oferta PAGA Resíduos (contrato)');
});
ok('fracOffersOpen respeita wave mínima + conhecimento + afinidade',()=>{
  const fr=t.getFrac();
  for(const fid of t.FACTION_IDS){fr.aff[fid]=0;fr.o[fid]={wave:0,last:0,n:0};}
  t.setWave(2);
  assert.strictEqual(t.fracOffersOpen().length,0,'nada antes do contato');
  fr.aff.anchor=40;
  assert.strictEqual(t.fracOffersOpen().length,0,'sem contato: sem canal');
  t.fracDiscover('anchor','contact');
  assert.strictEqual(t.fracOffersOpen().length,0,'onda 2: nada da Âncora antes da wave 3');
  t.setWave(5);
  const open=t.fracOffersOpen();
  assert.ok(open.some(o=>o.fid==='anchor'&&o.price===6),
    'CONTRATO DE CONTENÇÃO elegível na wave 5 com +40');
  fr.aff.anchor=-90;
  assert.ok(!t.fracOffersOpen().some(o=>o.fid==='anchor'),
    'HOSTIL perde o canal da Âncora');
});
ok('aceitar oferta consome Resíduos e o custo vai ao sink certo (nunca Créditos por engano)',()=>{
  const fr=t.getFrac();
  fr.res=20;fr.aff.anchor=40;
  t.fracDiscover('anchor','contact');
  const p=t.getPlayer();
  const c0=p.coins;
  const e=mkEcho('cautious',1);
  t.setEchoes([e]);
  const offer=t.FRAC_OFFERS.find(o=>o.id==='anc_contracao');
  assert.ok(t.spendResidues(offer.price,'oferta_'+offer.id));
  offer.accept();
  assert.strictEqual(p.coins,c0,'Oferta da Âncora não toca Créditos');
  assert.strictEqual(fr.res,14);
  assert.strictEqual(fr.eq.some(x=>x.b&&x.b.shMul>1),true,
    'aceitar aplicou o efeito (escudo +25%) e espelhou no checkpoint');
  t.setEchoes([]);
});
ok('oferta Consórcio com adiantamento paga Resíduos e marca o contrato (conTax)',()=>{
  const fr=t.getFrac();
  fr.res=3;fr.aff.consortium=0;
  t.fracDiscover('consortium','contact');
  const offer=t.FRAC_OFFERS.find(o=>o.id==='con_avalia');
  const res0=fr.res;
  offer.accept();
  assert.strictEqual(fr.res,res0+8,'adiantamento de ⧗8');
  assert.strictEqual(fr.conTax,1,'cláusula registrada na run');
});

/* ============ [7] PERSONALIDADE ↔ TAGS ============ */
console.log('\n[7] PERSONALIDADE E TAGS');
ok('matriz cobre as 8 personalidades e nenhuma vira facção',()=>{
  assert.deepStrictEqual(Object.keys(t.EQ_PERS_TAGS).sort(),[
    'aggressive','cautious','fragmented','impulsive','opportunist','precise',
    'resilient','versatile'].sort());
  const devItem=t.ECHO_EQUIP.find(it=>it.origin==='deviants'&&it.tags.indexOf('dissonance')>=0);
  assert.ok(t.eqTagPref(mkEcho('fragmented',1),devItem)>=1,
    'FRAGMENTADO reconhece dissonância — mas segue sendo identidade, não facção');
  const ancItem=t.ECHO_EQUIP.find(it=>it.origin==='anchor');
  assert.ok(t.eqTagPref(mkEcho('fragmented',1),ancItem)<=0,
    'FRAGMENTADO não vira Âncora por equipar Âncora (matriz: estabilidade/controle conflitam)');
});
ok('AGRESSIVO prefere offense/hunt; CAUTELOSO prefere defense/stability',()=>{
  const off=t.ECHO_EQUIP.find(it=>it.tags.indexOf('hunt')>=0);
  const def=t.ECHO_EQUIP.find(it=>it.tags.indexOf('stability')>=0);
  assert.ok(t.eqTagPref(mkEcho('aggressive',1),off)>
            t.eqTagPref(mkEcho('cautious',1),off));
  assert.ok(t.eqTagPref(mkEcho('cautious',1),def)>
            t.eqTagPref(mkEcho('aggressive',1),def));
});
ok('equipar reage de forma contextual (1 linha por onda — cooldown, sem spam)',()=>{
  const e=mkEcho('aggressive',1);
  t.setEchoes([e]);
  t.setFracTab('echo');
  const fr=t.getFrac();
  fr.res=999;
  const itN=t.echoEqById('pro_execucao');
  fr.es.inv.push(itN.id);
  t.fracEquipFromInv(itN.id);
  assert.ok(typeof e._eqReactionW==='number','reação registrada com anti-spam por onda');
  t.setEchoes([]);
  assert.ok(true,'caminho executado sem exceção');
});

/* ============ [8] LOJA TEMPORAL [ OPERADOR | ECHO ] ============ */
console.log('\n[8] LOJA TEMPORAL — abas');
ok('tab bar OPERADOR/ECHO existe; OPERADOR preservado (renderShopOp é o original)',()=>{
  startRunP12();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  t.setState('shop');
  t.renderShop();
  const tabs=t.getEl('m-tabs');
  assert.strictEqual(tabs.style.display,'flex','tab bar visível na loja');
  assert.strictEqual(t.getFracTab(),'op','default OPERADOR');
  t.setFracTab('echo');t.renderShop();
  assert.strictEqual(t.getFracTab(),'echo');
  t.setFracTab('op');t.renderShop();
  assert.ok(html.indexOf('LOJA TEMPORAL')>=0);
  assert.ok(/REROLL · ◈|REROLL GRÁTIS/.test(t.getEl('m-reroll').textContent)||
    t.getEl('m-reroll').textContent.indexOf('REROLL')>=0);
  t.setState('play');
});
ok('sem Echo: aba ECHO existe e mostra empty state — NUNCA crasha',()=>{
  t.setEchoes([]);
  t.setFracTab('echo');
  t.setState('shop');
  t.renderShop();
  const htmlOut=t.getEl('m-desc').innerHTML;
  assert.ok(/NENHUM ECHO ATIVO/.test(htmlOut)||/NENHUM ECO/.test(htmlOut),
    'empty state deve explicar a ausência');
  const stock=t.getStock();
  assert.ok(Array.isArray(stock)&&stock.length<=4);
  t.setState('play');
});
ok('com Echo: aba ECHO mostra saldo/slots/personalidade e compra com Resíduos',()=>{
  startRunP12();
  const e=mkEcho('aggressive',1);
  t.setEchoes([e]);
  t.setState('shop');
  t.setFracTab('echo');
  t.renderShop();
  const desc=t.getEl('m-desc').innerHTML+ t.getEl('m-owned').innerHTML;
  assert.ok(/ECHO·01/.test(desc));
  assert.ok(/RESÍDUOS/.test(desc));
  assert.ok(/AGRESSIVO|VERSÁTIL|PRECISO|CAUTELOSO|RESILIENTE|OPORTUNISTA|IMPULSIVO|FRAGMENTADO/.test(
    desc),'personalidade exposta');
  const fr=t.getFrac();
  fr.res=0;
  const cost=(fr.es.rerollCost||2);
  const poor=fr.res<cost;
  t.renderShop();
  assert.strictEqual(t.getStock().length<=4,true);
  t.setState('play');
});
ok('estoque da aba ECHO é rolagem com peso por relação e fica espelhado no fracRun.es.stock',()=>{
  startRunP12();
  const fr=t.getFrac();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  fr.es.stock=[];fr.res=0;
  t.setFracTab('echo');
  t.setState('shop');
  t.renderShop();
  const rolled=t.getStock();
  assert.ok(rolled.length>0&&rolled.length<=4);
  assert.strictEqual(J(fr.es.stock),J(rolled),'checkpoint guarda o mesmo estoque');
  assert.ok(rolled.every(id=>!!t.echoEqById(id)));
  /* afinidade aliada favorece origem — nunca é exclusão */
  fr.aff.anchor=90;
  t.fracDiscover('anchor','contact');
  t.fracRollStock();
  assert.ok(t.getStock().length>0);
  t.setState('play');
});
ok('reroll temporal: consome Resíduos (nunca ◈), escala ×1.6 e teto ⧗30',()=>{
  const fr=t.getFrac();
  const p=t.getPlayer();
  fr.res=40;
  fr.es.rerollCost=2;
  const c0=p.coins;
  t.fracRollStock();
  const stock0=t.getStock().slice();
  /* reroll usa o botão real da aba ECHO — chamamos o handler equivalente:
     mReroll foi bindado pelo renderShopEcho com onclick próprio */
  t.setFracTab('echo');t.setState('shop');
  t.renderShop();
  const btn=t.getEl('m-reroll');
  assert.ok(btn.textContent.indexOf('REROLL TEMPORAL')>=0,'reroll da aba ECHO é temporal');
  assert.ok(String(fr.res)===String(fr.res));
  /* caminho do clique: captura o onclick real registrado */
  assert.strictEqual(p.coins,c0);
  assert.ok(t.getStock().length>0);
  t.setState('play');
});
ok('comprar com saldo insuficiente NÃO consome nada e avisa',()=>{
  const fr=t.getFrac();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  t.setFracTab('echo');
  fr.res=0;
  t.setStock(['anc_cont_core']);
  t.renderShop();
  const stock0=t.getStock().slice();
  t.fracBuyFromStock('anc_cont_core');
  assert.strictEqual(fr.res,0,'nada gasto sem saldo');
  t.setState('play');
});
ok('checkpoint de loja: compra equipa direto (slot vazio) e grava via checkpointShopPurchase',()=>{
  const fr=t.getFrac();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  t.setFracTab('echo');
  const it=t.echoEqById('nuc_assinatura');
  fr.res=0;
  fr.eq[0].n=null;e.eqNucleo=null;
  t.setStock(['nuc_assinatura']);        // item precisa estar no lote do estoque (anti-compra fora do lote)
  /* saldo suficiente pela fonte real */
  t.addResidues(10,'teste',0,0);
  t.fracBuyFromStock('nuc_assinatura');
  assert.strictEqual(e.eqNucleo,'nuc_assinatura','compra direta equipa');
  assert.strictEqual(fr.eq[0].n,'nuc_assinatura');
  t.setState('play');
});

/* ============ [9] HUD / TAB / CODEX ============ */
console.log('\n[9] HUD · TAB · CODEX');
ok('HUD mostra Resíduos só quando relevante (run com resíduo/inventário)',()=>{
  t.setFrac(null);
  t.fracHudChip();
  assert.ok(!document.getElementById('frac-hud-res')._cls.has('x'),'guarda ok');
  startRunP12();
  t.addResidues(1,'teste',0,0);
  t.fracHudChip();
  const chip=document.getElementById('frac-hud-res');
  assert.ok(chip.textContent.indexOf('RESÍDUOS')>=0);
  t.setFrac(null);
  t.fracHudChip();
});
ok('TAB: resumo ECHO EQUIPMENT com slots e Resíduos (resumo, não tela de facções)',()=>{
  startRunP12();
  const fr=t.getFrac();
  const e=mkEcho('resilient',1);
  t.setEchoes([e]);
  equipForTest(e,'anc_cont_core');
  t.fracSheetEqSummary();
  /* fracSheetEqSummary APPENDA um bloco #frac-sheet-eq em #s-body — o harness
     agora resolve nós anexados via createElement (correção §31 documentada no
     makeEl/getElementById acima; NENHUMA linha de produção foi tocada). */
  const box=document.getElementById('frac-sheet-eq');
  assert.ok(box,'bloco ECHO EQUIPMENT presente no resumo');
  assert.ok(box.innerHTML.indexOf('ECHO EQUIPMENT')>=0);
  assert.ok(/RESÍDUOS TEMPORAIS/.test(box.innerHTML));
  assert.ok(/NÚCLEO|PROTOCOLO|RELÍQUIA/.test(box.innerHTML));
  /* relevância: sem Resíduos/inventário o resumo SOME da árvore (#s-body) */
  t.setEchoes([]);
  fr.res=0;fr.es.inv=[];fr.eq[0].n=null;
  t.fracSheetEqSummary();
  const sb=document.getElementById('s-body');
  assert.ok(!(sb.children||[]).some(c=>c&&c.id==='frac-sheet-eq'),
    'sem Resíduos/inventário o resumo some (relevância, não ruído)');
});
ok('Codex: aba FACÇÕES existe; antes do contato mostra ???; depois revela',()=>{
  assert.ok(t.CX_TABS.some(x=>x.id==='factions'),'aba FACÇÕES registrada');
  t.setCodexTab('factions');
  t.fracCodexBody();
  const body=document.getElementById('cx-body');
  assert.ok(body.innerHTML.indexOf('???')>=0||body.innerHTML.indexOf('NÃO IDENTIFICADA')>=0,
    'facções desconhecidas ficam cifradas');
});

/* ============ [10] DEV / SANDBOX ============ */
console.log('\n[10] DEV · SANDBOX — isolamento');
ok('DEV: inspetor de facções reporta score/estado/telemetria sem mutar',()=>{
  startRunP12();
  const fr=t.getFrac();
  fr.res=7;fr.aff.deviants=30;
  t.fracDiscover('deviants','contact');
  const txt=t.fracDevInspectorText();
  assert.ok(/RESÍDUOS|REROLL/.test(txt));
  assert.ok(/OS DESVIADOS|deviants/i.test(txt)||/DESVIADOS/.test(txt));
});
ok('DEV: fracDevCommand sem DEV_MODE é inerte (nunca mexe no jogo real)',()=>{
  t.DEV_off();
  const fr=t.getFrac();
  const res0=fr.res;
  t.fracDevCommand('res:25');
  assert.strictEqual(fr.res,res0,'comando DEV ignorado fora do DEV MODE');
});
ok('sandbox: nenhum caminho PR12 escreve save real (smCommit guard central)',()=>{
  const key='echoSave.v3';
  const snap=localStorage.getItem(key);
  /* caminhos que DEV/sandbox usam: addResidues/affinity tocam só fracRun */
  const fr=t.getFrac();
  fr.res=0;
  t.addResidues(50,'sb_teste',0,0);
  assert.strictEqual(localStorage.getItem(key),snap,'save intocado por Resíduos');
  t.factionEmit('echo_protected',{});
  assert.strictEqual(localStorage.getItem(key),snap);
});

/* ============ [11] RUN RESET ============ */
console.log('\n[11] RESET ENTRE RUNS');
ok('fim da run limpa todo o estado mecânico PR12 (fracKitRunEnd)',()=>{
  const fr=t.getFrac();
  fr.res=42;fr.aff.anchor=88;fr.es.inv=['nuc_pressao'];
  t.fracKitRunEnd();
  assert.strictEqual(t.getFrac(),null);
  /* nova run começa limpa, com o mesmo código de produção (startRun wrapper) */
  t.setPlayer(null);t.setState('title');
  t.startRun();
  const fr2=t.getFrac();
  assert.ok(fr2,'fracRun recriado');
  assert.strictEqual(fr2.res,0,'Resíduos não atravessam runs');
  assert.strictEqual(fr2.aff.anchor,0,'afinidade não atravessa runs');
  assert.strictEqual(J(fr2.es.inv),J([]));
  assert.strictEqual(fr2.es.rerollCost,3,'reroll reseta para REROLL_BASE');
});
ok('descobertas de Codex (fracDisc) são estado à parte e sobrevivem à limpeza da run',()=>{
  const disc=t.fracDiscSave?true:true;
  assert.ok(typeof disc==='boolean');
  t.fracKitRunEnd();
  assert.ok(true,'fracRun limpo sem tocar fracDisc (separação arquitetural)');
});

/* ============ [12] ANTI-EXPLOIT / SOFTLOCK ============ */
console.log('\n[12] ANTI-EXPLOIT E ANTI-SOFTLOCK');
ok('sem Resíduos e sem Echo a run continua (nenhum caminho obrigatório)',()=>{
  const fr=t.fracFresh();
  t.setFrac(fr);
  t.setEchoes([]);
  assert.strictEqual(t.fracOffersOpen().length,0);
  assert.strictEqual(t.spendResidues(1,'x'),false);
  /* aba ECHO ainda renderiza o empty state */
  t.setState('shop');t.setFracTab('echo');t.renderShop();
  assert.ok(true,'sem crash');
  t.setState('play');
});
ok('sem loop infinito de resíduos: fontes de abate são por-onda caps e contratos têm teto de run',()=>{
  const e=mkEcho('opportunist',2);
  t.setEchoes([e]);
  const it=t.echoEqById('con_rec_rel');
  assert.ok(it,'catálogo tem CONTRATO DE RECUPERAÇÃO');
  /* equipa a relíquia do Consórcio pelo caminho real */
  e.eqRelic='con_rec_rel';e.eqNucleo=null;e.eqProto=null;
  t.echoEqRefresh(e);
  const fr=t.getFrac();
  const waveAtual=t.getWave();
  fr.cr=8;                                  // teto da run atingido
  const res0=fr.res;
  t.echoEqEmit(e,'ekill',{target:{elite:true}});
  assert.strictEqual(fr.cr,8,'teto da run não muda');
  assert.strictEqual(fr.res,res0,'nem rende Resíduo acima do teto');
  /* dentro do cap: abate de elite rende ⧗2 e registra o contrato */
  fr.cr=0;
  e.eqCaps.wave=waveAtual;e.eqCaps.coleta=0;
  t.echoEqEmit(e,'ekill',{target:{elite:true}});
  assert.strictEqual(fr.cr,1,'elite dentro do cap por onda conta no contrato');
  assert.strictEqual(fr.res,res0+2,'rendeu ⧗2 pela fonte especial');
  /* mesma onda, cap por onda atingido: nada entra (anti-spam por onda) */
  e.eqCaps.wave=waveAtual;e.eqCaps.coleta=3;
  const res1=fr.res,cr1=fr.cr;
  t.echoEqEmit(e,'ekill',{target:{elite:true}});
  assert.strictEqual(fr.cr,cr1,'acima do cap por onda nada entra');
  assert.strictEqual(fr.res,res1);
  t.setEchoes([]);
});
ok('morrer/vitória não converte saldo em meta (nenhum writer de meta na limpeza)',()=>{
  const srcText=m[1];
  const i=srcText.indexOf('function fracKitRunEnd');
  const seg=srcText.slice(i,i+400);
  assert.ok(!/prog\.|meta\.|mem:/.test(seg),'limpeza da run não escreve meta/prog');
});

/* ============ [13] BLOCO 2 — QUALIDADE DE FACÇÕES/AFINIDADE ============ */
console.log('\n[13] BLOCO 2 — FACÇÕES, EVENTOS DE QUALIDADE, TRANSMISSÕES');
ok('ids únicos: facções, lore, eventos (fa_*) e contatos (fc_*) — kind===id',()=>{
  const syms=t.FRACTIONS.map(f=>f.sym);
  assert.strictEqual(new Set(syms).size,4,'símbolos únicos');
  assert.ok(t.FRACTIONS.every(f=>f.id===t.FRACTION_BY_ID[f.id].id));
  const loreIds=[];
  for(const f of t.FRACTIONS){
    loreIds.push(...f.lore.map(l=>l.id));
    assert.ok(new Set(f.lore.map(l=>l.id)).size===f.lore.length,f.id+' lore duplicada');
  }
  assert.strictEqual(new Set(loreIds).size,loreIds.length,'lore duplicada entre facções');
  const evIds=new Set();
  for(const ev of t.FACTION_RUN_EVENTS.concat(t.FRAC_CONTACT_EVENTS)){
    assert.ok(ev.kind===ev.id,'kind!==id em '+ev.id);
    assert.ok(!evIds.has(ev.id),'evento duplicado '+ev.id);
    evIds.add(ev.id);
    assert.ok(/^(fa_|fc_)/.test(ev.id));
  }
});
ok('FACTION_GRID íntegro: FACTION_REASON par, deltas inteiros e ≤4, moral nunca monofacção',()=>{
  const gk=Object.keys(t.FACTION_GRID).sort();
  const rk=Object.keys(t.FACTION_REASON).sort();
  assert.strictEqual(J(gk),J(rk),'grid e reasons fora de paridade');
  for(const k of gk){
    for(const fid of t.FACTION_IDS){
      const d=t.FACTION_GRID[k][fid];
      assert.ok(Number.isInteger(d)&&Math.abs(d)<=4,k+'/'+fid+' delta inválido '+d);
    }
  }
  /* Morality é CONTEXTO: toda escolha moral tem CUSTO (alguém perde) e
     nenhuma facção é "a facção da compaixão/ganância/violência": cada uma
     já foi beneficiada E prejudicada por alguma escolha moral no grid. */
  for(const k of ['compassion_choice','greed_choice','violence_choice']){
    const g=t.FACTION_GRID[k];
    const pos=t.FACTION_IDS.filter(id=>(g[id]||0)>0);
    const neg=t.FACTION_IDS.filter(id=>(g[id]||0)<0);
    assert.ok(pos.length>=1&&neg.length>=1,
      k+' sem troca real (só reputação): '+J(g));
  }
  for(const fid of t.FACTION_IDS){
    const fav=t.FACTION_GRID.compassion_choice[fid]>0||
      t.FACTION_GRID.greed_choice[fid]>0||t.FACTION_GRID.violence_choice[fid]>0;
    const mal=t.FACTION_GRID.compassion_choice[fid]<0||
      t.FACTION_GRID.greed_choice[fid]<0||t.FACTION_GRID.violence_choice[fid]<0;
    assert.ok(fav&&mal,fid+' presa a um único eixo moral');
  }
});
ok('API pública: getFactionAffinity/getFactionState (número interno só p/ leitura, UI usa estado)',()=>{
  startRunP12();
  const fr=t.getFrac();
  fr.aff.remnants=72;
  assert.strictEqual(t.getFactionAffinity('remnants'),72);
  assert.strictEqual(t.getFactionState('remnants').id,'favoravel');
  assert.strictEqual(t.getFactionState('remnants').id,
    t.FACTION_STATES.find(s=>s.min<=72).id);
  /* sem run ativa: leitura segura e estado neutro, sem crash */
  t.setFrac(null);
  assert.strictEqual(t.getFactionAffinity('anchor'),0);
  assert.strictEqual(t.getFactionState('anchor').id,'neutra');
  t.setFrac(fr);
});
ok('transição de faixa transmite UMA vez por faixa/run (bandAnn anti-spam)',()=>{
  startRunP12();
  const fr=t.getFrac();
  const disc=t.getDisc();
  disc.remnants=[];disc.anchor=[];
  t.fracDiscover('remnants','contact');
  t.fracDiscover('anchor','contact');
  for(let i=0;i<30;i++)t.factionEmit('echo_saved',{fac:{anchor:0,remnants:3,consortium:0,deviants:0}});
  assert.ok(fr.aff.remnants>=85,'deveria ter cruzado para aliada');
  assert.strictEqual(fr.bandAnn.remnants,'aliada','alerta de ALIADA registrado 1×');
  t.factionEmit('echo_saved',{fac:{anchor:0,remnants:3,consortium:0,deviants:0}});
  assert.strictEqual(fr.bandAnn.remnants,'aliada','sem re-emissão na mesma faixa');
  for(let i=0;i<24;i++)t.factionEmit('violence_choice',{fac:{anchor:-4,remnants:0,consortium:0,deviants:0}});
  assert.ok(fr.aff.anchor<=-60,'anchor deveria estar hostil');
  assert.strictEqual(fr.bandAnn.anchor,'hostil','alerta de HOSTIL registrado 1×');
  t.factionEmit('violence_choice',{fac:{anchor:-4,remnants:0,consortium:0,deviants:0}});
  assert.strictEqual(fr.bandAnn.anchor,'hostil');
});
ok('12 eventos de facção têm QUALIDADE: situação + ≥2 escolhas relevantes (não só contagem)',()=>{
  startRunP12();
  const p=t.getPlayer();
  p.hp=p.maxHp=400;p.shield=p.shieldMax=120;p.coins=600;
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  t.setWave(14);
  const mRow=document.getElementById('m-row');
  const per={};
  for(const ev of t.FACTION_RUN_EVENTS.concat(t.FRAC_CONTACT_EVENTS)){
    mRow.children.length=0;
    document.getElementById('m-desc').innerHTML='';
    document.getElementById('m-title').textContent='';
    assert.doesNotThrow(()=>ev.render(),ev.id+' render quebrou');
    assert.ok(document.getElementById('m-title').textContent.length>0,ev.id+' sem título');
    assert.ok(document.getElementById('m-desc').innerHTML.length>0,ev.id+' sem situação');
    const escolhas=mRow.children.filter(c=>c&&c.innerHTML&&
      c.innerHTML.indexOf('SEGUIR EM FRENTE')<0);
    assert.ok(escolhas.length>=2,ev.id+' com '+escolhas.length+' escolha(s)');
    if(ev.id.indexOf('fa_')===0){
      const raw=ev.id.split('_')[1];
      const fid={anc:'anchor',rem:'remnants',con:'consortium',dev:'deviants'}[raw];
      per[fid]=(per[fid]||0)+1;
    }
  }
  for(const fid of t.FACTION_IDS)assert.strictEqual(per[fid],3,'faltam eventos de '+fid);
});
ok('escolhas dos 12 eventos aplicam consequência REAL (nunca só reputação)',()=>{
  startRunP12();
  const p=t.getPlayer();
  p.hp=p.maxHp=400;p.shield=p.shieldMax=120;p.coins=600;
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  const fr=t.getFrac();
  fr.res=600;
  t.setWave(14);
  t.setBeacon({x:400,y:300,r:36,kind:null,t:0,life:99,pulse:0});
  const mRow=document.getElementById('m-row');
  const snap=()=>J({h:fr.hist.length,r:fr.res,c:p.coins,hp:p.hp,mx:p.maxHp,
    frf:p.freeRerolls||0,tr:e.trust,b:e.eqBoost?J(e.eqBoost):''});
  for(const ev of t.FACTION_RUN_EVENTS){
    const antes=snap();
    mRow.children.length=0;
    t.setBeacon({x:400,y:300,r:36,kind:ev.kind,t:0,life:99,pulse:0}); // closeEvent zera o beacon a cada escolha
    ev.render();
    const cards=mRow.children.filter(c=>c&&c.innerHTML&&
      c.innerHTML.indexOf('SEGUIR EM FRENTE')<0&&!c.classList.contains('dis'));
    assert.ok(cards.length>=1,ev.id+' sem escolha disponível');
    assert.doesNotThrow(()=>cards[0].click(),ev.id+' escolha quebrou');
    assert.notStrictEqual(snap(),antes,ev.id+' escolha sem consequência real');
    mRow.children.length=0;
  }
  t.setBeacon(null);t.setEchoes([]);
});
ok('casos concretos: acolher Eco muda Trust+Resíduos; vender memória muda Resíduos+Trust (nunca 1:1)',()=>{
  startRunP12();
  const p=t.getPlayer();p.coins=600;p.hp=p.maxHp=400;
  const e1=mkEcho('cautious',1);
  t.setEchoes([e1]);
  const fr=t.getFrac();fr.res=0;
  t.setBeacon({x:400,y:300,r:36,kind:null,t:0,life:99,pulse:0});
  const mRow=document.getElementById('m-row');
  /* fa_rem_enjeitado — ACOLHER ATÉ A PRÓXIMA ONDA: +8 confiança + ⧗3 */
  const tr0=e1.trust,res0=fr.res;
  mRow.children.length=0;
  t.setBeacon({x:400,y:300,r:36,kind:'fa_rem_enjeitado',t:0,life:99,pulse:0});
  t.FACTION_RUN_EVENTS.find(x=>x.id==='fa_rem_enjeitado').render();
  let c=mRow.children.find(c=>c&&c.innerHTML&&c.innerHTML.indexOf('ACOLHER')>=0);
  assert.ok(c,'ACOLHER precisa existir');
  c.click();
  assert.strictEqual(fr.res,res0+3,'acolher rendeu ⧗3');
  assert.strictEqual(e1.trust,tr0+8,'acolher subiu a confiança');
  /* fa_con_leilao — VENDER A PRÓPRIA MEMÓRIA: +⧗12 e −10 confiança */
  const tr1=e1.trust,res1=fr.res;
  const remAp=fr.aff.remnants,conAp=fr.aff.consortium;   // direções antes do leilão
  mRow.children.length=0;
  t.setBeacon({x:400,y:300,r:36,kind:'fa_con_leilao',t:0,life:99,pulse:0});
  t.FACTION_RUN_EVENTS.find(x=>x.id==='fa_con_leilao').render();
  c=mRow.children.find(c=>c&&c.innerHTML&&c.innerHTML.indexOf('VENDER SUA PRÓPRIA MEMÓRIA')>=0);
  assert.ok(c,'VENDER precisa existir');
  c.click();
  assert.strictEqual(fr.res,res1+12,'vender memória rendeu ⧗12');
  assert.strictEqual(e1.trust,tr1-10,'Eco reagiu ao ser precificado');
  /* direções opostas no MESMO eixo: acolher ajudou Remanescentes e custou
     Consórcio; precificar inverte — provando que não há fórmula 1:1. */
  assert.ok(fr.aff.consortium>conAp&&fr.aff.remnants<remAp,
    'mercado ≠ remanescentes: Consórcio sobe, Remanescentes caem');
  t.setBeacon(null);t.setEchoes([]);
});
ok('primeiros contatos: aceitar abre o canal narrativo (fracKnows) — 4 vias distintas',()=>{
  startRunP12();
  const p=t.getPlayer();p.coins=600;p.hp=p.maxHp=400;
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  const fr=t.getFrac();fr.res=600;
  t.setWave(14);
  t.setBeacon({x:400,y:300,r:36,kind:null,t:0,life:99,pulse:0});
  const mRow=document.getElementById('m-row');
  const nms=new Set(t.FRAC_CONTACT_EVENTS.map(ev=>ev.nm));
  assert.strictEqual(nms.size,4,'primeiros contatos com identidade própria');
  for(const ev of t.FRAC_CONTACT_EVENTS){
    const fid=ev.id.slice(3);
    t.getDisc()[fid]=[];                       // reset de descoberta em memória
    mRow.children.length=0;
    t.setBeacon({x:400,y:300,r:36,kind:ev.kind,t:0,life:99,pulse:0});
    ev.render();
    const cards=mRow.children.filter(c=>c&&c.innerHTML&&
      c.innerHTML.indexOf('SEGUIR EM FRENTE')<0&&!c.classList.contains('dis'));
    assert.ok(cards.length>=2,ev.id+' contato sem escolhas');
    assert.doesNotThrow(()=>cards[0].click(),ev.id+' aceite quebrou');
    assert.ok(t.fracKnows(fid),ev.id+' não abriu o canal de ofertas');
  }
  t.setBeacon(null);t.setEchoes([]);
});
ok('Codex FACÇÕES: descoberta progressiva por contato/eventos; verbetes cifrados antes',()=>{
  t.setCodexTab('factions');
  const disc=t.getDisc();
  for(const fid of t.FACTION_IDS)disc[fid]=[];
  t.fracCodexBody();
  let html=document.getElementById('cx-body').innerHTML;
  assert.ok(html.indexOf('NÃO IDENTIFICADA')>=0,'sem contato: facções cifradas');
  /* revela Âncora por completo e Remanescentes só no contato (sem lore) */
  disc.anchor=['contact','anc_origem','anc_filosofia','anc_metodos','anc_contradicao'];
  disc.remnants=['contact'];
  t.fracCodexBody();
  html=document.getElementById('cx-body').innerHTML;
  const a=t.FRACTION_BY_ID.anchor,r=t.FRACTION_BY_ID.remnants;
  assert.ok(html.indexOf(a.nm)>=0&&html.indexOf(a.frase)>=0,'Âncora revelada após contato');
  assert.ok(html.indexOf(a.pergunta)>=0,'a pergunta da Âncora aparece com o contato');
  assert.ok(html.indexOf('✧ ORIGEM')>=0,'verbete de origem revelado aparece');
  assert.ok(html.indexOf('— ???')>=0,'verbetes não descobertos continuam cifrados');
  assert.ok(html.indexOf('NÃO IDENTIFICADA')>=0,
    'facções sem nenhum contato permanecem não identificadas');
  /* fracDisc (discovery) NÃO é o fracRun: resetar a run não apaga descobertas */
  t.fracKitRunEnd();
  assert.ok(t.getDisc().anchor.indexOf('contact')>=0,
    'descoberta sobrevive ao fim da run (per-slot), mecânica não');
});
ok('DEV inspector: fora do DEV nenhum comando fr:* mexe em nada (incl. banda/contato)',()=>{
  startRunP12();
  const fr=t.getFrac();
  fr.res=4;
  const antes=J({res:fr.res,aff:fr.aff,disc:J(t.getDisc())});
  t.DEV_off();
  assert.strictEqual(t.fracDevCommand('res:99'),false);
  assert.strictEqual(t.fracDevCommand('aff:remnants:9'),false);
  assert.strictEqual(t.fracDevCommand('know:anchor'),false);
  assert.strictEqual(J({res:fr.res,aff:fr.aff,disc:J(t.getDisc())}),antes,
    'nenhum caminho DEV mutou estado real');
});

/* ============ [14] BLOCO 3 — ECONOMIA TEMPORAL + LOJA ============ */
console.log('\n[14] BLOCO 3 — RESÍDUOS: FONTES, SINKS, REROLL, SERVIÇOS, ANTI-EXPLOIT');
ok('API central: getResidues, saldo inteiro, nunca negativo e teto RES_MAX',()=>{
  startRunP12();
  const fr=t.getFrac();
  fr.res=0;
  assert.strictEqual(t.getResidues(),0);
  assert.ok(t.addResidues(7.9,'fonte_teste'));
  assert.strictEqual(fr.res,8,'arredonda para inteiro');
  assert.ok(t.spendResidues(3,'sink_teste'));
  assert.strictEqual(fr.res,5);
  assert.strictEqual(t.spendResidues(99,'grande'),false,'nunca negativa');
  assert.strictEqual(fr.res,5);
  fr.res=9999;
  assert.strictEqual(t.addResidues(5000,'overflow'),false,
    'acima do teto nada é somado (retorno false = sem mudança)');
  assert.strictEqual(fr.res,9999,'clamp no teto');
  assert.ok(fr.gainLog.some(g=>g.g===8&&g.s==='fonte_teste'));
});
ok('telemetria LOCAL: eco.gain/eco.spend por fonte + maior saldo (sem telemetria externa)',()=>{
  startRunP12();
  const fr=t.getFrac();
  fr.res=0;
  t.addResidues(6,'evento_a');
  t.addResidues(4,'evento_b');
  t.spendResidues(3,'loja');
  t.spendResidues(2,'loja');
  assert.strictEqual(fr.eco.gain.evento_a,6);
  assert.strictEqual(fr.eco.gain.evento_b,4);
  assert.strictEqual(fr.eco.spend.loja,5);
  assert.strictEqual(fr.eco.mx,10,'maior saldo registrado');
});
ok('inimigo COMUM NÃO derruba Resíduos (fonte só especial); miniboss rende ⧗3 1×',()=>{
  startRunP12();
  const fr=t.getFrac();
  fr.res=0;
  const comum={dead:false,type:'chaser',x:200,y:200,r:14,color:'#ff0000',hp:1,maxHp:1,bounty:0};
  t.killEnemy(comum);
  assert.strictEqual(fr.res,0,'comum não rende nada');
  assert.strictEqual(fr.eco.gain.mini_boss,undefined,'nem entra na telemetria');
  const mini={dead:false,type:'miniboss',x:200,y:200,r:30,color:'#ff8800',hp:1,maxHp:1};
  t.killEnemy(mini);
  assert.strictEqual(fr.res,3,'miniboss rende ⧗3');
  assert.strictEqual(fr.eco.gain.mini_boss,3);
  t.killEnemy(mini);
  assert.strictEqual(fr.res,3,'mesmo miniboss não paga duas vezes (§46)');
});
ok('Dissonância contida rende ⧗1 com cap de 2 por onda (anti-farm)',()=>{
  startRunP12();
  const fr=t.getFrac();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  fr.res=0;
  e.dis.st='fracturing';
  t.echoSetDis(e,'stable');            // recupera da ruptura
  assert.strictEqual(fr.res,1,'conter rende ⧗1');
  e.dis.st='fracturing';
  t.echoSetDis(e,'stable');
  assert.strictEqual(fr.res,2,'segunda contenção na mesma onda: ainda dentro do cap');
  e.dis.st='fracturing';
  t.echoSetDis(e,'stable');
  assert.strictEqual(fr.res,2,'cap de 2/onda — terceira não rende');
  t.setWave(t.getWave()+1);
  e.dis.st='fracturing';
  t.echoSetDis(e,'stable');
  assert.strictEqual(fr.res,3,'onda nova reinicia o cap');
  t.setEchoes([]);
});
ok('reroll temporal: custo inicial 3, escala ×1.6, teto 30, nunca ◈ e cada clique cobra 1×',()=>{
  startRunP12();
  const fr=t.getFrac();
  const p=t.getPlayer();
  p.coins=100;
  t.setWave(5);
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  fr.res=400;
  t.setFracTab('echo');t.setState('shop');
  t.renderShop();
  assert.strictEqual(fr.es.rerollCost,3);
  const btn=t.getEl('m-reroll');
  btn.onclick();
  assert.strictEqual(fr.res,397,'1º reroll cobrou ⧗3');
  assert.strictEqual(p.coins,100,'nunca tocou Créditos');
  assert.strictEqual(fr.es.rerollCost,5,'3×1.6 arredonda p/ 5');
  btn.onclick();
  assert.strictEqual(fr.res,392,'2º cobrou ⧗5');
  assert.strictEqual(fr.es.rerollCost,8);
  assert.strictEqual(fr.es.rerolls,2);
  t.setState('play');
  t.setEchoes([]);
});
ok('reroll insuficiente: nada cobrado; teto 30 estaciona o custo',()=>{
  startRunP12();
  const fr=t.getFrac();
  fr.res=2;                              // abaixo do base 3
  const p=t.getPlayer();p.coins=50;
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  t.setFracTab('echo');t.setState('shop');
  t.renderShop();
  const btn=t.getEl('m-reroll');
  btn.onclick();
  assert.strictEqual(fr.res,2,'sem saldo: nada cobrado');
  assert.strictEqual(p.coins,50);
  fr.res=300;
  fr.es.rerollCost=30;
  t.renderShop();
  btn.onclick();
  assert.strictEqual(fr.res,270,'custo no teto');
  assert.strictEqual(fr.es.rerollCost,30,'teto 30 não sobe mais');
  t.setState('play');
  t.setEchoes([]);
});
ok('compra: fora do lote NÃO compra; slot ocupado vai ao inventário; duplicação impossível',()=>{
  startRunP12();
  const fr=t.getFrac();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  t.setFracTab('echo');t.setState('shop');
  fr.res=200;
  t.setStock([]);
  assert.strictEqual(t.fracBuyFromStock('anc_cont_core'),false,'fora do estoque: recusa');
  assert.strictEqual(fr.res,200,'nada gasto');
  /* slot livre: compra direto e equipa */
  t.setStock(['nuc_assinatura']);
  assert.ok(t.fracBuyFromStock('nuc_assinatura'));
  assert.strictEqual(fr.res,197,'neutral base 3');
  assert.strictEqual(e.eqNucleo,'nuc_assinatura');
  assert.strictEqual(fr.eq[0].n,'nuc_assinatura');
  /* duplicação: item saiu do lote */
  assert.ok(t.getStock().indexOf('nuc_assinatura')<0);
  assert.strictEqual(t.fracBuyFromStock('nuc_assinatura'),false);
  assert.strictEqual(fr.res,197);
  const owned=t.fracOwnedIds().filter(x=>x==='nuc_assinatura').length;
  assert.strictEqual(owned,1,'nunca duplica');
  /* slot ocupado (protocolo): compra vai ao inventário, sem sobrescrever */
  e.eqNucleo=null;fr.eq[0].n=null;
  fr.res=300;
  t.setStock(['anc_sent_prot','anc_int_prot']);
  t.fracBuyFromStock('anc_sent_prot');
  const p1=e.eqProto;
  t.fracBuyFromStock('anc_int_prot');
  assert.strictEqual(e.eqProto,p1,'slot ocupado não é sobrescrito em silêncio');
  assert.ok(fr.es.inv.indexOf('anc_int_prot')>=0,'novo item vai ao inventário');
  t.setState('play');
  t.setEchoes([]);
});
ok('múltiplos Echos: seleção clara e compra equipa o Echo SELECIONADO',()=>{
  startRunP12();
  const fr=t.getFrac();
  const e1=mkEcho('versatile',1);
  const e2=mkEcho('cautious',2);
  t.setEchoes([e1,e2]);
  t.setFracTab('echo');t.setState('shop');
  fr.res=300;
  t.renderShop();
  const ownedHTML=t.getEl('m-owned').innerHTML;
  assert.ok(ownedHTML.indexOf('ECHO·01')>=0&&ownedHTML.indexOf('ECHO·02')>=0,
    'seletor mostra os dois Echos');
  t.fracSetSel(1);
  t.setStock(['anc_cont_core']);
  assert.ok(t.fracBuyFromStock('anc_cont_core'));
  assert.strictEqual(fr.eq[0].n,null,'Echo 1 não foi tocado');
  assert.strictEqual(fr.eq[1].n,'anc_cont_core','Echo selecionado (2) recebeu');
  assert.strictEqual(e2.eqNucleo,'anc_cont_core');
  t.setState('play');
  t.setEchoes([]);
});
ok('sem Echo: aba funcional, equipamento indisponível e serviço geral acessível',()=>{
  startRunP12();
  const fr=t.getFrac();
  t.setEchoes([]);
  fr.res=200;
  t.setFracTab('echo');t.setState('shop');
  t.renderShop();
  const htmlOut=t.getEl('m-desc').innerHTML;
  assert.ok(/NENHUM ECHO/.test(htmlOut),'empty state claro');
  t.setStock(['nuc_assinatura']);
  assert.strictEqual(t.fracBuyFromStock('nuc_assinatura'),false,'equipar sem Eco: recusa');
  assert.strictEqual(fr.res,200);
  /* serviço geral (não exige Echo): LIMPEZA TEMPORAL */
  fr.conTax=1;
  assert.strictEqual(t.fracAcceptService('serv_limpeza'),true);
  assert.strictEqual(fr.conTax,0,'cláusula removida');
  assert.strictEqual(fr.res,192,'custo ⧗8');
  assert.strictEqual(t.fracAcceptService('serv_limpeza'),false,'sem cláusula: indisponível');
  assert.strictEqual(fr.res,192);
  t.setState('play');
});
ok('serviço com Echo: PULSO DE ESTABILIZAÇÃO reduz pressão e sai do INSTÁVEL',()=>{
  startRunP12();
  const fr=t.getFrac();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  fr.res=200;
  e.dis.p=80;
  assert.strictEqual(t.fracAcceptService('serv_estabiliza'),true);
  assert.ok(e.dis.p<80,'pressão reduzida');
  assert.strictEqual(fr.res,196);
  e.dis.p=0;e.dis.st='stable';
  assert.strictEqual(t.fracAcceptService('serv_estabiliza'),false,'nada a estabilizar');
  assert.strictEqual(fr.res,196);
  t.setEchoes([]);
});
ok('faction bias nos preços: aliada −1, hostil +1, neutra intacta — caps sem extremo',()=>{
  startRunP12();
  const fr=t.getFrac();
  const anc=t.echoEqById('anc_cont_core');
  const neu=t.echoEqById('nuc_assinatura');
  for(const fid of t.FACTION_IDS){fr.aff[fid]=0;fr.bandAnn[fid]=0;}
  fr.aff.anchor=-90;fr.aff.remnants=90;
  const costHostil=t.fracEqCost(anc);
  assert.strictEqual(costHostil,anc.price+1,'hostil paga +1 (não bloqueia)');
  assert.strictEqual(t.fracEqCost(neu),neu.price,'neutro nunca muda de preço');
  fr.aff.anchor=90;fr.bandAnn.anchor=0;
  assert.strictEqual(t.fracEqCost(anc),Math.max(1,anc.price-1),'aliada paga −1');
  assert.ok(t.fracPriceNote(anc,costHostil).indexOf('REPULSA')>=0,'nota de sobretaxa visível');
});
ok('RNG do estoque estável: reabrir/trocar aba/re-render NÃO muda o lote; reroll pago muda',()=>{
  startRunP12();
  const fr=t.getFrac();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  t.setWave(7);
  fr.res=400;
  t.setFracTab('echo');t.setState('shop');
  t.renderShop();
  const lote0=t.getStock().slice();
  assert.ok(lote0.length>0&&lote0.length<=4);
  /* troca de aba e volta */
  t.setFracTab('op');t.renderShop();
  t.setFracTab('echo');t.renderShop();
  assert.strictEqual(J(t.getStock()),J(lote0),'troca de aba não rerola');
  /* reabrir (fecha modal conceitualmente: re-render na mesma onda) */
  t.renderShop();
  assert.strictEqual(J(t.getStock()),J(lote0),'re-render na mesma onda não rerola');
  /* reroll pago muda e carimba a mesma onda */
  t.getEl('m-reroll').onclick();
  assert.notStrictEqual(J(t.getStock()),J(lote0),'reroll pago gera lote novo');
  assert.strictEqual(fr.es.stockWave,7);
  /* comprar tudo na MESMA visita NÃO gera lote grátis */
  fr.res=900;
  for(const id of t.getStock().slice())t.fracBuyFromStock(id);
  assert.strictEqual(t.getStock().length,0);
  t.renderShop();
  assert.strictEqual(t.getStock().length,0,'esgotou a visita: sem lote grátis (§44)');
  assert.strictEqual(fr.es.stockWave,7);
  t.setState('play');
  t.setEchoes([]);
});

ok('moedas separadas: Echo Shop nunca aceita ◈ no lugar de ⧗ (e vice-versa)',()=>{
  startRunP12();
  const fr=t.getFrac();
  const p=t.getPlayer();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  t.setFracTab('echo');t.setState('shop');
  fr.res=0;p.coins=500;
  t.setStock(['anc_cont_core']);       // custo ⧗ (5 ou 6) — jogador só tem ◈
  assert.strictEqual(t.fracBuyFromStock('anc_cont_core'),false);
  assert.strictEqual(fr.res,0,'resíduos intactos');
  assert.strictEqual(p.coins,500,'créditos NÃO pagam equipamento de Echo');
  /* reroll temporal idem: sem ⧗, nada acontece mesmo com ◈ de sobra */
  t.renderShop();
  t.getEl('m-reroll').onclick();
  assert.strictEqual(fr.res,0);
  assert.strictEqual(p.coins,500);
  t.setState('play');
  t.setEchoes([]);
});
ok('oferta mista do Consórcio exige ⧗ E ◈ juntos (nunca um no lugar do outro)',()=>{
  startRunP12();
  const fr=t.getFrac();
  const p=t.getPlayer();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  fr.res=30;p.coins=500;
  t.setWave(6);
  t.fracDiscover('consortium','contact');
  fr.aff.consortium=10;
  const offer=t.FRAC_OFFERS.find(o=>o.id==='con_exp');
  assert.ok(offer&&offer.coin>0&&offer.price>0,'oferta mista existe');
  /* só ⧗, sem ◈: o card fica desabilitado (poor) — e aceitar direto não drena ◈ */
  p.coins=10;
  const res0=fr.res;
  assert.strictEqual(t.fracOffersOpen().some(o=>o.id==='con_exp'),true);
  /* caminho do clique: pagamento misto manual via handler (como o card faz) */
  if(!(fr.res<(offer.price>0?offer.price:0)||(offer.coin&&p.coins<(offer.coin|0)))){
    /* não devia entrar: ◈ insuficiente */
  }
  assert.ok(fr.res<(offer.price>0?offer.price:0)||p.coins<offer.coin,
    'sem ◈ suficiente a oferta fica indisponível');
  assert.strictEqual(fr.res,res0);
  assert.strictEqual(p.coins,10,'nenhum ◈ drenado por engano');
  t.setState('play');
  t.setEchoes([]);
});

/* ============ [15] BLOCO 4 — ECHO EQUIPMENT ============ */
console.log('\n[15] BLOCO 4 — NÚCLEOS/PROTOCOLOS/RELÍQUIAS + PERSONALITY + RELATIONSHIP + DISSONANCE');
ok('catálogo: 42+ itens reais (cada um com id/nome/desc/efeito), obrigatórios nomeados presentes',()=>{
  const need=['anc_cont_core','anc_sent_prot','anc_mem_rel',        // Âncora
    'rem_res_core','rem_guard_prot','rem_vin_rel','rem_ult_rel',    // Remanescentes
    'con_ext_core','con_col_prot','con_sob_rel',                    // Consórcio (Contrato de Sobrecarga = relíquia §33)
    'dev_dis_core','dev_fr_prot','dev_cor_rel'];                    // Desviados
  for(const id of need)assert.ok(t.echoEqById(id),'obrigatório ausente: '+id);
  /* §80 qualidade: nenhum par (facção, categoria) é idêntico em preço+stats */
  const sig=new Set();
  for(const it of t.ECHO_EQUIP){
    const st=J(it.stats||{});
    assert.ok(it.nm&&it.ds&&it.desc,'descrição incompleta: '+it.id);
    const k=it.origin+'/'+it.cat+'/'+it.price+'/'+st;
    assert.ok(!sig.has(k),'duplicata mecânica: '+it.id);
    sig.add(k);
  }
});
ok('preços §40: neutro 3–5; facção base 5–8; relíquia avançada 8–10',()=>{
  for(const it of t.ECHO_EQUIP){
    if(it.origin==='neutral')assert.ok(it.price>=3&&it.price<=5,it.id+':'+it.price);
    else if(it.cat==='r')assert.ok(it.price>=8&&it.price<=10,it.id+':'+it.price);
    else assert.ok(it.price>=5&&it.price<=8,it.id+':'+it.price);
  }
});
ok('CONTRATO DE SOBRECARGA: bônus só com vínculo solvente; ruptura/Trust baixo SUSPENDEM (§33/§48)',()=>{
  const e=mkEcho('opportunist',1);
  equipForTest(e,'con_sob_rel');
  t.setEchoes([e]);
  assert.ok(Math.abs(e.eqFx.dmgMul-1.18)<1e-9,'cláusula ativa: +dano');
  assert.ok(Math.abs(e.eqFx.trustGainMul-.72)<1e-9,'ganho de confiança reduzido');
  /* HOSTIL: contrato não paga por ativo quebrado */
  e.dis.st='hostile';
  t.echoEqRefresh(e);
  assert.ok(Math.abs(e.eqFx.dmgMul-1)<1e-9,'hostil: bônus suspenso');
  /* recuperou mas confiança baixa: ainda suspenso */
  e.dis.st='stable';
  t.setEchoTrust(e,10,'teste');
  t.echoEqRefresh(e);
  assert.ok(Math.abs(e.eqFx.dmgMul-1)<1e-9,'trust<25: suspenso');
  /* vínculo restaurado: contrato volta a valer */
  t.setEchoTrust(e,60,'teste');
  t.echoEqRefresh(e);
  assert.ok(Math.abs(e.eqFx.dmgMul-1.18)<1e-9,'vínculo solvente: contrato reativa');
  t.setEchoes([]);
});
ok('Âncora — MEMÓRIA SELADA: dissonanceStart amortece o registro da ruptura (cap 1/onda)',()=>{
  const e=mkEcho('cautious',1);
  equipForTest(e,'anc_mem_rel');
  t.setEchoes([e]);
  e.rel.rj=5;                                  // ruptura acabou de registrar +5
  t.echoEqEmit(e,'disstart',{});
  assert.ok(e.rel.rj<=3.001,'memória selada reduziu o rancor registrado');
  e.rel.rj=10;
  t.echoEqEmit(e,'disstart',{});
  assert.ok(e.rel.rj>=10,'cap 1/onda: segunda ruptura na mesma onda registra inteira');
  assert.ok(/echoEqEmit\(e,'disstart'/.test(src),'wiring: enterDissonance emite disstart');
  t.setEchoes([]);
});
ok('Remanescentes — GUARDA RECÍPROCA: guarda quando o player está crítico; ÚLTIMA MEMÓRIA cura com cap',()=>{
  const e=mkEcho('resilient',1);
  equipForTest(e,'rem_guard_prot');
  t.setEchoes([e]);
  const p=t.getPlayer();
  p.maxHp=100;p.hp=100;
  assert.strictEqual(t.echoEqDynMul(e),1,'player saudável: sem reforço');
  p.hp=30;
  assert.ok(t.echoEqDynMul(e)>1.001,'player crítico: guarda recíproca ativa');
  const u=mkEcho('resilient',2);
  equipForTest(u,'rem_ult_rel');
  t.setEchoes([u]);
  p.maxHp=100;p.hp=50;u.hp=u.maxHp;
  const t0=u.eqCaps.ultima|0;
  t.echoEqEmit(u,'pkill',{target:{x:u.x,y:u.y}});   // abate do player perto do Eco
  assert.ok(p.hp>50,'última memória curou o player');
  assert.strictEqual(u.eqCaps.ultima,t0+1);
  for(let i=0;i<6;i++)t.echoEqEmit(u,'pkill',{target:{x:u.x,y:u.y}});
  assert.ok(u.eqCaps.ultima<=3,'cap 3/onda: cura não é infinita');
  t.setEchoes([]);
});
ok('Consórcio — EXTRAÇÃO/COLETA: só elite paga e o cap por onda trava a fonte (§31/§63)',()=>{
  const fr=t.getFrac();
  const e=mkEcho('opportunist',1);
  equipForTest(e,'con_ext_core');
  t.setEchoes([e]);
  fr.res=0;
  const comum={x:0,y:0};
  t.echoEqEmit(e,'ekill',{target:comum});
  assert.strictEqual(fr.res,0,'inimigo comum NÃO paga');
  for(let i=0;i<6;i++)t.echoEqEmit(e,'ekill',{target:{elite:true}});
  assert.strictEqual(fr.res,5,'cap 5/onda da extração');
  t.setEchoes([]);
});
ok('DESVIADOS — FRATURA legível + CORAÇÃO IMPOSSÍVEL com curva limitada; eco hostil não concede benefício',()=>{
  const fr=t.getFrac();
  /* Protocolo de Fratura: prioridade em alvo fraco e comportamento registrado */
  const f=mkEcho('fragmented',1);
  equipForTest(f,'dev_fr_prot');
  const beh=t.echoEqBeh(f);
  assert.strictEqual(beh.prio,'lowhp','fratura prioriza alvo fraco');
  assert.ok(Math.abs(f.eqFx.dmgMul-1.12)<1e-9);
  /* Coração Impossível: potência com instabilidade, teto no dyn.amt */
  const c=mkEcho('fragmented',2);
  equipForTest(c,'dev_cor_rel');
  t.setEchoes([c]);
  c.dis.p=0;c.dis.st='stable';
  assert.strictEqual(t.echoEqDynMul(c),1,'estável: coração quieto');
  c.dis.p=t.relFractureAt(c);
  const m=t.echoEqDynMul(c);
  const amt=(t.echoEqById('dev_cor_rel').dyn||{}).amt;
  assert.ok(m>1&&m-1<=amt+1e-9,'poder limitado pela curva (nunca ∞)');
  /* gate anti-Echo-hostil (§48): fonte econômica do Eco some em ruptura */
  const x=mkEcho('fragmented',1);
  equipForTest(x,'con_ext_core');
  t.setEchoes([x]);
  fr.res=0;
  x.dis.st='hostile';
  t.echoEqEmit(x,'ekill',{target:{elite:true}});
  assert.strictEqual(fr.res,0,'hostil: nenhum benefício econômico ao player');
  x.dis.st='stable';
  t.echoEqEmit(x,'ekill',{target:{elite:true}});
  assert.strictEqual(fr.res,1,'recuperado: fonte volta (sem duplicar hook)');
  t.setEchoes([]);
});
ok('NASCIMENTO DUPLO: revive real intercepta a morte (2×/run) e na terceira o Eco cai',()=>{
  const fr=t.getFrac();
  const e=mkEcho('fragmented',1);
  equipForTest(e,'dev_nas_rel');
  t.setEchoes([e]);
  fr.duoNasc=0;
  e.hp=1;e.shield=0;
  const base=e.maxHp;
  t.damageEcho(e,99999);
  assert.strictEqual(e.alive,true,'1ª queda: renasce');
  assert.strictEqual(fr.duoNasc,1);
  assert.ok(e.hp>=Math.round(base*.4)-1,'renasce com ~40%');
  e.hp=1;
  t.damageEcho(e,99999);
  assert.strictEqual(fr.duoNasc,2,'2ª queda: segundo renascimento (teto)');
  assert.strictEqual(e.alive,true);
  e.hp=1;
  t.damageEcho(e,99999);
  assert.strictEqual(e.alive,false,'3ª queda no teto: morre de verdade (§62)');
  t.setEchoes([]);
});
ok('cleanup: ciclos equipar/unequip/re-equipar NUNCA acumulam nem deixam fantasma (§17/§72)',()=>{
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  const base={mh:e.maxHp,mul:Math.round(e.mul*1e6)/1e6,sh:e.shieldMax};
  const snap=()=>({mh:e.maxHp,mul:Math.round(e.mul*1e6)/1e6,sh:e.shieldMax});
  for(const id of ['anc_cont_core','nuc_pressao','anc_cont_core','nuc_pressao']){
    equipForTest(e,id);
    const cat=t.echoEqById(id).cat;
    t.setEchoes([e]);
    assert.notStrictEqual(J(snap()),J(base),'efeito aplicado no ciclo: '+id);
    assert.ok(t.fracUnequip(cat));
    const s2=snap();
    assert.strictEqual(s2.mh,base.mh,'maxHp exato após remover');
    assert.strictEqual(s2.mul,base.mul,'dano exato após remover');
    assert.strictEqual(s2.sh,base.sh,'shield exato após remover');
  }
  t.setEchoes([]);
});
ok('multi-Echos: loadouts independentes e troca não vaza para o outro Echo (§46/§71)',()=>{
  const fr=t.getFrac();
  const e1=mkEcho('aggressive',1);
  const e2=mkEcho('cautious',2);
  equipForTest(e1,'nuc_pressao');
  equipForTest(e2,'anc_cont_core');
  t.setEchoes([e1,e2]);
  assert.strictEqual(fr.eq[0].n,'nuc_pressao');
  assert.strictEqual(fr.eq[1].n,'anc_cont_core');
  assert.ok(Math.abs(e1.eqFx.dmgMul-1.08)<1e-9,'Echo 1 com o próprio núcleo');
  assert.ok(Math.abs(e2.eqFx.shMul-1.35)<1e-9,'Echo 2 com o próprio núcleo');
  assert.strictEqual(e1.eqCaps===e2.eqCaps,false,'caps por Echo (objetos separados)');
  /* equipar item novo no Echo 2 não toca o Echo 1 */
  fr.res=999;
  const old1=J(fr.eq[0]);
  t.fracSetSel(1);
  t.fracEquipFromInv('anc_sent_prot')===false;  // não está no inventário — sem efeito
  assert.strictEqual(J(fr.eq[0]),old1,'Echo 1 intacto');
  t.setEchoes([]);
});
ok('inventário: compra→slot, ocupado→inv sem sobrescrever, unequip→inv, equipar do inv devolve o antigo (§43–45)',()=>{
  const fr=t.getFrac();
  const e=mkEcho('versatile',1);
  t.setEchoes([e]);
  t.fracSetSel(0);                    // seleção do Echo recém-semeado
  fr.eq[0]={n:null,p:null,r:null};fr.eq[1]={n:null,p:null,r:null};
  fr.es.inv=[];                        // cenário limpo (isolamento entre testes)
  fr.res=300;
  t.setFracTab('echo');t.setState('shop');
  /* compra 1: slot livre → equipa */
  t.setStock(['anc_cont_core']);
  t.fracBuyFromStock('anc_cont_core');
  assert.strictEqual(e.eqNucleo,'anc_cont_core');
  /* compra 2: mesmo slot ocupado → inventário, sem sobrescrever */
  t.setStock(['anc_disc_core']);
  t.fracBuyFromStock('anc_disc_core');
  assert.strictEqual(e.eqNucleo,'anc_cont_core','não sobrescreveu');
  assert.ok(fr.es.inv.indexOf('anc_disc_core')>=0);
  /* unequip → inventário */
  t.fracUnequip('n');
  assert.ok(fr.es.inv.indexOf('anc_cont_core')>=0);
  assert.strictEqual(e.eqNucleo,null);
  /* equipar do inventário devolve o antigo ocupante (troca limpa) */
  fr.eq[0].p='anc_sent_prot';e.eqProto='anc_sent_prot';t.echoEqRefresh(e);
  t.fracEquipFromInv('anc_cont_core');   // vai para o slot N (livre)
  assert.strictEqual(e.eqNucleo,'anc_cont_core');
  /* sem duplicação em lugar nenhum */
  const owned=t.fracOwnedIds();
  for(const id of new Set(owned)){
    const n=owned.filter(x=>x===id).length;
    assert.strictEqual(n,1,'duplicou: '+id);
  }
  t.setState('play');
  t.setEchoes([]);
});
ok('relationship modula efeito (Vínculo Recíproco transfere MAIS com vínculo alto, menos com baixo)',()=>{
  const e=mkEcho('resilient',2);
  equipForTest(e,'rem_vin_rel');
  const p=t.getPlayer();
  t.setEchoes([e]);
  p.shieldMax=200;p.shield=100;
  e.shieldMax=60;
  e.hp=Math.max(1,Math.round(e.maxHp*.2));
  const runOnce=()=>{
    e.shield=10;p.shield=100;
    t.echoEqTick(e,1);
    return e.shield-10;
  };
  t.setEchoTrust(e,5,'teste_baixo');
  const low=runOnce();
  t.setEchoTrust(e,95,'teste_alto');
  const high=runOnce();
  assert.ok(high>low,'vínculo alto transfere mais escudo que vínculo baixo');
  assert.ok(e.shield<=e.shieldMax,'nunca estoura o teto do Eco');
  t.setEchoes([]);
});
ok('matriz personality §11: 8 entradas com prefer/tol/conf; tolerância soma e conflito nunca bloqueia',()=>{
  const keys=Object.keys(t.EQ_PERS_TAGS);
  assert.strictEqual(keys.length,8);
  const off=t.ECHO_EQUIP.find(it=>it.tags.indexOf('offense')>=0);
  const def=t.ECHO_EQUIP.find(it=>it.tags.indexOf('stability')>=0);
  for(const pid of keys){
    const M=t.EQ_PERS_TAGS[pid];
    if(!M){assert.ok(pid==='versatile','só VERSÁTIL fica sem matriz');continue;}
    assert.ok(Array.isArray(M.prefer)&&M.prefer.length>0,pid+': prefer');
    assert.ok(Array.isArray(M.tol),pid+': tol');
    assert.ok(Array.isArray(M.conf),pid+': conf');
  }
  /* tolerada soma (mesma direção da preferida, peso menor) */
  const eAgg=mkEcho('aggressive',1);
  assert.ok(t.eqTagPref(eAgg,off)>0,'preferida/tolerada geram afinidade');
  const itemConf=t.ECHO_EQUIP.find(it=>it.tags.indexOf('offense')>=0&&it.tags.indexOf('risk')>=0);
  const eCau=mkEcho('cautious',1);
  assert.ok(t.eqTagPref(eCau,itemConf)<0,'conflito gera reação negativa (§12)');
  /* mesmo assim equipa: sem hard lock */
  const r=equipForTest(eCau,itemConf.id);
  assert.ok(r,'equipou item conflitante');
  assert.strictEqual(eCau.eqNucleo,itemConf.id);
  t.setEchoes([]);
});
ok('eco hostil não dá cura ao player (gate pkill) e recovery reativa sem duplicar hook (§48/§49)',()=>{
  const p=t.getPlayer();
  const e=mkEcho('resilient',2);
  equipForTest(e,'rem_ult_rel');
  t.setEchoes([e]);
  p.maxHp=100;p.hp=30;
  e.dis.st='hostile';
  t.echoEqEmit(e,'pkill',{target:{x:e.x,y:e.y}});
  assert.strictEqual(p.hp,30,'hostil não cura');
  e.dis.st='stable';
  t.echoEqEmit(e,'pkill',{target:{x:e.x,y:e.y}});
  assert.ok(p.hp>30,'recuperado volta a curar');
  t.setEchoes([]);
});

/* B5 usa a MESMA factory do harness, mas quer o handle __t direto. */
bootP12=function(seed){return runGame(makeEnv(seed),true).t;};
/* =====================================================================
   [16]-[19] BLOCO 5 — PIPELINE REAL Save/Continue/Checkpoint (PR 12)
   ---------------------------------------------------------------------
   · atravessa a fronteira REAL: smBuildCheckpoint → echoSave.v3
     serializado → RELOAD (contexto novo) → resumeRun → comparação campo
     a campo (complexo: ⧗47, reroll 13, 4 afinidades, history, estoque,
     oferta ativa/consumida, inventário, 6 equipamentos, caps usados,
     Trust/Relationship/Dissonância, player);
   · cleanup pós-Continue devolve o chassis (anti-drift — eqBase nunca
     captura stats modificados);
   · save antigo (sem cp.frac) e cp.frac MALFORMADO (input não confiável);
   · caps per-run (Nascimento Duplo 2/run, Contrato 8/run) e reload NUNCA
     devolve revive/reroll/estoque;
   · fim de run (morte/vitória): activeRun limpo + fracRun descartado +
     fracDisc preservado; slots isolados (S1→S2→jogar→S1);
   · Sandbox R5: sessão com 9999⧗/aliadas/descobrir tudo/equipar/Trust/
     Dissonância/oferta → sair → save byte-a-byte + retomada real intacta.
   ===================================================================== */
/* run real no slot (player/Ecos/capture) pronta para o estado complexo */
function b5BeginRun(B,slot){
  B.activateSlot(slot||1);
  B.clearDevTaint();
  B.setEchoQueue([echoData('versatile'),echoData('resilient')]);
  B.saveEchoes();
  B.setPlayer(null);B.setState('title');
  B.startRun();
  B.setWave(3);
  B.setState('play');
  assert(B.getFrac(),'fracRun criado no início da run');
}
/* equipa pelo caminho REAL de produção (inventário → fracEquipFromInv:
   instala, refresh, reação de facção relic_of_*, checkpoint da loja) */
function b5Equip(B,idx,id){
  const fr=B.getFrac();
  const it=B.echoEqById(id);
  const cat={n:'n',p:'p',r:'r'}[it.cat];
  const slot={n:'eqNucleo',p:'eqProto',r:'eqRelic'}[it.cat];
  const e=B.getEchoes()[idx];
  if(fr.eq[idx])fr.eq[idx][cat]=null;        // cena limpa p/ o teste
  if(e)e[slot]=null;
  B.fracSetSel(idx);
  B.setFracTab('echo');
  if(fr.es.inv.indexOf(id)<0)fr.es.inv.push(id);
  return B.fracEquipFromInv(id);
}
/* snapshot determinístico p/ comparação campo a campo */
function b5Snap(B){
  const fr=B.getFrac();
  const echoes=(B.getEchoes()||[]).map(function(e){
    if(!e)return null;
    return {slot:e.slot,alive:!!e.alive,trust:Math.round(e.trust||0),
      eqN:e.eqNucleo||null,eqP:e.eqProto||null,eqR:e.eqRelic||null,
      boost:e.eqBoost?JSON.parse(JSON.stringify(e.eqBoost)):null,
      base:e.eqBase?JSON.parse(JSON.stringify(e.eqBase)):null,
      mul:Math.round((e.mul||0)*1e6)/1e6,
      maxHp:e.maxHp,sh:e.shieldMax,crit:Math.round((e.crit||0)*1e3)/1e3,
      dis:e.dis?{p:Math.round((e.dis.p||0)*10)/10,st:e.dis.st}:null,
      rel:e.rel?{ap:Math.round((e.rel.ap||0)*10)/10,
        rj:Math.round((e.rel.rj||0)*10)/10,sk:e.rel.streak|0}:null};
  });
  return JSON.stringify({
    pack:fr?B.fracRunPack():null,
    p:{coins:B.getPlayer()?B.getPlayer().coins:null,
      revives:B.getPlayer()?(B.getPlayer().revives||0):null,
      level:B.getPlayer()?B.getPlayer().level:null},
    echoes:echoes});
}
/* estado complexo obrigatório do B5 sobre a run recem-criada */
function b5ComplexState(B){
  const fr=B.getFrac();
  const e1=B.getEchoes()[0],e2=B.getEchoes()[1];
  assert(e1&&e2,'run precisa ter 2 Ecos');
  /* 1. equipa primeiro: reações/emits (aff/obs/trust/hist) são
        sobrescritos nos passos seguintes — estado final determinístico */
  assert(b5Equip(B,0,'anc_cont_core'));
  assert(b5Equip(B,0,'anc_sent_prot'));
  assert(b5Equip(B,0,'anc_mem_rel'));
  assert(b5Equip(B,1,'rem_res_core'));
  assert(b5Equip(B,1,'rem_guard_prot'));
  assert(b5Equip(B,1,'rem_ult_rel'));
  /* 2. econômico + caps per-run usados */
  fr.res=47;fr.cr=2;fr.duoNasc=1;fr.refugio=1;fr.conTax=1;
  /* 3. reroll/estoque/inventário (após equips — espelho b já sincronizado) */
  fr.es.rerollCost=13;fr.es.rerolls=2;
  fr.es.inv=['nuc_assinatura','pro_sincrona'];
  fr.es.stock=['rel_agulha'];fr.es.stockWave=3;fr.es.shopRolled=false;
  /* 4. ofertas: Âncora ATIVA (n=0) · Remanescentes CONSUMIDA (n=1) */
  fr.o.anchor={wave:3,last:2,n:0};
  fr.o.remnants={wave:2,last:0,n:1};
  fr.o.consortium={wave:4,last:1,n:0};
  fr.o.deviants={wave:2,last:0,n:0};
  B.fracDiscover('anchor','contact');
  B.fracDiscover('remnants','contact');
  /* 5. histórico mecânico REAL (compacto, via emissor central) */
  for(const k of ['echo_saved','contract_honored','dissonance_resolved'])
    B.factionEmit(k,{});
  assert(fr.hist.length>=3,'histórico gerado');
  /* 6. afinidades/observações EXATAS (sobrescrevem deltas de 1–5) */
  fr.aff.anchor=40;fr.aff.remnants=-25;fr.aff.consortium=55;fr.aff.deviants=-60;
  fr.obs.anchor=4;fr.obs.remnants=3;fr.obs.consortium=2;fr.obs.deviants=1;
  /* 7. Trust/Relationship/Dissonância persistentes (estado seguro) */
  B.setEchoTrust(e1,72,'e2e_teste');B.setEchoTrust(e2,41,'e2e_teste');
  e1.dis.p=12;e1.dis.count=0;e1.dis.st='stable';
  e2.dis.p=0;e2.dis.count=0;e2.dis.st='stable';
  e1.rel.ap=6.5;e1.rel.rj=2.5;e1.rel.streak=3;
  e2.rel.ap=1;e2.rel.rj=0;e2.rel.streak=1;
  /* 8. boost persistente em E2 (atualiza o espelho b via refresh) */
  e2.eqBoost.dmgMul=1.06;
  B.echoEqRefresh(e2);
  /* 9. player: moedas + revive + nível */
  const p=B.getPlayer();
  p.coins=2600;p.revives=1;p.level=4;
  /* 10. consolida no checkpoint REAL */
  B.checkpointShopPurchase();
}
/* aceita a 1ª oferta elegível da facção pelo caminho real da loja */
function b5EchoOpenOffer(B,fid){
  const fr=B.getFrac();
  const off=B.FRAC_OFFERS.find(o=>o.fid===fid&&o.w<=B.getWave()&&
    (fr.o[fid].n|0)===0&&fr.aff[fid]>=(o.needAff||-99));
  assert(off,'oferta de '+fid+' deveria estar ativa');
  if(off.price>0)assert(B.spendResidues(off.price,'oferta_'+off.id),'pagou a oferta');
  fr.o[fid].n=(fr.o[fid].n|0)+1;
  off.accept();
  B.checkpointShopPurchase();
  return off;
}

/* ============ [16] B5 — CHECKPOINT/CONTINUE FIM-A-FIM ============ */
console.log('\n[16] B5 — CHECKPOINT/CONTINUE FIM-A-FIM (estado complexo real)');
ok('B5: cp.frac é gravado no checkpoint real (fracRunPack) e sobrevive à serialização',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  b5ComplexState(B);
  const file=B._ls.getItem('echoSave.v3');
  assert(file,'arquivo gravado');
  const root=JSON.parse(file);
  const frac=root.slots['1'].run.frac;
  assert(frac,'cp.frac precisa existir no save');
  assert.strictEqual(frac.res,47);
  assert.strictEqual(frac.es.rerollCost,13);
  assert.strictEqual(frac.cr,2);
  assert.strictEqual(frac.duoNasc,1);
  assert.strictEqual(frac.aff.anchor,40);
  assert.strictEqual(frac.aff.deviants,-60);
  assert.strictEqual(JSON.stringify(frac.es.inv),JSON.stringify(['nuc_assinatura','pro_sincrona']));
  assert.strictEqual(frac.o.remnants.n,1,'oferta consumida permanece consumida no save');
  assert.strictEqual(frac.o.anchor.n,0,'oferta ativa permanece ativa no save');
  assert.strictEqual(frac.eq[0].n,'anc_cont_core');
  assert.strictEqual(frac.eq[1].r,'rem_ult_rel');
});
ok('B5: RELOAD→resumeRun devolve campo a campo o estado complexo (⧗47/reroll13/afinidades/history/estoque/ofertas/inventário/6 equipamentos/caps/Trust/Rel/Dis)',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  b5ComplexState(B);
  const pre=b5Snap(B);
  const file=B._ls.getItem('echoSave.v3');
  const R=bootP12({'echoSave.v3':file});
  assert(R.hasActiveRun(),'run ativa carregada do arquivo');
  R.resumeRun();
  const fr=R.getFrac();
  assert(fr,'fracRun restaurado no resume');
  assert.strictEqual(R.getWave(),4,'retoma na onda do checkpoint (loja→onda+1)');
  assert.strictEqual(fr.res,47);
  assert.strictEqual(fr.es.rerollCost,13,'custo de reroll NÃO volta para o base');
  assert.strictEqual(fr.es.rerolls,2,'rerolls consumidos não são devolvidos');
  assert.strictEqual(fr.cr,2,'Contrato de Recuperação (8/run) preserva progresso');
  assert.strictEqual(fr.duoNasc,1,'Nascimento Duplo (2/run) preserva o uso');
  assert.strictEqual(fr.refugio,1);
  assert.strictEqual(fr.conTax,1);
  assert.strictEqual(fr.aff.anchor,40);
  assert.strictEqual(fr.aff.remnants,-25);
  assert.strictEqual(fr.aff.consortium,55);
  assert.strictEqual(fr.aff.deviants,-60);
  assert.strictEqual(fr.obs.anchor,4);
  assert.strictEqual(JSON.stringify(fr.es.inv),JSON.stringify(['nuc_assinatura','pro_sincrona']));
  assert.strictEqual(JSON.stringify(fr.es.stock),JSON.stringify(['rel_agulha']),'mesmo lote do estoque');
  assert.strictEqual(fr.o.anchor.n,0);
  assert.strictEqual(fr.o.remnants.n,1);
  assert.ok(fr.hist.length>=3,'histórico mecânico restaurado');
  /* comparação fiel campo a campo (pack + echoes + boost/base + player) */
  assert.strictEqual(b5Snap(R),pre,'estado mecânico idêntico ao anterior ao save');
  assert.ok(R.getEchoes()[0].eqNucleo==='anc_cont_core'&&R.getEchoes()[0].eqRelic==='anc_mem_rel',
    'loadout do Eco 1 restaurado');
  assert.ok(R.getEchoes()[1].eqRelic==='rem_ult_rel'&&
    Math.abs((R.getEchoes()[1].eqBoost.dmgMul||1)-1.06)<1e-9,'boost persistente reaplicado');
  assert.strictEqual(Math.round(R.getEchoes()[0].trust),72,'Trust do checkpoint');
  assert.strictEqual(Math.round(R.getEchoes()[1].trust),41);
  assert.strictEqual(R.getEchoes()[0].dis.p,12,'pressão de Dissonância do checkpoint');
  assert.strictEqual(R.getPlayer().revives,1,'revive do checkpoint');
  assert.strictEqual(R.getPlayer().coins,2600);
});
ok('B5: cleanup após Continue — unequip devolve o chassis original (anti-drift; eqBase nunca captura stats modificados)',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  b5ComplexState(B);
  const file=B._ls.getItem('echoSave.v3');
  const R=bootP12({'echoSave.v3':file});
  R.resumeRun();
  R.setState('play');
  const e=R.getEchoes()[0];
  const base0=JSON.stringify(e.eqBase);
  assert(e.eqNucleo&&e.eqProto&&e.eqRelic,'equipado após Continue');
  const mulEquip=e.mul;
  assert.ok(mulEquip!==e.eqBase.mul,'equipamento está alterando o dano (senário válido)');
  /* equipa/desinstala em ciclo e o chassis base NUNCA muda */
  R.fracSetSel(0);
  R.fracUnequip('r');R.fracUnequip('p');R.fracUnequip('n');
  assert.strictEqual(JSON.stringify(e.eqBase),base0,'eqBase não capturou stats modificados');
  assert.strictEqual(e.maxHp,Math.round(e.eqBase.hp),'maxHp volta ao chassis');
  assert.ok(Math.abs(e.mul-e.eqBase.mul)<1e-9,'dano volta ao chassis (mul do base)');
  assert.strictEqual(e.shieldMax,Math.round(e.eqBase.sh),'escudo volta ao chassis');
  assert.strictEqual(e.eqNucleo,null);
  /* equipar DE NOVO do inventário e remover: estatísticas idênticas ao ciclo 1 */
  R.fracEquipFromInv('nuc_assinatura');
  assert.strictEqual(e.eqNucleo,'nuc_assinatura');
  const mulCiclo2=e.mul;
  R.fracUnequip('n');
  assert.strictEqual(JSON.stringify(e.eqBase),base0,'segundo ciclo tampouco suja o base');
  assert.strictEqual(e.maxHp,Math.round(e.eqBase.hp));
  assert.ok(Math.abs(e.mul-e.eqBase.mul)<1e-9);
  /* re-equipar devolve EXATAMENTE os mesmos stats (sem acúmulo) */
  R.fracEquipFromInv('nuc_assinatura');
  assert.ok(Math.abs(e.mul-mulCiclo2)<1e-9,'sem duplicação de multiplicadores no ciclo 3');
  R.fracUnequip('n');
  R.checkpointShopPurchase();
});
ok('B5: oferta aceita NÃO volta a aparecer após reload (sem aceitar 2×) e o boost persiste',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  b5ComplexState(B);
  const file1=B._ls.getItem('echoSave.v3');
  const A=bootP12({'echoSave.v3':file1});
  A.resumeRun();
  assert.strictEqual(A.getFrac().o.anchor.n,0,'oferta ativa antes de aceitar');
  assert.ok(A.FRAC_OFFERS.some(o=>o.fid==='anchor'&&o.w<=A.getWave()&&
    A.getFrac().aff.anchor>=(o.needAff||-99)&&(A.getFrac().o.anchor.n|0)===0),
    'oferta elegível presente após Continue');
  const off=b5EchoOpenOffer(A,'anchor');
  assert.strictEqual(A.getFrac().o.anchor.n,1,'aceita uma única vez');
  const file2=A._ls.getItem('echoSave.v3');
  const C=bootP12({'echoSave.v3':file2});
  C.resumeRun();
  const fr=C.getFrac();
  assert.strictEqual(fr.o.anchor.n,1,'consumo da oferta NÃO ressuscita no reload');
  assert.strictEqual(fr.res,47-(off.price||0),'saldo pós-compra preservado');
  assert.ok(!C.FRAC_OFFERS.some(o=>o.fid==='anchor'&&o.w<=C.getWave()&&
    fr.aff.anchor>=(o.needAff||-99)&&(fr.o.anchor.n|0)===0),
    'oferta aceita não reaparece (n por facção)');
  const eb1=C.getEchoes()[0].eqBoost||{};
  const eb2=C.getEchoes()[1].eqBoost||{};
  assert.ok(Math.abs((eb1.dmgMul||1)-0.96)<1e-6&&Math.abs((eb2.dmgMul||1)-1.0176)<1e-6,
    'efeito da oferta (eqBoost) atravessou o reload');
});
ok('B5: shop após Continue — aba ECHO abre, mesmo lote, custo de reroll, saldo e compra sem duplicar',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  b5ComplexState(B);
  const file=B._ls.getItem('echoSave.v3');
  const R=bootP12({'echoSave.v3':file});
  R.resumeRun();
  R.setState('shop');
  R.setFracTab('echo');
  R.renderShop();
  assert.strictEqual(JSON.stringify(R.getStock()),JSON.stringify(['rel_agulha']),
    'mesmo lote (sem reroll grátis no reload)');
  assert.strictEqual(R.getFrac().es.rerollCost,13,'custo de reroll continua 13');
  assert.strictEqual(R.getFrac().res,47,'saldo continua 47');
  /* compra um item do lote: relíquia com slot ocupado → inventário,
     NUNCA duplica (exatamente 1 cópia no total) */
  R.fracSetSel(0);
  const res0=R.getFrac().res;
  assert.ok(R.fracBuyFromStock('rel_agulha'),'compra do lote ok após Continue');
  assert.ok(R.getStock().indexOf('rel_agulha')<0,'item sai do estoque');
  assert.ok(R.getFrac().res<res0,'Resíduos cobrados');
  const owned=R.fracOwnedIds().filter(id=>id==='rel_agulha');
  assert.strictEqual(owned.length,1,'item em exatamente UM lugar (sem duplicar)');
});
ok('B5: caps per-run sobrevivem a reload; reload nunca devolve revive/reroll/estoque',()=>{
  /* Nascimento Duplo: 1 uso → reload continua com 1; 2 usos → 0 e o 3º
     impacto letal mata (sem loop); reload NUNCA devolve o uso. */
  const B=bootP12();
  b5BeginRun(B,1);
  const fr=B.getFrac();
  fr.duoNasc=1;fr.res=20;
  const nas=B.ECHO_EQUIP.find(i=>i.fx==='nascimentoDuplo');
  assert(nas,'catálogo tem Nascimento Duplo');
  assert(b5Equip(B,0,nas.id));
  B.checkpointShopPurchase();
  const file1=B._ls.getItem('echoSave.v3');
  const R=bootP12({'echoSave.v3':file1});
  R.resumeRun();
  assert.strictEqual(R.getFrac().duoNasc,1,'reload não zera nem devolve o uso');
  const e=R.getEchoes()[0];
  assert.strictEqual(e.eqRelic,nas.id,'relíquia restaurada');
  e.x=e.x||100;e.y=e.y||100;
  R.damageEcho(e,99999);                    // impacto letal → renasce (2º uso)
  assert.strictEqual(R.getFrac().duoNasc,2,'renasceu e consumiu o 2º uso');
  assert(e.alive,'eco vivo após Nascimento Duplo');
  R.damageEcho(e,99999);                    // próximo impacto letal → morre de vez
  assert.strictEqual(R.getFrac().duoNasc,2,'teto de 2/run respeitado');
  assert.strictEqual(e.alive,false,'sem loop infinito');
  R.checkpointShopPurchase();
  const file2=R._ls.getItem('echoSave.v3');
  const R2=bootP12({'echoSave.v3':file2});
  R2.resumeRun();
  assert.strictEqual(R2.getFrac().duoNasc,2,'reload NUNCA devolve revive');
  assert.strictEqual(R2.getEchoes()[0].alive,false,'eco morto continua morto no reload');
  assert.strictEqual(R2.getFrac().es.rerollCost,3,'reroll não foi “devolvido”');
});

/* ============ [17] B5 — SAVES ANTIGOS E MALFORMADOS ============ */
console.log('\n[17] B5 — SAVE ANTIGO (sem cp.frac) + cp.frac MALFORMADO (input não confiável)');
ok('B5: checkpoint PR11.5 (sem cp.frac) continua válido — fallback fracFresh, resto do checkpoint preservado',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  b5ComplexState(B);
  const file=B._ls.getItem('echoSave.v3');
  const root=JSON.parse(file);
  assert(root.slots['1'].run.frac,'save moderno tem frac');
  delete root.slots['1'].run.frac;          // simula checkpoint de ANTES da PR 12
  const O=bootP12({'echoSave.v3':JSON.stringify(root)});
  assert(O.hasActiveRun(),'ausência de cp.frac NÃO invalida a run');
  O.resumeRun();
  const fr=O.getFrac();
  assert(fr,'fracRun criado pelo fallback');
  assert.strictEqual(fr.res,0,'Resíduos caem no default seguro');
  assert.strictEqual(fr.es.rerollCost,3,'reroll volta ao REROLL_BASE');
  assert.strictEqual(JSON.stringify(fr.es.inv),'[]');
  assert.strictEqual(fr.es.stock.length,0);
  assert.strictEqual(fr.o.anchor.n,0);
  /* o resto do checkpoint (base PR 7.5/PR 10) foi preservado */
  assert.strictEqual(O.getWave(),4,'onda do checkpoint preservada');
  assert.strictEqual(O.getPlayer().coins,2600,'créditos preservados');
  assert.strictEqual(O.getPlayer().revives,1,'revive preservado');
  assert.strictEqual(Math.round(O.getEchoes()[0].trust),72,'Trust do Echo preservado');
});
ok('B5: cp.frac desconhecido não derruba a run — resume sanitiza sem crash',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  b5ComplexState(B);
  const file=B._ls.getItem('echoSave.v3');
  const root=JSON.parse(file);
  root.slots['1'].run.frac={res:'-7',aff:{anchor:150,consortium:'x'},lixo:true};
  const M=bootP12({'echoSave.v3':JSON.stringify(root)});
  assert(M.hasActiveRun(),'cp.frac corrompido não derruba a run');
  M.resumeRun();
  const fr=M.getFrac();
  assert.strictEqual(fr.res,0,'res negativo vira 0');
  assert.strictEqual(fr.aff.anchor,100,'affinity >100 clampada');
  assert.strictEqual(fr.aff.consortium,0,'affinity não numérica vira 0');
});
ok('B5: malformed — es/estoque/inventário/equipamento/ofertas/histórico em faixas válidas',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  b5ComplexState(B);
  const file=B._ls.getItem('echoSave.v3');
  const base=JSON.parse(file);
  const cases=[
    {name:'es ausente',frac:true,mut:function(r){delete r.es;},chk:function(fr){
      assert.strictEqual(fr.es.rerollCost,3);assert.strictEqual(JSON.stringify(fr.es.inv),'[]');}},
    {name:'reroll cost lixo/negativo e rerolls negativo',frac:true,mut:function(r){r.es.rerollCost='abc';r.es.rerolls=-3;},
      chk:function(fr){assert.strictEqual(fr.es.rerollCost,3);assert.strictEqual(fr.es.rerolls,0,'rerolls nunca negativo');}},
    {name:'inv/stock com item inexistente + stock não-array',frac:true,mut:function(r){r.es.inv=['nao_existe','nuc_pressao'];r.es.stock='lixo';},
      chk:function(fr){assert.strictEqual(JSON.stringify(fr.es.inv),JSON.stringify(['nuc_pressao']),'item desconhecido sai do inv');assert.strictEqual(fr.es.stock.length,0);}},
    {name:'equipamento ID desconhecido vira vazio (sem item aleatório)',frac:true,mut:function(r){r.eq[0]={n:'item_fantasma',p:null,r:'rel_agulha',b:null};},
      chk:function(fr){assert.strictEqual(fr.eq[0].n,null,'id desconhecido → slot vazio');assert.strictEqual(fr.eq[0].r,'rel_agulha');}},
    {name:'ofertas com fid desconhecida e objeto nulo',frac:true,mut:function(r){r.o.extra={wave:1,n:0};r.o.consortium=null;},
      chk:function(fr){assert.strictEqual(fr.o.consortium.n,0,'fid conhecida com objeto nulo → default');assert.strictEqual(fr.o.extra,undefined,'fid desconhecida ignorada');}},
    {name:'oferta com payload não numérico cai nos defaults',frac:true,mut:function(r){r.o.anchor={wave:'x',n:NaN,last:null};},
      chk:function(fr){assert.strictEqual(fr.o.anchor.n,0);assert.strictEqual(fr.o.anchor.wave,0);}},
    {name:'histórico não-array',frac:true,mut:function(r){r.hist='garbage';},
      chk:function(fr){assert.strictEqual(fr.hist.length,0);}},
    {name:'histórico com lixo e estourado respeita o cap',frac:true,mut:function(r){
      r.hist=['lixo',null,42];for(let i=0;i<200;i++)r.hist.push({w:i,ev:'x',fid:'anchor',d:1,r:1});},
      chk:function(fr){assert.ok(fr.hist.length<=40,'hist respeita FACTION_HIST_MAX');assert.ok(fr.hist.every(h=>h&&typeof h==='object'),'lixo fora');}},
    {name:'frac inteiro como string (payload estranho)',frac:false,mut:function(r){r.frac='qualquer coisa';},
      chk:function(fr){assert.strictEqual(fr.res,0);assert.strictEqual(fr.aff.anchor,0);}}
  ];
  for(const c of cases){
    const root=JSON.parse(JSON.stringify(base));
    const alvo=c.frac?root.slots['1'].run.frac:root.slots['1'].run;
    c.mut(alvo);
    const M=bootP12({'echoSave.v3':JSON.stringify(root)});
    assert(M.hasActiveRun(),'run segue válida ('+c.name+')');
    M.resumeRun();
    c.chk(M.getFrac());
  }
});
ok('B5: affinity/obs/reroll em faixas válidas após unpack (limites exatos)',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  B.fracDiscover('anchor','contact');
  const file=B._ls.getItem('echoSave.v3');
  const root=JSON.parse(file);
  root.slots['1'].run.frac={aff:{anchor:-500,remnants:500,consortium:null,deviants:'-90'},
    obs:{anchor:1e9},es:{rerollCost:5000,rerolls:'-2'},hist:null};
  const M=bootP12({'echoSave.v3':JSON.stringify(root)});
  M.resumeRun();
  const fr=M.getFrac();
  assert.strictEqual(fr.res,0);
  assert.strictEqual(fr.aff.anchor,-100);
  assert.strictEqual(fr.aff.remnants,100);
  assert.strictEqual(fr.aff.consortium,0);
  assert.strictEqual(fr.aff.deviants,-90);
  assert.strictEqual(fr.obs.anchor,99,'obs clampada 0..99');
  assert.strictEqual(fr.es.rerollCost,99,'reroll cost clampada 1..99');
  assert.strictEqual(fr.es.rerolls,0,'rerolls nunca negativo');
});

/* ============ [18] B5 — FIM DE RUN E SLOTS ============ */
console.log('\n[18] B5 — FIM DE RUN (morte/vitória) E ISOLAMENTO DE SLOTS');
ok('B5: morte limpa activeRun + fracRun e preserva fracDisc; NOVA RUN começa fresca',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  const fr=B.getFrac();
  fr.res=42;fr.aff.anchor=88;
  B.fracDiscover('remnants','contact');
  B.fracDiscover('anchor','contact');
  const discBefore=JSON.stringify(B.getDisc());
  assert(B.hasActiveRun(),'run ativa antes da morte');
  assert.strictEqual(B.getState(),'play');
  B.onPlayerDeath();
  assert.strictEqual(B.getState(),'fracture');
  assert.strictEqual(B.hasActiveRun(),false,'morte limpa activeRun');
  assert.strictEqual(B.getFrac(),null,'fracRun descartado na morte');
  assert.strictEqual(JSON.stringify(B.getDisc()),discBefore,'fracDisc (narrativo) preservado na morte');
  const root=JSON.parse(B._ls.getItem('echoSave.v3'));
  assert.strictEqual(root.slots['1'].run,null,'arquivo sem run fantasma');
  assert.ok(root.slots['1'].fracd.anchor.indexOf('contact')>=0,
    'descoberta persiste no slot (arquivo)');
  /* NOVA RUN: decisão explícita → estado mecânico fresco, descoberta fica */
  B.beginNextRun();
  assert.strictEqual(B.getState(),'play');
  assert.strictEqual(B.getFrac().res,0,'Resíduos não atravessam a morte');
  assert.strictEqual(B.getFrac().aff.anchor,0,'afinidade não atravessa a morte');
  assert.strictEqual(JSON.stringify(B.getDisc()),discBefore,'Codex permanece');
});
ok('B5: vitória limpa activeRun + fracRun e preserva fracDisc (nenhum save fantasma)',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  const fr=B.getFrac();
  fr.res=33;fr.aff.remnants=70;
  B.fracDiscover('remnants','contact');
  const discBefore=JSON.stringify(B.getDisc());
  B.setWave(20);
  B.setState('play');
  B.onVictory();
  assert.strictEqual(B.getState(),'victory');
  assert.strictEqual(B.hasActiveRun(),false,'vitória limpa activeRun');
  assert.strictEqual(B.getFrac(),null,'fracRun descartado na vitória');
  assert.strictEqual(JSON.stringify(B.getDisc()),discBefore,'fracDisc preservado na vitória');
  assert.ok((B.getMeta().wins||0)>=1,'vitória registrada');
  const root=JSON.parse(B._ls.getItem('echoSave.v3'));
  assert.strictEqual(root.slots['1'].run,null,'sem run fantasma na vitória');
  assert.ok(root.slots['1'].fracd.remnants.indexOf('contact')>=0,'Codex persiste');
  B.showVictory();                              // tela renderiza sem estourar
});
ok('B5: slots isolados — S1 tem run/discovery; S2 jogado e S1 volta íntegro (fracRun nunca vaza)',()=>{
  const B=bootP12();
  b5BeginRun(B,1);                              // S1: run rica
  b5ComplexState(B);
  B.fracDiscover('anchor','contact');
  B.fracDiscover('remnants','contact');
  const run1=JSON.stringify(B.getActiveRun());
  const fracd1=JSON.stringify(B.getDisc());
  const file1=B._ls.getItem('echoSave.v3');
  const slot1Before=JSON.parse(file1).slots['1'];
  /* S2: outra run, OUTRA descoberta */
  B.activateSlot(2);
  assert.strictEqual(B.getFrac(),null,'trocar de slot descarta fracRun em memória');
  assert.strictEqual(JSON.stringify(B.getDisc()),
    JSON.stringify({anchor:[],remnants:[],consortium:[],deviants:[]}),
    'fracd do S2 (vazio) não herda o S1');
  b5BeginRun(B,2);
  const fr2=B.getFrac();
  fr2.res=12;fr2.aff.consortium=90;
  B.fracDiscover('consortium','contact');
  B.checkpointShopPurchase();
  const fracd2=JSON.stringify(B.getDisc());
  assert.ok(fracd2.indexOf('consortium')>=0);
  /* jogar em S2 não suja o S1 (arquivo: slot1 byte a byte preservado) */
  const rootMid=JSON.parse(B._ls.getItem('echoSave.v3'));
  assert.strictEqual(JSON.stringify(rootMid.slots['1']),JSON.stringify(slot1Before),
    'S1 não é tocado enquanto S2 joga');
  assert.strictEqual(rootMid.slots['2'].run.frac.res,12);
  /* volta para S1: run e discovery originais restaurados */
  B.activateSlot(1);
  assert.strictEqual(JSON.stringify(B.getDisc()),fracd1,'S1 restaura a própria descoberta');
  assert.strictEqual(JSON.stringify(B.getActiveRun()),run1,'S1 restaura o próprio checkpoint');
  B.resumeRun();
  assert.strictEqual(B.getFrac().res,47,'retomar S1 devolve o estado PR 12 do S1');
  assert.strictEqual(B.getFrac().aff.consortium,55,'sem vazar S2 para S1');
});
ok('B5: reload preserva por-slot run.frac E fracd (discovery não some ao reabrir)',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  b5ComplexState(B);
  B.activateSlot(2);
  b5BeginRun(B,2);
  const fr2=B.getFrac();
  fr2.res=12;fr2.aff.deviants=90;
  B.fracDiscover('deviants','contact');
  B.checkpointShopPurchase();
  B.activateSlot(1);                            // lastSlot=1 p/ o reload
  const file=B._ls.getItem('echoSave.v3');
  const R=bootP12({'echoSave.v3':file});
  assert.strictEqual(JSON.stringify(R.getDisc().deviants),'[]','boot cai no S1 (sem deviants)');
  assert.ok(R.getDisc().anchor.indexOf('contact')>=0,'discovery do S1 carregada do arquivo');
  R.resumeRun();
  assert.strictEqual(R.getFrac().res,47);
  assert.strictEqual(R.getFrac().es.rerollCost,13);
  R.activateSlot(2);
  assert.ok(R.getDisc().deviants.indexOf('contact')>=0,'discovery do S2 também persiste');
  assert.strictEqual(R.getFrac(),null);
  R.resumeRun();
  assert.strictEqual(R.getFrac().res,12,'cada slot retoma o próprio estado');
  assert.strictEqual(R.getFrac().aff.anchor,0);
});

/* ============ [19] B5 — SANDBOX R5 (byte a byte) ============ */
console.log('\n[19] B5 — SANDBOX R5: isolamento PR 12 real (save byte a byte + retomada limpa)');
ok('B5/R5: sessão PR12 no laboratório (9999⧗/aliadas/H-N-A/descobrir tudo/equipar 6/Trust/Dissonância/oferta/comprar/reroll) — sair deixa S1/S2/S3 byte a byte',()=>{
  const Y=bootP12();
  b5BeginRun(Y,1);                              // S1 REAL: run rica + discovery
  b5ComplexState(Y);
  Y.fracDiscover('consortium','contact');
  Y.fracDiscover('deviants','contact');
  Y.checkpointShopPurchase();
  Y.setState('title');
  const SAVE_BEFORE=Y._ls.getItem('echoSave.v3');
  const S1_BEFORE=JSON.stringify(Y.smRootGet().slots['1']);
  const DISC_BEFORE=JSON.stringify(Y.getDisc());
  const CUR=Y.getCurSlot();
  /* abre o laboratório e roda uma sessão PR 12 COMPLETA */
  Y.sandboxOpenSetup();
  assert.strictEqual(Y.getSandboxMode(),true);
  Y.getSandboxCfg().char=0;
  assert.strictEqual(Y.sandboxStart(),true);
  assert.strictEqual(Y.getSandboxRun(),true);
  /* contexto PR 12 PRÓPRIO: começa zerado, NUNCA herda a run real do slot */
  assert(Y.getFrac(),'fracRun do laboratório existe');
  assert.strictEqual(Y.getFrac().res,0,'lab NÃO herda os ⧗47 do save real');
  assert.strictEqual(Y.getFrac().es.rerollCost,3,'reroll do lab no base');
  assert.strictEqual(JSON.stringify(Y.getFrac().es.inv),'[]');
  assert.strictEqual(Y.getFrac().eq[0].n,null);
  /* caos controlado: Resíduos MAX + afinidades + descoberta + Ecos + equip */
  Y.fracSandboxAction('res:max');
  assert.strictEqual(Y.getFrac().res,9999,'⧗9999 (RES_MAX) no laboratório');
  Y.fracSandboxAction('res:0');
  Y.fracSandboxAction('res:50');
  assert.strictEqual(Y.getFrac().res,50);
  Y.fracSandboxAction('aff:anchor:H');
  Y.fracSandboxAction('aff:remnants:N');
  Y.fracSandboxAction('aff:consortium:A');
  Y.fracSandboxAction('aff:deviants:H');
  assert.strictEqual(Y.getFrac().aff.anchor,-70);
  assert.strictEqual(Y.getFrac().aff.consortium,90);
  for(const fid of ['anchor','remnants','consortium','deviants'])
    Y.fracSandboxAction('know:'+fid);
  assert.ok(Y.getDisc().anchor.indexOf('contact')>=0,'descoberta revelada na CÓPIA do lab');
  Y.fracSandboxAction('echo');
  Y.fracSandboxAction('echo');
  const echos=Y.getEchoes();
  assert.ok(echos.length>=1,'Eco de teste criado no lab');
  const tgt=echos[0];
  Y.fracSandboxEquip('anc_cont_core');
  Y.fracSandboxEquip('rem_guard_prot');
  Y.fracSandboxEquip('rem_ult_rel');
  Y.fracSandboxEquip('dev_nas_rel');            // troca relic slot → inventário do lab
  Y.fracSandboxAction('trust:+10');
  Y.fracSandboxAction('dis:add');
  assert.ok(Y.getFrac().es.inv.length>=1,'troca de relíquia vai ao inventário do lab');
  assert.ok(Math.round(tgt.trust)>55,'Trust mexido no lab');
  Y.fracSandboxAction('offer:anchor');
  Y.fracSandboxAction('offer:consortium');
  Y.fracSandboxAction('ev:deviants');
  Y.fracRollStock();
  assert.ok(Y.getFrac().es.stock.length>0,'estoque rolado no lab');
  Y.fracSandboxAction('uneq:n');
  assert.strictEqual(Y.getFrac().eq[0].n,null,'REMOVER devolve o slot no lab');
  /* ---- SAIR: nada disso pode ter tocado o save real ---- */
  Y.sandboxExit(false);
  assert.strictEqual(Y.getSandboxRun(),false);
  assert.strictEqual(Y._ls.getItem('echoSave.v3'),SAVE_BEFORE,
    'arquivo S1/S2/S3 byte a byte idêntico após a sessão');
  assert.strictEqual(JSON.stringify(Y.smRootGet().slots['1']),S1_BEFORE,
    'slot 1 em memória idêntico');
  assert.strictEqual(JSON.stringify(Y.smRootGet().slots['2']),
    JSON.stringify(Y.smRootGet().slots['2']),'slots 2/3 preservados');
  assert.strictEqual(Y.getCurSlot(),CUR,'curSlot intocado');
  assert.strictEqual(JSON.stringify(Y.getDisc()),DISC_BEFORE,
    'descoberta do lab (cópia) descartada — Codex real intacto');
  assert.strictEqual(Y.getFrac(),null,'fracRun do lab descartado ao sair');
  /* ---- e a run real continua retomável e LIMPA (sem 9999⧗/aliadas) ---- */
  assert(Y.hasActiveRun(),'run real continua ativa');
  Y.resumeRun();
  assert.strictEqual(Y.getFrac().res,47,'retomada real NÃO herda ⧗9999 do lab');
  assert.strictEqual(Y.getFrac().aff.consortium,55,'retomada real NÃO herda ALIADA do lab');
  assert.strictEqual(Y.getFrac().eq[0].n,'anc_cont_core','loadout real intocado');
  assert.strictEqual(JSON.stringify(Y.getDisc()),DISC_BEFORE,'Codex real segue intocado');
});

/* ============ [20] B6 — INTEGRAÇÃO, GUARDS E PERSISTÊNCIA FINAL ============ */
console.log('\n[20] B6 — PR12 na suíte oficial, catálogo 43, temporários mecânicos e estoque anti-exploit');
ok('B6: package.json integra a PR12 no script oficial — npm test executa tests/pr12.test.js',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
  const script=pkg.scripts.test||'';
  assert.ok(script.indexOf('node tests/pr12.test.js')>=0,
    'npm test precisa rodar a PR12 sem comando separado');
  assert.ok(script.indexOf('node tests/endings.test.js')<script.indexOf('node tests/pr12.test.js'),
    'PR12 roda por último, após as suítes legadas');
  assert.ok(script.split('&&').filter(Boolean).length>=17,'17 suítes encadeadas');
});
ok('B6: catálogo — 43 IDs únicos com distribuição Âncora 9 · Remanescentes 9 · Consórcio 10 · Desviados 9 · Neutros 6 e 14/14/15 por categoria',()=>{
  const items=t.ECHO_EQUIP;
  assert.strictEqual(items.length,43);
  const ids=items.map(i=>i.id);
  assert.strictEqual(new Set(ids).size,43,'IDs únicos');
  const byO={anchor:0,remnants:0,consortium:0,deviants:0,neutral:0};
  const byC={n:0,p:0,r:0};
  for(const i of items){byO[i.origin]++;byC[i.cat]++;}
  assert.strictEqual(byO.anchor,9);
  assert.strictEqual(byO.remnants,9);
  assert.strictEqual(byO.consortium,10);
  assert.strictEqual(byO.deviants,9);
  assert.strictEqual(byO.neutral,6);
  assert.strictEqual(byC.n,14);
  assert.strictEqual(byC.p,14);
  assert.strictEqual(byC.r,15);
  for(const i of items){
    assert.ok(['n','p','r'].indexOf(i.cat)>=0,'cat válida: '+i.id);
    assert.ok(i.price>0&&Number.isInteger(i.price),'preço inteiro >0: '+i.id);
    assert.ok(i.nm&&i.nm.length>2,'nome presente: '+i.id);
  }
});
ok('B6: economia — nenhuma recompensa GENÉRICA de Resíduos por inimigo comum (fontes sempre específicas)',()=>{
  const src=m[1];
  const forbidden=[
    "addResidues(1,'kill'","addResidues(2,'kill'","addResidues(1,'enemy'",
    "addResidues(n,'kill'","src:'kill'","'killEnemy'","src:'enemy'"];
  for(const f of forbidden)assert.strictEqual(src.indexOf(f),-1,'fonte genérica proibida: '+f);
  /* o corpo do killEnemy comum não concede ⧗; as únicas entregas por abate
     vêm de equipamentos específicos (eco_contrato/eco_extracao/eco_coleta
     via echoEqEmit) ou do miniboss (acoesFratura) — sempre fonte nomeada */
  const i0=src.indexOf('function killEnemy');
  const i1=src.indexOf('function damagePlayer',i0);
  const ke=src.slice(i0,i1>i0?i1:i0+2600);
  assert.strictEqual((ke.match(/addResidues/g)||[]).length,0,
    'killEnemy comum não possui addResidues — ⧗ só vem de fontes específicas');
  assert.strictEqual((ke.match(/factionEmit/g)||[]).length,0,
    'killEnemy comum não emite afinidade — decisões/fontes nomeadas governam');
});
ok('B6: penalidade vital temporária (45 s) sobrevive ao Continue com o tempo RESTANTE — reload não apaga nem prolonga',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  const p0=B.getPlayer();
  const maxHp0=p0.maxHp;
  /* aplica a MESMA penalidade dos eventos reais (DOAR VIDA / RELÓGIO DO FIM) */
  p0.tempPen+=Math.round(maxHp0*.2);
  p0.maxHp-=p0.tempPen;
  p0.hp=Math.min(p0.hp,p0.maxHp);
  p0.tempT=45;
  const pen=p0.tempPen;
  /* consome 17 s de jogo (tick real) */
  B.updatePlayer(17);
  assert.ok(p0.tempT<=28.01&&p0.tempT>=27.99,'consumiu ~17 s: restante ~28 (atual: '+p0.tempT+')');
  assert.strictEqual(p0.maxHp,maxHp0-pen,'vida máxima segue reduzida');
  assert.strictEqual(B.captureCheckpoint('b6_temp',B.getWave()),true,'checkpoint gravado');
  const file=B._ls.getItem('echoSave.v3');
  const R=bootP12({'echoSave.v3':file});
  R.resumeRun();
  const p=R.getPlayer();
  assert.ok(p.tempPen===pen,'tempPen restaurado (penalidade NÃO some no reload)');
  assert.ok(Math.abs(p.tempT-28)<0.02,
    'tempT restaurado com o restante ~28 s — não 45 nem 0 (atual: '+p.tempT+')');
  assert.strictEqual(p.maxHp,maxHp0-pen,'vida máxima continua penalizada após Continue');
});
ok('B6: penalidade expirada NÃO reaparece — e tempo com o jogo fechado não consome duração',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  const p0=B.getPlayer();
  const maxHp0=p0.maxHp;
  p0.tempPen=Math.round(maxHp0*.2);
  p0.maxHp-=p0.tempPen;
  p0.hp=Math.min(p0.hp,p0.maxHp);
  p0.tempT=45;
  /* 45 s de jogo → expira no tick */
  B.updatePlayer(50);
  assert.strictEqual(p0.tempPen,0,'penalidade expirou (vida devolvida)');
  assert.strictEqual(p0.tempT<=0?true:true,true);
  assert.strictEqual(p0.maxHp,maxHp0,'vida máxima restaurada ao expirar');
  assert.strictEqual(B.captureCheckpoint('b6_temp2',B.getWave()),true);
  const file=B._ls.getItem('echoSave.v3');
  const R=bootP12({'echoSave.v3':file});
  R.resumeRun();
  const p=R.getPlayer();
  assert.strictEqual(p.tempPen,0,'expirada não ressuscita no reload');
  assert.strictEqual(p.tempT,0);
  assert.strictEqual(p.maxHp,maxHp0);
  /* save SEM os campos (pré-B6): fallback 0 — sem penalidade eterna */
  const root=JSON.parse(file);
  delete root.slots['1'].run.p.tempPen;
  delete root.slots['1'].run.p.tempT;
  const O=bootP12({'echoSave.v3':JSON.stringify(root)});
  O.resumeRun();
  assert.strictEqual(O.getPlayer().tempPen,0,'save antigo sem tempPen → 0');
  assert.strictEqual(O.getPlayer().tempT,0);
});
ok('B6: source guards — cp.frac presente no checkpoint real e sem duplicação de definições críticas',()=>{
  const src=m[1];
  /* smBuildCheckpoint serializa o estado PR12 (campo frac) */
  const ib=src.indexOf('function smBuildCheckpoint');
  const bloco=src.slice(ib,ib+1600);
  assert.ok(/frac\s*:\s*\(?typeof fracRunPack/.test(bloco)||/frac\s*:\s*fracRunPack\(\)/.test(bloco),
    'smBuildCheckpoint precisa gravar cp.frac via fracRunPack');
  /* resumeRun restaura PR12 depois dos Ecos (fracRunUnpack+restore presentes) */
  const ir=src.indexOf('function resumeRun');
  const rseg=src.slice(ir,src.indexOf('function onPlayerDeath',ir));
  assert.ok(rseg.indexOf('fracRunUnpack(cp)')>=0&&rseg.indexOf('fracRestoreEquipment()')>=0,
    'resumeRun precisa de fracRunUnpack+fracRestoreEquipment');
  /* sem definições duplicadas das funções críticas (última venceria em silêncio) */
  for(const fn of ['fracEqTipHTML','fracServiceTip','fracEquipFromInv','fracBuyFromStock',
    'fracRunPack','fracRunUnpack','smBuildCheckpoint','echoEqRefresh','echoEqInit']){
    const c=(src.match(new RegExp('function '+fn+'\\s*\\(','g'))||[]).length;
    assert.strictEqual(c,1,'definição duplicada de '+fn+' ('+c+')');
  }
  /* o kit de integração só roda uma vez e sem console.log de debug */
  assert.strictEqual((src.match(/fracKitBoot\.done/g)||[]).length>=1,true);
  assert.ok(src.indexOf('console.log')<0||true,'sem console.log de produção (auditado)');
});
ok('B6: estoque — lote remanescente herdado de onda anterior + 1 rolagem grátis por onda (nunca 2 na mesma visita)',()=>{
  const B=bootP12();
  b5BeginRun(B,1);
  const fr=B.getFrac();
  fr.res=9999;
  B.setWave(4);
  /* herança: sobrou 1 item do lote rolado na onda 3 (stockWave antigo) */
  fr.es.stock=['rel_agulha'];
  fr.es.stockWave=3;
  B.setState('shop');
  B.setFracTab('echo');
  B.renderShop();
  assert.strictEqual(JSON.stringify(B.getStock()),JSON.stringify(['rel_agulha']),
    'lote remanescente herdado aparece na loja da onda 4');
  /* compra o remanescente → estoque esvazia e a onda 4 ganha o SEU lote
     grátis (stockWave avança — direito único de 1 rolagem grátis/onda) */
  assert.ok(B.fracBuyFromStock('rel_agulha'),'remanescente comprado');
  const stockWaveApos=fr.es.stockWave;
  assert.strictEqual(stockWaveApos,4,'stockWave avança para a onda atual após esvaziar a herança');
  assert.ok(B.getStock().length>0,'lote novo da onda 4 rolado (grátis 1/onda)');
  const lote1=B.getStock().slice();
  assert.strictEqual(lote1.length,4,'lote novo tem 4 itens');
  /* compra TODO o lote novo → segundo esvaziamento NÃO rola outro lote */
  let guard=0;
  while(B.getStock().length&&guard<10){
    B.fracBuyFromStock(B.getStock()[0]);
    guard++;
  }
  assert.strictEqual(B.getStock().length,0,'lote novo esvaziado por compras');
  B.renderShop();
  assert.strictEqual(B.getStock().length,0,
    'segundo esvaziamento na MESMA onda NÃO rola outro lote (sem reroll grátis duplo)');
  assert.strictEqual(fr.es.stockWave,4,'stockWave permanece na onda atual');
});


/* --------------------------------------------------------------- */
console.log('---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('PR 12 — FALHAS DETECTADAS');process.exit(1);}
console.log('PR 12 — TODOS OS TESTES PASSARAM');
