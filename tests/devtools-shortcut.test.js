'use strict';
/* =====================================================================
   TESTES — DEV-FIX · Ctrl+Shift+I abre DevTools SOMENTE em DEV MODE
   ---------------------------------------------------------------------
   A lógica vive no processo PRINCIPAL do Electron (main.js), que não roda
   no harness Node do renderer. Por isso este teste combina:

     1) ANÁLISE ESTÁTICA de main.js/preload.js (contratos e segurança);
     2) SIMULAÇÃO FUNCIONAL fiel da regra do before-input-event e do
        handler IPC 'echo:dev-mode' (um modelo reproduzido a partir do
        código real, para provar o comportamento toggle e as travas);
     3) VERIFICAÇÃO NO RENDERER (index.html real) de que devEnable/
        devDisable notificam o desktop e de que nada de gameplay muda.

   Cobre os 16 requisitos do FIX. Rodar: node tests/devtools-shortcut.test.js
   ===================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const ROOT = path.join(__dirname, '..');
const mainJs = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const preloadJs = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');
const {readGameSource,runGameSource}=require('./harness/load-game');
const rawSrc = readGameSource();

let passed = 0, failed = 0;
function ok(label, fn) {
  try { fn(); passed++; console.log('  \u2714 ' + label); }
  catch (e) { failed++; console.log('  \u2718 ' + label + '\n    ' + (e && e.message || e)); }
}

console.log('\nDEV-FIX — Ctrl+Shift+I (DevTools) somente em DEV MODE');
console.log('---------------------------------------------');

/* =====================================================================
   MODELO FUNCIONAL — reproduz FIELMENTE a regra do main.js
   ---------------------------------------------------------------------
   Um "webContents" e uma "janela" fajutos, com o mesmo before-input-event
   e o mesmo handler IPC do código real. Provamos o comportamento aqui e,
   nos testes de análise estática, provamos que o main.js contém EXATAMENTE
   essa lógica (para o modelo não divergir do código enviado).
   ===================================================================== */
function makeMainModel(isPackaged) {
  const wc = {
    _open: false,
    _destroyed: false,
    isDevToolsOpened() { return this._open; },
    toggleDevTools() { this._open = !this._open; },
    openDevTools() { this._open = true; },
    closeDevTools() { this._open = false; }
  };
  const win = { isDestroyed() { return wc._destroyed; }, webContents: wc };
  const state = { devModeActive: false };

  /* IPC: renderer → main (canal 'echo:dev-mode') */
  function onDevMode(active) {
    state.devModeActive = !isPackaged && !!active;
    if (!state.devModeActive && win && !win.isDestroyed()) {
      if (wc.isDevToolsOpened()) wc.closeDevTools();
    }
  }

  /* before-input-event: só a parte de DevTools */
  function onInput(input) {
    if (input.type !== 'keyDown') return;
    const key = (input.key || '').toLowerCase();
    const ctrl = input.control || input.meta;
    let prevented = false;
    const event = { preventDefault() { prevented = true; } };
    if ((key === 'f12' || (ctrl && input.shift && ['i', 'c', 'j'].includes(key)))) {
      if (isPackaged) { event.preventDefault(); return { prevented }; }
      if (ctrl && input.shift && key === 'i') {
        event.preventDefault();
        if (state.devModeActive && win && !win.isDestroyed()) {
          win.webContents.toggleDevTools();
        }
        return { prevented };
      }
    }
    return { prevented };
  }

  return { wc, win, state, onDevMode, onInput };
}
const CSI = { type: 'keyDown', key: 'I', control: true, shift: true };   // Ctrl+Shift+I
const F12 = { type: 'keyDown', key: 'F12', control: false, shift: false };

/* ===================================================================
   1–5. COMPORTAMENTO FUNCIONAL (dev)
   =================================================================== */
ok('1. Ctrl+Shift+I é reconhecido (preventDefault) em desenvolvimento', () => {
  const m = makeMainModel(false);
  const r = m.onInput(CSI);
  assert.strictEqual(r.prevented, true, 'o atalho é consumido');
});

ok('2. DEV desligado → Ctrl+Shift+I NÃO abre DevTools', () => {
  const m = makeMainModel(false);
  m.onInput(CSI);
  assert.strictEqual(m.wc.isDevToolsOpened(), false);
});

ok('3. DEV ligado → Ctrl+Shift+I ABRE DevTools', () => {
  const m = makeMainModel(false);
  m.onDevMode(true);
  m.onInput(CSI);
  assert.strictEqual(m.wc.isDevToolsOpened(), true);
});

ok('4. DEV ligado + aberto → Ctrl+Shift+I FECHA (toggle)', () => {
  const m = makeMainModel(false);
  m.onDevMode(true);
  m.onInput(CSI); assert.strictEqual(m.wc.isDevToolsOpened(), true);
  m.onInput(CSI); assert.strictEqual(m.wc.isDevToolsOpened(), false);
  m.onInput(CSI); assert.strictEqual(m.wc.isDevToolsOpened(), true);
});

ok('5. Sair do DEV (echo:dev-mode false) fecha o DevTools aberto', () => {
  const m = makeMainModel(false);
  m.onDevMode(true);
  m.onInput(CSI); assert.strictEqual(m.wc.isDevToolsOpened(), true);
  m.onDevMode(false);
  assert.strictEqual(m.state.devModeActive, false);
  assert.strictEqual(m.wc.isDevToolsOpened(), false, 'DevTools é fechado ao sair do DEV');
});

/* ===================================================================
   6. Ctrl+Shift+D (renderer) — preservado
   =================================================================== */
ok('6. Ctrl+Shift+D continua sendo o gatilho do DEV MODE (renderer)', () => {
  /* AUDIT-FIX-E2B: antes eram duas regexes sobre a fonte. Agora a tecla é
     DISPARADA no listener real e o efeito é observado — e as variações sem
     o modificador certo provam que o gatilho é exatamente esse. */
  const t = bootRenderer();
  assert.strictEqual(t.isDevMode(), false, 'começa desligado');
  t._press('KeyD', { ctrlKey: true, shiftKey: true });
  assert.strictEqual(t.isDevMode(), true, 'Ctrl+Shift+D não ligou o DEV MODE');
  t._press('KeyD', { ctrlKey: true, shiftKey: true });
  assert.strictEqual(t.isDevMode(), false, 'Ctrl+Shift+D não desliga (toggle)');
  for (const mods of [{ ctrlKey: true }, { shiftKey: true }, {}])
    { t._press('KeyD', mods); assert.strictEqual(t.isDevMode(), false, 'atalho disparou sem Ctrl+Shift'); }
  t._press('KeyE', { ctrlKey: true, shiftKey: true });
  assert.strictEqual(t.isDevMode(), false, 'outra tecla não pode ligar o DEV MODE');
});

/* ===================================================================
   7–9. PAINEL DEV / HELPERS / B5 — intactos
   =================================================================== */
ok('7. Painel DEV e seus comandos continuam presentes', () => {
  /* AUDIT-FIX-E2B: os símbolos são consultados no GLOBAL do jogo em vez de
     procurados no texto — um comentário citando o nome deixa de contar como
     "presente", e uma função renomeada deixa de passar despercebida. */
  const t = bootRenderer();
  const X = code => vm.runInContext(code, t._ctx);
  for (const fn of ['devOpenPanel', 'devCommand'])
    assert.strictEqual(X('typeof ' + fn), 'function', fn + ' ausente');
  /* o comando de presença física B3 continua sendo aceito pelo painel */
  t.devEnable();
  assert.doesNotThrow(() => X('devCommand')('fp:force:anchor'),
    'devCommand recusou fp:force:anchor');
  t.devDisable();
});
ok('8. Helpers DEV continuam presentes (namespace DEV)', () => {
  const t = bootRenderer();
  const DEV = vm.runInContext('DEV', t._ctx);
  assert.ok(DEV && typeof DEV === 'object', 'namespace DEV ausente');
  assert.strictEqual(typeof DEV.forceFactionPresence, 'function',
    'DEV.forceFactionPresence ausente');
});
ok('9. Helpers de diplomacia B5 continuam presentes', () => {
  const t = bootRenderer();
  const DEV = vm.runInContext('DEV', t._ctx);
  for (const h of ['diploScenario', 'factionDiplomacy', 'setFactionAffinity',
    'forceFactionAlliance', 'breakFactionAlliance'])
    assert.strictEqual(typeof DEV[h], 'function', 'helper DEV.' + h + ' ausente');
});

/* ===================================================================
   10. RELEASE — não ganha acesso pelo novo atalho
   =================================================================== */
ok('10. Release: Ctrl+Shift+I nunca abre DevTools (mesmo com dev-mode)', () => {
  const m = makeMainModel(true);   // app.isPackaged = true
  m.onDevMode(true);               // ainda que o renderer mandasse…
  assert.strictEqual(m.state.devModeActive, false, 'espelho fica false em release');
  m.onInput(CSI);
  assert.strictEqual(m.wc.isDevToolsOpened(), false, 'DevTools bloqueado em release');
});
ok('10b. Release: F12 é bloqueado (preventDefault) como antes', () => {
  const m = makeMainModel(true);
  const r = m.onInput(F12);
  assert.strictEqual(r.prevented, true);
});

/* ===================================================================
   11–13. SEGURANÇA ELECTRON — nada afrouxado
   =================================================================== */
ok('11. nodeIntegration permanece false', () => {
  assert(/nodeIntegration:\s*false/.test(mainJs), 'nodeIntegration NÃO pode ser true');
  assert(!/nodeIntegration:\s*true/.test(mainJs));
});
ok('12. contextIsolation permanece true', () => {
  assert(/contextIsolation:\s*true/.test(mainJs));
  assert(!/contextIsolation:\s*false/.test(mainJs));
});
ok('13. preload mantém superfície mínima (contextBridge, sem expor Node)', () => {
  assert(/contextBridge\.exposeInMainWorld\('echoDesktop'/.test(preloadJs));
  assert(!/exposeInMainWorld\([^)]*require/.test(preloadJs), 'não expõe require');
  /* o novo canal outbound é apenas um send de booleano */
  assert(/setDevMode:\s*\(active\)\s*=>\s*ipcRenderer\.send\('echo:dev-mode',\s*!!active\)/.test(preloadJs),
    'setDevMode envia só um booleano por canal fixo');
});

/* ===================================================================
   14–16. main.js CONTÉM A LÓGICA REAL (modelo não diverge do código)
   =================================================================== */
ok('14. main.js: devTools = !app.isPackaged (bloqueado em release)', () => {
  assert(/devTools:\s*!app\.isPackaged/.test(mainJs));
});
ok('15. main.js: espelho devModeActive reforçado por !app.isPackaged', () => {
  assert(/let devModeActive = false;/.test(mainJs), 'espelho inicia false');
  assert(/ipcMain\.on\('echo:dev-mode'/.test(mainJs), 'handler IPC presente');
  assert(/devModeActive = !app\.isPackaged && !!active/.test(mainJs),
    'espelho depende de !app.isPackaged');
});
ok('16. main.js: Ctrl+Shift+I faz toggleDevTools só com devModeActive', () => {
  assert(/toggleDevTools\(\)/.test(mainJs), 'usa toggleDevTools (API validada p/ Electron 31)');
  assert(/if \(app\.isPackaged\) \{ event\.preventDefault\(\); return; \}/.test(mainJs),
    'release bloqueado dentro do bloco de DevTools');
  assert(/if \(devModeActive && mainWindow && !mainWindow\.isDestroyed\(\)\)/.test(mainJs),
    'toggle condicionado ao DEV MODE');
  /* ao sair do DEV, fecha o DevTools */
  assert(/isDevToolsOpened\(\)\) \{\s*mainWindow\.webContents\.closeDevTools\(\);/.test(mainJs),
    'fecha DevTools ao desativar o DEV');
});

/* ===================================================================
   17–20. RENDERER — integração e NÃO-REGRESSÃO
   =================================================================== */
/* harness DOM mínimo para executar o script real do index.html */
function makeStyle() { const s = {}; return new Proxy(s, { get(t, k) { return k in t ? t[k] : ''; }, set(t, k, v) { t[k] = String(v); return true; } }); }
function ctx2d() { const g = { addColorStop() {} }; return new Proxy({}, { get(t, k) { if (k === 'canvas') return { width: 0, height: 0 }; if (k === 'measureText') return () => ({ width: 0 }); if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) }); if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => g; return () => {}; }, set() { return true; } }); }
function makeEl(id) {
  const el = { id: id || '', children: [], dataset: {}, value: '', width: 0, height: 0, _cls: new Set(), isConnected: true, offsetWidth: 0, offsetHeight: 0, textContent: '', innerHTML: '', className: '', title: '', style: makeStyle() };
  el.classList = { add: (...c) => c.forEach(x => el._cls.add(x)), remove: (...c) => c.forEach(x => el._cls.delete(x)), contains: c => el._cls.has(c), toggle: (c, f) => { if (f === undefined) { if (el._cls.has(c)) { el._cls.delete(c); return false; } el._cls.add(c); return true; } if (f) el._cls.add(c); else el._cls.delete(c); return !!f; } };
  el.appendChild = c => { el.children.push(c); return c; };
  el.remove = () => {}; el.addEventListener = () => {}; el.removeEventListener = () => {};
  el.querySelector = () => null; el.querySelectorAll = () => []; el.closest = () => null; el.focus = () => {}; el.blur = () => {};
  el.setAttribute = (k, v) => { el.dataset[k] = v; }; el.getAttribute = k => el.dataset[k]; el.getContext = () => ctx2d();
  return el;
}
/* AUDIT-FIX-E2B: `opts.semDesktop` boota sem window.echoDesktop (para provar
   que a ponte é tolerante) e os listeners de teclado passam a ser CAPTURADOS,
   para que o atalho possa ser disparado de verdade em vez de procurado no
   texto da fonte. */
function bootRenderer(opts) {
  opts = opts || {};
  const elements = new Map();
  const keyHandlers = [];
  const document = { hidden: false, title: '', body: makeEl('body'), documentElement: makeEl('html'), fullscreenElement: null, webkitFullscreenElement: null, createElement: () => makeEl(''), getElementById: id => { if (!elements.has(id)) elements.set(id, makeEl(id)); return elements.get(id); }, querySelectorAll: () => [], addEventListener: (ev, fn) => { if (ev === 'keydown' && typeof fn === 'function') keyHandlers.push(fn); }, removeEventListener: () => {}, hasFocus: () => true, exitFullscreen: () => Promise.resolve() };
  const sent = [];   // captura echoDesktop.setDevMode
  const window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, screen: { availWidth: 1280, availHeight: 720 }, addEventListener: (ev, fn) => { if (ev === 'keydown' && typeof fn === 'function') keyHandlers.push(fn); }, removeEventListener: () => {}, matchMedia: () => ({ addEventListener: () => {}, addListener: () => {} }), AudioContext: undefined, webkitAudioContext: undefined, open: () => ({ close() {} }), getGamepads: () => [], location: { search: '', hash: '' }, echoDesktop: opts.semDesktop ? undefined : { isElectron: true, channel: 'dev', isDev: true, platform: 'linux', on: () => () => {}, setDevMode: (v) => { sent.push(!!v); } } };
  const localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
  const navigator = { getGamepads: () => [] };
  const EXP = ';globalThis.__t={devEnable,devDisable,devToggle,' +
    'isDevMode:()=>DEV_MODE,isTainted:()=>devTainted,getState:()=>state};';
  const sandbox = { console: { log() {}, warn() {}, error() {} }, Math, Date, parseInt, parseFloat, isNaN, setTimeout, clearTimeout, requestAnimationFrame: () => 0, Uint8ClampedArray, Array, Object, Number, String, Boolean, RegExp, Error, Map, Set, Promise, Proxy, Reflect, JSON, Symbol, isFinite, document, window, localStorage, navigator, performance: { now: () => Date.now() } };
  const ctx = vm.createContext(sandbox);
  runGameSource(rawSrc + EXP, ctx, { timeout: 20000 });
  const t = vm.runInContext('__t', ctx);
  t._sent = sent;
  t._ctx = ctx;
  t._press = (code, mods) => {
    const ev = Object.assign({ code, key: '', ctrlKey: false, shiftKey: false, altKey: false,
      metaKey: false, repeat: false, target: document.body,
      preventDefault() {}, stopPropagation() {} }, mods || {});
    for (const fn of keyHandlers.slice()) fn(ev);
    return ev;
  };
  return t;
}

ok('17. Renderer: devEnable() notifica o desktop (setDevMode(true))', () => {
  const t = bootRenderer();
  t.devEnable();
  assert.strictEqual(t.isDevMode(), true);
  assert.deepStrictEqual(t._sent, [true], 'enviou exatamente [true]');
});
ok('18. Renderer: devDisable() notifica o desktop (setDevMode(false))', () => {
  const t = bootRenderer();
  t.devEnable(); t.devDisable();
  assert.strictEqual(t.isDevMode(), false);
  assert.deepStrictEqual(t._sent, [true, false]);
});
ok('19. Renderer: função de ponte é tolerante (sem echoDesktop = no-op)', () => {
  /* AUDIT-FIX-E2B: em vez de procurar a guarda no texto, o jogo é bootado SEM
     window.echoDesktop e o DEV é ligado/desligado de verdade. */
  const t = bootRenderer({ semDesktop: true });
  assert.strictEqual(vm.runInContext('typeof devNotifyDesktopDevMode', t._ctx), 'function',
    'ponte ausente');
  assert.doesNotThrow(() => { t.devEnable(); t.devDisable(); },
    'sem echoDesktop a ponte precisa ser no-op, não exceção');
  assert.strictEqual(t.isDevMode(), false);
  assert.deepStrictEqual(t._sent, [], 'nada foi enviado ao desktop inexistente');
  /* e com um echoDesktop SEM setDevMode também não pode quebrar */
  const t2 = bootRenderer();
  delete vm.runInContext('window', t2._ctx).echoDesktop.setDevMode;
  assert.doesNotThrow(() => { t2.devEnable(); t2.devDisable(); },
    'API incompleta precisa ser tolerada');
});
ok('20. Versões e save intactos (nenhuma alteração de versão/save)', () => {
  /* AUDIT-FIX-E2B: as versões são LIDAS do jogo em vez de casadas por regex
     na fonte, e "sair do DEV não lava a run" deixa de ser a presença de um
     comentário para virar o comportamento observado da flag. */
  const t = bootRenderer();
  const X = code => vm.runInContext(code, t._ctx);
  assert.strictEqual(X('ECHO_VERSION'), '0.9.0-alpha', 'ECHO_VERSION');
  assert.strictEqual(X('SM_VERSION'), 3, 'SM_VERSION');
  assert.strictEqual(X('FRACTURE_STATE_VERSION'), 1, 'FRACTURE_STATE_VERSION');
  assert.strictEqual(t.isTainted(), false, 'devTainted nasce desligado');
  X('state="play"');                       // ligar o DEV no MEIO da run contamina
  t.devEnable();
  assert.strictEqual(t.isTainted(), true, 'entrar no DEV no meio da run contamina');
  t.devDisable();
  assert.strictEqual(t.isTainted(), true, 'sair do DEV não pode lavar a run');
});

console.log('\n---------------------------------------------');
console.log('Resultado: ' + passed + ' passaram · ' + failed + ' falharam');
if (failed) { console.log('DEV-FIX — HÁ TESTES FALHANDO'); process.exit(1); }
