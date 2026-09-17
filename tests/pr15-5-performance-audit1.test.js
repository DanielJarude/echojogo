'use strict';
/* ECHO — PERFORMANCE AUDIT #1. Código real, fixtures DEV/Sandbox,
   invariantes de custo/equivalência. Não exige tempo exato nem FPS de hardware. */
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {world,readSource,measure,hudWrites}=require('../audit_pr155/performance_benchmark');
const SRC=readSource(),h=world(SRC),run=h.run;
const probe=h.sandbox.__ECHO_PERF_AUDIT1;
let pass=0,fail=0;
function ok(name,fn){try{fn();pass++;console.log('  ✔ '+name);}catch(e){fail++;console.error('  ✘ '+name+' → '+e.stack);}}
function ready(id='A'){if(probe.active)probe.stop();h.seed(155);run('__ECHO_AUDIT_FIXTURES.prepare('+JSON.stringify(id)+');cfg.metrics=1;metricsHide();metricsPanel.hidden=true;document.hidden=false;devPanelOpen=false;codexEl.classList.remove("on");');}
function tick(t){run('metricsTick('+t+')');}
function number(id){return Number(run('metricsEls.'+id+'.textContent').replace(' ms',''));}
const metrics=SRC.slice(SRC.indexOf('function metricsTick(now)'),SRC.indexOf('/* ---------------- loop'));
const root=path.resolve(__dirname,'..');
console.log('\nECHO — PR15.5 PERFORMANCE AUDIT #1');

for(const s of ['play','event','shop','sheet','paused','sandbox','fracture','victory'])ok('Painel visível e amostrando em '+s,()=>{ready();run('state='+JSON.stringify(s));tick(0);tick(250);assert.strictEqual(run('metricsPanel.hidden'),false);assert.ok(Number.isFinite(number('fps')));assert.ok(number('frame')>0);});
for(const s of ['title','slots','slotMenu','slotConfirm'])ok('Oculto fora da sessão: '+s,()=>{ready();tick(0);run('state='+JSON.stringify(s));tick(250);assert.strictEqual(run('metricsPanel.hidden'),true);});
ok('Banner não interrompe a janela nem oculta painel',()=>{ready();tick(0);run('bannerT=3');tick(100);tick(250);assert.strictEqual(run('metricsPanel.hidden'),false);assert.strictEqual(number('fps'),8);});
ok('Evento → loja mantém a MESMA janela temporal',()=>{ready();tick(0);run("state='event'");tick(100);run("state='shop'");tick(250);assert.strictEqual(number('frame'),125);});
ok('TAB usa faixa compacta, não esconde valores',()=>{ready();run('sheetShow()');tick(0);assert.strictEqual(run('metricsPanel.hidden'),false);assert.ok(run('metricsPanel.classList.contains("metrics-dock")'));});
ok('DEV aberto usa faixa compacta',()=>{ready();run('devPanelOpen=true');tick(0);assert.ok(run('metricsDocked'));assert.strictEqual(run('metricsPanel.hidden'),false);});
ok('Configurações em pausa permanecem diagnosticáveis',()=>{ready();run("state='paused';openCodex('config')");tick(0);tick(250);assert.ok(run('metricsDocked'));assert.ok(number('fps')>=0);run('closeCodex()');});
ok('Retorno ao combate restaura a posição original',()=>{ready();run("state='shop'");tick(0);run("state='play'");tick(250);assert.strictEqual(run('metricsDocked'),false);});
ok('Pausa simples mantém posição quando não há conflito',()=>{ready();run("state='paused'");tick(0);assert.strictEqual(run('metricsDocked'),false);});
ok('OFF: retorno antes de qualquer leitura de DOM/contadores',()=>{ready();run('cfg.metrics=0');let reads=0;const panel=run('metricsPanel'),old=panel.classList.contains;panel.classList.contains=()=>{reads++;throw Error('leitura OFF');};try{for(let i=0;i<120;i++)tick(i*20);assert.strictEqual(reads,0);assert.strictEqual(run('metricsFrames'),0);}finally{panel.classList.contains=old;}assert.match(metrics,/function metricsTick\(now\)\{\s*if\(!cfg.metrics\)return;/);});
ok('OFF imediato continua funcionando dentro da loja',()=>{ready();run("state='shop'");tick(0);run('metricsSetEnabled(false)');assert.strictEqual(run('metricsPanel.hidden'),true);});
ok('Sampler único mesmo após alternar overlays 120 vezes',()=>{ready();const fn=run('metricsTick');tick(0);for(let i=1;i<=120;i++)run("state="+(i%2?'"event"':'"shop"')+';metricsTick('+i*20+')');assert.strictEqual(run('metricsTick'),fn);assert.strictEqual((SRC.match(/metricsTick\(now\);/g)||[]).length,1);});
ok('Sem escrita textual por frame nos overlays',()=>{ready();run("state='event'");tick(0);let n=0;const old=h.sandbox.metricsText;h.sandbox.metricsText=function(){n++;return old.apply(this,arguments);};try{for(let i=1;i<=120;i++)tick(i*20);assert.strictEqual(n,9*7);}finally{h.sandbox.metricsText=old;}});
ok('Sem NaN/Infinity ao atravessar overlays',()=>{ready();tick(0);for(const s of ['event','sheet','shop','paused','sandbox']){run('state='+JSON.stringify(s));tick(300);tick(600);for(const id of ['fps','frame','enemies','projectiles','fx','echoes','total'])assert.ok(!/NaN|Infinity|undefined|null/.test(run('metricsEls.'+id+'.textContent')));}});
ok('Documento oculto encerra amostra de suspensão',()=>{ready();tick(0);run('document.hidden=true');tick(500);assert.ok(run('metricsPanel.hidden'));run('document.hidden=false');tick(5000);assert.strictEqual(run('metricsFrames'),0);});
ok('Painel fora do stacking context do HUD',()=>{
  const hudStart=SRC.indexOf('<div id="hud">'),aside=SRC.indexOf('<aside id="metrics-overlay"');
  assert.ok(hudStart>=0&&aside>hudStart,'HUD/metrics ausentes');
  const hud=SRC.slice(hudStart,aside);
  assert.match(hud,/<div id="combat-kit"[\s\S]*id="weapwrap"/);
  assert.match(SRC,/<div id="combat-kit"[\s\S]*<\/div>\s*<\/div>\s*<aside id="metrics-overlay"/);
});
ok('Camada acima dos overlays/DEV sem capturar clique',()=>{assert.match(SRC,/#metrics-overlay\{position:fixed;left:16px;bottom:178px;width:174px;z-index:84;/);const css=SRC.slice(SRC.indexOf('#metrics-overlay{'),SRC.indexOf('/* ---------- banner'));assert.match(css,/pointer-events:none/);assert.ok(!/animation|transition|blur\(/.test(css));});
ok('Faixa compacta cabe na margem superior de 20px',()=>assert.match(SRC,/#metrics-overlay.metrics-dock\{top:1px;bottom:auto;right:16px;width:auto;height:18px;/));
ok('Preferência permanece global fora do checkpoint',()=>{ready();const cp=run("smBuildCheckpoint('auditoria',1)");assert.ok(!JSON.stringify(cp).includes('metrics'));});

ok('Tabela de estilhaços tem exatamente 3 entradas',()=>assert.deepStrictEqual(Object.keys(run('SHARD_VERTICES')),['3','4','5']));
ok('Tabela possui somente 24 escalares fixos',()=>assert.strictEqual(run('Object.values(SHARD_VERTICES).reduce((n,a)=>n+a.length,0)'),24));
ok('Tabela e vetores são imutáveis',()=>assert.ok(run('Object.isFrozen(SHARD_VERTICES)&&Object.values(SHARD_VERTICES).every(Object.isFrozen)')));
for(const sides of [3,4,5])ok('Vértices de '+sides+' lados são exatamente a fórmula original',()=>{const v=run('SHARD_VERTICES['+sides+']');for(let i=0;i<sides;i++){assert.strictEqual(v[i*2],Math.cos(i/sides*Math.PI*2));assert.strictEqual(v[i*2+1],Math.sin(i/sides*Math.PI*2));}});
ok('Fallback preserva lados experimentais fora da tabela',()=>{ready();run('parts=[{x:player.x,y:player.y,t:.1,life:1,shard:true,ring:false,size:4,rot:0,color:"#46e0ff",sides:6}];resize();render();');const c=measure(h,'render()');assert.ok(c.trig.cos>=6);assert.ok(c.trig.sin>=6);});
ok('Render de estilhaços não cria cache por entidade',()=>{ready('H');const ref=run('SHARD_VERTICES');run('render();render();render();');assert.strictEqual(run('SHARD_VERTICES'),ref);assert.strictEqual(run('Object.keys(SHARD_VERTICES).length'),3);assert.strictEqual(run('parts.length'),900);});
ok('120 atualizações estáveis do HUD: zero escritas textuais monitoradas',()=>{ready();assert.strictEqual(hudWrites(h),0);});
ok('hudText escreve mudança real uma vez',()=>{const el={_v:'a',n:0,get textContent(){return this._v;},set textContent(v){this.n++;this._v=v;}};h.sandbox.hudText(el,'b');h.sandbox.hudText(el,'b');assert.strictEqual(el.n,1);});
ok('Resíduos mudando invalidam o cache escalar',()=>{ready();run('fracRun.res=123;fracHudChip();fracRun.res=456;fracHudChip();');assert.ok(h.sandbox.document.getElementById('frac-hud-res').textContent.includes('456'));});
ok('Resíduos: texto vazio força reconstrução segura',()=>{run("$('frac-hud-res').textContent='';fracHudChip()");assert.ok(h.sandbox.document.getElementById('frac-hud-res').textContent.includes('456'));});
ok('Resíduos: nó sem cache recebe primeira pintura',()=>{run("delete $('frac-hud-res')._echoRes;fracHudChip()");assert.strictEqual(h.sandbox.document.getElementById('frac-hud-res')._echoRes,456);});
ok('HP e créditos continuam refletindo mudanças',()=>{ready();run('player.hp=42;player.coins=1234;updateHUD(true)');assert.ok(h.sandbox.document.getElementById('hpnum').textContent.startsWith('42 /'));assert.ok(h.sandbox.document.getElementById('coinsp').textContent.includes('1.2K'));});
ok('O throttle original do HUD continua em .09 s',()=>assert.match(SRC,/if\(!force&&hudAcc<\.09\)return;/));
ok('Não foram inseridas leituras que forçam layout no HUD',()=>{const body=SRC.slice(SRC.indexOf('function hudText'),SRC.indexOf('MÓDULO ROGUELITE:',SRC.indexOf('function hudText')));assert.ok(!/getBoundingClientRect|offsetWidth|offsetHeight|clientWidth|clientHeight/.test(body));});

ok('Fixtures exigem DEV + Sandbox',()=>{ready();run('sandboxRun=false');assert.throws(()=>run("__ECHO_AUDIT_FIXTURES.prepare('E')"),/DEV \+ Sandbox/);run('sandboxRun=true;DEV_MODE=false');assert.throws(()=>run("__ECHO_AUDIT_FIXTURES.prepare('E')"),/DEV \+ Sandbox/);run('DEV_MODE=true');});
ok('Stress não ultrapassa 46 inimigos nem 900 partículas',()=>{for(const s of h.sandbox.__ECHO_AUDIT_FIXTURES.scenarios){assert.ok(s.enemies<=46);assert.ok(s.parts<=900);}ready('E');assert.ok(run('enemies.length+projectiles.length+parts.length')>70);});
ok('Sonda externa não é incluída no HTML/release',()=>{assert.ok(!SRC.includes('performance_probe.js'));const p=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));assert.ok(!p.build.files.some(s=>s.includes('audit_pr155')));});
ok('Sonda começa desativada e snapshot é finito',()=>{assert.strictEqual(probe.active,false);for(const s of Object.values(probe.snapshot().secoes))for(const n of Object.values(s))assert.ok(Number.isFinite(n)&&n>=0);});
ok('Instalar sonda fora de DEV falha fechada',()=>{const src=fs.readFileSync(path.join(root,'audit_pr155/performance_probe.js'),'utf8');run('DEV_MODE=false');assert.throws(()=>run(src),/ative DEV/);run('DEV_MODE=true');});
ok('start fora de DEV não instala wrappers',()=>{run('DEV_MODE=false');const fn=run('loop');assert.throws(()=>probe.start(),/restrita a DEV/);assert.strictEqual(run('loop'),fn);run('DEV_MODE=true');});
ok('start idempotente não duplica wrappers',()=>{ready();assert.strictEqual(probe.start(),true);const fn=run('loop');assert.strictEqual(probe.start(),false);assert.strictEqual(run('loop'),fn);probe.stop();});
ok('Sonda mede frame/update/FX/render/HUD reais',()=>{ready('B');probe.start();run('loop(1016.6667)');const r=probe.snapshot().secoes;for(const k of ['frame_total','update_total','fx_update','render','updateHUD']){assert.strictEqual(r[k].chamadas,1);assert.ok(r[k].totalMs>=0);}assert.strictEqual(r.updateEnemy.chamadas,10);probe.stop();});
ok('Sonda preserva gate sem criar frame artificial',()=>{ready();probe.start();run('gateOn=true;frameGate=1000;loop(1001)');assert.strictEqual(probe.snapshot().secoes.frame_total.chamadas,0);probe.stop();});
ok('stop restaura identidades originais',()=>{ready();const loop=run('loop'),draw=run('render'),enemy=run('updateEnemy');probe.start();probe.stop();assert.strictEqual(run('loop'),loop);assert.strictEqual(run('render'),draw);assert.strictEqual(run('updateEnemy'),enemy);});
ok('stop repetido não faz nada',()=>assert.strictEqual(probe.stop(),false));
ok('Desligar DEV remove automaticamente a instrumentação',()=>{ready();const fn=run('loop');probe.start();run('DEV_MODE=false;loop(1016.6667)');assert.strictEqual(probe.active,false);assert.strictEqual(run('loop'),fn);run('DEV_MODE=true');});
ok('Reset da sonda limpa acumuladores sem novo sampler',()=>{ready();probe.start();run('loop(1016.6667)');const fn=run('loop');probe.reset();assert.strictEqual(probe.snapshot().secoes.frame_total.chamadas,0);assert.strictEqual(run('loop'),fn);probe.stop();});
ok('Sonda mantém cardinalidade fixa após muitos frames',()=>{ready();probe.start();const n=Object.keys(probe.snapshot().secoes).length;run('for(var i=0;i<120;i++)loop(1000+(i+1)*1000/60)');assert.strictEqual(Object.keys(probe.snapshot().secoes).length,n);assert.strictEqual(probe.snapshot().secoes.frame_total.chamadas,120);probe.stop();});
ok('Sonda não registra listeners nem timers próprios',()=>{const src=fs.readFileSync(path.join(root,'audit_pr155/performance_probe.js'),'utf8');assert.ok(!/\bsetInterval\s*\(|\bsetTimeout\s*\(|addEventListener\s*\(/.test(src));});

ok('Culling existente exclui centro completamente fora da câmera',()=>{ready();run('resize()');assert.strictEqual(run('inView(cam.x+vw+1000,cam.y,160)'),false);});
ok('Culling existente mantém margem de entidades na borda',()=>assert.strictEqual(run('inView(cam.x+vw/2+20,cam.y,48)'),true));
ok('Boss conserva margem de 900 e beams não são cortados pelo centro',()=>{assert.match(SRC,/e.type==='boss'\?900:/);assert.match(SRC,/if\(player&&WEAPONS\[player.wi\].beam\)drawBeamFrom/);});
ok('Render offscreen não remove inimigo nem altera seu estado',()=>{ready();run("spawnEnemy('shooter',player.x+150,player.y,10);enemies[0].x=player.x+5000;enemies[0].spawnT=0;");const before=run('JSON.stringify(enemies)');run('render()');assert.strictEqual(run('JSON.stringify(enemies)'),before);assert.strictEqual(run('enemies.length'),1);});
ok('Inimigo offscreen continua passando pelo update mecânico',()=>{run('enemies[0].flashT=1;updateEnemy(enemies[0],.016)');assert.ok(run('enemies[0].flashT')<1);assert.strictEqual(run('enemies.length'),1);});
ok('Projétil offscreen continua existindo e se movendo',()=>{ready('B');run('projectiles[0].x=player.x+500;projectiles[0].y=player.y+500');const x=run('projectiles[0].x'),n=run('projectiles.length');run('render();updateProjectiles(.001)');assert.strictEqual(run('projectiles.length'),n);assert.ok(run('projectiles[0].x')>x);});
ok('FX offscreen não é eliminado pelo render',()=>{ready('H');run('for(const p of parts)p.x=player.x+5000');const n=run('parts.length');run('render()');assert.strictEqual(run('parts.length'),n);});
/* PR15.5-E0: o jitter dos arcos deixou de ser rand(-9,9) e passou a ser
   vJit1(...)*9 — mesma amplitude, fonte determinística. O que este teste
   protege continua valendo: nenhum culling novo foi introduzido em
   drawArcs, e o jitter segue existindo com amplitude 9. */
ok('Não há culling novo em drawArcs e o jitter mantém amplitude 9',()=>{const b=SRC.match(/function drawArcs\(\)\{[\s\S]*?\n\}/)[0];assert.ok(!b.includes('inView'));assert.ok(/vJit1\([^)]*\)\*9/.test(b));assert.ok(!/Math\.random|[^A-Za-z0-9_$.]rand\(/.test(b));});
ok('Pool e partículas conservam limites originais',()=>assert.match(SRC,/const PARTS_MAX=900, PARTS_POOL_MAX=900;/));
ok('LOW/MEDIUM/HIGH continuam .62/.84/1',()=>assert.match(SRC,/renderQuality=cfg.quality===0\?\.62:\(cfg.quality===2\?1:\.84\)/));
ok('Gate e dt clamp permanecem intocados',()=>{assert.match(SRC,/const TARGET_FPS=60;/);assert.match(SRC,/gateOn=avg<13\.2/);assert.match(SRC,/if\(raw>\.05\)raw=\.05/);});

/* AUDIT_GOLDENS — hashes integrais da base b4654f1; preenchidos na auditoria.
   PR15.5-E5: as cenas B..I foram re-baselineadas. Todas usam EXCLUSIVAMENTE
   projéteis `plasma` (a arma inicial) — verificado enumerando os tipos em
   cada fixture — e o plasma recebeu forma própria no E5. A cena A, a única
   SEM projéteis, manteve o hash `92128f38…` inalterado, o que confirma que
   nada fora do escopo mudou. O consumo de RNG de draw continua 0 nas 9
   cenas (todos os 9 asserts de RNG seguem passando sem rebaseline). */
const mechanical={
  "updateEnemy": "dabbbf648ddb4b427a4570ddde4944dd530c9fb2531791a0ca28c6ff76b475ec",
  /* PR15.5-E9: re-baselineado. O diff no corpo de updateProjectiles é o despacho
     de impacto direcional determinístico (emitWeaponImpactVisual) no acerto e no
     quique de parede (substituindo o antigo spawnParticles isotrópico no pierce
     e no bounce). É hash de TEXTO-FONTE, então a edição move o hash; a equivalência
     mecânica foi comprovada: zero divergências de dano, velocidade, pierce,
     bounce, split, vida, trajetória, alvos atingidos e RNG mecânico. */
  "updateProjectiles": "16f6d32502aa213d2db88b8371f96313e2931642f75c63eeb54bcbf17c493659",
  "spawnEnemy": "a7d85058edb0491e7269f546f89d17c47ff7ff9faf705caa49f9dc632ad3a2af",
  "damageEnemy": "7e08463b4dbf4d11613cb12f1fd64c0342b8faaa3344c394e2eb2f2089686c43",
  "damagePlayer": "70fcbcf1be3a91c767a57a83f677a57b55cad5065465f3462b7e8ea2613f491b",
  /* PR15.7-A/B: re-baselineados somente nos pontos temporais explícitos:
     captura, expiração/cooldown, colisão e source de dano. As suítes 15.7
     provam caps e isolamento; cenários sem replay mantêm Canvas/RNG. */
  /* PR15.5-E8: re-baselineado. O diff no corpo de fireWeaponFrom é UMA linha
     e nada mais — a chamada de emissão genérica
       spawnParticles(src.x+cos(aim)*(r+10),...,def.color,3,140,.18,2.5)
     virou emitWeaponMuzzleVisual(src,def). É hash de TEXTO-FONTE, então
     qualquer edição o move; a equivalência foi provada por comportamento:
     nas 19 armas ranged, com Math.random determinístico, projectiles.length,
     vx/vy/dmg/color/type de cada projétil e o recoil (player.vx/vy) ficaram
     IDÊNTICOS — 0 campos divergentes. O RNG consumido por disparo CAIU de
     294 para 66 chamadas (-78%), porque o muzzle antigo gastava 4 rand() por
     partícula e o novo é determinístico. Nenhuma mudança de dmg, speed,
     spread, count, cooldown, kick ou geometria de projétil. */
  "fireWeaponFrom": "d53ff3c0823f2bfaf1961cb2c7287e71accad8223f9bbff79a3cd3f6fe64db60",
  "updatePlayer": "3ffe66f1d3cc91ca3a1a649725badda3b90d8bbf3caa7f7f49dd1b80377a54f4",
  "updateEcho": "d07bf292026f348599f4a0662bd60e183832ee5071944caceb0983a652491fac",
  "updateBoss": "d85abc88b8a06b8243f7df551772227a54b195dee0bee69900a98bda27d255d4",
  "updateMiniBoss": "054efc621c431337d55dff53de9094e57a9bb2ac9a720ab3541b37138f1785f9",
  "updateSwings": "cd2a0ad7d8e69f4d6906e0bd3a67d5cdb017dddd1ce4ec2babae8587bb508fd0",
  "updateArcs": "b39e93f4a86d1d07d01a4764f18d1590a46dfd9bb48a72f8d5d82bbf9b4e54b2",
  "updateAllies": "5a28eb9e879670e0a302b29eaa5aa01ee4798f76658f9b5d5d772fab69547a40",
  "updatePickups": "b10dcb596964b2971dcb39c6ecc18f8cbd8c0b6fd79ee88932d60a7824a04d0a",
  "updateResonance": "329f387367ca2b706c5dc17e1e43ec0beb3a64115497a4b57ab647b685a25b14",
  "pickTarget": "d82795f49e277ec2990a908d3bf27560600156c2a58fcafc6676759301614e96",
  /* PR15.5-C: drawEnemy re-baselineado — ganhou (1) o dip de alpha do
     pose de hurt espectral/energético (1 estado globalAlpha quando
     vp.alpha<1) e (2) ajustes de PRIMITIVAS EXISTENTES por família de
     material (parâmetros de raio/centro/offset — mesma contagem de
     ops em idle; sem novo save/restore/translate/rotate/scale/blur).
     A pose de hurt agora é por família (ENEMY_IMPACT_PROFILES).
     Os goldens A–I (desenho idle sintético) continuam idênticos à
     base, comprovando que o fast path não mudou. */
  /* PR15.5-E0: re-baseline. A aberração cromática do Anômalo deixou de
     usar 4× rand()/frame e passou a derivar de runTime + e.visualSeed
     (cópias ciano/magenta agora anti-correlacionadas). jj, strikeT e
     vp.lean intactos; nenhum outro ramo de drawEnemy foi tocado. */
  "drawEnemy": "93a0eba8f7b09078852d54bb5898b788d62dfd143ff2d807249424fd8026b233",
  /* PR15.5-E1: re-baseline do hash do TEXTO-FONTE, não do resultado.
     drawProjectile foi refatorado de um `if(orb)` binário para dispatch
     com helpers (projectileUsesOrbShape / projectileRangeFade /
     drawProjectileGlow / drawProjectileOrbShape / drawProjectileLegacyLine).
     O corpo da função mudou por definição, então este pin de texto tinha
     de mudar.

     A APARÊNCIA não mudou, e isso é provado de duas formas independentes,
     ambas verdes nesta mesma suíte e SEM qualquer alteração:
       · os 9 goldens `hashCanvas` (cenários A–I, logo abaixo) continuam
         com os valores originais — a sequência e os argumentos Canvas são
         idênticos aos da base;
       · `consumo de RNG de draw preservado` segue 0 em todos os cenários.
     Adicionalmente, tests/pr15-5-e1-projectile-visual-grammar.test.js §C
     reconstrói a implementação anterior no mesmo sandbox e compara o
     traço do ctx em 576 combinações de tipo/alcance/cor/velocidade:
     ZERO divergências.

     Nenhuma assertiva foi afrouxada: o pin continua sendo igualdade
     estrita de SHA-256 sobre o corpo da função. */
  /* PR15.5-E2: re-baseline do hash do TEXTO-FONTE (o anterior era do
     E1). drawProjectile ganhou 2 linhas: a consulta de modo temporal
     (projectileTemporalMode) e a chamada condicional da camada
     (drawProjectileTemporalLayer). O corpo mudou, então o pin mudou.

     As cenas NÃO temporais continuam idênticas, e isso é provado sem
     nenhuma alteração nesta suíte: os 9 goldens `hashCanvas` (cenários
     A–I, abaixo) seguem com os MESMOS valores e `consumo de RNG de
     draw` segue 0 — os fixtures de performance não contêm projéteis de
     replay nem de Echo, logo a camada nunca é acionada neles.

     A mudança visual é intencional e restrita a projéteis temporais,
     coberta por tests/pr15-5-e2-temporal-projectile-identity.test.js.
     Nenhuma assertiva afrouxada: continua igualdade estrita de SHA-256. */
  /* PR15.5-E3: re-baseline do hash do TEXTO-FONTE (o anterior era do
     E2). drawProjectile ganhou o ramo da família SLUG, que despacha
     rail/sniper/nail para drawProjectileSlug.

     As 9 cenas de benchmark continuam com `hashCanvas` IDÊNTICO e
     `consumo de RNG de draw` = 0, sem nenhuma alteração nesta suíte:
     os fixtures A–I não contêm projéteis de rail, sniper nem nail, logo
     a mudança de forma não os alcança. Isso confirma que o E3 alterou
     exatamente as 3 armas pretendidas e nada mais — o que também é
     medido em pr15-5-e1 §C01/§C01b (945 combinações idênticas fora da
     família SLUG, 135 de 135 alteradas dentro dela).

     Nenhuma assertiva afrouxada: igualdade estrita de SHA-256. */
  /* PR15.5-E4: re-baselineado. O diff no corpo de drawProjectile é UMA
     linha ADICIONADA e nada removido:
       else if(visualFamilyForProjectile(p)===PVF_SWARM)drawProjectileSwarm(p);
     É hash de TEXTO-FONTE, então qualquer edição o move. Nada de
     mecânico mudou: nas 4 armas do enxame (smg/shotgun/homing/prism),
     com Math.random determinístico, count, vx/vy, dmg, r, color, type,
     life, maxDist, homing, split, pierce, bounce, aoe e o recoil
     ficaram IDÊNTICOS a de4ce87 — 0 divergências. Os 9 cenários de
     Canvas acima seguem byte-idênticos (nenhum usa essas 4 armas) e o
     RNG continua em 0. */
  /* PR15.5-E10: re-baselineado pelo mesmo motivo do E4 — UMA linha
     ADICIONADA ao dispatch, nada removido:
       else if(visualFamilyForProjectile(p)===PVF_KINETIC)drawProjectileKinetic(p);
     Nas 4 armas cinéticas (ricochet/boomer/gatling/mine), com RNG
     determinístico, count, vx/vy, dmg, r, color, type, life, maxDist,
     bounce, homing, aoe, pierce, mine, boomerang, crit e o recoil
     ficaram IDÊNTICOS a 4366eb6 — 0 divergências. O quique real do
     ricochet (vx invertido, bounce 3->2, dmg 12->13.8) e o ciclo da
     mine (desaceleração 300->22, armT 0.667) também conferem. Os 9
     cenários de Canvas acima seguem byte-idênticos e o RNG em 0. */
  /* PR15.5-E6: re-baselineado pelo mesmo motivo do E4/E10 — UMA linha
     ADICIONADA ao dispatch, nada removido:
       else if(visualFamilyForProjectile(p)===PVF_FLUID)drawProjectileFluidSpray(p);
     Mecânica idêntica: count, vx/vy, dmg, r, color, type, life, maxDist,
     aoe(0), pierce(0) e recoil de flamer/acid conferem na sonda do E6;
     burn continua 3.2s/9 (12 ticks de 2.25) e corrode 4.5s/.12 sem DoT
     (statusDmgMul ×1.12/×1.24). Os 9 cenários de Canvas acima seguem
     byte-idênticos (nenhum usa flamer/acid) e o RNG continua em 0. */
  /* PR15.5-E7: re-baselineado pelo mesmo motivo — UMA linha ADICIONADA ao
     dispatch, nada removido:
       else if(visualFamilyForProjectile(p)===PVF_CONDUCT)drawProjectileConductionStatus(p);
     Mecânica idêntica: count, vx/vy, dmg, r, color, type, life, maxDist,
     pierce(0) e recoil de tesla/plague conferem na suíte do E7; o chain
     real do tesla segue 2 saltos ×0.78 (raio 230, arcos históricos), o
     shock segue marcador sem DoT e o corrode da plague segue amplificador
     ×1.10/stack sem DoT (aoe/contagion da plague são config morta, como
     o implode do void no E5 — documentado, não corrigido). Os 9 cenários
     de Canvas acima seguem byte-idênticos (nenhum usa tesla/plague) e o
     RNG continua em 0. */
  "drawProjectile": "9ffa21e48dcec7e566244f0b38cbd294bb9ea363ba3db36da8254beeff2df527",
  /* PR15.5-D: drawSwings re-baselineado — ganhou o despacho para o trail
     por família (meleeDrawTrail, pinado abaixo). O fallback legado e o
     comportamento sem RNG permanecem; os goldens A–I comprovam que os
     cenários sintéticos (swings sem perfil) desenham idêntico à base. */
  "drawSwings": "8d98d6109726464ef4b2816c3246d2550557e3db671299811204e3aa9dc378e0",
  "meleeDrawTrail": "c756290f87617435b59587bfcb25f47c20f4a7f8d4c992ee6d1d771c33e77176",
  /* PR15.5-E0: re-baseline. Os 6 rand()/arco/frame viraram vJit1 sobre
     (geometria do arco, idade quantizada em 60 Hz, índice do segmento).
     Mesma amplitude (±9), mesmos 4 segmentos, mesmas cores; o array
     `arcs` continua sendo mutado só por chainLightning/reap/updateArcs. */
  "drawArcs": "666fc01be45c35a1456cea612350c3cb640b050317898332a1e3072d039fe61a",
  "updateRenderGovernor": "42c6df21322a4150a590bfad63e1b4494c14c860da150b9cc3f3142d623f2d1f"
};
for(const [name,hash] of Object.entries(mechanical))ok('Mecânica/RNG intactos: '+name,()=>{const pattern=new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}');const code=SRC.match(pattern);assert.ok(code,name);assert.strictEqual(crypto.createHash('sha256').update(code[0]).digest('hex'),hash);});
/* GOLDENS DE RENDER — RE-BASELINE PR15.5-E0
   ---------------------------------------------------------------------
   O campo `random` era o CONSUMO DE RNG GLOBAL durante render(). Os
   valores antigos (B:6 C:24 D:48 E:72 G:18 H:96 I:36) eram justamente o
   defeito que o PR15.5-E0 corrigiu: rand() é wrapper de Math.random(),
   o mesmo fluxo de crit/spread/Elite/drops, então cada frame desenhado
   deslocava a sequência mecânica (FPS, refresh rate, culling de câmera,
   tempo em modal e cfg.aberr mudavam o resultado da run).

   Agora TODOS os cenários medem `random: 0` — o renderer virou
   observador. Esse 0 é um invariante muito mais forte que os números
   antigos: qualquer regressão futura que reintroduza RNG no draw falha
   aqui imediatamente.

   `hashCanvas` mudou junto porque o jitter passou a ser derivado de
   hash determinístico (vHash32/vJit1) em vez de Math.random — mesmas
   amplitudes e frequências, fonte diferente. O cenário F continua
   BIT-IDÊNTICO à base (já não usava RNG), o que comprova que os
   caminhos sem aleatoriedade não foram tocados.

   Precedente: PR15.5-C e PR15.5-D já re-baselinearam drawEnemy,
   drawSwings e meleeDrawTrail por mudança intencional (ver `mechanical`
   acima). A cobertura de determinismo vive em
   tests/pr15-5-e0-visual-determinism.test.js.                        */
const golden={
  "A": {
    "hashCanvas": "92128f38fc4c28e08e4e1f3e62de2c3433383fddfc52e3bd59c31494c0c7ba55",
    "random": 0
  },
  "B": {
    "hashCanvas": "193cfe5b00d1e8bc167578da27a82a2e64fcf0c4c31c8a681c797ebdfd1cd0b2",
    "random": 0
  },
  "C": {
    "hashCanvas": "13d67b2ca4584ebf4ab97bacaaa5bb60e662b7a76d7882c9f00c7b9330268dc6",
    "random": 0
  },
  "D": {
    "hashCanvas": "443c84548afe75be9d0c3af2f572cb2898bfe7f4a4ad75da99bf6647497de441",
    "random": 0
  },
  "E": {
    "hashCanvas": "019ac635ee24ef205cd94eeb7f619fc21dafa1a2c0560dcd387dd2247963b9f5",
    "random": 0
  },
  "F": {
    "hashCanvas": "517bb713670e0e8a80d041abf71bbcbf212abfcb1c517303842a9b44d6a41866",
    "random": 0
  },
  "G": {
    "hashCanvas": "6f0c0698f53758c088e8c2921ebf7d330c3bc5501428c28dba08b550278198df",
    "random": 0
  },
  "H": {
    "hashCanvas": "f6e465d62f6d50ca51678a430df37bff68018a39445869bfac052137489b596d",
    "random": 0
  },
  "I": {
    "hashCanvas": "d7ead33fced65483f7506e0e30d4b4ca737f806f0687a29a853223b9e554943b",
    "random": 0
  }
};
for(const [id,g] of Object.entries(golden)){
  ok('Cenário '+id+': sequência/argumentos Canvas idênticos à base (corpo neutro Grupo B)',()=>{ready(id);run('player.charId="warden";resize();render()');const r=measure(h,'render()');assert.strictEqual(r.hashCanvas,g.hashCanvas);});
  ok('Cenário '+id+': consumo de RNG de draw preservado',()=>{ready(id);run('player.charId="warden";resize();render()');const r=measure(h,'render()');assert.strictEqual(r.trig.random,g.random);});
}
ok('FX-heavy elimina exatamente 7200 sin/cos por render',()=>{ready('H');run('resize();render()');const r=measure(h,'render()');assert.strictEqual(r.trig.sin+r.trig.cos,52);});
console.log(`\nResultado: ${pass} passaram · ${fail} falharam`);
if(fail)process.exitCode=1;
