// @ts-nocheck
import express from 'express';
import { getData, setData } from '../utils/storage.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// Basit ID generator
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

// Tüm bildirimler
/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: GET /
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/', (req, res) => {
  try {
    const notifications = getData('notifications') || [];
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Kullanıcıya özel bildirimler
/**
 * @swagger
 * /api/notifications/user/{userType}/{userId}:
 *   get:
 *     summary: GET /user/{userType}/{userId}
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/user/:userType/:userId', (req, res) => {
  try {
    const { userType, userId } = req.params;
    const allNotifications = getData('notifications') || [];
    
    const userNotifications = allNotifications.filter(n => {
      if (n.targetType === userType) {
        return n.targetId === null || n.targetId === userId;
      }
      return false;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const unreadCount = userNotifications.filter(n => !n.isRead).length;
    
    res.json({ success: true, notifications: userNotifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bildirim oluştur
/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: POST /
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/', authorizeRole('teacher'), (req, res) => {
  try {
    const { type, title, message, targetType, targetId, relatedId } = req.body;
    const notifications = getData('notifications') || [];
    
    const newNotification = {
      id: generateId(),
      type,
      title,
      message,
      targetType,
      targetId: targetId || null,
      relatedId: relatedId || null,
      createdAt: new Date().toISOString(),
      isRead: false
    };
    
    notifications.push(newNotification);
    setData('notifications', notifications);
    
    res.json({ success: true, notification: newNotification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Okundu işaretle
/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: PATCH /{id}/read
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.patch('/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    const notifications = getData('notifications') || [];
    const notification = notifications.find(n => n.id === id);
    
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Bildirim bulunamadı' });
    }
    
    notification.isRead = true;
    notification.readAt = new Date().toISOString();
    setData('notifications', notifications);
    
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tümünü okundu işaretle
/**
 * @swagger
 * /api/notifications/read-all/{userType}/{userId}:
 *   patch:
 *     summary: PATCH /read-all/{userType}/{userId}
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.patch('/read-all/:userType/:userId', (req, res) => {
  try {
    const { userType, userId } = req.params;
    const notifications = getData('notifications') || [];
    
    notifications.forEach(n => {
      if (n.targetType === userType && (n.targetId === null || n.targetId === userId)) {
        n.isRead = true;
        n.readAt = new Date().toISOString();
      }
    });
    
    setData('notifications', notifications);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bildirim sil
/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: DELETE /{id}
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.delete('/:id', authorizeRole('teacher'), (req, res) => {
  try {
    const { id } = req.params;
    const notifications = getData('notifications') || [];
    const filtered = notifications.filter(n => n.id !== id);
    
    setData('notifications', filtered);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Toplu bildirim gönder (İsimlendirme veya ID listesi ile)
/**
 * @swagger
 * /api/notifications/bulk:
 *   post:
 *     summary: POST /bulk
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/bulk', authorizeRole('teacher'), (req, res) => {
  try {
    const { target, targetType, targetIds, title, message, relatedId } = req.body;
    const notifications = getData('notifications') || [];
    const students = getData('students') || [];
    const teachers = getData('teachers') || [];

    let recipients = [];
    
    // 1. Explicit ID listesi verilmişse (Modern format)
    if (Array.isArray(targetIds)) {
      recipients = targetIds.map(id => ({ type: targetType || 'student', id }));
    } 
    // 2. Target string verilmişse (Legacy format)
    else if (typeof target === 'string') {
      if (target === 'all-students') {
        recipients = students.map(s => ({ type: 'student', id: s.id }));
      } else if (target === 'all-teachers') {
        recipients = teachers.map(t => ({ type: 'teacher', id: t.id }));
      } else if (target.startsWith('class-')) {
        const className = target.replace('class-', '');
        recipients = students
          .filter(s => s.className === className)
          .map(s => ({ type: 'student', id: s.id }));
      }
    }

    const newNotifications = recipients.map(recipient => ({
      id: generateId(),
      title,
      message,
      type: 'info',
      targetType: recipient.type,
      targetId: recipient.id,
      relatedId: relatedId || null,
      isRead: false,
      createdAt: new Date().toISOString()
    }));

    setData('notifications', [...notifications, ...newNotifications]);
    
    res.json({ success: true, count: newNotifications.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
