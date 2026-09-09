#!/usr/bin/env node
'use strict';
/* =====================================================================
   tests/run-all.js — RUNNER CONSOLIDADO DA SUÍTE DE TESTES DO ECHO
   ---------------------------------------------------------------------
   Por que existe
   --------------
   O `npm test` anterior encadeava as 41 suítes com `&&`. Dois problemas
   reais decorriam disso:

     1. MASCARAMENTO — a primeira suíte que falhava abortava a cadeia e
        todas as seguintes simplesmente NUNCA EXECUTAVAM. Uma falha de
        versão em `devmode.test.js` (suíte 4) escondia 37 suítes.
     2. OMISSÃO — a lista era mantida à mão. `pr13-5-b5c-paradox.test.js`
        existia no disco e nunca entrou na lista, portanto nunca rodou na
        regressão.

   Este runner resolve os dois:
     · DESCOBERTA AUTOMÁTICA de `tests/*.test.js` (nada fica de fora por
       esquecimento — suíte nova entra sozinha);
     · ISOLAMENTO — cada suíte roda no seu próprio processo filho, então
       um crash não derruba as demais;
     · NÃO ABORTA — roda todas e só então consolida;
     · TOTAL CONSOLIDADO — suítes, checks ✔ e falhas, somados de verdade;
     · CÓDIGO DE SAÍDA — 0 só se TODAS as suítes passarem.

   Uso
   ---
     node tests/run-all.js                  # todas as suítes
     node tests/run-all.js --grep pr15      # só as que casam com "pr15"
     node tests/run-all.js --grep "pr15|sandbox|saveslots|fracture"
     node tests/run-all.js --list           # só lista o que rodaria
     node tests/run-all.js --quiet          # sem o log de cada suíte

   Contagem de checks
   ------------------
   As suítes do projeto não compartilham um formato de resumo (existem
   "Resultado: N passaram · M falharam", "N PASSARAM · M FALHAS",
   "TODOS OS TESTES PASSARAM", "FALHAS DETECTADAS"...). Por isso:
     · ✔  (\u2714) é contado sempre — é o marcador de check aprovado;
     · ✘ (\u2718) e ✖ (\u2716) são os marcadores de falha, mas algumas suítes
       RECAPITULAM as falhas no fim, duplicando a linha. Então a contagem
       de falhas prefere o número que a própria suíte declara no resumo e
       só recorre à contagem de marcadores quando não há resumo.
   O número consolidado bate com a soma manual suíte a suíte.
   ===================================================================== */
const {spawnSync}=require('child_process');
const fs=require('fs');
const path=require('path');

const DIR=__dirname;
const ROOT=path.resolve(DIR,'..');

/* ---------------- argumentos ---------------- */
const argv=process.argv.slice(2);
const flag=n=>argv.includes(n);
const optVal=n=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:null;};
const GREP=optVal('--grep');
const LIST=flag('--list');
const QUIET=flag('--quiet');

/* ---------------- descoberta automática ---------------- */
const files=fs.readdirSync(DIR)
  .filter(f=>/\.test\.js$/.test(f))
  .sort((a,b)=>a.localeCompare(b));

const selected=GREP
  ? files.filter(f=>{
      try{return new RegExp(GREP,'i').test(f);}
      catch(e){return f.toLowerCase().includes(GREP.toLowerCase());}
    })
  : files;

if(LIST){
  selected.forEach(f=>console.log(f));
  console.log('---');
  console.log(selected.length+' suíte(s) de '+files.length+' descoberta(s) em tests/');
  process.exit(0);
}

/* ---------------- contagem de checks ---------------- */
const OK_MARK='\u2714';                       // ✔
const FAIL_MARKS=['\u2718','\u2716'];         // ✘ , ✖

function countMarks(out){
  const lines=out.split('\n');
  let pass=0,fail=0;
  for(const l of lines){
    if(l.includes(OK_MARK))pass++;
    if(FAIL_MARKS.some(m=>l.includes(m)))fail++;
  }
  return {pass,fail};
}

/* Extrai o número de falhas que a PRÓPRIA suíte declara. Retorna null
   quando não há resumo reconhecível (aí o caller usa os marcadores). */
function declaredFailures(out){
  const lines=out.split('\n');
  /* varre de baixo para cima: o resumo vem no fim */
  for(let i=lines.length-1;i>=0;i--){
    const l=lines[i];
    let m;
    if((m=/(\d+)\s*(?:falharam|failed)/i.exec(l)))return parseInt(m[1],10);
    if((m=/FALHAS\s*\((\d+)\)/i.exec(l)))return parseInt(m[1],10);
    if((m=/(\d+)\s+FALHAS/.exec(l)))return parseInt(m[1],10);
    if(/TODOS OS TESTES PASSARAM|0\s+FALHAS/i.test(l))return 0;
    /* "FALHAS DETECTADAS" não traz número — não decide aqui */
  }
  return null;
}

/* ---------------- execução ---------------- */
const results=[];
let totPass=0,totFail=0,totBad=0;
const t0=Date.now();

for(const f of selected){
  const rel='tests/'+f;
  const r=spawnSync(process.execPath,[rel],{
    cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024,timeout:20*60*1000
  });
  const out=((r.stdout||'')+(r.stderr||'')).replace(/\r\n/g,'\n');
  const marks=countMarks(out);
  const declared=declaredFailures(out);
  /* falhas: prefere o número declarado pela suíte (evita dupla contagem
     da recapitulação); sem resumo, usa os marcadores. */
  const fail=(declared!=null)?declared:marks.fail;
  const pass=marks.pass;
  /* suíte ruim = exit≠0 OU declarou falhas OU não produziu nenhum check */
  const bad=(r.status!==0)||fail>0||pass===0;

  totPass+=pass;totFail+=fail;if(bad)totBad++;
  results.push({file:f,pass,fail,bad,status:r.status,ms:0});

  if(!QUIET){
    const tag=bad?'FAIL':'ok  ';
    console.log(
      '['+tag+'] '+f.padEnd(44)+
      '✔'+String(pass).padStart(4)+
      '  ✘'+String(fail).padStart(3)+
      '  exit='+r.status
    );
  }
  if(bad&&!QUIET){
    /* mostra o trecho útil do log da suíte que falhou */
    const keep=out.split('\n').filter(l=>FAIL_MARKS.some(m=>l.includes(m))||
      /FALHAS|Error|error:|AssertionError|expected|actual/i.test(l));
    keep.slice(0,25).forEach(l=>console.log('        '+l));
  }
}

const secs=((Date.now()-t0)/1000).toFixed(1);
console.log('');
console.log('='.repeat(64));
console.log('SUÍTES: '+selected.length+'   ·   COM FALHA: '+totBad+
            '   ·   CHECKS ✔: '+totPass+'   ·   FALHAS ✘: '+totFail+
            '   ·   '+secs+'s');
if(totBad===0&&totFail===0){
  console.log('TODAS AS SUÍTES PASSARAM');
}else{
  console.log('HÁ FALHAS:');
  results.filter(r=>r.bad).forEach(r=>
    console.log('  ✘ '+r.file+'  (✔'+r.pass+' ✘'+r.fail+' exit='+r.status+')'));
}
console.log('='.repeat(64));
process.exit((totBad===0&&totFail===0)?0:1);
