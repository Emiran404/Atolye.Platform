// @ts-nocheck
import express from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import multer from 'multer';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { createDatabaseBackup, restoreDatabaseBackup } from '../utils/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();
const backupsDir = path.join(__dirname, '..', 'backups');
const tempDir = path.join(__dirname, '..', 'temp');
const uploadsDir = path.join(__dirname, '..', 'uploads');
const uploadsStudentDir = path.join(__dirname, '..', '..', 'src', 'uploads_student');

for (const directory of [backupsDir, tempDir]) fs.mkdirSync(directory, { recursive: true });

const upload = multer({ dest: tempDir, limits: { fileSize: 500 * 1024 * 1024, files: 1 } });
const teacherOnly = [authenticateToken, authorizeRole('teacher')];
const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const isSafeBackupName = name => Boolean(name) && path.basename(name) === name && !name.includes('..');
const removeIfExists = async filePath => {
  if (filePath && fs.existsSync(filePath)) await fsPromises.rm(filePath, { recursive: true, force: true });
};

const restoreUploadsFromZip = async (zip, prefix, destination) => {
  const normalizedPrefix = `${prefix}/`;
  const entries = zip.getEntries().filter(entry => !entry.isDirectory && entry.entryName.startsWith(normalizedPrefix));
  if (entries.length === 0) return;

  await fsPromises.rm(destination, { recursive: true, force: true });
  await fsPromises.mkdir(destination, { recursive: true });
  const root = path.resolve(destination) + path.sep;

  for (const entry of entries) {
    const relative = entry.entryName.slice(normalizedPrefix.length);
    const target = path.resolve(destination, relative);
    if (!relative || relative.includes('\0') || !target.startsWith(root)) {
      throw new Error('ZIP içinde güvenli olmayan dosya yolu bulundu.');
    }
    await fsPromises.mkdir(path.dirname(target), { recursive: true });
    await fsPromises.writeFile(target, entry.getData());
  }
};

const restoreZipFile = async zipPath => {
  const zip = new AdmZip(zipPath);
  const dbEntry = zip.getEntry('database.db');
  if (!dbEntry || dbEntry.isDirectory) throw new Error('ZIP yedeğinde database.db bulunamadı.');

  const tempDbPath = path.join(tempDir, `restore-${timestamp()}.db`);
  try {
    await fsPromises.writeFile(tempDbPath, dbEntry.getData());
    const restored = restoreDatabaseBackup(tempDbPath);
    await restoreUploadsFromZip(zip, 'uploads', uploadsDir);
    await restoreUploadsFromZip(zip, 'uploads_student', uploadsStudentDir);
    return restored;
  } finally {
    await removeIfExists(tempDbPath);
  }
};

router.get('/', ...teacherOnly, async (_req, res) => {
  const tempDbPath = path.join(tempDir, `manual-${timestamp()}.db`);
  try {
    await createDatabaseBackup(tempDbPath);
    res.download(tempDbPath, `atolye-platform-backup-${timestamp()}.db`, () => removeIfExists(tempDbPath));
  } catch (error) {
    await removeIfExists(tempDbPath);
    if (!res.headersSent) res.status(500).json({ success: false, error: `Yedekleme başarısız: ${error.message}` });
  }
});

router.get('/with-photos', ...teacherOnly, async (_req, res) => {
  const tempDbPath = path.join(tempDir, `photos-${timestamp()}.db`);
  try {
    await createDatabaseBackup(tempDbPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('warning', error => console.warn('Backup archive warning:', error.message));
    res.once('close', () => removeIfExists(tempDbPath));
    res.attachment(`atolye-platform-backup-with-files-${timestamp()}.zip`);
    res.setHeader('Content-Type', 'application/zip');
    archive.pipe(res);
    archive.file(tempDbPath, { name: 'database.db' });
    if (fs.existsSync(uploadsDir)) archive.directory(uploadsDir, 'uploads');
    if (fs.existsSync(uploadsStudentDir)) archive.directory(uploadsStudentDir, 'uploads_student');
    await archive.finalize();
  } catch (error) {
    await removeIfExists(tempDbPath);
    if (!res.headersSent) res.status(500).json({ success: false, error: `ZIP yedeği oluşturulamadı: ${error.message}` });
  }
});

router.post('/restore', ...teacherOnly, upload.single('backup'), async (req, res) => {
  try {
    if (!req.file || !req.file.originalname.toLowerCase().endsWith('.db')) {
      return res.status(400).json({ success: false, error: 'Yalnızca .db SQLite yedeği yüklenebilir.' });
    }
    const restored = restoreDatabaseBackup(req.file.path);
    res.json({ success: true, message: `${restored} veri grubu SQLite yedeğinden geri yüklendi.` });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'Veritabanı geri yüklenemedi.' });
  } finally {
    await removeIfExists(req.file?.path);
  }
});

router.post('/restore-zip', ...teacherOnly, upload.single('backup'), async (req, res) => {
  try {
    if (!req.file || !req.file.originalname.toLowerCase().endsWith('.zip')) {
      return res.status(400).json({ success: false, error: 'Yalnızca .zip yedeği yüklenebilir.' });
    }
    const restored = await restoreZipFile(req.file.path);
    res.json({ success: true, message: `${restored} veri grubu ve arşivdeki dosyalar geri yüklendi.` });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'ZIP yedeği geri yüklenemedi.' });
  } finally {
    await removeIfExists(req.file?.path);
  }
});

router.get('/list', ...teacherOnly, (_req, res) => {
  try {
    const backups = fs.readdirSync(backupsDir)
      .filter(file => /\.(db|zip)$/i.test(file))
      .map(name => {
        const stats = fs.statSync(path.join(backupsDir, name));
        return { name, size: stats.size, createdAt: stats.mtime.toISOString(), isAuto: name.startsWith('auto-backup-') };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ success: true, backups });
  } catch {
    res.status(500).json({ success: false, error: 'Yedek dosyaları listelenemedi.' });
  }
});

router.get('/download/:fileName', ...teacherOnly, (req, res) => {
  const { fileName } = req.params;
  if (!isSafeBackupName(fileName) || !/\.(db|zip)$/i.test(fileName)) return res.status(400).json({ success: false, error: 'Geçersiz yedek adı.' });
  const filePath = path.join(backupsDir, fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'Yedek bulunamadı.' });
  res.download(filePath);
});

router.post('/restore-local/:fileName', ...teacherOnly, async (req, res) => {
  try {
    const { fileName } = req.params;
    if (!isSafeBackupName(fileName) || !/\.(db|zip)$/i.test(fileName)) return res.status(400).json({ success: false, error: 'Geçersiz yedek adı.' });
    const filePath = path.join(backupsDir, fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'Yedek bulunamadı.' });
    const restored = fileName.toLowerCase().endsWith('.zip') ? await restoreZipFile(filePath) : restoreDatabaseBackup(filePath);
    res.json({ success: true, message: `${restored} veri grubu geri yüklendi.` });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message || 'Yedek geri yüklenemedi.' });
  }
});

router.delete('/:fileName', ...teacherOnly, async (req, res) => {
  const { fileName } = req.params;
  if (!isSafeBackupName(fileName) || !/\.(db|zip)$/i.test(fileName)) return res.status(400).json({ success: false, error: 'Geçersiz yedek adı.' });
  const filePath = path.join(backupsDir, fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'Yedek bulunamadı.' });
  await fsPromises.unlink(filePath);
  res.json({ success: true, message: 'Yedek silindi.' });
});

export default router;
