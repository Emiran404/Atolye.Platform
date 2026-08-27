// @ts-nocheck
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = join(__dirname, '../data');
const LEGACY_KEYS = [
  'classes', 'exams', 'logs', 'notifications', 'reports', 'schedules',
  'settings', 'students', 'submissions', 'teachers', 'telemetry', 'updates'
];

fs.mkdirSync(dataPath, { recursive: true });

let DatabaseSync;
let sqliteBackup;
try {
  ({ DatabaseSync, backup: sqliteBackup } = await import('node:sqlite'));
} catch (error) {
  throw new Error(
    'Atolye Platform SQLite ile çalışmak için Node.js 22 veya üstünü gerektirir. ' +
    `node:sqlite yüklenemedi: ${error.message}`
  );
}

const dbName = process.env.NODE_ENV === 'test' ? 'atolye_test.db' : 'atolye.db';
const dbPath = join(dataPath, dbName);
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');
db.exec('PRAGMA foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS collections (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const legacyJsonPath = (key) => {
  const keyName = process.env.NODE_ENV === 'test' ? `${key}_test` : key;
  return join(dataPath, `${keyName}.json`);
};

const readLegacyJson = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  return JSON.parse(content.trim());
};

// Önceki sürümlerden kalan JSON verilerini kullanıcı müdahalesi olmadan ve
// yalnızca SQLite'ta karşılığı yoksa içe aktar. Tüm yazımlar başarılı olmadan
// hiçbir JSON dosyası silinmez.
const importLegacyJsonOnce = () => {
  const pending = LEGACY_KEYS
    .map((key) => ({ key, filePath: legacyJsonPath(key) }))
    .filter(({ filePath }) => fs.existsSync(filePath));

  if (pending.length === 0) return;

  const importedFiles = [];
  db.exec('BEGIN IMMEDIATE');
  try {
    const existsStatement = db.prepare('SELECT 1 FROM collections WHERE key = ?');
    const insertStatement = db.prepare('INSERT INTO collections (key, value) VALUES (?, ?)');

    for (const entry of pending) {
      if (!existsStatement.get(entry.key)) {
        const value = readLegacyJson(entry.filePath);
        insertStatement.run(entry.key, JSON.stringify(value));
      }
      importedFiles.push(entry.filePath);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw new Error(`Eski JSON verileri SQLite'a otomatik aktarılamadı: ${error.message}`);
  }

  for (const filePath of importedFiles) fs.unlinkSync(filePath);
  console.log(`✅ ${importedFiles.length} eski JSON veri dosyası SQLite'a otomatik aktarıldı.`);
};

importLegacyJsonOnce();
console.log(`💾 SQLite veritabanı aktif: ${dbName}`);

export const getData = (key) => {
  try {
    const row = db.prepare('SELECT value FROM collections WHERE key = ?').get(key);
    return row?.value ? JSON.parse(row.value) : null;
  } catch (error) {
    console.error(`SQLite read error for ${key}:`, error);
    return null;
  }
};

export const setData = (key, data) => {
  try {
    db.prepare('INSERT OR REPLACE INTO collections (key, value) VALUES (?, ?)')
      .run(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`SQLite write error for ${key}:`, error);
    return false;
  }
};

export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const getDbStatus = () => ({
  dbType: 'sqlite',
  ready: true
});

export const createDatabaseBackup = async (destinationPath) => {
  db.exec('PRAGMA wal_checkpoint(PASSIVE)');
  await sqliteBackup(db, destinationPath);
  return destinationPath;
};

export const restoreDatabaseBackup = (sourcePath) => {
  const sourceDb = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    const integrity = sourceDb.prepare('PRAGMA integrity_check').get();
    if (!integrity || Object.values(integrity)[0] !== 'ok') {
      throw new Error('SQLite yedeği bütünlük kontrolünden geçemedi.');
    }

    const table = sourceDb.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'collections'"
    ).get();
    if (!table) throw new Error('Bu dosya Atolye Platform veritabanı değil.');

    const rows = sourceDb.prepare('SELECT key, value FROM collections').all();
    for (const row of rows) JSON.parse(row.value);

    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('DELETE FROM collections');
      const insert = db.prepare('INSERT INTO collections (key, value) VALUES (?, ?)');
      for (const row of rows) insert.run(row.key, row.value);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    return rows.length;
  } finally {
    sourceDb.close();
  }
};
