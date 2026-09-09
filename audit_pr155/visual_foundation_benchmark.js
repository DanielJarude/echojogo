'use strict';
/* PR15.5-B-FIX #1: auditoria determinística por operações/frame.
   Não mede ms e não estima FPS. Os custos B são a contagem do diff histórico;
   os custos B-FIX são verificados também pelo log real do Canvas mock. */
const {T,sandbox}=require('../audit_pr135/harness.js');
const TYPES=Object.keys(T.EDEFS);
function enemy(type){const d=T.EDEFS[type];return{x:500,y:400,aim:0,r:d.r,hp:d.hp,maxHp:d.hp,spawnT:0,flashT:0,slowT:0,touchCd:0,vx:0,vy:0,type,color:d.color,spd:d.spd,dmg:d.dmg,xp:d.xp,strafe:1,fireT:1,visualSeed:1,pullVisual:0,elite:null};}
function blank(){return{observe:0,states:0,poses:0,transforms:0,cues:0,paths:0,arcs:0,strokes:0,fills:0,saveRestore:0,sinCos:0,atan2:0,markers:0,swarmExtra:0,temporaries:0};}
function add(a,b,n=1){for(const k in a)a[k]+=(b[k]||0)*n;return a;}
const cue={
 contact:{observe:1,states:1,poses:1,transforms:2,saveRestore:2,temporaries:2},
 shooter:{observe:1,states:1,poses:1,transforms:1,cues:1,paths:2,arcs:1,strokes:1,fills:1,saveRestore:2,atan2:1,temporaries:4},
 orbiter:{observe:1,states:1,poses:1,transforms:2,cues:1,paths:2,strokes:2,saveRestore:2,sinCos:1,atan2:1,temporaries:4},
 phantom:{observe:1,states:1,poses:1,transforms:1,cues:1,paths:1,arcs:1,strokes:1,saveRestore:2,temporaries:3},
 singular:{observe:1,states:1,cues:1,paths:4,arcs:4,strokes:4,saveRestore:4,sinCos:6,atan2:1,markers:3,temporaries:8},
 swarm:{observe:1,states:1,poses:1,transforms:2,cues:1,paths:1,strokes:1,saveRestore:2,sinCos:1,swarmExtra:1,temporaries:3}
};
const scenarios=[
 {name:'mistura realista de 46',b:{contact:9,swarm:6,shooter:2,orbiter:2,phantom:1,singular:1},fix:{shooter:2,orbiter:2,phantom:1,singular:1}},
 {name:'contatos densos (46)',b:{contact:34,swarm:12},fix:{}},
 {name:'duas Singular dentro de 420',b:{singular:2},fix:{singular:2}},
 {name:'alta densidade Swarm (40)',b:{swarm:40},fix:{}},
 {name:'Shooter/Orbiter em windup (22)',b:{shooter:12,orbiter:10},fix:{shooter:12,orbiter:10}}
];
function historical(spec){const x=blank();for(const k in spec)add(x,cue[k],spec[k]);return x;}
function fixed(spec){const x=blank();x.observe=(spec.shooter||0)+(spec.orbiter||0)+(spec.phantom||0);x.states=x.observe;x.atan2=(spec.shooter||0)+(spec.orbiter||0);const n=spec.singular||0;x.paths=n;x.arcs=n;x.strokes=n;x.cues=n;x.temporaries=n;return x;}
function drawDelta(type,activate){const e=enemy(type);sandbox.__ctxLog=[];T.drawEnemy(e);const a=sandbox.__ctxLog.slice();activate(e);sandbox.__ctxLog=[];T.drawEnemy(e);const b=sandbox.__ctxLog.slice();sandbox.__ctxLog=null;const count=(L,k)=>L.filter(v=>v[0]===k).length;return{paths:count(b,'beginPath')-count(a,'beginPath'),arcs:count(b,'arc')-count(a,'arc'),strokes:count(b,'stroke')-count(a,'stroke'),fills:count(b,'fill')-count(a,'fill'),saveRestore:count(b,'save')+count(b,'restore')-count(a,'save')-count(a,'restore'),transforms:['translate','rotate','scale'].reduce((n,k)=>n+count(b,k)-count(a,k),0)};}
console.log('ECHO — PR15.5-B-FIX #1 · OPERAÇÕES EXTRAS POR FRAME');
console.log('A-FIX é 0 em todas as colunas: referência sem camada B.');
for(const s of scenarios){console.log('\n'+s.name);console.table({'A-FIX':blank(),'B rejeitado':historical(s.b),'B-FIX':fixed(s.fix)});}
console.log('\nVerificação dinâmica B-FIX (delta draw ativo − idle):');
console.table({
 Shooter:drawDelta('shooter',e=>T.visualAttackObserve(e,'windup',.8,0,560,'emitter-charge')),
 Orbiter:drawDelta('orbiter',e=>T.visualAttackObserve(e,'windup',.8,0,430,'satellite-align')),
 Phantom:drawDelta('phantom',e=>{e.ghostT=.2;T.visualAttackObserve(e,'windup',.8,0,13,'materialize');}),
 Swarm:drawDelta('swarm',e=>T.visualAttackObserve(e,'windup',.8,0,20,'contact')),
 Singular:drawDelta('singular',e=>{e.pullVisual=.8;})
});
console.log('\nNota: sin/cos/atan2 contabilizam apenas o custo EXTRA introduzido por B; trigonometria da arte/movimento já existente pertence ao baseline A-FIX.');
