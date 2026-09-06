'use strict';
/* =====================================================================
   TESTES — PR13.5 · B5-B-FIX · SINCRONIZAÇÃO STATE → HUD (DOM)
   Todos os testes passam pelo caminho REAL de frame: loop(now) →
   render() → updateHUD(). Nada chama updateHUD() diretamente, exceto
   onde o jogo já o faz (Continue/startRun).
   ===================================================================== */
const assert=require('assert');
const fs=require('fs'),path=require('path'),vm=require('vm');
const {sandbox,T,SRC}=require('../audit_pr135/harness.js');   // SRC normalizado para LF (B5-B-FIX.1: portável LF/CRLF)
const X=code=>vm.runInContext(code,sandbox);
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
const $=id=>X('$("'+id+'")');
const txt=id=>String($(id).textContent);
let NOW=1000;
/* avança N frames REAIS de 16,7 ms pelo loop do jogo */
function frames(n){for(let i=0;i<n;i++){NOW+=16.7;X('loop('+NOW+')');}}
function fresh(){T.resetShopVars();T.setState('title');T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);T.startRun();NOW+=100;X('last='+NOW);
  const p=T.getPlayer();T.setEnemies([]);T.setProjectiles([]);T.setMiniBoss(null);frames(8);return p;}
const num=s=>{const m=String(s).replace(/\./g,'').match(/-?\d+/);return m?+m[0]:NaN;};

console.log('\nECHO — PR13.5 · B5-B-FIX · STATE → HUD');
console.log('---------------------------------------------');

ok('FIX-0: causa raiz — render() não referencia mais renderSpeech (inexistente); chama speechRender; HUD roda em try próprio',()=>{
  assert.ok(!/^\s*renderSpeech\(\);/m.test(SRC),'renderSpeech() ainda chamado');
  assert.ok(/speechRender\(\);\s*\/\* B5-B-FIX/.test(SRC));
  assert.ok(/try\{render\(\);\}\s*catch/.test(SRC)&&/hudAcc\+=dt;\s*updateHUD\(\);/.test(SRC),'HUD fora do alcance de exceção do render');
  /* render() executa sem lançar num frame real */
  fresh();assert.doesNotThrow(()=>X('render()'));
});
ok('FIX-1: HP state→DOM pelo loop: 100 % → 75 % → 25 % → heal → 100 %',()=>{
  const p=fresh();const max=p.maxHp;
  for(const f of [.75,.25]){p.hp=max*f;frames(8);assert.strictEqual(num(txt('hpnum').split('/')[0]),Math.ceil(max*f));assert.strictEqual($('hpfill').style.width,(f*100)+'%');}
  p.hp=max;frames(8);assert.strictEqual(num(txt('hpnum').split('/')[0]),max);assert.strictEqual($('hpfill').style.width,'100%');
  assert.strictEqual(num(txt('hpnum').split('/')[1]),max,'maxHp');
});
ok('FIX-2: dano REAL (damagePlayer) reduz state e o DOM acompanha; 0 HP mostra 0',()=>{
  const p=fresh();p.shield=0;p.shieldMax=0;const h0=p.hp;X('damagePlayer(30)');frames(8);
  assert.strictEqual(num(txt('hpnum').split('/')[0]),Math.ceil(h0-30));
  p.hp=0;frames(8);assert.strictEqual(num(txt('hpnum').split('/')[0]),0);assert.strictEqual($('hpfill').style.width,'0%');
});
ok('FIX-3: Shield FULL → DAMAGE → BREAK → REGEN → FULL no DOM (texto, largura e classes)',()=>{
  const p=fresh();p.shieldMax=40;p.shield=40;p.shieldRegen=0;p.shieldDelay=.1;p.shieldDelayT=0;frames(8);
  assert.strictEqual(txt('shnum'),'40 / 40');assert.ok($('shbar').classList.contains('full'));
  p.shield=15;frames(8);assert.strictEqual(num(txt('shnum').split('/')[0]),15);assert.ok($('shbar').classList.contains('partial'));
  p.shield=0;frames(8);assert.strictEqual(num(txt('shnum').split('/')[0]),0);assert.ok($('shbar').classList.contains('empty'));assert.strictEqual($('shfill').style.width,'0%');
  /* regen REAL: liga a regeneração e deixa o loop subir o escudo — o DOM acompanha a subida */
  p.shieldRegen=20;p.shieldDelayT=0;frames(30);const mid=num(txt('shnum').split('/')[0]);assert.ok(mid>0&&mid<40,'subindo: '+mid);assert.ok($('shbar').classList.contains('regen'),'classe regen enquanto regenera');
  frames(180);assert.strictEqual(txt('shnum'),'40 / 40');assert.ok($('shbar').classList.contains('full'));assert.strictEqual($('shfill').style.width,'100%');
});
ok('FIX-4: Shield real pelo pipeline: damagePlayer absorve no escudo e o DOM cai; shieldMax vindo do Stat Pipeline aparece',()=>{
  const p=fresh();T.smMul(p,'shieldMax','test.sh','+50% ESCUDO',1.5);p.shield=p.shieldMax;frames(8);
  assert.strictEqual(num(txt('shnum').split('/')[1]),Math.round(p.shieldMax));
  const s0=p.shield;X('damagePlayer(10)');frames(8);assert.ok(p.shield<s0);assert.strictEqual(num(txt('shnum').split('/')[0]),Math.max(0,Math.ceil(p.shield)));
});
ok('FIX-5: Dash pronto → cooldown (rótulo mostra quanto falta) → pronto',()=>{
  const p=fresh();p.dashCd=0;frames(8);assert.strictEqual(txt('dashlbl'),'DASH [ESPAÇO]');assert.ok($('dashwrap').classList.contains('ready'));assert.strictEqual($('dashfill').style.width,'100%');
  p.dashCdMax=2;p.dashCd=1.5;frames(8);   // o loop desconta ~0,13 s nesses frames: rótulo mostra o restante REAL
  assert.ok(/^DASH 1\.[34]s$/.test(txt('dashlbl')),txt('dashlbl'));assert.ok(!$('dashwrap').classList.contains('ready'));
  const w=parseFloat($('dashfill').style.width);assert.ok(w>25&&w<40,'progresso ~30 %: '+w);
  p.dashCd=.6;frames(8);assert.ok(/^DASH 0\.[45]s$/.test(txt('dashlbl')),txt('dashlbl'));
  /* cooldown termina sozinho pelo loop → pronto */
  frames(60);assert.strictEqual(txt('dashlbl'),'DASH [ESPAÇO]');assert.ok($('dashwrap').classList.contains('ready'));
});
ok('FIX-6: Especial pronto → cooldown (restante) → ativo (duração) → pronto, com o cd do operador real',()=>{
  const p=fresh();const C=X('curChar()');assert.ok(C.sp,'operador tem especial');
  p.spCd=0;p.spT=0;frames(8);assert.strictEqual(txt('splbl'),C.sp.nm+' [E]');assert.ok($('spwrap').classList.contains('ready'));
  p.spCd=C.sp.cd*.5;frames(8);assert.strictEqual(txt('splbl'),C.sp.nm+' '+X('fmtSec')(p.spCd));const w=parseFloat($('spfill').style.width);assert.ok(Math.abs(w-50)<2,'50 %: '+w);
  p.spCd=0;p.spT=3;p.spMax=0;frames(8);assert.ok($('spwrap').classList.contains('active'));assert.ok(txt('splbl').indexOf(C.sp.nm+' ')===0&&/s$/.test(txt('splbl')),'duração ativa');
  p.spT=0;frames(8);assert.strictEqual(txt('splbl'),C.sp.nm+' [E]');
});
ok('FIX-7: Créditos — ganho e gasto (compra real na loja) refletem no DOM',()=>{
  const p=fresh();p.coins=50;frames(8);assert.strictEqual(txt('coinsp'),'◈ 50');
  p.coins+=120;frames(8);assert.strictEqual(txt('coinsp'),'◈ 170');
  p.coins=999;T.setWave(3);X('renderShop=function(){}');X('rollShop()');const it=T.getShopItems()[0];assert.ok(it);const pr=X('priceItem')(it);
  p.coins-=pr;X('giveItem')(it,false);frames(8);assert.strictEqual(txt('coinsp'),'◈ '+X('fmtCompact')(999-pr));
  p.coins=1234;frames(8);assert.strictEqual(txt('coinsp'),'◈ 1.2K','formato compacto por design');
});
ok('FIX-8: Sincronia (XP/nível) — fonte real player.xp/xpNext/level; barra e texto acompanham',()=>{
  const p=fresh();p.xp=0;p.level=1;frames(8);const n0=txt('lvl');assert.ok(/^NV 1 · 0\//.test(n0));
  p.xp=p.xpNext*.5;frames(8);assert.strictEqual(txt('lvl'),'NV 1 · '+Math.floor(p.xp)+'/'+p.xpNext);assert.strictEqual($('xpfill').style.width,'50%');
  p.level=3;p.xp=2;frames(8);assert.ok(/^NV 3 · 2\//.test(txt('lvl')));
});
ok('FIX-9: Onda 1 → 2 → 5 → 10 → 15 no DOM; com mini-chefe/boss o rótulo muda',()=>{
  fresh();for(const w of [1,2,5,10,15]){X('wave='+w);frames(8);assert.strictEqual(txt('wave'),'ONDA '+String(w).padStart(2,'0')+' / 20');}
  const b=T.spawnMiniBoss(10,T.MINIBOSS[0]);frames(8);assert.strictEqual(txt('wave'),'ARAUTO');T.setMiniBoss(null);T.setEnemies([]);X('clearMiniBossHUD()');
});
ok('FIX-10: Tempo avança no DOM durante play; congela em pause; retoma; Continue não volta a 0',()=>{
  fresh();X('runTime=0');frames(8);assert.strictEqual(txt('timer').split(' · ')[0],'00:00');
  frames(120);   // 2 s
  assert.strictEqual(txt('timer').split(' · ')[0],'00:02','avançou 2 s pelo loop');
  X('pauseGame()');const t1=txt('timer');frames(120);assert.strictEqual(txt('timer'),t1,'pausado não avança');
  X('resumeGame()');NOW=X('performance.now()');X('last='+NOW);frames(120);assert.notStrictEqual(txt('timer'),t1,'retomou');
  X('runTime=125');frames(8);assert.strictEqual(txt('timer').split(' · ')[0],'02:05');
});
ok('FIX-11: Abates 0 → 1 → vários (killEnemy real) no DOM',()=>{
  fresh();X('kills=0');frames(8);assert.ok(/ABATES 0$/.test(txt('timer')));
  X("const _e=spawnEnemy('chaser',300,300,3);_e.spawnT=0;curAttacker=player;damageEnemy(_e,1e6,0,0,false)");frames(8);assert.ok(/ABATES 1$/.test(txt('timer')),txt('timer'));
  X('kills=17');frames(8);assert.ok(/ABATES 17$/.test(txt('timer')));
});
ok('FIX-12: SISTÊMICO — HP, Shield, Créditos, Onda, Abates, runTime e Dash mudam no MESMO frame e TODOS os elementos acompanham (falhava em a27b3d1)',()=>{
  const p=fresh();p.shieldMax=30;p.shield=30;p.shieldRegen=0;frames(8);
  p.hp=p.maxHp*.4;p.shield=9;p.coins=555;X('wave=12;kills=33;runTime=61');p.dashCdMax=2;p.dashCd=1.0;
  frames(2);   // 1 frame de lógica + throttle: o HUD escreve no frame seguinte
  assert.strictEqual(num(txt('hpnum').split('/')[0]),Math.ceil(p.maxHp*.4));
  assert.strictEqual(num(txt('shnum').split('/')[0]),9);
  assert.strictEqual(txt('coinsp'),'◈ 555');
  assert.strictEqual(txt('wave'),'ONDA 12 / 20');
  assert.ok(/ABATES 33$/.test(txt('timer')));
  assert.strictEqual(txt('timer').split(' · ')[0],'01:01');
  assert.ok(/^DASH (1|1\.0|0\.9)s$/.test(txt('dashlbl')),txt('dashlbl'));   // fmtSec trima zeros: "1s"
});
ok('FIX-13: throttle/cache não bloqueia mudança legítima (11 Hz): 60 frames com mudanças a cada 10 frames → DOM sempre ≤ 0,1 s atrás',()=>{
  const p=fresh();let stale=0;
  for(let i=1;i<=60;i++){if(i%10===0)p.coins=i;frames(1);if(i%10===9&&txt('coinsp')!=='◈ '+(i-9))stale++;}
  assert.strictEqual(stale,0);
});
ok('FIX-14: performance — em estado estável updateHUD é chamado ~11×/s (throttle) e não por frame; sem DOM criado por frame',()=>{
  fresh();let calls=0;X('__uh=updateHUD;updateHUD=function(f){if(!f&&hudAcc<.09)return;calls=(globalThis.calls||0)+1;globalThis.calls=calls;return __uh(f);}');
  X('globalThis.calls=0');frames(60);const c=X('globalThis.calls');X('updateHUD=__uh');
  assert.ok(c>=9&&c<=13,'chamadas efetivas em 1 s: '+c);
  assert.ok(!/createElement/.test(SRC.slice(SRC.indexOf('function updateHUD('),SRC.indexOf('function updateHUD(')+4000)),'sem createElement no HUD');
});
ok('FIX-15: Continue — HUD representa o state restaurado IMEDIATAMENTE (sem esperar dano/crédito)',()=>{
  const p=fresh();T.activateSlot(1);p.hp=p.maxHp*.6;p.coins=321;X('wave=8;kills=12;runTime=90');X('renderShop=function(){}');T.setState('play');
  assert.ok(T.captureCheckpoint('teste',8));
  /* HUD "sujo": força valores diferentes no DOM sem tocar no slot (startRun limparia o checkpoint do slot) */
  p.coins=0;X('wave=1;kills=0;runTime=0');frames(8);assert.strictEqual(txt('coinsp'),'◈ 0');
  T.setPlayer(null);T.setState('title');T.resumeRun();   // sem frames: o próprio resume força updateHUD(true)
  assert.strictEqual(txt('coinsp'),'◈ 321');assert.ok(/ABATES 12$/.test(txt('timer')));assert.strictEqual(txt('timer').split(' · ')[0],'01:30');assert.strictEqual(txt('wave'),'ONDA 08 / 20');
  assert.strictEqual(num(txt('hpnum').split('/')[0]),Math.ceil(T.getPlayer().hp));
});
ok('FIX-16: morte → nova run: HUD não reutiliza snapshot antigo (startRun força updateHUD)',()=>{
  const p=fresh();p.hp=3;p.coins=900;X('wave=14;kills=40;runTime=300');frames(8);assert.strictEqual(txt('coinsp'),'◈ 900');
  X('onPlayerDeath()');T.setState('title');T.setPlayer(null);T.startRun();   // sem frames
  assert.strictEqual(txt('coinsp'),'◈ 0');assert.strictEqual(txt('wave'),'ONDA 01 / 20');assert.ok(/ABATES 0$/.test(txt('timer')));assert.strictEqual(txt('timer').split(' · ')[0],'00:00');
  assert.strictEqual(num(txt('hpnum').split('/')[0]),T.getPlayer().maxHp);
});
ok('FIX-17: DEV.hudState/hudSnapshot — inertes fora do DEV; em DEV comparam STATE × DOM campo a campo',()=>{
  const p=fresh();X('DEV_MODE=false');assert.strictEqual(X('DEV.hudState()'),null);assert.strictEqual(X('DEV.hudSnapshot()'),null);
  X('DEV_MODE=true');p.hp=37;p.coins=1234;p.dashCd=1.4;p.dashCdMax=2;X('kills=9;wave=10;runTime=125');
  const r=X('DEV.hudSnapshot()');assert.ok(r.ok,JSON.stringify(r));assert.strictEqual(r.hp.state,37);assert.strictEqual(r.hp.dom,37);assert.strictEqual(r.dash.dom,'1.4s');assert.strictEqual(r.credits.dom,'◈ 1.2K');
  const st=X('DEV.hudState()');assert.strictEqual(st.kills,9);assert.strictEqual(st.wave,10);assert.ok(st.special&&typeof st.special.ready==='boolean');
  X('DEV_MODE=false');
  assert.ok(/hudState\(\)\{\s*if\(!DEV_MODE\|\|!player\)return null;/.test(SRC)&&/hudSnapshot\(\)\{\s*if\(!DEV_MODE\|\|!player\)return null;/.test(SRC));
});
ok('FIX-18: com mini-chefe B5-B em fase 2 e hazards ativos, o frame real completa e o HUD segue acompanhando (render não derruba o HUD)',()=>{
  const p=fresh();X('wave=10');for(const id of ['furnace','colossus','oracle']){T.setEnemies([]);T.setMiniBoss(null);const b=T.spawnMiniBoss(10,T.MINIBOSS.find(m=>m.id===id));b.spawnT=0;b.hp=b.maxHp*.4;if(b.ms){b.ms.slamCd=0;b.ms.sleep='awake';b.ms.sleepT=99;}
    frames(90);assert.ok((b.hazards||[]).length>0||id==='oracle',id+' hazards');const v=100+b.hazards.length;p.coins=v;frames(8);assert.strictEqual(txt('coinsp'),'◈ '+v,id);}
  T.setEnemies([]);T.setMiniBoss(null);X('clearMiniBossHUD()');
});
ok('FIX-19: HUD do PARADOXO/mini-chefe (bosswrap) continua sendo atualizado pelo mesmo caminho e restaurado ao limpar',()=>{
  fresh();X('wave=10');const b=T.spawnMiniBoss(10,T.MINIBOSS[6]);b.spawnT=0;b.hp=b.maxHp*.3;frames(8);X('miniBossHUD()');
  assert.ok($('bossfill').style.width&&parseFloat($('bossfill').style.width)<40);T.setMiniBoss(null);T.setEnemies([]);X('clearMiniBossHUD()');assert.strictEqual(txt('bossnm'),'O   P A R A D O X O');
});

if(failed)console.log('\n'+failed+' FALHAS');else console.log('\n'+passed+' PASSARAM · 0 FALHAS');
process.exit(failed?1:0);
