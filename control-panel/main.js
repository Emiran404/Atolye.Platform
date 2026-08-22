const { app, BrowserWindow, ipcMain, shell, dialog, Notification, Tray, Menu, nativeImage } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');
const path = require('path');
const util = require('util');

const execFileAsync = util.promisify(execFile);
const SERVICE = 'atolye-server.service';
const SERVER_PORT = Number(process.env.ATOLYE_PORT || 3002);
const ALLOWED_ACTIONS = new Set(['start', 'stop', 'restart']);
let logProcess = null;
let mainWindow = null;
let tray = null;
let lastReadyState = null;
const AUTOSTART_PATH = path.join(os.homedir(), '.config', 'autostart', 'atolye-control-panel.desktop');

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    title: 'Atolye Platform Control Panel',
    backgroundColor: '#f5f6f8',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow = win;
  win.loadFile('index.html');
  win.webContents.once('did-finish-load', () => startLiveLogs(win));
  win.on('closed', () => { stopLiveLogs(); mainWindow = null; });
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray-icon.svg');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('Atolye Platform Control Panel');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Control Panel’i Aç', click: () => { if (!mainWindow) createWindow(); else { mainWindow.show(); mainWindow.focus(); } } },
    { label: 'Platformu Aç', click: () => shell.openExternal(`http://localhost:${SERVER_PORT}`) },
    { type: 'separator' },
    { label: 'Çıkış', click: () => app.quit() }
  ]));
  tray.on('double-click', () => { if (!mainWindow) createWindow(); else mainWindow.show(); });
}

function stopLiveLogs() {
  if (logProcess) {
    logProcess.kill();
    logProcess = null;
  }
}

function startLiveLogs(win) {
  stopLiveLogs();
  const processHandle = spawn('journalctl', ['-u', SERVICE, '-n', '80', '-f', '--no-pager', '--output=short-iso'], {
    env: { ...process.env, LANG: 'C', LC_ALL: 'C' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  logProcess = processHandle;
  const send = (type, chunk) => {
    if (!win.isDestroyed()) win.webContents.send('panel:live-log', { type, text: chunk.toString() });
  };
  processHandle.stdout.on('data', (chunk) => send('log', chunk));
  processHandle.stderr.on('data', (chunk) => send('error', chunk));
  processHandle.on('error', (error) => send('error', `Canlı günlük başlatılamadı: ${error.message}\n`));
  processHandle.on('close', (code) => {
    if (code && !win.isDestroyed()) send('error', `Canlı günlük akışı durdu (kod ${code}).\n`);
    if (logProcess === processHandle) logProcess = null;
  });
}

async function command(program, args, timeout = 5000) {
  try {
    const { stdout } = await execFileAsync(program, args, {
      timeout,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, LANG: 'C', LC_ALL: 'C' }
    });
    return stdout.trim();
  } catch (error) {
    return error.stdout?.trim() || '';
  }
}

function apiProbe(endpoint = '/api/health') {
  return new Promise((resolve) => {
    const started = Date.now();
    const req = http.get(`http://localhost:${SERVER_PORT}${endpoint}`, { timeout: 1500 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { if (body.length < 65536) body += chunk; });
      res.on('end', () => {
        let details = null;
        try { details = JSON.parse(body); } catch (_) {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, latency: Date.now() - started, details });
      });
    });
    req.on('error', () => resolve({ ok: false, latency: null }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, latency: null }); });
  });
}

function healthProbe() { return apiProbe('/api/health'); }

function networkAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address);
}

function localDatabaseStatus() {
  const candidates = [
    '/opt/atolye-server/server/dist/data/atolye.db',
    '/opt/atolye-server/server/data/atolye.db',
    '/opt/atolye-server/data/atolye.db'
  ];
  const sqlitePath = candidates.find((candidate) => {
    try { return fs.statSync(candidate).size > 0; } catch (_) { return false; }
  });
  return sqlitePath ? { ok: true, type: 'sqlite', label: 'SQLite aktif' } : null;
}

async function diskStatus() {
  const output = await command('df', ['-Pk', '/opt/atolye-server']);
  const fields = output.split('\n').filter(Boolean).at(-1)?.trim().split(/\s+/) || [];
  const total = Number(fields[1] || 0) * 1024;
  const used = Number(fields[2] || 0) * 1024;
  const available = Number(fields[3] || 0) * 1024;
  return { total, used, available, percent: total ? Math.round((used / total) * 100) : 0 };
}

function internetProbe() {
  return new Promise((resolve) => {
    const req = https.get('https://github.com', { timeout: 3000, headers: { 'User-Agent': 'Atolye-Control-Panel' } }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 6000, headers: { 'User-Agent': 'Atolye-Control-Panel' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return resolve(fetchJson(res.headers.location));
      let body = '';
      res.on('data', (chunk) => { if (body.length < 1024 * 1024) body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Zaman aşımı')); });
  });
}

function versionParts(version) {
  return String(version || '0').replace(/^v/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
}

function isNewer(latest, current) {
  const left = versionParts(latest);
  const right = versionParts(current);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return false;
}

async function checkUpdate() {
  const remote = await fetchJson('https://raw.githubusercontent.com/Emiran404/Atolye.Platform/main/package.json');
  const current = app.getVersion();
  return { current, latest: remote.version, available: isNewer(remote.version, current) };
}

function backupEntries() {
  return ['server/data', 'server/dist/data', 'src/uploads_student']
    .filter((entry) => fs.existsSync(path.join('/opt/atolye-server', entry)));
}

async function createBackup() {
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  const result = await dialog.showSaveDialog({
    title: 'Atolye Platform yedeğini kaydet',
    defaultPath: path.join(app.getPath('documents'), `atolye-yedek-${date}.tar.gz`),
    filters: [{ name: 'Atolye yedeği', extensions: ['tar.gz'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const entries = backupEntries();
  if (!entries.length) throw new Error('Yedeklenecek sunucu verisi bulunamadı.');
  const serviceWasActive = (await command('systemctl', ['is-active', SERVICE])) === 'active';
  if (serviceWasActive) {
    await execFileAsync('pkexec', ['systemctl', 'stop', SERVICE], { timeout: 120000 });
  }
  try {
    try {
      await execFileAsync('tar', ['-czf', result.filePath, '-C', '/opt/atolye-server', ...entries], { timeout: 10 * 60 * 1000 });
    } catch (_) {
      await execFileAsync('pkexec', ['tar', '-czf', result.filePath, '-C', '/opt/atolye-server', ...entries], { timeout: 10 * 60 * 1000 });
      await execFileAsync('pkexec', ['chown', `${process.getuid()}:${process.getgid()}`, result.filePath], { timeout: 120000 });
    }
  } finally {
    if (serviceWasActive) {
      await execFileAsync('pkexec', ['systemctl', 'start', SERVICE], { timeout: 120000 });
    }
  }
  return { ok: true, path: result.filePath };
}

async function restoreBackup() {
  const result = await dialog.showOpenDialog({ title: 'Atolye Platform yedeğini seç', properties: ['openFile'], filters: [{ name: 'Atolye yedeği', extensions: ['gz'] }] });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const backupPath = result.filePaths[0];
  const listing = await command('tar', ['-tzf', backupPath], 30000);
  const entries = listing.split('\n').filter(Boolean);
  if (!entries.length || entries.some((entry) => entry.startsWith('/') || entry.includes('..') || (!entry.startsWith('server/data') && !entry.startsWith('server/dist/data') && !entry.startsWith('src/uploads_student')))) {
    throw new Error('Bu dosya geçerli bir Atolye Platform yedeği değil.');
  }
  const confirmation = await dialog.showMessageBox({
    type: 'warning',
    title: 'Yedeği geri yükle',
    message: 'Mevcut Atolye Platform verileri yedekteki verilerle değiştirilecek.',
    detail: 'Sunucu işlem sırasında kısa süreliğine durdurulacaktır. Devam etmek istiyor musunuz?',
    buttons: ['Vazgeç', 'Geri Yükle'],
    defaultId: 0,
    cancelId: 0
  });
  if (confirmation.response !== 1) return { canceled: true };
  await execFileAsync('pkexec', ['systemctl', 'stop', SERVICE], { timeout: 120000 });
  try {
    await execFileAsync('pkexec', ['tar', '-xzf', backupPath, '-C', '/opt/atolye-server'], { timeout: 10 * 60 * 1000 });
  } finally {
    await execFileAsync('pkexec', ['systemctl', 'start', SERVICE], { timeout: 120000 });
  }
  return { ok: true };
}

async function exportDiagnostics() {
  const result = await dialog.showSaveDialog({
    title: 'Tanılama raporunu kaydet',
    defaultPath: path.join(app.getPath('documents'), `atolye-tanilama-${Date.now()}.tar.gz`),
    filters: [{ name: 'Tanılama paketi', extensions: ['tar.gz'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const tempDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'atolye-diagnostics-'));
  try {
    const status = await getStatus();
    fs.writeFileSync(path.join(tempDir, 'system-status.json'), JSON.stringify(status, null, 2));
    fs.writeFileSync(path.join(tempDir, 'service.log'), status.logs);
    fs.writeFileSync(path.join(tempDir, 'README.txt'), 'Bu paket parola ve veritabanı içeriği içermez. Sistem durumu ve servis günlüklerini içerir.\n');
    await execFileAsync('tar', ['-czf', result.filePath, '-C', tempDir, '.'], { timeout: 120000 });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return { ok: true, path: result.filePath };
}

function getAutostart() { return fs.existsSync(AUTOSTART_PATH); }

function setAutostart(enabled) {
  if (!enabled) {
    try { fs.unlinkSync(AUTOSTART_PATH); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return false;
  }
  fs.mkdirSync(path.dirname(AUTOSTART_PATH), { recursive: true });
  const executable = process.execPath.replace(/"/g, '\\"');
  fs.writeFileSync(AUTOSTART_PATH, `[Desktop Entry]\nType=Application\nName=Atolye Platform Control Panel\nExec="${executable}"\nX-GNOME-Autostart-enabled=true\nTerminal=false\n`);
  return true;
}

async function getStatus() {
  const [properties, health, metrics, logs, disk, internet] = await Promise.all([
    command('systemctl', ['show', SERVICE, '--no-page', '--property=ActiveState,SubState,MainPID,ExecMainStartTimestamp,ActiveEnterTimestamp,NRestarts']),
    healthProbe(),
    apiProbe('/api/system/metrics'),
    command('journalctl', ['-u', SERVICE, '-n', '80', '--no-pager', '--output=short-iso'], 8000),
    diskStatus(),
    internetProbe()
  ]);
  const service = Object.fromEntries(properties.split('\n').filter(Boolean).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
  const total = os.totalmem();
  const free = os.freemem();
  const ips = networkAddresses();

  const result = {
    collectedAt: new Date().toISOString(),
    service: {
      active: service.ActiveState === 'active',
      state: service.ActiveState || 'unknown',
      subState: service.SubState || 'unknown',
      pid: Number(service.MainPID || 0),
      startedAt: service.ActiveEnterTimestamp || service.ExecMainStartTimestamp || null,
      restarts: Number(service.NRestarts || 0)
    },
    health,
    database: localDatabaseStatus() || (health.details?.database ? {
      ok: health.details.database.ready === true,
      type: health.details.database.dbType || 'unknown',
      label: health.details.database.ready === true ? 'SQLite aktif' : 'SQLite hazır değil'
    } : health.ok
      ? { ok: true, type: 'unknown', label: 'Sunucu sürümü veritabanı bilgisini paylaşmıyor' }
      : { ok: false, type: 'unknown', label: 'Sunucuya ulaşılamıyor' }),
    serverUptime: health.details?.uptime || 0,
    activeStudents: Number.isFinite(metrics.details?.metrics?.breakdown?.students)
      ? metrics.details.metrics.breakdown.students
      : (Number.isFinite(health.details?.activeStudents) ? health.details.activeStudents : null),
    disk,
    internet,
    system: {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      uptime: os.uptime(),
      load: os.loadavg()[0],
      memoryUsed: total - free,
      memoryTotal: total,
      ips
    },
    urls: ips.map((ip) => `http://${ip}:${SERVER_PORT}`),
    logs: logs || 'Canlı günlük bağlantısı bekleniyor…',
    readiness: {
      ready: service.ActiveState === 'active' && health.ok && Boolean(ips.length) && disk.available > 1024 * 1024 * 1024,
      checks: {
        service: service.ActiveState === 'active',
        api: health.ok,
        network: Boolean(ips.length),
        database: Boolean(localDatabaseStatus() || health.details?.database),
        disk: disk.available > 1024 * 1024 * 1024,
        internet
      }
    }
  };
  if (lastReadyState !== null && lastReadyState !== result.readiness.ready && Notification.isSupported()) {
    new Notification({
      title: 'Atolye Platform',
      body: result.readiness.ready ? 'Sistem yeniden hazır.' : 'Sistem kontrolü gerekli. Control Panel’i açın.'
    }).show();
  }
  if (result.disk.available > 0 && result.disk.available < 1024 * 1024 * 1024 && Notification.isSupported()) {
    new Notification({ title: 'Atolye Platform', body: 'Diskte 1 GB’den az boş alan kaldı.' }).show();
  }
  lastReadyState = result.readiness.ready;
  return result;
}

app.whenReady().then(() => {
  ipcMain.handle('panel:get-status', getStatus);
  ipcMain.handle('panel:service-action', async (_event, action) => {
    if (!ALLOWED_ACTIONS.has(action)) throw new Error('Geçersiz servis işlemi.');
    try {
      await execFileAsync('pkexec', ['systemctl', action, SERVICE], { timeout: 120000 });
      return { ok: true };
    } catch (error) {
      throw new Error(error.code === 126 ? 'İşlem kullanıcı tarafından iptal edildi.' : `Servis işlemi başarısız: ${error.message}`);
    }
  });
  ipcMain.handle('panel:open-platform', async () => {
    await shell.openExternal(`http://localhost:${SERVER_PORT}`);
    return { ok: true };
  });
  ipcMain.handle('panel:create-backup', createBackup);
  ipcMain.handle('panel:restore-backup', restoreBackup);
  ipcMain.handle('panel:export-diagnostics', exportDiagnostics);
  ipcMain.handle('panel:check-update', checkUpdate);
  ipcMain.handle('panel:open-update-page', async () => {
    await shell.openExternal('https://github.com/Emiran404/Atolye.Platform/releases');
    return { ok: true };
  });
  ipcMain.handle('panel:get-autostart', () => getAutostart());
  ipcMain.handle('panel:set-autostart', (_event, enabled) => setAutostart(Boolean(enabled)));
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {});
app.on('before-quit', stopLiveLogs);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
