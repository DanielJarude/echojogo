'use strict';
/*
   PR15.7-B.5 — HUD / COMUNICAÇÃO DA REPETIÇÃO ANCORADA
   Testes semânticos do Kit de Combate. A parte estrutural lê o contrato
   DOM/CSS; a parte dinâmica usa updateHUD() e o estado real da run.
*/
const assert=require('assert');
const {sandbox,T,SRC}=require('../audit_pr135/harness.js');
const vm=require('vm');
const X=code=>vm.runInContext(code,sandbox);
const $=id=>X('$("'+id+'")');
const txt=id=>String($(id).textContent);
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}
}
function fn(name){
  const i=SRC.indexOf('function '+name+'(');
  if(i<0)return '';
  const j=SRC.indexOf('\nfunction ',i+10);
  return SRC.slice(i,j<0?SRC.length:j);
}
function fresh(){
  T.setSandboxRun(false);T.setDevTainted(false);
  T.startRun({operatorId:'vector',freshMeta:true,noEchoes:true});
  T.setState('play');T.setEnemies([]);T.setProjectiles([]);
  X('padActive=false;runTime=10;hudAcc=1;updateHUD(true)');
  return T.getPlayer();
}
function capture(id){
  return X('(function(){var d=WEAPONS.find(function(w){return w.id==='+JSON.stringify(id)+';});return temporalActionCapture(player,d,"ally",calcDamageMul(player),"player");})()');
}

console.log('\nECHO — PR15.7-B.5 · KIT DE COMBATE / HUD');
console.log('---------------------------------------------');

ok('01 wrapper semântico agrupa arma, dash, especial e repetição na ordem do kit',()=>{
  const i=SRC.indexOf('<div id="combat-kit"');
  assert.ok(i>=0,'#combat-kit ausente');
  const end=SRC.indexOf('<aside id="metrics-overlay"',i);
  const kit=SRC.slice(i,end);
  const ids=['id="weapwrap"','id="dashwrap"','id="spwrap"','id="temporalwrap"'];
  let at=-1;
  for(const id of ids){const next=kit.indexOf(id);assert.ok(next>at,id+' fora do wrapper/ordem');at=next;}
  assert.match(kit,/role="group"/);assert.match(kit,/aria-label="Kit de combate"/);
});

ok('02 wrapper permanece compacto no canto inferior direito e não usa blur próprio',()=>{
  const css=SRC.slice(SRC.indexOf('#combat-kit{'),SRC.indexOf('#metrics-overlay{'));
  assert.match(css,/position:fixed/);assert.match(css,/right:clamp\(/);assert.match(css,/bottom:clamp\(/);
  assert.match(css,/width:max-content/);assert.match(css,/max-width:calc\(100vw - 16px\)/);
  assert.match(css,/\.wslot\{flex:0 0 78px/);assert.match(css,/width:min\(250px/);
  assert.ok(!css.includes('width:min(720px'),'Kit não volta à largura ampla do B.5');
  assert.match(css,/background:rgba\(/);assert.match(css,/border:1px solid/);
  assert.ok(!css.includes('backdrop-filter'),'Kit não adiciona blur caro');
});

ok('03 arma, dash, especial e repetição não continuam como quatro posições absolutas',()=>{
  const css=SRC.slice(SRC.indexOf('#combat-kit{'),SRC.indexOf('#metrics-overlay{'));
  assert.match(css,/#weapwrap\{position:static/);
  assert.match(css,/#dashwrap,#spwrap,#temporalwrap\{position:static/);
  assert.ok(!/#(?:weapwrap|dashwrap|spwrap|temporalwrap)\{position:absolute/.test(css));
});

ok('04 kit não duplica HP, Escudo, XP, economia, moral, Echo, wave, timer ou abates',()=>{
  const i=SRC.indexOf('<div id="combat-kit"');
  const kit=SRC.slice(i,SRC.indexOf('<aside id="metrics-overlay"',i));
  for(const word of ['INTEGRIDADE','ESCUDO','SINCRONIA','CRÉDITOS','MORAL','ECHO','ONDA','ABATES'])
    assert.ok(!kit.includes(word),word+' duplicado no kit');
});

ok('05 READY comunica captura futura, sem sugerir ativação de uma ação inexistente',()=>{
  fresh();
  assert.strictEqual(X('temporalAction'),null);
  assert.strictEqual($('temporalwrap').dataset.state,'ready');
  assert.ok($('temporalwrap').classList.contains('ready'));
  assert.ok(!$('temporalwrap').classList.contains('armed'));
  assert.match(txt('temporallbl'),/REPETIÇÃO.*AGUARDANDO AÇÃO.*\[R\]/);
  assert.strictEqual($('temporalfill').style.width,'100%');
});

ok('06 ARMED muda texto, input, cor/classe, barra de janela e pulso curto',()=>{
  fresh();capture('plasma');X('hudAcc=1;updateHUD(true)');
  assert.strictEqual($('temporalwrap').dataset.state,'armed');
  assert.ok($('temporalwrap').classList.contains('armed'));
  assert.match(txt('temporallbl'),/AÇÃO ARMADA.*\[R\]/);
  assert.strictEqual($('temporalfill').style.width,'100%');
  assert.ok($('temporalwrap').classList.contains('state-pulse'),'transição READY → ARMED');
  assert.match(SRC,/#temporalwrap\.armed[^}]*border-color:var\(--temporal-replay-color/);
});

ok('07 expiração iminente é apenas variação sutil de ARMED nos últimos 1,5s',()=>{
  fresh();capture('plasma');X('runTime=14;hudAcc=1;updateHUD(true)');
  assert.strictEqual($('temporalwrap').dataset.state,'armed');
  assert.ok($('temporalwrap').classList.contains('expiring'));
  const ratio=parseFloat($('temporalfill').style.width);
  assert.ok(ratio>15&&ratio<25,'janela restante: '+ratio);
  assert.match(SRC,/temporalUrgency/);
});

ok('08 COOLDOWN mostra recarga, barra própria e não se confunde com READY',()=>{
  fresh();capture('plasma');assert.ok(X('temporalReplayTry("test")')>0);
  X('hudAcc=1;updateHUD(true)');
  assert.strictEqual($('temporalwrap').dataset.state,'cooldown');
  assert.ok($('temporalwrap').classList.contains('cooldown'));
  assert.ok(!$('temporalwrap').classList.contains('armed'));
  assert.match(txt('temporallbl'),/REPETIÇÃO.*RECARGA.*6s.*\[R\]/);
  assert.strictEqual($('temporalfill').style.width,'0%');
});

ok('09 COOLDOWN → READY tem feedback discreto e mantém a ação mecânica encerrada',()=>{
  fresh();capture('plasma');X('temporalReplayTry("test");temporalReplayCooldown=0;hudAcc=1;updateHUD(true)');
  assert.strictEqual(X('temporalAction'),null);
  assert.strictEqual($('temporalwrap').dataset.state,'ready');
  assert.ok($('temporalwrap').classList.contains('state-pulse'));
  assert.match(txt('temporallbl'),/AGUARDANDO AÇÃO/);
});

ok('10 input dinâmico da Repetição alterna R ↔ R3 conforme padActive',()=>{
  fresh();
  X('padActive=true;hudAcc=1;updateHUD(true)');
  assert.match(txt('temporallbl'),/AGUARDANDO AÇÃO.*\[R3\]/);
  X('padActive=false;hudAcc=1;updateHUD(true)');
  assert.match(txt('temporallbl'),/AGUARDANDO AÇÃO.*\[R\]/);
  assert.match(fn('updateAnchoredReplayHUD'),/padActive\?'\[R3\]':'\[R\]'/);
});

ok('11 Dash usa Espaço no teclado e A/LT reais no gamepad',()=>{
  fresh();
  assert.strictEqual(txt('dashlbl'),'DASH [ESPAÇO]');
  X('padActive=true;hudAcc=1;updateHUD(true)');
  assert.strictEqual(txt('dashlbl'),'DASH');
  assert.strictEqual($('dashlbl').dataset.input,'[A / LT]');
  assert.ok($('dashlbl').classList.contains('pad-input'));
  assert.match(SRC,/#dashlbl\.pad-input::after[^}]*attr\(data-input\)/);
});

ok('12 Especial usa E no teclado e X real no gamepad',()=>{
  const p=fresh();const name=X('curChar().sp.nm');
  assert.strictEqual(txt('splbl'),name+' [E]');
  X('padActive=true;hudAcc=1;updateHUD(true)');
  assert.strictEqual(txt('splbl'),name);
  assert.strictEqual($('splbl').dataset.input,'[X]');
  assert.ok($('splbl').classList.contains('pad-input'));
  X('padActive=false;hudAcc=1;updateHUD(true)');
  assert.strictEqual(txt('splbl'),name+' [E]');
  assert.ok(p&&p.spCd>=0);
});

ok('13 Especial ausente esconde o bloco e libera automaticamente o espaço do kit',()=>{
  fresh();
  X('globalThis.__b5sp=curChar().sp;curChar().sp=null;hudAcc=1;updateHUD(true)');
  assert.strictEqual($('spwrap').hidden,true);
  assert.ok(!$('spwrap').classList.contains('ready'));
  X('curChar().sp=globalThis.__b5sp;hudAcc=1;updateHUD(true)');
  assert.strictEqual($('spwrap').hidden,false);
});

ok('14 responsividade cobre 1280×720 e o caso crítico 960×540 sem reposicionar para o centro',()=>{
  assert.match(SRC,/@media\(max-width:1100px\)[\s\S]*#combat-kit\{max-width:calc\(100vw - 16px\)/);
  assert.match(SRC,/@media\(max-height:600px\)[\s\S]*#combat-kit\{bottom:8px/);
  const css=SRC.slice(SRC.indexOf('#combat-kit{'),SRC.indexOf('#metrics-overlay{'));
  assert.ok(!css.includes('left:50%'),'Kit não invade o centro por posicionamento');
  assert.match(css,/max-width:calc\(100vw - 16px\)/);
  assert.match(css,/width:min\(236px/);
});

ok('15 animação da HUD é bounded: apenas pulso transitório e urgência curta',()=>{
  const css=SRC.slice(SRC.indexOf('#combat-kit{'),SRC.indexOf('#metrics-overlay{'));
  assert.match(css,/combatKitPulse \.42s ease-out/);
  assert.match(css,/temporalUrgency \.7s ease-in-out infinite alternate/);
  assert.ok(!css.includes('particle')&&!css.includes('backdrop-filter'));
});

ok('16 fonte visual compartilhada alimenta HUD, marker e feedback do replay',()=>{
  assert.match(SRC,/const TEMPORAL_REPLAY_COLOR='#ff4df0'/);
  assert.match(SRC,/setProperty\('--temporal-replay-color',TEMPORAL_REPLAY_COLOR\)/);
  assert.match(fn('drawTemporalActionMarker'),/ctx\.strokeStyle=TEMPORAL_REPLAY_COLOR/);
  assert.match(fn('temporalReplayTry'),/spawnRing\(a\.x,a\.y,TEMPORAL_REPLAY_COLOR/);
  assert.match(fn('temporalReplayTry'),/spawnParticles\(a\.x,a\.y,TEMPORAL_REPLAY_COLOR/);
  assert.match(SRC,/#temporalfill\{[^}]*background:var\(--temporal-replay-color/);
});

ok('17 marker continua ligado ao estado armed e à mesma janela de 5s',()=>{
  const b=fn('drawTemporalActionMarker');
  assert.match(b,/a&&a\.state==='armed'/);
  assert.match(b,/a\.expiresAt-runTime.*TEMPORAL_ACTION_WINDOW/);
  assert.match(b,/Math\.cos\(a\.angle\).*Math\.sin\(a\.angle\)/);
});

ok('18 mecânica preservada: janela 5s, cooldown 6s, dano 50% e whitelist A/B',()=>{
  assert.strictEqual(X('TEMPORAL_ACTION_WINDOW'),5);
  assert.strictEqual(X('TEMPORAL_REPLAY_COOLDOWN'),6);
  assert.strictEqual(X('TEMPORAL_REPLAY_DAMAGE'),.5);
  assert.deepStrictEqual(Object.keys(X('TEMPORAL_ACTION_WEAPONS')).sort(),['plasma','rail','shotgun','sniper']);
  assert.match(fn('replayTemporalAction'),/TEMPORAL_REPLAY_DAMAGE/);
});

ok('19 mecânica preservada: Echo não captura, temporalReplay não gera procs e não cria item hook',()=>{
  const source=SRC;
  assert.match(source,/source===TEMPORAL_ACTION_SOURCES\.PLAYER/);
  assert.match(source,/source:TEMPORAL_ACTION_SOURCES\.REPLAY/);
  assert.ok(!fn('replayTemporalAction').includes('itemEmit('));
  assert.ok(!fn('replayTemporalAction').includes('onProjectileHit'));
  assert.ok(!fn('replayTemporalAction').includes('temporalActionCapture'));
  assert.ok(!fn('updateEcho').includes('temporalReplayTry'));
});

ok('20 reset, morte, vitória, wave, menu, Continue e checkpoint continuam limpando/omitindo o estado',()=>{
  for(const reason of ['death','victory','run','menu'])
    assert.match(SRC,new RegExp("temporalReplayReset\\('"+reason+"'\\)"));
  assert.match(SRC,/temporalActionClear\('wave'\)/);
  assert.match(fn('resetCombatKitHUD'),/dataset\.state='ready'/);
  const cp=fn('smBuildCheckpoint');
  assert.ok(!cp.includes('temporalAction'),'checkpoint não persiste ação');
  assert.match(SRC,/function temporalReplayReset\(reason\)/);
});

ok('21 reset de menu também devolve a HUD da Repetição a READY',()=>{
  fresh();capture('plasma');X('hudAcc=1;updateHUD(true)');
  X('clearRunEntities()');
  assert.strictEqual($('temporalwrap').dataset.state,'ready');
  assert.match(txt('temporallbl'),/AGUARDANDO AÇÃO/);
});

console.log('\nPR15.7-B.5 — '+passed+' PASSARAM · '+failed+' FALHARAM\n');
if(failed)process.exit(1);
