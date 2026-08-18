// @ts-nocheck
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join, extname, relative, sep } from 'path';
import fs from 'fs';
import { hashFile } from '../utils/crypto.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import {
  INVALID_PATH_CODE,
  resolveExistingPathWithinRoot,
  resolvePathForCreationWithinRoot
} from '../utils/safePath.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Upload klasörü
const uploadsBase = join(__dirname, '../../src/uploads_student');
const routeErrorStatus = (error) => error?.code === INVALID_PATH_CODE ? 403 : 500;

// Multer konfigürasyonu
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Geçici olarak uploads_student klasörüne yükle
    // Dosya yüklendikten sonra doğru klasöre taşınacak
    if (!fs.existsSync(uploadsBase)) {
      fs.mkdirSync(uploadsBase, { recursive: true });
    }
    cb(null, uploadsBase);
  },
  filename: (req, file, cb) => {
    // Benzersiz dosya adı oluştur
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = extname(originalName);
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const fileName = `temp_${timestamp}_${randomStr}${ext}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1GB
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      '.pdf', 
      '.doc', '.docx', '.txt',
      '.jpg', '.jpeg', '.png', '.gif',
      '.mp4', '.avi', '.mov', '.wmv', '.mkv', '.webm',
      '.zip', '.rar',
      '.pkt', // Cisco Packet Tracer
      '.xls', '.xlsx', // Excel
      '.ppt', '.pptx', // PowerPoint
      '.iso', '.ova' // Sanal Makine
    ];

    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/x-msvideo',
      'video/quicktime',
      'video/x-ms-wmv',
      'video/x-matroska',
      'video/webm',
      'application/zip',
      'application/x-rar-compressed',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/x-iso9660-image',
      'application/octet-stream' // OVA and PKT usually fallback to this
    ];

    const ext = extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    
    if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(mime)) {
      cb(null, true);
    } else {
      cb(new Error(`Bu dosya tipi izin verilmiyor (Uzantı: ${ext}, Mime: ${mime})`));
    }
  }
});

// Dosya yükle
/**
 * @swagger
 * /api/uploads:
 *   post:
 *     summary: POST /
 *     tags: [Uploads]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenmedi' });
    }

    const { folderPath, examId, studentId } = req.body;
    
    if (!folderPath) {
      // Geçici dosyayı sil
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'folderPath gerekli' });
    }
    
    // Hedef klasörü oluştur
    const targetFolder = resolvePathForCreationWithinRoot(uploadsBase, folderPath);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    const safeTargetFolder = resolveExistingPathWithinRoot(uploadsBase, folderPath);
    
    // Orijinal dosya adını kullan, çakışma varsa numara ekle
    const decodedName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const originalName = decodedName.split(/[\\/]/).pop();
    if (!originalName || originalName.includes('\0') || originalName === '.' || originalName === '..') {
      const error = new Error('Geçersiz dosya adı.');
      error.code = INVALID_PATH_CODE;
      throw error;
    }
    const ext = extname(originalName);
    const baseName = originalName.slice(0, -ext.length);
    
    let finalName = originalName;
    let counter = 1;
    while (fs.existsSync(join(safeTargetFolder, finalName))) {
      finalName = `${baseName}_${counter}${ext}`;
      counter++;
    }
    
    // Dosyayı hedef klasöre taşı
    const targetPath = join(safeTargetFolder, finalName);
    fs.renameSync(req.file.path, targetPath);
    
    // Dosya hash hesapla
    const fileBuffer = fs.readFileSync(targetPath);
    const fileHash = hashFile(fileBuffer);

    // Relative path oluştur (frontend için)
    const storedRelativePath = relative(uploadsBase, targetPath).split(sep).join('/');
    const relativePath = `/uploads/${storedRelativePath}`;

    res.json({
      success: true,
      file: {
        fileName: finalName,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        filePath: relativePath,
        fileHash,
        folderPath: relative(uploadsBase, safeTargetFolder).split(sep).join('/')
      }
    });
  } catch (error) {
    // Hata durumunda geçici dosyayı temizle
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(routeErrorStatus(error)).json({ success: false, error: error.message });
  }
});

// Dosya indir
/**
 * @swagger
 * /api/uploads/download/*:
 *   get:
 *     summary: GET /download/*
 *     tags: [Uploads]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/download/*', (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = resolveExistingPathWithinRoot(uploadsBase, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    }

    res.download(fullPath);
  } catch (error) {
    res.status(routeErrorStatus(error)).json({ success: false, error: error.message });
  }
});

// Dosya görüntüle
/**
 * @swagger
 * /api/uploads/view/*:
 *   get:
 *     summary: GET /view/*
 *     tags: [Uploads]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/view/*', (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = resolveExistingPathWithinRoot(uploadsBase, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    }

    res.sendFile(fullPath);
  } catch (error) {
    res.status(routeErrorStatus(error)).json({ success: false, error: error.message });
  }
});

// Klasör içeriğini listele
/**
 * @swagger
 * /api/uploads/list/*:
 *   get:
 *     summary: GET /list/*
 *     tags: [Uploads]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/list/*', (req, res) => {
  try {
    const folderPath = req.params[0] || '';
    const fullPath = resolveExistingPathWithinRoot(uploadsBase, folderPath);
    
    if (!fs.existsSync(fullPath)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs.readdirSync(fullPath).map(name => {
      const fileStat = fs.lstatSync(join(fullPath, name));
      if (fileStat.isSymbolicLink()) return null;
      return {
        name,
        isDirectory: fileStat.isDirectory(),
        size: fileStat.size,
        modified: fileStat.mtime
      };
    }).filter(Boolean);

    res.json({ success: true, files });
  } catch (error) {
    res.status(routeErrorStatus(error)).json({ success: false, error: error.message });
  }
});

// Dosya sil
/**
 * @swagger
 * /api/uploads/*:
 *   delete:
 *     summary: DELETE /*
 *     tags: [Uploads]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.delete('/*', (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = resolveExistingPathWithinRoot(uploadsBase, filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
    }

    fs.unlinkSync(fullPath);
    res.json({ success: true, message: 'Dosya silindi' });
  } catch (error) {
    res.status(routeErrorStatus(error)).json({ success: false, error: error.message });
  }
});

export default router;
