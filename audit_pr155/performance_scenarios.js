/* ECHO — fixtures sintéticas de carga; EXCLUSIVAS de DEV + Sandbox.
   Não representam a distribuição de uma run humana. Não são carregadas pelo jogo.
   O stress respeita 46 inimigos; as 70+ entidades são inimigos + tiros + FX. */
(function(root){
  'use strict';
  const scenarios=[
    {id:'A',nome:'vazio',enemies:0,projectiles:0,parts:0,arcs:0,swings:0,texts:0},
    {id:'B',nome:'leve',enemies:10,projectiles:12,parts:40,arcs:1,swings:1,texts:4},
    {id:'C',nome:'médio',enemies:25,projectiles:60,parts:180,arcs:4,swings:2,texts:12},
    {id:'D',nome:'pesado',enemies:46,projectiles:150,parts:400,arcs:8,swings:4,texts:24},
    {id:'E',nome:'stress Sandbox',enemies:46,projectiles:260,parts:700,arcs:12,swings:6,texts:40},
    {id:'F',nome:'Swarm-heavy',enemies:46,projectiles:30,parts:100,arcs:0,swings:1,texts:8,types:['swarm']},
    {id:'G',nome:'projectile-heavy',enemies:46,projectiles:360,parts:100,arcs:3,swings:1,texts:12},
    {id:'H',nome:'FX-heavy',enemies:10,projectiles:20,parts:900,arcs:16,swings:8,texts:52,shards:true},
    {id:'I',nome:'2 Singular + ranged + Swarm',enemies:46,projectiles:150,parts:350,arcs:6,swings:3,texts:20,types:['shooter','orbiter','swarm']}
  ];
  const types=['chaser','shooter','tank','swarm','orbiter','bulwark','splitter','phantom'];
  function prepare(id){
    if(typeof DEV_MODE==='undefined'||!DEV_MODE||!sandboxRun)throw new Error('Fixtures exigem DEV + Sandbox; nunca usar em run legítima.');
    const s=scenarios.find(x=>x.id===id);if(!s)throw new Error('Cenário desconhecido: '+id);
    startRun({noEchoes:true,freshMeta:true});
    cfg.metrics=0;cfg.shake=0;cfg.aberr=0;audioOn=false;AUDIO.enabled=false;
    state='play';sandboxRun=true;bannerT=0;bannerEl.classList.remove('show');
    wave=10;wavePause=9999;waveActive=true;waveCleared=true;runTime=10;
    _progDirty=false;gateOn=false;refreshProbe=40;dtSmooth=0;last=1000;frameGate=1000;
    perfTime=0;perfFrames=0;perfCooldown=9999;
    player.x=ARENA.w/2;player.y=ARENA.h/2;player.invT=9999;
    cam.x=player.x;cam.y=player.y;player.ghosts.length=0;
    enemies=[];projectiles=[];parts=[];arcs=[];swings=[];ftexts=[];xporbs=[];pickups=[];allies=[];
    const bag=s.types||types;
    for(let i=0;i<s.enemies;i++){
      const type=s.id==='I'&&i<2?'singular':bag[i%bag.length];
      spawnEnemy(type,player.x-350+(i%10)*70,player.y-220+Math.floor(i/10)*65,10);
      const e=enemies[enemies.length-1];e.spawnT=0;e.fireT=2;e.flashT=0;e.phase0=i*.37;e.wob=1;
      if(type==='singular')e.pullVisual=.5;
    }
    // Todos amigos, em corredor sem alvos: percorrem candidatos sem mortes
    // na amostra estrutural. Fixtures usam definições e velocidades existentes.
    const def=WEAPONS[0];
    for(let i=0;i<s.projectiles;i++)projectiles.push({
      x:player.x-380+(i%30)*25,y:player.y+170+Math.floor(i/30)*6,
      vx:def.speed,vy:0,r:def.pr,dmg:def.dmg,life:def.life,type:'plasma',team:'ally',color:def.color,
      owner:player,def,crit:false,pierce:0,hits:null,dist:0,maxDist:def.range
    });
    for(let i=0;i<s.parts;i++){
      const p=partTake();p.x=player.x-400+(i%40)*20;p.y=player.y-250+Math.floor(i/40)*20;
      p.vx=20;p.vy=10;p.t=.1;p.life=1;p.r=3;p.color=i%2?'#46e0ff':'#ff5c7a';
      p.ring=!s.shards&&i%6===0;p.shard=s.shards||i%3===0;
      if(p.ring)p.shard=false;
      p.r0=5;p.r1=30;p.size=4;p.rot=i*.1;p.spin=1;p.sides=3+i%3;parts.push(p);
    }
    for(let i=0;i<s.arcs;i++)arcs.push({x1:player.x-220,y1:player.y-100+i*8,x2:player.x+160,y2:player.y-70+i*8,t:.01,life:.18,color:'#ffe74d'});
    for(let i=0;i<s.swings;i++)swings.push({x:player.x+(i-2)*80,y:player.y,aim:0,arc:1.5,reach:90,t:.01,life:.3,color:'#46e0ff'});
    for(let i=0;i<s.texts;i++)ftexts.push({x:player.x-300+i*12,y:player.y-160,txt:'12',t:.1,life:1.1,sz:0,color:'#dff4ff'});
    // Resíduos positivos exercitam o wrapper de HUD que não tinha throttle.
    if(fracRun)fracRun.res=123;
    return s;
  }
  root.__ECHO_AUDIT_FIXTURES={scenarios,prepare};
})(globalThis);
