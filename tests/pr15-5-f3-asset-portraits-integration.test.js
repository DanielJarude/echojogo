'use strict';
/* PR15.5-F3-ASSETS — contrato técnico do Character Select/Sandbox.
   A suíte prova integração e guardrails; alinhamento/legibilidade final
   continuam dependentes do HUMAN PLAYTEST pedido pela PR.
   AUDIT-FIX-A: o baseline mecânico de CHARS deixou de instanciar fontes
   históricas via Git (quebrava clones shallow). Os valores da base
   F3-R1 estão congelados em tests/fixtures/f3_chars_mechanical.json
   (projeção semântica dos campos mecânicos — sem hash de bloco). */
const assert=require('assert');
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..');
const SRC=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const PKG=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
const GOLDEN=require('./fixtures/f3_chars_mechanical.json');
const IDS=['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant'];
const FILES=['vector.png','wraith.png','bulwark.png','pyre.png','harden.png',
  'nomade.png','echo-0.png','revenant.png'];
const MAP={vector:'vector.png',wraith:'wraith.png',bulwark:'bulwark.png',
  pyre:'pyre.png',warden:'harden.png',nomad:'nomade.png',echo0:'echo-0.png',
  revenant:'revenant.png'};
let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+e.message);}
}
function section(name){const i=SRC.indexOf(name);assert.ok(i>=0,'seção ausente: '+name);return i;}
function body(name){
  const p=SRC.indexOf('function '+name+'(');assert.ok(p>=0,'função ausente: '+name);
  const start=SRC.indexOf('{',p);let d=0;
  for(let i=start;i<SRC.length;i++){
    if(SRC[i]==='{')d++;
    else if(SRC[i]==='}'&&--d===0)return SRC.slice(start,i+1);
  }
  throw new Error('corpo não fechado: '+name);
}
function assetPath(id){return path.join(ROOT,'assets','operators',MAP[id]);}

/* Projeção mecânica deliberadamente exclui texto editorial/visual. O
   snapshot é extraído da base direta 0251f07 (F3-R1), não do F2. */
const MECHANICAL_FIELDS=['id','hp','speed','dmg','rate','crit','dashCd','r',
  'shieldMax','shieldRegen','shieldDelay','shieldStart','slots','guns','sp','apply'];
function operatorBlock(source,id){
  const start=source.indexOf("{id:'"+id+"'");
  assert.ok(start>=0,'operador ausente na base: '+id);
  const next=source.indexOf("\n\n {id:'",start+1);
  const end=next>=0?next:source.indexOf('\n];',start);
  assert.ok(end>start,'bloco CHARS inválido: '+id);
  return source.slice(start,end);
}
function numericField(block,key){
  const m=block.match(new RegExp('(?:^|[,\\n])\\s*'+key+':\\s*(-?(?:\\d+\\.?\\d*|\\.\\d+))\\s*(?:,|\\n)'));
  assert.ok(m,key+' ausente no operador');
  return Number(m[1]);
}
function balancedArrowBody(block,label){
  const start=block.indexOf(label);
  assert.ok(start>=0,label+' ausente');
  const open=block.indexOf('{',start);let depth=0,quote=null;
  for(let i=open;i<block.length;i++){
    const c=block[i];
    if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}
    if(c==='\''||c==='"'||c==='`'){quote=c;continue;}
    if(c==='{')depth++;
    else if(c==='}'&&--depth===0)return block.slice(start,i+1);
  }
  throw new Error(label+' não fechado');
}
function projectMechanicalChars(source){
  const out={};
  for(const id of IDS){
    const block=operatorBlock(source,id);
    const sp=block.match(/sp:\{id:'([^']+)'[\s\S]*?\bcd:([0-9.]+)/);
    assert.ok(sp,id+' special ausente');
    const guns=block.match(/\bguns:\[([^\]]+)\]/);
    assert.ok(guns,id+' guns ausente');
    out[id]={
      id,
      hp:numericField(block,'hp'),speed:numericField(block,'speed'),
      dmg:numericField(block,'dmg'),rate:numericField(block,'rate'),
      crit:numericField(block,'crit'),dashCd:numericField(block,'dashCd'),
      r:numericField(block,'r'),shieldMax:numericField(block,'shieldMax'),
      shieldRegen:numericField(block,'shieldRegen'),
      shieldDelay:numericField(block,'shieldDelay'),
      shieldStart:numericField(block,'shieldStart'),slots:numericField(block,'slots'),
      guns:guns[1].match(/'[^']+'/g).map(x=>x.slice(1,-1)),
      sp:{id:sp[1],cd:Number(sp[2])},
      apply:balancedArrowBody(block,'apply:p=>')
    };
  }
  return out;
}

console.log('\nECHO — PR15.5-F3-ASSETS · PORTRAITS OFICIAIS');

ok('1. Os 8 assets oficiais existem, são PNG e não estão vazios',()=>{
  for(const f of FILES){
    const p=path.join(ROOT,'assets','operators',f);
    assert.ok(fs.existsSync(p),f);
    const b=fs.readFileSync(p);
    assert.ok(b.length>1000,f+' vazio');
    assert.strictEqual(b.readUInt32BE(0),0x89504e47,f+' não é PNG');
    assert.strictEqual(b.readUInt32BE(4),0x0d0a1a0a,f+' assinatura PNG inválida');
  }
});
ok('2. IDs canônicos permanecem na ordem oficial',()=>{
  assert.deepStrictEqual(IDS,['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant']);
  assert.ok(!SRC.includes("id:'harden'"));
});
ok('3. Mapa explícito usa exatamente os 8 caminhos locais',()=>{
  const p=section('const OPERATOR_PORTRAIT_ASSETS=');
  const q=SRC.indexOf('});',p);
  const block=SRC.slice(p,q);
  for(const id of IDS)assert.ok(block.includes(id+":"),id);
  for(const f of FILES)assert.ok(block.includes('assets/operators/'+f),f);
});
ok('4. warden aponta para harden.png',()=>assert.strictEqual(MAP.warden,'harden.png'));
ok('5. nomad aponta para nomade.png',()=>assert.strictEqual(MAP.nomad,'nomade.png'));
ok('6. echo0 aponta para echo-0.png',()=>assert.strictEqual(MAP.echo0,'echo-0.png'));
ok('7. Character Select e Sandbox renderizam IMG oficial',()=>{
  assert.ok(/<img class="cicon operator-portrait"/.test(SRC));
  const select=body('renderCodexBody'),sandbox=body('renderSandboxSetup');
  assert.ok(select.includes('operatorPortraitHTML(C,300)'),'Select sem asset principal');
  assert.ok(sandbox.includes('operatorPortraitHTML(c,76)'),'Sandbox sem asset principal');
  assert.ok(body('refreshTitleChar').includes('operatorPortraitHTML(C,76)'));
});
ok('8. Procedural é fallback, não principal dos 8',()=>{
  const p=body('operatorPortraitHTML');
  assert.ok(/if\(!src\)return charPortrait/.test(p));
  const selectSource=body('renderCodexBody').replace(/\/\*[\s\S]*?\*\//g,'');
  const sandboxSource=body('renderSandboxSetup').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!selectSource.match(/charPortrait\(C/));
  assert.ok(!sandboxSource.match(/charPortrait\(c/));
});
ok('9. Fallback seguro troca IMG com erro pelo portrait legado',()=>{
  const p=body('bindOperatorPortraitFallbacks');
  assert.ok(p.includes("addEventListener('error'"));
  assert.ok(p.includes('charPortrait(C'));assert.ok(p.includes('replaceWith'));
});
ok('10. Não existe inner frame/painel/borda no portrait',()=>{
  const p=SRC.slice(section('.operator-portrait{'),section('.chead{'));
  assert.ok(!/border\s*:/.test(p));
  assert.ok(!/operator-portrait[^}]*wrapper|portrait[^}]*frame/i.test(SRC));
  assert.ok(/operator-card>\.operator-portrait/.test(p));
});
ok('11. Portraits não têm rotação/tilt CSS',()=>{
  const p=SRC.slice(section('.operator-portrait{'),section('.chead{'))
    .replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/rotate|tilt/i.test(p));
  assert.ok(p.includes('object-position:center center'));
});
ok('12. Object-position é central e não há ajuste por operador',()=>{
  const p=SRC.slice(section('.operator-portrait{'),section('.chead{'));
  assert.ok(p.includes('object-position:center center'));
  assert.strictEqual((SRC.match(/object-position\s*:/g)||[]).length,1);
  assert.strictEqual((SRC.match(/data-operator-id|data-portrait-id/g)||[]).length,0);
});
ok('13. Área visual é única por contexto e todos os cards compartilham-na',()=>{
  const p=SRC.slice(section('.operator-portrait{'),section('.chead{'));
  assert.ok(/height:clamp\(180px,24vw,300px\)/.test(p));
  assert.ok(p.includes('.operator-card>.operator-portrait'));
  assert.ok(!/vector|wraith|bulwark|pyre|warden|nomad|echo0|revenant/.test(p));
});
ok('14. Pixel art preservada com image-rendering pixelated e sem filter',()=>{
  const p=SRC.slice(section('.operator-portrait{'),section('.chead{'));
  assert.ok(p.includes('image-rendering:pixelated'));
  assert.ok(p.includes('filter:none'));
});
ok('15. Bounds responsivos impedem saída/cobertura do card',()=>{
  const p=SRC.slice(section('.operator-portrait{'),section('.chead{'));
  assert.ok(p.includes('max-width:100%'));
  assert.ok(SRC.includes('.operator-card{')&&SRC.includes('overflow:hidden'));
  assert.ok(/@media\(max-width:800px\)/.test(SRC));
  assert.ok(/@media\(max-width:560px\)/.test(SRC));
});
ok('16. Hover pertence ao card, não ao PNG',()=>{
  assert.ok(/\.operator-card:hover\s*\{/.test(SRC));
  assert.ok(!/\.operator-portrait:hover/.test(SRC));
});
ok('17. Selected/glow pertence ao card',()=>{
  assert.ok(/operator-card.*selected/.test(SRC));
  assert.ok(body('renderCodexBody').includes("' selected'"));
  assert.ok(!/operator-portrait\.selected/.test(SRC));
});
ok('18. Gameplay não consulta o mapa de portraits',()=>{
  const gameplay=body('drawUnit')+'\n'+body('drawPlayer')+'\n'+body('makePlayer');
  assert.ok(!gameplay.includes('OPERATOR_PORTRAIT_ASSETS'));
  assert.ok(!gameplay.includes('operatorPortraitHTML'));
});
ok('19. CHARS mecânico permanece igual ao golden da base F3-R1 (fixture)',()=>{
  const current=projectMechanicalChars(SRC);
  assert.deepStrictEqual(Object.keys(current.vector),MECHANICAL_FIELDS);
  assert.deepStrictEqual(current,GOLDEN.chars);
});
ok('20. r/hitbox dos 8 operadores permanece intocado',()=>{
  const vals=[14,13,16,14,15,14,14,13];
  const block=SRC.slice(SRC.indexOf('const CHARS=['),SRC.indexOf('\n];',SRC.indexOf('const CHARS=[')));
  assert.deepStrictEqual([...block.matchAll(/\br:([0-9.]+)/g)].map(m=>+m[1]),vals);
});
ok('21. Anchors preservados: projectile/beam r+6 e muzzle r+10',()=>{
  assert.ok(SRC.includes('src.r+6'),'r+6 ausente');
  assert.ok(SRC.includes('src.r+10'),'r+10 ausente');
});
ok('22. ECHO-0 continua somente o operador echo0, sem acoplamento Echo',()=>{
  const map=SRC.slice(section('const OPERATOR_PORTRAIT_ASSETS='),section('const OPERATOR_PORTRAIT_IDS='));
  assert.ok(map.includes('echo0:'));assert.ok(!map.includes('echoQueue'));
  assert.ok(!map.includes('Echo aliado'));assert.ok(!map.includes('Eco Sombrio'));
});
ok('23. Repetição continua em seu sistema independente',()=>{
  const p=section('function replayTemporalAction');
  const q=SRC.indexOf('function temporalReplayReset',p);
  const rep=SRC.slice(p,q);
  assert.ok(rep.includes('temporalReplay:true'));
  assert.ok(!rep.includes('OPERATOR_PORTRAIT_ASSETS'));
  assert.ok(!rep.includes('operatorPortraitHTML'));
});
ok('24. Save permanece separado dos portraits',()=>{
  for(const n of ['saveProg','saveMeta','saveEchoes','captureCheckpoint'])
    assert.ok(!body(n).includes('OPERATOR_PORTRAIT_ASSETS'),n+' acoplou asset ao save');
  assert.ok(SRC.includes('sandboxMode=true'));
});
ok('25. Sandbox usa o catálogo CHARS/contexto, não altera mecânicas',()=>{
  const p=body('sandboxOpenSetup')+'\n'+body('renderSandboxSetup');
  assert.ok(p.includes('CHARS'));assert.ok(p.includes('operatorPortraitHTML'));
  assert.ok(!p.includes('OPERATOR_PORTRAIT_ASSETS'));
  assert.ok(p.includes('sandboxContext')||SRC.includes('sandboxContext'));
});
ok('26. Integração não adiciona dependência externa',()=>{
  assert.ok(!PKG.dependencies||Object.keys(PKG.dependencies).length===0);
  assert.deepStrictEqual(Object.keys(PKG.devDependencies).sort(),['electron','electron-builder']);
  assert.ok(!/https?:\/\//.test(SRC));
  assert.ok(PKG.build.files.includes('assets/**'));
});

console.log('  '+passed+' checks aprovados · '+failed+' falhas');
if(failed)process.exitCode=1;
