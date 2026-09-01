'use strict';
/* =====================================================================
   TESTES — Sistema base de Shield dos Operadores (ECHO)
   Executa o script REAL de index.html em um sandbox Node (DOM mínimo),
   sem dependências externas. Rodar: npm test  |  node tests/shield.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

/* expõe os símbolos top-level (const/let não viram propriedades do global) */
src+='\n;globalThis.__t={CHARS,makePlayer,damagePlayer,regenPlayerShield,'+
  'updateHUD,damageEcho,regenEchoShield,makeEcho,enterDissonance,startRun,'+
  'setChar,itemById,'+
  'ECHO_SHIELD,ECHO_SHIELD_REGEN,ECHO_SHIELD_DELAY,ITEMS,UPGRADES,UNLOCKS,mEff,'+
  'getState:()=>state,getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getEchoQueue:()=>echoQueue,setEchoQueue:q=>{echoQueue=q;},'+
  'saveEchoes,loadEchoes,'+
  'unlockAll:()=>{for(const k in UNLOCKS)if(prog.seen.indexOf(k)<0)prog.seen.push(k);}};';

/* ---------------- DOM mínimo ---------------- */
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
  el.remove=()=>{};el.addEventListener=()=>{};el.removeEventListener=()=>{};
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
const store=new Map();
const sandbox={
  window,document,console,Math,JSON,Date,Array,Object,Set,Map,Number,String,
  Boolean,Promise,RegExp,Error,Proxy,Reflect,Symbol,parseInt,parseFloat,isNaN,
  navigator:{getGamepads:()=>[],userAgent:'node'},
  localStorage:{getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>{store.set(k,String(v));},
    removeItem:k=>{store.delete(k);}},
  performance:{now:()=>Date.now()},
  requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  __t:null
};
sandbox.globalThis=sandbox;
sandbox.window.requestAnimationFrame=sandbox.requestAnimationFrame;
vm.createContext(sandbox);
vm.runInContext(src,sandbox,{filename:'index.html'});
const T=sandbox.__t;
T.unlockAll();   // libera todos os operadores para os testes de identidade

/* ---------------- helpers ---------------- */
const EPS=1e-9;
let passed=0,failed=0;
function test(name,fn){
  try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+'\n    '+e.message);}
}
const near=(a,b,eps)=>Math.abs(a-b)<=(eps==null?EPS:eps);
function mEffReset(){
  const m=T.mEff;
  m.shopMul=1;m.coinMul=1;m.dmgMul=1;m.enemySpd=1;m.enemyAggr=1;
  m.upgMul=1;m.medDrop=0;m.rerollMul=1;m.enemyHp=1;m.playerDmgTaken=1;
  m.echoPower=1;m.regen=0;m.conflict=0;
}
/* inicia uma run com o operador `idx` e retorna o player global real */
function freshRun(idx){
  T.setChar(idx==null?0:idx);
  T.startRun();
  mEffReset();
  return T.getPlayer();
}
function echoData(){
  return {trail:[[0,100,100,0,0,0],[.5,110,100,0,0,0],
    [1,120,100,0,0,0],[1.5,130,100,0,0,0],
    [2,140,100,0,0,0],[2.5,150,100,0,0,0]],dur:2.5,
    items:[],upg:[],owned:[0],moral:{comp:0,greed:0,viol:0},dom:'neutro'};
}

console.log('\nECHO — Shield dos Operadores (harness de teste)');
console.log('---------------------------------------------');

/* 1. sintaxe */
test('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(src); // lança SyntaxError se inválido
});

/* 2. stats dos operadores */
test('Todos os operadores possuem stats válidos de Shield',()=>{
  for(const C of T.CHARS){
    assert.ok(C.shieldMax>0,C.nm+' shieldMax>0');
    assert.ok(C.shieldRegen>0,C.nm+' shieldRegen>0');
    assert.ok(C.shieldDelay>0,C.nm+' shieldDelay>0');
    assert.ok(C.shieldStart>=0&&C.shieldStart<=1,C.nm+' shieldStart 0..1');
  }
});
test('Operadores têm valores distintos (identidade preservada)',()=>{
  const mx=T.CHARS.map(c=>c.shieldMax);
  const rg=T.CHARS.map(c=>c.shieldRegen);
  const dl=T.CHARS.map(c=>c.shieldDelay);
  assert.strictEqual(new Set(mx).size,T.CHARS.length);
  assert.strictEqual(new Set(rg).size,T.CHARS.length);
  assert.strictEqual(new Set(dl).size,T.CHARS.length);
});

/* 3. player começa com o Shield correto */
test('Player começa com shieldMax/shieldRegen/shieldDelay e Shield cheio',()=>{
  T.CHARS.forEach((C,i)=>{
    const p=freshRun(i);
    assert.strictEqual(p.shieldMax,C.shieldMax,C.nm+' shieldMax');
    assert.strictEqual(p.shieldRegen,C.shieldRegen,C.nm+' shieldRegen');
    assert.strictEqual(p.shieldDelay,C.shieldDelay,C.nm+' shieldDelay');
    assert.strictEqual(Math.round(p.shield),Math.round(C.shieldMax*C.shieldStart),
      C.nm+' shield inicial');
    assert.ok(p.shield>=0&&p.shield<=p.shieldMax,C.nm+' 0<=shield<=max');
    assert.strictEqual(p.shieldDelayT,0,C.nm+' delay inicial');
  });
});

/* 4. absorção (VECTOR: 30 shield / 100 hp como base) */
test('Shield absorve dano antes do HP (25/100 + 40 → 0/85)',()=>{
  const p=freshRun(0);p.hp=100;p.shield=25;p.shieldDelayT=0;
  T.damagePlayer(40);
  assert.strictEqual(p.shield,0);
  assert.strictEqual(p.hp,85);
});
test('Dano menor que o Shield não altera HP',()=>{
  const p=freshRun(0);p.shield=30;p.hp=100;
  T.damagePlayer(12);
  assert.strictEqual(p.shield,18);
  assert.strictEqual(p.hp,100);
});
test('Dano maior que o Shield aplica somente o excesso ao HP',()=>{
  const p=freshRun(0);p.shield=30;p.hp=100;
  T.damagePlayer(40);
  assert.strictEqual(p.shield,0);
  assert.strictEqual(p.hp,90);
});
test('Shield zerado permite dano normal ao HP',()=>{
  const p=freshRun(0);p.shield=0;p.hp=100;
  T.damagePlayer(12);
  assert.strictEqual(p.hp,88);
});
test('Shield nunca fica negativo',()=>{
  const p=freshRun(0);p.shield=5;p.hp=200;
  T.damagePlayer(500);
  assert.strictEqual(p.shield,0);
  assert.ok(p.shield>=0);
  assert.ok(p.hp===200-495,'excesso foi 495: hp='+p.hp);
});

/* 5. delay / regeneração (VECTOR: 4/s · 2.5s) */
test('Receber dano reinicia o delay de regeneração',()=>{
  const p=freshRun(0);p.shield=30;
  T.damagePlayer(4);
  assert.ok(near(p.shieldDelayT,2.5),'delayT='+p.shieldDelayT);
});
test('Shield não regenera durante o delay',()=>{
  const p=freshRun(0);p.shield=10;p.shieldDelayT=2.5;
  T.regenPlayerShield(p,1.0);
  assert.ok(near(p.shield,10),'shield='+p.shield);
  assert.ok(near(p.shieldDelayT,1.5),'delayT='+p.shieldDelayT);
});
test('Shield começa a regenerar depois do delay',()=>{
  const p=freshRun(0);p.shield=10;p.shieldDelayT=1;
  T.regenPlayerShield(p,1.0);       // zera o delay nesta chamada
  assert.strictEqual(p.shieldDelayT,0);
  T.regenPlayerShield(p,1.0);       // agora regenera
  assert.ok(near(p.shield,14),'shield='+p.shield); // 4/s
});
test('Regeneração é independente de FPS (dt subdividido = dt único)',()=>{
  const a=freshRun(0),b=freshRun(0);
  a.shield=10;a.shieldDelayT=0;b.shield=10;b.shieldDelayT=0;
  for(let i=0;i<4;i++)T.regenPlayerShield(a,.25);
  T.regenPlayerShield(b,1.0);
  assert.ok(near(a.shield,b.shield),a.shield+' vs '+b.shield);
  assert.ok(near(a.shield,14),'regen 4 un/s: '+a.shield);
});
test('Shield nunca ultrapassa shieldMax na regeneração',()=>{
  const p=freshRun(0);p.shield=p.shieldMax-1;p.shieldDelayT=0;
  T.regenPlayerShield(p,10);
  assert.strictEqual(p.shield,p.shieldMax);
});

/* 6. morte / i-frames / dash */
test('Morte do player continua funcionando',()=>{
  const p=freshRun(0);p.shield=0;p.hp=5;
  T.damagePlayer(20);
  assert.strictEqual(T.getState(),'fracture');
});
test('i-frames (invulnerabilidade) continuam funcionando',()=>{
  const p=freshRun(0);p.shield=30;p.hp=100;p.invT=1;
  T.damagePlayer(10);
  assert.strictEqual(p.shield,30);
  assert.strictEqual(p.hp,100);
  assert.strictEqual(p.shieldDelayT,0);
});
test('Dash (i-frames de dash) continua funcionando',()=>{
  const p=freshRun(0);p.shield=30;p.hp=100;p.dashT=.17;
  T.damagePlayer(10);
  assert.strictEqual(p.shield,30);
  assert.strictEqual(p.hp,100);
});

/* 7. cura/HP não vira Shield */
test('Cura de HP existente continua afetando HP, não o Shield',()=>{
  const p=freshRun(0);p.shield=0;p.hp=50;
  const before=p.shield;
  const upg=T.UPGRADES.find(u=>u.id==='hp');   // +25 maxHp e cura 25
  upg.apply(p);
  assert.strictEqual(p.hp,75);                 // 50+25
  assert.strictEqual(p.shield,before);
  const it=T.itemById('placa');                 // +55 maxHp e +55 hp
  it.apply(p);
  assert.strictEqual(p.hp,130);                // 75+55
  assert.strictEqual(p.shield,before);         // cura nunca toca Shield
});

/* 8. sistema dos Echos permanece intacto */
test('ECHO_SHIELD / REGEN / DELAY dos Echos não foram rebalanceados',()=>{
  assert.deepStrictEqual(Array.from(T.ECHO_SHIELD),[0,30,20]);
  assert.deepStrictEqual(Array.from(T.ECHO_SHIELD_REGEN),[0,.06,.05]);
  assert.deepStrictEqual(Array.from(T.ECHO_SHIELD_DELAY),[0,2.5,3]);
});
test('Echos continuam com Shield próprio funcionando',()=>{
  const e=T.makeEcho(echoData(),1);
  assert.strictEqual(e.shieldMax,30);
  assert.strictEqual(e.shield,30);
  T.damageEcho(e,40);                     // 30 absorvido, 10 no HP (70→60)
  assert.strictEqual(e.shield,0);
  assert.strictEqual(e.hp,60);
  assert.ok(e.shieldDelayT>0);
  T.regenEchoShield(e,3);                 // zera o delay (2.5s)
  assert.strictEqual(e.shieldDelayT,0);
  T.regenEchoShield(e,.5);                // agora regenera: 30*.06*.5=.9
  assert.ok(e.shield>0,'regen do Eco após delay: '+e.shield);
});
test('Dissonância continua funcionando (suspende regen do Eco)',()=>{
  const e=T.makeEcho(echoData(),1);
  e.trust=0;e.hostile=false;
  T.enterDissonance(e);
  assert.strictEqual(e.hostile,true);
  assert.ok(e.hostileT>0);
  e.shield=5;e.shieldDelayT=0;
  T.regenEchoShield(e,2);
  assert.strictEqual(e.shield,5);          // suspenso durante Dissonância
});

/* 9. memória/replay + saves antigos */
test('Saves antigos continuam carregando (sem campos de Shield)',()=>{
  const legacy=[{v:2,dur:5,dmgMul:1,frMul:1,wave:3,level:2,
    trail:[[0,50,50,0,0,0],[1,60,50,0,0,0],[2,70,50,0,0,0],
      [3,80,50,0,0,0],[4,90,50,0,0,0],[5,100,50,0,0,0]],
    items:[],upg:[],owned:[0],moral:{comp:0,greed:0,viol:0},dom:'neutro'}];
  T.setEchoQueue(legacy);
  T.saveEchoes();
  const q=T.loadEchoes();
  assert.ok(Array.isArray(q)&&q.length===1);
  assert.strictEqual(q[0].wave,3);
});
test('Replay dos Echos continua funcionando (makeEcho usa trail)',()=>{
  const q=T.loadEchoes();
  const e=T.makeEcho(q[0],1);
  assert.ok(e.data&&Array.isArray(e.data.trail)&&e.data.trail.length>4);
  assert.ok(e.alive);
});

/* 10. HUD */
test('HUD mostra Shield cheio',()=>{
  const p=freshRun(0);p.shield=p.shieldMax;
  T.updateHUD(true);
  const bar=document.getElementById('shbar');
  assert.ok(bar.classList.contains('full'));
  assert.ok(!bar.classList.contains('empty'));
  assert.ok(document.getElementById('shfill').style.width==='100%');
});
test('HUD mostra Shield parcial',()=>{
  const p=freshRun(0);p.shield=p.shieldMax*.5;
  T.updateHUD(true);
  const bar=document.getElementById('shbar');
  assert.ok(bar.classList.contains('partial'));
  assert.ok(!bar.classList.contains('full')&&!bar.classList.contains('empty'));
  assert.ok(/^\d+ \/ 30$/.test(document.getElementById('shnum').textContent),
    document.getElementById('shnum').textContent);
});
test('HUD mostra Shield vazio',()=>{
  const p=freshRun(0);p.shield=0;
  T.updateHUD(true);
  const bar=document.getElementById('shbar');
  assert.ok(bar.classList.contains('empty'));
  assert.ok(document.getElementById('shfill').style.width==='0%');
  assert.ok(/^0 \/ 30$/.test(document.getElementById('shnum').textContent),
    document.getElementById('shnum').textContent);
});

/* 11. integração estrutural (pipeline preservado) */
test('damagePlayer() continua sendo o pipeline (call sites intactos)',()=>{
  const calls=(html.match(/damagePlayer\(/g)||[]).length;
  assert.ok(calls>=15,'call sites: '+calls);
  assert.ok(src.indexOf('shieldBroke')>=0,'feedback de break no pipeline');
});
test('updatePlayer() integra a regeneração do Shield',()=>{
  assert.ok(src.indexOf('regenPlayerShield(p,dt)')>=0);
  assert.ok(src.indexOf('function regenPlayerShield')>=0);
});
test('Nenhum item/evento/upgrade novo de Shield foi criado',()=>{
  const items=T.ITEMS.filter(i=>/shield/i.test(i.id+' '+i.nm));
  const upgs=T.UPGRADES.filter(u=>/shield/i.test(u.id+' '+u.nm));
  const unlocks=Object.keys(T.UNLOCKS).filter(k=>/shield/i.test(k));
  assert.strictEqual(items.length,0);
  assert.strictEqual(upgs.length,0);
  assert.strictEqual(unlocks.length,0);
});
test('Shield do player e dos Echos usam pools independentes',()=>{
  const p=freshRun(0);                        // VECTOR
  const e=T.makeEcho(echoData(),1);           // ECHO·01 (pool próprio)
  assert.notStrictEqual(p,e);
  const before=p.shield;
  T.damageEcho(e,5);
  assert.strictEqual(p.shield,before,'dano ao Eco não afeta player');
  const echoBefore=e.shield;
  T.damagePlayer(5);                          // redução do player aplicada antes
  assert.strictEqual(e.shield,echoBefore,'dano ao player não afeta Eco');
  assert.ok(near(p.shield,30-5*p.dmgTakenMul),'shield='+p.shield);
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
process.exit(failed?1:0);
