'use strict';
/* =====================================================================
   AUDIT-FIX-A — SHALLOW CLONE SAFETY
   ---------------------------------------------------------------------
   Contrato: a suíte do npm test NÃO depende do histórico Git da máquina.

   Contexto (P1-01 da auditoria geral de código): quatro suítes
   instanciavam fontes históricas via leitura de objetos Git antigos
   ("commit:arquivo"). Em clone shallow ou CI sem esses objetos, o npm
   test produzia 17 falsas falhas + 3 suítes em erro. Os baselines
   históricos necessários agora vivem congelados em tests/fixtures/*.json
   (golden data — projeções semânticas ou hashes), padrão que a suíte
   de metrics-overlay já usava.

   Esta suíte protege o contrato estruturalmente:
   · nenhuma suíte invoca o git;
   · nenhuma suíte referencia leitura de histórico via texto;
   · nenhum SHA de 40 hexits (formato de objeto Git) aparece em tests/;
   · o helper readSource do benchmark (que aceita um ref opcional para
     uso manual de dev) nunca é chamado COM ref por suítes;
   · as fixtures de golden existem, parseiam e têm o conteúdo mínimo.
   ===================================================================== */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const reg=require('./suite-registry.js');
let passed=0,failed=0;
function ok(label,fn){try{fn();passed++;console.log('  ✔ '+label);}catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}}

const DIR=__dirname;
const files=fs.readdirSync(DIR).filter(f=>/\.test\.js$/.test(f)).sort();

/* padrões de INVOCAÇÃO real do git (exec/spawn) */
const GIT_INVOKE=/(execFileSync|execSync|spawnSync)\(\s*['"]git['"]|['"]git['"]\s*,\s*\[\s*['"]show['"]/;
/* menção textual a leitura de histórico (inclui comentários) */
const GIT_SHOW_TEXT=/git\s+show\b/i;
/* SHA-1 de objeto Git (exatamente 40 hexits, com fronteiras de palavra) */
const SHA40=/\b[0-9a-f]{40}\b/;
/* readSource chamado com qualquer argumento (o uso sem ref é legítimo) */
const READSOURCE_WITH_REF=/readSource\(\s*(?!\))/;

console.log('\nECHO — AUDIT-FIX-A · SHALLOW CLONE SAFETY (npm test sem histórico Git)');

ok('S01 suítes descobertas: '+files.length+' arquivos .test.js em tests/',()=>{
  assert.ok(files.length>=78,'esperado ao menos 78 suítes, encontrado '+files.length);
  assert.ok(files.includes('shallow-clone-safety.test.js'));
});

ok('S02 nenhuma suíte invoca o git',()=>{
  for(const f of files){
    const t=fs.readFileSync(path.join(DIR,f),'utf8');
    assert.ok(!GIT_INVOKE.test(t),f+' invoca o git');
  }
});

ok('S03 nenhuma suíte referencia leitura de histórico Git (nem em comentários)',()=>{
  for(const f of files){
    const t=fs.readFileSync(path.join(DIR,f),'utf8');
    assert.ok(!GIT_SHOW_TEXT.test(t),f+' menciona leitura de histórico Git');
  }
});

ok('S04 nenhum SHA de objeto Git (40 hexits) literal em suítes',()=>{
  for(const f of files){
    const t=fs.readFileSync(path.join(DIR,f),'utf8');
    const m=t.match(SHA40);
    if(m)throw new Error(f+' contém SHA literal: '+m[0]);
  }
});

ok('S05 readSource nunca é chamado com ref por suítes (clone shallow safe)',()=>{
  for(const f of files){
    const t=fs.readFileSync(path.join(DIR,f),'utf8');
    assert.ok(!READSOURCE_WITH_REF.test(t),f+' chama readSource com argumento');
  }
});

ok('S06 fixtures de golden existem, parseiam e têm o conteúdo mínimo',()=>{
  const FX=path.join(DIR,'fixtures');
  const load=n=>JSON.parse(fs.readFileSync(path.join(FX,n),'utf8'));
  const f3=load('f3_chars_mechanical.json');
  assert.strictEqual(Object.keys(f3.chars).length,8,'F3: 8 operadores');
  assert.deepStrictEqual(Object.keys(f3.chars),
    ['vector','wraith','bulwark','pyre','warden','nomad','echo0','revenant']);
  for(const id of Object.keys(f3.chars))
    for(const k of ['id','hp','speed','dmg','rate','crit','dashCd','r','shieldMax',
      'shieldRegen','shieldDelay','shieldStart','slots','guns','sp','apply'])
      assert.ok(k in f3.chars[id],'F3 '+id+'.'+k);
  const hd=load('pr15_5_c_hurt_death_mechanical.json');
  assert.strictEqual(hd.waveComp.length,20,'HD: 20 ondas');
  assert.strictEqual(hd.weapons.length,27,'HD: 27 armas');
  for(const k of ['miniboss','e14_credit','e15_parts','h01_idle_hash','i06_state',
    'i07_crit','i08_knockback','i09_phantom','i10_singular','i14_sin_count',
    'j05_boss','j07_splitter'])
    assert.ok(k in hd,'HD '+k);
  assert.match(hd.h01_idle_hash,/^[0-9a-f]{64}$/);
  const e9=load('pr15_5_e9_mechanical.json');
  assert.strictEqual(Object.keys(e9.mech).length,19,'E9: 19 armas ranged');
  for(const id of Object.keys(e9.mech)){
    assert.ok(e9.mech[id].player,'E9 '+id+'.player');
    assert.ok(Array.isArray(e9.mech[id].enemies),'E9 '+id+'.enemies');
    assert.strictEqual(typeof e9.mech[id].projectilesCount,'number','E9 '+id+'.count');
  }
  const f1=load('pr15_5_f1_canvas_hashes.json');
  assert.strictEqual(Object.keys(f1.drawUnit).length,12,'F1: 12 cenários drawUnit');
  assert.strictEqual(Object.keys(f1.echo).length,4,'F1: 4 cenários echo');
  assert.match(f1.shadow,/^[0-9a-f]{64}$/);
  assert.match(f1.presence,/^[0-9a-f]{64}$/);
  assert.strictEqual(Object.keys(f1.ship).length,2,'F1: 2 cenários ship');
  assert.ok(Array.isArray(f1.echoCounts)&&f1.echoCounts.length===2);
});

ok('S07 esta suíte é descoberta pelo runner do npm test',()=>{
  assert.ok(reg.runnerInstalled());
  assert.ok(reg.suiteIsDiscovered('shallow-clone-safety'));
});

ok('S08 as 4 suítes antes dependentes de histórico continuam no runner',()=>{
  for(const s of ['pr15-5-c-hurt-death','pr15-5-e9-impact-visual-grammar',
    'pr15-5-f1-operator-visual-foundation','pr15-5-f3-asset-portraits-integration'])
    assert.ok(reg.suiteIsDiscovered(s),s+' fora do runner');
});

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
if(failed)process.exit(1);
