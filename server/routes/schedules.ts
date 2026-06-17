// @ts-nocheck
import express from 'express';
import { getData, setData, generateId } from '../utils/storage.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Tüm ders programlarını getir
/**
 * @swagger
 * /api/schedules:
 *   get:
 *     summary: GET /
 *     tags: [Schedules]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/', (req, res) => {
  try {
    const schedules = getData('schedules') || [];
    res.json({ success: true, schedules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Belirli bir sınıfın ders programını getir
/**
 * @swagger
 * /api/schedules/class/{className}:
 *   get:
 *     summary: GET /class/{className}
 *     tags: [Schedules]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/class/:className', (req, res) => {
  try {
    const { className } = req.params;
    const schedules = getData('schedules') || [];
    const classSchedules = schedules.filter(s => s.className === className);
    res.json({ success: true, schedules: classSchedules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeni ders ekle
/**
 * @swagger
 * /api/schedules:
 *   post:
 *     summary: POST /
 *     tags: [Schedules]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/', authorizeRole('teacher'), (req, res) => {
  try {
    const schedules = getData('schedules') || [];
    const newSchedule = {
      id: generateId(),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    schedules.push(newSchedule);
    setData('schedules', schedules);
    
    res.json({ success: true, schedule: newSchedule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toplu ders ekle
/**
 * @swagger
 * /api/schedules/bulk:
 *   post:
 *     summary: POST /bulk
 *     tags: [Schedules]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/bulk', authorizeRole('teacher'), (req, res) => {
  try {
    const schedules = getData('schedules') || [];
    const { newSchedules } = req.body;
    
    const addedSchedules = newSchedules.map(schedule => ({
      id: generateId(),
      ...schedule,
      createdAt: new Date().toISOString()
    }));
    
    schedules.push(...addedSchedules);
    setData('schedules', schedules);
    
    res.json({ success: true, schedules: addedSchedules, count: addedSchedules.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ders güncelle
/**
 * @swagger
 * /api/schedules/{id}:
 *   put:
 *     summary: PUT /{id}
 *     tags: [Schedules]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.put('/:id', authorizeRole('teacher'), (req, res) => {
  try {
    const { id } = req.params;
    const schedules = getData('schedules') || [];
    const index = schedules.findIndex(s => s.id === id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Ders bulunamadı' });
    }
    
    schedules[index] = {
      ...schedules[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    setData('schedules', schedules);
    res.json({ success: true, schedule: schedules[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ders sil
/**
 * @swagger
 * /api/schedules/{id}:
 *   delete:
 *     summary: DELETE /{id}
 *     tags: [Schedules]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.delete('/:id', authorizeRole('teacher'), (req, res) => {
  try {
    const { id } = req.params;
    const schedules = getData('schedules') || [];
    const filtered = schedules.filter(s => s.id !== id);
    
    if (schedules.length === filtered.length) {
      return res.status(404).json({ success: false, error: 'Ders bulunamadı' });
    }
    
    setData('schedules', filtered);
    res.json({ success: true, message: 'Ders silindi' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
