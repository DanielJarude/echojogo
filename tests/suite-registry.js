'use strict';
/* =====================================================================
   tests/suite-registry.js — CONTRATO DE INTEGRAÇÃO SUÍTE ↔ RUNNER
   ---------------------------------------------------------------------
   Histórico
   ---------
   Até a PR15·B2 o `npm test` era uma cadeia `&&` com os 41 comandos
   escritos à mão no package.json. Diversos testes verificavam a própria
   integração fazendo `pkg.scripts.test.indexOf('tests/x.test.js')>=0`.

   Essa cadeia tinha dois defeitos reais:
     · MASCARAMENTO — a 1ª suíte que falhava abortava tudo; as seguintes
       nunca executavam (uma falha de versão na suíte 4 escondia 37);
     · OMISSÃO — a lista era manual; `pr13-5-b5c-paradox.test.js` existia
       no disco e nunca entrou nela, logo nunca rodou na regressão.

   A cadeia foi substituída por `tests/run-all.js`, que DESCOBRE
   automaticamente `tests/*.test.js`, roda cada suíte em processo próprio,
   não aborta na primeira falha e consolida o total.

   Consequência: a garantia "a suíte X roda no npm test" deixou de ser uma
   substring do package.json e passou a ser uma propriedade verificável:
     1. `npm test` invoca `tests/run-all.js`;
     2. `tests/run-all.js --list` inclui X.
   Este módulo centraliza essa verificação para os testes que a usavam,
   evitando que cada suíte reimplemente (e desalinhe) a mesma checagem.

   O arquivo NÃO termina em `.test.js`, portanto o runner não o trata como
   suíte — é apenas biblioteca de teste.
   ===================================================================== */
const {execFileSync}=require('child_process');
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..');
const RUNNER=path.join(__dirname,'run-all.js');
const PKG=path.join(ROOT,'package.json');

/* script `test` declarado no package.json */
function npmTestScript(){
  return (JSON.parse(fs.readFileSync(PKG,'utf8')).scripts||{}).test||'';
}

/* o npm test delega ao runner? */
function runnerInstalled(){
  return /tests[\\/]run-all\.js/.test(npmTestScript());
}

let _cache=null;
/* suítes que o runner de fato descobriu (executa `--list` uma única vez) */
function discoveredSuites(){
  if(_cache)return _cache;
  const out=execFileSync(process.execPath,[RUNNER,'--list'],
    {cwd:ROOT,encoding:'utf8',timeout:60000});
  _cache=out.split('\n').map(s=>s.trim()).filter(s=>/\.test\.js$/.test(s));
  return _cache;
}

/* a suíte `name` (com ou sem sufixo) roda pelo npm test? */
function suiteIsDiscovered(name){
  const f=/\.test\.js$/.test(name)?name:name+'.test.js';
  return discoveredSuites().indexOf(f)>=0;
}

/* todas as suítes de `names` rodam? retorna a lista das ausentes */
function missingSuites(names){
  return (names||[]).filter(n=>!suiteIsDiscovered(n));
}

module.exports={ROOT,RUNNER,PKG,
  npmTestScript,runnerInstalled,discoveredSuites,suiteIsDiscovered,missingSuites};
