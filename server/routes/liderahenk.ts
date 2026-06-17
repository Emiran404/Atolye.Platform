// @ts-nocheck
import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { testLDAPConnection, searchLDAPUsers, exportToLDAP } from '../utils/ldap.js';
import { getData, setData, generateId } from '../utils/storage.js';
import { hashPassword } from '../utils/crypto.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// LDAP kullanıcısından sınıf adını (OU) çıkart
const getClassFromLdapUser = (ldapUser, defaultClass = 'LDAP-Aktarılan') => {
  if (!ldapUser) return defaultClass;
  
  const genericContainers = ['ogrenciler', 'ogretmenler', 'users', 'people', 'students', 'teachers', 'groups', 'liderahenk'];
  
  if (ldapUser.dn) {
    const ouMatches = [...ldapUser.dn.matchAll(/ou\s*=\s*([^,]+)/gi)];
    for (const match of ouMatches) {
      const parsedOU = match[1].trim();
      if (!genericContainers.includes(parsedOU.toLowerCase())) {
        return parsedOU;
      }
    }
  }
  
  if (ldapUser.ou) {
    const ouArray = Array.isArray(ldapUser.ou) ? ldapUser.ou : [ldapUser.ou];
    for (const ouVal of ouArray) {
      if (ouVal) {
        const parsedOU = ouVal.trim();
        if (!genericContainers.includes(parsedOU.toLowerCase())) {
          return parsedOU;
        }
      }
    }
  }
  
  return defaultClass;
};

// Sınıfın sistemde kayıtlı olmasını sağla
const ensureClassExists = (className) => {
  if (!className) return;
  const classes = getData('classes') || [];
  if (!classes.includes(className)) {
    classes.push(className);
    classes.sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
    setData('classes', classes);
  }
};

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

// LDAP ayarlarını yükle (settings.json içinden)
const getLiderAhenkSettings = () => {
  try {
    const allSettings = getData('settings') || {};
    return allSettings.liderAhenk || {
      enabled: false,
      url: 'ldap://localhost:389',
      baseDN: 'dc=liderahenk,dc=org',
      bindDN: 'cn=admin,dc=liderahenk,dc=org',
      bindPassword: '',
      userDNPattern: 'uid={{username}},ou=users,dc=liderahenk,dc=org',
      searchFilter: '(uid={{username}})',
      syncInterval: 0 // Dakika (0 = devre dışı)
    };
  } catch (error) {
    console.error('LiderAhenk settings load error:', error);
  }
  return { enabled: false };
};

// GET /api/liderahenk/settings
/**
 * @swagger
 * /api/liderahenk/settings:
 *   get:
 *     summary: GET /settings
 *     tags: [Liderahenk]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/settings', authenticateToken, authorizeRole('teacher'), (req, res) => {
  const settings = getLiderAhenkSettings();
  // Şifreyi maskele
  const maskedSettings = { ...settings };
  if (maskedSettings.bindPassword) maskedSettings.bindPassword = '********';
  
  res.json({ success: true, settings: maskedSettings });
});

// POST /api/liderahenk/settings
/**
 * @swagger
 * /api/liderahenk/settings:
 *   post:
 *     summary: POST /settings
 *     tags: [Liderahenk]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/settings', authenticateToken, authorizeRole('teacher'), (req, res) => {
  try {
    const newSettings = req.body;
    
    // Mevcut ayarları al
    let allSettings = getData('settings') || {};

    // Eğer şifre '********' olarak geldiyse, eski şifreyi koru
    if (newSettings.bindPassword === '********') {
      newSettings.bindPassword = allSettings.liderAhenk?.bindPassword || '';
    }

    allSettings.liderAhenk = {
      ...allSettings.liderAhenk,
      ...newSettings
    };

    setData('settings', allSettings);
    res.json({ success: true, message: 'LiderAhenk ayarları kaydedildi.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Ayarlar kaydedilemedi: ' + error.message });
  }
});

// POST /api/liderahenk/test
/**
 * @swagger
 * /api/liderahenk/test:
 *   post:
 *     summary: POST /test
 *     tags: [Liderahenk]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/test', authenticateToken, authorizeRole('teacher'), async (req, res) => {
  try {
    const config = req.body;
    
    // Eğer şifre maskelenmiş geldiyse gerçek şifreyi dosyadan al
    if (config.bindPassword === '********' || !config.bindPassword) {
      const allSettings = getData('settings') || {};
      config.bindPassword = allSettings.liderAhenk?.bindPassword || '';
    }

    const result = await testLDAPConnection(config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/liderahenk/users - LDAP kullanıcılarını listele
/**
 * @swagger
 * /api/liderahenk/users:
 *   get:
 *     summary: GET /users
 *     tags: [Liderahenk]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/users', authenticateToken, authorizeRole('teacher'), async (req, res) => {
  try {
    const config = getLiderAhenkSettings();
    if (!config.enabled) {
      return res.status(400).json({ success: false, error: 'LiderAhenk entegrasyonu aktif değil.' });
    }

    const users = await searchLDAPUsers(config);

    const students = getData('students') || [];
    const teachers = getData('teachers') || [];

    const enrichedUsers = users.map(u => {
      const isStudent = students.some(s => s.studentNumber === u.uid);
      const isTeacher = teachers.some(t => t.username === u.uid);
      
      let syncStatus = 'not_synced';
      if (isStudent) syncStatus = 'student';
      if (isTeacher) syncStatus = 'teacher';
      
      return { ...u, syncStatus };
    });

    res.json({ success: true, users: enrichedUsers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/liderahenk/sync - Seçili kullanıcıları senkronize et
/**
 * @swagger
 * /api/liderahenk/sync:
 *   post:
 *     summary: POST /sync
 *     tags: [Liderahenk]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/sync', authenticateToken, authorizeRole('teacher'), async (req, res) => {
  try {
    const { users, targetRole } = req.body; // targetRole: 'student' or 'teacher'
    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'Senkronize edilecek kullanıcı seçilmedi.' });
    }

    let syncCount = 0;
    let skipCount = 0;

    if (targetRole === 'student') {
      const students = getData('students') || [];
      
      for (const ldapUser of users) {
        if (!ldapUser.uid) continue;

        // Zaten var mı?
        if (students.find(s => s.studentNumber === ldapUser.uid)) {
          skipCount++;
          continue;
        }

        // Yeni öğrenci oluştur (JIT mantığıyla benzer)
        const className = getClassFromLdapUser(ldapUser, 'LDAP-Aktarılan');
        ensureClassExists(className);
        const sanitizedName = ldapUser.fullName.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s]/g, '').trim();
        const folderPath = `${className} ogrenciler/${sanitizedName}-${ldapUser.uid}`;

        const newStudent = {
          id: generateId(),
          studentNumber: ldapUser.uid,
          fullName: ldapUser.fullName,
          email: ldapUser.email || null,
          className,
          password: hashPassword(crypto.randomBytes(16).toString('hex'), ldapUser.uid),
          folderPath,
          createdAt: new Date().toISOString(),
          lastLogin: null,
          ipHistory: [],
          isLdapUser: true
        };

        students.push(newStudent);
        syncCount++;
      }
      setData('students', students);

    } else if (targetRole === 'teacher') {
      const teachers = getData('teachers') || [];
      
      for (const ldapUser of users) {
        if (!ldapUser.uid) continue;

        if (teachers.find(t => t.username === ldapUser.uid)) {
          skipCount++;
          continue;
        }

        const newTeacher = {
          id: generateId(),
          username: ldapUser.uid,
          fullName: ldapUser.fullName,
          email: ldapUser.email || null,
          department: getClassFromLdapUser(ldapUser, 'LDAP-Aktarılan'),
          password: hashPassword(crypto.randomBytes(16).toString('hex'), ldapUser.uid),
          createdAt: new Date().toISOString(),
          lastLogin: null,
          isLdapUser: true
        };

        teachers.push(newTeacher);
        syncCount++;
      }
      setData('teachers', teachers);
    }

    res.json({ 
      success: true, 
      message: `${syncCount} kullanıcı başarıyla senkronize edildi. ${skipCount} mevcut kullanıcı atlandı.` 
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Senkronizasyon hatası: ' + error.message });
  }
});

// GET /api/liderahenk/local-users - Platform kullanıcılarını listele
/**
 * @swagger
 * /api/liderahenk/local-users:
 *   get:
 *     summary: GET /local-users
 *     tags: [Liderahenk]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.get('/local-users', authenticateToken, authorizeRole('teacher'), async (req, res) => {
  try {
    const config = getLiderAhenkSettings();
    let ldapUsers = [];
    
    if (config.enabled) {
      try {
        ldapUsers = await searchLDAPUsers(config);
      } catch (e) {
        console.warn('LDAP search failed during local-users fetch:', e.message);
      }
    }

    const students = getData('students') || [];
    const teachers = getData('teachers') || [];

    const formatUser = (u, role) => {
      const uid = u.studentNumber || u.username;
      const isSynced = ldapUsers.some(ldapU => ldapU.uid === uid);
      return {
        uid,
        fullName: u.fullName,
        email: u.email || '',
        role,
        className: u.className,
        department: u.department,
        orgUnit: u.className || u.department || '-',
        syncStatus: isSynced ? 'synced' : 'not_synced'
      };
    };

    const combined = [
      ...students.map(s => formatUser(s, 'Öğrenci')),
      ...teachers.map(t => formatUser(t, 'Öğretmen'))
    ];

    res.json({ success: true, users: combined });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/liderahenk/export - Seçili kullanıcıları LDAP'a aktar
/**
 * @swagger
 * /api/liderahenk/export:
 *   post:
 *     summary: POST /export
 *     tags: [Liderahenk]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/export', authenticateToken, authorizeRole('teacher'), async (req, res) => {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'Dışa aktarılacak kullanıcı seçilmedi.' });
    }

    const config = getLiderAhenkSettings();
    if (!config.enabled) {
      return res.status(400).json({ success: false, error: 'LiderAhenk entegrasyonu aktif değil.' });
    }

    // Gerçek şifreleri eklemek (opsiyonel veya default)
    // Şimdilik güvenlik gereği LDAP'a aktarılanların şifresi default "123456" gibi bir şey de olabilir, 
    // ama admin LiderAhenk üzerinden şifrelerini belirler diye geçiyorum.
    const usersToExport = users.map(u => ({
      ...u,
      password: u.password || '123456' // LiderAhenk'te ilk giriş şifresi
    }));

    const result = await exportToLDAP(config, usersToExport);

    let msg = `${result.successCount} kullanıcı LiderAhenk'e başarıyla aktarıldı.`;
    if (result.errors && result.errors.length > 0) {
       msg += ` Ancak bazı hatalar oluştu: ${result.errors[0]} vb.`;
    }

    res.json({ success: true, message: msg });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
