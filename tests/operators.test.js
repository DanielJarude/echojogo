'use strict';
/* =====================================================================
   TESTES — Restauração dos 8 operadores originais (ECHO)
   Harness igual ao de shield.test.js: executa o script REAL de index.html
   em um sandbox Node com DOM mínimo. Rodar: npm test
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const {readGameHtml,readGameSource,runGameSource}=require('./harness/load-game');
const html=readGameHtml();
const GAME_SRC=readGameSource();
let src=GAME_SRC;

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
runGameSource(src,sandbox);
const T=sandbox.__t;
/* AUDIT-FIX-E2B: acesso ao escopo do jogo (const/let de topo não viram
   propriedade do global, mas seguem visíveis para scripts do mesmo contexto). */
const X=code=>vm.runInContext(code,sandbox);
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
test('sp: turret/cache/harvest são habilidades REAIS (efeito observável)',()=>{
  /* AUDIT-FIX-E2B: antes procurava "case 'turret':" no texto. Agora cada
     habilidade é ATIVADA pelo caminho real (trySpecial) e o efeito é
     observado — um `case` presente mas quebrado deixa de passar. */
  const alvo=id=>T.CHARS.findIndex(c=>c.sp&&c.sp.id===id);
  for(const id of ['turret','cache','harvest']){
    const idx=alvo(id);
    assert.ok(idx>=0,'nenhum operador tem a habilidade '+id);
    const p=freshRun(idx);
    p.x=600;p.y=400;p.aim=0;p.spCd=0;p.hp=Math.max(1,p.maxHp-40);
    X('state="play"');X('allies=[]');X('enemies=[]');
    const hpAntes=p.hp,aliadosAntes=X('allies').length;
    X('trySpecial')();
    assert.ok(p.spCd>0,id+': a habilidade não entrou em cooldown (não executou)');
    if(id==='turret')
      assert.ok(X('allies').some(a=>a.turret),'turret não implantou torre');
    if(id==='cache')
      assert.ok(X('allies').length>aliadosAntes||X('pickups').length>0,
        'cache não produziu nada no mundo');
    if(id==='harvest')
      assert.ok(p.hp>=hpAntes,'harvest não pode custar vida');
  }
});
test('HARDEN: a torre atira sozinha, com dano que escala com a onda',()=>{
  /* AUDIT-FIX-E2B: antes eram dois indexOf ('a.turret' e 'dmg:11+wave*1.4').
     Agora a torre é implantada, um inimigo entra no alcance e o projétil
     produzido é inspecionado — inclusive a fórmula do dano, em duas ondas. */
  const idx=T.CHARS.findIndex(c=>c.sp&&c.sp.id==='turret');
  const disparo=onda=>{
    const p=freshRun(idx);
    p.x=600;p.y=400;p.aim=0;p.spCd=0;
    X('state="play"');X('allies=[]');X('enemies=[]');X('projectiles=[]');
    X('wave='+onda);
    X('trySpecial')();
    const torre=X('allies').find(a=>a.turret);
    assert.ok(torre,'torre não implantada');
    X('spawnEnemy')('chaser',torre.x+80,torre.y,onda);
    const alvo=X('enemies')[0];alvo.spawnT=0;
    for(let i=0;i<180&&!X('projectiles').some(q=>q.team==='ally');i++){
      alvo.x=torre.x+80;alvo.y=torre.y;
      X('updateAllies')(1/60);
    }
    const proj=X('projectiles').find(q=>q.team==='ally');
    assert.ok(proj,'a torre não atirou na onda '+onda);
    return proj.dmg;
  };
  assert.ok(Math.abs(disparo(5)-(11+5*1.4))<1e-9,'dano da torre na onda 5');
  assert.ok(Math.abs(disparo(12)-(11+12*1.4))<1e-9,'dano da torre na onda 12');
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
  /* PR14.5 B3 §18: rework aprovado — PRESAS deixou de ser "lifesteal melhor"
     (esse papel é do DRENO SANGUÍNEO, calibração) e passou a ser FOME DE
     VÁCUO: proc determinístico a cada 3 abates (+8 HP) + cura recebida. */
  const p={globalLifesteal:0,medBoost:1};
  vamp.apply(p);
  assert.strictEqual(p.killHealEvery,3,'fome de vácuo: janela de 3 abates');
  assert.ok(Math.abs(p.killHealAmount-8)<1e-9,'cura +8 por presa');
  assert.ok(Math.abs(p.medBoost-1.2)<1e-9,'+20% cura recebida preservado');
  assert.ok(!(p.globalLifesteal>0),'sem lifesteal (não compete com o DRENO)');
  /* PR 7: o efeito de stat é resolvido pelo PIPELINE a partir da base
     (pickupR base 170) + multiplicadores — não por mutação direta. */
  const q=T.getPlayer();                       // player real do pipeline
  im.apply(q);
  assert.ok(Math.abs(q.pickupR-170*2.2)<1e-6,'pickupR='+q.pickupR);
  assert.strictEqual(q.pickupSpd,1.5);
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
  /* AUDIT-FIX-E2B: valores lidos do jogo, não casados no texto da fonte. */
  const arr=n=>Array.from(X(n));        // o array vem de outro realm do vm
  assert.deepStrictEqual(arr('ECHO_SHIELD'),[0,30,20]);
  assert.deepStrictEqual(arr('ECHO_SHIELD_REGEN'),[0,.06,.05]);
  assert.deepStrictEqual(arr('ECHO_SHIELD_DELAY'),[0,2.5,3]);
});
test('PR #4: regenPlayerShield() integrado no updatePlayer()',()=>{
  /* AUDIT-FIX-E2B: provado por execução — updatePlayer chama o regen e o
     Shield realmente volta. */
  const p=freshRun(0);
  p.shieldMax=30;p.shield=0;p.shieldRegen=.1;p.shieldDelayT=0;
  const orig=sandbox.regenPlayerShield;let chamadas=0;
  sandbox.regenPlayerShield=function(){chamadas++;return orig.apply(this,arguments);};
  try{for(let i=0;i<120;i++)X('updatePlayer')(1/60);}
  finally{sandbox.regenPlayerShield=orig;}
  assert.ok(chamadas>0,'updatePlayer não chama regenPlayerShield');
  assert.ok(p.shield>0,'Shield não regenerou pelo caminho real');
});
test('PR #1: analyzeEchoData() classifica por arma real (melee vs ranged)',()=>{
  /* AUDIT-FIX-E2B: antes verificava o nome da função e procurava 'melee|range'
     nos primeiros 600 caracteres do corpo. Agora a função é EXECUTADA sobre
     filas de Echo opostas e a classificação é comparada. */
  const W=X('WEAPONS');
  let iPerto=-1,iLonge=-1;
  for(let i=0;i<W.length;i++){
    const d=W[i];
    if(d&&(d.melee||d.range<300)){if(iPerto<0)iPerto=i;}
    else if(iLonge<0)iLonge=i;
  }
  assert.ok(iPerto>=0&&iLonge>=0,'faltam armas de perto/longe no catálogo');
  const N=40;
  const trilha=wi=>({dur:20,trail:Array.from({length:N},(_,i)=>[i*.5,100+i,100,0,0,wi]),
    items:[],upg:[],owned:[0],moral:{comp:0,greed:0,viol:0},dom:'neutro'});
  const classificar=wi=>{X('echoQueue='+JSON.stringify([trilha(wi),trilha(wi)]));
    return X('analyzeEchoData')();};
  const a=classificar(iPerto),b=classificar(iLonge);
  for(const r of [a,b]){
    assert.ok(r&&typeof r==='object','analyzeEchoData não devolveu leitura');
    assert.ok(['melee','ranged'].indexOf(r.mode)>=0,'modo inesperado: '+r.mode);
    assert.strictEqual(r.total,2*N,'conta os checkpoints das trilhas');
  }
  assert.strictEqual(a.mode,'melee','arma de perto deveria ler como melee');
  assert.strictEqual(b.mode,'ranged','arma de longe deveria ler como ranged');
  X('echoQueue=[]');
});
test('Grade de seleção 4 × 2 (8 cards, sem corte)',()=>{
  // a largura da célula acompanha a escala tipográfica (PR 6.5) e, desde a
  // correção de responsividade, também a ALTURA da viewport (clamp) — o
  // que importa continua sendo a grade ter 4 colunas → 8 operadores
  assert.ok(/grid-template-columns:repeat\(4,\s*(?:[0-9.]+px|clamp\([^)]*\))\)/.test(html),
    'CSS com grade 4 colunas');
  assert.ok(src.indexOf('#ov-char')>=0,'contêiner do seletor');
});
test('Migração de save v1 → v2 preserva a escolha (ECHO-0: 4 → 6)',()=>{
  /* AUDIT-FIX-E2B: antes eram três indexOf em nomes de constantes — provavam
     que os símbolos existiam, nada sobre a migração. Agora a TABELA é lida do
     jogo e o mapeamento é conferido contra os IDs canônicos dos operadores. */
  assert.strictEqual(X('CHAR_KEY'),'echoChar.v2');
  assert.strictEqual(X('CHAR_KEY_OLD'),'echoChar.v1');
  const MAP=X('CHAR_LEGACY_IDX');
  assert.ok(Array.isArray(MAP)&&MAP.length===5,'tabela de migração v1→v2');
  /* o save v1 tinha 5 operadores, nesta ordem; ECHO-0 era o índice 4 */
  const ORDEM_V1=['vector','wraith','bulwark','pyre','echo0'];
  MAP.forEach((novo,antigo)=>{
    assert.ok(novo>=0&&novo<T.CHARS.length,'índice v2 fora da faixa: '+novo);
    assert.strictEqual(T.CHARS[novo].id,ORDEM_V1[antigo],
      'save v1 idx '+antigo+' deveria migrar para '+ORDEM_V1[antigo]);
  });
  assert.strictEqual(MAP[4],6,'ECHO-0 migra de 4 para 6');
  assert.strictEqual(new Set(MAP).size,MAP.length,'migração não pode colidir');
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
process.exit(failed?1:0);
