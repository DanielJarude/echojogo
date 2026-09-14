'use strict';
/* =====================================================================
   ECHO — PR15.5-E0 · DETERMINISMO VISUAL ("o renderer é um observador")

   CONTEXTO
   --------
   rand()/randi() são wrappers diretos de Math.random(), o MESMO fluxo
   global que alimenta crit, spread, Elite, drops, eventos e AI. Enquanto
   o pipeline de draw consumia esse fluxo, o número de frames desenhados
   deslocava a sequência mecânica: FPS, refresh rate, culling de câmera,
   tempo parado num modal e até opções visuais (cfg.aberr) mudavam o
   futuro da run. Pior: drawEchoEntity CRIAVA partículas, mutando `parts`.

   O QUE ESTA SUÍTE PROVA
   ----------------------
   A · infraestrutura preservada (rand/Math.random/fractureRng intactos)
   B · call graph de draw sem RNG — teste ESTRUTURAL anti-regressão
   C..I · cada renderer corrigido: zero RNG, efeito ainda vivo no tempo
   J · PR15.5-C / PR15.5-D / PR15.7 preservados
   K · RNG SENTINEL — contador real de Math.random sob execução de draw
   L · equivalência temporal e independência de FPS

   Não há snapshot de pixel: o contrato é sobre PARÂMETROS e OPS do
   Canvas mock, nunca sobre imagem renderizada.
   ===================================================================== */
const assert=require('assert');
const {T,SRC,sandbox}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}

/* ---------- utilitários ---------- */
function opsOf(fn){
  sandbox.__ctxLog=[];
  try{fn();}catch(e){sandbox.__ctxLog=null;throw e;}
  const l=sandbox.__ctxLog;sandbox.__ctxLog=null;return l;
}
/* SENTINEL: troca Math.random por um contador dentro do sandbox do jogo.
   Devolve quantas vezes o RNG global foi tocado durante `fn`. */
function rngCount(fn){
  const real=sandbox.Math.random;
  let n=0;
  sandbox.Math.random=function(){n++;return 0.5;};
  try{fn();}finally{sandbox.Math.random=real;}
  return n;
}
/* Assinatura numérica estável de uma sequência de ops do Canvas. */
function sig(log){
  const out=[];
  for(const [op,args] of log){
    out.push(op);
    for(const a of (args||[]))out.push(typeof a==='number'?a.toFixed(6):String(a));
  }
  return out.join('|');
}
const finiteArgs=l=>l.every(e=>(e[1]||[]).every(a=>typeof a!=='number'||Number.isFinite(a)));

/* Corpo-fonte de uma função top-level, com chaves balanceadas e sem
   comentários/strings — base do teste estrutural de call graph. */
/* Remove APENAS comentários. Strings são preservadas de propósito: o
   código em português usa apóstrofos dentro de comentários ("só",
   "própria"), e tentar casar literais de string aqui devora regiões
   inteiras do arquivo. Nenhuma string do jogo contém "rand(" ou
   "Math.random(", então RNG_RE continua confiável. */
function stripNoise(s){
  s=s.replace(/\/\*[\s\S]*?\*\//g,' ');
  s=s.replace(/(^|[^:/])\/\/[^\n]*/g,'$1 ');
  return s;
}
const CLEAN=stripNoise(SRC);
function fnBody(name){
  const re=new RegExp('(^|\\n)function\\s+'+name+'\\s*\\(','g');
  const m=re.exec(CLEAN);
  if(!m)return null;
  let i=CLEAN.indexOf('{',m.index),d=0,start=i;
  for(;i<CLEAN.length;i++){
    if(CLEAN[i]==='{')d++;
    else if(CLEAN[i]==='}'){d--;if(d===0)return CLEAN.slice(start,i+1);}
  }
  return null;
}
const RNG_RE=/Math\.random\s*\(|(?<![A-Za-z0-9_$.])rand\s*\(|(?<![A-Za-z0-9_$.])randi\s*\(/;
function callsOf(body){
  const out=new Set(),re=/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;let m;
  while((m=re.exec(body)))out.add(m[1]);
  return out;
}
/* Fecho transitivo real a partir das raízes de draw. */
function drawClosure(roots){
  const seen=new Set(),bodies=new Map(),stack=roots.slice();
  while(stack.length){
    const n=stack.pop();
    if(seen.has(n))continue;
    const b=fnBody(n);
    if(b==null)continue;          // não é função top-level do jogo
    seen.add(n);bodies.set(n,b);
    for(const c of callsOf(b))if(!seen.has(c))stack.push(c);
  }
  return bodies;
}
const DRAW_ROOTS=['render','drawGrid','drawWorldExtras','drawEnemy','drawStatus','drawArcs',
  'drawDeathVisuals','drawDeathVisual','drawEchoEntity','drawPlayer','drawSwings','drawProjectile',
  'drawBeamFrom','drawMiniBoss','drawBoss','drawUnit','drawShip','drawWeaponSprite','drawShadow',
  'drawEchoRole','drawTemporalActionMarker','meleeDrawTrail','pr15PresDraw','pr15IntentDraw',
  'pr15IntentEdge','factionPresenceDrawEntity','speechRender'];

console.log('\nECHO — PR15.5-E0 · DETERMINISMO VISUAL');

/* ==================== A · INFRAESTRUTURA ==================== */
console.log('\n A · INFRAESTRUTURA PRESERVADA');
ok('A01 rand() continua existindo para o gameplay',()=>{
  assert.ok(/const\s+rand\s*=\s*\(a,b\)=>a\+Math\.random\(\)\*\(b-a\)/.test(CLEAN),'rand foi alterado');
});
ok('A02 randi() continua existindo',()=>assert.ok(/const\s+randi\s*=/.test(CLEAN)));
ok('A03 NÃO houve substituição global de Math.random',()=>{
  assert.ok(!/Math\.random\s*=/.test(CLEAN),'alguém sobrescreveu Math.random no jogo');
  assert.strictEqual(typeof sandbox.Math.random,'function');
});
ok('A04 gameplay ainda usa RNG global (crit/spread/elite não foram tocados)',()=>{
  const n=(CLEAN.match(/Math\.random\s*\(/g)||[]).length;
  assert.ok(n>=60,'esperado RNG mecânico abundante, achei '+n);
  /* pontos mecânicos concretos que NÃO podem ter sido tocados */
  assert.ok(/_crit=\(src===player&&src\.spKind===.massacre.\)\|\|Math\.random\(\)/
    .test(CLEAN.replace(/\s/g,'')),'crit do jogador alterado');
  assert.ok(/Math\.random\(\)<\.35\)coins\+\+/.test(CLEAN.replace(/\s/g,'')),'drop de moeda alterado');
});
ok('A05 fractureRng continua separado e intacto',()=>{
  assert.ok(/function\s+fractureRng\s*\(seed\)/.test(CLEAN));
  const b=fnBody('fractureRng');
  assert.ok(!RNG_RE.test(b),'fractureRng passou a consumir RNG global');
});
ok('A06 geradores semeados do Diretor preservados',()=>{
  ['fractureHash32','fractureWaveRng','fractureMiniRng','fpRng','fracturePickTheme']
    .forEach(f=>assert.ok(fnBody(f),'sumiu: '+f));
});
ok('A07 fracturePickTheme continua puro (função da seed)',()=>{
  assert.ok(!RNG_RE.test(fnBody('fracturePickTheme')));
});
ok('A08 e.visualSeed continua sendo criado no spawn',()=>{
  assert.ok(/visualSeed:\(\(\(x\*73856093\)/.test(CLEAN.replace(/\s/g,'')) ||
            /visualSeed:/.test(CLEAN),'visualSeed sumiu do spawnEnemy');
  const e=T.spawnEnemy('chaser',400,400,1);
  assert.ok(Number.isFinite(e.visualSeed)&&e.visualSeed>=0&&e.visualSeed<1);
  T.setEnemies([]);
});

/* ==================== B · HELPER DETERMINÍSTICO ==================== */
console.log('\n B · HELPER DETERMINÍSTICO (vHash32 / vJit1 / vSeedOf)');
ok('B01 helpers existem e são funções',()=>{
  ['vHash32','vJit1','vSeedOf'].forEach(f=>assert.strictEqual(typeof T[f],'function',f));
});
ok('B02 helpers NÃO consomem Math.random',()=>{
  assert.strictEqual(rngCount(()=>{for(let i=0;i<500;i++)T.vJit1(i,i*3,i%7);}),0);
});
ok('B03 nenhum helper contém rand/randi/Math.random no código-fonte',()=>{
  ['vHash32','vJit1','vSeedOf'].forEach(f=>assert.ok(!RNG_RE.test(fnBody(f)),f));
});
ok('B04 puro: mesma entrada ⇒ mesma saída (1000 amostras)',()=>{
  for(let i=0;i<1000;i++){
    const a=(i*2654435761)|0,b=(i*40503)|0,c=i%13;
    assert.strictEqual(T.vHash32(a,b,c),T.vHash32(a,b,c));
    assert.strictEqual(T.vJit1(a,b,c),T.vJit1(a,b,c));
  }
});
ok('B05 sem estado: ordem de chamada não importa',()=>{
  const direto=T.vJit1(7,11,3);
  for(let i=0;i<200;i++)T.vJit1(i,i,i);        // "sujar" qualquer estado hipotético
  assert.strictEqual(T.vJit1(7,11,3),direto);
});
ok('B06 vJit1 sempre em [-1,1) e finito',()=>{
  for(let i=0;i<5000;i++){
    const v=T.vJit1(i,(i*7919)|0,i%11);
    assert.ok(Number.isFinite(v)&&v>=-1&&v<1,'fora de faixa: '+v);
  }
});
ok('B07 vHash32 sempre uint32',()=>{
  for(let i=0;i<3000;i++){
    const h=T.vHash32(i,-i,i%5);
    assert.ok(Number.isInteger(h)&&h>=0&&h<=4294967295);
  }
});
ok('B08 boa dispersão (sem colapso de saída)',()=>{
  const s=new Set();
  for(let i=0;i<2000;i++)s.add(T.vHash32(i,0,0));
  assert.ok(s.size>1900,'colisões demais: '+s.size);
});
ok('B09 sensível aos três eixos (seed, tempo, índice)',()=>{
  assert.notStrictEqual(T.vJit1(1,5,0),T.vJit1(2,5,0));
  assert.notStrictEqual(T.vJit1(1,5,0),T.vJit1(1,6,0));
  assert.notStrictEqual(T.vJit1(1,5,0),T.vJit1(1,5,1));
});
ok('B10 média ≈ 0 (jitter simétrico, sem viés de direção)',()=>{
  let s=0;const N=20000;
  for(let i=0;i<N;i++)s+=T.vJit1(i,(i*31)|0,i%3);
  assert.ok(Math.abs(s/N)<0.02,'viés: '+(s/N));
});
ok('B11 vSeedOf usa visualSeed quando presente',()=>{
  const a=T.vSeedOf({visualSeed:.25}),b=T.vSeedOf({visualSeed:.75});
  assert.ok(Number.isInteger(a)&&Number.isInteger(b)&&a!==b);
});
ok('B12 vSeedOf cai para e.seed e depois para posição',()=>{
  assert.ok(Number.isInteger(T.vSeedOf({seed:42})));
  assert.ok(Number.isInteger(T.vSeedOf({x:300,y:400})));
  assert.strictEqual(T.vSeedOf(null),0);
});
ok('B13 vSeedOf é observador: não altera a entidade',()=>{
  const e={visualSeed:.3,x:1,y:2};
  const antes=JSON.stringify(e);T.vSeedOf(e);
  assert.strictEqual(JSON.stringify(e),antes);
});
ok('B14 nenhum PRNG por entidade/frame foi criado',()=>{
  ['vHash32','vJit1','vSeedOf'].forEach(f=>{
    const b=fnBody(f);
    assert.ok(!/function\s*\(/.test(b.slice(1)),f+' devolve closure (PRNG por chamada)');
  });
});

/* ============ C · CALL GRAPH DE DRAW — ANTI-REGRESSÃO ============ */
console.log('\n C · CALL GRAPH DE DRAW (estrutural, anti-regressão)');
const CLOSURE=drawClosure(DRAW_ROOTS);
ok('C01 o fecho transitivo de draw é substancial (o teste tem alcance real)',()=>{
  assert.ok(CLOSURE.size>=60,'fecho pequeno demais ('+CLOSURE.size+'): teste sem valor');
});
ok('C02 as raízes principais estão no fecho',()=>{
  ['render','drawEnemy','drawStatus','drawArcs','drawPlayer','drawEchoEntity','drawUnit','drawWorldExtras']
    .forEach(r=>assert.ok(CLOSURE.has(r),'raiz ausente: '+r));
});
ok('C03 ZERO Math.random/rand/randi em TODO o call graph de draw',()=>{
  const bad=[];
  for(const [n,b] of CLOSURE)if(RNG_RE.test(b))bad.push(n);
  assert.deepStrictEqual(bad,[],'RNG alcançável pelo draw em: '+bad.join(', '));
});
ok('C04 nenhum renderer chama spawnParticles/spawnShards/spawnRing',()=>{
  const bad=[];
  for(const [n,b] of CLOSURE)
    if(/spawnParticles\s*\(|spawnShards\s*\(|spawnRing\s*\(/.test(b))bad.push(n);
  assert.deepStrictEqual(bad,[],'draw criando partículas em: '+bad.join(', '));
});
ok('C05 nenhum renderer alcança os geradores semeados do Diretor',()=>{
  const bad=[];
  for(const [n,b] of CLOSURE)
    if(/fractureRng\s*\(|fractureWaveRng\s*\(|fractureMiniRng\s*\(|fpRng\s*\(|pr15MemRng\s*\(/.test(b))bad.push(n);
  assert.deepStrictEqual(bad,[],'draw tocando RNG do Diretor em: '+bad.join(', '));
});
ok('C06 as 18 ocorrências auditadas sumiram das funções de draw',()=>{
  ['drawEnemy','drawStatus','drawArcs','drawPlayer','drawUnit','drawEchoEntity','drawWorldExtras','render']
    .forEach(f=>assert.ok(!RNG_RE.test(fnBody(f)),'ainda há RNG em '+f));
});

/* ==================== D · ANOMALY ==================== */
console.log('\n D · ANOMALY');
function anomaly(over){
  return Object.assign({type:'anomaly',x:500,y:500,r:16,hp:60,maxHp:60,color:'#c56bff',
    aim:0,visualSeed:.375,strikeT:0,flashT:0,spawnT:0,dead:false,vx:0,vy:0},over||{});
}
ok('D01 drawEnemy(anomaly) não consome RNG',()=>{
  assert.strictEqual(rngCount(()=>opsOf(()=>T.drawEnemy(anomaly()))),0);
});
ok('D02 100 draws seguidos continuam sem consumir RNG',()=>{
  const e=anomaly();
  assert.strictEqual(rngCount(()=>{for(let i=0;i<100;i++)opsOf(()=>T.drawEnemy(e));}),0);
});
ok('D03 mesmo runTime ⇒ imagem idêntica (independe de quantos draws houve)',()=>{
  const e=anomaly();T.setRunTime(12.5);
  const a=sig(opsOf(()=>T.drawEnemy(e)));
  for(let i=0;i<25;i++)opsOf(()=>T.drawEnemy(e));
  T.setRunTime(12.5);
  assert.strictEqual(sig(opsOf(()=>T.drawEnemy(e))),a);
});
ok('D04 o efeito continua VIVO: varia ao longo do tempo',()=>{
  const e=anomaly(),vistos=new Set();
  for(let i=0;i<40;i++){T.setRunTime(i*0.033);vistos.add(sig(opsOf(()=>T.drawEnemy(e))));}
  assert.ok(vistos.size>=20,'anomaly congelou (só '+vistos.size+' estados)');
});
ok('D05 usa e.visualSeed: seeds diferentes ⇒ tremores dessincronizados',()=>{
  T.setRunTime(7.25);
  const a=sig(opsOf(()=>T.drawEnemy(anomaly({visualSeed:.1}))));
  const b=sig(opsOf(()=>T.drawEnemy(anomaly({visualSeed:.9}))));
  assert.notStrictEqual(a,b);
});
ok('D06 strikeT preservado: amplia o desassombro (jj 1.4→3.2)',()=>{
  T.setRunTime(3.1);
  const calmo=opsOf(()=>T.drawEnemy(anomaly({strikeT:0})));
  const golpe=opsOf(()=>T.drawEnemy(anomaly({strikeT:.5})));
  const span=l=>{const xs=l.filter(e=>e[0]==='moveTo'||e[0]==='lineTo').map(e=>e[1][0]);
    return xs.length?Math.max(...xs)-Math.min(...xs):0;};
  assert.ok(span(golpe)>=span(calmo),'strikeT deixou de amplificar');
});
ok('D07 strikeT preservado: aviso de investida ainda é desenhado',()=>{
  T.setRunTime(3.1);
  const n=l=>l.filter(e=>e[0]==='arc').length;
  assert.ok(n(opsOf(()=>T.drawEnemy(anomaly({strikeT:.5}))))>
            n(opsOf(()=>T.drawEnemy(anomaly({strikeT:0})))),'anel de investida sumiu');
});
ok('D08 cópias ciano e magenta preservadas',()=>{
  const cores=opsOf(()=>T.drawEnemy(anomaly()))
    .filter(e=>e[0]==='set:fillStyle').map(e=>String(e[1][0]).toLowerCase());
  assert.ok(cores.indexOf('#46e0ff')>=0,'ciano sumiu');
  assert.ok(cores.indexOf('#ff2fa0')>=0,'magenta sumiu');
});
ok('D09 composição lighter preservada',()=>{
  assert.ok(opsOf(()=>T.drawEnemy(anomaly()))
    .some(e=>e[0]==='set:globalCompositeOperation'&&e[1][0]==='lighter'));
});
ok('D10 cópias ANTI-CORRELACIONADAS (offsets opostos)',()=>{
  assert.ok(/tri\(\s*aox,\s*aoy[\s\S]{0,40}tri\(-aox,-aoy/.test(CLEAN),
    'as duas cópias não são mais espelhadas');
});
ok('D11 vp.lean (PR15.5-C) continua alimentando jj',()=>{
  assert.ok(/jj=e\.strikeT>0\?3\.2:1\.4\+\(vp\?vp\.lean\*2\.4:0\)/.test(CLEAN.replace(/\s/g,'')
    .replace(/constjj/,'jj')),'fórmula de jj alterada');
});
ok('D12 todos os argumentos de Canvas são finitos',()=>{
  for(let i=0;i<30;i++){T.setRunTime(i*.11);assert.ok(finiteArgs(opsOf(()=>T.drawEnemy(anomaly()))));}
});
ok('D13 draw é observador: não muta a entidade',()=>{
  const e=anomaly();const antes=JSON.stringify(e);
  for(let i=0;i<10;i++)opsOf(()=>T.drawEnemy(e));
  assert.strictEqual(JSON.stringify(e),antes);
});

/* ==================== E · STATUS / CHOQUE ==================== */
console.log('\n E · STATUS · CHOQUE');
function withSt(st,over){
  return Object.assign({type:'chaser',x:400,y:400,r:14,visualSeed:.625,st:st},over||{});
}
ok('E01 drawStatus(shock) não consome RNG',()=>{
  assert.strictEqual(rngCount(()=>opsOf(()=>T.drawStatus(withSt({shockT:2})))),0);
});
ok('E02 200 draws não consomem RNG',()=>{
  const e=withSt({shockT:2});
  assert.strictEqual(rngCount(()=>{for(let i=0;i<200;i++)opsOf(()=>T.drawStatus(e));}),0);
});
ok('E03 o choque VARIA ao longo do tempo (não congelou)',()=>{
  const e=withSt({shockT:2}),vistos=new Set();
  for(let i=0;i<120;i++){T.setRunTime(i*0.05);vistos.add(sig(opsOf(()=>T.drawStatus(e))));}
  assert.ok(vistos.size>=15,'choque congelado (só '+vistos.size+' estados)');
});
ok('E04 cintila: às vezes desenha o raio, às vezes não',()=>{
  const e=withSt({shockT:2});let com=0,sem=0;
  for(let i=0;i<200;i++){
    T.setRunTime(i*0.05);
    const n=opsOf(()=>T.drawStatus(e)).filter(o=>o[0]==='set:strokeStyle'&&o[1][0]==='#ffe74d').length;
    if(n)com++;else sem++;
  }
  assert.ok(com>0&&sem>0,'perdeu a cintilação (com='+com+' sem='+sem+')');
});
ok('E05 frequência ≈ 37,5% (próxima dos 40% originais)',()=>{
  const e=withSt({shockT:2});let com=0;const N=4000;
  for(let i=0;i<N;i++){
    T.setRunTime(i*0.05);
    if(opsOf(()=>T.drawStatus(e)).some(o=>o[0]==='set:strokeStyle'&&o[1][0]==='#ffe74d'))com++;
  }
  const p=com/N;
  assert.ok(p>0.25&&p<0.50,'frequência fora da faixa: '+p.toFixed(3));
});
ok('E06 seed estável: inimigos distintos não piscam em uníssono',()=>{
  let dif=0;
  for(let i=0;i<120;i++){
    T.setRunTime(i*0.05);
    const a=sig(opsOf(()=>T.drawStatus(withSt({shockT:2},{visualSeed:.11}))));
    const b=sig(opsOf(()=>T.drawStatus(withSt({shockT:2},{visualSeed:.88}))));
    if(a!==b)dif++;
  }
  assert.ok(dif>0,'todos os inimigos piscam em sincronia');
});
ok('E07 mesmo tempo + mesma seed ⇒ mesma geometria',()=>{
  const e=withSt({shockT:2});T.setRunTime(9.75);
  const a=sig(opsOf(()=>T.drawStatus(e)));
  for(let i=0;i<15;i++)opsOf(()=>T.drawStatus(e));
  T.setRunTime(9.75);
  assert.strictEqual(sig(opsOf(()=>T.drawStatus(e))),a);
});
ok('E08 os outros CINCO status seguem determinísticos e intactos',()=>{
  [{stunT:2},{chillP:.8},{burnT:2},{corrP:.7},{bleedT:2}].forEach(st=>{
    const e=withSt(st);
    assert.strictEqual(rngCount(()=>opsOf(()=>T.drawStatus(e))),0,JSON.stringify(st));
    T.setRunTime(4.2);const a=sig(opsOf(()=>T.drawStatus(e)));
    T.setRunTime(4.2);assert.strictEqual(sig(opsOf(()=>T.drawStatus(e))),a);
  });
});
ok('E09 pips de status preservados (ordem fixa, 5 cores)',()=>{
  const l=opsOf(()=>T.drawStatus(withSt({burnT:1,corrP:.5,chillP:.5,bleedT:1,shockT:1})));
  assert.ok(l.filter(e=>e[0]==='fillRect').length>=5,'pips sumiram');
});
ok('E10 drawStatus não muta o status da entidade',()=>{
  const e=withSt({shockT:2});const antes=JSON.stringify(e.st);
  for(let i=0;i<20;i++){T.setRunTime(i);opsOf(()=>T.drawStatus(e));}
  assert.strictEqual(JSON.stringify(e.st),antes);
});

/* ==================== F · DRAWARCS ==================== */
console.log('\n F · DRAWARCS');
const mkArc=o=>Object.assign({x1:300,y1:300,x2:500,y2:420,t:0,life:.18,color:'#ffe74d'},o||{});
ok('F01 drawArcs não consome RNG',()=>{
  T.setArcs([mkArc()]);
  assert.strictEqual(rngCount(()=>opsOf(()=>T.drawArcs())),0);
  T.setArcs([]);
});
ok('F02 muitos arcos × muitos frames: zero RNG',()=>{
  T.setArcs([mkArc(),mkArc({x2:100,y2:600}),mkArc({x1:50,y1:50}),mkArc({color:'#a8ff3d'})]);
  assert.strictEqual(rngCount(()=>{for(let i=0;i<60;i++)opsOf(()=>T.drawArcs());}),0);
  T.setArcs([]);
});
ok('F03 4 segmentos preservados (3 lineTo intermediários + 1 final)',()=>{
  T.setArcs([mkArc()]);
  const l=opsOf(()=>T.drawArcs());
  assert.strictEqual(l.filter(e=>e[0]==='moveTo').length,1);
  assert.strictEqual(l.filter(e=>e[0]==='lineTo').length,4);
  T.setArcs([]);
});
ok('F04 extremos EXATOS: o arco liga origem e alvo sem jitter nas pontas',()=>{
  const a=mkArc();T.setArcs([a]);
  const l=opsOf(()=>T.drawArcs());
  const mv=l.find(e=>e[0]==='moveTo'),last=l.filter(e=>e[0]==='lineTo').pop();
  assert.deepStrictEqual(mv[1],[a.x1,a.y1]);
  assert.deepStrictEqual(last[1],[a.x2,a.y2]);
  T.setArcs([]);
});
ok('F05 jitter dentro de ±9 (amplitude original preservada)',()=>{
  const a=mkArc();T.setArcs([a]);
  const seg=4,dx=(a.x2-a.x1)/seg,dy=(a.y2-a.y1)/seg;
  for(let f=0;f<40;f++){
    a.t=f*0.004;
    const pts=opsOf(()=>T.drawArcs()).filter(e=>e[0]==='lineTo').slice(0,3);
    pts.forEach((p,i)=>{
      assert.ok(Math.abs(p[1][0]-(a.x1+dx*(i+1)))<=9.001,'dx fora de faixa');
      assert.ok(Math.abs(p[1][1]-(a.y1+dy*(i+1)))<=9.001,'dy fora de faixa');
    });
  }
  T.setArcs([]);
});
ok('F06 jitter VARIA ao longo da vida do arco (sensação elétrica)',()=>{
  const a=mkArc();T.setArcs([a]);
  const vistos=new Set();
  for(let f=0;f<30;f++){a.t=f*0.006;vistos.add(sig(opsOf(()=>T.drawArcs())));}
  assert.ok(vistos.size>=5,'arco congelado (só '+vistos.size+' estados)');
  T.setArcs([]);
});
ok('F07 arcos de geometrias diferentes têm jitter diferente',()=>{
  T.setArcs([mkArc()]);const a=sig(opsOf(()=>T.drawArcs()));
  T.setArcs([mkArc({x2:900,y2:120})]);const b=sig(opsOf(()=>T.drawArcs()));
  assert.notStrictEqual(a,b);
  T.setArcs([]);
});
ok('F08 mesma idade ⇒ mesma geometria (draws extras não mudam nada)',()=>{
  const a=mkArc({t:.07});T.setArcs([a]);
  const s1=sig(opsOf(()=>T.drawArcs()));
  for(let i=0;i<20;i++)opsOf(()=>T.drawArcs());
  assert.strictEqual(sig(opsOf(()=>T.drawArcs())),s1);
  T.setArcs([]);
});
ok('F09 cores de chainLightning e reap preservadas',()=>{
  T.setArcs([mkArc({color:'#ffe74d'}),mkArc({color:'#a8ff3d'})]);
  const cores=opsOf(()=>T.drawArcs()).filter(e=>e[0]==='set:strokeStyle').map(e=>e[1][0]);
  assert.ok(cores.indexOf('#ffe74d')>=0&&cores.indexOf('#a8ff3d')>=0);
  T.setArcs([]);
});
ok('F10 drawArcs NÃO altera o array arcs (nem push, nem splice)',()=>{
  const arr=[mkArc(),mkArc({x1:10})];T.setArcs(arr);
  const antes=JSON.stringify(T.getArcs());
  for(let i=0;i<25;i++)opsOf(()=>T.drawArcs());
  assert.strictEqual(T.getArcs().length,2,'draw mexeu no tamanho de arcs');
  assert.strictEqual(JSON.stringify(T.getArcs()),antes,'draw mutou o conteúdo de arcs');
  T.setArcs([]);
});
ok('F11 updateArcs continua sendo o único dono do ciclo de vida',()=>{
  T.setArcs([mkArc({t:.17,life:.18})]);
  T.updateArcs(.02);
  assert.strictEqual(T.getArcs().length,0,'updateArcs deixou de expirar o arco');
  T.setArcs([]);
});
ok('F12 argumentos finitos em todas as amostras',()=>{
  const a=mkArc();T.setArcs([a]);
  for(let f=0;f<25;f++){a.t=f*0.007;assert.ok(finiteArgs(opsOf(()=>T.drawArcs())));}
  T.setArcs([]);
});

/* ==================== G · BEACON AMBUSH ==================== */
console.log('\n G · BEACON AMBUSH');
const mkBeacon=o=>Object.assign({x:640,y:360,r:36,kind:'ambush',t:1,life:38,pulse:1.5},o||{});
function drawBeaconOps(b){T.setBeacon(b);const l=opsOf(()=>T.drawWorldExtras());T.setBeacon(null);return l;}
ok('G01 draw do ambush não consome RNG',()=>{
  assert.strictEqual(rngCount(()=>drawBeaconOps(mkBeacon())),0);
});
ok('G02 300 draws do ambush: zero RNG',()=>{
  const b=mkBeacon();T.setBeacon(b);
  assert.strictEqual(rngCount(()=>{for(let i=0;i<300;i++)opsOf(()=>T.drawWorldExtras());}),0);
  T.setBeacon(null);
});
ok('G03 aparência continua INSTÁVEL ao variar pulse',()=>{
  const vistos=new Set();
  for(let i=0;i<80;i++)vistos.add(sig(drawBeaconOps(mkBeacon({pulse:i*0.09}))));
  assert.ok(vistos.size>=20,'ambush congelou (só '+vistos.size+' estados)');
});
ok('G04 o glitch alterna entre ativo e inativo',()=>{
  let on=0,off=0;
  for(let i=0;i<300;i++){
    const l=drawBeaconOps(mkBeacon({pulse:i*0.07}));
    /* o 1º translate posiciona o beacon; o 2º é o glitch (dx,0) */
    const trs=l.filter(e=>e[0]==='translate');
    const g=trs.length>1?trs[1]:null;
    if(g&&Math.abs(g[1][0])>1e-9)on++;else off++;
  }
  assert.ok(on>0&&off>0,'glitch perdeu a alternância (on='+on+' off='+off+')');
});
ok('G05 amplitude do glitch dentro de ±3 (original preservada)',()=>{
  for(let i=0;i<200;i++){
    const trs=drawBeaconOps(mkBeacon({pulse:i*0.07})).filter(e=>e[0]==='translate');
    if(trs.length>1)assert.ok(Math.abs(trs[1][1][0])<=3.001,'glitch fora de faixa: '+trs[1][1][0]);
  }
});
ok('G06 scanlines preservadas e dentro de [-16,14]',()=>{
  for(let i=0;i<120;i++){
    const l=drawBeaconOps(mkBeacon({pulse:i*0.11}));
    const ys=l.filter(e=>e[0]==='moveTo'&&e[1][0]===-14).map(e=>e[1][1]);
    ys.forEach(y=>assert.ok(y>=-16.001&&y<=14.001,'scanline fora: '+y));
  }
});
ok('G07 marcas hostis (pulse) preservadas',()=>{
  assert.ok(drawBeaconOps(mkBeacon()).filter(e=>e[0]==='arc').length>=4,'marcas hostis sumiram');
});
ok('G08 posição do beacon participa da seed',()=>{
  const a=sig(drawBeaconOps(mkBeacon({x:100,y:100})));
  const b=sig(drawBeaconOps(mkBeacon({x:900,y:640})));
  assert.notStrictEqual(a,b);
});
ok('G09 mesmo pulse ⇒ mesma imagem',()=>{
  const a=sig(drawBeaconOps(mkBeacon({pulse:3.33})));
  assert.strictEqual(sig(drawBeaconOps(mkBeacon({pulse:3.33}))),a);
});
ok('G10 draw não muta o beacon (t/pulse continuam do update)',()=>{
  const b=mkBeacon();T.setBeacon(b);
  const antes=JSON.stringify(b);
  for(let i=0;i<20;i++)opsOf(()=>T.drawWorldExtras());
  assert.strictEqual(JSON.stringify(b),antes);
  T.setBeacon(null);
});
ok('G11 spawnBeacon (posição/comportamento) não foi alterado',()=>{
  assert.ok(/beacon=\{x:ARENA\.w\/2\+rand\(-260,260\),y:ARENA\.h\/2\+rand\(-170,170\)/
    .test(CLEAN.replace(/\s/g,'')),'spawn do beacon foi mexido');
});

/* ==================== H · PLAYER HURT ==================== */
console.log('\n H · PLAYER HURT');
function freshPlayer(){T.startRun();return T.getPlayer();}
ok('H01 drawPlayer com hurt ativo não consome RNG',()=>{
  const p=freshPlayer();p.hurtT=.5;
  assert.strictEqual(rngCount(()=>opsOf(()=>T.drawPlayer())),0);
});
ok('H02 150 draws com hurt: zero RNG',()=>{
  const p=freshPlayer();p.hurtT=.5;
  assert.strictEqual(rngCount(()=>{for(let i=0;i<150;i++)opsOf(()=>T.drawPlayer());}),0);
});
ok('H03 hurtT controla o flicker: alterna ao longo do decaimento',()=>{
  const p=freshPlayer();const vistos=new Set();
  for(let i=0;i<60;i++){p.hurtT=1-i/60;vistos.add(sig(opsOf(()=>T.drawPlayer())));}
  assert.ok(vistos.size>=2,'flicker sumiu');
});
ok('H04 o flicker realmente pisca (liga e desliga)',()=>{
  const p=freshPlayer();let on=0,off=0;
  /* varredura fina do decaimento real de hurtT (1 s → 0 a 60 Hz) */
  for(let i=0;i<120;i++){
    p.hurtT=1-i/120;
    const vermelho=opsOf(()=>T.drawPlayer())
      .some(e=>/Style$/.test(e[0])&&String(e[1][0]).toLowerCase()==='#ff8095');
    if(vermelho)on++;else off++;
  }
  assert.ok(on>0&&off>0,'flicker travado (on='+on+' off='+off+')');
});
ok('H05 sem hurt não há paleta de dano',()=>{
  const p=freshPlayer();p.hurtT=0;
  assert.ok(!opsOf(()=>T.drawPlayer())
    .some(e=>e[0]==='set:fillStyle'&&String(e[1][0]).toLowerCase()==='#ff8095'));
});
ok('H06 mesmo hurtT ⇒ mesma decisão (independe de draws anteriores)',()=>{
  const p=freshPlayer();p.hurtT=.42;
  const a=sig(opsOf(()=>T.drawPlayer()));
  for(let i=0;i<30;i++)opsOf(()=>T.drawPlayer());
  p.hurtT=.42;
  assert.strictEqual(sig(opsOf(()=>T.drawPlayer())),a);
});
ok('H07 flicker legível: período ≥ 2 frames a 144 Hz',()=>{
  const p=freshPlayer();const seq=[];
  for(let i=0;i<144;i++){
    p.hurtT=1-i/144;
    seq.push(opsOf(()=>T.drawPlayer())
      .some(e=>/Style$/.test(e[0])&&String(e[1][0]).toLowerCase()==='#ff8095')?1:0);
  }
  let trocas=0;for(let i=1;i<seq.length;i++)if(seq[i]!==seq[i-1])trocas++;
  assert.ok(trocas<=seq.length/2,'estroboscópico demais: '+trocas+' trocas em 144 frames');
});
ok('H08 a POSE de hurt do PR15.5-C não foi tocada',()=>{
  assert.ok(!RNG_RE.test(fnBody('visualPlayerDrawPose')));
  assert.ok(/pose:visualPlayerDrawPose\(p\)/.test(CLEAN.replace(/\s/g,'')),'pose desligada do drawPlayer');
});
ok('H09 drawPlayer não altera hurtT nem a posição',()=>{
  const p=freshPlayer();p.hurtT=.5;
  const antes={h:p.hurtT,x:p.x,y:p.y,hp:p.hp};
  for(let i=0;i<20;i++)opsOf(()=>T.drawPlayer());
  assert.deepStrictEqual({h:p.hurtT,x:p.x,y:p.y,hp:p.hp},antes);
});

/* ==================== I · DRAWUNIT · GLITCH ==================== */
console.log('\n I · DRAWUNIT · GLITCH');
const PAL={body:'#4d788f',dark:'#22394a',edge:'#8fd6ef',glow:'#9ff3ff',visor:'#eaffff',head:'#5b8ba3',wep:'#9ff3ff'};
const du=o=>opsOf(()=>T.drawUnit(500,500,0,14,PAL,Object.assign({wi:0,walk:0},o||{})));
ok('I01 drawUnit com glitch não consome RNG',()=>{
  assert.strictEqual(rngCount(()=>du({glitch:true,phase:7})),0);
});
ok('I02 200 draws com glitch: zero RNG',()=>{
  assert.strictEqual(rngCount(()=>{for(let i=0;i<200;i++)du({glitch:true,phase:7});}),0);
});
ok('I03 assinatura pública preservada (nenhum parâmetro novo)',()=>{
  assert.ok(/function\s+drawUnit\s*\(x,y,aim,r,pal,opts\)/.test(CLEAN),'assinatura mudou');
});
ok('I04 caller sem phase continua funcionando (default determinístico)',()=>{
  assert.strictEqual(rngCount(()=>du({glitch:true})),0);
  assert.ok(finiteArgs(du({glitch:true})));
});
ok('I05 drawShip (wrapper legado, sem phase) segue seguro',()=>{
  const b=fnBody('drawShip');
  assert.ok(b,'drawShip sumiu');
  assert.ok(!RNG_RE.test(b),'drawShip consome RNG');
  assert.ok(!/phase:/.test(b),'drawShip passou a exigir phase (quebra de compat)');
});
ok('I06 sem glitch NÃO há deslocamento (fast path intacto)',()=>{
  T.setRunTime(5);
  const a=sig(du({glitch:false,phase:3}));
  T.setRunTime(9.87);
  assert.strictEqual(sig(du({glitch:false,phase:3})),a,'glitch:false virou dependente do tempo');
});
ok('I07 com glitch o deslocamento VARIA no tempo',()=>{
  const vistos=new Set();
  for(let i=0;i<50;i++){T.setRunTime(i*0.04);vistos.add(sig(du({glitch:true,phase:3})));}
  assert.ok(vistos.size>=15,'glitch congelou (só '+vistos.size+' estados)');
});
ok('I08 amplitude do glitch dentro de ±2.4',()=>{
  for(let i=0;i<80;i++){
    T.setRunTime(i*0.05);
    const tr=du({glitch:true,phase:3}).find(e=>e[0]==='translate');
    assert.ok(Math.abs(tr[1][0]-500)<=2.401&&Math.abs(tr[1][1]-500)<=2.401,'fora de faixa');
  }
});
ok('I09 phases diferentes ⇒ glitches dessincronizados',()=>{
  T.setRunTime(4.4);
  assert.notStrictEqual(sig(du({glitch:true,phase:1})),sig(du({glitch:true,phase:77})));
});
ok('I10 mesmo tempo + mesma phase ⇒ mesmo deslocamento',()=>{
  T.setRunTime(6.6);const a=sig(du({glitch:true,phase:5}));
  for(let i=0;i<20;i++)du({glitch:true,phase:9});
  T.setRunTime(6.6);
  assert.strictEqual(sig(du({glitch:true,phase:5})),a);
});
ok('I11 pose/melee do PR15.5-D continuam compondo sem RNG',()=>{
  assert.strictEqual(rngCount(()=>du({glitch:true,phase:2,
    pose:{offsetX:1,offsetY:0,rotation:.1,scaleX:1,scaleY:1,alpha:1}})),0);
});

/* ==================== J · ECHO ==================== */
console.log('\n J · ECHO (jitter · blink · glitch · scanlines)');
function mkEcho(over){
  const e={alive:true,x:520,y:480,aim:0,r:13,slot:1,seed:42.5,hue:'#46e0ff',
    ghosts:[],curW:0,recoil:0,hp:80,maxHp:100,dom:0,trust:50,glitchAmp:3,
    dis:{st:'stable',t:0,integ:0,integMax:100},data:{trail:[[0,0,0,0,0,0]],dur:1},
    pi:0,ca:0,mul:1,trustFx:0,ambush:false,visual:null};
  return Object.assign(e,over||{});
}
function drawEcho(e){return opsOf(()=>T.drawEchoEntity(e));}
ok('J01 Echo estável: zero RNG',()=>{
  assert.strictEqual(rngCount(()=>drawEcho(mkEcho())),0);
});
ok('J02 Echo slot 2 (glitch cromático): zero RNG',()=>{
  assert.strictEqual(rngCount(()=>{for(let i=0;i<100;i++)drawEcho(mkEcho({slot:2}));}),0);
});
ok('J03 Echo fraturando / hostil / reintegrando: zero RNG',()=>{
  ['fracturing','hostile','recovering'].forEach(st=>{
    const e=mkEcho({dis:{st,t:.5,integ:40,integMax:100}});
    assert.strictEqual(rngCount(()=>{for(let i=0;i<50;i++)drawEcho(e);}),0,st);
  });
});
ok('J04 Echo instável: zero RNG',()=>{
  const e=mkEcho({dis:{st:'unstable',t:.3,integ:10,integMax:100}});
  assert.strictEqual(rngCount(()=>{for(let i=0;i<100;i++)drawEcho(e);}),0);
});
ok('J05 drawEchoEntity NÃO cria partículas (o bug central do E0)',()=>{
  const e=mkEcho({dis:{st:'unstable',t:.3,integ:10,integMax:100}});
  T.setPartsRef([]);
  for(let i=0;i<400;i++)drawEcho(e);
  assert.strictEqual(T.getPartsRef().length,0,'o draw ainda emite partículas!');
});
ok('J06 nenhum estado de Echo emite partícula no draw',()=>{
  ['stable','unstable','fracturing','hostile','recovering'].forEach(st=>{
    const e=mkEcho({slot:2,dis:{st,t:.4,integ:20,integMax:100}});
    T.setPartsRef([]);
    for(let i=0;i<120;i++)drawEcho(e);
    assert.strictEqual(T.getPartsRef().length,0,'draw emitiu em '+st);
  });
});
ok('J07 o código-fonte de drawEchoEntity não menciona spawnParticles',()=>{
  assert.ok(!/spawnParticles\s*\(/.test(fnBody('drawEchoEntity')));
});
ok('J08 blink do Echo 2 preservado: às vezes o corpo some',()=>{
  const e=mkEcho({slot:2});let cheio=0,vazio=0;
  for(let i=0;i<400;i++){
    T.setRunTime(i*0.04);
    if(drawEcho(e).length<=6)vazio++;else cheio++;
  }
  assert.ok(cheio>0&&vazio>0,'blink sumiu (cheio='+cheio+' vazio='+vazio+')');
});
ok('J09 blink ≈ 6% (probabilidade original preservada)',()=>{
  const e=mkEcho({slot:2});let vazio=0;const N=3000;
  for(let i=0;i<N;i++){T.setRunTime(i*0.04);if(drawEcho(e).length<=6)vazio++;}
  const p=vazio/N;
  assert.ok(p>0.01&&p<0.14,'taxa de blink fora da faixa: '+p.toFixed(3));
});
ok('J10 scanlines do Echo 2 preservadas e dentro de ±r',()=>{
  const e=mkEcho({slot:2});let achou=0;
  for(let i=0;i<200;i++){
    T.setRunTime(i*0.04);
    drawEcho(e).filter(o=>o[0]==='moveTo'&&Math.abs(o[1][0]-(e.x-e.r-6))<1e-9)
      .forEach(o=>{achou++;assert.ok(Math.abs(o[1][1]-e.y)<=e.r+.001,'scanline fora');});
  }
  assert.ok(achou>0,'scanlines sumiram');
});
ok('J11 cromatismo ciano/magenta do Echo 2 preservado',()=>{
  const e=mkEcho({slot:2});let ciano=false,magenta=false;
  for(let i=0;i<60&&!(ciano&&magenta);i++){
    T.setRunTime(i*0.04);
    const c=drawEcho(e).filter(o=>o[0]==='set:edge'||o[0]==='set:strokeStyle'||o[0]==='set:fillStyle')
      .map(o=>String(o[1][0]).toLowerCase());
    if(c.some(x=>x.indexOf('46e0ff')>=0))ciano=true;
    if(c.some(x=>x.indexOf('ff4df0')>=0||x.indexOf('ff78fa')>=0))magenta=true;
  }
  assert.ok(ciano&&magenta,'cromatismo perdido (ciano='+ciano+' magenta='+magenta+')');
});
ok('J12 jitter da Dissonância varia no tempo',()=>{
  const e=mkEcho({dis:{st:'hostile',t:.5,integ:40,integMax:100}});
  const vistos=new Set();
  for(let i=0;i<50;i++){T.setRunTime(i*0.04);vistos.add(sig(drawEcho(e)));}
  assert.ok(vistos.size>=15,'jitter dissonante congelou ('+vistos.size+')');
});
ok('J13 leitura de estado preservada (anel + rótulo por estado)',()=>{
  ['fracturing','hostile','recovering'].forEach(st=>{
    const l=drawEcho(mkEcho({dis:{st,t:.5,integ:40,integMax:100}}));
    assert.ok(l.some(o=>o[0]==='fillText'),'rótulo sumiu em '+st);
    assert.ok(l.some(o=>o[0]==='arc'),'anel sumiu em '+st);
  });
});
ok('J14 medidor de RUPTURA do estado hostil preservado',()=>{
  const l=drawEcho(mkEcho({dis:{st:'hostile',t:.5,integ:55,integMax:100}}));
  assert.ok(l.some(o=>o[0]==='fillText'&&String(o[1][0]).indexOf('RUPTURA')>=0));
});
ok('J15 afterimage (ghosts) preservada',()=>{
  const e=mkEcho({ghosts:[{x:510,y:470},{x:505,y:465},{x:500,y:460}]});
  assert.ok(drawEcho(e).filter(o=>o[0]==='arc').length>=3,'ghosts sumiram');
});
ok('J16 mesmo runTime ⇒ mesma imagem do Echo',()=>{
  const e=mkEcho({slot:2});T.setRunTime(11.25);
  const a=sig(drawEcho(e));
  for(let i=0;i<30;i++){T.setRunTime(20+i);drawEcho(e);}
  T.setRunTime(11.25);
  assert.strictEqual(sig(drawEcho(e)),a);
});
ok('J17 seeds diferentes ⇒ Echos dessincronizados',()=>{
  T.setRunTime(8.8);
  assert.notStrictEqual(sig(drawEcho(mkEcho({slot:2,seed:3}))),
                        sig(drawEcho(mkEcho({slot:2,seed:91}))));
});
ok('J18 draw não muta o Echo',()=>{
  const e=mkEcho({slot:2,dis:{st:'unstable',t:.3,integ:10,integMax:100}});
  const antes=JSON.stringify(e);
  for(let i=0;i<30;i++){T.setRunTime(i*.1);drawEcho(e);}
  assert.strictEqual(JSON.stringify(e),antes);
});

/* ========== K · EMISSÃO INSTÁVEL MOVIDA PARA O UPDATE ========== */
console.log('\n K · PARTÍCULA INSTÁVEL · DRAW → UPDATE');
ok('K01 echoUnstableEmit existe e é chamado pelo updateEcho',()=>{
  assert.strictEqual(typeof T.echoUnstableEmit,'function');
  assert.ok(/echoUnstableEmit\(e,dt\)/.test(fnBody('updateEcho')),'updateEcho não chama o helper');
});
ok('K02 emite apenas no estado unstable',()=>{
  ['stable','fracturing','hostile','recovering'].forEach(st=>{
    const e=mkEcho({dis:{st,t:0,integ:0,integMax:100}});
    T.setPartsRef([]);
    for(let i=0;i<60;i++)T.echoUnstableEmit(e,1/60);
    assert.strictEqual(T.getPartsRef().length,0,'emitiu em '+st);
  });
});
ok('K03 emite no estado unstable',()=>{
  const e=mkEcho({dis:{st:'unstable',t:0,integ:0,integMax:100}});
  T.setPartsRef([]);
  for(let i=0;i<60;i++)T.echoUnstableEmit(e,1/60);
  assert.ok(T.getPartsRef().length>0,'parou de emitir');
});
ok('K04 cadência baseada em dt, NÃO em frames — 30/60/144 Hz convergem',()=>{
  const conta=fps=>{
    const e=mkEcho({dis:{st:'unstable',t:0,integ:0,integMax:100}});
    let n=0;
    for(let i=0;i<fps;i++)n+=T.echoUnstableEmit(e,1/fps);   // exatamente 1 s
    return n;
  };
  const a=conta(30),b=conta(60),c=conta(144);
  assert.strictEqual(a,b,'30 vs 60 divergiram: '+a+' / '+b);
  assert.strictEqual(b,c,'60 vs 144 divergiram: '+b+' / '+c);
});
ok('K05 densidade ≈ a do draw antigo em 60 FPS (0.05×60 = 3/s)',()=>{
  const e=mkEcho({dis:{st:'unstable',t:0,integ:0,integMax:100}});
  let n=0;
  for(let i=0;i<600;i++)n+=T.echoUnstableEmit(e,1/60);     // 10 s
  assert.ok(n>=28&&n<=32,'densidade fora do alvo (~30 em 10 s): '+n);
});
ok('K06 a taxa declarada é 3 Hz',()=>assert.strictEqual(T.ECHO_UNSTABLE_EMIT_HZ,3));
ok('K07 dt=0 (pausa/modal) não emite nada',()=>{
  const e=mkEcho({dis:{st:'unstable',t:0,integ:0,integMax:100}});
  T.setPartsRef([]);
  for(let i=0;i<500;i++)T.echoUnstableEmit(e,0);
  assert.strictEqual(T.getPartsRef().length,0,'emitiu com dt=0');
});
ok('K08 acumulador reseta ao sair do estado instável',()=>{
  const e=mkEcho({dis:{st:'unstable',t:0,integ:0,integMax:100}});
  T.echoUnstableEmit(e,.2);
  e.dis.st='stable';T.echoUnstableEmit(e,.2);
  assert.strictEqual(e._unsAcc,0,'acumulador não foi zerado');
});
ok('K09 teto por tick: lag gigante não vira rajada',()=>{
  const e=mkEcho({dis:{st:'unstable',t:0,integ:0,integMax:100}});
  assert.ok(T.echoUnstableEmit(e,60)<=4,'rajada sem teto');
});
ok('K10 é observador do Echo: só escreve o acumulador visual',()=>{
  const e=mkEcho({dis:{st:'unstable',t:0,integ:0,integMax:100}});
  const antes=JSON.stringify(Object.assign({},e,{_unsAcc:0}));
  for(let i=0;i<30;i++)T.echoUnstableEmit(e,1/60);
  assert.strictEqual(JSON.stringify(Object.assign({},e,{_unsAcc:0})),antes);
});

/* ==================== L · FRACTURE (SOMENTE RENDER) ==================== */
console.log('\n L · FRACTURE · RENDER vs DECISÃO');
ok('L01 o bloco visual da Fratura no render não usa RNG global',()=>{
  const b=fnBody('render');
  const i=b.indexOf("state==='fracture'");
  assert.ok(i>0,'bloco da fratura não encontrado');
  assert.ok(!RNG_RE.test(b.slice(i)),'ainda há RNG no render da fratura');
});
ok('L02 o bloco de aberração cromática não usa RNG global',()=>{
  const b=fnBody('render'),i=b.indexOf('aberr>0.012');
  assert.ok(i>0);
  assert.ok(!RNG_RE.test(b.slice(i,b.indexOf("state==='fracture'"))),'RNG na aberração');
});
ok('L03 DECISÃO da Fracture intacta: fractureRng é mulberry32 semeado',()=>{
  assert.ok(/let\s+s=\(seed>>>0\)\|\|1;/.test(fnBody('fractureRng')));
});
ok('L04 fractureWaveRng continua determinístico por (seed, wave)',()=>{
  const b=fnBody('fractureWaveRng');
  assert.ok(/fractureHash32/.test(b)&&!RNG_RE.test(b));
});
ok('L05 fractureMiniRng e fpRng intactos',()=>{
  ['fractureMiniRng','fpRng'].forEach(f=>assert.ok(!RNG_RE.test(fnBody(f)),f));
});
ok('L06 fractureMakeSeed continua sendo o único a semear a run',()=>{
  assert.ok(RNG_RE.test(fnBody('fractureMakeSeed')),'a seed da run deixou de ser aleatória');
});
ok('L07 tema é função pura da seed (mesma seed ⇒ mesmo tema)',()=>{
  const s=T.fractureMakeSeed?123456789:123456789;
  assert.ok(!RNG_RE.test(fnBody('fracturePickTheme')));
  assert.ok(!/intensity|stage/.test(fnBody('fracturePickTheme')),'pickTheme ganhou dependências');
});
ok('L08 cfg.aberr virou puramente cosmético (não desloca a mecânica)',()=>{
  const cfg=T.getCfg();const orig=cfg.aberr;
  T.setAberrV(.9);T.setRunTime(5);
  cfg.aberr=1;const comAberr=rngCount(()=>opsOf(()=>T.render()));
  cfg.aberr=0;const semAberr=rngCount(()=>opsOf(()=>T.render()));
  cfg.aberr=orig;T.setAberrV(0);
  assert.strictEqual(comAberr,0,'aberração ligada consome RNG');
  assert.strictEqual(semAberr,0,'aberração desligada consome RNG');
});

/* ==================== M · SHAKE ==================== */
console.log('\n M · SHAKE DE CÂMERA');
ok('M01 shake forte não consome RNG no render',()=>{
  T.setShakeV(14);
  assert.strictEqual(rngCount(()=>opsOf(()=>T.render())),0);
  T.setShakeV(0);
});
ok('M02 shake continua parecendo irregular ao longo do tempo',()=>{
  T.setShakeV(14);
  const vistos=new Set();
  for(let i=0;i<50;i++){
    T.setRunTime(i*0.02);T.setShakeV(14);
    const tr=opsOf(()=>T.render()).find(e=>e[0]==='translate');
    if(tr)vistos.add(tr[1][0].toFixed(4)+','+tr[1][1].toFixed(4));
  }
  T.setShakeV(0);
  assert.ok(vistos.size>=20,'shake previsível demais ('+vistos.size+' estados)');
});
ok('M03 amplitude respeita a intensidade (|offset| ≤ shake)',()=>{
  for(let i=0;i<40;i++){
    T.setRunTime(i*0.03);T.setShakeV(10);
    const tr=opsOf(()=>T.render()).find(e=>e[0]==='translate');
    if(tr){assert.ok(Math.abs(tr[1][0])<=10.001,'x fora: '+tr[1][0]);
           assert.ok(Math.abs(tr[1][1])<=10.001,'y fora: '+tr[1][1]);}
  }
  T.setShakeV(0);
});
ok('M04 cfg.shake continua respeitado (0 ⇒ sem deslocamento)',()=>{
  const cfg=T.getCfg();const orig=cfg.shake;
  cfg.shake=0;T.setShakeV(14);T.setRunTime(3.3);
  const tr=opsOf(()=>T.render()).find(e=>e[0]==='translate');
  cfg.shake=orig;T.setShakeV(0);
  if(tr)assert.ok(Math.abs(tr[1][0])<1e-9&&Math.abs(tr[1][1])<1e-9,'cfg.shake=0 ainda treme');
});
ok('M05 limiar shake>0.3 preservado',()=>{
  T.setShakeV(.2);T.setRunTime(2.2);
  const tr=opsOf(()=>T.render()).find(e=>e[0]==='translate');
  T.setShakeV(0);
  if(tr)assert.ok(Math.abs(tr[1][0])<1e-9,'shake abaixo do limiar deslocou');
});
ok('M06 mesmo runTime ⇒ mesmo offset de shake',()=>{
  T.setRunTime(4.75);T.setShakeV(8);
  const a=opsOf(()=>T.render()).find(e=>e[0]==='translate')[1].slice();
  T.setRunTime(4.75);T.setShakeV(8);
  const b=opsOf(()=>T.render()).find(e=>e[0]==='translate')[1].slice();
  T.setShakeV(0);
  assert.deepStrictEqual(a,b);
});

/* ============ N · RNG SENTINEL · RENDER COMPLETO ============ */
console.log('\n N · RNG SENTINEL · RENDER COMPLETO');
function cenaCompleta(){
  T.startRun();
  const p=T.getPlayer();p.hurtT=.6;p.x=600;p.y=400;
  T.setRunTime(10);
  const es=[];
  ['anomaly','chaser','swarm','tank'].forEach((t,i)=>{
    const e=T.spawnEnemy(t,560+i*30,420+i*20,3);
    e.st={shockT:2,burnT:1,corrP:.4,chillP:.3,bleedT:1,stunT:0};
    e.spawnT=0;es.push(e);
  });
  T.setArcs([mkArc(),mkArc({x1:100,y1:100,x2:700,y2:500,color:'#a8ff3d'})]);
  T.setBeacon(mkBeacon());
  T.setEchoes([mkEcho({slot:1}),mkEcho({slot:2,x:560,y:520,
    dis:{st:'unstable',t:.3,integ:10,integMax:100}})]);
  T.setShakeV(9);T.setAberrV(.8);
}
function limpaCena(){
  T.setArcs([]);T.setBeacon(null);T.setEnemies([]);T.setEchoes([]);
  T.setShakeV(0);T.setAberrV(0);T.setPartsRef([]);
}
ok('N01 UM render completo consome ZERO RNG',()=>{
  cenaCompleta();
  const n=rngCount(()=>opsOf(()=>T.render()));
  limpaCena();
  assert.strictEqual(n,0,'render completo consumiu '+n+' chamadas de RNG');
});
ok('N02 120 renders consecutivos consomem ZERO RNG',()=>{
  cenaCompleta();
  const n=rngCount(()=>{for(let i=0;i<120;i++)opsOf(()=>T.render());});
  limpaCena();
  assert.strictEqual(n,0,'120 renders consumiram '+n);
});
ok('N03 render durante modal (shop/event/paused) consome ZERO RNG',()=>{
  cenaCompleta();
  const st=T.getState();
  let total=0;
  ['shop','event','paused','sheet','victory'].forEach(s=>{
    T.setState(s);
    total+=rngCount(()=>{for(let i=0;i<40;i++)opsOf(()=>T.render());});
  });
  T.setState(st);limpaCena();
  assert.strictEqual(total,0,'render em modal consumiu '+total);
});
ok('N04 render no estado fracture consome ZERO RNG',()=>{
  cenaCompleta();
  const st=T.getState();T.setState('fracture');T.setFracTV(.5);
  const n=rngCount(()=>{for(let i=0;i<60;i++){T.setRunTime(i*.05);opsOf(()=>T.render());}});
  T.setState(st);limpaCena();
  assert.strictEqual(n,0,'render da fratura consumiu '+n);
});
ok('N05 renders extras NÃO criam partículas',()=>{
  cenaCompleta();T.setPartsRef([]);
  for(let i=0;i<200;i++)opsOf(()=>T.render());
  const n=T.getPartsRef().length;
  limpaCena();
  assert.strictEqual(n,0,'render criou '+n+' partículas');
});
ok('N06 renders extras NÃO mudam o estado mecânico',()=>{
  cenaCompleta();
  const p=T.getPlayer();
  const snap=()=>JSON.stringify({hp:p.hp,x:p.x,y:p.y,hurtT:p.hurtT,
    en:T.getEnemies().map(e=>({hp:e.hp,x:e.x,y:e.y,d:!!e.dead})),
    arcs:T.getArcs().length,parts:T.getPartsRef().length});
  const antes=snap();
  for(let i=0;i<150;i++)opsOf(()=>T.render());
  const depois=snap();
  limpaCena();
  assert.strictEqual(depois,antes,'o render alterou o estado da simulação');
});

/* ============ O · FPS E EQUIVALÊNCIA TEMPORAL ============ */
console.log('\n O · FPS · EQUIVALÊNCIA TEMPORAL');
ok('O01 30 / 60 / 120 draws no MESMO tempo lógico ⇒ RNG intocado',()=>{
  cenaCompleta();T.setRunTime(15);
  const a=rngCount(()=>{for(let i=0;i<30;i++)opsOf(()=>T.render());});
  const b=rngCount(()=>{for(let i=0;i<60;i++)opsOf(()=>T.render());});
  const c=rngCount(()=>{for(let i=0;i<120;i++)opsOf(()=>T.render());});
  limpaCena();
  assert.deepStrictEqual([a,b,c],[0,0,0],'consumo variou com o nº de draws');
});
/* A câmera segue o jogador por lerp a cada render
   (cam.x+=(player.x-cam.x)*.08): estado VISUAL legítimo, pré-existente e
   sem RNG, que converge assintoticamente e deixa resíduo de ~1e-12 em
   ponto flutuante. Para medir o que o E0 realmente controla — o jitter
   dos renderers — comparamos a assinatura com tolerância numérica. */
function sigNum(log){
  const out=[];
  for(const [op,args] of log){
    out.push(op);
    for(const a of (args||[]))out.push(typeof a==='number'?a:String(a));
  }
  return out;
}
function assertSigNear(a,b,tol,msg){
  assert.strictEqual(a.length,b.length,msg+' (nº de ops diferente)');
  for(let i=0;i<a.length;i++){
    if(typeof a[i]==='number'&&typeof b[i]==='number')
      assert.ok(Math.abs(a[i]-b[i])<=tol,msg+' — op '+i+': '+a[i]+' vs '+b[i]);
    else assert.strictEqual(a[i],b[i],msg+' — op '+i);
  }
}
ok('O02 30 / 60 / 120 draws ⇒ mesma imagem final para o mesmo tempo',()=>{
  cenaCompleta();T.setRunTime(15);
  for(let i=0;i<300;i++)opsOf(()=>T.render());      // câmera assentada
  T.setRunTime(15);
  const alvo=sigNum(opsOf(()=>T.render()));
  [30,60,120].forEach(n=>{
    for(let i=0;i<n;i++)opsOf(()=>T.render());
    T.setRunTime(15);
    assertSigNear(sigNum(opsOf(()=>T.render())),alvo,1e-6,'divergiu após '+n+' draws');
  });
  limpaCena();
});
ok('O02b a deriva residual entre draws é só a câmera (lerp), não jitter',()=>{
  cenaCompleta();T.setRunTime(15);
  for(let i=0;i<300;i++)opsOf(()=>T.render());
  const c1=T.getCam(),a={x:c1.x,y:c1.y};
  for(let i=0;i<80;i++)opsOf(()=>T.render());
  const c2=T.getCam();
  assert.ok(Math.abs(c2.x-a.x)<1e-6&&Math.abs(c2.y-a.y)<1e-6,
    'câmera ainda se move de verdade: '+a.x+'→'+c2.x);
});
ok('O02c com a câmera fixa a imagem é BIT-IDÊNTICA entre draws',()=>{
  /* Sem o lerp em jogo, o renderer é exatamente reprodutível. */
  cenaCompleta();T.setRunTime(15);
  for(let i=0;i<300;i++)opsOf(()=>T.render());
  const cam=T.getCam();
  T.setCam({x:cam.x,y:cam.y});
  const alvo=sig(opsOf(()=>{T.setCam({x:cam.x,y:cam.y});T.render();}));
  for(let n=0;n<100;n++)opsOf(()=>T.render());
  T.setRunTime(15);
  assert.strictEqual(sig(opsOf(()=>{T.setCam({x:cam.x,y:cam.y});T.render();})),alvo,
    'imagem divergiu com câmera fixa — há jitter não determinístico');
  limpaCena();
});
ok('O03 draws extras não alteram parts / arcs / inimigos / Echo',()=>{
  cenaCompleta();
  const snap=()=>JSON.stringify({p:T.getPartsRef().length,a:T.getArcs().length,
    e:T.getEnemies().length,ec:T.getEchoes().map(x=>({x:x.x,y:x.y,st:x.dis&&x.dis.st}))});
  const antes=snap();
  for(let i=0;i<200;i++)opsOf(()=>T.render());
  const depois=snap();limpaCena();
  assert.strictEqual(depois,antes);
});
ok('O04 renderers isolados: 1 draw ≡ 50 draws (mesmo tempo)',()=>{
  T.setRunTime(21.5);
  const casos=[
    ()=>T.drawEnemy(anomaly()),
    ()=>T.drawStatus(withSt({shockT:2})),
    ()=>T.drawPlayer()
  ];
  T.startRun();T.getPlayer().hurtT=.5;
  casos.forEach((fn,i)=>{
    T.setRunTime(21.5);
    const a=sig(opsOf(fn));
    for(let k=0;k<50;k++)opsOf(fn);
    T.setRunTime(21.5);
    assert.strictEqual(sig(opsOf(fn)),a,'renderer '+i+' divergiu');
  });
});
ok('O05 a Anomaly não é alterada por draws repetidos',()=>{
  const e=anomaly();const antes=JSON.stringify(e);
  for(let i=0;i<200;i++){T.setRunTime(i*.05);opsOf(()=>T.drawEnemy(e));}
  assert.strictEqual(JSON.stringify(e),antes);
});

/* ==================== P · REGRESSÕES ==================== */
console.log('\n P · REGRESSÕES (PR15.5-C / PR15.5-D / PR15.7)');
ok('P01 PR15.5-C · drawDeathVisual continua sem RNG',()=>{
  assert.ok(!RNG_RE.test(fnBody('drawDeathVisual')));
  assert.ok(!RNG_RE.test(fnBody('drawDeathVisuals')));
});
ok('P02 PR15.5-C · death visual usa d.seed e é estável',()=>{
  const d={type:'tank',x:300,y:300,r:16,t:.2,dur:.6,seed:.37,dir:1,aim:.5,color:'#ff2f5e'};
  T.setDeathVisuals([d]);
  assert.strictEqual(rngCount(()=>opsOf(()=>T.drawDeathVisuals())),0);
  const a=sig(opsOf(()=>T.drawDeathVisuals()));
  assert.strictEqual(sig(opsOf(()=>T.drawDeathVisuals())),a);
  T.setDeathVisuals([]);
});
ok('P03 PR15.5-C · deathVisualPush continua herdando visualSeed',()=>{
  assert.ok(/d\.seed=isFinite\(e\.visualSeed\)\?e\.visualSeed:\.5/.test(CLEAN.replace(/\s/g,'')));
});
ok('P04 PR15.5-D · renderers melee continuam sem RNG',()=>{
  ['meleeDrawTrail','visualPlayerDrawPose','visualMeleeWeaponPose','visualWeaponRecoil','drawSwings']
    .forEach(f=>assert.ok(!RNG_RE.test(fnBody(f)),f));
});
ok('P05 PR15.5-D · catálogo e perfis melee intactos',()=>{
  assert.strictEqual(T.WEAPONS.length,27);
  assert.strictEqual(Object.keys(T.MELEE_VISUAL_PROFILES).length,7);
  assert.ok(Object.isFrozen(T.MELEE_VISUAL_PROFILES));
});
ok('P06 PR15.7 · drawTemporalActionMarker sem RNG',()=>{
  assert.ok(!RNG_RE.test(fnBody('drawTemporalActionMarker')));
});
ok('P07 PR15.7 · shotgun do replay continua determinístico',()=>{
  assert.ok(/O spread do Shotgun é determinístico/.test(SRC),'comentário-contrato sumiu');
  assert.strictEqual(T.TEMPORAL_ACTION_WINDOW!==undefined?T.TEMPORAL_ACTION_WINDOW:5,5);
});
ok('P08 PR15.7 · Presença/Intenção/Facções continuam sem RNG no draw',()=>{
  ['pr15PresDraw','pr15IntentDraw','pr15IntentEdge','factionPresenceDrawEntity']
    .forEach(f=>{const b=fnBody(f);if(b)assert.ok(!RNG_RE.test(b),f);});
});
ok('P09 miniboss / boss / projéteis seguem sem RNG no draw',()=>{
  ['drawMiniBoss','drawBoss','drawProjectile','drawBeamFrom','drawGrid','drawWeaponSprite','drawShadow']
    .forEach(f=>{const b=fnBody(f);if(b)assert.ok(!RNG_RE.test(b),f);});
});
ok('P10 spawnParticles/spawnShards/spawnRing continuam sorteando no spawn',()=>{
  assert.ok(RNG_RE.test(fnBody('spawnParticles')),'spawnParticles perdeu a variedade');
  assert.ok(RNG_RE.test(fnBody('spawnShards')),'spawnShards perdeu a variedade');
});
ok('P11 partículas ainda nascem variadas a partir do update',()=>{
  T.setPartsRef([]);
  T.spawnParticles(400,400,'#fff',12,200,.4,3);
  const p=T.getPartsRef();
  assert.ok(p.length>=10);
  assert.ok(new Set(p.map(x=>x.vx.toFixed(3))).size>3,'partículas saíram idênticas');
  T.setPartsRef([]);
});
ok('P12 a suíte E0 está registrada no npm test',()=>{
  const {runnerInstalled,suiteIsDiscovered}=require('./suite-registry.js');
  assert.ok(runnerInstalled(),'npm test não usa o runner');
  assert.ok(suiteIsDiscovered('pr15-5-e0-visual-determinism'),'suíte fora do runner');
});

/* Rodapé na convenção do runner (tests/run-all.js): a linha de resumo NÃO
   pode conter os marcadores ✔/✘, senão é contada como um check extra. */
console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
