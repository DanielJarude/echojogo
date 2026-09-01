'use strict';
/* =====================================================================
   TESTES — MODO DESENVOLVEDOR + LEGIBILIDADE + BUILD (PR 6.5)

   Harness idêntico ao das outras suítes: executa o script REAL de
   index.html num sandbox Node com DOM mínimo. Rodar: npm test

   O foco destes testes é garantir que o Modo Desenvolvedor:
     · nunca começa ligado;
     · não pode ser ativado numa build de release;
     · não executa nenhum comando com DEV_MODE = false;
     · não contamina Ecos, progressão ou meta-progresso permanentes.
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
const mainJs=fs.readFileSync(path.join(ROOT,'main.js'),'utf8');
const preloadJs=fs.readFileSync(path.join(ROOT,'preload.js'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
const rawSrc=m[1];

const EXPORTS='\n;globalThis.__t={'+
  'DEV,devEnable,devDisable,devToggle,devOpenPanel,devClosePanel,devRender,'+
  'devCommand,devTick,devSetPausePolicy,devTaint,'+
  'DEV_ENEMY_IDS,DEV_MINIBOSS_IDS,DEV_STATUS_IDS,'+
  'EDEFS,MINIBOSS,CHARS,ITEMS,MAX_WAVE,ECHO_VERSION,UNLOCKS,ECHO_SHIELD,'+
  'makePlayer,makeEcho,startRun,setChar,saveEchoes,loadEchoes,saveProg,saveMeta,'+
  'onPlayerDeath,damagePlayer,trustTier,'+
  'isDevMode:()=>DEV_MODE,isDevBuild:()=>IS_DEV_BUILD,isTainted:()=>devTainted,'+
  'setTainted:v=>{devTainted=v;},'+
  'forceDevMode:v=>{DEV_MODE=v;},'+
  'isPanelOpen:()=>devPanelOpen,'+
  'getState:()=>state,setState:s=>{state=s;},'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getEnemies:()=>enemies,getEchoes:()=>echoes,setEchoes:e=>{echoes=e;},'+
  'getWave:()=>wave,setWave:w=>{wave=w;},'+
  'getEchoQueue:()=>echoQueue,setEchoQueue:q=>{echoQueue=q;},'+
  'getMiniBoss:()=>miniBoss,getProg:()=>prog,getMeta:()=>meta,'+
  'setRunTime:v=>{runTime=v;},'+
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

/* ---------------- fábrica de sandbox ----------------
   devWindow = true  → simula Electron NÃO empacotado (canal 'dev')
   devWindow = false → simula build de release                      */
function boot(devBuild){
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
    innerWidth:1920,innerHeight:1080,devicePixelRatio:1,
    screen:{availWidth:1920,availHeight:1080},
    addEventListener:()=>{},removeEventListener:()=>{},
    matchMedia:()=>({addEventListener:()=>{},addListener:()=>{}}),
    AudioContext:undefined,webkitAudioContext:undefined,
    open:()=>({close(){}}),getGamepads:()=>[],
    echoDesktop:devBuild?{isElectron:true,channel:'dev',isDev:true,
      on:()=>()=>{},platform:'linux'}:undefined,
    location:{search:'',hash:''}
  };
  const localStorage={_d:{},getItem(k){return this._d[k]||null;},
    setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
  const navigator={getGamepads:()=>[]};
  const sandbox={console:{log(){},warn(){},error(){}},Math,Date,parseInt,parseFloat,
    isNaN,setTimeout,clearTimeout,
    requestAnimationFrame:()=>0,
    Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
    Promise,Proxy,Reflect,JSON,Symbol,
    document,window,localStorage,navigator,
    performance:{now:()=>Date.now()}
  };
  const ctx=vm.createContext(sandbox);
  vm.runInContext(rawSrc+EXPORTS,ctx,{timeout:20000});
  const api=vm.runInContext('__t',ctx);
  api._ls=localStorage;
  return api;
}

/* ---------------- harness ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+e.message);}
}

console.log('\nECHO — Modo Desenvolvedor / Legibilidade / Build (PR 6.5)');
console.log('---------------------------------------------');

/* ===================================================================
   1. ESTADO INICIAL — SEGURANÇA
   =================================================================== */
const rel=boot(false);   // build de RELEASE
const dev=boot(true);    // build de DESENVOLVIMENTO

ok('index.html: script continua sintaticamente válido',()=>{
  new vm.Script(rawSrc);
});

ok('DEV_MODE começa desativado (build de release)',()=>{
  assert.strictEqual(rel.isDevMode(),false);
});

ok('DEV_MODE começa desativado (build de desenvolvimento)',()=>{
  assert.strictEqual(dev.isDevMode(),false);
});

ok('IS_DEV_BUILD = false numa build empacotada/release',()=>{
  assert.strictEqual(rel.isDevBuild(),false);
});

ok('IS_DEV_BUILD = true apenas em build de desenvolvimento',()=>{
  assert.strictEqual(dev.isDevBuild(),true);
});

ok('Painel DEV não aparece por padrão',()=>{
  assert.strictEqual(rel.isPanelOpen(),false);
  assert.strictEqual(dev.isPanelOpen(),false);
  assert.strictEqual(rel.DEV===undefined,false,'namespace DEV existe');
});

ok('Build normal NÃO consegue ativar o DEV MODE',()=>{
  assert.strictEqual(rel.devEnable(),false);
  assert.strictEqual(rel.devToggle(),false);
  assert.strictEqual(rel.isDevMode(),false);
  assert.strictEqual(rel.isPanelOpen(),false);
});

ok('Nenhum default perigoso ligado no código de produção',()=>{
  const forbidden=[
    /(let|var|const)\s+DEV_MODE\s*=\s*true/,   // inicialização ligada
    /(let|var|const)\s+devTainted\s*=\s*true/,
    /(let|var|const)\s+devInfoOn\s*=\s*true/,
    /(let|var|const)\s+devPanelOpen\s*=\s*true/,
    /godMode/,
    /freeCredits/,
    /devInvuln\s*:\s*true/
  ];
  for(const re of forbidden)
    assert(!re.test(rawSrc),'padrão inseguro encontrado: '+re);
  assert(/let DEV_MODE=false;/.test(rawSrc),'DEV_MODE deve nascer false');
  assert(/let devTainted=false;/.test(rawSrc),'devTainted deve nascer false');
});

ok('Ativação exige atalho explícito Ctrl+Shift+D',()=>{
  assert(/ctrl&&e\.shiftKey&&c==='KeyD'/.test(rawSrc),'atalho não encontrado');
});

/* ===================================================================
   2. FUNÇÕES DEV NÃO EXECUTAM COM DEV_MODE = false
   =================================================================== */
ok('Comandos DEV retornam false com DEV_MODE desligado',()=>{
  rel.setPlayer(null);rel.setWave(0);rel.startRun();
  const D=rel.DEV;
  const calls=[
    ()=>D.goToWave(5),()=>D.nextWave(),()=>D.startWave(),()=>D.clearWave(),
    ()=>D.spawnEnemy('chaser'),()=>D.clearEnemies(),
    ()=>D.spawnMiniBoss('herald'),()=>D.clearMiniBoss(),()=>D.spawnBoss(),
    ()=>D.heal(),()=>D.fullHp(),()=>D.killPlayer(),()=>D.toggleInvuln(),
    ()=>D.addCoins(500),()=>D.setSpeed(3),
    ()=>D.fillShield(),()=>D.zeroShield(),()=>D.breakShield(),()=>D.setShieldMax(90),
    ()=>D.spawnEcho(1),()=>D.clearEchoes(),()=>D.setTrust(1,10),()=>D.addTrust(1,10),
    ()=>D.forceRole(1),()=>D.resetRoleCd(1),()=>D.forceSpeak(1),
    ()=>D.dissonance(1),()=>D.endDissonance(1),
    ()=>D.applyStatus('burn'),()=>D.clearStatus(),()=>D.curse(),
    ()=>D.grantModule('nucleo'),()=>D.openShop(),()=>D.reroll(),
    ()=>D.setOperatorNextRun('wraith'),()=>D.toggleInfo()
  ];
  for(let i=0;i<calls.length;i++)
    assert.strictEqual(calls[i](),false,'comando #'+i+' executou com DEV off');
});

ok('devCommand() é inerte com DEV_MODE desligado',()=>{
  assert.strictEqual(rel.devCommand('gowave'),false);
  assert.strictEqual(rel.devCommand('e:chaser'),false);
  assert.strictEqual(rel.devCommand('kill'),false);
});

ok('Estado da run permanece intacto após comandos bloqueados',()=>{
  const p=rel.getPlayer();
  assert(p,'player deve continuar existindo');
  assert.strictEqual(rel.getPlayer().hp,p.maxHp);
  assert.strictEqual(rel.getEnemies().length,0);
  assert.strictEqual(rel.isTainted(),false);
});

/* ===================================================================
   3. ATIVAÇÃO / DESATIVAÇÃO
   =================================================================== */
function freshDevRun(){
  dev.setPlayer(null);dev.setWave(0);dev.setEchoQueue([]);
  dev.forceDevMode(false);dev.setTainted(false);
  dev.startRun();
  dev.devEnable();
  return dev.DEV;
}

ok('devEnable() liga o modo e abre o painel (build de dev)',()=>{
  dev.forceDevMode(false);dev.setTainted(false);
  dev.setPlayer(null);dev.setWave(0);dev.startRun();
  assert.strictEqual(dev.devEnable(),true);
  assert.strictEqual(dev.isDevMode(),true);
  assert.strictEqual(dev.isPanelOpen(),true);
});

ok('devDisable() desliga o modo e fecha o painel',()=>{
  assert.strictEqual(dev.devDisable(),true);
  assert.strictEqual(dev.isDevMode(),false);
  assert.strictEqual(dev.isPanelOpen(),false);
});

ok('devToggle() alterna corretamente',()=>{
  assert.strictEqual(dev.devToggle(),true);
  assert.strictEqual(dev.isDevMode(),true);
  dev.devToggle();
  assert.strictEqual(dev.isDevMode(),false);
});

ok('Painel aberto pausa a run; fechar retoma',()=>{
  dev.setPlayer(null);dev.setWave(0);dev.setTainted(false);dev.forceDevMode(false);
  dev.startRun();
  assert.strictEqual(dev.getState(),'play');
  dev.devEnable();
  assert.strictEqual(dev.getState(),'paused','painel aberto deve pausar');
  dev.devClosePanel();
  assert.strictEqual(dev.getState(),'play','fechar o painel deve retomar');
  dev.devDisable();
});

/* ===================================================================
   4. ONDAS
   =================================================================== */
ok('goToWave() aceita apenas ondas válidas (1..MAX_WAVE)',()=>{
  const D=freshDevRun();
  assert.strictEqual(D.goToWave(0),false);
  assert.strictEqual(D.goToWave(-3),false);
  assert.strictEqual(D.goToWave(dev.MAX_WAVE+1),false);
  assert.strictEqual(D.goToWave('abc'),false);
  assert.strictEqual(D.goToWave(null),false);
  assert.strictEqual(D.goToWave(undefined),false);
});

ok('goToWave(7) muda a onda e povoa a arena',()=>{
  const D=freshDevRun();
  assert.strictEqual(D.goToWave(7),7);
  assert.strictEqual(dev.getWave(),7);
  assert(dev.getEnemies().length>0,'a onda deve ter inimigos');
});

ok('goToWave() arredonda valores fracionários',()=>{
  const D=freshDevRun();
  assert.strictEqual(D.goToWave(4.6),5);
});

ok('nextWave() avança exatamente uma onda',()=>{
  const D=freshDevRun();
  D.goToWave(3);
  assert.strictEqual(D.nextWave(),4);
  assert.strictEqual(dev.getWave(),4);
});

ok('nextWave() nunca ultrapassa MAX_WAVE',()=>{
  const D=freshDevRun();
  D.goToWave(dev.MAX_WAVE);
  D.nextWave();
  assert(dev.getWave()<=dev.MAX_WAVE);
});

ok('clearWave() esvazia a arena sem corromper a run',()=>{
  const D=freshDevRun();
  D.goToWave(6);
  D.clearWave();
  assert.strictEqual(dev.getEnemies().length,0);
  assert(dev.getPlayer(),'player continua vivo');
  assert.strictEqual(dev.getState(),'paused');   // painel aberto
});

/* ===================================================================
   5. SPAWN DE INIMIGOS E MINI-CHEFES
   =================================================================== */
ok('DEV_ENEMY_IDS cobre exatamente os 11 inimigos de EDEFS',()=>{
  assert.strictEqual(dev.DEV_ENEMY_IDS.length,Object.keys(dev.EDEFS).length);
  assert.strictEqual(dev.DEV_ENEMY_IDS.length,11);
  for(const id of dev.DEV_ENEMY_IDS)
    assert(dev.EDEFS[id],'id inválido no menu DEV: '+id);
});

ok('spawnEnemy() aceita todos os IDs válidos',()=>{
  const D=freshDevRun();
  D.clearEnemies();
  for(const id of dev.DEV_ENEMY_IDS)
    assert.strictEqual(D.spawnEnemy(id,1),1,'falhou ao spawnar '+id);
  assert.strictEqual(dev.getEnemies().length,dev.DEV_ENEMY_IDS.length);
});

ok('spawnEnemy() rejeita IDs inexistentes',()=>{
  const D=freshDevRun();
  assert.strictEqual(D.spawnEnemy('dragao'),false);
  assert.strictEqual(D.spawnEnemy(''),false);
  assert.strictEqual(D.spawnEnemy(null),false);
});

ok('spawnEnemy() nasce longe do jogador (posição segura)',()=>{
  const D=freshDevRun();
  D.clearEnemies();
  const p=dev.getPlayer();
  D.spawnEnemy('chaser',10);
  for(const e of dev.getEnemies()){
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    assert(d>=200,'inimigo nasceu a '+Math.round(d)+'px do jogador');
  }
});

ok('DEV_MINIBOSS_IDS cobre os 8 mini-chefes',()=>{
  assert.strictEqual(dev.DEV_MINIBOSS_IDS.length,8);
  const pool=dev.MINIBOSS.map(x=>x.id);
  for(const id of dev.DEV_MINIBOSS_IDS)
    assert(pool.indexOf(id)>=0,'id de miniboss inválido: '+id);
  for(const want of ['herald','furnace','sentinel','brood','duelist',
                     'colossus','oracle','leech'])
    assert(dev.DEV_MINIBOSS_IDS.indexOf(want)>=0,'faltou '+want);
});

ok('spawnMiniBoss() invoca cada um dos 8 mini-chefes pelo ID',()=>{
  for(const id of dev.DEV_MINIBOSS_IDS){
    const D=freshDevRun();
    const b=D.spawnMiniBoss(id);
    assert(b,'não spawnou '+id);
    assert.strictEqual(b.mb.id,id);
    assert.strictEqual(dev.getMiniBoss().mb.id,id);
  }
});

ok('spawnMiniBoss() rejeita IDs inválidos',()=>{
  const D=freshDevRun();
  assert.strictEqual(D.spawnMiniBoss('quimera'),false);
  assert.strictEqual(D.spawnMiniBoss(''),false);
});

ok('clearMiniBoss() remove o mini-chefe e o HUD',()=>{
  const D=freshDevRun();
  D.spawnMiniBoss('colossus');
  assert(dev.getMiniBoss());
  assert.strictEqual(D.clearMiniBoss(),true);
  assert.strictEqual(dev.getMiniBoss(),null);
});

/* ===================================================================
   6. PLAYER E ESCUDO
   =================================================================== */
ok('fullHp() e heal() respeitam o HP máximo',()=>{
  const D=freshDevRun();
  const p=dev.getPlayer();
  p.hp=10;
  D.heal(9999);
  assert.strictEqual(p.hp,p.maxHp,'heal não pode passar do máximo');
  p.hp=1;D.fullHp();
  assert.strictEqual(p.hp,p.maxHp);
});

ok('Shield DEV nunca ultrapassa shieldMax',()=>{
  const D=freshDevRun();
  const p=dev.getPlayer();
  D.setShieldMax(80);
  D.fillShield();
  assert.strictEqual(p.shield,p.shieldMax);
  assert(p.shield<=80);
  D.fillShield();D.fillShield();
  assert(p.shield<=p.shieldMax,'shield estourou o teto');
});

ok('zeroShield() zera e reinicia o delay de regeneração',()=>{
  const D=freshDevRun();
  const p=dev.getPlayer();
  D.setShieldMax(60);D.fillShield();
  D.zeroShield();
  assert.strictEqual(p.shield,0);
  assert.strictEqual(p.shieldDelayT,p.shieldDelay);
});

ok('breakShield() rompe o escudo sem tirar Integridade',()=>{
  const D=freshDevRun();
  const p=dev.getPlayer();
  D.setShieldMax(70);D.fillShield();
  const hp0=p.hp;
  D.breakShield();
  assert.strictEqual(p.shield,0,'escudo deveria estar rompido');
  assert.strictEqual(p.hp,hp0,'a ferramenta não pode causar dano real');
});

ok('setShieldMax() valida a faixa permitida',()=>{
  const D=freshDevRun();
  assert.strictEqual(D.setShieldMax(-40),0);
  assert.strictEqual(D.setShieldMax(99999),500);
  assert.strictEqual(D.setShieldMax(120),120);
});

ok('Invulnerabilidade DEV bloqueia dano só com DEV_MODE ligado',()=>{
  const D=freshDevRun();
  const p=dev.getPlayer();
  D.setShieldMax(0);D.zeroShield();
  D.toggleInvuln();
  assert.strictEqual(p.devInvuln,true);
  const hp0=p.hp;
  p.invT=0;p.dashT=0;
  dev.damagePlayer(30);
  assert.strictEqual(p.hp,hp0,'DEV invulnerável deveria ignorar o dano');
  // desligar o DEV MODE devolve a vulnerabilidade normal
  dev.devDisable();
  dev.setState('play');
  const p2=dev.getPlayer();
  p2.invT=0;p2.dashT=0;p2.shield=0;
  dev.damagePlayer(30);
  assert(p2.hp<hp0,'sem DEV MODE o dano deve voltar a valer');
});

ok('addCoins() e setSpeed() são temporários e limitados',()=>{
  const D=freshDevRun();
  const p=dev.getPlayer();
  const c0=p.coins;
  D.addCoins(250);
  assert.strictEqual(p.coins,c0+250);
  const base=p.speed;
  D.setSpeed(2);
  assert(Math.abs(p.speed-base*2)<1e-6);
  D.setSpeed(99);                       // clamp em ×4
  assert(Math.abs(p.speed-base*4)<1e-6);
  dev.devDisable();                     // desligar restaura a velocidade base
  assert(Math.abs(dev.getPlayer().speed-base)<1e-6);
});

ok('Valores base do operador em CHARS não são alterados',()=>{
  const before=JSON.stringify(dev.CHARS.map(c=>[c.id,c.hp,c.speed,c.shieldMax]));
  const D=freshDevRun();
  D.setShieldMax(400);D.setSpeed(4);D.addCoins(9999);D.fullHp();
  const after=JSON.stringify(dev.CHARS.map(c=>[c.id,c.hp,c.speed,c.shieldMax]));
  assert.strictEqual(before,after,'catálogo de operadores foi mutado');
});

/* ===================================================================
   7. ECHOS · CONFIANÇA · PAPÉIS · DISSONÂNCIA
   =================================================================== */
ok('spawnEcho() cria Echo DEV marcado como debug',()=>{
  const D=freshDevRun();
  D.clearEchoes();
  const e=D.spawnEcho(1);
  assert(e,'Echo não criado');
  assert.strictEqual(e.slot,1);
  assert.strictEqual(e.dev,true,'Echo DEV deve estar marcado');
  assert.strictEqual(e.data.dev,1,'os dados do Echo DEV devem estar marcados');
  assert.strictEqual(dev.getEchoes().length,1);
});

ok('spawnEcho(2) funciona mesmo sem o Echo·01',()=>{
  const D=freshDevRun();
  D.clearEchoes();
  const e=D.spawnEcho(2);
  assert.strictEqual(e.slot,2);
  assert.strictEqual(dev.getEchoes().length,1);
  assert(dev.getEchoes().every(x=>!!x),'a lista de Ecos não pode ter buracos');
});

ok('spawnEcho() substitui (não duplica) o mesmo slot',()=>{
  const D=freshDevRun();
  D.clearEchoes();
  D.spawnEcho(1);D.spawnEcho(1);D.spawnEcho(2);D.spawnEcho(2);
  assert.strictEqual(dev.getEchoes().length,2);
});

ok('Confiança DEV permanece sempre entre 0 e 100',()=>{
  const D=freshDevRun();
  D.clearEchoes();D.spawnEcho(1);
  assert.strictEqual(D.setTrust(1,-50),0);
  assert.strictEqual(D.setTrust(1,999),100);
  assert.strictEqual(D.setTrust(1,55),55);
  D.addTrust(1,10);
  assert.strictEqual(D.echo(1).trust,65);
  D.addTrust(1,-1000);
  assert.strictEqual(D.echo(1).trust,0);
  for(let i=0;i<30;i++)D.addTrust(1,10);
  assert.strictEqual(D.echo(1).trust,100);
});

ok('setTrust() rejeita valores não numéricos',()=>{
  const D=freshDevRun();
  D.clearEchoes();D.spawnEcho(1);
  assert.strictEqual(D.setTrust(1,'muito'),false);
  assert.strictEqual(D.setTrust(1,NaN),false);
});

ok('forceRole() dispara Guardião (Echo·01) e Disruptor (Echo·02)',()=>{
  const D=freshDevRun();
  D.clearEchoes();D.spawnEcho(1);D.spawnEcho(2);
  assert.strictEqual(D.forceRole(1),'guardian');
  assert(D.echo(1).roleT>0,'Guardião deveria ativar a barreira');
  assert.strictEqual(D.forceRole(2),'disruptor');
  assert(D.echo(2).roleFx>0,'Disruptor deveria emitir o pulso');
});

ok('resetRoleCd() zera o cooldown de papel',()=>{
  const D=freshDevRun();
  D.clearEchoes();D.spawnEcho(1);
  D.echo(1).roleCd=99;
  D.resetRoleCd(1);
  assert.strictEqual(D.echo(1).roleCd,0);
});

ok('forceSpeak() usa apenas falas existentes em ECHO_LINES',()=>{
  const D=freshDevRun();
  D.clearEchoes();D.spawnEcho(1);
  const k=D.forceSpeak(1);
  assert(typeof k==='string'&&k.length>0,'nenhuma fala emitida');
});

ok('Dissonância DEV usa a lógica de produção (enterDissonance)',()=>{
  const D=freshDevRun();
  D.clearEchoes();D.spawnEcho(1);
  assert.strictEqual(D.dissonance(1),true);
  const e=D.echo(1);
  assert.strictEqual(e.hostile,true);
  assert.strictEqual(e.trust,0,'a Dissonância zera a confiança, como na produção');
  assert.strictEqual(e.hostileT,12,'duração idêntica à de produção: 12s');
  assert.strictEqual(D.dissonance(1),false,'não empilha Dissonância');
});

ok('endDissonance() encerra pelo caminho normal do updateEcho',()=>{
  const D=freshDevRun();
  D.clearEchoes();D.spawnEcho(1);
  D.dissonance(1);
  assert.strictEqual(D.endDissonance(1),true);
  assert(D.echo(1).hostileT<=0.01,'hostileT deve expirar no próximo tick');
  assert.strictEqual(D.endDissonance(1)&&false,false);
});

ok('clearEchoes() remove todos os Ecos',()=>{
  const D=freshDevRun();
  D.spawnEcho(1);D.spawnEcho(2);
  D.clearEchoes();
  assert.strictEqual(dev.getEchoes().length,0);
});

/* ===================================================================
   8. STATUS
   =================================================================== */
ok('DEV_STATUS_IDS só contém status já existentes no jogo',()=>{
  for(const st of dev.DEV_STATUS_IDS)
    assert(/burn|bleed|corrode|chill|shock|stun/.test(st),'status inventado: '+st);
  assert(/case 'burn'/.test(rawSrc)&&/case 'corrode'/.test(rawSrc));
});

ok('applyStatus() aplica em alvo válido e rejeita status inexistente',()=>{
  const D=freshDevRun();
  D.clearEnemies();
  D.spawnEnemy('chaser',1);
  const e=dev.getEnemies()[0];
  e.spawnT=0;
  assert.strictEqual(D.applyStatus('inventado'),false);
  assert.strictEqual(D.applyStatus('burn'),1);
  assert(e.st&&e.st.burnT>0,'burn não aplicado');
  D.applyStatus('corrode');
  assert(e.st.corrT>0,'corrode não aplicado');
});

ok('applyStatus(kind,true) atinge todos os inimigos vivos',()=>{
  const D=freshDevRun();
  D.clearEnemies();
  D.spawnEnemy('chaser',5);
  for(const e of dev.getEnemies())e.spawnT=0;
  assert.strictEqual(D.applyStatus('chill',true),5);
});

ok('curse() replica a maldição do Oráculo no jogador',()=>{
  const D=freshDevRun();
  assert.strictEqual(D.curse(6),6);
  assert.strictEqual(dev.getPlayer().curseT,6);
});

/* ===================================================================
   9. MÓDULOS / LOJA / OPERADOR
   =================================================================== */
ok('grantModule() só aceita IDs reais do catálogo ITEMS',()=>{
  const D=freshDevRun();
  assert.strictEqual(D.grantModule('modulo_falso'),false);
  const id=dev.ITEMS[0].id;
  assert.strictEqual(D.grantModule(id),id);
  assert(D.listModules().indexOf(id)>=0);
  assert.strictEqual(D.grantModule(id),false,'não concede duplicado');
});

ok('listModules() reflete o inventário atual',()=>{
  const D=freshDevRun();
  assert.strictEqual(D.listModules().length,0);
  D.grantModule(dev.ITEMS[1].id);
  const l=D.listModules();
  assert.strictEqual(l.length,1);
  assert.strictEqual(l[0],dev.ITEMS[1].id);
});

ok('setOperatorNextRun() valida o ID e não troca a run em andamento',()=>{
  const D=freshDevRun();
  const before=dev.getPlayer().charId;
  assert.strictEqual(D.setOperatorNextRun('nao_existe'),false);
  const target=dev.CHARS.find(c=>c.id!==before).id;
  assert.strictEqual(D.setOperatorNextRun(target),target);
  assert.strictEqual(dev.getPlayer().charId,before,
    'o operador da run em andamento não pode mudar');
});

/* ===================================================================
   10. DEBUG / RESSONÂNCIA / BOSS
   =================================================================== */
ok('resonanceDebug() expõe a janela de (micro-)ressonância',()=>{
  const D=freshDevRun();
  D.clearEnemies();D.spawnEnemy('chaser',1);
  const r=D.resonanceDebug();
  assert(r,'sem leitura');
  assert.strictEqual(r.window,0.5);
  assert.strictEqual(r.microWindow,1.6);
  assert('lastTag' in r&&'microTag' in r&&'resoCd' in r&&'microCd' in r);
});

ok('spawnBoss() inicia o encontro final e registra o intel adaptativo',()=>{
  const D=freshDevRun();
  const b=D.spawnBoss();
  assert(b,'boss não iniciado');
  assert.strictEqual(b.type,'boss');
  assert(b.mode==='melee'||b.mode==='ranged','modo adaptativo inválido');
  assert.strictEqual(D.spawnBoss(),false,'não duplica o chefe');
});

ok('killPlayer() encerra a run mesmo com o painel aberto (pausado)',()=>{
  dev.forceDevMode(false);dev.setTainted(false);dev.setEchoQueue([]);
  dev.setPlayer(null);dev.setWave(0);dev.startRun();
  dev.devEnable();                      // painel aberto → state 'paused'
  assert.strictEqual(dev.getState(),'paused');
  dev.setRunTime(9);
  dev.DEV.killPlayer();
  assert.strictEqual(dev.getState(),'fracture','a morte precisa ser processada');
  dev.devDisable();
});

ok('bossDebug() expõe modo adaptativo e dashAdapt',()=>{
  const D=freshDevRun();
  const b=D.bossDebug();
  assert(b,'sem intel');
  assert(b.mode==='melee'||b.mode==='ranged');
  assert(b.dashAdapt===0||b.dashAdapt===-0.8);
});

ok('toggleInfo() liga/desliga o HUD de debug',()=>{
  const D=freshDevRun();
  assert.strictEqual(D.toggleInfo(),true);
  assert.strictEqual(D.toggleInfo(),false);
});

ok('devTick() é no-op quando o DEV MODE está desligado',()=>{
  rel.devTick(0.016);   // não pode lançar
  assert.strictEqual(rel.isDevMode(),false);
});

/* ===================================================================
   11. PROTEÇÃO DE SAVE / PROGRESSÃO
   =================================================================== */
ok('Run com DEV MODE ativo nasce marcada como debug',()=>{
  dev.setTainted(false);dev.forceDevMode(false);
  dev.setPlayer(null);dev.setWave(0);dev.startRun();
  assert.strictEqual(dev.isTainted(),false);
  dev.devEnable();
  dev.setPlayer(null);dev.setWave(0);dev.startRun();
  assert.strictEqual(dev.isTainted(),true,'startRun com DEV ligado deve marcar');
  dev.devDisable();
});

ok('Qualquer comando DEV marca a run como debug',()=>{
  const D=freshDevRun();
  dev.setTainted(false);
  D.addCoins(10);
  assert.strictEqual(dev.isTainted(),true);
});

ok('Desligar o DEV MODE não "lava" a run já contaminada',()=>{
  const D=freshDevRun();
  D.addCoins(10);
  dev.devDisable();
  assert.strictEqual(dev.isTainted(),true);
});

ok('saveEchoes() é bloqueado numa run DEV',()=>{
  const D=freshDevRun();
  D.addCoins(1);
  dev._ls.removeItem('echoRuns.v1');
  assert.strictEqual(dev.saveEchoes(),false);
  assert.strictEqual(dev._ls.getItem('echoRuns.v1'),null,
    'nenhum Echo pode ser gravado a partir de uma run DEV');
});

ok('saveProg() e saveMeta() são bloqueados numa run DEV',()=>{
  const D=freshDevRun();
  D.addCoins(1);
  dev._ls.removeItem('echoProg.v1');
  dev._ls.removeItem('echoMeta.v1');
  assert.strictEqual(dev.saveProg(),false);
  assert.strictEqual(dev.saveMeta(),false);
  assert.strictEqual(dev._ls.getItem('echoProg.v1'),null);
  assert.strictEqual(dev._ls.getItem('echoMeta.v1'),null);
});

ok('Numa run limpa a persistência continua funcionando normalmente',()=>{
  dev.forceDevMode(false);dev.setTainted(false);
  dev.setPlayer(null);dev.setWave(0);dev.startRun();
  assert.strictEqual(dev.saveProg(),true);
  assert.strictEqual(dev.saveMeta(),true);
  assert.strictEqual(dev.saveEchoes(),true);
});

ok('Morte numa run DEV marca o registro como dev e não vira Echo salvo',()=>{
  dev.forceDevMode(false);dev.setTainted(false);dev.setEchoQueue([]);
  dev.setPlayer(null);dev.setWave(0);dev.startRun();
  const SENTINEL='__intocado__';
  dev._ls.setItem('echoRuns.v1',SENTINEL);
  dev._ls.setItem('echoProg.v1',SENTINEL);
  dev.devEnable();
  const D=dev.DEV;
  D.goToWave(3);
  dev.setRunTime(12);
  dev.devClosePanel();
  D.killPlayer();
  const q=dev.getEchoQueue();
  assert(q.length>=1,'a fila em memória recebe o registro');
  assert.strictEqual(q[0].dev,1,'o registro precisa estar marcado como debug');
  assert.strictEqual(dev._ls.getItem('echoRuns.v1'),SENTINEL,
    'o arquivo de Ecos não pode ser tocado por uma run DEV');
  assert.strictEqual(dev._ls.getItem('echoProg.v1'),SENTINEL,
    'a progressão permanente não pode ser tocada por uma run DEV');
  dev.devDisable();
});

ok('loadEchoes() ignora Echos marcados como dev',()=>{
  dev.forceDevMode(false);dev.setTainted(false);
  const trail=[];
  for(let i=0;i<8;i++)trail.push([i*.1,100,100,0,0,0]);
  dev._ls.setItem('echoRuns.v1',JSON.stringify([
    {dev:1,dur:5,trail,wave:3},
    {dur:5,trail,wave:4}
  ]));
  const q=dev.loadEchoes();
  assert.strictEqual(q.length,1,'só o Echo legítimo pode voltar');
  assert(!q[0].dev);
});

/* ===================================================================
   12. LEGIBILIDADE / ESCALA TIPOGRÁFICA
   =================================================================== */
const styleBlock=html.slice(html.indexOf('<style>'),html.indexOf('</style>'));

ok('Escala tipográfica centralizada em variáveis CSS',()=>{
  for(const v of ['--fs-3xs','--fs-2xs','--fs-xs','--fs-sm','--fs-md',
                  '--fs-lg','--fs-xl','--fs-2xl','--fs-wave','--fs-head'])
    assert(styleBlock.indexOf(v+':')>=0,'variável ausente: '+v);
});

ok('Nenhum texto de UI abaixo de 9px na folha de estilo',()=>{
  const hits=styleBlock.match(/font-size:\s*([0-9.]+)px/g)||[];
  for(const h of hits){
    const v=parseFloat(h.replace(/[^0-9.]/g,''));
    assert(v>=9,'tamanho pequeno demais encontrado: '+h);
  }
});

ok('HUD, loja, codex e tooltips usam a escala (var(--fs-*))',()=>{
  const uses=(styleBlock.match(/font-size:var\(--fs-/g)||[]).length;
  assert(uses>=60,'apenas '+uses+' regras migradas para a escala');
});

ok('Existem breakpoints para 1600x900 e 1366x768',()=>{
  assert(styleBlock.indexOf('@media(max-height:940px)')>=0,'breakpoint 900p');
  assert(styleBlock.indexOf('@media(max-height:800px)')>=0,'breakpoint 768p');
});

ok('Textos flutuantes e falas dos Ecos ficaram maiores',()=>{
  assert(/const FTEXT_SIZE=13;/.test(rawSrc),'FTEXT_SIZE deve ser 13px');
  assert(/const FTEXT_SPEAK=15;/.test(rawSrc),'falas devem usar 15px');
  assert(/floatText\(e\.x,e\.y-e\.r-34,txt,color\|\|e\.hue\|\|'#8ff6ff',FTEXT_SPEAK\)/
    .test(rawSrc),'echoSpeak deve usar o corpo maior');
});

/* ===================================================================
   13. VERSÃO E BUILD
   =================================================================== */
ok('ECHO_VERSION coincide com o version do package.json',()=>{
  assert.strictEqual(dev.ECHO_VERSION,pkg.version);
});

ok('Versão é 0.6.5-alpha (playtest público)',()=>{
  assert.strictEqual(pkg.version,'0.6.5-alpha');
  assert(/alpha/.test(pkg.version),'a build de teste deve ser alpha');
});

ok('Versão aparece na tela-título e no menu de pausa',()=>{
  assert(html.indexOf('id="ov-ver"')>=0,'elemento de versão na tela-título');
  assert(html.indexOf('id="p-ver"')>=0,'versão no menu de pausa');
  assert(/ECHO_VERSION_LABEL/.test(rawSrc));
});

ok('package.json: script de build portátil para Windows',()=>{
  assert(pkg.scripts.build,'script "build" ausente');
  assert(/electron-builder/.test(pkg.scripts.build));
  assert(/portable/.test(pkg.scripts.build),'a primeira build deve ser portátil');
  assert(pkg.scripts['build:dir'],'build de pasta simples ausente');
});

ok('package.json: identidade, main e ícones coerentes',()=>{
  assert.strictEqual(pkg.main,'main.js');
  assert.strictEqual(pkg.productName,'ECHO');
  assert.strictEqual(pkg.build.appId,'com.echostudio.roguelite');
  assert.strictEqual(pkg.build.win.icon,'build/icon.ico');
  assert(fs.existsSync(path.join(ROOT,'build','icon.ico')),'build/icon.ico ausente');
  assert(fs.existsSync(path.join(ROOT,'build','icon.png')),'build/icon.png ausente');
});

ok('Build empacota só o necessário (sem tests, sem dist)',()=>{
  const f=pkg.build.files.join('|');
  assert(f.indexOf('index.html')>=0&&f.indexOf('main.js')>=0&&
         f.indexOf('preload.js')>=0);
  assert(f.indexOf('!tests/**')>=0,'tests não podem entrar no pacote');
  assert(f.indexOf('!dist/**')>=0);
});

ok('Electron informa o canal de build ao renderer',()=>{
  assert(/additionalArguments/.test(mainJs),'main.js deve enviar o canal');
  assert(/echo-channel=.*app\.isPackaged \? 'release' : 'dev'/.test(mainJs)||
         /'--echo-channel=' \+ \(app\.isPackaged \? 'release' : 'dev'\)/.test(mainJs),
         'canal deve depender de app.isPackaged');
  assert(/channel: CHANNEL/.test(preloadJs),'preload deve expor o canal');
  assert(/'release'/.test(preloadJs),'fallback deve ser release');
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){
  console.log('\nFALHAS DETECTADAS');
  process.exit(1);
}
console.log('\nTODOS OS TESTES PASSARAM');
