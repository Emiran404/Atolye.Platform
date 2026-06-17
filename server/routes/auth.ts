// @ts-nocheck

import express from 'express';
import { getData, setData, generateId } from '../utils/storage.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { generateToken, authenticateToken, authorizeRole } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import base64url from 'base64url';
import crypto from 'crypto';
import { authenticateLDAP, updateLDAPPassword } from '../utils/ldap.js';
import { addLog } from '../utils/logger.js';

const router = express.Router();

// Dinamik Sınıf listesini al
const getClasses = () => getData('classes') || ['9-A', '9-B', '10-A', '10-B', '11-A', '11-B', '12-A', '12-B'];

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

// Öğrenci klasör yolu oluştur
const generateStudentFolderPath = (className, fullName, studentNumber) => {
  const sanitizedName = fullName.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s]/g, '').trim();
  return `${className} ogrenciler/${sanitizedName}-${studentNumber}`;
};

// Öğrenci kayıt
router.post('/register/student', loginLimiter, async (req, res) => {
  try {
    const { studentNumber, fullName, className, password } = req.body;

    if (!studentNumber || !fullName || !className || !password) {
      return res.status(400).json({ success: false, error: 'Tüm alanlar gerekli!' });
    }

    const students = getData('students') || [];

    if (students.find(s => s.studentNumber === studentNumber)) {
      return res.status(400).json({ success: false, error: 'Bu okul numarası zaten kayıtlı!' });
    }

    const hashedPassword = hashPassword(password, studentNumber);
    const folderPath = generateStudentFolderPath(className, fullName, studentNumber);

    const newStudent = {
      id: generateId(),
      studentNumber,
      fullName,
      className,
      password: hashedPassword,
      folderPath,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      ipHistory: []
    };

    students.push(newStudent);
    setData('students', students);

    // Şifre olmadan döndür
    const { password: _, ...studentData } = newStudent;
    const token = generateToken({ id: newStudent.id, userType: 'student', studentNumber }, '30m');
    res.json({ success: true, user: studentData, userType: 'student', token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğrenci giriş
router.post('/login/student', loginLimiter, async (req, res) => {
  try {
    const { studentNumber, password } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!studentNumber || !password) {
      return res.status(400).json({ success: false, error: 'Okul numarası ve şifre gerekli!' });
    }

    const students = getData('students') || [];
    let currentStudent = students.find(s => s.studentNumber === studentNumber);
    const settings = getData('settings') || {};

    // Eğer öğrenci yoksa ve LDAP aktifse JIT Provisioning dene
    if (!currentStudent) {
      if (settings.liderAhenk?.enabled) {
        try {
          const ldapUser = await authenticateLDAP(settings.liderAhenk, studentNumber, password);
          if (ldapUser) {
            const fullName = ldapUser.fullName || studentNumber;
            const className = getClassFromLdapUser(ldapUser, 'SSO-İçe Aktarılan');
            ensureClassExists(className);
            const folderPath = generateStudentFolderPath(className, fullName, studentNumber);
            
            currentStudent = {
              id: generateId(),
              studentNumber,
              fullName,
              className,
              password: hashPassword(crypto.randomBytes(16).toString('hex'), studentNumber),
              folderPath,
              createdAt: new Date().toISOString(),
              lastLogin: null,
              ipHistory: [],
              isLdapUser: true
            };
            
            students.push(currentStudent);
            setData('students', students);
            console.log(`[LDAP] JIT Provisioning success: Student ${studentNumber} created.`);
          } else {
            return res.status(401).json({ success: false, error: 'Hesap bulunamadı ve LDAP doğrulaması başarısız.' });
          }
        } catch (ldapError) {
          return res.status(401).json({ success: false, error: 'LDAP Giriş Hatası: ' + ldapError.message });
        }
      } else {
        return res.status(401).json({ success: false, error: 'Bu okul numarası kayıtlı değil!' });
      }
    } else {
      // Yerel kullanıcı varsa hibrit kontrol
      const globalResetActive = settings.passwordChangeModeExpiresAt && new Date(settings.passwordChangeModeExpiresAt) > new Date();
      const studentResetActive = currentStudent.passwordChangeModeExpiresAt && new Date(currentStudent.passwordChangeModeExpiresAt) > new Date();

      if (globalResetActive || studentResetActive) {
        return res.json({ success: true, action: 'reset_password_required', studentNumber: currentStudent.studentNumber });
      }

      const isValid = verifyPassword(password, currentStudent.password, studentNumber);

      if (isValid) {
        // Yerel şifre doğruysa hemen girişe izin ver, LDAP senkronizasyonunu arka planda yap
        if (settings.liderAhenk?.enabled) {
          authenticateLDAP(settings.liderAhenk, studentNumber, password)
            .then(ldapUser => {
              if (ldapUser) {
                const studentsList = getData('students') || [];
                const updated = studentsList.map(s => {
                  if (s.id === currentStudent.id) {
                    return {
                      ...s,
                      fullName: ldapUser.fullName || s.fullName,
                      email: ldapUser.email || s.email
                    };
                  }
                  return s;
                });
                setData('students', updated);
              }
            })
            .catch(() => {});
        }
      } else {
        // Yerel şifre yanlışsa LDAP ile doğrulamayı dene (şifre LDAP'ta güncellenmiş olabilir)
        if (settings.liderAhenk?.enabled) {
          try {
            const ldapUser = await authenticateLDAP(settings.liderAhenk, studentNumber, password);
            if (ldapUser) {
              currentStudent.password = hashPassword(password, studentNumber);
              currentStudent.fullName = ldapUser.fullName || currentStudent.fullName;
              currentStudent.email = ldapUser.email || currentStudent.email;
              const updatedStudents = getData('students').map(s => s.id === currentStudent.id ? currentStudent : s);
              setData('students', updatedStudents);
            } else {
              return res.status(401).json({ success: false, error: 'Hatalı şifre!' });
            }
          } catch (ldapError) {
            return res.status(401).json({ success: false, error: 'Hatalı şifre! (LDAP Hatası: ' + ldapError.message + ')' });
          }
        } else {
          return res.status(401).json({ success: false, error: 'Hatalı şifre!' });
        }
      }
    }

    // Suspended kontrolü
    if (currentStudent.suspended) {
      return res.status(403).json({ success: false, error: 'Hesabınız askıya alınmış.' });
    }

    // IP ve son giriş güncelle
    currentStudent.ipHistory.push({
      ip: clientIp,
      date: new Date().toISOString()
    });
    currentStudent.lastLogin = new Date().toISOString();

    const updatedStudents = getData('students').map(s =>
      s.studentNumber === studentNumber ? currentStudent : s
    );
    setData('students', updatedStudents);

    const { password: _, ...studentData } = currentStudent;
    const token = generateToken({ id: currentStudent.id, userType: 'student', studentNumber }, '30m');

    addLog({
      type: 'login',
      userId: currentStudent.id,
      userName: currentStudent.fullName,
      role: 'student',
      action: 'Öğrenci sisteme giriş yaptı.',
      details: { ip: clientIp, studentNumber: currentStudent.studentNumber }
    });

    res.json({ success: true, user: studentData, userType: 'student', clientIp, token });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğrenci şifre sıfırlama (Sadece mod aktifken)
router.post('/login/student-reset', async (req, res) => {
  try {
    const { studentNumber, newPassword } = req.body;

    if (!studentNumber || !newPassword) {
      return res.status(400).json({ success: false, error: 'Eksik bilgi gonderildi.' });
    }

    const settings = getData('settings') || {};
    const globalResetActive = settings.passwordChangeModeExpiresAt && new Date(settings.passwordChangeModeExpiresAt) > new Date();

    const students = getData('students') || [];
    const student = students.find(s => s.studentNumber === studentNumber);

    if (!student) {
      return res.status(404).json({ success: false, error: 'Öğrenci bulunamadı.' });
    }

    const studentResetActive = student.passwordChangeModeExpiresAt && new Date(student.passwordChangeModeExpiresAt) > new Date();

    if (!globalResetActive && !studentResetActive) {
      return res.status(403).json({ success: false, error: 'Şifre değiştirme modu aktif değil veya süresi dolmuş.' });
    }

    student.password = hashPassword(newPassword, studentNumber);

    // LiderAhenk şifresini de güncelle (Opsiyonel hook)
    if (settings.liderAhenk && settings.liderAhenk.enabled) {
      try {
        await updateLDAPPassword(settings.liderAhenk, studentNumber, newPassword);
      } catch (ldapErr) {
        console.warn(`LiderAhenk şifre senkronizasyon uyarısı (${studentNumber}):`, ldapErr.message);
      }
    }

    // İşlem başarılı olduktan sonra kişisel modu kaldır.
    student.passwordChangeModeExpiresAt = null;

    // Log entry for reset
    student.ipHistory.push({
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      date: new Date().toISOString(),
      action: 'password_reset'
    });

    const updatedStudents = students.map(s => s.studentNumber === studentNumber ? student : s);
    setData('students', updatedStudents);

    res.json({ success: true, message: 'Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz.' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Belirli bir öğrenci için şifre sıfırlama modunu aktif et
router.post('/login/enable-student-reset-mode', authenticateToken, authorizeRole('teacher'), async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Öğrenci ID gerekli.' });
    }

    const students = getData('students') || [];
    const student = students.find(s => s.id === studentId);

    if (!student) {
      return res.status(404).json({ success: false, error: 'Öğrenci bulunamadı.' });
    }

    // 10 dakika geçerli
    student.passwordChangeModeExpiresAt = new Date(Date.now() + 10 * 60000).toISOString();

    const updatedStudents = students.map(s => s.id === studentId ? student : s);
    setData('students', updatedStudents);

    res.json({ success: true, message: 'Öğrenci için şifre değiştirme modu 10 dakikalığına aktif edildi.' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Öğretmen giriş
router.post('/login/teacher', loginLimiter, async (req, res) => {
  try {
    const { email, password, username, rememberMe } = req.body;

    // username veya email ile giriş yapılabilir
    const loginId = username || email;

    if (!loginId || !password) {
      return res.status(400).json({ success: false, error: 'Kullanıcı adı ve şifre gerekli!' });
    }

    const teachers = getData('teachers') || [];
    let currentTeacher = teachers.find(t => t.username === loginId || t.email === loginId);
    const settings = getData('settings') || {};

    // Eğer öğretmen yoksa ve LDAP aktifse JIT Provisioning dene
    if (!currentTeacher) {
      if (settings.liderAhenk?.enabled) {
        try {
          const ldapUser = await authenticateLDAP(settings.liderAhenk, loginId, password);
          if (ldapUser) {
            const teachersList = getData('teachers') || [];
            const department = getClassFromLdapUser(ldapUser, 'LDAP-Aktarılan');
            currentTeacher = {
              id: generateId(),
              username: loginId,
              email: ldapUser.email || null,
              fullName: ldapUser.fullName || loginId,
              department,
              password: hashPassword(crypto.randomBytes(16).toString('hex'), loginId),
              createdAt: new Date().toISOString(),
              lastLogin: null,
              isLdapUser: true
            };
            teachersList.push(currentTeacher);
            setData('teachers', teachersList);
            console.log(`[LDAP] JIT Provisioning success: Teacher ${loginId} created.`);
          } else {
            return res.status(401).json({ success: false, error: 'Hesap bulunamadı ve LDAP doğrulaması başarısız.' });
          }
        } catch (ldapError) {
          return res.status(401).json({ success: false, error: 'LDAP Giriş Hatası: ' + ldapError.message });
        }
      } else {
        return res.status(401).json({ success: false, error: 'Bu kullanıcı kayıtlı değil!' });
      }
    } else {
      // Yerel kullanıcı varsa hibrit kontrol
      const salt = currentTeacher.username || currentTeacher.email;
      const isValid = verifyPassword(password, currentTeacher.password, salt);

      if (isValid) {
        // Yerel şifre doğruysa hemen girişe izin ver, LDAP senkronizasyonunu arka planda yap
        if (settings.liderAhenk?.enabled) {
          authenticateLDAP(settings.liderAhenk, currentTeacher.username, password)
            .then(ldapUser => {
              if (ldapUser) {
                const teachersList = getData('teachers') || [];
                const updated = teachersList.map(t => {
                  if (t.id === currentTeacher.id) {
                    return {
                      ...t,
                      fullName: ldapUser.fullName || t.fullName,
                      email: ldapUser.email || t.email
                    };
                  }
                  return t;
                });
                setData('teachers', updated);
              }
            })
            .catch(() => {});
        }
      } else {
        // Yerel şifre yanlışsa LDAP ile doğrulamayı dene (şifre LDAP'ta güncellenmiş olabilir)
        if (settings.liderAhenk?.enabled) {
          try {
            const ldapUser = await authenticateLDAP(settings.liderAhenk, currentTeacher.username, password);
            if (ldapUser) {
              currentTeacher.password = hashPassword(password, salt);
              currentTeacher.fullName = ldapUser.fullName || currentTeacher.fullName;
              currentTeacher.email = ldapUser.email || currentTeacher.email;
              const updatedTeachers = getData('teachers').map(t => t.id === currentTeacher.id ? currentTeacher : t);
              setData('teachers', updatedTeachers);
            } else {
              return res.status(401).json({ success: false, error: 'Hatalı şifre!' });
            }
          } catch (ldapError) {
            return res.status(401).json({ success: false, error: 'Hatalı şifre! (LDAP Hatası: ' + ldapError.message + ')' });
          }
        } else {
          return res.status(401).json({ success: false, error: 'Hatalı şifre!' });
        }
      }
    }

    // Suspended kontrolü
    if (currentTeacher.suspended) {
      return res.status(403).json({ success: false, error: 'Hesabınız askıya alınmış.' });
    }

    currentTeacher.lastLogin = new Date().toISOString();
    const updatedTeachers = getData('teachers').map(t => t.id === currentTeacher.id ? currentTeacher : t);
    setData('teachers', updatedTeachers);

    const { password: _, ...teacherData } = currentTeacher;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const token = generateToken(
      { id: currentTeacher.id, userType: 'teacher', username: currentTeacher.username },
      rememberMe ? '7d' : '24h'
    );

    addLog({
      type: 'login',
      userId: currentTeacher.id,
      userName: currentTeacher.fullName,
      role: 'teacher',
      action: 'Öğretmen sisteme giriş yaptı.',
      details: { ip: clientIp, username: currentTeacher.username }
    });

    res.json({ success: true, user: teacherData, userType: 'teacher', clientIp, token });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Sunucu hatası: ' + error.message });
  }
});

// Öğretmen kayıt
router.post('/register/teacher', loginLimiter, async (req, res) => {
  try {
    const { username, fullName, password, department, email } = req.body;

    if (!username || !fullName || !password) {
      return res.status(400).json({ success: false, error: 'Kullanıcı adı, ad soyad ve şifre gerekli!' });
    }

    const teachers = getData('teachers') || [];

    if (teachers.find(t => t.username === username)) {
      return res.status(400).json({ success: false, error: 'Bu kullanıcı adı zaten kayıtlı!' });
    }

    const hashedPassword = hashPassword(password, username);
    const isFirstTeacher = teachers.length === 0;

    const newTeacher = {
      id: generateId(),
      username,
      email: email || null,
      fullName,
      department: department || null,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    teachers.push(newTeacher);
    setData('teachers', teachers);

    // İlk kayıt ise öğretmen kayıtlarını otomatik kapat
    if (isFirstTeacher) {
      const settings = getData('settings') || {};
      settings.teacherRegistrationEnabled = false;
      setData('settings', settings);
      console.log('🛡️ İlk öğretmen kaydı yapıldı. Güvenlik için öğretmen kayıtları otomatik olarak kapatıldı.');
    }

    const { password: _, ...teacherData } = newTeacher;
    const token = generateToken({ id: newTeacher.id, userType: 'teacher', username: newTeacher.username });
    res.json({ 
      success: true, 
      user: teacherData, 
      userType: 'teacher', 
      token,
      firstTeacherInSystem: isFirstTeacher 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tüm öğrencileri getir
router.get('/students', (req, res) => {
  try {
    const students = getData('students') || [];
    // Şifreleri çıkar
    const safeStudents = students.map(({ password, ...rest }) => rest);
    res.json({ success: true, students: safeStudents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sınıf listesi
router.get('/classes', (req, res) => {
  res.json({ success: true, classes: getClasses() });
});

// Passkey (WebAuthn) Endpoints
// Passkey kayıt için challenge oluştur
router.post('/passkey/register-challenge', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Kullanıcı adı gerekli!' });
    const challenge = base64url(crypto.randomBytes(32));
    res.json({ challenge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Passkey kaydını tamamla
router.post('/passkey/register', (req, res) => {
  try {
    const { username, credentialId, publicKey } = req.body;
    if (!username || !credentialId || !publicKey) {
      return res.status(400).json({ error: 'Eksik veri!' });
    }

    const teachers = getData('teachers') || [];
    const teacherIndex = teachers.findIndex(t => t.username === username);

    if (teacherIndex === -1) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
    }

    const teacher = teachers[teacherIndex];
    if (!teacher.passkeys) {
      teacher.passkeys = [];
      if (teacher.credentialId) {
        teacher.passkeys.push({
          id: Date.now().toString(),
          name: 'Cihaz 1',
          credentialId: teacher.credentialId,
          publicKey: teacher.publicKey,
          createdAt: new Date().toISOString()
        });
      }
    }

    if (teacher.passkeys.length >= 5) {
      return res.status(400).json({ error: 'Maksimum 5 passkey eklenebilir!' });
    }

    teacher.passkeys.push({
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      name: `Cihaz ${teacher.passkeys.length + 1}`,
      credentialId,
      publicKey,
      createdAt: new Date().toISOString()
    });

    teacher.passkeyEnabled = true;
    teachers[teacherIndex] = teacher;

    setData('teachers', teachers);
    res.json({ success: true, passkeys: teacher.passkeys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Passkey Sil
/**
 * @swagger
 * /api/auth/passkey/remove:
 *   post:
 *     summary: POST /passkey/remove
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Başarılı işlem
 */
router.post('/passkey/remove', (req, res) => {
  try {
    const { username, passkeyId } = req.body;
    if (!username || !passkeyId) return res.status(400).json({ error: 'Eksik veri!' });

    const teachers = getData('teachers') || [];
    const teacherIndex = teachers.findIndex(t => t.username === username);

    if (teacherIndex === -1) return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });

    const teacher = teachers[teacherIndex];
    if (!teacher.passkeys) teacher.passkeys = [];

    teacher.passkeys = teacher.passkeys.filter(p => p.id !== passkeyId);

    if (teacher.passkeys.length === 0) {
      teacher.passkeyEnabled = false;
    }

    teachers[teacherIndex] = teacher;
    setData('teachers', teachers);

    res.json({ success: true, passkeys: teacher.passkeys, passkeyEnabled: teacher.passkeyEnabled });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Passkey ile giriş için challenge
router.post('/passkey/login-challenge', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Kullanıcı adı gerekli!' });

    const teachers = getData('teachers') || [];
    const teacher = teachers.find(t => t.username === username);

    if (!teacher || !teacher.passkeyEnabled) {
      return res.json({ success: false, error: 'Passkey aktif değil!' });
    }

    const credentialIds = teacher.passkeys 
      ? teacher.passkeys.map(p => p.credentialId) 
      : (teacher.credentialId ? [teacher.credentialId] : []);

    const challenge = base64url(crypto.randomBytes(32));
    res.json({ challenge, credentialIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Öğrenci şifre değiştirme (Öğretmen tarafından)
router.post('/change-student-password', authenticateToken, authorizeRole('teacher'), async (req, res) => {
  try {
    const { studentId, studentNumber, newPassword } = req.body;

    if (!studentId || !studentNumber || !newPassword) {
      return res.status(400).json({ success: false, error: 'Tüm alanlar gerekli!' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Şifre en az 6 karakter olmalıdır!' });
    }

    const students = getData('students') || [];
    const studentIndex = students.findIndex(s => s.id === studentId && s.studentNumber === studentNumber);

    if (studentIndex === -1) {
      return res.status(404).json({ success: false, error: 'Öğrenci bulunamadı!' });
    }

    // Yeni şifreyi hash'le
    const hashedPassword = hashPassword(newPassword, studentNumber);
    students[studentIndex].password = hashedPassword;

    // Yönetici/Öğretmen şifreyi değiştirdiğinde LiderAhenk'e de yansıt
    const settings = getData('settings') || {};
    if (settings.liderAhenk && settings.liderAhenk.enabled) {
      try {
        await updateLDAPPassword(settings.liderAhenk, studentNumber, newPassword);
      } catch (ldapErr) {
        console.warn(`Admin LDAP şifre senkronizasyon uyarısı (${studentNumber}):`, ldapErr.message);
      }
    }

    setData('students', students);

    res.json({ success: true, message: 'Şifre başarıyla değiştirildi!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Passkey ile giriş doğrulama
router.post('/passkey/login', (req, res) => {
  try {
    const { username, credentialId, authenticatorData, clientDataJSON, signature, rememberMe } = req.body;

    if (!username || !credentialId || !authenticatorData || !clientDataJSON || !signature) {
      return res.status(400).json({ error: 'Eksik veri!' });
    }

    const teachers = getData('teachers') || [];
    const teacherIndex = teachers.findIndex(t => t.username === username);

    if (teacherIndex === -1) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
    }

    const teacher = teachers[teacherIndex];

    const passkey = teacher.passkeys?.find(p => p.credentialId === credentialId);
    const isValid = passkey || teacher.credentialId === credentialId;

    if (!teacher.passkeyEnabled || !isValid) {
      return res.status(404).json({ error: 'Passkey bulunamadı!' });
    }

    // Gerçek WebAuthn doğrulaması için publicKey ile signature doğrulanmalı
    // Şimdilik basit kontrol: credentialId eşleşirse başarılı
    teacher.lastLogin = new Date().toISOString();
    teachers[teacherIndex] = teacher;
    setData('teachers', teachers);

    const { password: _, ...teacherData } = teacher;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const token = generateToken(
      { id: teacher.id, userType: 'teacher', username: teacher.username },
      rememberMe ? '7d' : '24h'
    );
    res.json({ success: true, user: teacherData, userType: 'teacher', clientIp, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Master Recovery Key Oluştur
router.post('/recovery-key/generate', (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Kullanıcı adı gerekli!' });

    const teachers = getData('teachers') || [];
    const teacherIndex = teachers.findIndex(t => t.username === username);

    if (teacherIndex === -1) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
    }

    // 1. Rastgele güvenli bir anahtar oluştur (Örn: POLYOS-REC-A1B2-C3D4)
    const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase(); // 16 karakter
    const key = `POLYOS-REC-${randomBytes.slice(0, 4)}-${randomBytes.slice(4, 8)}-${randomBytes.slice(8, 12)}-${randomBytes.slice(12, 16)}`;

    // 2. Anahtarı hashle
    const hashedKey = hashPassword(key, username); // Salt olarak username kullanıyoruz

    // 3. Kaydet
    teachers[teacherIndex].recoveryKeyHash = hashedKey;
    teachers[teacherIndex].recoveryKeyCreatedAt = new Date().toISOString();

    setData('teachers', teachers);

    // 4. Plaintext key'i döndür (Sadece bu seferlik!)
    res.json({ success: true, recoveryKey: key });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recovery Key ile Şifre Sıfırla
router.post('/recovery-key/reset', (req, res) => {
  try {
    const { username, recoveryKey, newPassword } = req.body;

    if (!username || !recoveryKey || !newPassword) {
      return res.status(400).json({ error: 'Eksik veri!' });
    }

    const teachers = getData('teachers') || [];
    const teacherIndex = teachers.findIndex(t => t.username === username);

    if (teacherIndex === -1) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
    }

    const teacher = teachers[teacherIndex];

    if (!teacher.recoveryKeyHash) {
      return res.status(400).json({ error: 'Bu hesap için kurtarma anahtarı oluşturulmamış.' });
    }

    // 1. Anahtarı doğrula
    const isValidKey = verifyPassword(recoveryKey, teacher.recoveryKeyHash, username);

    if (!isValidKey) {
      return res.status(401).json({ error: 'Geçersiz kurtarma anahtarı!' });
    }

    // 2. Yeni şifreyi ayarla
    const hashedNewPassword = hashPassword(newPassword, username);
    teachers[teacherIndex].password = hashedNewPassword;

    // Opsiyonel: Anahtarı tek kullanımlık yapmak isterseniz burayı açın
    // teachers[teacherIndex].recoveryKeyHash = null; 

    setData('teachers', teachers);

    res.json({ success: true, message: 'Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OGA (Öğrenci Gönderme) Token Doğrulama
router.post('/oga-verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token bulunamadı!' });

    // Token Decode
    const data = JSON.parse(Buffer.from(token, 'base64').toString());
    const { studentIds, exp } = data;

    if (!studentIds || !exp) {
      return res.status(400).json({ success: false, error: 'Geçersiz token formatı!' });
    }

    // Süre kontrolü
    if (Date.now() > exp) {
      return res.status(410).json({ success: false, error: 'Token süresi dolmuş!' });
    }

    res.json({ success: true, studentCount: studentIds.length, expiry: exp });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Token çözülemedi!' });
  }
});

// OGA Login - Sadece OGA seansına dahil öğrenciler için
router.post('/oga-login', async (req, res) => {
  try {
    const { studentNumber, password, token } = req.body;
    if (!studentNumber || !password || !token) {
      return res.status(400).json({ success: false, error: 'Eksik bilgi!' });
    }

    // Token Decode & Verify
    const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
    if (Date.now() > tokenData.exp) {
      return res.status(410).json({ success: false, error: 'Oturum süresi dolmuş!' });
    }

    const students = getData('students') || [];
    const student = students.find(s => s.studentNumber === studentNumber);

    if (!student) {
      return res.status(401).json({ success: false, error: 'Öğrenci bulunamadı!' });
    }

    // Bu öğrenci bu transfer seansına (token) dahil mi?
    if (!tokenData.studentIds.includes(student.id)) {
      return res.status(403).json({ success: false, error: 'Bu aktarım oturumu sizin için aktif değil!' });
    }

    // Şifre kontrolü
    const isValid = verifyPassword(password, student.password, studentNumber);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Hatalı şifre!' });
    }

    const { password: _, ...studentData } = student;
    res.json({ success: true, user: studentData });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Aktarım sırasında hata oluştu.' });
  }
});

// Setup Settings - Öğretmen hesabı var mı?
router.get('/setup-status', (req, res) => {
  try {
    const teachers = getData('teachers') || [];
    const isSetupRequired = teachers.length === 0;
    res.json({ success: true, isSetupRequired });
  } catch (error) {
    console.error('❌ Setup status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
