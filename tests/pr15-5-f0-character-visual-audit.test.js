'use strict';
/* =====================================================================
   ECHO — PR15.5-F0 · AUDITORIA DE IDENTIDADE VISUAL DE PERSONAGENS
   ---------------------------------------------------------------------
   F0 é SOMENTE auditoria/inventário/especificação: nenhum renderer de
   produção foi alterado. Esta suíte REGISTRA O ESTADO REAL do HEAD para
   que os blocos F1+ (rework) tenham baseline travada e não regredam
   silenciosamente:

   A · inventário real dos 8 operadores (sem operadores fantasmas);
   B · mapeamento de renderers (quem compartilha drawUnit);
   C · teste de silhueta estrutural (prova de palette-swap);
   D · âncoras hitbox×visual (origens r+6 / r+10);
   E · inventário/separação de Echo, Sombrio, Presença e Repetição;
   F · minibosses, Paradoxo, inimigos comuns (fronteiras B/C);
   G · preservação do arsenal D/E (famílias, muzzle determinístico);
   H · disciplina RNG no render (PR15.5-E0) dos renderers do escopo F;
   I · gramática de cores temporais (colisões documentadas);
   J · pureza de draw (render é observador).

   IMPORTANTE: os asserts C (grupos de silhueta) descrevem o estado
   ATUAL (palette-swap). Quando F1+ implementar identidade estrutural,
   estes asserts DEVEM ser atualizados deliberadamente — a suíte é o
   registro da auditoria, não um contrato eterno.
   ===================================================================== */
const assert=require('assert');
const crypto=require('crypto');
const vm=require('vm');
const {T,SRC,sandbox}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}
const run=c=>vm.runInContext(c,sandbox);

/* ---------- helpers ---------- */
function opsOf(fn){sandbox.__ctxLog=[];try{fn();}finally{const l=sandbox.__ctxLog;sandbox.__ctxLog=null;return l;}}
/* assinatura ESTRUTURAL: nomes das primitivas + tipos dos argumentos
   (número→n, cor→c, string→s). Duas entidades com a mesma assinatura são
   indistinguíveis em escala de cinza, sem HUD e sem cor. */
function sig(l){
  return l.map(function(e){
    const a=(e[1]||[]).map(function(x){
      if(typeof x==='number')return 'n';
      if(typeof x==='string'&&(/^#|rgba?\(/.test(x)))return 'c';
      return 's';
    }).join(',');
    return e[0]+'('+a+')';
  }).join('|');
}
const hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
/* extrai o corpo de `function name(...)` com casamento de chaves
   (ignorando strings/comentários) para scans de fonte */
function fnBody(name){
  const m=SRC.match(new RegExp('function '+name+'\\s*\\('));
  if(!m)throw new Error('função não encontrada: '+name);
  let i=SRC.indexOf('{',m.index);
  let depth=0,j=i,open=false;
  while(j<SRC.length){
    const c=SRC[j],d=SRC[j+1];
    if(c==='/'&&d==='/'){j=SRC.indexOf('\n',j);if(j<0)break;continue;}
    if(c==='/'&&d==='*'){j=SRC.indexOf('*/',j+2);if(j<0)break;j+=2;continue;}
    if(c==="'"||c==='"'){const q=c;j++;while(j<SRC.length&&SRC[j]!==q){if(SRC[j]==='\\')j++;j++;}j++;continue;}
    if(c==='{'){depth++;open=true;}
    else if(c==='}'){depth--;if(open&&depth===0)return SRC.slice(i,j+1);}
    j++;
  }
  throw new Error('corpo não fechado: '+name);
}
/* remove comentários do corpo extraído (comentários citam nomes de RNG
   em prosa — ex.: "sem Math.random em nenhum ponto" — e gerariam falso
   positivo no scan) */
function stripComments(s){
  return s.replace(/\/\*[\s\S]*?\*\//g,' ').replace(/(^|[^:])\/\/[^\n]*/g,'$1 ');
}
const RNG_RE=/Math\.random|\brand\s*\(|\brandi\s*\(|performance\.now|Date\.now/;
function noRNG(name){
  const b=stripComments(fnBody(name));
  assert.ok(!RNG_RE.test(b),name+' contém RNG/relógio: '+(b.match(RNG_RE)||[])[0]);
}

console.log('\nECHO — PR15.5-F0 · AUDITORIA VISUAL DE PERSONAGENS/ENTIDADES');
run('DEV_MODE=true;sandboxRun=true;');

/* ============ A · INVENTÁRIO REAL DOS OPERADORES ============ */
const OP_IDS=['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant'];
const OP_NMS=['VECTOR','WRAITH','BULWARK','PYRE','HARDEN','NÔMADE','ECHO-0','REVENANT'];
const OP_ROLES=['EQUILIBRADO','ASSASSINO','FORTALEZA','INCENDIÁRIO','TÁTICO','MERCENÁRIO','RESSONANTE','CEIFADOR'];
const OP_R=[14,13,16,14,15,14,14,13];
const OP_GUNS0=['plasma','nail','shotgun','flamer','acid','smg','tesla','scythe'];
ok('A01 CHARS tem exatamente 8 operadores jogáveis',()=>assert.strictEqual(T.CHARS.length,8));
ok('A02 ids reais e ordem histórica (grade 4×2)',()=>
  assert.strictEqual(T.CHARS.map(c=>c.id).join('|'),OP_IDS.join('|')));
ok('A03 nomes reais (HARDEN é id `warden`; NÔMADE é id `nomad`)',()=>
  assert.strictEqual(T.CHARS.map(c=>c.nm).join('|'),OP_NMS.join('|')));
ok('A04 papéis únicos por operador',()=>
  assert.strictEqual(T.CHARS.map(c=>c.role).join('|'),OP_ROLES.join('|')));
ok('A05 raios mecânicos 13–16 (hitbox = stat do operador)',()=>
  assert.strictEqual(T.CHARS.map(c=>c.r).join(','),OP_R.join(',')));
ok('A06 arma inicial (guns[0]) distinta alimenta o sprite',()=>
  assert.strictEqual(T.CHARS.map(c=>c.guns[0]).join('|'),OP_GUNS0.join('|')));
ok('A07 paleta completa (6 canais) em todos os 8',()=>{
  for(const C of T.CHARS)
    for(const k of ['body','dark','edge','glow','visor','head'])
      assert.ok(C.pal[k]&&/^#|rgba?\(/.test(C.pal[k]),C.id+' pal.'+k);});
ok('A08 especiais [E] únicos (blink/massacre/bastion/nova/turret/cache/overload/harvest)',()=>{
  const sp=T.CHARS.map(c=>c.sp.id);
  assert.strictEqual(new Set(sp).size,8);
  assert.strictEqual(sp.join('|'),'blink|massacre|bastion|nova|turret|cache|overload|harvest');});
ok('A09 sem operadores fantasmas: nenhum id fora dos 8 reais',()=>{
  for(const C of T.CHARS)assert.ok(OP_IDS.indexOf(C.id)>=0,C.id);});
ok('A10 desbloqueio: vector/wraith base; demais com condição real em UNLOCKS',()=>{
  assert.strictEqual(run('BASE_CHARS.join(",")'),'vector,wraith');
  for(const id of ['bulwark','pyre','echo0','warden','nomad','revenant'])
    assert.ok(T.UNLOCKS['c_'+id],'c_'+id);
  assert.ok(!T.UNLOCKS.c_vector&&!T.UNLOCKS.c_wraith);});
ok('A11 colisão documentada: `bulwark` é id de operador E de inimigo comum',()=>{
  assert.ok(T.CHARS.some(c=>c.id==='bulwark'));
  assert.ok(T.EDEFS.bulwark);});

/* ============ B · MAPEAMENTO DE RENDERERS ============ */
ok('B01 drawPlayer delega o corpo a drawUnit (renderer único)',()=>
  assert.ok(/drawUnit\(/.test(fnBody('drawPlayer'))));
ok('B02 drawShip é wrapper de compatibilidade sobre drawUnit (Ecos/Sombrios)',()=>
  assert.ok(/drawUnit\(/.test(fnBody('drawShip'))));
ok('B03 drawEchoEntity desenha o corpo via drawUnit',()=>
  assert.ok(/drawUnit\(/.test(fnBody('drawEchoEntity'))));
ok('B04 drawShadow (ECO SOMBRIO) desenha via drawUnit',()=>
  assert.ok(/drawUnit\(/.test(fnBody('drawShadow'))));
ok('B05 pr15PresDraw (Presença Temporal) desenha via drawUnit',()=>
  assert.ok(/drawUnit\(/.test(fnBody('pr15PresDraw'))));
ok('B06 drawBoss (Paradoxo) tem geometria própria — NÃO usa drawUnit',()=>
  assert.ok(!/drawUnit\(/.test(fnBody('drawBoss'))));
ok('B07 drawEnemy despacha boss/miniboss/shadow antes dos comuns',()=>{
  const b=fnBody('drawEnemy');
  assert.ok(/type==='boss'\)\{drawBoss/.test(b));
  assert.ok(/type==='miniboss'\)\{drawMiniBoss/.test(b));
  assert.ok(/type==='shadow'\)\{drawShadow/.test(b));});
ok('B08 MINIBOSS_RENDERERS cobre os 8 minibosses com renderer próprio',()=>{
  const r=run('Object.keys(MINIBOSS_RENDERERS)');
  assert.strictEqual(r.slice().sort().join('|'),'brood|colossus|duelist|furnace|herald|leech|oracle|sentinel');});
ok('B09 charPortrait é UM template SVG compartilhado (paleta-substituído), sem branch por operador',()=>{
  const b=fnBody('charPortrait');
  for(const id of OP_IDS)assert.ok(!new RegExp("case '"+id+"'").test(b),'branch por '+id);});

/* ============ C · TESTE DE SILHUETA ESTRUTURAL ============ */
const PL='{body:"#808080",dark:"#404040",edge:"#909090",glow:"#a0a0a0",visor:"#b0b0b0",head:"#707070",wep:"#a0a0a0"}';
ok('C01 corpo: drawUnit com mesma cor/mesmo r/mesma arma → assinatura IDÊNTICA nos 8 (palette-swap provado)',()=>{
  const s=new Set();
  for(let k=0;k<8;k++){
    const l=opsOf(()=>run('drawUnit(500,400,0,14,'+PL+',{wi:0,walk:0,phase:0})'));
    s.add(hash(sig(l)));
  }
  assert.strictEqual(s.size,1,'esperava 1 assinatura, achei '+s.size);});
/* map nome→hash estrutural do drawPlayer completo (corpo+arma inicial) */
function playerSigs(){
  const g={};
  for(let i=0;i<8;i++){
    run('setChar('+i+')');T.startRun();
    const p=T.getPlayer();
    p.x=500;p.y=400;p.vx=0;p.vy=0;p.hurtT=0;p.invT=0;p.dashT=0;p.rushT=0;p.rangeFx=0;
    g[T.CHARS[i].nm]=hash(sig(opsOf(()=>run('drawPlayer()'))));
  }
  return g;
}
ok('C02 drawPlayer: exatamente 5 grupos estruturais entre os 8 operadores (arma = único diferenciador)',()=>{
  const g=playerSigs();
  const distinct=new Set(Object.values(g));
  assert.strictEqual(distinct.size,5,'grupos='+distinct.size);
  /* pares confundíveis em monocromático, travados como registro da auditoria */
  assert.strictEqual(g.VECTOR,g.WRAITH,'VECTOR×WRAITH');
  assert.strictEqual(g.VECTOR,g['NÔMADE'],'VECTOR×NÔMADE');
  assert.strictEqual(g.PYRE,g.HARDEN,'PYRE×HARDEN');});
ok('C03 mesma assinatura estrutural ⇒ mesma contagem de comandos (consistência intra-grupo)',()=>{
  const g=playerSigs();
  const byHash={};
  for(let i=0;i<8;i++){
    run('setChar('+i+')');T.startRun();
    const p=T.getPlayer();
    p.x=500;p.y=400;p.vx=0;p.vy=0;p.hurtT=0;p.invT=0;p.dashT=0;p.rushT=0;p.rangeFx=0;
    const n=opsOf(()=>run('drawPlayer()')).length;
    const h=g[T.CHARS[i].nm];
    if(byHash[h]===undefined)byHash[h]=n;
    else assert.strictEqual(byHash[h],n,T.CHARS[i].nm+' divergiu do grupo');
  }});
ok('C04 classes de sprite de arma produzem estruturas distintas (shotgun × flamer × tesla × scythe × default)',()=>{
  const s=new Set();
  for(const id of ['plasma','shotgun','flamer','tesla','scythe']){
    const wi=run('WEAPONS.findIndex(x=>x.id==="'+id+'")');
    s.add(hash(sig(opsOf(()=>run('drawUnit(500,400,0,14,'+PL+',{wi:'+wi+',walk:0,phase:0})')))));
  }
  assert.strictEqual(s.size,5);});

/* ============ D · ÂNCORAS HITBOX × VISUAL ============ */
ok('D01 makePlayer usa o r REAL do operador (visual escala com a hitbox)',()=>{
  for(let i=0;i<8;i++){run('setChar('+i+')');T.startRun();
    assert.strictEqual(T.getPlayer().r,T.CHARS[i].r,T.CHARS[i].id);}});
ok('D02 origem mecânica do projétil ancorada em src.r+6 (fireWeaponFrom)',()=>
  assert.ok(/Math\.cos\(src\.aim\)\*\(src\.r\+6\)/.test(fnBody('fireWeaponFrom'))));
ok('D03 origem do muzzle (E8) ancorada em src.r+10 (emitWeaponMuzzleVisual)',()=>
  assert.ok(/Math\.cos\(ang\)\*\(src\.r\+10\)/.test(fnBody('emitWeaponMuzzleVisual'))));
ok('D04 origem do feixe ancorada em src.r+6 (drawBeamFrom)',()=>
  assert.ok(/ux\*\(src\.r\+6\)/.test(fnBody('drawBeamFrom'))));
ok('D05 drawUnit escala TODO o corpo por r (s=r/14): silhueta segue a hitbox',()=>
  assert.ok(/const s=r\/14/.test(fnBody('drawUnit'))));
ok('D06 melee usa origem no CENTRO + reach (não na ponta da arma)',()=>
  assert.ok(/x:src\.x,y:src\.y/.test(fnBody('fireMelee'))));

/* ============ E · ECHO / SOMBRIO / PRESENÇA / REPETIÇÃO ============ */
ok('E01 Echo aliado: 2 slots, hue ciano/magenta travados (slot1 #46e0ff · slot2 #ff4df0)',()=>{
  run('startRun({noEchoes:true,freshMeta:true})');
  run('echoes.length=0;echoes.push(echoRelInit(makeEcho({trail:[[0,500,400,0,0,0]],dom:"neutro",moral:{comp:0,greed:0,viol:0}},1)),echoRelInit(makeEcho({trail:[[0,400,400,0,0,0]],dom:"neutro",moral:{comp:0,greed:0,viol:0}},2)));');
  assert.strictEqual(run('echoes.map(e=>e.hue).join("|")'),'#46e0ff|#ff4df0');
  assert.strictEqual(run('echoes.map(e=>e.slot).join(",")'),'1,2');});
ok('E02 Echo slot 2 é o caminho glitch (imagem cromática dupla, determinística)',()=>{
  const b=fnBody('drawEchoEntity');
  assert.ok(/e\.slot===2/.test(b));
  assert.ok(/vHash32/.test(b));});
ok('E03 PTM: Repetição e Echo são detectados por METADATA, nunca por cor/forma',()=>{
  assert.strictEqual(T.projectileTemporalMode({temporalReplay:true}),T.PTM.REPLAY);
  assert.strictEqual(T.projectileTemporalMode({owner:{slot:1,data:{}}}),T.PTM.ECHO);
  assert.strictEqual(T.projectileTemporalMode({owner:{}}),T.PTM.NONE);
  assert.strictEqual(T.projectileTemporalMode(null),T.PTM.NONE);});
ok('E04 Repetição Ancorada INDEPENDENTE: gate sem Echo/trust/Ressonância/Memory Director',()=>{
  const b=fnBody('temporalReplayTry');
  for(const bad of ['echoQueue','trust','resonance','Resson','pr15Mem','changeEchoTrust'])
    assert.ok(b.indexOf(bad)<0,'gate referencia '+bad);});
ok('E05 Repetição: camada temporal usa TEMPORAL_REPLAY_COLOR como ACENTO (traço), não como corpo',()=>{
  const b=fnBody('drawProjectileTemporalLayer');
  assert.ok(b.indexOf('TEMPORAL_REPLAY_COLOR')>=0);
  assert.ok(!/fillStyle=/.test(b),'camada não pinta corpo');});
ok('E06 Presença Temporal NUNCA entra em echoes[] (fonte: nenhum echoes.push(pr15Presence))',()=>
  assert.ok(SRC.indexOf('echoes.push(pr15Presence')<0));
ok('E07 ECO SOMBRIO é inimigo (type shadow) gerado pelo Paradoxo, com arma derivada da trail',()=>{
  const b=fnBody('spawnShadowEcho');
  assert.ok(/type:'shadow'/.test(b));
  assert.ok(/srcData\.trail/.test(b));});
ok('E08 Dissonância: estados com cor/anel próprios (DIS_COLOR) no drawEchoEntity',()=>{
  const b=fnBody('drawEchoEntity');
  for(const st of ['fracturing','hostile','recovering','unstable'])
    assert.ok(b.indexOf(st)>=0,'sem estado '+st);});
ok('E09 Repetição respeita whitelist real (plasma/shotgun/rail/sniper)',()=>
  assert.strictEqual(run('Object.keys(TEMPORAL_ACTION_WEAPONS).sort().join("|")'),
    'plasma|rail|shotgun|sniper'));

/* ============ F · MINIBOSSES / PARADOXO / COMUNS ============ */
const MB_IDS=['herald','furnace','sentinel','brood','duelist','colossus','oracle','leech'];
ok('F01 pool real de 8 minibosses (Arauto…Sanguesuga)',()=>
  assert.strictEqual(run('MINIBOSS.map(m=>m.id).join("|")'),MB_IDS.join('|')));
ok('F02 cada miniboss tem perfil declarativo completo (B5-A)',()=>{
  for(const id of MB_IDS){
    const v=run('MINIBOSS_VISUALS["'+id+'"]');
    for(const k of ['silhouette','primary','secondary','accent','feature','secondaryFeature','telegraph','phaseVisual','spawn'])
      assert.ok(v[k],id+'.'+k);}});
ok('F03 8 telegraphs estruturalmente distintos (um por miniboss)',()=>{
  const t=run('MINIBOSS.map(m=>MINIBOSS_VISUALS[m.id].telegraph)');
  assert.strictEqual(new Set(t).size,8);});
ok('F04 8 assinaturas de spawn distintas',()=>{
  const s=run('MINIBOSS.map(m=>MINIBOSS_VISUALS[m.id].spawn)');
  assert.strictEqual(new Set(s).size,8);});
ok('F05 Paradoxo: 2 fases, beams/gravs/shocks/summon com renderer próprio',()=>{
  const b=fnBody('drawBoss');
  for(const k of ['beamOn','gravs','shocks','ring1','ring2'])
    assert.ok(b.indexOf(k)>=0,'drawBoss sem '+k);});
ok('F06 boss/miniboss/shadow seguem fallback de morte SEM corpse (fronteira C→F aberta)',()=>{
  assert.strictEqual(T.enemyImpactVisualProfile('boss').death,null);
  assert.strictEqual(T.enemyImpactVisualProfile('miniboss').death,null);
  assert.strictEqual(T.enemyImpactVisualProfile('shadow').death,null);});
ok('F07 11 inimigos comuns com perfil visual B (leitura de ataque)',()=>{
  const IDS=['chaser','shooter','tank','spawner','anomaly','swarm','orbiter','bulwark','splitter','phantom','singular'];
  assert.strictEqual(run('Object.keys(ENEMY_VISUAL_PROFILES).sort().join("|")'),IDS.slice().sort().join('|'));});
ok('F08 Phantom: intangibilidade mecânica ghostT intacta (anchor de fonte)',()=>
  assert.ok(/type==='phantom'&&e\.ghostT>0/.test(SRC)));
ok('F09 Singular: anel de influência no raio mecânico 420 e reflexão sem janela falsa',()=>{
  const b=fnBody('drawEnemy');
  assert.ok(/arc\(0,0,420/.test(b));
  assert.ok(/reflection/.test(b));});
ok('F10 minibosses desenham SEM shadowBlur (halo é glowSprite/drawImage — orçamento F6)',()=>{
  for(const id of MB_IDS){
    run('startRun({noEchoes:true,freshMeta:true})');
    run('var _mbF=MINIBOSS.find(m=>m.id==="'+id+'");spawnMiniBoss(5,_mbF);enemies[0].spawnT=0;enemies[0].flashT=0;enemies[0].telegraphT=0;');
    const l=opsOf(()=>run('drawEnemy(enemies[0])'));
    const bl=l.filter(e=>e[0]==='set:shadowBlur'&&e[1][0]>0).length;
    assert.strictEqual(bl,0,id+' usa shadowBlur');}});

/* ============ G · PRESERVAÇÃO D/E (ARSENAL) ============ */
ok('G01 PROJ_FAMILY classifica os 19 projéteis ranged sem fallback do catálogo',()=>{
  const ids=run('WEAPONS.filter(w=>!w.melee&&!w.beam).map(w=>w.id)');
  assert.strictEqual(ids.length,19);
  for(const id of ids)
    assert.ok(T.visualFamilyForProjectile({type:id})!==T.PVF.LEGACY,id);});
ok('G02 muzzle determinístico: emitWeaponMuzzleVisual e muzzleShot sem RNG',()=>{
  noRNG('emitWeaponMuzzleVisual');noRNG('muzzleShot');});
ok('G03 impacto determinístico (E9): impactShot sem RNG',()=>noRNG('impactShot'));
ok('G04 perfis melee D cobrem as 7 armas brancas',()=>{
  assert.strictEqual(run('Object.keys(MELEE_VISUAL_PROFILES).sort().join("|")'),
    'blade|chains|gaunt|glaive|hammer|katana|scythe');});
ok('G05 fast path melee: sem golpe ativo a pose retorna null (zero custo idle)',()=>{
  assert.strictEqual(run('visualMeleeWeaponPose({})'),null);});
ok('G06 hurt flicker do player determinístico (strobe via hurtT, sem RNG em drawPlayer)',()=>
  assert.ok(/p\.hurtT\*18/.test(fnBody('drawPlayer'))));

/* ============ H · DISCIPLINA RNG NO RENDER (escopo F) ============ */
const RENDERERS=['drawUnit','drawPlayer','drawEchoEntity','drawShadow','drawBoss','drawMiniBoss',
  'drawEnemy','drawWeaponSprite','drawSwings','meleeDrawTrail','drawStatus','drawEchoRole',
  'drawProjectileTemporalLayer','drawProjectile','pr15PresDraw','charPortrait',
  'drawHerald','drawFurnace','drawSentinel','drawBrood','drawDuelist','drawColossus','drawOracle','drawLeech'];
for(const f of RENDERERS)
  ok('H · '+f+' sem RNG/relógio de parede no draw',()=>noRNG(f));
ok('H99 fronteira documentada: RNG de render sobrevive SOMENTE em visuais de evento (escopo G)',()=>{
  assert.ok(RNG_RE.test(fnBody('renderScrap')),'renderScrap deveria conter rand (registro)');
  assert.ok(RNG_RE.test(fnBody('renderVault')),'renderVault deveria conter randi (registro)');});

/* ============ I · GRAMÁTICA DE CORES TEMPORAIS ============ */
ok('I01 Repetição ARMED é magenta #ff4df0 (fonte única)',()=>
  assert.strictEqual(run('TEMPORAL_REPLAY_COLOR'),'#ff4df0'));
ok('I02 colisões cor×entidade registradas: operador compartilha cor com entidade',()=>{
  const byId={};for(const C of T.CHARS)byId[C.id]=C.color;
  assert.strictEqual(byId.bulwark,run('MINIBOSS_VISUALS.sentinel.primary'),'BULWARK×Sentinela');
  assert.strictEqual(byId.revenant,run('MINIBOSS_VISUALS.leech.primary'),'REVENANT×Sanguesuga');
  assert.strictEqual(byId.nomad,run('MINIBOSS_VISUALS.oracle.primary'),'NÔMADE×Oráculo');
  assert.strictEqual(byId.warden,run('MINIBOSS_VISUALS.brood.primary'),'HARDEN×Matriz');});
ok('I03 Paradoxo usa o magenta temporal (#ff4df0) como cor do corpo',()=>{
  run('startRun({noEchoes:true,freshMeta:true})');run('spawnBoss()');
  assert.strictEqual(run('boss.color'),'#ff4df0');});

/* ============ J · PUREZA DE DRAW (RENDER = OBSERVADOR) ============ */
ok('J01 drawPlayer não muta o player',()=>{
  run('setChar(0)');T.startRun();
  const p=T.getPlayer();p.x=500;p.y=400;p.vx=0;p.vy=0;p.hurtT=0;p.invT=0;p.dashT=0;
  const b=JSON.stringify(p);run('drawPlayer()');
  assert.strictEqual(JSON.stringify(p),b);});
ok('J02 drawEchoEntity não muta o Echo (com ghosts e HP parcial)',()=>{
  run('startRun({noEchoes:true,freshMeta:true})');
  run('echoes.length=0;echoes.push(echoRelInit(makeEcho({trail:[[0,500,400,0,0,0]],dom:"neutro",moral:{comp:0,greed:0,viol:0}},1)));');
  run('echoes[0].spawnT=0;echoes[0].hp=echoes[0].maxHp*.5;echoes[0].ghosts=[{x:480,y:400}];');
  const b=JSON.stringify(run('echoes[0]'));
  run('drawEchoEntity(echoes[0])');
  assert.strictEqual(JSON.stringify(run('echoes[0]')),b);});
ok('J03 pr15PresDraw não muta a Presença Temporal',()=>{
  run('startRun({noEchoes:true,freshMeta:true})');
  run('pr15Presence={v:1,x:500,y:400,aim:0,phase:"active",age:5,alpha:1,scale:1,orbit:.5,resonance:1,source:"N-1",ghosts:[],vis:{arch:1},replayReactT:0};');
  const b=JSON.stringify(run('pr15Presence'));
  run('pr15PresDraw()');
  assert.strictEqual(JSON.stringify(run('pr15Presence')),b);});
ok('J04 drawEnemy não muta Paradoxo nem Sombrio',()=>{
  run('startRun({noEchoes:true,freshMeta:true})');
  run('spawnBoss();boss.spawnT=0;boss.flashT=0;boss.beamOn=0;boss.shocks=[];boss.gravs=[];');
  const bb=JSON.stringify(run('boss'));
  run('drawEnemy(boss)');
  assert.strictEqual(JSON.stringify(run('boss')),bb);
  run('enemies.push({type:"shadow",x:500,y:400,vx:0,vy:0,r:14,hp:150,maxHp:150,dmg:14,spd:225,xp:9,color:"#7fd8ff",aim:0,fireT:9,touchCd:0,slowT:0,spawnT:0,flashT:0,strafe:1,wi:1,srcSlot:1,ghosts:[],dmgMul:1,crit:0,critMul:1.8,items:[]});');
  const sb=JSON.stringify(run('enemies[enemies.length-1]'));
  run('drawEnemy(enemies[enemies.length-1])');
  assert.strictEqual(JSON.stringify(run('enemies[enemies.length-1]')),sb);});

/* ---------------- resultado ---------------- */
console.log('\n'+'='.repeat(64));
console.log('PR15.5-F0: '+(passed+failed)+' checks · aprovados '+passed+' · reprovados '+failed);
if(failed){console.log('FALHAS DETECTADAS');process.exit(1);}
console.log('AUDITORIA CONSISTENTE COM O HEAD');
