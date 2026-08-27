// @ts-nocheck
import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getData, setData, getDbStatus } from '../utils/storage.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { updateManager } from '../utils/updateManager.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const router = express.Router();

// Ayarları yükle
const loadSettings = () => {
  const settings = getData('settings');
  const defaults = {
    registrationEnabled: true,
    teacherRegistrationEnabled: true,
    allowedClasses: getData('classes') || [
      "9-A", "9-B", "9-C", "9-D", "9-E", "9-F",
      "10-A", "10-B", "10-C", "10-D", "10-E", "10-F",
      "11-A", "11-B", "11-C", "11-D", "11-E", "11-F",
      "12-A", "12-B", "12-C", "12-D", "12-E", "12-F"
    ],
    autoBackupEnabled: false,
    autoBackupInterval: 24,
    autoBackupIncludePhotos: false,
    autoBackupWizardConfigured: false,
    lastAutoBackupTime: null,
    telemetryEnabled: true,
    telemetryPromptAnswered: false,
    autoDownloadClientUpdates: true,
    clientUpdateChannel: 'stable',
    clientUpdatesUrl: 'https://github.com/Emiran404/Atolye.Platform/releases/latest/download'
  };

  if (!settings) return defaults;
  return { ...defaults, ...settings };
};

// Ayarları kaydet
const saveSettings = (settings) => {
  return setData('settings', settings);
};

// GET /api/settings - Ayarları al
/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: GET /
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/', (req, res) => {
  try {
    const settings = loadSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ayarlar yüklenemedi' });
  }
});

// POST /api/settings - Ayarları güncelle (Sadece Öğretmenler)
/**
 * @swagger
 * /api/settings:
 *   post:
 *     summary: POST /
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/', authenticateToken, authorizeRole('teacher'), (req, res) => {
  try {
    const { 
      registrationEnabled, 
      teacherRegistrationEnabled, 
      allowedClasses, 
      ogsEnabled, 
      ogsClasses, 
      passwordChangeModeExpiresAt,
      autoBackupEnabled,
      autoBackupInterval,
      autoBackupIncludePhotos,
      autoBackupWizardConfigured,
      lastAutoBackupTime,
      telemetryEnabled,
      telemetryPromptAnswered,
      autoDownloadClientUpdates,
      clientUpdateChannel,
      clientUpdatesUrl
    } = req.body;

    const currentSettings = loadSettings();
    const settings = {
      ...currentSettings,
      registrationEnabled: registrationEnabled !== undefined ? registrationEnabled : currentSettings.registrationEnabled,
      teacherRegistrationEnabled: teacherRegistrationEnabled !== undefined ? teacherRegistrationEnabled : currentSettings.teacherRegistrationEnabled,
      allowedClasses: Array.isArray(allowedClasses) ? allowedClasses : currentSettings.allowedClasses,
      ogsEnabled: ogsEnabled !== undefined ? ogsEnabled : currentSettings.ogsEnabled,
      ogsClasses: Array.isArray(ogsClasses) ? ogsClasses : currentSettings.ogsClasses,
      passwordChangeModeExpiresAt: passwordChangeModeExpiresAt !== undefined ? passwordChangeModeExpiresAt : currentSettings.passwordChangeModeExpiresAt,
      autoBackupEnabled: autoBackupEnabled !== undefined ? autoBackupEnabled : currentSettings.autoBackupEnabled,
      autoBackupInterval: autoBackupInterval !== undefined ? Number(autoBackupInterval) : currentSettings.autoBackupInterval,
      autoBackupIncludePhotos: autoBackupIncludePhotos !== undefined ? autoBackupIncludePhotos : currentSettings.autoBackupIncludePhotos,
      autoBackupWizardConfigured: autoBackupWizardConfigured !== undefined ? autoBackupWizardConfigured : currentSettings.autoBackupWizardConfigured,
      lastAutoBackupTime: lastAutoBackupTime !== undefined ? lastAutoBackupTime : currentSettings.lastAutoBackupTime,
      telemetryEnabled: telemetryEnabled !== undefined ? telemetryEnabled : currentSettings.telemetryEnabled,
      telemetryPromptAnswered: telemetryPromptAnswered !== undefined ? telemetryPromptAnswered : currentSettings.telemetryPromptAnswered,
      autoDownloadClientUpdates: autoDownloadClientUpdates !== undefined ? autoDownloadClientUpdates : currentSettings.autoDownloadClientUpdates,
      clientUpdateChannel: ['stable', 'beta'].includes(clientUpdateChannel) ? clientUpdateChannel : currentSettings.clientUpdateChannel,
      clientUpdatesUrl: clientUpdatesUrl !== undefined ? clientUpdatesUrl : currentSettings.clientUpdatesUrl
    };

    if (saveSettings(settings)) {
      res.json({ success: true, settings });
    } else {
      res.status(500).json({ success: false, error: 'Ayarlar kaydedilemedi' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ayarlar güncellenemedi' });
  }
});

// GET /api/settings/db-status - Veritabanı durumunu al (Herkese açık)
/**
 * @swagger
 * /api/settings/db-status:
 *   get:
 *     summary: GET /db-status
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/db-status', (req, res) => {
  try {
    const status = getDbStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/settings/check-updates - Manuel olarak güncellemeleri denetle
/**
 * @swagger
 * /api/settings/check-updates:
 *   post:
 *     summary: POST /check-updates
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/check-updates', authenticateToken, authorizeRole('teacher'), async (req, res) => {
  try {
    const result = await updateManager.checkAndDownload();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/settings/downloaded-updates - İndirilen güncellemeleri listele
/**
 * @swagger
 * /api/settings/downloaded-updates:
 *   get:
 *     summary: GET /downloaded-updates
 *     tags: [Settings]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/downloaded-updates', authenticateToken, authorizeRole('teacher'), (req, res) => {
  try {
    const UPDATES_DIR = path.join(__dirname, '../updates');
    if (!fs.existsSync(UPDATES_DIR)) {
      return res.json({ success: true, files: [] });
    }
    const files = fs.readdirSync(UPDATES_DIR).map(file => {
      const filePath = path.join(UPDATES_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        date: stats.mtime,
        path: filePath
      };
    });
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
