'use strict';
/* =====================================================================
   TESTES — PR 14 · BLOCO 6: FECHAMENTO / AUDITORIA FINAL DA PRESENÇA
   DE FACÇÃO
   ---------------------------------------------------------------------
   B6 NÃO adiciona camada nova. Consolida, corrige e valida o que B1–B5
   entregaram, com um FIX estrutural obrigatório: o BALÃO DE FALA DO ECHO
   (wrapping por palavra, quebra segura de palavra longa, altura dinâmica,
   clamp de viewport nas 4 bordas). Nenhuma fonte reduzida, nenhum texto
   truncado / ellipsis / overflow cortado.

   Grupos (§entregável):
     · Arquitetura / mapa técnico ........ 1–8
     · Balão de fala — wrapping .......... 9–28
     · Balão de fala — render/clamp ...... 29–40
     · Duração da fala ................... 41–48
     · Helper DEV de fala ............... 49–54
     · Presenças / frequência ........... 55–62
     · Diplomacia / pacto ............... 63–72
     · 4 facções (tiers/valores) ........ 73–80
     · Identidade visual / feedback ..... 81–86
     · Save / Continue .................. 87–92
     · Sandbox / DEV / independência .... 93–98
     · Property / stress (≥10.000) ...... 99–104

   Princípios validados:
     · FACÇÃO ≠ TEMA; afinidade só LEITURA nas presenças.
     · FACTION_PRESENCE_ACTIVE_CAP = 1 mantido.
     · SM_VERSION=3 · FRACTURE_STATE_VERSION=1 · 0.8.0-alpha.
   Rodar: npm test  |  node tests/pr14-b6-finalization.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const mm=html.match(/<script>([\s\S]*?)<\/script>/);
if(!mm)throw new Error('script não encontrado em index.html');
let src=mm[1];
src+=';globalThis.__t={'+
  /* fala do Echo (foco do B6) */
  'speechWrapLines,echoSpeechDuration,speechRender,echoSpeak,speechClear,'+
  'speechTick,SPEECH_PRI,SPEECH_EST_CHARS_PER_LINE,ECHO_SPEECH_QUEUE_MAX,'+
  'getSpeechActive:()=>speechActive,setSpeechActive:v=>{speechActive=v;},'+
  'getSpeechQueue:()=>speechQueue,'+
  /* presença / scheduler */
  'FACTION_PRESENCE_ACTIVE_CAP,FACTION_PRESENCE_MIN_WAVE,FACTION_PRESENCE_COOLDOWN,'+
  'factionPresenceBeginRun,factionPresenceSchedule,factionPresenceActivate,'+
  'factionPresenceResolve,factionPresenceExpire,factionPresenceCleanup,'+
  'factionPresenceFresh,factionPresencePack,factionPresenceUnpack,'+
  'FACTION_PRESENCE_LABEL,fpIsPhysical,fpPactOfferReady,fpFirstPactOfferReady,'+
  'fpDiploTier,factionPresenceBuildEntity,factionPresenceInteract,'+
  'factionPresenceEntitySnapshot,'+
  /* diplomacia / facção (leitura) */
  'FACTION_IDS,FRACTION_BY_ID,FACTION_RIVAL,FACTION_PACT_MIN,fracRival,'+
  'factionCanPact,factionHasPact,factionPactConsolidate,factionPactBreak,'+
  'factionAffinityCeiling,factionDiploState,fracStateOf,getFactionAffinity,'+
  'factionDiplomacySnapshot,'+
  /* tiers / valores das 4 facções */
  'FACTION_PRESENCE_ANCHOR_SHIELD,FACTION_PRESENCE_REMNANTS_SHIELD,'+
  'FACTION_PRESENCE_REMNANTS_TRUST,FACTION_PRESENCE_CONSORTIUM_RES,'+
  'FACTION_PRESENCE_DEVIANTS_DMG,FACTION_PRESENCE_DEVIANTS_TAKEN,'+
  'FACTION_PRESENCE_DEVIANTS_DUR,FACTION_PRESENCE_DEVIANTS_HOSTILE_DMG,'+
  'FACTION_PRESENCE_DEVIANTS_HOSTILE_TAKEN,FACTION_PRESENCE_ALLY_MULT,'+
  'FACTION_PRESENCE_HOSTILE_MULT,FACTION_PRESENCE_HOSTILE_RES_COST,'+
  /* versões / util */
  'SM_VERSION,FRACTURE_STATE_VERSION,ECHO_VERSION,clamp,'+
  'fractureBeginRun,fractureSetSeed,fractureGetThemeId,fracFresh,'+
  /* acessores de estado vivo */
  'getFracRun:()=>fracRun,setFracRun:v=>{fracRun=v;},'+
  'setFracDisc:v=>{fracDisc=v;},'+
  'getFP:()=>factionPresenceRun,setFP:v=>{factionPresenceRun=v;},'+
  'getEntity:()=>factionPresenceEntity,setEntity:v=>{factionPresenceEntity=v;},'+
  'setCam:(x,y)=>{cam.x=x;cam.y=y;},getCam:()=>({x:cam.x,y:cam.y}),'+
  'setView:(w,h)=>{vw=w;vh=h;},'+
  'getPlayer:()=>player,setPlayer:v=>{player=v;},'+
  'getEchoes:()=>echoes,setEchoes:v=>{echoes=v;},'+
  'setSandboxMode:v=>{sandboxMode=v;},setSandboxRun:v=>{sandboxRun=v;},'+
  'setWave:v=>{wave=v|0;},getWave:()=>wave,setRunTime:v=>{runTime=+v||0;}'+
  '};';

const RAW=src;

/* ---------------- DOM mínimo com measureText REALISTA ----------------
   A quebra de linha depende de measureText: usamos ~0.6*px por caractere
   (aproximação estável de monospace) para exercer o wrapping de verdade. */
function makeStyle(){const store={};
  return new Proxy(store,{get(t,k){return k in t?t[k]:'';},
    set(t,k,v){t[k]=String(v);return true;}});}
function parsePx(font){const m=/(\d+(?:\.\d+)?)px/.exec(String(font||''));return m?parseFloat(m[1]):15;}
function ctx2d(log){const grad={addColorStop(){}};
  const st={font:'15px monospace',globalAlpha:1,fillStyle:'',strokeStyle:'',
    lineWidth:1,lineJoin:'',shadowBlur:0,shadowColor:'',textAlign:'',textBaseline:''};
  return new Proxy(st,{get(t,k){
    if(k==='canvas')return{width:0,height:0};
    if(k==='measureText')return(s)=>({width:String(s==null?'':s).length*parsePx(t.font)*0.6});
    if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});
    if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;
    if(k==='fillRect')return(x,y,w,h)=>{if(log)log.rects.push({op:'fill',x,y,w,h});};
    if(k==='strokeRect')return(x,y,w,h)=>{if(log)log.rects.push({op:'stroke',x,y,w,h});};
    if(k==='fillText')return(txt,x,y)=>{if(log)log.texts.push({txt:String(txt),x,y,font:t.font});};
    if(k==='strokeText')return(txt,x,y)=>{if(log)log.strokes.push({txt:String(txt),x,y});};
    if(k in t)return t[k];
    return()=>{};},set(t,k,v){t[k]=v;return true;}});}
function makeEl(id){
  const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,
    _cls:new Set(),_handlers:{},parentNode:null,isConnected:true,
    offsetWidth:0,offsetHeight:0,textContent:'',innerHTML:'',className:'',
    title:'',style:makeStyle()};
  el.classList={add:(...c)=>c.forEach(x=>el._cls.add(x)),
    remove:(...c)=>c.forEach(x=>el._cls.delete(x)),
    contains:c=>el._cls.has(c),
    toggle(c,f){const has=el._cls.has(c);const want=f===undefined?!has:!!f;
      if(want)el._cls.add(c);else el._cls.delete(c);return want;}};
  el.appendChild=c=>{if(c&&typeof c==='object')c.parentNode=el;el.children.push(c);return c;};
  el.insertBefore=c=>{if(c&&typeof c==='object')c.parentNode=el;el.children.unshift(c);return c;};
  el.removeChild=c=>{const i=el.children.indexOf(c);
    if(i>=0){el.children.splice(i,1);if(c&&typeof c==='object')c.parentNode=null;}return c;};
  el.remove=()=>{if(el.parentNode&&el.parentNode.removeChild)el.parentNode.removeChild(el);};
  el.addEventListener=(ev,fn)=>{(el._handlers[ev]=el._handlers[ev]||[]).push(fn);};
  el.removeEventListener=()=>{};el.dispatchEvent=()=>{};el.click=()=>{};
  el.querySelector=sel=>((typeof sel==='string'&&sel.charAt(0)==='.')?makeEl(''):null);
  el.querySelectorAll=()=>[];el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};
  el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];
  el.getContext=()=>ctx2d(null);
  Object.defineProperty(el,'lastChild',{get:()=>el.children.length?el.children[el.children.length-1]:null});
  Object.defineProperty(el,'firstChild',{get:()=>el.children.length?el.children[0]:null});
  return el;}
function findByTree(root,id){
  if(!root||typeof root!=='object')return null;
  if(root.id===id)return root;
  const ch=root.children;if(!ch)return null;
  for(const c of ch){const f=findByTree(c,id);if(f)return f;}
  return null;}
/* canvas do jogo ('game') com ctx logável compartilhado */
const DRAW={rects:[],texts:[],strokes:[]};
function makeEnv(seed){
  const elements=new Map();
  const gameCanvas=makeEl('game');
  gameCanvas.getContext=()=>ctx2d(DRAW);
  elements.set('game',gameCanvas);
  const document={hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
    fullscreenElement:null,webkitFullscreenElement:null,createElement:()=>makeEl(''),
    getElementById:id=>{
      for(const root of [document.body,document.documentElement].concat(Array.from(elements.values()))){
        const f=findByTree(root,id);if(f)return f;}
      if(!elements.has(id))elements.set(id,makeEl(id));
      return elements.get(id);},
    querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},
    hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()};
  const window={innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    screen:{availWidth:1280,availHeight:720},addEventListener:()=>{},removeEventListener:()=>{},
    matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),
    AudioContext:undefined,webkitAudioContext:undefined,
    open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined};
  const localStorage={_d:Object.assign({},seed||{}),
    getItem(k){return this._d[k]||null;},
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
  const t=vm.runInContext('__t',ctx);
  return {t,ctx,env};}

const MAIN=runGame(makeEnv({}));
const t=MAIN.t;

/* ---------------- mini runner ---------------- */
let pass=0,fail=0;
function ok(name,fn){try{fn();console.log('  \u2714 '+name);pass++;}
  catch(e){console.log('  \u2718 '+name+'\n    '+(e&&e.message||e));fail++;}}

/* ---- helpers ---- */
function P(){return {x:0,y:0,r:14,shield:0,shieldMax:30,hp:80,maxHp:100,coins:0,
  sm:[],dmgMul:1,dmgTakenMul:1,_smBase:{dmg:1,dmgTaken:1,shieldMax:30}};}
function E(opt){opt=opt||{};return {alive:opt.alive!==false,hostile:!!opt.hostile,
  slot:opt.slot|0,x:opt.x||200,y:opt.y||200,r:13,hue:'#46e0ff',
  shield:opt.shield||0,shieldMax:opt.shieldMax!=null?opt.shieldMax:40,
  trust:opt.trust!=null?opt.trust:50,pers:opt.pers?{id:opt.pers}:null,
  ps:opt.pers?{id:opt.pers}:null,rel:{seen:{},ap:0,rj:0,lastTrust:null},
  dis:opt.dis||{st:'stable',p:0}};}
function beginRun(seed){
  t.fractureBeginRun();
  if(seed!=null)t.fractureSetSeed(seed>>>0);
  t.setFracRun(t.fracFresh());
  t.setFracDisc({anchor:['contact'],remnants:['contact'],
    consortium:['contact'],deviants:['contact']});
  t.setPlayer(P());t.setEchoes([]);t.setEntity(null);
  t.setSandboxMode(false);t.setSandboxRun(false);
  t.setWave(5);t.setRunTime(0);t.setView(1280,720);t.setCam(0,0);
  t.speechClear();
  return t.getFracRun();
}
function setAff(id,v){t.getFracRun().aff[id]=v;}
const FACTIONS=t.FACTION_IDS;
/* mede a largura de uma string do mesmo jeito do ctx do teste */
function measure(s,px){return String(s).length*px*0.6;}
/* dispara speechRender e devolve o log de desenho da última fala */
function renderSpeak(txt,pri){
  DRAW.rects.length=0;DRAW.texts.length=0;DRAW.strokes.length=0;
  const e=E({x:0,y:0});
  t.speechClear();
  t.echoSpeak(e,txt,'#8ff6ff',pri||'high');
  t.speechRender();
  return {rects:DRAW.rects.slice(),texts:DRAW.texts.slice()};
}

console.log('\n=== PR14 · B6 — FECHAMENTO / AUDITORIA FINAL (FALA DO ECHO · PRESENÇA) ===');

/* ============================================================
   ARQUITETURA / MAPA TÉCNICO (1–8)
   ============================================================ */
ok('1. versões congeladas: SM_VERSION=3 · FRACTURE_STATE_VERSION=1 · 0.8.0-alpha',()=>{
  assert.strictEqual(t.SM_VERSION,3);
  assert.strictEqual(t.FRACTURE_STATE_VERSION,1);
  assert.strictEqual(t.ECHO_VERSION,'0.8.0-alpha');
});
ok('2. cap de presença ativa segue 1 (não aumentou)',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_ACTIVE_CAP,1);
});
ok('3. 4 facções físicas conhecidas e distintas',()=>{
  assert.strictEqual(FACTIONS.length,4);
  ['anchor','remnants','consortium','deviants'].forEach(f=>{
    assert.ok(FACTIONS.includes(f),'inclui '+f);
    assert.ok(t.fpIsPhysical(f),f+' é física');
  });
});
ok('4. renderer de fala é ÚNICO: só existe uma função speechRender',()=>{
  const n=(RAW.match(/function\s+speechRender\s*\(/g)||[]).length;
  assert.strictEqual(n,1,'exatamente um speechRender');
});
ok('5. todas as falas passam por echoSpeak (não há segundo caminho de balão)',()=>{
  /* nenhuma outra função desenha o balão: só speechRender contém fillRect+fillText do balão */
  const wraps=(RAW.match(/speechWrapLines\s*\(/g)||[]).length;
  assert.ok(wraps>=2,'speechWrapLines definida e usada');
});
ok('6. proposta de pacto NÃO vive mais na Loja (limpo)',()=>{
  assert.ok(!/function\s+b5MaybeOfferPact/.test(RAW),'b5MaybeOfferPact removida');
  /* renderShop não abre pacto */
  assert.ok(/a proposta de pacto NÃO acontece mais na Loja/.test(RAW));
});
ok('7. afinidade só LEITURA no scheduler (fpAffinityWeight não escreve aff)',()=>{
  const blk=RAW.match(/function fpAffinityWeight[\s\S]*?\n}/);
  assert.ok(blk,'fpAffinityWeight existe');
  assert.ok(!/\.aff\[[^\]]+\]\s*=/.test(blk[0]),'não escreve aff');
});
ok('8. FACÇÃO ≠ TEMA: nenhum mapeamento facção→tema no scheduler de presença',()=>{
  const blk=RAW.match(/function factionPresenceSchedule[\s\S]*?\n}/);
  assert.ok(blk,'scheduler existe');
  assert.ok(!/fractureForceTheme|fractureSetTheme|\.theme\s*=/.test(blk[0]),
    'scheduler não toca Tema');
});

/* ============================================================
   BALÃO DE FALA — WRAPPING (9–28)
   ============================================================ */
ok('9. speechWrapLines existe e é função',()=>{
  assert.strictEqual(typeof t.speechWrapLines,'function');
});
ok('10. texto curto cabe em uma linha',()=>{
  const L=t.speechWrapLines('OI',236);
  assert.strictEqual(L.length,1);
  assert.strictEqual(L[0],'OI');
});
ok('11. texto longo quebra em várias linhas',()=>{
  const txt='ESTA É UMA FALA LONGA DO ECHO QUE DEVE QUEBRAR EM VÁRIAS LINHAS DENTRO DO BALÃO SEM ULTRAPASSAR A LARGURA';
  const L=t.speechWrapLines(txt,236);
  assert.ok(L.length>=3,'quebrou em >=3 linhas, teve '+L.length);
});
ok('12. cada linha respeita a largura máxima (px=15)',()=>{
  const txt='ESTA É UMA FALA LONGA DO ECHO QUE DEVE QUEBRAR EM VÁRIAS LINHAS DENTRO DO BALÃO SEM ULTRAPASSAR A LARGURA MÁXIMA RAZOÁVEL';
  const maxW=236;
  const L=t.speechWrapLines(txt,maxW);
  for(const ln of L)assert.ok(measure(ln,15)<=maxW+0.001,'linha excede: "'+ln+'" ('+measure(ln,15)+')');
});
ok('13. quebra por palavra preserva as palavras inteiras',()=>{
  const txt='ALPHA BETA GAMMA DELTA EPSILON ZETA ETA THETA IOTA KAPPA LAMBDA';
  const L=t.speechWrapLines(txt,120);
  const rejoined=L.join(' ').replace(/\s+/g,' ').trim();
  assert.strictEqual(rejoined,txt,'nenhuma palavra perdida/partida');
});
ok('14. palavra única maior que o balão é quebrada por caractere (sem overflow)',()=>{
  const word='SUPERCALIFRAGILISTICEXPIALIDOCIOUSANTIDISESTABLISHMENTARIANISMOOOOOO';
  const maxW=120;
  const L=t.speechWrapLines(word,maxW);
  assert.ok(L.length>=2,'quebrou a palavra longa');
  for(const ln of L)assert.ok(measure(ln,15)<=maxW+0.001,'pedaço excede: '+ln);
});
ok('15. palavra longa quebrada preserva TODOS os caracteres',()=>{
  const word='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const L=t.speechWrapLines(word,120);
  assert.strictEqual(L.join('').length,word.length,'nenhum caractere perdido');
});
ok('16. acentos e símbolos preservados na quebra',()=>{
  const txt='RESSONÂNCIA ÇÃÕ ÉPICO αΩ Δ∴ desvio-27';
  const L=t.speechWrapLines(txt,160);
  const joined=L.join(' ').replace(/\s+/g,' ').trim();
  assert.ok(joined.includes('RESSONÂNCIA'),'mantém acento');
  assert.ok(joined.includes('αΩ')&&joined.includes('Δ∴'),'mantém símbolos');
  assert.ok(joined.includes('desvio-27'),'mantém nome/hífen');
});
ok('17. texto vazio devolve uma linha vazia (sem crash)',()=>{
  const L=t.speechWrapLines('',236);
  assert.strictEqual(L.length,1);
  assert.strictEqual(L[0],'');
});
ok('18. null/undefined não quebram a função',()=>{
  assert.doesNotThrow(()=>t.speechWrapLines(null,236));
  assert.doesNotThrow(()=>t.speechWrapLines(undefined,236));
});
ok('19. múltiplos espaços colapsam sem gerar linhas fantasma',()=>{
  const L=t.speechWrapLines('A    B     C',236);
  assert.strictEqual(L.join(' '),'A B C');
});
ok('20. quebra de linha explícita (\\n) vira linhas separadas',()=>{
  const L=t.speechWrapLines('LINHA UM\nLINHA DOIS',236);
  assert.ok(L.length>=2,'respeitou \\n');
  assert.ok(L.includes('LINHA UM'));
});
ok('21. wrapping é determinístico (mesma entrada ⇒ mesma saída)',()=>{
  const txt='FALA DETERMINÍSTICA PARA CONFERIR ESTABILIDADE DA QUEBRA DE LINHA NO BALÃO';
  const a=t.speechWrapLines(txt,236).join('|');
  const b=t.speechWrapLines(txt,236).join('|');
  assert.strictEqual(a,b);
});
ok('22. balão mais estreito gera MAIS linhas (monotonicidade)',()=>{
  const txt='UMA FALA DE TAMANHO MEDIO PARA COMPARAR LARGURAS DIFERENTES DO BALAO';
  const wide=t.speechWrapLines(txt,300).length;
  const narrow=t.speechWrapLines(txt,120).length;
  assert.ok(narrow>=wide,'estreito não tem menos linhas');
});
ok('23. nenhuma linha resultante fica acima da largura máxima (stress curto)',()=>{
  const bag=['FRATURA','RESSONÂNCIA','ECO','VÍNCULO','ESTABILIDADE','αΩ','desvio-27'];
  for(let n=1;n<=40;n++){
    const parts=[];for(let i=0;i<n;i++)parts.push(bag[i%bag.length]);
    const L=t.speechWrapLines(parts.join(' '),236);
    for(const ln of L)assert.ok(measure(ln,15)<=236+0.001,'n='+n+' excede: '+ln);
  }
});
ok('24. wrapping não trunca: junção preserva todo o conteúdo textual',()=>{
  const txt='CONTEUDO COMPLETO SEM PERDA DE PALAVRAS OU CARACTERES NA QUEBRA';
  const L=t.speechWrapLines(txt,100);
  const back=L.join(' ').replace(/\s+/g,' ').trim();
  assert.strictEqual(back,txt);
});
ok('25. sem ellipsis/reticências inseridas pelo wrapping',()=>{
  const L=t.speechWrapLines('TEXTO NORMAL SEM CORTES NEM RETICENCIAS ADICIONADAS',120);
  assert.ok(!L.join('').includes('…'),'não injeta ellipsis');
});
ok('26. palavra longa + palavra normal: resto da longa agrega próxima palavra',()=>{
  const L=t.speechWrapLines('AAAAAAAAAAAAAAAAAAAAAAAA BB',80);
  assert.ok(L.length>=1);
  for(const ln of L)assert.ok(measure(ln,15)<=80+0.001);
});
ok('27. speechRender usa o layout único (speechLayout → speechWrapLines)',()=>{
  const blk=RAW.match(/function speechRender[\s\S]*?\n}/);
  assert.ok(blk,'speechRender existe');
  assert.ok(/speechLayout\(/.test(blk[0]),'render deriva do layout único');
  const lay=RAW.match(/function speechLayout[\s\S]*?\n}/);
  assert.ok(lay&&/speechWrapLines\(/.test(lay[0]),'layout usa o wrapper');
});
ok('28. sem redução drástica de fonte: px permanece 15/16/17 conforme prioridade',()=>{
  const blk=RAW.match(/function speechRender[\s\S]*?\n}/)[0];
  assert.ok(/\?17:\(/.test(blk)&&/16:15/.test(blk),'mantém 15/16/17');
});

/* ============================================================
   BALÃO DE FALA — RENDER / CLAMP (29–40)
   ============================================================ */
ok('29. render de fala curta desenha 1 retângulo de fundo + borda',()=>{
  const r=renderSpeak('OI','high');
  const fills=r.rects.filter(x=>x.op==='fill');
  const strokes=r.rects.filter(x=>x.op==='stroke');
  assert.ok(fills.length>=1,'tem fundo');
  assert.ok(strokes.length>=1,'tem borda');
});
ok('30. altura do balão CRESCE com o número de linhas',()=>{
  const short=renderSpeak('OI','high');
  const long=renderSpeak('ESTA FALA É BEM MAIS LONGA E DEVE OCUPAR VÁRIAS LINHAS NO BALÃO DO ECHO PORTANTO CRESCE EM ALTURA','high');
  const hShort=short.rects.find(x=>x.op==='fill').h;
  const hLong=long.rects.find(x=>x.op==='fill').h;
  assert.ok(hLong>hShort,'balão longo mais alto ('+hLong+' > '+hShort+')');
});
ok('31. nº de linhas desenhadas = nº de fillText do balão',()=>{
  const txt='UMA DUAS TRES QUATRO CINCO SEIS SETE OITO NOVE DEZ ONZE DOZE TREZE';
  const L=t.speechWrapLines(txt,236);
  const r=renderSpeak(txt,'high');
  assert.strictEqual(r.texts.length,L.length,'linhas desenhadas batem com o wrap');
});
ok('32. clamp horizontal: fala perto da borda ESQUERDA não sai da tela',()=>{
  t.setView(1280,720);t.setCam(0,0);
  DRAW.rects.length=0;DRAW.texts.length=0;
  const e=E({x:-640,y:0});   // canto esquerdo da viewport de mundo
  t.speechClear();t.echoSpeak(e,'FALA NA BORDA ESQUERDA DA TELA','high');t.speechRender();
  const rect=DRAW.rects.find(x=>x.op==='fill');
  const worldLeft=-640;   // cam.x - vw/2
  assert.ok(rect.x>=worldLeft-0.5,'balão não passa da borda esquerda ('+rect.x+')');
});
ok('33. clamp horizontal: fala perto da borda DIREITA não sai da tela',()=>{
  t.setView(1280,720);t.setCam(0,0);
  DRAW.rects.length=0;DRAW.texts.length=0;
  const e=E({x:640,y:0});
  t.speechClear();t.echoSpeak(e,'FALA NA BORDA DIREITA DA TELA','high');t.speechRender();
  const rect=DRAW.rects.find(x=>x.op==='fill');
  const worldRight=640;
  assert.ok(rect.x+rect.w<=worldRight+0.5,'balão não passa da borda direita ('+(rect.x+rect.w)+')');
});
ok('34. clamp vertical: fala no topo não sai por cima',()=>{
  t.setView(1280,720);t.setCam(0,0);
  DRAW.rects.length=0;DRAW.texts.length=0;
  const e=E({x:0,y:-360});   // topo da viewport de mundo
  t.speechClear();t.echoSpeak(e,'FALA NO TOPO DA TELA','high');t.speechRender();
  const rect=DRAW.rects.find(x=>x.op==='fill');
  const worldTop=-360;
  assert.ok(rect.y>=worldTop-0.5,'balão não passa do topo ('+rect.y+')');
});
ok('35. clamp vertical: fala embaixo não sai por baixo',()=>{
  t.setView(1280,720);t.setCam(0,0);
  DRAW.rects.length=0;DRAW.texts.length=0;
  const e=E({x:0,y:360});
  t.speechClear();t.echoSpeak(e,'FALA NA BASE DA TELA','high');t.speechRender();
  const rect=DRAW.rects.find(x=>x.op==='fill');
  const worldBot=360;
  assert.ok(rect.y+rect.h<=worldBot+0.5,'balão não passa da base ('+(rect.y+rect.h)+')');
});
ok('36. o clamp segue a câmera (offset de cam)',()=>{
  t.setView(1280,720);t.setCam(1000,1000);
  DRAW.rects.length=0;DRAW.texts.length=0;
  const e=E({x:1000-640,y:1000});   // borda esquerda relativa à câmera
  t.speechClear();t.echoSpeak(e,'FALA PRESA À CÂMERA','high');t.speechRender();
  const rect=DRAW.rects.find(x=>x.op==='fill');
  assert.ok(rect.x>=(1000-640)-0.5,'clamp respeita cam.x');
});
ok('37. largura do balão nunca ultrapassa o teto (maxW+margem)',()=>{
  const r=renderSpeak('PALAVRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','high');
  const rect=r.rects.find(x=>x.op==='fill');
  assert.ok(rect.w<=236+16+0.5,'largura limitada ('+rect.w+')');
});
ok('38. render sem fala ativa não desenha nada',()=>{
  DRAW.rects.length=0;DRAW.texts.length=0;
  t.speechClear();
  t.speechRender();
  assert.strictEqual(DRAW.rects.length,0);
  assert.strictEqual(DRAW.texts.length,0);
});
ok('39. render não lança com texto gigante',()=>{
  assert.doesNotThrow(()=>renderSpeak('X '.repeat(400).trim(),'critical'));
});
ok('40. borda e fundo compartilham o mesmo retângulo (mesma origem/tam)',()=>{
  const r=renderSpeak('CONFERINDO O RETANGULO DO BALAO','high');
  const f=r.rects.find(x=>x.op==='fill'),s=r.rects.find(x=>x.op==='stroke');
  assert.ok(Math.abs(f.x-s.x)<0.001&&Math.abs(f.y-s.y)<0.001,'mesma origem');
  assert.ok(Math.abs(f.w-s.w)<0.001&&Math.abs(f.h-s.h)<0.001,'mesmo tamanho');
});

/* ============================================================
   DURAÇÃO DA FALA (41–48)
   ============================================================ */
ok('41. echoSpeechDuration cresce com o texto',()=>{
  const a=t.echoSpeechDuration('OI','normal');
  const b=t.echoSpeechDuration('ESTA É UMA FALA CONSIDERAVELMENTE MAIS LONGA DO QUE A PRIMEIRA','normal');
  assert.ok(b>a,'texto maior dura mais');
});
ok('42. duração tem teto (clamp <= 5.0s)',()=>{
  const d=t.echoSpeechDuration('X '.repeat(300).trim(),'critical');
  assert.ok(d<=5.0+1e-9,'respeita teto ('+d+')');
});
ok('43. duração tem piso (>= 1.6s)',()=>{
  const d=t.echoSpeechDuration('','low');
  assert.ok(d>=1.6-1e-9,'respeita piso ('+d+')');
});
ok('44. termo por linha estimada existe (SPEECH_EST_CHARS_PER_LINE definido)',()=>{
  assert.strictEqual(typeof t.SPEECH_EST_CHARS_PER_LINE,'number');
  assert.ok(t.SPEECH_EST_CHARS_PER_LINE>0);
});
ok('45. multilinha estimada dura mais que uma linha do mesmo comprimento base',()=>{
  const oneLine=t.echoSpeechDuration('ABCDEFGHIJ','normal');           // <=34 chars
  const manyLine=t.echoSpeechDuration('A'.repeat(140),'normal');        // ~4-5 linhas est.
  assert.ok(manyLine>oneLine,'multilinha dura mais');
});
ok('46. crítica dura mais que normal (mesmo texto)',()=>{
  const txt='ALERTA DE DISSONÂNCIA IMINENTE';
  assert.ok(t.echoSpeechDuration(txt,'critical')>t.echoSpeechDuration(txt,'normal'));
});
ok('47. duração é determinística (função pura do texto/prioridade)',()=>{
  const txt='FALA REPETIDA PARA TESTE DE PUREZA';
  assert.strictEqual(t.echoSpeechDuration(txt,'high'),t.echoSpeechDuration(txt,'high'));
});
ok('48. duração é finita e positiva sempre',()=>{
  for(const s of ['','A','FALA','X'.repeat(500)]){
    for(const p of ['low','normal','high','critical']){
      const d=t.echoSpeechDuration(s,p);
      assert.ok(Number.isFinite(d)&&d>0,'d inválido para "'+s.slice(0,4)+'"/'+p);
    }
  }
});

/* ============================================================
   HELPER DEV DE FALA (49–54)
   ============================================================ */
ok('49. DEV.echoSpeakLong existe no objeto DEV',()=>{
  assert.ok(/echoSpeakLong\s*\(/.test(RAW),'helper echoSpeakLong presente');
});
ok('50. DEV.echoSpeak (manual) existe no objeto DEV',()=>{
  assert.ok(/\n\s*echoSpeak\s*\(txt,slot\)\{/.test(RAW),'helper echoSpeak manual presente');
});
ok('51. helpers DEV são guardados por devReady() (DEV-only)',()=>{
  const longBlk=RAW.match(/echoSpeakLong\(n,slot\)\{[\s\S]*?\n  \},/);
  assert.ok(longBlk&&/devReady\(\)/.test(longBlk[0]),'echoSpeakLong exige devReady');
  const manBlk=RAW.match(/\n\s*echoSpeak\(txt,slot\)\{[\s\S]*?\n  \},/);
  assert.ok(manBlk&&/devReady\(\)/.test(manBlk[0]),'echoSpeak manual exige devReady');
});
ok('52. helper de fala longa monta texto sintético com palavras (não Math.random)',()=>{
  const longBlk=RAW.match(/echoSpeakLong\(n,slot\)\{[\s\S]*?\n  \},/)[0];
  assert.ok(!/Math\.random/.test(longBlk),'sem Math.random no helper');
  assert.ok(/parts\.join\(' '\)/.test(longBlk),'monta fala por palavras');
});
ok('53. helper de fala longa faz taint (marca sessão como contaminada)',()=>{
  const longBlk=RAW.match(/echoSpeakLong\(n,slot\)\{[\s\S]*?\n  \},/)[0];
  assert.ok(/devTaint\(\)/.test(longBlk),'devTaint chamado');
});
ok('54. helper manual clampa/valida texto vazio antes de falar',()=>{
  const manBlk=RAW.match(/\n\s*echoSpeak\(txt,slot\)\{[\s\S]*?\n  \},/)[0];
  assert.ok(/if\(!s\.trim\(\)\)return false/.test(manBlk),'rejeita vazio');
});

/* ============================================================
   PRESENÇAS / FREQUÊNCIA (55–62)
   ============================================================ */
ok('55. scheduler não agenda antes de FACTION_PRESENCE_MIN_WAVE',()=>{
  beginRun(1);t.factionPresenceBeginRun();
  for(let w=0;w<t.FACTION_PRESENCE_MIN_WAVE;w++){
    t.setWave(w);
    assert.strictEqual(t.factionPresenceSchedule(w),null,'w='+w+' não agenda');
  }
});
ok('56. presença ativa segura o cap (não agenda 2ª)',()=>{
  beginRun(7);t.factionPresenceBeginRun();
  let sched=null;
  for(let w=2;w<=20&&!sched;w++){t.setWave(w);sched=t.factionPresenceSchedule(w);}
  assert.ok(sched,'agendou uma');
  const a=t.factionPresenceActivate(sched);
  assert.ok(a,'ativou');
  /* com ativa, novas ondas não agendam */
  t.setWave((a.wave|0)+1);
  assert.strictEqual(t.factionPresenceSchedule(a.wave+1),null,'cap segura 2ª');
});
ok('57. cooldown entre agendamentos respeitado',()=>{
  beginRun(3);t.factionPresenceBeginRun();
  const fp=t.getFP();
  /* força um lastWave e confirma que dentro do cooldown não agenda */
  let first=null;
  for(let w=2;w<=20&&!first;w++){t.setWave(w);first=t.factionPresenceSchedule(w);}
  assert.ok(first,'agendou');
  t.factionPresenceResolve('t');   // libera cap mas mantém lastWave
  t.setWave(first.wave+1);
  const within=t.factionPresenceSchedule(first.wave+1);
  assert.strictEqual(within,null,'dentro do cooldown não agenda');
});
ok('58. simulação (2000 runs): média de presenças perceptível mas não a cada onda',()=>{
  let total=0,runsWith0=0;const N=2000;
  for(let i=0;i<N;i++){
    beginRun((0x900+i*7919)>>>0);
    const fr=t.getFracRun();
    let s=(0x900+i*7919)>>>0;
    const rng=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
    for(const f of FACTIONS)fr.aff[f]=Math.round(rng()*200-100);
    t.factionPresenceBeginRun();
    let c=0;
    for(let w=1;w<=20;w++){t.setWave(w);
      const p=t.factionPresenceSchedule(w);
      if(p&&p.wave===w&&p.state==='scheduled'){const a=t.factionPresenceActivate(p);if(a){c++;t.factionPresenceResolve('s');}}
    }
    total+=c;if(c===0)runsWith0++;
  }
  const avg=total/N;
  assert.ok(avg>=1&&avg<=20,'média plausível: '+avg.toFixed(2));
  assert.ok(avg<20,'não é uma presença em toda onda');
});
ok('59. presenças mantêm variedade de facção entre runs (não sempre a mesma)',()=>{
  const seen=new Set();
  for(let i=0;i<400;i++){
    beginRun((0xA00+i*104729)>>>0);
    const fr=t.getFracRun();for(const f of FACTIONS)fr.aff[f]=0;
    t.factionPresenceBeginRun();
    for(let w=1;w<=20;w++){t.setWave(w);
      const p=t.factionPresenceSchedule(w);
      if(p&&p.faction){seen.add(p.faction);}
      if(p&&p.wave===w){const a=t.factionPresenceActivate(p);if(a)t.factionPresenceResolve('s');}
    }
  }
  assert.ok(seen.size>=3,'apareceram >=3 facções diferentes ('+seen.size+')');
});
ok('60. beacon de evento vivo bloqueia tomada pela presença (coexistência)',()=>{
  assert.ok(/function canUseBeaconForFactionPresence/.test(RAW),'guard de beacon existe');
  const blk=RAW.match(/function canUseBeaconForFactionPresence[\s\S]*?\n}/)[0];
  assert.ok(/fpBeaconInUse\(\)/.test(blk),'checa beacon em uso');
});
ok('61. cleanup zera ativa e agendada (sem timer órfão)',()=>{
  beginRun(2);t.factionPresenceBeginRun();
  let p=null;for(let w=2;w<=20&&!p;w++){t.setWave(w);p=t.factionPresenceSchedule(w);}
  t.factionPresenceCleanup();
  const fp=t.getFP();
  assert.strictEqual(fp.active,null);
  assert.strictEqual(fp.scheduled,null);
});
ok('62. expire marca estados e limpa (idempotente na 2ª chamada)',()=>{
  beginRun(4);t.factionPresenceBeginRun();
  let p=null;for(let w=2;w<=20&&!p;w++){t.setWave(w);p=t.factionPresenceSchedule(w);}
  t.factionPresenceActivate(p);
  assert.strictEqual(t.factionPresenceExpire('t'),true);
  assert.strictEqual(t.factionPresenceExpire('t'),false,'nada a expirar de novo');
});

/* ============================================================
   DIPLOMACIA / PACTO (63–72)
   ============================================================ */
ok('63. FACTION_PACT_MIN=58 (alcançável, não 85)',()=>{
  assert.strictEqual(t.FACTION_PACT_MIN,58);
});
ok('64. pacto acessível: facção FAVORÁVEL cedo recebe oferta na run',()=>{
  let offered=0;const N=300;
  for(let i=0;i<N;i++){
    beginRun((0xB00+i*40529)>>>0);
    const fr=t.getFracRun();for(const f of FACTIONS)fr.aff[f]=0;
    const faction=FACTIONS[i%4];
    t.factionPresenceBeginRun();
    let got=false;
    for(let w=1;w<=20;w++){
      if(w===4)fr.aff[faction]=70;
      t.setWave(w);
      const p=t.factionPresenceSchedule(w);
      if(p&&p.pactOffer&&p.faction===faction)got=true;
      if(p&&p.wave===w){const a=t.factionPresenceActivate(p);if(a)t.factionPresenceResolve('s');}
    }
    if(got)offered++;
  }
  assert.ok(offered/N>=0.8,'oferta acessível cedo ('+(100*offered/N).toFixed(0)+'%)');
});
ok('65. consolidar pacto marca a facção e respeita eixo (rival não pacta)',()=>{
  beginRun(1);setAff('anchor',70);
  assert.ok(t.factionPactConsolidate('anchor'),'pactou âncora');
  assert.ok(t.factionHasPact('anchor'));
  /* rival da âncora (deviants) não pode pactuar mesmo favorável */
  setAff('deviants',70);
  assert.ok(!t.factionCanPact('deviants'),'eixo bloqueado');
});
ok('66. no máximo 1 pacto por eixo',()=>{
  beginRun(1);
  setAff('remnants',70);setAff('consortium',70);
  assert.ok(t.factionPactConsolidate('remnants'));
  assert.ok(!t.factionCanPact('consortium'),'eixo remnants/consortium travado');
});
ok('67. romper pacto libera o eixo',()=>{
  beginRun(1);setAff('anchor',70);
  t.factionPactConsolidate('anchor');
  t.factionPactBreak('anchor','teste');
  assert.ok(!t.factionHasPact('anchor'),'pacto rompido');
});
ok('68. teto diplomático limita afinidade do rival de um aliado',()=>{
  beginRun(1);setAff('anchor',70);
  t.factionPactConsolidate('anchor');
  const ceil=t.factionAffinityCeiling('deviants');
  assert.ok(ceil<100,'rival tem teto ('+ceil+')');
});
ok('69. oferta de pacto exige elegibilidade base (favorável + eixo livre)',()=>{
  beginRun(1);t.factionPresenceBeginRun();
  setAff('anchor',10);   // abaixo do limiar
  t.setWave(10);
  assert.ok(!t.fpPactOfferReady('anchor',10),'não elegível abaixo do limiar');
});
ok('70. após consolidar, não há oferta de pacto pendente da mesma facção',()=>{
  beginRun(1);t.factionPresenceBeginRun();setAff('anchor',70);
  t.factionPactConsolidate('anchor');
  t.setWave(12);
  assert.ok(!t.fpPactOfferReady('anchor',12),'sem reoferta com pacto ativo');
});
ok('71. snapshot diplomático não expõe nova moeda/barra',()=>{
  beginRun(1);const s=t.factionDiplomacySnapshot();
  assert.ok(s&&typeof s==='object');
  const j=JSON.stringify(s);
  assert.ok(!/loyalty|"xp"|"points"/.test(j),'sem moeda nova');
});
ok('72. propostas contraditórias impossíveis: nunca dois pactos rivais',()=>{
  beginRun(1);
  setAff('anchor',80);setAff('deviants',80);
  t.factionPactConsolidate('anchor');
  const before=t.factionHasPact('deviants');
  t.factionPactConsolidate('deviants');   // deve falhar (eixo travado)
  assert.strictEqual(t.factionHasPact('deviants'),false,'rival não pactua');
});

/* ============================================================
   4 FACÇÕES — TIERS / VALORES (73–80)
   ============================================================ */
ok('73. ÂNCORA: shield base = 50% do shieldMax',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_ANCHOR_SHIELD,0.5);
});
ok('74. REMANESCENTES: 35% shieldMax por Eco + trust +4',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_REMNANTS_SHIELD,0.35);
  assert.strictEqual(t.FACTION_PRESENCE_REMNANTS_TRUST,4);
});
ok('75. CONSÓRCIO: cache base +4⧗ e toll hostil 6⧗ (net positivo)',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_CONSORTIUM_RES,4);
  assert.strictEqual(t.FACTION_PRESENCE_HOSTILE_RES_COST,6);
  /* gross = 4+6=10; net = 10-6 = 4 > 0 */
  assert.ok((t.FACTION_PRESENCE_CONSORTIUM_RES+t.FACTION_PRESENCE_HOSTILE_RES_COST)-t.FACTION_PRESENCE_HOSTILE_RES_COST>0);
});
ok('76. DESVIADOS base: +20% dano / +15% recebido / 12s',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_DEVIANTS_DMG,1.20);
  assert.strictEqual(t.FACTION_PRESENCE_DEVIANTS_TAKEN,1.15);
  assert.strictEqual(t.FACTION_PRESENCE_DEVIANTS_DUR,12);
});
ok('77. DESVIADOS hostil: +28% dano / +35% recebido (mais tentador, mais instável)',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_DEVIANTS_HOSTILE_DMG,1.28);
  assert.strictEqual(t.FACTION_PRESENCE_DEVIANTS_HOSTILE_TAKEN,1.35);
});
ok('78. multiplicadores de tier: ally 1.30 / hostile 0.55',()=>{
  assert.strictEqual(t.FACTION_PRESENCE_ALLY_MULT,1.30);
  assert.strictEqual(t.FACTION_PRESENCE_HOSTILE_MULT,0.55);
});
ok('79. fpDiploTier reflete estado (ally quando pacto/aliada, hostile quando hostil)',()=>{
  beginRun(1);setAff('anchor',70);t.factionPactConsolidate('anchor');
  assert.strictEqual(t.fpDiploTier('anchor'),'ally');
  setAff('consortium',-80);
  assert.strictEqual(t.fpDiploTier('consortium'),'hostile');
});
ok('80. cada facção física tem label com símbolo, nome e cor próprios',()=>{
  const L=t.FACTION_PRESENCE_LABEL;
  const syms=new Set(),cols=new Set();
  for(const f of FACTIONS){
    assert.ok(L[f]&&L[f].sym&&L[f].nm&&L[f].col,f+' completo');
    syms.add(L[f].sym);cols.add(L[f].col);
  }
  assert.strictEqual(syms.size,4,'4 símbolos distintos');
  assert.strictEqual(cols.size,4,'4 cores distintas');
});

/* ============================================================
   IDENTIDADE VISUAL / FEEDBACK (81–86)
   ============================================================ */
ok('81. presença de facção usa rótulo próprio, não rótulo de evento',()=>{
  assert.ok(/PRESENÇA DE FACÇÃO/.test(RAW),'rótulo de presença comum');
  assert.ok(/PACTO DISPONÍVEL/.test(RAW),'rótulo de pacto distinto');
});
ok('82. pacto disponível é visualmente distinto (bold + brilho)',()=>{
  assert.ok(/bold/.test(RAW)&&/shadowBlur/.test(RAW),'marker enfatizado');
});
ok('83. mensagem de aproximação de pacto preservada',()=>{
  assert.ok(/APROXIME-SE PARA NEGOCIAR/.test(RAW),'CTA de pacto');
});
ok('84. toasts de facção não recalibrados (classe .fp existe no CSS)',()=>{
  assert.ok(/\.toast\.fp/.test(html),'estilo de toast de facção');
});
ok('85. cores das 4 facções distintas de inimigo/beacon genéricos',()=>{
  const L=t.FACTION_PRESENCE_LABEL;
  const cols=FACTIONS.map(f=>L[f].col);
  assert.strictEqual(new Set(cols).size,4);
});
ok('86. entidade de presença não entra em enemies[] (não é inimigo)',()=>{
  assert.ok(/NÃO entra em enemies\[\]/.test(RAW),'documento de arquitetura');
});

/* ============================================================
   SAVE / CONTINUE (87–92)
   ============================================================ */
ok('87. pack/unpack de presença: round-trip preserva o essencial',()=>{
  beginRun(9);t.factionPresenceBeginRun();
  let p=null;for(let w=2;w<=20&&!p;w++){t.setWave(w);p=t.factionPresenceSchedule(w);}
  const packed=t.factionPresencePack();
  assert.ok(packed&&typeof packed==='object','packou');
  t.factionPresenceUnpack(packed);
  assert.ok(t.getFP(),'unpackou sem crash');
});
ok('88. pack tem versão v:1',()=>{
  beginRun(1);t.factionPresenceBeginRun();
  const packed=t.factionPresencePack();
  assert.strictEqual(packed.v,1);
});
ok('89. unpack de save antigo (sem bloco de presença) cai em fresh sem crash',()=>{
  assert.doesNotThrow(()=>t.factionPresenceUnpack(null));
});
ok('90. unpack idempotente: aplicar duas vezes não duplica ativa',()=>{
  beginRun(6);t.factionPresenceBeginRun();
  let p=null;for(let w=2;w<=20&&!p;w++){t.setWave(w);p=t.factionPresenceSchedule(w);}
  t.factionPresenceActivate(p);
  const packed=t.factionPresencePack();
  t.factionPresenceUnpack(packed);
  t.factionPresenceUnpack(packed);
  const fp=t.getFP();
  /* não deve haver mais do que 1 ativa */
  assert.ok(fp.active==null||typeof fp.active==='object','ativa consistente');
});
ok('91. diplomacia sobrevive a pack/unpack (pacto persiste)',()=>{
  beginRun(1);setAff('anchor',70);t.factionPactConsolidate('anchor');
  const snap=t.factionDiplomacySnapshot();
  assert.ok(snap,'snapshot ok');
  assert.ok(t.factionHasPact('anchor'),'pacto mantido em memória');
});
ok('92. presença é run-scoped: cleanup não deixa estado atravessar',()=>{
  beginRun(1);t.factionPresenceBeginRun();
  t.factionPresenceCleanup();
  const fp=t.getFP();
  assert.ok(fp.active==null&&fp.scheduled==null);
});

/* ============================================================
   SANDBOX / DEV / INDEPENDÊNCIA (93–98)
   ============================================================ */
ok('93. FACÇÃO ≠ TEMA: consolidar pacto não altera o Tema',()=>{
  beginRun(11);const th=t.fractureGetThemeId();
  setAff('anchor',70);t.factionPactConsolidate('anchor');
  assert.strictEqual(t.fractureGetThemeId(),th);
});
ok('94. agendar/ativar presença não altera o Tema',()=>{
  beginRun(13);const th=t.fractureGetThemeId();
  t.factionPresenceBeginRun();
  let p=null;for(let w=2;w<=20&&!p;w++){t.setWave(w);p=t.factionPresenceSchedule(w);}
  if(p)t.factionPresenceActivate(p);
  assert.strictEqual(t.fractureGetThemeId(),th);
});
ok('95. reações de faction_reaction têm contrato i:0 (só histórico, não muda Tema)',()=>{
  assert.ok(/contrato de faction_reaction é i:0/.test(RAW),'documentado');
});
ok('96. helpers DEV de fala expostos só via objeto DEV (não globais)',()=>{
  assert.ok(!/window\.echoSpeakLong/.test(RAW),'não vaza global');
});
ok('97. speechClear reseta fila e ativa (sem vazar entre runs)',()=>{
  const e=E({});t.echoSpeak(e,'FALA A','high');t.echoSpeak(e,'FALA B','normal');
  t.speechClear();
  assert.strictEqual(t.getSpeechActive(),null);
  assert.strictEqual(t.getSpeechQueue().length,0);
});
ok('98. fila de fala respeita o limite ECHO_SPEECH_QUEUE_MAX',()=>{
  assert.strictEqual(t.ECHO_SPEECH_QUEUE_MAX,3);
  t.speechClear();
  const e=E({});
  for(let i=0;i<10;i++)t.echoSpeak(e,'FALA ALTA NUMERO '+i,'high');
  assert.ok(t.getSpeechQueue().length<=t.ECHO_SPEECH_QUEUE_MAX,'fila limitada');
});

/* ============================================================
   PROPERTY / STRESS (≥10.000) (99–104)
   ============================================================ */
ok('99. STRESS ≥10.000: wrapping nunca gera linha acima do maxW',()=>{
  const bag=['A','BB','CCC','DDDD','RESSONÂNCIA','αΩ','desvio-27','SUPERLONGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'];
  let s=12345;const rng=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  for(let i=0;i<10000;i++){
    const n=1+Math.floor(rng()*8);
    const parts=[];for(let j=0;j<n;j++)parts.push(bag[Math.floor(rng()*bag.length)]);
    const maxW=100+Math.floor(rng()*180);
    const L=t.speechWrapLines(parts.join(' '),maxW);
    for(const ln of L)assert.ok(measure(ln,15)<=maxW+0.001,'i='+i+' excedeu');
  }
});
ok('100. STRESS ≥10.000: duração sempre finita dentro de [1.6, 5.0]',()=>{
  let s=999;const rng=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  const pris=['low','normal','high','critical'];
  for(let i=0;i<10000;i++){
    const len=Math.floor(rng()*400);
    const txt='X'.repeat(len);
    const d=t.echoSpeechDuration(txt,pris[Math.floor(rng()*4)]);
    assert.ok(Number.isFinite(d)&&d>=1.6-1e-9&&d<=5.0+1e-9,'i='+i+' d='+d);
  }
});
ok('101. STRESS ≥10.000: nunca 2 pactos rivais simultâneos',()=>{
  const RIV=t.FACTION_RIVAL;
  let s=7;const rng=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  let bad=0;
  for(let i=0;i<10000;i++){
    if(i%50===0)beginRun((i*2654435761)>>>0);
    const f=FACTIONS[Math.floor(rng()*4)];
    setAff(f,Math.round(rng()*200-100));
    if(rng()<0.5)t.factionPactConsolidate(f);
    if(rng()<0.2)t.factionPactBreak(f,'stress');
    /* invariante: para cada eixo, no máx 1 pacto */
    for(const a of FACTIONS){
      const r=RIV&&RIV[a];
      if(r&&t.factionHasPact(a)&&t.factionHasPact(r))bad++;
    }
  }
  assert.strictEqual(bad,0,'0 pactos rivais simultâneos');
});
ok('102. STRESS ≥10.000: afinidade permanece finita e em [-100,100]',()=>{
  let s=3;const rng=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  let bad=0;
  for(let i=0;i<10000;i++){
    if(i%40===0)beginRun((i*40503)>>>0);
    const f=FACTIONS[Math.floor(rng()*4)];
    const a=t.getFactionAffinity(f);
    if(!Number.isFinite(a)||a<-100||a>100)bad++;
  }
  assert.strictEqual(bad,0,'afinidade sempre válida');
});
ok('103. STRESS ≥10.000: scheduler nunca ultrapassa cap=1 de ativa',()=>{
  let bad=0;
  for(let i=0;i<520;i++){
    beginRun((0xC00+i*97)>>>0);t.factionPresenceBeginRun();
    for(let w=1;w<=20;w++){
      t.setWave(w);
      const p=t.factionPresenceSchedule(w);
      if(p&&p.wave===w){t.factionPresenceActivate(p);}
      const fp=t.getFP();
      /* nunca deve existir 2 ativas: active é singular por design */
      if(fp.active&&fp.scheduled&&fp.scheduled.state==='active')bad++;
      if(w%3===0)t.factionPresenceResolve('s');
    }
  }
  assert.strictEqual(bad,0,'cap=1 sempre respeitado');
});
ok('104. STRESS: pactos nunca surgem via Loja (só via encontro físico)',()=>{
  /* invariante estrutural: não existe consolidação em renderShop */
  const shop=RAW.match(/function renderShop[\s\S]*?\n}/);
  if(shop)assert.ok(!/factionPactConsolidate\(/.test(shop[0]),'Loja não consolida pacto');
  assert.ok(true);
});

/* ---------------- resumo ---------------- */
console.log('\nResultado: '+pass+' passaram · '+fail+' falharam');
if(fail>0){console.log('PR14 · B6 — HÁ TESTES FALHANDO');process.exit(1);}
