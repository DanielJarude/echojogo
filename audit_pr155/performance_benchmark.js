'use strict';
/* Auditoria reprodutível sem dependências novas do jogo.
   node audit_pr155/performance_benchmark.js [--ref <commit>] [--json <arquivo>]
   Canvas mock = operações, NÃO tempo de rasterização nem FPS Electron. */
const fs=require('fs'),path=require('path'),vm=require('vm'),Module=require('module');
const {execFileSync}=require('child_process');
const {performance}=require('perf_hooks');
const crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..');
function readSource(ref){return (ref?execFileSync('git',['show',ref+':index.html'],{cwd:ROOT,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(ROOT,'index.html'),'utf8')).replace(/\r\n?/g,'\n');}
function world(source){
  const filename=path.join(ROOT,'audit_pr135/harness.js');
  let code=fs.readFileSync(filename,'utf8');
  code=code.replace(/^const html=.*;$/m,()=> 'const html='+JSON.stringify(source)+';');
  const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;m._compile(code,filename);
  const h=m.exports;
  h.sandbox.Math=Object.create(Math);h.sandbox.performance.now=()=>performance.now();
  let seed=1;
  h.sandbox.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  h.seed=v=>{seed=v>>>0;};h.run=code=>vm.runInContext(code,h.sandbox);
  h.run('DEV_MODE=true;sandboxRun=true;');
  h.run(fs.readFileSync(path.join(__dirname,'performance_scenarios.js'),'utf8'));
  h.run(fs.readFileSync(path.join(__dirname,'performance_probe.js'),'utf8'));
  return h;
}
function summarize(log){
  const counts={save:0,restore:0,paths:0,arcs:0,drawImage:0,fill:0,stroke:0,text:0,transforms:0,stateWrites:0,blurWrites:0,shadowDraws:0};
  let blur=0;const stack=[];
  for(const [op,args] of log){
    if(op==='save'){counts.save++;stack.push(blur);}else if(op==='restore'){counts.restore++;blur=stack.pop()||0;}
    else if(op==='beginPath')counts.paths++;
    else if(op==='arc')counts.arcs++;
    else if(op==='drawImage')counts.drawImage++;
    else if(op==='fill'||op==='fillRect')counts.fill++;
    else if(op==='stroke'||op==='strokeRect')counts.stroke++;
    else if(op==='fillText')counts.text++;
    if(['translate','rotate','scale','setTransform','transform'].includes(op))counts.transforms++;
    if(op.startsWith('set:'))counts.stateWrites++;
    if(op==='set:shadowBlur'){counts.blurWrites++;blur=args[0];}
    if(blur>0&&['fill','stroke','fillRect','strokeRect','fillText','drawImage'].includes(op))counts.shadowDraws++;
  }
  return counts;
}
function measure(h,code){
  const trig={sin:0,cos:0,atan2:0,hypot:0,sqrt:0,random:0};
  const originals={};
  for(const key in trig){const fn=h.sandbox.Math[key];originals[key]=fn;h.sandbox.Math[key]=function(){trig[key]++;return fn.apply(this,arguments);};}
  h.sandbox.__ctxLog=[];
  try{h.run(code);const log=h.sandbox.__ctxLog;return {canvas:summarize(log),trig,hashCanvas:crypto.createHash('sha256').update(JSON.stringify(log)).digest('hex')};}
  finally{h.sandbox.__ctxLog=null;for(const key in originals)h.sandbox.Math[key]=originals[key];}
}
function hudWrites(h){
  h.run("__ECHO_AUDIT_FIXTURES.prepare('A');updateHUD(true);");
  const ids=['hpnum','shnum','wave','timer','lvl','dashlbl','splbl','chip1','chip2','coinsp','moral-dom','frac-hud-res'];
  let writes=0;const restore=[];
  for(const id of ids){
    const el=h.sandbox.document.getElementById(id);let value=el.textContent;
    restore.push(()=>Object.defineProperty(el,'textContent',{configurable:true,writable:true,value}));
    Object.defineProperty(el,'textContent',{configurable:true,get:()=>value,set:v=>{writes++;value=v;}});
  }
  try{h.run('for(var __hudI=0;__hudI<120;__hudI++)updateHUD(true);');return writes;}
  finally{for(const fn of restore)fn();}
}
function report(source){
  const h=world(source),results=[];
  const scenarios=h.sandbox.__ECHO_AUDIT_FIXTURES.scenarios;
  for(const s of scenarios){
    h.seed(155);h.run('__ECHO_AUDIT_FIXTURES.prepare('+JSON.stringify(s.id)+');resize();render();');
    const draw=measure(h,'render()');
    // Contagem de leituras reais de candidatos. Proxy só no teste, não em release.
    h.seed(155);h.run('__ECHO_AUDIT_FIXTURES.prepare('+JSON.stringify(s.id)+')');
    h.sandbox.__candidateReads=0;
    h.run(`const __rawEnemies=enemies;enemies=new Proxy(enemies,{get(a,k){if(typeof k==='string'&&/^\\d+$/.test(k))__candidateReads++;return Reflect.get(a,k);}});updateProjectiles(0);enemies=__rawEnemies;` .replace('const __rawEnemies','var __rawEnemies'));
    const projectileReads=h.sandbox.__candidateReads;
    h.sandbox.__candidateReads=0;
    h.run(`var __rawEnemies=enemies;enemies=new Proxy(enemies,{get(a,k){if(typeof k==='string'&&/^\\d+$/.test(k))__candidateReads++;return Reflect.get(a,k);}});for(var __e of __rawEnemies)updateEnemy(__e,0);enemies=__rawEnemies;`);
    const enemyReads=h.sandbox.__candidateReads;
    h.seed(155);h.run('__ECHO_AUDIT_FIXTURES.prepare('+JSON.stringify(s.id)+');__ECHO_PERF_AUDIT1.start();');
    h.run('for(var __i=0;__i<30;__i++)loop(1000+(__i+1)*1000/60);');
    const probe=h.sandbox.__ECHO_PERF_AUDIT1.snapshot();h.sandbox.__ECHO_PERF_AUDIT1.stop();
    results.push({id:s.id,nome:s.nome,inimigos:s.enemies,projeteis:s.projectiles,fx:s.parts+s.arcs+s.swings+s.texts,leiturasInimigosPorProjeteis:projectileReads,leiturasSeparacao:enemyReads,draw,temposMock:probe.secoes});
  }
  const types={};
  for(const type of Object.keys(h.T.EDEFS)){
    h.seed(155);h.run("__ECHO_AUDIT_FIXTURES.prepare('A');spawnEnemy("+JSON.stringify(type)+",player.x+150,player.y,10);enemies[0].spawnT=0;enemies[0].fireT=2;enemies[0].phase0=1;drawEnemy(enemies[0]);");
    types[type]={draw:measure(h,'drawEnemy(enemies[0])'),update:measure(h,'updateEnemy(enemies[0],1/60)')};
  }
  return {aviso:'Cenários sintéticos. Operações Canvas reais no mock; tempos mock não medem renderização/GPU/FPS.',cenarios:results,tipos:types,escritasTextoHUD120:hudWrites(h)};
}
if(require.main===module){
  const args=process.argv.slice(2),ref=args.includes('--ref')?args[args.indexOf('--ref')+1]:null;
  const out=report(readSource(ref));
  if(args.includes('--json'))fs.writeFileSync(args[args.indexOf('--json')+1],JSON.stringify(out,null,2)+'\n');
  console.log(out.aviso);console.log('Escritas textuais em 120 atualizações forçadas/estáveis de HUD:',out.escritasTextoHUD120);
  console.table(out.cenarios.map(s=>({cenário:s.id,inimigos:s.inimigos,projéteis:s.projeteis,FX:s.fx,candidatosPE:s.leiturasInimigosPorProjeteis,separação:s.leiturasSeparacao,paths:s.draw.canvas.paths,save:s.draw.canvas.save,blurDraws:s.draw.canvas.shadowDraws,trig:s.draw.trig.sin+s.draw.trig.cos})));
  console.table(Object.entries(out.tipos).map(([tipo,r])=>({tipo,save:r.draw.canvas.save,paths:r.draw.canvas.paths,blurDraws:r.draw.canvas.shadowDraws,sinCos:r.draw.trig.sin+r.draw.trig.cos,hypotUpdate:r.update.trig.hypot})));
}
module.exports={readSource,world,measure,summarize,hudWrites,report};
