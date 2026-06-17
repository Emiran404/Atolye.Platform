// @ts-nocheck
import express from 'express';
import { getData, setData } from '../utils/storage.js';

const router = express.Router();

/**
 * @swagger
 * /api/telemetry:
 *   post:
 *     summary: POST /
 *     tags: [Telemetry]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/', (req, res) => {
  try {
    const settings = getData('settings') || {};
    if (settings.telemetryEnabled === false) {
      return res.json({ success: true, count: 0, message: 'Telemetry disabled' });
    }

    const events = req.body.events || [];
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ success: false, error: 'Geçersiz veri formatı' });
    }

    const telemetryData = getData('telemetry') || [];
    
    const sanitizedEvents = events.map(event => ({
      id: Math.random().toString(36).substr(2, 9),
      type: event.type || 'unknown',
      timestamp: event.timestamp || Date.now(),
      userAgent: req.headers['user-agent'] || 'unknown',
      url: event.url || '',
      data: event.data || {}
    }));

    // app_start olaylarını tespit et ama loglara/sheets'e kaydetme
    const hasAppStart = sanitizedEvents.some(e => e.type === 'app_start');
    const filteredEvents = sanitizedEvents.filter(e => e.type !== 'app_start');

    // Eğer uygulama yeni açılmışsa (app_start), sadece global istatistikleri (system_stats) ekle
    if (hasAppStart) {
      const students = getData('students') || [];
      const teachers = getData('teachers') || [];
      const submissions = getData('submissions') || [];
      
      const activeStudentsWithFiles = new Set();
      submissions.forEach(sub => {
        if (sub.studentId) activeStudentsWithFiles.add(sub.studentId);
      });

      filteredEvents.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'system_stats',
        timestamp: Date.now(),
        userAgent: 'server',
        url: 'backend',
        data: {
          totalStudents: students.length,
          totalTeachers: teachers.length,
          studentsWithFiles: activeStudentsWithFiles.size,
          totalSubmissions: submissions.length
        }
      });
    }

    if (filteredEvents.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    telemetryData.push(...filteredEvents);

    // Sınırla: En fazla 10000 log tutulsun
    if (telemetryData.length > 10000) {
      telemetryData.splice(0, telemetryData.length - 10000);
    }

    setData('telemetry', telemetryData);

    // Google Sheets'e arka planda gönder (Relay)
    const googleSheetsUrl = process.env.TELEMETRY_SHEET_URL || 'https://script.google.com/macros/s/AKfycbzP-8W0h8Ij_U2re0gST0dK4_Dm1B8Dk91IuXmFXqKu4TWXShM0PsKQsDv4wjbTC48e/exec';
    
    if (googleSheetsUrl && googleSheetsUrl.includes('script.google.com')) {
      // Arka planda asenkron olarak gönder (kullanıcıyı veya sistemi bekletme)
      fetch(googleSheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: filteredEvents })
      }).catch(err => {
        console.warn('[Telemetry] Google Sheets relay failed:', err.message);
      });
    }

    res.json({ success: true, count: filteredEvents.length });
  } catch (error) {
    console.error('Telemetri kayıt hatası:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @swagger
 * /api/telemetry/export:
 *   get:
 *     summary: GET /export
 *     tags: [Telemetry]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/export', (req, res) => {
  // Basit indirme endpointi
  try {
    const telemetryData = getData('telemetry') || [];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=telemetry.json');
    res.send(JSON.stringify(telemetryData, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
