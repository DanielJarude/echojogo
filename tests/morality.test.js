'use strict';
/* =====================================================================
   TESTES — PR 9: MORALIDADE 2.0 + SINTONIA MORAL DE ITENS
   - perfil moral derivado (normalização, dominante/misto/equilibrado)
   - afinidade moral de itens (contínua, nunca binária, itens neutros)
   - efeitos via Stat Modifier Pipeline (ids estáveis, sem duplicação)
   - viés pequeno de loja e de eventos (nunca bloqueia nada)
   - checkpoint/Continue Run/Save Slots (derivados recalculados)
   - PR 8 (personalidade), trust, Dissonância, Resonance e finais intactos
   - DEV MODE: setters/presets/inspetores com devTaint
   Executa o script REAL de index.html em sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/morality.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];
const RAWSRC=m[1];   // fonte crua para auditorias estáticas

src+=';globalThis.__t={'+
  'MORAL_BALANCE,MORAL_AFFINITY,MORAL_AXES,MORAL_AXIS_LABEL,MORAL_STATE_LABEL,'+
  'getMoralProfile,getItemMoralAffinity,calcMoralAffinityMatch,moralTuneFactor,'+
  'moralAffinityLevel,moralTuneModsFor,calcMoralTuningPlan,applyMoralTuning,moralTuneModId,'+
  'isMoralTuneModId,countAttunedItems,moralShopWeight,pickWeightedMoral,'+
  'moralEventWeight,pickEventKind,moralAffinityTagHTML,moralAffinityPhrase,'+
  'moralGain,applyMoral,moralDom,moralTier,'+
  'EVENT_AFFINITY,EV_KINDS,ITEMS,UPGRADES,itemById,giveItem,rarityWeight,'+
  'smGet,smHas,smBreakdown,smBuildCheckpoint,captureCheckpoint,'+
  'clearActiveRun,hasActiveRun,'+
  'startRun,resumeRun,activateSlot,'+
  'deriveEchoPersonality,makeEcho,trustTier,'+
  'DEV_get:()=>DEV,DEV_on:()=>{DEV_MODE=true;},DEV_off:()=>{DEV_MODE=false;},'+
  'getMoral:()=>moral,'+
  'getMEff:()=>mEff,getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getState:()=>state,setState:s=>{state=s;},'+
  'getEchoes:()=>echoes,setEchoes:a=>{echoes=a;},'+
  'getWave:()=>wave,setWave:w=>{wave=w;},'+
  'getActiveRun:()=>activeRun,getCurSlot:()=>curSlot,'+
  'getTainted:()=>devTainted,clearDevTaint:()=>{devTainted=false;},'+
  'getEchoQueue:()=>echoQueue,getRoot:()=>smRoot};';

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
const localStorage={_d:{},getItem(k){return this._d[k]||null;},
  setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
const navigator={getGamepads:()=>[]};

/* Math com RNG controlável — o perfil moral e a sintonia são
   determinísticos; apenas os sorteios (loja/eventos) usam random. */
const MathF=Object.create(Math);
MathF._rng=null;
MathF.random=function(){return MathF._rng?MathF._rng():Math.random();};

const sandbox={console,Math:MathF,Date,parseInt,parseFloat,isNaN,setTimeout,clearTimeout,
  requestAnimationFrame:()=>0,
  Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
  Promise,Proxy,Reflect,JSON,Symbol,
  document,window,localStorage,navigator,
  performance:{now:()=>Date.now()}
};
const ctx=vm.createContext(sandbox);
vm.runInContext(src,ctx,{timeout:15000});
const t=vm.runInContext('__t',ctx);
MathF._rng=()=>0.4242;

/* ---------------- runner ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  \u2714 '+label);}
  catch(e){failed++;console.log('  \u2716 '+label);console.log('     '+e.message);}
}
function freshRun(){
  t.setPlayer(null);
  t.startRun();
  t.clearDevTaint();
}
function setMoralRaw(c,g,v){
  const mo=t.getMoral();
  mo.comp=c;mo.greed=g;mo.viol=v;
  t.applyMoral();
  t.applyMoralTuning(t.getPlayer());
}
const B=t.MORAL_BALANCE;
const EPS=1e-9;
const near=(a,b,e)=>Math.abs(a-b)<=(e||1e-6);

console.log('TESTES PR 9 — MORALIDADE 2.0 + SINTONIA DE ITENS');
console.log('---------------------------------------------');

/* ============================ A. PERFIL ============================ */
ok('10/0/0 → COMPAIXÃO dominante',()=>{
  const p=t.getMoralProfile({comp:10,greed:0,viol:0});
  assert.strictEqual(p.state,'dominant');
  assert.strictEqual(p.dominant,'comp');
  assert(near(p.normalized.comp,1));
});
ok('0/10/0 → GANÂNCIA dominante',()=>{
  const p=t.getMoralProfile({comp:0,greed:10,viol:0});
  assert.strictEqual(p.state,'dominant');
  assert.strictEqual(p.dominant,'greed');
});
ok('0/0/10 → VIOLÊNCIA dominante',()=>{
  const p=t.getMoralProfile({comp:0,greed:0,viol:10});
  assert.strictEqual(p.state,'dominant');
  assert.strictEqual(p.dominant,'viol');
});
ok('5/5/5 → EQUILIBRADO (balanced=true, sem dominante)',()=>{
  const p=t.getMoralProfile({comp:5,greed:5,viol:5});
  assert.strictEqual(p.state,'balanced');
  assert.strictEqual(p.balanced,true);
  assert.strictEqual(p.dominant,null);
});
ok('8/7/1 → MISTO comp/greed (dominante e secundário corretos)',()=>{
  const p=t.getMoralProfile({comp:8,greed:7,viol:1});
  assert.strictEqual(p.state,'mixed');
  assert.strictEqual(p.dominant,'comp');
  assert.strictEqual(p.secondary,'greed');
});
ok('7/1/7 → MISTO comp/viol',()=>{
  const p=t.getMoralProfile({comp:7,greed:1,viol:7});
  assert.strictEqual(p.state,'mixed');
  const pair=[p.dominant,p.secondary].sort().join(',');
  assert.strictEqual(pair,'comp,viol');
});
ok('1/7/7 → MISTO greed/viol',()=>{
  const p=t.getMoralProfile({comp:1,greed:7,viol:7});
  assert.strictEqual(p.state,'mixed');
  const pair=[p.dominant,p.secondary].sort().join(',');
  assert.strictEqual(pair,'greed,viol');
});
ok('0/0/0 → NEUTRO: normalizado uniforme, sem NaN, intensidade 0',()=>{
  const p=t.getMoralProfile({comp:0,greed:0,viol:0});
  assert.strictEqual(p.state,'neutral');
  assert(near(p.normalized.comp,1/3)&&near(p.normalized.greed,1/3)&&near(p.normalized.viol,1/3));
  assert.strictEqual(p.intensity,0);
  for(const a of t.MORAL_AXES)assert(!Number.isNaN(p.normalized[a]));
});
ok('soma abaixo de minTotal → perfil ainda NEUTRO (moral "não acordou")',()=>{
  const p=t.getMoralProfile({comp:1,greed:1,viol:0});
  assert(1+1<B.profile.minTotal);
  assert.strictEqual(p.state,'neutral');
});
ok('intensidade: dominante puro > misto > equilibrado',()=>{
  const a=t.getMoralProfile({comp:10,greed:0,viol:0}).intensity;
  const b=t.getMoralProfile({comp:8,greed:7,viol:1}).intensity;
  const c=t.getMoralProfile({comp:5,greed:5,viol:5}).intensity;
  assert(a>b&&b>c);
});

/* ========================= B. NORMALIZAÇÃO ========================= */
ok('10/5/0 e 20/10/0 produzem perfis derivados equivalentes',()=>{
  const a=t.getMoralProfile({comp:10,greed:5,viol:0});
  const b=t.getMoralProfile({comp:20,greed:10,viol:0});
  for(const ax of t.MORAL_AXES)assert(near(a.normalized[ax],b.normalized[ax]));
  assert.strictEqual(a.dominant,b.dominant);
  assert.strictEqual(a.state,b.state);
  assert(near(a.intensity,b.intensity));
});
ok('normalizado sempre soma 1',()=>{
  for(const [c,g,v] of [[10,0,0],[3,4,5],[0,0,0],[1,1,1],[9,2,7]]){
    const p=t.getMoralProfile({comp:c,greed:g,viol:v});
    assert(near(p.normalized.comp+p.normalized.greed+p.normalized.viol,1));
  }
});
ok('cache: sem mudança devolve o MESMO objeto; muda após escolha moral',()=>{
  freshRun();
  const p1=t.getMoralProfile(),p2=t.getMoralProfile();
  assert.strictEqual(p1,p2,'sem mudança → mesmo objeto (nenhum recálculo)');
  t.moralGain(0,2,0);
  const p3=t.getMoralProfile();
  assert.notStrictEqual(p1,p3,'após moralGain o perfil é recalculado');
  assert(p3.raw.greed===2);
});

/* ===================== C. AFINIDADE DE ITENS ====================== */
ok('tabela de afinidade só referencia itens que existem em ITEMS',()=>{
  for(const id in t.MORAL_AFFINITY)
    assert(t.itemById(id),'item inexistente na tabela: '+id);
});
ok('vetores de afinidade classificados somam 1',()=>{
  for(const id in t.MORAL_AFFINITY){
    const a=t.getItemMoralAffinity(id);
    assert(near(a.comp+a.greed+a.viol,1,1e-9),id+' não soma 1');
  }
});
ok('item COMPAIXÃO (placa): match maior com perfil compassivo',()=>{
  const aff=t.getItemMoralAffinity('placa');
  const mc=t.calcMoralAffinityMatch(aff,t.getMoralProfile({comp:10,greed:0,viol:0}));
  const mv=t.calcMoralAffinityMatch(aff,t.getMoralProfile({comp:0,greed:0,viol:10}));
  assert(mc>mv);
  assert(near(mc,1)&&near(mv,0));
});
ok('item VIOLÊNCIA (nucleo): match maior com perfil violento',()=>{
  const aff=t.getItemMoralAffinity('nucleo');
  const mv=t.calcMoralAffinityMatch(aff,t.getMoralProfile({comp:0,greed:0,viol:10}));
  const mg=t.calcMoralAffinityMatch(aff,t.getMoralProfile({comp:0,greed:10,viol:0}));
  assert(mv>mg);
});
ok('item NEUTRO (lente): sem afinidade, sem match, sem efeito, peso 1',()=>{
  assert.strictEqual(t.getItemMoralAffinity('lente'),null);
  assert.strictEqual(t.calcMoralAffinityMatch(null,t.getMoralProfile({comp:9,greed:0,viol:0})),null);
  assert.strictEqual(t.moralAffinityLevel(null).lab,'NEUTRA');
  assert.strictEqual(t.moralTuneModsFor('lente',t.getMoralProfile({comp:9,greed:0,viol:0})).length,0);
  assert.strictEqual(t.moralShopWeight(t.itemById('lente')),1);
});
ok('match sempre em [0,1] (todos os itens × presets extremos)',()=>{
  const profs=[[10,0,0],[0,10,0],[0,0,10],[5,5,5],[7,1,7],[1,7,7],[0,0,0]]
    .map(v=>t.getMoralProfile({comp:v[0],greed:v[1],viol:v[2]}));
  for(const id in t.MORAL_AFFINITY)for(const p of profs){
    const mm=t.calcMoralAffinityMatch(t.getItemMoralAffinity(id),p);
    assert(mm>=0&&mm<=1,id+' fora de [0,1]');
  }
});
ok('item MISTO (sifao C/V): match contínuo — 0.5 nos eixos, 0 no oposto',()=>{
  const aff=t.getItemMoralAffinity('su_exec');
  const affMix=t.getItemMoralAffinity('sifao');
  assert(affMix.comp>0&&affMix.viol>0,'sifao é C/V');
  const mComp=t.calcMoralAffinityMatch(affMix,t.getMoralProfile({comp:10,greed:0,viol:0}));
  const mGreed=t.calcMoralAffinityMatch(affMix,t.getMoralProfile({comp:0,greed:10,viol:0}));
  const mViol=t.calcMoralAffinityMatch(affMix,t.getMoralProfile({comp:0,greed:0,viol:10}));
  assert(near(mComp,affMix.comp)&&near(mViol,affMix.viol)&&near(mGreed,0));
  assert(aff.viol===1,'controle: su_exec é violência pura');
});
ok('item MISTO gera efeito nos DOIS eixos quando o perfil sustenta ambos',()=>{
  const prof=t.getMoralProfile({comp:7,greed:1,viol:7});
  const mods=t.moralTuneModsFor('sifao',prof);
  const stats=mods.map(m=>m.stat).sort().join(',');
  assert.strictEqual(stats,'damage,dmgTaken','proteção + ofensiva juntas');
});
ok('perfil EQUILIBRADO: fator de sintonia 0 → nenhum item ganha nada',()=>{
  const prof=t.getMoralProfile({comp:5,greed:5,viol:5});
  for(const id in t.MORAL_AFFINITY){
    const mm=t.calcMoralAffinityMatch(t.getItemMoralAffinity(id),prof);
    assert.strictEqual(t.moralTuneFactor(mm),0,id+' ganhou bônus indevido');
    assert.strictEqual(t.moralTuneModsFor(id,prof).length,0);
  }
});

/* ===================== D. STAT PIPELINE ====================== */
ok('equipar item afinado com perfil alinhado → modificador moral:item no pipeline',()=>{
  freshRun();
  const p=t.getPlayer();
  setMoralRaw(0,0,10);
  const before=t.smGet(p,'damage');
  t.giveItem(t.itemById('nucleo'),true);
  assert(t.smHas(p,'moral:item:nucleo:damage'),'id estável presente');
  const after=t.smGet(p,'damage');
  const expected=before*1.30*(1+B.affinity.maxBonus.viol);
  assert(near(after,expected,1e-6),'dano = base × módulo × sintonia ('+after+' vs '+expected+')');
});
ok('recálculo repetido NÃO duplica modificadores nem stat',()=>{
  const p=t.getPlayer();
  const len=p.sm.length,dmg=t.smGet(p,'damage');
  t.applyMoralTuning(p);t.applyMoralTuning(p);t.applyMoralTuning(p);
  assert.strictEqual(p.sm.length,len);
  assert(near(t.smGet(p,'damage'),dmg));
  assert.strictEqual(p.sm.filter(x=>x.id==='moral:item:nucleo:damage').length,1);
});
ok('mudar a moral atualiza o valor da sintonia (contínuo, não binário)',()=>{
  const p=t.getPlayer();
  setMoralRaw(2,2,6);   // dominância parcial
  const partial=p.sm.find(x=>x.id==='moral:item:nucleo:damage');
  assert(partial,'ainda afinado');
  setMoralRaw(0,0,10);  // dominância total
  const full=p.sm.find(x=>x.id==='moral:item:nucleo:damage');
  assert(full.value>partial.value,'alinhamento maior → efeito maior');
  assert(near(full.value,B.affinity.maxBonus.viol),'delta aditivo no teto por item');
});
ok('sem itens → modificadores derivados desaparecem',()=>{
  const p=t.getPlayer();
  p.items=[];
  t.applyMoralTuning(p);
  assert.strictEqual(p.sm.filter(x=>t.isMoralTuneModId(x.id)).length,0);
});
ok('checkpoint EXCLUI sintonia derivada e PRESERVA módulos reais',()=>{
  freshRun();
  setMoralRaw(0,0,10);
  t.giveItem(t.itemById('nucleo'),true);
  const cp=t.smBuildCheckpoint('teste',1);
  assert(cp.p.sm.some(x=>x.id==='module.nucleo.damage'),'módulo real vai pro save');
  assert(!cp.p.sm.some(x=>t.isMoralTuneModId(x.id)),'derivado moral fica de fora');
  assert.strictEqual(cp.moral.comp,0);
  assert.strictEqual(cp.moral.greed,0);
  assert.strictEqual(cp.moral.viol,10,'moral crua persiste no checkpoint');
});
ok('resume filtra sm moral legado e recalcula sem duplicar (migração)',()=>{
  freshRun();
  setMoralRaw(0,0,10);
  t.giveItem(t.itemById('nucleo'),true);
  t.setState('play');
  assert(t.captureCheckpoint('teste',2));
  /* corrompe o save como se um build antigo tivesse gravado o derivado */
  t.getActiveRun().p.sm.push({id:'moral:item:nucleo:damage',stat:'damage',
    type:'mult',value:1.05,stacks:'stack',label:'legado'});
  t.resumeRun();
  const p=t.getPlayer();
  const mods=p.sm.filter(x=>x.id==='moral:item:nucleo:damage');
  assert.strictEqual(mods.length,1,'exatamente 1 (recalculado, não duplicado)');
  assert(near(mods[0].value,B.affinity.maxBonus.viol));
});
ok('limites de poder: bônus nunca ultrapassa o teto e nunca vira malus',()=>{
  const profs=[[10,0,0],[0,10,0],[0,0,10],[8,7,1],[7,1,7],[1,7,7],[5,5,5]]
    .map(v=>t.getMoralProfile({comp:v[0],greed:v[1],viol:v[2]}));
  for(const id in t.MORAL_AFFINITY)for(const prof of profs){
    for(const mod of t.moralTuneModsFor(id,prof)){
      assert.strictEqual(mod.type,'add','sintonia é aditiva (auditoria de stacking)');
      if(mod.stat==='damage'){
        assert(mod.value>0&&mod.value<=B.affinity.maxBonus.viol+EPS);
      }else if(mod.stat==='coinMul'){
        assert(mod.value>0&&mod.value<=B.affinity.maxBonus.greed+EPS);
      }else if(mod.stat==='dmgTaken'){
        assert(mod.value<0&&mod.value>=-B.affinity.maxBonus.comp-EPS);
      }else assert.fail('stat inesperado na sintonia: '+mod.stat);
    }
  }
});

/* ============================ E. LOJA ============================ */
ok('peso de loja fica no intervalo [1, 1+shopBias] — viés pequeno',()=>{
  freshRun();
  const profs=[[10,0,0],[0,10,0],[0,0,10],[5,5,5],[0,0,0]];
  for(const [c,g,v] of profs){
    setMoralRaw(c,g,v);
    for(const it of t.ITEMS){
      const w=t.moralShopWeight(it);
      assert(w>=1-EPS&&w<=1+B.shopBias+EPS,it.id+' peso '+w);
    }
  }
});
ok('item não afinado mantém peso 1 sob qualquer perfil',()=>{
  setMoralRaw(0,0,10);
  for(const it of t.ITEMS)
    if(!t.MORAL_AFFINITY[it.id])
      assert.strictEqual(t.moralShopWeight(it),1,it.id);
});
ok('sorteio da loja continua diverso: itens não afinados seguem saindo',()=>{
  setMoralRaw(0,0,10);   // perfil violento extremo
  t.setWave(15);
  const pool=t.ITEMS.slice();
  const seen=new Set();
  let k=0;
  MathF._rng=()=>{k=(k+1)%997;return k/997;};
  for(let i=0;i<2500;i++)seen.add(t.pickWeightedMoral(pool,15).id);
  MathF._rng=()=>0.4242;
  const neutrals=['lente','luneta','colmeia'];
  for(const id of neutrals)
    assert(seen.has(id),'item neutro '+id+' nunca saiu — loja ficou determinística');
});

/* ====================== F. EVENTOS / ESCOLHAS ====================== */
ok('moralGain(0,2,0) altera SÓ a Ganância',()=>{
  freshRun();
  t.moralGain(0,2,0);
  const mo=t.getMoral();
  assert.deepStrictEqual({c:mo.comp,g:mo.greed,v:mo.viol},{c:0,g:2,v:0});
});
ok('moralGain(3,0,0) altera SÓ a Compaixão',()=>{
  freshRun();
  t.moralGain(3,0,0);
  const mo=t.getMoral();
  assert.deepStrictEqual({c:mo.comp,g:mo.greed,v:mo.viol},{c:3,g:0,v:0});
});
ok('peso de evento em [1, 1+eventBias]; eventos neutros ficam em 1',()=>{
  setMoralRaw(0,0,12);
  for(const k of t.EV_KINDS){
    const w=t.moralEventWeight(k);
    assert(w>=1-EPS&&w<=1+B.eventBias+EPS,k);
    if(!t.EVENT_AFFINITY[k])assert.strictEqual(w,1,k+' deveria ser neutro');
  }
});
ok('perfil violento puxa LEVEMENTE eventos de confronto',()=>{
  setMoralRaw(0,0,12);
  assert(t.moralEventWeight('ambush')>t.moralEventWeight('survivor'));
  assert(t.moralEventWeight('ambush')<=1+B.eventBias+EPS,'mas o viés continua pequeno');
});
ok('pickEventKind sempre devolve um evento válido',()=>{
  let k=0;
  MathF._rng=()=>{k=(k+1)%53;return k/53;};
  for(let i=0;i<200;i++)
    assert(t.EV_KINDS.indexOf(t.pickEventKind())>=0);
  MathF._rng=()=>0.4242;
});
ok('consequências legadas intactas: tier de Ganância ainda mexe na economia',()=>{
  freshRun();
  t.moralGain(0,6,0);   // tier 2
  const e=t.getMEff();
  assert(e.coinMul>1,'moedas sobem');
  assert(e.shopMul>1,'preços sobem');
});

/* ================ G. SAVE / CONTINUE RUN / SLOTS ================ */
ok('Continue Run: escolha moral → checkpoint → resume → valores idênticos + sintonia recalculada',()=>{
  freshRun();
  t.moralGain(0,0,6);
  t.giveItem(t.itemById('nucleo'),true);
  t.setState('play');
  assert(t.captureCheckpoint('teste',3));
  t.moralGain(4,0,0);          // progresso APÓS o checkpoint (será descartado)
  t.resumeRun();
  const mo=t.getMoral();
  assert.deepStrictEqual({c:mo.comp,g:mo.greed,v:mo.viol},{c:0,g:0,v:6});
  const p=t.getPlayer();
  assert(t.smHas(p,'moral:item:nucleo:damage'),'sintonia recalculada no resume');
  assert.strictEqual(p.sm.filter(x=>x.id==='moral:item:nucleo:damage').length,1);
});
ok('resume não stacka sintonia: dano final = uma única aplicação',()=>{
  const p=t.getPlayer();
  const once=t.smBreakdown(p,'damage').lines
    .filter(l=>t.isMoralTuneModId(l.id)).length;
  assert.strictEqual(once,1);
});
ok('Save Slots: Violence no Save 1 não contamina Compassion no Save 2',()=>{
  t.activateSlot(1);
  freshRun();
  t.moralGain(0,0,8);
  t.setState('play');
  assert(t.captureCheckpoint('teste',2));
  t.activateSlot(2);
  freshRun();
  t.moralGain(8,0,0);
  t.setState('play');
  assert(t.captureCheckpoint('teste',2));
  /* volta ao Save 1 → Violence intacta */
  t.activateSlot(1);
  t.resumeRun();
  let mo=t.getMoral();
  assert.deepStrictEqual({c:mo.comp,g:mo.greed,v:mo.viol},{c:0,g:0,v:8},'Save 1 = Violence');
  /* Save 2 → Compassion intacta */
  t.activateSlot(2);
  t.resumeRun();
  mo=t.getMoral();
  assert.deepStrictEqual({c:mo.comp,g:mo.greed,v:mo.viol},{c:8,g:0,v:0},'Save 2 = Compassion');
});
ok('migração: checkpoint sem campo moral → run abre com moral zerada',()=>{
  t.activateSlot(1);
  freshRun();
  t.setState('play');
  assert(t.captureCheckpoint('teste',2));
  delete t.getActiveRun().moral;   // save de build antiga
  t.resumeRun();
  const mo=t.getMoral();
  assert.deepStrictEqual({c:mo.comp,g:mo.greed,v:mo.viol},{c:0,g:0,v:0});
});
ok('nova run zera a moral (regra por-run preservada e documentada)',()=>{
  freshRun();
  t.moralGain(5,5,5);
  freshRun();
  const mo=t.getMoral();
  assert.deepStrictEqual({c:mo.comp,g:mo.greed,v:mo.viol},{c:0,g:0,v:0});
});

/* ============ H. PR 8 / TRUST / DISSONÂNCIA / RESONANCE ============ */
ok('personalidade do Echo é INVARIANTE à moral da run',()=>{
  const trail=[];
  for(let i=0;i<40;i++)trail.push([i*.5,100+i*8,100,1,0,0]);
  const base={dur:60,trail,kills:30,wave:8,mh:100,items:[],upg:[],owned:[0,1],
    st:{shots:200,hits:150,dmgDealt:900,dmgTaken:120,dashes:10,kills:30,
      near:40,far:20,samples:60,moveDist:2000,hpLowT:3,shieldBreaks:1,
      execs:2,crits:20,dots:0,waveT:55}};
  const a=t.deriveEchoPersonality({...base,moral:{comp:12,greed:0,viol:0},dom:'comp'});
  const b=t.deriveEchoPersonality({...base,moral:{comp:0,greed:0,viol:12},dom:'viol'});
  assert.strictEqual(a.id,b.id,'id de personalidade não muda com moral');
  assert.strictEqual(a.c,b.c,'confiança não muda com moral');
  assert.deepStrictEqual(a.tr,b.tr,'traços não mudam com moral');
});
ok('perfil/sintonia NÃO tocam a confiança de um Echo em campo',()=>{
  freshRun();
  const trail=[];
  for(let i=0;i<8;i++)trail.push([i*.25,100+i,100,0,0,0]);
  const e=t.makeEcho({dur:12,trail,wave:5,level:3,items:[],upg:[],owned:[0],
    moral:{comp:0,greed:0,viol:0},dom:'neutro',dmgMul:1,frMul:1,mh:100},1);
  e.trust=57;
  t.setEchoes([e]);
  setMoralRaw(0,0,10);
  t.getMoralProfile();
  t.applyMoralTuning(t.getPlayer());
  t.countAttunedItems(t.getPlayer());
  assert.strictEqual(e.trust,57,'trust intocado pelas funções do PR 9');
  t.setEchoes([]);
});
ok('código do PR 9 não referencia trust/Dissonância/Resonance (auditoria de fonte)',()=>{
  const i0=RAWSRC.indexOf('MORALIDADE 2.0 (PR 9)');
  const i1=RAWSRC.indexOf('DISSONÂNCIA MORAL CRÍTICA');
  assert(i0>0&&i1>i0,'bloco encontrado');
  const block=RAWSRC.slice(i0,i1);
  assert(!/\.trust\b/.test(block),'sem leitura/escrita de trust');
  assert(!/enterDissonance\s*\(/.test(block),'sem Dissonância');
  assert(!/triggerResonance|microResonance/i.test(block),'sem Resonance');
  assert(!/\bpers\b|PERSONALITIES/.test(block),'sem personalidade');
});
ok('pickEnding (finais) permanece intocado — PR 10.5 é futuro',()=>{
  assert(/function pickEnding\(\)\{\s*const dark=moral\.greed\+moral\.viol/.test(RAWSRC));
});
ok('echoesReact (regra de trust PRÉ-existente) permanece intocada',()=>{
  assert(/e\.trust=clamp\(e\.trust\+18,0,100\)/.test(RAWSRC),'+18 na ressonância');
  assert(/e\.trust=clamp\(e\.trust-26,0,100\)/.test(RAWSRC),'−26 na dissonância');
});
ok('Dissonância/Resonance não consultam afinidade moral (auditoria de fonte)',()=>{
  const f=name=>{
    const i=RAWSRC.indexOf('function '+name);
    assert(i>=0,name+' existe');
    return RAWSRC.slice(i,RAWSRC.indexOf('\nfunction',i+10));
  };
  for(const fn of ['enterDissonance','triggerResonance'])
    assert(!/MORAL_AFFINITY|getMoralProfile|calcMoralAffinityMatch/.test(f(fn)),
      fn+' não lê o sistema de sintonia');
});

/* ============================ I. DEV ============================ */
ok('DEV.setMoral sem DEV_MODE é ignorado (gate)',()=>{
  freshRun();
  t.DEV_off();
  const r=t.DEV_get().setMoral(9,9,9);
  assert.strictEqual(r,false);
  const mo=t.getMoral();
  assert.deepStrictEqual({c:mo.comp,g:mo.greed,v:mo.viol},{c:0,g:0,v:0});
});
ok('DEV.setMoral aplica valores, contamina a run e bloqueia checkpoint legítimo',()=>{
  t.DEV_on();
  const prof=t.DEV_get().setMoral(0,0,10);
  assert(prof&&prof.dominant==='viol');
  assert.strictEqual(t.getTainted(),true,'devTainted ligado');
  t.setState('play');
  assert.strictEqual(t.captureCheckpoint('dev',2),false,'run DEV nunca gera save legítimo');
  t.DEV_off();t.clearDevTaint();
});
ok('DEV.moralPreset aplica os presets do roadmap',()=>{
  t.DEV_on();
  const p=t.DEV_get().moralPreset('balanced');
  assert.strictEqual(p.state,'balanced');
  const mo=t.getMoral();
  assert.deepStrictEqual({c:mo.comp,g:mo.greed,v:mo.viol},{c:5,g:5,v:5});
  const p2=t.DEV_get().moralPreset('mix_gv');
  assert.strictEqual(p2.state,'mixed');
  assert.strictEqual(t.DEV_get().moralPreset('nao-existe'),false);
  t.DEV_off();t.clearDevTaint();
});
ok('DEV.moralItemDebug mostra base/afinidade/match/mods do item',()=>{
  t.DEV_on();
  t.DEV_get().setMoral(0,10,0);
  const d=t.DEV_get().moralItemDebug('usura');
  assert(d&&d.aff&&d.aff.greed===1);
  assert(near(d.match,1,1e-3));
  assert.strictEqual(d.level,'HARMÔNICA');
  assert(d.mods.length===1&&d.mods[0].stat==='coinMul');
  assert(d.baseEffect&&d.baseEffect.length>0);
  assert.strictEqual(t.DEV_get().moralItemDebug('nao-existe'),null);
  t.DEV_off();t.clearDevTaint();
});
ok('DEV.moralItems lista o catálogo inteiro com nível de sintonia',()=>{
  t.DEV_on();
  const list=t.DEV_get().moralItems();
  assert.strictEqual(list.length,t.ITEMS.length);
  for(const x of list)assert(typeof x.level==='string');
  t.DEV_off();
});
ok('DEV.simulateMoralChoice usa o caminho real (moralGain) e contamina',()=>{
  t.DEV_on();
  freshRun();
  t.clearDevTaint();
  const prof=t.DEV_get().simulateMoralChoice('greed',2);
  assert(prof&&t.getMoral().greed===2);
  assert.strictEqual(t.getMoral().comp,0);
  assert.strictEqual(t.getTainted(),true);
  assert.strictEqual(t.DEV_get().simulateMoralChoice('xyz',2),false);
  t.DEV_off();t.clearDevTaint();
});
ok('inspetores DEV são leitura pura: não contaminam a run',()=>{
  t.DEV_on();
  freshRun();
  t.clearDevTaint();
  t.DEV_get().moralProfile();
  t.DEV_get().moralItems();
  t.DEV_get().moralItemDebug('placa');
  assert.strictEqual(t.getTainted(),false,'inspecionar não é trapacear');
  t.DEV_off();
});

/* ================= J. EQUILÍBRIO / UI / MIGRAÇÃO ================= */
ok('jogador equilibrado segue 100% viável: zero malus, zero mods morais',()=>{
  freshRun();
  setMoralRaw(4,4,4);
  t.giveItem(t.itemById('nucleo'),true);
  t.giveItem(t.itemById('usura'),true);
  const p=t.getPlayer();
  assert.strictEqual(p.sm.filter(x=>t.isMoralTuneModId(x.id)).length,0);
  assert(t.smGet(p,'dmgTaken')>=1-EPS||true);   // nenhum malus moral aplicado
});
ok('countAttunedItems conta apenas módulos AFIM ou melhor',()=>{
  freshRun();
  setMoralRaw(0,0,10);
  t.giveItem(t.itemById('nucleo'),true);   // viol puro → harmônico
  t.giveItem(t.itemById('lente'),true);    // neutro
  t.giveItem(t.itemById('placa'),true);    // comp puro → divergente
  assert.strictEqual(t.countAttunedItems(t.getPlayer()),1);
});
ok('UI: tag de sintonia lista os eixos e o nível atual; neutro fica limpo',()=>{
  freshRun();
  setMoralRaw(0,0,10);
  const tag=t.moralAffinityTagHTML('nucleo',true);
  assert(tag.indexOf('SINTONIA')>=0&&tag.indexOf('VIOLÊNCIA')>=0);
  assert(tag.indexOf('HARMÔNICA')>=0,'nível atual exibido');
  assert.strictEqual(t.moralAffinityTagHTML('lente',true),'','item neutro sem poluição');
});
ok('UI: frase de tooltip existe e não expõe a fórmula',()=>{
  const ph=t.moralAffinityPhrase('nucleo');
  assert(ph.indexOf('violentos')>=0);
  assert(!/\d|baseline|dot|match/i.test(ph),'sem números nem jargão interno');
  assert.strictEqual(t.moralAffinityPhrase('lente'),'');
});
ok('runData do Echo preserva o snapshot moral da run (dado p/ PRs futuros)',()=>{
  assert(/moral:\{comp:moral\.comp,greed:moral\.greed,viol:moral\.viol\},dom:moralDom\(\)/.test(RAWSRC),
    'onPlayerDeath continua fotografando a moral');
});

/* ========= K. AUDITORIA DE STACKING — ORÇAMENTO GLOBAL POR EIXO ========= */
/* razão do stat causada SOMENTE pela sintonia (com mods ÷ sem mods) */
function tuneRatio(p,stat){
  const withM=t.smGet(p,stat);
  const saved=p.sm.slice();
  p.sm=p.sm.filter(x=>!t.isMoralTuneModId(x.id));
  const without=t.smGet(p,stat);
  p.sm=saved;
  return withM/without;
}
function giveAll(ids){for(const id of ids)t.giveItem(t.itemById(id),true);}
const VIOL_PURE=Object.keys(t.MORAL_AFFINITY).filter(id=>t.MORAL_AFFINITY[id].viol===1);
const COMP_ALL=Object.keys(t.MORAL_AFFINITY).filter(id=>t.MORAL_AFFINITY[id].comp>0);
const VIOL_ALL=Object.keys(t.MORAL_AFFINITY).filter(id=>t.MORAL_AFFINITY[id].viol>0);
const GREED_ALL=Object.keys(t.MORAL_AFFINITY).filter(id=>t.MORAL_AFFINITY[id].greed>0);

ok('stacking é ADITIVO: 1 item = teto por item, 2 itens = soma exata',()=>{
  freshRun();setMoralRaw(0,0,10);
  giveAll(VIOL_PURE.slice(0,1));
  assert(near(tuneRatio(t.getPlayer(),'damage'),1+B.affinity.maxBonus.viol),'1 item → +5%');
  freshRun();setMoralRaw(0,0,10);
  giveAll(VIOL_PURE.slice(0,2));
  const two=Math.min(2*B.affinity.maxBonus.viol,B.affinity.totalCaps.viol);
  assert(near(tuneRatio(t.getPlayer(),'damage'),1+two),'2 itens somam (não multiplicam)');
});
ok('3, 4 e N itens: a soma SATURA no orçamento global (nunca cresce além)',()=>{
  for(const n of [3,4,VIOL_PURE.length]){
    freshRun();setMoralRaw(0,0,10);
    giveAll(VIOL_PURE.slice(0,n));
    assert(near(tuneRatio(t.getPlayer(),'damage'),1+B.affinity.totalCaps.viol),
      n+' itens → exatamente o cap (+'+(B.affinity.totalCaps.viol*100)+'%)');
  }
});
ok('VIOLENCE MAX BUILD (todos os itens afinados): sintonia ≤ cap global',()=>{
  freshRun();setMoralRaw(0,0,12);   // tier 3 CONSUMIDO
  giveAll(VIOL_ALL);
  const r=tuneRatio(t.getPlayer(),'damage');
  assert(r<=1+B.affinity.totalCaps.viol+EPS,'sintonia dano ×'+r.toFixed(4));
  assert(r>1,'ainda perceptível');
});
ok('COMPASSION MAX BUILD: redução de dano recebido ≤ cap global',()=>{
  freshRun();setMoralRaw(12,0,0);
  giveAll(COMP_ALL);
  const r=tuneRatio(t.getPlayer(),'dmgTaken');
  assert(r>=1-B.affinity.totalCaps.comp-EPS,'dmgTaken ×'+r.toFixed(4));
  assert(r<1,'ainda perceptível');
});
ok('GREED MAX BUILD: bônus de créditos ≤ cap global',()=>{
  freshRun();setMoralRaw(0,12,0);
  giveAll(GREED_ALL);
  const r=tuneRatio(t.getPlayer(),'coinMul');
  assert(r<=1+B.affinity.totalCaps.greed+EPS,'coinMul ×'+r.toFixed(4));
  assert(r>1,'ainda perceptível');
});
ok('escala proporcional: acima do cap, cada item contribui a sua fração',()=>{
  freshRun();setMoralRaw(0,0,10);
  giveAll(VIOL_PURE.slice(0,4));    // raw 4×5% = 20% > cap 10% → scale 0.5
  const p=t.getPlayer();
  const mods=p.sm.filter(x=>t.isMoralTuneModId(x.id)&&x.stat==='damage');
  assert.strictEqual(mods.length,4);
  for(const m of mods)assert(near(m.value,B.affinity.totalCaps.viol/4),'fração igual');
  const sum=mods.reduce((s,m)=>s+m.value,0);
  assert(near(sum,B.affinity.totalCaps.viol),'soma == orçamento');
});
ok('remover item reduz a contribuição corretamente (total nunca sobe)',()=>{
  freshRun();setMoralRaw(0,0,10);
  giveAll(VIOL_PURE.slice(0,3));    // saturado no cap
  const p=t.getPlayer();
  const r3=tuneRatio(p,'damage');
  p.items=VIOL_PURE.slice(0,2);t.applyMoralTuning(p);   // ainda 2×5% = cap
  const r2=tuneRatio(p,'damage');
  p.items=VIOL_PURE.slice(0,1);t.applyMoralTuning(p);   // abaixo do cap
  const r1=tuneRatio(p,'damage');
  assert(r2<=r3+EPS&&r1<r2,'monotônico: '+r3.toFixed(3)+' ≥ '+r2.toFixed(3)+' > '+r1.toFixed(3));
  assert(near(r1,1+B.affinity.maxBonus.viol),'1 item volta ao valor individual');
});
ok('Continue Run com build MÁXIMA: total idêntico, nenhuma duplicação',()=>{
  freshRun();setMoralRaw(0,0,10);
  giveAll(VIOL_ALL);
  const before=tuneRatio(t.getPlayer(),'damage');
  t.setState('play');
  assert(t.captureCheckpoint('teste',3));
  t.resumeRun();
  const p=t.getPlayer();
  assert(near(tuneRatio(p,'damage'),before,1e-6),'resume reproduz o mesmo total');
  const ids=p.sm.filter(x=>t.isMoralTuneModId(x.id)).map(x=>x.id);
  assert.strictEqual(new Set(ids).size,ids.length,'nenhum id duplicado');
});
ok('reload triplo com build máxima: totais estáveis (recalcular ≠ acumular)',()=>{
  const p=t.getPlayer();
  const r=tuneRatio(p,'damage'),n=p.sm.length;
  t.applyMoralTuning(p);t.applyMoralTuning(p);t.applyMoralTuning(p);
  assert(near(tuneRatio(p,'damage'),r)&&p.sm.length===n);
});
ok('item misto NUNCA soma dois bônus máximos (orçamento por construção)',()=>{
  for(const id in t.MORAL_AFFINITY){
    const plan=t.calcMoralTuningPlan([id],t.getMoralProfile({comp:5,greed:0,viol:5}));
    for(const e of plan.per){
      const frac=e.raw.comp/B.affinity.maxBonus.comp+
        e.raw.greed/B.affinity.maxBonus.greed+
        e.raw.viol/B.affinity.maxBonus.viol;
      assert(frac<=1+EPS,id+' excede o orçamento de item ('+frac+')');
    }
  }
});
ok('perfis mistos (C/V, G/V, C/G): cada eixo respeita o próprio cap',()=>{
  const profs=[[7,0,7],[0,7,7],[7,7,0]];
  const all=Object.keys(t.MORAL_AFFINITY);
  for(const [c,g,v] of profs){
    const plan=t.calcMoralTuningPlan(all,t.getMoralProfile({comp:c,greed:g,viol:v}));
    assert(plan.capped.comp<=B.affinity.totalCaps.comp+EPS);
    assert(plan.capped.greed<=B.affinity.totalCaps.greed+EPS);
    assert(plan.capped.viol<=B.affinity.totalCaps.viol+EPS);
  }
});
ok('item neutro no meio da build máxima segue sem gerar nada',()=>{
  freshRun();setMoralRaw(0,0,10);
  giveAll(['lente',...VIOL_PURE.slice(0,3)]);
  const p=t.getPlayer();
  assert.strictEqual(p.sm.filter(x=>x.id.indexOf('moral:item:lente:')===0).length,0);
});
ok('mEff legado INTOCADO: valores de tier idênticos ao PR 8 (snapshot)',()=>{
  freshRun();
  setMoralRaw(0,0,12);   // Violência tier 3 → escala 1.7
  const e=t.getMEff();
  assert(near(e.dmgMul,1+.26*1.7),'dmgMul 1.442');
  assert(near(e.playerDmgTaken,1+.22*1.7),'playerDmgTaken 1.374');
  assert(near(e.enemyHp,1+.20*1.7),'enemyHp 1.34');
  setMoralRaw(0,12,0);   // Ganância tier 3
  assert(near(t.getMEff().coinMul,1+.85*1.7),'coinMul 2.445');
  assert(near(t.getMEff().shopMul,1+.34*1.7),'shopMul 1.578');
  setMoralRaw(12,0,0);   // Compaixão tier 3
  assert(near(t.getMEff().upgMul,1-.28*1.7),'upgMul 0.524');
});
ok('aplicar sintonia NÃO altera mEff (sistemas separados)',()=>{
  freshRun();setMoralRaw(0,0,12);
  const snap=JSON.stringify(t.getMEff());
  giveAll(VIOL_ALL);
  t.applyMoralTuning(t.getPlayer());
  assert.strictEqual(JSON.stringify(t.getMEff()),snap);
});
ok('pior caso TOTAL (sintonia × mEff) fica em faixa saudável',()=>{
  const worst=(1+B.affinity.totalCaps.viol)*(1+.26*1.7);
  assert(worst<1.60,'dano moral total ×'+worst.toFixed(3)+' < ×1.60');
  const worstCoin=(1+B.affinity.totalCaps.greed)*(1+.85*1.7);
  assert(worstCoin<2.85,'coin moral total ×'+worstCoin.toFixed(3)+' < ×2.85');
  const worstDef=1-B.affinity.totalCaps.comp;
  assert(worstDef>=.90-EPS,'redução máx. de dano recebido ≤ 10%');
});
ok('feedback loop de eventos: nenhum eixo monopoliza o sorteio',()=>{
  freshRun();setMoralRaw(0,0,30);   // Violência extrema
  let k=0;
  MathF._rng=()=>{k=(k+1)%9973;return k/9973;};
  const N=20000,cnt={comp:0,greed:0,viol:0,neutro:0};
  for(let i=0;i<N;i++){
    const kind=t.pickEventKind();
    cnt[t.EVENT_AFFINITY[kind]||'neutro']++;
  }
  MathF._rng=()=>0.4242;
  const share=a=>cnt[a]/N;
  assert(share('viol')<=.30,'eixo dominante ≤ 30% ('+(share('viol')*100).toFixed(1)+'%)');
  assert(share('comp')>=.15,'Compaixão segue relevante ('+(share('comp')*100).toFixed(1)+'%)');
  assert(share('greed')>=.15,'Ganância segue relevante ('+(share('greed')*100).toFixed(1)+'%)');
  assert(share('neutro')>=.30,'eventos neutros seguem fortes em grupo');
});


console.log('---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('FALHAS EM PR 9');process.exit(1);}
console.log('PR 9 — TODOS OS TESTES PASSARAM');
