'use strict';
/* =====================================================================
   TESTES — PR13.5 · BLOCO 2
   B2-A: Echo Speech UX (fila/prioridade/duração dinâmica/estado efêmero)
   B2-B: Melee × Ranged Range (pipeline único + migração)
   ===================================================================== */
const assert=require('assert');
const {T}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function near(a,b,eps=1e-6){return Math.abs(a-b)<=eps;}
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}
}
function freshRun(){
  T.resetShopVars();
  T.setState('play');
  T.setMoral({comp:0,greed:0,viol:0});
  T.setPlayer(null);
  T.startRun();
  const p=T.getPlayer();
  p.coins=999999;
  T.speechClear();
  T.setFtexts([]);
  T.setProjectiles([]);
  T.setSwings([]);
  T.setEnemies([]);
  return p;
}
function mkEcho(slot){
  const data={dur:60,trail:[[0,100,100,0,0,0]],items:[],upg:[],owned:[0],dom:'neutro',
    moral:{},kills:5,mh:100,st:{},dmgMul:1,frMul:1,wave:2,level:1,
    crit:0,critMul:1.8,pierce:0,aoeMul:1,rangeMul:1,projSpdMul:1};
  const e=T.makeEcho(data,slot||1);
  e.x=200;e.y=200;e.alive=true;
  return e;
}
function weapon(id){return T.WEAPONS.find(w=>w.id===id);}

console.log('\nECHO — PR13.5 · BLOCO 2 (fala + alcance melee×ranged)');
console.log('---------------------------------------------');

/* ================= B2-A — FALA ================= */
ok('duração dinâmica: fala longa dura mais que a curta',()=>{
  const a=T.echoSpeechDuration('PRONTO.',T.SPEECH_PRI.normal);
  const b=T.echoSpeechDuration('NÃO RECONHEÇO MAIS. O QUE ESTÁ DO OUTRO LADO É OUTRA COISA.',T.SPEECH_PRI.normal);
  assert.ok(b>a,'longa '+b+' > curta '+a);
});
ok('duração respeita mín/máx e prioridade',()=>{
  assert.ok(T.echoSpeechDuration('',T.SPEECH_PRI.normal)>=1.6);
  assert.ok(T.echoSpeechDuration(String('x').repeat(200),T.SPEECH_PRI.normal)<=5.0);
  assert.ok(T.echoSpeechDuration('MSG IMPORTANTE',T.SPEECH_PRI.critical)>
    T.echoSpeechDuration('MSG IMPORTANTE',T.SPEECH_PRI.normal));
});
ok('CRITICAL substitui LOW; LOW não apaga CRITICAL',()=>{
  const p=freshRun();
  const e=mkEcho(1);T.setEchoes([e]);
  T.speechClear();
  T.echoSpeak(e,'COMÉDIA AMBIENTE','#fff','low');
  assert.strictEqual(T.speechActive().pri,T.SPEECH_PRI.low);
  T.echoSpeak(e,'ALERTA CRÍTICO','#ff4df0','critical');
  assert.strictEqual(T.speechActive().pri,T.SPEECH_PRI.critical);
  T.echoSpeak(e,'ALERTA CRÍTICO','#ff4df0','low');
  assert.strictEqual(T.speechActive().pri,T.SPEECH_PRI.critical,'LOW não preempta CRITICAL');
});
ok('fila limitada: stress de 150 pedidos não cresce sem limite',()=>{
  const e=mkEcho(1);T.setEchoes([e]);
  T.speechClear();
  let ok=true;
  for(let i=0;i<150;i++){
    const pri=i%3===0?'critical':(i%3===1?'high':'normal');
    try{T.echoSpeak(e,'TESTE '+i+' '+'·'.repeat(i%20),i%2?'#fff':'#0ff',pri);}
    catch(err){ok=false;break;}
  }
  assert.ok(ok,'sem exceção no stress');
  assert.ok(T.speechQueue().length<=T.ECHO_SPEECH_QUEUE_MAX,'fila <= '+T.ECHO_SPEECH_QUEUE_MAX);
  assert.ok(T.speechActive()!=null,'converge para estado ativo');
});
ok('anti-spam: mesma frase não repete no intervalo',()=>{
  const e=mkEcho(1);T.setEchoes([e]);
  T.speechClear();
  T.echoSpeak(e,'MESMA FRASE','#fff','high');
  const before=T.speechQueue().length+(T.speechActive()?1:0);
  T.echoSpeak(e,'MESMA FRASE','#fff','high');
  const after=T.speechQueue().length+(T.speechActive()?1:0);
  assert.strictEqual(after,before,'mesma frase suprimida');
});
ok('cooldown por prioridade: HIGH não é bloqueado por LOW',()=>{
  const e=mkEcho(1);T.setEchoes([e]);
  T.speechClear();
  T.echoSpeak(e,'AMBIENTE','#fff','low');
  assert.strictEqual(T.speechActive().pri,T.SPEECH_PRI.low);
  T.echoSpeak(e,'EVENTO IMPORTANTE','#ffd166','high');
  assert.strictEqual(T.speechActive().pri,T.SPEECH_PRI.high,'HIGH preempta LOW');
});
ok('speechClear limpa ativa e fila',()=>{
  const e=mkEcho(1);T.setEchoes([e]);
  T.speechClear();
  T.echoSpeak(e,'ATIVA','#fff','normal');
  T.echoSpeak(e,'FILA','#fff','high');
  T.speechClear();
  assert.strictEqual(T.speechActive(),null);
  assert.strictEqual(T.speechQueue().length,0);
});
ok('separação: fala não aparece no mesmo contêiner dos danos',()=>{
  const e=mkEcho(1);T.setEchoes([e]);
  T.speechClear();T.setFtexts([]);
  T.echoSpeak(e,'FALA DEDICADA','#8ff6ff','normal');
  assert.ok(T.speechActive()!=null);
  assert.strictEqual(T.getFtexts().length,0,'danos continuam em ftexts; fala fica fora');
  assert.ok(!T.getFtexts().some(f=>f.txt==='FALA DEDICADA'));
});
ok('tick expira a fala ativa',()=>{
  const e=mkEcho(1);T.setEchoes([e]);
  T.speechClear();
  T.echoSpeak(e,'EXPIRA','#fff','normal');
  T.speechTick(10);
  assert.strictEqual(T.speechActive(),null);
});
ok('Dissonância entra como CRITICAL via echoReact',()=>{
  const p=freshRun();
  const e=mkEcho(1);e.x=p.x;e.y=p.y;T.setEchoes([e]);
  T.speechClear();T.setFtexts([]);
  const old=Math.random;Math.random=()=>0;
  try{
    const sent=T.echoReact('dissonance');
    assert.strictEqual(sent,true);
    assert.ok(T.speechActive()&&T.speechActive().pri===T.SPEECH_PRI.critical);
  }finally{Math.random=old;}
});

/* ================= B2-B — RANGE ================= */
ok('meleeRange e rangedRange são stats do pipeline',()=>{
  const p=freshRun();
  assert.ok(T.SM_STATS.meleeRange&&T.SM_STATS.rangedRange,'estão em SM_STATS');
  assert.ok(T.smGet(p,'meleeRange')===1&&T.smGet(p,'rangedRange')===1);
  T.smMul(p,'meleeRange','t.m','TESTE',2);
  T.smMul(p,'rangedRange','t.r','TESTE',.5);
  assert.ok(near(p.meleeRangeMul,2));
  assert.ok(near(p.rangedRangeMul,.5));
});
ok('meleeRange não altera ranged e vice-versa',()=>{
  const p=freshRun();
  T.smMul(p,'meleeRange','t.m','TESTE M',3);
  assert.ok(near(p.rangedRangeMul,1));
  T.smMul(p,'rangedRange','t.r','TESTE R',.4);
  assert.ok(near(p.meleeRangeMul,3));
  assert.ok(near(p.rangedRangeMul,.4));
});
ok('breakdown cobre os dois stats',()=>{
  const p=freshRun();
  T.smMul(p,'meleeRange','t.mu','BREAK M',2);
  T.smMul(p,'rangedRange','t.ru','BREAK R',.5);
  const bm=T.smBreakdown(p,'meleeRange');
  const br=T.smBreakdown(p,'rangedRange');
  assert.ok(bm&&br);
  assert.ok(bm.lines.some(l=>l.id==='t.mu'));
  assert.ok(br.lines.some(l=>l.id==='t.ru'));
});
ok('weaponRange: melee usa meleeRange, ranged usa rangedRange',()=>{
  const p=freshRun();
  const blade=weapon('blade'),shotgun=weapon('shotgun');
  T.smMul(p,'meleeRange','t.m','M',2);
  T.smMul(p,'rangedRange','t.r','R',3);
  assert.ok(near(T.weaponRange(blade,p),blade.reach*2));
  assert.ok(near(T.weaponRange(shotgun,p),shotgun.range*3));
});
ok('fireMelee usa meleeRange no reach',()=>{
  const p=freshRun();
  p.x=300;p.y=300;p.aim=0;
  const blade=weapon('blade');
  T.smMul(p,'meleeRange','t.m','M',2);
  T.smMul(p,'rangedRange','t.r','R',.3);       // não deve interferir
  T.setSwings([]);
  T.fireMelee(p,blade,'ally',1);
  const sw=T.getSwings().pop();
  assert.ok(sw,'swing criado');
  assert.ok(near(sw.reach,blade.reach*2),'reach '+sw.reach+' esperado '+blade.reach*2);
});
ok('fireBeam usa rangedRange no comprimento',()=>{
  const p=freshRun();
  p.x=300;p.y=300;p.aim=0;
  const beam=weapon('beam');
  T.smMul(p,'meleeRange','t.m','M',.5);        // não deve interferir
  T.smMul(p,'rangedRange','t.r','R',2);
  T.fireBeam(p,beam,'ally',1,.016);
  assert.ok(near(p.beamLen,beam.range*2),'beamLen '+p.beamLen);
});
ok('projétil usa rangedRange no maxDist; shotgun preserva pellets/spread',()=>{
  const p=freshRun();
  p.x=300;p.y=300;p.aim=0;
  const shotgun=weapon('shotgun');
  const count0=shotgun.count,spread0=shotgun.spread;
  T.smMul(p,'meleeRange','t.m','M',5);
  T.smMul(p,'rangedRange','t.r','R',2);
  T.setProjectiles([]);
  T.fireWeaponFrom(p,shotgun,'ally',1);
  const ps=T.getProjectiles();
  assert.ok(ps.length===count0,'pellets preservados: '+ps.length+' == '+count0);
  assert.ok(ps.every(x=>near(x.maxDist,shotgun.range*2)),'maxDist aplica rangedRange');
  assert.strictEqual(shotgun.spread,spread0,'spread intacto');
});
ok('migração: save antigo com stat range vira melee+ranged',()=>{
  const p=freshRun();
  T.smMul(p,'range','upgrade.range.range','ANTIGO +25%',1.25);
  assert.ok(near(p.rangeMul,1.25));
  assert.strictEqual(p.meleeRangeMul,1);
  T.migrateLegacyRangeMods(p);
  assert.ok(near(p.meleeRangeMul,1.25));
  assert.ok(near(p.rangedRangeMul,1.25));
});
ok('modificador universal (smRangeBoth) aplica aos dois',()=>{
  const p=freshRun();
  const u=T.UPGRADES.find(u=>u.id==='range');
  u.apply(p);
  assert.ok(near(p.rangeMul,1.25));
  assert.ok(near(p.meleeRangeMul,1.25));
  assert.ok(near(p.rangedRangeMul,1.25));
});
ok('condicional e override funcionam nos novos stats',()=>{
  const p=freshRun();
  T.smAdd(p,{id:'c.mul',stat:'rangedRange',type:'mult',value:2,cond:()=>true});
  T.smAdd(p,{id:'c.ov',stat:'rangedRange',type:'override',value:7,cond:()=>true});
  assert.strictEqual(T.smGet(p,'rangedRange'),7);
  assert.strictEqual(T.smGet(p,'meleeRange'),1);
  T.smAdd(p,{id:'c.cond',stat:'rangedRange',type:'mult',value:.5,cond:()=>false});
  assert.strictEqual(T.smGet(p,'rangedRange'),7,'condicional inativa não soma');
});
ok('armas são explicitamente classificadas; sem híbridas fantasmas',()=>{
  const melee=T.WEAPONS.filter(w=>w.melee);
  const ranged=T.WEAPONS.filter(w=>w.range!=null&&!w.melee);
  const beams=T.WEAPONS.filter(w=>w.beam);
  assert.strictEqual(melee.length,7);
  assert.ok(ranged.length>=19);
  assert.strictEqual(beams.length,1);
  assert.strictEqual(T.WEAPONS.filter(w=>w.melee&&w.beam).length,0);
});
ok('Echo mantém rangeMul legado e classificação close/ranged intacta',()=>{
  const e=mkEcho(1);
  assert.ok(e.rangeMul===1);
  const blade=weapon('blade'),rail=weapon('rail');
  assert.ok(blade.melee&&blade.range<300);
  assert.ok(!rail.melee&&rail.range>300);
});
ok('inimigos não herdam meleeRange/rangedRange',()=>{
  const p=freshRun();
  T.smMul(p,'meleeRange','t.m','M',3);
  const enemy={x:10,y:10,r:10,rangeMul:2};
  assert.strictEqual(T.srcRangeMul(enemy,'melee'),2,'enemy cai no fallback rangeMul');
  assert.strictEqual(T.srcRangeMul(p,'ranged'),p.rangedRangeMul);
});

console.log('\n---------------------------------------------');
console.log('Resultado: '+passed+' passaram · '+failed+' falharam');
process.exit(failed?1:0);
