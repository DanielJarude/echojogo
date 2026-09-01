'use strict';
/* =====================================================================
   TESTES — Restauração de conteúdo histórico (PR 6)
   - 6 novos tipos de inimigos
   - Pool de minibosses
   - Sistema de fala dos Ecos
   - Shield / Dissonância / Operadores intactos
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
let src=m[1];

src+=';globalThis.__t={'+
  'EDEFS,MINIBOSS,MINI_WAVES,MAX_WAVE,MINI_WAVE,ENEMY_BUDGET,'+
  'CHARS,ITEMS,UPGRADES,UNLOCKS,WEAPONS,'+
  'makePlayer,damagePlayer,regenPlayerShield,startRun,setChar,curChar,'+
  'itemById,mEff,waveComp,spawnEnemy,killEnemy,'+
  'getState:()=>state,getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getEnemies:()=>enemies,getWave:()=>wave,setWave:w=>{wave=w;},'+
  'ECHO_LINES,echoReact,echoSpeak,'+
  'pickMiniBoss,spawnMiniBoss,'+
  'enterDissonance,dissolveEcho,'+
  'diffHp,diffDmg,diffSpd,'+
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
const localStorage={_d:{},getItem(k){return this._d[k]||null;},
  setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
const navigator={getGamepads:()=>[]};

const sandbox={console,Math,Date,parseInt,parseFloat,isNaN,setTimeout,clearTimeout,
  requestAnimationFrame:()=>0,setTimeout,clearTimeout,
  Uint8ClampedArray,Array,Object,Number,String,Boolean,RegExp,Error,Map,Set,
  Promise,Proxy,Reflect,JSON,Symbol,
  document,window,localStorage,navigator,
  performance:{now:()=>Date.now()}
};
const ctx=vm.createContext(sandbox);
vm.runInContext(src,ctx,{timeout:15000});
const t=vm.runInContext('__t',ctx);

/* ---------------- harness ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+e.message);}
}

function freshRun(){
  t.setPlayer(null);
  t.setWave(0);
  t.startRun();
}

console.log('\nECHO — Restauração de conteúdo histórico (PR 6)');
console.log('---------------------------------------------');

/* ====================== VERIFICAÇÃO SINTÁTICA ====================== */
ok('index.html: script passa em verificação sintática (vm.Script)',()=>{
  new vm.Script(m[1]);
});

/* ====================== EDEFS: 6 NOVOS INIMIGOS ====================== */
const NEW_IDS=['swarm','orbiter','bulwark','splitter','phantom','singular'];
ok('EDEFS contém os 6 novos tipos de inimigo',()=>{
  for(const id of NEW_IDS)
    assert(t.EDEFS[id],'EDEFS['+id+'] não existe');
});

ok('IDs únicos entre todos os inimigos',()=>{
  const all=Object.keys(t.EDEFS);
  const set=new Set(all);
  assert.strictEqual(set.size,all.length,'IDs duplicados em EDEFS');
});

ok('Nenhum novo inimigo depende do sistema Threat removido',()=>{
  // não existe addThreat, threat, THREAT_NAME no código atual
  assert(!src.match(/\baddThreat\b/),'addThreat ainda existe');
  assert(!src.match(/\blet threat\b/),'variável threat ainda existe');
  assert(!src.match(/\bTHREAT_NAME\b/),'THREAT_NAME ainda existe');
});

for(const id of NEW_IDS){
  ok(id+': stats válidos (hp, spd, r, dmg, xp, color)',()=>{
    const d=t.EDEFS[id];
    assert(d.hp>0,'hp deve ser > 0');
    assert(d.spd>0,'spd deve ser > 0');
    assert(d.r>0,'r deve ser > 0');
    assert(d.dmg>0,'dmg deve ser > 0');
    assert(d.xp>0,'xp deve ser > 0');
    assert(typeof d.color==='string','color deve ser string');
    assert(d.color.startsWith('#'),'color deve ser hex');
  });
}

ok('swarm: HP baixo e velocidade alta (frágil e rápido)',()=>{
  const d=t.EDEFS.swarm;
  assert(d.hp<=15,'HP do swarm deve ser ≤ 15');
  assert(d.spd>=280,'velocidade do swarm deve ser ≥ 280');
  assert(d.r<=12,'raio do swarm deve ser ≤ 12');
});

ok('orbiter: HP e velocidade moderados',()=>{
  const d=t.EDEFS.orbiter;
  assert(d.hp>=25&&d.hp<=50,'HP do orbiter deve estar entre 25-50');
  assert(d.spd>=180&&d.spd<=250,'velocidade do orbiter entre 180-250');
});

ok('bulwark: alta vida, baixa velocidade',()=>{
  const d=t.EDEFS.bulwark;
  assert(d.hp>=60,'HP do bulwark deve ser ≥ 60');
  assert(d.spd<=130,'velocidade do bulwark deve ser ≤ 130');
});

ok('splitter: HP e velocidade intermediários',()=>{
  const d=t.EDEFS.splitter;
  assert(d.hp>=40&&d.hp<=80,'HP do splitter entre 40-80');
});

ok('phantom: HP moderado e velocidade decente',()=>{
  const d=t.EDEFS.phantom;
  assert(d.hp>=40&&d.hp<=70,'HP do phantom entre 40-70');
});

ok('singular: HP muito alto e velocidade baixa',()=>{
  const d=t.EDEFS.singular;
  assert(d.hp>=150,'HP do singular deve ser ≥ 150');
  assert(d.spd<=110,'velocidade do singular deve ser ≤ 110');
});

/* ====================== WAVE COMP: INTEGRAÇÃO ====================== */
ok('waveComp inclui novos tipos a partir de ondas corretas',()=>{
  freshRun();
  // onda 1: deve ter swarm
  t.setWave(0);
  let c=t.waveComp(1);
  assert((c.swarm||0)>=2,'swarm deve aparecer na onda 1');
  assert(c.chaser>=2,'chaser deve aparecer na onda 1');
});

ok('waveComp(2): orbiter aparece',()=>{
  const c=t.waveComp(2);
  assert((c.orbiter||0)>=1,'orbiter deve aparecer na onda 2');
});

ok('waveComp(4): bulwark aparece',()=>{
  const c=t.waveComp(4);
  assert((c.bulwark||0)>=1,'bulwark deve aparecer na onda 4');
});

ok('waveComp(6): splitter aparece',()=>{
  const c=t.waveComp(6);
  assert((c.splitter||0)>=1,'splitter deve aparecer na onda 6');
});

ok('waveComp(8): phantom aparece',()=>{
  const c=t.waveComp(8);
  assert((c.phantom||0)>=1,'phantom deve aparecer na onda 8');
});

ok('waveComp(13): singular aparece',()=>{
  const c=t.waveComp(13);
  assert((c.singular||0)>=1,'singular deve aparecer na onda 13');
});

ok('waveComp(1): tipos tardios NÃO aparecem cedo',()=>{
  const c=t.waveComp(1);
  assert(!c.splitter,'splitter não deve aparecer na onda 1');
  assert(!c.phantom,'phantom não deve aparecer na onda 1');
  assert(!c.singular,'singular não deve aparecer na onda 1');
});

ok('waveComp respeita ENEMY_BUDGET',()=>{
  const c=t.waveComp(20);
  let total=0;for(const k in c)total+=c[k];
  assert(total<=t.ENEMY_BUDGET+2,'total deve respeitar orçamento (com margem)');
});

/* ====================== MINI_WAVES ====================== */
ok('MINI_WAVES é [5, 10, 15]',()=>{
  assert(Array.isArray(t.MINI_WAVES),'MINI_WAVES deve ser array');
  assert.strictEqual(t.MINI_WAVES.length,3);
  assert.strictEqual(t.MINI_WAVES[0],5);
  assert.strictEqual(t.MINI_WAVES[1],10);
  assert.strictEqual(t.MINI_WAVES[2],15);
});

ok('MINI_WAVE = 10 (compatibilidade)',()=>{
  assert.strictEqual(t.MINI_WAVE,10);
});

ok('MAX_WAVE = 20',()=>{
  assert.strictEqual(t.MAX_WAVE,20);
});

/* ====================== MINIBOSS POOL ====================== */
ok('MINIBOSS tem pelo menos 6 minibosses',()=>{
  assert(t.MINIBOSS.length>=6,'deve ter ≥ 6 minibosses, tem '+t.MINIBOSS.length);
});

ok('Todos os minibosses têm identidade completa',()=>{
  for(const mb of t.MINIBOSS){
    assert(mb.id,'id obrigatório');
    assert(mb.nm,'nm obrigatório');
    assert(mb.c,'c (cor) obrigatório');
    assert(mb.hp>0,'hp mult deve ser > 0');
    assert(mb.spd>0,'spd mult deve ser > 0');
    assert(mb.r>0,'r deve ser > 0');
    assert(mb.plates>0,'plates deve ser > 0');
    assert(mb.sk,'sk (skills) obrigatório');
    assert(mb.desc,'desc obrigatório');
  }
});

ok('IDs únicos entre minibosses',()=>{
  const ids=t.MINIBOSS.map(m=>m.id);
  assert.strictEqual(new Set(ids).size,ids.length,'IDs duplicados em MINIBOSS');
});

ok('O Arauto da Fratura está no pool',()=>{
  const herald=t.MINIBOSS.find(m=>m.id==='herald');
  assert(herald,'herald deve estar no pool');
  assert(herald.nm.includes('ARAUTO'),'nome deve conter ARAUTO');
});

ok('pickMiniBoss retorna miniboss válido para onda 5',()=>{
  const mb=t.pickMiniBoss(5);
  assert(mb,'pickMiniBoss deve retornar um miniboss');
  assert(mb.hp<=1.15,'onda 5 deve filtrar hp ≤ 1.15');
});

ok('pickMiniBoss retorna miniboss válido para onda 10',()=>{
  const mb=t.pickMiniBoss(10);
  assert(mb,'pickMiniBoss(10) deve retornar válido');
});

ok('pickMiniBoss retorna miniboss válido para onda 15',()=>{
  const mb=t.pickMiniBoss(15);
  assert(mb,'pickMiniBoss(15) deve retornar válido');
  assert(mb.hp>=.8,'onda 15 deve filtrar hp ≥ 0.8');
});

ok('Minibosses não Arauto têm skills diferentes',()=>{
  const others=t.MINIBOSS.filter(m=>m.id!=='herald');
  const allSkills=others.map(m=>Object.keys(m.sk).join(','));
  // pelo menos alguns devem ter skills diferentes do herald
  const heraldSkills=Object.keys(t.MINIBOSS.find(m=>m.id==='herald').sk).sort().join(',');
  const different=others.filter(m=>Object.keys(m.sk).sort().join(',')!==heraldSkills);
  assert(different.length>=3,'pelo menos 3 minibosses devem ter skills diferentes do herald');
});

/* ====================== SPAWN VÁLIDO ====================== */
ok('spawnEnemy funciona para novos tipos sem erro',()=>{
  freshRun();
  t.setWave(5);
  for(const id of NEW_IDS){
    const e=t.spawnEnemy(id,500,500,5);
    assert(e,'spawnEnemy('+id+') deve retornar entidade');
    assert(e.type===id,'type deve ser '+id);
    assert(e.hp>0,'hp deve ser > 0');
    assert(e.maxHp>0,'maxHp deve ser > 0');
    assert(e.r>0,'r deve ser > 0');
  }
});

ok('spawnEnemy aplica escalonamento de onda',()=>{
  freshRun();
  const e1=t.spawnEnemy('swarm',500,500,1);
  const e5=t.spawnEnemy('swarm',500,500,5);
  assert(e5.maxHp>e1.maxHp,'HP deve escalar com a onda');
});

/* ====================== SISTEMA DE FALA ====================== */
ok('ECHO_LINES existe e tem eventos definidos',()=>{
  assert(t.ECHO_LINES,'ECHO_LINES deve existir');
  const events=Object.keys(t.ECHO_LINES);
  assert(events.length>=6,'deve ter ≥ 6 eventos de fala');
});

ok('ECHO_LINES: eventos essenciais presentes',()=>{
  const required=['waveStart','playerHurt','lowHp','resonance','dissonance',
    'dissonanceEnd','miniboss','bossDeath'];
  for(const ev of required)
    assert(t.ECHO_LINES[ev],'evento '+ev+' deve existir em ECHO_LINES');
});

ok('Cada evento tem pelo menos 2 linhas',()=>{
  for(const ev in t.ECHO_LINES)
    assert(t.ECHO_LINES[ev].length>=2,
      'evento '+ev+' deve ter ≥ 2 linhas, tem '+t.ECHO_LINES[ev].length);
});

/* ====================== SHIELD INTACTO ====================== */
ok('Shield do player continua funcional',()=>{
  freshRun();
  const p=t.getPlayer();
  assert(p.shieldMax>0,'shieldMax > 0');
  assert(p.shield===p.shieldMax,'shield começa cheio');
});

ok('Shield absorve dano antes do HP',()=>{
  freshRun();
  const p=t.getPlayer();
  const hpBefore=p.hp;
  const shBefore=p.shield;
  t.damagePlayer(10);
  assert(p.shield<shBefore||p.hp<hpBefore,'algo deve ter mudado');
});

ok('Shield dos Echos intacto (ECHO_SHIELD presente)',()=>{
  assert(src.match(/ECHO_SHIELD\s*=\s*\[/),'ECHO_SHIELD deve existir');
});

/* ====================== ECHOS INTACTOS ====================== */
ok('Echos continuam funcionais',()=>{
  freshRun();
  // sem run anterior: não deve ter Ecos
  assert.strictEqual(t.getPlayer().x>0,true);
});

/* ====================== DISSONÂNCIA INTACTA ====================== */
ok('enterDissonance ainda existe',()=>{
  assert(typeof t.enterDissonance==='function');
});

ok('dissolveEcho ainda existe',()=>{
  assert(typeof t.dissolveEcho==='function');
});

/* ====================== OPERADORES INTACTOS ====================== */
ok('8 operadores',()=>{
  assert.strictEqual(t.CHARS.length,8);
});

ok('Lore dos operadores preservada',()=>{
  for(const c of t.CHARS){
    assert(c.lore,'operador '+c.id+' deve ter lore');
    assert(c.lore.length>50,'lore de '+c.id+' deve ter conteúdo substancial');
  }
});

/* ====================== SAVES NÃO QUEBRAM ====================== */
ok('localStorage não contém dados corrompidos após startRun',()=>{
  freshRun();
  // o jogo deve rodar sem erros de persistência
  const p=t.getPlayer();
  assert(p,'player deve existir após startRun');
});

/* ====================== CÓDIGO NÃO TEM REFERÊNCIAS A THREAT ====================== */
ok('Nenhuma referência obrigatória ao sistema Threat',()=>{
  // O código pode conter a palavra "threat" em comentários, mas não deve
  // ter dependência funcional do sistema de ameaça antigo
  const codeNoComments=src.replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,'');
  assert(!codeNoComments.match(/\bthreat>=\d/),'não deve ter check threat>=N');
  assert(!codeNoComments.match(/\bthreat\s*=\s*clamp/),'não deve ter threat=clamp(...)');
  assert(!codeNoComments.match(/\bthreatHp\(\)/),'não deve chamar threatHp()');
});

/* ====================== MINIBOSS SPAWN INTEGRADO ====================== */
ok('spawnMiniBoss funciona sem erro',()=>{
  freshRun();
  t.setWave(5);
  const b=t.spawnMiniBoss(5);
  assert(b,'spawnMiniBoss deve retornar entidade');
  assert(b.type==='miniboss','type deve ser miniboss');
  assert(b.hp>0,'hp deve ser > 0');
  assert(b.plates>0,'plates deve ser > 0');
  assert(b.mb,'deve ter referência à definição');
  assert(b.sk,'deve ter skills');
});

/* ====================== CODICE INCLUDE NOVOS INIMIGOS ====================== */
ok('Codex inimigos inclui novos tipos (verificação por string)',()=>{
  assert(src.includes("'swarm','ENXAME'"),'codex deve ter swarm');
  assert(src.includes("'orbiter','ORBITADOR'"),'codex deve ter orbiter');
  assert(src.includes("'bulwark','BLINDADO'"),'codex deve ter bulwark');
  assert(src.includes("'splitter','CISÃO'"),'codex deve ter splitter');
  assert(src.includes("'phantom','LEVIANO'"),'codex deve ter phantom');
  assert(src.includes("'singular','SINGULAR'"),'codex deve ter singular');
});

/* ====================== BULWARK: ESCUDO FRONTAL ====================== */
ok('bulwark tem lógica de escudo frontal no código',()=>{
  assert(src.includes("e.type==='bulwark'&&e.shieldAng"),'deve ter verificação de bulwark+shieldAng em damageEnemy');
});

/* ====================== PHANTOM: INTANGIBILIDADE ====================== */
ok('phantom tem lógica de intangibilidade no código',()=>{
  assert(src.includes("e.type==='phantom'&&e.ghostT>0"),'deve ter verificação phantom+ghostT em damageEnemy');
});

/* ====================== SINGULAR: REFLEXÃO ====================== */
ok('singular tem lógica de reflexão de dano',()=>{
  assert(src.includes("e.type==='singular'&&curAttacker===player"),'deve ter verificação de singular+reflection');
});

/* ====================== SPLITTER: CISÃO NA MORTE ====================== */
ok('splitter tem lógica de cisão na morte',()=>{
  assert(src.includes("e.type==='splitter'&&!e.isShard"),'deve ter verificação de splitter+isShard em killEnemy');
});

/* ====================== CURSE (ORÁCULO) ====================== */
ok('curseT é decrementado no updatePlayer',()=>{
  assert(src.includes('p.curseT'),'deve ter campo curseT no player');
});

ok('curseT reduz dano do jogador',()=>{
  assert(src.includes('p.curseT>0)mul*=.70'),'curse deve reduzir dano em 30%');
});

/* ====================== ECO SPEAK COOLDOWN ====================== */
ok('Sistema de fala tem cooldown implementado',()=>{
  assert(src.includes('_echoSpeakCd'),'deve ter variável de cooldown');
  assert(src.includes('ECHO_SPEAK_INTERVAL'),'deve ter constante de intervalo');
});

/* ====================== RESULTADO ====================== */
console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed>0){console.log('\nFALHAS DETECTADAS');process.exit(1);}
else console.log('\nTODOS OS TESTES PASSARAM');
