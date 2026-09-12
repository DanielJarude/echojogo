'use strict';
/* PR15.7-A — fundação da Repetição Ancorada: contrato, captura e guards. */
const assert=require('assert');
const vm=require('vm');
const {sandbox,T,SRC,normalizeSource}=require('../audit_pr135/harness.js');
const X=code=>vm.runInContext(code,sandbox);
const J=code=>JSON.parse(X('JSON.stringify('+code+')'));
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
function fresh(){T.setSandboxRun(false);T.setDevTainted(false);T.startRun({operatorId:'vector',freshMeta:true,noEchoes:true});T.setState('play');T.setEnemies([]);T.setProjectiles([]);X('runTime=10;temporalActionReset()');return T.getPlayer();}
function wi(id){return X('WEAPONS.findIndex(function(w){return w.id==='+JSON.stringify(id)+';})');}
function eligible(id,source='player',src='player'){return X('temporalActionEligible('+src+',WEAPONS['+wi(id)+'],"ally",'+JSON.stringify(source)+')');}
function capture(id,source='player',src='player'){
  const i=wi(id);return J('(function(){var d=WEAPONS['+i+'];return temporalActionCapture('+src+',d,"ally",calcDamageMul(player),'+JSON.stringify(source)+');})()');
}
function inspect(){return J('temporalActionInspect()');}
function action(){return J('temporalAction');}
function section(name){const s=normalizeSource(SRC),i=s.indexOf('function '+name+'(');if(i<0)return '';const j=s.indexOf('\nfunction ',i+10);return s.slice(i,j<0?s.length:j);}

console.log('\nECHO — PR15.7-A · TEMPORAL ACTION FOUNDATION');

ok('01 estado inicia vazio',()=>{fresh();assert.strictEqual(inspect().active,false);assert.strictEqual(action(),null);});
ok('02 Plasma é elegível',()=>{fresh();assert.strictEqual(eligible('plasma'),true);});
ok('03 Shotgun é elegível',()=>{fresh();assert.strictEqual(eligible('shotgun'),true);});
ok('04 Rail é elegível',()=>{fresh();assert.strictEqual(eligible('rail'),true);});
ok('05 Sniper é elegível',()=>{fresh();assert.strictEqual(eligible('sniper'),true);});
ok('06 IDs reais da whitelist estão corretos',()=>{const ids=J('Object.keys(TEMPORAL_ACTION_WEAPONS)');assert.deepStrictEqual(ids.sort(),['plasma','rail','shotgun','sniper']);for(const id of ids)assert.ok(wi(id)>=0,id);});
ok('07 arma fora da whitelist não grava',()=>{fresh();assert.strictEqual(capture('cryo'),null);assert.strictEqual(action(),null);});
ok('08 melee não grava',()=>{fresh();assert.strictEqual(capture('blade'),null);});
ok('09 Beam não grava',()=>{fresh();assert.strictEqual(capture('beam'),null);});
ok('10 Mine não grava',()=>{fresh();assert.strictEqual(capture('mine'),null);});
ok('11 Echo não grava',()=>{fresh();assert.strictEqual(capture('plasma','echo','({slot:1})'),null);});
ok('12 temporalReplay não grava',()=>{fresh();assert.strictEqual(capture('plasma','temporalReplay'),null);});
ok('13 proc não grava',()=>{fresh();assert.strictEqual(capture('plasma','proc'),null);});
ok('14 jogador original grava',()=>{fresh();const a=capture('plasma');assert.ok(a&&a.state==='armed');});
ok('14b fireWeaponFrom é o ponto real de captura e preserva o disparo único',()=>{fresh();const i=wi('plasma'),before=T.getProjectiles().length;X('fireWeaponFrom(player,WEAPONS['+i+'],"ally",calcDamageMul(player),"player")');assert.strictEqual(inspect().active,true);assert.strictEqual(action().weaponId,'plasma');assert.strictEqual(T.getProjectiles().length-before,1);});
ok('14c chamada interna proc em fireWeaponFrom não substitui a ação primária',()=>{fresh();capture('rail');const id=action().id,i=wi('plasma');X('fireWeaponFrom(player,WEAPONS['+i+'],"ally",1,"proc")');assert.strictEqual(action().id,id);assert.strictEqual(action().weaponId,'rail');});
ok('15 posição é capturada por valor',()=>{const p=fresh();p.x=321;p.y=654;capture('plasma');const a=action();assert.strictEqual(a.x,321);assert.strictEqual(a.y,654);p.x=999;assert.strictEqual(action().x,321);});
ok('16 direção é capturada',()=>{const p=fresh();p.aim=1.234;capture('rail');assert.strictEqual(action().angle,1.234);});
ok('17 weaponId é capturado',()=>{fresh();capture('sniper');assert.strictEqual(action().weaponId,'sniper');});
ok('18 payload é bounded e somente escalar',()=>{fresh();capture('shotgun');const p=action().payload;assert.deepStrictEqual(Object.keys(p).sort(),['damage','pierce','projectileCount','projectileRadius','projectileSpeed','range','spread']);assert.ok(p.projectileCount<=8);for(const k in p)assert.strictEqual(typeof p[k],'number');});
ok('19 payload não contém player',()=>{fresh();capture('plasma');assert.ok(!('player' in action().payload));assert.ok(!JSON.stringify(action()).includes('itemState'));});
ok('20 payload não contém enemy',()=>{fresh();capture('plasma');assert.ok(!('enemy' in action().payload)&&!('target' in action().payload));});
ok('21 payload não contém callbacks',()=>{fresh();capture('plasma');const a=action();for(const k in a)assert.notStrictEqual(typeof a[k],'function');for(const k in a.payload)assert.notStrictEqual(typeof a.payload[k],'function');});
ok('22 nova ação substitui anterior',()=>{fresh();capture('plasma');capture('rail');assert.strictEqual(action().weaponId,'rail');assert.strictEqual(inspect().telemetry.replaced,1);});
ok('23 ID aumenta monotonicamente',()=>{fresh();const a=capture('plasma');const b=capture('rail');assert.ok(b.id>a.id);});
ok('24 somente uma ação existe',()=>{fresh();for(const id of ['plasma','shotgun','rail','sniper'])capture(id);assert.ok(action()&&!Array.isArray(action()));assert.strictEqual(inspect().telemetry.recorded,4);});
ok('25 expiresAt usa janela exata de 5s',()=>{fresh();capture('plasma');const a=action();assert.strictEqual(a.expiresAt-a.t,5);assert.strictEqual(X('TEMPORAL_ACTION_WINDOW'),5);});
ok('26 ação expira deterministicamente',()=>{fresh();capture('plasma');X('temporalActionTick(14.999)');assert.ok(action());X('temporalActionTick(15)');assert.strictEqual(action(),null);assert.strictEqual(inspect().telemetry.expired,1);});
ok('27 expirada deixa de estar elegível para uso futuro',()=>{fresh();capture('plasma');X('temporalActionTick(20)');assert.strictEqual(inspect().active,false);assert.strictEqual(inspect().state,'expired');});
ok('28 morte limpa',()=>{fresh();capture('plasma');X('temporalActionClear("death")');assert.strictEqual(action(),null);assert.strictEqual(inspect().state,'death');assert.ok(section('onPlayerDeath').includes("temporalReplayReset('death')"));});
ok('29 vitória limpa',()=>{fresh();capture('plasma');X('temporalActionClear("victory")');assert.strictEqual(action(),null);assert.ok(section('onVictory').includes("temporalReplayReset('victory')"));});
ok('30 nova run limpa estado e telemetria',()=>{fresh();capture('plasma');T.startRun({operatorId:'vector',freshMeta:true,noEchoes:true});assert.strictEqual(action(),null);assert.strictEqual(inspect().telemetry.recorded,0);});
ok('31 reset/menu limpa',()=>{fresh();capture('plasma');X('temporalActionReset()');assert.strictEqual(action(),null);assert.ok(section('clearRunEntities').includes("temporalReplayReset('menu')"));});
ok('32 wave transition limpa',()=>{fresh();capture('plasma');T.spawnWave(1);assert.strictEqual(action(),null);assert.strictEqual(inspect().state,'wave');});
ok('33 checkpoint não persiste ação',()=>{fresh();capture('plasma');assert.strictEqual(T.captureCheckpoint('pr15.7-a',2),true);const cp=J('activeRun');const raw=JSON.stringify(cp);assert.ok(!raw.includes('temporalAction')&&!raw.includes('expiresAt'));});
ok('34 Continue não restaura ação',()=>{fresh();capture('plasma');assert.strictEqual(T.captureCheckpoint('pr15.7-a',2),true);capture('rail');T.resumeRun();assert.strictEqual(action(),null);assert.strictEqual(inspect().telemetry.recorded,0);});
ok('35 captura não causa dano extra',()=>{fresh();const e=T.spawnEnemy('chaser',500,500,1);e.spawnT=0;const hp=e.hp;capture('plasma');assert.strictEqual(e.hp,hp);});
ok('36 captura direta não cria projétil adicional',()=>{fresh();const n=T.getProjectiles().length;capture('shotgun');assert.strictEqual(T.getProjectiles().length,n);});
ok('37 captura não dispara itemEmit',()=>{fresh();const body=section('temporalActionCapture');assert.ok(!body.includes('itemEmit('));});
ok('38 captura não dispara proc',()=>{fresh();const body=section('temporalActionCapture');for(const s of ['onHit','onCrit','onKill','onResonance'])assert.ok(!body.includes(s),s);});
ok('39 captura não altera crit normal',()=>{const p=fresh();p.crit=.37;capture('rail');assert.strictEqual(p.crit,.37);assert.ok(!('crit' in action().payload));});
ok('40 captura não altera arma normal',()=>{const p=fresh();const before=p.wi;capture('sniper');assert.strictEqual(p.wi,before);});
ok('41 captura não altera cooldown normal',()=>{const p=fresh();p.fireTimer=.42;p.dashCd=.7;p.spCd=2;capture('plasma');assert.deepStrictEqual([p.fireTimer,p.dashCd,p.spCd],[.42,.7,2]);});
ok('42 captura não altera Echos',()=>{fresh();T.setEchoes([{slot:1,alive:true,x:1,y:2}]);const before=J('echoes');capture('plasma');assert.deepStrictEqual(J('echoes'),before);});
ok('43 captura não altera Fracture Director',()=>{fresh();const before=J('fractureSnapshot()');capture('plasma');assert.deepStrictEqual(J('fractureSnapshot()'),before);});
ok('44 telemetria é bounded',()=>{fresh();X('temporalActionTelemetry.rejected=TEMPORAL_ACTION_TELEMETRY_MAX;temporalActionTelemetryInc("rejected")');assert.strictEqual(inspect().telemetry.rejected,999999);});
ok('45 não há arrays históricos crescentes',()=>{fresh();capture('plasma');assert.strictEqual(X('Array.isArray(temporalAction)'),false);assert.strictEqual(X('Array.isArray(temporalActionTelemetry)'),false);assert.ok(!('history' in inspect()));});
ok('46 action state é armed',()=>{fresh();capture('shotgun');assert.strictEqual(action().state,'armed');assert.strictEqual(action().source,'player');});
ok('47 substituída não é executada',()=>{fresh();const p0=T.getProjectiles().length;capture('plasma');capture('rail');assert.strictEqual(T.getProjectiles().length,p0);});
ok('48 expirada não é executada',()=>{fresh();const p0=T.getProjectiles().length;capture('shotgun');X('temporalActionTick(99)');assert.strictEqual(T.getProjectiles().length,p0);});
ok('49 input do B não chama captura diretamente',()=>{const s=normalizeSource(SRC);assert.ok(!/KeyR[^\n]{0,160}temporalAction/.test(s));assert.ok(!/temporalAction[^\n]{0,160}KeyR/.test(s));});
ok('50 replay do B permanece fora da captura A',()=>{const s=normalizeSource(SRC);assert.ok(!/function temporalActionReplay\s*\(/.test(s));assert.ok(/source:TEMPORAL_ACTION_SOURCES\.REPLAY/.test(s));assert.ok(!section('temporalActionCapture').includes('projectiles.push'));});

console.log('\nPR15.7-A — '+passed+' PASSARAM · '+failed+' FALHARAM\n');
if(failed)process.exit(1);
