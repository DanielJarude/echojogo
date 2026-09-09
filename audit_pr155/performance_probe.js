/* ECHO — PERFORMANCE AUDIT #1. Ferramenta EXTERNA, não carregada/empacotada
   no jogo. Cole este arquivo como Snippet no DevTools do Electron em DEV.
   __ECHO_PERF_AUDIT1.start(); jogar; .snapshot(); .stop().
   Tempos inclusivos de CPU/submissão Canvas, NÃO tempo de GPU nem FPS.
   Nenhum timer/RAF/listener próprio. Wrappers só enquanto start estiver ativo. */
(function(root){
  'use strict';
  if(typeof DEV_MODE==='undefined'||!DEV_MODE)throw new Error('AUDITORIA: ative DEV antes de instalar a sonda.');
  if(root.__ECHO_PERF_AUDIT1)return;
  const clock=()=>performance.now();
  const rows=Object.create(null),originals=Object.create(null);
  const names=['updatePlayer','updateEcho','updateEnemy','updateBoss','updateMiniBoss',
    'updateProjectiles','updateSwings','updateArcs','updateOrbs','updatePickups',
    'updateAllies','updateResonance','tickArenaEvent','tickMicroEvents',
    'factionPresenceUpdateEntity','pr15PresUpdate','pr15IntentUpdate',
    'render','drawGrid','drawEnemy','drawBoss','drawMiniBoss','drawProjectile',
    'drawWorldExtras','factionPresenceDrawEntity','drawEchoEntity','drawPlayer','drawBeamFrom','drawSwings','drawArcs',
    'drawStatus','speechRender','pr15PresDraw','pr15IntentDraw','pr15IntentEdge',
    'updateHUD','fracHudChip','fractureHudChip','sheetRender','devTick'];
  for(const name of ['frame_total','update_total','fx_update',...names])rows[name]={n:0,total:0,max:0};
  let active=false,oldLoop=null,wrappedLoop=null;
  function record(name,elapsed){
    if(!Number.isFinite(elapsed)||elapsed<0)return;
    const r=rows[name];r.n++;r.total+=elapsed;if(elapsed>r.max)r.max=elapsed;
  }
  function wrap(name,fn){return function(){
    if(!DEV_MODE){api.stop();return fn.apply(this,arguments);}
    const t=clock();try{return fn.apply(this,arguments);}finally{record(name,clock()-t);}
  };}
  const api={
    start(){
      if(!DEV_MODE)throw new Error('AUDITORIA: instrumentação restrita a DEV.');
      if(active)return false;
      // Apenas a cópia em memória do loop. Falha fechada se os marcadores mudarem.
      oldLoop=loop;
      let source=oldLoop.toString();
      const replace=(from,to)=>{if(!source.includes(from))throw new Error('Marcador ausente: '+from);source=source.replace(from,to);};
      replace('requestAnimationFrame(loop);','if(!DEV_MODE){const original=oldLoop;api.stop();return original(now); }\n  requestAnimationFrame(loop);');
      replace('try{\n  let raw=', 'try{\n  const __auditFrame=clock();\n  let raw=');
      replace('const pFr=Math.pow(.05,dt);','const __auditFx=clock();\n  const pFr=Math.pow(.05,dt);');
      replace('try{render();}',"record('fx_update',clock()-__auditFx);\n  record('update_total',clock()-__auditFrame);\n  try{render();}");
      replace('devTick(raw);',"devTick(raw);\n  record('frame_total',clock()-__auditFrame);");
      wrappedLoop=eval('('+source+')'); // lexical clock/record; nenhum RAF adicional
      for(const name of names){
        if(typeof root[name]!=='function')continue;
        originals[name]=root[name];root[name]=wrap(name,originals[name]);
      }
      loop=wrappedLoop;active=true;api.reset();return true;
    },
    stop(){
      if(!active)return false;
      for(const name of names)if(originals[name]){root[name]=originals[name];delete originals[name];}
      if(loop===wrappedLoop)loop=oldLoop;
      wrappedLoop=null;oldLoop=null;active=false;return true;
    },
    reset(){for(const name in rows){const r=rows[name];r.n=0;r.total=0;r.max=0;}},
    snapshot(){
      const sections={};
      for(const name in rows){const r=rows[name];sections[name]={chamadas:r.n,totalMs:r.total,mediaMs:r.n?r.total/r.n:0,maxMs:r.max};}
      return {ativo:active,nota:'Tempos inclusivos; não somar pai e filho. Sem histórico. GPU/GC não isolados.',secoes:sections};
    },
    get active(){return active;}
  };
  root.__ECHO_PERF_AUDIT1=api;
})(globalThis);
