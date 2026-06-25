// @ts-nocheck
/**
 * JWT Authentication & Authorization Middleware
 * Teknofest 2026 - Pardus Hata ve Öneri
 * 
 * Tüm korumalı API endpoint'lerinde kullanılır.
 * Login sonrası döndürülen JWT token'ı Authorization header'ında gönderilmelidir.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// JWT Secret Key - .env'den al veya güvenli rastgele üret
// ÖNEMLİ: ESM hoisting nedeniyle process.env'yi fonksiyon içinde kontrol ediyoruz
const getJwtSecret = () => {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET is not set in production!');
  }
  return process.env.JWT_SECRET || 'teknofest-default-secret-key-2026';
};
const JWT_EXPIRY = '24h'; // Token süresi

/**
 * JWT Token üretir
 * @param {Object} payload - Token içeriği (userId, userType, vb.)
 * @returns {string} JWT token
 */
export function generateToken(payload, expiresIn = JWT_EXPIRY) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

/**
 * JWT Token doğrulama middleware'i
 * Authorization: Bearer <token> header'ı beklenir
 * Başarılıysa req.user'a decode edilmiş token verisini ekler
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Yetkilendirme gerekli. Lütfen giriş yapın.' 
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded; // { id, userType, fullName, ... }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Oturum süresi doldu. Lütfen tekrar giriş yapın.' 
      });
    }
    return res.status(403).json({ 
      success: false, 
      error: 'Geçersiz yetkilendirme token\'ı.' 
    });
  }
}

/**
 * Rol bazlı yetkilendirme middleware factory'si
 * @param  {...string} roles - İzin verilen roller ('teacher', 'student')
 * @returns {Function} Express middleware
 * 
 * Kullanım: authorizeRole('teacher')
 * Kullanım: authorizeRole('teacher', 'student')
 */
export function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Yetkilendirme gerekli.' 
      });
    }

    if (!roles.includes(req.user.userType)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Bu işlem için yetkiniz yok.' 
      });
    }

    next();
  };
}

/**
 * Opsiyonel auth middleware - Token varsa doğrular, yoksa devam eder
 * Public + Authenticated kullanıcılar için farklı davranış gereken endpoint'lerde kullanılır
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      req.user = jwt.verify(token, getJwtSecret());
    } catch (err) {
      // Token geçersiz ama zorunlu değil, devam et
      req.user = null;
    }
  }

  next();
}
