'use strict';
/* Benchmark diagnóstico PR15.5-A-FIX #1. Não é teste de CI e não impõe ms. */
const {T}=require('../audit_pr135/harness.js');
const now=()=>process.hrtime.bigint();
const ms=n=>Number(n)/1e6;
function ent(){return{x:100,y:100,aim:0,r:13,hp:100,maxHp:100,spawnT:0,dead:false,phaseT:0,flashT:0,slowT:0,touchCd:0,vx:0,vy:0,type:'chaser',color:'#fff',spd:100,dmg:10,xp:1,strafe:1,fireT:9,st:null};}
function run(label,fn,n=200000){for(let i=0;i<2000;i++)fn();const samples=[];for(let r=0;r<7;r++){const a=now();for(let i=0;i<n;i++)fn();samples.push(ms(now()-a));}samples.sort((a,b)=>a-b);console.log(label.padEnd(42)+samples[3].toFixed(3)+' ms (mediana/7)');}
function scenario(n,mode){const es=Array.from({length:n},ent);if(mode==='inactive')for(const e of es)T.visualState(e);if(mode==='hurt')for(const e of es)T.visualNotifyHurt(e,0,0);return es;}
console.log('ECHO — benchmark diagnóstico PR15.5-A-FIX #1');
console.log('Tempos relativos locais; não representam FPS do Electron.\n');
for(const n of [1,10,46]){const es=scenario(n,'none');run('update visual '+n+' idle/sem state',()=>{for(const e of es)T.visualTimelineTick(e,.016);},Math.max(5000,200000/n));}
{const es=scenario(46,'inactive');run('46 idle/state criado inativo',()=>{for(const e of es)T.visualTimelineTick(e,.016);},10000);}
{const es=scenario(46,'hurt');run('46 hurt ativo (renovado por lote)',()=>{for(const e of es){if(!e.visual.active)T.visualNotifyHurt(e,0,0);T.visualTimelineTick(e,.016);}},10000);}
{const e=ent();run('pose idle fast path',()=>T.visualHurtPose(e),300000);}
{const e=ent();T.visualNotifyHurt(e,0,0);run('pose hurt + trigonometria',()=>T.visualHurtPose(e),300000);}
{const w=T.WEAPONS[0];run('profile lookup cacheado',()=>T.weaponVisualProfile(w),500000);}
{T.startRun();const p=T.getPlayer(),w=T.WEAPONS[0];T.setProjectiles([]);run('player dispara (inclui projétil)',()=>{T.fireWeaponFrom(p,w,'ally',1);T.getProjectiles().length=0;},10000);}
{T.startRun();const e=Object.assign(ent(),{slot:1,crit:0,critMul:1.8,pierce:0,rangeMul:1,projSpdMul:1,aoeMul:1}),w=T.WEAPONS[0];T.setProjectiles([]);run('Echo dispara (inclui projétil)',()=>{T.fireWeaponFrom(e,w,'ally',1);T.getProjectiles().length=0;},10000);}
{const idle=scenario(40,'none'),hurt=scenario(6,'hurt');run('stress misto 40 idle + 6 hurt',()=>{for(const e of idle)T.visualTimelineTick(e,.016);for(const e of hurt){if(!e.visual.active)T.visualNotifyHurt(e,0,0);T.visualTimelineTick(e,.016);}},10000);}
console.log('\nContadores conceituais por frame com 46 inimigos idle:');
console.log('ANTES FIX: states criados=46; validações tick=46; poses sanitizadas=46; transforms extras=138.');
console.log('DEPOIS FIX: states criados=0; ticks ativos=0; poses calculadas=0; transforms extras=0.');

console.log('\nPR15.5-B — escalabilidade de estados de ataque (lógica visual):');
function attackMix(active){
  const es=Array.from({length:46},ent);
  for(let i=0;i<active;i++)T.visualAttackObserve(es[i],'windup',.55,0,40,i%2?'satellite-align':'compress');
  return es;
}
for(const active of [0,6,23,46]){
  const es=attackMix(active);
  run((46-active)+' idle + '+active+' atacando',()=>{
    for(const e of es){T.visualTimelineTick(e,.016);if(e.visual&&e.visual.attackState)T.visualEnemyAttackPose(e,{});}
  },10000);
  console.log('  contadores: states='+active+' · poses='+active+' · transforms máx='+(active*3)+' · alocações/frame=0');
}
console.log('Telegraphs são calculados somente para entidades com attackState; draw idle não chama o helper.');
