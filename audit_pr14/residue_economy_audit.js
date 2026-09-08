#!/usr/bin/env node
/* =====================================================================
 * PR14 · B3-FIX.1 — AUDITORIA READ-ONLY DA ECONOMIA DE ⧗ RESÍDUOS TEMPORAIS
 * ---------------------------------------------------------------------
 * Este script NÃO altera o jogo. Ele faz duas coisas:
 *
 *   1) LÊ index.html e extrai o inventário FACTUAL de FONTES e SINKS de
 *      ⧗ Resíduos Temporais (quantidade, condição, cap, RNG, earliest wave),
 *      falhando se algum marcador esperado não existir (auditoria viva).
 *
 *   2) Roda uma SIMULAÇÃO Monte-Carlo (N>=1000 seeds) de uma run típica,
 *      modelando as fontes reais com suas gates/caps/RNG e reportando, em
 *      checkpoints W4/W5/W10/W15/W20:
 *          mean · median · P10 · P25 · P75 · P90 · %zero · poder de compra
 *      para os cenários:
 *          A) sem interação excepcional (nenhuma facção conhecida cedo)
 *          B) com CACHE TEMPORAL (presença física do Consórcio)
 *          C) afinidade favorável (facção conhecida cedo → eventos rendem ⧗)
 *          D) build de extração (Echo com equipamento de coleta do Consórcio)
 *
 * A simulação usa um RNG determinístico semeado (mulberry32) — NÃO usa o
 * Director do jogo (é um modelo externo), então os números são ESTIMATIVAS
 * de ordem de grandeza para decisão de balanceamento, não o motor real.
 *
 * Uso:  node audit_pr14/residue_economy_audit.js [N]
 * Saída: relatório textual em stdout (nenhum arquivo é escrito).
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const N = Math.max(200, parseInt(process.argv[2] || '2000', 10) || 2000);

/* ------------------------------------------------------------------ */
/* utilidades                                                          */
/* ------------------------------------------------------------------ */
function section(t) { console.log('\n' + '='.repeat(70) + '\n' + t + '\n' + '='.repeat(70)); }
function row(k, v) { console.log('  ' + String(k).padEnd(42) + ' ' + v); }
function need(label, re) {
  const m = SRC.match(re);
  if (!m) { console.error('FALHA DE AUDITORIA: marcador ausente -> ' + label + ' (' + re + ')'); process.exitCode = 1; return null; }
  return m;
}
function num(re, idx) { const m = SRC.match(re); return m ? Number(m[idx == null ? 1 : idx]) : NaN; }

/* mulberry32 — RNG determinístico e barato */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pctl(sorted, p) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
function stats(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    mean: sum / s.length,
    median: pctl(s, .5),
    p10: pctl(s, .10), p25: pctl(s, .25), p75: pctl(s, .75), p90: pctl(s, .90),
    zero: (arr.filter(x => x <= 0).length / arr.length) * 100,
    min: s[0], max: s[s.length - 1]
  };
}

/* ================================================================== */
/* PARTE 1 — INVENTÁRIO FACTUAL (lido do fonte)                        */
/* ================================================================== */
section('PR14 · B3-FIX.1 — AUDITORIA DE ECONOMIA DE ⧗ (READ-ONLY)');
row('index.html', SRC.split('\n').length + ' linhas');
row('seeds da simulação (N)', N);

/* constantes canônicas */
const RES_MAX = num(/const\s+RES_MAX\s*=\s*(\d+)/) || num(/RES_MAX\s*=\s*(\d+)/);
const REROLL_BASE = num(/const\s+REROLL_BASE\s*=\s*(\d+)/);
const REROLL_SCALE = num(/REROLL_SCALE\s*=\s*([\d.]+)/);
const REROLL_CAP = num(/REROLL_CAP\s*=\s*(\d+)/);
const MAX_WAVE = num(/const\s+MAX_WAVE\s*=\s*(\d+)/);
const CACHE_RES = num(/FACTION_PRESENCE_CONSORTIUM_RES\s*=\s*(\d+)/);
const EV_GAP = num(/const\s+EV_DECISION_GAP\s*=\s*(\d+)/);
need('RES_MAX', /RES_MAX/);
need('addResidues', /function\s+addResidues\s*\(/);
need('spendResidues', /function\s+spendResidues\s*\(/);
need('CACHE TEMPORAL', /CACHE TEMPORAL/);
need('NÓ DE CONTENÇÃO', /NÓ DE CONTENÇÃO/);

section('CONSTANTES CANÔNICAS');
row('RES_MAX (teto de saldo)', RES_MAX);
row('REROLL_BASE / SCALE / CAP', REROLL_BASE + ' / ' + REROLL_SCALE + ' / ' + REROLL_CAP);
row('MAX_WAVE', MAX_WAVE);
row('MINI_WAVES', (SRC.match(/MINI_WAVES=\[([^\]]+)\]/) || [, '?'])[1]);
row('EV_DECISION_GAP', EV_GAP);
row('CACHE TEMPORAL rende (⧗)', CACHE_RES);

/* -------- FONTES (todas as chamadas addResidues) -------- */
section('FONTES DE ⧗ (call sites de addResidues no fonte)');
const addCalls = [];
const reAdd = /addResidues\(([^;]*?),\s*'([^']+)'/g;
let m;
while ((m = reAdd.exec(SRC))) {
  addCalls.push({ amt: m[1].trim(), src: m[2] });
}
row('total de call sites', addCalls.length);
addCalls.forEach(c => row('  ' + c.src, 'qtd=' + c.amt));

/* -------- SINKS: eventos que RENDEM via fracResFX -------- */
section('FONTES via EVENTOS DE FACÇÃO (fracResFX)');
const fxCalls = [];
const reFx = /fracResFX\((\d+)\)/g;
while ((m = reFx.exec(SRC))) fxCalls.push(Number(m[1]));
row('nº de opções de evento que rendem ⧗', fxCalls.length);
if (fxCalls.length) {
  const fs2 = stats(fxCalls);
  row('faixa de ganho por opção', '⧗' + fs2.min + '..⧗' + fs2.max + ' (média ⧗' + fs2.mean.toFixed(1) + ')');
}

/* -------- SINKS: preços da aba ECHO (equipamentos) -------- */
section('SINKS — EQUIPAMENTOS DE ECO (aba ECHO, preço em ⧗)');
const eqBlock = (SRC.match(/const ECHO_EQUIP=\[[\s\S]*?\n\];/) || [''])[0];
const eqPrices = [];
const reP = /price:(\d+)/g;
while ((m = reP.exec(eqBlock))) eqPrices.push(Number(m[1]));
const eqs = stats(eqPrices);
row('nº de equipamentos', eqPrices.length);
row('faixa de preço', '⧗' + eqs.min + '..⧗' + eqs.max);
row('mediana / média', '⧗' + eqs.median + ' / ⧗' + eqs.mean.toFixed(1));
row('estoque por visita (lote)', (SRC.match(/const n=(\d+);\s*\/\/ lote/) || [, '?'])[1]);

/* -------- SINKS: serviços temporais -------- */
section('SINKS — SERVIÇOS TEMPORAIS (aba ECHO)');
const svBlock = (SRC.match(/const FRAC_SERVICES=\[[\s\S]*?\n\];/) || [''])[0];
const svPrices = [];
const reSv = /price:(\d+)/g;
while ((m = reSv.exec(svBlock))) svPrices.push(Number(m[1]));
svPrices.forEach((p, i) => row('  serviço #' + (i + 1), '⧗' + p));

/* -------- SINKS: reroll -------- */
section('SINKS — REROLL DA ABA ECHO');
row('reroll #1', '⧗' + REROLL_BASE);
let rc = REROLL_BASE;
const rrSeq = [rc];
for (let i = 0; i < 4; i++) { rc = Math.min(REROLL_CAP, Math.round(rc * REROLL_SCALE)); rrSeq.push(rc); }
row('progressão (5 rerolls)', '⧗' + rrSeq.join(' → ⧗'));

/* ================================================================== */
/* PARTE 2 — MODELO DE GERAÇÃO POR ONDA                                */
/* ------------------------------------------------------------------ */
/* Grounded nos valores reais:                                        */
/*  · mini-chefe: MINI_WAVES=[5,10,15] rende ⧗3 (uma vez cada).       */
/*  · evento de facção: só se a facção é CONHECIDA (fracKnows) e minWave;*/
/*    rende fracResFX(3..14). Cadência global: ~1 decisão a cada 2-3   */
/*    ondas, e a fração que é de facção depende de conhecer facções.   */
/*  · oferta de facção (aba ECHO): con_avalia +8, dev_fenda +6 etc,    */
/*    gated por afinidade/observação.                                  */
/*  · CACHE TEMPORAL (presença física Consórcio): +CACHE_RES ao tocar. */
/*  · equipamento de coleta/extração: só com Echo portando item do     */
/*    Consórcio (que custa ⧗) → build-dependente; caps por onda.       */
/*  · dissonância contida: +1, cap 2/onda, exige equipamento/situação. */
/* ================================================================== */

/* Uma "run" avança onda a onda até W (checkpoint). Em cada onda somamos
   a geração estocástica das fontes ATIVAS naquele cenário. */
/* Modelo da CORREÇÃO proposta (FIX B): "sedimento temporal" de fim de onda.
   Pequeno e DECRESCENTE — só existe para dar chance de PARTICIPAR das
   primeiras lojas da aba ECHO; some cedo para não virar 2ª moeda. */
function residueSediment(w) {
  if (w <= 2) return 2;   // ondas 1-2: +2
  if (w <= 5) return 1;   // ondas 3-5: +1
  return 0;               // onda 6+: fontes reais (miniboss/eventos/build) assumem
}
/* SEDIMENT=1 no ambiente liga o modelo da correção */
const WITH_SEDIMENT = process.env.SEDIMENT === '1';

function simulateRun(rng, opts, uptoWave) {
  let res = 0;
  let factionKnown = !!opts.factionKnownEarly; // cenário C
  // observação acumulada leva a "contato" ~ wave 3-4 mesmo sem cenário C
  let obs = 0;
  for (let w = 1; w <= uptoWave; w++) {
    // 0) CORREÇÃO proposta — sedimento temporal de fim de onda (taper)
    if (WITH_SEDIMENT) res += residueSediment(w);

    // 1) mini-chefe
    if ([5, 10, 15].indexOf(w) >= 0) res += 3;

    // 2) descoberta natural de facção: decisões "notadas" acumulam obs;
    //    ~1 decisão a cada ~2.5 ondas, ~55% notada, FRAC_CONTACT_OBS=3.
    if (!factionKnown) {
      if (rng() < 0.40) obs += (rng() < 0.5 ? 2 : 1);
      if (obs >= 3) factionKnown = true;
    }

    // 3) eventos de facção (rendem ⧗ só se conhecida e w>=minWave~4)
    if (factionKnown && w >= 4) {
      // cadência: em ~40% das ondas há uma decisão; dessas, uma fração é
      // de facção. Com afinidade favorável (C) essa fração e o pool sobem.
      const decisionThisWave = rng() < 0.40;
      if (decisionThisWave) {
        const facEventShare = opts.factionKnownEarly ? 0.45 : 0.30;
        if (rng() < facEventShare) {
          // ganho médio das opções que rendem ⧗ (algumas opções não rendem)
          // ~55% das vezes o jogador escolhe a opção que rende; ganho 3..12
          if (rng() < 0.55) {
            const pick = 3 + Math.floor(rng() * 10); // 3..12
            res += pick;
          }
        }
      }
    }

    // 4) CACHE TEMPORAL (cenário B): presença física do Consórcio.
    //    _ACTIVE_CAP=1, TTL curto; aparece raramente e o jogador precisa
    //    tocar. Modelamos ~1 ocorrência aproveitada a cada ~6 ondas após W3.
    if (opts.cache && w >= 3 && rng() < 0.16) res += CACHE_RES;

    // 5) build de extração (cenário D): Echo com equipamento do Consórcio.
    //    coleta: elite => +1 (cap 4/onda); comum 25% => +1. extração +1 elite.
    //    modelamos elites por onda ~ eliteChance e kills.
    if (opts.extractBuild && w >= 4) {
      // eliteChance(w)=min(.30,(w-4)*.028); ~10-16 kills/onda
      const eliteCh = Math.min(0.30, Math.max(0, (w - 4) * 0.028));
      const kills = 10 + Math.floor(rng() * 8);
      let coleta = 0;
      for (let k = 0; k < kills && coleta < 4; k++) {
        const elite = rng() < eliteCh;
        if (elite) { res += 1; coleta++; }
        else if (rng() < 0.25) { res += 1; coleta++; }
      }
    }

    // 6) dissonância contida: +1 cap 2/onda — exige ruptura+contenção.
    //    ocorre com Echos e equipamento estabilizador; modesto.
    if (opts.extractBuild || opts.cache) {
      if (w >= 3 && rng() < 0.20) res += 1;
    }

    res = Math.min(RES_MAX, res);
  }
  return res;
}

const CHECKPOINTS = [4, 5, 10, 15, 20];
const SCENARIOS = [
  { key: 'A', name: 'sem interação excepcional', opts: {} },
  { key: 'B', name: 'com CACHE TEMPORAL', opts: { cache: true } },
  { key: 'C', name: 'afinidade favorável (facção cedo)', opts: { factionKnownEarly: true } },
  { key: 'D', name: 'build de extração (Consórcio)', opts: { extractBuild: true } }
];

section('SIMULAÇÃO MONTE-CARLO — SALDO ACUMULADO DE ⧗ POR CHECKPOINT');
console.log('  (N=' + N + ' seeds · valores em ⧗ · %0 = fração com saldo zero)\n');

/* poder de compra: quantos itens da aba ECHO você poderia pagar com a
   MEDIANA de saldo — usa a mediana de preço dos equipamentos. */
const medPrice = eqs.median;

for (const sc of SCENARIOS) {
  console.log('  CENÁRIO ' + sc.key + ' — ' + sc.name);
  console.log('  ' + 'W'.padEnd(4) + 'mean'.padStart(7) + 'med'.padStart(6) +
    'P10'.padStart(6) + 'P25'.padStart(6) + 'P75'.padStart(6) + 'P90'.padStart(6) +
    '%0'.padStart(7) + '  poder(med/preço~' + medPrice + ')');
  for (const cp of CHECKPOINTS) {
    const vals = [];
    for (let i = 0; i < N; i++) {
      const rng = mulberry32((sc.key.charCodeAt(0) << 20) ^ (cp << 12) ^ (i + 1));
      vals.push(simulateRun(rng, sc.opts, cp));
    }
    const st = stats(vals);
    const power = (st.median / medPrice);
    console.log('  ' + ('W' + cp).padEnd(4) +
      st.mean.toFixed(1).padStart(7) +
      String(Math.round(st.median)).padStart(6) +
      String(Math.round(st.p10)).padStart(6) +
      String(Math.round(st.p25)).padStart(6) +
      String(Math.round(st.p75)).padStart(6) +
      String(Math.round(st.p90)).padStart(6) +
      (st.zero.toFixed(0) + '%').padStart(7) +
      '   ' + power.toFixed(1) + ' itens');
  }
  console.log('');
}

/* ================================================================== */
/* PARTE 3 — DIAGNÓSTICO / FILOSOFIA                                   */
/* ================================================================== */
section('DIAGNÓSTICO (contra a filosofia declarada)');
console.log([
  '  Filosofia: ⧗ deve ser SUFICIENTE PARA DECIDIR, não para comprar tudo.',
  '  As primeiras lojas da aba ECHO devem dar CHANCE RAZOÁVEL de participar',
  '  (comprar 1 item barato), sem obrigar a esvaziar a loja.',
  '',
  '  Leia a tabela acima assim:',
  '   · Em W4/W5 (primeiras lojas da aba ECHO) o cenário A (jogador que ainda',
  '     não priorizou facções) deve permitir ~1 item barato (⧗3-6) em boa',
  '     parte dos seeds. Se %0 for alto e a mediana < ⧗3, a PARTICIPAÇÃO está',
  '     bloqueada cedo — problema de GERAÇÃO INICIAL, não de preço.',
  '   · Em W10+ a mediana deve crescer o bastante para 1-2 escolhas por visita,',
  '     mas P90 não deve permitir comprar a loja inteira (senão vira 2ª moeda).',
  '   · CACHE (B) e afinidade (C) devem ADICIONAR textura sobre A, não serem',
  '     obrigatórios para participar.',
  '',
  '  A menor intervenção justificada é a que eleva o piso de PARTICIPAÇÃO em',
  '  W4/W5 do cenário A sem inflar P90 dos demais cenários.'
].join('\n'));

section('FIM DA AUDITORIA READ-ONLY');
