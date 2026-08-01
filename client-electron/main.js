const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { Bonjour } = require('bonjour-service');
const dgram = require('dgram');
const http = require('http');
const path = require('path');
const os = require('os');

let mainWindow;
let splashWindow;
let currentServerUrl = null;
let isDiscoveryFound = false;
const bonjour = new Bonjour();
const BROADCAST_PORT = 41234;
const SERVER_PORT = 3002;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 450,
    transparent: process.platform !== 'linux',
    backgroundColor: '#faf8ff',
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  splashWindow.loadFile('splash.html');
}

function createMainWindow(url) {
  if (mainWindow) {
    mainWindow.loadURL(url);
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: "Atolye Platform",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadURL(url);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log(`⚠️ Yükleme Hatası (${errorCode}): ${errorDescription}`);
    if (errorCode !== -3) {
      mainWindow.loadFile('error.html');
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ═══════════════════════════════════════════════════════════════
// BİRLEŞİK BAĞLANTI
// ═══════════════════════════════════════════════════════════════
function connectToServer(url) {
  if (isDiscoveryFound && mainWindow && !mainWindow.webContents.getURL().includes('error.html')) {
    return;
  }

  console.log(`🚀 [Connect] Bağlanılıyor: ${url}`);
  currentServerUrl = url;
  isDiscoveryFound = true;

  if (!mainWindow) {
    createMainWindow(url);
  } else {
    mainWindow.loadURL(url);
  }

  // Oto Güncelleme Sistemini Başlat
  setupAutoUpdater(url);

  setTimeout(() => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.maximize();
    }
    if (splashWindow) {
      splashWindow.webContents.send('discovery-status', 'BAĞLANDI');
      splashWindow.close();
      splashWindow = null;
    }
  }, 500);
}

// ═══════════════════════════════════════════════════════════════
// HTTP PROBE - Node.js http modülü ile (fetch'ten çok daha güvenilir)
// ═══════════════════════════════════════════════════════════════
function httpProbe(ip, port = SERVER_PORT, timeout = 1200) {
  return new Promise((resolve) => {
    const req = http.get(`http://${ip}:${port}/api/health`, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ═══════════════════════════════════════════════════════════════
// 1. mDNS KEŞİF
// ═══════════════════════════════════════════════════════════════
function startMDNS() {
  console.log('🔍 [mDNS] Tarama başlatılıyor...');
  const browser = bonjour.find({ type: 'atolye' });

  browser.on('up', async (service) => {
    if (isDiscoveryFound) return;
    
    // mDNS servisi bulundu, log gönder
    if (splashWindow) {
      splashWindow.webContents.send('discovery-status', `mDNS: ${service.name}`);
    }

    const addresses = service.addresses || [service.referer?.address].filter(Boolean);
    console.log(`🔍 [mDNS] Servis: ${service.name}, adresler: ${addresses.join(', ')}`);

    // 1. Önce doğrudan adresleri dene
    for (const ip of addresses) {
      if (ip.includes(':')) continue;
      console.log(`🔍 [mDNS] IP kontrol ediliyor: ${ip}`);
      if (await httpProbe(ip, service.port)) {
        console.log(`✅ [mDNS] Doğrulandı: ${ip}`);
        connectToServer(`http://${ip}:${service.port}`);
        return;
      }
    }

    // 2. TXT kaydındaki IP'leri dene (eğer adresler listesinde yoksa)
    if (service.txt?.ips) {
      for (const ip of service.txt.ips.split(',')) {
        if (!ip.includes(':') && !addresses.includes(ip)) {
          console.log(`🔍 [mDNS] TXT IP kontrol ediliyor: ${ip}`);
          if (await httpProbe(ip, service.port)) {
            console.log(`✅ [mDNS] Doğrulandı: ${ip}`);
            connectToServer(`http://${ip}:${service.port}`);
            return;
          }
        }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// 2. UDP BROADCAST DİNLEYİCİ
// ═══════════════════════════════════════════════════════════════
function startUDPListener() {
  try {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('message', async (msg, rinfo) => {
      if (isDiscoveryFound) return;
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'atolye-server-beacon') {
          const serverIp = data.primary || rinfo.address;
          const serverPort = data.port || SERVER_PORT;
          console.log(`📡 [UDP] Beacon alındı: ${serverIp}:${serverPort}`);
          
          if (splashWindow) {
            splashWindow.webContents.send('discovery-status', 'UDP SİNYALİ ALINDI...');
          }

          if (await httpProbe(serverIp, serverPort)) {
            console.log(`✅ [UDP] Sunucu doğrulandı: ${serverIp}`);
            connectToServer(`http://${serverIp}:${serverPort}`);
          }
        }
      } catch (e) { /* parse hatası */ }
    });

    socket.on('error', (err) => {
      console.log(`⚠️ [UDP] Hata: ${err.message}`);
      socket.close();
    });

    socket.bind(BROADCAST_PORT, () => {
      console.log(`📡 [UDP] Dinleyici aktif (port ${BROADCAST_PORT})`);
    });
  } catch (e) {
    console.log(`⚠️ [UDP] Başlatılamadı: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 3. ALT AĞ HTTP TARAMASI
// ═══════════════════════════════════════════════════════════════
function getLocalSubnets() {
  const subnets = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        subnets.push(iface.address.split('.').slice(0, 3).join('.'));
      }
    }
  }
  return [...new Set(subnets)];
}

async function scanSubnet() {
  if (isDiscoveryFound) return;
  const subnets = getLocalSubnets();
  console.log(`🔎 [Subnet] Taranıyor: ${subnets.join(', ')}`);

  if (splashWindow) {
    splashWindow.webContents.send('discovery-status', 'AĞ TARANIYOR...');
  }

  for (const subnet of subnets) {
    if (isDiscoveryFound) return;

    // Öncelikli IP'ler (yaygın sunucu adresleri)
    const priority = [1, 2, 5, 10, 15, 20, 25, 30, 50, 100, 150, 200, 254];
    for (const host of priority) {
      if (isDiscoveryFound) return;
      const ip = `${subnet}.${host}`;
      console.log(`🔎 [Subnet] Deneniyor: ${ip}`);
      if (await httpProbe(ip)) {
        console.log(`✅ [Subnet] BULUNDU: ${ip}`);
        connectToServer(`http://${ip}:${SERVER_PORT}`);
        return;
      }
    }

    // Kalanları 20'şerli gruplar halinde
    const remaining = [];
    for (let i = 1; i <= 254; i++) {
      if (!priority.includes(i)) remaining.push(i);
    }

    for (let i = 0; i < remaining.length; i += 20) {
      if (isDiscoveryFound) return;
      const batch = remaining.slice(i, i + 20);
      const results = await Promise.all(batch.map(h => httpProbe(`${subnet}.${h}`)));
      const foundIdx = results.findIndex(r => r);
      if (foundIdx !== -1) {
        const ip = `${subnet}.${batch[foundIdx]}`;
        console.log(`✅ [Subnet] BULUNDU: ${ip}`);
        connectToServer(`http://${ip}:${SERVER_PORT}`);
        return;
      }
    }
  }

  console.log('⚠️ [Subnet] Tamamlandı, sunucu bulunamadı.');
}

// ═══════════════════════════════════════════════════════════════
// BAŞLATMA
// ═══════════════════════════════════════════════════════════════
function startDiscovery() {
  // Katman 1: mDNS (anında)
  startMDNS();

  // Katman 2: UDP Broadcast Dinleyici (anında)
  startUDPListener();

  // Katman 3: Periyodik localhost + bilinen IP kontrolü (her 3sn)
  setInterval(async () => {
    if (!isDiscoveryFound || (mainWindow && mainWindow.webContents.getURL().includes('error.html'))) {
      if (await httpProbe('localhost')) {
        connectToServer(`http://localhost:${SERVER_PORT}`);
        return;
      }
      if (currentServerUrl) {
        try {
          const u = new URL(currentServerUrl);
          if (await httpProbe(u.hostname, parseInt(u.port) || SERVER_PORT)) {
            connectToServer(currentServerUrl);
          }
        } catch (e) { /* */ }
      }
    }
  }, 3000);

  // Katman 4: Alt ağ taraması (5sn sonra)
  setTimeout(() => {
    if (!isDiscoveryFound) {
      scanSubnet();
    }
  }, 5000);
}

app.whenReady().then(() => {
  createSplash();
  startDiscovery();

  // MANUEL BAĞLANTI IPC (Her zaman aktif)
  ipcMain.on('manual-connect', (event, host) => {
    const url = host.startsWith('http') ? host : `http://${host}:${SERVER_PORT}`;
    console.log(`🔌 Manuel bağlantı: ${url}`);
    connectToServer(url);
  });

  // SINAV GÜVENLİĞİ (ANTI-CHEAT) IPC DINLEYICILERI
  function handleBlurNotification() {
    if (mainWindow) {
      console.warn('⚠️ [Anti-Cheat] Öğrenci odağı kaybetti (Blur)!');
      mainWindow.webContents.send('anti-cheat-blur-detected');
    }
  }

  ipcMain.on('enable-anti-cheat', () => {
    if (mainWindow) {
      mainWindow.setKiosk(true);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      
      // DevTools engelle
      mainWindow.webContents.on('devtools-opened', () => {
        mainWindow.webContents.closeDevTools();
      });
      
      // Odak kaybını dinle
      mainWindow.on('blur', handleBlurNotification);
      console.log('🔒 [Anti-Cheat] Kiosk modu aktif edildi, DevTools kapatıldı.');
    }
  });

  ipcMain.on('disable-anti-cheat', () => {
    if (mainWindow) {
      mainWindow.setKiosk(false);
      mainWindow.setAlwaysOnTop(false);
      mainWindow.webContents.removeAllListeners('devtools-opened');
      mainWindow.off('blur', handleBlurNotification);
      console.log('🔓 [Anti-Cheat] Kiosk modu kapatıldı.');
    }
  });

  // 5sn sonra manuel butonu göster
  setTimeout(() => {
    if (splashWindow && !isDiscoveryFound) {
      splashWindow.webContents.send('show-manual');
    }
  }, 5000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (isDiscoveryFound && currentServerUrl) {
      createMainWindow(currentServerUrl);
    } else {
      createSplash();
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTO UPDATER
// ═══════════════════════════════════════════════════════════════
function setupAutoUpdater(serverUrl) {
  if (process.env.NODE_ENV === 'development') return;

  const updateUrl = `${serverUrl}/updates`;
  console.log(`[Updater] Ayarlanıyor: ${updateUrl}`);
  
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: updateUrl
  });

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Güncellemeler kontrol ediliyor...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[Updater] Güncelleme bulundu: v${info.version}`);
    if (splashWindow) splashWindow.webContents.send('discovery-status', `YENİ SÜRÜM İNDİRİLİYOR (v${info.version})`);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[Updater] Güncelleme yok.');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Hata:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = `Hız: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s`;
    log_message = log_message + ` - İndirilen: ${Math.round(progressObj.percent)}%`;
    console.log(`[Updater] ${log_message}`);
    
    if (splashWindow) {
      splashWindow.webContents.send('discovery-status', `GÜNCELLENİYOR: %${Math.round(progressObj.percent)}`);
    } else if (mainWindow) {
      mainWindow.webContents.send('update-progress', Math.round(progressObj.percent));
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Güncelleme indirildi. Kuruluyor...');
    if (splashWindow) splashWindow.webContents.send('discovery-status', `GÜNCELLEME HAZIR. YENİDEN BAŞLATILIYOR...`);
    
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 2000);
  });

  // Kontrolü başlat
  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    console.error('[Updater] Başlatma Hatası:', err);
  });
}

