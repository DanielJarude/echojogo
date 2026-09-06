'use strict';
/* Auditoria de runtime do HUD (PR13.5 · B5-B-FIX).
   Roda o loop REAL do jogo (loop(now) → render() → updateHUD()) contra
   mudanças de state e compara STATE × DOM por indicador. Também mede
   quantas vezes updateHUD escreve por segundo (throttle) e se render()
   lança. Funciona em qualquer árvore: node audit_pr135/hud_runtime_audit.js [ROOT] */
const ROOT=process.argv[2]||require('path').join(__dirname,'..');
const {sandbox,T}=require(ROOT+'/audit_pr135/harness.js');
const vm=require('vm');const X=c=>vm.runInContext(c,sandbox);
const $=id=>X('$("'+id+'")');const txt=id=>String($(id).textContent);
let NOW=1000;const frames=n=>{for(let i=0;i<n;i++){NOW+=16.7;X('loop('+NOW+')');}};
console.log('# HUD RUNTIME AUDIT · ROOT='+ROOT);
T.resetShopVars();T.setState('title');T.setMoral({comp:0,greed:0,viol:0});T.setPlayer(null);T.startRun();X('last='+NOW);
const p=T.getPlayer();T.setEnemies([]);
/* mantém 1 inimigo parado longe: sem ele o loop fecha a onda e abre a loja (o mock DOM não tem os cards) */
X("const _k=spawnEnemy('tank',60,60,1);_k.spawnT=0;_k.spd=0;");
let renderThrows=null;try{X('render()');}catch(e){renderThrows=e.message;}
console.log('render() lança?',renderThrows?('SIM — '+renderThrows):'não');
frames(8);
const before={hp:txt('hpnum'),sh:txt('shnum'),coins:txt('coinsp'),wave:txt('wave'),timer:txt('timer'),lvl:txt('lvl'),dash:($('dashlbl')&&$('dashlbl').textContent)||'(sem dashlbl)',sp:txt('splbl')};
p.hp=p.maxHp*.42;p.shieldMax=30;p.shield=11;p.shieldRegen=0;p.coins=808;X('wave=9;kills=21;runTime=77');p.dashCdMax=2;p.dashCd=1.2;p.xp=p.xpNext*.5;
frames(8);   // > 0,09 s de throttle
const after={hp:txt('hpnum'),sh:txt('shnum'),coins:txt('coinsp'),wave:txt('wave'),timer:txt('timer'),lvl:txt('lvl'),dash:($('dashlbl')&&$('dashlbl').textContent)||'(sem dashlbl)',sp:txt('splbl')};
const exp={hp:Math.ceil(p.maxHp*.42)+' / '+p.maxHp,sh:'11 / 30',coins:'◈ 808',wave:'ONDA 09 / 20',timer:'01:17 · ABATES 21',lvl:'NV 1 · '+Math.floor(p.xp)+'/'+p.xpNext};
console.log('\n| indicador | DOM antes | DOM depois da mudança de state | esperado | ok |');console.log('|---|---|---|---|---|');
let okAll=true;
for(const k of ['hp','sh','coins','wave','timer','lvl']){const ok=after[k]===exp[k];okAll=okAll&&ok;console.log('| '+k+' | '+before[k]+' | '+after[k]+' | '+exp[k]+' | '+(ok?'✔':'✘')+' |');}
console.log('| dash | '+before.dash+' | '+after.dash+' | DASH ~1.1s | '+(/^DASH 1\.[012]s$/.test(after.dash)?'✔':'✘')+' |');
console.log('| especial | '+before.sp+' | '+after.sp+' | rótulo do operador | '+(after.sp.length>3?'✔':'✘')+' |');
console.log('\nSTATE→DOM sistêmico:',okAll?'OK':'DIVERGENTE');
/* throttle */
let calls=0;X('globalThis.__c=0;__uh2=updateHUD;updateHUD=function(f){if(!f&&hudAcc<.09)return;globalThis.__c++;return __uh2(f);}');
frames(300);calls=X('globalThis.__c');X('updateHUD=__uh2');
console.log('updateHUD efetivos em 5 s de loop:',calls,'(~'+(calls/5).toFixed(1)+'/s; alvo ≈11/s pelo throttle de 0,09 s)');
console.log('escritas DOM por updateHUD (aprox.): ~22 propriedades → ~'+Math.round(calls/5*22)+' writes/s em vez de ~1320/s sem throttle');
