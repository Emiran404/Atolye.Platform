// @ts-nocheck
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = join(__dirname, '../data');

let db = null;
let useFallback = true; // Varsayılan olarak JSON modunda başlatılır
let sqliteDriver = null;

// Node.js SQLite native sürücüsünü yüklemeyi dene
try {
  const { DatabaseSync } = await import('node:sqlite');
  sqliteDriver = DatabaseSync;
} catch (error) {
  console.warn('⚠️ [Veritabanı Uyarısı] SQLite native modülü (node:sqlite) yüklenemedi. Sadece JSON depolama modu kullanılabilir.');
}

// SQLite bağlantısını kuran yardımcı fonksiyon
const initializeSqliteConnection = () => {
  if (!sqliteDriver) return false;
  try {
    const dbName = process.env.NODE_ENV === 'test' ? 'atolye_test.db' : 'atolye.db';
    const dbPath = join(dataPath, dbName);
    db = new sqliteDriver(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    return true;
  } catch (err) {
    console.error('SQLite bağlantısı başlatılamadı:', err.message);
    db = null;
    return false;
  }
};

// JSON dosyalarından veri oku (Fallback için)
function getJsonData(key) {
  const keyName = process.env.NODE_ENV === 'test' ? `${key}_test` : key;
  const filePath = join(dataPath, `${keyName}.json`);
  try {
    if (fs.existsSync(filePath)) {
      let data = fs.readFileSync(filePath, 'utf8');
      if (data.charCodeAt(0) === 0xFEFF) {
        data = data.slice(1);
      }
      return JSON.parse(data.trim());
    }
    return null;
  } catch (error) {
    console.error(`Error reading JSON ${key}:`, error);
    return null;
  }
}

// JSON dosyalarına atomik veri yaz (Sadece fallback durumunda kullanılır)
function setJsonData(key, data) {
  const keyName = process.env.NODE_ENV === 'test' ? `${key}_test` : key;
  const filePath = join(dataPath, `${keyName}.json`);
  const tmpPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (error) {
    console.error(`Error writing JSON ${key}:`, error);
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
    return false;
  }
}

// Başlangıçta göç (migration) yapılıp yapılmadığını kontrol et
let dbMigrated = false;

// Sadece JSON ayarlarından kontrol et. Fresh kurulumda settings.json henüz
// oluşmadığı veya dbMigrated=true olmadığı için otomatik olarak JSON modunda başlayacaktır.
const settingsJson = getJsonData('settings');
if (settingsJson && settingsJson.dbMigrated === true) {
  dbMigrated = true;
}

// Göç durumuna göre modu seç
if (dbMigrated) {
  const success = initializeSqliteConnection();
  if (success) {
    useFallback = false;
    console.log('💾 SQLite veritabanı aktif edildi (Göç tamamlanmış): atolye.db');
    
    // Temizlik: Kalan JSON dosyaları varsa sil (settings.json hariç)
    try {
      const keys = ['classes', 'exams', 'notifications', 'reports', 'schedules', 'settings', 'students', 'submissions', 'teachers', 'updates'];
      keys.forEach(key => {
        if (key === 'settings') return; // settings.json dosyasını silmiyoruz
        const keyName = process.env.NODE_ENV === 'test' ? `${key}_test` : key;
        const jsonFilePath = join(dataPath, `${keyName}.json`);
        if (fs.existsSync(jsonFilePath)) {
          fs.unlinkSync(jsonFilePath);
          console.log(`🗑️ [Başlangıç Temizliği] Silindi: ${key}.json`);
        }
      });
    } catch (_) {}
  } else {
    useFallback = true;
    console.log('📂 JSON depolama modunda başlatıldı (SQLite yüklenemedi).');
  }
} else {
  useFallback = true;
  console.log('📂 JSON depolama modunda başlatıldı (Veritabanı göçü henüz yapılmamış).');
}

// Veritabanı Okuma API'si
export const getData = (key) => {
  if (useFallback || !db) {
    return getJsonData(key);
  }
  
  try {
    const row = db.prepare('SELECT value FROM collections WHERE key = ?').get(key);
    if (row && row.value) {
      return JSON.parse(row.value);
    }
    
    // Veritabanında bulunamadıysa JSON dosyasından oku
    const fallbackData = getJsonData(key);
    if (fallbackData) {
      // Veritabanını güncelle
      db.prepare('INSERT OR REPLACE INTO collections (key, value) VALUES (?, ?)')
        .run(key, JSON.stringify(fallbackData));
      return fallbackData;
    }
    return null;
  } catch (error) {
    console.error(`SQLite read error for ${key}, falling back to JSON:`, error);
    return getJsonData(key);
  }
};

// Veritabanı Yazma API'si
export const setData = (key, data) => {
  if (useFallback || !db) {
    return setJsonData(key, data);
  }
  
  try {
    db.prepare('INSERT OR REPLACE INTO collections (key, value) VALUES (?, ?)')
      .run(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`SQLite write error for ${key}, using JSON fallback:`, error);
    return setJsonData(key, data);
  }
};

// Benzersiz ID oluştur
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Veritabanı durumunu ve göç durumunu döner
export const getDbStatus = () => {
  const settings = getData('settings') || {};
  const isMigrated = settings.dbMigrated === true;
  return {
    dbType: sqliteDriver ? 'sqlite' : 'json',
    isMigrated
  };
};

// JSON verilerini SQLite veritabanına aktarma sihirbazı tetikleyicisi
export const runMigration = () => {
  if (!sqliteDriver) {
    throw new Error('SQLite sürücüsü (node:sqlite) başlatılamadı veya bu Node.js sürümünde mevcut değil.');
  }

  // SQLite bağlantısını kur (açık değilse)
  if (!db) {
    const success = initializeSqliteConnection();
    if (!success) {
      throw new Error('SQLite veritabanı bağlantısı oluşturulamadı.');
    }
  }

  const keys = ['classes', 'exams', 'notifications', 'reports', 'schedules', 'settings', 'students', 'submissions', 'teachers', 'updates'];
  let migratedAny = false;

  keys.forEach(key => {
    const jsonFilePath = join(dataPath, `${key}.json`);
    if (fs.existsSync(jsonFilePath)) {
      try {
        let fileData = fs.readFileSync(jsonFilePath, 'utf8');
        if (fileData.charCodeAt(0) === 0xFEFF) {
          fileData = fileData.slice(1);
        }
        const parsed = JSON.parse(fileData.trim());
        db.prepare('INSERT OR REPLACE INTO collections (key, value) VALUES (?, ?)')
          .run(key, JSON.stringify(parsed));
        migratedAny = true;
        
        // Göç tamamlandıktan sonra JSON dosyasını sistemden sil (settings.json hariç)
        if (key !== 'settings') {
          fs.unlinkSync(jsonFilePath);
          console.log(`🗑️ [Göç] Silindi: ${key}.json`);
        }
      } catch (err) {
        console.error(`Migration error for ${key}:`, err.message);
      }
    }
  });

  // Göçün tamamlandığını settings dosyasına yaz
  const settings = getJsonData('settings') || getData('settings') || {};
  settings.dbMigrated = true;

  // SQLite veritabanına kaydet
  db.prepare('INSERT OR REPLACE INTO collections (key, value) VALUES (?, ?)')
    .run('settings', JSON.stringify(settings));

  // settings.json dosyasına da yaz ki başlangıçta göç edildiği anlaşılsın
  setJsonData('settings', settings);

  // Fallback modundan çıkıp tamamen SQLite moduna geç
  useFallback = false;

  console.log('✅ [Göç Sihirbazı] JSON verileri SQLite veritabanına aktarıldı ve JSON dosyaları temizlendi.');
  return true;
};
