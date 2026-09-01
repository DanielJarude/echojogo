'use strict';
/* =====================================================================
   TESTES — SAVE SLOTS + RUN CONTINUÁVEL + FLUXO DE MORTE (ECHO · PR 7.5)
   ---------------------------------------------------------------------
   Cobertura:
   · estrutura do schema v3 (3 slots independentes + lastSlot);
   · isolamento total entre slots (meta, prog/unlocks, operador, Ecos);
   · slot vazio → inicialização sem tocar os outros;
   · migração do save da Alpha → SAVE 1 (uma única vez, sem duplicar);
   · activeRun: criação, checkpoint, retomada, morte, vitória, confirmação;
   · Stat Pipeline: restaurar NÃO duplica multiplicadores (1.30 ≠ 1.69);
   · morte: activeRun limpa e NENHUM restart automático (nem por timer).
   Executa o script REAL de index.html em um sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/saveslots.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

/* expõe símbolos top-level (const/let não viram props do global) */
src+=';globalThis.__t={'+
  'CHARS,WEAPONS,ITEMS,MAX_WAVE,SM_STATS,SM_ORDER,SM_KEY,'+
  'makePlayer,smRefresh,smGet,smAdd,calcDamageMul,'+
  'startRun,resumeRun,resetRunWorld,onPlayerDeath,tickFracture,beginNextRun,'+
  'onVictory,spawnWave,'+
  'smLoadRoot,smBoot,smMigrateLegacy,activateSlot,clearActiveRun,'+
  'captureCheckpoint,hasActiveRun,checkpointShopPurchase,'+
  'setChar,saveEchoes,loadEchoes,saveProg,saveMeta,loadProg,loadMeta,checkUnlocks,'+
  'getState:()=>state,setState:s=>{state=s;},'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getWave:()=>wave,setWave:w=>{wave=w;},'+
  'getMeta:()=>meta,getProg:()=>prog,'+
  'getEchoQueue:()=>echoQueue,setEchoQueue:q=>{echoQueue=q;},'+
  'getCharSel:()=>charSel,getCurSlot:()=>curSlot,'+
  'getActiveRun:()=>activeRun,getSmRoot:()=>smRoot,'+
  'getRunTime:()=>runTime,setRunTime:v=>{runTime=v;},'+
  'getKills:()=>kills,setKills:v=>{kills=v;},'+
  'getMoral:()=>moral,setMoral:mm=>{moral=mm;},'+
  'getFracT:()=>fracT,setFracT:v=>{fracT=v;},'+
  'getEnemies:()=>enemies,'+
  'showTitle,showSlotSelect,renderSlotSelect,pickSlot,showSlotMenu,'+
  'slotMenuAction,showSlotConfirm,doNewRun,backToMainMenu,'+
  'exitToSlotMenuFromDeath,victoryToMenu,'+
  'forceDevMode:v=>{DEV_MODE=v;},setTainted:v=>{devTainted=v;},'+
  'unlockAll:()=>{for(const k in UNLOCKS)if(prog.seen.indexOf(k)<0)prog.seen.push(k);}};';

/* ---------------- DOM mínimo ---------------- */
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
/* setTimeout sob observação: nenhum timer pode reiniciar uma run sozinho */
let scheduled=[];
function makeLocalStorage(seed){
  return {_d:Object.assign({},seed||{}),
    getItem(k){return Object.prototype.hasOwnProperty.call(this._d,k)?this._d[k]:null;},
    setItem(k,v){this._d[k]=String(v);},
    removeItem(k){delete this._d[k];}};
}
function makeSandbox(ls){
  scheduled=[];
  const document={
    hidden:false,title:'',body:makeEl('body'),documentElement:makeEl('html'),
    fullscreenElement:null,webkitFullscreenElement:null,
    createElement:()=>makeEl(''),
    getElementById:id=>makeEl(id),
    querySelectorAll:()=>[],addEventListener:()=>{},removeEventListener:()=>{},
    hasFocus:()=>true,exitFullscreen:()=>Promise.resolve()
  };
  const window={
    innerWidth:1280,innerHeight:720,devicePixelRatio:1,
    screen:{availWidth:1280,availHeight:720},
    addEventListener:()=>{},removeEventListener:()=>{},
    matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),
    AudioContext:undefined,webkitAudioContext:undefined,
    open:()=>({close(){}}),getGamepads:()=>[],echoDesktop:undefined,
    location:{search:'',hash:''}
  };
  const sandbox={console:{log(){},warn(){},error(){}},Math,Date,parseInt,parseFloat,
    isNaN,
    setTimeout:(fn,ms)=>{scheduled.push({fn,ms});return scheduled.length;},
    clearTimeout:()=>{},
    requestAnimationFrame:()=>0,
    Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
    Promise,Proxy,Reflect,JSON,Symbol,
    document,window,localStorage:ls,navigator,
    performance:{now:()=>Date.now()}
  };
  return sandbox;
}
function bootGame(seed){
  const ls=makeLocalStorage(seed);
  const sandbox=makeSandbox(ls);
  const ctx=vm.createContext(sandbox);
  vm.runInContext(src,ctx,{timeout:20000});
  const t=vm.runInContext('__t',ctx);
  t._ls=ls;
  return t;
}

/* ---------------- harness ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+(e&&e.stack||e));}
}
function freshRun(t){
  t.setPlayer(null);t.setWave(0);t.setState('title');
  t.startRun();
}

console.log('\nECHO — Save Slots + Run Continuável (PR 7.5)');
console.log('---------------------------------------------');

/* ==================== VERIFICAÇÃO SINTÁTICA ==================== */
ok('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(m[1]);
});

/* =====================================================================
   1. ESTRUTURA DO SCHEMA v3
   ===================================================================== */
const T=bootGame();

ok('Boot cria raiz v3 com 3 slots e lastSlot=1 (instalação nova)',()=>{
  const r=T.getSmRoot();
  assert(r,'smRoot não carregado');
  assert.strictEqual(r.version,3);
  assert(r.slots['1']&&r.slots['2']&&r.slots['3'],'os 3 slots devem existir');
  assert.strictEqual(r.lastSlot,1);
  assert.strictEqual(T.getCurSlot(),1,'boot ativa o último slot');
});

ok('Schema v3: nenhum resquício do formato antigo é gravado',()=>{
  const keys=Object.keys(T._ls._d);
  for(const k of keys)
    assert(k==='echoSave.v3'||k==='echoCfg.v1'||k==='echoAudio.v1',
      'chave inesperada no storage: '+k);
});

/* =====================================================================
   2. ISOLAMENTO ENTRE SLOTS
   ===================================================================== */
const V3={version:3,lastSlot:1,slots:{
  1:{meta:{mem:111,spd:2,reroll:1,vault:1,wins:3,endings:['liber']},
     prog:{kills:2400,best:14,runs:22,seen:['w_beam','c_echo0','c_revenant']},
     char:7,echoes:[],run:null,touched:true},
  2:{meta:null,prog:null,char:0,echoes:[],run:null,touched:false},
  3:{meta:null,prog:null,char:0,echoes:[],run:null,touched:false}}};

const S=bootGame({'echoSave.v3':JSON.stringify(V3)});

ok('Save 1 carrega meta, prog, operador e unlocks próprios',()=>{
  S.activateSlot(1);
  assert.strictEqual(S.getCurSlot(),1);
  assert.strictEqual(S.getMeta().mem,111);
  assert.strictEqual(S.getMeta().wins,3);
  assert.strictEqual(S.getProg().kills,2400);
  assert.strictEqual(S.getProg().best,14);
  assert(S.getProg().seen.indexOf('w_beam')>=0,'unlock w_beam deve pertencer ao Save 1');
  assert.strictEqual(S.getCharSel(),7,'operador do Save 1');
});

ok('Trocar para o Save 2 NÃO vaza nada do Save 1',()=>{
  S.activateSlot(2);
  assert.strictEqual(S.getCurSlot(),2);
  assert.strictEqual(S.getMeta().mem,0,'meta do Save 2 é zero');
  assert.strictEqual(S.getProg().kills,0);
  assert.strictEqual(S.getProg().best,0);
  assert.strictEqual(S.getProg().seen.length,0,'unlocks não vazam');
  assert.strictEqual(S.getEchoQueue().length,0,'Ecos não vazam');
  assert(!S.hasActiveRun(),'Save 2 não pode enxergar run do Save 1');
});

ok('Operador é por slot: alternar save não troca o operador dos outros',()=>{
  S.activateSlot(2);
  S.setChar(1);                          // WRAITH no Save 2
  S.activateSlot(1);
  assert.strictEqual(S.getCharSel(),7,'Save 1 continua ECHO-0/char 7');
  S.activateSlot(2);
  assert.strictEqual(S.getCharSel(),1,'Save 2 continua WRAITH');
  S.activateSlot(3);
  assert.strictEqual(S.getCharSel(),0,'Save 3 começa com o operador inicial');
});

ok('Echos são por slot: morte no Save 2 não cria Echo no Save 1',()=>{
  const trail=[];
  for(let i=0;i<8;i++)trail.push([i*.25,100+i,100,0,0,0]);
  S.activateSlot(2);
  S.setEchoQueue([{v:2,dur:12,trail,wave:9,level:4,items:[],upg:[],owned:[0],
    moral:{comp:0,greed:0,viol:0},dom:'neutro'}]);
  assert.strictEqual(S.saveEchoes(),true);
  S.activateSlot(1);
  assert.strictEqual(S.loadEchoes().length,0,'Save 1 não vê o Echo do Save 2');
  S.activateSlot(2);
  assert.strictEqual(S.loadEchoes().length,1,'Save 2 mantém o próprio Echo');
  S.activateSlot(3);
  assert.strictEqual(S.loadEchoes().length,0,'Save 3 não vê Ecos alheios');
});

ok('Progressão registrada num slot não aparece nos outros',()=>{
  S.activateSlot(3);
  S.getProg().kills=55;S.getProg().best=4;
  S.saveProg();
  S.activateSlot(1);
  assert.strictEqual(S.getProg().kills,2400,'Save 1 intacto');
  S.activateSlot(3);
  assert.strictEqual(S.getProg().kills,55,'Save 3 persistiu o próprio progresso');
});

ok('lastSlot lembra o último slot usado e sobrevive ao reinício',()=>{
  S.activateSlot(3);
  assert.strictEqual(S.getSmRoot().lastSlot,3);
  const R=bootGame(S._ls._d);            // "fecha e abre o jogo"
  assert.strictEqual(R.getSmRoot().lastSlot,3);
  assert.strictEqual(R.getCurSlot(),3,'boot reativa o último slot');
});

ok('Slot vazio (Save 3 no início) é detectado como NOVO SAVE',()=>{
  const B=bootGame({'echoSave.v3':JSON.stringify(V3)});
  B.activateSlot(2);   // toque no Save 2 para o teste abaixo ficar claro
  const b3=B.getSmRoot().slots['3'];
  assert.strictEqual(b3.touched,false,'Save 3 intocado');
  B.activateSlot(3);
  assert.strictEqual(B.getSmRoot().slots['3'].touched,true,
    'selecionar um slot vazio cria os dados base dele');
  assert.strictEqual(B.getSmRoot().slots['1'].touched,true,'Save 1 não é tocado de volta');
});

ok('Slot vazio inicializa com dados base sem copiar progresso alheio',()=>{
  const B=bootGame({'echoSave.v3':JSON.stringify(V3)});
  B.activateSlot(3);
  assert.strictEqual(B.getMeta().mem,0,'sem memória herdada');
  assert.strictEqual(B.getProg().seen.length,0,'sem unlocks herdados');
  assert.strictEqual(B.getEchoQueue().length,0,'sem Ecos herdados');
  assert.strictEqual(B.getProg().best,0,'sem recorde herdado');
});

/* =====================================================================
   3. MIGRAÇÃO DO SAVE DA ALPHA
   ===================================================================== */
function legacySeed(){
  const trail=[];
  for(let i=0;i<10;i++)trail.push([i*.25,50+i*3,80,0,0,0]);
  return {
    'echoMeta.v1':JSON.stringify({mem:77,spd:1,reroll:2,vault:3,wins:1,endings:['tirano']}),
    'echoProg.v1':JSON.stringify({kills:420,best:9,runs:12,crits:10,
      seen:['w_beam','w_rail','u_pierce']}),
    'echoChar.v2':'2',
    'echoRuns.v1':JSON.stringify([
      {v:2,dur:30,dmgMul:1.4,frMul:1.1,wave:9,level:5,trail,items:[],upg:[],
       owned:[0],moral:{comp:2,greed:0,viol:1},dom:'viol'}
    ])
  };
}
const M=bootGame(legacySeed());

ok('Save Alpha antigo migra automaticamente para o SAVE 1',()=>{
  M.smLoadRoot();
  const r=M.getSmRoot();
  assert.strictEqual(r.version,3);
  assert.strictEqual(r.lastSlot,1,'migração aponta para o Save 1');
  const s1=r.slots['1'];
  assert.strictEqual(s1.meta.mem,77,'meta preservada');
  assert.strictEqual(s1.meta.endings[0],'tirano');
  assert.strictEqual(s1.prog.kills,420,'prog preservada');
  assert(s1.prog.seen.indexOf('w_rail')>=0,'Codex/unlocks preservados');
  assert.strictEqual(s1.char,2,'operador preservado');
  assert.strictEqual(s1.echoes.length,1,'Eco preservado');
  assert.strictEqual(s1.echoes[0].wave,9);
  assert.strictEqual(s1.run,null,'Alpha não tinha run ativa');
  assert.strictEqual(s1.touched,true);
});

ok('Após a migração, Save 2 e Save 3 nascem vazios',()=>{
  const r=M.getSmRoot();
  for(const i of ['2','3']){
    assert.strictEqual(r.slots[i].touched,false,'Save '+i+' vazio');
    assert.strictEqual(r.slots[i].meta,null);
    assert.strictEqual(r.slots[i].prog,null);
    assert.strictEqual(r.slots[i].echoes.length,0);
    assert.strictEqual(r.slots[i].run,null);
  }
});

ok('Migração remove as chaves antigas (formato único daqui pra frente)',()=>{
  for(const k of ['echoMeta.v1','echoProg.v1','echoChar.v2','echoChar.v1','echoRuns.v1'])
    assert.strictEqual(M._ls.getItem(k),null,'chave antiga deveria ter sido removida: '+k);
  assert(M._ls.getItem('echoSave.v3'),'novo formato presente');
});

ok('Migração roda UMA vez: reinicializar não duplica nada',()=>{
  const before=JSON.parse(M._ls.getItem('echoSave.v3'));
  M.smLoadRoot();                       // segunda inicialização
  M.smLoadRoot();                       // terceira
  const after=M._ls.getItem('echoSave.v3');
  assert.strictEqual(JSON.parse(after).slots['1'].meta.mem,77,'memória não duplica');
  assert.strictEqual(JSON.parse(after).slots['1'].echoes.length,1,'Eco não duplica');
  assert.strictEqual(JSON.parse(after).slots['1'].prog.kills,420,'prog não duplica');
  assert.strictEqual(JSON.parse(after).slots['1'].char,
    before.slots['1'].char,'operador estável');
});

ok('Save Alpha v1 de operador (echoChar.v1) também migra o índice',()=>{
  const seed=legacySeed();
  delete seed['echoChar.v2'];
  seed['echoChar.v1']='4';              // índice antigo → ECHO-0 (novo índice 6)
  const B=bootGame(seed);
  B.smLoadRoot();
  assert.strictEqual(B.getSmRoot().slots['1'].char,6,'remapeamento v1→v2 aplicado');
});

ok('activeRun malformada não derruba o jogo nem apaga o slot',()=>{
  const V={version:3,lastSlot:1,slots:{
    1:{meta:{mem:50,spd:0,reroll:0,vault:0,wins:0,endings:[]},
       prog:{kills:5,best:2,seen:[]},char:0,echoes:[],touched:true,
       run:{v:1,wave:9999,p:{hp:'quebrado'}}},          // run inválida
    2:{meta:null,prog:null,char:0,echoes:[],run:null,touched:false},
    3:{meta:null,prog:null,char:0,echoes:[],run:null,touched:false}}};
  const B=bootGame({'echoSave.v3':JSON.stringify(V)});
  B.smLoadRoot();
  const s1=B.getSmRoot().slots['1'];
  assert.strictEqual(s1.run,null,'só a run inválida é descartada');
  assert.strictEqual(s1.meta.mem,50,'meta preservada');
  assert.strictEqual(s1.prog.kills,5,'prog preservada');
  B.activateSlot(1);
  assert(!B.hasActiveRun(),'nenhuma run fantasma');
});

ok('Slots fora do schema (ex.: string) são recuperados como vazios',()=>{
  const V={version:3,lastSlot:2,slots:{1:'corrompido',2:null,3:{char:5}}};
  const B=bootGame({'echoSave.v3':JSON.stringify(V)});
  B.smLoadRoot();
  assert.strictEqual(B.getSmRoot().lastSlot,2);
  assert(!B.getSmRoot().slots['1'].run);
  assert.strictEqual(B.getSmRoot().slots['3'].char,5,'campo válido sobrevive');
});

/* =====================================================================
   4. ACTIVE RUN — CHECKPOINT E RETOMADA
   ===================================================================== */
ok('Nova run cria activeRun no slot (checkpoint inicial, onda 1)',()=>{
  S.activateSlot(1);
  S.setEchoQueue([]);
  freshRun(S);
  assert.strictEqual(S.getState(),'play');
  assert(S.hasActiveRun(),'run deve nascer com checkpoint');
  const cp=S.getActiveRun();
  assert.strictEqual(cp.v,1,'schema da run versionado');
  assert.strictEqual(cp.wave,1);
  assert.strictEqual(cp.charIdx,S.getCharSel());
  assert(Number.isFinite(cp.p.hp)&&cp.p.hp>0);
  assert(S._ls.getItem('echoSave.v3').indexOf('"run"')>0,'checkpoint persistido');
});

ok('spawnWave grava checkpoint transacional de fronteira de onda',()=>{
  freshRun(S);
  S.setWave(7);
  S.spawnWave(7);
  const cp=S.getActiveRun();
  assert.strictEqual(cp.wave,7,'checkpoint aponta para a onda 7');
  assert.strictEqual(cp.reason,'onda');
});

ok('Compra na loja consolida checkpoint apontando para a PRÓXIMA onda',()=>{
  freshRun(S);
  S.setWave(4);
  S.checkpointShopPurchase();
  const cp=S.getActiveRun();
  assert.strictEqual(cp.wave,5,'retomar deve spawnar a onda 5, não repetir a 4');
});

ok('Retomada restaura HP/Shield/moeda sem encher nada de graça',()=>{
  freshRun(S);
  const p=S.getPlayer();
  p.maxHp=137;p.hp=61;                    // maxHp != hp de propósito
  p.shieldMax=45;p.shield=9;              // shieldMax != shield
  p.coins=321;
  S.captureCheckpoint('teste',6);
  assert.strictEqual(S.getActiveRun().p.hp,61);
  assert.strictEqual(S.getActiveRun().p.shield,9);

  const R=bootGame(S._ls._d);             // fecha e reabre o jogo
  R.activateSlot(1);
  assert(R.hasActiveRun(),'CONTINUAR RUN deve estar disponível após reabrir');
  assert.strictEqual(R.getActiveRun().wave,6);
  R.resumeRun();
  const q=R.getPlayer();
  assert.strictEqual(q.hp,61,'HP restaurado exato — sem cura gratuita');
  assert.strictEqual(q.maxHp,137,'maxHp preservado');
  assert.strictEqual(q.shield,9,'Shield restaurado exato');
  assert.strictEqual(q.shieldMax,45,'shieldMax preservado');
  assert.strictEqual(q.coins,321,'moeda restaurada');
  assert.strictEqual(R.getWave(),6,'retoma na onda do checkpoint');
  assert.strictEqual(R.getState(),'play');
  assert(R.getEnemies().length>=1,'a onda do checkpoint é spawnada');
});

ok('Retomada restaura módulos, arsenal e moral da run',()=>{
  freshRun(S);
  const p=S.getPlayer();
  p.items.push('placa','olho','luneta','pirostase','criostase');
  const it=id=>S.ITEMS.find(i=>i.id===id).apply(p);
  it('placa');it('olho');it('luneta');it('pirostase');it('criostase'); // como giveItem faz
  p.owned=[0,2];p.wi=2;
  S.setMoral({comp:4,greed:0,viol:6});
  S.captureCheckpoint('teste',5);

  const R=bootGame(S._ls._d);
  R.activateSlot(1);
  R.resumeRun();
  const q=R.getPlayer();
  assert.strictEqual(JSON.stringify(q.items.slice().sort()),
    JSON.stringify(['criostase','luneta','olho','pirostase','placa']),
    'módulos restaurados');
  assert.strictEqual(q.maxHp,p.maxHp,'maxHp reflete os módulos (estado, não pipeline)');
  assert.strictEqual(JSON.stringify(q.owned.slice()),JSON.stringify([0,2]),
    'arsenal restaurado');
  assert.strictEqual(q.wi,2,'arma equipada restaurada');
  assert.strictEqual(R.getMoral().viol,6,'escolhas morais da run restauradas');
  assert.strictEqual(R.getMoral().comp,4);
  /* efeitos cruas de módulos elementais fora do pipeline */
  assert(Math.abs(q.stBoost-p.stBoost)<1e-9,'potência de status restaurada');
  assert(Math.abs(q.longRangeBonus-p.longRangeBonus)<1e-9,'bônus de longo alcance restaurado');
  assert.strictEqual(q.burnSpread,p.burnSpread,'propagação de queima restaurada');
  assert(Math.abs(q.stDurMul-p.stDurMul)<1e-9,'duração de status restaurada');
  assert(Math.abs(q.frozenBonus-p.frozenBonus)<1e-9,'bônus de congelados restaurado');
});

/* =====================================================================
   5. STAT PIPELINE — restaurar não duplica modificadores
   ===================================================================== */
ok('CRÍTICO: +30% dano antes do save continua ×1.30 após o load (não ×1.69)',()=>{
  /* operador VECTOR (dano base 1.0) para o exemplo ser literal */
  S.activateSlot(2);
  S.setChar(0);
  freshRun(S);
  let p=S.getPlayer();
  assert.strictEqual(S.CHARS[S.getCharSel()].id,'vector');
  S.smAdd(p,{id:'test.damage',stat:'damage',type:'mult',value:1.30,label:'TESTE'});
  assert(Math.abs(S.calcDamageMul(p)-1.30)<1e-9,'dano antes do save deve ser 1.30');
  S.captureCheckpoint('pipeline',3);

  const R=bootGame(S._ls._d);
  R.activateSlot(2);
  R.resumeRun();
  const q=R.getPlayer();
  const dmg=R.calcDamageMul(q);
  assert(Math.abs(dmg-1.30)<1e-9,
    'dano após load deve continuar 1.30, veio '+dmg+' (duplicação de modificador!)');
  // e uma segunda retomada também não acumula
  R.captureCheckpoint('pipeline2',3);
  const R2=bootGame(R._ls._d);
  R2.activateSlot(2);
  R2.resumeRun();
  const dmg2=R2.calcDamageMul(R2.getPlayer());
  assert(Math.abs(dmg2-1.30)<1e-9,'segundo load também deve ser 1.30, veio '+dmg2);
});

ok('Build composta (+damage +rate +crit) restaura com os MESMOS valores',()=>{
  S.activateSlot(1);
  freshRun(S);
  let p=S.getPlayer();
  S.smAdd(p,{id:'t1',stat:'damage',type:'mult',value:1.30,label:'A'});
  S.smAdd(p,{id:'t2',stat:'fireRate',type:'mult',value:1.15,label:'B'});
  S.smAdd(p,{id:'t3',stat:'crit',type:'flat',value:.14,label:'C'});
  const d0=S.calcDamageMul(p);
  const before={d:d0,rate:p.fireRateMul,crit:p.crit};
  S.captureCheckpoint('build',4);

  const R=bootGame(S._ls._d);
  R.activateSlot(1);
  R.resumeRun();
  const q=R.getPlayer();
  assert(Math.abs(R.calcDamageMul(q)-before.d)<1e-9,
    'dano final deve ser idêntico ao do checkpoint');
  assert(Math.abs(q.fireRateMul-before.rate)<1e-9,'cadência idêntica');
  assert(Math.abs(q.crit-before.crit)<1e-9,'crítico idêntico');
  const mods=q.sm.filter(x=>x.id==='t1');
  assert.strictEqual(mods.length,1,'o modificador não pode ser registrado duas vezes');
});

ok('Modificadores temporários (maldição) NÃO sobrevivem ao checkpoint',()=>{
  freshRun(S);
  const p=S.getPlayer();
  S.smAdd(p,{id:'status.oracle_curse.damage',stat:'damage',type:'mult',
    value:.7,dur:6,label:'MALDIÇÃO'});
  S.captureCheckpoint('temp',3);
  const cp=S.getActiveRun();
  assert.strictEqual(cp.p.sm.filter(x=>x.id==='status.oracle_curse.damage').length,0,
    'temporários ficam de fora do checkpoint');
  const R=bootGame(S._ls._d);
  R.activateSlot(1);
  R.resumeRun();
  const q=R.getPlayer();
  assert(!q.sm.some(x=>x.id==='status.oracle_curse.damage'),
    'maldição não pode voltar permanente após o load');
});

/* =====================================================================
   6. MORTE — SEM AUTO-RESTART
   ===================================================================== */
ok('Morte encerra a run: activeRun some e CONTINUAR RUN desaparece',()=>{
  S.activateSlot(1);
  freshRun(S);
  S.setWave(8);S.setRunTime(120);
  S.onPlayerDeath();
  assert.strictEqual(S.getState(),'fracture','a tela de morte aparece');
  assert(!S.hasActiveRun(),'activeRun deve ser limpa ao morrer');
  assert.strictEqual(S.getEchoQueue().length,1,'a run vira Echo normalmente');
  assert.strictEqual(S.getProg().runs>=1,true,'progressão finalizada');
  S.activateSlot(1);                      // recarrega do save (como reabrir)
  assert(!S.hasActiveRun(),'não existe "continuar" de uma run morta');
});

ok('NENHUM restart automático: tempo infinito na fratura não inicia run',()=>{
  S.activateSlot(1);
  freshRun(S);
  S.onPlayerDeath();
  const timersBefore=scheduled.length;
  for(let i=0;i<400;i++)S.tickFracture(0.5);   // ~200s de "frames"
  assert.strictEqual(S.getState(),'fracture',
    'a tela de morte persiste — nada reinicia sozinho');
  assert.strictEqual(S.getFracT()>2.6,true,'o tempo da fratura passou do limite antigo');
  // roda todos os timers agendados (setTimeout antigo de restart seria pego aqui)
  for(const s of scheduled.splice(0)){
    try{s.fn();}catch(e){/* timers cosméticos podem depender de DOM */}
  }
  assert.strictEqual(S.getState(),'fracture',
    'mesmo executando timers pendentes, nenhuma run começa sozinha');
  assert(!S.hasActiveRun());
});

ok('beginNextRun é a decisão explícita de NOVA RUN (mesmo slot)',()=>{
  const memBefore=JSON.parse(JSON.stringify(S.getMeta()));
  const echoesBefore=S.getEchoQueue().length;
  S.beginNextRun();
  assert.strictEqual(S.getState(),'play');
  assert(S.hasActiveRun(),'nova run cria o próprio checkpoint');
  assert.strictEqual(S.getEchoQueue().length,echoesBefore,
    'nova run não descarta os Ecos do slot');
  assert.strictEqual(JSON.stringify(S.getMeta()),JSON.stringify(memBefore),
    'meta intocada');
});

ok('Esperando MUITO tempo após a morte: nenhum setTimeout inicia outra run',()=>{
  S.activateSlot(1);
  freshRun(S);
  S.onPlayerDeath();
  S.setFracT(0);
  // simula 20 minutos de loop com dt grande em um único passo
  S.tickFracture(1200);
  assert.strictEqual(S.getState(),'fracture');
  // dispara qualquer timer aguardando (com atrasos enormes incluídos)
  for(const s of scheduled.splice(0)){try{s.fn();}catch(e){}}
  assert.strictEqual(S.getState(),'fracture','auto-restart por timer detectado!');
});

/* =====================================================================
   7. VITÓRIA E NOVA RUN — NENHUM SAVE FANTASMA
   ===================================================================== */
ok('Vitória limpa activeRun (nenhum save fantasma de run concluída)',()=>{
  S.activateSlot(1);
  freshRun(S);
  S.setWave(20);S.setRunTime(900);
  S.onVictory();
  assert.strictEqual(S.getState(),'victory');
  assert(!S.hasActiveRun(),'run concluída não pode ficar pendurada');
  assert(S.getMeta().wins>=1,'meta registra a vitória');
  assert(S.getMeta().mem>0,'pontos de memória concedidos');
  S.activateSlot(1);
  assert(!S.hasActiveRun(),'persistido sem run ativa');
});

ok('NOVA RUN com run ativa: confirmação existe e confirmação limpa SÓ a run',()=>{
  S.activateSlot(1);
  freshRun(S);
  S.setWave(6);
  S.spawnWave(6);
  const p=S.getPlayer();
  p.coins=500;S.saveProg();
  const memBefore=JSON.parse(JSON.stringify(S.getMeta()));
  const progBefore=JSON.parse(JSON.stringify(S.getProg()));
  const echoesBefore=S.getEchoQueue().length;
  assert(S.hasActiveRun(),'run ativa existe — exigiria confirmação na UI');
  S.clearActiveRun();                     // o que "INICIAR NOVA RUN" confirma
  assert(!S.hasActiveRun());
  assert.strictEqual(S.getMeta().mem,memBefore.mem,'meta NÃO é apagada');
  assert.strictEqual(S.getEchoQueue().length,echoesBefore,'Ecos do slot intocados');
  S.startRun();
  assert.strictEqual(S.getState(),'play');
  assert.strictEqual(S.getProg().seen.length,progBefore.seen.length,
    'unlocks/Codex do slot preservados');
});

ok('activeRun corrompida em memória não quebra hasActiveRun/resumeRun',()=>{
  S.activateSlot(1);
  freshRun(S);
  S.getActiveRun().p.owned='estragado';    // simula dano no objeto em memória
  assert(!S.hasActiveRun(),'run inválida é tratada como inexistente');
  S.resumeRun();                          // fallback: inicia run nova, sem crash
  assert.strictEqual(S.getState(),'play');
});

/* =====================================================================
   8. DEV MODE — TAINT POR SLOT
   ===================================================================== */
ok('Run com DEV MODE não grava checkpoint nem contamina outros slots',()=>{
  const D=bootGame({});
  D.activateSlot(1);
  D.unlockAll();
  D.setPlayer(null);D.setWave(0);
  D.forceDevMode(true);                   // simula DEV ligado
  D.startRun();
  assert(!D.hasActiveRun(),'run depurada não pode ter checkpoint legítimo');
  D.setWave(5);
  D.spawnWave(5);
  assert(!D.hasActiveRun(),'spawnWave sob DEV também não grava');
  const mem1=JSON.stringify(D.getSmRoot().slots['1'].meta);
  D.getProg().kills=99999;                // suja a memória
  D.activateSlot(2);                      // troca de slot: dados sujos descartados
  assert.strictEqual(D.getProg().kills,0,'Save 2 não herda progresso da run DEV');
  assert.strictEqual(JSON.stringify(D.getSmRoot().slots['1'].meta),mem1,
    'Save 1 não é contaminado');
  const raw=D._ls.getItem('echoSave.v3');
  assert(raw.indexOf('"kills":99999')<0,'nenhum dado da run DEV é persistido');
});

/* =====================================================================
   9. DESLIGAMENTO — CHECKPOINT JÁ ESTÁ NO DISCO
   ===================================================================== */
ok('Fechar durante a onda: checkpoint de fronteira já persistido antes',()=>{
  S.activateSlot(1);
  freshRun(S);                            // startRun → checkpoint onda 1
  S.setWave(7);
  S.spawnWave(7);                         // avança para a onda 7
  const p=S.getPlayer();
  p.hp=44;p.shield=0;p.coins=210;
  S.captureCheckpoint('onda',7);          // estado do jogador no início da onda 7
  // "fecha o jogo sem salvar nada além do que já estava em disco"
  const R=bootGame(S._ls._d);
  R.activateSlot(1);
  assert(R.hasActiveRun(),'o checkpoint sobrevive ao fechamento sem evento de saída');
  R.resumeRun();
  const q=R.getPlayer();
  assert.strictEqual(q.hp,44);
  assert.strictEqual(q.coins,210);
  assert.strictEqual(R.getWave(),7,'retorna ao início da onda 7');
});

/* =====================================================================
   10. FUMAÇA DE UI — as novas telas executam sem erro no DOM mínimo
   ===================================================================== */
ok('Telas novas executam: título → seleção → menu → confirmação → retomada',()=>{
  const U=bootGame({'echoSave.v3':JSON.stringify(V3)});
  U.showTitle();
  U.showSlotSelect();                     // renderiza os 3 cartões
  U.pickSlot(1);                          // ativa e abre o menu do save
  assert.strictEqual(U.getState(),'slotMenu');
  U.slotMenuAction(1);                    // NOVA RUN sem run ativa → direto
  assert.strictEqual(U.getState(),'play');
  assert(U.hasActiveRun());
  U.setState('paused');
  U.backToMainMenu();                     // pausa → salva e sai para o menu
  assert.strictEqual(U.getState(),'slotMenu');
  assert(U.hasActiveRun(),'menu principal preserva o checkpoint');
  U.slotMenuAction(1);                    // NOVA RUN com run ativa → confirmação
  assert.strictEqual(U.getState(),'slotConfirm');
  U.slotMenuAction ? null : null;
  U.showSlotMenu();                       // cancela (volta ao menu)
  U.slotMenuAction(0);                    // CONTINUAR RUN
  assert.strictEqual(U.getState(),'play');
});

ok('Fluxo completo de morte pela UI: morte → menu do save sem CONTINUAR RUN',()=>{
  const U=bootGame({});
  U.showTitle();U.showSlotSelect();U.pickSlot(2);
  U.slotMenuAction(1);                    // nova run (slot vazio)
  U.onPlayerDeath();
  assert.strictEqual(U.getState(),'fracture');
  U.exitToSlotMenuFromDeath();            // VOLTAR AO MENU
  assert.strictEqual(U.getState(),'slotMenu');
  assert(!U.hasActiveRun(),'CONTINUAR RUN não pode existir após a morte');
  U.slotMenuAction(1);                    // NOVA RUN sem confirmação (run morta)
  assert.strictEqual(U.getState(),'play');
});

ok('Vitória → VOLTAR AO MENU: menu do save sem run fantasma',()=>{
  const U=bootGame({});
  U.showTitle();U.showSlotSelect();U.pickSlot(3);
  U.slotMenuAction(1);
  U.setWave(20);U.setRunTime(600);
  U.onVictory();
  U.victoryToMenu();
  assert.strictEqual(U.getState(),'slotMenu');
  assert(!U.hasActiveRun());
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){
  console.log('\nFALHAS DETECTADAS');
  process.exit(1);
}
console.log('\nTODOS OS TESTES PASSARAM');
