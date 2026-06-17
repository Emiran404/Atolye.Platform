// @ts-nocheck
import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getData, setData } from '../utils/storage.js';

const router = express.Router();

// GET /api/classes - Sınıf listesini al
/**
 * @swagger
 * /api/classes:
 *   get:
 *     summary: GET /
 *     tags: [Classes]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/', (req, res) => {
  try {
    const classes = getData('classes') || [];
    res.json({ success: true, classes });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sınıflar yüklenemedi' });
  }
});

// POST /api/classes - Yeni sınıf ekle
/**
 * @swagger
 * /api/classes:
 *   post:
 *     summary: POST /
 *     tags: [Classes]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/', authenticateToken, authorizeRole('teacher'), (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Sınıf adı zorunludur' });

    let classes = getData('classes') || [];
    if (classes.includes(name)) {
      return res.status(400).json({ success: false, error: 'Bu sınıf zaten mevcut' });
    }

    classes.push(name);
    // Alfabetik sırala
    classes.sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));

    if (setData('classes', classes)) {
      res.json({ success: true, classes });
    } else {
      res.status(500).json({ success: false, error: 'Kaydetme başarısız' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

// DELETE /api/classes/:name - Sınıfı sil
/**
 * @swagger
 * /api/classes/{name}:
 *   delete:
 *     summary: DELETE /{name}
 *     tags: [Classes]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.delete('/:name', authenticateToken, authorizeRole('teacher'), (req, res) => {
  try {
    const { name } = req.params;
    let classes = getData('classes') || [];
    
    if (!classes.includes(name)) {
      return res.status(404).json({ success: false, error: 'Sınıf bulunamadı' });
    }

    classes = classes.filter(c => c !== name);

    if (setData('classes', classes)) {
      // Öğrencileri "Sınıf Silindi" olarak işaretle (Opsiyonel ama güvenli)
      const students = getData('students') || [];
      const updatedStudents = students.map(s => {
        if (s.className === name) {
          return { ...s, className: 'Sınıf Silindi' };
        }
        return s;
      });
      
      if (students.some(s => s.className === name)) {
        setData('students', updatedStudents);
      }

      res.json({ success: true, classes });
    } else {
      res.status(500).json({ success: false, error: 'Silme başarısız' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

// PUT /api/classes/:oldName - Sınıf ismini güncelle
/**
 * @swagger
 * /api/classes/{oldName}:
 *   put:
 *     summary: PUT /{oldName}
 *     tags: [Classes]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.put('/:oldName', authenticateToken, authorizeRole('teacher'), (req, res) => {
  try {
    const { oldName } = req.params;
    const { newName } = req.body;

    if (!newName) return res.status(400).json({ success: false, error: 'Yeni sınıf adı zorunludur' });

    let classes = getData('classes') || [];
    const index = classes.indexOf(oldName);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Sınıf bulunamadı' });
    }

    if (classes.includes(newName) && oldName !== newName) {
      return res.status(400).json({ success: false, error: 'Bu isimde bir sınıf zaten var' });
    }

    classes[index] = newName;
    classes.sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));

    if (setData('classes', classes)) {
      // Öğrencilerin sınıf ismini de güncelle
      const students = getData('students') || [];
      const updatedStudents = students.map(s => {
        if (s.className === oldName) {
          return { ...s, className: newName };
        }
        return s;
      });
      
      if (students.some(s => s.className === oldName)) {
        setData('students', updatedStudents);
      }

      res.json({ success: true, classes });
    } else {
      res.status(500).json({ success: false, error: 'Güncelleme başarısız' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

export default router;
