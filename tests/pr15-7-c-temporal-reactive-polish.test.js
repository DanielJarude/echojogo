'use strict';
/* PR15.7-C — polimento reativo mínimo da Repetição Ancorada. */
const assert=require('assert');
const vm=require('vm');
const {sandbox,T,SRC,normalizeSource}=require('../audit_pr135/harness.js');
const REG=require('./suite-registry.js');
const X=code=>vm.runInContext(code,sandbox);
const J=code=>JSON.parse(X('JSON.stringify('+code+')'));
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
function body(name){const s=normalizeSource(SRC),i=s.indexOf('function '+name+'(');if(i<0)return '';const j=s.indexOf('\nfunction ',i+10);return s.slice(i,j<0?s.length:j);}
function method(name){const s=normalizeSource(SRC),i=s.indexOf('\n  '+name+'(');if(i<0)return '';const j=s.indexOf('\n  }',i+5);return s.slice(i,j<0?s.length:j+4);}
function fresh(){
  T.setSandboxRun(false);T.setDevTainted(false);T.setEchoQueue([]);
  T.startRun({operatorId:'vector',freshMeta:true,noEchoes:true});
  T.setState('play');T.setEnemies([]);T.setProjectiles([]);T.setRunTime(10);
  X('temporalReplayReset("test");runTime=10;globalThis.__cSfx=0;AUDIO.temporalReplay=function(){globalThis.__cSfx++;}');
  return T.getPlayer();
}
function wi(id){return X('WEAPONS.findIndex(function(w){return w.id==='+JSON.stringify(id)+';})');}
function cap(id='plasma'){return X('(function(){var d=WEAPONS['+wi(id)+'];return temporalActionCapture(player,d,"ally",calcDamageMul(player),"player")})()');}
function use(){return X('temporalReplayTry("test")');}
function tps(){return T.getProjectiles().filter(p=>p.temporalReplay);}
function spawnPresence(){
  T.setEchoQueue([{id:'e1-c',trail:[[0,300,300]],op:'vector',theme:'anomaly',
    arch:{dom:'balanced'},sigW:'plasma',cause:'enemy',moral:{ordem:1}}]);
  return X('!!pr15PresSpawn({id:"p-c",mem:"e1-c",src:"n1",res:"normal",seed:157,intent:42,wave:4})');
}
function presMechanical(){return J('({x:pr15Presence.x,y:pr15Presence.y,hx:pr15Presence.hx,hy:pr15Presence.hy,'+
  'age:pr15Presence.age,ttl:pr15Presence.ttl,phase:pr15Presence.phase,memoryId:pr15Presence.memoryId,'+
  'source:pr15Presence.source,resonance:pr15Presence.resonance,intentSeed:pr15Presence.intentSeed,'+
  'intent:pr15Presence.it?{kind:pr15Presence.it.kind,variant:pr15Presence.it.variant,st:pr15Presence.it.st}:null,'+
  'bud:pr15IntentRun&&pr15IntentRun.bud?pr15IntentRun.bud:null})');}

console.log('\nECHO — PR15.7-C · POLIMENTO REATIVO TEMPORAL');

ok('01 suíte é descoberta pelo npm test',()=>assert.ok(REG.suiteIsDiscovered('pr15-7-c-temporal-reactive-polish')));
ok('02 uso válido preserva quantidade do Plasma',()=>{fresh();cap();assert.strictEqual(use(),1);assert.strictEqual(tps().length,1);});
ok('03 uso válido preserva quantidade determinística do Shotgun',()=>{fresh();cap('shotgun');const n=use();assert.ok(n>1);assert.strictEqual(tps().length,n);});
ok('04 dano temporal continua 0.50',()=>assert.strictEqual(X('TEMPORAL_REPLAY_DAMAGE'),.5));
ok('05 janela continua 5 segundos',()=>assert.strictEqual(X('TEMPORAL_ACTION_WINDOW'),5));
ok('06 cooldown continua 6 segundos',()=>{fresh();cap();use();assert.strictEqual(X('temporalReplayCooldown'),6);});
ok('07 whitelist permanece exata',()=>assert.deepStrictEqual(Object.keys(J('TEMPORAL_ACTION_WEAPONS')).sort(),['plasma','rail','shotgun','sniper']));
ok('08 SFX ocorre exatamente uma vez por uso válido',()=>{fresh();cap();use();assert.strictEqual(X('__cSfx'),1);});
ok('09 SFX não ocorre em invalidUse sem ação',()=>{fresh();use();assert.strictEqual(X('__cSfx'),0);});
ok('10 SFX não ocorre durante capture',()=>{fresh();cap();assert.strictEqual(X('__cSfx'),0);});
ok('11 SFX não ocorre durante replace',()=>{fresh();cap();cap('rail');assert.strictEqual(X('__cSfx'),0);});
ok('12 SFX não ocorre durante expiry',()=>{fresh();cap();X('temporalActionTick(16)');assert.strictEqual(X('__cSfx'),0);});
ok('13 SFX dedicado usa Web Audio existente e sem timer',()=>{const b=method('temporalReplay');assert.match(b,/this\.tone\(/);assert.match(b,/this\.noise\(/);assert.ok(!/setTimeout|setInterval|loop/.test(b));});
ok('14 SFX respeita mute e suspensão por tone/noise',()=>{const b=method('temporalReplay'),tone=method('tone'),noise=method('noise');assert.ok(!b.includes('createOscillator'));assert.match(tone,/if\(!this\.ok\(\)\)return/);assert.match(noise,/if\(!this\.ok\(\)\|\|!this\.noiseBuf\)return/);});
ok('15 sem Presença replay funciona normalmente',()=>{fresh();assert.strictEqual(X('pr15Presence'),null);cap();assert.strictEqual(use(),1);assert.strictEqual(X('__cSfx'),1);});
ok('16 receptor sem Presença é no-op seguro',()=>{fresh();assert.strictEqual(X('pr15PresOnTemporalReplay()'),false);});
ok('17 com Presença a reação visual é armada',()=>{fresh();assert.ok(spawnPresence());cap();use();assert.strictEqual(X('pr15Presence.replayReactT'),X('PR15_PRES_REPLAY_REACT_TIME'));});
ok('18 uma ativação chama uma única notificação e um único SFX',()=>{const b=body('temporalReplayTry');assert.strictEqual((b.match(/AUDIO\.temporalReplay\(\)/g)||[]).length,1);assert.strictEqual((b.match(/pr15PresOnTemporalReplay\(\)/g)||[]).length,1);});
ok('19 reação não altera age',()=>{fresh();spawnPresence();const a=X('pr15Presence.age');cap();use();assert.strictEqual(X('pr15Presence.age'),a);});
ok('20 reação não altera ttl',()=>{fresh();spawnPresence();const a=X('pr15Presence.ttl');cap();use();assert.strictEqual(X('pr15Presence.ttl'),a);});
ok('21 reação não altera intenção nem variante',()=>{fresh();spawnPresence();const a=presMechanical().intent;cap();use();assert.deepStrictEqual(presMechanical().intent,a);});
ok('22 reação não altera memoryId, origem ou ressonância',()=>{fresh();spawnPresence();const a=presMechanical();cap();use();const b=presMechanical();assert.deepStrictEqual([b.memoryId,b.source,b.resonance],[a.memoryId,a.source,a.resonance]);});
ok('23 reação não altera posição lógica ou âncora móvel',()=>{fresh();spawnPresence();const a=presMechanical();cap();use();const b=presMechanical();assert.deepStrictEqual([b.x,b.y,b.hx,b.hy],[a.x,a.y,a.hx,a.hy]);});
ok('24 reação não altera budgets',()=>{fresh();spawnPresence();const a=presMechanical().bud;cap();use();assert.deepStrictEqual(presMechanical().bud,a);});
ok('25 reação não entra no checkpoint',()=>{fresh();spawnPresence();cap();use();const cp=J('smBuildCheckpoint("c",4)');assert.ok(!JSON.stringify(cp).includes('replayReact'));});
ok('26 reação decai naturalmente em poucos décimos',()=>{fresh();spawnPresence();X('pr15PresOnTemporalReplay();pr15PresUpdate(PR15_PRES_REPLAY_REACT_TIME/2)');const m=X('pr15Presence.replayReactT');assert.ok(m>0&&m<X('PR15_PRES_REPLAY_REACT_TIME'));X('pr15PresUpdate(PR15_PRES_REPLAY_REACT_TIME)');assert.strictEqual(X('pr15Presence.replayReactT'),0);});
ok('27 reação é eliminada no cleanup da Presença',()=>{fresh();spawnPresence();X('pr15PresOnTemporalReplay();pr15PresClear()');assert.strictEqual(X('pr15Presence'),null);});
ok('28 renderer da Presença reage sem partícula, blur ou filtro',()=>{const b=body('pr15PresDraw');assert.match(b,/p\.replayReactT>0/);const r=b.slice(b.indexOf('PR15.7-C'));assert.ok(!/spawnParticles|shadowBlur|filter\s*=/.test(r));});
ok('29 âncora B4 reutiliza o mesmo estado quando existe',()=>{const b=body('pr15IntentDraw');assert.match(b,/p\.replayReactT>0/);assert.match(b,/pr15IntentNodeOf\(p\)/);});
ok('30 receptor é O(1), sem busca espacial, array ou memória histórica',()=>{const b=body('pr15PresOnTemporalReplay');assert.ok(!/for\s*\(|while\s*\(|echoQueue|memoryId|dist2|projectiles/.test(b));});
ok('31 Fracture Director e intensidade não mudam',()=>{fresh();spawnPresence();const a=J('fractureSnapshot()');cap();use();assert.deepStrictEqual(J('fractureSnapshot()'),a);});
ok('32 estágio da Fratura não muda',()=>{fresh();spawnPresence();const a=J('fractureGetStage()');cap();use();assert.deepStrictEqual(J('fractureGetStage()'),a);});
ok('33 Echo não captura, ativa ou duplica',()=>{const e=body('updateEcho'),r=body('temporalReplayTry');assert.ok(!e.includes('temporalReplayTry')&&!e.includes('pr15PresOnTemporalReplay'));assert.ok(!r.includes('echoReact('));});
ok('34 nenhum itemEmit, Ressonância ou proc novo',()=>{const a=body('temporalReplayTry'),b=body('replayTemporalAction'),c=body('pr15PresOnTemporalReplay');for(const s of [a,b,c])assert.ok(!/itemEmit|triggerResonance|fireWeaponFrom\(/.test(s));});
ok('35 nenhuma entidade ou array de reação é criado',()=>{const b=body('pr15PresOnTemporalReplay');assert.ok(!/push\(|new\s+|\[\]/.test(b));assert.match(SRC,/replayReactT:0/);});
ok('36 cap de projéteis continua 8',()=>{fresh();cap('shotgun');X('temporalAction.payload.projectileCount=999');assert.strictEqual(use(),8);assert.strictEqual(tps().length,8);});
ok('37 run sem histórico mantém captura, replay, cooldown e SFX',()=>{fresh();assert.strictEqual(T.getEchoQueue().length,0);assert.ok(cap());assert.strictEqual(use(),1);assert.strictEqual(X('temporalReplayCooldown'),6);assert.strictEqual(X('__cSfx'),1);});
ok('38 projéteis preservam contrato sem crit/AOE/owner/def',()=>{fresh();cap();use();const p=tps()[0];assert.strictEqual(p.source,'temporalReplay');assert.strictEqual(p.crit,false);assert.strictEqual(p.aoe,0);assert.strictEqual(p.owner,null);assert.strictEqual(p.def,null);});
ok('39 reação não está no Fracture Director nem Memory Director',()=>{const f=SRC.slice(SRC.indexOf('PR 13 — DIRETOR DE FRATURA'),SRC.indexOf('PR15·b1'));const m=SRC.slice(SRC.indexOf('PR15·b2 — DIRECTOR'),SRC.indexOf('PR15·fim b2'));assert.ok(!f.includes('replayReactT'));assert.ok(!m.includes('replayReactT'));});
ok('40 HUD do Kit de Combate não foi usado como receptor',()=>{const b=body('updateAnchoredReplayHUD');assert.ok(!b.includes('replayReactT')&&!b.includes('temporalReplaySfx'));});

console.log('\nPR15.7-C — '+passed+' PASSARAM · '+failed+' FALHARAM\n');
if(failed)process.exit(1);
