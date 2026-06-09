const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const http = require('http');
const { autoUpdater } = require('electron-updater');
const net = require('net');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

const PORT = 3737;
const API_URL = `http://localhost:${PORT}`;

let mainWindow = null;

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

// ── Start Express inside Electron's Node.js (no external Node needed) ─
function startAPIServer() {
  try {
    require(path.join(__dirname, '..', 'dist', 'api.js'));
  } catch (err) {
    log.error('Failed to load API server:', err);
    throw err;
  }
}

// ── Auto-update logic ─────────────────────────────────────────────────
function setupAutoUpdater() {
  // Skip in development
  if (!app.isPackaged) {
    log.info('[updater] Skipping auto-update in dev mode');
    return;
  }

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[updater] Update available:', info.version);
    // ดาวน์โหลดเงียบๆ ใน background ไม่ขึ้น popup
    if (mainWindow) mainWindow.webContents.send('update-status', { type: 'downloading', version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[updater] Already up to date');
    if (mainWindow) mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('error', (err) => {
    log.warn('[updater] Error (non-critical):', err.message);
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
    // แจ้งใน app แบบ toast เล็กๆ ไม่บล็อค แล้วติดตั้งอัตโนมัติเมื่อปิดโปรแกรม
    if (mainWindow) mainWindow.webContents.send('update-status', { type: 'ready', version: info.version });
    // ติดตั้งอัตโนมัติเมื่อปิดโปรแกรม (autoInstallOnAppQuit = true ครอบคลุมแล้ว)
  });

  // Check 3 seconds after window loads, then every 4 hours
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
  autoUpdater.checkForUpdates().catch(() => {
    if (mainWindow) mainWindow.webContents.send('update-not-available');
  });
});

// ── Install Update IPC ────────────────────────────────────────────────
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
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
            if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {});
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

  // Start server (or attach to existing one in dev)
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
  if (process.platform !== 'darwin') app.quit();
});
