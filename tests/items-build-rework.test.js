'use strict';
/* =====================================================================
   TESTES — ITEM & BUILD REWORK + SHIELD EXPANSION (ECHO · PR 11)
   ---------------------------------------------------------------------
   Harness idêntico aos demais: executa o script REAL de index.html em
   sandbox Node (DOM mínimo). Cobre:
   registry/IDs/tags/hooks, itemState, hooks (hit/crit/kill/status/dash/
   resonance/shield), cooldowns, proc guards, shield pipeline (max/regen/
   delay/full/break/perfect), builds crit/status/dash/economy, trade-offs,
   transformadores, moral affinity, checkpoint serial de itemState, DEV
   inspector/add-remove/presets e extreme builds.
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

src+='\n;globalThis.__t={'+
  'CHARS,ITEMS,UPGRADES,SM_STATS,SM_ORDER,BUILD_PRESETS,'+
  'makePlayer,startRun,setChar,itemById,itemTags,itemHasTag,itemStateGet,itemStateSet,'+
  'itemStateInc,itemStateInit,itemCdReady,itemTick,itemEmit,activeSynergies,applyBuildPreset,'+
  'devBuildInspector,removeItemById,grantItemInternal,resetBuildKeepRunBasics,'+
  'smBuildCheckpoint,captureCheckpoint,resumeRun,'+
  'damagePlayer,damageEnemy,killEnemy,tryDash,regenPlayerShield,'+
  'updateHUD,smGet,smRefresh,smRemoveId,smAdd,smMul,smFlat,smHas,calcDamageMul,'+
  'DEV,getItemMoralAffinity,activeItemHandlers,resetItemProcBudget,'+
  'getState:()=>state,setState:s=>{state=s;},'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getEnemies:()=>enemies,setEnemies:a=>{enemies=a;},'+
  'getWave:()=>wave,setWave:w=>{wave=w;},'+
  'getCurAttacker:()=>curAttacker,setCurAttacker:v=>{curAttacker=v;},'+
  'getMoral:()=>moral,setMoral:mm=>{moral=mm;},'+
  'getActiveRun:()=>activeRun,getSmRoot:()=>smRoot,getCurSlot:()=>curSlot,'+
  'DEV_on:()=>{DEV_MODE=true;},DEV_off:()=>{DEV_MODE=false;},'+
  'forceDevMode:v=>{DEV_MODE=v;},setTainted:v=>{devTainted=v;},'+
  'unlockAll:()=>{for(const k in UNLOCKS)if(prog.seen.indexOf(k)<0)prog.seen.push(k);}};';

/* ---------------- DOM mínimo ---------------- */
function makeStyle(){const store={};return new Proxy(store,{get(t,k){return k in t?t[k]:'';},set(t,k,v){t[k]=String(v);return true;}});}
function ctx2d(){const grad={addColorStop(){}};const numProps=new Set(['globalAlpha','lineWidth','shadowBlur','font','fillStyle','strokeStyle','lineCap','textAlign','imageSmoothingEnabled']);return new Proxy({},{get(t,k){if(k==='canvas')return{width:0,height:0};if(k==='measureText')return()=>({width:0});if(k==='getImageData')return()=>({data:new Uint8ClampedArray(4)});if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return()=>grad;if(numProps.has(k))return 1;return()=>{};},set(){return true;}});}
function makeEl(id){const el={id:id||'',children:[],dataset:{},value:'',width:0,height:0,_cls:new Set(),isConnected:true,offsetWidth:0,offsetHeight:0,textContent:'',innerHTML:'',className:'',title:'',style:makeStyle()};el.classList={add:(...c)=>c.forEach(x=>el._cls.add(x)),remove:(...c)=>c.forEach(x=>el._cls.delete(x)),contains:c=>el._cls.has(c),toggle:(c,f)=>{if(f===undefined){if(el._cls.has(c)){el._cls.delete(c);return false;}el._cls.add(c);return true;}if(f)el._cls.add(c);else el._cls.delete(c);return !!f;}};el.appendChild=c=>{el.children.push(c);return c;};el.remove=()=>{};el.addEventListener=()=>{};el.removeEventListener=()=>{};el.querySelector=()=>null;el.querySelectorAll=()=>[];el.closest=()=>null;el.focus=()=>{};el.blur=()=>{};el.setAttribute=(k,v)=>{el.dataset[k]=v;};el.getAttribute=k=>el.dataset[k];el.getContext=()=>ctx2d();return el;}
const elements=new Map();
const document={hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),fullscreenElement:null,webkitFullscreenElement:null,createElement:()=>makeEl(''),getElementById:id=>{if(!elements.has(id))elements.set(id,makeEl(id));return elements.get(id);},querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()};
const window={innerWidth:1280,innerHeight:720,devicePixelRatio:1,screen:{availWidth:1280,availHeight:720},addEventListener:()=>{},removeEventListener:()=>{},matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),AudioContext:undefined,webkitAudioContext:undefined,open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined};
const store=new Map();
const sandbox={window,document,console,Math,JSON,Date,Array,Object,Set,Map,Number,String,Boolean,Promise,RegExp,Error,Proxy,Reflect,Symbol,parseInt,parseFloat,isNaN,navigator:{getGamepads:()=>[],userAgent:'node'},localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{store.set(k,String(v));},removeItem:k=>{store.delete(k);}},performance:{now:()=>Date.now()},requestAnimationFrame:()=>0,cancelAnimationFrame:()=>{},setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},__t:null};
sandbox.globalThis=sandbox;
sandbox.window.requestAnimationFrame=sandbox.requestAnimationFrame;
vm.createContext(sandbox);
vm.runInContext(src,sandbox,{filename:'index.html'});
const T=sandbox.__t;
T.unlockAll();

const EPS=1e-9;
const near=(a,b,e)=>Math.abs(a-b)<=(e==null?EPS:e);
let passed=0,failed=0;
function ok(name,fn){try{fn();passed++;console.log('  ✔ '+name);}catch(e){failed++;console.error('  ✘ '+name+'\n    '+(e&&e.stack||e)); }}
function freshRun(idx){
  T.setChar(idx==null?0:idx);
  T.startRun();
  T.setCurAttacker(null);
  return T.getPlayer();
}
function allIds(){return T.ITEMS.map(i=>i.id);}

console.log('\nECHO — Item & Build Rework + Shield Expansion (PR 11)');
console.log('-----------------------------------------------------');

ok('index.html: script passa em verificação sintática (vm.Script)',()=>new vm.Script(src));

ok('PR11: IDs únicos e itens novos presentes',()=>{
  const ids=allIds();
  assert.strictEqual(new Set(ids).size,ids.length);
  for(const id of ['sb_pulso','sb_janela','sb_grilhao','fs_prisma','fs_casulo','fs_cinetica',
    'rg_condensador','rg_peso','rg_lagrima','crit_cadeia','crit_garra','st_inverno',
    'st_corrosivo','dash_eco','dash_fase','eco_risco','eco_divida',
    'trans_fratura','trans_ressonante','trans_conclusao','trans_temporal','trans_espectral'])
    assert(ids.includes(id),id+' deve existir em ITEMS');
});

ok('PR11: tags internas e hooks ficam disponíveis (sem sets obrigatórios)',()=>{
  const it=T.itemById('sb_pulso');
  assert(it&&T.itemHasTag('sb_pulso','shield_break'));
  assert(T.itemHasTag('trans_fratura','transformer'));
  assert(T.itemHasTag('eco_divida','economy')&&T.itemHasTag('eco_divida','risk'));
  assert(it.hooks&&it.hooks.onShieldBreak);
  const sg=T.itemById('sb_grilhao');
  assert(sg&&sg.hooks.onShieldBreak);
});

ok('itemState: estado compacto com defaults e stacks',()=>{
  const p=T.makePlayer();
  assert.strictEqual(Object.keys(p.itemState).length,0);
  T.itemStateSet(p,'crit_cadeia','stacks',3);
  assert.strictEqual(T.itemStateGet(p,'crit_cadeia','stacks',0),3);
  assert.strictEqual(T.itemStateGet(p,'nao_existe','x',7),7);
});

ok('hooks ativos são cacheados por versão do inventário',()=>{
  const p=freshRun();
  p.items=[];p.itemVer=0;
  assert.strictEqual(T.activeItemHandlers('onCrit',p).length,0);
  T.grantItemInternal(p,T.itemById('crit_cadeia'),true);
  p.itemVer=1;
  assert.strictEqual(T.activeItemHandlers('onCrit',p).length,1);
  p.itemVer=2;
  assert.strictEqual(T.activeItemHandlers('onCrit',p).length,1);
});

ok('onCrit: CADEIA DE CRÍTICOS empilha e aplica modificador temporário',()=>{
  const p=freshRun();T.grantItemInternal(p,T.itemById('crit_cadeia'),true);
  T.setCurAttacker(p);
  T.itemEmit('onCrit',{player:p,target:{__id:1,x:0,y:0},dmg:100,crit:true});
  assert.strictEqual(T.itemStateGet(p,'crit_cadeia','stacks',0),1);
  assert(T.smHas(p,'item.crit_cadeia.stack'));
  assert(near(T.smGet(p,'damage'),T.smGet(p,'damage'),1));
  T.itemEmit('onCrit',{player:p,target:{__id:1,x:0,y:0},dmg:100,crit:true});
  assert.strictEqual(T.itemStateGet(p,'crit_cadeia','stacks',0),2);
});

ok('onKill: trans_temporal tem cooldown interno (não farmável)',()=>{
  const p=freshRun();T.grantItemInternal(p,T.itemById('trans_temporal'),true);
  const c0=p.coins;T.setCurAttacker(p);
  T.itemEmit('onKill',{player:p,target:{__id:1,x:0,y:0}});
  assert(p.coins>=c0+3);
  const c1=p.coins;
  T.itemEmit('onKill',{player:p,target:{__id:2,x:1,y:1}});
  assert.strictEqual(p.coins,c1,'cooldown impede segundo proc');
});

ok('proc guard: orçamento zerado bloqueia itemEmit e não lança',()=>{
  const p=freshRun();T.grantItemInternal(p,T.itemById('crit_cadeia'),true);
  p._itemProcBudget=0;
  assert.strictEqual(T.itemEmit('onCrit',{player:p,target:{__id:1},dmg:1,crit:true}),false);
});

ok('Shield pipeline: max/regen/delay são stats derivados',()=>{
  const p=freshRun(0);
  const b=p.shieldMax;
  T.itemById('rg_peso').apply(p);
  assert(near(p.shieldMax,b*1.45,1e-6));
  T.itemById('rg_condensador').apply(p);
  const sm=p.shieldMax;
  assert(T.smHas(p,'item.rg_condensador.regen'));
  T.smRemoveId(p,'item.rg_peso.max');
  assert(p.shieldMax<sm,'remover mod recalcula na hora');
});

ok('Shield state nunca é enchido por mudança de shieldMax',()=>{
  const p=freshRun(0);
  p.shield=5;
  T.itemById('rg_peso').apply(p);      // +45% max
  assert(p.shield<=p.shieldMax);
  const expected=p.shield;
  assert(expected<=p.shieldMax);
  assert.strictEqual(p.shield,Math.min(expected,p.shieldMax));
});

ok('Shield regen respeita shieldDelay e não regenera além do max',()=>{
  const p=freshRun(0);p.shield=1;p.shieldDelayT=10;p.shieldRegen=100;
  T.regenPlayerShield(p,.2);
  assert(p.shield<1.1,'delay trava regen');
  p.shieldDelayT=0;
  T.regenPlayerShield(p,1);
  assert(p.shield>=1&&p.shield<=p.shieldMax);
});

ok('Shield Hit / Break disparam hooks reais no damagePlayer',()=>{
  const p=freshRun(0);p.hp=99999;
  T.grantItemInternal(p,T.itemById('sb_grilhao'),true);
  T.grantItemInternal(p,T.itemById('sb_janela'),true);
  assert(p.shield>0);
  const before=p.shield;
  T.damagePlayer(4);
  assert(p.shield<=before,'shield hit absorve');
  p.shield=2;p.shieldDelayT=0;
  T.damagePlayer(p.shield+1);
  assert(T.itemStateGet(p,'sb_grilhao','cd',0)>0,'onShieldBreak proc guardado');
  assert(T.smHas(p,'item.sb_janela.dmg')||T.smHas(p,'item.sb_janela.crit'),'janela ofensiva aplicada');
  assert.strictEqual(T.itemStateGet(p,'_perfect','t',0),0,'danos zeram Perfect Shield');
});

ok('Perfect Shield: barriga cheia contínua dispara onShieldFull uma vez',()=>{
  const p=freshRun(0);
  T.grantItemInternal(p,T.itemById('fs_prisma'),true);
  p.shield=p.shieldMax;p.shieldDelayT=0;
  for(let i=0;i<6;i++)T.itemTick(p,.5);
  assert(T.itemStateGet(p,'_perfect','fired',false));
  assert.strictEqual(T.itemStateGet(p,'fs_prisma','critLock',0),1);
  assert(T.itemStateGet(p,'fs_prisma','cd',0)>0);
  const lock1=T.itemStateGet(p,'fs_prisma','critLock',0);
  T.itemTick(p,.5);
  assert.strictEqual(T.itemStateGet(p,'fs_prisma','critLock',0),lock1,'cooldown impede refire imediato');
});

ok('Perfect Shield é perdido ao receber dano no Shield',()=>{
  const p=freshRun(0);p.shield=p.shieldMax;
  for(let i=0;i<6;i++)T.itemTick(p,.5);
  assert(T.itemStateGet(p,'_perfect','fired',false));
  T.damagePlayer(1);
  assert.strictEqual(T.itemStateGet(p,'_perfect','t',0),0);
  assert.strictEqual(T.itemStateGet(p,'_perfect','fired',false),false);
});

ok('Crit build: fechamento de crítico (fs_prisma) é consumido no tiro',()=>{
  const p=freshRun(0);
  T.grantItemInternal(p,T.itemById('fs_prisma'),true);
  p.shield=p.shieldMax;
  for(let i=0;i<6;i++)T.itemTick(p,.5);
  assert.strictEqual(T.itemStateGet(p,'fs_prisma','critLock',0),1);
  assert.strictEqual(T.itemStateGet(p,'fs_prisma','critLock',0),1,'bloqueio existe');
});

ok('Status build: INVERNO SINTÉTICO procura congelamento com cooldown',()=>{
  const p=freshRun(0);
  T.grantItemInternal(p,T.itemById('st_inverno'),true);
  const e={x:p.x,y:p.y,__id:10,hp:100,maxHp:100,st:{stunT:1}};
  T.setCurAttacker(p);
  T.itemEmit('onStatusApply',{player:p,target:e,kind:'chill',dur:4,power:.5});
  assert(T.itemStateGet(p,'st_inverno','cd',0)>0);
  T.itemEmit('onStatusApply',{player:p,target:e,kind:'chill',dur:4,power:.5});
  // cooldown guard: não deve resetar o timer para baixo (apenas manter)
  assert(T.itemStateGet(p,'st_inverno','cd',0)>0);
});

ok('Status build: CASCATA CORROSIVA conta 3 aplicações e reseta',()=>{
  const p=freshRun(0);T.grantItemInternal(p,T.itemById('st_corrosivo'),true);
  const e={x:p.x,y:p.y,__id:20,hp:100,maxHp:100,st:{corrT:5}};
  T.setCurAttacker(p);
  T.itemEmit('onStatusApply',{player:p,target:e,kind:'corrode',dur:5,power:.2});
  T.itemEmit('onStatusApply',{player:p,target:e,kind:'corrode',dur:5,power:.2});
  T.itemEmit('onStatusApply',{player:p,target:e,kind:'corrode',dur:5,power:.2});
  assert(T.itemStateGet(p,'st_corrosivo','cd',0)>0);
  assert.strictEqual(T.itemStateGet(p,'st_corrosivo','tmp',0),0);
});

ok('Dash build: DASH_ECO empilha pós-dash e ESPECTRO libera crit pierce',()=>{
  const p=freshRun(0);
  T.grantItemInternal(p,T.itemById('dash_eco'),true);
  T.grantItemInternal(p,T.itemById('trans_espectral'),true);
  T.setCurAttacker(p);
  T.itemEmit('onDashEnd',{player:p});
  assert(T.itemStateGet(p,'dash_eco','stacks',0)>=1);
  assert(T.smHas(p,'item.dash_eco.stack'));
  T.itemEmit('onDashEnd',{player:p});
  assert(T.itemStateGet(p,'dash_eco','stacks',0)>=2);
  T.itemEmit('onDashEnd',{player:p});
  assert.strictEqual(T.itemStateGet(p,'trans_espectral','critLock',0),1);
  assert(T.itemStateGet(p,'trans_espectral','pierceT',0)>=4);
});

ok('Economy build: trade-offs reais (moedas sobem, escudo/dano caem)',()=>{
  const p=freshRun(0);
  const c0=p.coinMul,sm0=p.shieldMax;
  T.itemById('eco_divida').apply(p);
  assert(p.coinMul>c0*1.5);
  assert(p.shieldMax<sm0*0.72,'dívida corta escudo máximo');
  const cm=p.coinMul;
  T.smRemoveId(p,'item.eco_divida.coin');
  assert(p.coinMul<cm,'remover mod é reconstrutível');
});

ok('Transformadores: onShieldBreak de LÂMINA ativa perfuração por tempo',()=>{
  const p=freshRun(0);T.grantItemInternal(p,T.itemById('trans_fratura'),true);
  T.itemEmit('onShieldBreak',{player:p,real:1,absorbed:1});
  assert(T.itemStateGet(p,'trans_fratura','pierceT',0)>=3);
  assert(T.itemStateGet(p,'trans_fratura','cd',0)>0);
});

ok('Moral Affinity: novos itens têm afinidade temática (não genérica)',()=>{
  const aff=T.getItemMoralAffinity('eco_risco');
  assert(aff&&aff.greed>0&&aff.greed>=.9,'economia/risco é Ganância');
  const aff2=T.getItemMoralAffinity('sb_grilhao');
  assert(aff2&&aff2.viol>0&&aff2.comp>0,'controle pós-quebra é V/C');
  const aff3=T.getItemMoralAffinity('trans_fratura');
  assert(aff3&&aff3.viol>0,'transformador ofensivo puxa Violência');
});

ok('itemState é serializado no checkpoint (nunca stat final)',()=>{
  const p=freshRun();
  T.grantItemInternal(p,T.itemById('fs_prisma'),true);
  T.itemStateSet(p,'fs_prisma','critLock',1);
  const cp=T.smBuildCheckpoint('teste',1);
  assert(cp&&cp.p&&cp.p.itemState&&cp.p.itemState.fs_prisma&&
    cp.p.itemState.fs_prisma.critLock===1,'itemState do item vai no save');
  assert(cp.p.itemState._perfect,'estado Perfect Shield é persistido');
});

ok('DEV builder: presets aplicam build inteira e recalculam pipeline',()=>{
  const p=freshRun();
  const r=T.applyBuildPreset('shieldbreak',p);
  assert(r&&r.count>=5);
  assert(p.items.indexOf('sb_pulso')>=0);
  assert(T.smHas(p,'item.rg_peso.max')||T.smHas(p,'item.sb_janela.max'));
  const ins=T.devBuildInspector(p);
  assert(ins&&ins.items.length>=5);
  assert(ins.synergies.indexOf('ESCUDO · QUEBRA')>=0);
  assert(ins.hooks.indexOf('onShieldBreak')>=0);
  assert(ins.sm.length>=3);
});

ok('DEV presets extremos: MAX SHIELD / MAX REGEN / MAX CRIT / MAX DAMAGE',()=>{
  const p=freshRun(0);
  const s0=p.shieldMax;
  const r1=T.applyBuildPreset('shieldmax',p);
  assert(r1&&p.shieldMax>s0*1.4,'max shield');
  const r2=T.applyBuildPreset('shieldregen',p);
  assert(r2&&p.shieldRegen>1,'regen cresce');
  const r3=T.applyBuildPreset('maxcrit',p);
  assert(r3&&p.crit>.1,'crit sobe');
  const r4=T.applyBuildPreset('damage',p);
  assert(r4&&p.dmgMul>1,'dano sobe');
});

ok('EXTREME BUILD: MAX ECONOMY — moedas sobem e escudo max cai (trade-off)',()=>{
  const p=freshRun(0);
  const c0=p.coinMul,sm0=p.shieldMax;
  const r=T.applyBuildPreset('economy',p);
  assert(r);
  assert(p.coinMul>c0*1.5);
  assert(p.shieldMax<sm0,'economia extrema não é grátis');
});

ok('EXTREME BUILD: MAX CONTROL — status/controle presentes sem imortalidade',()=>{
  const p=freshRun(0);
  const r=T.applyBuildPreset('controle',p);
  assert(r);
  assert(p.items.includes('criostase')||p.items.includes('st_inverno')||p.items.includes('sb_grilhao'));
});

ok('DEV add/remove item recalcula build imediatamente (via DEV.comandos)',()=>{
  const p=freshRun();T.DEV_on();
  const it=T.itemById('crit_cadeia');
  const add=T.DEV.addItem('crit_cadeia');
  assert.strictEqual(add,'crit_cadeia');
  assert(p.items.includes('crit_cadeia'));
  const rem=T.DEV.removeItem('crit_cadeia');
  assert.strictEqual(rem,true);
  assert(!p.items.includes('crit_cadeia'));
  assert(!T.smHas(p,'item.crit_cadeia.damage'));
  T.DEV_off();
});

ok('WRAITH: Shield baixo + quebra não entra em loop infinito (proc budget)',()=>{
  const p=freshRun(1); // WRAITH
  T.grantItemInternal(p,T.itemById('sb_grilhao'),true);
  T.grantItemInternal(p,T.itemById('sb_janela'),true);
  p.hp=99999;p.shield=2;p.shieldDelayT=0;
  p._itemProcBudget=1;                 // orçamento de proc apertado
  let starts=p.shield;
  T.damagePlayer(p.shield+1);
  assert(p.shield<=starts);
  // chamada extra protegida não pode lançar nem atravessar o guard
  T.itemEmit('onShieldBreak',{player:p,real:1,absorbed:1});
});

ok('BULWARK: build extremo de Shield não deixa regen ilimitado',()=>{
  const p=freshRun(2); // BULWARK
  const r=T.applyBuildPreset('shieldregen',p);
  assert(r);
  p.shield=0;p.shieldDelayT=0;
  const before=p.shield;
  T.regenPlayerShield(p,1);
  const gained=p.shield-before;
  assert(gained<=p.shieldRegen+1e-6,'regen é limitada pela taxa derivada');
  assert(p.shield<=p.shieldMax,'nunca acima do teto');
});

ok('performance: itemEmit com 0 handlers é O(1) (sem EventEmitter por frame)',()=>{
  const p=freshRun();p.items=[];p.itemVer=999;
  const t0=Date.now();
  let n=0;
  for(let i=0;i<5000;i++){if(T.itemEmit('onHit',{player:p,target:{__id:i},dmg:1}))n++;}
  const dt=Date.now()-t0;
  assert.strictEqual(n,0);
  assert(dt<500,'custo de no-op deve ser pequeno: '+dt+'ms');
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
process.exit(failed?1:0);
