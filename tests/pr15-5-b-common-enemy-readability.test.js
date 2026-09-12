'use strict';
/* PR15.5-B — leitura de ataque dos 11 inimigos comuns. */
const assert=require('assert');
const {T,SRC,sandbox}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
const IDS=['chaser','shooter','tank','spawner','anomaly','swarm','orbiter','bulwark','splitter','phantom','singular'];
const FAMILIES=new Set(['contact','ranged','heavy-contact','summon','stealth','swarm','orbital','defensive','control']);
const finite=o=>Object.values(o).filter(v=>typeof v==='number').every(Number.isFinite);
function fresh(){T.startRun();const p=T.getPlayer();p.x=500;p.y=400;p.vx=p.vy=0;T.setEnemies([]);T.setProjectiles([]);return p;}
function enemy(id,x=300,y=400){const e=T.spawnEnemy(id,x,y,1);e.spawnT=0;e.fireT=9;e.touchCd=0;e.slowT=0;e.flashT=0;e.st=null;return e;}
function drawLog(e){globalThis.__ctxLog=[];T.drawEnemy(e);const l=globalThis.__ctxLog;globalThis.__ctxLog=null;return l;}
const count=(l,k)=>l.filter(x=>x[0]===k).length;
console.log('\nECHO — PR15.5-B · COMMON ENEMY ATTACK READABILITY');

// A/B: fundação e perfis — 59 checks reais
ok('A01 visualPeek permanece lazy',()=>{const e={};assert.strictEqual(T.visualPeek(e),null);assert.ok(!('visual'in e));});
ok('A02 tick idle permanece lazy',()=>{const e={};T.visualTimelineTick(e,.016);assert.ok(!('visual'in e));});
ok('A03 pose de ataque idle retorna null',()=>assert.strictEqual(T.visualEnemyAttackPose({}),null));
ok('A04 cancelamento sem state não cria state',()=>{const e={};T.visualAttackCancel(e);assert.ok(!('visual'in e));});
for(const id of IDS){
  ok('B '+id+' possui perfil',()=>assert.ok(T.ENEMY_VISUAL_PROFILES[id]));
  ok('B '+id+' attackFamily válida',()=>assert.ok(FAMILIES.has(T.ENEMY_VISUAL_PROFILES[id].attackFamily)));
  ok('B '+id+' antecipação declarada',()=>assert.ok(T.ENEMY_VISUAL_PROFILES[id].anticipationStyle));
  ok('B '+id+' active/recovery declarados',()=>{const p=T.ENEMY_VISUAL_PROFILES[id];assert.ok(p.activeStyle&&p.recoveryStyle);});
  ok('B '+id+' não duplica stats mecânicos',()=>{const p=T.ENEMY_VISUAL_PROFILES[id];for(const k of ['hp','spd','r','dmg','xp','range','cooldown'])assert.ok(!(k in p));});
}

// C: estados e timeline
ok('C01 windup inicia',()=>{const e={aim:0};T.visualAttackObserve(e,'windup',.2,1,50,'x');assert.strictEqual(e.visual.attackState,'windup');});
ok('C02 progresso é normalizado',()=>{const e={aim:0};T.visualAttackObserve(e,'windup',3,1,50,'x');assert.strictEqual(e.visual.attackP,1);});
ok('C03 direção inválida fica finita',()=>{const e={aim:.5};T.visualAttackObserve(e,'windup',.2,NaN,50,'x');assert.ok(Number.isFinite(e.visual.attackDir));});
ok('C04 range negativo é neutralizado',()=>{const e={aim:0};T.visualAttackObserve(e,'windup',.2,0,-50,'x');assert.strictEqual(e.visual.attackRange,0);});
ok('C05 trigger entra em active',()=>{const e={aim:0};T.visualAttackTrigger(e,0,10,'shot',.08);assert.strictEqual(e.visual.attackState,'active');});
ok('C06 active transita a recover',()=>{const e={aim:0};T.visualAttackTrigger(e,0,10,'shot',.08);T.visualTimelineTick(e,.08);assert.strictEqual(e.visual.attackState,'recover');});
ok('C07 recover termina em idle visual',()=>{const e={aim:0};T.visualAttackTrigger(e,0,10,'shot',.08);T.visualTimelineTick(e,.08);T.visualTimelineTick(e,.16);assert.strictEqual(e.visual.attackState,'');});
ok('C08 dt grande conclui sem estado órfão',()=>{const e={aim:0};T.visualAttackTrigger(e,0,10,'shot',.01);T.visualTimelineTick(e,10);T.visualTimelineTick(e,10);assert.strictEqual(e.visual.attackState,'');});
ok('C09 dt zero não avança active',()=>{const e={aim:0};T.visualAttackTrigger(e,0,10,'shot',.08);T.visualTimelineTick(e,0);assert.strictEqual(e.visual.attackT,.08);});
ok('C10 dt inválido não gera NaN',()=>{const e={aim:0};T.visualAttackTrigger(e,0,10,'shot',.08);T.visualTimelineTick(e,NaN);assert.ok(finite(e.visual));});
ok('C11 cancelamento limpa ataque',()=>{const e={aim:0};T.visualAttackTrigger(e,0,10,'shot',1);T.visualAttackCancel(e);assert.strictEqual(e.visual.attackState,'');});
ok('C12 killEnemy cancela telegraph na fonte',()=>assert.ok(/function killEnemy\(e(?:,damageSource)?\)\{\s*visualAttackCancel\(e\)/.test(SRC)));
ok('C13 hurt compõe sem cancelar ataque',()=>{const e={x:0,y:0,aim:0};T.visualAttackTrigger(e,0,10,'shot',1);T.visualNotifyHurt(e,-1,0);assert.strictEqual(e.visual.attackState,'active');assert.strictEqual(e.visual.event,'hurt');});

// D/E: ranged
ok('D01 Shooter entra em windup antes do tiro',()=>{fresh();const e=enemy('shooter',300);e.fireT=.3;T.updateEnemy(e,.01);assert.strictEqual(e.visual.attackState,'windup');});
ok('D02 Shooter não dispara durante windup',()=>{fresh();const e=enemy('shooter',300);e.fireT=.3;T.updateEnemy(e,.01);assert.strictEqual(T.getProjectiles().length,0);});
ok('D03 Shooter dispara no timer mecânico',()=>{fresh();const e=enemy('shooter',300);e.fireT=.001;T.updateEnemy(e,.01);assert.strictEqual(T.getProjectiles().length,1);assert.strictEqual(e.visual.attackState,'active');});
ok('D04 origem mecânica Shooter continua r+4',()=>{const p=fresh(),e=enemy('shooter',300),ex=e.x,ey=e.y;e.fireT=.001;T.updateEnemy(e,.01);const q=T.getProjectiles()[0],a=Math.atan2(p.y-ey,p.x-ex);assert.ok(Math.abs(q.x-(ex+Math.cos(a)*(e.r+4)))<1e-8);});
ok('D05 projétil Shooter mantém stats',()=>{fresh();const e=enemy('shooter',300);e.fireT=.001;T.updateEnemy(e,.01);const q=T.getProjectiles()[0];assert.deepStrictEqual([Math.hypot(q.vx,q.vy),q.dmg,q.r],[330,e.dmg,6]);});
ok('D06 Shooter fora do range não mostra windup falso',()=>{fresh();const e=enemy('shooter',1200);e.fireT=.2;T.updateEnemy(e,.01);assert.ok(!e.visual||!e.visual.attackState);});
ok('E01 Orbiter entra em windup próprio',()=>{fresh();const e=enemy('orbiter',300);e.fireT=.3;T.updateEnemy(e,.01);assert.strictEqual(e.visual.attackStyle,'satellite-align');});
ok('E02 estilos Shooter/Orbiter são distintos',()=>assert.notStrictEqual(T.ENEMY_VISUAL_PROFILES.shooter.anticipationStyle,T.ENEMY_VISUAL_PROFILES.orbiter.anticipationStyle));
ok('E03 Orbiter não dispara durante windup',()=>{fresh();const e=enemy('orbiter',300);e.fireT=.3;T.updateEnemy(e,.01);assert.strictEqual(T.getProjectiles().length,0);});
ok('E04 Orbiter dispara no timer real',()=>{fresh();const e=enemy('orbiter',300);e.fireT=.001;T.updateEnemy(e,.01);assert.strictEqual(T.getProjectiles().length,1);assert.strictEqual(e.visual.attackStyle,'pulse-shot');});
ok('E05 projétil Orbiter mantém 380px/s',()=>{fresh();const e=enemy('orbiter',300);e.fireT=.001;T.updateEnemy(e,.01);assert.ok(Math.abs(Math.hypot(T.getProjectiles()[0].vx,T.getProjectiles()[0].vy)-380)<1e-8);});
ok('E06 órbita mantém raio desejado 210 na fonte',()=>assert.ok(/const want=210/.test(SRC.slice(SRC.indexOf("if(e.type==='orbiter')"),SRC.indexOf("if(e.type==='bulwark')")))));

// F/G: contato e Swarm
ok('F01 proximidade não cria estado contínuo nem dano',()=>{const p=fresh(),e=enemy('chaser',p.x-p.r-13-30);const hp=p.hp;T.updateEnemy(e,0);assert.ok(!e.visual||!e.visual.attackState);assert.strictEqual(p.hp,hp);});
ok('F02 proximidade não altera hitbox',()=>{const p=fresh(),e=enemy('tank',p.x-p.r-27-20),r=e.r;T.updateEnemy(e,0);assert.strictEqual(e.r,r);});
ok('F03 pose de contato não altera velocidade',()=>{const e=enemy('splitter');T.visualAttackObserve(e,'windup',.5,0,30,'contact');const b=[e.vx,e.vy];T.visualEnemyAttackPose(e,{});assert.deepStrictEqual([e.vx,e.vy],b);});
ok('F04 contato real gera active sem ampliar range',()=>{const p=fresh();p.invT=0;const e=enemy('chaser',p.x);T.updateEnemy(e,0);assert.strictEqual(e.visual.attackState,'active');assert.strictEqual(e.visual.attackRange,e.r+p.r);});
ok('F05 recovery visual não cria stun/slow',()=>{const e=enemy('tank'),b=[e.spd,e.slowT];T.visualAttackTrigger(e,0,20,'contact',.01);T.visualTimelineTick(e,.01);assert.deepStrictEqual([e.spd,e.slowT],b);});
ok('G01 Swarm possui família exclusiva',()=>assert.strictEqual(T.ENEMY_VISUAL_PROFILES.swarm.attackFamily,'swarm'));
ok('G02 Swarm recebe seed finita no spawn',()=>{fresh();const e=enemy('swarm');assert.ok(Number.isFinite(e.visualSeed));});
ok('G03 Swarms em posições distintas têm seeds distintas',()=>{fresh();const a=enemy('swarm',100,100),b=enemy('swarm',200,100);assert.notStrictEqual(a.visualSeed,b.visualSeed);});
ok('G04 seed é determinística para mesmos dados',()=>{fresh();const a=enemy('swarm',100,100),b=enemy('swarm',100,100);assert.strictEqual(a.visualSeed,b.visualSeed);});
ok('G05 bloco novo do Swarm não usa Math.random',()=>{const b=SRC.slice(SRC.indexOf("}else if(e.type==='swarm')"),SRC.indexOf("}else if(e.type==='orbiter')"));assert.ok(!/Math\.random|rand\(/.test(b));});
ok('G06 Swarm não ganhou scan de enemies',()=>{const b=SRC.slice(SRC.indexOf('/* ---- ENXAME:'),SRC.indexOf('/* ---- ORBITADOR:'));assert.ok(!/for\s*\(|enemies\./.test(b));});

// H/I/J: Bulwark, Phantom, Singular
ok('H01 frente visual usa aim alinhado a shieldAng',()=>{const p=fresh(),e=enemy('bulwark',300);T.updateEnemy(e,0);assert.strictEqual(e.shieldAng,Math.atan2(p.y-e.y,p.x-e.x));assert.ok(/const drawAim=e\.type==='bulwark'.*e\.shieldAng/.test(SRC));});
ok('H02 cone mecânico permanece 2.05',()=>assert.ok(/if\(diff>2\.05\)/.test(SRC)));
ok('H03 redução mecânica permanece 28%',()=>assert.ok(/d\*=\.28/.test(SRC)));
ok('H04 pose Bulwark mantém shieldAng',()=>{const e=enemy('bulwark');e.shieldAng=1;T.visualAttackObserve(e,'windup',.5,1,30,'contact');T.visualEnemyAttackPose(e,{});assert.strictEqual(e.shieldAng,1);});
ok('I01 Phantom anuncia rematerialização na posição real',()=>{fresh();const e=enemy('phantom',300);e.phT=10;e.ghostT=.2;const xy=[e.x,e.y];T.updateEnemy(e,.01);assert.strictEqual(e.visual.attackStyle,'materialize');assert.ok(Math.hypot(e.x-xy[0],e.y-xy[1])<10);});
ok('I02 pose Phantom é finita',()=>{const e=enemy('phantom');T.visualAttackObserve(e,'windup',.5,0,13,'materialize');assert.ok(finite(T.visualEnemyAttackPose(e,{})));});
ok('I03 draw Phantom não teleporta logicamente',()=>{fresh();const e=enemy('phantom');e.ghostT=.2;T.visualAttackObserve(e,'windup',.5,0,13,'materialize');const xy=[e.x,e.y];T.drawEnemy(e);assert.deepStrictEqual([e.x,e.y],xy);});
ok('I04 intangibilidade mecânica continua ghostT>0',()=>assert.ok(/e\.type==='phantom'&&e\.ghostT>0/.test(SRC)));
ok('J01 Singular sinaliza pull por escalar sem visual state',()=>{fresh();const e=enemy('singular',200);T.updateEnemy(e,0);assert.ok(e.pullVisual>0);assert.ok(!e.visual||!e.visual.attackState);});
ok('J02 Singular fora de 420 não ativa influência mecânica',()=>{fresh();const e=enemy('singular',1000);T.updateEnemy(e,0);assert.ok(!e.visual||!e.visual.attackState);});
ok('J03 renderer usa um único arco local no raio mecânico 420',()=>{const b=SRC.slice(SRC.indexOf("}else if(e.type==='singular')"),SRC.indexOf("}else if(e.type==='shadow')"));assert.ok(/arc\(0,0,420/.test(b));assert.strictEqual((b.match(/arc\(0,0,420/g)||[]).length,1);});
ok('J04 pull e reflection têm estilos distintos',()=>{const e=enemy('singular');T.visualAttackObserve(e,'active',.5,0,420,'pull');assert.strictEqual(e.visual.attackStyle,'pull');T.visualAttackTrigger(e,0,420,'reflection',.18);assert.strictEqual(e.visual.attackStyle,'reflection');});
ok('J05 reflexão continua instantânea/probabilística, sem janela falsa',()=>assert.ok(/e\.type==='singular'.*Math\.random\(\)<\.35/.test(SRC)));
ok('J06 intensidade do pull permanece 260',()=>{const i=SRC.indexOf('/* ---- SINGULAR:');assert.ok(/\*260\*dt/.test(SRC.slice(i,i+900)));});

// K/L: pureza e performance
for(const id of IDS)ok('K draw puro '+id,()=>{fresh();const e=enemy(id);if(id==='singular')e.x=1000;const before=JSON.stringify(e);for(let i=0;i<20;i++)T.drawEnemy(e);assert.strictEqual(JSON.stringify(e),before);});
ok('K12 novos helpers de draw sem random',()=>{const b=SRC.slice(SRC.indexOf('function visualEnemyAttackPose'),SRC.indexOf('function drawEnemy'));assert.ok(!/Math\.random|rand\(/.test(b));});
ok('K13 draw não cria state idle',()=>{fresh();const e=enemy('chaser');delete e.visual;T.drawEnemy(e);assert.ok(!e.visual);});
ok('L01 46 inimigos neutros continuam sem state',()=>{fresh();const es=[];for(let i=0;i<46;i++)es.push(enemy('chaser',50+i*40,50));for(const e of es){T.updateEnemy(e,0);T.drawEnemy(e);}assert.strictEqual(es.filter(e=>e.visual).length,0);});
ok('L02 somente seis ativos pagam pose',()=>{const es=Array.from({length:46},()=>enemy('chaser'));for(let i=0;i<6;i++)T.visualAttackObserve(es[i],'windup',.5,0,20,'contact');assert.strictEqual(es.filter(e=>T.visualEnemyAttackPose(e,{})).length,6);});
ok('L03 estados expirados voltam ao fast path',()=>{const e=enemy('shooter');T.visualAttackTrigger(e,0,560,'shot',.01);T.visualTimelineTick(e,1);T.visualTimelineTick(e,1);assert.strictEqual(T.visualEnemyAttackPose(e,{}),null);});
ok('L04 state continua sem arrays',()=>{const e=enemy('shooter');T.visualAttackTrigger(e,0,560,'shot',1);assert.ok(!Object.values(e.visual).some(Array.isArray));});
ok('L05 nenhum cache cresce por frame',()=>{const n=T.WEAPON_VISUAL_PROFILE_CACHE.size;for(let i=0;i<1000;i++)T.weaponVisualProfile(T.WEAPONS[i%27]);assert.strictEqual(T.WEAPON_VISUAL_PROFILE_CACHE.size,n);});

// M: invariantes mecânicos
ok('M01 EDEFS preserva assinatura',()=>assert.strictEqual(Object.entries(T.EDEFS).map(([k,d])=>[k,d.hp,d.spd,d.r,d.dmg,d.xp].join(':')).join('|'),'chaser:26:238:13:10:5|shooter:36:150:15:8:7|tank:150:66:27:32:15|spawner:125:34:24:12:18|anomaly:44:186:14:18:12|swarm:12:322:9:6:3|orbiter:34:205:12:9:6|bulwark:78:112:18:16:9|splitter:62:168:16:13:11|phantom:30:212:13:15:14|singular:190:96:24:24:30'));
ok('M02 WEAPONS permanecem 27',()=>assert.strictEqual(T.WEAPONS.length,27));
ok('M03 MINIBOSS permanecem 8',()=>assert.strictEqual(T.MINIBOSS.length,8));
ok('M04 nenhum perfil duplica EDEFS',()=>IDS.forEach(id=>Object.keys(T.EDEFS[id]).forEach(k=>assert.ok(!(k in T.ENEMY_VISUAL_PROFILES[id])))));
ok('M05 origem shooter permanece r+4 na fonte',()=>assert.ok(/projectiles\.push\(\{x:e\.x\+Math\.cos\(a\)\*\(e\.r\+4\)/.test(SRC)));

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
