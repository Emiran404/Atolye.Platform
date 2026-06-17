// @ts-nocheck
import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getLogs, addLog } from '../utils/logger.js';

const router = express.Router();

// Öğretmen/Admin logları görüntüleme endpoint'i
/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: GET /
 *     tags: [Logs]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/', authenticateToken, authorizeRole('teacher'), (req, res) => {
  try {
    const logs = getLogs();
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Logs fetch error:', error);
    res.status(500).json({ success: false, error: 'Loglar alınırken sunucu hatası oluştu.' });
  }
});

// Öğrenci tarafı Kiosk / Focus loss loglama endpoint'i
/**
 * @swagger
 * /api/logs/client-event:
 *   post:
 *     summary: POST /client-event
 *     tags: [Logs]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/client-event', authenticateToken, (req, res) => {
  try {
    const { type, action, details } = req.body;
    
    // Yalnızca belirli log türlerine izin ver
    const allowedTypes = ['focus_loss', 'kiosk_violation', 'system_error'];
    
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Geçersiz log türü' });
    }

    addLog({
      type,
      userId: req.user.id,
      userName: req.user.name || req.user.fullName || req.user.username,
      role: req.user.role || 'student',
      action: action || 'İstemci tarafı olayı bildirildi',
      details: {
        ...details,
        ip: req.ip || req.connection.remoteAddress
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Client event log error:', error);
    res.status(500).json({ success: false, error: 'Olay kaydedilemedi' });
  }
});

export default router;
