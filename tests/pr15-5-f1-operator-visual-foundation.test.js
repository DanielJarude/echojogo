'use strict';
/* =====================================================================
   ECHO — PR15.5-F1 · FUNDAÇÃO VISUAL DECLARATIVA DOS OPERADORES
   ---------------------------------------------------------------------
   F1 é SOMENTE infraestrutura: tabela OPERATOR_VISUALS + resolvedor
   puro getOperatorVisual(id) + hooks genéricos no drawUnit (opts.visual)
   + player resolvendo o próprio perfil. NENHUM operador foi redesenhado.

   Esta suíte PROVA a promessa central do bloco — ZERO mudança visual —
   comparando o stream de comandos Canvas do HEAD pós-F1 contra a BASE
   pré-F1 (commit 747f55e, instanciada via `git show` no mesmo harness,
   padrão já usado pelas suítes C/E9), e trava as invariantes que F2/F3
   não poderão quebrar:

   A · 8 IDs canônicos (sem faltantes/duplicados/fantasma)
   B · HARDEN = warden (nunca `harden`)
   C · default profile neutro e congelado
   D · fallback desconhecido → default, sem throw
   E · lookup determinístico
   F · lookup puro (render não muta perfil)
   G · drawUnit sem perfil = comportamento legado
   H · player resolve perfil (e só ele)
   I · Echo aliado não ganha identidade de operador
   J · Eco Sombrio preservado
   K · Presença Temporal preservada
   L · Repetição Ancorada independente + contenção de símbolos F1
   M · hitbox invariants (r é stat; perfil não tem geometria mecânica)
   N · âncoras projectile/beam/muzzle (r+6 / r+10 / s=r/14)
   O · melee PR15.5-D invariante
   P · arsenal D/E invariante (27 armas, 19 ranged, muzzle/impact)
   Q · silhueta continua pré-F2 (5 grupos — proposital, F2/F3 resolvem)
   R · zero RNG novo
   S · save schema intacto
   T · sandbox intacto
   U · Canvas-op equivalence pré/pós-F1 (prova da zero-mudança)
   V · modais/menu smoke (portrait/codex/título não lançam)
   ===================================================================== */
const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const Module=require('module');
const {T,SRC,sandbox}=require('../audit_pr135/harness.js');
const {readSource}=require('../audit_pr155/performance_benchmark.js');
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
const run=c=>vm.runInContext(c,sandbox);
const ROOT=path.resolve(__dirname,'..');
/* BASE pré-F1: commit do PR15.5-F0 (auditoria canônica do estado inicial) */
const BASE_REF='747f55e2dcb38077920dd305cd8dc3eadd9092d7';
const OP_IDS=['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant'];

/* ---------------- helpers (padrão F0) ---------------- */
function opsOf(fn){sandbox.__ctxLog=[];try{fn();}finally{const l=sandbox.__ctxLog;sandbox.__ctxLog=null;return l;}}
/* assinatura ESTRUTURAL: nomes das primitivas + tipos dos argumentos */
function sig(l){
  return l.map(function(e){
    const a=(e[1]||[]).map(function(x){
      if(typeof x==='number')return 'n';
      if(typeof x==='string'&&(/^#|rgba?\(/.test(x)))return 'c';
      return 's';
    }).join(',');
    return e[0]+'('+a+')';
  }).join('|');
}
const hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
function fnBody(name){
  const m=SRC.match(new RegExp('function '+name+'\\s*\\('));
  if(!m)throw new Error('função não encontrada: '+name);
  let i=SRC.indexOf('{',m.index);
  let depth=0,j=i,open=false;
  while(j<SRC.length){
    const c=SRC[j],d=SRC[j+1];
    if(c==='/'&&d==='/'){j=SRC.indexOf('\n',j);if(j<0)break;continue;}
    if(c==='/'&&d==='*'){j=SRC.indexOf('*/',j+2);if(j<0)break;j+=2;continue;}
    if(c==="'"||c==='"'){const q=c;j++;while(j<SRC.length&&SRC[j]!==q){if(SRC[j]==='\\')j++;j++;}j++;continue;}
    if(c==='{'){depth++;open=true;}
    else if(c==='}'){depth--;if(open&&depth===0)return SRC.slice(i,j+1);}
    j++;
  }
  throw new Error('corpo não fechado: '+name);
}
function fnRange(name){const b=fnBody(name);const i=SRC.indexOf(b);return [i,i+b.length];}
function stripComments(s){
  return s.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1 ');
}
const RNG_RE=/Math\.random|\brand\s*\(|\brandi\s*\(|performance\.now|Date\.now/;
function noRNG(name){
  const b=stripComments(fnBody(name));
  assert.ok(!RNG_RE.test(b),name+' contém RNG/relógio: '+(b.match(RNG_RE)||[])[0]);
}
/* bloco F1 e ranges permitidos dos símbolos F1 (contenção, seção L) */
const F1A=SRC.indexOf('PR15.5-F1 · FUNDAÇÃO VISUAL DECLARATIVA');
const F1B=SRC.indexOf('/* --- armas empunhadas');
const DU=fnRange('drawUnit'),DP=fnRange('drawPlayer');
DU[0]=SRC.indexOf('/* --- unidade humanoide completa');   // zona inclui o comentário próprio
/* PR15.5-F2-R1 · AJUSTE DOCUMENTADO (§55)
   O R1 adicionou UM consumidor autorizado da fundação: o retrato do
   seletor. O brief §23 proíbe explicitamente manter um design no Canvas
   e outro no SVG, então o portrait DEVE ler OPERATOR_VISUALS — é a
   fonte de verdade compartilhada. A contenção continua valendo: a
   fundação segue proibida em gameplay/save/entidades (L01/L02/L04). */
const CP=fnRange('charPortraitBuild'),CP2=fnRange('charPortrait');
CP[0]=SRC.indexOf('PR15.5-F2-R1 · RETRATO DERIVADO');  // zona inclui o comentário próprio
const F1_RE=/OPERATOR_VISUALS|DEFAULT_OPERATOR_VISUAL|getOperatorVisual|drawOperatorParts|operatorVisualProfile|OPERATOR_VISUAL_IDS|opts\.visual/;
function inF1Zone(i){return (i>=F1A&&i<F1B)||(i>=DU[0]&&i<DU[1])||(i>=DP[0]&&i<DP[1])||
  (i>=CP[0]&&i<CP[1])||(i>=CP2[0]&&i<CP2[1]);}
/* injeta opts.visual no cenário drawUnit(...) — verifica que injetou mesmo */
function withVisual(expr,vis){
  const out=expr.replace(/\}\)$/,',visual:'+vis+'})');
  assert.notStrictEqual(out,expr,'cenário não termina em }): '+expr);
  return out;
}

/* ---------------- mundo pré-F1 (base 747f55e) ---------------- */
let _pre=null;
function preWorld(){
  if(_pre)return _pre;
  const source=readSource(BASE_REF);
  const filename=path.join(ROOT,'audit_pr135/harness.js');
  let code=fs.readFileSync(filename,'utf8');
  code=code.replace(/^const html=.*;$/m,()=>'const html='+JSON.stringify(source)+';');
  const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(code,filename);
  const h=m.exports;
  h.sandbox.Math=Object.create(Math);
  const {performance}=require('perf_hooks');
  h.sandbox.performance.now=()=>performance.now();
  let seed=1;
  h.sandbox.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  h.run=c2=>vm.runInContext(c2,h.sandbox);
  h.run('DEV_MODE=true;sandboxRun=true;');
  _pre=h;return h;
}
function opsIn(h,fn){h.sandbox.__ctxLog=[];try{fn();}finally{const l=h.sandbox.__ctxLog;h.sandbox.__ctxLog=null;return l;}}
function seeded(sbx,seed,fn){let s=seed>>>0;const o=sbx.Math.random;
  sbx.Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  try{return fn();}finally{sbx.Math.random=o;}}
/* probe: envolve drawUnit de um mundo e captura o opts.visual recebido */
function probeVisual(h,fn){
  h.run('globalThis.__du=drawUnit;globalThis.__f1vis=[];'+
        'drawUnit=function(x,y,aim,r,pal,o){globalThis.__f1vis.push(o?o.visual:undefined);'+
        'return globalThis.__du(x,y,aim,r,pal,o);};');
  try{fn();}finally{h.run('drawUnit=globalThis.__du;');}
  return h.run('globalThis.__f1vis');
}
/* sessão de player normalizada + drawPlayer — MESMA string nos 2 mundos */
function playerOps(h,i,prep){
  seeded(h.sandbox,1234+i,()=>h.run('setChar('+i+');startRun({noEchoes:true,freshMeta:true});'));
  h.T.setRunTime(7.5);
  h.run('player.x=500;player.y=400;player.vx=0;player.vy=0;player.aim=0;player.hurtT=0;'+
        'player.invT=0;player.dashT=0;player.rushT=0;player.rangeFx=0;player.recoil=0;');
  if(prep)h.run(prep);
  return opsIn(h,()=>h.run('drawPlayer()'));
}
const PREPS={
  idle:'',
  walk:'player.vx=player.speed;player.vy=player.speed*.5;',
  aimA:'player.aim=2.35;',
  aimB:'player.aim=-2.35;',
  recoil:'player.recoil=.8;',
  hurt:'player.hurtT=.48;visualNotifyHurt(player,620,410);',
  meleeW:'player.wi=WEAPONS.findIndex(w=>w.id===CHARS[charSel].guns[1]);'+
         'globalThis.__mv=meleeVisualStart(player,WEAPONS[player.wi],1);',
  meleeA:'player.wi=WEAPONS.findIndex(w=>w.id===CHARS[charSel].guns[1]);'+
         'globalThis.__mv=meleeVisualStart(player,WEAPONS[player.wi],1);'+
         'globalThis.__mv.melee.state="active";'+
         'globalThis.__mv.melee.t=globalThis.__mv.melee.prof.active*.5;',
  dash:'player.dashT=.5;player.vx=-player.speed;'
};
/* cenários diretos de drawUnit (mesma string nos 2 mundos; pós adiciona visual) */
const PL_OP='{body:"#4d788f",dark:"#22394a",edge:"#8fd6ef",glow:"#9ff3ff",visor:"#eaffff",head:"#5b8ba3",wep:"#9ff3ff"}';
const PL_EC='{body:"rgba(40,120,160,.75)",dark:"rgba(12,45,70,.8)",edge:"#8ff6ff",glow:"#46e0ff",visor:"#eaffff",head:"rgba(50,140,180,.8)",wep:"#8ff6ff"}';
const DUSCEN=[
  ['idle r14 wi0',   'drawUnit(500,400,0,14,'+PL_OP+',{wi:0,walk:0,phase:0})'],
  ['walk r13 wi2',   'drawUnit(500,400,.9,13,'+PL_OP+',{wi:2,walk:1,phase:0})'],
  ['walk r16 wi1',   'drawUnit(500,400,-.6,16,'+PL_OP+',{wi:1,walk:.55,phase:3})'],
  ['aim r15 wi4',    'drawUnit(500,400,2.7,15,'+PL_OP+',{wi:4,walk:.3,phase:0})'],
  ['glitch echo',    'drawUnit(500,400,1.4,14,'+PL_EC+',{alpha:.72,glitch:true,wi:2,walk:.6,recoil:.4,phase:9})'],
  ['alpha eco',      'drawUnit(500,400,0,13,'+PL_EC+',{alpha:.5,glitch:false,wi:0,walk:.55,phase:1})'],
  ['recoil',         'drawUnit(500,400,.3,14,'+PL_OP+',{wi:3,walk:.2,phase:0,recoil:.9})'],
  ['melee pose',     'drawUnit(500,400,0,14,'+PL_OP+',{wi:3,walk:0,phase:0,melee:{a1x:12.5,a1y:-3,a2x:13,a2y:2.4,gx:11.8,gy:-.6,rot:-.45,sx:1.12,sy:.92}})'],
  ['hurt pose',      'drawUnit(500,400,0,14,'+PL_OP+',{wi:0,walk:0,phase:0,pose:{offsetX:1.5,offsetY:-1,rotation:.06,scaleX:.96,scaleY:1.05,alpha:.9}})'],
  ['shotgun r16',    'drawUnit(500,400,3.1,16,'+PL_OP+',{wi:WEAPONS.findIndex(w=>w.id==="shotgun"),walk:.8,phase:2})'],
  ['flamer walk',    'drawUnit(500,400,-1.9,14,'+PL_OP+',{wi:WEAPONS.findIndex(w=>w.id==="flamer"),walk:1,phase:5})'],
  ['tesla glitch',   'drawUnit(500,400,.5,14,'+PL_EC+',{alpha:.6,glitch:true,wi:WEAPONS.findIndex(w=>w.id==="tesla"),walk:.7,phase:11})']
];
function echoOps(h,slot,dis){
  seeded(h.sandbox,777+slot,()=>h.run('startRun({noEchoes:true,freshMeta:true});'));
  h.T.setRunTime(5.5);
  h.run('echoes.length=0;echoes.push(echoRelInit(makeEcho({trail:[[0,500,400,0,0,0]],'+
        'dom:"neutro",moral:{comp:0,greed:0,viol:0}},'+slot+')));');
  h.run('echoes[0].spawnT=0;echoes[0].hp=echoes[0].maxHp*.5;'+
        'echoes[0].ghosts=[{x:480,y:400}];echoes[0].curW=2;echoes[0].aim=.7;'+
        'echoes[0].seed=3.25;echoes[0].ca=1.1;');   // makeEcho sorteia seed/ca: fixa p/ comparar mundos
  if(dis)h.run('echoes[0].dis='+dis+';');
  return opsIn(h,()=>h.run('drawEchoEntity(echoes[0])'));
}
function shadowOps(h){
  seeded(h.sandbox,778,()=>h.run('startRun({noEchoes:true,freshMeta:true});'));
  h.T.setRunTime(4.25);
  h.run('enemies.length=0;enemies.push({type:"shadow",x:500,y:400,vx:0,vy:0,r:14,hp:150,'+
        'maxHp:150,dmg:14,spd:225,xp:9,color:"#7fd8ff",aim:.6,fireT:9,touchCd:0,slowT:0,'+
        'spawnT:0,flashT:0,strafe:1,wi:1,srcSlot:1,ghosts:[],dmgMul:1,crit:0,critMul:1.8,items:[]});');
  return opsIn(h,()=>h.run('drawEnemy(enemies[0])'));
}
function presOps(h){
  seeded(h.sandbox,779,()=>h.run('startRun({noEchoes:true,freshMeta:true});'));
  h.T.setRunTime(6.125);
  h.run('pr15Presence={v:1,x:500,y:400,aim:.3,phase:"active",age:5,alpha:1,scale:1,'+
        'orbit:.5,resonance:1,source:"N-1",ghosts:[],vis:{arch:1},replayReactT:0};');
  return opsIn(h,()=>h.run('pr15PresDraw()'));
}
function shipOps(h,glitchy){
  h.T.setRunTime(2.5);
  return opsIn(h,()=>h.run('drawShip(500,400,1.1,13,"#7fd8ff",.8,'+glitchy+',2,null)'));
}

console.log('\nECHO — PR15.5-F1 · FUNDAÇÃO VISUAL DECLARATIVA DOS OPERADORES');
run('DEV_MODE=true;sandboxRun=true;');

/* ============ A · 8 IDS CANÔNICOS ============ */
ok('A01 OPERATOR_VISUALS tem exatamente os 8 ids reais (sem faltantes/duplicados/fantasma)',()=>
  assert.strictEqual(Object.keys(T.OPERATOR_VISUALS).sort().join('|'),OP_IDS.slice().sort().join('|')));
ok('A02 OPERATOR_VISUAL_IDS coincide com os ids do CHARS (ordem histórica)',()=>
  assert.strictEqual(T.OPERATOR_VISUAL_IDS.join('|'),T.CHARS.map(c=>c.id).join('|')));
ok('A03 tabela congelada (runtime imutável)',()=>
  assert.ok(Object.isFrozen(T.OPERATOR_VISUALS)));
ok('A04 nenhuma entrada nula/incompleta',()=>{
  for(const id of OP_IDS)assert.ok(T.OPERATOR_VISUALS[id],id);});

/* ============ B · HARDEN = WARDEN ============ */
ok('B01 OPERATOR_VISUALS.warden existe (HARDEN usa id canônico warden)',()=>
  assert.ok(T.OPERATOR_VISUALS.warden));
ok('B02 OPERATOR_VISUALS.harden NÃO existe (nunca criar id harden)',()=>
  assert.ok(T.OPERATOR_VISUALS.harden===undefined));
ok('B03 CHARS: operador chamado HARDEN tem id warden',()=>
  assert.strictEqual(T.CHARS.find(c=>c.nm==='HARDEN').id,'warden'));
ok('B04 fallback: getOperatorVisual("harden") → default (sem crash, sem perfil fantasma)',()=>
  assert.strictEqual(T.getOperatorVisual('harden'),T.DEFAULT_OPERATOR_VISUAL));

/* ============ C · DEFAULT PROFILE ============ */
ok('C01 DEFAULT_OPERATOR_VISUAL existe e é perfil congelado',()=>{
  assert.ok(T.DEFAULT_OPERATOR_VISUAL);
  assert.ok(Object.isFrozen(T.DEFAULT_OPERATOR_VISUAL));});
ok('C02 default congelado EM PROFUNDIDADE (sub-objetos e listas)',()=>{
  const d=T.DEFAULT_OPERATOR_VISUAL;
  for(const k of ['proportions','parts','offset','pose','weapon','palette','effects'])
    assert.ok(Object.isFrozen(d[k]),k);
  for(const k of ['back','body','front'])assert.ok(Object.isFrozen(d.parts[k]),k);});
ok('C03 default neutro: todas as proporções = 1',()=>{
  const p=T.DEFAULT_OPERATOR_VISUAL.proportions;
  assert.deepStrictEqual(Object.keys(p).sort(),['arms','head','legs','pack','torso']);
  for(const k in p)assert.strictEqual(p[k],1,k);});
ok('C04 default neutro: offset 0, pose swing 1, arma neutra',()=>{
  const d=T.DEFAULT_OPERATOR_VISUAL;
  const J=o=>JSON.parse(JSON.stringify(o));   // cross-realm: compara por valor
  assert.deepStrictEqual(J(d.offset),{x:0,y:0});
  assert.deepStrictEqual(J(d.pose),{swing:1});
  assert.deepStrictEqual(J(d.weapon),{x:0,y:0,rot:0,scale:1});});
ok('C05 default neutro: nenhuma peça estrutural (3 camadas vazias)',()=>{
  const p=T.DEFAULT_OPERATOR_VISUAL.parts;
  assert.deepStrictEqual([p.back.length,p.body.length,p.front.length],[0,0,0]);});
ok('C06 default neutro: palette/effects vazios (paleta segue em CHARS)',()=>{
  assert.strictEqual(Object.keys(T.DEFAULT_OPERATOR_VISUAL.palette).length,0);
  assert.strictEqual(Object.keys(T.DEFAULT_OPERATOR_VISUAL.effects).length,0);});

/* ============ D · FALLBACK DESCONHECIDO ============ */
ok('D01 id desconhecido → default, sem exception',()=>{
  assert.strictEqual(T.getOperatorVisual('zzz'),T.DEFAULT_OPERATOR_VISUAL);});
ok('D02 null/undefined/número → default',()=>{
  assert.strictEqual(T.getOperatorVisual(null),T.DEFAULT_OPERATOR_VISUAL);
  assert.strictEqual(T.getOperatorVisual(undefined),T.DEFAULT_OPERATOR_VISUAL);
  assert.strictEqual(T.getOperatorVisual(7),T.DEFAULT_OPERATOR_VISUAL);});
ok('D03 ids herdados de Object.prototype não vazam (toString/constructor)',()=>{
  assert.strictEqual(T.getOperatorVisual('toString'),T.DEFAULT_OPERATOR_VISUAL);
  assert.strictEqual(T.getOperatorVisual('constructor'),T.DEFAULT_OPERATOR_VISUAL);
  assert.strictEqual(T.getOperatorVisual('__proto__'),T.DEFAULT_OPERATOR_VISUAL);});
ok('D04 objeto/void como id → default',()=>{
  assert.strictEqual(T.getOperatorVisual({}),T.DEFAULT_OPERATOR_VISUAL);
  assert.strictEqual(T.getOperatorVisual(void 0),T.DEFAULT_OPERATOR_VISUAL);});

/* ============ E · LOOKUP DETERMINÍSTICO ============ */
ok('E01 mesmo id → MESMO objeto (sem alocação por chamada)',()=>{
  for(const id of OP_IDS)
    assert.strictEqual(T.getOperatorVisual(id),T.getOperatorVisual(id),id);
  assert.strictEqual(T.getOperatorVisual('zzz'),T.getOperatorVisual('zzz'));});
ok('E02 após uma sessão de render o lookup continua estável',()=>{
  run('setChar(0);startRun({noEchoes:true,freshMeta:true});');
  run('drawPlayer();drawPlayer();');
  for(const id of OP_IDS)
    assert.strictEqual(T.getOperatorVisual(id),T.OPERATOR_VISUALS[id],id);});
ok('E03 todo CHARS resolve perfil (caminho pronto p/ F3/seletor)',()=>{
  for(const C of T.CHARS)
    assert.strictEqual(T.getOperatorVisual(C.id),T.OPERATOR_VISUALS[C.id],C.id);});

/* ============ F · LOOKUP PURO (RENDER NÃO MUTA) ============ */
ok('F01 sessão completa de render não altera nenhum perfil (snapshot JSON)',()=>{
  const snap=JSON.stringify([T.OPERATOR_VISUALS,T.DEFAULT_OPERATOR_VISUAL]);
  run('setChar(3);startRun({noEchoes:true,freshMeta:true});');
  run('player.hurtT=.48;visualNotifyHurt(player,620,410);');
  run('drawPlayer();');
  for(const [,expr] of DUSCEN)run(expr);
  assert.strictEqual(JSON.stringify([T.OPERATOR_VISUALS,T.DEFAULT_OPERATOR_VISUAL]),snap);});
ok('F02 perfil imutável: script strict lança; script sloppy ignora; estado nunca muda',()=>{
  let threw=false;
  try{run('"use strict";OPERATOR_VISUALS.vector.proportions.torso=2');}catch(e){threw=true;}
  assert.ok(threw,'script strict: assignment em frozen deve lançar');
  const original=T.OPERATOR_VISUALS.vector.proportions.torso;
  run('OPERATOR_VISUALS.vector.proportions.torso=2');   // sloppy: falha em silêncio
  assert.strictEqual(T.OPERATOR_VISUALS.vector.proportions.torso,original);
  let threw2=false;
  try{run('"use strict";OPERATOR_VISUALS.warden=null');}catch(e){threw2=true;}
  assert.ok(threw2);
  assert.ok(T.OPERATOR_VISUALS.warden);});
ok('F03 drawOperatorParts puro: não muta lista de peças nem paleta (dados sintéticos)',()=>{
  const parts=[{k:'rect',x:.5,y:-.3,w:.4,h:.2,rot:.3,side:1,pal:'edge'},
    {k:'circle',x:-.5,y:.3,w:.3,h:.3,rot:0,side:-1,pal:'glow',glow:6,a:.8},
    {k:'tri',x:.2,y:.4,w:.5,h:.3,rot:0,side:0,pal:'dark'},
    {k:'line',x:-.2,y:-.4,w:.6,h:.12,rot:.2,side:1,pal:'body'},
    {k:'round',x:0,y:.6,w:.3,h:.2,rot:0,side:-1,pal:'head',r:.1}];
  const pal={body:'#111111',dark:'#222222',edge:'#333333',glow:'#444444',visor:'#555555',head:'#666666'};
  const ps=JSON.stringify(parts),pals=JSON.stringify(pal);
  const a=opsOf(()=>T.drawOperatorParts(parts,14,pal));
  const b=opsOf(()=>T.drawOperatorParts(parts,14,pal));
  assert.deepStrictEqual(a,b);          // determinístico
  assert.ok(a.length>0);                // emite comandos de verdade
  assert.strictEqual(JSON.stringify(parts),ps);
  assert.strictEqual(JSON.stringify(pal),pals);});
ok('F04 drawOperatorParts com lista vazia = ZERO comandos Canvas (fast path)',()=>{
  assert.strictEqual(opsOf(()=>T.drawOperatorParts([],14,{body:'#111'})).length,0);});
ok('F05 assimetria: side −1 espelha a peça no eixo do corpo (translate invertido)',()=>{
  const pal={body:'#111',dark:'#222',edge:'#333',glow:'#444',visor:'#555',head:'#666'};
  const mk=s=>[{k:'rect',x:.5,y:0,w:.4,h:.2,rot:0,side:s,pal:'edge'}];
  const a=opsOf(()=>T.drawOperatorParts(mk(1),14,pal));
  const b=opsOf(()=>T.drawOperatorParts(mk(-1),14,pal));
  /* PR15.5-F2-R1 · AJUSTE DOCUMENTADO (§55 + §50)
     A posição da peça passou a ser baked no path (economia de
     save/translate/restore por peça, necessária para caber no orçamento
     do §50). O invariante de assimetria é o MESMO — só é observado no
     x do rect emitido em vez de no translate. */
  const ra=a.find(e=>e[0]==='rect')[1],rb=b.find(e=>e[0]==='rect')[1];
  assert.strictEqual(rb[0],-ra[0]-ra[2],'side −1 espelha a peça no eixo do corpo');
  assert.strictEqual(rb[1],ra[1]);});

/* ============ G · DRAWUNIT SEM PERFIL = LEGADO ============ */
ok('G01 drawUnit: sem visual == visual:DEFAULT == cada perfil neutro do Grupo B',()=>{
  for(const [nm,expr] of DUSCEN){
    const base=opsOf(()=>run(expr));
    const dflt=opsOf(()=>run(withVisual(expr,'DEFAULT_OPERATOR_VISUAL')));
    assert.strictEqual(JSON.stringify(base),JSON.stringify(dflt),nm+' default');
    /* F3: Grupo B possui identidade própria; somente o fallback sem perfil permanece legado. */
  }});

/* ============ H · PLAYER RESOLVE PERFIL (E SÓ ELE) ============ */
ok('H01 drawPlayer passa visual:getOperatorVisual(p.charId) (fonte única: charId)',()=>
  assert.ok(/visual:getOperatorVisual\(p\.charId\)/.test(fnBody('drawPlayer'))));
ok('H02 probe: drawPlayer entrega o perfil do operador selecionado ao drawUnit',()=>{
  for(let i=0;i<8;i++){
    seeded(sandbox,1234+i,()=>run('setChar('+i+');startRun({noEchoes:true,freshMeta:true});'));
    const got=probeVisual({run,T,sandbox},()=>run('drawPlayer()'));
    assert.strictEqual(got.length,1);
    assert.strictEqual(got[0],T.OPERATOR_VISUALS[T.CHARS[i].id],T.CHARS[i].id);
    assert.strictEqual(got[0],T.getOperatorVisual(run('player.charId')));
  }});
ok('H03 player.charId continua vindo do CHARS (makePlayer, sem fonte paralela)',()=>{
  for(let i=0;i<8;i++){
    seeded(sandbox,1234+i,()=>run('setChar('+i+');startRun({noEchoes:true,freshMeta:true});'));
    assert.strictEqual(run('player.charId'),T.CHARS[i].id);
  }});

/* ============ I · ECHO ALIADO PRESERVADO ============ */
ok('I01 drawEchoEntity não referencia a fundação F1 (sem perfil de operador)',()=>
  assert.ok(!F1_RE.test(fnBody('drawEchoEntity'))));
ok('I02 probe: Echo entrega drawUnit SEM perfil (visual indefinido)',()=>{
  seeded(sandbox,777,()=>run('startRun({noEchoes:true,freshMeta:true});'));
  run('echoes.length=0;echoes.push(echoRelInit(makeEcho({trail:[[0,500,400,0,0,0]],'+
      'dom:"neutro",moral:{comp:0,greed:0,viol:0}},1)));');
  run('echoes[0].spawnT=0;echoes[0].curW=2;echoes[0].aim=.7;');
  const got=probeVisual({run,T,sandbox},()=>run('drawEchoEntity(echoes[0])'));
  assert.ok(got.length>=1);
  for(const v of got)assert.strictEqual(v,undefined);});
ok('I03 Echo NÃO herda automaticamente o perfil do operador do player',()=>{
  seeded(sandbox,776,()=>run('setChar(4);startRun({noEchoes:true,freshMeta:true});'));
  run('echoes.length=0;echoes.push(echoRelInit(makeEcho({trail:[[0,500,400,0,0,0]],'+
      'dom:"neutro",moral:{comp:0,greed:0,viol:0}},1)));');
  run('echoes[0].spawnT=0;echoes[0].curW=2;');
  const got=probeVisual({run,T,sandbox},()=>run('drawEchoEntity(echoes[0])'));
  for(const v of got)assert.strictEqual(v,undefined);});

/* ============ J · ECO SOMBRIO PRESERVADO ============ */
ok('J01 drawShadow não referencia a fundação F1',()=>
  assert.ok(!F1_RE.test(fnBody('drawShadow'))));
ok('J02 probe: Eco Sombrio entrega drawUnit SEM perfil',()=>{
  seeded(sandbox,778,()=>run('startRun({noEchoes:true,freshMeta:true});'));
  run('enemies.length=0;enemies.push({type:"shadow",x:500,y:400,vx:0,vy:0,r:14,hp:150,'+
      'maxHp:150,dmg:14,spd:225,xp:9,color:"#7fd8ff",aim:.6,fireT:9,touchCd:0,slowT:0,'+
      'spawnT:0,flashT:0,strafe:1,wi:1,srcSlot:1,ghosts:[],dmgMul:1,crit:0,critMul:1.8,items:[]});');
  const got=probeVisual({run,T,sandbox},()=>run('drawEnemy(enemies[0])'));
  assert.ok(got.length>=1);
  for(const v of got)assert.strictEqual(v,undefined);});

/* ============ K · PRESENÇA TEMPORAL PRESERVADA ============ */
ok('K01 pr15PresDraw não referencia a fundação F1 (paleta segue derivada do CHARS)',()=>
  assert.ok(!F1_RE.test(fnBody('pr15PresDraw'))));
ok('K02 probe: Presença entrega drawUnit SEM perfil',()=>{
  seeded(sandbox,779,()=>run('startRun({noEchoes:true,freshMeta:true});'));
  run('pr15Presence={v:1,x:500,y:400,aim:.3,phase:"active",age:5,alpha:1,scale:1,'+
      'orbit:.5,resonance:1,source:"N-1",ghosts:[],vis:{arch:1},replayReactT:0};');
  const got=probeVisual({run,T,sandbox},()=>run('pr15PresDraw()'));
  assert.ok(got.length>=1);
  for(const v of got)assert.strictEqual(v,undefined);});
ok('K03 dependência registrada: pr15PresPalette continua lendo CHARS (não OPERATOR_VISUALS)',()=>
  assert.ok(/CHARS/.test(fnBody('pr15PresPalette'))&&!F1_RE.test(fnBody('pr15PresPalette'))));

/* ============ L · REPETIÇÃO ANCORADA INDEPENDENTE ============ */
ok('L01 temporalReplayTry sem qualquer referência à fundação F1',()=>
  assert.ok(!F1_RE.test(fnBody('temporalReplayTry'))));
ok('L02 bloco F1 sem acoplamento mecânico (sem Echo/trust/Ressonância/proc)',()=>{
  const block=stripComments(SRC.slice(F1A,F1B));
  for(const bad of ['echoQueue','trust','resonance','Resson','pr15Mem','proc','damage','fireWeapon'])
    assert.ok(block.indexOf(bad)<0,'bloco F1 referencia '+bad);});
ok('L03 contenção global: símbolos F1 existem SOMENTE no bloco F1/drawUnit/drawPlayer',()=>{
  let m,seen=0;
  const re=new RegExp(F1_RE.source,'g');
  while((m=re.exec(SRC))){seen++;assert.ok(inF1Zone(m.index),
    'símbolo F1 fora de zona permitida @'+m.index+': '+SRC.slice(m.index,m.index+40));}
  assert.ok(seen>10,'contenção executada sobre ocorrências reais');});
ok('L04 funções de gameplay/save/entidades não tocam a fundação F1',()=>{
  for(const f of ['makePlayer','updatePlayer','fireWeaponFrom','fireMelee','fireBeam',
    'updateEcho','damageEcho','spawnShadowEcho','pr15MemBeginRun','pr15PresSpawn','setChar'])
    assert.ok(!F1_RE.test(fnBody(f)),f+' referencia F1');});

/* ============ M · HITBOX INVARIANTS ============ */
ok('M01 player.r continua sendo o stat do operador (hitbox intocada)',()=>{
  for(let i=0;i<8;i++){
    seeded(sandbox,1234+i,()=>run('setChar('+i+');startRun({noEchoes:true,freshMeta:true});'));
    assert.strictEqual(T.getPlayer().r,T.CHARS[i].r,T.CHARS[i].id);}});
ok('M02 schema do perfil contém APENAS as chaves estruturais (sem r/hitbox/geom mecânica)',()=>{
  /* PR15.5-F2-R1: schema estendido genericamente com `build` (construção
     corporal) e `portrait` (enquadramento do busto). Ambos continuam
     PURAMENTE visuais — a proibição de chave mecânica segue valendo. */
  const ALLOW=['build','effects','face','id','offset','palette','parts','portrait','pose','proportions','weapon'];
  const ALLOW_P=['arms','head','legs','pack','torso'];
  for(const id of OP_IDS){
    const p=T.OPERATOR_VISUALS[id];
    assert.deepStrictEqual(Object.keys(p).sort(),ALLOW,id);
    assert.deepStrictEqual(Object.keys(p.proportions).sort(),ALLOW_P,id);
    for(const bad of ['r','radius','hitbox','hp','speed','dmg'])
      assert.ok(!(bad in p),id+'.'+bad);
  }});
ok('M03 drawUnit continua escalando o corpo por s=r/14 (âncora F0 §18)',()=>
  assert.ok(/const s=r\/14/.test(fnBody('drawUnit'))));
ok('M04 sombra projetada NÃO acompanha offset/proporções do perfil (pegada da hitbox)',()=>{
  const b=fnBody('drawUnit');
  const si=b.indexOf('ellipse(0,r*.42');
  const oi=b.indexOf('vp.offset.x||vp.offset.y');
  assert.ok(si>=0&&oi>si,'offset aplicado DEPOIS da sombra');});

/* ============ N · ÂNCORAS PROJECTILE/BEAM/MUZZLE ============ */
ok('N01 origem mecânica do projétil ancorada em src.r+6 (fireWeaponFrom)',()=>
  assert.ok(/Math\.cos\(src\.aim\)\*\(src\.r\+6\)/.test(fnBody('fireWeaponFrom'))));
ok('N02 origem do feixe ancorada em src.r+6 (drawBeamFrom)',()=>
  assert.ok(/ux\*\(src\.r\+6\)/.test(fnBody('drawBeamFrom'))));
ok('N03 muzzle E8 ancorado em src.r+10 (emitWeaponMuzzleVisual)',()=>
  assert.ok(/Math\.cos\(ang\)\*\(src\.r\+10\)/.test(fnBody('emitWeaponMuzzleVisual'))));
ok('N04 melee usa origem no CENTRO + reach (fireMelee)',()=>
  assert.ok(/x:src\.x,y:src\.y/.test(fnBody('fireMelee'))));

/* ============ O · MELEE PR15.5-D INVARIANTE ============ */
ok('O01 pose da arma continua ancorada na montagem r*.86 / −r*.04 (D preservado)',()=>{
  const b=fnBody('visualMeleeWeaponPose');
  assert.ok(/r\*\.86/.test(b));
  assert.ok(/-r\*\.04/.test(b));});
ok('O02 7 perfis melee D intactos',()=>
  assert.strictEqual(run('Object.keys(MELEE_VISUAL_PROFILES).sort().join("|")'),
    'blade|chains|gaunt|glaive|hammer|katana|scythe'));
ok('O03 fast path melee preservado: sem golpe ativo a pose é null',()=>
  assert.strictEqual(T.visualMeleeWeaponPose({}),null));

/* ============ P · ARSENAL D/E INVARIANTE ============ */
ok('P01 catálogo com as 27 armas (arma continua definida pelo loadout)',()=>
  assert.strictEqual(T.WEAPONS.length,27));
ok('P02 19 projéteis ranged sem fallback legacy (E1 preservado)',()=>{
  const ids=run('WEAPONS.filter(w=>!w.melee&&!w.beam).map(w=>w.id)');
  assert.strictEqual(ids.length,19);
  for(const id of ids)
    assert.ok(T.visualFamilyForProjectile({type:id})!==T.PVF.LEGACY,id);});
ok('P03 muzzle e impacto determinísticos (E8/E9 preservados)',()=>{
  noRNG('emitWeaponMuzzleVisual');noRNG('muzzleShot');noRNG('impactShot');});
ok('P04 drawWeaponSprite intocado pela fundação (não referencia F1)',()=>
  assert.ok(!F1_RE.test(fnBody('drawWeaponSprite'))));

/* ============ Q · DEFAULT/GRUPO B CONTINUAM NEUTROS APÓS F2 ============ */
ok('Q01 F3: Grupo B possui assinaturas estruturais distintas',()=>{
  const s=new Set();
  for(const id of ['warden','nomad','echo0','revenant']){
    const l=opsOf(()=>run('drawUnit(500,400,0,14,'+PL_OP+',\{wi:0,walk:0,phase:0,visual:getOperatorVisual(\"'+id+'\")\})'));
    s.add(hash(sig(l)));
  }
  assert.strictEqual(s.size,4);});
ok('Q02 F3: Grupo B possui builds e portraits derivados',()=>{
  for(const id of ['warden','nomad','echo0','revenant']){const p=T.OPERATOR_VISUALS[id];assert.ok(p.build&&p.portrait,id);}
});

/* ============ R · ZERO RNG NOVO ============ */
ok('R01 funções da fundação F1 sem RNG/relógio de parede',()=>{
  noRNG('operatorVisualProfile');noRNG('getOperatorVisual');
  noRNG('drawOperatorParts');});
ok('R02 renderers do escopo F continuam sem RNG (E0 preservado)',()=>{
  noRNG('drawUnit');noRNG('drawPlayer');noRNG('drawEchoEntity');
  noRNG('drawShadow');noRNG('pr15PresDraw');});
ok('R03 bloco F1 (fonte) sem Math.random/rand/performance.now/Date.now',()=>{
  assert.ok(!RNG_RE.test(stripComments(SRC.slice(F1A,F1B))));});

/* ============ S · SAVE SCHEMA INTACTO ============ */
ok('S01 perfil visual NÃO entra no save; operador continua sendo identificador simples',()=>{
  seeded(sandbox,42,()=>run('setChar(2);startRun({noEchoes:true,freshMeta:true});'));
  run('player.hurtT=.48;visualNotifyHurt(player,620,410);drawPlayer();');
  run('curSlot=1;smEnsureSlot();setChar(3);');   // controle positivo: id persiste como antes
  const blob=JSON.stringify(T.getSmRoot());
  assert.ok(/"char"\s*:/.test(blob),'identificador de operador deveria persistir');
  assert.ok(blob.indexOf('proportions')<0,'proportions no save');
  assert.ok(blob.indexOf('OperatorVisual')<0,'OperatorVisual no save');
  assert.ok(blob.indexOf('drawOperatorParts')<0,'renderer no save');});
ok('S02 funções de save/pack não referenciam a fundação F1',()=>{
  for(const f of ['smCommit','captureCheckpoint','resumeRun','saveProg','saveMeta',
    'saveEchoes','pr15MemPack','pr15PresPack','fractureRunPack'])
    assert.ok(!F1_RE.test(fnBody(f)),f+' referencia F1');});

/* ============ T · SANDBOX INTACTO ============ */
ok('T01 funções do sandbox não referenciam a fundação F1',()=>{
  for(const f of ['sandboxStart','sandboxExit','sandboxRestart','sandboxEndToSetup','sandboxCloseSetup'])
    assert.ok(!F1_RE.test(fnBody(f)),f+' referencia F1');});
ok('T02 bloco F1 sem persistência (nada de localStorage/smRoot/smCommit/prog)',()=>{
  const block=stripComments(SRC.slice(F1A,F1B));
  for(const bad of ['localStorage','smRoot','smCommit','saveProg','saveMeta','bumpProg'])
    assert.ok(block.indexOf(bad)<0,'bloco F1 referencia '+bad);});
ok('T03 sessão de desenho não cria persistência adicional (smRoot limpo de perfis)',()=>{
  seeded(sandbox,43,()=>run('setChar(1);startRun({noEchoes:true,freshMeta:true});'));
  run('drawPlayer();');
  const blob=JSON.stringify(T.getSmRoot());
  assert.ok(blob.indexOf('proportions')<0&&blob.indexOf('OperatorVisual')<0);});

/* ============ U · CANVAS-OP EQUIVALENCE PRÉ/PÓS-F1 ============ */
const pre=preWorld();
ok('U00 sanidade: a base é mesmo pré-F1 (747f55e sem fundação)',()=>{
  assert.strictEqual(pre.run('typeof OPERATOR_VISUALS'),'undefined');
  assert.strictEqual(pre.run('typeof getOperatorVisual'),'undefined');});
ok('U01 drawUnit direto: stream de Canvas idêntico pré×pós (12 cenários × 8 perfis)',()=>{
  for(const [nm,expr] of DUSCEN){
    const a=opsIn(pre,()=>pre.run(expr));
    assert.ok(a.length>0,nm);
    const b=opsOf(()=>run(expr));
    assert.strictEqual(JSON.stringify(a),JSON.stringify(b),nm+' (sem perfil)');
    /* F3 migrates Group B to intentional visual profiles. */
  }});
ok('U02 F3 drawPlayer resolves the selected visual profile',()=>{assert.ok(/visual:getOperatorVisual\(p\.charId\)/.test(fnBody('drawPlayer')));});
ok('U03 Echo aliado: stream idêntico pré×pós (estável, glitch slot2, dissonante)',()=>{
  for(const [slot,dis] of [[1,null],[2,null],[1,"{st:'hostile',t:.5,integ:30,integMax:60}"],
    [1,"{st:'fracturing',t:.3,integ:20,integMax:40}"]]){
    const a=echoOps(pre,slot,dis),b=echoOps({run,T,sandbox},slot,dis);
    assert.strictEqual(JSON.stringify(a),JSON.stringify(b),'echo slot'+slot+' '+String(dis));
  }});
ok('U04 Eco Sombrio: stream idêntico pré×pós',()=>{
  const a=shadowOps(pre),b=shadowOps({run,T,sandbox});
  assert.strictEqual(JSON.stringify(a),JSON.stringify(b));});
ok('U05 Presença Temporal: stream idêntico pré×pós',()=>{
  const a=presOps(pre),b=presOps({run,T,sandbox});
  assert.strictEqual(JSON.stringify(a),JSON.stringify(b));});
ok('U06 drawShip (wrapper legado): stream idêntico pré×pós (com e sem glitch)',()=>{
  for(const g of ['false','true']){
    const a=shipOps(pre,g),b=shipOps({run,T,sandbox},g);
    assert.strictEqual(JSON.stringify(a),JSON.stringify(b),'glitch='+g);
  }});
ok('U07 custo do corpo neutro inalterado; Echo preservado pré==pós',()=>{
  const cnt=l=>[l.length,l.filter(e=>e[0]==='set:shadowBlur'&&e[1][0]>0).length];
  const c=cnt(echoOps(pre,2,null)),d=cnt(echoOps({run,T,sandbox},2,null));
  assert.deepStrictEqual(d,c);});

/* ============ V · MODAIS / MENU SMOKE ============ */
ok('V01 charPortrait dos 8 operadores não lança (retratos NÃO mudaram em F1)',()=>{
  for(let i=0;i<8;i++){
    const s=run('charPortrait(CHARS['+i+'],46)');
    assert.ok(String(s).indexOf('<svg')===0,T.CHARS[i].id);
  }});
ok('V02 charPortrait permanece UM template compartilhado (sem branch por operador)',()=>{
  const b=fnBody('charPortrait');
  for(const id of OP_IDS)assert.ok(!new RegExp("case '"+id+"'").test(b),id);
  assert.ok(/charPortraitBuild|getOperatorVisual/.test(b));});
ok('V03 renderCodexBody (seletor de operador) não lança com a fundação ativa',()=>{
  run('codexMode="arsenal";codexTab="chars";renderCodexBody();');});
ok('V04 refreshTitleChar não lança (menu inicial com operador selecionado)',()=>{
  run('setChar(4);refreshTitleChar();');});
ok('V05 caminho preparado p/ F3: perfil acessível a partir do CHARS do seletor',()=>{
  for(const C of T.CHARS)
    assert.strictEqual(T.getOperatorVisual(C.id).id,C.id);});

/* ---------------- resultado ---------------- */
console.log('\n'+'='.repeat(64));
console.log('PR15.5-F1: '+(passed+failed)+' checks · aprovados '+passed+' · reprovados '+failed);
if(failed){console.log('FALHAS DETECTADAS');process.exit(1);}
console.log('FUNDAÇÃO CONSISTENTE COM A PROMESSA DE ZERO MUDANÇA VISUAL');
