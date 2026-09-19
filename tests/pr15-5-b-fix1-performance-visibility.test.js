'use strict';
const assert=require('assert');
const {T,sandbox,SRC}=require('../audit_pr135/harness.js');
let pass=0,fail=0;
function ok(name,fn){try{fn();pass++;console.log('  ✔ '+name);}catch(e){fail++;console.error('  ✘ '+name+' → '+e.message);}}
const IDS=Object.keys(T.EDEFS);
function enemy(type,x=500,y=400){const d=T.EDEFS[type];return{x,y,aim:0,r:d.r,hp:d.hp,maxHp:d.hp,spawnT:0,dead:false,phaseT:0,flashT:0,slowT:0,touchCd:0,vx:0,vy:0,type,color:d.color,spd:d.spd,dmg:d.dmg,xp:d.xp,strafe:1,fireT:1,visualSeed:1,pullVisual:0,elite:null};}
function fresh(){T.startRun();const p=T.getPlayer();p.x=640;p.y=400;p.r=13;p.hp=100;p.invT=0;p.vx=p.vy=0;T.setEnemies([]);T.setProjectiles([]);return p;}
function ops(e){sandbox.__ctxLog=[];T.drawEnemy(e);const c={};for(const [k] of sandbox.__ctxLog)c[k]=(c[k]||0)+1;sandbox.__ctxLog=null;return c;}
function extra(a,b,k){return (b[k]||0)-(a[k]||0);}
console.log('\nECHO — PR15.5-B-FIX #1 · PERFORMANCE E VISIBILIDADE');

// A — remoção das causas raiz no update
ok('A01 remove faixa literal contactR+54',()=>assert.ok(!/contactR\+54/.test(SRC)));
ok('A02 proximidade Chaser não cria visual state',()=>{const p=fresh(),e=enemy('chaser',p.x-p.r-13-30,p.y);T.updateEnemy(e,0);assert.ok(!e.visual);});
ok('A03 proximidade Tank não cria visual state',()=>{const p=fresh(),e=enemy('tank',p.x-p.r-27-20,p.y);T.updateEnemy(e,0);assert.ok(!e.visual);});
ok('A04 proximidade Splitter não cria visual state',()=>{const p=fresh(),e=enemy('splitter',p.x-p.r-16-20,p.y);T.updateEnemy(e,0);assert.ok(!e.visual);});
ok('A05 proximidade Swarm não cria visual state',()=>{const p=fresh(),e=enemy('swarm',p.x-p.r-9-20,p.y);T.updateEnemy(e,0);assert.ok(!e.visual);});
ok('A06 contato Chaser cria evento curto',()=>{const p=fresh(),e=enemy('chaser',p.x,p.y);T.updateEnemy(e,0);assert.strictEqual(e.visual.attackStyle,'contact');assert.strictEqual(e.visual.attackT,.08);});
ok('A07 contato Swarm não cria cue individual',()=>{const p=fresh(),e=enemy('swarm',p.x,p.y);T.updateEnemy(e,0);assert.ok(!e.visual);});
ok('A08 Singular dentro do raio não cria state',()=>{const p=fresh(),e=enemy('singular',p.x-200,p.y);T.updateEnemy(e,0);assert.ok(e.pullVisual>0);assert.ok(!e.visual);});
ok('A09 Singular fora do raio zera escalar',()=>{const p=fresh(),e=enemy('singular',p.x-500,p.y);e.pullVisual=1;T.updateEnemy(e,0);assert.strictEqual(e.pullVisual,0);});
ok('A10 Spawner carregando não cria state',()=>{fresh();const e=enemy('spawner');e.spawnCd=2;e.charging=false;T.updateEnemy(e,0);assert.ok(!e.visual);});

// B — hot path de draw: geometria incorporada, sem layer genérica
ok('B01 drawCommonAttackCue removido',()=>assert.ok(!/function drawCommonAttackCue/.test(SRC)));
ok('B02 drawSingularInfluence removido',()=>assert.ok(!/function drawSingularInfluence/.test(SRC)));
ok('B03 drawEnemy não chama pose genérica de ataque',()=>{const b=SRC.slice(SRC.indexOf('function drawEnemy'),SRC.indexOf('function drawBoss'));assert.ok(!/visualEnemyAttackPose/.test(b));});
/* PR-VISUAL — RE-BASELINE INTENCIONAL DE B04..B10
   O contrato anterior era "windup não desenha nada": a antecipação só
   podia deformar primitivas que já existiam. Isso segurava o custo, mas
   deixava CADA TIPO inventar o próprio aviso dentro do próprio corpo — e
   nenhum deles sobrevivia ao meio de uma onda cheia.
   O rework introduziu um telegraph COMPARTILHADO (drawEnemyDangerMark):
   uma cunha branca na direção do golpe, idêntica nos onze tipos, colada
   ao corpo e desenhada fora da pose. O contrato passa de "zero" para
   "exatamente a cunha" — um limite MAIS forte, porque agora nenhum tipo
   pode adicionar aviso próprio sem quebrar estes testes, e o custo do
   perigo é constante por tipo em vez de crescer com o catálogo. */
const WINDUP_CASES=[
  ['shooter','emitter-charge',560],
  ['orbiter','satellite-align',430],
  ['phantom','materialize',13],
  ['chaser','contact',26],
  ['tank','contact',40],
  ['splitter','contact',30]
];
function windupDelta(id,style,rng){
  const e=enemy(id);if(id==='phantom')e.ghostT=.2;
  const a=ops(e);T.visualAttackObserve(e,'windup',.8,0,rng,style);const b=ops(e);
  const d={};for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
    const v=(b[k]||0)-(a[k]||0);if(v)d[k]=v;}
  return d;
}
for(const [id,style,rng] of WINDUP_CASES){
  ok('B04 '+id+' windup desenha exatamente UMA cunha',()=>{
    const d=windupDelta(id,style,rng);
    assert.strictEqual(d.save,1);assert.strictEqual(d.restore,1);
    assert.strictEqual(d.beginPath,1);assert.strictEqual(d.stroke,1);
  });
  ok('B05 '+id+' windup não traz preenchimento nem arco',()=>{
    const d=windupDelta(id,style,rng);
    assert.ok(!d.fill,'fill extra no windup');assert.ok(!d.arc,'arc extra no windup');
  });
}
ok('B06 o aviso é a MESMA cunha em todos os tipos que avisam',()=>{
  // normaliza a ORDEM das chaves: o que importa é o conjunto de ops, não
  // a sequência em que cada ramo de tipo já tinha tocado o contexto.
  const norm=d=>Object.keys(d).sort().map(k=>k+'='+d[k]).join(',');
  const base=norm(windupDelta('shooter','emitter-charge',560));
  for(const [id,style,rng] of WINDUP_CASES)
    assert.strictEqual(norm(windupDelta(id,style,rng)),base,id+' inventou aviso próprio');
});
ok('B07 Enxame é a exceção declarada: não avisa individualmente',()=>{
  assert.deepStrictEqual(windupDelta('swarm','contact',20),{});
});
ok('B08 a cunha vive fora dos ramos de tipo',()=>{
  const b=SRC.slice(SRC.indexOf('function drawEnemy'),SRC.indexOf('function drawBoss'));
  assert.ok(!/drawEnemyDangerMark/.test(b.slice(b.indexOf("if(e.type==='chaser')"))),
    'a cunha foi parar dentro de um ramo de tipo');
});
ok('B09 a cunha só existe na ANTECIPAÇÃO, nunca no golpe',()=>{
  const e=enemy('chaser'),a=ops(e);
  T.visualAttackTrigger(e,0,26,'contact',.08);
  assert.strictEqual(extra(a,ops(e),'beginPath'),0);
});
ok('B10 Phantom mantém a deformação estrutural do windup',()=>{
  assert.ok(/\.16\+\.54\*matP/.test(SRC)&&/\.16\+\.22\*matP/.test(SRC));
});
ok('B11 Chaser contato não adiciona path',()=>{const e=enemy('chaser'),a=ops(e);T.visualAttackTrigger(e,0,26,'contact',.08);assert.strictEqual(extra(a,ops(e),'beginPath'),0);});
ok('B12 Tank contato não adiciona transforms',()=>{const e=enemy('tank'),a=ops(e);T.visualAttackTrigger(e,0,40,'contact',.08);const b=ops(e);assert.strictEqual(extra(a,b,'translate')+extra(a,b,'rotate')+extra(a,b,'scale'),0);});
ok('B13 Splitter contato não adiciona path',()=>{const e=enemy('splitter'),a=ops(e);T.visualAttackTrigger(e,0,30,'contact',.08);assert.strictEqual(extra(a,ops(e),'beginPath'),0);});

// C — Singular e Swarm: limites operacionais explícitos
/* PR-VISUAL: 5 → 9 arcos. O Singular ganhou a LENTE — 4 arcos curtos e
   excêntricos que entortam o fundo à volta do poço. É a única silhueta do
   catálogo formada pelo que a criatura faz com o ESPAÇO; sem ela,
   "gravitacional" era só uma paleta rosa. Os 3 anéis de colapso, o corpo
   e o núcleo seguem lá — o delta é exatamente a lente. */
ok('C01 Singular fora do pull: 3 anéis + corpo + núcleo + 4 da lente',()=>{const o=ops(enemy('singular'));assert.strictEqual(o.arc,9);});
ok('C01b lente e queda não custam save/restore extra',()=>{const o=ops(enemy('singular'));assert.strictEqual(o.save,2);assert.strictEqual(o.restore,2);});
ok('C02 Singular dentro adiciona exatamente um arc',()=>{const e=enemy('singular'),a=ops(e);e.pullVisual=.8;assert.strictEqual(extra(a,ops(e),'arc'),1);});
ok('C03 Singular dentro adiciona exatamente um stroke',()=>{const e=enemy('singular'),a=ops(e);e.pullVisual=.8;assert.strictEqual(extra(a,ops(e),'stroke'),1);});
ok('C04 Singular dentro não adiciona save/restore',()=>{const e=enemy('singular'),a=ops(e);e.pullVisual=.8;const b=ops(e);assert.strictEqual(extra(a,b,'save')+extra(a,b,'restore'),0);});
ok('C05 Singular não usa marcadores em loop de pull',()=>{const b=SRC.slice(SRC.indexOf("}else if(e.type==='singular')"),SRC.indexOf("}else{"));assert.ok(!/for\s*\([^)]*pullVisual/.test(b));assert.ok(!/Math\.atan2/.test(b));});
ok('C06 Swarm draw não consulta attackState',()=>{const b=SRC.slice(SRC.indexOf("}else if(e.type==='swarm')"),SRC.indexOf("}else if(e.type==='orbiter')"));assert.ok(!/attackState|visualPeek/.test(b));});
ok('C07 Swarm ativo artificial não adiciona operação',()=>{const e=enemy('swarm'),a=ops(e);T.visualAttackObserve(e,'windup',.8,0,20,'contact');assert.deepStrictEqual(ops(e),a);});
/* PR-VISUAL: as asas deixaram de ser elipses. Com R=9 uma elipse vira
   borrão; triângulos que DOBRAM mantêm a batida legível e deixam o bando
   ler como massa. Sobra UMA elipse no Enxame — a pegada, que agora é
   informação de classe (ver gramática de leitura em index.html). */
ok('C08 Swarm: asas angulares, uma única elipse (a pegada)',()=>{const o=ops(enemy('swarm'));assert.strictEqual(o.ellipse,1);});
ok('C08b Swarm mantém duas asas, agora como triângulos fechados',()=>{const o=ops(enemy('swarm'));assert.strictEqual(o.closePath,4);});

// D — impacto estrutural barato
ok('D01 Shooter altera canhão em pelo menos 30% no windup',()=>assert.ok(/\.80\+\.48\*shotP/.test(SRC)));
ok('D02 Shooter altera orbe em pelo menos 30% do raio',()=>assert.ok(/\.34\*shotP/.test(SRC)));
/* PR-VISUAL: a convergência deixou de ser "achatar uma reta vertical" e
   passou a ser a INCLINAÇÃO DO PLANO ORBITAL — a elipse endireita até
   virar círculo e a órbita encara o jogador. Antes os satélites
   deslizavam numa reta: geometria orbital só no nome. */
ok('D03 Orbiter converge inclinando o plano orbital',()=>assert.ok(/tilt=\.42\+\.58\*orbP/.test(SRC)));
ok('D03b satélites correm SOBRE a elipse do plano',()=>{
  const b=SRC.slice(SRC.indexOf("}else if(e.type==='orbiter')"),SRC.indexOf("}else if(e.type==='bulwark')"));
  assert.ok(/Math\.cos\(sa\)\*R\*1\.18/.test(b)&&/Math\.sin\(sa\)\*R\*1\.18\*tilt/.test(b));
});
ok('D04 Orbiter amplia satélites estruturalmente',()=>assert.ok(/\.15\+\.18\*orbP/.test(SRC)));
ok('D05 Phantom varia alpha em faixa forte',()=>assert.ok(/\.16\+\.54\*matP/.test(SRC)));
ok('D06 Phantom varia largura estrutural',()=>assert.ok(/\.16\+\.22\*matP/.test(SRC)));
ok('D07 Bulwark usa shieldAng',()=>assert.ok(/drawAim=.*shieldAng/.test(SRC)));
ok('D08 Bulwark tem frente maior que 1.2R',()=>assert.ok(/R\*1\.22/.test(SRC)));
ok('D09 Chaser impacto estende lâmina quase 0.5R',()=>assert.ok(/1\.5\+\.48\*contactP/.test(SRC)));
ok('D10 Splitter impacto abre silhueta sem novo path',()=>assert.ok(/splitGap=\.18\*splitP\*R/.test(SRC)));

// E — pureza, cardinalidade e contratos
for(const id of IDS)ok('E draw puro '+id,()=>{fresh();const e=enemy(id);const b=JSON.stringify(e);T.drawEnemy(e);assert.strictEqual(JSON.stringify(e),b);});
ok('E12 renderer não usa partículas/glow novo como cue',()=>{const b=SRC.slice(SRC.indexOf('function drawEnemy'),SRC.indexOf('function drawBoss'));assert.ok(!/spawnParticles|spawnRing/.test(b));});
ok('E13 46 Chasers fora de contato ficam lazy',()=>{const p=fresh(),es=Array.from({length:46},(_,i)=>enemy('chaser',50+i*23,80));T.setEnemies(es);for(const e of es)T.updateEnemy(e,0);assert.strictEqual(es.filter(e=>e.visual).length,0);});
ok('E14 catálogos mecânicos preservados',()=>{assert.strictEqual(IDS.length,11);assert.strictEqual(T.WEAPONS.length,27);assert.strictEqual(T.MINIBOSS.length,8);});
ok('E15 nenhum array no estado de ataque',()=>{const e=enemy('shooter');T.visualAttackObserve(e,'windup',.5,0,560,'emitter-charge');assert.ok(!Object.values(e.visual).some(Array.isArray));});

console.log(`\nResultado: ${pass} passaram · ${fail} falharam`);
if(fail)process.exitCode=1;
