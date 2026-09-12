'use strict';
/* PR15.5-A-FIX #1 — fast paths e custo conceitual da fundação visual. */
const assert=require('assert');
const {T,SRC,sandbox}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
function ent(){return{x:500,y:400,vx:0,vy:0,r:13,hp:100,maxHp:100,dmg:10,spd:0,xp:1,color:'#ff4d6d',aim:0,fireT:99,touchCd:0,slowT:0,spawnT:0,flashT:0,strafe:1,type:'chaser',st:null};}
function drawLog(e){globalThis.__ctxLog=[];T.drawEnemy(e);const l=globalThis.__ctxLog;globalThis.__ctxLog=null;return l;}
const count=(l,k)=>l.filter(x=>x[0]===k).length;
console.log('\nECHO — PR15.5-A-FIX #1 · PERFORMANCE');

ok('P01 visualPeek não cria estado',()=>{const e=ent();assert.strictEqual(T.visualPeek(e),null);assert.ok(!Object.prototype.hasOwnProperty.call(e,'visual'));});
ok('P02 tick sem estado não cria estado',()=>{const e=ent();assert.strictEqual(T.visualTimelineTick(e,.016),null);assert.ok(!Object.prototype.hasOwnProperty.call(e,'visual'));});
ok('P03 updateEnemy neutro não cria estado',()=>{T.startRun();const e=T.spawnEnemy('chaser',500,400,1);e.spawnT=0;T.updateEnemy(e,.016);assert.ok(!Object.prototype.hasOwnProperty.call(e,'visual'));});
ok('P04 drawEnemy neutro não cria estado',()=>{const e=ent();T.drawEnemy(e);assert.ok(!Object.prototype.hasOwnProperty.call(e,'visual'));});
ok('P05 46 updates neutros não criam estados',()=>{T.startRun();const es=[];for(let i=0;i<46;i++){const e=T.spawnEnemy('chaser',200+i*30,200,1);e.spawnT=0;es.push(e);}for(const e of es)T.updateEnemy(e,0);assert.strictEqual(es.filter(e=>e.visual).length,0);});
ok('P06 estado inativo usa fast path sem alterar campos',()=>{const e=ent(),v=T.visualState(e);v.t=.5;const before=JSON.stringify(v);assert.strictEqual(T.visualTimelineTick(e,.016),v);assert.strictEqual(JSON.stringify(v),before);});
ok('P07 estado inativo não valida dt NaN desnecessariamente',()=>{const e=ent(),v=T.visualState(e);T.visualTimelineTick(e,NaN);assert.ok(Object.values(v).filter(x=>typeof x==='number').every(Number.isFinite));});
ok('P08 hurt expirado retorna null na pose',()=>{const e=ent();T.visualNotifyHurt(e,0,0);T.visualTimelineTick(e,1);assert.strictEqual(T.visualHurtPose(e),null);});
ok('P09 recoil expirado retorna zero',()=>{const e=ent();T.visualNotifyWeaponFire(e);T.visualTimelineTick(e,1);assert.strictEqual(T.visualWeaponRecoil(e),0);});
ok('P10 draw idle sem estado não adiciona translate visual',()=>{const a=drawLog(ent()),e=ent();T.visualState(e);const b=drawLog(e);assert.strictEqual(count(a,'translate'),count(b,'translate'));});
ok('P11 draw idle sem estado não adiciona rotate visual',()=>{const a=drawLog(ent()),e=ent();T.visualState(e);const b=drawLog(e);assert.strictEqual(count(a,'rotate'),count(b,'rotate'));});
ok('P12 draw idle sem estado não adiciona scale visual',()=>{const a=drawLog(ent()),e=ent();T.visualState(e);const b=drawLog(e);assert.strictEqual(count(a,'scale'),count(b,'scale'));});
ok('P13 hurt ativo aplica exatamente um translate extra',()=>{const a=drawLog(ent()),e=ent();T.visualNotifyHurt(e,0,400);const b=drawLog(e);assert.strictEqual(count(b,'translate')-count(a,'translate'),1);});
ok('P14 hurt ativo aplica exatamente um rotate extra',()=>{const a=drawLog(ent()),e=ent();T.visualNotifyHurt(e,0,400);const b=drawLog(e);assert.strictEqual(count(b,'rotate')-count(a,'rotate'),1);});
ok('P15 hurt ativo aplica exatamente um scale extra',()=>{const a=drawLog(ent()),e=ent();T.visualNotifyHurt(e,0,400);const b=drawLog(e);assert.strictEqual(count(b,'scale')-count(a,'scale'),1);});
ok('P16 hurt expirado volta ao número original de transforms',()=>{const a=drawLog(ent()),e=ent();T.visualNotifyHurt(e,0,400);T.visualTimelineTick(e,1);const b=drawLog(e);assert.deepStrictEqual([count(b,'translate'),count(b,'rotate'),count(b,'scale')],[count(a,'translate'),count(a,'rotate'),count(a,'scale')]);});
ok('P17 helper de hurt ativo reutiliza scratch fornecido',()=>{const e=ent(),out={};T.visualNotifyHurt(e,0,0);assert.strictEqual(T.visualHurtPose(e,out),out);});
ok('P18 notificação especializada hurt não exige objeto data',()=>{const e=ent();assert.strictEqual(T.visualNotifyHurt(e,1,2),e.visual);});
ok('P19 notificação especializada fire não exige objeto data',()=>{const e=ent();assert.strictEqual(T.visualNotifyWeaponFire(e),e.visual);});
ok('P20 cache contém exatamente as 27 armas',()=>assert.strictEqual(T.WEAPON_VISUAL_PROFILE_CACHE.size,27));
ok('P21 perfil da mesma arma conserva identidade',()=>{const w=T.WEAPONS[0];assert.strictEqual(T.weaponVisualProfile(w),T.weaponVisualProfile(w));});
ok('P22 definição externa usa fallback sem crescer cache',()=>{const n=T.WEAPON_VISUAL_PROFILE_CACHE.size;const a=T.weaponVisualProfile({id:'x'}),b=T.weaponVisualProfile({id:'y'});assert.strictEqual(a,b);assert.strictEqual(T.WEAPON_VISUAL_PROFILE_CACHE.size,n);});
ok('P23 nenhum array cresce em 46 entidades por 5000 ticks idle',()=>{const es=Array.from({length:46},ent);for(const e of es)T.visualState(e);for(let f=0;f<5000;f++)for(const e of es)T.visualTimelineTick(e,.016);assert.ok(es.every(e=>!Object.values(e.visual).some(Array.isArray)));});
ok('P24 fast paths não usam Object keys/values/spread',()=>{const b=SRC.slice(SRC.indexOf('function visualPeek'),SRC.indexOf('function visualNotify(entity'));assert.ok(!/Object\.(keys|values|entries)|\.\.\./.test(b));});
ok('P25 draw condicional está explícito na fonte',()=>assert.ok(/if\(vp\)\{ctx\.translate/.test(SRC)&&/if\(pose\).*pose neutra/.test(SRC)));
ok('P26 gameplay: assinatura EDEFS intacta',()=>assert.strictEqual(Object.entries(T.EDEFS).map(([k,d])=>[k,d.hp,d.spd,d.r,d.dmg].join(':')).join('|'),'chaser:26:238:13:10|shooter:36:150:15:8|tank:150:66:27:32|spawner:125:34:24:12|anomaly:44:186:14:18|swarm:12:322:9:6|orbiter:34:205:12:9|bulwark:78:112:18:16|splitter:62:168:16:13|phantom:30:212:13:15|singular:190:96:24:24'));
ok('P27 gameplay: 27 armas e 8 minibosses',()=>assert.deepStrictEqual([T.WEAPONS.length,T.MINIBOSS.length],[27,8]));
ok('P28 nenhum NaN em stress ativo',()=>{const es=Array.from({length:46},ent);for(const e of es)T.visualNotifyHurt(e,0,0);for(let f=0;f<1000;f++)for(const e of es)T.visualTimelineTick(e,.016);assert.ok(es.every(e=>Object.values(e.visual).filter(x=>typeof x==='number').every(Number.isFinite)));});

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
