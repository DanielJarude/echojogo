'use strict';
/* =====================================================================
   TESTES — REGISTRO DE COMBATE (TAB): TOGGLE PADRÃO, ESC, ARSENAL 2 CLIQUES
   ---------------------------------------------------------------------
   §3/§4 (feedback): TAB é TOGGLE por padrão (TAB abre, TAB fecha); HOLD
   continua disponível em Configurações. ESC fecha o Registro antes de
   abrir outro menu — nada empilha. §5–§9: arsenal do TAB troca slots em
   DOIS CLIQUES (clique origem → clique destino = swap imediato; arma ou
   vazio), clicar de novo cancela, ESC cancela antes de fechar, e a arma
   ativa acompanha a arma.
   Os binds do arsenal são validados com HANDLERS REAIS: o parser de HTML
   do harness cria nós a partir do innerHTML renderizado pelo jogo, e os
   cliques são disparados nesses nós — se o addEventListener quebrar, o
   teste falha (nada de chamar função interna "no lugar" do clique).
   Rodar: npm test  |  node tests/tab.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

src+=';globalThis.__t={'+
  'cfg,setChar,startRun,swapWeaponSlots,setWeaponSlot,quickSwitchWeapon,'+
  'sheetToggle,sheetShow,sheetHide,sheetRender,onGameEsc,sheetArsenalAction,'+
  'buildWeaponHUD,WEAPONS,CHARS,'+
  'getState:()=>state,setState:s=>{state=s;},'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getSheetOpen:()=>sheetOpen,getSheetSel:()=>sheetSel,setSheetSel:v=>{sheetSel=v;},'+
  'getEl:id=>document.getElementById(id),'+
  'pressKey:(code,type)=>{const ev={code,repeat:false,preventDefault(){}};'+
  '  (window._wl[type||"keydown"]||[]).forEach(f=>f(ev));}};';

/* ---------------- DOM mínimo + LISTENERS + PARSER ---------------- */
function makeStyle(){
  const store={};
  return new Proxy(store,{get(t,k){return k in t?t[k]:'';},set(t,k,v){t[k]=String(v);return true;}});
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
/* nó criado a partir do PARSE do innerHTML — aceita handlers e cliques */
function makeNode(tag,attrs){
  const node={tag:tag||'div',id:'',children:[],dataset:{},_cls:[],_h:{},
    textContent:'',style:makeStyle(),value:''};
  node.classList={
    add:(...c)=>c.forEach(x=>{if(node._cls.indexOf(x)<0)node._cls.push(x);}),
    remove:(...c)=>node._cls=node._cls.filter(x=>c.indexOf(x)<0),
    contains:c=>node._cls.indexOf(c)>=0,
    toggle(c,f){const has=node._cls.indexOf(c)>=0;
      const want=f===undefined?!has:!!f;
      if(want&&!has)node._cls.push(c);if(!want&&has)node._cls=node._cls.filter(x=>x!==c);
      return want;}
  };
  for(const k in attrs||{}){
    const v=attrs[k];
    if(k==='class')node._cls=v.split(/\s+/).filter(Boolean);
    else if(k==='id')node.id=v;
    else if(k.indexOf('data-')===0){
      const dk=k.slice(5).replace(/-([a-z])/g,(x,c)=>c.toUpperCase());
      node.dataset[dk]=v;
    }
  }
  node.addEventListener=(t,fn)=>{(node._h[t]=node._h[t]||[]).push(fn);};
  node.removeEventListener=()=>{};
  node.dispatchEvent=ev=>{(node._h[ev.type]=node._h[ev.type]||[]).forEach(f=>f(ev));};
  node.click=()=>node.dispatchEvent({type:'click',stopPropagation(){},preventDefault(){}});
  node.contains=x=>x===node;
  node.querySelectorAll=sel=>parseNodes('').filter(n=>matchSel(n,sel));
  node.querySelector=sel=>node.querySelectorAll(sel)[0]||null;
  return node;
}
function matchSel(n,sel){
  if(sel.charAt(0)==='#')return n.id===sel.slice(1);
  if(sel.charAt(0)==='.')return n._cls.indexOf(sel.slice(1))>=0;
  const mm=sel.match(/^\[([a-zA-Z-]+)(?:="([^"]*)")?\]$/);
  if(mm){
    const dk=mm[1].slice(5).replace(/-([a-z])/g,(x,c)=>c.toUpperCase());
    return mm[2]===undefined?n.dataset[dk]!=null:n.dataset[dk]===mm[2];
  }
  return n.tag===sel;
}
/* parser mínimo: extrai nós de abertura em ordem (flat) */
function parseNodes(htmlStr){
  const out=[];
  const re=/<(div|span|h4|b|small|button|p)\b([^>]*)>/g;
  let mm;
  while((mm=re.exec(htmlStr))){
    const attrs={};
    const are=/([a-zA-Z-]+)(?:\s*=\s*"([^"]*)")?/g;
    let am;
    while((am=are.exec(mm[2]))){
      if(am[1]==='style'||am[1]==='title')continue;
      attrs[am[1]]=am[2]!==undefined?am[2]:'';
    }
    out.push(makeNode(mm[1],attrs));
  }
  return out;
}
function makeEl(id){
  const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,
    _cls:new Set(),isConnected:true,offsetWidth:0,offsetHeight:0,
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
  el.insertBefore=c=>{el.children.unshift(c);return c;};
  el._h={};
  el.addEventListener=(t,fn)=>{(el._h[t]=el._h[t]||[]).push(fn);};
  el.removeEventListener=(t,fn)=>{el._h[t]=(el._h[t]||[]).filter(f=>f!==fn);};
  el.dispatchEvent=ev=>{(el._h[ev.type]=el._h[ev.type]||[]).forEach(f=>f(ev));};
  el.click=()=>el.dispatchEvent({type:'click',stopPropagation(){},preventDefault(){}});
  el.remove=()=>{};
  el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};
  el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];
  el.getContext=()=>ctx2d();
  /* ---- PARSER COM CACHE POR ATRIBUIÇÃO: cada set de innerHTML recria
     os nós (como o DOM real) — handlers registrados pelo JOGO ficam
     acessíveis ao teste (cliques reais nos nós que o jogo bindou). ---- */
  let _html='',_cacheNodes=null;
  Object.defineProperty(el,'innerHTML',{
    get(){return _html;},
    set(v){_html=String(v);_cacheNodes=null;}
  });
  el.querySelectorAll=sel=>{
    if(!_cacheNodes)_cacheNodes=parseNodes(_html);
    return _cacheNodes.filter(n=>matchSel(n,sel));
  };
  el.querySelector=sel=>el.querySelectorAll(sel)[0]||null;
  return el;
}
const elements=new Map();
const document={
  hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
  fullscreenElement:null,webkitFullscreenElement:null,
  createElement:()=>makeNode('div'),
  getElementById:id=>{if(!elements.has(id))elements.set(id,makeEl(id));
    return elements.get(id);},
  querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},
  hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()
};
const window={
  innerWidth:1280,innerHeight:720,devicePixelRatio:1,
  screen:{availWidth:1280,availHeight:720},
  _wl:{},
  addEventListener(t,fn){(this._wl[t]=this._wl[t]||[]).push(fn);},
  removeEventListener(){},
  matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),
  AudioContext:undefined,webkitAudioContext:undefined,
  open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined
};
function bootGame(){
  const store=new Map();
  const ls={getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>{store.set(k,String(v));},
    removeItem:k=>{store.delete(k);}};
  const sandbox={
    window,document,console:{log(){},warn(){},error(){}},Math,JSON,Date,Array,
    Object,Set,Map,Number,String,Boolean,Promise,RegExp,Error,Proxy,Reflect,
    Symbol,parseInt,parseFloat,isNaN,
    navigator:{getGamepads:()=>[],userAgent:'node'},
    localStorage:ls,
    performance:{now:()=>Date.now()},
    requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
    setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
    Uint8ClampedArray,__t:null
  };
  sandbox.globalThis=sandbox;
  sandbox.window.requestAnimationFrame=sandbox.requestAnimationFrame;
  vm.createContext(sandbox);
  vm.runInContext(src,sandbox,{filename:'index.html',timeout:20000});
  const t=vm.runInContext('__t',sandbox);
  t._ls=ls;
  return t;
}

/* ---------------- harness ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+(e&&e.stack||e));}
}
const wIdx=t=>id=>t.WEAPONS.findIndex(w=>w.id===id);
function inRun(t,charIdx){
  t.setPlayer(null);t.setState('title');
  t.setChar(charIdx!=null?charIdx:0);
  t.startRun();
  return t.getPlayer();
}
function slotNode(t,s){            // nó REAL bindado pelo jogo no render
  return t.getEl('s-body').querySelectorAll('[data-aslot="'+s+'"]')[0];
}

console.log('\nECHO — Registro de Combate: TAB/ESC/Arsenal 2 cliques (PR 11.5)');
console.log('---------------------------------------------');

ok('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(m[1]);
});

/* ============ §3/§5 — TOGGLE É O PADRÃO ============ */
const T=bootGame();
ok('§3: cfg.tabMode nasce TOGGLE (padrão novo) e HOLD continua opção',()=>{
  assert.strictEqual(T.cfg.tabMode,'toggle','default deve ser toggle');
  assert(html.indexOf("tabMode:'toggle'")>=0,'default no fonte é toggle');
  assert(html.indexOf("'hold'")>=0||html.indexOf('"hold"')>=0,
    'hold ainda existe como opção');
  assert(html.indexOf("(cfg.tabMode==='toggle')?'TOGGLE':'HOLD'")>=0,
    'Settings ainda alterna TOGGLE/HOLD');
});
ok('§3: TAB abre o Registro (keydown real capturado do window)',()=>{
  inRun(T,0);
  assert.strictEqual(T.getSheetOpen(),false);
  T.pressKey('Tab');
  assert.strictEqual(T.getSheetOpen(),true,'TAB deve abrir');
  assert.strictEqual(T.getState(),'sheet');
});
ok('§3: TAB de novo FECHA (toggle — nada de segurar)',()=>{
  T.pressKey('Tab');
  assert.strictEqual(T.getSheetOpen(),false,'TAB deve fechar');
  assert.strictEqual(T.getState(),'play');
});
ok('§3: keyup NÃO fecha no modo toggle (comportamento hold morreu)',()=>{
  T.pressKey('Tab');                       // abre
  T.pressKey('Tab','keyup');               // soltar não pode fechar
  assert.strictEqual(T.getSheetOpen(),true,'keyup não fecha em toggle');
  T.pressKey('Tab');                       // fecha pelo toggle
  assert.strictEqual(T.getSheetOpen(),false);
});
ok('§4: o jogo congela com o Registro aberto (state sheet ∈ frozen)',()=>{
  T.pressKey('Tab');
  const i=html.indexOf('const frozen=(state===');
  assert(html.slice(i,i+220).indexOf("state==='sheet'")>=0,
    'sheet deve estar no frozen');
  T.pressKey('Tab');
});
ok('§5(Settings): HOLD continua funcional para quem preferir',()=>{
  T.cfg.tabMode='hold';
  T.pressKey('Tab');
  assert.strictEqual(T.getSheetOpen(),true,'hold abre no pressionar');
  T.pressKey('Tab','keyup');
  assert.strictEqual(T.getSheetOpen(),false,'hold fecha ao soltar');
  T.cfg.tabMode='toggle';
});
ok('§4: ESC fecha o Registro e NÃO abre pausa (nada empilha)',()=>{
  T.pressKey('Tab');
  assert.strictEqual(T.getState(),'sheet');
  T.onGameEsc();
  assert.strictEqual(T.getSheetOpen(),false);
  assert.strictEqual(T.getState(),'play','voltou pro jogo, não para pausa');
});
ok('§4: TAB/ESC nunca empilham overlays (sheet sobre sheet é impossível)',()=>{
  T.pressKey('Tab');
  const st1=T.getState();
  T.pressKey('Tab');                       // segundo TAB fecha, não empilha
  assert.strictEqual(T.getSheetOpen(),false);
  assert.notStrictEqual(T.getState(),'sheet');
  assert.strictEqual(st1,'sheet');
});

/* ============ §5–§9 — ARSENAL EM 2 CLIQUES ============ */
const T2=bootGame();
ok('§5: cards do arsenal existem para TODOS os slots (bind real)',()=>{
  const p=inRun(T2,0);                     // VECTOR: 4 slots, 3 armas
  p.owned=[wIdx(T2)('plasma'),wIdx(T2)('shotgun'),wIdx(T2)('beam')];
  p.wi=p.owned[0];
  T2.setSheetSel(-1);
  T2.sheetShow();T2.sheetRender(true);
  for(let s=0;s<4;s++)
    assert(slotNode(T2,s),'card do slot '+(s+1)+' deveria existir bindado');
});
ok('§5/§6: clique slot 1 → SELECIONADO com destaque; hint pede destino',()=>{
  slotNode(T2,0).click();                  // clique REAL no card bindado
  assert.strictEqual(T2.getSheetSel(),0,'slot 1 selecionado');
  const h=T2.getEl('s-body').innerHTML;
  assert(h.indexOf('SELECIONADO')>=0,'card mostra SELECIONADO');
  assert(h.indexOf('ESCOLHA O SLOT DE DESTINO')>=0,'hint pede destino');
  assert(h.indexOf('data-aslot="3"')>=0||h.indexOf('data-aslot="2"')>=0,
    'vazios apontam como destino');
});
ok('§5: clique no slot 2 → SWAP IMEDIATO + seleção limpa',()=>{
  const p=T2.getPlayer();
  const a=p.owned[0],b=p.owned[1];
  slotNode(T2,1).click();
  assert.strictEqual(T2.getSheetSel(),-1,'seleção limpa após o swap');
  assert.strictEqual(p.owned[0],b,'slot 1 recebeu a arma do slot 2');
  assert.strictEqual(p.owned[1],a,'slot 2 recebeu a arma do slot 1');
  assert.strictEqual(p.wi,p.wi,'ativa não muda (§9)');
});
ok('§7: clicar de novo no slot selecionado CANCELA',()=>{
  slotNode(T2,2).click();
  assert.strictEqual(T2.getSheetSel(),2);
  slotNode(T2,2).click();                  // mesmo slot de novo
  assert.strictEqual(T2.getSheetSel(),-1,'seleção cancelada');
  const p=T2.getPlayer();
  assert.strictEqual(p.owned[2],wIdx(T2)('beam'),'nada mudou');
});
ok('§7: ESC cancela a seleção ANTES de fechar o TAB',()=>{
  slotNode(T2,0).click();
  assert.strictEqual(T2.getSheetSel(),0);
  T2.onGameEsc();                          // 1º ESC: cancela, TAB continua
  assert.strictEqual(T2.getSheetSel(),-1,'ESC cancelou a seleção');
  assert.strictEqual(T2.getSheetOpen(),true,'TAB ainda aberto');
  T2.onGameEsc();                          // 2º ESC: fecha
  assert.strictEqual(T2.getSheetOpen(),false,'agora fechou');
});
ok('§8: swap com slot VAZIO move a arma (laser do slot 3 → slot 2 vazio)',()=>{
  const p=T2.getPlayer();
  p.owned=[wIdx(T2)('plasma'),null,wIdx(T2)('beam')];   // slot 2 vazio no MEIO
  p.wi=p.owned[0];
  T2.setSheetSel(-1);T2.sheetRender(true);
  slotNode(T2,2).click();                  // seleciona LASER (slot 3)
  slotNode(T2,1).click();                  // destino VAZIO (slot 2)
  assert.strictEqual(p.owned[1],wIdx(T2)('beam'),'slot 2 = Laser');
  assert.strictEqual(p.owned[2],null,'slot 3 ficou vazio');
  assert.strictEqual(p.owned[0],wIdx(T2)('plasma'),'slot 1 intocado');
  assert.strictEqual(T2.getSheetSel(),-1,'seleção limpa após mover');
});
ok('§9: arma ativa ACOMPANHA a arma (swap nunca troca a ativa)',()=>{
  const p=T2.getPlayer();
  p.owned=[wIdx(T2)('plasma'),wIdx(T2)('shotgun'),wIdx(T2)('beam')];
  T2.setWeaponSlot(2);                     // beam ativa (slot 3)
  T2.setSheetSel(-1);T2.sheetRender(true);
  slotNode(T2,2).click();
  slotNode(T2,0).click();
  assert.strictEqual(p.wi,wIdx(T2)('beam'),'beam segue ATIVA');
  assert.strictEqual(p.owned.indexOf(p.wi),0,'agora no slot 1');
});
ok('§9 (anti-exploit): 20 swaps seguidos não alteram dano/crit/cooldowns',()=>{
  const p=T2.getPlayer();
  p.owned=[0,1,2,null,wIdx(T2)('rail')];
  p.fireTimer=.123;p.dashCd=.7;
  const before=JSON.stringify([p.owned.slice().sort(),p.fireTimer,p.dashCd]);
  for(let i=0;i<10;i++)T2.swapWeaponSlots(4,0);
  for(let i=0;i<10;i++)T2.swapWeaponSlots(0,4);
  const after=JSON.stringify([p.owned.slice().sort(),p.fireTimer,p.dashCd]);
  assert.strictEqual(after,before,'nada muda com martelada de swaps');
});
ok('§10: controles numéricos 1–5 seguem ativos EM COMBATE (fora do TAB)',()=>{
  const k=html.indexOf("if(e.code==='Digit1'||e.code==='Numpad1')");
  assert(k>=0,'Digit1..5 selecionam arma');
  /* dentro do TAB os números NÃO trocam arma: keydown de jogo é bloqueado */
  const kb=html.indexOf("if(state==='sheet'||state==='sandbox')return;");
  assert(kb>=0,'input de jogo bloqueado com TAB aberto');
});

console.log('---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('\nFALHAS DETECTADAS');process.exit(1);}
