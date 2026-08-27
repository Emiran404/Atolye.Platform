// @ts-nocheck
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getData, setData } from './storage.js';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Kaynakta server/updates, derlenmiş sürümde dist/updates dizinine karşılık gelir.
// server/index.ts de aynı dizini /updates altında yayınlar.
const UPDATES_DIR = path.join(__dirname, '../updates');
const DEFAULT_UPDATES_URL = 'https://github.com/Emiran404/Atolye.Platform/releases/latest/download';
const RELEASES_API_URL = 'https://api.github.com/repos/Emiran404/Atolye.Platform/releases';

export class UpdateManager {
  constructor() {
    this.intervalId = null;
    this.isChecking = false;
    
    // Klasörün var olduğundan emin ol
    if (!fs.existsSync(UPDATES_DIR)) {
      fs.mkdirSync(UPDATES_DIR, { recursive: true });
    }
  }

  getSettings() {
    return getData('settings') || {};
  }

  start() {
    // 12 saatte bir kontrol et
    this.intervalId = setInterval(() => this.checkAndDownload(), 12 * 60 * 60 * 1000);
    // İlk çalıştırmada da kontrol et
    setTimeout(() => this.checkAndDownload(), 10000); // Sunucu başladıktan 10 sn sonra
    console.log('[UpdateManager] Otomatik güncelleme yöneticisi başlatıldı.');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async fetchWithRedirects(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Redirect
          resolve(this.fetchWithRedirects(res.headers.location, headers));
        } else if (res.statusCode === 200) {
          resolve(res);
        } else {
          reject(new Error(`Failed to fetch ${url}, status code: ${res.statusCode}`));
        }
      });
      req.on('error', reject);
    });
  }

  async fetchJson(url) {
    const response = await this.fetchWithRedirects(url, {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Atolye-Platform-UpdateManager'
    });

    return new Promise((resolve, reject) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Güncelleme yanıtı okunamadı: ${error.message}`));
        }
      });
      response.on('error', reject);
    });
  }

  async resolveUpdateSource(settings) {
    const channel = settings.clientUpdateChannel === 'beta' ? 'beta' : 'stable';
    if (channel === 'stable') {
      const baseUrl = settings.clientUpdatesUrl || DEFAULT_UPDATES_URL;
      return {
        channel,
        baseUrl,
        windows: { remoteName: 'latest.yml', localName: 'latest.yml' },
        linux: { remoteName: 'latest-linux.yml', localName: 'latest-linux.yml' },
        mac: { remoteName: 'latest-mac.yml', localName: 'latest-mac.yml' }
      };
    }

    const releases = await this.fetchJson(RELEASES_API_URL);
    const release = Array.isArray(releases)
      ? releases.find(item => item && item.prerelease && !item.draft)
      : null;

    if (!release) throw new Error('Beta kanalında yayın bulunamadı.');

    const assets = Array.isArray(release.assets) ? release.assets : [];
    const windowsAsset = assets.find(asset => /^(beta|latest)\.yml$/i.test(asset.name));
    const linuxAsset = assets.find(asset => /^(beta|latest)-linux\.yml$/i.test(asset.name));
    const macAsset = assets.find(asset => /^(beta|latest)-mac\.yml$/i.test(asset.name));

    return {
      channel,
      baseUrl: `https://github.com/Emiran404/Atolye.Platform/releases/download/${encodeURIComponent(release.tag_name)}`,
      windows: windowsAsset
        ? { remoteName: windowsAsset.name, remoteUrl: windowsAsset.browser_download_url, localName: 'latest.yml' }
        : null,
      linux: linuxAsset
        ? { remoteName: linuxAsset.name, remoteUrl: linuxAsset.browser_download_url, localName: 'latest-linux.yml' }
        : null,
      mac: macAsset
        ? { remoteName: macAsset.name, remoteUrl: macAsset.browser_download_url, localName: 'latest-mac.yml' }
        : null
    };
  }

  async downloadFile(url, destPath) {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await this.fetchWithRedirects(url);
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(true);
        });
        
        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async downloadUpdateFile(baseUrl, descriptor) {
    if (!descriptor) return false;
    const { remoteName, remoteUrl, localName } = descriptor;
    const tempYmlPath = path.join(UPDATES_DIR, `${localName}.temp`);
    try {
      await this.downloadFile(remoteUrl || `${baseUrl}/${remoteName}`, tempYmlPath);
    } catch (err) {
      console.log(`[UpdateManager] Hedefte ${remoteName} bulunamadı.`);
      return false;
    }

    const localYmlPath = path.join(UPDATES_DIR, localName);
    let shouldUpdate = true;

    const newYmlContent = fs.readFileSync(tempYmlPath, 'utf8');
    
    if (fs.existsSync(localYmlPath)) {
      const localYmlContent = fs.readFileSync(localYmlPath, 'utf8');
      
      const newVersionMatch = newYmlContent.match(/version: (.*)/);
      const localVersionMatch = localYmlContent.match(/version: (.*)/);

      if (newVersionMatch && localVersionMatch && newVersionMatch[1] === localVersionMatch[1]) {
        shouldUpdate = false;
      }
    }

    if (!shouldUpdate) {
      console.log(`[UpdateManager] Sistemdeki ${localName} versiyonu zaten en günceli.`);
      fs.unlinkSync(tempYmlPath);
      return false;
    }

    const pathMatch = newYmlContent.match(/path: (.*)/);
    if (pathMatch && pathMatch[1]) {
      const fileName = pathMatch[1].trim().replace(/^['"]|['"]$/g, '');
      if (!fileName || path.basename(fileName) !== fileName) {
        fs.unlinkSync(tempYmlPath);
        console.error(`[UpdateManager] Güvenli olmayan paket adı reddedildi: ${fileName}`);
        return false;
      }
      const destFilePath = path.join(UPDATES_DIR, fileName);

      console.log(`[UpdateManager] Yeni versiyon indiriliyor: ${fileName}`);
      
      try {
        // İlk olarak yml dosyasındaki orijinal path ile dene
        await this.downloadFile(`${baseUrl}/${fileName}`, destFilePath);
      } catch (err) {
        if (err.message.includes('404')) {
          // GitHub Actions 'softprops/action-gh-release' boşlukları noktaya çevirir. 
          // Orijinalinde boşluk varsa noktalı halini dene.
          const dotFileName = fileName.replace(/ /g, '.');
          if (dotFileName !== fileName) {
            console.log(`[UpdateManager] 404 alındı, noktalı isimle deneniyor: ${dotFileName}`);
            try {
              await this.downloadFile(`${baseUrl}/${dotFileName}`, destFilePath);
            } catch (fallbackErr) {
              console.error(`[UpdateManager] Noktalı sürüm de indirilemedi: ${fallbackErr.message}`);
              fs.unlinkSync(tempYmlPath);
              return false;
            }
          } else {
            console.error(`[UpdateManager] İndirme başarısız: ${err.message}`);
            fs.unlinkSync(tempYmlPath);
            return false;
          }
        } else {
          console.error(`[UpdateManager] İndirme başarısız: ${err.message}`);
          fs.unlinkSync(tempYmlPath);
          return false;
        }
      }
      
      fs.renameSync(tempYmlPath, localYmlPath);
      
      // Eski kurulum dosyalarını temizle (sadece yeni indirilen hariç)
      try {
        const files = fs.readdirSync(UPDATES_DIR);
        for (const file of files) {
          if (file !== fileName) {
            // Sadece aynı platformun eski dosyalarını sil
            if (localName === 'latest.yml' && file.endsWith('.exe')) {
              fs.unlinkSync(path.join(UPDATES_DIR, file));
            } else if (localName === 'latest-linux.yml' && file.endsWith('.deb')) {
              fs.unlinkSync(path.join(UPDATES_DIR, file));
            } else if (localName === 'latest-mac.yml' && file.endsWith('.zip')) {
              fs.unlinkSync(path.join(UPDATES_DIR, file));
            }
          }
        }
      } catch (cleanupErr) {
        console.error(`[UpdateManager] Temizlik sırasında hata: ${cleanupErr.message}`);
      }

      console.log(`[UpdateManager] ${fileName} indirme tamamlandı ve yayına alındı.`);
      
      // Güncelleme geçmişine kaydet
      try {
        const ymlContentStr = fs.readFileSync(localYmlPath, 'utf-8');
        const versionMatch = ymlContentStr.match(/version:\s*([^\s]+)/);
        const version = versionMatch ? versionMatch[1] : 'Bilinmeyen';
        
        const currentUpdates = getData('updates') || [];
        // Eğer aynı versiyon daha önce aynı isimle kaydedildiyse tekrar eklemeyelim
        const alreadyExists = currentUpdates.find(u => u.version === version && u.details.includes(fileName));
        if (!alreadyExists) {
          const newUpdate = {
            id: Date.now().toString() + Math.floor(Math.random() * 1000),
            version: version,
            type: 'client',
            status: 'success',
            date: new Date().toISOString(),
            details: `${fileName} (İstemci Güncellemesi) başarıyla indirildi ve ağa sunuldu.`
          };
          setData('updates', [...currentUpdates, newUpdate]);
        }
      } catch (historyErr) {
        console.error(`[UpdateManager] Güncelleme geçmişi kaydedilemedi:`, historyErr);
      }

      return true;
    } else {
      fs.unlinkSync(tempYmlPath);
      console.log(`[UpdateManager] ${remoteName} okunamadı (path bulunamadı).`);
      return false;
    }
  }

  async checkAndDownload() {
    if (this.isChecking) return { success: false, message: 'Zaten kontrol ediliyor.' };
    this.isChecking = true;

    try {
      const settings = this.getSettings();
      if (settings.autoDownloadClientUpdates === false) {
        this.isChecking = false;
        return { success: false, message: 'Otomatik güncelleme indirme kapalı.' };
      }

      const source = await this.resolveUpdateSource(settings);
      
      console.log(`[UpdateManager] ${source.channel} kanalında güncellemeler kontrol ediliyor... (${source.baseUrl})`);

      const winUpdated = await this.downloadUpdateFile(source.baseUrl, source.windows);
      const linuxUpdated = await this.downloadUpdateFile(source.baseUrl, source.linux);
      const macUpdated = await this.downloadUpdateFile(source.baseUrl, source.mac);

      this.isChecking = false;

      if (winUpdated || linuxUpdated || macUpdated) {
        return { success: true, message: `Yeni sürüm indirildi (${source.channel} kanalı).`, updated: true };
      } else {
        return { success: false, message: 'Yeni sürüm bulunamadı veya sisteminiz zaten güncel.', updated: false };
      }

    } catch (err) {
      console.error('[UpdateManager] Hata:', err);
      this.isChecking = false;
      return { success: false, message: 'İndirme sırasında hata oluştu: ' + err.message };
    }
  }
}

export const updateManager = new UpdateManager();
