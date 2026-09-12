'use strict';
/* PR15.5-B-FIX.2 — testes do código REAL; instrumentação só no sandbox.
   Não mede FPS de hardware. Janelas determinísticas + invariantes de custo. */
const assert=require('assert');
const crypto=require('crypto');
const {T,sandbox,vm,SRC}=require('../audit_pr135/harness.js');
const run=code=>vm.runInContext(code,sandbox);
let pass=0,fail=0;
function ok(name,fn){try{fn();pass++;console.log('  ✔ '+name);}catch(e){fail++;console.error('  ✘ '+name+' → '+e.stack);}}
const M=run('({metricsTick,metricsSetEnabled,metricsHide,metricsLength,metricsEls,metricsPanel,loadCfg,renderConfig,openCodex,closeCodex,showTitle,resetRunWorld,loop,getCfg:()=>cfg})');
const el=k=>M.metricsEls[k];
const value=k=>Number(el(k).textContent.replace(' ms',''));
const stats={writes:0,visibility:0,lengths:0,samples:0};
for(const e of Object.values(M.metricsEls)){
  let text=e.textContent;
  Object.defineProperty(e,'textContent',{get:()=>text,set(v){stats.writes++;text=v;}});
}
let hidden=true; // DOM mínimo do harness não interpreta o atributo HTML
Object.defineProperty(M.metricsPanel,'hidden',{get:()=>hidden,set(v){stats.visibility++;hidden=v;}});
sandbox.__metricsStats=stats;
run(`const _testLength=metricsLength,_testText=metricsText;
metricsLength=function(a){__metricsStats.lengths++;return _testLength(a);};
metricsText=function(e,s){if(e===metricsEls.fps&&s!=='---')__metricsStats.samples++;_testText(e,s);};`);
function resetStats(){for(const k in stats)stats[k]=0;}
function ready(){
  M.metricsHide();
  run("cfg.metrics=1;state='play';player={};bannerT=0;devPanelOpen=false;DEV_MODE=false;sandboxRun=false;document.hidden=false;enemies=[];projectiles=[];parts=[];arcs=[];swings=[];ftexts=[];echoes=[];pr15Presence=null;");
  resetStats();
}
function sample(hz=60){M.metricsTick(0);for(let i=1;i<=hz;i++)M.metricsTick(i*1000/hz);}
function clickMetrics(){
  M.renderConfig();
  const row=sandbox.document.getElementById('cx-body').children.find(r=>r.innerHTML.includes('MOSTRAR MÉTRICAS'));
  assert.ok(row,'linha no menu real');
  row.children[0]._ev.click[0]();
}
const block=SRC.slice(SRC.indexOf('/* ---------------- MÉTRICAS'),SRC.indexOf('/* ---------------- loop'));
const tick=block.slice(block.indexOf('function metricsTick'));
const loop=SRC.slice(SRC.indexOf('function loop(now)'),SRC.indexOf('/* =====================================================================\n   CODEX'));
console.log('\nECHO — PR15.5-B-FIX.2 · MOSTRAR MÉTRICAS');

ok('Default DESLIGADO no boot',()=>assert.strictEqual(M.getCfg().metrics,0));
ok('HTML nasce oculto sem flash de painel',()=>assert.match(SRC,/<aside id="metrics-overlay" hidden/));
ok('Settings antigos resultam em OFF',()=>{sandbox.localStorage.setItem('echoCfg.v1','{"music":0,"quality":2}');M.loadCfg();assert.strictEqual(M.getCfg().metrics,0);});
ok('Migração preserva as demais preferências',()=>{assert.strictEqual(M.getCfg().music,0);assert.strictEqual(M.getCfg().quality,2);});
ok('Campo booleano true é normalizado para ON',()=>{sandbox.localStorage.setItem('echoCfg.v1','{"metrics":true}');M.loadCfg();assert.strictEqual(M.getCfg().metrics,1);});
for(const bad of [null,'1','ligado',-1,2,{},[]])ok('Campo inválido cai em OFF: '+JSON.stringify(bad),()=>{sandbox.localStorage.setItem('echoCfg.v1',JSON.stringify({metrics:bad}));M.loadCfg();assert.strictEqual(M.getCfg().metrics,0);});
ok('JSON corrompido não causa erro/NaN',()=>{sandbox.localStorage.setItem('echoCfg.v1','{');M.loadCfg();assert.strictEqual(M.getCfg().metrics,0);});
ok('Clique no controle real liga métricas',()=>{clickMetrics();assert.strictEqual(M.getCfg().metrics,1);});
ok('Persistência ON na chave global existente',()=>assert.strictEqual(JSON.parse(sandbox.localStorage.getItem('echoCfg.v1')).metrics,1));
ok('Recarregar settings restaura ON',()=>{run('cfg.metrics=0');M.loadCfg();assert.strictEqual(M.getCfg().metrics,1);});
ok('Controle reutiliza cfgv e rótulo LIGADO',()=>{M.renderConfig();const row=sandbox.document.getElementById('cx-body').children.find(r=>r.innerHTML.includes('MOSTRAR MÉTRICAS'));assert.strictEqual(row.children[0].className,'cfgv');assert.strictEqual(row.children[0].textContent,'LIGADO');});
ok('Clique no controle real desliga métricas',()=>{clickMetrics();assert.strictEqual(M.getCfg().metrics,0);});
ok('Persistência OFF e reload',()=>{assert.strictEqual(JSON.parse(sandbox.localStorage.getItem('echoCfg.v1')).metrics,0);run('cfg.metrics=1');M.loadCfg();assert.strictEqual(M.getCfg().metrics,0);});
ok('OFF: painel escondido',()=>assert.strictEqual(M.metricsPanel.hidden,true));
ok('OFF: 120 frames sem texto, visibilidade, contagens ou amostras',()=>{resetStats();for(let i=0;i<120;i++)M.metricsTick(i*20);assert.deepStrictEqual(stats,{writes:0,visibility:0,lengths:0,samples:0});});
ok('OFF: retorno antes de qualquer leitura de estruturas',()=>{const poison=new Proxy({}, {get(){throw Error('leitura indevida');}});sandbox.__poison=poison;run('enemies=__poison;projectiles=__poison;parts=__poison;echoes=__poison;');M.metricsTick(100);run('enemies=[];projectiles=[];parts=[];echoes=[];');});
ok('OFF: primeiro comando é guarda com retorno imediato',()=>assert.match(tick,/function metricsTick\(now\)\{\s*if\(!cfg.metrics\)return;/));
ok('ON: painel aparece em gameplay normal fora de DEV',()=>{ready();M.metricsTick(0);assert.strictEqual(M.metricsPanel.hidden,false);});
ok('Primeira amostra usa neutros legíveis',()=>{for(const e of Object.values(M.metricsEls))assert.strictEqual(e.textContent,'---');});
ok('Janela ainda incompleta não conta entidades nem atualiza texto',()=>{resetStats();for(let t=10;t<250;t+=10)M.metricsTick(t);assert.strictEqual(stats.writes,0);assert.strictEqual(stats.lengths,0);assert.strictEqual(stats.samples,0);});
ok('Janela de 250 ms publica uma amostra',()=>{M.metricsTick(250);assert.strictEqual(stats.samples,1);assert.strictEqual(stats.lengths,6);});
ok('FPS é finito e não negativo',()=>{assert.ok(Number.isFinite(value('fps')));assert.ok(value('fps')>=0);});
ok('FRAME é finito e não negativo',()=>{assert.ok(Number.isFinite(value('frame')));assert.ok(value('frame')>=0);});
for(const hz of [60,50,40,30])ok('Janela distingue '+hz+' FPS simulados e FRAME correspondente',()=>{ready();sample(hz);assert.strictEqual(value('fps'),hz);assert.ok(Math.abs(value('frame')-1000/hz)<.06);});
ok('120 frames muito maiores que as publicações amostradas',()=>{ready();M.metricsTick(0);resetStats();for(let i=1;i<=120;i++)M.metricsTick(i*20);assert.ok(stats.samples>=7&&stats.samples<=10);assert.ok(120>stats.samples*10);assert.strictEqual(stats.lengths,stats.samples*6);console.log('    Instrumentação: 120 frames → '+stats.samples+' amostras; '+stats.writes+' escritas de texto.');});
ok('Valores estáveis não reescrevem DOM desnecessariamente',()=>{ready();M.metricsTick(0);M.metricsTick(250);resetStats();M.metricsTick(500);assert.strictEqual(stats.samples,1);assert.strictEqual(stats.writes,0);});
ok('INIMIGOS usa enemies.length',()=>{ready();run('enemies=new Array(34)');sample();assert.strictEqual(value('enemies'),34);});
ok('Boss já contado no array, sem duplicação',()=>{ready();run("enemies=[{type:'boss'}];boss=enemies[0]");sample();assert.strictEqual(value('enemies'),1);run('boss=null');});
ok('Miniboss já contado no array, sem duplicação',()=>{ready();run("enemies=[{type:'miniboss'}];miniBoss=enemies[0]");sample();assert.strictEqual(value('enemies'),1);run('miniBoss=null');});
ok('PROJÉTEIS usa projectiles.length',()=>{ready();run('projectiles=new Array(18)');sample();assert.strictEqual(value('projectiles'),18);});
for(const [name,n] of [['parts',13],['arcs',3],['swings',2],['ftexts',4]])ok('FX inclui somente o tamanho real de '+name,()=>{ready();run(name+'=new Array('+n+')');sample();assert.strictEqual(value('fx'),n);});
ok('FX soma as quatro estruturas globais',()=>{ready();run('parts=new Array(13);arcs=new Array(3);swings=new Array(2);ftexts=new Array(4)');sample();assert.strictEqual(value('fx'),22);});
ok('FX não conta pool inativo nem ghosts privados',()=>{ready();run('partPool.push({});player.ghosts=[{},{}];echoes=[{alive:true,ghosts:[{},{}]}]');sample();assert.strictEqual(value('fx'),0);run('partPool.length=0');});
ok('ECHOS conta os dois slots vivos',()=>{ready();run('echoes=[{alive:true},{alive:true}]');sample();assert.strictEqual(value('echoes'),2);});
ok('ECHOS não conta slot morto retido em echoes',()=>{ready();run('echoes=[{alive:false},{alive:true}]');sample();assert.strictEqual(value('echoes'),1);});
ok('Echo vivo hostil também é entidade relevante',()=>{ready();run('echoes=[{alive:true,hostile:true}]');sample();assert.strictEqual(value('echoes'),1);});
ok('ECHOS inclui a presença temporal física, não memória gravada',()=>{ready();run('echoes=[{alive:true},{alive:true}];pr15Presence={phase:"leaving"}');sample();assert.strictEqual(value('echoes'),3);});
ok('ENTIDADES é exatamente INIMIGOS + PROJÉTEIS + FX + ECHOS',()=>{ready();run('enemies=new Array(34);projectiles=new Array(18);parts=new Array(42);echoes=[{alive:true},{alive:true}]');sample();assert.strictEqual(value('total'),96);});
ok('Contagens consultam as referências atuais, não listas espelho',()=>{run('enemies=new Array(7);projectiles=new Array(3);parts=new Array(2)');M.metricsTick(1500);assert.strictEqual(value('enemies'),7);assert.strictEqual(value('projectiles'),3);assert.strictEqual(value('fx'),2);});
ok('Estruturas ausentes retornam zeros seguros',()=>{ready();run('enemies=undefined;projectiles=null;parts=undefined;arcs=null;swings=null;ftexts=undefined;echoes=undefined;pr15Presence=null');sample();for(const k of ['enemies','projectiles','fx','echoes','total'])assert.strictEqual(value(k),0);});
ok('Length inválido não propaga NaN/Infinity/negativo',()=>{for(const a of [null,undefined,{}, {length:NaN},{length:Infinity},{length:-1}])assert.strictEqual(M.metricsLength(a),0);});
ok('Contagem não visita elementos de arrays grandes',()=>{ready();sandbox.__lengthOnly=new Proxy([], {get(t,k){if(k==='length')return 1000000;throw Error('varredura: '+String(k));}});run('enemies=__lengthOnly;projectiles=__lengthOnly;parts=__lengthOnly;arcs=__lengthOnly;swings=__lengthOnly;ftexts=__lengthOnly');sample();assert.strictEqual(value('total'),6000000);});
for(const time of [NaN,Infinity,-Infinity,undefined,null,-1])ok('Timestamp inválido tratado sem número inválido: '+String(time),()=>{ready();M.metricsTick(time);for(const e of Object.values(M.metricsEls))assert.ok(!/NaN|Infinity|undefined|null/.test(e.textContent));assert.strictEqual(M.metricsPanel.hidden,true);});
ok('Timestamp repetido não divide por zero',()=>{ready();M.metricsTick(100);M.metricsTick(100);assert.strictEqual(stats.samples,0);});
ok('Relógio regressivo reinicia janela sem FPS negativo',()=>{ready();M.metricsTick(300);M.metricsTick(200);assert.strictEqual(run('metricsFrames'),0);M.metricsTick(450);assert.ok(value('fps')>=0);});
ok('Hitch longo é refletido, não mascarado pelo dt clamp',()=>{ready();M.metricsTick(0);M.metricsTick(2000);assert.strictEqual(value('frame'),2000);assert.ok(value('fps')<=1);});
for(const state of ['paused','title','slotMenu','shop','event','sheet','sandbox','fracture','victory'])ok('Visibilidade de sessão em '+state,()=>{ready();M.metricsTick(0);run('state='+JSON.stringify(state));M.metricsTick(250);const fora=['title','slotMenu'].includes(state);assert.strictEqual(M.metricsPanel.hidden,fora);assert.strictEqual(stats.samples,fora?0:1);});
ok('Sem jogador não exibe painel',()=>{ready();run('player=null');M.metricsTick(0);assert.strictEqual(M.metricsPanel.hidden,true);});
ok('Aba oculta reinicia sampler sem incluir suspensão',()=>{ready();M.metricsTick(0);sandbox.document.hidden=true;M.metricsTick(9000);assert.strictEqual(M.metricsPanel.hidden,true);sandbox.document.hidden=false;M.metricsTick(10000);assert.strictEqual(stats.samples,0);M.metricsTick(10250);assert.strictEqual(value('frame'),250);});
ok('Banner não interrompe mais as métricas (Audit #1)',()=>{ready();M.metricsTick(0);run('bannerT=2');M.metricsTick(250);assert.strictEqual(M.metricsPanel.hidden,false);assert.strictEqual(stats.samples,1);run('bannerT=0');M.metricsTick(500);assert.strictEqual(M.metricsPanel.hidden,false);});
ok('Painel DEV aberto usa métricas na faixa compacta',()=>{ready();run('DEV_MODE=true;devPanelOpen=true');M.metricsTick(0);assert.strictEqual(M.metricsPanel.hidden,false);assert.ok(M.metricsPanel.classList.contains('metrics-dock'));});
ok('Funciona em DEV com ferramenta fechada',()=>{ready();run('DEV_MODE=true');sample();assert.strictEqual(M.metricsPanel.hidden,false);assert.strictEqual(value('fps'),60);});
ok('Funciona no combate Sandbox sem depender de DEV',()=>{ready();run('sandboxRun=true');sample();assert.strictEqual(M.metricsPanel.hidden,false);assert.strictEqual(value('fps'),60);});
ok('Desligar esconde imediatamente, sem esperar frame',()=>{M.metricsSetEnabled(false);assert.strictEqual(M.metricsPanel.hidden,true);assert.strictEqual(run('metricsFrames'),0);});
ok('Religar começa do neutro e volta a amostrar',()=>{M.metricsSetEnabled(true);M.metricsTick(3000);assert.strictEqual(M.metricsPanel.hidden,false);assert.strictEqual(el('fps').textContent,'---');M.metricsTick(3250);assert.ok(Number.isFinite(value('fps')));});
ok('Nenhum timer, RAF paralelo ou listener no módulo',()=>assert.ok(!/setInterval|setTimeout|requestAnimationFrame|addEventListener/.test(block)));
ok('Sem loops/filter/map/reduce/sort no módulo inteiro',()=>assert.ok(!/\b(for|while)\s*\(|\.(filter|map|reduce|sort|forEach)\s*\(/.test(block)));
ok('Sem entidades visuais, Canvas, glow ou partícula novos',()=>assert.ok(!/spawn|createElement|ctx\.|shadowBlur|drawImage/.test(block)));
ok('Sem arrays espelho ou histórico crescente',()=>assert.ok(!/\.push\(|\.concat\(|\.slice\(|new (Array|Map|Set)|=\s*\[/.test(block)));
ok('Sem serialização ou cópia de estado para medir',()=>assert.ok(!/JSON\.|Object\.(assign|values|entries)|\.\.\./.test(block)));
ok('Estado do sampler é escalar e limitado',()=>assert.match(block,/let metricsStart=-1,metricsLast=-1,metricsFrames=0,metricsVisible=false,metricsDocked=false;/));
ok('Antes da janela: nenhum objeto/array/string temporário',()=>{const hot=tick.slice(0,tick.indexOf('const fps='));assert.ok(!/new |\[\]|=\s*\{|String\(|toFixed|toString|`/.test(hot));});
ok('Hook único no loop depois do gate e do render',()=>{assert.strictEqual((loop.match(/metricsTick\(now\)/g)||[]).length,1);assert.ok(loop.indexOf('metricsTick(now)')>loop.indexOf('if(gateOn)'));assert.ok(loop.indexOf('metricsTick(now)')>loop.indexOf('try{render();}'));});
ok('Retorno do gate não conta RAF descartado',()=>{ready();run('gateOn=true;frameGate=100;refreshProbe=40');resetStats();M.loop(101);assert.strictEqual(run('metricsStart'),-1);assert.strictEqual(stats.samples,0);run('gateOn=false');});
ok('Janela única configurada em 250 ms',()=>assert.strictEqual(run('METRICS_WINDOW_MS'),250));
ok('Preferência não aparece no schema de checkpoint',()=>{ready();T.startRun();const cp=T.smBuildCheckpoint('teste',1);assert.ok(!JSON.stringify(cp).includes('metrics'));});
ok('Nova run reutiliza painel/sampler e mantém preferência',()=>{const panel=M.metricsPanel,tickRef=run('metricsTick');M.metricsSetEnabled(true);T.startRun();T.startRun();assert.strictEqual(M.getCfg().metrics,1);assert.strictEqual(M.metricsPanel,panel);assert.strictEqual(run('metricsTick'),tickRef);assert.strictEqual(run('metricsStart'),-1);});
ok('Morte → nova run preserva ON',()=>{run('DEV_MODE=false;sandboxRun=false');T.startRun();T.onPlayerDeath();T.startRun();assert.strictEqual(M.getCfg().metrics,1);});
ok('Retorno ao título recarrega ON e oculta sem sampler órfão',()=>{M.showTitle();assert.strictEqual(M.getCfg().metrics,1);assert.strictEqual(M.metricsPanel.hidden,true);});
ok('Save/Continue preserva cfg e reinicia a mesma janela',()=>{run('DEV_MODE=false;sandboxRun=false;sandboxMode=false');T.activateSlot(1);T.startRun();T.setDevTainted(false);assert.ok(T.captureCheckpoint('teste',1));const panel=M.metricsPanel,tickRef=run('metricsTick');T.resumeRun();assert.strictEqual(M.getCfg().metrics,1);assert.strictEqual(M.metricsPanel,panel);assert.strictEqual(run('metricsTick'),tickRef);assert.strictEqual(run('metricsStart'),-1);assert.ok(T.getPlayer().hp>0);});
ok('Continue não restaura ON de checkpoint após escolher OFF',()=>{M.metricsSetEnabled(false);T.resumeRun();assert.strictEqual(M.getCfg().metrics,0);});
ok('Configurações repetidas não criam painel nem timer de métricas',()=>{const panel=M.metricsPanel,tickRef=run('metricsTick');let intervals=0,rafs=0;const oldI=sandbox.setInterval,oldR=sandbox.requestAnimationFrame;sandbox.setInterval=()=>{intervals++;};sandbox.requestAnimationFrame=()=>{rafs++;};try{for(let i=0;i<8;i++){M.openCodex('config');M.closeCodex();}assert.strictEqual(intervals,0);assert.strictEqual(rafs,0);assert.strictEqual(M.metricsPanel,panel);assert.strictEqual(run('metricsTick'),tickRef);}finally{sandbox.setInterval=oldI;sandbox.requestAnimationFrame=oldR;}});
ok('Recarregar settings antigos depois de ON também oculta painel',()=>{ready();sample();sandbox.localStorage.setItem('echoCfg.v1','{}');M.loadCfg();assert.strictEqual(M.getCfg().metrics,0);assert.strictEqual(M.metricsPanel.hidden,true);});
ok('Storage indisponível não quebra toggle',()=>{const old=sandbox.localStorage.setItem;sandbox.localStorage.setItem=()=>{throw Error('bloqueado');};try{M.metricsSetEnabled(true);assert.strictEqual(M.getCfg().metrics,1);M.metricsSetEnabled(false);}finally{sandbox.localStorage.setItem=old;}});
ok('Apenas uma instância declarativa do painel',()=>assert.strictEqual((SRC.match(/id="metrics-overlay"/g)||[]).length,1));
ok('Estilo técnico sem efeitos ou animações',()=>{const css=SRC.slice(SRC.indexOf('  #metrics-overlay{'),SRC.indexOf('  /* ---------- banner'));assert.ok(!/animation|transition|shadow|blur|gradient/.test(css));assert.match(css,/font-variant-numeric:tabular-nums/);assert.match(css,/pointer-events:none/);});
ok('Rótulos em pt-BR, sem truncamento deliberado',()=>{assert.match(SRC,/<dt>PROJÉTEIS<\/dt>/);assert.match(SRC,/<dt>ENTIDADES<\/dt>/);assert.match(SRC,/Exibe informações de desempenho durante a partida\./);});
ok('Posição fora da coluna superior direita e acima do chip Sandbox',()=>{assert.match(SRC,/#metrics-overlay\{position:fixed;left:16px;bottom:178px;width:174px/);assert.match(SRC,/#sb-chip\{position:fixed;left:16px;bottom:132px/);});

// Hashes dos blocos integrais (LF), extraídos de git show do commit obrigatório.
// Não dependem de histórico Git disponível na máquina do jogador/CI.
const mechanical={
  WEAPONS:[/const WEAPONS=\[[\s\S]*?\n\];/,'cb92e03d4d36f390b41c70b8ab85e5ace7e183b779249dfa89295ff7bfabda03'],
  EDEFS:[/const EDEFS=\{[\s\S]*?\n\};/,'9a646757e52d8b6b69f1ac09df16441b6437e0fe1bcfb5f739c58eb8119a178b'],
  waveCompBase:[/function waveCompBase\(n\)\{[\s\S]*?\n\}/,'3f49dd9c64897c75062d248e0096ad8d493190cc1dfb0dda9935ae6cb82eb368'],
  MINIBOSS:[/const MINIBOSS=\[[\s\S]*?\n\];/,'6ce87e31b85d36526611d202d98473bc587e8fb241d9dae20ba2569fc107dc18'],
  spawnBoss:[/function spawnBoss\(\)\{[\s\S]*?\n\}/,'3872a65edcacad431d90d014d0741cad5c6b84767a5a02189f701c410fc7379e']
};
for(const [name,[pattern,hash]] of Object.entries(mechanical))ok(name+' idêntico a 4667720babece82b1c9bb1b92e8d47b7b1c5cc45',()=>{const b=SRC.match(pattern);assert.ok(b);assert.strictEqual(crypto.createHash('sha256').update(b[0]).digest('hex'),hash);});
console.log(`\nResultado: ${pass} passaram · ${fail} falharam`);
if(fail)process.exitCode=1;
