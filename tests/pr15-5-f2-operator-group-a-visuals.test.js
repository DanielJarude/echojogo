'use strict';
/* PR15.5-F2 — identidade estrutural dos operadores do Grupo A. */
const assert=require('assert');
const crypto=require('crypto');
const vm=require('vm');
const {T,SRC,sandbox}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function ok(n,f){try{f();passed++;console.log('  ✔ '+n);}catch(e){failed++;console.log('  ✘ '+n+' → '+e.message);}}
const run=s=>vm.runInContext(s,sandbox);
const A=['vector','wraith','bulwark','pyre'],B=['warden','nomad','echo0','revenant'];
const PAL='{body:"#777",dark:"#444",edge:"#aaa",glow:"#aaa",visor:"#ddd",head:"#777",wep:"#aaa"}';
function ops(expr){sandbox.__ctxLog=[];try{run(expr);}finally{const x=sandbox.__ctxLog;sandbox.__ctxLog=null;return x;}}
function hash(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');}
function bodyOps(id,a,r,noWeapon){
  if(noWeapon)run('globalThis.__f2w=drawWeaponSprite;drawWeaponSprite=function(){}');
  try{return ops(`drawUnit(500,400,${a},${r},${PAL},{wi:0,walk:.4,phase:0,visual:getOperatorVisual("${id}")})`);}
  finally{if(noWeapon)run('drawWeaponSprite=globalThis.__f2w');}
}
function fnBody(name){const p=SRC.indexOf('function '+name+'(');assert.ok(p>=0,name);let i=SRC.indexOf('{',p),d=0;
  for(let j=i;j<SRC.length;j++){if(SRC[j]==='{')d++;else if(SRC[j]==='}'&&!--d)return SRC.slice(i,j+1);}throw Error(name);}
console.log('\nECHO — PR15.5-F2 · OPERADORES GRUPO A');
run('DEV_MODE=true;sandboxRun=true;');

ok('A base F1: oito IDs e resolvedor disponíveis',()=>{assert.strictEqual(T.OPERATOR_VISUAL_IDS.length,8);assert.equal(typeof T.getOperatorVisual,'function');});
/* PR15.5-F2-R1 · AJUSTE DOCUMENTADO (§55)
   O F2 media identidade por "alguma proporção != 1". A avaliação humana
   reprovou exatamente esse método: reescalar o mesmo boneco não cria
   personagem. No R1 a identidade migrou para `build` (construção
   corporal própria), e vários operadores voltaram a proportions=1 de
   propósito — a massa agora vem da FORMA, não de um multiplicador.
   O invariante real continua garantido: todo operador do Grupo A tem
   estrutura própria declarada. */
ok('B somente Grupo A possui construção estrutural própria',()=>{for(const id of A){const p=T.OPERATOR_VISUALS[id];assert.ok(p.build&&p.build.torso&&p.build.torso.length&&p.build.head.length,id);assert.ok(Object.values(p.parts).some(x=>x.length),id);}});
ok('C Grupo B continua neutro',()=>{for(const id of B){const p=T.OPERATOR_VISUALS[id];assert.ok(Object.values(p.proportions).every(v=>v===1));assert.ok(Object.values(p.parts).every(x=>x.length===0));}});
ok('D IDs corretos; harden não existe',()=>{assert.deepStrictEqual(Array.from(T.OPERATOR_VISUAL_IDS),A.concat(B));assert.strictEqual(T.OPERATOR_VISUALS.harden,undefined);});
ok('E CHARS mecânico não é escrito pelo bloco F2',()=>{const b=SRC.slice(SRC.indexOf('PR15.5-F2 · GRUPO A'),SRC.indexOf('const OPERATOR_VISUALS=',SRC.indexOf('PR15.5-F2 · GRUPO A')));assert.ok(!/CHARS\s*\[|CHARS\./.test(b));});
ok('F hitbox fora do schema e r dos oito operadores permanece positivo',()=>{for(const c of T.CHARS){assert.ok(c.r>0);assert.ok(!('r' in T.OPERATOR_VISUALS[c.id]));}});
ok('G âncoras mecânicas intactas',()=>{assert.ok(/src\.r\+6/.test(fnBody('fireWeaponFrom')));assert.ok(/src\.r\+10/.test(fnBody('emitWeaponMuzzleVisual')));});
ok('H muzzle não referencia perfil visual',()=>assert.ok(!/OPERATOR_VISUAL|opts\.visual/.test(fnBody('emitWeaponMuzzleVisual'))));
ok('I melee D intacto',()=>{assert.ok(/r\*\.86/.test(fnBody('visualMeleeWeaponPose')));assert.strictEqual(run('Object.keys(MELEE_VISUAL_PROFILES).length'),7);});
ok('J arsenal ranged E intacto',()=>assert.strictEqual(T.WEAPONS.filter(w=>!w.melee&&!w.beam).length,19));
ok('K Echo não passa perfil',()=>assert.ok(!/visual\s*:/.test(fnBody('drawEchoEntity'))));
ok('L Shadow não passa perfil',()=>assert.ok(!/visual\s*:/.test(fnBody('drawShadow'))));
ok('M Presença não passa perfil',()=>assert.ok(!/OPERATOR_VISUAL|opts\.visual/.test(fnBody('pr15PresDraw'))));
ok('N Repetição não depende de perfis',()=>{for(const n of ['anchoredReplayUpdate','anchoredReplayRecord'])if(SRC.includes('function '+n+'('))assert.ok(!/OPERATOR_VISUAL/.test(fnBody(n)));});
ok('O save não serializa perfis',()=>{run('setChar(0);startRun({noEchoes:true,freshMeta:true});curSlot=1;smEnsureSlot();');assert.ok(!/proportions|OPERATOR_VISUAL/.test(JSON.stringify(T.getSmRoot())));});
ok('P sandbox não referencia perfis',()=>assert.ok(!/OPERATOR_VISUAL/.test(fnBody('sandboxStart'))));
ok('Q zero RNG/relógio nos renderers F2',()=>{for(const n of ['operatorVisualProfile','getOperatorVisual','drawOperatorParts','drawUnit'])assert.ok(!/Math\.random|\brand\s*\(|Date\.now|performance\.now/.test(fnBody(n)),n);});
ok('R perfis permanecem puros após render',()=>{const before=JSON.stringify(T.OPERATOR_VISUALS);for(const id of A)bodyOps(id,.7,14,false);assert.strictEqual(JSON.stringify(T.OPERATOR_VISUALS),before);});
/* PR15.5-F2-R1 · AJUSTE DOCUMENTADO (§55 + §50)
   O pseudo-3D custa fills extras (extrusão + face iluminada). O brief
   §50 autoriza explicitamente ultrapassar 200 quando o ganho visual
   justifica, e fixa 230 como teto duro. Os quatro ficam em 212–230 com
   no máximo 3 ativações de blur (o orçamento de blur é 8). */
ok('S performance: teto duro de 230 operações e 8 ativações de blur',()=>{for(const id of A){const x=bodyOps(id,.4,14,false);assert.ok(x.length<=230,id+': '+x.length);assert.ok(x.filter(e=>e[0]==='set:shadowBlur'&&e[1][0]>0).length<=8,id);}});
ok('T silhueta monocromática com arma: quatro hashes únicos',()=>assert.strictEqual(new Set(A.map(id=>hash(bodyOps(id,0,14,false)))).size,4));
ok('U silhueta monocromática SEM arma: quatro hashes únicos',()=>assert.strictEqual(new Set(A.map(id=>hash(bodyOps(id,0,14,true)))).size,4));
ok('V oito octantes: quatro assinaturas únicas em cada ângulo',()=>{for(let i=0;i<8;i++)assert.strictEqual(new Set(A.map(id=>hash(bodyOps(id,i*Math.PI/4,14,true)))).size,4,'octante '+i);});
ok('W escalas r=13/14/16 mantêm quatro assinaturas',()=>{for(const r of [13,14,16])assert.strictEqual(new Set(A.map(id=>hash(bodyOps(id,.8,r,true)))).size,4,'r='+r);});
ok('X Grupo B renderiza byte-equivalente ao default',()=>{for(const id of B)assert.strictEqual(hash(bodyOps(id,.3,14,false)),hash(ops(`drawUnit(500,400,.3,14,${PAL},{wi:0,walk:.4,phase:0})`)),id);});
ok('Y callers não-operador continuam no default',()=>{for(const n of ['drawShip','drawEchoEntity','drawShadow','pr15PresDraw'])assert.ok(!/getOperatorVisual/.test(fnBody(n)),n);});
ok('Z BULWARK operador difere do inimigo bulwark em monocromático',()=>{const a=hash(bodyOps('bulwark',0,14,true));const b=hash(ops(`drawEnemy({type:"bulwark",x:500,y:400,r:14,hp:10,maxHp:10,spawnT:0,flashT:0,aim:0,color:"#777",slowT:0})`));assert.notStrictEqual(a,b);});
ok('AA tabela e perfis congelados em profundidade útil',()=>{assert.ok(Object.isFrozen(T.OPERATOR_VISUALS));for(const id of A){const p=T.OPERATOR_VISUALS[id];assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.proportions)&&Object.isFrozen(p.parts));for(const l of Object.values(p.parts)){assert.ok(Object.isFrozen(l));for(const q of l)assert.ok(Object.isFrozen(q));}}});
/* PR15.5-F2-R1 · AJUSTE DOCUMENTADO (§55 + §9/§28)
   Exigir as três camadas povoadas empurrava para "+1 antena" — o
   anti-padrão que o §9 proíbe — e mantinha peças de 1–2px que não
   sobrevivem à rasterização real (§28). O que importa é profundidade de
   composição: cada operador precisa de massa atrás E na frente do
   torso, o que `build` (pack/torso/head) + parts garantem. */
ok('AB composição em profundidade: massa dorsal e frontal nos quatro',()=>{for(const id of A){const p=T.OPERATOR_VISUALS[id];assert.ok(p.build.pack.length,id+' dorsal');assert.ok(p.parts.back.length,id+' back');assert.ok(p.parts.body.length,id+' body');}});
ok('AC assimetria deliberada: WRAITH e PYRE; VECTOR bilateral',()=>{assert.notStrictEqual(JSON.stringify(T.OPERATOR_VISUALS.wraith.parts.back),JSON.stringify(T.OPERATOR_VISUALS.vector.parts.back));assert.ok(T.OPERATOR_VISUALS.pyre.parts.back.length>=3);assert.strictEqual(T.OPERATOR_VISUALS.vector.parts.body.length,2);});
ok('AD weapon renderer continua único e sem drawVector/drawWraith/etc',()=>{for(const n of ['Vector','Wraith','Bulwark','Pyre'])assert.ok(!new RegExp('function draw'+n+'\\s*\\(').test(SRC));assert.ok(!/operator\s*===/.test(fnBody('drawUnit')));});
ok('AE modais/smoke: corpos dos quatro desenham idle/hurt/melee sem throw',()=>{for(let i=0;i<4;i++){run(`setChar(${i});startRun({noEchoes:true,freshMeta:true});player.x=500;player.y=400;player.hurtT=.3;player.invT=0;player.dashT=0;player.rushT=0;`);ops('drawPlayer()');bodyOps(A[i],1.2,14,false);}});

console.log(`\nPR15.5-F2: ${passed} checks, ${failed} falhas`);
if(failed)process.exitCode=1;
