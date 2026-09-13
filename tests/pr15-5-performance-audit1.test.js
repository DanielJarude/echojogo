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
ok('Não há culling novo que pule RNG dos arcos',()=>{const b=SRC.match(/function drawArcs\(\)\{[\s\S]*?\n\}/)[0];assert.ok(!b.includes('inView'));assert.ok(b.includes('rand(-9,9)'));});
ok('Pool e partículas conservam limites originais',()=>assert.match(SRC,/const PARTS_MAX=900, PARTS_POOL_MAX=900;/));
ok('LOW/MEDIUM/HIGH continuam .62/.84/1',()=>assert.match(SRC,/renderQuality=cfg.quality===0\?\.62:\(cfg.quality===2\?1:\.84\)/));
ok('Gate e dt clamp permanecem intocados',()=>{assert.match(SRC,/const TARGET_FPS=60;/);assert.match(SRC,/gateOn=avg<13\.2/);assert.match(SRC,/if\(raw>\.05\)raw=\.05/);});

// AUDIT_GOLDENS — hashes integrais da base b4654f1; preenchidos na auditoria.
const mechanical={
  "updateEnemy": "dabbbf648ddb4b427a4570ddde4944dd530c9fb2531791a0ca28c6ff76b475ec",
  "updateProjectiles": "a6b0ad8213a2bf6f8140777be9368965951e60ee958efdd9c7dd8d4d7a1abbda",
  "spawnEnemy": "a7d85058edb0491e7269f546f89d17c47ff7ff9faf705caa49f9dc632ad3a2af",
  "damageEnemy": "7e08463b4dbf4d11613cb12f1fd64c0342b8faaa3344c394e2eb2f2089686c43",
  "damagePlayer": "70fcbcf1be3a91c767a57a83f677a57b55cad5065465f3462b7e8ea2613f491b",
  /* PR15.7-A/B: re-baselineados somente nos pontos temporais explícitos:
     captura, expiração/cooldown, colisão e source de dano. As suítes 15.7
     provam caps e isolamento; cenários sem replay mantêm Canvas/RNG. */
  "fireWeaponFrom": "46e74865169416e8d35743221667ef0ea9e27a271d2df4fe8e65fc1074d7d5f9",
  "updatePlayer": "3ffe66f1d3cc91ca3a1a649725badda3b90d8bbf3caa7f7f49dd1b80377a54f4",
  "updateEcho": "9bbc62736cba04c0305c16f8a82988c8ecebd16df37d2dbc9f4eac81b223e656",
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
  "drawEnemy": "669f39f70bfb7f147c7a13ebda101dc90099379751c59ed912fec428c78b1dfe",
  "drawProjectile": "565cdac8706fc659607acab66596631b930430e41d064f20d2fc827631f32399",
  /* PR15.5-D: drawSwings re-baselineado — ganhou o despacho para o trail
     por família (meleeDrawTrail, pinado abaixo). O fallback legado e o
     comportamento sem RNG permanecem; os goldens A–I comprovam que os
     cenários sintéticos (swings sem perfil) desenham idêntico à base. */
  "drawSwings": "8d98d6109726464ef4b2816c3246d2550557e3db671299811204e3aa9dc378e0",
  "meleeDrawTrail": "c756290f87617435b59587bfcb25f47c20f4a7f8d4c992ee6d1d771c33e77176",
  "drawArcs": "7f31f510dc22eb909d146489f7ad1f0a17cafe555cd7c71fb5fd57f56715bb76",
  "updateRenderGovernor": "42c6df21322a4150a590bfad63e1b4494c14c860da150b9cc3f3142d623f2d1f"
};
for(const [name,hash] of Object.entries(mechanical))ok('Mecânica/RNG intactos: '+name,()=>{const pattern=new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}');const code=SRC.match(pattern);assert.ok(code,name);assert.strictEqual(crypto.createHash('sha256').update(code[0]).digest('hex'),hash);});
const golden={
  "A": {
    "hashCanvas": "92128f38fc4c28e08e4e1f3e62de2c3433383fddfc52e3bd59c31494c0c7ba55",
    "random": 0
  },
  "B": {
    "hashCanvas": "a65c77b9bc355164dc24a50965cb6dd22bd5bb32f3e5d1a8f6d268d5ddfc1d02",
    "random": 6
  },
  "C": {
    "hashCanvas": "80e9ca8f29870a5aec642c4f92ec44fead9c6385b364dbd115645e6f738602b6",
    "random": 24
  },
  "D": {
    "hashCanvas": "d774033e97d43e7244a7407e38237da5f836f345096a89e483b5193c7386668d",
    "random": 48
  },
  "E": {
    "hashCanvas": "ec1364c2a73177926743c53a4a9053356802c98515732c2084832e61117e1b4c",
    "random": 72
  },
  "F": {
    "hashCanvas": "139789a530f80437f9055f2e13d64b9208ded3c3fdfc7946e61549c9ec91e764",
    "random": 0
  },
  "G": {
    "hashCanvas": "57d3eecfd8f7348e37a597a68b8dc034611113d8413008f96ec6e1784d5ecb0a",
    "random": 18
  },
  "H": {
    "hashCanvas": "41dd77dcf5ee998a12cde7e33582e54ce52dd45680d1e5cec1dacdc4d78b9e76",
    "random": 96
  },
  "I": {
    "hashCanvas": "78c229eb704fcec8fe7432b01c3742e27fe3a7f312521176fd2c24ed18c12c4c",
    "random": 36
  }
};
for(const [id,g] of Object.entries(golden)){
  ok('Cenário '+id+': sequência/argumentos Canvas idênticos à base',()=>{ready(id);run('resize();render()');const r=measure(h,'render()');assert.strictEqual(r.hashCanvas,g.hashCanvas);});
  ok('Cenário '+id+': consumo de RNG de draw preservado',()=>{ready(id);run('resize();render()');const r=measure(h,'render()');assert.strictEqual(r.trig.random,g.random);});
}
ok('FX-heavy elimina exatamente 7200 sin/cos por render',()=>{ready('H');run('resize();render()');const r=measure(h,'render()');assert.strictEqual(r.trig.sin+r.trig.cos,52);});
console.log(`\nResultado: ${pass} passaram · ${fail} falharam`);
if(fail)process.exitCode=1;
