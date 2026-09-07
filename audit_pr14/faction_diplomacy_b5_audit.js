#!/usr/bin/env node
/* =====================================================================
 * PR14 · B5 — AUDITORIA + SIMULAÇÃO READ-ONLY DA DIPLOMACIA DE FACÇÕES
 * ---------------------------------------------------------------------
 * NÃO altera o jogo. Faz três coisas:
 *
 *  1) EXTRAI do index.html o inventário FACTUAL do sistema de afinidade:
 *       · thresholds dos FACTION_STATES (aliada/…/hostil);
 *       · a grade FACTION_GRID (fontes/sinks de afinidade por evento);
 *       · o clamp por evento (±4) e o range global [-100,100];
 *       · se o modelo B5 (rivalidades/pacto/teto) está presente no fonte.
 *     Falha (exit 1) se um marcador ESPERADO não existir — auditoria viva.
 *
 *  2) SIMULA (Monte-Carlo, N>=5000) trajetórias plausíveis de decisões de
 *     uma run, usando os DELTAS REAIS de FACTION_GRID, e reporta a
 *     distribuição de estados por facção e a incidência de 0..4 alianças.
 *     Modo padrão = SEM o modelo B5 (baseline "ANTES"). Com --b5, aplica o
 *     teto diplomático derivado da rivalidade (baseline "DEPOIS").
 *
 *  3) COMPARA (--compare) ANTES vs DEPOIS lado a lado.
 *
 * O RNG é determinístico (mulberry32); NÃO é o Director — os números são
 * estimativas de ordem de grandeza para decisão de balanceamento.
 *
 * Uso:
 *   node audit_pr14/faction_diplomacy_b5_audit.js            # auditoria + ANTES
 *   node audit_pr14/faction_diplomacy_b5_audit.js --b5 8000  # DEPOIS, N=8000
 *   node audit_pr14/faction_diplomacy_b5_audit.js --compare  # ANTES vs DEPOIS
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const FACTIONS = ['anchor', 'remnants', 'consortium', 'deviants'];
const NAME = { anchor: 'ÂNCORA', remnants: 'REMANESCENTES', consortium: 'CONSÓRCIO', deviants: 'DESVIADOS' };
/* rivalidades fortes (dois eixos ideológicos — confirmadas no lore FRACTIONS.rel) */
const RIVAL = { anchor: 'deviants', deviants: 'anchor', remnants: 'consortium', consortium: 'remnants' };

function section(t) { console.log('\n' + '='.repeat(70) + '\n' + t + '\n' + '='.repeat(70)); }
function need(label, ok) {
  console.log('  [' + (ok ? 'OK ' : 'FALTA') + '] ' + label);
  if (!ok) process.exitCode = 1;
  return ok;
}

/* ---------------- 1. extração factual ---------------- */
function extractStates() {
  /* {min:85,id:'aliada',...} */
  const re = /\{min:(-?\d+),\s*id:'([a-z]+)',\s*lab:'([^']+)'/g;
  const out = [];
  let m;
  const block = SRC.slice(SRC.indexOf('const FACTION_STATES='), SRC.indexOf('const FACTION_STATES=') + 600);
  while ((m = re.exec(block))) out.push({ min: Number(m[1]), id: m[2], lab: m[3] });
  return out;
}
function extractGrid() {
  const start = SRC.indexOf('const FACTION_GRID=');
  const end = SRC.indexOf('};', start);
  const block = SRC.slice(start, end);
  const rowRe = /(\w+)\s*:\{anchor:(-?\d+),\s*remnants:(-?\d+),\s*consortium:(-?\d+),\s*deviants:(-?\d+)\}/g;
  const grid = {};
  let m;
  while ((m = rowRe.exec(block))) {
    grid[m[1]] = { anchor: +m[2], remnants: +m[3], consortium: +m[4], deviants: +m[5] };
  }
  return grid;
}

const STATES = extractStates();
const GRID = extractGrid();
const ALLY_MIN = (STATES.find(s => s.id === 'aliada') || { min: 85 }).min;
/* B5: limiar REAL de consolidação de pacto (FAVORÁVEL). A auditoria mostrou
   que ALIADA(85) é organicamente inalcançável; o pacto abre em FAVORÁVEL. */
const PACT_MIN = (function () {
  const m = SRC.match(/FACTION_PACT_MIN\s*=\s*(-?\d+)/);
  return m ? +m[1] : 58;
})();
const HOSTILE_MAX = (STATES.find(s => s.id === 'desconfiada') || { min: -60 }).min; // < isso => hostil

function stateOf(v) {
  for (const s of STATES) if (v >= s.min) return s.id;
  return STATES[STATES.length - 1].id;
}

section('PR14 · B5 — AUDITORIA READ-ONLY DA DIPLOMACIA');
console.log('  index.html: ' + SRC.split('\n').length + ' linhas');
need('FACTION_STATES extraído (7 estados)', STATES.length === 7);
need('threshold ALIADA = 85', ALLY_MIN === 85);
need('FACTION_GRID extraído (>=25 eventos)', Object.keys(GRID).length >= 25);
need('range de afinidade [-100,100] no fonte', /clamp\(before\+delta,-100,100\)/.test(SRC));
need('clamp por evento ±4 no fonte', /d=clamp\(d,-4,4\)/.test(SRC));

/* marcadores do modelo B5 (podem ainda não existir na 1ª passada) */
section('MARCADORES DO MODELO B5 (diplomacia)');
const hasRival = /FACTION_RIVAL\s*=/.test(SRC);
const hasPact = /factionPactConsolidate|FACTION_PACT|fracPact/.test(SRC);
const hasCeiling = /factionAffinityCeiling|fracDiplomaticCeiling|diplomaticCeiling/.test(SRC);
need('mapa de rivalidades (FACTION_RIVAL)', hasRival);
need('consolidação de pacto (factionPactConsolidate/FACTION_PACT)', hasPact);
need('teto diplomático centralizado (ceiling)', hasCeiling);

/* ---------------- 2. simulação ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* aplica a grade de um evento nas 4 afinidades, com clamp por-evento e global.
   Se b5=true, aplica um teto diplomático simples: quando uma facção está
   consolidada como aliada (>=ALLY_MIN), a rival é limitada a NEUTRA (min -1). */
function applyEvent(aff, pact, gridRow, b5) {
  for (const id of FACTIONS) {
    let d = gridRow[id] || 0;
    if (!d) continue;
    if (d > 4) d = 4; if (d < -4) d = -4;
    let v = aff[id] + d;
    if (v > 100) v = 100; if (v < -100) v = -100;
    if (b5) {
      const rv = RIVAL[id];
      if (rv && pact[rv]) {
        /* rival de uma facção com pacto consolidado tem teto = 0 (NEUTRA topo) */
        if (v > 0) v = 0;
      }
    }
    aff[id] = v;
  }
}

function simulate(N, b5) {
  const seedBase = 0x5f3a71;
  const events = Object.keys(GRID);
  const allyCountHist = [0, 0, 0, 0, 0];         // 0..4 alianças
  const stateTally = {};                          // por facção → estado → contagem
  for (const id of FACTIONS) stateTally[id] = {};
  let contradictoryDouble = 0;                    // duas rivais aliadas simultâneas
  let anyPact = 0;

  for (let s = 0; s < N; s++) {
    const rng = mulberry32(seedBase + s * 2654435761);
    const aff = { anchor: 0, remnants: 0, consortium: 0, deviants: 0 };
    const pact = { anchor: 0, remnants: 0, consortium: 0, deviants: 0 };
    /* uma run típica: ~18 a ~30 decisões que emitem afinidade.
       O jogador tende a ter um "viés" (posicionamento), modelado por um
       peso que favorece eventos coerentes com uma facção-alvo aleatória. */
    const nDecisions = 18 + Math.floor(rng() * 13);
    const focus = FACTIONS[Math.floor(rng() * 4)];
    /* espectro realista de posicionamento: de jogadores casuais (baixa
       consistência) a jogadores que se COMPROMETEM com uma facção (o pacto
       existe justamente para recompensar quem se posiciona). */
    const focusStrength = rng();                   // 0..1: quão consistente é o jogador
    const pickBias = 0.30 + focusStrength * 0.65;  // 0.30..0.95 de escolhas coerentes
    for (let k = 0; k < nDecisions; k++) {
      let ev;
      if (rng() < pickBias) {
        /* jogador posicionado: escolhe, entre os eventos que BENEFICIAM o
           foco, um dos melhores (greedy brando) — reflete alguém que sabe o
           que quer, como no teste greedy (pico ~60-66). */
        const pos = events.filter(e => (GRID[e][focus] || 0) > 0)
          .sort((a, b) => (GRID[b][focus] || 0) - (GRID[a][focus] || 0));
        if (pos.length) {
          const top = pos.slice(0, Math.max(1, Math.ceil(pos.length * 0.35)));
          ev = top[Math.floor(rng() * top.length)];
        } else {
          ev = events[Math.floor(rng() * events.length)];
        }
      } else {
        ev = events[Math.floor(rng() * events.length)];
      }
      applyEvent(aff, pact, GRID[ev], b5);
      /* consolidação de pacto: no modelo B5, ao cruzar ALLY_MIN uma vez, o
         jogador (modelado) consolida com probabilidade alta se ainda não tem
         pacto no eixo rival. */
      if (b5) {
        for (const id of FACTIONS) {
          /* B5 real: consolida ao cruzar FAVORÁVEL (PACT_MIN), decisão
             explícita modelada com prob. alta, respeitando um-pacto-por-eixo. */
          if (aff[id] >= PACT_MIN && !pact[id]) {
            const rv = RIVAL[id];
            if (!pact[rv] && rng() < 0.85) pact[id] = 1;
          }
        }
      }
    }
    /* contagem final de alianças por estado */
    let allies = 0;
    for (const id of FACTIONS) {
      const st = b5
        ? (pact[id] ? 'aliada' : stateOf(aff[id]))
        : stateOf(aff[id]);
      stateTally[id][st] = (stateTally[id][st] || 0) + 1;
      if (st === 'aliada') allies++;
    }
    allyCountHist[allies]++;
    if (b5) { if (Object.values(pact).some(x => x)) anyPact++; }
    /* alianças contraditórias: duas rivais ambas aliadas */
    const A = b5 ? pact : { anchor: aff.anchor >= ALLY_MIN ? 1 : 0, remnants: aff.remnants >= ALLY_MIN ? 1 : 0, consortium: aff.consortium >= ALLY_MIN ? 1 : 0, deviants: aff.deviants >= ALLY_MIN ? 1 : 0 };
    if ((A.anchor && A.deviants) || (A.remnants && A.consortium)) contradictoryDouble++;
  }
  return { N, allyCountHist, stateTally, contradictoryDouble, anyPact };
}

function pct(n, N) { return (100 * n / N).toFixed(1) + '%'; }
function report(r, title) {
  section(title + '  (N=' + r.N + ')');
  console.log('  Nº de ALIANÇAS por run:');
  for (let i = 0; i <= 4; i++) console.log('    ' + i + ' aliança(s): ' + pct(r.allyCountHist[i], r.N));
  console.log('  Alianças CONTRADITÓRIAS (2 rivais aliadas): ' + pct(r.contradictoryDouble, r.N));
  console.log('  Distribuição de estado por facção:');
  for (const id of FACTIONS) {
    const t = r.stateTally[id];
    const top = Object.keys(t).sort((a, b) => t[b] - t[a]).slice(0, 3)
      .map(k => k + ' ' + pct(t[k], r.N)).join(' · ');
    console.log('    ' + NAME[id].padEnd(15) + top);
  }
}

const args = process.argv.slice(2);
const wantCompare = args.includes('--compare');
const wantB5 = args.includes('--b5');
const N = Number(args.find(a => /^\d+$/.test(a))) || 5000;

if (wantCompare) {
  report(simulate(N, false), 'SIMULAÇÃO ANTES (sem modelo B5)');
  report(simulate(N, true), 'SIMULAÇÃO DEPOIS (com teto diplomático B5)');
} else {
  report(simulate(N, wantB5), wantB5 ? 'SIMULAÇÃO DEPOIS (com teto diplomático B5)' : 'SIMULAÇÃO ANTES (sem modelo B5)');
}

section('CONCLUSÃO');
console.log('  ALLY_MIN=' + ALLY_MIN + ' · PACT_MIN=' + PACT_MIN + ' · HOSTIL<' + HOSTILE_MAX + ' · eventos na grade=' + Object.keys(GRID).length);
console.log('  Rivalidades: ÂNCORA↔DESVIADOS · REMANESCENTES↔CONSÓRCIO');
console.log('  (use --compare para ANTES vs DEPOIS; --b5 para o modelo B5)');
