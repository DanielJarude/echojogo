/* =====================================================================
   ECHO — Preload
   Ponte mínima e segura entre o processo principal e o jogo.
   Com contextIsolation: true e nodeIntegration: false, esta é a única
   superfície exposta ao renderer. Nada de Node vaza para o Canvas.
   ===================================================================== */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/* Canais permitidos — lista branca explícita */
const INBOUND = [
  'echo:window-blur',
  'echo:window-focus',
  'echo:fullscreen',
  'echo:gpu-status'
];

const api = {
  isElectron: true,
  platform: process.platform,

  /* ---- Tela cheia nativa ---- */
  setFullScreen: (value) => ipcRenderer.invoke('echo:set-fullscreen', !!value),
  toggleFullScreen: () => ipcRenderer.invoke('echo:toggle-fullscreen'),
  isFullScreen: () => ipcRenderer.invoke('echo:is-fullscreen'),

  /* ---- Persistência / saves ---- */
  getUserDataPath: () => ipcRenderer.invoke('echo:get-user-data-path'),
  openSaveFolder: () => ipcRenderer.invoke('echo:open-save-folder'),

  /* ---- App ---- */
  getVersion: () => ipcRenderer.invoke('echo:get-version'),
  confirmQuit: (runActive) => ipcRenderer.invoke('echo:confirm-quit', !!runActive),
  quit: () => ipcRenderer.send('echo:quit'),

  /* ---- Eventos vindos do processo principal ---- */
  on: (channel, listener) => {
    if (!INBOUND.includes(channel) || typeof listener !== 'function') return () => {};
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  }
};

contextBridge.exposeInMainWorld('echoDesktop', Object.freeze(api));
