'use strict';
/* PR15.5-A — fundação visual: estado, timeline, pose, eventos e invariantes. */
const assert=require('assert');
const {T,SRC,sandbox}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
const finite=o=>Object.values(o).filter(v=>typeof v==='number').every(Number.isFinite);
const near=(a,b,e=1e-9)=>Math.abs(a-b)<=e;
function entity(){return{x:100,y:80,aim:.25,r:13,hp:100,maxHp:100,spawnT:0,dead:false,phaseT:0,flashT:0,slowT:0,touchCd:0,vx:0,vy:0,type:'chaser',color:'#fff',spd:100,dmg:10,xp:1,strafe:1,fireT:9,st:null};}
console.log('\nECHO — PR15.5-A · FUNDAÇÃO VISUAL');

// A · visual state (15 checks)
ok('A01 inicializa objeto O(1)',()=>assert.strictEqual(typeof T.visualState(entity()),'object'));
ok('A02 estado inicial idle',()=>assert.strictEqual(T.visualState(entity()).state,'idle'));
ok('A03 defaults finitos',()=>assert.ok(finite(T.visualState(entity()))));
ok('A04 sem arrays no estado',()=>assert.ok(!Object.values(T.visualState(entity())).some(Array.isArray)));
ok('A05 inicialização idempotente',()=>{const e=entity(),v=T.visualState(e);assert.strictEqual(T.visualState(e),v);});
ok('A06 reset troca objeto',()=>{const e=entity(),v=T.visualState(e);assert.notStrictEqual(T.visualReset(e),v);});
ok('A07 reset volta a idle',()=>{const e=entity();T.visualNotify(e,'hurt',{});assert.strictEqual(T.visualReset(e).state,'idle');});
ok('A08 estado desconhecido cai em idle',()=>{const e=entity();assert.strictEqual(T.visualTimelineStart(e,'???',1).state,'idle');});
ok('A09 duração negativa é protegida',()=>{const e=entity();assert.strictEqual(T.visualTimelineStart(e,'hurt',-2).duration,0);});
ok('A10 NaN é protegido',()=>{const e=entity();assert.ok(finite(T.visualTimelineStart(e,'hurt',NaN)));});
ok('A11 Infinity é protegido',()=>{const e=entity();assert.ok(finite(T.visualTimelineStart(e,'hurt',Infinity)));});
ok('A12 null é seguro',()=>assert.strictEqual(T.visualState(null),null));
ok('A13 reset null é seguro',()=>assert.strictEqual(T.visualReset(null),null));
ok('A14 evento substitui anterior sem crescer',()=>{const e=entity();for(let i=0;i<1000;i++)T.visualNotify(e,'hurt',{x:i});assert.ok(!Object.values(e.visual).some(Array.isArray));});
ok('A15 conjunto contém estados previstos',()=>['idle','move','windup','active','recover','hurt','dying','spawn','recoil','charge'].forEach(k=>assert.ok(T.VISUAL_STATES[k])));

// B · timeline (18 checks)
ok('B01 progresso inicial zero',()=>{const e=entity();T.visualTimelineStart(e,'windup',1);assert.strictEqual(T.visualTimelineProgress(e),0);});
ok('B02 progresso intermediário',()=>{const e=entity();T.visualTimelineStart(e,'active',2);T.visualTimelineTick(e,.5);assert.ok(near(T.visualTimelineProgress(e),.25));});
ok('B03 progresso final um',()=>{const e=entity();T.visualTimelineStart(e,'recover',1);T.visualTimelineTick(e,1);assert.strictEqual(T.visualTimelineProgress(e),1);});
ok('B04 término desativa',()=>{const e=entity();T.visualTimelineStart(e,'recover',1);T.visualTimelineTick(e,2);assert.strictEqual(e.visual.active,false);});
ok('B05 término retorna idle',()=>{const e=entity();T.visualTimelineStart(e,'recover',1);T.visualTimelineTick(e,2);assert.strictEqual(e.visual.state,'idle');});
ok('B06 dt grande satura t',()=>{const e=entity();T.visualTimelineStart(e,'active',1);T.visualTimelineTick(e,999);assert.strictEqual(e.visual.t,1);});
ok('B07 dt zero não avança',()=>{const e=entity();T.visualTimelineStart(e,'active',1);T.visualTimelineTick(e,0);assert.strictEqual(e.visual.t,0);});
ok('B08 dt negativo não avança',()=>{const e=entity();T.visualTimelineStart(e,'active',1);T.visualTimelineTick(e,-1);assert.strictEqual(e.visual.t,0);});
ok('B09 dt NaN não avança',()=>{const e=entity();T.visualTimelineStart(e,'active',1);T.visualTimelineTick(e,NaN);assert.strictEqual(e.visual.t,0);});
ok('B10 dt Infinity não contamina',()=>{const e=entity();T.visualTimelineStart(e,'active',1);T.visualTimelineTick(e,Infinity);assert.ok(finite(e.visual));});
ok('B11 cancelamento desativa',()=>{const e=entity();T.visualTimelineStart(e,'active',1);assert.strictEqual(T.visualTimelineCancel(e).active,false);});
ok('B12 cancelamento zera progresso',()=>{const e=entity();T.visualTimelineStart(e,'active',1);T.visualTimelineTick(e,.5);T.visualTimelineCancel(e);assert.strictEqual(T.visualTimelineProgress(e),0);});
ok('B13 fase é armazenada',()=>{const e=entity();assert.strictEqual(T.visualTimelineStart(e,'windup',1,2).phase,2);});
ok('B14 fase limpa no término',()=>{const e=entity();T.visualTimelineStart(e,'windup',1,2);T.visualTimelineTick(e,1);assert.strictEqual(e.visual.phase,0);});
ok('B15 easeIn consultável',()=>{const e=entity();T.visualTimelineStart(e,'active',1);T.visualTimelineTick(e,.5);assert.ok(near(T.visualTimelineProgress(e,'easeIn'),.25));});
ok('B16 easing desconhecido usa linear',()=>{const e=entity();T.visualTimelineStart(e,'active',1);T.visualTimelineTick(e,.4);assert.ok(near(T.visualTimelineProgress(e,'x'),.4));});
ok('B17 duração zero termina deterministicamente',()=>{const e=entity();T.visualTimelineStart(e,'active',0);assert.strictEqual(T.visualTimelineProgress(e),1);});
ok('B18 tick null é seguro',()=>assert.strictEqual(T.visualTimelineTick(null,.1),null));

// C · easing (20 checks: 4 por easing)
for(const name of Object.keys(T.VISUAL_EASING)){
  const f=T.VISUAL_EASING[name];
  ok('C '+name+' limite 0',()=>assert.ok(Number.isFinite(f(0))&&near(f(0),0)));
  ok('C '+name+' limite 1',()=>assert.ok(Number.isFinite(f(1))&&near(f(1),1)));
  ok('C '+name+' protege NaN/Infinity',()=>[NaN,Infinity,-Infinity].forEach(v=>assert.ok(Number.isFinite(f(v)))));
  ok('C '+name+' amostras finitas',()=>{for(let i=0;i<=100;i++)assert.ok(Number.isFinite(f(i/100)));});
}
ok('C monotonicidade linear/in/out/inOut',()=>['linear','easeIn','easeOut','easeInOut'].forEach(n=>{let last=-1;for(let i=0;i<=100;i++){const v=T.VISUAL_EASING[n](i/100);assert.ok(v>=last-1e-12);last=v;}}));

// D · pose (16 checks)
ok('D01 pose neutra offset',()=>{const p=T.visualPose();assert.deepStrictEqual([p.offsetX,p.offsetY],[0,0]);});
ok('D02 pose neutra escala',()=>{const p=T.visualPose();assert.deepStrictEqual([p.scaleX,p.scaleY],[1,1]);});
ok('D03 pose neutra alpha',()=>assert.strictEqual(T.visualPose().alpha,1));
ok('D04 rotation preservada',()=>assert.strictEqual(T.visualPose({rotation:.7}).rotation,.7));
ok('D05 offsets preservados',()=>assert.deepStrictEqual([T.visualPose({offsetX:2,offsetY:-3}).offsetX,T.visualPose({offsetX:2,offsetY:-3}).offsetY],[2,-3]));
ok('D06 squash/stretch preservados',()=>{const p=T.visualPose({squash:.2,stretch:.3});assert.deepStrictEqual([p.squash,p.stretch],[.2,.3]);});
ok('D07 lean preservado',()=>assert.strictEqual(T.visualPose({lean:.4}).lean,.4));
ok('D08 recoil não negativo',()=>assert.strictEqual(T.visualPose({recoil:-1}).recoil,0));
ok('D09 alpha limitado baixo',()=>assert.strictEqual(T.visualPose({alpha:-2}).alpha,0));
ok('D10 alpha limitado alto',()=>assert.strictEqual(T.visualPose({alpha:2}).alpha,1));
ok('D11 escala não zera',()=>assert.ok(T.visualPose({scaleX:0,scaleY:-2}).scaleX>0&&T.visualPose({scaleY:-2}).scaleY>0));
ok('D12 valores inválidos ficam finitos',()=>assert.ok(finite(T.visualPose({rotation:NaN,offsetX:Infinity,alpha:NaN}))));
ok('D13 composição soma offsets/rotação',()=>{const p=T.visualPoseCompose({offsetX:2,rotation:.2},{offsetX:3,rotation:.4});assert.ok(near(p.offsetX,5)&&near(p.rotation,.6));});
ok('D14 composição multiplica escala/alpha',()=>{const p=T.visualPoseCompose({scaleX:2,alpha:.5},{scaleX:.5,alpha:.5});assert.ok(near(p.scaleX,1)&&near(p.alpha,.25));});
ok('D15 pose não altera posição/hitbox',()=>{const e=entity(),before=[e.x,e.y,e.r];T.visualPose({offsetX:99,scaleX:4});assert.deepStrictEqual([e.x,e.y,e.r],before);});
ok('D16 hurt pose é sutil e finita',()=>{const e=entity();T.visualNotify(e,'hurt',{x:0,y:80});const p=T.visualHurtPose(e);assert.ok(finite(p)&&Math.abs(p.offsetX)<=.7&&Math.abs(p.rotation)<=.018);});

// E/F · integrações reais
ok('E01 damageEnemy registra hurt',()=>{T.startRun();const e=T.spawnEnemy('chaser',300,300,1);e.spawnT=0;T.damageEnemy(e,1,200,300,false,false);assert.strictEqual(e.visual.event,'hurt');});
ok('E02 hurt preserva flash legado',()=>{T.startRun();const e=T.spawnEnemy('chaser',300,300,1);e.spawnT=0;T.damageEnemy(e,1,200,300,false,false);assert.ok(e.flashT>0);});
ok('E03 dano permanece exato',()=>{T.startRun();const e=T.spawnEnemy('chaser',300,300,1);e.spawnT=0;const hp=e.hp;T.damageEnemy(e,1,200,300,false,false);assert.ok(near(e.hp,hp-1));});
ok('E04 reação expira',()=>{const e=entity();T.visualNotify(e,'hurt',{duration:.1});T.visualTimelineTick(e,.2);assert.strictEqual(e.visual.event,'');});
ok('E05 hits repetidos continuam O(1)',()=>{const e=entity();for(let i=0;i<10000;i++)T.visualNotify(e,'hurt',{x:i,y:i});assert.ok(Object.keys(e.visual).length<=20&&!Object.values(e.visual).some(Array.isArray));});
ok('F01 fire gera recoil visual',()=>{T.startRun();const p=T.getPlayer(),w=T.WEAPONS[0];T.fireWeaponFrom(p,w,'ally',1);assert.strictEqual(T.visualWeaponRecoil(p),1);});
ok('F02 recoil visual recupera',()=>{const e=entity();T.visualNotify(e,'weaponFire',{});T.visualTimelineTick(e,1);assert.strictEqual(T.visualWeaponRecoil(e),0);});
ok('F03 projectile spawn preservado',()=>{T.startRun();const p=T.getPlayer(),w=T.WEAPONS.find(x=>x.id==='shotgun');T.setProjectiles([]);T.fireWeaponFrom(p,w,'ally',1);assert.strictEqual(T.getProjectiles().length,7);});
ok('F04 origem mecânica preservada',()=>{T.startRun();const p=T.getPlayer(),w=T.WEAPONS[0];p.aim=0;T.setProjectiles([]);T.fireWeaponFrom(p,w,'ally',1);assert.ok(near(T.getProjectiles()[0].x,p.x+p.r+6));});
ok('F05 dano de projétil preservado',()=>{T.startRun();const p=T.getPlayer(),w=T.WEAPONS[0];p.crit=0;T.setProjectiles([]);T.fireWeaponFrom(p,w,'ally',1);assert.strictEqual(T.getProjectiles()[0].dmg,w.dmg);});
ok('F06 cadência declarativa intacta',()=>assert.strictEqual(T.WEAPONS[0].interval,.16));
ok('F07 melee não cria projétil',()=>{T.startRun();const p=T.getPlayer(),w=T.WEAPONS.find(x=>x.id==='blade');T.setProjectiles([]);T.fireWeaponFrom(p,w,'ally',1);assert.strictEqual(T.getProjectiles().length,0);});
ok('F08 melee mantém alcance/arco/dano',()=>{const w=T.WEAPONS.find(x=>x.id==='blade');assert.deepStrictEqual([w.reach,w.arc,w.dmg],[104,1.55,46]);});

// G/H/I · pureza, persistência e stress
ok('G01 drawEnemy não muda combate',()=>{const e=entity();T.visualNotify(e,'hurt',{x:0,y:0});const b=JSON.stringify(e);T.drawEnemy(e);assert.strictEqual(JSON.stringify(e),b);});
ok('G02 helpers novos não usam Math.random',()=>{const b=SRC.slice(SRC.indexOf('PR15.5-A · FUNDAÇÃO'),SRC.indexOf('ESCALONAMENTO INCREMENTAL'));assert.ok(!/Math\.random|Date\.now|performance\.now/.test(b));});
ok('G03 visual hurt não muda HP/posição/cooldown',()=>{const e=entity(),b=[e.hp,e.x,e.y,e.fireT];T.visualHurtPose(e);assert.deepStrictEqual([e.hp,e.x,e.y,e.fireT],b);});
ok('H01 checkpoint não contém visual',()=>{T.startRun();T.visualNotify(T.getPlayer(),'weaponFire',{});const cp=T.smBuildCheckpoint();assert.ok(!JSON.stringify(cp).includes('"visual"'));});
ok('H02 contratos não serializam visual',()=>assert.ok(!/visual\s*:/.test(SRC.slice(SRC.indexOf('function smBuildCheckpoint'),SRC.indexOf('function smBuildCheckpoint')+9000))));
ok('H03 perfil inimigo cobre 11 tipos',()=>assert.strictEqual(Object.keys(T.ENEMY_VISUAL_PROFILES).length,11));
ok('H04 perfil arma referencia definição',()=>{const w=T.WEAPONS.find(x=>x.id==='hammer'),p=T.weaponVisualProfile(w);assert.strictEqual(p.meleeMotion,w.sprite);});
ok('I01 stress 46 entidades × 5000 frames',()=>{const es=Array.from({length:46},(_,i)=>Object.assign(entity(),{x:i,y:i}));for(const e of es)T.visualNotify(e,'hurt',{});for(let f=0;f<5000;f++)for(const e of es)T.visualTimelineTick(e,.016);for(const e of es)assert.ok(finite(e.visual)&&!Object.values(e.visual).some(Array.isArray));});
ok('I02 cleanup após stress',()=>{const e=entity();T.visualNotify(e,'weaponFire',{});for(let i=0;i<1000;i++)T.visualTimelineTick(e,.016);assert.ok(e.visual.event===''&&e.visual.recoil===0&&!e.visual.active);});
ok('I03 assinatura mecânica dos inimigos intacta',()=>assert.strictEqual(Object.entries(T.EDEFS).map(([k,d])=>[k,d.hp,d.spd,d.r,d.dmg].join(':')).join('|'),'chaser:26:238:13:10|shooter:36:150:15:8|tank:180:66:27:32|spawner:210:34:24:12|anomaly:44:186:14:18|swarm:12:322:9:6|orbiter:34:205:12:9|bulwark:78:112:18:16|splitter:62:168:16:13|phantom:52:212:13:15|singular:190:96:24:24'));
ok('I04 catálogo permanece 27 armas',()=>assert.strictEqual(T.WEAPONS.length,27));
ok('I05 catálogo permanece 8 minibosses',()=>assert.strictEqual(T.MINIBOSS.length,8));

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
