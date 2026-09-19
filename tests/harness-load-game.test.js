'use strict';
/* =====================================================================
   TESTES — AUDIT-FIX-E2-a · HARNESS COMPARTILHADO DE CARREGAMENTO
   ---------------------------------------------------------------------
   Contrato de `tests/harness/load-game.js`: ele é o ÚNICO lugar do
   repositório que sabe COMO o código do jogo está empacotado dentro de
   index.html. Antes do E2-a essa suposição estava copiada em 32 suítes
   (regex de `<script>`) e em mais 7 que reliam o arquivo por conta
   própria — bastava mover um trecho para um módulo externo (AUDIT-FIX-F)
   para quebrar dezenas de suítes de uma vez.

   Os testes abaixo travam esse contrato:
     · o harness devolve exatamente o JavaScript que index.html carrega;
     · a extração funciona sobre um HTML arbitrário (inline e `src=`),
       que é o que permitirá a modularização do F;
     · nenhuma suíte volta a extrair `<script>` ou a ler index.html;
     · nenhuma suíte depende do diretório de trabalho;
     · o acoplamento textual de `audit_pr155/performance_benchmark.js`
       com `audit_pr135/harness.js` continua válido.
   ===================================================================== */
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const H=require('./harness/load-game');

let passed=0,failed=0;
function ok(label,fn){
  try{fn();passed++;console.log('  ✔ '+label);}
  catch(e){failed++;console.log('  ✘ '+label+' → '+(e&&e.message||e));}
}

console.log('\nECHO — AUDIT-FIX-E2-a · harness de carregamento do jogo');
console.log('------------------------------------------------------');

/* ---------------- 1. contrato do módulo ---------------- */
ok('E2A-01 API mínima e explícita (sem virar framework)',()=>{
  assert.deepStrictEqual(Object.keys(H).sort(),
    ['GAME_HTML_PATH','ROOT','SOURCE_LABEL','extractGameSource',
     'readGameHtml','readGameSource','runGameSource'].sort());
  assert.strictEqual(H.GAME_HTML_PATH,path.join(H.ROOT,'index.html'));
  assert.ok(fs.existsSync(H.GAME_HTML_PATH));
});

ok('E2A-02 readGameHtml devolve index.html normalizado para LF',()=>{
  const html=H.readGameHtml();
  assert.ok(html.length>1e6,'HTML curto demais: '+html.length);
  assert.ok(!/\r/.test(html),'sobrou CR no HTML normalizado');
  assert.strictEqual(html,fs.readFileSync(H.GAME_HTML_PATH,'utf8').replace(/\r\n?/g,'\n'));
});

ok('E2A-03 readGameSource devolve o JS que index.html realmente carrega',()=>{
  const src=H.readGameSource();
  const html=H.readGameHtml();
  assert.ok(html.indexOf(src.replace(/\n$/,''))>0,'a fonte não está dentro do HTML');
  assert.ok(src.length>1e6,'fonte curta demais: '+src.length);
  assert.ok(/\n$/.test(src),'a fonte precisa terminar em \\n (append de exports seguro)');
});

ok('E2A-04 a fonte é executável e o bridge de exports pode ser concatenado',()=>{
  new vm.Script(H.readGameSource());               // SyntaxError se inválida
  new vm.Script(H.readGameSource()+';globalThis.__t={};');
});

/* ---------------- 2. preparo para o AUDIT-FIX-F ---------------- */
ok('E2A-05 extractGameSource concatena vários <script> na ordem do documento',()=>{
  const out=H.extractGameSource('<html><script>var a=1;</script><p>x</p><script>var b=2;</script></html>');
  assert.ok(out.indexOf('var a=1;')<out.indexOf('var b=2;'));
  assert.ok(/\n$/.test(out));
  new vm.Script(out);
});

ok('E2A-06 extractGameSource resolve <script src="..."> relativo a index.html',()=>{
  const mod=path.join(H.ROOT,'__e2a_probe_module.js');
  fs.writeFileSync(mod,'var fromModule=7;\n');
  try{
    const out=H.extractGameSource('<script src="__e2a_probe_module.js"></script><script>var inline=1;</script>');
    assert.ok(out.indexOf('var fromModule=7;')>=0,'módulo externo não foi carregado');
    assert.ok(out.indexOf('var fromModule=7;')<out.indexOf('var inline=1;'));
  }finally{fs.unlinkSync(mod);}
});

ok('E2A-07 módulo declarado e ausente falha alto (não silencioso)',()=>{
  assert.throws(()=>H.extractGameSource('<script src="__nao_existe_e2a.js"></script>'),
    /não encontrado/);
});

ok('E2A-08 HTML sem script algum falha alto',()=>{
  assert.throws(()=>H.extractGameSource('<html><body>sem script</body></html>'),
    /script não encontrado/);
});

/* ---------------- 3. isolamento ---------------- */
ok('E2A-09 o cache devolve strings idênticas e não vaza estado mutável',()=>{
  assert.strictEqual(H.readGameHtml(),H.readGameHtml());
  assert.strictEqual(H.readGameSource(),H.readGameSource());
  const antes=H.readGameSource();
  let copia=antes; copia+=';globalThis.__t={};';   // strings são imutáveis
  assert.strictEqual(H.readGameSource(),antes);
});

ok('E2A-10 runGameSource rotula os stack traces como index.html',()=>{
  const ctx=vm.createContext({});
  H.runGameSource('globalThis.__probe=1;',ctx);
  assert.strictEqual(vm.runInContext('__probe',ctx),1);
  try{
    H.runGameSource('throw new Error("boom");',ctx);
    throw new Error('deveria ter lançado');
  }catch(e){
    assert.strictEqual(e.message,'boom');
    assert.ok(String(e.stack).indexOf(H.SOURCE_LABEL)>=0,'stack sem '+H.SOURCE_LABEL);
  }
});

ok('E2A-11 runGameSource repassa opções do vm (ex.: timeout)',()=>{
  const ctx=vm.createContext({});
  assert.throws(()=>H.runGameSource('while(true){}',ctx,{timeout:50}),
    /Script execution timed out/);
});

/* ---------------- 4. invariante do E2-a nas suítes ---------------- */
const DIR=__dirname;
const SUITES=fs.readdirSync(DIR).filter(f=>/\.test\.js$/.test(f)).sort();
const SELF=path.basename(__filename);
/* montados por partes para que ESTE arquivo não case com os próprios guardas */
const SCRIPT_EXTRACT=new RegExp('match\\(\\s*/<'+'script');
const HTML_READ=new RegExp('readFileSync\\([^\\n]*(?<![\\w/])index\\.'+'html');
const CWD_READ=new RegExp('(?:readFileSync|existsSync)\\(\\s*[\'"][^/.\\\\][^\'"]*\\.(?:html|md|json)[\'"]');

ok('E2A-12 nenhuma suíte extrai <script> por conta própria',()=>{
  const maus=SUITES.filter(f=>f!==SELF&&SCRIPT_EXTRACT.test(fs.readFileSync(path.join(DIR,f),'utf8')));
  assert.deepStrictEqual(maus,[],'suítes com extração local: '+maus.join(', '));
});

ok('E2A-13 nenhuma suíte lê index.html direto do disco',()=>{
  const maus=SUITES.filter(f=>f!==SELF&&HTML_READ.test(fs.readFileSync(path.join(DIR,f),'utf8')));
  assert.deepStrictEqual(maus,[],'suítes lendo index.html: '+maus.join(', '));
});

ok('E2A-14 nenhuma suíte depende do diretório de trabalho para achar arquivos',()=>{
  const maus=SUITES.filter(f=>f!==SELF&&CWD_READ.test(fs.readFileSync(path.join(DIR,f),'utf8')));
  assert.deepStrictEqual(maus,[],'suítes dependentes de cwd: '+maus.join(', '));
});

ok('E2A-15 as suítes que carregam o jogo usam o harness compartilhado',()=>{
  const usam=SUITES.filter(f=>/require\((['"])\.\/harness\/load-game\1\)/.test(
    fs.readFileSync(path.join(DIR,f),'utf8')));
  assert.ok(usam.length>=39,'esperadas >=39 suítes usando o harness, vieram '+usam.length);
});

/* ---------------- 5. consumidores fora de tests/ ---------------- */
ok('E2A-16 audit_pr135/harness.js delega leitura e extração ao harness',()=>{
  const t=fs.readFileSync(path.join(H.ROOT,'audit_pr135','harness.js'),'utf8');
  assert.ok(t.indexOf("require('../tests/harness/load-game')")>=0,'não delega');
  assert.ok(!SCRIPT_EXTRACT.test(t),'ainda extrai <script> localmente');
});

ok('E2A-17 a linha `const html=...;` de audit_pr135/harness.js continua injetável',()=>{
  /* audit_pr155/performance_benchmark.js reescreve textualmente essa linha
     para rodar o benchmark sobre uma fonte alternativa. */
  const t=fs.readFileSync(path.join(H.ROOT,'audit_pr135','harness.js'),'utf8');
  const linhas=t.split('\n').filter(l=>/^const html=.*;$/.test(l));
  assert.strictEqual(linhas.length,1,'esperada exatamente 1 linha injetável, vieram '+linhas.length);
  assert.strictEqual(linhas[0],'const html=readGameHtml();');
});

console.log('\nResultado: '+passed+' passaram · '+failed+' falharam');
process.exit(failed?1:0);
