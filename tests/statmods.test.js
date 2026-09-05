'use strict';
/* =====================================================================
   TESTES — STAT MODIFIER PIPELINE (ECHO · PR 7)
   Arquitetura central de modificadores: BASE + FLAT + ADD + MULT +
   OVERRIDE + CONDITIONAL → FINAL, com remoção/stacking/temporários,
   clamps, breakdown e determinismo.
   Executa o script REAL de index.html em um sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/statmods.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

/* expõe os símbolos top-level (const/let não viram propriedades do global) */
src+='\n;globalThis.__t={CHARS,makePlayer,startRun,setChar,itemById,'+
  'ITEMS,UPGRADES,SM_STATS,SM_ORDER,'+
  'smAdd,smMul,smFlat,smAddPct,smRemoveId,smRemoveSource,smHas,smGet,'+
  'smRefresh,smTick,smTickClock,smBreakdown,calcDamageMul,smInit,'+
  'getState:()=>state,getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'unlockAll:()=>{for(const k in UNLOCKS)if(prog.seen.indexOf(k)<0)prog.seen.push(k);}};';

/* ---------------- DOM mínimo (igual aos outros harnesses) ---------------- */
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
T.unlockAll();

/* ---------------- helpers ---------------- */
const EPS=1e-9;
const near=(a,b,e)=>Math.abs(a-b)<=(e==null?1e-6:e);
let passed=0,failed=0;
function test(name,fn){
  try{fn();passed++;console.log('  ✔ '+name);}
  catch(e){failed++;console.error('  ✘ '+name+'\n    '+e.message);}
}
/* player limpo do operador idx (usa o pipeline real) */
function run(idx){
  T.setChar(idx==null?0:idx);
  T.startRun();
  return T.getPlayer();
}
/* player isolado para testes de pipeline (sem catálogo) */
function bare(){
  const p=T.makePlayer();
  return p;
}

console.log('\nECHO — Stat Modifier Pipeline (PR 7)');
console.log('---------------------------------------------');

/* 1. sintaxe */
test('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(src);
});

/* 2. operador sem módulos = base */
test('Operador sem módulos mantém o stat na base',()=>{
  const p=run(0);                      // VECTOR
  assert.strictEqual(p.dmgMul,1);      // base dmg
  assert.strictEqual(p.crit,.05);      // base crit
  assert.strictEqual(p.pierce,0);
  assert.ok(near(p.speed,335));
  assert.strictEqual(p.sm.length,0);   // nenhum modificador persistente
});
test('Wraith (idx 1) base de dano/crit preservada',()=>{
  const p=run(1);
  assert.ok(near(p.dmgMul,1.18));
  assert.ok(near(p.crit,.16));
});

/* 3. API: adicionar/remover/has/get */
test('smMul registra e recalcula o stat (base preservada)',()=>{
  const p=bare();
  const base=p.dmgMul;
  const mod=T.smMul(p,'damage','test.x','TESTE ×1.5',1.5);
  assert.ok(mod);
  assert.ok(T.smHas(p,'test.x'));
  assert.ok(near(p.dmgMul,base*1.5));
  assert.ok(near(T.smGet(p,'damage'),base*1.5));
  assert.ok(near(p._smBase.dmg,base),'base imutável');
});
test('smRemoveId remove e volta exatamente à base',()=>{
  const p=bare();
  const base=p.dmgMul;
  T.smMul(p,'damage','a','A',1.30);
  T.smMul(p,'damage','b','B',1.20);
  T.smRemoveId(p,'a');
  assert.ok(!T.smHas(p,'a'));
  assert.ok(near(p.dmgMul,base*1.20));
  T.smRemoveId(p,'b');
  assert.ok(near(p.dmgMul,base),'volta exatamente à base');
});
test('smRemoveSource remove todos os modificadores de uma origem',()=>{
  const p=bare();
  T.smAdd(p,{id:'s1',source:'guild',stat:'damage',type:'mult',value:1.1,label:'x'});
  T.smAdd(p,{id:'s2',source:'guild',stat:'damage',type:'mult',value:1.1,label:'y'});
  T.smAdd(p,{id:'s3',source:'outro',stat:'damage',type:'mult',value:1.5,label:'z'});
  assert.ok(near(T.smGet(p,'damage')/p._smBase.dmg,1.1*1.1*1.5));
  T.smRemoveSource(p,'guild');
  assert.ok(near(T.smGet(p,'damage')/p._smBase.dmg,1.5));
});

/* 4. tipos: flat / add / mult / override */
test('FLAT soma',()=>{
  const p=bare();
  const base=p.crit;
  T.smFlat(p,'crit','f1','+0.10',.10);
  T.smFlat(p,'crit','f2','+0.05',.05);
  assert.ok(near(p.crit,Math.min(1,base+.15)));
});
test('ADD (%) acumula de forma ADITIVA (não multiplicativa)',()=>{
  const p=bare();
  const base=p.dmgMul;
  T.smAddPct(p,'damage','a1','+15%',.15);
  T.smAddPct(p,'damage','a2','+15%',.15);
  assert.ok(near(p.dmgMul,base*(1+.30)),'esperado +30% total (aditivo)');
});
test('MULT empilha multiplicativamente',()=>{
  const p=bare();
  const base=p.dmgMul;
  T.smMul(p,'damage','m1','×1.3',1.3);
  T.smMul(p,'damage','m2','×1.2',1.2);
  assert.ok(near(p.dmgMul,base*1.3*1.2));
});
test('OVERRIDE substitui o resultado inteiro',()=>{
  const p=bare();
  T.smMul(p,'damage','a','A',2.0);
  T.smAdd(p,{id:'o',stat:'damage',type:'override',value:7,label:'OVERRIDE'});
  assert.strictEqual(p.dmgMul,7);
  T.smRemoveId(p,'o');
  assert.ok(near(p.dmgMul,p._smBase.dmg*2.0));
});

/* 5. stacking: stack / replace / refresh / unique */
test('stacking STACK permite múltiplos com o mesmo id',()=>{
  const p=bare();const base=p.dmgMul;
  T.smMul(p,'damage','dup','D',1.5);
  T.smMul(p,'damage','dup','D',1.5);
  assert.strictEqual(p.sm.filter(x=>x.id==='dup').length,2);
  assert.ok(near(p.dmgMul,base*1.5*1.5));
});
test('stacking REPLACE mantém apenas o último',()=>{
  const p=bare();const base=p.dmgMul;
  T.smAdd(p,{id:'r',stat:'damage',type:'mult',value:1.5,stacks:'replace',label:'R'});
  T.smAdd(p,{id:'r',stat:'damage',type:'mult',value:2.0,stacks:'replace',label:'R'});
  assert.strictEqual(p.sm.filter(x=>x.id==='r').length,1);
  assert.ok(near(p.dmgMul,base*2.0));
});
test('stacking UNIQUE impede duplicata',()=>{
  const p=bare();const base=p.dmgMul;
  T.smAdd(p,{id:'u',stat:'damage',type:'mult',value:1.5,stacks:'unique',label:'U'});
  T.smAdd(p,{id:'u',stat:'damage',type:'mult',value:1.5,stacks:'unique',label:'U'});
  assert.strictEqual(p.sm.filter(x=>x.id==='u').length,1);
  assert.ok(near(p.dmgMul,base*1.5));
});

/* 6. temporários (dur) + expiração */
test('Modificador temporário expira e o stat volta à base',()=>{
  const p=bare();const base=p.dmgMul;
  T.smAdd(p,{id:'temp',stat:'damage',type:'mult',value:1.5,dur:6,label:'TEMP'});
  assert.ok(near(p.dmgMul,base*1.5));
  T.smTick(p,3);assert.ok(near(p.dmgMul,base*1.5));   // ainda ativo
  T.smTick(p,3.0001);assert.ok(near(p.dmgMul,base),'expirou');
  assert.ok(!T.smHas(p,'temp'));
});
test('smTickClock avança',()=>{
  const c0=T.smTickClock();
  const p=bare();
  T.smTick(p,.5);
  assert.ok(T.smTickClock()-c0>0);
});

/* 7. condicional */
test('Modificador condicional é avaliado em getStat/breakdown',()=>{
  const p=bare();const base=p.dmgMul;
  p.flag=false;
  T.smAdd(p,{id:'cond',stat:'damage',type:'mult',value:2.0,label:'COND',
    cond:q=>q.flag===true});
  // campo cacheado reflete persistente; getStat reavalia a condição ao vivo
  assert.ok(near(T.smGet(p,'damage'),base),'inativo não muda o getStat');
  assert.ok(near(T.calcDamageMul(p),base),'inativo não muda o dano real');
  p.flag=true;
  assert.ok(near(T.smGet(p,'damage'),base*2.0),'ativo aplica no getStat');
  assert.ok(near(T.calcDamageMul(p),base*2.0),'ativo aplica no dano real');
  p.flag=false;
  assert.ok(near(T.smGet(p,'damage'),base));
  const bd=T.smBreakdown(p,'damage');
  assert.strictEqual(bd.lines[0].active,false);
});

/* 8. breakdown */
test('smBreakdown expõe base, modificadores e final',()=>{
  const p=bare();
  T.smMul(p,'damage','operator.vector.damage','OPERADOR +0%',1);
  T.smMul(p,'damage','module.X.damage','MÓDULO X +15%',1.15);
  T.smMul(p,'damage','oracle.curse.damage','MALDIÇÃO ×0.70',.70);
  const bd=T.smBreakdown(p,'damage');
  assert.ok(near(bd.base,p._smBase.dmg));
  assert.strictEqual(bd.lines.length,3);
  assert.ok(bd.lines.every(l=>l.active===true));
  assert.ok(near(bd.final,p.dmgMul));
  assert.ok(bd.lines.some(l=>l.id==='oracle.curse.damage'));
});
test('smBreakdown marca condicionais inativos',()=>{
  const p=bare();
  T.smAdd(p,{id:'c',stat:'damage',type:'mult',value:2,label:'COND',cond:()=>false});
  const bd=T.smBreakdown(p,'damage');
  assert.strictEqual(bd.lines[0].active,false);
});

/* 9. determinismo — ordem de adição não muda o resultado (multiplicativo) */
test('Determinismo: A depois B == B depois A',()=>{
  const pa=bare(),pb=bare();
  T.smMul(pa,'damage','A','A',1.30);T.smMul(pa,'damage','B','B',1.20);
  T.smMul(pb,'damage','B','B',1.20);T.smMul(pb,'damage','A','A',1.30);
  assert.ok(near(pa.dmgMul,pb.dmgMul));
});
test('Determinismo: adição repetida + remoção volta exatamente',()=>{
  const p=bare();const base=p.dmgMul;
  T.smMul(p,'damage','x','X',1.1);T.smRemoveId(p,'x');
  assert.ok(near(p.dmgMul,base));
  T.smMul(p,'damage','x','X',1.1);T.smMul(p,'damage','x','X',1.1);
  T.smRemoveId(p,'x');T.smRemoveId(p,'x');
  assert.ok(near(p.dmgMul,base),'sem erro cumulativo');
});

/* 10. clamps */
test('crit é limitado a 1.0',()=>{
  const p=bare();
  T.smFlat(p,'crit','f','+100',1.0);
  T.smFlat(p,'crit','f2','+100',1.0);
  assert.strictEqual(p.crit,1);
});
test('velocidade NÃO tem piso artificial (preserva comportamento antigo)',()=>{
  // Auditoria PR 7: nenhuma build real chega perto de 0 (mínimo ~137 no
  // BULWARK com todas as reduções). O jogo antigo não tinha floor de speed
  // e os slows (auraSlow/slowAura) são aplicados à parte, na leitura.
  // Logo NÃO há clamp novo: a velocidade segue multiplicação pura.
  const p=bare();
  const base=p.speed;
  T.smMul(p,'speed','s1','×0.01',.01);
  T.smMul(p,'speed','s2','×0.01',.01);
  assert.ok(near(p.speed,base*.0001),'sem clamp, speed='+p.speed);
});

/* 11. estado não é re-calculado: hp/shield não enchem de graça */
test('Recalcular stats não enche HP nem Shield gratuitamente',()=>{
  const p=run(0);
  p.hp=40;p.shield=10;
  T.smRefresh(p);
  assert.strictEqual(p.hp,40,'hp permanece estado');
  assert.strictEqual(p.shield,10,'shield permanece estado');
});
test('Redução de shieldMax só CLAMPA o shield atual (nunca enche de graça)',()=>{
  const p=run(0);
  const max0=p.shieldMax;
  p.shield=p.shieldMax;
  p.shieldMax=max0-10;               // estado reduz o teto (ex.: evento)
  T.smRefresh(p);
  assert.ok(p.shield<=p.shieldMax,'shield clampado ao novo teto');
  assert.strictEqual(p.shield,p.shieldMax);
});

/* 12. migração de módulos/upgrades — valores esperados (hand-computed) */
test('Módulos empilham no pipeline com valores corretos',()=>{
  const p=run(0);                       // VECTOR dmg=1
  const it=T.itemById('nucleo'); it.apply(p);     // ×1.30
  const it2=T.itemById('estilhaco');it2.apply(p); // ×1.40, ×0.60 rangedRange, ×1.20 meleeRange, ×1.15 rate
  assert.ok(near(p.dmgMul,1*1.30*1.40));
  assert.ok(near(p.rangedRangeMul,.60));
  assert.ok(near(p.meleeRangeMul,1.20));
  assert.ok(near(p.fireRateMul,1.15));
  assert.strictEqual(p.items.length,0,'giveItem não usado — sem inventário');
});
test('Upgrades aplicam stat via pipeline',()=>{
  const p=run(0);
  const u=T.UPGRADES.find(u=>u.id==='dmg');u.apply(p);    // ×1.14
  const u2=T.UPGRADES.find(u=>u.id==='rate');u2.apply(p); // ×1.12 rate
  assert.ok(near(p.dmgMul,1.14));
  assert.ok(near(p.fireRateMul,1.12));
});
test('Build composta: operador + múltiplos módulos + upgrades',()=>{
  const p=run(0);
  T.itemById('nucleo').apply(p);      // dmg ×1.30
  T.itemById('olho').apply(p);        // crit +.22, critMul +.40, dmg ×.90
  T.UPGRADES.find(u=>u.id==='dmg').apply(p);   // dmg ×1.14
  T.UPGRADES.find(u=>u.id==='crit').apply(p);  // crit +.08
  const expDmg=1*1.30*.90*1.14;
  assert.ok(near(p.dmgMul,expDmg));
  assert.ok(near(p.crit,.05+.22+.08));
  assert.ok(near(p.critMul,1.8+.40));
});
test('calcDamageMul == stat de dano (sem bônus condicionais ativos)',()=>{
  const p=run(0);
  T.itemById('nucleo').apply(p);
  assert.ok(near(T.calcDamageMul(p),p.dmgMul));
});

/* 13. curse → modificador temporário do pipeline */
test('Curse reduz dano via pipeline e retorna exatamente ao remover',()=>{
  const p=run(0);const base=p.dmgMul;
  // simulando a aplicação do Oráculo (mesmo id usado em produção)
  T.smMul(p,'damage','status.oracle_curse.damage','MALDIÇÃO −30%',.70);
  assert.ok(near(p.dmgMul,base*.70));
  // expira: remove o modificador (como em updatePlayer quando curseT zera)
  T.smRemoveId(p,'status.oracle_curse.damage');
  assert.ok(near(p.dmgMul,base),'dano volta exatamente');
  assert.ok(!T.smHas(p,'status.oracle_curse.damage'));
});

/* 14. breakdown de build real */
test('Breakdown reflete uma build real de módulos',()=>{
  const p=run(0);
  T.itemById('nucleo').apply(p);
  T.itemById('lente').apply(p);      // dmg ×.88, pierce +1
  const bd=T.smBreakdown(p,'damage');
  assert.ok(near(bd.final,1*1.30*.88));
  assert.ok(bd.lines.some(l=>l.id==='module.nucleo.damage'));
  assert.ok(bd.lines.some(l=>l.id==='module.lente.damage'));
  const bp=T.smBreakdown(p,'pierce');
  assert.ok(near(bp.final,1));
});

/* 15. save-compat: campos derivados continuam nos campos que o save lê */
test('p.dmgMul/p.fireRateMul/crit continuam válidos para o save de Echo',()=>{
  const p=run(0);
  T.itemById('nucleo').apply(p);
  T.UPGRADES.find(u=>u.id==='rate').apply(p);
  const rd={dmgMul:p.dmgMul,frMul:p.fireRateMul,crit:p.crit,critMul:p.critMul,
    pierce:p.pierce,rangeMul:p.rangeMul,projSpdMul:p.projSpdMul,aoeMul:p.aoeMul};
  assert.ok(near(rd.dmgMul,1.30));
  assert.ok(near(rd.frMul,1.12));
  assert.ok(isFinite(rd.crit)&&isFinite(rd.pierce));
});

/* 16. todos os stats conhecidos estão na tabela SM_STATS */
test('SM_STATS cobre os stats do DEV inspector + extras',()=>{
  const keys=Object.keys(T.SM_STATS);
  for(const k of ['damage','fireRate','crit','critMul','range','projSpd','aoe',
    'speed','pickupR','coinMul','dmgTaken','pierce'])assert.ok(keys.includes(k),k);
});

/* 17. ordem determinística declarada */
test('SM_ORDER é flat→add→mult→override',()=>{
  assert.strictEqual(T.SM_ORDER.join(','),'flat,add,mult,override');
});

/* 18. EQUIVALÊNCIA (PR 7 §30) — o novo pipeline produz o MESMO resultado
        que o antigo modelo de mutação direta, dentro de tolerância. */
test('Equivalência: pipeline == mutação direta antiga (build completa)',()=>{
  // cenário: VECTOR + núcleo(×1.30) + olho(×.90) + dmg(×1.14) + rate(×1.12)
  // ANTES (modelo antigo: multiplicações diretas sucessivas sobre p.dmgMul)
  const old={dmg:1,rate:1,crit:.05,critMul:1.8,pierce:0,range:1,projSpd:1,aoe:1,
    speed:335,coinMul:1,dmgTaken:1,pickupR:170};
  old.dmg*=1.30; old.dmg*=.90; old.dmg*=1.14;
  old.rate*=1.12;
  old.crit+=.22;
  // DEPOIS (pipeline)
  const p=run(0);
  T.itemById('nucleo').apply(p);                 // ×1.30
  T.itemById('olho').apply(p);                   // ×.90, crit +.22, critMul +.40
  T.UPGRADES.find(u=>u.id==='dmg').apply(p);     // ×1.14
  T.UPGRADES.find(u=>u.id==='rate').apply(p);    // rate ×1.12
  assert.ok(near(p.dmgMul,old.dmg,1e-9),'dano: '+p.dmgMul+' vs '+old.dmg);
  assert.ok(near(p.fireRateMul,old.rate,1e-9));
  assert.ok(near(p.crit,old.crit,1e-9));
});
test('Equivalência: crit/critMul/pierce somados (flat) idênticos',()=>{
  const p=run(0);
  T.itemById('olho').apply(p);      // crit+.22 critMul+.40
  T.UPGRADES.find(u=>u.id==='critx').apply(p); // crit+.14 critMul+.55
  T.itemById('lente').apply(p);     // pierce+1
  assert.ok(near(p.crit,.05+.22+.14));
  assert.ok(near(p.critMul,1.8+.40+.55));
  assert.strictEqual(p.pierce,1);
});
test('Equivalência: maxHp/HP mantêm o comportamento de estado (não pipeline)',()=>{
  // núcleo reduz maxHp em 15% e CLAMPA hp — comportamento preservado intacto
  const p=run(0);                    // VECTOR maxHp=100
  p.hp=60;
  T.itemById('nucleo').apply(p);
  assert.strictEqual(p.maxHp,Math.max(30,Math.round(100*.85)));
  assert.ok(p.hp<=p.maxHp,'hp clampado');
  // placa: +55 maxHp e CURA 55 (comportamento legado preservado)
  const q=run(0);q.hp=50;
  T.itemById('placa').apply(q);
  assert.strictEqual(q.maxHp,155);
  assert.ok(near(q.hp,105),'placa cura pelo acréscimo (legado)');
});
test('Equivalência: save de Echo lê os mesmos campos derivados',()=>{
  const p=run(0);
  T.itemById('nucleo').apply(p);
  T.itemById('estilhaco').apply(p);
  T.UPGRADES.find(u=>u.id==='rate').apply(p);
  const rd={dmgMul:p.dmgMul,frMul:p.fireRateMul,crit:p.crit,critMul:p.critMul,
    pierce:p.pierce,aoeMul:p.aoeMul,rangeMul:p.rangeMul,projSpdMul:p.projSpdMul,
    rangedRangeMul:p.rangedRangeMul,meleeRangeMul:p.meleeRangeMul};
  assert.ok(near(rd.dmgMul,1*1.30*1.40));
  assert.ok(near(rd.frMul,1.15*1.12));
  assert.ok(near(rd.rangeMul,1));
  assert.ok(near(rd.rangedRangeMul,.60));
  assert.ok(near(rd.meleeRangeMul,1.20));
  // todos os campos consumidos por makeEcho/saveEchoes existem e são finitos
  for(const k of Object.keys(rd))assert.ok(isFinite(rd[k]),k);
});
test('Equivalência: maldição não deixa resíduo após expirar',()=>{
  const p=run(0);const base=p.dmgMul;
  T.smMul(p,'damage','status.oracle_curse.damage','MALDIÇÃO',.70);
  assert.ok(near(p.dmgMul,base*.70));
  T.smRemoveId(p,'status.oracle_curse.damage');
  // múltiplos ciclos aplicar/remover não acumulam erro numérico
  for(let i=0;i<5;i++){
    T.smMul(p,'damage','status.oracle_curse.damage','MALDIÇÃO',.70);
    T.smRemoveId(p,'status.oracle_curse.damage');
  }
  assert.ok(near(p.dmgMul,base),'volta exatamente à base após 5 ciclos');
});
test('Equivalência: determinismo independente da ordem de aquisição',()=>{
  const a=run(0),b=run(0);
  const build=[['nucleo',null],['olho',null],['estilhaco',null]];
  for(const [id] of build)T.itemById(id).apply(a);
  for(const [id] of [...build].reverse())T.itemById(id).apply(b);
  assert.ok(near(a.dmgMul,b.dmgMul),'dano '+a.dmgMul+' vs '+b.dmgMul);
  assert.ok(near(a.fireRateMul,b.fireRateMul));
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
process.exit(failed?1:0);
