const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const http = require('http');
const https = require('https');
const { autoUpdater } = require('electron-updater');
const net = require('net');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

const PORT = 3737;
const API_URL = `http://localhost:${PORT}`;

let mainWindow = null;
let isQuittingForUpdate = false;

// ── Logging ───────────────────────────────────────────────────────────
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// ── Wait until Express is listening ──────────────────────────────────
function waitForPort(port, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const try_ = () => {
      const sock = net.connect(port, '127.0.0.1');
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() > deadline) reject(new Error(`Server did not start within ${timeoutMs}ms`));
        else setTimeout(try_, 300);
      });
    };
    try_();
  });
}

// ── Start Express inside Electron's Node.js ───────────────────────────
function startAPIServer() {
  try {
    require(path.join(__dirname, '..', 'dist', 'api.js'));
  } catch (err) {
    log.error('Failed to load API server:', err);
    throw err;
  }
}

// ── Mac version check via GitHub API ─────────────────────────────────
// electron-updater requires code-signing to install on Mac. Instead we
// check GitHub Releases manually and prompt the user to download the DMG.

function fetchLatestGithubRelease() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/suphasin01/fruit/releases/latest',
      headers: { 'User-Agent': `FruitBiz/${app.getVersion()}`, 'Accept': 'application/vnd.github.v3+json' },
      timeout: 10000,
    };
    const req = https.get(options, (res) => {
      if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ version: (data.tag_name || '').replace(/^v/, ''), url: data.html_url });
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function compareVersions(a, b) {
  const parse = v => (v || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  const [am, an, ap] = parse(a);
  const [bm, bn, bp] = parse(b);
  return (am - bm) || (an - bn) || (ap - bp);
}

async function doMacVersionCheck() {
  try {
    const result = await fetchLatestGithubRelease();
    if (!result || !result.version) {
      log.warn('[updater-mac] Could not fetch latest release');
      if (mainWindow) mainWindow.webContents.send('update-not-available');
      return;
    }
    const current = app.getVersion();
    if (compareVersions(result.version, current) > 0) {
      log.info(`[updater-mac] New version available: ${result.version} (current: ${current})`);
      if (mainWindow) mainWindow.webContents.send('update-status', {
        type: 'mac-available', version: result.version, releaseUrl: result.url,
      });
    } else {
      log.info(`[updater-mac] Up to date: ${current}`);
      if (mainWindow) mainWindow.webContents.send('update-not-available');
    }
  } catch (err) {
    log.warn('[updater-mac] Version check failed:', err.message);
    if (mainWindow) mainWindow.webContents.send('update-not-available');
  }
}

// ── Auto-update logic ─────────────────────────────────────────────────
function setupAutoUpdater() {
  if (!app.isPackaged) {
    log.info('[updater] Skipping auto-update in dev mode');
    return;
  }

  if (process.platform === 'darwin') {
    // Mac: use GitHub API check instead of electron-updater (requires signing)
    setTimeout(() => doMacVersionCheck(), 3000);
    setInterval(() => doMacVersionCheck(), 4 * 60 * 60 * 1000);
    return;
  }

  // Windows / Linux: use electron-updater normally
  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[updater] Update available:', info.version);
    if (mainWindow) mainWindow.webContents.send('update-status', { type: 'downloading', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[updater] Already up to date');
    if (mainWindow) mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('error', (err) => {
    log.warn('[updater] Error:', err == null ? '(unknown)' : (err.stack || err.message || String(err)));
    if (isQuittingForUpdate) isQuittingForUpdate = false;
    if (mainWindow) mainWindow.webContents.send('update-status', { type: 'error', message: String(err && err.message || err) });
  });

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent);
    log.info(`[updater] Downloading update: ${pct}%`);
    if (mainWindow) {
      mainWindow.setProgressBar(pct / 100);
      mainWindow.webContents.send('update-progress', { percent: pct });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.setProgressBar(-1);
    log.info('[updater] Update downloaded:', info.version);
    if (mainWindow) mainWindow.webContents.send('update-status', { type: 'ready', version: info.version });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}

// ── Local API helper ──────────────────────────────────────────────────
function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1', port: PORT, path, method,
      headers: { 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) },
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Get App Version IPC ───────────────────────────────────────────────
ipcMain.handle('get-version', () => app.getVersion());

// ── Export Data IPC ───────────────────────────────────────────────────
ipcMain.handle('export-data', async () => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'ส่งออกข้อมูล / Export Data',
    defaultPath: `fruitbiz_backup_${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'FruitBiz Backup', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { success: false, canceled: true };
  try {
    const result = await apiRequest('GET', '/api/export');
    fs.writeFileSync(filePath, JSON.stringify(result.body, null, 2), 'utf8');
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (err) { return { success: false, error: String(err) }; }
});

// ── Import Data IPC ───────────────────────────────────────────────────
ipcMain.handle('import-data', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'นำเข้าข้อมูล / Import Data',
    filters: [{ name: 'FruitBiz Backup', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths?.[0]) return { success: false, canceled: true };
  try {
    const content = fs.readFileSync(filePaths[0], 'utf8');
    const data = JSON.parse(content);
    const result = await apiRequest('POST', '/api/import', data);
    if (result.status !== 200) throw new Error(result.body?.error || 'Import failed');
    return { success: true };
  } catch (err) { return { success: false, error: String(err) }; }
});

// ── Check for Updates IPC ─────────────────────────────────────────────
ipcMain.handle('check-for-updates', () => {
  if (!app.isPackaged) {
    if (mainWindow) mainWindow.webContents.send('update-not-available');
    return;
  }
  if (process.platform === 'darwin') {
    doMacVersionCheck();
    return;
  }
  // Windows/Linux: use electron-updater
  // Note: do NOT send 'update-not-available' in catch — the 'error' event handles it
  autoUpdater.checkForUpdates().catch((err) => {
    log.warn('[updater] checkForUpdates rejected:', err?.message || err);
  });
});

// ── Install Update IPC ────────────────────────────────────────────────
ipcMain.handle('install-update', () => {
  log.info('[updater] install-update requested → quitAndInstall');
  isQuittingForUpdate = true;
  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (err) {
      isQuittingForUpdate = false;
      log.error('[updater] quitAndInstall failed:', err);
      if (mainWindow) mainWindow.webContents.send('update-status', { type: 'error', message: String(err && err.message || err) });
    }
  });
  return { ok: true };
});

// ── Open GitHub Releases page (Mac manual update) ─────────────────────
ipcMain.handle('open-releases-page', () => {
  shell.openExternal('https://github.com/suphasin01/fruit/releases/latest');
});

// ── Quit App IPC ──────────────────────────────────────────────────────
ipcMain.handle('quit-app', () => {
  app.quit();
});

// ── PDF Export IPC ────────────────────────────────────────────────────
ipcMain.handle('export-pdf', async (_event, html, filename) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'บันทึก PDF',
    defaultPath: filename || `document_${Date.now()}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { success: false };

  const tmpFile = path.join(app.getPath('temp'), `lb_pdf_${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf8');

  const pdfWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
  await pdfWin.loadFile(tmpFile);
  const pdfData = await pdfWin.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'custom', top: 0.4, bottom: 0.5, left: 0.3, right: 0.3 } });
  pdfWin.close();
  try { fs.unlinkSync(tmpFile); } catch {}

  fs.writeFileSync(filePath, pdfData);
  shell.openPath(filePath);
  return { success: true, filePath };
});

// ── Main window ───────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'FruitBiz',
    backgroundColor: '#0a0f1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 16 } }
      : {}),
  });

  mainWindow.loadURL(API_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Native menu ───────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' }, { type: 'separator' },
        {
          label: 'ตรวจสอบอัพเดท...',
          click: () => {
            if (app.isPackaged) doMacVersionCheck();
            else dialog.showMessageBox(mainWindow, { message: 'อยู่ใน dev mode — ไม่สามารถตรวจสอบอัพเดทได้', buttons: ['OK'] });
          },
        },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' }, { role: 'zoom' },
        ...(process.platform !== 'darwin' ? [
          { type: 'separator' },
          {
            label: 'ตรวจสอบอัพเดท...',
            click: () => {
              if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {});
            },
          },
        ] : []),
        { role: 'close' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ─────────────────────────────────────────────────────
app.whenReady().then(async () => {
  buildMenu();

  try {
    await waitForPort(PORT, 500);
    log.info('Attaching to existing server on :' + PORT);
  } catch {
    log.info('Starting embedded API server...');
    startAPIServer();
    await waitForPort(PORT, 12000);
    log.info('Server ready on :' + PORT);
  }

  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (isQuittingForUpdate) return;
  if (process.platform !== 'darwin') app.quit();
});
