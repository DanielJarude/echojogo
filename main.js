/* =====================================================================
   ECHO — Processo principal do Electron
   Empacotamento desktop de padrão comercial:
   aceleração de GPU, instância única, persistência blindada de saves,
   janela sem resíduos de navegador e ciclo de vida robusto.
   ===================================================================== */
'use strict';

const { app, BrowserWindow, Menu, shell, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

/* ---------------------------------------------------------------------
   1. IDENTIDADE DO APP + DIRETÓRIO EXPLÍCITO DE DADOS DO USUÁRIO
   Fixamos o userData ANTES de o app ficar pronto. Isso garante que o
   banco do localStorage (os 2 Ecos + Pontos de Memória permanentes)
   viva num caminho estável, imune a limpadores de disco e preservado
   entre atualizações de versão do jogo.
--------------------------------------------------------------------- */
const APP_NAME = 'EchoRoguelite';
app.setName(APP_NAME);

function resolveUserDataDir() {
  // Base por plataforma, sempre fora de pastas temporárias/cache
  let base;
  if (process.platform === 'win32') {
    base = process.env.APPDATA || path.join(app.getPath('home'), 'AppData', 'Roaming');
  } else if (process.platform === 'darwin') {
    base = path.join(app.getPath('home'), 'Library', 'Application Support');
  } else {
    base = process.env.XDG_DATA_HOME || path.join(app.getPath('home'), '.local', 'share');
  }
  return path.join(base, APP_NAME);
}

const USER_DATA_DIR = resolveUserDataDir();
try {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
} catch (err) {
  console.error('[ECHO] Falha ao criar diretório de dados:', err);
}
app.setPath('userData', USER_DATA_DIR);
// Cache e GPU cache em subpastas dedicadas: limpar cache nunca apaga saves
app.setPath('sessionData', path.join(USER_DATA_DIR, 'session'));
try {
  app.setPath('cache', path.join(USER_DATA_DIR, 'cache'));
} catch (_) { /* algumas plataformas não expõem 'cache' — ignorável */ }

/* ---------------------------------------------------------------------
   2. FLAGS DE HARDWARE E PERFORMANCE

   IMPORTANTE: não usar --disable-frame-rate-limit nem --disable-gpu-vsync.
   Juntas, essas flags fazem o requestAnimationFrame rodar sem sincronização
   com o monitor (centenas/milhares de frames por segundo), saturando CPU/GPU
   e causando exatamente o lag severo observado no executável empacotado.

   Também evitamos ignore-gpu-blocklist, hardware-overlays forçado e flags
   experimentais de rasterização: em drivers incompatíveis elas podem causar
   fallback para software, stutter e alto consumo de memória de vídeo.
--------------------------------------------------------------------- */
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// 512 reduz callbacks da thread de áudio sem criar latência perceptível.
app.commandLine.appendSwitch('audio-buffer-size', '512');
// D3D11 é o backend estável do ANGLE no Windows; demais plataformas usam
// o backend padrão escolhido pelo Chromium.
if (process.platform === 'win32') app.commandLine.appendSwitch('use-angle', 'd3d11');

/* ---------------------------------------------------------------------
   3. SINGLE INSTANCE LOCK
   Impede duas instâncias concorrentes escrevendo no mesmo localStorage.
--------------------------------------------------------------------- */
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // O jogador tentou abrir de novo: foca a janela existente
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      mainWindow.flashFrame(true);
      setTimeout(() => { if (mainWindow) mainWindow.flashFrame(false); }, 900);
    }
  });

  app.whenReady().then(createWindow);
}

/* ---------------------------------------------------------------------
   4. JANELA PRINCIPAL
--------------------------------------------------------------------- */
function createWindow() {
  // Remove por completo a barra de menus do Chromium
  Menu.setApplicationMenu(null);

  // Nunca abrir maior que a área útil do monitor
  const workArea = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1280, workArea.width);
  const height = Math.min(720, workArea.height);

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 960,
    minHeight: 540,
    center: true,
    show: false,                       // evita flash de janela vazia
    backgroundColor: '#04070d',        // mesma cor da arena: zero flash branco
    title: 'ECHO — Protocolo de Ressonância Temporal',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    useContentSize: true,
    fullscreenable: true,
    darkTheme: true,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,          // padrão moderno de segurança
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: true,      // poupa CPU/GPU com a janela minimizada
      spellcheck: false,
      devTools: !app.isPackaged,
      enableWebSQL: false,
      v8CacheOptions: 'code'
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Só exibe quando o primeiro frame estiver pronto
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    if (!app.isPackaged) console.log('[ECHO] userData:', app.getPath('userData'));
  });

  // Reforço: nenhuma barra de menu, nem via Alt
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  /* ---- Bloqueio de atalhos reservados na camada nativa ----
     Redundância proposital com o index.html: garante que nem o
     acelerador do Chromium intercepte antes do renderer.            */
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = (input.key || '').toLowerCase();
    const ctrl = input.control || input.meta;

    // Reload acidental descartaria a run em andamento
    if (key === 'f5' || (ctrl && key === 'r')) { event.preventDefault(); return; }
    // Fechamento repentino / busca / impressão / salvar
    if (ctrl && ['w', 'f', 'p', 's', 'o', 'u', 'g', 'j'].includes(key)) {
      event.preventDefault(); return;
    }
    // Zoom por teclado
    if (ctrl && ['+', '-', '=', '0', 'add', 'subtract'].includes(key)) {
      event.preventDefault(); return;
    }
    // DevTools apenas em desenvolvimento
    if ((key === 'f12' || (ctrl && input.shift && ['i', 'c', 'j'].includes(key)))) {
      if (app.isPackaged) { event.preventDefault(); return; }
    }
    // No Electron, F11 / Alt+Enter alternam a tela cheia diretamente na
    // BrowserWindow. Isso evita misturar Fullscreen API do DOM com a janela
    // nativa, uma combinação que fazia o ESC encerrar o fullscreen.
    if (key === 'f11' || (input.alt && key === 'enter')) {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
      return;
    }
    // ESC NÃO pode ser cancelado aqui. preventDefault() em
    // before-input-event impede o keydown de chegar ao renderer e, portanto,
    // quebrava pauseGame(), closeCodex() e o menu de configurações.
  });

  // Zoom travado em 100% — o jogo controla a própria escala via dpr
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(1);
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
    // Informa ao renderer se o Chromium caiu em rasterização por software.
    // O jogo pode então reduzir o buffer interno antes de saturar a CPU.
    const features = app.getGPUFeatureStatus();
    const raster = String(features.rasterization || 'unknown');
    const gpuCompositing = String(features.gpu_compositing || 'unknown');
    const software = /software|disabled|unavailable/i.test(raster) ||
      /software|disabled|unavailable/i.test(gpuCompositing);
    mainWindow.webContents.send('echo:gpu-status', {
      software,
      rasterization: raster,
      compositing: gpuCompositing
    });
  });

  // Links externos abrem no navegador padrão, nunca dentro do jogo
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (url !== current) event.preventDefault();
  });

  // Recuperação silenciosa se o renderer travar
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[ECHO] Renderer encerrado:', details.reason);
    if (details.reason !== 'clean-exit' && mainWindow) mainWindow.reload();
  });
  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[ECHO] Renderer sem resposta — aguardando recuperação.');
  });

  // Notifica o renderer sobre mudanças de estado da janela
  const notify = (channel, value) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, value);
    }
  };
  mainWindow.on('blur', () => notify('echo:window-blur'));
  mainWindow.on('focus', () => notify('echo:window-focus'));
  mainWindow.on('minimize', () => notify('echo:window-blur'));
  mainWindow.on('restore', () => notify('echo:window-focus'));
  mainWindow.on('enter-full-screen', () => notify('echo:fullscreen', true));
  mainWindow.on('leave-full-screen', () => notify('echo:fullscreen', false));

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ---------------------------------------------------------------------
   5. PONTE IPC COM O RENDERER
--------------------------------------------------------------------- */
ipcMain.handle('echo:set-fullscreen', (_e, value) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  mainWindow.setFullScreen(!!value);
  return mainWindow.isFullScreen();
});

ipcMain.handle('echo:toggle-fullscreen', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('echo:is-fullscreen', () =>
  !!mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen());

ipcMain.handle('echo:get-user-data-path', () => app.getPath('userData'));

ipcMain.handle('echo:open-save-folder', () => {
  shell.openPath(app.getPath('userData'));
  return true;
});

ipcMain.handle('echo:get-version', () => app.getVersion());

// Confirmação nativa ao sair com uma run em andamento
ipcMain.handle('echo:confirm-quit', async (_e, runActive) => {
  if (!runActive || !mainWindow) return true;
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Continuar jogando', 'Sair mesmo assim'],
    defaultId: 0,
    cancelId: 0,
    title: 'ECHO — Run em andamento',
    message: 'Uma run está em andamento.',
    detail: 'Sair agora descarta o progresso do ciclo atual. Os Ecos já salvos e os Pontos de Memória permanecem intactos.',
    noLink: true
  });
  return response === 1;
});

ipcMain.on('echo:quit', () => { app.quit(); });

/* ---------------------------------------------------------------------
   6. CICLO DE VIDA
--------------------------------------------------------------------- */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (mainWindow) mainWindow.show();
});

// Nenhuma permissão de navegador é necessária para este jogo
app.on('web-contents-created', (_e, contents) => {
  contents.session.setPermissionRequestHandler((_wc, _perm, callback) => callback(false));
});

process.on('uncaughtException', (err) => {
  console.error('[ECHO] Exceção não tratada no processo principal:', err);
});
