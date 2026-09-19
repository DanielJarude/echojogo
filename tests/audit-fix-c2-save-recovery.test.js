'use strict';
/* =====================================================================
   TESTES — AUDIT-FIX-C2 · RECUPERAÇÃO DE SAVE ILEGÍVEL (ECHO)
   ---------------------------------------------------------------------
   Congela a política conservadora de persistência:
   · echoSave.v3 VÁLIDO continua sendo lido e gravado exatamente como antes;
   · echoSave.v3 ilegível nunca é sobrescrito sem antes ser preservado em
     echoSave.v3.corruptBackup (cópia byte-a-byte do blob original);
   · backup pré-existente NUNCA é destruído (política: manter o primeiro);
   · corrupção repetida não gera comportamento destrutivo nem loop;
   · boot continua funcional com raiz corrompida;
   · migração da Alpha só remove a chave que conseguiu realmente ler;
   · legado ilegível é preservado e nunca vira dado inventado;
   · migração não re-executa quando já existe raiz v3.
   Executa o script REAL de index.html em um sandbox Node (DOM mínimo).
   Rodar: npm test  |  node tests/audit-fix-c2-save-recovery.test.js
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
const src=m[1];

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
/* localStorage controlável:
   · `fail`      — setItem lança para QUALQUER chave (cota/porta fechada);
   · `failKey`   — setItem lança apenas para essa chave (cota parcial);
   · `log`       — ordem exata das escritas/remoções, para provar que o
                   backup acontece ANTES de echoSave.v3 ser sobrescrito. */
function makeLocalStorage(seed){
  return {_d:Object.assign({},seed||{}),fail:false,failKey:null,writes:0,log:[],
    getItem(k){return Object.prototype.hasOwnProperty.call(this._d,k)?this._d[k]:null;},
    setItem(k,v){
      if(this.fail||(this.failKey&&k===this.failKey))
        throw new Error('QuotaExceededError (simulado)');
      this.writes++;this.log.push('set:'+k);this._d[k]=String(v);
    },
    removeItem(k){this.log.push('del:'+k);delete this._d[k];}};
}
function makeSandbox(ls){
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
  return {console:{log(){},warn(){},error(){}},Math,Date,parseInt,parseFloat,
    isNaN,isFinite,
    setTimeout:()=>0,clearTimeout:()=>{},requestAnimationFrame:()=>0,
    Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
    Promise,Proxy,Reflect,JSON,Symbol,
    document,window,localStorage:ls,
    navigator:{getGamepads:()=>[],userAgent:'node'},
    performance:{now:()=>Date.now()}
  };
}
/* `tune` ajusta o localStorage ANTES do boot (o script roda smBoot() na carga) */
function bootGame(seed,tune){
  const ls=makeLocalStorage(seed);
  if(tune)tune(ls);
  const ctx=vm.createContext(makeSandbox(ls));
  vm.runInContext(src,ctx,{timeout:20000});
  const X=code=>vm.runInContext(code,ctx);
  return {X,ls,stored:()=>JSON.parse(ls.getItem('echoSave.v3')||'null')};
}

/* ---------------- harness ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+(e&&e.stack||e));}
}
const METAV={mem:111,spd:2,reroll:1,vault:3,wins:4,
  endings:['liber'],evars:['liber.-']};

const BK='echoSave.v3.corruptBackup';
function slot(o){
  return Object.assign({meta:null,prog:null,char:0,echoes:[],run:null,
    touched:false,fracd:null},o||{});
}
function rootWith(slots,lastSlot){
  const s={1:slot(),2:slot(),3:slot()};
  for(const k in slots||{})Object.assign(s[k],slots[k]);
  return JSON.stringify({version:3,lastSlot:lastSlot||1,slots:s});
}
/* run mínima que passa por smSanitizeRun (contrato do Continue) */
function goodRun(wave){
  return {v:1,wave:wave||3,charIdx:0,echoes:[],
    p:{hp:50,maxHp:100,owned:[0],wi:0,sm:[],items:[],upgLog:[]}};
}

console.log('\nECHO — AUDIT-FIX-C2 · Recuperação de save ilegível');
console.log('---------------------------------------------');

/* =====================================================================
   A. SAVE VÁLIDO — NENHUMA MUDANÇA DE COMPORTAMENTO
   ===================================================================== */
ok('A1: raiz v3 válida é lida normalmente e NÃO gera backup de corrupção',()=>{
  const {X,ls,stored}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  assert.strictEqual(X('meta.mem'),111,'meta do slot 1 carregado');
  assert.strictEqual(ls.getItem(BK),null,'save válido nunca cria backup');
  assert.strictEqual(stored().version,3,'versão do save inalterada');
});

ok('A2: raiz válida continua gravável (smCommit) e mantém o formato v3',()=>{
  const {X,ls,stored}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1);meta.mem=222;');
  assert.strictEqual(X('saveMeta()'),true,'gravação normal não é bloqueada');
  const r=stored();
  assert.strictEqual(r.version,3);
  assert.strictEqual(r.slots['1'].meta.mem,222);
  assert.strictEqual(ls.getItem(BK),null);
});

ok('A3: isolamento dos 3 slots preservado após boot normal',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');assert.strictEqual(X('meta.mem'),111);
  X('activateSlot(2)');assert.strictEqual(X('meta.mem'),0,'Save 2 não herda');
  X('activateSlot(3)');assert.strictEqual(X('meta.mem'),0,'Save 3 não herda');
  X('activateSlot(1)');assert.strictEqual(X('meta.mem'),111,'Save 1 intacto');
});

/* =====================================================================
   B. RAIZ v3 ILEGÍVEL — PRESERVAÇÃO DO BLOB BRUTO
   ===================================================================== */
ok('B1: JSON truncado — backup recebe EXATAMENTE o blob original',()=>{
  const bad=rootWith({1:{meta:METAV,touched:true}}).slice(0,60);
  const {ls}=bootGame({'echoSave.v3':bad});
  assert.strictEqual(ls.getItem(BK),bad,'cópia byte-a-byte do original');
});

ok('B2: boot continua funcional com raiz corrompida (slot ativo + raiz nova)',()=>{
  const bad='{"version":3,"lastSlot":1,"slots":{"1":{"meta":{"mem":9';
  const {X,ls,stored}=bootGame({'echoSave.v3':bad});
  assert.ok(X('curSlot')>=1,'boot ativou um slot');
  assert.strictEqual(X('smRoot.version'),3);
  assert.strictEqual(X('Object.keys(smRoot.slots).join(",")'),'1,2,3');
  assert.strictEqual(stored().version,3,'echoSave.v3 voltou a ser legível');
  assert.strictEqual(ls.getItem(BK),bad,'e o blob antigo não foi perdido');
});

ok('B3: lixo não-JSON também é preservado',()=>{
  const {ls}=bootGame({'echoSave.v3':'<<< corrompido >>>'});
  assert.strictEqual(ls.getItem(BK),'<<< corrompido >>>');
});

ok('B4: versão fora do contrato (v2/v4) é preservada, não descartada',()=>{
  for(const v of [2,4]){
    const raw=JSON.stringify({version:v,lastSlot:1,slots:{1:{meta:METAV}}});
    const {ls}=bootGame({'echoSave.v3':raw});
    assert.strictEqual(ls.getItem(BK),raw,'version='+v);
  }
});

ok('B5: shape inválido (sem slots) é preservado',()=>{
  const raw=JSON.stringify({version:3,lastSlot:1});
  const {ls}=bootGame({'echoSave.v3':raw});
  assert.strictEqual(ls.getItem(BK),raw);
});

ok('B6: o backup acontece ANTES de echoSave.v3 ser sobrescrito',()=>{
  const {ls}=bootGame({'echoSave.v3':'{trunc'});
  const iBk=ls.log.indexOf('set:'+BK);
  const iSv=ls.log.indexOf('set:echoSave.v3');
  assert.ok(iBk>=0,'backup gravado');
  assert.ok(iSv>=0,'raiz nova gravada');
  assert.ok(iBk<iSv,'ordem: preservar → sobrescrever (log='+ls.log.join(',')+')');
});

ok('B7: chave vazia não consome o único slot de backup',()=>{
  const {X,ls}=bootGame({'echoSave.v3':''});
  assert.strictEqual(ls.getItem(BK),null,'string vazia não tem nada a resgatar');
  assert.ok(X('curSlot')>=1,'boot segue funcional');
});

/* =====================================================================
   C. POLÍTICA "MANTER O PRIMEIRO"
   ===================================================================== */
ok('C1: backup pré-existente NÃO é destruído por uma nova corrupção',()=>{
  const antigo='{"version":3,"BLOB":"ORIGINAL"';
  const {ls}=bootGame({'echoSave.v3':'{novo lixo','echoSave.v3.corruptBackup':antigo});
  assert.strictEqual(ls.getItem(BK),antigo,'o primeiro blob preservado sobrevive');
});

ok('C2: corrupção repetida — backup fixo no 1º blob, sem loop e sem destruição',()=>{
  const b1='{"version":3,"blob":1',b2='{"version":3,"blob":2',b3='lixo3';
  const seed={'echoSave.v3':b1};
  let g=bootGame(seed);
  assert.strictEqual(g.ls.getItem(BK),b1);
  /* simula duas novas corrupções sobre o mesmo storage já recuperado */
  g.ls._d['echoSave.v3']=b2;
  g.X('smLoadRoot();activateSlot(1)');
  assert.strictEqual(g.ls.getItem(BK),b1,'2ª corrupção não sobrescreve o backup');
  assert.strictEqual(JSON.parse(g.ls.getItem('echoSave.v3')).version,3,
    'raiz volta a ser legível');
  g.ls._d['echoSave.v3']=b3;
  g.X('smLoadRoot();activateSlot(1)');
  assert.strictEqual(g.ls.getItem(BK),b1,'3ª corrupção idem');
  assert.ok(g.X('curSlot')>=1,'jogo continua funcional');
  assert.strictEqual(g.ls.log.filter(x=>x==='set:'+BK).length,1,
    'exatamente UMA escrita de backup em toda a sessão');
});

ok('C3: raiz recuperada é estável — reboot não gera segunda recuperação',()=>{
  const {ls}=bootGame({'echoSave.v3':'{trunc'});
  const g2=bootGame(Object.assign({},ls._d));
  /* o 2º boot lê uma raiz VÁLIDA: nenhum caminho de recuperação é acionado.
     (o blob pode ser reescrito pelo commit normal do boot — o que não pode
     acontecer é uma nova preservação/perda de dado) */
  assert.strictEqual(g2.ls.log.indexOf('set:'+BK),-1,'nenhum backup novo');
  assert.strictEqual(g2.ls.getItem(BK),ls.getItem(BK),'backup original intacto');
  assert.strictEqual(JSON.parse(g2.ls.getItem('echoSave.v3')).version,3,
    'raiz continua legível');
  assert.strictEqual(g2.X('smCorruptPending'),null,'nenhuma corrupção pendente');
});

/* =====================================================================
   D. FALHA AO PRESERVAR — NUNCA SOBRESCREVER ANTES DO BACKUP
   ===================================================================== */
ok('D1: se o backup não puder ser gravado, echoSave.v3 NÃO é sobrescrito',()=>{
  const bad='{"version":3,"blob":"unico"';
  const {X,ls}=bootGame({'echoSave.v3':bad},l=>{l.failKey=BK;});
  assert.strictEqual(ls.getItem('echoSave.v3'),bad,
    'a única cópia corrompida continua intacta');
  assert.strictEqual(ls.getItem(BK),null,'e o backup realmente falhou');
  assert.ok(X('curSlot')>=1,'boot segue funcional mesmo assim');
  assert.strictEqual(X('smCommit()'),false,'gravação bloqueada enquanto não preservar');
  assert.strictEqual(ls.getItem('echoSave.v3'),bad,'segue intacta após smCommit');
});

ok('D2: quando o storage volta, o próximo smCommit preserva e só então grava',()=>{
  const bad='{"version":3,"blob":"unico"';
  const {X,ls}=bootGame({'echoSave.v3':bad},l=>{l.failKey=BK;});
  ls.failKey=null;
  assert.strictEqual(X('smCommit()'),true,'agora grava');
  assert.strictEqual(ls.getItem(BK),bad,'backup feito com o blob original');
  assert.strictEqual(JSON.parse(ls.getItem('echoSave.v3')).version,3,
    'e só depois a raiz nova ocupou echoSave.v3');
});

ok('D3: migração da Alpha também não sobrescreve um blob ainda não preservado',()=>{
  const bad='{"version":3,"blob":"unico"';
  const {ls}=bootGame({'echoSave.v3':bad,
    'echoMeta.v1':JSON.stringify({mem:50})},l=>{l.failKey=BK;});
  assert.strictEqual(ls.getItem('echoSave.v3'),bad,'raiz corrompida intacta');
  assert.strictEqual(ls.getItem('echoMeta.v1'),JSON.stringify({mem:50}),
    'legado NÃO consumido por uma migração que não pôde gravar');
});

/* =====================================================================
   E. LEGADO DA ALPHA — SÓ REMOVE O QUE FOI REALMENTE MIGRADO
   ===================================================================== */
ok('E1: legado válido migra e a chave antiga é removida',()=>{
  const {X,ls,stored}=bootGame({'echoMeta.v1':JSON.stringify({mem:50,wins:1})});
  assert.strictEqual(stored().slots['1'].meta.mem,50);
  assert.strictEqual(stored().slots['1'].touched,true);
  assert.strictEqual(ls.getItem('echoMeta.v1'),null,'chave legada removida');
  assert.strictEqual(X('meta.mem'),50);
});

ok('E2: legado ILEGÍVEL não é removido e não vira save inventado',()=>{
  const lixo='{"mem":50,,,';
  const {X,ls,stored}=bootGame({'echoMeta.v1':lixo});
  assert.strictEqual(ls.getItem('echoMeta.v1'),lixo,'chave original preservada');
  assert.strictEqual(stored().slots['1'].meta.mem,0,'nada inventado a partir do lixo');
  assert.ok(X('curSlot')>=1,'boot segue funcional');
});

ok('E3: legado misto — remove só a chave lida, preserva a ilegível',()=>{
  const lixo='[[[';
  const {ls,stored}=bootGame({
    'echoMeta.v1':JSON.stringify({mem:7}),
    'echoRuns.v1':lixo});
  assert.strictEqual(ls.getItem('echoMeta.v1'),null,'meta migrado → removido');
  assert.strictEqual(ls.getItem('echoRuns.v1'),lixo,'Ecos ilegíveis → preservados');
  assert.strictEqual(stored().slots['1'].meta.mem,7);
  assert.deepStrictEqual(stored().slots['1'].echoes,[],'sem Ecos inventados');
});

ok('E4: echoChar.v2 não numérico não vira operador 0 e a chave sobrevive',()=>{
  const {ls,stored}=bootGame({
    'echoMeta.v1':JSON.stringify({mem:3}),
    'echoChar.v2':'lixo'});
  assert.strictEqual(ls.getItem('echoChar.v2'),'lixo','chave ilegível preservada');
  assert.strictEqual(stored().slots['1'].char,0,'default do slot, não valor migrado');
  assert.strictEqual(ls.getItem('echoMeta.v1'),null,'a parte legível migrou');
});

ok('E5: echoChar.v2 numérico migra e é removido',()=>{
  const {ls,stored}=bootGame({'echoChar.v2':'2'});
  assert.strictEqual(stored().slots['1'].char,2);
  assert.strictEqual(ls.getItem('echoChar.v2'),null);
});

ok('E6: echoChar.v1 é remapeado por CHAR_LEGACY_IDX e removido',()=>{
  const {X,ls,stored}=bootGame({'echoChar.v1':'4'});
  assert.strictEqual(stored().slots['1'].char,X('CHAR_LEGACY_IDX[4]'),
    'índice v1 → índice atual');
  assert.strictEqual(ls.getItem('echoChar.v1'),null);
});

ok('E7: nada legível em nenhuma chave → nenhuma chave é apagada',()=>{
  const seed={'echoMeta.v1':'{{{','echoProg.v1':'}}}','echoRuns.v1':'nao-json',
    'echoChar.v2':'abc','echoChar.v1':'xyz'};
  const {X,ls}=bootGame(Object.assign({},seed));
  for(const k in seed)
    assert.strictEqual(ls.getItem(k),seed[k],'preservado: '+k);
  assert.ok(X('curSlot')>=1,'boot segue funcional');
  assert.strictEqual(X('smRoot.slots[1].touched'),true,
    'slot 1 é inicializado normalmente pelo activateSlot, não pela migração');
});

ok('E8: migração não re-executa quando já existe raiz v3 válida',()=>{
  const legado=JSON.stringify({mem:999});
  const {ls,stored}=bootGame({
    'echoSave.v3':rootWith({1:{meta:METAV,touched:true}}),
    'echoMeta.v1':legado});
  assert.strictEqual(stored().slots['1'].meta.mem,111,'v3 tem precedência');
  assert.strictEqual(ls.getItem('echoMeta.v1'),legado,'legado intocado');
});

ok('E9: migração falha → boot grava raiz nova → reboot não tenta migrar de novo',()=>{
  const lixo='{{{';
  const g1=bootGame({'echoMeta.v1':lixo});
  assert.strictEqual(g1.ls.getItem('echoMeta.v1'),lixo);
  const g2=bootGame(Object.assign({},g1.ls._d));
  assert.strictEqual(g2.ls.getItem('echoMeta.v1'),lixo,
    'segunda inicialização não apaga o legado');
  assert.strictEqual(g2.ls.log.filter(x=>x.indexOf('del:echo')===0).length,0,
    'nenhuma remoção de chave legada');
});

/* =====================================================================
   F. CONTINUE / SANDBOX / DEV
   ===================================================================== */
ok('F1: Continue — run válida sobrevive ao boot de uma raiz válida',()=>{
  const {X}=bootGame({'echoSave.v3':rootWith({1:{touched:true,run:goodRun(5)}})});
  X('activateSlot(1)');
  assert.notStrictEqual(X('activeRun'),null,'checkpoint preservado');
  assert.strictEqual(X('activeRun.wave'),5);
});

ok('F2: raiz corrompida não ressuscita nem inventa run — Continue fica vazio',()=>{
  const {X,ls}=bootGame({'echoSave.v3':rootWith({1:{touched:true,run:goodRun(5)}}).slice(0,80)});
  assert.strictEqual(X('activeRun'),null,'sem run inventada');
  assert.ok(X('curSlot')>=1,'boot funcional');
  assert.ok(ls.getItem(BK),'blob com a run preservado para resgate manual');
});

ok('F3: proteção Sandbox preservada — smCommit não grava com o laboratório ativo',()=>{
  const {X,ls,stored}=bootGame({'echoSave.v3':rootWith({1:{meta:METAV,touched:true}})});
  X('activateSlot(1)');
  const antes=ls.getItem('echoSave.v3');
  X('sandboxMode=true;meta.mem=777;');
  assert.strictEqual(X('smCommit()'),false,'gravação bloqueada no Sandbox');
  assert.strictEqual(ls.getItem('echoSave.v3'),antes,'arquivo intocado');
  X('sandboxMode=false');
  assert.strictEqual(X('smCommit()'),true,'volta a gravar fora do Sandbox');
  assert.strictEqual(stored().slots['1'].meta.mem,111,
    'meta vivo do Sandbox não foi commitado no slot');
});

ok('F4: Sandbox com raiz corrompida — preserva o blob, mas não grava por cima',()=>{
  const bad='{"version":3,"blob":"unico"';
  const {X,ls}=bootGame({'echoSave.v3':bad});
  assert.strictEqual(ls.getItem(BK),bad,'backup feito no boot');
  X('sandboxMode=true');
  assert.strictEqual(X('smCommit()'),false,'Sandbox continua bloqueando escrita');
  X('sandboxMode=false');
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('\nHÁ FALHAS');process.exit(1);}
console.log('\nTODOS OS TESTES PASSARAM');
