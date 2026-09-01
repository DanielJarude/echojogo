'use strict';
/* =====================================================================
   TESTES — Restauração dos 8 operadores originais (ECHO)
   Harness igual ao de shield.test.js: executa o script REAL de index.html
   em um sandbox Node com DOM mínimo. Rodar: npm test
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

/* expõe os símbolos top-level (const/let não viram propriedades do global) */
src+='\n;globalThis.__t={CHARS,ITEMS,UPGRADES,UNLOCKS,makePlayer,damagePlayer,'+
  'regenPlayerShield,startRun,setChar,curChar,itemById,mEff,'+
  'getState:()=>state,getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'unlockAll:()=>{for(const k in UNLOCKS)if(prog.seen.indexOf(k)<0)prog.seen.push(k);}};';

/* ---------------- DOM mínimo (idêntico ao harness de Shield) ---------------- */
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
let passed=0,failed=0;
function test(name,fn){
  try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+'\n    '+e.message);}
}
function mEffReset(){
  const m=T.mEff;
  m.shopMul=1;m.coinMul=1;m.dmgMul=1;m.enemySpd=1;m.enemyAggr=1;
  m.upgMul=1;m.medDrop=0;m.rerollMul=1;m.enemyHp=1;m.playerDmgTaken=1;
  m.echoPower=1;m.regen=0;m.conflict=0;
}
function freshRun(idx){
  T.setChar(idx==null?0:idx);
  T.startRun();
  mEffReset();
  return T.getPlayer();
}
const EXPECTED=[
  {id:'vector',  nm:'VECTOR',  role:'EQUILIBRADO',  hp:100},
  {id:'wraith',  nm:'WRAITH',  role:'ASSASSINO',    hp:72},
  {id:'bulwark', nm:'BULWARK', role:'FORTALEZA',    hp:185},
  {id:'pyre',    nm:'PYRE',    role:'INCENDIÁRIO',  hp:88},
  {id:'warden',  nm:'HARDEN',  role:'TÁTICO',       hp:112},
  {id:'nomad',   nm:'NÔMADE',  role:'MERCENÁRIO',   hp:92},
  {id:'echo0',   nm:'ECHO-0',  role:'RESSONANTE',   hp:80},
  {id:'revenant',nm:'REVENANT',role:'CEIFADOR',     hp:66}
];

console.log('\nECHO — Restauração dos 8 operadores (harness de teste)');
console.log('---------------------------------------------');

/* 1. sintaxe */
test('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(src);            // lança SyntaxError se inválido
});

/* 2. os 8 operadores, na ordem histórica (grade 4 × 2) */
test('CHARS.length === 8',()=>{
  assert.strictEqual(T.CHARS.length,8);
});
test('CHARS contém exatamente os 8 operadores esperados, em ordem',()=>{
  assert.strictEqual(JSON.stringify(T.CHARS.map(c=>c.id)),
    JSON.stringify(EXPECTED.map(e=>e.id)));
  assert.strictEqual(JSON.stringify(T.CHARS.map(c=>c.nm)),
    JSON.stringify(EXPECTED.map(e=>e.nm)));
});
test('Nenhum id de operador duplicado',()=>{
  const ids=T.CHARS.map(c=>c.id);
  assert.strictEqual(new Set(ids).size,8);
});

/* 3. identidade completa de cada operador (stats/perk/arsenal/lore) */
test('Todos os 8 têm identidade completa (stats, sp, perk, arsenal, lore, cores)',()=>{
  for(const C of T.CHARS){
    assert.ok(C.hp>0&&C.speed>0&&C.dmg>0&&C.rate>0,C.id+' stats base');
    assert.ok(C.crit>=0&&C.crit<1,C.id+' crit');
    assert.ok(C.dashCd>0&&C.r>0&&C.slots>=2,C.id+' dash/r/slots');
    assert.ok(C.guns&&C.guns.length>=2,C.id+' arsenal');
    for(const g of C.guns)assert.ok(/^[a-z]+$/.test(g),C.id+' arma id: '+g);
    assert.ok(C.sp&&C.sp.id&&C.sp.nm&&C.sp.cd>0&&C.sp.desc,C.id+' sp');
    assert.ok(C.perk&&C.perk.length>2,C.id+' perk');
    assert.ok(C.desc&&C.desc.length>10,C.id+' desc');
    assert.ok(C.color&&/^#/.test(C.color),C.id+' color');
    assert.ok(C.pal&&C.pal.body&&C.pal.dark&&C.pal.edge&&C.pal.glow&&
      C.pal.visor&&C.pal.head,C.id+' paleta');
    assert.ok(C.title&&C.lore&&C.quote,C.id+' lore/title/quote (Dossiê)');
  }
});
test('Stats de cada operador batem com o registro histórico',()=>{
  for(let i=0;i<EXPECTED.length;i++){
    const C=T.CHARS[i],E=EXPECTED[i];
    assert.strictEqual(C.hp,E.hp,E.id+' hp');
    assert.strictEqual(C.role,E.role,E.id+' role');
  }
});

/* 4. apply() de cada operador funciona */
test('VECTOR: apply dá +1 reroll',()=>{
  const p=freshRun(0);
  assert.ok(p.freeRerolls>=1,'rerolls='+p.freeRerolls);
});
test('WRAITH: apply ativa o rush pós-dash',()=>{
  const p=freshRun(1);
  assert.strictEqual(p.wraithRush,true);
});
test('BULWARK: apply reduz dano recebido e dá regen',()=>{
  const p=freshRun(2);
  assert.ok(p.dmgTakenMul<1,'dmgTakenMul='+p.dmgTakenMul);
  assert.ok(p.regen>0,'regen='+p.regen);
});
test('PYRE: apply amplia status e ativa burnSpread',()=>{
  const p=freshRun(3);
  assert.ok(p.stBoost>1,'stBoost='+p.stBoost);
  assert.strictEqual(p.burnSpread,true);
});
test('HARDEN: apply dá +40% duração de status e kits em dobro',()=>{
  const p=freshRun(4);
  assert.ok(p.stDurMul>1,'stDurMul='+p.stDurMul);
  assert.strictEqual(p.medBoost,2);
});
test('NÔMADE: apply dá +45% créditos, loja −15% e 5 slots',()=>{
  const p=freshRun(5);
  assert.ok(p.coinMul>1,'coinMul='+p.coinMul);
  assert.strictEqual(p.shopPersonal,.85);
  assert.strictEqual(p.maxSlots,5);
});
test('ECHO-0: apply dá bônus de Ecos e créditos iniciais',()=>{
  const p=freshRun(6);
  assert.ok(p.echoBoost>0,'echoBoost='+p.echoBoost);
  assert.ok(p.coins>=60,'coins='+p.coins);
});
test('REVENANT: apply dá COLHEITA MACABRA (cura + stack + decay)',()=>{
  const p=freshRun(7);
  assert.strictEqual(p.harvestHeal,3);
  assert.strictEqual(p.harvestStack,.015);
  assert.strictEqual(p.decayPerWave,.08);
});

/* 5. mecânicas exclusivas integradas ao código moderno */
test('sp: casos turret/cache/harvest presentes no switch de habilidades',()=>{
  assert.ok(src.indexOf("case 'turret':")>=0);
  assert.ok(src.indexOf("case 'cache':")>=0);
  assert.ok(src.indexOf("case 'harvest':")>=0);
});
test('HARDEN: updateAllies trata torre fixa com fogo autônomo',()=>{
  assert.ok(src.indexOf('a.turret')>=0);
  assert.ok(src.indexOf("dmg:11+wave*1.4")>=0);
});
test('REVENANT: abate cura 3 HP e acumula +1.5% de dano por onda',()=>{
  assert.ok(src.indexOf('player.harvestHeal')>=0);
  assert.ok(src.indexOf('player.harvStacks=(player.harvStacks||0)+1')>=0);
  assert.ok(src.indexOf('(p.harvStacks||0)*p.harvestStack')>=0);
});
test('REVENANT: vida máxima decai 8% por onda vencida',()=>{
  assert.ok(src.indexOf('player.decayPerWave&&n>1')>=0);
  assert.ok(src.indexOf('player.harvStacks=0;')>=0);
});
test('NÔMADE: desconto de loja aplicado no preço (_mk + shopPersonal)',()=>{
  assert.ok(src.indexOf('shopPersonal')>=0);
  assert.ok(/_mk=\(\)=>\(\(player&&player\.markedUp\)\|\|1\)\*/.test(src),
    '_mk deve multiplicar shopPersonal');
});
test('HARDEN: kits médicos respeitam medBoost',()=>{
  assert.ok(src.indexOf('player.medBoost||1')>=0);
});

/* 6. Shield dos 8 operadores (integração PR #4) */
test('Todos os 8 têm Shield válido e inicializado',()=>{
  for(const C of T.CHARS){
    assert.ok(C.shieldMax>0,C.id+' shieldMax');
    assert.ok(C.shieldRegen>0,C.id+' shieldRegen');
    assert.ok(C.shieldDelay>0,C.id+' shieldDelay');
    assert.strictEqual(C.shieldStart,1,C.id+' shieldStart');
  }
  T.CHARS.forEach((C,i)=>{
    const p=freshRun(i);
    assert.strictEqual(p.shieldMax,C.shieldMax,C.id+' p.shieldMax');
    assert.strictEqual(Math.round(p.shield),Math.round(C.shieldMax),C.id+' shield inicial');
    assert.strictEqual(p.shieldDelayT,0,C.id+' delay inicial');
  });
});
test('HARDEN pode quebrar o Shield e continuar recebendo dano no HP',()=>{
  const p=freshRun(4);p.hp=112;p.shield=p.shieldMax;
  T.damagePlayer(p.shieldMax+10);
  assert.strictEqual(p.shield,0);
  assert.ok(p.hp<112&&p.hp>=102,'hp='+p.hp);
});

/* 7. desbloqueios dos 3 operadores recuperados */
test('UNLOCKS: c_warden/c_nomad/c_revenant presentes com as metas históricas',()=>{
  assert.ok(T.UNLOCKS.c_warden&&T.UNLOCKS.c_warden.need()===false);
  const w=T.UNLOCKS.c_warden;
  assert.strictEqual(w.txt,'Aplique 1500 efeitos de status');
  assert.strictEqual(w.max,1500);
  const n=T.UNLOCKS.c_nomad;
  assert.strictEqual(n.txt,'Acumule 10000 créditos');
  assert.strictEqual(n.max,10000);
  const r=T.UNLOCKS.c_revenant;
  assert.strictEqual(r.txt,'Elimine 2000 inimigos');
  assert.strictEqual(r.max,2000);
});
test('UNLOCKS: exatamente 6 operadores desbloqueáveis (2 iniciais + 6)',()=>{
  const cs=Object.keys(T.UNLOCKS).filter(k=>T.UNLOCKS[k].t==='c');
  assert.strictEqual(cs.length,6);
});

/* 8. módulos passivos restaurados (mecânicas suportadas) */
test('ITEMS: PRESAS DE VÁCUO / CAMPO MAGNÉTICO AMPLO / TECIDO AUTORREPARADOR restaurados',()=>{
  const vamp=T.itemById('su_vampiro');
  assert.ok(vamp,'su_vampiro');
  const im=T.itemById('su_imante');
  assert.ok(im,'su_imante');
  const reg=T.itemById('su_regen');
  assert.ok(reg,'su_regen');
  const p={globalLifesteal:0,medBoost:1};
  vamp.apply(p);
  assert.ok(Math.abs(p.globalLifesteal-.09)<1e-9);
  assert.ok(Math.abs(p.medBoost-1.2)<1e-9);
  const q={pickupR:100,pickupSpd:1};
  im.apply(q);
  assert.ok(Math.abs(q.pickupR-220)<1e-9);
  assert.ok(Math.abs(q.pickupSpd-1.5)<1e-9);
  const r={regen:0,maxHp:100,hp:50};
  reg.apply(r);
  assert.ok(Math.abs(r.regen-2.2)<1e-9);
  assert.strictEqual(r.maxHp,125);
  assert.strictEqual(r.hp,75);
});
test('ITEMS: nenhum id duplicado',()=>{
  const ids=T.ITEMS.map(i=>i.id);
  assert.strictEqual(new Set(ids).size,T.ITEMS.length);
});

/* 9. sistemas modernos preservados (PRs #1–#4) */
test('PR #3: ECHO_SHIELD dos Ecos intacto',()=>{
  assert.ok(src.indexOf('const ECHO_SHIELD=[0,30,20]')>=0);
  assert.ok(src.indexOf('const ECHO_SHIELD_REGEN=[0,.06,.05]')>=0);
  assert.ok(src.indexOf('const ECHO_SHIELD_DELAY=[0,2.5,3]')>=0);
});
test('PR #4: regenPlayerShield() integrado no updatePlayer()',()=>{
  assert.ok(src.indexOf('function regenPlayerShield')>=0);
  assert.ok(src.indexOf('regenPlayerShield(p,dt)')>=0);
});
test('PR #1: analyzeEchoData() presente (classificação por arma real)',()=>{
  assert.ok(src.indexOf('function analyzeEchoData')>=0);
  assert.ok(/melee|range/.test(src.match(/function analyzeEchoData[\s\S]{0,600}/)[0]),
    'usa as propriedades reais da arma');
});
test('Grade de seleção 4 × 2 (8 cards, sem corte)',()=>{
  assert.ok(html.indexOf('grid-template-columns:repeat(4,96px)')>=0,
    'CSS com grade 4 colunas');
  assert.ok(src.indexOf('#ov-char')>=0,'contêiner do seletor');
});
test('Migração de save v1 → v2 preserva a escolha (ECHO-0: 4 → 6)',()=>{
  assert.ok(src.indexOf("const CHAR_KEY='echoChar.v2'")>=0);
  assert.ok(src.indexOf('const CHAR_KEY_OLD')>=0);
  assert.ok(src.indexOf('CHAR_LEGACY_IDX')>=0);
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
process.exit(failed?1:0);
