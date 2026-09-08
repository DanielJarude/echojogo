#!/usr/bin/env node
/* =====================================================================
 * PR14 · B1 — AUDITORIA READ-ONLY DE PRESENÇA DE FACÇÃO
 * ---------------------------------------------------------------------
 * Este script NÃO altera nada. Ele apenas LÊ index.html e reporta o
 * inventário concreto do que existe hoje de facções, afinidade, ofertas,
 * eventos, equipamentos, entidades de arena e pontos de integração do
 * Fracture Director — a base factual do documento PR14_B1_FACTION_PRESENCE_AUDIT.md.
 *
 * Uso:  node audit_pr14/faction_presence_audit.js
 * Saída: relatório textual em stdout (nenhum arquivo é escrito).
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function count(re) { const m = SRC.match(re); return m ? m.length : 0; }
function firstLine(substr) {
  const idx = SRC.indexOf(substr);
  if (idx < 0) return -1;
  return SRC.slice(0, idx).split('\n').length;
}
function section(title) { console.log('\n' + '='.repeat(66) + '\n' + title + '\n' + '='.repeat(66)); }
function row(k, v) { console.log('  ' + String(k).padEnd(40) + ' ' + v); }

section('PR14 · B1 — FACTION PRESENCE AUDIT (READ-ONLY)');
row('index.html', SRC.split('\n').length + ' linhas');
row('pkg version', (JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version));
const echoVerM = SRC.match(/const ECHO_VERSION\s*=\s*'([^']+)'/);
row('ECHO_VERSION (index.html)', echoVerM ? echoVerM[1] : '(não encontrado)');

/* ---------------- 1. FACÇÕES ---------------- */
section('1. FACÇÕES DECLARADAS (FRACTIONS[])');
const facRe = /\{id:'(anchor|remnants|consortium|deviants)',nm:'([^']+)',sym:'([^']+)',col:'([^']+)'/g;
let m; const facs = [];
while ((m = facRe.exec(SRC))) { facs.push({ id: m[1], nm: m[2], sym: m[3], col: m[4] }); }
facs.forEach(f => row(f.sym + ' ' + f.nm, 'id=' + f.id + '  cor=' + f.col));
row('total facções', facs.length + '  (esperado 4)');
row('FACTION_IDS presente', /const FACTION_IDS=\[/.test(SRC) ? 'sim' : 'NÃO');

/* ---------------- 2. ESTADOS DE AFINIDADE ---------------- */
section('2. ESTADOS DE AFINIDADE (FACTION_STATES[])');
const stRe = /\{min:(-?\d+),\s*id:'([a-z]+)',lab:'([^']+)',col:'([^']+)'\}/g;
const states = [];
while ((m = stRe.exec(SRC))) { states.push({ min: +m[1], id: m[2], lab: m[3] }); }
// FACTION_STATES vem antes de FRACTURE_STAGES; filtra os 7 conhecidos
const known = ['aliada', 'favoravel', 'interessada', 'observando', 'neutra', 'desconfiada', 'hostil'];
states.filter(s => known.includes(s.id)).forEach(s => row(s.lab, 'min=' + s.min));
row('estados de facção', states.filter(s => known.includes(s.id)).length + '  (esperado 7)');
row('faixa afinidade', 'clamp -100..+100 (run-scoped)');

/* ---------------- 3. FACTION_GRID ---------------- */
section('3. FACTION_GRID (eventos sistêmicos → deltas)');
const gridBlock = SRC.slice(SRC.indexOf('const FACTION_GRID={'), SRC.indexOf('const FACTION_REASON='));
const gridKeys = (gridBlock.match(/^\s*([a-z_]+)\s*:\{anchor:/gm) || []).map(s => s.trim().split(/\s*:/)[0]);
row('entradas no grid', gridKeys.length);
console.log('  ' + gridKeys.join(', '));

/* ---------------- 4. OFERTAS / SERVIÇOS DE LOJA ---------------- */
section('4. LOJA TEMPORAL — OFERTAS E SERVIÇOS');
const offers = (SRC.match(/\{id:'[a-z_]+',fid:'(anchor|remnants|consortium|deviants)',nm:'[^']+',w:\d+/g) || []);
row('FRAC_OFFERS (transmissões)', offers.length);
offers.forEach(o => {
  const idm = o.match(/id:'([a-z_]+)'/), fm = o.match(/fid:'([a-z]+)'/), nm = o.match(/nm:'([^']+)'/), wm = o.match(/w:(\d+)/);
  row('  ' + idm[1] + ' [' + fm[1] + ']', nm[1] + '  (wave≥' + wm[1] + ')');
});
const servs = (SRC.match(/\{id:'serv_[a-z_]+',nm:'[^']+',price:\d+/g) || []);
row('FRAC_SERVICES (neutros)', servs.length);

/* ---------------- 5. EVENTOS DE FACÇÃO ---------------- */
section('5. EVENTOS DE FACÇÃO NO POOL (beacons)');
const feRe = /\{id:'(fa_[a-z_]+)',kind:'\1',nm:'([^']+)',col:'([^']+)'/g;
const fevs = [];
while ((m = feRe.exec(SRC))) { fevs.push({ id: m[1], nm: m[2] }); }
fevs.forEach(e => row(e.id, e.nm));
row('FACTION_RUN_EVENTS', fevs.length + '  (doc diz 12)');
const contactCount = (SRC.match(/const FRAC_CONTACT_EVENTS=\[/) ) ? 'presente' : 'ausente';
row('FRAC_CONTACT_EVENTS', contactCount);

/* ---------------- 6. EQUIPAMENTOS DE ECHO POR ORIGEM ---------------- */
section('6. ECHO EQUIPMENT (ECHO_EQUIP[]) POR ORIGEM');
['neutral', 'anchor', 'remnants', 'consortium', 'deviants'].forEach(o => {
  row(o, count(new RegExp("origin:'" + o + "'", 'g')) + ' itens');
});

/* ---------------- 7. ENTIDADES DE ARENA ---------------- */
section('7. ENTIDADES DE ARENA (arrays desenhados/atualizados)');
['player', 'echoes', 'enemies', 'projectiles', 'xporbs', 'parts', 'ftexts', 'pickups', 'allies', 'beacon'].forEach(a => {
  const declared = new RegExp('\\b' + a + '\\s*=\\s*(\\[\\]|null)').test(SRC);
  row(a, declared ? 'declarado' : 'ref');
});
row('ENEMY_BUDGET', (SRC.match(/const ENEMY_BUDGET=(\d+)/) || [])[1] || '?');
row('PARTS_MAX', (SRC.match(/PARTS_MAX\s*=\s*(\d+)/) || [])[1] || '?');
row('beacon é proximity-interactive', /dist2\(beacon\.x,beacon\.y,player\.x,player\.y\)<rr\*rr\)openEvent/.test(SRC) ? 'SIM' : 'não');
row('beacon draw default (col por EV_LABEL)', /const b=beacon,col=\(EV_LABEL\[b\.kind\]/.test(SRC) ? 'SIM' : 'não');
row('allies: aliado combatente/torre', /a\.fighter/.test(SRC) && /a\.turret/.test(SRC) ? 'SIM' : 'parcial');

/* ---------------- 8. FRACTURE DIRECTOR HOOKS ---------------- */
section('8. FRACTURE DIRECTOR — TEMAS E HOOKS');
const themeRe = /\{id:'(collapse|siege|hunt|anomaly|resonance|scarcity)',nm:'([^']+)',sym:'([^']+)'/g;
const themes = [];
while ((m = themeRe.exec(SRC))) themes.push(m[2]);
row('FRACTURE_THEMES', themes.length + '  [' + themes.join(', ') + ']');
const evGrid = SRC.slice(SRC.indexOf('const FRACTURE_EVENT_GRID={'), SRC.indexOf('const FRACTURE_EVENT_TYPES='));
const evTypes = (evGrid.match(/^\s*([a-z_]+)\s*:\{i:/gm) || []).map(s => s.trim().split(/\s*:/)[0]);
row('FRACTURE_EVENT_GRID tipos', evTypes.length);
console.log('  ' + evTypes.join(', '));
row('>>> faction_reaction hook', evTypes.includes('faction_reaction') ? 'EXISTE (sem emissor — ver B1-F)' : 'ausente');
['fractureOnWaveStart', 'fractureOnShopOpen', 'fractureBeginRun', 'fractureEndRun', 'fractureEmit', 'fractureOnEventChosen'].forEach(fn => {
  row(fn, new RegExp('function ' + fn + '\\b').test(SRC) ? 'definido' : 'ausente');
});

/* ---------------- 9. SAVE / SM_VERSION ---------------- */
section('9. SAVE / CONTINUE');
row('SM_VERSION', (SRC.match(/const SM_VERSION=(\d+)/) || [])[1] + '  (deve permanecer 3)');
row('FRACTURE_STATE_VERSION', (SRC.match(/const FRACTURE_STATE_VERSION=(\d+)/) || [])[1]);
row('cp.frac (fracRunPack)', /frac:\(typeof fracRunPack==='function'/.test(SRC) ? 'checkpointed' : 'não');
row('cp.fracture (fractureRunPack)', /cp\.fracture=fractureRunPack\(\)/.test(SRC) ? 'checkpointed' : 'não');
row('fracd por slot (discovery)', /out\.fracd=fracDiscClean/.test(SRC) ? 'persistente por slot' : 'não');

/* ---------------- 10. SANDBOX ISOLAMENTO ---------------- */
section('10. SANDBOX — ISOLAMENTO');
row('fracFeedback silenciado', /if\(sandboxMode\|\|sandboxRun\)return;\s*\/\/ laborat/.test(SRC) ? 'sim' : 'ver código');
row('beacon gated no sandbox', /scheduleBeacon\(\);\s*\/\/ gated: sandbox/.test(SRC) ? 'sim' : 'ver código');
row('arena events off no sandbox', /!sandboxRun\)\{[^]*?tickArenaEvent/.test(SRC) ? 'sim' : 'ver código');

/* ---------------- 11. RESUMO ---------------- */
section('RESUMO — CONTAGENS-CHAVE');
row('factionEmit() call sites', count(/factionEmit\(/g));
row('addResidues/spendResidues', count(/addResidues\(/g) + ' / ' + count(/spendResidues\(/g));
row('glifo ⧗ (RESÍDUOS)', count(/⧗/g));
console.log('\n[OK] Auditoria read-only concluída. Nenhum arquivo foi modificado.\n');
