'use strict';
/* PR15.7-B — protótipo jogável da Repetição Ancorada. */
const assert=require('assert');
const vm=require('vm');
const {sandbox,T,SRC,normalizeSource}=require('../audit_pr135/harness.js');
const X=code=>vm.runInContext(code,sandbox);
const J=code=>JSON.parse(X('JSON.stringify('+code+')'));
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
function fresh(){T.setSandboxRun(false);T.setDevTainted(false);T.startRun({operatorId:'vector',freshMeta:true,noEchoes:true});T.setState('play');T.setEnemies([]);T.setProjectiles([]);T.setRunTime(10);X('temporalReplayReset("test");runTime=10');return T.getPlayer();}
function wi(id){return X('WEAPONS.findIndex(function(w){return w.id==='+JSON.stringify(id)+';})');}
function cap(id='plasma'){return J('(function(){var d=WEAPONS['+wi(id)+'];return temporalActionCapture(player,d,"ally",calcDamageMul(player),"player")})()');}
function use(){return X('temporalReplayTry("test")');}
function act(){return J('temporalAction');}
function ins(){return J('temporalActionInspect()');}
function tps(){return T.getProjectiles().filter(p=>p.temporalReplay);}
function body(name){const s=normalizeSource(SRC),i=s.indexOf('function '+name+'(');if(i<0)return '';const j=s.indexOf('\nfunction ',i+10);return s.slice(i,j<0?s.length:j);}
function hitEnemy(opts={}){fresh();const p=T.getPlayer();p.crit=opts.crit==null?1:opts.crit;p.doubleTap=1;p.globalLifesteal=.5;p.killDash=.5;p.dashCd=2;p.dashCdMax=2;cap(opts.weapon||'plasma');use();const wanted=opts.type||(opts.ghost?'phantom':'chaser');const e=T.spawnEnemy((wanted==='boss'||wanted==='miniboss')?'chaser':wanted,500,500,3);e.type=wanted;e.spawnT=0;e.hp=opts.hp==null?100:opts.hp;e.maxHp=Math.max(e.maxHp,e.hp);if(opts.elite){e.elite='shield';e.shield=opts.shield||20;}if(opts.ghost)e.ghostT=1;const q=tps()[0];q.x=e.x;q.y=e.y;q.vx=q.vy=0;T.updateProjectiles(.001);return {e,p,q};}
console.log('\nECHO — PR15.7-B · ANCHORED REPLAY PROTOTYPE');

ok('01 ação armed pode ser ativada',()=>{fresh();cap();assert.ok(use()>0);assert.strictEqual(ins().state,'consumed');});
ok('02 R ativa replay',()=>{assert.match(normalizeSource(SRC),/KeyR[^\n]*temporalReplayTry\('keyboard'\)/);});
ok('03 R3 ativa replay',()=>{assert.match(normalizeSource(SRC),/PB\.R3\)\)temporalReplayTry\('gamepad'\)/);});
ok('04 sem ação R não faz nada',()=>{fresh();assert.strictEqual(use(),0);assert.strictEqual(tps().length,0);});
ok('05 expired não ativa',()=>{fresh();cap();X('temporalActionTick(16)');assert.strictEqual(use(),0);});
ok('06 cooldown bloqueia',()=>{fresh();cap();use();cap();assert.strictEqual(use(),0);});
ok('07 consumed não ativa',()=>{fresh();cap();use();X('temporalReplayCooldown=0');assert.strictEqual(use(),0);});
ok('08 ação é consumida antes da execução',()=>{const b=body('temporalReplayTry');assert.ok(b.indexOf("a.state='consumed'")<b.indexOf('replayTemporalAction(a)'));});
ok('09 replay não cria nova temporalAction',()=>{fresh();cap();use();assert.strictEqual(act(),null);assert.strictEqual(ins().telemetry.recorded,1);});
ok('10 source temporalReplay não é capturado',()=>{fresh();assert.strictEqual(X('temporalActionCapture(player,WEAPONS['+wi('plasma')+'],"ally",1,"temporalReplay")'),null);});
ok('11 Echo não ativa',()=>{fresh();cap();T.setState('play');assert.ok(!body('updateEcho').includes('temporalReplayTry'));});
ok('12 proc não ativa',()=>{fresh();cap();assert.ok(!body('fireWeaponFrom').includes('temporalReplayTry'));});
ok('13 Plasma replay funciona',()=>{fresh();cap('plasma');assert.strictEqual(use(),1);assert.strictEqual(tps()[0].type,'plasma');});
ok('14 Shotgun replay funciona',()=>{fresh();cap('shotgun');assert.ok(use()>1);assert.ok(tps().every(p=>p.type==='shotgun'));});
ok('15 Rail replay funciona',()=>{fresh();cap('rail');use();assert.strictEqual(tps()[0].type,'rail');assert.ok(tps()[0].pierce>=1);});
ok('16 Sniper replay funciona',()=>{fresh();cap('sniper');use();assert.strictEqual(tps()[0].type,'sniper');});
ok('17 arma não-whitelist não funciona',()=>{fresh();assert.strictEqual(cap('cryo'),null);assert.strictEqual(use(),0);});
ok('18 Beam não funciona',()=>{fresh();assert.strictEqual(cap('beam'),null);});
ok('19 Mine não funciona',()=>{fresh();assert.strictEqual(cap('mine'),null);});
ok('20 melee não funciona',()=>{fresh();assert.strictEqual(cap('blade'),null);});
ok('21 origem original preservada',()=>{const p=fresh();p.x=222;p.y=333;cap();p.x=900;p.y=800;use();assert.deepStrictEqual([tps()[0].x,tps()[0].y],[222,333]);});
ok('22 direção original preservada',()=>{const p=fresh();p.aim=.7;cap();p.aim=-2;use();assert.ok(Math.abs(Math.atan2(tps()[0].vy,tps()[0].vx)-.7)<1e-9);});
ok('23 stats atuais não mudam snapshot',()=>{const p=fresh();p.dmgMul=2;cap();const d=act().payload.damage;p.dmgMul=99;p.projSpdMul=99;use();assert.strictEqual(tps()[0].dmg,d*.5);});
ok('24 replay usa payload',()=>{fresh();cap();X('temporalAction.payload.damage=42;temporalAction.payload.projectileSpeed=321;temporalAction.payload.range=654');use();const p=tps()[0];assert.strictEqual(p.dmg,21);assert.strictEqual(Math.hypot(p.vx,p.vy),321);assert.strictEqual(p.maxDist,654);});
ok('25 dano é reduzido a 50%',()=>{fresh();cap();const d=act().payload.damage;use();assert.strictEqual(tps()[0].dmg,d*.5);assert.strictEqual(X('TEMPORAL_REPLAY_DAMAGE'),.5);});
ok('26 replay nunca crita',()=>{fresh();T.getPlayer().crit=1;cap();use();assert.strictEqual(tps()[0].crit,false);});
ok('27 replay não aplica status',()=>{const {e}=hitEnemy();assert.ok(!e.st||Object.keys(e.st).length===0);});
ok('28 replay não dispara itemEmit de shot',()=>{const b=body('replayTemporalAction');assert.ok(!b.includes('itemEmit('));});
ok('29 replay não dispara onHit',()=>{const b=body('updateProjectiles'),gate=b.indexOf('if(p.temporalReplay)'),normal=b.indexOf('}else{',gate),hook=b.indexOf('onProjectileHit(p',gate);assert.ok(gate>=0&&normal>gate&&hook>normal);});
ok('30 replay não dispara onCrit',()=>{const {e}=hitEnemy({crit:1});assert.notStrictEqual(e.flashT,.17);});
ok('31 replay não dispara onKill',()=>{const p=fresh();p.killDash=.5;p.dashCd=2;p.dashCdMax=2;cap();use();const e=T.spawnEnemy('chaser',500,500,3);e.spawnT=0;e.hp=1;const q=tps()[0];q.x=e.x;q.y=e.y;q.vx=q.vy=0;T.updateProjectiles(.001);assert.strictEqual(p.dashCd,2);});
ok('32 replay não dispara lifesteal',()=>{fresh();const p=T.getPlayer();p.hp=20;p.globalLifesteal=1;cap();use();const e=T.spawnEnemy('chaser',500,500,3);e.spawnT=0;e.hp=100;const q=tps()[0];q.x=e.x;q.y=e.y;q.vx=q.vy=0;T.updateProjectiles(.001);assert.strictEqual(p.hp,20);});
ok('33 replay não dispara doubleTap',()=>{fresh();T.getPlayer().doubleTap=1;cap('plasma');assert.strictEqual(use(),1);});
ok('34 replay não dispara ressonância',()=>{const b=body('damageEnemy');assert.ok(b.includes('if(curAttacker&&!isTemporal)'));});
ok('35 kill temporal mata inimigo',()=>{const {e}=hitEnemy({hp:1});assert.strictEqual(e.dead,true);});
ok('36 kill temporal permite conclusão de wave',()=>{const {e}=hitEnemy({hp:1});assert.ok(e.dead);assert.match(normalizeSource(SRC),/if\(enemies\.length===0&&!boss\)/);});
ok('37 XP e loot normal permanecem',()=>{fresh();cap();use();const e=T.spawnEnemy('chaser',500,500,3);e.spawnT=0;e.hp=1;const q=tps()[0];q.x=e.x;q.y=e.y;q.vx=q.vy=0;const xp0=X('xporbs.length');T.updateProjectiles(.001);assert.ok(X('xporbs.length')>xp0);});
ok('38 kill temporal não é kill-proc direto',()=>{const {p}=hitEnemy({hp:1});assert.strictEqual(p.dashCd,2);assert.strictEqual(p.killHealN||0,0);});
ok('39 cooldown inicia em 6s',()=>{fresh();cap();use();assert.strictEqual(ins().cooldown,6);});
ok('40 cooldown decrementa por dt',()=>{fresh();cap();use();X('temporalReplayTick(1.25)');assert.strictEqual(ins().cooldown,4.75);});
ok('41 cooldown e replay vivo bloqueiam spam',()=>{fresh();cap();use();cap();const n=tps().length;assert.strictEqual(use(),0);X('temporalReplayCooldown=0');assert.strictEqual(use(),0);assert.strictEqual(tps().length,n);});
ok('42 nova ação pode ser gravada no cooldown',()=>{fresh();cap();use();assert.ok(cap('rail'));assert.strictEqual(act().weaponId,'rail');});
ok('43 ação no cooldown pode expirar',()=>{fresh();cap();use();cap('rail');X('temporalActionTick(16)');assert.strictEqual(act(),null);});
ok('44 marcador existe quando armed',()=>{fresh();cap();assert.ok(body('drawTemporalActionMarker').includes("a.state==='armed'"));});
ok('45 marcador some quando consumed',()=>{fresh();cap();use();assert.strictEqual(act(),null);});
ok('46 marcador some quando expired',()=>{fresh();cap();X('temporalActionTick(16)');assert.strictEqual(act(),null);});
ok('47 marcador mostra direção',()=>{const b=body('drawTemporalActionMarker');assert.ok(b.includes('Math.cos(a.angle)')&&b.includes('Math.sin(a.angle)'));});
ok('48 marker respeita janela',()=>{assert.ok(body('drawTemporalActionMarker').includes('(a.expiresAt-runTime)/TEMPORAL_ACTION_WINDOW'));});
ok('49 máximo 8 projéteis temporais',()=>{fresh();cap('shotgun');X('temporalAction.payload.projectileCount=999');assert.strictEqual(use(),8);});
ok('50 Shotgun não excede cap',()=>{fresh();cap('shotgun');X('temporalAction.payload.projectileCount=9');use();assert.strictEqual(tps().length,8);});
ok('51 projéteis temporais são identificáveis',()=>{fresh();cap();use();assert.ok(tps().every(p=>p.source==='temporalReplay'&&p.temporalReplay));});
ok('52 telemetria used',()=>{fresh();cap();use();assert.strictEqual(ins().telemetry.used,1);});
ok('53 telemetria invalidUse',()=>{fresh();use();assert.strictEqual(ins().telemetry.invalidUse,1);});
ok('54 telemetria hits',()=>{hitEnemy();assert.strictEqual(ins().telemetry.hits,1);});
ok('55 telemetria kills',()=>{hitEnemy({hp:1});assert.strictEqual(ins().telemetry.kills,1);});
ok('56 telemetria bounded',()=>{fresh();X('temporalActionTelemetry.hits=TEMPORAL_ACTION_TELEMETRY_MAX;temporalActionTelemetryInc("hits")');assert.strictEqual(ins().telemetry.hits,999999);});
ok('57 Phantom ghost é respeitado sem consumo falso',()=>{const {e}=hitEnemy({ghost:true});assert.ok(!e.dead);assert.strictEqual(ins().telemetry.hits,0);assert.strictEqual(tps().length,1);});
ok('58 Elite shield é respeitado',()=>{const {e}=hitEnemy({elite:true,shield:20});assert.ok(e.shield<20);assert.strictEqual(ins().telemetry.hits,1);});
ok('59 boss recebe dano normal',()=>{const {e}=hitEnemy({type:'boss',hp:999});assert.ok(e.hp<999);});
ok('60 miniboss recebe dano normal',()=>{const {e}=hitEnemy({type:'miniboss',hp:999});assert.ok(e.hp<999);});
ok('61 Echo não sofre alteração',()=>{fresh();T.setEchoes([{slot:1,alive:true,hp:20,x:500,y:500,r:15,hostile:false}]);const before=J('echoes');cap();use();const q=tps()[0];q.x=500;q.y=500;q.vx=q.vy=0;T.updateProjectiles(.001);assert.deepStrictEqual(J('echoes'),before);});
ok('62 confiança não muda',()=>{fresh();T.setEchoes([{slot:1,alive:true,trust:40,x:1,y:1}]);const n=X('echoes[0].trust');cap();use();assert.strictEqual(X('echoes[0].trust'),n);});
ok('63 personalidade não muda',()=>{fresh();T.setEchoes([{slot:1,alive:true,personality:'cautious',x:1,y:1}]);cap();use();assert.strictEqual(X('echoes[0].personality'),'cautious');});
ok('64 Fracture Director não muda no replay comum',()=>{fresh();const b=J('fractureSnapshot()');cap();use();assert.deepStrictEqual(J('fractureSnapshot()'),b);});
ok('65 wave transition limpa action',()=>{fresh();cap();T.spawnWave(2);assert.strictEqual(act(),null);});
ok('66 cooldown permanece entre waves',()=>{fresh();cap();use();const cd=ins().cooldown;T.spawnWave(2);assert.strictEqual(ins().cooldown,cd);});
ok('67 morte limpa estado temporal',()=>{fresh();cap();X('temporalReplayReset("death")');assert.strictEqual(act(),null);assert.strictEqual(ins().cooldown,0);});
ok('68 vitória limpa estado temporal',()=>{fresh();cap();X('temporalReplayReset("victory")');assert.strictEqual(act(),null);});
ok('69 reset limpa',()=>{fresh();cap();use();X('temporalReplayReset("run")');assert.strictEqual(ins().cooldown,0);assert.strictEqual(act(),null);});
ok('70 menu limpa',()=>{fresh();cap();use();X('temporalReplayReset("menu")');assert.strictEqual(ins().cooldown,0);});
ok('71 Continue não restaura ação',()=>{fresh();cap();T.captureCheckpoint('b',2);use();T.resumeRun();assert.strictEqual(act(),null);assert.strictEqual(ins().cooldown,0);});
ok('72 Continue não duplica replay',()=>{fresh();cap();T.captureCheckpoint('b',2);use();T.resumeRun();assert.strictEqual(tps().length,0);});
ok('73 sem loop de recursão',()=>{const b=body('replayTemporalAction');assert.ok(!b.includes('fireWeaponFrom(')&&!b.includes('temporalActionCapture('));});
ok('74 sem buffer crescente',()=>{fresh();cap('shotgun');use();assert.ok(!Array.isArray(X('temporalActionTelemetry')));assert.ok(tps().length<=8);});
ok('75 firing normal não regrediu',()=>{fresh();const n=T.getProjectiles().length;T.fireWeaponFrom(T.getPlayer(),T.WEAPONS[wi('plasma')],'ally',1,'player');assert.strictEqual(T.getProjectiles().length,n+1);});
ok('76 PR15.6 Phantom permanece no gate normal',()=>{assert.match(body('updateProjectiles'),/e\.type==='phantom'&&\(e\.ghostT\|\|0\)>0/);});
ok('77 Elite Shield permanece no damage pipeline',()=>{assert.ok(body('damageEnemy').includes("e.elite==='shield'&&e.shield>0"));});
ok('78 item hooks normais continuam para player',()=>{assert.ok(body('damageEnemy').includes("itemEmit('onHit'"));});
ok('79 Echos continuam sem captura',()=>{assert.ok(body('updateEcho').includes("fireWeaponFrom(e,def,'ally',capped)"));});
ok('80 checkpoint continua sem temporalAction',()=>{fresh();cap();const cp=J('smBuildCheckpoint("b",1)');assert.ok(!JSON.stringify(cp).includes('temporalAction'));});

console.log('\nPR15.7-B — '+passed+' PASSARAM · '+failed+' FALHARAM\n');
if(failed)process.exit(1);
