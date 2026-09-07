'use strict';
/* =====================================================================
   TESTES — PR14 · B3-FIX.1 (SEGUNDO PLAYTEST HUMANO)
   ---------------------------------------------------------------------
   Cobre EXATAMENTE os três pontos do 2º playtest + regressões diretas:

   A. TOOLTIP × MODAL (itens 1-10)
      · tipShow recusa exibir quando um modal bloqueante está aberto;
      · hideActiveTooltip() mata tooltip flutuante;
      · a Loja Temporal (mesmo #modal) continua com tooltips válidos;
      · abrir loja/evento/pausa/codex/registro esconde o tooltip;
      · bindTip passa o elemento de origem para tipShow.

   B. ECONOMIA DE ⧗ — SEDIMENTO TEMPORAL (itens 11-23)
      · fracWaveSediment paga 2,2,1,1,1 nas ondas 1-5 e 0 a partir da 6;
      · idempotente por onda (não paga duas vezes); anti-reload (sedW);
      · silenciado no Sandbox; nulo sem fracRun;
      · não cria moeda nova; não infla o teto; preserva CACHE (+4).

   C. FALA DE OPERADOR — POOL ANTI-REPETIÇÃO (itens 24-35)
      · cada operador tem pool >1; 1ª linha = assinatura histórica;
      · seleção não repete a linha imediatamente anterior;
      · determinística e cosmética (não usa Math.random do loop);
      · cobre os 8 operadores; distinção operador × Echo (B4 não antecipado).

   D. REGRESSÕES (itens 36-52)
      · versões (0.8.0-alpha / SM_VERSION 3 / FRACTURE_STATE_VERSION 1);
      · B2/B3/B3-FIX intactos; eventos de facção; presença física;
      · pack/unpack idempotente com sedW; addResidues/clamp preservados.

   Rodar: npm test  |  node tests/pr14-b3-fix1-playtest.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const mm=html.match(/<script>([\s\S]*?)<\/script>/);
if(!mm)throw new Error('script não encontrado em index.html');
let src=mm[1];
src+=';globalThis.__t={'+
  /* Tooltip */
  'tipShow,tipHide,tipMove,bindTip,hideActiveTooltip,tooltipBlockedByModal,'+
  'TOOLTIP_BLOCKERS,openEvent,openShop,renderShop,pauseGame,openCodex,'+
  'getState:()=>state,setState:v=>{state=v;},getTipEl:()=>tipEl,'+
  /* Economia ⧗ */
  'fracWaveSediment,FRAC_SEDIMENT_MAX_WAVE,addResidues,spendResidues,'+
  'getResidues,fracRes,fracFresh,fracRunPack,fracRunUnpack,RES_MAX,'+
  'FACTION_PRESENCE_CONSORTIUM_RES,'+
  'setFracRun:v=>{fracRun=v;},getFracRun:()=>fracRun,'+
  'setWave:v=>{wave=v|0;},getWave:()=>wave,'+
  'setSandboxRun:v=>{sandboxRun=v;},getSandboxRun:()=>sandboxRun,'+
  'setSandboxMode:v=>{sandboxMode=v;},'+
  /* Falas de operador */
  'OPERATOR_WHISPER,operatorWhisperLine,operatorWhisperHTML,'+
  'CHARS,setCharSel:v=>{charSel=v;},getCharSel:()=>charSel,'+
  /* Regressões / versões */
  'ECHO_VERSION,SM_VERSION,FRACTURE_STATE_VERSION,'+
  'FACTION_RUN_EVENTS,FRAC_CONTACT_EVENTS,'+
  'FACTION_PRESENCE_PHYSICAL,fpIsPhysical,FACTION_PRESENCE_ACTIVE_CAP,'+
  'setPlayer:v=>{player=v;},getPlayer:()=>player'+
  '};';

/* ---- DOM mínimo (mesmo harness das suítes anteriores) ---- */
function makeStyle(){const store={};
  return new Proxy(store,{get(t,k){return k in t?t[k]:'';},
    set(t,k,v){t[k]=String(v);return true;}});}
function ctx2dRec(rec){
  const grad={addColorStop(){}};
  return new Proxy({},{get(t,k){
    if(k==='canvas')return{width:0,height:0};
    if(k==='measureText')return()=>({width:0});
    if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;
    return()=>{};},set(){return true;}});}
function makeEl(id){
  const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,
    _cls:new Set(),_handlers:{},parentNode:null,isConnected:true,
    offsetWidth:120,offsetHeight:40,textContent:'',innerHTML:'',className:'',
    title:'',style:makeStyle()};
  el.classList={add:(...c)=>c.forEach(x=>el._cls.add(x)),
    remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
    contains:c=>el._cls.has(c),
    toggle(c,f){const has=el._cls.has(c);const want=f===undefined?!has:!!f;
      if(want)el._cls.add(c);else el._cls.delete(c);return want;}};
  el.appendChild=c=>{if(c&&typeof c==='object')c.parentNode=el;el.children.push(c);return c;};
  el.insertBefore=(c,ref)=>{if(c&&typeof c==='object')c.parentNode=el;
    const i=ref?el.children.indexOf(ref):-1;
    if(i>=0)el.children.splice(i,0,c);else el.children.unshift(c);return c;};
  el.removeChild=c=>{const i=el.children.indexOf(c);
    if(i>=0){el.children.splice(i,1);if(c&&typeof c==='object')c.parentNode=null;}return c;};
  el.remove=()=>{if(el.parentNode&&el.parentNode.removeChild)el.parentNode.removeChild(el);};
  el.addEventListener=(ev,fn)=>{(el._handlers[ev]=el._handlers[ev]||[]).push(fn);};
  el.removeEventListener=()=>{};el.dispatchEvent=()=>{};el.click=()=>{};
  el.querySelector=sel=>((typeof sel==='string'&&sel.charAt(0)==='.')?makeEl(''):null);
  el.querySelectorAll=()=>[];el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};
  el.contains=node=>{ // DOM .contains real: o próprio nó ou algum descendente
    if(node===el)return true;
    const stack=el.children.slice();
    while(stack.length){const c=stack.pop();if(c===node)return true;
      if(c&&c.children)for(const g of c.children)stack.push(g);}
    return false;};
  el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];
  el.getContext=()=>ctx2dRec({});
  Object.defineProperty(el,'firstChild',{get:()=>el.children.length?el.children[0]:null});
  Object.defineProperty(el,'lastChild',{get:()=>el.children.length?el.children[el.children.length-1]:null});
  return el;}
function findByTree(root,id){
  if(!root||typeof root!=='object')return null;
  if(root.id===id)return root;
  const ch=root.children;if(!ch)return null;
  for(const c of ch){const f=findByTree(c,id);if(f)return f;}
  return null;}
function makeEnv(){
  const elements=new Map();
  const document={hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
    fullscreenElement:null,webkitFullscreenElement:null,createElement:()=>makeEl(''),
    getElementById:id=>{
      for(const root of [document.body,document.documentElement].concat(Array.from(elements.values())))
        {const f=findByTree(root,id);if(f)return f;}
      if(!elements.has(id))elements.set(id,makeEl(id));
      return elements.get(id);},
    querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},
    hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()};
  const window={innerWidth:1920,innerHeight:1080,devicePixelRatio:1,
    screen:{availWidth:1920,availHeight:1080},addEventListener:()=>{},removeEventListener:()=>{},
    matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),
    AudioContext:undefined,webkitAudioContext:undefined,
    open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined};
  const localStorage={_d:{},getItem(k){return this._d[k]||null;},
    setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
  return {elements,document,window,localStorage,navigator:{getGamepads:()=>[]}};}
function runGame(env){
  const sandbox={console,Math,Date,parseInt,parseFloat,isNaN,
    setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,
    Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
    Promise,Proxy,Reflect,JSON,Symbol,isFinite,
    document:env.document,window:env.window,localStorage:env.localStorage,
    navigator:env.navigator,performance:{now:()=>Date.now()}};
  const ctx=vm.createContext(sandbox);
  vm.runInContext(src,ctx,{timeout:30000});
  return {t:vm.runInContext('__t',ctx),ctx,env};}

const MAIN=runGame(makeEnv());
const t=MAIN.t, env=MAIN.env;

let pass=0,fail=0;
function ok(name,fn){try{fn();console.log('  \u2714 '+name);pass++;}
  catch(e){console.log('  \u2718 '+name+'\n    '+(e&&e.message||e));fail++;}}
const byId=id=>env.document.getElementById(id);
function stripTags(h){return String(h).replace(/<[^>]+>/g,'');}
function fakePlayer(){return {x:960,y:540,r:14,hp:100,maxHp:100,shield:0,shieldMax:30,
  coins:0,owned:[0],items:[],upgLog:[],maxSlots:3};}
/* limpa todos os modais bloqueantes + #modal */
function closeAllModals(){
  for(const id of ['modal','pause-menu','codex','endwrap','sheet','sandboxp'])
    byId(id).classList.remove('on');
}

console.log('\n=== PR14 · B3-FIX.1 — SEGUNDO PLAYTEST HUMANO ===');

/* ================================================================== */
/* A. TOOLTIP × MODAL (1-10)                                           */
/* ================================================================== */

ok('1. hideActiveTooltip existe e remove a classe "on" do #tip',()=>{
  const tip=byId('tip');tip.classList.add('on');
  t.hideActiveTooltip();
  assert.ok(!tip.classList.contains('on'),'tooltip escondido');
});

ok('2. tipShow exibe normalmente quando NENHUM modal está aberto',()=>{
  closeAllModals();
  const tip=byId('tip');tip.classList.remove('on');
  t.tipShow('<b>ARMA</b>',{clientX:100,clientY:100},byId('somebtn'));
  assert.ok(tip.classList.contains('on'),'tooltip aparece fora de modal');
});

ok('3. tipShow NÃO exibe com #pause-menu aberto (recusa na origem)',()=>{
  closeAllModals();
  const tip=byId('tip');tip.classList.remove('on');
  byId('pause-menu').classList.add('on');
  t.tipShow('<b>X</b>',{clientX:1,clientY:1},byId('anyEl'));
  assert.ok(!tip.classList.contains('on'),'pausa bloqueia tooltip');
});

ok('4. tipShow NÃO exibe com #codex aberto',()=>{
  closeAllModals();byId('codex').classList.add('on');
  const tip=byId('tip');tip.classList.remove('on');
  t.tipShow('<b>X</b>',{clientX:1,clientY:1},byId('anyEl'));
  assert.ok(!tip.classList.contains('on'),'codex bloqueia tooltip');
});

ok('5. tipShow NÃO exibe com #sheet/#sandboxp/#endwrap abertos',()=>{
  for(const id of ['sheet','sandboxp','endwrap']){
    closeAllModals();byId(id).classList.add('on');
    const tip=byId('tip');tip.classList.remove('on');
    t.tipShow('<b>X</b>',{clientX:1,clientY:1},byId('anyEl'));
    assert.ok(!tip.classList.contains('on'),id+' bloqueia tooltip');
  }
});

ok('6. #modal aberto bloqueia tooltip de elemento QUE NÃO pertence ao modal (vazamento)',()=>{
  closeAllModals();
  const modal=byId('modal');modal.classList.add('on');
  const outside=makeEl('cardDeTras'); // não é filho do modal
  const tip=byId('tip');tip.classList.remove('on');
  t.tipShow('CONTRATO DE USURA',{clientX:1,clientY:1},outside);
  assert.ok(!tip.classList.contains('on'),'card removido/de trás não vaza sobre o modal');
});

ok('7. #modal aberto PERMITE tooltip de elemento DENTRO do modal (Loja Temporal)',()=>{
  closeAllModals();
  const modal=byId('modal');modal.classList.add('on');
  const inside=makeEl('eqCard');modal.appendChild(inside); // filho do modal
  const tip=byId('tip');tip.classList.remove('on');
  t.tipShow('NÚCLEO DE CONTENÇÃO',{clientX:1,clientY:1},inside);
  assert.ok(tip.classList.contains('on'),'tooltip da Loja Temporal continua funcionando');
});

ok('8. tooltipBlockedByModal: false sem modal, true com blocker; volta a funcionar ao fechar',()=>{
  closeAllModals();
  assert.strictEqual(t.tooltipBlockedByModal(makeEl('x')),false,'sem modal: livre');
  byId('sheet').classList.add('on');
  assert.strictEqual(t.tooltipBlockedByModal(makeEl('x')),true,'com sheet: bloqueado');
  byId('sheet').classList.remove('on');
  assert.strictEqual(t.tooltipBlockedByModal(makeEl('x')),false,'fechou: livre de novo');
});

ok('9. bindTip liga mouseenter→tipShow(elemento) e mouseleave→tipHide',()=>{
  closeAllModals();
  const el=makeEl('bt');
  t.bindTip(el,()=>'<i>DESC</i>');
  assert.ok(el._handlers.mouseenter&&el._handlers.mouseenter.length===1,'tem mouseenter');
  assert.ok(el._handlers.mouseleave&&el._handlers.mouseleave.length===1,'tem mouseleave');
  assert.ok(el._handlers.mousemove&&el._handlers.mousemove.length===1,'tem mousemove');
  const tip=byId('tip');tip.classList.remove('on');
  el._handlers.mouseenter[0]({clientX:5,clientY:5});
  assert.ok(tip.classList.contains('on'),'mouseenter exibe');
  el._handlers.mouseleave[0]({clientX:5,clientY:5});
  assert.ok(!tip.classList.contains('on'),'mouseleave esconde');
});

ok('10. abrir Loja/Evento esconde tooltip flutuante (hideActiveTooltip no fluxo)',()=>{
  closeAllModals();
  t.setPlayer(fakePlayer());
  const tip=byId('tip');
  tip.classList.add('on');                 // tooltip pendurado da tela anterior
  t.openEvent('survivor');
  assert.ok(!tip.classList.contains('on'),'openEvent limpou o tooltip');
  tip.classList.add('on');
  t.openShop();
  assert.ok(!tip.classList.contains('on'),'openShop limpou o tooltip');
});

/* ================================================================== */
/* B. ECONOMIA DE ⧗ — SEDIMENTO TEMPORAL (11-23)                       */
/* ================================================================== */

function freshRun(){t.setSandboxMode&&t.setSandboxMode(false);t.setSandboxRun(false);
  const fr=t.fracFresh();t.setFracRun(fr);return fr;}

ok('11. fracWaveSediment paga 2 nas ondas 1 e 2',()=>{
  const fr=freshRun();
  t.setWave(1);t.fracWaveSediment(1);
  assert.strictEqual(fr.res,2,'onda 1 = +2');
  const fr2=freshRun();
  t.setWave(2);t.fracWaveSediment(2);
  assert.strictEqual(fr2.res,2,'onda 2 = +2');
});

ok('12. fracWaveSediment paga 1 nas ondas 3, 4 e 5',()=>{
  for(const w of [3,4,5]){
    const fr=freshRun();t.setWave(w);t.fracWaveSediment(w);
    assert.strictEqual(fr.res,1,'onda '+w+' = +1');
  }
});

ok('13. fracWaveSediment paga 0 da onda 6 em diante (taper)',()=>{
  for(const w of [6,7,10,15,20]){
    const fr=freshRun();t.setWave(w);t.fracWaveSediment(w);
    assert.strictEqual(fr.res,0,'onda '+w+' = +0');
  }
});

ok('14. injeção total do sedimento na run inteira = ⧗7 (2+2+1+1+1)',()=>{
  const fr=freshRun();
  let tot=0;
  for(let w=1;w<=20;w++){t.setWave(w);t.fracWaveSediment(w);}
  assert.strictEqual(fr.res,7,'total da run = ⧗7 (front-loaded)');
});

ok('15. idempotente por onda: chamar duas vezes na MESMA onda paga uma só vez',()=>{
  const fr=freshRun();
  t.setWave(2);t.fracWaveSediment(2);t.fracWaveSediment(2);t.fracWaveSediment(2);
  assert.strictEqual(fr.res,2,'não farma reentrando a mesma onda');
});

ok('16. carimbo sedW registra a última onda paga',()=>{
  const fr=freshRun();
  t.setWave(4);t.fracWaveSediment(4);
  assert.strictEqual(fr.sedW,4,'sedW = onda paga');
});

ok('17. anti-reload: com sedW>=w, uma reentrada na mesma onda não paga',()=>{
  const fr=freshRun();fr.sedW=5;
  t.setWave(5);t.fracWaveSediment(5);
  assert.strictEqual(fr.res,0,'save/continue não re-concede o sedimento da onda');
});

ok('18. silenciado no Sandbox (laboratório não injeta economia)',()=>{
  const fr=freshRun();t.setSandboxRun(true);
  t.setWave(1);t.fracWaveSediment(1);
  assert.strictEqual(fr.res,0,'sandbox isolado');
  t.setSandboxRun(false);
});

ok('19. nulo sem fracRun (nunca crasheia)',()=>{
  t.setFracRun(null);
  assert.strictEqual(t.fracWaveSediment(1),0,'sem run = 0, sem erro');
});

ok('20. FRAC_SEDIMENT_MAX_WAVE = 5 (limite do taper documentado no código)',()=>{
  assert.strictEqual(t.FRAC_SEDIMENT_MAX_WAVE,5);
});

ok('21. pack/unpack preserva sedW (idempotência sobrevive ao Continue)',()=>{
  const fr=freshRun();fr.sedW=3;fr.res=9;
  const cp={frac:t.fracRunPack()};
  t.setFracRun(null);
  t.fracRunUnpack(cp);
  const r=t.getFracRun();
  assert.strictEqual(r.sedW,3,'sedW restaurado');
  assert.strictEqual(r.res,9,'saldo restaurado');
});

ok('22. save antigo sem sedW cai em 0 (fallback seguro, sem migration)',()=>{
  t.setFracRun(null);
  t.fracRunUnpack({frac:{res:5}}); // sem sedW
  assert.strictEqual(t.getFracRun().sedW,0,'ausência de sedW → 0');
});

ok('23. sedimento NÃO cria moeda nova: usa addResidues/⧗ e respeita RES_MAX',()=>{
  const fr=freshRun();fr.res=t.RES_MAX-1;
  t.setWave(1);t.fracWaveSediment(1);
  assert.ok(fr.res<=t.RES_MAX,'nunca ultrapassa o teto de ⧗');
  /* CACHE TEMPORAL preservado: +4 permanece a identidade da presença física */
  assert.strictEqual(t.FACTION_PRESENCE_CONSORTIUM_RES,4,'CACHE +4 intacto');
});

/* ================================================================== */
/* C. FALA DE OPERADOR — POOL ANTI-REPETIÇÃO (24-35)                   */
/* ================================================================== */

const OPS=['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant'];

ok('24. OPERATOR_WHISPER virou POOL (array) para cada operador',()=>{
  for(const id of OPS){
    assert.ok(Array.isArray(t.OPERATOR_WHISPER[id]),id+' é array');
    assert.ok(t.OPERATOR_WHISPER[id].length>=2,id+' tem pool >1');
  }
});

ok('25. cada operador tem pool suficiente (>=4) — sem dezenas desnecessárias',()=>{
  for(const id of OPS){
    const n=t.OPERATOR_WHISPER[id].length;
    assert.ok(n>=4&&n<=8,id+' pool dimensionado ('+n+')');
  }
});

ok('26. VECTOR: 1ª linha = assinatura histórica preservada',()=>{
  assert.strictEqual(t.OPERATOR_WHISPER.vector[0],
    '"Estabilidade não é ausência de risco. É escolher qual risco pagar."');
});

ok('27. assinaturas históricas dos demais operadores preservadas na 1ª linha',()=>{
  assert.ok(/Quatro vezes/.test(t.OPERATOR_WHISPER.wraith[0]));
  assert.ok(/placas/.test(t.OPERATOR_WHISPER.bulwark[0]));
  assert.ok(/estopim/.test(t.OPERATOR_WHISPER.pyre[0]));
  assert.ok(/protocolo sugere/i.test(t.OPERATOR_WHISPER.warden[0]));
  assert.ok(/pertenceu/.test(t.OPERATOR_WHISPER.nomad[0]));
  assert.ok(/esquecido/.test(t.OPERATOR_WHISPER.echo0[0]));
  assert.ok(/fome reconhece fome/.test(t.OPERATOR_WHISPER.revenant[0]));
});

ok('28. operatorWhisperLine nunca repete a linha imediatamente anterior',()=>{
  for(const id of OPS){
    let prev=null;
    for(let i=0;i<40;i++){
      const line=t.operatorWhisperLine(id);
      assert.notStrictEqual(line,prev,id+' repetiu a linha na iteração '+i);
      prev=line;
    }
  }
});

ok('29. operatorWhisperLine cobre TODO o pool ao longo das seleções',()=>{
  for(const id of OPS){
    const seen=new Set();
    for(let i=0;i<60;i++)seen.add(t.operatorWhisperLine(id));
    assert.strictEqual(seen.size,t.OPERATOR_WHISPER[id].length,
      id+' visitou todas as '+t.OPERATOR_WHISPER[id].length+' linhas');
  }
});

ok('30. seleção é determinística (não depende de Math.random)',()=>{
  /* duas instâncias frescas do jogo produzem a MESMA sequência */
  const A=runGame(makeEnv()).t, B=runGame(makeEnv()).t;
  const sa=[],sb=[];
  for(let i=0;i<12;i++){sa.push(A.operatorWhisperLine('vector'));sb.push(B.operatorWhisperLine('vector'));}
  assert.deepStrictEqual(sa,sb,'sequência determinística entre execuções');
});

ok('31. código do pool NÃO usa Math.random na seleção da fala',()=>{
  const seg=html.slice(html.indexOf('const _opWhisperMem'),html.indexOf('function operatorWhisperHTML'));
  assert.ok(seg.indexOf('Math.random')<0,'anti-repeat não consome RNG do Director');
});

ok('32. operatorWhisperHTML devolve HTML com nome do operador selecionado',()=>{
  t.setCharSel(0);
  const h=t.operatorWhisperHTML();
  assert.ok(typeof h==='string'&&h.indexOf('<span')>=0,'html válido');
  assert.ok(stripTags(h).indexOf('·')>=0,'inclui separador nome · fala');
});

ok('33. operatorWhisperHTML muda conforme o operador selecionado',()=>{
  const seen=new Set();
  for(let i=0;i<t.CHARS.length;i++){t.setCharSel(i);seen.add(stripTags(t.operatorWhisperHTML()));}
  assert.ok(seen.size>=2,'operadores diferentes falam diferente');
});

ok('34. contador é limitado (não cresce indefinidamente)',()=>{
  /* muitas seleções não devem lançar nem produzir índice inválido */
  for(let i=0;i<5000;i++){const l=t.operatorWhisperLine('vector');assert.ok(typeof l==='string'&&l.length>0);}
});

ok('35. é fala de OPERADOR (não de Echo): não referencia trust/Echo (B4 não antecipado)',()=>{
  const seg=html.slice(html.indexOf('const OPERATOR_WHISPER='),html.indexOf('const _opWhisperMem'));
  assert.ok(!/changeEchoTrust|e\.trust|echoReact/.test(seg),'pool não mistura reação de Echo');
});

/* ================================================================== */
/* D. REGRESSÕES (36-52)                                               */
/* ================================================================== */

ok('36. ECHO_VERSION = 0.8.0-alpha',()=>{assert.strictEqual(t.ECHO_VERSION,'0.8.0-alpha');});
ok('37. SM_VERSION = 3 (sem migration)',()=>{assert.strictEqual(t.SM_VERSION,3);});
ok('38. FRACTURE_STATE_VERSION = 1',()=>{assert.strictEqual(t.FRACTURE_STATE_VERSION,1);});
ok('39. 12 FACTION_RUN_EVENTS',()=>{assert.strictEqual(t.FACTION_RUN_EVENTS.length,12);});
ok('40. 4 FRAC_CONTACT_EVENTS',()=>{assert.strictEqual(t.FRAC_CONTACT_EVENTS.length,4);});
ok('41. presença física só ÂNCORA e CONSÓRCIO',()=>{
  /* cross-realm: comparar por conteúdo (não reference-equal entre VMs) */
  assert.strictEqual(t.FACTION_PRESENCE_PHYSICAL.slice().sort().join(','),'anchor,consortium');
});
ok('42. fpIsPhysical coerente (anchor/consortium sim; remnants/deviants não)',()=>{
  assert.ok(t.fpIsPhysical('anchor')&&t.fpIsPhysical('consortium'));
  assert.ok(!t.fpIsPhysical('remnants')&&!t.fpIsPhysical('deviants'));
});
ok('43. FACTION_PRESENCE_ACTIVE_CAP = 1 mantido',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_ACTIVE_CAP,1);
});
ok('44. addResidues arredonda, clampa e nunca fica negativo',()=>{
  const fr=freshRun();fr.res=0;
  t.addResidues(3.6,'teste');
  assert.strictEqual(fr.res,4,'arredonda 3.6→4');
  t.addResidues(-999,'teste');
  assert.ok(fr.res>=0,'nunca negativo');
});
ok('45. spendResidues falha sem gastar quando saldo insuficiente',()=>{
  const fr=freshRun();fr.res=2;
  const okSpend=t.spendResidues(5,'teste');
  assert.strictEqual(okSpend,false,'gasto recusado');
  assert.strictEqual(fr.res,2,'saldo intacto após recusa');
});
ok('46. spendResidues gasta quando há saldo',()=>{
  const fr=freshRun();fr.res=10;
  assert.strictEqual(t.spendResidues(4,'teste'),true);
  assert.strictEqual(fr.res,6,'saldo debitado');
});
ok('47. fracRes/getResidues refletem o saldo da run',()=>{
  const fr=freshRun();fr.res=13;
  assert.strictEqual(t.fracRes(),13);
  assert.strictEqual(t.getResidues(),13);
});
ok('48. RES_MAX intacto (9999) — sedimento não altera teto',()=>{
  assert.strictEqual(t.RES_MAX,9999);
});
ok('49. sedimento coexiste com ganhos reais sem duplicar recompensa',()=>{
  const fr=freshRun();
  t.setWave(1);t.fracWaveSediment(1); // +2
  t.addResidues(3,'mini_boss');        // fonte real
  t.fracWaveSediment(1);               // mesma onda: não paga de novo
  assert.strictEqual(fr.res,5,'2 (sedimento) + 3 (miniboss), sem re-pagar');
});
ok('50. TOOLTIP_BLOCKERS lista os modais de tela cheia (não inclui #modal)',()=>{
  assert.ok(t.TOOLTIP_BLOCKERS.indexOf('pause-menu')>=0);
  assert.ok(t.TOOLTIP_BLOCKERS.indexOf('codex')>=0);
  assert.ok(t.TOOLTIP_BLOCKERS.indexOf('modal')<0,'#modal é tratado à parte (Loja usa tooltip)');
});
ok('51. Loja Temporal ainda reexibe as abas [OPERADOR|ECHO] (B3-FIX preservado)',()=>{
  const tabs=byId('m-tabs');tabs.style.display='none';
  t.renderShop();
  assert.strictEqual(tabs.style.display,'flex','abas da loja preservadas');
});
ok('52. fluxo loja→evento→loja mantém tooltip saudável e abas corretas',()=>{
  closeAllModals();t.setPlayer(fakePlayer());
  t.openShop();
  assert.strictEqual(byId('m-tabs').style.display,'flex','loja mostra abas');
  const tip=byId('tip');tip.classList.add('on');
  t.openEvent('rift');
  assert.strictEqual(byId('m-tabs').style.display,'none','evento esconde abas');
  assert.ok(!tip.classList.contains('on'),'tooltip morto ao entrar no evento');
  t.openShop();
  assert.strictEqual(byId('m-tabs').style.display,'flex','loja reexibe abas ao voltar');
});

console.log('\nResultado: '+pass+' passaram · '+fail+' falharam');
if(fail>0)process.exit(1);
