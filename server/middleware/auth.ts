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
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * JWT Secret Key.
 * Öncelik: process.env.JWT_SECRET.
 * Yoksa: data/.jwt_secret dosyasından okunur; o da yoksa güvenli rastgele üretilip
 * kalıcı olarak yazılır (yeniden başlatmada token'lar geçersiz olmasın diye).
 *
 * GÜVENLİK: Repo'ya gömülü sabit varsayılan secret KALDIRILDI. Sabit secret,
 * kaynağı bilen herkesin geçerli öğretmen token'ı imzalamasına izin veriyordu.
 */
let cachedSecret = null;
const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (cachedSecret) return cachedSecret;

  const secretPath = join(__dirname, '../data/.jwt_secret');
  try {
    if (fs.existsSync(secretPath)) {
      cachedSecret = fs.readFileSync(secretPath, 'utf8').trim();
      if (cachedSecret) return cachedSecret;
    }
  } catch (_) { /* okuma hatası → yeni üret */ }

  cachedSecret = crypto.randomBytes(48).toString('hex');
  try {
    fs.mkdirSync(dirname(secretPath), { recursive: true });
    fs.writeFileSync(secretPath, cachedSecret, { encoding: 'utf8', mode: 0o600 });
    console.warn('🔐 JWT_SECRET ortam değişkeni bulunamadı. data/.jwt_secret dosyasına kalıcı rastgele bir secret üretildi.');
  } catch (err) {
    console.warn('⚠️ JWT secret dosyaya yazılamadı, bu oturum için bellekte kullanılacak:', err.message);
  }
  return cachedSecret;
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
 * Token'ı doğrular, geçerliyse decode edilmiş payload'ı, değilse null döner.
 * Middleware olmayan yerlerde (örn. Socket.IO handler'ları) kullanılır.
 */
export function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (_) {
    return null;
  }
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
