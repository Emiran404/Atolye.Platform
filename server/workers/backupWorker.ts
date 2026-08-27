// @ts-nocheck
import { getData, setData, createDatabaseBackup } from '../utils/storage.js';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backupsDir = path.join(__dirname, '../backups');
const tempDir = path.join(__dirname, '../temp');
const uploadsDir = path.join(__dirname, '../uploads');
const uploadsStudentDir = path.join(__dirname, '../../src/uploads_student');

for (const directory of [backupsDir, tempDir]) fs.mkdirSync(directory, { recursive: true });

const createZipBackup = async (filePath, databasePath) => {
  const output = fs.createWriteStream(filePath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.file(databasePath, { name: 'database.db' });
    if (fs.existsSync(uploadsDir)) archive.directory(uploadsDir, 'uploads');
    if (fs.existsSync(uploadsStudentDir)) archive.directory(uploadsStudentDir, 'uploads_student');
    archive.finalize();
  });
};

export const runAutoBackup = async () => {
  let tempDatabasePath;
  try {
    const settings = getData('settings') || {};
    const includePhotos = settings.autoBackupIncludePhotos === true;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (includePhotos) {
      tempDatabasePath = path.join(tempDir, `auto-backup-${timestamp}.db`);
      const zipPath = path.join(backupsDir, `auto-backup-${timestamp}.zip`);
      await createDatabaseBackup(tempDatabasePath);
      await createZipBackup(zipPath, tempDatabasePath);
    } else {
      await createDatabaseBackup(path.join(backupsDir, `auto-backup-${timestamp}.db`));
    }

    settings.lastAutoBackupTime = new Date().toISOString();
    setData('settings', settings);
    cleanOldBackups();
    console.log(`[AutoBackup] SQLite yedeği oluşturuldu (Dosyalar: ${includePhotos}).`);
  } catch (error) {
    console.error('[AutoBackup] Yedekleme hatası:', error);
  } finally {
    if (tempDatabasePath && fs.existsSync(tempDatabasePath)) await fsPromises.unlink(tempDatabasePath);
  }
};

const cleanOldBackups = () => {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(file => file.startsWith('auto-backup-') && /\.(db|zip)$/i.test(file))
      .map(name => ({ name, time: fs.statSync(path.join(backupsDir, name)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
    for (const file of files.slice(10)) fs.unlinkSync(path.join(backupsDir, file.name));
  } catch (error) {
    console.error('[AutoBackup] Eski yedekler temizlenemedi:', error);
  }
};

const checkAndRunBackup = () => {
  try {
    const settings = getData('settings') || {};
    if (settings.autoBackupEnabled !== true) return;
    const elapsed = Date.now() - new Date(settings.lastAutoBackupTime || 0).getTime();
    const interval = (settings.autoBackupInterval || 24) * 60 * 60 * 1000;
    if (!settings.lastAutoBackupTime || elapsed >= interval) runAutoBackup();
  } catch (error) {
    console.error('[AutoBackup] Kontrol hatası:', error);
  }
};

export const startBackupWorker = () => {
  console.log('[AutoBackup] SQLite yedekleme workerı başlatıldı.');
  setTimeout(checkAndRunBackup, 5000);
  setInterval(checkAndRunBackup, 5 * 60 * 1000);
};
