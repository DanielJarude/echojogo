'use strict';
/* =====================================================================
   TESTES — PR 10.5B: FINAIS DINÂMICOS (BASE + VARIANTE + EPÍLOGO)
   ---------------------------------------------------------------------
   · registro: 7 bases (3 originais preservadas + 4 novas), variantes,
     epílogos de acontecimentos com prioridade e teto de 2
   · contexto determinístico: mesmo estado → mesmo snapshot (sem Math.random)
   · candidatos: prioridades (conflito 100 · silêncio 90 · exílio 80 ·
     refúgio 68 · dueto 65 · liber/tirano 50 · empate 10)
   · finais originais preservados: luz>treva→liber · treva>luz→tirano ·
     conflito→eterno · empate→eterno
   · final BASE nunca depende de evento RNG — só do estado da run;
     eventos entram como VARIANTE e EPÍLOGO
   · integração real: onVictory registra base em meta.endings, variante
     em meta.evars e monta victoryData; showVictory renderiza subtítulo
     + epílogos sem quebrar
   · semântica preservada: Ressonante≠melhor, Fraturada≠pior, compaixão
     ≠bom, violência≠ruim — finais são consequência, não nota moral
   Executa o script REAL de index.html em sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/endings.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];
const RAWSRC=m[1];

src+=';globalThis.__t={'+
  'ENDINGS,ENDING_VARIANTS,EV_EPILOGUES,'+
  'buildEndingContext,evaluateEndingCandidates,pickEndingVariant,'+
  'collectEndingEpilogues,pickEnding,resolveEnding,'+
  'onVictory,showVictory,'+
  'getVictoryData:()=>victoryData,getMeta:()=>meta,'+
  'startRun,makeEcho,echoRelState,echoAllied,'+
  'getMoral:()=>moral,setMoral:(c,g,v)=>{moral.comp=c;moral.greed=g;moral.viol=v;applyMoral();},'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getEchoes:()=>echoes,setEchoes:a=>{echoes=a;},'+
  'getWave:()=>wave,setWave:w=>{wave=w;},'+
  'getEnemies:()=>enemies,setEnemies:a=>{enemies=a;},'+
  'getEvMem:()=>evMem,evSetFlag,evFlag,evEpilogue,clearDevTaint:()=>{devTainted=false;}};';

/* ---------------- DOM mínimo (igual aos outros harnesses) ---------------- */
function makeStyle(){
  const store={};
  return new Proxy(store,{
    get(t,k){return k in t?t[k]:'';},
    set(t,k,v){t[k]=String(v);return true;}
  });
}
function ctx2d(){
  const grad={addColorStop(){}};
  const numProps=new Set(['globalAlpha','lineWidth','shadowBlur','font','fillStyle',
    'strokeStyle','lineCap','textAlign','imageSmoothingEnabled']);
  return new Proxy({},{get(t,k){
    if(k==='canvas')return{width:0,height:0};
    if(k==='measureText')return()=>({width:0});
    if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')
      return()=>grad;
    if(numProps.has(k))return 1;
    return()=>{};
  },set(){return true;}});
}
function makeEl(id){
  const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,
    _cls:new Set(),_handlers:{},isConnected:true,offsetWidth:0,offsetHeight:0,
    textContent:'',innerHTML:'',className:'',title:'',style:makeStyle()};
  el.classList={
    add:(...c)=>c.forEach(x=>el._cls.add(x)),
    remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
    contains:c=>el._cls.has(c),
    toggle:(c,f)=>{if(f===undefined){if(el._cls.has(c)){el._cls.delete(c);return false;}
      el._cls.add(c);return true;}
      if(f)el._cls.add(c);else el._cls.delete(c);return !!f;}
  };
  el.appendChild=c=>{el.children.push(c);return c;};
  el.remove=()=>{};
  el.addEventListener=(ev,fn)=>{(el._handlers[ev]=el._handlers[ev]||[]).push(fn);};
  el.removeEventListener=()=>{};
  el.click=()=>{for(const fn of (el._handlers.click||[]))fn({stopPropagation(){}});};
  el.querySelector=()=>null;el.querySelectorAll=()=>[];
  el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};
  el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];
  el.getContext=()=>ctx2d();
  return el;
}
const elements=new Map();
const document={
  hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
  fullscreenElement:null,webkitFullscreenElement:null,
  createElement:()=>makeEl(''),
  getElementById:id=>{if(!elements.has(id))elements.set(id,makeEl(id));
    return elements.get(id);},
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
const localStorage={_d:{},getItem(k){return this._d[k]||null;},
  setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
const navigator={getGamepads:()=>[]};

const sandbox={console,Math,Date,parseInt,parseFloat,isNaN,setTimeout,clearTimeout,
  requestAnimationFrame:()=>0,
  Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
  Promise,Proxy,Reflect,JSON,Symbol,
  document,window,localStorage,navigator,
  performance:{now:()=>Date.now()}};
const ctx=vm.createContext(sandbox);
vm.runInContext(src,ctx,{timeout:15000});
const t=vm.runInContext('__t',ctx);

/* ---------------- runner ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  \u2714 '+label);}
  catch(e){failed++;console.log('  \u2716 '+label);console.log('     '+e.message);}
}
function freshRun(){
  t.setPlayer(null);
  t.setEchoes([]);
  t.getEvMem()&&t.getEvMem().ep&&(t.getEvMem().ep.length=0);
  t.startRun();
  t.clearDevTaint();
}
/* Eco aliado rápido: makeEcho(data,slot) + ajuste de confiança */
function liveEcho(slot,trust){
  const e=t.makeEcho({dom:'comp',items:[],trail:[[0,0,1,0,0,0]]},slot);
  e.alive=true;e.trust=trust;
  return e;
}

console.log('TESTES PR 10.5B — FINAIS DINÂMICOS (BASE + VARIANTE + EPÍLOGO)');
console.log('---------------------------------------------');

/* ==================== A. REGISTRO ==================== */
console.log('\n[A] REGISTRO');
ok('7 finais base: 3 originais preservados + 4 novos',()=>{
  for(const k of ['liber','tirano','eterno'])
    assert(t.ENDINGS[k],'final original sumiu: '+k);
  for(const k of ['silencio','exilio','dueto','refugio'])
    assert(t.ENDINGS[k],'final novo ausente: '+k);
  assert.strictEqual(Object.keys(t.ENDINGS).length,7,
    'pool de finais mudou de tamanho: '+Object.keys(t.ENDINGS).length);
});
ok('todo final tem título, cor e texto (render não quebra)',()=>{
  for(const [k,E] of Object.entries(t.ENDINGS)){
    assert(E.t&&E.c&&E.f,'final incompleto: '+k);
    assert(typeof E.f==='string'&&E.f.length>80,'texto raso demais: '+k);
  }
});
ok('ENDING_VARIANTS cobre TODAS as bases, cada uma com fallback when:true',()=>{
  for(const k of Object.keys(t.ENDINGS)){
    const vs=t.ENDING_VARIANTS[k];
    assert(Array.isArray(vs)&&vs.length>=2,'base sem variantes: '+k);
    for(const v of vs)assert(v.id&&v.when&&v.f,'variante incompleta em '+k);
    assert(vs.some(v=>v.when({})===true||v.when({echoCount:0})===true),
      'base sem fallback determinístico: '+k);
  }
});
ok('EV_EPILOGUES: 15+ epílogos, prioridade 4–10, texto próprio',()=>{
  const keys=Object.keys(t.EV_EPILOGUES);
  assert(keys.length>=15,'epílogos: '+keys.length);
  for(const [id,ep] of Object.entries(t.EV_EPILOGUES)){
    assert(ep.pri>=4&&ep.pri<=10,'pri fora da faixa: '+id+'='+ep.pri);
    assert(ep.f&&ep.f.length>30,'texto raso: '+id);
  }
});

/* ==================== B. CONTEXTO DETERMINÍSTICO ==================== */
console.log('\n[B] CONTEXTO DETERMINÍSTICO');
ok('buildEndingContext devolve o quadro completo da run',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,90),liveEcho(2,55)]);
  t.setMoral(8,1,0);
  t.evSetFlag('dis_houve');
  t.evEpilogue('ep_posto');
  t.setWave(20);
  const c=t.buildEndingContext();
  assert.strictEqual(c.echoCount,2);
  assert.strictEqual(c.moral.comp,8);
  assert.strictEqual(c.light,8,'light deve ser o comp da run');
  assert.strictEqual(c.dark,1,'dark deve somar greed+viol');
  assert.strictEqual(c.topRel,'resonant','topRel deveria ser ressonante');
  assert.strictEqual(c.disRuptured,true);
  assert.strictEqual(JSON.stringify(c.epilogues),JSON.stringify(['ep_posto']));
  assert(c.wave===20&&typeof c.kills==='number');
  assert(c.echoes.every(e=>e.slot&&typeof e.trust==='number'&&e.rel));
});
ok('mesmo estado → mesmo snapshot (determinismo, sem Math.random)',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,72)]);
  t.setMoral(3,5,2);
  const a=JSON.stringify(t.buildEndingContext());
  const b=JSON.stringify(t.buildEndingContext());
  assert.strictEqual(a,b,'snapshot instável entre chamadas');
});

/* ==================== C. CANDIDATOS E PRIORIDADES ==================== */
console.log('\n[C] CANDIDATOS E PRIORIDADES');
ok('conflito moral domina (pri 100 → eterno)',()=>{
  freshRun();
  t.setMoral(5,7,0);
  const c=t.buildEndingContext();
  assert.strictEqual(c.conflict,true,'conflito não detectado');
  const cand=t.evaluateEndingCandidates(c);
  assert.strictEqual(cand[0].key,'eterno');
  assert(cand[0].pri>=100,'prioridade do conflito mudou');
  assert(cand[0].reasons.some(r=>String(r).indexOf('conflito')>=0));
});
ok('vitória sem Eco → O SILÊNCIO (pri 90)',()=>{
  freshRun();
  t.setMoral(0,0,0);
  const cand=t.evaluateEndingCandidates(t.buildEndingContext());
  assert.strictEqual(cand[0].key,'silencio');
});
ok('ruptura nunca costurada + desconfiança → O EXÍLIO (pri 80)',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,18)]);
  t.setMoral(0,0,0);
  t.evSetFlag('dis_houve');
  const c=t.buildEndingContext();
  assert.strictEqual(c.broken,true,'trust 18 deveria marcar broken');
  assert.strictEqual(c.disRuptured,true);
  assert.strictEqual(c.disReconciled,false);
  const cand=t.evaluateEndingCandidates(c);
  assert.strictEqual(cand[0].key,'exilio');
});
ok('reconciliado NÃO gera exílio (a costura conta)',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,60)]);
  t.setMoral(0,0,0);
  t.evSetFlag('dis_houve');
  t.evSetFlag('dis_reconciliado');
  const cand=t.evaluateEndingCandidates(t.buildEndingContext());
  assert(!cand.some(x=>x.key==='exilio'),
    'exílio apareceu com ruptura reconciliada');
});
ok('refúgio (68) vence dueto (65) quando ambos se aplicam',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,80),liveEcho(2,78)]);
  t.setMoral(8,0,0);
  const cand=t.evaluateEndingCandidates(t.buildEndingContext());
  assert.strictEqual(cand[0].key,'refugio');
  assert(cand.some(x=>x.key==='dueto'),'dueto deveria ser candidato');
  assert(cand[0].pri>cand.find(x=>x.key==='dueto').pri,'ordem 68/65 invertida');
});
ok('dueto: 2 Ecos sincronizados, sem treva dominante → 65',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,82),liveEcho(2,76)]);
  t.setMoral(4,2,2);
  const cand=t.evaluateEndingCandidates(t.buildEndingContext());
  assert.strictEqual(cand[0].key,'dueto',
    'esperado dueto, veio '+cand.map(x=>x.key+':'+x.pri).join(','));
});
ok('liber (50) e tirano (50) só sem conflito; candidato sempre presente no empate',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,50)]);
  t.setMoral(10,2,0);
  let cand=t.evaluateEndingCandidates(t.buildEndingContext());
  assert.strictEqual(cand[0].key,'liber');
  assert(!cand.some(x=>x.key==='eterno'),'eterno sem conflito/empate?');
  t.setMoral(2,8,2);
  cand=t.evaluateEndingCandidates(t.buildEndingContext());
  assert.strictEqual(cand[0].key,'tirano');
  t.setMoral(0,0,0);              // luz===treva → empate → eterno pri 10
  cand=t.evaluateEndingCandidates(t.buildEndingContext());
  const et=cand.find(x=>x.key==='eterno');
  assert(et&&et.pri===10,'empate puro deveria render eterno pri 10');
});
ok('candidatos vêm ordenados por prioridade descendente',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,80),liveEcho(2,78)]);
  t.setMoral(8,1,0);
  const cand=t.evaluateEndingCandidates(t.buildEndingContext());
  for(let i=1;i<cand.length;i++)
    assert(cand[i-1].pri>=cand[i].pri,'fora de ordem em '+i);
});

/* ==================== D. FINAIS ORIGINAIS PRESERVADOS ==================== */
console.log('\n[D] FINAIS ORIGINAIS PRESERVADOS');
ok('condições históricas mapeiam para os mesmos finais de sempre',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,50)]);
  t.setMoral(12,0,0);
  assert.strictEqual(t.pickEnding(t.buildEndingContext()),'liber');
  t.setMoral(0,12,0);
  assert.strictEqual(t.pickEnding(t.buildEndingContext()),'tirano');
  t.setMoral(5,7,0);
  assert.strictEqual(t.pickEnding(t.buildEndingContext()),'eterno');
  t.setMoral(0,0,0);
  /* empate puro SEM Eco cai no silêncio (90) — o eterno de empate só vence
     quando é o único candidato; conferimos que empate COM Eco → eterno */
  assert.strictEqual(t.pickEnding(t.buildEndingContext()),'eterno');
});
ok('pickEnding tem fallback seguro (nunca undefined)',()=>{
  freshRun();
  const k=t.pickEnding(t.buildEndingContext());
  assert(t.ENDINGS[k],'pickEnding devolveu chave desconhecida: '+k);
});

/* ==================== E. VARIANTES ==================== */
console.log('\n[E] VARIANTES');
ok('liber: coro (2+ Ecos) · par (1 Eco) · único (fallback)',()=>{
  freshRun();
  let c=t.buildEndingContext();t.setEchoes([]);
  c=t.buildEndingContext();
  assert.strictEqual(t.pickEndingVariant(c,'liber'),'unico');
  t.setEchoes([liveEcho(1,70)]);
  c=t.buildEndingContext();
  assert.strictEqual(t.pickEndingVariant(c,'liber'),'par');
  t.setEchoes([liveEcho(1,70),liveEcho(2,66)]);
  c=t.buildEndingContext();
  assert.strictEqual(t.pickEndingVariant(c,'liber'),'coro');
});
ok('tirano: usurpador com ruptura · herdeiro sem',()=>{
  freshRun();
  t.setEchoes([]);
  let c=t.buildEndingContext();
  assert.strictEqual(t.pickEndingVariant(c,'tirano'),'herdeiro');
  t.evSetFlag('dis_houve');
  c=t.buildEndingContext();
  assert.strictEqual(t.pickEndingVariant(c,'tirano'),'usurpador');
});
ok('silêncio: luto quando houve ruptura · novo como doutrina',()=>{
  freshRun();
  t.setEchoes([]);
  let c=t.buildEndingContext();
  assert.strictEqual(t.pickEndingVariant(c,'silencio'),'novo');
  t.evSetFlag('dis_houve');
  c=t.buildEndingContext();
  assert.strictEqual(t.pickEndingVariant(c,'silencio'),'luto');
});
ok('dueto/refúgio reagem a topRel e echoCount',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,90),liveEcho(2,88)]);
  t.setMoral(9,0,0);
  const c=t.buildEndingContext();
  assert.strictEqual(t.pickEndingVariant(c,'refugio'),'porto');   // 2+ Ecos
  assert.strictEqual(t.pickEndingVariant(c,'dueto'),'ressonancia'); // resonant
});
ok('variante é determinística e desconhecida → null',()=>{
  freshRun();
  const c=t.buildEndingContext();
  assert.strictEqual(t.pickEndingVariant(c,'nao_existe'),null);
  assert.strictEqual(t.pickEndingVariant(c,'liber'),t.pickEndingVariant(c,'liber'));
});

/* ==================== F. EPÍLOGOS ==================== */
console.log('\n[F] EPÍLOGOS');
ok('no MÁXIMO 2 epílogos, os de maior prioridade',()=>{
  freshRun();
  t.evEpilogue('ep_posto');       // pri 5
  t.evEpilogue('ep_resposta');    // pri 10
  t.evEpilogue('ep_cirurgia');    // pri 8
  t.evEpilogue('ep_olho');        // pri 9
  const eps=t.collectEndingEpilogues(t.buildEndingContext());
  assert.strictEqual(eps.length,2,'teto de 2 violado: '+eps.length);
  assert.strictEqual(eps[0],'ep_resposta','pri 10 deveria vir primeiro');
  assert.strictEqual(eps[1],'ep_olho','pri 9 deveria ser o segundo');
});
ok('epílogo desconhecido é ignorado sem erro',()=>{
  freshRun();
  t.evEpilogue('ep_fantasma_inexistente');
  t.evEpilogue('ep_pacto');
  const eps=t.collectEndingEpilogues(t.buildEndingContext());
  assert.strictEqual(JSON.stringify(eps),JSON.stringify(['ep_pacto']));
});
ok('sem epílogos → lista vazia, final limpo',()=>{
  freshRun();
  t.getEvMem().ep.length=0;
  assert.strictEqual(JSON.stringify(t.collectEndingEpilogues(t.buildEndingContext())),'[]');
});

/* ==================== G. EVENTO NUNCA BLOQUEIA A BASE ==================== */
console.log('\n[G] BASE NÃO DEPENDE DE EVENTO');
ok('epílogoFlag/flags NÃO criam nem removem candidatos de final base',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,80)]);
  t.setMoral(9,0,0);
  const c0=t.buildEndingContext();
  const n0=t.evaluateEndingCandidates(c0).map(x=>x.key).join('|');
  const k0=t.pickEnding(c0);
  t.evEpilogue('ep_cinzas');t.evEpilogue('ep_pacto');t.evEpilogue('ep_posto');
  t.evSetFlag('posto_minado');t.evSetFlag('sinal_rastreado');
  const c1=t.buildEndingContext();
  const n1=t.evaluateEndingCandidates(c1).map(x=>x.key).join('|');
  assert.strictEqual(k0,t.pickEnding(c1),
    'evento mudou o FINAL BASE (só variante/epílogo podem mudar)');
  assert.strictEqual(n0.split('liber').length,n1.split('liber').length,
    'conjunto de candidatos base alterado por flag de evento');
});
ok('resolveEnding: base + variante + epílogos coerentes e determinísticos',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,82),liveEcho(2,78)]);
  t.setMoral(8,1,0);
  t.evEpilogue('ep_pacto');t.evEpilogue('ep_posto');
  const a=t.resolveEnding(),b=t.resolveEnding();
  assert.strictEqual(JSON.stringify(a),JSON.stringify(b),'resolveEnding instável');
  assert.strictEqual(a.key,a.candidates[0].key,'base diverge do candidato topo');
  assert(a.variant,'variante ausente');
  assert(t.ENDING_VARIANTS[a.key].some(v=>v.id===a.variant),
    'variante não pertence à base');
  assert(a.epilogues.length<=2,'teto de epílogos violado');
  for(const id of a.epilogues)assert(t.EV_EPILOGUES[id],'epílogo desconhecido');
  assert(a.candidates[0].reasons.length>0,'motivos ausentes no candidato topo');
});

/* ==================== H. AUDITORIA ESTÁTICA ==================== */
console.log('\n[H] AUDITORIA DA FONTE');
ok('NENHUM Math.random entre buildEndingContext e resolveEnding',()=>{
  const i=RAWSRC.indexOf('function buildEndingContext');
  const j=RAWSRC.indexOf('function onVictory');
  assert(i>0&&j>i,'bloco de finais não encontrado na fonte');
  const block=RAWSRC.slice(i,j);
  assert(block.indexOf('Math.random')<0,
    'decisão de final usa Math.random — quebra o determinismo (§99)');
});
ok('onVictory usa resolveEnding real e registra base+variante na meta',()=>{
  const i=RAWSRC.indexOf('function onVictory');
  const j=RAWSRC.indexOf('function showVictory');
  const block=RAWSRC.slice(i,j);
  assert(block.indexOf('resolveEnding()')>=0,'onVictory não chama resolveEnding');
  assert(block.indexOf('meta.endings')>=0,'base não registrada em meta.endings');
  assert(block.indexOf('meta.evars')>=0,'variante não registrada em meta.evars');
  assert(block.indexOf('clearActiveRun()')>=0,'vitória deve limpar o run ativo');
});
ok('showVictory renderiza subtítulo de variante + epílogos',()=>{
  const i=RAWSRC.indexOf('function showVictory');
  const j=RAWSRC.indexOf('function die',i);
  const block=RAWSRC.slice(i,j>0?j:i+6000);
  assert(block.indexOf('ENDING_VARIANTS')>=0,'subtítulo de variante ausente');
  assert(block.indexOf('EV_EPILOGUES')>=0,'render de epílogos ausente');
});
ok('sem nada de GOOD/BAD/TRUE: nenhum final rotula qualidade moral',()=>{
  for(const [k,E] of Object.entries(t.ENDINGS)){
    const low=(E.t+' '+E.f).toLowerCase();
    for(const w of ['good ending','bad ending','true ending','final bom','final ruim'])
      assert(low.indexOf(w)<0,'final '+k+' usa rótulo simplista: '+w);
  }
});

/* ==================== I. INTEGRAÇÃO REAL (onVictory → meta → tela) ==================== */
console.log('\n[I] INTEGRAÇÃO REAL');
ok('run ressonante+compassiva registra REFÚGIO em meta.endings e a variante em meta.evars',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,82),liveEcho(2,78)]);
  t.setMoral(8,1,0);
  t.setWave(20);
  const meta=t.getMeta();
  meta.endings.length=0;meta.evars.length=0;
  t.onVictory();
  assert(meta.endings.indexOf('refugio')>=0,
    'meta.endings: '+JSON.stringify(meta.endings));
  assert(meta.evars.some(v=>v.indexOf('refugio.')===0),
    'meta.evars sem sub-registro de variante: '+JSON.stringify(meta.evars));
  const v=t.getVictoryData();
  assert(v&&v.key==='refugio','victoryData.key: '+(v&&v.key));
  assert(v.variant,'victoryData sem variante');
  assert(Array.isArray(v.reasons)&&v.reasons.length>0,'victoryData sem motivos');
  assert(Array.isArray(v.rels)&&v.rels.length===2,'victoryData sem relações');
  assert(v.dis&&v.dis.ruptured===false,'victoryData sem estado de Dissonância');
});
ok('showVictory não quebra com variante + epílogos no DOM mínimo',()=>{
  t.evEpilogue('ep_pacto');
  t.onVictory();
  t.showVictory();   // render direto: título, subtítulo da variante e epílogos
  const flav=elements.get('e-flavor').innerHTML;
  assert(flav.length>0,'e-flavor vazio');
});
ok('run tirânica com Eco ressonante continua TIRANO — relação alta não salva',()=>{
  freshRun();
  t.setEchoes([liveEcho(1,85)]);
  t.setMoral(0,12,0);
  const meta=t.getMeta();
  meta.endings.length=0;meta.evars.length=0;
  t.onVictory();
  assert(meta.endings.indexOf('tirano')>=0,
    'treva dominante deveria continuar tirano: '+JSON.stringify(meta.endings));
});
ok('vitória sem Eco registra SILÊNCIO (final novo alcançável)',()=>{
  freshRun();
  t.setEchoes([]);
  t.setMoral(0,0,0);
  const meta=t.getMeta();
  meta.endings.length=0;meta.evars.length=0;
  t.onVictory();
  assert(meta.endings.indexOf('silencio')>=0,
    'silêncio não registrado: '+JSON.stringify(meta.endings));
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('\nFALHAS DETECTADAS');process.exit(1);}
console.log('PR 10.5B — TODOS OS TESTES PASSARAM');
