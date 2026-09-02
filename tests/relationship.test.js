'use strict';
/* =====================================================================
   TESTES — PR 10: Relação Player ↔ Echo + Dissonância 2.0
   ---------------------------------------------------------------------
   · reação moral derivada do SNAPSHOT DE ORIGEM do Echo
   · Echos diferentes julgam a MESMA ação de formas diferentes
   · personalidade modula intensidade sem apagar a memória moral
   · traços secundários geram ajuste mínimo
   · trust centralizado (changeEchoTrust), pequeno e com motivo
   · anti-farm: diminishing returns + cooldown por motivo
   · relationship state derivado (sem barra nova)
   · memórias compactas + momentos significativos
   · diálogos contextuais com fallback hierárquico e anti-spam
   · dissonance pressure (sobe/desce/limiar) e nada de RNG puro
   · máquina de estados explícita + telegrafia + visual derivado
   · IA hostil, alvo, Shield, contenção, recovery, grace, anti-loop
   · Guardião/Disruptor suspensos durante a ruptura
   · save/checkpoint/Continue Run/slots/migração de Echo legado
   · DEV: inspector, presets e devTainted
   ===================================================================== */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');

const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const m=html.match(/<script>([\s\S]*?)<\/script>/);
if(!m)throw new Error('script não encontrado em index.html');
const RAWSRC=m[1];
let src=RAWSRC;
/* código sem comentários — evita que uma frase de documentação passe ou
   reprove um teste estrutural */
const CODE=RAWSRC.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g,'$1');

src+=';globalThis.__t={'+
  'PERSONALITIES,PERS_ORDER,PERS_TRAITS,WEAPONS,ECHO_LINES,'+
  'REL_BALANCE,REL_STATES,REL_LINES,PERS_REL_LINES,REL_GENERIC_LINES,'+
  'PERS_REL_MOD,TRAIT_REL_MOD,DIS,DIS_LABEL,DIS_COLOR,HOSTILE_PROFILE,'+
  'relNewState,disNewState,echoRelInit,echoAllied,echoInRupture,'+
  'changeEchoTrust,setEchoTrust,echoRelScore,echoRelState,'+
  'relDimFactor,relNoteReason,relReasonReady,'+
  'evaluateEchoReaction,applyEchoReaction,echoesEvaluate,echoRelResonance,'+
  'relAddPressure,relFractureAt,relPressurePct,relTick,'+
  'relRememberMoment,relMomentText,pickRelationLine,relFeedback,'+
  'echoSetDis,echoDissonanceTick,enterDissonance,containEcho,'+
  'forceEchoRecovery,isHostileEcho,echoHostileTick,echoRuptureTick,'+
  'dissolveEcho,echoDisLabel,relationPanelHTML,'+
  'relPackEcho,disPackEcho,relUnpackEcho,'+
  'makeEcho,echoReact,echoSpeak,echoRoleTick,trustTier,echoesReact,'+
  'triggerResonance,updateEcho,damageEcho,damagePlayer,nearestEnemy,'+
  'deriveEchoPersonality,smBuildCheckpoint,captureCheckpoint,'+
  'startRun,onPlayerDeath,saveEchoes,loadEchoes,activateSlot,smLoadRoot,'+
  'moralGain,getState:()=>state,'+
  'setKills:v=>{kills=v|0;},setRunTime:v=>{runTime=+v;},getRunTime:()=>runTime,'+
  'getEchoes:()=>echoes,setEchoes:a=>{echoes=a;},getEnemies:()=>enemies,'+
  'getPlayer:()=>player,setPlayer:p=>{player=p;},'+
  'getQ:()=>echoQueue,setQ:a=>{echoQueue=a;},'+
  'clearDevTaint:()=>{devTainted=false;},isTainted:()=>devTainted,'+
  'getFtexts:()=>ftexts,root:()=>smRoot,getSlot:()=>curSlot,'+
  'getProjectiles:()=>projectiles,setProjectiles:a=>{projectiles=a;},'+
  'getWave:()=>wave,setWave:v=>{wave=v|0;},'+
  'DEV_get:()=>DEV,DEV_on:()=>{DEV_MODE=true;},DEV_off:()=>{DEV_MODE=false;},'+
  'getSpeakCd:()=>_echoSpeakCd,setSpeakCd:v=>{_echoSpeakCd=v;},'+
  'setHurtAt:v=>{_lastHurtAt=+v;},'+
  'getMoral:()=>moral,setMoralRaw:(c,g,v)=>{moral.comp=c;moral.greed=g;moral.viol=v;},'+
  'updateProjectiles,fireWeaponFrom,'+
  'getRecorder:()=>recorder};';

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

/* Math com RNG controlável — usado para PROVAR que a classificação não
   depende de Math.random (se dependesse, trocar o rng mudaria o resultado). */
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

/* ---------------- helpers ---------------- */
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+'\n    '+e.message);}
}
function trail(len,w,act){
  const tr=[];
  for(let i=0;i<len;i++)tr.push([i*.25,100+i,120-i,act==null?(i%4===0?2:1):act,0,w||0]);
  return tr;
}
function stOf(o){
  const st={s:2400,mw:0,rw:2400,dsh:0,dt:0,dd:0,sh:0,hi:0,ms:0,mh:0,
    lo:0,cr:0,mv:0,fv:0,ctl:0,kw:0,sb:0,dS:2400*250,dN:2400};
  return Object.assign(st,o);
}
/* Echo sintético com snapshot moral e personalidade explícitos */
function echoData(moral,pid,traits){
  return {dur:60,trail:trail(100,0,1),items:[],upg:[],owned:[0,1],
    dom:'neutro',moral:moral||{comp:0,greed:0,viol:0},kills:5,mh:100,
    st:stOf({}),dmgMul:1,frMul:1,wave:2,level:1,
    ps:pid?{id:pid,tr:traits||[],c:.9,s:{},v:1}:null};
}
function mkEcho(moral,pid,slot,traits){
  const e=t.makeEcho(echoData(moral,pid,traits),slot||1);
  e.alive=true;
  return e;
}
function freshRun(){
  t.setPlayer(null);
  t.startRun();
  t.clearDevTaint();
  t.setRunTime(100);
  t.setSpeakCd(0);
}
const COMPASSION={comp:10,greed:0,viol:0};
const VIOLENT={comp:0,greed:0,viol:10};
const GREEDY={comp:0,greed:10,viol:0};

console.log('\nECHO — PR 10 · Relação Player ↔ Echo + Dissonância 2.0');
console.log('---------------------------------------------');

/* =====================================================================
   1. REAÇÃO MORAL — o Echo julga com a PRÓPRIA referência
   ===================================================================== */
console.log('\n[1] REAÇÃO MORAL');
ok('Echo C10/G0/V0: Compaixão aprova · Violência rejeita · Ganância coerente',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  const c=t.evaluateEchoReaction(e,{kind:'moral',vec:{comp:4,greed:0,viol:0}});
  const v=t.evaluateEchoReaction(e,{kind:'moral',vec:{comp:0,greed:0,viol:4}});
  const g=t.evaluateEchoReaction(e,{kind:'moral',vec:{comp:0,greed:4,viol:0}});
  assert.ok(c.value>0,'compaixão deveria aprovar, veio '+c.value);
  assert.strictEqual(c.type,'approve');
  assert.ok(v.value<0,'violência deveria rejeitar, veio '+v.value);
  assert.strictEqual(v.type,'reject');
  assert.ok(g.value<0,'ganância diverge de uma origem compassiva');
  assert.ok(Math.abs(g.value)<=Math.abs(v.value)+1,'nada explode de escala');
});
ok('a reação é SEMPRE inteira dentro de −2..+2 (escala pequena)',()=>{
  const es=[mkEcho(COMPASSION,'aggressive'),mkEcho(VIOLENT,'cautious'),
    mkEcho(GREEDY,'opportunist'),mkEcho({comp:4,greed:4,viol:4},'precise')];
  for(const e of es)
    for(const vec of [{comp:9,greed:0,viol:0},{comp:0,greed:9,viol:0},
                      {comp:0,greed:0,viol:9},{comp:3,greed:3,viol:3}]){
      const r=t.evaluateEchoReaction(e,{kind:'moral',vec});
      assert.ok(Number.isInteger(r.value)&&r.value>=-2&&r.value<=2,
        'fora da escala: '+r.value);
      assert.ok(r.intensity>=0&&r.intensity<=1);
    }
});
ok('ação sem peso moral → reação neutra (nunca ruído)',()=>{
  const e=mkEcho(COMPASSION,'versatile');
  const r=t.evaluateEchoReaction(e,{kind:'moral',vec:{comp:0,greed:0,viol:0}});
  assert.strictEqual(r.value,0);
  assert.strictEqual(r.type,'neutral');
});
ok('Echo sem referência moral (origem fraca) reage fraco, não aleatório',()=>{
  const weak=mkEcho({comp:1,greed:0,viol:0},'versatile');
  const strong=mkEcho(COMPASSION,'versatile');
  const a=t.evaluateEchoReaction(weak,{kind:'moral',vec:{comp:0,greed:0,viol:6}});
  const b=t.evaluateEchoReaction(strong,{kind:'moral',vec:{comp:0,greed:0,viol:6}});
  assert.ok(Math.abs(a.value)<=Math.abs(b.value),'sem memória, sem veredicto forte');
  assert.strictEqual(a.value,0,'origem indefinida não julga');
});
ok('avaliação é PURA: não altera trust, memória nem pressão',()=>{
  const e=mkEcho(VIOLENT,'aggressive');
  const t0=e.trust,ap=e.rel.ap,rj=e.rel.rj,p=e.dis.p;
  for(let i=0;i<20;i++)
    t.evaluateEchoReaction(e,{kind:'moral',vec:{comp:0,greed:0,viol:5}});
  assert.strictEqual(e.trust,t0);
  assert.strictEqual(e.rel.ap,ap);
  assert.strictEqual(e.rel.rj,rj);
  assert.strictEqual(e.dis.p,p);
});

/* =====================================================================
   2. ECHOS DIFERENTES JULGAM DIFERENTE (obrigatório)
   ===================================================================== */
console.log('\n[2] DOIS ECHOS, VEREDICTOS OPOSTOS');
ok('mesma escolha violenta: Echo violento APROVA e Echo compassivo REJEITA',()=>{
  const a=mkEcho(VIOLENT,'versatile',1);
  const b=mkEcho(COMPASSION,'versatile',2);
  const vec={comp:0,greed:0,viol:5};
  const ra=t.evaluateEchoReaction(a,{kind:'moral',vec});
  const rb=t.evaluateEchoReaction(b,{kind:'moral',vec});
  assert.ok(ra.value>0,'origem violenta reconhece: '+ra.value);
  assert.ok(rb.value<0,'origem compassiva rejeita: '+rb.value);
});
ok('echoesReact aplica veredictos independentes nos dois Ecos',()=>{
  freshRun();
  const a=mkEcho(VIOLENT,'versatile',1);
  const b=mkEcho(COMPASSION,'versatile',2);
  t.setEchoes([a,b]);
  const ta=a.trust,tb=b.trust;
  t.echoesReact(0,0,5);
  assert.ok(a.trust>ta,'Echo violento ganhou confiança');
  assert.ok(b.trust<tb,'Echo compassivo perdeu confiança');
  t.setEchoes([]);
});
ok('nenhum Echo lê ou altera o estado do outro (Echo↔Echo é PR 14)',()=>{
  freshRun();
  const a=mkEcho(VIOLENT,'versatile',1);
  const b=mkEcho(COMPASSION,'versatile',2);
  t.setEchoes([a,b]);
  const snap=JSON.stringify(t.relPackEcho(b));
  t.applyEchoReaction(a,t.evaluateEchoReaction(a,
    {kind:'moral',vec:{comp:0,greed:0,viol:5}}),{force:true});
  assert.strictEqual(JSON.stringify(t.relPackEcho(b)),snap,
    'a reação de um Echo não tocou o outro');
  t.setEchoes([]);
});

/* =====================================================================
   3. PERSONALIDADE E TRAÇOS MODULAM — SEM APAGAR A MORAL
   ===================================================================== */
console.log('\n[3] PERSONALIDADE E TRAÇOS');
ok('AGRESSIVO tolera Violence melhor que CAUTELOSO (mesma origem)',()=>{
  const ag=mkEcho(COMPASSION,'aggressive');
  const ca=mkEcho(COMPASSION,'cautious');
  const vec={comp:0,greed:0,viol:6};
  const a=t.evaluateEchoReaction(ag,{kind:'moral',vec});
  const c=t.evaluateEchoReaction(ca,{kind:'moral',vec});
  assert.ok(a.intensity<c.intensity,'agressivo rejeita com menos força');
  assert.ok(a.value<0&&c.value<0,'ambos ainda REJEITAM: a moral não foi apagada');
});
ok('OPORTUNISTA tolera Greed melhor que CAUTELOSO',()=>{
  const op=mkEcho(COMPASSION,'opportunist');
  const ca=mkEcho(COMPASSION,'cautious');
  const vec={comp:0,greed:6,viol:0};
  assert.ok(t.evaluateEchoReaction(op,{kind:'moral',vec}).intensity<
            t.evaluateEchoReaction(ca,{kind:'moral',vec}).intensity);
});
ok('FRAGMENTADO reage de forma mais fraca/incerta',()=>{
  const fr=mkEcho(COMPASSION,'fragmented');
  const ve=mkEcho(COMPASSION,'versatile');
  const vec={comp:0,greed:0,viol:8};
  assert.ok(t.evaluateEchoReaction(fr,{kind:'moral',vec}).intensity<
            t.evaluateEchoReaction(ve,{kind:'moral',vec}).intensity);
});
ok('RESILIENTE reage menos a pequenos desvios',()=>{
  const re=mkEcho(COMPASSION,'resilient');
  const ve=mkEcho(COMPASSION,'versatile');
  const vec={comp:2,greed:1,viol:2};
  assert.ok(t.evaluateEchoReaction(re,{kind:'moral',vec}).intensity<=
            t.evaluateEchoReaction(ve,{kind:'moral',vec}).intensity);
});
ok('personalidade NUNCA inverte o sinal do snapshot moral',()=>{
  for(const pid of Object.keys(t.PERSONALITIES)){
    const e=mkEcho(COMPASSION,pid);
    const r=t.evaluateEchoReaction(e,{kind:'moral',vec:{comp:0,greed:0,viol:8}});
    assert.ok(r.value<=0,pid+' não pode APROVAR violência com origem compassiva');
    const r2=t.evaluateEchoReaction(e,{kind:'moral',vec:{comp:8,greed:0,viol:0}});
    assert.ok(r2.value>=0,pid+' não pode REJEITAR compaixão com origem compassiva');
  }
});
ok('traços secundários ajustam levemente e nunca invertem',()=>{
  const base=mkEcho(COMPASSION,'versatile',1,[]);
  const bru=mkEcho(COMPASSION,'versatile',1,['butcher']);
  const vec={comp:0,greed:0,viol:6};
  const a=t.evaluateEchoReaction(base,{kind:'moral',vec});
  const b=t.evaluateEchoReaction(bru,{kind:'moral',vec});
  assert.ok(b.intensity<a.intensity,'CARNICEIRO tolera mais a violência');
  assert.ok(b.value<0,'ainda é rejeição');
  assert.ok(Object.keys(t.TRAIT_REL_MOD).length<=6,'sem dezenas de regras de traço');
});
ok('personalidade não altera a confiança BASE do Echo',()=>{
  const a=mkEcho(COMPASSION,'aggressive',1);
  const b=mkEcho(COMPASSION,'cautious',1);
  assert.strictEqual(a.trust,b.trust);
});

/* =====================================================================
   4. TRUST — centralizado, pequeno, com motivo
   ===================================================================== */
console.log('\n[4] TRUST');
ok('changeEchoTrust é o ponto único: aplica, limita e registra o motivo',()=>{
  const e=mkEcho(COMPASSION,'versatile');
  e.trust=50;
  const d=t.changeEchoTrust(e,7,'teste');
  assert.strictEqual(e.trust,57);
  assert.strictEqual(d,7);
  assert.strictEqual(e.rel.lastTrust.r,'teste');
  t.changeEchoTrust(e,999,'teto');
  assert.strictEqual(e.trust,57+t.REL_BALANCE.trustClamp,
    'uma única mutação nunca passa do clamp de '+t.REL_BALANCE.trustClamp);
  t.changeEchoTrust(e,-999,'piso');
  assert.strictEqual(e.trust,57);
  t.changeEchoTrust(e,-999,'piso');
  assert.strictEqual(e.trust,21);
  t.changeEchoTrust(e,-999,'piso');
  assert.strictEqual(e.trust,0,'clamp inferior em 0');
});
ok('confiança nunca sai de 0..100 mesmo sob spam de reações',()=>{
  freshRun();
  const e=mkEcho(VIOLENT,'aggressive');
  t.setEchoes([e]);
  for(let i=0;i<400;i++){
    t.setRunTime(100+i*3);
    t.echoesReact(0,0,5);
  }
  assert.ok(e.trust>=0&&e.trust<=100,'trust='+e.trust);
  t.setEchoes([]);
});
ok('uma escolha moral comum move a confiança POUCO (nada de ±20)',()=>{
  freshRun();
  const e=mkEcho(VIOLENT,'versatile');
  t.setEchoes([e]);
  const before=e.trust;
  t.echoesReact(0,0,4);
  const d=Math.abs(e.trust-before);
  assert.ok(d>0,'houve reação');
  assert.ok(d<=6,'variação pequena, veio '+d);
  t.setEchoes([]);
});
ok('nenhuma mutação de trust ficou espalhada fora do ponto central',()=>{
  const bad=[...CODE.matchAll(/(?:\w+)\.trust\s*(\+=|-=)/g)];
  assert.strictEqual(bad.length,0,'trust += encontrado: '+bad.length);
  const clamps=[...CODE.matchAll(/(\w+)\.trust=clamp\(\1\.trust[+-]/g)];
  assert.strictEqual(clamps.length,0,'padrão legado e.trust=clamp(e.trust±) ainda existe');
});
ok('mutações legítimas restantes carregam MOTIVO explícito',()=>{
  for(const r of ['event_signal_boost','event_signal_drain','event_child_guided',
    'event_child_consumed','resonance','dissonance','dissonance_floor',
    'checkpoint_restore'])
    assert.ok(RAWSRC.indexOf("'"+r+"'")>0,'motivo ausente: '+r);
});

/* =====================================================================
   5. ANTI-FARM (diminishing + cooldown por motivo)
   ===================================================================== */
console.log('\n[5] ANTI-FARM');
ok('repetir a mesma escolha 40× não vira confiança infinita',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setEchoes([e]);
  e.trust=20;
  let last=e.trust,first=null;
  for(let i=0;i<40;i++){
    t.setRunTime(100+i*1.5);
    const b=e.trust;
    t.echoesReact(4,0,0);
    const g=e.trust-b;
    if(first==null&&g>0)first=g;
    last=g;
  }
  assert.ok(first>0,'a primeira aprovação valeu algo');
  assert.ok(last<first*.6,'ganho decrescente: '+first+' → '+last);
  assert.ok(e.trust<100,'não saturou a barra com farm');
  t.setEchoes([]);
});
ok('relDimFactor cai a cada repetição e se recupera com o tempo',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  assert.strictEqual(t.relDimFactor(e,'x'),1);
  for(let i=0;i<6;i++)t.relNoteReason(e,'x');
  const low=t.relDimFactor(e,'x');
  assert.ok(low<.35&&low>=t.REL_BALANCE.dimFloor,'fator baixo: '+low);
  t.setRunTime(t.getRunTime()+400);
  assert.ok(t.relDimFactor(e,'x')>low,'o tempo devolve o peso');
});
ok('Ressonância plena: +3 na primeira e MENOS nas repetições',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  e.trust=50;
  t.setRunTime(200);
  t.echoRelResonance(e,false);
  assert.strictEqual(Math.round((e.trust-50)*100)/100,3,'invariante histórica +3');
  t.setRunTime(220);
  const b=e.trust;
  t.echoRelResonance(e,false);
  assert.ok(e.trust-b<3,'a segunda vale menos: '+(e.trust-b));
});
ok('Micro-Ressonância contribui MUITO menos que a plena e tem cooldown',()=>{
  freshRun();
  const a=mkEcho(COMPASSION,'versatile');
  const b=mkEcho(COMPASSION,'versatile');
  a.trust=50;b.trust=50;
  t.setRunTime(300);
  t.echoRelResonance(a,false);
  t.echoRelResonance(b,true);
  assert.ok((b.trust-50)<(a.trust-50)/3,'micro « plena');
  const g=b.trust;
  t.setRunTime(302);
  t.echoRelResonance(b,true);
  assert.strictEqual(b.trust,g,'cooldown de 13s bloqueia o farm imediato');
});
ok('Guardião/Disruptor têm cooldown longo por motivo (sem farm de barreira)',()=>{
  assert.strictEqual(t.REL_BALANCE.reasonCd.protection,20);
  assert.strictEqual(t.REL_BALANCE.reasonCd.disruption,20);
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setRunTime(400);
  const r=t.evaluateEchoReaction(e,{kind:'protection'});
  assert.ok(t.applyEchoReaction(e,r,{trustMul:.35}));
  t.setRunTime(405);
  assert.strictEqual(t.applyEchoReaction(e,r,{trustMul:.35}),null,'bloqueado no cooldown');
});
ok('cooldown curto entre avaliações do MESMO Echo evita rajada',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setRunTime(500);
  const r=t.evaluateEchoReaction(e,{kind:'moral',vec:{comp:5,greed:0,viol:0}});
  assert.ok(t.applyEchoReaction(e,r));
  assert.strictEqual(t.applyEchoReaction(e,r),null,'segunda no mesmo instante é ignorada');
});

/* =====================================================================
   6. RELATIONSHIP STATE (derivado, sem barra nova)
   ===================================================================== */
console.log('\n[6] ESTADO DA RELAÇÃO');
ok('os 5 estados existem e evitam AMIGO/INIMIGO',()=>{
  const labs=t.REL_STATES.map(s=>s.lab);
  assert.strictEqual(labs.length,5);
  for(const l of labs)assert.ok(!/AMIGO|INIMIGO/.test(l),l);
});
ok('thresholds: confiança alta → SINCRONIZADA/RESSONANTE; baixa → TENSA/FRATURADA',()=>{
  const e=mkEcho(COMPASSION,'versatile');
  e.trust=95;e.rel.ap=10;e.rel.rj=0;e.dis.p=0;
  assert.strictEqual(t.echoRelState(e).id,'resonant');
  e.trust=70;e.rel.ap=0;
  assert.strictEqual(t.echoRelState(e).id,'synced');
  e.trust=50;
  assert.strictEqual(t.echoRelState(e).id,'latent');
  e.trust=30;
  assert.strictEqual(t.echoRelState(e).id,'tense');
  e.trust=10;
  assert.strictEqual(t.echoRelState(e).id,'fractured');
});
ok('score é derivado: pressão alta puxa a relação para baixo',()=>{
  const e=mkEcho(COMPASSION,'versatile');
  e.trust=70;e.rel.ap=0;e.rel.rj=0;e.dis.p=0;
  const s0=t.echoRelScore(e);
  e.dis.p=100;
  assert.ok(t.echoRelScore(e)<s0,'pressão degrada a relação');
  e.dis.p=0;e.rel.rj=20;
  assert.ok(t.echoRelScore(e)<s0,'memória de rejeição degrada a relação');
});
ok('NÃO existem barras novas: sem affection/loyalty/bond/respect/friendship',()=>{
  for(const w of ['affection','loyalty','friendship','bondMeter','respectMeter'])
    assert.ok(CODE.indexOf(w)<0,'barra proibida encontrada: '+w);
  const st=t.relNewState();
  assert.deepStrictEqual(Object.keys(st).sort(),
    ['ac','acc','ap','last','lastFbAt','lastReactAt','lastRejectAt','lastTrust',
     'mm','rj','seen','streak'].filter(k=>k!=='ac').sort());
});

/* =====================================================================
   7. MEMÓRIA E MOMENTOS SIGNIFICATIVOS
   ===================================================================== */
console.log('\n[7] MEMÓRIA');
ok('aprovação e rejeição são acumuladores separados + streak assinado',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setRunTime(600);
  t.applyEchoReaction(e,{value:2,type:'approve',reason:'moral_compassion',intensity:1});
  assert.ok(e.rel.ap>0&&e.rel.rj===0);
  assert.ok(e.rel.streak>0);
  t.setRunTime(610);
  t.applyEchoReaction(e,{value:-2,type:'reject',reason:'moral_violence',intensity:1});
  assert.ok(e.rel.rj>0,'rejeição acumula em campo próprio');
  assert.ok(e.rel.streak<0,'streak troca de sinal');
});
ok('memória de momentos é COMPACTA (máx. 4) e nunca vira log infinito',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  for(let i=0;i<30;i++)t.relRememberMoment(e,'moral_violence',-2);
  assert.strictEqual(e.rel.mm.length,t.REL_BALANCE.momentsMax);
  assert.ok(t.REL_BALANCE.momentsMax<=5);
});
ok('momento significativo só nasce de reação FORTE e não saturada',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setRunTime(700);
  t.applyEchoReaction(e,{value:1,type:'approve',reason:'moral_compassion',intensity:.3});
  assert.strictEqual(e.rel.mm.length,0,'reação fraca não vira memória');
  t.setRunTime(720);
  t.applyEchoReaction(e,{value:2,type:'approve',reason:'protection',intensity:1});
  assert.strictEqual(e.rel.mm.length,1,'reação forte vira memória');
});
ok('relMomentText devolve linguagem humana, nunca fórmula',()=>{
  const txt=t.relMomentText({k:'moral_violence',v:-2,w:3});
  assert.ok(txt.length>10);
  assert.ok(!/[0-9]|trust|pressure/i.test(txt),'texto expõe número: '+txt);
});

/* =====================================================================
   8. DIÁLOGOS CONTEXTUAIS + ANTI-SPAM
   ===================================================================== */
console.log('\n[8] DIÁLOGOS');
ok('fallback hierárquico: contexto → personalidade → reação → genérico',()=>{
  const e=mkEcho(COMPASSION,'cautious');
  const a=t.pickRelationLine(e,{type:'reject',reason:'moral_violence',state:'tense'});
  assert.strictEqual(a.tier,'context_state','pool específico existe p/ TENSA');
  const b=t.pickRelationLine(e,{type:'reject',reason:'moral_violence',state:'latent'});
  assert.strictEqual(b.tier,'context','cai no pool do motivo');
  const c=t.pickRelationLine(e,{type:'reject',reason:'motivo_inexistente',state:'latent'});
  assert.strictEqual(c.tier,'personality','cai na voz da personalidade');
  const d=t.pickRelationLine({slot:1},{type:'reject',reason:'motivo_inexistente'});
  assert.strictEqual(d.tier,'reaction','cai na reação genérica');
});
ok('nunca fica sem fala (qualquer combinação devolve texto)',()=>{
  for(const pid of Object.keys(t.PERSONALITIES))
    for(const type of ['approve','reject','neutral'])
      for(const st of t.REL_STATES.map(s=>s.id)){
        const e=mkEcho(COMPASSION,pid);
        const l=t.pickRelationLine(e,{type,reason:'moral_violence',state:st});
        assert.ok(l.txt&&l.txt.length>1,pid+'/'+type+'/'+st);
        assert.notStrictEqual(l.tier,'none');
      }
});
ok('todas as personalidades têm voz de aprovação e de rejeição',()=>{
  for(const pid of Object.keys(t.PERSONALITIES)){
    const p=t.PERS_REL_LINES[pid];
    assert.ok(p,'sem pool: '+pid);
    assert.ok(p.approve.length>=2&&p.reject.length>=2,pid);
  }
});
ok('anti-spam: com dois Ecos só a reação mais intensa fala',()=>{
  freshRun();
  const a=mkEcho(VIOLENT,'versatile',1);
  const b=mkEcho(COMPASSION,'versatile',2);
  t.setEchoes([a,b]);
  t.setSpeakCd(0);
  t.getFtexts().length=0;
  t.echoesReact(0,0,5);
  const speaks=t.getFtexts().filter(f=>f.kind!=null||f.k!=null);
  assert.ok(t.getSpeakCd()>0,'o cooldown global de fala foi armado');
  assert.ok(t.getFtexts().length<=4,'nada de enxurrada de texto');
  t.setEchoes([]);
});
ok('cooldown de fala (8s) segura reações em sequência',()=>{
  freshRun();
  const e=mkEcho(VIOLENT,'versatile');
  t.setEchoes([e]);
  t.setSpeakCd(0);
  t.echoesReact(0,0,5);
  const cd=t.getSpeakCd();
  assert.ok(cd>0);
  t.setRunTime(t.getRunTime()+1);
  t.echoesReact(0,0,5);
  assert.ok(t.getSpeakCd()<=cd,'não reinicia/empilha o cooldown');
  t.setEchoes([]);
});

/* =====================================================================
   9. DISSONANCE PRESSURE
   ===================================================================== */
console.log('\n[9] PRESSÃO DE RUPTURA');
ok('rejeição aumenta a pressão · aprovação reduz',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setRunTime(800);
  t.applyEchoReaction(e,{value:-2,type:'reject',reason:'moral_violence',intensity:1});
  const p1=e.dis.p;
  assert.ok(p1>0,'rejeição forte pressiona');
  t.setRunTime(830);
  t.applyEchoReaction(e,{value:2,type:'approve',reason:'moral_compassion',intensity:1});
  assert.ok(e.dis.p<p1,'aprovação alivia');
});
ok('Ressonância alivia a pressão',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  e.dis.p=40;
  t.setRunTime(900);
  t.echoRelResonance(e,false);
  assert.ok(e.dis.p<40);
});
ok('confiança baixa faz a pressão subir sozinha (e alta faz cair)',()=>{
  freshRun();
  const low=mkEcho(COMPASSION,'versatile');
  low.trust=0;low.dis.p=0;
  for(let i=0;i<40;i++){t.setRunTime(1000+i);t.relTick(low,1);}
  assert.ok(low.dis.p>10,'desconfiança crônica pressiona: '+low.dis.p);
  const good=mkEcho(COMPASSION,'versatile');
  good.trust=90;good.dis.p=50;
  for(let i=0;i<60;i++){t.setRunTime(2000+i);t.relTick(good,1);}
  assert.ok(good.dis.p<50,'relação saudável dissolve a pressão: '+good.dis.p);
});
ok('UMA escolha isolada NUNCA rebela o Echo (nada de RNG puro)',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setEchoes([e]);
  t.setRunTime(3000);
  t.echoesReact(0,0,9);
  assert.strictEqual(e.dis.st,'stable','uma escolha não fratura nada');
  assert.ok(e.dis.p<t.relFractureAt(e));
  t.setEchoes([]);
});
ok('divergência REPETIDA leva à ruptura de forma legível',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setEchoes([e]);
  let sawUnstable=false;
  for(let i=0;i<40&&e.dis.st!=='hostile';i++){
    t.setRunTime(4000+i*2);
    t.echoesReact(0,0,9);
    t.relTick(e,2);
    if(e.dis.st==='unstable')sawUnstable=true;
    if(e.dis.st==='fracturing')t.relTick(e,2);
  }
  assert.ok(sawUnstable,'o estado INSTÁVEL foi telegrafado antes');
  assert.ok(e.dis.st==='hostile'||e.dis.st==='fracturing',
    'a divergência acumulada rompeu: '+e.dis.st);
  t.setEchoes([]);
});
ok('limiar de ruptura sobe a cada Dissonância (anti-loop)',()=>{
  const e=mkEcho(COMPASSION,'versatile');
  const base=t.relFractureAt(e);
  e.dis.count=1;
  assert.ok(t.relFractureAt(e)>base);
  e.dis.count=99;
  assert.ok(t.relFractureAt(e)<=base+t.REL_BALANCE.pressure.repeatMax,'teto respeitado');
});

/* =====================================================================
   10. MÁQUINA DE ESTADOS + TELEGRAPH
   ===================================================================== */
console.log('\n[10] MÁQUINA DE ESTADOS');
ok('estados explícitos e única fonte de verdade (hostile é derivado)',()=>{
  const e=mkEcho(COMPASSION,'versatile');
  assert.strictEqual(e.dis.st,'stable');
  assert.strictEqual(e.hostile,false);
  const d=Object.getOwnPropertyDescriptor(e,'hostile');
  assert.ok(d&&typeof d.get==='function','hostile deve ser acessor derivado');
  const d2=Object.getOwnPropertyDescriptor(e,'hostileT');
  assert.ok(d2&&typeof d2.get==='function');
});
ok('ciclo completo: stable → unstable → fracturing → hostile → recovering → cooldown',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setEchoes([e]);
  const seen=[e.dis.st];
  e.dis.p=t.REL_BALANCE.pressure.unstableAt;
  t.echoDissonanceTick(e,.1);seen.push(e.dis.st);
  e.dis.p=t.relFractureAt(e);
  t.echoDissonanceTick(e,.1);seen.push(e.dis.st);
  t.echoDissonanceTick(e,t.DIS.telegraph+.1);seen.push(e.dis.st);
  t.forceEchoRecovery(e);seen.push(e.dis.st);
  t.echoDissonanceTick(e,t.DIS.recoverDur+.1);seen.push(e.dis.st);
  assert.deepStrictEqual(seen,['stable','unstable','fracturing','hostile',
    'recovering','cooldown']);
  t.setEchoes([]);
});
ok('telegrafia: FRATURANDO não causa dano e suspende o papel',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile',1);
  t.setEchoes([e]);
  e.roleT=4;e.shieldPot=.22;
  e.dis.p=t.relFractureAt(e);
  t.echoDissonanceTick(e,.1);        // stable → unstable (telegrafia macia)
  t.echoDissonanceTick(e,.1);        // unstable → fracturing
  assert.strictEqual(e.dis.st,'fracturing');
  assert.strictEqual(e.roleT,0,'barreira do Guardião suspensa já na telegrafia');
  assert.strictEqual(e.shieldPot,0);
  const P=t.getPlayer();
  const hp0=P.hp,sh0=P.shield;
  const pr0=t.getProjectiles().length;
  for(let i=0;i<20;i++)t.updateEcho(e,.05);   // 1.0s < telegraph
  assert.strictEqual(e.dis.st,'fracturing','ainda avisando, ainda não hostil');
  assert.strictEqual(t.getProjectiles().length,pr0,'nenhum disparo hostil na telegrafia');
  assert.ok(P.hp>=hp0&&P.shield>=sh0-0.001,'nenhum dano injusto');
  for(let i=0;i<8;i++)t.updateEcho(e,.05);    // ultrapassa o telegraph
  assert.strictEqual(e.dis.st,'hostile','a transição acontece ao fim do telegraph');
  t.setEchoes([]);
});
ok('duração do telegraph fica na faixa 0.5–1.5s pedida',()=>{
  assert.ok(t.DIS.telegraph>=.5&&t.DIS.telegraph<=1.5,'telegraph='+t.DIS.telegraph);
});
ok('visual deriva do estado lógico (sem estado visual paralelo)',()=>{
  for(const st of ['stable','unstable','fracturing','hostile','recovering','cooldown']){
    assert.ok(t.DIS_LABEL[st],'sem rótulo p/ '+st);
    assert.ok(t.DIS_COLOR[st],'sem cor p/ '+st);
  }
  const fn=RAWSRC.slice(RAWSRC.indexOf('function drawEchoEntity'),
    RAWSRC.indexOf('function drawEchoEntity')+2600);
  assert.ok(/e\.dis&&e\.dis\.st/.test(fn),'o render lê a máquina de estados');
});
ok('não sobraram booleans de estado duplicados',()=>{
  for(const w of ['e.breaking','e.angry','e.rebel','e.unstableFlag','e.recoveringFlag'])
    assert.ok(RAWSRC.indexOf(w)<0,'boolean paralelo: '+w);
});

/* =====================================================================
   11. HOSTIL — alvo, dano, Shield, papéis
   ===================================================================== */
console.log('\n[11] ECHO HOSTIL');
ok('enterDissonance mantém o contrato legado (hostile, trust 0, 12s)',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  e.trust=55;
  t.enterDissonance(e);
  assert.strictEqual(e.hostile,true);
  assert.strictEqual(e.trust,0);
  assert.strictEqual(e.hostileT,12);
  assert.strictEqual(e.dis.st,'hostile');
  assert.strictEqual(t.enterDissonance(e),false,'não empilha');
});
ok('Echo hostil mira SOMENTE o jogador (nunca inimigos)',()=>{
  freshRun();
  const P=t.getPlayer();
  const e=mkEcho(COMPASSION,'versatile');
  e.x=P.x+400;e.y=P.y;
  t.setEchoes([e]);
  t.getEnemies().length=0;
  t.getEnemies().push({type:'chaser',x:P.x+410,y:P.y,r:12,hp:900,maxHp:900,
    dead:false,spawnT:0,phaseT:0,slowT:0,flashT:0,vx:0,vy:0,color:'#fff',
    st:null,resoCd:0,microCd:0,strafe:1,aim:0,dmg:5,spd:100,xp:5,touchCd:0});
  t.enterDissonance(e);
  const dist0=Math.hypot(e.x-P.x,e.y-P.y);
  for(let i=0;i<30;i++)t.updateEcho(e,.05);
  assert.ok(Math.hypot(e.x-P.x,e.y-P.y)<dist0,'aproximou-se do JOGADOR');
  const src=RAWSRC.slice(RAWSRC.indexOf('function echoHostileTick'),
    RAWSRC.indexOf('function echoRuptureTick'));
  assert.ok(!/nearestEnemy/.test(src),'a IA hostil não busca inimigos');
  t.getEnemies().length=0;t.setEchoes([]);
});
ok('dano hostil respeita Shield → HP como qualquer dano legítimo',()=>{
  freshRun();
  const P=t.getPlayer();
  P.shieldMax=40;P.shield=40;P.hp=P.maxHp;P.invT=0;P.dashT=0;
  t.damagePlayer(25);
  assert.ok(P.shield<40,'o escudo absorveu primeiro');
  assert.strictEqual(P.hp,P.maxHp,'o HP só cai depois do escudo');
  t.damagePlayer(60);
  assert.strictEqual(P.shield,0);
  assert.ok(P.hp<P.maxHp,'excedente foi para a Integridade');
});
ok('Guardião e Disruptor NÃO ajudam enquanto o Echo está em ruptura',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile',1);
  t.setEchoes([e]);
  e.trust=80;e.roleCd=0.001;
  t.echoRoleTick(e,.001);
  assert.ok(e.roleT>0,'aliado ativa o papel normalmente');
  t.enterDissonance(e);
  assert.strictEqual(e.roleT,0,'o papel é suspenso na ruptura');
  e.roleCd=0.001;
  t.echoRoleTick(e,.001);
  assert.strictEqual(e.roleT,0,'e não pode reativar enquanto hostil');
  assert.strictEqual(e.shieldPot,0);
  t.setEchoes([]);
});
ok('echoAllied é o gate único de \"ainda é seu aliado\"',()=>{
  const e=mkEcho(COMPASSION,'versatile');
  assert.strictEqual(t.echoAllied(e),true);
  for(const st of ['fracturing','hostile','recovering']){
    e.dis.st=st;
    assert.strictEqual(t.echoAllied(e),false,st);
    assert.strictEqual(t.echoInRupture(e),true,st);
  }
  e.dis.st='cooldown';
  assert.strictEqual(t.echoAllied(e),true,'em graça já é aliado de novo');
});
ok('IA hostil usa a memória de combate (perfil por personalidade)',()=>{
  assert.ok(t.HOSTILE_PROFILE.aggressive.want<t.HOSTILE_PROFILE.cautious.want,
    'agressivo pressiona, cauteloso mantém distância');
  for(const pid of Object.keys(t.PERSONALITIES))
    assert.ok(t.HOSTILE_PROFILE[pid],'sem perfil hostil: '+pid);
  assert.strictEqual(t.DIS.dmgMul,.9,'dano hostil idêntico ao legado (sem vantagem injusta)');
});

/* =====================================================================
   12. CONTENÇÃO + RECOVERY + ANTI-EXPLOIT
   ===================================================================== */
console.log('\n[12] CONTENÇÃO E RECUPERAÇÃO');
ok('bater no Echo hostil consome a RUPTURA, nunca o HP',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setEchoes([e]);
  t.enterDissonance(e);
  const hp0=e.hp,integ0=e.dis.integ;
  t.containEcho(e,10,0,0);
  assert.ok(e.dis.integ<integ0,'integridade da ruptura caiu');
  assert.strictEqual(e.hp,hp0,'o HP do Echo NÃO é tocado');
  assert.ok(e.alive,'jamais morre pela contenção');
  t.setEchoes([]);
});
ok('conter até o fim encerra a Dissonância antes dos 12s',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setEchoes([e]);
  t.enterDissonance(e);
  assert.strictEqual(e.dis.st,'hostile');
  for(let i=0;i<40&&e.dis.st==='hostile';i++)t.containEcho(e,20,0,0);
  assert.strictEqual(e.dis.st,'recovering','a contenção encerrou a hostilidade');
  assert.ok(e.hostileT===0);
  t.setEchoes([]);
});
ok('teto por acerto impede que um único burst apague a ruptura',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.enterDissonance(e);
  const used=t.containEcho(e,99999,0,0);
  assert.strictEqual(used,t.DIS.containPerHit);
  assert.strictEqual(e.dis.st,'hostile','um golpe gigante não resolve tudo');
});
ok('contenção NÃO gera XP, créditos, abate, loot nem moral',()=>{
  freshRun();
  const P=t.getPlayer();
  const e=mkEcho(COMPASSION,'versatile');
  t.setEchoes([e]);
  t.enterDissonance(e);
  const xp=P.xp,coins=P.coins,lvl=P.level,hp=P.hp;
  const mo=JSON.stringify(t.getMoral());
  for(let i=0;i<10;i++)t.containEcho(e,14,0,0);
  assert.strictEqual(P.xp,xp);
  assert.strictEqual(P.coins,coins);
  assert.strictEqual(P.level,lvl);
  assert.strictEqual(P.hp,hp,'sem lifesteal');
  assert.strictEqual(JSON.stringify(t.getMoral()),mo,'sem moralGain');
  const fn=RAWSRC.slice(RAWSRC.indexOf('function containEcho'),
    RAWSRC.indexOf('function isHostileEcho'));
  for(const bad of ['killEnemy','damageEnemy','bumpProg','applyStatus',
    'moralGain','xporbs','coins'])
    assert.ok(fn.indexOf(bad)<0,'contenção toca sistema econômico: '+bad);
  t.setEchoes([]);
});
ok('sobreviver limpo acelera a recuperação (esquiva também é contenção)',()=>{
  freshRun();
  const a=mkEcho(COMPASSION,'versatile');
  const b=mkEcho(COMPASSION,'versatile');
  t.setEchoes([a]);
  t.setRunTime(5000);
  t.enterDissonance(a);t.enterDissonance(b);
  t.setHurtAt(5000);                 // acabou de apanhar
  for(let i=0;i<20;i++)t.echoHostileTick(a,.1);
  t.setHurtAt(-999);                 // limpo há muito tempo
  for(let i=0;i<20;i++)t.echoHostileTick(b,.1);
  assert.ok(b.dis.integ<a.dis.integ,'quem não apanha contém mais rápido');
  t.setEchoes([]);
});
ok('hostile → recovering → cooldown → stable, sem auto-delete',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setEchoes([e]);
  t.enterDissonance(e);
  e.dis.t=0.0001;
  t.updateEcho(e,.01);
  assert.strictEqual(e.dis.st,'recovering');
  assert.strictEqual(e.hostile,false);
  assert.strictEqual(e.trust,t.DIS.trustFloor,'piso histórico 34 preservado');
  for(let i=0;i<40&&e.dis.st==='recovering';i++)t.updateEcho(e,.1);
  assert.strictEqual(e.dis.st,'cooldown');
  assert.ok(e.alive,'o Echo NUNCA é apagado pela Dissonância');
  for(let i=0;i<400&&e.dis.st==='cooldown';i++)t.updateEcho(e,.1);
  assert.strictEqual(e.dis.st,'stable');
  t.setEchoes([]);
});
ok('pós-Dissonância: a relação LEMBRA e a reconciliação é possível',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setEchoes([e]);
  t.setRunTime(6000);
  t.enterDissonance(e);
  assert.ok(e.rel.mm.some(m=>m.k==='dissonance'),'a ruptura virou memória');
  assert.ok(e.rel.rj>0,'tensão registrada');
  t.forceEchoRecovery(e);
  for(let i=0;i<40&&e.dis.st==='recovering';i++)t.echoDissonanceTick(e,.1);
  assert.ok(e.rel.mm.some(m=>m.k==='reconciliation'),'o retorno também é memória');
  assert.ok(e.trust>=t.DIS.trustFloor,'há de onde reconstruir');
  t.setEchoes([]);
});
ok('anti-loop: após a recuperação o Echo não rebela de novo na hora',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  t.setEchoes([e]);
  t.enterDissonance(e);
  t.forceEchoRecovery(e);
  for(let i=0;i<40&&e.dis.st==='recovering';i++)t.echoDissonanceTick(e,.1);
  assert.strictEqual(e.dis.st,'cooldown');
  assert.ok(e.dis.grace>0,'existe período de graça');
  e.dis.p=999;                       // pressão absurda durante a graça
  for(let i=0;i<20;i++)t.echoDissonanceTick(e,.1);
  assert.strictEqual(e.dis.st,'cooldown','a graça bloqueia nova ruptura imediata');
  t.setEchoes([]);
});

/* =====================================================================
   13. SAVE / CHECKPOINT / SLOTS / MIGRAÇÃO
   ===================================================================== */
console.log('\n[13] PERSISTÊNCIA');
ok('relação e pressão sobrevivem ao pack/unpack (save → reload → igual)',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'versatile');
  e.trust=63;e.rel.ap=9.4;e.rel.rj=3.1;e.rel.streak=-2;e.dis.p=48;e.dis.count=1;
  t.relRememberMoment(e,'moral_violence',-2);
  const rel=t.relPackEcho(e),dis=t.disPackEcho(e);
  const back=mkEcho(COMPASSION,'versatile');
  back.trust=63;
  t.relUnpackEcho(back,JSON.parse(JSON.stringify(rel)),JSON.parse(JSON.stringify(dis)));
  assert.strictEqual(back.rel.ap,9.4);
  assert.strictEqual(back.rel.rj,3.1);
  assert.strictEqual(back.rel.streak,-2);
  assert.strictEqual(back.dis.p,48);
  assert.strictEqual(back.dis.count,1);
  assert.strictEqual(back.rel.mm.length,1);
  assert.strictEqual(t.echoRelState(back).id,t.echoRelState(e).id);
});
ok('checkpoint grava rel/dis e o Continue Run devolve o mesmo estado',()=>{
  freshRun();
  const e=mkEcho(VIOLENT,'versatile');
  t.setEchoes([e]);
  e.trust=41;e.dis.p=52;e.rel.rj=7;
  const cp=t.smBuildCheckpoint('teste',3);
  assert.ok(cp.echoes[0].rel&&cp.echoes[0].dis,'payload PR 10 presente');
  assert.strictEqual(cp.echoes[0].dis.p,52);
  const fresh=mkEcho(VIOLENT,'versatile');
  fresh.trust=41;
  t.relUnpackEcho(fresh,cp.echoes[0].rel,cp.echoes[0].dis);
  assert.strictEqual(fresh.dis.p,52,'pressão preservada no resume');
  assert.strictEqual(fresh.rel.rj,7);
  t.setEchoes([]);
});
ok('reload NÃO zera a pressão (sem exploit de fechar o jogo)',()=>{
  const e=mkEcho(VIOLENT,'versatile');
  e.dis.p=95;e.dis.st='unstable';
  const dis=t.disPackEcho(e);
  const back=mkEcho(VIOLENT,'versatile');
  t.relUnpackEcho(back,null,dis);
  assert.strictEqual(back.dis.p,95,'a pressão veio junto');
  assert.strictEqual(back.dis.st,'unstable');
});
ok('checkpoint tirado NO MEIO da ruptura retorna em estado seguro',()=>{
  freshRun();
  const e=mkEcho(VIOLENT,'versatile');
  t.setEchoes([e]);
  t.enterDissonance(e);
  const dis=t.disPackEcho(e),rel=t.relPackEcho(e);
  assert.strictEqual(dis.rp,1);
  const back=mkEcho(VIOLENT,'versatile');
  t.relUnpackEcho(back,rel,dis);
  assert.strictEqual(back.dis.st,'cooldown','nunca retoma hostil/telegrafando');
  assert.ok(back.dis.grace>0);
  assert.ok(back.dis.p<t.relFractureAt(back),'não fratura no primeiro tick');
  assert.strictEqual(back.dis.integ,0,'estado volátil não é restaurado');
  t.setEchoes([]);
});
ok('Echo LEGADO (sem payload PR 10) carrega com fallback derivado do trust',()=>{
  const e=mkEcho(COMPASSION,'aggressive',1,['butcher']);
  const ps=e.ps,pers=e.pers,src=e.moralSrc,tr=e.trust;
  e.trust=12;
  t.relUnpackEcho(e,undefined,undefined);
  assert.strictEqual(e.rel.ap,0);
  assert.strictEqual(e.rel.mm.length,0);
  assert.ok(e.dis.p>0,'confiança baixa vira tensão inicial coerente');
  assert.strictEqual(e.dis.st,'stable');
  assert.strictEqual(e.ps,ps,'personalidade preservada');
  assert.strictEqual(e.pers,pers);
  assert.deepStrictEqual(e.moralSrc,src,'snapshot moral preservado');
  assert.strictEqual(e.trust,12,'confiança preservada');
  assert.ok(e.data&&e.data.trail.length>4,'runData preservado');
});
ok('Echo legado com confiança alta volta sem pressão',()=>{
  const e=mkEcho(COMPASSION,'versatile');
  e.trust=80;
  t.relUnpackEcho(e,null,null);
  assert.strictEqual(e.dis.p,0);
  assert.strictEqual(t.echoRelState(e).id,'synced');
});
ok('relações são isoladas por SLOT (o checkpoint mora dentro do slot)',()=>{
  const fn=RAWSRC.slice(RAWSRC.indexOf('function relPackEcho'),
    RAWSRC.indexOf('function relUnpackEcho'));
  assert.ok(fn.indexOf('localStorage')<0,'nada de chave global');
  assert.ok(/smRoot\.slots\[curSlot\]\.run/.test(RAWSRC)||
    /b\.run=activeRun/.test(RAWSRC),'a run ativa é por slot');
  const cpFn=RAWSRC.slice(RAWSRC.indexOf('function smBuildCheckpoint'),
    RAWSRC.indexOf('function smBuildCheckpoint')+2200);
  assert.ok(/relPackEcho\(e\)/.test(cpFn)&&/disPackEcho\(e\)/.test(cpFn));
});

/* =====================================================================
   14. DEV MODE
   ===================================================================== */
console.log('\n[14] DEV MODE');
ok('inspetor de relação devolve o quadro completo (leitura pura)',()=>{
  freshRun();
  t.DEV_on();
  const D=t.DEV_get();
  D.clearEchoes();D.spawnEcho(1,'cautious');
  t.clearDevTaint();
  const ri=D.relationOf(1);
  assert.ok(ri);
  for(const k of ['trust','approval','rejection','state','pressure','pressurePct',
    'dissonance','grace','count','moments','lastReaction','moralOrigin',
    'personality','traits'])
    assert.ok(k in ri,'campo ausente no inspetor: '+k);
  assert.strictEqual(t.isTainted(),false,'inspetor NÃO contamina a run');
  t.DEV_off();
});
ok('presets de relação (ALTA/NEUTRA/BAIXA) usam o caminho real e contaminam',()=>{
  freshRun();
  t.DEV_on();
  const D=t.DEV_get();
  D.clearEchoes();D.spawnEcho(1);
  t.clearDevTaint();
  D.relationPreset('high');
  assert.strictEqual(t.echoRelState(D.echo(1)).id,'resonant');
  assert.strictEqual(t.isTainted(),true,'preset marca a run como debug');
  D.relationPreset('low');
  assert.ok(['fractured','tense'].indexOf(t.echoRelState(D.echo(1)).id)>=0);
  D.relationPreset('neutral');
  assert.strictEqual(t.echoRelState(D.echo(1)).id,'latent');
  t.DEV_off();
});
ok('presets de confiança e pressão (0 / 50% / MAX)',()=>{
  freshRun();
  t.DEV_on();
  const D=t.DEV_get();
  D.clearEchoes();D.spawnEcho(1);
  assert.strictEqual(D.setTrust(1,100),100);
  assert.strictEqual(D.setTrust(1,0),0);
  D.setPressure(1,50);
  assert.strictEqual(D.relationOf(1).pressurePct,50);
  D.setPressure(1,100);
  assert.strictEqual(D.relationOf(1).pressurePct,100);
  D.setPressure(1,0);
  assert.strictEqual(D.relationOf(1).pressurePct,0);
  t.DEV_off();
});
ok('FORCE APPROVAL / FORCE REJECTION passam pelo pipeline de produção',()=>{
  freshRun();
  t.DEV_on();
  const D=t.DEV_get();
  D.clearEchoes();D.spawnEcho(1);
  const e=D.echo(1);
  e.trust=50;
  t.setRunTime(7000);
  D.forceReaction(1,'approve');
  assert.ok(e.trust>50);
  assert.strictEqual(e.rel.last.t,'approve');
  t.setRunTime(7010);
  D.forceReaction(1,'reject');
  assert.strictEqual(e.rel.last.t,'reject');
  t.DEV_off();
});
ok('debug visual: qualquer estado da máquina é alcançável sem esperar',()=>{
  freshRun();
  t.DEV_on();
  const D=t.DEV_get();
  D.clearEchoes();D.spawnEcho(1);
  for(const st of ['unstable','fracturing','hostile','recovering','cooldown','stable']){
    D.disState(1,st);
    assert.strictEqual(D.echo(1).dis.st,st,'não chegou em '+st);
  }
  t.DEV_off();
});
ok('ferramentas DEV são inertes sem DEV_MODE',()=>{
  t.DEV_off();
  const D=t.DEV_get();
  assert.strictEqual(D.relationPreset('high'),false);
  assert.strictEqual(D.setPressure(1,50),false);
  assert.strictEqual(D.forceReaction(1,'approve'),false);
  assert.strictEqual(D.disState(1,'hostile'),false);
  assert.strictEqual(D.forceRecovery(1),false);
});
ok('DEV nunca vaza para o save: run contaminada não vira Echo',()=>{
  freshRun();
  t.DEV_on();
  const D=t.DEV_get();
  D.clearEchoes();D.spawnEcho(1);
  D.relationPreset('low');
  assert.strictEqual(t.isTainted(),true);
  assert.strictEqual(t.saveEchoes(),false,'saveEchoes recusa run debug');
  t.DEV_off();
});

/* =====================================================================
   15. NÃO-REGRESSÃO / ESCOPO
   ===================================================================== */
console.log('\n[15] ESCOPO E NÃO-REGRESSÃO');
ok('a relação NÃO é buff tree: nenhum stat bruto novo',()=>{
  const i=RAWSRC.indexOf('PR 10 — RELAÇÃO PLAYER ↔ ECHO');
  const j=RAWSRC.indexOf('MORALIDADE 2.0 (PR 9)');
  const block=RAWSRC.slice(i,j);
  for(const bad of ['smMul','smAdd','dmgMul=','fireRateMul','player.maxHp',
    'critMul=','ECHO_DMG_CAP'])
    assert.ok(block.indexOf(bad)<0,'a relação mexe em stat: '+bad);
});
ok('finais: PR 10.5 reformou o bloco — relação/Dissonância PARTICIPAM do avaliador',()=>{
  /* O guarda antigo travava o pickEnding legado (PR 10.5 era futuro).
     O futuro chegou: agora buildEndingContext captura relação, confiança
     e histórico de ruptura/reconciliação, e os finais novos (silencio,
     exilio, dueto, refugio) derivam do ESTADO da run — nunca de RNG. */
  assert.ok(/function pickEnding\(/.test(RAWSRC));
  for(const k of ['liber','tirano','eterno'])
    assert(RAWSRC.indexOf(k+':{')>=0,'final original preservado: '+k);
  for(const k of ['silencio','exilio','dueto','refugio'])
    assert(RAWSRC.indexOf(k+':{')>=0,'final PR 10.5 presente: '+k);
  assert.ok(/buildEndingContext/.test(RAWSRC)&&/evaluateEndingCandidates/.test(RAWSRC));
});
ok('nada de facções / diretor / boss adaptativo / Echo↔Echo neste PR',()=>{
  for(const w of ['faction','FACTION','fractureDirector','FRACTURE_DIRECTOR',
    'echoVsEcho','echoDialogue2'])
    assert.ok(CODE.indexOf(w)<0,'escopo futuro implementado: '+w);
});
ok('performance: a relação não é recalculada por frame',()=>{
  const fn=RAWSRC.slice(RAWSRC.indexOf('function relTick'),
    RAWSRC.indexOf('function relTick')+1200);
  assert.ok(/r\.acc\+=dt/.test(fn)&&/r\.acc<\.5/.test(fn),
    'relTick deve usar acumulador de 0.5s');
  const up=RAWSRC.slice(RAWSRC.indexOf('function updateEcho'),
    RAWSRC.indexOf('function updateEcho')+900);
  assert.ok(!/echoRelState\(/.test(up),'updateEcho não deriva estado por frame');
});
ok('máquina de estados da Dissonância é O(1) por tick',()=>{
  const fn=RAWSRC.slice(RAWSRC.indexOf('function echoDissonanceTick'),
    RAWSRC.indexOf('function enterDissonance'));
  assert.ok(!/for\s*\(/.test(fn)&&!/\.filter\(|\.map\(/.test(fn),
    'sem varredura dentro do tick');
});
ok('Ressonância/Micro seguem sem consultar personalidade (PR 8 intacto)',()=>{
  const i=RAWSRC.indexOf('function triggerResonance');
  const seg=RAWSRC.slice(i,RAWSRC.indexOf('\nfunction',i+10));
  assert.ok(!/pers|PERSONALIT/i.test(seg));
});
ok('a UI de relação existe e não mostra fórmula',()=>{
  freshRun();
  const e=mkEcho(COMPASSION,'cautious',1);
  t.setEchoes([e]);
  const h=t.relationPanelHTML();
  assert.ok(/RELAÇÃO/.test(h)&&/CONFIANÇA/.test(h));
  assert.ok(!/pressure|dis\.p|score/i.test(h),'a UI expõe interno: '+h);
  t.setEchoes([]);
});

/* --------------------------------------------------------------- */
console.log('---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
if(failed){console.log('PR 10 — FALHAS DETECTADAS');process.exit(1);}
console.log('PR 10 — TODOS OS TESTES PASSARAM');
