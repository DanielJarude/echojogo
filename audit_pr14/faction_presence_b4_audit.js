#!/usr/bin/env node
/* =====================================================================
 * PR14 · B4 — AUDITORIA READ-ONLY DAS QUATRO PRESENÇAS + REAÇÕES DE ECHO
 * ---------------------------------------------------------------------
 * NÃO altera nada. Duas funções:
 *
 *  1) LÊ index.html e valida os marcadores factuais do B4 (falha explícita
 *     se algum marcador esperado não existir — auditoria viva):
 *       · as 4 facções são fisicamente elegíveis;
 *       · cada uma tem label/símbolo/efeito;
 *       · matriz de reação FACÇÃO × PERSONALIDADE existe (4×8);
 *       · anti-repeat de fala de Echo não usa Math.random.
 *
 *  2) BALANCE (analítico, grounded nos valores reais lidos do fonte):
 *     compara benefício/risco/duração das 4 presenças por estágio
 *     (early W2-6 / mid W7-13 / late W14-20), reportando valor aproximado
 *     e dependência de build. Não roda o jogo (ambiente sem canvas).
 *
 * Uso:  node audit_pr14/faction_presence_b4_audit.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function section(t) { console.log('\n' + '='.repeat(70) + '\n' + t + '\n' + '='.repeat(70)); }
function row(k, v) { console.log('  ' + String(k).padEnd(44) + ' ' + v); }
function need(label, re) {
  const ok = (typeof re === 'boolean') ? re : re.test(SRC);
  console.log('  [' + (ok ? 'OK ' : 'FALTA') + '] ' + label);
  if (!ok) process.exitCode = 1;
  return ok;
}
function num(re, i) { const m = SRC.match(re); return m ? Number(m[i == null ? 1 : i]) : NaN; }

section('PR14 · B4 — AUDITORIA READ-ONLY');
row('index.html', SRC.split('\n').length + ' linhas');

/* -------- 1. marcadores factuais -------- */
section('MARCADORES ESTRUTURAIS');
need('FACTION_PRESENCE_PHYSICAL inclui as 4 facções',
  /FACTION_PRESENCE_PHYSICAL\s*=\s*\[\s*'anchor'\s*,\s*'remnants'\s*,\s*'consortium'\s*,\s*'deviants'\s*\]/);
need('label REMANESCENTES (◉)', /remnants\s*:\{[^}]*sym:'◉'/);
need('label DESVIADOS (◬)', /deviants\s*:\{[^}]*sym:'◬'/);
need('draw próprio dos Remanescentes (fpDrawRemnants)', /function fpDrawRemnants/);
need('draw próprio dos Desviados (fpDrawDeviants)', /function fpDrawDeviants/);
need('efeito Remanescentes (faction interact anchor/remnants/consortium/deviants)', /e\.faction==='remnants'/);
need('efeito Desviados', /e\.faction==='deviants'/);
need('matriz de reação de Echo (ECHO_FACTION_REACTIONS)', /ECHO_FACTION_REACTIONS/);
need('seletor de reação (echoFactionReaction)', /function echoFactionReaction/);
need('cap físico = 1 preservado', /FACTION_PRESENCE_ACTIVE_CAP=1/);
need('CACHE TEMPORAL preservado', /CACHE TEMPORAL/);
need('NÓ DE CONTENÇÃO preservado', /NÓ DE CONTENÇÃO/);
need('anti-repeat de Echo NÃO usa Math.random no seletor',
  /function echoFactionReaction[\s\S]{0,1400}?\}/.test(SRC) &&
  !/function echoFactionReaction[\s\S]{0,1400}?Math\.random/.test(SRC));
need('SM_VERSION=3', /SM_VERSION=3/);
need('FRACTURE_STATE_VERSION=1', /FRACTURE_STATE_VERSION=1/);
need('ECHO_VERSION 0.8.0-alpha', /ECHO_VERSION='0\.8\.0-alpha'/);

/* -------- 2. cobertura da matriz 4×8 -------- */
section('COBERTURA DA MATRIZ FACÇÃO × PERSONALIDADE');
const PERS = ['aggressive', 'cautious', 'precise', 'impulsive', 'resilient', 'opportunist', 'versatile', 'fragmented'];
const FAC = ['anchor', 'remnants', 'consortium', 'deviants'];
/* extrai o bloco literal da matriz */
const mBlock = (SRC.match(/const ECHO_FACTION_REACTIONS=\{[\s\S]*?\n\};/) || [''])[0];
let totalLines = 0, holes = 0;
for (const f of FAC) {
  const fBlock = (mBlock.match(new RegExp(f + ':\\{[\\s\\S]*?\\n\\s{2}\\}', 'm')) || [''])[0];
  let fLines = 0;
  const cells = [];
  for (const p of PERS) {
    // conta strings do array daquela personalidade dentro do bloco da facção
    const cell = (fBlock.match(new RegExp(p + ':\\[([\\s\\S]*?)\\]')) || [, ''])[1];
    const n = (cell.match(/'/g) || []).length / 2 | 0;
    cells.push(p.slice(0, 4) + ':' + n);
    fLines += n;
    if (n === 0) holes++;
  }
  totalLines += fLines;
  row(f, cells.join('  ') + '   (Σ' + fLines + ')');
}
/* pool base por facção (rota comum quando a personalidade não tem célula) */
const baseBlock = (SRC.match(/const ECHO_FACTION_BASE=\{[\s\S]*?\n\};/) || [''])[0];
let baseLines = 0;
for (const f of FAC) {
  const cell = (baseBlock.match(new RegExp(f + ':\\[([\\s\\S]*?)\\]')) || [, ''])[1];
  const n = (cell.match(/'/g) || []).length / 2 | 0;
  baseLines += n;
  row('base ' + f, n + ' linhas (fallback por facção)');
}
row('TOTAL de falas de Echo (matriz + base)', totalLines + ' + ' + baseLines + ' = ' + (totalLines + baseLines));
row('células personalidade×facção sem linha própria', holes + ' de 32 (cobertas pela base)');

/* -------- 3. balance analítico -------- */
section('BALANCE ANALÍTICO DAS 4 PRESENÇAS (grounded no fonte)');
const anchorSh = num(/FACTION_PRESENCE_ANCHOR_SHIELD=([\d.]+)/);
const consRes = num(/FACTION_PRESENCE_CONSORTIUM_RES=(\d+)/);
const remShield = num(/FACTION_PRESENCE_REMNANTS_SHIELD=([\d.]+)/);
const remTrust = num(/FACTION_PRESENCE_REMNANTS_TRUST=(\d+)/);
const devDur = num(/FACTION_PRESENCE_DEVIANTS_DUR=(\d+)/);
const devDmg = num(/FACTION_PRESENCE_DEVIANTS_DMG=([\d.]+)/);
const devTaken = num(/FACTION_PRESENCE_DEVIANTS_TAKEN=([\d.]+)/);

console.log('  Presença     Benefício                              Risco/Custo            Duração');
console.log('  ' + '-'.repeat(94));
console.log('  ⬡ ÂNCORA     +' + Math.round(anchorSh * 100) + '% do Escudo MÁX (one-shot)          nenhum (só escudo)     instantâneo');
console.log('  ◈ CONSÓRCIO  +⧗' + consRes + ' Resíduos (one-shot)                nenhum                 instantâneo');
console.log('  ◉ REMANESC.  +' + Math.round(remShield * 100) + '% shield dos Ecos + ' + remTrust + ' confiança   nenhum (vínculo)       instantâneo');
console.log('  ◬ DESVIADOS  +' + Math.round((devDmg - 1) * 100) + '% dano por ' + devDur + 's                  +' + Math.round((devTaken - 1) * 100) + '% dano recebido        ' + devDur + 's (temporário)');

console.log('\n  Leitura por estágio:');
console.log('   · early (W2-6): ÂNCORA/REMANESC. protegem quem tem pouco escudo; CONSÓRCIO');
console.log('     dá o ⧗ que falta p/ a 1ª loja ECHO; DESVIADOS é aposta ofensiva arriscada.');
console.log('   · mid  (W7-13): as quatro têm utilidade comparável; DESVIADOS brilha em burst.');
console.log('   · late (W14-20): CONSÓRCIO/DESVIADOS escalam com o que já se tem; ÂNCORA/');
console.log('     REMANESC. valem mais quando o escudo/vínculo está em risco (situacional).');
console.log('\n  Dependência de build: DESVIADOS (ofensivo) > CONSÓRCIO (economia) >');
console.log('  REMANESC. (precisa de Echos vivos) > ÂNCORA (precisa de shieldMax>0).');
console.log('  Nenhuma é dominante: cada uma responde a um estado diferente da run.');

section('FIM DA AUDITORIA READ-ONLY B4');
