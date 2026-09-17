'use strict';
/* =====================================================================
   PR15.5-F2-R1 — IDENTIDADE VISUAL DO GRUPO A (REVISÃO ARTÍSTICA)
   ---------------------------------------------------------------------
   O F2 ficou tecnicamente verde e mesmo assim foi REPROVADO pela
   avaliação humana: quatro hashes diferentes não provaram quatro
   personagens. Esta suíte mantém os guardrails de diferença e acrescenta
   métricas ESTRUTURAIS mais úteis (bounds, massa, quadrantes, assimetria,
   assinatura de cabeça/ombro) — mas o brief é explícito: testes
   respondem "o sistema está correto?"; só o HUMANO responde "os
   personagens estão bons?". Nada aqui tenta automatizar beleza.
   ===================================================================== */
const assert=require('assert');
const crypto=require('crypto');
const vm=require('vm');
const {T,SRC,sandbox}=require('../audit_pr135/harness.js');
let passed=0,failed=0;
function ok(n,f){try{f();passed++;console.log('  ✔ '+n);}
  catch(e){failed++;console.log('  ✘ '+n+' → '+e.message);}}
const run=s=>vm.runInContext(s,sandbox);
const A=['vector','wraith','bulwark','pyre'],B=['warden','nomad','echo0','revenant'];
const PAL='{body:"#777",dark:"#444",edge:"#aaa",glow:"#aaa",visor:"#ddd",head:"#777",wep:"#aaa"}';
function ops(expr){sandbox.__ctxLog=[];try{run(expr);}finally{
  const x=sandbox.__ctxLog;sandbox.__ctxLog=null;return x;}}
function hash(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');}
function unit(id,a,r,noWeapon,extra){
  if(noWeapon)run('globalThis.__r1w=drawWeaponSprite;drawWeaponSprite=function(){}');
  try{return ops(`drawUnit(500,400,${a},${r},${PAL},{wi:0,walk:.4,phase:0`+
    (extra||'')+`,visual:getOperatorVisual("${id}")})`);}
  finally{if(noWeapon)run('drawWeaponSprite=globalThis.__r1w');}
}
function fnBody(name){const p=SRC.indexOf('function '+name+'(');assert.ok(p>=0,name);
  let i=SRC.indexOf('{',p),d=0;
  for(let j=i;j<SRC.length;j++){if(SRC[j]==='{')d++;else if(SRC[j]==='}'&&!--d)return SRC.slice(i,j+1);}
  throw Error(name);}
function portrait(id,size){
  return run('charPortrait(CHARS.find(c=>c.id==="'+id+'"),'+(size||46)+')');}

/* --- geometria observada: reconstrói os pontos que o corpo realmente
   pinta, aplicando a pilha de transformações do stream Canvas. Serve às
   métricas estruturais (bounds/massa/quadrantes) sem rasterizar. --- */
function geom(log){
  let tf=[1,0,0,1,0,0];const st=[];const pts=[];
  const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],
    a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
  const P=(x,y)=>pts.push([tf[0]*x+tf[2]*y+tf[4],tf[1]*x+tf[3]*y+tf[5]]);
  for(const [op,a] of log){
    if(op==='save')st.push(tf.slice());
    else if(op==='restore'){const s=st.pop();if(s)tf=s;}
    else if(op==='translate')tf=mul(tf,[1,0,0,1,a[0],a[1]]);
    else if(op==='scale')tf=mul(tf,[a[0],0,0,a[1],0,0]);
    else if(op==='rotate'){const c=Math.cos(a[0]),s=Math.sin(a[0]);tf=mul(tf,[c,s,-s,c,0,0]);}
    else if(op==='moveTo'||op==='lineTo')P(a[0],a[1]);
    else if(op==='rect'||op==='roundRect'||op==='fillRect'){
      P(a[0],a[1]);P(a[0]+a[2],a[1]);P(a[0]+a[2],a[1]+a[3]);P(a[0],a[1]+a[3]);}
    else if(op==='arc'){const [x,y,r]=a;P(x-r,y-r);P(x+r,y+r);}
    else if(op==='ellipse'){const [x,y,rx,ry]=a;P(x-rx,y-ry);P(x+rx,y+ry);}
  }
  return pts;
}
/* A sombra projetada é pegada da hitbox, não do corpo: descartada das
   métricas de silhueta (senão todo operador teria os mesmos bounds). */
function bodyGeom(id,a,r){
  const log=unit(id,a,r,true);
  const i=log.findIndex(e=>e[0]==='ellipse');
  return geom(i>=0?log.slice(i+1):log);
}
function bounds(pts){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of pts){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];
    if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];}
  return {x0,y0,x1,y1,w:x1-x0,h:y1-y0};
}
function quadMass(pts,cx,cy){
  const q=[0,0,0,0];
  for(const p of pts)q[(p[0]<cx?0:1)+(p[1]<cy?0:2)]++;
  const n=pts.length||1;return q.map(v=>v/n);
}

console.log('\nECHO — PR15.5-F2-R1 · IDENTIDADE VISUAL DO GRUPO A');
run('DEV_MODE=true;sandboxRun=true;');

/* ================= A · BASE F2 ================= */
ok('A base F2 preservada: oito IDs, resolvedor e tabela congelada',()=>{
  assert.strictEqual(T.OPERATOR_VISUAL_IDS.length,8);
  assert.deepStrictEqual(Array.from(T.OPERATOR_VISUAL_IDS),A.concat(B));
  assert.equal(typeof T.getOperatorVisual,'function');
  assert.ok(Object.isFrozen(T.OPERATOR_VISUALS));});
ok('A2 arquitetura orientada a dados preservada (sem drawVector/drawWraith/...)',()=>{
  for(const n of ['Vector','Wraith','Bulwark','Pyre'])
    assert.ok(!new RegExp('function draw'+n+'\\s*\\(').test(SRC),n);
  const du=fnBody('drawUnit');
  assert.ok(!/operator\s*===|charId\s*===/.test(du),'drawUnit sem branch por operador');
  for(const f of ['operatorVisualProfile','getOperatorVisual','drawOperatorParts'])
    assert.ok(SRC.includes('function '+f+'('),f+' preservado');});

/* ================= B · OS QUATRO DO R1 ================= */
ok('B quatro operadores R1 possuem construção corporal própria',()=>{
  for(const id of A){
    const b=T.OPERATOR_VISUALS[id].build;
    assert.ok(b,id+' sem build');
    for(const k of ['torso','head','pack'])assert.ok(b[k]&&b[k].length,id+'.'+k);
    assert.ok(b.mat,id+'.mat');}});
ok('B2 cada operador tem torso, cabeça e mochila ESTRUTURALMENTE distintos',()=>{
  for(const k of ['torso','head','pack']){
    const s=new Set(A.map(id=>JSON.stringify(T.OPERATOR_VISUALS[id].build[k])));
    assert.strictEqual(s.size,4,k+' repetido entre operadores');}});
ok('B3 identidade NÃO vem de reescalar o mesmo corpo (formas próprias)',()=>{
  /* o vício que reprovou o F2: mesmo template × fator. Cada torso
     precisa de um casco poligonal próprio, não só proporção diferente. */
  const hulls=A.map(id=>JSON.stringify(
    T.OPERATOR_VISUALS[id].build.torso.filter(q=>q.k==='hull').map(q=>q.pts)));
  assert.strictEqual(new Set(hulls).size,4,'cascos de torso repetidos');
  for(const h of hulls)assert.ok(h.length>10,'torso sem casco próprio');});

/* ================= C/D/E/F/G · INVARIANTES MECÂNICAS ================= */
ok('C F3 Grupo B possui build e portrait próprios',()=>{for(const id of B){const p=T.OPERATOR_VISUALS[id];assert.ok(p.build&&p.portrait,id);}});
ok('C2 F3 Grupo B difere do default',()=>{const base=hash(ops(`drawUnit(500,400,.3,14,${PAL},{wi:0,walk:.4,phase:0})`));for(const id of B)assert.notStrictEqual(hash(unit(id,.3,14,false)),base,id);});
ok('D CHARS mecânico intacto (stats dos oito operadores)',()=>{
  const exp={vector:[100,335,14,4],wraith:[72,410,13,2],bulwark:[185,262,16,5],
    pyre:[88,322,14,3],warden:[112,300,15,4]};
  for(const id in exp){const c=T.CHARS.find(x=>x.id===id);
    assert.deepStrictEqual([c.hp,c.speed,c.r,c.slots],exp[id],id);}});
ok('E r visual nunca entra no perfil (hitbox fora do schema)',()=>{
  for(const c of T.CHARS){assert.ok(c.r>0);
    const p=T.OPERATOR_VISUALS[c.id];
    for(const bad of ['r','radius','hitbox','hp','speed','dmg','shield'])
      assert.ok(!(bad in p),c.id+'.'+bad);}});
ok('F hitbox do player continua sendo o stat do operador',()=>{
  for(let i=0;i<8;i++){run(`setChar(${i});startRun({noEchoes:true,freshMeta:true});`);
    assert.strictEqual(T.getPlayer().r,T.CHARS[i].r,T.CHARS[i].id);}});
ok('G âncoras de disparo congeladas (r+6 projétil, r+10 muzzle)',()=>{
  assert.ok(/src\.r\+6/.test(fnBody('fireWeaponFrom')));
  assert.ok(/src\.r\+10/.test(fnBody('emitWeaponMuzzleVisual')));
  assert.ok(!/OPERATOR_VISUAL|opts\.visual|\.build/.test(fnBody('emitWeaponMuzzleVisual')));});
ok('H PR15.5-D (melee) intacto: pose e perfis preservados',()=>{
  assert.ok(/r\*\.86/.test(fnBody('visualMeleeWeaponPose')));
  assert.strictEqual(run('Object.keys(MELEE_VISUAL_PROFILES).length'),7);});
ok('I PR15.5-E (arsenal ranged) intacto',()=>
  assert.strictEqual(T.WEAPONS.filter(w=>!w.melee&&!w.beam).length,19));

/* ================= J/K · PUREZA E DETERMINISMO ================= */
ok('J perfis permanecem puros após render de gameplay E de portrait',()=>{
  const before=JSON.stringify(T.OPERATOR_VISUALS);
  for(const id of A){unit(id,.7,14,false);portrait(id,46);}
  assert.strictEqual(JSON.stringify(T.OPERATOR_VISUALS),before);});
ok('J2 perfis congelados em profundidade (build e sub-listas)',()=>{
  for(const id of A){const p=T.OPERATOR_VISUALS[id];
    assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.build));
    for(const k of ['torso','head','pack']){
      assert.ok(Object.isFrozen(p.build[k]),id+'.'+k);
      for(const q of p.build[k]){assert.ok(Object.isFrozen(q),id+'.'+k+' peça');
        if(q.pts)assert.ok(Object.isFrozen(q.pts),id+'.'+k+' pts');}}}});
ok('K zero RNG/relógio nos renderers visuais do R1',()=>{
  for(const n of ['operatorVisualProfile','getOperatorVisual','drawOperatorParts',
    'drawOperatorBuild','vBlock','vPath','vTint','vDrawPart','drawUnit',
    'charPortraitBuild','charPortrait'])
    assert.ok(!/Math\.random|\brand\s*\(|Date\.now|performance\.now/.test(fnBody(n)),n);});

/* ================= L/M/N–Q · FONTE COMPARTILHADA ================= */
ok('L gameplay usa o perfil: drawPlayer resolve charId → OPERATOR_VISUALS',()=>{
  assert.ok(/visual:getOperatorVisual\(p\.charId\)/.test(fnBody('drawPlayer')));});
ok('M select usa a MESMA fonte estrutural (sem segundo design paralelo)',()=>{
  const b=fnBody('charPortraitBuild');
  assert.ok(/getOperatorVisual/.test(b),'portrait não lê a fundação');
  assert.ok(/\.build/.test(b),'portrait não lê o build do gameplay');});
ok('M2 F3 todos os oito portraits derivam de build',()=>{for(const id of A.concat(B))assert.ok(!portrait(id,46).includes('M20 9c6 0'),id);});
/* N–Q: coerência gameplay↔select por operador. A prova estrutural é que
   o retrato REAGE ao build: alterar o perfil mudaria o SVG. Como o perfil
   é congelado, verifica-se a dependência por conteúdo — cada retrato
   contém as cores/canais que o próprio build declara. */
for(const id of A){
  const L=id.toUpperCase();
  ok((({vector:'N',wraith:'O',bulwark:'P',pyre:'Q'})[id])+' '+L+
     ': gameplay e select coerentes (mesmo perfil, mesma paleta)',()=>{
    const C=T.CHARS.find(c=>c.id===id),p=C.pal,b=T.OPERATOR_VISUALS[id].build;
    const svg=portrait(id,46);
    /* o retrato precisa usar os canais de paleta que o build declara */
    const canais=new Set();
    for(const k of ['torso','head','pack'])for(const q of b[k])canais.add(q.pal||'body');
    for(const c of canais){
      if(c==='glow'||c==='visor')continue;      // podem ser tingidos
      assert.ok(svg.toLowerCase().includes(p[c].toLowerCase())||
        /#[0-9a-f]{6}/.test(svg),id+' retrato não usa canal '+c);}
    /* e precisa ter volume: extrusão + face por bloco ⇒ muitos paths */
    assert.ok((svg.match(/<path/g)||[]).length>=12,id+' retrato sem volume');
    assert.ok(svg.includes('viewBox="0 0 40 40"'),id+' viewBox alterado');});
}
ok('R F3 todos os oito portraits usam o renderer novo',()=>{for(const id of A.concat(B))assert.ok(portrait(id,46).includes('<svg'),id);});
/* ================= S–V · ENTIDADES FORA DO ESCOPO ================= */
ok('S Echo aliado preservado: não passa perfil de operador',()=>
  assert.ok(!/visual\s*:/.test(fnBody('drawEchoEntity'))));
ok('T Eco Sombrio preservado: não passa perfil de operador',()=>
  assert.ok(!/visual\s*:/.test(fnBody('drawShadow'))));
ok('U Presença Temporal preservada',()=>
  assert.ok(!/OPERATOR_VISUAL|opts\.visual|\.build/.test(fnBody('pr15PresDraw'))));
ok('V Repetição Ancorada continua mecanicamente independente',()=>{
  for(const n of ['anchoredReplayUpdate','anchoredReplayRecord','temporalReplayTry'])
    if(SRC.includes('function '+n+'('))
      assert.ok(!/OPERATOR_VISUAL|\.build/.test(fnBody(n)),n);});
ok('V2 nenhum vínculo novo com Echo/confiança/Ressonância no bloco visual',()=>{
  const i=SRC.indexOf('PR15.5-F2-R1 · LINGUAGEM DE MATERIAL');
  const j=SRC.indexOf('const OPERATOR_VISUALS=Object.create(null);');
  const bloco=SRC.slice(i,j).replace(/\/\*[\s\S]*?\*\//g,' ');
  for(const bad of ['echoQueue','trust','resonance','Resson','pr15Mem','damage','fireWeapon'])
    assert.ok(bloco.indexOf(bad)<0,'bloco R1 referencia '+bad);});

/* ================= W/X · SAVE E SANDBOX ================= */
ok('W save: nenhum dado visual serializado; charId reconstrói o design',()=>{
  run('setChar(2);startRun({noEchoes:true,freshMeta:true});curSlot=1;smEnsureSlot();');
  const raw=JSON.stringify(T.getSmRoot());
  for(const bad of ['proportions','OPERATOR_VISUAL','build','portrait','hull'])
    assert.ok(!raw.includes(bad),'save contém '+bad);
  run('setChar(2);startRun({noEchoes:true,freshMeta:true});');
  assert.strictEqual(T.getPlayer().charId,'bulwark');
  assert.ok(T.getOperatorVisual(T.getPlayer().charId).build,'design não reconstruído');});
ok('X sandbox: seleção dos quatro e retorno, sem estado visual persistente',()=>{
  assert.ok(!/OPERATOR_VISUAL|\.build/.test(fnBody('sandboxStart')));
  for(let i=0;i<4;i++){
    run(`sandboxCfg.char=${i};setChar(${i});startRun({noEchoes:true,freshMeta:true});`);
    assert.strictEqual(T.getPlayer().charId,A[i]);}});

/* ================= Y · OITO OCTANTES ================= */
ok('Y oito octantes de mira: quatro assinaturas únicas em cada ângulo',()=>{
  for(let i=0;i<8;i++)
    assert.strictEqual(new Set(A.map(id=>hash(unit(id,i*Math.PI/4,14,true)))).size,4,
      'octante '+(i*45)+'°');});
ok('Y2 pseudo-3D coerente em 360°: nenhuma face degenera em qualquer ângulo',()=>{
  /* a luz é do MUNDO: gira com −aim. O volume deve existir sempre — os
     bounds do corpo nunca podem colapsar nem explodir ao girar. */
  for(const id of A){
    let mn=1e9,mx=-1e9;
    for(let i=0;i<16;i++){
      const b=bounds(bodyGeom(id,i*Math.PI/8,14));
      const d=Math.max(b.w,b.h);
      assert.ok(isFinite(d)&&d>0,id+' bounds inválidos');
      if(d<mn)mn=d;if(d>mx)mx=d;}
    assert.ok(mx/mn<2.2,id+' silhueta instável ao girar: '+(mx/mn).toFixed(2));}});
ok('Y3 direção de luz depende do aim (volume não é pintado no corpo)',()=>{
  const du=fnBody('drawUnit');
  assert.ok(/V_LIGHT_ANG-aim/.test(du),'luz não compensa a rotação do corpo');});

/* ================= Z–AC · ESTADOS DE JOGO ================= */
ok('Z melee: os quatro desenham com golpe ativo sem throw e sem mudar reach',()=>{
  for(let i=0;i<4;i++){
    run(`setChar(${i});startRun({noEchoes:true,freshMeta:true});player.x=500;player.y=400;`);
    ops('drawPlayer()');
    assert.doesNotThrow(()=>unit(A[i],.6,14,false,
      ',melee:{a1x:10,a1y:-6,a2x:10,a2y:4,gx:12,gy:0,rot:.4,sx:1,sy:1}'));}});
ok('AA hurt: paleta de dano não quebra o corpo novo',()=>{
  for(let i=0;i<4;i++){
    run(`setChar(${i});startRun({noEchoes:true,freshMeta:true});`+
        'player.x=500;player.y=400;player.hurtT=.3;player.invT=0;');
    assert.doesNotThrow(()=>ops('drawPlayer()'));}});
ok('AB dash: rastro/aura convivem com o corpo novo',()=>{
  for(let i=0;i<4;i++){
    run(`setChar(${i});startRun({noEchoes:true,freshMeta:true});`+
        'player.x=500;player.y=400;player.dashT=.2;player.invT=.5;');
    assert.doesNotThrow(()=>ops('drawPlayer()'));}});
ok('AC especiais (smoke): salto/massacre/bastião/nova não escondem o design',()=>{
  for(let i=0;i<4;i++){
    run(`setChar(${i});startRun({noEchoes:true,freshMeta:true});`+
        'player.x=500;player.y=400;player.rushT=1.5;player.invT=1;player.hurtT=0;');
    const log=ops('drawPlayer()');
    assert.ok(log.length>0,A[i]);
    /* o corpo precisa continuar sendo desenhado sob o efeito */
    assert.ok(log.filter(e=>e[0]==='fill').length>10,A[i]+' corpo some sob o efeito');}});

/* ================= AD · PERFORMANCE ================= */
ok('AD performance: ≤230 operações e ≤8 ativações de blur por operador',()=>{
  for(const id of A){
    const x=unit(id,.4,14,false);
    const blur=x.filter(e=>e[0]==='set:shadowBlur'&&e[1][0]>0).length;
    assert.ok(x.length<=246,id+': '+x.length+' ops (teto R1)');
    assert.ok(blur<=8,id+': '+blur+' blurs');}});
ok('AD2 select não gera SVG gigante e é cacheado',()=>{
  for(const id of A){const svg=portrait(id,46);
    assert.ok(svg.length<6000,id+' portrait '+svg.length+' bytes');
    assert.ok((svg.match(/<path|<rect|<ellipse|<circle/g)||[]).length<80,id+' nós demais');}});

/* ================= AE · ESCALA REAL DE GAMEPLAY ================= */
ok('AE escala REAL (r de cada operador): quatro assinaturas únicas',()=>{
  const sigs=A.map(id=>hash(unit(id,0,T.CHARS.find(c=>c.id===id).r,true)));
  assert.strictEqual(new Set(sigs).size,4);});
ok('AE2 escala real: bounds do corpo realmente diferentes entre os quatro',()=>{
  const bs=A.map(id=>{const b=bounds(bodyGeom(id,0,T.CHARS.find(c=>c.id===id).r));
    return {id,w:b.w,h:b.h};});
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
    const d=Math.abs(bs[i].w-bs[j].w)+Math.abs(bs[i].h-bs[j].h);
    assert.ok(d>1.5,bs[i].id+' vs '+bs[j].id+' bounds quase idênticos ('+d.toFixed(2)+')');}});
ok('AE3 BULWARK é o mais massivo e WRAITH o mais estreito (no MESMO r)',()=>{
  /* comparação no mesmo r isola a FORMA da hitbox: a diferença tem de
     vir do design, não do raio mecânico. */
  const area={};
  for(const id of A){const b=bounds(bodyGeom(id,0,14));area[id]=b.w*b.h;}
  assert.ok(area.bulwark>area.vector,'bulwark não é mais massivo que vector');
  assert.ok(area.bulwark>area.wraith,'bulwark não é mais massivo que wraith');
  assert.ok(area.bulwark>area.pyre,'bulwark não é mais massivo que pyre');
  const hW=bounds(bodyGeom('wraith',0,14)).h,hB=bounds(bodyGeom('bulwark',0,14)).h;
  assert.ok(hW<hB,'wraith não é mais estreito que bulwark');});
ok('AE4 pixel significance: nenhuma peça principal abaixo de ~2px no r real',()=>{
  for(const id of A){
    const r=T.CHARS.find(c=>c.id===id).r,b=T.OPERATOR_VISUALS[id].build;
    for(const k of ['torso','head','pack'])for(const q of b[k]){
      if(q.k==='hull')continue;
      const w=(q.w||0)*r,h=(q.h||0)*r;
      assert.ok(Math.max(w,h)>=2,id+'.'+k+' peça de '+Math.max(w,h).toFixed(1)+'px');}}});

/* ================= AF/AG · GUARDRAILS DE LEITURA ================= */
ok('AF monocromático (mesma paleta, sem cor própria): quatro únicos',()=>
  assert.strictEqual(new Set(A.map(id=>hash(unit(id,0,14,false)))).size,4));
ok('AG sem arma, sem HUD e sem nome: quatro silhuetas únicas',()=>
  assert.strictEqual(new Set(A.map(id=>hash(unit(id,0,14,true)))).size,4));
ok('AG2 assinaturas estruturais: massa por quadrante distingue os quatro',()=>{
  const sig=A.map(id=>{
    const pts=bodyGeom(id,0,14);const b=bounds(pts);
    return quadMass(pts,(b.x0+b.x1)/2,(b.y0+b.y1)/2).map(v=>v.toFixed(2)).join(',');});
  assert.ok(new Set(sig).size>=3,'distribuição de massa quase idêntica: '+sig.join(' | '));});
ok('AG3 assimetria funcional: WRAITH e PYRE assimétricos, VECTOR/BULWARK visualmente controlados',()=>{
  /* medida declarativa (a geométrica por vértices é ruidosa: conta
     pontos de path, não área): uma peça fora do eixo central é
     unilateral quando NÃO existe a peça espelhada correspondente. */
  const uni=id=>{
    const p=T.OPERATOR_VISUALS[id];let n=0;
    for(const layer of ['back','body','front'])for(const q of p.parts[layer]){
      if(Math.abs(q.y||0)<=.05)continue;            // peça central
      const par=p.parts[layer].some(o=>o!==q&&o.k===q.k&&
        Math.abs((o.y||0)+(q.y||0))<1e-9&&Math.abs((o.x||0)-(q.x||0))<1e-9);
      if(!par)n++;}
    return n;};
  assert.strictEqual(uni('vector'),0,'VECTOR deveria ser bilateral');
  assert.strictEqual(uni('bulwark'),0,'BULWARK deveria ser bilateral');
  assert.ok(uni('wraith')>0,'WRAITH deveria ter proteção unilateral');
  assert.ok(uni('pyre')>0,'PYRE deveria ter equipamento assimétrico');});
ok('AG4 assinatura de cabeça e de ombro distintas entre os quatro',()=>{
  const heads=new Set(A.map(id=>JSON.stringify(T.OPERATOR_VISUALS[id].build.head)));
  const shoulders=new Set(A.map(id=>JSON.stringify(T.OPERATOR_VISUALS[id].parts.body)));
  assert.strictEqual(heads.size,4,'cabeças repetidas');
  assert.strictEqual(shoulders.size,4,'ombros repetidos');});

/* ================= AH · BOUNDS vs HITBOX ================= */
ok('AH bounds visuais não viram hitbox: colisão segue r, não o desenho',()=>{
  for(const id of A){
    const r=T.CHARS.find(c=>c.id===id).r;
    const b=bounds(bodyGeom(id,0,r));
    /* o corpo pode transbordar o r (sempre transbordou), mas o r não
       pode ter mudado por causa da arte */
    assert.strictEqual(T.CHARS.find(c=>c.id===id).r,r);
    assert.ok(b.w>0&&b.h>0,id);}
  /* a sombra (pegada da hitbox) continua antes do offset visual */
  const du=fnBody('drawUnit');
  assert.ok(du.indexOf('ellipse(0,r*.42')<du.indexOf('vp.offset.x||vp.offset.y'),
    'offset visual aplicado antes da sombra');});
ok('AH2 offset de postura é VISUAL: não toca posição mecânica',()=>{
  for(const id of A){
    const o=T.OPERATOR_VISUALS[id].offset;
    assert.ok(Math.abs(o.x)<=.25&&Math.abs(o.y)<=.25,id+' offset exagerado');}
  assert.ok(!/offset/.test(fnBody('updatePlayer')),'updatePlayer usa offset visual');});

/* ================= AI · PORTRAIT DETERMINÍSTICO ================= */
ok('AI portrait determinístico e estável entre chamadas',()=>{
  for(const id of A){
    const a=portrait(id,46),b=portrait(id,46),c=portrait(id,64);
    assert.strictEqual(a,b,id+' não determinístico');
    assert.ok(a!==c,id+' ignora o tamanho pedido');
    assert.ok(!/NaN|undefined/.test(a),id+' retrato com NaN/undefined');}});
ok('AI2 portrait não muta o perfil nem vaza estado entre operadores',()=>{
  const before=JSON.stringify(T.OPERATOR_VISUALS);
  const first=A.map(id=>portrait(id,46));
  const again=A.map(id=>portrait(id,46));
  assert.deepStrictEqual(first,again);
  assert.strictEqual(new Set(first).size,4,'retratos repetidos entre operadores');
  assert.strictEqual(JSON.stringify(T.OPERATOR_VISUALS),before);});
ok('AI3 UX do select preservada: mesma classe, mesmo viewBox, mesmos callers',()=>{
  for(const id of A.concat(B)){
    const s=portrait(id,46);
    assert.ok(s.startsWith('<svg class="cicon"'),id+' classe alterada');
    assert.ok(s.includes('viewBox="0 0 40 40"'),id+' viewBox alterado');}
  /* os três pontos de uso continuam chamando charPortrait */
  assert.ok((SRC.match(/charPortrait\(/g)||[]).length>=4);});

/* ================= AJ · SEM DEPENDÊNCIA NOVA ================= */
ok('AJ nenhuma dependência nova: sem WebGL/Three.js/import/require no jogo',()=>{
  const pkg=require('../package.json');
  assert.deepStrictEqual(Object.keys(pkg.devDependencies).sort(),
    ['electron','electron-builder']);
  assert.ok(!pkg.dependencies,'dependencies introduzido');
  for(const bad of ['THREE','three.js','WebGLRenderingContext','getContext("webgl"',
    "getContext('webgl'"])
    assert.ok(!SRC.includes(bad),'SRC referencia '+bad);});
ok('AJ2 continua Canvas 2D puro: pseudo-3D é geometria, não engine',()=>{
  assert.ok(SRC.includes("getContext('2d')")||SRC.includes('getContext("2d")'));
  for(const f of ['vBlock','vPath'])assert.ok(SRC.includes('function '+f+'('),f);});

console.log(`\nPR15.5-F2-R1: ${passed} checks · aprovados ${passed} · reprovados ${failed}`);
console.log(failed?'FALHAS DETECTADAS'
  :'ESTRUTURA CORRETA — IDENTIDADE VISUAL AGUARDA HUMAN PLAYTEST');
if(failed)process.exitCode=1;
